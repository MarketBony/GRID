// ============================================================================
// COMPARER DEUX BASES, OBJET PAR OBJET.
//
// « Contrôler ce qui est réellement arrivé, pas ce qui était prévu. »
// `prisma migrate deploy` dit « All migrations have been successfully applied »
// dès que les fichiers ont été joués sans lever d'exception. Ça ne prouve pas que
// les deux bases se ressemblent : un `CREATE TRIGGER` dans une migration jouée
// deux fois, un objet créé à la main d'un côté, une extension absente de l'autre
// passeraient tous les trois inaperçus.
//
// Ce script relève l'inventaire des deux bases et affiche les ÉCARTS. Il ne
// modifie rien, ne lit que le catalogue système, et peut donc tourner sur la
// production sans précaution.
//
// Usage :
//   set -a; . ./backend/.env.supabase; set +a
//   npm --prefix backend run comparer -- "<url de reference>"
//
// L'URL de référence est passée en argument (la base LOCALE en pratique) ; la
// base comparée est celle de `DATABASE_URL`, donc celle sur laquelle le reste de
// l'outillage travaille. On compare toujours « la cible par rapport à la
// référence », dans ce sens-là.
// ============================================================================

import { PrismaClient } from '@prisma/client';

const REQUETES: { nom: string; sql: string }[] = [
  {
    nom: 'tables',
    sql: `select tablename || (case when rowsecurity then ' [RLS]' else ' [SANS RLS]' end) as e
          from pg_tables where schemaname = 'relance' order by 1`,
  },
  {
    nom: 'colonnes',
    sql: `select table_name || '.' || column_name || ' ' || data_type as e
          from information_schema.columns where table_schema = 'relance' order by 1`,
  },
  {
    nom: 'contraintes CHECK',
    sql: `select conname as e from pg_constraint c
          join pg_namespace n on n.oid = c.connamespace
          where n.nspname = 'relance' and c.contype = 'c' order by 1`,
  },
  {
    nom: 'triggers',
    sql: `select c.relname || '.' || t.tgname as e
          from pg_trigger t
          join pg_class c on c.oid = t.tgrelid
          join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'relance' and not t.tgisinternal order by 1`,
  },
  {
    nom: 'fonctions',
    sql: `select p.proname || (case when p.prosecdef then ' [definer]' else ' [invoker]' end) as e
          from pg_proc p join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'relance' order by 1`,
  },
  {
    nom: 'vues',
    sql: `select viewname as e from pg_views where schemaname = 'relance' order by 1`,
  },
  {
    nom: 'politiques RLS',
    sql: `select tablename || '.' || policyname || ' (' || cmd || ')' as e
          from pg_policies where schemaname = 'relance' order by 1`,
  },
  {
    nom: 'index',
    sql: `select indexname as e from pg_indexes where schemaname = 'relance' order by 1`,
  },
  {
    nom: 'migrations appliquees',
    sql: `select migration_name as e from relance."_prisma_migrations"
          where finished_at is not null order by 1`,
  },
];

/// LES DIFFERENCES ATTENDUES, DECLAREES UNE PAR UNE.
///
/// Une difference legitime qui s'affiche en ECART a chaque execution finit par
/// etre ignoree — et c'est ainsi qu'on rate la vraie. On les nomme donc ici, avec
/// leur motif : ce qui n'est pas dans cette liste est un ecart, point.
const ATTENDUS: { objet: string; ou: 'reference' | 'cible'; motif: string }[] = [
  {
    objet: 'rdv.rdv_diffusion',
    ou: 'cible',
    motif:
      "le trigger de diffusion temps reel n'est pose que la ou `realtime.send` existe. " +
      'Sur un PostgreSQL nu il echouerait a chaque ecriture de RDV — donc pendant le seed ' +
      'et pendant les suites. Voir la migration 20260831220000.',
  },
];

const inventaire = async (client: PrismaClient) => {
  const resultat = new Map<string, string[]>();
  for (const r of REQUETES) {
    const lignes = await client.$queryRawUnsafe<{ e: string }[]>(r.sql);
    resultat.set(r.nom, lignes.map((l) => l.e));
  }
  return resultat;
};

async function main() {
  const urlReference = process.argv[2];
  if (!urlReference) {
    console.error('Usage : npm --prefix backend run comparer -- "<url de la base de reference>"');
    process.exit(1);
  }

  const reference = new PrismaClient({ datasources: { db: { url: urlReference } } });
  const cible = new PrismaClient();

  // Dire OU l'on est avant de comparer quoi que ce soit. Une comparaison entre
  // une base et elle-meme serait verte et ne prouverait rien.
  const ou = async (c: PrismaClient) => {
    const r = await c.$queryRawUnsafe<{ h: string }[]>(
      `select coalesce(inet_server_addr()::text, 'local') || ' · ' ||
              (case when exists (select 1 from pg_roles where rolname = 'supabase_admin')
                    then 'Supabase' else 'PostgreSQL nu' end) as h`
    );
    return r[0].h;
  };
  console.log(`reference : ${await ou(reference)}`);
  console.log(`cible     : ${await ou(cible)}\n`);

  const a = await inventaire(reference);
  const b = await inventaire(cible);

  let ecarts = 0;
  for (const { nom } of REQUETES) {
    const ref = a.get(nom)!;
    const cib = b.get(nom)!;
    const attendu = (objet: string, ou: 'reference' | 'cible') =>
      ATTENDUS.find((a) => a.objet === objet && a.ou === ou);

    const manquants = ref.filter((x) => !cib.includes(x) && !attendu(x, 'reference'));
    const enTrop = cib.filter((x) => !ref.includes(x) && !attendu(x, 'cible'));
    const tolerees = [
      ...ref.filter((x) => !cib.includes(x) && attendu(x, 'reference')),
      ...cib.filter((x) => !ref.includes(x) && attendu(x, 'cible')),
    ];

    const etat = manquants.length === 0 && enTrop.length === 0 ? 'OK   ' : 'ECART';
    console.log(`${etat} ${nom.padEnd(22)} reference ${String(ref.length).padStart(3)} · cible ${String(cib.length).padStart(3)}`);
    for (const m of manquants) console.log(`        MANQUE dans la cible : ${m}`);
    for (const t of enTrop) console.log(`        EN TROP dans la cible : ${t}`);
    // Les differences declarees sont AFFICHEES, pas masquees : on doit pouvoir
    // relire leur motif sans ouvrir le code.
    for (const t of tolerees) {
      const a = ATTENDUS.find((x) => x.objet === t)!;
      console.log(`        attendu : ${t} — ${a.motif}`);
    }
    ecarts += manquants.length + enTrop.length;
  }

  console.log(ecarts === 0 ? '\nAucun ecart.' : `\n${ecarts} ecart(s).`);
  await reference.$disconnect();
  await cible.$disconnect();
  if (ecarts !== 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
