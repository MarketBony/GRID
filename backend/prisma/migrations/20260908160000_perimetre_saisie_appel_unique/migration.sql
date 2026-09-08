-- ============================================================================
-- `perimetre_saisie` : L'APPEL D'AUTORISATION EST EVALUE UNE FOIS, PLUS PAR LIGNE
--
-- Ecrit pendant l'incident du 08/09/2026, apres avoir retabli le service.
--
-- ---------------------------------------------------------------------------
-- LE DEFAUT
-- ---------------------------------------------------------------------------
-- La vue appelait `relance.utilisateur_courant()` SEPT fois et
-- `relance.peut_administrer()` une fois, DIRECTEMENT dans son `WHERE`, sur un
-- `CROSS JOIN campagne x vendeur`. PostgreSQL evalue alors la fonction POUR
-- CHAQUE LIGNE du produit — mesure dans le plan : `loops=96`, et
-- `relance.utilisateur_courant()` jusque dans un `Index Cond`.
--
-- Les deux fonctions sont pourtant `STABLE` : leur valeur ne change pas pendant
-- la requete. Mais elles portent `SET search_path` — un durcissement qu'on garde
-- — et une fonction SQL avec `SET` NE PEUT PAS ETRE INLINEE. Chaque evaluation
-- est donc un vrai appel de fonction, avec sauvegarde et restauration du GUC.
--
-- Cout mesure sur Supabase, serveur au repos, pour un perimetre de TROIS
-- vendeurs : 333 ms. Ce n'est pas un probleme de volume, c'est le nombre
-- d'appels. Et comme les politiques de lecture de `rdv` s'appuient sur cette
-- vue, ces 333 ms se payaient sur CHAQUE lecture de RDV — 538 ms pour 49 lignes.
--
-- ---------------------------------------------------------------------------
-- LE CORRECTIF, ET POURQUOI IL NE CHANGE AUCUN DROIT
-- ---------------------------------------------------------------------------
-- Chaque appel est enveloppe dans une sous-requete scalaire :
-- `(SELECT relance.utilisateur_courant())`. Le planificateur la sort de la
-- boucle et l'evalue UNE FOIS, en `InitPlan`.
--
-- C'EST DEJA LA CONVENTION DU PROJET : les quinze politiques `*_lecture`
-- ecrivent toutes `(SELECT relance.utilisateur_courant())`. La vue etait le seul
-- endroit qui appelait la fonction a nu — une exception, pas une invention.
--
-- La transformation ne peut pas changer le resultat : les deux fonctions sont
-- `STABLE` et SANS ARGUMENT, donc une sous-requete scalaire rend exactement la
-- meme valeur que l'appel direct. Aucune des quatre origines de droit n'est
-- touchee, aucune condition n'est ajoutee ni retiree. `test:rls` le demontre
-- dans les deux sens, sur les deux bases.
--
-- INTERDIT N.4 — cette vue est LA transcription des quatre origines de droit, et
-- il n'y a rien derriere elle. Le corps ci-dessous est donc recopie a
-- l'identique depuis `20260831201000_rls_portail`, commentaires compris : seuls
-- les appels de fonction sont enveloppes. Toute autre difference serait un bug.
-- ============================================================================

SET search_path TO relance, public;

CREATE OR REPLACE VIEW relance.perimetre_saisie AS
SELECT c.id AS campagne_id,
       v.id AS vendeur_id
FROM relance.campagne c
CROSS JOIN relance.vendeur v
WHERE (SELECT relance.utilisateur_courant()) IS NOT NULL
  AND v.archive_le IS NULL
  AND (v.date_entree IS NULL OR v.date_entree <= c.date_fin)
  AND (v.date_sortie IS NULL OR v.date_sortie >= c.date_debut)
  AND (
    -- `admin` ET `direction` : les deux paliers hauts ont un ACCES TOTAL, saisie
    -- comprise. La seule chose que `direction` ne peut pas faire, c'est gerer les
    -- comptes, et c'est une porte separee. Le script des comptes de test avait
    -- deja attrape l'erreur inverse : `direction.test` ressortait avec zero vendeur
    -- saisissable alors que la specification dit « acces total ».
    (SELECT relance.peut_administrer())

    -- 1. chef de plaque, pour cette campagne
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

    -- 2. chef de site pour cette campagne
    OR EXISTS (
      SELECT 1
      FROM relance.role_campagne rc
      WHERE rc.utilisateur_id = (SELECT relance.utilisateur_courant())
        AND rc.campagne_id = c.id
        AND rc.role = 'chef_site'
        AND rc.site_id = v.site_id
        AND rc.archive_le IS NULL
    )

    -- 3. encadrement DURABLE d'un site — hors campagne, volontairement
    OR EXISTS (
      SELECT 1
      FROM relance.encadrement_site es
      WHERE es.utilisateur_id = (SELECT relance.utilisateur_courant())
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
        AND t.chef_utilisateur_id = (SELECT relance.utilisateur_courant())
        AND sp.campagne_id = c.id
        AND sp.archive_le IS NULL
    )
  );
