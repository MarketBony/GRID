import { ErreurApi, supabase, txt, txtOuNull, verifier, toutesLesLignes } from './supabase';
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

export async function chargerSaisie(campagneId: string): Promise<PerimetreSaisie> {
  const id = Number(campagneId);

  const [campagne, jours, creneaux, perimetre] = await Promise.all([
    supabase.from('campagne').select('id, libelle, cloturee').eq('id', id).single(),
    supabase.from('campagne_jour').select('jour, ordre').eq('campagne_id', id).order('ordre'),
    supabase
      .from('campagne_creneau')
      .select('code, libelle, ordre')
      .eq('campagne_id', id)
      .order('ordre'),
    supabase.from('perimetre_saisie').select('vendeur_id').eq('campagne_id', id),
  ]);

  const c = verifier(campagne);
  const entete = {
    id: txt(c.id),
    libelle: c.libelle,
    cloturee: c.cloturee,
    jours: verifier(jours).map((j) => ({ jour: j.jour as string, ordre: j.ordre })),
    creneaux: verifier(creneaux).map((cr) => ({
      code: cr.code,
      libelle: cr.libelle,
      ordre: cr.ordre,
    })),
  };

  const ids = verifier(perimetre).map((p) => p.vendeur_id as number);

  // CE N'EST PAS UNE ERREUR, c'est le cas d'un chef de table de juin qui ouvre
  // septembre. On le dit, avec la raison — un ecran vide sans explication est le
  // pire mode d'echec de cette architecture.
  if (ids.length === 0) {
    return { campagne: entete, perimetre: null, vendeurs: [], rdvs: [], message: AUCUN_PERIMETRE };
  }

  const [vendeurs, rdvs, tables] = await Promise.all([
    supabase
      .from('vendeur')
      .select(
        'id, nom, type_vehicule, site(id, code, libelle, plaque_id), vendeur_marque(marque(id, libelle, ordre))'
      )
      .in('id', ids),
    // Les RDV de CE perimetre. La politique de `rdv` les restreindrait de toute
    // facon, mais filtrer ici evite de rapatrier puis jeter.
    toutesLesLignes<LigneRdv>((de, a) =>
      supabase
        .from('rdv')
        .select(
          'id, vendeur_id, jour, creneau_code, marque_id, type_vehicule, client, commentaire',
          { count: 'exact' }
        )
        .eq('campagne_id', id)
        .in('vendeur_id', ids)
        .is('archive_le', null)
        .range(de, a)
    ),
    // Les tables auxquelles ces vendeurs appartiennent, pour intituler le
    // perimetre. Filtrees sur les tables que J'ANIME : c'est ce qui distingue
    // « ma table » de « une table ou se trouvent mes vendeurs ».
    supabase
      .from('table_phoning')
      .select('id, libelle, session_plaque!inner(campagne_id, plaque(id, libelle))')
      .eq('chef_utilisateur_id', await monId())
      .eq('session_plaque.campagne_id', id)
      .is('archive_le', null),
  ]);

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
  };

  const lignesVendeurs = verifier(vendeurs) as unknown as LigneVendeur[];
  const lignesTables = verifier(tables) as unknown as LigneTable[];

  const projetes: VendeurSaisie[] = lignesVendeurs.map((v) => ({
    id: txt(v.id),
    nom: v.nom,
    typeVehicule: v.type_vehicule as 'VN' | 'VO',
    siteId: txt(v.site?.id),
    siteCode: v.site?.code ?? '',
    siteLibelle: v.site?.libelle ?? '',
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

async function monId(): Promise<number> {
  const { data } = await supabase.rpc('utilisateur_courant');
  return (data as number | null) ?? -1;
}

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
// Les RDV s'ecrivent EN DIRECT, sans passer par une fonction : ce sont des lignes
// independantes, donc rien a rendre atomique. Les politiques `rdv_creation` et
// `rdv_modification` verifient le perimetre ET l'ouverture de la campagne, et les
// six triggers verifient le reste (marque autorisee, coherence VN/VO, jour et
// creneau de la campagne).
//
// `cree_par` N'EST PAS ENVOYE : le trigger `rdv_tracabilite` l'impose a partir de
// `auth.uid()`. C'est le navigateur qui compose la requete, il pourrait y ecrire
// n'importe quel identifiant — une attribution declarative ne vaudrait rien le
// jour ou un RDV est conteste.

const SELECT_RDV =
  'id, vendeur_id, jour, creneau_code, marque_id, type_vehicule, client, commentaire';

async function compteurs(vendeurId: string, campagneId: string): Promise<Compteurs> {
  const reponse = await supabase
    .from('rdv')
    .select('marque_id')
    .eq('campagne_id', Number(campagneId))
    .eq('vendeur_id', Number(vendeurId))
    .is('archive_le', null);

  const lignes = verifier(reponse) as { marque_id: number | null }[];
  const parMarque: Record<string, number> = {};
  for (const l of lignes) {
    const cle = l.marque_id === null ? 'sansMarque' : txt(l.marque_id);
    parMarque[cle] = (parMarque[cle] ?? 0) + 1;
  }
  return { vendeurId, total: lignes.length, parMarque };
}

export async function poserRdv(corps: {
  campagneId: string;
  vendeurId: string;
  jour: string;
  creneauCode: string;
  marqueId: string | null;
  client: string;
}): Promise<{ rdv: RdvSaisie; compteurs: Compteurs }> {
  // `type_vehicule` est STOCKE sur le RDV bien qu'il soit deductible du vendeur :
  // si un vendeur change de metier, le deriver ferait bouger les totaux VN/VO
  // d'une campagne DEJA CLOTUREE. Un trigger impose l'egalite a l'ecriture, donc
  // les deux ne peuvent pas diverger — on le lit ici pour la fournir.
  const v = verifier(
    await supabase.from('vendeur').select('type_vehicule').eq('id', Number(corps.vendeurId)).single()
  ) as { type_vehicule: string } | null;
  if (!v) throw new ErreurApi('Vendeur introuvable.', 404);

  const reponse = await supabase
    .from('rdv')
    .insert({
      campagne_id: Number(corps.campagneId),
      vendeur_id: Number(corps.vendeurId),
      jour: corps.jour,
      creneau_code: corps.creneauCode,
      marque_id: corps.marqueId ? Number(corps.marqueId) : null,
      type_vehicule: v.type_vehicule,
      client: corps.client,
    })
    .select(SELECT_RDV)
    .single();

  const rdv = versRdv(verifier(reponse) as unknown as LigneRdv);
  return { rdv, compteurs: await compteurs(corps.vendeurId, corps.campagneId) };
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
export async function archiverRdv(
  id: string
): Promise<{ archive?: boolean; dejaArchive?: boolean; compteurs: Compteurs }> {
  const avant = verifier(
    await supabase
      .from('rdv')
      .select('id, campagne_id, vendeur_id, archive_le')
      .eq('id', Number(id))
      .single()
  ) as { campagne_id: number; vendeur_id: number; archive_le: string | null };

  if (avant.archive_le) {
    return {
      dejaArchive: true,
      compteurs: await compteurs(txt(avant.vendeur_id), txt(avant.campagne_id)),
    };
  }

  // `archive_par` est pose par le trigger de tracabilite, pas par le client.
  verifier(
    await supabase
      .from('rdv')
      .update({ archive_le: new Date().toISOString() })
      .eq('id', Number(id))
      .select('id')
      .single()
  );

  return {
    archive: true,
    compteurs: await compteurs(txt(avant.vendeur_id), txt(avant.campagne_id)),
  };
}
