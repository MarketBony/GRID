import { useCallback, useEffect, useState } from 'react';
import { ErreurApi } from '../services/api';
import {
  chargerCampagne,
  chargerCampagnes,
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
import { choisirDansListe, useCampagneCourante } from '../contexts/CampagneContext';

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

  const recharger = useCallback(async (id: string) => {
    setDetail(await chargerCampagne(id));
  }, []);

  useEffect(() => {
    chargerCampagnes()
      .then((cs) => {
        setListe(cs);
        const retenue = choisirDansListe(cs, idCourant, (l) => l[0]);
        if (retenue) setIdCourant(retenue);
      })
      .catch((e) => setMessage(e instanceof Error ? e.message : 'Chargement impossible.'));
  }, []);

  useEffect(() => {
    if (idCourant) recharger(idCourant).catch((e) => setMessage(String(e)));
  }, [idCourant, recharger]);

  if (!detail) return <div className="attente">Chargement de la campagne...</div>;

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
    <section className="ecran">
      <header className="ecran-entete">
        <div>
          <h2>Campagnes</h2>
          <p className="note">
            Les jours ne sont ni consecutifs ni au nombre de cinq par nature : ils s'ajoutent un
            par un. Les creneaux sont une liste ordonnee de longueur libre.
          </p>
        </div>
        <select value={idCourant ?? ''} onChange={(e) => setIdCourant(e.target.value)}>
          {liste.map((c) => (
            <option key={c.id} value={c.id}>
              {c.libelle}
              {c.cloturee ? ' (cloturee)' : ''}
            </option>
          ))}
        </select>
      </header>

      {message && <div className="erreur-bloc">{message}</div>}
      {succes && <div className="succes-bloc">{succes}</div>}
      {figee && (
        <div className="erreur-bloc">
          Campagne cloturee : ses jours, ses creneaux et ses RDV sont figes. C'est ce qui garantit
          qu'un dashboard de campagne passee ne bougera plus.
        </div>
      )}

      {conflit && <DialogueConflit conflit={conflit} onAnnuler={() => setConflit(null)} onDeplacer={(vers) => {
        if (conflit.type === 'jours') void soumettreJours(conflit.cible, { mode: 'deplacer', vers });
        else void soumettreCreneaux(conflit.cible, { mode: 'deplacer', vers });
      }} />}

      {/* -------------------------------------------------------- identite */}
      <div className="carte">
        <h3>Identite</h3>
        <div className="champs">
          <label>
            Libelle
            <input
              defaultValue={detail.libelle}
              disabled={figee}
              onBlur={(e) => {
                if (e.target.value.trim() && e.target.value !== detail.libelle) {
                  void agir(
                    () => modifierCampagne(detail.id, { libelle: e.target.value.trim() }).then(() => recharger(detail.id)),
                    'Libelle enregistre.'
                  );
                }
              }}
            />
          </label>
          <label>
            Debut
            <input
              type="date"
              defaultValue={detail.dateDebut.slice(0, 10)}
              disabled={figee}
              onChange={(e) =>
                e.target.value &&
                void agir(
                  () => modifierCampagne(detail.id, { dateDebut: e.target.value }).then(() => recharger(detail.id)),
                  'Date de debut enregistree.'
                )
              }
            />
          </label>
          <label>
            Fin
            <input
              type="date"
              defaultValue={detail.dateFin.slice(0, 10)}
              disabled={figee}
              onChange={(e) =>
                e.target.value &&
                void agir(
                  () => modifierCampagne(detail.id, { dateFin: e.target.value }).then(() => recharger(detail.id)),
                  'Date de fin enregistree.'
                )
              }
            />
          </label>
        </div>
      </div>

      {/* -------------------------------------------------------- jours */}
      <div className="carte">
        <h3>Jours retenus ({detail.jours.length})</h3>
        <ul className="puces">
          {detail.jours.map((j) => (
            <li key={j.jour}>
              <span>{formaterJour(j.jour)}</span>
              {!figee && (
                <button type="button" className="retirer" onClick={() => retirerJour(j.jour)} aria-label={`Retirer ${j.jour}`}>
                  x
                </button>
              )}
            </li>
          ))}
        </ul>
        {!figee && (
          <div className="ajout">
            <input type="date" value={nouveauJour} onChange={(e) => setNouveauJour(e.target.value)} />
            <button type="button" className="principal" onClick={ajouterJour} disabled={!nouveauJour}>
              Ajouter ce jour
            </button>
          </div>
        )}
      </div>

      {/* -------------------------------------------------------- creneaux */}
      <div className="carte">
        <h3>Creneaux ({detail.creneaux.length})</h3>
        <ol className="liste-creneaux">
          {detail.creneaux.map((c, i) => (
            <li key={c.code}>
              <span className="code">{c.code}</span>
              <span className="libelle">{c.libelle}</span>
              {!figee && (
                <span className="actions-ligne">
                  <button type="button" onClick={() => deplacerCreneau(i, -1)} disabled={i === 0} aria-label="Monter">
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => deplacerCreneau(i, 1)}
                    disabled={i === detail.creneaux.length - 1}
                    aria-label="Descendre"
                  >
                    ↓
                  </button>
                  <button type="button" className="retirer" onClick={() => retirerCreneau(c.code)} aria-label="Retirer">
                    x
                  </button>
                </span>
              )}
            </li>
          ))}
        </ol>
        {!figee && (
          <div className="ajout">
            <input
              value={nouveauCreneau}
              onChange={(e) => setNouveauCreneau(e.target.value)}
              placeholder="19:00-20:00"
              spellCheck={false}
            />
            <button
              type="button"
              className="principal"
              onClick={ajouterCreneau}
              disabled={nouveauCreneau.trim() === ''}
            >
              Ajouter ce creneau
            </button>
          </div>
        )}
      </div>

      {/* -------------------------------------------------------- sessions */}
      <div className="carte">
        <h3>Mode d'organisation par plaque</h3>
        <p className="note">
          Le mode appartient a la session, pas a la plaque : CENTRE et SUD ont utilise des tables
          en juin, NORD et SUD-OUEST non, et rien n'oblige septembre a faire pareil. Basculer en
          « par site » ne supprime aucune table — la composition reste et se retrouve au retour.
        </p>
        <table className="tableau">
          <thead>
            <tr>
              <th>Plaque</th>
              <th>Mode</th>
              <th>Effectif cible par table</th>
            </tr>
          </thead>
          <tbody>
            {detail.sessions.map((s) => (
              <tr key={s.id}>
                <td>{s.plaqueLibelle}</td>
                <td>
                  <select
                    value={s.mode}
                    disabled={figee}
                    onChange={(e) =>
                      void agir(
                        () => modifierSession(detail.id, s.id, { mode: e.target.value }).then(() => recharger(detail.id)),
                        `${s.plaqueLibelle} : mode enregistre.`
                      )
                    }
                  >
                    {(donnees?.modesSession ?? [s.mode]).map((m) => (
                      <option key={m} value={m}>
                        {m.replace('_', ' ')}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <input
                    type="number"
                    min={1}
                    defaultValue={s.effectifCibleTable ?? ''}
                    disabled={figee || s.mode !== 'par_table'}
                    onBlur={(e) => {
                      const v = e.target.value === '' ? null : Number(e.target.value);
                      if (v !== s.effectifCibleTable) {
                        void agir(
                          () =>
                            modifierSession(detail.id, s.id, { effectifCibleTable: v }).then(() =>
                              recharger(detail.id)
                            ),
                          `${s.plaqueLibelle} : effectif cible enregistre.`
                        );
                      }
                    }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* -------------------------------------------------------- cloture */}
      <div className="carte">
        <h3>Cloture</h3>
        <p className="note">
          Cloturer fige la campagne : plus aucune saisie, plus aucune modification de jour ni de
          creneau. Reversible ici, mais a ne pas faire pendant une session en cours.
        </p>
        <button
          type="button"
          className={figee ? 'secondaire' : ''}
          onClick={() =>
            void agir(
              () => modifierCampagne(detail.id, { cloturee: !figee }).then(() => recharger(detail.id)),
              figee ? 'Campagne reouverte.' : 'Campagne cloturee.'
            )
          }
        >
          {figee ? 'Reouvrir la campagne' : 'Cloturer la campagne'}
        </button>
      </div>
    </section>
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
    <div className="carte conflit">
      <h3>Des RDV sont rattaches a ce que vous retirez</h3>

      <ul className="impacts">
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

      <div className="ajout">
        <label>
          Deplacer les {totalActifs + totalArchives} RDV vers
          <select value={vers} onChange={(e) => setVers(e.target.value)}>
            {destinations.map((d) => (
              <option key={d} value={d}>
                {conflit.type === 'jours' ? formaterJour(d) : d}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={() => onDeplacer(vers)} disabled={!vers}>
          Deplacer et enregistrer
        </button>
        <button type="button" className="secondaire" onClick={onAnnuler}>
          Annuler la modification
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
const libelleDepuisCode = (code: string): string => {
  const m = code.match(/^(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$/);
  if (!m) return code;
  return `${Number(m[1])}h-${Number(m[3])}h`;
};
