-- ============================================================================
-- INVARIANTS QUE PRISMA NE SAIT PAS EXPRIMER
--
-- Prisma ne gere NI les contraintes CHECK NI les triggers : il ne les voit pas,
-- donc il ne proposera jamais de les supprimer. Ces objets survivent aux
-- migrations suivantes, contrairement aux index (raison pour laquelle il n'y a
-- aucun index partiel dans ce projet — voir l'en-tete de schema.prisma).
--
-- Ce qui est ici est un FILET, pas la regle principale. La regle principale est
-- appliquee par l'API (`backend/src/auth/campagneScope.ts` pour le perimetre,
-- `roles.ts` pour les valeurs). Mais une route qu'on ajoute a 23 h la veille
-- d'une campagne peut oublier un controle ; la base, non.
--
-- Les messages des triggers sont prefixes `RELANCE:` : `middleware/errorHandler.ts`
-- les reconnait et les renvoie en 422 avec leur texte, pour que le chef de table
-- lise la raison du refus au lieu d'un << erreur serveur >>.
-- ============================================================================

SET search_path TO relance, public;

-- ---------------------------------------------------------------- contraintes CHECK
-- Ces listes sont dupliquees avec `backend/src/auth/roles.ts`, et c'est assume :
-- la base ne peut pas importer du TypeScript. La duplication n'est PAS laissee
-- << a synchroniser a la main >> — c'est exactement l'oubli silencieux que
-- `check-plaques-sync.mjs` combat sur GEARBOX. Ici, `utils/verifierInvariants.ts`
-- compare les deux AU DEMARRAGE DU SERVEUR et refuse de demarrer si elles
-- divergent. Ajouter une valeur d'un seul cote fait echouer le boot, tout de suite.

ALTER TABLE role_global
  ADD CONSTRAINT role_global_role_check
  CHECK (role IN ('admin', 'lecteur'));

ALTER TABLE role_campagne
  ADD CONSTRAINT role_campagne_role_check
  CHECK (role IN ('chef_plaque', 'chef_site'));

-- Un chef de plaque porte une plaque, un chef de site porte un site. Jamais les
-- deux, jamais aucun : sans cette contrainte, une ligne `chef_plaque` sans
-- `plaque_id` ne donnerait aucun droit et ressemblerait pourtant a un droit
-- accorde. Le pire cas d'un modele d'autorisation : silencieusement inoperant.
ALTER TABLE role_campagne
  ADD CONSTRAINT role_campagne_portee_check
  CHECK (
    (role = 'chef_plaque' AND plaque_id IS NOT NULL AND site_id IS NULL)
    OR
    (role = 'chef_site'   AND site_id   IS NOT NULL AND plaque_id IS NULL)
  );

ALTER TABLE session_plaque
  ADD CONSTRAINT session_plaque_mode_check
  CHECK (mode IN ('par_site', 'par_table'));

ALTER TABLE affectation
  ADD CONSTRAINT affectation_origine_check
  CHECK (origine IN ('auto', 'manuel'));

ALTER TABLE rdv
  ADD CONSTRAINT rdv_type_vehicule_check
  CHECK (type_vehicule IN ('VN', 'VO'));

-- Un RDV sans nom de client n'est pas un RDV, c'est une case cochee par erreur.
-- Garde-fou accessoire : `campagneScope.redacterRdvs` remplace `client` par une
-- chaine vide pour les lectures hors perimetre. Si un jour du code reecrivait en
-- base un objet ainsi redacte, cette contrainte l'arrete au lieu d'effacer un nom.
ALTER TABLE rdv
  ADD CONSTRAINT rdv_client_non_vide_check
  CHECK (length(btrim(client)) > 0);

ALTER TABLE campagne
  ADD CONSTRAINT campagne_dates_coherentes_check
  CHECK (date_fin >= date_debut);

-- Une date de sortie anterieure a la date d'entree rendrait `presenceVendeur`
-- toujours faux : le vendeur disparaitrait de toutes les campagnes sans que rien
-- ne signale pourquoi.
ALTER TABLE vendeur
  ADD CONSTRAINT vendeur_dates_coherentes_check
  CHECK (date_sortie IS NULL OR date_entree IS NULL OR date_sortie >= date_entree);

-- ---------------------------------------------------------------- R-B.4
-- Un vendeur ne peut appartenir qu'a UNE table par campagne.
--
-- Un index unique ne suffit pas : la campagne n'est pas une colonne
-- d'`affectation`, elle s'atteint en remontant table_phoning -> session_plaque.
-- D'ou le trigger.
--
-- Ne compte que les affectations ACTIVES (`archive_le is null`) : desaffecter un
-- vendeur d'une table doit liberer sa place, sinon on ne pourrait plus jamais le
-- deplacer.

CREATE OR REPLACE FUNCTION verifier_affectation_unique()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = relance, public
AS $$
DECLARE
  autre_table text;
BEGIN
  -- Une ligne archivee ne reserve rien.
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
    AND a.id <> COALESCE(NEW.id, -1)
    AND s_autre.campagne_id = s_new.campagne_id
  LIMIT 1;

  IF autre_table IS NOT NULL THEN
    RAISE EXCEPTION 'RELANCE: ce vendeur est deja affecte a la table "%" pour cette campagne.', autre_table;
  END IF;

  RETURN NEW;
END $$;

CREATE TRIGGER affectation_unique_par_campagne
  BEFORE INSERT OR UPDATE ON affectation
  FOR EACH ROW EXECUTE FUNCTION verifier_affectation_unique();

-- ---------------------------------------------------------------- R-C.1
-- Un vendeur ne peut recevoir un RDV que sur une marque qu'il est autorise a
-- vendre.
--
-- ATTENTION — cette regle ne protege RIEN tant que `vendeur_marque` n'a pas ete
-- corrige vendeur par vendeur via l'ecran A3. Le seed pose un placeholder
-- Renault + Dacia pour tout le monde, parce que l'information n'existe pas dans
-- le fichier Excel source : tous les blocs vendeur y portent une section Renault
-- ET une section Dacia, quelle que soit la realite du terrain.

CREATE OR REPLACE FUNCTION verifier_marque_autorisee()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = relance, public
AS $$
DECLARE
  nom_vendeur text;
  nom_marque  text;
BEGIN
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

CREATE TRIGGER rdv_marque_autorisee
  BEFORE INSERT OR UPDATE OF vendeur_id, marque_id ON rdv
  FOR EACH ROW EXECUTE FUNCTION verifier_marque_autorisee();

-- ---------------------------------------------------------------- R-C.3
-- Aucune ecriture sur une campagne cloturee, ni insertion, ni modification, ni
-- archivage. Cloturer FIGE : c'est ce qui permet de dire qu'un dashboard de
-- campagne passee ne bougera plus.

CREATE OR REPLACE FUNCTION verifier_campagne_ouverte()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = relance, public
AS $$
DECLARE
  c record;
BEGIN
  SELECT libelle, cloturee, archive_le INTO c
  FROM campagne
  WHERE id = COALESCE(NEW.campagne_id, OLD.campagne_id);

  IF c.cloturee THEN
    RAISE EXCEPTION 'RELANCE: la campagne "%" est cloturee, plus aucune saisie n''est possible.', c.libelle;
  END IF;

  IF c.archive_le IS NOT NULL THEN
    RAISE EXCEPTION 'RELANCE: la campagne "%" est archivee.', c.libelle;
  END IF;

  RETURN COALESCE(NEW, OLD);
END $$;

CREATE TRIGGER rdv_campagne_ouverte
  BEFORE INSERT OR UPDATE OR DELETE ON rdv
  FOR EACH ROW EXECUTE FUNCTION verifier_campagne_ouverte();

-- ---------------------------------------------------------------- interdit n.1
-- Aucune suppression de donnee metier. L'API n'expose aucune route de
-- suppression, mais une requete lancee a la main dans un client SQL un soir de
-- campagne ne passe pas par l'API. Ces triggers rendent la perte impossible, pas
-- seulement interdite par convention.
--
-- `campagne_jour` et `campagne_creneau` sont volontairement ABSENTS de cette
-- liste : les retirer est une operation legitime (F-A4.2, F-A4.3), et c'est la
-- cle etrangere composite de `rdv` qui la refuse quand des RDV en dependent
-- (R-A.2). Interdire le DELETE ici empecherait de corriger une erreur de saisie
-- de creneau sur une campagne encore vide.

CREATE OR REPLACE FUNCTION interdire_suppression()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = relance, public
AS $$
BEGIN
  RAISE EXCEPTION
    'RELANCE: suppression interdite sur %. Utiliser l''archivage (archive_le ou date_sortie).',
    TG_TABLE_NAME;
END $$;

CREATE TRIGGER plaque_pas_de_delete        BEFORE DELETE ON plaque         FOR EACH STATEMENT EXECUTE FUNCTION interdire_suppression();
CREATE TRIGGER site_pas_de_delete          BEFORE DELETE ON site           FOR EACH STATEMENT EXECUTE FUNCTION interdire_suppression();
CREATE TRIGGER marque_pas_de_delete        BEFORE DELETE ON marque         FOR EACH STATEMENT EXECUTE FUNCTION interdire_suppression();
CREATE TRIGGER vendeur_pas_de_delete       BEFORE DELETE ON vendeur        FOR EACH STATEMENT EXECUTE FUNCTION interdire_suppression();
CREATE TRIGGER campagne_pas_de_delete      BEFORE DELETE ON campagne       FOR EACH STATEMENT EXECUTE FUNCTION interdire_suppression();
CREATE TRIGGER rdv_pas_de_delete           BEFORE DELETE ON rdv            FOR EACH STATEMENT EXECUTE FUNCTION interdire_suppression();
CREATE TRIGGER affectation_pas_de_delete   BEFORE DELETE ON affectation    FOR EACH STATEMENT EXECUTE FUNCTION interdire_suppression();
CREATE TRIGGER table_phoning_pas_de_delete BEFORE DELETE ON table_phoning  FOR EACH STATEMENT EXECUTE FUNCTION interdire_suppression();
CREATE TRIGGER session_plaque_pas_de_delete BEFORE DELETE ON session_plaque FOR EACH STATEMENT EXECUTE FUNCTION interdire_suppression();
CREATE TRIGGER utilisateur_pas_de_delete   BEFORE DELETE ON utilisateur    FOR EACH STATEMENT EXECUTE FUNCTION interdire_suppression();
