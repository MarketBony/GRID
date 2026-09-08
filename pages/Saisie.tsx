import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
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
  type VendeurSaisie,
} from '../services/saisie';
import { choisirDansListe, useCampagneCourante } from '../contexts/CampagneContext';
import { useIndicateurGlissant } from '../hooks/useIndicateurGlissant';
import { Segmente } from '../components/Segmente';
import { DialogueExport } from '../components/DialogueExport';
import { PlanningImprimable, paginer } from '../components/PlanningImprimable';
import {
  FENETRE_PERIMETRE,
  FENETRE_VUE_ENSEMBLE,
  useRechargementCoalesce,
} from '../hooks/useRechargementCoalesce';

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

/// Pose ou remplace un RDV dans la liste d'une case, en gardant un ordre
/// DETERMINISTE : identifiant croissant.
///
/// L'ordre n'est pas cosmetique — c'est lui qui decide quel client s'affiche en
/// premier et lequel `Entree` reprend. On trie sur la CLE PRIMAIRE et non sur le
/// nom du client, qui se corrige : un renommage ne doit pas faire permuter deux RDV
/// sous les doigts du chef. Comparaison NUMERIQUE, parce que les identifiants sont
/// transportes en chaines et que « 10 » vient avant « 9 » en ordre lexical.
function inserer(liste: RdvSaisie[] | undefined, rdv: RdvSaisie): RdvSaisie[] {
  return [...(liste ?? []).filter((r) => r.id !== rdv.id), rdv].sort(
    (a, b) => Number(a.id) - Number(b.id)
  );
}

/// Retire UN RDV de la liste d'une case, par identifiant.
///
/// L'ancienne version supprimait la CASE entiere (`pour.delete(cle)`) : archiver
/// l'un des deux RDV d'une case faisait disparaitre l'autre de l'ecran jusqu'au
/// rechargement suivant.
function retirer(liste: RdvSaisie[] | undefined, id: string): RdvSaisie[] {
  return (liste ?? []).filter((r) => r.id !== id);
}

/// « Ma table » et « mon equipe de vente » sont deux ORIGINES de droit
/// distinctes, pas deux valeurs d'un meme rattachement : un vendeur de ma
/// concession que j'ai place dans ma table appartient aux deux.
type Origine = 'table' | 'equipe' | 'tout';

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

  /// ORIGINE AFFICHEE — « ma table » ou « mon equipe de vente ».
  ///
  /// Un chef de vente rattache a une table voyait les deux listes MELANGEES, sans
  /// moyen de savoir ce qu'il regardait : les vendeurs de sa concession et ceux de
  /// sa table, qui viennent d'autres concessions. Remonte apres l'exercice du
  /// 08/09/2026.
  const [origine, setOrigine] = useState<Origine>('table');

  /// L'EXPORT EN DEUX TEMPS. `dialogue` ouvre la selection ; `aImprimer` porte
  /// les vendeurs retenus, et sa presence suffit a monter le planning.
  const [dialogue, setDialogue] = useState(false);
  const [aImprimer, setAImprimer] = useState<VendeurSaisie[] | null>(null);

  /// Les RDV en memoire, indexes par vendeur puis par case. Une Map par vendeur
  /// evite de re-filtrer 2 000 RDV a chaque frappe.
  ///
  /// UNE CASE PORTE UNE LISTE, jamais un RDV. Deux cases de juin en portent deux —
  /// un vendeur a pris deux clients dans la meme heure. Avec un seul RDV par cle,
  /// `Map.set` gardait le DERNIER lu : le premier client n'etait pas seulement
  /// cache, il etait perdu selon l'ordre de pagination, donc pas toujours le meme.
  const [rdvsParVendeur, setRdvs] = useState<Map<string, Map<string, RdvSaisie[]>>>(new Map());

  /// La vue d'ensemble — les autres tables de la plaque et le classement des
  /// concessions. Chargee A PART du perimetre de saisie, et volontairement :
  /// elle couvre TOUT le groupe alors que le perimetre ne couvre que mes
  /// vendeurs. Un echec de ce chargement ne doit pas empecher de saisir, d'ou
  /// l'absence de gestion d'erreur bloquante ici.
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);

  const indexer = useCallback((rdvs: RdvSaisie[]) => {
    const index = new Map<string, Map<string, RdvSaisie[]>>();
    for (const r of rdvs) {
      const cle = cleRdv(r.marqueId, r.creneauCode, r.jour);
      const pour = index.get(r.vendeurId) ?? new Map<string, RdvSaisie[]>();
      pour.set(cle, inserer(pour.get(cle), r));
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

  // Temps reel : un autre chef saisit, nos compteurs bougent. On recharge plutot
  // que de patcher a l'aveugle — la charge utile ne porte PAS le nom du client
  // (elle ne l'a jamais porte, c'est structurel), et la grille l'affiche.
  //
  // MAIS ON NE RECHARGE PLUS A CHAQUE EVENEMENT, et c'est ce qui a mis GRID a
  // terre en pleine session le 08/09/2026. Le message part a TOUS les postes de
  // la campagne : chacun rechargeait tout son perimetre pour un RDV que la RLS
  // l'empeche le plus souvent de voir. 258 RDV/heure x 25 postes = 65 000
  // requetes/heure sur un pool de 10 connexions. Deux garde-fous :
  //
  //   1. ON FILTRE SUR LE PERIMETRE. `vendeurId` est dans la charge utile et la
  //      liste des vendeurs est deja en memoire : un evenement qui ne concerne
  //      aucun de mes vendeurs ne change RIEN a ma grille. Le relire serait
  //      relire a l'identique.
  //   2. ON REGROUPE ce qui reste (`useRechargementCoalesce`), avec une gigue
  //      pour que les postes ne repondent pas tous au meme instant.
  //
  // La vue d'ensemble, elle, bouge a chaque RDV du groupe par nature — mais
  // c'est un CONFORT, et c'est le rechargement le plus cher : fenetre longue.
  const majPerimetre = useRechargementCoalesce(() => {
    if (campagneId) void recharger(campagneId).catch(() => undefined);
  }, FENETRE_PERIMETRE);

  const majVueDEnsemble = useRechargementCoalesce(() => {
    if (campagneId) rechargerVueDEnsemble(campagneId);
  }, FENETRE_VUE_ENSEMBLE);

  useTempsReel(campagneId, {
    'rdv:modifie': (charge) => {
      majVueDEnsemble();
      const { vendeurId: concerne } = (charge ?? {}) as { vendeurId?: string };
      // Sans `vendeurId` on ne sait pas trancher : on recharge, comme avant.
      if (!concerne || (donnees?.vendeurs ?? []).some((v) => v.id === concerne)) {
        majPerimetre();
      }
    },
    // Un administrateur recompose une table pendant la session : mon perimetre
    // peut changer sous mes pieds, donc AUCUN filtre ne s'applique ici.
    'tables:modifiees': () => {
      majPerimetre();
      majVueDEnsemble();
    },
  });

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
      // ON COMPTE LES RDV, PAS LES CASES. C'est exactement l'ecart qui faisait dire
      // 1105 au module C et 1107 au tableau de bord, sur la meme base : deux cases
      // de juin portent deux rendez-vous, et une case ne comptait que pour un.
      for (const liste of cases?.values() ?? []) {
        for (const r of liste) {
          const cle = r.marqueId ?? 'sansMarque';
          parSection[cle] = (parSection[cle] ?? 0) + 1;
          total++;
        }
      }
      parVendeur.set(v.id, { total, parSection });
    }
    return parVendeur;
  }, [donnees, rdvsParVendeur]);

  /// Recherche insensible a la casse ET AUX ACCENTS : personne ne tape
  /// « THÉO » avec son accent dans un champ de recherche. Porte aussi sur le code
  /// site — « CLF » est une facon naturelle de filtrer.
  ///
  /// `cleTri` est la MEME cle que celle du tri, et c'est voulu : chercher et
  /// classer doivent considerer « AMELIE » et « AMÉLIE » comme un seul nom.
  ///
  /// LE TOTAL AFFICHE EN PIED RESTE CELUI DU PERIMETRE ENTIER, jamais celui du
  /// filtre : un total qui change quand on cherche un nom serait un piege.
  /// LE SELECTEUR N'APPARAIT QUE S'IL SERT. Il faut que les deux origines soient
  /// peuplees ET qu'elles ne se recouvrent pas exactement : un chef de table dont
  /// la table ne contient que ses propres vendeurs n'a rien a dissocier, et un
  /// bouton qui ne change rien est pire que pas de bouton.
  const origines = useMemo(() => {
    const tous = donnees?.vendeurs ?? [];
    const table = tous.filter((v) => v.dansMaTable);
    const equipe = tous.filter((v) => v.dansMonEquipe);
    const utile =
      table.length > 0 &&
      equipe.length > 0 &&
      !(table.length === equipe.length && table.every((v) => v.dansMonEquipe));
    return { table, equipe, utile };
  }, [donnees]);

  /// Si le selecteur ne sert pas, on retombe sur TOUT le perimetre — sans quoi un
  /// chef de site sans table verrait une liste vide au premier affichage.
  const origineEffective: Origine = origines.utile ? origine : 'tout';

  /// LES DEUX FILTRES SONT SEPARES, ET C'EST TOUTE LA NUANCE DU TOTAL.
  ///
  /// L'ORIGINE change de sujet : « ma table », « mon equipe », « tout » sont trois
  /// perimetres differents, donc trois totaux differents. Le total DOIT les
  /// suivre — il affichait 149 en permanence, y compris sur une table de cinq
  /// vendeurs, ce qui n'informait sur rien.
  ///
  /// LA RECHERCHE ne change pas de sujet : on cherche pour aller VOIR quelqu'un,
  /// pas pour restreindre le perimetre. Un total qui bougerait a la frappe serait
  /// un piege — c'etait deja ecrit ici, et ca reste vrai.
  ///
  /// D'ou deux listes et non une : le total se calcule sur la premiere.
  const vendeursOrigine = useMemo(() => {
    const tous = donnees?.vendeurs ?? [];
    if (origineEffective === 'table') return tous.filter((v) => v.dansMaTable);
    if (origineEffective === 'equipe') return tous.filter((v) => v.dansMonEquipe);
    return tous;
  }, [donnees, origineEffective]);

  /// Le total de l'origine courante. Il se somme sur `vendeursOrigine` et non sur
  /// tous les compteurs : c'est ce qui le fait suivre « ma table » / « mon
  /// equipe » / « tout ».
  const totalOrigine = useMemo(
    () => vendeursOrigine.reduce((n, v) => n + (compteurs.get(v.id)?.total ?? 0), 0),
    [vendeursOrigine, compteurs]
  );

  /// L'INTITULE DIT SUR QUOI PORTE LE NOMBRE. « RDV sur le perimetre » a cote
  /// d'un total de table etait faux : ce n'etait pas le perimetre.
  const libelleTotal =
    origineEffective === 'table'
      ? 'RDV de ma table'
      : origineEffective === 'equipe'
        ? 'RDV de mon équipe'
        : 'RDV sur le périmètre';

  const vendeursAffiches = useMemo(() => {
    const q = cleTri(recherche.trim());
    if (q === '') return vendeursOrigine;
    return vendeursOrigine.filter(
      (v) => cleTri(v.nom).includes(q) || cleTri(v.siteCode).includes(q)
    );
  }, [vendeursOrigine, recherche]);

  /// L'IMPRESSION, ET POURQUOI ELLE PASSE PAR LE NAVIGATEUR.
  ///
  /// Aucune bibliotheque PDF : le navigateur sait deja mettre en pages, il
  /// connait les polices de la charte et sa boite d'impression offre
  /// « Enregistrer au format PDF » comme « Imprimer ». Or ce qu'on veut, c'est du
  /// PAPIER AU MUR — une bibliotheque redessinerait tout a la main et ne saurait
  /// pas imprimer directement.
  ///
  /// TROIS PRECAUTIONS, chacune payee d'une panne evitee :
  ///
  ///   1. on attend `document.fonts.ready`. Syncopate et Albert Sans viennent du
  ///      reseau : imprimer avant leur chargement sort la planche dans la police
  ///      de repli, avec des colonnes decalees ;
  ///   2. on attend une IMAGE de plus apres les polices. Le navigateur doit avoir
  ///      mis en pages le portail avant qu'on lui demande de l'imprimer ;
  ///   3. on demonte sur `afterprint` et non apres l'appel. `window.print()` est
  ///      BLOQUANT dans certains moteurs et rend la main tout de suite dans
  ///      d'autres : demonter juste apres retirerait le document sous
  ///      l'imprimante. `afterprint` se declenche aussi quand on ANNULE la boite,
  ///      donc le nettoyage a lieu dans les deux cas.
  useEffect(() => {
    if (aImprimer === null) return;
    let vivant = true;
    const racine = document.documentElement;
    racine.classList.add('impression-planning');

    const fini = () => {
      racine.classList.remove('impression-planning');
      setAImprimer(null);
    };
    window.addEventListener('afterprint', fini);

    void document.fonts.ready.then(() => {
      if (!vivant) return;
      requestAnimationFrame(() => {
        if (vivant) window.print();
      });
    });

    return () => {
      vivant = false;
      window.removeEventListener('afterprint', fini);
      racine.classList.remove('impression-planning');
    };
  }, [aImprimer]);

  /// CHANGER D'ORIGINE DEPLACE LA SELECTION, il ne la laisse pas hors champ.
  ///
  /// Pendant une RECHERCHE on garde au contraire le vendeur retenu, curseur en
  /// « absent » : on cherche pour aller voir, pas pour changer de vendeur. Ici
  /// c'est l'inverse — on change de liste, donc de sujet.
  const changerOrigine = (suivante: Origine) => {
    setOrigine(suivante);
    const tous = donnees?.vendeurs ?? [];
    const liste =
      suivante === 'table'
        ? tous.filter((v) => v.dansMaTable)
        : suivante === 'equipe'
          ? tous.filter((v) => v.dansMonEquipe)
          : tous;
    setVendeurId((actuel) =>
      actuel && liste.some((v) => v.id === actuel) ? actuel : (liste[0]?.id ?? null)
    );
  };

  /// LE CURSEUR DE SELECTION GLISSE d'un vendeur a l'autre au lieu de sauter —
  /// meme mecanique que la pastille du segmente, meme hook. L'index porte sur la
  /// liste AFFICHEE et non sur le perimetre entier : c'est elle qui est a
  /// l'ecran, et un filtre de recherche la raccourcit.
  const indexVendeur = vendeursAffiches.findIndex((v) => v.id === vendeurId);
  const curseur = useIndicateurGlissant(Math.max(0, indexVendeur), vendeursAffiches.length, 'y');

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
        const cle = cleRdv(r.marqueId, r.creneauCode, r.jour);
        const reste = retirer(pour.get(cle), r.id);
        // La cle disparait quand la case se vide : `GrilleVendeur` compte sur une
        // liste jamais vide quand la cle existe, et `remplie` en depend.
        if (reste.length === 0) pour.delete(cle);
        else pour.set(cle, reste);
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
      const cle = cleRdv(rdv.marqueId, rdv.creneauCode, rdv.jour);
      pour.set(cle, inserer(pour.get(cle), rdv));
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
          <strong>{totalOrigine}</strong>
          <span>{libelleTotal}</span>
        </div>
        <SelecteurCampagne campagnes={campagnes} valeur={campagneId} onChange={setCampagneId} />
      </header>

      {erreur && <div className="erreur-bloc">{erreur}</div>}
      {figee && (
        <div className="info-bloc">
          Campagne clôturée : les chiffres sont figés, la saisie est fermée.
        </div>
      )}

      {dialogue && (
        <DialogueExport
          vendeurs={vendeursOrigine}
          onAnnuler={() => setDialogue(false)}
          onImprimer={(retenus) => {
            setDialogue(false);
            setAImprimer(retenus);
          }}
        />
      )}

      {/* LE PLANNING EST MONTE DANS UN PORTAIL SUR `document.body`, ET C'EST
          INDISPENSABLE — pas un raffinement.

          Il etait d'abord pose ici, dans l'ecran. Or l'impression masque
          l'application par `html.impression-planning .application { display:none }`
          et cet ecran EST dans `.application` : un ancetre en `display: none`
          retire ses descendants du rendu, impression comprise. On aurait imprime
          des PAGES BLANCHES, sans erreur ni avertissement.

          Pas de fenetre a part pour autant : il faudrait y recopier la feuille de
          style, donc entretenir deux verites sur l'apparence du document, dont une
          qui derive. Le portail garde une seule feuille et sort le planning de la
          branche masquee. */}
      {aImprimer !== null &&
        createPortal(
          <div className="hors-champ" aria-hidden="true">
            <PlanningImprimable
              pages={paginer(aImprimer)}
              jours={donnees.campagne.jours}
              creneaux={donnees.campagne.creneaux}
              rdvs={rdvsParVendeur}
              campagne={{ libelle: donnees.campagne.libelle, jours: donnees.campagne.jours }}
              perimetre={donnees.perimetre?.libelle ?? ''}
            />
          </div>,
          document.body
        )}

      <div className="saisie-corps">
        <aside className="liste-vendeurs" ref={curseur.conteneur}>
          {/* Le curseur est le PREMIER enfant : il doit peindre sous les lignes.
              `absent` quand le vendeur retenu est hors du filtre courant. */}
          <span
            className={`curseur-liste${indexVendeur < 0 ? ' absent' : ''}`}
            aria-hidden="true"
            ref={curseur.indicateur}
          />
          {origines.utile && (
            <Segmente
              className="origine-saisie"
              etiquette="Qui afficher"
              valeur={origineEffective}
              onChange={changerOrigine}
              options={[
                {
                  valeur: 'table' as const,
                  libelle: 'Ma table',
                  detail: String(origines.table.length),
                },
                {
                  valeur: 'equipe' as const,
                  libelle: 'Mon équipe',
                  detail: String(origines.equipe.length),
                },
                {
                  valeur: 'tout' as const,
                  libelle: 'Tout',
                  detail: String(donnees.vendeurs.length),
                },
              ]}
            />
          )}

          {/* LE BOUTON D'IMPRESSION N'EXISTE QUE SUR « MON EQUIPE ». C'est
              l'encadrant qui suit son equipe au mur ; un chef de table qui
              imprime « ma table » imprimerait des vendeurs d'autres concessions,
              que personne ne suit chez lui.

              Il est pose JUSTE SOUS le selecteur d'origine, la ou le choix vient
              d'etre fait : le lien de cause a effet se voit. Son intitule dit
              l'objet ET le geste — « Exporter » ne dit ni l'un ni l'autre. */}
          {origineEffective === 'equipe' && vendeursOrigine.length > 0 && (
            <button
              type="button"
              className="principal bouton-impression"
              onClick={() => setDialogue(true)}
            >
              Imprimer les plannings de l’équipe
            </button>
          )}

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
              {recherche !== ''
                ? `Aucun vendeur ne correspond à « ${recherche} ».`
                : origineEffective === 'table'
                  ? 'Aucun vendeur dans les tables que vous animez.'
                  : 'Aucun vendeur dans les sites que vous encadrez.'}
            </p>
          )}

          {vendeursAffiches.map((v, i) => {
            const c = compteurs.get(v.id);
            return (
              <button
                type="button"
                key={v.id}
                ref={curseur.cible(i)}
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
            <strong>{totalOrigine}</strong>
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
