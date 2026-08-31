import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from './secret';

/// Contenu du jeton. DELIBEREMENT MINIMAL : il ne porte QUE l'identite.
///
/// Divergence assumee avec GEARBOX, qui embarque `role` dans le jeton. Ici les
/// droits sont portes PAR CAMPAGNE et peuvent changer pendant une campagne — un
/// chef de plaque qui reaffecte une table modifie les droits d'un chef de table
/// en cours de session. Un role grave dans le jeton serait perime exactement au
/// moment ou il compte, et il faudrait attendre 12 h ou forcer une reconnexion.
///
/// Les droits sont donc TOUJOURS relus en base, par `campagneScope.ts`.
export interface JwtPayloadRelance {
  id: string; // BigInt serialise en chaine — voir utils/json.ts
  loginId: string;
}

export interface AuthRequest extends Request {
  utilisateur?: JwtPayloadRelance;
}

export const authentifier = (req: AuthRequest, res: Response, next: NextFunction) => {
  const entete = req.headers['authorization'];
  const jeton = entete && entete.startsWith('Bearer ') ? entete.slice(7) : null;

  if (!jeton) return res.status(401).json({ message: 'Authentification requise' });

  try {
    const charge = jwt.verify(jeton, JWT_SECRET) as JwtPayloadRelance;
    req.utilisateur = { id: String(charge.id), loginId: charge.loginId };
    return next();
  } catch {
    return res.status(401).json({ message: 'Jeton invalide ou expire' });
  }
};

export const signerJeton = (charge: JwtPayloadRelance, expiresIn: string) =>
  jwt.sign(charge, JWT_SECRET, { expiresIn } as jwt.SignOptions);
