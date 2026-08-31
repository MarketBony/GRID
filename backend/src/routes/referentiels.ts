import { Router } from 'express';
import { prisma } from '../db';
import { authentifier } from '../auth/middleware';
import { avecDroits } from '../auth/garde';
import { MODES_SESSION, ROLES_ENCADREMENT, TYPES_VEHICULE } from '../auth/roles';

const router = Router();

// ============================================================================
// LA ROUTE QUI TIENT L'INTERDIT N.3.
//
// Un seul appel renvoie tout ce dont le front a besoin pour se construire :
// plaques, sites, marques, vendeurs, types de vehicule et modes de session.
// Le front ne code AUCUNE de ces valeurs en dur — pas meme `VN`/`VO`, qui
// viennent de `auth/roles.ts` et non d'une constante de `constants.ts`.
//
// C'est la difference avec GEARBOX, dont `constants.ts` porte une carte des
// plaques dupliquee dans `siteScope.ts`, avec un script pour contenir la derive.
// Ici il n'y a rien a synchroniser : la carte n'existe qu'en base, et cette route
// est le seul chemin par lequel le front l'apprend.
// ============================================================================

router.get('/', authentifier, avecDroits, async (_req, res) => {
  const [plaques, sites, marques, vendeurs, encadrements, encadrants] = await Promise.all([
    prisma.plaque.findMany({
      where: { archiveLe: null },
      orderBy: [{ ordre: 'asc' }, { libelle: 'asc' }],
      select: { id: true, libelle: true, alias: true, ordre: true },
    }),
    prisma.site.findMany({
      where: { archiveLe: null },
      orderBy: { libelle: 'asc' },
      select: { id: true, code: true, libelle: true, plaqueId: true },
    }),
    prisma.marque.findMany({
      where: { archiveLe: null },
      orderBy: [{ ordre: 'asc' }, { libelle: 'asc' }],
      select: { id: true, code: true, libelle: true, ordre: true },
    }),
    prisma.vendeur.findMany({
      // Les vendeurs ARCHIVES sont exclus partout : l'ecran Archivage a sa propre
      // route. Un archive qui ressort dans un referentiel reapparaitrait dans un
      // selecteur, et personne ne comprendrait pourquoi.
      where: { archiveLe: null },
      orderBy: { nom: 'asc' },
      select: {
        id: true,
        nom: true,
        siteId: true,
        typeVehicule: true,
        dateEntree: true,
        dateSortie: true,
        archiveLe: true,
        marques: { select: { marqueId: true } },
      },
    }),
    // L'ENCADREMENT DE CHAQUE SITE. Les encadrants sont des COMPTES, pas des
    // vendeurs : c'est la correction du 31/08/2026. Voir la migration
    // `20260831180000`.
    prisma.encadrementSite.findMany({
      where: { archiveLe: null },
      select: {
        id: true,
        siteId: true,
        role: true,
        utilisateur: { select: { id: true, nom: true, loginId: true, actif: true } },
      },
    }),
    // LES ENCADRANTS DISPONIBLES — tous comptes actifs hors lecteurs.
    //
    // « Tous » et non « ceux du site » : un encadrant peut etre rattache a
    // plusieurs sites, et surtout animer une table d'une AUTRE concession. Le
    // selecteur de l'ecran Vendeurs proposait les vendeurs du site — c'etait
    // l'erreur de modele.
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
          select: { role: true, site: { select: { code: true } } },
        },
      },
    }),
  ]);

  res.json({
    plaques,
    sites,
    marques,
    vendeurs: vendeurs.map((v) => ({
      id: v.id.toString(),
      nom: v.nom,
      siteId: v.siteId.toString(),
      typeVehicule: v.typeVehicule,
      dateEntree: v.dateEntree,
      dateSortie: v.dateSortie,
      // Toujours `null` ici, la route excluant les archives — mais present dans la
      // reponse parce que l'interface du front le declare. Une interface qui
      // mentionne un champ absent de la reponse est un mensonge que le compilateur
      // valide : c'est ce qui a produit une page blanche muette sur cet ecran.
      archiveLe: v.archiveLe,
      marqueIds: v.marques.map((m) => m.marqueId.toString()),
    })),
    encadrements: encadrements.map((e) => ({
      id: e.id.toString(),
      siteId: e.siteId.toString(),
      role: e.role,
      utilisateurId: e.utilisateur.id.toString(),
      nom: e.utilisateur.nom,
      loginId: e.utilisateur.loginId,
    })),
    encadrantsDisponibles: encadrants.map((u) => ({
      id: u.id.toString(),
      nom: u.nom,
      loginId: u.loginId,
      rolesGlobaux: u.rolesGlobaux.map((r) => r.role),
      /// Ce qu'il encadre DEJA, en clair. Un encadrant peut tenir plusieurs sites :
      /// l'afficher evite de croire qu'on le « vole » a un autre site.
      encadrements: u.sitesEncadres.map((e) => ({ role: e.role, siteCode: e.site.code })),
    })),
    typesVehicule: TYPES_VEHICULE,
    modesSession: MODES_SESSION,
    rolesEncadrement: ROLES_ENCADREMENT,
  });
});

export default router;
