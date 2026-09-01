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
// CETTE SUITE EST AUTONOME — elle n'observe QUE ce qu'elle a fabrique
// ---------------------------------------------------------------------------
// Elle ne lit aucun compte, aucun vendeur, aucune campagne de la production : tout
// son monde est cree dans la transaction de chaque controle, et annule avec elle.
// Voir `poserDecor` plus bas, qui porte le pourquoi en detail.
//
// Consequence directe, et raison du changement : les comptes `.test` peuvent etre
// archives sans la desarmer. Verifie le 01/09/2026 — 87/87 sur Supabase avec les
// cinq comptes desactives.
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
      // LE DECOR D'ABORD, TOUJOURS. Il cree les comptes que `contexte` va
      // designer, et le monde que le controle va observer. La preparation propre
      // au controle vient ensuite : elle peut donc s'appuyer sur le decor.
      await poserDecor(tx);
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
/// `attendu` accepte une FONCTION, et pas seulement un nombre. C'est necessaire
/// depuis que le decor est fabrique dans la transaction : une valeur attendue qui
/// depend du decor — « les deux membres de la table » — n'existe pas encore au
/// moment ou le controle est declare. La fonction est donc evaluee APRES la
/// mesure, quand `decor` porte les valeurs de LA transaction qui vient de tourner.
async function doitValoir(
  nom: string,
  contexte: Contexte,
  attenduOuFonction: number | (() => number),
  mesure: (tx: Tx) => Promise<number>,
  preparation?: (tx: Tx) => Promise<void>
) {
  try {
    const obtenu = await sousIdentite(contexte, mesure, preparation);
    const attendu =
      typeof attenduOuFonction === 'function' ? attenduOuFonction() : attenduOuFonction;
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

// ============================================================================
// LE DECOR — un monde minuscule, complet, et fabrique dans CHAQUE transaction.
//
// POURQUOI IL EXISTE. Cette suite empruntait des comptes et des donnees REELS :
// « la premiere table de juin », « le site d'identifiant le plus bas »,
// « `sbesson` n'a aucun encadrement ». C'etait vrai le jour ou elle a ete ecrite.
//
// Le 01/09/2026, l'outil a commence a servir. `sbesson` est devenue chef de site
// de MASS ; la ligne d'encadrement CLF d'`encadrant.test` a ete reprise par un
// autre compte — l'unique `(site, role)` n'etant pas partiel, la redonner LIBERE
// la ligne precedente. Deux gestes parfaitement legitimes, faits depuis
// l'interface. La suite est passee a 82/87, et les cinq echecs ne disaient RIEN
// sur la RLS : elle se comportait correctement dans les cinq cas.
//
// Pire : archiver les comptes `.test`, ce que demandait la mise en service,
// faisait lever `P2025` a la preparation. Pas un seul des 87 controles ne
// s'executait. LA SUITE QUI GARDE L'UNIQUE BARRIERE D'AUTORISATION ETAIT
// DESARMEE PAR UN MENAGE, et rien ne le signalait.
//
// Une suite de securite ne peut pas dependre de ce que la production contient ce
// jour-la. Elle fabrique donc son propre monde, et n'observe que lui.
//
// ---------------------------------------------------------------------------
// CE QUE LE DECOR CONTIENT, ET POURQUOI CHAQUE PIECE
// ---------------------------------------------------------------------------
//
//   plaque RLS
//     site RLS-A   vendeurs A1 (table), A2 (hors table), A3 (table)
//     site RLS-B   vendeurs B1, B2          <- les seuls sites de `encadrant.rls`
//
//   campagne RLS 1   2 jours, 1 creneau     <- celle ou le chef de table officie
//   campagne RLS 2   2 jours, 1 creneau     <- pour prouver que ses droits n'y vont pas
//
//   session (RLS 1 x plaque RLS), mode par_table
//     table « TABLE RLS », chef = chef.rls, membres A1 et A3
//
//   comptes  admin.rls · direction.rls · encadrant.rls · lecteur.rls · chef.rls
//   encadrement  encadrant.rls -> site RLS-B  (RLS-A volontairement exclu)
//
// LES DEUX PERIMETRES SONT DISJOINTS, et c'est le point : le chef de table tient
// A1 et A3, l'encadrant tient B1 et B2. Un controle qui confondrait les deux
// origines de droit passerait au vert sur un decor ou elles se recouvrent.
//
// A2 n'est ni dans la table ni sur un site encadre : c'est le vendeur hors
// perimetre de tout le monde, celui par lequel on prouve les refus.
//
// DEUX MEMBRES DE TABLE ET DEUX VENDEURS ENCADRES, jamais un seul : un controle
// de COMPTE exact qui attend 1 peut passer par hasard, celui qui attend 2 non.
//
// ---------------------------------------------------------------------------
// TOUT EST ANNULE, TOUJOURS
// ---------------------------------------------------------------------------
// `poserDecor` s'execute dans la transaction de `sousIdentite`, qui se termine
// toujours par un ROLLBACK. Rien ne subsiste — ni les comptes, ni la plaque, ni
// les `auth_uid` fictifs. C'est ce qui permet d'employer des noms FIXES sans
// jamais entrer en collision : deux controles ne sont jamais simultanes.
//
// C'est aussi ce qui rend la suite jouable sur la base de PRODUCTION sans rien y
// laisser — indispensable, puisqu'une politique RLS ne se teste utilement que la
// ou elle est deployee.
// ============================================================================

interface Decor {
  siteA: bigint;
  siteB: bigint;
  /// Dans la table du chef.
  vendeurDeSaTable: { id: bigint; nom: string; siteId: bigint };
  /// Ni dans la table, ni sur un site encadre : hors perimetre de tous.
  vendeurHorsPerimetre: { id: bigint; nom: string; siteId: bigint };
  /// Sur le site encadre par `encadrant.rls`.
  vendeurEncadre: { id: bigint; nom: string; siteId: bigint };
  /// Les membres de la table, dans l'ordre de creation.
  membresDeLaTable: bigint[];
  /// Combien de vendeurs sur les sites encadres.
  vendeursEncadres: number;
  campagne1: { id: bigint; jours: string[]; creneau: string };
  campagne2: { id: bigint; jours: string[]; creneau: string };
  tableId: bigint;
}

/// Rempli par `poserDecor` a CHAQUE transaction. Les controles le lisent au
/// moment de leur EXECUTION — jamais a la construction de leur fermeture — ce qui
/// leur donne les identifiants du decor courant.
let decor: Decor;

const CHEF = 'chef.rls';
const ADMIN = 'admin.rls';
const DIRECTION = 'direction.rls';
const ENCADRANT = 'encadrant.rls';
const LECTEUR = 'lecteur.rls';

async function poserDecor(tx: Tx): Promise<void> {
  const compte = async (loginId: string, nom: string) =>
    (
      await tx.utilisateur.create({
        data: { loginId, nom, passwordHash: 'x', actif: true },
        select: { id: true },
      })
    ).id;

  const idAdmin = await compte(ADMIN, 'ADMIN decor RLS');
  const idDirection = await compte(DIRECTION, 'DIRECTION decor RLS');
  const idEncadrant = await compte(ENCADRANT, 'ENCADRANT decor RLS');
  const idLecteur = await compte(LECTEUR, 'LECTEUR decor RLS');
  const idChef = await compte(CHEF, 'CHEF DE TABLE decor RLS');

  await tx.roleGlobal.createMany({
    data: [
      { utilisateurId: idAdmin, role: 'admin' },
      { utilisateurId: idDirection, role: 'direction' },
      { utilisateurId: idLecteur, role: 'lecteur' },
    ],
  });

  const plaque = await tx.plaque.create({
    data: { libelle: 'PLAQUE RLS', ordre: 990 },
    select: { id: true },
  });
  const siteA = await tx.site.create({
    data: { code: 'RLS-A', libelle: 'Site RLS A', plaqueId: plaque.id },
    select: { id: true },
  });
  const siteB = await tx.site.create({
    data: { code: 'RLS-B', libelle: 'Site RLS B', plaqueId: plaque.id },
    select: { id: true },
  });

  // TOUS EN `VO`, deliberement : un vendeur VO n'a aucune marque a poser, donc
  // aucun controle ne peut trebucher sur R-C.1 en croyant eprouver la RLS. Les
  // regles de marque sont couvertes par `test:garde-fous`, avec ses fixtures.
  const vendeur = (nom: string, siteId: bigint) =>
    tx.vendeur.create({
      data: { nom, siteId, typeVehicule: 'VO' },
      select: { id: true, nom: true, siteId: true },
    });

  const a1 = await vendeur('DECOR A1', siteA.id);
  const a2 = await vendeur('DECOR A2', siteA.id);
  const a3 = await vendeur('DECOR A3', siteA.id);
  const b1 = await vendeur('DECOR B1', siteB.id);
  await vendeur('DECOR B2', siteB.id);

  await tx.encadrementSite.create({
    data: { siteId: siteB.id, utilisateurId: idEncadrant, role: 'chef_de_site' },
  });

  /// Une campagne du decor : DEUX jours — le second permet a R-A.2 d'en retirer un
  /// sans vider la campagne — et un seul creneau, qui suffit a composer un RDV.
  const campagne = async (libelle: string, premier: string, second: string) => {
    const c = await tx.campagne.create({
      data: {
        libelle,
        dateDebut: new Date(premier),
        dateFin: new Date(second),
        cloturee: false,
      },
      select: { id: true },
    });
    await tx.campagneJour.createMany({
      data: [
        { campagneId: c.id, jour: new Date(premier), ordre: 1 },
        { campagneId: c.id, jour: new Date(second), ordre: 2 },
      ],
    });
    await tx.campagneCreneau.create({
      data: { campagneId: c.id, code: '08:00-09:00', libelle: '8h-9h', ordre: 1 },
    });
    return { id: c.id, jours: [premier, second], creneau: '08:00-09:00' };
  };

  const campagne1 = await campagne('CAMPAGNE RLS 1', '2026-03-02', '2026-03-03');
  const campagne2 = await campagne('CAMPAGNE RLS 2', '2026-04-06', '2026-04-07');

  const session = await tx.sessionPlaque.create({
    data: { campagneId: campagne1.id, plaqueId: plaque.id, mode: 'par_table' },
    select: { id: true },
  });
  const table = await tx.tablePhoning.create({
    data: {
      sessionPlaqueId: session.id,
      libelle: 'TABLE RLS',
      ordre: 1,
      chefUtilisateurId: idChef,
    },
    select: { id: true },
  });
  await tx.affectation.createMany({
    data: [
      { tableId: table.id, vendeurId: a1.id, origine: 'manuel' },
      { tableId: table.id, vendeurId: a3.id, origine: 'manuel' },
    ],
  });

  decor = {
    siteA: siteA.id,
    siteB: siteB.id,
    vendeurDeSaTable: a1,
    vendeurHorsPerimetre: a2,
    vendeurEncadre: b1,
    membresDeLaTable: [a1.id, a3.id],
    vendeursEncadres: 2,
    campagne1,
    campagne2,
    tableId: table.id,
  };
}

/// Un RDV valide pour un vendeur du decor : jour et creneau de la campagne visee,
/// `marqueId` nul puisque tous les vendeurs du decor sont VO. Sans cela, un refus
/// de trigger se ferait passer pour un refus de politique — et la suite prouverait
/// autre chose que ce qu'elle annonce.
const rdvDecor = (
  vendeur: { id: bigint },
  campagne: { id: bigint; jours: string[]; creneau: string },
  jour = 0
) => ({
  campagneId: campagne.id,
  vendeurId: vendeur.id,
  jour: new Date(campagne.jours[jour]!),
  creneauCode: campagne.creneau,
  marqueId: null,
  typeVehicule: 'VO',
  client: 'CONTROLE RLS',
});

async function main() {
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
       VALUES (${decor.campagne1.id}, ${decor.vendeurDeSaTable.id}, '2026-06-11', 'X', 'VN', 'INTRUSION')`
    )
  );
  await doitRefuser('anon  lire le perimetre de quelqu un', 'anonyme', DROIT_INSUFFISANT, (tx) =>
    tx.$queryRawUnsafe('SELECT vendeur_id FROM relance.perimetre_saisie LIMIT 1')
  );

  // =========================================================================
  // 2. ADMIN — tout, gestion des comptes comprise.
  // =========================================================================

  // ADMIN N'EST BORNE PAR AUCUN PERIMETRE. On le prouve sur un RDV pose HORS de
  // tout perimetre : un chef de table ne le verrait pas, un admin si.
  //
  // Une version precedente comparait au nombre TOTAL de RDV en base. C'etait
  // exact, mais cela liait la suite au contenu de la production — et le nombre
  // pouvait bouger pendant l'execution.
  await doitValoir(
    'admin  voit un RDV hors de tout perimetre',
    { login: ADMIN },
    1,
    (tx) =>
      nombre(
        tx,
        `SELECT count(*) AS n FROM relance.rdv WHERE vendeur_id = ${decor.vendeurHorsPerimetre.id}`
      ),
    (tx) =>
      tx.rdv
        .create({ data: rdvDecor(decor.vendeurHorsPerimetre, decor.campagne1), select: { id: true } })
        .then(() => undefined)
  );
  await doitAccepter('admin  saisit sur n importe quel vendeur', { login: ADMIN }, (tx) =>
    tx.rdv.create({ data: rdvDecor(decor.vendeurHorsPerimetre, decor.campagne1) })
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
    { login: ADMIN },
    DROIT_INSUFFISANT,
    (tx) =>
      tx.utilisateur.create({
        data: { loginId: 'controle.rls.complet', nom: 'CONTROLE RLS', passwordHash: 'x' },
      })
  );
  await doitAccepter('admin  cree un compte', { login: ADMIN }, (tx) =>
    tx.utilisateur.create({
      data: { loginId: 'controle.rls', nom: 'CONTROLE RLS', passwordHash: 'x' },
      select: { id: true },
    })
  );
  await doitAccepter('admin  attribue un role global', { login: ADMIN }, async (tx) => {
    const u = await tx.utilisateur.create({
      data: { loginId: 'controle.rls.role', nom: 'CONTROLE RLS', passwordHash: 'x' },
      select: { id: true },
    });
    return tx.roleGlobal.create({ data: { utilisateurId: u.id, role: 'lecteur' } });
  });
  await doitAccepter('admin  administre un referentiel', { login: ADMIN }, (tx) =>
    tx.marque.create({ data: { code: 'CONTROLE', libelle: 'Controle RLS', ordre: 99 } })
  );

  // =========================================================================
  // 3. DIRECTION — tout SAUF la gestion des comptes.
  //
  // C'est LA frontiere entre les deux paliers hauts, et la raison pour laquelle
  // elle existe : sans elle, `direction` pourrait se promouvoir `admin`. Les trois
  // controles ci-dessous sont les trois chemins par lesquels il essaierait.
  // =========================================================================

  await doitAccepter('direction  saisit (acces total)', { login: DIRECTION }, (tx) =>
    tx.rdv.create({ data: rdvDecor(decor.vendeurHorsPerimetre, decor.campagne1) })
  );
  await doitAccepter('direction  administre un referentiel', { login: DIRECTION }, (tx) =>
    tx.marque.create({ data: { code: 'CONTROLE2', libelle: 'Controle RLS', ordre: 99 } })
  );
  await doitRefuser(
    'direction  creer un compte',
    { login: DIRECTION },
    DROIT_INSUFFISANT,
    (tx) =>
      tx.utilisateur.create({
        data: { loginId: 'promotion.interdite', nom: 'NON', passwordHash: 'x' },
        select: { id: true },
      })
  );
  await doitRefuser(
    'direction  SE PROMOUVOIR admin',
    { login: DIRECTION },
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
    { login: DIRECTION },
    DROIT_INSUFFISANT,
    async (tx) => {
      const moi = await tx.$queryRawUnsafe<{ id: bigint }[]>(
        `SELECT relance.utilisateur_courant() AS id`
      );
      return tx.encadrementSite.create({
        data: {
          siteId: decor.vendeurHorsPerimetre.siteId,
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

  await doitAccepter('encadrant  saisit sur son site — JUIN', { login: ENCADRANT }, (tx) =>
    tx.rdv.create({ data: rdvDecor(decor.vendeurEncadre, decor.campagne1) })
  );
  await doitAccepter(
    'encadrant  saisit sur son site — SEPTEMBRE (rattachement durable)',
    { login: ENCADRANT },
    (tx) => tx.rdv.create({ data: rdvDecor(decor.vendeurEncadre, decor.campagne2) })
  );
  await doitRefuser(
    'encadrant  saisit HORS de ses sites',
    { login: ENCADRANT },
    DROIT_INSUFFISANT,
    (tx) => tx.rdv.create({ data: rdvDecor(decor.vendeurHorsPerimetre, decor.campagne1) })
  );
  await doitRefuser(
    'encadrant  administre (creer un vendeur)',
    { login: ENCADRANT },
    DROIT_INSUFFISANT,
    (tx) =>
      tx.vendeur.create({
        data: { nom: 'CONTROLE RLS', siteId: decor.vendeurEncadre.siteId, typeVehicule: 'VN' },
      })
  );
  await doitRefuser(
    'encadrant  gere les comptes',
    { login: ENCADRANT },
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
    `chef de table  saisit sur sa table — ${'TABLE RLS'}, JUIN`,
    { login: CHEF },
    (tx) => tx.rdv.create({ data: rdvDecor(decor.vendeurDeSaTable, decor.campagne1) })
  );
  await doitRefuser(
    'chef de table  LE MEME VENDEUR sur une AUTRE campagne',
    { login: CHEF },
    DROIT_INSUFFISANT,
    (tx) => tx.rdv.create({ data: rdvDecor(decor.vendeurDeSaTable, decor.campagne2) })
  );
  await doitRefuser(
    'chef de table  un vendeur hors de sa table',
    { login: CHEF },
    DROIT_INSUFFISANT,
    (tx) => tx.rdv.create({ data: rdvDecor(decor.vendeurHorsPerimetre, decor.campagne1) })
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
    await tx.rdv.create({ data: rdvDecor(decor.vendeurDeSaTable, decor.campagne1), select: { id: true } });
    await tx.rdv.create({ data: rdvDecor(decor.vendeurHorsPerimetre, decor.campagne1), select: { id: true } });
  };


  await doitValoir(
    'chef de table  ne voit AUCUN RDV hors de son perimetre (un y est pourtant pose)',
    { login: CHEF },
    0,
    (tx) =>
      nombre(tx, `SELECT count(*) AS n FROM relance.rdv WHERE vendeur_id = ${decor.vendeurHorsPerimetre.id}`),
    poserLesDeuxRdv
  );

  // Le sens inverse, sans lequel le controle precedent serait satisfait par une
  // base qui ne montre rien a personne.
  await doitValoir(
    'chef de table  voit BIEN les RDV de son perimetre',
    { login: CHEF },
    // UN, et pas « ce qu'il y avait plus un » : le vendeur du decor vient d'etre
    // cree, il ne peut porter que le RDV que la preparation vient de poser.
    1,
    (tx) =>
      nombre(tx, `SELECT count(*) AS n FROM relance.rdv WHERE vendeur_id = ${decor.vendeurDeSaTable.id}`),
    poserLesDeuxRdv
  );

  // =========================================================================
  // 6. LECTEUR — lit les agregats, n'ecrit rien.
  //
  // `lecteur` n'apparait dans AUCUNE liste d'ecriture, et c'est ce qui le rend
  // lecture seule. Le compte est cree ici, dans la transaction, puis annule.
  // =========================================================================

  // `lecteur.rls` fait partie du DECOR : il n'y a plus de preparation a passer.
  // Une version precedente le creait dans chaque controle — c'etait le premier
  // endroit ou cette suite fabriquait sa propre donnee au lieu de l'emprunter, et
  // c'est ce motif qui a fini par etre generalise a tout le reste.

  // Le lecteur voit les AGREGATS — sans perimetre, mais sans nom de client non
  // plus. Mesure sur le RDV du decor plutot que sur le total de la base : la
  // question est « la vue lui est-elle ouverte ? », pas « combien y a-t-il de RDV
  // en production ce matin ? ».
  await doitValoir(
    'lecteur  lit les agregats',
    { login: LECTEUR },
    1,
    (tx) =>
      nombre(
        tx,
        `SELECT count(*) AS n FROM relance.rdv_agrege WHERE vendeur_id = ${decor.vendeurHorsPerimetre.id}`
      ),
    (tx) =>
      tx.rdv
        .create({ data: rdvDecor(decor.vendeurHorsPerimetre, decor.campagne1), select: { id: true } })
        .then(() => undefined)
  );
  await doitRefuser(
    'lecteur  saisit un RDV',
    { login: LECTEUR },
    DROIT_INSUFFISANT,
    (tx) => tx.rdv.create({ data: rdvDecor(decor.vendeurHorsPerimetre, decor.campagne1) })
  );
  await doitRefuser(
    'lecteur  administre un referentiel',
    { login: LECTEUR },
    DROIT_INSUFFISANT,
    (tx) => tx.marque.create({ data: { code: 'NON', libelle: 'Non', ordre: 99 } })
  );
  await doitValoir(
    'lecteur  ne voit AUCUN RDV nominatif (perimetre vide)',
    { login: LECTEUR },
    0,
    (tx) => nombre(tx, 'SELECT count(*) AS n FROM relance.rdv')
  );

  // =========================================================================
  // 7. COMPTE DESACTIVE OU ARCHIVE — aucun droit, pas meme la lecture.
  //
  // Transcription de `DROITS_VIDES` : un compte qui n'est plus actif ne doit pas
  // pouvoir consulter les classements. Le refus est SILENCIEUX (zero ligne) et non
  // bruyant, parce que `utilisateur_courant()` rend NULL : d'ou `doitValoir`.
  // =========================================================================

  const desactiver = async (tx: Tx) => {
    await tx.utilisateur.update({ where: { loginId: ADMIN }, data: { actif: false } });
  };
  const archiver = async (tx: Tx) => {
    await tx.utilisateur.update({
      where: { loginId: ADMIN },
      data: { archiveLe: new Date() },
    });
  };

  await doitValoir(
    'compte DESACTIVE  ne lit aucun vendeur (bien qu il soit admin)',
    { login: ADMIN },
    0,
    (tx) => nombre(tx, 'SELECT count(*) AS n FROM relance.vendeur'),
    desactiver
  );
  await doitValoir(
    'compte ARCHIVE  ne lit aucun vendeur (bien qu il soit admin)',
    { login: ADMIN },
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
    { login: ADMIN },
    0,
    (tx) => nombre(tx, 'SELECT count(*) AS n FROM relance.rdv_agrege'),
    desactiver
  );
  await doitValoir(
    'compte ARCHIVE  ne lit AUCUN agregat',
    { login: ADMIN },
    0,
    (tx) => nombre(tx, 'SELECT count(*) AS n FROM relance.rdv_agrege'),
    archiver
  );
  await doitValoir(
    'compte DESACTIVE  n a aucun perimetre',
    { login: ADMIN },
    0,
    (tx) => nombre(tx, 'SELECT count(*) AS n FROM relance.perimetre_saisie'),
    desactiver
  );

  await doitRefuser(
    'compte DESACTIVE  n ecrit rien',
    { login: ADMIN },
    DROIT_INSUFFISANT,
    (tx) => tx.rdv.create({ data: rdvDecor(decor.vendeurHorsPerimetre, decor.campagne1) }),
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
      { login: ADMIN },
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
    { login: ADMIN },
    DROIT_INSUFFISANT,
    (tx) => tx.$queryRawUnsafe('SELECT password_hash FROM relance.utilisateur LIMIT 1')
  );
  await doitRefuser(
    'colonnes  auth_uid d autrui illisible',
    { login: ADMIN },
    DROIT_INSUFFISANT,
    (tx) => tx.$queryRawUnsafe('SELECT auth_uid FROM relance.utilisateur LIMIT 1')
  );
  await doitRefuser(
    'colonnes  le nom du client est ABSENT de rdv_agrege',
    { login: ADMIN },
    COLONNE_INEXISTANTE,
    (tx) => tx.$queryRawUnsafe('SELECT client FROM relance.rdv_agrege LIMIT 1')
  );
  await doitRefuser(
    'colonnes  le commentaire est ABSENT de rdv_agrege',
    { login: ADMIN },
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
    await tx.campagne.update({ where: { id: decor.campagne1.id }, data: { cloturee: true } });
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
    { login: ADMIN },
    ERREUR_METIER,
    (tx) => tx.rdv.create({ data: rdvDecor(decor.vendeurHorsPerimetre, decor.campagne1), select: { id: true } }),
    cloturerJuin
  );

  // =========================================================================
  // 11. LE PERIMETRE EST BIEN CELUI DE `vendeursSaisissables`.
  //
  // La vue `perimetre_saisie` est la transcription du portail. Si elle ne rend rien
  // pour un compte qui a des droits, les ecrans seront vides sans erreur — le mode
  // d'echec silencieux. On verifie donc qu'elle rend un nombre NON NUL et exact.
  // =========================================================================

  // LE COMPTE EXACT, pas « au moins un ». Une politique trop large rendrait un
  // nombre plus grand, une politique trop etroite un nombre plus petit : seul
  // l'egalite stricte attrape les deux. Le decor pose DEUX vendeurs sur le site
  // encadre, precisement pour qu'un `1` obtenu par hasard ne passe pas.
  await doitValoir(
    'perimetre  l encadrant voit exactement les vendeurs de ses sites',
    { login: ENCADRANT },
    () => decor.vendeursEncadres,
    (tx) =>
      nombre(
        tx,
        `SELECT count(*) AS n FROM relance.perimetre_saisie WHERE campagne_id = ${decor.campagne1.id}`
      )
  );
  await doitValoir(
    'perimetre  le chef de table voit exactement les vendeurs de sa table',
    { login: CHEF },
    () => decor.membresDeLaTable.length,
    (tx) =>
      nombre(
        tx,
        `SELECT count(*) AS n FROM relance.perimetre_saisie WHERE campagne_id = ${decor.campagne1.id}`
      )
  );
  await doitValoir(
    'perimetre  le chef de table n a AUCUN vendeur sur l autre campagne',
    { login: CHEF },
    0,
    (tx) =>
      nombre(
        tx,
        `SELECT count(*) AS n FROM relance.perimetre_saisie WHERE campagne_id = ${decor.campagne2.id}`
      )
  );
  await doitValoir(
    'perimetre  un compte anonyme n a aucun perimetre (vue vide, pas d erreur interne)',
    { login: LECTEUR },
    0,
    (tx) => nombre(tx, 'SELECT count(*) AS n FROM relance.perimetre_saisie')
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
    { login: CHEF },
    1,
    async (tx) => {
      const cree = await tx.rdv.create({
        // Le client ment deliberement : il se declare auteur sous l identifiant 1.
        data: { ...rdvDecor(decor.vendeurDeSaTable, decor.campagne1), creePar: BigInt(1) },
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

  /// LES PARAMETRES SONT UNE FONCTION, PAS DES VALEURS.
  ///
  /// Une premiere version prenait `...params: unknown[]`, donc evalues au moment
  /// ou le controle est DECLARE — c'est-a-dire hors transaction, avec le decor de
  /// la transaction PRECEDENTE, dont les lignes sont deja annulees. Les deux
  /// controles qui creent vraiment un vendeur echouaient sur une violation de cle
  /// etrangere : le site passe n'existait plus.
  ///
  /// La suite a donc attrape mon propre defaut, ce qui est exactement son role.
  const rpc =
    (appel: string, params: () => unknown[]) =>
    (tx: Tx) =>
      tx.$queryRawUnsafe(`SELECT ${appel}`, ...params());

  await doitRefuser(
    'RPC  anon ne peut executer AUCUNE fonction privilegiee',
    'anonyme',
    DROIT_INSUFFISANT,
    rpc('relance.vendeur_purger($1, $2)', () => [decor.vendeurHorsPerimetre.id, 'peu importe'])
  );
  await doitRefuser(
    'RPC  anon ne peut pas appeler la composition des tables',
    'anonyme',
    DROIT_INSUFFISANT,
    rpc('relance.table_definir_vendeurs($1, $2)', () => [decor.tableId, []])
  );

  // LES GARDES INTERNES NE SONT PAS EXPOSES. `poser_capacites` laisserait reecrire
  // les marques d'un vendeur sans passer par les controles de `vendeur_modifier`.
  await doitRefuser(
    'RPC  poser_capacites reste une brique interne, non exposee',
    { login: ADMIN },
    DROIT_INSUFFISANT,
    rpc('relance.poser_capacites($1, $2, $3, $4)', () => [
      decor.vendeurHorsPerimetre.id,
      [],
      'VO',
      BigInt(1),
    ])
  );

  // --- le palier est bien verifie DANS la fonction ---

  await doitRefuser(
    'RPC  un encadrant ne peut pas creer de vendeur',
    { login: ENCADRANT },
    ERREUR_METIER,
    rpc("relance.vendeur_creer($1, $2, 'VO')", () => ['REFUS RPC', decor.vendeurEncadre.siteId])
  );
  await doitRefuser(
    'RPC  un lecteur ne peut pas creer de vendeur',
    { login: LECTEUR },
    ERREUR_METIER,
    rpc("relance.vendeur_creer($1, $2, 'VO')", () => ['REFUS RPC', decor.vendeurEncadre.siteId])
  );
  await doitAccepter(
    'RPC  un admin cree un vendeur',
    { login: ADMIN },
    rpc("relance.vendeur_creer($1, $2, 'VO')", () => ['CONTROLE RPC', decor.vendeurEncadre.siteId])
  );

  // LA FRONTIERE ADMIN / DIRECTION, cote RPC cette fois. `direction` administre les
  // referentiels mais ne touche pas aux comptes : sans cela, il se promeut.
  await doitAccepter(
    'RPC  direction cree un vendeur (referentiel)',
    { login: DIRECTION },
    rpc("relance.vendeur_creer($1, $2, 'VO')", () => [
      'CONTROLE RPC DIRECTION',
      decor.vendeurEncadre.siteId,
    ])
  );
  await doitRefuser(
    'RPC  direction ne peut pas attribuer un role global',
    { login: DIRECTION },
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
    { login: ADMIN },
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
            AND rg.utilisateur_id <> (SELECT u.id FROM relance.utilisateur u WHERE u.login_id = '${ADMIN}')`
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
      where: { id: decor.vendeurHorsPerimetre.id },
      data: { archiveLe: new Date() },
    });
  };

  await doitRefuser(
    'purge  refusee si le vendeur n est PAS archive',
    { login: ADMIN },
    ERREUR_METIER,
    rpc('relance.vendeur_purger($1, $2)', () => [
      decor.vendeurHorsPerimetre.id,
      decor.vendeurHorsPerimetre.nom,
    ])
  );
  await doitRefuser(
    'purge  refusee si le nom retape ne correspond pas',
    { login: ADMIN },
    ERREUR_METIER,
    rpc('relance.vendeur_purger($1, $2)', () => [
      decor.vendeurHorsPerimetre.id,
      'PAS LE BON NOM',
    ]),
    archiverLeVendeur
  );

  // Et le sens qui manque a beaucoup de suites : la purge DOIT fonctionner quand
  // les deux verrous sont satisfaits. Une porte qui ne s'ouvre jamais n'est pas une
  // protection, c'est une panne.
  await doitValoir(
    'purge  s applique quand le vendeur est archive ET le nom exact retape',
    { login: ADMIN },
    0,
    async (tx) => {
      await tx.$queryRawUnsafe(
        'SELECT relance.vendeur_purger($1, $2)',
        decor.vendeurHorsPerimetre.id,
        decor.vendeurHorsPerimetre.nom
      );
      return nombre(
        tx,
        `SELECT count(*) AS n FROM relance.vendeur WHERE id = ${decor.vendeurHorsPerimetre.id}`
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
    { login: ADMIN },
    1,
    async (tx) => {
      const jours = await tx.campagneJour.findMany({
        where: { campagneId: decor.campagne1.id },
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
        decor.campagne1.id,
        restants
      );
      const rendu = r[0].resultat as { code?: string; applique?: boolean } | null;
      const apres = await tx.campagneJour.count({ where: { campagneId: decor.campagne1.id } });
      return rendu?.code === 'RDV_IMPACTES' && rendu?.applique === false && apres === avant ? 1 : 0;
    },
    async (tx) => {
      await tx.rdv.create({ data: rdvDecor(decor.vendeurDeSaTable, decor.campagne1), select: { id: true } });
    }
  );

  // --- LA COMPOSITION D'UNE TABLE EST REMPLACEE, PAS EMPILEE ---
  await doitValoir(
    'RPC  table_definir_vendeurs remplace la composition (et n empile pas)',
    { login: ADMIN },
    2,
    async (tx) => {
      const deux = decor.membresDeLaTable.slice(0, 2);
      await tx.$queryRawUnsafe('SELECT relance.table_definir_vendeurs($1, $2)', decor.tableId, deux);
      return nombre(
        tx,
        `SELECT count(*) AS n FROM relance.affectation
          WHERE table_id = ${decor.tableId} AND archive_le IS NULL`
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
