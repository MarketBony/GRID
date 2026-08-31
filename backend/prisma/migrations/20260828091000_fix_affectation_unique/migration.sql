-- ============================================================================
-- CORRECTIF — `verifier_affectation_unique` refusait une reaffectation a la
-- MEME table.
--
-- Symptome : le seed rejoue une seconde fois echouait sur
-- << ce vendeur est deja affecte a la table "Table 1" pour cette campagne >>,
-- alors que la table en question etait justement celle qu'on reaffectait.
--
-- CAUSE. La version initiale s'auto-excluait par `a.id <> COALESCE(NEW.id, -1)`.
-- Or `upsert` cote Prisma se traduit par `INSERT ... ON CONFLICT DO UPDATE` : le
-- trigger `BEFORE INSERT` se declenche AVANT que le conflit ne soit detecte, donc
-- avec un `NEW.id` tout neuf issu de la sequence. L'auto-exclusion ne reconnaît
-- alors jamais la ligne existante, et le trigger voit son propre couple
-- (table, vendeur) comme un doublon.
--
-- CORRECTION. On revient a la formulation de `schema.sql` : chercher une
-- affectation dans une AUTRE table (`a.table_id <> NEW.table_id`). C'est la regle
-- R-B.4 telle qu'elle est ecrite — << un vendeur ne peut appartenir qu'a une
-- seule table par campagne >> — et une reaffectation a la meme table n'a jamais
-- ete une violation.
--
-- Lecon consignee dans BUGS-CONNUS.md : un trigger `BEFORE INSERT` ne peut pas
-- raisonner sur l'identite de la ligne en cours d'insertion quand l'appelant
-- passe par `ON CONFLICT`. Il doit raisonner sur les CLES METIER.
-- ============================================================================

SET search_path TO relance, public;

CREATE OR REPLACE FUNCTION verifier_affectation_unique()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = relance, public
AS $$
DECLARE
  autre_table text;
BEGIN
  -- Une ligne archivee ne reserve pas la place du vendeur.
  IF NEW.archive_le IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT t_autre.libelle INTO autre_table
  FROM affectation a
  JOIN table_phoning  t_autre ON t_autre.id = a.table_id
  JOIN session_plaque s_autre ON s_autre.id = t_autre.session_plaque_id
  JOIN table_phoning  t_new   ON t_new.id   = NEW.table_id
  JOIN session_plaque s_new   ON s_new.id   = t_new.session_plaque_id
  WHERE a.vendeur_id = NEW.vendeur_id
    AND a.archive_le IS NULL
    -- Cle METIER, pas identite technique : voir l'explication ci-dessus.
    AND a.table_id <> NEW.table_id
    AND s_autre.campagne_id = s_new.campagne_id
  LIMIT 1;

  IF autre_table IS NOT NULL THEN
    RAISE EXCEPTION 'RELANCE: ce vendeur est deja affecte a la table "%" pour cette campagne.', autre_table;
  END IF;

  RETURN NEW;
END $$;
