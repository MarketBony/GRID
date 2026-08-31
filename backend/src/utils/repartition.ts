import type { TypeVehicule } from '../auth/roles';

// ============================================================================
// REPARTITION AUTOMATIQUE DES VENDEURS EN TABLES — F-B.5.
//
// FONCTION PURE. Aucun Prisma, aucune horloge, aucun `Math.random`.
//
// << Algorithme glouton, remplissage de la table la moins chargee, respect des
// marques quand la table est specialisee. Graine fixee a 42 — le resultat doit
// etre reproductible et donc contestable. >>
//
// POURQUOI LA GRAINE EST UNE EXIGENCE ET PAS UN DETAIL. Un chef de table qui
// trouve sa table defavorisee doit pouvoir relancer la repartition et retomber
// sur EXACTEMENT la meme composition. Sans cela, il n'a aucun moyen de faire la
// difference entre un algorithme et un caprice, et l'outil perd son autorite au
// premier desaccord. `Math.random` rendrait la repartition indefendable.
//
// TROIS SOURCES DE NON-DETERMINISME NEUTRALISEES :
//
//   1. Le hasard : generateur `mulberry32` seme a 42, jamais `Math.random`.
//   2. L'ORDRE D'ENTREE : les vendeurs sont d'abord tries par identifiant, AVANT
//      le brassage. Sans ce tri, un `findMany` qui renvoie ses lignes dans un
//      autre ordre — ce que PostgreSQL est libre de faire — produirait une autre
//      composition a graine identique.
//   3. Les EX AEQUO entre tables a charge egale : departages par le plus petit
//      `ordre`, puis par l'identifiant. C'est pour cela que le seed pose `ordre`
//      1..n et non zero partout — huit zeros rendaient ce departage arbitraire.
// ============================================================================

/// Graine de la repartition. **Ne pas rendre configurable** : une graine variable
/// redonnerait exactement le non-determinisme qu'on cherche a exclure.
export const GRAINE = 42;

export interface VendeurAPlacer {
  id: string;
  nom: string;
  /// Marques autorisees. Vide pour un vendeur VO — le fichier source ne les
  /// ventile pas par marque.
  marqueIds: string[];
  typeVehicule: TypeVehicule;
}

export interface TableCible {
  id: string;
  libelle: string;
  /// 1..n. Sert au departage des tables a charge egale, donc il compte.
  ordre: number;
  /// SPECIALISATION DECLAREE. `null` = table mixte, aucune contrainte de marque —
  /// c'est le cas normal, et le seul observe en juin 2026.
  ///
  /// Elle etait DEDUITE des membres presents dans une premiere version. Voir la
  /// note sur `compatible` : c'etait faux, et de facon spectaculaire.
  marqueId: string | null;
  /// Vendeurs DEJA en place. La repartition ne les deplace pas et les compte
  /// dans la charge de la table.
  membres: VendeurAPlacer[];
}

export interface Placement {
  tableId: string;
  libelle: string;
  /// Vendeurs a AJOUTER. Les membres existants n'y figurent pas.
  vendeurIdsAjoutes: string[];
  /// Effectif apres repartition, membres existants compris.
  effectif: number;
}

export interface ResultatRepartition {
  placements: Placement[];
  /// Vendeurs qu'aucune table ne pouvait accueillir, avec la raison. Jamais
  /// places d'office dans la premiere table : les laisser en reserve est un
  /// resultat valide — F-B.8 dit qu'un vendeur non affecte reste saisissable par
  /// son chef de site.
  nonPlaces: { vendeurId: string; nom: string; raison: string }[];
}

/// `mulberry32` — generateur pseudo-aleatoire deterministe, 32 bits d'etat.
/// Meme graine, meme suite, sur toute machine et toute version de Node. C'est la
/// seule propriete qu'on lui demande : ses qualites statistiques n'ont aucune
/// importance ici, sa reproductibilite est tout.
const generateur = (graine: number) => {
  let a = graine >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/// Fisher-Yates avec le generateur seme. L'entree est triee AVANT : voir le
/// point 2 de l'en-tete.
const brasser = <T>(liste: T[], hasard: () => number): T[] => {
  const t = [...liste];
  for (let i = t.length - 1; i > 0; i--) {
    const j = Math.floor(hasard() * (i + 1));
    [t[i], t[j]] = [t[j]!, t[i]!];
  }
  return t;
};

/// Un vendeur peut-il rejoindre cette table ?
///
/// Une table MIXTE (`marqueId` a `null`) accepte tout le monde. C'est le cas
/// normal : les huit tables de juin 2026 melangent les marques comme elles
/// melangent les sites.
///
/// Une table SPECIALISEE n'accepte qu'un vendeur VN autorise sur sa marque. Un
/// vendeur VO n'a aucune ventilation par marque — l'y placer n'aurait aucun sens
/// metier, et le trigger `affectation_marque_table` le refuse en base.
///
/// POURQUOI LA SPECIALISATION EST DECLAREE ET NON DEDUITE. La premiere version
/// prenait << les marques que les membres presents couvrent >>. Constate sur la
/// vraie session CENTRE de septembre, 29 vendeurs et 3 tables : la repartition a
/// rendu 11/8/10 au lieu de 10/10/9. Le premier vendeur tire au sort dans une
/// table vide fixait ses marques pour toujours ; un vendeur ALPINE est tombe dans
/// la table 2, qui a des lors refuse tout Renault/Dacia et n'a plus accueilli que
/// des Alpine et des VO — le deversoir de ceux qui n'ont aucune contrainte.
///
/// Le desequilibre n'etait que le symptome. Le defaut de fond : la specialisation
/// d'une table etait decidee par le TIRAGE AU SORT, l'inverse exact de ce que la
/// regle demande. Une table specialisee est une decision humaine, donc une
/// colonne — `table_phoning.marque_id`, migration `20260831090000`.
const compatible = (v: VendeurAPlacer, marqueId: string | null): boolean => {
  if (marqueId === null) return true;
  if (v.typeVehicule === 'VO') return false;
  return v.marqueIds.includes(marqueId);
};

/// Repartit `aPlacer` sur `tables`, glouton, table la moins chargee d'abord.
///
/// Les membres deja en place sont CONSERVES : la repartition complete une
/// composition, elle ne la refait pas. Refaire une composition entiere est une
/// operation distincte, et la route l'expose derriere un drapeau explicite —
/// elle archive les affectations existantes, ce qui ne doit jamais etre un effet
/// de bord.
export function repartir(
  aPlacer: VendeurAPlacer[],
  tables: TableCible[]
): ResultatRepartition {
  const placements: Placement[] = tables
    .slice()
    .sort((a, b) => a.ordre - b.ordre || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map((t) => ({
      tableId: t.id,
      libelle: t.libelle,
      vendeurIdsAjoutes: [],
      effectif: t.membres.length,
    }));

  const nonPlaces: ResultatRepartition['nonPlaces'] = [];

  if (placements.length === 0) {
    return {
      placements,
      nonPlaces: aPlacer.map((v) => ({
        vendeurId: v.id,
        nom: v.nom,
        raison: 'aucune table sur cette session',
      })),
    };
  }

  // La specialisation etant declaree, elle ne bouge pas pendant la repartition :
  // plus aucun etat a maintenir table par table. La version deduite en avait
  // besoin, et c'est ce qui la rendait dependante de l'ordre de tirage.
  const marqueParTable = new Map(tables.map((t) => [t.id, t.marqueId]));

  // Tri PUIS brassage : l'ordre d'arrivee ne doit pas influencer le resultat.
  const hasard = generateur(GRAINE);
  const ordonnes = brasser(
    [...aPlacer].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
    hasard
  );

  for (const v of ordonnes) {
    const candidates = placements.filter((p) =>
      compatible(v, marqueParTable.get(p.tableId) ?? null)
    );

    if (candidates.length === 0) {
      nonPlaces.push({
        vendeurId: v.id,
        nom: v.nom,
        raison:
          v.typeVehicule === 'VO'
            ? 'toutes les tables sont specialisees sur une marque, et un vendeur VO n’en a aucune'
            : 'aucune table specialisee sur une de ses marques',
      });
      continue;
    }

    // La moins chargee. A charge egale, le plus petit `ordre` — `placements` est
    // deja trie par `ordre`, donc `reduce` garde le premier a egalite.
    const choisie = candidates.reduce((min, p) => (p.effectif < min.effectif ? p : min), candidates[0]!);

    choisie.vendeurIdsAjoutes.push(v.id);
    choisie.effectif++;
  }

  return { placements, nonPlaces };
}

/// Ecart a l'effectif cible (F-B.6). `null` quand aucune cible n'est definie :
/// pas de cible, pas d'alerte — et surtout pas une alerte a zero.
export const ecartCible = (effectif: number, cible: number | null): number | null =>
  cible === null ? null : effectif - cible;
