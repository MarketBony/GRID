// ============================================================================
// IMPORT DES MARQUES AUTORISEES PAR COLLAGE (F-A3.6)
//
// Fonction PURE : elle prend le texte colle et les referentiels, elle rend un
// APERCU. Elle n'ecrit rien, elle ne connait pas Prisma. C'est ce qui la rend
// testable sans base et c'est ce qui permet le fonctionnement en deux temps —
// analyser, montrer, puis appliquer ce que l'utilisateur a valide.
//
// POURQUOI DEUX TEMPS. Un import qui devine attribue des marques au mauvais
// vendeur, et le trigger R-C.1 refusera ensuite des RDV parfaitement legitimes.
// On chercherait le defaut dans la saisie alors qu'il vient de l'import, des
// semaines plus tot. Rien n'est donc applique sans confirmation explicite, et
// toute ambiguite est REMONTEE au lieu d'etre tranchee.
//
// FORMATS ACCEPTES. Deux, parce qu'un tableau Excel se colle des deux facons :
//
//   a) une colonne contenant les marques
//        CLF   VALENTIN PARPINELLI   RENAULT DACIA
//
//   b) une colonne par marque, avec un marqueur
//        Site  Nom                   Renault  Dacia  Alpine
//        CLF   VALENTIN PARPINELLI   x        x
//
// La forme (b) EXIGE un en-tete : sans lui, rien ne dit quelle colonne est quelle
// marque, et deviner par l'ordre serait exactement le genre de supposition qui
// finit par attribuer Alpine a tout un site.
//
// RAPPROCHEMENT DES NOMS. Par ensemble de mots trie, apres retrait des accents et
// remplacement des traits d'union par des espaces. << VALENTIN PARPINELLI >> et
// << PARPINELLI VALENTIN >> sont donc reconnus comme le meme vendeur : le fichier
// source du groupe ne garantit pas l'ordre prenom/nom, et 99 lignes rejetees pour
// cette raison seraient 99 lignes a reprendre a la main.
// ============================================================================

export interface VendeurRef {
  id: string;
  nom: string;
  siteId: string;
  marqueIds: string[];
}

export interface SiteRef {
  id: string;
  code: string;
  libelle: string;
}

export interface MarqueRef {
  id: string;
  code: string;
  libelle: string;
}

export interface Referentiels {
  vendeurs: VendeurRef[];
  sites: SiteRef[];
  marques: MarqueRef[];
}

export type Ligne =
  | {
      statut: 'resolue';
      numero: number;
      vendeurId: string;
      nomVendeur: string;
      codeSite: string;
      marqueIds: string[];
      marquesLibelles: string[];
      /// `false` quand les marques lues sont deja celles en base : la ligne est
      /// valide mais n'a rien a appliquer. Distinguer les deux evite d'annoncer
      /// << 99 lignes appliquees >> quand une seule a change.
      changement: boolean;
    }
  | { statut: 'introuvable'; numero: number; nom: string; codeSite: string | null }
  | {
      statut: 'ambigue';
      numero: number;
      nom: string;
      candidats: { vendeurId: string; codeSite: string }[];
    }
  | { statut: 'marque_inconnue'; numero: number; nom: string; codesInconnus: string[] }
  | { statut: 'sans_marque'; numero: number; nom: string };

export interface Apercu {
  separateur: 'tabulation' | 'point-virgule' | 'virgule';
  enTeteDetecte: boolean;
  format: 'marques_groupees' | 'une_colonne_par_marque';
  colonneNom: number;
  colonneSite: number | null;
  lignes: Ligne[];
  resume: {
    total: number;
    resolues: number;
    changements: number;
    inchangees: number;
    introuvables: number;
    ambigues: number;
    marquesInconnues: number;
    sansMarque: number;
  };
}

export class ErreurImport extends Error {}

// ---------------------------------------------------------------- normalisation

/// Majuscules, accents retires, traits d'union et apostrophes en espaces, espaces
/// reduits. `Sebastien MIRA` et `SEBASTIEN  MIRA` donnent la meme chose.
export const normaliser = (v: string): string =>
  v
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toUpperCase()
    .replace(/[-'’]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/// Cle de rapprochement insensible a l'ordre des mots.
export const cleNom = (v: string): string => normaliser(v).split(' ').filter(Boolean).sort().join(' ');

const MARQUEURS_VRAIS = new Set(['X', '1', 'OUI', 'O', 'YES', 'TRUE', 'VRAI', '✓', 'V']);
const estVrai = (v: string): boolean => MARQUEURS_VRAIS.has(normaliser(v));

// ---------------------------------------------------------------- decoupage

const SEPARATEURS: { car: string; nom: Apercu['separateur'] }[] = [
  { car: '\t', nom: 'tabulation' },
  { car: ';', nom: 'point-virgule' },
  { car: ',', nom: 'virgule' },
];

/// Le separateur retenu est le premier present dans la MAJORITE des lignes.
/// L'ordre compte : la tabulation d'abord, parce qu'un collage depuis Excel en
/// produit toujours, et qu'une liste de marques dans une cellule peut contenir
/// des virgules — les tester dans l'autre sens decouperait cette cellule.
function choisirSeparateur(lignes: string[]): { car: string; nom: Apercu['separateur'] } {
  for (const sep of SEPARATEURS) {
    const avec = lignes.filter((l) => l.includes(sep.car)).length;
    if (avec > lignes.length / 2) return sep;
  }
  throw new ErreurImport(
    'Aucun separateur reconnu. Coller depuis Excel (tabulations), ou utiliser des ' +
      'points-virgules. Une seule colonne ne suffit pas : il faut au moins le nom et les marques.'
  );
}

// ---------------------------------------------------------------- analyse

export function analyser(contenu: string, ref: Referentiels): Apercu {
  const brutes = contenu
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l.trim() !== '');

  if (brutes.length === 0) throw new ErreurImport('Le contenu colle est vide.');

  const sep = choisirSeparateur(brutes);
  const grille = brutes.map((l) => l.split(sep.car).map((c) => c.trim()));

  // Index des referentiels.
  const parCleNom = new Map<string, VendeurRef[]>();
  for (const v of ref.vendeurs) {
    const cle = cleNom(v.nom);
    const existant = parCleNom.get(cle);
    if (existant) existant.push(v);
    else parCleNom.set(cle, [v]);
  }
  const siteParId = new Map(ref.sites.map((s) => [s.id, s]));
  const siteParCode = new Map(ref.sites.map((s) => [normaliser(s.code), s]));
  const marqueParTerme = new Map<string, MarqueRef>();
  for (const m of ref.marques) {
    marqueParTerme.set(normaliser(m.code), m);
    marqueParTerme.set(normaliser(m.libelle), m);
  }

  // --- en-tete ------------------------------------------------------------
  const premiere = grille[0];
  const colonnesMarque = new Map<number, MarqueRef>();
  let colonneNom = -1;
  let colonneSite: number | null = null;
  let colonneMarquesGroupees: number | null = null;

  const cellulesMarque = premiere
    .map((c, i) => ({ i, marque: marqueParTerme.get(normaliser(c)) }))
    .filter((x) => x.marque);

  // Le critere decisif est l'ABSENCE de nom de vendeur connu.
  //
  // Se fier a la seule presence d'un nom de marque etait faux : au format
  // « marques groupees » sans en-tete, la premiere ligne de donnees contient
  // forcement une marque (`CLF | PARPINELLI VALENTIN | DACIA`) et se faisait
  // donc avaler comme en-tete — le premier vendeur du fichier disparaissait en
  // silence. Une vraie ligne d'en-tete, elle, ne porte jamais de nom de vendeur.
  const contientUnVendeur = premiere.some((c) => parCleNom.has(cleNom(c)));

  // Second garde-fou : un en-tete qui ne laisserait AUCUNE ligne de donnees n'est
  // pas un en-tete. Sans lui, un collage d'une seule ligne dont le vendeur est
  // inconnu — une correction ponctuelle, cas tres courant — etait rejete comme
  // « contenu reduit a un en-tete » au lieu de signaler le nom introuvable.
  const ressembleEnTete =
    grille.length > 1 &&
    !contientUnVendeur &&
    (cellulesMarque.length > 0 ||
      premiere.some((c) => /^(nom|vendeur|commercial|site|code|concession|marque|marques)$/i.test(c.trim())));

  let corps = grille;
  let enTeteDetecte = false;

  if (ressembleEnTete) {
    enTeteDetecte = true;
    corps = grille.slice(1);

    for (const { i, marque } of cellulesMarque) colonnesMarque.set(i, marque!);

    premiere.forEach((cellule, i) => {
      const n = normaliser(cellule);
      if (colonneNom === -1 && /^(NOM|VENDEUR|COMMERCIAL|NOM VENDEUR|NOM DU VENDEUR)$/.test(n)) colonneNom = i;
      if (colonneSite === null && /^(SITE|CODE|CODE SITE|CONCESSION)$/.test(n)) colonneSite = i;
      if (colonneMarquesGroupees === null && /^(MARQUE|MARQUES)$/.test(n)) colonneMarquesGroupees = i;
    });
  }

  if (corps.length === 0) {
    throw new ErreurImport("Le contenu ne comporte qu'un en-tete, aucune ligne de donnees.");
  }

  // --- deduction des colonnes manquantes ---------------------------------
  // On ne se fie pas a l'ordre : on regarde QUELLES VALEURS chaque colonne
  // contient. Une colonne dont 60 % des valeurs sont des noms de vendeurs connus
  // est la colonne des noms, ou qu'elle se trouve.
  const nbColonnes = Math.max(...corps.map((l) => l.length));
  const score = (test: (v: string) => boolean) =>
    Array.from({ length: nbColonnes }, (_, i) => {
      const valeurs = corps.map((l) => l[i] ?? '').filter((v) => v !== '');
      if (valeurs.length === 0) return 0;
      return valeurs.filter(test).length / valeurs.length;
    });

  if (colonneNom === -1) {
    const scores = score((v) => parCleNom.has(cleNom(v)));
    const meilleur = scores.indexOf(Math.max(...scores));
    if (scores[meilleur] < 0.5) {
      throw new ErreurImport(
        "Aucune colonne ne contient de noms de vendeurs reconnus. Verifier que la colonne " +
          'des noms est bien presente, ou ajouter un en-tete comportant "Nom".'
      );
    }
    colonneNom = meilleur;
  }

  if (colonneSite === null) {
    const scores = score((v) => siteParCode.has(normaliser(v)));
    const meilleur = scores.indexOf(Math.max(...scores));
    if (scores[meilleur] >= 0.7 && meilleur !== colonneNom) colonneSite = meilleur;
  }

  if (colonnesMarque.size === 0 && colonneMarquesGroupees === null) {
    // « AU MOINS un terme connu », et non « tous les termes connus ».
    //
    // Avec `every`, une seule ligne portant une marque inconnue — MOBILIZE, une
    // faute de frappe — faisait chuter le score de la colonne et la rendait
    // indetectable : l'utilisateur recevait « aucune colonne de marques reconnue »
    // au lieu de « marque inconnue ligne 34 ». Le message pointait le tableau
    // entier au lieu de la ligne fautive.
    //
    // Le risque d'identifier a tort une colonne de commentaires contenant un nom
    // de marque est couvert par le fonctionnement en deux temps : l'apercu montre
    // exactement ce qui a ete lu avant que quoi que ce soit ne soit ecrit.
    const scores = score((v) => {
      const termes = normaliser(v)
        .split(/[\s,/+]+/)
        .filter(Boolean);
      return termes.length > 0 && termes.some((t) => marqueParTerme.has(t));
    });
    for (let i = 0; i < nbColonnes; i++) {
      if (i === colonneNom || i === colonneSite) continue;
      if (scores[i] >= 0.7) {
        colonneMarquesGroupees = i;
        break;
      }
    }

    // Dernier recours : les colonnes nom et site sont identifiees, et il n'en
    // reste qu'UNE seule non vide. Elle ne peut etre que celle des marques, quel
    // que soit son taux de termes reconnus.
    //
    // Sans cela, un petit tableau dont une bonne part des marques est mal
    // orthographiee n'atteignait pas le seuil et l'import etait refuse en bloc,
    // alors que le bon comportement est de l'accepter et de signaler chaque
    // ligne fautive individuellement.
    if (colonneMarquesGroupees === null) {
      const restantes: number[] = [];
      for (let i = 0; i < nbColonnes; i++) {
        if (i === colonneNom || i === colonneSite) continue;
        if (corps.some((l) => (l[i] ?? '').trim() !== '')) restantes.push(i);
      }
      if (restantes.length === 1) colonneMarquesGroupees = restantes[0];
    }
  }

  if (colonnesMarque.size === 0 && colonneMarquesGroupees === null) {
    throw new ErreurImport(
      "Aucune colonne de marques reconnue. Deux formats sont acceptes : une colonne " +
        'contenant les marques (par exemple "RENAULT DACIA"), ou une colonne par marque ' +
        "avec un x — ce second format exige un en-tete nommant les marques, sinon rien " +
        "n'indique quelle colonne correspond a quelle marque."
    );
  }

  const format: Apercu['format'] =
    colonnesMarque.size > 0 ? 'une_colonne_par_marque' : 'marques_groupees';

  // --- resolution ligne par ligne ----------------------------------------
  const lignes: Ligne[] = [];
  const decalage = enTeteDetecte ? 2 : 1; // numero affiche a l'utilisateur

  corps.forEach((cellules, index) => {
    const numero = index + decalage;
    const nom = (cellules[colonneNom] ?? '').trim();
    if (nom === '') return; // ligne vide sur la colonne du nom : on l'ignore

    const codeSite = colonneSite !== null ? (cellules[colonneSite] ?? '').trim() : '';
    const siteAttendu = codeSite ? siteParCode.get(normaliser(codeSite)) : undefined;

    // Marques lues.
    const codesLus: string[] = [];
    const codesInconnus: string[] = [];

    if (format === 'une_colonne_par_marque') {
      for (const [i, marque] of colonnesMarque) {
        if (estVrai(cellules[i] ?? '')) codesLus.push(marque.id);
      }
    } else {
      const brut = (cellules[colonneMarquesGroupees!] ?? '').trim();
      for (const terme of normaliser(brut).split(/[\s,/+]+/).filter(Boolean)) {
        const marque = marqueParTerme.get(terme);
        if (marque) codesLus.push(marque.id);
        else codesInconnus.push(terme);
      }
    }

    if (codesInconnus.length > 0) {
      lignes.push({ statut: 'marque_inconnue', numero, nom, codesInconnus });
      return;
    }

    // Rapprochement du vendeur.
    let candidats = parCleNom.get(cleNom(nom)) ?? [];
    if (siteAttendu) candidats = candidats.filter((v) => v.siteId === siteAttendu.id);

    if (candidats.length === 0) {
      lignes.push({ statut: 'introuvable', numero, nom, codeSite: codeSite || null });
      return;
    }

    if (candidats.length > 1) {
      lignes.push({
        statut: 'ambigue',
        numero,
        nom,
        candidats: candidats.map((v) => ({
          vendeurId: v.id,
          codeSite: siteParId.get(v.siteId)?.code ?? '?',
        })),
      });
      return;
    }

    const vendeur = candidats[0];

    // Aucune marque cochee : on REFUSE au lieu de retirer toutes les marques.
    // Une ligne vide dans un tableau veut presque toujours dire << je n'ai pas
    // l'information >>, pas << ce vendeur ne vend rien >>. Et un vendeur sans
    // marque ne peut plus recevoir aucun RDV.
    if (codesLus.length === 0) {
      lignes.push({ statut: 'sans_marque', numero, nom });
      return;
    }

    const marqueIds = [...new Set(codesLus)];
    const avant = [...vendeur.marqueIds].sort().join(',');
    const apres = [...marqueIds].sort().join(',');

    lignes.push({
      statut: 'resolue',
      numero,
      vendeurId: vendeur.id,
      nomVendeur: vendeur.nom,
      codeSite: siteParId.get(vendeur.siteId)?.code ?? '?',
      marqueIds,
      marquesLibelles: marqueIds.map(
        (id) => ref.marques.find((m) => m.id === id)?.libelle ?? id
      ),
      changement: avant !== apres,
    });
  });

  const compte = (s: Ligne['statut']) => lignes.filter((l) => l.statut === s).length;
  const resolues = lignes.filter((l) => l.statut === 'resolue') as Extract<Ligne, { statut: 'resolue' }>[];

  return {
    separateur: sep.nom,
    enTeteDetecte,
    format,
    colonneNom,
    colonneSite,
    lignes,
    resume: {
      total: lignes.length,
      resolues: resolues.length,
      changements: resolues.filter((l) => l.changement).length,
      inchangees: resolues.filter((l) => !l.changement).length,
      introuvables: compte('introuvable'),
      ambigues: compte('ambigue'),
      marquesInconnues: compte('marque_inconnue'),
      sansMarque: compte('sans_marque'),
    },
  };
}
