import { useEffect, useMemo, useState } from 'react';
import type { VendeurTable } from '../../services/tables';
import { chargerMobilisations, definirMobilisation, type Exception } from '../../services/effectifs';
import { comparerLibelle } from '../../backend/src/utils/tri';

// ============================================================================
// EFFECTIFS D'UNE SESSION PAR SITE — D12 et D11 de PLAN-GRID-V2.md.
//
// « On peut gerer des vendeurs sur les sessions tables mais pas sur les sessions
// sites » : c'etait vrai, une session par site mobilisait d'office tout vendeur
// present. Ici on coche qui participe. Un vendeur decoche est ABSENT : il sort
// de la grille de saisie et de l'effectif — sauf s'il a des RDV, auquel cas il
// compte quand meme (`mobilisation()`, agregats.ts).
// ============================================================================

export function EffectifsParSite({
  campagneId,
  vendeurs,
  figee,
}: {
  campagneId: string;
  vendeurs: VendeurTable[];
  figee: boolean;
}) {
  const [exceptions, setExceptions] = useState<Map<string, Exception>>(new Map());
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    chargerMobilisations(campagneId)
      .then(setExceptions)
      .catch((e) => setErreur(e instanceof Error ? e.message : 'Chargement impossible.'));
  }, [campagneId]);

  const parSite = useMemo(() => {
    const m = new Map<string, VendeurTable[]>();
    for (const v of vendeurs) m.set(v.siteLibelle, [...(m.get(v.siteLibelle) ?? []), v]);
    return [...m.entries()]
      .sort(([a], [b]) => comparerLibelle(a, b))
      .map(([site, liste]) => [site, liste.sort((a, b) => comparerLibelle(a.nom, b.nom))] as const);
  }, [vendeurs]);

  const mobilise = (id: string) => exceptions.get(id)?.mobilise ?? true;

  /// EN MEMOIRE d'abord, la base ensuite ; un refus remet l'interrupteur.
  const basculer = async (v: VendeurTable) => {
    if (figee) return;
    const avant = exceptions;
    const suivant = !mobilise(v.id);
    setExceptions(new Map(avant).set(v.id, { mobilise: suivant, motif: null }));
    try {
      await definirMobilisation(campagneId, v.id, suivant);
      setErreur(null);
    } catch (e) {
      setExceptions(avant);
      setErreur(`${v.nom} : ${e instanceof Error ? e.message : 'enregistrement impossible.'}`);
    }
  };

  const total = vendeurs.filter((v) => mobilise(v.id)).length;

  return (
    <div className="v2 effectifs-site">
      {erreur && <div className="bandeau-v2 erreur">{erreur}</div>}
      <p className="muted" style={{ margin: '0 0 12px' }}>
        <b className="num">{total}</b> vendeurs mobilisés sur {vendeurs.length}. Un vendeur absent sort de la grille de
        saisie et de l’effectif — sauf s’il a déjà des RDV.
      </p>
      <div className="effectifs-grille">
        {parSite.map(([site, liste], k) => (
          <div key={site} className="card enter" style={{ padding: 14, ['--i' as string]: k }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
              <b>{site}</b>
              <span className="faint num">{liste.filter((v) => mobilise(v.id)).length}/{liste.length}</span>
            </div>
            {liste.map((v) => (
              <label key={v.id} className={`effectif-ligne${mobilise(v.id) ? '' : ' absent'}`}>
                <span className="nom">{v.nom}</span>
                <span className="faint">{v.typeVehicule}</span>
                <input
                  type="checkbox"
                  className="interrupteur-v2"
                  checked={mobilise(v.id)}
                  disabled={figee}
                  onChange={() => void basculer(v)}
                  aria-label={`${v.nom} mobilisé`}
                />
              </label>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
