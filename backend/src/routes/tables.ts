import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../db';
import { authentifier } from '../auth/middleware';
import { avecDroits, type RequeteAutorisee } from '../auth/garde';
import { campagneOuverte, peutAdministrerSession } from '../auth/campagneScope';
import { presenceVendeur } from '../utils/presenceVendeur';
import { ecartCible, repartir, type TableCible, type VendeurAPlacer } from '../utils/repartition';
import { emettre } from '../realtime';
import { messageTrigger } from '../utils/messageTrigger';
import type { TypeVehicule } from '../auth/roles';

const router = Router();

// ============================================================================
// MODULE B — CONSTRUCTEUR DE TABLES.
//
// AUTORISATION : `peutAdministrerSession` du portail, et rien d'autre. Aucune
// route ici ne recopie une clause de perimetre (interdit n.4). La session porte
// sa campagne et sa plaque, donc l'identifiant de session suffit — le faire
// suivre aussi dans l'URL creerait deux sources qui peuvent se contredire.
//
// AUCUNE SUPPRESSION (interdit n.1). F-B.1 dit << supprimer une table >> : ce sera
// ARCHIVER. Une table supprimee emporterait la composition d'une campagne passee,
// donc l'explication des totaux de cette campagne.
//
// LES TABLES SONT UN SUPPLEMENT, PAS LE MODE NORMAL. Deux plaques sur quatre
// n'avaient aucune table en juin 2026, et le perimetre par defaut est le SITE.
// F-B.8 : un vendeur non affecte reste saisissable par son chef de site — c'est
// deja acquis par `vendeursSaisissables`, qui reunit table ET site.
//
// TOUT LE CALCUL DE REPARTITION VIT DANS `utils/repartition.ts`, en fonction pure
// verifiee par `npm run test:repartition`. Ici on ne fait que charger, appeler,
// ecrire.
// ============================================================================

/// Charge la session et verifie le droit. Rend `null` apres avoir repondu.
async function sessionAutorisee(req: RequeteAutorisee, res: import('express').Response, sessionId: string) {
  const session = await prisma.sessionPlaque.findUnique({
    where: { id: BigInt(sessionId) },
    select: {
      id: true,
      mode: true,
      effectifCibleTable: true,
      archiveLe: true,
      campagneId: true,
      plaqueId: true,
      plaque: { select: { libelle: true } },
      campagne: { select: { libelle: true, dateDebut: true, dateFin: true, cloturee: true } },
    },
  });
  if (!session || session.archiveLe) {
    res.status(404).json({ message: 'Session introuvable.' });
    return null;
  }
  if (!(await peutAdministrerSession(req.droits!, sessionId))) {
    res.status(403).json({ message: 'Vous n’administrez pas cette plaque pour cette campagne.' });
    return null;
  }
  return session;
}

/// Remonte la session depuis une table — les routes qui portent un `tableId` ne
/// peuvent pas verifier le droit autrement.
async function sessionDeLaTable(tableId: string) {
  const t = await prisma.tablePhoning.findUnique({
    where: { id: BigInt(tableId) },
    select: { id: true, libelle: true, archiveLe: true, sessionPlaqueId: true },
  });
  return t;
}

/// Refus d'ecriture sur une campagne cloturee (R-C.3). Recomposer les tables
/// d'une campagne cloturee reecrirait l'explication de ses totaux.
async function refuserSiCloturee(res: import('express').Response, campagneId: bigint) {
  if (await campagneOuverte(campagneId.toString())) return false;
  res.status(409).json({
    message: 'Cette campagne est cloturee : sa composition de tables est figee.',
  });
  return true;
}

// Le decoupage du message d'un trigger vit dans `utils/messageTrigger.ts`, source
// unique. Une version locale existait ici et coupait au premier saut de ligne, ce
// qui laissait `severity: "ERREUR", detail: None` a la fin du message affiche.
// ---------------------------------------------------------------- lecture

/// GET /api/tables/session/:sessionId
///
/// Tout ce que l'ecran demande en un appel : les tables avec leurs membres, la
/// RESERVE des vendeurs non affectes, l'ecart a l'effectif cible, et les chefs
/// possibles.
router.get('/session/:sessionId', authentifier, avecDroits, async (req: RequeteAutorisee, res) => {
  const session = await sessionAutorisee(req, res, req.params.sessionId);
  if (!session) return;

  const [tables, vendeurs, utilisateurs, marques] = await Promise.all([
    prisma.tablePhoning.findMany({
      where: { sessionPlaqueId: session.id, archiveLe: null },
      orderBy: { ordre: 'asc' },
      select: {
        id: true,
        libelle: true,
        ordre: true,
        chefUtilisateurId: true,
        chef: { select: { nom: true } },
        marqueId: true,
        marque: { select: { libelle: true } },
        affectations: {
          where: { archiveLe: null },
          select: { vendeurId: true, origine: true },
        },
      },
    }),
    // Les vendeurs de LA PLAQUE, presents pendant la campagne. Jointure sur
    // `site.plaque_id` : ne jamais deriver la plaque autrement.
    prisma.vendeur.findMany({
      where: { site: { plaqueId: session.plaqueId }, AND: [presenceVendeur(session.campagne)] },
      orderBy: { nom: 'asc' },
      select: {
        id: true,
        nom: true,
        typeVehicule: true,
        site: { select: { id: true, code: true, libelle: true } },
        marques: { select: { marqueId: true } },
        utilisateurId: true,
      },
    }),
    // CHEFS DE TABLE POSSIBLES — TOUS les comptes actifs, sauf les lecteurs.
    //
    // « Tous sites confondus » est le point essentiel, pas un relachement :
    // l'exercice consiste a composer des groupes HETEROGENES, avec un chef de
    // vente venu d'une AUTRE concession pour coacher. Restreindre la liste aux
    // encadrants de la plaque rendrait l'exercice inexprimable.
    //
    // Le filtre a d'abord exige un rattachement de site OU un role global. C'etait
    // trop etroit et ca cassait la sequence decrite pour l'ecran Comptes : creer un
    // compte, puis l'attribuer comme chef de table. Un compte neuf n'apparaissait
    // pas ici tant qu'on ne lui avait pas d'abord donne un site — un ordre impose
    // par rien, sinon par cette requete. Les huit chefs de table de juin, qui
    // n'encadrent aucun site, en etaient exclus eux aussi : impossible de les
    // redesigner.
    //
    // Seul `lecteur` est ecarte : c'est le palier de consultation, animer une table
    // le contredirait. L'ordre d'affichage distingue les encadrants du reste
    // (`deLaPlaque`, `encadrements`) — c'est un confort de lecture, pas un refus.
    prisma.utilisateur.findMany({
      where: {
        actif: true,
        archiveLe: null,
        NOT: { rolesGlobaux: { some: { role: 'lecteur' } } },
      },
      orderBy: { nom: 'asc' },
      select: {
        id: true,
        nom: true,
        loginId: true,
        rolesGlobaux: { select: { role: true } },
        sitesEncadres: {
          where: { archiveLe: null },
          select: { role: true, site: { select: { code: true, plaqueId: true } } },
        },
      },
    }),
    // Les marques, pour le selecteur de specialisation. Jamais en dur cote front
    // (interdit n.3).
    prisma.marque.findMany({
      where: { archiveLe: null },
      orderBy: { ordre: 'asc' },
      select: { id: true, code: true, libelle: true },
    }),
  ]);

  const affectes = new Set(
    tables.flatMap((t) => t.affectations.map((a) => a.vendeurId.toString()))
  );

  const projeterVendeur = (v: (typeof vendeurs)[number]) => ({
    id: v.id.toString(),
    nom: v.nom,
    typeVehicule: v.typeVehicule,
    siteId: v.site.id.toString(),
    siteCode: v.site.code,
    siteLibelle: v.site.libelle,
    marqueIds: v.marques.map((m) => m.marqueId.toString()),
  });

  const parId = new Map(vendeurs.map((v) => [v.id.toString(), v]));

  return res.json({
    session: {
      id: session.id.toString(),
      campagneId: session.campagneId.toString(),
      campagneLibelle: session.campagne.libelle,
      cloturee: session.campagne.cloturee,
      plaqueId: session.plaqueId.toString(),
      plaqueLibelle: session.plaque.libelle,
      mode: session.mode,
      effectifCibleTable: session.effectifCibleTable,
    },
    tables: tables.map((t) => {
      const membres = t.affectations
        .map((a) => parId.get(a.vendeurId.toString()))
        .filter((v): v is (typeof vendeurs)[number] => !!v)
        .map(projeterVendeur);
      return {
        id: t.id.toString(),
        libelle: t.libelle,
        ordre: t.ordre,
        chefUtilisateurId: t.chefUtilisateurId?.toString() ?? null,
        chefNom: t.chef?.nom ?? null,
        /// Specialisation DECLAREE. `null` = table mixte, aucune contrainte —
        /// c'est le cas normal, et le seul observe en juin 2026.
        marqueId: t.marqueId?.toString() ?? null,
        marqueLibelle: t.marque?.libelle ?? null,
        membres,
        effectif: membres.length,
        // F-B.6 : `null` quand aucune cible n'est definie. Pas de cible, pas
        // d'alerte — et surtout pas une alerte a zero.
        ecartCible: ecartCible(membres.length, session.effectifCibleTable),
        /// Nombre d'affectations posees par la repartition automatique, pour que
        /// l'ecran distingue ce qui a ete decide a la main.
        posesAuto: t.affectations.filter((a) => a.origine === 'auto').length,
      };
    }),
    /// La RESERVE. Ce n'est pas un reliquat : F-B.8 dit que ces vendeurs restent
    /// saisissables par leur chef de site, et deux plaques sur quatre n'avaient
    /// aucune table en juin.
    reserve: vendeurs.filter((v) => !affectes.has(v.id.toString())).map(projeterVendeur),
    marques: marques.map((m) => ({ id: m.id.toString(), code: m.code, libelle: m.libelle })),
    chefsPossibles: utilisateurs.map((u) => ({
      id: u.id.toString(),
      nom: u.nom,
      loginId: u.loginId,
      /// Ce que ce compte encadre, en clair : « chef de vente VN — CLF ». C'est
      /// l'information qui compte au moment de composer une table, parce qu'elle
      /// dit d'ou vient le coach.
      encadrements: u.sitesEncadres.map((e) => ({ role: e.role, siteCode: e.site.code })),
      /// `true` quand il encadre au moins un site de CETTE plaque. Sert a l'ordre
      /// d'affichage, jamais a un refus.
      deLaPlaque: u.sitesEncadres.some((e) => e.site.plaqueId === session.plaqueId),
      rolesGlobaux: u.rolesGlobaux.map((r) => r.role),
    })),
  });
});

// ---------------------------------------------------------------- ecriture

/// POST /api/tables/session/:sessionId — F-B.1 creer une table.
router.post('/session/:sessionId', authentifier, avecDroits, async (req: RequeteAutorisee, res) => {
  const session = await sessionAutorisee(req, res, req.params.sessionId);
  if (!session) return;
  if (await refuserSiCloturee(res, session.campagneId)) return;

  const libelle = String(req.body?.libelle ?? '').trim();
  if (libelle === '') return res.status(400).json({ message: 'Le libelle est requis.' });

  // Specialisation optionnelle des la creation. Absente ou `null` = table MIXTE,
  // le cas normal et le seul observe en juin 2026.
  let marqueId: bigint | null = null;
  if (req.body?.marqueId !== undefined && req.body.marqueId !== null) {
    const marque = await prisma.marque.findUnique({
      where: { id: BigInt(String(req.body.marqueId)) },
      select: { id: true },
    });
    if (!marque) return res.status(400).json({ message: 'Marque inconnue.' });
    marqueId = marque.id;
  }

  // `ordre` 1..n, jamais zero partout : c'est lui qui departage les tables a
  // charge egale dans la repartition. Huit zeros rendaient ce departage
  // arbitraire, donc la graine 42 sans effet.
  const dernier = await prisma.tablePhoning.aggregate({
    where: { sessionPlaqueId: session.id },
    _max: { ordre: true },
  });

  // Une table archivee portant le meme libelle est REACTIVEE plutot que
  // dupliquee : l'unique `(session, libelle)` l'exige, et recreer perdrait son
  // historique d'affectations.
  const existante = await prisma.tablePhoning.findFirst({
    where: { sessionPlaqueId: session.id, libelle },
    select: { id: true, archiveLe: true },
  });

  const table = existante
    ? await prisma.tablePhoning.update({
        where: { id: existante.id },
        data: { archiveLe: null, marqueId },
        select: { id: true, libelle: true, ordre: true, marqueId: true },
      })
    : await prisma.tablePhoning.create({
        data: {
          sessionPlaqueId: session.id,
          libelle,
          ordre: (dernier._max.ordre ?? 0) + 1,
          marqueId,
          creePar: BigInt(req.droits!.utilisateurId),
        },
        select: { id: true, libelle: true, ordre: true, marqueId: true },
      });

  emettre(session.campagneId.toString(), 'tables:modifiees', {
    sessionId: session.id.toString(),
  });

  return res.status(existante ? 200 : 201).json({
    id: table.id.toString(),
    libelle: table.libelle,
    ordre: table.ordre,
    marqueId: table.marqueId?.toString() ?? null,
    reactivee: !!existante?.archiveLe,
  });
});

/// PATCH /api/tables/:tableId — F-B.1 renommer, F-B.2 designer le chef.
router.patch('/:tableId', authentifier, avecDroits, async (req: RequeteAutorisee, res) => {
  const table = await sessionDeLaTable(req.params.tableId);
  if (!table || table.archiveLe) return res.status(404).json({ message: 'Table introuvable.' });

  const session = await sessionAutorisee(req, res, table.sessionPlaqueId.toString());
  if (!session) return;
  if (await refuserSiCloturee(res, session.campagneId)) return;

  const donnees: Prisma.TablePhoningUpdateInput = {};

  if (req.body?.libelle !== undefined) {
    const libelle = String(req.body.libelle ?? '').trim();
    if (libelle === '') return res.status(400).json({ message: 'Le libelle ne peut pas etre vide.' });
    donnees.libelle = libelle;
  }

  if (req.body?.chefUtilisateurId !== undefined) {
    const brut = req.body.chefUtilisateurId;
    if (brut === null) {
      donnees.chef = { disconnect: true };
    } else {
      const chef = await prisma.utilisateur.findUnique({
        where: { id: BigInt(String(brut)) },
        select: { id: true, actif: true, archiveLe: true },
      });
      if (!chef || !chef.actif || chef.archiveLe) {
        return res.status(400).json({ message: 'Ce compte ne peut pas animer une table.' });
      }
      donnees.chef = { connect: { id: chef.id } };
    }
  }

  if (req.body?.marqueId !== undefined) {
    const brut = req.body.marqueId;
    if (brut === null) {
      // Retour a une table MIXTE. Les membres deja en place ne sont pas touches :
      // lever une contrainte ne peut invalider personne.
      donnees.marque = { disconnect: true };
    } else {
      const marque = await prisma.marque.findUnique({
        where: { id: BigInt(String(brut)) },
        select: { id: true, libelle: true },
      });
      if (!marque) return res.status(400).json({ message: 'Marque inconnue.' });

      // Specialiser une table DEJA COMPOSEE peut rendre des membres invalides. On
      // le dit AVANT, plutot que de laisser le trigger refuser plus tard sur une
      // affectation qui n'a rien a voir.
      const incompatibles = await prisma.vendeur.findMany({
        where: {
          affectations: { some: { tableId: table.id, archiveLe: null } },
          OR: [{ typeVehicule: 'VO' }, { marques: { none: { marqueId: marque.id } } }],
        },
        select: { nom: true, typeVehicule: true },
      });
      if (incompatibles.length > 0) {
        return res.status(409).json({
          message:
            `Specialiser « ${table.libelle} » sur ${marque.libelle} est impossible : ` +
            `${incompatibles.length} membre(s) actuel(s) ne peuvent pas y rester — ` +
            incompatibles
              .slice(0, 5)
              .map((v) => `${v.nom}${v.typeVehicule === 'VO' ? ' (VO)' : ''}`)
              .join(', ') +
            '. Les retirer d abord, ou laisser la table mixte.',
          incompatibles: incompatibles.map((v) => v.nom),
        });
      }
      donnees.marque = { connect: { id: marque.id } };
    }
  }

  if (req.body?.ordre !== undefined) {
    const ordre = Number(req.body.ordre);
    if (!Number.isInteger(ordre) || ordre < 1) {
      return res.status(400).json({ message: 'ordre doit etre un entier positif.' });
    }
    donnees.ordre = ordre;
  }

  if (Object.keys(donnees).length === 0) {
    return res.status(400).json({ message: 'Rien a modifier.' });
  }

  try {
    const apres = await prisma.tablePhoning.update({
      where: { id: table.id },
      data: donnees,
      select: {
        id: true,
        libelle: true,
        ordre: true,
        chef: { select: { id: true, nom: true } },
        marque: { select: { id: true, libelle: true } },
      },
    });
    emettre(session.campagneId.toString(), 'tables:modifiees', {
      sessionId: session.id.toString(),
    });
    return res.json({
      id: apres.id.toString(),
      libelle: apres.libelle,
      ordre: apres.ordre,
      chefUtilisateurId: apres.chef?.id.toString() ?? null,
      chefNom: apres.chef?.nom ?? null,
      marqueId: apres.marque?.id.toString() ?? null,
      marqueLibelle: apres.marque?.libelle ?? null,
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return res.status(409).json({ message: 'Une table porte deja ce libelle dans cette session.' });
    }
    throw e;
  }
});

/// POST /api/tables/:tableId/archiver
///
/// F-B.1 dit << supprimer >>. Interdit n.1 : on ARCHIVE. Les affectations de la
/// table sont archivees avec elle, sinon leurs vendeurs resteraient comptes comme
/// affectes a une table qui n'apparait plus — et disparaitraient de la reserve.
router.post('/:tableId/archiver', authentifier, avecDroits, async (req: RequeteAutorisee, res) => {
  const table = await sessionDeLaTable(req.params.tableId);
  if (!table) return res.status(404).json({ message: 'Table introuvable.' });

  const session = await sessionAutorisee(req, res, table.sessionPlaqueId.toString());
  if (!session) return;
  if (await refuserSiCloturee(res, session.campagneId)) return;

  const maintenant = new Date();
  const [, affectations] = await prisma.$transaction([
    prisma.tablePhoning.update({ where: { id: table.id }, data: { archiveLe: maintenant } }),
    prisma.affectation.updateMany({
      where: { tableId: table.id, archiveLe: null },
      data: { archiveLe: maintenant },
    }),
  ]);

  emettre(session.campagneId.toString(), 'tables:modifiees', {
    sessionId: session.id.toString(),
  });

  return res.json({
    archivee: table.libelle,
    affectationsArchivees: affectations.count,
    message:
      `« ${table.libelle} » est archivee, pas supprimee : sa composition reste consultable. ` +
      `${affectations.count} vendeur(s) reviennent en reserve et restent saisissables par leur chef de site.`,
  });
});

/// PUT /api/tables/:tableId/vendeurs — F-B.3, la composition de la table.
///
/// Remplace la composition par la liste transmise. Les vendeurs retires
/// reviennent en RESERVE : ils ne disparaissent pas, F-B.8 les garde saisissables.
///
/// REACTIVATION PLUTOT QUE RECREATION : l'unique `(table, vendeur)` fait qu'un
/// vendeur retire puis remis reprend SA ligne, avec son historique. C'est la meme
/// decision que pour les tables elles-memes.
router.put('/:tableId/vendeurs', authentifier, avecDroits, async (req: RequeteAutorisee, res) => {
  const table = await sessionDeLaTable(req.params.tableId);
  if (!table || table.archiveLe) return res.status(404).json({ message: 'Table introuvable.' });

  const session = await sessionAutorisee(req, res, table.sessionPlaqueId.toString());
  if (!session) return;
  if (await refuserSiCloturee(res, session.campagneId)) return;

  const brut = req.body?.vendeurIds;
  if (!Array.isArray(brut) || brut.some((v) => typeof v !== 'string')) {
    return res.status(400).json({ message: 'vendeurIds doit etre un tableau de chaines.' });
  }
  const vendeurIds = [...new Set(brut as string[])].map((v) => BigInt(v));

  try {
    const resume = await prisma.$transaction(async (tx) => {
      const maintenant = new Date();
      const retires = await tx.affectation.updateMany({
        where: { tableId: table.id, archiveLe: null, vendeurId: { notIn: vendeurIds } },
        data: { archiveLe: maintenant },
      });

      for (const vendeurId of vendeurIds) {
        await tx.affectation.upsert({
          where: { tableId_vendeurId: { tableId: table.id, vendeurId } },
          update: { archiveLe: null, origine: 'manuel' },
          create: {
            tableId: table.id,
            vendeurId,
            origine: 'manuel',
            creePar: BigInt(req.droits!.utilisateurId),
          },
        });
      }

      return { retires: retires.count, effectif: vendeurIds.length };
    });

    emettre(session.campagneId.toString(), 'tables:modifiees', {
      sessionId: session.id.toString(),
    });
    return res.json(resume);
  } catch (e) {
    // R-B.1 et R-B.4 sont tenues par des triggers. Leur message est deja ecrit
    // pour un humain : on le transmet plutot que d'en fabriquer un autre.
    const conflit = messageTrigger(e);
    if (conflit) return res.status(409).json({ message: conflit });
    throw e;
  }
});

// ---------------------------------------------------------------- repartition

/// POST /api/tables/session/:sessionId/repartition-auto — F-B.5, graine 42.
///
/// `remplacer: true` REFAIT la composition entiere : toutes les affectations de la
/// session sont archivees, puis tout le monde est replace. C'est derriere un
/// drapeau explicite parce que ca efface un travail manuel — jamais un effet de
/// bord. Par defaut, la repartition ne fait que COMPLETER : elle place les
/// vendeurs sans table et ne deplace personne.
router.post(
  '/session/:sessionId/repartition-auto',
  authentifier,
  avecDroits,
  async (req: RequeteAutorisee, res) => {
    const session = await sessionAutorisee(req, res, req.params.sessionId);
    if (!session) return;
    if (await refuserSiCloturee(res, session.campagneId)) return;

    const remplacer = req.body?.remplacer === true;

    const tables = await prisma.tablePhoning.findMany({
      where: { sessionPlaqueId: session.id, archiveLe: null },
      orderBy: { ordre: 'asc' },
      select: {
        id: true,
        libelle: true,
        ordre: true,
        marqueId: true,
        affectations: { where: { archiveLe: null }, select: { vendeurId: true } },
      },
    });

    if (tables.length === 0) {
      return res.status(409).json({
        message:
          'Cette session n’a aucune table. Creer au moins une table avant de repartir — ' +
          'la repartition ne cree pas de table, elle remplit celles qui existent.',
      });
    }

    const vendeurs = await prisma.vendeur.findMany({
      where: { site: { plaqueId: session.plaqueId }, AND: [presenceVendeur(session.campagne)] },
      select: {
        id: true,
        nom: true,
        typeVehicule: true,
        marques: { select: { marqueId: true } },
      },
    });

    const projeter = (v: (typeof vendeurs)[number]): VendeurAPlacer => ({
      id: v.id.toString(),
      nom: v.nom,
      marqueIds: v.marques.map((m) => m.marqueId.toString()),
      typeVehicule: v.typeVehicule as TypeVehicule,
    });

    // Les vendeurs deja affectes AILLEURS dans la campagne — y compris dans une
    // autre plaque, ce que R-B.1 interdit mais que l'historique peut porter — ne
    // sont pas candidats : R-B.4 refuserait, et la repartition doit proposer un
    // resultat applicable.
    const affectesCampagne = new Set(
      (
        await prisma.affectation.findMany({
          where: {
            archiveLe: null,
            table: { archiveLe: null, sessionPlaque: { campagneId: session.campagneId } },
          },
          select: { vendeurId: true },
        })
      ).map((a) => a.vendeurId.toString())
    );

    const membresParTable = new Map(
      tables.map((t) => [t.id.toString(), t.affectations.map((a) => a.vendeurId.toString())])
    );
    const parId = new Map(vendeurs.map((v) => [v.id.toString(), v]));

    const cibles: TableCible[] = tables.map((t) => ({
      id: t.id.toString(),
      libelle: t.libelle,
      ordre: t.ordre,
      // Specialisation DECLAREE, jamais deduite des membres presents : voir la
      // note de `compatible` dans `utils/repartition.ts`.
      marqueId: t.marqueId?.toString() ?? null,
      membres: remplacer
        ? []
        : (membresParTable.get(t.id.toString()) ?? [])
            .map((id) => parId.get(id))
            .filter((v): v is (typeof vendeurs)[number] => !!v)
            .map(projeter),
    }));

    const dejaDansLaSession = new Set(
      [...membresParTable.values()].flat()
    );

    const aPlacer = vendeurs
      .filter((v) => {
        const id = v.id.toString();
        if (remplacer) return true;
        // Compléter : uniquement ceux qui n'ont aucune table sur la campagne.
        return !affectesCampagne.has(id);
      })
      .map(projeter);

    const resultat = repartir(aPlacer, cibles);

    // Ecriture. Une seule transaction : une repartition a moitie appliquee serait
    // pire que pas de repartition du tout.
    try {
      await prisma.$transaction(async (tx) => {
        if (remplacer) {
          await tx.affectation.updateMany({
            where: { tableId: { in: tables.map((t) => t.id) }, archiveLe: null },
            data: { archiveLe: new Date() },
          });
        }
        for (const p of resultat.placements) {
          for (const vendeurId of p.vendeurIdsAjoutes) {
            await tx.affectation.upsert({
              where: {
                tableId_vendeurId: { tableId: BigInt(p.tableId), vendeurId: BigInt(vendeurId) },
              },
              update: { archiveLe: null, origine: 'auto' },
              create: {
                tableId: BigInt(p.tableId),
                vendeurId: BigInt(vendeurId),
                origine: 'auto',
                creePar: BigInt(req.droits!.utilisateurId),
              },
            });
          }
        }
      });
    } catch (e) {
      const conflit = messageTrigger(e);
      if (conflit) return res.status(409).json({ message: conflit });
      throw e;
    }

    emettre(session.campagneId.toString(), 'tables:modifiees', {
      sessionId: session.id.toString(),
    });

    return res.json({
      graine: 42,
      remplacer,
      placements: resultat.placements,
      nonPlaces: resultat.nonPlaces,
      dejaEnPlace: remplacer ? 0 : dejaDansLaSession.size,
      message:
        `Graine 42 : relancer cette repartition sur les memes donnees redonnera ` +
        `exactement la meme composition.` +
        (resultat.nonPlaces.length > 0
          ? ` ${resultat.nonPlaces.length} vendeur(s) restent en reserve — ils demeurent ` +
            `saisissables par leur chef de site.`
          : ''),
    });
  }
);

/// POST /api/tables/session/:sessionId/reprendre — F-B.7.
///
/// << Reprendre la composition de la campagne precedente en un clic. >>
///
/// Recopie les tables ET leurs affectations depuis la session de LA MEME PLAQUE
/// dans une autre campagne. Ce qui ne peut pas suivre est REPORTE, jamais force :
/// un vendeur parti depuis, ou passe dans une autre plaque, est signale et laisse
/// de cote. Le forcer creerait une affectation que R-B.1 refuserait, ou un vendeur
/// absent de la campagne dans une table.
router.post(
  '/session/:sessionId/reprendre',
  authentifier,
  avecDroits,
  async (req: RequeteAutorisee, res) => {
    const session = await sessionAutorisee(req, res, req.params.sessionId);
    if (!session) return;
    if (await refuserSiCloturee(res, session.campagneId)) return;

    const depuis = String(req.body?.depuisCampagneId ?? '');
    if (depuis === '') {
      return res.status(400).json({ message: 'depuisCampagneId est requis.' });
    }
    if (depuis === session.campagneId.toString()) {
      return res.status(400).json({ message: 'La campagne source doit etre une AUTRE campagne.' });
    }

    const source = await prisma.sessionPlaque.findFirst({
      where: { campagneId: BigInt(depuis), plaqueId: session.plaqueId, archiveLe: null },
      select: {
        campagne: { select: { libelle: true } },
        tables: {
          where: { archiveLe: null },
          orderBy: { ordre: 'asc' },
          select: {
            libelle: true,
            ordre: true,
            chefUtilisateurId: true,
            marqueId: true,
            affectations: {
              where: { archiveLe: null },
              select: { vendeur: { select: { id: true, nom: true } } },
            },
          },
        },
      },
    });

    if (!source) {
      return res.status(404).json({
        message: `Aucune session de ${session.plaque.libelle} sur la campagne demandee.`,
      });
    }
    if (source.tables.length === 0) {
      return res.status(409).json({
        message: `${session.plaque.libelle} n’avait aucune table sur ${source.campagne.libelle}. Rien a reprendre.`,
      });
    }

    // Qui peut suivre : present pendant LA NOUVELLE campagne et toujours de cette
    // plaque. Les deux conditions sont verifiees ici, en plus du trigger.
    const eligibles = new Set(
      (
        await prisma.vendeur.findMany({
          where: { site: { plaqueId: session.plaqueId }, AND: [presenceVendeur(session.campagne)] },
          select: { id: true },
        })
      ).map((v) => v.id.toString())
    );

    const reportes: { nom: string; raison: string }[] = [];
    let tablesCreees = 0;
    let affectationsReprises = 0;

    try {
      await prisma.$transaction(async (tx) => {
        for (const t of source.tables) {
          const existante = await tx.tablePhoning.findFirst({
            where: { sessionPlaqueId: session.id, libelle: t.libelle },
            select: { id: true },
          });

          const cible = existante
            ? await tx.tablePhoning.update({
                where: { id: existante.id },
                data: {
                  archiveLe: null,
                  ordre: t.ordre,
                  chefUtilisateurId: t.chefUtilisateurId,
                  marqueId: t.marqueId,
                },
                select: { id: true },
              })
            : await tx.tablePhoning.create({
                data: {
                  sessionPlaqueId: session.id,
                  libelle: t.libelle,
                  ordre: t.ordre,
                  chefUtilisateurId: t.chefUtilisateurId,
                  marqueId: t.marqueId,
                  creePar: BigInt(req.droits!.utilisateurId),
                },
                select: { id: true },
              });
          if (!existante) tablesCreees++;

          for (const a of t.affectations) {
            const id = a.vendeur.id.toString();
            if (!eligibles.has(id)) {
              reportes.push({
                nom: a.vendeur.nom,
                raison: 'absent de cette campagne, ou passe dans une autre plaque',
              });
              continue;
            }
            await tx.affectation.upsert({
              where: { tableId_vendeurId: { tableId: cible.id, vendeurId: a.vendeur.id } },
              update: { archiveLe: null },
              create: {
                tableId: cible.id,
                vendeurId: a.vendeur.id,
                origine: 'manuel',
                creePar: BigInt(req.droits!.utilisateurId),
              },
            });
            affectationsReprises++;
          }
        }
      });
    } catch (e) {
      const conflit = messageTrigger(e);
      if (conflit) return res.status(409).json({ message: conflit });
      throw e;
    }

    emettre(session.campagneId.toString(), 'tables:modifiees', {
      sessionId: session.id.toString(),
    });

    return res.json({
      depuis: source.campagne.libelle,
      tablesCreees,
      tablesReprises: source.tables.length,
      affectationsReprises,
      reportes,
      message:
        `Composition de ${source.campagne.libelle} reprise : ${source.tables.length} table(s), ` +
        `${affectationsReprises} affectation(s).` +
        (reportes.length > 0
          ? ` ${reportes.length} vendeur(s) n’ont pas pu suivre et restent en reserve.`
          : ''),
    });
  }
);

export default router;
