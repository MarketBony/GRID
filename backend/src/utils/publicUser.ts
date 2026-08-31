import type { Utilisateur } from '@prisma/client';

// ============================================================================
// PROJECTION PUBLIQUE D'UN UTILISATEUR — passage OBLIGE avant toute reponse.
//
// Meme statut que `publicUser` sur GEARBOX : aucune route ne renvoie un
// enregistrement `utilisateur` brut. `passwordHash` est un hachage bcrypt, donc
// non reversible, mais le diffuser offre une cible d'attaque hors ligne et n'a
// aucune utilite pour le front.
//
// Le piege n'est pas la route qu'on ecrit en y pensant, c'est celle qui renvoie
// un objet imbrique : un `include: { chef: true }` sur une table de phoning
// embarque l'utilisateur COMPLET. D'ou la projection explicite plutot qu'un
// `delete obj.passwordHash` applique au cas par cas.
// ============================================================================

export interface UtilisateurPublic {
  id: string;
  loginId: string;
  nom: string;
  actif: boolean;
}

export const utilisateurPublic = (u: Utilisateur): UtilisateurPublic => ({
  id: u.id.toString(),
  loginId: u.loginId,
  nom: u.nom,
  actif: u.actif,
});

/// Selection Prisma equivalente, a utiliser dans les `select` / `include` pour ne
/// jamais faire remonter le hachage depuis la base.
export const SELECT_UTILISATEUR_PUBLIC = {
  id: true,
  loginId: true,
  nom: true,
  actif: true,
} as const;
