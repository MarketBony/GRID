import { supabase, txt, verifier } from './supabase';

// ============================================================================
// EFFECTIFS PAR SESSION — onglet Effectifs (D12 de PLAN-GRID-V2.md).
//
// La table `mobilisation` ne porte que les EXCEPTIONS : sans ligne, la regle par
// defaut de `mobilisation()` (agregats.ts) s'applique. Basculer un vendeur, c'est
// poser ou modifier SA ligne — jamais en supprimer une (interdit n.1). Reserve a
// admin et direction, par la RLS.
// ============================================================================

export interface Exception {
  mobilise: boolean;
  motif: string | null;
}

export async function chargerMobilisations(campagneId: string): Promise<Map<string, Exception>> {
  const lignes = verifier(
    await supabase
      .from('mobilisation')
      .select('vendeur_id, mobilise, motif')
      .eq('campagne_id', Number(campagneId))
  ) as { vendeur_id: number; mobilise: boolean; motif: string | null }[];
  return new Map(lignes.map((l) => [txt(l.vendeur_id), { mobilise: l.mobilise, motif: l.motif }]));
}

/// Pose l'exception, en un appel : `upsert` sur (campagne, vendeur). Rejouer le
/// meme geste rend le meme etat.
export async function definirMobilisation(
  campagneId: string,
  vendeurId: string,
  mobilise: boolean,
  motif: string | null = null
): Promise<void> {
  verifier(
    await supabase
      .from('mobilisation')
      .upsert(
        { campagne_id: Number(campagneId), vendeur_id: Number(vendeurId), mobilise, motif },
        { onConflict: 'campagne_id,vendeur_id' }
      )
  );
}
