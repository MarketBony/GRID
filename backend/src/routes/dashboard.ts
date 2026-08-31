import { Router } from 'express';
import { prisma } from '../db';
import { authentifier } from '../auth/middleware';
import { avecDroits, type RequeteAutorisee } from '../auth/garde';
import { presenceVendeur } from '../utils/presenceVendeur';
import {
  AXES,
  classer,
  comparer,
  totauxPar,
  totauxParJour,
  type Axe,
  type LigneRdv,
  type LigneVendeur,
} from '../utils/agregats';
import type { TypeVehicule } from '../auth/roles';
import { trierPar } from '../utils/tri';

const router = Router();

const isoJour = (d: Date) => d.toISOString().slice(0, 10);

// ============================================================================
// DASHBOARD — module D. COUCHE MINCE, AUCUN CALCUL ICI.
//
// Tout le calcul vit dans `utils/agregats.ts`, en fonctions pures, verifiees
// contre les 1107 RDV reels de juin 2026 par `npm run test:agregats`. Ce fichier
// ne fait que trois choses : charger les lignes, appeler ces fonctions, repondre.
//
// La tentation, en ecrivant un dashboard, est de faire les totaux en SQL avec des
// `groupBy` — plus court, et parfaitement juste. On ne le fait pas : un total
// calcule ici serait un second endroit ou la regle vit, et les deux divergeraient.
// Ce sont les deux denominateurs de progression (99 contre 72) qui ont coexiste
// des semaines sans que rien ne le signale.
//
// LECTURE OUVERTE A TOUT COMPTE ACTIF. R-C.4 (<< un chef de table ne voit que les
// vendeurs de sa table >>) est traitee comme une regle d'ECRAN et non de
// confidentialite : le module C ne liste que ta table, le dashboard montre tout.
// C'est ce qui donne un objet au role Lecteur, et c'est ce que fait le fichier
// Excel — l'onglet RANK est lisible par tous.
//
// EN REVANCHE AUCUN NOM DE CLIENT NE SORT D'ICI. Les agregats ne portent que des
// nombres : la question ne se pose meme pas, et c'est voulu. Le detail nominatif
// passe par `/api/saisie`, qui applique le portail.
//
// INTERDIT N.2 : rien n'est stocke. Chaque appel recompte.
// ============================================================================

/// Charge tout ce dont les fonctions pures ont besoin, pour une campagne.
///
/// La table d'un vendeur est une relation `(campagne, table, vendeur)` et JAMAIS
/// un attribut du vendeur : un vendeur change de table entre deux campagnes. Une
/// premiere version du modele avait fait cette erreur.
async function chargerCampagne(campagneId: string) {
  const campagne = await prisma.campagne.findUnique({
    where: { id: BigInt(campagneId) },
    select: {
      id: true,
      libelle: true,
      dateDebut: true,
      dateFin: true,
      cloturee: true,
      jours: { orderBy: { ordre: 'asc' }, select: { jour: true } },
      sessions: {
        where: { archiveLe: null },
        select: {
          id: true,
          mode: true,
          effectifCibleTable: true,
          plaque: { select: { id: true, libelle: true, ordre: true } },
        },
      },
    },
  });
  if (!campagne) return null;

  const [vendeursBase, affectations, rdvsBase] = await Promise.all([
    prisma.vendeur.findMany({
      // Presence PENDANT la campagne, jamais « actif aujourd'hui » : c'est le bug
      // `RANK!AG`. Source de verite unique dans `utils/presenceVendeur.ts`.
      where: presenceVendeur(campagne),
      orderBy: { nom: 'asc' },
      select: {
        id: true,
        nom: true,
        typeVehicule: true,
        site: {
          select: {
            id: true,
            libelle: true,
            // Jointure sur `site.plaque_id`. Ne JAMAIS deriver la plaque
            // autrement : le rattachement site -> plaque est modifiable.
            plaque: { select: { id: true, libelle: true } },
          },
        },
      },
    }),
    prisma.affectation.findMany({
      where: {
        archiveLe: null,
        table: { archiveLe: null, sessionPlaque: { campagneId: BigInt(campagneId) } },
      },
      select: {
        vendeurId: true,
        table: {
          select: {
            id: true,
            libelle: true,
            sessionPlaque: { select: { plaque: { select: { libelle: true } } } },
          },
        },
      },
    }),
    prisma.rdv.findMany({
      where: { campagneId: BigInt(campagneId), archiveLe: null },
      select: {
        vendeurId: true,
        typeVehicule: true,
        marqueId: true,
        jour: true,
        creneauCode: true,
      },
    }),
  ]);

  const tableParVendeur = new Map(
    affectations.map((a) => [
      a.vendeurId.toString(),
      {
        id: a.table.id.toString(),
        // Le libelle porte la plaque : CENTRE et SUD ont tous deux une « Table 1 »,
        // et un classement de tables les melangerait sans ca.
        libelle: `${a.table.libelle} — ${a.table.sessionPlaque.plaque.libelle}`,
      },
    ])
  );

  // TRI EN JAVASCRIPT, et non celui de la base : la collation de PostgreSQL
  // n'est pas la meme en developpement (`French_France.1252`) et dans le
  // conteneur de production (`en_US.utf8`), et cinq noms accentues sur 101
  // changent de place entre les deux. Voir `utils/tri.ts`.
  const vendeurs: LigneVendeur[] = trierPar(vendeursBase, (v) => v.nom).map((v) => {
    const t = tableParVendeur.get(v.id.toString());
    return {
      id: v.id.toString(),
      nom: v.nom,
      siteId: v.site.id.toString(),
      siteLibelle: v.site.libelle,
      plaqueId: v.site.plaque.id.toString(),
      plaqueLibelle: v.site.plaque.libelle,
      tableId: t?.id ?? null,
      tableLibelle: t?.libelle ?? null,
      typeVehicule: v.typeVehicule as TypeVehicule,
    };
  });

  const rdvs: LigneRdv[] = rdvsBase.map((r) => ({
    vendeurId: r.vendeurId.toString(),
    typeVehicule: r.typeVehicule as TypeVehicule,
    marqueId: r.marqueId?.toString() ?? null,
    jour: isoJour(r.jour),
    creneauCode: r.creneauCode,
  }));

  // Rattachements. Les fonctions d'agregat restent PURES : elles rendent des
  // paniers par clé, sans savoir qui contient qui. C'est donc ici qu'on expose
  // les liens, pour que les panneaux du module C puissent filtrer sur « ma
  // plaque » sans les recalculer.
  const rattachements = {
    siteVersPlaque: Object.fromEntries(vendeurs.map((v) => [v.siteId, v.plaqueId])),
    tableVersPlaque: Object.fromEntries(
      vendeurs.filter((v) => v.tableId).map((v) => [v.tableId!, v.plaqueId])
    ),
  };

  return { campagne, vendeurs, rdvs, rattachements };
}

/// GET /api/dashboard/:campagneId
///
/// Tous les axes en un seul appel (F-D.1) : l'ecran bascule d'un axe a l'autre
/// sans aller-retour, et le rafraichissement automatique (F-D.8) ne declenche
/// qu'une requete par cycle plutot que cinq.
router.get('/:campagneId', authentifier, avecDroits, async (req: RequeteAutorisee, res) => {
  const charge = await chargerCampagne(req.params.campagneId);
  if (!charge) return res.status(404).json({ message: 'Campagne introuvable.' });

  const { campagne, vendeurs, rdvs } = charge;
  const jours = campagne.jours.map((j) => isoJour(j.jour));

  const totaux = Object.fromEntries(
    AXES.map((axe) => [axe, totauxPar(axe as Axe, rdvs, vendeurs)])
  ) as Record<Axe, ReturnType<typeof totauxPar>>;

  // Les trois classements de l'onglet RANK, sur les sites. Departage documente
  // dans `agregats.ts` — jamais l'astuce `valeur - ROW()/1000000`.
  const classementsSites = {
    global: classer(totaux.site, 'global'),
    vn: classer(totaux.site, 'vn'),
    vo: classer(totaux.site, 'vo'),
  };

  return res.json({
    campagne: {
      id: campagne.id.toString(),
      libelle: campagne.libelle,
      dateDebut: campagne.dateDebut,
      dateFin: campagne.dateFin,
      cloturee: campagne.cloturee,
      jours,
    },
    // F-D.6 : l'ecran affiche les tables quand la session est en `par_table`, les
    // sites sinon. Le mode appartient a la SESSION et non a la plaque.
    sessions: campagne.sessions
      .slice()
      .sort((a, b) => a.plaque.ordre - b.plaque.ordre)
      .map((s) => ({
        id: s.id.toString(),
        plaqueId: s.plaque.id.toString(),
        plaqueLibelle: s.plaque.libelle,
        mode: s.mode,
        effectifCibleTable: s.effectifCibleTable,
      })),
    rattachements: charge.rattachements,
    totaux,
    classementsSites,
    classementVendeurs: classer(totaux.vendeur, 'global'),
    classementTables: classer(totaux.table, 'global'),
    parJour: totauxParJour(rdvs, jours, vendeurs),
  });
});

/// GET /api/dashboard/:campagneId/comparaison/:autreId — F-D.5
///
/// Remplace le « mars : 351 » ecrit a la main dans l'onglet SUIVI. L'axe est
/// libre : comparer des sites, des plaques ou des vendeurs entre deux campagnes.
router.get(
  '/:campagneId/comparaison/:autreId',
  authentifier,
  avecDroits,
  async (req: RequeteAutorisee, res) => {
    const axe = String(req.query.axe ?? 'site');
    if (!AXES.includes(axe as Axe)) {
      return res.status(400).json({ message: `axe invalide : attendu ${AXES.join(', ')}.` });
    }

    const [courant, anterieur] = await Promise.all([
      chargerCampagne(req.params.campagneId),
      chargerCampagne(req.params.autreId),
    ]);
    if (!courant) return res.status(404).json({ message: 'Campagne introuvable.' });
    if (!anterieur) return res.status(404).json({ message: 'Campagne de comparaison introuvable.' });

    // L'effectif est recalcule POUR CHAQUE CAMPAGNE avec ses propres bornes. Un
    // vendeur present en juin et parti depuis compte dans juin et pas dans
    // septembre — c'est tout l'objet de `presenceVendeur`.
    const ecarts = comparer(
      totauxPar(axe as Axe, courant.rdvs, courant.vendeurs),
      totauxPar(axe as Axe, anterieur.rdvs, anterieur.vendeurs)
    );

    return res.json({
      axe,
      courante: { id: courant.campagne.id.toString(), libelle: courant.campagne.libelle },
      anterieure: { id: anterieur.campagne.id.toString(), libelle: anterieur.campagne.libelle },
      ecarts,
    });
  }
);

export default router;
