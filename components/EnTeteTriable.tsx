// ============================================================================
// EN-TETE DE COLONNE TRIABLE — un seul, pour tous les tableaux du produit.
//
// Il vivait dans `pages/Vendeurs.tsx`. Le tableau de bord en avait besoin a son
// tour, et le recopier aurait donne deux fleches, deux comportements de bascule
// et deux etats « non trie » a maintenir — l'esprit de l'interdit n.6 vaut aussi
// pour l'interface. Il est donc sorti la, sans changer d'un caractere ce que
// l'ecran Vendeurs affichait deja.
//
// LA REGLE DE BASCULE EST ICI ET NULLE PART AILLEURS : `basculer` la porte, et
// les deux ecrans l'appellent. Cliquer une NOUVELLE colonne trie dans l'ordre
// NATUREL de cette colonne — croissant pour un libelle, decroissant pour un
// nombre, parce que d'un classement on veut voir la tete et non la queue.
// Recliquer la meme colonne inverse.
// ============================================================================

export interface Tri {
  colonne: string;
  croissant: boolean;
}

/// Le sens naturel d'une colonne au PREMIER clic. `texte` -> croissant (A→Z),
/// `nombre` -> decroissant (le plus grand d'abord).
export type SensNaturel = 'texte' | 'nombre';

/// La bascule, source unique. `naturel` est celui de la colonne visee.
export function basculer(tri: Tri, colonne: string, naturel: SensNaturel): Tri {
  if (tri.colonne === colonne) return { colonne, croissant: !tri.croissant };
  return { colonne, croissant: naturel === 'texte' };
}

/// Compare deux valeurs deja extraites, en appliquant le sens du tri.
///
/// LE DEPARTAGE N'EST PAS ICI, ET C'EST VOULU : un tri d'affichage doit rester
/// TOTAL, donc l'appelant fournit un second critere. Sans lui, deux lignes de
/// meme valeur peuvent permuter d'un rendu a l'autre — c'est la meme faute que
/// paginer sans ordre stable, a l'echelle d'un tableau.
export function comparerSelon(
  a: number | string,
  b: number | string,
  croissant: boolean
): number {
  const brut = typeof a === 'number' && typeof b === 'number' ? a - b : String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0;
  return croissant ? brut : -brut;
}

export function EnTeteTriable({
  colonne,
  libelle,
  tri,
  onTrier,
  classe,
  naturel = 'texte',
}: {
  colonne: string;
  libelle: string;
  tri: Tri;
  onTrier: (colonne: string, naturel: SensNaturel) => void;
  classe?: string;
  naturel?: SensNaturel;
}) {
  const actif = tri.colonne === colonne;
  return (
    <th
      className={`${classe ?? ''} triable ${actif ? 'trie' : ''}`}
      aria-sort={actif ? (tri.croissant ? 'ascending' : 'descending') : 'none'}
    >
      <button
        type="button"
        onClick={() => onTrier(colonne, naturel)}
        title={`Trier par ${libelle}`}
      >
        {libelle}
        <span className="fleche" aria-hidden="true">
          {actif ? (tri.croissant ? '▲' : '▼') : '↕'}
        </span>
      </button>
    </th>
  );
}
