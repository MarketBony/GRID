// ============================================================================
// TEST DE LA RLS — le filet, et il n'y en a pas d'autre.
//
// Depuis la bascule sans serveur, `backend/src/auth/campagneScope.ts` n'existe
// plus : le navigateur attaque Supabase en direct avec une cle `anon` publique,
// et les politiques RLS sont la SEULE chose entre un chef de table et les donnees
// de tout le groupe. Cette suite remplace `test:api` (43 controles), a valeur
// egale — c'est la partie du lot qu'il ne faut pas abreger.
//
// LES DEUX SENS SONT VERIFIES, et c'est le point. Une suite qui ne teste que ce
// qui est permis passerait au vert sur une base entierement ouverte. Une suite qui
// ne teste que ce qui est refuse passerait au vert sur une base entierement
// fermee. Les deux erreurs sont silencieuses :
//   - trop fermee -> zero ligne, aucune erreur, ecran vide inexplicable ;
//   - trop ouverte -> tout est lisible depuis la console du navigateur.
//
// ATTENTION AU PIEGE DE L'UPDATE. Un `INSERT` refuse par une politique leve une
// exception (`row-level security policy`), mais un `UPDATE` dont la clause `USING`
// ne matche rien N'EST PAS UNE ERREUR : il affecte zero ligne, en silence. Les
// controles d'ecriture par modification comptent donc les lignes affectees, ils
// n'attendent pas d'exception. Ecrire l'inverse donnerait une suite verte sur une
// base qui laisse tout passer.
//
// ---------------------------------------------------------------------------
// COMMENT ON SE FAIT PASSER POUR QUELQU'UN — exactement ce que fait PostgREST
// ---------------------------------------------------------------------------
// PostgREST se connecte avec un role technique puis, pour chaque requete :
//     SET LOCAL ROLE authenticated;
//     SET LOCAL request.jwt.claims = '<les claims du jeton>';
// et `auth.uid()` lit `sub` dans ces claims. On fait la meme chose ici. Les
// politiques sont donc evaluees dans les MEMES conditions qu'en production : meme
// role, meme `auth.uid()`, memes fonctions. Ce qui n'est PAS couvert, et qu'il
// faut verifier ailleurs, est dit en fin de fichier.
//
// PRISMA SE CONNECTE AVEC LE ROLE PROPRIETAIRE DES TABLES, QUI CONTOURNE LA RLS.
// C'est precisement ce qui rendait la RLS inutile dans l'architecture precedente.
// `SET LOCAL ROLE authenticated` nous fait quitter ce role : sans cette ligne,
// toute cette suite passerait au vert sans rien prouver.
//
// ---------------------------------------------------------------------------
// AUCUNE TRACE LAISSEE EN BASE
// ---------------------------------------------------------------------------
// Meme discipline que `tester-garde-fous.ts` : chaque controle tourne dans SA
// transaction, toujours annulee. Les `auth_uid` des comptes de test sont poses
// DANS la transaction, avant le changement de role, et disparaissent avec elle.
// La suite ne modifie donc rien — elle est rejouable sur une base de production
// sans precaution particuliere.
//
// Usage : npm --prefix backend run test:rls
// ============================================================================

import { PrismaClient, Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';

const prisma = new PrismaClient();

const ROLLBACK = 'ROLLBACK_VOULU';
type Tx = Prisma.TransactionClient;

const resultats: { nom: string; ok: boolean; detail: string }[] = [];

/// Identite Supabase d'un compte de test, DETERMINISTE : le meme `loginId` donne
/// toujours le meme uuid. Rejouer la suite ne produit donc pas une identite neuve
/// a chaque fois, ce qui rend les echecs comparables d'une execution a l'autre.
/// Ces uuid ne sont ceux d'aucun compte Supabase reel : ils ne servent qu'ici.
const identite = (loginId: string): string => {
  const h = createHash('md5').update(`grid:${loginId}`).digest('hex');
  return [h.slice(0, 8), h.slice(8, 12), h.slice(12, 16), h.slice(16, 20), h.slice(20, 32)].join('-');
};

/// LE CODE SQLSTATE D'UNE ERREUR, et non son message.
///
/// Les messages de PostgreSQL sont TRADUITS : sur ce poste ils arrivent en
/// francais (« droit refuse pour le schema relance »), sur un serveur Supabase en
/// anglais. Une suite qui compare des bouts de phrase passe donc au rouge en
/// changeant de machine, sans qu'aucune regle n'ait bouge — c'est arrive a la
/// premiere version de ce fichier, 46 controles au rouge pour une question de
/// locale.
///
/// Les codes, eux, sont normalises et ne bougent jamais :
///   42501 — droit insuffisant. Couvre A LA FOIS un GRANT manquant ET une
///           violation de politique RLS a l'insertion. C'est pourquoi la section 0
///           verifie separement l'etat exact des GRANT : une fois qu'on sait que
///           le droit SQL est accorde, un 42501 sur une ecriture ne peut plus
///           venir que de la RLS.
///   42703 — colonne inexistante.
const codeSql = (e: unknown): string => {
  const brut = e instanceof Error ? e.message : String(e);
  const meta = (e as { meta?: { code?: unknown } })?.meta?.code;
  if (typeof meta === 'string') return meta;
  const plat = brut.replace(/\s+/g, ' ');
  // Prisma encadre le code de la base : Code: `42501`. C'est cette forme qu'on
  // cherche d'abord — un simple << cinq chiffres >> attraperait un identifiant ou
  // un numero de ligne cite ailleurs dans le message.
  // UN SQLSTATE FAIT CINQ CARACTERES ALPHANUMERIQUES, pas cinq chiffres : les
  // erreurs levees par un `RAISE EXCEPTION` de PL/pgSQL valent `P0001`. Une
  // premiere version ne cherchait que des chiffres et ne voyait donc AUCUN refus
  // de trigger — elle les rangeait tous en « aucun code ».
  //
  // Prisma presente le code sous deux formes selon le chemin : ``Code: `42501` ``
  // pour une requete brute, `code: "P0001"` pour une operation typee.
  const annonce = /code:\s*["`]?([0-9A-Za-z]{5})["`]?/i.exec(plat);
  if (annonce) return annonce[1];
  return `(aucun code) ${plat.slice(0, 120)}`;
};

const DROIT_INSUFFISANT = '42501';
const COLONNE_INEXISTANTE = '42703';
/// `RAISE EXCEPTION` d'un trigger PL/pgSQL : un garde-fou METIER qui parle. A
/// distinguer d'un refus de politique, qui est muet.
const ERREUR_METIER = 'P0001';

/// Le contexte d'execution d'un controle.
///   `{ login }`      — un compte, vu comme PostgREST le verrait
///   `'anonyme'`      — la cle `anon` seule, sans jeton
type Contexte = { login: string } | 'anonyme';

const libelleContexte = (c: Contexte) => (c === 'anonyme' ? 'anon' : c.login);

/// Ouvre une transaction, s'y fait passer pour `contexte`, execute `corps`, puis
/// annule tout. La preparation (poser `auth_uid`, desactiver un compte) se fait
/// AVANT le changement de role, tant qu'on est encore proprietaire.
async function sousIdentite<T>(
  contexte: Contexte,
  corps: (tx: Tx) => Promise<T>,
  preparation?: (tx: Tx) => Promise<void>
): Promise<T> {
  let resultat: T;
  try {
    await prisma.$transaction(async (tx) => {
      if (preparation) await preparation(tx);

      if (contexte === 'anonyme') {
        await tx.$executeRawUnsafe(`SET LOCAL ROLE anon`);
      } else {
        const uid = identite(contexte.login);
        // `auth_uid` est pose ICI et annule avec la transaction : la suite ne
        // laisse aucun compte relie a une identite fictive derriere elle.
        await tx.utilisateur.update({
          where: { loginId: contexte.login },
          data: { authUid: uid },
        });
        await tx.$executeRawUnsafe(
          `SELECT set_config('request.jwt.claim.sub', '${uid}', true)`
        );
        await tx.$executeRawUnsafe(`SET LOCAL ROLE authenticated`);
      }

      resultat = await corps(tx);
      throw new Error(ROLLBACK);
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (!message.includes(ROLLBACK)) throw e;
  }
  return resultat!;
}

/// L'operation doit ECHOUER, avec le code SQLSTATE `code`.
/// Pour les refus BRUYANTS : droit SQL manquant, `with check` d'un INSERT,
/// trigger. Ne convient PAS a un UPDATE hors perimetre, qui est SILENCIEUX —
/// celui-la se mesure avec `doitValoir`.
async function doitRefuser(
  nom: string,
  contexte: Contexte,
  code: string,
  operation: (tx: Tx) => Promise<unknown>,
  preparation?: (tx: Tx) => Promise<void>
) {
  try {
    await sousIdentite(contexte, async (tx) => {
      await operation(tx);
      return null;
    }, preparation);
    resultats.push({
      nom,
      ok: false,
      detail: `[${libelleContexte(contexte)}] ACCEPTE alors que ce devait etre refuse`,
    });
  } catch (e) {
    const obtenu = codeSql(e);
    if (obtenu === code) {
      resultats.push({ nom, ok: true, detail: `[${libelleContexte(contexte)}] refuse (${code})` });
    } else {
      const message = (e instanceof Error ? e.message : String(e)).slice(0, 200).replace(/\s+/g, ' ');
      resultats.push({
        nom,
        ok: false,
        detail: `[${libelleContexte(contexte)}] refuse avec ${obtenu} et non ${code} : ${message}`,
      });
    }
  }
}

/// L'operation doit REUSSIR.
async function doitAccepter(
  nom: string,
  contexte: Contexte,
  operation: (tx: Tx) => Promise<unknown>,
  preparation?: (tx: Tx) => Promise<void>
) {
  try {
    await sousIdentite(contexte, async (tx) => operation(tx), preparation);
    resultats.push({ nom, ok: true, detail: `[${libelleContexte(contexte)}] accepte` });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    resultats.push({
      nom,
      ok: false,
      detail: `[${libelleContexte(contexte)}] REFUSE alors que ce devait passer : ${message
        .slice(0, 200)
        .replace(/\s+/g, ' ')}`,
    });
  }
}

/// La mesure doit valoir exactement `attendu`.
/// C'est la forme qui compte pour les refus SILENCIEUX — une lecture qui rend
/// zero ligne, un UPDATE qui n'affecte personne — et pour prouver qu'une lecture
/// autorisee rend bien quelque chose. « Zero » n'est jamais une reussite par
/// defaut : chaque controle dit le nombre qu'il attend.
async function doitValoir(
  nom: string,
  contexte: Contexte,
  attendu: number,
  mesure: (tx: Tx) => Promise<number>,
  preparation?: (tx: Tx) => Promise<void>
) {
  try {
    const obtenu = await sousIdentite(contexte, mesure, preparation);
    resultats.push({
      nom,
      ok: obtenu === attendu,
      detail:
        obtenu === attendu
          ? `[${libelleContexte(contexte)}] ${obtenu}`
          : `[${libelleContexte(contexte)}] ${obtenu}, attendu ${attendu}`,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    resultats.push({
      nom,
      ok: false,
      detail: `[${libelleContexte(contexte)}] exception inattendue : ${message
        .slice(0, 200)
        .replace(/\s+/g, ' ')}`,
    });
  }
}

/// Un FAIT sur le schema, verifie hors de toute session : l'etat des GRANT.
///
/// Ces controles ne dependent d'aucun `auth.uid()` — ils disent ce que le role
/// `authenticated` a le droit de faire AVANT que la moindre politique n'entre en
/// jeu. Ils sont ce qui rend le reste de la suite interpretable : `42501` signifie
/// « droit insuffisant » aussi bien pour un GRANT manquant que pour une politique
/// qui refuse. Une fois etabli ici que le GRANT est accorde, un `42501` sur une
/// ecriture ne peut plus venir que de la RLS.
async function doitEtreVrai(nom: string, expression: string, attendu: boolean) {
  try {
    const lignes = await prisma.$queryRawUnsafe<{ v: boolean | null }[]>(
      `SELECT (${expression}) AS v`
    );
    const obtenu = lignes[0].v === true;
    resultats.push({
      nom,
      ok: obtenu === attendu,
      detail: obtenu === attendu ? `${obtenu}` : `${obtenu}, attendu ${attendu}`,
    });
  } catch (e) {
    resultats.push({
      nom,
      ok: false,
      detail: `exception : ${(e instanceof Error ? e.message : String(e)).slice(0, 160).replace(/\s+/g, ' ')}`,
    });
  }
}

const nombre = async (tx: Tx, sql: string): Promise<number> => {
  const lignes = await tx.$queryRawUnsafe<{ n: bigint }[]>(sql);
  return Number(lignes[0].n);
};

async function main() {
  // ------------------------------------------------------------------ fixtures
  //
  // Rien n'est code en dur (interdit n.3) : tout est resolu depuis la base, ce qui
  // rend la suite valable sur n'importe quel jeu de donnees respectant le seed.

  const juin = await prisma.campagne.findUniqueOrThrow({ where: { libelle: 'Juin 2026' } });
  const septembre = await prisma.campagne.findUniqueOrThrow({
    where: { libelle: 'Septembre 2026' },
  });

  // LE CHEF DE TABLE. `sbesson` anime la Table 1 de CENTRE sur JUIN, et rien sur
  // septembre : c'est exactement ce qu'il faut pour eprouver « les droits sont par
  // campagne ». Resolu par la base plutot que nomme en dur : si le seed change de
  // chef, la suite suit.
  const tableJuin = await prisma.tablePhoning.findFirstOrThrow({
    where: {
      archiveLe: null,
      chefUtilisateurId: { not: null },
      sessionPlaque: { campagneId: juin.id },
      affectations: { some: { archiveLe: null } },
    },
    select: {
      id: true,
      libelle: true,
      chef: { select: { loginId: true } },
      affectations: {
        where: { archiveLe: null },
        select: { vendeur: { select: { id: true, nom: true, siteId: true, typeVehicule: true } } },
      },
    },
    orderBy: { id: 'asc' },
  });
  const chefDeTable = tableJuin.chef!.loginId;
  const vendeurDeSaTable = tableJuin.affectations[0].vendeur;

  // Un vendeur qui n'est PAS dans sa table, et pas non plus sur un site qu'il
  // encadrerait — `sbesson` n'a aucun encadrement, donc n'importe quel vendeur
  // hors table convient.
  const idsDeSaTable = tableJuin.affectations.map((a) => a.vendeur.id);
  const vendeurHorsTable = await prisma.vendeur.findFirstOrThrow({
    where: { id: { notIn: idsDeSaTable }, archiveLe: null },
    orderBy: { id: 'asc' },
  });

  // L'ENCADRANT. Rattache durablement a CLF et MOZ : son perimetre ne depend pas
  // de la campagne, c'est tout l'objet du modele d'encadrement.
  const encadrements = await prisma.encadrementSite.findMany({
    where: { utilisateur: { loginId: 'encadrant.test' }, archiveLe: null },
    select: { siteId: true },
  });
  const sitesEncadres = encadrements.map((e) => e.siteId);
  const vendeurEncadre = await prisma.vendeur.findFirstOrThrow({
    where: { siteId: { in: sitesEncadres }, archiveLe: null },
    orderBy: { id: 'asc' },
  });
  const vendeurNonEncadre = await prisma.vendeur.findFirstOrThrow({
    where: { siteId: { notIn: sitesEncadres }, archiveLe: null },
    orderBy: { id: 'asc' },
  });

  /// Compose un RDV valide pour un vendeur donne : jour et creneau de la campagne,
  /// marque et type coherents avec son metier. Sans cela, un refus de trigger
  /// (R-C.1, VN/VO) se ferait passer pour un refus de politique — et la suite
  /// prouverait autre chose que ce qu'elle annonce.
  async function rdvValide(vendeurId: bigint, campagneId: bigint) {
    const v = await prisma.vendeur.findUniqueOrThrow({
      where: { id: vendeurId },
      select: { typeVehicule: true, marques: { select: { marqueId: true } } },
    });
    const j = await prisma.campagneJour.findFirstOrThrow({
      where: { campagneId },
      orderBy: { ordre: 'asc' },
    });
    const cr = await prisma.campagneCreneau.findFirstOrThrow({
      where: { campagneId },
      orderBy: { ordre: 'asc' },
    });
    return {
      campagneId,
      vendeurId,
      jour: j.jour,
      creneauCode: cr.code,
      marqueId: v.typeVehicule === 'VN' ? v.marques[0].marqueId : null,
      typeVehicule: v.typeVehicule,
      client: 'CONTROLE RLS',
    };
  }

  const rdvChefDeTableJuin = await rdvValide(vendeurDeSaTable.id, juin.id);
  const rdvChefDeTableSeptembre = await rdvValide(vendeurDeSaTable.id, septembre.id);
  const rdvHorsTable = await rdvValide(vendeurHorsTable.id, juin.id);
  const rdvEncadreJuin = await rdvValide(vendeurEncadre.id, juin.id);
  const rdvEncadreSeptembre = await rdvValide(vendeurEncadre.id, septembre.id);
  const rdvNonEncadre = await rdvValide(vendeurNonEncadre.id, juin.id);

  // =========================================================================
  // 0. LA COUCHE DES DROITS SQL — ce qui rend tout le reste interpretable.
  //
  // La RLS ne s'applique QU'APRES les GRANT. Un droit manquant et une politique
  // qui refuse produisent le MEME code `42501` : sans cette section, un `GRANT`
  // oublie se ferait passer pour une politique qui fonctionne, et la suite serait
  // verte sur une base ou plus personne ne peut rien ecrire.
  //
  // Deux verites opposees a etablir :
  //   - `anon` n'a RIEN, pas meme l'usage du schema ;
  //   - `authenticated` a bien les droits d'ecriture, pour que les refus observes
  //     plus bas soient imputables a la RLS et a elle seule.
  // =========================================================================

  await doitEtreVrai(
    "droits  anon n a PAS l usage du schema relance",
    "has_schema_privilege('anon', 'relance', 'USAGE')",
    false
  );
  await doitEtreVrai(
    "droits  authenticated a l usage du schema relance",
    "has_schema_privilege('authenticated', 'relance', 'USAGE')",
    true
  );

  for (const table of ['rdv', 'utilisateur', 'marque', 'vendeur'] as const) {
    await doitEtreVrai(
      `droits  authenticated PEUT inserer dans ${table} (donc un refus vient de la RLS)`,
      `has_table_privilege('authenticated', 'relance.${table}', 'INSERT')`,
      true
    );
  }

  // INTERDIT N.1, PREMIERE SERRURE. Les deux autres — aucune politique
  // `FOR DELETE`, et les 19 triggers `pas_de_delete` — sont eprouvees ailleurs.
  for (const table of ['rdv', 'vendeur', 'campagne', 'utilisateur', 'affectation'] as const) {
    await doitEtreVrai(
      `interdit n.1  aucun droit DELETE sur ${table}`,
      `has_table_privilege('authenticated', 'relance.${table}', 'DELETE')`,
      false
    );
  }

  // `service_role` CONTOURNE LA RLS, PAS LES PRIVILEGES. C'est la cle de l'Edge
  // Function : elle ignore les POLITIQUES mais reste soumise aux droits SQL. La
  // migration du portail l'avait oubliee, et la creation de compte echouait sur
  // « permission denied for table utilisateur » — une panne qui ressemblait a un
  // probleme de RLS et n'en etait pas un.
  for (const table of ['utilisateur', 'vendeur', 'rdv'] as const) {
    await doitEtreVrai(
      `droits  service_role PEUT ecrire dans ${table} (l Edge Function en depend)`,
      `has_table_privilege('service_role', 'relance.${table}', 'INSERT')`,
      true
    );
  }

  // ET L'INTERDIT N.1 VAUT POUR ELLE AUSSI. « Personne » inclut la cle qui
  // contourne tout le reste — c'est precisement celle dont on veut qu'elle ne
  // puisse pas detruire l'historique par accident. Les purges legitimes passent
  // par des fonctions `security definer`, qui n'ont pas besoin de ce droit.
  for (const table of ['rdv', 'vendeur', 'campagne'] as const) {
    await doitEtreVrai(
      `interdit n.1  aucun droit DELETE sur ${table}, MEME pour service_role`,
      `has_table_privilege('service_role', 'relance.${table}', 'DELETE')`,
      false
    );
  }

  // DROITS COLONNE. La RLS filtre des lignes, jamais des colonnes : l'empreinte
  // bcrypt ne peut etre protegee que la.
  await doitEtreVrai(
    'droits  password_hash n est PAS lisible',
    "has_column_privilege('authenticated', 'relance.utilisateur', 'password_hash', 'SELECT')",
    false
  );
  await doitEtreVrai(
    'droits  auth_uid n est PAS lisible',
    "has_column_privilege('authenticated', 'relance.utilisateur', 'auth_uid', 'SELECT')",
    false
  );
  await doitEtreVrai(
    'droits  le nom d un compte reste lisible (non-regression)',
    "has_column_privilege('authenticated', 'relance.utilisateur', 'nom', 'SELECT')",
    true
  );

  // AUCUNE TABLE SANS RLS. Une table oubliee est entierement lisible, et rien ne
  // le signale. Le controle porte sur le COMPTE de tables non protegees, pas sur
  // une liste ecrite a la main : une table ajoutee demain sera attrapee.
  await doitEtreVrai(
    'RLS  aucune table du schema relance n est laissee sans RLS',
    `NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'relance' AND NOT rowsecurity)`,
    true
  );
  // ... et aucune table protegee SANS politique : la RLS activee sans politique
  // rend zero ligne SANS ERREUR. C'est le defaut deja present dans `schema.sql`.
  await doitEtreVrai(
    'RLS  aucune table protegee ne se retrouve SANS politique',
    `NOT EXISTS (
       SELECT 1 FROM pg_tables t
       WHERE t.schemaname = 'relance'
         AND t.rowsecurity
         AND t.tablename <> '_prisma_migrations'
         AND NOT EXISTS (
           SELECT 1 FROM pg_policies p
           WHERE p.schemaname = t.schemaname AND p.tablename = t.tablename
         )
     )`,
    true
  );

  // =========================================================================
  // 1. ANONYME — le controle le plus important.
  //
  // La cle `anon` part dans le bundle du navigateur : elle est publique, lisible
  // par quiconque ouvre les outils de developpement. Elle ne doit ouvrir AUCUNE
  // porte. Le refus est franc — `permission denied for schema relance` — parce que
  // `anon` n'a meme pas l'usage du schema : une fuite se voit, un ecran vide
  // s'explique.
  // =========================================================================

  await doitRefuser('anon  lire les vendeurs', 'anonyme', DROIT_INSUFFISANT, (tx) =>
    tx.$queryRawUnsafe('SELECT id FROM relance.vendeur LIMIT 1')
  );
  await doitRefuser('anon  lire les RDV', 'anonyme', DROIT_INSUFFISANT, (tx) =>
    tx.$queryRawUnsafe('SELECT id FROM relance.rdv LIMIT 1')
  );
  await doitRefuser('anon  lire la vue agregee', 'anonyme', DROIT_INSUFFISANT, (tx) =>
    tx.$queryRawUnsafe('SELECT id FROM relance.rdv_agrege LIMIT 1')
  );
  await doitRefuser('anon  lire les comptes', 'anonyme', DROIT_INSUFFISANT, (tx) =>
    tx.$queryRawUnsafe('SELECT login_id FROM relance.utilisateur LIMIT 1')
  );
  await doitRefuser('anon  ecrire un RDV', 'anonyme', DROIT_INSUFFISANT, (tx) =>
    tx.$executeRawUnsafe(
      `INSERT INTO relance.rdv (campagne_id, vendeur_id, jour, creneau_code, type_vehicule, client)
       VALUES (${juin.id}, ${vendeurDeSaTable.id}, '2026-06-11', 'X', 'VN', 'INTRUSION')`
    )
  );
  await doitRefuser('anon  lire le perimetre de quelqu un', 'anonyme', DROIT_INSUFFISANT, (tx) =>
    tx.$queryRawUnsafe('SELECT vendeur_id FROM relance.perimetre_saisie LIMIT 1')
  );

  // =========================================================================
  // 2. ADMIN — tout, gestion des comptes comprise.
  // =========================================================================

  await doitValoir('admin  voit tous les RDV', { login: 'admin.test' }, await prisma.rdv.count(), (tx) =>
    nombre(tx, 'SELECT count(*) AS n FROM relance.rdv')
  );
  await doitAccepter('admin  saisit sur n importe quel vendeur', { login: 'admin.test' }, (tx) =>
    tx.rdv.create({ data: rdvHorsTable })
  );
  // CONTRAINTE DE CONTRAT, trouvee par cette suite et a respecter dans le front :
  // ecrire dans `utilisateur` en REDEMANDANT LA LIGNE COMPLETE est refuse, meme a
  // un admin. Un `INSERT ... RETURNING *` exige le droit de lire TOUTES les
  // colonnes, or `password_hash` et `auth_uid` ne sont accordes a personne. La
  // base repond `42501` sur la table entiere, ce qui se diagnostique tres mal
  // quand on ne l'a pas vu une fois.
  //
  // Cote `supabase-js`, la regle est : ne jamais chainer un `.select()` sans liste
  // de colonnes apres une ecriture sur `utilisateur`. Les deux controles ci-dessous
  // la fixent dans les deux sens.
  await doitRefuser(
    'contrat  ecrire dans utilisateur en redemandant la ligne COMPLETE',
    { login: 'admin.test' },
    DROIT_INSUFFISANT,
    (tx) =>
      tx.utilisateur.create({
        data: { loginId: 'controle.rls.complet', nom: 'CONTROLE RLS', passwordHash: 'x' },
      })
  );
  await doitAccepter('admin  cree un compte', { login: 'admin.test' }, (tx) =>
    tx.utilisateur.create({
      data: { loginId: 'controle.rls', nom: 'CONTROLE RLS', passwordHash: 'x' },
      select: { id: true },
    })
  );
  await doitAccepter('admin  attribue un role global', { login: 'admin.test' }, async (tx) => {
    const u = await tx.utilisateur.create({
      data: { loginId: 'controle.rls.role', nom: 'CONTROLE RLS', passwordHash: 'x' },
      select: { id: true },
    });
    return tx.roleGlobal.create({ data: { utilisateurId: u.id, role: 'lecteur' } });
  });
  await doitAccepter('admin  administre un referentiel', { login: 'admin.test' }, (tx) =>
    tx.marque.create({ data: { code: 'CONTROLE', libelle: 'Controle RLS', ordre: 99 } })
  );

  // =========================================================================
  // 3. DIRECTION — tout SAUF la gestion des comptes.
  //
  // C'est LA frontiere entre les deux paliers hauts, et la raison pour laquelle
  // elle existe : sans elle, `direction` pourrait se promouvoir `admin`. Les trois
  // controles ci-dessous sont les trois chemins par lesquels il essaierait.
  // =========================================================================

  await doitAccepter('direction  saisit (acces total)', { login: 'direction.test' }, (tx) =>
    tx.rdv.create({ data: rdvHorsTable })
  );
  await doitAccepter('direction  administre un referentiel', { login: 'direction.test' }, (tx) =>
    tx.marque.create({ data: { code: 'CONTROLE2', libelle: 'Controle RLS', ordre: 99 } })
  );
  await doitRefuser(
    'direction  creer un compte',
    { login: 'direction.test' },
    DROIT_INSUFFISANT,
    (tx) =>
      tx.utilisateur.create({
        data: { loginId: 'promotion.interdite', nom: 'NON', passwordHash: 'x' },
        select: { id: true },
      })
  );
  await doitRefuser(
    'direction  SE PROMOUVOIR admin',
    { login: 'direction.test' },
    DROIT_INSUFFISANT,
    async (tx) => {
      const moi = await tx.$queryRawUnsafe<{ id: bigint }[]>(
        `SELECT relance.utilisateur_courant() AS id`
      );
      return tx.roleGlobal.create({ data: { utilisateurId: moi[0].id, role: 'admin' } });
    }
  );
  await doitRefuser(
    'direction  rattacher un encadrant a un site',
    { login: 'direction.test' },
    DROIT_INSUFFISANT,
    async (tx) => {
      const moi = await tx.$queryRawUnsafe<{ id: bigint }[]>(
        `SELECT relance.utilisateur_courant() AS id`
      );
      return tx.encadrementSite.create({
        data: {
          siteId: vendeurNonEncadre.siteId,
          utilisateurId: moi[0].id,
          role: 'chef_de_vente_vo',
        },
      });
    }
  );

  // =========================================================================
  // 4. ENCADRANT — ses sites, DURABLEMENT, et ses tables.
  //
  // Le rattachement a un site ne depend pas de la campagne : c'est ce qui distingue
  // `encadrement_site` de `role_campagne`, et ce qui evite qu'un chef de juin se
  // retrouve sans droits en septembre. Les deux campagnes sont donc testees.
  // =========================================================================

  await doitAccepter('encadrant  saisit sur son site — JUIN', { login: 'encadrant.test' }, (tx) =>
    tx.rdv.create({ data: rdvEncadreJuin })
  );
  await doitAccepter(
    'encadrant  saisit sur son site — SEPTEMBRE (rattachement durable)',
    { login: 'encadrant.test' },
    (tx) => tx.rdv.create({ data: rdvEncadreSeptembre })
  );
  await doitRefuser(
    'encadrant  saisit HORS de ses sites',
    { login: 'encadrant.test' },
    DROIT_INSUFFISANT,
    (tx) => tx.rdv.create({ data: rdvNonEncadre })
  );
  await doitRefuser(
    'encadrant  administre (creer un vendeur)',
    { login: 'encadrant.test' },
    DROIT_INSUFFISANT,
    (tx) =>
      tx.vendeur.create({
        data: { nom: 'CONTROLE RLS', siteId: vendeurEncadre.siteId, typeVehicule: 'VN' },
      })
  );
  await doitRefuser(
    'encadrant  gere les comptes',
    { login: 'encadrant.test' },
    DROIT_INSUFFISANT,
    (tx) =>
      tx.utilisateur.create({
        data: { loginId: 'non', nom: 'NON', passwordHash: 'x' },
        select: { id: true },
      })
  );

  // =========================================================================
  // 5. CHEF DE TABLE — sa table, SUR SA CAMPAGNE.
  //
  // « Etre chef de table en juin ne donne aucun droit sur la campagne de
  // septembre » (cahier des charges, section 3). C'est la regle la plus facile a
  // perdre en traduisant le portail en SQL, parce qu'une politique ecrite sans
  // `campagne_id` aurait l'air correcte et donnerait des droits perpetuels.
  // =========================================================================

  await doitAccepter(
    `chef de table  saisit sur sa table — ${tableJuin.libelle}, JUIN`,
    { login: chefDeTable },
    (tx) => tx.rdv.create({ data: rdvChefDeTableJuin })
  );
  await doitRefuser(
    'chef de table  LE MEME VENDEUR sur une AUTRE campagne',
    { login: chefDeTable },
    DROIT_INSUFFISANT,
    (tx) => tx.rdv.create({ data: rdvChefDeTableSeptembre })
  );
  await doitRefuser(
    'chef de table  un vendeur hors de sa table',
    { login: chefDeTable },
    DROIT_INSUFFISANT,
    (tx) => tx.rdv.create({ data: rdvHorsTable })
  );

  // Le NOM DU CLIENT ne sort pas du perimetre : c'est ce qui remplace
  // `redacterRdvs`. Le chef de table ne voit dans `rdv` que les RDV qu'il peut
  // saisir — les autres ne sont pas rediges, ils sont absents.
  // LES DEUX RDV SONT POSES PAR LE CONTROLE LUI-MEME, dans la transaction annulee.
  //
  // La premiere version se contentait de compter les RDV deja en base. Sur une base
  // fraichement seedee il n'y en a AUCUN : le controle rendait zero, ce qui est la
  // valeur attendue, mais ce zero ne prouvait rien — il aurait ete identique avec
  // une politique absente. La suite l'a signale d'elle-meme au premier passage sur
  // Supabase (« CONTROLE SANS OBJET »), ce qui valait mieux qu'un vert mensonger,
  // mais ne remplace pas un vrai controle.
  //
  // La preparation s'execute AVANT le changement de role, donc avec les droits du
  // proprietaire : elle pose un RDV DANS le perimetre du chef de table et un HORS
  // de son perimetre. On verifie ensuite qu'il voit exactement le premier et pas le
  // second. C'est ce qui remplace `redacterRdvs` : le nom du client hors perimetre
  // n'est pas caviarde, la ligne est ABSENTE.
  const poserLesDeuxRdv = async (tx: Tx) => {
    await tx.rdv.create({ data: rdvChefDeTableJuin, select: { id: true } });
    await tx.rdv.create({ data: rdvHorsTable, select: { id: true } });
  };

  const dejaSurSonVendeur = await prisma.rdv.count({ where: { vendeurId: vendeurDeSaTable.id } });

  await doitValoir(
    'chef de table  ne voit AUCUN RDV hors de son perimetre (un y est pourtant pose)',
    { login: chefDeTable },
    0,
    (tx) =>
      nombre(tx, `SELECT count(*) AS n FROM relance.rdv WHERE vendeur_id = ${vendeurHorsTable.id}`),
    poserLesDeuxRdv
  );

  // Le sens inverse, sans lequel le controle precedent serait satisfait par une
  // base qui ne montre rien a personne.
  await doitValoir(
    'chef de table  voit BIEN les RDV de son perimetre',
    { login: chefDeTable },
    dejaSurSonVendeur + 1,
    (tx) =>
      nombre(tx, `SELECT count(*) AS n FROM relance.rdv WHERE vendeur_id = ${vendeurDeSaTable.id}`),
    poserLesDeuxRdv
  );

  // =========================================================================
  // 6. LECTEUR — lit les agregats, n'ecrit rien.
  //
  // `lecteur` n'apparait dans AUCUNE liste d'ecriture, et c'est ce qui le rend
  // lecture seule. Le compte est cree ici, dans la transaction, puis annule.
  // =========================================================================

  const creerLecteur = async (tx: Tx) => {
    const u = await tx.utilisateur.create({
      data: { loginId: 'lecteur.rls', nom: 'LECTEUR — controle', passwordHash: 'x' },
      select: { id: true },
    });
    await tx.roleGlobal.create({ data: { utilisateurId: u.id, role: 'lecteur' } });
  };

  await doitValoir(
    'lecteur  lit les agregats',
    { login: 'lecteur.rls' },
    await prisma.rdv.count(),
    (tx) => nombre(tx, 'SELECT count(*) AS n FROM relance.rdv_agrege'),
    creerLecteur
  );
  await doitRefuser(
    'lecteur  saisit un RDV',
    { login: 'lecteur.rls' },
    DROIT_INSUFFISANT,
    (tx) => tx.rdv.create({ data: rdvHorsTable }),
    creerLecteur
  );
  await doitRefuser(
    'lecteur  administre un referentiel',
    { login: 'lecteur.rls' },
    DROIT_INSUFFISANT,
    (tx) => tx.marque.create({ data: { code: 'NON', libelle: 'Non', ordre: 99 } }),
    creerLecteur
  );
  await doitValoir(
    'lecteur  ne voit AUCUN RDV nominatif (perimetre vide)',
    { login: 'lecteur.rls' },
    0,
    (tx) => nombre(tx, 'SELECT count(*) AS n FROM relance.rdv'),
    creerLecteur
  );

  // =========================================================================
  // 7. COMPTE DESACTIVE OU ARCHIVE — aucun droit, pas meme la lecture.
  //
  // Transcription de `DROITS_VIDES` : un compte qui n'est plus actif ne doit pas
  // pouvoir consulter les classements. Le refus est SILENCIEUX (zero ligne) et non
  // bruyant, parce que `utilisateur_courant()` rend NULL : d'ou `doitValoir`.
  // =========================================================================

  const desactiver = async (tx: Tx) => {
    await tx.utilisateur.update({ where: { loginId: 'admin.test' }, data: { actif: false } });
  };
  const archiver = async (tx: Tx) => {
    await tx.utilisateur.update({
      where: { loginId: 'admin.test' },
      data: { archiveLe: new Date() },
    });
  };

  await doitValoir(
    'compte DESACTIVE  ne lit aucun vendeur (bien qu il soit admin)',
    { login: 'admin.test' },
    0,
    (tx) => nombre(tx, 'SELECT count(*) AS n FROM relance.vendeur'),
    desactiver
  );
  await doitValoir(
    'compte ARCHIVE  ne lit aucun vendeur (bien qu il soit admin)',
    { login: 'admin.test' },
    0,
    (tx) => nombre(tx, 'SELECT count(*) AS n FROM relance.vendeur'),
    archiver
  );
  // LES DEUX VUES CONTOURNENT LA RLS PAR CONSTRUCTION — elles doivent donc porter
  // elles-memes le filtre que la RLS aurait applique. C'est le defaut qu'a trouve
  // l'ecriture de cette suite : `rdv_agrege` rendait ses 22 lignes a un compte
  // desactive, qui etait pourtant correctement bloque sur `vendeur`. Un compte
  // desactive garde un jeton Supabase valide — la desactivation est portee par
  // `utilisateur.actif` et non par Supabase Auth — donc son role reste
  // `authenticated` et le `GRANT` sur la vue suffisait a tout lui montrer.
  //
  // Un controle par vue, et il en faudra un de plus a chaque vue ajoutee.
  await doitValoir(
    'compte DESACTIVE  ne lit AUCUN agregat (la vue contourne la RLS, elle filtre elle-meme)',
    { login: 'admin.test' },
    0,
    (tx) => nombre(tx, 'SELECT count(*) AS n FROM relance.rdv_agrege'),
    desactiver
  );
  await doitValoir(
    'compte ARCHIVE  ne lit AUCUN agregat',
    { login: 'admin.test' },
    0,
    (tx) => nombre(tx, 'SELECT count(*) AS n FROM relance.rdv_agrege'),
    archiver
  );
  await doitValoir(
    'compte DESACTIVE  n a aucun perimetre',
    { login: 'admin.test' },
    0,
    (tx) => nombre(tx, 'SELECT count(*) AS n FROM relance.perimetre_saisie'),
    desactiver
  );

  await doitRefuser(
    'compte DESACTIVE  n ecrit rien',
    { login: 'admin.test' },
    DROIT_INSUFFISANT,
    (tx) => tx.rdv.create({ data: rdvHorsTable }),
    desactiver
  );

  // =========================================================================
  // 8. INTERDIT N.1 — aucun DELETE, pour PERSONNE.
  //
  // Trois serrures : aucun droit SQL `DELETE` accorde, aucune politique
  // `FOR DELETE`, et les 19 triggers `pas_de_delete`. La premiere suffit a
  // produire le refus ci-dessous ; les deux autres sont couvertes par
  // `test:garde-fous`, qui les eprouve avec le role proprietaire.
  // =========================================================================

  for (const table of ['rdv', 'vendeur', 'campagne', 'utilisateur'] as const) {
    await doitRefuser(
      `interdit n.1  DELETE sur ${table}, meme pour un admin`,
      { login: 'admin.test' },
      DROIT_INSUFFISANT,
      (tx) => tx.$executeRawUnsafe(`DELETE FROM relance.${table} WHERE id = -1`)
    );
  }

  // =========================================================================
  // 9. LES COLONNES QUI NE DOIVENT PAS SORTIR.
  //
  // La RLS filtre des LIGNES, jamais des colonnes. Deux protections distinctes :
  //   - `password_hash` : droit colonne, refus franc ;
  //   - `client` : absent de `rdv_agrege`, la colonne n'existe simplement pas.
  // =========================================================================

  await doitRefuser(
    'colonnes  password_hash illisible, meme par un admin',
    { login: 'admin.test' },
    DROIT_INSUFFISANT,
    (tx) => tx.$queryRawUnsafe('SELECT password_hash FROM relance.utilisateur LIMIT 1')
  );
  await doitRefuser(
    'colonnes  auth_uid d autrui illisible',
    { login: 'admin.test' },
    DROIT_INSUFFISANT,
    (tx) => tx.$queryRawUnsafe('SELECT auth_uid FROM relance.utilisateur LIMIT 1')
  );
  await doitRefuser(
    'colonnes  le nom du client est ABSENT de rdv_agrege',
    { login: 'admin.test' },
    COLONNE_INEXISTANTE,
    (tx) => tx.$queryRawUnsafe('SELECT client FROM relance.rdv_agrege LIMIT 1')
  );
  await doitRefuser(
    'colonnes  le commentaire est ABSENT de rdv_agrege',
    { login: 'admin.test' },
    COLONNE_INEXISTANTE,
    (tx) => tx.$queryRawUnsafe('SELECT commentaire FROM relance.rdv_agrege LIMIT 1')
  );

  // =========================================================================
  // 10. R-C.3 — une campagne cloturee n'accepte plus aucune ecriture.
  //
  // Tenu par la politique ET par le trigger `rdv_campagne_ouverte`. Ils ne
  // protegent pas les memes chemins : la politique arrete PostgREST, le trigger
  // arrete tout le reste. On verifie ici que la politique refuse bien.
  // =========================================================================

  const cloturerJuin = async (tx: Tx) => {
    await tx.campagne.update({ where: { id: juin.id }, data: { cloturee: true } });
  };
  // C'EST LE TRIGGER QUI REPOND, PAS LA POLITIQUE, et l'ordre d'evaluation de
  // PostgreSQL l'explique : un trigger `BEFORE` s'execute AVANT que le `WITH CHECK`
  // d'une politique ne soit evalue. Le refus arrive donc en `P0001`, avec le
  // message metier — ce qui vaut mieux que le refus muet d'une politique.
  //
  // La condition `campagne_ouverte()` reste dans la politique et n'y est pas
  // redondante : elle protege l'`UPDATE` d'un RDV vers une campagne close, chemin
  // que le trigger d'insertion ne voit pas.
  await doitRefuser(
    'R-C.3  saisie sur une campagne CLOTUREE (le trigger repond avant la politique)',
    { login: 'admin.test' },
    ERREUR_METIER,
    (tx) => tx.rdv.create({ data: rdvHorsTable, select: { id: true } }),
    cloturerJuin
  );

  // =========================================================================
  // 11. LE PERIMETRE EST BIEN CELUI DE `vendeursSaisissables`.
  //
  // La vue `perimetre_saisie` est la transcription du portail. Si elle ne rend rien
  // pour un compte qui a des droits, les ecrans seront vides sans erreur — le mode
  // d'echec silencieux. On verifie donc qu'elle rend un nombre NON NUL et exact.
  // =========================================================================

  const vendeursDeSesSites = await prisma.vendeur.count({
    where: {
      siteId: { in: sitesEncadres },
      archiveLe: null,
      OR: [{ dateSortie: null }, { dateSortie: { gte: juin.dateDebut } }],
    },
  });
  await doitValoir(
    'perimetre  l encadrant voit exactement les vendeurs de ses sites',
    { login: 'encadrant.test' },
    vendeursDeSesSites,
    (tx) =>
      nombre(
        tx,
        `SELECT count(*) AS n FROM relance.perimetre_saisie WHERE campagne_id = ${juin.id}`
      )
  );
  await doitValoir(
    'perimetre  le chef de table voit exactement les vendeurs de sa table (JUIN)',
    { login: chefDeTable },
    idsDeSaTable.length,
    (tx) =>
      nombre(
        tx,
        `SELECT count(*) AS n FROM relance.perimetre_saisie WHERE campagne_id = ${juin.id}`
      )
  );
  await doitValoir(
    'perimetre  le chef de table n a AUCUN vendeur sur l autre campagne',
    { login: chefDeTable },
    0,
    (tx) =>
      nombre(
        tx,
        `SELECT count(*) AS n FROM relance.perimetre_saisie WHERE campagne_id = ${septembre.id}`
      )
  );
  await doitValoir(
    'perimetre  un compte anonyme n a aucun perimetre (vue vide, pas d erreur interne)',
    { login: 'lecteur.rls' },
    0,
    (tx) => nombre(tx, 'SELECT count(*) AS n FROM relance.perimetre_saisie'),
    creerLecteur
  );

  // =========================================================================
  // 12. TRACABILITE — l attribution ne vient plus du client.
  //
  // Sans serveur, c'est le navigateur qui compose le corps de la requete : il peut
  // y ecrire n'importe quel `cree_par`. Le trigger l'impose a partir de
  // `auth.uid()`. Sans lui, l'attribution serait declarative — donc inutile le jour
  // ou un RDV est conteste.
  // =========================================================================

  await doitValoir(
    'tracabilite  cree_par est impose par la base, pas par le client',
    { login: chefDeTable },
    1,
    async (tx) => {
      const cree = await tx.rdv.create({
        // Le client ment deliberement : il se declare auteur sous l identifiant 1.
        data: { ...rdvChefDeTableJuin, creePar: BigInt(1) },
        select: { creePar: true },
      });
      const moi = await tx.$queryRawUnsafe<{ id: bigint }[]>(
        'SELECT relance.utilisateur_courant() AS id'
      );
      return cree.creePar === moi[0].id ? 1 : 0;
    }
  );

  // =========================================================================
  // 13. LES RPC PRIVILEGIEES.
  //
  // Elles sont `security definer` : elles s'executent avec les droits du
  // proprietaire, donc HORS RLS. C'est exactement ce qui les rend utiles — et
  // dangereuses. Chacune reverifie le palier de son appelant en premiere ligne ;
  // ces controles verifient qu'elle le fait vraiment.
  //
  // Le premier est le plus important : PostgreSQL accorde l'execution d'une
  // fonction a PUBLIC PAR DEFAUT. Sans le `revoke` de la migration, la purge aurait
  // ete appelable avec la seule cle publique, sans aucun jeton.
  // =========================================================================

  const rpc =
    (appel: string, ...params: unknown[]) =>
    (tx: Tx) =>
      tx.$queryRawUnsafe(`SELECT ${appel}`, ...params);

  await doitRefuser(
    'RPC  anon ne peut executer AUCUNE fonction privilegiee',
    'anonyme',
    DROIT_INSUFFISANT,
    rpc('relance.vendeur_purger($1, $2)', vendeurHorsTable.id, 'peu importe')
  );
  await doitRefuser(
    'RPC  anon ne peut pas appeler la composition des tables',
    'anonyme',
    DROIT_INSUFFISANT,
    rpc('relance.table_definir_vendeurs($1, $2)', tableJuin.id, [])
  );

  // LES GARDES INTERNES NE SONT PAS EXPOSES. `poser_capacites` laisserait reecrire
  // les marques d'un vendeur sans passer par les controles de `vendeur_modifier`.
  await doitRefuser(
    'RPC  poser_capacites reste une brique interne, non exposee',
    { login: 'admin.test' },
    DROIT_INSUFFISANT,
    rpc('relance.poser_capacites($1, $2, $3, $4)', vendeurHorsTable.id, [], 'VO', BigInt(1))
  );

  // --- le palier est bien verifie DANS la fonction ---

  await doitRefuser(
    'RPC  un encadrant ne peut pas creer de vendeur',
    { login: 'encadrant.test' },
    ERREUR_METIER,
    rpc("relance.vendeur_creer($1, $2, 'VO')", 'REFUS RPC', vendeurEncadre.siteId)
  );
  await doitRefuser(
    'RPC  un lecteur ne peut pas creer de vendeur',
    { login: 'lecteur.rls' },
    ERREUR_METIER,
    rpc("relance.vendeur_creer($1, $2, 'VO')", 'REFUS RPC', vendeurEncadre.siteId),
    creerLecteur
  );
  await doitAccepter(
    'RPC  un admin cree un vendeur',
    { login: 'admin.test' },
    rpc("relance.vendeur_creer($1, $2, 'VO')", 'CONTROLE RPC', vendeurEncadre.siteId)
  );

  // LA FRONTIERE ADMIN / DIRECTION, cote RPC cette fois. `direction` administre les
  // referentiels mais ne touche pas aux comptes : sans cela, il se promeut.
  await doitAccepter(
    'RPC  direction cree un vendeur (referentiel)',
    { login: 'direction.test' },
    rpc("relance.vendeur_creer($1, $2, 'VO')", 'CONTROLE RPC DIRECTION', vendeurEncadre.siteId)
  );
  await doitRefuser(
    'RPC  direction ne peut pas attribuer un role global',
    { login: 'direction.test' },
    ERREUR_METIER,
    async (tx) => {
      const moi = await tx.$queryRawUnsafe<{ id: bigint }[]>(
        'SELECT relance.utilisateur_courant() AS id'
      );
      return tx.$queryRawUnsafe("SELECT relance.utilisateur_definir_roles($1, 'admin')", moi[0].id);
    }
  );

  // --- LE DERNIER ADMINISTRATEUR ---
  //
  // Le degrader rendrait l'application inadministrable : plus personne ne pourrait
  // creer de compte, y compris pour se redonner le role. C'est un cul-de-sac dont
  // on ne sort qu'en SQL, a la main, sur la base de production.
  await doitRefuser(
    'RPC  le DERNIER administrateur actif ne peut pas etre degrade',
    { login: 'admin.test' },
    ERREUR_METIER,
    async (tx) => {
      const moi = await tx.$queryRawUnsafe<{ id: bigint }[]>(
        'SELECT relance.utilisateur_courant() AS id'
      );
      return tx.$queryRawUnsafe(
        "SELECT relance.utilisateur_definir_roles($1, 'lecteur')",
        moi[0].id
      );
    },
    // NE LAISSER QU'UN SEUL ADMIN ACTIF : celui qui appelle. La preparation
    // s'execute AVANT le changement de role, et il faut qu'il en soit ainsi —
    // sous `authenticated`, aucun `DELETE` n'est accorde, et la suite se heurtait
    // a sa propre protection en croyant tester la regle du dernier administrateur.
    async (tx) => {
      await tx.$executeRawUnsafe(
        `DELETE FROM relance.role_global rg
          WHERE rg.role = 'admin'
            AND rg.utilisateur_id <> (SELECT u.id FROM relance.utilisateur u WHERE u.login_id = 'admin.test')`
      );
    }
  );

  // --- LES DEUX VERROUS DE LA PURGE ---
  //
  // L'archivage prealable oblige a passer par un geste reversible avant
  // l'irreversible ; retaper le nom empeche de purger une ligne pour une autre
  // depuis une liste. Testes SEPAREMENT : un seul des deux qui fonctionne donnerait
  // une suite verte et une protection a moitie absente.
  const archiverLeVendeur = async (tx: Tx) => {
    await tx.vendeur.update({
      where: { id: vendeurHorsTable.id },
      data: { archiveLe: new Date() },
    });
  };

  await doitRefuser(
    'purge  refusee si le vendeur n est PAS archive',
    { login: 'admin.test' },
    ERREUR_METIER,
    rpc('relance.vendeur_purger($1, $2)', vendeurHorsTable.id, vendeurHorsTable.nom)
  );
  await doitRefuser(
    'purge  refusee si le nom retape ne correspond pas',
    { login: 'admin.test' },
    ERREUR_METIER,
    rpc('relance.vendeur_purger($1, $2)', vendeurHorsTable.id, 'PAS LE BON NOM'),
    archiverLeVendeur
  );

  // Et le sens qui manque a beaucoup de suites : la purge DOIT fonctionner quand
  // les deux verrous sont satisfaits. Une porte qui ne s'ouvre jamais n'est pas une
  // protection, c'est une panne.
  await doitValoir(
    'purge  s applique quand le vendeur est archive ET le nom exact retape',
    { login: 'admin.test' },
    0,
    async (tx) => {
      await tx.$queryRawUnsafe(
        'SELECT relance.vendeur_purger($1, $2)',
        vendeurHorsTable.id,
        vendeurHorsTable.nom
      );
      return nombre(
        tx,
        `SELECT count(*) AS n FROM relance.vendeur WHERE id = ${vendeurHorsTable.id}`
      );
    },
    archiverLeVendeur
  );

  // --- R-A.2, LE SONDAGE NE MODIFIE RIEN ---
  //
  // Retirer un jour qui porte des RDV doit RENDRE l'impact sans rien toucher, pour
  // que l'interface propose « annuler ou deplacer ». Une fonction qui appliquerait
  // d'abord et demanderait ensuite serait exactement le defaut que R-A.2 combat.
  await doitValoir(
    'R-A.2  le sondage des jours rend RDV_IMPACTES et ne touche a rien',
    { login: 'admin.test' },
    1,
    async (tx) => {
      const jours = await tx.campagneJour.findMany({
        where: { campagneId: juin.id },
        orderBy: { ordre: 'asc' },
        select: { jour: true },
      });
      const avant = jours.length;
      // On demande a retirer le premier jour, celui sur lequel le RDV vient d'etre pose.
      // CAST EXPLICITE `::date[]`. Prisma serialise un tableau de `Date` en
      // `timestamptz[]`, et PostgreSQL ne trouve alors aucune fonction a la bonne
      // signature — l'erreur (42883, « la fonction n'existe pas ») envoie chercher
      // un probleme de deploiement la ou il n'y a qu'une question de type.
      const restants = jours.slice(1).map((j) => j.jour.toISOString().slice(0, 10));
      const r = await tx.$queryRawUnsafe<Record<string, unknown>[]>(
        'SELECT relance.campagne_definir_jours($1, $2::date[]) AS resultat',
        juin.id,
        restants
      );
      const rendu = r[0].resultat as { code?: string; applique?: boolean } | null;
      const apres = await tx.campagneJour.count({ where: { campagneId: juin.id } });
      return rendu?.code === 'RDV_IMPACTES' && rendu?.applique === false && apres === avant ? 1 : 0;
    },
    async (tx) => {
      await tx.rdv.create({ data: rdvChefDeTableJuin, select: { id: true } });
    }
  );

  // --- LA COMPOSITION D'UNE TABLE EST REMPLACEE, PAS EMPILEE ---
  await doitValoir(
    'RPC  table_definir_vendeurs remplace la composition (et n empile pas)',
    { login: 'admin.test' },
    2,
    async (tx) => {
      const deux = idsDeSaTable.slice(0, 2);
      await tx.$queryRawUnsafe('SELECT relance.table_definir_vendeurs($1, $2)', tableJuin.id, deux);
      return nombre(
        tx,
        `SELECT count(*) AS n FROM relance.affectation
          WHERE table_id = ${tableJuin.id} AND archive_le IS NULL`
      );
    }
  );

  // ------------------------------------------------------------------ rapport

  const largeur = Math.max(...resultats.map((r) => r.nom.length));
  for (const r of resultats) {
    console.log(`${r.ok ? 'OK  ' : 'ECHEC'} ${r.nom.padEnd(largeur)}  ${r.detail}`);
  }

  const reussis = resultats.filter((r) => r.ok).length;
  console.log(`\n${reussis}/${resultats.length} controles de la RLS.`);

  // Ce que cette suite NE couvre PAS, dit explicitement pour que personne ne croie
  // le contraire en la voyant verte :
  console.log(
    [
      '',
      'HORS PORTEE DE CETTE SUITE — a verifier ailleurs :',
      '  - la limite de lignes de PostgREST (1000 par defaut). Elle tronque SANS',
      '    ERREUR et fausserait les totaux : controle a faire contre l API deployee.',
      '  - les reglages du tableau de bord Supabase (schemas exposes, max rows).',
      '  - l Edge Function `gerer-comptes`, seul code serveur restant.',
    ].join('\n')
  );

  if (reussis !== resultats.length) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
