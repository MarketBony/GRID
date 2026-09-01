-- ============================================================================
-- ON NE PEUT PAS DECLARER ABSENT QUELQU'UN DONT LES RDV PROUVENT LA PRESENCE.
--
-- CE QUI A ETE OBSERVE, le 01/09/2026. Deux vendeurs se sont vu poser une
-- `date_entree` EGALE a leur `date_sortie` — 31/07 et 31/08 — alors qu'ils
-- avaient 13 et 16 RDV dans la campagne de JUIN.
--
-- Le tableau de bord de juin est alors passe de 1107 a 1078 RDV. Sans erreur,
-- sans avertissement, et sans que rien ne relie la cause a l'effet : on saisit
-- deux dates sur un ecran, et le total d'une campagne CLOSE change de 29 RDV.
--
-- C'est exactement le defaut du classeur que ce produit remplace : un chiffre
-- plausible et faux. Il est meme pire ici, parce que la donnee brute reste juste
-- — les 1107 RDV sont toujours en base — et que seule la LECTURE ment.
--
-- ---------------------------------------------------------------------------
-- POURQUOI CE N'EST PAS UN BUG D'AFFICHAGE
-- ---------------------------------------------------------------------------
-- La regle « un vendeur ne compte que dans les campagnes ou il etait la » est
-- juste, et elle est partout : `perimetre_saisie`, `presenceVendeur.ts`,
-- l'effectif du tableau de bord. Ce sont LES DATES qui etaient fausses.
--
-- La bonne reponse n'est donc pas d'assouplir la regle, c'est d'empecher qu'on
-- puisse la mettre en contradiction avec des faits deja enregistres.
--
-- ---------------------------------------------------------------------------
-- CE QU'IL REFUSE, ET CE QU'IL LAISSE PASSER
-- ---------------------------------------------------------------------------
-- REFUSE : poser des dates qui excluent le vendeur d'une campagne ou il a des
--          RDV non archives. Le message NOMME la campagne et le nombre de RDV,
--          parce que « date invalide » n'apprend rien a qui la corrige.
--
-- LAISSE PASSER : tout le reste. Un vendeur sans RDV peut recevoir n'importe
--          quelles dates ; c'est le cas normal d'une arrivee ou d'un depart.
--          Et ARCHIVER un vendeur reste possible : c'est l'archivage qui retire
--          quelqu'un de la liste, pas une date antidatee.
--
-- Pour corriger un cas legitime — un RDV attribue par erreur a quelqu'un qui
-- n'etait pas la — il faut d'abord archiver le RDV. C'est le bon ordre : la
-- correction porte sur le fait, pas sur la date qui le rend invisible.
-- ============================================================================

SET search_path TO relance, public;

CREATE OR REPLACE FUNCTION relance.verifier_vendeur_dates_contre_rdv()
RETURNS trigger
LANGUAGE plpgsql
-- SECURITY DEFINER, comme les autres `verifier_*` : sous RLS, un trigger
-- `invoker` ne verrait que les RDV visibles a l'appelant et rendrait un verdict
-- faux — il laisserait passer des dates qui contredisent des RDV qu'il ne voit
-- pas.
SECURITY DEFINER
SET search_path = relance, public, pg_temp
AS $fn$
DECLARE
  conflit record;
BEGIN
  -- Rien a verifier si les deux dates sont inchangees. Un vendeur se modifie
  -- souvent (nom, marques, site) et cette requete n'a pas a tourner pour rien.
  IF TG_OP = 'UPDATE'
     AND NEW.date_entree IS NOT DISTINCT FROM OLD.date_entree
     AND NEW.date_sortie IS NOT DISTINCT FROM OLD.date_sortie THEN
    RETURN NEW;
  END IF;

  IF NEW.date_entree IS NULL AND NEW.date_sortie IS NULL THEN
    RETURN NEW; -- present depuis toujours et pour toujours : rien ne peut clocher
  END IF;

  SELECT c.libelle, c.date_debut, c.date_fin, count(*) AS n
    INTO conflit
    FROM relance.rdv r
    JOIN relance.campagne c ON c.id = r.campagne_id
   WHERE r.vendeur_id = NEW.id
     AND r.archive_le IS NULL
     AND (
       (NEW.date_entree IS NOT NULL AND NEW.date_entree > c.date_fin)
       OR (NEW.date_sortie IS NOT NULL AND NEW.date_sortie < c.date_debut)
     )
   GROUP BY c.id, c.libelle, c.date_debut, c.date_fin
   ORDER BY c.date_debut
   LIMIT 1;

  IF conflit IS NOT NULL THEN
    RAISE EXCEPTION
      'RELANCE: % a % RDV sur « % » (% au %). Ces dates l''en excluraient, et ses RDV disparaitraient des totaux. Archiver ces RDV d''abord si c''est bien voulu.',
      NEW.nom, conflit.n, conflit.libelle,
      to_char(conflit.date_debut, 'DD/MM/YYYY'), to_char(conflit.date_fin, 'DD/MM/YYYY');
  END IF;

  RETURN NEW;
END
$fn$;

DROP TRIGGER IF EXISTS vendeur_dates_contre_rdv ON relance.vendeur;
CREATE TRIGGER vendeur_dates_contre_rdv
  BEFORE INSERT OR UPDATE ON relance.vendeur
  FOR EACH ROW EXECUTE FUNCTION relance.verifier_vendeur_dates_contre_rdv();

REVOKE EXECUTE ON FUNCTION relance.verifier_vendeur_dates_contre_rdv() FROM PUBLIC;
