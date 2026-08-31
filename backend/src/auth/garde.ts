import type { Response, NextFunction } from 'express';
import type { AuthRequest } from './middleware';
import { chargerDroits, peutAdministrer, peutLire, type Droits } from './campagneScope';

// ============================================================================
// GARDES DE ROUTE.
//
// Toute route d'ecriture DOIT porter `exigerAdministration` ou un controle de perimetre
// explicite. Une route d'ecriture sans garde est une porte ouverte — c'etait le
// cas d'`/api/uploads` sur GEARBOX, et ca ne se voit pas a la relecture parce
// qu'une route sans garde ressemble exactement a une route publique voulue.
//
// `avecDroits` charge les droits UNE fois par requete et les depose sur `req`.
// Les droits sont relus en base a chaque appel, jamais lus dans le jeton : ils
// sont par campagne et changent pendant une campagne.
// ============================================================================

export interface RequeteAutorisee extends AuthRequest {
  droits?: Droits;
}

export const avecDroits = async (req: RequeteAutorisee, res: Response, next: NextFunction) => {
  const id = req.utilisateur?.id;
  if (!id) return res.status(401).json({ message: 'Authentification requise' });

  const droits = await chargerDroits(id);
  if (!peutLire(droits)) {
    // Compte desactive ou archive : un jeton encore valide emis avant la
    // desactivation ne doit rien ouvrir.
    return res.status(403).json({ message: 'Ce compte est desactive.' });
  }

  req.droits = droits;
  return next();
};

/// ADMINISTRATION DES REFERENTIELS, DES CAMPAGNES ET DES TABLES.
///
/// Renomme depuis `exigerAdmin` : la garde accepte desormais `admin` ET
/// `direction`, et un nom qui dit « admin » aurait laisse croire le contraire.
///
/// LA GESTION DES COMPTES N'EST PAS COUVERTE ICI : elle a sa propre garde dans
/// `routes/utilisateurs.ts`, reservee a `admin`. C'est la seule frontiere entre les
/// deux paliers hauts, et sans elle `direction` pourrait se promouvoir `admin`.
export const exigerAdministration = (req: RequeteAutorisee, res: Response, next: NextFunction) => {
  if (!req.droits) {
    // Erreur de montage : `avecDroits` doit toujours preceder `exigerAdministration`.
    // On refuse plutot que de laisser passer.
    return res.status(500).json({ message: 'Garde mal montee : droits non charges.' });
  }
  if (!peutAdministrer(req.droits)) {
    return res.status(403).json({ message: 'Reserve a un administrateur ou a la direction.' });
  }
  return next();
};
