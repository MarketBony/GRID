import { useCallback, useEffect, useMemo, useState } from 'react';
import { useIndicateurGlissant } from '../hooks/useIndicateurGlissant';
import { Icone } from '../components/ui/Icone';
import { Compteur } from '../components/ui/Compteur';
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
import { EffectifsParSite } from '../components/effectifs/EffectifsParSite';
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

  /// La plaque se choisit dans un segmente : la pastille glisse d'une plaque a
  /// l'autre, comme partout.
  const segPlaque = useIndicateurGlissant(
    Math.max(0, sessions.findIndex((s) => s.id === sessionId)),
    sessions.length
  );

  if (chargement && !donnees)
    return (
      <div className="page">
        <div className="skel" style={{ height: 40, width: 260 }} />
        <div className="skel" style={{ height: 420, marginTop: 14 }} />
      </div>
    );
  if (erreur && !donnees) return <div className="page"><div className="bandeau-v2 erreur">{erreur}</div></div>;

  const session = donnees?.session;
  const figee = session?.cloturee ?? false;
  const parSite = session?.mode === 'par_site';

  return (
    <div className="page">
      <div className="app-head enter">
        <h1>Effectifs</h1>
        {donnees && (
          <span className="sub">
            {parSite ? 'par site' : `${donnees.tables.length} table${donnees.tables.length > 1 ? 's' : ''}`} · {totalPlaque} vendeurs
          </span>
        )}
        <div className="droite">
          <select className="select" value={campagneId ?? ''} onChange={(e) => setCampagneId(e.target.value)} aria-label="Campagne">
            {campagnes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.libelle}
                {c.cloturee ? ' (clôturée)' : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="seg seg-plaques enter" style={{ ['--i' as string]: 1 }} ref={segPlaque.conteneur} role="radiogroup" aria-label="Plaque">
        <span className="pouce" ref={segPlaque.indicateur} aria-hidden="true" />
        {sessions.map((s, i) => (
          <button key={s.id} type="button" ref={segPlaque.cible(i)} aria-pressed={s.id === sessionId} onClick={() => setSessionId(s.id)}>
            {s.plaqueLibelle}
            <span className="mode">{s.mode === 'par_table' ? 'tables' : 'site'}</span>
          </button>
        ))}
      </div>

      {erreur && <div className="bandeau-v2 erreur" role="alert">{erreur}</div>}
      {succes && <div className="bandeau-v2 ok" role="status">{succes}</div>}

      {figee && (
        <div className="bandeau-v2">
          <Icone nom="cadenas" petite /> Campagne clôturée : la composition est figée.
        </div>
      )}

      {/* EN MODE PAR SITE, on compose l'EFFECTIF (D12) : qui participe a la
          seance. Il n'y a pas de tables, donc pas de reserve : la liste est celle
          des vendeurs presents de la plaque. */}
      {parSite && donnees && campagneId && (
        <EffectifsParSite campagneId={campagneId} vendeurs={donnees.reserve} figee={figee} />
      )}

      {donnees && !parSite && (
        <>
          {!figee && (
          <div className="outils-tables card enter" style={{ ['--i' as string]: 2 }}>
            <form
              className="groupe-outil"
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
                className="input"
                value={nouvelleTable}
                onChange={(e) => setNouvelleTable(e.target.value)}
                placeholder="Nouvelle table"
                disabled={occupe || figee}
                aria-label="Libellé de la nouvelle table"
              />
              <button type="submit" className="btn" disabled={occupe || figee || nouvelleTable.trim() === ''}>
                <Icone nom="plus" petite /> Créer
              </button>
            </form>

            <span className="separateur" />

            <button
              type="button"
              className="btn primary"
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
              Compléter la répartition
            </button>

            <button
              type="button"
              className="btn ghost"
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

            <span className="separateur" />

            <form
              className="groupe-outil"
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
                className="select"
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
              <button type="submit" className="btn" disabled={occupe || figee || repriseDepuis === ''}>
                Reprendre
              </button>
            </form>
          </div>
          )}

          {selection && (
            <div className="selection-flottante" role="status">
              <span className="avatar">{selection.nom.split(/\s+/).slice(0, 2).map((m) => m[0]).join('')}</span>
              <span><b>{selection.nom}</b> — cliquer une table, ou la réserve</span>
              <button type="button" className="icon-btn" onClick={() => setSelection(null)} aria-label="Annuler la sélection">
                <Icone nom="fermer" petite />
              </button>
            </div>
          )}

          <div className="plateau-v2">
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

            <div className="tables-grille">
            {donnees.tables.length === 0 ? (
              <div className="empty card">
                Aucune table. En créer une ci-dessus : la répartition remplit les tables existantes,
                elle n’en crée pas.
              </div>
            ) : (
              donnees.tables.map((t, i) => (
                <ColonneTable
                  key={t.id}
                  rang={i}
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
          </div>
        </>
      )}
    </div>
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
      className={`zone-v2-table reserve-v2 ${survolee ? 'survolee' : ''} ${
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
      <header className="table-tete">
        <h3>Réserve</h3>
        <span className="effectif num"><Compteur valeur={vendeurs.length} /></span>
      </header>
      <p className="note">Sans table, toujours saisissables par leur chef de site.</p>
      <ul className="membres-v2">
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
      <footer className="total-plaque">
        <span>Plaque</span>
        <strong className="num"><Compteur valeur={total} /></strong>
      </footer>
    </div>
  );
}

// ---------------------------------------------------------------- une table

function ColonneTable({
  rang,
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
  rang: number;
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
      className={`zone-v2-table card enter ${survolee ? 'survolee' : ''} ${
        selection && selection.depuis !== table.id ? 'cible' : ''
      }`}
      style={{ ['--i' as string]: rang + 3 }}
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
      <header className="table-tete">
        {renommage === null ? (
          <h3>
            {table.libelle}
            {!figee && (
              <button
                type="button"
                className="icon-btn renommer"
                aria-label={`Renommer ${table.libelle}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setRenommage(table.libelle);
                }}
              >
                <Icone nom="crayon" petite />
              </button>
            )}
          </h3>
        ) : (
          <form
            className="groupe-outil"
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => {
              e.preventDefault();
              const libelle = renommage.trim();
              setRenommage(null);
              if (libelle !== '' && libelle !== table.libelle) onModifier({ libelle });
            }}
          >
            <input className="input" value={renommage} onChange={(e) => setRenommage(e.target.value)} autoFocus />
            <button type="submit" className="btn sm primary">OK</button>
          </form>
        )}
        <span className={`effectif num${ecart !== null && Math.abs(ecart) > 1 ? ' hors-cible' : ''}`}>
          <Compteur valeur={table.effectif} />
          {donnees.session.effectifCibleTable !== null && <span className="cible-n">/{donnees.session.effectifCibleTable}</span>}
        </span>
      </header>
      {donnees.session.effectifCibleTable !== null && (
        <div className="jauge" aria-hidden="true">
          <span style={{ transform: `scaleX(${Math.min(1, table.effectif / Math.max(1, donnees.session.effectifCibleTable))})` }} />
        </div>
      )}

      <div className="chef-table" onClick={(e) => e.stopPropagation()}>
        <label className="field">
          <span className="lbl">Chef de table</span>
          <select
            className="select"
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
        <p className={`note ${Math.abs(ecart) > 1 ? 'attention' : ''}`}>
          {ecart > 0 ? `${ecart} de trop` : `${-ecart} manquant${-ecart > 1 ? 's' : ''}`} par rapport
          à la cible de {donnees.session.effectifCibleTable}.
        </p>
      )}

      <ul className="membres-v2">
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

      <footer className="table-pied" onClick={(e) => e.stopPropagation()}>
        <span className="faint">
          {table.posesAuto > 0 ? `${table.posesAuto} auto · ${table.effectif - table.posesAuto} à la main` : ''}
        </span>
        {!figee && (
          <button type="button" className="icon-btn danger" onClick={onArchiver} disabled={occupe} aria-label={`Archiver ${table.libelle}`} title="Archiver la table">
            <Icone nom="corbeille" petite />
          </button>
        )}
      </footer>
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
        className={`membre-v2 ${vendeur.typeVehicule === 'VO' ? 'vo' : 'vn'} ${
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
        <span className="nom">{vendeur.nom}</span>
        <span className="site">{vendeur.siteCode}</span>
        <span className="metier-mini">{vendeur.typeVehicule}</span>
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
