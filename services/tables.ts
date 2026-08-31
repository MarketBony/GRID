import { apiGet, apiPatch, apiPost, apiPut } from './api';
import type { TypeVehicule } from '../types';

// ============================================================================
// MODULE B — constructeur de tables.
//
// Les tables sont un SUPPLEMENT, pas le mode normal : deux plaques sur quatre
// n'avaient aucune table en juin 2026, et le perimetre par defaut est le site.
// L'ecran n'est donc propose que pour une session en mode `par_table`.
// ============================================================================

export interface VendeurTable {
  id: string;
  nom: string;
  typeVehicule: TypeVehicule;
  siteId: string;
  siteCode: string;
  siteLibelle: string;
  /// Vide pour un vendeur VO — le fichier source ne les ventile pas par marque.
  marqueIds: string[];
}

export interface TablePhoning {
  id: string;
  libelle: string;
  ordre: number;
  chefUtilisateurId: string | null;
  chefNom: string | null;
  /// SPECIALISATION DECLAREE. `null` = table mixte, aucune contrainte de marque —
  /// c'est le cas normal, et le seul observe en juin 2026.
  marqueId: string | null;
  marqueLibelle: string | null;
  membres: VendeurTable[];
  effectif: number;
  /// F-B.6. `null` quand aucune cible n'est definie sur la session : pas de
  /// cible, pas d'alerte — et surtout pas une alerte a zero.
  ecartCible: number | null;
  /// Nombre d'affectations posees par la repartition automatique, pour distinguer
  /// ce qui a ete decide a la main.
  posesAuto: number;
}

export interface PerimetreTables {
  session: {
    id: string;
    campagneId: string;
    campagneLibelle: string;
    cloturee: boolean;
    plaqueId: string;
    plaqueLibelle: string;
    mode: string;
    effectifCibleTable: number | null;
  };
  tables: TablePhoning[];
  /// Les vendeurs de la plaque qu'aucune table ne porte. Ce n'est pas un
  /// reliquat : F-B.8 dit qu'ils restent saisissables par leur chef de site.
  reserve: VendeurTable[];
  marques: { id: string; code: string; libelle: string }[];
  /// LES ENCADRANTS, TOUS SITES CONFONDUS — et c'est le point essentiel.
  ///
  /// L'exercice consiste a composer des groupes heterogenes : cinq vendeurs de
  /// cinq concessions, coaches par un chef de vente venu d'une SIXIEME. Restreindre
  /// cette liste aux encadrants de la plaque rendrait l'exercice inexprimable.
  chefsPossibles: {
    id: string;
    nom: string;
    loginId: string;
    /// Ce qu'il encadre deja : « chef de vente VN — CLF ». C'est l'information qui
    /// compte au moment de composer, parce qu'elle dit d'ou vient le coach.
    encadrements: { role: string; siteCode: string }[];
    /// `true` s'il encadre au moins un site de cette plaque. Ordre d'affichage
    /// seulement, jamais un refus.
    deLaPlaque: boolean;
    rolesGlobaux: string[];
  }[];
}

export const chargerTables = (sessionId: string) =>
  apiGet<PerimetreTables>(`/api/tables/session/${sessionId}`);

export const creerTable = (sessionId: string, libelle: string, marqueId?: string | null) =>
  apiPost<{ id: string; libelle: string; ordre: number; marqueId: string | null; reactivee: boolean }>(
    `/api/tables/session/${sessionId}`,
    { libelle, marqueId: marqueId ?? null }
  );

export const modifierTable = (
  tableId: string,
  champs: { libelle?: string; chefUtilisateurId?: string | null; marqueId?: string | null; ordre?: number }
) => apiPatch<TablePhoning>(`/api/tables/${tableId}`, champs);

/// F-B.1 dit « supprimer ». Interdit n.1 : on ARCHIVE. Les membres reviennent en
/// reserve et restent saisissables par leur chef de site.
export const archiverTable = (tableId: string) =>
  apiPost<{ archivee: string; affectationsArchivees: number; message: string }>(
    `/api/tables/${tableId}/archiver`
  );

/// F-B.3. Remplace la composition. Un vendeur retire revient en reserve.
export const definirMembres = (tableId: string, vendeurIds: string[]) =>
  apiPut<{ retires: number; effectif: number }>(`/api/tables/${tableId}/vendeurs`, { vendeurIds });

export interface ResultatRepartition {
  graine: number;
  remplacer: boolean;
  placements: { tableId: string; libelle: string; vendeurIdsAjoutes: string[]; effectif: number }[];
  nonPlaces: { vendeurId: string; nom: string; raison: string }[];
  dejaEnPlace: number;
  message: string;
}

/// F-B.5, graine 42. `remplacer` REFAIT la composition entiere : c'est derriere
/// un drapeau explicite parce que ca archive un travail manuel.
export const repartirAuto = (sessionId: string, remplacer: boolean) =>
  apiPost<ResultatRepartition>(`/api/tables/session/${sessionId}/repartition-auto`, { remplacer });

export interface ResultatReprise {
  depuis: string;
  tablesCreees: number;
  tablesReprises: number;
  affectationsReprises: number;
  reportes: { nom: string; raison: string }[];
  message: string;
}

/// F-B.7. Ce qui ne peut pas suivre est REPORTE, jamais force.
export const reprendreComposition = (sessionId: string, depuisCampagneId: string) =>
  apiPost<ResultatReprise>(`/api/tables/session/${sessionId}/reprendre`, { depuisCampagneId });
