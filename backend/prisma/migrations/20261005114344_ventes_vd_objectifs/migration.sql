-- ============================================================================
-- LE TABLEAU DES VENTES (05/10/2026) — se rapprocher du tableau VPP / VD / VO de
-- l equipe. Decisions de l utilisateur :
--   - une VENTE = un RDV qualifie commande dans le Suivi, phoning ET trafic
--     naturel, comptee au jour du RDV ; DIAC = la case DIAC de la commande ;
--   - VPP = VN ; VD = vehicule de demonstration, un STOCK : la case VD n existe
--     que sur une commande STOCK d un RDV VN ;
--   - vs A-1 = contre une autre campagne GRID, choisie a l ecran ;
--   - objectifs VPP par campagne x site x marque ;
--   - chiffres GLOBAUX, lisibles par tout compte actif.
-- ============================================================================

-- AlterTable
ALTER TABLE "rdv_suivi" ADD COLUMN     "vd" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "objectif_vente" (
    "id" BIGSERIAL NOT NULL,
    "campagne_id" BIGINT NOT NULL,
    "site_id" BIGINT NOT NULL,
    "marque_id" BIGINT NOT NULL,
    "ventes" INTEGER,
    "cree_le" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cree_par" BIGINT,
    "modifie_le" TIMESTAMPTZ(6),

    CONSTRAINT "objectif_vente_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "objectif_vente_campagne_id_site_id_marque_id_key" ON "objectif_vente"("campagne_id", "site_id", "marque_id");

-- AddForeignKey
ALTER TABLE "objectif_vente" ADD CONSTRAINT "objectif_vente_campagne_id_fkey" FOREIGN KEY ("campagne_id") REFERENCES "campagne"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "objectif_vente" ADD CONSTRAINT "objectif_vente_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "objectif_vente" ADD CONSTRAINT "objectif_vente_marque_id_fkey" FOREIGN KEY ("marque_id") REFERENCES "marque"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

SET search_path TO relance, public;

-- ----------------------------------------------------------------------------
-- 1. VD : un stock d'un genre particulier
-- ----------------------------------------------------------------------------
ALTER TABLE rdv_suivi ADD CONSTRAINT rdv_suivi_vd_check CHECK (NOT vd OR stock);

-- ----------------------------------------------------------------------------
-- 2. LES OBJECTIFS — aucun DELETE, tracabilite, RLS ecrite avec l'activation
-- ----------------------------------------------------------------------------
ALTER TABLE objectif_vente ADD CONSTRAINT objectif_vente_ventes_check CHECK (ventes IS NULL OR ventes >= 0);

CREATE TRIGGER objectif_vente_pas_de_delete BEFORE DELETE ON objectif_vente
  FOR EACH STATEMENT EXECUTE FUNCTION interdire_suppression();
CREATE TRIGGER objectif_vente_tracabilite BEFORE INSERT ON objectif_vente
  FOR EACH ROW EXECUTE FUNCTION relance.tracer_creation();
-- Corps generique malgre son nom : horodate, et ne laisse pas reecrire la creation.
CREATE TRIGGER objectif_vente_horodatage BEFORE UPDATE ON objectif_vente
  FOR EACH ROW EXECUTE FUNCTION relance.horodater_mobilisation();

ALTER TABLE objectif_vente ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON objectif_vente TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE objectif_vente_id_seq TO authenticated;
CREATE POLICY objectif_vente_lecture ON objectif_vente FOR SELECT TO authenticated
  USING ((SELECT relance.utilisateur_courant()) IS NOT NULL);
CREATE POLICY objectif_vente_creation ON objectif_vente FOR INSERT TO authenticated
  WITH CHECK ((SELECT relance.peut_administrer()));
CREATE POLICY objectif_vente_modification ON objectif_vente FOR UPDATE TO authenticated
  USING ((SELECT relance.peut_administrer()))
  WITH CHECK ((SELECT relance.peut_administrer()));

-- ----------------------------------------------------------------------------
-- 3. LA VUE DES VENTES — chiffres globaux, sans personne dedans
-- ----------------------------------------------------------------------------
-- Meme statut que `rdv_agrege` : vue du proprietaire, donc HORS RLS, et c'est
-- voulu — l'utilisateur veut des chiffres GLOBAUX pour tous les comptes. Elle ne
-- porte ni client, ni commentaire, ni modele, ni vendeur : rien a oublier de
-- retirer. Son propre filtre ferme la porte a un compte inactif ou anonyme.
-- Aucun total n'y est calcule (interdit n.2) : une ligne par commande, les
-- tableaux se font dans `utils/ventes.ts`.
CREATE VIEW relance.vente AS
SELECT r.id AS rdv_id, r.campagne_id, v.site_id, r.marque_id, r.jour,
       r.type_vehicule, r.source, su.diac, su.stock, su.cs, su.vd
FROM relance.rdv r
JOIN relance.rdv_suivi su ON su.rdv_id = r.id AND su.issue = 'commande'
JOIN relance.vendeur v ON v.id = r.vendeur_id
WHERE r.archive_le IS NULL
  AND (SELECT relance.utilisateur_courant()) IS NOT NULL;

REVOKE ALL ON relance.vente FROM PUBLIC, anon;
GRANT SELECT ON relance.vente TO authenticated;

-- ----------------------------------------------------------------------------
-- 4. LE SUIVI PORTE VD — charger_suivi le rend, suivi_enregistrer l'ecrit
-- ----------------------------------------------------------------------------
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
      'cs', coalesce(su.cs, false), 'vd', coalesce(su.vd, false), 'modele', su.modele,
      'commentaire', su.commentaire, 'maj_le', coalesce(su.modifie_le, su.cree_le))
      ORDER BY r.jour, cr.ordre, v.nom, r.id), '[]'::jsonb)
    FROM relance.rdv r
    JOIN relance.vendeur v ON v.id = r.vendeur_id
    LEFT JOIN relance.site s ON s.id = v.site_id
    LEFT JOIN relance.campagne_creneau cr ON cr.campagne_id = r.campagne_id AND cr.code = r.creneau_code
    LEFT JOIN relance.marque m ON m.id = r.marque_id
    LEFT JOIN relance.rdv_suivi su ON su.rdv_id = r.id
   WHERE r.campagne_id = p_campagne_id AND r.archive_le IS NULL;
$fn$;

-- Nouveau parametre EN DERNIER, avec defaut : les appels a sept arguments restent
-- valides. L'ancienne signature est retiree, sans quoi PostgREST verrait deux
-- surcharges.
DROP FUNCTION relance.suivi_enregistrer(bigint, text, boolean, boolean, boolean, text, text);
CREATE FUNCTION relance.suivi_enregistrer(
  p_rdv_id bigint, p_issue text, p_diac boolean, p_stock boolean, p_cs boolean,
  p_modele text, p_commentaire text, p_vd boolean DEFAULT false
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
  IF coalesce(p_vd, false) AND NOT EXISTS (
    SELECT 1 FROM relance.rdv r WHERE r.id = p_rdv_id AND r.type_vehicule = 'VN'
  ) THEN
    RAISE EXCEPTION 'RELANCE: un vehicule de demonstration ne se vend que sur un RDV VN.';
  END IF;

  INSERT INTO relance.rdv_suivi (rdv_id, issue, diac, stock, cs, vd, modele, commentaire)
  VALUES (p_rdv_id, p_issue, coalesce(p_diac, false), coalesce(p_stock, false), coalesce(p_cs, false),
          coalesce(p_vd, false), nullif(btrim(p_modele), ''), nullif(btrim(p_commentaire), ''))
  ON CONFLICT (rdv_id) DO UPDATE
     SET issue = EXCLUDED.issue, diac = EXCLUDED.diac, stock = EXCLUDED.stock, cs = EXCLUDED.cs,
         vd = EXCLUDED.vd, modele = EXCLUDED.modele, commentaire = EXCLUDED.commentaire;

  SELECT jsonb_build_object('rdv_id', su.rdv_id, 'issue', su.issue, 'diac', su.diac, 'stock', su.stock,
           'cs', su.cs, 'vd', su.vd, 'modele', su.modele, 'commentaire', su.commentaire,
           'maj_le', coalesce(su.modifie_le, su.cree_le))
    INTO resultat FROM relance.rdv_suivi su WHERE su.rdv_id = p_rdv_id;
  RETURN resultat;
END $fn$;

REVOKE ALL ON FUNCTION relance.suivi_enregistrer(bigint, text, boolean, boolean, boolean, text, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION relance.suivi_enregistrer(bigint, text, boolean, boolean, boolean, text, text, boolean) TO authenticated;
