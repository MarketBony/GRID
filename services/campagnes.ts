import { ErreurApi, supabase, txt, verifier } from './supabase';

// ============================================================================
// MODULE A — les campagnes, leurs jours et leurs creneaux.
//
// R-A.2 EST LA REGLE DELICATE : retirer un jour qui porte des RDV ne doit ni
// echouer sechement, ni creer des orphelins. Le garde-fou est une CLE ETRANGERE
// COMPOSITE — un RDV ne peut porter qu'un jour appartenant a sa campagne — donc la
// base refuse en dernier recours, et l'interface DOIT traiter le cas avant.
//
// La fonction `relance.campagne_definir_jours` fonctionne en deux temps : appelee
// sans mode, elle SONDE et rend les RDV impactes sans rien toucher ; appelee avec
// `deplacer`, elle applique. Ce service traduit le premier cas en `ErreurApi(409)`
// pour que `Campagne.tsx` n'ait pas a bouger — l'ecran attendait deja un 409 avec
// le detail dans `corps`.
// ============================================================================

export interface CampagneResume {
  id: string;
  libelle: string;
  dateDebut: string;
  dateFin: string;
  cloturee: boolean;
  vendeursSaisissables: number;
}

export interface JourCampagne {
  jour: string;
  ordre: number;
}

export interface CreneauCampagne {
  code: string;
  libelle: string;
  ordre: number;
}

export interface SessionCampagne {
  id: string;
  plaqueId: string;
  plaqueLibelle: string;
  mode: string;
  effectifCibleTable: number | null;
}

export interface CampagneDetail extends CampagneResume {
  jours: JourCampagne[];
  creneaux: CreneauCampagne[];
  sessions: SessionCampagne[];
}

export interface ImpactJour {
  jour: string;
  actifs: number;
  archives: number;
  vendeurs: string[];
}

export interface ImpactCreneau {
  creneau: string;
  actifs: number;
  archives: number;
  vendeurs: string[];
}

export interface ConflitRdv<T> {
  code: 'RDV_IMPACTES';
  message: string;
  retires: string[];
  ajoutes: string[];
  impacts: T[];
  joursConserves?: string[];
  creneauxConserves?: string[];
}

export type Confirmation = { mode: 'annuler' } | { mode: 'deplacer'; vers: string };

const SELECT_CAMPAGNE = 'id, libelle, date_debut, date_fin, cloturee';

interface LigneCampagne {
  id: number;
  libelle: string;
  date_debut: string;
  date_fin: string;
  cloturee: boolean;
}

const versResume = (c: LigneCampagne, saisissables: number): CampagneResume => ({
  id: txt(c.id),
  libelle: c.libelle,
  dateDebut: c.date_debut,
  dateFin: c.date_fin,
  cloturee: c.cloturee,
  vendeursSaisissables: saisissables,
});

/// `vendeursSaisissables` vient de la vue `perimetre_saisie`, donc de la MEME
/// source que les politiques. Zero n'est pas une anomalie : les droits sont par
/// campagne, etre chef de table en juin n'en donne aucun en septembre — et
/// l'ecran a besoin de le montrer pour que la situation soit comprehensible.
export async function chargerCampagnes(): Promise<CampagneResume[]> {
  const [campagnes, perimetre] = await Promise.all([
    supabase.from('campagne').select(SELECT_CAMPAGNE).is('archive_le', null).order('date_debut', { ascending: false }),
    supabase.from('perimetre_saisie').select('campagne_id'),
  ]);

  const parCampagne = new Map<string, number>();
  for (const p of verifier(perimetre) as { campagne_id: number }[]) {
    const cle = txt(p.campagne_id);
    parCampagne.set(cle, (parCampagne.get(cle) ?? 0) + 1);
  }

  return (verifier(campagnes) as unknown as LigneCampagne[]).map((c) =>
    versResume(c, parCampagne.get(txt(c.id)) ?? 0)
  );
}

export async function chargerCampagne(id: string): Promise<CampagneDetail> {
  const n = Number(id);
  const [campagne, jours, creneaux, sessions, perimetre] = await Promise.all([
    supabase.from('campagne').select(SELECT_CAMPAGNE).eq('id', n).single(),
    supabase.from('campagne_jour').select('jour, ordre').eq('campagne_id', n).order('ordre'),
    supabase.from('campagne_creneau').select('code, libelle, ordre').eq('campagne_id', n).order('ordre'),
    supabase
      .from('session_plaque')
      .select('id, mode, effectif_cible_table, plaque(id, libelle, ordre)')
      .eq('campagne_id', n)
      .is('archive_le', null),
    supabase.from('perimetre_saisie').select('vendeur_id').eq('campagne_id', n),
  ]);

  type LigneSession = {
    id: number;
    mode: string;
    effectif_cible_table: number | null;
    plaque: { id: number; libelle: string; ordre: number } | null;
  };

  return {
    ...versResume(verifier(campagne) as unknown as LigneCampagne, verifier(perimetre).length),
    jours: verifier(jours).map((j) => ({ jour: j.jour as string, ordre: j.ordre })),
    creneaux: verifier(creneaux).map((c) => ({
      code: c.code,
      libelle: c.libelle,
      ordre: c.ordre,
    })),
    sessions: (verifier(sessions) as unknown as LigneSession[])
      .slice()
      .sort((a, b) => (a.plaque?.ordre ?? 0) - (b.plaque?.ordre ?? 0))
      .map((s) => ({
        id: txt(s.id),
        plaqueId: txt(s.plaque?.id),
        plaqueLibelle: s.plaque?.libelle ?? '',
        mode: s.mode,
        effectifCibleTable: s.effectif_cible_table,
      })),
  };
}

export async function modifierCampagne(
  id: string,
  champs: Partial<Pick<CampagneResume, 'libelle' | 'dateDebut' | 'dateFin' | 'cloturee'>>
): Promise<CampagneResume> {
  const maj: Record<string, unknown> = {};
  if (champs.libelle !== undefined) maj.libelle = champs.libelle;
  if (champs.dateDebut !== undefined) maj.date_debut = champs.dateDebut;
  if (champs.dateFin !== undefined) maj.date_fin = champs.dateFin;
  if (champs.cloturee !== undefined) maj.cloturee = champs.cloturee;

  const reponse = await supabase
    .from('campagne')
    .update(maj)
    .eq('id', Number(id))
    .select(SELECT_CAMPAGNE)
    .single();
  return versResume(verifier(reponse) as unknown as LigneCampagne, 0);
}

/// Traduit le SONDAGE de la fonction en `ErreurApi(409)`.
///
/// L'ecran attendait deja cette forme du temps de l'API HTTP, et il n'y avait
/// aucune raison de le reecrire : ce qui change, c'est d'ou vient l'information,
/// pas ce que l'utilisateur doit decider.
function leverSiImpacts<T>(rendu: Record<string, unknown>, conserves: string[], champ: string): void {
  if (rendu.applique === false && rendu.code === 'RDV_IMPACTES') {
    const conflit = {
      code: 'RDV_IMPACTES',
      message: String(rendu.message ?? ''),
      retires: (rendu.retires as string[]) ?? [],
      ajoutes: (rendu.ajoutes as string[]) ?? [],
      impacts: (rendu.impacts as T[]) ?? [],
      [champ]: conserves,
    } as unknown as ConflitRdv<T>;
    throw new ErreurApi(conflit.message, 409, conflit);
  }
}

export async function enregistrerJours(
  id: string,
  jours: string[],
  confirmation?: Confirmation
): Promise<{ jours: JourCampagne[]; rdvDeplaces: number }> {
  // `annuler` ne touche a rien : on n'appelle meme pas la base. L'ecran a deja vu
  // l'impact, l'utilisateur a choisi de renoncer.
  if (confirmation?.mode === 'annuler') {
    const detail = await chargerCampagne(id);
    return { jours: detail.jours, rdvDeplaces: 0 };
  }

  const reponse = await supabase.rpc('campagne_definir_jours', {
    p_campagne_id: Number(id),
    p_jours: jours,
    p_mode: confirmation?.mode ?? null,
    p_vers: confirmation?.mode === 'deplacer' ? confirmation.vers : null,
  });

  const rendu = verifier(reponse) as unknown as Record<string, unknown>;
  leverSiImpacts<ImpactJour>(rendu, jours, 'joursConserves');

  return {
    jours: ((rendu.jours as { jour: string; ordre: number }[]) ?? []).map((j) => ({
      jour: j.jour,
      ordre: j.ordre,
    })),
    rdvDeplaces: Number(rendu.rdvDeplaces ?? 0),
  };
}

export async function enregistrerCreneaux(
  id: string,
  creneaux: { code: string; libelle: string }[],
  confirmation?: Confirmation
): Promise<{ creneaux: CreneauCampagne[]; rdvDeplaces: number }> {
  if (confirmation?.mode === 'annuler') {
    const detail = await chargerCampagne(id);
    return { creneaux: detail.creneaux, rdvDeplaces: 0 };
  }

  const reponse = await supabase.rpc('campagne_definir_creneaux', {
    p_campagne_id: Number(id),
    p_codes: creneaux.map((c) => c.code),
    p_libelles: creneaux.map((c) => c.libelle),
    p_mode: confirmation?.mode ?? null,
    p_vers: confirmation?.mode === 'deplacer' ? confirmation.vers : null,
  });

  const rendu = verifier(reponse) as unknown as Record<string, unknown>;
  leverSiImpacts<ImpactCreneau>(
    rendu,
    creneaux.map((c) => c.code),
    'creneauxConserves'
  );

  return {
    creneaux: ((rendu.creneaux as CreneauCampagne[]) ?? []).map((c) => ({
      code: c.code,
      libelle: c.libelle,
      ordre: c.ordre,
    })),
    rdvDeplaces: Number(rendu.rdvDeplaces ?? 0),
  };
}

/// Le MODE appartient a la SESSION, pas a la plaque : CENTRE et SUD utilisaient
/// des tables en juin 2026, NORD et SUD-OUEST non — et rien ne dit que septembre
/// sera identique. Le choix de juin ne doit pas contaminer celui de septembre.
export async function modifierSession(
  _campagneId: string,
  sessionId: string,
  champs: { mode?: string; effectifCibleTable?: number | null }
): Promise<SessionCampagne> {
  const maj: Record<string, unknown> = {};
  if (champs.mode !== undefined) maj.mode = champs.mode;
  if (champs.effectifCibleTable !== undefined) maj.effectif_cible_table = champs.effectifCibleTable;

  const reponse = await supabase
    .from('session_plaque')
    .update(maj)
    .eq('id', Number(sessionId))
    .select('id, mode, effectif_cible_table, plaque(id, libelle)')
    .single();

  const s = verifier(reponse) as unknown as {
    id: number;
    mode: string;
    effectif_cible_table: number | null;
    plaque: { id: number; libelle: string } | null;
  };
  return {
    id: txt(s.id),
    plaqueId: txt(s.plaque?.id),
    plaqueLibelle: s.plaque?.libelle ?? '',
    mode: s.mode,
    effectifCibleTable: s.effectif_cible_table,
  };
}
