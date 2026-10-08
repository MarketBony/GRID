SET search_path TO relance, public;

-- Le TRAFIC NATUREL se saisit depuis le Suivi : meme perimetre que lui. Corps
-- identique a 20261002213103, le controle `perimetre_suivi` en tete.
CREATE OR REPLACE FUNCTION relance.rdv_poser_showroom(
  p_campagne_id bigint, p_vendeur_id bigint, p_jour date, p_creneau_code text,
  p_marque_id bigint, p_type_vehicule text, p_client text, p_cle uuid
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = relance, public, pg_temp
AS $fn$
DECLARE
  resultat jsonb;
BEGIN
  IF p_cle IS NULL THEN
    RAISE EXCEPTION 'RELANCE: cle d''idempotence manquante.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM relance.perimetre_suivi ps
     WHERE ps.campagne_id = p_campagne_id AND ps.vendeur_id = p_vendeur_id
  ) THEN
    RAISE EXCEPTION 'RELANCE: ce vendeur n''est pas sur un de vos sites.';
  END IF;
  INSERT INTO relance.rdv (campagne_id, vendeur_id, jour, creneau_code, marque_id, type_vehicule, client, cle_client, source)
  VALUES (p_campagne_id, p_vendeur_id, p_jour, p_creneau_code, p_marque_id, p_type_vehicule, p_client, p_cle, 'showroom')
  ON CONFLICT (cle_client) DO NOTHING;
  SELECT jsonb_build_object('id', r.id, 'vendeur_id', r.vendeur_id, 'jour', r.jour,
           'creneau_code', r.creneau_code, 'marque_id', r.marque_id, 'type_vehicule', r.type_vehicule,
           'client', r.client, 'source', r.source)
    INTO resultat FROM relance.rdv r WHERE r.cle_client = p_cle;
  IF resultat IS NULL THEN
    RAISE EXCEPTION 'RELANCE: ce rendez-vous ne peut pas etre enregistre sur votre perimetre.';
  END IF;
  RETURN resultat;
END $fn$;
