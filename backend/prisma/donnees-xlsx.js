"use strict";
// ============================================================================
// EXTRAIT DU CLASSEUR EXCEL par `scripts/extraire-xlsx.mjs`.
// NE PAS EDITER A LA MAIN : rejouer l'extraction.
//
// Source : tableau phoning reltel JUIN (2).xlsx, onglets RESULTATS et TABLES*.
//
// `type` est une donnee REELLE, lue dans la colonne TYPE de RESULTATS. Les
// champs `ren`, `dac` et `rdv` sont les CHIFFRES DE JUIN 2026 : ils ne servent
// qu'a la verification (critere de recette n.4), jamais a alimenter le modele.
// ============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.JOURS_JUIN = exports.ATTENDUS_TOTAUX_JOUR = exports.ATTENDUS_TABLES = exports.ATTENDUS_SITES = exports.MARQUES_PAR_SITE = exports.TYPES_VENDEURS = void 0;
exports.TYPES_VENDEURS = [
    {
        "nom": "QUENTIN VANINI",
        "site": "MASSAGETTES",
        "type": "VN",
        "ren": 7,
        "dac": 2,
        "rdv": 9
    },
    {
        "nom": "VIRGINIE CUMINAL",
        "site": "MASSAGETTES",
        "type": "VN",
        "ren": 9,
        "dac": 2,
        "rdv": 11
    },
    {
        "nom": "ANTHONY DONAS",
        "site": "MOZAC",
        "type": "VN",
        "ren": 13,
        "dac": 4,
        "rdv": 17
    },
    {
        "nom": "JORDAN CALDEIRA",
        "site": "MOZAC",
        "type": "VN",
        "ren": 12,
        "dac": 6,
        "rdv": 18
    },
    {
        "nom": "ROBIN RABOISSON",
        "site": "MOZAC",
        "type": "VN",
        "ren": 11,
        "dac": 4,
        "rdv": 15
    },
    {
        "nom": "KEVIN DIJOUX",
        "site": "MOZAC",
        "type": "VN",
        "ren": 13,
        "dac": 6,
        "rdv": 19
    },
    {
        "nom": "UGO FERVEL",
        "site": "MOZAC",
        "type": "VN",
        "ren": 11,
        "dac": 5,
        "rdv": 16
    },
    {
        "nom": "YANN DE OLIVEIRA",
        "site": "MOZAC",
        "type": "VO",
        "ren": 0,
        "dac": 0,
        "rdv": 18
    },
    {
        "nom": "MATTHIAS VALLE",
        "site": "MOZAC",
        "type": "VO",
        "ren": 0,
        "dac": 0,
        "rdv": 13
    },
    {
        "nom": "ALEXANDRE CHAVIGNON",
        "site": "VICHY",
        "type": "VN",
        "ren": 0,
        "dac": 11,
        "rdv": 11
    },
    {
        "nom": "MICHEL GUILLERM",
        "site": "VICHY",
        "type": "VN",
        "ren": 0,
        "dac": 18,
        "rdv": 18
    },
    {
        "nom": "ALEXANDRE DIOT",
        "site": "VICHY",
        "type": "VN",
        "ren": 30,
        "dac": 0,
        "rdv": 30
    },
    {
        "nom": "DYLAN MEYRIAL",
        "site": "VICHY",
        "type": "VN",
        "ren": 19,
        "dac": 1,
        "rdv": 20
    },
    {
        "nom": "YOANN TRIBOULET",
        "site": "VICHY",
        "type": "VN",
        "ren": 13,
        "dac": 0,
        "rdv": 13
    },
    {
        "nom": "MATTIS BONNAMOUR",
        "site": "VICHY",
        "type": "VN",
        "ren": 9,
        "dac": 0,
        "rdv": 9
    },
    {
        "nom": "VIKTORIIA BONDARENKO",
        "site": "VICHY",
        "type": "VN",
        "ren": 0,
        "dac": 0,
        "rdv": 0
    },
    {
        "nom": "NICOLAS BOUCHET",
        "site": "VICHY",
        "type": "VO",
        "ren": 0,
        "dac": 0,
        "rdv": 0
    },
    {
        "nom": "CLÉMENT JACQUET",
        "site": "VICHY",
        "type": "VO",
        "ren": 0,
        "dac": 0,
        "rdv": 8
    },
    {
        "nom": "ROMARIC RAMBERT",
        "site": "VICHY",
        "type": "VO",
        "ren": 0,
        "dac": 0,
        "rdv": 5
    },
    {
        "nom": "CLÉMENT RAYA",
        "site": "VICHY",
        "type": "VO",
        "ren": 0,
        "dac": 0,
        "rdv": 9
    },
    {
        "nom": "SYLVETTE ROGUE",
        "site": "MOULINS",
        "type": "VN",
        "ren": 0,
        "dac": 13,
        "rdv": 13
    },
    {
        "nom": "SEBASTIEN DUBOST",
        "site": "MOULINS",
        "type": "VN",
        "ren": 14,
        "dac": 3,
        "rdv": 17
    },
    {
        "nom": "MARC PALUMBO",
        "site": "MOULINS",
        "type": "VN",
        "ren": 16,
        "dac": 1,
        "rdv": 17
    },
    {
        "nom": "PAULINE COIGNET",
        "site": "MOULINS",
        "type": "VO",
        "ren": 0,
        "dac": 0,
        "rdv": 4
    },
    {
        "nom": "JULIEN LE QUELLEC",
        "site": "MOULINS",
        "type": "VO",
        "ren": 0,
        "dac": 0,
        "rdv": 4
    },
    {
        "nom": "ROMAIN DENIS",
        "site": "MOULINS",
        "type": "VO",
        "ren": 0,
        "dac": 0,
        "rdv": 5
    },
    {
        "nom": "ARNAUD GALLAND",
        "site": "LE PUY",
        "type": "VN",
        "ren": 17,
        "dac": 2,
        "rdv": 19
    },
    {
        "nom": "GUILLAUME SAVINEL",
        "site": "LE PUY",
        "type": "VN",
        "ren": 7,
        "dac": 2,
        "rdv": 9
    },
    {
        "nom": "JEAN-PAUL RANVOISE",
        "site": "LE PUY",
        "type": "VN",
        "ren": 4,
        "dac": 4,
        "rdv": 8
    },
    {
        "nom": "ARTHUR DURANTON",
        "site": "LE PUY",
        "type": "VN",
        "ren": 10,
        "dac": 1,
        "rdv": 11
    },
    {
        "nom": "VALENTIN MOLINES",
        "site": "LE PUY",
        "type": "VO",
        "ren": 0,
        "dac": 0,
        "rdv": 4
    },
    {
        "nom": "RICHARD WEISSELDINGER",
        "site": "LE PUY",
        "type": "VO",
        "ren": 0,
        "dac": 0,
        "rdv": 11
    },
    {
        "nom": "CHRISTIAN CAUQUIL",
        "site": "GAILLAC",
        "type": "VN",
        "ren": 10,
        "dac": 0,
        "rdv": 10
    },
    {
        "nom": "JULIEN SEBE",
        "site": "GAILLAC",
        "type": "VN",
        "ren": 15,
        "dac": 0,
        "rdv": 15
    },
    {
        "nom": "GUILLAUME SEGUI",
        "site": "GAILLAC",
        "type": "VN",
        "ren": 9,
        "dac": 2,
        "rdv": 11
    },
    {
        "nom": "FLAVIEN MILLON",
        "site": "GAILLAC",
        "type": "VN",
        "ren": 9,
        "dac": 1,
        "rdv": 10
    },
    {
        "nom": "DANIEL DIAS FERNANDES",
        "site": "ALBI",
        "type": "VN",
        "ren": 4,
        "dac": 8,
        "rdv": 12
    },
    {
        "nom": "AURÉLIE BOMPART",
        "site": "ALBI",
        "type": "VN",
        "ren": 4,
        "dac": 1,
        "rdv": 5
    },
    {
        "nom": "EMMA GUEGUEN",
        "site": "ALBI",
        "type": "VN",
        "ren": 0,
        "dac": 0,
        "rdv": 0
    },
    {
        "nom": "FLORENT THOMASSIN",
        "site": "ALBI",
        "type": "VN",
        "ren": 18,
        "dac": 0,
        "rdv": 18
    },
    {
        "nom": "ROMAIN BOISSONNADE",
        "site": "RODEZ",
        "type": "VN",
        "ren": 4,
        "dac": 4,
        "rdv": 8
    },
    {
        "nom": "MARINE FLAUJAGUET",
        "site": "RODEZ",
        "type": "VN",
        "ren": 18,
        "dac": 0,
        "rdv": 18
    },
    {
        "nom": "ALEXIS COMPANS",
        "site": "RODEZ",
        "type": "VN",
        "ren": 2,
        "dac": 5,
        "rdv": 7
    },
    {
        "nom": "RÉMI DEGAND",
        "site": "RODEZ",
        "type": "VN",
        "ren": 12,
        "dac": 4,
        "rdv": 16
    },
    {
        "nom": "ARNAUD LOPEZ",
        "site": "RODEZ",
        "type": "VO",
        "ren": 0,
        "dac": 0,
        "rdv": 8
    },
    {
        "nom": "DORIAN FRANCE",
        "site": "RODEZ",
        "type": "VO",
        "ren": 0,
        "dac": 0,
        "rdv": 5
    },
    {
        "nom": "DAMIEN RULHE",
        "site": "RODEZ",
        "type": "VO",
        "ren": 0,
        "dac": 0,
        "rdv": 4
    },
    {
        "nom": "NICOLAS CAYRON",
        "site": "MILLAU",
        "type": "VN",
        "ren": 13,
        "dac": 0,
        "rdv": 13
    },
    {
        "nom": "MATHIS FRANCOIS",
        "site": "MILLAU",
        "type": "VN",
        "ren": 0,
        "dac": 13,
        "rdv": 13
    },
    {
        "nom": "ELSA AGRINIER",
        "site": "MILLAU",
        "type": "VN",
        "ren": 0,
        "dac": 0,
        "rdv": 0
    },
    {
        "nom": "SÉBASTIEN MIRA",
        "site": "ALPINE",
        "type": "VN",
        "ren": null,
        "dac": null,
        "rdv": 14
    },
    {
        "nom": "EMILIEN SOLEILHAVOUP",
        "site": "ALPINE",
        "type": "VN",
        "ren": null,
        "dac": null,
        "rdv": 15
    },
    {
        "nom": "VALENTIN PARPINELLI",
        "site": "CLERMONT-FERRAND",
        "type": "VN",
        "ren": 16,
        "dac": 0,
        "rdv": 16
    },
    {
        "nom": "THIERRY DUBERNAT",
        "site": "CLERMONT-FERRAND",
        "type": "VN",
        "ren": 12,
        "dac": 5,
        "rdv": 17
    },
    {
        "nom": "OCEANE ESPINASSE",
        "site": "CLERMONT-FERRAND",
        "type": "VN",
        "ren": 0,
        "dac": 20,
        "rdv": 20
    },
    {
        "nom": "BLANDINE CLÉMENT",
        "site": "CLERMONT-FERRAND",
        "type": "VN",
        "ren": 2,
        "dac": 11,
        "rdv": 13
    },
    {
        "nom": "THOMAS SOULIER",
        "site": "CLERMONT-FERRAND",
        "type": "VN",
        "ren": 1,
        "dac": 11,
        "rdv": 12
    },
    {
        "nom": "CHRISTOPHE BROSSEAU",
        "site": "CLERMONT-FERRAND",
        "type": "VN",
        "ren": 7,
        "dac": 8,
        "rdv": 15
    },
    {
        "nom": "THÉO ROUSSET",
        "site": "CLERMONT-FERRAND",
        "type": "VN",
        "ren": 15,
        "dac": 0,
        "rdv": 15
    },
    {
        "nom": "QUENTIN BELLAIGUES",
        "site": "CLERMONT-FERRAND",
        "type": "VN",
        "ren": 18,
        "dac": 0,
        "rdv": 18
    },
    {
        "nom": "JEAN-PIERRE FERRIER",
        "site": "CLERMONT-FERRAND",
        "type": "VN",
        "ren": 15,
        "dac": 0,
        "rdv": 15
    },
    {
        "nom": "JULIEN BIASUTTI",
        "site": "CLERMONT-FERRAND",
        "type": "VN",
        "ren": 20,
        "dac": 0,
        "rdv": 20
    },
    {
        "nom": "PIERRE-EDOUARD LAROCHE",
        "site": "CLERMONT-FERRAND",
        "type": "VN",
        "ren": 0,
        "dac": 10,
        "rdv": 10
    },
    {
        "nom": "ANTOINE BASTIEN",
        "site": "CLERMONT-FERRAND",
        "type": "VO",
        "ren": 0,
        "dac": 0,
        "rdv": 10
    },
    {
        "nom": "DYLAN GUERRET",
        "site": "CLERMONT-FERRAND",
        "type": "VO",
        "ren": 0,
        "dac": 0,
        "rdv": 9
    },
    {
        "nom": "JOAO TEIXEIRA",
        "site": "CLERMONT-FERRAND",
        "type": "VO",
        "ren": 0,
        "dac": 0,
        "rdv": 7
    },
    {
        "nom": "THIERRY MARTINEZ",
        "site": "CLERMONT-FERRAND",
        "type": "VO",
        "ren": 0,
        "dac": 0,
        "rdv": 10
    },
    {
        "nom": "JEROME SABIN",
        "site": "CLERMONT-FERRAND",
        "type": "VO",
        "ren": 0,
        "dac": 0,
        "rdv": 11
    },
    {
        "nom": "ROBIN GUERY",
        "site": "USSEL",
        "type": "VN",
        "ren": 4,
        "dac": 3,
        "rdv": 7
    },
    {
        "nom": "JULIEN SPADAT",
        "site": "USSEL",
        "type": "VN",
        "ren": 7,
        "dac": 3,
        "rdv": 10
    },
    {
        "nom": "STÉPHANE VANDAMME",
        "site": "USSEL",
        "type": "VO",
        "ren": 0,
        "dac": 0,
        "rdv": 7
    },
    {
        "nom": "LOUIS DUBOST",
        "site": "THIERS",
        "type": "VN",
        "ren": 4,
        "dac": 1,
        "rdv": 5
    },
    {
        "nom": "CYNTHIA VALLIN",
        "site": "THIERS",
        "type": "VN",
        "ren": 7,
        "dac": 4,
        "rdv": 11
    },
    {
        "nom": "AXEL DUMONT",
        "site": "THIERS",
        "type": "VN",
        "ren": 15,
        "dac": 0,
        "rdv": 15
    },
    {
        "nom": "DAMIEN DAGOSTINO",
        "site": "THIERS",
        "type": "VO",
        "ren": 0,
        "dac": 0,
        "rdv": 4
    },
    {
        "nom": "ALEXANDRE PINOT",
        "site": "THIERS",
        "type": "VO",
        "ren": 0,
        "dac": 0,
        "rdv": 12
    },
    {
        "nom": "JÉRÉMY DA COSTA",
        "site": "MENDE",
        "type": "VN",
        "ren": 11,
        "dac": 6,
        "rdv": 17
    },
    {
        "nom": "DYLAN NOGUEIRA",
        "site": "MENDE",
        "type": "VN",
        "ren": 0,
        "dac": 0,
        "rdv": 0
    },
    {
        "nom": "WILLIAM PASCAL",
        "site": "MENDE",
        "type": "VO",
        "ren": 0,
        "dac": 0,
        "rdv": 11
    },
    {
        "nom": "YOANN PICARD",
        "site": "ISSOIRE",
        "type": "VN",
        "ren": 9,
        "dac": 1,
        "rdv": 10
    },
    {
        "nom": "STANISLAS RODAMEL",
        "site": "ISSOIRE",
        "type": "VN",
        "ren": 6,
        "dac": 8,
        "rdv": 14
    },
    {
        "nom": "JULIEN MONATTE",
        "site": "ISSOIRE",
        "type": "VN",
        "ren": 0,
        "dac": 0,
        "rdv": 0
    },
    {
        "nom": "MAGALI MICHEL",
        "site": "ISSOIRE",
        "type": "VN",
        "ren": 6,
        "dac": 4,
        "rdv": 10
    },
    {
        "nom": "AMÉLIE HERVÉ",
        "site": "ISSOIRE",
        "type": "VN",
        "ren": 7,
        "dac": 11,
        "rdv": 18
    },
    {
        "nom": "SÉBASTIEN DUMONT",
        "site": "ISSOIRE",
        "type": "VN",
        "ren": 8,
        "dac": 8,
        "rdv": 16
    },
    {
        "nom": "REDWANE TOULOUSE",
        "site": "ISSOIRE",
        "type": "VO",
        "ren": 0,
        "dac": 0,
        "rdv": 10
    },
    {
        "nom": "STÉPHANE DALLO-BELLESSA",
        "site": "ISSOIRE",
        "type": "VO",
        "ren": 0,
        "dac": 0,
        "rdv": 3
    },
    {
        "nom": "FRANCOIS LENAIC",
        "site": "ISSOIRE",
        "type": "VO",
        "ren": 0,
        "dac": 0,
        "rdv": 12
    },
    {
        "nom": "DORIAN ALLEGRE",
        "site": "FIGEAC",
        "type": "VN",
        "ren": 7,
        "dac": 5,
        "rdv": 12
    },
    {
        "nom": "MATIS BRUNO",
        "site": "FIGEAC",
        "type": "VN",
        "ren": 8,
        "dac": 1,
        "rdv": 9
    },
    {
        "nom": "CLÉMENT MALGOUZOU",
        "site": "FIGEAC",
        "type": "VN",
        "ren": 4,
        "dac": 1,
        "rdv": 5
    },
    {
        "nom": "YOHAN BANYIK",
        "site": "AURILLAC",
        "type": "VN",
        "ren": 15,
        "dac": 3,
        "rdv": 18
    },
    {
        "nom": "ROMAIN COMBOURIEU",
        "site": "AURILLAC",
        "type": "VN",
        "ren": 10,
        "dac": 2,
        "rdv": 12
    },
    {
        "nom": "STÉPHANE SUC",
        "site": "AURILLAC",
        "type": "VN",
        "ren": 9,
        "dac": 4,
        "rdv": 13
    },
    {
        "nom": "ANTONIN LUC",
        "site": "AURILLAC",
        "type": "VN",
        "ren": 0,
        "dac": 0,
        "rdv": 0
    },
    {
        "nom": "MAGALI BRUGIER",
        "site": "VILLEFRANCHE",
        "type": "VN",
        "ren": 12,
        "dac": 5,
        "rdv": 17
    },
    {
        "nom": "THOMAS BERT",
        "site": "VILLEFRANCHE",
        "type": "VN",
        "ren": 4,
        "dac": 5,
        "rdv": 9
    },
    {
        "nom": "AZIZ CHOUAY",
        "site": "VILLEFRANCHE",
        "type": "VO",
        "ren": 0,
        "dac": 0,
        "rdv": 0
    },
    {
        "nom": "GEOFFREY SALGUES",
        "site": "CARMAUX",
        "type": "VN",
        "ren": 6,
        "dac": 13,
        "rdv": 19
    }
];
/// Marques de chaque site, lues dans l'en-tete du bloc RESULTATS. C'est la seule
/// deduction sure : le site ALPINE porte `ALP`, les autres `REN` et `DAC`.
exports.MARQUES_PAR_SITE = [
    {
        "nom": "MASSAGETTES",
        "codesMarque": [
            "RENAULT",
            "DACIA"
        ]
    },
    {
        "nom": "MOZAC",
        "codesMarque": [
            "RENAULT",
            "DACIA"
        ]
    },
    {
        "nom": "VICHY",
        "codesMarque": [
            "RENAULT",
            "DACIA"
        ]
    },
    {
        "nom": "MOULINS",
        "codesMarque": [
            "RENAULT",
            "DACIA"
        ]
    },
    {
        "nom": "LE PUY",
        "codesMarque": [
            "RENAULT",
            "DACIA"
        ]
    },
    {
        "nom": "GAILLAC",
        "codesMarque": [
            "RENAULT",
            "DACIA"
        ]
    },
    {
        "nom": "ALBI",
        "codesMarque": [
            "RENAULT",
            "DACIA"
        ]
    },
    {
        "nom": "RODEZ",
        "codesMarque": [
            "RENAULT",
            "DACIA"
        ]
    },
    {
        "nom": "MILLAU",
        "codesMarque": [
            "RENAULT",
            "DACIA"
        ]
    },
    {
        "nom": "ALPINE",
        "codesMarque": [
            "ALPINE"
        ]
    },
    {
        "nom": "CLERMONT-FERRAND",
        "codesMarque": [
            "RENAULT",
            "DACIA"
        ]
    },
    {
        "nom": "USSEL",
        "codesMarque": [
            "RENAULT",
            "DACIA"
        ]
    },
    {
        "nom": "THIERS",
        "codesMarque": [
            "RENAULT",
            "DACIA"
        ]
    },
    {
        "nom": "MENDE",
        "codesMarque": [
            "RENAULT",
            "DACIA"
        ]
    },
    {
        "nom": "ISSOIRE",
        "codesMarque": [
            "RENAULT",
            "DACIA"
        ]
    },
    {
        "nom": "FIGEAC",
        "codesMarque": [
            "RENAULT",
            "DACIA"
        ]
    },
    {
        "nom": "AURILLAC",
        "codesMarque": [
            "RENAULT",
            "DACIA"
        ]
    },
    {
        "nom": "VILLEFRANCHE",
        "codesMarque": [
            "RENAULT",
            "DACIA"
        ]
    },
    {
        "nom": "CARMAUX",
        "codesMarque": [
            "RENAULT",
            "DACIA"
        ]
    }
];
/// Totaux attendus de juin 2026 — reference de verification.
exports.ATTENDUS_SITES = [
    {
        "nom": "MASSAGETTES",
        "vn": 20,
        "vo": 0,
        "total": 20
    },
    {
        "nom": "MOZAC",
        "vn": 85,
        "vo": 31,
        "total": 116
    },
    {
        "nom": "VICHY",
        "vn": 101,
        "vo": 22,
        "total": 123
    },
    {
        "nom": "MOULINS",
        "vn": 47,
        "vo": 13,
        "total": 60
    },
    {
        "nom": "LE PUY",
        "vn": 47,
        "vo": 15,
        "total": 62
    },
    {
        "nom": "GAILLAC",
        "vn": 46,
        "vo": 0,
        "total": 46
    },
    {
        "nom": "ALBI",
        "vn": 35,
        "vo": 0,
        "total": 35
    },
    {
        "nom": "RODEZ",
        "vn": 49,
        "vo": 17,
        "total": 66
    },
    {
        "nom": "MILLAU",
        "vn": 26,
        "vo": 0,
        "total": 26
    },
    {
        "nom": "ALPINE",
        "vn": 29,
        "vo": 0,
        "total": 29
    },
    {
        "nom": "CLERMONT-FERRAND",
        "vn": 171,
        "vo": 47,
        "total": 218
    },
    {
        "nom": "USSEL",
        "vn": 17,
        "vo": 7,
        "total": 24
    },
    {
        "nom": "THIERS",
        "vn": 31,
        "vo": 16,
        "total": 47
    },
    {
        "nom": "MENDE",
        "vn": 17,
        "vo": 11,
        "total": 28
    },
    {
        "nom": "ISSOIRE",
        "vn": 68,
        "vo": 25,
        "total": 93
    },
    {
        "nom": "FIGEAC",
        "vn": 26,
        "vo": 0,
        "total": 26
    },
    {
        "nom": "AURILLAC",
        "vn": 43,
        "vo": 0,
        "total": 43
    },
    {
        "nom": "VILLEFRANCHE",
        "vn": 26,
        "vo": 0,
        "total": 26
    },
    {
        "nom": "CARMAUX",
        "vn": 19,
        "vo": 0,
        "total": 19
    }
];
exports.ATTENDUS_TABLES = [
    {
        "onglet": "TABLES(EAA)",
        "chef": "SÉVERINE BESSON",
        "libelle": "TABLE 1",
        "total": 78
    },
    {
        "onglet": "TABLES(EAA)",
        "chef": "THIERRY COIGNAC",
        "libelle": "TABLE 2",
        "total": 84
    },
    {
        "onglet": "TABLES(EAA)",
        "chef": "LUCIEN MARCHETTI",
        "libelle": "TABLE 3",
        "total": 75
    },
    {
        "onglet": "TABLES(EAA)",
        "chef": "JF LARGET",
        "libelle": "TABLE 4",
        "total": 91
    },
    {
        "onglet": "TABLES(EAA)",
        "chef": "MICKAEL MASSON",
        "libelle": "TABLE 5",
        "total": 79
    },
    {
        "onglet": "TABLES(SUD)",
        "chef": "FRANCK NOGUES",
        "libelle": "TABLE 1",
        "total": 43
    },
    {
        "onglet": "TABLES(SUD)",
        "chef": "JÉRÔME HÉBERT",
        "libelle": "TABLE 2",
        "total": 76
    },
    {
        "onglet": "TABLES(SUD)",
        "chef": "GILLES PARRAIN",
        "libelle": "TABLE 3",
        "total": 64
    }
];
/// Totaux du jour, ligne 2 de CHAQUE onglet site — 19 sites et non plus 3. C'est
/// la ligne qu'un chef regarde pour savoir si la journee avance.
exports.ATTENDUS_TOTAUX_JOUR = {
    "CLF": [
        {
            "jour": "JEUDI 11 JUIN",
            "rdv": 52,
            "fiable": true
        },
        {
            "jour": "VENDREDI 12 JUIN",
            "rdv": 49,
            "fiable": true
        },
        {
            "jour": "SAMEDI 13 JUIN",
            "rdv": 42,
            "fiable": true
        },
        {
            "jour": "DIMANCHE 14 JUIN",
            "rdv": 38,
            "fiable": true
        },
        {
            "jour": "LUNDI 15 JUIN",
            "rdv": 37,
            "fiable": true
        }
    ],
    "MOZ": [
        {
            "jour": "JEUDI 11 JUIN",
            "rdv": 32,
            "fiable": true
        },
        {
            "jour": "VENDREDI 12 JUIN",
            "rdv": 23,
            "fiable": true
        },
        {
            "jour": "SAMEDI 13 JUIN",
            "rdv": 30,
            "fiable": true
        },
        {
            "jour": "DIMANCHE 14 JUIN",
            "rdv": 22,
            "fiable": true
        },
        {
            "jour": "LUNDI 15 JUIN",
            "rdv": 9,
            "fiable": true
        }
    ],
    "USS": [
        {
            "jour": "JEUDI 11 JUIN",
            "rdv": 4,
            "fiable": true
        },
        {
            "jour": "VENDREDI 12 JUIN",
            "rdv": 7,
            "fiable": true
        },
        {
            "jour": "SAMEDI 13 JUIN",
            "rdv": 9,
            "fiable": true
        },
        {
            "jour": "DIMANCHE 14 JUIN",
            "rdv": 4,
            "fiable": true
        },
        {
            "jour": "LUNDI 15 JUIN",
            "rdv": 0,
            "fiable": true
        }
    ],
    "ALPINE": [
        {
            "jour": "JEUDI 11 JUIN",
            "rdv": 3,
            "fiable": true
        },
        {
            "jour": "VENDREDI 12 JUIN",
            "rdv": 9,
            "fiable": true
        },
        {
            "jour": "SAMEDI 13 JUIN",
            "rdv": 11,
            "fiable": true
        },
        {
            "jour": "DIMANCHE 14 JUIN",
            "rdv": 6,
            "fiable": true
        },
        {
            "jour": "LUNDI 15 JUIN",
            "rdv": 0,
            "fiable": true
        }
    ],
    "MASS": [
        {
            "jour": "JEUDI 11 JUIN",
            "rdv": 5,
            "fiable": true
        },
        {
            "jour": "VENDREDI 12 JUIN",
            "rdv": 4,
            "fiable": true
        },
        {
            "jour": "SAMEDI 13 JUIN",
            "rdv": 6,
            "fiable": true
        },
        {
            "jour": "DIMANCHE 14 JUIN",
            "rdv": 3,
            "fiable": true
        },
        {
            "jour": "LUNDI 15 JUIN",
            "rdv": 2,
            "fiable": true
        }
    ],
    "MOU": [
        {
            "jour": "JEUDI 11 JUIN",
            "rdv": 11,
            "fiable": true
        },
        {
            "jour": "VENDREDI 12 JUIN",
            "rdv": 16,
            "fiable": true
        },
        {
            "jour": "SAMEDI 13 JUIN",
            "rdv": 18,
            "fiable": true
        },
        {
            "jour": "DIMANCHE 14 JUIN",
            "rdv": 11,
            "fiable": true
        },
        {
            "jour": "LUNDI 15 JUIN",
            "rdv": 4,
            "fiable": true
        }
    ],
    "VI": [
        {
            "jour": "JEUDI 11 JUIN",
            "rdv": 36,
            "fiable": true
        },
        {
            "jour": "VENDREDI 12 JUIN",
            "rdv": 31,
            "fiable": true
        },
        {
            "jour": "SAMEDI 13 JUIN",
            "rdv": 29,
            "fiable": true
        },
        {
            "jour": "DIMANCHE 14 JUIN",
            "rdv": 20,
            "fiable": true
        },
        {
            "jour": "LUNDI 15 JUIN",
            "rdv": 7,
            "fiable": true
        }
    ],
    "TH": [
        {
            "jour": "JEUDI 11 JUIN",
            "rdv": 16,
            "fiable": true
        },
        {
            "jour": "VENDREDI 12 JUIN",
            "rdv": 12,
            "fiable": true
        },
        {
            "jour": "SAMEDI 13 JUIN",
            "rdv": 9,
            "fiable": true
        },
        {
            "jour": "DIMANCHE 14 JUIN",
            "rdv": 8,
            "fiable": true
        },
        {
            "jour": "LUNDI 15 JUIN",
            "rdv": 2,
            "fiable": true
        }
    ],
    "ISS": [
        {
            "jour": "JEUDI 11 JUIN",
            "rdv": 33,
            "fiable": true
        },
        {
            "jour": "VENDREDI 12 JUIN",
            "rdv": 17,
            "fiable": true
        },
        {
            "jour": "SAMEDI 13 JUIN",
            "rdv": 26,
            "fiable": true
        },
        {
            "jour": "DIMANCHE 14 JUIN",
            "rdv": 15,
            "fiable": true
        },
        {
            "jour": "LUNDI 15 JUIN",
            "rdv": 2,
            "fiable": true
        }
    ],
    "PUY": [
        {
            "jour": "JEUDI 11 JUIN",
            "rdv": 20,
            "fiable": true
        },
        {
            "jour": "VENDREDI 12 JUIN",
            "rdv": 15,
            "fiable": true
        },
        {
            "jour": "SAMEDI 13 JUIN",
            "rdv": 14,
            "fiable": true
        },
        {
            "jour": "DIMANCHE 14 JUIN",
            "rdv": 9,
            "fiable": true
        },
        {
            "jour": "LUNDI 15 JUIN",
            "rdv": 4,
            "fiable": true
        }
    ],
    "MEN": [
        {
            "jour": "JEUDI 11 JUIN",
            "rdv": 4,
            "fiable": true
        },
        {
            "jour": "VENDREDI 12 JUIN",
            "rdv": 11,
            "fiable": true
        },
        {
            "jour": "SAMEDI 13 JUIN",
            "rdv": 6,
            "fiable": true
        },
        {
            "jour": "DIMANCHE 14 JUIN",
            "rdv": 5,
            "fiable": true
        },
        {
            "jour": "LUNDI 15 JUIN",
            "rdv": 2,
            "fiable": true
        }
    ],
    "RDZ": [
        {
            "jour": "JEUDI 11 JUIN",
            "rdv": 22,
            "fiable": true
        },
        {
            "jour": "VENDREDI 12 JUIN",
            "rdv": 17,
            "fiable": true
        },
        {
            "jour": "SAMEDI 13 JUIN",
            "rdv": 18,
            "fiable": true
        },
        {
            "jour": "DIMANCHE 14 JUIN",
            "rdv": 5,
            "fiable": true
        },
        {
            "jour": "LUNDI 15 JUIN",
            "rdv": 4,
            "fiable": true
        }
    ],
    "AUR": [
        {
            "jour": "JEUDI 11 JUIN",
            "rdv": 11,
            "fiable": true
        },
        {
            "jour": "VENDREDI 12 JUIN",
            "rdv": 12,
            "fiable": true
        },
        {
            "jour": "SAMEDI 13 JUIN",
            "rdv": 12,
            "fiable": true
        },
        {
            "jour": "DIMANCHE 14 JUIN",
            "rdv": 0,
            "fiable": true
        },
        {
            "jour": "LUNDI 15 JUIN",
            "rdv": 8,
            "fiable": true
        }
    ],
    "MILL": [
        {
            "jour": "JEUDI 11 JUIN",
            "rdv": 7,
            "fiable": true
        },
        {
            "jour": "VENDREDI 12 JUIN",
            "rdv": 6,
            "fiable": true
        },
        {
            "jour": "SAMEDI 13 JUIN",
            "rdv": 8,
            "fiable": true
        },
        {
            "jour": "DIMANCHE 14 JUIN",
            "rdv": 2,
            "fiable": true
        },
        {
            "jour": "LUNDI 15 JUIN",
            "rdv": 3,
            "fiable": true
        }
    ],
    "GAILL": [
        {
            "jour": "JEUDI 11 JUIN",
            "rdv": 23,
            "fiable": false
        },
        {
            "jour": "VENDREDI 12 JUIN",
            "rdv": 17,
            "fiable": false
        },
        {
            "jour": "SAMEDI 13 JUIN",
            "rdv": 12,
            "fiable": false
        },
        {
            "jour": "DIMANCHE 14 JUIN",
            "rdv": 2,
            "fiable": false
        },
        {
            "jour": "LUNDI 15 JUIN",
            "rdv": 2,
            "fiable": false
        }
    ],
    "ALBI": [
        {
            "jour": "JEUDI 11 JUIN",
            "rdv": 15,
            "fiable": true
        },
        {
            "jour": "VENDREDI 12 JUIN",
            "rdv": 8,
            "fiable": true
        },
        {
            "jour": "SAMEDI 13 JUIN",
            "rdv": 7,
            "fiable": true
        },
        {
            "jour": "DIMANCHE 14 JUIN",
            "rdv": 2,
            "fiable": true
        },
        {
            "jour": "LUNDI 15 JUIN",
            "rdv": 3,
            "fiable": true
        }
    ],
    "CARM": [
        {
            "jour": "JEUDI 11 JUIN",
            "rdv": 8,
            "fiable": false
        },
        {
            "jour": "VENDREDI 12 JUIN",
            "rdv": 11,
            "fiable": false
        },
        {
            "jour": "SAMEDI 13 JUIN",
            "rdv": 8,
            "fiable": false
        },
        {
            "jour": "DIMANCHE 14 JUIN",
            "rdv": 7,
            "fiable": false
        },
        {
            "jour": "LUNDI 15 JUIN",
            "rdv": 10,
            "fiable": false
        }
    ],
    "VDR": [
        {
            "jour": "JEUDI 11 JUIN",
            "rdv": 8,
            "fiable": true
        },
        {
            "jour": "VENDREDI 12 JUIN",
            "rdv": 6,
            "fiable": true
        },
        {
            "jour": "SAMEDI 13 JUIN",
            "rdv": 7,
            "fiable": true
        },
        {
            "jour": "DIMANCHE 14 JUIN",
            "rdv": 0,
            "fiable": true
        },
        {
            "jour": "LUNDI 15 JUIN",
            "rdv": 5,
            "fiable": true
        }
    ],
    "FIGEAC": [
        {
            "jour": "JEUDI 11 JUIN",
            "rdv": 6,
            "fiable": true
        },
        {
            "jour": "VENDREDI 12 JUIN",
            "rdv": 10,
            "fiable": true
        },
        {
            "jour": "SAMEDI 13 JUIN",
            "rdv": 7,
            "fiable": true
        },
        {
            "jour": "DIMANCHE 14 JUIN",
            "rdv": 1,
            "fiable": true
        },
        {
            "jour": "LUNDI 15 JUIN",
            "rdv": 2,
            "fiable": true
        }
    ],
    "MDP": []
};
/// Les 5 jours de juin 2026, dans l'ordre des colonnes du fichier.
exports.JOURS_JUIN = ["2026-06-11", "2026-06-12", "2026-06-13", "2026-06-14", "2026-06-15"];
//# sourceMappingURL=donnees-xlsx.js.map