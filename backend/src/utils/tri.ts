// ============================================================================
// TRI DES LIBELLES — source de verite unique.
//
// POURQUOI CE FICHIER EXISTE, et ce n'est pas une preference de style.
//
// `order by nom asc` en SQL trie selon la COLLATION DE LA BASE. Constate le
// 31/08/2026, en preparant le deploiement :
//
//   - base de developpement (PostgreSQL sur Windows) : `French_France.1252` ;
//   - conteneur `postgres:17-alpine` : `en_US.utf8`.
//
// Les deux ne rendent pas le meme ordre. Sur les 101 vendeurs reels, cinq noms
// accentues changent de place — `JÉRÉMY DA COSTA` et `RÉMI DEGAND` reculent de
// huit rangs. C'est-a-dire que la liste de l'ecran de saisie, celui qu'un chef
// parcourt des yeux pendant une session, n'aurait PAS le meme ordre en
// production que sur le poste ou l'outil a ete eprouve.
//
// Le projet dit deja deux fois que ce n'est pas acceptable :
//
//   - `agregats.ts` : « un classement qui change en changeant de machine n'est
//     pas reproductible, donc pas contestable » ;
//   - `Vendeurs.tsx` : « un tri qui change de machine en machine n'est pas un
//     tri ».
//
// La bonne reponse n'est donc pas de choisir la collation du conteneur, mais de
// ne plus en dependre : les listes sont triees EN JAVASCRIPT, avec la meme cle
// partout. La collation de la base devient sans effet sur ce que voit
// l'utilisateur, et le choix d'image Postgres n'est plus une decision de
// produit.
//
// Cette logique existait en TROIS exemplaires dans le backend et TROIS dans le
// front. Interdit n.6 : une liste de valeurs ou une regle dupliquee sans
// controle finit par diverger.
//
// Ce fichier est desormais LE SEUL, des deux cotes. Le `tsconfig.json` du front
// le declare dans son `include` : le navigateur execute CE code, pas une copie.
// Une copie cote front serait une seconde implementation a redemontrer, et le
// jour ou les deux divergeraient, l'ecran et l'export ne classeraient plus
// pareil sans que rien ne le signale.
// ============================================================================

/// Retire les accents, sans toucher a la casse. Primitive commune a tout ce qui
/// doit ignorer les diacritiques : le tri, la recherche a l'ecran, la proposition
/// d'identifiant de compte, le nom d'un fichier exporte.
///
/// Elle est ici parce qu'elle existait en SIX exemplaires — trois dans le
/// backend, trois dans le front — et que la seule chose plus facile a laisser
/// diverger qu'une liste de valeurs, c'est une regle de normalisation ecrite en
/// quatre lignes qu'on recopie sans y penser. Interdit n.6.
export const sansDiacritiques = (s: string): string =>
  s.normalize('NFD').replace(/\p{Diacritic}/gu, '');

/// Cle de comparaison : accents retires, majuscules. `AMÉLIE` et `AMELIE`
/// donnent la meme cle, donc se rangent au meme endroit — c'est le comportement
/// attendu en francais, et il ne depend d'aucune locale ni d'aucune version
/// d'ICU.
///
/// SERT AUSSI A LA RECHERCHE. Un champ de filtre doit ignorer casse et accents
/// pour la meme raison qu'un tri : personne ne tape « THÉO » avec son accent. Les
/// deux besoins ont la meme cle, donc le meme code.
export const cleTri = (s: string): string => sansDiacritiques(s).toUpperCase();

/// Comparaison de deux libelles. Le second critere, la chaine BRUTE, garantit un
/// ordre TOTAL : sans lui, `AMELIE` et `AMÉLIE` seraient indiscernables et leur
/// ordre relatif dependrait de la stabilite du tri, donc de l'ordre d'arrivee
/// des lignes — c'est-a-dire, a nouveau, de la base.
export const comparerLibelle = (a: string, b: string): number => {
  const ca = cleTri(a);
  const cb = cleTri(b);
  if (ca !== cb) return ca < cb ? -1 : 1;
  if (a === b) return 0;
  return a < b ? -1 : 1;
};

/// Trie une liste d'objets sur un libelle, sans modifier l'entree.
export const trierPar = <T>(liste: T[], libelle: (x: T) => string): T[] =>
  [...liste].sort((a, b) => comparerLibelle(libelle(a), libelle(b)));
