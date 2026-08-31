// ============================================================================
// TYPES PARTAGES DU FRONT.
//
// TOUS LES IDENTIFIANTS SONT DES CHAINES. Les cles primaires sont des `bigint`
// en base ; l'API les serialise en chaine (voir `backend/src/utils/json.ts`),
// parce qu'au-dela de 2^53 un nombre JavaScript perd des unites en silence.
// Ne jamais comparer un id a un nombre litteral, ne jamais faire d'arithmetique
// dessus.
//
// CE FICHIER NE CONTIENT AUCUN REFERENTIEL. Plaques, sites, vendeurs, marques,
// jours et creneaux viennent de l'API (interdit n.3). C'est la difference avec
// GEARBOX, dont `constants.ts` porte une carte des plaques en dur, dupliquee cote
// backend, avec un script de synchronisation pour contenir la derive.
// ============================================================================

export interface Utilisateur {
  id: string;
  loginId: string;
  nom: string;
  actif: boolean;
}

/// Resume des droits, POUR L'AFFICHAGE UNIQUEMENT. Il ne fait autorite sur rien :
/// chaque appel est revalide par le portail cote serveur. Cacher un bouton n'est
/// pas une securite (interdit n.5).
export interface Droits {
  /// Gestion des COMPTES. C'est la seule chose que `direction` ne peut pas faire.
  admin: boolean;
  direction: boolean;
  /// `admin || direction` — ce que l'ecran doit regarder pour proposer les ecrans
  /// d'administration. Calcule par le serveur : le front ne recompose pas la
  /// regle.
  administre: boolean;
  gereUtilisateurs: boolean;
  lecteur: boolean;
  /// Sites encadres, toutes campagnes confondues.
  sitesEncadres: string[];
  /// campagneId -> plaqueIds
  plaquesParCampagne: Record<string, string[]>;
  /// campagneId -> siteIds
  sitesParCampagne: Record<string, string[]>;
  /// campagneId -> tableIds
  tablesParCampagne: Record<string, string[]>;
}

export interface Session {
  utilisateur: Utilisateur;
  droits: Droits;
}

export interface Plaque {
  id: string;
  libelle: string;
  alias: string | null;
  ordre: number;
}

export interface Site {
  id: string;
  code: string;
  libelle: string;
  plaqueId: string;
}

export interface Marque {
  id: string;
  code: string;
  libelle: string;
  ordre: number;
}

/// La forme complete d'un vendeur telle que l'API la renvoie vit dans
/// `services/referentiels.ts` (`VendeurReferentiel`), au plus pres de l'appel qui
/// la produit. Ce type-ci ne sert qu'aux ecrans qui n'ont besoin que de l'identite.
export interface VendeurIdentite {
  id: string;
  nom: string;
  siteId: string;
  chefDeSite: boolean;
}

export interface Campagne {
  id: string;
  libelle: string;
  dateDebut: string;
  dateFin: string;
  cloturee: boolean;
}

export interface CampagneJour {
  jour: string;
  ordre: number;
}

export interface CampagneCreneau {
  code: string;
  libelle: string;
  ordre: number;
}

export type TypeVehicule = 'VN' | 'VO';
