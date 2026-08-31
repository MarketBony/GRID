-- ============================================================================
-- LE NOM DU CANAL NE PEUT PAS CONTENIR DE DEUX-POINTS.
--
-- CORRECTION D'UN DEFAUT INTRODUIT PAR LA MIGRATION PRECEDENTE, trouve en
-- eprouvant le temps reel dans le navigateur.
--
-- CE QUI A ETE OBSERVE. Le canal `campagne:2` ne s'abonne jamais : `subscribe()`
-- ne rend NI `SUBSCRIBED`, NI `CHANNEL_ERROR`, NI `TIMED_OUT`. Aucune erreur,
-- aucun refus — l'abonnement reste simplement en suspens. Un canal nomme
-- `essai-prive-<horodatage>`, teste cote a cote, passe `SUBSCRIBED` immediatement.
--
-- POURQUOI. Supabase Realtime utilise le deux-points pour son propre adressage :
-- un sujet utilisateur `x` devient `realtime:x` sur le fil. Un sujet qui en
-- contient deja un est mal decoupe, et la demande d'abonnement se perd.
--
-- Le nom venait de socket.io, ou `campagne:${id}` etait la convention des salles
-- et ne posait aucun probleme. Le transporter tel quel etait naturel, et c'est
-- exactement pour cela que ce genre de defaut passe : rien ne signale qu'une
-- convention a change de maison.
--
-- ET C'EST LE MODE D'ECHEC LE PLUS INSIDIEUX DE TOUT CE LOT : la saisie continue
-- de fonctionner parfaitement, seuls les compteurs des AUTRES cessent de bouger.
-- Personne ne le remarque en travaillant seul. Le critere de recette n.5 —
-- « deux onglets, le compteur monte » — existe precisement pour cela, et il faut
-- le jouer a deux navigateurs, pas le supposer.
--
-- Le tiret n'a aucune signification particuliere : `campagne-2` est un nom de
-- sujet ordinaire.
-- ============================================================================

SET search_path TO relance, public;

CREATE OR REPLACE FUNCTION relance.diffuser_rdv()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = relance, public, pg_temp
AS $fn$
BEGIN
  PERFORM realtime.send(
    -- LA CHARGE UTILE NE PORTE NI `client` NI `commentaire`. Meme regle que la vue
    -- `rdv_agrege`, et elle est structurelle : il n'y a pas de champ a oublier de
    -- retirer, il n'y en a jamais eu.
    jsonb_build_object(
      'id', NEW.id::text,
      'vendeurId', NEW.vendeur_id::text,
      'jour', NEW.jour,
      'creneauCode', NEW.creneau_code,
      'marqueId', NEW.marque_id::text,
      'typeVehicule', NEW.type_vehicule,
      'archive', NEW.archive_le IS NOT NULL,
      -- QUI A ECRIT — pour que l'auteur ignore son propre evenement. Il a deja
      -- applique le changement localement (F-C.4) ; le lui rejouer provoquerait un
      -- second rendu, et pendant une saisie au clavier ce scintillement se voit.
      'auteur', coalesce(NEW.modifie_par, NEW.cree_par)::text
    ),
    'rdv',
    'campagne-' || NEW.campagne_id::text,
    true
  );
  RETURN NULL;
END $fn$;
