// ============================================================================
// SEED DES REFERENTIELS — idempotent.
//
// Remplace `seed_referentiels.sql` (racine, conserve en reference obsolete), qui
// n'etait PAS idempotent : aucun `on conflict`, donc une seconde execution
// dupliquait les 19 sites et les 99 vendeurs sans rien signaler.
//
// Les donnees viennent de `donnees-source.ts`, extrait du SQL d'origine par
// `scripts/extraire-seed.mjs` avec verification des comptes (4 / 19 / 99 / 8 / 48).
//
// Rejouable autant de fois que necessaire : `npm --prefix backend run seed`.
// ============================================================================

import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { PLAQUES, SITES, VENDEURS, TABLES_JUIN, AFFECTATIONS_JUIN } from './donnees-source';
// Types VN/VO REELS, lus dans l'onglet RESULTATS du classeur par
// `scripts/extraire-xlsx.mjs`. Ce n'est plus un placeholder.
import { TYPES_VENDEURS } from './donnees-xlsx';

const prisma = new PrismaClient();

/// `@db.Date` ne stocke que la partie date. On passe par minuit UTC pour qu'aucun
/// decalage de fuseau ne fasse glisser un jour de campagne d'une case a l'autre —
/// le genre d'erreur qui se voit seulement quand un RDV du vendredi apparait le
/// jeudi.
const jour = (iso: string) => new Date(`${iso}T00:00:00Z`);

/// Identifiant de connexion depuis un nom complet : initiale du prenom + nom.
/// `SEVERINE BESSON` -> `sbesson`, `JF LARGET` -> `jlarget`.
const loginDepuisNom = (nom: string): string => {
  const sansAccent = nom.normalize('NFD').replace(/\p{Diacritic}/gu, '');
  const morceaux = sansAccent.trim().split(/\s+/);
  const premier = morceaux[0] ?? '';
  const dernier = morceaux[morceaux.length - 1] ?? '';
  return (premier.charAt(0) + dernier).toLowerCase().replace(/[^a-z0-9]/g, '');
};

// ---------------------------------------------------------------- creneaux
// Les 11 creneaux de l'onglet CLF du fichier de juin. Ce ne sont PAS des
// constantes du logiciel : ils appartiennent a la campagne (F-A4.3) et l'ecran A4
// les modifie. Ils sont ici parce qu'une campagne doit bien naitre avec quelque
// chose, pas parce qu'ils seraient figes.
const CRENEAUX = [
  '08:00-09:00', '09:00-10:00', '10:00-11:00', '11:00-12:00', '12:00-13:00',
  '13:00-14:00', '14:00-15:00', '15:00-16:00', '16:00-17:00', '17:00-18:00',
  '18:00-19:00',
].map((code, i) => ({
  code,
  // '08:00-09:00' -> '8h-9h', comme dans le fichier source.
  libelle: code.split('-').map((h) => `${Number(h.slice(0, 2))}h`).join('-'),
  ordre: i + 1,
}));

const MARQUES = [
  { code: 'RENAULT', libelle: 'Renault', ordre: 1 },
  { code: 'DACIA', libelle: 'Dacia', ordre: 2 },
  { code: 'ALPINE', libelle: 'Alpine', ordre: 3 },
];

async function main() {
  const motDePasseClair = process.env.SEED_MOT_DE_PASSE ?? randomBytes(9).toString('base64url');
  const motDePasseGenere = !process.env.SEED_MOT_DE_PASSE;
  const passwordHash = await bcrypt.hash(motDePasseClair, 10);
  let comptesCrees = 0;

  // ------------------------------------------------------------ marques
  const marques = new Map<string, bigint>();
  for (const m of MARQUES) {
    const enregistre = await prisma.marque.upsert({
      where: { code: m.code },
      update: { libelle: m.libelle, ordre: m.ordre },
      create: m,
    });
    marques.set(m.code, enregistre.id);
  }

  // ------------------------------------------------------------ plaques
  const plaques = new Map<string, bigint>();
  for (const p of PLAQUES) {
    const enregistre = await prisma.plaque.upsert({
      where: { libelle: p.libelle },
      update: { alias: p.alias, ordre: p.ordre },
      create: { libelle: p.libelle, alias: p.alias, ordre: p.ordre },
    });
    plaques.set(p.libelle, enregistre.id);
  }

  // ------------------------------------------------------------ sites
  const sites = new Map<string, bigint>();
  for (const s of SITES) {
    const plaqueId = plaques.get(s.plaque);
    if (!plaqueId) throw new Error(`Site ${s.code} : plaque "${s.plaque}" inconnue`);
    const enregistre = await prisma.site.upsert({
      where: { code: s.code },
      update: { libelle: s.libelle, plaqueId },
      create: { code: s.code, libelle: s.libelle, plaqueId },
    });
    sites.set(s.code, enregistre.id);
  }

  // ------------------------------------------------------------ types VN/VO
  // Rapprochement par ensemble de mots trie, comme l'import par collage : le
  // classeur et le SQL n'ecrivent pas toujours les noms dans le meme ordre. Les
  // 99 noms donnent 99 cles distinctes, le rapprochement est donc sans ambiguite.
  const cleNom = (n: string) =>
    n
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toUpperCase()
      .replace(/[-'’]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .split(' ')
      .sort()
      .join(' ');

  const typeParNom = new Map(TYPES_VENDEURS.map((t) => [cleNom(t.nom), t.type]));

  const sansType = VENDEURS.filter((v) => !typeParNom.has(cleNom(v.nom))).map((v) => v.nom);
  if (sansType.length > 0) {
    throw new Error(
      `Type VN/VO introuvable pour ${sansType.length} vendeur(s) : ${sansType.join(', ')}.\n` +
        'Rejouer `node scripts/extraire-xlsx.mjs` — le seed ne devine pas un type.'
    );
  }

  // ------------------------------------------------------------ vendeurs
  // Pas d'`upsert` : il n'y a pas de contrainte unique sur (nom, site_id), et je
  // n'en ajoute pas — deux homonymes sur un meme site sont improbables mais pas
  // impossibles, et une contrainte qui bloque un cas reel est pire qu'un seed
  // legerement plus verbeux.
  const vendeurs = new Map<string, bigint>();
  for (const v of VENDEURS) {
    const siteId = sites.get(v.site);
    if (!siteId) throw new Error(`Vendeur ${v.nom} : site "${v.site}" inconnu`);

    const typeVehicule = typeParNom.get(cleNom(v.nom))!;

    const existant = await prisma.vendeur.findFirst({ where: { nom: v.nom, siteId } });
    const vendeur = existant
      ? await prisma.vendeur.update({ where: { id: existant.id }, data: { typeVehicule } })
      : await prisma.vendeur.create({ data: { nom: v.nom, siteId, typeVehicule } });
    vendeurs.set(v.nom, vendeur.id);

    // Marques : SEULEMENT pour les vendeurs VN. Un vendeur VO n'a aucune
    // ventilation par marque dans le fichier — juste un total — et le trigger
    // `rdv_marque_selon_metier` interdit d'ailleurs la marque sur ses RDV. Des
    // lignes `vendeur_marque` chez un VO seraient donc du bruit trompeur.
    if (typeVehicule === 'VO') {
      await prisma.vendeurMarque.deleteMany({ where: { vendeurId: vendeur.id } });
    } else {
      // PLACEHOLDER, mais mieux informe qu'avant : ce sont LES MARQUES DU SITE,
      // lues dans l'en-tete du bloc RESULTATS (`ALP` pour Alpine, `REN`/`DAC`
      // ailleurs). Ce qui reste a confirmer a la main est la RESTRICTION
      // eventuelle d'un vendeur a une seule des deux marques de son site — une
      // information que le fichier ne porte pas : ses colonnes REN et DAC donnent
      // une activite, pas une autorisation.
      for (const code of v.marques) {
        const marqueId = marques.get(code);
        if (!marqueId) throw new Error(`Vendeur ${v.nom} : marque "${code}" inconnue`);
        await prisma.vendeurMarque.upsert({
          where: { vendeurId_marqueId: { vendeurId: vendeur.id, marqueId } },
          update: {},
          create: { vendeurId: vendeur.id, marqueId },
        });
      }
    }
  }

  // ------------------------------------------------------------ utilisateurs
  const admin = await prisma.utilisateur.upsert({
    where: { loginId: 'admin' },
    update: {},
    create: { loginId: 'admin', nom: 'Administrateur', passwordHash },
  });
  if (admin.creeLe.getTime() > Date.now() - 5000) comptesCrees++;
  await prisma.roleGlobal.upsert({
    where: { utilisateurId_role: { utilisateurId: admin.id, role: 'admin' } },
    update: {},
    create: { utilisateurId: admin.id, role: 'admin' },
  });

  // Les 8 chefs de table de juin. Aucun ne figure parmi les 99 vendeurs : ce sont
  // des encadrants sans bloc de saisie, ce qui est precisement pourquoi
  // `Utilisateur` est distinct de `Vendeur`. Ils n'ont AUCUN role global : leur
  // droit vient de `table_phoning.chef_utilisateur_id`, donc il est borne a la
  // campagne de la table qu'ils animent.
  const chefs = new Map<string, bigint>();
  for (const nomChef of new Set(TABLES_JUIN.map((t) => t.chef))) {
    const loginId = loginDepuisNom(nomChef);
    const u = await prisma.utilisateur.upsert({
      where: { loginId },
      update: {},
      create: { loginId, nom: nomChef, passwordHash },
    });
    if (u.creeLe.getTime() > Date.now() - 5000) comptesCrees++;
    chefs.set(nomChef, u.id);
  }

  // ------------------------------------------------------------ campagnes

  /// Sessions par plaque. Mode constate sur juin 2026 : seules CENTRE et SUD ont
  /// un onglet TABLES. NORD et SUD-OUEST n'en ont aucune, et `par_site` doit leur
  /// etre pleinement fonctionnel — ce n'est pas un mode degrade.
  ///
  /// `update: {}` : si l'utilisateur a change le mode d'une session, le seed n'a
  /// pas a le remettre.
  const creerSessions = async (campagneId: bigint) => {
    for (const [libellePlaque, plaqueId] of plaques) {
      const parTable = libellePlaque === 'CENTRE' || libellePlaque === 'SUD';
      await prisma.sessionPlaque.upsert({
        where: { campagneId_plaqueId: { campagneId, plaqueId } },
        update: {},
        create: {
          campagneId,
          plaqueId,
          mode: parTable ? 'par_table' : 'par_site',
          effectifCibleTable: parTable ? 6 : null,
        },
      });
    }
  };

  const creerCampagne = async (
    libelle: string,
    debut: string,
    fin: string,
    jours: string[]
  ) => {
    // LE SEED N'ECRASE PAS UNE CAMPAGNE EXISTANTE, et c'est un correctif.
    //
    // La version precedente reposait ses dates et REUPSERTAIT ses jours a chaque
    // passage. Consequence constatee : la campagne de septembre, dont les jours
    // avaient ete corriges a la main du 10 au 14, s'est retrouvee avec NEUF jours
    // apres un simple `npm run seed` — les cinq d'origine plus les cinq du
    // placeholder. Le critere de recette n.2 dit que changer les jours d'une
    // campagne doit prendre trente secondes ; il ne dit pas que le seed a le droit
    // de les remettre.
    //
    // Un seed etablit un ETAT INITIAL. Il ne se bat pas avec les modifications de
    // l'utilisateur.
    const dejaLa = await prisma.campagne.findUnique({
      where: { libelle },
      select: { id: true },
    });

    if (dejaLa) {
      // On complete seulement ce qui manque STRUCTURELLEMENT — les sessions par
      // plaque — et on ne touche ni aux dates, ni aux jours, ni aux creneaux.
      await creerSessions(dejaLa.id);
      return dejaLa;
    }

    const campagne = await prisma.campagne.create({
      data: { libelle, dateDebut: jour(debut), dateFin: jour(fin) },
    });

    for (const [i, j] of jours.entries()) {
      await prisma.campagneJour.create({
        data: { campagneId: campagne.id, jour: jour(j), ordre: i + 1 },
      });
    }

    for (const c of CRENEAUX) {
      await prisma.campagneCreneau.create({ data: { campagneId: campagne.id, ...c } });
    }

    await creerSessions(campagne.id);
    return campagne;
  };

  // Ces cinq jours sont jeudi, vendredi, samedi, DIMANCHE, lundi. Ce n'est pas une
  // erreur de transcription : confirme le 28/08/2026, la campagne de juin couvrait
  // bien un week-end.
  //
  // A retenir : les jours d'une campagne sont LIBRES. Ni consecutifs, ni au nombre
  // de cinq, ni limites aux jours ouvres. Toute logique qui supposerait le
  // contraire — un intervalle plutot qu'une liste, un filtre sur les week-ends —
  // casserait sur des donnees reelles.
  const juin = await creerCampagne('Juin 2026', '2026-06-11', '2026-06-15', [
    '2026-06-11', '2026-06-12', '2026-06-13', '2026-06-14', '2026-06-15',
  ]);

  // PLACEHOLDER : jeudi 10 au lundi 14 septembre 2026, par analogie avec juin
  // (jeudi a lundi, week-end inclus). Les vraies dates sont a saisir dans l'ecran
  // Campagnes — c'est le critere de recette n.2.
  //
  // Les dates annoncees par la documentation etaient le 10 au 14 alors que le seed
  // posait le 14 au 18 : une divergence doc/code que j'avais introduite en
  // corrigeant la doc sans corriger le code.
  await creerCampagne('Septembre 2026', '2026-09-10', '2026-09-14', [
    '2026-09-10', '2026-09-11', '2026-09-12', '2026-09-13', '2026-09-14',
  ]);

  // ------------------------------------------------------------ tables de juin
  const tablesJuin = new Map<string, bigint>();
  for (const t of TABLES_JUIN) {
    const plaqueId = plaques.get(t.plaque);
    if (!plaqueId) throw new Error(`Table ${t.libelleSource} : plaque "${t.plaque}" inconnue`);

    const session = await prisma.sessionPlaque.findUnique({
      where: { campagneId_plaqueId: { campagneId: juin.id, plaqueId } },
    });
    if (!session) throw new Error(`Table ${t.libelleSource} : session introuvable`);

    const table = await prisma.tablePhoning.upsert({
      where: {
        sessionPlaqueId_libelle: { sessionPlaqueId: session.id, libelle: t.libelle },
      },
      update: { ordre: t.ordre, chefUtilisateurId: chefs.get(t.chef) ?? null },
      create: {
        sessionPlaqueId: session.id,
        libelle: t.libelle,
        ordre: t.ordre,
        chefUtilisateurId: chefs.get(t.chef) ?? null,
      },
    });
    tablesJuin.set(t.libelleSource, table.id);
  }

  // ------------------------------------------------------------ affectations
  // `origine: 'manuel'` : cette composition vient du fichier Excel, donc d'un
  // arbitrage humain, pas de l'algorithme de repartition.
  let affectees = 0;
  for (const a of AFFECTATIONS_JUIN) {
    const tableId = tablesJuin.get(a.tableSource);
    const vendeurId = vendeurs.get(a.vendeur);
    if (!tableId) throw new Error(`Affectation : table "${a.tableSource}" introuvable`);
    if (!vendeurId) throw new Error(`Affectation : vendeur "${a.vendeur}" introuvable`);

    await prisma.affectation.upsert({
      where: { tableId_vendeurId: { tableId, vendeurId } },
      // Reactivation plutot que recreation : desarchiver la ligne existante.
      update: { archiveLe: null, origine: 'manuel' },
      create: { tableId, vendeurId, origine: 'manuel' },
    });
    affectees++;
  }

  // ------------------------------------------------------------ compte rendu
  const compte = async (n: string, p: Promise<number>) => `${n.padEnd(16)}${await p}`;
  console.log('\nSeed termine.\n');
  console.log(await compte('marques', prisma.marque.count()));
  console.log(await compte('plaques', prisma.plaque.count()));
  console.log(await compte('sites', prisma.site.count()));
  console.log(await compte('vendeurs', prisma.vendeur.count()));
  console.log(await compte('vendeur_marque', prisma.vendeurMarque.count()));

  console.log(await compte('utilisateurs', prisma.utilisateur.count()));
  console.log(await compte('campagnes', prisma.campagne.count()));
  console.log(await compte('jours', prisma.campagneJour.count()));
  console.log(await compte('creneaux', prisma.campagneCreneau.count()));
  console.log(await compte('sessions', prisma.sessionPlaque.count()));
  console.log(await compte('tables', prisma.tablePhoning.count()));
  console.log(await compte('affectations', prisma.affectation.count()));

  // On n'annonce le mot de passe genere QUE si des comptes ont reellement ete
  // crees. `upsert` avec `update: {}` ne touche pas les mots de passe existants —
  // c'est voulu, un rejeu du seed ne doit pas reinitialiser les acces — mais
  // afficher un mot de passe qui ne fonctionne pour personne est trompeur.
  if (motDePasseGenere && comptesCrees > 0) {
    console.log(
      `\n  ${comptesCrees} compte(s) cree(s), mot de passe : ${motDePasseClair}` +
        `\n  A noter maintenant : il n'est affiche qu'une fois et n'est stocke nulle part.`
    );
  } else if (motDePasseGenere) {
    console.log(
      `\n  Aucun compte cree : les mots de passe existants sont INCHANGES.` +
        `\n  Pour en changer un : MOT_DE_PASSE="..." npm --prefix backend run mot-de-passe -- admin`
    );
  }

  const vn = await prisma.vendeur.count({ where: { dateSortie: null, typeVehicule: 'VN' } });
  const vo = await prisma.vendeur.count({ where: { dateSortie: null, typeVehicule: 'VO' } });

  console.log(`\n  METIERS : ${vn} VN / ${vo} VO — donnee REELLE, lue dans l'onglet RESULTATS.`);
  console.log(
    `\n  MARQUES : celles du SITE (Alpine pour le site Alpine, Renault + Dacia ailleurs).` +
      `\n  Le fichier source ne dit pas si un vendeur donne est restreint a une seule des` +
      `\n  deux : ses colonnes REN et DAC donnent une ACTIVITE, pas une autorisation. Les` +
      `\n  restreindre vendeur par vendeur se fait depuis l'ecran Vendeurs, et c'est ce qui` +
      `\n  donne du mordant a R-C.1.`
  );
  console.log(`\n  ${affectees} affectations de juin 2026 reprises du fichier Excel.\n`);
}

main()
  .catch((e) => {
    console.error('\nSEED EN ECHEC\n');
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
