-- ============================================================================
-- SPECIALISATION D'UNE TABLE — DECLAREE, ET NON DEDUITE.
--
-- POURQUOI CETTE MIGRATION EXISTE. F-B.5 demande de << respecter les marques
-- quand la table est specialisee >>. Le modele ne portait aucun lien table ->
-- marque, donc la premiere implementation DEDUISAIT la specialisation des membres
-- deja presents : les marques que la table couvrait.
--
-- Constate sur la vraie session CENTRE de septembre 2026, 29 vendeurs, 3 tables :
-- la repartition a rendu 11/8/10 au lieu de 10/10/9. Cause exacte — le premier
-- vendeur tire au sort dans une table vide fixait ses marques pour toujours. Un
-- vendeur ALPINE (marque Alpine seule) est tombe dans la table 2, qui a des lors
-- refuse tout vendeur Renault/Dacia et n'a plus accueilli que des Alpine et des
-- VO. Elle est devenue le deversoir des vendeurs sans contrainte, et les deux
-- autres tables ont absorbe la majorite Renault/Dacia.
--
-- Le desequilibre n'etait que le symptome. Le defaut de fond : LA
-- SPECIALISATION D'UNE TABLE ETAIT DECIDEE PAR LE TIRAGE AU SORT. C'est l'inverse
-- de ce que la regle demande — une table specialisee est une decision humaine.
--
-- `null` = table MIXTE, aucune contrainte. C'est le cas normal, et le seul
-- observe en juin 2026 : les huit tables melangent les marques comme elles
-- melangent les sites.
--
-- LA CONTRAINTE, quand la specialisation est declaree : le vendeur doit etre VN
-- ET autorise sur cette marque. Un vendeur VO n'a aucune ventilation par marque,
-- donc il n'a rien a faire dans une table specialisee — l'y placer n'aurait aucun
-- sens metier.
-- ============================================================================

SET search_path TO relance, public;

ALTER TABLE table_phoning ADD COLUMN marque_id bigint;

ALTER TABLE table_phoning
  ADD CONSTRAINT table_phoning_marque_id_fkey
  FOREIGN KEY (marque_id) REFERENCES marque(id) ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX table_phoning_marque_id_idx ON table_phoning(marque_id);

-- ---------------------------------------------------------------- R-B.5
-- Une table specialisee n'accueille que des vendeurs autorises sur sa marque.
--
-- Comme les autres garde-fous d'affectation, on raisonne sur les CLES METIER et
-- jamais sur `NEW.id` : un trigger `BEFORE INSERT` se declenche avant la
-- detection du conflit quand l'appelant passe par `ON CONFLICT DO UPDATE`, donc
-- avec un identifiant neuf. C'est ce qui avait piege
-- `verifier_affectation_unique`.

CREATE OR REPLACE FUNCTION verifier_affectation_marque_table()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = relance, public
AS $$
DECLARE
  marque_table   bigint;
  libelle_marque text;
  libelle_table  text;
  type_vendeur   text;
  nom_vendeur    text;
  autorise       boolean;
BEGIN
  -- Une ligne archivee ne rattache plus personne.
  IF NEW.archive_le IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT t.marque_id, t.libelle INTO marque_table, libelle_table
  FROM table_phoning t WHERE t.id = NEW.table_id;

  -- Table mixte : aucune contrainte. Cas normal.
  IF marque_table IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT v.type_vehicule, v.nom INTO type_vendeur, nom_vendeur
  FROM vendeur v WHERE v.id = NEW.vendeur_id;

  IF type_vendeur IS NULL THEN
    -- Vendeur inexistant : la cle etrangere s'en charge, on ne masque pas son
    -- message par le notre.
    RETURN NEW;
  END IF;

  SELECT m.libelle INTO libelle_marque FROM marque m WHERE m.id = marque_table;

  IF type_vendeur = 'VO' THEN
    RAISE EXCEPTION
      'RELANCE: % est un vendeur VO et n''a aucune ventilation par marque : il ne peut pas rejoindre la table "%", specialisee %.',
      nom_vendeur, libelle_table, libelle_marque;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM vendeur_marque vm
    WHERE vm.vendeur_id = NEW.vendeur_id AND vm.marque_id = marque_table
  ) INTO autorise;

  IF NOT autorise THEN
    RAISE EXCEPTION
      'RELANCE: % n''est pas autorise a vendre % : il ne peut pas rejoindre la table "%", specialisee sur cette marque.',
      nom_vendeur, libelle_marque, libelle_table;
  END IF;

  RETURN NEW;
END $$;

CREATE TRIGGER affectation_marque_table
  BEFORE INSERT OR UPDATE ON affectation
  FOR EACH ROW EXECUTE FUNCTION verifier_affectation_marque_table();
