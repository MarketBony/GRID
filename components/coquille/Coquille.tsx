import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal, flushSync } from 'react-dom';
import { Icone, type NomIcone } from '../ui/Icone';
import { useIndicateurGlissant } from '../../hooks/useIndicateurGlissant';
import { useReflet } from '../../hooks/useReflet';
import { useTheme } from '../../contexts/ThemeContext';
import { cleTri } from '../../backend/src/utils/tri';

// ============================================================================
// LA COQUILLE DE GRID v2 — navigation retenue le 03/10/2026 (D18) :
//   - au BUREAU, l'Ile : une barre de verre flottante, centree en haut, dont la
//     goutte glisse d'une rubrique a l'autre et qui se retracte au defilement ;
//   - au TELEPHONE, la barre flottante du bas.
//
// LA GOUTTE est le seul element mobile de chaque barre (`useIndicateurGlissant`,
// le meme mecanisme que la pastille du segmente et le curseur de la saisie —
// CLAUDE.md interdit d'en ecrire un troisieme). Elle suit l'item actif PENDANT
// la retraction : le hook observe ses cibles par `ResizeObserver`. C'etait le
// defaut principal de la maquette, ou elle se recalait 380 ms trop tard.
//
// LA NAVIGATION N'EST QU'UN CONFORT (interdit n.5) : la liste des rubriques est
// filtree par palier pour l'affichage, chaque lecture et chaque ecriture restent
// revalidees par la RLS.
// ============================================================================

export interface Rubrique {
  id: string;
  libelle: string;
  /// Libelle court de la barre du bas, ou la place manque.
  court?: string;
  icone: NomIcone;
  /// Absente de la barre du bas : accessible par « Plus ».
  secondaire?: boolean;
}

export interface EntreeRecherche {
  libelle: string;
  genre: string;
  action: () => void;
}

interface Props {
  rubriques: Rubrique[];
  active: string;
  aller: (id: string) => void;
  /// Ce que la recherche sait trouver en plus des rubriques (vendeurs…).
  recherche?: EntreeRecherche[];
  nomCompte: string;
  palier: string;
  deconnexion: () => void;
  children: ReactNode;
}

/// Changer de rubrique AVEC transition : l'ancienne se dissout, la nouvelle
/// monte (styles/v2.css, `contenu-v2`). `flushSync` rend le changement d'etat
/// synchrone : c'est lui que la View Transitions API photographie.
export function avecTransition(f: () => void) {
  const doc = document as Document & { startViewTransition?: (f: () => void) => unknown };
  const reduit =
    window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
    document.documentElement.classList.contains('animations-reduites');
  if (!doc.startViewTransition || reduit) {
    f();
    return;
  }
  doc.startViewTransition(() => flushSync(f));
}

export function Coquille({ rubriques, active, aller, recherche = [], nomCompte, palier, deconnexion, children }: Props) {
  const { theme, basculer } = useTheme();
  const reflet = useReflet();
  const [retractee, setRetractee] = useState(false);
  const [paletteOuverte, setPaletteOuverte] = useState(false);
  const [plusOuvert, setPlusOuvert] = useState(false);
  /// Une nouvelle version de GRID est prete (service worker, `index.tsx`). On
  /// l'ANNONCE ; c'est l'utilisateur qui recharge, jamais au milieu d'une saisie.
  const [nouvelleVersion, setNouvelleVersion] = useState<ServiceWorker | null>(null);
  useEffect(() => {
    const surVersion = (e: Event) => setNouvelleVersion((e as CustomEvent<ServiceWorker>).detail);
    window.addEventListener('grid:nouvelle-version', surVersion);
    return () => window.removeEventListener('grid:nouvelle-version', surVersion);
  }, []);
  const recharger = () => {
    navigator.serviceWorker?.addEventListener('controllerchange', () => window.location.reload(), { once: true });
    nouvelleVersion?.postMessage('activer');
  };
  const ile = useRef<HTMLElement | null>(null);

  const principales = rubriques.filter((r) => !r.secondaire);
  const indexIle = Math.max(0, rubriques.findIndex((r) => r.id === active));
  const indexBas = principales.findIndex((r) => r.id === active);
  const goutteIle = useIndicateurGlissant(indexIle, rubriques.length);
  const goutteBas = useIndicateurGlissant(Math.max(0, indexBas), principales.length);

  // LA HAUTEUR DE L'ILE EST MESUREE, PAS DEVINEE (CLAUDE.md, « aucune constante ne
  // devine la hauteur d'un element variable »). Les ecrans pas encore portes
  // s'alignent sur `--h-entete` ; l'Ile la pose, et la retire au telephone ou elle
  // n'occupe pas le haut.
  useEffect(() => {
    const el = ile.current;
    if (!el) return;
    const poser = () => {
      const r = el.getBoundingClientRect();
      const visible = r.height > 0;
      document.documentElement.style.setProperty('--h-entete', visible ? `${Math.round(r.bottom + 12)}px` : '0px');
    };
    poser();
    const o = new ResizeObserver(poser);
    o.observe(el);
    window.addEventListener('resize', poser);
    return () => {
      o.disconnect();
      window.removeEventListener('resize', poser);
    };
  }, []);

  // Retraction au defilement : on descend, la barre se fait discrete ; on
  // remonte, elle revient. Un seuil evite qu'elle clignote au moindre pixel.
  useEffect(() => {
    let dernier = window.scrollY;
    const surDefilement = () => {
      const y = window.scrollY;
      if (Math.abs(y - dernier) < 6) return;
      setRetractee(y > dernier && y > 60);
      dernier = y;
    };
    window.addEventListener('scroll', surDefilement, { passive: true });
    return () => window.removeEventListener('scroll', surDefilement);
  }, []);

  // `Ctrl K` reste disponible (D22), sans etre affiche : la loupe suffit a l'oeil.
  useEffect(() => {
    const surTouche = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOuverte(true);
      }
    };
    window.addEventListener('keydown', surTouche);
    return () => window.removeEventListener('keydown', surTouche);
  }, []);

  const changer = (id: string) => {
    setPlusOuvert(false);
    if (id !== active) avecTransition(() => aller(id));
  };

  const entrees = useMemo<EntreeRecherche[]>(
    () => [
      ...rubriques.map((r) => ({ libelle: r.libelle, genre: 'Rubrique', action: () => changer(r.id) })),
      ...recherche,
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rubriques, recherche, active]
  );

  const themeBouton = (e: React.MouseEvent) => basculer({ x: e.clientX, y: e.clientY });

  return (
    <div className="v2">
      <div className="fond-vivant" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>

      <nav
        ref={(el) => {
          ile.current = el;
          goutteIle.conteneur(el);
        }}
        className={`ile verre${retractee ? ' retractee' : ''}`}
        aria-label="Navigation"
        onPointerMove={reflet}
      >
        <img className="logo" src="/grid.svg" alt="GRID" />
        <span className="goutte" ref={goutteIle.indicateur} aria-hidden="true" />
        {rubriques.map((r, i) => (
          <button
            key={r.id}
            ref={goutteIle.cible(i)}
            type="button"
            className="item"
            aria-current={r.id === active ? 'page' : undefined}
            onClick={() => changer(r.id)}
            title={r.libelle}
          >
            <Icone nom={r.icone} />
            <span className="lib">{r.libelle}</span>
          </button>
        ))}
        <span className="sep" aria-hidden="true" />
        <button type="button" className="icon-btn" onClick={() => setPaletteOuverte(true)} title="Rechercher (Ctrl K)" aria-label="Rechercher">
          <Icone nom="recherche" />
        </button>
        <button
          type="button"
          className="icon-btn"
          onClick={themeBouton}
          title={theme === 'sombre' ? 'Passer en clair' : 'Passer en sombre'}
          aria-label={theme === 'sombre' ? 'Passer en clair' : 'Passer en sombre'}
        >
          <Icone nom={theme === 'sombre' ? 'soleil' : 'lune'} />
        </button>
        <button type="button" className="icon-btn" onClick={deconnexion} title={`${nomCompte} · ${palier} — se déconnecter`} aria-label="Se déconnecter">
          <Icone nom="sortie" />
        </button>
      </nav>

      <nav className={`barre-bas verre${retractee ? ' retractee' : ''}`} ref={goutteBas.conteneur} aria-label="Navigation">
        <span className="goutte" ref={goutteBas.indicateur} aria-hidden="true" style={{ opacity: indexBas < 0 ? 0 : 1 }} />
        {principales.map((r, i) => (
          <button
            key={r.id}
            ref={goutteBas.cible(i)}
            type="button"
            className="item"
            aria-current={r.id === active ? 'page' : undefined}
            onClick={() => changer(r.id)}
          >
            <Icone nom={r.icone} />
            <span className="lib">{r.court ?? r.libelle}</span>
          </button>
        ))}
        <button type="button" className="item" onClick={() => setPlusOuvert(true)} aria-haspopup="dialog">
          <Icone nom="grille" />
          <span className="lib">Plus</span>
        </button>
      </nav>

      <main className="contenu-v2" style={{ viewTransitionName: 'contenu-v2' } as React.CSSProperties}>
        {children}
      </main>

      {nouvelleVersion && (
        <div className="nouvelle-version verre fort" role="status">
          Une nouvelle version de GRID est prête.
          <button type="button" className="btn primary sm" onClick={recharger}>
            Recharger
          </button>
          <button type="button" className="icon-btn" onClick={() => setNouvelleVersion(null)} aria-label="Plus tard">
            <Icone nom="fermer" petite />
          </button>
        </div>
      )}

      {paletteOuverte && <Palette entrees={entrees} fermer={() => setPaletteOuverte(false)} />}

      {plusOuvert &&
        createPortal(
          <div className="v2">
            <div className="v2-voile" onClick={() => setPlusOuvert(false)} />
            <div className="v2-volet verre fort" role="dialog" aria-label="Toutes les rubriques">
              <h3>GRID</h3>
              <p className="faint" style={{ margin: '0 0 12px' }}>
                {nomCompte} · {palier}
              </p>
              <div style={{ display: 'grid', gap: 6 }}>
                {rubriques.map((r) => (
                  <button key={r.id} type="button" className="btn" style={{ justifyContent: 'flex-start', height: 44 }} onClick={() => changer(r.id)}>
                    <Icone nom={r.icone} /> {r.libelle}
                  </button>
                ))}
                <button type="button" className="btn" style={{ justifyContent: 'flex-start', height: 44 }} onClick={() => { setPlusOuvert(false); setPaletteOuverte(true); }}>
                  <Icone nom="recherche" /> Rechercher
                </button>
                <button type="button" className="btn" style={{ justifyContent: 'flex-start', height: 44 }} onClick={themeBouton}>
                  <Icone nom={theme === 'sombre' ? 'soleil' : 'lune'} /> {theme === 'sombre' ? 'Thème clair' : 'Thème sombre'}
                </button>
                <button type="button" className="btn danger" style={{ justifyContent: 'flex-start', height: 44 }} onClick={deconnexion}>
                  <Icone nom="sortie" /> Se déconnecter
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

/// LA RECHERCHE — une loupe dans l'Ile (D22), `Ctrl K` au clavier. Insensible a
/// la casse ET aux accents : la meme cle que le tri (`cleTri`), pour que chercher
/// et classer considerent « AMELIE » et « AMÉLIE » comme un seul nom.
function Palette({ entrees, fermer }: { entrees: EntreeRecherche[]; fermer: () => void }) {
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const resultats = useMemo(() => {
    const cle = cleTri(q.trim());
    return (cle === '' ? entrees : entrees.filter((e) => cleTri(e.libelle).includes(cle))).slice(0, 9);
  }, [q, entrees]);

  const choisir = (e: EntreeRecherche | undefined) => {
    if (!e) return;
    fermer();
    e.action();
  };

  return createPortal(
    <div className="v2">
      <div className="palette-voile" onMouseDown={(e) => e.target === e.currentTarget && fermer()}>
        <div className="palette verre fort" role="dialog" aria-label="Rechercher">
          <div className="champ">
            <Icone nom="recherche" />
            <input
              autoFocus
              value={q}
              placeholder="Aller à un vendeur, une rubrique, une action…"
              onChange={(e) => {
                setQ(e.target.value);
                setSel(0);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Escape') fermer();
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setSel((s) => Math.min(s + 1, resultats.length - 1));
                }
                if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setSel((s) => Math.max(s - 1, 0));
                }
                if (e.key === 'Enter') choisir(resultats[sel]);
              }}
            />
            <span className="kbd">Échap</span>
          </div>
          <div className="res" role="listbox">
            {resultats.length === 0 && <div className="empty">Rien ne correspond.</div>}
            {resultats.map((e, i) => (
              <button
                key={`${e.genre}-${e.libelle}`}
                type="button"
                className="r"
                role="option"
                aria-selected={i === sel}
                onMouseEnter={() => setSel(i)}
                onClick={() => choisir(e)}
              >
                {e.libelle}
                <span className="k">{e.genre}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
