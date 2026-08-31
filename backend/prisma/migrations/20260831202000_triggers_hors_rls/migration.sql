-- ============================================================================
-- LES GARDE-FOUS NE DOIVENT PAS DEPENDRE DE CE QUE L'APPELANT A LE DROIT DE VOIR.
--
-- CORRECTION NON DEMANDEE, consequence directe de l'activation de la RLS. Elle est
-- declaree ici parce qu'elle n'etait pas au plan.
--
-- CE QUI A ETE OBSERVE. `test:rls` a refuse une saisie faite par un compte
-- desactive avec ce message :
--
--     RELANCE: ce vendeur n'est pas autorise a vendre cette marque.
--
-- Le verdict est FAUX : le vendeur est parfaitement autorise a vendre cette
-- marque. Ce qui s'etait passe, c'est que `verifier_marque_autorisee()` s'execute
-- avec les droits de l'appelant (`security invoker`). Depuis que `vendeur_marque`
-- porte une politique RLS, un appelant sans identite n'y voit AUCUNE ligne — et le
-- trigger, ne trouvant pas l'autorisation, conclut qu'elle n'existe pas.
--
-- Le trigger ne verifiait plus un invariant de la BASE : il verifiait un invariant
-- DE CE QUE L'APPELANT VOIT. Ce sont deux choses differentes, et la seconde n'a
-- aucun interet.
--
-- POURQUOI C'EST GRAVE MEME SI RIEN N'EST OUVERT AUJOURD'HUI. Dans l'etat actuel,
-- toutes les tables lues par ces triggers sont en lecture ouverte a tout compte
-- authentifie : un utilisateur reel obtient donc le bon verdict, et le seul cas
-- divergent est celui d'une ecriture qui sera de toute facon refusee par la RLS.
-- Il n'y a donc ni faille ni regression fonctionnelle.
--
-- Mais le jour ou une lecture sera restreinte — et c'est exactement ce qu'on vient
-- de faire sur `rdv` — les triggers commenceront a rendre des verdicts faux SANS
-- QUE RIEN NE LE SIGNALE. Un invariant qui depend du point de vue de celui qui
-- ecrit n'est pas un invariant. Il vaut mieux fermer cette porte pendant qu'on la
-- voit.
--
-- CE QUE LA CORRECTION FAIT, ET CE QU'ELLE NE FAIT PAS. Les huit fonctions
-- passent en `security definer` : elles LISENT desormais hors RLS, comme le fait
-- deja `utilisateur_courant()`. Aucune d'elles n'ecrit quoi que ce soit — elles
-- font un `SELECT` puis, au pire, un `RAISE EXCEPTION`. Elever leurs droits de
-- lecture ne leur donne donc aucun pouvoir nouveau, et leur `search_path` etait
-- deja fige a la creation.
--
-- `interdire_suppression()` et les deux `tracer_*` ne sont pas touchees : la
-- premiere ne lit rien, les secondes ne consultent que `utilisateur_courant()`,
-- qui est deja `security definer`.
--
-- `ALTER FUNCTION` plutot que `CREATE OR REPLACE` : le corps des huit fonctions
-- n'est pas recopie ici. Recopier du code pour changer un attribut, c'est prendre
-- le risque de le recopier de travers, et faire diverger deux versions de la meme
-- regle — ce que ce projet evite partout ailleurs.
-- ============================================================================

SET search_path TO relance, public;

ALTER FUNCTION relance.verifier_affectation_marque_table() SECURITY DEFINER;
ALTER FUNCTION relance.verifier_affectation_meme_plaque() SECURITY DEFINER;
ALTER FUNCTION relance.verifier_affectation_unique() SECURITY DEFINER;
ALTER FUNCTION relance.verifier_campagne_ouverte() SECURITY DEFINER;
ALTER FUNCTION relance.verifier_encadrant_actif() SECURITY DEFINER;
ALTER FUNCTION relance.verifier_marque_autorisee() SECURITY DEFINER;
ALTER FUNCTION relance.verifier_marque_selon_metier() SECURITY DEFINER;
ALTER FUNCTION relance.verifier_type_coherent() SECURITY DEFINER;
