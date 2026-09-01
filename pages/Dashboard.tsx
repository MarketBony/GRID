import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AXES,
  chargerComparaison,
  chargerDashboard,
  type Axe,
  type Comparaison,
  type Dashboard as DonneesDashboard,
  type Rang,
  type Totaux,
} from '../services/dashboard';
import { chargerCampagnes, type CampagneResume } from '../services/campagnes';
import { chargerSaisie } from '../services/saisie';
import { useReferentiels } from '../hooks/useReferentiels';
import { useTempsReel } from '../hooks/useTempsReel';
import { exporterDashboard } from '../utils/exportExcel';
import { libelleJour } from '../utils/grille';
import { BandeauKpi, BarresHorizontales, BarresParJour } from '../components/Graphiques';

// ============================================================================
// ECRAN DASHBOARD — module D.
//
// AUCUN CALCUL ICI. Chaque nombre vient de `services/dashboard.ts`, donc de
// `utils/agregats.ts`, verifie contre les 1107 RDV reels de juin 2026 par
// `npm run test:agregats`. Recalculer quoi que ce soit dans ce fichier creerait
// un second endroit ou la regle vit — et deux endroits finissent toujours par
// divergier sans que rien ne le signale.
//
// C'EST L'ECRAN QUI REMPLACE TROIS ONGLETS DU FICHIER : `RÉSULTATS` (les totaux),
// `SUIVI` (la comparaison a une campagne anterieure, ecrite a la main — « mars :
// 351 ») et `RANK` (les trois classements).
//
// F-D.8 : rafraichissement pendant une session. On s'abonne aux evenements de
// saisie plutot que d'interroger le serveur en boucle — un ecran collectif
// affiche des heures ne doit pas produire une requete par seconde.
// ============================================================================

const LIBELLES_AXE: Record<Axe, string> = {
  vendeur: 'Vendeurs',
  site: 'Concessions',
  plaque: 'Plaques',
  table: 'Tables',
  groupe: 'Groupe',
};

export function Dashboard() {
  const [campagnes, setCampagnes] = useState<CampagneResume[]>([]);
  const [campagneId, setCampagneId] = useState<string | null>(null);
  const [donnees, setDonnees] = useState<DonneesDashboard | null>(null);
  const [axe, setAxe] = useState<Axe>('site');
  const [critere, setCritere] = useState<'global' | 'vn' | 'vo'>('global');
  const [comparaisonAvec, setComparaisonAvec] = useState('');
  const [comparaison, setComparaison] = useState<Comparaison | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [exportEnCours, setExportEnCours] = useState(false);

  const { donnees: referentiels } = useReferentiels();

  const marques = useMemo(
    () => referentiels?.marques ?? [],
    [referentiels]
  );

  useEffect(() => {
    chargerCampagnes()
      .then((cs) => {
        setCampagnes(cs);
        const ouverte = cs.find((c) => !c.cloturee) ?? cs[0];
        if (ouverte) setCampagneId(ouverte.id);
        else setChargement(false);
      })
      .catch((e) => {
        setErreur(e instanceof Error ? e.message : 'Chargement impossible.');
        setChargement(false);
      });
  }, []);

  const recharger = useCallback(async (id: string) => {
    setDonnees(await chargerDashboard(id));
  }, []);

  useEffect(() => {
    if (!campagneId) return;
    setChargement(true);
    setComparaison(null);
    setComparaisonAvec('');
    recharger(campagneId)
      .catch((e) => setErreur(e instanceof Error ? e.message : 'Chargement impossible.'))
      .finally(() => setChargement(false));
  }, [campagneId, recharger]);

  // F-D.8. Les evenements de saisie, pas une interrogation periodique.
  useTempsReel(campagneId, {
    'rdv:cree': () => campagneId && void recharger(campagneId).catch(() => undefined),
    'rdv:modifie': () => campagneId && void recharger(campagneId).catch(() => undefined),
    'rdv:archive': () => campagneId && void recharger(campagneId).catch(() => undefined),
    'tables:modifiees': () => campagneId && void recharger(campagneId).catch(() => undefined),
  });

  const lancerComparaison = (autreId: string) => {
    setComparaisonAvec(autreId);
    setComparaison(null);
    if (autreId === '' || !campagneId) return;
    chargerComparaison(campagneId, autreId, axe)
      .then(setComparaison)
      .catch((e) => setErreur(e instanceof Error ? e.message : 'Comparaison impossible.'));
  };

  // Changer d'axe invalide la comparaison en cours : elle porte sur un axe.
  useEffect(() => {
    if (comparaisonAvec !== '' && campagneId) {
      chargerComparaison(campagneId, comparaisonAvec, axe)
        .then(setComparaison)
        .catch(() => setComparaison(null));
    }
  }, [axe, comparaisonAvec, campagneId]);

  const exporter = async () => {
    if (!donnees || !campagneId) return;
    setErreur(null);
    setExportEnCours(true);
    try {
      // LE DETAIL NOMINATIF VIENT DE `services/saisie.ts`, jamais du dashboard : les
      // agregats ne portent aucun nom de client, et c'est voulu. La route de
      // saisie applique le portail, donc l'export contient exactement ce que ce
      // compte voit deja a l'ecran — ni plus, ni moins.
      const perimetre = await chargerSaisie(campagneId);
      exporterDashboard(donnees, perimetre, marques);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Export impossible.');
    } finally {
      setExportEnCours(false);
    }
  };

  if (chargement && !donnees) return <div className="attente">Chargement du tableau de bord…</div>;
  if (erreur && !donnees) return <div className="erreur-bloc">{erreur}</div>;
  if (!donnees) return <div className="attente">Aucune campagne.</div>;

  const lignes = donnees.totaux[axe];
  const rangs: Rang[] =
    axe === 'vendeur'
      ? donnees.classementVendeurs
      : axe === 'table'
        ? donnees.classementTables
        : donnees.classementsSites[critere];

  const groupe = donnees.totaux.groupe[0];
  const meilleure = donnees.classementsSites.global[0] ?? null;
  const aZero = donnees.totaux.site.filter((t) => t.total === 0).length;

  return (
    <section className="ecran">
      <header className="ecran-entete">
        <div>
          <h2>Tableau de bord</h2>
          <p className="note">
            Remplace trois onglets du fichier : les totaux, le suivi comparé à une campagne
            antérieure, et les classements. <strong>Rien n’est stocké</strong> — chaque nombre est
            recalculé à la lecture, et l’effectif est calculé, jamais saisi.
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
          <button
            type="button"
            className="principal"
            onClick={() => void exporter()}
            disabled={exportEnCours}
          >
            {exportEnCours ? 'Export…' : 'Exporter en Excel'}
          </button>
        </div>
      </header>

      {erreur && <div className="erreur-bloc">{erreur}</div>}

      {/* LES CHIFFRES CLES EN PREMIER. Le total se cachait dans un coin de
          l'en-tete pendant que la moitie de l'ecran restait vide. */}
      <BandeauKpi
        kpis={[
          {
            libelle: 'RDV obtenus',
            valeur: groupe?.total ?? 0,
            detail: `${groupe?.vn ?? 0} VN · ${groupe?.vo ?? 0} VO`,
            maitresse: true,
          },
          {
            libelle: 'Effectif',
            valeur: groupe?.effectif ?? 0,
            detail: 'calculé, jamais saisi',
          },
          {
            libelle: 'Moyenne / vendeur',
            valeur: groupe?.moyenne ?? 0,
            detail: 'sur le périmètre entier',
          },
          {
            libelle: 'Meilleure concession',
            valeur: meilleure ? meilleure.total : 0,
            detail: meilleure ? meilleure.libelle : '—',
          },
          {
            libelle: 'Concessions à zéro',
            valeur: aZero,
            detail: `sur ${donnees.totaux.site.length}`,
          },
        ]}
      />

      <div className="barre-outils">
        <div className="segments">
          {AXES.filter((a) => a !== 'groupe').map((a) => (
            <button
              key={a}
              type="button"
              className={axe === a ? 'segment actif' : 'segment'}
              onClick={() => setAxe(a)}
            >
              {LIBELLES_AXE[a]}
            </button>
          ))}
        </div>

        <div className="ligne-formulaire">
          <select
            value={comparaisonAvec}
            onChange={(e) => lancerComparaison(e.target.value)}
            aria-label="Comparer à"
          >
            <option value="">Comparer à…</option>
            {campagnes
              .filter((c) => c.id !== campagneId)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.libelle}
                </option>
              ))}
          </select>
        </div>
      </div>

      {/* ----------------------------------------- graphiques cote a cote */}
      <div className="grille-graphiques">
        <div className="carte">
          <h3>
            Par jour
            <span className="etiquette">{donnees.parJour.length} jours</span>
          </h3>
          <p className="note">
            La ligne 2 des onglets site du fichier. Sur deux onglets — Gaillac et Carmaux — sa
            formule portait un <code>#REF!</code> et affichait un chiffre figé, faux de 10 et 25
            RDV. Ici il est recalculé.
          </p>
          <BarresParJour
            barres={donnees.parJour.map((j) => ({
              cle: j.jour,
              libelle: libelleJour(j.jour).replace(/ /, '\n'),
              valeur: j.total,
              part: j.vn,
              detail: `${j.vn} VN · ${j.vo} VO`,
            }))}
          />
        </div>

        <div className="carte">
          <h3>
            Tête du classement
            <span className="etiquette">
              {critere === 'global' ? 'général' : critere.toUpperCase()}
            </span>
          </h3>
          <p className="note">
            Les concessions, sur le critère choisi dans le classement plus bas. Départage
            déterministe — jamais l’astuce <code>valeur − ROW()/1000000</code> du fichier.
          </p>
          <BarresHorizontales
            barres={donnees.classementsSites[critere].map((r) => ({
              cle: r.cle,
              libelle: r.libelle,
              valeur: critere === 'global' ? r.total : critere === 'vn' ? r.vn : r.vo,
            }))}
          />
        </div>
      </div>

      {/* -------------------------------------------------- totaux par axe */}
      <div className="carte">
        <h3>
          {LIBELLES_AXE[axe]}
          <span className="etiquette">{lignes.length}</span>
        </h3>
        <TableauTotaux lignes={lignes} marques={marques} comparaison={comparaison} />
      </div>

      {/* -------------------------------------------------- classement */}
      <div className="carte">
        <h3>
          Classement — {LIBELLES_AXE[axe]}
          {(axe === 'site' || axe === 'plaque') && (
            <span className="segments">
              {(['global', 'vn', 'vo'] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  className={critere === c ? 'segment actif' : 'segment'}
                  onClick={() => setCritere(c)}
                >
                  {c === 'global' ? 'Général' : c.toUpperCase()}
                </button>
              ))}
            </span>
          )}
        </h3>
        <p className="note">
          Départage des ex æquo : <strong>total décroissant, puis VN décroissant, puis le libellé</strong>.
          Déterministe et documenté — jamais l’astuce <code>valeur − ROW()/1000000</code> du fichier,
          qui dépendait de la position de la ligne.
        </p>
        {axe === 'plaque' ? (
          <p className="note">Le classement porte sur les concessions et les vendeurs.</p>
        ) : (
          <ol className="classement-complet">
            {rangs.map((r) => (
              <li key={r.cle}>
                <span className="rang">{r.rang}</span>
                <span className="libelle">
                  {r.libelle}
                  {r.exAequo && <span className="etiquette">ex æquo</span>}
                </span>
                <span className="detail">
                  {r.effectif} vend. · {r.moyenne} / vend.
                </span>
                <strong>
                  {axe === 'site' && critere === 'vn'
                    ? r.vn
                    : axe === 'site' && critere === 'vo'
                      ? r.vo
                      : r.total}
                </strong>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- tableau

function TableauTotaux({
  lignes,
  marques,
  comparaison,
}: {
  lignes: Totaux[];
  marques: { id: string; libelle: string }[];
  comparaison: Comparaison | null;
}) {
  const ecarts = useMemo(
    () => new Map((comparaison?.ecarts ?? []).map((e) => [e.cle, e])),
    [comparaison]
  );

  if (lignes.length === 0) {
    return <p className="note">Aucune ligne sur cet axe pour cette campagne.</p>;
  }

  /// UN ZERO RESTE LISIBLE MAIS CESSE D'ATTIRER L'OEIL. Sur dix-neuf concessions
  /// dont dix-sept a zero, c'est ce qui fait ressortir les deux qui comptent —
  /// sans mettre quoi que ce soit en gras.
  const nb = (v: number) => <span className={v === 0 ? 'zero' : ''}>{v}</span>;

  return (
    <div className="tableau-defilant">
      <table className="tableau">
        <thead>
          <tr>
            <th>Libellé</th>
            <th className="nombre">RDV</th>
            <th className="nombre">VN</th>
            <th className="nombre">VO</th>
            {marques.map((m) => (
              <th key={m.id} className="nombre">
                {m.libelle}
              </th>
            ))}
            <th className="nombre debut-groupe">Effectif</th>
            <th className="nombre">Moy.</th>
            {comparaison && (
              <>
                <th className="nombre debut-groupe">{comparaison.anterieure.libelle}</th>
                <th className="nombre">Écart</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {lignes.map((l) => {
            const e = ecarts.get(l.cle);
            return (
              <tr key={l.cle}>
                <td>{l.libelle}</td>
                <td className="nombre">
                  {l.total === 0 ? nb(0) : <strong>{l.total}</strong>}
                </td>
                <td className="nombre">{nb(l.vn)}</td>
                <td className="nombre">{nb(l.vo)}</td>
                {marques.map((m) => (
                  <td key={m.id} className="nombre">
                    {nb(l.parMarque[m.id] ?? 0)}
                  </td>
                ))}
                <td className="nombre debut-groupe">{l.effectif}</td>
                <td className="nombre">{nb(l.moyenne)}</td>
                {comparaison && (
                  <>
                    <td className="nombre debut-groupe">{e?.totalAnterieur ?? 0}</td>
                    <td className={`nombre ${(e?.ecart ?? 0) < 0 ? 'alerte' : ''}`}>
                      {e ? (e.ecart > 0 ? `+${e.ecart}` : e.ecart) : '—'}
                      {e?.variation !== null && e?.variation !== undefined && (
                        <span className="detail"> {e.variation > 0 ? '+' : ''}{e.variation} %</span>
                      )}
                    </td>
                  </>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
