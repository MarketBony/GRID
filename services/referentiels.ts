import { apiDelete, apiGet, apiPatch, apiPost } from './api';
import type { Marque, Plaque, Site, TypeVehicule } from '../types';

/// Reponse de `GET /api/referentiels`. Le front ne code AUCUNE de ces valeurs en
/// dur : ni les plaques, ni les sites, ni les marques, ni meme VN/VO ou les modes
/// de session (interdit n.3).
export interface Referentiels {
  plaques: Plaque[];
  sites: Site[];
  marques: Marque[];
  vendeurs: VendeurReferentiel[];
  /// L'ENCADREMENT DE CHAQUE SITE. Les encadrants sont des COMPTES, pas des
  /// vendeurs : c'est ce qui permet a un chef de vente de Clermont d'animer une
  /// table de Villefranche.
  encadrements: {
    id: string;
    siteId: string;
    role: string;
    utilisateurId: string;
    nom: string;
    loginId: string;
  }[];
  /// Les comptes attribuables, TOUS SITES CONFONDUS. Un encadrant peut tenir
  /// plusieurs sites : `encadrements` dit ce qu'il tient deja.
  encadrantsDisponibles: {
    id: string;
    nom: string;
    loginId: string;
    rolesGlobaux: string[];
    encadrements: { role: string; siteCode: string }[];
  }[];
  typesVehicule: TypeVehicule[];
  modesSession: string[];
  /// `chef_de_site`, `chef_de_vente_vn`, `chef_de_vente_vo` — jamais en dur cote
  /// front (interdit n.3).
  rolesEncadrement: string[];
}

export interface VendeurReferentiel {
  id: string;
  nom: string;
  siteId: string;
  dateEntree: string | null;
  dateSortie: string | null;
  /// Vide pour un vendeur VO : le fichier source ne ventile pas les VO par marque.
  marqueIds: string[];
  /// SCALAIRE. C'est le metier du vendeur, un seul, jamais les deux.
  typeVehicule: TypeVehicule;
  /// `null` = en service. Un vendeur ARCHIVE disparait de tous les ecrans, mais
  /// ses RDV restent en base : les totaux des campagnes passees ne bougent pas.
  /// A ne pas confondre avec `dateSortie`, qui dit que la personne a quitte
  /// l'entreprise et borne les effectifs de chaque campagne.
  archiveLe: string | null;
}

export const chargerReferentiels = () => apiGet<Referentiels>('/api/referentiels');

// ---------------------------------------------------------------- archivage
//
// DEUX NIVEAUX, et la distinction est tout le sujet.
//
//   ARCHIVER — la ligne disparait des ecrans, ses RDV RESTENT en base. Les totaux
//   des campagnes passees ne bougent pas d'un iota. Reversible.
//
//   PURGER — destruction definitive, RDV compris. Derriere une seconde porte, sur
//   une liste ou l'on voit ce qu'on detruit.

export interface VendeurArchive extends VendeurReferentiel {
  siteCode: string;
  siteLibelle: string;
  /// Ce qui sera DETRUIT par une purge. Personne ne doit avoir a le deviner.
  nbRdv: number;
  nbAffectations: number;
}

export const chargerArchives = () => apiGet<VendeurArchive[]>('/api/vendeurs/archives');

export const archiverVendeur = (id: string) =>
  apiPost<{ archive: string; nbRdv: number; message: string }>(`/api/vendeurs/${id}/archiver`);

export const desarchiverVendeur = (id: string) =>
  apiPost<{ desarchive: string }>(`/api/vendeurs/${id}/desarchiver`);

/// LA PURGE. `confirmation` doit valoir le nom exact du vendeur : c'est la seule
/// operation du produit qui detruit de l'historique, un clic ne suffit pas.
export const purgerVendeur = (id: string, confirmation: string) =>
  apiDelete<{ purge: string; nbRdv: number; nbAffectations: number; message: string }>(
    `/api/vendeurs/${id}`,
    { confirmation }
  );

// ---------------------------------------------------------------- vendeurs

export interface ChampsVendeur {
  nom?: string;
  siteId?: string;
  dateEntree?: string | null;
  dateSortie?: string | null;
  marqueIds?: string[];
  typeVehicule?: TypeVehicule;
}

export const creerVendeur = (champs: {
  nom: string;
  siteId: string;
  marqueIds: string[];
  typeVehicule: TypeVehicule;
  dateEntree?: string | null;
}) => apiPost<VendeurReferentiel>('/api/vendeurs', champs);

/// Modifie un vendeur. Changer `siteId` le TRANSFERE en conservant tout son
/// historique (F-A3.5) : les RDV ne portent ni site ni plaque, ils pointent le
/// vendeur, donc les totaux des deux sites suivent immediatement.
///
/// Il n'y a AUCUNE suppression : sortir un vendeur, c'est renseigner `dateSortie`.
export const modifierVendeur = (id: string, champs: ChampsVendeur) =>
  apiPatch<VendeurReferentiel>(`/api/vendeurs/${id}`, champs);

// ---------------------------------------------------------------- import

export type LigneApercu =
  | {
      statut: 'resolue';
      numero: number;
      vendeurId: string;
      nomVendeur: string;
      codeSite: string;
      marqueIds: string[];
      marquesLibelles: string[];
      changement: boolean;
    }
  | { statut: 'introuvable'; numero: number; nom: string; codeSite: string | null }
  | {
      statut: 'ambigue';
      numero: number;
      nom: string;
      candidats: { vendeurId: string; codeSite: string }[];
    }
  | { statut: 'marque_inconnue'; numero: number; nom: string; codesInconnus: string[] }
  | { statut: 'sans_marque'; numero: number; nom: string };

export interface Apercu {
  separateur: string;
  enTeteDetecte: boolean;
  format: 'marques_groupees' | 'une_colonne_par_marque';
  lignes: LigneApercu[];
  resume: {
    total: number;
    resolues: number;
    changements: number;
    inchangees: number;
    introuvables: number;
    ambigues: number;
    marquesInconnues: number;
    sansMarque: number;
  };
}

/// Analyse seulement : rien n'est ecrit en base.
export const analyserImport = (contenu: string) =>
  apiPost<Apercu>('/api/vendeurs/capacites/import/analyse', { contenu });

/// Applique EXACTEMENT les lignes transmises. L'API ne rejoue pas l'analyse :
/// c'est ce qui garantit qu'on applique ce que l'utilisateur a vu.
///
/// L'import ne porte que les MARQUES : les types de vehicule des vendeurs
/// concernes sont conserves tels quels, pour ne pas ecraser une donnee deja
/// validee a la main.
export const appliquerImport = (lignes: { vendeurId: string; marqueIds: string[] }[]) =>
  apiPost<{ appliquees: number }>(
    '/api/vendeurs/capacites/import/appliquer',
    { lignes }
  );
