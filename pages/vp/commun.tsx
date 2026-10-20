import type { ReactNode } from 'react';
import type { EtapeAccueil } from '../../backend/src/utils/vp';
import type { DonneesVp, RdvDeVp } from '../../services/vp';

// ============================================================================
// GRID/VP — ce que les ecrans de la vente privee partagent : les formats, les
// couleurs d'etape, et les props communes. Aucun calcul : ils sont dans
// `backend/src/utils/vp.ts`.
// ============================================================================

export interface PropsEcranVp {
  donnees: DonneesVp;
  /// L'heure du poste, rafraichie chaque minute par la coquille.
  maintenant: Date;
  recharger: () => Promise<void>;
  /// Parametrer la VP : `admin` seul (`ROLES_GESTION_VP`).
  gereVp: boolean;
}

const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

export const enDate = (iso: string) => new Date(`${iso}T12:00:00`);
/// JJ/MM
export const jj = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
/// JJ/MM/AAAA (CLAUDE.md : les dates s'affichent ainsi).
export const jjmmaaaa = (iso: string) => `${jj(iso)}/${iso.slice(0, 4)}`;
export const jourLong = (iso: string) => `${JOURS[enDate(iso).getDay()]} ${jjmmaaaa(iso)}`;
export const nomDuJour = (iso: string) => JOURS[enDate(iso).getDay()]!;
export const moisAnnee = (iso: string) => `${MOIS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;
export const isoLocal = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const decaler = (iso: string, n: number) => {
  const d = enDate(iso);
  d.setDate(d.getDate() + n);
  return isoLocal(d);
};
export const heureMinute = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getHours()} h ${String(d.getMinutes()).padStart(2, '0')}`;
};
export const pct = (v: number | null) => (v === null ? '—' : `${Math.round(v * 100)} %`);
export const decimal = (v: number | null, n = 1) => (v === null ? '—' : v.toFixed(n).replace('.', ','));

/// La couleur et le libelle d'une etape de l'accueil, completes par l'issue.
export type StatutAffiche = EtapeAccueil | 'commande' | 'offre' | 'sans_suite';
export const STATUTS: Record<StatutAffiche, { libelle: string; couleur: string }> = {
  attendu: { libelle: 'Attendu', couleur: 'var(--text-3)' },
  arrive: { libelle: 'Arrivé', couleur: 'var(--info)' },
  avec_vendeur: { libelle: 'Avec le vendeur', couleur: 'var(--warn)' },
  sorti: { libelle: 'Sorti', couleur: 'var(--text-2)' },
  no_show: { libelle: 'No show', couleur: 'var(--danger)' },
  annule: { libelle: 'Annulé', couleur: 'var(--danger)' },
  commande: { libelle: 'Commande', couleur: 'var(--ok)' },
  offre: { libelle: 'Offre', couleur: '#b45cff' },
  sans_suite: { libelle: 'Sans suite', couleur: 'var(--text-3)' },
};

export function statutAffiche(r: RdvDeVp, etape: EtapeAccueil): StatutAffiche {
  if (etape === 'sorti') {
    if (r.issue === 'commande') return 'commande';
    if (r.issue === 'offre_en_cours') return 'offre';
    if (r.issue === 'clos_sans_suite') return 'sans_suite';
  }
  return etape;
}

export function Badge({ statut }: { statut: StatutAffiche }) {
  const s = STATUTS[statut];
  return (
    <span className="badge" style={{ '--c': s.couleur } as React.CSSProperties}>
      {s.libelle}
    </span>
  );
}

export function EtiquetteMarque({ libelle }: { libelle: string | null }) {
  if (!libelle) return null;
  const cle = libelle.toLowerCase();
  return <span className={`marque ${cle}`}>{libelle.toUpperCase()}</span>;
}

export function Kpi({ l, v, d, accent }: { l: string; v: ReactNode; d?: ReactNode; accent?: boolean }) {
  return (
    <div className={`kpi${accent ? ' accent' : ''}`}>
      <span className="l">{l}</span>
      <span className="v num">{v}</span>
      {d !== undefined && <span className="d">{d}</span>}
    </div>
  );
}

/// L'heure d'un creneau `HH:MM-HH:MM`, affichee « 9 h ».
export const heureCreneau = (code: string) => {
  const m = /^(\d{1,2}):(\d{2})/.exec(code);
  return m ? `${Number(m[1])} h${m[2] === '00' ? '' : ` ${m[2]}`}` : code;
};
