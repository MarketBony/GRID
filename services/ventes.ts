import { supabase, toutesLesLignes, txt, txtOuNull, verifier } from './supabase';
import type { LigneVente } from '../backend/src/utils/ventes';

// ============================================================================
// LE TABLEAU DES VENTES (05/10/2026). Lit la vue `relance.vente` — une ligne par
// commande du Suivi, GLOBALE, sans aucun nom — et les objectifs VPP. Les totaux
// se font dans `utils/ventes.ts`, jamais ici (interdit n.2).
// ============================================================================

interface Ligne {
  rdv_id: number;
  site_id: number | null;
  marque_id: number | null;
  jour: string;
  type_vehicule: 'VN' | 'VO';
  diac: boolean;
  vd: boolean;
}

/// PAGINEE ET ORDONNEE sur la cle (`rdv_id`) : une campagne peut depasser les
/// 1 000 lignes de PostgREST, et sans ordre deux pages se recouvrent.
export async function chargerVentes(campagneId: string): Promise<LigneVente[]> {
  const n = Number(campagneId);
  const lignes = await toutesLesLignes<Ligne>(
    (de, a) =>
      supabase
        .from('vente')
        .select('rdv_id, site_id, marque_id, jour, type_vehicule, diac, vd', { count: 'exact' })
        .eq('campagne_id', n)
        .range(de, a),
    'rdv_id'
  );
  return lignes.map((l) => ({
    siteId: txt(l.site_id),
    marqueId: txtOuNull(l.marque_id),
    jour: l.jour,
    typeVehicule: l.type_vehicule,
    diac: l.diac,
    vd: l.vd,
  }));
}

/// Cle `site|marque` -> objectif de ventes VPP. Absent ou nul = pas d'objectif.
export async function chargerObjectifs(campagneId: string): Promise<Map<string, number>> {
  const lignes = verifier(
    await supabase
      .from('objectif_vente')
      .select('site_id, marque_id, ventes')
      .eq('campagne_id', Number(campagneId))
  ) as unknown as { site_id: number; marque_id: number; ventes: number | null }[];
  const m = new Map<string, number>();
  for (const l of lignes) if (l.ventes !== null) m.set(`${l.site_id}|${l.marque_id}`, l.ventes);
  return m;
}

/// Pose ou change un objectif. `null` l'efface sans supprimer la ligne
/// (interdit n.1). La RLS le reserve a `admin` et `direction`.
export async function enregistrerObjectif(
  campagneId: string,
  siteId: string,
  marqueId: string,
  ventes: number | null
): Promise<void> {
  verifier(
    await supabase
      .from('objectif_vente')
      .upsert(
        { campagne_id: Number(campagneId), site_id: Number(siteId), marque_id: Number(marqueId), ventes },
        { onConflict: 'campagne_id,site_id,marque_id' }
      )
  );
}
