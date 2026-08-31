import { Router } from 'express';
import { prisma } from '../db';
import { authentifier } from '../auth/middleware';
import { avecDroits, exigerAdministration, type RequeteAutorisee } from '../auth/garde';
import { estModeSessionValide } from '../auth/roles';
import { vendeursSaisissables } from '../auth/campagneScope';

const router = Router();

const FORMAT_JOUR = /^\d{4}-\d{2}-\d{2}$/;
const enJour = (iso: string) => new Date(`${iso}T00:00:00Z`);
const isoJour = (d: Date) => d.toISOString().slice(0, 10);

// ---------------------------------------------------------------- lecture

/// GET /api/campagnes
///
/// Chaque campagne porte `vendeursSaisissables` : le NOMBRE de vendeurs que
/// l'appelant peut saisir dessus. C'est ce qui permet a l'ecran de saisie
/// d'ouvrir sur une campagne ou l'utilisateur a quelque chose a faire, au lieu
/// d'ouvrir sur la plus recente et d'afficher un ecran vide.
///
/// Le cas n'est pas theorique : les droits sont PAR CAMPAGNE. Un chef de table de
/// juin n'a aucun perimetre en septembre, et un ecran vide se lit comme une panne.
router.get('/', authentifier, avecDroits, async (req: RequeteAutorisee, res) => {
  const campagnes = await prisma.campagne.findMany({
    where: { archiveLe: null },
    orderBy: { dateDebut: 'desc' },
    select: { id: true, libelle: true, dateDebut: true, dateFin: true, cloturee: true },
  });

  // Une passe par campagne. Il y en a une poignee par an : la simplicite vaut
  // mieux ici qu'une requete unique plus difficile a relire.
  const perimetres = await Promise.all(
    campagnes.map((c) => vendeursSaisissables(req.droits!, c.id.toString()))
  );

  res.json(
    campagnes.map((c, i) => ({ ...c, vendeursSaisissables: perimetres[i]!.size }))
  );
});

/// GET /api/campagnes/:id — jours, creneaux et sessions.
router.get('/:id', authentifier, avecDroits, async (req, res) => {
  const campagne = await prisma.campagne.findUnique({
    where: { id: BigInt(req.params.id) },
    include: {
      jours: { orderBy: { ordre: 'asc' } },
      creneaux: { orderBy: { ordre: 'asc' } },
      sessions: {
        where: { archiveLe: null },
        include: { plaque: { select: { id: true, libelle: true, alias: true, ordre: true } } },
      },
    },
  });

  if (!campagne) return res.status(404).json({ message: 'Campagne introuvable.' });

  return res.json({
    id: campagne.id.toString(),
    libelle: campagne.libelle,
    dateDebut: campagne.dateDebut,
    dateFin: campagne.dateFin,
    cloturee: campagne.cloturee,
    jours: campagne.jours.map((j) => ({ jour: isoJour(j.jour), ordre: j.ordre })),
    creneaux: campagne.creneaux.map((c) => ({ code: c.code, libelle: c.libelle, ordre: c.ordre })),
    sessions: campagne.sessions
      .map((s) => ({
        id: s.id.toString(),
        plaqueId: s.plaqueId.toString(),
        plaqueLibelle: s.plaque.libelle,
        plaqueOrdre: s.plaque.ordre,
        mode: s.mode,
        effectifCibleTable: s.effectifCibleTable,
      }))
      .sort((a, b) => a.plaqueOrdre - b.plaqueOrdre),
  });
});

// ---------------------------------------------------------------- ecriture

/// PATCH /api/campagnes/:id — libelle, dates, cloture.
router.patch('/:id', authentifier, avecDroits, exigerAdministration, async (req, res) => {
  const id = BigInt(req.params.id);
  const { libelle, dateDebut, dateFin, cloturee } = req.body ?? {};

  const donnees: Record<string, unknown> = {};
  if (libelle !== undefined) {
    if (typeof libelle !== 'string' || libelle.trim() === '') {
      return res.status(400).json({ message: 'Libelle invalide.' });
    }
    donnees.libelle = libelle.trim();
  }
  for (const [cle, valeur] of [
    ['dateDebut', dateDebut],
    ['dateFin', dateFin],
  ] as const) {
    if (valeur !== undefined) {
      if (typeof valeur !== 'string' || !FORMAT_JOUR.test(valeur)) {
        return res.status(400).json({ message: `${cle} doit etre au format AAAA-MM-JJ.` });
      }
      donnees[cle] = enJour(valeur);
    }
  }
  if (cloturee !== undefined) {
    if (typeof cloturee !== 'boolean') return res.status(400).json({ message: 'cloturee doit etre booleen.' });
    donnees.cloturee = cloturee;
  }

  if (Object.keys(donnees).length === 0) {
    return res.status(400).json({ message: 'Rien a modifier.' });
  }

  const campagne = await prisma.campagne.update({ where: { id }, data: donnees });
  return res.json({
    id: campagne.id.toString(),
    libelle: campagne.libelle,
    dateDebut: campagne.dateDebut,
    dateFin: campagne.dateFin,
    cloturee: campagne.cloturee,
  });
});

// ============================================================================
// R-A.2 — MODIFIER LES JOURS OU LES CRENEAUX D'UNE CAMPAGNE PORTANT DES RDV
//
// La cle etrangere composite `rdv -> campagne_jour` fait echouer en base la
// suppression d'un jour portant des RDV. C'est le garde-fou voulu, et il
// fonctionne. Mais laisser l'utilisateur se heurter a une erreur de contrainte
// n'est pas une interface : l'API doit CALCULER l'impact avant d'ecrire, le
// presenter, et attendre un choix — annuler, ou deplacer.
//
// SUBTILITE QUI COMPTE : la cle etrangere porte sur TOUS les RDV, archives
// compris. Un RDV archive sur un jour retire fait donc echouer la suppression
// exactement comme un RDV actif. Ils sont donc comptes ET deplaces eux aussi,
// mais annonces SEPAREMENT : << 3 RDV et 1 RDV archive seront deplaces >> est
// une information differente de << 4 RDV seront deplaces >>.
// ============================================================================

interface Confirmation {
  mode: 'annuler' | 'deplacer';
  vers?: string;
}

const lireConfirmation = (brut: unknown): Confirmation | null => {
  if (!brut || typeof brut !== 'object') return null;
  const c = brut as Record<string, unknown>;
  if (c.mode !== 'annuler' && c.mode !== 'deplacer') return null;
  return { mode: c.mode, vers: typeof c.vers === 'string' ? c.vers : undefined };
};

/// PUT /api/campagnes/:id/jours
router.put('/:id/jours', authentifier, avecDroits, exigerAdministration, async (req: RequeteAutorisee, res) => {
  const campagneId = BigInt(req.params.id);
  const { jours, confirmation: confirmationBrute } = req.body ?? {};

  if (!Array.isArray(jours) || jours.length === 0) {
    return res.status(400).json({ message: 'Au moins un jour est requis.' });
  }

  const demandes: string[] = [];
  for (const j of jours) {
    const iso = typeof j === 'string' ? j : j?.jour;
    if (typeof iso !== 'string' || !FORMAT_JOUR.test(iso)) {
      return res.status(400).json({ message: 'Chaque jour doit etre au format AAAA-MM-JJ.' });
    }
    demandes.push(iso);
  }
  if (new Set(demandes).size !== demandes.length) {
    return res.status(400).json({ message: 'Un jour est present deux fois.' });
  }

  const campagne = await prisma.campagne.findUnique({
    where: { id: campagneId },
    include: { jours: true },
  });
  if (!campagne) return res.status(404).json({ message: 'Campagne introuvable.' });
  if (campagne.cloturee) {
    return res.status(409).json({ message: 'Campagne cloturee : ses jours ne sont plus modifiables.' });
  }

  const actuels = campagne.jours.map((j) => isoJour(j.jour));
  const retires = actuels.filter((j) => !demandes.includes(j));
  const ajoutes = demandes.filter((j) => !actuels.includes(j));
  const confirmation = lireConfirmation(confirmationBrute);

  // Impact : tous les RDV des jours retires, actifs et archives.
  let impacts: { jour: string; actifs: number; archives: number; vendeurs: string[] }[] = [];
  if (retires.length > 0) {
    const rdvs = await prisma.rdv.findMany({
      where: { campagneId, jour: { in: retires.map(enJour) } },
      select: { jour: true, archiveLe: true, vendeur: { select: { nom: true } } },
    });

    const parJour = new Map<string, { actifs: number; archives: number; vendeurs: Set<string> }>();
    for (const r of rdvs) {
      const cle = isoJour(r.jour);
      const entree = parJour.get(cle) ?? { actifs: 0, archives: 0, vendeurs: new Set<string>() };
      if (r.archiveLe) entree.archives++;
      else {
        entree.actifs++;
        entree.vendeurs.add(r.vendeur.nom);
      }
      parJour.set(cle, entree);
    }
    impacts = [...parJour].map(([jour, e]) => ({
      jour,
      actifs: e.actifs,
      archives: e.archives,
      vendeurs: [...e.vendeurs].sort(),
    }));
  }

  const totalImpacte = impacts.reduce((n, i) => n + i.actifs + i.archives, 0);

  if (totalImpacte > 0 && !confirmation) {
    return res.status(409).json({
      code: 'RDV_IMPACTES',
      message:
        `Retirer ${retires.length > 1 ? 'ces jours' : 'ce jour'} supprimerait le rattachement de ` +
        `${totalImpacte} RDV. Choisir : annuler la modification, ou deplacer ces RDV vers un jour conserve.`,
      retires,
      ajoutes,
      impacts,
      joursConserves: demandes,
    });
  }

  if (confirmation?.mode === 'annuler') {
    return res.json({ annule: true, impacts });
  }

  let versJour: Date | null = null;
  if (totalImpacte > 0) {
    if (!confirmation?.vers || !FORMAT_JOUR.test(confirmation.vers)) {
      return res.status(400).json({ message: 'Le jour de destination est requis pour deplacer les RDV.' });
    }
    if (!demandes.includes(confirmation.vers)) {
      return res.status(400).json({
        message: 'Le jour de destination doit faire partie des jours conserves.',
        joursConserves: demandes,
      });
    }
    versJour = enJour(confirmation.vers);
  }

  // L'ordre des operations n'est pas negociable : creer les jours ajoutes AVANT
  // de deplacer les RDV, sinon la cle etrangere refuse la destination ; puis
  // supprimer les jours retires, une fois vides.
  await prisma.$transaction(async (tx) => {
    for (const [i, iso] of demandes.entries()) {
      await tx.campagneJour.upsert({
        where: { campagneId_jour: { campagneId, jour: enJour(iso) } },
        update: { ordre: i + 1 },
        create: { campagneId, jour: enJour(iso), ordre: i + 1, creePar: BigInt(req.utilisateur!.id) },
      });
    }

    if (versJour) {
      await tx.rdv.updateMany({
        where: { campagneId, jour: { in: retires.map(enJour) } },
        data: { jour: versJour, modifieLe: new Date(), modifiePar: BigInt(req.utilisateur!.id) },
      });
    }

    if (retires.length > 0) {
      await tx.campagneJour.deleteMany({ where: { campagneId, jour: { in: retires.map(enJour) } } });
    }
  });

  const apres = await prisma.campagneJour.findMany({
    where: { campagneId },
    orderBy: { ordre: 'asc' },
  });

  return res.json({
    jours: apres.map((j) => ({ jour: isoJour(j.jour), ordre: j.ordre })),
    retires,
    ajoutes,
    rdvDeplaces: versJour ? totalImpacte : 0,
    versJour: confirmation?.vers ?? null,
  });
});

/// PUT /api/campagnes/:id/creneaux — meme logique que les jours.
router.put('/:id/creneaux', authentifier, avecDroits, exigerAdministration, async (req: RequeteAutorisee, res) => {
  const campagneId = BigInt(req.params.id);
  const { creneaux, confirmation: confirmationBrute } = req.body ?? {};

  if (!Array.isArray(creneaux) || creneaux.length === 0) {
    return res.status(400).json({ message: 'Au moins un creneau est requis.' });
  }

  const demandes: { code: string; libelle: string }[] = [];
  for (const c of creneaux) {
    const code = typeof c?.code === 'string' ? c.code.trim() : '';
    const libelle = typeof c?.libelle === 'string' && c.libelle.trim() !== '' ? c.libelle.trim() : code;
    if (code === '') return res.status(400).json({ message: 'Chaque creneau doit porter un code.' });
    demandes.push({ code, libelle });
  }
  if (new Set(demandes.map((c) => c.code)).size !== demandes.length) {
    return res.status(400).json({ message: 'Un code de creneau est present deux fois.' });
  }

  const campagne = await prisma.campagne.findUnique({
    where: { id: campagneId },
    include: { creneaux: true },
  });
  if (!campagne) return res.status(404).json({ message: 'Campagne introuvable.' });
  if (campagne.cloturee) {
    return res.status(409).json({ message: 'Campagne cloturee : ses creneaux ne sont plus modifiables.' });
  }

  const codesDemandes = demandes.map((c) => c.code);
  const actuels = campagne.creneaux.map((c) => c.code);
  const retires = actuels.filter((c) => !codesDemandes.includes(c));
  const ajoutes = codesDemandes.filter((c) => !actuels.includes(c));
  const confirmation = lireConfirmation(confirmationBrute);

  let impacts: { creneau: string; actifs: number; archives: number; vendeurs: string[] }[] = [];
  if (retires.length > 0) {
    const rdvs = await prisma.rdv.findMany({
      where: { campagneId, creneauCode: { in: retires } },
      select: { creneauCode: true, archiveLe: true, vendeur: { select: { nom: true } } },
    });
    const parCreneau = new Map<string, { actifs: number; archives: number; vendeurs: Set<string> }>();
    for (const r of rdvs) {
      const e = parCreneau.get(r.creneauCode) ?? { actifs: 0, archives: 0, vendeurs: new Set<string>() };
      if (r.archiveLe) e.archives++;
      else {
        e.actifs++;
        e.vendeurs.add(r.vendeur.nom);
      }
      parCreneau.set(r.creneauCode, e);
    }
    impacts = [...parCreneau].map(([creneau, e]) => ({
      creneau,
      actifs: e.actifs,
      archives: e.archives,
      vendeurs: [...e.vendeurs].sort(),
    }));
  }

  const totalImpacte = impacts.reduce((n, i) => n + i.actifs + i.archives, 0);

  if (totalImpacte > 0 && !confirmation) {
    return res.status(409).json({
      code: 'RDV_IMPACTES',
      message:
        `Retirer ${retires.length > 1 ? 'ces creneaux' : 'ce creneau'} supprimerait le rattachement de ` +
        `${totalImpacte} RDV. Choisir : annuler la modification, ou deplacer ces RDV vers un creneau conserve.`,
      retires,
      ajoutes,
      impacts,
      creneauxConserves: codesDemandes,
    });
  }

  if (confirmation?.mode === 'annuler') return res.json({ annule: true, impacts });

  let versCreneau: string | null = null;
  if (totalImpacte > 0) {
    if (!confirmation?.vers || !codesDemandes.includes(confirmation.vers)) {
      return res.status(400).json({
        message: 'Le creneau de destination est requis et doit faire partie des creneaux conserves.',
        creneauxConserves: codesDemandes,
      });
    }
    versCreneau = confirmation.vers;
  }

  await prisma.$transaction(async (tx) => {
    for (const [i, c] of demandes.entries()) {
      await tx.campagneCreneau.upsert({
        where: { campagneId_code: { campagneId, code: c.code } },
        update: { libelle: c.libelle, ordre: i + 1 },
        create: {
          campagneId,
          code: c.code,
          libelle: c.libelle,
          ordre: i + 1,
          creePar: BigInt(req.utilisateur!.id),
        },
      });
    }

    if (versCreneau) {
      await tx.rdv.updateMany({
        where: { campagneId, creneauCode: { in: retires } },
        data: {
          creneauCode: versCreneau,
          modifieLe: new Date(),
          modifiePar: BigInt(req.utilisateur!.id),
        },
      });
    }

    if (retires.length > 0) {
      await tx.campagneCreneau.deleteMany({ where: { campagneId, code: { in: retires } } });
    }
  });

  const apres = await prisma.campagneCreneau.findMany({
    where: { campagneId },
    orderBy: { ordre: 'asc' },
  });

  return res.json({
    creneaux: apres.map((c) => ({ code: c.code, libelle: c.libelle, ordre: c.ordre })),
    retires,
    ajoutes,
    rdvDeplaces: versCreneau ? totalImpacte : 0,
    versCreneau,
  });
});

/// PATCH /api/campagnes/:id/sessions/:sessionId — mode et effectif cible (F-A4.5).
router.patch('/:id/sessions/:sessionId', authentifier, avecDroits, exigerAdministration, async (req, res) => {
  const campagneId = BigInt(req.params.id);
  const sessionId = BigInt(req.params.sessionId);
  const { mode, effectifCibleTable } = req.body ?? {};

  const session = await prisma.sessionPlaque.findUnique({ where: { id: sessionId } });
  if (!session || session.campagneId !== campagneId) {
    return res.status(404).json({ message: 'Session introuvable pour cette campagne.' });
  }

  const donnees: Record<string, unknown> = {};
  if (mode !== undefined) {
    if (!estModeSessionValide(mode)) {
      return res.status(400).json({ message: 'Mode invalide : attendu par_site ou par_table.' });
    }
    donnees.mode = mode;
  }
  if (effectifCibleTable !== undefined) {
    if (effectifCibleTable !== null && (!Number.isInteger(effectifCibleTable) || effectifCibleTable < 1)) {
      return res.status(400).json({ message: 'effectifCibleTable doit etre un entier positif ou null.' });
    }
    donnees.effectifCibleTable = effectifCibleTable;
  }
  if (Object.keys(donnees).length === 0) return res.status(400).json({ message: 'Rien a modifier.' });

  // Passer une plaque de `par_table` a `par_site` ne supprime AUCUNE table : la
  // composition reste en base, et repasser en `par_table` la retrouve. C'est
  // deliberé — perdre une composition parce qu'on a bascule un selecteur serait
  // une perte d'historique, donc contraire a l'interdit n.1.
  const apres = await prisma.sessionPlaque.update({ where: { id: sessionId }, data: donnees });

  return res.json({
    id: apres.id.toString(),
    mode: apres.mode,
    effectifCibleTable: apres.effectifCibleTable,
  });
});

export default router;
