// ============================================================================
// LES ICONES DE GRID — des SVG, jamais des glyphes de police (CLAUDE.md : un
// « ✓ » ou un « ⌄ » ecrit en texte tombe sur une police de repli, et son dessin
// varie d'une machine a l'autre). Trait arrondi, `currentColor` : c'est le bout
// de trait arrondi qui rapproche le dessin d'iOS, plus que la forme.
// ============================================================================

const TRACES = {
  saisie: <><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4z" /><path d="M13.5 6.5l4 4" /></>,
  suivi: <><path d="M9 11l3 3 8-8" /><path d="M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9" /></>,
  tableau: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  effectifs: <><circle cx="9" cy="8" r="3.2" /><path d="M3 20a6 6 0 0 1 12 0" /><path d="M16 4.5a3 3 0 0 1 0 6M21 20a5 5 0 0 0-4-4.9" /></>,
  vendeurs: <><rect x="3" y="5" width="18" height="14" rx="3" /><circle cx="9" cy="11" r="2.2" /><path d="M6 16a3 3 0 0 1 6 0M14 10h4M14 13.5h3" /></>,
  campagnes: <><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
  reglages: <><circle cx="12" cy="12" r="3" /><path d="M12 2.5v2.2M12 19.3v2.2M4.2 4.2l1.6 1.6M18.2 18.2l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.2 19.8l1.6-1.6M18.2 5.8l1.6-1.6" /></>,
  recherche: <><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></>,
  soleil: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
  lune: <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />,
  sortie: <><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" /><path d="M10 16l-4-4 4-4M6 12h10" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  grille: <><rect x="4" y="4" width="6.5" height="6.5" rx="1.6" /><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.6" /><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.6" /><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.6" /></>,
  fermer: <path d="M6 6l12 12M18 6L6 18" />,
  coche: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  retour: <path d="M15 5l-7 7 7 7" />,
} as const;

export type NomIcone = keyof typeof TRACES;

export function Icone({ nom, petite = false }: { nom: NomIcone; petite?: boolean }) {
  return (
    <svg className={petite ? 'i sm' : 'i'} viewBox="0 0 24 24" aria-hidden="true">
      {TRACES[nom]}
    </svg>
  );
}
