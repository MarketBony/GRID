import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  archiverTable,
  chargerTables,
  creerTable,
  definirMembres,
  modifierTable,
  repartirAuto,
  reprendreComposition,
  type PerimetreTables,
  type TablePhoning,
  type VendeurTable,
} from '../services/tables';
import { chargerCampagnes, chargerCampagne, type CampagneResume } from '../services/campagnes';
import { useTempsReel } from '../hooks/useTempsReel';
import { comparerLibelle } from '../backend/src/utils/tri';
import { choisirDansListe, useCampagneCourante } from '../contexts/CampagneContext';

// ============================================================================
// ECRAN TABLES — module B, le constructeur.
//
// LES TABLES SONT UN SUPPLEMENT, PAS LE MODE NORMAL. Deux plaques sur quatre
// n'avaient aucune table en juin 2026, et le perimetre de saisie par defaut est
// le SITE. L'ecran le dit explicitement pour une session en `par_site` plutot que
// de la masquer : l'utilisateur doit comprendre POURQUOI il n'y a rien a composer.
//
// DEUX CHEMINS POUR AFFECTER, et ce n'est pas un luxe. F-B.3 demande le
// glisser-deposer ; le glisser-deposer HTML5 est mauvais au doigt, et cet outil
// s'utilise sur tablette. On offre donc aussi : cliquer un vendeur, cliquer une
// table. Le meme geste marche a la souris, au doigt et au clavier.
//
// AUCUN BOUTON DE SUPPRESSION (interdit n.1). Archiver une table rend ses membres
// a la reserve, ou ils restent saisissables par leur chef de site (F-B.8).
// ============================================================================

type Selection = { vendeurId: string; nom: string; depuis: string | 'reserve' } | null;

export function Tables() {
  const [campagnes, setCampagnes] = useState<CampagneResume[]>([]);
  // Partagee avec les autres ecrans — voir `contexts/CampagneContext.tsx`.
  const { campagneId, choisir: setCampagneId } = useCampagneCourante();
  const [sessions, setSessions] = useState<
    { id: string; plaqueLibelle: string; mode: string }[]
  >([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [donnees, setDonnees] = useState<PerimetreTables | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);
  const [selection, setSelection] = useState<Selection>(null);
  const [survolee, setSurvolee] = useState<string | null>(null);
  const [nouvelleTable, setNouvelleTable] = useState('');
  const [repriseDepuis, setRepriseDepuis] = useState('');

  // ---------------------------------------------------------------- chargement

  useEffect(() => {
    chargerCampagnes()
      .then((cs) => {
        setCampagnes(cs);
        const retenue = choisirDansListe(cs, campagneId, (l) => l.find((c) => !c.cloturee) ?? l[0]);
        if (retenue) setCampagneId(retenue);
        else setChargement(false);
      })
      .catch((e) => {
        setErreur(e instanceof Error ? e.message : 'Chargement impossible.');
        setChargement(false);
      });
  }, []);

  useEffect(() => {
    if (!campagneId) return;
    chargerCampagne(campagneId)
      .then((d) => {
        const liste = d.sessions.map((s) => ({
          id: s.id,
          plaqueLibelle: s.plaqueLibelle,
          mode: s.mode,
        }));
        setSessions(liste);
        // On ouvre sur une session en `par_table` : c'est la seule qui a quelque
        // chose a composer. A defaut, la premiere, avec son explication.
        const cible = liste.find((s) => s.mode === 'par_table') ?? liste[0];
        setSessionId(cible?.id ?? null);
        if (!cible) setChargement(false);
      })
      .catch((e) => setErreur(e instanceof Error ? e.message : 'Chargement impossible.'));
  }, [campagneId]);

  const recharger = useCallback(async (id: string) => {
    setDonnees(await chargerTables(id));
  }, []);

  useEffect(() => {
    if (!sessionId) return;
    setChargement(true);
    setSelection(null);
    recharger(sessionId)
      .catch((e) => setErreur(e instanceof Error ? e.message : 'Chargement impossible.'))
      .finally(() => setChargement(false));
  }, [sessionId, recharger]);

  // Un autre administrateur recompose la meme plaque : on relit plutot que de
  // patcher a l'aveugle.
  useTempsReel(campagneId, {
    'tables:modifiees': () => sessionId && void recharger(sessionId).catch(() => undefined),
  });

  // ---------------------------------------------------------------- actions

  const agir = async (action: () => Promise<string | void>) => {
    setErreur(null);
    setSucces(null);
    setOccupe(true);
    try {
      const message = await action();
      if (sessionId) await recharger(sessionId);
      if (typeof message === 'string') setSucces(message);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Operation impossible.');
      // L'ecran doit montrer la base, pas un etat local optimiste refuse.
      if (sessionId) await recharger(sessionId).catch(() => undefined);
    } finally {
      setOccupe(false);
      setSelection(null);
    }
  };

  /// Deplace un vendeur vers une table, ou vers la reserve.
  ///
  /// DEUX APPELS quand il change de table : on le RETIRE d'abord, on l'ajoute
  /// ensuite. R-B.4 interdit deux tables pour un meme vendeur sur une campagne,
  /// donc l'ordre inverse serait refuse. Si le second appel echoue, le vendeur
  /// reste en reserve — un etat valide, pas une corruption.
  const deplacer = (vendeurId: string, depuis: string | 'reserve', vers: string | 'reserve') => {
    if (!donnees || depuis === vers) return;
    void agir(async () => {
      if (depuis !== 'reserve') {
        const source = donnees.tables.find((t) => t.id === depuis);
        if (source) {
          await definirMembres(
            source.id,
            source.membres.filter((m) => m.id !== vendeurId).map((m) => m.id)
          );
        }
      }
      if (vers !== 'reserve') {
        const cible = donnees.tables.find((t) => t.id === vers);
        if (cible) {
          await definirMembres(cible.id, [...cible.membres.map((m) => m.id), vendeurId]);
        }
      }
    });
  };

  const surClicZone = (zone: string | 'reserve') => {
    if (!selection) return;
    deplacer(selection.vendeurId, selection.depuis, zone);
  };

  // ---------------------------------------------------------------- rendu

  // AVANT tout retour anticipe : un hook appele conditionnellement casse l'ordre
  // des hooks entre deux rendus. React le refuse, et le symptome apparait loin de
  // la cause.
  const totalPlaque = useMemo(
    () => (donnees ? donnees.reserve.length + donnees.tables.reduce((n, t) => n + t.effectif, 0) : 0),
    [donnees]
  );

  if (chargement && !donnees) return <div className="attente">Chargement des tables…</div>;
  if (erreur && !donnees) return <div className="erreur-bloc">{erreur}</div>;

  const session = donnees?.session;
  const figee = session?.cloturee ?? false;
  const parSite = session?.mode === 'par_site';

  return (
    <section className="ecran">
      <header className="ecran-entete">
        <div>
          <h2>Tables</h2>
          <p className="note">
            Archiver une table rend ses membres à la réserve, où ils restent saisissables par leur
            chef de site.
          </p>
        </div>
        <div className="selecteurs">
          <select
            value={campagneId ?? ''}
            onChange={(e) => setCampagneId(e.target.value)}
            aria-label="Campagne"
          >
            {campagnes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.libelle}
                {c.cloturee ? ' (clôturée)' : ''}
              </option>
            ))}
          </select>
          <select
            value={sessionId ?? ''}
            onChange={(e) => setSessionId(e.target.value)}
            aria-label="Plaque"
          >
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.plaqueLibelle} — {s.mode === 'par_table' ? 'par table' : 'par site'}
              </option>
            ))}
          </select>
        </div>
      </header>

      {erreur && <div className="erreur-bloc">{erreur}</div>}
      {succes && <div className="succes-bloc">{succes}</div>}

      {figee && (
        <div className="info-bloc">
          Campagne clôturée : la composition est figée. C’est elle qui explique les totaux de cette
          campagne, on ne la réécrit pas.
        </div>
      )}

      {parSite && (
        <div className="info-bloc">
          <strong>{session?.plaqueLibelle} est en mode « par site ».</strong> Cette plaque n’utilise
          pas de tables : chaque chef de site saisit pour ses vendeurs, ce qui est le mode normal.
          Composer des tables ici n’aurait aucun effet sur la saisie. Pour en utiliser, passer la
          session en « par table » depuis l’écran Campagnes.
        </div>
      )}

      {donnees && !parSite && (
        <>
          <div className="barre-outils">
            <form
              className="ligne-formulaire"
              onSubmit={(e) => {
                e.preventDefault();
                const libelle = nouvelleTable.trim();
                if (libelle === '') return;
                void agir(async () => {
                  const r = await creerTable(donnees.session.id, libelle);
                  setNouvelleTable('');
                  return r.reactivee
                    ? `« ${r.libelle} » existait, archivée : elle est réactivée avec son historique.`
                    : `« ${r.libelle} » créée.`;
                });
              }}
            >
              <input
                value={nouvelleTable}
                onChange={(e) => setNouvelleTable(e.target.value)}
                placeholder="Nouvelle table"
                disabled={occupe || figee}
                aria-label="Libellé de la nouvelle table"
              />
              <button type="submit" className="secondaire" disabled={occupe || figee}>
                + Créer
              </button>
            </form>

            <button
              type="button"
              className="principal"
              disabled={occupe || figee || donnees.tables.length === 0}
              onClick={() =>
                void agir(async () => {
                  const r = await repartirAuto(donnees.session.id, false);
                  return (
                    r.message +
                    (r.nonPlaces.length > 0
                      ? ` Restent en réserve : ${r.nonPlaces.map((n) => n.nom).join(', ')}.`
                      : '')
                  );
                })
              }
              title="Place les vendeurs sans table. Ne déplace personne."
            >
              Compléter — graine 42
            </button>

            <button
              type="button"
              className="secondaire"
              disabled={occupe || figee || donnees.tables.length === 0}
              onClick={() => {
                // `remplacer` archive tout le travail manuel : on demande.
                const ok = window.confirm(
                  'Refaire la composition entière ?\n\n' +
                    'Toutes les affectations actuelles de cette plaque seront archivées, puis ' +
                    'tout le monde sera replacé. Le travail manuel déjà fait sera perdu.\n\n' +
                    'La graine 42 rend le résultat reproductible : relancer redonnera la même ' +
                    'composition.'
                );
                if (!ok) return;
                void agir(async () => {
                  const r = await repartirAuto(donnees.session.id, true);
                  return r.message;
                });
              }}
              title="Archive les affectations existantes et replace tout le monde."
            >
              Tout refaire
            </button>

            <form
              className="ligne-formulaire"
              onSubmit={(e) => {
                e.preventDefault();
                if (repriseDepuis === '') return;
                void agir(async () => {
                  const r = await reprendreComposition(donnees.session.id, repriseDepuis);
                  return (
                    r.message +
                    (r.reportes.length > 0
                      ? ` Non repris : ${r.reportes.map((x) => x.nom).join(', ')}.`
                      : '')
                  );
                });
              }}
            >
              <select
                value={repriseDepuis}
                onChange={(e) => setRepriseDepuis(e.target.value)}
                disabled={occupe || figee}
                aria-label="Campagne à reprendre"
              >
                <option value="">Reprendre depuis…</option>
                {campagnes
                  .filter((c) => c.id !== donnees.session.campagneId)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.libelle}
                    </option>
                  ))}
              </select>
              <button type="submit" className="secondaire" disabled={occupe || figee || repriseDepuis === ''}>
                Reprendre
              </button>
            </form>
          </div>

          {selection && (
            <div className="info-bloc">
              <strong>{selection.nom}</strong> est sélectionné. Cliquer une table pour l’y placer, ou
              la réserve pour l’en retirer.{' '}
              <button type="button" className="lien" onClick={() => setSelection(null)}>
                annuler
              </button>
            </div>
          )}

          <div className="plateau">
            <ZoneReserve
              vendeurs={donnees.reserve}
              total={totalPlaque}
              selection={selection}
              survolee={survolee === 'reserve'}
              figee={figee}
              onSelectionner={(v) =>
                setSelection(
                  selection?.vendeurId === v.id
                    ? null
                    : { vendeurId: v.id, nom: v.nom, depuis: 'reserve' }
                )
              }
              onDeposer={(vendeurId, depuis) => deplacer(vendeurId, depuis, 'reserve')}
              onSurvol={setSurvolee}
              onClicZone={() => surClicZone('reserve')}
            />

            {donnees.tables.length === 0 ? (
              <p className="note">
                Aucune table sur cette session. En créer au moins une ci-dessus — la répartition
                automatique remplit les tables existantes, elle n’en crée pas.
              </p>
            ) : (
              donnees.tables.map((t) => (
                <ColonneTable
                  key={t.id}
                  table={t}
                  donnees={donnees}
                  selection={selection}
                  survolee={survolee === t.id}
                  figee={figee}
                  occupe={occupe}
                  onSelectionner={(v) =>
                    setSelection(
                      selection?.vendeurId === v.id
                        ? null
                        : { vendeurId: v.id, nom: v.nom, depuis: t.id }
                    )
                  }
                  onDeposer={(vendeurId, depuis) => deplacer(vendeurId, depuis, t.id)}
                  onSurvol={setSurvolee}
                  onClicZone={() => surClicZone(t.id)}
                  onModifier={(champs) =>
                    void agir(async () => {
                      await modifierTable(t.id, champs);
                    })
                  }
                  onArchiver={() => {
                    const ok = window.confirm(
                      `Archiver « ${t.libelle} » ?\n\n` +
                        `Ses ${t.effectif} membre(s) reviennent en réserve et restent saisissables ` +
                        'par leur chef de site. Rien n’est supprimé : la composition reste ' +
                        'consultable.'
                    );
                    if (!ok) return;
                    void agir(async () => {
                      const r = await archiverTable(t.id);
                      return r.message;
                    });
                  }}
                />
              ))
            )}
          </div>
        </>
      )}
    </section>
  );
}

// ---------------------------------------------------------------- reserve

function ZoneReserve({
  vendeurs,
  total,
  selection,
  survolee,
  figee,
  onSelectionner,
  onDeposer,
  onSurvol,
  onClicZone,
}: {
  vendeurs: VendeurTable[];
  total: number;
  selection: Selection;
  survolee: boolean;
  figee: boolean;
  onSelectionner: (v: VendeurTable) => void;
  onDeposer: (vendeurId: string, depuis: string | 'reserve') => void;
  onSurvol: (zone: string | null) => void;
  onClicZone: () => void;
}) {
  return (
    <div
      className={`colonne-table reserve ${survolee ? 'survolee' : ''} ${
        selection && selection.depuis !== 'reserve' ? 'cible' : ''
      }`}
      onDragOver={(e) => {
        if (figee) return;
        e.preventDefault();
        onSurvol('reserve');
      }}
      onDragLeave={() => onSurvol(null)}
      onDrop={(e) => {
        e.preventDefault();
        onSurvol(null);
        if (figee) return;
        const donnees = e.dataTransfer.getData('text/plain');
        const [vendeurId, depuis] = donnees.split('|');
        if (vendeurId) onDeposer(vendeurId, depuis ?? 'reserve');
      }}
      onClick={onClicZone}
    >
      <header>
        <h3>Réserve</h3>
        <span className="etiquette">{vendeurs.length}</span>
      </header>
      <p className="note">
        Non affectés à une table. Ils <strong>restent saisissables</strong> par leur chef de site
        (F-B.8) : la réserve n’est pas un reliquat.
      </p>
      <ul className="cartes-vendeurs">
        {vendeurs.map((v) => (
          <CarteVendeur
            key={v.id}
            vendeur={v}
            depuis="reserve"
            selectionne={selection?.vendeurId === v.id}
            figee={figee}
            onSelectionner={onSelectionner}
          />
        ))}
      </ul>
      <footer className="total-perimetre">
        <span>Plaque</span>
        <strong>{total}</strong>
      </footer>
    </div>
  );
}

// ---------------------------------------------------------------- une table

function ColonneTable({
  table,
  donnees,
  selection,
  survolee,
  figee,
  occupe,
  onSelectionner,
  onDeposer,
  onSurvol,
  onClicZone,
  onModifier,
  onArchiver,
}: {
  table: TablePhoning;
  donnees: PerimetreTables;
  selection: Selection;
  survolee: boolean;
  figee: boolean;
  occupe: boolean;
  onSelectionner: (v: VendeurTable) => void;
  onDeposer: (vendeurId: string, depuis: string | 'reserve') => void;
  onSurvol: (zone: string | null) => void;
  onClicZone: () => void;
  onModifier: (champs: {
    libelle?: string;
    chefUtilisateurId?: string | null;
    marqueId?: string | null;
  }) => void;
  onArchiver: () => void;
}) {
  const [renommage, setRenommage] = useState<string | null>(null);
  const ecart = table.ecartCible;

  // LES ENCADRANTS DE LA PLAQUE D'ABORD, puis ceux d'ailleurs, puis les comptes
  // sans rattachement. L'ordre est un confort de lecture, PAS un filtre :
  // l'exercice consiste justement a prendre un coach d'une autre concession.
  const parNom = (a: { nom: string }, b: { nom: string }) => comparerLibelle(a.nom, b.nom);
  const deLaPlaque = donnees.chefsPossibles.filter((u) => u.deLaPlaque).sort(parNom);
  const ailleurs = donnees.chefsPossibles
    .filter((u) => !u.deLaPlaque && u.encadrements.length > 0)
    .sort(parNom);
  const sansSite = donnees.chefsPossibles
    .filter((u) => !u.deLaPlaque && u.encadrements.length === 0)
    .sort(parNom);

  /// « MARIE COACH — chef de vente VN CLF ». Ce qui compte au moment de composer,
  /// c'est de savoir d'ou vient le coach.
  const decrire = (u: (typeof donnees.chefsPossibles)[number]) => {
    if (u.encadrements.length > 0) {
      return u.encadrements
        .map((e) => `${libelleRole(e.role)} ${e.siteCode}`)
        .join(', ');
    }
    if (u.rolesGlobaux.includes('admin')) return 'administrateur';
    if (u.rolesGlobaux.includes('direction')) return 'direction';
    return 'sans rattachement';
  };

  return (
    <div
      className={`colonne-table ${survolee ? 'survolee' : ''} ${
        selection && selection.depuis !== table.id ? 'cible' : ''
      }`}
      onDragOver={(e) => {
        if (figee) return;
        e.preventDefault();
        onSurvol(table.id);
      }}
      onDragLeave={() => onSurvol(null)}
      onDrop={(e) => {
        e.preventDefault();
        onSurvol(null);
        if (figee) return;
        const brut = e.dataTransfer.getData('text/plain');
        const [vendeurId, depuis] = brut.split('|');
        if (vendeurId) onDeposer(vendeurId, depuis ?? 'reserve');
      }}
      onClick={onClicZone}
    >
      <header>
        {renommage === null ? (
          <h3>
            {table.libelle}
            {!figee && (
              <button
                type="button"
                className="lien"
                onClick={(e) => {
                  e.stopPropagation();
                  setRenommage(table.libelle);
                }}
              >
                renommer
              </button>
            )}
          </h3>
        ) : (
          <form
            className="ligne-formulaire"
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => {
              e.preventDefault();
              const libelle = renommage.trim();
              setRenommage(null);
              if (libelle !== '' && libelle !== table.libelle) onModifier({ libelle });
            }}
          >
            <input value={renommage} onChange={(e) => setRenommage(e.target.value)} autoFocus />
            <button type="submit" className="secondaire">
              OK
            </button>
          </form>
        )}
        <span className="etiquette">{table.effectif}</span>
      </header>

      <div className="champs-table" onClick={(e) => e.stopPropagation()}>
        <label>
          Chef de table
          <select
            value={table.chefUtilisateurId ?? ''}
            disabled={figee || occupe}
            onChange={(e) => onModifier({ chefUtilisateurId: e.target.value || null })}
          >
            <option value="">aucun</option>
            {/* DEUX GROUPES, ET LES DEUX SONT PROPOSES.

                Le chef d'une table peut venir d'une AUTRE concession que celle de
                ses vendeurs : c'est le coeur de l'exercice. « Je mets 5 vendeurs
                de 5 concessions differentes, et un chef de vente en chef de table
                d'une autre concession pour les coacher. »

                Le regroupement n'est donc qu'un ordre de lecture, jamais un
                filtre — restreindre a la plaque rendrait l'exercice
                inexprimable. */}
            {deLaPlaque.length > 0 && (
              <optgroup label={`Encadrants de ${donnees.session.plaqueLibelle}`}>
                {deLaPlaque.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nom} — {decrire(u)}
                  </option>
                ))}
              </optgroup>
            )}
            {ailleurs.length > 0 && (
              <optgroup label="Encadrants d’une autre plaque">
                {ailleurs.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nom} — {decrire(u)}
                  </option>
                ))}
              </optgroup>
            )}
            {sansSite.length > 0 && (
              <optgroup label="Autres comptes">
                {sansSite.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nom} — {decrire(u)}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </label>
      </div>

      {ecart !== null && ecart !== 0 && (
        <p className={`note ${Math.abs(ecart) > 1 ? 'alerte' : ''}`}>
          {ecart > 0 ? `${ecart} de trop` : `${-ecart} manquant${-ecart > 1 ? 's' : ''}`} par rapport
          à la cible de {donnees.session.effectifCibleTable}.
        </p>
      )}

      <ul className="cartes-vendeurs">
        {table.membres.map((v) => (
          <CarteVendeur
            key={v.id}
            vendeur={v}
            depuis={table.id}
            selectionne={selection?.vendeurId === v.id}
            figee={figee}
            onSelectionner={onSelectionner}
          />
        ))}
      </ul>

      {table.posesAuto > 0 && (
        <p className="note">
          {table.posesAuto} placement(s) par la répartition automatique, {table.effectif - table.posesAuto}{' '}
          à la main.
        </p>
      )}

      {!figee && (
        <div className="actions" onClick={(e) => e.stopPropagation()}>
          <button type="button" className="lien" onClick={onArchiver} disabled={occupe}>
            archiver
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- une carte

function CarteVendeur({
  vendeur,
  depuis,
  selectionne,
  figee,
  onSelectionner,
}: {
  vendeur: VendeurTable;
  depuis: string | 'reserve';
  selectionne: boolean;
  figee: boolean;
  onSelectionner: (v: VendeurTable) => void;
}) {
  return (
    <li>
      <button
        type="button"
        /* Le metier passe en CLASSE et non en couleur codee ici : c'est la
           feuille de style qui decide du lisere, et elle peut changer d'avis
           sans qu'on touche au composant. */
        className={`carte-vendeur ${vendeur.typeVehicule === 'VO' ? 'vo' : 'vn'} ${
          selectionne ? 'selectionne' : ''
        }`}
        draggable={!figee}
        disabled={figee}
        onDragStart={(e) => e.dataTransfer.setData('text/plain', `${vendeur.id}|${depuis}`)}
        onClick={(e) => {
          e.stopPropagation();
          onSelectionner(vendeur);
        }}
      >
        <span className="nom">
          {vendeur.nom}
          <span className={`etiquette ${vendeur.typeVehicule === 'VO' ? 'vo' : 'vn'}`}>
            {vendeur.typeVehicule}
          </span>
        </span>
        <span className="detail">{vendeur.siteCode}</span>
      </button>
    </li>
  );
}

/// Libelle lisible d'un role d'encadrement. Les codes viennent du serveur — on ne
/// les fabrique pas ici (interdit n.3 : aucune structure en dur cote front).
/// Traduction des codes de role. Les CODES viennent du serveur (interdit n.3) ;
/// seule leur traduction vit cote front, et en un seul endroit.
const libelleRole = (role: string): string =>
  role === 'chef_de_site'
    ? 'chef de site'
    : role === 'chef_de_vente_vn'
      ? 'chef de vente VN'
      : role === 'chef_de_vente_vo'
        ? 'chef de vente VO'
        : role;
