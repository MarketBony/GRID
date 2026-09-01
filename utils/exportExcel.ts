import * as XLSX from 'xlsx-js-style';
import type { Dashboard } from '../services/dashboard';
import type { PerimetreSaisie } from '../services/saisie';
import { libelleJour } from './grille';
import { comparerLibelle, sansDiacritiques } from '../backend/src/utils/tri';

// ============================================================================
// EXPORT EXCEL — F-D.7.
//
// COTE CLIENT, avec `xlsx-js-style` DEJA present dans les dependances du front
// (il sert aussi a l'extraction du classeur source). Aucune dependance nouvelle,
// aucune generation cote serveur, aucun fichier temporaire a nettoyer.
//
// CE QUE L'EXPORT CONTIENT, ET D'OU CA VIENT — c'est le point important :
//
//   - la SYNTHESE vient de `services/dashboard.ts`, donc des fonctions pures verifiees.
//     Elle ne porte que des nombres : aucun nom de client n'y figure, par
//     construction.
//   - le DETAIL vient de `services/saisie.ts`, qui applique le portail. L'export
//     contient donc exactement ce que ce compte voit deja a l'ecran — un chef de
//     table exporte sa table, un administrateur exporte tout. On ne fabrique
//     aucun acces que l'interface n'accorde pas.
//
// LE FICHIER EXPORTE NE CONTIENT AUCUNE FORMULE. C'est deliberé : le produit
// existe parce que 677 references figees ont fini par mentir. Un export est une
// PHOTOGRAPHIE, avec sa date dans le nom du fichier ; celui qui veut des chiffres
// vivants revient dans l'outil.
// ============================================================================

/// Largeur de colonne en « caracteres », l'unite d'Excel.
const largeur = (n: number) => ({ wch: n });

const ENTETE = {
  font: { name: 'Arial', bold: true, color: { rgb: 'FFFFFF' } },
  fill: { fgColor: { rgb: '293F74' } },
  alignment: { horizontal: 'center' as const, vertical: 'center' as const, wrapText: true },
};

const CELLULE = { font: { name: 'Arial' } };
const NOMBRE = { font: { name: 'Arial' }, alignment: { horizontal: 'right' as const } };
const TITRE = { font: { name: 'Arial', bold: true, sz: 12, color: { rgb: 'F75632' } } };

type Ligne = (string | number)[];

/// Construit une feuille depuis un en-tete et des lignes, en appliquant les
/// styles. `xlsx-js-style` veut les styles CELLULE PAR CELLULE.
function feuille(entetes: string[], lignes: Ligne[], largeurs: number[]) {
  const ws = XLSX.utils.aoa_to_sheet([entetes, ...lignes]);
  ws['!cols'] = largeurs.map(largeur);
  ws['!freeze'] = { xSplit: 0, ySplit: 1 };

  const plage = XLSX.utils.decode_range(ws['!ref']!);
  for (let l = plage.s.r; l <= plage.e.r; l++) {
    for (let c = plage.s.c; c <= plage.e.c; c++) {
      const ref = XLSX.utils.encode_cell({ r: l, c });
      const cellule = ws[ref];
      if (!cellule) continue;
      cellule.s = l === 0 ? ENTETE : typeof cellule.v === 'number' ? NOMBRE : CELLULE;
    }
  }
  return ws;
}

/// Nom de fichier : la campagne, l'axe et LA DATE. Un export sans date se
/// confond avec un autre au bout de deux jours.
const nomFichier = (libelleCampagne: string, quand: Date) => {
  const propre = sansDiacritiques(libelleCampagne)
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const j = String(quand.getDate()).padStart(2, '0');
  const m = String(quand.getMonth() + 1).padStart(2, '0');
  return `relance-${propre}-${quand.getFullYear()}${m}${j}.xlsx`;
};

export function exporterDashboard(
  dashboard: Dashboard,
  perimetre: PerimetreSaisie,
  marques: { id: string; libelle: string }[]
) {
  const classeur = XLSX.utils.book_new();

  // ---------------------------------------------------------------- synthese
  const entetesSynthese = [
    'Axe',
    'Libellé',
    'RDV',
    'VN',
    'VO',
    ...marques.map((m) => m.libelle),
    'Effectif',
    'Moyenne / vendeur',
  ];

  const lignesSynthese: Ligne[] = [];
  const LIBELLES_AXE: Record<string, string> = {
    groupe: 'Groupe',
    plaque: 'Plaque',
    site: 'Concession',
    table: 'Table',
    vendeur: 'Vendeur',
  };
  // Du plus general au plus fin : c'est l'ordre dans lequel on lit un resultat.
  for (const axe of ['groupe', 'plaque', 'site', 'table', 'vendeur'] as const) {
    for (const t of dashboard.totaux[axe]) {
      lignesSynthese.push([
        LIBELLES_AXE[axe]!,
        t.libelle,
        t.total,
        t.vn,
        t.vo,
        ...marques.map((m) => t.parMarque[m.id] ?? 0),
        t.effectif,
        t.moyenne,
      ]);
    }
  }

  XLSX.utils.book_append_sheet(
    classeur,
    feuille(entetesSynthese, lignesSynthese, [
      14,
      26,
      8,
      7,
      7,
      ...marques.map(() => 10),
      10,
      18,
    ]),
    'Synthèse'
  );

  // ---------------------------------------------------------------- par jour
  XLSX.utils.book_append_sheet(
    classeur,
    feuille(
      ['Jour', 'RDV', 'VN', 'VO'],
      dashboard.parJour.map((j) => [libelleJour(j.jour), j.total, j.vn, j.vo]),
      [22, 8, 7, 7]
    ),
    'Par jour'
  );

  // ---------------------------------------------------------------- classements
  const lignesClassement: Ligne[] = [];
  for (const [nom, rangs] of [
    ['Concessions — général', dashboard.classementsSites.global],
    ['Concessions — VN', dashboard.classementsSites.vn],
    ['Concessions — VO', dashboard.classementsSites.vo],
    ['Vendeurs', dashboard.classementVendeurs],
    ['Tables', dashboard.classementTables],
  ] as const) {
    for (const r of rangs) {
      lignesClassement.push([
        nom,
        r.rang,
        r.libelle,
        r.total,
        r.vn,
        r.vo,
        r.effectif,
        r.moyenne,
        // On EXPORTE l'egalite. Sans elle, le lecteur du fichier croit a une
        // hierarchie entre deux concessions a egalite.
        r.exAequo ? 'ex æquo' : '',
      ]);
    }
  }
  XLSX.utils.book_append_sheet(
    classeur,
    feuille(
      ['Classement', 'Rang', 'Libellé', 'RDV', 'VN', 'VO', 'Effectif', 'Moyenne', 'Égalité'],
      lignesClassement,
      [24, 7, 26, 8, 7, 7, 10, 10, 10]
    ),
    'Classements'
  );

  // ---------------------------------------------------------------- detail
  //
  // Vient de `services/saisie.ts`, donc de la vue `relance.perimetre_saisie` :
  // ce compte n'exporte que ce qu'il
  // voit. Un chef de table exporte sa table.
  const vendeurParId = new Map(perimetre.vendeurs.map((v) => [v.id, v]));
  const marqueParId = new Map(marques.map((m) => [m.id, m.libelle]));
  const creneauParCode = new Map(perimetre.campagne.creneaux.map((c) => [c.code, c.libelle]));

  const lignesDetail: Ligne[] = perimetre.rdvs
    .slice()
    .sort(
      (a, b) =>
        a.jour.localeCompare(b.jour) ||
        a.creneauCode.localeCompare(b.creneauCode) ||
        // Les deux premiers criteres sont des chaines ASCII — une date ISO et un
        // code de creneau — dont l'ordre ne depend d'aucune locale. Le NOM, si :
        // c'est le seul des trois qui doit passer par `comparerLibelle`, sans
        // quoi l'onglet Detail ne serait pas classe pareil d'un poste a l'autre.
        comparerLibelle(
          vendeurParId.get(a.vendeurId)?.nom ?? '',
          vendeurParId.get(b.vendeurId)?.nom ?? ''
        )
    )
    .map((r) => {
      const v = vendeurParId.get(r.vendeurId);
      return [
        libelleJour(r.jour),
        creneauParCode.get(r.creneauCode) ?? r.creneauCode,
        v?.siteCode ?? '',
        v?.nom ?? '',
        r.typeVehicule,
        r.marqueId ? (marqueParId.get(r.marqueId) ?? '') : '',
        r.client,
        r.commentaire ?? '',
      ];
    });

  XLSX.utils.book_append_sheet(
    classeur,
    feuille(
      ['Jour', 'Créneau', 'Site', 'Vendeur', 'Type', 'Marque', 'Client', 'Commentaire'],
      lignesDetail,
      [22, 12, 9, 26, 7, 12, 26, 26]
    ),
    'Détail des RDV'
  );

  // ---------------------------------------------------------------- provenance
  //
  // Une feuille qui dit D'OU viennent ces chiffres et CE QU'ILS NE SONT PAS. Un
  // export qui circule sans sa provenance redevient un fichier Excel de plus,
  // qu'on prendra pour la source dans six mois.
  const quand = new Date();
  const provenance = XLSX.utils.aoa_to_sheet([
    ['Export Relance — Groupe Bony'],
    [],
    ['Campagne', dashboard.campagne.libelle],
    ['Période', `${libelleJour(dashboard.campagne.jours[0] ?? '')} → ${libelleJour(dashboard.campagne.jours[dashboard.campagne.jours.length - 1] ?? '')}`],
    ['Clôturée', dashboard.campagne.cloturee ? 'oui' : 'non'],
    ['Exporté le', quand.toLocaleString('fr-FR')],
    [],
    ['Ce fichier est une PHOTOGRAPHIE, pas une source.'],
    ['Il ne contient aucune formule : les totaux ont été calculés par l’outil au moment de'],
    ['l’export, et ils ne se mettront jamais à jour. Pour des chiffres vivants, revenir dans'],
    ['l’application.'],
    [],
    ['L’effectif est CALCULÉ — les vendeurs présents pendant la campagne — et jamais saisi.'],
    ['Le détail des RDV ne contient que le périmètre du compte qui a exporté.'],
  ]);
  provenance['!cols'] = [largeur(24), largeur(60)];
  provenance['A1']!.s = TITRE;
  XLSX.utils.book_append_sheet(classeur, provenance, 'Provenance');

  XLSX.writeFile(classeur, nomFichier(dashboard.campagne.libelle, quand));
}
