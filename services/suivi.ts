import { supabase, txt, txtOuNull, verifier } from './supabase';
import type { IssueSuivi, SourceRdv } from '../backend/src/auth/roles';
import type { LigneSuivi } from '../backend/src/utils/suivi';

// ============================================================================
// SUIVI DES RDV — rubrique du lot 6 de PLAN-GRID-V2.md.
//
// Les personnes qui saisissent les RDV de leurs vendeurs en font aussi le suivi :
// meme perimetre, lu par la meme RLS (`rdv_suivi` suit `rdv`, qui suit
// `perimetre_saisie`). Le suivi se ferme avec la campagne (D10).
// ============================================================================

export interface RdvSuivi {
  id: string;
  vendeurId: string;
  vendeur: string;
  siteId: string;
  site: string;
  siteCode: string;
  jour: string;
  creneauCode: string;
  creneau: string;
  creneauOrdre: number;
  marqueId: string | null;
  marque: string | null;
  typeVehicule: 'VN' | 'VO';
  client: string;
  source: SourceRdv;
  issue: IssueSuivi | null;
  diac: boolean;
  stock: boolean;
  cs: boolean;
  /// Vehicule de demonstration : seulement sur une commande STOCK d'un RDV VN.
  vd: boolean;
  modele: string | null;
  commentaire: string | null;
}

interface Ligne {
  id: number;
  vendeur_id: number;
  vendeur: string;
  site_id: number | null;
  site: string | null;
  site_code: string | null;
  jour: string;
  creneau_code: string;
  creneau: string | null;
  creneau_ordre: number | null;
  marque_id: number | null;
  marque: string | null;
  type_vehicule: 'VN' | 'VO';
  client: string;
  source: SourceRdv;
  issue: IssueSuivi | null;
  diac: boolean;
  stock: boolean;
  cs: boolean;
  vd: boolean;
  modele: string | null;
  commentaire: string | null;
}

export async function chargerSuivi(campagneId: string): Promise<RdvSuivi[]> {
  const lignes = verifier(
    await supabase.rpc('charger_suivi', { p_campagne_id: Number(campagneId) })
  ) as unknown as Ligne[];
  return lignes.map((l) => ({
    id: txt(l.id),
    vendeurId: txt(l.vendeur_id),
    vendeur: l.vendeur,
    siteId: txt(l.site_id),
    site: l.site ?? '',
    siteCode: l.site_code ?? '',
    jour: l.jour,
    creneauCode: l.creneau_code,
    creneau: l.creneau ?? l.creneau_code,
    creneauOrdre: l.creneau_ordre ?? 0,
    marqueId: txtOuNull(l.marque_id),
    marque: l.marque,
    typeVehicule: l.type_vehicule,
    client: l.client,
    source: l.source,
    issue: l.issue,
    diac: l.diac,
    stock: l.stock,
    cs: l.cs,
    vd: l.vd ?? false,
    modele: l.modele,
    commentaire: l.commentaire,
  }));
}

/// La projection vers les fonctions PURES de `utils/suivi.ts` : c'est elle que
/// `test:suivi` demontre contre le fichier de juin.
export const versLigneSuivi = (r: RdvSuivi): LigneSuivi => ({
  vendeurId: r.vendeurId,
  vendeurNom: r.vendeur,
  siteId: r.siteId,
  siteLibelle: r.site,
  source: r.source,
  issue: r.issue,
  diac: r.diac,
  stock: r.stock,
  cs: r.cs,
});

export interface Qualification {
  issue: IssueSuivi | null;
  diac: boolean;
  stock: boolean;
  cs: boolean;
  vd: boolean;
  modele: string | null;
  commentaire: string | null;
}

/// Qualifier un RDV. Un seul appel, SECURITY INVOKER : les politiques de
/// `rdv_suivi` decident, et le CHECK refuse DIAC / STOCK / CS hors commande.
export async function enregistrerSuivi(rdvId: string, q: Qualification): Promise<void> {
  // Garde-fou cote ecran, en miroir du CHECK : on n'envoie jamais un avantage
  // sur une issue qui n'est pas une commande.
  const commande = q.issue === 'commande';
  verifier(
    await supabase.rpc('suivi_enregistrer', {
      p_rdv_id: Number(rdvId),
      p_issue: q.issue,
      p_diac: commande && q.diac,
      p_stock: commande && q.stock,
      p_cs: commande && q.cs,
      p_modele: q.modele,
      p_commentaire: q.commentaire,
      p_vd: commande && q.stock && q.vd,
    })
  );
}

/// UN RDV DE TRAFIC NATUREL (D5) : il se saisit ici, et n'entre dans aucun
/// classement du phoning. Meme chemin que `rdv_poser` — perimetre, campagne
/// ouverte, marque autorisee, idempotence par cle.
export async function poserTraficNaturel(corps: {
  campagneId: string;
  vendeurId: string;
  typeVehicule: 'VN' | 'VO';
  jour: string;
  creneauCode: string;
  marqueId: string | null;
  client: string;
  cle: string;
}): Promise<string> {
  const r = verifier(
    await supabase.rpc('rdv_poser_showroom', {
      p_campagne_id: Number(corps.campagneId),
      p_vendeur_id: Number(corps.vendeurId),
      p_jour: corps.jour,
      p_creneau_code: corps.creneauCode,
      p_marque_id: corps.marqueId ? Number(corps.marqueId) : null,
      p_type_vehicule: corps.typeVehicule,
      p_client: corps.client,
      p_cle: corps.cle,
    })
  ) as unknown as { id: number };
  return txt(r.id);
}
