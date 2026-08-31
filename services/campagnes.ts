import { apiGet, apiPatch, apiPut } from './api';

export interface CampagneResume {
  id: string;
  libelle: string;
  dateDebut: string;
  dateFin: string;
  cloturee: boolean;
  /// Nombre de vendeurs que L'APPELANT peut saisir sur cette campagne. Zero =
  /// aucun perimetre : les droits sont donnes par campagne, etre chef de table en
  /// juin n'en donne aucun en septembre.
  vendeursSaisissables: number;
}

export interface JourCampagne {
  jour: string;
  ordre: number;
}

export interface CreneauCampagne {
  code: string;
  libelle: string;
  ordre: number;
}

export interface SessionCampagne {
  id: string;
  plaqueId: string;
  plaqueLibelle: string;
  mode: string;
  effectifCibleTable: number | null;
}

export interface CampagneDetail extends CampagneResume {
  jours: JourCampagne[];
  creneaux: CreneauCampagne[];
  sessions: SessionCampagne[];
}

/// Detail de l'impact d'un retrait de jour ou de creneau (R-A.2).
/// `archives` est compte SEPAREMENT : la cle etrangere porte sur tous les RDV,
/// archives compris, donc ils empechent aussi la suppression — mais annoncer
/// « 4 RDV » quand 3 sont actifs et 1 archive serait trompeur.
export interface ImpactJour {
  jour: string;
  actifs: number;
  archives: number;
  vendeurs: string[];
}

export interface ImpactCreneau {
  creneau: string;
  actifs: number;
  archives: number;
  vendeurs: string[];
}

export interface ConflitRdv<T> {
  code: 'RDV_IMPACTES';
  message: string;
  retires: string[];
  ajoutes: string[];
  impacts: T[];
  joursConserves?: string[];
  creneauxConserves?: string[];
}

export type Confirmation = { mode: 'annuler' } | { mode: 'deplacer'; vers: string };

export const chargerCampagnes = () => apiGet<CampagneResume[]>('/api/campagnes');
export const chargerCampagne = (id: string) => apiGet<CampagneDetail>(`/api/campagnes/${id}`);

export const modifierCampagne = (
  id: string,
  champs: Partial<Pick<CampagneResume, 'libelle' | 'dateDebut' | 'dateFin' | 'cloturee'>>
) => apiPatch<CampagneResume>(`/api/campagnes/${id}`, champs);

export const enregistrerJours = (id: string, jours: string[], confirmation?: Confirmation) =>
  apiPut<{ jours: JourCampagne[]; rdvDeplaces: number }>(`/api/campagnes/${id}/jours`, {
    jours,
    confirmation,
  });

export const enregistrerCreneaux = (
  id: string,
  creneaux: { code: string; libelle: string }[],
  confirmation?: Confirmation
) =>
  apiPut<{ creneaux: CreneauCampagne[]; rdvDeplaces: number }>(`/api/campagnes/${id}/creneaux`, {
    creneaux,
    confirmation,
  });

export const modifierSession = (
  campagneId: string,
  sessionId: string,
  champs: { mode?: string; effectifCibleTable?: number | null }
) => apiPatch<SessionCampagne>(`/api/campagnes/${campagneId}/sessions/${sessionId}`, champs);
