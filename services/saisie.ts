import { ErreurApi, supabase, txt, txtOuNull, verifier } from './supabase';
import { comparerLibelle, trierPar } from '../backend/src/utils/tri';

// ============================================================================
// MODULE C — LE PERIMETRE DE SAISIE. C'est le coeur du produit.
//
// TOUT LE PERIMETRE EN UN SEUL PASSAGE (F-C.1) : cliquer un nom doit ouvrir son
// planning « sans rechargement de page », ce qui suppose que tout soit deja la.
// Les requetes partent donc ENSEMBLE, pas en cascade.
//
// LE PERIMETRE VIENT DE LA VUE `relance.perimetre_saisie`, et de nulle part
// ailleurs. C'est la meme vue que consultent les politiques RLS : si le front
// recomposait la regle de son cote, on aurait deux verites et un jour un ecran qui
// propose un vendeur sur lequel l'ecriture sera refusee.
//
// LA FORME DE LA GRILLE se calcule ici et non en base : une section par marque
// autorisee pour un vendeur VN, une seule section sans marque pour un VO. C'est la
// regle lue dans le fichier source — le site Alpine n'a qu'une section, la plupart
// des sites en ont deux.
// ============================================================================

export interface SectionVendeur {
  marqueId: string | null;
  libelle: string;
}

export interface VendeurSaisie {
  id: string;
  nom: string;
  typeVehicule: 'VN' | 'VO';
  siteId: string;
  siteCode: string;
  siteLibelle: string;
  sections: SectionVendeur[];
  /// LES DEUX ORIGINES SONT DISTINCTES, ET UN VENDEUR PEUT PORTER LES DEUX.
  ///
  /// Un chef de vente anime une table composee de vendeurs d'AUTRES concessions —
  /// « je mets 5 vendeurs de 5 concessions differentes, et un chef de vente d'une
  /// autre concession pour les coacher », c'est tout l'interet de l'exercice — et
  /// il encadre par ailleurs sa propre equipe. Les deux listes arrivaient
  /// melangees dans un seul perimetre, sans moyen de savoir ce qu'on regardait.
  ///
  /// Ce ne sont donc PAS deux valeurs d'un meme champ : le vendeur de mon site que
  /// j'ai place dans ma table est dans les deux, et il doit apparaitre dans les
  /// deux filtres.
  dansMaTable: boolean;
  dansMonEquipe: boolean;
}

export interface RdvSaisie {
  id: string;
  vendeurId: string;
  jour: string;
  creneauCode: string;
  marqueId: string | null;
  typeVehicule: string;
  client: string;
  commentaire: string | null;
  /// Pose a l'ecran, pas encore accepte par la base. Son `id` est alors
  /// provisoire (`attente-<cle>`) : il ne se modifie ni ne s'archive avant
  /// d'avoir recu le sien. Voir la file d'attente de `pages/Saisie.tsx`.
  enAttente?: boolean;
}

export interface PerimetreSaisie {
  campagne: {
    id: string;
    libelle: string;
    cloturee: boolean;
    jours: { jour: string; ordre: number }[];
    creneaux: { code: string; libelle: string; ordre: number }[];
  };
  perimetre: {
    type: 'table' | 'site' | 'global';
    libelle: string;
    plaqueId: string | null;
    tableId: string | null;
  } | null;
  vendeurs: VendeurSaisie[];
  rdvs: RdvSaisie[];
  message?: string;
}

export interface Compteurs {
  vendeurId: string;
  total: number;
  parMarque: Record<string, number>;
}

const AUCUN_PERIMETRE =
  "Aucun vendeur ne vous est rattache pour cette campagne. La saisie s'ouvre par deux " +
  'chemins : les SITES que vous encadrez, durablement, et les TABLES que vous animez, qui ' +
  "appartiennent chacune a une campagne. Etre chef de table en juin n'en donne donc aucun " +
  'en septembre, alors qu\'un encadrement de site suit d\'une campagne a l\'autre.';

/// Ce que rend `relance.charger_saisie` : les memes formes que les lectures
/// PostgREST qu'elle remplace, a l'identique — d'ou des noms en `snake_case`.
interface ChargeSaisie {
  campagne: { id: number; libelle: string; cloturee: boolean } | null;
  jours: { jour: string; ordre: number }[];
  creneaux: { code: string; libelle: string; ordre: number }[];
  vendeurs: unknown[];
  rdvs: LigneRdv[];
  tables: unknown[];
  encadrements: { site_id: number }[];
  roles_campagne: { role: string; site_id: number | null; plaque_id: number | null }[];
}

export async function chargerSaisie(campagneId: string): Promise<PerimetreSaisie> {
  // UN SEUL APPEL — lot 1 de PLAN-GRID-V2.md (03/10/2026). Il en fallait onze, en
  // trois vagues, dont le perimetre resolu trois fois. `charger_saisie` est
  // SECURITY INVOKER : chaque table y est lue sous la RLS de l'appelant, donc ce
  // compte voit exactement ce que voyaient les onze lectures. `test:rls` le prouve.
  const brut = verifier(
    await supabase.rpc('charger_saisie', { p_campagne_id: Number(campagneId) })
  ) as unknown as ChargeSaisie;

  const c = brut.campagne;
  if (!c) throw new ErreurApi('Campagne introuvable.', 404);
  const entete = {
    id: txt(c.id),
    libelle: c.libelle,
    cloturee: c.cloturee,
    jours: brut.jours.map((j) => ({ jour: j.jour, ordre: j.ordre })),
    creneaux: brut.creneaux.map((cr) => ({ code: cr.code, libelle: cr.libelle, ordre: cr.ordre })),
  };

  // CE N'EST PAS UNE ERREUR, c'est le cas d'un chef de table de juin qui ouvre
  // septembre. On le dit, avec la raison — un ecran vide sans explication est le
  // pire mode d'echec de cette architecture.
  if (brut.vendeurs.length === 0) {
    return { campagne: entete, perimetre: null, vendeurs: [], rdvs: [], message: AUCUN_PERIMETRE };
  }

  const vendeurs = { data: brut.vendeurs, error: null };
  const rdvs = brut.rdvs;
  const tables = { data: brut.tables, error: null };
  const encadrements = { data: brut.encadrements, error: null };
  const rolesCampagne = { data: brut.roles_campagne, error: null };

  type LigneVendeur = {
    id: number;
    nom: string;
    type_vehicule: string;
    site: { id: number; code: string; libelle: string; plaque_id: number } | null;
    vendeur_marque: { marque: { id: number; libelle: string; ordre: number } | null }[];
  };
  type LigneTable = {
    id: number;
    libelle: string;
    session_plaque: { campagne_id: number; plaque: { id: number; libelle: string } | null } | null;
    affectation: { vendeur_id: number; archive_le: string | null }[];
  };

  const lignesVendeurs = verifier(vendeurs) as unknown as LigneVendeur[];
  const lignesTables = verifier(tables) as unknown as LigneTable[];

  // ------------------------------------------------ les deux origines, separees
  //
  // MA TABLE : les vendeurs affectes aux tables QUE J'ANIME. Les affectations
  // archivees sont ecartees ici et non par la requete : un filtre sur une
  // ressource imbriquee de PostgREST retire la ligne PARENTE quand il ne trouve
  // rien, donc une table dont toutes les affectations sont archivees
  // disparaitrait — et avec elle l'intitule du perimetre.
  const vendeursDeMesTables = new Set<string>();
  for (const t of lignesTables) {
    for (const a of t.affectation ?? []) {
      if (a.archive_le === null) vendeursDeMesTables.add(txt(a.vendeur_id));
    }
  }

  // MON EQUIPE DE VENTE : les sites que j'encadre durablement, plus ceux dont je
  // suis chef pour CETTE campagne, plus les plaques entieres dont je suis chef.
  const mesSites = new Set<string>();
  const mesPlaques = new Set<string>();
  for (const e of verifier(encadrements) as unknown as { site_id: number }[]) {
    mesSites.add(txt(e.site_id));
  }
  for (const r of verifier(rolesCampagne) as unknown as {
    role: string;
    site_id: number | null;
    plaque_id: number | null;
  }[]) {
    if (r.role === 'chef_site' && r.site_id !== null) mesSites.add(txt(r.site_id));
    if (r.role === 'chef_plaque' && r.plaque_id !== null) mesPlaques.add(txt(r.plaque_id));
  }

  const projetes: VendeurSaisie[] = lignesVendeurs.map((v) => ({
    id: txt(v.id),
    nom: v.nom,
    typeVehicule: v.type_vehicule as 'VN' | 'VO',
    siteId: txt(v.site?.id),
    siteCode: v.site?.code ?? '',
    siteLibelle: v.site?.libelle ?? '',
    dansMaTable: vendeursDeMesTables.has(txt(v.id)),
    dansMonEquipe:
      mesSites.has(txt(v.site?.id)) || mesPlaques.has(txt(v.site?.plaque_id)),
    sections:
      v.type_vehicule === 'VO'
        ? [{ marqueId: null, libelle: 'VO' }]
        : (v.vendeur_marque ?? [])
            .map((m) => m.marque)
            .filter((m): m is { id: number; libelle: string; ordre: number } => !!m)
            .sort((a, b) => a.ordre - b.ordre || comparerLibelle(a.libelle, b.libelle))
            .map((m) => ({ marqueId: txt(m.id), libelle: m.libelle })),
  }));

  return {
    campagne: entete,
    perimetre: decrirePerimetre(
      lignesTables,
      lignesVendeurs.map((v) => ({
        siteLibelle: v.site?.libelle ?? '',
        plaqueId: txt(v.site?.plaque_id),
      }))
    ),
    // TRI EN JAVASCRIPT, jamais celui de la base. La collation de PostgreSQL n'est
    // pas la meme en developpement (`French_France.1252`) que sur Supabase
    // (`en_US.utf8`), et cinq noms accentues sur 101 changent de place entre les
    // deux. `trierPar` donne le meme ordre partout.
    vendeurs: trierPar(projetes, (v) => v.nom),
    rdvs: rdvs.map(versRdv),
  };
}

interface LigneRdv {
  id: number;
  vendeur_id: number;
  jour: string;
  creneau_code: string;
  marque_id: number | null;
  type_vehicule: string;
  client: string;
  commentaire: string | null;
}

const versRdv = (r: LigneRdv): RdvSaisie => ({
  id: txt(r.id),
  vendeurId: txt(r.vendeur_id),
  jour: r.jour,
  creneauCode: r.creneau_code,
  marqueId: txtOuNull(r.marque_id),
  typeVehicule: r.type_vehicule,
  client: r.client,
  commentaire: r.commentaire,
});

/// Intitule du perimetre affiche en tete de la liste.
///
/// **Les tables sont un supplement, pas le mode normal.** Le perimetre par defaut
/// est le SITE : NORD et SUD-OUEST n'avaient aucune table en juin 2026, et l'outil
/// doit leur etre pleinement utilisable.
function decrirePerimetre(
  tables: {
    id: number;
    libelle: string;
    session_plaque: { plaque: { id: number; libelle: string } | null } | null;
  }[],
  vendeurs: { siteLibelle: string; plaqueId: string }[]
): PerimetreSaisie['perimetre'] {
  // Une seule plaque couverte ? On la retient. Deux ou plus — un admin, ou un chef
  // de plusieurs plaques — : aucune n'est « la mienne », et les panneaux live n'ont
  // alors aucune plaque a privilegier.
  const plaques = new Set(vendeurs.map((v) => v.plaqueId));
  const plaqueId = plaques.size === 1 ? [...plaques][0]! : null;

  if (tables.length === 1) {
    const t = tables[0]!;
    return {
      type: 'table',
      libelle: `${t.libelle} — ${t.session_plaque?.plaque?.libelle ?? ''}`,
      plaqueId: txtOuNull(t.session_plaque?.plaque?.id),
      tableId: txt(t.id),
    };
  }

  const sites = [...new Set(vendeurs.map((v) => v.siteLibelle))].sort(comparerLibelle);
  if (plaqueId === null) {
    return { type: 'global', libelle: 'Tous les vendeurs', plaqueId: null, tableId: null };
  }
  return {
    type: 'site',
    libelle: sites.length === 1 ? sites[0]! : `${sites.length} sites`,
    plaqueId,
    tableId: null,
  };
}


// ---------------------------------------------------------------- ecriture
//
// UN RDV = UN ALLER-RETOUR (lot 1 de PLAN-GRID-V2.md, 03/10/2026). Il en fallait
// trois — relire le type du vendeur, inserer, recompter — et quatre pour archiver.
// Le type est deja en memoire (`VendeurSaisie.typeVehicule`), et les compteurs se
// recalculent a l'ecran depuis les RDV en memoire : ni l'un ni l'autre ne
// justifiait un trajet vers la base pendant une seance.
//
// `rdv_poser` est SECURITY INVOKER : la politique `rdv_creation` (perimetre +
// campagne ouverte) et les triggers (marque autorisee, coherence VN/VO, jour et
// creneau de la campagne) s'appliquent comme avant. `cree_par` n'est toujours PAS
// envoye : `rdv_tracabilite` l'impose a partir de `auth.uid()`.
//
// LA CLE D'IDEMPOTENCE est generee ICI, une fois par RDV tape, et reutilisee a
// chaque nouvelle tentative de la file d'attente : une requete arrivee en base
// dont la reponse s'est perdue ne cree pas de second RDV.

const SELECT_RDV =
  'id, vendeur_id, jour, creneau_code, marque_id, type_vehicule, client, commentaire';

export const nouvelleCle = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : // Repli pour un navigateur sans `randomUUID` (contexte non securise) : un
      // uuid v4 tire de `getRandomValues`, meme format, meme entropie.
      '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c) =>
        (Number(c) ^ (crypto.getRandomValues(new Uint8Array(1))[0]! & (15 >> (Number(c) / 4)))).toString(16)
      );

export async function poserRdv(corps: {
  campagneId: string;
  vendeurId: string;
  typeVehicule: 'VN' | 'VO';
  jour: string;
  creneauCode: string;
  marqueId: string | null;
  client: string;
  cle: string;
}): Promise<{ rdv: RdvSaisie }> {
  const reponse = await supabase.rpc('rdv_poser', {
    p_campagne_id: Number(corps.campagneId),
    p_vendeur_id: Number(corps.vendeurId),
    p_jour: corps.jour,
    p_creneau_code: corps.creneauCode,
    p_marque_id: corps.marqueId ? Number(corps.marqueId) : null,
    p_type_vehicule: corps.typeVehicule,
    p_client: corps.client,
    p_cle: corps.cle,
  });
  return { rdv: versRdv(verifier(reponse) as unknown as LigneRdv) };
}

export async function modifierRdv(id: string, client: string): Promise<{ rdv: RdvSaisie }> {
  const reponse = await supabase
    .from('rdv')
    .update({ client })
    .eq('id', Number(id))
    .select(SELECT_RDV)
    .single();
  return { rdv: versRdv(verifier(reponse) as unknown as LigneRdv) };
}

/// INTERDIT N.1 : retirer un RDV est un `update` de `archive_le`, jamais un
/// `DELETE` — aucun droit `DELETE` n'est accorde sur `rdv`, a personne. Le RDV
/// sort des totaux, jamais de l'historique, et on sait qui l'a retire.
///
/// UNE SEULE REQUETE : le filtre `archive_le is null` rend l'operation
/// idempotente. Zero ligne touchee veut dire « deja archive » — ce que la
/// relecture prealable de l'ancienne version etablissait en un trajet de plus.
export async function archiverRdv(id: string): Promise<{ archive: boolean }> {
  // `archive_par` est pose par le trigger de tracabilite, pas par le client.
  const lignes = verifier(
    await supabase
      .from('rdv')
      .update({ archive_le: new Date().toISOString() })
      .eq('id', Number(id))
      .is('archive_le', null)
      .select('id')
  ) as { id: number }[];
  return { archive: lignes.length > 0 };
}
