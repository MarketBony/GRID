-- ============================================================================
-- LES OPERATIONS PRIVILEGIEES — ce que PostgREST ne sait pas faire.
--
-- POURQUOI CES FONCTIONS EXISTENT, en une phrase : PostgREST n'a pas de
-- transaction cote client. Chaque appel HTTP est sa propre transaction, et rien
-- ne permet d'en enchainer plusieurs sous un meme verrou.
--
-- Or le produit compte ONZE chemins d'ecriture qui doivent etre tout-ou-rien.
-- « Remplacer les vendeurs d'une table » en six appels laisse une table a moitie
-- composee si le reseau lache au troisieme. Une repartition a moitie appliquee est
-- pire que pas de repartition du tout : personne ne sait dans quel etat elle est.
--
-- Chaque fonction ci-dessous porte donc UNE transaction, et remplace exactement un
-- `prisma.$transaction` de l'API Express supprimee.
--
-- ---------------------------------------------------------------------------
-- CE QUI RESTE EN TYPESCRIPT, ET POURQUOI
-- ---------------------------------------------------------------------------
-- La REPARTITION GRAINE 42 n'est pas reecrite ici. `utils/repartition.ts` est une
-- fonction pure, couverte par 20 controles, et le critere F-B.5 exige qu'elle soit
-- reproductible donc contestable. La retranscrire en PL/pgSQL creerait une seconde
-- implementation du meme algorithme, et le jour ou les deux divergeraient on ne
-- saurait plus laquelle fait foi. Le navigateur CALCULE la repartition ; la
-- fonction `session_appliquer_repartition` se contente de l'ECRIRE, atomiquement.
--
-- Meme partage pour l'import des marques : `utils/importMarques.ts` analyse (19
-- controles), la fonction applique.
--
-- ---------------------------------------------------------------------------
-- `SECURITY DEFINER` DESARME LA RLS : CHAQUE FONCTION REVERIFIE SES DROITS
-- ---------------------------------------------------------------------------
-- C'est la contrepartie du pouvoir qu'on leur donne. Une fonction qui oublierait
-- son controle d'acces serait une porte derobee ouverte a tout compte connecte,
-- puisqu'elle s'execute avec les droits du proprietaire.
--
-- Et l'execution est RETIREE A `public` puis accordee au seul role
-- `authenticated` : par defaut, PostgreSQL laisse TOUT LE MONDE executer une
-- fonction, y compris `anon`. Oublier ce `revoke` aurait rendu la purge appelable
-- sans jeton.
--
-- ---------------------------------------------------------------------------
-- LA PORTE DE PURGE EST MIEUX ENFERMEE QU'AVANT
-- ---------------------------------------------------------------------------
-- `SET LOCAL relance.purge_autorisee = 'oui'` ne vit plus dans une route Express
-- mais A L'INTERIEUR de `vendeur_purger` et `utilisateur_purger`. Aucun `DELETE`
-- n'est accorde a personne sur aucune table : la porte n'existe donc plus que dans
-- ces deux fonctions, et elle exige toujours que la ligne soit DEJA archivee et
-- que le nom exact soit retape.
--
-- (`CLAUDE.md` dit encore « le seul appelant legitime est DELETE
--  /api/vendeurs/:id ». Il y en avait deux — la suppression d'un compte aussi. La
--  documentation est corrigee dans le meme lot.)
--
-- ---------------------------------------------------------------------------
-- LES MESSAGES SONT PREFIXES `RELANCE:`
-- ---------------------------------------------------------------------------
-- Comme les 19 triggers, et pour la meme raison : `utils/messageTrigger.ts` retire
-- ce prefixe avant affichage. Un message ainsi prefixe est destine a etre LU par
-- l'utilisateur ; tout le reste est une erreur technique qu'on ne lui montre pas.
-- ============================================================================

SET search_path TO relance, public;

-- ---------------------------------------------------------------- les gardes

-- Renvoie l'utilisateur courant, ou leve. Les fonctions qui suivent commencent
-- toutes par un de ces trois gardes — c'est la premiere chose a verifier en
-- relisant l'une d'elles.
CREATE OR REPLACE FUNCTION relance.exiger_administration()
RETURNS bigint
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = relance, public, pg_temp
AS $fn$
DECLARE moi bigint := relance.utilisateur_courant();
BEGIN
  IF moi IS NULL THEN
    RAISE EXCEPTION 'RELANCE: authentification requise.';
  END IF;
  IF NOT relance.peut_administrer() THEN
    RAISE EXCEPTION 'RELANCE: cette action demande le niveau administrateur ou direction.';
  END IF;
  RETURN moi;
END $fn$;

CREATE OR REPLACE FUNCTION relance.exiger_gestion_comptes()
RETURNS bigint
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = relance, public, pg_temp
AS $fn$
DECLARE moi bigint := relance.utilisateur_courant();
BEGIN
  IF moi IS NULL THEN
    RAISE EXCEPTION 'RELANCE: authentification requise.';
  END IF;
  -- `admin` SEUL. C'est la frontiere qui empeche `direction` de se promouvoir,
  -- et elle ne doit jamais etre elargie « pour simplifier ».
  IF NOT relance.peut_gerer_utilisateurs() THEN
    RAISE EXCEPTION 'RELANCE: la gestion des comptes est reservee aux administrateurs.';
  END IF;
  RETURN moi;
END $fn$;

-- Composer les tables d'une session : `admin`, `direction`, ou chef de la plaque
-- de cette session POUR CETTE CAMPAGNE (F-B.1 a F-B.7).
--
-- ECART ASSUME AVEC `peutAdministrerSession` DE L'API SUPPRIMEE, qui n'acceptait
-- que `admin` et laissait `direction` dehors. Cet ecart etait deja sans effet :
-- les politiques RLS de `table_phoning` et `affectation` accordent l'ecriture a
-- `peut_administrer()`, donc `direction` pouvait de toute facon composer une table
-- en ecrivant en direct. Une fonction plus stricte que la politique qu'elle
-- contourne n'aurait ete qu'un decor.
CREATE OR REPLACE FUNCTION relance.peut_administrer_session(p_session_id bigint)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = relance, public, pg_temp
AS $fn$
  SELECT relance.peut_administrer()
      OR EXISTS (
        SELECT 1
        FROM relance.session_plaque sp
        JOIN relance.role_campagne rc
          ON rc.campagne_id = sp.campagne_id
         AND rc.plaque_id = sp.plaque_id
         AND rc.role = 'chef_plaque'
         AND rc.archive_le IS NULL
         AND rc.utilisateur_id = relance.utilisateur_courant()
        WHERE sp.id = p_session_id
      )
$fn$;

CREATE OR REPLACE FUNCTION relance.exiger_session(p_session_id bigint)
RETURNS bigint
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = relance, public, pg_temp
AS $fn$
DECLARE
  moi bigint := relance.utilisateur_courant();
  campagne bigint;
BEGIN
  IF moi IS NULL THEN
    RAISE EXCEPTION 'RELANCE: authentification requise.';
  END IF;
  SELECT sp.campagne_id INTO campagne FROM relance.session_plaque sp WHERE sp.id = p_session_id;
  IF campagne IS NULL THEN
    RAISE EXCEPTION 'RELANCE: session introuvable.';
  END IF;
  IF NOT relance.peut_administrer_session(p_session_id) THEN
    RAISE EXCEPTION 'RELANCE: vous n''administrez pas cette plaque sur cette campagne.';
  END IF;
  -- R-C.3. Repete ici parce qu'une session close ne doit pas non plus voir sa
  -- composition changer — le trigger sur `rdv` ne couvre que les RDV.
  IF NOT relance.campagne_ouverte(campagne) THEN
    RAISE EXCEPTION 'RELANCE: cette campagne est cloturee, sa composition n''est plus modifiable.';
  END IF;
  RETURN moi;
END $fn$;

-- ============================================================================
-- 1 et 2 — LES JOURS ET LES CRENEAUX D'UNE CAMPAGNE (R-A.2)
--
-- Le garde-fou de R-A.2 est une CLE ETRANGERE COMPOSITE : un RDV ne peut porter
-- qu'un jour appartenant a sa campagne. Retirer un jour qui porte des RDV echoue
-- donc EN BASE, ce qui force l'interface a traiter le cas au lieu de fabriquer des
-- orphelins que personne ne verrait.
--
-- D'ou le fonctionnement en DEUX TEMPS, transcrit de l'API :
--   `p_mode` a NULL  -> on SONDE : la fonction rend les RDV impactes et ne touche
--                       a rien. C'est ce qui alimente la boite de dialogue.
--   `p_mode` = 'deplacer' -> on applique, en deplacant les RDV vers `p_vers`.
--   Aucun RDV impacte -> on applique directement, quel que soit le mode.
--
-- L'ORDRE DES OPERATIONS N'EST PAS NEGOCIABLE : creer les jours ajoutes AVANT de
-- deplacer les RDV — sinon la cle etrangere refuse la destination — puis retirer
-- les jours devenus vides.
-- ============================================================================

CREATE OR REPLACE FUNCTION relance.campagne_definir_jours(
  p_campagne_id bigint,
  p_jours date[],
  p_mode text DEFAULT NULL,
  p_vers date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = relance, public, pg_temp
AS $fn$
DECLARE
  moi bigint := relance.exiger_administration();
  retires date[];
  ajoutes date[];
  impactes int;
  detail jsonb;
  i int;
BEGIN
  IF p_jours IS NULL OR array_length(p_jours, 1) IS NULL THEN
    RAISE EXCEPTION 'RELANCE: au moins un jour est requis.';
  END IF;
  IF (SELECT count(DISTINCT j) FROM unnest(p_jours) j) <> array_length(p_jours, 1) THEN
    RAISE EXCEPTION 'RELANCE: un jour est present deux fois.';
  END IF;
  IF NOT relance.campagne_ouverte(p_campagne_id) THEN
    RAISE EXCEPTION 'RELANCE: campagne cloturee, ses jours ne sont plus modifiables.';
  END IF;

  SELECT coalesce(array_agg(cj.jour ORDER BY cj.jour), '{}')
    INTO retires
    FROM relance.campagne_jour cj
   WHERE cj.campagne_id = p_campagne_id
     AND NOT (cj.jour = ANY (p_jours));

  SELECT coalesce(array_agg(j ORDER BY j), '{}')
    INTO ajoutes
    FROM unnest(p_jours) j
   WHERE NOT EXISTS (
     SELECT 1 FROM relance.campagne_jour cj
      WHERE cj.campagne_id = p_campagne_id AND cj.jour = j
   );

  -- Les RDV impactes, ARCHIVES COMPRIS : un RDV archive reste rattache a son jour
  -- par la cle etrangere, donc il bloque le retrait exactement comme un actif.
  SELECT count(*)::int,
         coalesce(jsonb_agg(x ORDER BY x->>'jour'), '[]'::jsonb)
    INTO impactes, detail
    FROM (
      SELECT jsonb_build_object(
               'jour', r.jour,
               'actifs', count(*) FILTER (WHERE r.archive_le IS NULL),
               'archives', count(*) FILTER (WHERE r.archive_le IS NOT NULL),
               'vendeurs', coalesce(jsonb_agg(DISTINCT v.nom) FILTER (WHERE r.archive_le IS NULL), '[]'::jsonb)
             ) AS x,
             count(*) AS n
        FROM relance.rdv r
        JOIN relance.vendeur v ON v.id = r.vendeur_id
       WHERE r.campagne_id = p_campagne_id
         AND r.jour = ANY (retires)
       GROUP BY r.jour
    ) s;

  SELECT coalesce(sum((x->>'actifs')::int + (x->>'archives')::int), 0)::int
    INTO impactes
    FROM jsonb_array_elements(detail) x;

  -- SONDAGE : on rend l'impact sans rien modifier. L'interface s'en sert pour
  -- proposer le choix « annuler ou deplacer ».
  IF impactes > 0 AND coalesce(p_mode, '') <> 'deplacer' THEN
    RETURN jsonb_build_object(
      'applique', false,
      'code', 'RDV_IMPACTES',
      'retires', to_jsonb(retires),
      'ajoutes', to_jsonb(ajoutes),
      'impacts', detail,
      'joursConserves', to_jsonb(p_jours),
      'message', format(
        'Retirer %s supprimerait le rattachement de %s RDV. Choisir : annuler la modification, ou deplacer ces RDV vers un jour conserve.',
        CASE WHEN array_length(retires, 1) > 1 THEN 'ces jours' ELSE 'ce jour' END,
        impactes)
    );
  END IF;

  IF impactes > 0 THEN
    IF p_vers IS NULL OR NOT (p_vers = ANY (p_jours)) THEN
      RAISE EXCEPTION 'RELANCE: le jour de destination doit faire partie des jours conserves.';
    END IF;
  END IF;

  -- 1. les jours demandes, crees ou renumerotes
  FOR i IN 1 .. array_length(p_jours, 1) LOOP
    INSERT INTO relance.campagne_jour (campagne_id, jour, ordre, cree_par)
    VALUES (p_campagne_id, p_jours[i], i, moi)
    ON CONFLICT (campagne_id, jour) DO UPDATE SET ordre = EXCLUDED.ordre;
  END LOOP;

  -- 2. les RDV deplaces, APRES la creation des jours de destination
  IF impactes > 0 THEN
    UPDATE relance.rdv r
       SET jour = p_vers, modifie_le = now(), modifie_par = moi
     WHERE r.campagne_id = p_campagne_id
       AND r.jour = ANY (retires);
  END IF;

  -- 3. les jours retires, une fois vides
  IF array_length(retires, 1) IS NOT NULL THEN
    DELETE FROM relance.campagne_jour cj
     WHERE cj.campagne_id = p_campagne_id AND cj.jour = ANY (retires);
  END IF;

  RETURN jsonb_build_object(
    'applique', true,
    'retires', to_jsonb(retires),
    'ajoutes', to_jsonb(ajoutes),
    'rdvDeplaces', impactes,
    'versJour', to_jsonb(p_vers),
    'jours', (SELECT coalesce(jsonb_agg(jsonb_build_object('jour', cj.jour, 'ordre', cj.ordre) ORDER BY cj.ordre), '[]'::jsonb)
                FROM relance.campagne_jour cj WHERE cj.campagne_id = p_campagne_id)
  );
END $fn$;

-- Meme logique, sur la seconde cle composite. Un creneau est identifie par son
-- CODE : le deplacement porte donc sur `creneau_code` et non sur une date.
CREATE OR REPLACE FUNCTION relance.campagne_definir_creneaux(
  p_campagne_id bigint,
  p_codes text[],
  p_libelles text[],
  p_mode text DEFAULT NULL,
  p_vers text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = relance, public, pg_temp
AS $fn$
DECLARE
  moi bigint := relance.exiger_administration();
  retires text[];
  ajoutes text[];
  impactes int;
  detail jsonb;
  i int;
BEGIN
  IF p_codes IS NULL OR array_length(p_codes, 1) IS NULL THEN
    RAISE EXCEPTION 'RELANCE: au moins un creneau est requis.';
  END IF;
  IF array_length(p_codes, 1) <> array_length(p_libelles, 1) THEN
    RAISE EXCEPTION 'RELANCE: chaque creneau doit porter un libelle.';
  END IF;
  IF (SELECT count(DISTINCT c) FROM unnest(p_codes) c) <> array_length(p_codes, 1) THEN
    RAISE EXCEPTION 'RELANCE: un creneau est present deux fois.';
  END IF;
  IF NOT relance.campagne_ouverte(p_campagne_id) THEN
    RAISE EXCEPTION 'RELANCE: campagne cloturee, ses creneaux ne sont plus modifiables.';
  END IF;

  SELECT coalesce(array_agg(cc.code ORDER BY cc.ordre), '{}')
    INTO retires
    FROM relance.campagne_creneau cc
   WHERE cc.campagne_id = p_campagne_id AND NOT (cc.code = ANY (p_codes));

  SELECT coalesce(array_agg(c), '{}')
    INTO ajoutes
    FROM unnest(p_codes) c
   WHERE NOT EXISTS (
     SELECT 1 FROM relance.campagne_creneau cc
      WHERE cc.campagne_id = p_campagne_id AND cc.code = c
   );

  SELECT count(*)::int,
         coalesce(jsonb_agg(jsonb_build_object('creneau', s.code, 'actifs', s.actifs, 'archives', s.archives)), '[]'::jsonb)
    INTO impactes, detail
    FROM (
      SELECT r.creneau_code AS code,
             count(*) FILTER (WHERE r.archive_le IS NULL) AS actifs,
             count(*) FILTER (WHERE r.archive_le IS NOT NULL) AS archives
        FROM relance.rdv r
       WHERE r.campagne_id = p_campagne_id AND r.creneau_code = ANY (retires)
       GROUP BY r.creneau_code
    ) s;

  SELECT coalesce(sum((x->>'actifs')::int + (x->>'archives')::int), 0)::int
    INTO impactes FROM jsonb_array_elements(detail) x;

  IF impactes > 0 AND coalesce(p_mode, '') <> 'deplacer' THEN
    RETURN jsonb_build_object(
      'applique', false, 'code', 'RDV_IMPACTES',
      'retires', to_jsonb(retires), 'ajoutes', to_jsonb(ajoutes),
      'impacts', detail, 'creneauxConserves', to_jsonb(p_codes),
      'message', format('Retirer ces creneaux supprimerait le rattachement de %s RDV. Choisir : annuler, ou deplacer ces RDV vers un creneau conserve.', impactes)
    );
  END IF;

  IF impactes > 0 AND (p_vers IS NULL OR NOT (p_vers = ANY (p_codes))) THEN
    RAISE EXCEPTION 'RELANCE: le creneau de destination doit faire partie des creneaux conserves.';
  END IF;

  FOR i IN 1 .. array_length(p_codes, 1) LOOP
    INSERT INTO relance.campagne_creneau (campagne_id, code, libelle, ordre, cree_par)
    VALUES (p_campagne_id, p_codes[i], p_libelles[i], i, moi)
    ON CONFLICT (campagne_id, code) DO UPDATE SET libelle = EXCLUDED.libelle, ordre = EXCLUDED.ordre;
  END LOOP;

  IF impactes > 0 THEN
    UPDATE relance.rdv r
       SET creneau_code = p_vers, modifie_le = now(), modifie_par = moi
     WHERE r.campagne_id = p_campagne_id AND r.creneau_code = ANY (retires);
  END IF;

  IF array_length(retires, 1) IS NOT NULL THEN
    DELETE FROM relance.campagne_creneau cc
     WHERE cc.campagne_id = p_campagne_id AND cc.code = ANY (retires);
  END IF;

  RETURN jsonb_build_object(
    'applique', true, 'retires', to_jsonb(retires), 'ajoutes', to_jsonb(ajoutes),
    'rdvDeplaces', impactes, 'versCreneau', to_jsonb(p_vers),
    'creneaux', (SELECT coalesce(jsonb_agg(jsonb_build_object('code', cc.code, 'libelle', cc.libelle, 'ordre', cc.ordre) ORDER BY cc.ordre), '[]'::jsonb)
                   FROM relance.campagne_creneau cc WHERE cc.campagne_id = p_campagne_id)
  );
END $fn$;

-- ============================================================================
-- 3 et 4 — LA COMPOSITION DES TABLES
-- ============================================================================

-- Archiver une table archive AUSSI ses affectations, dans le meme geste. Les deux
-- separes laisseraient des affectations actives pointant une table archivee, et
-- les vendeurs concernes disparaitraient des deux cotes a la fois.
CREATE OR REPLACE FUNCTION relance.table_archiver(p_table_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = relance, public, pg_temp
AS $fn$
DECLARE
  session_id bigint;
  libelle text;
  n int;
BEGIN
  SELECT t.session_plaque_id, t.libelle INTO session_id, libelle
    FROM relance.table_phoning t WHERE t.id = p_table_id;
  IF session_id IS NULL THEN
    RAISE EXCEPTION 'RELANCE: table introuvable.';
  END IF;
  PERFORM relance.exiger_session(session_id);

  UPDATE relance.table_phoning SET archive_le = now() WHERE id = p_table_id;
  UPDATE relance.affectation SET archive_le = now()
   WHERE table_id = p_table_id AND archive_le IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT;

  RETURN jsonb_build_object(
    'archivee', libelle,
    'affectationsArchivees', n,
    'sessionId', session_id::text,
    'message', format(
      '« %s » est archivee, pas supprimee : sa composition reste consultable. %s vendeur(s) reviennent en reserve et restent saisissables par leur chef de site.',
      libelle, n)
  );
END $fn$;

-- Remplace la composition d'une table par la liste transmise, EN UNE FOIS.
--
-- REACTIVATION PLUTOT QUE RECREATION : l'unique `(table, vendeur)` fait qu'un
-- vendeur retire puis remis reprend SA ligne, avec son historique, au lieu d'en
-- creer une seconde. Meme decision que pour les tables elles-memes.
--
-- Les vendeurs retires reviennent en RESERVE (F-B.8) : ils ne disparaissent pas et
-- restent saisissables par leur chef de site.
CREATE OR REPLACE FUNCTION relance.table_definir_vendeurs(
  p_table_id bigint,
  p_vendeur_ids bigint[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = relance, public, pg_temp
AS $fn$
DECLARE
  moi bigint;
  session_id bigint;
  ids bigint[] := coalesce(p_vendeur_ids, '{}');
  retires int;
  v bigint;
BEGIN
  SELECT t.session_plaque_id INTO session_id
    FROM relance.table_phoning t WHERE t.id = p_table_id AND t.archive_le IS NULL;
  IF session_id IS NULL THEN
    RAISE EXCEPTION 'RELANCE: table introuvable ou archivee.';
  END IF;
  moi := relance.exiger_session(session_id);

  UPDATE relance.affectation SET archive_le = now()
   WHERE table_id = p_table_id AND archive_le IS NULL AND NOT (vendeur_id = ANY (ids));
  GET DIAGNOSTICS retires = ROW_COUNT;

  -- Un a un, et non en bloc : les triggers R-B.1 (meme plaque), R-B.4 (une seule
  -- table par campagne) et R-B.5 (marque de la table) sont `FOR EACH ROW`. Leurs
  -- messages, deja ecrits pour un humain, remontent tels quels a l'appelant.
  FOREACH v IN ARRAY ids LOOP
    INSERT INTO relance.affectation (table_id, vendeur_id, origine, cree_par)
    VALUES (p_table_id, v, 'manuel', moi)
    ON CONFLICT (table_id, vendeur_id)
      DO UPDATE SET archive_le = NULL, origine = 'manuel';
  END LOOP;

  RETURN jsonb_build_object(
    'retires', retires,
    'effectif', coalesce(array_length(ids, 1), 0),
    'sessionId', session_id::text
  );
END $fn$;

-- ============================================================================
-- 5 — L'ECRITURE D'UNE REPARTITION
--
-- La graine 42 reste en TypeScript, cote navigateur : voir la note de tete. Cette
-- fonction ne decide rien, elle ECRIT — mais elle ecrit tout ou rien.
--
-- `p_placements` est le resultat de `repartir()`, tel quel :
--   [{"tableId": "12", "vendeurIdsAjoutes": ["3", "7"]}, ...]
-- Les identifiants sont des CHAINES, comme partout ou un bigint traverse du JSON.
-- ============================================================================

CREATE OR REPLACE FUNCTION relance.session_appliquer_repartition(
  p_session_id bigint,
  p_placements jsonb,
  p_remplacer boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = relance, public, pg_temp
AS $fn$
DECLARE
  moi bigint := relance.exiger_session(p_session_id);
  place int := 0;
  p jsonb;
  v jsonb;
  t bigint;
BEGIN
  -- `remplacer` REFAIT la composition entiere : toutes les affectations actives de
  -- la session sont archivees avant de replacer. Derriere une confirmation dans
  -- l'interface, jamais par defaut.
  IF p_remplacer THEN
    UPDATE relance.affectation a SET archive_le = now()
      FROM relance.table_phoning t
     WHERE t.id = a.table_id
       AND t.session_plaque_id = p_session_id
       AND a.archive_le IS NULL;
  END IF;

  FOR p IN SELECT jsonb_array_elements(coalesce(p_placements, '[]'::jsonb)) LOOP
    t := (p->>'tableId')::bigint;

    -- La table doit appartenir A CETTE session : sans ce controle, un appelant
    -- autorise sur sa plaque pourrait ecrire dans les tables d'une autre.
    IF NOT EXISTS (
      SELECT 1 FROM relance.table_phoning tp
       WHERE tp.id = t AND tp.session_plaque_id = p_session_id AND tp.archive_le IS NULL
    ) THEN
      RAISE EXCEPTION 'RELANCE: la table % n''appartient pas a cette session.', t;
    END IF;

    FOR v IN SELECT jsonb_array_elements(coalesce(p->'vendeurIdsAjoutes', '[]'::jsonb)) LOOP
      INSERT INTO relance.affectation (table_id, vendeur_id, origine, cree_par)
      VALUES (t, (v#>>'{}')::bigint, 'auto', moi)
      ON CONFLICT (table_id, vendeur_id) DO UPDATE SET archive_le = NULL, origine = 'auto';
      place := place + 1;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object('graine', 42, 'remplacer', p_remplacer, 'affectations', place);
END $fn$;

-- ============================================================================
-- 6 — REPRENDRE LA COMPOSITION D'UNE AUTRE CAMPAGNE (F-B.7)
--
-- « Reprendre la composition de la campagne precedente en un clic. »
--
-- CE QUI NE PEUT PAS SUIVRE EST REPORTE, JAMAIS FORCE : un vendeur parti depuis,
-- ou passe dans une autre plaque, est signale et laisse de cote. Le forcer
-- creerait une affectation que R-B.1 refuserait, ou placerait dans une table un
-- vendeur absent de la campagne.
-- ============================================================================

CREATE OR REPLACE FUNCTION relance.session_reprendre(
  p_session_id bigint,
  p_depuis_campagne_id bigint
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = relance, public, pg_temp
AS $fn$
DECLARE
  moi bigint := relance.exiger_session(p_session_id);
  plaque bigint;
  campagne bigint;
  source bigint;
  tables_creees int := 0;
  reprises int := 0;
  reportes jsonb := '[]'::jsonb;
  t record;
  a record;
  cible bigint;
  existait boolean;
BEGIN
  SELECT sp.plaque_id, sp.campagne_id INTO plaque, campagne
    FROM relance.session_plaque sp WHERE sp.id = p_session_id;

  IF p_depuis_campagne_id = campagne THEN
    RAISE EXCEPTION 'RELANCE: la campagne source doit etre une AUTRE campagne.';
  END IF;

  SELECT sp.id INTO source
    FROM relance.session_plaque sp
   WHERE sp.campagne_id = p_depuis_campagne_id
     AND sp.plaque_id = plaque
     AND sp.archive_le IS NULL;
  IF source IS NULL THEN
    RAISE EXCEPTION 'RELANCE: cette plaque n''avait aucune session sur la campagne demandee.';
  END IF;

  FOR t IN
    SELECT tp.id, tp.libelle, tp.ordre, tp.chef_utilisateur_id, tp.marque_id
      FROM relance.table_phoning tp
     WHERE tp.session_plaque_id = source AND tp.archive_le IS NULL
     ORDER BY tp.ordre
  LOOP
    SELECT tp.id INTO cible
      FROM relance.table_phoning tp
     WHERE tp.session_plaque_id = p_session_id AND tp.libelle = t.libelle;
    existait := cible IS NOT NULL;

    IF existait THEN
      UPDATE relance.table_phoning
         SET archive_le = NULL, ordre = t.ordre,
             chef_utilisateur_id = t.chef_utilisateur_id, marque_id = t.marque_id
       WHERE id = cible;
    ELSE
      INSERT INTO relance.table_phoning (session_plaque_id, libelle, ordre, chef_utilisateur_id, marque_id, cree_par)
      VALUES (p_session_id, t.libelle, t.ordre, t.chef_utilisateur_id, t.marque_id, moi)
      RETURNING id INTO cible;
      tables_creees := tables_creees + 1;
    END IF;

    FOR a IN
      SELECT v.id, v.nom, v.site_id
        FROM relance.affectation af
        JOIN relance.vendeur v ON v.id = af.vendeur_id
       WHERE af.table_id = t.id AND af.archive_le IS NULL
    LOOP
      -- ELIGIBILITE : present pendant LA NOUVELLE campagne, et toujours de cette
      -- plaque. Les deux conditions sont verifiees ici EN PLUS du trigger, pour
      -- pouvoir NOMMER ceux qu'on laisse de cote plutot que d'echouer en bloc.
      IF NOT EXISTS (
        SELECT 1
          FROM relance.vendeur vv
          JOIN relance.site s ON s.id = vv.site_id
          JOIN relance.campagne c ON c.id = campagne
         WHERE vv.id = a.id
           AND s.plaque_id = plaque
           AND vv.archive_le IS NULL
           AND (vv.date_entree IS NULL OR vv.date_entree <= c.date_fin)
           AND (vv.date_sortie IS NULL OR vv.date_sortie >= c.date_debut)
      ) THEN
        reportes := reportes || jsonb_build_object(
          'nom', a.nom,
          'raison', 'absent de cette campagne, ou rattache a une autre plaque');
        CONTINUE;
      END IF;

      INSERT INTO relance.affectation (table_id, vendeur_id, origine, cree_par)
      VALUES (cible, a.id, 'manuel', moi)
      ON CONFLICT (table_id, vendeur_id) DO UPDATE SET archive_le = NULL;
      reprises := reprises + 1;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object(
    'tablesCreees', tables_creees,
    'affectationsReprises', reprises,
    'reportes', reportes
  );
END $fn$;

-- ============================================================================
-- 7, 8 et 9 — LES COMPTES. `admin` SEUL.
-- ============================================================================

-- UN SEUL ROLE GLOBAL PAR COMPTE : les paliers sont exclusifs, pas cumulatifs.
-- On remplace donc au lieu d'ajouter. `p_role` a NULL retire tout role — le compte
-- redevient un ENCADRANT, dont les droits viennent de ses rattachements.
CREATE OR REPLACE FUNCTION relance.utilisateur_definir_roles(
  p_utilisateur_id bigint,
  p_role text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = relance, public, pg_temp
AS $fn$
DECLARE
  moi bigint := relance.exiger_gestion_comptes();
  etait_admin boolean;
  autres_admins int;
BEGIN
  IF p_role IS NOT NULL AND p_role NOT IN ('admin', 'direction', 'lecteur') THEN
    RAISE EXCEPTION 'RELANCE: role inconnu : admin, direction ou lecteur.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM relance.utilisateur WHERE id = p_utilisateur_id) THEN
    RAISE EXCEPTION 'RELANCE: compte introuvable.';
  END IF;

  -- LE DERNIER ADMINISTRATEUR NE PEUT PAS ETRE DEGRADE. Sans ce controle,
  -- l'application devient inadministrable et plus personne ne peut creer de compte
  -- — y compris pour se redonner le role.
  SELECT EXISTS (
    SELECT 1 FROM relance.role_global WHERE utilisateur_id = p_utilisateur_id AND role = 'admin'
  ) INTO etait_admin;

  IF etait_admin AND coalesce(p_role, '') <> 'admin' THEN
    SELECT count(*)::int INTO autres_admins
      FROM relance.role_global rg
      JOIN relance.utilisateur u ON u.id = rg.utilisateur_id
     WHERE rg.role = 'admin' AND rg.utilisateur_id <> p_utilisateur_id
       AND u.actif AND u.archive_le IS NULL;
    IF autres_admins = 0 THEN
      RAISE EXCEPTION 'RELANCE: c''est le dernier administrateur actif : le degrader rendrait l''application inadministrable. Nommer un autre administrateur d''abord.';
    END IF;
  END IF;

  DELETE FROM relance.role_global WHERE utilisateur_id = p_utilisateur_id;
  IF p_role IS NOT NULL THEN
    INSERT INTO relance.role_global (utilisateur_id, role, cree_par)
    VALUES (p_utilisateur_id, p_role, moi);
  END IF;

  RETURN jsonb_build_object('utilisateurId', p_utilisateur_id::text, 'role', to_jsonb(p_role));
END $fn$;

-- Rattacher, ou detacher, un encadrant. `p_utilisateur_id` a NULL LIBERE le role
-- sur ce site.
CREATE OR REPLACE FUNCTION relance.utilisateur_definir_encadrement(
  p_site_id bigint,
  p_role text,
  p_utilisateur_id bigint DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = relance, public, pg_temp
AS $fn$
DECLARE
  moi bigint := relance.exiger_gestion_comptes();
BEGIN
  IF p_role NOT IN ('chef_de_site', 'chef_de_vente_vn', 'chef_de_vente_vo') THEN
    RAISE EXCEPTION 'RELANCE: role invalide : chef_de_site, chef_de_vente_vn ou chef_de_vente_vo.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM relance.site WHERE id = p_site_id AND archive_le IS NULL) THEN
    RAISE EXCEPTION 'RELANCE: site introuvable ou archive.';
  END IF;

  IF p_utilisateur_id IS NULL THEN
    UPDATE relance.encadrement_site SET archive_le = now()
     WHERE site_id = p_site_id AND role = p_role AND archive_le IS NULL;
    RETURN jsonb_build_object('libere', true, 'siteId', p_site_id::text, 'role', p_role);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM relance.utilisateur
     WHERE id = p_utilisateur_id AND actif AND archive_le IS NULL
  ) THEN
    RAISE EXCEPTION 'RELANCE: ce compte est introuvable ou desactive.';
  END IF;

  -- ON LIBERE LE ROLE AVANT DE LE DONNER. L'unique `(site, role)` refuse deux
  -- titulaires : l'ordre inverse echouerait. Meme piege que sur l'ecran des
  -- encadrants, ou deux requetes lancees en parallele se marchaient dessus.
  UPDATE relance.encadrement_site SET archive_le = now()
   WHERE site_id = p_site_id AND role = p_role AND archive_le IS NULL
     AND utilisateur_id <> p_utilisateur_id;

  INSERT INTO relance.encadrement_site (site_id, role, utilisateur_id, cree_par)
  VALUES (p_site_id, p_role, p_utilisateur_id, moi)
  ON CONFLICT (site_id, role) DO UPDATE
    SET utilisateur_id = EXCLUDED.utilisateur_id, archive_le = NULL;

  RETURN jsonb_build_object('siteId', p_site_id::text, 'role', p_role,
                            'utilisateurId', p_utilisateur_id::text);
END $fn$;

-- PURGE D'UN COMPTE. Une des deux seules portes de l'interdit n.1.
CREATE OR REPLACE FUNCTION relance.utilisateur_purger(
  p_utilisateur_id bigint,
  p_confirmation text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = relance, public, pg_temp
AS $fn$
DECLARE
  moi bigint := relance.exiger_gestion_comptes();
  nom_exact text;
  attaches text[] := '{}';
BEGIN
  SELECT u.nom INTO nom_exact FROM relance.utilisateur u WHERE u.id = p_utilisateur_id;
  IF nom_exact IS NULL THEN
    RAISE EXCEPTION 'RELANCE: compte introuvable.';
  END IF;
  IF p_utilisateur_id = moi THEN
    RAISE EXCEPTION 'RELANCE: on ne supprime pas son propre compte.';
  END IF;

  -- CE QUI RETIENT UN COMPTE. Un compte qui explique encore quelque chose —
  -- l'auteur d'une saisie, le chef d'une table passee — n'est pas supprimable :
  -- l'historique deviendrait anonyme. Le desactiver conserve la trace sans donner
  -- aucun acces.
  IF EXISTS (SELECT 1 FROM relance.table_phoning WHERE chef_utilisateur_id = p_utilisateur_id) THEN
    attaches := attaches || 'des tables de phoning';
  END IF;
  IF EXISTS (SELECT 1 FROM relance.rdv WHERE cree_par = p_utilisateur_id OR modifie_par = p_utilisateur_id) THEN
    attaches := attaches || 'des RDV saisis';
  END IF;
  IF EXISTS (SELECT 1 FROM relance.vendeur WHERE utilisateur_id = p_utilisateur_id) THEN
    attaches := attaches || 'une fiche vendeur';
  END IF;
  IF array_length(attaches, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'RELANCE: % ne peut pas etre supprime : son compte explique encore %. Le laisser desactive conserve cette trace sans lui donner aucun acces.',
      nom_exact, array_to_string(attaches, ', ');
  END IF;

  IF p_confirmation IS DISTINCT FROM nom_exact THEN
    RAISE EXCEPTION 'RELANCE: pour supprimer definitivement, retaper le nom exact. Attendu : « % ».', nom_exact;
  END IF;

  -- LA PORTE, ouverte pour cette seule transaction. `SET LOCAL` meurt avec elle :
  -- elle ne peut pas rester ouverte par oubli, et aucune autre session n'est
  -- affectee — contrairement a un `ALTER TABLE ... DISABLE TRIGGER`, qui aurait
  -- desarme le garde-fou pour tout le monde, y compris pendant une saisie.
  PERFORM set_config('relance.purge_autorisee', 'oui', true);
  DELETE FROM relance.encadrement_site WHERE utilisateur_id = p_utilisateur_id;
  DELETE FROM relance.role_global WHERE utilisateur_id = p_utilisateur_id;
  DELETE FROM relance.role_campagne WHERE utilisateur_id = p_utilisateur_id;
  DELETE FROM relance.utilisateur WHERE id = p_utilisateur_id;

  RETURN jsonb_build_object('supprime', nom_exact);
END $fn$;

-- ============================================================================
-- 10 a 13 — LES VENDEURS
-- ============================================================================

-- Les capacites d'un vendeur : ses marques et son metier, poses ensemble.
--
-- UN VENDEUR VO N'A AUCUNE MARQUE. Le fichier source ne lui donne pas de
-- ventilation, et le trigger `rdv_marque_selon_metier` interdit la marque sur ses
-- RDV. Lui laisser des lignes `vendeur_marque` serait du bruit trompeur, affiche
-- par l'ecran comme une autorisation qui n'existe pas.
CREATE OR REPLACE FUNCTION relance.poser_capacites(
  p_vendeur_id bigint,
  p_marque_ids bigint[],
  p_type_vehicule text,
  p_par bigint
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = relance, public, pg_temp
AS $fn$
DECLARE m bigint;
BEGIN
  DELETE FROM relance.vendeur_marque WHERE vendeur_id = p_vendeur_id;
  IF p_type_vehicule <> 'VO' AND p_marque_ids IS NOT NULL THEN
    FOREACH m IN ARRAY p_marque_ids LOOP
      INSERT INTO relance.vendeur_marque (vendeur_id, marque_id, cree_par)
      VALUES (p_vendeur_id, m, p_par)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;

  -- PROVENANCE, pas un statut : qui a change les capacites et quand. La notion de
  -- « confirme / placeholder » a ete retiree — un vendeur en base est valide. Ces
  -- deux colonnes servent le jour ou un RDV est refuse sans que personne comprenne.
  UPDATE relance.vendeur
     SET type_vehicule = p_type_vehicule,
         capacites_confirmees_le = now(),
         capacites_confirmees_par = p_par
   WHERE id = p_vendeur_id;
END $fn$;

CREATE OR REPLACE FUNCTION relance.vendeur_creer(
  p_nom text,
  p_site_id bigint,
  p_type_vehicule text,
  p_marque_ids bigint[] DEFAULT '{}',
  p_date_entree date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = relance, public, pg_temp
AS $fn$
DECLARE
  moi bigint := relance.exiger_administration();
  nouveau bigint;
  nom text := btrim(coalesce(p_nom, ''));
BEGIN
  IF nom = '' THEN
    RAISE EXCEPTION 'RELANCE: le nom du vendeur est requis.';
  END IF;
  IF p_type_vehicule NOT IN ('VN', 'VO') THEN
    RAISE EXCEPTION 'RELANCE: le metier doit etre VN ou VO.';
  END IF;
  IF p_type_vehicule = 'VN' AND coalesce(array_length(p_marque_ids, 1), 0) = 0 THEN
    RAISE EXCEPTION 'RELANCE: un vendeur VN doit porter au moins une marque, sinon sa grille de saisie serait vide.';
  END IF;

  INSERT INTO relance.vendeur (nom, site_id, type_vehicule, date_entree, cree_par)
  VALUES (nom, p_site_id, p_type_vehicule, p_date_entree, moi)
  RETURNING id INTO nouveau;

  PERFORM relance.poser_capacites(nouveau, p_marque_ids, p_type_vehicule, moi);

  RETURN jsonb_build_object('id', nouveau::text, 'nom', nom);
END $fn$;

-- Modifier un vendeur. Chaque parametre a NULL signifie « ne pas toucher », d'ou
-- `p_changer_capacites` : sans lui, on ne pourrait pas distinguer « ne pas toucher
-- aux marques » de « retirer toutes les marques ».
CREATE OR REPLACE FUNCTION relance.vendeur_modifier(
  p_vendeur_id bigint,
  p_nom text DEFAULT NULL,
  p_site_id bigint DEFAULT NULL,
  p_date_entree date DEFAULT NULL,
  p_date_sortie date DEFAULT NULL,
  p_archiver boolean DEFAULT NULL,
  p_changer_capacites boolean DEFAULT false,
  p_type_vehicule text DEFAULT NULL,
  p_marque_ids bigint[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = relance, public, pg_temp
AS $fn$
DECLARE
  moi bigint := relance.exiger_administration();
BEGIN
  IF NOT EXISTS (SELECT 1 FROM relance.vendeur WHERE id = p_vendeur_id) THEN
    RAISE EXCEPTION 'RELANCE: vendeur introuvable.';
  END IF;

  UPDATE relance.vendeur
     SET nom = coalesce(btrim(p_nom), nom),
         site_id = coalesce(p_site_id, site_id),
         date_entree = CASE WHEN p_date_entree IS NOT NULL THEN p_date_entree ELSE date_entree END,
         date_sortie = CASE WHEN p_date_sortie IS NOT NULL THEN p_date_sortie ELSE date_sortie END,
         archive_le = CASE
                        WHEN p_archiver IS NULL THEN archive_le
                        WHEN p_archiver THEN coalesce(archive_le, now())
                        ELSE NULL
                      END,
         archive_par = CASE
                         WHEN p_archiver IS TRUE THEN moi
                         WHEN p_archiver IS FALSE THEN NULL
                         ELSE archive_par
                       END
   WHERE id = p_vendeur_id;

  IF p_changer_capacites THEN
    IF p_type_vehicule NOT IN ('VN', 'VO') THEN
      RAISE EXCEPTION 'RELANCE: le metier doit etre VN ou VO.';
    END IF;
    IF p_type_vehicule = 'VN' AND coalesce(array_length(p_marque_ids, 1), 0) = 0 THEN
      RAISE EXCEPTION 'RELANCE: un vendeur VN doit porter au moins une marque.';
    END IF;
    PERFORM relance.poser_capacites(p_vendeur_id, p_marque_ids, p_type_vehicule, moi);
  END IF;

  RETURN jsonb_build_object('id', p_vendeur_id::text);
END $fn$;

-- TOUT OU RIEN. Un import a moitie applique laisserait une partie des vendeurs sur
-- leurs anciennes capacites, sans que rien ne distingue ce cas d'un import reussi.
--
-- `p_lignes` est la sortie de `utils/importMarques.ts`, telle quelle :
--   [{"vendeurId": "3", "typeVehicule": "VN", "marqueIds": ["1", "2"]}, ...]
CREATE OR REPLACE FUNCTION relance.vendeur_appliquer_import_marques(p_lignes jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = relance, public, pg_temp
AS $fn$
DECLARE
  moi bigint := relance.exiger_administration();
  l jsonb;
  n int := 0;
  marques bigint[];
BEGIN
  FOR l IN SELECT jsonb_array_elements(coalesce(p_lignes, '[]'::jsonb)) LOOP
    SELECT coalesce(array_agg((m#>>'{}')::bigint), '{}')
      INTO marques
      FROM jsonb_array_elements(coalesce(l->'marqueIds', '[]'::jsonb)) m;

    PERFORM relance.poser_capacites(
      (l->>'vendeurId')::bigint, marques, l->>'typeVehicule', moi);
    n := n + 1;
  END LOOP;

  RETURN jsonb_build_object('appliquees', n);
END $fn$;

-- PURGE D'UN VENDEUR, RDV COMPRIS. La seconde et derniere porte de l'interdit n.1.
CREATE OR REPLACE FUNCTION relance.vendeur_purger(
  p_vendeur_id bigint,
  p_confirmation text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = relance, public, pg_temp
AS $fn$
DECLARE
  moi bigint := relance.exiger_administration();
  nom_exact text;
  archive timestamptz;
  nb_rdv int;
  nb_aff int;
BEGIN
  SELECT v.nom, v.archive_le INTO nom_exact, archive
    FROM relance.vendeur v WHERE v.id = p_vendeur_id;
  IF nom_exact IS NULL THEN
    RAISE EXCEPTION 'RELANCE: vendeur introuvable.';
  END IF;

  -- DEUX VERROUS, ET LES DEUX COMPTENT. L'archivage prealable oblige a passer par
  -- un geste reversible avant l'irreversible ; retaper le nom empeche de purger
  -- une ligne pour une autre depuis une liste.
  IF archive IS NULL THEN
    RAISE EXCEPTION 'RELANCE: ce vendeur doit d''abord etre archive. La purge ne s''applique qu''a une fiche deja retiree.';
  END IF;
  IF p_confirmation IS DISTINCT FROM nom_exact THEN
    RAISE EXCEPTION 'RELANCE: pour purger definitivement, retaper le nom exact du vendeur. Attendu : « % ».', nom_exact;
  END IF;

  SELECT count(*)::int INTO nb_rdv FROM relance.rdv WHERE vendeur_id = p_vendeur_id;
  SELECT count(*)::int INTO nb_aff FROM relance.affectation WHERE vendeur_id = p_vendeur_id;

  PERFORM set_config('relance.purge_autorisee', 'oui', true);
  DELETE FROM relance.rdv WHERE vendeur_id = p_vendeur_id;
  DELETE FROM relance.affectation WHERE vendeur_id = p_vendeur_id;
  DELETE FROM relance.vendeur_marque WHERE vendeur_id = p_vendeur_id;
  DELETE FROM relance.vendeur WHERE id = p_vendeur_id;

  RETURN jsonb_build_object(
    'purge', nom_exact, 'nbRdv', nb_rdv, 'nbAffectations', nb_aff,
    'message', format(
      '%s est definitivement supprime, avec %s RDV et %s affectation(s). Les totaux des campagnes concernees ont change. C''est irreversible.',
      nom_exact, nb_rdv, nb_aff)
  );
END $fn$;

-- ============================================================================
-- QUI PEUT APPELER QUOI
--
-- PostgreSQL accorde l'execution d'une fonction a `PUBLIC` PAR DEFAUT. Combine a
-- `SECURITY DEFINER`, cela aurait rendu la purge appelable SANS AUCUN JETON, par
-- la seule cle publique. On retire donc en bloc, puis on redonne au seul role
-- `authenticated` — a charge pour chaque fonction de verifier ensuite le palier de
-- son appelant, ce qu'elles font toutes en premiere ligne.
--
-- `poser_capacites` n'est PAS exposee : c'est une brique interne, appelee par trois
-- fonctions. L'exposer laisserait reecrire les marques d'un vendeur sans passer par
-- les controles de `vendeur_modifier`.
-- ============================================================================

DO $droits$
DECLARE f record;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS signature, p.proname
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'relance'
       AND p.proname IN (
         'campagne_definir_jours', 'campagne_definir_creneaux',
         'table_archiver', 'table_definir_vendeurs',
         'session_appliquer_repartition', 'session_reprendre',
         'utilisateur_definir_roles', 'utilisateur_definir_encadrement', 'utilisateur_purger',
         'vendeur_creer', 'vendeur_modifier', 'vendeur_appliquer_import_marques', 'vendeur_purger',
         'poser_capacites',
         'exiger_administration', 'exiger_gestion_comptes', 'exiger_session',
         'peut_administrer_session')
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', f.signature);
    -- Les gardes et la brique interne restent inaccessibles depuis PostgREST.
    IF f.proname NOT IN ('poser_capacites', 'exiger_administration',
                         'exiger_gestion_comptes', 'exiger_session') THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f.signature);
    END IF;
  END LOOP;
END $droits$;

-- Les fonctions de lecture posees par la migration du portail sont dans le meme
-- cas : accordees a PUBLIC par defaut. `utilisateur_courant()` et consorts ne
-- revelent rien a un appelant anonyme (elles rendent NULL ou false), mais il n'y a
-- aucune raison de les lui laisser.
DO $droits_portail$
DECLARE f record;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS signature
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'relance'
       AND p.proname IN ('utilisateur_courant', 'a_role_global', 'peut_administrer',
                         'peut_gerer_utilisateurs', 'campagne_ouverte', 'peut_saisir')
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', f.signature);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f.signature);
  END LOOP;
END $droits_portail$;
