import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from './api';

// ============================================================================
// GESTION DES COMPTES ET DE L'ENCADREMENT — reserve a `admin`.
//
// LES QUATRE PALIERS :
//   `admin`      — tout, y compris cet ecran.
//   `direction`  — tout sauf cet ecran.
//   `lecteur`    — lecture seule.
//   aucun role   — un ENCADRANT. Ses droits viennent de ses rattachements : les
//                  sites qu'il encadre et les tables qu'il anime.
//
// UN ENCADRANT N'EST PAS UN VENDEUR. C'est une personne avec un compte, rattachee
// a un site, et rattachable a une table d'une AUTRE concession — c'est ainsi qu'on
// compose des groupes heterogenes coaches par un chef venu d'ailleurs.
// ============================================================================

export interface EncadrementDuCompte {
  id: string;
  role: string;
  siteId: string;
  siteCode: string;
  siteLibelle: string;
}

export interface TableAnimee {
  id: string;
  libelle: string;
  plaqueLibelle: string;
  campagneLibelle: string;
  campagneCloturee: boolean;
}

export interface Compte {
  id: string;
  loginId: string;
  nom: string;
  actif: boolean;
  archiveLe: string | null;
  creeLe: string;
  /// Vide = ENCADRANT. Un seul role au plus : les paliers sont exclusifs.
  rolesGlobaux: string[];
  sitesEncadres: EncadrementDuCompte[];
  tablesAnimees: TableAnimee[];
  /// Renseigne si ce compte est AUSSI un vendeur.
  vendeur: { id: string; nom: string } | null;
}

export const chargerComptes = () =>
  apiGet<{ comptes: Compte[]; rolesGlobaux: string[] }>('/api/utilisateurs');

/// `roleGlobal` a `null` cree un ENCADRANT, le cas majoritaire.
///
/// Le mot de passe revient en clair dans la reponse — la SEULE fois. Il n'est ni
/// journalise ni stocke autrement que hache : personne ne pourra le relire.
export const creerCompte = (champs: {
  nom: string;
  loginId: string;
  roleGlobal: string | null;
  motDePasse?: string;
}) => apiPost<{ compte: Compte; motDePasse: string; genere: boolean }>('/api/utilisateurs', champs);

export const modifierCompte = (
  id: string,
  champs: { nom?: string; roleGlobal?: string | null; actif?: boolean }
) => apiPatch<Compte>(`/api/utilisateurs/${id}`, champs);

export const reinitialiserMotDePasse = (id: string, motDePasse?: string) =>
  apiPost<{ nom: string; motDePasse: string; genere: boolean }>(
    `/api/utilisateurs/${id}/mot-de-passe`,
    motDePasse ? { motDePasse } : {}
  );

/// Suppression definitive. N'accepte qu'un compte DESACTIVE et sans historique —
/// un compte qui a anime une table explique la composition d'une campagne passee.
export const supprimerCompte = (id: string, confirmation: string) =>
  apiDelete<{ supprime: string }>(`/api/utilisateurs/${id}`, { confirmation });

/// Rattacher — ou detacher, avec `utilisateurId` a `null` — un encadrant a un site.
export const definirEncadrement = (
  siteId: string,
  role: string,
  utilisateurId: string | null
) =>
  apiPut<{
    siteId: string;
    encadrement: { id: string; role: string; utilisateurId: string; nom: string; loginId: string }[];
  }>('/api/utilisateurs/encadrement', { siteId, role, utilisateurId });

/// Libelle lisible d'un role. Les CODES viennent du serveur (interdit n.3) ; seule
/// leur traduction vit ici, et en un seul endroit.
export const libelleRoleEncadrement = (role: string): string =>
  role === 'chef_de_site'
    ? 'chef de site'
    : role === 'chef_de_vente_vn'
      ? 'chef de vente VN'
      : role === 'chef_de_vente_vo'
        ? 'chef de vente VO'
        : role;

export const libelleRoleGlobal = (roles: string[]): string => {
  if (roles.includes('admin')) return 'Administrateur';
  if (roles.includes('direction')) return 'Direction';
  if (roles.includes('lecteur')) return 'Lecteur';
  return 'Encadrant';
};
