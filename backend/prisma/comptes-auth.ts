// ============================================================================
// RELIER UN COMPTE METIER A UNE IDENTITE SUPABASE AUTH.
//
// POURQUOI CE SCRIPT EXISTE, alors que l'application sait creer des comptes :
// il faut bien creer LE PREMIER. L'Edge Function `gerer-comptes` exige un appelant
// `admin` deja connecte ; sans amorcage, personne ne peut jamais entrer. C'est le
// meme role que `mot-de-passe.ts` tenait pour l'authentification precedente.
//
// Il sert aussi a RELIER les comptes que le seed a crees — ils existent en base
// avec un hachage bcrypt devenu inutile, et sans `auth_uid` ils ne peuvent pas se
// connecter.
//
// ---------------------------------------------------------------------------
// LA CLE `service_role` NE TRAVERSE JAMAIS LE NAVIGATEUR
// ---------------------------------------------------------------------------
// Elle contourne TOUTE la RLS. Elle vit dans `backend/.env.supabase`, qui est
// ignore par git, et n'est lue que par ce script et par l'Edge Function. Le mot de
// passe vient de la variable d'environnement `MOT_DE_PASSE` et jamais d'un
// argument : les arguments d'un processus sont lisibles par les autres processus
// de la machine et restent dans l'historique du terminal.
//
// ---------------------------------------------------------------------------
// L'ADRESSE EST UNE SYNTHESE, PAS UNE BOITE AUX LETTRES
// ---------------------------------------------------------------------------
// Supabase Auth exige un e-mail ; nos comptes ont un identifiant. On compose donc
// `<loginId>@grid.bonyauto-mobile.com`. CE DOMAINE NE RECOIT RIEN et personne ne
// doit croire le contraire : aucun message ne partira jamais vers ces adresses.
// C'est pourquoi la confirmation d'e-mail est desactivee cote Supabase — sinon
// aucun compte ne pourrait confirmer une adresse qui n'existe pas.
//
// Usage :
//   set -a; . ./backend/.env.supabase; set +a
//   MOT_DE_PASSE="..." npm --prefix backend run comptes-auth -- admin.test sbesson
//   MOT_DE_PASSE="..." npm --prefix backend run comptes-auth -- --tous
// ============================================================================

import { randomBytes } from 'node:crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const URL_PROJET = process.env.VITE_SUPABASE_URL;
const CLE_SECRETE = process.env.SUPABASE_SECRET_KEY;
const DOMAINE = 'grid.bonyauto-mobile.com';

const adresse = (loginId: string) => `${loginId.trim().toLowerCase()}@${DOMAINE}`;

interface UtilisateurAuth {
  id: string;
  email: string;
}

async function appelAdmin(chemin: string, options: RequestInit = {}) {
  const reponse = await fetch(`${URL_PROJET}/auth/v1/admin${chemin}`, {
    ...options,
    headers: {
      apikey: CLE_SECRETE!,
      Authorization: `Bearer ${CLE_SECRETE}`,
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  });
  const corps = await reponse.json().catch(() => null);
  if (!reponse.ok) {
    throw new Error(
      `Supabase Auth ${reponse.status} sur ${chemin} : ${JSON.stringify(corps)?.slice(0, 200)}`
    );
  }
  return corps;
}

/// Cherche une identite par son adresse. L'API admin ne propose pas de recherche
/// exacte : on pagine et on compare, ce qui reste trivial a l'echelle du produit
/// (quelques dizaines de comptes).
async function trouverIdentite(email: string): Promise<UtilisateurAuth | null> {
  for (let page = 1; page <= 20; page++) {
    const corps = (await appelAdmin(`/users?page=${page}&per_page=200`)) as {
      users: UtilisateurAuth[];
    };
    const trouve = corps.users?.find((u) => u.email?.toLowerCase() === email);
    if (trouve) return trouve;
    if (!corps.users || corps.users.length < 200) return null;
  }
  return null;
}

async function main() {
  if (!URL_PROJET || !CLE_SECRETE) {
    console.error(
      'VITE_SUPABASE_URL et SUPABASE_SECRET_KEY sont requises.\n' +
        '  set -a; . ./backend/.env.supabase; set +a'
    );
    process.exit(1);
  }

  const args = process.argv.slice(2);
  const tous = args.includes('--tous');
  const demandes = args.filter((a) => !a.startsWith('--'));

  if (!tous && demandes.length === 0) {
    const comptes = await prisma.utilisateur.findMany({
      where: { archiveLe: null },
      select: { loginId: true, nom: true, actif: true, authUid: true },
      orderBy: { loginId: 'asc' },
    });
    console.log('\n  Comptes en base :\n');
    for (const c of comptes) {
      const etat = c.authUid ? 'relie' : 'PAS RELIE';
      console.log(`    ${c.loginId.padEnd(18)} ${etat.padEnd(10)} ${c.actif ? '' : '(desactive) '}${c.nom}`);
    }
    console.log('\n  Relier :  MOT_DE_PASSE="..." npm --prefix backend run comptes-auth -- <loginId> [...]');
    console.log('  Ou tous :  MOT_DE_PASSE="..." npm --prefix backend run comptes-auth -- --tous\n');
    return;
  }

  const motDePasse = process.env.MOT_DE_PASSE ?? randomBytes(12).toString('base64url');
  const genere = !process.env.MOT_DE_PASSE;

  // Le minimum impose par le projet Supabase est de 12 caracteres. Autant le dire
  // ici plutot que de laisser l'API refuser compte par compte.
  if (motDePasse.length < 12) {
    console.error('Le mot de passe doit faire au moins 12 caracteres (reglage du projet Supabase).');
    process.exit(1);
  }

  const comptes = await prisma.utilisateur.findMany({
    where: tous ? { archiveLe: null } : { loginId: { in: demandes } },
    select: { id: true, loginId: true, nom: true },
    orderBy: { loginId: 'asc' },
  });

  if (comptes.length === 0) {
    console.error('Aucun compte ne correspond.');
    process.exit(1);
  }

  for (const c of comptes) {
    const email = adresse(c.loginId);
    const existante = await trouverIdentite(email);

    let uid: string;
    if (existante) {
      // IDEMPOTENT : rejouer ce script realigne le mot de passe au lieu d'echouer.
      await appelAdmin(`/users/${existante.id}`, {
        method: 'PUT',
        body: JSON.stringify({ password: motDePasse, email_confirm: true }),
      });
      uid = existante.id;
    } else {
      const cree = (await appelAdmin('/users', {
        method: 'POST',
        body: JSON.stringify({ email, password: motDePasse, email_confirm: true }),
      })) as UtilisateurAuth;
      uid = cree.id;
    }

    await prisma.utilisateur.update({ where: { id: c.id }, data: { authUid: uid } });
    console.log(`  ${c.loginId.padEnd(18)} relie  ${email}`);
  }

  console.log(`\n  Mot de passe : ${motDePasse}`);
  if (genere) {
    console.log('  A noter maintenant : il est tire au hasard et n\'est stocke nulle part.');
  }
  console.log(
    '\n  L\'ecran de connexion demande un IDENTIFIANT, pas cette adresse :\n' +
      '  la composition est enfermee dans `services/api.ts`.\n'
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
