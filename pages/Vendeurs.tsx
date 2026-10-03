import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { useReferentiels } from '../hooks/useReferentiels';
import { useIndicateurGlissant } from '../hooks/useIndicateurGlissant';
import { Icone } from '../components/ui/Icone';
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
  basculer,
  EnTeteTriable,
  type SensNaturel,
  type Tri,
} from '../components/EnTeteTriable';
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

/// Le tri s'applique DANS chaque site : c'est la question qu'on se pose devant un
/// site (« qui vend du Dacia ici ? »), pas devant les 102. L'en-tete triable et
/// sa regle de bascule vivent dans `components/EnTeteTriable.tsx`, partages avec
/// le tableau de bord.

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

  /// Le formulaire ouvert depuis la barre d'outils, avec choix du site. Distinct
  /// de `siteEnAjout` : les deux ne doivent jamais etre ouverts ensemble, sans
  /// quoi deux formulaires de creation coexistent a 8 000 px d'ecart.
  const [ajoutGlobal, setAjoutGlobal] = useState(false);

  /// Filtres de la liste des 19 cartes. Ils ne touchent PAS aux compteurs des
  /// cartes : un effectif qui change quand on cherche un nom serait un piege —
  /// c'est la meme regle que le total du perimetre dans le module C.
  const [recherche, setRecherche] = useState('');

  /// LE SITE AFFICHE. La page empilait les 20 cartes sur 8 900 px ; elle n'en
  /// montre plus qu'une, choisie dans le rail — sauf pendant une recherche, qui
  /// montre toutes les cartes concernees.
  const [siteSel, setSiteSel] = useState<string | null>(null);
  const rail = index?.vendeursParSite ?? [];
  const siteCourant = rail.some((c) => c.site.id === siteSel) ? siteSel : (rail[0]?.site.id ?? null);
  const curseurSite = useIndicateurGlissant(
    Math.max(0, rail.findIndex((c) => c.site.id === siteCourant)),
    rail.length,
    'y'
  );

  /// Incremente a chaque archivage. Le volet Archivage s'en sert comme signal de
  /// relecture : sans lui, archiver un vendeur pendant que le volet est ouvert le
  /// laissait perime — le vendeur disparaissait de la liste sans apparaitre dans
  /// les archives. Constate a l'essai.
  const [versionArchives, setVersionArchives] = useState(0);

  // Au telephone, le rail est horizontal : le site choisi doit y etre VISIBLE.
  useEffect(() => {
    document.querySelector('.rail-site.actif')?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  }, [siteCourant]);

  if (chargement)
    return (
      <div className="page">
        <div className="skel" style={{ height: 40, width: 260 }} />
        <div className="vend-v2">
          <div className="skel" style={{ height: 480 }} />
          <div className="skel" style={{ height: 480 }} />
        </div>
      </div>
    );
  if (erreur) return <div className="page"><div className="bandeau-v2 erreur">{erreur}</div></div>;
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

  /// Les cartes a afficher. Deux filtres qui se composent : la plaque, et une
  /// recherche qui porte sur le SITE (libelle ou code) comme sur les NOMS de ses
  /// vendeurs — chercher « ROUSSET » doit faire apparaitre la carte de son site,
  /// chercher « CLF » doit faire apparaitre Clermont en entier.
  ///
  /// `cleTri` et non `toLowerCase` : c'est la meme cle que le tri, donc
  /// « AMELIE » et « AMÉLIE » sont le meme nom ici comme ailleurs.
  const q = cleTri(recherche.trim());
  const cartesVisibles = index.vendeursParSite.filter(({ site, vendeurs }) => {
    if (q === '') return true;
    return (
      cleTri(site.libelle).includes(q) ||
      cleTri(site.code).includes(q) ||
      vendeurs.some((v) => cleTri(v.nom).includes(q))
    );
  });

  /// La recherche ne filtre les LIGNES d'une carte que si elle a designe des
  /// vendeurs. Sur « CLF », on veut la carte de Clermont AVEC ses 19 vendeurs, pas
  /// une carte vide parce qu'aucun nom ne contient « CLF ».
  const filtreNomActif =
    q !== '' &&
    index.vendeursParSite.some(({ vendeurs }) => vendeurs.some((v) => cleTri(v.nom).includes(q)));

  const changements = apercu?.resume.changements ?? 0;
  const bloquantes = apercu
    ? apercu.resume.introuvables +
      apercu.resume.ambigues +
      apercu.resume.marquesInconnues +
      apercu.resume.sansMarque
    : 0;

  const actifs = donnees.vendeurs.filter((v) => !v.dateSortie);

  return (
    <div className="page">
      <div className="app-head enter">
        <h1>Vendeurs</h1>
        <span className="sub">
          {actifs.length} en poste · {actifs.filter((v) => v.typeVehicule === 'VN').length} VN ·{' '}
          {actifs.filter((v) => v.typeVehicule === 'VO').length} VO
        </span>
        <div className="droite">
          <button
            type="button"
            className="btn primary"
            onClick={() => {
              setAjoutGlobal((o) => !o);
              setSiteEnAjout(null);
            }}
          >
            <Icone nom={ajoutGlobal ? 'fermer' : 'plus'} petite /> {ajoutGlobal ? 'Fermer' : 'Vendeur'}
          </button>
        </div>
      </div>

      <div className="barre-v2 enter" style={{ ['--i' as string]: 1 }}>
        <label className="recherche-v2">
          <Icone nom="recherche" petite />
          <input
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Chercher un vendeur, un site…"
            aria-label="Chercher un vendeur ou un site"
            spellCheck={false}
          />
          {recherche !== '' && (
            <button type="button" className="icon-btn" onClick={() => setRecherche('')} aria-label="Effacer la recherche">
              <Icone nom="fermer" petite />
            </button>
          )}
        </label>
        <label className="bascule-absents">
          <input type="checkbox" className="interrupteur-v2" checked={afficherSortis} onChange={(e) => setAfficherSortis(e.target.checked)} />
          <span>Sortis</span>
        </label>
        <span className="espace" />
        <button type="button" className={`btn${zoneCollage ? ' actif' : ''}`} onClick={() => setZoneCollage((o) => !o)}>
          <Icone nom="grille" petite /> Importer les marques
        </button>
        <button type="button" className={`btn ghost${zoneArchives ? ' actif' : ''}`} onClick={() => setZoneArchives((o) => !o)}>
          <Icone nom="corbeille" petite /> Archivage
        </button>
      </div>

      {ajoutGlobal && (
        <FormulaireNouveauVendeur
          site={null}
          sitesAuChoix={donnees.sites}
          marques={donnees.marques}
          types={donnees.typesVehicule}
          onAnnuler={() => setAjoutGlobal(false)}
          onCreer={(champs) =>
            void agir('nouveau-global', async () => {
              await creerVendeur(champs);
              await recharger();
              setAjoutGlobal(false);
              const site = donnees.sites.find((s) => s.id === champs.siteId);
              return `${champs.nom} ajouté à ${site?.libelle ?? 'son site'}.`;
            })
          }
        />
      )}

      {messageErreur && <div className="bandeau-v2 erreur" role="alert">{messageErreur}</div>}
      {succes && <div className="bandeau-v2 ok" role="status">{succes}</div>}

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
        <div className="card pad carte-action enter">
          <h3 className="card-titre"><Icone nom="grille" petite /> Import des marques par collage</h3>
          {/* CELLE-CI RESTE : elle dit ce qu'on peut coller, et sans elle le champ
              est un textarea vide. C'est de l'aide a l'action, pas de la
              presentation de produit. */}
          <p className="note">
            Deux formats : une colonne contenant les marques («&nbsp;RENAULT DACIA&nbsp;»), ou une
            colonne par marque avec un x — celui-ci demande une ligne d’en-tête nommant les
            marques. Une colonne de code site lève les homonymies. Rien n’est enregistré avant
            validation, et le métier VN/VO n’est pas touché.
          </p>
          <textarea
            className="textarea"
            value={collage}
            onChange={(e) => setCollage(e.target.value)}
            rows={6}
            spellCheck={false}
            placeholder={'CLF\tVALENTIN PARPINELLI\tRENAULT DACIA'}
          />
          <div className="actions-v2">
            <button
              type="button"
              className="btn primary"
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

              <div className="actions-v2">
                <button type="button" className="btn ghost" onClick={() => setApercu(null)}>
                  Annuler
                </button>
                <button type="button" className="btn primary" onClick={appliquer} disabled={changements === 0}>
                  {changements === 0
                    ? 'Aucun changement à appliquer'
                    : `Appliquer ${changements} ligne${changements > 1 ? 's' : ''}`}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="vend-v2">
        <aside className="card rail-sites enter" style={{ ['--i' as string]: 2 }}>
          <div className="rail-corps" ref={curseurSite.conteneur}>
            <span className={`curseur-v2${q !== '' ? ' absent' : ''}`} aria-hidden="true" ref={curseurSite.indicateur} />
            {rail.map(({ site, plaque, vendeurs }, i) => {
              const enPoste = vendeurs.filter((v) => !v.dateSortie).length;
              const nouvellePlaque = i === 0 || rail[i - 1].plaque?.id !== plaque?.id;
              const touche = q === '' || cartesVisibles.some((c) => c.site.id === site.id);
              return (
                <Fragment key={site.id}>
                  {nouvellePlaque && <span className="rail-groupe">{plaque?.libelle ?? 'Sans plaque'}</span>}
                  <button
                    type="button"
                    ref={curseurSite.cible(i)}
                    className={`rail-site${q === '' && site.id === siteCourant ? ' actif' : ''}${touche ? '' : ' eteint'}`}
                    onClick={() => {
                      setRecherche('');
                      setSiteSel(site.id);
                    }}
                  >
                    <span className="nom">{site.libelle}</span>
                    <span className="n num">{enPoste}</span>
                  </button>
                </Fragment>
              );
            })}
          </div>
        </aside>

        <div className="vend-detail">
      {q !== '' && cartesVisibles.length === 0 && (
        <div className="empty card">Aucun site ni vendeur ne correspond à « {recherche} ».</div>
      )}

      {(q !== '' ? cartesVisibles : rail.filter((c) => c.site.id === siteCourant)).map(({ site, plaque, vendeurs }) => (
        <CarteSite
          key={site.id}
          site={site}
          plaqueLibelle={plaque?.libelle ?? null}
          vendeurs={vendeurs}
          filtreNom={filtreNomActif ? recherche : ''}
          marques={donnees.marques}
          sites={donnees.sites}
          types={donnees.typesVehicule}
          afficherSortis={afficherSortis}
          tri={tri}
          onTrier={(colonne, naturel) => setTri((t) => basculer(t, colonne, naturel))
          }
          enCours={enCours}
          editionId={editionId}
          enAjout={siteEnAjout === site.id}
          onEditer={(id) => setEditionId(editionId === id ? null : id)}
          onOuvrirAjout={() => {
            setSiteEnAjout(site.id);
            setAjoutGlobal(false);
          }}
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
              await creerVendeur(champs);
              await recharger();
              setSiteEnAjout(null);
              return `${champs.nom} ajouté à ${site.libelle}.`;
            })
          }
        />
      ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- un site

function CarteSite({
  site,
  plaqueLibelle,
  vendeurs,
  filtreNom,
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
  /// Filtre de nom venu de la barre d'outils. Vide = tout afficher. Il ne touche
  /// PAS aux compteurs du titre, qui restent ceux du site entier.
  filtreNom: string;
  marques: Marque[];
  sites: Site[];
  types: TypeVehicule[];
  afficherSortis: boolean;
  tri: Tri;
  onTrier: (colonne: string, naturel: SensNaturel) => void;
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
    siteId: string;
    marqueIds: string[];
    typeVehicule: TypeVehicule;
    dateEntree: string | null;
  }) => void;
}) {
  const enPoste = vendeurs.filter((v) => !v.dateSortie);

  const visibles = useMemo(() => {
    const q = cleTri(filtreNom.trim());
    const liste = vendeurs
      .filter((v) => afficherSortis || !v.dateSortie)
      .filter((v) => q === '' || cleTri(v.nom).includes(q));
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
  }, [vendeurs, afficherSortis, tri, filtreNom]);

  return (
    <div className="card pad site-v2 enter" key={site.id}>
      <div className="site-tete">
        <div>
          <h2 className="site-nom">{site.libelle}</h2>
          <div className="site-meta">
            <span className="badge">{site.code}</span>
            {plaqueLibelle && <span className="badge">{plaqueLibelle}</span>}
          </div>
        </div>
        <div className="site-compte">
          <span><b className="num">{enPoste.filter((v) => v.typeVehicule === 'VN').length}</b> VN</span>
          <span><b className="num">{enPoste.filter((v) => v.typeVehicule === 'VO').length}</b> VO</span>
        </div>
      </div>

      <BlocEncadrement
        siteId={site.id}
        encadrements={encadrements}
        disponibles={encadrantsDisponibles}
        roles={rolesEncadrement}
        occupe={enCours !== null}
        onChanger={onChangerEncadrement}
      />

      {visibles.length === 0 ? (
        <p className="empty">
          {vendeurs.length === 0
            ? 'Aucun vendeur sur ce site.'
            : filtreNom !== ''
              ? `Aucun vendeur de ce site ne correspond à « ${filtreNom} ».`
              : 'Tous les vendeurs de ce site sont sortis. Activer « Sortis » pour les voir.'}
        </p>
      ) : (
        <div className="liste-vendeurs-v2">
          <div className="liste-tri">
            <span className="lbl">{visibles.length} vendeur{visibles.length > 1 ? 's' : ''}</span>
            <span className="espace" />
            <span className="lbl">Trier</span>
            {(
              [
                ['nom', 'Nom'],
                ['metier', 'Métier'],
              ] as const
            ).map(([col, lib]) => (
              <button key={col} type="button" className="chip" aria-pressed={tri.colonne === col} onClick={() => onTrier(col, 'texte')}>
                {lib}
                {tri.colonne === col && <Icone nom={tri.croissant ? 'bas' : 'haut'} petite />}
              </button>
            ))}
          </div>
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
        </div>
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
        <button type="button" className="ajout-vendeur" onClick={onOuvrirAjout}>
          <Icone nom="plus" petite /> Ajouter un vendeur à {site.libelle}
        </button>
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
  // Une CARTE DE PERSONNE par role, dans l'ordre donne par le SERVEUR (interdit
  // n.3). Le choix reste un `select` natif — clavier, lecteur d'ecran, roue du
  // telephone — pose invisible sur toute la carte.
  return (
    <div className="encadrement-v2">
      {roles.map((role) => {
        const titulaire = encadrements.find((e) => e.role === role) ?? null;
        return (
          <label key={role} className={`role-carte${titulaire ? '' : ' vacant'}`}>
            <span className="avatar" aria-hidden="true">{titulaire ? initiales(titulaire.nom) : '—'}</span>
            <span className="role-texte">
              <span className="lbl">{libelleRoleEncadrement(role)}</span>
              <span className="qui">{titulaire?.nom ?? 'Personne'}</span>
            </span>
            <Icone nom="bas" petite />
            <select
              className="select-cache"
              aria-label={libelleRoleEncadrement(role)}
              value={titulaire?.utilisateurId ?? ''}
              disabled={occupe}
              onChange={(e) => onChanger(siteId, role, e.target.value || null)}
            >
              <option value="">Personne</option>
              {/* TOUS LES COMPTES, tous sites confondus : un chef de vente de
                  Clermont encadre parfois Mozac. C'est l'exercice meme. */}
              {disponibles.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nom}
                  {u.rolesGlobaux.length > 0 ? ` (${libelleRoleGlobal(u.rolesGlobaux)})` : ''}
                  {u.encadrements.length > 0 ? ` — ${u.encadrements.map((e) => e.siteCode).join(', ')}` : ''}
                </option>
              ))}
            </select>
          </label>
        );
      })}
    </div>
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
  const vo = vendeur.typeVehicule === 'VO';
  const sortie = vendeur.dateSortie ? vendeur.dateSortie.slice(0, 10).split('-').reverse().join('/') : null;

  return (
    <div className={`vendeur-ligne${sortie ? ' sorti' : ''}${enEdition ? ' ouverte' : ''}`}>
      <div className="vendeur-resume">
        <span className="avatar" aria-hidden="true">{initiales(vendeur.nom)}</span>
        <span className="vendeur-id">
          <span className="nom">{vendeur.nom}</span>
          <span className="sous">
            <span className={`metier ${vo ? 'vo' : 'vn'}`}>{vendeur.typeVehicule}</span>
            {sortie && <span>sorti le {sortie}</span>}
          </span>
        </span>

        {/* Les marques, NOMMEES : une puce par marque, pas une colonne de cases
            dont il faut chercher l'en-tete. */}
        <span className="marques-ligne">
          {vo ? (
            <span className="faint">Aucune marque (VO)</span>
          ) : (
            marques.map((m) => (
              <button
                key={m.id}
                type="button"
                className="puce-marque"
                aria-pressed={vendeur.marqueIds.includes(m.id)}
                disabled={occupe}
                onClick={() => onBasculerMarque(m.id)}
              >
                {vendeur.marqueIds.includes(m.id) && <Icone nom="coche" petite />}
                {m.libelle}
              </button>
            ))
          )}
        </span>

        <span className="actions-ligne">
          <button type="button" className={`icon-btn${enEdition ? ' actif' : ''}`} onClick={onEditer} aria-label={`Modifier ${vendeur.nom}`} title="Modifier">
            <Icone nom={enEdition ? 'fermer' : 'crayon'} petite />
          </button>
          <button
            type="button"
            className="icon-btn danger"
            onClick={onArchiver}
            disabled={occupe}
            title="Archiver — la ligne disparaît, ses RDV restent en base"
            aria-label={`Archiver ${vendeur.nom}`}
          >
            <Icone nom="corbeille" petite />
          </button>
        </span>
      </div>

      {enEdition && (
        <EditionVendeur vendeur={vendeur} marques={marques} types={types} sites={sites} occupe={occupe} onAnnuler={onEditer} onEnregistrer={onEnregistrer} />
      )}
    </div>
  );
}

/// L'edition, dans la ligne qui s'ouvre. Un composant a part : le segmente du
/// metier porte son propre indicateur glissant, donc ses propres hooks.
function EditionVendeur({
  vendeur,
  marques,
  types,
  sites,
  occupe,
  onAnnuler,
  onEnregistrer,
}: {
  vendeur: VendeurReferentiel;
  marques: { id: string; libelle: string }[];
  types: TypeVehicule[];
  sites: { id: string; code: string; libelle: string }[];
  occupe: boolean;
  onAnnuler: () => void;
  onEnregistrer: (champs: ChampsEdition) => void;
}) {
  const [nom, setNom] = useState(vendeur.nom);
  const [siteId, setSiteId] = useState(vendeur.siteId);
  const [dateEntree, setDateEntree] = useState(vendeur.dateEntree?.slice(0, 10) ?? '');
  const [dateSortie, setDateSortie] = useState(vendeur.dateSortie?.slice(0, 10) ?? '');
  const [typeVehicule, setType] = useState<TypeVehicule>(vendeur.typeVehicule);
  const [marqueIds, setMarqueIds] = useState<string[]>(vendeur.marqueIds);
  const seg = useIndicateurGlissant(Math.max(0, types.indexOf(typeVehicule)), types.length);

  // Le serveur refuse un VN sans marque, et vide les marques d'un VO. On reprend
  // la meme regle ici pour desactiver le bouton et dire pourquoi.
  const manqueMarque = typeVehicule === 'VN' && marqueIds.length === 0;
  const valide = nom.trim() !== '' && !manqueMarque;

  return (
    <div className="edition-v2">
      <div className="edition-grille">
        <label className="field e-nom">
          <span className="lbl">Nom</span>
          <input className="input" value={nom} onChange={(e) => setNom(e.target.value)} />
        </label>
        <label className="field e-site">
          <span className="lbl">Site</span>
          <select className="select" value={siteId} onChange={(e) => setSiteId(e.target.value)}>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.libelle} ({s.code})
              </option>
            ))}
          </select>
        </label>
        <div className="field e-metier">
          <span className="lbl">Métier</span>
          <div className="seg" ref={seg.conteneur} role="radiogroup" aria-label="Métier">
            <span className="pouce" ref={seg.indicateur} aria-hidden="true" />
            {types.map((t, i) => (
              <button key={t} type="button" ref={seg.cible(i)} aria-pressed={t === typeVehicule} onClick={() => setType(t)}>
                {t}
              </button>
            ))}
          </div>
        </div>
        <label className="field e-entree">
          <span className="lbl">Entrée</span>
          <input className="input" type="date" value={dateEntree} onChange={(e) => setDateEntree(e.target.value)} />
        </label>
        <label className="field e-sortie">
          <span className="lbl">Sortie</span>
          <input className="input" type="date" value={dateSortie} onChange={(e) => setDateSortie(e.target.value)} />
        </label>
      </div>

      {typeVehicule === 'VN' ? (
        <div className="marques-choix">
          <span className="lbl">Marques</span>
          {marques.map((m) => (
            <button key={m.id} type="button" className="puce-marque" aria-pressed={marqueIds.includes(m.id)} onClick={() => setMarqueIds(bascule(marqueIds, m.id))}>
              {marqueIds.includes(m.id) && <Icone nom="coche" petite />}
              {m.libelle}
            </button>
          ))}
        </div>
      ) : (
        <p className="note">Un vendeur VO n’a pas de marque : sa grille n’a qu’une section.</p>
      )}
      {manqueMarque && <p className="note attention">Au moins une marque : sans elle, aucun RDV possible.</p>}

      <div className="edition-pied">
        <p className="note">Changer de site transfère le vendeur avec son historique. Une sortie le retire des classements sans rien effacer.</p>
        <button type="button" className="btn ghost" onClick={onAnnuler}>
          Annuler
        </button>
        <button
          type="button"
          className="btn primary"
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
      </div>
    </div>
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
    <div className="card pad enter">
      <h3 className="card-titre">
        <Icone nom="corbeille" petite /> Archivage
        <span className="faint num">{archives?.length ?? '…'}</span>
      </h3>
      <p className="note">
        Un vendeur archivé ne s’affiche plus nulle part, mais <strong>ses RDV restent en base</strong> :
        les totaux des campagnes passées sont intacts. Le désarchiver le remet en service.
      </p>
      <p className="note attention">
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
                    className="btn sm"
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
                    className="btn sm danger"
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

/// Le formulaire de creation, en DEUX emplois pour un seul code.
///
///   - `site` fourni  : la carte d'un site l'ouvre en bas de sa liste. Le site
///     est fixe, il n'y a rien a choisir.
///   - `sitesAuChoix` : le bouton de la barre d'outils l'ouvre EN HAUT DE PAGE
///     avec un selecteur de site.
///
/// Le second existe pour une raison mesuree : la page fait 8 900 px, et le seul
/// chemin vers « ajouter un vendeur » etait le bas de la carte du site — soit
/// 8 557 px de defilement pour Villefranche. Le recopier en deux formulaires
/// aurait donne deux jeux de regles de validation a maintenir.
function FormulaireNouveauVendeur({
  site,
  sitesAuChoix,
  marques,
  types,
  onCreer,
  onAnnuler,
}: {
  site: { id: string; libelle: string; code: string } | null;
  sitesAuChoix?: Site[];
  marques: { id: string; libelle: string }[];
  types: TypeVehicule[];
  onCreer: (champs: {
    nom: string;
    siteId: string;
    marqueIds: string[];
    typeVehicule: TypeVehicule;
    dateEntree: string | null;
  }) => void;
  onAnnuler: () => void;
}) {
  const [nom, setNom] = useState('');
  const [siteId, setSiteId] = useState(site?.id ?? '');
  // Rien de preselectionne : c'est ce qui force a renseigner la donnee.
  const [marqueIds, setMarqueIds] = useState<string[]>([]);
  const [typeVehicule, setType] = useState<TypeVehicule | ''>('');
  const [dateEntree, setDateEntree] = useState('');

  const complet =
    nom.trim() !== '' &&
    siteId !== '' &&
    typeVehicule !== '' &&
    (typeVehicule === 'VO' || marqueIds.length > 0);

  return (
    <div className="card pad carte-action enter">
      <h3 className="card-titre"><Icone nom="plus" petite /> {site ? `Nouveau vendeur — ${site.libelle}` : 'Nouveau vendeur'}</h3>
      <div className="champs-v2 cinq">
        <label className="field">
          <span className="lbl">Nom</span>
          <input
            className="input"
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            autoFocus
            placeholder="PRÉNOM NOM"
          />
        </label>
        {sitesAuChoix && (
          <label className="field">
            <span className="lbl">Site</span>
            <select className="select" value={siteId} onChange={(e) => setSiteId(e.target.value)}>
              <option value="">à choisir</option>
              {sitesAuChoix.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.libelle} ({s.code})
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="field">
          <span className="lbl">Métier</span>
          <select
            className="select"
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
        <label className="field">
          <span className="lbl">Entrée</span>
          <input className="input" type="date" value={dateEntree} onChange={(e) => setDateEntree(e.target.value)} />
        </label>
      </div>

      {typeVehicule !== 'VO' && (
        <div className="marques-choix">
          <span className="lbl">Marques</span>
          {marques.map((m) => (
            <button key={m.id} type="button" className="puce-marque" aria-pressed={marqueIds.includes(m.id)} onClick={() => setMarqueIds(bascule(marqueIds, m.id))}>
              {marqueIds.includes(m.id) && <Icone nom="coche" petite />}{m.libelle}
            </button>
          ))}
        </div>
      )}

      <p className="note">
        {typeVehicule === ''
          ? 'Le métier est requis : VN ou VO. Il détermine la forme de la grille de saisie.'
          : typeVehicule === 'VO'
            ? 'Un vendeur VO n’a pas de marque à renseigner.'
            : 'Au moins une marque est requise : sans elle, un vendeur VN ne pourrait recevoir aucun RDV.'}
      </p>

      <div className="actions-v2">
        <button type="button" className="btn ghost" onClick={onAnnuler}>
          Annuler
        </button>
        <button
          type="button"
          className="btn primary"
          disabled={!complet}
          onClick={() =>
            onCreer({
              nom: nom.trim(),
              siteId,
              marqueIds: typeVehicule === 'VO' ? [] : marqueIds,
              typeVehicule: typeVehicule as TypeVehicule,
              dateEntree: dateEntree === '' ? null : dateEntree,
            })
          }
        >
          Ajouter
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- outils

const initiales = (nom: string): string =>
  nom
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((m) => m[0])
    .join('')
    .toUpperCase();

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
