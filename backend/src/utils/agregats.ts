import type { TypeVehicule } from '../auth/roles';
// Le departage des ex aequo compare des libelles. La cle de comparaison est
// dans `tri.ts`, seul endroit du backend ou cette regle est ecrite.
import { cleTri } from './tri';

// ============================================================================
// AGREGATS — FONCTIONS PURES. AUCUN PRISMA, AUCUN ACCES RESEAU.
//
// SOURCE DE VERITE UNIQUE de tous les totaux du produit. Trois ecrans les
// reclament : le dashboard (module D), les panneaux live de la saisie (module C),
// et l'alerte d'effectif du constructeur de tables (F-B.6). Ecrits trois fois,
// ils divergeront — et une divergence d'agregat ne se voit pas, elle se decouvre
// des mois plus tard quand deux ecrans affichent deux nombres.
//
// POURQUOI DES FONCTIONS PURES, et c'est le point central de ce fichier.
//
// Ce produit existe parce que les agregats de l'Excel etaient faux : 677
// references figees vers des totaux maintenus a la main. Livrer les notres sans
// pouvoir demontrer qu'ils sont justes reproduirait exactement le defaut qu'on
// remplace. Des fonctions pures se verifient contre les 1107 RDV reels de juin
// 2026 sans base de donnees et sans serveur — c'est ce que fait
// `agregats.verif.ts`, et c'est le critere de recette n.4.
//
// INTERDIT N.2 — rien de ce qui est calcule ici n'est stocke. Pas de colonne
// `total_rdv`, pas de table de synthese, pas de compteur denormalise. Tout se
// recalcule a la lecture. Le fichier Excel faisait la meme chose avec des
// `COUNTA` ; sa fragilite ne venait pas du recalcul mais des references figees.
//
// DEUX REGLES QUI ONT DEJA COUTE DES BUGS, ET QU'ON NE REINTRODUIT PAS :
//
//   1. LES TOTAUX PARTENT DES VENDEURS, PAS DES RDV. `schema.sql` batissait ses
//      classements sur la table des RDV : un vendeur a 0 RDV disparaissait du
//      classement, sans erreur ni trace. Ici chaque fonction recoit la liste des
//      vendeurs, cree les paniers, PUIS y replie les RDV.
//
//   2. L'EFFECTIF N'EST JAMAIS COMPTE SUR LES RDV. Il vient de la liste des
//      vendeurs PRESENTS PENDANT LA CAMPAGNE, bornee par `presenceVendeur.ts`.
//      C'est le bug `RANK!AG` : compter les presents d'aujourd'hui tout en
//      additionnant les RDV de tous faisait bouger la moyenne d'une campagne
//      passee des qu'un vendeur partait.
// ============================================================================

/// Un RDV reduit a ce qui sert aux totaux. Pas de client : les agregats ne
/// portent que des nombres, et rien ici ne doit pouvoir divulguer un nom.

export interface LigneRdv {
  vendeurId: string;
  typeVehicule: TypeVehicule;
  /// `null` pour un vendeur VO — le fichier source ne les ventile pas par marque.
  marqueId: string | null;
  /// Jour ISO `AAAA-MM-JJ`.
  jour: string;
  creneauCode: string;
}

/// Un vendeur et tout son rattachement, deja resolu par la couche d'appel.
///
/// `plaqueId` arrive TOUJOURS d'une jointure sur `site.plaque_id` et jamais d'une
/// derivation : le rattachement site -> plaque est modifiable, c'est un piege
/// herite du fichier source.
export interface LigneVendeur {
  id: string;
  nom: string;
  siteId: string;
  siteLibelle: string;
  plaqueId: string;
  plaqueLibelle: string;
  /// `null` = non affecte a une table. Ce n'est pas une anomalie : F-B.8 dit
  /// qu'un vendeur non affecte reste saisissable par son chef de site, et deux
  /// plaques sur quatre n'avaient aucune table en juin 2026.
  tableId: string | null;
  tableLibelle: string | null;
  typeVehicule: TypeVehicule;
}

export const AXES = ['vendeur', 'site', 'plaque', 'table', 'groupe'] as const;
export type Axe = (typeof AXES)[number];

/// Clé du panier des vendeurs sans table, et des RDV sans marque. Des chaines et
/// non `null` : une clé de dictionnaire ne peut pas etre nulle, et un panier
/// nomme se lit mieux dans un test en echec qu'un `undefined`.
export const SANS_TABLE = 'sansTable';
export const SANS_MARQUE = 'sansMarque';

export interface Totaux {
  cle: string;
  libelle: string;
  total: number;
  vn: number;
  vo: number;
  /// `marqueId` -> nombre de RDV. Les RDV d'un vendeur VO sont comptes sous
  /// `SANS_MARQUE`.
  parMarque: Record<string, number>;
  /// Nombre de vendeurs MOBILISES, calcule et non saisi (F-D.3). Voir
  /// `mobilisation()` : ce n'est pas le nombre de presents, c'est le nombre de
  /// ceux qui ont pris part a l'exercice.
  effectif: number;
  /// `total / effectif`, arrondi au centieme. `0` si l'effectif est nul — un site
  /// sans vendeur est un cas prevu (l'onglet MDP du fichier source).
  moyenne: number;
}

// ---------------------------------------------------------------- totaux

/// Rend le rattachement d'un vendeur sur un axe donne : la clé du panier et son
/// libelle. Un seul endroit ou cette correspondance est ecrite.
const rattachement = (v: LigneVendeur, axe: Axe): { cle: string; libelle: string } => {
  switch (axe) {
    case 'vendeur':
      return { cle: v.id, libelle: v.nom };
    case 'site':
      return { cle: v.siteId, libelle: v.siteLibelle };
    case 'plaque':
      return { cle: v.plaqueId, libelle: v.plaqueLibelle };
    case 'table':
      return v.tableId
        ? { cle: v.tableId, libelle: v.tableLibelle ?? v.tableId }
        : { cle: SANS_TABLE, libelle: 'Non affectés' };
    case 'groupe':
      return { cle: 'groupe', libelle: 'Groupe Bony' };
  }
};

const arrondi = (n: number) => Math.round(n * 100) / 100;

/// LE PHONING, ET SEULEMENT LUI (lot 2 de PLAN-GRID-V2.md, 03/10/2026).
///
/// Un RDV de TRAFIC NATUREL (`source = 'showroom'`, saisi depuis le Suivi des
/// RDV) n'est pas un resultat de la seance : il ne compte ni dans les totaux, ni
/// dans les classements, ni dans la moyenne par vendeur du phoning (D5). Le
/// filtre vit ICI, et nulle part ailleurs : un ecran qui l'oublierait gonflerait
/// un classement sans que rien ne le signale. Une ligne SANS source est un RDV de
/// phoning — tout l'historique anterieur au 03/10/2026, juin et septembre compris.
export function duPhoning<T extends { source?: string | null }>(rdvs: T[]): T[] {
  return rdvs.filter((r) => (r.source ?? 'relance') === 'relance');
}

/// QUI COMPTE DANS L'EFFECTIF — la regle du 08/09/2026, arbitree par l'utilisateur
/// apres le premier exercice reel.
///
/// ---------------------------------------------------------------------------
/// LE DEFAUT CONSTATE
/// ---------------------------------------------------------------------------
/// La moyenne RDV/vendeur divisait par TOUS les vendeurs presents. Or en mode
/// `par_table`, une partie de la plaque reste EN RESERVE : elle n'est affectee a
/// aucune table, donc elle ne participe pas a l'exercice. Sur CENTRE en septembre
/// 2026 : 32 presents, 24 sur une table, 8 en reserve — la moyenne annoncait
/// 10,69 au lieu de 14,25. Les huit reservistes diluaient le resultat des
/// vingt-quatre qui telephonaient.
///
/// ---------------------------------------------------------------------------
/// LA REGLE, DANS LES MOTS DE L'UTILISATEUR
/// ---------------------------------------------------------------------------
/// « On ne compte que les vendeurs des tables, mais si un reserviste se retrouve
/// avec un ou plusieurs RDV alors il est compte egalement. » Un reserviste qui a
/// pris des RDV a bien pris part a l'exercice, meme sans table : ses RDV sont au
/// numerateur, il doit etre au denominateur.
///
/// ---------------------------------------------------------------------------
/// POURQUOI ELLE NE PREND PAS LE MODE DE SESSION EN PARAMETRE
/// ---------------------------------------------------------------------------
/// Le mode (`par_site` | `par_table`) vit sur `session_plaque`. Le passer ici
/// obligerait TROIS appelants a le rapatrier et a le rattacher correctement — un
/// calcul de plus a se tromper, dans trois endroits.
///
/// Il est deja derivable de ce qu'on a : UNE PLAQUE FONCTIONNE PAR TABLE DES
/// QU'UN DE SES VENDEURS EST SUR UNE TABLE. Et cette formulation est meilleure
/// que le mode lui-meme sur le seul cas ou les deux divergent : une session
/// declaree `par_table` dont les tables ne sont pas encore construites rendrait
/// un effectif de ZERO — donc une moyenne de zero sur une plaque qui travaille.
/// Ici elle rend tout le monde, ce qui est la reponse sure.
///
/// ---------------------------------------------------------------------------
/// L'EFFET DE BORD, ASSUME ET DECLARE
/// ---------------------------------------------------------------------------
/// L'effectif depend desormais des RDV pour les SEULS reservistes. Archiver le
/// dernier RDV d'un reserviste le fait sortir de l'effectif, et la moyenne MONTE
/// (13,15 -> 13,64 sur CENTRE). C'est contraire a l'esprit du garde-fou
/// `RANK!AG` — un chiffre historique ne devrait pas bouger tout seul — et
/// l'utilisateur l'a maintenu en connaissance de cause, la regle metier primant
/// sur la stabilite du chiffre. Voir `BUGS-CONNUS.md`.
///
/// L'invariant d'origine reste vrai partout ailleurs : en mode par site, et pour
/// tout vendeur affecte a une table, l'effectif ne depend PAS des RDV. C'est ce
/// que le controle « la moyenne suit l'effectif PRESENT » continue de verifier.
export function mobilisation(rdvs: LigneRdv[], vendeurs: LigneVendeur[]): Set<string> {
  // Une plaque fonctionne par table des qu'un de ses vendeurs est sur une table.
  const plaquesParTable = new Set<string>();
  for (const v of vendeurs) if (v.tableId !== null) plaquesParTable.add(v.plaqueId);

  const aSaisi = new Set<string>();
  for (const r of rdvs) aSaisi.add(r.vendeurId);

  const mobilises = new Set<string>();
  for (const v of vendeurs) {
    const sansTableSurLaPlaque = !plaquesParTable.has(v.plaqueId);
    if (sansTableSurLaPlaque || v.tableId !== null || aSaisi.has(v.id)) mobilises.add(v.id);
  }
  return mobilises;
}

/// Totaux sur un axe (F-D.1, F-D.3).
///
/// L'ordre de rendu est celui de la premiere apparition dans `vendeurs` : la
/// couche d'appel trie les vendeurs, donc l'ordre est celui qu'elle a choisi.
/// Pour un ordre par valeur, passer le resultat a `classer`.
export function totauxPar(axe: Axe, rdvs: LigneRdv[], vendeurs: LigneVendeur[]): Totaux[] {
  const paniers = new Map<string, Totaux>();
  const mobilises = mobilisation(rdvs, vendeurs);

  // Les paniers d'abord, depuis les VENDEURS. C'est ce qui garantit qu'un vendeur,
  // un site ou une table a 0 RDV figure quand meme au resultat.
  //
  // UN RESERVISTE CREE SON PANIER SANS ENTRER DANS L'EFFECTIF. Les deux choses
  // sont distinctes et doivent le rester : il doit FIGURER au classement — c'est
  // le defaut de `schema.sql`, ou un vendeur a 0 RDV disparaissait sans erreur —
  // mais il ne doit pas DILUER la moyenne de ceux qui telephonaient.
  for (const v of vendeurs) {
    const { cle, libelle } = rattachement(v, axe);
    const compte = mobilises.has(v.id) ? 1 : 0;
    const existant = paniers.get(cle);
    if (existant) existant.effectif += compte;
    else {
      paniers.set(cle, {
        cle,
        libelle,
        total: 0,
        vn: 0,
        vo: 0,
        parMarque: {},
        effectif: compte,
        moyenne: 0,
      });
    }
  }

  const panierDuVendeur = new Map<string, string>();
  for (const v of vendeurs) panierDuVendeur.set(v.id, rattachement(v, axe).cle);

  for (const r of rdvs) {
    const cle = panierDuVendeur.get(r.vendeurId);
    // Un RDV dont le vendeur n'est pas dans la liste est IGNORE, jamais range
    // ailleurs. Le cas normal : un vendeur sorti avant la campagne, exclu par
    // `presenceVendeur`. Le compter dans un panier « divers » ferait un total
    // juste et une ventilation fausse.
    if (cle === undefined) continue;
    const panier = paniers.get(cle);
    if (!panier) continue;

    panier.total++;
    if (r.typeVehicule === 'VN') panier.vn++;
    else panier.vo++;
    const cleMarque = r.marqueId ?? SANS_MARQUE;
    panier.parMarque[cleMarque] = (panier.parMarque[cleMarque] ?? 0) + 1;
  }

  for (const p of paniers.values()) {
    p.moyenne = p.effectif > 0 ? arrondi(p.total / p.effectif) : 0;
  }

  return [...paniers.values()];
}

export interface TotalJour {
  jour: string;
  total: number;
  vn: number;
  vo: number;
}

/// Totaux par jour de campagne — la ligne 2 des onglets site du fichier
/// (52 / 49 / 42 / 38 / 37 pour Clermont en juin).
///
/// `jours` est la liste ORDONNEE des jours de la campagne, telle que
/// `campagne_jour` la porte. Les jours a zero sont rendus : un jour sans RDV est
/// une information, son absence de la liste serait un trou.
///
/// Les jours d'une campagne sont libres — ni consecutifs, ni au nombre de cinq,
/// ni limites aux jours ouvres. Juin 2026 comportait un dimanche, verifie.
export function totauxParJour(rdvs: LigneRdv[], jours: string[], vendeurs: LigneVendeur[]): TotalJour[] {
  const connus = new Set(vendeurs.map((v) => v.id));
  const parJour = new Map<string, TotalJour>(
    jours.map((jour) => [jour, { jour, total: 0, vn: 0, vo: 0 }])
  );

  for (const r of rdvs) {
    if (!connus.has(r.vendeurId)) continue;
    const j = parJour.get(r.jour);
    // Un RDV hors des jours de la campagne n'est pas rattache d'office au premier
    // jour : ce serait inventer une donnee. R-A.2 empeche ce cas d'exister, et
    // s'il survient il doit se voir comme un ecart, pas se fondre dans un total.
    if (!j) continue;
    j.total++;
    if (r.typeVehicule === 'VN') j.vn++;
    else j.vo++;
  }

  return jours.map((jour) => parJour.get(jour)!);
}

// ---------------------------------------------------------------- classements

export const CRITERES = ['global', 'vn', 'vo'] as const;
export type Critere = (typeof CRITERES)[number];

export interface Rang extends Totaux {
  rang: number;
  /// `true` quand une autre entree porte la MEME valeur sur le critere de
  /// classement. L'ordre entre elles est stable et documente, mais il est
  /// arbitraire : le signaler evite qu'un chef lise une hierarchie qui n'existe
  /// pas entre deux concessions a egalite.
  exAequo: boolean;
}

const valeur = (t: Totaux, critere: Critere) =>
  critere === 'global' ? t.total : critere === 'vn' ? t.vn : t.vo;

/// Classement (F-D.2) avec DEPARTAGE DES EX AEQUO DETERMINISTE ET DOCUMENTE
/// (F-D.4), dans cet ordre exact :
///
///   1. la valeur du critere, decroissante ;
///   2. le total general, decroissant ;
///   3. le nombre de VN, decroissant ;
///   4. le libelle, croissant, accents ignores ;
///   5. la clé, croissante — garantit un ordre TOTAL : deux entrees ne peuvent
///      pas rester indiscernables, meme homonymes.
///
/// Jamais l'astuce du fichier source, `valeur - ROW()/1000000`, qui produisait
/// les `19.999998` de l'onglet RANK : elle depend de la POSITION de la ligne dans
/// la feuille, donc inserer un vendeur reclassait des gens sans que rien ne
/// change dans leurs chiffres.
export function classer(totaux: Totaux[], critere: Critere = 'global'): Rang[] {
  const trie = [...totaux].sort((a, b) => {
    const va = valeur(a, critere);
    const vb = valeur(b, critere);
    if (va !== vb) return vb - va;
    if (a.total !== b.total) return b.total - a.total;
    if (a.vn !== b.vn) return b.vn - a.vn;
    const la = cleTri(a.libelle);
    const lb = cleTri(b.libelle);
    if (la !== lb) return la < lb ? -1 : 1;
    return a.cle < b.cle ? -1 : a.cle > b.cle ? 1 : 0;
  });

  const occurrences = new Map<number, number>();
  for (const t of trie) {
    const v = valeur(t, critere);
    occurrences.set(v, (occurrences.get(v) ?? 0) + 1);
  }

  return trie.map((t, i) => ({
    ...t,
    rang: i + 1,
    exAequo: (occurrences.get(valeur(t, critere)) ?? 0) > 1,
  }));
}

// ---------------------------------------------------------------- comparaison

export interface Ecart {
  cle: string;
  libelle: string;
  total: number;
  totalAnterieur: number;
  ecart: number;
  /// Variation en pourcentage, arrondie au centieme. `null` quand la campagne
  /// anterieure est a zero : une progression depuis zero n'est pas un
  /// pourcentage, et afficher « +Infini % » serait pire que ne rien afficher.
  variation: number | null;
}

/// Comparaison a une campagne anterieure (F-D.5). Remplace le « mars : 351 »
/// ecrit a la main dans l'onglet SUIVI du fichier.
///
/// L'union des deux cotes, pas l'intersection : un site ouvert depuis, ou fermé
/// depuis, doit apparaitre. Le faire disparaitre serait perdre precisement
/// l'information qu'on cherche.
export function comparer(courants: Totaux[], anterieurs: Totaux[]): Ecart[] {
  const avant = new Map(anterieurs.map((t) => [t.cle, t]));
  const resultat: Ecart[] = [];

  for (const t of courants) {
    const a = avant.get(t.cle);
    const totalAnterieur = a?.total ?? 0;
    resultat.push({
      cle: t.cle,
      libelle: t.libelle,
      total: t.total,
      totalAnterieur,
      ecart: t.total - totalAnterieur,
      variation: totalAnterieur > 0 ? arrondi(((t.total - totalAnterieur) / totalAnterieur) * 100) : null,
    });
  }

  // Ce qui existait avant et plus maintenant.
  const maintenant = new Set(courants.map((t) => t.cle));
  for (const a of anterieurs) {
    if (maintenant.has(a.cle)) continue;
    resultat.push({
      cle: a.cle,
      libelle: a.libelle,
      total: 0,
      totalAnterieur: a.total,
      ecart: -a.total,
      variation: a.total > 0 ? -100 : null,
    });
  }

  return resultat;
}
