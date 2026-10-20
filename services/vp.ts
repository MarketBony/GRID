import { supabase, toutesLesLignes, txt, txtOuNull, verifier } from './supabase';
import { chargerSaisie } from './saisie';
import { chargerSuivi, type RdvSuivi } from './suivi';
import type { CreneauVp, RdvVp, VendeurVp } from '../backend/src/utils/vp';

// ============================================================================
// GRID/VP — LES LECTURES ET LES ECRITURES DE LA VENTE PRIVEE (20/10/2026).
//
// UNE VP EST UNE CAMPAGNE (PLAN-GRID-VP.md) : on relit donc par les memes
// chemins que GRID classique — `charger_saisie` pour les vendeurs du perimetre,
// `charger_suivi` pour les RDV et leur issue — et on ne demande en plus que ce
// qui est propre a la VP : qui a pris le RDV, quand, et ou en est l'accueil.
//
// Aucun calcul ici. Les ecrans rejouent les fonctions pures de `utils/vp.ts`.
// ============================================================================

export interface VpResume {
  id: string;
  libelle: string;
  siteId: string;
  siteLibelle: string;
  /// Le jour des RDV (J3), ISO.
  jour: string;
  phoningDu: string;
  phoningAu: string;
  cloturee: boolean;
}

interface LigneVp {
  id: number;
  libelle: string;
  date_debut: string;
  phoning_du: string;
  phoning_au: string;
  cloturee: boolean;
  site: { id: number; libelle: string } | null;
}

const versResume = (l: LigneVp): VpResume => ({
  id: txt(l.id),
  libelle: l.libelle,
  siteId: txt(l.site?.id),
  siteLibelle: l.site?.libelle ?? '',
  jour: l.date_debut,
  phoningDu: l.phoning_du,
  phoningAu: l.phoning_au,
  cloturee: l.cloturee,
});

const SELECT_VP = 'id, libelle, date_debut, phoning_du, phoning_au, cloturee, site(id, libelle)';

/// Les VP visibles, la plus recente d'abord. `campagne` est lisible par tout
/// compte (les compteurs sont publics) : c'est la saisie et le Suivi qui
/// restreignent ensuite aux vendeurs du perimetre.
export async function chargerVps(): Promise<VpResume[]> {
  const r = await supabase
    .from('campagne')
    .select(SELECT_VP)
    .eq('nature', 'vente_privee')
    .is('archive_le', null)
    .order('date_debut', { ascending: false });
  return (verifier(r) as unknown as LigneVp[]).map(versResume);
}

/// Un vendeur de la VP, tel que les ecrans l'affichent.
export interface VendeurDeVp extends VendeurVp {
  marques: { id: string; libelle: string }[];
  motif: string | null;
}

/// Un RDV de la VP, tel que les ecrans l'affichent.
export interface RdvDeVp extends RdvVp {
  client: string;
  marque: string | null;
  creneau: string;
  vd: boolean;
  modele: string | null;
  commentaire: string | null;
}

export interface DonneesVp {
  vp: VpResume;
  creneaux: CreneauVp[];
  vendeurs: VendeurDeVp[];
  rdvs: RdvDeVp[];
}

export async function chargerDonneesVp(vp: VpResume): Promise<DonneesVp> {
  const id = Number(vp.id);
  const [saisie, suivi, mobilisations, poses, accueil] = await Promise.all([
    chargerSaisie(vp.id),
    chargerSuivi(vp.id),
    supabase.from('mobilisation').select('vendeur_id, mobilise, motif, objectif_rdv').eq('campagne_id', id),
    // Paginees et ORDONNEES par la cle primaire (CLAUDE.md) : une VP compte une
    // centaine de RDV, mais la regle ne depend pas du volume.
    toutesLesLignes<{ id: number; pris_par_vendeur_id: number | null; cree_le: string }>(
      (de, a) =>
        supabase
          .from('rdv')
          .select('id, pris_par_vendeur_id, cree_le', { count: 'exact' })
          .eq('campagne_id', id)
          .is('archive_le', null)
          .range(de, a),
      'id'
    ),
    toutesLesLignes<{ rdv_id: number; arrive_le: string | null; avec_vendeur_le: string | null; sorti_le: string | null }>(
      (de, a) =>
        supabase
          .from('rdv_suivi')
          .select('rdv_id, arrive_le, avec_vendeur_le, sorti_le, rdv!inner(campagne_id)', { count: 'exact' })
          .eq('rdv.campagne_id', id)
          .range(de, a),
      'rdv_id'
    ),
  ]);

  const mob = new Map(
    (verifier(mobilisations) as unknown as { vendeur_id: number; mobilise: boolean; motif: string | null; objectif_rdv: number | null }[]).map(
      (m) => [txt(m.vendeur_id), m]
    )
  );
  const pose = new Map(poses.map((p) => [txt(p.id), p]));
  const etapes = new Map(accueil.map((a) => [txt(a.rdv_id), a]));

  const vendeurs: VendeurDeVp[] = saisie.vendeurs.map((v) => {
    const m = mob.get(v.id);
    return {
      id: v.id,
      nom: v.nom,
      siteId: v.siteId,
      siteLibelle: v.siteLibelle,
      // La plaque ne sert a `mobilisation()` qu'a reperer les tables : une VP
      // n'en a pas, une valeur commune suffit.
      plaqueId: '',
      plaqueLibelle: '',
      // Une VP n'a pas de table : tout vendeur du site est mobilise par defaut.
      tableId: null,
      tableLibelle: null,
      typeVehicule: v.typeVehicule,
      mobilise: m ? m.mobilise : null,
      objectifRdv: m?.objectif_rdv ?? null,
      motif: m?.motif ?? null,
      marques: v.sections.filter((x) => x.marqueId !== null).map((x) => ({ id: x.marqueId!, libelle: x.libelle })),
    };
  });

  const rdvs: RdvDeVp[] = suivi.map((r: RdvSuivi) => {
    const p = pose.get(r.id);
    const e = etapes.get(r.id);
    return {
      id: r.id,
      vendeurId: r.vendeurId,
      prisParVendeurId: txtOuNull(p?.pris_par_vendeur_id ?? null),
      jour: r.jour,
      creneauCode: r.creneauCode,
      creneau: r.creneau,
      typeVehicule: r.typeVehicule,
      marqueId: r.marqueId,
      marque: r.marque,
      source: r.source,
      creeLe: p?.cree_le ?? new Date(0).toISOString(),
      issue: r.issue,
      diac: r.diac,
      stock: r.stock,
      cs: r.cs,
      vd: r.vd,
      modele: r.modele,
      commentaire: r.commentaire,
      client: r.client,
      arriveLe: e?.arrive_le ?? null,
      avecVendeurLe: e?.avec_vendeur_le ?? null,
      sortiLe: e?.sorti_le ?? null,
    };
  });

  return {
    vp,
    creneaux: saisie.campagne.creneaux.map((c) => ({ code: c.code, libelle: c.libelle, ordre: c.ordre })),
    vendeurs,
    rdvs,
  };
}

// ---------------------------------------------------------------- parametrage (admin)

/// Cree la VP : la campagne, son jour, les creneaux du modele — une transaction
/// en base (`vp_creer`). Le modele est une operation de GRID classique : c'est
/// la que vivent les creneaux de reference.
export async function creerVp(corps: {
  libelle: string;
  siteId: string;
  jour: string;
  phoningDu: string;
  phoningAu: string;
  modeleId: string;
}): Promise<string> {
  const r = await supabase.rpc('vp_creer', {
    p_libelle: corps.libelle,
    p_site_id: Number(corps.siteId),
    p_jour: corps.jour,
    p_phoning_du: corps.phoningDu,
    p_phoning_au: corps.phoningAu,
    p_modele_id: Number(corps.modeleId),
  });
  return txt(verifier(r) as unknown as number);
}

/// Libelle et jours de phoning. Le jour de la VP passe par `campagne_definir_jours`
/// (il deplace les RDV) puis par cette mise a jour : le CHECK exige J1 <= J2 < J3
/// a chaque instant, l'ecran envoie donc des dates deja coherentes.
export async function modifierVp(
  id: string,
  champs: { libelle?: string; phoningDu?: string; phoningAu?: string; jour?: string }
): Promise<void> {
  const maj: Record<string, unknown> = {};
  if (champs.libelle !== undefined) maj.libelle = champs.libelle;
  if (champs.phoningDu !== undefined) maj.phoning_du = champs.phoningDu;
  if (champs.phoningAu !== undefined) maj.phoning_au = champs.phoningAu;
  if (champs.jour !== undefined) {
    maj.date_debut = champs.jour;
    maj.date_fin = champs.jour;
  }
  verifier(await supabase.from('campagne').update(maj).eq('id', Number(id)).select('id').single());
}

/// Present ou absent, motif, objectif : UNE ligne de `mobilisation` par vendeur.
export async function poserMobilisation(
  campagneId: string,
  vendeurId: string,
  champs: { mobilise: boolean; motif: string | null; objectifRdv: number | null }
): Promise<void> {
  verifier(
    await supabase.from('mobilisation').upsert(
      {
        campagne_id: Number(campagneId),
        vendeur_id: Number(vendeurId),
        mobilise: champs.mobilise,
        motif: champs.mobilise ? null : champs.motif,
        objectif_rdv: champs.objectifRdv,
      },
      { onConflict: 'campagne_id,vendeur_id' }
    )
  );
}

export async function cloturerVp(id: string): Promise<void> {
  verifier(await supabase.from('campagne').update({ cloturee: true }).eq('id', Number(id)).select('id').single());
}

// ---------------------------------------------------------------- jour J

export async function reaffecterRdv(rdvId: string, vendeurId: string): Promise<void> {
  verifier(await supabase.rpc('rdv_reaffecter', { p_rdv_id: Number(rdvId), p_vendeur_id: Number(vendeurId) }));
}

/// Un geste a la tablette : le client avance d'UNE etape. La base sait laquelle.
export async function avancerAccueil(rdvId: string): Promise<void> {
  verifier(await supabase.rpc('rdv_accueil_avancer', { p_rdv_id: Number(rdvId) }));
}

export async function reculerAccueil(rdvId: string): Promise<void> {
  verifier(await supabase.rpc('rdv_accueil_reculer', { p_rdv_id: Number(rdvId) }));
}

/// Clore la journee : rend le nombre de RDV passes en No show.
export async function noShowAbsents(campagneId: string): Promise<number> {
  return Number(verifier(await supabase.rpc('vp_noshow_absents', { p_campagne_id: Number(campagneId) })));
}
