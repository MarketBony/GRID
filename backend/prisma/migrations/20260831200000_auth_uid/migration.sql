-- ============================================================================
-- LIEN AVEC SUPABASE AUTH.
--
-- Le produit passe d'une API Express qui faisait autorite a un front statique
-- qui attaque Supabase en direct. L'identite ne vient donc plus d'un JWT que
-- nous signions, mais de `auth.uid()` — un uuid pose par Supabase Auth.
--
-- UNE COLONNE, PAS UNE TABLE. Le premier plan prevoyait une table `profil`
-- reliant `utilisateur.id` a `auth.uid()`. Ecarte : `utilisateur_courant()` est
-- appelee par CHAQUE politique RLS, et une jointure de plus a cet endroit-la se
-- paie sur chaque lecture. La colonne vit donc sur la table qu'elle identifie.
--
-- PAS DE CLE ETRANGERE VERS `auth.users`, et c'est deliberé.
-- Prisma ne sait pas exprimer une reference vers un autre schema sans le mode
-- `multiSchema`, qui imposerait un `@@schema` sur les 16 modeles. Une FK posee
-- en SQL et inconnue de Prisma produirait un `DROP CONSTRAINT` a chaque
-- `migrate diff` — exactement la derive perpetuelle deja rencontree deux fois
-- sur ce projet avec les index partiels.
--
-- Ce que la FK aurait garanti est obtenu autrement : la creation d'un compte
-- passe par l'Edge Function `gerer-comptes`, qui ecrit les deux cotes dans le
-- meme appel. Et un `auth_uid` orphelin est inoffensif : il ne correspond a
-- aucun `auth.uid()`, donc il n'ouvre rien.
--
-- `password_hash` N'EST PAS SUPPRIMEE ICI. Les hachages bcrypt ne sont pas
-- transferables vers Supabase Auth, mais retirer la colonne dans la meme
-- migration que l'ajout du lien melangerait la bascule et le nettoyage : si la
-- bascule echoue, on veut pouvoir revenir. Elle part en phase 8, avec le reste
-- du backend Express.
-- ============================================================================

SET search_path TO relance, public;

ALTER TABLE utilisateur ADD COLUMN auth_uid uuid;

CREATE UNIQUE INDEX utilisateur_auth_uid_key ON utilisateur (auth_uid);

COMMENT ON COLUMN utilisateur.auth_uid IS
  'Identifiant Supabase Auth (auth.users.id). NULL tant que le compte n''a pas ete relie. Aucune FK : voir la migration 20260831200000.';
