import { useEffect, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';
import { definirSocketId, lireJeton } from '../services/api';

// ============================================================================
// TEMPS REEL — F-C.10 et critere de recette n.5.
//
// « Deux chefs de table qui saisissent en meme temps ne se bloquent pas et voient
// les compteurs de l'autre se mettre a jour. »
//
// L'identifiant du socket est communique a `services/api.ts`, qui le joint a
// chaque requete dans l'en-tete `x-socket-id`. Le serveur exclut ce socket de la
// diffusion : l'auteur d'une saisie ne recoit pas son propre evenement. Il a deja
// applique le changement localement, et le lui renvoyer provoquerait un second
// rendu — un scintillement visible pendant une saisie au clavier.
// ============================================================================

type Gestionnaire = (charge: unknown) => void;

export function useTempsReel(
  campagneId: string | null,
  gestionnaires: Record<string, Gestionnaire>
) {
  // Les gestionnaires changent a chaque rendu ; on les garde dans une ref pour ne
  // pas reconnecter le socket a chaque fois.
  const ref = useRef(gestionnaires);
  ref.current = gestionnaires;

  useEffect(() => {
    if (!campagneId) return;
    const jeton = lireJeton();
    if (!jeton) return;

    // ORDRE DES TRANSPORTS : polling d'abord, puis montee en WebSocket. C'est
    // l'ordre PAR DEFAUT de socket.io, et le retenir est un correctif.
    //
    // Une premiere version demandait `['websocket', 'polling']` — le WebSocket
    // d'abord, pour economiser le tour de polling. Constate dans un navigateur qui
    // bloque `ws://` : trois echecs de connexion dans la console, AUCUN repli, et
    // le temps reel muet. Le critere de recette n.5 tombait sans qu'aucune erreur
    // n'apparaisse a l'ecran.
    //
    // Le probleme n'est pas propre au bac a sable : un proxy d'entreprise refuse
    // souvent l'upgrade WebSocket, et l'outil tournera derriere Caddy sur le
    // reseau du groupe. Le polling se connecte TOUJOURS, puis socket.io monte en
    // WebSocket de lui-meme quand il le peut. Un demarrage un peu plus lent vaut
    // mieux qu'un temps reel qui ne demarre pas.
    const socket: Socket = io({ auth: { jeton } });

    socket.on('connect', () => {
      definirSocketId(socket.id ?? null);
      socket.emit('campagne:suivre', campagneId);
    });

    socket.on('disconnect', () => definirSocketId(null));

    // Un echec de connexion doit se VOIR quelque part. Il ne remonte pas a
    // l'ecran — le temps reel est un confort, la saisie fonctionne sans lui — mais
    // le silence complet a deja masque une panne.
    socket.on('connect_error', (e) =>
      console.warn('[temps reel] connexion impossible, la saisie reste fonctionnelle :', e.message)
    );

    // Un seul point d'ecoute par evenement, qui delegue a la ref : ajouter un
    // gestionnaire ne recree pas la connexion.
    for (const evenement of Object.keys(ref.current)) {
      socket.on(evenement, (charge: unknown) => ref.current[evenement]?.(charge));
    }

    return () => {
      definirSocketId(null);
      socket.close();
    };
    // `gestionnaires` est volontairement absent des dependances : voir la ref.
  }, [campagneId]);
}
