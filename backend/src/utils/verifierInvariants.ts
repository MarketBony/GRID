import { prisma } from '../db';
import {
  ROLES_ENCADREMENT,
  ROLES_GLOBAUX,
  ROLES_CAMPAGNE,
  MODES_SESSION,
  TYPES_VEHICULE,
  ORIGINES_AFFECTATION,
} from '../auth/roles';

// ============================================================================
// GARDE-FOU — les listes de valeurs sont DUPLIQUEES entre TypeScript et la base.
//
// `auth/roles.ts` porte les listes valides ; la migration `invariants` porte les
// memes listes en contraintes CHECK. La duplication est inevitable : PostgreSQL
// ne peut pas importer du TypeScript.
//
// Ce qui n'est PAS inevitable, c'est de la laisser << a synchroniser a la main >>.
// C'est exactement l'oubli silencieux que `scripts/check-plaques-sync.mjs`
// combat sur GEARBOX, ou une carte des plaques vit dans `constants.ts` ET dans
// `siteScope.ts` : un site ajoute d'un seul cote fausse un perimetre sans lever
// la moindre erreur, et personne ne s'en apercoit avant qu'un responsable de
// concession signale des chiffres incoherents.
//
// Ici le controle est AUTOMATIQUE et se fait AU DEMARRAGE DU SERVEUR, donc a
// chaque `npm run dev` et a chaque demarrage de conteneur — c'est-a-dire dans la
// session ou la faute est commise. Ajouter une valeur d'un seul cote empeche le
// serveur de demarrer, avec le nom de la liste en cause.
//
// Difference avec GEARBOX, volontaire : pas de script separe a penser a lancer,
// pas de branchement `predev`/`prebuild` a maintenir. Le controle est dans le
// chemin de demarrage, il ne peut pas etre contourne par oubli.
// ============================================================================

interface Attendu {
  contrainte: string;
  liste: readonly string[];
  nomListe: string;
}

const ATTENDUS: Attendu[] = [
  { contrainte: 'role_global_role_check', liste: ROLES_GLOBAUX, nomListe: 'ROLES_GLOBAUX' },
  {
    contrainte: 'encadrement_site_role_check',
    liste: ROLES_ENCADREMENT,
    nomListe: 'ROLES_ENCADREMENT',
  },
  { contrainte: 'role_campagne_role_check', liste: ROLES_CAMPAGNE, nomListe: 'ROLES_CAMPAGNE' },
  { contrainte: 'session_plaque_mode_check', liste: MODES_SESSION, nomListe: 'MODES_SESSION' },
  { contrainte: 'rdv_type_vehicule_check', liste: TYPES_VEHICULE, nomListe: 'TYPES_VEHICULE' },
  {
    contrainte: 'vendeur_type_check',
    liste: TYPES_VEHICULE,
    nomListe: 'TYPES_VEHICULE',
  },
  {
    contrainte: 'affectation_origine_check',
    liste: ORIGINES_AFFECTATION,
    nomListe: 'ORIGINES_AFFECTATION',
  },
];

interface LigneContrainte {
  conname: string;
  def: string;
}

/// Extrait les litteraux d'une definition de contrainte.
/// PostgreSQL rend `role IN ('admin','lecteur')` sous la forme
/// `CHECK ((role = ANY (ARRAY['admin'::text, 'lecteur'::text])))`.
const litteraux = (definition: string): Set<string> => {
  const trouves = definition.matchAll(/'([^']*)'::text/g);
  return new Set([...trouves].map((m) => m[1]));
};

const memesElements = (a: Set<string>, b: readonly string[]): boolean =>
  a.size === b.length && b.every((v) => a.has(v));

/// A appeler au demarrage, AVANT d'ecouter sur le port. Leve si la base et le
/// code divergent : mieux vaut un serveur qui refuse de demarrer qu'un serveur
/// qui accepte une valeur que l'autre moitie du systeme rejettera.
export async function verifierInvariants(): Promise<void> {
  const lignes = await prisma.$queryRaw<LigneContrainte[]>`
    SELECT c.conname::text AS conname, pg_get_constraintdef(c.oid) AS def
    FROM pg_constraint c
    JOIN pg_class     t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'relance' AND c.contype = 'c'
  `;

  const parNom = new Map(lignes.map((l) => [l.conname, l.def]));
  const problemes: string[] = [];

  for (const attendu of ATTENDUS) {
    const definition = parNom.get(attendu.contrainte);

    if (!definition) {
      problemes.push(
        `contrainte ${attendu.contrainte} absente de la base — la migration ` +
          `\`invariants\` n'a pas ete appliquee, ou la contrainte a ete supprimee.`
      );
      continue;
    }

    const enBase = litteraux(definition);
    if (!memesElements(enBase, attendu.liste)) {
      problemes.push(
        `${attendu.nomListe} (auth/roles.ts) = [${attendu.liste.join(', ')}] ` +
          `mais ${attendu.contrainte} (base) = [${[...enBase].join(', ')}]`
      );
    }
  }

  if (problemes.length > 0) {
    throw new Error(
      'INVARIANTS DIVERGENTS entre le code et la base :\n' +
        problemes.map((p) => `  - ${p}`).join('\n') +
        '\n\nAjouter la valeur des DEUX cotes : dans `backend/src/auth/roles.ts` et ' +
        'dans une nouvelle migration Prisma qui remplace la contrainte CHECK.\n' +
        'Voir ETAT-BACKEND.md, section Invariants.'
    );
  }
}
