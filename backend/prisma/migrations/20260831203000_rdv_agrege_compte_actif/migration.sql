-- ============================================================================
-- `rdv_agrege` NE DOIT RIEN RENDRE A UN COMPTE DESACTIVE OU ARCHIVE.
--
-- DEFAUT TROUVE PAR L'ECRITURE DE `test:rls`, et corrige ici. Il n'etait pas au
-- plan : c'est la migration precedente qui l'a introduit.
--
-- CE QUI A ETE OBSERVE, sur un compte `actif = false` :
--
--     relance.vendeur      ->  0 ligne    (correct, la RLS s'applique)
--     relance.rdv_agrege   -> 22 lignes   (FAUX)
--
-- POURQUOI. `rdv_agrege` est une vue SANS `security_invoker` : elle lit `rdv` avec
-- les droits de son proprietaire, donc HORS RLS. C'est exactement ce qu'on lui
-- demande — le tableau de bord doit compter les RDV de tout le monde pour produire
-- les classements, alors que la table `rdv` reste fermee au perimetre de saisie.
--
-- Mais ce contournement est total : il vaut aussi pour ceux qui ne devraient plus
-- rien voir. Une vue qui contourne la RLS DOIT porter elle-meme le filtre que la
-- RLS aurait applique. `perimetre_saisie` le faisait deja
-- (`utilisateur_courant() IS NOT NULL`) ; `rdv_agrege` l'avait perdu.
--
-- CE QUE CELA AURAIT COUTE EN PRODUCTION. Desactiver un compte est le geste qu'on
-- fait quand quelqu'un quitte le groupe. Son jeton Supabase reste valide — la
-- desactivation est portee par `utilisateur.actif`, pas par Supabase Auth — donc
-- son role reste `authenticated`. Il aurait continue de lire l'integralite des
-- compteurs de toutes les plaques, indefiniment, sans qu'aucun ecran ne le montre.
-- C'est precisement la regle que `campagneScope.ts` enoncait : « un compte qui
-- n'est plus actif ne doit pas pouvoir consulter les classements ».
--
-- LECON A RETENIR POUR LA SUITE : toute vue ajoutee dans `relance` qui n'active
-- pas `security_invoker` doit porter `WHERE relance.utilisateur_courant() IS NOT
-- NULL`. Deux controles de `test:rls` le verifient desormais, un par vue.
-- ============================================================================

SET search_path TO relance, public;

CREATE OR REPLACE VIEW relance.rdv_agrege AS
SELECT r.id,
       r.campagne_id,
       r.vendeur_id,
       r.jour,
       r.creneau_code,
       r.marque_id,
       r.type_vehicule,
       r.cree_le,
       r.archive_le
FROM relance.rdv r
-- LE FILTRE QUE LA RLS AURAIT APPLIQUE. `utilisateur_courant()` rend NULL pour un
-- appelant anonyme, un compte desactive ou un compte archive : les trois cas sont
-- traites d'un coup, et de la meme facon que partout ailleurs.
WHERE relance.utilisateur_courant() IS NOT NULL;
