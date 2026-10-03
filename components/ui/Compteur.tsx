// ============================================================================
// LE COMPTEUR QUI ROULE — catalogue d'animations de PLAN-GRID-V2.md : un chiffre
// qui change ROULE jusqu'a sa nouvelle valeur, comme un compteur mecanique.
//
// Une colonne de dix chiffres par position, deplacee en `transform` POSE EN DUR
// sur l'element (une variable CSS dans `transform` ne s'interpole pas — CLAUDE.md,
// mesure le 04/09). Compose par le GPU, aucun JavaScript par image.
// ============================================================================

export function Compteur({ valeur, className }: { valeur: number; className?: string }) {
  const chiffres = String(Math.max(0, Math.round(valeur))).split('');
  return (
    <span className={`compteur-roule num${className ? ` ${className}` : ''}`} aria-label={String(valeur)}>
      {chiffres.map((c, i) => (
        // La cle part de la DROITE : les unites gardent leur colonne quand le
        // nombre gagne un chiffre, et c'est elles qu'on voit rouler.
        <span className="colonne" key={chiffres.length - i} aria-hidden="true">
          <span className="ruban" style={{ transform: `translateY(${-Number(c) * 10}%)` }}>
            {'0123456789'.split('').map((d) => (
              <span key={d}>{d}</span>
            ))}
          </span>
        </span>
      ))}
    </span>
  );
}
