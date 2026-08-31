import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../db';
import { signerJeton, authentifier, AuthRequest } from '../auth/middleware';
import { JWT_EXPIRES_IN } from '../auth/secret';
import { chargerDroits, type Droits } from '../auth/campagneScope';
import { utilisateurPublic } from '../utils/publicUser';

const router = Router();

// ============================================================================
// PAS DE ROUTE DE SEED, PAS DE ROUTE DE CREATION DE COMPTE PUBLIQUE.
//
// GEARBOX porte un `/api/seed` desactive a dessein, avec la consigne de ne
// jamais le rappeler en production parce qu'il reinitialise les mots de passe.
// Ici le seed est un script CLI (`npm run seed`) : il n'existe aucune surface
// HTTP pour le declencher, donc aucune consigne a respecter. Les comptes sont
// crees par un `admin` via `/api/utilisateurs`.
// ============================================================================

/// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { loginId, motDePasse } = req.body ?? {};

  if (typeof loginId !== 'string' || typeof motDePasse !== 'string') {
    return res.status(400).json({ message: 'Identifiant et mot de passe requis.' });
  }

  const utilisateur = await prisma.utilisateur.findUnique({ where: { loginId } });

  // Message identique dans les deux cas — compte inconnu ou mot de passe faux —
  // pour ne pas transformer la page de connexion en annuaire des comptes valides.
  // Et le hachage est compare MEME si le compte est introuvable, avec un
  // hachage factice, pour que la duree de reponse ne trahisse pas l'existence
  // du compte.
  const hachage = utilisateur?.passwordHash ?? '$2b$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinv';
  const motDePasseValide = await bcrypt.compare(motDePasse, hachage);

  if (!utilisateur || !motDePasseValide) {
    return res.status(401).json({ message: 'Identifiant ou mot de passe incorrect.' });
  }

  if (!utilisateur.actif || utilisateur.archiveLe) {
    return res.status(403).json({ message: 'Ce compte est desactive.' });
  }

  const jeton = signerJeton(
    { id: utilisateur.id.toString(), loginId: utilisateur.loginId },
    JWT_EXPIRES_IN
  );

  const droits = await chargerDroits(utilisateur.id.toString());

  return res.json({
    jeton,
    utilisateur: utilisateurPublic(utilisateur),
    droits: resumerDroits(droits),
  });
});

/// GET /api/auth/moi — l'etat courant des droits, relu en base.
/// Le front l'appelle au demarrage et apres toute action susceptible de changer
/// un perimetre (recomposition de table, cloture de campagne).
router.get('/moi', authentifier, async (req: AuthRequest, res) => {
  const id = req.utilisateur!.id;

  const utilisateur = await prisma.utilisateur.findUnique({ where: { id: BigInt(id) } });
  if (!utilisateur || !utilisateur.actif || utilisateur.archiveLe) {
    return res.status(403).json({ message: 'Ce compte est desactive.' });
  }

  const droits = await chargerDroits(id);
  return res.json({ utilisateur: utilisateurPublic(utilisateur), droits: resumerDroits(droits) });
});

// ---------------------------------------------------------------------------
// Resume des droits envoye au front.
//
// SERT UNIQUEMENT A L'AFFICHAGE : quelles rubriques montrer, quels vendeurs
// lister. Il ne fait autorite sur RIEN. Chaque route revalide le perimetre par
// `campagneScope.ts`, parce que cacher un bouton n'est pas une securite
// (interdit n.5 de CLAUDE.md) et qu'un client peut appeler l'API directement.
// ---------------------------------------------------------------------------
const resumerDroits = (droits: Droits) => ({
  admin: droits.admin,
  /// Tout SAUF la gestion des comptes. `administre` est ce que l'ecran doit
  /// regarder pour proposer les ecrans d'administration ; `admin` ne sert plus
  /// qu'a la gestion des comptes.
  direction: droits.direction,
  administre: droits.admin || droits.direction,
  gereUtilisateurs: droits.admin,
  lecteur: droits.lecteur,
  /// Sites encadres, toutes campagnes confondues.
  sitesEncadres: [...droits.sitesEncadres],
  plaquesParCampagne: Object.fromEntries(
    [...droits.plaquesParCampagne].map(([c, s]) => [c, [...s]])
  ),
  sitesParCampagne: Object.fromEntries([...droits.sitesParCampagne].map(([c, s]) => [c, [...s]])),
  tablesParCampagne: Object.fromEntries([...droits.tablesParCampagne].map(([c, s]) => [c, [...s]])),
});

export default router;
