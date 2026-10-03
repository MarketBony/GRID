import { useCallback, useEffect, useState } from 'react';
import { ErreurApi } from '../services/api';
import {
  chargerCampagne,
  chargerCampagnes,
  creerCampagne,
  enregistrerCreneaux,
  enregistrerJours,
  modifierCampagne,
  modifierSession,
  type CampagneDetail,
  type CampagneResume,
  type ConflitRdv,
  type ImpactCreneau,
  type ImpactJour,
} from '../services/campagnes';
import { useReferentiels } from '../hooks/useReferentiels';
import { chargerSuivi, versLigneSuivi } from '../services/suivi';
import { indicateurs } from '../backend/src/utils/suivi';
import { choisirDansListe, useCampagneCourante } from '../contexts/CampagneContext';
import { useIndicateurGlissant } from '../hooks/useIndicateurGlissant';
import { Icone } from '../components/ui/Icone';
import { Compteur } from '../components/ui/Compteur';

// ============================================================================
// ECRAN A4 — CAMPAGNE (F-A4.1 a F-A4.6)
//
// C'est l'ecran qui doit tenir le critere de recette n.2 : changer les jours
// d'une campagne en moins de 30 secondes, et les 99 plannings suivent. Dans le
// fichier Excel, la meme operation demandait 595 cellules.
//
// Les jours ne sont NI consecutifs NI au nombre de cinq par nature (F-A4.2) :
// la campagne de juin 2026 couvrait un week-end, dimanche compris. D'ou une
// liste de jours ajoutes un par un plutot qu'un intervalle.
//
// R-A.2 vit ici : retirer un jour ou un creneau portant des RDV ouvre un choix
// explicite — annuler, ou deplacer — au lieu de heurter une erreur de contrainte.
// ============================================================================

type Conflit =
  | { type: 'jours'; conflit: ConflitRdv<ImpactJour>; cible: string[] }
  | { type: 'creneaux'; conflit: ConflitRdv<ImpactCreneau>; cible: { code: string; libelle: string }[] };

export function Campagne() {
  // Les modes de session viennent de l'API, jamais d'une constante du front :
  // c'est `backend/src/auth/roles.ts` qui en detient la liste, et la base la
  // contraint par un CHECK verifie au demarrage du serveur.
  const { donnees } = useReferentiels();
  const [liste, setListe] = useState<CampagneResume[]>([]);
  // Meme campagne courante que les autres ecrans : ouvrir l'onglet Campagnes doit
  // montrer celle qu'on regardait, pas la premiere de la liste.
  const { campagneId: idCourant, choisir: setIdCourant } = useCampagneCourante();
  const [detail, setDetail] = useState<CampagneDetail | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);
  const [conflit, setConflit] = useState<Conflit | null>(null);

  const [nouveauJour, setNouveauJour] = useState('');
  const [nouveauCreneau, setNouveauCreneau] = useState('');

  const [listeChargee, setListeChargee] = useState(false);
  const [creation, setCreation] = useState(false);

  const recharger = useCallback(async (id: string) => {
    setDetail(await chargerCampagne(id));
  }, []);

  useEffect(() => {
    chargerCampagnes()
      .then((cs) => {
        setListe(cs);
        setListeChargee(true);
        const retenue = choisirDansListe(cs, idCourant, (l) => l[0]);
        if (retenue) setIdCourant(retenue);
      })
      .catch((e) => setMessage(e instanceof Error ? e.message : 'Chargement impossible.'));
  }, []);

  useEffect(() => {
    if (idCourant) recharger(idCourant).catch((e) => setMessage(String(e)));
  }, [idCourant, recharger]);

  /// D10 : la cloture fige aussi le suivi. On compte ce qui reste « a traiter »
  /// par la MEME fonction pure que la rubrique Suivi — pas un second comptage.
  const [aTraiter, setATraiter] = useState<number | null>(null);
  const [arme, setArme] = useState(false);
  useEffect(() => {
    setATraiter(null);
    setArme(false);
    if (!idCourant) return;
    chargerSuivi(idCourant)
      .then((rdvs) => setATraiter(indicateurs(rdvs.map(versLigneSuivi)).aTraiter))
      .catch(() => setATraiter(null));
  }, [idCourant]);

  // F-A4.1. Le modele est la campagne la plus RECENTE — `chargerCampagnes` trie
  // par date de debut decroissante. Ce que l'ecran annonce est donc exactement ce
  // que la base recopiera : l'identifiant part tel quel dans l'appel.
  const modele = liste[0] ?? null;

  const apresCreation = async (id: string, libelle: string) => {
    const cs = await chargerCampagnes();
    setListe(cs);
    setCreation(false);
    setIdCourant(id);
    setMessage(null);
    setSucces(`Campagne « ${libelle} » creee. Verifier ses jours avant la session.`);
  };

  const formulaireCreation =
    creation && modele ? (
      <FormulaireCreation
        modele={modele}
        onAnnuler={() => setCreation(false)}
        onCreee={(id, libelle) => void apresCreation(id, libelle)}
      />
    ) : null;

  const curseurCampagne = useIndicateurGlissant(
    Math.max(0, liste.findIndex((c) => c.id === idCourant)),
    liste.length,
    'y'
  );

  if (!detail) {
    // Le seul ecran sans campagne a montrer est celui d'une base vide : le seed
    // en pose toujours deux, mais rien ne le garantit en production.
    if (listeChargee && liste.length === 0) {
      return (
        <div className="page">
          <div className="app-head enter">
            <h1>Campagnes</h1>
          </div>
          <div className="bandeau-v2">
            Aucune campagne en base. La creation reprend les creneaux d'une campagne existante :
            il en faut une premiere, posee par le seed.
          </div>
        </div>
      );
    }
    return (
      <div className="page">
        <div className="skel" style={{ height: 40, width: 260 }} />
        <div className="camp-v2">
          <div className="skel" style={{ height: 360 }} />
          <div className="skel" style={{ height: 360 }} />
        </div>
      </div>
    );
  }

  const figee = detail.cloturee;

  const agir = async (action: () => Promise<void>, messageSucces: string) => {
    setMessage(null);
    setSucces(null);
    try {
      await action();
      setSucces(messageSucces);
    } catch (e) {
      if (e instanceof ErreurApi && e.statut === 409) {
        const corps = e.corps as { code?: string } | undefined;
        if (corps?.code === 'RDV_IMPACTES') return; // gere par l'appelant
      }
      setMessage(e instanceof Error ? e.message : 'Operation impossible.');
    }
  };

  // ---------------------------------------------------------------- jours

  const soumettreJours = async (jours: string[], confirmation?: { mode: 'deplacer'; vers: string }) => {
    setMessage(null);
    setSucces(null);
    try {
      const r = await enregistrerJours(detail.id, jours, confirmation);
      setConflit(null);
      await recharger(detail.id);
      setSucces(
        r.rdvDeplaces > 0
          ? `Jours enregistres. ${r.rdvDeplaces} RDV deplace${r.rdvDeplaces > 1 ? 's' : ''}.`
          : 'Jours enregistres.'
      );
    } catch (e) {
      if (e instanceof ErreurApi && e.statut === 409) {
        const corps = e.corps as ConflitRdv<ImpactJour> | undefined;
        if (corps?.code === 'RDV_IMPACTES') {
          setConflit({ type: 'jours', conflit: corps, cible: jours });
          return;
        }
      }
      setMessage(e instanceof Error ? e.message : 'Enregistrement impossible.');
    }
  };

  const ajouterJour = () => {
    if (!nouveauJour) return;
    if (detail.jours.some((j) => j.jour === nouveauJour)) {
      setMessage('Ce jour fait deja partie de la campagne.');
      return;
    }
    const jours = [...detail.jours.map((j) => j.jour), nouveauJour].sort();
    setNouveauJour('');
    void soumettreJours(jours);
  };

  const retirerJour = (jour: string) => {
    if (detail.jours.length === 1) {
      setMessage('Une campagne doit garder au moins un jour.');
      return;
    }
    void soumettreJours(detail.jours.map((j) => j.jour).filter((j) => j !== jour));
  };

  // ---------------------------------------------------------------- creneaux

  const soumettreCreneaux = async (
    creneaux: { code: string; libelle: string }[],
    confirmation?: { mode: 'deplacer'; vers: string }
  ) => {
    setMessage(null);
    setSucces(null);
    try {
      const r = await enregistrerCreneaux(detail.id, creneaux, confirmation);
      setConflit(null);
      await recharger(detail.id);
      setSucces(
        r.rdvDeplaces > 0
          ? `Creneaux enregistres. ${r.rdvDeplaces} RDV deplace${r.rdvDeplaces > 1 ? 's' : ''}.`
          : 'Creneaux enregistres.'
      );
    } catch (e) {
      if (e instanceof ErreurApi && e.statut === 409) {
        const corps = e.corps as ConflitRdv<ImpactCreneau> | undefined;
        if (corps?.code === 'RDV_IMPACTES') {
          setConflit({ type: 'creneaux', conflit: corps, cible: creneaux });
          return;
        }
      }
      setMessage(e instanceof Error ? e.message : 'Enregistrement impossible.');
    }
  };

  const creneauxCourants = () => detail.creneaux.map((c) => ({ code: c.code, libelle: c.libelle }));

  const ajouterCreneau = () => {
    const code = nouveauCreneau.trim();
    if (code === '') return;
    if (detail.creneaux.some((c) => c.code === code)) {
      setMessage('Ce creneau existe deja.');
      return;
    }
    setNouveauCreneau('');
    void soumettreCreneaux([...creneauxCourants(), { code, libelle: libelleDepuisCode(code) }]);
  };

  const deplacerCreneau = (position: number, sens: -1 | 1) => {
    const liste = creneauxCourants();
    const cible = position + sens;
    if (cible < 0 || cible >= liste.length) return;
    [liste[position], liste[cible]] = [liste[cible], liste[position]];
    void soumettreCreneaux(liste);
  };

  const retirerCreneau = (code: string) => {
    if (detail.creneaux.length === 1) {
      setMessage('Une campagne doit garder au moins un creneau.');
      return;
    }
    void soumettreCreneaux(creneauxCourants().filter((c) => c.code !== code));
  };

  return (
    <div className="page">
      <div className="app-head enter">
        <h1>Campagnes</h1>
        <span className="sub">{liste.length} campagne{liste.length > 1 ? 's' : ''}</span>
        <div className="droite">
          {!creation && (
            <button
              type="button"
              className="btn primary"
              onClick={() => {
                setMessage(null);
                setSucces(null);
                setCreation(true);
              }}
            >
              <Icone nom="plus" petite /> Nouvelle campagne
            </button>
          )}
        </div>
      </div>

      {message && <div className="bandeau-v2 erreur" role="alert">{message}</div>}
      {succes && <div className="bandeau-v2 ok" role="status">{succes}</div>}
      {formulaireCreation}

      {conflit && <DialogueConflit conflit={conflit} onAnnuler={() => setConflit(null)} onDeplacer={(vers) => {
        if (conflit.type === 'jours') void soumettreJours(conflit.cible, { mode: 'deplacer', vers });
        else void soumettreCreneaux(conflit.cible, { mode: 'deplacer', vers });
      }} />}

      <div className="camp-v2">
        {/* La liste des campagnes : le curseur glisse d'une campagne a l'autre,
            comme la liste des vendeurs de la saisie. */}
        <aside className="card camp-liste enter" style={{ ['--i' as string]: 1 }}>
          <div className="camp-liste-corps" ref={curseurCampagne.conteneur}>
            <span className="curseur-v2" aria-hidden="true" ref={curseurCampagne.indicateur} />
            {liste.map((c, i) => (
              <button
                key={c.id}
                type="button"
                ref={curseurCampagne.cible(i)}
                className={`camp-item${c.id === idCourant ? ' actif' : ''}`}
                onClick={() => setIdCourant(c.id)}
              >
                <span className="nom">{c.libelle}</span>
                <span className="dates">
                  {formaterCourt(c.dateDebut)} → {formaterCourt(c.dateFin)}
                </span>
                <span className={`etat-point${c.cloturee ? ' fige' : ''}`} title={c.cloturee ? 'Clôturée' : 'Ouverte'} />
              </button>
            ))}
          </div>
        </aside>

        <div className="camp-detail">
          {/* -------------------------------------------------------- en-tete */}
          <section className="card pad camp-hero enter" style={{ ['--i' as string]: 2 }} key={detail.id}>
            <div className="hero-ligne">
              <input
                className="hero-titre"
                aria-label="Libellé de la campagne"
                defaultValue={detail.libelle}
                disabled={figee}
                onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v && v !== detail.libelle) {
                    void agir(
                      () => modifierCampagne(detail.id, { libelle: v }).then(() => recharger(detail.id)),
                      'Libellé enregistré.'
                    );
                  }
                }}
              />
              <span className={`etat-campagne${figee ? ' fige' : ''}`}>
                {figee ? <><Icone nom="cadenas" petite /> Clôturée</> : <><i /> Ouverte</>}
              </span>
            </div>
            <div className="hero-dates">
              <Icone nom="calendrier" petite />
              <span>Du</span>
              <input
                type="date"
                className="input"
                defaultValue={detail.dateDebut.slice(0, 10)}
                disabled={figee}
                onChange={(e) =>
                  e.target.value &&
                  void agir(
                    () => modifierCampagne(detail.id, { dateDebut: e.target.value }).then(() => recharger(detail.id)),
                    'Date de début enregistrée.'
                  )
                }
              />
              <span>au</span>
              <input
                type="date"
                className="input"
                defaultValue={detail.dateFin.slice(0, 10)}
                disabled={figee}
                onChange={(e) =>
                  e.target.value &&
                  void agir(
                    () => modifierCampagne(detail.id, { dateFin: e.target.value }).then(() => recharger(detail.id)),
                    'Date de fin enregistrée.'
                  )
                }
              />
            </div>
            <div className="kpis">
              <div className="kpi accent">
                <span className="l">Jours</span>
                <span className="v"><Compteur valeur={detail.jours.length} /></span>
              </div>
              <div className="kpi">
                <span className="l">Créneaux</span>
                <span className="v"><Compteur valeur={detail.creneaux.length} /></span>
              </div>
              <div className="kpi">
                <span className="l">Cases par vendeur</span>
                <span className="v"><Compteur valeur={detail.jours.length * detail.creneaux.length} /></span>
              </div>
              <div className="kpi">
                <span className="l">Vendeurs saisissables</span>
                <span className="v"><Compteur valeur={detail.vendeursSaisissables} /></span>
              </div>
            </div>
          </section>

          <div className="camp-grille">
            {/* -------------------------------------------------------- jours */}
            <section className="card pad enter" style={{ ['--i' as string]: 3 }}>
              <h3 className="card-titre"><Icone nom="calendrier" petite /> Jours <span className="faint num">{detail.jours.length}</span></h3>
              <div className="tuiles-jours">
                {detail.jours.map((j) => {
                  const d = new Date(`${j.jour.slice(0, 10)}T12:00:00`);
                  return (
                    <div key={j.jour} className="tuile-jour">
                      <span className="jsem">{d.toLocaleDateString('fr-FR', { weekday: 'short' })}</span>
                      <span className="jnum num">{String(d.getDate()).padStart(2, '0')}</span>
                      <span className="jmois">{d.toLocaleDateString('fr-FR', { month: 'short' })}</span>
                      {!figee && (
                        <button type="button" className="tuile-retirer" onClick={() => retirerJour(j.jour)} aria-label={`Retirer ${formaterJour(j.jour)}`}>
                          <Icone nom="fermer" petite />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
              {!figee && (
                <div className="ajout-ligne">
                  <input type="date" className="input" value={nouveauJour} onChange={(e) => setNouveauJour(e.target.value)} />
                  <button type="button" className="btn" onClick={ajouterJour} disabled={!nouveauJour}>
                    <Icone nom="plus" petite /> Ajouter
                  </button>
                </div>
              )}
            </section>

            {/* -------------------------------------------------------- creneaux */}
            <section className="card pad enter" style={{ ['--i' as string]: 4 }}>
              <h3 className="card-titre"><Icone nom="horloge" petite /> Créneaux <span className="faint num">{detail.creneaux.length}</span></h3>
              <ol className="creneaux-v2">
                {detail.creneaux.map((c, i) => (
                  <li key={c.code}>
                    <span className="rang num">{i + 1}</span>
                    <span className="code num">{c.code}</span>
                    {c.libelle !== c.code && <span className="faint">{c.libelle}</span>}
                    {!figee && (
                      <span className="actions">
                        <button type="button" className="icon-btn" onClick={() => deplacerCreneau(i, -1)} disabled={i === 0} aria-label="Monter">
                          <Icone nom="haut" petite />
                        </button>
                        <button type="button" className="icon-btn" onClick={() => deplacerCreneau(i, 1)} disabled={i === detail.creneaux.length - 1} aria-label="Descendre">
                          <Icone nom="bas" petite />
                        </button>
                        <button type="button" className="icon-btn danger" onClick={() => retirerCreneau(c.code)} aria-label="Retirer">
                          <Icone nom="fermer" petite />
                        </button>
                      </span>
                    )}
                  </li>
                ))}
              </ol>
              {!figee && (
                <div className="ajout-ligne">
                  <input
                    className="input"
                    value={nouveauCreneau}
                    onChange={(e) => setNouveauCreneau(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && ajouterCreneau()}
                    placeholder="19:00-20:00"
                    spellCheck={false}
                  />
                  <button type="button" className="btn" onClick={ajouterCreneau} disabled={nouveauCreneau.trim() === ''}>
                    <Icone nom="plus" petite /> Ajouter
                  </button>
                </div>
              )}
            </section>
          </div>

          {/* -------------------------------------------------------- sessions */}
          <section className="card pad enter" style={{ ['--i' as string]: 5 }}>
            <h3 className="card-titre"><Icone nom="effectifs" petite /> Organisation par plaque</h3>
            <div className="plaques-v2">
              {detail.sessions.map((s) => (
                <LignePlaque
                  key={s.id}
                  libelle={s.plaqueLibelle}
                  mode={s.mode}
                  modes={donnees?.modesSession ?? [s.mode]}
                  cible={s.effectifCibleTable}
                  figee={figee}
                  onMode={(mode) =>
                    void agir(
                      () => modifierSession(detail.id, s.id, { mode }).then(() => recharger(detail.id)),
                      `${s.plaqueLibelle} : ${mode.replace('_', ' ')}.`
                    )
                  }
                  onCible={(v) =>
                    void agir(
                      () => modifierSession(detail.id, s.id, { effectifCibleTable: v }).then(() => recharger(detail.id)),
                      `${s.plaqueLibelle} : ${v ?? '—'} vendeurs par table.`
                    )
                  }
                />
              ))}
            </div>
            <p className="note">Passer en « par site » ne supprime aucune table : la composition revient au retour.</p>
          </section>

          {/* -------------------------------------------------------- cloture */}
          <section className={`card pad enter camp-cloture${figee ? ' fige' : ''}`} style={{ ['--i' as string]: 6 }}>
            <div>
              <h3 className="card-titre"><Icone nom="cadenas" petite /> {figee ? 'Campagne clôturée' : 'Clôture'}</h3>
              <p className="note">
                {figee
                  ? 'Jours, créneaux, RDV et suivi sont figés.'
                  : 'Fige la saisie, les jours, les créneaux et le suivi des RDV. Réversible, mais jamais pendant une séance.'}
                {!figee && aTraiter !== null && aTraiter > 0 && (
                  <> <strong className="attention">{aTraiter} RDV encore à traiter dans le suivi.</strong></>
                )}
              </p>
            </div>
            <button
              type="button"
              className={`btn${figee ? '' : arme ? ' danger arme' : ' danger'}`}
              onClick={() => {
                // EN DEUX CLICS quand il reste du suivi a faire (D10) : le second
                // nomme ce qui va etre fige.
                if (!figee && (aTraiter ?? 0) > 0 && !arme) {
                  setArme(true);
                  window.setTimeout(() => setArme(false), 6000);
                  return;
                }
                setArme(false);
                void agir(
                  () => modifierCampagne(detail.id, { cloturee: !figee }).then(() => recharger(detail.id)),
                  figee ? 'Campagne réouverte.' : 'Campagne clôturée.'
                );
              }}
            >
              {figee ? 'Réouvrir' : arme ? `Confirmer — ${aTraiter} RDV ne seront plus suivis` : 'Clôturer la campagne'}
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}

/// Une plaque : son mode en segmente (la pastille glisse comme partout) et la
/// cible par table en pas-a-pas — un composant pour que chaque ligne ait son
/// propre indicateur.
function LignePlaque({
  libelle,
  mode,
  modes,
  cible,
  figee,
  onMode,
  onCible,
}: {
  libelle: string;
  mode: string;
  modes: string[];
  cible: number | null;
  figee: boolean;
  onMode: (m: string) => void;
  onCible: (v: number | null) => void;
}) {
  const seg = useIndicateurGlissant(Math.max(0, modes.indexOf(mode)), modes.length);
  const parTable = mode === 'par_table';
  return (
    <div className="plaque-v2">
      <span className="plaque-nom">{libelle}</span>
      <div className="seg" ref={seg.conteneur} role="radiogroup" aria-label={`Mode de ${libelle}`}>
        <span className="pouce" ref={seg.indicateur} aria-hidden="true" />
        {modes.map((m, i) => (
          <button key={m} type="button" ref={seg.cible(i)} aria-pressed={m === mode} disabled={figee} onClick={() => m !== mode && onMode(m)}>
            {m === 'par_table' ? 'Par table' : m === 'par_site' ? 'Par site' : m.replace('_', ' ')}
          </button>
        ))}
      </div>
      <div className={`pas-a-pas${parTable ? '' : ' eteint'}`} title="Vendeurs visés par table">
        <button type="button" className="icon-btn" disabled={figee || !parTable || (cible ?? 1) <= 1} onClick={() => onCible(Math.max(1, (cible ?? 5) - 1))} aria-label="Moins">
          <Icone nom="bas" petite />
        </button>
        <span className="num"><Compteur valeur={cible ?? 0} /></span>
        <button type="button" className="icon-btn" disabled={figee || !parTable} onClick={() => onCible((cible ?? 4) + 1)} aria-label="Plus">
          <Icone nom="haut" petite />
        </button>
        <span className="faint">/ table</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- F-A4.1

function FormulaireCreation({
  modele,
  onAnnuler,
  onCreee,
}: {
  modele: CampagneResume;
  onAnnuler: () => void;
  onCreee: (id: string, libelle: string) => void;
}) {
  const [libelle, setLibelle] = useState('');
  const [debut, setDebut] = useState('');
  const [fin, setFin] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const pret = libelle.trim() !== '' && debut !== '' && fin !== '' && fin >= debut && !enCours;

  const creer = async () => {
    setEnCours(true);
    setErreur(null);
    try {
      const id = await creerCampagne(libelle.trim(), debut, fin, modele.id);
      onCreee(id, libelle.trim());
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Creation impossible.');
      setEnCours(false);
    }
  };

  return (
    <div className="card pad carte-action enter">
      <h3 className="card-titre"><Icone nom="plus" petite /> Nouvelle campagne</h3>
      {erreur && <div className="bandeau-v2 erreur">{erreur}</div>}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (pret) void creer();
        }}
      >
        <div className="champs-v2">
          <label className="field large">
            <span className="lbl">Libellé</span>
            <input className="input" value={libelle} onChange={(e) => setLibelle(e.target.value)} placeholder="Novembre 2026" autoFocus />
          </label>
          <label className="field">
            <span className="lbl">Début</span>
            <input className="input" type="date" value={debut} onChange={(e) => setDebut(e.target.value)} />
          </label>
          <label className="field">
            <span className="lbl">Fin</span>
            <input className="input" type="date" value={fin} min={debut || undefined} onChange={(e) => setFin(e.target.value)} />
          </label>
        </div>
        <p className="note">
          Un jour par date du début à la fin, à ajuster ensuite. Créneaux et mode par plaque repris
          de « {modele.libelle} ». Les tables se composent dans Effectifs.
        </p>
        <div className="actions-v2">
          <button type="button" className="btn ghost" onClick={onAnnuler} disabled={enCours}>Annuler</button>
          <button type="submit" className="btn primary" disabled={!pret}>
            {enCours ? 'Création…' : 'Créer la campagne'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------- R-A.2

function DialogueConflit({
  conflit,
  onAnnuler,
  onDeplacer,
}: {
  conflit: Conflit;
  onAnnuler: () => void;
  onDeplacer: (vers: string) => void;
}) {
  const destinations =
    conflit.type === 'jours'
      ? (conflit.conflit.joursConserves ?? [])
      : (conflit.conflit.creneauxConserves ?? []);
  const [vers, setVers] = useState(destinations[0] ?? '');

  const totalActifs = conflit.conflit.impacts.reduce((n, i) => n + i.actifs, 0);
  const totalArchives = conflit.conflit.impacts.reduce((n, i) => n + i.archives, 0);

  return (
    <div className="card pad carte-action conflit-v2 enter" role="alertdialog">
      <h3 className="card-titre">Des RDV sont rattachés à ce que vous retirez</h3>

      <ul className="impacts-v2">
        {conflit.conflit.impacts.map((i) => (
          <li key={'jour' in i ? i.jour : i.creneau}>
            <strong>{'jour' in i ? formaterJour(i.jour) : i.creneau}</strong> —{' '}
            {i.actifs > 0 && `${i.actifs} RDV`}
            {i.actifs > 0 && i.archives > 0 && ', '}
            {i.archives > 0 && `${i.archives} archive${i.archives > 1 ? 's' : ''}`}
            {i.vendeurs.length > 0 && <span className="note"> ({i.vendeurs.join(', ')})</span>}
          </li>
        ))}
      </ul>

      {totalArchives > 0 && (
        <p className="note">
          Les {totalArchives} RDV archive{totalArchives > 1 ? 's' : ''} comptent aussi : ils restent
          rattaches au jour, donc ils seront deplaces avec les autres. Ils ne reapparaitront pas
          dans les totaux pour autant.
        </p>
      )}

      <div className="actions-v2">
        <label className="field">
          <span className="lbl">Déplacer les {totalActifs + totalArchives} RDV vers</span>
          <select className="select" value={vers} onChange={(e) => setVers(e.target.value)}>
            {destinations.map((d) => (
              <option key={d} value={d}>
                {conflit.type === 'jours' ? formaterJour(d) : d}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="btn ghost" onClick={onAnnuler}>Annuler</button>
        <button type="button" className="btn primary" onClick={() => onDeplacer(vers)} disabled={!vers}>
          Déplacer et enregistrer
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- utilitaires

/// JJ/MM/AAAA, convention du projet.
const formaterJour = (iso: string): string => {
  const [a, m, j] = iso.slice(0, 10).split('-');
  const jours = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  const nom = jours[new Date(`${iso.slice(0, 10)}T12:00:00Z`).getUTCDay()];
  return `${nom} ${j}/${m}/${a}`;
};

/// `09:00-10:00` -> `9h-10h`, comme dans le fichier source. Si le code ne suit
/// pas ce motif, on le garde tel quel : le libelle est libre.
const formaterCourt = (iso: string): string => {
  const [a, m, j] = iso.slice(0, 10).split('-');
  return `${j}/${m}/${a.slice(2)}`;
};

const libelleDepuisCode = (code: string): string => {
  const m = code.match(/^(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$/);
  if (!m) return code;
  return `${Number(m[1])}h-${Number(m[3])}h`;
};
