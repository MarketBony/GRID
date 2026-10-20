-- ============================================================================
-- GRID/VP — LA VENTE PRIVEE (20/10/2026, PLAN-GRID-VP.md)
--
-- Une VP est une opération LOCALE : un site, deux jours de phoning (J1, J2),
-- puis un jour de RDV (J3). Le principe retenu : UNE VP EST UNE CAMPAGNE. Elle
-- hérite de tout ce que GRID classique sait faire — grille, créneaux,
-- mobilisation, Suivi, trafic naturel, no show, clôture. Cette migration ne pose
-- que ce qui lui est propre :
--
--   1. campagne.nature / site_id / phoning_du / phoning_au, et leurs CHECK
--   2. mobilisation.objectif_rdv        — l'objectif de RDV de chaque vendeur
--   3. rdv.pris_par_vendeur_id          — la réaffectation du jour J
--   4. rdv_suivi.arrive_le / avec_vendeur_le / sorti_le — la tablette d'accueil
--   5. le palier `peut_gerer_vp()` = admin SEUL, et le garde-fou qui l'applique
--      à toute écriture de préparation d'une VP
--   6. le périmètre : UNE condition de présence, `v.site_id = c.site_id`
--   7. les RPC : vp_creer, rdv_reaffecter, rdv_accueil_avancer,
--      rdv_accueil_reculer, vp_noshow_absents
--
-- Tout est ADDITIF. Les campagnes existantes prennent `nature = 'operation'`,
-- `site_id` NULL : la condition de périmètre est vraie pour elles, et leurs
-- périmètres ne changent pas d'une ligne.
-- ============================================================================

-- ---------------------------------------------------------------- 1 a 4 : colonnes (Prisma)

-- AlterTable
ALTER TABLE "campagne" ADD COLUMN     "nature" TEXT NOT NULL DEFAULT 'operation',
ADD COLUMN     "phoning_au" DATE,
ADD COLUMN     "phoning_du" DATE,
ADD COLUMN     "site_id" BIGINT;

-- AlterTable
ALTER TABLE "mobilisation" ADD COLUMN     "objectif_rdv" INTEGER;

-- AlterTable
ALTER TABLE "rdv" ADD COLUMN     "pris_par_vendeur_id" BIGINT;

-- AlterTable
ALTER TABLE "rdv_suivi" ADD COLUMN     "arrive_le" TIMESTAMPTZ(6),
ADD COLUMN     "avec_vendeur_le" TIMESTAMPTZ(6),
ADD COLUMN     "sorti_le" TIMESTAMPTZ(6);

-- CreateIndex
CREATE INDEX "campagne_site_id_idx" ON "campagne"("site_id");

-- AddForeignKey
ALTER TABLE "campagne" ADD CONSTRAINT "campagne_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rdv" ADD CONSTRAINT "rdv_pris_par_vendeur_id_fkey" FOREIGN KEY ("pris_par_vendeur_id") REFERENCES "vendeur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

SET search_path TO relance, public;

-- ---------------------------------------------------------------- les CHECK

-- La liste de valeurs : `NATURES_CAMPAGNE` dans `auth/roles.ts`, comparée par
-- `test:invariants` (interdit n.6).
ALTER TABLE campagne ADD CONSTRAINT campagne_nature_check
  CHECK (nature IN ('operation', 'vente_privee'));

-- Un site SI ET SEULEMENT SI c'est une VP. Une opération multi-site qui
-- porterait un site verrait son périmètre réduit à ce site sans que personne
-- ne l'ait voulu.
ALTER TABLE campagne ADD CONSTRAINT campagne_vp_site_check
  CHECK ((nature = 'vente_privee') = (site_id IS NOT NULL));

-- J1 <= J2 < J3. Le jour des RDV est `date_debut` (= `date_fin`, un seul jour).
ALTER TABLE campagne ADD CONSTRAINT campagne_vp_phoning_check
  CHECK (
    CASE WHEN nature = 'vente_privee'
      THEN phoning_du IS NOT NULL AND phoning_au IS NOT NULL
           AND phoning_du <= phoning_au AND phoning_au < date_debut
      ELSE phoning_du IS NULL AND phoning_au IS NULL
    END
  );

ALTER TABLE mobilisation ADD CONSTRAINT mobilisation_objectif_rdv_check
  CHECK (objectif_rdv IS NULL OR objectif_rdv >= 0);

-- L'accueil avance dans un seul sens : arrivé, puis avec le vendeur, puis sorti.
ALTER TABLE rdv_suivi ADD CONSTRAINT rdv_suivi_accueil_ordre_check
  CHECK (
    (avec_vendeur_le IS NULL OR (arrive_le IS NOT NULL AND avec_vendeur_le >= arrive_le))
    AND (sorti_le IS NULL OR (avec_vendeur_le IS NOT NULL AND sorti_le >= avec_vendeur_le))
  );
-- Un client arrivé n'est pas un no show.
ALTER TABLE rdv_suivi ADD CONSTRAINT rdv_suivi_no_show_absent_check
  CHECK (NOT (issue = 'no_show' AND arrive_le IS NOT NULL));

-- ---------------------------------------------------------------- 5. le palier

-- PARAMETRER UNE VP : `admin` SEUL — décision de l'utilisateur du 20/10/2026,
-- `direction` n'y a pas accès. Écrite comme les deux autres paliers (une
-- disjonction de `a_role_global`), parce que `test:invariants` la lit ainsi et la
-- compare à `ROLES_GESTION_VP`.
CREATE OR REPLACE FUNCTION relance.peut_gerer_vp()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = relance, public, pg_temp
AS $fn$
  SELECT relance.a_role_global('admin')
$fn$;

CREATE OR REPLACE FUNCTION relance.exiger_gestion_vp()
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
  IF NOT relance.peut_gerer_vp() THEN
    RAISE EXCEPTION 'RELANCE: les ventes privees se parametrent par un administrateur.';
  END IF;
  RETURN moi;
END $fn$;

-- LE GARDE-FOU DE PREPARATION.
--
-- Les politiques de `campagne`, `campagne_jour`, `campagne_creneau`,
-- `session_plaque`, `role_campagne` et `mobilisation` accordent l'écriture à
-- `peut_administrer()`, donc à `direction`. Et plusieurs RPC `security definer`
-- (créneaux, jours) écrivent ces tables sans passer par la RLS. Réécrire chaque
-- politique et chaque RPC aurait multiplié les endroits où la règle vit ; un
-- trigger la porte en UN point, quel que soit le chemin de l'écriture — c'est la
-- leçon de `rdv_campagne_ouverte`.
--
-- Sans utilisateur (migration, seed, suites lancées en propriétaire), rien n'est
-- vérifié : toute écriture de l'application porte un utilisateur, et les RPC
-- commencent par l'exiger.
CREATE OR REPLACE FUNCTION relance.verifier_preparation_vp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = relance, public, pg_temp
AS $fn$
DECLARE
  est_vp boolean;
BEGIN
  IF TG_TABLE_NAME = 'campagne' THEN
    est_vp := NEW.nature = 'vente_privee'
              OR (TG_OP = 'UPDATE' AND OLD.nature = 'vente_privee');
  ELSE
    SELECT c.nature = 'vente_privee' INTO est_vp
      FROM relance.campagne c
     WHERE c.id = COALESCE(NEW.campagne_id, OLD.campagne_id);
  END IF;

  IF coalesce(est_vp, false)
     AND relance.utilisateur_courant() IS NOT NULL
     AND NOT relance.peut_gerer_vp() THEN
    RAISE EXCEPTION 'RELANCE: les ventes privees se parametrent par un administrateur.';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END $fn$;

CREATE TRIGGER campagne_preparation_vp
  BEFORE INSERT OR UPDATE ON campagne
  FOR EACH ROW EXECUTE FUNCTION relance.verifier_preparation_vp();
CREATE TRIGGER campagne_jour_preparation_vp
  BEFORE INSERT OR UPDATE OR DELETE ON campagne_jour
  FOR EACH ROW EXECUTE FUNCTION relance.verifier_preparation_vp();
CREATE TRIGGER campagne_creneau_preparation_vp
  BEFORE INSERT OR UPDATE OR DELETE ON campagne_creneau
  FOR EACH ROW EXECUTE FUNCTION relance.verifier_preparation_vp();
CREATE TRIGGER session_plaque_preparation_vp
  BEFORE INSERT OR UPDATE ON session_plaque
  FOR EACH ROW EXECUTE FUNCTION relance.verifier_preparation_vp();
CREATE TRIGGER role_campagne_preparation_vp
  BEFORE INSERT OR UPDATE ON role_campagne
  FOR EACH ROW EXECUTE FUNCTION relance.verifier_preparation_vp();
CREATE TRIGGER mobilisation_preparation_vp
  BEFORE INSERT OR UPDATE ON mobilisation
  FOR EACH ROW EXECUTE FUNCTION relance.verifier_preparation_vp();

-- La nature et le site d'une campagne sont FIGES à sa création. Faire d'une
-- opération une VP réduirait son périmètre à un site, RDV posés compris ; faire
-- changer une VP de site rendrait ses RDV incohérents. On crée une autre VP.
CREATE OR REPLACE FUNCTION relance.verifier_nature_figee()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = relance, public, pg_temp
AS $fn$
BEGIN
  IF NEW.nature IS DISTINCT FROM OLD.nature OR NEW.site_id IS DISTINCT FROM OLD.site_id THEN
    RAISE EXCEPTION 'RELANCE: la nature et le site d''une campagne ne changent pas apres sa creation.';
  END IF;
  RETURN NEW;
END $fn$;

CREATE TRIGGER campagne_nature_figee
  BEFORE UPDATE OF nature, site_id ON campagne
  FOR EACH ROW EXECUTE FUNCTION relance.verifier_nature_figee();

-- UNE VP NE RECOIT QUE LES VENDEURS DE SON SITE — RDV comme mobilisation. Le
-- périmètre le garantit déjà pour l'application ; ce trigger le garantit pour
-- tout le reste, comme les autres garde-fous de `rdv`. Il ne lit le site du
-- vendeur qu'au moment de l'écriture : un vendeur qui change de site ensuite ne
-- rend pas ses RDV passés invalides.
CREATE OR REPLACE FUNCTION relance.verifier_site_vp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = relance, public, pg_temp
AS $fn$
DECLARE
  vp_site bigint;
BEGIN
  SELECT c.site_id INTO vp_site FROM relance.campagne c WHERE c.id = NEW.campagne_id;
  IF vp_site IS NULL THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM relance.vendeur v WHERE v.id = NEW.vendeur_id AND v.site_id = vp_site) THEN
    RAISE EXCEPTION 'RELANCE: une vente privee ne concerne que les vendeurs de son site.';
  END IF;
  -- Deux IF imbriques et non un AND : PL/pgSQL n'evalue pas en court-circuit, et
  -- `mobilisation` n'a pas de colonne `pris_par_vendeur_id` (mesure par test:rls).
  IF TG_TABLE_NAME = 'rdv' THEN
    IF NEW.pris_par_vendeur_id IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM relance.vendeur v WHERE v.id = NEW.pris_par_vendeur_id AND v.site_id = vp_site) THEN
      RAISE EXCEPTION 'RELANCE: une vente privee ne concerne que les vendeurs de son site.';
    END IF;
  END IF;
  RETURN NEW;
END $fn$;

CREATE TRIGGER rdv_site_vp
  BEFORE INSERT OR UPDATE OF campagne_id, vendeur_id, pris_par_vendeur_id ON rdv
  FOR EACH ROW EXECUTE FUNCTION relance.verifier_site_vp();
CREATE TRIGGER mobilisation_site_vp
  BEFORE INSERT OR UPDATE OF campagne_id, vendeur_id ON mobilisation
  FOR EACH ROW EXECUTE FUNCTION relance.verifier_site_vp();

-- Les fonctions de trigger ne s'appellent jamais directement (03/09/2026).
REVOKE ALL ON FUNCTION relance.verifier_preparation_vp() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION relance.verifier_nature_figee() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION relance.verifier_site_vp() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------- 6. le perimetre
--
-- UNE CONDITION DE PRESENCE, ajoutée aux deux branches, au même titre que
-- l'archivage et les dates d'entrée et de sortie : dans une VP, seuls les
-- vendeurs de son site sont présents. Les origines de droit ne changent pas et
-- restent écrites une fois (interdit n.4) — un admin voit tout le site, un
-- encadrant ses sites, donc celui de la VP s'il l'encadre.
--
-- Corps repris de 20261008090000_suivi_perimetre_sites, la condition en plus.

CREATE OR REPLACE VIEW relance.perimetre_suivi AS
SELECT c.id AS campagne_id,
       v.id AS vendeur_id
FROM relance.campagne c
CROSS JOIN relance.vendeur v
WHERE (SELECT relance.utilisateur_courant()) IS NOT NULL
  AND v.archive_le IS NULL
  AND (v.date_entree IS NULL OR v.date_entree <= c.date_fin)
  AND (v.date_sortie IS NULL OR v.date_sortie >= c.date_debut)
  AND (c.site_id IS NULL OR v.site_id = c.site_id)
  AND (
    (SELECT relance.peut_administrer())

    OR EXISTS (
      SELECT 1
      FROM relance.role_campagne rc
      JOIN relance.site s ON s.id = v.site_id
      WHERE rc.utilisateur_id = (SELECT relance.utilisateur_courant())
        AND rc.campagne_id = c.id
        AND rc.role = 'chef_plaque'
        AND rc.plaque_id = s.plaque_id
        AND rc.archive_le IS NULL
    )

    OR EXISTS (
      SELECT 1
      FROM relance.role_campagne rc
      WHERE rc.utilisateur_id = (SELECT relance.utilisateur_courant())
        AND rc.campagne_id = c.id
        AND rc.role = 'chef_site'
        AND rc.site_id = v.site_id
        AND rc.archive_le IS NULL
    )

    OR EXISTS (
      SELECT 1
      FROM relance.encadrement_site es
      WHERE es.utilisateur_id = (SELECT relance.utilisateur_courant())
        AND es.site_id = v.site_id
        AND es.archive_le IS NULL
    )
  );

CREATE OR REPLACE VIEW relance.perimetre_saisie AS
SELECT ps.campagne_id, ps.vendeur_id
FROM relance.perimetre_suivi ps
UNION
SELECT c.id AS campagne_id,
       v.id AS vendeur_id
FROM relance.campagne c
CROSS JOIN relance.vendeur v
WHERE (SELECT relance.utilisateur_courant()) IS NOT NULL
  AND v.archive_le IS NULL
  AND (v.date_entree IS NULL OR v.date_entree <= c.date_fin)
  AND (v.date_sortie IS NULL OR v.date_sortie >= c.date_debut)
  AND (c.site_id IS NULL OR v.site_id = c.site_id)
  AND EXISTS (
    SELECT 1
    FROM relance.affectation a
    JOIN relance.table_phoning t ON t.id = a.table_id
    JOIN relance.session_plaque sp ON sp.id = t.session_plaque_id
    WHERE a.vendeur_id = v.id
      AND a.archive_le IS NULL
      AND t.archive_le IS NULL
      AND t.chef_utilisateur_id = (SELECT relance.utilisateur_courant())
      AND sp.campagne_id = c.id
      AND sp.archive_le IS NULL
  );

-- ---------------------------------------------------------------- 7. les RPC

-- CREER UNE VP. Une transaction : la campagne, son jour de RDV, ses créneaux.
-- Les créneaux sont recopiés d'une campagne modèle désignée par l'appelant,
-- comme `campagne_creer` (interdit n.3 : ce sont des données). AUCUNE session :
-- une VP n'a pas de table, et sans table sur la plaque tout vendeur du site est
-- mobilisé par défaut (`mobilisation()`, agregats.ts). Les absents et les
-- objectifs s'écrivent ensuite dans `mobilisation`.
CREATE OR REPLACE FUNCTION relance.vp_creer(
  p_libelle text,
  p_site_id bigint,
  p_jour date,
  p_phoning_du date,
  p_phoning_au date,
  p_modele_id bigint
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = relance, public, pg_temp
AS $fn$
DECLARE
  moi bigint := relance.exiger_gestion_vp();
  v_libelle text := btrim(coalesce(p_libelle, ''));
  nouvelle bigint;
BEGIN
  IF v_libelle = '' THEN
    RAISE EXCEPTION 'RELANCE: le libelle de la vente privee est requis.';
  END IF;
  IF EXISTS (SELECT 1 FROM relance.campagne c WHERE c.libelle = v_libelle) THEN
    RAISE EXCEPTION 'RELANCE: une campagne s''appelle deja « % ».', v_libelle;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM relance.site s WHERE s.id = p_site_id AND s.archive_le IS NULL) THEN
    RAISE EXCEPTION 'RELANCE: site introuvable.';
  END IF;
  IF p_jour IS NULL OR p_phoning_du IS NULL OR p_phoning_au IS NULL THEN
    RAISE EXCEPTION 'RELANCE: les deux jours de phoning et le jour de la vente privee sont requis.';
  END IF;
  IF NOT (p_phoning_du <= p_phoning_au AND p_phoning_au < p_jour) THEN
    RAISE EXCEPTION 'RELANCE: les jours de phoning doivent preceder le jour de la vente privee, dans l''ordre.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM relance.campagne_creneau cc WHERE cc.campagne_id = p_modele_id) THEN
    RAISE EXCEPTION 'RELANCE: la campagne modele n''a aucun creneau a reprendre.';
  END IF;

  INSERT INTO relance.campagne (libelle, date_debut, date_fin, nature, site_id, phoning_du, phoning_au, cree_par)
  VALUES (v_libelle, p_jour, p_jour, 'vente_privee', p_site_id, p_phoning_du, p_phoning_au, moi)
  RETURNING id INTO nouvelle;

  INSERT INTO relance.campagne_jour (campagne_id, jour, ordre, cree_par)
  VALUES (nouvelle, p_jour, 1, moi);

  INSERT INTO relance.campagne_creneau (campagne_id, code, libelle, ordre, cree_par)
  SELECT nouvelle, cc.code, cc.libelle, cc.ordre, moi
    FROM relance.campagne_creneau cc
   WHERE cc.campagne_id = p_modele_id;

  RETURN nouvelle;
END $fn$;

-- REAFFECTER UN RDV DU JOUR J. Le RDV change de vendeur ; celui qui l'a PRIS est
-- retenu dans `pris_par_vendeur_id` — décision du 20/10/2026 : le phoning reste à
-- qui a pris le RDV, la vente va à qui reçoit le client. Rendre le RDV à son
-- preneur efface la mention.
--
-- Les garde-fous de `rdv` s'appliquent au nouveau vendeur comme à une saisie :
-- campagne ouverte, type de véhicule, marque autorisée (R-C.1), site de la VP.
-- L'appelant doit pouvoir saisir les DEUX vendeurs, comme s'il déplaçait le RDV
-- à la main.
CREATE OR REPLACE FUNCTION relance.rdv_reaffecter(p_rdv_id bigint, p_vendeur_id bigint)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = relance, public, pg_temp
AS $fn$
DECLARE
  moi bigint := relance.utilisateur_courant();
  r record;
  preneur bigint;
BEGIN
  IF moi IS NULL THEN
    RAISE EXCEPTION 'RELANCE: authentification requise.';
  END IF;
  SELECT rd.id, rd.campagne_id, rd.vendeur_id, rd.pris_par_vendeur_id INTO r
    FROM relance.rdv rd WHERE rd.id = p_rdv_id AND rd.archive_le IS NULL;
  IF r.id IS NULL THEN
    RAISE EXCEPTION 'RELANCE: RDV introuvable.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM relance.campagne c WHERE c.id = r.campagne_id AND c.nature = 'vente_privee') THEN
    RAISE EXCEPTION 'RELANCE: la reaffectation est propre aux ventes privees.';
  END IF;
  IF NOT relance.peut_saisir(r.vendeur_id, r.campagne_id)
     OR NOT relance.peut_saisir(p_vendeur_id, r.campagne_id) THEN
    RAISE EXCEPTION 'RELANCE: ce vendeur est hors de votre perimetre.';
  END IF;
  IF p_vendeur_id = r.vendeur_id THEN
    RETURN r.id;
  END IF;

  preneur := coalesce(r.pris_par_vendeur_id, r.vendeur_id);
  UPDATE relance.rdv
     SET vendeur_id = p_vendeur_id,
         pris_par_vendeur_id = CASE WHEN preneur = p_vendeur_id THEN NULL ELSE preneur END
   WHERE id = r.id;
  RETURN r.id;
END $fn$;

-- LA TABLETTE D'ACCUEIL. Un geste fait avancer le client d'UNE étape —
-- arrivé, puis avec le vendeur, puis sorti — à l'heure du SERVEUR (celle d'une
-- tablette peut dériver). Il n'y a donc aucune liste d'étapes à dupliquer entre
-- le front et la base (interdit n.6) : la base sait quelle est la suivante.
-- L'issue, elle, s'écrit par `suivi_enregistrer`, comme dans le Suivi.
CREATE OR REPLACE FUNCTION relance.exiger_accueil(p_rdv_id bigint)
RETURNS bigint
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = relance, public, pg_temp
AS $fn$
DECLARE
  moi bigint := relance.utilisateur_courant();
BEGIN
  IF moi IS NULL THEN
    RAISE EXCEPTION 'RELANCE: authentification requise.';
  END IF;
  IF NOT EXISTS (
    SELECT 1
      FROM relance.rdv r
      JOIN relance.campagne c ON c.id = r.campagne_id
      JOIN relance.perimetre_suivi ps ON ps.campagne_id = r.campagne_id AND ps.vendeur_id = r.vendeur_id
     WHERE r.id = p_rdv_id AND r.archive_le IS NULL AND c.nature = 'vente_privee'
  ) THEN
    RAISE EXCEPTION 'RELANCE: RDV introuvable dans les ventes privees de votre perimetre.';
  END IF;
  IF NOT relance.campagne_ouverte((SELECT r.campagne_id FROM relance.rdv r WHERE r.id = p_rdv_id)) THEN
    RAISE EXCEPTION 'RELANCE: cette vente privee est cloturee.';
  END IF;
  RETURN moi;
END $fn$;

CREATE OR REPLACE FUNCTION relance.rdv_accueil_avancer(p_rdv_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = relance, public, pg_temp
AS $fn$
DECLARE
  moi bigint := relance.exiger_accueil(p_rdv_id);
  s relance.rdv_suivi;
BEGIN
  IF EXISTS (SELECT 1 FROM relance.rdv_suivi x WHERE x.rdv_id = p_rdv_id AND x.issue = 'no_show') THEN
    RAISE EXCEPTION 'RELANCE: ce client est note No show. Retirer cette issue dans le Suivi avant de le pointer.';
  END IF;

  INSERT INTO relance.rdv_suivi AS x (rdv_id, arrive_le)
  VALUES (p_rdv_id, now())
  ON CONFLICT (rdv_id) DO UPDATE SET
    arrive_le       = coalesce(x.arrive_le, now()),
    avec_vendeur_le = CASE WHEN x.arrive_le IS NOT NULL AND x.avec_vendeur_le IS NULL
                           THEN now() ELSE x.avec_vendeur_le END,
    sorti_le        = CASE WHEN x.avec_vendeur_le IS NOT NULL AND x.sorti_le IS NULL
                           THEN now() ELSE x.sorti_le END
  RETURNING * INTO s;

  RETURN jsonb_build_object('rdv_id', s.rdv_id, 'arrive_le', s.arrive_le,
                            'avec_vendeur_le', s.avec_vendeur_le, 'sorti_le', s.sorti_le);
END $fn$;

-- Le pendant, pour un geste fait par erreur : retire la DERNIERE étape posée.
CREATE OR REPLACE FUNCTION relance.rdv_accueil_reculer(p_rdv_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = relance, public, pg_temp
AS $fn$
DECLARE
  moi bigint := relance.exiger_accueil(p_rdv_id);
  s relance.rdv_suivi;
BEGIN
  UPDATE relance.rdv_suivi AS x SET
    sorti_le        = NULL,
    avec_vendeur_le = CASE WHEN x.sorti_le IS NULL THEN NULL ELSE x.avec_vendeur_le END,
    arrive_le       = CASE WHEN x.sorti_le IS NULL AND x.avec_vendeur_le IS NULL THEN NULL ELSE x.arrive_le END
   WHERE x.rdv_id = p_rdv_id
  RETURNING * INTO s;

  RETURN jsonb_build_object('rdv_id', p_rdv_id, 'arrive_le', s.arrive_le,
                            'avec_vendeur_le', s.avec_vendeur_le, 'sorti_le', s.sorti_le);
END $fn$;

-- CLORE LA JOURNEE : tout RDV du phoning ni arrivé ni qualifié passe en No show,
-- en une transaction. Seulement dans le périmètre de l'appelant. Rend le nombre
-- de RDV passés en No show.
CREATE OR REPLACE FUNCTION relance.vp_noshow_absents(p_campagne_id bigint)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = relance, public, pg_temp
AS $fn$
DECLARE
  moi bigint := relance.utilisateur_courant();
  n integer;
BEGIN
  IF moi IS NULL THEN
    RAISE EXCEPTION 'RELANCE: authentification requise.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM relance.campagne c WHERE c.id = p_campagne_id AND c.nature = 'vente_privee') THEN
    RAISE EXCEPTION 'RELANCE: vente privee introuvable.';
  END IF;
  IF NOT relance.campagne_ouverte(p_campagne_id) THEN
    RAISE EXCEPTION 'RELANCE: cette vente privee est cloturee.';
  END IF;
  -- Un appelant sans aucun vendeur de cette VP dans son perimetre est REFUSE, et
  -- non servi d'un « 0 » : un refus silencieux se lirait comme « aucun absent ».
  IF NOT EXISTS (SELECT 1 FROM relance.perimetre_suivi ps WHERE ps.campagne_id = p_campagne_id) THEN
    RAISE EXCEPTION 'RELANCE: cette vente privee est hors de votre perimetre.';
  END IF;

  INSERT INTO relance.rdv_suivi AS x (rdv_id, issue)
  SELECT r.id, 'no_show'
    FROM relance.rdv r
    JOIN relance.perimetre_suivi ps ON ps.campagne_id = r.campagne_id AND ps.vendeur_id = r.vendeur_id
    LEFT JOIN relance.rdv_suivi su ON su.rdv_id = r.id
   WHERE r.campagne_id = p_campagne_id
     AND r.archive_le IS NULL
     AND r.source = 'relance'
     AND (su.rdv_id IS NULL OR (su.arrive_le IS NULL AND su.issue IS NULL))
  ON CONFLICT (rdv_id) DO UPDATE SET issue = 'no_show'
   WHERE x.arrive_le IS NULL AND x.issue IS NULL;

  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $fn$;

-- ---------------------------------------------------------------- droits
-- PostgreSQL accorde l'exécution à PUBLIC par défaut, `anon` compris. Les gardes
-- (`exiger_*`) restent internes ; le palier est lisible par le front (affichage).
REVOKE ALL ON FUNCTION relance.peut_gerer_vp() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION relance.peut_gerer_vp() TO authenticated;
REVOKE ALL ON FUNCTION relance.exiger_gestion_vp() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION relance.exiger_accueil(bigint) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION relance.vp_creer(text, bigint, date, date, date, bigint) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION relance.rdv_reaffecter(bigint, bigint) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION relance.rdv_accueil_avancer(bigint) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION relance.rdv_accueil_reculer(bigint) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION relance.vp_noshow_absents(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION relance.vp_creer(text, bigint, date, date, date, bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION relance.rdv_reaffecter(bigint, bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION relance.rdv_accueil_avancer(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION relance.rdv_accueil_reculer(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION relance.vp_noshow_absents(bigint) TO authenticated;
