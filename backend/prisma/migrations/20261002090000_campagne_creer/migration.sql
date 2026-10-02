-- ============================================================================
-- CREER UNE CAMPAGNE (F-A4.1) — la fonction qui n'avait jamais ete ecrite.
--
-- Constat du 02/10/2026 : l'ecran Campagnes savait lire, modifier et cloturer
-- une campagne, jamais en creer une. Les deux campagnes en base venaient du
-- seed. Le manque ne s'est vu qu'a la troisieme session — octobre — une fois
-- juin et septembre cloturees.
--
-- Les politiques RLS d'INSERT existaient deja (`rls_portail`). Ce n'est pas
-- elles qui manquaient, c'est la TRANSACTION : une campagne utilisable, c'est
-- quatre tables ecrites ensemble — la campagne, ses jours, ses creneaux, une
-- session par plaque. Quatre appels PostgREST laisseraient, au premier reseau
-- qui lache, une campagne sans creneau que la grille ne saurait pas afficher.
--
-- ---------------------------------------------------------------------------
-- CE QUI EST REPRIS D'UNE CAMPAGNE MODELE, ET POURQUOI
-- ---------------------------------------------------------------------------
-- Interdit n.3 : les creneaux et les modes d'organisation sont des DONNEES. Les
-- ecrire ici en dur reviendrait a recopier la constante `CRENEAUX` du seed. On
-- les recopie donc d'une campagne existante, que l'appelant designe :
--
--   creneaux   copies tels quels — code, libelle, ordre ;
--   sessions   une par plaque NON archivee. Mode et effectif cible repris de la
--              session du modele sur la meme plaque ; `par_site` a defaut — une
--              plaque ajoutee depuis n'a pas de precedent, et `par_site` est le
--              mode qui fonctionne sans aucune table ;
--   jours      chaque date de `p_debut` a `p_fin`. C'est ce qu'ont ete juin et
--              septembre. Une campagne a trous (F-A4.2) s'ajuste ENSUITE dans
--              l'ecran, qui le sait deja.
--
-- Les TABLES ne sont pas reprises : un vendeur change de table d'une campagne a
-- l'autre, et le module B les recompose a chaque session (graine 42).
-- ============================================================================

SET search_path TO relance, public;

CREATE OR REPLACE FUNCTION relance.campagne_creer(
  p_libelle text,
  p_debut date,
  p_fin date,
  p_modele_id bigint
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = relance, public, pg_temp
AS $fn$
DECLARE
  moi bigint := relance.exiger_administration();
  v_libelle text := btrim(coalesce(p_libelle, ''));
  nouvelle bigint;
BEGIN
  IF v_libelle = '' THEN
    RAISE EXCEPTION 'RELANCE: le libelle de la campagne est requis.';
  END IF;
  IF p_debut IS NULL OR p_fin IS NULL THEN
    RAISE EXCEPTION 'RELANCE: les dates de debut et de fin sont requises.';
  END IF;
  IF p_fin < p_debut THEN
    RAISE EXCEPTION 'RELANCE: la date de fin precede la date de debut.';
  END IF;
  -- Une borne, pas une regle metier : une faute de frappe sur l'annee
  -- (2026 -> 2027) poserait 366 jours, donc 366 colonnes dans la grille.
  IF p_fin - p_debut > 30 THEN
    RAISE EXCEPTION 'RELANCE: une campagne couvre au plus 31 jours (% jours demandes).',
      p_fin - p_debut + 1;
  END IF;
  -- Le libelle est UNIQUE (le seed resout une campagne par son libelle). Le
  -- verifier ici donne un message lisible au lieu d'une violation de contrainte.
  IF EXISTS (SELECT 1 FROM relance.campagne c WHERE c.libelle = v_libelle) THEN
    RAISE EXCEPTION 'RELANCE: une campagne s''appelle deja « % ».', v_libelle;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM relance.campagne c WHERE c.id = p_modele_id AND c.archive_le IS NULL
  ) THEN
    RAISE EXCEPTION 'RELANCE: campagne modele introuvable.';
  END IF;
  -- Un modele sans creneau donnerait une grille sans ligne.
  IF NOT EXISTS (SELECT 1 FROM relance.campagne_creneau cc WHERE cc.campagne_id = p_modele_id) THEN
    RAISE EXCEPTION 'RELANCE: la campagne modele n''a aucun creneau a reprendre.';
  END IF;

  INSERT INTO relance.campagne (libelle, date_debut, date_fin, cree_par)
  VALUES (v_libelle, p_debut, p_fin, moi)
  RETURNING id INTO nouvelle;

  INSERT INTO relance.campagne_jour (campagne_id, jour, ordre, cree_par)
  SELECT nouvelle, j::date, row_number() OVER (ORDER BY j)::int, moi
    FROM generate_series(p_debut, p_fin, interval '1 day') AS j;

  INSERT INTO relance.campagne_creneau (campagne_id, code, libelle, ordre, cree_par)
  SELECT nouvelle, cc.code, cc.libelle, cc.ordre, moi
    FROM relance.campagne_creneau cc
   WHERE cc.campagne_id = p_modele_id;

  INSERT INTO relance.session_plaque (campagne_id, plaque_id, mode, effectif_cible_table, cree_par)
  SELECT nouvelle, p.id,
         coalesce(sm.mode, 'par_site'),
         sm.effectif_cible_table,
         moi
    FROM relance.plaque p
    LEFT JOIN relance.session_plaque sm
      ON sm.campagne_id = p_modele_id
     AND sm.plaque_id = p.id
     AND sm.archive_le IS NULL
   WHERE p.archive_le IS NULL;

  RETURN nouvelle;
END $fn$;

-- Meme regle que les onze fonctions de `rpc_privilegies` : PostgreSQL accorde
-- l'execution a PUBLIC par defaut, `anon` compris. Le palier est ensuite verifie
-- DANS la fonction, par `exiger_administration()`.
REVOKE ALL ON FUNCTION relance.campagne_creer(text, date, date, bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION relance.campagne_creer(text, date, date, bigint) TO authenticated;
