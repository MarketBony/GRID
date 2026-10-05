// ============================================================================
// LE TABLEAU DES VENTES — rapprochement du tableau VPP / VD / VO de l'equipe
// (05/10/2026).
//
// MEME STATUT QUE `agregats.ts` et `suivi.ts` : fonctions PURES, servies au
// navigateur, demontrees par `test:suivi`. Rien n'est stocke (interdit n.2) : la
// vue `relance.vente` rend une ligne par commande, tout se compte ici.
//
// Les regles, arretees par l'utilisateur :
//   - une VENTE = un RDV qualifie « commande » dans le Suivi, phoning ET trafic
//     naturel, comptee au JOUR DU RDV ;
//   - VO   : tout RDV VO ;
//   - VD   : un RDV VN dont la commande est un STOCK marque « vehicule de
//            demonstration » ;
//   - VPP  : tout autre RDV VN (vehicule particulier) ;
//   - DIAC : la case DIAC de la commande.
// ============================================================================

export const CATEGORIES_VENTE = ['VPP', 'VD', 'VO'] as const;
export type CategorieVente = (typeof CATEGORIES_VENTE)[number];

export interface LigneVente {
  siteId: string;
  marqueId: string | null;
  jour: string;
  typeVehicule: 'VN' | 'VO';
  diac: boolean;
  vd: boolean;
}

export const categorieVente = (l: Pick<LigneVente, 'typeVehicule' | 'vd'>): CategorieVente =>
  l.typeVehicule === 'VO' ? 'VO' : l.vd ? 'VD' : 'VPP';

export interface Cellule {
  ventes: number;
  diac: number;
}

export interface TableauVentes {
  /// Par site, puis par jour. Un site sans vente n'y figure pas : l'ecran pose
  /// lui-meme la liste des sites (un site a zero vente reste une ligne).
  sites: Map<string, { total: Cellule; jours: Map<string, Cellule> }>;
  jours: Map<string, Cellule>;
  total: Cellule;
}

const vide = (): Cellule => ({ ventes: 0, diac: 0 });
const ajouter = (c: Cellule, l: LigneVente) => {
  c.ventes++;
  if (l.diac) c.diac++;
};

/// Les ventes d'une categorie, d'une marque si `marqueId` est donne (sinon toutes
/// marques confondues : « cumul VPP », VO).
export function tableauVentes(
  lignes: LigneVente[],
  critere: { categorie: CategorieVente; marqueId?: string }
): TableauVentes {
  const t: TableauVentes = { sites: new Map(), jours: new Map(), total: vide() };
  for (const l of lignes) {
    if (categorieVente(l) !== critere.categorie) continue;
    if (critere.marqueId !== undefined && l.marqueId !== critere.marqueId) continue;
    let s = t.sites.get(l.siteId);
    if (!s) t.sites.set(l.siteId, (s = { total: vide(), jours: new Map() }));
    ajouter(s.total, l);
    if (!s.jours.has(l.jour)) s.jours.set(l.jour, vide());
    ajouter(s.jours.get(l.jour)!, l);
    if (!t.jours.has(l.jour)) t.jours.set(l.jour, vide());
    ajouter(t.jours.get(l.jour)!, l);
    ajouter(t.total, l);
  }
  return t;
}

/// Un rapport entre 0 et +inf, ou `null` quand la reference est nulle ou absente :
/// « 3 ventes contre 0 l'an dernier » n'est pas un pourcentage, et l'afficher en
/// « 0 % » ou « +inf » serait une affirmation, pas une mesure.
export const rapport = (valeur: number, reference: number | null | undefined): number | null =>
  reference === null || reference === undefined || reference === 0 ? null : valeur / reference;
