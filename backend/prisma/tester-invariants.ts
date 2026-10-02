// ============================================================================
// TEST DES INVARIANTS — les listes de valeurs, TypeScript contre PostgreSQL.
//
// POURQUOI CE FICHIER A CHANGE DE PLACE. Ce controle vivait dans
// `src/utils/verifierInvariants.ts` et s'executait AU DEMARRAGE DU SERVEUR
// Express : ajouter une valeur d'un seul cote empechait `npm run dev` de
// demarrer, dans la session ou la faute etait commise. C'etait le bon endroit.
//
// **Il n'y a plus de serveur.** Le front est statique, il attaque Supabase en
// direct : plus rien ne demarre, donc plus rien ne verifiait. L'interdit n.6 —
// « aucune liste de valeurs dupliquee sans controle automatique » — etait devenu
// une intention, exactement ce que ce projet refuse partout ailleurs.
//
// Le controle devient donc une SUITE, jouee comme les quatre autres et en CI par
// `.github/workflows/invariants.yml`. Il perd l'immediatete du demarrage et gagne
// de tourner sur les DEUX bases, ce que le serveur ne faisait pas : une
// contrainte peut diverger en production sans avoir bouge en local.
//
// Il est ici, dans `prisma/`, et non plus dans `src/utils/` : c'est la convention
// du projet. Les suites qui TOUCHENT LA BASE vivent dans `prisma/`
// (`tester-garde-fous`, `tester-rls`, `tester-agregats`, `comparer-bases`) ;
// celles qui n'eprouvent que des fonctions pures vivent a cote de leur code, en
// `*.verif.ts`.
//
// ---------------------------------------------------------------------------
// TROIS FAMILLES, ET LA TROISIEME EST CELLE QUI TIENT LES DEUX AUTRES
// ---------------------------------------------------------------------------
//
//   A. Les 7 contraintes CHECK contre les 6 listes de valeurs de `auth/roles.ts`.
//      C'est le controle historique, repris a l'identique.
//
//   B. Les 2 listes de PALIERS contre les fonctions SQL qui les transcrivent.
//      Duplication NOUVELLE, nee de la bascule vers la RLS : `peut_administrer()`
//      et `peut_gerer_utilisateurs()` reecrivent en SQL ce que
//      `ROLES_ADMINISTRATION_REFERENTIELS` et `ROLES_GESTION_COMPTES` disent en
//      TypeScript. C'est la frontiere qui empeche `direction` de se promouvoir
//      `admin` : elle ne doit pas pouvoir s'elargir d'un seul cote.
//
//   C. LA COUVERTURE. Toute liste exportee par `auth/roles.ts` doit etre citee
//      en A ou en B. Sans ce controle, ajouter une SEPTIEME liste passerait
//      inapercu : le fichier serait vert en ne verifiant rien de la nouveaute.
//      Un garde-fou qui ne se met pas a jour tout seul finit par ne garder que
//      ce qui n'a pas bouge.
//
// Usage : npm --prefix backend run test:invariants
// ============================================================================

import { PrismaClient } from '@prisma/client';
import * as roles from '../src/auth/roles';
import {
  ROLES_ENCADREMENT,
  ROLES_GLOBAUX,
  ROLES_CAMPAGNE,
  MODES_SESSION,
  TYPES_VEHICULE,
  ORIGINES_AFFECTATION,
  SOURCES_RDV,
  ISSUES_SUIVI,
  ACTIONS_JOURNAL,
  ROLES_GESTION_COMPTES,
  ROLES_ADMINISTRATION_REFERENTIELS,
} from '../src/auth/roles';

const prisma = new PrismaClient();

const resultats: { nom: string; ok: boolean; detail: string }[] = [];
const constate = (nom: string, ok: boolean, detail: string) =>
  resultats.push({ nom, ok, detail });

// ---------------------------------------------------------------------------
// A — les contraintes CHECK
// ---------------------------------------------------------------------------

interface Attendu {
  contrainte: string;
  liste: readonly string[];
  nomListe: string;
}

const CHECKS: Attendu[] = [
  { contrainte: 'role_global_role_check', liste: ROLES_GLOBAUX, nomListe: 'ROLES_GLOBAUX' },
  {
    contrainte: 'encadrement_site_role_check',
    liste: ROLES_ENCADREMENT,
    nomListe: 'ROLES_ENCADREMENT',
  },
  { contrainte: 'role_campagne_role_check', liste: ROLES_CAMPAGNE, nomListe: 'ROLES_CAMPAGNE' },
  { contrainte: 'session_plaque_mode_check', liste: MODES_SESSION, nomListe: 'MODES_SESSION' },
  { contrainte: 'rdv_type_vehicule_check', liste: TYPES_VEHICULE, nomListe: 'TYPES_VEHICULE' },
  { contrainte: 'vendeur_type_check', liste: TYPES_VEHICULE, nomListe: 'TYPES_VEHICULE' },
  {
    contrainte: 'affectation_origine_check',
    liste: ORIGINES_AFFECTATION,
    nomListe: 'ORIGINES_AFFECTATION',
  },
  { contrainte: 'rdv_source_check', liste: SOURCES_RDV, nomListe: 'SOURCES_RDV' },
  { contrainte: 'rdv_suivi_issue_check', liste: ISSUES_SUIVI, nomListe: 'ISSUES_SUIVI' },
  { contrainte: 'journal_compte_action_check', liste: ACTIONS_JOURNAL, nomListe: 'ACTIONS_JOURNAL' },
];

/// Extrait les litteraux d'une definition de contrainte.
/// PostgreSQL rend `role IN ('admin','lecteur')` sous la forme
/// `CHECK ((role = ANY (ARRAY['admin'::text, 'lecteur'::text])))`.
const litterauxCheck = (definition: string): Set<string> =>
  new Set([...definition.matchAll(/'([^']*)'::text/g)].map((m) => m[1]!));

const memesElements = (enBase: Set<string>, code: readonly string[]): boolean =>
  enBase.size === code.length && code.every((v) => enBase.has(v));

async function familleChecks(): Promise<void> {
  const lignes = await prisma.$queryRaw<{ conname: string; def: string }[]>`
    SELECT c.conname::text AS conname, pg_get_constraintdef(c.oid) AS def
    FROM pg_constraint c
    JOIN pg_class     t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'relance' AND c.contype = 'c'
  `;
  const parNom = new Map(lignes.map((l) => [l.conname, l.def]));

  for (const attendu of CHECKS) {
    const nom = `A  ${attendu.nomListe} = ${attendu.contrainte}`;
    const definition = parNom.get(attendu.contrainte);

    if (!definition) {
      constate(
        nom,
        false,
        `contrainte absente de la base — la migration \`invariants\` n'a pas ete ` +
          `appliquee, ou la contrainte a ete supprimee`
      );
      continue;
    }

    const enBase = litterauxCheck(definition);
    if (memesElements(enBase, attendu.liste)) {
      constate(nom, true, `[${attendu.liste.join(', ')}]`);
    } else {
      constate(
        nom,
        false,
        `code = [${attendu.liste.join(', ')}] mais base = [${[...enBase].join(', ')}]`
      );
    }
  }
}

// ---------------------------------------------------------------------------
// B — les paliers, contre les fonctions SQL qui les transcrivent
// ---------------------------------------------------------------------------

interface Palier {
  fonction: string;
  liste: readonly string[];
  nomListe: string;
}

const PALIERS: Palier[] = [
  {
    fonction: 'peut_administrer',
    liste: ROLES_ADMINISTRATION_REFERENTIELS,
    nomListe: 'ROLES_ADMINISTRATION_REFERENTIELS',
  },
  {
    fonction: 'peut_gerer_utilisateurs',
    liste: ROLES_GESTION_COMPTES,
    nomListe: 'ROLES_GESTION_COMPTES',
  },
];

/// Les deux fonctions sont ecrites comme une disjonction d'appels a
/// `a_role_global('<role>')`. On lit donc leur source et on releve les roles
/// cites. Si quelqu'un les reecrit dans un autre style — un `IN`, une jointure —
/// ce controle rendra un ensemble vide et passera au ROUGE plutot qu'au vert :
/// c'est le bon sens de l'echec. Un garde-fou qui ne sait plus lire ce qu'il
/// garde doit le dire, pas se taire.
const rolesCites = (source: string): Set<string> =>
  new Set([...source.matchAll(/a_role_global\(\s*'([^']*)'\s*\)/g)].map((m) => m[1]!));

async function famillePaliers(): Promise<void> {
  for (const palier of PALIERS) {
    const nom = `B  ${palier.nomListe} = relance.${palier.fonction}()`;

    const lignes = await prisma.$queryRaw<{ def: string }[]>`
      SELECT pg_get_functiondef(p.oid) AS def
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'relance' AND p.proname = ${palier.fonction}
    `;

    if (lignes.length === 0) {
      constate(nom, false, 'fonction absente de la base — la migration du portail manque');
      continue;
    }

    const enBase = rolesCites(lignes[0]!.def);
    if (enBase.size === 0) {
      constate(
        nom,
        false,
        `aucun appel a \`a_role_global('...')\` trouve dans la source : la fonction ` +
          `a ete reecrite dans un style que ce controle ne sait pas lire. ` +
          `Adapter \`rolesCites\` plutot que de retirer le controle.`
      );
      continue;
    }

    if (memesElements(enBase, palier.liste)) {
      constate(nom, true, `[${palier.liste.join(', ')}]`);
    } else {
      constate(
        nom,
        false,
        `code = [${palier.liste.join(', ')}] mais fonction = [${[...enBase].join(', ')}]`
      );
    }
  }
}

// ---------------------------------------------------------------------------
// C — la couverture
// ---------------------------------------------------------------------------

/// Les listes citees en A ou en B. C'est a cet ensemble qu'on compare les
/// exports reels du module.
const COUVERTES = new Set([
  ...CHECKS.map((c) => c.nomListe),
  ...PALIERS.map((p) => p.nomListe),
]);

function familleCouverture(): void {
  const exportees = Object.entries(roles)
    .filter(
      ([, valeur]) =>
        Array.isArray(valeur) && valeur.every((v: unknown) => typeof v === 'string')
    )
    .map(([nom]) => nom)
    .sort();

  const orphelines = exportees.filter((nom) => !COUVERTES.has(nom));

  constate(
    `C  couverture de auth/roles.ts (${exportees.length} listes exportees)`,
    orphelines.length === 0,
    orphelines.length === 0
      ? `toutes citees : ${exportees.join(', ')}`
      : `AUCUN CONTROLE ne porte sur : ${orphelines.join(', ')}. ` +
        `Ajouter l'entree correspondante dans CHECKS ou PALIERS ci-dessus, ` +
        `en meme temps que la contrainte ou la fonction SQL qui la transcrit.`
  );
}

// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const [{ base }] = await prisma.$queryRaw<{ base: string }[]>`
    SELECT current_database() || ' @ ' || coalesce(inet_server_addr()::text, 'local') AS base
  `;
  console.log(`Invariants — ${base}`);

  await familleChecks();
  await famillePaliers();
  familleCouverture();

  const largeur = Math.max(...resultats.map((r) => r.nom.length));
  console.log('');
  for (const r of resultats) {
    console.log(`${r.ok ? 'OK  ' : 'ECHEC'} ${r.nom.padEnd(largeur)}  ${r.detail}`);
  }

  const echecs = resultats.filter((r) => !r.ok).length;
  console.log(`\n${resultats.length - echecs}/${resultats.length} invariants verifies.`);

  if (echecs > 0) {
    console.log(
      '\nINVARIANTS DIVERGENTS entre le code et la base.\n' +
        'Ajouter la valeur des DEUX cotes : dans `backend/src/auth/roles.ts` ET dans une\n' +
        'nouvelle migration Prisma qui remplace la contrainte CHECK ou la fonction.\n' +
        'Voir ETAT-BACKEND.md, section Invariants.'
    );
    process.exit(1);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
