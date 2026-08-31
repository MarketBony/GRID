-- ============================================================================
-- LES ENCADRANTS SONT DES COMPTES, PAS DES VENDEURS.
--
-- CORRECTION D'UNE ERREUR DE MODELE que j'ai introduite le matin meme. J'avais
-- fait du chef de site et du chef de vente deux DRAPEAUX sur `vendeur`
-- (`chef_de_site`, `chef_de_vente`), en croyant que l'encadrant etait choisi
-- parmi les vendeurs du site.
--
-- C'est faux, et ca cassait le coeur de l'exercice. Le metier, tel que
-- l'utilisateur l'a decrit :
--
--   « Par le biais des tables on fait des groupes le plus heterogene possible.
--     Je mets 5 vendeurs de 5 concessions differentes, et un chef de vente en
--     chef de table d'une AUTRE concession pour les coacher. Ca fait de la
--     mixite et c'est tout l'interet du truc. »
--
-- Un encadrant est donc UNE PERSONNE AVEC UN COMPTE, rattachee a un site, et
-- rattachable a une table qui n'a rien a voir avec son site. Ce sont eux qui se
-- connectent et saisissent les RDV — des vendeurs de leur table ET de leur site.
--
-- Avec les drapeaux sur `vendeur`, le selecteur ne proposait que les vendeurs du
-- site courant : la mixite etait litteralement impossible a exprimer.
--
-- ---------------------------------------------------------------------------
-- CE QUE CETTE MIGRATION FAIT
-- ---------------------------------------------------------------------------
--
-- 1. `encadrement_site` — le rattachement (site, role) -> utilisateur. DURABLE et
--    non par campagne : un site a ses encadrants, une table se compose a chaque
--    campagne. C'est la difference avec `role_campagne`, qui reste et sert aux
--    exceptions ponctuelles.
--
-- 2. Le role `direction` — acces complet SAUF la gestion des comptes.
--
-- 3. Suppression de `vendeur.chef_de_site` et `vendeur.chef_de_vente`, et des
--    deux triggers qui les tenaient. Ils portaient un concept qui a change de
--    table : les laisser en place aurait garanti qu'on s'y trompe a nouveau.
--
-- UN VENDEUR PEUT AUSSI ETRE UN ENCADRANT : le lien existe deja
-- (`vendeur.utilisateur_id`, unique). Un chef de vente qui vend est un vendeur ET
-- un compte, reliés — pas un drapeau sur une ligne.
-- ============================================================================

SET search_path TO relance, public;

-- ---------------------------------------------------------------- 1. rattachement

CREATE TABLE encadrement_site (
  id            bigserial PRIMARY KEY,
  site_id       bigint      NOT NULL,
  -- `chef_de_site` | `chef_de_vente_vn` | `chef_de_vente_vo`
  role          text        NOT NULL,
  utilisateur_id bigint     NOT NULL,
  cree_le       timestamptz(6) NOT NULL DEFAULT now(),
  cree_par      bigint,
  archive_le    timestamptz(6)
);

ALTER TABLE encadrement_site
  ADD CONSTRAINT encadrement_site_site_id_fkey
  FOREIGN KEY (site_id) REFERENCES site(id) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE encadrement_site
  ADD CONSTRAINT encadrement_site_utilisateur_id_fkey
  FOREIGN KEY (utilisateur_id) REFERENCES utilisateur(id) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE encadrement_site
  ADD CONSTRAINT encadrement_site_role_check
  CHECK (role IN ('chef_de_site', 'chef_de_vente_vn', 'chef_de_vente_vo'));

-- UN SEUL titulaire par (site, role). Unique SIMPLE et non partiel : Prisma ne
-- sait pas exprimer un index partiel mais il GERE les index, donc un index
-- partiel cree en SQL provoque un `DROP INDEX` a chaque `migrate diff`. Constate
-- trois fois sur ce projet.
--
-- Consequence assumee : retirer puis redonner le meme role au meme compte
-- REACTIVE la ligne (`archive_le` remis a null) au lieu d'en inserer une seconde.
-- C'est la meme decision que pour `affectation` et `table_phoning`.
CREATE UNIQUE INDEX encadrement_site_site_role_key ON encadrement_site(site_id, role);
CREATE INDEX encadrement_site_utilisateur_id_idx ON encadrement_site(utilisateur_id);

-- Interdit n.1 : pas de suppression. La porte de purge ouverte par la migration
-- `20260831140000` s'applique aussi ici.
CREATE TRIGGER encadrement_site_pas_de_delete
  BEFORE DELETE ON encadrement_site
  FOR EACH STATEMENT EXECUTE FUNCTION interdire_suppression();

-- Un compte desactive ou archive ne doit pas rester rattache : il donnerait un
-- encadrant fantome dans le selecteur d'une table.
CREATE OR REPLACE FUNCTION verifier_encadrant_actif()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = relance, public
AS $$
DECLARE
  nom_compte text;
  compte_actif boolean;
  compte_archive timestamptz;
BEGIN
  IF NEW.archive_le IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT u.nom, u.actif, u.archive_le
    INTO nom_compte, compte_actif, compte_archive
  FROM utilisateur u WHERE u.id = NEW.utilisateur_id;

  IF nom_compte IS NULL THEN
    RETURN NEW; -- la cle etrangere s'en charge
  END IF;

  IF NOT compte_actif OR compte_archive IS NOT NULL THEN
    RAISE EXCEPTION
      'RELANCE: le compte de % est desactive : il ne peut pas encadrer un site. Le reactiver dans la gestion des comptes.',
      nom_compte;
  END IF;

  RETURN NEW;
END $$;

CREATE TRIGGER encadrement_site_compte_actif
  BEFORE INSERT OR UPDATE ON encadrement_site
  FOR EACH ROW EXECUTE FUNCTION verifier_encadrant_actif();

-- ---------------------------------------------------------------- 2. direction

ALTER TABLE role_global DROP CONSTRAINT role_global_role_check;
ALTER TABLE role_global
  ADD CONSTRAINT role_global_role_check
  CHECK (role IN ('admin', 'direction', 'lecteur'));

-- ---------------------------------------------------------------- 3. nettoyage

DROP TRIGGER IF EXISTS vendeur_chef_de_site_unique ON vendeur;
DROP TRIGGER IF EXISTS vendeur_chef_de_vente_unique ON vendeur;
DROP FUNCTION IF EXISTS verifier_chef_de_site_unique();
DROP FUNCTION IF EXISTS verifier_chef_de_vente_unique();

ALTER TABLE vendeur DROP COLUMN chef_de_site;
ALTER TABLE vendeur DROP COLUMN chef_de_vente;
