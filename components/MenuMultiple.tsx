import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

// ============================================================================
// MENU DEROULANT A CHOIX MULTIPLE — ecrit le 08/09/2026.
//
// POURQUOI IL REMPLACE DES PUCES. La premiere version des filtres du tableau de
// bord posait une puce par valeur : quatre plaques, mais VINGT sites. Deux
// rangees qui prenaient toute la largeur et repoussaient les graphiques sous la
// ligne de flottaison, pour un reglage qu'on touche une fois par consultation.
// Le cout d'affichage d'un filtre doit etre proportionnel a la frequence a
// laquelle on s'en sert, pas au nombre de valeurs qu'il porte.
//
// UN SEUL EXEMPLAIRE. Les plaques et les sites emploient ce composant ; il n'y a
// pas deux menus. C'est la meme discipline que `useIndicateurGlissant` pour la
// pastille glissante et le curseur de liste.
//
// ---------------------------------------------------------------------------
// CE QUE « VIDE » VEUT DIRE
// ---------------------------------------------------------------------------
// Aucune valeur retenue = TOUT est affiche. C'est le seul etat qui signifie
// « tout » : un filtre qui contiendrait toutes les valeurs se lirait pareil a
// l'ecran mais cesserait de suivre l'arrivee d'un vingt-et-unieme site.
//
// ---------------------------------------------------------------------------
// LE PANNEAU EST DANS UN PORTAIL, ET C'EST UNE CORRECTION MESUREE
// ---------------------------------------------------------------------------
// Premiere version : `position: absolute` dans l'enveloppe. Le panneau
// n'apparaissait pas — mesure au navigateur : il etait bien dans le DOM,
// `visibility: visible`, 208 x 284 px, et DECOUPE par un ancetre.
//
// `.carte` porte `overflow-x: auto`. Or CSS interdit qu'un axe defile pendant
// que l'autre reste `visible` : la valeur UTILISEE de `overflow-y` devient
// `auto` elle aussi. Une carte decoupe donc verticalement sans qu'aucune ligne
// de CSS ne le dise.
//
// Le mode d'echec est SILENCIEUX : pas d'erreur, pas d'avertissement, un menu
// qui ne s'ouvre pas. Et il depend de l'endroit ou l'on pose le composant —
// dans le tableau de bord il fonctionne PAR CHANCE, les filtres etant hors
// carte.
//
// Le panneau part donc dans `document.body` par un portail, en
// `position: fixed`, place depuis le rectangle du bouton. Un portail est immune
// non seulement a `overflow` mais aussi a un ancetre `transform` — qui
// redefinirait le bloc conteneur d'un `fixed` et redecouperait tout. Le projet
// en porte plusieurs.
//
// LES COORDONNEES SONT POSEES DIRECTEMENT SUR L'ELEMENT, sans passer par un
// etat React : c'est la meme raison que dans `useIndicateurGlissant` — replacer
// a chaque evenement de defilement provoquerait un rendu par image.
//
// ---------------------------------------------------------------------------
// ACCESSIBILITE — ce n'est pas un `<select multiple>`
// ---------------------------------------------------------------------------
// `<select multiple>` exige un Ctrl+clic pour ajouter une valeur, ce que
// personne ne devine, et n'accepte pas de compteur par ligne. On construit donc
// une `listbox` : `aria-multiselectable`, une option par valeur avec son
// `aria-selected`, les fleches pour parcourir, Espace ou Entree pour basculer,
// Echap pour fermer EN RENDANT LE FOCUS au bouton — sans quoi le clavier se
// retrouve au debut du document.
// ============================================================================

/// LES DEUX ICONES SONT DES SVG, PAS DES CARACTERES.
///
/// La premiere version ecrivait « ⌄ » et « ✓ » en texte. Un glyphe n'est pas une
/// icone : son dessin, son epaisseur de trait et sa position sur la ligne de base
/// dependent de la police qui le rend, et Albert Sans ne dessine pas « ⌄ » comme
/// une police systeme de repli. Resultat a l'ecran, releve par l'utilisateur :
/// une petite fleche fine, mal centree, etrangere au reste de l'interface.
///
/// `stroke-linecap` et `stroke-linejoin` arrondis : c'est ce qui rapproche le
/// trait de celui d'iOS, plus que la forme elle-meme. `currentColor` pour que
/// l'icone suive la couleur du texte sans etre repeinte a la main.
function Chevron() {
  return (
    <svg
      className="chevron"
      viewBox="0 0 12 12"
      width="12"
      height="12"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M2.5 4.5 6 8l3.5-3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Coche() {
  return (
    <svg
      viewBox="0 0 12 12"
      width="12"
      height="12"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M2 6.4 4.6 9l5.4-6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export interface OptionMenu {
  id: string;
  libelle: string;
  /// Affiche a droite de l'option. Un compteur, en general.
  detail?: string;
}

export function MenuMultiple({
  etiquette,
  options,
  retenus,
  onChange,
  libelleVide,
  className,
}: {
  etiquette: string;
  options: OptionMenu[];
  retenus: string[];
  onChange: (suivants: string[]) => void;
  /// Ce qu'affiche le bouton quand rien n'est retenu — donc quand tout est
  /// affiche. « Toutes les plaques », pas « Aucune » : le second se lirait comme
  /// un ecran vide.
  libelleVide: string;
  className?: string;
}) {
  const [ouvert, setOuvert] = useState(false);
  const [survol, setSurvol] = useState(0);
  const enveloppe = useRef<HTMLDivElement>(null);
  const bouton = useRef<HTMLButtonElement>(null);
  const panneau = useRef<HTMLDivElement>(null);
  const idListe = useId();

  /// PLACEMENT DU PANNEAU FLOTTANT. `useLayoutEffect` et non `useEffect` : la
  /// pose doit precede le premier peint, sinon le panneau apparait une image en
  /// haut a gauche avant de sauter a sa place.
  useLayoutEffect(() => {
    if (!ouvert) return;
    const placer = () => {
      const b = bouton.current;
      const p = panneau.current;
      if (!b || !p) return;
      const r = b.getBoundingClientRect();
      const marge = 6;
      const l = p.offsetWidth;

      // ON CHOISIT LE COTE LE PLUS SPACIEUX, PUIS ON RETREINT LA HAUTEUR.
      //
      // La premiere version basculait vers le haut quand ca ne tenait pas en bas,
      // et plaquait le panneau contre le bord quand ca ne tenait ni en haut ni en
      // bas — il recouvrait alors la barre de navigation. Vu dans un volet de
      // 535 px de haut.
      //
      // Un menu n'a pas a tenir entier : sa liste DEFILE deja. On lui donne donc
      // la place disponible et il s'y adapte, ce qui vaut aussi pour un portable
      // en paysage.
      const espaceDessous = window.innerHeight - r.bottom - marge * 2;
      const espaceDessus = r.top - marge * 2;
      const enBas = espaceDessous >= espaceDessus;
      const dispo = Math.max(120, enBas ? espaceDessous : espaceDessus);
      p.style.maxHeight = `${Math.round(dispo)}px`;

      // Mesure APRES avoir pose la contrainte : sans quoi on placerait le panneau
      // d'apres une hauteur qu'il n'a plus.
      const h = p.offsetHeight;
      const p_haut = enBas ? r.bottom + marge : Math.max(marge, r.top - marge - h);
      // Et il ne sort pas par la droite : sur l'axe « Sites » le menu est le
      // second de la rangee, donc le plus proche du bord.
      const p_gauche = Math.max(marge, Math.min(r.left, window.innerWidth - l - marge));
      p.style.top = `${Math.round(p_haut)}px`;
      p.style.left = `${Math.round(p_gauche)}px`;
      p.style.minWidth = `${Math.round(r.width)}px`;
    };
    placer();
    // LE FOCUS VA SUR LA LISTE, sans quoi les fleches n'auraient rien a piloter :
    // les options ne sont pas des boutons, c'est la `listbox` qui recoit les
    // touches. Echap le rend au declencheur.
    panneau.current?.querySelector<HTMLElement>('.liste-menu')?.focus();
    // `true` pour la phase de CAPTURE : le defilement peut venir d'un conteneur
    // interne, et un ecouteur sur `window` en phase de bouillonnement ne le
    // verrait pas.
    window.addEventListener('scroll', placer, true);
    window.addEventListener('resize', placer);
    return () => {
      window.removeEventListener('scroll', placer, true);
      window.removeEventListener('resize', placer);
    };
  }, [ouvert]);

  // Fermeture au clic DEHORS et a Echap. Les deux sont poses sur le document et
  // non sur l'enveloppe : un clic dans un autre menu doit fermer celui-ci, et il
  // ne remonte jamais jusqu'ici.
  useEffect(() => {
    if (!ouvert) return;
    const auClic = (e: MouseEvent) => {
      const cible = e.target as Node;
      // LE PANNEAU N'EST PLUS UN DESCENDANT DE L'ENVELOPPE — il vit dans un
      // portail. Sans ce second test, cliquer une option fermerait le menu
      // avant meme de la basculer.
      if (enveloppe.current?.contains(cible) || panneau.current?.contains(cible)) return;
      setOuvert(false);
    };
    const auClavier = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOuvert(false);
        bouton.current?.focus();
      }
    };
    document.addEventListener('mousedown', auClic);
    document.addEventListener('keydown', auClavier);
    return () => {
      document.removeEventListener('mousedown', auClic);
      document.removeEventListener('keydown', auClavier);
    };
  }, [ouvert]);

  const basculer = (id: string) =>
    onChange(retenus.includes(id) ? retenus.filter((x) => x !== id) : [...retenus, id]);

  /// L'INTITULE DU BOUTON DIT L'ETAT SANS QU'ON L'OUVRE. Un seul retenu : son
  /// nom, c'est l'information utile. Plusieurs : le compte, parce que trois noms
  /// concatenes debordent et se font tronquer au milieu d'un mot.
  const resume =
    retenus.length === 0
      ? libelleVide
      : retenus.length === 1
        ? (options.find((o) => o.id === retenus[0])?.libelle ?? '1 retenu')
        : `${retenus.length} sur ${options.length}`;

  const auClavierListe = (e: React.KeyboardEvent) => {
    if (options.length === 0) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const pas = e.key === 'ArrowDown' ? 1 : -1;
      setSurvol((i) => (i + pas + options.length) % options.length);
    } else if (e.key === 'Home') {
      e.preventDefault();
      setSurvol(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setSurvol(options.length - 1);
    } else if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      const o = options[survol];
      if (o) basculer(o.id);
    }
  };

  return (
    <div className={`menu-multiple${className ? ` ${className}` : ''}`} ref={enveloppe}>
      <button
        type="button"
        ref={bouton}
        className={`declencheur-menu${retenus.length > 0 ? ' filtre' : ''}`}
        aria-expanded={ouvert}
        aria-haspopup="listbox"
        aria-controls={ouvert ? idListe : undefined}
        onClick={() => {
          setOuvert((o) => !o);
          setSurvol(0);
        }}
      >
        <span className="etiquette-menu">{etiquette}</span>
        <span className="resume-menu">{resume}</span>
        <Chevron />
      </button>

      {ouvert &&
        createPortal(
          <div className="panneau-menu glass-menu" ref={panneau}>
          {/* `tabIndex={-1}` et le focus clavier sur la liste elle-meme : les
              options ne sont pas des boutons, c'est la `listbox` qui recoit les
              fleches. */}
          <div
            id={idListe}
            className="liste-menu"
            role="listbox"
            aria-multiselectable="true"
            aria-label={etiquette}
            tabIndex={-1}
            onKeyDown={auClavierListe}
          >
            {options.length === 0 && <p className="note vide-menu">Aucune valeur.</p>}
            {options.map((o, i) => {
              const coche = retenus.includes(o.id);
              return (
                <div
                  key={o.id}
                  role="option"
                  aria-selected={coche}
                  className={`option-menu${coche ? ' cochee' : ''}${i === survol ? ' survolee' : ''}`}
                  onClick={() => basculer(o.id)}
                  onMouseEnter={() => setSurvol(i)}
                >
                  <span className="coche" aria-hidden="true">
                    {coche && <Coche />}
                  </span>
                  <span className="libelle-option">{o.libelle}</span>
                  {o.detail !== undefined && <span className="detail-option">{o.detail}</span>}
                </div>
              );
            })}
          </div>

            {retenus.length > 0 && (
              <button type="button" className="lien effacer-menu" onClick={() => onChange([])}>
                Tout afficher
              </button>
            )}
          </div>,
          document.body
        )}
    </div>
  );
}
