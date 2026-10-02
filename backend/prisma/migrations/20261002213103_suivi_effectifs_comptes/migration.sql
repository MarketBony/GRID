-- ============================================================================
-- SUIVI DES RDV, EFFECTIFS PAR SESSION, JOURNAL DES COMPTES — lot 2 de
-- PLAN-GRID-V2.md (03/10/2026). TOUT EST ADDITIF : l'ancien front fonctionne
-- sur cette base, ce qui garde ouverte la voie du `wrangler rollback`.
-- ============================================================================

-- AlterTable
ALTER TABLE "rdv" ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'relance';

-- AlterTable
ALTER TABLE "utilisateur" ADD COLUMN     "doit_changer_mdp" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "rdv_suivi" (
    "rdv_id" BIGINT NOT NULL,
    "issue" TEXT,
    "diac" BOOLEAN NOT NULL DEFAULT false,
    "stock" BOOLEAN NOT NULL DEFAULT false,
    "cs" BOOLEAN NOT NULL DEFAULT false,
    "modele" TEXT,
    "commentaire" TEXT,
    "cree_le" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cree_par" BIGINT,
    "modifie_le" TIMESTAMPTZ(6),
    "modifie_par" BIGINT,

    CONSTRAINT "rdv_suivi_pkey" PRIMARY KEY ("rdv_id")
);

-- CreateTable
CREATE TABLE "mobilisation" (
    "id" BIGSERIAL NOT NULL,
    "campagne_id" BIGINT NOT NULL,
    "vendeur_id" BIGINT NOT NULL,
    "mobilise" BOOLEAN NOT NULL DEFAULT false,
    "motif" TEXT,
    "cree_le" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cree_par" BIGINT,
    "modifie_le" TIMESTAMPTZ(6),

    CONSTRAINT "mobilisation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_compte" (
    "id" BIGSERIAL NOT NULL,
    "cree_le" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cree_par" BIGINT,
    "cible_id" BIGINT NOT NULL,
    "action" TEXT NOT NULL,
    "detail" TEXT,

    CONSTRAINT "journal_compte_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mobilisation_vendeur_id_idx" ON "mobilisation"("vendeur_id");

-- CreateIndex
CREATE UNIQUE INDEX "mobilisation_campagne_id_vendeur_id_key" ON "mobilisation"("campagne_id", "vendeur_id");

-- CreateIndex
CREATE INDEX "journal_compte_cible_id_idx" ON "journal_compte"("cible_id");

-- AddForeignKey
ALTER TABLE "rdv_suivi" ADD CONSTRAINT "rdv_suivi_rdv_id_fkey" FOREIGN KEY ("rdv_id") REFERENCES "rdv"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mobilisation" ADD CONSTRAINT "mobilisation_campagne_id_fkey" FOREIGN KEY ("campagne_id") REFERENCES "campagne"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mobilisation" ADD CONSTRAINT "mobilisation_vendeur_id_fkey" FOREIGN KEY ("vendeur_id") REFERENCES "vendeur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_compte" ADD CONSTRAINT "journal_compte_cible_id_fkey" FOREIGN KEY ("cible_id") REFERENCES "utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

SET search_path TO relance, public;

-- ----------------------------------------------------------------------------
-- 1. LES LISTES DE VALEURS — chacune comparee a `backend/src/auth/roles.ts` par
--    `test:invariants` (interdit n.6).
-- ----------------------------------------------------------------------------
ALTER TABLE rdv ADD CONSTRAINT rdv_source_check CHECK (source IN ('relance', 'showroom'));
ALTER TABLE rdv_suivi ADD CONSTRAINT rdv_suivi_issue_check
  CHECK (issue IS NULL OR issue IN ('commande', 'offre_en_cours', 'annule', 'clos_sans_suite'));
-- DIAC / STOCK / CS n'ont de sens que pour une commande. Sans ce garde-fou, un
-- RDV « annule » pourrait porter un financement, et les ventilations du suivi
-- compteraient une commande qui n'existe pas.
ALTER TABLE rdv_suivi ADD CONSTRAINT rdv_suivi_avantages_check
  CHECK (issue = 'commande' OR (NOT diac AND NOT stock AND NOT cs));
ALTER TABLE journal_compte ADD CONSTRAINT journal_compte_action_check
  CHECK (action IN ('reinitialisation', 'changement_mot_de_passe', 'desactivation', 'reactivation'));

-- ----------------------------------------------------------------------------
-- 2. AUCUN DELETE (interdit n.1), TRACABILITE, comme toutes les autres tables
-- ----------------------------------------------------------------------------
CREATE TRIGGER rdv_suivi_pas_de_delete BEFORE DELETE ON rdv_suivi
  FOR EACH STATEMENT EXECUTE FUNCTION interdire_suppression();
CREATE TRIGGER mobilisation_pas_de_delete BEFORE DELETE ON mobilisation
  FOR EACH STATEMENT EXECUTE FUNCTION interdire_suppression();
CREATE TRIGGER journal_compte_pas_de_delete BEFORE DELETE ON journal_compte
  FOR EACH STATEMENT EXECUTE FUNCTION interdire_suppression();

-- Le suivi se MODIFIE (on change d'avis sur une issue) : qui l'a pose, qui l'a
-- change en dernier, et quand. Meme regle que `tracer_modification_rdv` : la
-- creation ne se reecrit jamais, l'attribution n'est pas declarative.
CREATE OR REPLACE FUNCTION relance.tracer_suivi()
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
  NEW.modifie_le := now();
  IF moi IS NOT NULL THEN NEW.modifie_par := moi; END IF;
  NEW.cree_par := OLD.cree_par;
  NEW.cree_le := OLD.cree_le;
  RETURN NEW;
END $fn$;

CREATE TRIGGER rdv_suivi_tracabilite BEFORE INSERT OR UPDATE ON rdv_suivi
  FOR EACH ROW EXECUTE FUNCTION relance.tracer_suivi();

CREATE OR REPLACE FUNCTION relance.horodater_mobilisation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = relance, public, pg_temp
AS $fn$
BEGIN
  NEW.modifie_le := now();
  NEW.cree_par := OLD.cree_par;
  NEW.cree_le := OLD.cree_le;
  RETURN NEW;
END $fn$;

CREATE TRIGGER mobilisation_tracabilite BEFORE INSERT ON mobilisation
  FOR EACH ROW EXECUTE FUNCTION relance.tracer_creation();
CREATE TRIGGER mobilisation_horodatage BEFORE UPDATE ON mobilisation
  FOR EACH ROW EXECUTE FUNCTION relance.horodater_mobilisation();

REVOKE ALL ON FUNCTION relance.tracer_suivi() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION relance.horodater_mobilisation() FROM PUBLIC, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 3. RLS — activee ET ecrite dans la meme migration (interdit n.4)
-- ----------------------------------------------------------------------------
ALTER TABLE rdv_suivi ENABLE ROW LEVEL SECURITY;
ALTER TABLE mobilisation ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_compte ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON rdv_suivi TO authenticated;
GRANT SELECT, INSERT, UPDATE ON mobilisation TO authenticated;
GRANT SELECT ON journal_compte TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA relance TO authenticated;
-- Chacun lit son propre drapeau ; seules les fonctions ci-dessous l'ecrivent.
GRANT SELECT (doit_changer_mdp) ON utilisateur TO authenticated;

-- LE SUIVI SUIT LE RDV : on lit le suivi des RDV qu'on peut lire. La
-- sous-requete passe par la RLS de `rdv` — le perimetre n'est donc ecrit
-- nulle part ici, il reste dans `perimetre_saisie` (interdit n.4).
CREATE POLICY rdv_suivi_lecture ON rdv_suivi FOR SELECT TO authenticated
  USING (rdv_suivi.rdv_id IN (SELECT r.id FROM relance.rdv r));

-- On ecrit le suivi des RDV qu'on peut SAISIR, et seulement tant que la
-- campagne est ouverte (D10 : le suivi se ferme avec la campagne).
CREATE POLICY rdv_suivi_creation ON rdv_suivi FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM relance.rdv r
     WHERE r.id = rdv_suivi.rdv_id
       AND relance.peut_saisir(r.vendeur_id, r.campagne_id)
       AND relance.campagne_ouverte(r.campagne_id)));
CREATE POLICY rdv_suivi_modification ON rdv_suivi FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM relance.rdv r
     WHERE r.id = rdv_suivi.rdv_id
       AND relance.peut_saisir(r.vendeur_id, r.campagne_id)
       AND relance.campagne_ouverte(r.campagne_id)))
  WITH CHECK (EXISTS (
    SELECT 1 FROM relance.rdv r
     WHERE r.id = rdv_suivi.rdv_id
       AND relance.peut_saisir(r.vendeur_id, r.campagne_id)
       AND relance.campagne_ouverte(r.campagne_id)));

-- L'effectif est public, comme les compteurs ; sa composition est un geste de
-- preparation, reserve aux paliers d'administration.
CREATE POLICY mobilisation_lecture ON mobilisation FOR SELECT TO authenticated
  USING ((SELECT relance.utilisateur_courant()) IS NOT NULL);
CREATE POLICY mobilisation_creation ON mobilisation FOR INSERT TO authenticated
  WITH CHECK ((SELECT relance.peut_administrer()));
CREATE POLICY mobilisation_modification ON mobilisation FOR UPDATE TO authenticated
  USING ((SELECT relance.peut_administrer()))
  WITH CHECK ((SELECT relance.peut_administrer()));

-- Le journal ne s'ecrit QUE par les fonctions ci-dessous : aucun droit d'ecriture.
CREATE POLICY journal_compte_lecture ON journal_compte FOR SELECT TO authenticated
  USING ((SELECT relance.peut_gerer_utilisateurs()));

-- ----------------------------------------------------------------------------
-- 4. LA SOURCE DANS TOUT CE QUI LIT LES RDV
-- ----------------------------------------------------------------------------
-- `rdv_agrege` gagne la colonne `source` A LA FIN (seule forme qu'admet
-- CREATE OR REPLACE VIEW). Toujours ni client ni commentaire.
--
-- LE FILTRE DE 20260831203000 EST REPRIS — c'est lui qui remplace la RLS que
-- cette vue contourne : un compte anonyme, desactive ou archive ne lit rien. Une
-- premiere ecriture de cette migration l'avait perdu ; `test:rls` l'a attrape
-- (« compte DESACTIVE ne lit AUCUN agregat » : 22, attendu 0).
--
-- Ecrit en sous-requete scalaire, evaluee UNE fois (InitPlan) et non par ligne :
-- meme valeur, la fonction etant STABLE et sans argument. C'est la convention
-- posee le 08/09 pour `perimetre_saisie`, et cette vue etait le dernier endroit
-- a appeler `utilisateur_courant()` a nu, sur chaque RDV du groupe.
CREATE OR REPLACE VIEW relance.rdv_agrege AS
SELECT r.id, r.campagne_id, r.vendeur_id, r.jour, r.creneau_code, r.marque_id,
       r.type_vehicule, r.cree_le, r.archive_le, r.source
FROM relance.rdv r
WHERE (SELECT relance.utilisateur_courant()) IS NOT NULL;

-- La diffusion porte la source : un poste qui applique le message en memoire
-- doit pouvoir ecarter un RDV de trafic naturel des classements du phoning.
CREATE OR REPLACE FUNCTION relance.diffuser_rdv()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = relance, public, pg_temp
AS $fn$
BEGIN
  PERFORM realtime.send(
    -- Ni `client` ni `commentaire`, structurellement : il n'y a pas de champ a
    -- oublier de retirer.
    jsonb_build_object(
      'id', NEW.id::text,
      'vendeurId', NEW.vendeur_id::text,
      'jour', NEW.jour,
      'creneauCode', NEW.creneau_code,
      'marqueId', NEW.marque_id::text,
      'typeVehicule', NEW.type_vehicule,
      'source', NEW.source,
      'archive', NEW.archive_le IS NOT NULL,
      'auteur', coalesce(NEW.modifie_par, NEW.cree_par)::text
    ),
    'rdv',
    'campagne-' || NEW.campagne_id::text,
    true
  );
  RETURN NULL;
END $fn$;
REVOKE ALL ON FUNCTION relance.diffuser_rdv() FROM PUBLIC, anon, authenticated;

-- `charger_saisie` et `charger_tableau` rendent la source de chaque RDV. Corps
-- identiques a 20261002204318, la colonne `source` en plus.
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
        'commentaire', r.commentaire, 'source', r.source) ORDER BY r.id)
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
    'mobilisations', coalesce((SELECT jsonb_agg(jsonb_build_object('vendeur_id', mo.vendeur_id,
          'mobilise', mo.mobilise, 'motif', mo.motif) ORDER BY mo.id)
        FROM relance.mobilisation mo WHERE mo.campagne_id = p_campagne_id), '[]'::jsonb),
    'rdvs', coalesce((SELECT jsonb_agg(jsonb_build_object('id', r.id, 'vendeur_id', r.vendeur_id,
          'type_vehicule', r.type_vehicule, 'marque_id', r.marque_id, 'jour', r.jour,
          'creneau_code', r.creneau_code, 'source', r.source) ORDER BY r.id)
        FROM relance.rdv_agrege r
       WHERE r.campagne_id = p_campagne_id AND r.archive_le IS NULL), '[]'::jsonb),
    'nb_rdvs', (SELECT count(*) FROM relance.rdv_agrege r
                 WHERE r.campagne_id = p_campagne_id AND r.archive_le IS NULL)
  );
$fn$;

-- ----------------------------------------------------------------------------
-- 5. LE SUIVI DES RDV
-- ----------------------------------------------------------------------------
-- La liste de travail : les RDV de MON perimetre (RLS de `rdv`), avec leur suivi.
-- Une fonction plutot que trois lectures : la rubrique s'ouvre souvent sur un
-- telephone, en showroom, sur un reseau moyen.
CREATE OR REPLACE FUNCTION relance.charger_suivi(p_campagne_id bigint)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = relance, public, pg_temp
AS $fn$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id', r.id, 'vendeur_id', r.vendeur_id, 'vendeur', v.nom,
      'site_id', s.id, 'site', s.libelle, 'site_code', s.code,
      'jour', r.jour, 'creneau_code', r.creneau_code, 'creneau', cr.libelle, 'creneau_ordre', cr.ordre,
      'marque_id', r.marque_id, 'marque', m.libelle,
      'type_vehicule', r.type_vehicule, 'client', r.client, 'source', r.source,
      'issue', su.issue, 'diac', coalesce(su.diac, false), 'stock', coalesce(su.stock, false),
      'cs', coalesce(su.cs, false), 'modele', su.modele, 'commentaire', su.commentaire,
      'maj_le', coalesce(su.modifie_le, su.cree_le))
      ORDER BY r.jour, cr.ordre, v.nom, r.id), '[]'::jsonb)
    FROM relance.rdv r
    JOIN relance.vendeur v ON v.id = r.vendeur_id
    LEFT JOIN relance.site s ON s.id = v.site_id
    LEFT JOIN relance.campagne_creneau cr ON cr.campagne_id = r.campagne_id AND cr.code = r.creneau_code
    LEFT JOIN relance.marque m ON m.id = r.marque_id
    LEFT JOIN relance.rdv_suivi su ON su.rdv_id = r.id
   WHERE r.campagne_id = p_campagne_id AND r.archive_le IS NULL;
$fn$;

-- Qualifier un RDV : creation au premier geste, mise a jour ensuite. SECURITY
-- INVOKER : les politiques de `rdv_suivi` decident, le CHECK des avantages aussi.
CREATE OR REPLACE FUNCTION relance.suivi_enregistrer(
  p_rdv_id bigint, p_issue text, p_diac boolean, p_stock boolean, p_cs boolean,
  p_modele text, p_commentaire text
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
  INSERT INTO relance.rdv_suivi (rdv_id, issue, diac, stock, cs, modele, commentaire)
  VALUES (p_rdv_id, p_issue, coalesce(p_diac, false), coalesce(p_stock, false), coalesce(p_cs, false),
          nullif(btrim(p_modele), ''), nullif(btrim(p_commentaire), ''))
  ON CONFLICT (rdv_id) DO UPDATE
     SET issue = EXCLUDED.issue, diac = EXCLUDED.diac, stock = EXCLUDED.stock, cs = EXCLUDED.cs,
         modele = EXCLUDED.modele, commentaire = EXCLUDED.commentaire;

  SELECT jsonb_build_object('rdv_id', su.rdv_id, 'issue', su.issue, 'diac', su.diac, 'stock', su.stock,
           'cs', su.cs, 'modele', su.modele, 'commentaire', su.commentaire,
           'maj_le', coalesce(su.modifie_le, su.cree_le))
    INTO resultat FROM relance.rdv_suivi su WHERE su.rdv_id = p_rdv_id;
  RETURN resultat;
END $fn$;

-- Un RDV de TRAFIC NATUREL (D5) : meme chemin que `rdv_poser` — memes politiques,
-- memes triggers, meme idempotence —, source `showroom`. Une fonction distincte et
-- non un parametre de plus : PostgREST choisit une fonction par ses noms
-- d'arguments, et deux surcharges proches le rendraient ambigu.
CREATE OR REPLACE FUNCTION relance.rdv_poser_showroom(
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
  INSERT INTO relance.rdv (campagne_id, vendeur_id, jour, creneau_code, marque_id, type_vehicule, client, cle_client, source)
  VALUES (p_campagne_id, p_vendeur_id, p_jour, p_creneau_code, p_marque_id, p_type_vehicule, p_client, p_cle, 'showroom')
  ON CONFLICT (cle_client) DO NOTHING;
  SELECT jsonb_build_object('id', r.id, 'vendeur_id', r.vendeur_id, 'jour', r.jour,
           'creneau_code', r.creneau_code, 'marque_id', r.marque_id, 'type_vehicule', r.type_vehicule,
           'client', r.client, 'source', r.source)
    INTO resultat FROM relance.rdv r WHERE r.cle_client = p_cle;
  IF resultat IS NULL THEN
    RAISE EXCEPTION 'RELANCE: ce rendez-vous ne peut pas etre enregistre sur votre perimetre.';
  END IF;
  RETURN resultat;
END $fn$;

-- ----------------------------------------------------------------------------
-- 6. LES COMPTES : journal et mot de passe a choisir (D14)
-- ----------------------------------------------------------------------------
-- Appelee par l'ecran Comptes APRES que l'Edge Function a remplace le mot de
-- passe. Elle ne remplace rien elle-meme : elle consigne, et oblige l'utilisateur
-- a choisir le sien a la connexion suivante. Reservee a la gestion des comptes.
CREATE OR REPLACE FUNCTION relance.compte_reinitialise(p_utilisateur_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = relance, public, pg_temp
AS $fn$
DECLARE
  moi bigint := relance.exiger_gestion_comptes();
BEGIN
  UPDATE relance.utilisateur SET doit_changer_mdp = true WHERE id = p_utilisateur_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'RELANCE: compte introuvable.';
  END IF;
  INSERT INTO relance.journal_compte (cree_par, cible_id, action) VALUES (moi, p_utilisateur_id, 'reinitialisation');
END $fn$;

-- Appelee par l'utilisateur lui-meme APRES `supabase.auth.updateUser` : il vient
-- de choisir son mot de passe. Ne touche que SON compte.
CREATE OR REPLACE FUNCTION relance.mot_de_passe_choisi()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = relance, public, pg_temp
AS $fn$
DECLARE
  moi bigint := relance.utilisateur_courant();
BEGIN
  IF moi IS NULL THEN
    RAISE EXCEPTION 'RELANCE: aucun compte actif.';
  END IF;
  UPDATE relance.utilisateur SET doit_changer_mdp = false WHERE id = moi;
  INSERT INTO relance.journal_compte (cree_par, cible_id, action) VALUES (moi, moi, 'changement_mot_de_passe');
END $fn$;

-- Desactiver / reactiver un compte se consigne tout seul, quel que soit le
-- chemin qui l'a fait.
CREATE OR REPLACE FUNCTION relance.journaliser_actif()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = relance, public, pg_temp
AS $fn$
BEGIN
  IF NEW.actif IS DISTINCT FROM OLD.actif THEN
    INSERT INTO relance.journal_compte (cree_par, cible_id, action)
    VALUES (relance.utilisateur_courant(), NEW.id, CASE WHEN NEW.actif THEN 'reactivation' ELSE 'desactivation' END);
  END IF;
  RETURN NULL;
END $fn$;

CREATE TRIGGER utilisateur_journal_actif AFTER UPDATE OF actif ON utilisateur
  FOR EACH ROW EXECUTE FUNCTION relance.journaliser_actif();
REVOKE ALL ON FUNCTION relance.journaliser_actif() FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION relance.charger_suivi(bigint) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION relance.suivi_enregistrer(bigint, text, boolean, boolean, boolean, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION relance.rdv_poser_showroom(bigint, bigint, date, text, bigint, text, text, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION relance.compte_reinitialise(bigint) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION relance.mot_de_passe_choisi() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION relance.charger_suivi(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION relance.suivi_enregistrer(bigint, text, boolean, boolean, boolean, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION relance.rdv_poser_showroom(bigint, bigint, date, text, bigint, text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION relance.compte_reinitialise(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION relance.mot_de_passe_choisi() TO authenticated;

-- ----------------------------------------------------------------------------
-- 7. LES DEUX PURGES CONNAISSENT LES NOUVELLES TABLES
-- ----------------------------------------------------------------------------
-- Sans cela, la cle etrangere de `rdv_suivi` / `mobilisation` / `journal_compte`
-- ferait echouer une purge legitime. Corps repris de 20260831210000, les
-- nouvelles tables en plus, DANS LA MEME PORTE (`purge_autorisee`, une transaction).
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

  IF archive IS NULL THEN
    RAISE EXCEPTION 'RELANCE: ce vendeur doit d''abord etre archive. La purge ne s''applique qu''a une fiche deja retiree.';
  END IF;
  IF p_confirmation IS DISTINCT FROM nom_exact THEN
    RAISE EXCEPTION 'RELANCE: pour purger definitivement, retaper le nom exact du vendeur. Attendu : « % ».', nom_exact;
  END IF;

  SELECT count(*)::int INTO nb_rdv FROM relance.rdv WHERE vendeur_id = p_vendeur_id;
  SELECT count(*)::int INTO nb_aff FROM relance.affectation WHERE vendeur_id = p_vendeur_id;

  PERFORM set_config('relance.purge_autorisee', 'oui', true);
  DELETE FROM relance.rdv_suivi WHERE rdv_id IN (SELECT id FROM relance.rdv WHERE vendeur_id = p_vendeur_id);
  DELETE FROM relance.rdv WHERE vendeur_id = p_vendeur_id;
  DELETE FROM relance.mobilisation WHERE vendeur_id = p_vendeur_id;
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

  IF EXISTS (SELECT 1 FROM relance.table_phoning WHERE chef_utilisateur_id = p_utilisateur_id) THEN
    attaches := attaches || 'des tables de phoning';
  END IF;
  IF EXISTS (SELECT 1 FROM relance.rdv WHERE cree_par = p_utilisateur_id OR modifie_par = p_utilisateur_id) THEN
    attaches := attaches || 'des RDV saisis';
  END IF;
  IF EXISTS (SELECT 1 FROM relance.rdv_suivi WHERE cree_par = p_utilisateur_id OR modifie_par = p_utilisateur_id) THEN
    attaches := attaches || 'des RDV suivis';
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

  PERFORM set_config('relance.purge_autorisee', 'oui', true);
  -- Le journal DONT CE COMPTE EST LA CIBLE part avec lui ; celui qu'il a ecrit
  -- sur d'autres reste (`cree_par` n'est pas une cle etrangere).
  DELETE FROM relance.journal_compte WHERE cible_id = p_utilisateur_id;
  DELETE FROM relance.encadrement_site WHERE utilisateur_id = p_utilisateur_id;
  DELETE FROM relance.role_global WHERE utilisateur_id = p_utilisateur_id;
  DELETE FROM relance.role_campagne WHERE utilisateur_id = p_utilisateur_id;
  DELETE FROM relance.utilisateur WHERE id = p_utilisateur_id;

  RETURN jsonb_build_object('supprime', nom_exact);
END $fn$;
