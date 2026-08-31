-- ============================================================================
-- TYPES DE VEHICULE PAR VENDEUR (VN / VO)
--
-- `type_vehicule` ne vivait que sur le RDV : rien n'empechait un RDV VN chez un
-- vendeur exclusivement VO. La distinction est reelle en concession — stock et
-- objectifs differents — donc elle appartient au vendeur.
--
-- MIGRATION ECRITE A LA MAIN sur deux points que le diff Prisma aurait mal faits.
-- ============================================================================

SET search_path TO relance, public;

-- ---------------------------------------------------------------- 1. renommage
-- Prisma proposait DROP + ADD, ce qui EFFACE les confirmations deja saisies.
-- `RENAME COLUMN` les conserve.
--
-- Les colonnes couvrent desormais les deux dimensions — marques ET types de
-- vehicule — d'ou `capacites_` et non `marques_`. Un seul marqueur, parce que
-- l'operation reelle est « je valide ce vendeur » : deux compteurs distincts
-- auraient laisse croire qu'un vendeur a moitie confirme est protege.
ALTER TABLE vendeur RENAME COLUMN marques_confirmees_le  TO capacites_confirmees_le;
ALTER TABLE vendeur RENAME COLUMN marques_confirmees_par TO capacites_confirmees_par;

-- ---------------------------------------------------------------- 2. table
CREATE TABLE vendeur_type_vehicule (
    vendeur_id    BIGINT NOT NULL,
    type_vehicule TEXT   NOT NULL,
    cree_le       TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    cree_par      BIGINT,

    CONSTRAINT vendeur_type_vehicule_pkey PRIMARY KEY (vendeur_id, type_vehicule)
);

ALTER TABLE vendeur_type_vehicule
  ADD CONSTRAINT vendeur_type_vehicule_vendeur_id_fkey
  FOREIGN KEY (vendeur_id) REFERENCES vendeur(id) ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX vendeur_site_id_idx ON vendeur(site_id);

-- La meme liste que `TYPES_VEHICULE` dans `backend/src/auth/roles.ts`.
-- `utils/verifierInvariants.ts` compare les deux au demarrage du serveur et
-- refuse de demarrer si elles divergent.
ALTER TABLE vendeur_type_vehicule
  ADD CONSTRAINT vendeur_type_vehicule_type_check
  CHECK (type_vehicule IN ('VN', 'VO'));

-- ---------------------------------------------------------------- 3. amorcage
-- POINT CRITIQUE. Sans cette ligne, aucun vendeur n'aurait de type autorise et le
-- trigger ci-dessous refuserait TOUS les RDV — y compris ceux qui passaient la
-- veille. Une migration qui casse l'application en silence est pire que pas de
-- migration.
--
-- On amorce donc a VN + VO pour tout le monde. C'est un PLACEHOLDER, exactement
-- comme les marques : `capacites_confirmees_le` reste `null`, l'ecran des vendeurs
-- affiche le vendeur comme non confirme, et le compteur de progression ne le
-- compte pas.
INSERT INTO vendeur_type_vehicule (vendeur_id, type_vehicule)
SELECT v.id, t.type_vehicule
FROM vendeur v
CROSS JOIN (VALUES ('VN'), ('VO')) AS t(type_vehicule)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------- 4. R-C.1 etendue
-- Un vendeur ne peut recevoir un RDV que sur un type de vehicule qu'il est
-- autorise a vendre. Pendant du trigger `rdv_marque_autorisee`.

CREATE OR REPLACE FUNCTION verifier_type_vehicule_autorise()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = relance, public
AS $$
DECLARE
  nom_vendeur text;
BEGIN
  IF EXISTS (
    SELECT 1 FROM vendeur_type_vehicule vt
    WHERE vt.vendeur_id = NEW.vendeur_id AND vt.type_vehicule = NEW.type_vehicule
  ) THEN
    RETURN NEW;
  END IF;

  SELECT v.nom INTO nom_vendeur FROM vendeur v WHERE v.id = NEW.vendeur_id;

  RAISE EXCEPTION 'RELANCE: % n''est pas autorise sur les vehicules %.',
    COALESCE(nom_vendeur, 'ce vendeur'), NEW.type_vehicule;
END $$;

CREATE TRIGGER rdv_type_vehicule_autorise
  BEFORE INSERT OR UPDATE OF vendeur_id, type_vehicule ON rdv
  FOR EACH ROW EXECUTE FUNCTION verifier_type_vehicule_autorise();

-- ---------------------------------------------------------------- 5. interdit n.1
-- `vendeur_type_vehicule` n'est PAS protegee contre la suppression, comme
-- `vendeur_marque` : c'est un ETAT courant corrigeable, pas un historique. Le
-- remplacer est l'operation normale de l'ecran des vendeurs. La trace de qui a
-- change quoi et quand est portee par `capacites_confirmees_*`.
