import { useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { mobilisation } from '../../backend/src/utils/agregats';
import { cleTri } from '../../backend/src/utils/tri';
import { bornesCreneau, estVenu, etapeAccueil, type EtapeAccueil } from '../../backend/src/utils/vp';
import { Icone } from '../../components/ui/Icone';
import { nouvelleCle } from '../../services/saisie';
import { enregistrerSuivi, poserTraficNaturel } from '../../services/suivi';
import { avancerAccueil, noShowAbsents, reculerAccueil, type RdvDeVp, type VendeurDeVp } from '../../services/vp';
import { Badge, EtiquetteMarque, heureCreneau, isoLocal, Kpi, pct, statutAffiche, type PropsEcranVp } from './commun';

// ============================================================================
// L'ACCUEIL — la tablette de l'encadrant VP, le jour J.
//
// UN GESTE, UNE ETAPE : attendu -> arrive -> avec le vendeur -> sorti. C'est la
// BASE qui sait quelle etape suit (`rdv_accueil_avancer`), a l'heure du serveur.
// L'issue saisie a la sortie remplit le Suivi le jour meme (`suivi_enregistrer`,
// le meme appel que l'ecran Suivi). Un geste de travers se corrige d'une touche
// (`rdv_accueil_reculer`).
//
// Les boutons des lignes sont NEUTRES, teintes de l'etape suivante : une ligne
// par client ferait sinon vingt actions principales en degrade (CLAUDE.md).
// ============================================================================

const commencePar = (texte: string, f: string) => cleTri(texte).split(/[\s.-]+/).some((m) => m.startsWith(f));

export function Accueil({ donnees, maintenant, recharger }: PropsEcranVp) {
  const { vp, rdvs, vendeurs, creneaux } = donnees;
  const [filtre, setFiltre] = useState('');
  const [sortie, setSortie] = useState<RdvDeVp | null>(null);
  const [visiteur, setVisiteur] = useState(false);
  const [clore, setClore] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [occupe, setOccupe] = useState<string | null>(null);
  const ouverte = !vp.cloturee;

  const nom = (id: string) => vendeurs.find((v) => v.id === id)?.nom ?? '—';
  const prenom = (id: string) => nom(id).split(' ')[0];
  const ordre = useMemo(() => new Map(creneaux.map((c) => [c.code, c.ordre])), [creneaux]);

  // UN GESTE A LA FOIS PAR CLIENT. L'etat `occupe` ne desactive le bouton qu'au
  // rendu suivant : deux clics rapides partaient tous les deux, et « avancer d'une
  // etape » deux fois faisait SORTIR un client qui venait d'etre confie au vendeur
  // (constate le 28/10 a Massagettes). Le verrou est une ref, lue au clic meme.
  const enVol = useRef(new Set<string>());
  const geste = async (id: string, f: () => Promise<unknown>) => {
    if (enVol.current.has(id)) return;
    enVol.current.add(id);
    setErreur(null);
    setOccupe(id);
    try {
      await f();
      await recharger();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Le geste n’a pas été enregistré.');
    } finally {
      enVol.current.delete(id);
      setOccupe(null);
    }
  };

  const heure = maintenant.getHours() + maintenant.getMinutes() / 60;
  const aujourdHui = isoLocal(maintenant) === vp.jour;
  const passe = (code: string) => {
    if (isoLocal(maintenant) > vp.jour) return true;
    const b = bornesCreneau(code);
    return aujourdHui && b !== null && b.fin <= heure;
  };
  const phoning = rdvs.filter((r) => r.source === 'relance');
  const venus = rdvs.filter(estVenu);
  const passes = phoning.filter((r) => passe(r.creneauCode));
  const commandes = rdvs.filter((r) => r.issue === 'commande').length;
  const etape = (r: RdvDeVp) => etapeAccueil(r);

  const f = cleTri(filtre.trim());
  const liste = rdvs.filter((r) => !f || commencePar(r.client, f) || commencePar(nom(r.vendeurId), f));
  const parHeure = (a: RdvDeVp, b: RdvDeVp) => (ordre.get(a.creneauCode) ?? 0) - (ordre.get(b.creneauCode) ?? 0);
  const groupes: [string, RdvDeVp[]][] = [
    ['Arrivés et avec un vendeur', liste.filter((r) => ['arrive', 'avec_vendeur'].includes(etape(r))).sort(parHeure)],
    ['À venir', liste.filter((r) => etape(r) === 'attendu').sort(parHeure)],
    ['Terminés', liste.filter((r) => ['sorti', 'no_show', 'annule'].includes(etape(r))).sort((a, b) => parHeure(b, a))],
  ];

  const action = (r: RdvDeVp, e: EtapeAccueil) => {
    if (!ouverte) return <Badge statut={statutAffiche(r, e)} />;
    const desactive = occupe === r.id;
    if (e === 'attendu')
      return (
        <button type="button" className="btn" disabled={desactive} style={{ '--c': 'var(--info)' } as React.CSSProperties} onClick={() => void geste(r.id, () => avancerAccueil(r.id))}>
          Arrivé
        </button>
      );
    const corriger = (
      <button type="button" className="icon-btn" disabled={desactive} title="Annuler le dernier geste" aria-label="Annuler le dernier geste" onClick={() => void geste(r.id, () => reculerAccueil(r.id))}>
        <Icone nom="retour" />
      </button>
    );
    if (e === 'arrive')
      return (
        <>
          {corriger}
          <button type="button" className="btn" disabled={desactive} style={{ '--c': 'var(--warn)' } as React.CSSProperties} onClick={() => void geste(r.id, () => avancerAccueil(r.id))}>
            Avec {prenom(r.vendeurId)}
          </button>
        </>
      );
    if (e === 'avec_vendeur')
      return (
        <>
          {corriger}
          <button type="button" className="btn" disabled={desactive} style={{ '--c': 'var(--ok)' } as React.CSSProperties} onClick={() => setSortie(r)}>
            Sortie…
          </button>
        </>
      );
    // Une SORTIE se corrige aussi : un client sorti par erreur revient « avec le
    // vendeur ». Sans ce bouton, rien a l'ecran ne permettait de le rattraper.
    if (e === 'sorti' && r.sortiLe)
      return (
        <>
          {corriger}
          <Badge statut={statutAffiche(r, e)} />
        </>
      );
    return <Badge statut={statutAffiche(r, e)} />;
  };

  return (
    <div className="page vp-page">
      <section className="vp-ecran actif">
        <div className="vp-tablette">
          <div className="kpis">
            {/* Les RDV du phoning arrives, SUR les RDV du phoning : un visiteur
                compte a part — mesure le 20/10, il donnait « 2 / 1 ». */}
            <Kpi
              l="Arrivés"
              v={<>{phoning.filter(estVenu).length}<span className="faint" style={{ fontSize: 16 }}> / {phoning.length}</span></>}
              d={`+ ${rdvs.length - phoning.length} visiteur${rdvs.length - phoning.length > 1 ? 's' : ''} sans RDV`}
            />
            <Kpi l="Avec un vendeur" v={rdvs.filter((r) => etape(r) === 'avec_vendeur').length} d="en ce moment" />
            <Kpi l="Présence" v={pct(passes.length ? passes.filter(estVenu).length / passes.length : null)} d="sur les heures passées" />
            <Kpi l="Commandes" v={commandes} d={`${pct(venus.length ? commandes / venus.length : null)} des venus`} accent />
          </div>
          <div className="vp-recherche">
            <input className="input" value={filtre} onChange={(e) => setFiltre(e.target.value)} placeholder="Nom du client…" autoComplete="off" aria-label="Chercher un client" />
            {ouverte && (
              <button type="button" className="btn" onClick={() => setVisiteur(true)}>
                + Visiteur
              </button>
            )}
          </div>
          {erreur && <div className="card pad" role="alert">{erreur}</div>}
          <div className="vp-file">
            {groupes.every(([, l]) => l.length === 0) && <div className="empty">{f ? 'Aucun client à ce nom.' : 'Aucun RDV.'}</div>}
            {groupes
              .filter(([, l]) => l.length > 0)
              .map(([titre, l]) => (
                <div key={titre} style={{ display: 'grid', gap: 8 }}>
                  <h3>{titre} · {l.length}</h3>
                  {l.map((r) => {
                    const e = etape(r);
                    return (
                      <div key={r.id} className={`vp-client${['sorti', 'no_show', 'annule'].includes(e) ? ' fini' : ''}`}>
                        <span className="h">{heureCreneau(r.creneauCode)}</span>
                        <span className="qui">
                          <b>{r.client}</b>
                          <span>
                            {nom(r.vendeurId)} · <EtiquetteMarque libelle={r.marque} /> {r.typeVehicule}
                            {r.source === 'showroom' && ' · visiteur'}
                            {(e === 'arrive' || e === 'avec_vendeur') && <> · <Badge statut={e} /></>}
                          </span>
                        </span>
                        <span className="actions">{action(r, e)}</span>
                      </div>
                    );
                  })}
                </div>
              ))}
          </div>
          {ouverte && (
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="button" className="btn danger" onClick={() => setClore(true)}>
                Clore la journée…
              </button>
            </div>
          )}
        </div>
      </section>

      {sortie && (
        <DialogueSortie
          rdv={sortie}
          vendeur={nom(sortie.vendeurId)}
          fermer={() => setSortie(null)}
          valider={(q) =>
            geste(sortie.id, async () => {
              // L'ISSUE D'ABORD : si la sortie echoue ensuite, le client reste
              // « avec le vendeur » avec son issue, au lieu de sortir sans issue.
              await enregistrerSuivi(sortie.id, q);
              await avancerAccueil(sortie.id);
            }).then(() => setSortie(null))
          }
        />
      )}
      {visiteur && (
        <DialogueVisiteur
          vendeurs={vendeurs.filter((v) => mobilisation(rdvs, vendeurs).has(v.id))}
          occupes={new Set(rdvs.filter((r) => etape(r) === 'avec_vendeur').map((r) => r.vendeurId))}
          fermer={() => setVisiteur(false)}
          valider={async (v, client, marqueId) => {
            // Le creneau en cours, sinon le premier : un visiteur arrive maintenant.
            const tries = [...creneaux].sort((a, b) => a.ordre - b.ordre);
            const code = tries.find((c) => {
              const b = bornesCreneau(c.code);
              return b !== null && b.debut <= heure && heure < b.fin;
            })?.code ?? tries[0]!.code;
            await geste('visiteur', async () => {
              const id = await poserTraficNaturel({
                campagneId: vp.id,
                vendeurId: v.id,
                typeVehicule: v.typeVehicule,
                jour: vp.jour,
                creneauCode: code,
                marqueId,
                client,
                cle: nouvelleCle(),
              });
              // Il est la, et avec le vendeur : deux gestes en un.
              await avancerAccueil(id);
              await avancerAccueil(id);
            });
            setVisiteur(false);
          }}
        />
      )}
      {clore && (
        <Dialogue fermer={() => setClore(false)}>
          <h2>Clore la journée</h2>
          {(() => {
            const n = phoning.filter((r) => etape(r) === 'attendu').length;
            return (
              <>
                <p className="muted" style={{ margin: 0 }}>
                  {n === 0
                    ? 'Aucun client attendu : tout le monde est pointé.'
                    : `${n} client${n > 1 ? 's' : ''} attendu${n > 1 ? 's' : ''} ne ${n > 1 ? 'sont' : 'est'} pas venu${n > 1 ? 's' : ''}. ${n > 1 ? 'Ils passent' : 'Il passe'} en No show dans le Suivi.`}
                </p>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                  <button type="button" className="btn" onClick={() => setClore(false)}>
                    Pas encore
                  </button>
                  <button
                    type="button"
                    className="btn primary"
                    disabled={n === 0}
                    onClick={() => void geste('clore', () => noShowAbsents(vp.id)).then(() => setClore(false))}
                  >
                    Clore
                  </button>
                </div>
              </>
            );
          })()}
        </Dialogue>
      )}
    </div>
  );
}

export function Dialogue({ fermer, children }: { fermer: () => void; children: React.ReactNode }) {
  return createPortal(
    <div className="v2">
      <div className="vp-dialogue-voile" onMouseDown={(e) => e.target === e.currentTarget && fermer()} onKeyDown={(e) => e.key === 'Escape' && fermer()}>
        <div className="vp-dialogue verre fort" role="dialog" aria-modal="true">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}

type Avantage = 'diac' | 'cs' | 'stock' | 'vd';

function DialogueSortie({
  rdv,
  vendeur,
  fermer,
  valider,
}: {
  rdv: RdvDeVp;
  vendeur: string;
  fermer: () => void;
  valider: (q: Parameters<typeof enregistrerSuivi>[1]) => Promise<void>;
}) {
  const [commande, setCommande] = useState(false);
  const [cases, setCases] = useState<Record<Avantage, boolean>>({ diac: false, cs: false, stock: false, vd: false });
  const qualif = (issue: 'commande' | 'offre_en_cours' | 'clos_sans_suite') => ({
    issue,
    diac: cases.diac,
    stock: cases.stock,
    cs: cases.cs,
    // VD : seulement sur une commande STOCK d'un RDV VN (regle du Suivi, 05/10).
    vd: cases.vd && cases.stock && rdv.typeVehicule === 'VN',
    modele: rdv.modele,
    commentaire: rdv.commentaire,
  });
  const avantages: Avantage[] = rdv.typeVehicule === 'VN' && cases.stock ? ['diac', 'cs', 'stock', 'vd'] : ['diac', 'cs', 'stock'];
  return (
    <Dialogue fermer={fermer}>
      <h2>{rdv.client} sort</h2>
      <div className="muted">
        Avec {vendeur} · <EtiquetteMarque libelle={rdv.marque} /> {rdv.typeVehicule}
      </div>
      <div className="vp-gros-choix">
        <button type="button" className={`btn${commande ? ' primary' : ''}`} onClick={() => setCommande(true)}>
          Commande
        </button>
        <button type="button" className="btn" onClick={() => void valider(qualif('offre_en_cours'))}>
          Offre
        </button>
        <button type="button" className="btn" onClick={() => void valider(qualif('clos_sans_suite'))}>
          Sans suite
        </button>
      </div>
      {commande && (
        <div>
          <div className="label" style={{ marginBottom: 8 }}>La commande</div>
          <div className="vp-cases">
            {avantages.map((c) => (
              <button key={c} type="button" className="chip" aria-pressed={cases[c]} onClick={() => setCases((x) => ({ ...x, [c]: !x[c] }))}>
                {c.toUpperCase()}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
            <button type="button" className="btn primary" onClick={() => void valider(qualif('commande'))}>
              Enregistrer la commande
            </button>
          </div>
        </div>
      )}
    </Dialogue>
  );
}

function DialogueVisiteur({
  vendeurs,
  occupes,
  fermer,
  valider,
}: {
  vendeurs: VendeurDeVp[];
  occupes: Set<string>;
  fermer: () => void;
  valider: (v: VendeurDeVp, client: string, marqueId: string | null) => Promise<void>;
}) {
  const disponibles = vendeurs.filter((v) => !occupes.has(v.id));
  const [vendeurId, setVendeurId] = useState(disponibles[0]?.id ?? vendeurs[0]?.id ?? '');
  const [client, setClient] = useState('');
  const v = vendeurs.find((x) => x.id === vendeurId);
  const [marqueId, setMarqueId] = useState<string | null>(v?.marques[0]?.id ?? null);
  const [envoi, setEnvoi] = useState(false);
  return (
    <Dialogue fermer={fermer}>
      <h2>Un visiteur sans RDV</h2>
      <label className="field">
        <span className="label">Nom</span>
        <input className="input" autoFocus value={client} onChange={(e) => setClient(e.target.value)} placeholder="NOM P." />
      </label>
      <div className="field">
        <span className="label">Vendeur {disponibles.length < vendeurs.length && <span className="faint">· les vendeurs déjà avec un client sont à la fin</span>}</span>
        <div className="vp-cases">
          {[...disponibles, ...vendeurs.filter((x) => occupes.has(x.id))].map((x) => (
            <button
              key={x.id}
              type="button"
              className="chip"
              aria-pressed={x.id === vendeurId}
              onClick={() => {
                setVendeurId(x.id);
                setMarqueId(x.marques[0]?.id ?? null);
              }}
            >
              {x.nom}
            </button>
          ))}
        </div>
      </div>
      {v && v.typeVehicule === 'VN' && v.marques.length > 1 && (
        <div className="field">
          <span className="label">Marque</span>
          <div className="vp-cases">
            {v.marques.map((m) => (
              <button key={m.id} type="button" className="chip" aria-pressed={m.id === marqueId} onClick={() => setMarqueId(m.id)}>
                {m.libelle}
              </button>
            ))}
          </div>
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button type="button" className="btn" onClick={fermer}>
          Annuler
        </button>
        <button
          type="button"
          className="btn primary"
          disabled={!v || client.trim() === '' || envoi}
          onClick={() => {
            if (!v) return;
            setEnvoi(true);
            void valider(v, client.trim().toUpperCase(), v.typeVehicule === 'VO' ? null : marqueId).finally(() => setEnvoi(false));
          }}
        >
          Le confier à {v?.nom.split(' ')[0] ?? '…'}
        </button>
      </div>
    </Dialogue>
  );
}
