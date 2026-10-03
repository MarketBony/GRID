import { useMemo, useState } from 'react';
import type { RdvSaisie, VendeurSaisie } from '../../services/saisie';
import { libelleJour } from '../../utils/grille';
import { useIndicateurGlissant } from '../../hooks/useIndicateurGlissant';

// ============================================================================
// LA VUE « TABLE » — D13, n.6 de PLAN-GRID-V2.md.
//
// Tous les vendeurs affiches, pour UN jour, en carte de chaleur : on voit d'un
// coup d'oeil qui a des trous et ou. Rien n'est saisi ici — cliquer une case
// ouvre le planning du vendeur, la ou se fait la saisie. Les nombres sont
// recomptes depuis les RDV en memoire, comme les compteurs de la liste.
// ============================================================================

export function VueTable({
  vendeurs,
  jours,
  creneaux,
  rdvsParVendeur,
  ouvrir,
}: {
  vendeurs: VendeurSaisie[];
  jours: { jour: string; ordre: number }[];
  creneaux: { code: string; libelle: string; ordre: number }[];
  rdvsParVendeur: Map<string, Map<string, RdvSaisie[]>>;
  ouvrir: (vendeurId: string) => void;
}) {
  const aujourdHui = new Date().toISOString().slice(0, 10);
  const [jour, setJour] = useState(() => jours.find((j) => j.jour === aujourdHui)?.jour ?? jours[0]?.jour ?? '');
  const seg = useIndicateurGlissant(Math.max(0, jours.findIndex((j) => j.jour === jour)), jours.length);

  /// Nombre de RDV par vendeur et par creneau, ce jour-la. On parcourt les
  /// cases du vendeur une fois : la cle d'une case porte le jour et le creneau.
  const comptes = useMemo(() => {
    const m = new Map<string, Map<string, number>>();
    for (const v of vendeurs) {
      const parCreneau = new Map<string, number>();
      for (const liste of rdvsParVendeur.get(v.id)?.values() ?? []) {
        for (const r of liste) {
          if (r.jour !== jour) continue;
          parCreneau.set(r.creneauCode, (parCreneau.get(r.creneauCode) ?? 0) + 1);
        }
      }
      m.set(v.id, parCreneau);
    }
    return m;
  }, [vendeurs, rdvsParVendeur, jour]);

  const total = (id: string) => [...(comptes.get(id)?.values() ?? [])].reduce((a, b) => a + b, 0);

  return (
    <div className="v2 vue-table">
      <div className="seg" ref={seg.conteneur} role="radiogroup" aria-label="Jour">
        <span className="pouce" ref={seg.indicateur} aria-hidden="true" />
        {jours.map((j, i) => (
          <button key={j.jour} type="button" ref={seg.cible(i)} aria-pressed={j.jour === jour} onClick={() => setJour(j.jour)}>
            {libelleJour(j.jour)}
          </button>
        ))}
      </div>
      <div className="grille-defile">
        <table className="chaleur">
          <thead>
            <tr>
              <th />
              {creneaux.map((c) => (
                <th key={c.code} scope="col">{c.libelle}</th>
              ))}
              <th scope="col">Jour</th>
            </tr>
          </thead>
          <tbody>
            {vendeurs.map((v, k) => (
              <tr key={v.id} className="enter" style={{ ['--i' as string]: Math.min(k, 14) }}>
                <th scope="row">
                  <button type="button" className="nom-vendeur" onClick={() => ouvrir(v.id)}>
                    {v.nom}
                  </button>
                </th>
                {creneaux.map((c) => {
                  const n = comptes.get(v.id)?.get(c.code) ?? 0;
                  return (
                    <td key={c.code}>
                      <button
                        type="button"
                        className={`chaleur-case n${Math.min(n, 2)}`}
                        onClick={() => ouvrir(v.id)}
                        title={`${v.nom} — ${c.libelle} : ${n} RDV`}
                      >
                        {n > 0 ? n : ''}
                      </button>
                    </td>
                  );
                })}
                <td className="num total-jour">{total(v.id)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
