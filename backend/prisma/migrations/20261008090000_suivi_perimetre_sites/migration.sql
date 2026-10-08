-- ============================================================================
-- LE SUIVI DES RDV NE MONTRE QUE LES VENDEURS DE MES SITES (08/10/2026).
--
-- Retour du terrain : pendant les portes ouvertes, le chef de table n'est pas sur
-- site avec les vendeurs de sa table — il ne fait pas leur suivi. Il doit voir,
-- dans le Suivi, les vendeurs de SES SITES et pas ceux de SA TABLE. La saisie, elle,
-- ne change pas : on y saisit toujours pour sa table.
--
-- LE PERIMETRE N'EST PAS RECOPIE (interdit n.4). Il est COUPE EN DEUX :
--   `perimetre_suivi`  — les origines par SITE : administration, chef de plaque,
--                        chef de site, encadrement de site ;
--   `perimetre_saisie` — `perimetre_suivi` PLUS l'origine par TABLE.
-- Chaque origine de droit est ecrite une fois. Les deux branches repetent les
-- conditions de PRESENCE du vendeur (archive, dates d'entree et de sortie) : ce
-- n'est pas une origine de droit, c'est la definition d'un vendeur present.
--
-- `perimetre_saisie` garde ses deux colonnes, dans le meme ordre : `peut_saisir`,
-- `charger_saisie` et les politiques qui la lisent ne bougent pas.
-- ============================================================================

SET search_path TO relance, public;

CREATE VIEW relance.perimetre_suivi AS
SELECT c.id AS campagne_id,
       v.id AS vendeur_id
FROM relance.campagne c
CROSS JOIN relance.vendeur v
WHERE (SELECT relance.utilisateur_courant()) IS NOT NULL
  AND v.archive_le IS NULL
  AND (v.date_entree IS NULL OR v.date_entree <= c.date_fin)
  AND (v.date_sortie IS NULL OR v.date_sortie >= c.date_debut)
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

REVOKE ALL ON relance.perimetre_suivi FROM PUBLIC, anon;
GRANT SELECT ON relance.perimetre_suivi TO authenticated;

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

-- ----------------------------------------------------------------------------
-- LE SUIVI LIT ET ECRIT SUR `perimetre_suivi`
-- ----------------------------------------------------------------------------
DROP POLICY rdv_suivi_lecture ON rdv_suivi;
DROP POLICY rdv_suivi_creation ON rdv_suivi;
DROP POLICY rdv_suivi_modification ON rdv_suivi;

CREATE POLICY rdv_suivi_lecture ON rdv_suivi FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM relance.rdv r
      JOIN relance.perimetre_suivi ps ON ps.vendeur_id = r.vendeur_id AND ps.campagne_id = r.campagne_id
     WHERE r.id = rdv_suivi.rdv_id));
CREATE POLICY rdv_suivi_creation ON rdv_suivi FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM relance.rdv r
      JOIN relance.perimetre_suivi ps ON ps.vendeur_id = r.vendeur_id AND ps.campagne_id = r.campagne_id
     WHERE r.id = rdv_suivi.rdv_id
       AND relance.campagne_ouverte(r.campagne_id)));
CREATE POLICY rdv_suivi_modification ON rdv_suivi FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM relance.rdv r
      JOIN relance.perimetre_suivi ps ON ps.vendeur_id = r.vendeur_id AND ps.campagne_id = r.campagne_id
     WHERE r.id = rdv_suivi.rdv_id
       AND relance.campagne_ouverte(r.campagne_id)))
  WITH CHECK (EXISTS (
    SELECT 1 FROM relance.rdv r
      JOIN relance.perimetre_suivi ps ON ps.vendeur_id = r.vendeur_id AND ps.campagne_id = r.campagne_id
     WHERE r.id = rdv_suivi.rdv_id
       AND relance.campagne_ouverte(r.campagne_id)));

-- La liste de travail : les RDV des vendeurs de MES SITES. Corps identique a
-- 20261005114344, le filtre `perimetre_suivi` en plus.
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
   WHERE r.campagne_id = p_campagne_id AND r.archive_le IS NULL
     AND r.vendeur_id IN (SELECT ps.vendeur_id FROM relance.perimetre_suivi ps WHERE ps.campagne_id = p_campagne_id);
$fn$;
