// ============================================================================
// VERIFICATION DU PARSEUR D'IMPORT DES MARQUES
//
// `analyser` est une fonction pure : elle se teste sans base, sans serveur et
// sans framework. C'est precisement pourquoi elle a ete ecrite ainsi.
//
// Le referentiel de test contient DELIBEREMENT un homonyme sur deux sites. Les
// 99 vendeurs reels n'en comportent aucun (verifie : 99 cles distinctes), mais un
// recrutement peut en creer un demain, et c'est le cas ou un import qui devine
// attribue des marques au mauvais vendeur.
//
// Usage : npm --prefix backend run test:import
// ============================================================================

import { analyser, ErreurImport, cleNom, type Referentiels } from './importMarques';

const REF: Referentiels = {
  marques: [
    { id: '1', code: 'RENAULT', libelle: 'Renault' },
    { id: '2', code: 'DACIA', libelle: 'Dacia' },
    { id: '3', code: 'ALPINE', libelle: 'Alpine' },
  ],
  sites: [
    { id: '10', code: 'CLF', libelle: 'Clermont-Ferrand' },
    { id: '11', code: 'MOZ', libelle: 'Mozac' },
    { id: '12', code: 'ALPINE', libelle: 'Alpine' },
  ],
  vendeurs: [
    { id: '100', nom: 'VALENTIN PARPINELLI', siteId: '10', marqueIds: ['1', '2'] },
    { id: '101', nom: 'THÉO ROUSSET', siteId: '10', marqueIds: ['1', '2'] },
    { id: '102', nom: 'JEAN-PIERRE FERRIER', siteId: '10', marqueIds: ['1', '2'] },
    { id: '103', nom: 'SÉBASTIEN MIRA', siteId: '12', marqueIds: ['3'] },
    // Homonyme volontaire, sur deux sites.
    { id: '104', nom: 'MARIE DUPONT', siteId: '10', marqueIds: ['1', '2'] },
    { id: '105', nom: 'MARIE DUPONT', siteId: '11', marqueIds: ['1', '2'] },
  ],
};

const resultats: { nom: string; ok: boolean; detail: string }[] = [];

const verifier = (nom: string, condition: boolean, detail: string) =>
  resultats.push({ nom, ok: condition, detail });

const verifierErreur = (nom: string, contenu: string, motif: RegExp) => {
  try {
    analyser(contenu, REF);
    resultats.push({ nom, ok: false, detail: 'accepte alors que ce devait echouer' });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    resultats.push({
      nom,
      ok: e instanceof ErreurImport && motif.test(message),
      detail: e instanceof ErreurImport ? message.slice(0, 90) : `mauvais type : ${message.slice(0, 60)}`,
    });
  }
};

// ---------------------------------------------------------------- normalisation
verifier(
  'cleNom insensible a l ordre des mots',
  cleNom('VALENTIN PARPINELLI') === cleNom('PARPINELLI VALENTIN'),
  'prenom/nom interchangeables'
);
verifier(
  'cleNom insensible aux accents et traits d union',
  cleNom('JEAN-PIERRE FERRIER') === cleNom('ferrier jean pierre'),
  'accents, casse, traits d union'
);

// ---------------------------------------------------------------- format groupe
{
  const a = analyser(
    ['CLF\tVALENTIN PARPINELLI\tRENAULT', 'ALPINE\tSÉBASTIEN MIRA\tALPINE'].join('\n'),
    REF
  );
  verifier('format groupe : separateur et format detectes',
    a.separateur === 'tabulation' && a.format === 'marques_groupees',
    `${a.separateur} / ${a.format}`);
  verifier('format groupe : 2 lignes resolues', a.resume.resolues === 2, JSON.stringify(a.resume));
  // Parpinelli passe de Renault+Dacia a Renault seul : c'est un changement.
  // Mira reste sur Alpine : resolu mais sans changement.
  verifier('format groupe : 1 seul changement reel',
    a.resume.changements === 1 && a.resume.inchangees === 1,
    `changements=${a.resume.changements} inchangees=${a.resume.inchangees}`);
}

// ---------------------------------------------------------------- ordre inverse
{
  const a = analyser('CLF\tPARPINELLI VALENTIN\tDACIA', REF);
  const l = a.lignes[0];
  verifier('nom en ordre inverse rapproche du bon vendeur',
    l.statut === 'resolue' && l.vendeurId === '100',
    l.statut === 'resolue' ? `-> ${l.nomVendeur}` : l.statut);
}

// ---------------------------------------------------------------- une colonne par marque
{
  const a = analyser(
    [
      'Site\tNom\tRenault\tDacia\tAlpine',
      'CLF\tTHÉO ROUSSET\tx\t\t',
      'CLF\tJEAN-PIERRE FERRIER\tx\tx\t',
    ].join('\n'),
    REF
  );
  verifier('une colonne par marque : en-tete et format detectes',
    a.enTeteDetecte && a.format === 'une_colonne_par_marque',
    `enTete=${a.enTeteDetecte} format=${a.format}`);
  const rousset = a.lignes.find((l) => l.statut === 'resolue' && l.vendeurId === '101');
  verifier('une colonne par marque : x seul = Renault seul',
    rousset?.statut === 'resolue' && rousset.marqueIds.length === 1 && rousset.marqueIds[0] === '1',
    rousset?.statut === 'resolue' ? rousset.marquesLibelles.join('+') : 'non resolue');
  verifier('une colonne par marque : numero de ligne decale par l en-tete',
    a.lignes[0].numero === 2,
    `numero premiere ligne = ${a.lignes[0].numero}`);
}

// ---------------------------------------------------------------- point-virgule
{
  const a = analyser('CLF;VALENTIN PARPINELLI;RENAULT DACIA', REF);
  verifier('separateur point-virgule', a.separateur === 'point-virgule', a.separateur);
}

// ---------------------------------------------------------------- ambiguite
{
  const a = analyser('MARIE DUPONT\tRENAULT', REF);
  const l = a.lignes[0];
  verifier('homonyme sans colonne de site : signale ambigu, pas devine',
    l.statut === 'ambigue' && l.candidats.length === 2,
    l.statut === 'ambigue' ? l.candidats.map((c) => c.codeSite).join(' / ') : l.statut);
}
{
  const a = analyser('MOZ\tMARIE DUPONT\tRENAULT', REF);
  const l = a.lignes[0];
  verifier('homonyme AVEC colonne de site : leve l ambiguite',
    l.statut === 'resolue' && l.vendeurId === '105',
    l.statut === 'resolue' ? `-> site ${l.codeSite}` : l.statut);
}

// ---------------------------------------------------------------- cas refuses
{
  // Cas realiste : un tableau de plusieurs lignes dont une porte une faute de
  // frappe. La colonne des noms est deduite des lignes reconnues, et la ligne
  // fautive est signalee sans faire echouer l'import entier.
  const a = analyser(
    [
      'CLF\tVALENTIN PARPINELLI\tRENAULT',
      'CLF\tJEANNE INCONNUE\tRENAULT',
      'CLF\tTHÉO ROUSSET\tRENAULT DACIA',
    ].join('\n'),
    REF
  );
  verifier('nom inconnu parmi des lignes valides : signale, n echoue pas',
    a.resume.introuvables === 1 && a.resume.resolues === 2,
    JSON.stringify(a.resume));
}
{
  // Une marque inconnue au milieu de lignes valides doit designer LA LIGNE,
  // pas invalider le tableau entier.
  const a = analyser(
    ['CLF\tVALENTIN PARPINELLI\tMOBILIZE', 'CLF\tTHÉO ROUSSET\tRENAULT'].join('\n'),
    REF
  );
  const l = a.lignes.find((x) => x.statut === 'marque_inconnue');
  verifier('marque inconnue : ligne signalee, tableau conserve',
    l?.statut === 'marque_inconnue' && l.codesInconnus.includes('MOBILIZE') && a.resume.resolues === 1,
    l?.statut === 'marque_inconnue' ? `${l.codesInconnus.join(',')} / resolues=${a.resume.resolues}` : 'non detectee');
}
{
  // Colonne marques vide : ne JAMAIS interpreter comme « ce vendeur ne vend rien ».
  const a = analyser(
    ['Site\tNom\tRenault\tDacia\tAlpine', 'CLF\tVALENTIN PARPINELLI\t\t\t'].join('\n'),
    REF
  );
  verifier('aucune marque cochee : refuse au lieu de tout retirer',
    a.lignes[0].statut === 'sans_marque',
    a.lignes[0].statut);
}

verifierErreur('une seule colonne : erreur explicite', 'VALENTIN PARPINELLI', /separateur/i);
verifierErreur(
  'une colonne par marque SANS en-tete : erreur explicite',
  'CLF\tVALENTIN PARPINELLI\tx\tx\t',
  /en-tete|marques reconnue/i
);
verifierErreur('contenu vide', '   \n  \n', /vide/i);
verifierErreur(
  'aucune colonne de noms reconnue',
  'CLF\tZZZ AAA\tRENAULT\nMOZ\tYYY BBB\tDACIA',
  /noms de vendeurs reconnus/i
);

// ---------------------------------------------------------------- restitution
const largeur = Math.max(...resultats.map((r) => r.nom.length));
console.log('');
for (const r of resultats) {
  console.log(`${r.ok ? 'OK  ' : 'ECHEC'} ${r.nom.padEnd(largeur)}  ${r.detail}`);
}
const echecs = resultats.filter((r) => !r.ok).length;
console.log(`\n${resultats.length - echecs}/${resultats.length} verifications du parseur.`);
if (echecs > 0) process.exit(1);
