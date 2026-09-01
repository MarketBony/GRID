// ============================================================================
// LES 1107 RDV DE JUIN 2026, extraits du classeur par `scripts/extraire-xlsx.mjs`.
// NE PAS EDITER A LA MAIN : rejouer l'extraction.
//
// A QUOI CE FICHIER SERT
//
// Il alimente `tester-agregats.ts` — les 27 controles du critere de recette n.4,
// joues sur des fonctions PURES, sans base ni serveur.
//
// CORRECTION DU 01/09/2026. Ce bandeau disait : « aucune de ces lignes n'entre en
// base : c'est une decision explicite, la base ne recoit aucune donnee de juin ».
// Ce n'est plus vrai. Les 1107 lignes ont ete chargees dans la campagne Juin 2026
// par `importer-rdv-juin.ts`, sur demande de l'utilisateur.
//
// La raison est le tableau de bord : septembre porte un selecteur « Comparer a… »
// pointant sur juin, et avec une campagne vide il comparait a zero — chaque
// vendeur en progression infinie, ce qui est pire qu'une absence de comparaison.
//
// Ce fichier reste malgre tout la REFERENCE, et pas une copie de la base : c'est
// lui qui dit ce que la base DOIT contenir, et `importer-rdv-juin.ts` recoupe les
// deux a chaque passage.
//
// Sa raison d'etre est le critere de recette n.4 — << les totaux de l'outil et ceux
// du fichier Excel concordent a l'unite >>. Le produit existe parce que les agregats
// de l'Excel etaient faux ; livrer les notres sans pouvoir demontrer qu'ils sont
// justes reproduirait le defaut qu'on remplace. Ces 1107 lignes se recoupent avec
// quatre series de totaux independantes du fichier, verifiees a l'extraction.
//
// Le `client` est le TEXTE LIBRE de la cellule, tel quel : « RAGOT 208 » porte le
// vehicule, « CHOMEILLE* » une marque de suivi. Ce sont des noms reels — ce fichier
// ne quitte pas le poste.
// ============================================================================

export interface RdvSource {
  /// Code du site, tel que l'onglet le nomme.
  site: string;
  nomVendeur: string;
  /// Libelle de la section : une marque (`RENAULT`, `DACIA`, `ALPINE`) ou `VO`.
  marque: string;
  /// Jour ISO. Le fichier n'ecrit que « JEUDI 11 JUIN » : la date vient de la
  /// POSITION de la colonne, avec controle du numero lu.
  jour: string;
  /// Code du creneau, aligne sur `campagne_creneau.code`.
  creneau: string;
  client: string;
}

export const RDV_JUIN: RdvSource[] = [
 {
  "site": "CLF",
  "nomVendeur": "VALENTIN PARPINELLI",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "09:00-10:00",
  "client": "DELATOURAS"
 },
 {
  "site": "CLF",
  "nomVendeur": "VALENTIN PARPINELLI",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "09:00-10:00",
  "client": "CHARDON"
 },
 {
  "site": "CLF",
  "nomVendeur": "VALENTIN PARPINELLI",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "09:00-10:00",
  "client": "TERON"
 },
 {
  "site": "CLF",
  "nomVendeur": "VALENTIN PARPINELLI",
  "marque": "RENAULT",
  "jour": "2026-06-14",
  "creneau": "09:00-10:00",
  "client": "PERNET"
 },
 {
  "site": "CLF",
  "nomVendeur": "VALENTIN PARPINELLI",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "10:00-11:00",
  "client": "CREMIEUX"
 },
 {
  "site": "CLF",
  "nomVendeur": "VALENTIN PARPINELLI",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "10:00-11:00",
  "client": "MARI"
 },
 {
  "site": "CLF",
  "nomVendeur": "VALENTIN PARPINELLI",
  "marque": "RENAULT",
  "jour": "2026-06-14",
  "creneau": "10:00-11:00",
  "client": "FORMENTI"
 },
 {
  "site": "CLF",
  "nomVendeur": "VALENTIN PARPINELLI",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "11:00-12:00",
  "client": "PICOT"
 },
 {
  "site": "CLF",
  "nomVendeur": "VALENTIN PARPINELLI",
  "marque": "RENAULT",
  "jour": "2026-06-14",
  "creneau": "11:00-12:00",
  "client": "CHAMBRE"
 },
 {
  "site": "CLF",
  "nomVendeur": "VALENTIN PARPINELLI",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "12:00-13:00",
  "client": "CHOMEILLE*"
 },
 {
  "site": "CLF",
  "nomVendeur": "VALENTIN PARPINELLI",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "14:00-15:00",
  "client": "ZAMORA"
 },
 {
  "site": "CLF",
  "nomVendeur": "VALENTIN PARPINELLI",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "14:00-15:00",
  "client": "VIALTAIX"
 },
 {
  "site": "CLF",
  "nomVendeur": "VALENTIN PARPINELLI",
  "marque": "RENAULT",
  "jour": "2026-06-14",
  "creneau": "14:00-15:00",
  "client": "ALVES"
 },
 {
  "site": "CLF",
  "nomVendeur": "VALENTIN PARPINELLI",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "16:00-17:00",
  "client": "MARTIN"
 },
 {
  "site": "CLF",
  "nomVendeur": "VALENTIN PARPINELLI",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "16:00-17:00",
  "client": "BRETTE"
 },
 {
  "site": "CLF",
  "nomVendeur": "VALENTIN PARPINELLI",
  "marque": "RENAULT",
  "jour": "2026-06-14",
  "creneau": "16:00-17:00",
  "client": "RAGOT 208"
 },
 {
  "site": "CLF",
  "nomVendeur": "THIERRY DUBERNAT",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "09:00-10:00",
  "client": "JELADE"
 },
 {
  "site": "CLF",
  "nomVendeur": "THIERRY DUBERNAT",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "09:00-10:00",
  "client": "DEBLOIS"
 },
 {
  "site": "CLF",
  "nomVendeur": "THIERRY DUBERNAT",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "10:00-11:00",
  "client": "CHILE"
 },
 {
  "site": "CLF",
  "nomVendeur": "THIERRY DUBERNAT",
  "marque": "RENAULT",
  "jour": "2026-06-15",
  "creneau": "10:00-11:00",
  "client": "THEVENET"
 },
 {
  "site": "CLF",
  "nomVendeur": "THIERRY DUBERNAT",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "11:00-12:00",
  "client": "TARTRY"
 },
 {
  "site": "CLF",
  "nomVendeur": "THIERRY DUBERNAT",
  "marque": "RENAULT",
  "jour": "2026-06-15",
  "creneau": "11:00-12:00",
  "client": "MESTRE"
 },
 {
  "site": "CLF",
  "nomVendeur": "THIERRY DUBERNAT",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "12:00-13:00",
  "client": "VASSET"
 },
 {
  "site": "CLF",
  "nomVendeur": "THIERRY DUBERNAT",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "12:00-13:00",
  "client": "DE LA COTARDIERE"
 },
 {
  "site": "CLF",
  "nomVendeur": "THIERRY DUBERNAT",
  "marque": "RENAULT",
  "jour": "2026-06-15",
  "creneau": "13:00-14:00",
  "client": "ABEL"
 },
 {
  "site": "CLF",
  "nomVendeur": "THIERRY DUBERNAT",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "14:00-15:00",
  "client": "GUITTARD"
 },
 {
  "site": "CLF",
  "nomVendeur": "THIERRY DUBERNAT",
  "marque": "RENAULT",
  "jour": "2026-06-15",
  "creneau": "14:00-15:00",
  "client": "BONNET"
 },
 {
  "site": "CLF",
  "nomVendeur": "THIERRY DUBERNAT",
  "marque": "RENAULT",
  "jour": "2026-06-15",
  "creneau": "16:00-17:00",
  "client": "DELODDE"
 },
 {
  "site": "CLF",
  "nomVendeur": "THIERRY DUBERNAT",
  "marque": "DACIA",
  "jour": "2026-06-11",
  "creneau": "14:00-15:00",
  "client": "CABANAC"
 },
 {
  "site": "CLF",
  "nomVendeur": "THIERRY DUBERNAT",
  "marque": "DACIA",
  "jour": "2026-06-12",
  "creneau": "15:00-16:00",
  "client": "MONNERON"
 },
 {
  "site": "CLF",
  "nomVendeur": "THIERRY DUBERNAT",
  "marque": "DACIA",
  "jour": "2026-06-11",
  "creneau": "16:00-17:00",
  "client": "GOUTAIN"
 },
 {
  "site": "CLF",
  "nomVendeur": "THIERRY DUBERNAT",
  "marque": "DACIA",
  "jour": "2026-06-12",
  "creneau": "16:00-17:00",
  "client": "POSSON"
 },
 {
  "site": "CLF",
  "nomVendeur": "THIERRY DUBERNAT",
  "marque": "DACIA",
  "jour": "2026-06-11",
  "creneau": "18:00-19:00",
  "client": "GOUTEFANGEAT"
 },
 {
  "site": "CLF",
  "nomVendeur": "OCEANE ESPINASSE",
  "marque": "DACIA",
  "jour": "2026-06-11",
  "creneau": "08:00-09:00",
  "client": "RICCARDELLI (SANDERO)"
 },
 {
  "site": "CLF",
  "nomVendeur": "OCEANE ESPINASSE",
  "marque": "DACIA",
  "jour": "2026-06-12",
  "creneau": "09:00-10:00",
  "client": "DELORME (BIGSTER)"
 },
 {
  "site": "CLF",
  "nomVendeur": "OCEANE ESPINASSE",
  "marque": "DACIA",
  "jour": "2026-06-13",
  "creneau": "09:00-10:00",
  "client": "SCHAMPERS (JOGGER)"
 },
 {
  "site": "CLF",
  "nomVendeur": "OCEANE ESPINASSE",
  "marque": "DACIA",
  "jour": "2026-06-14",
  "creneau": "09:00-10:00",
  "client": "DUREL (DUSTER)"
 },
 {
  "site": "CLF",
  "nomVendeur": "OCEANE ESPINASSE",
  "marque": "DACIA",
  "jour": "2026-06-11",
  "creneau": "10:00-11:00",
  "client": "BERNIGAUD (SANDERO)"
 },
 {
  "site": "CLF",
  "nomVendeur": "OCEANE ESPINASSE",
  "marque": "DACIA",
  "jour": "2026-06-12",
  "creneau": "10:00-11:00",
  "client": "DAMIANI (SANDERO)"
 },
 {
  "site": "CLF",
  "nomVendeur": "OCEANE ESPINASSE",
  "marque": "DACIA",
  "jour": "2026-06-13",
  "creneau": "10:00-11:00",
  "client": "TROUCAS (SANDERO)"
 },
 {
  "site": "CLF",
  "nomVendeur": "OCEANE ESPINASSE",
  "marque": "DACIA",
  "jour": "2026-06-14",
  "creneau": "10:00-11:00",
  "client": "PAILHE (SANDERO STEPWAY)"
 },
 {
  "site": "CLF",
  "nomVendeur": "OCEANE ESPINASSE",
  "marque": "DACIA",
  "jour": "2026-06-15",
  "creneau": "10:00-11:00",
  "client": "VAGNE (SANDERO)"
 },
 {
  "site": "CLF",
  "nomVendeur": "OCEANE ESPINASSE",
  "marque": "DACIA",
  "jour": "2026-06-11",
  "creneau": "11:00-12:00",
  "client": "CHAVAROCHE  (DUSTER)"
 },
 {
  "site": "CLF",
  "nomVendeur": "OCEANE ESPINASSE",
  "marque": "DACIA",
  "jour": "2026-06-12",
  "creneau": "11:00-12:00",
  "client": "AMBLARD (BIGSTER)"
 },
 {
  "site": "CLF",
  "nomVendeur": "OCEANE ESPINASSE",
  "marque": "DACIA",
  "jour": "2026-06-11",
  "creneau": "14:00-15:00",
  "client": "LEMONIER (STEPWAY)"
 },
 {
  "site": "CLF",
  "nomVendeur": "OCEANE ESPINASSE",
  "marque": "DACIA",
  "jour": "2026-06-12",
  "creneau": "14:00-15:00",
  "client": "LEMOINE (SANDERO)"
 },
 {
  "site": "CLF",
  "nomVendeur": "OCEANE ESPINASSE",
  "marque": "DACIA",
  "jour": "2026-06-14",
  "creneau": "14:00-15:00",
  "client": "FRANCES (DUSTER)"
 },
 {
  "site": "CLF",
  "nomVendeur": "OCEANE ESPINASSE",
  "marque": "DACIA",
  "jour": "2026-06-15",
  "creneau": "15:00-16:00",
  "client": "BEAL (SANDERO)"
 },
 {
  "site": "CLF",
  "nomVendeur": "OCEANE ESPINASSE",
  "marque": "DACIA",
  "jour": "2026-06-14",
  "creneau": "16:00-17:00",
  "client": "DUMAS (JOGGER)"
 },
 {
  "site": "CLF",
  "nomVendeur": "OCEANE ESPINASSE",
  "marque": "DACIA",
  "jour": "2026-06-11",
  "creneau": "17:00-18:00",
  "client": "QUERART (SANDERO)"
 },
 {
  "site": "CLF",
  "nomVendeur": "OCEANE ESPINASSE",
  "marque": "DACIA",
  "jour": "2026-06-12",
  "creneau": "17:00-18:00",
  "client": "MAILLET (BIGSTER)"
 },
 {
  "site": "CLF",
  "nomVendeur": "OCEANE ESPINASSE",
  "marque": "DACIA",
  "jour": "2026-06-13",
  "creneau": "17:00-18:00",
  "client": "NUGER (JOGGER)"
 },
 {
  "site": "CLF",
  "nomVendeur": "OCEANE ESPINASSE",
  "marque": "DACIA",
  "jour": "2026-06-11",
  "creneau": "18:00-19:00",
  "client": "JACQUIER (sandero)"
 },
 {
  "site": "CLF",
  "nomVendeur": "BLANDINE CLÉMENT",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "09:00-10:00",
  "client": "ARTAUD"
 },
 {
  "site": "CLF",
  "nomVendeur": "BLANDINE CLÉMENT",
  "marque": "RENAULT",
  "jour": "2026-06-14",
  "creneau": "09:00-10:00",
  "client": "BERKOUN"
 },
 {
  "site": "CLF",
  "nomVendeur": "BLANDINE CLÉMENT",
  "marque": "DACIA",
  "jour": "2026-06-12",
  "creneau": "09:00-10:00",
  "client": "NORE"
 },
 {
  "site": "CLF",
  "nomVendeur": "BLANDINE CLÉMENT",
  "marque": "DACIA",
  "jour": "2026-06-13",
  "creneau": "09:00-10:00",
  "client": "ALBERT"
 },
 {
  "site": "CLF",
  "nomVendeur": "BLANDINE CLÉMENT",
  "marque": "DACIA",
  "jour": "2026-06-11",
  "creneau": "10:00-11:00",
  "client": "COUESNON"
 },
 {
  "site": "CLF",
  "nomVendeur": "BLANDINE CLÉMENT",
  "marque": "DACIA",
  "jour": "2026-06-13",
  "creneau": "10:00-11:00",
  "client": "OUDARD"
 },
 {
  "site": "CLF",
  "nomVendeur": "BLANDINE CLÉMENT",
  "marque": "DACIA",
  "jour": "2026-06-14",
  "creneau": "10:00-11:00",
  "client": "VERNIERE"
 },
 {
  "site": "CLF",
  "nomVendeur": "BLANDINE CLÉMENT",
  "marque": "DACIA",
  "jour": "2026-06-11",
  "creneau": "11:00-12:00",
  "client": "CLAVELOU"
 },
 {
  "site": "CLF",
  "nomVendeur": "BLANDINE CLÉMENT",
  "marque": "DACIA",
  "jour": "2026-06-12",
  "creneau": "11:00-12:00",
  "client": "DEGRANGE"
 },
 {
  "site": "CLF",
  "nomVendeur": "BLANDINE CLÉMENT",
  "marque": "DACIA",
  "jour": "2026-06-11",
  "creneau": "13:00-14:00",
  "client": "SAINTE ARROMAN"
 },
 {
  "site": "CLF",
  "nomVendeur": "BLANDINE CLÉMENT",
  "marque": "DACIA",
  "jour": "2026-06-14",
  "creneau": "14:00-15:00",
  "client": "DREUX"
 },
 {
  "site": "CLF",
  "nomVendeur": "BLANDINE CLÉMENT",
  "marque": "DACIA",
  "jour": "2026-06-14",
  "creneau": "15:00-16:00",
  "client": "GORALSKI"
 },
 {
  "site": "CLF",
  "nomVendeur": "BLANDINE CLÉMENT",
  "marque": "DACIA",
  "jour": "2026-06-15",
  "creneau": "15:00-16:00",
  "client": "GUIENNE"
 },
 {
  "site": "CLF",
  "nomVendeur": "THOMAS SOULIER",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "16:00-17:00",
  "client": "LECHARPENTIER (Twingo ou Spring)"
 },
 {
  "site": "CLF",
  "nomVendeur": "THOMAS SOULIER",
  "marque": "DACIA",
  "jour": "2026-06-11",
  "creneau": "08:00-09:00",
  "client": "GUERINO (Sandero)"
 },
 {
  "site": "CLF",
  "nomVendeur": "THOMAS SOULIER",
  "marque": "DACIA",
  "jour": "2026-06-12",
  "creneau": "09:00-10:00",
  "client": "MUCIENTES (Sandero)"
 },
 {
  "site": "CLF",
  "nomVendeur": "THOMAS SOULIER",
  "marque": "DACIA",
  "jour": "2026-06-14",
  "creneau": "09:00-10:00",
  "client": "CHANTELAUZE (SANDERO)"
 },
 {
  "site": "CLF",
  "nomVendeur": "THOMAS SOULIER",
  "marque": "DACIA",
  "jour": "2026-06-13",
  "creneau": "10:00-11:00",
  "client": "RADINI (Duster 4x4 diesel reprise)"
 },
 {
  "site": "CLF",
  "nomVendeur": "THOMAS SOULIER",
  "marque": "DACIA",
  "jour": "2026-06-13",
  "creneau": "13:00-14:00",
  "client": "GENINO (Sandero)"
 },
 {
  "site": "CLF",
  "nomVendeur": "THOMAS SOULIER",
  "marque": "DACIA",
  "jour": "2026-06-11",
  "creneau": "14:00-15:00",
  "client": "LEMAIRE (DUster)"
 },
 {
  "site": "CLF",
  "nomVendeur": "THOMAS SOULIER",
  "marque": "DACIA",
  "jour": "2026-06-14",
  "creneau": "14:00-15:00",
  "client": "FAURIOL (Bigster)"
 },
 {
  "site": "CLF",
  "nomVendeur": "THOMAS SOULIER",
  "marque": "DACIA",
  "jour": "2026-06-13",
  "creneau": "15:00-16:00",
  "client": "GULF (jogger 7 places)"
 },
 {
  "site": "CLF",
  "nomVendeur": "THOMAS SOULIER",
  "marque": "DACIA",
  "jour": "2026-06-14",
  "creneau": "16:00-17:00",
  "client": "ESCURE (Duster, reprise DUstuer diesel 4x4)"
 },
 {
  "site": "CLF",
  "nomVendeur": "THOMAS SOULIER",
  "marque": "DACIA",
  "jour": "2026-06-11",
  "creneau": "17:00-18:00",
  "client": "ASTARI (Sandero)"
 },
 {
  "site": "CLF",
  "nomVendeur": "THOMAS SOULIER",
  "marque": "DACIA",
  "jour": "2026-06-12",
  "creneau": "18:00-19:00",
  "client": "COL (SANDERO)"
 },
 {
  "site": "CLF",
  "nomVendeur": "CHRISTOPHE BROSSEAU",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "09:00-10:00",
  "client": "SARDIER"
 },
 {
  "site": "CLF",
  "nomVendeur": "CHRISTOPHE BROSSEAU",
  "marque": "RENAULT",
  "jour": "2026-06-14",
  "creneau": "09:00-10:00",
  "client": "JUNG"
 },
 {
  "site": "CLF",
  "nomVendeur": "CHRISTOPHE BROSSEAU",
  "marque": "RENAULT",
  "jour": "2026-06-15",
  "creneau": "09:00-10:00",
  "client": "TISON"
 },
 {
  "site": "CLF",
  "nomVendeur": "CHRISTOPHE BROSSEAU",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "10:00-11:00",
  "client": "JAMOT"
 },
 {
  "site": "CLF",
  "nomVendeur": "CHRISTOPHE BROSSEAU",
  "marque": "RENAULT",
  "jour": "2026-06-15",
  "creneau": "10:00-11:00",
  "client": "GODARD"
 },
 {
  "site": "CLF",
  "nomVendeur": "CHRISTOPHE BROSSEAU",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "14:00-15:00",
  "client": "FAYARD"
 },
 {
  "site": "CLF",
  "nomVendeur": "CHRISTOPHE BROSSEAU",
  "marque": "RENAULT",
  "jour": "2026-06-15",
  "creneau": "14:00-15:00",
  "client": "MARCHAND"
 },
 {
  "site": "CLF",
  "nomVendeur": "CHRISTOPHE BROSSEAU",
  "marque": "DACIA",
  "jour": "2026-06-11",
  "creneau": "09:00-10:00",
  "client": "NEGRONIE"
 },
 {
  "site": "CLF",
  "nomVendeur": "CHRISTOPHE BROSSEAU",
  "marque": "DACIA",
  "jour": "2026-06-12",
  "creneau": "09:00-10:00",
  "client": "NAULT"
 },
 {
  "site": "CLF",
  "nomVendeur": "CHRISTOPHE BROSSEAU",
  "marque": "DACIA",
  "jour": "2026-06-11",
  "creneau": "11:00-12:00",
  "client": "MIAUX"
 },
 {
  "site": "CLF",
  "nomVendeur": "CHRISTOPHE BROSSEAU",
  "marque": "DACIA",
  "jour": "2026-06-12",
  "creneau": "11:00-12:00",
  "client": "FAURE"
 },
 {
  "site": "CLF",
  "nomVendeur": "CHRISTOPHE BROSSEAU",
  "marque": "DACIA",
  "jour": "2026-06-12",
  "creneau": "14:00-15:00",
  "client": "DARTOIS"
 },
 {
  "site": "CLF",
  "nomVendeur": "CHRISTOPHE BROSSEAU",
  "marque": "DACIA",
  "jour": "2026-06-13",
  "creneau": "14:00-15:00",
  "client": "DUBOIS"
 },
 {
  "site": "CLF",
  "nomVendeur": "CHRISTOPHE BROSSEAU",
  "marque": "DACIA",
  "jour": "2026-06-12",
  "creneau": "16:00-17:00",
  "client": "MONTOLOY"
 },
 {
  "site": "CLF",
  "nomVendeur": "CHRISTOPHE BROSSEAU",
  "marque": "DACIA",
  "jour": "2026-06-12",
  "creneau": "17:00-18:00",
  "client": "EYDIEUX"
 },
 {
  "site": "CLF",
  "nomVendeur": "THÉO ROUSSET",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "09:00-10:00",
  "client": "JALAN"
 },
 {
  "site": "CLF",
  "nomVendeur": "THÉO ROUSSET",
  "marque": "RENAULT",
  "jour": "2026-06-15",
  "creneau": "09:00-10:00",
  "client": "RAMBEAU"
 },
 {
  "site": "CLF",
  "nomVendeur": "THÉO ROUSSET",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "10:00-11:00",
  "client": "STRADY"
 },
 {
  "site": "CLF",
  "nomVendeur": "THÉO ROUSSET",
  "marque": "RENAULT",
  "jour": "2026-06-14",
  "creneau": "10:00-11:00",
  "client": "RAMBAUD"
 },
 {
  "site": "CLF",
  "nomVendeur": "THÉO ROUSSET",
  "marque": "RENAULT",
  "jour": "2026-06-15",
  "creneau": "10:00-11:00",
  "client": "BAYDE"
 },
 {
  "site": "CLF",
  "nomVendeur": "THÉO ROUSSET",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "11:00-12:00",
  "client": "MEUNIER"
 },
 {
  "site": "CLF",
  "nomVendeur": "THÉO ROUSSET",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "11:00-12:00",
  "client": "VOLDOIRE"
 },
 {
  "site": "CLF",
  "nomVendeur": "THÉO ROUSSET",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "12:00-13:00",
  "client": "LAGACHE"
 },
 {
  "site": "CLF",
  "nomVendeur": "THÉO ROUSSET",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "12:00-13:00",
  "client": "MONTOUTON"
 },
 {
  "site": "CLF",
  "nomVendeur": "THÉO ROUSSET",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "14:00-15:00",
  "client": "ROUX"
 },
 {
  "site": "CLF",
  "nomVendeur": "THÉO ROUSSET",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "14:00-15:00",
  "client": "COUDERT"
 },
 {
  "site": "CLF",
  "nomVendeur": "THÉO ROUSSET",
  "marque": "RENAULT",
  "jour": "2026-06-14",
  "creneau": "14:00-15:00",
  "client": "JOURNIAC"
 },
 {
  "site": "CLF",
  "nomVendeur": "THÉO ROUSSET",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "16:00-17:00",
  "client": "CHEVALIER"
 },
 {
  "site": "CLF",
  "nomVendeur": "THÉO ROUSSET",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "17:00-18:00",
  "client": "ZAKARIA"
 },
 {
  "site": "CLF",
  "nomVendeur": "THÉO ROUSSET",
  "marque": "RENAULT",
  "jour": "2026-06-15",
  "creneau": "17:00-18:00",
  "client": "BARRA"
 },
 {
  "site": "CLF",
  "nomVendeur": "QUENTIN BELLAIGUES",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "09:00-10:00",
  "client": "SIGURET"
 },
 {
  "site": "CLF",
  "nomVendeur": "QUENTIN BELLAIGUES",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "09:00-10:00",
  "client": "CEYRAS"
 },
 {
  "site": "CLF",
  "nomVendeur": "QUENTIN BELLAIGUES",
  "marque": "RENAULT",
  "jour": "2026-06-14",
  "creneau": "09:00-10:00",
  "client": "HABRIAL"
 },
 {
  "site": "CLF",
  "nomVendeur": "QUENTIN BELLAIGUES",
  "marque": "RENAULT",
  "jour": "2026-06-15",
  "creneau": "09:00-10:00",
  "client": "LECOIN"
 },
 {
  "site": "CLF",
  "nomVendeur": "QUENTIN BELLAIGUES",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "10:00-11:00",
  "client": "GAUDICHON"
 },
 {
  "site": "CLF",
  "nomVendeur": "QUENTIN BELLAIGUES",
  "marque": "RENAULT",
  "jour": "2026-06-14",
  "creneau": "10:00-11:00",
  "client": "SAUSSAC"
 },
 {
  "site": "CLF",
  "nomVendeur": "QUENTIN BELLAIGUES",
  "marque": "RENAULT",
  "jour": "2026-06-15",
  "creneau": "11:00-12:00",
  "client": "DEKEYSER"
 },
 {
  "site": "CLF",
  "nomVendeur": "QUENTIN BELLAIGUES",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "13:00-14:00",
  "client": "KANIT"
 },
 {
  "site": "CLF",
  "nomVendeur": "QUENTIN BELLAIGUES",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "13:00-14:00",
  "client": "CORDIESE"
 },
 {
  "site": "CLF",
  "nomVendeur": "QUENTIN BELLAIGUES",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "14:00-15:00",
  "client": "MAILHOT"
 },
 {
  "site": "CLF",
  "nomVendeur": "QUENTIN BELLAIGUES",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "14:00-15:00",
  "client": "BONNIN"
 },
 {
  "site": "CLF",
  "nomVendeur": "QUENTIN BELLAIGUES",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "14:00-15:00",
  "client": "BERTIN"
 },
 {
  "site": "CLF",
  "nomVendeur": "QUENTIN BELLAIGUES",
  "marque": "RENAULT",
  "jour": "2026-06-14",
  "creneau": "14:00-15:00",
  "client": "VAYSSADE"
 },
 {
  "site": "CLF",
  "nomVendeur": "QUENTIN BELLAIGUES",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "15:00-16:00",
  "client": "MONTBOISSE"
 },
 {
  "site": "CLF",
  "nomVendeur": "QUENTIN BELLAIGUES",
  "marque": "RENAULT",
  "jour": "2026-06-15",
  "creneau": "15:00-16:00",
  "client": "CURADO"
 },
 {
  "site": "CLF",
  "nomVendeur": "QUENTIN BELLAIGUES",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "16:00-17:00",
  "client": "FOZEN"
 },
 {
  "site": "CLF",
  "nomVendeur": "QUENTIN BELLAIGUES",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "17:00-18:00",
  "client": "CHALLET"
 },
 {
  "site": "CLF",
  "nomVendeur": "QUENTIN BELLAIGUES",
  "marque": "RENAULT",
  "jour": "2026-06-15",
  "creneau": "17:00-18:00",
  "client": "FLORES"
 },
 {
  "site": "CLF",
  "nomVendeur": "JEAN-PIERRE FERRIER",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "09:00-10:00",
  "client": "LAON (R4)"
 },
 {
  "site": "CLF",
  "nomVendeur": "JEAN-PIERRE FERRIER",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "09:00-10:00",
  "client": "MR BAYARD"
 },
 {
  "site": "CLF",
  "nomVendeur": "JEAN-PIERRE FERRIER",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "10:00-11:00",
  "client": "ABRANTES (TWINGO ETECH)"
 },
 {
  "site": "CLF",
  "nomVendeur": "JEAN-PIERRE FERRIER",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "10:00-11:00",
  "client": "HOUZEAU (AUSTRAl)"
 },
 {
  "site": "CLF",
  "nomVendeur": "JEAN-PIERRE FERRIER",
  "marque": "RENAULT",
  "jour": "2026-06-15",
  "creneau": "10:00-11:00",
  "client": "GLAIZE (R4 E TECH)"
 },
 {
  "site": "CLF",
  "nomVendeur": "JEAN-PIERRE FERRIER",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "14:00-15:00",
  "client": "MARTINEZ (CLIO 6)"
 },
 {
  "site": "CLF",
  "nomVendeur": "JEAN-PIERRE FERRIER",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "14:00-15:00",
  "client": "MARQUES (CAPTUR)"
 },
 {
  "site": "CLF",
  "nomVendeur": "JEAN-PIERRE FERRIER",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "14:00-15:00",
  "client": "GAILLER (CLIO)"
 },
 {
  "site": "CLF",
  "nomVendeur": "JEAN-PIERRE FERRIER",
  "marque": "RENAULT",
  "jour": "2026-06-14",
  "creneau": "14:00-15:00",
  "client": "CHANUDET (R5)"
 },
 {
  "site": "CLF",
  "nomVendeur": "JEAN-PIERRE FERRIER",
  "marque": "RENAULT",
  "jour": "2026-06-15",
  "creneau": "14:00-15:00",
  "client": "MEAUGER (TWINGO ETECH)"
 },
 {
  "site": "CLF",
  "nomVendeur": "JEAN-PIERRE FERRIER",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "15:00-16:00",
  "client": "ROUGIER (CLIO 6 ECO G)"
 },
 {
  "site": "CLF",
  "nomVendeur": "JEAN-PIERRE FERRIER",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "15:00-16:00",
  "client": "CHAPER (SANDERO)"
 },
 {
  "site": "CLF",
  "nomVendeur": "JEAN-PIERRE FERRIER",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "16:00-17:00",
  "client": "DUMONT (R5 ETECH)"
 },
 {
  "site": "CLF",
  "nomVendeur": "JEAN-PIERRE FERRIER",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "17:00-18:00",
  "client": "DAGUNA (TWINGO etech)"
 },
 {
  "site": "CLF",
  "nomVendeur": "JEAN-PIERRE FERRIER",
  "marque": "RENAULT",
  "jour": "2026-06-15",
  "creneau": "18:00-19:00",
  "client": "DAULAT"
 },
 {
  "site": "CLF",
  "nomVendeur": "JULIEN BIASUTTI",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "08:00-09:00",
  "client": "MIGLIAVACCA (Clio)"
 },
 {
  "site": "CLF",
  "nomVendeur": "JULIEN BIASUTTI",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "08:00-09:00",
  "client": "BELOT (R5)"
 },
 {
  "site": "CLF",
  "nomVendeur": "JULIEN BIASUTTI",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "09:00-10:00",
  "client": "TARDIVAT (Captur)"
 },
 {
  "site": "CLF",
  "nomVendeur": "JULIEN BIASUTTI",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "09:00-10:00",
  "client": "PENOT (Twingo electrique)"
 },
 {
  "site": "CLF",
  "nomVendeur": "JULIEN BIASUTTI",
  "marque": "RENAULT",
  "jour": "2026-06-14",
  "creneau": "09:00-10:00",
  "client": "MISSONIER (R5)"
 },
 {
  "site": "CLF",
  "nomVendeur": "JULIEN BIASUTTI",
  "marque": "RENAULT",
  "jour": "2026-06-15",
  "creneau": "09:00-10:00",
  "client": "RODIER (Clio)"
 },
 {
  "site": "CLF",
  "nomVendeur": "JULIEN BIASUTTI",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "10:00-11:00",
  "client": "GROSSE (Twingo)"
 },
 {
  "site": "CLF",
  "nomVendeur": "JULIEN BIASUTTI",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "10:00-11:00",
  "client": "LOUIS Isabelle (R5)"
 },
 {
  "site": "CLF",
  "nomVendeur": "JULIEN BIASUTTI",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "10:00-11:00",
  "client": "SAHUC (reprise Twingo)"
 },
 {
  "site": "CLF",
  "nomVendeur": "JULIEN BIASUTTI",
  "marque": "RENAULT",
  "jour": "2026-06-14",
  "creneau": "10:00-11:00",
  "client": "HEALY (fin solde)"
 },
 {
  "site": "CLF",
  "nomVendeur": "JULIEN BIASUTTI",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "11:00-12:00",
  "client": "PIRONNET (Captur)"
 },
 {
  "site": "CLF",
  "nomVendeur": "JULIEN BIASUTTI",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "14:00-15:00",
  "client": "SALGADO (Twingo)"
 },
 {
  "site": "CLF",
  "nomVendeur": "JULIEN BIASUTTI",
  "marque": "RENAULT",
  "jour": "2026-06-14",
  "creneau": "14:00-15:00",
  "client": "DALLOUBEIX (reprise Captur)"
 },
 {
  "site": "CLF",
  "nomVendeur": "JULIEN BIASUTTI",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "15:00-16:00",
  "client": "SEVAILLE (R5 Megane elec)"
 },
 {
  "site": "CLF",
  "nomVendeur": "JULIEN BIASUTTI",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "16:00-17:00",
  "client": "DEBONNO (Captur)"
 },
 {
  "site": "CLF",
  "nomVendeur": "JULIEN BIASUTTI",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "16:00-17:00",
  "client": "DEPRESLE (SANDERO)"
 },
 {
  "site": "CLF",
  "nomVendeur": "JULIEN BIASUTTI",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "16:00-17:00",
  "client": "LAPORTE (reprise Captur)"
 },
 {
  "site": "CLF",
  "nomVendeur": "JULIEN BIASUTTI",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "17:00-18:00",
  "client": "CLAVEL (Clio)"
 },
 {
  "site": "CLF",
  "nomVendeur": "JULIEN BIASUTTI",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "17:00-18:00",
  "client": "GUILLON COTARD (Captur)"
 },
 {
  "site": "CLF",
  "nomVendeur": "JULIEN BIASUTTI",
  "marque": "RENAULT",
  "jour": "2026-06-15",
  "creneau": "17:00-18:00",
  "client": "PETIT (CLio)"
 },
 {
  "site": "CLF",
  "nomVendeur": "PIERRE-EDOUARD LAROCHE",
  "marque": "DACIA",
  "jour": "2026-06-12",
  "creneau": "11:00-12:00",
  "client": "ROUX"
 },
 {
  "site": "CLF",
  "nomVendeur": "PIERRE-EDOUARD LAROCHE",
  "marque": "DACIA",
  "jour": "2026-06-13",
  "creneau": "11:00-12:00",
  "client": "NICODEME"
 },
 {
  "site": "CLF",
  "nomVendeur": "PIERRE-EDOUARD LAROCHE",
  "marque": "DACIA",
  "jour": "2026-06-15",
  "creneau": "11:00-12:00",
  "client": "BARDOTTI"
 },
 {
  "site": "CLF",
  "nomVendeur": "PIERRE-EDOUARD LAROCHE",
  "marque": "DACIA",
  "jour": "2026-06-12",
  "creneau": "14:00-15:00",
  "client": "MOULY"
 },
 {
  "site": "CLF",
  "nomVendeur": "PIERRE-EDOUARD LAROCHE",
  "marque": "DACIA",
  "jour": "2026-06-15",
  "creneau": "14:00-15:00",
  "client": "PLANE"
 },
 {
  "site": "CLF",
  "nomVendeur": "PIERRE-EDOUARD LAROCHE",
  "marque": "DACIA",
  "jour": "2026-06-13",
  "creneau": "16:00-17:00",
  "client": "SERRE"
 },
 {
  "site": "CLF",
  "nomVendeur": "PIERRE-EDOUARD LAROCHE",
  "marque": "DACIA",
  "jour": "2026-06-14",
  "creneau": "16:00-17:00",
  "client": "GOGEOUR"
 },
 {
  "site": "CLF",
  "nomVendeur": "PIERRE-EDOUARD LAROCHE",
  "marque": "DACIA",
  "jour": "2026-06-15",
  "creneau": "16:00-17:00",
  "client": "BRUSTEL"
 },
 {
  "site": "CLF",
  "nomVendeur": "PIERRE-EDOUARD LAROCHE",
  "marque": "DACIA",
  "jour": "2026-06-12",
  "creneau": "17:00-18:00",
  "client": "JARNIAL"
 },
 {
  "site": "CLF",
  "nomVendeur": "PIERRE-EDOUARD LAROCHE",
  "marque": "DACIA",
  "jour": "2026-06-15",
  "creneau": "18:00-19:00",
  "client": "PEDRINI"
 },
 {
  "site": "CLF",
  "nomVendeur": "ANTOINE BASTIEN",
  "marque": "VO",
  "jour": "2026-06-15",
  "creneau": "09:00-10:00",
  "client": "ESPOSITO"
 },
 {
  "site": "CLF",
  "nomVendeur": "ANTOINE BASTIEN",
  "marque": "VO",
  "jour": "2026-06-13",
  "creneau": "10:00-11:00",
  "client": "PERETON"
 },
 {
  "site": "CLF",
  "nomVendeur": "ANTOINE BASTIEN",
  "marque": "VO",
  "jour": "2026-06-15",
  "creneau": "10:00-11:00",
  "client": "FERREIRA"
 },
 {
  "site": "CLF",
  "nomVendeur": "ANTOINE BASTIEN",
  "marque": "VO",
  "jour": "2026-06-15",
  "creneau": "11:00-12:00",
  "client": "COURAGEOT"
 },
 {
  "site": "CLF",
  "nomVendeur": "ANTOINE BASTIEN",
  "marque": "VO",
  "jour": "2026-06-13",
  "creneau": "14:00-15:00",
  "client": "JAFFEUX"
 },
 {
  "site": "CLF",
  "nomVendeur": "ANTOINE BASTIEN",
  "marque": "VO",
  "jour": "2026-06-14",
  "creneau": "14:00-15:00",
  "client": "SOUCHER"
 },
 {
  "site": "CLF",
  "nomVendeur": "ANTOINE BASTIEN",
  "marque": "VO",
  "jour": "2026-06-14",
  "creneau": "16:00-17:00",
  "client": "LARVOL"
 },
 {
  "site": "CLF",
  "nomVendeur": "ANTOINE BASTIEN",
  "marque": "VO",
  "jour": "2026-06-12",
  "creneau": "17:00-18:00",
  "client": "VANDEVILLE"
 },
 {
  "site": "CLF",
  "nomVendeur": "ANTOINE BASTIEN",
  "marque": "VO",
  "jour": "2026-06-14",
  "creneau": "17:00-18:00",
  "client": "PLANCHER"
 },
 {
  "site": "CLF",
  "nomVendeur": "ANTOINE BASTIEN",
  "marque": "VO",
  "jour": "2026-06-15",
  "creneau": "18:00-19:00",
  "client": "PETIT"
 },
 {
  "site": "CLF",
  "nomVendeur": "DYLAN GUERRET",
  "marque": "VO",
  "jour": "2026-06-11",
  "creneau": "10:00-11:00",
  "client": "SEBASTIEN"
 },
 {
  "site": "CLF",
  "nomVendeur": "DYLAN GUERRET",
  "marque": "VO",
  "jour": "2026-06-13",
  "creneau": "10:00-11:00",
  "client": "BONIN"
 },
 {
  "site": "CLF",
  "nomVendeur": "DYLAN GUERRET",
  "marque": "VO",
  "jour": "2026-06-13",
  "creneau": "11:00-12:00",
  "client": "TERKIHADJ"
 },
 {
  "site": "CLF",
  "nomVendeur": "DYLAN GUERRET",
  "marque": "VO",
  "jour": "2026-06-14",
  "creneau": "14:00-15:00",
  "client": "FRANCK"
 },
 {
  "site": "CLF",
  "nomVendeur": "DYLAN GUERRET",
  "marque": "VO",
  "jour": "2026-06-11",
  "creneau": "15:00-16:00",
  "client": "MARTIN"
 },
 {
  "site": "CLF",
  "nomVendeur": "DYLAN GUERRET",
  "marque": "VO",
  "jour": "2026-06-13",
  "creneau": "15:00-16:00",
  "client": "MARET"
 },
 {
  "site": "CLF",
  "nomVendeur": "DYLAN GUERRET",
  "marque": "VO",
  "jour": "2026-06-14",
  "creneau": "16:00-17:00",
  "client": "FAURE"
 },
 {
  "site": "CLF",
  "nomVendeur": "DYLAN GUERRET",
  "marque": "VO",
  "jour": "2026-06-15",
  "creneau": "16:00-17:00",
  "client": "BOULANGER"
 },
 {
  "site": "CLF",
  "nomVendeur": "DYLAN GUERRET",
  "marque": "VO",
  "jour": "2026-06-11",
  "creneau": "17:00-18:00",
  "client": "PERREIRA"
 },
 {
  "site": "CLF",
  "nomVendeur": "JOAO TEIXEIRA",
  "marque": "VO",
  "jour": "2026-06-11",
  "creneau": "09:00-10:00",
  "client": "SOYDARI"
 },
 {
  "site": "CLF",
  "nomVendeur": "JOAO TEIXEIRA",
  "marque": "VO",
  "jour": "2026-06-14",
  "creneau": "09:00-10:00",
  "client": "COLON"
 },
 {
  "site": "CLF",
  "nomVendeur": "JOAO TEIXEIRA",
  "marque": "VO",
  "jour": "2026-06-12",
  "creneau": "10:00-11:00",
  "client": "HANNARD"
 },
 {
  "site": "CLF",
  "nomVendeur": "JOAO TEIXEIRA",
  "marque": "VO",
  "jour": "2026-06-11",
  "creneau": "11:00-12:00",
  "client": "DAMON"
 },
 {
  "site": "CLF",
  "nomVendeur": "JOAO TEIXEIRA",
  "marque": "VO",
  "jour": "2026-06-11",
  "creneau": "13:00-14:00",
  "client": "GENESTIER"
 },
 {
  "site": "CLF",
  "nomVendeur": "JOAO TEIXEIRA",
  "marque": "VO",
  "jour": "2026-06-12",
  "creneau": "14:00-15:00",
  "client": "LANDILLON"
 },
 {
  "site": "CLF",
  "nomVendeur": "JOAO TEIXEIRA",
  "marque": "VO",
  "jour": "2026-06-11",
  "creneau": "17:00-18:00",
  "client": "PAYET"
 },
 {
  "site": "CLF",
  "nomVendeur": "THIERRY MARTINEZ",
  "marque": "VO",
  "jour": "2026-06-12",
  "creneau": "09:00-10:00",
  "client": "LAMBAIN"
 },
 {
  "site": "CLF",
  "nomVendeur": "THIERRY MARTINEZ",
  "marque": "VO",
  "jour": "2026-06-14",
  "creneau": "09:00-10:00",
  "client": "ROUFFET"
 },
 {
  "site": "CLF",
  "nomVendeur": "THIERRY MARTINEZ",
  "marque": "VO",
  "jour": "2026-06-14",
  "creneau": "10:00-11:00",
  "client": "BENIER (CAPTUR)"
 },
 {
  "site": "CLF",
  "nomVendeur": "THIERRY MARTINEZ",
  "marque": "VO",
  "jour": "2026-06-13",
  "creneau": "11:00-12:00",
  "client": "RICHARD"
 },
 {
  "site": "CLF",
  "nomVendeur": "THIERRY MARTINEZ",
  "marque": "VO",
  "jour": "2026-06-12",
  "creneau": "14:00-15:00",
  "client": "ROUDIER (CLIO DIESEL)"
 },
 {
  "site": "CLF",
  "nomVendeur": "THIERRY MARTINEZ",
  "marque": "VO",
  "jour": "2026-06-13",
  "creneau": "14:00-15:00",
  "client": "CHEREL (CLIO 5 hev)"
 },
 {
  "site": "CLF",
  "nomVendeur": "THIERRY MARTINEZ",
  "marque": "VO",
  "jour": "2026-06-14",
  "creneau": "16:00-17:00",
  "client": "FRUQUIERE"
 },
 {
  "site": "CLF",
  "nomVendeur": "THIERRY MARTINEZ",
  "marque": "VO",
  "jour": "2026-06-15",
  "creneau": "16:00-17:00",
  "client": "MALLET"
 },
 {
  "site": "CLF",
  "nomVendeur": "THIERRY MARTINEZ",
  "marque": "VO",
  "jour": "2026-06-12",
  "creneau": "17:00-18:00",
  "client": "ADDEO (CLIO)"
 },
 {
  "site": "CLF",
  "nomVendeur": "THIERRY MARTINEZ",
  "marque": "VO",
  "jour": "2026-06-15",
  "creneau": "17:00-18:00",
  "client": "GATIGNOL"
 },
 {
  "site": "CLF",
  "nomVendeur": "JEROME SABIN",
  "marque": "VO",
  "jour": "2026-06-13",
  "creneau": "09:00-10:00",
  "client": "EHMIG"
 },
 {
  "site": "CLF",
  "nomVendeur": "JEROME SABIN",
  "marque": "VO",
  "jour": "2026-06-14",
  "creneau": "09:00-10:00",
  "client": "ROUFFET"
 },
 {
  "site": "CLF",
  "nomVendeur": "JEROME SABIN",
  "marque": "VO",
  "jour": "2026-06-11",
  "creneau": "14:00-15:00",
  "client": "ROUVET"
 },
 {
  "site": "CLF",
  "nomVendeur": "JEROME SABIN",
  "marque": "VO",
  "jour": "2026-06-13",
  "creneau": "14:00-15:00",
  "client": "GORY"
 },
 {
  "site": "CLF",
  "nomVendeur": "JEROME SABIN",
  "marque": "VO",
  "jour": "2026-06-15",
  "creneau": "14:00-15:00",
  "client": "DEVERNOIS"
 },
 {
  "site": "CLF",
  "nomVendeur": "JEROME SABIN",
  "marque": "VO",
  "jour": "2026-06-14",
  "creneau": "16:00-17:00",
  "client": "FRUQUIERE"
 },
 {
  "site": "CLF",
  "nomVendeur": "JEROME SABIN",
  "marque": "VO",
  "jour": "2026-06-11",
  "creneau": "17:00-18:00",
  "client": "GHIAB"
 },
 {
  "site": "CLF",
  "nomVendeur": "JEROME SABIN",
  "marque": "VO",
  "jour": "2026-06-12",
  "creneau": "17:00-18:00",
  "client": "MAUME"
 },
 {
  "site": "CLF",
  "nomVendeur": "JEROME SABIN",
  "marque": "VO",
  "jour": "2026-06-13",
  "creneau": "17:00-18:00",
  "client": "BONNET"
 },
 {
  "site": "CLF",
  "nomVendeur": "JEROME SABIN",
  "marque": "VO",
  "jour": "2026-06-15",
  "creneau": "17:00-18:00",
  "client": "ANADON LUIS"
 },
 {
  "site": "CLF",
  "nomVendeur": "JEROME SABIN",
  "marque": "VO",
  "jour": "2026-06-15",
  "creneau": "14:00-15:00",
  "client": "DE SOUSA"
 },
 {
  "site": "MOZ",
  "nomVendeur": "ANTHONY DONAS",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "09:00-10:00",
  "client": "GIAMPRETIE"
 },
 {
  "site": "MOZ",
  "nomVendeur": "ANTHONY DONAS",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "09:00-10:00",
  "client": "ALLENDE"
 },
 {
  "site": "MOZ",
  "nomVendeur": "ANTHONY DONAS",
  "marque": "RENAULT",
  "jour": "2026-06-14",
  "creneau": "10:00-11:00",
  "client": "BELKADI"
 },
 {
  "site": "MOZ",
  "nomVendeur": "ANTHONY DONAS",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "11:00-12:00",
  "client": "SEMA"
 },
 {
  "site": "MOZ",
  "nomVendeur": "ANTHONY DONAS",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "14:00-15:00",
  "client": "GUYONNET"
 },
 {
  "site": "MOZ",
  "nomVendeur": "ANTHONY DONAS",
  "marque": "RENAULT",
  "jour": "2026-06-14",
  "creneau": "14:00-15:00",
  "client": "BERTRAND"
 },
 {
  "site": "MOZ",
  "nomVendeur": "ANTHONY DONAS",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "15:00-16:00",
  "client": "FUZET"
 },
 {
  "site": "MOZ",
  "nomVendeur": "ANTHONY DONAS",
  "marque": "RENAULT",
  "jour": "2026-06-15",
  "creneau": "15:00-16:00",
  "client": "LASTIQUE"
 },
 {
  "site": "MOZ",
  "nomVendeur": "ANTHONY DONAS",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "16:00-17:00",
  "client": "MUNOZ"
 },
 {
  "site": "MOZ",
  "nomVendeur": "ANTHONY DONAS",
  "marque": "RENAULT",
  "jour": "2026-06-15",
  "creneau": "16:00-17:00",
  "client": "CLEMENT"
 },
 {
  "site": "MOZ",
  "nomVendeur": "ANTHONY DONAS",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "17:00-18:00",
  "client": "BRONGNIART"
 },
 {
  "site": "MOZ",
  "nomVendeur": "ANTHONY DONAS",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "17:00-18:00",
  "client": "VERGNE"
 },
 {
  "site": "MOZ",
  "nomVendeur": "ANTHONY DONAS",
  "marque": "RENAULT",
  "jour": "2026-06-14",
  "creneau": "17:00-18:00",
  "client": "CHONAL"
 },
 {
  "site": "MOZ",
  "nomVendeur": "ANTHONY DONAS",
  "marque": "DACIA",
  "jour": "2026-06-15",
  "creneau": "10:00-11:00",
  "client": "CHELLES"
 },
 {
  "site": "MOZ",
  "nomVendeur": "ANTHONY DONAS",
  "marque": "DACIA",
  "jour": "2026-06-12",
  "creneau": "14:00-15:00",
  "client": "PINET"
 },
 {
  "site": "MOZ",
  "nomVendeur": "ANTHONY DONAS",
  "marque": "DACIA",
  "jour": "2026-06-14",
  "creneau": "14:00-15:00",
  "client": "GIUSIANO"
 },
 {
  "site": "MOZ",
  "nomVendeur": "ANTHONY DONAS",
  "marque": "DACIA",
  "jour": "2026-06-12",
  "creneau": "16:00-17:00",
  "client": "MORIOL"
 },
 {
  "site": "MOZ",
  "nomVendeur": "JORDAN CALDEIRA",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "08:00-09:00",
  "client": "THOMAS"
 },
 {
  "site": "MOZ",
  "nomVendeur": "JORDAN CALDEIRA",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "09:00-10:00",
  "client": "KUNTZ"
 },
 {
  "site": "MOZ",
  "nomVendeur": "JORDAN CALDEIRA",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "09:00-10:00",
  "client": "FRADETAL"
 },
 {
  "site": "MOZ",
  "nomVendeur": "JORDAN CALDEIRA",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "10:00-11:00",
  "client": "SEGUIN"
 },
 {
  "site": "MOZ",
  "nomVendeur": "JORDAN CALDEIRA",
  "marque": "RENAULT",
  "jour": "2026-06-14",
  "creneau": "10:00-11:00",
  "client": "MARTINET"
 },
 {
  "site": "MOZ",
  "nomVendeur": "JORDAN CALDEIRA",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "11:00-12:00",
  "client": "PERONNET"
 },
 {
  "site": "MOZ",
  "nomVendeur": "JORDAN CALDEIRA",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "14:00-15:00",
  "client": "GRAVIL"
 },
 {
  "site": "MOZ",
  "nomVendeur": "JORDAN CALDEIRA",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "14:00-15:00",
  "client": "ARNAUD"
 },
 {
  "site": "MOZ",
  "nomVendeur": "JORDAN CALDEIRA",
  "marque": "RENAULT",
  "jour": "2026-06-14",
  "creneau": "14:00-15:00",
  "client": "GRENIER"
 },
 {
  "site": "MOZ",
  "nomVendeur": "JORDAN CALDEIRA",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "15:00-16:00",
  "client": "IMBERT"
 },
 {
  "site": "MOZ",
  "nomVendeur": "JORDAN CALDEIRA",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "15:00-16:00",
  "client": "DECLOUX"
 },
 {
  "site": "MOZ",
  "nomVendeur": "JORDAN CALDEIRA",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "17:00-18:00",
  "client": "PETITCOLLIN"
 },
 {
  "site": "MOZ",
  "nomVendeur": "JORDAN CALDEIRA",
  "marque": "DACIA",
  "jour": "2026-06-13",
  "creneau": "10:00-11:00",
  "client": "ARDAILLON"
 },
 {
  "site": "MOZ",
  "nomVendeur": "JORDAN CALDEIRA",
  "marque": "DACIA",
  "jour": "2026-06-11",
  "creneau": "11:00-12:00",
  "client": "COUDERT"
 },
 {
  "site": "MOZ",
  "nomVendeur": "JORDAN CALDEIRA",
  "marque": "DACIA",
  "jour": "2026-06-11",
  "creneau": "14:00-15:00",
  "client": "BONNOT"
 },
 {
  "site": "MOZ",
  "nomVendeur": "JORDAN CALDEIRA",
  "marque": "DACIA",
  "jour": "2026-06-13",
  "creneau": "14:00-15:00",
  "client": "ARCHAMBEAU"
 },
 {
  "site": "MOZ",
  "nomVendeur": "JORDAN CALDEIRA",
  "marque": "DACIA",
  "jour": "2026-06-11",
  "creneau": "16:00-17:00",
  "client": "CHARVEL"
 },
 {
  "site": "MOZ",
  "nomVendeur": "JORDAN CALDEIRA",
  "marque": "DACIA",
  "jour": "2026-06-12",
  "creneau": "17:00-18:00",
  "client": "MENUGE"
 },
 {
  "site": "MOZ",
  "nomVendeur": "ROBIN RABOISSON",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "09:00-10:00",
  "client": "GUERIOT ANNA"
 },
 {
  "site": "MOZ",
  "nomVendeur": "ROBIN RABOISSON",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "09:00-10:00",
  "client": "GONZALEZ"
 },
 {
  "site": "MOZ",
  "nomVendeur": "ROBIN RABOISSON",
  "marque": "RENAULT",
  "jour": "2026-06-14",
  "creneau": "09:00-10:00",
  "client": "PEROL"
 },
 {
  "site": "MOZ",
  "nomVendeur": "ROBIN RABOISSON",
  "marque": "RENAULT",
  "jour": "2026-06-14",
  "creneau": "10:00-11:00",
  "client": "TINEL"
 },
 {
  "site": "MOZ",
  "nomVendeur": "ROBIN RABOISSON",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "11:00-12:00",
  "client": "DUMAS"
 },
 {
  "site": "MOZ",
  "nomVendeur": "ROBIN RABOISSON",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "14:00-15:00",
  "client": "PREVOT"
 },
 {
  "site": "MOZ",
  "nomVendeur": "ROBIN RABOISSON",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "14:00-15:00",
  "client": "PETIT CLEMENT"
 },
 {
  "site": "MOZ",
  "nomVendeur": "ROBIN RABOISSON",
  "marque": "RENAULT",
  "jour": "2026-06-15",
  "creneau": "14:00-15:00",
  "client": "DEGUIS"
 },
 {
  "site": "MOZ",
  "nomVendeur": "ROBIN RABOISSON",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "15:00-16:00",
  "client": "SCHANK"
 },
 {
  "site": "MOZ",
  "nomVendeur": "ROBIN RABOISSON",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "17:00-18:00",
  "client": "MARION GILLES"
 },
 {
  "site": "MOZ",
  "nomVendeur": "ROBIN RABOISSON",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "18:00-19:00",
  "client": "SCANDELLA"
 },
 {
  "site": "MOZ",
  "nomVendeur": "ROBIN RABOISSON",
  "marque": "DACIA",
  "jour": "2026-06-12",
  "creneau": "09:00-10:00",
  "client": "MORLIN"
 },
 {
  "site": "MOZ",
  "nomVendeur": "ROBIN RABOISSON",
  "marque": "DACIA",
  "jour": "2026-06-11",
  "creneau": "10:00-11:00",
  "client": "SAUVADET"
 },
 {
  "site": "MOZ",
  "nomVendeur": "ROBIN RABOISSON",
  "marque": "DACIA",
  "jour": "2026-06-13",
  "creneau": "11:00-12:00",
  "client": "GOUT"
 },
 {
  "site": "MOZ",
  "nomVendeur": "ROBIN RABOISSON",
  "marque": "DACIA",
  "jour": "2026-06-11",
  "creneau": "17:00-18:00",
  "client": "GILON"
 },
 {
  "site": "MOZ",
  "nomVendeur": "KEVIN DIJOUX",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "09:00-10:00",
  "client": "ROULLEAU (CLIO)"
 },
 {
  "site": "MOZ",
  "nomVendeur": "KEVIN DIJOUX",
  "marque": "RENAULT",
  "jour": "2026-06-14",
  "creneau": "09:00-10:00",
  "client": "GIRAUD (CAPTUR)"
 },
 {
  "site": "MOZ",
  "nomVendeur": "KEVIN DIJOUX",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "10:00-11:00",
  "client": "THEUIL"
 },
 {
  "site": "MOZ",
  "nomVendeur": "KEVIN DIJOUX",
  "marque": "RENAULT",
  "jour": "2026-06-14",
  "creneau": "10:00-11:00",
  "client": "AMBLARD (ESPACE)"
 },
 {
  "site": "MOZ",
  "nomVendeur": "KEVIN DIJOUX",
  "marque": "RENAULT",
  "jour": "2026-06-15",
  "creneau": "10:00-11:00",
  "client": "DIOGON (AUSTRAL OU RAFALE)"
 },
 {
  "site": "MOZ",
  "nomVendeur": "KEVIN DIJOUX",
  "marque": "RENAULT",
  "jour": "2026-06-14",
  "creneau": "11:00-12:00",
  "client": "VACHER ( CAPTUR)"
 },
 {
  "site": "MOZ",
  "nomVendeur": "KEVIN DIJOUX",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "14:00-15:00",
  "client": "DEVILLARD (R5 E TECH)"
 },
 {
  "site": "MOZ",
  "nomVendeur": "KEVIN DIJOUX",
  "marque": "RENAULT",
  "jour": "2026-06-14",
  "creneau": "14:00-15:00",
  "client": "ESSARD (R5 E TYECH)"
 },
 {
  "site": "MOZ",
  "nomVendeur": "KEVIN DIJOUX",
  "marque": "RENAULT",
  "jour": "2026-06-14",
  "creneau": "15:00-16:00",
  "client": "CHARMETON (AUSTRAL)"
 },
 {
  "site": "MOZ",
  "nomVendeur": "KEVIN DIJOUX",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "16:00-17:00",
  "client": "ROAESTER (CLIO)"
 },
 {
  "site": "MOZ",
  "nomVendeur": "KEVIN DIJOUX",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "16:00-17:00",
  "client": "BOUSSEARE (R5)"
 },
 {
  "site": "MOZ",
  "nomVendeur": "KEVIN DIJOUX",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "17:00-18:00",
  "client": "BASQUE (R5)"
 },
 {
  "site": "MOZ",
  "nomVendeur": "KEVIN DIJOUX",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "18:00-19:00",
  "client": "CALDEIRA (CLIO 5 OU 6)"
 },
 {
  "site": "MOZ",
  "nomVendeur": "KEVIN DIJOUX",
  "marque": "DACIA",
  "jour": "2026-06-12",
  "creneau": "08:00-09:00",
  "client": "HEMAR (JOGGER)"
 },
 {
  "site": "MOZ",
  "nomVendeur": "KEVIN DIJOUX",
  "marque": "DACIA",
  "jour": "2026-06-11",
  "creneau": "09:00-10:00",
  "client": "Thors (Stepway)"
 },
 {
  "site": "MOZ",
  "nomVendeur": "KEVIN DIJOUX",
  "marque": "DACIA",
  "jour": "2026-06-11",
  "creneau": "10:00-11:00",
  "client": "FOUCAUD (STEPWAY)"
 },
 {
  "site": "MOZ",
  "nomVendeur": "KEVIN DIJOUX",
  "marque": "DACIA",
  "jour": "2026-06-13",
  "creneau": "11:00-12:00",
  "client": "MALARD (SPRING)"
 },
 {
  "site": "MOZ",
  "nomVendeur": "KEVIN DIJOUX",
  "marque": "DACIA",
  "jour": "2026-06-11",
  "creneau": "15:00-16:00",
  "client": "PELLET (DUSTER)"
 },
 {
  "site": "MOZ",
  "nomVendeur": "KEVIN DIJOUX",
  "marque": "DACIA",
  "jour": "2026-06-11",
  "creneau": "18:00-19:00",
  "client": "FRESCENAUNAI (JOGGER)"
 },
 {
  "site": "MOZ",
  "nomVendeur": "UGO FERVEL",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "09:00-10:00",
  "client": "MONIER (SCENIC E TECH)"
 },
 {
  "site": "MOZ",
  "nomVendeur": "UGO FERVEL",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "10:00-11:00",
  "client": "DEBAIN (R5)"
 },
 {
  "site": "MOZ",
  "nomVendeur": "UGO FERVEL",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "10:00-11:00",
  "client": "BOLLATON (R5)"
 },
 {
  "site": "MOZ",
  "nomVendeur": "UGO FERVEL",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "14:00-15:00",
  "client": "BRASSIER (CAPTUR)"
 },
 {
  "site": "MOZ",
  "nomVendeur": "UGO FERVEL",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "14:00-15:00",
  "client": "RASTERO (scenic etech)"
 },
 {
  "site": "MOZ",
  "nomVendeur": "UGO FERVEL",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "14:00-15:00",
  "client": "PIROIRE MEGANE"
 },
 {
  "site": "MOZ",
  "nomVendeur": "UGO FERVEL",
  "marque": "RENAULT",
  "jour": "2026-06-15",
  "creneau": "14:00-15:00",
  "client": "RM"
 },
 {
  "site": "MOZ",
  "nomVendeur": "UGO FERVEL",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "15:00-16:00",
  "client": "MAGUIGNOU (CLIO 6)"
 },
 {
  "site": "MOZ",
  "nomVendeur": "UGO FERVEL",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "16:00-17:00",
  "client": "BELLET (R5 ETECH)"
 },
 {
  "site": "MOZ",
  "nomVendeur": "UGO FERVEL",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "16:00-17:00",
  "client": "FAURE (R4 ETECH)"
 },
 {
  "site": "MOZ",
  "nomVendeur": "UGO FERVEL",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "17:00-18:00",
  "client": "COURTIAL CLIO 6"
 },
 {
  "site": "MOZ",
  "nomVendeur": "UGO FERVEL",
  "marque": "DACIA",
  "jour": "2026-06-13",
  "creneau": "10:00-11:00",
  "client": "DEBEZ(sandero)"
 },
 {
  "site": "MOZ",
  "nomVendeur": "UGO FERVEL",
  "marque": "DACIA",
  "jour": "2026-06-11",
  "creneau": "11:00-12:00",
  "client": "MARTINS (jOGGER)"
 },
 {
  "site": "MOZ",
  "nomVendeur": "UGO FERVEL",
  "marque": "DACIA",
  "jour": "2026-06-13",
  "creneau": "11:00-12:00",
  "client": "BELLE SANDERO OU DUSTER"
 },
 {
  "site": "MOZ",
  "nomVendeur": "UGO FERVEL",
  "marque": "DACIA",
  "jour": "2026-06-15",
  "creneau": "15:00-16:00",
  "client": "PONNA SANDERO"
 },
 {
  "site": "MOZ",
  "nomVendeur": "UGO FERVEL",
  "marque": "DACIA",
  "jour": "2026-06-14",
  "creneau": "17:00-18:00",
  "client": "POUILLY (SCENIC)"
 },
 {
  "site": "MOZ",
  "nomVendeur": "YANN DE OLIVEIRA",
  "marque": "VO",
  "jour": "2026-06-11",
  "creneau": "08:00-09:00",
  "client": "THIALLET (Espace 6)"
 },
 {
  "site": "MOZ",
  "nomVendeur": "YANN DE OLIVEIRA",
  "marque": "VO",
  "jour": "2026-06-12",
  "creneau": "08:00-09:00",
  "client": "BIDET (DUSTER)"
 },
 {
  "site": "MOZ",
  "nomVendeur": "YANN DE OLIVEIRA",
  "marque": "VO",
  "jour": "2026-06-11",
  "creneau": "09:00-10:00",
  "client": "PLANCHAT (CLio 5)"
 },
 {
  "site": "MOZ",
  "nomVendeur": "YANN DE OLIVEIRA",
  "marque": "VO",
  "jour": "2026-06-13",
  "creneau": "09:00-10:00",
  "client": "MALESTROIT (DUster)"
 },
 {
  "site": "MOZ",
  "nomVendeur": "YANN DE OLIVEIRA",
  "marque": "VO",
  "jour": "2026-06-11",
  "creneau": "10:00-11:00",
  "client": "SUGERE (ARKANA)"
 },
 {
  "site": "MOZ",
  "nomVendeur": "YANN DE OLIVEIRA",
  "marque": "VO",
  "jour": "2026-06-13",
  "creneau": "10:00-11:00",
  "client": "MORGAN (Clio)"
 },
 {
  "site": "MOZ",
  "nomVendeur": "YANN DE OLIVEIRA",
  "marque": "VO",
  "jour": "2026-06-14",
  "creneau": "10:00-11:00",
  "client": "ABDALAH (reprise clio)"
 },
 {
  "site": "MOZ",
  "nomVendeur": "YANN DE OLIVEIRA",
  "marque": "VO",
  "jour": "2026-06-11",
  "creneau": "11:00-12:00",
  "client": "BOUAJAY (Sandero)"
 },
 {
  "site": "MOZ",
  "nomVendeur": "YANN DE OLIVEIRA",
  "marque": "VO",
  "jour": "2026-06-13",
  "creneau": "11:00-12:00",
  "client": "FIGUERIDO (Megane)"
 },
 {
  "site": "MOZ",
  "nomVendeur": "YANN DE OLIVEIRA",
  "marque": "VO",
  "jour": "2026-06-14",
  "creneau": "11:00-12:00",
  "client": "LIGIER (DOkker)"
 },
 {
  "site": "MOZ",
  "nomVendeur": "YANN DE OLIVEIRA",
  "marque": "VO",
  "jour": "2026-06-11",
  "creneau": "14:00-15:00",
  "client": "ROLLIN (Captur)"
 },
 {
  "site": "MOZ",
  "nomVendeur": "YANN DE OLIVEIRA",
  "marque": "VO",
  "jour": "2026-06-13",
  "creneau": "14:00-15:00",
  "client": "BAUDOIN (Austral)"
 },
 {
  "site": "MOZ",
  "nomVendeur": "YANN DE OLIVEIRA",
  "marque": "VO",
  "jour": "2026-06-14",
  "creneau": "14:00-15:00",
  "client": "DA SILVA (CLio)"
 },
 {
  "site": "MOZ",
  "nomVendeur": "YANN DE OLIVEIRA",
  "marque": "VO",
  "jour": "2026-06-15",
  "creneau": "14:00-15:00",
  "client": "CLEMENT (Captur)"
 },
 {
  "site": "MOZ",
  "nomVendeur": "YANN DE OLIVEIRA",
  "marque": "VO",
  "jour": "2026-06-14",
  "creneau": "15:00-16:00",
  "client": "TESSANDIER (CAPTUR)"
 },
 {
  "site": "MOZ",
  "nomVendeur": "YANN DE OLIVEIRA",
  "marque": "VO",
  "jour": "2026-06-13",
  "creneau": "16:00-17:00",
  "client": "MAZZOLINI (reprise Zoé)"
 },
 {
  "site": "MOZ",
  "nomVendeur": "YANN DE OLIVEIRA",
  "marque": "VO",
  "jour": "2026-06-12",
  "creneau": "17:00-18:00",
  "client": "FOURNIER (Arkana)"
 },
 {
  "site": "MOZ",
  "nomVendeur": "YANN DE OLIVEIRA",
  "marque": "VO",
  "jour": "2026-06-15",
  "creneau": "18:00-19:00",
  "client": "LANDRO (Sandero)"
 },
 {
  "site": "MOZ",
  "nomVendeur": "MATTHIAS VALLE",
  "marque": "VO",
  "jour": "2026-06-12",
  "creneau": "08:00-09:00",
  "client": "CORNOT (Austral?)"
 },
 {
  "site": "MOZ",
  "nomVendeur": "MATTHIAS VALLE",
  "marque": "VO",
  "jour": "2026-06-14",
  "creneau": "10:00-11:00",
  "client": "PERTIN (CLio)"
 },
 {
  "site": "MOZ",
  "nomVendeur": "MATTHIAS VALLE",
  "marque": "VO",
  "jour": "2026-06-11",
  "creneau": "11:00-12:00",
  "client": "AVRIL (Jogger)"
 },
 {
  "site": "MOZ",
  "nomVendeur": "MATTHIAS VALLE",
  "marque": "VO",
  "jour": "2026-06-13",
  "creneau": "11:00-12:00",
  "client": "Mairie de BORNES les MIMOSA (Master benne)"
 },
 {
  "site": "MOZ",
  "nomVendeur": "MATTHIAS VALLE",
  "marque": "VO",
  "jour": "2026-06-14",
  "creneau": "11:00-12:00",
  "client": "PERTIN (Captur)"
 },
 {
  "site": "MOZ",
  "nomVendeur": "MATTHIAS VALLE",
  "marque": "VO",
  "jour": "2026-06-11",
  "creneau": "14:00-15:00",
  "client": "PRADA (Sandero)"
 },
 {
  "site": "MOZ",
  "nomVendeur": "MATTHIAS VALLE",
  "marque": "VO",
  "jour": "2026-06-12",
  "creneau": "14:00-15:00",
  "client": "GARDON (Renouvellement elec)"
 },
 {
  "site": "MOZ",
  "nomVendeur": "MATTHIAS VALLE",
  "marque": "VO",
  "jour": "2026-06-13",
  "creneau": "14:00-15:00",
  "client": "LAMBERT (Clio hybride 145)"
 },
 {
  "site": "MOZ",
  "nomVendeur": "MATTHIAS VALLE",
  "marque": "VO",
  "jour": "2026-06-14",
  "creneau": "14:00-15:00",
  "client": "BAFOURD (Clio)"
 },
 {
  "site": "MOZ",
  "nomVendeur": "MATTHIAS VALLE",
  "marque": "VO",
  "jour": "2026-06-11",
  "creneau": "15:00-16:00",
  "client": "VAURE - DENIS (LOA elec)"
 },
 {
  "site": "MOZ",
  "nomVendeur": "MATTHIAS VALLE",
  "marque": "VO",
  "jour": "2026-06-14",
  "creneau": "15:00-16:00",
  "client": "MAZE (CLio)"
 },
 {
  "site": "MOZ",
  "nomVendeur": "MATTHIAS VALLE",
  "marque": "VO",
  "jour": "2026-06-11",
  "creneau": "16:00-17:00",
  "client": "DEVEAUX (Sandero)"
 },
 {
  "site": "MOZ",
  "nomVendeur": "MATTHIAS VALLE",
  "marque": "VO",
  "jour": "2026-06-11",
  "creneau": "17:00-18:00",
  "client": "BOURJIS (Zoé ?)"
 },
 {
  "site": "USS",
  "nomVendeur": "ROBIN GUERY",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "11:00-12:00",
  "client": "SIMMONOT"
 },
 {
  "site": "USS",
  "nomVendeur": "ROBIN GUERY",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "14:00-15:00",
  "client": "REDONDY"
 },
 {
  "site": "USS",
  "nomVendeur": "ROBIN GUERY",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "14:00-15:00",
  "client": "SULTAN"
 },
 {
  "site": "USS",
  "nomVendeur": "ROBIN GUERY",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "16:00-17:00",
  "client": "CHABOT"
 },
 {
  "site": "USS",
  "nomVendeur": "ROBIN GUERY",
  "marque": "DACIA",
  "jour": "2026-06-11",
  "creneau": "10:00-11:00",
  "client": "BELLEGUEULE"
 },
 {
  "site": "USS",
  "nomVendeur": "ROBIN GUERY",
  "marque": "DACIA",
  "jour": "2026-06-14",
  "creneau": "11:00-12:00",
  "client": "MALAQUI"
 },
 {
  "site": "USS",
  "nomVendeur": "ROBIN GUERY",
  "marque": "DACIA",
  "jour": "2026-06-12",
  "creneau": "16:00-17:00",
  "client": "JACOB"
 },
 {
  "site": "USS",
  "nomVendeur": "JULIEN SPADAT",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "08:00-09:00",
  "client": "¨GOIFFON"
 },
 {
  "site": "USS",
  "nomVendeur": "JULIEN SPADAT",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "10:00-11:00",
  "client": "PAREL"
 },
 {
  "site": "USS",
  "nomVendeur": "JULIEN SPADAT",
  "marque": "RENAULT",
  "jour": "2026-06-14",
  "creneau": "10:00-11:00",
  "client": "FAUGERAS"
 },
 {
  "site": "USS",
  "nomVendeur": "JULIEN SPADAT",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "11:00-12:00",
  "client": "SCHOENMAKERS"
 },
 {
  "site": "USS",
  "nomVendeur": "JULIEN SPADAT",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "14:00-15:00",
  "client": "NIN"
 },
 {
  "site": "USS",
  "nomVendeur": "JULIEN SPADAT",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "14:00-15:00",
  "client": "ARNOULT"
 },
 {
  "site": "USS",
  "nomVendeur": "JULIEN SPADAT",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "16:00-17:00",
  "client": "GOUYO"
 },
 {
  "site": "USS",
  "nomVendeur": "JULIEN SPADAT",
  "marque": "DACIA",
  "jour": "2026-06-12",
  "creneau": "11:00-12:00",
  "client": "TREUIL"
 },
 {
  "site": "USS",
  "nomVendeur": "JULIEN SPADAT",
  "marque": "DACIA",
  "jour": "2026-06-12",
  "creneau": "15:00-16:00",
  "client": "SABOURIN"
 },
 {
  "site": "USS",
  "nomVendeur": "JULIEN SPADAT",
  "marque": "DACIA",
  "jour": "2026-06-13",
  "creneau": "16:00-17:00",
  "client": "JAKSIK"
 },
 {
  "site": "USS",
  "nomVendeur": "STÉPHANE VANDAMME",
  "marque": "VO",
  "jour": "2026-06-13",
  "creneau": "08:00-09:00",
  "client": "GUGGER (DUSTER)"
 },
 {
  "site": "USS",
  "nomVendeur": "STÉPHANE VANDAMME",
  "marque": "VO",
  "jour": "2026-06-13",
  "creneau": "09:00-10:00",
  "client": "NOEL (Arkana)"
 },
 {
  "site": "USS",
  "nomVendeur": "STÉPHANE VANDAMME",
  "marque": "VO",
  "jour": "2026-06-14",
  "creneau": "10:00-11:00",
  "client": "PRELAT (Spring)"
 },
 {
  "site": "USS",
  "nomVendeur": "STÉPHANE VANDAMME",
  "marque": "VO",
  "jour": "2026-06-12",
  "creneau": "14:00-15:00",
  "client": "COSTERO (DUSTER)"
 },
 {
  "site": "USS",
  "nomVendeur": "STÉPHANE VANDAMME",
  "marque": "VO",
  "jour": "2026-06-13",
  "creneau": "15:00-16:00",
  "client": "CELERIER (Captur)"
 },
 {
  "site": "USS",
  "nomVendeur": "STÉPHANE VANDAMME",
  "marque": "VO",
  "jour": "2026-06-14",
  "creneau": "15:00-16:00",
  "client": "DUPONT (VO)"
 },
 {
  "site": "USS",
  "nomVendeur": "STÉPHANE VANDAMME",
  "marque": "VO",
  "jour": "2026-06-12",
  "creneau": "17:00-18:00",
  "client": "BARRAGE (Duster)"
 },
 {
  "site": "ALPINE",
  "nomVendeur": "SÉBASTIEN MIRA",
  "marque": "ALPINE",
  "jour": "2026-06-13",
  "creneau": "09:00-10:00",
  "client": "MATHE"
 },
 {
  "site": "ALPINE",
  "nomVendeur": "SÉBASTIEN MIRA",
  "marque": "ALPINE",
  "jour": "2026-06-13",
  "creneau": "10:00-11:00",
  "client": "DUMAZET"
 },
 {
  "site": "ALPINE",
  "nomVendeur": "SÉBASTIEN MIRA",
  "marque": "ALPINE",
  "jour": "2026-06-14",
  "creneau": "10:00-11:00",
  "client": "DELENCLOS"
 },
 {
  "site": "ALPINE",
  "nomVendeur": "SÉBASTIEN MIRA",
  "marque": "ALPINE",
  "jour": "2026-06-12",
  "creneau": "11:00-12:00",
  "client": "BERGOGNE"
 },
 {
  "site": "ALPINE",
  "nomVendeur": "SÉBASTIEN MIRA",
  "marque": "ALPINE",
  "jour": "2026-06-13",
  "creneau": "11:00-12:00",
  "client": "LEHMAN"
 },
 {
  "site": "ALPINE",
  "nomVendeur": "SÉBASTIEN MIRA",
  "marque": "ALPINE",
  "jour": "2026-06-14",
  "creneau": "11:00-12:00",
  "client": "BATISSON"
 },
 {
  "site": "ALPINE",
  "nomVendeur": "SÉBASTIEN MIRA",
  "marque": "ALPINE",
  "jour": "2026-06-12",
  "creneau": "14:00-15:00",
  "client": "MOREL"
 },
 {
  "site": "ALPINE",
  "nomVendeur": "SÉBASTIEN MIRA",
  "marque": "ALPINE",
  "jour": "2026-06-13",
  "creneau": "14:00-15:00",
  "client": "ZHAO"
 },
 {
  "site": "ALPINE",
  "nomVendeur": "SÉBASTIEN MIRA",
  "marque": "ALPINE",
  "jour": "2026-06-14",
  "creneau": "14:00-15:00",
  "client": "IERA"
 },
 {
  "site": "ALPINE",
  "nomVendeur": "SÉBASTIEN MIRA",
  "marque": "ALPINE",
  "jour": "2026-06-13",
  "creneau": "15:00-16:00",
  "client": "VALETTE"
 },
 {
  "site": "ALPINE",
  "nomVendeur": "SÉBASTIEN MIRA",
  "marque": "ALPINE",
  "jour": "2026-06-14",
  "creneau": "15:00-16:00",
  "client": "MINET"
 },
 {
  "site": "ALPINE",
  "nomVendeur": "SÉBASTIEN MIRA",
  "marque": "ALPINE",
  "jour": "2026-06-12",
  "creneau": "16:00-17:00",
  "client": "MEZIN"
 },
 {
  "site": "ALPINE",
  "nomVendeur": "SÉBASTIEN MIRA",
  "marque": "ALPINE",
  "jour": "2026-06-13",
  "creneau": "16:00-17:00",
  "client": "BILLEBAULT"
 },
 {
  "site": "ALPINE",
  "nomVendeur": "SÉBASTIEN MIRA",
  "marque": "ALPINE",
  "jour": "2026-06-13",
  "creneau": "17:00-18:00",
  "client": "BILLEBAULT"
 },
 {
  "site": "ALPINE",
  "nomVendeur": "EMILIEN SOLEILHAVOUP",
  "marque": "ALPINE",
  "jour": "2026-06-12",
  "creneau": "09:00-10:00",
  "client": "lacroix  (l,nore)"
 },
 {
  "site": "ALPINE",
  "nomVendeur": "EMILIEN SOLEILHAVOUP",
  "marque": "ALPINE",
  "jour": "2026-06-11",
  "creneau": "10:00-11:00",
  "client": "THEVENET"
 },
 {
  "site": "ALPINE",
  "nomVendeur": "EMILIEN SOLEILHAVOUP",
  "marque": "ALPINE",
  "jour": "2026-06-12",
  "creneau": "10:00-11:00",
  "client": "IZARD"
 },
 {
  "site": "ALPINE",
  "nomVendeur": "EMILIEN SOLEILHAVOUP",
  "marque": "ALPINE",
  "jour": "2026-06-13",
  "creneau": "10:00-11:00",
  "client": "CABANO"
 },
 {
  "site": "ALPINE",
  "nomVendeur": "EMILIEN SOLEILHAVOUP",
  "marque": "ALPINE",
  "jour": "2026-06-14",
  "creneau": "10:00-11:00",
  "client": "chevasson (l,nore)"
 },
 {
  "site": "ALPINE",
  "nomVendeur": "EMILIEN SOLEILHAVOUP",
  "marque": "ALPINE",
  "jour": "2026-06-12",
  "creneau": "11:00-12:00",
  "client": "ramon (l,nore)"
 },
 {
  "site": "ALPINE",
  "nomVendeur": "EMILIEN SOLEILHAVOUP",
  "marque": "ALPINE",
  "jour": "2026-06-13",
  "creneau": "13:00-14:00",
  "client": "garret (l,nore)"
 },
 {
  "site": "ALPINE",
  "nomVendeur": "EMILIEN SOLEILHAVOUP",
  "marque": "ALPINE",
  "jour": "2026-06-11",
  "creneau": "14:00-15:00",
  "client": "PESTANA"
 },
 {
  "site": "ALPINE",
  "nomVendeur": "EMILIEN SOLEILHAVOUP",
  "marque": "ALPINE",
  "jour": "2026-06-12",
  "creneau": "14:00-15:00",
  "client": "DUCROT"
 },
 {
  "site": "ALPINE",
  "nomVendeur": "EMILIEN SOLEILHAVOUP",
  "marque": "ALPINE",
  "jour": "2026-06-13",
  "creneau": "14:00-15:00",
  "client": "COMBETTES"
 },
 {
  "site": "ALPINE",
  "nomVendeur": "EMILIEN SOLEILHAVOUP",
  "marque": "ALPINE",
  "jour": "2026-06-14",
  "creneau": "14:00-15:00",
  "client": "gieze (l,nore)"
 },
 {
  "site": "ALPINE",
  "nomVendeur": "EMILIEN SOLEILHAVOUP",
  "marque": "ALPINE",
  "jour": "2026-06-13",
  "creneau": "15:00-16:00",
  "client": "POUZET"
 },
 {
  "site": "ALPINE",
  "nomVendeur": "EMILIEN SOLEILHAVOUP",
  "marque": "ALPINE",
  "jour": "2026-06-11",
  "creneau": "16:00-17:00",
  "client": "SEVESTRE"
 },
 {
  "site": "ALPINE",
  "nomVendeur": "EMILIEN SOLEILHAVOUP",
  "marque": "ALPINE",
  "jour": "2026-06-12",
  "creneau": "16:00-17:00",
  "client": "LAVERGNE"
 },
 {
  "site": "ALPINE",
  "nomVendeur": "EMILIEN SOLEILHAVOUP",
  "marque": "ALPINE",
  "jour": "2026-06-12",
  "creneau": "17:00-18:00",
  "client": "BERNAT"
 },
 {
  "site": "MASS",
  "nomVendeur": "QUENTIN VANINI",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "09:00-10:00",
  "client": "MOUSTEY (Megane VO)"
 },
 {
  "site": "MASS",
  "nomVendeur": "QUENTIN VANINI",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "09:00-10:00",
  "client": "MOURTON (Scenic)"
 },
 {
  "site": "MASS",
  "nomVendeur": "QUENTIN VANINI",
  "marque": "RENAULT",
  "jour": "2026-06-15",
  "creneau": "09:00-10:00",
  "client": "CHEVALIER (CLio 6)"
 },
 {
  "site": "MASS",
  "nomVendeur": "QUENTIN VANINI",
  "marque": "RENAULT",
  "jour": "2026-06-14",
  "creneau": "10:00-11:00",
  "client": "BOUANET (R5)"
 },
 {
  "site": "MASS",
  "nomVendeur": "QUENTIN VANINI",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "11:00-12:00",
  "client": "VIAL (Duster 4x4)"
 },
 {
  "site": "MASS",
  "nomVendeur": "QUENTIN VANINI",
  "marque": "RENAULT",
  "jour": "2026-06-14",
  "creneau": "11:00-12:00",
  "client": "PECOL (R4)"
 },
 {
  "site": "MASS",
  "nomVendeur": "QUENTIN VANINI",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "15:00-16:00",
  "client": "PUERTAS (SANDERO)"
 },
 {
  "site": "MASS",
  "nomVendeur": "QUENTIN VANINI",
  "marque": "DACIA",
  "jour": "2026-06-12",
  "creneau": "12:00-13:00",
  "client": "ENSMINGER (Spring ou Sandero)"
 },
 {
  "site": "MASS",
  "nomVendeur": "QUENTIN VANINI",
  "marque": "DACIA",
  "jour": "2026-06-12",
  "creneau": "15:00-16:00",
  "client": "BRIGO (Sandero bleu)"
 },
 {
  "site": "MASS",
  "nomVendeur": "VIRGINIE CUMINAL",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "09:00-10:00",
  "client": "MERCIER (CLIO EVO)"
 },
 {
  "site": "MASS",
  "nomVendeur": "VIRGINIE CUMINAL",
  "marque": "RENAULT",
  "jour": "2026-06-14",
  "creneau": "09:00-10:00",
  "client": "SOULE (GAMME EV)"
 },
 {
  "site": "MASS",
  "nomVendeur": "VIRGINIE CUMINAL",
  "marque": "RENAULT",
  "jour": "2026-06-15",
  "creneau": "09:00-10:00",
  "client": "BOUCHERIE TAVES /VERNY"
 },
 {
  "site": "MASS",
  "nomVendeur": "VIRGINIE CUMINAL",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "10:00-11:00",
  "client": "Esperaing (Twingo)"
 },
 {
  "site": "MASS",
  "nomVendeur": "VIRGINIE CUMINAL",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "11:00-12:00",
  "client": "DOME SANCY ARTENSE( KANGOO)"
 },
 {
  "site": "MASS",
  "nomVendeur": "VIRGINIE CUMINAL",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "11:00-12:00",
  "client": "TERPENEAU (R5)"
 },
 {
  "site": "MASS",
  "nomVendeur": "VIRGINIE CUMINAL",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "14:00-15:00",
  "client": "PETIT (R5 ETECH)"
 },
 {
  "site": "MASS",
  "nomVendeur": "VIRGINIE CUMINAL",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "14:00-15:00",
  "client": "MONIER (TWINGO OU R5)"
 },
 {
  "site": "MASS",
  "nomVendeur": "VIRGINIE CUMINAL",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "17:00-18:00",
  "client": "DARPHIN (TWINGO)"
 },
 {
  "site": "MASS",
  "nomVendeur": "VIRGINIE CUMINAL",
  "marque": "DACIA",
  "jour": "2026-06-13",
  "creneau": "09:00-10:00",
  "client": "BERGER SANDERO"
 },
 {
  "site": "MASS",
  "nomVendeur": "VIRGINIE CUMINAL",
  "marque": "DACIA",
  "jour": "2026-06-11",
  "creneau": "16:00-17:00",
  "client": "Guillon Duster"
 },
 {
  "site": "MOU",
  "nomVendeur": "SYLVETTE ROGUE",
  "marque": "DACIA",
  "jour": "2026-06-12",
  "creneau": "09:00-10:00",
  "client": "Laustriat Jogger"
 },
 {
  "site": "MOU",
  "nomVendeur": "SYLVETTE ROGUE",
  "marque": "DACIA",
  "jour": "2026-06-13",
  "creneau": "09:00-10:00",
  "client": "Laborde Duster"
 },
 {
  "site": "MOU",
  "nomVendeur": "SYLVETTE ROGUE",
  "marque": "DACIA",
  "jour": "2026-06-11",
  "creneau": "10:00-11:00",
  "client": "Gaillard Sandero"
 },
 {
  "site": "MOU",
  "nomVendeur": "SYLVETTE ROGUE",
  "marque": "DACIA",
  "jour": "2026-06-14",
  "creneau": "10:00-11:00",
  "client": "Molle Sandero"
 },
 {
  "site": "MOU",
  "nomVendeur": "SYLVETTE ROGUE",
  "marque": "DACIA",
  "jour": "2026-06-13",
  "creneau": "11:00-12:00",
  "client": "Fardeau Sandero"
 },
 {
  "site": "MOU",
  "nomVendeur": "SYLVETTE ROGUE",
  "marque": "DACIA",
  "jour": "2026-06-11",
  "creneau": "14:00-15:00",
  "client": "Schmalzle Sandero"
 },
 {
  "site": "MOU",
  "nomVendeur": "SYLVETTE ROGUE",
  "marque": "DACIA",
  "jour": "2026-06-13",
  "creneau": "14:00-15:00",
  "client": "Hissler Sandero"
 },
 {
  "site": "MOU",
  "nomVendeur": "SYLVETTE ROGUE",
  "marque": "DACIA",
  "jour": "2026-06-11",
  "creneau": "15:00-16:00",
  "client": "Mousse Sandero"
 },
 {
  "site": "MOU",
  "nomVendeur": "SYLVETTE ROGUE",
  "marque": "DACIA",
  "jour": "2026-06-12",
  "creneau": "15:00-16:00",
  "client": "Caillavet"
 },
 {
  "site": "MOU",
  "nomVendeur": "SYLVETTE ROGUE",
  "marque": "DACIA",
  "jour": "2026-06-14",
  "creneau": "15:00-16:00",
  "client": "Ferret Sandero"
 },
 {
  "site": "MOU",
  "nomVendeur": "SYLVETTE ROGUE",
  "marque": "DACIA",
  "jour": "2026-06-13",
  "creneau": "16:00-17:00",
  "client": "Gauthier Bigster"
 },
 {
  "site": "MOU",
  "nomVendeur": "SYLVETTE ROGUE",
  "marque": "DACIA",
  "jour": "2026-06-11",
  "creneau": "17:00-18:00",
  "client": "Jonier Duster"
 },
 {
  "site": "MOU",
  "nomVendeur": "SYLVETTE ROGUE",
  "marque": "DACIA",
  "jour": "2026-06-12",
  "creneau": "17:00-18:00",
  "client": "Plet Sandero"
 },
 {
  "site": "MOU",
  "nomVendeur": "SEBASTIEN DUBOST",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "08:00-09:00",
  "client": "Tourreau Symbioz"
 },
 {
  "site": "MOU",
  "nomVendeur": "SEBASTIEN DUBOST",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "08:00-09:00",
  "client": "Coudrot Twingo/R5"
 },
 {
  "site": "MOU",
  "nomVendeur": "SEBASTIEN DUBOST",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "08:00-09:00",
  "client": "Rouyer Clio 6"
 },
 {
  "site": "MOU",
  "nomVendeur": "SEBASTIEN DUBOST",
  "marque": "RENAULT",
  "jour": "2026-06-14",
  "creneau": "08:00-09:00",
  "client": "Bechonnet R5"
 },
 {
  "site": "MOU",
  "nomVendeur": "SEBASTIEN DUBOST",
  "marque": "RENAULT",
  "jour": "2026-06-15",
  "creneau": "08:00-09:00",
  "client": "Michon Twingo"
 },
 {
  "site": "MOU",
  "nomVendeur": "SEBASTIEN DUBOST",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "09:00-10:00",
  "client": "Pontonier Rafale"
 },
 {
  "site": "MOU",
  "nomVendeur": "SEBASTIEN DUBOST",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "09:00-10:00",
  "client": "Michon R4"
 },
 {
  "site": "MOU",
  "nomVendeur": "SEBASTIEN DUBOST",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "10:00-11:00",
  "client": "Novac LC R5"
 },
 {
  "site": "MOU",
  "nomVendeur": "SEBASTIEN DUBOST",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "10:00-11:00",
  "client": "Charpit R4"
 },
 {
  "site": "MOU",
  "nomVendeur": "SEBASTIEN DUBOST",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "11:00-12:00",
  "client": "Raymond LC R5"
 },
 {
  "site": "MOU",
  "nomVendeur": "SEBASTIEN DUBOST",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "14:00-15:00",
  "client": "Gammet Austral"
 },
 {
  "site": "MOU",
  "nomVendeur": "SEBASTIEN DUBOST",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "15:00-16:00",
  "client": "Dumont LC Twingo"
 },
 {
  "site": "MOU",
  "nomVendeur": "SEBASTIEN DUBOST",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "16:00-17:00",
  "client": "Gibert Symbioz"
 },
 {
  "site": "MOU",
  "nomVendeur": "SEBASTIEN DUBOST",
  "marque": "RENAULT",
  "jour": "2026-06-15",
  "creneau": "17:00-18:00",
  "client": "Pozzi LC Austral"
 },
 {
  "site": "MOU",
  "nomVendeur": "SEBASTIEN DUBOST",
  "marque": "DACIA",
  "jour": "2026-06-12",
  "creneau": "14:00-15:00",
  "client": "Roux LC Duster"
 },
 {
  "site": "MOU",
  "nomVendeur": "SEBASTIEN DUBOST",
  "marque": "DACIA",
  "jour": "2026-06-14",
  "creneau": "14:00-15:00",
  "client": "Chouchkaiev Duster"
 },
 {
  "site": "MOU",
  "nomVendeur": "SEBASTIEN DUBOST",
  "marque": "DACIA",
  "jour": "2026-06-13",
  "creneau": "15:00-16:00",
  "client": "Gauthier duster"
 },
 {
  "site": "MOU",
  "nomVendeur": "MARC PALUMBO",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "08:00-09:00",
  "client": "Bernard Megane E Tech"
 },
 {
  "site": "MOU",
  "nomVendeur": "MARC PALUMBO",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "09:00-10:00",
  "client": "Fosse R5"
 },
 {
  "site": "MOU",
  "nomVendeur": "MARC PALUMBO",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "09:00-10:00",
  "client": "Guilloux Symbioz"
 },
 {
  "site": "MOU",
  "nomVendeur": "MARC PALUMBO",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "10:00-11:00",
  "client": "Danodier"
 },
 {
  "site": "MOU",
  "nomVendeur": "MARC PALUMBO",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "10:00-11:00",
  "client": "Laborde R5"
 },
 {
  "site": "MOU",
  "nomVendeur": "MARC PALUMBO",
  "marque": "RENAULT",
  "jour": "2026-06-15",
  "creneau": "10:00-11:00",
  "client": "Berrat R5"
 },
 {
  "site": "MOU",
  "nomVendeur": "MARC PALUMBO",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "11:00-12:00",
  "client": "Belland Master benne"
 },
 {
  "site": "MOU",
  "nomVendeur": "MARC PALUMBO",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "11:00-12:00",
  "client": "Prudhomme R5"
 },
 {
  "site": "MOU",
  "nomVendeur": "MARC PALUMBO",
  "marque": "RENAULT",
  "jour": "2026-06-14",
  "creneau": "11:00-12:00",
  "client": "Normand R5"
 },
 {
  "site": "MOU",
  "nomVendeur": "MARC PALUMBO",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "14:00-15:00",
  "client": "Singery Clio"
 },
 {
  "site": "MOU",
  "nomVendeur": "MARC PALUMBO",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "14:00-15:00",
  "client": "Bertrand Twingo"
 },
 {
  "site": "MOU",
  "nomVendeur": "MARC PALUMBO",
  "marque": "RENAULT",
  "jour": "2026-06-14",
  "creneau": "14:00-15:00",
  "client": "Bostivois R5"
 },
 {
  "site": "MOU",
  "nomVendeur": "MARC PALUMBO",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "15:00-16:00",
  "client": "Petitjean Twingo"
 },
 {
  "site": "MOU",
  "nomVendeur": "MARC PALUMBO",
  "marque": "RENAULT",
  "jour": "2026-06-15",
  "creneau": "15:00-16:00",
  "client": "Riollet Scenic"
 },
 {
  "site": "MOU",
  "nomVendeur": "MARC PALUMBO",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "16:00-17:00",
  "client": "Sennepin Austral"
 },
 {
  "site": "MOU",
  "nomVendeur": "MARC PALUMBO",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "18:00-19:00",
  "client": "Esnard Baillon clio 6"
 },
 {
  "site": "MOU",
  "nomVendeur": "MARC PALUMBO",
  "marque": "DACIA",
  "jour": "2026-06-11",
  "creneau": "15:00-16:00",
  "client": "Moroy"
 },
 {
  "site": "MOU",
  "nomVendeur": "PAULINE COIGNET",
  "marque": "VO",
  "jour": "2026-06-14",
  "creneau": "08:00-09:00",
  "client": "Repos"
 },
 {
  "site": "MOU",
  "nomVendeur": "PAULINE COIGNET",
  "marque": "VO",
  "jour": "2026-06-13",
  "creneau": "11:00-12:00",
  "client": "Froliche Clio"
 },
 {
  "site": "MOU",
  "nomVendeur": "PAULINE COIGNET",
  "marque": "VO",
  "jour": "2026-06-13",
  "creneau": "15:00-16:00",
  "client": "Lamouche"
 },
 {
  "site": "MOU",
  "nomVendeur": "PAULINE COIGNET",
  "marque": "VO",
  "jour": "2026-06-11",
  "creneau": "16:00-17:00",
  "client": "Techer"
 },
 {
  "site": "MOU",
  "nomVendeur": "JULIEN LE QUELLEC",
  "marque": "VO",
  "jour": "2026-06-13",
  "creneau": "09:00-10:00",
  "client": "Maire André"
 },
 {
  "site": "MOU",
  "nomVendeur": "JULIEN LE QUELLEC",
  "marque": "VO",
  "jour": "2026-06-14",
  "creneau": "09:00-10:00",
  "client": "Da costa"
 },
 {
  "site": "MOU",
  "nomVendeur": "JULIEN LE QUELLEC",
  "marque": "VO",
  "jour": "2026-06-12",
  "creneau": "11:00-12:00",
  "client": "Delaye Gladys"
 },
 {
  "site": "MOU",
  "nomVendeur": "JULIEN LE QUELLEC",
  "marque": "VO",
  "jour": "2026-06-12",
  "creneau": "17:00-18:00",
  "client": "chapelet Romain"
 },
 {
  "site": "MOU",
  "nomVendeur": "ROMAIN DENIS",
  "marque": "VO",
  "jour": "2026-06-14",
  "creneau": "10:00-11:00",
  "client": "El Asheb"
 },
 {
  "site": "MOU",
  "nomVendeur": "ROMAIN DENIS",
  "marque": "VO",
  "jour": "2026-06-13",
  "creneau": "14:00-15:00",
  "client": "Auclair"
 },
 {
  "site": "MOU",
  "nomVendeur": "ROMAIN DENIS",
  "marque": "VO",
  "jour": "2026-06-14",
  "creneau": "14:00-15:00",
  "client": "Peyrin"
 },
 {
  "site": "MOU",
  "nomVendeur": "ROMAIN DENIS",
  "marque": "VO",
  "jour": "2026-06-14",
  "creneau": "15:00-16:00",
  "client": "Bordes"
 },
 {
  "site": "MOU",
  "nomVendeur": "ROMAIN DENIS",
  "marque": "VO",
  "jour": "2026-06-12",
  "creneau": "15:00-16:00",
  "client": "Lopez-lage Sandero"
 },
 {
  "site": "VI",
  "nomVendeur": "ALEXANDRE CHAVIGNON",
  "marque": "DACIA",
  "jour": "2026-06-11",
  "creneau": "09:00-10:00",
  "client": "DEPLACE"
 },
 {
  "site": "VI",
  "nomVendeur": "ALEXANDRE CHAVIGNON",
  "marque": "DACIA",
  "jour": "2026-06-12",
  "creneau": "09:00-10:00",
  "client": "OCTAVE"
 },
 {
  "site": "VI",
  "nomVendeur": "ALEXANDRE CHAVIGNON",
  "marque": "DACIA",
  "jour": "2026-06-13",
  "creneau": "09:00-10:00",
  "client": "MACE"
 },
 {
  "site": "VI",
  "nomVendeur": "ALEXANDRE CHAVIGNON",
  "marque": "DACIA",
  "jour": "2026-06-14",
  "creneau": "09:00-10:00",
  "client": "DIOT"
 },
 {
  "site": "VI",
  "nomVendeur": "ALEXANDRE CHAVIGNON",
  "marque": "DACIA",
  "jour": "2026-06-11",
  "creneau": "10:00-11:00",
  "client": "NAJEAN"
 },
 {
  "site": "VI",
  "nomVendeur": "ALEXANDRE CHAVIGNON",
  "marque": "DACIA",
  "jour": "2026-06-12",
  "creneau": "10:00-11:00",
  "client": "PERROUX"
 },
 {
  "site": "VI",
  "nomVendeur": "ALEXANDRE CHAVIGNON",
  "marque": "DACIA",
  "jour": "2026-06-11",
  "creneau": "11:00-12:00",
  "client": "RACAT"
 },
 {
  "site": "VI",
  "nomVendeur": "ALEXANDRE CHAVIGNON",
  "marque": "DACIA",
  "jour": "2026-06-11",
  "creneau": "14:00-15:00",
  "client": "MECHIN"
 },
 {
  "site": "VI",
  "nomVendeur": "ALEXANDRE CHAVIGNON",
  "marque": "DACIA",
  "jour": "2026-06-12",
  "creneau": "14:00-15:00",
  "client": "M LORQUIN"
 },
 {
  "site": "VI",
  "nomVendeur": "ALEXANDRE CHAVIGNON",
  "marque": "DACIA",
  "jour": "2026-06-13",
  "creneau": "14:00-15:00",
  "client": "M BEAUDRON"
 },
 {
  "site": "VI",
  "nomVendeur": "ALEXANDRE CHAVIGNON",
  "marque": "DACIA",
  "jour": "2026-06-14",
  "creneau": "17:00-18:00",
  "client": "MERCIER"
 },
 {
  "site": "VI",
  "nomVendeur": "MICHEL GUILLERM",
  "marque": "DACIA",
  "jour": "2026-06-11",
  "creneau": "09:00-10:00",
  "client": "BIGOT"
 },
 {
  "site": "VI",
  "nomVendeur": "MICHEL GUILLERM",
  "marque": "DACIA",
  "jour": "2026-06-12",
  "creneau": "09:00-10:00",
  "client": "BUTLER"
 },
 {
  "site": "VI",
  "nomVendeur": "MICHEL GUILLERM",
  "marque": "DACIA",
  "jour": "2026-06-13",
  "creneau": "09:00-10:00",
  "client": "RIBES PAPA"
 },
 {
  "site": "VI",
  "nomVendeur": "MICHEL GUILLERM",
  "marque": "DACIA",
  "jour": "2026-06-14",
  "creneau": "09:00-10:00",
  "client": "LECLERC"
 },
 {
  "site": "VI",
  "nomVendeur": "MICHEL GUILLERM",
  "marque": "DACIA",
  "jour": "2026-06-15",
  "creneau": "09:00-10:00",
  "client": "DESCHAMPS"
 },
 {
  "site": "VI",
  "nomVendeur": "MICHEL GUILLERM",
  "marque": "DACIA",
  "jour": "2026-06-12",
  "creneau": "10:00-11:00",
  "client": "STANITTA"
 },
 {
  "site": "VI",
  "nomVendeur": "MICHEL GUILLERM",
  "marque": "DACIA",
  "jour": "2026-06-13",
  "creneau": "10:00-11:00",
  "client": "RIBES MAMAN"
 },
 {
  "site": "VI",
  "nomVendeur": "MICHEL GUILLERM",
  "marque": "DACIA",
  "jour": "2026-06-11",
  "creneau": "11:00-12:00",
  "client": "FERBOS"
 },
 {
  "site": "VI",
  "nomVendeur": "MICHEL GUILLERM",
  "marque": "DACIA",
  "jour": "2026-06-13",
  "creneau": "11:00-12:00",
  "client": "RIBES FILLE"
 },
 {
  "site": "VI",
  "nomVendeur": "MICHEL GUILLERM",
  "marque": "DACIA",
  "jour": "2026-06-11",
  "creneau": "14:00-15:00",
  "client": "COULPIER"
 },
 {
  "site": "VI",
  "nomVendeur": "MICHEL GUILLERM",
  "marque": "DACIA",
  "jour": "2026-06-12",
  "creneau": "14:00-15:00",
  "client": "DUBUSSET"
 },
 {
  "site": "VI",
  "nomVendeur": "MICHEL GUILLERM",
  "marque": "DACIA",
  "jour": "2026-06-13",
  "creneau": "14:00-15:00",
  "client": "FERREIRA"
 },
 {
  "site": "VI",
  "nomVendeur": "MICHEL GUILLERM",
  "marque": "DACIA",
  "jour": "2026-06-14",
  "creneau": "14:00-15:00",
  "client": "MAYER"
 },
 {
  "site": "VI",
  "nomVendeur": "MICHEL GUILLERM",
  "marque": "DACIA",
  "jour": "2026-06-11",
  "creneau": "16:00-17:00",
  "client": "GUILLOT"
 },
 {
  "site": "VI",
  "nomVendeur": "MICHEL GUILLERM",
  "marque": "DACIA",
  "jour": "2026-06-12",
  "creneau": "16:00-17:00",
  "client": "VASSAL"
 },
 {
  "site": "VI",
  "nomVendeur": "MICHEL GUILLERM",
  "marque": "DACIA",
  "jour": "2026-06-11",
  "creneau": "17:00-18:00",
  "client": "LECOIN"
 },
 {
  "site": "VI",
  "nomVendeur": "MICHEL GUILLERM",
  "marque": "DACIA",
  "jour": "2026-06-12",
  "creneau": "17:00-18:00",
  "client": "LAFONT GAGNIERE"
 },
 {
  "site": "VI",
  "nomVendeur": "MICHEL GUILLERM",
  "marque": "DACIA",
  "jour": "2026-06-12",
  "creneau": "18:00-19:00",
  "client": "SIMONET"
 },
 {
  "site": "VI",
  "nomVendeur": "ALEXANDRE DIOT",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "09:00-10:00",
  "client": "M ODIN"
 },
 {
  "site": "VI",
  "nomVendeur": "ALEXANDRE DIOT",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "09:00-10:00",
  "client": "M VILLE"
 },
 {
  "site": "VI",
  "nomVendeur": "ALEXANDRE DIOT",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "09:00-10:00",
  "client": "GARDETTE"
 },
 {
  "site": "VI",
  "nomVendeur": "ALEXANDRE DIOT",
  "marque": "RENAULT",
  "jour": "2026-06-14",
  "creneau": "09:00-10:00",
  "client": "TRAFARSKI"
 },
 {
  "site": "VI",
  "nomVendeur": "ALEXANDRE DIOT",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "10:00-11:00",
  "client": "MUYARD"
 },
 {
  "site": "VI",
  "nomVendeur": "ALEXANDRE DIOT",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "10:00-11:00",
  "client": "RIGAUDIAS"
 },
 {
  "site": "VI",
  "nomVendeur": "ALEXANDRE DIOT",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "10:00-11:00",
  "client": "THOUVENET"
 },
 {
  "site": "VI",
  "nomVendeur": "ALEXANDRE DIOT",
  "marque": "RENAULT",
  "jour": "2026-06-14",
  "creneau": "10:00-11:00",
  "client": "BAL"
 },
 {
  "site": "VI",
  "nomVendeur": "ALEXANDRE DIOT",
  "marque": "RENAULT",
  "jour": "2026-06-15",
  "creneau": "10:00-11:00",
  "client": "COURTOIS"
 },
 {
  "site": "VI",
  "nomVendeur": "ALEXANDRE DIOT",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "11:00-12:00",
  "client": "PUCCPCCI"
 },
 {
  "site": "VI",
  "nomVendeur": "ALEXANDRE DIOT",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "11:00-12:00",
  "client": "M TROTIN"
 },
 {
  "site": "VI",
  "nomVendeur": "ALEXANDRE DIOT",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "11:00-12:00",
  "client": "BUVAT"
 },
 {
  "site": "VI",
  "nomVendeur": "ALEXANDRE DIOT",
  "marque": "RENAULT",
  "jour": "2026-06-14",
  "creneau": "11:00-12:00",
  "client": "STONS"
 },
 {
  "site": "VI",
  "nomVendeur": "ALEXANDRE DIOT",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "12:00-13:00",
  "client": "M GENESTE"
 },
 {
  "site": "VI",
  "nomVendeur": "ALEXANDRE DIOT",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "14:00-15:00",
  "client": "LOMBARD"
 },
 {
  "site": "VI",
  "nomVendeur": "ALEXANDRE DIOT",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "14:00-15:00",
  "client": "GONCALVES"
 },
 {
  "site": "VI",
  "nomVendeur": "ALEXANDRE DIOT",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "14:00-15:00",
  "client": "PAGES"
 },
 {
  "site": "VI",
  "nomVendeur": "ALEXANDRE DIOT",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "15:00-16:00",
  "client": "DAVID"
 },
 {
  "site": "VI",
  "nomVendeur": "ALEXANDRE DIOT",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "15:00-16:00",
  "client": "FARRET"
 },
 {
  "site": "VI",
  "nomVendeur": "ALEXANDRE DIOT",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "16:00-17:00",
  "client": "DECORAY"
 },
 {
  "site": "VI",
  "nomVendeur": "ALEXANDRE DIOT",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "16:00-17:00",
  "client": "M RIESEN"
 },
 {
  "site": "VI",
  "nomVendeur": "ALEXANDRE DIOT",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "16:00-17:00",
  "client": "JEUDI"
 },
 {
  "site": "VI",
  "nomVendeur": "ALEXANDRE DIOT",
  "marque": "RENAULT",
  "jour": "2026-06-14",
  "creneau": "16:00-17:00",
  "client": "M RIGAUDIAS"
 },
 {
  "site": "VI",
  "nomVendeur": "ALEXANDRE DIOT",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "17:00-18:00",
  "client": "M HENRIOT"
 },
 {
  "site": "VI",
  "nomVendeur": "ALEXANDRE DIOT",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "17:00-18:00",
  "client": "LE VAN"
 },
 {
  "site": "VI",
  "nomVendeur": "ALEXANDRE DIOT",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "17:00-18:00",
  "client": "BOUILLERAND"
 },
 {
  "site": "VI",
  "nomVendeur": "ALEXANDRE DIOT",
  "marque": "RENAULT",
  "jour": "2026-06-15",
  "creneau": "17:00-18:00",
  "client": "MAITRIAS"
 },
 {
  "site": "VI",
  "nomVendeur": "ALEXANDRE DIOT",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "18:00-19:00",
  "client": "CHARLIEU"
 },
 {
  "site": "VI",
  "nomVendeur": "ALEXANDRE DIOT",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "18:00-19:00",
  "client": "ALLIGIER"
 },
 {
  "site": "VI",
  "nomVendeur": "ALEXANDRE DIOT",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "18:00-19:00",
  "client": "M ROUSSEL"
 },
 {
  "site": "VI",
  "nomVendeur": "DYLAN MEYRIAL",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "09:00-10:00",
  "client": "DUJARDIN"
 },
 {
  "site": "VI",
  "nomVendeur": "DYLAN MEYRIAL",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "09:00-10:00",
  "client": "LEDOUX"
 },
 {
  "site": "VI",
  "nomVendeur": "DYLAN MEYRIAL",
  "marque": "RENAULT",
  "jour": "2026-06-15",
  "creneau": "09:00-10:00",
  "client": "BELVEDERE"
 },
 {
  "site": "VI",
  "nomVendeur": "DYLAN MEYRIAL",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "10:00-11:00",
  "client": "MOREL"
 },
 {
  "site": "VI",
  "nomVendeur": "DYLAN MEYRIAL",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "10:00-11:00",
  "client": "WEIDELICH"
 },
 {
  "site": "VI",
  "nomVendeur": "DYLAN MEYRIAL",
  "marque": "RENAULT",
  "jour": "2026-06-14",
  "creneau": "10:00-11:00",
  "client": "BRANCHI"
 },
 {
  "site": "VI",
  "nomVendeur": "DYLAN MEYRIAL",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "11:00-12:00",
  "client": "BERNARD ALPINE 290"
 },
 {
  "site": "VI",
  "nomVendeur": "DYLAN MEYRIAL",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "11:00-12:00",
  "client": "DEBUSSY"
 },
 {
  "site": "VI",
  "nomVendeur": "DYLAN MEYRIAL",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "11:00-12:00",
  "client": "TETU"
 },
 {
  "site": "VI",
  "nomVendeur": "DYLAN MEYRIAL",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "15:00-16:00",
  "client": "LETIZIA"
 },
 {
  "site": "VI",
  "nomVendeur": "DYLAN MEYRIAL",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "15:00-16:00",
  "client": "JOUFFRE"
 },
 {
  "site": "VI",
  "nomVendeur": "DYLAN MEYRIAL",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "15:00-16:00",
  "client": "EVEILLAU"
 },
 {
  "site": "VI",
  "nomVendeur": "DYLAN MEYRIAL",
  "marque": "RENAULT",
  "jour": "2026-06-14",
  "creneau": "15:00-16:00",
  "client": "BEAUDEAN"
 },
 {
  "site": "VI",
  "nomVendeur": "DYLAN MEYRIAL",
  "marque": "RENAULT",
  "jour": "2026-06-14",
  "creneau": "16:00-17:00",
  "client": "KOUDOUGOU"
 },
 {
  "site": "VI",
  "nomVendeur": "DYLAN MEYRIAL",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "17:00-18:00",
  "client": "BEAUMET"
 },
 {
  "site": "VI",
  "nomVendeur": "DYLAN MEYRIAL",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "17:00-18:00",
  "client": "DUPRE"
 },
 {
  "site": "VI",
  "nomVendeur": "DYLAN MEYRIAL",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "17:00-18:00",
  "client": "MECHIN"
 },
 {
  "site": "VI",
  "nomVendeur": "DYLAN MEYRIAL",
  "marque": "RENAULT",
  "jour": "2026-06-15",
  "creneau": "17:00-18:00",
  "client": "GUILLON"
 },
 {
  "site": "VI",
  "nomVendeur": "DYLAN MEYRIAL",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "18:00-19:00",
  "client": "IMBERDIS PAPA"
 },
 {
  "site": "VI",
  "nomVendeur": "DYLAN MEYRIAL",
  "marque": "DACIA",
  "jour": "2026-06-12",
  "creneau": "08:00-09:00",
  "client": "IMBERDI FILLE"
 },
 {
  "site": "VI",
  "nomVendeur": "YOANN TRIBOULET",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "08:00-09:00",
  "client": "REGNY"
 },
 {
  "site": "VI",
  "nomVendeur": "YOANN TRIBOULET",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "08:00-09:00",
  "client": "DURANTET"
 },
 {
  "site": "VI",
  "nomVendeur": "YOANN TRIBOULET",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "09:00-10:00",
  "client": "AMIGO"
 },
 {
  "site": "VI",
  "nomVendeur": "YOANN TRIBOULET",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "10:00-11:00",
  "client": "GLADINE"
 },
 {
  "site": "VI",
  "nomVendeur": "YOANN TRIBOULET",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "10:00-11:00",
  "client": "TALABARD"
 },
 {
  "site": "VI",
  "nomVendeur": "YOANN TRIBOULET",
  "marque": "RENAULT",
  "jour": "2026-06-14",
  "creneau": "10:00-11:00",
  "client": "CARRICO"
 },
 {
  "site": "VI",
  "nomVendeur": "YOANN TRIBOULET",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "11:00-12:00",
  "client": "BUTEY"
 },
 {
  "site": "VI",
  "nomVendeur": "YOANN TRIBOULET",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "14:00-15:00",
  "client": "DOCHEZ"
 },
 {
  "site": "VI",
  "nomVendeur": "YOANN TRIBOULET",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "14:00-15:00",
  "client": "MARTIN"
 },
 {
  "site": "VI",
  "nomVendeur": "YOANN TRIBOULET",
  "marque": "RENAULT",
  "jour": "2026-06-14",
  "creneau": "14:00-15:00",
  "client": "SOPHIE"
 },
 {
  "site": "VI",
  "nomVendeur": "YOANN TRIBOULET",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "16:00-17:00",
  "client": "GOUGAT"
 },
 {
  "site": "VI",
  "nomVendeur": "YOANN TRIBOULET",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "17:00-18:00",
  "client": "GUERET"
 },
 {
  "site": "VI",
  "nomVendeur": "YOANN TRIBOULET",
  "marque": "RENAULT",
  "jour": "2026-06-14",
  "creneau": "17:00-18:00",
  "client": "REVENU"
 },
 {
  "site": "VI",
  "nomVendeur": "MATTIS BONNAMOUR",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "09:00-10:00",
  "client": "BERTHAULT"
 },
 {
  "site": "VI",
  "nomVendeur": "MATTIS BONNAMOUR",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "10:00-11:00",
  "client": "MEGE"
 },
 {
  "site": "VI",
  "nomVendeur": "MATTIS BONNAMOUR",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "10:00-11:00",
  "client": "DURANTET"
 },
 {
  "site": "VI",
  "nomVendeur": "MATTIS BONNAMOUR",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "11:00-12:00",
  "client": "JANIQUE"
 },
 {
  "site": "VI",
  "nomVendeur": "MATTIS BONNAMOUR",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "15:00-16:00",
  "client": "LEMAITRE"
 },
 {
  "site": "VI",
  "nomVendeur": "MATTIS BONNAMOUR",
  "marque": "RENAULT",
  "jour": "2026-06-14",
  "creneau": "15:00-16:00",
  "client": "PORTTIN"
 },
 {
  "site": "VI",
  "nomVendeur": "MATTIS BONNAMOUR",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "16:00-17:00",
  "client": "VLACH"
 },
 {
  "site": "VI",
  "nomVendeur": "MATTIS BONNAMOUR",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "16:00-17:00",
  "client": "SOCOL"
 },
 {
  "site": "VI",
  "nomVendeur": "MATTIS BONNAMOUR",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "17:00-18:00",
  "client": "ROTTAT"
 },
 {
  "site": "VI",
  "nomVendeur": "CLÉMENT JACQUET",
  "marque": "VO",
  "jour": "2026-06-11",
  "creneau": "09:00-10:00",
  "client": "DAPZOL"
 },
 {
  "site": "VI",
  "nomVendeur": "CLÉMENT JACQUET",
  "marque": "VO",
  "jour": "2026-06-12",
  "creneau": "09:00-10:00",
  "client": "LABUSSIERE"
 },
 {
  "site": "VI",
  "nomVendeur": "CLÉMENT JACQUET",
  "marque": "VO",
  "jour": "2026-06-14",
  "creneau": "09:00-10:00",
  "client": "DAMPURE"
 },
 {
  "site": "VI",
  "nomVendeur": "CLÉMENT JACQUET",
  "marque": "VO",
  "jour": "2026-06-12",
  "creneau": "14:00-15:00",
  "client": "CASILE"
 },
 {
  "site": "VI",
  "nomVendeur": "CLÉMENT JACQUET",
  "marque": "VO",
  "jour": "2026-06-15",
  "creneau": "14:00-15:00",
  "client": "PROVOST"
 },
 {
  "site": "VI",
  "nomVendeur": "CLÉMENT JACQUET",
  "marque": "VO",
  "jour": "2026-06-13",
  "creneau": "16:00-17:00",
  "client": "ALIGIER"
 },
 {
  "site": "VI",
  "nomVendeur": "CLÉMENT JACQUET",
  "marque": "VO",
  "jour": "2026-06-11",
  "creneau": "17:00-18:00",
  "client": "CHANTELOUP"
 },
 {
  "site": "VI",
  "nomVendeur": "CLÉMENT JACQUET",
  "marque": "VO",
  "jour": "2026-06-12",
  "creneau": "18:00-19:00",
  "client": "MILLER"
 },
 {
  "site": "VI",
  "nomVendeur": "ROMARIC RAMBERT",
  "marque": "VO",
  "jour": "2026-06-11",
  "creneau": "10:00-11:00",
  "client": "HEDOO"
 },
 {
  "site": "VI",
  "nomVendeur": "ROMARIC RAMBERT",
  "marque": "VO",
  "jour": "2026-06-13",
  "creneau": "10:00-11:00",
  "client": "LAGACHE"
 },
 {
  "site": "VI",
  "nomVendeur": "ROMARIC RAMBERT",
  "marque": "VO",
  "jour": "2026-06-14",
  "creneau": "11:00-12:00",
  "client": "BONJEAN"
 },
 {
  "site": "VI",
  "nomVendeur": "ROMARIC RAMBERT",
  "marque": "VO",
  "jour": "2026-06-11",
  "creneau": "15:00-16:00",
  "client": "LEDENTU"
 },
 {
  "site": "VI",
  "nomVendeur": "ROMARIC RAMBERT",
  "marque": "VO",
  "jour": "2026-06-14",
  "creneau": "15:00-16:00",
  "client": "ETIENNE"
 },
 {
  "site": "VI",
  "nomVendeur": "CLÉMENT RAYA",
  "marque": "VO",
  "jour": "2026-06-13",
  "creneau": "09:00-10:00",
  "client": "GABARD"
 },
 {
  "site": "VI",
  "nomVendeur": "CLÉMENT RAYA",
  "marque": "VO",
  "jour": "2026-06-14",
  "creneau": "10:00-11:00",
  "client": "DENNE"
 },
 {
  "site": "VI",
  "nomVendeur": "CLÉMENT RAYA",
  "marque": "VO",
  "jour": "2026-06-13",
  "creneau": "11:00-12:00",
  "client": "VEYNE"
 },
 {
  "site": "VI",
  "nomVendeur": "CLÉMENT RAYA",
  "marque": "VO",
  "jour": "2026-06-13",
  "creneau": "14:00-15:00",
  "client": "EYMARD"
 },
 {
  "site": "VI",
  "nomVendeur": "CLÉMENT RAYA",
  "marque": "VO",
  "jour": "2026-06-14",
  "creneau": "15:00-16:00",
  "client": "HUSSAR"
 },
 {
  "site": "VI",
  "nomVendeur": "CLÉMENT RAYA",
  "marque": "VO",
  "jour": "2026-06-12",
  "creneau": "16:00-17:00",
  "client": "TOUREAU"
 },
 {
  "site": "VI",
  "nomVendeur": "CLÉMENT RAYA",
  "marque": "VO",
  "jour": "2026-06-13",
  "creneau": "16:00-17:00",
  "client": "BELOT"
 },
 {
  "site": "VI",
  "nomVendeur": "CLÉMENT RAYA",
  "marque": "VO",
  "jour": "2026-06-15",
  "creneau": "16:00-17:00",
  "client": "NAVARRE"
 },
 {
  "site": "VI",
  "nomVendeur": "CLÉMENT RAYA",
  "marque": "VO",
  "jour": "2026-06-11",
  "creneau": "17:00-18:00",
  "client": "PATON"
 },
 {
  "site": "TH",
  "nomVendeur": "LOUIS DUBOST",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "08:00-09:00",
  "client": "Absent"
 },
 {
  "site": "TH",
  "nomVendeur": "LOUIS DUBOST",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "09:00-10:00",
  "client": "M Languedoc"
 },
 {
  "site": "TH",
  "nomVendeur": "LOUIS DUBOST",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "11:00-12:00",
  "client": "M Crohas"
 },
 {
  "site": "TH",
  "nomVendeur": "LOUIS DUBOST",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "18:00-19:00",
  "client": "M Massimino"
 },
 {
  "site": "TH",
  "nomVendeur": "LOUIS DUBOST",
  "marque": "DACIA",
  "jour": "2026-06-12",
  "creneau": "09:00-10:00",
  "client": "M Legay"
 },
 {
  "site": "TH",
  "nomVendeur": "CYNTHIA VALLIN",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "09:00-10:00",
  "client": "M Gardes"
 },
 {
  "site": "TH",
  "nomVendeur": "CYNTHIA VALLIN",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "09:00-10:00",
  "client": "Thiers"
 },
 {
  "site": "TH",
  "nomVendeur": "CYNTHIA VALLIN",
  "marque": "RENAULT",
  "jour": "2026-06-15",
  "creneau": "09:00-10:00",
  "client": "M Pasquet"
 },
 {
  "site": "TH",
  "nomVendeur": "CYNTHIA VALLIN",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "10:00-11:00",
  "client": "M Fayolle"
 },
 {
  "site": "TH",
  "nomVendeur": "CYNTHIA VALLIN",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "11:00-12:00",
  "client": "Fouillot"
 },
 {
  "site": "TH",
  "nomVendeur": "CYNTHIA VALLIN",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "15:00-16:00",
  "client": "Derbias"
 },
 {
  "site": "TH",
  "nomVendeur": "CYNTHIA VALLIN",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "16:00-17:00",
  "client": "Chouvel"
 },
 {
  "site": "TH",
  "nomVendeur": "CYNTHIA VALLIN",
  "marque": "DACIA",
  "jour": "2026-06-14",
  "creneau": "10:00-11:00",
  "client": "Buvat"
 },
 {
  "site": "TH",
  "nomVendeur": "CYNTHIA VALLIN",
  "marque": "DACIA",
  "jour": "2026-06-12",
  "creneau": "11:00-12:00",
  "client": "Chefdeville"
 },
 {
  "site": "TH",
  "nomVendeur": "CYNTHIA VALLIN",
  "marque": "DACIA",
  "jour": "2026-06-11",
  "creneau": "14:00-15:00",
  "client": "M Gouttetoque"
 },
 {
  "site": "TH",
  "nomVendeur": "CYNTHIA VALLIN",
  "marque": "DACIA",
  "jour": "2026-06-13",
  "creneau": "14:00-15:00",
  "client": "Culpo"
 },
 {
  "site": "TH",
  "nomVendeur": "AXEL DUMONT",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "09:00-10:00",
  "client": "M Roccetto"
 },
 {
  "site": "TH",
  "nomVendeur": "AXEL DUMONT",
  "marque": "RENAULT",
  "jour": "2026-06-14",
  "creneau": "09:00-10:00",
  "client": "M Dartois"
 },
 {
  "site": "TH",
  "nomVendeur": "AXEL DUMONT",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "10:00-11:00",
  "client": "M Gentil"
 },
 {
  "site": "TH",
  "nomVendeur": "AXEL DUMONT",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "10:00-11:00",
  "client": "M Haverland"
 },
 {
  "site": "TH",
  "nomVendeur": "AXEL DUMONT",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "10:00-11:00",
  "client": "M Goutefangheas"
 },
 {
  "site": "TH",
  "nomVendeur": "AXEL DUMONT",
  "marque": "RENAULT",
  "jour": "2026-06-14",
  "creneau": "10:00-11:00",
  "client": "M Mathe"
 },
 {
  "site": "TH",
  "nomVendeur": "AXEL DUMONT",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "14:00-15:00",
  "client": "M Arnaud"
 },
 {
  "site": "TH",
  "nomVendeur": "AXEL DUMONT",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "14:00-15:00",
  "client": "Mme Bonnal"
 },
 {
  "site": "TH",
  "nomVendeur": "AXEL DUMONT",
  "marque": "RENAULT",
  "jour": "2026-06-14",
  "creneau": "14:00-15:00",
  "client": "M Raymond"
 },
 {
  "site": "TH",
  "nomVendeur": "AXEL DUMONT",
  "marque": "RENAULT",
  "jour": "2026-06-15",
  "creneau": "14:00-15:00",
  "client": "M Privat"
 },
 {
  "site": "TH",
  "nomVendeur": "AXEL DUMONT",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "15:00-16:00",
  "client": "M Escailler"
 },
 {
  "site": "TH",
  "nomVendeur": "AXEL DUMONT",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "15:00-16:00",
  "client": "M Couturier"
 },
 {
  "site": "TH",
  "nomVendeur": "AXEL DUMONT",
  "marque": "RENAULT",
  "jour": "2026-06-14",
  "creneau": "15:00-16:00",
  "client": "M Roche"
 },
 {
  "site": "TH",
  "nomVendeur": "AXEL DUMONT",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "17:00-18:00",
  "client": "M Ferrier"
 },
 {
  "site": "TH",
  "nomVendeur": "AXEL DUMONT",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "18:00-19:00",
  "client": "Mme Mazellier"
 },
 {
  "site": "TH",
  "nomVendeur": "DAMIEN DAGOSTINO",
  "marque": "VO",
  "jour": "2026-06-14",
  "creneau": "09:00-10:00",
  "client": "M Perrin"
 },
 {
  "site": "TH",
  "nomVendeur": "DAMIEN DAGOSTINO",
  "marque": "VO",
  "jour": "2026-06-11",
  "creneau": "10:00-11:00",
  "client": "M Monteilhet"
 },
 {
  "site": "TH",
  "nomVendeur": "DAMIEN DAGOSTINO",
  "marque": "VO",
  "jour": "2026-06-14",
  "creneau": "15:00-16:00",
  "client": "M Pousset"
 },
 {
  "site": "TH",
  "nomVendeur": "DAMIEN DAGOSTINO",
  "marque": "VO",
  "jour": "2026-06-11",
  "creneau": "18:00-19:00",
  "client": "M Gomez"
 },
 {
  "site": "TH",
  "nomVendeur": "ALEXANDRE PINOT",
  "marque": "VO",
  "jour": "2026-06-14",
  "creneau": "08:00-09:00",
  "client": "absent"
 },
 {
  "site": "TH",
  "nomVendeur": "ALEXANDRE PINOT",
  "marque": "VO",
  "jour": "2026-06-13",
  "creneau": "09:00-10:00",
  "client": "M Roussillon"
 },
 {
  "site": "TH",
  "nomVendeur": "ALEXANDRE PINOT",
  "marque": "VO",
  "jour": "2026-06-11",
  "creneau": "10:00-11:00",
  "client": "M Montpetroux"
 },
 {
  "site": "TH",
  "nomVendeur": "ALEXANDRE PINOT",
  "marque": "VO",
  "jour": "2026-06-12",
  "creneau": "10:00-11:00",
  "client": "M Delbege"
 },
 {
  "site": "TH",
  "nomVendeur": "ALEXANDRE PINOT",
  "marque": "VO",
  "jour": "2026-06-13",
  "creneau": "10:00-11:00",
  "client": "M Plazenet"
 },
 {
  "site": "TH",
  "nomVendeur": "ALEXANDRE PINOT",
  "marque": "VO",
  "jour": "2026-06-13",
  "creneau": "11:00-12:00",
  "client": "M Montereal"
 },
 {
  "site": "TH",
  "nomVendeur": "ALEXANDRE PINOT",
  "marque": "VO",
  "jour": "2026-06-11",
  "creneau": "14:00-15:00",
  "client": "M Leudir"
 },
 {
  "site": "TH",
  "nomVendeur": "ALEXANDRE PINOT",
  "marque": "VO",
  "jour": "2026-06-11",
  "creneau": "15:00-16:00",
  "client": "M Borel"
 },
 {
  "site": "TH",
  "nomVendeur": "ALEXANDRE PINOT",
  "marque": "VO",
  "jour": "2026-06-12",
  "creneau": "15:00-16:00",
  "client": "M Brugas"
 },
 {
  "site": "TH",
  "nomVendeur": "ALEXANDRE PINOT",
  "marque": "VO",
  "jour": "2026-06-11",
  "creneau": "16:00-17:00",
  "client": "M Nicolas"
 },
 {
  "site": "TH",
  "nomVendeur": "ALEXANDRE PINOT",
  "marque": "VO",
  "jour": "2026-06-11",
  "creneau": "17:00-18:00",
  "client": "M Barge"
 },
 {
  "site": "TH",
  "nomVendeur": "ALEXANDRE PINOT",
  "marque": "VO",
  "jour": "2026-06-12",
  "creneau": "17:00-18:00",
  "client": "M Poquet"
 },
 {
  "site": "ISS",
  "nomVendeur": "YOANN PICARD",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "09:00-10:00",
  "client": "Mr DOUIX"
 },
 {
  "site": "ISS",
  "nomVendeur": "YOANN PICARD",
  "marque": "RENAULT",
  "jour": "2026-06-14",
  "creneau": "10:00-11:00",
  "client": "Mme DEGOUDE"
 },
 {
  "site": "ISS",
  "nomVendeur": "YOANN PICARD",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "11:00-12:00",
  "client": "Mme PALKHIVALA"
 },
 {
  "site": "ISS",
  "nomVendeur": "YOANN PICARD",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "14:00-15:00",
  "client": "JEANNNOT"
 },
 {
  "site": "ISS",
  "nomVendeur": "YOANN PICARD",
  "marque": "RENAULT",
  "jour": "2026-06-14",
  "creneau": "14:00-15:00",
  "client": "MmeTAMAGNI"
 },
 {
  "site": "ISS",
  "nomVendeur": "YOANN PICARD",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "15:00-16:00",
  "client": "Mme APTEL"
 },
 {
  "site": "ISS",
  "nomVendeur": "YOANN PICARD",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "15:00-16:00",
  "client": "GROLIERE"
 },
 {
  "site": "ISS",
  "nomVendeur": "YOANN PICARD",
  "marque": "RENAULT",
  "jour": "2026-06-14",
  "creneau": "16:00-17:00",
  "client": "Mme MORVAN"
 },
 {
  "site": "ISS",
  "nomVendeur": "YOANN PICARD",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "17:00-18:00",
  "client": "Mme VALENTE"
 },
 {
  "site": "ISS",
  "nomVendeur": "YOANN PICARD",
  "marque": "DACIA",
  "jour": "2026-06-14",
  "creneau": "15:00-16:00",
  "client": "Mme RODIER"
 },
 {
  "site": "ISS",
  "nomVendeur": "STANISLAS RODAMEL",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "10:00-11:00",
  "client": "ROBILLON"
 },
 {
  "site": "ISS",
  "nomVendeur": "STANISLAS RODAMEL",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "11:00-12:00",
  "client": "PINET"
 },
 {
  "site": "ISS",
  "nomVendeur": "STANISLAS RODAMEL",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "15:00-16:00",
  "client": "DUMAS"
 },
 {
  "site": "ISS",
  "nomVendeur": "STANISLAS RODAMEL",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "15:00-16:00",
  "client": "ABOU SAMRA"
 },
 {
  "site": "ISS",
  "nomVendeur": "STANISLAS RODAMEL",
  "marque": "RENAULT",
  "jour": "2026-06-14",
  "creneau": "15:00-16:00",
  "client": "DELORME"
 },
 {
  "site": "ISS",
  "nomVendeur": "STANISLAS RODAMEL",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "17:00-18:00",
  "client": "GARTILLON"
 },
 {
  "site": "ISS",
  "nomVendeur": "STANISLAS RODAMEL",
  "marque": "DACIA",
  "jour": "2026-06-14",
  "creneau": "10:00-11:00",
  "client": "DELBOS"
 },
 {
  "site": "ISS",
  "nomVendeur": "STANISLAS RODAMEL",
  "marque": "DACIA",
  "jour": "2026-06-13",
  "creneau": "11:00-12:00",
  "client": "SAUVESTRE"
 },
 {
  "site": "ISS",
  "nomVendeur": "STANISLAS RODAMEL",
  "marque": "DACIA",
  "jour": "2026-06-13",
  "creneau": "14:00-15:00",
  "client": "FIORENTINO"
 },
 {
  "site": "ISS",
  "nomVendeur": "STANISLAS RODAMEL",
  "marque": "DACIA",
  "jour": "2026-06-11",
  "creneau": "15:00-16:00",
  "client": "HALLIROL"
 },
 {
  "site": "ISS",
  "nomVendeur": "STANISLAS RODAMEL",
  "marque": "DACIA",
  "jour": "2026-06-11",
  "creneau": "16:00-17:00",
  "client": "COMPTE"
 },
 {
  "site": "ISS",
  "nomVendeur": "STANISLAS RODAMEL",
  "marque": "DACIA",
  "jour": "2026-06-12",
  "creneau": "16:00-17:00",
  "client": "DALBE"
 },
 {
  "site": "ISS",
  "nomVendeur": "STANISLAS RODAMEL",
  "marque": "DACIA",
  "jour": "2026-06-13",
  "creneau": "16:00-17:00",
  "client": "CONTOUX"
 },
 {
  "site": "ISS",
  "nomVendeur": "STANISLAS RODAMEL",
  "marque": "DACIA",
  "jour": "2026-06-11",
  "creneau": "17:00-18:00",
  "client": "BELLY"
 },
 {
  "site": "ISS",
  "nomVendeur": "MAGALI MICHEL",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "08:00-09:00",
  "client": "Mme BERTRAND"
 },
 {
  "site": "ISS",
  "nomVendeur": "MAGALI MICHEL",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "09:00-10:00",
  "client": "Mr MORAND"
 },
 {
  "site": "ISS",
  "nomVendeur": "MAGALI MICHEL",
  "marque": "RENAULT",
  "jour": "2026-06-14",
  "creneau": "11:00-12:00",
  "client": "Mr FOURNIER"
 },
 {
  "site": "ISS",
  "nomVendeur": "MAGALI MICHEL",
  "marque": "RENAULT",
  "jour": "2026-06-14",
  "creneau": "14:00-15:00",
  "client": "BESSON"
 },
 {
  "site": "ISS",
  "nomVendeur": "MAGALI MICHEL",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "15:00-16:00",
  "client": "DEAN"
 },
 {
  "site": "ISS",
  "nomVendeur": "MAGALI MICHEL",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "18:00-19:00",
  "client": "Mr SELLIN"
 },
 {
  "site": "ISS",
  "nomVendeur": "MAGALI MICHEL",
  "marque": "DACIA",
  "jour": "2026-06-11",
  "creneau": "09:00-10:00",
  "client": "DEMANGE"
 },
 {
  "site": "ISS",
  "nomVendeur": "MAGALI MICHEL",
  "marque": "DACIA",
  "jour": "2026-06-14",
  "creneau": "09:00-10:00",
  "client": "M VIGANOTTI"
 },
 {
  "site": "ISS",
  "nomVendeur": "MAGALI MICHEL",
  "marque": "DACIA",
  "jour": "2026-06-11",
  "creneau": "11:00-12:00",
  "client": "M MOLLE"
 },
 {
  "site": "ISS",
  "nomVendeur": "MAGALI MICHEL",
  "marque": "DACIA",
  "jour": "2026-06-11",
  "creneau": "14:00-15:00",
  "client": "Mme  CROS"
 },
 {
  "site": "ISS",
  "nomVendeur": "AMÉLIE HERVÉ",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "09:00-10:00",
  "client": "MAHAUT"
 },
 {
  "site": "ISS",
  "nomVendeur": "AMÉLIE HERVÉ",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "11:00-12:00",
  "client": "CAUTAL"
 },
 {
  "site": "ISS",
  "nomVendeur": "AMÉLIE HERVÉ",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "11:00-12:00",
  "client": "JEANNOT"
 },
 {
  "site": "ISS",
  "nomVendeur": "AMÉLIE HERVÉ",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "14:00-15:00",
  "client": "LECOCALI"
 },
 {
  "site": "ISS",
  "nomVendeur": "AMÉLIE HERVÉ",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "14:00-15:00",
  "client": "RAMEL"
 },
 {
  "site": "ISS",
  "nomVendeur": "AMÉLIE HERVÉ",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "15:00-16:00",
  "client": "BRAS"
 },
 {
  "site": "ISS",
  "nomVendeur": "AMÉLIE HERVÉ",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "16:00-17:00",
  "client": "PILLON"
 },
 {
  "site": "ISS",
  "nomVendeur": "AMÉLIE HERVÉ",
  "marque": "DACIA",
  "jour": "2026-06-11",
  "creneau": "10:00-11:00",
  "client": "GIOAN"
 },
 {
  "site": "ISS",
  "nomVendeur": "AMÉLIE HERVÉ",
  "marque": "DACIA",
  "jour": "2026-06-12",
  "creneau": "10:00-11:00",
  "client": "DUPART"
 },
 {
  "site": "ISS",
  "nomVendeur": "AMÉLIE HERVÉ",
  "marque": "DACIA",
  "jour": "2026-06-13",
  "creneau": "10:00-11:00",
  "client": "MEURIE"
 },
 {
  "site": "ISS",
  "nomVendeur": "AMÉLIE HERVÉ",
  "marque": "DACIA",
  "jour": "2026-06-15",
  "creneau": "10:00-11:00",
  "client": "BRUCIAMACCHIE"
 },
 {
  "site": "ISS",
  "nomVendeur": "AMÉLIE HERVÉ",
  "marque": "DACIA",
  "jour": "2026-06-13",
  "creneau": "12:00-13:00",
  "client": "GROLIERES"
 },
 {
  "site": "ISS",
  "nomVendeur": "AMÉLIE HERVÉ",
  "marque": "DACIA",
  "jour": "2026-06-13",
  "creneau": "13:00-14:00",
  "client": "BACHAYTER"
 },
 {
  "site": "ISS",
  "nomVendeur": "AMÉLIE HERVÉ",
  "marque": "DACIA",
  "jour": "2026-06-14",
  "creneau": "14:00-15:00",
  "client": "BEABIN"
 },
 {
  "site": "ISS",
  "nomVendeur": "AMÉLIE HERVÉ",
  "marque": "DACIA",
  "jour": "2026-06-14",
  "creneau": "15:00-16:00",
  "client": "ESTRADE"
 },
 {
  "site": "ISS",
  "nomVendeur": "AMÉLIE HERVÉ",
  "marque": "DACIA",
  "jour": "2026-06-11",
  "creneau": "16:00-17:00",
  "client": "ZYMAN"
 },
 {
  "site": "ISS",
  "nomVendeur": "AMÉLIE HERVÉ",
  "marque": "DACIA",
  "jour": "2026-06-11",
  "creneau": "17:00-18:00",
  "client": "NARCE"
 },
 {
  "site": "ISS",
  "nomVendeur": "AMÉLIE HERVÉ",
  "marque": "DACIA",
  "jour": "2026-06-11",
  "creneau": "18:00-19:00",
  "client": "NARCE"
 },
 {
  "site": "ISS",
  "nomVendeur": "SÉBASTIEN DUMONT",
  "marque": "RENAULT",
  "jour": "2026-06-15",
  "creneau": "09:00-10:00",
  "client": "I"
 },
 {
  "site": "ISS",
  "nomVendeur": "SÉBASTIEN DUMONT",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "10:00-11:00",
  "client": "CROS"
 },
 {
  "site": "ISS",
  "nomVendeur": "SÉBASTIEN DUMONT",
  "marque": "RENAULT",
  "jour": "2026-06-14",
  "creneau": "10:00-11:00",
  "client": "OUDOUL"
 },
 {
  "site": "ISS",
  "nomVendeur": "SÉBASTIEN DUMONT",
  "marque": "RENAULT",
  "jour": "2026-06-14",
  "creneau": "11:00-12:00",
  "client": "DUFEUTEULE"
 },
 {
  "site": "ISS",
  "nomVendeur": "SÉBASTIEN DUMONT",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "14:00-15:00",
  "client": "CARBASSE"
 },
 {
  "site": "ISS",
  "nomVendeur": "SÉBASTIEN DUMONT",
  "marque": "RENAULT",
  "jour": "2026-06-14",
  "creneau": "15:00-16:00",
  "client": "ROCHES"
 },
 {
  "site": "ISS",
  "nomVendeur": "SÉBASTIEN DUMONT",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "17:00-18:00",
  "client": "BOUQUET"
 },
 {
  "site": "ISS",
  "nomVendeur": "SÉBASTIEN DUMONT",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "18:00-19:00",
  "client": "BOURDON"
 },
 {
  "site": "ISS",
  "nomVendeur": "SÉBASTIEN DUMONT",
  "marque": "DACIA",
  "jour": "2026-06-11",
  "creneau": "09:00-10:00",
  "client": "MEUNIER"
 },
 {
  "site": "ISS",
  "nomVendeur": "SÉBASTIEN DUMONT",
  "marque": "DACIA",
  "jour": "2026-06-12",
  "creneau": "09:00-10:00",
  "client": "HERITIER"
 },
 {
  "site": "ISS",
  "nomVendeur": "SÉBASTIEN DUMONT",
  "marque": "DACIA",
  "jour": "2026-06-13",
  "creneau": "09:00-10:00",
  "client": "ROBILLON"
 },
 {
  "site": "ISS",
  "nomVendeur": "SÉBASTIEN DUMONT",
  "marque": "DACIA",
  "jour": "2026-06-13",
  "creneau": "10:00-11:00",
  "client": "PEDRONETTO"
 },
 {
  "site": "ISS",
  "nomVendeur": "SÉBASTIEN DUMONT",
  "marque": "DACIA",
  "jour": "2026-06-13",
  "creneau": "11:00-12:00",
  "client": "MAISONNEUVE"
 },
 {
  "site": "ISS",
  "nomVendeur": "SÉBASTIEN DUMONT",
  "marque": "DACIA",
  "jour": "2026-06-11",
  "creneau": "14:00-15:00",
  "client": "TISSERAND"
 },
 {
  "site": "ISS",
  "nomVendeur": "SÉBASTIEN DUMONT",
  "marque": "DACIA",
  "jour": "2026-06-12",
  "creneau": "16:00-17:00",
  "client": "ROFFET"
 },
 {
  "site": "ISS",
  "nomVendeur": "SÉBASTIEN DUMONT",
  "marque": "DACIA",
  "jour": "2026-06-14",
  "creneau": "16:00-17:00",
  "client": "ANSELLEME"
 },
 {
  "site": "ISS",
  "nomVendeur": "REDWANE TOULOUSE",
  "marque": "VO",
  "jour": "2026-06-11",
  "creneau": "08:00-09:00",
  "client": "DAUBARD"
 },
 {
  "site": "ISS",
  "nomVendeur": "REDWANE TOULOUSE",
  "marque": "VO",
  "jour": "2026-06-12",
  "creneau": "08:00-09:00",
  "client": "TRASSOUDAINE"
 },
 {
  "site": "ISS",
  "nomVendeur": "REDWANE TOULOUSE",
  "marque": "VO",
  "jour": "2026-06-11",
  "creneau": "09:00-10:00",
  "client": "Mme DELPAGNE"
 },
 {
  "site": "ISS",
  "nomVendeur": "REDWANE TOULOUSE",
  "marque": "VO",
  "jour": "2026-06-11",
  "creneau": "10:00-11:00",
  "client": "I"
 },
 {
  "site": "ISS",
  "nomVendeur": "REDWANE TOULOUSE",
  "marque": "VO",
  "jour": "2026-06-13",
  "creneau": "10:00-11:00",
  "client": "Mme BICHERAY"
 },
 {
  "site": "ISS",
  "nomVendeur": "REDWANE TOULOUSE",
  "marque": "VO",
  "jour": "2026-06-11",
  "creneau": "14:00-15:00",
  "client": "Mme SEMBEL"
 },
 {
  "site": "ISS",
  "nomVendeur": "REDWANE TOULOUSE",
  "marque": "VO",
  "jour": "2026-06-11",
  "creneau": "08:00-09:00",
  "client": "COSTON"
 },
 {
  "site": "ISS",
  "nomVendeur": "REDWANE TOULOUSE",
  "marque": "VO",
  "jour": "2026-06-12",
  "creneau": "10:00-11:00",
  "client": "MAZET"
 },
 {
  "site": "ISS",
  "nomVendeur": "REDWANE TOULOUSE",
  "marque": "VO",
  "jour": "2026-06-13",
  "creneau": "14:00-15:00",
  "client": "MMe PARDANAUD"
 },
 {
  "site": "ISS",
  "nomVendeur": "REDWANE TOULOUSE",
  "marque": "VO",
  "jour": "2026-06-12",
  "creneau": "16:00-17:00",
  "client": "Mme GARINOT"
 },
 {
  "site": "ISS",
  "nomVendeur": "STÉPHANE DALLO-BELLESSA",
  "marque": "VO",
  "jour": "2026-06-13",
  "creneau": "10:00-11:00",
  "client": "TALLOBRE"
 },
 {
  "site": "ISS",
  "nomVendeur": "STÉPHANE DALLO-BELLESSA",
  "marque": "VO",
  "jour": "2026-06-13",
  "creneau": "14:00-15:00",
  "client": "PORTEIX"
 },
 {
  "site": "ISS",
  "nomVendeur": "STÉPHANE DALLO-BELLESSA",
  "marque": "VO",
  "jour": "2026-06-11",
  "creneau": "18:00-19:00",
  "client": "MONDILLON"
 },
 {
  "site": "ISS",
  "nomVendeur": "FRANCOIS LENAIC",
  "marque": "VO",
  "jour": "2026-06-11",
  "creneau": "09:00-10:00",
  "client": "NOUGUIER"
 },
 {
  "site": "ISS",
  "nomVendeur": "FRANCOIS LENAIC",
  "marque": "VO",
  "jour": "2026-06-13",
  "creneau": "09:00-10:00",
  "client": "PLANTIN"
 },
 {
  "site": "ISS",
  "nomVendeur": "FRANCOIS LENAIC",
  "marque": "VO",
  "jour": "2026-06-13",
  "creneau": "10:00-11:00",
  "client": "DIAS"
 },
 {
  "site": "ISS",
  "nomVendeur": "FRANCOIS LENAIC",
  "marque": "VO",
  "jour": "2026-06-11",
  "creneau": "11:00-12:00",
  "client": "DUCHER"
 },
 {
  "site": "ISS",
  "nomVendeur": "FRANCOIS LENAIC",
  "marque": "VO",
  "jour": "2026-06-11",
  "creneau": "14:00-15:00",
  "client": "PERRIN"
 },
 {
  "site": "ISS",
  "nomVendeur": "FRANCOIS LENAIC",
  "marque": "VO",
  "jour": "2026-06-13",
  "creneau": "14:00-15:00",
  "client": "BENKEMOUN"
 },
 {
  "site": "ISS",
  "nomVendeur": "FRANCOIS LENAIC",
  "marque": "VO",
  "jour": "2026-06-11",
  "creneau": "15:00-16:00",
  "client": "PRANYES"
 },
 {
  "site": "ISS",
  "nomVendeur": "FRANCOIS LENAIC",
  "marque": "VO",
  "jour": "2026-06-11",
  "creneau": "16:00-17:00",
  "client": "BREJAUD"
 },
 {
  "site": "ISS",
  "nomVendeur": "FRANCOIS LENAIC",
  "marque": "VO",
  "jour": "2026-06-11",
  "creneau": "08:00-09:00",
  "client": "ANGLADE"
 },
 {
  "site": "ISS",
  "nomVendeur": "FRANCOIS LENAIC",
  "marque": "VO",
  "jour": "2026-06-11",
  "creneau": "10:00-11:00",
  "client": "LAPELEGERIE"
 },
 {
  "site": "ISS",
  "nomVendeur": "FRANCOIS LENAIC",
  "marque": "VO",
  "jour": "2026-06-12",
  "creneau": "10:00-11:00",
  "client": "BARD"
 },
 {
  "site": "ISS",
  "nomVendeur": "FRANCOIS LENAIC",
  "marque": "VO",
  "jour": "2026-06-12",
  "creneau": "11:00-12:00",
  "client": "VANDERSUISSE"
 },
 {
  "site": "PUY",
  "nomVendeur": "ARNAUD GALLAND",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "08:00-09:00",
  "client": "DELALANDE"
 },
 {
  "site": "PUY",
  "nomVendeur": "ARNAUD GALLAND",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "09:00-10:00",
  "client": "CHABERT"
 },
 {
  "site": "PUY",
  "nomVendeur": "ARNAUD GALLAND",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "10:00-11:00",
  "client": "VIGOUROUX"
 },
 {
  "site": "PUY",
  "nomVendeur": "ARNAUD GALLAND",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "10:00-11:00",
  "client": "LYOTARD"
 },
 {
  "site": "PUY",
  "nomVendeur": "ARNAUD GALLAND",
  "marque": "RENAULT",
  "jour": "2026-06-14",
  "creneau": "10:00-11:00",
  "client": "VILLESECHE"
 },
 {
  "site": "PUY",
  "nomVendeur": "ARNAUD GALLAND",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "11:00-12:00",
  "client": "FAURE"
 },
 {
  "site": "PUY",
  "nomVendeur": "ARNAUD GALLAND",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "14:00-15:00",
  "client": "SAGNARD"
 },
 {
  "site": "PUY",
  "nomVendeur": "ARNAUD GALLAND",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "14:00-15:00",
  "client": "BEGEY"
 },
 {
  "site": "PUY",
  "nomVendeur": "ARNAUD GALLAND",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "14:00-15:00",
  "client": "CHARBONNEL"
 },
 {
  "site": "PUY",
  "nomVendeur": "ARNAUD GALLAND",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "15:00-16:00",
  "client": "CHABERT"
 },
 {
  "site": "PUY",
  "nomVendeur": "ARNAUD GALLAND",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "15:00-16:00",
  "client": "OUILON"
 },
 {
  "site": "PUY",
  "nomVendeur": "ARNAUD GALLAND",
  "marque": "RENAULT",
  "jour": "2026-06-14",
  "creneau": "15:00-16:00",
  "client": "ORFEUBRE"
 },
 {
  "site": "PUY",
  "nomVendeur": "ARNAUD GALLAND",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "16:00-17:00",
  "client": "DELUBAC"
 },
 {
  "site": "PUY",
  "nomVendeur": "ARNAUD GALLAND",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "16:00-17:00",
  "client": "AURELLE"
 },
 {
  "site": "PUY",
  "nomVendeur": "ARNAUD GALLAND",
  "marque": "RENAULT",
  "jour": "2026-06-14",
  "creneau": "16:00-17:00",
  "client": "MAUACI"
 },
 {
  "site": "PUY",
  "nomVendeur": "ARNAUD GALLAND",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "17:00-18:00",
  "client": "SOUCHON"
 },
 {
  "site": "PUY",
  "nomVendeur": "ARNAUD GALLAND",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "18:00-19:00",
  "client": "MAGNE"
 },
 {
  "site": "PUY",
  "nomVendeur": "ARNAUD GALLAND",
  "marque": "DACIA",
  "jour": "2026-06-12",
  "creneau": "13:00-14:00",
  "client": "VALLET"
 },
 {
  "site": "PUY",
  "nomVendeur": "ARNAUD GALLAND",
  "marque": "DACIA",
  "jour": "2026-06-11",
  "creneau": "15:00-16:00",
  "client": "RAFFARD DE BRIENNE"
 },
 {
  "site": "PUY",
  "nomVendeur": "GUILLAUME SAVINEL",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "09:00-10:00",
  "client": "M GUILLON"
 },
 {
  "site": "PUY",
  "nomVendeur": "GUILLAUME SAVINEL",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "10:00-11:00",
  "client": "Mr PILlOT"
 },
 {
  "site": "PUY",
  "nomVendeur": "GUILLAUME SAVINEL",
  "marque": "RENAULT",
  "jour": "2026-06-14",
  "creneau": "10:00-11:00",
  "client": "Mr COURTIAL"
 },
 {
  "site": "PUY",
  "nomVendeur": "GUILLAUME SAVINEL",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "11:00-12:00",
  "client": "ART FLORAL"
 },
 {
  "site": "PUY",
  "nomVendeur": "GUILLAUME SAVINEL",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "11:00-12:00",
  "client": "MR LAUBUGE"
 },
 {
  "site": "PUY",
  "nomVendeur": "GUILLAUME SAVINEL",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "14:00-15:00",
  "client": "Mme TEYSSIER"
 },
 {
  "site": "PUY",
  "nomVendeur": "GUILLAUME SAVINEL",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "17:00-18:00",
  "client": "Mme VAUZELLE"
 },
 {
  "site": "PUY",
  "nomVendeur": "GUILLAUME SAVINEL",
  "marque": "DACIA",
  "jour": "2026-06-13",
  "creneau": "09:00-10:00",
  "client": "Mme ROCHETTE"
 },
 {
  "site": "PUY",
  "nomVendeur": "GUILLAUME SAVINEL",
  "marque": "DACIA",
  "jour": "2026-06-11",
  "creneau": "13:00-14:00",
  "client": "Mme PAQUIN"
 },
 {
  "site": "PUY",
  "nomVendeur": "JEAN-PAUL RANVOISE",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "09:00-10:00",
  "client": "DAVID / LANGEAC"
 },
 {
  "site": "PUY",
  "nomVendeur": "JEAN-PAUL RANVOISE",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "09:00-10:00",
  "client": "DREYFUS"
 },
 {
  "site": "PUY",
  "nomVendeur": "JEAN-PAUL RANVOISE",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "10:00-11:00",
  "client": "BESSON / LANGEAC"
 },
 {
  "site": "PUY",
  "nomVendeur": "JEAN-PAUL RANVOISE",
  "marque": "RENAULT",
  "jour": "2026-06-15",
  "creneau": "14:00-15:00",
  "client": "GERANTON / VOREY"
 },
 {
  "site": "PUY",
  "nomVendeur": "JEAN-PAUL RANVOISE",
  "marque": "DACIA",
  "jour": "2026-06-11",
  "creneau": "09:00-10:00",
  "client": "GOBELET / LANGEAC"
 },
 {
  "site": "PUY",
  "nomVendeur": "JEAN-PAUL RANVOISE",
  "marque": "DACIA",
  "jour": "2026-06-11",
  "creneau": "14:00-15:00",
  "client": "GIRARD / SERVEL"
 },
 {
  "site": "PUY",
  "nomVendeur": "JEAN-PAUL RANVOISE",
  "marque": "DACIA",
  "jour": "2026-06-12",
  "creneau": "14:00-15:00",
  "client": "BESSON"
 },
 {
  "site": "PUY",
  "nomVendeur": "JEAN-PAUL RANVOISE",
  "marque": "DACIA",
  "jour": "2026-06-11",
  "creneau": "17:00-18:00",
  "client": "MARIN / BIGSTER"
 },
 {
  "site": "PUY",
  "nomVendeur": "ARTHUR DURANTON",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "10:00-11:00",
  "client": "DUPUIS"
 },
 {
  "site": "PUY",
  "nomVendeur": "ARTHUR DURANTON",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "10:00-11:00",
  "client": "JOUANNY"
 },
 {
  "site": "PUY",
  "nomVendeur": "ARTHUR DURANTON",
  "marque": "RENAULT",
  "jour": "2026-06-14",
  "creneau": "10:00-11:00",
  "client": "PONTVIANNE"
 },
 {
  "site": "PUY",
  "nomVendeur": "ARTHUR DURANTON",
  "marque": "RENAULT",
  "jour": "2026-06-15",
  "creneau": "10:00-11:00",
  "client": "BOUCHET"
 },
 {
  "site": "PUY",
  "nomVendeur": "ARTHUR DURANTON",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "11:00-12:00",
  "client": "BONNET"
 },
 {
  "site": "PUY",
  "nomVendeur": "ARTHUR DURANTON",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "13:00-14:00",
  "client": "BATTONET"
 },
 {
  "site": "PUY",
  "nomVendeur": "ARTHUR DURANTON",
  "marque": "RENAULT",
  "jour": "2026-06-15",
  "creneau": "14:00-15:00",
  "client": "CROS"
 },
 {
  "site": "PUY",
  "nomVendeur": "ARTHUR DURANTON",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "15:00-16:00",
  "client": "NOUVET"
 },
 {
  "site": "PUY",
  "nomVendeur": "ARTHUR DURANTON",
  "marque": "RENAULT",
  "jour": "2026-06-14",
  "creneau": "16:00-17:00",
  "client": "AVOUAC"
 },
 {
  "site": "PUY",
  "nomVendeur": "ARTHUR DURANTON",
  "marque": "RENAULT",
  "jour": "2026-06-15",
  "creneau": "16:00-17:00",
  "client": "MAZET"
 },
 {
  "site": "PUY",
  "nomVendeur": "ARTHUR DURANTON",
  "marque": "DACIA",
  "jour": "2026-06-11",
  "creneau": "10:00-11:00",
  "client": "MULLER"
 },
 {
  "site": "PUY",
  "nomVendeur": "VALENTIN MOLINES",
  "marque": "VO",
  "jour": "2026-06-13",
  "creneau": "09:00-10:00",
  "client": "M COURJAUD"
 },
 {
  "site": "PUY",
  "nomVendeur": "VALENTIN MOLINES",
  "marque": "VO",
  "jour": "2026-06-14",
  "creneau": "09:00-10:00",
  "client": "9h30 Berger"
 },
 {
  "site": "PUY",
  "nomVendeur": "VALENTIN MOLINES",
  "marque": "VO",
  "jour": "2026-06-13",
  "creneau": "11:00-12:00",
  "client": "Mr MEZIN"
 },
 {
  "site": "PUY",
  "nomVendeur": "VALENTIN MOLINES",
  "marque": "VO",
  "jour": "2026-06-12",
  "creneau": "14:00-15:00",
  "client": "MMe BOSSAERT"
 },
 {
  "site": "PUY",
  "nomVendeur": "RICHARD WEISSELDINGER",
  "marque": "VO",
  "jour": "2026-06-11",
  "creneau": "10:00-11:00",
  "client": "ROUSSET"
 },
 {
  "site": "PUY",
  "nomVendeur": "RICHARD WEISSELDINGER",
  "marque": "VO",
  "jour": "2026-06-14",
  "creneau": "10:00-11:00",
  "client": "TORRESAN"
 },
 {
  "site": "PUY",
  "nomVendeur": "RICHARD WEISSELDINGER",
  "marque": "VO",
  "jour": "2026-06-13",
  "creneau": "11:00-12:00",
  "client": "VIALVIELLE"
 },
 {
  "site": "PUY",
  "nomVendeur": "RICHARD WEISSELDINGER",
  "marque": "VO",
  "jour": "2026-06-13",
  "creneau": "13:00-14:00",
  "client": "DARBOUSSET"
 },
 {
  "site": "PUY",
  "nomVendeur": "RICHARD WEISSELDINGER",
  "marque": "VO",
  "jour": "2026-06-11",
  "creneau": "14:00-15:00",
  "client": "DAMIEN"
 },
 {
  "site": "PUY",
  "nomVendeur": "RICHARD WEISSELDINGER",
  "marque": "VO",
  "jour": "2026-06-12",
  "creneau": "14:00-15:00",
  "client": "CIODOIU"
 },
 {
  "site": "PUY",
  "nomVendeur": "RICHARD WEISSELDINGER",
  "marque": "VO",
  "jour": "2026-06-11",
  "creneau": "15:00-16:00",
  "client": "JEANNIN"
 },
 {
  "site": "PUY",
  "nomVendeur": "RICHARD WEISSELDINGER",
  "marque": "VO",
  "jour": "2026-06-11",
  "creneau": "16:00-17:00",
  "client": "CLUZEL"
 },
 {
  "site": "PUY",
  "nomVendeur": "RICHARD WEISSELDINGER",
  "marque": "VO",
  "jour": "2026-06-14",
  "creneau": "16:00-17:00",
  "client": "DUMOND"
 },
 {
  "site": "PUY",
  "nomVendeur": "RICHARD WEISSELDINGER",
  "marque": "VO",
  "jour": "2026-06-12",
  "creneau": "17:00-18:00",
  "client": "RODRIGUES"
 },
 {
  "site": "PUY",
  "nomVendeur": "RICHARD WEISSELDINGER",
  "marque": "VO",
  "jour": "2026-06-11",
  "creneau": "18:00-19:00",
  "client": "LIOGIER"
 },
 {
  "site": "MEN",
  "nomVendeur": "JÉRÉMY DA COSTA",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "09:00-10:00",
  "client": "TAULAMESSE"
 },
 {
  "site": "MEN",
  "nomVendeur": "JÉRÉMY DA COSTA",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "09:00-10:00",
  "client": "BADUEL"
 },
 {
  "site": "MEN",
  "nomVendeur": "JÉRÉMY DA COSTA",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "10:00-11:00",
  "client": "MARCU"
 },
 {
  "site": "MEN",
  "nomVendeur": "JÉRÉMY DA COSTA",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "10:00-11:00",
  "client": "BERNIER"
 },
 {
  "site": "MEN",
  "nomVendeur": "JÉRÉMY DA COSTA",
  "marque": "RENAULT",
  "jour": "2026-06-14",
  "creneau": "10:00-11:00",
  "client": "HERME"
 },
 {
  "site": "MEN",
  "nomVendeur": "JÉRÉMY DA COSTA",
  "marque": "RENAULT",
  "jour": "2026-06-14",
  "creneau": "11:00-12:00",
  "client": "CALANDRE"
 },
 {
  "site": "MEN",
  "nomVendeur": "JÉRÉMY DA COSTA",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "14:00-15:00",
  "client": "PEPIN"
 },
 {
  "site": "MEN",
  "nomVendeur": "JÉRÉMY DA COSTA",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "16:00-17:00",
  "client": "LEITAO"
 },
 {
  "site": "MEN",
  "nomVendeur": "JÉRÉMY DA COSTA",
  "marque": "RENAULT",
  "jour": "2026-06-15",
  "creneau": "16:00-17:00",
  "client": "COLLET"
 },
 {
  "site": "MEN",
  "nomVendeur": "JÉRÉMY DA COSTA",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "17:00-18:00",
  "client": "BRUNET"
 },
 {
  "site": "MEN",
  "nomVendeur": "JÉRÉMY DA COSTA",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "18:00-19:00",
  "client": "OZIOL"
 },
 {
  "site": "MEN",
  "nomVendeur": "JÉRÉMY DA COSTA",
  "marque": "DACIA",
  "jour": "2026-06-12",
  "creneau": "10:00-11:00",
  "client": "PELOTHIER"
 },
 {
  "site": "MEN",
  "nomVendeur": "JÉRÉMY DA COSTA",
  "marque": "DACIA",
  "jour": "2026-06-12",
  "creneau": "14:00-15:00",
  "client": "SEGOLA"
 },
 {
  "site": "MEN",
  "nomVendeur": "JÉRÉMY DA COSTA",
  "marque": "DACIA",
  "jour": "2026-06-14",
  "creneau": "14:00-15:00",
  "client": "POUDEVIGNE"
 },
 {
  "site": "MEN",
  "nomVendeur": "JÉRÉMY DA COSTA",
  "marque": "DACIA",
  "jour": "2026-06-12",
  "creneau": "15:00-16:00",
  "client": "BROJAN"
 },
 {
  "site": "MEN",
  "nomVendeur": "JÉRÉMY DA COSTA",
  "marque": "DACIA",
  "jour": "2026-06-12",
  "creneau": "16:00-17:00",
  "client": "FOURNIER"
 },
 {
  "site": "MEN",
  "nomVendeur": "JÉRÉMY DA COSTA",
  "marque": "DACIA",
  "jour": "2026-06-12",
  "creneau": "17:00-18:00",
  "client": "GAUGAIN"
 },
 {
  "site": "MEN",
  "nomVendeur": "WILLIAM PASCAL",
  "marque": "VO",
  "jour": "2026-06-12",
  "creneau": "10:00-11:00",
  "client": "REMISE"
 },
 {
  "site": "MEN",
  "nomVendeur": "WILLIAM PASCAL",
  "marque": "VO",
  "jour": "2026-06-15",
  "creneau": "10:00-11:00",
  "client": "SOANE"
 },
 {
  "site": "MEN",
  "nomVendeur": "WILLIAM PASCAL",
  "marque": "VO",
  "jour": "2026-06-11",
  "creneau": "14:00-15:00",
  "client": "JIMENEZ"
 },
 {
  "site": "MEN",
  "nomVendeur": "WILLIAM PASCAL",
  "marque": "VO",
  "jour": "2026-06-13",
  "creneau": "14:00-15:00",
  "client": "DELRIEU"
 },
 {
  "site": "MEN",
  "nomVendeur": "WILLIAM PASCAL",
  "marque": "VO",
  "jour": "2026-06-14",
  "creneau": "14:00-15:00",
  "client": "PORTAL"
 },
 {
  "site": "MEN",
  "nomVendeur": "WILLIAM PASCAL",
  "marque": "VO",
  "jour": "2026-06-12",
  "creneau": "09:00-10:00",
  "client": "DELON"
 },
 {
  "site": "MEN",
  "nomVendeur": "WILLIAM PASCAL",
  "marque": "VO",
  "jour": "2026-06-14",
  "creneau": "10:00-11:00",
  "client": "MONIEZ"
 },
 {
  "site": "MEN",
  "nomVendeur": "WILLIAM PASCAL",
  "marque": "VO",
  "jour": "2026-06-12",
  "creneau": "14:00-15:00",
  "client": "MONTESANI"
 },
 {
  "site": "MEN",
  "nomVendeur": "WILLIAM PASCAL",
  "marque": "VO",
  "jour": "2026-06-13",
  "creneau": "16:00-17:00",
  "client": "REMIZE"
 },
 {
  "site": "MEN",
  "nomVendeur": "WILLIAM PASCAL",
  "marque": "VO",
  "jour": "2026-06-12",
  "creneau": "17:00-18:00",
  "client": "ASTIER"
 },
 {
  "site": "MEN",
  "nomVendeur": "WILLIAM PASCAL",
  "marque": "VO",
  "jour": "2026-06-12",
  "creneau": "18:00-19:00",
  "client": "TROCELLIER"
 },
 {
  "site": "RDZ",
  "nomVendeur": "ROMAIN BOISSONNADE",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "09:00-10:00",
  "client": "BONAMI DUSTER CAPTUR"
 },
 {
  "site": "RDZ",
  "nomVendeur": "ROMAIN BOISSONNADE",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "10:00-11:00",
  "client": "LEGRAND TWINGO"
 },
 {
  "site": "RDZ",
  "nomVendeur": "ROMAIN BOISSONNADE",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "11:00-12:00",
  "client": "BELLIERE R4"
 },
 {
  "site": "RDZ",
  "nomVendeur": "ROMAIN BOISSONNADE",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "15:00-16:00",
  "client": "GARIN TW3 OU R5"
 },
 {
  "site": "RDZ",
  "nomVendeur": "ROMAIN BOISSONNADE",
  "marque": "DACIA",
  "jour": "2026-06-12",
  "creneau": "16:00-17:00",
  "client": "DELOUS SANDERO"
 },
 {
  "site": "RDZ",
  "nomVendeur": "ROMAIN BOISSONNADE",
  "marque": "DACIA",
  "jour": "2026-06-13",
  "creneau": "16:00-17:00",
  "client": "DOMERGUES SPRING OU SANDERO"
 },
 {
  "site": "RDZ",
  "nomVendeur": "ROMAIN BOISSONNADE",
  "marque": "DACIA",
  "jour": "2026-06-11",
  "creneau": "17:00-18:00",
  "client": "BARBIER"
 },
 {
  "site": "RDZ",
  "nomVendeur": "ROMAIN BOISSONNADE",
  "marque": "DACIA",
  "jour": "2026-06-13",
  "creneau": "17:00-18:00",
  "client": "GARCIA CLIO 6"
 },
 {
  "site": "RDZ",
  "nomVendeur": "MARINE FLAUJAGUET",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "08:00-09:00",
  "client": "OLIVIER TWINGO VD"
 },
 {
  "site": "RDZ",
  "nomVendeur": "MARINE FLAUJAGUET",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "09:00-10:00",
  "client": "GUTFREND CLIO"
 },
 {
  "site": "RDZ",
  "nomVendeur": "MARINE FLAUJAGUET",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "09:00-10:00",
  "client": "AURIOL TWINGO"
 },
 {
  "site": "RDZ",
  "nomVendeur": "MARINE FLAUJAGUET",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "09:00-10:00",
  "client": "ESPINASSE RENOUV ZOE"
 },
 {
  "site": "RDZ",
  "nomVendeur": "MARINE FLAUJAGUET",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "10:00-11:00",
  "client": "VASILIC TWINGO"
 },
 {
  "site": "RDZ",
  "nomVendeur": "MARINE FLAUJAGUET",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "10:00-11:00",
  "client": "CROS CLIO"
 },
 {
  "site": "RDZ",
  "nomVendeur": "MARINE FLAUJAGUET",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "10:00-11:00",
  "client": "CARRIERE RENOUV MEGANE"
 },
 {
  "site": "RDZ",
  "nomVendeur": "MARINE FLAUJAGUET",
  "marque": "RENAULT",
  "jour": "2026-06-15",
  "creneau": "10:00-11:00",
  "client": "BLANC"
 },
 {
  "site": "RDZ",
  "nomVendeur": "MARINE FLAUJAGUET",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "11:00-12:00",
  "client": "DUBAR CAPTUR"
 },
 {
  "site": "RDZ",
  "nomVendeur": "MARINE FLAUJAGUET",
  "marque": "RENAULT",
  "jour": "2026-06-15",
  "creneau": "11:00-12:00",
  "client": "LACLEDE RENOUV MEGANE"
 },
 {
  "site": "RDZ",
  "nomVendeur": "MARINE FLAUJAGUET",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "12:00-13:00",
  "client": "MOULY RENOUV ZOE"
 },
 {
  "site": "RDZ",
  "nomVendeur": "MARINE FLAUJAGUET",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "13:00-14:00",
  "client": "MOLINIER CAPTUR"
 },
 {
  "site": "RDZ",
  "nomVendeur": "MARINE FLAUJAGUET",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "14:00-15:00",
  "client": "MAZARS"
 },
 {
  "site": "RDZ",
  "nomVendeur": "MARINE FLAUJAGUET",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "14:00-15:00",
  "client": "FLEURY SCENIC"
 },
 {
  "site": "RDZ",
  "nomVendeur": "MARINE FLAUJAGUET",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "15:00-16:00",
  "client": "DELOUS CLIO"
 },
 {
  "site": "RDZ",
  "nomVendeur": "MARINE FLAUJAGUET",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "16:00-17:00",
  "client": "JOULIA"
 },
 {
  "site": "RDZ",
  "nomVendeur": "MARINE FLAUJAGUET",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "17:00-18:00",
  "client": "MERCIER A VOIR"
 },
 {
  "site": "RDZ",
  "nomVendeur": "MARINE FLAUJAGUET",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "18:00-19:00",
  "client": "ROUSSELLE RENOUV ZOE"
 },
 {
  "site": "RDZ",
  "nomVendeur": "ALEXIS COMPANS",
  "marque": "RENAULT",
  "jour": "2026-06-14",
  "creneau": "14:00-15:00",
  "client": "GRIBBAL TWINGO"
 },
 {
  "site": "RDZ",
  "nomVendeur": "ALEXIS COMPANS",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "18:00-19:00",
  "client": "CHENE CHRISTOPHE"
 },
 {
  "site": "RDZ",
  "nomVendeur": "ALEXIS COMPANS",
  "marque": "DACIA",
  "jour": "2026-06-12",
  "creneau": "09:00-10:00",
  "client": "BARRETTE SANDERO VD"
 },
 {
  "site": "RDZ",
  "nomVendeur": "ALEXIS COMPANS",
  "marque": "DACIA",
  "jour": "2026-06-11",
  "creneau": "10:00-11:00",
  "client": "QUENHE JOGGER"
 },
 {
  "site": "RDZ",
  "nomVendeur": "ALEXIS COMPANS",
  "marque": "DACIA",
  "jour": "2026-06-12",
  "creneau": "11:00-12:00",
  "client": "GATIMEL DUSTER"
 },
 {
  "site": "RDZ",
  "nomVendeur": "ALEXIS COMPANS",
  "marque": "DACIA",
  "jour": "2026-06-14",
  "creneau": "12:00-13:00",
  "client": "FOUCAT SANDERO"
 },
 {
  "site": "RDZ",
  "nomVendeur": "ALEXIS COMPANS",
  "marque": "DACIA",
  "jour": "2026-06-11",
  "creneau": "16:00-17:00",
  "client": "FABIE SANDERO"
 },
 {
  "site": "RDZ",
  "nomVendeur": "RÉMI DEGAND",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "09:00-10:00",
  "client": "CARLES"
 },
 {
  "site": "RDZ",
  "nomVendeur": "RÉMI DEGAND",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "09:00-10:00",
  "client": "ROGUET MEGANE"
 },
 {
  "site": "RDZ",
  "nomVendeur": "RÉMI DEGAND",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "10:00-11:00",
  "client": "FAGES"
 },
 {
  "site": "RDZ",
  "nomVendeur": "RÉMI DEGAND",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "10:00-11:00",
  "client": "VERNES CLIO 6"
 },
 {
  "site": "RDZ",
  "nomVendeur": "RÉMI DEGAND",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "10:00-11:00",
  "client": "MURAT SCENIC"
 },
 {
  "site": "RDZ",
  "nomVendeur": "RÉMI DEGAND",
  "marque": "RENAULT",
  "jour": "2026-06-15",
  "creneau": "10:00-11:00",
  "client": "PHOUMAN CLIO 5"
 },
 {
  "site": "RDZ",
  "nomVendeur": "RÉMI DEGAND",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "11:00-12:00",
  "client": "DELMAS TWINGO"
 },
 {
  "site": "RDZ",
  "nomVendeur": "RÉMI DEGAND",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "12:00-13:00",
  "client": "NOWFOL R4"
 },
 {
  "site": "RDZ",
  "nomVendeur": "RÉMI DEGAND",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "14:00-15:00",
  "client": "ALONZO CLIO 6"
 },
 {
  "site": "RDZ",
  "nomVendeur": "RÉMI DEGAND",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "16:00-17:00",
  "client": "FRUNEAU TWINGO"
 },
 {
  "site": "RDZ",
  "nomVendeur": "RÉMI DEGAND",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "17:00-18:00",
  "client": "GEMARIN"
 },
 {
  "site": "RDZ",
  "nomVendeur": "RÉMI DEGAND",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "17:00-18:00",
  "client": "ALBERT SCENIC"
 },
 {
  "site": "RDZ",
  "nomVendeur": "RÉMI DEGAND",
  "marque": "DACIA",
  "jour": "2026-06-12",
  "creneau": "09:00-10:00",
  "client": "LERIDENT BIGSTER"
 },
 {
  "site": "RDZ",
  "nomVendeur": "RÉMI DEGAND",
  "marque": "DACIA",
  "jour": "2026-06-11",
  "creneau": "14:00-15:00",
  "client": "DEGUIRARD DUSTER"
 },
 {
  "site": "RDZ",
  "nomVendeur": "RÉMI DEGAND",
  "marque": "DACIA",
  "jour": "2026-06-13",
  "creneau": "15:00-16:00",
  "client": "DOMERGUES JOGGER"
 },
 {
  "site": "RDZ",
  "nomVendeur": "RÉMI DEGAND",
  "marque": "DACIA",
  "jour": "2026-06-11",
  "creneau": "17:00-18:00",
  "client": "BLANQUET SANDERO"
 },
 {
  "site": "RDZ",
  "nomVendeur": "ARNAUD LOPEZ",
  "marque": "VO",
  "jour": "2026-06-13",
  "creneau": "10:00-11:00",
  "client": "HYGONET"
 },
 {
  "site": "RDZ",
  "nomVendeur": "ARNAUD LOPEZ",
  "marque": "VO",
  "jour": "2026-06-12",
  "creneau": "11:00-12:00",
  "client": "MER"
 },
 {
  "site": "RDZ",
  "nomVendeur": "ARNAUD LOPEZ",
  "marque": "VO",
  "jour": "2026-06-14",
  "creneau": "11:00-12:00",
  "client": "REDOULES"
 },
 {
  "site": "RDZ",
  "nomVendeur": "ARNAUD LOPEZ",
  "marque": "VO",
  "jour": "2026-06-13",
  "creneau": "15:00-16:00",
  "client": "LADET TWINGO"
 },
 {
  "site": "RDZ",
  "nomVendeur": "ARNAUD LOPEZ",
  "marque": "VO",
  "jour": "2026-06-14",
  "creneau": "15:00-16:00",
  "client": "MOUNIRAT"
 },
 {
  "site": "RDZ",
  "nomVendeur": "ARNAUD LOPEZ",
  "marque": "VO",
  "jour": "2026-06-11",
  "creneau": "16:00-17:00",
  "client": "COMBRET SPRING"
 },
 {
  "site": "RDZ",
  "nomVendeur": "ARNAUD LOPEZ",
  "marque": "VO",
  "jour": "2026-06-13",
  "creneau": "16:00-17:00",
  "client": "ALFONSO JOGGER"
 },
 {
  "site": "RDZ",
  "nomVendeur": "ARNAUD LOPEZ",
  "marque": "VO",
  "jour": "2026-06-14",
  "creneau": "16:00-17:00",
  "client": "BEN DAOUD"
 },
 {
  "site": "RDZ",
  "nomVendeur": "DORIAN FRANCE",
  "marque": "VO",
  "jour": "2026-06-13",
  "creneau": "09:00-10:00",
  "client": "LEONNARD CLIO"
 },
 {
  "site": "RDZ",
  "nomVendeur": "DORIAN FRANCE",
  "marque": "VO",
  "jour": "2026-06-12",
  "creneau": "15:00-16:00",
  "client": "THERON CLIO"
 },
 {
  "site": "RDZ",
  "nomVendeur": "DORIAN FRANCE",
  "marque": "VO",
  "jour": "2026-06-11",
  "creneau": "17:00-18:00",
  "client": "MAUME ZOE"
 },
 {
  "site": "RDZ",
  "nomVendeur": "DORIAN FRANCE",
  "marque": "VO",
  "jour": "2026-06-12",
  "creneau": "17:00-18:00",
  "client": "LACAN MELANIE"
 },
 {
  "site": "RDZ",
  "nomVendeur": "DORIAN FRANCE",
  "marque": "VO",
  "jour": "2026-06-13",
  "creneau": "17:00-18:00",
  "client": "ESTELLE CAVALERIE ZE"
 },
 {
  "site": "RDZ",
  "nomVendeur": "DAMIEN RULHE",
  "marque": "VO",
  "jour": "2026-06-12",
  "creneau": "10:00-11:00",
  "client": "AGUERA AUDI A1"
 },
 {
  "site": "RDZ",
  "nomVendeur": "DAMIEN RULHE",
  "marque": "VO",
  "jour": "2026-06-15",
  "creneau": "11:00-12:00",
  "client": "PANOT"
 },
 {
  "site": "RDZ",
  "nomVendeur": "DAMIEN RULHE",
  "marque": "VO",
  "jour": "2026-06-12",
  "creneau": "14:00-15:00",
  "client": "BLANC CAPTUR"
 },
 {
  "site": "RDZ",
  "nomVendeur": "DAMIEN RULHE",
  "marque": "VO",
  "jour": "2026-06-12",
  "creneau": "15:00-16:00",
  "client": "RAYNAL CAPTUR"
 },
 {
  "site": "AUR",
  "nomVendeur": "YOHAN BANYIK",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "10:00-11:00",
  "client": "TOVAR"
 },
 {
  "site": "AUR",
  "nomVendeur": "YOHAN BANYIK",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "10:00-11:00",
  "client": "MERDRIGNAC"
 },
 {
  "site": "AUR",
  "nomVendeur": "YOHAN BANYIK",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "11:00-12:00",
  "client": "NOZIERES"
 },
 {
  "site": "AUR",
  "nomVendeur": "YOHAN BANYIK",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "11:00-12:00",
  "client": "GARD"
 },
 {
  "site": "AUR",
  "nomVendeur": "YOHAN BANYIK",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "14:00-15:00",
  "client": "OGLAZA"
 },
 {
  "site": "AUR",
  "nomVendeur": "YOHAN BANYIK",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "14:00-15:00",
  "client": "CONSTENSOU"
 },
 {
  "site": "AUR",
  "nomVendeur": "YOHAN BANYIK",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "15:00-16:00",
  "client": "SOULIER"
 },
 {
  "site": "AUR",
  "nomVendeur": "YOHAN BANYIK",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "15:00-16:00",
  "client": "MEZGHANI"
 },
 {
  "site": "AUR",
  "nomVendeur": "YOHAN BANYIK",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "16:00-17:00",
  "client": "LUSSIER"
 },
 {
  "site": "AUR",
  "nomVendeur": "YOHAN BANYIK",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "16:00-17:00",
  "client": "PICARONNY"
 },
 {
  "site": "AUR",
  "nomVendeur": "YOHAN BANYIK",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "17:00-18:00",
  "client": "MESTRIES"
 },
 {
  "site": "AUR",
  "nomVendeur": "YOHAN BANYIK",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "17:00-18:00",
  "client": "THEATE"
 },
 {
  "site": "AUR",
  "nomVendeur": "YOHAN BANYIK",
  "marque": "RENAULT",
  "jour": "2026-06-15",
  "creneau": "17:00-18:00",
  "client": "DEGUIRARD"
 },
 {
  "site": "AUR",
  "nomVendeur": "YOHAN BANYIK",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "18:00-19:00",
  "client": "HEBRARD"
 },
 {
  "site": "AUR",
  "nomVendeur": "YOHAN BANYIK",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "18:00-19:00",
  "client": "BEDOUSSAC"
 },
 {
  "site": "AUR",
  "nomVendeur": "YOHAN BANYIK",
  "marque": "DACIA",
  "jour": "2026-06-11",
  "creneau": "09:00-10:00",
  "client": "GUILLERON"
 },
 {
  "site": "AUR",
  "nomVendeur": "YOHAN BANYIK",
  "marque": "DACIA",
  "jour": "2026-06-13",
  "creneau": "09:00-10:00",
  "client": "KAIQUE"
 },
 {
  "site": "AUR",
  "nomVendeur": "YOHAN BANYIK",
  "marque": "DACIA",
  "jour": "2026-06-13",
  "creneau": "17:00-18:00",
  "client": "CHAILLOU"
 },
 {
  "site": "AUR",
  "nomVendeur": "ROMAIN COMBOURIEU",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "09:00-10:00",
  "client": "MOISSINAC"
 },
 {
  "site": "AUR",
  "nomVendeur": "ROMAIN COMBOURIEU",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "09:00-10:00",
  "client": "FALIES"
 },
 {
  "site": "AUR",
  "nomVendeur": "ROMAIN COMBOURIEU",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "10:00-11:00",
  "client": "BESSE"
 },
 {
  "site": "AUR",
  "nomVendeur": "ROMAIN COMBOURIEU",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "11:00-12:00",
  "client": "LACROZE"
 },
 {
  "site": "AUR",
  "nomVendeur": "ROMAIN COMBOURIEU",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "14:00-15:00",
  "client": "LIMBERTIE"
 },
 {
  "site": "AUR",
  "nomVendeur": "ROMAIN COMBOURIEU",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "14:00-15:00",
  "client": "KIALA"
 },
 {
  "site": "AUR",
  "nomVendeur": "ROMAIN COMBOURIEU",
  "marque": "RENAULT",
  "jour": "2026-06-15",
  "creneau": "14:00-15:00",
  "client": "LASFAUX"
 },
 {
  "site": "AUR",
  "nomVendeur": "ROMAIN COMBOURIEU",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "15:00-16:00",
  "client": "TRIN"
 },
 {
  "site": "AUR",
  "nomVendeur": "ROMAIN COMBOURIEU",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "15:00-16:00",
  "client": "LALOIS"
 },
 {
  "site": "AUR",
  "nomVendeur": "ROMAIN COMBOURIEU",
  "marque": "RENAULT",
  "jour": "2026-06-15",
  "creneau": "17:00-18:00",
  "client": "NEY"
 },
 {
  "site": "AUR",
  "nomVendeur": "ROMAIN COMBOURIEU",
  "marque": "DACIA",
  "jour": "2026-06-11",
  "creneau": "10:00-11:00",
  "client": "PUECH"
 },
 {
  "site": "AUR",
  "nomVendeur": "ROMAIN COMBOURIEU",
  "marque": "DACIA",
  "jour": "2026-06-13",
  "creneau": "17:00-18:00",
  "client": "REUR"
 },
 {
  "site": "AUR",
  "nomVendeur": "STÉPHANE SUC",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "09:00-10:00",
  "client": "VEYRIERES"
 },
 {
  "site": "AUR",
  "nomVendeur": "STÉPHANE SUC",
  "marque": "RENAULT",
  "jour": "2026-06-15",
  "creneau": "09:00-10:00",
  "client": "CHARMES"
 },
 {
  "site": "AUR",
  "nomVendeur": "STÉPHANE SUC",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "10:00-11:00",
  "client": "LORCY"
 },
 {
  "site": "AUR",
  "nomVendeur": "STÉPHANE SUC",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "11:00-12:00",
  "client": "PRUNIERES"
 },
 {
  "site": "AUR",
  "nomVendeur": "STÉPHANE SUC",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "14:00-15:00",
  "client": "LAJARRIGE"
 },
 {
  "site": "AUR",
  "nomVendeur": "STÉPHANE SUC",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "14:00-15:00",
  "client": "COUET"
 },
 {
  "site": "AUR",
  "nomVendeur": "STÉPHANE SUC",
  "marque": "RENAULT",
  "jour": "2026-06-15",
  "creneau": "15:00-16:00",
  "client": "ESPALIEU"
 },
 {
  "site": "AUR",
  "nomVendeur": "STÉPHANE SUC",
  "marque": "RENAULT",
  "jour": "2026-06-15",
  "creneau": "17:00-18:00",
  "client": "VEILLY"
 },
 {
  "site": "AUR",
  "nomVendeur": "STÉPHANE SUC",
  "marque": "RENAULT",
  "jour": "2026-06-15",
  "creneau": "18:00-19:00",
  "client": "RODDE"
 },
 {
  "site": "AUR",
  "nomVendeur": "STÉPHANE SUC",
  "marque": "DACIA",
  "jour": "2026-06-13",
  "creneau": "10:00-11:00",
  "client": "ROCHE"
 },
 {
  "site": "AUR",
  "nomVendeur": "STÉPHANE SUC",
  "marque": "DACIA",
  "jour": "2026-06-15",
  "creneau": "10:00-11:00",
  "client": "CONSTANT"
 },
 {
  "site": "AUR",
  "nomVendeur": "STÉPHANE SUC",
  "marque": "DACIA",
  "jour": "2026-06-13",
  "creneau": "11:00-12:00",
  "client": "DANIS"
 },
 {
  "site": "AUR",
  "nomVendeur": "STÉPHANE SUC",
  "marque": "DACIA",
  "jour": "2026-06-12",
  "creneau": "17:00-18:00",
  "client": "FREYTET"
 },
 {
  "site": "MILL",
  "nomVendeur": "NICOLAS CAYRON",
  "marque": "RENAULT",
  "jour": "2026-06-15",
  "creneau": "09:00-10:00",
  "client": "GINESTET (Clio GPL)"
 },
 {
  "site": "MILL",
  "nomVendeur": "NICOLAS CAYRON",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "10:00-11:00",
  "client": "GUILLEMIN (Espace VD)"
 },
 {
  "site": "MILL",
  "nomVendeur": "NICOLAS CAYRON",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "10:00-11:00",
  "client": "BERNADMONT (Twingo)"
 },
 {
  "site": "MILL",
  "nomVendeur": "NICOLAS CAYRON",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "10:00-11:00",
  "client": "BLANC (Clio)"
 },
 {
  "site": "MILL",
  "nomVendeur": "NICOLAS CAYRON",
  "marque": "RENAULT",
  "jour": "2026-06-14",
  "creneau": "11:00-12:00",
  "client": "GUIBBERT (Clio VI)"
 },
 {
  "site": "MILL",
  "nomVendeur": "NICOLAS CAYRON",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "14:00-15:00",
  "client": "MALLAT (Twingo)"
 },
 {
  "site": "MILL",
  "nomVendeur": "NICOLAS CAYRON",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "14:00-15:00",
  "client": "PERSEGOL (Captur)"
 },
 {
  "site": "MILL",
  "nomVendeur": "NICOLAS CAYRON",
  "marque": "RENAULT",
  "jour": "2026-06-14",
  "creneau": "14:00-15:00",
  "client": "HURGON (Captur)"
 },
 {
  "site": "MILL",
  "nomVendeur": "NICOLAS CAYRON",
  "marque": "RENAULT",
  "jour": "2026-06-15",
  "creneau": "14:00-15:00",
  "client": "BELMOTKAR  (Captur)"
 },
 {
  "site": "MILL",
  "nomVendeur": "NICOLAS CAYRON",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "15:00-16:00",
  "client": "GAVALDA (Clio)"
 },
 {
  "site": "MILL",
  "nomVendeur": "NICOLAS CAYRON",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "16:00-17:00",
  "client": "GALZIN (Rafale)"
 },
 {
  "site": "MILL",
  "nomVendeur": "NICOLAS CAYRON",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "17:00-18:00",
  "client": "CHEVALIER (Clio ou Captur)"
 },
 {
  "site": "MILL",
  "nomVendeur": "NICOLAS CAYRON",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "18:00-19:00",
  "client": "RAVELEAU (Clio)"
 },
 {
  "site": "MILL",
  "nomVendeur": "MATHIS FRANCOIS",
  "marque": "DACIA",
  "jour": "2026-06-11",
  "creneau": "09:00-10:00",
  "client": "MAURY (Duster)"
 },
 {
  "site": "MILL",
  "nomVendeur": "MATHIS FRANCOIS",
  "marque": "DACIA",
  "jour": "2026-06-13",
  "creneau": "09:00-10:00",
  "client": "RICHARD (Master VO)"
 },
 {
  "site": "MILL",
  "nomVendeur": "MATHIS FRANCOIS",
  "marque": "DACIA",
  "jour": "2026-06-12",
  "creneau": "10:00-11:00",
  "client": "BOONEFOUS (duster)"
 },
 {
  "site": "MILL",
  "nomVendeur": "MATHIS FRANCOIS",
  "marque": "DACIA",
  "jour": "2026-06-11",
  "creneau": "11:00-12:00",
  "client": "WILLERMACK (Duster LOA)"
 },
 {
  "site": "MILL",
  "nomVendeur": "MATHIS FRANCOIS",
  "marque": "DACIA",
  "jour": "2026-06-12",
  "creneau": "11:00-12:00",
  "client": "GINESTE (Sandero)"
 },
 {
  "site": "MILL",
  "nomVendeur": "MATHIS FRANCOIS",
  "marque": "DACIA",
  "jour": "2026-06-13",
  "creneau": "11:00-12:00",
  "client": "DANILL (Duster LOA)"
 },
 {
  "site": "MILL",
  "nomVendeur": "MATHIS FRANCOIS",
  "marque": "DACIA",
  "jour": "2026-06-15",
  "creneau": "11:00-12:00",
  "client": "ROCHER (Sandero)"
 },
 {
  "site": "MILL",
  "nomVendeur": "MATHIS FRANCOIS",
  "marque": "DACIA",
  "jour": "2026-06-11",
  "creneau": "14:00-15:00",
  "client": "VIALE (Jogger en LOA)"
 },
 {
  "site": "MILL",
  "nomVendeur": "MATHIS FRANCOIS",
  "marque": "DACIA",
  "jour": "2026-06-12",
  "creneau": "14:00-15:00",
  "client": "LAMOTTE (Sandero)"
 },
 {
  "site": "MILL",
  "nomVendeur": "MATHIS FRANCOIS",
  "marque": "DACIA",
  "jour": "2026-06-13",
  "creneau": "14:00-15:00",
  "client": "BOURDAIS (etech)"
 },
 {
  "site": "MILL",
  "nomVendeur": "MATHIS FRANCOIS",
  "marque": "DACIA",
  "jour": "2026-06-11",
  "creneau": "15:00-16:00",
  "client": "GAL (Sandero LOA)"
 },
 {
  "site": "MILL",
  "nomVendeur": "MATHIS FRANCOIS",
  "marque": "DACIA",
  "jour": "2026-06-13",
  "creneau": "15:00-16:00",
  "client": "AMDRAUD (Sandero)"
 },
 {
  "site": "MILL",
  "nomVendeur": "MATHIS FRANCOIS",
  "marque": "DACIA",
  "jour": "2026-06-13",
  "creneau": "16:00-17:00",
  "client": "Carriere (Bigster)"
 },
 {
  "site": "GAILL",
  "nomVendeur": "CHRISTIAN CAUQUIL",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "09:00-10:00",
  "client": "JANIN Rafale"
 },
 {
  "site": "GAILL",
  "nomVendeur": "CHRISTIAN CAUQUIL",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "09:00-10:00",
  "client": "POMPIER Scenic"
 },
 {
  "site": "GAILL",
  "nomVendeur": "CHRISTIAN CAUQUIL",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "10:00-11:00",
  "client": "CARRE R5"
 },
 {
  "site": "GAILL",
  "nomVendeur": "CHRISTIAN CAUQUIL",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "11:00-12:00",
  "client": "RAFRE Scenic"
 },
 {
  "site": "GAILL",
  "nomVendeur": "CHRISTIAN CAUQUIL",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "11:00-12:00",
  "client": "DURIF R5"
 },
 {
  "site": "GAILL",
  "nomVendeur": "CHRISTIAN CAUQUIL",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "14:00-15:00",
  "client": "RICARDOU Twingo"
 },
 {
  "site": "GAILL",
  "nomVendeur": "CHRISTIAN CAUQUIL",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "15:00-16:00",
  "client": "CHEVILLER R5"
 },
 {
  "site": "GAILL",
  "nomVendeur": "CHRISTIAN CAUQUIL",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "15:00-16:00",
  "client": "PAILLASSA R5"
 },
 {
  "site": "GAILL",
  "nomVendeur": "CHRISTIAN CAUQUIL",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "15:00-16:00",
  "client": "DABLANC Kangoo"
 },
 {
  "site": "GAILL",
  "nomVendeur": "CHRISTIAN CAUQUIL",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "17:00-18:00",
  "client": "AUZAN R5"
 },
 {
  "site": "GAILL",
  "nomVendeur": "JULIEN SEBE",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "09:00-10:00",
  "client": "VARLET Megane"
 },
 {
  "site": "GAILL",
  "nomVendeur": "JULIEN SEBE",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "09:00-10:00",
  "client": "PATAQUI R5"
 },
 {
  "site": "GAILL",
  "nomVendeur": "JULIEN SEBE",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "10:00-11:00",
  "client": "LEVY Captur"
 },
 {
  "site": "GAILL",
  "nomVendeur": "JULIEN SEBE",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "10:00-11:00",
  "client": "CHAPLIN Clio"
 },
 {
  "site": "GAILL",
  "nomVendeur": "JULIEN SEBE",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "11:00-12:00",
  "client": "PEREZ Captur"
 },
 {
  "site": "GAILL",
  "nomVendeur": "JULIEN SEBE",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "14:00-15:00",
  "client": "PANADERO Twingo"
 },
 {
  "site": "GAILL",
  "nomVendeur": "JULIEN SEBE",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "14:00-15:00",
  "client": "MOSTARDI Twingo"
 },
 {
  "site": "GAILL",
  "nomVendeur": "JULIEN SEBE",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "15:00-16:00",
  "client": "MARIE Megane"
 },
 {
  "site": "GAILL",
  "nomVendeur": "JULIEN SEBE",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "15:00-16:00",
  "client": "PORTAL Clio"
 },
 {
  "site": "GAILL",
  "nomVendeur": "JULIEN SEBE",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "16:00-17:00",
  "client": "DEMEURE Espace"
 },
 {
  "site": "GAILL",
  "nomVendeur": "JULIEN SEBE",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "16:00-17:00",
  "client": "NAVARRO Twingo"
 },
 {
  "site": "GAILL",
  "nomVendeur": "JULIEN SEBE",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "16:00-17:00",
  "client": "FILLION E Tech"
 },
 {
  "site": "GAILL",
  "nomVendeur": "JULIEN SEBE",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "17:00-18:00",
  "client": "SALANDIN Austral"
 },
 {
  "site": "GAILL",
  "nomVendeur": "JULIEN SEBE",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "17:00-18:00",
  "client": "GOMEZ Twingo"
 },
 {
  "site": "GAILL",
  "nomVendeur": "JULIEN SEBE",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "18:00-19:00",
  "client": "LEFEVRE Scenic"
 },
 {
  "site": "GAILL",
  "nomVendeur": "GUILLAUME SEGUI",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "09:00-10:00",
  "client": "BARRE Megane"
 },
 {
  "site": "GAILL",
  "nomVendeur": "GUILLAUME SEGUI",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "09:00-10:00",
  "client": "BARTHE R5"
 },
 {
  "site": "GAILL",
  "nomVendeur": "GUILLAUME SEGUI",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "10:00-11:00",
  "client": "BIBAL Clio"
 },
 {
  "site": "GAILL",
  "nomVendeur": "GUILLAUME SEGUI",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "11:00-12:00",
  "client": "BELIERE Clio"
 },
 {
  "site": "GAILL",
  "nomVendeur": "GUILLAUME SEGUI",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "14:00-15:00",
  "client": "FIGUIERE R5"
 },
 {
  "site": "GAILL",
  "nomVendeur": "GUILLAUME SEGUI",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "15:00-16:00",
  "client": "BALKE Captur"
 },
 {
  "site": "GAILL",
  "nomVendeur": "GUILLAUME SEGUI",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "15:00-16:00",
  "client": "PIBERNAT Twingo"
 },
 {
  "site": "GAILL",
  "nomVendeur": "GUILLAUME SEGUI",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "16:00-17:00",
  "client": "BONNET Kangoo"
 },
 {
  "site": "GAILL",
  "nomVendeur": "GUILLAUME SEGUI",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "17:00-18:00",
  "client": "SOULIE Twingo"
 },
 {
  "site": "GAILL",
  "nomVendeur": "GUILLAUME SEGUI",
  "marque": "DACIA",
  "jour": "2026-06-11",
  "creneau": "10:00-11:00",
  "client": "DELMAS Sandero"
 },
 {
  "site": "GAILL",
  "nomVendeur": "GUILLAUME SEGUI",
  "marque": "DACIA",
  "jour": "2026-06-12",
  "creneau": "16:00-17:00",
  "client": "MILLET Spring"
 },
 {
  "site": "GAILL",
  "nomVendeur": "FLAVIEN MILLON",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "10:00-11:00",
  "client": "GRANGE Twingo"
 },
 {
  "site": "GAILL",
  "nomVendeur": "FLAVIEN MILLON",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "10:00-11:00",
  "client": "DUBUY Clio"
 },
 {
  "site": "GAILL",
  "nomVendeur": "FLAVIEN MILLON",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "11:00-12:00",
  "client": "ANTERIEUR Kex"
 },
 {
  "site": "GAILL",
  "nomVendeur": "FLAVIEN MILLON",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "14:00-15:00",
  "client": "TRAPAS Twingo"
 },
 {
  "site": "GAILL",
  "nomVendeur": "FLAVIEN MILLON",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "14:00-15:00",
  "client": "BERNARDIN Clio"
 },
 {
  "site": "GAILL",
  "nomVendeur": "FLAVIEN MILLON",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "16:00-17:00",
  "client": "TAILLEFER Clio"
 },
 {
  "site": "GAILL",
  "nomVendeur": "FLAVIEN MILLON",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "17:00-18:00",
  "client": "SOULA Megane"
 },
 {
  "site": "GAILL",
  "nomVendeur": "FLAVIEN MILLON",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "17:00-18:00",
  "client": "ROBIN Clio"
 },
 {
  "site": "GAILL",
  "nomVendeur": "FLAVIEN MILLON",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "18:00-19:00",
  "client": "NAVARRO R5"
 },
 {
  "site": "GAILL",
  "nomVendeur": "FLAVIEN MILLON",
  "marque": "DACIA",
  "jour": "2026-06-12",
  "creneau": "10:00-11:00",
  "client": "RAHAL Jogger"
 },
 {
  "site": "ALBI",
  "nomVendeur": "DANIEL DIAS FERNANDES",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "09:00-10:00",
  "client": "DELEBECQUE Scenic"
 },
 {
  "site": "ALBI",
  "nomVendeur": "DANIEL DIAS FERNANDES",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "11:00-12:00",
  "client": "SAUVAGE Captur"
 },
 {
  "site": "ALBI",
  "nomVendeur": "DANIEL DIAS FERNANDES",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "15:00-16:00",
  "client": "CHALIEZ Clio"
 },
 {
  "site": "ALBI",
  "nomVendeur": "DANIEL DIAS FERNANDES",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "17:00-18:00",
  "client": "LIMOUZY Rafale"
 },
 {
  "site": "ALBI",
  "nomVendeur": "DANIEL DIAS FERNANDES",
  "marque": "DACIA",
  "jour": "2026-06-11",
  "creneau": "10:00-11:00",
  "client": "FORMAGE Sandero"
 },
 {
  "site": "ALBI",
  "nomVendeur": "DANIEL DIAS FERNANDES",
  "marque": "DACIA",
  "jour": "2026-06-13",
  "creneau": "10:00-11:00",
  "client": "TISSIER Spring"
 },
 {
  "site": "ALBI",
  "nomVendeur": "DANIEL DIAS FERNANDES",
  "marque": "DACIA",
  "jour": "2026-06-12",
  "creneau": "11:00-12:00",
  "client": "ABBES Sandero"
 },
 {
  "site": "ALBI",
  "nomVendeur": "DANIEL DIAS FERNANDES",
  "marque": "DACIA",
  "jour": "2026-06-13",
  "creneau": "11:00-12:00",
  "client": "MONCHAMP Spring"
 },
 {
  "site": "ALBI",
  "nomVendeur": "DANIEL DIAS FERNANDES",
  "marque": "DACIA",
  "jour": "2026-06-15",
  "creneau": "12:00-13:00",
  "client": "DELAIRE Sandero"
 },
 {
  "site": "ALBI",
  "nomVendeur": "DANIEL DIAS FERNANDES",
  "marque": "DACIA",
  "jour": "2026-06-11",
  "creneau": "14:00-15:00",
  "client": "MASSA Spring"
 },
 {
  "site": "ALBI",
  "nomVendeur": "DANIEL DIAS FERNANDES",
  "marque": "DACIA",
  "jour": "2026-06-11",
  "creneau": "15:00-16:00",
  "client": "LAUNAY Twingo"
 },
 {
  "site": "ALBI",
  "nomVendeur": "DANIEL DIAS FERNANDES",
  "marque": "DACIA",
  "jour": "2026-06-11",
  "creneau": "16:00-17:00",
  "client": "DRAGUTIN R5"
 },
 {
  "site": "ALBI",
  "nomVendeur": "AURÉLIE BOMPART",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "10:00-11:00",
  "client": "PERRINE Kangoo"
 },
 {
  "site": "ALBI",
  "nomVendeur": "AURÉLIE BOMPART",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "10:00-11:00",
  "client": "COUDOURNAC R4"
 },
 {
  "site": "ALBI",
  "nomVendeur": "AURÉLIE BOMPART",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "11:00-12:00",
  "client": "DEFAUS Megane"
 },
 {
  "site": "ALBI",
  "nomVendeur": "AURÉLIE BOMPART",
  "marque": "RENAULT",
  "jour": "2026-06-15",
  "creneau": "17:00-18:00",
  "client": "MERCIER R5"
 },
 {
  "site": "ALBI",
  "nomVendeur": "AURÉLIE BOMPART",
  "marque": "DACIA",
  "jour": "2026-06-13",
  "creneau": "14:00-15:00",
  "client": "ALBOUY Sandero"
 },
 {
  "site": "ALBI",
  "nomVendeur": "FLORENT THOMASSIN",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "08:00-09:00",
  "client": "DELRIEU Arkana"
 },
 {
  "site": "ALBI",
  "nomVendeur": "FLORENT THOMASSIN",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "10:00-11:00",
  "client": "DA SILVA Scenic"
 },
 {
  "site": "ALBI",
  "nomVendeur": "FLORENT THOMASSIN",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "10:00-11:00",
  "client": "LAURENT Captur"
 },
 {
  "site": "ALBI",
  "nomVendeur": "FLORENT THOMASSIN",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "11:00-12:00",
  "client": "CAUGUEZ R5"
 },
 {
  "site": "ALBI",
  "nomVendeur": "FLORENT THOMASSIN",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "11:00-12:00",
  "client": "LEVIGUELOUX R5"
 },
 {
  "site": "ALBI",
  "nomVendeur": "FLORENT THOMASSIN",
  "marque": "RENAULT",
  "jour": "2026-06-14",
  "creneau": "11:00-12:00",
  "client": "TASSEL R5"
 },
 {
  "site": "ALBI",
  "nomVendeur": "FLORENT THOMASSIN",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "12:00-13:00",
  "client": "GAVALDA TWINGO"
 },
 {
  "site": "ALBI",
  "nomVendeur": "FLORENT THOMASSIN",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "14:00-15:00",
  "client": "ORTHE Captur"
 },
 {
  "site": "ALBI",
  "nomVendeur": "FLORENT THOMASSIN",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "14:00-15:00",
  "client": "SOUNGOULA Austral"
 },
 {
  "site": "ALBI",
  "nomVendeur": "FLORENT THOMASSIN",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "14:00-15:00",
  "client": "THOUNANA Captur"
 },
 {
  "site": "ALBI",
  "nomVendeur": "FLORENT THOMASSIN",
  "marque": "RENAULT",
  "jour": "2026-06-14",
  "creneau": "14:00-15:00",
  "client": "VILLEDIEU CLIO"
 },
 {
  "site": "ALBI",
  "nomVendeur": "FLORENT THOMASSIN",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "15:00-16:00",
  "client": "MARTINAUD Twingo"
 },
 {
  "site": "ALBI",
  "nomVendeur": "FLORENT THOMASSIN",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "15:00-16:00",
  "client": "CHARTROU Austral"
 },
 {
  "site": "ALBI",
  "nomVendeur": "FLORENT THOMASSIN",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "16:00-17:00",
  "client": "CAZELLE Captur"
 },
 {
  "site": "ALBI",
  "nomVendeur": "FLORENT THOMASSIN",
  "marque": "RENAULT",
  "jour": "2026-06-15",
  "creneau": "16:00-17:00",
  "client": "DUCROS Twingo"
 },
 {
  "site": "ALBI",
  "nomVendeur": "FLORENT THOMASSIN",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "17:00-18:00",
  "client": "RUDELLE Clio"
 },
 {
  "site": "ALBI",
  "nomVendeur": "FLORENT THOMASSIN",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "17:00-18:00",
  "client": "BIAU Clio"
 },
 {
  "site": "ALBI",
  "nomVendeur": "FLORENT THOMASSIN",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "17:00-18:00",
  "client": "BOURDON Clio"
 },
 {
  "site": "CARM",
  "nomVendeur": "GEOFFREY SALGUES",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "10:00-11:00",
  "client": "ROUSSILHES Clio"
 },
 {
  "site": "CARM",
  "nomVendeur": "GEOFFREY SALGUES",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "10:00-11:00",
  "client": "ASSIE Captur"
 },
 {
  "site": "CARM",
  "nomVendeur": "GEOFFREY SALGUES",
  "marque": "RENAULT",
  "jour": "2026-06-14",
  "creneau": "10:00-11:00",
  "client": "DASTE Captur"
 },
 {
  "site": "CARM",
  "nomVendeur": "GEOFFREY SALGUES",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "15:00-16:00",
  "client": "BEAUGENDRE R4"
 },
 {
  "site": "CARM",
  "nomVendeur": "GEOFFREY SALGUES",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "16:00-17:00",
  "client": "RAYSSAC Megane"
 },
 {
  "site": "CARM",
  "nomVendeur": "GEOFFREY SALGUES",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "16:00-17:00",
  "client": "HERAIL Megane"
 },
 {
  "site": "CARM",
  "nomVendeur": "GEOFFREY SALGUES",
  "marque": "DACIA",
  "jour": "2026-06-12",
  "creneau": "09:00-10:00",
  "client": "CANTAGREL Sandero"
 },
 {
  "site": "CARM",
  "nomVendeur": "GEOFFREY SALGUES",
  "marque": "DACIA",
  "jour": "2026-06-15",
  "creneau": "09:00-10:00",
  "client": "BACHELERI Bigster"
 },
 {
  "site": "CARM",
  "nomVendeur": "GEOFFREY SALGUES",
  "marque": "DACIA",
  "jour": "2026-06-11",
  "creneau": "10:00-11:00",
  "client": "PICARD Duster"
 },
 {
  "site": "CARM",
  "nomVendeur": "GEOFFREY SALGUES",
  "marque": "DACIA",
  "jour": "2026-06-15",
  "creneau": "10:00-11:00",
  "client": "ISSALLI Sandero"
 },
 {
  "site": "CARM",
  "nomVendeur": "GEOFFREY SALGUES",
  "marque": "DACIA",
  "jour": "2026-06-12",
  "creneau": "11:00-12:00",
  "client": "GANGLOF Sandero"
 },
 {
  "site": "CARM",
  "nomVendeur": "GEOFFREY SALGUES",
  "marque": "DACIA",
  "jour": "2026-06-11",
  "creneau": "14:00-15:00",
  "client": "ALLEGRE Sandero"
 },
 {
  "site": "CARM",
  "nomVendeur": "GEOFFREY SALGUES",
  "marque": "DACIA",
  "jour": "2026-06-13",
  "creneau": "14:00-15:00",
  "client": "GEMAIN Sandero"
 },
 {
  "site": "CARM",
  "nomVendeur": "GEOFFREY SALGUES",
  "marque": "DACIA",
  "jour": "2026-06-14",
  "creneau": "14:00-15:00",
  "client": "PUTEAU Sandero"
 },
 {
  "site": "CARM",
  "nomVendeur": "GEOFFREY SALGUES",
  "marque": "DACIA",
  "jour": "2026-06-15",
  "creneau": "14:00-15:00",
  "client": "KOSTIL Sandero"
 },
 {
  "site": "CARM",
  "nomVendeur": "GEOFFREY SALGUES",
  "marque": "DACIA",
  "jour": "2026-06-11",
  "creneau": "16:00-17:00",
  "client": "MAURAISIN Sandero"
 },
 {
  "site": "CARM",
  "nomVendeur": "GEOFFREY SALGUES",
  "marque": "DACIA",
  "jour": "2026-06-15",
  "creneau": "16:00-17:00",
  "client": "VERDIS Sandero"
 },
 {
  "site": "CARM",
  "nomVendeur": "GEOFFREY SALGUES",
  "marque": "DACIA",
  "jour": "2026-06-12",
  "creneau": "18:00-19:00",
  "client": "VERDIN Duster"
 },
 {
  "site": "CARM",
  "nomVendeur": "GEOFFREY SALGUES",
  "marque": "DACIA",
  "jour": "2026-06-15",
  "creneau": "18:00-19:00",
  "client": "MUNOZ Sandero"
 },
 {
  "site": "VDR",
  "nomVendeur": "MAGALI BRUGIER",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "09:00-10:00",
  "client": "BESSIERE TWINGO"
 },
 {
  "site": "VDR",
  "nomVendeur": "MAGALI BRUGIER",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "09:00-10:00",
  "client": "BONSANG CLIO"
 },
 {
  "site": "VDR",
  "nomVendeur": "MAGALI BRUGIER",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "10:00-11:00",
  "client": "ARTIGUES TWINGO"
 },
 {
  "site": "VDR",
  "nomVendeur": "MAGALI BRUGIER",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "14:00-15:00",
  "client": "LALOEUF TWINGO"
 },
 {
  "site": "VDR",
  "nomVendeur": "MAGALI BRUGIER",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "14:00-15:00",
  "client": "ROUZIES CAPTUR"
 },
 {
  "site": "VDR",
  "nomVendeur": "MAGALI BRUGIER",
  "marque": "RENAULT",
  "jour": "2026-06-15",
  "creneau": "14:00-15:00",
  "client": "LAGARRIGUE TWINGO"
 },
 {
  "site": "VDR",
  "nomVendeur": "MAGALI BRUGIER",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "15:00-16:00",
  "client": "CIPRIANO R5"
 },
 {
  "site": "VDR",
  "nomVendeur": "MAGALI BRUGIER",
  "marque": "RENAULT",
  "jour": "2026-06-15",
  "creneau": "15:00-16:00",
  "client": "AUDOUY R5"
 },
 {
  "site": "VDR",
  "nomVendeur": "MAGALI BRUGIER",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "16:00-17:00",
  "client": "CAPABIDY TWINGO"
 },
 {
  "site": "VDR",
  "nomVendeur": "MAGALI BRUGIER",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "17:00-18:00",
  "client": "ESTIVAL CAPTUR"
 },
 {
  "site": "VDR",
  "nomVendeur": "MAGALI BRUGIER",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "17:00-18:00",
  "client": "MARUEJOULS CLIO"
 },
 {
  "site": "VDR",
  "nomVendeur": "MAGALI BRUGIER",
  "marque": "RENAULT",
  "jour": "2026-06-15",
  "creneau": "17:00-18:00",
  "client": "PACHIN CLIO"
 },
 {
  "site": "VDR",
  "nomVendeur": "MAGALI BRUGIER",
  "marque": "DACIA",
  "jour": "2026-06-13",
  "creneau": "09:00-10:00",
  "client": "TOUPENSE DUSTER"
 },
 {
  "site": "VDR",
  "nomVendeur": "MAGALI BRUGIER",
  "marque": "DACIA",
  "jour": "2026-06-11",
  "creneau": "10:00-11:00",
  "client": "LATAPIE DUSTER"
 },
 {
  "site": "VDR",
  "nomVendeur": "MAGALI BRUGIER",
  "marque": "DACIA",
  "jour": "2026-06-12",
  "creneau": "10:00-11:00",
  "client": "CHAMEROYS DUSTER"
 },
 {
  "site": "VDR",
  "nomVendeur": "MAGALI BRUGIER",
  "marque": "DACIA",
  "jour": "2026-06-15",
  "creneau": "10:00-11:00",
  "client": "GINESTE SANDERO"
 },
 {
  "site": "VDR",
  "nomVendeur": "MAGALI BRUGIER",
  "marque": "DACIA",
  "jour": "2026-06-13",
  "creneau": "14:00-15:00",
  "client": "MOGADOR SPRING"
 },
 {
  "site": "VDR",
  "nomVendeur": "THOMAS BERT",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "09:00-10:00",
  "client": "DAENILKIT TRAFIC"
 },
 {
  "site": "VDR",
  "nomVendeur": "THOMAS BERT",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "10:00-11:00",
  "client": "BERT R5"
 },
 {
  "site": "VDR",
  "nomVendeur": "THOMAS BERT",
  "marque": "RENAULT",
  "jour": "2026-06-15",
  "creneau": "10:00-11:00",
  "client": "POIGNANT MEGANE"
 },
 {
  "site": "VDR",
  "nomVendeur": "THOMAS BERT",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "16:00-17:00",
  "client": "CONTE CLIO 6"
 },
 {
  "site": "VDR",
  "nomVendeur": "THOMAS BERT",
  "marque": "DACIA",
  "jour": "2026-06-11",
  "creneau": "10:00-11:00",
  "client": "DEFOIS DUSTER BIGSTER"
 },
 {
  "site": "VDR",
  "nomVendeur": "THOMAS BERT",
  "marque": "DACIA",
  "jour": "2026-06-12",
  "creneau": "10:00-11:00",
  "client": "LEGRUE DUSTER"
 },
 {
  "site": "VDR",
  "nomVendeur": "THOMAS BERT",
  "marque": "DACIA",
  "jour": "2026-06-11",
  "creneau": "14:00-15:00",
  "client": "GILBERT"
 },
 {
  "site": "VDR",
  "nomVendeur": "THOMAS BERT",
  "marque": "DACIA",
  "jour": "2026-06-13",
  "creneau": "14:00-15:00",
  "client": "JORIS DUSTER"
 },
 {
  "site": "VDR",
  "nomVendeur": "THOMAS BERT",
  "marque": "DACIA",
  "jour": "2026-06-12",
  "creneau": "15:00-16:00",
  "client": "ROQUES SPRING"
 },
 {
  "site": "FIGEAC",
  "nomVendeur": "DORIAN ALLEGRE",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "09:00-10:00",
  "client": "bagreo twingo"
 },
 {
  "site": "FIGEAC",
  "nomVendeur": "DORIAN ALLEGRE",
  "marque": "RENAULT",
  "jour": "2026-06-14",
  "creneau": "09:00-10:00",
  "client": "BOMBAISI CLIO 6"
 },
 {
  "site": "FIGEAC",
  "nomVendeur": "DORIAN ALLEGRE",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "11:00-12:00",
  "client": "COSSARD CLIO"
 },
 {
  "site": "FIGEAC",
  "nomVendeur": "DORIAN ALLEGRE",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "14:00-15:00",
  "client": "calmels clio"
 },
 {
  "site": "FIGEAC",
  "nomVendeur": "DORIAN ALLEGRE",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "14:00-15:00",
  "client": "ERVIE TWINGO"
 },
 {
  "site": "FIGEAC",
  "nomVendeur": "DORIAN ALLEGRE",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "15:00-16:00",
  "client": "chambon austral"
 },
 {
  "site": "FIGEAC",
  "nomVendeur": "DORIAN ALLEGRE",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "17:00-18:00",
  "client": "CHANDELIER AUSTRAL"
 },
 {
  "site": "FIGEAC",
  "nomVendeur": "DORIAN ALLEGRE",
  "marque": "DACIA",
  "jour": "2026-06-12",
  "creneau": "10:00-11:00",
  "client": "ARIES SANDERO"
 },
 {
  "site": "FIGEAC",
  "nomVendeur": "DORIAN ALLEGRE",
  "marque": "DACIA",
  "jour": "2026-06-13",
  "creneau": "11:00-12:00",
  "client": "SALLES SPRING"
 },
 {
  "site": "FIGEAC",
  "nomVendeur": "DORIAN ALLEGRE",
  "marque": "DACIA",
  "jour": "2026-06-13",
  "creneau": "16:00-17:00",
  "client": "CIPIERE SPRING"
 },
 {
  "site": "FIGEAC",
  "nomVendeur": "DORIAN ALLEGRE",
  "marque": "DACIA",
  "jour": "2026-06-15",
  "creneau": "16:00-17:00",
  "client": "mazard spring"
 },
 {
  "site": "FIGEAC",
  "nomVendeur": "DORIAN ALLEGRE",
  "marque": "DACIA",
  "jour": "2026-06-12",
  "creneau": "17:00-18:00",
  "client": "LABRE SANDERO"
 },
 {
  "site": "FIGEAC",
  "nomVendeur": "MATIS BRUNO",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "09:00-10:00",
  "client": "PEGOURIE R5"
 },
 {
  "site": "FIGEAC",
  "nomVendeur": "MATIS BRUNO",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "09:00-10:00",
  "client": "TEYSSEDOU CLIO6"
 },
 {
  "site": "FIGEAC",
  "nomVendeur": "MATIS BRUNO",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "11:00-12:00",
  "client": "GOACHET AUSTRAL"
 },
 {
  "site": "FIGEAC",
  "nomVendeur": "MATIS BRUNO",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "11:00-12:00",
  "client": "hotzalari clio 6"
 },
 {
  "site": "FIGEAC",
  "nomVendeur": "MATIS BRUNO",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "14:00-15:00",
  "client": "BERTHIN SCENIC"
 },
 {
  "site": "FIGEAC",
  "nomVendeur": "MATIS BRUNO",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "14:00-15:00",
  "client": "GUILIVERT CLIO"
 },
 {
  "site": "FIGEAC",
  "nomVendeur": "MATIS BRUNO",
  "marque": "RENAULT",
  "jour": "2026-06-13",
  "creneau": "16:00-17:00",
  "client": "AMIEL CLIO"
 },
 {
  "site": "FIGEAC",
  "nomVendeur": "MATIS BRUNO",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "17:00-18:00",
  "client": "MARTY R5"
 },
 {
  "site": "FIGEAC",
  "nomVendeur": "MATIS BRUNO",
  "marque": "DACIA",
  "jour": "2026-06-12",
  "creneau": "10:00-11:00",
  "client": "BRUN SANDERO"
 },
 {
  "site": "FIGEAC",
  "nomVendeur": "CLÉMENT MALGOUZOU",
  "marque": "RENAULT",
  "jour": "2026-06-11",
  "creneau": "10:00-11:00",
  "client": "GALTHIER CAPTUR"
 },
 {
  "site": "FIGEAC",
  "nomVendeur": "CLÉMENT MALGOUZOU",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "11:00-12:00",
  "client": "COSTE SANDERO"
 },
 {
  "site": "FIGEAC",
  "nomVendeur": "CLÉMENT MALGOUZOU",
  "marque": "RENAULT",
  "jour": "2026-06-15",
  "creneau": "11:00-12:00",
  "client": "FAURE CAPTUR"
 },
 {
  "site": "FIGEAC",
  "nomVendeur": "CLÉMENT MALGOUZOU",
  "marque": "RENAULT",
  "jour": "2026-06-12",
  "creneau": "18:00-19:00",
  "client": "DEBORD SCENIC"
 },
 {
  "site": "FIGEAC",
  "nomVendeur": "CLÉMENT MALGOUZOU",
  "marque": "DACIA",
  "jour": "2026-06-11",
  "creneau": "18:00-19:00",
  "client": "SENTIS BIGSTER SPRING"
 }
];
