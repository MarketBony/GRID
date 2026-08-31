// ============================================================================
// SERIALISATION DES BigInt — a importer AVANT toute route.
//
// Les cles primaires du modele sont des `bigint` (convention CLAUDE.md), donc
// Prisma renvoie des `BigInt` JavaScript. `JSON.stringify` LEVE UNE EXCEPTION sur
// un BigInt : sans ce correctif, la premiere route qui renvoie un enregistrement
// echoue avec "Do not know how to serialize a BigInt" — une erreur 500 opaque,
// tres loin de sa cause.
//
// Consequence a connaitre cote FRONT : tous les identifiants arrivent en CHAINE,
// pas en nombre. `types.ts` les type donc en `string`. Ne jamais comparer un id
// recu avec un nombre litteral, et ne jamais faire d'arithmetique dessus.
//
// Choix de la chaine plutot que du nombre : au-dela de 2^53 un nombre JavaScript
// perd des unites en silence. On ne les atteindra pas avec ~24 000 RDV par an,
// mais un identifiant tronque est le genre de bug qu'on ne voit jamais venir.
// ============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(BigInt.prototype as any).toJSON = function (): string {
  return this.toString();
};

export {};
