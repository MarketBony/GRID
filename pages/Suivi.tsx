import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icone } from '../components/ui/Icone';
import { useIndicateurGlissant } from '../hooks/useIndicateurGlissant';
import { chargerCampagnes, type CampagneResume } from '../services/campagnes';
import { archiverRdv, chargerSaisie, nouvelleCle, type PerimetreSaisie } from '../services/saisie';
import {
  chargerSuivi,
  enregistrerSuivi,
  poserTraficNaturel,
  vendeursDuSuivi,
  versLigneSuivi,
  type RdvSuivi,
} from '../services/suivi';
import { classementCommandes, estSeche, indicateurs, type RangSuivi } from '../backend/src/utils/suivi';
import { ISSUES_SUIVI, type IssueSuivi } from '../backend/src/auth/roles';
import { choisirDansListe, useCampagneCourante } from '../contexts/CampagneContext';
import { cleTri } from '../backend/src/utils/tri';
import { libelleJour } from '../utils/grille';

// ============================================================================
// SUIVI DES RDV — lot 6 de PLAN-GRID-V2.md.
//
// Le contenu du fichier de suivi tenu a la main, PAS sa forme : une liste de
// travail, « a traiter » d'abord, et un RDV se qualifie en un geste. Les
// indicateurs viennent de `utils/suivi.ts` (fonctions pures, `test:suivi`), jamais
// d'un comptage ecrit ici (interdit n.6).
//
// D10 : le suivi se FERME avec la campagne. Une campagne cloturee s'affiche en
// lecture seule.
// ============================================================================

const LIBELLES_ISSUE: Record<IssueSuivi, string> = {
  commande: 'Commande',
  offre_en_cours: 'Offre en cours',
  annule: 'Annulé',
  no_show: 'No show',
  clos_sans_suite: 'Clos sans suite',
};

type Vue = 'a_traiter' | 'tous' | 'commandes' | 'trafic' | 'vendeurs';
const VUES: { id: Vue; libelle: string }[] = [
  { id: 'a_traiter', libelle: 'À traiter' },
  { id: 'tous', libelle: 'Tous' },
  { id: 'commandes', libelle: 'Commandes' },
  { id: 'trafic', libelle: 'Trafic naturel' },
  { id: 'vendeurs', libelle: 'Par vendeur' },
];

const pourcent = (t: number | null) => (t === null ? '—' : `${(t * 100).toFixed(1).replace('.', ',')} %`);

export function Suivi() {
  const [campagnes, setCampagnes] = useState<CampagneResume[]>([]);
  const { campagneId, choisir } = useCampagneCourante();
  const [rdvs, setRdvs] = useState<RdvSuivi[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [vue, setVue] = useState<Vue>('a_traiter');
  const [recherche, setRecherche] = useState('');
  /// LES LIGNES QUALIFIEES PENDANT CETTE VISITE restent affichees dans « a
  /// traiter », avec leur liseré de couleur, jusqu'au changement de vue. Les faire
  /// sortir tout de suite empechait de cocher DIAC / STOCK / CS apres avoir choisi
  /// « Commande » — constate a l'essai le 03/10 — et de rattraper un clic de travers.
  const [gardes, setGardes] = useState<Set<string>>(new Set());
  useEffect(() => setGardes(new Set()), [vue, campagneId]);
  const [formulaire, setFormulaire] = useState(false);
  /// PAR TRANCHES : une campagne compte ~1 000 RDV, et un telephone en showroom
  /// n'a pas a en dessiner mille d'un coup. La recherche et les vues filtrent
  /// AVANT la tranche, donc rien n'est cache a qui cherche.
  const TRANCHE = 60;
  const [limite, setLimite] = useState(TRANCHE);
  useEffect(() => setLimite(TRANCHE), [vue, recherche, campagneId]);

  useEffect(() => {
    chargerCampagnes()
      .then((cs) => {
        setCampagnes(cs);
        const retenue = choisirDansListe(cs, campagneId, (l) => l.find((c) => !c.cloturee) ?? l[0]);
        if (retenue) choisir(retenue);
        else setChargement(false);
      })
      .catch((e) => {
        setErreur(e instanceof Error ? e.message : 'Chargement impossible.');
        setChargement(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const recharger = (id: string) =>
    chargerSuivi(id)
      .then(setRdvs)
      .catch((e) => setErreur(e instanceof Error ? e.message : 'Chargement impossible.'));

  useEffect(() => {
    if (!campagneId) return;
    setChargement(true);
    void recharger(campagneId).finally(() => setChargement(false));
  }, [campagneId]);

  const campagne = campagnes.find((c) => c.id === campagneId) ?? null;
  const figee = campagne?.cloturee ?? false;

  const ind = useMemo(() => indicateurs(rdvs.map(versLigneSuivi)), [rdvs]);

  const visibles = useMemo(() => {
    const q = cleTri(recherche.trim());
    return rdvs.filter((r) => {
      if (gardes.has(r.id)) return true;
      if (vue === 'a_traiter' && r.issue !== null) return false;
      if (vue === 'commandes' && r.issue !== 'commande') return false;
      if (vue === 'trafic' && r.source !== 'showroom') return false;
      if (q && !cleTri(`${r.client} ${r.vendeur} ${r.modele ?? ''}`).includes(q)) return false;
      return true;
    });
  }, [rdvs, vue, recherche, gardes]);

  /// PAR VENDEUR : le classement de `utils/suivi.ts` (teste par `test:suivi`),
  /// rejoue sur les RDV que la recherche retient — jamais un comptage ecrit ici.
  /// Phoning ET trafic naturel, comme les indicateurs en tete d'ecran.
  const parVendeur = useMemo(() => {
    const q = cleTri(recherche.trim());
    const retenus = rdvs.filter((r) => !q || cleTri(`${r.vendeur} ${r.siteCode}`).includes(q));
    return classementCommandes(retenus.map(versLigneSuivi));
  }, [rdvs, recherche]);
  const siteDe = useMemo(() => new Map(rdvs.map((r) => [r.vendeurId, r.siteCode])), [rdvs]);

  const parJour = useMemo(() => {
    const m = new Map<string, RdvSuivi[]>();
    for (const r of visibles.slice(0, limite)) m.set(r.jour, [...(m.get(r.jour) ?? []), r]);
    return [...m.entries()];
  }, [visibles, limite]);

  /// Qualifier, EN MEMOIRE d'abord : la ligne change tout de suite ; si la base
  /// refuse, elle revient a son etat et on dit pourquoi.
  const qualifier = async (r: RdvSuivi, modif: Partial<RdvSuivi>) => {
    if (figee) return;
    const suivant = { ...r, ...modif };
    if (suivant.issue !== 'commande') Object.assign(suivant, { diac: false, stock: false, cs: false, vd: false });
    if (!suivant.stock || suivant.typeVehicule !== 'VN') suivant.vd = false;
    setRdvs((l) => l.map((x) => (x.id === r.id ? suivant : x)));
    if (vue === 'a_traiter') setGardes((g) => new Set(g).add(r.id));
    try {
      await enregistrerSuivi(r.id, suivant);
      setErreur(null);
    } catch (e) {
      setRdvs((l) => l.map((x) => (x.id === r.id ? r : x)));
      setErreur(`${r.client} : ${e instanceof Error ? e.message : 'enregistrement impossible.'}`);
    }
  };

  /// Un trafic naturel saisi PAR ERREUR s'archive (interdit n.1 : pas de
  /// suppression) — il sort du Suivi et des totaux, il reste en base. Seulement
  /// le trafic naturel : un RDV du phoning se retire depuis la saisie.
  const retirer = async (r: RdvSuivi) => {
    if (figee || r.source !== 'showroom') return;
    if (!window.confirm(`Retirer le RDV de trafic naturel « ${r.client} » (${r.vendeur}) ?`)) return;
    try {
      await archiverRdv(r.id);
      setRdvs((l) => l.filter((x) => x.id !== r.id));
      setErreur(null);
    } catch (e) {
      setErreur(`${r.client} : ${e instanceof Error ? e.message : 'retrait impossible.'}`);
    }
  };

  const segVue = useIndicateurGlissant(VUES.findIndex((v) => v.id === vue), VUES.length);

  return (
    <div className="page">
      <div className="app-head enter">
        <h1>Suivi des RDV</h1>
        <select className="select" style={{ width: 'auto', height: 32 }} value={campagneId ?? ''} onChange={(e) => choisir(e.target.value)}>
          {campagnes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.libelle}
              {c.cloturee ? ' — clôturée' : ''}
            </option>
          ))}
        </select>
        <div className="droite">
          <button type="button" className="btn primary" disabled={figee || !campagneId} onClick={() => setFormulaire(true)}>
            <Icone nom="plus" petite /> Trafic naturel
          </button>
        </div>
      </div>

      {figee && <div className="bandeau-v2">Campagne clôturée : le suivi est figé.</div>}
      {erreur && <div className="bandeau-v2 erreur" role="alert">{erreur}</div>}

      <div className="kpis">
        <div className="kpi enter" style={{ ['--i' as string]: 0 }}><span className="l">Planifiés</span><span className="v num">{ind.planifies}</span></div>
        <div className="kpi enter" style={{ ['--i' as string]: 1 }}><span className="l">À traiter</span><span className="v num">{ind.aTraiter}</span></div>
        <div className="kpi enter" style={{ ['--i' as string]: 2 }}>
          <span className="l">Commandes</span>
          <span className="v num">{ind.commandes}</span>
          <span className="faint" style={{ fontSize: 12 }}>
            dont {ind.avecDiac} DIAC · {ind.avecStock} stock · {ind.avecCs} CS · {ind.seches} sèches
          </span>
        </div>
        <div className="kpi accent enter" style={{ ['--i' as string]: 3 }}>
          <span className="l">Taux de transformation</span>
          <span className="v num">{pourcent(ind.tauxTransformation)}</span>
          <span style={{ fontSize: 12, opacity: 0.85 }}>{ind.commandes} commandes sur {ind.traites} traités</span>
        </div>
      </div>

      <div className="suivi-filtres enter" style={{ ['--i' as string]: 4 }}>
        <div className="seg" ref={segVue.conteneur}>
          <span className="pouce" ref={segVue.indicateur} aria-hidden="true" />
          {VUES.map((v, i) => (
            <button key={v.id} type="button" ref={segVue.cible(i)} aria-pressed={v.id === vue} onClick={() => setVue(v.id)}>
              {v.libelle}
            </button>
          ))}
        </div>
        <label className="recherche-v2">
          <Icone nom="recherche" petite />
          <input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Client, vendeur, modèle…" />
        </label>
      </div>

      {!chargement && vue === 'vendeurs' ? (
        <TableauVendeurs rangs={parVendeur} siteDe={siteDe} />
      ) : chargement ? (
        <div style={{ display: 'grid', gap: 8 }}>
          {[0, 1, 2, 3].map((i) => <div key={i} className="skel" style={{ height: 64 }} />)}
        </div>
      ) : parJour.length === 0 ? (
        <div className="empty card">{vue === 'a_traiter' ? 'Tout est traité.' : 'Aucun RDV dans cette vue.'}</div>
      ) : (
        parJour.map(([jour, liste]) => (
          <section key={jour} className="suivi-jour">
            <h2 className="label">{libelleJour(jour)} · {liste.length} RDV</h2>
            {liste.map((r, k) => (
              <LigneSuivi key={r.id} rdv={r} rang={k} figee={figee} sortant={false} qualifier={qualifier} retirer={retirer} />
            ))}
          </section>
        ))
      )}

      {!chargement && vue !== 'vendeurs' && visibles.length > limite && (
        <button type="button" className="btn" style={{ alignSelf: 'center' }} onClick={() => setLimite((l) => l + TRANCHE * 2)}>
          Afficher plus · {visibles.length - limite} restants
        </button>
      )}

      {formulaire && campagneId && (
        <FormulaireTraficNaturel
          campagneId={campagneId}
          fermer={() => setFormulaire(false)}
          apres={async (message) => {
            setFormulaire(false);
            setErreur(null);
            await recharger(campagneId);
            if (message) setErreur(message);
          }}
        />
      )}
    </div>
  );
}

type TriVendeurs = 'classement' | 'taux';

function TableauVendeurs({ rangs, siteDe }: { rangs: RangSuivi[]; siteDe: Map<string, string> }) {
  const [tri, setTri] = useState<TriVendeurs>('classement');
  /// Le taux seul classerait premier un vendeur a 1 commande sur 1 traite. A taux
  /// egal, on garde donc l'ordre du classement (plus de commandes d'abord).
  const lignes = useMemo(
    () =>
      tri === 'classement'
        ? rangs
        : [...rangs].sort((a, b) => (b.tauxTransformation ?? -1) - (a.tauxTransformation ?? -1) || a.rang - b.rang),
    [rangs, tri]
  );
  if (rangs.length === 0) return <div className="empty card">Aucun vendeur.</div>;
  const entete = (cle: TriVendeurs, libelle: string) => (
    <button type="button" className="tri-entete" aria-pressed={tri === cle} onClick={() => setTri(cle)}>
      {libelle}
    </button>
  );
  return (
    <div className="card" style={{ overflowX: 'auto' }}>
      <table className="tbl suivi-vendeurs">
        <thead>
          <tr>
            <th className="r">#</th>
            <th>Vendeur</th>
            <th>Site</th>
            <th className="r">RDV</th>
            <th className="r">Traités</th>
            <th className="r">{entete('classement', 'Commandes')}</th>
            <th className="r">{entete('taux', 'Taux de transfo')}</th>
            <th className="r">À traiter</th>
            <th className="r">Offres</th>
            <th className="r">Annulés</th>
            <th className="r">No show</th>
          </tr>
        </thead>
        <tbody>
          {lignes.map((g) => (
            <tr key={g.cle}>
              <td className="r num faint">{g.rang}</td>
              <td><b>{g.libelle}</b></td>
              <td className="faint">{siteDe.get(g.cle) ?? ''}</td>
              <td className="r num">{g.planifies}</td>
              <td className="r num">{g.traites}</td>
              <td className="r num"><b>{g.commandes}</b></td>
              <td className="r num"><b>{pourcent(g.tauxTransformation)}</b></td>
              <td className="r num">{g.aTraiter}</td>
              <td className="r num">{g.offres}</td>
              <td className="r num">{g.annules}</td>
              <td className="r num">{g.noShows}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LigneSuivi({
  rdv: r,
  rang,
  figee,
  sortant,
  qualifier,
  retirer,
}: {
  rdv: RdvSuivi;
  rang: number;
  figee: boolean;
  sortant: boolean;
  qualifier: (r: RdvSuivi, modif: Partial<RdvSuivi>) => Promise<void>;
  retirer: (r: RdvSuivi) => Promise<void>;
}) {
  const [modele, setModele] = useState(r.modele ?? '');
  useEffect(() => setModele(r.modele ?? ''), [r.modele]);
  const marque = (r.marque ?? '').toLowerCase();

  return (
    <article
      className={`suivi-ligne card enter${sortant ? ' sortant' : ''}`}
      data-issue={r.issue ?? 'a_traiter'}
      style={{ ['--i' as string]: Math.min(rang, 12) }}
    >
      <div className="identite">
        <div className="client">
          {r.client}
          {r.source === 'showroom' && <span className="badge" style={{ ['--c' as string]: 'var(--info)' }}>Trafic naturel</span>}
          {r.source === 'showroom' && !figee && (
            <button type="button" className="btn sm retirer-trafic" onClick={() => void retirer(r)} aria-label={`Retirer ${r.client}`}>
              Retirer
            </button>
          )}
        </div>
        <div className="meta">
          {r.vendeur} · {r.siteCode} · {r.creneau}
          {r.marque && <span className={`marque ${marque.includes('renault') ? 'renault' : marque.includes('dacia') ? 'dacia' : 'alpine'}`}>{r.marque.toUpperCase()}</span>}
        </div>
      </div>

      <input
        className="input modele"
        value={modele}
        disabled={figee}
        placeholder="Modèle"
        onChange={(e) => setModele(e.target.value)}
        onBlur={() => {
          const v = modele.trim() || null;
          if (v !== (r.modele ?? null)) void qualifier(r, { modele: v });
        }}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        aria-label={`Modèle — ${r.client}`}
      />

      <div className="issues" role="radiogroup" aria-label={`Issue — ${r.client}`}>
        {ISSUES_SUIVI.map((i) => (
          <button
            key={i}
            type="button"
            className="issue"
            data-i={i}
            aria-pressed={r.issue === i}
            disabled={figee}
            onClick={() => void qualifier(r, { issue: r.issue === i ? null : i })}
          >
            {LIBELLES_ISSUE[i]}
          </button>
        ))}
      </div>

      {r.issue === 'commande' && (
        // D21 : DIAC / STOCK / CS en commande COMPACTE, integree a la ligne. La
        // commande seche se DEDUIT (D8) : elle s'affiche seule, rien a cocher.
        <div className="avantages" role="group" aria-label="Avantages de la commande">
          {(['diac', 'stock', 'cs'] as const).map((a) => (
            <button
              key={a}
              type="button"
              className="avantage"
              aria-pressed={r[a]}
              disabled={figee}
              onClick={() => void qualifier(r, { [a]: !r[a] })}
            >
              {r[a] && <Icone nom="coche" petite />}
              {a === 'cs' ? 'CS' : a.toUpperCase()}
            </button>
          ))}
          {r.stock && r.typeVehicule === 'VN' && (
            // Un vehicule de demonstration est un stock : la case n'existe qu'ici.
            <button
              type="button"
              className="avantage"
              aria-pressed={r.vd}
              disabled={figee}
              title="Véhicule de démonstration"
              onClick={() => void qualifier(r, { vd: !r.vd })}
            >
              {r.vd && <Icone nom="coche" petite />}
              VD
            </button>
          )}
          {estSeche(r) && <span className="seche">Commande sèche</span>}
        </div>
      )}
    </article>
  );
}

/// « + TRAFIC NATUREL » : un RDV pris hors seance, sur le perimetre de saisie.
/// Les vendeurs, jours, creneaux et marques autorisees viennent de
/// `charger_saisie` — la meme source que la grille, donc les memes refus.
function FormulaireTraficNaturel({
  campagneId,
  fermer,
  apres,
}: {
  campagneId: string;
  fermer: () => void;
  apres: (message?: string) => Promise<void>;
}) {
  const [perimetre, setPerimetre] = useState<PerimetreSaisie | null>(null);
  const [vendeurId, setVendeurId] = useState('');
  const [jour, setJour] = useState('');
  const [creneau, setCreneau] = useState('');
  const [marqueId, setMarqueId] = useState<string>('');
  const [client, setClient] = useState('');
  const [modele, setModele] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const cle = useRef(nouvelleCle());

  useEffect(() => {
    Promise.all([chargerSaisie(campagneId), vendeursDuSuivi(campagneId)])
      .then(([p, miens]) => {
        setPerimetre({ ...p, vendeurs: p.vendeurs.filter((v) => miens.has(v.id)) });
        setJour(p.campagne.jours[0]?.jour ?? '');
        setCreneau(p.campagne.creneaux[0]?.code ?? '');
      })
      .catch((e) => setErreur(e instanceof Error ? e.message : 'Chargement impossible.'));
  }, [campagneId]);

  const vendeur = perimetre?.vendeurs.find((v) => v.id === vendeurId) ?? null;
  useEffect(() => setMarqueId(vendeur?.sections[0]?.marqueId ?? ''), [vendeur]);

  const complet = vendeur && jour && creneau && client.trim() !== '';

  const envoyer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendeur || !complet) return;
    setEnvoi(true);
    setErreur(null);
    try {
      const id = await poserTraficNaturel({
        campagneId,
        vendeurId: vendeur.id,
        typeVehicule: vendeur.typeVehicule,
        jour,
        creneauCode: creneau,
        marqueId: marqueId || null,
        client: client.trim().toUpperCase(),
        cle: cle.current,
      });
      if (modele.trim()) {
        await enregistrerSuivi(id, { issue: null, diac: false, stock: false, cs: false, vd: false, modele: modele.trim(), commentaire: null });
      }
      await apres();
    } catch (err) {
      setErreur(err instanceof Error ? err.message : 'Enregistrement impossible.');
    } finally {
      setEnvoi(false);
    }
  };

  return createPortal(
    <div className="v2">
      <div className="v2-voile" onClick={fermer} />
      <form className="v2-volet verre fort" role="dialog" aria-label="RDV de trafic naturel" onSubmit={envoyer}>
        <h3>RDV de trafic naturel</h3>
        <p className="faint" style={{ margin: '0 0 14px' }}>Suivi comme les autres, hors classement du phoning.</p>
        {!perimetre ? (
          <div className="skel" style={{ height: 160 }} />
        ) : (
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: '1fr 1fr' }}>
            <label className="field" style={{ gridColumn: '1 / -1' }}>
              <span className="label">Vendeur</span>
              <select className="select" value={vendeurId} onChange={(e) => setVendeurId(e.target.value)} autoFocus>
                <option value="">Choisir…</option>
                {perimetre.vendeurs.map((v) => (
                  <option key={v.id} value={v.id}>{v.nom} — {v.siteCode}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="label">Jour</span>
              <select className="select" value={jour} onChange={(e) => setJour(e.target.value)}>
                {perimetre.campagne.jours.map((j) => <option key={j.jour} value={j.jour}>{libelleJour(j.jour)}</option>)}
              </select>
            </label>
            <label className="field">
              <span className="label">Créneau</span>
              <select className="select" value={creneau} onChange={(e) => setCreneau(e.target.value)}>
                {perimetre.campagne.creneaux.map((c) => <option key={c.code} value={c.code}>{c.libelle}</option>)}
              </select>
            </label>
            {vendeur && vendeur.sections.length > 1 && (
              <label className="field" style={{ gridColumn: '1 / -1' }}>
                <span className="label">Marque</span>
                <select className="select" value={marqueId} onChange={(e) => setMarqueId(e.target.value)}>
                  {vendeur.sections.map((s) => <option key={s.marqueId ?? 'vo'} value={s.marqueId ?? ''}>{s.libelle}</option>)}
                </select>
              </label>
            )}
            <label className="field">
              <span className="label">Client</span>
              <input className="input" value={client} onChange={(e) => setClient(e.target.value)} />
            </label>
            <label className="field">
              <span className="label">Modèle</span>
              <input className="input" value={modele} onChange={(e) => setModele(e.target.value)} />
            </label>
          </div>
        )}
        {erreur && <div className="bandeau-v2 erreur" style={{ marginTop: 12 }}>{erreur}</div>}
        <div className="pied">
          <button type="button" className="btn ghost" onClick={fermer}>Annuler</button>
          <button type="submit" className="btn primary" disabled={!complet || envoi}>{envoi ? 'Enregistrement…' : 'Ajouter'}</button>
        </div>
      </form>
    </div>,
    document.body
  );
}
