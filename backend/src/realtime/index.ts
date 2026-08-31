import { AsyncLocalStorage } from 'node:async_hooks';
import type { Request, Response, NextFunction } from 'express';
import type { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../auth/secret';
import type { JwtPayloadRelance } from '../auth/middleware';

// ============================================================================
// TEMPS REEL — F-C.10 et critere de recette n.5.
//
// << Deux chefs de table qui saisissent en meme temps ne se bloquent pas et
// voient les compteurs de l'autre se mettre a jour >>.
//
// Meme mecanique que le chat de GEARBOX, `withEmitterContext` inclus : l'auteur
// d'une action ne doit PAS recevoir son propre evenement en retour. Il a deja
// applique le changement localement (ecriture immediate, F-C.4) ; le lui renvoyer
// provoque un second rendu, et pendant une saisie au clavier ce scintillement se
// voit. Le front envoie donc son `x-socket-id` avec chaque requete, et on exclut
// ce socket de la diffusion.
//
// CLOISONNEMENT : chaque socket rejoint une salle par campagne. Un chef de table
// de CENTRE ne recoit pas le trafic de SUD-OUEST. Ce n'est pas une mesure de
// confidentialite — les compteurs sont publics — mais un evenement diffuse a
// tout le monde pendant une campagne a 99 vendeurs est du bruit inutile.
//
// Les evenements ne transportent JAMAIS le nom du client : ils portent de quoi
// invalider un compteur (campagne, vendeur, jour, creneau), et le destinataire
// relit par l'API, qui applique la redaction de `campagneScope.ts`. Diffuser la
// charge utile complete contournerait le portail.
// ============================================================================

interface ContexteEmetteur {
  socketId: string | null;
}

const stockage = new AsyncLocalStorage<ContexteEmetteur>();

/// A monter AVANT les routes. Memorise le `x-socket-id` de l'appelant pour la
/// duree de la requete, afin que `emettre` puisse exclure son propre socket.
export const withEmitterContext = (req: Request, _res: Response, next: NextFunction) => {
  const entete = req.headers['x-socket-id'];
  const socketId = typeof entete === 'string' && entete.length > 0 ? entete : null;
  stockage.run({ socketId }, () => next());
};

let serveur: Server | null = null;

export const setupRealtime = (io: Server) => {
  serveur = io;

  // Authentification a la connexion. Un socket non authentifie est refuse : il
  // n'y a aucune raison d'accepter un abonnement anonyme aux evenements de
  // saisie, meme s'ils ne portent pas de donnee personnelle.
  io.use((socket, next) => {
    const jeton = socket.handshake.auth?.jeton;
    if (typeof jeton !== 'string') return next(new Error('Authentification requise'));
    try {
      const charge = jwt.verify(jeton, JWT_SECRET) as JwtPayloadRelance;
      socket.data.utilisateurId = String(charge.id);
      return next();
    } catch {
      return next(new Error('Jeton invalide ou expire'));
    }
  });

  io.on('connection', (socket: Socket) => {
    // Le front annonce la campagne qu'il regarde. Changer de campagne quitte la
    // salle precedente : sinon un utilisateur accumule les abonnements au fil de
    // sa navigation et recoit du trafic qu'il n'affiche plus.
    socket.on('campagne:suivre', (campagneId: unknown) => {
      if (typeof campagneId !== 'string') return;
      for (const salle of socket.rooms) {
        if (salle.startsWith('campagne:')) socket.leave(salle);
      }
      socket.join(`campagne:${campagneId}`);
    });
  });
};

/// Diffuse un evenement aux autres clients de la campagne.
/// `campagneId` est obligatoire : un evenement sans campagne partirait a tout le
/// monde, ce qui n'arrive jamais dans ce produit.
export const emettre = (campagneId: string, evenement: string, charge: unknown) => {
  if (!serveur) return;
  const socketEmetteur = stockage.getStore()?.socketId ?? null;
  const cible = serveur.to(`campagne:${campagneId}`);
  if (socketEmetteur) {
    cible.except(socketEmetteur).emit(evenement, charge);
  } else {
    cible.emit(evenement, charge);
  }
};
