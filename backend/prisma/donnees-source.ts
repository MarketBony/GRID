// ============================================================================
// DONNEES SOURCE — extraites de `seed_referentiels.sql` par
// `scripts/extraire-seed.mjs`. NE PAS EDITER A LA MAIN : rejouer l'extraction.
//
// Origine : tableau_phoning_reltel_JUIN_(2).xlsx.
// Comptes verifies a l'extraction : 4 plaques, 19 sites,
// 99 vendeurs, 8 tables, 48 affectations.
//
// ATTENTION SUR `marques` — cette donnee N'EXISTE PAS dans le fichier Excel :
// tous les blocs vendeur y portent une section Renault ET une section Dacia,
// quelle que soit la realite du terrain. Ce qui suit est donc un PLACEHOLDER, a
// corriger vendeur par vendeur via l'ecran A3 AVANT la mise en service. Tant que
// ce n'est pas fait, la regle R-C.1 ne protege rien.
// ============================================================================

export const PLAQUES = [
  {
    "libelle": "CENTRE",
    "alias": "EAA",
    "ordre": 1
  },
  {
    "libelle": "NORD",
    "alias": null,
    "ordre": 2
  },
  {
    "libelle": "SUD",
    "alias": null,
    "ordre": 3
  },
  {
    "libelle": "SUD-OUEST",
    "alias": null,
    "ordre": 4
  }
] as const;

export const SITES = [
  {
    "code": "MASS",
    "libelle": "Massagettes",
    "plaque": "CENTRE"
  },
  {
    "code": "MOZ",
    "libelle": "Mozac",
    "plaque": "CENTRE"
  },
  {
    "code": "CLF",
    "libelle": "Clermont-Ferrand",
    "plaque": "CENTRE"
  },
  {
    "code": "USS",
    "libelle": "Ussel",
    "plaque": "CENTRE"
  },
  {
    "code": "ALPINE",
    "libelle": "Alpine",
    "plaque": "CENTRE"
  },
  {
    "code": "VI",
    "libelle": "Vichy",
    "plaque": "NORD"
  },
  {
    "code": "MOU",
    "libelle": "Moulins",
    "plaque": "NORD"
  },
  {
    "code": "TH",
    "libelle": "Thiers",
    "plaque": "NORD"
  },
  {
    "code": "PUY",
    "libelle": "Le Puy",
    "plaque": "SUD"
  },
  {
    "code": "MEN",
    "libelle": "Mende",
    "plaque": "SUD"
  },
  {
    "code": "ISS",
    "libelle": "Issoire",
    "plaque": "SUD"
  },
  {
    "code": "GAILL",
    "libelle": "Gaillac",
    "plaque": "SUD-OUEST"
  },
  {
    "code": "ALBI",
    "libelle": "Albi",
    "plaque": "SUD-OUEST"
  },
  {
    "code": "RDZ",
    "libelle": "Rodez",
    "plaque": "SUD-OUEST"
  },
  {
    "code": "MILL",
    "libelle": "Millau",
    "plaque": "SUD-OUEST"
  },
  {
    "code": "FIGEAC",
    "libelle": "Figeac",
    "plaque": "SUD-OUEST"
  },
  {
    "code": "AUR",
    "libelle": "Aurillac",
    "plaque": "SUD-OUEST"
  },
  {
    "code": "VDR",
    "libelle": "Villefranche",
    "plaque": "SUD-OUEST"
  },
  {
    "code": "CARM",
    "libelle": "Carmaux",
    "plaque": "SUD-OUEST"
  }
] as const;

export const VENDEURS = [
  {
    "nom": "QUENTIN VANINI",
    "site": "MASS",
    "marques": [
      "RENAULT",
      "DACIA"
    ]
  },
  {
    "nom": "VIRGINIE CUMINAL",
    "site": "MASS",
    "marques": [
      "RENAULT",
      "DACIA"
    ]
  },
  {
    "nom": "ANTHONY DONAS",
    "site": "MOZ",
    "marques": [
      "RENAULT",
      "DACIA"
    ]
  },
  {
    "nom": "JORDAN CALDEIRA",
    "site": "MOZ",
    "marques": [
      "RENAULT",
      "DACIA"
    ]
  },
  {
    "nom": "ROBIN RABOISSON",
    "site": "MOZ",
    "marques": [
      "RENAULT",
      "DACIA"
    ]
  },
  {
    "nom": "KEVIN DIJOUX",
    "site": "MOZ",
    "marques": [
      "RENAULT",
      "DACIA"
    ]
  },
  {
    "nom": "UGO FERVEL",
    "site": "MOZ",
    "marques": [
      "RENAULT",
      "DACIA"
    ]
  },
  {
    "nom": "YANN DE OLIVEIRA",
    "site": "MOZ",
    "marques": [
      "RENAULT",
      "DACIA"
    ]
  },
  {
    "nom": "MATTHIAS VALLE",
    "site": "MOZ",
    "marques": [
      "RENAULT",
      "DACIA"
    ]
  },
  {
    "nom": "VALENTIN PARPINELLI",
    "site": "CLF",
    "marques": [
      "RENAULT",
      "DACIA"
    ]
  },
  {
    "nom": "THIERRY DUBERNAT",
    "site": "CLF",
    "marques": [
      "RENAULT",
      "DACIA"
    ]
  },
  {
    "nom": "OCEANE ESPINASSE",
    "site": "CLF",
    "marques": [
      "RENAULT",
      "DACIA"
    ]
  },
  {
    "nom": "BLANDINE CLÉMENT",
    "site": "CLF",
    "marques": [
      "RENAULT",
      "DACIA"
    ]
  },
  {
    "nom": "THOMAS SOULIER",
    "site": "CLF",
    "marques": [
      "RENAULT",
      "DACIA"
    ]
  },
  {
    "nom": "CHRISTOPHE BROSSEAU",
    "site": "CLF",
    "marques": [
      "RENAULT",
      "DACIA"
    ]
  },
  {
    "nom": "THÉO ROUSSET",
    "site": "CLF",
    "marques": [
      "RENAULT",
      "DACIA"
    ]
  },
  {
    "nom": "QUENTIN BELLAIGUES",
    "site": "CLF",
    "marques": [
      "RENAULT",
      "DACIA"
    ]
  },
  {
    "nom": "JEAN-PIERRE FERRIER",
    "site": "CLF",
    "marques": [
      "RENAULT",
      "DACIA"
    ]
  },
  {
    "nom": "JULIEN BIASUTTI",
    "site": "CLF",
    "marques": [
      "RENAULT",
      "DACIA"
    ]
  },
  {
    "nom": "PIERRE-EDOUARD LAROCHE",
    "site": "CLF",
    "marques": [
      "RENAULT",
      "DACIA"
    ]
  },
  {
    "nom": "ANTOINE BASTIEN",
    "site": "CLF",
    "marques": [
      "RENAULT",
      "DACIA"
    ]
  },
  {
    "nom": "DYLAN GUERRET",
    "site": "CLF",
    "marques": [
      "RENAULT",
      "DACIA"
    ]
  },
  {
    "nom": "JOAO TEIXEIRA",
    "site": "CLF",
    "marques": [
      "RENAULT",
      "DACIA"
    ]
  },
  {
    "nom": "THIERRY MARTINEZ",
    "site": "CLF",
    "marques": [
      "RENAULT",
      "DACIA"
    ]
  },
  {
    "nom": "JEROME SABIN",
    "site": "CLF",
    "marques": [
      "RENAULT",
      "DACIA"
    ]
  },
  {
    "nom": "ROBIN GUERY",
    "site": "USS",
    "marques": [
      "RENAULT",
      "DACIA"
    ]
  },
  {
    "nom": "JULIEN SPADAT",
    "site": "USS",
    "marques": [
      "RENAULT",
      "DACIA"
    ]
  },
  {
    "nom": "STÉPHANE VANDAMME",
    "site": "USS",
    "marques": [
      "RENAULT",
      "DACIA"
    ]
  },
  {
    "nom": "SÉBASTIEN MIRA",
    "site": "ALPINE",
    "marques": [
      "ALPINE"
    ]
  },
  {
    "nom": "EMILIEN SOLEILHAVOUP",
    "site": "ALPINE",
    "marques": [
      "ALPINE"
    ]
  },
  {
    "nom": "ALEXANDRE CHAVIGNON",
    "site": "VI",
    "marques": [
      "RENAULT",
      "DACIA"
    ]
  },
  {
    "nom": "MICHEL GUILLERM",
    "site": "VI",
    "marques": [
      "RENAULT",
      "DACIA"
    ]
  },
  {
    "nom": "ALEXANDRE DIOT",
    "site": "VI",
    "marques": [
      "RENAULT",
      "DACIA"
    ]
  },
  {
    "nom": "DYLAN MEYRIAL",
    "site": "VI",
    "marques": [
      "RENAULT",
      "DACIA"
    ]
  },
  {
    "nom": "YOANN TRIBOULET",
    "site": "VI",
    "marques": [
      "RENAULT",
      "DACIA"
    ]
  },
  {
    "nom": "MATTIS BONNAMOUR",
    "site": "VI",
    "marques": [
      "RENAULT",
      "DACIA"
    ]
  },
  {
    "nom": "VIKTORIIA BONDARENKO",
    "site": "VI",
    "marques": [
      "RENAULT",
      "DACIA"
    ]
  },
  {
    "nom": "NICOLAS BOUCHET",
    "site": "VI",
    "marques": [
      "RENAULT",
      "DACIA"
    ]
  },
  {
    "nom": "CLÉMENT JACQUET",
    "site": "VI",
    "marques": [
      "RENAULT",
      "DACIA"
    ]
  },
  {
    "nom": "ROMARIC RAMBERT",
    "site": "VI",
    "marques": [
      "RENAULT",
      "DACIA"
    ]
  },
  {
    "nom": "CLÉMENT RAYA",
    "site": "VI",
    "marques": [
      "RENAULT",
      "DACIA"
    ]
  },
  {
    "nom": "SYLVETTE ROGUE",
    "site": "MOU",
    "marques": [
      "RENAULT",
      "DACIA"
    ]
  },
  {
    "nom": "SEBASTIEN DUBOST",
    "site": "MOU",
    "marques": [
      "RENAULT",
      "DACIA"
    ]
  },
  {
    "nom": "MARC PALUMBO",
    "site": "MOU",
    "marques": [
      "RENAULT",
      "DACIA"
    ]
  },
  {
    "nom": "PAULINE COIGNET",
    "site": "MOU",
    "marques": [
      "RENAULT",
      "DACIA"
    ]
  },
  {
    "nom": "JULIEN LE QUELLEC",
    "site": "MOU",
    "marques": [
      "RENAULT",
      "DACIA"
    ]
  },
  {
    "nom": "ROMAIN DENIS",
    "site": "MOU",
    "marques": [
      "RENAULT",
      "DACIA"
    ]
  },
  {
    "nom": "LOUIS DUBOST",
    "site": "TH",
    "marques": [
      "RENAULT",
      "DACIA"
    ]
  },
  {
    "nom": "CYNTHIA VALLIN",
    "site": "TH",
    "marques": [
      "RENAULT",
      "DACIA"
    ]
  },
  {
    "nom": "AXEL DUMONT",
    "site": "TH",
    "marques": [
      "RENAULT",
      "DACIA"
    ]
  },
  {
    "nom": "DAMIEN DAGOSTINO",
    "site": "TH",
    "marques": [
      "RENAULT",
      "DACIA"
    ]
  },
  {
    "nom": "ALEXANDRE PINOT",
    "site": "TH",
    "marques": [
      "RENAULT",
      "DACIA"
    ]
  },
  {
    "nom": "ARNAUD GALLAND",
    "site": "PUY",
    "marques": [
      "RENAULT",
      "DACIA"
    ]
  },
  {
    "nom": "GUILLAUME SAVINEL",
    "site": "PUY",
    "marques": [
      "RENAULT",
      "DACIA"
    ]
  },
  {
    "nom": "JEAN-PAUL RANVOISE",
    "site": "PUY",
    "marques": [
      "RENAULT",
      "DACIA"
    ]
  },
  {
    "nom": "ARTHUR DURANTON",
    "site": "PUY",
    "marques": [
      "RENAULT",
      "DACIA"
    ]
  },
  {
    "nom": "VALENTIN MOLINES",
    "site": "PUY",
    "marques": [
      "RENAULT",
      "DACIA"
    ]
  },
  {
    "nom": "RICHARD WEISSELDINGER",
    "site": "PUY",
    "marques": [
      "RENAULT",
      "DACIA"
    ]
  },
  {
    "nom": "JÉRÉMY DA COSTA",
    "site": "MEN",
    "marques": [
      "RENAULT",
      "DACIA"
    ]
  },
  {
    "nom": "DYLAN NOGUEIRA",
    "site": "MEN",
    "marques": [
      "RENAULT",
      "DACIA"
    ]
  },
  {
    "nom": "WILLIAM PASCAL",
    "site": "MEN",
    "marques": [
      "RENAULT",
      "DACIA"
    ]
  },
  {
    "nom": "YOANN PICARD",
    "site": "ISS",
    "marques": [
      "RENAULT",
      "DACIA"
    ]
  },
  {
    "nom": "STANISLAS RODAMEL",
    "site": "ISS",
    "marques": [
      "RENAULT",
      "DACIA"
    ]
  },
  {
    "nom": "JULIEN MONATTE",
    "site": "ISS",
    "marques": [
      "RENAULT",
      "DACIA"
    ]
  },
  {
    "nom": "MAGALI MICHEL",
    "site": "ISS",
    "marques": [
      "RENAULT",
      "DACIA"
    ]
  },
  {
    "nom": "AMÉLIE HERVÉ",
    "site": "ISS",
    "marques": [
      "RENAULT",
      "DACIA"
    ]
  },
  {
    "nom": "SÉBASTIEN DUMONT",
    "site": "ISS",
    "marques": [
      "RENAULT",
      "DACIA"
    ]
  },
  {
    "nom": "REDWANE TOULOUSE",
    "site": "ISS",
    "marques": [
      "RENAULT",
      "DACIA"
    ]
  },
  {
    "nom": "STÉPHANE DALLO-BELLESSA",
    "site": "ISS",
    "marques": [
      "RENAULT",
      "DACIA"
    ]
  },
  {
    "nom": "FRANCOIS LENAIC",
    "site": "ISS",
    "marques": [
      "RENAULT",
      "DACIA"
    ]
  },
  {
    "nom": "CHRISTIAN CAUQUIL",
    "site": "GAILL",
    "marques": [
      "RENAULT",
      "DACIA"
    ]
  },
  {
    "nom": "JULIEN SEBE",
    "site": "GAILL",
    "marques": [
      "RENAULT",
      "DACIA"
    ]
  },
  {
    "nom": "GUILLAUME SEGUI",
    "site": "GAILL",
    "marques": [
      "RENAULT",
      "DACIA"
    ]
  },
  {
    "nom": "FLAVIEN MILLON",
    "site": "GAILL",
    "marques": [
      "RENAULT",
      "DACIA"
    ]
  },
  {
    "nom": "DANIEL DIAS FERNANDES",
    "site": "ALBI",
    "marques": [
      "RENAULT",
      "DACIA"
    ]
  },
  {
    "nom": "AURÉLIE BOMPART",
    "site": "ALBI",
    "marques": [
      "RENAULT",
      "DACIA"
    ]
  },
  {
    "nom": "EMMA GUEGUEN",
    "site": "ALBI",
    "marques": [
      "RENAULT",
      "DACIA"
    ]
  },
  {
    "nom": "FLORENT THOMASSIN",
    "site": "ALBI",
    "marques": [
      "RENAULT",
      "DACIA"
    ]
  },
  {
    "nom": "ROMAIN BOISSONNADE",
    "site": "RDZ",
    "marques": [
      "RENAULT",
      "DACIA"
    ]
  },
  {
    "nom": "MARINE FLAUJAGUET",
    "site": "RDZ",
    "marques": [
      "RENAULT",
      "DACIA"
    ]
  },
  {
    "nom": "ALEXIS COMPANS",
    "site": "RDZ",
    "marques": [
      "RENAULT",
      "DACIA"
    ]
  },
  {
    "nom": "RÉMI DEGAND",
    "site": "RDZ",
    "marques": [
      "RENAULT",
      "DACIA"
    ]
  },
  {
    "nom": "ARNAUD LOPEZ",
    "site": "RDZ",
    "marques": [
      "RENAULT",
      "DACIA"
    ]
  },
  {
    "nom": "DORIAN FRANCE",
    "site": "RDZ",
    "marques": [
      "RENAULT",
      "DACIA"
    ]
  },
  {
    "nom": "DAMIEN RULHE",
    "site": "RDZ",
    "marques": [
      "RENAULT",
      "DACIA"
    ]
  },
  {
    "nom": "NICOLAS CAYRON",
    "site": "MILL",
    "marques": [
      "RENAULT",
      "DACIA"
    ]
  },
  {
    "nom": "MATHIS FRANCOIS",
    "site": "MILL",
    "marques": [
      "RENAULT",
      "DACIA"
    ]
  },
  {
    "nom": "ELSA AGRINIER",
    "site": "MILL",
    "marques": [
      "RENAULT",
      "DACIA"
    ]
  },
  {
    "nom": "DORIAN ALLEGRE",
    "site": "FIGEAC",
    "marques": [
      "RENAULT",
      "DACIA"
    ]
  },
  {
    "nom": "MATIS BRUNO",
    "site": "FIGEAC",
    "marques": [
      "RENAULT",
      "DACIA"
    ]
  },
  {
    "nom": "CLÉMENT MALGOUZOU",
    "site": "FIGEAC",
    "marques": [
      "RENAULT",
      "DACIA"
    ]
  },
  {
    "nom": "YOHAN BANYIK",
    "site": "AUR",
    "marques": [
      "RENAULT",
      "DACIA"
    ]
  },
  {
    "nom": "ROMAIN COMBOURIEU",
    "site": "AUR",
    "marques": [
      "RENAULT",
      "DACIA"
    ]
  },
  {
    "nom": "STÉPHANE SUC",
    "site": "AUR",
    "marques": [
      "RENAULT",
      "DACIA"
    ]
  },
  {
    "nom": "ANTONIN LUC",
    "site": "AUR",
    "marques": [
      "RENAULT",
      "DACIA"
    ]
  },
  {
    "nom": "MAGALI BRUGIER",
    "site": "VDR",
    "marques": [
      "RENAULT",
      "DACIA"
    ]
  },
  {
    "nom": "THOMAS BERT",
    "site": "VDR",
    "marques": [
      "RENAULT",
      "DACIA"
    ]
  },
  {
    "nom": "AZIZ CHOUAY",
    "site": "VDR",
    "marques": [
      "RENAULT",
      "DACIA"
    ]
  },
  {
    "nom": "GEOFFREY SALGUES",
    "site": "CARM",
    "marques": [
      "RENAULT",
      "DACIA"
    ]
  }
] as const;

/// Tables de juin 2026. `chef` est le nom lu dans le libelle d'origine : aucun de
/// ces 8 encadrants ne figure parmi les 99 vendeurs, ils n'ont pas de bloc de
/// saisie. Ils deviennent des utilisateurs, rattaches par `chefUtilisateurId`.
export const TABLES_JUIN = [
  {
    "libelleSource": "SÉVERINE BESSON — TABLE 1",
    "campagne": "Juin 2026",
    "plaque": "CENTRE",
    "libelle": "Table 1",
    "ordre": 1,
    "chef": "SÉVERINE BESSON"
  },
  {
    "libelleSource": "THIERRY COIGNAC — TABLE 2",
    "campagne": "Juin 2026",
    "plaque": "CENTRE",
    "libelle": "Table 2",
    "ordre": 2,
    "chef": "THIERRY COIGNAC"
  },
  {
    "libelleSource": "LUCIEN MARCHETTI — TABLE 3",
    "campagne": "Juin 2026",
    "plaque": "CENTRE",
    "libelle": "Table 3",
    "ordre": 3,
    "chef": "LUCIEN MARCHETTI"
  },
  {
    "libelleSource": "JF LARGET — TABLE 4",
    "campagne": "Juin 2026",
    "plaque": "CENTRE",
    "libelle": "Table 4",
    "ordre": 4,
    "chef": "JF LARGET"
  },
  {
    "libelleSource": "MICKAEL MASSON — TABLE 5",
    "campagne": "Juin 2026",
    "plaque": "CENTRE",
    "libelle": "Table 5",
    "ordre": 5,
    "chef": "MICKAEL MASSON"
  },
  {
    "libelleSource": "FRANCK NOGUES — TABLE 1",
    "campagne": "Juin 2026",
    "plaque": "SUD",
    "libelle": "Table 1",
    "ordre": 1,
    "chef": "FRANCK NOGUES"
  },
  {
    "libelleSource": "JÉRÔME HÉBERT — TABLE 2",
    "campagne": "Juin 2026",
    "plaque": "SUD",
    "libelle": "Table 2",
    "ordre": 2,
    "chef": "JÉRÔME HÉBERT"
  },
  {
    "libelleSource": "GILLES PARRAIN — TABLE 3",
    "campagne": "Juin 2026",
    "plaque": "SUD",
    "libelle": "Table 3",
    "ordre": 3,
    "chef": "GILLES PARRAIN"
  }
] as const;

export const AFFECTATIONS_JUIN = [
  {
    "campagne": "Juin 2026",
    "plaque": "CENTRE",
    "tableSource": "SÉVERINE BESSON — TABLE 1",
    "vendeur": "PIERRE-EDOUARD LAROCHE"
  },
  {
    "campagne": "Juin 2026",
    "plaque": "CENTRE",
    "tableSource": "SÉVERINE BESSON — TABLE 1",
    "vendeur": "ANTOINE BASTIEN"
  },
  {
    "campagne": "Juin 2026",
    "plaque": "CENTRE",
    "tableSource": "SÉVERINE BESSON — TABLE 1",
    "vendeur": "VALENTIN PARPINELLI"
  },
  {
    "campagne": "Juin 2026",
    "plaque": "CENTRE",
    "tableSource": "SÉVERINE BESSON — TABLE 1",
    "vendeur": "THIERRY DUBERNAT"
  },
  {
    "campagne": "Juin 2026",
    "plaque": "CENTRE",
    "tableSource": "SÉVERINE BESSON — TABLE 1",
    "vendeur": "JULIEN SPADAT"
  },
  {
    "campagne": "Juin 2026",
    "plaque": "CENTRE",
    "tableSource": "SÉVERINE BESSON — TABLE 1",
    "vendeur": "ROBIN RABOISSON"
  },
  {
    "campagne": "Juin 2026",
    "plaque": "CENTRE",
    "tableSource": "THIERRY COIGNAC — TABLE 2",
    "vendeur": "JEROME SABIN"
  },
  {
    "campagne": "Juin 2026",
    "plaque": "CENTRE",
    "tableSource": "THIERRY COIGNAC — TABLE 2",
    "vendeur": "DYLAN GUERRET"
  },
  {
    "campagne": "Juin 2026",
    "plaque": "CENTRE",
    "tableSource": "THIERRY COIGNAC — TABLE 2",
    "vendeur": "SÉBASTIEN MIRA"
  },
  {
    "campagne": "Juin 2026",
    "plaque": "CENTRE",
    "tableSource": "THIERRY COIGNAC — TABLE 2",
    "vendeur": "CHRISTOPHE BROSSEAU"
  },
  {
    "campagne": "Juin 2026",
    "plaque": "CENTRE",
    "tableSource": "THIERRY COIGNAC — TABLE 2",
    "vendeur": "ANTHONY DONAS"
  },
  {
    "campagne": "Juin 2026",
    "plaque": "CENTRE",
    "tableSource": "THIERRY COIGNAC — TABLE 2",
    "vendeur": "JORDAN CALDEIRA"
  },
  {
    "campagne": "Juin 2026",
    "plaque": "CENTRE",
    "tableSource": "LUCIEN MARCHETTI — TABLE 3",
    "vendeur": "BLANDINE CLÉMENT"
  },
  {
    "campagne": "Juin 2026",
    "plaque": "CENTRE",
    "tableSource": "LUCIEN MARCHETTI — TABLE 3",
    "vendeur": "JOAO TEIXEIRA"
  },
  {
    "campagne": "Juin 2026",
    "plaque": "CENTRE",
    "tableSource": "LUCIEN MARCHETTI — TABLE 3",
    "vendeur": "THÉO ROUSSET"
  },
  {
    "campagne": "Juin 2026",
    "plaque": "CENTRE",
    "tableSource": "LUCIEN MARCHETTI — TABLE 3",
    "vendeur": "QUENTIN BELLAIGUES"
  },
  {
    "campagne": "Juin 2026",
    "plaque": "CENTRE",
    "tableSource": "LUCIEN MARCHETTI — TABLE 3",
    "vendeur": "ROBIN GUERY"
  },
  {
    "campagne": "Juin 2026",
    "plaque": "CENTRE",
    "tableSource": "LUCIEN MARCHETTI — TABLE 3",
    "vendeur": "EMILIEN SOLEILHAVOUP"
  },
  {
    "campagne": "Juin 2026",
    "plaque": "CENTRE",
    "tableSource": "JF LARGET — TABLE 4",
    "vendeur": "THIERRY MARTINEZ"
  },
  {
    "campagne": "Juin 2026",
    "plaque": "CENTRE",
    "tableSource": "JF LARGET — TABLE 4",
    "vendeur": "OCEANE ESPINASSE"
  },
  {
    "campagne": "Juin 2026",
    "plaque": "CENTRE",
    "tableSource": "JF LARGET — TABLE 4",
    "vendeur": "JEAN-PIERRE FERRIER"
  },
  {
    "campagne": "Juin 2026",
    "plaque": "CENTRE",
    "tableSource": "JF LARGET — TABLE 4",
    "vendeur": "VIRGINIE CUMINAL"
  },
  {
    "campagne": "Juin 2026",
    "plaque": "CENTRE",
    "tableSource": "JF LARGET — TABLE 4",
    "vendeur": "KEVIN DIJOUX"
  },
  {
    "campagne": "Juin 2026",
    "plaque": "CENTRE",
    "tableSource": "JF LARGET — TABLE 4",
    "vendeur": "UGO FERVEL"
  },
  {
    "campagne": "Juin 2026",
    "plaque": "CENTRE",
    "tableSource": "MICKAEL MASSON — TABLE 5",
    "vendeur": "STÉPHANE VANDAMME"
  },
  {
    "campagne": "Juin 2026",
    "plaque": "CENTRE",
    "tableSource": "MICKAEL MASSON — TABLE 5",
    "vendeur": "YANN DE OLIVEIRA"
  },
  {
    "campagne": "Juin 2026",
    "plaque": "CENTRE",
    "tableSource": "MICKAEL MASSON — TABLE 5",
    "vendeur": "MATTHIAS VALLE"
  },
  {
    "campagne": "Juin 2026",
    "plaque": "CENTRE",
    "tableSource": "MICKAEL MASSON — TABLE 5",
    "vendeur": "QUENTIN VANINI"
  },
  {
    "campagne": "Juin 2026",
    "plaque": "CENTRE",
    "tableSource": "MICKAEL MASSON — TABLE 5",
    "vendeur": "JULIEN BIASUTTI"
  },
  {
    "campagne": "Juin 2026",
    "plaque": "CENTRE",
    "tableSource": "MICKAEL MASSON — TABLE 5",
    "vendeur": "THOMAS SOULIER"
  },
  {
    "campagne": "Juin 2026",
    "plaque": "SUD",
    "tableSource": "FRANCK NOGUES — TABLE 1",
    "vendeur": "YOANN PICARD"
  },
  {
    "campagne": "Juin 2026",
    "plaque": "SUD",
    "tableSource": "FRANCK NOGUES — TABLE 1",
    "vendeur": "DYLAN NOGUEIRA"
  },
  {
    "campagne": "Juin 2026",
    "plaque": "SUD",
    "tableSource": "FRANCK NOGUES — TABLE 1",
    "vendeur": "VALENTIN MOLINES"
  },
  {
    "campagne": "Juin 2026",
    "plaque": "SUD",
    "tableSource": "FRANCK NOGUES — TABLE 1",
    "vendeur": "GUILLAUME SAVINEL"
  },
  {
    "campagne": "Juin 2026",
    "plaque": "SUD",
    "tableSource": "FRANCK NOGUES — TABLE 1",
    "vendeur": "REDWANE TOULOUSE"
  },
  {
    "campagne": "Juin 2026",
    "plaque": "SUD",
    "tableSource": "FRANCK NOGUES — TABLE 1",
    "vendeur": "MAGALI MICHEL"
  },
  {
    "campagne": "Juin 2026",
    "plaque": "SUD",
    "tableSource": "JÉRÔME HÉBERT — TABLE 2",
    "vendeur": "JEAN-PAUL RANVOISE"
  },
  {
    "campagne": "Juin 2026",
    "plaque": "SUD",
    "tableSource": "JÉRÔME HÉBERT — TABLE 2",
    "vendeur": "ARTHUR DURANTON"
  },
  {
    "campagne": "Juin 2026",
    "plaque": "SUD",
    "tableSource": "JÉRÔME HÉBERT — TABLE 2",
    "vendeur": "AMÉLIE HERVÉ"
  },
  {
    "campagne": "Juin 2026",
    "plaque": "SUD",
    "tableSource": "JÉRÔME HÉBERT — TABLE 2",
    "vendeur": "SÉBASTIEN DUMONT"
  },
  {
    "campagne": "Juin 2026",
    "plaque": "SUD",
    "tableSource": "JÉRÔME HÉBERT — TABLE 2",
    "vendeur": "WILLIAM PASCAL"
  },
  {
    "campagne": "Juin 2026",
    "plaque": "SUD",
    "tableSource": "JÉRÔME HÉBERT — TABLE 2",
    "vendeur": "FRANCOIS LENAIC"
  },
  {
    "campagne": "Juin 2026",
    "plaque": "SUD",
    "tableSource": "GILLES PARRAIN — TABLE 3",
    "vendeur": "ARNAUD GALLAND"
  },
  {
    "campagne": "Juin 2026",
    "plaque": "SUD",
    "tableSource": "GILLES PARRAIN — TABLE 3",
    "vendeur": "RICHARD WEISSELDINGER"
  },
  {
    "campagne": "Juin 2026",
    "plaque": "SUD",
    "tableSource": "GILLES PARRAIN — TABLE 3",
    "vendeur": "JÉRÉMY DA COSTA"
  },
  {
    "campagne": "Juin 2026",
    "plaque": "SUD",
    "tableSource": "GILLES PARRAIN — TABLE 3",
    "vendeur": "STÉPHANE DALLO-BELLESSA"
  },
  {
    "campagne": "Juin 2026",
    "plaque": "SUD",
    "tableSource": "GILLES PARRAIN — TABLE 3",
    "vendeur": "STANISLAS RODAMEL"
  },
  {
    "campagne": "Juin 2026",
    "plaque": "SUD",
    "tableSource": "GILLES PARRAIN — TABLE 3",
    "vendeur": "JULIEN MONATTE"
  }
] as const;
