// ============================================================================
// GRAPHIQUES — SVG ECRIT A LA MAIN, AUCUNE DEPENDANCE.
//
// Pourquoi pas une bibliothèque : deux besoins seulement, tous deux des barres,
// et la charte est très précise (dégradé orange → violet, Syncopate pour les
// chiffres). Une bibliothèque de graphiques pèse plus lourd que ces deux
// composants et se combat pour lui faire respecter des tokens CSS.
//
// TROIS REGLES QUE CES COMPOSANTS TIENNENT :
//
//   1. AUCUNE DIVISION PAR ZERO. Un dashboard s'ouvre sur une campagne à zéro
//      RDV — c'est même le cas normal la veille d'une session. Toutes les échelles
//      retombent sur 1 quand le maximum est nul.
//   2. LE CHIFFRE EST TOUJOURS ECRIT. Une barre sans son nombre oblige à mesurer
//      à l'œil ; ces écrans sont projetés sur un mur pendant une session.
//   3. LES COULEURS VIENNENT DES TOKENS, jamais du code. Le thème clair et le
//      thème sombre doivent marcher sans y toucher.
// ============================================================================

export interface Barre {
  cle: string;
  libelle: string;
  /// Sous-libellé optionnel : le détail VN / VO, l'effectif…
  detail?: string;
  valeur: number;
  /// Part de `valeur` à peindre en second ton. Sert au VN / VO.
  part?: number;
}

/// Échelle sûre : jamais de division par zéro, et jamais une barre pleine pour
/// une valeur de 1 sur un maximum de 1 quand tout le reste est à zéro.
const echelle = (valeurs: number[]) => {
  const max = Math.max(0, ...valeurs);
  return max === 0 ? 1 : max;
};

// ---------------------------------------------------------------- par jour

/// Barres verticales — un jour de campagne par barre.
///
/// C'est la ligne 2 des onglets site du fichier source (52 / 49 / 42 / 38 / 37
/// pour Clermont en juin), qu'un chef de plaque regarde pour savoir si la journée
/// avance. En barres, la comparaison entre jours est immédiate ; en cartes de
/// chiffres, il fallait les lire une à une.
export function BarresParJour({ barres }: { barres: Barre[] }) {
  const max = echelle(barres.map((b) => b.valeur));

  if (barres.length === 0) {
    return <p className="note">Aucun jour sur cette campagne.</p>;
  }

  return (
    <div className="graphique-jours">
      {barres.map((b) => {
        const hauteur = (b.valeur / max) * 100;
        const hauteurPart = b.part !== undefined ? (b.part / max) * 100 : 0;
        return (
          <div className="colonne-jour" key={b.cle}>
            <span className="valeur">{b.valeur}</span>
            <div className="piste" role="img" aria-label={`${b.libelle} : ${b.valeur} RDV`}>
              {/* Deux barres superposées et non deux segments empilés : la part
                  VN commence au même point que le total, donc les deux hauteurs
                  se comparent directement à l'œil. */}
              <div className="barre" style={{ height: `${hauteur}%` }} />
              {b.part !== undefined && b.part > 0 && (
                <div className="barre part" style={{ height: `${hauteurPart}%` }} />
              )}
            </div>
            <span className="libelle">{b.libelle}</span>
            {b.detail && <span className="detail">{b.detail}</span>}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------- classement

/// Barres horizontales — un classement lisible de loin.
///
/// Horizontales et non verticales : les libellés sont des noms de concessions
/// (« Clermont-Ferrand »), illisibles sous une barre verticale étroite.
export function BarresHorizontales({
  barres,
  limite = 8,
}: {
  barres: Barre[];
  /// Au-delà, la lecture n'apporte plus rien et le panneau devient un tableau.
  /// Ce qui est écarté est ANNONCE : une troncature muette se lit comme
  /// « il n'y a que ça ».
  limite?: number;
}) {
  const visibles = barres.slice(0, limite);
  const max = echelle(visibles.map((b) => b.valeur));
  const restants = barres.length - visibles.length;

  if (barres.length === 0) {
    return <p className="note">Rien à classer sur cette campagne.</p>;
  }

  return (
    <div className="graphique-classement">
      {visibles.map((b, i) => (
        <div className="ligne-barre" key={b.cle}>
          <span className="rang">{i + 1}</span>
          <span className="libelle">{b.libelle}</span>
          <div className="piste" role="img" aria-label={`${b.libelle} : ${b.valeur}`}>
            <div className="barre" style={{ width: `${(b.valeur / max) * 100}%` }} />
          </div>
          <strong className={b.valeur === 0 ? 'zero' : ''}>{b.valeur}</strong>
        </div>
      ))}
      {restants > 0 && (
        <p className="note">
          {restants} autre{restants > 1 ? 's' : ''} non affiché{restants > 1 ? 's' : ''} — le
          tableau ci-dessous les porte tous.
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- KPI

export interface Kpi {
  libelle: string;
  valeur: string | number;
  detail?: string;
  /// `true` pour la valeur maîtresse de l'écran, peinte au dégradé.
  maitresse?: boolean;
}

/// Bandeau de chiffres clés.
///
/// Ce qu'ils remplacent : un espace vide. L'écran avait sa moitié droite
/// inoccupée pendant que le chiffre le plus important — le total — se cachait
/// dans un coin de l'en-tête.
export function BandeauKpi({ kpis }: { kpis: Kpi[] }) {
  return (
    <div className="bandeau-kpi">
      {kpis.map((k) => (
        <div className={`kpi ${k.maitresse ? 'maitresse' : ''}`} key={k.libelle}>
          <span className="libelle">{k.libelle}</span>
          <strong>{k.valeur}</strong>
          {k.detail && <span className="detail">{k.detail}</span>}
        </div>
      ))}
    </div>
  );
}
