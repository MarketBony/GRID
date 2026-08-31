import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { prisma } from '../src/db';
import { chargerDroits, vendeursSaisissables } from '../src/auth/campagneScope';

// ============================================================================
// COMPTES DE TEST — un compte par PERIMETRE, pour eprouver les vues ET la saisie.
//
// Pourquoi un script et pas trois lignes de SQL : les droits de cet outil sont
// PAR CAMPAGNE, et c'est justement ce qui est penible a mettre en place a la
// main. Etre chef de table en juin ne donne aucun droit en septembre. Un compte
// par perimetre, documente et rejouable, evite de re-decouvrir cette regle a
// chaque essai.
//
// IDEMPOTENT : rejouable sans dupliquer ni casser. Chaque execution remet le mot
// de passe a la valeur courante — ce sont des comptes jetables.
//
// LE MOT DE PASSE vient de la variable d'environnement `MOT_DE_PASSE`. Sans
// elle, il est tire au hasard et affiche une fois. Jamais en argument de ligne de
// commande : les arguments d'un processus sont lisibles par les autres processus
// de la machine et atterrissent dans l'historique du terminal.
//
// AUCUN DE CES COMPTES NE DOIT EXISTER SUR LE SERVEUR. Le suffixe `.test` est la
// pour qu'ils sautent aux yeux dans la liste des utilisateurs.
//
// LE CHEF DE TABLE N'EST PAS UN COMPTE CREE ICI, et c'est deliberé :
//   - le droit de chef de table n'est pas un role, c'est
//     `table_phoning.chef_utilisateur_id` ;
//   - le seed ecrit cette colonne depuis le fichier source a chaque passage, donc
//     y greffer un compte de test serait efface au prochain `npm run seed` ;
//   - fabriquer une table de test demanderait d'inventer des affectations, ce qui
//     fausserait les totaux que la recette doit retrouver a l'unite.
// On se contente donc d'aligner le mot de passe d'un VRAI chef de table, celui
// que le seed a cree depuis le fichier. C'est le seul compte non-`.test` que ce
// script touche, et il ne touche que son mot de passe.
// ============================================================================

const MDP = process.env.MOT_DE_PASSE ?? randomBytes(9).toString('base64url');
const GENERE = !process.env.MOT_DE_PASSE;

/// Comptes REELS dont on aligne seulement le mot de passe. Ce ne sont pas des
/// fixtures : le seed les a crees, avec un mot de passe tire au hasard que
/// personne n'a garde.
///
///   `admin`   — l'administrateur du seed ;
///   `sbesson` — chef de la Table 1 de CENTRE sur Juin 2026, donc LE seul moyen
///               d'eprouver le perimetre << table >> aujourd'hui.
///
/// Les aligner sur le meme mot de passe rend aussi la suite API executable :
/// elle se connecte avec `admin` ET `sbesson`, et n'accepte qu'un mot de passe.
const COMPTES_REELS = ['admin', 'sbesson'] as const;
const CHEF_DE_TABLE_REEL = 'sbesson';

type Compte =
  | { loginId: string; nom: string; role: 'admin' }
  | { loginId: string; nom: string; role: 'direction' }
  | { loginId: string; nom: string; role: 'chef_plaque'; campagne: string; plaque: string }
  | { loginId: string; nom: string; role: 'chef_site'; campagne: string; site: string }
  /// ENCADRANT : aucun role global. Ses droits viennent de ses rattachements, et
  /// c'est le palier qui fait tourner l'exercice — un chef de vente rattache a
  /// deux concessions, qui peut animer la table d'une troisieme.
  | {
      loginId: string;
      nom: string;
      role: 'encadrant';
      rattachements: { site: string; roleEncadrement: string }[];
    };

const COMPTES: Compte[] = [
  { loginId: 'admin.test', nom: 'ADMIN — test', role: 'admin' },
  { loginId: 'direction.test', nom: 'DIRECTION — test', role: 'direction' },
  {
    loginId: 'encadrant.test',
    nom: 'ENCADRANT — test',
    role: 'encadrant',
    // DEUX sites, et de deux natures differentes : c'est le cas reel d'un chef de
    // vente qui couvre plusieurs concessions.
    rattachements: [
      { site: 'CLF', roleEncadrement: 'chef_de_site' },
      { site: 'MOZ', roleEncadrement: 'chef_de_vente_vn' },
    ],
  },
  {
    loginId: 'chef.plaque.test',
    nom: 'CHEF DE PLAQUE — test',
    role: 'chef_plaque',
    campagne: 'Septembre 2026',
    plaque: 'CENTRE',
  },
  {
    loginId: 'chef.site.test',
    nom: 'CHEF DE SITE — test',
    role: 'chef_site',
    campagne: 'Septembre 2026',
    site: 'CLF',
  },
];

async function main() {
  const hash = await bcrypt.hash(MDP, 10);
  const resume: { login: string; role: string; vendeurs: number }[] = [];

  for (const c of COMPTES) {
    const u = await prisma.utilisateur.upsert({
      where: { loginId: c.loginId },
      create: { loginId: c.loginId, nom: c.nom, passwordHash: hash, actif: true },
      update: { nom: c.nom, passwordHash: hash, actif: true, archiveLe: null },
      select: { id: true },
    });

    if (c.role === 'admin' || c.role === 'direction') {
      // Un seul role global par compte : les paliers sont exclusifs.
      await prisma.roleGlobal.deleteMany({ where: { utilisateurId: u.id } });
      await prisma.roleGlobal.create({ data: { utilisateurId: u.id, role: c.role } });
      resume.push({
        login: c.loginId,
        role:
          c.role === 'admin'
            ? 'admin — tout, y compris la gestion des comptes'
            : 'direction — tout SAUF la gestion des comptes',
        vendeurs: await compterViaLePortail(u.id, 'Septembre 2026'),
      });
      continue;
    }

    if (c.role === 'encadrant') {
      // Aucun role global : ses droits viennent des rattachements.
      await prisma.roleGlobal.deleteMany({ where: { utilisateurId: u.id } });
      for (const r of c.rattachements) {
        const site = await prisma.site.findFirstOrThrow({
          where: { code: r.site },
          select: { id: true },
        });
        await prisma.encadrementSite.upsert({
          where: { siteId_role: { siteId: site.id, role: r.roleEncadrement } },
          update: { utilisateurId: u.id, archiveLe: null },
          create: { siteId: site.id, role: r.roleEncadrement, utilisateurId: u.id },
        });
      }
      resume.push({
        login: c.loginId,
        role: `encadrant — ${c.rattachements.map((r) => `${r.roleEncadrement} ${r.site}`).join(', ')}`,
        vendeurs: await compterViaLePortail(u.id, 'Septembre 2026'),
      });
      continue;
    }

    const campagne = await prisma.campagne.findUnique({
      where: { libelle: c.campagne },
      select: { id: true, dateDebut: true, dateFin: true },
    });
    if (!campagne) throw new Error(`Campagne « ${c.campagne} » introuvable. Lancer le seed.`);

    const plaqueId = c.role === 'chef_plaque' ? await plaqueParLibelle(c.plaque) : null;
    const siteId = c.role === 'chef_site' ? await siteParCode(c.site) : null;

    // `role_campagne` n'a pas d'unique composite : on cherche par la CLE METIER
    // avant de creer, sinon un rejeu empilerait les roles en silence.
    const existant = await prisma.roleCampagne.findFirst({
      where: { campagneId: campagne.id, utilisateurId: u.id, role: c.role, plaqueId, siteId },
      select: { id: true },
    });

    if (existant) {
      // Interdit n.1 : on ne supprime pas, on desarchive.
      await prisma.roleCampagne.update({ where: { id: existant.id }, data: { archiveLe: null } });
    } else {
      await prisma.roleCampagne.create({
        data: { campagneId: campagne.id, utilisateurId: u.id, role: c.role, plaqueId, siteId },
      });
    }

    resume.push({
      login: c.loginId,
      role: `${c.role} ${c.role === 'chef_plaque' ? c.plaque : c.site} — ${c.campagne}`,
      vendeurs: await compterViaLePortail(u.id, c.campagne),
    });
  }

  // ------------------------------------------------- comptes reels : mot de passe seul
  for (const loginId of COMPTES_REELS) {
    const u = await prisma.utilisateur.findUnique({ where: { loginId }, select: { id: true } });
    if (!u) {
      console.warn(`  ATTENTION : le compte « ${loginId} » est introuvable. Lancer le seed.`);
      continue;
    }
    await prisma.utilisateur.update({
      where: { id: u.id },
      data: { passwordHash: hash, actif: true, archiveLe: null },
    });
  }

  const chef = await prisma.utilisateur.findUnique({
    where: { loginId: CHEF_DE_TABLE_REEL },
    select: {
      id: true,
      nom: true,
      tablesAnimees: {
        where: { archiveLe: null },
        select: {
          libelle: true,
          _count: { select: { affectations: true } },
          sessionPlaque: {
            select: { plaque: { select: { libelle: true } }, campagne: { select: { libelle: true } } },
          },
        },
      },
    },
  });

  if (!chef) {
    console.warn(
      `\n  ATTENTION : le compte « ${CHEF_DE_TABLE_REEL} » est introuvable. Lancer le seed.\n` +
        '  Les comptes de test ci-dessous sont poses, mais aucun chef de table.'
    );
  } else {
    for (const t of chef.tablesAnimees) {
      resume.push({
        login: CHEF_DE_TABLE_REEL,
        role: `chef de ${t.libelle} de ${t.sessionPlaque.plaque.libelle} — ${t.sessionPlaque.campagne.libelle}`,
        vendeurs: await compterViaLePortail(chef.id, t.sessionPlaque.campagne.libelle),
      });
    }
  }

  const largeur = Math.max(...resume.map((r) => r.login.length));
  console.log('\nCOMPTES DE TEST — mot de passe commun\n');
  for (const r of resume) {
    console.log(`  ${r.login.padEnd(largeur)}  ${r.role}`);
    console.log(`  ${' '.repeat(largeur)}  ${r.vendeurs} vendeurs saisissables`);
  }

  console.log(`\n  Mot de passe : ${MDP}`);
  if (GENERE) {
    console.log('  Tire au hasard, affiche UNE FOIS. Pour en imposer un :');
    console.log('    $env:MOT_DE_PASSE = "..." ; npm run comptes-test');
  }
  const reels = COMPTES_REELS.map((l) => `« ${l} »`).join(' et ');
  console.log('');
  console.log(
    `  ${COMPTES.length} comptes de DEVELOPPEMENT (suffixe « .test »), a ne jamais poser sur le`
  );
  console.log(`  serveur. ${reels} sont des comptes REELS issus du seed : seul leur mot de`);
  console.log('  passe a ete aligne, leurs droits sont inchanges.');
  console.log('');
  console.log('  Ce mot de passe est aussi celui de la suite API :');
  console.log(`    $env:SEED_MOT_DE_PASSE = "${MDP}" ; npm run test:api`);
  console.log('');
}

/// Le chiffre affiche passe par LE PORTAIL, pas par une clause recopiee. Deux
/// raisons : il dit ce que le compte verra vraiment a l'ecran, et il echoue ici
/// plutot qu'en session si le portail cesse d'accorder ce qu'on attend.
const compterViaLePortail = async (utilisateurId: bigint, libelleCampagne: string) => {
  const c = await prisma.campagne.findUnique({
    where: { libelle: libelleCampagne },
    select: { id: true },
  });
  if (!c) throw new Error(`Campagne « ${libelleCampagne} » introuvable.`);
  const droits = await chargerDroits(utilisateurId.toString());
  const set = await vendeursSaisissables(droits, c.id.toString());
  if (set.size === 0) {
    throw new Error(
      `Le compte n'a AUCUN vendeur saisissable sur « ${libelleCampagne} » apres pose de ses ` +
        'droits. Un compte de test sans perimetre afficherait un ecran vide : on refuse de le livrer.'
    );
  }
  return set.size;
};

const plaqueParLibelle = async (libelle: string) => {
  const p = await prisma.plaque.findFirst({ where: { libelle }, select: { id: true } });
  if (!p) throw new Error(`Plaque « ${libelle} » introuvable.`);
  return p.id;
};

const siteParCode = async (code: string) => {
  const s = await prisma.site.findFirst({ where: { code }, select: { id: true } });
  if (!s) throw new Error(`Site « ${code} » introuvable.`);
  return s.id;
};

main()
  .catch((e) => {
    console.error(`\nECHEC : ${e instanceof Error ? e.message : e}\n`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
