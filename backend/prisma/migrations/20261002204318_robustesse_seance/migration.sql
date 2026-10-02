-- ============================================================================
-- ROBUSTESSE DE SEANCE — lot 1 de PLAN-GRID-V2.md (03/10/2026)
--
-- L'audit du 02/10 a mesure une base SAINE au repos (40 ms pour le perimetre,
-- contre 873 ms en moyenne pendant la panne du 08/09). Ce qui fera tomber
-- l'instance, c'est le NOMBRE de requetes : ~20 000/h estimees pour 25 postes a
-- 258 RDV/h. Cette migration donne au front de quoi les diviser :
--
--   1. `rdv.cle_client` — idempotence de la file d'attente locale ;
--   2. `rdv_lecture` reecrite — le perimetre evalue UNE fois par requete ;
--   3. `charger_saisie` / `charger_tableau` — un ecran = un appel ;
--   4. `rdv_poser` — un RDV = un aller-retour, rejouable sans doublon ;
--   5. la diffusion `tables` — ecoutee par trois ecrans, jamais emise.
--
-- TOUT EST ADDITIF : l'ancien front fonctionne sur cette base. C'est ce qui
-- permet un `wrangler rollback` sans toucher a la base.
-- ============================================================================

-- AlterTable
ALTER TABLE "rdv" ADD COLUMN     "cle_client" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "rdv_cle_client_key" ON "rdv"("cle_client");

SET search_path TO relance, public;

-- ----------------------------------------------------------------------------
-- 2. LA LECTURE DES RDV : LE PERIMETRE UNE FOIS, PLUS A CHAQUE LIGNE
-- ----------------------------------------------------------------------------
-- L'ancienne politique ecrivait un `EXISTS` CORRELE sur `perimetre_saisie` :
-- la vue (CROSS JOIN campagne x vendeur + quatre EXISTS) etait reevaluee pour
-- chaque ligne de `rdv` candidate. Mesure le 02/10 sur Supabase, chef de table,
-- 103 RDV lisibles : 117 ms, contre 10 ms pour la meme lecture ecrite avec un
-- `IN` non correle.
--
-- La sous-requete ci-dessous ne depend d'AUCUNE colonne de `rdv` : le
-- planificateur la calcule une fois et la consulte par hachage. Le resultat est
-- IDENTIQUE par construction — meme vue, meme couple (campagne, vendeur) — et
-- `test:rls` le verifie dans les deux sens. Interdit n.4 : le perimetre reste
-- lu dans `perimetre_saisie` et nulle part ailleurs.
DROP POLICY IF EXISTS rdv_lecture ON rdv;
CREATE POLICY rdv_lecture ON rdv FOR SELECT TO authenticated
  USING (
    (rdv.campagne_id, rdv.vendeur_id) IN (
      SELECT ps.campagne_id, ps.vendeur_id FROM relance.perimetre_saisie ps
    )
  );

-- ----------------------------------------------------------------------------
-- 3. UN ECRAN = UN APPEL
-- ----------------------------------------------------------------------------
-- SECURITY INVOKER, et c'est tout l'interet : chaque table est lue avec les
-- droits de l'appelant, donc sous SA RLS — exactement ce que voyaient les dix
-- lectures PostgREST qu'elles remplacent. Ces fonctions n'ouvrent aucun droit ;
-- elles economisent des allers-retours et resolvent le perimetre une fois.
--
-- LES FORMES RENDUES SONT CELLES DE POSTGREST, a l'identique (`site`,
-- `vendeur_marque[].marque`, `session_plaque.plaque`…) : le code de projection
-- du front ne change pas, seule la source change.

CREATE OR REPLACE FUNCTION relance.charger_saisie(p_campagne_id bigint)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = relance, public, pg_temp
AS $fn$
  WITH moi AS (SELECT relance.utilisateur_courant() AS id),
  ids AS (
    SELECT ps.vendeur_id FROM relance.perimetre_saisie ps WHERE ps.campagne_id = p_campagne_id
  )
  SELECT jsonb_build_object(
    'campagne', (SELECT jsonb_build_object('id', c.id, 'libelle', c.libelle, 'cloturee', c.cloturee)
                   FROM relance.campagne c WHERE c.id = p_campagne_id),
    'jours', coalesce((SELECT jsonb_agg(jsonb_build_object('jour', j.jour, 'ordre', j.ordre) ORDER BY j.ordre)
                         FROM relance.campagne_jour j WHERE j.campagne_id = p_campagne_id), '[]'::jsonb),
    'creneaux', coalesce((SELECT jsonb_agg(jsonb_build_object('code', cr.code, 'libelle', cr.libelle, 'ordre', cr.ordre) ORDER BY cr.ordre)
                            FROM relance.campagne_creneau cr WHERE cr.campagne_id = p_campagne_id), '[]'::jsonb),
    'vendeurs', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'id', v.id, 'nom', v.nom, 'type_vehicule', v.type_vehicule,
        'site', jsonb_build_object('id', s.id, 'code', s.code, 'libelle', s.libelle, 'plaque_id', s.plaque_id),
        'vendeur_marque', coalesce((SELECT jsonb_agg(jsonb_build_object('marque',
              jsonb_build_object('id', m.id, 'libelle', m.libelle, 'ordre', m.ordre)))
            FROM relance.vendeur_marque vm JOIN relance.marque m ON m.id = vm.marque_id
           WHERE vm.vendeur_id = v.id), '[]'::jsonb)) ORDER BY v.id)
        FROM relance.vendeur v LEFT JOIN relance.site s ON s.id = v.site_id
       WHERE v.id IN (SELECT vendeur_id FROM ids)), '[]'::jsonb),
    'rdvs', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'id', r.id, 'vendeur_id', r.vendeur_id, 'jour', r.jour, 'creneau_code', r.creneau_code,
        'marque_id', r.marque_id, 'type_vehicule', r.type_vehicule, 'client', r.client,
        'commentaire', r.commentaire) ORDER BY r.id)
        FROM relance.rdv r
       WHERE r.campagne_id = p_campagne_id AND r.archive_le IS NULL
         AND r.vendeur_id IN (SELECT vendeur_id FROM ids)), '[]'::jsonb),
    'tables', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'id', t.id, 'libelle', t.libelle,
        'session_plaque', jsonb_build_object('campagne_id', sp.campagne_id,
            'plaque', jsonb_build_object('id', p.id, 'libelle', p.libelle)),
        'affectation', coalesce((SELECT jsonb_agg(jsonb_build_object('vendeur_id', a.vendeur_id, 'archive_le', a.archive_le))
                                   FROM relance.affectation a WHERE a.table_id = t.id), '[]'::jsonb)) ORDER BY t.id)
        FROM relance.table_phoning t
        JOIN relance.session_plaque sp ON sp.id = t.session_plaque_id
        LEFT JOIN relance.plaque p ON p.id = sp.plaque_id
       WHERE t.chef_utilisateur_id = (SELECT id FROM moi)
         AND sp.campagne_id = p_campagne_id AND t.archive_le IS NULL), '[]'::jsonb),
    'encadrements', coalesce((SELECT jsonb_agg(jsonb_build_object('site_id', e.site_id))
        FROM relance.encadrement_site e
       WHERE e.utilisateur_id = (SELECT id FROM moi) AND e.archive_le IS NULL), '[]'::jsonb),
    'roles_campagne', coalesce((SELECT jsonb_agg(jsonb_build_object('role', rc.role, 'site_id', rc.site_id, 'plaque_id', rc.plaque_id))
        FROM relance.role_campagne rc
       WHERE rc.utilisateur_id = (SELECT id FROM moi) AND rc.campagne_id = p_campagne_id
         AND rc.archive_le IS NULL), '[]'::jsonb)
  );
$fn$;

-- Le tableau de bord : tout ce que lisait `chargerCampagne` (services/dashboard.ts),
-- en un appel. Les RDV viennent de `rdv_agrege` — SANS client ni commentaire,
-- c'est structurel et ca le reste. Une fonction qui rend un `jsonb` n'est pas
-- tronquee par la limite de lignes de PostgREST ; le compte exact est rendu a
-- cote, et le front verifie quand meme que les deux concordent.
CREATE OR REPLACE FUNCTION relance.charger_tableau(p_campagne_id bigint)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = relance, public, pg_temp
AS $fn$
  SELECT jsonb_build_object(
    'campagne', (SELECT jsonb_build_object('id', c.id, 'libelle', c.libelle, 'date_debut', c.date_debut,
                                           'date_fin', c.date_fin, 'cloturee', c.cloturee)
                   FROM relance.campagne c WHERE c.id = p_campagne_id),
    'jours', coalesce((SELECT jsonb_agg(j.jour ORDER BY j.ordre)
                         FROM relance.campagne_jour j WHERE j.campagne_id = p_campagne_id), '[]'::jsonb),
    'sessions', coalesce((SELECT jsonb_agg(jsonb_build_object('id', sp.id, 'mode', sp.mode,
          'effectif_cible_table', sp.effectif_cible_table,
          'plaque', jsonb_build_object('id', p.id, 'libelle', p.libelle, 'ordre', p.ordre)) ORDER BY sp.id)
        FROM relance.session_plaque sp LEFT JOIN relance.plaque p ON p.id = sp.plaque_id
       WHERE sp.campagne_id = p_campagne_id AND sp.archive_le IS NULL), '[]'::jsonb),
    'vendeurs', coalesce((SELECT jsonb_agg(jsonb_build_object('id', v.id, 'nom', v.nom,
          'type_vehicule', v.type_vehicule, 'date_entree', v.date_entree, 'date_sortie', v.date_sortie,
          'site', CASE WHEN s.id IS NULL THEN NULL ELSE jsonb_build_object('id', s.id, 'libelle', s.libelle,
                    'plaque', CASE WHEN p.id IS NULL THEN NULL ELSE jsonb_build_object('id', p.id, 'libelle', p.libelle) END) END)
          ORDER BY v.id)
        FROM relance.vendeur v
        LEFT JOIN relance.site s ON s.id = v.site_id
        LEFT JOIN relance.plaque p ON p.id = s.plaque_id
       WHERE v.archive_le IS NULL), '[]'::jsonb),
    'affectations', coalesce((SELECT jsonb_agg(jsonb_build_object('vendeur_id', a.vendeur_id,
          'table_phoning', jsonb_build_object('id', t.id, 'libelle', t.libelle,
            'session_plaque', jsonb_build_object('campagne_id', sp.campagne_id, 'plaque_id', sp.plaque_id)))
          ORDER BY a.id)
        FROM relance.affectation a
        JOIN relance.table_phoning t ON t.id = a.table_id
        JOIN relance.session_plaque sp ON sp.id = t.session_plaque_id
       WHERE a.archive_le IS NULL AND t.archive_le IS NULL AND sp.campagne_id = p_campagne_id), '[]'::jsonb),
    'rdvs', coalesce((SELECT jsonb_agg(jsonb_build_object('id', r.id, 'vendeur_id', r.vendeur_id,
          'type_vehicule', r.type_vehicule, 'marque_id', r.marque_id, 'jour', r.jour,
          'creneau_code', r.creneau_code) ORDER BY r.id)
        FROM relance.rdv_agrege r
       WHERE r.campagne_id = p_campagne_id AND r.archive_le IS NULL), '[]'::jsonb),
    'nb_rdvs', (SELECT count(*) FROM relance.rdv_agrege r
                 WHERE r.campagne_id = p_campagne_id AND r.archive_le IS NULL)
  );
$fn$;

-- ----------------------------------------------------------------------------
-- 4. POSER UN RDV : UN ALLER-RETOUR, REJOUABLE
-- ----------------------------------------------------------------------------
-- INSERT puis relecture par la cle, dans la meme transaction. Rejouee avec la
-- meme cle — la file d'attente apres une reponse perdue —, la fonction ne cree
-- rien et rend le RDV deja pose. SECURITY INVOKER : la politique `rdv_creation`
-- (perimetre + campagne ouverte) et les triggers s'appliquent comme avant ;
-- `cree_par` reste impose par `rdv_tracabilite`.
CREATE OR REPLACE FUNCTION relance.rdv_poser(
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

  INSERT INTO relance.rdv (campagne_id, vendeur_id, jour, creneau_code, marque_id, type_vehicule, client, cle_client)
  VALUES (p_campagne_id, p_vendeur_id, p_jour, p_creneau_code, p_marque_id, p_type_vehicule, p_client, p_cle)
  ON CONFLICT (cle_client) DO NOTHING;

  SELECT jsonb_build_object('id', r.id, 'vendeur_id', r.vendeur_id, 'jour', r.jour,
           'creneau_code', r.creneau_code, 'marque_id', r.marque_id,
           'type_vehicule', r.type_vehicule, 'client', r.client, 'commentaire', r.commentaire,
           'archive_le', r.archive_le)
    INTO resultat
    FROM relance.rdv r
   WHERE r.cle_client = p_cle;

  IF resultat IS NULL THEN
    -- La cle existe mais la ligne n'est pas lisible : elle appartient a un autre
    -- perimetre. On n'en dit pas plus : la RLS ne se contourne pas par un message.
    RAISE EXCEPTION 'RELANCE: ce rendez-vous ne peut pas etre enregistre sur votre perimetre.';
  END IF;
  RETURN resultat;
END
$fn$;

REVOKE ALL ON FUNCTION relance.charger_saisie(bigint) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION relance.charger_tableau(bigint) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION relance.rdv_poser(bigint, bigint, date, text, bigint, text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION relance.charger_saisie(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION relance.charger_tableau(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION relance.rdv_poser(bigint, bigint, date, text, bigint, text, text, uuid) TO authenticated;

-- ----------------------------------------------------------------------------
-- 5. DIFFUSER LES CHANGEMENTS DE TABLES
-- ----------------------------------------------------------------------------
-- Trois ecrans ecoutaient `tables:modifiees` ; rien ne l'emettait. Une table
-- recomposee pendant une seance ne se propageait donc pas. Trigger PAR
-- INSTRUCTION, avec table de transition : une repartition automatique qui pose
-- quarante affectations envoie UN message par campagne, pas quarante.
CREATE OR REPLACE FUNCTION relance.diffuser_tables()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = relance, public, pg_temp
AS $fn$
DECLARE
  c bigint;
BEGIN
  IF TG_TABLE_NAME = 'affectation' THEN
    FOR c IN SELECT DISTINCT sp.campagne_id
               FROM nouveaux n
               JOIN relance.table_phoning t ON t.id = n.table_id
               JOIN relance.session_plaque sp ON sp.id = t.session_plaque_id
    LOOP
      PERFORM realtime.send(jsonb_build_object('campagneId', c::text), 'tables', 'campagne-' || c::text, true);
    END LOOP;
  ELSE
    FOR c IN SELECT DISTINCT sp.campagne_id
               FROM nouveaux n
               JOIN relance.session_plaque sp ON sp.id = n.session_plaque_id
    LOOP
      PERFORM realtime.send(jsonb_build_object('campagneId', c::text), 'tables', 'campagne-' || c::text, true);
    END LOOP;
  END IF;
  RETURN NULL;
END $fn$;

-- Meme regle que toutes les fonctions de trigger (test:rls le verifie) :
-- personne ne l'appelle directement.
REVOKE ALL ON FUNCTION relance.diffuser_tables() FROM PUBLIC, anon, authenticated;

-- Pose seulement la ou `realtime.send` existe — meme raison que `rdv_diffusion`
-- (20260831220000) : sur un PostgreSQL nu, chaque ecriture echouerait.
DO $trigger$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'realtime' AND p.proname = 'send'
  ) THEN
    EXECUTE $sql$
      DROP TRIGGER IF EXISTS affectation_diffusion_ajout ON relance.affectation;
      CREATE TRIGGER affectation_diffusion_ajout AFTER INSERT ON relance.affectation
        REFERENCING NEW TABLE AS nouveaux FOR EACH STATEMENT EXECUTE FUNCTION relance.diffuser_tables();
      DROP TRIGGER IF EXISTS affectation_diffusion_modif ON relance.affectation;
      CREATE TRIGGER affectation_diffusion_modif AFTER UPDATE ON relance.affectation
        REFERENCING NEW TABLE AS nouveaux FOR EACH STATEMENT EXECUTE FUNCTION relance.diffuser_tables();
      DROP TRIGGER IF EXISTS table_phoning_diffusion_ajout ON relance.table_phoning;
      CREATE TRIGGER table_phoning_diffusion_ajout AFTER INSERT ON relance.table_phoning
        REFERENCING NEW TABLE AS nouveaux FOR EACH STATEMENT EXECUTE FUNCTION relance.diffuser_tables();
      DROP TRIGGER IF EXISTS table_phoning_diffusion_modif ON relance.table_phoning;
      CREATE TRIGGER table_phoning_diffusion_modif AFTER UPDATE ON relance.table_phoning
        REFERENCING NEW TABLE AS nouveaux FOR EACH STATEMENT EXECUTE FUNCTION relance.diffuser_tables();
    $sql$;
  ELSE
    RAISE NOTICE 'RELANCE: realtime.send absent — triggers de diffusion des tables non poses (base locale).';
  END IF;
END $trigger$;
