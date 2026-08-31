import { apiGet } from './api';

// ============================================================================
// MODULE D — dashboard, et panneaux live du module C.
//
// UNE SEULE ROUTE pour tous les axes : l'ecran bascule d'un axe a l'autre sans
// aller-retour, et le rafraichissement automatique (F-D.8) ne declenche qu'une
// requete par cycle plutot que cinq.
//
// Aucun calcul cote front. Tous ces chiffres viennent de `utils/agregats.ts`,
// verifie contre les 1107 RDV reels de juin 2026 — recalculer ici creerait un
// second endroit ou la regle vit.
// ============================================================================

export const AXES = ['vendeur', 'site', 'plaque', 'table', 'groupe'] as const;
export type Axe = (typeof AXES)[number];

export interface Totaux {
  cle: string;
  libelle: string;
  total: number;
  vn: number;
  vo: number;
  /// `marqueId` -> nombre de RDV. Les RDV d'un vendeur VO sont sous `sansMarque`.
  parMarque: Record<string, number>;
  /// Effectif CALCULE, jamais saisi (F-D.3) : les vendeurs presents pendant la
  /// campagne.
  effectif: number;
  moyenne: number;
}

export interface Rang extends Totaux {
  rang: number;
  /// `true` quand une autre entree porte la meme valeur sur le critere. L'ordre
  /// entre elles est stable et documente, mais arbitraire : le signaler evite de
  /// lire une hierarchie qui n'existe pas.
  exAequo: boolean;
}

export interface TotalJour {
  jour: string;
  total: number;
  vn: number;
  vo: number;
}

export interface Dashboard {
  campagne: {
    id: string;
    libelle: string;
    dateDebut: string;
    dateFin: string;
    cloturee: boolean;
    jours: string[];
  };
  /// F-D.6 : l'ecran montre les tables quand la session est en `par_table`, les
  /// sites sinon. Le mode appartient a la SESSION, pas a la plaque.
  sessions: {
    id: string;
    plaqueId: string;
    plaqueLibelle: string;
    mode: string;
    effectifCibleTable: number | null;
  }[];
  /// Qui appartient a qui. Les fonctions d'agregat sont PURES et rendent des
  /// paniers par clé sans savoir qui les contient : c'est la route qui expose les
  /// liens, pour que les panneaux du module C filtrent sur « ma plaque » sans les
  /// recalculer.
  rattachements: {
    siteVersPlaque: Record<string, string>;
    tableVersPlaque: Record<string, string>;
  };
  totaux: Record<Axe, Totaux[]>;
  /// Les trois classements de l'onglet RANK.
  classementsSites: { global: Rang[]; vn: Rang[]; vo: Rang[] };
  classementVendeurs: Rang[];
  classementTables: Rang[];
  parJour: TotalJour[];
}

export const chargerDashboard = (campagneId: string) =>
  apiGet<Dashboard>(`/api/dashboard/${campagneId}`);

export interface Ecart {
  cle: string;
  libelle: string;
  total: number;
  totalAnterieur: number;
  ecart: number;
  /// `null` quand la campagne anterieure est a zero : une progression depuis zero
  /// n'est pas un pourcentage.
  variation: number | null;
}

export interface Comparaison {
  axe: Axe;
  courante: { id: string; libelle: string };
  anterieure: { id: string; libelle: string };
  ecarts: Ecart[];
}

/// F-D.5. Remplace le « mars : 351 » ecrit a la main dans l'onglet SUIVI.
export const chargerComparaison = (campagneId: string, autreId: string, axe: Axe = 'site') =>
  apiGet<Comparaison>(`/api/dashboard/${campagneId}/comparaison/${autreId}?axe=${axe}`);
