// ============================================================================
// IMPORT DES 1107 RDV DE JUIN 2026 DANS LA BASE.
//
// ---------------------------------------------------------------------------
// CE SCRIPT REVIENT SUR UNE DECISION ECRITE, ET IL FAUT LE DIRE
// ---------------------------------------------------------------------------
// `rdv-juin-source.ts` porte encore, en tete : « aucune de ces lignes n'entre en
// base : c'est une decision explicite ». Elle etait juste tant que juin ne
// servait qu'a demontrer les agregats en memoire.
//
// Elle ne l'est plus. Le tableau de bord de septembre porte un selecteur
// « Comparer a… » qui pointe sur Juin 2026, et l'ecart comme la variation sont
// le coeur du suivi (F-D.5). Avec une campagne de juin VIDE en base, ce
// selecteur compare a zero : chaque vendeur apparait en progression infinie, ce
// qui est pire qu'une absence de comparaison. La demande de l'utilisateur du
// 01/09/2026 tranche : juin entre en base.
//
// Effet secondaire qui vaut d'etre connu : les totaux du produit deviennent
// verifiables CONTRE LE CLASSEUR SUR DONNEES REELLES, et plus seulement en
// memoire. C'est le critere de recette n.4, joue pour de bon — ce script le
// rejoue lui-meme apres l'ecriture, et refuse de se declarer reussi sans lui.
//
// ---------------------------------------------------------------------------
// LES NOMS DE CLIENTS SORTENT DU POSTE
// ---------------------------------------------------------------------------
// Le champ `client` est le texte libre de la cellule : ce sont de VRAIS NOMS DE
// CLIENTS. `rdv-juin-source.ts` disait « ce fichier ne quitte pas le poste » ;
// a partir de maintenant, ces noms sont dans une base hebergee ET dans les
// dumps hebdomadaires commites par `backup.yml`. Le depot **doit** rester prive,
// et c'est desormais vrai pour une raison de plus.
//
// ---------------------------------------------------------------------------
// POURQUOI PAR POSTGREST ET NON PAR PRISMA
// ---------------------------------------------------------------------------
// Les ports 5432 et 6543 sont bloques par le reseau du bureau (mesure le
// 01/09/2026 : les quatre hotes ne repondent pas, alors qu'ils repondaient la
// veille). Le 443 passe. Ce script emprunte donc exactement le chemin du
// navigateur — session Supabase Auth, PostgREST, RLS et 19 triggers actifs.
//
// Ce n'est pas un pis-aller : une ecriture par Prisma en direct passerait a cote
// de la RLS et prouverait moins. Ici, si une politique ou un trigger refuse une
// ligne, on l'apprend.
//
// ---------------------------------------------------------------------------
// IDEMPOTENT, ET A BLANC PAR DEFAUT
// ---------------------------------------------------------------------------
// Sans `--reel`, il ne fait que resoudre et rendre compte. Avec `--reel`, il
// n'insere QUE ce qui manque. Rejouer le script deux fois ne cree pas 2214 RDV.
//
// LA CLE N'EST PAS LA CELLULE DU CLASSEUR, et c'est une correction. Une premiere
// version identifiait une ligne par (vendeur, jour, creneau, marque) — la
// position dans la grille. Elle a refuse de tourner, et elle avait raison de le
// faire : DEUX cellules portent DEUX rendez-vous. Un vendeur a pris deux
// clients dans la meme heure et les deux noms ont ete tapes dans la meme case.
//
//   CLF  / JEROME SABIN     / 15 juin 14h-15h / VO : DEVERNOIS, DE SOUSA
//   ISS  / REDWANE TOULOUSE / 11 juin 08h-09h / VO : DAUBARD, COSTON
//
// Ce ne sont pas des artefacts d'extraction : les deux comptent dans les 1107, et
// les 1107 se recoupent a l'unite avec quatre series de totaux du classeur. La
// cle inclut donc le CLIENT — 1107 cles distinctes sur 1107 lignes, verifie.
//
// Contrepartie assumee : si un nom de client etait corrige dans le classeur, un
// rejeu insererait une ligne de plus au lieu de corriger l'ancienne. C'est le bon
// compromis pour une source figee, et l'ecran de saisie sait corriger un RDV.
//
// Usage :
//   MOT_DE_PASSE="..." npm --prefix backend run importer-juin
//   MOT_DE_PASSE="..." npm --prefix backend run importer-juin -- --reel
//
// Le mot de passe passe par l'environnement, jamais par un argument : les
// arguments d'un processus sont lisibles par les autres processus de la machine
// et restent dans l'historique du terminal.
// ============================================================================

import { RDV_JUIN } from './rdv-juin-source';
import { ATTENDUS_SITES, ATTENDUS_TOTAUX_JOUR } from './donnees-xlsx';
import {
  totauxPar,
  totauxParJour,
  type LigneRdv as LigneAgregat,
  type LigneVendeur,
} from '../src/utils/agregats';
import { cleTri } from '../src/utils/tri';

const LIBELLE_CAMPAGNE = 'Juin 2026';
const LOGIN_ADMIN = 'admin';
const DOMAINE = 'grid.bonyauto-mobile.com';
const LOT = 200;

const REEL = process.argv.includes('--reel');

const URL_PROJET = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
const CLE_PUBLIQUE = process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;
const MOT_DE_PASSE = process.env.MOT_DE_PASSE;

function exiger(nom: string, valeur: string | undefined): string {
  if (!valeur) {
    console.error(
      `\n${nom} est absent de l'environnement.\n\n` +
        `  VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY sont dans \`.env.production\`\n` +
        `  a la racine — elles sont publiques par construction. Le mot de passe de\n` +
        `  \`${LOGIN_ADMIN}\`, lui, ne doit etre nulle part : le passer a la volee.\n\n` +
        `    set -a; . ./.env.production; set +a\n` +
        `    MOT_DE_PASSE="..." npm --prefix backend run importer-juin\n`
    );
    process.exit(1);
  }
  return valeur;
}

// ---------------------------------------------------------------------------

interface Vendeur {
  id: number;
  nom: string;
  site_id: number;
  type_vehicule: string;
  date_entree: string | null;
  date_sortie: string | null;
  archive_le: string | null;
}

interface LigneAInserer {
  campagne_id: number;
  vendeur_id: number;
  jour: string;
  creneau_code: string;
  marque_id: number | null;
  type_vehicule: string;
  client: string;
}

async function main(): Promise<void> {
  const url = exiger('VITE_SUPABASE_URL', URL_PROJET);
  const cle = exiger('VITE_SUPABASE_ANON_KEY', CLE_PUBLIQUE);
  const motDePasse = exiger('MOT_DE_PASSE', MOT_DE_PASSE);

  // ---- session ------------------------------------------------------------
  const reponse = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: cle, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: `${LOGIN_ADMIN}@${DOMAINE}`, password: motDePasse }),
  });
  const session = (await reponse.json()) as { access_token?: string; error_description?: string };
  if (!session.access_token) {
    console.error(`Connexion de « ${LOGIN_ADMIN} » refusee : ${session.error_description ?? '?'}`);
    process.exit(1);
  }

  const entetes = {
    apikey: cle,
    Authorization: `Bearer ${session.access_token}`,
    'Accept-Profile': 'relance',
    'Content-Profile': 'relance',
    'Content-Type': 'application/json',
  };

  /// PostgREST plafonne le nombre de lignes rendues (`max_rows`). On pagine, on
  /// ORDONNE, et on COMPARE au compte exact. Les trois, et il en faut trois.
  ///
  /// L'ORDRE N'EST PAS UN CONFORT. `LIMIT/OFFSET` sur une requete non ordonnee
  /// n'a aucune stabilite garantie : la page 2 peut repeter des lignes de la
  /// page 1 et en omettre d'autres. On rapatrie alors le BON NOMBRE de lignes
  /// mais pas les BONNES, et le controle de volume passe au vert pendant que les
  /// totaux sont faux.
  ///
  /// Ce n'est pas theorique : la premiere version de ce script n'ordonnait pas,
  /// et sa verification a rendu 1107 RDV — le bon total — avec une ventilation
  /// VN/VO de 884/223 au lieu de 903/204 et trois sites sur-comptes. C'est ce qui
  /// a revele le meme defaut dans `toutesLesLignes` cote navigateur, ou il etait
  /// invisible tant qu'aucune campagne ne depassait 1000 RDV.
  ///
  /// La colonne d'ordre est un PARAMETRE OBLIGATOIRE, et ce doit etre une cle :
  /// seule l'unicite garantit que deux pages ne se recouvrent pas. `id` pour la
  /// plupart des tables ; `campagne_jour` et `campagne_creneau` ont des cles
  /// composites et n'ont pas de colonne `id` — d'ou le parametre plutot qu'un
  /// `order=id` code en dur, qui echouait en 42703.
  const lire = async <T>(chemin: string, ordre: string): Promise<T[]> => {
    const lignes: T[] = [];
    for (let debut = 0; ; debut += 1000) {
      const separateur = chemin.includes('?') ? '&' : '?';
      const r = await fetch(`${url}/rest/v1/${chemin}${separateur}order=${ordre}.asc`, {
        headers: { ...entetes, Range: `${debut}-${debut + 999}`, Prefer: 'count=exact' },
      });
      if (!r.ok) throw new Error(`GET ${chemin} : ${r.status} ${await r.text()}`);
      const lot = (await r.json()) as T[];
      lignes.push(...lot);
      const total = Number(r.headers.get('content-range')?.split('/')[1] ?? lignes.length);
      if (lignes.length >= total || lot.length === 0) {
        if (lignes.length !== total) {
          throw new Error(`${chemin} : ${lignes.length} lignes lues pour ${total} annoncees`);
        }
        return lignes;
      }
    }
  };

  // ---- referentiel --------------------------------------------------------
  const campagnes = await lire<{ id: number; libelle: string; cloturee: boolean }>(
    `campagne?select=id,libelle,cloturee&libelle=eq.${encodeURIComponent(LIBELLE_CAMPAGNE)}`,
    'id'
  );
  const campagne = campagnes[0];
  if (!campagne) throw new Error(`Campagne « ${LIBELLE_CAMPAGNE} » introuvable.`);
  if (campagne.cloturee) {
    throw new Error(
      `La campagne « ${LIBELLE_CAMPAGNE} » est CLOTUREE : elle n'accepte plus aucune ecriture ` +
        `(R-C.3). La rouvrir depuis l'ecran Campagnes avant de rejouer cet import.`
    );
  }

  const [sites, marques, vendeurs, capacites, jours, creneaux] = await Promise.all([
    lire<{ id: number; code: string; libelle: string }>('site?select=id,code,libelle', 'id'),
    lire<{ id: number; libelle: string }>('marque?select=id,libelle', 'id'),
    lire<Vendeur>(
      'vendeur?select=id,nom,site_id,type_vehicule,date_entree,date_sortie,archive_le',
      'id'
    ),
    lire<{ vendeur_id: number; marque_id: number }>(
      'vendeur_marque?select=vendeur_id,marque_id',
      'vendeur_id'
    ),
    lire<{ jour: string }>(`campagne_jour?select=jour&campagne_id=eq.${campagne.id}`, 'jour'),
    lire<{ code: string }>(`campagne_creneau?select=code&campagne_id=eq.${campagne.id}`, 'ordre'),
  ]);

  const siteParCode = new Map(sites.map((s) => [s.code, s.id]));
  const marqueParLibelle = new Map(marques.map((m) => [cleTri(m.libelle), m.id]));
  const vendeurParSiteEtNom = new Map(vendeurs.map((v) => [`${v.site_id}|${cleTri(v.nom)}`, v]));
  const autorise = new Set(capacites.map((c) => `${c.vendeur_id}|${c.marque_id}`));
  const joursValides = new Set(jours.map((j) => j.jour));
  const creneauxValides = new Set(creneaux.map((c) => c.code));

  console.log(
    `Base    : ${url}\n` +
      `Campagne: ${campagne.libelle} (id ${campagne.id}) — ${jours.length} jours, ` +
      `${creneaux.length} creneaux\n` +
      `Referentiel : ${sites.length} sites, ${marques.length} marques, ` +
      `${vendeurs.length} vendeurs, ${capacites.length} capacites`
  );

  // ---- resolution ---------------------------------------------------------
  //
  // ON RESOUT TOUT AVANT D'ECRIRE QUOI QUE CE SOIT. Une ligne non resolue arrete
  // le script : un import partiel de RDV est bien pire qu'un import refuse,
  // parce qu'il donne des totaux plausibles et faux — exactement le defaut du
  // classeur qu'on remplace.
  const ennuis: string[] = [];
  const aEcrire: LigneAInserer[] = [];
  const cellules = new Set<string>();

  const empreinteDe = (l: {
    vendeur_id: number;
    jour: string;
    creneau_code: string;
    marque_id: number | null;
    client: string;
  }) =>
    `${l.vendeur_id}|${l.jour}|${l.creneau_code}|${l.marque_id ?? 'VO'}|${l.client}`;

  for (const [rang, rdv] of RDV_JUIN.entries()) {
    const ou = `ligne ${rang + 1} (${rdv.site} / ${rdv.nomVendeur} / ${rdv.jour} ${rdv.creneau})`;

    const siteId = siteParCode.get(rdv.site);
    if (siteId === undefined) {
      ennuis.push(`${ou} : site « ${rdv.site} » inconnu`);
      continue;
    }
    const vendeur = vendeurParSiteEtNom.get(`${siteId}|${cleTri(rdv.nomVendeur)}`);
    if (!vendeur) {
      ennuis.push(`${ou} : aucun vendeur de ce nom sur ${rdv.site}`);
      continue;
    }
    if (vendeur.archive_le) {
      ennuis.push(`${ou} : vendeur archive`);
      continue;
    }
    if (!joursValides.has(rdv.jour)) {
      ennuis.push(`${ou} : le jour n'appartient pas a la campagne`);
      continue;
    }
    if (!creneauxValides.has(rdv.creneau)) {
      ennuis.push(`${ou} : creneau « ${rdv.creneau} » inconnu de la campagne`);
      continue;
    }

    // Un vendeur VO n'a aucune ventilation par marque, un vendeur VN en exige
    // une : c'est le trigger `rdv_marque_selon_metier`. On le verifie ici pour
    // rendre un message lisible plutot qu'un refus a la 700e ligne.
    const estVO = rdv.marque === 'VO';
    if (estVO !== (vendeur.type_vehicule === 'VO')) {
      ennuis.push(
        `${ou} : le classeur le range en « ${rdv.marque} » mais la base le dit ` +
          `${vendeur.type_vehicule}`
      );
      continue;
    }

    let marqueId: number | null = null;
    if (!estVO) {
      const trouvee = marqueParLibelle.get(cleTri(rdv.marque));
      if (trouvee === undefined) {
        ennuis.push(`${ou} : marque « ${rdv.marque} » inconnue`);
        continue;
      }
      // R-C.1 — le trigger `rdv_marque_autorisee` refusera sinon.
      if (!autorise.has(`${vendeur.id}|${trouvee}`)) {
        ennuis.push(`${ou} : non autorise a vendre ${rdv.marque} (R-C.1)`);
        continue;
      }
      marqueId = trouvee;
    }

    const ligne: LigneAInserer = {
      campagne_id: campagne.id,
      vendeur_id: vendeur.id,
      jour: rdv.jour,
      creneau_code: rdv.creneau,
      marque_id: marqueId,
      type_vehicule: vendeur.type_vehicule,
      client: rdv.client,
    };

    const empreinte = empreinteDe(ligne);
    if (cellules.has(empreinte)) {
      ennuis.push(`${ou} : ligne en double dans le classeur (meme client, meme case)`);
      continue;
    }
    cellules.add(empreinte);
    aEcrire.push(ligne);
  }

  if (ennuis.length > 0) {
    console.error(`\n${ennuis.length} lignes non resolues — RIEN N'A ETE ECRIT :\n`);
    for (const e of ennuis.slice(0, 30)) console.error('  ' + e);
    if (ennuis.length > 30) console.error(`  ... et ${ennuis.length - 30} autres`);
    process.exit(1);
  }

  console.log(`\nResolution : ${aEcrire.length} / ${RDV_JUIN.length} lignes, aucun ennui.`);

  // ---- ce qui manque reellement -------------------------------------------
  const dejaLa = await lire<{
    vendeur_id: number;
    jour: string;
    creneau_code: string;
    marque_id: number | null;
    client: string;
  }>(
    `rdv?select=vendeur_id,jour,creneau_code,marque_id,client` +
      `&campagne_id=eq.${campagne.id}&archive_le=is.null`,
    'id'
  );
  const presentes = new Set(dejaLa.map(empreinteDe));
  const manquantes = aEcrire.filter((l) => !presentes.has(empreinteDe(l)));

  console.log(
    `En base   : ${dejaLa.length} RDV actifs sur cette campagne\n` +
      `A inserer : ${manquantes.length}  (${aEcrire.length - manquantes.length} deja presents)`
  );

  // ---- ecriture -----------------------------------------------------------
  //
  // A BLANC, ON N'ECRIT PAS — MAIS ON VERIFIE QUAND MEME. C'est ce qui fait de ce
  // script un CONTROLE rejouable et non un outil a usage unique :
  //
  //     MOT_DE_PASSE="..." npm --prefix backend run importer-juin
  //
  // relit les 1107 RDV de la base et les recoupe avec les totaux du classeur,
  // sans rien toucher. C'est aussi le garde-fou de la PAGINATION : si une lecture
  // paginee redevenait non ordonnee, les totaux divergeraient ici — le defaut du
  // 01/09/2026 s'est manifeste exactement comme ca.
  let ecrites = 0;
  if (!REEL && manquantes.length > 0) {
    console.log(
      `
ESSAI A BLANC — les ${manquantes.length} lignes manquantes n'ont PAS ete` +
        ` ecrites. Rejouer avec \`-- --reel\` pour inserer.`
    );
  }
  for (let i = 0; REEL && i < manquantes.length; i += LOT) {
    const lot = manquantes.slice(i, i + LOT);
    const r = await fetch(`${url}/rest/v1/rdv`, {
      method: 'POST',
      headers: { ...entetes, Prefer: 'return=minimal' },
      body: JSON.stringify(lot),
    });
    if (!r.ok) {
      // Le message d'un trigger arrive tel quel : il est ecrit pour un humain.
      console.error(`\nEchec sur le lot ${i}-${i + lot.length - 1} : ${r.status}`);
      console.error(await r.text());
      console.error(`\n${ecrites} RDV ont ete ecrits avant l'echec. Le script est idempotent :`);
      console.error(`corriger la cause, puis le rejouer — il reprendra ou il s'est arrete.`);
      process.exit(1);
    }
    ecrites += lot.length;
    process.stdout.write(`\r  ecrits : ${ecrites} / ${manquantes.length}`);
  }
  if (REEL) console.log(ecrites > 0 ? '' : '  rien a ecrire.');

  // ---- LA VERIFICATION, et elle n'est pas optionnelle ---------------------
  //
  // On RELIT la base et on donne ce qu'elle rend aux MEMES fonctions que le
  // tableau de bord, puis on compare aux totaux du CLASSEUR. C'est le critere de
  // recette n.4 — « les totaux de l'outil et ceux du fichier concordent a
  // l'unite » — joue pour de bon : jusqu'ici `test:agregats` le demontrait EN
  // MEMOIRE, sur `RDV_JUIN`. Ici les chiffres refont le trajet complet : ecriture
  // par PostgREST, 19 triggers, RLS, puis relecture par la vue `rdv_agrege`,
  // celle-la meme que lit le tableau de bord.
  //
  // La force du controle vient de son RECOUPEMENT : le classeur porte les memes
  // totaux a des endroits independants — par site dans RESULTATS, par jour en
  // ligne 2 des onglets site. Retomber sur les deux ne peut pas etre un hasard.
  console.log('\nVerification contre les totaux du classeur…\n');

  const relus = await lire<{
    vendeur_id: number;
    jour: string;
    creneau_code: string;
    marque_id: number | null;
    type_vehicule: string;
  }>(
    `rdv_agrege?select=vendeur_id,jour,creneau_code,marque_id,type_vehicule` +
      `&campagne_id=eq.${campagne.id}&archive_le=is.null`,
    'id'
  );

  const libelleMarque = new Map(marques.map((m) => [m.id, m.libelle.toUpperCase()]));
  const siteParId = new Map(sites.map((s) => [s.id, s]));

  /// `LigneVendeur` tel que `agregats.ts` l'attend. `plaque` et `table` ne
  /// servent pas ici — on ne controle que le groupe, les sites et les jours, les
  /// trois series que le classeur porte de facon independante.
  const lignesVendeur: LigneVendeur[] = vendeurs.map((v) => {
    const site = siteParId.get(v.site_id);
    return {
      id: String(v.id),
      nom: v.nom,
      siteId: site?.code ?? String(v.site_id),
      siteLibelle: site?.libelle ?? '?',
      plaqueId: '?',
      plaqueLibelle: '?',
      tableId: null,
      tableLibelle: null,
      typeVehicule: v.type_vehicule as LigneVendeur['typeVehicule'],
    };
  });

  /// `marqueId` porte ici le LIBELLE de la marque, comme dans `test:agregats` :
  /// c'est ce que la fonction attend, et cela rend les paniers lisibles.
  const lignesRdv: LigneAgregat[] = relus.map((r) => ({
    vendeurId: String(r.vendeur_id),
    typeVehicule: r.type_vehicule as LigneAgregat['typeVehicule'],
    marqueId: r.marque_id === null ? null : (libelleMarque.get(r.marque_id) ?? null),
    jour: r.jour,
    creneauCode: r.creneau_code,
  }));

  const ecarts: string[] = [];
  const constate = (nom: string, ok: boolean, detail: string) => {
    console.log(`${ok ? 'OK  ' : 'ECHEC'} ${nom.padEnd(52)} ${detail}`);
    if (!ok) ecarts.push(nom);
  };

  // ---- le groupe
  const groupe = totauxPar('groupe', lignesRdv, lignesVendeur)[0];
  constate(
    'total de la campagne, relu en base',
    groupe?.total === RDV_JUIN.length,
    `${groupe?.total ?? 0} (attendu ${RDV_JUIN.length})`
  );
  constate(
    'ventilation VN / VO',
    groupe?.vn === 903 && groupe?.vo === 204,
    `VN ${groupe?.vn ?? 0} / VO ${groupe?.vo ?? 0} (attendu 903 / 204)`
  );

  // ---- les 19 sites, contre l'onglet RESULTATS
  const parSite = totauxPar('site', lignesRdv, lignesVendeur);
  const parSiteCle = new Map(parSite.map((t) => [cleLibelle(t.libelle), t]));
  const ecartsSites: string[] = [];
  for (const attendu of ATTENDUS_SITES) {
    const obtenu = parSiteCle.get(cleLibelle(attendu.nom));
    if (!obtenu) {
      ecartsSites.push(`${attendu.nom} : absent`);
      continue;
    }
    if (obtenu.total !== attendu.total || obtenu.vn !== attendu.vn || obtenu.vo !== attendu.vo) {
      ecartsSites.push(
        `${attendu.nom} : ${obtenu.total}/${obtenu.vn}/${obtenu.vo} au lieu de ` +
          `${attendu.total}/${attendu.vn}/${attendu.vo}`
      );
    }
  }
  constate(
    `les ${ATTENDUS_SITES.length} sites, total et ventilation VN / VO`,
    ecartsSites.length === 0,
    ecartsSites.length > 0 ? ecartsSites.slice(0, 3).join(' ; ') : 'tous conformes'
  );

  // ---- la ligne 2 des onglets site, la ou sa formule n'est pas cassee
  //
  // GAILL et CARM sont EXCLUS : leur `COUNTA` porte des `#REF!` et vise des
  // lignes supprimees — le nombre affiche est une valeur figee, fausse de 10 et
  // 25 RDV. Ce n'est pas notre lecture qui derive, elle se recoupe a l'unite avec
  // RESULTATS. C'est precisement la fragilite que cet outil remplace.
  const joursCampagne = jours.map((j) => j.jour).sort();
  const ecartsJour: string[] = [];
  let comparaisons = 0;
  let ignores = 0;
  for (const [code, sourceJours] of Object.entries(ATTENDUS_TOTAUX_JOUR)) {
    const duSite = lignesVendeur.filter((v) => v.siteId === code);
    if (duSite.length === 0) continue;
    const obtenus = totauxParJour(lignesRdv, joursCampagne, duSite);
    for (let i = 0; i < sourceJours.length; i++) {
      const attendu = sourceJours[i];
      if (!attendu?.fiable) {
        ignores++;
        continue;
      }
      comparaisons++;
      const obtenu = obtenus[i];
      if (obtenu?.total !== attendu.rdv) {
        ecartsJour.push(`${code} ${attendu.jour} : ${obtenu?.total ?? '?'} au lieu de ${attendu.rdv}`);
      }
    }
  }
  constate(
    `la ligne 2 des onglets site (${comparaisons} jours, ${ignores} ignores)`,
    ecartsJour.length === 0,
    ecartsJour.length > 0 ? ecartsJour.slice(0, 3).join(' ; ') : 'tous conformes'
  );

  console.log('');
  if (ecarts.length > 0) {
    console.error(
      `${ecarts.length} ecart(s) avec le classeur. Les RDV sont ecrits, mais l'import NE DOIT\n` +
        `PAS etre tenu pour valide : les totaux du produit ne sont pas ceux du fichier.`
    );
    process.exit(1);
  }
  console.log(
    "Les totaux relus en base et ceux du classeur concordent a l'unite.\n" +
      'Critere de recette n.4 tenu sur la vraie base, et plus seulement en memoire.'
  );
}

/// Normalisation des libelles de site pour la comparaison au classeur :
/// insensible aux accents, aux tirets et aux espaces multiples. Reprise a
/// l'identique de `tester-agregats.ts`, dont ce controle est le prolongement.
const cleLibelle = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toUpperCase()
    .replace(/[-\s]+/g, ' ')
    .trim();

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
