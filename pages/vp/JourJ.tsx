import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { mobilisation } from '../../backend/src/utils/agregats';
import { bornesCreneau, etapeAccueil, preneur } from '../../backend/src/utils/vp';
import { Icone } from '../../components/ui/Icone';
import { reaffecterRdv, type RdvDeVp, type VendeurDeVp } from '../../services/vp';
import {
  Badge,
  EtiquetteMarque,
  heureCreneau,
  heureMinute,
  isoLocal,
  jj,
  jourLong,
  STATUTS,
  statutAffiche,
  type PropsEcranVp,
  type StatutAffiche,
} from './commun';

// ============================================================================
// JOUR J — L'AGENDA DE LA JOURNEE : une colonne par vendeur, une ligne par heure.
//
// LA REAFFECTATION (decision du 20/10/2026) : on glisse un RDV sur une case
// VERTE, ou on passe par son detail. Une case verte est un vendeur LIBRE a cette
// heure ET qui peut vendre ce vehicule (type, marque autorisee) — la base le
// reverifie (`rdv_reaffecter` et les triggers de `rdv`). Le phoning reste a qui a
// pris le RDV, la vente va a qui recoit le client.
//
// DEUX CLIENTS A LA MEME HEURE chez un vendeur : GRID l'accepte a la saisie
// (cellules a deux RDV, 03/09), mais le jour J l'un des deux attendra. On le
// SIGNALE, on ne le refuse pas.
// ============================================================================

const peutRecevoir = (v: VendeurDeVp, r: RdvDeVp) =>
  v.typeVehicule === r.typeVehicule && (v.typeVehicule === 'VO' || v.marques.some((m) => m.id === r.marqueId));

export function JourJ({ donnees, maintenant, recharger }: PropsEcranVp) {
  const { vp, rdvs, vendeurs, creneaux } = donnees;
  const [detail, setDetail] = useState<RdvDeVp | null>(null);
  const [glisse, setGlisse] = useState<RdvDeVp | null>(null);
  const [survol, setSurvol] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const effectif = useMemo(() => mobilisation(rdvs, vendeurs), [rdvs, vendeurs]);
  const colonnes = vendeurs.filter((v) => effectif.has(v.id));
  const lignes = [...creneaux].sort((a, b) => a.ordre - b.ordre);
  const parCase = useMemo(() => {
    const m = new Map<string, RdvDeVp[]>();
    for (const r of rdvs) {
      const cle = `${r.vendeurId}|${r.creneauCode}`;
      m.set(cle, [...(m.get(cle) ?? []), r]);
    }
    return m;
  }, [rdvs]);

  const aujourdHui = isoLocal(maintenant) === vp.jour;
  const heure = maintenant.getHours() + maintenant.getMinutes() / 60;
  const passe = (code: string) => {
    if (vp.cloturee || isoLocal(maintenant) > vp.jour) return true;
    const b = bornesCreneau(code);
    return aujourdHui && b !== null && b.fin <= heure;
  };
  const enCours = (code: string) => {
    const b = bornesCreneau(code);
    return aujourdHui && b !== null && b.debut <= heure && heure < b.fin;
  };

  const libres = (r: RdvDeVp) =>
    colonnes.filter((v) => v.id !== r.vendeurId && peutRecevoir(v, r) && !(parCase.get(`${v.id}|${r.creneauCode}`)?.length));

  const reaffecter = async (r: RdvDeVp, vendeurId: string) => {
    setErreur(null);
    try {
      await reaffecterRdv(r.id, vendeurId);
      setDetail(null);
      await recharger();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Réaffectation impossible.');
    }
  };

  const cibles = glisse ? new Set(libres(glisse).map((v) => `${v.id}|${glisse.creneauCode}`)) : new Set<string>();
  const nom = (id: string) => vendeurs.find((v) => v.id === id)?.nom ?? '—';

  return (
    <div className="page vp-page">
      <section className="vp-ecran actif">
        <div className="app-head">
          <h2>Jour J</h2>
          <span className="sub">
            {jourLong(vp.jour)}
            {aujourdHui && ` · ${maintenant.getHours()} h ${String(maintenant.getMinutes()).padStart(2, '0')}`}
          </span>
          <div className="droite vp-legende">
            {(['attendu', 'arrive', 'avec_vendeur', 'commande', 'offre', 'sans_suite', 'no_show'] as StatutAffiche[]).map((k) => (
              <span key={k}>
                <i style={{ background: STATUTS[k].couleur }} />
                {STATUTS[k].libelle}
              </span>
            ))}
          </div>
        </div>
        {erreur && <div className="card pad" role="alert">{erreur}</div>}

        {colonnes.length === 0 ? (
          <div className="card empty">Aucun vendeur dans cette VP.</div>
        ) : (
          <div className="card vp-agenda-cadre">
            <div className="vp-agenda" style={{ gridTemplateColumns: `64px repeat(${colonnes.length}, minmax(150px, 1fr))` }}>
              <div className="tete heure" style={{ zIndex: 3 }} />
              {colonnes.map((v) => (
                <div className="tete" key={v.id}>
                  {v.nom}
                  <small>
                    {v.typeVehicule} · {rdvs.filter((r) => r.vendeurId === v.id).length} RDV
                  </small>
                </div>
              ))}
              {lignes.map((c) => (
                <Ligne key={c.code}>
                  <div className={`heure${enCours(c.code) ? ' maintenant' : ''}`}>{heureCreneau(c.code)}</div>
                  {colonnes.map((v) => {
                    const cle = `${v.id}|${c.code}`;
                    const ici = parCase.get(cle) ?? [];
                    const double = ici.length > 1 && !passe(c.code);
                    return (
                      <div
                        key={cle}
                        className={`case${passe(c.code) ? ' passe' : ''}${double ? ' double' : ''}${cibles.has(cle) ? ' libre-cible' : ''}${survol === cle ? ' survol' : ''}`}
                        onDragOver={(e) => {
                          if (!cibles.has(cle)) return;
                          e.preventDefault();
                          setSurvol(cle);
                        }}
                        onDragLeave={() => setSurvol((s) => (s === cle ? null : s))}
                        onDrop={(e) => {
                          if (!glisse || !cibles.has(cle)) return;
                          e.preventDefault();
                          const r = glisse;
                          setGlisse(null);
                          setSurvol(null);
                          void reaffecter(r, v.id);
                        }}
                      >
                        {ici.map((r) => {
                          const statut = statutAffiche(r, etapeAccueil(r));
                          return (
                            <button
                              key={r.id}
                              type="button"
                              className="vp-rdv"
                              draggable={!vp.cloturee}
                              style={{ '--c': STATUTS[statut].couleur } as React.CSSProperties}
                              onClick={() => setDetail(r)}
                              onDragStart={(e) => {
                                e.dataTransfer.effectAllowed = 'move';
                                e.dataTransfer.setData('text/plain', r.id);
                                setGlisse(r);
                              }}
                              onDragEnd={() => {
                                setGlisse(null);
                                setSurvol(null);
                              }}
                            >
                              <span className="cl">{r.client}</span>
                              <span className="meta">
                                <EtiquetteMarque libelle={r.marque} />
                                {r.typeVehicule}
                                {r.source === 'showroom' && ' · visiteur'}
                                {r.prisParVendeurId && ' · réaffecté'}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}
                </Ligne>
              ))}
            </div>
          </div>
        )}
      </section>

      {detail &&
        createPortal(
          <div className="v2 volet-ouvert">
            <div className="vp-volet-voile" onClick={() => setDetail(null)} />
            <aside className="vp-volet verre fort" aria-label="Détail du RDV">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <h2>{detail.client}</h2>
                <span style={{ marginLeft: 'auto' }}>
                  <Badge statut={statutAffiche(detail, etapeAccueil(detail))} />
                </span>
                <button type="button" className="icon-btn" onClick={() => setDetail(null)} aria-label="Fermer">
                  <Icone nom="fermer" />
                </button>
              </div>
              <div>
                <div className="ligne"><span>Heure</span><span>{jj(vp.jour)} · {detail.creneau}</span></div>
                <div className="ligne"><span>Véhicule</span><span><EtiquetteMarque libelle={detail.marque} /> {detail.typeVehicule}</span></div>
                <div className="ligne"><span>Reçu par</span><span>{nom(detail.vendeurId)}</span></div>
                <div className="ligne">
                  <span>Pris par</span>
                  <span>{detail.source === 'showroom' ? 'visiteur sans RDV' : nom(preneur(detail))}</span>
                </div>
                {detail.arriveLe && <div className="ligne"><span>Arrivé à</span><span>{heureMinute(detail.arriveLe)}</span></div>}
              </div>
              {!vp.cloturee && detail.source === 'relance' && (
                <>
                  <div className="label">Réaffecter à un vendeur libre à {heureCreneau(detail.creneauCode)}</div>
                  <div className="vp-choix">
                    {libres(detail).length === 0 ? (
                      <div className="faint">Aucun vendeur libre qui puisse vendre ce véhicule à cette heure.</div>
                    ) : (
                      libres(detail).map((v) => (
                        <button key={v.id} type="button" className="btn" onClick={() => void reaffecter(detail, v.id)}>
                          <span>{v.nom}</span>
                          <span className="faint">{v.typeVehicule}</span>
                        </button>
                      ))
                    )}
                  </div>
                  <p className="faint" style={{ margin: 0, fontSize: 12.5 }}>
                    Le RDV reste au phoning de {nom(preneur(detail))} ; la vente ira au vendeur qui reçoit le client.
                  </p>
                </>
              )}
            </aside>
          </div>,
          document.body
        )}
    </div>
  );
}

/// Une ligne de la grille : ses cellules s'inscrivent directement dans la grille
/// CSS du parent (`display: contents`).
function Ligne({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'contents' }}>{children}</div>;
}
