import { useCallback, useEffect, useMemo, useState } from 'react';
import { useReferentiels } from '../hooks/useReferentiels';
import {
  analyserImport,
  appliquerImport,
  archiverVendeur,
  chargerArchives,
  creerVendeur,
  desarchiverVendeur,
  modifierVendeur,
  purgerVendeur,
  type Apercu,
  type LigneApercu,
  type VendeurArchive,
  type VendeurReferentiel,
} from '../services/referentiels';
import type { Marque, Site, TypeVehicule } from '../types';
// Comparaison de libelles SANS dependre de la locale : `localeCompare` peut
// classer differemment selon la version d'ICU, et un tri qui change de machine
// en machine n'est pas un tri. Source unique : `backend/src/utils/tri.ts`.
import { cleTri, comparerLibelle } from '../backend/src/utils/tri';
import {
  definirEncadrement,
  libelleRoleEncadrement,
  libelleRoleGlobal,
} from '../services/utilisateurs';

// ============================================================================
// ECRAN VENDEURS — F-A3.1 a F-A3.8
//
// Quatre choses au meme endroit, parce que ce sont quatre faces du meme geste :
// tenir a jour la liste des vendeurs d'un site.
//
//   1. LA LISTE : ajouter, renommer, transferer d'un site a l'autre, renseigner
//      entree et sortie, archiver.
//   2. L'ENCADREMENT : le chef de site et les chefs de vente, par site.
//   3. LES CAPACITES : le metier (VN ou VO) et, pour un VN, les marques.
//   4. L'IMPORT par collage, pour les marques en masse.
//
// LE METIER EST UN SCALAIRE, lu dans le fichier source : 72 VN et 27 VO. Un
// vendeur VO n'a AUCUNE ventilation par marque — ses colonnes de marque sont
// vides ici comme la-bas.
//
// L'ENCADREMENT NE SE COMPTE PAS PAREIL SELON LE ROLE, et c'est metier :
//   - UN SEUL chef de site par site, tous metiers confondus ;
//   - au plus UN chef de vente par site ET PAR METIER. Un gros site peut en avoir
//     un VN et un VO. Beaucoup de sites n'en ont aucun.
// Ce sont des TRIGGERS qui le tiennent, pas cet ecran : le refus arrive du
// serveur avec son message, et on l'affiche tel quel.
//
// AUCUNE NOTION DE << CONFIRME >>. Une jauge distinguait autrefois une donnee
// validee du placeholder pose par le seed. Retiree : un vendeur present en base
// est valide, point. Une progression qui ne bouge jamais devient un reproche
// permanent, et elle mesurait une dette de saisie, pas une propriete du metier.
//
// DEUX NIVEAUX DE RETRAIT, et la distinction est le coeur du sujet :
//   - la POUBELLE archive — la ligne disparait, ses RDV restent en base, les
//     totaux des campagnes passees ne bougent pas. Reversible.
//   - la PURGE, dans le volet Archivage, detruit definitivement, RDV compris.
//     Derriere une seconde porte, sur une liste ou l'on voit ce qu'on detruit.
// ============================================================================

/// Colonnes triables. Le tri s'applique DANS chaque site : c'est la question
/// qu'on se pose devant un site (« qui vend du Dacia ici ? »), pas devant les 99.
type Tri = { colonne: string; croissant: boolean };

export function Vendeurs() {
  const { donnees, index, chargement, erreur, recharger, majVendeur } = useReferentiels();
  const [afficherSortis, setAfficherSortis] = useState(false);
  const [enCours, setEnCours] = useState<string | null>(null);
  const [messageErreur, setMessageErreur] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);
  const [tri, setTri] = useState<Tri>({ colonne: 'nom', croissant: true });

  const [collage, setCollage] = useState('');
  const [apercu, setApercu] = useState<Apercu | null>(null);
  const [analyseEnCours, setAnalyseEnCours] = useState(false);
  const [zoneCollage, setZoneCollage] = useState(false);
  const [zoneArchives, setZoneArchives] = useState(false);
  const [siteEnAjout, setSiteEnAjout] = useState<string | null>(null);
  const [editionId, setEditionId] = useState<string | null>(null);

  /// Incremente a chaque archivage. Le volet Archivage s'en sert comme signal de
  /// relecture : sans lui, archiver un vendeur pendant que le volet est ouvert le
  /// laissait perime — le vendeur disparaissait de la liste sans apparaitre dans
  /// les archives. Constate a l'essai.
  const [versionArchives, setVersionArchives] = useState(0);

  if (chargement) return <div className="attente">Chargement des référentiels…</div>;
  if (erreur) return <div className="erreur-bloc">{erreur}</div>;
  if (!donnees || !index) return null;

  const agir = async (id: string, action: () => Promise<string | void>) => {
    setMessageErreur(null);
    setSucces(null);
    setEnCours(id);
    try {
      const message = await action();
      if (typeof message === 'string') setSucces(message);
    } catch (e) {
      setMessageErreur(e instanceof Error ? e.message : 'Opération impossible.');
    } finally {
      setEnCours(null);
    }
  };

  const basculerMarque = (v: VendeurReferentiel, marqueId: string) => {
    const suivantes = v.marqueIds.includes(marqueId)
      ? v.marqueIds.filter((m) => m !== marqueId)
      : [...v.marqueIds, marqueId];

    // Refus cote client AUSSI, pour donner la raison immediatement. Le serveur
    // refuse de toute facon : cacher le bouton n'est pas une securite, et
    // l'afficher sans expliquer n'est pas une interface.
    if (suivantes.length === 0) {
      setMessageErreur(
        `${v.nom} : au moins une marque est requise pour un vendeur VN. Sans marque, il ne peut ` +
          'recevoir aucun RDV. Pour lui ôter toute ventilation par marque, le passer en VO.'
      );
      return;
    }

    void agir(v.id, async () => {
      const r = await modifierVendeur(v.id, { marqueIds: suivantes });
      majVendeur(v.id, { marqueIds: r.marqueIds });
    });
  };

  /// Rattacher un ENCADRANT a un site, ou detacher celui qui y est.
  ///
  /// UN SEUL APPEL. Le serveur libere le role puis le donne, dans la meme
  /// transaction : c'est lui qui garantit l'ordre, pas l'ecran. Une version
  /// precedente lancait deux requetes cote a cote sans les attendre et se
  /// marchait dessus — l'unique `(site, role)` refusait la seconde selon le
  /// hasard du reseau.
  const changerEncadrement = (siteId: string, role: string, utilisateurId: string | null) =>
    void agir(`${siteId}-${role}`, async () => {
      await definirEncadrement(siteId, role, utilisateurId);
      await recharger();
    });

  const lancerAnalyse = async () => {
    setMessageErreur(null);
    setApercu(null);
    setAnalyseEnCours(true);
    try {
      setApercu(await analyserImport(collage));
    } catch (e) {
      setMessageErreur(e instanceof Error ? e.message : 'Analyse impossible.');
    } finally {
      setAnalyseEnCours(false);
    }
  };

  const appliquer = async () => {
    if (!apercu) return;
    const aAppliquer = apercu.lignes
      .filter((l): l is Extract<LigneApercu, { statut: 'resolue' }> => l.statut === 'resolue')
      .filter((l) => l.changement)
      .map((l) => ({ vendeurId: l.vendeurId, marqueIds: l.marqueIds }));
    if (aAppliquer.length === 0) return;

    setMessageErreur(null);
    try {
      const r = await appliquerImport(aAppliquer);
      setApercu(null);
      setCollage('');
      setZoneCollage(false);
      await recharger();
      setSucces(`${r.appliquees} vendeur${r.appliquees > 1 ? 's' : ''} mis à jour.`);
    } catch (e) {
      setMessageErreur(e instanceof Error ? e.message : 'Application impossible.');
    }
  };

  const changements = apercu?.resume.changements ?? 0;
  const bloquantes = apercu
    ? apercu.resume.introuvables +
      apercu.resume.ambigues +
      apercu.resume.marquesInconnues +
      apercu.resume.sansMarque
    : 0;

  const actifs = donnees.vendeurs.filter((v) => !v.dateSortie);

  return (
    <section className="ecran">
      <header className="ecran-entete">
        <div>
          <h2>Vendeurs</h2>
          <p className="note">
            La liste, l’encadrement de chaque site, et les capacités. Le métier VN/VO vient du
            fichier source ; les <strong>marques</strong>, elles, n’y existent pas — le seed a posé
            celles du site, et les restreindre vendeur par vendeur est ce qui donne du mordant à
            R-C.1.
          </p>
        </div>
        <div className="progression">
          <strong>{actifs.length}</strong>
          <span>
            en poste — {actifs.filter((v) => v.typeVehicule === 'VN').length} VN /{' '}
            {actifs.filter((v) => v.typeVehicule === 'VO').length} VO
          </span>
        </div>
      </header>

      <div className="barre-outils">
        <label className="interrupteur">
          <input
            type="checkbox"
            checked={afficherSortis}
            onChange={(e) => setAfficherSortis(e.target.checked)}
          />
          Afficher les vendeurs sortis
        </label>
        <button type="button" className="secondaire" onClick={() => setZoneCollage((o) => !o)}>
          {zoneCollage ? 'Fermer l’import' : 'Importer les marques depuis Excel'}
        </button>
        <button type="button" className="lien" onClick={() => setZoneArchives((o) => !o)}>
          {zoneArchives ? 'Fermer l’archivage' : 'Archivage'}
        </button>
      </div>

      {messageErreur && <div className="erreur-bloc">{messageErreur}</div>}
      {succes && <div className="succes-bloc">{succes}</div>}

      {zoneArchives && (
        <ZoneArchivage
          version={versionArchives}
          onErreur={setMessageErreur}
          onSucces={setSucces}
          onChangement={() => {
            void recharger();
            setVersionArchives((v) => v + 1);
          }}
        />
      )}

      {zoneCollage && (
        <div className="carte">
          <h3>Import des marques par collage</h3>
          <p className="note">
            Deux formats acceptés : une colonne contenant les marques
            («&nbsp;RENAULT DACIA&nbsp;»), ou une colonne par marque avec un x — ce second format
            demande une ligne d’en-tête nommant les marques. Une colonne de code site lève les
            homonymies. <strong>Rien n’est enregistré avant votre validation</strong>, et le métier
            VN/VO n’est pas touché.
          </p>
          <textarea
            value={collage}
            onChange={(e) => setCollage(e.target.value)}
            rows={6}
            spellCheck={false}
            placeholder={'CLF\tVALENTIN PARPINELLI\tRENAULT DACIA'}
          />
          <div className="actions">
            <button
              type="button"
              className="principal"
              onClick={lancerAnalyse}
              disabled={analyseEnCours || !collage.trim()}
            >
              {analyseEnCours ? 'Analyse…' : 'Analyser'}
            </button>
          </div>

          {apercu && (
            <div className="apercu">
              <p className="resume">
                <strong>{apercu.resume.total}</strong> lignes lues — {changements} à appliquer,{' '}
                {apercu.resume.inchangees} déjà conformes
                {bloquantes > 0 && (
                  <>
                    , <span className="alerte">{bloquantes} à corriger</span>
                  </>
                )}
                . Format détecté&nbsp;:{' '}
                {apercu.format === 'marques_groupees'
                  ? 'marques groupées'
                  : 'une colonne par marque'}
                , séparateur {apercu.separateur}
                {apercu.enTeteDetecte ? ', en-tête détecté' : ''}.
              </p>

              <table className="tableau">
                <thead>
                  <tr>
                    <th>Ligne</th>
                    <th>Vendeur</th>
                    <th>Site</th>
                    <th>Marques</th>
                    <th>État</th>
                  </tr>
                </thead>
                <tbody>
                  {apercu.lignes.map((l) => (
                    <tr key={l.numero} className={l.statut === 'resolue' ? '' : 'ligne-probleme'}>
                      <td>{l.numero}</td>
                      <td>{l.statut === 'resolue' ? l.nomVendeur : l.nom}</td>
                      <td>{l.statut === 'resolue' ? l.codeSite : ''}</td>
                      <td>{l.statut === 'resolue' ? l.marquesLibelles.join(' + ') : ''}</td>
                      <td>{libelleStatut(l)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="actions">
                <button type="button" className="principal" onClick={appliquer} disabled={changements === 0}>
                  {changements === 0
                    ? 'Aucun changement à appliquer'
                    : `Appliquer ${changements} ligne${changements > 1 ? 's' : ''}`}
                </button>
                <button type="button" className="secondaire" onClick={() => setApercu(null)}>
                  Annuler
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {index.vendeursParSite.map(({ site, plaque, vendeurs }) => (
        <CarteSite
          key={site.id}
          site={site}
          plaqueLibelle={plaque?.libelle ?? null}
          vendeurs={vendeurs}
          marques={donnees.marques}
          sites={donnees.sites}
          types={donnees.typesVehicule}
          afficherSortis={afficherSortis}
          tri={tri}
          onTrier={(colonne) =>
            setTri((t) => ({ colonne, croissant: t.colonne === colonne ? !t.croissant : true }))
          }
          enCours={enCours}
          editionId={editionId}
          enAjout={siteEnAjout === site.id}
          onEditer={(id) => setEditionId(editionId === id ? null : id)}
          onOuvrirAjout={() => setSiteEnAjout(site.id)}
          onFermerAjout={() => setSiteEnAjout(null)}
          onBasculerMarque={basculerMarque}
          encadrements={donnees.encadrements.filter((e) => e.siteId === site.id)}
          encadrantsDisponibles={donnees.encadrantsDisponibles}
          rolesEncadrement={donnees.rolesEncadrement}
          onChangerEncadrement={changerEncadrement}
          onEnregistrer={(v, champs) =>
            void agir(v.id, async () => {
              await modifierVendeur(v.id, champs);
              await recharger();
              setEditionId(null);
              return `${v.nom} enregistré.`;
            })
          }
          onArchiver={(v) => {
            const ok = window.confirm(
              `Archiver ${v.nom} ?\n\n` +
                'Il disparaît des écrans, mais ses RDV restent en base : les totaux des ' +
                'campagnes passées ne bougent pas.\n\n' +
                'Réversible depuis le volet Archivage.'
            );
            if (!ok) return;
            void agir(v.id, async () => {
              const r = await archiverVendeur(v.id);
              await recharger();
              setVersionArchives((n) => n + 1);
              return r.message;
            });
          }}
          onCreer={(champs) =>
            void agir(`nouveau-${site.id}`, async () => {
              await creerVendeur({ ...champs, siteId: site.id });
              await recharger();
              setSiteEnAjout(null);
              return `${champs.nom} ajouté à ${site.libelle}.`;
            })
          }
        />
      ))}
    </section>
  );
}

// ---------------------------------------------------------------- un site

function CarteSite({
  site,
  plaqueLibelle,
  vendeurs,
  marques,
  sites,
  types,
  afficherSortis,
  tri,
  onTrier,
  enCours,
  editionId,
  enAjout,
  onEditer,
  onOuvrirAjout,
  onFermerAjout,
  onBasculerMarque,
  encadrements,
  encadrantsDisponibles,
  rolesEncadrement,
  onChangerEncadrement,
  onEnregistrer,
  onArchiver,
  onCreer,
}: {
  site: Site;
  plaqueLibelle: string | null;
  vendeurs: VendeurReferentiel[];
  marques: Marque[];
  sites: Site[];
  types: TypeVehicule[];
  afficherSortis: boolean;
  tri: Tri;
  onTrier: (colonne: string) => void;
  enCours: string | null;
  editionId: string | null;
  enAjout: boolean;
  onEditer: (id: string) => void;
  onOuvrirAjout: () => void;
  onFermerAjout: () => void;
  onBasculerMarque: (v: VendeurReferentiel, marqueId: string) => void;
  encadrements: { id: string; role: string; utilisateurId: string; nom: string }[];
  encadrantsDisponibles: {
    id: string;
    nom: string;
    loginId: string;
    rolesGlobaux: string[];
    encadrements: { role: string; siteCode: string }[];
  }[];
  rolesEncadrement: string[];
  onChangerEncadrement: (siteId: string, role: string, utilisateurId: string | null) => void;
  onEnregistrer: (v: VendeurReferentiel, champs: ChampsEdition) => void;
  onArchiver: (v: VendeurReferentiel) => void;
  onCreer: (champs: {
    nom: string;
    marqueIds: string[];
    typeVehicule: TypeVehicule;
    dateEntree: string | null;
  }) => void;
}) {
  const enPoste = vendeurs.filter((v) => !v.dateSortie);

  const visibles = useMemo(() => {
    const liste = vendeurs.filter((v) => afficherSortis || !v.dateSortie);
    const cle = (v: VendeurReferentiel): string | number => {
      if (tri.colonne === 'nom') return cleTri(v.nom);
      if (tri.colonne === 'metier') return v.typeVehicule;
      if (tri.colonne.startsWith('marque:')) {
        return v.marqueIds.includes(tri.colonne.slice(7)) ? 0 : 1;
      }
      return cleTri(v.nom);
    };
    return [...liste].sort((a, b) => {
      const ka = cle(a);
      const kb = cle(b);
      // Departage TOUJOURS par le nom : sans lui, deux vendeurs indiscernables
      // sur la colonne triee changeraient de place a chaque rendu.
      //
      // `comparerLibelle` plutot qu'une comparaison directe : il rend 0 pour deux
      // noms VRAIMENT identiques, la ou l'ancien code rendait -1 dans ce cas et
      // pretendait donc qu'un homonyme precede l'autre — un ordre qui s'inversait
      // selon l'ordre d'arrivee des lignes.
      const primaire = ka < kb ? -1 : ka > kb ? 1 : 0;
      const resultat = primaire !== 0 ? primaire : comparerLibelle(a.nom, b.nom);
      return tri.croissant ? resultat : -resultat;
    });
  }, [vendeurs, afficherSortis, tri]);

  return (
    <div className="carte">
      <h3>
        {site.libelle}
        <span className="etiquette">{site.code}</span>
        {plaqueLibelle && <span className="etiquette">{plaqueLibelle}</span>}
        <span className="etiquette">
          {enPoste.filter((v) => v.typeVehicule === 'VN').length} VN ·{' '}
          {enPoste.filter((v) => v.typeVehicule === 'VO').length} VO
        </span>
      </h3>

      <BlocEncadrement
        siteId={site.id}
        encadrements={encadrements}
        disponibles={encadrantsDisponibles}
        roles={rolesEncadrement}
        occupe={enCours !== null}
        onChanger={onChangerEncadrement}
      />

      {visibles.length === 0 ? (
        <p className="note">
          {vendeurs.length === 0
            ? "Aucun vendeur sur ce site. C'est un cas prévu : l'onglet MDP du fichier source était dans ce cas."
            : 'Tous les vendeurs de ce site sont sortis. Cocher « Afficher les vendeurs sortis » pour les voir.'}
        </p>
      ) : (
        <table className="tableau grille-marques">
          <thead>
            <tr>
              <EnTeteTriable colonne="nom" libelle="Vendeur" tri={tri} onTrier={onTrier} />
              {marques.map((m) => (
                <EnTeteTriable
                  key={m.id}
                  colonne={`marque:${m.id}`}
                  libelle={m.libelle}
                  tri={tri}
                  onTrier={onTrier}
                  classe="colonne-marque"
                />
              ))}
              <EnTeteTriable
                colonne="metier"
                libelle="Métier"
                tri={tri}
                onTrier={onTrier}
                classe="colonne-type debut-groupe"
              />
              <th />
            </tr>
          </thead>
          <tbody>
            {visibles.map((v) => (
              <LigneVendeur
                key={v.id}
                vendeur={v}
                marques={marques}
                types={types}
                sites={sites}
                occupe={enCours === v.id}
                enEdition={editionId === v.id}
                onEditer={() => onEditer(v.id)}
                onBasculerMarque={(id) => onBasculerMarque(v, id)}
                onArchiver={() => onArchiver(v)}
                onEnregistrer={(champs) => onEnregistrer(v, champs)}
              />
            ))}
          </tbody>
        </table>
      )}

      {enAjout ? (
        <FormulaireNouveauVendeur
          site={site}
          marques={marques}
          types={types}
          onAnnuler={onFermerAjout}
          onCreer={onCreer}
        />
      ) : (
        <div className="actions">
          <button type="button" className="secondaire" onClick={onOuvrirAjout}>
            + Ajouter un vendeur
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- encadrement

/// L'encadrement d'un site, en un bloc.
///
/// LES DEUX ROLES NE SE COMPTENT PAS PAREIL : un seul chef de site, au plus un
/// chef de vente PAR METIER. L'ecran reflete cette asymetrie au lieu de la lisser,
/// parce que c'est une vraie regle et qu'un selecteur unique la ferait oublier.
function BlocEncadrement({
  siteId,
  encadrements,
  disponibles,
  roles,
  occupe,
  onChanger,
}: {
  siteId: string;
  encadrements: { id: string; role: string; utilisateurId: string; nom: string }[];
  disponibles: {
    id: string;
    nom: string;
    loginId: string;
    rolesGlobaux: string[];
    encadrements: { role: string; siteCode: string }[];
  }[];
  roles: string[];
  occupe: boolean;
  onChanger: (siteId: string, role: string, utilisateurId: string | null) => void;
}) {
  // Un selecteur par role, dans l'ordre donne par le SERVEUR : aucune liste de
  // roles n'est ecrite ici (interdit n.3).
  return (
    <div className="encadrement">
      {roles.map((role) => {
        const titulaire = encadrements.find((e) => e.role === role) ?? null;
        return (
          <label key={role}>
            {libelleRoleEncadrement(role)}
            <select
              value={titulaire?.utilisateurId ?? ''}
              disabled={occupe}
              onChange={(e) => onChanger(siteId, role, e.target.value || null)}
            >
              <option value="">aucun</option>
              {/* TOUS LES COMPTES, tous sites confondus — pas seulement ceux de
                  ce site. Un chef de vente de Clermont encadre parfois Mozac, et
                  anime une table de Villefranche : c'est l'exercice meme. */}
              {disponibles.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nom}
                  {u.rolesGlobaux.length > 0 ? ` (${libelleRoleGlobal(u.rolesGlobaux)})` : ''}
                  {u.encadrements.length > 0
                    ? ` — ${u.encadrements.map((e) => e.siteCode).join(', ')}`
                    : ''}
                </option>
              ))}
            </select>
          </label>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------- en-tete

function EnTeteTriable({
  colonne,
  libelle,
  tri,
  onTrier,
  classe,
}: {
  colonne: string;
  libelle: string;
  tri: Tri;
  onTrier: (colonne: string) => void;
  classe?: string;
}) {
  const actif = tri.colonne === colonne;
  return (
    <th className={`${classe ?? ''} triable ${actif ? 'trie' : ''}`}>
      <button type="button" onClick={() => onTrier(colonne)}>
        {libelle}
        <span className="fleche">{actif ? (tri.croissant ? '▲' : '▼') : '↕'}</span>
      </button>
    </th>
  );
}

// ---------------------------------------------------------------- ligne

interface ChampsEdition {
  nom?: string;
  siteId?: string;
  dateEntree?: string | null;
  dateSortie?: string | null;
  typeVehicule?: TypeVehicule;
  marqueIds?: string[];
}

function LigneVendeur({
  vendeur,
  marques,
  types,
  sites,
  occupe,
  enEdition,
  onEditer,
  onBasculerMarque,
  onArchiver,
  onEnregistrer,
}: {
  vendeur: VendeurReferentiel;
  marques: { id: string; libelle: string }[];
  types: TypeVehicule[];
  sites: { id: string; code: string; libelle: string }[];
  occupe: boolean;
  enEdition: boolean;
  onEditer: () => void;
  onBasculerMarque: (marqueId: string) => void;
  onArchiver: () => void;
  onEnregistrer: (champs: ChampsEdition) => void;
}) {
  const [nom, setNom] = useState(vendeur.nom);
  const [siteId, setSiteId] = useState(vendeur.siteId);
  const [dateEntree, setDateEntree] = useState(vendeur.dateEntree?.slice(0, 10) ?? '');
  const [dateSortie, setDateSortie] = useState(vendeur.dateSortie?.slice(0, 10) ?? '');
  const [typeVehicule, setType] = useState<TypeVehicule>(vendeur.typeVehicule);
  const [marqueIds, setMarqueIds] = useState<string[]>(vendeur.marqueIds);

  // Le serveur refuse un VN sans marque, et vide les marques d'un VO. On reprend
  // la meme regle ici pour desactiver le bouton et dire pourquoi.
  const manqueMarque = typeVehicule === 'VN' && marqueIds.length === 0;
  const valide = nom.trim() !== '' && !manqueMarque;

  if (enEdition) {
    return (
      <tr>
        <td colSpan={marques.length + 3}>
          <div className="champs">
            <label>
              Nom
              <input value={nom} onChange={(e) => setNom(e.target.value)} />
            </label>
            <label>
              Site
              <select value={siteId} onChange={(e) => setSiteId(e.target.value)}>
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.libelle} ({s.code})
                  </option>
                ))}
              </select>
            </label>
            <label>
              Métier
              <select
                value={typeVehicule}
                onChange={(e) => setType(e.target.value as TypeVehicule)}
              >
                {types.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Entrée
              <input
                type="date"
                value={dateEntree}
                onChange={(e) => setDateEntree(e.target.value)}
              />
            </label>
            <label>
              Sortie
              <input
                type="date"
                value={dateSortie}
                onChange={(e) => setDateSortie(e.target.value)}
              />
            </label>
          </div>

          {typeVehicule === 'VN' ? (
            <div style={{ marginTop: '0.8rem' }}>
              <label style={{ marginTop: 0 }}>Marques autorisées</label>
              <div className="puces" style={{ marginTop: '0.35rem' }}>
                {marques.map((m) => (
                  <li key={m.id} style={{ listStyle: 'none' }}>
                    <label className="interrupteur">
                      <input
                        type="checkbox"
                        checked={marqueIds.includes(m.id)}
                        onChange={() => setMarqueIds(bascule(marqueIds, m.id))}
                      />
                      {m.libelle}
                    </label>
                  </li>
                ))}
              </div>
            </div>
          ) : (
            <p className="note" style={{ marginTop: '0.8rem' }}>
              Un vendeur <strong>VO</strong> n’a aucune ventilation par marque : ses marques seront
              effacées à l’enregistrement, et sa grille de saisie n’aura qu’une seule section.
            </p>
          )}

          <p className="note" style={{ marginTop: '0.6rem' }}>
            Changer le site <strong>transfère</strong> le vendeur en conservant tout son historique :
            les RDV pointent le vendeur, pas le site. Renseigner une date de sortie le retire des
            classements courants sans rien effacer — l’encadrement du site se règle en haut de la
            carte.
          </p>
          {manqueMarque && (
            <p className="note alerte">
              Un vendeur VN doit avoir au moins une marque : sans elle il ne peut recevoir aucun RDV.
            </p>
          )}
          <div className="actions">
            <button
              type="button"
              className="principal"
              disabled={occupe || !valide}
              onClick={() =>
                onEnregistrer({
                  nom: nom.trim(),
                  siteId,
                  dateEntree: dateEntree === '' ? null : dateEntree,
                  dateSortie: dateSortie === '' ? null : dateSortie,
                  typeVehicule,
                  marqueIds,
                })
              }
            >
              Enregistrer
            </button>
            <button type="button" className="secondaire" onClick={onEditer}>
              Annuler
            </button>
          </div>
        </td>
      </tr>
    );
  }

  const vo = vendeur.typeVehicule === 'VO';

  return (
    <tr className={vendeur.dateSortie ? 'sorti' : ''}>
      <td>
        {vendeur.nom}
        {vendeur.dateSortie && (
          <span className="etiquette">
            sorti le {vendeur.dateSortie.slice(0, 10).split('-').reverse().join('/')}
          </span>
        )}
      </td>

      {marques.map((m) => (
        <td key={m.id} className="colonne-marque">
          {vo ? (
            <span className="note" title="Un vendeur VO n’a aucune ventilation par marque.">
              —
            </span>
          ) : (
            <input
              type="checkbox"
              checked={vendeur.marqueIds.includes(m.id)}
              disabled={occupe}
              onChange={() => onBasculerMarque(m.id)}
              aria-label={`${vendeur.nom} — ${m.libelle}`}
            />
          )}
        </td>
      ))}

      <td className="colonne-type debut-groupe">
        <span className={`etiquette ${vo ? 'vo' : 'vn'}`}>{vendeur.typeVehicule}</span>
      </td>

      <td className="colonne-actions">
        <button type="button" className="lien" onClick={onEditer}>
          modifier
        </button>
        <button
          type="button"
          className="poubelle"
          onClick={onArchiver}
          disabled={occupe}
          title="Archiver — la ligne disparaît, ses RDV restent en base"
          aria-label={`Archiver ${vendeur.nom}`}
        >
          🗑
        </button>
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------- archivage

/// LE VOLET ARCHIVAGE. Deux gestes, et le second est irreversible.
///
/// La purge est la SEULE operation de tout le produit qui detruit de l'historique.
/// Elle annonce donc le nombre de RDV qui partiront, et demande le nom exact du
/// vendeur : un clic ne doit pas suffire a faire bouger les totaux d'une campagne
/// passee.
function ZoneArchivage({
  version,
  onErreur,
  onSucces,
  onChangement,
}: {
  /// Change a chaque archivage venu de l'ecran parent. Sert de signal de
  /// relecture : le volet ne devine pas qu'une ligne vient d'etre archivee.
  version: number;
  onErreur: (m: string | null) => void;
  onSucces: (m: string | null) => void;
  onChangement: () => void;
}) {
  const [archives, setArchives] = useState<VendeurArchive[] | null>(null);
  const [chargement, setChargement] = useState(true);
  const [occupe, setOccupe] = useState<string | null>(null);

  const relire = useCallback(() => {
    setChargement(true);
    chargerArchives()
      .then(setArchives)
      .catch((e) => onErreur(e instanceof Error ? e.message : 'Chargement impossible.'))
      .finally(() => setChargement(false));
  }, [onErreur]);

  // Chargement au MONTAGE du volet — le composant n'existe que quand le volet est
  // ouvert, donc la liste des archives n'est jamais chargee inutilement.
  //
  // Dans un `useEffect` et non pendant le rendu : une premiere version appelait
  // `relire()` directement dans le corps du composant, ce qui declenche une mise a
  // jour d'etat PENDANT le rendu — React s'en plaint, et selon le cas ca boucle.
  useEffect(() => {
    relire();
    // `version` en dependance : un archivage fait depuis la liste doit se voir
    // ici. Sans lui, le volet restait sur la photo prise a son ouverture.
  }, [relire, version]);

  const agir = async (id: string, action: () => Promise<string>) => {
    onErreur(null);
    onSucces(null);
    setOccupe(id);
    try {
      onSucces(await action());
      relire();
      onChangement();
    } catch (e) {
      onErreur(e instanceof Error ? e.message : 'Opération impossible.');
    } finally {
      setOccupe(null);
    }
  };

  return (
    <div className="carte">
      <h3>
        Archivage
        <span className="etiquette">{archives?.length ?? '…'}</span>
      </h3>
      <p className="note">
        Un vendeur archivé ne s’affiche plus nulle part, mais <strong>ses RDV restent en base</strong> :
        les totaux des campagnes passées sont intacts. Le désarchiver le remet en service.
      </p>
      <p className="note alerte">
        La <strong>purge</strong> est différente : elle supprime définitivement le vendeur et tous
        ses RDV. C’est la seule opération de l’outil qui fait bouger les totaux d’une campagne
        passée, et elle est irréversible.
      </p>

      {chargement && archives === null ? (
        <p className="note">Chargement…</p>
      ) : (archives?.length ?? 0) === 0 ? (
        <p className="note">Aucun vendeur archivé.</p>
      ) : (
        <table className="tableau">
          <thead>
            <tr>
              <th>Vendeur</th>
              <th>Site</th>
              <th className="nombre">RDV</th>
              <th className="nombre">Affectations</th>
              <th>Archivé le</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {(archives ?? []).map((v) => (
              <tr key={v.id}>
                <td>
                  {v.nom}
                  <span className="etiquette">{v.typeVehicule}</span>
                </td>
                <td>{v.siteCode}</td>
                <td className="nombre">{v.nbRdv}</td>
                <td className="nombre">{v.nbAffectations}</td>
                <td>
                  {v.archiveLe
                    ? new Date(v.archiveLe).toLocaleDateString('fr-FR')
                    : '—'}
                </td>
                <td className="colonne-actions">
                  <button
                    type="button"
                    className="lien"
                    disabled={occupe === v.id}
                    onClick={() =>
                      void agir(v.id, async () => {
                        const r = await desarchiverVendeur(v.id);
                        return `${r.desarchive} est remis en service.`;
                      })
                    }
                  >
                    désarchiver
                  </button>
                  <button
                    type="button"
                    className="destructif"
                    disabled={occupe === v.id}
                    onClick={() => {
                      // Le nom exact, tape a la main. La confirmation annonce
                      // precisement ce qui sera detruit — un « etes-vous sur ? »
                      // se clique sans lire.
                      const saisi = window.prompt(
                        `SUPPRESSION DÉFINITIVE de ${v.nom}.\n\n` +
                          `${v.nbRdv} RDV et ${v.nbAffectations} affectation(s) seront détruits ` +
                          'avec lui. Les totaux des campagnes concernées changeront. ' +
                          'C’est irréversible.\n\n' +
                          `Pour confirmer, taper le nom exact :\n${v.nom}`
                      );
                      if (saisi === null) return;
                      void agir(v.id, async () => {
                        const r = await purgerVendeur(v.id, saisi);
                        return r.message;
                      });
                    }}
                  >
                    purger
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- creation

function FormulaireNouveauVendeur({
  site,
  marques,
  types,
  onCreer,
  onAnnuler,
}: {
  site: { id: string; libelle: string; code: string };
  marques: { id: string; libelle: string }[];
  types: TypeVehicule[];
  onCreer: (champs: {
    nom: string;
    marqueIds: string[];
    typeVehicule: TypeVehicule;
    dateEntree: string | null;
  }) => void;
  onAnnuler: () => void;
}) {
  const [nom, setNom] = useState('');
  // Rien de preselectionne : c'est ce qui force a renseigner la donnee.
  const [marqueIds, setMarqueIds] = useState<string[]>([]);
  const [typeVehicule, setType] = useState<TypeVehicule | ''>('');
  const [dateEntree, setDateEntree] = useState('');

  const complet =
    nom.trim() !== '' && typeVehicule !== '' && (typeVehicule === 'VO' || marqueIds.length > 0);

  return (
    <div className="apercu">
      <h3>Nouveau vendeur — {site.libelle}</h3>
      <div className="champs">
        <label>
          Nom
          <input
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            autoFocus
            placeholder="PRÉNOM NOM"
          />
        </label>
        <label>
          Métier
          <select
            value={typeVehicule}
            onChange={(e) => setType(e.target.value as TypeVehicule | '')}
          >
            <option value="">à choisir</option>
            {types.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label>
          Entrée
          <input type="date" value={dateEntree} onChange={(e) => setDateEntree(e.target.value)} />
        </label>
      </div>

      {typeVehicule !== 'VO' && (
        <div style={{ marginTop: '0.8rem' }}>
          <label style={{ marginTop: 0 }}>Marques</label>
          <div className="puces" style={{ marginTop: '0.35rem' }}>
            {marques.map((m) => (
              <li key={m.id} style={{ listStyle: 'none' }}>
                <label className="interrupteur">
                  <input
                    type="checkbox"
                    checked={marqueIds.includes(m.id)}
                    onChange={() => setMarqueIds(bascule(marqueIds, m.id))}
                  />
                  {m.libelle}
                </label>
              </li>
            ))}
          </div>
        </div>
      )}

      <p className="note" style={{ marginTop: '0.7rem' }}>
        {typeVehicule === ''
          ? 'Le métier est requis : VN ou VO. Il détermine la forme de la grille de saisie.'
          : typeVehicule === 'VO'
            ? 'Un vendeur VO n’a pas de marque à renseigner.'
            : 'Au moins une marque est requise : sans elle, un vendeur VN ne pourrait recevoir aucun RDV.'}{' '}
        L’encadrement — chef de site, chef de vente — se règle en haut de la carte du site, une fois
        le vendeur créé.
      </p>

      <div className="actions">
        <button
          type="button"
          className="principal"
          disabled={!complet}
          onClick={() =>
            onCreer({
              nom: nom.trim(),
              marqueIds: typeVehicule === 'VO' ? [] : marqueIds,
              typeVehicule: typeVehicule as TypeVehicule,
              dateEntree: dateEntree === '' ? null : dateEntree,
            })
          }
        >
          Ajouter
        </button>
        <button type="button" className="secondaire" onClick={onAnnuler}>
          Annuler
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- outils

const bascule = <T,>(liste: T[], v: T) =>
  liste.includes(v) ? liste.filter((x) => x !== v) : [...liste, v];

const libelleStatut = (l: LigneApercu): string => {
  switch (l.statut) {
    case 'resolue':
      return l.changement ? 'à appliquer' : 'déjà conforme';
    case 'introuvable':
      return `nom introuvable${l.codeSite ? ` sur le site ${l.codeSite}` : ''}`;
    case 'ambigue':
      return `homonyme sur ${l.candidats.map((c) => c.codeSite).join(' et ')} — préciser le site`;
    case 'marque_inconnue':
      return `marque inconnue : ${l.codesInconnus.join(', ')}`;
    case 'sans_marque':
      return 'aucune marque indiquée';
  }
};
