import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { messageTrigger } from '../utils/messageTrigger';

/// Middleware d'erreur, a monter APRES toutes les routes.
/// `express-async-errors` (importe dans index.ts) fait remonter ici les rejets
/// des handlers asynchrones : sans lui, une promesse rejetee laisse la requete
/// pendante jusqu'au timeout, sans trace.
export const errorHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  // Les triggers de la base levent des exceptions porteuses de sens metier
  // (R-B.4 unicite d'affectation, R-C.1 marque autorisee, R-C.3 campagne
  // cloturee). Prisma les remonte en P2010 pour du SQL brut, ou dans le message
  // pour une operation typee. On veut que le message ARRIVE A L'ECRAN : un
  // << erreur serveur >> generique obligerait le chef de table a deviner.
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    // Violation de contrainte d'unicite.
    if (err.code === 'P2002') {
      return res.status(409).json({ message: 'Cette valeur existe deja.', code: err.code });
    }
    // Violation de cle etrangere — typiquement un jour ou un creneau qui
    // n'appartient pas a la campagne (garde-fou R-A.2).
    if (err.code === 'P2003') {
      return res.status(409).json({
        message:
          "Ce jour ou ce creneau n'appartient pas a la campagne. " +
          'Modifier les jours ou creneaux d\'une campagne portant des RDV passe par l\'ecran de campagne.',
        code: err.code,
      });
    }
    if (err.code === 'P2025') {
      return res.status(404).json({ message: 'Enregistrement introuvable.', code: err.code });
    }
  }

  // Exception levee par un trigger PostgreSQL via `raise exception`. Le
  // decoupage du message vit dans `utils/messageTrigger.ts` : c'est la SOURCE
  // UNIQUE, et elle porte l'explication du format renvoye par Prisma.
  //
  // On veut que ce message ARRIVE A L'ECRAN : un << erreur serveur >> generique
  // obligerait le chef de table a deviner.
  const metier = messageTrigger(err);
  if (metier !== null) {
    return res.status(422).json({ message: metier });
  }

  console.error('[erreur non geree]', err);
  return res.status(500).json({ message: 'Erreur serveur.' });
};
