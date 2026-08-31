import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../db';
import { authentifier } from '../auth/middleware';
import { avecDroits, type RequeteAutorisee } from '../auth/garde';
import { peutGererUtilisateurs } from '../auth/campagneScope';
import { ROLES_GLOBAUX, estRoleEncadrementValide, estRoleGlobalValide } from '../auth/roles';
import { messageTrigger } from '../utils/messageTrigger';

const router = Router();

// ============================================================================
// GESTION DES COMPTES ET DE L'ENCADREMENT — reserve a `admin`.
//
// `admin` SEUL, jamais `direction`. C'est toute la difference entre les deux
// paliers hauts, et sa raison d'etre : sans cette frontiere, `direction` pourrait
// se promouvoir `admin`. C'est le scenario que GEARBOX a du fermer en interdisant
// a Director d'attribuer Director.
//
// CE QUE CES ROUTES SERVENT, dans les mots de l'utilisateur : « je pourrais leur
// creer des comptes, et en supprimer a ma guise via cette interface. Et une fois
// qu'ils sont dans la becane, ils seront disponibles a l'affiliation de site dans
// l'onglet vendeurs, et de table dans l'onglet table. »
//
// LES QUATRE PALIERS :
//   `admin`      — tout, y compris cet ecran.
//   `direction`  — tout sauf cet ecran.
//   `lecteur`    — lecture seule.
//   aucun role   — un ENCADRANT : il lit tout, et ne saisit que pour les vendeurs
//                  de ses sites et de ses tables.
//
// UN MOT DE PASSE NE SORT JAMAIS D'ICI EN CLAIR sauf a sa creation ou a sa
// reinitialisation, une seule fois, dans la reponse. Il n'est pas journalise, et
// seul son hachage bcrypt est stocke — rien ne permet de le retrouver ensuite.
// ============================================================================

const gardeGestion = (req: RequeteAutorisee, res: import('express').Response, next: () => void) => {
  if (!req.droits) {
    return res.status(500).json({ message: 'Garde mal montee : droits non charges.' });
  }
  if (!peutGererUtilisateurs(req.droits)) {
    return res.status(403).json({
      message:
        'La gestion des comptes est reservee aux administrateurs. Un compte Direction a tous ' +
        'les autres acces.',
    });
  }
  return next();
};

/// Mot de passe genere quand l'administrateur n'en impose pas. Assez long pour
/// n'etre pas devinable, assez court pour etre dicte au telephone.
const motDePasseGenere = () => randomBytes(9).toString('base64url');

const SELECT_COMPTE = {
  id: true,
  loginId: true,
  nom: true,
  actif: true,
  creeLe: true,
  archiveLe: true,
  rolesGlobaux: { select: { role: true } },
  sitesEncadres: {
    where: { archiveLe: null },
    select: {
      id: true,
      role: true,
      site: { select: { id: true, code: true, libelle: true } },
    },
  },
  tablesAnimees: {
    where: { archiveLe: null },
    select: {
      id: true,
      libelle: true,
      sessionPlaque: {
        select: {
          plaque: { select: { libelle: true } },
          campagne: { select: { libelle: true, cloturee: true } },
        },
      },
    },
  },
  vendeur: { select: { id: true, nom: true } },
} as const;

type CompteCharge = Prisma.UtilisateurGetPayload<{ select: typeof SELECT_COMPTE }>;

const projeter = (u: CompteCharge) => ({
  id: u.id.toString(),
  loginId: u.loginId,
  nom: u.nom,
  actif: u.actif,
  archiveLe: u.archiveLe,
  creeLe: u.creeLe,
  /// `admin`, `direction`, `lecteur`. Vide = ENCADRANT : ses droits viennent de
  /// ses rattachements, pas d'un role.
  rolesGlobaux: u.rolesGlobaux.map((r) => r.role),
  sitesEncadres: u.sitesEncadres.map((e) => ({
    id: e.id.toString(),
    role: e.role,
    siteId: e.site.id.toString(),
    siteCode: e.site.code,
    siteLibelle: e.site.libelle,
  })),
  tablesAnimees: u.tablesAnimees.map((t) => ({
    id: t.id.toString(),
    libelle: t.libelle,
    plaqueLibelle: t.sessionPlaque.plaque.libelle,
    campagneLibelle: t.sessionPlaque.campagne.libelle,
    campagneCloturee: t.sessionPlaque.campagne.cloturee,
  })),
  /// Renseigne si ce compte est AUSSI un vendeur. Un chef de vente qui vend
  /// existe des deux cotes, relie — pas comme un drapeau sur une ligne.
  vendeur: u.vendeur ? { id: u.vendeur.id.toString(), nom: u.vendeur.nom } : null,
});

// ---------------------------------------------------------------- lecture

/// GET /api/utilisateurs
router.get('/', authentifier, avecDroits, gardeGestion, async (_req, res) => {
  const comptes = await prisma.utilisateur.findMany({
    orderBy: [{ actif: 'desc' }, { nom: 'asc' }],
    select: SELECT_COMPTE,
  });
  return res.json({ comptes: comptes.map(projeter), rolesGlobaux: ROLES_GLOBAUX });
});

// ---------------------------------------------------------------- creation

/// POST /api/utilisateurs
///
/// `roleGlobal` a `null` cree un ENCADRANT : aucun role, des droits qui viendront
/// de ses rattachements. C'est le cas majoritaire.
router.post('/', authentifier, avecDroits, gardeGestion, async (req: RequeteAutorisee, res) => {
  const nom = String(req.body?.nom ?? '').trim();
  const loginIdBrut = String(req.body?.loginId ?? '').trim().toLowerCase();
  const roleGlobal = req.body?.roleGlobal ?? null;
  const motDePasseImpose = req.body?.motDePasse;

  if (nom === '') return res.status(400).json({ message: 'Le nom est requis.' });

  // L'identifiant sert a se connecter : on refuse tout ce qui se tape de deux
  // facons — espaces, majuscules, accents. Un `loginId` ambigu produit des
  // « mot de passe incorrect » incomprehensibles.
  if (!/^[a-z0-9._-]{3,32}$/.test(loginIdBrut)) {
    return res.status(400).json({
      message:
        'Identifiant invalide : 3 a 32 caracteres, minuscules, chiffres, point, tiret ou ' +
        'soulignement. Pas d’espace ni d’accent — il sert a se connecter.',
    });
  }

  if (roleGlobal !== null && !estRoleGlobalValide(roleGlobal)) {
    return res.status(400).json({
      message: `roleGlobal invalide : ${ROLES_GLOBAUX.join(', ')}, ou null pour un encadrant.`,
    });
  }

  if (motDePasseImpose !== undefined && String(motDePasseImpose).length < 8) {
    return res.status(400).json({ message: 'Le mot de passe doit faire au moins 8 caracteres.' });
  }

  const existant = await prisma.utilisateur.findUnique({
    where: { loginId: loginIdBrut },
    select: { id: true, actif: true, archiveLe: true, nom: true },
  });
  if (existant) {
    return res.status(409).json({
      message:
        `L’identifiant « ${loginIdBrut} » est deja pris par ${existant.nom}` +
        (existant.actif ? '.' : ' (compte desactive — le reactiver plutot que d’en creer un autre).'),
    });
  }

  const enClair = motDePasseImpose ? String(motDePasseImpose) : motDePasseGenere();
  const compte = await prisma.utilisateur.create({
    data: {
      loginId: loginIdBrut,
      nom,
      passwordHash: await bcrypt.hash(enClair, 10),
      actif: true,
      creePar: BigInt(req.droits!.utilisateurId),
      ...(roleGlobal === null
        ? {}
        : { rolesGlobaux: { create: { role: roleGlobal, creePar: BigInt(req.droits!.utilisateurId) } } }),
    },
    select: SELECT_COMPTE,
  });

  return res.status(201).json({
    compte: projeter(compte),
    /// LA SEULE FOIS où le mot de passe sort en clair. Il n'est pas journalise, et
    /// seul son hachage est stocke : personne ne pourra le relire ensuite.
    motDePasse: enClair,
    genere: !motDePasseImpose,
  });
});

// ---------------------------------------------------------------- modification

/// PATCH /api/utilisateurs/:id — nom, role global, activation.
router.patch('/:id', authentifier, avecDroits, gardeGestion, async (req: RequeteAutorisee, res) => {
  const id = BigInt(req.params.id);
  const compte = await prisma.utilisateur.findUnique({
    where: { id },
    select: { id: true, nom: true, rolesGlobaux: { select: { role: true } } },
  });
  if (!compte) return res.status(404).json({ message: 'Compte introuvable.' });

  const moi = BigInt(req.droits!.utilisateurId);
  const { nom, roleGlobal, actif } = req.body ?? {};

  // UN ADMINISTRATEUR NE SE RETIRE PAS SES PROPRES DROITS. Sans ce garde-fou, il
  // suffit d'un clic pour se verrouiller dehors, et il n'y a alors plus personne
  // pour rouvrir.
  if (compte.id === moi) {
    const estAdmin = compte.rolesGlobaux.some((r) => r.role === 'admin');
    if (estAdmin && roleGlobal !== undefined && roleGlobal !== 'admin') {
      return res.status(409).json({
        message:
          'Vous ne pouvez pas retirer votre propre role d’administrateur : personne ne pourrait ' +
          'plus le rendre. Demander a un autre administrateur.',
      });
    }
    if (actif === false) {
      return res.status(409).json({ message: 'Vous ne pouvez pas desactiver votre propre compte.' });
    }
  }

  const donnees: Prisma.UtilisateurUpdateInput = {};
  if (nom !== undefined) {
    const propre = String(nom).trim();
    if (propre === '') return res.status(400).json({ message: 'Nom invalide.' });
    donnees.nom = propre;
  }
  if (actif !== undefined) {
    if (typeof actif !== 'boolean') {
      return res.status(400).json({ message: 'actif doit etre booleen.' });
    }
    donnees.actif = actif;
    donnees.archiveLe = actif ? null : new Date();
  }

  if (roleGlobal !== undefined && roleGlobal !== null && !estRoleGlobalValide(roleGlobal)) {
    return res.status(400).json({
      message: `roleGlobal invalide : ${ROLES_GLOBAUX.join(', ')}, ou null pour un encadrant.`,
    });
  }

  // LE DERNIER ADMINISTRATEUR NE PEUT PAS ETRE DEGRADE NI DESACTIVE. Une
  // application sans administrateur est une application qu'on ne peut plus
  // administrer, et aucun ecran ne permet d'en recreer un.
  const perdSonAdmin =
    compte.rolesGlobaux.some((r) => r.role === 'admin') &&
    ((roleGlobal !== undefined && roleGlobal !== 'admin') || actif === false);
  if (perdSonAdmin) {
    const autresAdmins = await prisma.utilisateur.count({
      where: {
        id: { not: id },
        actif: true,
        archiveLe: null,
        rolesGlobaux: { some: { role: 'admin' } },
      },
    });
    if (autresAdmins === 0) {
      return res.status(409).json({
        message:
          'C’est le dernier administrateur actif : le degrader rendrait l’application ' +
          'inadministrable. Nommer un autre administrateur d’abord.',
      });
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
      if (Object.keys(donnees).length > 0) {
        await tx.utilisateur.update({ where: { id }, data: donnees });
      }
      if (roleGlobal !== undefined) {
        // Un seul role global par compte : les paliers sont exclusifs, pas
        // cumulatifs. On remplace donc au lieu d'ajouter.
        await tx.roleGlobal.deleteMany({ where: { utilisateurId: id } });
        if (roleGlobal !== null) {
          await tx.roleGlobal.create({
            data: { utilisateurId: id, role: roleGlobal, creePar: moi },
          });
        }
      }
      // Desactiver un compte le retire de tout encadrement : un encadrant
      // fantome dans un selecteur est pire qu'une case vide. Le trigger
      // `encadrement_site_compte_actif` refuserait de toute facon.
      if (actif === false) {
        await tx.encadrementSite.updateMany({
          where: { utilisateurId: id, archiveLe: null },
          data: { archiveLe: new Date() },
        });
      }
    });
  } catch (e) {
    const conflit = messageTrigger(e);
    if (conflit) return res.status(409).json({ message: conflit });
    throw e;
  }

  const apres = await prisma.utilisateur.findUniqueOrThrow({ where: { id }, select: SELECT_COMPTE });
  return res.json(projeter(apres));
});

/// POST /api/utilisateurs/:id/mot-de-passe — reinitialisation.
router.post(
  '/:id/mot-de-passe',
  authentifier,
  avecDroits,
  gardeGestion,
  async (req: RequeteAutorisee, res) => {
    const id = BigInt(req.params.id);
    const compte = await prisma.utilisateur.findUnique({ where: { id }, select: { nom: true } });
    if (!compte) return res.status(404).json({ message: 'Compte introuvable.' });

    const impose = req.body?.motDePasse;
    if (impose !== undefined && String(impose).length < 8) {
      return res.status(400).json({ message: 'Le mot de passe doit faire au moins 8 caracteres.' });
    }
    const enClair = impose ? String(impose) : motDePasseGenere();

    await prisma.utilisateur.update({
      where: { id },
      data: { passwordHash: await bcrypt.hash(enClair, 10) },
    });

    return res.json({ nom: compte.nom, motDePasse: enClair, genere: !impose });
  }
);

/// DELETE /api/utilisateurs/:id — LA PURGE d'un compte.
///
/// Meme doctrine que pour un vendeur : on ne purge que ce qui ne porte AUCUN
/// historique. Un compte qui a anime une table explique la composition d'une
/// campagne passee ; le detruire rendrait cette composition anonyme.
router.delete('/:id', authentifier, avecDroits, gardeGestion, async (req: RequeteAutorisee, res) => {
  const id = BigInt(req.params.id);
  if (id === BigInt(req.droits!.utilisateurId)) {
    return res.status(409).json({ message: 'Vous ne pouvez pas supprimer votre propre compte.' });
  }

  const compte = await prisma.utilisateur.findUnique({
    where: { id },
    select: {
      nom: true,
      actif: true,
      _count: { select: { tablesAnimees: true, sitesEncadres: true, rolesCampagne: true } },
      vendeur: { select: { nom: true } },
    },
  });
  if (!compte) return res.status(404).json({ message: 'Compte introuvable.' });

  if (compte.actif) {
    return res.status(409).json({
      message:
        'Desactiver le compte d’abord. Deux gestes, deux occasions de se raviser avant une ' +
        'suppression definitive.',
    });
  }

  const attaches: string[] = [];
  if (compte._count.tablesAnimees > 0) {
    attaches.push(`${compte._count.tablesAnimees} table(s) animee(s)`);
  }
  if (compte._count.rolesCampagne > 0) {
    attaches.push(`${compte._count.rolesCampagne} role(s) de campagne`);
  }
  if (compte.vendeur) attaches.push(`le vendeur ${compte.vendeur.nom}`);

  if (attaches.length > 0) {
    return res.status(409).json({
      message:
        `${compte.nom} ne peut pas etre supprime : son compte explique encore ` +
        `${attaches.join(', ')}. Le laisser desactive conserve cette trace sans lui donner ` +
        'aucun acces.',
      attaches,
    });
  }

  const confirmation = String(req.body?.confirmation ?? '');
  if (confirmation !== compte.nom) {
    return res.status(400).json({
      message: `Pour supprimer definitivement, renvoyer le nom exact dans « confirmation ». Attendu : « ${compte.nom} ».`,
      attendu: compte.nom,
    });
  }

  await prisma.$transaction(async (tx) => {
    // LA PORTE DE PURGE, ouverte pour cette seule transaction. Voir la migration
    // `20260831140000`.
    await tx.$executeRawUnsafe(`SET LOCAL relance.purge_autorisee = 'oui'`);
    await tx.encadrementSite.deleteMany({ where: { utilisateurId: id } });
    await tx.roleGlobal.deleteMany({ where: { utilisateurId: id } });
    await tx.utilisateur.delete({ where: { id } });
  });

  return res.json({ supprime: compte.nom });
});

// ---------------------------------------------------------------- encadrement

/// PUT /api/utilisateurs/encadrement — rattacher, ou detacher, un encadrant.
///
/// `utilisateurId` a `null` LIBERE le role sur ce site. Un seul titulaire par
/// (site, role) : l'unique en base le garantit, et cette route remplace au lieu
/// d'empiler.
router.put(
  '/encadrement',
  authentifier,
  avecDroits,
  gardeGestion,
  async (req: RequeteAutorisee, res) => {
    const siteId = String(req.body?.siteId ?? '');
    const role = req.body?.role;
    const utilisateurId = req.body?.utilisateurId ?? null;

    if (siteId === '') return res.status(400).json({ message: 'siteId est requis.' });
    if (!estRoleEncadrementValide(role)) {
      return res.status(400).json({
        message: 'role invalide : chef_de_site, chef_de_vente_vn ou chef_de_vente_vo.',
      });
    }

    const site = await prisma.site.findUnique({
      where: { id: BigInt(siteId) },
      select: { id: true, libelle: true, archiveLe: true },
    });
    if (!site || site.archiveLe) {
      return res.status(400).json({ message: 'Site introuvable ou archive.' });
    }

    const maintenant = new Date();
    const moi = BigInt(req.droits!.utilisateurId);

    try {
      await prisma.$transaction(async (tx) => {
        if (utilisateurId === null) {
          await tx.encadrementSite.updateMany({
            where: { siteId: site.id, role, archiveLe: null },
            data: { archiveLe: maintenant },
          });
          return;
        }

        const compte = await tx.utilisateur.findUnique({
          where: { id: BigInt(String(utilisateurId)) },
          select: { id: true, actif: true, archiveLe: true },
        });
        if (!compte || !compte.actif || compte.archiveLe) {
          throw new Error('RELANCE: ce compte est introuvable ou desactive.');
        }

        // On libere le role AVANT de le donner : l'unique `(site, role)` refuse
        // deux titulaires, et l'ordre inverse echouerait. Meme piege que sur
        // l'ecran des encadrants, ou deux requetes lancees en parallele se
        // marchaient dessus.
        await tx.encadrementSite.updateMany({
          where: { siteId: site.id, role, archiveLe: null, utilisateurId: { not: compte.id } },
          data: { archiveLe: maintenant },
        });

        // Reactivation plutot que recreation : la ligne porte son historique.
        await tx.encadrementSite.upsert({
          where: { siteId_role: { siteId: site.id, role } },
          update: { utilisateurId: compte.id, archiveLe: null },
          create: { siteId: site.id, role, utilisateurId: compte.id, creePar: moi },
        });
      });
    } catch (e) {
      const conflit = messageTrigger(e);
      if (conflit) return res.status(409).json({ message: conflit });
      throw e;
    }

    const apres = await prisma.encadrementSite.findMany({
      where: { siteId: site.id, archiveLe: null },
      select: {
        id: true,
        role: true,
        utilisateur: { select: { id: true, nom: true, loginId: true } },
      },
    });

    return res.json({
      siteId: site.id.toString(),
      encadrement: apres.map((e) => ({
        id: e.id.toString(),
        role: e.role,
        utilisateurId: e.utilisateur.id.toString(),
        nom: e.utilisateur.nom,
        loginId: e.utilisateur.loginId,
      })),
    });
  }
);

export default router;
