// ============================================================================
// ROLES ET VALEURS CONTRAINTES — seul garde-fou contre une valeur invalide.
//
// Comme sur GEARBOX depuis la suppression des enums Prisma, ces colonnes sont des
// `String` libres en base : ces listes sont donc la seule chose qui empeche
// d'ecrire `chef_plake` sans que rien ne proteste.
//
// A NE PAS CONFONDRE avec les referentiels metier. Plaques, sites, vendeurs,
// jours, creneaux et marques sont des DONNEES et vivent en base (interdit n.3) :
// ce fichier ne contient que des modes de fonctionnement du LOGICIEL, qui n'ont
// aucune raison d'etre editables par un utilisateur.
//
// C'est la difference avec GEARBOX, qui code sa carte des plaques en dur dans
// `constants.ts` ET dans `backend/src/auth/siteScope.ts`, avec
// `scripts/check-plaques-sync.mjs` pour contenir la derive. Ici il n'y a rien a
// synchroniser : la carte n'existe qu'en base.
// ============================================================================

/// Roles permanents, sans portee de campagne.
///
/// LES QUATRE PALIERS DE COMPTE, du plus large au plus etroit :
///
///   `admin`      — tout, y compris la GESTION DES COMPTES.
///   `direction`  — tout SAUF la gestion des comptes.
///   `lecteur`    — lecture seule. Aucune ecriture, aucune saisie.
///   (aucun role) — un ENCADRANT. Ses droits viennent de ses rattachements :
///                  les sites qu'il encadre et les tables qu'il anime. Il lit
///                  tout — les compteurs sont publics — mais ne saisit que pour
///                  les vendeurs de son perimetre.
///
/// Il n'y a pas de role `chef_de_site` ici, et c'est deliberé : etre chef de site
/// n'est pas une propriete du compte, c'est un RATTACHEMENT a un site precis
/// (`EncadrementSite`). Le meme compte peut encadrer deux sites et animer une
/// table sur une troisieme — ce qui est exactement l'exercice.
export const ROLES_GLOBAUX = ['admin', 'direction', 'lecteur'] as const;
export type RoleGlobal = (typeof ROLES_GLOBAUX)[number];

/// Roles d'encadrement d'un SITE. Durables, hors campagne.
///
/// Un site a au plus un titulaire par role : un chef de site, un chef de vente VN,
/// un chef de vente VO. Beaucoup de sites n'ont pas de chef de vente.
export const ROLES_ENCADREMENT = [
  'chef_de_site',
  'chef_de_vente_vn',
  'chef_de_vente_vo',
] as const;
export type RoleEncadrement = (typeof ROLES_ENCADREMENT)[number];

/// Roles portes PAR CAMPAGNE (cahier des charges section 3).
/// `chef_table` n'y figure pas : il n'est pas une ligne de role, il est porte par
/// `table_phoning.chef_utilisateur_id`, qui appartient deja a une campagne.
export const ROLES_CAMPAGNE = ['chef_plaque', 'chef_site'] as const;
export type RoleCampagne = (typeof ROLES_CAMPAGNE)[number];

/// Mode d'organisation d'une session (campagne x plaque).
/// `par_site` n'est PAS un mode degrade : NORD et SUD-OUEST n'avaient aucune
/// table en juin 2026, et l'outil doit leur etre pleinement utilisable.
export const MODES_SESSION = ['par_site', 'par_table'] as const;
export type ModeSession = (typeof MODES_SESSION)[number];

/// Type de vehicule. Deux valeurs, et tout le dashboard est construit sur ces
/// deux seaux (F-D.1, F-D.2, F-D.6).
export const TYPES_VEHICULE = ['VN', 'VO'] as const;
export type TypeVehicule = (typeof TYPES_VEHICULE)[number];

/// Origine d'une affectation vendeur -> table. F-B.5 exige que la repartition
/// automatique soit reproductible donc contestable : il faut pouvoir distinguer
/// ce que l'algorithme a produit de ce qu'un chef de plaque a arbitre a la main.
export const ORIGINES_AFFECTATION = ['auto', 'manuel'] as const;
export type OrigineAffectation = (typeof ORIGINES_AFFECTATION)[number];

const dansLaListe = <T extends readonly string[]>(liste: T, valeur: unknown): boolean =>
  typeof valeur === 'string' && (liste as readonly string[]).includes(valeur);

export const estRoleGlobalValide = (v: unknown) => dansLaListe(ROLES_GLOBAUX, v);
export const estRoleEncadrementValide = (v: unknown) => dansLaListe(ROLES_ENCADREMENT, v);
export const estRoleCampagneValide = (v: unknown) => dansLaListe(ROLES_CAMPAGNE, v);
export const estModeSessionValide = (v: unknown) => dansLaListe(MODES_SESSION, v);
export const estTypeVehiculeValide = (v: unknown) => dansLaListe(TYPES_VEHICULE, v);
export const estOrigineValide = (v: unknown) => dansLaListe(ORIGINES_AFFECTATION, v);

// ---------------------------------------------------------------------------
// Qui peut attribuer quoi.
//
// Seul `admin` gere les comptes et les roles. Il n'y a pas d'echelon
// intermediaire, donc pas de promotion croisee possible — le scenario que
// GEARBOX a du fermer en interdisant a Director d'attribuer Director.
// Si un echelon intermediaire apparait un jour, relire `roles.ts` de GEARBOX
// AVANT de l'ajouter : le piege n'est pas << peut-il se promouvoir lui-meme >>
// mais << deux comptes peuvent-ils se promouvoir mutuellement >>.
// ---------------------------------------------------------------------------
export const ROLES_GESTION_COMPTES: readonly RoleGlobal[] = ['admin'];

// `lecteur` (la direction) n'apparait dans AUCUNE liste d'ecriture, et c'est ce
// qui le rend lecture seule. Ne l'ajouter nulle part << pour faire propre >> :
// c'est voulu, ce n'est pas un oubli.
export const ROLES_ADMINISTRATION_REFERENTIELS: readonly RoleGlobal[] = ['admin'];
