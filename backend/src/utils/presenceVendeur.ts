// ============================================================================
// PRESENCE D'UN VENDEUR PENDANT UNE CAMPAGNE — source de verite UNIQUE.
//
// Ce filtre est utilise a deux endroits qui doivent donner le meme resultat :
//   - `auth/campagneScope.ts`, pour savoir sur qui on peut saisir,
//   - les agregations du dashboard, pour calculer l'EFFECTIF.
//
// Il vit donc ici, et non recopie dans les deux. C'est la lecon de
// `constants.ts` sur GEARBOX : une regle d'agregation dupliquee a fait diverger
// Budget et Dashboard quatre fois. Une note << a garder synchronise >> ne
// synchronise rien.
//
// POURQUOI CE FILTRE EXISTE. `schema.sql` comptait l'effectif d'un site avec
// `count(distinct vendeur) where date_sortie is null` — c'est-a-dire les presents
// AUJOURD'HUI — tout en additionnant les RDV de TOUS les vendeurs. La moyenne
// RDV/vendeur d'une campagne passee changeait donc des qu'un vendeur partait.
//
// C'est le bug `RANK!AG` du fichier Excel par un autre chemin : la-bas l'effectif
// etait saisi a la main (2, 7, 11, 6, 6, 4...) et devenait faux sans que personne
// ne le voie ; ici il aurait ete calcule, mais a la mauvaise date. Meme symptome
// pour l'utilisateur : un chiffre historique qui bouge tout seul.
//
// La bonne question n'est pas << ce vendeur est-il encore la ? >> mais
// << ce vendeur etait-il la PENDANT cette campagne ? >>.
// ============================================================================

export interface BornesCampagne {
  dateDebut: Date;
  dateFin: Date;
}

/// Clause Prisma `where` a appliquer sur `vendeur`.
///
/// `dateEntree` nulle signifie << present depuis toujours >> : le seed importe
/// 99 vendeurs sans date d'entree, l'information n'existe pas dans le fichier
/// Excel source. Idem `dateSortie` nulle pour << toujours present >>.
///
/// L'ARCHIVAGE EST FILTRE ICI AUSSI, et c'est deliberé. Un vendeur archive ne
/// doit apparaitre NULLE PART — ni dans la saisie, ni dans les tables, ni dans le
/// dashboard, ni dans un effectif. Mettre cette clause ici plutot que de la
/// recopier dans cinq requetes evite qu'un ecran l'oublie : c'est exactement
/// ainsi qu'un vendeur archive reapparaitrait dans un seul classement, et que
/// deux totaux cesseraient de concorder sans qu'on sache pourquoi.
///
/// A ne pas confondre avec `dateSortie` : une personne SORTIE reste comptee dans
/// les campagnes qu'elle a vecues — c'est une donnee metier. Une ligne ARCHIVEE
/// est retiree de l'affichage, mais ses RDV restent en base, donc les totaux des
/// campagnes passees ne bougent pas.
export const presenceVendeur = (campagne: BornesCampagne) => ({
  archiveLe: null,
  AND: [
    { OR: [{ dateEntree: null }, { dateEntree: { lte: campagne.dateFin } }] },
    { OR: [{ dateSortie: null }, { dateSortie: { gte: campagne.dateDebut } }] },
  ],
});

/// Meme regle, en memoire, pour un vendeur deja charge. Utile quand on a la liste
/// et qu'on ne veut pas d'un second aller-retour en base.
export const etaitPresent = (
  vendeur: { dateEntree: Date | null; dateSortie: Date | null },
  campagne: BornesCampagne
): boolean => {
  const entreAvantLaFin = vendeur.dateEntree === null || vendeur.dateEntree <= campagne.dateFin;
  const sortiApresLeDebut = vendeur.dateSortie === null || vendeur.dateSortie >= campagne.dateDebut;
  return entreAvantLaFin && sortiApresLeDebut;
};
