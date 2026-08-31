-- ============================================================================
-- R-B.1 — UNE TABLE NE CONTIENT QUE DES VENDEURS DE SA PROPRE PLAQUE.
--
-- La regle est au cahier des charges depuis le debut et RIEN ne la tenait :
-- verifie, aucun des 18 invariants existants ne l'imposait. Elle n'a pose aucun
-- probleme jusqu'ici parce que seul le seed ecrivait des affectations, et qu'il
-- les lit du fichier source. Le module B change cela : c'est precisement l'ecran
-- qui peut la violer — un glisser-deposer mal cible, une repartition automatique
-- lancee sur la mauvaise session.
--
-- Ce qu'une violation produirait : un vendeur de SUD compte dans le total d'une
-- table de CENTRE. Les totaux par plaque et par table cesseraient de concorder,
-- et le desaccord ne se verrait qu'en additionnant a la main — c'est-a-dire
-- jamais.
--
-- JOINTURE SUR `site.plaque_id`, JAMAIS UNE PLAQUE DERIVEE AUTREMENT. Le
-- rattachement site -> plaque est modifiable : un site peut changer de plaque, et
-- toute autre facon de retrouver la plaque d'un vendeur serait fausse le jour ou
-- ca arrive. C'est un piege herite du fichier source, deja consigne.
--
-- RAISONNEMENT SUR LES CLES METIER, jamais sur `NEW.id` : un trigger
-- `BEFORE INSERT` se declenche avant la detection du conflit quand l'appelant
-- passe par `ON CONFLICT DO UPDATE`, donc avec un `NEW.id` neuf. C'est ce qui
-- avait piege `verifier_affectation_unique`, corrige par la migration
-- `20260828091000_fix_affectation_unique`. Ici la question ne se pose pas : on ne
-- compare aucune identite, seulement deux plaques.
-- ============================================================================

SET search_path TO relance, public;

CREATE OR REPLACE FUNCTION verifier_affectation_meme_plaque()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = relance, public
AS $$
DECLARE
  plaque_table   bigint;
  plaque_vendeur bigint;
  libelle_table  text;
  nom_vendeur    text;
BEGIN
  -- Une ligne archivee ne rattache plus personne : inutile de la contraindre, et
  -- la contraindre empecherait d'archiver une affectation devenue invalide apres
  -- un changement de plaque d'un site.
  IF NEW.archive_le IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT s.plaque_id, t.libelle
    INTO plaque_table, libelle_table
  FROM table_phoning  t
  JOIN session_plaque s ON s.id = t.session_plaque_id
  WHERE t.id = NEW.table_id;

  SELECT si.plaque_id, v.nom
    INTO plaque_vendeur, nom_vendeur
  FROM vendeur v
  JOIN site si ON si.id = v.site_id
  WHERE v.id = NEW.vendeur_id;

  IF plaque_table IS NULL OR plaque_vendeur IS NULL THEN
    -- Table ou vendeur inexistant : les cles etrangeres s'en chargent, on ne
    -- masque pas leur message par le notre.
    RETURN NEW;
  END IF;

  IF plaque_table <> plaque_vendeur THEN
    RAISE EXCEPTION
      'RELANCE: % appartient a une autre plaque que la table "%". Une table ne peut contenir que des vendeurs de sa propre plaque.',
      nom_vendeur, libelle_table;
  END IF;

  RETURN NEW;
END $$;

CREATE TRIGGER affectation_meme_plaque
  BEFORE INSERT OR UPDATE ON affectation
  FOR EACH ROW EXECUTE FUNCTION verifier_affectation_meme_plaque();
