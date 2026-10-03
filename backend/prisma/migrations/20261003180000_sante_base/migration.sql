-- ============================================================================
-- LA SANTE DE LA BASE, DANS L'APPLICATION — reprise de l'app Forum 2026
-- (`sql/14_sante.sql`, `sql/25_sante_detail.sql`), adaptee a GRID le 03/10/2026.
--
-- Deux sondes, deux publics :
--
--   relance.sante()         TOUT compte connecte. Une pastille dans l'Ile :
--                           le temps de reponse se mesure dans le NAVIGATEUR
--                           (wifi compris), la base ne rend que l'heure et un
--                           compteur d'activite. Rien de nominatif.
--
--   relance.sante_detail()  `admin` et `direction` (peut_administrer). La
--                           console de Reglages. Elle lit pg_stat_activity :
--                           rien de tout cela ne doit atteindre un encadrant.
--
-- CE QUI COMPTE, DANS L'ORDRE (le raisonnement du Forum tient tel quel) :
--   1. le pool PostgREST — les connexions QUI TRAVAILLENT, pas celles que le
--      pool garde ouvertes (piege mesure au Forum le 15/09 : 11/11 « critique »
--      en permanence alors que tout repondait en 105 ms) ;
--   2. les verrous en attente — zero en permanence ;
--   3. les transactions ouvertes qui n'avancent plus (idle in transaction).
--
-- CE QUE GRID AJOUTE, parce que GRID vit sur l'offre gratuite de Supabase :
--   4. la TAILLE de la base, contre le plafond de 500 Mo de l'offre ;
--   5. la DERNIERE ACTIVITE — le projet est mis en pause apres 7 jours sans
--      activite (CLAUDE.md, « Sauvegardes a notre charge »).
--
-- L'ecart soldes <-> journal du Forum n'a pas d'equivalent ici : un RDV ne peut
-- pas pointer un jour ou un creneau absent de sa campagne, les cles etrangeres
-- l'interdisent. Une sonde qui ne peut pas s'allumer n'est pas une sonde.
--
-- Additif : rien n'est modifie, l'ancien front ne voit pas la difference.
-- ============================================================================

CREATE OR REPLACE FUNCTION relance.sante()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = relance, public, pg_temp
AS $fn$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'RELANCE: connexion requise' USING ERRCODE = '42501';
  END IF;
  RETURN jsonb_build_object(
    'ok', true,
    'heure', to_char(now() AT TIME ZONE 'Europe/Paris', 'HH24:MI:SS'),
    'rdv_10min', (SELECT count(*) FROM relance.rdv WHERE cree_le > now() - interval '10 minutes'));
END;
$fn$;

CREATE OR REPLACE FUNCTION relance.sante_detail()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = relance, public, pg_temp
AS $fn$
DECLARE
  v_ouvertes integer;
  v_actives  integer;
  v_verrous  integer;
  v_bloquees integer;
  v_max      integer;
  v_derniere timestamptz;
BEGIN
  IF NOT relance.peut_administrer() THEN
    RAISE EXCEPTION 'RELANCE: reserve a l''administration' USING ERRCODE = '42501';
  END IF;

  -- `authenticator` est le role par lequel PostgREST se connecte. On ne rend
  -- que des COMPTEURS : jamais un texte de requete ni un nom d'utilisateur.
  SELECT count(*) FILTER (WHERE usename = 'authenticator'),
         count(*) FILTER (WHERE usename = 'authenticator' AND state = 'active'),
         count(*) FILTER (WHERE wait_event_type = 'Lock'),
         count(*) FILTER (WHERE state = 'idle in transaction')
    INTO v_ouvertes, v_actives, v_verrous, v_bloquees
    FROM pg_stat_activity;

  SELECT setting::int INTO v_max FROM pg_settings WHERE name = 'max_connections';

  SELECT greatest(max(cree_le), max(modifie_le), max(archive_le)) INTO v_derniere FROM relance.rdv;

  RETURN jsonb_build_object(
    -- La sonde elle-meme occupe une connexion active : on la retire.
    'pool',            greatest(v_actives - 1, 0),
    'pool_ouvertes',   v_ouvertes,
    -- Plafond du pool PostgREST de l'offre gratuite, mesure sur le Forum
    -- (meme offre). Il n'est lisible nulle part depuis la base.
    'pool_max',        11,
    'connexions_max',  v_max,
    'verrous',         v_verrous,
    'bloquees',        v_bloquees,
    'rdv_min',         (SELECT count(*) FROM relance.rdv WHERE cree_le > now() - interval '1 minute'),
    'rdv_10min',       (SELECT count(*) FROM relance.rdv WHERE cree_le > now() - interval '10 minutes'),
    'taille_mo',       round(pg_database_size(current_database()) / 1048576.0, 1),
    'taille_max_mo',   500,
    'derniere_activite', v_derniere,
    'heure',           to_char(now() AT TIME ZONE 'Europe/Paris', 'HH24:MI:SS'));
END;
$fn$;

REVOKE ALL ON FUNCTION relance.sante() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION relance.sante_detail() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION relance.sante() TO authenticated;
GRANT EXECUTE ON FUNCTION relance.sante_detail() TO authenticated;
