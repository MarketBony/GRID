// ============================================================================
// CHANGER LE MOT DE PASSE D'UN COMPTE
//
// Usage :
//   MOT_DE_PASSE="votre-mot-de-passe" npx tsx prisma/mot-de-passe.ts admin
//
// ou, depuis la racine du projet :
//   MOT_DE_PASSE="..." npm --prefix backend run mot-de-passe -- admin
//
// Le mot de passe passe par une VARIABLE D'ENVIRONNEMENT et non par un argument
// de ligne de commande : les arguments d'un processus sont lisibles par les autres
// processus de la machine, et ils atterrissent dans l'historique du terminal.
//
// Il n'est jamais affiche, jamais journalise, et seul son hachage bcrypt est
// stocke. Rien ici ne permet de le retrouver.
// ============================================================================

import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const loginId = process.argv[2];
  const motDePasse = process.env.MOT_DE_PASSE;

  if (!loginId) {
    console.error('Usage : MOT_DE_PASSE="..." npx tsx prisma/mot-de-passe.ts <loginId>');
    console.error('\nComptes existants :');
    const comptes = await prisma.utilisateur.findMany({
      orderBy: { loginId: 'asc' },
      select: { loginId: true, nom: true, actif: true, rolesGlobaux: { select: { role: true } } },
    });
    for (const c of comptes) {
      const roles = c.rolesGlobaux.map((r) => r.role).join(', ') || 'aucun role global';
      console.error(`  ${c.loginId.padEnd(14)} ${c.nom.padEnd(24)} ${roles}${c.actif ? '' : ' (inactif)'}`);
    }
    process.exit(1);
  }

  if (!motDePasse || motDePasse.length < 8) {
    console.error('MOT_DE_PASSE manquant, ou trop court (8 caracteres minimum).');
    console.error('Exemple : MOT_DE_PASSE="..." npx tsx prisma/mot-de-passe.ts admin');
    process.exit(1);
  }

  const utilisateur = await prisma.utilisateur.findUnique({ where: { loginId } });
  if (!utilisateur) {
    console.error(`Compte "${loginId}" introuvable. Lancer sans argument pour lister les comptes.`);
    process.exit(1);
  }

  await prisma.utilisateur.update({
    where: { loginId },
    data: { passwordHash: await bcrypt.hash(motDePasse, 10), actif: true },
  });

  console.log(`Mot de passe change pour "${loginId}" (${utilisateur.nom}).`);
  console.log('Le compte est actif.');
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
