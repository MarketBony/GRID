import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { GrilleUnique } from '../components/saisie/GrilleUnique';
import { Compteur } from '../components/ui/Compteur';
import { Icone } from '../components/ui/Icone';
import { VueTable } from '../components/saisie/VueTable';
import { cleRdv, libelleJour } from '../utils/grille';
import { cleTri } from '../backend/src/utils/tri';
import { useTempsReel } from '../hooks/useTempsReel';
import { appliquerRdv, type Dashboard, type EvenementRdv } from '../services/dashboard';
import {
  delaiAvantEssai,
  ecrireFile,
  estPassagere,
  lireFile,
  type PoseEnAttente,
} from '../services/fileAttente';
import { chargerCampagnes, type CampagneResume } from '../services/campagnes';
import {
  archiverRdv,
  chargerSaisie,
  modifierRdv,
  nouvelleCle,
  poserRdv,
  type PerimetreSaisie,
  type RdvSaisie,
  type SectionVendeur,
  type VendeurSaisie,
} from '../services/saisie';
import { choisirDansListe, useCampagneCourante } from '../contexts/CampagneContext';
import { useIndicateurGlissant } from '../hooks/useIndicateurGlissant';
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
  // Un RDV EN ATTENTE n'a pas encore d'identifiant numerique : il se range apres
  // les RDV acceptes, ce qui est aussi son ordre d'arrivee.
  const rang = (r: RdvSaisie) => (r.enAttente ? Number.POSITIVE_INFINITY : Number(r.id));
  return [...(liste ?? []).filter((r) => r.id !== rdv.id), rdv].sort((a, b) => rang(a) - rang(b));
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

  /// LA VUE D'ENSEMBLE A QUITTE LA SAISIE (03/10/2026, decision de l'utilisateur :
  /// le panneau « ne sert a rien » ici, le tableau de bord le fait). On ne la
  /// charge donc plus : autant de requetes en moins par poste pendant une seance.
  const rechargerVueDEnsemble = useCallback((_id: string) => undefined, []);

  /// LA FILE D'ATTENTE des poses non encore acceptees par la base — voir
  /// `services/fileAttente.ts`. Une ref et non un etat : elle ne se dessine pas,
  /// ce sont les RDV provisoires qu'elle porte qui se dessinent.
  const file = useRef<PoseEnAttente[]>([]);
  const [enAttente, setEnAttente] = useState(0);
  /// D13, n.5 : un client deja pose dans la campagne. Un AVERTISSEMENT, jamais un
  /// refus — deux homonymes existent, et un client peut avoir deux RDV.
  const [avertissement, setAvertissement] = useState<string | null>(null);
  useEffect(() => {
    if (!avertissement) return;
    const t = window.setTimeout(() => setAvertissement(null), 7000);
    return () => window.clearTimeout(t);
  }, [avertissement]);
  const minuteurFile = useRef<number | null>(null);

  /// Les RDV provisoires de la file, sous la forme de la grille. Remis par-dessus
  /// chaque rechargement : sans cela, une resynchronisation effacerait de l'ecran
  /// un RDV tape et pas encore parti — exactement la perte que la file empeche.
  const provisoires = useCallback(
    (): RdvSaisie[] =>
      file.current.map((p) => ({
        id: `attente-${p.cle}`,
        vendeurId: p.corps.vendeurId,
        jour: p.corps.jour,
        creneauCode: p.corps.creneauCode,
        marqueId: p.corps.marqueId,
        typeVehicule: p.corps.typeVehicule,
        client: p.corps.client,
        commentaire: null,
        enAttente: true,
      })),
    []
  );

  const recharger = useCallback(
    async (id: string) => {
      const d = await chargerSaisie(id);
      setDonnees(d);
      indexer([...d.rdvs, ...provisoires()]);
      setVendeurId((actuel) =>
        actuel && d.vendeurs.some((v) => v.id === actuel) ? actuel : (d.vendeurs[0]?.id ?? null)
      );
    },
    [indexer, provisoires]
  );

  useEffect(() => {
    if (!campagneId) return;
    // Une file laissee par un onglet ferme ou un navigateur tombe en pleine
    // seance : on la reprend, et elle repart des que l'ecran est charge.
    file.current = lireFile(campagneId);
    setChargement(true);
    recharger(campagneId)
      .then(() => {
        if (file.current.length > 0) programmerFile(0);
      })
      .catch((e) => setErreur(e instanceof Error ? e.message : 'Chargement impossible.'))
      .finally(() => setChargement(false));
    rechargerVueDEnsemble(campagneId);
  }, [campagneId, recharger, rechargerVueDEnsemble]);

  /// LA RESYNCHRONISATION DE SECURITE. La vue d'ensemble vit desormais de
  /// messages appliques en memoire : un message perdu (reseau coupe une seconde)
  /// laisserait un ecart jusqu'a la fin de la seance. Toutes les ~5 minutes, avec
  /// un decalage aleatoire par poste — sans lui, 25 postes ouverts a 9 h se
  /// resynchroniseraient ensemble, la meute du 08/09 en plus petit —, on relit
  /// tout. Une requete par poste et par ecran toutes les 5 minutes, c'est ~600
  /// requetes/heure pour toute la salle.
  useEffect(() => {
    if (!campagneId) return;
    const periode = 5 * 60_000 + Math.random() * 60_000;
    const t = window.setInterval(() => {
      void recharger(campagneId).catch(() => undefined);
      rechargerVueDEnsemble(campagneId);
    }, periode);
    return () => window.clearInterval(t);
  }, [campagneId, recharger, rechargerVueDEnsemble]);

  /// La vue d'ensemble courante, lue par les gestionnaires d'evenements sans les
  /// reconstruire a chaque rendu.
  const dashboardRef = useRef<Dashboard | null>(null);
  dashboardRef.current = dashboard;

  /// Applique un changement de RDV a la vue d'ensemble, EN MEMOIRE. Si ce n'est
  /// pas possible sans risque (`appliquerRdv` rend `null`), on retombe sur le
  /// rechargement regroupe, comme avant.
  const appliquerVue = (e: EvenementRdv) => {
    const d = dashboardRef.current;
    if (!d) return;
    const suivant = appliquerRdv(d, e);
    if (suivant) setDashboard(suivant);
    else majVueDEnsemble();
  };

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
      // LA VUE D'ENSEMBLE NE SE RECHARGE PLUS : le message porte tout ce qu'elle
      // compte, il s'applique en memoire (lot 1, 03/10/2026). C'etait ~17 000
      // requetes/heure pour une salle de 25 postes.
      appliquerVue((charge ?? {}) as EvenementRdv);
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
    // Le canal revient apres une coupure : des messages ont pu se perdre pendant
    // qu'il etait tombe. On relit, regroupe et disperse comme le reste.
    reconnecte: () => {
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
  /// D11 : les vendeurs declares ABSENTS a l'ecran Effectifs sortent de la liste
  /// par defaut, comme la reserve d'une table. Un interrupteur les fait revenir —
  /// on ne cache pas un vendeur qui aurait quand meme des RDV a corriger.
  const [voirAbsents, setVoirAbsents] = useState(false);
  const [vue, setVue] = useState<'vendeur' | 'table'>('vendeur');
  const segVue = useIndicateurGlissant(vue === 'vendeur' ? 0 : 1, 2);
  const segOrigine = useIndicateurGlissant(['table', 'equipe', 'tout'].indexOf(origineEffective), 3);
  const absents = useMemo(() => (donnees?.vendeurs ?? []).filter((v) => v.mobilise === false), [donnees]);

  const vendeursOrigine = useMemo(() => {
    const tous = (donnees?.vendeurs ?? []).filter((v) => voirAbsents || v.mobilise !== false);
    if (origineEffective === 'table') return tous.filter((v) => v.dansMaTable);
    if (origineEffective === 'equipe') return tous.filter((v) => v.dansMonEquipe);
    return tous;
  }, [donnees, origineEffective, voirAbsents]);

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

  /// PLUS DE RECHARGEMENT COMPLET SUR ECHEC (lot 1, 03/10/2026). L'ancienne
  /// version relisait tout le perimetre a chaque ecriture refusee : quand la base
  /// sature, chaque echec ajoutait une lecture couteuse, et la saturation
  /// s'entretenait elle-meme. L'etat local reste juste sans relecture : une pose
  /// refusee est retiree de l'ecran ici, une pose passagerement en echec reste en
  /// file, et la resynchronisation periodique rattrape le reste.
  const avecEnregistrement = async (action: () => Promise<void>) => {
    setErreur(null);
    setEnregistrement(true);
    try {
      await action();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Enregistrement impossible.');
    } finally {
      setEnregistrement(false);
    }
  };

  const retirerDeLIndex = (r: Pick<RdvSaisie, 'id' | 'vendeurId' | 'marqueId' | 'creneauCode' | 'jour'>) => {
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
  };

  /// Mes propres ecritures dans la vue d'ensemble. Le temps reel ne me renvoie
  /// pas mon evenement — voulu, ca evite un scintillement pendant la frappe —, on
  /// l'applique donc ici, EN MEMOIRE. Jusqu'au 03/10, c'etait un rechargement
  /// complet du tableau apres chaque RDV : ~1 800 requetes/heure par salle.
  const vueApresEcriture = (r: RdvSaisie, archive: boolean) =>
    appliquerVue({
      id: r.id,
      vendeurId: r.vendeurId,
      jour: r.jour,
      creneauCode: r.creneauCode,
      marqueId: r.marqueId,
      typeVehicule: r.typeVehicule,
      archive,
    });

  // ------------------------------------------------ la file d'attente des poses

  const enregistrerFile = () => {
    if (campagneId) ecrireFile(campagneId, file.current);
    setEnAttente(file.current.length);
  };

  /// Programme le prochain passage de la file. Un seul minuteur a la fois : la
  /// file part EN SERIE, dans l'ordre de saisie — ce qui garde l'ordre des RDV
  /// d'une meme case, et n'envoie pas une rafale a une base deja debordee.
  const programmerFile = (delai: number) => {
    if (minuteurFile.current !== null) return;
    minuteurFile.current = window.setTimeout(() => {
      minuteurFile.current = null;
      void viderFile();
    }, delai);
  };

  const viderFile = async () => {
    while (file.current.length > 0) {
      const p = file.current[0]!;
      try {
        const { rdv } = await poserRdv(p.corps);
        file.current = file.current.slice(1);
        enregistrerFile();
        // Le provisoire cede la place au RDV accepte, a la meme case.
        retirerDeLIndex({ ...p.corps, id: `attente-${p.cle}` });
        appliquer(rdv);
        vueApresEcriture(rdv, false);
      } catch (e) {
        if (estPassagere(e)) {
          // La base ne repond pas : on garde TOUT, et on revient plus tard.
          p.essais += 1;
          enregistrerFile();
          programmerFile(delaiAvantEssai(p.essais));
          return;
        }
        // Refus METIER : le rejouer ne changerait rien. Le RDV quitte l'ecran et
        // l'utilisateur le sait, avec le nom du client pour le retrouver.
        file.current = file.current.slice(1);
        enregistrerFile();
        retirerDeLIndex({ ...p.corps, id: `attente-${p.cle}` });
        const raison = e instanceof Error ? e.message : 'Enregistrement impossible.';
        setErreur(`${p.corps.client} : ${raison}`);
      }
    }
  };

  /// POSER = afficher tout de suite, envoyer ensuite. La case se remplit a la
  /// frappe, le curseur avance, et la file s'occupe du reseau : le chef n'attend
  /// plus jamais la base pour passer au RDV suivant.
  const poser = async (section: SectionVendeur, creneauCode: string, jour: string, client: string) => {
    if (!campagneId || !vendeurId || !vendeur) return;
    setErreur(null);
    const pose: PoseEnAttente = {
      cle: nouvelleCle(),
      essais: 0,
      corps: {
        campagneId,
        vendeurId,
        typeVehicule: vendeur.typeVehicule,
        jour,
        creneauCode,
        marqueId: section.marqueId,
        client,
        cle: '',
      },
    };
    pose.corps.cle = pose.cle;
    // Le doublon se cherche sur ce que CE poste voit — son perimetre — avec la
    // cle de tri : « Éric Martin » et « ERIC MARTIN » sont le meme nom.
    const cible = cleTri(client.trim());
    const deja: string[] = [];
    for (const [vid, cases] of rdvsParVendeur) {
      for (const liste of cases.values()) {
        for (const r of liste) {
          if (cleTri(r.client) === cible) {
            const v = donnees?.vendeurs.find((x) => x.id === vid);
            deja.push(`${v?.nom ?? 'un vendeur'} (${libelleJour(r.jour)})`);
          }
        }
      }
    }
    if (deja.length > 0) setAvertissement(`${client.trim().toUpperCase()} a déjà un RDV : ${deja.slice(0, 3).join(', ')}. Vérifier qu'il ne s'agit pas d'un doublon.`);
    file.current = [...file.current, pose];
    enregistrerFile();
    appliquer(provisoires().find((r) => r.id === `attente-${pose.cle}`)!);
    if (minuteurFile.current === null) void viderFile();
  };

  const encoreEnAttente = (r: RdvSaisie) => {
    if (!r.enAttente) return false;
    setErreur(`${r.client} est encore en cours d'envoi : réessayer dans un instant.`);
    return true;
  };

  const modifier = (r: RdvSaisie, client: string) =>
    avecEnregistrement(async () => {
      if (encoreEnAttente(r)) return;
      const { rdv } = await modifierRdv(r.id, client);
      appliquer(rdv);
    });

  const archiver = (r: RdvSaisie) =>
    avecEnregistrement(async () => {
      if (encoreEnAttente(r)) return;
      await archiverRdv(r.id);
      retirerDeLIndex(r);
      vueApresEcriture(r, true);
    });

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

  if (chargement) {
    return (
      <div className="page">
        <div className="skel" style={{ height: 40, width: 320 }} />
        <div className="saisie-v2">
          <div className="skel" style={{ height: 420 }} />
          <div className="skel" style={{ height: 420 }} />
        </div>
      </div>
    );
  }
  if (erreur && !donnees) return <div className="page"><div className="bandeau-v2 erreur">{erreur}</div></div>;
  if (!donnees) return <div className="page"><div className="empty card">Aucune campagne.</div></div>;

  if (donnees.message) {
    return (
      <div className="page">
        <div className="app-head enter">
          <h1>Saisie</h1>
          <div className="droite"><SelecteurCampagne campagnes={campagnes} valeur={campagneId} onChange={setCampagneId} /></div>
        </div>
        <div className="bandeau-v2">{donnees.message}</div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="app-head enter">
        <h1>{donnees.perimetre?.libelle ?? 'Saisie'}</h1>
        <span className="sub">
          {donnees.campagne.libelle} · {donnees.vendeurs.length} vendeurs · {donnees.campagne.jours.length} jours
        </span>
        <div className="droite">
          {/* LE TEMOIN DE SANTE (1.9) : discret quand tout va bien, visible quand
              des RDV attendent d'etre envoyes. */}
          <span className={`sante${enAttente > 0 ? ' lent' : ''}`} title="RDV posés à l'écran mais pas encore acceptés par la base">
            <i />
            {enAttente > 0 ? `${enAttente} en attente d'envoi` : 'À jour'}
          </span>
          <SelecteurCampagne campagnes={campagnes} valeur={campagneId} onChange={setCampagneId} />
        </div>
      </div>

      {erreur && <div className="bandeau-v2 erreur" role="alert">{erreur}</div>}
      {avertissement && <div className="bandeau-v2 avertissement" role="status">{avertissement}</div>}
      {figee && <div className="bandeau-v2">Campagne clôturée : les chiffres sont figés, la saisie est fermée.</div>}

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

      {/* Le planning imprimable vit dans un PORTAIL sur `document.body` : un
          ancetre masque a l'impression retirerait ses descendants du rendu, et
          on imprimerait des pages blanches. */}
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

      <div className="saisie-v2">
        <aside className="liste-v2 card enter" style={{ ['--i' as string]: 1 }}>
          <div className="liste-tete">
            <div className="total-v2">
              <Compteur valeur={totalOrigine} />
              <span>{libelleTotal}</span>
            </div>
            {origines.utile && (
              <div className="seg seg-plein" ref={segOrigine.conteneur} role="radiogroup" aria-label="Qui afficher">
                <span className="pouce" ref={segOrigine.indicateur} aria-hidden="true" />
                {(
                  [
                    ['table', 'Ma table', origines.table.length],
                    ['equipe', 'Mon équipe', origines.equipe.length],
                    ['tout', 'Tout', donnees.vendeurs.length],
                  ] as const
                ).map(([valeur, libelle, n], i) => (
                  <button key={valeur} type="button" ref={segOrigine.cible(i)} aria-pressed={origineEffective === valeur} onClick={() => changerOrigine(valeur)}>
                    {libelle} <span className="faint num">{n}</span>
                  </button>
                ))}
              </div>
            )}
            {donnees.vendeurs.length >= 8 && (
              <label className="recherche-v2">
                <Icone nom="recherche" petite />
                <input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Vendeur, site…" spellCheck={false} />
                {recherche !== '' && <span className="faint num">{vendeursAffiches.length}</span>}
              </label>
            )}
            {absents.length > 0 && (
              <label className="bascule-absents">
                <input type="checkbox" className="interrupteur-v2" checked={voirAbsents} onChange={(e) => setVoirAbsents(e.target.checked)} />
                <span>Absents <span className="faint num">({absents.length})</span></span>
              </label>
            )}
          </div>

          <div className="liste-corps" ref={curseur.conteneur}>
            <span className={`curseur-v2${indexVendeur < 0 ? ' absent' : ''}`} aria-hidden="true" ref={curseur.indicateur} />
            {vendeursAffiches.length === 0 && (
              <div className="empty" style={{ padding: 20 }}>
                {recherche !== '' ? `Aucun vendeur ne correspond à « ${recherche} ».` : 'Aucun vendeur ici.'}
              </div>
            )}
            {vendeursAffiches.map((v, i) => {
              const c = compteurs.get(v.id);
              return (
                <button
                  type="button"
                  key={v.id}
                  ref={curseur.cible(i)}
                  className={`vendeur-v2${v.id === vendeurId ? ' actif' : ''}`}
                  onClick={() => setVendeurId(v.id)}
                >
                  <span className="nom">{v.nom}</span>
                  <span className="site">{v.siteCode}{v.typeVehicule === 'VO' ? ' · VO' : ''}</span>
                  <span className="n"><Compteur valeur={c?.total ?? 0} /></span>
                </button>
              );
            })}
          </div>

          {/* L'impression n'existe que sur « mon equipe » : c'est l'encadrant qui
              suit son equipe au mur. */}
          {origineEffective === 'equipe' && vendeursOrigine.length > 0 && (
            <button type="button" className="btn" style={{ margin: '0 8px 8px' }} onClick={() => setDialogue(true)}>
              Imprimer les plannings de l’équipe
            </button>
          )}
        </aside>

        <section className="zone-v2 card enter" style={{ ['--i' as string]: 2 }}>
          <div className="zone-tete">
            <div className="seg" ref={segVue.conteneur} role="radiogroup" aria-label="Affichage">
              <span className="pouce" ref={segVue.indicateur} aria-hidden="true" />
              <button type="button" ref={segVue.cible(0)} aria-pressed={vue === 'vendeur'} onClick={() => setVue('vendeur')}>Planning</button>
              <button type="button" ref={segVue.cible(1)} aria-pressed={vue === 'table'} onClick={() => setVue('table')}>Carte du jour</button>
            </div>
            {vue === 'vendeur' && vendeur && (
              <span className="vendeur-courant">
                <b>{vendeur.nom}</b> <span className="faint">{vendeur.siteLibelle}</span>
              </span>
            )}
          </div>
          {vue === 'table' ? (
            <VueTable
              vendeurs={vendeursOrigine}
              jours={donnees.campagne.jours}
              creneaux={donnees.campagne.creneaux}
              rdvsParVendeur={rdvsParVendeur}
              ouvrir={(id) => {
                setVendeurId(id);
                setVue('vendeur');
              }}
            />
          ) : vendeur ? (
            <GrilleUnique
              vendeur={vendeur}
              jours={donnees.campagne.jours}
              creneaux={donnees.campagne.creneaux}
              rdvs={rdvsParVendeur.get(vendeur.id) ?? new Map()}
              figee={figee}
              onPoser={poser}
              onModifier={modifier}
              onArchiver={archiver}
              onVendeurSuivant={vendeurSuivant}
            />
          ) : (
            <div className="empty">Aucun vendeur dans ce périmètre.</div>
          )}
        </section>
      </div>

    </div>
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
