import { useRef } from 'react';
import { useIndicateurGlissant } from '../hooks/useIndicateurGlissant';

// ============================================================================
// CONTROLE SEGMENTE — la pastille qui glisse.
//
// C'est LE mouvement signature d'iOS, et c'est celui qui fait que l'interface
// « se sent » Apple plus que n'importe quel effet de verre : une pastille de
// verre qui glisse d'un segment a l'autre avec un depassement, en s'etirant
// legerement dans le sens du deplacement.
//
// ---------------------------------------------------------------------------
// AUCUN JAVASCRIPT PAR IMAGE
// ---------------------------------------------------------------------------
// La pastille n'est pas animee en JS. Le composant ne fait que POSER deux
// nombres — position et largeur du segment actif — et c'est le compositeur qui
// interpole, avec une courbe de ressort ecrite en `linear()`.
//
// C'est la difference de fond avec `rdev/liquid-glass-react`, qui recalcule sa
// carte de deplacement a chaque `mousemove` : ici le cout par image est nul.
// Sur l'ecran de saisie, qui reste affiche des heures et souvent projete, c'est
// la seule architecture acceptable — `CLAUDE.md` : « en cas d'arbitrage, la
// saisie gagne toujours ».
//
// ---------------------------------------------------------------------------
// L'ETIREMENT EST DIRECTIONNEL, ET IL EST BREF
// ---------------------------------------------------------------------------
// iOS etire la pastille dans le sens du trajet, d'autant plus que le trajet est
// long. On pose donc `--etirement` juste avant le deplacement et on le retire a
// l'image suivante : la pastille part etiree et se retasse en arrivant. Sans le
// retrait, elle resterait deformee.
//
// ---------------------------------------------------------------------------
// CLAVIER
// ---------------------------------------------------------------------------
// Un `tablist` se parcourt aux fleches, pas au Tab — c'est la convention ARIA,
// et c'est aussi ce que fait iOS. Le Tab sort du groupe.
// ============================================================================

export interface OptionSegment<T extends string> {
  valeur: T;
  libelle: string;
  /// Affiche en petit sous le libelle. Utile pour un compteur.
  detail?: string;
}

export function Segmente<T extends string>({
  options,
  valeur,
  onChange,
  etiquette,
  className,
}: {
  options: OptionSegment<T>[];
  valeur: T;
  onChange: (v: T) => void;
  /// Nomme le groupe pour les lecteurs d'ecran. Un `tablist` sans nom ne dit
  /// pas ce qu'il commande.
  etiquette: string;
  className?: string;
}) {
  const boutons = useRef<(HTMLButtonElement | null)[]>([]);

  const indexActif = Math.max(
    0,
    options.findIndex((o) => o.valeur === valeur)
  );

  // LA MECANIQUE EST DANS `useIndicateurGlissant`, partagee avec le curseur de
  // la liste des vendeurs. Ce composant ne decide que de la FORME — une barre
  // horizontale, une pastille en degrade — pas du mouvement.
  const indicateur = useIndicateurGlissant(indexActif, options.length);

  const surTouche = (e: React.KeyboardEvent) => {
    const suivant =
      e.key === 'ArrowRight' || e.key === 'ArrowDown'
        ? indexActif + 1
        : e.key === 'ArrowLeft' || e.key === 'ArrowUp'
          ? indexActif - 1
          : e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? options.length - 1
              : null;
    if (suivant === null) return;
    e.preventDefault();
    const i = Math.max(0, Math.min(options.length - 1, suivant));
    const o = options[i];
    if (o) {
      onChange(o.valeur);
      boutons.current[i]?.focus();
    }
  };

  return (
    <div
      ref={indicateur.conteneur}
      className={`segments${className ? ` ${className}` : ''}`}
      role="tablist"
      aria-label={etiquette}
      onKeyDown={surTouche}
    >
      <span className="pilule" aria-hidden="true" ref={indicateur.indicateur} />
      {options.map((o, i) => (
        <button
          key={o.valeur}
          ref={(el) => {
            boutons.current[i] = el;
            indicateur.cible(i)(el);
          }}
          type="button"
          role="tab"
          aria-selected={o.valeur === valeur}
          // Un seul segment est atteignable au Tab : les autres se prennent aux
          // fleches. C'est la convention `tablist`.
          tabIndex={o.valeur === valeur ? 0 : -1}
          className={o.valeur === valeur ? 'segment actif' : 'segment'}
          onClick={() => onChange(o.valeur)}
        >
          {o.libelle}
          {o.detail && <span className="detail">{o.detail}</span>}
        </button>
      ))}
    </div>
  );
}
