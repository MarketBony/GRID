-- ============================================================================
-- LE TEMPS REEL — F-C.10 et critere de recette n.5.
--
-- « Deux chefs de table qui saisissent en meme temps ne se bloquent pas et voient
-- les compteurs de l'autre se mettre a jour. »
--
-- ---------------------------------------------------------------------------
-- POURQUOI UNE DIFFUSION PAR TRIGGER, ET PAS `postgres_changes`
-- ---------------------------------------------------------------------------
-- Supabase sait diffuser les changements d'une table (`postgres_changes`), et ce
-- serait le reflexe. Mais cette diffusion RESPECTE LA RLS : chaque abonne ne
-- recoit que les lignes qu'il aurait le droit de lire.
--
-- Or la politique de `rdv` restreint la lecture au PERIMETRE DE SAISIE — c'est
-- elle qui empeche le nom d'un client de sortir. Consequence : un chef de table ne
-- recevrait AUCUN evenement pour les RDV des autres tables, et le compteur du
-- tableau de bord ne bougerait plus pour lui. Le critere de recette n.5 tomberait
-- en silence.
--
-- C'est un conflit reel entre deux exigences justes — les compteurs sont publics,
-- les noms de clients ne le sont pas — et la diffusion par trigger le tranche :
-- elle emet une charge utile QUI NE CONTIENT PAS LE NOM DU CLIENT, sur un canal
-- par campagne. Exactement ce que faisait `emettre()` du temps de socket.io :
--
--     « Les evenements ne transportent JAMAIS le nom du client : ils portent de
--       quoi invalider un compteur (campagne, vendeur, jour, creneau). »
--
-- Le destinataire relit ensuite par les vues, qui appliquent leurs propres regles.
-- Diffuser la charge utile complete contournerait le portail.
--
-- ---------------------------------------------------------------------------
-- CANAL PAR CAMPAGNE
-- ---------------------------------------------------------------------------
-- Un chef de table de CENTRE n'a pas a recevoir le trafic de SUD-OUEST. Ce n'est
-- pas une mesure de confidentialite — les compteurs sont publics — mais un
-- evenement diffuse a tout le monde pendant une campagne a 99 vendeurs est du
-- bruit inutile, et ce bruit arrive pendant une saisie au clavier.
--
-- ---------------------------------------------------------------------------
-- `private := true`, DONC UNE POLITIQUE SUR `realtime.messages`
-- ---------------------------------------------------------------------------
-- Un canal prive exige un jeton et verifie une politique avant de laisser
-- quiconque s'y abonner. Sans cela, la cle publique suffirait a ecouter le trafic
-- de saisie de tout le groupe — pas les noms, mais le rythme et le volume, ce qui
-- n'a aucune raison d'etre public.
-- ============================================================================

SET search_path TO relance, public;

CREATE OR REPLACE FUNCTION relance.diffuser_rdv()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = relance, public, pg_temp
AS $fn$
BEGIN
  PERFORM realtime.send(
    -- LA CHARGE UTILE NE PORTE NI `client` NI `commentaire`. C'est la meme regle
    -- que la vue `rdv_agrege`, et elle est structurelle : il n'y a pas de champ a
    -- oublier de retirer, il n'y en a jamais eu.
    jsonb_build_object(
      'id', NEW.id::text,
      'vendeurId', NEW.vendeur_id::text,
      'jour', NEW.jour,
      'creneauCode', NEW.creneau_code,
      'marqueId', NEW.marque_id::text,
      'typeVehicule', NEW.type_vehicule,
      'archive', NEW.archive_le IS NOT NULL,
      -- QUI A ECRIT — pour que l'auteur puisse ignorer son propre evenement. Il a
      -- deja applique le changement localement (ecriture immediate, F-C.4) ; le lui
      -- rejouer provoquerait un second rendu, et pendant une saisie au clavier ce
      -- scintillement se voit. C'est ce que faisait l'en-tete `x-socket-id`.
      'auteur', coalesce(NEW.modifie_par, NEW.cree_par)::text
    ),
    'rdv',
    'campagne:' || NEW.campagne_id::text,
    true
  );
  RETURN NULL;
END $fn$;

-- LE TRIGGER N'EST POSE QUE LA OU `realtime.send` EXISTE.
--
-- Sur un PostgreSQL nu — la base de developpement — cette fonction n'existe pas :
-- le trigger echouerait a CHAQUE ecriture de RDV, donc pendant le seed, pendant
-- `test:garde-fous` et pendant `test:rls`. La fonction, elle, est creee dans les
-- deux cas : PL/pgSQL resout ses appels a l'execution, pas a la creation, donc son
-- corps peut nommer `realtime.send` sans que la fonction existe.
--
-- Consequence assumee : PAS DE TEMPS REEL EN LOCAL. Le critere de recette n.5 se
-- verifie donc contre Supabase, dans deux onglets — ce qui est de toute facon le
-- seul endroit ou il a un sens.
DO $trigger$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'realtime' AND p.proname = 'send'
  ) THEN
    EXECUTE $sql$
      DROP TRIGGER IF EXISTS rdv_diffusion ON relance.rdv;
      CREATE TRIGGER rdv_diffusion
        AFTER INSERT OR UPDATE ON relance.rdv
        FOR EACH ROW EXECUTE FUNCTION relance.diffuser_rdv();
    $sql$;
  ELSE
    RAISE NOTICE 'RELANCE: realtime.send absent — trigger de diffusion non pose (base locale).';
  END IF;
END $trigger$;

-- Qui peut ECOUTER. Tout compte actif — les compteurs sont publics — et personne
-- d'autre. `utilisateur_courant()` rend NULL pour un appelant anonyme, un compte
-- desactive ou un compte archive : les trois sont exclus d'un coup, exactement
-- comme partout ailleurs.
DO $politique$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_tables WHERE schemaname = 'realtime' AND tablename = 'messages'
  ) THEN
    EXECUTE $sql$
      DROP POLICY IF EXISTS "GRID - ecoute des canaux de campagne" ON realtime.messages;
      CREATE POLICY "GRID - ecoute des canaux de campagne"
        ON realtime.messages FOR SELECT TO authenticated
        USING (relance.utilisateur_courant() IS NOT NULL);
    $sql$;
  END IF;
END $politique$;
