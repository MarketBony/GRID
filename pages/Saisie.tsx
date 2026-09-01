import { useCallback, useEffect, useMemo, useState } from 'react';
import { GrilleVendeur } from '../components/GrilleVendeur';
import { cleRdv } from '../utils/grille';
import { cleTri } from '../backend/src/utils/tri';
import { useTempsReel } from '../hooks/useTempsReel';
import { PanneauxLive } from '../components/PanneauxLive';
import { chargerDashboard, type Dashboard } from '../services/dashboard';
import { chargerCampagnes, type CampagneResume } from '../services/campagnes';
import {
  archiverRdv,
  chargerSaisie,
  modifierRdv,
  poserRdv,
  type PerimetreSaisie,
  type RdvSaisie,
  type SectionVendeur,
} from '../services/saisie';
import { choisirDansListe, useCampagneCourante } from '../contexts/CampagneContext';

// ============================================================================
// ECRAN DE SAISIE — module C.
//
// C'est le coeur du produit. Le chef de table y passe la duree de la session, avec
// un casque sur les oreilles. Toute friction s'y paie au centuple : en cas
// d'arbitrage entre l'elegance d'un ecran d'administration et la fluidite d'ici,
// c'est ici qui gagne.
//
// Trois zones, comme le fichier :
//   - a GAUCHE la liste des vendeurs du perimetre, avec leur compteur vivant et le
//     total en pied. C'est `TOTAL TABLE 1 = 78`.
//   - a DROITE la grille du vendeur selectionne : jours en colonnes, creneaux en
//     lignes, une section par marque autorisee.
//   - EN TETE le perimetre et le total general.
//
// Les compteurs sont recalcules a la lecture, jamais stockes (interdit n.2). Le
// fichier faisait la meme chose avec des `COUNTA`.
// ============================================================================

export function Saisie() {
  const [campagnes, setCampagnes] = useState<CampagneResume[]>([]);
  // Partagee avec les autres ecrans — voir `contexts/CampagneContext.tsx`.
  const { campagneId, choisir: setCampagneId } = useCampagneCourante();
  const [donnees, setDonnees] = useState<PerimetreSaisie | null>(null);
  const [vendeurId, setVendeurId] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [chargement, setChargement] = useState(true);
  const [enregistrement, setEnregistrement] = useState(false);

  /// Filtre de la liste de gauche. Le perimetre d'un administrateur compte 98
  /// vendeurs : trouver un nom demandait de faire defiler. Sur une table de six,
  /// le champ ne coute rien.
  const [recherche, setRecherche] = useState('');

  /// Les RDV en memoire, indexes par vendeur puis par case. Une Map par vendeur
  /// evite de re-filtrer 2 000 RDV a chaque frappe.
  const [rdvsParVendeur, setRdvs] = useState<Map<string, Map<string, RdvSaisie>>>(new Map());

  /// La vue d'ensemble — les autres tables de la plaque et le classement des
  /// concessions. Chargee A PART du perimetre de saisie, et volontairement :
  /// elle couvre TOUT le groupe alors que le perimetre ne couvre que mes
  /// vendeurs. Un echec de ce chargement ne doit pas empecher de saisir, d'ou
  /// l'absence de gestion d'erreur bloquante ici.
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);

  const indexer = useCallback((rdvs: RdvSaisie[]) => {
    const index = new Map<string, Map<string, RdvSaisie>>();
    for (const r of rdvs) {
      const cle = cleRdv(r.marqueId, r.creneauCode, r.jour);
      const pour = index.get(r.vendeurId) ?? new Map<string, RdvSaisie>();
      pour.set(cle, r);
      index.set(r.vendeurId, pour);
    }
    setRdvs(index);
  }, []);

  useEffect(() => {
    chargerCampagnes()
      .then((cs) => {
        setCampagnes(cs);
        // On ouvre sur une campagne ou l'utilisateur a QUELQUE CHOSE A FAIRE, pas
        // sur la plus recente. Un chef de table de juin qui atterrit sur septembre
        // voit un ecran vide, et un ecran vide se lit comme une panne.
        const retenue = choisirDansListe(
          cs,
          campagneId,
          (l) =>
            l.find((c) => !c.cloturee && c.vendeursSaisissables > 0) ??
            l.find((c) => c.vendeursSaisissables > 0) ??
            l.find((c) => !c.cloturee) ??
            l[0]
        );
        if (retenue) setCampagneId(retenue);
        else setChargement(false);
      })
      .catch((e) => {
        setErreur(e instanceof Error ? e.message : 'Chargement impossible.');
        setChargement(false);
      });
  }, []);

  const rechargerVueDEnsemble = useCallback((id: string) => {
    chargerDashboard(id)
      .then(setDashboard)
      .catch(() => {
        // La vue d'ensemble est un CONFORT. Si elle echoue, la saisie continue :
        // c'est le coeur du produit, il ne depend de rien.
        setDashboard(null);
      });
  }, []);

  const recharger = useCallback(
    async (id: string) => {
      const d = await chargerSaisie(id);
      setDonnees(d);
      indexer(d.rdvs);
      setVendeurId((actuel) =>
        actuel && d.vendeurs.some((v) => v.id === actuel) ? actuel : (d.vendeurs[0]?.id ?? null)
      );
    },
    [indexer]
  );

  useEffect(() => {
    if (!campagneId) return;
    setChargement(true);
    recharger(campagneId)
      .catch((e) => setErreur(e instanceof Error ? e.message : 'Chargement impossible.'))
      .finally(() => setChargement(false));
    rechargerVueDEnsemble(campagneId);
  }, [campagneId, recharger, rechargerVueDEnsemble]);

  // Temps reel : un autre chef saisit, nos compteurs bougent. On recharge le
  // perimetre plutot que de patcher a l'aveugle — c'est un appel par evenement
  // recu, pas par frappe, et ca garantit qu'on affiche ce que la base contient.
  useTempsReel(campagneId, {
    'rdv:cree': () => campagneId && majTout(campagneId),
    'rdv:modifie': () => campagneId && majTout(campagneId),
    'rdv:archive': () => campagneId && majTout(campagneId),
    // Un administrateur recompose une table pendant la session : mon perimetre
    // peut changer sous mes pieds. On relit.
    'tables:modifiees': () => campagneId && majTout(campagneId),
  });

  function majTout(id: string) {
    void recharger(id);
    rechargerVueDEnsemble(id);
  }

  const vendeur = donnees?.vendeurs.find((v) => v.id === vendeurId) ?? null;
  const figee = donnees?.campagne.cloturee ?? false;

  /// Compteurs par vendeur, calcules depuis les RDV en memoire. Pas d'appel
  /// serveur : la donnee est deja la, et le compteur doit bouger a la frappe.
  const compteurs = useMemo(() => {
    const parVendeur = new Map<string, { total: number; parSection: Record<string, number> }>();
    for (const v of donnees?.vendeurs ?? []) {
      const cases = rdvsParVendeur.get(v.id);
      const parSection: Record<string, number> = {};
      let total = 0;
      for (const s of v.sections) parSection[s.marqueId ?? 'sansMarque'] = 0;
      for (const r of cases?.values() ?? []) {
        const cle = r.marqueId ?? 'sansMarque';
        parSection[cle] = (parSection[cle] ?? 0) + 1;
        total++;
      }
      parVendeur.set(v.id, { total, parSection });
    }
    return parVendeur;
  }, [donnees, rdvsParVendeur]);

  const totalPerimetre = useMemo(
    () => [...compteurs.values()].reduce((n, c) => n + c.total, 0),
    [compteurs]
  );

  /// Recherche insensible a la casse ET AUX ACCENTS : personne ne tape
  /// « THÉO » avec son accent dans un champ de recherche. Porte aussi sur le code
  /// site — « CLF » est une facon naturelle de filtrer.
  ///
  /// `cleTri` est la MEME cle que celle du tri, et c'est voulu : chercher et
  /// classer doivent considerer « AMELIE » et « AMÉLIE » comme un seul nom.
  ///
  /// LE TOTAL AFFICHE EN PIED RESTE CELUI DU PERIMETRE ENTIER, jamais celui du
  /// filtre : un total qui change quand on cherche un nom serait un piege.
  const vendeursAffiches = useMemo(() => {
    const tous = donnees?.vendeurs ?? [];
    const q = cleTri(recherche.trim());
    if (q === '') return tous;
    return tous.filter((v) => cleTri(v.nom).includes(q) || cleTri(v.siteCode).includes(q));
  }, [donnees, recherche]);

  // ---------------------------------------------------------------- actions

  const avecEnregistrement = async (action: () => Promise<void>) => {
    setErreur(null);
    setEnregistrement(true);
    try {
      await action();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Enregistrement impossible.');
      // En cas d'echec on relit : l'ecran doit montrer la base, pas un etat local
      // optimiste qui n'a pas ete accepte.
      if (campagneId) await recharger(campagneId).catch(() => undefined);
    } finally {
      setEnregistrement(false);
    }
  };

  const poser = (section: SectionVendeur, creneauCode: string, jour: string, client: string) =>
    avecEnregistrement(async () => {
      if (!campagneId || !vendeurId) return;
      const { rdv } = await poserRdv({
        campagneId,
        vendeurId,
        jour,
        creneauCode,
        marqueId: section.marqueId,
        client,
      });
      appliquer(rdv);
      rafraichirVue();
    });

  const modifier = (r: RdvSaisie, client: string) =>
    avecEnregistrement(async () => {
      const { rdv } = await modifierRdv(r.id, client);
      appliquer(rdv);
    });

  const archiver = (r: RdvSaisie) =>
    avecEnregistrement(async () => {
      await archiverRdv(r.id);
      rafraichirVue();
      setRdvs((index) => {
        const suivant = new Map(index);
        const pour = new Map(suivant.get(r.vendeurId) ?? []);
        pour.delete(cleRdv(r.marqueId, r.creneauCode, r.jour));
        suivant.set(r.vendeurId, pour);
        return suivant;
      });
    });

  /// Apres MA propre ecriture, la vue d'ensemble est perimee : mes RDV comptent
  /// dans le classement des concessions. Le temps reel ne me renvoie pas mon
  /// propre evenement — c'est voulu, ca eviterait un scintillement pendant la
  /// frappe — donc c'est ici qu'il faut la rafraichir.
  const rafraichirVue = () => {
    if (campagneId) rechargerVueDEnsemble(campagneId);
  };

  const appliquer = (rdv: RdvSaisie) => {
    setRdvs((index) => {
      const suivant = new Map(index);
      const pour = new Map(suivant.get(rdv.vendeurId) ?? []);
      pour.set(cleRdv(rdv.marqueId, rdv.creneauCode, rdv.jour), rdv);
      suivant.set(rdv.vendeurId, pour);
      return suivant;
    });
  };

  const vendeurSuivant = () => {
    if (!donnees || !vendeurId) return;
    const i = donnees.vendeurs.findIndex((v) => v.id === vendeurId);
    const suivant = donnees.vendeurs[(i + 1) % donnees.vendeurs.length];
    if (suivant) setVendeurId(suivant.id);
  };

  // ---------------------------------------------------------------- rendu

  if (chargement) return <div className="attente">Chargement du planning…</div>;
  if (erreur && !donnees) return <div className="erreur-bloc">{erreur}</div>;
  if (!donnees) return <div className="attente">Aucune campagne.</div>;

  if (donnees.message) {
    return (
      <section className="ecran">
        <SelecteurCampagne campagnes={campagnes} valeur={campagneId} onChange={setCampagneId} />
        <div className="info-bloc">{donnees.message}</div>
      </section>
    );
  }

  return (
    <section className="ecran saisie">
      <header className="ecran-entete">
        <div>
          <h2>{donnees.perimetre?.libelle ?? 'Saisie'}</h2>
          <p className="note">
            {donnees.campagne.libelle} · {donnees.vendeurs.length} vendeurs ·{' '}
            {donnees.campagne.jours.length} jours × {donnees.campagne.creneaux.length} créneaux
          </p>
        </div>
        <div className="progression">
          <strong>{totalPerimetre}</strong>
          <span>RDV sur le périmètre</span>
        </div>
        <SelecteurCampagne campagnes={campagnes} valeur={campagneId} onChange={setCampagneId} />
      </header>

      {erreur && <div className="erreur-bloc">{erreur}</div>}
      {figee && (
        <div className="info-bloc">
          Campagne clôturée : les chiffres sont figés, la saisie est fermée.
        </div>
      )}

      <div className="saisie-corps">
        <aside className="liste-vendeurs">
          {/* Le champ n'apparait qu'a partir de huit vendeurs : sur une table de
              six, il occuperait de la place sans rien resoudre. */}
          {donnees.vendeurs.length >= 8 && (
            <div className="recherche-vendeur">
              <input
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
                placeholder="Chercher un vendeur, un site…"
                aria-label="Chercher un vendeur"
                spellCheck={false}
              />
              {recherche !== '' && (
                <button
                  type="button"
                  className="effacer"
                  onClick={() => setRecherche('')}
                  aria-label="Effacer la recherche"
                  title="Effacer"
                >
                  ×
                </button>
              )}
              {recherche !== '' && (
                <span className="compte">
                  {vendeursAffiches.length} sur {donnees.vendeurs.length}
                </span>
              )}
            </div>
          )}

          {vendeursAffiches.length === 0 && (
            <p className="note" style={{ padding: '0.6rem' }}>
              Aucun vendeur ne correspond à « {recherche} ».
            </p>
          )}

          {vendeursAffiches.map((v) => {
            const c = compteurs.get(v.id);
            return (
              <button
                type="button"
                key={v.id}
                className={`vendeur ${v.id === vendeurId ? 'actif' : ''}`}
                onClick={() => setVendeurId(v.id)}
              >
                <span className="nom">
                  {v.nom}
                  <span className={`etiquette ${v.typeVehicule === 'VO' ? 'vo' : 'vn'}`}>{v.typeVehicule}</span>
                </span>
                <span className="detail">
                  {v.siteCode}
                  {v.sections.length > 1 && (
                    <>
                      {' · '}
                      {v.sections
                        .map((s) => `${s.libelle.slice(0, 3)} ${c?.parSection[s.marqueId ?? 'sansMarque'] ?? 0}`)
                        .join(' / ')}
                    </>
                  )}
                </span>
                <span className="compteur">{c?.total ?? 0}</span>
              </button>
            );
          })}
          <div className="total-perimetre">
            <span>Total</span>
            <strong>{totalPerimetre}</strong>
          </div>
        </aside>

        <div className="zone-grille">
          {vendeur ? (
            <GrilleVendeur
              vendeur={vendeur}
              jours={donnees.campagne.jours}
              creneaux={donnees.campagne.creneaux}
              rdvs={rdvsParVendeur.get(vendeur.id) ?? new Map()}
              figee={figee}
              enregistrement={enregistrement}
              onPoser={poser}
              onModifier={modifier}
              onArchiver={archiver}
              onVendeurSuivant={vendeurSuivant}
            />
          ) : (
            <p className="note">Aucun vendeur dans ce périmètre.</p>
          )}
        </div>
      </div>

      {/* SOUS la grille, et replies par defaut. En cas d'arbitrage entre
          l'elegance d'un tableau de bord et la fluidite de la saisie, la saisie
          gagne toujours. */}
      <PanneauxLive
        dashboard={dashboard}
        plaqueId={donnees.perimetre?.plaqueId ?? null}
        tableId={donnees.perimetre?.tableId ?? null}
      />
    </section>
  );
}

function SelecteurCampagne({
  campagnes,
  valeur,
  onChange,
}: {
  campagnes: CampagneResume[];
  valeur: string | null;
  onChange: (id: string) => void;
}) {
  return (
    <select value={valeur ?? ''} onChange={(e) => onChange(e.target.value)} aria-label="Campagne">
      {campagnes.map((c) => (
        <option key={c.id} value={c.id}>
          {c.libelle}
          {c.cloturee ? ' (clôturée)' : ''}
          {c.vendeursSaisissables === 0 ? ' — aucun vendeur pour vous' : ''}
        </option>
      ))}
    </select>
  );
}
