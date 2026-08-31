import { GRAINE, ecartCible, repartir, type TableCible, type VendeurAPlacer } from './repartition';

// ============================================================================
// VERIFICATION DE LA REPARTITION AUTOMATIQUE — F-B.5.
//
// `repartir` est une fonction pure : elle se teste sans base, sans serveur et
// sans framework. C'est precisement pourquoi elle a ete ecrite ainsi.
//
// LE TEST QUI COMPTE est celui de la REPRODUCTIBILITE. La graine 42 n'est pas une
// coquetterie : le cahier des charges dit << le resultat doit etre reproductible
// et donc contestable >>. Un chef qui trouve sa table defavorisee doit pouvoir
// relancer et retomber sur la meme composition. Trois choses peuvent casser
// cela — le hasard, l'ordre d'entree, les ex aequo entre tables — et chacune a
// son test ici.
//
// Usage : npm --prefix backend run test:repartition
// ============================================================================

const resultats: { nom: string; ok: boolean; detail: string }[] = [];
const verifier = (nom: string, condition: boolean, detail: string) =>
  resultats.push({ nom, ok: condition, detail });

const vn = (id: string, marqueIds: string[] = ['R', 'D']): VendeurAPlacer => ({
  id,
  nom: `VENDEUR ${id}`,
  marqueIds,
  typeVehicule: 'VN',
});
const vo = (id: string): VendeurAPlacer => ({
  id,
  nom: `VENDEUR VO ${id}`,
  marqueIds: [],
  typeVehicule: 'VO',
});

const table = (
  id: string,
  ordre: number,
  membres: VendeurAPlacer[] = [],
  marqueId: string | null = null
): TableCible => ({
  id,
  libelle: `Table ${ordre}`,
  ordre,
  marqueId,
  membres,
});

const signature = (r: ReturnType<typeof repartir>) =>
  r.placements.map((p) => `${p.libelle}:${p.vendeurIdsAjoutes.join(',')}`).join(' | ');

// ---------------------------------------------------------------- graine
verifier('la graine vaut 42, en dur', GRAINE === 42, String(GRAINE));

const douze = Array.from({ length: 12 }, (_, i) => vn(`v${String(i).padStart(2, '0')}`));
const troisTables = [table('t1', 1), table('t2', 2), table('t3', 3)];

const a = repartir(douze, troisTables);
const b = repartir(douze, troisTables);
verifier(
  'deux executions identiques donnent la MEME composition',
  signature(a) === signature(b),
  signature(a)
);

/// Le point le plus facile a rater : `findMany` n'a aucune obligation de rendre
/// ses lignes dans le meme ordre d'un appel a l'autre. Sans le tri prealable, la
/// composition changerait a graine identique.
const c = repartir([...douze].reverse(), troisTables);
verifier(
  "l'ORDRE D'ENTREE n'influence pas le resultat",
  signature(a) === signature(c),
  signature(c)
);

/// Meme test avec un ordre melange autrement, pour ne pas ne verifier que le cas
/// symetrique.
const melange = [douze[5]!, douze[0]!, douze[11]!, ...douze.slice(1, 5), ...douze.slice(6, 11)];
verifier(
  "un troisieme ordre d'entree donne encore le meme resultat",
  signature(repartir(melange, troisTables)) === signature(a),
  signature(repartir(melange, troisTables))
);

/// L'ordre de declaration des TABLES ne doit pas compter non plus : `ordre` les
/// departage, pas leur position dans le tableau.
verifier(
  "l'ordre de declaration des tables n'influence pas le resultat",
  signature(repartir(douze, [...troisTables].reverse())) === signature(a),
  signature(repartir(douze, [...troisTables].reverse()))
);

// ---------------------------------------------------------------- equilibrage
verifier(
  '12 vendeurs sur 3 tables : 4 partout',
  a.placements.every((p) => p.effectif === 4) && a.nonPlaces.length === 0,
  a.placements.map((p) => `${p.libelle}=${p.effectif}`).join(' ')
);

const treize = [...douze, vn('v99')];
const d = repartir(treize, troisTables);
verifier(
  "13 vendeurs sur 3 tables : 5/4/4, et le surplus va a la table d'ordre le plus petit",
  d.placements.map((p) => p.effectif).join('/') === '5/4/4',
  d.placements.map((p) => `${p.libelle}=${p.effectif}`).join(' ')
);

/// Les membres deja en place COMPTENT dans la charge : completer une table a
/// moitie pleine ne doit pas la remplir deux fois.
const avecMembres = [table('t1', 1, [vn('deja1'), vn('deja2'), vn('deja3')]), table('t2', 2)];
const e = repartir([vn('n1'), vn('n2'), vn('n3')], avecMembres);
verifier(
  'les membres deja en place comptent dans la charge',
  e.placements[0]!.effectif === 3 &&
    e.placements[1]!.effectif === 3 &&
    e.placements[0]!.vendeurIdsAjoutes.length === 0,
  e.placements.map((p) => `${p.libelle}=${p.effectif} (+${p.vendeurIdsAjoutes.length})`).join(' ')
);

verifier(
  'les membres deja en place ne sont JAMAIS deplaces',
  e.placements.every((p) => !p.vendeurIdsAjoutes.some((id) => id.startsWith('deja'))),
  'aucun membre existant dans les ajouts'
);

// ---------------------------------------------------------------- marques
//
// LA SPECIALISATION EST DECLAREE. Ces tests remplacent ceux d'une version qui la
// DEDUISAIT des membres presents : le premier vendeur tire au sort dans une table
// vide fixait ses marques pour toujours, ce qui faisait dependre la composition
// du hasard. Constate sur la vraie session CENTRE de septembre — 11/8/10 au lieu
// de 10/10/9, une table transformee en deversoir. Voir la note de `compatible`.

const dacia = table('tD', 1, [], 'D');
const mixte = table('tM', 2, []);

const f = repartir([vn('renaultSeul', ['R'])], [dacia, mixte]);
verifier(
  'un vendeur Renault seul ne rejoint pas une table specialisee Dacia',
  f.placements.find((p) => p.tableId === 'tM')!.vendeurIdsAjoutes.includes('renaultSeul') &&
    f.placements.find((p) => p.tableId === 'tD')!.vendeurIdsAjoutes.length === 0,
  signature(f)
);

const g = repartir([vn('biMarque', ['R', 'D'])], [dacia]);
verifier(
  'un vendeur autorise sur la marque de la table la rejoint',
  g.placements[0]!.vendeurIdsAjoutes.includes('biMarque') && g.nonPlaces.length === 0,
  signature(g)
);

/// Un VO n'a AUCUNE ventilation par marque : une table specialisee n'a pas de sens
/// pour lui. Le trigger `affectation_marque_table` le refuse aussi en base.
const h = repartir([vo('vo1')], [dacia]);
verifier(
  "un vendeur VO ne rejoint pas une table specialisee, et la raison le dit",
  h.nonPlaces.length === 1 && /VO/.test(h.nonPlaces[0]!.raison),
  h.nonPlaces.map((n) => n.raison).join(' ; ')
);

const i = repartir([vo('vo1')], [dacia, mixte]);
verifier(
  'le meme VO rejoint la table mixte quand il y en a une',
  i.placements.find((p) => p.tableId === 'tM')!.vendeurIdsAjoutes.includes('vo1') &&
    i.nonPlaces.length === 0,
  signature(i)
);

/// LE TEST QUI AURAIT ATTRAPE LE DEFAUT. Une table mixte ne se specialise JAMAIS
/// toute seule, quel que soit l'ordre du tirage : placer un vendeur Alpine dedans
/// ne doit pas en fermer l'acces aux Renault/Dacia.
const alpineEtLesAutres = repartir(
  [vn('alpine1', ['A']), ...Array.from({ length: 8 }, (_, k) => vn(`rd${k}`, ['R', 'D']))],
  [table('t1', 1), table('t2', 2), table('t3', 3)]
);
verifier(
  'une table mixte ne se specialise JAMAIS toute seule — le defaut 11/8/10',
  alpineEtLesAutres.placements.map((p) => p.effectif).join('/') === '3/3/3' &&
    alpineEtLesAutres.nonPlaces.length === 0,
  alpineEtLesAutres.placements.map((p) => `${p.libelle}=${p.effectif}`).join(' ')
);

/// Aucune table compatible : le vendeur reste EN RESERVE, il n'est pas case de
/// force. F-B.8 — un vendeur non affecte reste saisissable par son chef de site.
const j = repartir([vn('alpineSeul', ['A'])], [dacia]);
verifier(
  'un vendeur sans table compatible reste en reserve, avec la raison',
  j.nonPlaces.length === 1 &&
    j.nonPlaces[0]!.vendeurId === 'alpineSeul' &&
    /marques/.test(j.nonPlaces[0]!.raison),
  j.nonPlaces.map((n) => `${n.nom} : ${n.raison}`).join(' ; ')
);

// ---------------------------------------------------------------- cas limites
const sansTable = repartir([vn('x')], []);
verifier(
  'aucune table : tout le monde en reserve, aucune exception',
  sansTable.placements.length === 0 &&
    sansTable.nonPlaces.length === 1 &&
    /aucune table/.test(sansTable.nonPlaces[0]!.raison),
  sansTable.nonPlaces[0]!.raison
);

const sansVendeur = repartir([], troisTables);
verifier(
  'aucun vendeur a placer : les tables reviennent inchangees',
  sansVendeur.placements.length === 3 &&
    sansVendeur.placements.every((p) => p.effectif === 0 && p.vendeurIdsAjoutes.length === 0),
  `${sansVendeur.placements.length} tables, 0 ajout`
);

/// Une plaque peut n'avoir aucune table — NORD et SUD-OUEST sont dans ce cas en
/// juin 2026. Le mode par_site doit etre pleinement fonctionnel.
verifier(
  'chaque vendeur est place UNE seule fois, ou en reserve',
  (() => {
    const tous = repartir(treize, troisTables);
    const places = tous.placements.flatMap((p) => p.vendeurIdsAjoutes);
    return (
      new Set(places).size === places.length &&
      places.length + tous.nonPlaces.length === treize.length
    );
  })(),
  `${treize.length} vendeurs, aucun doublon, aucun perdu`
);

// ---------------------------------------------------------------- effectif cible
verifier(
  'ecart a l effectif cible',
  ecartCible(6, 5) === 1 && ecartCible(4, 5) === -1 && ecartCible(4, 4) === 0,
  '6/5 -> +1 · 4/5 -> -1 · 4/4 -> 0'
);
verifier(
  'aucune cible definie : aucun ecart, et surtout pas un ecart a zero',
  ecartCible(6, null) === null,
  String(ecartCible(6, null))
);

// ---------------------------------------------------------------- restitution
const largeur = Math.max(...resultats.map((r) => r.nom.length));
console.log('');
for (const r of resultats) {
  console.log(`${r.ok ? 'OK  ' : 'ECHEC'} ${r.nom.padEnd(largeur)}  ${r.detail}`);
}
const echecs = resultats.filter((r) => !r.ok).length;
console.log(`\n${resultats.length - echecs}/${resultats.length} verifications de la repartition.`);
if (echecs > 0) process.exit(1);
