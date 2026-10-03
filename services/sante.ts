import { supabase, verifier } from './supabase';

// ============================================================================
// LA SANTE DE LA BASE — reprise de l'app Forum 2026, adaptee a GRID.
//
// Le temps de reponse est chronometre DANS LE NAVIGATEUR : il inclut le reseau
// du poste, que nul compteur cote base ne voit. Une base a 2 ms derriere un wifi
// a 3 secondes est une base en panne du point de vue de celui qui saisit.
// ============================================================================

export interface Sonde {
  ok: boolean;
  heure: string;
  rdv_10min: number;
  rtt: number;
}

export interface SondeDetail extends Sonde {
  pool: number;
  pool_ouvertes: number;
  pool_max: number;
  connexions_max: number;
  verrous: number;
  bloquees: number;
  rdv_min: number;
  taille_mo: number;
  taille_max_mo: number;
  derniere_activite: string | null;
}

async function chronometrer<T>(f: () => Promise<T>): Promise<T & { rtt: number }> {
  const t0 = performance.now();
  const d = await f();
  return { ...d, rtt: Math.round(performance.now() - t0) };
}

export const sonder = () =>
  chronometrer(async () => verifier(await supabase.rpc('sante')) as unknown as Omit<Sonde, 'rtt'>);

export const sonderDetail = () =>
  chronometrer(async () => verifier(await supabase.rpc('sante_detail')) as unknown as Omit<SondeDetail, 'rtt'>);

export type Ton = 'ok' | 'tiede' | 'chaud' | 'coupe';

/// Les seuils sont volontairement PESSIMISTES, comme au Forum : mieux vaut un
/// orange pour rien qu'un vert le jour ou ca lache.
export const tonDe = (part: number): Ton => (part < 0.55 ? 'ok' : part < 0.8 ? 'tiede' : 'chaud');

/// Fraction du chemin vers la rupture, bornee a 1. C'est ce qui met sur la meme
/// echelle des millisecondes, des connexions et des verrous.
export const part = (v: number, rupture: number) => Math.min(1, Math.max(0, v / rupture));

/// 2 s : au-dela, on croit que c'est casse.
export const RUPTURE_RTT = 2000;
