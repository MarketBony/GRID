-- ============================================================================
-- « NO SHOW » — une issue de suivi distincte de « annule » (retour du terrain,
-- 05/10/2026). Un RDV annule est decommande ; un no show est un client qui ne
-- vient pas sans prevenir. Les confondre fausse le seul chiffre qui interesse
-- l'equipe sur ce point : combien de RDV pris ne se presentent pas.
--
-- Liste comparee a `ISSUES_SUIVI` (`backend/src/auth/roles.ts`) par
-- `test:invariants` (interdit n.6). `rdv_suivi_avantages_check` n'a pas a
-- changer : il n'autorise DIAC / STOCK / CS que sur une commande.
-- ============================================================================

SET search_path TO relance, public;

ALTER TABLE rdv_suivi DROP CONSTRAINT rdv_suivi_issue_check;
ALTER TABLE rdv_suivi ADD CONSTRAINT rdv_suivi_issue_check
  CHECK (issue IS NULL OR issue IN ('commande', 'offre_en_cours', 'annule', 'no_show', 'clos_sans_suite'));
