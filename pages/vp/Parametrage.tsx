import { useEffect, useMemo, useState } from 'react';
import { useIndicateurGlissant } from '../../hooks/useIndicateurGlissant';
import { chargerCampagne, chargerCampagnes, enregistrerCreneaux, enregistrerJours, type CreneauCampagne } from '../../services/campagnes';
import { supabase, txt, verifier } from '../../services/supabase';
import {
  cloturerVp,
  creerVp,
  modifierVp,
  poserMobilisation,
  type DonneesVp,
  type VendeurDeVp,
  type VpResume,
} from '../../services/vp';
import { Dialogue } from './Accueil';
import { decaler, heureCreneau, isoLocal, jj, jjmmaaaa, jourLong, moisAnnee, nomDuJour } from './commun';

// ============================================================================
// LE PARAMETRAGE DES VP — admin SEUL (`ROLES_GESTION_VP`, decision du
// 20/10/2026 : le marketing et l'encadrant VP sont des comptes admin). Cacher cet
// onglet n'est qu'un confort : la base refuse toute preparation d'une VP a qui
// n'est pas admin (`verifier_preparation_vp`).
//
// Les creneaux proposes sont ceux de la derniere OPERATION de GRID classique :
// ce sont des donnees (interdit n.3), on ne les ecrit pas ici.
// ============================================================================

interface Site {
  id: string;
  libelle: string;
  plaque: string;
  plaqueOrdre: number;
}

async function chargerSites(): Promise<Site[]> {
  const r = await supabase.from('site').select('id, libelle, plaque(libelle, ordre)').is('archive_le', null).order('libelle');
  return (verifier(r) as unknown as { id: number; libelle: string; plaque: { libelle: string; ordre: number } | null }[]).map((s) => ({
    id: txt(s.id),
    libelle: s.libelle,
    plaque: s.plaque?.libelle ?? '',
    plaqueOrdre: s.plaque?.ordre ?? 0,
  }));
}

const libelleAuto = (site: string, jour: string) => `VP ${site} · ${moisAnnee(jour)}`;

interface Props {
  vps: VpResume[];
  vp: VpResume | null;
  donnees: DonneesVp | null;
  choisir: (id: string) => void;
  rechargerListe: (retenir?: string) => Promise<void>;
  recharger: () => Promise<void>;
}

export function Parametrage({ vps, vp, donnees, choisir, rechargerListe, recharger }: Props) {
  const [creation, setCreation] = useState(false);
  const [reference, setReference] = useState<{ id: string; creneaux: CreneauCampagne[] } | null>(null);
  useEffect(() => {
    // La campagne MODELE : la plus recente des operations. C'est d'elle que
    // `vp_creer` reprend les creneaux, et d'elle que viennent les creneaux
    // proposes a l'ajout.
    void chargerCampagnes('operation')
      .then(async (l) => (l[0] ? setReference({ id: l[0].id, creneaux: (await chargerCampagne(l[0].id)).creneaux }) : null))
      .catch(() => setReference(null));
  }, []);

  const ordonnees = useMemo(() => [...vps].sort((a, b) => b.jour.localeCompare(a.jour)), [vps]);
  const actif = Math.max(0, ordonnees.findIndex((x) => x.id === vp?.id));
  const curseur = useIndicateurGlissant(actif, ordonnees.length, 'y');

  return (
    <div className="page vp-page">
      <section className="vp-ecran actif">
        <div className="app-head">
          <h2>Paramétrage</h2>
          <span className="sub">{vps.length} VP</span>
          <div className="droite">
            <button type="button" className="btn primary" onClick={() => setCreation(true)} disabled={!reference}>
              + Nouvelle VP
            </button>
          </div>
        </div>

        {vps.length === 0 ? (
          <div className="card empty">Aucune vente privée. Créez la première pour bloquer ses dates.</div>
        ) : (
          <div className="vp-param">
            <div className="card vp-param-liste">
              <div className="liste-corps" ref={curseur.conteneur}>
                <span className="curseur-v2" ref={curseur.indicateur} aria-hidden="true" />
                {ordonnees.map((x, i) => (
                  <button
                    key={x.id}
                    ref={curseur.cible(i)}
                    type="button"
                    className={`vendeur-v2${x.id === vp?.id ? ' actif' : ''}`}
                    onClick={() => choisir(x.id)}
                  >
                    <span className="nom">{x.siteLibelle}</span>
                    <span className="site">{jj(x.phoningDu)} → {jjmmaaaa(x.jour)}</span>
                    <span className="n">
                      <span className="badge" style={{ '--c': x.cloturee ? 'var(--text-3)' : 'var(--ok)' } as React.CSSProperties}>
                        {x.cloturee ? 'Close' : 'Ouverte'}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <div className="card pad vp-param-detail">
              {vp && donnees && donnees.vp.id === vp.id ? (
                <Detail vp={vp} donnees={donnees} vps={vps} reference={reference} rechargerListe={rechargerListe} recharger={recharger} />
              ) : (
                <div className="skel" style={{ height: 320 }} />
              )}
            </div>
          </div>
        )}
      </section>

      {creation && reference && (
        <NouvelleVp
          vps={vps}
          modeleId={reference.id}
          fermer={() => setCreation(false)}
          creee={async (id) => {
            setCreation(false);
            await rechargerListe(id);
          }}
        />
      )}
    </div>
  );
}

function Detail({
  vp,
  donnees,
  vps,
  reference,
  rechargerListe,
  recharger,
}: {
  vp: VpResume;
  donnees: DonneesVp;
  vps: VpResume[];
  reference: { id: string; creneaux: CreneauCampagne[] } | null;
  rechargerListe: (retenir?: string) => Promise<void>;
  recharger: () => Promise<void>;
}) {
  const fige = vp.cloturee;
  const [libelle, setLibelle] = useState(vp.libelle);
  const [dates, setDates] = useState({ du: vp.phoningDu, au: vp.phoningAu, jour: vp.jour });
  const [message, setMessage] = useState<string | null>(null);
  const [tous, setTous] = useState(10);
  const [cloture, setCloture] = useState(false);
  useEffect(() => {
    setLibelle(vp.libelle);
    setDates({ du: vp.phoningDu, au: vp.phoningAu, jour: vp.jour });
    setMessage(null);
  }, [vp]);

  const faire = async (f: () => Promise<unknown>, liste = false) => {
    setMessage(null);
    try {
      await f();
      if (liste) await rechargerListe(vp.id);
      await recharger();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'L’enregistrement a échoué.');
    }
  };

  const ordreOk = dates.du <= dates.au && dates.au < dates.jour;
  const enregistrerDates = (d: typeof dates) => {
    setDates(d);
    if (!(d.du <= d.au && d.au < d.jour)) return;
    void faire(async () => {
      await modifierVp(vp.id, { phoningDu: d.du, phoningAu: d.au, jour: d.jour });
      // Le jour des RDV est l'unique `campagne_jour` : en changer DEPLACE les RDV
      // deja poses vers le nouveau jour (`campagne_definir_jours`).
      if (d.jour !== vp.jour) await enregistrerJours(vp.id, [d.jour], { mode: 'deplacer', vers: d.jour });
    }, true);
  };

  const autres = vps.filter((x) => x.id !== vp.id && x.siteId === vp.siteId && !x.cloturee);

  // Les creneaux : ceux de la VP, plus ceux de la reference qu'elle n'a pas.
  const proposes = useMemo(() => {
    const m = new Map<string, { code: string; libelle: string }>();
    for (const c of reference?.creneaux ?? []) m.set(c.code, { code: c.code, libelle: c.libelle });
    for (const c of donnees.creneaux) m.set(c.code, { code: c.code, libelle: c.libelle });
    return [...m.values()].sort((a, b) => a.code.localeCompare(b.code));
  }, [reference, donnees.creneaux]);
  const retenus = new Set(donnees.creneaux.map((c) => c.code));
  const basculerCreneau = (code: string) => {
    const nouveaux = proposes.filter((c) => (c.code === code ? !retenus.has(code) : retenus.has(c.code)));
    if (nouveaux.length === 0) return setMessage('Une VP garde au moins un créneau.');
    void faire(async () => {
      try {
        await enregistrerCreneaux(vp.id, nouveaux);
      } catch (e) {
        const n = donnees.rdvs.filter((r) => r.creneauCode === code).length;
        throw n > 0 ? new Error(`${n} RDV posé${n > 1 ? 's' : ''} à ${heureCreneau(code)} : déplace-les avant de retirer ce créneau.`) : e;
      }
    });
  };

  const presents = donnees.vendeurs.filter((v) => v.mobilise !== false);
  const objectifTotal = presents.reduce((s, v) => s + (v.objectifRdv ?? 0), 0);
  const poser = (v: VendeurDeVp, champs: Partial<{ mobilise: boolean; motif: string | null; objectifRdv: number | null }>) =>
    faire(() =>
      poserMobilisation(vp.id, v.id, {
        mobilise: champs.mobilise ?? v.mobilise !== false,
        motif: champs.motif !== undefined ? champs.motif : v.motif,
        objectifRdv: champs.objectifRdv !== undefined ? champs.objectifRdv : v.objectifRdv,
      })
    );
  const offres = donnees.rdvs.filter((r) => r.issue === 'offre_en_cours').length;

  return (
    <>
      <div className="entete-vp">
        <input
          className="input"
          value={libelle}
          disabled={fige}
          aria-label="Libellé de la VP"
          onChange={(e) => setLibelle(e.target.value)}
          onBlur={() => libelle.trim() && libelle.trim() !== vp.libelle && void faire(() => modifierVp(vp.id, { libelle: libelle.trim() }), true)}
        />
        <span className="badge" style={{ '--c': fige ? 'var(--text-3)' : 'var(--ok)' } as React.CSSProperties}>
          {fige ? 'Close' : 'Ouverte'}
        </span>
      </div>
      {message && <div className="vp-alerte" role="alert">{message}</div>}

      <section>
        <div className="label">Dates</div>
        <div className="vp-tuiles">
          {(
            [
              ['du', 'J1', 'phoning'],
              ['au', 'J2', 'phoning'],
              ['jour', 'J3', 'vente privée'],
            ] as const
          ).map(([cle, j, quoi]) => (
            <label key={cle} className={`vp-tuile${cle === 'jour' ? ' vp-jour' : ''}`}>
              <span className="label">
                {j} <span>{quoi}</span>
              </span>
              <input className="input" type="date" value={dates[cle]} disabled={fige} onChange={(e) => e.target.value && enregistrerDates({ ...dates, [cle]: e.target.value })} />
              <small>
                {nomDuJour(dates[cle])}
                {cle === 'jour' && ' · le jour des RDV'}
              </small>
            </label>
          ))}
        </div>
        {!ordreOk && <div className="vp-alerte">Les deux jours de phoning doivent précéder le jour de la VP, dans l’ordre. Rien n’est enregistré tant que ce n’est pas le cas.</div>}
        {autres.length > 0 && <div className="vp-alerte">{vp.siteLibelle} a déjà une autre VP ouverte : {autres.map((x) => jjmmaaaa(x.jour)).join(', ')}.</div>}
      </section>

      <section>
        <div className="label">
          Créneaux du {jj(vp.jour)} <span className="faint" style={{ textTransform: 'none', letterSpacing: 0 }}>· un RDV dure 1 h</span>
        </div>
        <div className="vp-cases">
          {proposes.map((c) => (
            <button key={c.code} type="button" className="chip" aria-pressed={retenus.has(c.code)} disabled={fige} onClick={() => basculerCreneau(c.code)}>
              {heureCreneau(c.code)}
            </button>
          ))}
        </div>
      </section>

      <section>
        <div className="label">
          Vendeurs de {vp.siteLibelle}{' '}
          <span className="faint" style={{ textTransform: 'none', letterSpacing: 0 }}>
            · {presents.length} présents sur {donnees.vendeurs.length} · objectif {objectifTotal} RDV
          </span>
        </div>
        {!fige && (
          <div className="vp-tous">
            Objectif pour tous
            <span className="vp-pas">
              <button type="button" onClick={() => setTous((n) => Math.max(0, n - 1))} aria-label="Moins">−</button>
              <output>{tous}</output>
              <button type="button" onClick={() => setTous((n) => n + 1)} aria-label="Plus">+</button>
            </span>
            <button
              type="button"
              className="btn sm"
              onClick={() =>
                void faire(() => Promise.all(presents.map((v) => poserMobilisation(vp.id, v.id, { mobilise: true, motif: null, objectifRdv: tous }))))
              }
            >
              Appliquer aux présents
            </button>
          </div>
        )}
        {donnees.vendeurs.length === 0 && <div className="faint">Aucun vendeur actif sur ce site à cette date.</div>}
        <div className="vp-equipe">
          {donnees.vendeurs.map((v) => {
            const present = v.mobilise !== false;
            const nRdv = donnees.rdvs.filter((r) => r.vendeurId === v.id).length;
            return (
              <div key={v.id} className={`ligne-v${present ? '' : ' absent'}`}>
                <button type="button" className="chip present" aria-pressed={present} disabled={fige} onClick={() => void poser(v, { mobilise: !present })}>
                  {present ? 'Présent' : 'Absent'}
                </button>
                <span className="qui">
                  <b>{v.nom}</b>
                  <small>
                    {v.typeVehicule}
                    {v.marques.length > 0 && ` · ${v.marques.map((m) => m.libelle).join(' / ')}`}
                    {nRdv > 0 && ` · ${nRdv} RDV`}
                    {!present && nRdv > 0 && ' · reste compté'}
                  </small>
                </span>
                <span className="vp-pas" title="Objectif de RDV">
                  <button type="button" disabled={fige || !present} aria-label="Moins" onClick={() => void poser(v, { objectifRdv: Math.max(0, (v.objectifRdv ?? 0) - 1) })}>
                    −
                  </button>
                  <output>{present ? (v.objectifRdv ?? '—') : '—'}</output>
                  <button type="button" disabled={fige || !present} aria-label="Plus" onClick={() => void poser(v, { objectifRdv: (v.objectifRdv ?? 0) + 1 })}>
                    +
                  </button>
                </span>
                <span className="motif">
                  {!present && (
                    <input
                      className="input sm"
                      placeholder="Motif (facultatif)"
                      defaultValue={v.motif ?? ''}
                      disabled={fige}
                      onBlur={(e) => e.target.value !== (v.motif ?? '') && void poser(v, { motif: e.target.value || null })}
                    />
                  )}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <div className="vp-cloture">
          {fige ? (
            <p><b>VP close.</b> Saisie, accueil et suivi sont figés ; le bilan est définitif.</p>
          ) : (
            <>
              <p>
                <b>Clôturer</b> fige la saisie, l’accueil et le suivi. Les offres conclues après le {jj(vp.jour)} comptent dans le bilan : on clôture une fois
                qu’elles sont saisies dans le Suivi.
              </p>
              <button type="button" className="btn danger" onClick={() => setCloture(true)}>
                Clôturer la VP…
              </button>
            </>
          )}
        </div>
      </section>

      {cloture && (
        <Dialogue fermer={() => setCloture(false)}>
          <h2>Clôturer VP · {vp.siteLibelle}</h2>
          <p className="muted" style={{ margin: 0 }}>
            La saisie, l’accueil et le suivi seront figés.
            {offres > 0 && ` ${offres} offre${offres > 1 ? 's' : ''} en cours n’${offres > 1 ? 'ont' : 'a'} pas encore d’issue : une commande conclue après la clôture ne comptera pas.`}
          </p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" className="btn" onClick={() => setCloture(false)}>
              Pas encore
            </button>
            <button type="button" className="btn primary" onClick={() => void faire(() => cloturerVp(vp.id), true).then(() => setCloture(false))}>
              Clôturer
            </button>
          </div>
        </Dialogue>
      )}
    </>
  );
}

function NouvelleVp({
  vps,
  modeleId,
  fermer,
  creee,
}: {
  vps: VpResume[];
  modeleId: string;
  fermer: () => void;
  creee: (id: string) => Promise<void>;
}) {
  const [sites, setSites] = useState<Site[]>([]);
  const [siteId, setSiteId] = useState('');
  const [jour, setJour] = useState(() => decaler(isoLocal(new Date()), 14));
  const [du, setDu] = useState(() => decaler(decaler(isoLocal(new Date()), 14), -2));
  const [au, setAu] = useState(() => decaler(decaler(isoLocal(new Date()), 14), -1));
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  useEffect(() => {
    void chargerSites().then((l) => {
      setSites(l);
      setSiteId((s) => s || l[0]?.id || '');
    });
  }, []);
  const site = sites.find((s) => s.id === siteId);
  const plaques = [...new Map(sites.map((s) => [s.plaque, s.plaqueOrdre])).entries()].sort((a, b) => a[1] - b[1]).map(([p]) => p);
  const deja = vps.filter((x) => x.siteId === siteId && !x.cloturee);
  const ordreOk = du <= au && au < jour;

  const changerJour = (j: string) => {
    setJour(j);
    // J1 et J2 suivent : les deux jours qui precedent. Modifiables ensuite.
    setDu(decaler(j, -2));
    setAu(decaler(j, -1));
  };

  return (
    <Dialogue fermer={fermer}>
      <h2>Nouvelle VP</h2>
      <label className="field">
        <span className="label">Site</span>
        <select className="select" value={siteId} onChange={(e) => setSiteId(e.target.value)}>
          {plaques.map((p) => (
            <optgroup key={p} label={p}>
              {sites.filter((s) => s.plaque === p).map((s) => (
                <option key={s.id} value={s.id}>{s.libelle}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>
      <label className="field">
        <span className="label">Jour de la vente privée (J3)</span>
        <input className="input" type="date" value={jour} onChange={(e) => e.target.value && changerJour(e.target.value)} />
      </label>
      <div className="vp-tuiles" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
        <label className="vp-tuile">
          <span className="label">J1 <span>phoning</span></span>
          <input className="input" type="date" value={du} onChange={(e) => e.target.value && setDu(e.target.value)} />
          <small>{nomDuJour(du)}</small>
        </label>
        <label className="vp-tuile">
          <span className="label">J2 <span>phoning</span></span>
          <input className="input" type="date" value={au} onChange={(e) => e.target.value && setAu(e.target.value)} />
          <small>{nomDuJour(au)}</small>
        </label>
      </div>
      <div className="muted">
        {site ? `${libelleAuto(site.libelle, jour)} — vente privée le ${jourLong(jour)}. ` : ''}Créneaux de GRID classique, vendeurs du site tous présents ; les
        objectifs se posent ensuite.
      </div>
      {!ordreOk && <div className="vp-alerte">Les deux jours de phoning doivent précéder le jour de la VP, dans l’ordre.</div>}
      {deja.length > 0 && site && <div className="vp-alerte">{site.libelle} a déjà une VP ouverte ({deja.map((x) => jjmmaaaa(x.jour)).join(', ')}).</div>}
      {erreur && <div className="vp-alerte" role="alert">{erreur}</div>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button type="button" className="btn" onClick={fermer}>
          Annuler
        </button>
        <button
          type="button"
          className="btn primary"
          disabled={!site || !ordreOk || envoi}
          onClick={() => {
            if (!site) return;
            setEnvoi(true);
            setErreur(null);
            void creerVp({ libelle: libelleAuto(site.libelle, jour), siteId: site.id, jour, phoningDu: du, phoningAu: au, modeleId })
              .then(creee)
              .catch((e) => setErreur(e instanceof Error ? e.message : 'Création impossible.'))
              .finally(() => setEnvoi(false));
          }}
        >
          Créer la VP
        </button>
      </div>
    </Dialogue>
  );
}
