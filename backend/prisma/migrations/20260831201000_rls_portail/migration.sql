-- ============================================================================
-- LE PORTAIL DEVIENT DU SQL.
--
-- Jusqu'ici, l'autorisation vivait dans `backend/src/auth/campagneScope.ts` :
-- une API Express faisait autorite, Prisma se connectait avec le role
-- proprietaire des tables, et la base ne cloisonnait RIEN. Ce serveur disparait.
-- Le navigateur attaque Supabase en direct avec une cle `anon` publique.
--
-- CONSEQUENCE, ECRITE UNE FOIS SANS L'ENJOLIVER : ce fichier est desormais la
-- SEULE chose entre un chef de table et les donnees de tout le groupe. Il n'y a
-- rien derriere. Une politique oubliee n'est pas une regression discrete, c'est
-- une fuite.
--
-- LES DEUX MODES D'ECHEC SONT SILENCIEUX, ET C'EST TOUT LE PROBLEME :
--   - trop fermee, la RLS rend ZERO LIGNE SANS ERREUR — l'ecran est vide et rien
--     dans la console ne dit pourquoi. Ce defaut est deja dans l'historique du
--     projet : `schema.sql` activait la RLS sans ecrire une seule politique ;
--   - trop ouverte, tout est lisible depuis la console du navigateur, et rien ne
--     le signale non plus.
--
-- D'ou la regle : activer la RLS et ecrire la politique vont ensemble, dans
-- cette migration, et `test:rls` verifie LES DEUX SENS avant tout deploiement.
--
-- ---------------------------------------------------------------------------
-- POURQUOI LES FONCTIONS SONT `SECURITY DEFINER`
-- ---------------------------------------------------------------------------
-- `utilisateur_courant()` lit `utilisateur`, qui porte elle-meme une politique
-- appelant `utilisateur_courant()`. En `security invoker`, c'est une recursion
-- infinie : Postgres la detecte et refuse la requete. `security definer` la
-- casse — la fonction s'execute avec les droits de son proprietaire, donc hors
-- RLS.
--
-- `search_path` est FIGE sur chacune. Une fonction `security definer` dont le
-- `search_path` est laisse a l'appelant est un moyen classique d'elever ses
-- droits : il suffit de placer une table homonyme dans un schema qu'on controle.
--
-- ---------------------------------------------------------------------------
-- ECRIRE `(select relance.…())` DANS LES POLITIQUES, PAS `relance.…()`
-- ---------------------------------------------------------------------------
-- Une fonction appelee directement dans une politique est evaluee UNE FOIS PAR
-- LIGNE. Enveloppee dans un sous-select, Postgres la remonte en `InitPlan` et ne
-- l'evalue qu'une fois par requete. Sur les 1107 RDV d'une campagne, la
-- difference se voit a l'ouverture du tableau de bord.
--
-- ---------------------------------------------------------------------------
-- COMPATIBILITE AVEC UN POSTGRES NU — le prelude ci-dessous
-- ---------------------------------------------------------------------------
-- Sur Supabase, les roles `anon` / `authenticated` et la fonction `auth.uid()`
-- existent deja. Sur le PostgreSQL 17 local, non — et sans prelude cette
-- migration serait injouable ailleurs que sur Supabase. Ce qui voudrait dire :
-- plus aucun essai en local, alors que le reseau du bureau bloque deja 5432/6543
-- vers l'exterieur.
--
-- Le prelude ne cree QUE ce qui manque : sur Supabase il ne fait rien. En local
-- il rend `test:garde-fous` ET `test:rls` jouables sans reseau, en posant
-- l'identite par `set local request.jwt.claim.sub`, exactement comme PostgREST.
-- ============================================================================

-- ---------------------------------------------------------------- prelude

DO $prelude$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN NOINHERIT BYPASSRLS;
  END IF;
END $prelude$;

CREATE SCHEMA IF NOT EXISTS auth;

-- L'implementation de reference de Supabase, recopiee pour que le comportement
-- local soit celui de la production. `IF NOT EXISTS` et non `CREATE OR REPLACE` :
-- on ne remplace jamais celle de Supabase.
DO $shim$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'auth' AND p.proname = 'uid'
  ) THEN
    EXECUTE $creation$
      CREATE FUNCTION auth.uid() RETURNS uuid
      LANGUAGE sql STABLE
      AS $corps$
        SELECT coalesce(
          nullif(current_setting('request.jwt.claim.sub', true), ''),
          (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
        )::uuid
      $corps$;
    $creation$;
  END IF;
END $shim$;

GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;

SET search_path TO relance, public;

-- ---------------------------------------------------------------- droits SQL
--
-- La RLS ne s'applique QU'APRES les droits SQL. Sans `GRANT`, on obtient un
-- `permission denied for table …` qui n'a rien a voir avec une politique et se
-- diagnostique tres mal : on cherche une politique manquante pendant une heure.
--
-- `anon` NE RECOIT RIEN, pas meme l'usage du schema. C'est le controle le plus
-- important de `test:rls` : la cle `anon` est publique, elle part dans le bundle
-- du navigateur, et elle ne doit ouvrir aucune porte. Le refus est ici FRANC —
-- une erreur de droits — plutot que silencieux. Une fuite se voit, un ecran vide
-- s'explique.

GRANT USAGE ON SCHEMA relance TO authenticated, service_role;
REVOKE ALL ON SCHEMA relance FROM anon;

-- Lecture pour tout compte authentifie. Les compteurs sont PUBLICS : c'est ce
-- qui rend les classements calculables et donne un objet au palier `lecteur`.
-- R-C.4 (« un chef de table ne voit que les vendeurs de sa table ») reste traitee
-- comme une regle d'ECRAN et non de confidentialite, comme aujourd'hui. Le nom du
-- client, lui, n'est pas public — voir la politique de `rdv`.
GRANT SELECT ON
  plaque, site, marque, campagne, campagne_jour, campagne_creneau,
  session_plaque, vendeur, vendeur_marque, table_phoning, affectation,
  role_global, role_campagne, encadrement_site
TO authenticated;

-- `utilisateur` : GRANT COLONNE PAR COLONNE, et surtout PAS `password_hash`.
--
-- Un `GRANT SELECT` sur la table entiere exposerait les empreintes bcrypt de tous
-- les comptes a n'importe quel utilisateur connecte, politique de lecture ouverte
-- ou non. LA RLS FILTRE DES LIGNES, JAMAIS DES COLONNES : c'est le role des
-- droits colonne, et c'est le genre d'oubli qui ne se voit sur aucun ecran.
-- `auth_uid` est retire pour la meme raison : rien dans l'interface n'en a besoin,
-- et l'identite Supabase d'autrui ne regarde personne.
GRANT SELECT (id, login_id, nom, actif, cree_le, cree_par, archive_le)
  ON utilisateur TO authenticated;

-- Ecriture. Le droit SQL est large, la RLS le retrecit — mais un droit NON
-- accorde ici ne peut etre rattrape par aucune politique.
GRANT INSERT, UPDATE ON
  plaque, site, marque, campagne, campagne_jour, campagne_creneau,
  session_plaque, vendeur, vendeur_marque, table_phoning, affectation,
  utilisateur, role_global, role_campagne, encadrement_site, rdv
TO authenticated;

GRANT SELECT ON rdv TO authenticated;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA relance TO authenticated;

-- INTERDIT N.1, PREMIERE DES TROIS SERRURES : aucun `DELETE` n'est accorde a
-- personne, sur aucune table. Les deux autres sont l'absence de toute politique
-- `FOR DELETE` (plus bas) et les 19 triggers `pas_de_delete`. Une suppression
-- doit franchir les trois ; la seule qui y parvienne est une purge appelee depuis
-- une fonction `security definer` nommee.

-- La table de suivi de Prisma serait exposee par PostgREST au meme titre que les
-- autres des lors que le schema `relance` est expose. Elle ne porte pas de donnee
-- personnelle mais elle decrit l'historique complet du schema : verrouillee.
REVOKE ALL ON _prisma_migrations FROM anon, authenticated;
ALTER TABLE _prisma_migrations ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------- fonctions

-- L'utilisateur derriere `auth.uid()`, ou NULL.
--
-- NULL couvre trois cas qui doivent tous se comporter pareil — aucun droit :
-- appelant anonyme, compte desactive (`actif = false`), compte archive. C'est la
-- transcription exacte de `DROITS_VIDES` dans `campagneScope.ts` : un jeton encore
-- valide emis avant une desactivation ne donne rien.
CREATE OR REPLACE FUNCTION relance.utilisateur_courant()
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = relance, public, pg_temp
AS $fn$
  SELECT u.id
  FROM relance.utilisateur u
  WHERE u.auth_uid = auth.uid()
    AND u.actif
    AND u.archive_le IS NULL
$fn$;

CREATE OR REPLACE FUNCTION relance.a_role_global(p_role text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = relance, public, pg_temp
AS $fn$
  SELECT EXISTS (
    SELECT 1 FROM relance.role_global rg
    WHERE rg.utilisateur_id = relance.utilisateur_courant()
      AND rg.role = p_role
  )
$fn$;

-- ADMINISTRATION des referentiels, des campagnes et des tables : `admin` ET
-- `direction`. Transcription de `peutAdministrer`.
CREATE OR REPLACE FUNCTION relance.peut_administrer()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = relance, public, pg_temp
AS $fn$
  SELECT relance.a_role_global('admin') OR relance.a_role_global('direction')
$fn$;

-- GESTION DES COMPTES : `admin` SEUL.
--
-- C'est la frontiere entre les deux paliers hauts, et la raison pour laquelle elle
-- existe : sans elle, `direction` pourrait se promouvoir `admin`. La meme frontiere
-- que GEARBOX a du fermer en interdisant a Director d'attribuer Director. Elle
-- n'est pas cosmetique et ne doit jamais etre elargie « pour simplifier ».
CREATE OR REPLACE FUNCTION relance.peut_gerer_utilisateurs()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = relance, public, pg_temp
AS $fn$
  SELECT relance.a_role_global('admin')
$fn$;

-- R-C.3 — une campagne cloturee ou archivee n'accepte plus AUCUNE ecriture.
-- Deja tenu par le trigger `rdv_campagne_ouverte` ; repete ici pour que le refus
-- arrive comme un refus de politique (zero ligne ecrite) et non seulement comme
-- une exception de trigger. Les deux sont testes, et c'est voulu : le trigger
-- protege aussi les ecritures qui ne passent pas par PostgREST.
CREATE OR REPLACE FUNCTION relance.campagne_ouverte(p_campagne_id bigint)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = relance, public, pg_temp
AS $fn$
  SELECT EXISTS (
    SELECT 1 FROM relance.campagne c
    WHERE c.id = p_campagne_id
      AND NOT c.cloturee
      AND c.archive_le IS NULL
  )
$fn$;

-- ---------------------------------------------------------------- le perimetre
--
-- LA VUE QUI REMPLACE LE PORTAIL. Transcription fidele de `vendeursSaisissables`
-- (`campagneScope.ts`), y compris son commentaire de tete : les politiques
-- d'ecriture ET le front lisent CETTE vue, et rien d'autre. C'est ce qui remplace
-- « aucune route ne recopie une clause de perimetre » — la regle ne change pas de
-- nature, seulement de langage.
--
-- QUATRE ORIGINES DE DROIT, reunies ici et nulle part ailleurs :
--   1. chef de plaque, POUR CETTE CAMPAGNE ;
--   2. chef de site pour cette campagne (`role_campagne`, exception ponctuelle) ;
--   3. ENCADRANT d'un site, DURABLEMENT — hors campagne. Un chef garde son
--      perimetre d'une campagne a l'autre, ce que `role_campagne` seul ne
--      permettait pas : un chef de juin se retrouvait sans aucun droit en
--      septembre ;
--   4. chef de table, pour cette campagne. La table peut contenir des vendeurs de
--      plusieurs concessions, et le chef venir d'une autre encore — c'est tout
--      l'objet de l'exercice, et c'est pourquoi l'encadrement ne peut pas etre un
--      drapeau sur `vendeur`.
--
-- Les origines 2 et 3 se recouvrent volontairement : l'une est temporaire, l'autre
-- durable. L'union etant faite en UN seul endroit, elles ne peuvent pas diverger.
--
-- LA PRESENCE DU VENDEUR est filtree ici aussi, avec la meme regle que
-- `presenceVendeur.ts` : « ce vendeur etait-il la PENDANT cette campagne ? », et
-- non « est-il encore la ? ». Une divergence entre les deux ferait bouger tout
-- seul l'effectif d'une campagne passee — le bug `RANK!AG` par un autre chemin.
--
-- POURQUOI UNE VUE ET NON UNE FONCTION. La vue appartient au proprietaire du
-- schema et n'active pas `security_invoker` : elle lit donc les tables sous-jacentes
-- SANS RLS, ce qui evite toute recursion avec les politiques qui la consultent.
-- Elle reste sure parce qu'elle se filtre elle-meme sur `utilisateur_courant()` :
-- chaque compte n'y voit que ses propres lignes.
CREATE OR REPLACE VIEW relance.perimetre_saisie AS
SELECT c.id AS campagne_id,
       v.id AS vendeur_id
FROM relance.campagne c
CROSS JOIN relance.vendeur v
WHERE relance.utilisateur_courant() IS NOT NULL
  AND v.archive_le IS NULL
  AND (v.date_entree IS NULL OR v.date_entree <= c.date_fin)
  AND (v.date_sortie IS NULL OR v.date_sortie >= c.date_debut)
  AND (
    -- `admin` ET `direction` : les deux paliers hauts ont un ACCES TOTAL, saisie
    -- comprise. La seule chose que `direction` ne peut pas faire, c'est gerer les
    -- comptes, et c'est une porte separee. Le script des comptes de test avait
    -- deja attrape l'erreur inverse : `direction.test` ressortait avec zero vendeur
    -- saisissable alors que la specification dit « acces total ».
    relance.peut_administrer()

    -- 1. chef de plaque, pour cette campagne
    OR EXISTS (
      SELECT 1
      FROM relance.role_campagne rc
      JOIN relance.site s ON s.id = v.site_id
      WHERE rc.utilisateur_id = relance.utilisateur_courant()
        AND rc.campagne_id = c.id
        AND rc.role = 'chef_plaque'
        AND rc.plaque_id = s.plaque_id
        AND rc.archive_le IS NULL
    )

    -- 2. chef de site pour cette campagne
    OR EXISTS (
      SELECT 1
      FROM relance.role_campagne rc
      WHERE rc.utilisateur_id = relance.utilisateur_courant()
        AND rc.campagne_id = c.id
        AND rc.role = 'chef_site'
        AND rc.site_id = v.site_id
        AND rc.archive_le IS NULL
    )

    -- 3. encadrement DURABLE d'un site — hors campagne, volontairement
    OR EXISTS (
      SELECT 1
      FROM relance.encadrement_site es
      WHERE es.utilisateur_id = relance.utilisateur_courant()
        AND es.site_id = v.site_id
        AND es.archive_le IS NULL
    )

    -- 4. chef de table, pour cette campagne
    OR EXISTS (
      SELECT 1
      FROM relance.affectation a
      JOIN relance.table_phoning t ON t.id = a.table_id
      JOIN relance.session_plaque sp ON sp.id = t.session_plaque_id
      WHERE a.vendeur_id = v.id
        AND a.archive_le IS NULL
        AND t.archive_le IS NULL
        AND t.chef_utilisateur_id = relance.utilisateur_courant()
        AND sp.campagne_id = c.id
        AND sp.archive_le IS NULL
    )
  );

GRANT SELECT ON relance.perimetre_saisie TO authenticated;

-- Le meme perimetre, en predicat, pour les politiques. Il n'y a pas deux regles :
-- cette fonction LIT la vue. Deux implementations de la meme regle finissent
-- toujours par diverger, et c'est celle-ci qui autorise l'ecriture.
CREATE OR REPLACE FUNCTION relance.peut_saisir(p_vendeur_id bigint, p_campagne_id bigint)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = relance, public, pg_temp
AS $fn$
  SELECT EXISTS (
    SELECT 1 FROM relance.perimetre_saisie ps
    WHERE ps.vendeur_id = p_vendeur_id
      AND ps.campagne_id = p_campagne_id
  )
$fn$;

-- ---------------------------------------------------------------- rdv_agrege
--
-- CE QUI REMPLACE `redacterRdvs`.
--
-- Le tableau de bord doit compter les RDV de TOUT LE MONDE — c'est ce qui produit
-- les classements. Mais le NOM DU CLIENT n'est pas public : un chef de table qui
-- ouvre le tableau de bord n'a aucune raison de recuperer la clientele des autres
-- tables, et ces noms sont des donnees personnelles.
--
-- L'API redigeait ces champs a la volee. Ici, la protection est structurelle : le
-- nom du client ne peut pas sortir de cette vue PUISQU'IL N'Y EST PAS. Il n'y a
-- pas de champ a oublier de rediger dans une nouvelle route, parce qu'il n'y a
-- plus de route.
--
-- La vue ne porte pas `security_invoker` : elle voit donc tous les RDV, alors que
-- la table `rdv` reste fermee au seul perimetre de saisie. C'est exactement le
-- partage voulu — les compteurs pour tous, les noms pour ceux qui saisissent.
CREATE OR REPLACE VIEW relance.rdv_agrege AS
SELECT r.id,
       r.campagne_id,
       r.vendeur_id,
       r.jour,
       r.creneau_code,
       r.marque_id,
       r.type_vehicule,
       r.cree_le,
       r.archive_le
FROM relance.rdv r;

GRANT SELECT ON relance.rdv_agrege TO authenticated;

-- ---------------------------------------------------------------- tracabilite
--
-- QUI A ECRIT CETTE LIGNE — la reponse ne peut plus venir du client.
--
-- Avec une API, `cree_par` etait pose par le serveur a partir du jeton verifie.
-- En direct sur PostgREST, c'est le navigateur qui compose le corps de la
-- requete : il peut y ecrire n'importe quel identifiant. L'attribution serait donc
-- declarative, ce qui la rendrait inutile — et elle sert precisement le jour ou un
-- RDV est conteste.
--
-- Le trigger l'impose. Il n'ecrase RIEN quand `utilisateur_courant()` est NULL :
-- le seed, les migrations et les scripts d'administration tournent hors session
-- Supabase et doivent garder la main sur `cree_par`.
CREATE OR REPLACE FUNCTION relance.tracer_creation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = relance, public, pg_temp
AS $fn$
DECLARE
  moi bigint := relance.utilisateur_courant();
BEGIN
  IF moi IS NOT NULL THEN
    NEW.cree_par := moi;
  END IF;
  RETURN NEW;
END $fn$;

CREATE OR REPLACE FUNCTION relance.tracer_modification_rdv()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = relance, public, pg_temp
AS $fn$
DECLARE
  moi bigint := relance.utilisateur_courant();
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF moi IS NOT NULL THEN NEW.cree_par := moi; END IF;
    RETURN NEW;
  END IF;

  IF moi IS NOT NULL THEN
    NEW.modifie_par := moi;
    -- L'ARCHIVAGE EST UN UPDATE, c'est la seule facon de retirer un RDV. On veut
    -- donc savoir qui l'a retire, et pas seulement qui l'a modifie en dernier.
    IF NEW.archive_le IS NOT NULL AND OLD.archive_le IS NULL THEN
      NEW.archive_par := moi;
    END IF;
  END IF;
  NEW.modifie_le := now();

  -- `cree_par` et `cree_le` ne se reecrivent jamais. Sans cette ligne, un client
  -- pourrait se declarer auteur d'un RDV saisi par quelqu'un d'autre en le
  -- modifiant — l'attribution serait alors reecrivable a volonte.
  NEW.cree_par := OLD.cree_par;
  NEW.cree_le := OLD.cree_le;
  RETURN NEW;
END $fn$;

CREATE TRIGGER rdv_tracabilite
  BEFORE INSERT OR UPDATE ON rdv
  FOR EACH ROW EXECUTE FUNCTION relance.tracer_modification_rdv();

CREATE TRIGGER vendeur_tracabilite
  BEFORE INSERT ON vendeur
  FOR EACH ROW EXECUTE FUNCTION relance.tracer_creation();

CREATE TRIGGER table_phoning_tracabilite
  BEFORE INSERT ON table_phoning
  FOR EACH ROW EXECUTE FUNCTION relance.tracer_creation();

CREATE TRIGGER affectation_tracabilite
  BEFORE INSERT ON affectation
  FOR EACH ROW EXECUTE FUNCTION relance.tracer_creation();

CREATE TRIGGER session_plaque_tracabilite
  BEFORE INSERT ON session_plaque
  FOR EACH ROW EXECUTE FUNCTION relance.tracer_creation();

CREATE TRIGGER campagne_tracabilite
  BEFORE INSERT ON campagne
  FOR EACH ROW EXECUTE FUNCTION relance.tracer_creation();

CREATE TRIGGER encadrement_site_tracabilite
  BEFORE INSERT ON encadrement_site
  FOR EACH ROW EXECUTE FUNCTION relance.tracer_creation();

CREATE TRIGGER role_global_tracabilite
  BEFORE INSERT ON role_global
  FOR EACH ROW EXECUTE FUNCTION relance.tracer_creation();

CREATE TRIGGER role_campagne_tracabilite
  BEFORE INSERT ON role_campagne
  FOR EACH ROW EXECUTE FUNCTION relance.tracer_creation();

-- ============================================================================
-- LES POLITIQUES
--
-- `ENABLE ROW LEVEL SECURITY` SUR TOUTES LES TABLES, Y COMPRIS CELLES QU'ON CROIT
-- INOFFENSIVES. Une table oubliee reste entierement lisible : la RLS n'est pas un
-- reglage global, elle se pose table par table. `marque` semble anodine — jusqu'a
-- ce qu'on realise qu'aucune n'est plus protegee que la moins protegee.
--
-- Trois familles de droit d'ecriture, et aucune quatrieme :
--   `peut_administrer()`        — referentiels, campagnes, tables, vendeurs
--   `peut_gerer_utilisateurs()` — comptes, roles, encadrements
--   `peut_saisir(...)`          — les RDV, et eux seuls
--
-- AUCUNE POLITIQUE `FOR DELETE` N'EXISTE DANS CE FICHIER. Ce n'est pas un oubli,
-- c'est la deuxieme serrure de l'interdit n.1.
-- ============================================================================

-- ---------------------------------------------------------------- referentiels

ALTER TABLE plaque ENABLE ROW LEVEL SECURITY;
CREATE POLICY plaque_lecture ON plaque FOR SELECT TO authenticated
  USING ((SELECT relance.utilisateur_courant()) IS NOT NULL);
CREATE POLICY plaque_creation ON plaque FOR INSERT TO authenticated
  WITH CHECK ((SELECT relance.peut_administrer()));
CREATE POLICY plaque_modification ON plaque FOR UPDATE TO authenticated
  USING ((SELECT relance.peut_administrer()))
  WITH CHECK ((SELECT relance.peut_administrer()));

ALTER TABLE site ENABLE ROW LEVEL SECURITY;
CREATE POLICY site_lecture ON site FOR SELECT TO authenticated
  USING ((SELECT relance.utilisateur_courant()) IS NOT NULL);
CREATE POLICY site_creation ON site FOR INSERT TO authenticated
  WITH CHECK ((SELECT relance.peut_administrer()));
CREATE POLICY site_modification ON site FOR UPDATE TO authenticated
  USING ((SELECT relance.peut_administrer()))
  WITH CHECK ((SELECT relance.peut_administrer()));

ALTER TABLE marque ENABLE ROW LEVEL SECURITY;
CREATE POLICY marque_lecture ON marque FOR SELECT TO authenticated
  USING ((SELECT relance.utilisateur_courant()) IS NOT NULL);
CREATE POLICY marque_creation ON marque FOR INSERT TO authenticated
  WITH CHECK ((SELECT relance.peut_administrer()));
CREATE POLICY marque_modification ON marque FOR UPDATE TO authenticated
  USING ((SELECT relance.peut_administrer()))
  WITH CHECK ((SELECT relance.peut_administrer()));

-- ---------------------------------------------------------------- campagnes

ALTER TABLE campagne ENABLE ROW LEVEL SECURITY;
CREATE POLICY campagne_lecture ON campagne FOR SELECT TO authenticated
  USING ((SELECT relance.utilisateur_courant()) IS NOT NULL);
CREATE POLICY campagne_creation ON campagne FOR INSERT TO authenticated
  WITH CHECK ((SELECT relance.peut_administrer()));
CREATE POLICY campagne_modification ON campagne FOR UPDATE TO authenticated
  USING ((SELECT relance.peut_administrer()))
  WITH CHECK ((SELECT relance.peut_administrer()));

ALTER TABLE campagne_jour ENABLE ROW LEVEL SECURITY;
CREATE POLICY campagne_jour_lecture ON campagne_jour FOR SELECT TO authenticated
  USING ((SELECT relance.utilisateur_courant()) IS NOT NULL);
CREATE POLICY campagne_jour_creation ON campagne_jour FOR INSERT TO authenticated
  WITH CHECK ((SELECT relance.peut_administrer()));
CREATE POLICY campagne_jour_modification ON campagne_jour FOR UPDATE TO authenticated
  USING ((SELECT relance.peut_administrer()))
  WITH CHECK ((SELECT relance.peut_administrer()));

ALTER TABLE campagne_creneau ENABLE ROW LEVEL SECURITY;
CREATE POLICY campagne_creneau_lecture ON campagne_creneau FOR SELECT TO authenticated
  USING ((SELECT relance.utilisateur_courant()) IS NOT NULL);
CREATE POLICY campagne_creneau_creation ON campagne_creneau FOR INSERT TO authenticated
  WITH CHECK ((SELECT relance.peut_administrer()));
CREATE POLICY campagne_creneau_modification ON campagne_creneau FOR UPDATE TO authenticated
  USING ((SELECT relance.peut_administrer()))
  WITH CHECK ((SELECT relance.peut_administrer()));

ALTER TABLE session_plaque ENABLE ROW LEVEL SECURITY;
CREATE POLICY session_plaque_lecture ON session_plaque FOR SELECT TO authenticated
  USING ((SELECT relance.utilisateur_courant()) IS NOT NULL);
CREATE POLICY session_plaque_creation ON session_plaque FOR INSERT TO authenticated
  WITH CHECK ((SELECT relance.peut_administrer()));
CREATE POLICY session_plaque_modification ON session_plaque FOR UPDATE TO authenticated
  USING ((SELECT relance.peut_administrer()))
  WITH CHECK ((SELECT relance.peut_administrer()));

-- ---------------------------------------------------------------- vendeurs

ALTER TABLE vendeur ENABLE ROW LEVEL SECURITY;
CREATE POLICY vendeur_lecture ON vendeur FOR SELECT TO authenticated
  USING ((SELECT relance.utilisateur_courant()) IS NOT NULL);
CREATE POLICY vendeur_creation ON vendeur FOR INSERT TO authenticated
  WITH CHECK ((SELECT relance.peut_administrer()));
CREATE POLICY vendeur_modification ON vendeur FOR UPDATE TO authenticated
  USING ((SELECT relance.peut_administrer()))
  WITH CHECK ((SELECT relance.peut_administrer()));

ALTER TABLE vendeur_marque ENABLE ROW LEVEL SECURITY;
CREATE POLICY vendeur_marque_lecture ON vendeur_marque FOR SELECT TO authenticated
  USING ((SELECT relance.utilisateur_courant()) IS NOT NULL);
CREATE POLICY vendeur_marque_creation ON vendeur_marque FOR INSERT TO authenticated
  WITH CHECK ((SELECT relance.peut_administrer()));
CREATE POLICY vendeur_marque_modification ON vendeur_marque FOR UPDATE TO authenticated
  USING ((SELECT relance.peut_administrer()))
  WITH CHECK ((SELECT relance.peut_administrer()));

-- ---------------------------------------------------------------- tables

ALTER TABLE table_phoning ENABLE ROW LEVEL SECURITY;
CREATE POLICY table_phoning_lecture ON table_phoning FOR SELECT TO authenticated
  USING ((SELECT relance.utilisateur_courant()) IS NOT NULL);
CREATE POLICY table_phoning_creation ON table_phoning FOR INSERT TO authenticated
  WITH CHECK ((SELECT relance.peut_administrer()));
CREATE POLICY table_phoning_modification ON table_phoning FOR UPDATE TO authenticated
  USING ((SELECT relance.peut_administrer()))
  WITH CHECK ((SELECT relance.peut_administrer()));

ALTER TABLE affectation ENABLE ROW LEVEL SECURITY;
CREATE POLICY affectation_lecture ON affectation FOR SELECT TO authenticated
  USING ((SELECT relance.utilisateur_courant()) IS NOT NULL);
CREATE POLICY affectation_creation ON affectation FOR INSERT TO authenticated
  WITH CHECK ((SELECT relance.peut_administrer()));
CREATE POLICY affectation_modification ON affectation FOR UPDATE TO authenticated
  USING ((SELECT relance.peut_administrer()))
  WITH CHECK ((SELECT relance.peut_administrer()));

-- ---------------------------------------------------------------- comptes
--
-- Ecriture reservee a `peut_gerer_utilisateurs()`, c'est-a-dire a `admin` seul.
-- C'est ici, et nulle part ailleurs, que se tient la frontiere avec `direction`.

ALTER TABLE utilisateur ENABLE ROW LEVEL SECURITY;
CREATE POLICY utilisateur_lecture ON utilisateur FOR SELECT TO authenticated
  USING ((SELECT relance.utilisateur_courant()) IS NOT NULL);
CREATE POLICY utilisateur_creation ON utilisateur FOR INSERT TO authenticated
  WITH CHECK ((SELECT relance.peut_gerer_utilisateurs()));
CREATE POLICY utilisateur_modification ON utilisateur FOR UPDATE TO authenticated
  USING ((SELECT relance.peut_gerer_utilisateurs()))
  WITH CHECK ((SELECT relance.peut_gerer_utilisateurs()));

ALTER TABLE role_global ENABLE ROW LEVEL SECURITY;
CREATE POLICY role_global_lecture ON role_global FOR SELECT TO authenticated
  USING ((SELECT relance.utilisateur_courant()) IS NOT NULL);
CREATE POLICY role_global_creation ON role_global FOR INSERT TO authenticated
  WITH CHECK ((SELECT relance.peut_gerer_utilisateurs()));
CREATE POLICY role_global_modification ON role_global FOR UPDATE TO authenticated
  USING ((SELECT relance.peut_gerer_utilisateurs()))
  WITH CHECK ((SELECT relance.peut_gerer_utilisateurs()));

ALTER TABLE role_campagne ENABLE ROW LEVEL SECURITY;
CREATE POLICY role_campagne_lecture ON role_campagne FOR SELECT TO authenticated
  USING ((SELECT relance.utilisateur_courant()) IS NOT NULL);
CREATE POLICY role_campagne_creation ON role_campagne FOR INSERT TO authenticated
  WITH CHECK ((SELECT relance.peut_gerer_utilisateurs()));
CREATE POLICY role_campagne_modification ON role_campagne FOR UPDATE TO authenticated
  USING ((SELECT relance.peut_gerer_utilisateurs()))
  WITH CHECK ((SELECT relance.peut_gerer_utilisateurs()));

ALTER TABLE encadrement_site ENABLE ROW LEVEL SECURITY;
CREATE POLICY encadrement_site_lecture ON encadrement_site FOR SELECT TO authenticated
  USING ((SELECT relance.utilisateur_courant()) IS NOT NULL);
CREATE POLICY encadrement_site_creation ON encadrement_site FOR INSERT TO authenticated
  WITH CHECK ((SELECT relance.peut_gerer_utilisateurs()));
CREATE POLICY encadrement_site_modification ON encadrement_site FOR UPDATE TO authenticated
  USING ((SELECT relance.peut_gerer_utilisateurs()))
  WITH CHECK ((SELECT relance.peut_gerer_utilisateurs()));

-- ---------------------------------------------------------------- rdv
--
-- LA SEULE TABLE DONT LA LECTURE EST RESTREINTE, et c'est a cause d'une seule
-- colonne : `client`. Les compteurs sont publics, les noms de clients non.
-- Le tableau de bord ne lit donc pas cette table mais `rdv_agrege`, qui n'a pas
-- la colonne.
--
-- L'ECRITURE EST DOUBLEMENT CONDITIONNEE — perimetre ET campagne ouverte. La
-- seconde condition est aussi tenue par un trigger : un refus de politique est
-- silencieux (zero ligne), un refus de trigger porte un message. On veut les deux,
-- parce qu'ils ne protegent pas les memes chemins.
--
-- PAS DE POLITIQUE `FOR DELETE` : archiver un RDV est un UPDATE de `archive_le`,
-- et c'est la seule facon de le retirer d'un total.

ALTER TABLE rdv ENABLE ROW LEVEL SECURITY;

CREATE POLICY rdv_lecture ON rdv FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM relance.perimetre_saisie ps
      WHERE ps.campagne_id = rdv.campagne_id
        AND ps.vendeur_id = rdv.vendeur_id
    )
  );

CREATE POLICY rdv_creation ON rdv FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT relance.peut_saisir(rdv.vendeur_id, rdv.campagne_id))
    AND (SELECT relance.campagne_ouverte(rdv.campagne_id))
  );

-- `USING` controle la ligne AVANT modification, `WITH CHECK` celle d'APRES. Les
-- deux sont necessaires : sans `WITH CHECK`, un chef de table pourrait deplacer un
-- RDV de son perimetre vers un vendeur qui n'en fait pas partie — l'ecriture
-- sortirait du perimetre par la porte de sortie plutot que par celle d'entree.
CREATE POLICY rdv_modification ON rdv FOR UPDATE TO authenticated
  USING (
    (SELECT relance.peut_saisir(rdv.vendeur_id, rdv.campagne_id))
    AND (SELECT relance.campagne_ouverte(rdv.campagne_id))
  )
  WITH CHECK (
    (SELECT relance.peut_saisir(rdv.vendeur_id, rdv.campagne_id))
    AND (SELECT relance.campagne_ouverte(rdv.campagne_id))
  );
