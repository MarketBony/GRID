-- ============================================================================
-- LES FONCTIONS DE TRIGGER N'ONT AUCUN APPELANT : PERSONNE NE DOIT POUVOIR LES
-- APPELER.
--
-- ---------------------------------------------------------------------------
-- CE QUI EST MESURE, ET CE QUI ETAIT ECRIT
-- ---------------------------------------------------------------------------
-- `ETAT-PROJET.md` annoncait « 10 alertes de l'analyseur Supabase sur
-- `diffuser_rdv()` et les 11 fonctions `verifier_*()` ». Les trois chiffres sont
-- faux, et de trois facons differentes — mesure du 03/09/2026, identique sur les
-- deux bases :
--
--     fonctions de trigger dans `relance`                        14
--     dont EXECUTE accorde a PUBLIC                              12
--     dont a la fois `security definer` ET PUBLIC (les alertes)    9
--     fonctions APPELABLES `security definer` exposees a PUBLIC    0
--
-- Il n'y a donc pas 11 fonctions `verifier_*()` exposees mais 8, et l'alerte
-- « Public Can Execute SECURITY DEFINER Function » en compte 9 avec
-- `diffuser_rdv()`, pas 10. Les trois du delta — `interdire_suppression()`,
-- `tracer_creation()`, `tracer_modification_rdv()` — sont bien exposees a PUBLIC
-- mais restent `security invoker` : l'analyseur ne les signale pas, ce qui ne les
-- rend pas plus legitimes.
--
-- La dixieme alerte n'existe pas dans l'etat present de la base. Elle a
-- probablement disparu avec les deux migrations du 01/09
-- (`affectation_vendeur_present` et `vendeur_dates_contre_rdv`), qui portaient
-- toutes deux leur propre `REVOKE` — ce sont exactement les deux seules fonctions
-- de trigger du schema qui n'etaient PAS exposees avant celle-ci.
--
-- ---------------------------------------------------------------------------
-- IL N'Y A AUCUN CHEMIN D'EXPLOITATION, ET CE N'EST PAS LA RAISON
-- ---------------------------------------------------------------------------
-- Les 14 sont `RETURNS trigger`. PostgreSQL refuse un appel direct
-- (« trigger functions can only be called as triggers », 0A000) et PostgREST ne
-- les expose meme pas au catalogue (`404 PGRST202`). Ce n'est donc pas une faille
-- qu'on ferme.
--
-- La raison est le BRUIT. Neuf alertes qui ne signifient rien noient celles qui
-- signifieraient quelque chose, et un tableau d'alertes qu'on a pris l'habitude
-- d'ignorer ne protege plus de rien. Le cout de les faire taire est nul ; le cout
-- de s'habituer a du rouge permanent, non.
--
-- ---------------------------------------------------------------------------
-- POURQUOI UNE BOUCLE SUR `pg_proc` ET NON UNE LISTE DE NOMS
-- ---------------------------------------------------------------------------
-- Une liste de 14 noms ecrite ici serait une liste de valeurs dupliquee, au sens
-- exact de l'interdit n.6 : elle serait juste aujourd'hui et fausse a la
-- quinzieme fonction de trigger, sans que rien ne le signale. C'est d'ailleurs ce
-- que fait `20260831210000_rpc_privilegies`, et c'est son seul defaut.
--
-- Le filtre est donc STRUCTUREL : `prorettype = 'trigger'::regtype` est la
-- definition meme de « fonction de trigger », pas une enumeration de celles qui
-- existent. Aucun nom n'est ecrit dans ce fichier.
--
-- ET CE FICHIER NE SUFFIT PAS. Une migration est un evenement, pas une regle :
-- elle couvre ce qui existe au moment ou elle passe, jamais la quinzieme fonction
-- ecrite demain. C'est pourquoi elle vient AVEC un controle permanent dans
-- `test:rls` — « aucune fonction de trigger de `relance` n'est executable par
-- PUBLIC » — joue sur les deux bases et en CI. Sans lui, cette migration serait
-- un coup de balai, pas un invariant.
--
-- ---------------------------------------------------------------------------
-- POURQUOI CA NE DESARME PAS LES TRIGGERS
-- ---------------------------------------------------------------------------
-- PostgreSQL verifie `EXECUTE` sur la fonction au moment du `CREATE TRIGGER`,
-- jamais au declenchement. Les 19 triggers existants continuent donc de se
-- declencher pour tout le monde, y compris `anon`.
--
-- Ce n'est pas une lecture de la documentation qu'on croit sur parole : c'est
-- `test:garde-fous` qui doit le prouver, sur les deux bases, avant que cette
-- migration soit crue. Ses 39 controles verifient chacun qu'un trigger REFUSE
-- quelque chose ; si un seul cessait de se declencher, il passerait au rouge.
-- Revoquer trop large est le seul vrai risque de ce fichier, et c'est ce controle
-- qui le mesure.
--
-- ---------------------------------------------------------------------------
-- POURQUOI AUSSI `anon` ET `authenticated`, ET NON SEULEMENT `PUBLIC`
-- ---------------------------------------------------------------------------
-- ELARGISSEMENT ASSUME PAR RAPPORT A LA DEMANDE, qui parlait de `PUBLIC` seul.
--
-- Aucun de ces deux roles ne porte de droit propre ici — leur `true` actuel est
-- herite de `PUBLIC`, verifie. Les nommer ne retire donc rien aujourd'hui. Mais
-- ne revoquer que `PUBLIC` laisserait passer un `GRANT ... TO authenticated`
-- pose par megarde plus tard : l'alerte de l'analyseur disparaitrait, la fonction
-- resterait appelable par tout compte connecte, et on aurait deplace le probleme
-- au lieu de le regler. Le controle de `test:rls` porte sur les trois roles pour
-- la meme raison.
-- ============================================================================

SET search_path TO relance, public;

DO $revoquer$
DECLARE
  f record;
  n integer := 0;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS signature
      FROM pg_proc p
      JOIN pg_namespace n2 ON n2.oid = p.pronamespace
     WHERE n2.nspname = 'relance'
       AND p.prorettype = 'trigger'::regtype
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f.signature);
    n := n + 1;
  END LOOP;

  -- ECHEC BRUYANT SI LA BOUCLE NE TROUVE RIEN. Une boucle vide est indiscernable
  -- d'une boucle qui a travaille : la migration passerait au vert en ne faisant
  -- rien, et c'est exactement le mode de defaillance que ce projet chasse
  -- ailleurs (« un garde-fou qui peut ne pas tourner doit dire qu'il n'a pas
  -- tourne »). Le schema porte 14 fonctions de trigger ; en avoir zero voudrait
  -- dire que `prorettype` ou le nom du schema a change sous nos pieds.
  IF n = 0 THEN
    RAISE EXCEPTION
      'RELANCE: aucune fonction de trigger trouvee dans le schema relance. '
      'Le filtre de cette migration ne decrit plus la base : ne pas la croire verte.';
  END IF;

  RAISE NOTICE 'RELANCE: EXECUTE revoque sur % fonctions de trigger.', n;
END $revoquer$;
