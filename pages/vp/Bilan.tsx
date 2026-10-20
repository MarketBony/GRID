import { useEffect, useMemo, useState } from 'react';
import { bilanParVendeur, bilanVp, comparerVp, estVenu, type VpComparee } from '../../backend/src/utils/vp';
import { duPhoning } from '../../backend/src/utils/agregats';
import { chargerDonneesVp, type VpResume } from '../../services/vp';
import { decimal, jjmmaaaa, Kpi, moisAnnee, pct, type PropsEcranVp } from './commun';

// ============================================================================
// LE BILAN — ramene au vendeur (decision du 20/10/2026). Les ventes sont les
// commandes du Suivi jusqu'a la cloture, quel que soit le jour ou l'offre se
// conclut : tant que la VP est ouverte, le bilan est PROVISOIRE, et l'ecran le dit.
//
// LA COMPARAISON entre VP relit chaque VP close par le meme chemin que celle-ci
// (`chargerDonneesVp`) et rejoue le meme calcul (`bilanVp`) : aucune seconde
// facon de compter. Un encadrant n'y voit que les VP de ses sites — la RLS ne lui
// montre pas les vendeurs des autres.
// ============================================================================

export function Bilan({ donnees, vps }: PropsEcranVp & { vps: VpResume[] }) {
  const { vp, rdvs, vendeurs } = donnees;
  const b = useMemo(() => bilanVp(rdvs, vendeurs), [rdvs, vendeurs]);
  const parVendeur = useMemo(() => bilanParVendeur(rdvs, vendeurs), [rdvs, vendeurs]);

  const [autres, setAutres] = useState<VpComparee[] | null>(null);
  useEffect(() => {
    let vivant = true;
    const closes = vps.filter((x) => x.cloturee && x.id !== vp.id);
    void Promise.all(
      closes.map(async (x) => {
        try {
          const d = await chargerDonneesVp(x);
          const bx = bilanVp(d.rdvs, d.vendeurs);
          return bx.effectif > 0
            ? { campagneId: x.id, libelle: x.libelle, siteLibelle: x.siteLibelle, jour: x.jour, effectif: bx.effectif, ventes: bx.ventes }
            : null;
        } catch {
          return null;
        }
      })
    ).then((l) => vivant && setAutres(l.filter((x): x is VpComparee => x !== null)));
    return () => {
      vivant = false;
    };
  }, [vps, vp.id]);

  const comparaison = useMemo(
    () =>
      comparerVp([
        ...(autres ?? []),
        { campagneId: vp.id, libelle: vp.libelle, siteLibelle: vp.siteLibelle, jour: vp.jour, effectif: b.effectif, ventes: b.ventes },
      ]),
    [autres, vp, b]
  );
  const maxPv = Math.max(...comparaison.map((c) => c.ventesParVendeur ?? 0)) || 1;

  const phoning = duPhoning(rdvs);
  const etapes: [string, number][] = [
    ['RDV pris', phoning.length],
    ['Venus', phoning.filter(estVenu).length],
    ['Offres et commandes', phoning.filter((r) => r.issue === 'commande' || r.issue === 'offre_en_cours').length],
    ['Commandes', b.commandesPhoning],
  ];

  return (
    <div className="page vp-page">
      <section className="vp-ecran actif">
        <div className="app-head">
          <h2>Bilan</h2>
          <span className="sub">
            VP {vp.siteLibelle} · {jjmmaaaa(vp.jour)}
            {!vp.cloturee && ' · provisoire tant que la VP n’est pas clôturée'}
          </span>
        </div>
        <div className="kpis">
          <Kpi l="Ventes par vendeur" v={decimal(b.ventesParVendeur)} d={`${b.ventes} commandes · ${b.effectif} vendeurs`} accent />
          <Kpi l="RDV pris" v={b.rdvPris} d={`${decimal(b.effectif ? b.rdvPris / b.effectif : null)} par vendeur`} />
          <Kpi l="Présence" v={pct(b.presence)} d={`${b.noShows} no show`} />
          <Kpi l="Transformation" v={pct(b.transformation)} d="commandes / venus" />
          <Kpi l="Visiteurs" v={b.visiteurs} d={`${b.ventes - b.commandesPhoning} commande${b.ventes - b.commandesPhoning > 1 ? 's' : ''} · ${b.avecDiac} avec DIAC en tout`} />
        </div>
        <div className="vp-deux">
          <div className="card pad">
            <h3 className="card-titre">Du phoning à la commande</h3>
            <div className="vp-tunnel">
              {etapes.map(([l, n], i) => (
                <div className="etape" key={l}>
                  <span className="taux">{i ? pct(etapes[i - 1]![1] ? n / etapes[i - 1]![1] : null) : ' '}</span>
                  <span className="v num">{n}</span>
                  <div className="barre" style={{ height: Math.max(8, (160 * n) / Math.max(1, etapes[0]![1])), animationDelay: `${i * 90}ms` }} />
                  <span className="l">{l}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="card pad">
            <h3 className="card-titre">
              Comparaison des VP <span className="badge">ventes par vendeur</span>
            </h3>
            {autres === null ? (
              <div className="skel" style={{ height: 120 }} />
            ) : (
              <div className="vp-tbl-cadre">
                <table className="tbl">
                  <thead>
                    <tr><th>#</th><th>VP</th><th className="r">Vendeurs</th><th className="r">Ventes</th><th className="r">Par vendeur</th></tr>
                  </thead>
                  <tbody>
                    {comparaison.map((c) => (
                      <tr key={c.campagneId} className={c.campagneId === vp.id ? 'nous' : ''}>
                        <td>{c.rang}</td>
                        <td>{c.siteLibelle} <span className="faint">{moisAnnee(c.jour)}</span></td>
                        <td className="r num">{c.effectif}</td>
                        <td className="r num">{c.ventes}</td>
                        <td className="r">
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                            <span className="vp-jauge" style={{ width: 70 }}>
                              <i style={{ transform: `scaleX(${(c.ventesParVendeur ?? 0) / maxPv})` }} />
                            </span>
                            <b className="num">{decimal(c.ventesParVendeur)}</b>
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {comparaison.length === 1 && <p className="faint" style={{ margin: '8px 0 0' }}>Première VP close à venir : la comparaison se remplira.</p>}
              </div>
            )}
          </div>
        </div>
        <div className="card pad vp-tbl-cadre">
          <h3 className="card-titre">Par vendeur</h3>
          <table className="tbl">
            <thead>
              <tr>
                <th>Vendeur</th><th className="r">RDV pris</th><th className="r">Objectif</th><th className="r">Reçus</th>
                <th className="r">Venus</th><th className="r">Présence</th><th className="r">Commandes</th><th className="r">Transfo</th><th className="r">dont DIAC</th>
              </tr>
            </thead>
            <tbody>
              {parVendeur.map((l) => (
                <tr key={l.vendeurId}>
                  <td><b>{l.nom}</b> <span className="faint">{l.typeVehicule}</span></td>
                  <td className="r num">{l.pris}</td>
                  <td className="r num faint">{l.objectif ?? '—'}</td>
                  <td className="r num">{l.recus}</td>
                  <td className="r num">{l.venus}</td>
                  <td className="r num">{pct(l.presence)}</td>
                  <td className="r num"><b>{l.commandes}</b></td>
                  <td className="r num">{pct(l.transformation)}</td>
                  <td className="r num">{l.avecDiac}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
