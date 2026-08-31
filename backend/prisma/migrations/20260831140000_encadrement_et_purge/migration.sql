-- ============================================================================
-- ENCADREMENT D'UN SITE, ARCHIVAGE D'UN VENDEUR, ET PORTE DE PURGE.
--
-- Trois sujets distincts dans une seule migration parce qu'ils touchent la meme
-- table et le meme trigger, et qu'un rejeu partiel n'aurait aucun sens.
--
-- ---------------------------------------------------------------------------
-- 1. L'ENCADREMENT — chef de site et chef de vente
-- ---------------------------------------------------------------------------
--
-- `chef_de_site` existait deja, sans aucune contrainte : rien n'empechait d'en
-- declarer douze sur le meme site. `chef_de_vente` est nouveau.
--
-- Les deux ne se comptent PAS pareil, et c'est une regle metier :
--
--   - CHEF DE SITE : un seul par site, tous metiers confondus. Il chapeaute le
--     site entier.
--   - CHEF DE VENTE : au plus un par site ET PAR METIER. Un gros site peut avoir
--     un chef de vente VN et un chef de vente VO. Beaucoup de sites n'en ont
--     aucun.
--
-- LES DEUX TRIGGERS NE COMPTENT QUE LES VENDEURS EN POSTE — ni archives, ni
-- sortis. Sans cela, le depart d'un chef bloquerait la designation de son
-- successeur, et on ne s'en apercevrait qu'au pire moment.
--
-- POURQUOI DES TRIGGERS ET NON DES INDEX UNIQUES PARTIELS. Prisma ne sait pas
-- exprimer un index partiel, mais il GERE les index : un index partiel cree en
-- SQL provoque un `DROP INDEX` a chaque `migrate diff`, indefiniment. Constate
-- deux fois sur ce projet. Un trigger, lui, est invisible pour Prisma et survit.
--
-- ---------------------------------------------------------------------------
-- 2. L'ARCHIVAGE d'un vendeur
-- ---------------------------------------------------------------------------
--
-- `date_sortie` dit « cette personne a quitte l'entreprise » : c'est une donnee
-- metier, elle borne les effectifs de chaque campagne. Elle ne sert pas a
-- masquer une erreur de saisie.
--
-- `archive_le` dit « cette ligne n'a plus a apparaitre ». Ses RDV restent en
-- base, donc LES TOTAUX DES CAMPAGNES PASSEES NE BOUGENT PAS — c'est tout
-- l'interet par rapport a une suppression.
--
-- ---------------------------------------------------------------------------
-- 3. LA PORTE DE PURGE
-- ---------------------------------------------------------------------------
--
-- L'interdit n.1 reste en vigueur : par defaut, AUCUN `DELETE` ne passe, sur
-- aucune table. Ce n'etait pas negociable et ca ne l'est pas devenu.
--
-- Ce qui change : il existe desormais UNE porte, une seule, qui doit etre ouverte
-- explicitement pour la duree d'UNE transaction :
--
--   SET LOCAL relance.purge_autorisee = 'oui';
--
-- `SET LOCAL` meurt avec la transaction. La porte ne peut donc pas rester
-- ouverte par oubli, et elle n'affecte aucune autre session — contrairement a un
-- `ALTER TABLE ... DISABLE TRIGGER`, qui aurait desarme le garde-fou pour tout le
-- monde, y compris pendant une session de saisie.
--
-- Le seul appelant est la route de purge, derriere l'onglet Archivage, sur
-- demande explicite d'un administrateur qui voit ce qu'il detruit.
-- ============================================================================

SET search_path TO relance, public;

-- ---------------------------------------------------------------- colonnes

ALTER TABLE vendeur ADD COLUMN chef_de_vente boolean NOT NULL DEFAULT false;
ALTER TABLE vendeur ADD COLUMN archive_le timestamptz(6);
ALTER TABLE vendeur ADD COLUMN archive_par bigint;

-- ---------------------------------------------------------------- R-A3.7
-- Un seul chef de site par site.

CREATE OR REPLACE FUNCTION verifier_chef_de_site_unique()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = relance, public
AS $$
DECLARE
  deja text;
BEGIN
  IF NOT NEW.chef_de_site OR NEW.archive_le IS NOT NULL OR NEW.date_sortie IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT v.nom INTO deja
  FROM vendeur v
  WHERE v.site_id = NEW.site_id
    AND v.chef_de_site
    AND v.archive_le IS NULL
    AND v.date_sortie IS NULL
    -- CLE METIER, jamais `NEW.id` : un `BEFORE INSERT` se declenche avant la
    -- detection du conflit quand l'appelant passe par `ON CONFLICT DO UPDATE`,
    -- donc avec un identifiant neuf. C'est ce qui avait piege
    -- `verifier_affectation_unique`. Ici on compare des noms de personnes, ce qui
    -- suppose qu'on ne se compare pas a soi-meme : d'ou l'exclusion par id, qui
    -- est SURE en UPDATE (l'id existe deja) et sans effet en INSERT.
    AND v.id IS DISTINCT FROM NEW.id
  LIMIT 1;

  IF deja IS NOT NULL THEN
    RAISE EXCEPTION
      'RELANCE: ce site a deja un chef de site, % . Il n''y en a qu''un par site : retirer le role a l''actuel avant de le donner a un autre.',
      deja;
  END IF;

  RETURN NEW;
END $$;

CREATE TRIGGER vendeur_chef_de_site_unique
  BEFORE INSERT OR UPDATE ON vendeur
  FOR EACH ROW EXECUTE FUNCTION verifier_chef_de_site_unique();

-- ---------------------------------------------------------------- R-A3.8
-- Au plus un chef de vente par site ET PAR METIER.

CREATE OR REPLACE FUNCTION verifier_chef_de_vente_unique()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = relance, public
AS $$
DECLARE
  deja text;
BEGIN
  IF NOT NEW.chef_de_vente OR NEW.archive_le IS NOT NULL OR NEW.date_sortie IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT v.nom INTO deja
  FROM vendeur v
  WHERE v.site_id = NEW.site_id
    AND v.chef_de_vente
    AND v.type_vehicule = NEW.type_vehicule
    AND v.archive_le IS NULL
    AND v.date_sortie IS NULL
    AND v.id IS DISTINCT FROM NEW.id
  LIMIT 1;

  IF deja IS NOT NULL THEN
    RAISE EXCEPTION
      'RELANCE: ce site a deja un chef de vente % , % . Il y en a au plus un par metier : retirer le role a l''actuel avant de le donner a un autre.',
      NEW.type_vehicule, deja;
  END IF;

  RETURN NEW;
END $$;

CREATE TRIGGER vendeur_chef_de_vente_unique
  BEFORE INSERT OR UPDATE ON vendeur
  FOR EACH ROW EXECUTE FUNCTION verifier_chef_de_vente_unique();

-- ---------------------------------------------------------------- interdit n.1
-- La porte de purge. Le refus reste le comportement PAR DEFAUT.

CREATE OR REPLACE FUNCTION interdire_suppression()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = relance, public
AS $$
BEGIN
  -- La porte : ouverte pour la duree d'UNE transaction, par la route de purge et
  -- par elle seule. `current_setting(..., true)` rend NULL si le parametre n'a
  -- jamais ete pose — donc le refus est bien le defaut, y compris sur une
  -- connexion neuve.
  IF coalesce(current_setting('relance.purge_autorisee', true), '') = 'oui' THEN
    RETURN NULL; -- trigger STATEMENT : la valeur de retour est ignoree
  END IF;

  RAISE EXCEPTION
    'RELANCE: suppression interdite sur %. Utiliser l''archivage (archive_le ou date_sortie). La purge definitive passe par l''ecran Archivage.',
    TG_TABLE_NAME;
END $$;
