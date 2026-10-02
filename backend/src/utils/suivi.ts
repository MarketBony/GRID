import { cleTri } from './tri';
import type { IssueSuivi, SourceRdv } from '../auth/roles';

// ============================================================================
// LES INDICATEURS DU SUIVI DES RDV — rubrique « Suivi des RDV » (lot 6 de
// PLAN-GRID-V2.md).
//
// MEME STATUT QUE `agregats.ts` : fonctions PURES, servies au navigateur tel quel
// (le `tsconfig` du front les inclut), et demontrees par `test:suivi` contre le
// fichier de suivi de juin que l'utilisateur tenait a la main — 342 RDV,
// 236 traites, 119 commandes, 50,4 %. Aucun indicateur n'est stocke en base
// (interdit n.2) : tout se recalcule a la lecture.
//
// CE QUI EST CORRIGE PAR RAPPORT AU FICHIER, et que les tests disent :
//   - le fichier compte comme COMMANDE tout resultat qui n'est ni offre, ni
//     annule, ni clos : une faute de frappe devient une commande. Ici l'issue est
//     un choix explicite ;
//   - DIAC, STOCK et CS se recouvrent (« DIAC+STOCK+CS ») : le fichier les
//     additionne comme s'ils etaient exclusifs. Ici on les compte chacun, et le
//     libelle le dit (« dont N avec DIAC ») ;
//   - le departage des ex aequo du classement etait la position dans l'onglet
//     (`(20 - n) / 10000`). Ici il est documente et deterministe.
// ============================================================================

export interface LigneSuivi {
  vendeurId: string;
  vendeurNom: string;
  siteId: string;
  siteLibelle: string;
  source: SourceRdv;
  /// `null` = a traiter.
  issue: IssueSuivi | null;
  diac: boolean;
  stock: boolean;
  cs: boolean;
}

/// Une commande SECHE est une commande sans aucun avantage : ni DIAC, ni CS, ni
/// STOCK (D8, arbitre par l'utilisateur le 03/10/2026). Une commande STOCK n'est
/// pas seche : le vehicule en stock EST l'avantage. Elle se DEDUIT, elle ne se
/// coche pas — il n'existe donc aucun moyen de la rendre incoherente.
export const estSeche = (l: Pick<LigneSuivi, 'issue' | 'diac' | 'stock' | 'cs'>): boolean =>
  l.issue === 'commande' && !l.diac && !l.stock && !l.cs;

export interface Indicateurs {
  planifies: number;
  traites: number;
  aTraiter: number;
  commandes: number;
  offres: number;
  annules: number;
  clos: number;
  /// Parmi les commandes. Se recouvrent : une commande DIAC+CS compte dans les deux.
  avecDiac: number;
  avecStock: number;
  avecCs: number;
  seches: number;
  /// Commandes / traites, entre 0 et 1. `null` quand rien n'est traite : un taux
  /// de 0 % sur zero RDV serait une affirmation, pas une mesure.
  tauxTransformation: number | null;
}

export function indicateurs(lignes: LigneSuivi[]): Indicateurs {
  const r: Indicateurs = {
    planifies: lignes.length,
    traites: 0,
    aTraiter: 0,
    commandes: 0,
    offres: 0,
    annules: 0,
    clos: 0,
    avecDiac: 0,
    avecStock: 0,
    avecCs: 0,
    seches: 0,
    tauxTransformation: null,
  };
  for (const l of lignes) {
    if (l.issue === null) {
      r.aTraiter++;
      continue;
    }
    r.traites++;
    if (l.issue === 'commande') {
      r.commandes++;
      if (l.diac) r.avecDiac++;
      if (l.stock) r.avecStock++;
      if (l.cs) r.avecCs++;
      if (estSeche(l)) r.seches++;
    } else if (l.issue === 'offre_en_cours') r.offres++;
    else if (l.issue === 'annule') r.annules++;
    else if (l.issue === 'clos_sans_suite') r.clos++;
  }
  r.tauxTransformation = r.traites === 0 ? null : r.commandes / r.traites;
  return r;
}

export const AXES_SUIVI = ['source', 'site', 'vendeur'] as const;
export type AxeSuivi = (typeof AXES_SUIVI)[number];

export interface IndicateursGroupe extends Indicateurs {
  cle: string;
  libelle: string;
}

/// Les indicateurs ventiles par source, par site ou par vendeur. Un groupe sans
/// aucun RDV n'apparait pas : il n'y a rien a en dire.
export function indicateursPar(axe: AxeSuivi, lignes: LigneSuivi[]): IndicateursGroupe[] {
  const groupes = new Map<string, { libelle: string; lignes: LigneSuivi[] }>();
  for (const l of lignes) {
    const [cle, libelle] =
      axe === 'source'
        ? [l.source, l.source === 'showroom' ? 'Trafic naturel' : 'Phoning']
        : axe === 'site'
          ? [l.siteId, l.siteLibelle]
          : [l.vendeurId, l.vendeurNom];
    const g = groupes.get(cle) ?? { libelle, lignes: [] };
    g.lignes.push(l);
    groupes.set(cle, g);
  }
  return [...groupes.entries()].map(([cle, g]) => ({ cle, libelle: g.libelle, ...indicateurs(g.lignes) }));
}

/// LE CLASSEMENT DES VENDEURS AUX COMMANDES. Departage des ex aequo, dans l'ordre :
///   1. plus de commandes ;
///   2. meilleur taux de transformation (un vendeur qui a converti 5 sur 6 passe
///      devant celui qui a converti 5 sur 20) ;
///   3. moins de RDV encore a traiter (le classement est plus sur pour lui) ;
///   4. ordre alphabetique du nom, insensible aux accents — dernier recours,
///      arbitraire mais STABLE et lisible, ce que la position dans un onglet
///      n'etait pas.
/// Deux vendeurs vraiment ex aequo sur 1 a 3 partagent le meme rang.
export interface RangSuivi extends IndicateursGroupe {
  rang: number;
}

export function classementCommandes(lignes: LigneSuivi[]): RangSuivi[] {
  const taux = (g: IndicateursGroupe) => g.tauxTransformation ?? -1;
  const tries = indicateursPar('vendeur', lignes).sort(
    (a, b) =>
      b.commandes - a.commandes ||
      taux(b) - taux(a) ||
      a.aTraiter - b.aTraiter ||
      cleTri(a.libelle).localeCompare(cleTri(b.libelle))
  );
  const rangs: RangSuivi[] = [];
  tries.forEach((g, i) => {
    const precedent = rangs[i - 1];
    const exAequo =
      precedent &&
      precedent.commandes === g.commandes &&
      taux(precedent) === taux(g) &&
      precedent.aTraiter === g.aTraiter;
    rangs.push({ ...g, rang: exAequo ? precedent.rang : i + 1 });
  });
  return rangs;
}
