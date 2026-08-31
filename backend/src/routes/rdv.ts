import { Router } from 'express';
import { prisma } from '../db';
import { authentifier } from '../auth/middleware';
import { avecDroits, type RequeteAutorisee } from '../auth/garde';
import { campagneOuverte, peutSaisirVendeur } from '../auth/campagneScope';
import { emettre } from '../realtime';

const router = Router();

const FORMAT_JOUR = /^\d{4}-\d{2}-\d{2}$/;
const enJour = (iso: string) => new Date(`${iso}T00:00:00Z`);
const isoJour = (d: Date) => d.toISOString().slice(0, 10);

// ============================================================================
// SAISIE D'UN RDV — le chemin le plus chaud de l'application.
//
// Le chef de table y passe la session, souvent avec un casque. Trois consequences
// sur la conception de ces routes :
//
//   1. AUCUN aller-retour inutile. La reponse porte tout ce que l'ecran doit
//      afficher apres l'action — le RDV pose, et les compteurs du vendeur.
//   2. LES MESSAGES D'ERREUR SONT LUS PAR UN HUMAIN PRESSE. « RELANCE: X n'est pas
//      autorise a vendre Dacia » vaut mieux qu'un 500. Les triggers les produisent,
//      `errorHandler` les renvoie en 422 avec leur texte.
//   3. AUCUNE SUPPRESSION. Retirer un RDV mal saisi, c'est `archive_le` : il quitte
//      les totaux, jamais l'historique, et on sait qui l'a retire.
// ============================================================================

/// Verifie l'autorisation d'ecriture et la campagne. Facteur commun aux trois
/// routes, pour qu'aucune ne puisse l'oublier.
async function verifierEcriture(
  req: RequeteAutorisee,
  campagneId: string,
  vendeurId: string
): Promise<{ ok: true } | { ok: false; statut: number; message: string }> {
  if (!(await campagneOuverte(campagneId))) {
    return {
      ok: false,
      statut: 409,
      message: 'Campagne cloturee ou archivee : plus aucune saisie possible.',
    };
  }
  if (!(await peutSaisirVendeur(req.droits!, campagneId, vendeurId))) {
    return {
      ok: false,
      statut: 403,
      message: "Ce vendeur n'est pas dans votre perimetre de saisie pour cette campagne.",
    };
  }
  return { ok: true };
}

/// Compteurs d'un vendeur, recalcules a la lecture. Aucun agregat stocke
/// (interdit n.2) : c'est un `groupBy`, comme le `COUNTA` du fichier.
async function compteursVendeur(campagneId: string, vendeurId: string) {
  const lignes = await prisma.rdv.groupBy({
    by: ['marqueId'],
    where: { campagneId: BigInt(campagneId), vendeurId: BigInt(vendeurId), archiveLe: null },
    _count: { _all: true },
  });
  const parMarque: Record<string, number> = {};
  let total = 0;
  for (const l of lignes) {
    total += l._count._all;
    // `marqueId` nul = vendeur VO, dont les RDV ne portent pas de marque.
    parMarque[l.marqueId ? l.marqueId.toString() : 'sansMarque'] = l._count._all;
  }
  return { vendeurId, total, parMarque };
}

const projeter = (r: {
  id: bigint;
  vendeurId: bigint;
  jour: Date;
  creneauCode: string;
  marqueId: bigint | null;
  typeVehicule: string;
  client: string;
  commentaire: string | null;
}) => ({
  id: r.id.toString(),
  vendeurId: r.vendeurId.toString(),
  jour: isoJour(r.jour),
  creneauCode: r.creneauCode,
  marqueId: r.marqueId ? r.marqueId.toString() : null,
  typeVehicule: r.typeVehicule,
  client: r.client,
  commentaire: r.commentaire,
});

/// POST /api/rdv — poser un RDV dans une case.
///
/// `typeVehicule` n'est PAS demande au client : il est lu sur le vendeur. Le laisser
/// choisir ouvrirait un ecart entre le metier du vendeur et le type de son RDV, que
/// le trigger refuserait de toute facon — autant ne pas poser la question.
router.post('/', authentifier, avecDroits, async (req: RequeteAutorisee, res) => {
  const { campagneId, vendeurId, jour, creneauCode, marqueId, client, commentaire } = req.body ?? {};

  if (typeof campagneId !== 'string' || typeof vendeurId !== 'string') {
    return res.status(400).json({ message: 'campagneId et vendeurId sont requis.' });
  }
  if (typeof jour !== 'string' || !FORMAT_JOUR.test(jour)) {
    return res.status(400).json({ message: 'jour doit etre au format AAAA-MM-JJ.' });
  }
  if (typeof creneauCode !== 'string' || creneauCode.trim() === '') {
    return res.status(400).json({ message: 'creneauCode est requis.' });
  }
  if (typeof client !== 'string' || client.trim() === '') {
    return res.status(400).json({ message: 'Le nom du client est requis.' });
  }

  const verdict = await verifierEcriture(req, campagneId, vendeurId);
  if (!verdict.ok) return res.status(verdict.statut).json({ message: verdict.message });

  const vendeur = await prisma.vendeur.findUnique({
    where: { id: BigInt(vendeurId) },
    select: { typeVehicule: true, nom: true },
  });
  if (!vendeur) return res.status(404).json({ message: 'Vendeur introuvable.' });

  // ------------------------------------------------------------ R-C.2
  // « Une case = un RDV. Deux RDV sur le meme creneau exigent une confirmation. »
  //
  // Sans ce controle, un second RDV sur la meme case est INVISIBLE : la grille
  // n'en affiche qu'un, mais les deux comptent dans les totaux. Un ecart
  // inexplicable entre ce qu'on voit et ce qui est compte — exactement ce que cet
  // outil doit supprimer.
  //
  // Le doublon n'est pas interdit : le fichier source montre des cases a plusieurs
  // noms. Il est CONFIRME, et l'appelant doit le demander explicitement.
  const dejaLa = await prisma.rdv.count({
    where: {
      campagneId: BigInt(campagneId),
      vendeurId: BigInt(vendeurId),
      jour: enJour(jour),
      creneauCode: creneauCode.trim(),
      marqueId: marqueId ? BigInt(String(marqueId)) : null,
      archiveLe: null,
    },
  });

  if (dejaLa > 0 && req.body?.confirmation !== true) {
    return res.status(409).json({
      code: 'CASE_OCCUPEE',
      message:
        `${vendeur.nom} a deja ${dejaLa} RDV sur ce creneau. En ajouter un second est possible, ` +
        'mais la grille n\'affichera que le premier : confirmer pour continuer.',
      dejaLa,
    });
  }

  const cree = await prisma.rdv.create({
    data: {
      campagneId: BigInt(campagneId),
      vendeurId: BigInt(vendeurId),
      jour: enJour(jour),
      creneauCode: creneauCode.trim(),
      marqueId: marqueId ? BigInt(String(marqueId)) : null,
      typeVehicule: vendeur.typeVehicule,
      client: client.trim(),
      commentaire: typeof commentaire === 'string' && commentaire.trim() !== '' ? commentaire.trim() : null,
      creePar: BigInt(req.utilisateur!.id),
    },
    select: {
      id: true,
      vendeurId: true,
      jour: true,
      creneauCode: true,
      marqueId: true,
      typeVehicule: true,
      client: true,
      commentaire: true,
    },
  });

  const compteurs = await compteursVendeur(campagneId, vendeurId);

  // Les autres chefs voient les compteurs bouger (F-C.10). L'evenement ne porte
  // PAS le nom du client : il porte de quoi invalider un compteur. Le destinataire
  // relit par l'API, qui applique la redaction du portail.
  emettre(campagneId, 'rdv:cree', { vendeurId, jour: cree.jour.toISOString().slice(0, 10), compteurs });

  return res.status(201).json({ rdv: projeter(cree), compteurs });
});

/// PATCH /api/rdv/:id — corriger le client ou le commentaire (F-C.6).
///
/// Deplacer un RDV d'une case a l'autre n'est PAS gere ici : c'est un archivage
/// suivi d'une creation, ce qui garde la trace du premier emplacement. Un `update`
/// du jour ou du creneau effacerait l'information « ce RDV etait ailleurs ».
router.patch('/:id', authentifier, avecDroits, async (req: RequeteAutorisee, res) => {
  const id = BigInt(req.params.id);
  const { client, commentaire } = req.body ?? {};

  const existant = await prisma.rdv.findUnique({
    where: { id },
    select: { campagneId: true, vendeurId: true, archiveLe: true },
  });
  if (!existant) return res.status(404).json({ message: 'RDV introuvable.' });
  if (existant.archiveLe) return res.status(409).json({ message: 'Ce RDV est archive.' });

  const campagneId = existant.campagneId.toString();
  const vendeurId = existant.vendeurId.toString();

  const verdict = await verifierEcriture(req, campagneId, vendeurId);
  if (!verdict.ok) return res.status(verdict.statut).json({ message: verdict.message });

  const donnees: { client?: string; commentaire?: string | null; modifieLe: Date; modifiePar: bigint } = {
    modifieLe: new Date(),
    modifiePar: BigInt(req.utilisateur!.id),
  };
  if (client !== undefined) {
    if (typeof client !== 'string' || client.trim() === '') {
      return res.status(400).json({ message: 'Le nom du client ne peut pas etre vide. Pour retirer le RDV, l\'archiver.' });
    }
    donnees.client = client.trim();
  }
  if (commentaire !== undefined) {
    donnees.commentaire =
      typeof commentaire === 'string' && commentaire.trim() !== '' ? commentaire.trim() : null;
  }

  const modifie = await prisma.rdv.update({
    where: { id },
    data: donnees,
    select: {
      id: true,
      vendeurId: true,
      jour: true,
      creneauCode: true,
      marqueId: true,
      typeVehicule: true,
      client: true,
      commentaire: true,
    },
  });

  emettre(campagneId, 'rdv:modifie', { vendeurId, jour: isoJour(modifie.jour) });
  return res.json({ rdv: projeter(modifie) });
});

/// POST /api/rdv/:id/archiver — retirer un RDV (F-C.6).
///
/// Pas de DELETE, jamais (interdit n.1). Le RDV quitte les totaux — toutes les
/// lectures filtrent `archive_le is null` — mais reste en base avec la trace de qui
/// l'a retire et quand. Une erreur de frappe en session ne doit pas effacer une
/// ligne d'historique.
router.post('/:id/archiver', authentifier, avecDroits, async (req: RequeteAutorisee, res) => {
  const id = BigInt(req.params.id);

  const existant = await prisma.rdv.findUnique({
    where: { id },
    select: { campagneId: true, vendeurId: true, jour: true, archiveLe: true },
  });
  if (!existant) return res.status(404).json({ message: 'RDV introuvable.' });

  const campagneId = existant.campagneId.toString();
  const vendeurId = existant.vendeurId.toString();

  // Deja archive : on ne se plaint pas. Deux clics rapides sur la meme case ne
  // doivent pas produire une erreur a l'ecran d'un chef de table.
  if (existant.archiveLe) {
    return res.json({ dejaArchive: true, compteurs: await compteursVendeur(campagneId, vendeurId) });
  }

  const verdict = await verifierEcriture(req, campagneId, vendeurId);
  if (!verdict.ok) return res.status(verdict.statut).json({ message: verdict.message });

  await prisma.rdv.update({
    where: { id },
    data: { archiveLe: new Date(), archivePar: BigInt(req.utilisateur!.id) },
  });

  const compteurs = await compteursVendeur(campagneId, vendeurId);
  emettre(campagneId, 'rdv:archive', { vendeurId, jour: isoJour(existant.jour), compteurs });

  return res.json({ archive: true, compteurs });
});

export default router;
