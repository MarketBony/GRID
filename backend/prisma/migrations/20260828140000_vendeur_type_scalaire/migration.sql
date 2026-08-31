-- ============================================================================
-- VN/VO EST LE METIER DU VENDEUR — correction de modele
--
-- Lecture du classeur source (onglet RESULTATS) : chaque vendeur porte une colonne
-- TYPE valant VN ou VO, et il figure dans le bloc VN ou dans le bloc VO, jamais
-- dans les deux. Sur juin 2026 : 72 VN et 27 VO.
--
-- La version precedente modelisait une relation many-to-many autorisant les deux.
-- C'etait faux, et ca faisait apparaitre dans la grille de saisie un selecteur
-- VN/VO qui n'existe pas dans le metier.
--
-- Trois consequences, toutes ici :
--   1. `vendeur.type_vehicule` devient une colonne scalaire ; la table de liaison
--      disparait.
--   2. `rdv.marque_id` devient NULLABLE : un vendeur VO n'a aucune ventilation par
--      marque dans le fichier, seulement un total.
--   3. Deux triggers remplacent l'ancien : coherence du type entre le RDV et son
--      vendeur, et marque obligatoire pour un VN / interdite pour un VO.
-- ============================================================================

SET search_path TO relance, public;

-- ---------------------------------------------------------------- 1. colonne
ALTER TABLE vendeur ADD COLUMN type_vehicule TEXT;

-- Reprise depuis la table de liaison : un vendeur qui n'y portait QUE 'VO' devient
-- VO, tous les autres deviennent VN. Avec le placeholder actuel (VN + VO pour tout
-- le monde) cela donne VN partout — le seed appliquera ensuite les types REELS
-- extraits du fichier, ce qui est mieux qu'un placeholder.
UPDATE vendeur v SET type_vehicule = CASE
  WHEN NOT EXISTS (
    SELECT 1 FROM vendeur_type_vehicule vt
    WHERE vt.vendeur_id = v.id AND vt.type_vehicule = 'VN'
  ) AND EXISTS (
    SELECT 1 FROM vendeur_type_vehicule vt
    WHERE vt.vendeur_id = v.id AND vt.type_vehicule = 'VO'
  ) THEN 'VO'
  ELSE 'VN'
END;

ALTER TABLE vendeur ALTER COLUMN type_vehicule SET NOT NULL;

-- Meme liste que `TYPES_VEHICULE` dans `backend/src/auth/roles.ts`.
-- `utils/verifierInvariants.ts` compare les deux au demarrage du serveur.
ALTER TABLE vendeur
  ADD CONSTRAINT vendeur_type_check
  CHECK (type_vehicule IN ('VN', 'VO'));

-- ---------------------------------------------------------------- 2. table retiree
-- Le trigger d'abord : il lit la table qu'on supprime.
DROP TRIGGER IF EXISTS rdv_type_vehicule_autorise ON rdv;
DROP FUNCTION IF EXISTS verifier_type_vehicule_autorise();
DROP TABLE vendeur_type_vehicule;

-- ---------------------------------------------------------------- 3. marque nullable
ALTER TABLE rdv ALTER COLUMN marque_id DROP NOT NULL;

-- ---------------------------------------------------------------- 4. coherence du type
-- Le type du RDV doit etre celui de son vendeur.
--
-- Pourquoi le type reste STOCKE sur le rdv au lieu d'etre derive : si un vendeur
-- change de metier, deriver ferait bouger les totaux VN/VO d'une campagne DEJA
-- CLOTUREE. C'est la classe du bug `RANK!AG`, deja corrigee pour l'effectif. Le
-- stockage garantit la stabilite historique, ce trigger garantit la coherence a
-- l'ecriture : les deux ne peuvent jamais diverger.

CREATE OR REPLACE FUNCTION verifier_type_coherent()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = relance, public
AS $$
DECLARE
  v record;
BEGIN
  SELECT nom, type_vehicule INTO v FROM vendeur WHERE id = NEW.vendeur_id;

  IF v.type_vehicule <> NEW.type_vehicule THEN
    RAISE EXCEPTION 'RELANCE: % est un vendeur %, il ne peut pas recevoir un RDV %.',
      v.nom, v.type_vehicule, NEW.type_vehicule;
  END IF;

  RETURN NEW;
END $$;

CREATE TRIGGER rdv_type_coherent
  BEFORE INSERT OR UPDATE OF vendeur_id, type_vehicule ON rdv
  FOR EACH ROW EXECUTE FUNCTION verifier_type_coherent();

-- ---------------------------------------------------------------- 5. marque et metier
-- Marque OBLIGATOIRE pour un vendeur VN, INTERDITE pour un vendeur VO.
--
-- C'est la forme exacte du fichier : un vendeur VN a une section par marque
-- autorisee (« NB RDV RENAULT », « NB RDV DACIA », ou « NB RDV ALPINE » sur le site
-- Alpine), un vendeur VO n'a qu'un « NB RDV VO » sans ventilation.

CREATE OR REPLACE FUNCTION verifier_marque_selon_metier()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = relance, public
AS $$
DECLARE
  v record;
BEGIN
  SELECT nom, type_vehicule INTO v FROM vendeur WHERE id = NEW.vendeur_id;

  IF v.type_vehicule = 'VO' AND NEW.marque_id IS NOT NULL THEN
    RAISE EXCEPTION 'RELANCE: % est un vendeur VO, ses RDV ne portent pas de marque.', v.nom;
  END IF;

  IF v.type_vehicule = 'VN' AND NEW.marque_id IS NULL THEN
    RAISE EXCEPTION 'RELANCE: % est un vendeur VN, la marque du RDV est obligatoire.', v.nom;
  END IF;

  RETURN NEW;
END $$;

CREATE TRIGGER rdv_marque_selon_metier
  BEFORE INSERT OR UPDATE OF vendeur_id, marque_id ON rdv
  FOR EACH ROW EXECUTE FUNCTION verifier_marque_selon_metier();

-- ---------------------------------------------------------------- 6. R-C.1 ajustee
-- `verifier_marque_autorisee` doit desormais LAISSER PASSER une marque nulle :
-- c'est le cas normal d'un vendeur VO, et `rdv_marque_selon_metier` ci-dessus se
-- charge de refuser une marque nulle chez un VN. Sans cet ajustement, tout RDV de
-- vendeur VO serait refuse par R-C.1.

CREATE OR REPLACE FUNCTION verifier_marque_autorisee()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = relance, public
AS $$
DECLARE
  nom_vendeur text;
  nom_marque  text;
BEGIN
  IF NEW.marque_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM vendeur_marque vm
    WHERE vm.vendeur_id = NEW.vendeur_id AND vm.marque_id = NEW.marque_id
  ) THEN
    RETURN NEW;
  END IF;

  SELECT v.nom INTO nom_vendeur FROM vendeur v WHERE v.id = NEW.vendeur_id;
  SELECT m.libelle INTO nom_marque FROM marque  m WHERE m.id = NEW.marque_id;

  RAISE EXCEPTION 'RELANCE: % n''est pas autorise a vendre %.',
    COALESCE(nom_vendeur, 'ce vendeur'), COALESCE(nom_marque, 'cette marque');
END $$;
