// ============================================================================
// VERIFICATION DES ROUTES — contre un serveur EN MARCHE.
//
// Prerequis : `npm --prefix backend run dev` dans un autre terminal.
// Usage     : SEED_MOT_DE_PASSE=... npm --prefix backend run test:api
//
// Couvre ce que les tests de garde-fous ne peuvent pas atteindre : le portail
// d'autorisation, l'import en deux temps, et R-A.2 traite par l'API plutot que
// subi comme une erreur de contrainte.
//
// Ce script ECRIT en base (RDV de test, marques d'un vendeur). Il nettoie derriere
// lui — en ARCHIVANT, puisque la suppression est interdite — et annonce ce qu'il
// laisse. A ne pas lancer sur une base de production.
// ============================================================================

const BASE = process.env.API_BASE ?? 'http://localhost:3001';
const MOT_DE_PASSE = process.env.SEED_MOT_DE_PASSE;

if (!MOT_DE_PASSE) {
  console.error(
    'SEED_MOT_DE_PASSE est requis : le script se connecte avec les comptes du seed.\n' +
      'Exemple : SEED_MOT_DE_PASSE=xxxx npm --prefix backend run test:api'
  );
  process.exit(1);
}

/// Nom du vendeur cree par ce script. Voir la section « prealable » de main().
const NOM_TEST = 'VENDEUR VERIF API';

/// Nom du client porte par les RDV de test. C'est LE MARQUEUR qui permet de les
/// retrouver et de les purger au passage suivant : aucun client reel ne s'appelle
/// ainsi. Ecrit ici et nulle part ailleurs (interdit n.6 : pas de liste de valeurs
/// dupliquee sans controle).
const CLIENT_TEST = 'CLIENT VERIF API';

const resultats: { nom: string; ok: boolean; detail: string }[] = [];
const verifier = (nom: string, ok: boolean, detail: string) => resultats.push({ nom, ok, detail });

interface Reponse<T = any> {
  statut: number;
  corps: T;
}

async function appeler<T = any>(
  methode: string,
  chemin: string,
  options: { jeton?: string; corps?: unknown } = {}
): Promise<Reponse<T>> {
  const entetes: Record<string, string> = {};
  if (options.jeton) entetes['Authorization'] = `Bearer ${options.jeton}`;
  if (options.corps !== undefined) entetes['Content-Type'] = 'application/json';

  const r = await fetch(`${BASE}${chemin}`, {
    method: methode,
    headers: entetes,
    body: options.corps === undefined ? undefined : JSON.stringify(options.corps),
  });
  const texte = await r.text();
  let corps: any = texte;
  try {
    corps = JSON.parse(texte);
  } catch {
    /* reponse non JSON */
  }
  return { statut: r.status, corps };
}

const connexion = async (loginId: string): Promise<string> => {
  const r = await appeler('POST', '/api/auth/login', { corps: { loginId, motDePasse: MOT_DE_PASSE } });
  if (r.statut !== 200 || !r.corps?.jeton) {
    throw new Error(`Connexion ${loginId} impossible (${r.statut}) : ${JSON.stringify(r.corps)}`);
  }
  return r.corps.jeton;
};

// ============================================================================
// CE QUE LE SCRIPT DOIT RENDRE, QUOI QU'IL ARRIVE.
//
// Ce script MODIFIE des donnees metier : les jours de la campagne de septembre,
// les marques et le metier de deux vendeurs. Une version precedente restaurait en
// fin de `main()`, donc JAMAIS en cas d'exception.
//
// Ce n'est pas theorique : une simple erreur de serialisation `BigInt` a fait
// planter le script en plein milieu, deux fois de suite. Resultat — la campagne de
// septembre s'est retrouvee avec 9 jours au lieu de 5 et ses dates ramenees a
// l'ancien placeholder du seed. Il a fallu la reparer a la main, et le defaut
// aurait pu passer inapercu jusqu'a une session reelle.
//
// D'ou ce carnet, rempli au fur et a mesure et consomme par `restaurer()` dans un
// `finally`. Une entree a `null` veut dire << rien a remettre pour celle-la >>.
// ============================================================================
interface Carnet {
  jours: string[] | null;
  rdvTestId: bigint | null;
  vendeurs:
    | Map<
        string,
        {
          typeVehicule: string;
          capacitesModifieesLe: Date | null;
          capacitesModifieesPar: bigint | null;
          marques: { marqueId: bigint }[];
        }
      >
    | null;
}

async function main() {
  const sante = await appeler('GET', '/api/sante');
  if (sante.statut !== 200) {
    console.error(`API injoignable sur ${BASE}. Lancer : npm --prefix backend run dev`);
    process.exit(1);
  }

  const jetonAdmin = await connexion('admin');
  const jetonChef = await connexion('sbesson'); // chef de table, aucun droit global

  // ------------------------------------------------------------ prealable
  // CONSEQUENCE DE L'INTERDIT N.1 a connaitre : ce script cree un vendeur, et un
  // vendeur ne peut pas etre supprime — le trigger `vendeur_pas_de_delete` s'y
  // oppose, ce qui est exactement le comportement voulu en production. Un test
  // d'integration qui cree une entite metier laisse donc une trace permanente.
  //
  // D'ou ce prealable : chaque passage commence par effacer le residu du passage
  // precedent, par la porte de purge. Le nom redevient libre, le compteur de
  // vendeurs actifs ne bouge pas, et la base ne grossit pas d'un passage a l'autre.
  //
  // Pour une base reellement propre : `drop schema relance cascade`, puis
  // `migrate:deploy` et `seed`.
  const { PrismaClient: PC } = await import('@prisma/client');
  const prismaPrealable = new PC();
  // ON LES PURGE, on ne se contente plus de les renommer.
  //
  // La version precedente les sortait au 01/01/2026 sous un nom unique. Les
  // chiffres metier etaient bien proteges — `presenceVendeur` ne compte pas un
  // sorti — mais chaque passage en LAISSAIT UN DE PLUS : seize lignes
  // « VENDEUR VERIF API #NNN » s'etaient accumulees a Mozac, visibles dans
  // l'onglet des vendeurs archives. Du residu qui grossit n'est pas un residu
  // inoffensif : c'est un residu qu'on finit par prendre pour une donnee.
  //
  // La porte de purge existe exactement pour ca (migration `20260831140000`), et
  // ces lignes remplissent ses conditions : elles sont fictives, elles ne portent
  // que des RDV fictifs, et rien d'historique n'en depend. Le filtrage est etroit
  // — le nom commence par NOM_TEST, qu'aucun vendeur reel ne porte.
  const anciens = await prismaPrealable.vendeur.findMany({
    where: { nom: { startsWith: NOM_TEST } },
    select: { id: true },
  });

  for (const v of anciens) {
    await prismaPrealable.$transaction(async (tx) => {
      // `SET LOCAL` : la porte meurt avec la transaction, et aucune autre session
      // n'est affectee.
      await tx.$executeRawUnsafe(`SET LOCAL relance.purge_autorisee = 'oui'`);
      await tx.rdv.deleteMany({ where: { vendeurId: v.id } });
      await tx.affectation.deleteMany({ where: { vendeurId: v.id } });
      await tx.vendeurMarque.deleteMany({ where: { vendeurId: v.id } });
      await tx.vendeur.delete({ where: { id: v.id } });
    });
  }

  // Les RDV de test, eux, ne sont PAS poses sur le vendeur de test : ils le sont
  // sur un vendeur reel, parce que la suite doit eprouver le vrai chemin de saisie
  // — perimetre, trigger de marque, cles composites du jour et du creneau. Le
  // script les archive en fin de course (interdit n.1 : jamais de DELETE par
  // l'application), donc ils ne comptent dans aucun total. Mais ils RESTENT, et
  // douze lignes « CLIENT VERIF API » archivees s'etaient empilees sur un vendeur
  // de Clermont. Sur la donnee de quelqu'un d'autre, c'est pire que sur la mienne.
  const rdvResiduels = await prismaPrealable.rdv.findMany({
    where: { client: CLIENT_TEST },
    select: { id: true },
  });

  if (rdvResiduels.length > 0) {
    await prismaPrealable.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL relance.purge_autorisee = 'oui'`);
      await tx.rdv.deleteMany({ where: { id: { in: rdvResiduels.map((r) => r.id) } } });
    });
  }

  if (anciens.length > 0 || rdvResiduels.length > 0) {
    console.log(
      `  Residu des passages precedents purge : ${anciens.length} vendeur(s) de test,` +
        ` ${rdvResiduels.length} RDV de test.`
    );
  }
  await prismaPrealable.$disconnect();

  // Un seul client Prisma pour tout le script. Il etait ouvert au milieu du
  // fichier, ce qui obligeait a declarer tardivement ce qui en depend — et c'est
  // ce qui a casse la premiere version du releve d'etat.
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();

  const carnet: Carnet = { jours: null, rdvTestId: null, vendeurs: null };

  // ------------------------------------------------------------ remise en etat
  // Voir `Carnet` : cette fonction tourne dans un `finally`, donc AUSSI quand le
  // script echoue. C'est ce qui manquait, et ce qui a abime la campagne de
  // septembre.
  //
  // Chaque etape est protegee individuellement : si l'une echoue, les autres
  // doivent quand meme s'executer. Une restauration qui abandonne a la premiere
  // difficulte ne vaut pas mieux que pas de restauration.
  async function restaurer() {
    const echecsRestauration: string[] = [];

    if (carnet.jours) {
      try {
        await appeler('PUT', '/api/campagnes/2/jours', {
          jeton: jetonAdmin,
          corps: { jours: carnet.jours },
        });
      } catch (e) {
        echecsRestauration.push(`jours de la campagne : ${e instanceof Error ? e.message : e}`);
      }
    }

    if (carnet.rdvTestId !== null) {
      try {
        // ARCHIVE et non supprime : la suppression est interdite, et c'est
        // justement le comportement qu'on veut ici.
        await prisma.rdv.update({
          where: { id: carnet.rdvTestId },
          data: { archiveLe: new Date(), archivePar: BigInt(1) },
        });
      } catch (e) {
        echecsRestauration.push(`RDV de test : ${e instanceof Error ? e.message : e}`);
      }
    }

    if (carnet.vendeurs) {
      for (const [id, origine] of carnet.vendeurs) {
        try {
          await prisma.vendeurMarque.deleteMany({ where: { vendeurId: BigInt(id) } });
          await prisma.vendeurMarque.createMany({
            data: origine.marques.map((m) => ({ vendeurId: BigInt(id), marqueId: m.marqueId })),
          });
          await prisma.vendeur.update({
            where: { id: BigInt(id) },
            data: {
              typeVehicule: origine.typeVehicule,
              capacitesModifieesLe: origine.capacitesModifieesLe,
              capacitesModifieesPar: origine.capacitesModifieesPar,
            },
          });
        } catch (e) {
          echecsRestauration.push(`vendeur ${id} : ${e instanceof Error ? e.message : e}`);
        }
      }
    }

    await prisma.$disconnect().catch(() => undefined);

    // UN ECHEC DE RESTAURATION DOIT CRIER. Le silence, ici, laisse une donnee
    // metier abimee que personne ne cherchera.
    if (echecsRestauration.length > 0) {
      console.error('\nRESTAURATION INCOMPLETE — verifier la base a la main :');
      for (const e of echecsRestauration) console.error(`  ${e}`);
    }
  }


  try {

  // ------------------------------------------------------------ referentiels
  //
  // L'EFFECTIF ATTENDU EST LU EN BASE, PAS ECRIT EN DUR. La version precedente
  // exigeait exactement 99 vendeurs actifs. Elle a fini par echouer a 98 — parce
  // qu'un vendeur avait ete ajoute et deux sortis par l'interface, c'est-a-dire
  // parce que l'outil avait servi a ce qu'il sert. Un decompte de structure ecrit
  // en dur est un bug, meme quand il est juste le jour ou on l'ecrit
  // (interdit n.3). Ce que le test doit verifier, c'est que la route rend CE QUE
  // LA BASE CONTIENT.
  // LA REFERENCE DOIT REFLETER LE FILTRE DE LA ROUTE, sinon le test compare deux
  // questions differentes. La route exclut les vendeurs ARCHIVES ; compter les
  // seuls non-sortis donnait un ecart d'un vendeur des qu'un archive n'avait pas
  // de date de sortie — constate, et le test accusait la route a tort.
  const actifsEnBase = await prisma.vendeur.count({
    where: { dateSortie: null, archiveLe: null },
  });
  const marquesEnBase = await prisma.marque.count({ where: { archiveLe: null } });

  const ref = await appeler('GET', '/api/referentiels', { jeton: jetonChef });
  const actifsRendus = ref.corps.vendeurs?.filter(
    (v: { dateSortie: string | null }) => !v.dateSortie
  ).length;
  verifier(
    'GET /referentiels lisible par un chef de table, et conforme a la base',
    ref.statut === 200 &&
      actifsRendus === actifsEnBase &&
      ref.corps.marques?.length === marquesEnBase &&
      actifsEnBase > 0,
    `${ref.statut} — ${actifsRendus} vendeurs actifs (base : ${actifsEnBase}), ` +
      `${ref.corps.marques?.length} marques (base : ${marquesEnBase})`
  );
  verifier(
    'GET /referentiels expose VN/VO et les modes (rien en dur cote front)',
    Array.isArray(ref.corps.typesVehicule) &&
      ref.corps.typesVehicule.join(',') === 'VN,VO' &&
      ref.corps.modesSession?.join(',') === 'par_site,par_table',
    `${ref.corps.typesVehicule?.join(',')} / ${ref.corps.modesSession?.join(',')}`
  );

  const marques: { id: string; code: string }[] = ref.corps.marques;
  const renault = marques.find((m) => m.code === 'RENAULT')!;
  const dacia = marques.find((m) => m.code === 'DACIA')!;
  const sites: { id: string; code: string }[] = ref.corps.sites;
  interface VendeurRef {
    id: string;
    nom: string;
    siteId: string;
    marqueIds: string[];
    typeVehicule: string;
    dateSortie: string | null;
    archiveLe: string | null;
  }
  const vendeurs: VendeurRef[] = ref.corps.vendeurs;

  const clf = sites.find((s) => s.code === 'CLF')!;

  // Des vendeurs VN : les tests de marques n'ont aucun sens sur un VO, dont les
  // RDV ne portent pas de marque. On ecarte les vendeurs SORTIS, qui n'ont pas a
  // etre reveilles par un test.
  //
  // Le script note l'etat EXACT des deux vendeurs choisis et le restaure a
  // l'identique a la fin : il ne doit RIEN effacer du travail reel. Une version
  // precedente exigeait des vendeurs « non confirmes » et a cesse de demarrer le
  // jour ou les 12 VN de Clermont ont ete confirmes — un test qui casse quand la
  // donnee metier avance est un test a jeter. La notion de confirmation a depuis
  // ete retiree du produit.
  const candidats = vendeurs.filter(
    (v) => v.siteId === clf.id && v.typeVehicule === 'VN' && !v.dateSortie
  );

  if (candidats.length < 2) {
    console.error(
      'Ce script a besoin de deux vendeurs VN de CLF non sortis.\n' +
        'Rejouer le seed, ou viser un autre site.'
    );
    process.exit(1);
  }

  const cible = candidats[0]!;
  const autre = candidats[1]!;

  // ------------------------------------------------------------ portail
  const refuse = await appeler('PATCH', `/api/vendeurs/${cible.id}`, {
    jeton: jetonChef,
    corps: { marqueIds: [renault.id] },
  });
  verifier(
    'PATCH marques refuse a un chef de table',
    refuse.statut === 403,
    `${refuse.statut} — ${refuse.corps?.message ?? ''}`
  );

  const refuseJours = await appeler('PUT', '/api/campagnes/2/jours', {
    jeton: jetonChef,
    corps: { jours: ['2026-09-14'] },
  });
  verifier(
    'PUT jours refuse a un chef de table',
    refuseJours.statut === 403,
    `${refuseJours.statut} — ${refuseJours.corps?.message ?? ''}`
  );

  const sansMarque = await appeler('PATCH', `/api/vendeurs/${cible.id}`, {
    jeton: jetonAdmin,
    corps: { marqueIds: [] },
  });
  verifier(
    'PATCH marques refuse une liste vide',
    sansMarque.statut === 400,
    `${sansMarque.statut} — ${String(sansMarque.corps?.message ?? '').slice(0, 70)}`
  );

  // ------------------------------------------------------------ confirmation
  //
  // Etat d'origine des deux vendeurs, releve EN BASE. C'est ce qui sera restaure
  // mot pour mot a la fin — le script ne doit rien laisser derriere lui.
  const etatDOrigine = new Map(
    (
      await prisma.vendeur.findMany({
        where: { id: { in: [cible, autre].map((v) => BigInt(v.id)) } },
        select: {
          id: true,
          typeVehicule: true,
          capacitesModifieesLe: true,
          capacitesModifieesPar: true,
          marques: { select: { marqueId: true } },
        },
      })
    ).map((v) => [v.id.toString(), v])
  );
  carnet.vendeurs = etatDOrigine;

  const pose = await appeler('PATCH', `/api/vendeurs/${cible.id}`, {
    jeton: jetonAdmin,
    corps: { marqueIds: [renault.id] },
  });
  verifier(
    'PATCH marques par un admin : applique',
    pose.statut === 200 && pose.corps.marqueIds?.length === 1,
    `${pose.statut} — ${pose.corps?.marqueIds?.length} marque(s)`
  );

  const sansType = await appeler('PATCH', `/api/vendeurs/${cible.id}`, {
    jeton: jetonAdmin,
    corps: { typeVehicule: null },
  });
  verifier(
    'PATCH refuse un vendeur sans type de vehicule',
    sansType.statut === 400,
    `${sansType.statut} — ${String(sansType.corps?.message ?? '').slice(0, 60)}`
  );

  const typeInvalide = await appeler('PATCH', `/api/vendeurs/${cible.id}`, {
    jeton: jetonAdmin,
    corps: { typeVehicule: 'VD' },
  });
  verifier(
    'PATCH refuse un type de vehicule inconnu',
    typeInvalide.statut === 400,
    `${typeInvalide.statut} — ${String(typeInvalide.corps?.message ?? '').slice(0, 55)}`
  );

  // ------------------------------------------------------------ VN/VO par vendeur
  // `cible` passe en VO seul : un RDV VN sur lui doit etre refuse par le trigger,
  // exactement comme pour une marque non autorisee.
  const enVoSeul = await appeler('PATCH', `/api/vendeurs/${cible.id}`, {
    jeton: jetonAdmin,
    corps: { typeVehicule: 'VO' },
  });
  verifier(
    'PATCH : vendeur passe en VO seul',
    enVoSeul.statut === 200 && enVoSeul.corps.typeVehicule === 'VO',
    `${enVoSeul.statut} — ${enVoSeul.corps?.typeVehicule}`
  );

  // ------------------------------------------------------------ creation vendeur
  const nouveau = await appeler('POST', '/api/vendeurs', {
    jeton: jetonAdmin,
    corps: {
      nom: NOM_TEST,
      siteId: clf.id,
      marqueIds: [renault.id],
      typeVehicule: 'VN',
    },
  });
  verifier(
    'POST /vendeurs cree avec ses capacites',
    nouveau.statut === 201 &&
      nouveau.corps.marqueIds?.length === 1 &&
      nouveau.corps.typeVehicule === 'VN' &&
      nouveau.corps.archiveLe === null,
    `${nouveau.statut} — ${nouveau.corps?.nom}`
  );

  const doublonVendeur = await appeler('POST', '/api/vendeurs', {
    jeton: jetonAdmin,
    corps: {
      nom: NOM_TEST,
      siteId: clf.id,
      marqueIds: [renault.id],
      typeVehicule: 'VN',
    },
  });
  verifier(
    'POST /vendeurs refuse un homonyme sur le MEME site',
    doublonVendeur.statut === 409,
    `${doublonVendeur.statut} — ${String(doublonVendeur.corps?.message ?? '').slice(0, 55)}`
  );

  const creationRefusee = await appeler('POST', '/api/vendeurs', {
    jeton: jetonChef,
    corps: { nom: 'X', siteId: clf.id, marqueIds: [renault.id], typeVehicule: 'VN' },
  });
  verifier(
    'POST /vendeurs refuse a un chef de table',
    creationRefusee.statut === 403,
    `${creationRefusee.statut}`
  );

  const datesIncoherentes = await appeler('PATCH', `/api/vendeurs/${nouveau.corps.id}`, {
    jeton: jetonAdmin,
    corps: { dateEntree: '2026-06-01', dateSortie: '2026-01-01' },
  });
  verifier(
    'PATCH refuse une sortie anterieure a l entree',
    datesIncoherentes.statut === 400,
    `${datesIncoherentes.statut} — ${String(datesIncoherentes.corps?.message ?? '').slice(0, 50)}`
  );

  // Transfert de site : F-A3.5, l'historique suit puisque le RDV ne porte que le
  // vendeur. On revient ensuite sur CLF.
  const autreSite = sites.find((s) => s.code === 'MOZ')!;
  const transfert = await appeler('PATCH', `/api/vendeurs/${nouveau.corps.id}`, {
    jeton: jetonAdmin,
    corps: { siteId: autreSite.id },
  });
  verifier(
    'PATCH transfere un vendeur de site (F-A3.5)',
    transfert.statut === 200 && transfert.corps.siteId === autreSite.id,
    `${transfert.statut} — site ${transfert.corps?.siteId}`
  );

  // Sortie au 01/01/2026, AVANT la premiere campagne, et non au 31/08 : le
  // vendeur de test survit au script (interdit n.1) et une sortie posterieure a
  // juin le laissait PRESENT pendant juin. L'effectif de juin affichait alors 101
  // au lieu de 100. Le prealable applique deja cette date au residu ; la poser ici
  // aussi evite que la base soit fausse entre deux passages.
  const sortie = await appeler('PATCH', `/api/vendeurs/${nouveau.corps.id}`, {
    jeton: jetonAdmin,
    corps: { dateSortie: '2026-01-01' },
  });
  verifier(
    'PATCH sort un vendeur par sa date de sortie, sans suppression',
    sortie.statut === 200 && !!sortie.corps.dateSortie,
    `${sortie.statut} — sortie ${String(sortie.corps?.dateSortie ?? '').slice(0, 10)}`
  );

  // ------------------------------------------------------------ R-C.1 devenue reelle
  const campagne = await appeler('GET', '/api/campagnes/2', { jeton: jetonAdmin });
  const premierJour: string = campagne.corps.jours[0].jour;
  const premierCreneau: string = campagne.corps.creneaux[0].code;

  // ------------------------------------------------------------ import 2 temps
  const contenu = [
    `CLF\t${autre.nom}\tRENAULT DACIA`,
    `CLF\tNOM QUI NEXISTE PAS\tRENAULT`,
    `CLF\t${cible.nom}\tMOBILIZE`,
  ].join('\n');

  const analyse = await appeler('POST', '/api/vendeurs/capacites/import/analyse', {
    jeton: jetonAdmin,
    corps: { contenu },
  });
  verifier(
    'Import : analyse resout, signale introuvable et marque inconnue',
    analyse.statut === 200 &&
      analyse.corps.resume.resolues === 1 &&
      analyse.corps.resume.introuvables === 1 &&
      analyse.corps.resume.marquesInconnues === 1,
    `${analyse.statut} — ${JSON.stringify(analyse.corps.resume ?? {})}`
  );

  // L'analyse ne doit RIEN ecrire. On le verifie sur les marques du vendeur cite,
  // relues en base juste avant et juste apres — plus fiable qu'un compteur global,
  // qui pouvait bouger pour une autre raison.
  const marquesAvant = await prisma.vendeurMarque.findMany({
    where: { vendeurId: BigInt(autre.id) },
    select: { marqueId: true },
    orderBy: { marqueId: 'asc' },
  });
  const analyseBis = await appeler('POST', '/api/vendeurs/capacites/import/analyse', {
    jeton: jetonAdmin,
    corps: { contenu },
  });
  const marquesApres = await prisma.vendeurMarque.findMany({
    where: { vendeurId: BigInt(autre.id) },
    select: { marqueId: true },
    orderBy: { marqueId: 'asc' },
  });
  // Comparaison sur des CHAINES et non par `JSON.stringify` : les identifiants
  // sont des `bigint`, que `JSON.stringify` refuse de serialiser. Le correctif
  // `utils/json.ts` ne s'applique qu'au serveur, pas a ce script autonome.
  const listeMarques = (l: { marqueId: bigint }[]) => l.map((m) => m.marqueId.toString()).join(',');
  verifier(
    "Import : l'analyse n'ecrit RIEN",
    analyseBis.statut === 200 && listeMarques(marquesAvant) === listeMarques(marquesApres),
    `${marquesAvant.length} marque(s) avant, ${marquesApres.length} apres`
  );

  const analyseRefusee = await appeler('POST', '/api/vendeurs/capacites/import/analyse', {
    jeton: jetonChef,
    corps: { contenu },
  });
  verifier(
    'Import : analyse refusee a un chef de table',
    analyseRefusee.statut === 403,
    `${analyseRefusee.statut}`
  );

  const applique = await appeler('POST', '/api/vendeurs/capacites/import/appliquer', {
    jeton: jetonAdmin,
    corps: { lignes: [{ vendeurId: autre.id, marqueIds: [renault.id, dacia.id] }] },
  });
  verifier(
    'Import : application des lignes validees',
    applique.statut === 200 && applique.corps.appliquees === 1,
    `${applique.statut} — ${JSON.stringify(applique.corps ?? {})}`
  );

  const doublon = await appeler('POST', '/api/vendeurs/capacites/import/appliquer', {
    jeton: jetonAdmin,
    corps: {
      lignes: [
        { vendeurId: autre.id, marqueIds: [renault.id] },
        { vendeurId: autre.id, marqueIds: [dacia.id] },
      ],
    },
  });
  verifier(
    'Import : vendeur cite deux fois refuse en bloc',
    doublon.statut === 409,
    `${doublon.statut} — ${String(doublon.corps?.message ?? '').slice(0, 60)}`
  );

  // ------------------------------------------------------------ R-A.2
  // On pose un RDV sur le dernier jour de septembre, puis on retire ce jour.
  const joursActuels: string[] = campagne.corps.jours.map((j: any) => j.jour);
  carnet.jours = joursActuels;
  const jourASupprimer = joursActuels[joursActuels.length - 1];

  // Insertion directe en base : le but ici est de verifier le comportement de
  // PUT /jours face a des RDV existants, pas de passer par la saisie.
  const rdvTest = await prisma.rdv.create({
    data: {
      campagneId: BigInt(campagne.corps.id),
      vendeurId: BigInt(autre.id),
      jour: new Date(`${jourASupprimer}T00:00:00Z`),
      creneauCode: premierCreneau,
      marqueId: BigInt(renault.id),
      typeVehicule: 'VN',
      client: CLIENT_TEST,
    },
  });
  carnet.rdvTestId = rdvTest.id;

  const sansConfirmation = await appeler('PUT', '/api/campagnes/2/jours', {
    jeton: jetonAdmin,
    corps: { jours: joursActuels.filter((j) => j !== jourASupprimer) },
  });
  verifier(
    'R-A.2 : retirer un jour portant des RDV renvoie 409 avec le detail',
    sansConfirmation.statut === 409 &&
      sansConfirmation.corps.code === 'RDV_IMPACTES' &&
      sansConfirmation.corps.impacts?.[0]?.actifs === 1,
    `${sansConfirmation.statut} — ${JSON.stringify(sansConfirmation.corps.impacts ?? [])}`
  );

  const mauvaiseDestination = await appeler('PUT', '/api/campagnes/2/jours', {
    jeton: jetonAdmin,
    corps: {
      jours: joursActuels.filter((j) => j !== jourASupprimer),
      confirmation: { mode: 'deplacer', vers: jourASupprimer },
    },
  });
  verifier(
    'R-A.2 : destination hors des jours conserves refusee',
    mauvaiseDestination.statut === 400,
    `${mauvaiseDestination.statut} — ${String(mauvaiseDestination.corps?.message ?? '').slice(0, 60)}`
  );

  const deplace = await appeler('PUT', '/api/campagnes/2/jours', {
    jeton: jetonAdmin,
    corps: {
      jours: joursActuels.filter((j) => j !== jourASupprimer),
      confirmation: { mode: 'deplacer', vers: premierJour },
    },
  });
  verifier(
    'R-A.2 : deplacement applique, jour retire, aucune erreur de contrainte',
    deplace.statut === 200 && deplace.corps.rdvDeplaces === 1 && deplace.corps.jours.length === 4,
    `${deplace.statut} — ${deplace.corps.rdvDeplaces} deplace(s), ${deplace.corps.jours?.length} jours`
  );

  const rdvApres = await prisma.rdv.findUniqueOrThrow({ where: { id: rdvTest.id } });
  verifier(
    'R-A.2 : le RDV a bien change de jour',
    rdvApres.jour.toISOString().slice(0, 10) === premierJour,
    `${rdvApres.jour.toISOString().slice(0, 10)} (attendu ${premierJour})`
  );

  // ------------------------------------------------------------ paliers de compte
  //
  // QUATRE PALIERS, et la frontiere qui compte est entre les deux premiers :
  // `direction` a tout SAUF la gestion des comptes. Sans cette frontiere, un
  // compte Direction pourrait se promouvoir administrateur.
  //
  // Ces verifications passent par des comptes de test (`npm run comptes-test`).
  // Si l'un manque, on le dit au lieu d'echouer sur une connexion.
  const connexionSouple = async (loginId: string): Promise<string | null> => {
    const r = await appeler('POST', '/api/auth/login', {
      corps: { loginId, motDePasse: MOT_DE_PASSE },
    });
    return r.statut === 200 && r.corps?.jeton ? r.corps.jeton : null;
  };

  const jetonDirection = await connexionSouple('direction.test');
  const jetonEncadrant = await connexionSouple('encadrant.test');

  if (!jetonDirection || !jetonEncadrant) {
    resultats.push({
      nom: 'Paliers  jeu de comptes',
      ok: false,
      detail: 'lancer `npm run comptes-test` : direction.test et encadrant.test sont requis',
    });
  } else {
    const moiDirection = await appeler('GET', '/api/auth/moi', { jeton: jetonDirection });
    verifier(
      'Palier DIRECTION : administre tout, ne gere pas les comptes',
      moiDirection.corps?.droits?.administre === true &&
        moiDirection.corps?.droits?.gereUtilisateurs === false &&
        moiDirection.corps?.droits?.admin === false,
      `administre=${moiDirection.corps?.droits?.administre} gereUtilisateurs=${moiDirection.corps?.droits?.gereUtilisateurs}`
    );

    const gestionRefusee = await appeler('GET', '/api/utilisateurs', { jeton: jetonDirection });
    verifier(
      'Palier DIRECTION : la gestion des comptes est REFUSEE',
      gestionRefusee.statut === 403,
      `${gestionRefusee.statut}`
    );

    const encadrementRefuse = await appeler('PUT', '/api/utilisateurs/encadrement', {
      jeton: jetonDirection,
      corps: { siteId: clf.id, role: 'chef_de_site', utilisateurId: null },
    });
    verifier(
      'Palier DIRECTION : rattacher un encadrant est REFUSE',
      encadrementRefuse.statut === 403,
      `${encadrementRefuse.statut}`
    );

    const refRefRef = await appeler('GET', '/api/referentiels', { jeton: jetonDirection });
    verifier(
      'Palier DIRECTION : les referentiels et les campagnes restent ouverts',
      refRefRef.statut === 200,
      `${refRefRef.statut}`
    );

    // `direction` a un ACCES TOTAL, saisie comprise. Trouve par le script des
    // comptes de test, qui refusait de livrer un compte sans perimetre.
    const saisieDirection = await appeler('GET', '/api/saisie/2', { jeton: jetonDirection });
    verifier(
      'Palier DIRECTION : acces total, saisie comprise',
      saisieDirection.statut === 200 && (saisieDirection.corps?.vendeurs?.length ?? 0) > 50,
      `${saisieDirection.corps?.vendeurs?.length ?? 0} vendeurs saisissables`
    );

    const moiEncadrant = await appeler('GET', '/api/auth/moi', { jeton: jetonEncadrant });
    verifier(
      'Palier ENCADRANT : aucun role global, un perimetre par rattachement',
      moiEncadrant.corps?.droits?.administre === false &&
        (moiEncadrant.corps?.droits?.sitesEncadres?.length ?? 0) >= 2,
      `administre=${moiEncadrant.corps?.droits?.administre} sites=${JSON.stringify(moiEncadrant.corps?.droits?.sitesEncadres)}`
    );

    const adminRefusee = await appeler('PATCH', `/api/vendeurs/${cible.id}`, {
      jeton: jetonEncadrant,
      corps: { nom: cible.nom },
    });
    verifier(
      'Palier ENCADRANT : l administration est REFUSEE',
      adminRefusee.statut === 403,
      `${adminRefusee.statut}`
    );

    // SON PERIMETRE SUIT SES SITES, pas la campagne. C'est la difference avec
    // `role_campagne` : un encadrement de site vaut pour juin ET pour septembre.
    const saisieSept = await appeler('GET', '/api/saisie/2', { jeton: jetonEncadrant });
    const saisieJuin = await appeler('GET', '/api/saisie/1', { jeton: jetonEncadrant });
    verifier(
      'Palier ENCADRANT : le perimetre de site vaut sur LES DEUX campagnes',
      (saisieSept.corps?.vendeurs?.length ?? 0) > 0 && (saisieJuin.corps?.vendeurs?.length ?? 0) > 0,
      `septembre ${saisieSept.corps?.vendeurs?.length ?? 0} · juin ${saisieJuin.corps?.vendeurs?.length ?? 0}`
    );

    // Il ne saisit QUE dans son perimetre : un vendeur d'un autre site est refuse.
    const horsPerimetre = await appeler('GET', '/api/saisie/2', { jeton: jetonEncadrant });
    const sitesVus = new Set(
      (horsPerimetre.corps?.vendeurs ?? []).map((v: { siteCode: string }) => v.siteCode)
    );
    verifier(
      'Palier ENCADRANT : il ne voit QUE les sites qu il encadre',
      sitesVus.size > 0 && sitesVus.size <= 2 && !sitesVus.has('VI'),
      `sites vus : ${[...sitesVus].join(', ')}`
    );
  }

  // ------------------------------------------------------------ module B
  //
  // Tout se passe sur la session de SUD-OUEST de septembre, qui n'a AUCUNE table :
  // le script ne doit pas toucher a une composition reelle. La table de test est
  // archivee a la fin — jamais supprimee.
  const sessionsSept = await prisma.sessionPlaque.findMany({
    where: { campagneId: 2n, archiveLe: null },
    select: { id: true, plaque: { select: { libelle: true } } },
  });
  const sessionTest = sessionsSept.find((x) => x.plaque.libelle === 'SUD-OUEST');

  if (!sessionTest) {
    resultats.push({
      nom: 'Module B  jeu de donnees',
      ok: false,
      detail: 'session SUD-OUEST de septembre introuvable',
    });
  } else {
    const sid = sessionTest.id.toString();

    const refuseTables = await appeler('GET', `/api/tables/session/${sid}`, { jeton: jetonChef });
    verifier(
      'Module B  lecture des tables refusee a un chef de table',
      refuseTables.statut === 403,
      `${refuseTables.statut} — ${String(refuseTables.corps?.message ?? '').slice(0, 60)}`
    );

    const creation = await appeler('POST', `/api/tables/session/${sid}`, {
      jeton: jetonAdmin,
      corps: { libelle: 'TABLE VERIF API' },
    });
    verifier(
      'Module B  creation d une table (F-B.1)',
      (creation.statut === 201 || creation.statut === 200) && !!creation.corps.id,
      `${creation.statut} — ${creation.corps?.libelle ?? creation.corps?.message} ordre ${creation.corps?.ordre}`
    );
    const tid = String(creation.corps.id);

    // R-B.1 : un vendeur d'une AUTRE plaque. Le trigger doit refuser, et le
    // message doit arriver LISIBLE — sans les internes du pilote PostgreSQL.
    const horsPlaque = vendeurs.find((v) => {
      const site = sites.find((x) => x.id === v.siteId);
      return site && site.code === 'CLF';
    })!;
    const refusPlaque = await appeler('PUT', `/api/tables/${tid}/vendeurs`, {
      jeton: jetonAdmin,
      corps: { vendeurIds: [horsPlaque.id] },
    });
    verifier(
      'Module B  R-B.1 vendeur hors plaque refuse, message lisible',
      refusPlaque.statut === 409 &&
        /autre plaque/.test(String(refusPlaque.corps?.message ?? '')) &&
        !/severity|detail: None/.test(String(refusPlaque.corps?.message ?? '')),
      `${refusPlaque.statut} — ${String(refusPlaque.corps?.message ?? '').slice(0, 80)}`
    );

    // Repartition, deux fois de suite : meme composition. C'est l'exigence de
    // F-B.5 — reproductible, donc contestable.
    const compo = async () => {
      const r = await appeler('GET', `/api/tables/session/${sid}`, { jeton: jetonAdmin });
      return (r.corps.tables ?? [])
        .map(
          (t: { libelle: string; membres: { nom: string }[] }) =>
            `${t.libelle}:${t.membres.map((m) => m.nom).sort().join(',')}`
        )
        .join('|');
    };
    const rep1 = await appeler('POST', `/api/tables/session/${sid}/repartition-auto`, {
      jeton: jetonAdmin,
      corps: { remplacer: true },
    });
    const compo1 = await compo();
    await appeler('POST', `/api/tables/session/${sid}/repartition-auto`, {
      jeton: jetonAdmin,
      corps: { remplacer: true },
    });
    const compo2 = await compo();
    verifier(
      'Module B  repartition graine 42 : deux passages, meme composition (F-B.5)',
      rep1.statut === 200 && rep1.corps.graine === 42 && compo1 === compo2 && compo1.length > 0,
      `graine ${rep1.corps?.graine} — ${compo1.slice(0, 70)}`
    );

    // F-B.8 : un vendeur laisse EN RESERVE reste saisissable par son chef de site.
    // La regle est portee par `vendeursSaisissables`, qui reunit table ET site :
    // on le VERIFIE plutot que de le supposer.
    const etat = await appeler('GET', `/api/tables/session/${sid}`, { jeton: jetonAdmin });
    const reserve: { id: string; nom: string; siteId: string }[] = etat.corps.reserve ?? [];
    const place = (etat.corps.tables ?? []).flatMap(
      (t: { membres: { id: string }[] }) => t.membres
    );
    verifier(
      'Module B  la reserve et les tables se partagent TOUS les vendeurs de la plaque',
      reserve.length + place.length > 0,
      `${place.length} places, ${reserve.length} en reserve`
    );

    // Archivage : les membres reviennent en reserve, rien n'est supprime.
    const archive = await appeler('POST', `/api/tables/${tid}/archiver`, { jeton: jetonAdmin });
    const apresArchive = await appeler('GET', `/api/tables/session/${sid}`, { jeton: jetonAdmin });
    verifier(
      'Module B  archiver une table rend ses membres a la reserve (interdit n.1)',
      archive.statut === 200 &&
        (apresArchive.corps.tables ?? []).length === 0 &&
        (apresArchive.corps.reserve ?? []).length === reserve.length + place.length,
      `${archive.corps?.affectationsArchivees} affectation(s) archivee(s), ` +
        `reserve ${(apresArchive.corps.reserve ?? []).length}`
    );

    const restentEnBase = await prisma.affectation.count({
      where: { tableId: BigInt(tid) },
    });
    verifier(
      'Module B  aucune affectation SUPPRIMEE : elles sont archivees',
      restentEnBase === place.length,
      `${restentEnBase} ligne(s) conservees en base pour ${place.length} affectation(s)`
    );
  }

  // ------------------------------------------------------------ dashboard
  const dash = await appeler('GET', '/api/dashboard/2', { jeton: jetonChef });
  verifier(
    'Dashboard lisible par un chef de table (les compteurs sont publics)',
    dash.statut === 200 && !!dash.corps.totaux?.groupe,
    `${dash.statut} — ${Object.keys(dash.corps.totaux ?? {}).join(', ')}`
  );

  if (dash.statut === 200) {
    const t = dash.corps.totaux;
    const groupe = t.groupe[0];
    const sommePlaques = t.plaque.reduce((n: number, x: { total: number }) => n + x.total, 0);
    const sommeSites = t.site.reduce((n: number, x: { total: number }) => n + x.total, 0);
    const sommeJours = dash.corps.parJour.reduce((n: number, x: { total: number }) => n + x.total, 0);
    verifier(
      'Dashboard : tous les axes retombent sur le meme total',
      groupe.total === sommePlaques &&
        groupe.total === sommeSites &&
        groupe.total === sommeJours,
      `groupe ${groupe.total} · plaques ${sommePlaques} · sites ${sommeSites} · jours ${sommeJours}`
    );
    verifier(
      'Dashboard : aucun nom de client ne sort des agregats',
      !JSON.stringify(dash.corps).includes(CLIENT_TEST),
      'aucun client dans la reponse'
    );
  }


  } finally {
    // TOUJOURS, y compris quand une verification a leve une exception.
    await restaurer();
  }

  // ------------------------------------------------------------ restitution
  const largeur = Math.max(...resultats.map((r) => r.nom.length));
  console.log('');
  for (const r of resultats) {
    console.log(`${r.ok ? 'OK  ' : 'ECHEC'} ${r.nom.padEnd(largeur)}  ${r.detail}`);
  }
  const echecs = resultats.filter((r) => !r.ok).length;
  console.log(`\n${resultats.length - echecs}/${resultats.length} verifications de l'API.`);
  console.log(
    `\nEtat remis : ${carnet.vendeurs?.size ?? 0} vendeur(s) restaure(s), jours de la campagne` +
      `\nremis en place. Laisse en base : 1 RDV archive (la suppression est interdite, c'est voulu).`
  );

  if (echecs > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
