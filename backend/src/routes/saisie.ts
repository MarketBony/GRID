import { Router } from 'express';
import { prisma } from '../db';
import { authentifier } from '../auth/middleware';
import { avecDroits, type RequeteAutorisee } from '../auth/garde';
import { vendeursSaisissables, redacterRdvs } from '../auth/campagneScope';
import { presenceVendeur } from '../utils/presenceVendeur';

const router = Router();

const isoJour = (d: Date) => d.toISOString().slice(0, 10);

// ============================================================================
// LE PERIMETRE DE SAISIE — un seul appel.
//
// Le chef de table ouvre l'ecran et doit avoir TOUT : ses vendeurs, les jours et
// creneaux de la campagne, les marques de chacun, et les RDV deja saisis. En un
// aller-retour, pas en douze : F-C.1 demande que cliquer un nom ouvre son planning
// « sans rechargement de page », ce qui suppose que tout soit deja la.
//
// La forme de la grille sort d'ici et non du front : pour chaque vendeur, la liste
// de ses SECTIONS. Une par marque autorisee s'il est VN, une seule sans marque
// s'il est VO. C'est la regle lue dans le fichier source — le site Alpine n'a
// qu'une section, la plupart des sites en ont deux, un vendeur VO n'en a qu'une
// sans marque.
// ============================================================================

/// GET /api/saisie/:campagneId
router.get('/:campagneId', authentifier, avecDroits, async (req: RequeteAutorisee, res) => {
  const campagneId = req.params.campagneId;
  const droits = req.droits!;

  const campagne = await prisma.campagne.findUnique({
    where: { id: BigInt(campagneId) },
    include: {
      jours: { orderBy: { ordre: 'asc' } },
      creneaux: { orderBy: { ordre: 'asc' } },
    },
  });
  if (!campagne) return res.status(404).json({ message: 'Campagne introuvable.' });

  const autorises = await vendeursSaisissables(droits, campagneId);

  // Un compte sans aucun perimetre sur cette campagne : ce n'est pas une erreur,
  // c'est le cas d'un chef de table de juin qui ouvre septembre. On le dit.
  if (autorises.size === 0) {
    return res.json({
      campagne: enteteCampagne(campagne),
      perimetre: null,
      vendeurs: [],
      rdvs: [],
      message:
        'Aucun vendeur ne vous est rattache pour cette campagne. La saisie s\'ouvre par deux ' +
        'chemins : les SITES que vous encadrez, durablement, et les TABLES que vous animez, qui ' +
        'appartiennent chacune a une campagne. Etre chef de table en juin n\'en donne donc aucun ' +
        'en septembre, alors qu\'un encadrement de site suit d\'une campagne a l\'autre.',
    });
  }

  const ids = [...autorises].map((i) => BigInt(i));

  const [vendeurs, rdvs, tables] = await Promise.all([
    prisma.vendeur.findMany({
      where: { id: { in: ids }, AND: [presenceVendeur(campagne)] },
      orderBy: { nom: 'asc' },
      select: {
        id: true,
        nom: true,
        siteId: true,
        typeVehicule: true,
        site: { select: { id: true, code: true, libelle: true, plaqueId: true } },
        marques: {
          select: { marque: { select: { id: true, code: true, libelle: true, ordre: true } } },
        },
      },
    }),
    prisma.rdv.findMany({
      where: { campagneId: BigInt(campagneId), vendeurId: { in: ids }, archiveLe: null },
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
    }),
    // Les tables auxquelles appartiennent ces vendeurs, pour intituler le perimetre.
    prisma.tablePhoning.findMany({
      where: {
        archiveLe: null,
        sessionPlaque: { campagneId: BigInt(campagneId) },
        affectations: { some: { vendeurId: { in: ids }, archiveLe: null } },
      },
      select: {
        id: true,
        libelle: true,
        chef: { select: { nom: true } },
        sessionPlaque: { select: { plaque: { select: { id: true, libelle: true } } } },
      },
    }),
  ]);

  return res.json({
    campagne: enteteCampagne(campagne),
    perimetre: decrirePerimetre(droits, tables, vendeurs),
    vendeurs: vendeurs.map((v) => {
      // LA FORME DE SA GRILLE. Une section par marque autorisee pour un VN, une
      // seule section sans marque pour un VO.
      const sections =
        v.typeVehicule === 'VO'
          ? [{ marqueId: null, libelle: 'VO' }]
          : v.marques
              .map((m) => m.marque)
              .sort((a, b) => a.ordre - b.ordre || a.libelle.localeCompare(b.libelle, 'fr'))
              .map((m) => ({ marqueId: m.id.toString(), libelle: m.libelle }));

      return {
        id: v.id.toString(),
        nom: v.nom,
        typeVehicule: v.typeVehicule,
        siteId: v.site.id.toString(),
        siteCode: v.site.code,
        siteLibelle: v.site.libelle,
        sections,
      };
    }),
    // `redacterRdvs` laisse passer le champ `client` : tous ces vendeurs sont dans
    // le perimetre de saisie de l'appelant. L'appel est conserve pour que la regle
    // reste au meme endroit si le perimetre s'elargit un jour.
    rdvs: redacterRdvs(
      rdvs.map((r) => ({
        id: r.id.toString(),
        vendeurId: r.vendeurId.toString(),
        jour: isoJour(r.jour),
        creneauCode: r.creneauCode,
        marqueId: r.marqueId ? r.marqueId.toString() : null,
        typeVehicule: r.typeVehicule,
        client: r.client,
        commentaire: r.commentaire,
      })),
      autorises
    ),
  });
});

const enteteCampagne = (c: {
  id: bigint;
  libelle: string;
  cloturee: boolean;
  jours: { jour: Date; ordre: number }[];
  creneaux: { code: string; libelle: string; ordre: number }[];
}) => ({
  id: c.id.toString(),
  libelle: c.libelle,
  cloturee: c.cloturee,
  jours: c.jours.map((j) => ({ jour: isoJour(j.jour), ordre: j.ordre })),
  creneaux: c.creneaux.map((cr) => ({ code: cr.code, libelle: cr.libelle, ordre: cr.ordre })),
});

/// Intitule du perimetre affiche en tete de la liste : « Table 1 — CENTRE » quand
/// l'utilisateur anime une table, le ou les sites sinon.
///
/// **Les tables sont un supplement, pas le mode normal.** Le perimetre par defaut
/// est le site : NORD et SUD-OUEST n'avaient aucune table en juin 2026, et l'outil
/// doit leur etre pleinement utilisable.
function decrirePerimetre(
  droits: { admin: boolean },
  tables: {
    id: bigint;
    libelle: string;
    chef: { nom: string } | null;
    sessionPlaque: { plaque: { id: bigint; libelle: string } };
  }[],
  vendeurs: { site: { libelle: string; plaqueId: bigint } }[]
): {
  type: 'table' | 'site' | 'global';
  libelle: string;
  /// La plaque du perimetre, quand il n'en couvre QU'UNE. `null` pour un admin
  /// qui voit tout le groupe : les panneaux live n'ont alors aucune plaque a
  /// privilegier.
  plaqueId: string | null;
  /// La table animee, quand il y en a exactement une. C'est elle que le panneau
  /// des tables de la plaque met en avant.
  tableId: string | null;
} {
  // Une seule plaque couverte ? On la retient. Deux ou plus (cas d'un admin ou
  // d'un chef de plusieurs plaques) : aucune n'est « la mienne ».
  const plaques = new Set(vendeurs.map((v) => v.site.plaqueId.toString()));
  const plaqueId = plaques.size === 1 ? [...plaques][0]! : null;

  if (tables.length === 1) {
    const t = tables[0]!;
    return {
      type: 'table',
      libelle: `${t.libelle} — ${t.sessionPlaque.plaque.libelle}`,
      plaqueId: t.sessionPlaque.plaque.id.toString(),
      tableId: t.id.toString(),
    };
  }
  if (droits.admin) return { type: 'global', libelle: 'Tous les vendeurs', plaqueId, tableId: null };

  const sites = [...new Set(vendeurs.map((v) => v.site.libelle))].sort((a, b) =>
    a.localeCompare(b, 'fr')
  );
  return {
    type: 'site',
    libelle: sites.length === 1 ? sites[0]! : `${sites.length} sites`,
    plaqueId,
    tableId: null,
  };
}

export default router;
