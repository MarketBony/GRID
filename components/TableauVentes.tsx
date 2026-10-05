import { useEffect, useMemo, useState } from 'react';
import type { CampagneResume } from '../services/campagnes';
import { chargerObjectifs, chargerVentes, enregistrerObjectif } from '../services/ventes';
import { rapport, tableauVentes, type LigneVente, type TableauVentes as Tableau } from '../backend/src/utils/ventes';
import { useReferentiels } from '../hooks/useReferentiels';
import { useSession } from '../contexts/SessionContext';
import { libelleJour } from '../utils/grille';
import type { Marque, Plaque, Site } from '../types';

// ============================================================================
// LE TABLEAU DES VENTES — vue « Ventes » du tableau de bord (05/10/2026).
//
// La forme du tableau de l'equipe : VPP par marque (vs A-1, vs objectif), cumul
// VPP, VD par marque, VO. Une ligne par site GRID, groupees par plaque, et sous
// chaque site la ligne DIAC. AUCUN comptage ici : tout vient de `tableauVentes`
// (`utils/ventes.ts`, `test:suivi`).
//
// Chiffres GLOBAUX, pour tout compte : la vue `relance.vente` ne porte aucun nom.
// ============================================================================

const pct = (t: number | null) => (t === null ? '—' : `${Math.round(t * 100)} %`);

/// La campagne du meme mois, un an plus tot : le « A-1 » par defaut.
const memeMoisAnPasse = (c: CampagneResume | undefined, liste: CampagneResume[]) => {
  if (!c) return '';
  const [a, m] = c.dateDebut.slice(0, 7).split('-').map(Number);
  const cible = `${a - 1}-${String(m).padStart(2, '0')}`;
  return liste.find((x) => x.id !== c.id && x.dateDebut.slice(0, 7) === cible)?.id ?? '';
};

export function TableauVentes({
  campagneId,
  campagnes,
  jours,
}: {
  campagneId: string;
  campagnes: CampagneResume[];
  jours: string[];
}) {
  const { donnees: ref } = useReferentiels();
  const { session } = useSession();
  const peutSaisir = session?.droits.administre ?? false;

  const [refId, setRefId] = useState('');
  const [ventes, setVentes] = useState<LigneVente[] | null>(null);
  const [ventesRef, setVentesRef] = useState<LigneVente[] | null>(null);
  const [objectifs, setObjectifs] = useState<Map<string, number>>(new Map());
  const [saisieObjectifs, setSaisieObjectifs] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    setRefId(memeMoisAnPasse(campagnes.find((c) => c.id === campagneId), campagnes));
    setVentes(null);
    Promise.all([chargerVentes(campagneId), chargerObjectifs(campagneId)])
      .then(([v, o]) => {
        setVentes(v);
        setObjectifs(o);
      })
      .catch((e) => setErreur(e instanceof Error ? e.message : 'Chargement impossible.'));
  }, [campagneId, campagnes]);

  useEffect(() => {
    setVentesRef(null);
    if (!refId) return;
    chargerVentes(refId)
      .then(setVentesRef)
      .catch((e) => setErreur(e instanceof Error ? e.message : 'Chargement impossible.'));
  }, [refId]);

  /// Les sites dans l'ordre des plaques, puis de leur libelle.
  const groupes = useMemo(() => {
    if (!ref) return [] as { plaque: Plaque; sites: Site[] }[];
    return [...ref.plaques]
      .sort((a, b) => a.ordre - b.ordre)
      .map((p) => ({
        plaque: p,
        sites: ref.sites.filter((s) => s.plaqueId === p.id && s.tableauVentes !== false).sort((a, b) => a.libelle.localeCompare(b.libelle, 'fr')),
      }))
      .filter((g) => g.sites.length > 0);
  }, [ref]);

  /// Toutes les marques retenues pour le tableau (`marque.tableau_ventes`), avec
  /// ou sans vente : une marque sans vente est une information.
  const marques = useMemo(
    () => [...(ref?.marques ?? [])].sort((a, b) => a.ordre - b.ordre).filter((m) => m.tableauVentes !== false),
    [ref]
  );
  /// Les ventes d'un site ou d'une marque hors tableau ne comptent pas non plus
  /// dans les totaux : un total BONY doit etre la somme des lignes affichees.
  const retenue = useMemo(() => {
    const sites = new Set(groupes.flatMap((g) => g.sites.map((s) => s.id)));
    const exclues = new Set((ref?.marques ?? []).filter((m) => m.tableauVentes === false).map((m) => m.id));
    return (l: LigneVente) => sites.has(l.siteId) && !(l.marqueId && exclues.has(l.marqueId));
  }, [groupes, ref]);

  const poserObjectif = async (siteId: string, marqueId: string, valeur: string) => {
    const v = valeur.trim() === '' ? null : Math.max(0, Math.round(Number(valeur)));
    if (v !== null && Number.isNaN(v)) return;
    const cle = `${siteId}|${marqueId}`;
    if ((objectifs.get(cle) ?? null) === v) return;
    try {
      await enregistrerObjectif(campagneId, siteId, marqueId, v);
      setObjectifs((o) => {
        const n = new Map(o);
        if (v === null) n.delete(cle);
        else n.set(cle, v);
        return n;
      });
      setErreur(null);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Objectif non enregistré.');
    }
  };

  if (!ref || ventes === null) {
    return (
      <div style={{ display: 'grid', gap: 8 }}>
        {erreur ? <div className="bandeau-v2 erreur">{erreur}</div> : [0, 1, 2].map((i) => <div key={i} className="skel" style={{ height: 120 }} />)}
      </div>
    );
  }

  const refLibelle = campagnes.find((c) => c.id === refId)?.libelle ?? null;
  const t = (lignes: LigneVente[] | null, categorie: 'VPP' | 'VD' | 'VO', marqueId?: string) =>
    lignes ? tableauVentes(lignes.filter(retenue), { categorie, marqueId }) : null;

  return (
    <div className="ventes">
      <div className="ventes-outils">
        <label className="ventes-ref">
          <span className="label">vs A-1</span>
          <select className="select" style={{ width: 'auto', height: 32 }} value={refId} onChange={(e) => setRefId(e.target.value)}>
            <option value="">Aucune référence</option>
            {campagnes
              .filter((c) => c.id !== campagneId)
              .map((c) => (
                <option key={c.id} value={c.id}>{c.libelle}</option>
              ))}
          </select>
        </label>
        {peutSaisir && marques.length > 0 && (
          <button type="button" className="btn" aria-pressed={saisieObjectifs} onClick={() => setSaisieObjectifs((s) => !s)}>
            {saisieObjectifs ? 'Terminer la saisie des objectifs' : 'Saisir les objectifs VPP'}
          </button>
        )}
      </div>

      {erreur && <div className="bandeau-v2 erreur">{erreur}</div>}

      {marques.length === 0 ? (
        <div className="empty card">Aucune marque n'est retenue pour le tableau des ventes.</div>
      ) : (
        <div className="ventes-grille">
          {marques.map((m) => (
            <Bloc
              key={`vpp-${m.id}`}
              titre="VPP"
              marque={m}
              jours={jours}
              groupes={groupes}
              courant={t(ventes, 'VPP', m.id)!}
              reference={t(ventesRef, 'VPP', m.id)}
              refLibelle={refLibelle}
              objectif={(siteId) => objectifs.get(`${siteId}|${m.id}`) ?? null}
              saisieObjectifs={saisieObjectifs}
              poserObjectif={(siteId, v) => void poserObjectif(siteId, m.id, v)}
            />
          ))}
          <Bloc
            titre="Cumul VPP"
            sousTitre={marques.map((m) => m.libelle).join(' + ')}
            jours={jours}
            groupes={groupes}
            courant={t(ventes, 'VPP')!}
            reference={t(ventesRef, 'VPP')}
            refLibelle={refLibelle}
            txDiac
          />
          {marques.map((m) => (
            <Bloc
              key={`vd-${m.id}`}
              titre="VD"
              marque={m}
              jours={jours}
              groupes={groupes}
              courant={t(ventes, 'VD', m.id)!}
              reference={t(ventesRef, 'VD', m.id)}
              refLibelle={refLibelle}
            />
          ))}
          <Bloc
            titre="VO"
            jours={jours}
            groupes={groupes}
            courant={t(ventes, 'VO')!}
            reference={t(ventesRef, 'VO')}
            refLibelle={refLibelle}
            txDiac
          />
        </div>
      )}
    </div>
  );
}

function Bloc({
  titre,
  sousTitre,
  marque,
  jours,
  groupes,
  courant,
  reference,
  refLibelle,
  objectif,
  saisieObjectifs = false,
  poserObjectif,
  txDiac = false,
}: {
  titre: string;
  sousTitre?: string;
  marque?: Marque;
  jours: string[];
  groupes: { plaque: Plaque; sites: Site[] }[];
  courant: Tableau;
  reference: Tableau | null;
  refLibelle: string | null;
  objectif?: (siteId: string) => number | null;
  saisieObjectifs?: boolean;
  poserObjectif?: (siteId: string, valeur: string) => void;
  txDiac?: boolean;
}) {
  const avecObjectif = objectif !== undefined;
  const totalObjectif = avecObjectif
    ? groupes.flatMap((g) => g.sites).reduce((n, s) => n + (objectif(s.id) ?? 0), 0)
    : 0;
  const nbColonnes = jours.length + 2 + (avecObjectif ? 1 : 0) + (txDiac ? 1 : 0) + 1;
  const marqueCls = marque ? ` marque-${marque.code.toLowerCase()}` : '';

  return (
    <section className={`card ventes-bloc${marqueCls}`}>
      <header className="ventes-titre">
        <b>{titre}</b>
        {marque && <span className="ventes-marque">{marque.libelle}</span>}
        {sousTitre && <span className="faint">{sousTitre}</span>}
      </header>
      <div style={{ overflowX: 'auto' }}>
        <table className="tbl ventes-tbl">
          <thead>
            <tr>
              <th>Site</th>
              {jours.map((j) => (
                <th key={j} className="r">{libelleJour(j).split(' ')[0]}</th>
              ))}
              <th className="r">Total</th>
              <th className="r" title={refLibelle ?? 'Aucune référence choisie'}>vs A-1</th>
              {avecObjectif && <th className="r">vs Obj</th>}
              {txDiac && <th className="r">Tx DIAC</th>}
            </tr>
          </thead>
          {groupes.map((g) => (
            <tbody key={g.plaque.id} className="ventes-plaque">
              <tr className="ventes-plaque-titre">
                <td colSpan={nbColonnes}>{g.plaque.libelle}</td>
              </tr>
              {g.sites.map((s) => {
                const c = courant.sites.get(s.id);
                const r = reference?.sites.get(s.id);
                const obj = objectif?.(s.id) ?? null;
                const vsObj = rapport(c?.total.ventes ?? 0, obj);
                return [
                  <tr key={s.id} className="ventes-site">
                    <td>{s.libelle}</td>
                    {jours.map((j) => (
                      <td key={j} className="r num">{c?.jours.get(j)?.ventes ?? 0}</td>
                    ))}
                    <td className="r num total">{c?.total.ventes ?? 0}</td>
                    <td className="r num">{reference ? pct(rapport(c?.total.ventes ?? 0, r?.total.ventes ?? 0)) : '—'}</td>
                    {avecObjectif && (
                      <td className={`r num${vsObj !== null && vsObj >= 1 ? ' atteint' : ''}`}>
                        {saisieObjectifs ? (
                          <input
                            className="input objectif"
                            inputMode="numeric"
                            defaultValue={obj ?? ''}
                            aria-label={`Objectif ${s.libelle}`}
                            onBlur={(e) => poserObjectif?.(s.id, e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                          />
                        ) : (
                          pct(vsObj)
                        )}
                      </td>
                    )}
                    {txDiac && <td className="r num">{pct(rapport(c?.total.diac ?? 0, c?.total.ventes ?? 0))}</td>}
                  </tr>,
                  <tr key={`${s.id}-diac`} className="ventes-diac">
                    <td>DIAC</td>
                    {jours.map((j) => (
                      <td key={j} className="r num">{c?.jours.get(j)?.diac ?? 0}</td>
                    ))}
                    <td className="r num">{c?.total.diac ?? 0}</td>
                    <td className="r num">{reference ? pct(rapport(c?.total.diac ?? 0, r?.total.diac ?? 0)) : '—'}</td>
                    {avecObjectif && <td />}
                    {txDiac && <td />}
                  </tr>,
                ];
              })}
            </tbody>
          ))}
          <tfoot>
            <tr className="ventes-total">
              <td>BONY</td>
              {jours.map((j) => (
                <td key={j} className="r num">{courant.jours.get(j)?.ventes ?? 0}</td>
              ))}
              <td className="r num">{courant.total.ventes}</td>
              <td className="r num">{reference ? pct(rapport(courant.total.ventes, reference.total.ventes)) : '—'}</td>
              {avecObjectif && <td className="r num">{pct(rapport(courant.total.ventes, totalObjectif))}</td>}
              {txDiac && <td className="r num">{pct(rapport(courant.total.diac, courant.total.ventes))}</td>}
            </tr>
            <tr className="ventes-diac">
              <td>DIAC</td>
              {jours.map((j) => (
                <td key={j} className="r num">{courant.jours.get(j)?.diac ?? 0}</td>
              ))}
              <td className="r num">{courant.total.diac}</td>
              <td colSpan={1 + (avecObjectif ? 1 : 0) + (txDiac ? 1 : 0)} className="r faint">
                Tx DIAC {pct(rapport(courant.total.diac, courant.total.ventes))}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}
