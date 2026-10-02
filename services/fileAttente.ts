import { ErreurApi } from './supabase';
import type { poserRdv } from './saisie';

// ============================================================================
// FILE D'ATTENTE DES RDV — lot 1 de PLAN-GRID-V2.md (03/10/2026).
//
// UN RDV TAPE NE SE PERD JAMAIS. Le 08/09/2026, l'instance saturee rendait des
// delais depasses : chaque RDV refuse etait a retaper, et le rechargement complet
// declenche par l'echec aggravait la saturation au pire moment.
//
// Desormais, une pose qui echoue pour une raison PASSAGERE (reseau, delai,
// passerelle) reste a l'ecran, marquee « en attente », et repart seule avec un
// delai croissant. Une pose refusee pour une raison METIER (marque non autorisee,
// campagne cloturee, hors perimetre) ne repart pas : la rejouer ne changerait
// rien, et l'utilisateur doit le savoir tout de suite.
//
// LA CLE D'IDEMPOTENCE voyage avec la pose : rejouee, `rdv_poser` ne cree pas de
// second RDV. La file est conservee dans `localStorage` — un onglet ferme ou un
// navigateur qui plante en pleine seance retrouve ses poses au rechargement. Ce
// n'est qu'un TAMPON : la verite reste en base, et la file se vide des que la
// base a repondu.
// ============================================================================

export type CorpsPose = Parameters<typeof poserRdv>[0];

export interface PoseEnAttente {
  cle: string;
  corps: CorpsPose;
  essais: number;
}

const cleStockage = (campagneId: string) => `grid.file-attente.${campagneId}`;

/// `localStorage` peut etre absent, plein ou bloque (navigation privee, donnees
/// effacees) : la file continue alors en memoire seulement, sans rien casser.
export function lireFile(campagneId: string): PoseEnAttente[] {
  try {
    const brut = localStorage.getItem(cleStockage(campagneId));
    const liste = brut ? (JSON.parse(brut) as PoseEnAttente[]) : [];
    return Array.isArray(liste) ? liste.filter((p) => p && p.cle && p.corps) : [];
  } catch {
    return [];
  }
}

export function ecrireFile(campagneId: string, liste: PoseEnAttente[]): void {
  try {
    if (liste.length === 0) localStorage.removeItem(cleStockage(campagneId));
    else localStorage.setItem(cleStockage(campagneId), JSON.stringify(liste));
  } catch {
    // Tampon indisponible : la file vit en memoire, c'est suffisant pour la seance.
  }
}

/// Les codes SQLSTATE qui disent « la base est debordee », pas « la demande est
/// fausse » : delai d'instruction depasse, trop de connexions, connexion perdue.
const CODES_PASSAGERS = new Set(['57014', '53300', '53400', '08000', '08003', '08006', 'PGRST000', 'PGRST001', 'PGRST002', 'PGRST003']);

/// PASSAGERE ou DEFINITIVE ? Tout ce qui n'est pas clairement passager est traite
/// comme definitif : rejouer en boucle une demande fausse remplirait la file et
/// chargerait la base pour rien. Le doute se paie d'un message, pas d'une boucle.
export function estPassagere(e: unknown): boolean {
  if (e instanceof TypeError) return true; // `fetch` sans reseau
  if (!(e instanceof ErreurApi)) return false;
  if (e.statut === 409 || e.statut === 403 || e.statut === 401 || e.statut === 404) return false;
  const corps = (e.corps ?? {}) as { code?: string; message?: string };
  if (corps.code && CODES_PASSAGERS.has(corps.code)) return true;
  // Une erreur SQL identifiee (contrainte, droit…) n'est pas passagere.
  if (corps.code && /^[0-9A-Z]{5}$/.test(corps.code)) return false;
  return /fetch|network|timeout|timed out|gateway|upstream|50[234]|ECONN/i.test(
    `${corps.message ?? ''} ${e.message}`
  );
}

/// 2 s, 5 s, 10 s, 20 s, puis toutes les 30 s. Le premier essai est rapide —
/// un incident reseau d'une seconde ne doit pas se voir —, les suivants laissent
/// respirer une instance saturee au lieu de l'achever.
export const delaiAvantEssai = (essais: number): number =>
  [2_000, 5_000, 10_000, 20_000][essais] ?? 30_000;
