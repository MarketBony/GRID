import { apiGet, apiPatch, apiPost } from './api';

/// Une section de la grille d'un vendeur : une par marque autorisee s'il est VN,
/// une seule sans marque s'il est VO. C'est le SERVEUR qui la calcule, pas le
/// front — la regle vient du fichier source et n'a rien a faire dans l'interface.
export interface SectionVendeur {
  marqueId: string | null;
  libelle: string;
}

export interface VendeurSaisie {
  id: string;
  nom: string;
  typeVehicule: 'VN' | 'VO';
  siteId: string;
  siteCode: string;
  siteLibelle: string;
  sections: SectionVendeur[];
}

export interface RdvSaisie {
  id: string;
  vendeurId: string;
  jour: string;
  creneauCode: string;
  marqueId: string | null;
  typeVehicule: string;
  client: string;
  commentaire: string | null;
}

export interface PerimetreSaisie {
  campagne: {
    id: string;
    libelle: string;
    cloturee: boolean;
    jours: { jour: string; ordre: number }[];
    creneaux: { code: string; libelle: string; ordre: number }[];
  };
  perimetre: {
    type: 'table' | 'site' | 'global';
    libelle: string;
    /// La plaque du perimetre quand il n'en couvre QU'UNE. `null` pour un admin
    /// qui voit tout le groupe : les panneaux live n'ont alors aucune plaque a
    /// privilegier.
    plaqueId: string | null;
    /// La table animee, quand il y en a exactement une.
    tableId: string | null;
  } | null;
  vendeurs: VendeurSaisie[];
  rdvs: RdvSaisie[];
  message?: string;
}

/// Compteurs d'un vendeur. `parMarque` est indexe par identifiant de marque, et
/// par `sansMarque` pour un vendeur VO.
export interface Compteurs {
  vendeurId: string;
  total: number;
  parMarque: Record<string, number>;
}

/// TOUT le perimetre en UN appel : cliquer un nom doit ouvrir son planning sans
/// aller chercher quoi que ce soit (F-C.1).
export const chargerSaisie = (campagneId: string) =>
  apiGet<PerimetreSaisie>(`/api/saisie/${campagneId}`);

export const poserRdv = (corps: {
  campagneId: string;
  vendeurId: string;
  jour: string;
  creneauCode: string;
  marqueId: string | null;
  client: string;
}) => apiPost<{ rdv: RdvSaisie; compteurs: Compteurs }>('/api/rdv', corps);

export const modifierRdv = (id: string, client: string) =>
  apiPatch<{ rdv: RdvSaisie }>(`/api/rdv/${id}`, { client });

export const archiverRdv = (id: string) =>
  apiPost<{ archive?: boolean; dejaArchive?: boolean; compteurs: Compteurs }>(
    `/api/rdv/${id}/archiver`
  );
