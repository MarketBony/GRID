-- ============================================================================
-- LES DROITS DE `service_role` — lacune de la migration du portail.
--
-- CE QUI A ETE OBSERVE. L'Edge Function `gerer-comptes`, qui s'execute avec la
-- cle `service_role`, echouait sur :
--
--     permission denied for table utilisateur
--
-- alors qu'elle est censee pouvoir tout faire. Aucun compte ne pouvait donc etre
-- cree depuis l'interface.
--
-- POURQUOI. `service_role` porte l'attribut `BYPASSRLS` : il ignore les
-- POLITIQUES. Mais **il n'ignore pas les PRIVILEGES SQL** — ce sont deux couches
-- distinctes, et la migration du portail n'accordait les droits de table qu'a
-- `authenticated`. Le role passait donc a travers la RLS pour se heurter au mur
-- d'en dessous.
--
-- C'est la meme confusion que celle qui guette a chaque fois : la RLS s'applique
-- APRES les droits SQL, jamais a leur place.
--
-- ---------------------------------------------------------------------------
-- PAS DE `DELETE`, MEME POUR `service_role`
-- ---------------------------------------------------------------------------
-- On accorde `SELECT, INSERT, UPDATE` — pas `ALL`. L'interdit n.1 dit qu'aucun
-- droit `DELETE` n'est accorde a personne, et « personne » inclut la cle qui
-- contourne tout le reste : c'est precisement celle dont on veut qu'elle ne
-- puisse pas detruire l'historique par accident.
--
-- Les purges legitimes passent par `vendeur_purger` et `utilisateur_purger`, qui
-- sont `security definer` et s'executent avec les droits de leur PROPRIETAIRE —
-- pas avec ceux de l'appelant. Elles fonctionnent donc sans que `service_role`
-- ait besoin du moindre droit de suppression.
--
-- `utilisateur` recoit les colonnes ENTIERES ici, contrairement a
-- `authenticated` : l'Edge Function doit ecrire `auth_uid` et `password_hash`
-- pour relier une identite. C'est justement le travail qu'on lui reserve, et la
-- raison pour laquelle il ne se fait pas depuis le navigateur.
-- ============================================================================

SET search_path TO relance, public;

GRANT USAGE ON SCHEMA relance TO service_role;

GRANT SELECT, INSERT, UPDATE ON
  plaque, site, marque, campagne, campagne_jour, campagne_creneau,
  session_plaque, vendeur, vendeur_marque, table_phoning, affectation,
  utilisateur, role_global, role_campagne, encadrement_site, rdv
TO service_role;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA relance TO service_role;

-- Les fonctions du portail : l'Edge Function interroge `peut_gerer_utilisateurs`
-- avec le jeton de son APPELANT, donc en tant que `authenticated` — ce droit-la
-- existe deja. Mais `service_role` peut avoir besoin des memes fonctions pour ses
-- propres verifications, et rien ne justifie de les lui refuser.
DO $droits$
DECLARE f record;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS signature
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'relance'
       AND p.proname IN ('utilisateur_courant', 'a_role_global', 'peut_administrer',
                         'peut_gerer_utilisateurs', 'campagne_ouverte', 'peut_saisir')
  LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f.signature);
  END LOOP;
END $droits$;
