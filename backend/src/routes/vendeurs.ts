import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../db';
import { authentifier } from '../auth/middleware';
import { avecDroits, exigerAdministration, type RequeteAutorisee } from '../auth/garde';
import { TYPES_VEHICULE, estTypeVehiculeValide } from '../auth/roles';
import { analyser, ErreurImport, type Referentiels } from '../utils/importMarques';
import { messageTrigger } from '../utils/messageTrigger';

const router = Router();

const FORMAT_JOUR = /^\d{4}-\d{2}-\d{2}$/;
const enJour = (iso: string) => new Date(`${iso}T00:00:00Z`);

/// Charge les referentiels dans la forme attendue par le parseur d'import.
/// Le parseur ne connait pas Prisma : il recoit des donnees, il rend un apercu.
async function chargerReferentiels(): Promise<Referentiels> {
  const [vendeurs, sites, marques] = await Promise.all([
    prisma.vendeur.findMany({
      select: { id: true, nom: true, siteId: true, marques: { select: { marqueId: true } } },
    }),
    prisma.site.findMany({ select: { id: true, code: true, libelle: true } }),
    prisma.marque.findMany({
      where: { archiveLe: null },
      select: { id: true, code: true, libelle: true },
    }),
  ]);

  return {
    vendeurs: vendeurs.map((v) => ({
      id: v.id.toString(),
      nom: v.nom,
      siteId: v.siteId.toString(),
      marqueIds: v.marques.map((m) => m.marqueId.toString()),
    })),
    sites: sites.map((s) => ({ id: s.id.toString(), code: s.code, libelle: s.libelle })),
    marques: marques.map((m) => ({ id: m.id.toString(), code: m.code, libelle: m.libelle })),
  };
}

// ============================================================================
// CAPACITES D'UN VENDEUR — marques autorisees ET types de vehicule.
//
// Les deux dimensions sont posees ENSEMBLE, par une seule fonction, et estampillees
// par un seul `capacites_confirmees_le`. L'operation reelle est « je valide ce
// vendeur » : deux chemins distincts auraient produit des vendeurs a moitie
// confirmes, que le compteur de progression aurait comptes comme proteges.
//
// Extraite ici pour que la route unitaire et l'import appliquent EXACTEMENT la
// meme regle — refus de la liste vide, estampille, remplacement complet.
// ============================================================================
async function poserCapacites(
  tx: Prisma.TransactionClient,
  vendeurId: bigint,
  marqueIds: bigint[],
  typeVehicule: string,
  parUtilisateur: bigint
) {
  // Un vendeur VO n'a AUCUNE marque : le fichier source ne lui donne pas de
  // ventilation, et le trigger `rdv_marque_selon_metier` interdit la marque sur
  // ses RDV. Laisser des lignes `vendeur_marque` chez lui serait du bruit
  // trompeur, affiche par l'ecran comme une autorisation qui n'existe pas.
  const marquesEffectives = typeVehicule === 'VO' ? [] : marqueIds;

  await tx.vendeurMarque.deleteMany({ where: { vendeurId } });
  if (marquesEffectives.length > 0) {
    await tx.vendeurMarque.createMany({
      data: marquesEffectives.map((marqueId) => ({ vendeurId, marqueId, creePar: parUtilisateur })),
    });
  }

  await tx.vendeur.update({
    where: { id: vendeurId },
    data: {
      typeVehicule,
      // PROVENANCE, plus un statut : qui a change les capacites de ce vendeur et
      // quand. La notion de « confirme / placeholder » a ete retiree — un vendeur
      // present en base est valide. Ces deux colonnes servent le jour ou un RDV
      // est refuse et que personne ne comprend pourquoi.
      capacitesModifieesLe: new Date(),
      capacitesModifieesPar: parUtilisateur,
    },
  });
}

// ---------------------------------------------------------------------------
// Note sur les `deleteMany` ci-dessus : `vendeur_marque` et
// `vendeur_type_vehicule` ne sont PAS couvertes par les triggers anti-suppression,
// et c'est volontaire. L'interdit n.1 protege les donnees METIER dont la perte est
// irreversible — un RDV, une campagne, un vendeur. Les capacites d'un vendeur sont
// un ETAT COURANT corrigeable : les remplacer est l'operation normale de l'ecran,
// et les archiver produirait un empilement de lignes mortes sans valeur.
// La trace de qui a change quoi et quand est portee par `capacites_confirmees_*`.
// ---------------------------------------------------------------------------

/// Valide un couple (marques, metier) recu du client.
///
/// Le METIER est un choix unique — VN ou VO — et non une liste : c'est ce que dit
/// le fichier source, ou un vendeur figure dans le bloc VN ou dans le bloc VO,
/// jamais dans les deux.
function validerCapacites(corps: unknown): { marqueIds: string[]; typeVehicule: string } | string {
  const c = (corps ?? {}) as { marqueIds?: unknown; typeVehicule?: unknown };

  if (!Array.isArray(c.marqueIds) || c.marqueIds.some((m) => typeof m !== 'string')) {
    return 'marqueIds doit etre un tableau de chaines.';
  }
  if (!estTypeVehiculeValide(c.typeVehicule)) {
    return `typeVehicule est requis : ${TYPES_VEHICULE.join(' ou ')}.`;
  }

  const typeVehicule = c.typeVehicule as string;
  const marqueIds = [...new Set(c.marqueIds as string[])];

  if (typeVehicule === 'VN' && marqueIds.length === 0) {
    // Sans marque, un vendeur VN ne peut recevoir aucun RDV et la grille de saisie
    // n'aurait aucune section a afficher. On refuse en l'expliquant, plutot que de
    // produire un vendeur muet dont personne ne comprendrait le silence.
    return (
      'Un vendeur VN doit avoir au moins une marque : c\'est elle qui determine les sections ' +
      'de son planning. Pour retirer un vendeur du perimetre, renseigner sa date de sortie.'
    );
  }

  // Un vendeur VO n'a pas de marque : on ignore silencieusement ce que le client
  // aurait envoye, plutot que de refuser une requete par ailleurs valide.
  return { marqueIds: typeVehicule === 'VO' ? [] : marqueIds, typeVehicule };
}

async function marquesExistent(ids: bigint[]): Promise<boolean> {
  if (ids.length === 0) return true;
  const n = await prisma.marque.count({ where: { id: { in: ids }, archiveLe: null } });
  return n === ids.length;
}

const SELECT_VENDEUR = {
  id: true,
  nom: true,
  siteId: true,
  typeVehicule: true,
  dateEntree: true,
  dateSortie: true,
  archiveLe: true,
  marques: { select: { marqueId: true } },
} as const;

type VendeurCharge = Prisma.VendeurGetPayload<{ select: typeof SELECT_VENDEUR }>;

const projeter = (v: VendeurCharge) => ({
  id: v.id.toString(),
  nom: v.nom,
  siteId: v.siteId.toString(),
  typeVehicule: v.typeVehicule,
  dateEntree: v.dateEntree,
  dateSortie: v.dateSortie,
  archiveLe: v.archiveLe,
  marqueIds: v.marques.map((m) => m.marqueId.toString()),
});

// ============================================================================
// LA NOTION DE « CONFIRME / PLACEHOLDER » A ETE RETIREE.
//
// Une route `GET /capacites/progression` vivait ici, avec sa jauge a l'ecran :
// elle distinguait un vendeur dont les capacites avaient ete validees par un
// humain d'un vendeur encore au placeholder pose par le seed.
//
// Decision de l'utilisateur, et elle se defend : un vendeur present en base est
// valide, point. La jauge mesurait une dette de saisie, pas une propriete du
// metier — et une progression qui ne bouge jamais devient un reproche permanent.
//
// Les colonnes `capacites_confirmees_le/par` restent, comme PROVENANCE : savoir
// qui a change les marques d'un vendeur et quand est utile le jour ou un RDV est
// refuse. Elles ne portent plus aucun statut, et rien ne les lit a l'affichage.
// ============================================================================

// ---------------------------------------------------------------- import

/// N'ECRIT RIEN. Rend un apercu.
router.post('/capacites/import/analyse', authentifier, avecDroits, exigerAdministration, async (req, res) => {
  const { contenu } = req.body ?? {};
  if (typeof contenu !== 'string' || contenu.trim() === '') {
    return res.status(400).json({ message: 'Rien a analyser : coller le tableau des marques.' });
  }

  try {
    return res.json(analyser(contenu, await chargerReferentiels()));
  } catch (e) {
    // Une erreur de format est une information pour l'utilisateur, pas un 500 :
    // le message explique quel format est attendu.
    if (e instanceof ErreurImport) return res.status(422).json({ message: e.message });
    throw e;
  }
});

/// Applique EXACTEMENT les lignes transmises. Ne rejoue pas l'analyse : c'est
/// l'utilisateur qui a valide l'apercu, et refaire le rapprochement ici
/// permettrait d'appliquer autre chose que ce qu'il a vu.
router.post(
  '/capacites/import/appliquer',
  authentifier,
  avecDroits,
  exigerAdministration,
  async (req: RequeteAutorisee, res) => {
    const { lignes } = req.body ?? {};
    if (!Array.isArray(lignes) || lignes.length === 0) {
      return res.status(400).json({ message: 'Aucune ligne a appliquer.' });
    }

    interface LigneEntrante {
      vendeurId: string;
      marqueIds: string[];
      typeVehicule: string;
    }
    const valides: LigneEntrante[] = [];

    for (const l of lignes) {
      if (typeof l?.vendeurId !== 'string') {
        return res.status(400).json({ message: 'Chaque ligne doit porter un vendeurId.' });
      }

      // L'import par collage ne porte que les MARQUES : le metier VN/VO du vendeur
      // est CONSERVE tel quel. Il vient du fichier source, il est deja juste, et
      // l'ecraser depuis un tableau de marques serait une regression silencieuse.
      const actuel = await prisma.vendeur.findUnique({
        where: { id: BigInt(l.vendeurId) },
        select: { typeVehicule: true },
      });
      if (!actuel) {
        return res.status(400).json({ message: `Vendeur ${l.vendeurId} introuvable.` });
      }

      const verdict = validerCapacites({
        marqueIds: l.marqueIds,
        typeVehicule: actuel.typeVehicule,
      });
      if (typeof verdict === 'string') return res.status(400).json({ message: verdict });
      valides.push({ vendeurId: l.vendeurId, ...verdict });
    }

    // Un vendeur cite deux fois avec des listes differentes : on refuse au lieu
    // d'appliquer la derniere et de laisser croire que la premiere a compte.
    const vus = new Set<string>();
    for (const l of valides) {
      if (vus.has(l.vendeurId)) {
        return res.status(409).json({
          message: `Le vendeur ${l.vendeurId} apparait plusieurs fois dans l'import. Corriger le tableau source.`,
        });
      }
      vus.add(l.vendeurId);
    }

    const vendeurIds = valides.map((l) => BigInt(l.vendeurId));
    const marqueIds = [...new Set(valides.flatMap((l) => l.marqueIds))].map((m) => BigInt(m));

    const nbVendeurs = await prisma.vendeur.count({ where: { id: { in: vendeurIds } } });
    if (nbVendeurs !== vendeurIds.length) {
      return res.status(400).json({ message: 'Un des vendeurs est introuvable.' });
    }
    if (!(await marquesExistent(marqueIds))) {
      return res.status(400).json({ message: 'Une des marques est inconnue ou archivee.' });
    }

    const parUtilisateur = BigInt(req.utilisateur!.id);

    // TOUT ou RIEN. Un import a moitie applique laisserait une partie des vendeurs
    // au placeholder sans que le compteur le distingue d'un import reussi.
    await prisma.$transaction(async (tx) => {
      for (const l of valides) {
        await poserCapacites(
          tx,
          BigInt(l.vendeurId),
          l.marqueIds.map((m) => BigInt(m)),
          l.typeVehicule,
          parUtilisateur
        );
      }
    });

    // La progression a disparu avec la notion de « confirme » : l'import rend
    // simplement ce qu'il a applique.
    return res.json({ appliquees: valides.length });
  }
);

// ---------------------------------------------------------------- CRUD vendeurs

/// POST /api/vendeurs — creer un vendeur (F-A3.1).
///
/// Critere de recette n.1 : « ajouter un vendeur prend moins de 30 secondes et il
/// apparait dans tous les classements ». Les capacites sont donc demandees des la
/// creation : un vendeur cree sans marque ni type serait invisible a la saisie, et
/// on ne comprendrait pas pourquoi.
router.post('/', authentifier, avecDroits, exigerAdministration, async (req: RequeteAutorisee, res) => {
  const { nom, siteId, dateEntree } = req.body ?? {};

  if (typeof nom !== 'string' || nom.trim() === '') {
    return res.status(400).json({ message: 'Le nom est requis.' });
  }
  if (typeof siteId !== 'string') {
    return res.status(400).json({ message: 'Le site est requis.' });
  }
  if (dateEntree !== undefined && dateEntree !== null && !FORMAT_JOUR.test(String(dateEntree))) {
    return res.status(400).json({ message: "La date d'entree doit etre au format AAAA-MM-JJ." });
  }

  const verdict = validerCapacites(req.body);
  if (typeof verdict === 'string') return res.status(400).json({ message: verdict });

  const site = await prisma.site.findUnique({ where: { id: BigInt(siteId) } });
  if (!site || site.archiveLe) {
    return res.status(400).json({ message: 'Site introuvable ou archive.' });
  }
  if (!(await marquesExistent(verdict.marqueIds.map((m) => BigInt(m))))) {
    return res.status(400).json({ message: 'Une des marques est inconnue ou archivee.' });
  }

  // Homonyme sur le MEME site : on refuse. Deux vendeurs de meme nom sur une meme
  // concession rendraient tout import par collage ambigu, et la grille de saisie
  // illisible. Sur deux sites differents, c'est admis — le code site les separe.
  const existant = await prisma.vendeur.findFirst({
    where: { nom: nom.trim(), siteId: BigInt(siteId) },
  });
  if (existant) {
    return res.status(409).json({
      message: `${nom.trim()} existe deja sur ce site.${
        existant.dateSortie ? ' Ce vendeur est sorti : retirer sa date de sortie pour le reactiver.' : ''
      }`,
    });
  }

  const parUtilisateur = BigInt(req.utilisateur!.id);

  const cree = await prisma.$transaction(async (tx) => {
    const v = await tx.vendeur.create({
      data: {
        nom: nom.trim(),
        siteId: BigInt(siteId),
        typeVehicule: verdict.typeVehicule,
        dateEntree: dateEntree ? enJour(String(dateEntree)) : null,
        creePar: parUtilisateur,
      },
    });
    await poserCapacites(
      tx,
      v.id,
      verdict.marqueIds.map((m) => BigInt(m)),
      verdict.typeVehicule,
      parUtilisateur
    );
    return v;
  });

  const complet = await prisma.vendeur.findUniqueOrThrow({
    where: { id: cree.id },
    select: SELECT_VENDEUR,
  });
  return res.status(201).json(projeter(complet));
});

/// PATCH /api/vendeurs/:id — nom, site, chef de site, dates, capacites.
///
/// **Changer `siteId` TRANSFERE le vendeur en conservant tout son historique**
/// (F-A3.5) : les RDV ne portent ni site ni plaque, ils pointent le vendeur. Les
/// totaux des deux sites suivent immediatement, sans toucher une ligne de RDV.
///
/// **Aucune suppression** (interdit n.1) : sortir un vendeur, c'est renseigner
/// `dateSortie`. Il disparait des classements courants, son historique reste.
router.patch('/:id', authentifier, avecDroits, exigerAdministration, async (req: RequeteAutorisee, res) => {
  const id = BigInt(req.params.id);
  const vendeur = await prisma.vendeur.findUnique({ where: { id } });
  if (!vendeur) return res.status(404).json({ message: 'Vendeur introuvable.' });

  const { nom, siteId, dateEntree, dateSortie, marqueIds, typeVehicule } = req.body ?? {};
  const donnees: Prisma.VendeurUpdateInput = {};

  if (nom !== undefined) {
    if (typeof nom !== 'string' || nom.trim() === '') {
      return res.status(400).json({ message: 'Nom invalide.' });
    }
    donnees.nom = nom.trim();
  }

  if (siteId !== undefined) {
    const site = await prisma.site.findUnique({ where: { id: BigInt(String(siteId)) } });
    if (!site || site.archiveLe) return res.status(400).json({ message: 'Site introuvable ou archive.' });
    donnees.site = { connect: { id: site.id } };
  }

  // L'ENCADREMENT N'EST PLUS ICI. Deux drapeaux vivaient sur `vendeur` : c'etait
  // une erreur de modele. Un encadrant est un COMPTE rattache a un site, par
  // `POST /api/encadrement`. Voir la migration `20260831180000`.

  for (const [cle, valeur] of [
    ['dateEntree', dateEntree],
    ['dateSortie', dateSortie],
  ] as const) {
    if (valeur === undefined) continue;
    if (valeur === null) {
      donnees[cle] = null;
      continue;
    }
    if (typeof valeur !== 'string' || !FORMAT_JOUR.test(valeur)) {
      return res.status(400).json({ message: `${cle} doit etre au format AAAA-MM-JJ, ou null.` });
    }
    donnees[cle] = enJour(valeur);
  }

  // Coherence des dates : la contrainte CHECK en base l'impose aussi, mais un 400
  // explicite vaut mieux qu'une erreur de contrainte remontee en 500.
  const entreeFinale =
    dateEntree === undefined ? vendeur.dateEntree : dateEntree === null ? null : enJour(String(dateEntree));
  const sortieFinale =
    dateSortie === undefined ? vendeur.dateSortie : dateSortie === null ? null : enJour(String(dateSortie));
  if (entreeFinale && sortieFinale && sortieFinale < entreeFinale) {
    return res.status(400).json({
      message: "La date de sortie ne peut pas preceder la date d'entree.",
    });
  }

  const changeCapacites = marqueIds !== undefined || typeVehicule !== undefined;
  let verdict: { marqueIds: string[]; typeVehicule: string } | null = null;

  if (changeCapacites) {
    const actuelles = await prisma.vendeur.findUniqueOrThrow({
      where: { id },
      select: { typeVehicule: true, marques: { select: { marqueId: true } } },
    });
    // `=== undefined` et NON `??` : `??` traite `null` comme « absent » et
    // retombait donc silencieusement sur la valeur courante. Un client envoyant
    // `typeVehicule: null` recevait un 200 alors qu'il demandait explicitement une
    // valeur invalide — le pire des deux mondes, ni applique ni signale.
    const v = validerCapacites({
      marqueIds:
        marqueIds === undefined ? actuelles.marques.map((m) => m.marqueId.toString()) : marqueIds,
      typeVehicule: typeVehicule === undefined ? actuelles.typeVehicule : typeVehicule,
    });
    if (typeof v === 'string') return res.status(400).json({ message: v });
    if (!(await marquesExistent(v.marqueIds.map((m) => BigInt(m))))) {
      return res.status(400).json({ message: 'Une des marques est inconnue ou archivee.' });
    }
    verdict = v;
  }

  if (Object.keys(donnees).length === 0 && !changeCapacites) {
    return res.status(400).json({ message: 'Rien a modifier.' });
  }

  const parUtilisateur = BigInt(req.utilisateur!.id);

  try {
    await prisma.$transaction(async (tx) => {
      if (Object.keys(donnees).length > 0) await tx.vendeur.update({ where: { id }, data: donnees });
      if (verdict) {
        await poserCapacites(
          tx,
          id,
          verdict.marqueIds.map((m) => BigInt(m)),
          verdict.typeVehicule,
          parUtilisateur
        );
      }
    });
  } catch (e) {
    // Les triggers d'encadrement refusent avec un message deja ecrit pour un
    // humain : on le transmet plutot que d'en fabriquer un autre.
    const conflit = messageTrigger(e);
    if (conflit) return res.status(409).json({ message: conflit });
    throw e;
  }

  const complet = await prisma.vendeur.findUniqueOrThrow({ where: { id }, select: SELECT_VENDEUR });
  return res.json(projeter(complet));
});

// ============================================================================
// ARCHIVAGE ET PURGE.
//
// DEUX NIVEAUX, et la distinction est le coeur du sujet.
//
// 1. ARCHIVER (l'icone poubelle de l'ecran Vendeurs) — la ligne disparait de tous
//    les ecrans, mais SES RDV RESTENT EN BASE. Les totaux des campagnes passees
//    ne bougent pas d'un iota. Reversible.
//
// 2. PURGER (l'ecran Archivage) — destruction definitive, RDV compris. Derriere
//    une seconde porte, sur une liste ou l'on voit ce qu'on detruit, et en
//    annoncant le nombre de RDV qui partiront avec.
//
// L'interdit n.1 n'est pas leve : par defaut aucun `DELETE` ne passe, sur aucune
// table. La purge ouvre une porte nommee, pour la duree d'UNE transaction —
// `SET LOCAL relance.purge_autorisee`. Voir la migration `20260831140000`.
// ============================================================================

/// GET /api/vendeurs/archives — la liste de l'ecran Archivage.
///
/// Porte le NOMBRE DE RDV de chaque vendeur : c'est ce qui sera detruit par une
/// purge, et personne ne doit avoir a le deviner.
router.get('/archives', authentifier, avecDroits, exigerAdministration, async (_req, res) => {
  const archives = await prisma.vendeur.findMany({
    where: { archiveLe: { not: null } },
    orderBy: { archiveLe: 'desc' },
    select: {
      ...SELECT_VENDEUR,
      archivePar: true,
      site: { select: { code: true, libelle: true } },
      _count: { select: { rdvs: true, affectations: true } },
    },
  });

  return res.json(
    archives.map((v) => ({
      ...projeter(v),
      siteCode: v.site.code,
      siteLibelle: v.site.libelle,
      nbRdv: v._count.rdvs,
      nbAffectations: v._count.affectations,
    }))
  );
});

/// POST /api/vendeurs/:id/archiver — l'icone poubelle.
router.post('/:id/archiver', authentifier, avecDroits, exigerAdministration, async (req: RequeteAutorisee, res) => {
  const id = BigInt(req.params.id);
  const vendeur = await prisma.vendeur.findUnique({
    where: { id },
    select: { nom: true, archiveLe: true, _count: { select: { rdvs: true } } },
  });
  if (!vendeur) return res.status(404).json({ message: 'Vendeur introuvable.' });
  if (vendeur.archiveLe) return res.status(409).json({ message: 'Ce vendeur est deja archive.' });

  await prisma.vendeur.update({
    where: { id },
    data: { archiveLe: new Date(), archivePar: BigInt(req.utilisateur!.id) },
  });

  return res.json({
    archive: vendeur.nom,
    nbRdv: vendeur._count.rdvs,
    message:
      `${vendeur.nom} est archive : il disparait des ecrans, mais ses ${vendeur._count.rdvs} RDV ` +
      'restent en base et les totaux des campagnes passees ne bougent pas. ' +
      'Reversible depuis l’écran Archivage.',
  });
});

/// POST /api/vendeurs/:id/desarchiver
router.post(
  '/:id/desarchiver',
  authentifier,
  avecDroits,
  exigerAdministration,
  async (req: RequeteAutorisee, res) => {
    const id = BigInt(req.params.id);
    const vendeur = await prisma.vendeur.findUnique({
      where: { id },
      select: { nom: true, archiveLe: true },
    });
    if (!vendeur) return res.status(404).json({ message: 'Vendeur introuvable.' });
    if (!vendeur.archiveLe) return res.status(409).json({ message: 'Ce vendeur n’est pas archive.' });

    try {
      await prisma.vendeur.update({
        where: { id },
        data: { archiveLe: null, archivePar: null },
      });
    } catch (e) {
      // Le desarchivage peut reveiller un conflit d'encadrement : le site a pu
      // recevoir un nouveau chef entre-temps.
      const conflit = messageTrigger(e);
      if (conflit) {
        return res.status(409).json({
          message: `${conflit} Retirer son role d’encadrement avant de le désarchiver.`,
        });
      }
      throw e;
    }

    return res.json({ desarchive: vendeur.nom });
  }
);

/// DELETE /api/vendeurs/:id — LA PURGE. Definitive, RDV compris.
///
/// `confirmation` est OBLIGATOIRE et doit valoir le nom exact du vendeur. Ce n'est
/// pas une formalite : c'est la seule operation de tout le produit qui detruit de
/// l'historique, et un clic ne doit pas suffire.
router.delete('/:id', authentifier, avecDroits, exigerAdministration, async (req: RequeteAutorisee, res) => {
  const id = BigInt(req.params.id);
  const vendeur = await prisma.vendeur.findUnique({
    where: { id },
    select: { nom: true, archiveLe: true, _count: { select: { rdvs: true, affectations: true } } },
  });
  if (!vendeur) return res.status(404).json({ message: 'Vendeur introuvable.' });

  // On ne purge que ce qui a DEJA ete archive : deux gestes distincts, deux
  // occasions de se raviser.
  if (!vendeur.archiveLe) {
    return res.status(409).json({
      message:
        'Seul un vendeur ARCHIVE peut etre purge. Archiver d’abord — ça laisse une occasion ' +
        'de se raviser avant une destruction definitive.',
    });
  }

  const confirmation = String(req.body?.confirmation ?? '');
  if (confirmation !== vendeur.nom) {
    return res.status(400).json({
      message:
        `Pour purger définitivement, renvoyer le nom exact du vendeur dans « confirmation ». ` +
        `Attendu : « ${vendeur.nom} ».`,
      attendu: vendeur.nom,
      nbRdv: vendeur._count.rdvs,
    });
  }

  const nbRdv = vendeur._count.rdvs;
  const nbAffectations = vendeur._count.affectations;

  await prisma.$transaction(async (tx) => {
    // LA PORTE. `SET LOCAL` meurt avec la transaction : elle ne peut pas rester
    // ouverte par oubli, et aucune autre session n'est affectee — contrairement a
    // un `ALTER TABLE ... DISABLE TRIGGER`, qui aurait desarme le garde-fou pour
    // tout le monde, y compris pendant une session de saisie.
    await tx.$executeRawUnsafe(`SET LOCAL relance.purge_autorisee = 'oui'`);
    await tx.rdv.deleteMany({ where: { vendeurId: id } });
    await tx.affectation.deleteMany({ where: { vendeurId: id } });
    await tx.vendeurMarque.deleteMany({ where: { vendeurId: id } });
    await tx.vendeur.delete({ where: { id } });
  });

  return res.json({
    purge: vendeur.nom,
    nbRdv,
    nbAffectations,
    message:
      `${vendeur.nom} est définitivement supprimé, avec ${nbRdv} RDV et ${nbAffectations} ` +
      'affectation(s). Les totaux des campagnes concernées ont changé. C’est irréversible.',
  });
});

export default router;
