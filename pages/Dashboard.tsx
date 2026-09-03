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
import {
  basculer,
  comparerSelon,
  EnTeteTriable,
  type SensNaturel,
  type Tri,
} from '../components/EnTeteTriable';
// Tri des libelles SANS dependre de la locale du navigateur. Source unique.
import { cleTri, comparerLibelle } from '../backend/src/utils/tri';
import { choisirDansListe, useCampagneCourante } from '../contexts/CampagneContext';

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

type Critere = 'global' | 'vn' | 'vo';

/// La valeur d'une ligne selon le critere affiche. Trois lignes, mais elles
/// etaient ecrites en double — une fois dans le graphique, une fois dans le
/// classement, et la seconde portait en plus un `axe === 'site'` qui faisait
/// afficher le TOTAL a la place du VN des qu'on regardait un autre axe.
const valeurCritere = (l: { total: number; vn: number; vo: number }, critere: Critere) =>
  critere === 'global' ? l.total : critere === 'vn' ? l.vn : l.vo;

export function Dashboard() {
  const [campagnes, setCampagnes] = useState<CampagneResume[]>([]);
  // LA CAMPAGNE COURANTE EST PARTAGEE, pas locale : `App` demonte cet ecran quand
  // on change d'onglet, et un `useState` mourrait avec lui. Voir
  // `contexts/CampagneContext.tsx`.
  const { campagneId, choisir: setCampagneId } = useCampagneCourante();
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
        const retenue = choisirDansListe(cs, campagneId, (l) => l.find((c) => !c.cloturee) ?? l[0]);
        if (retenue) setCampagneId(retenue);
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
  // UNE INDEXATION, plus un `if` par axe. Les cinq axes et les trois criteres ont
  // desormais la meme forme cote service — voir `services/dashboard.ts`.
  const rangs: Rang[] = donnees.classements[axe][critere];

  const groupe = donnees.totaux.groupe[0];
  const meilleure = donnees.classements.site.global[0] ?? null;
  const aZero = donnees.totaux.site.filter((t) => t.total === 0).length;

  return (
    <section className="ecran">
      <header className="ecran-entete">
        <div>
          <h2>Tableau de bord</h2>
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
            detail: 'vendeurs présents',
          },
          {
            libelle: 'Moyenne / vendeur',
            valeur: groupe?.moyenne ?? 0,
            detail: 'RDV par vendeur',
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

        {/* LE CRITERE EST ICI, plus dans le titre du classement en bas de page.
            Il gouverne le graphique ET le classement, donc il appartient a la
            barre d'outils avec l'axe. Enfoui dans un `h3`, il commandait deux
            blocs sans etre visible depuis l'un des deux. */}
        <div className="segments">
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
            <span className="etiquette">{LIBELLES_AXE[axe]}</span>
            <span className="etiquette">
              {critere === 'global' ? 'général' : critere.toUpperCase()}
            </span>
          </h3>
          {/* IL SUIT L'AXE CHOISI. Il ne montrait que les concessions, quel que
              soit le segment selectionne : choisir « Vendeurs » changeait le
              tableau et le classement du bas, mais pas ce graphique — d'ou
              l'impression, legitime, qu'il n'y avait pas de classement des
              vendeurs. */}
          <BarresHorizontales
            barres={rangs.map((r) => ({
              cle: r.cle,
              libelle: r.libelle,
              valeur: valeurCritere(r, critere),
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
        <TableauTotaux
          lignes={lignes}
          marques={marques}
          comparaison={comparaison}
          critere={critere}
        />
      </div>

      {/* -------------------------------------------------- classement */}
      <div className="carte">
        <h3>
          Classement — {LIBELLES_AXE[axe]}
          <span className="etiquette">{rangs.length}</span>
        </h3>
        {rangs.length === 0 ? (
          <p className="note">Rien à classer sur cette campagne.</p>
        ) : (
          // DEFILEMENT PROPRE, et non la page entiere : sur l'axe « Vendeurs »
          // cette liste fait 104 lignes, et elle poussait le classement hors de
          // l'ecran pour tout le monde.
          <ol className="classement-complet defilant">
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
                <strong>{valeurCritere(r, critere)}</strong>
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
  critere,
}: {
  lignes: Totaux[];
  marques: { id: string; libelle: string }[];
  comparaison: Comparaison | null;
  critere: Critere;
}) {
  const ecarts = useMemo(
    () => new Map((comparaison?.ecarts ?? []).map((e) => [e.cle, e])),
    [comparaison]
  );

  // Le tri part du critere affiche : arriver sur « VO » et voir le tableau classe
  // par total general obligerait a recliquer a chaque fois.
  const [tri, setTri] = useState<Tri>({ colonne: critere, croissant: false });
  useEffect(() => setTri({ colonne: critere, croissant: false }), [critere]);

  /// La valeur d'une ligne pour une colonne. UN SEUL ENDROIT decide ce que
  /// « trier par Dacia » veut dire, et c'est celui-la : l'en-tete ne connait que
  /// le nom de la colonne.
  const valeurColonne = (l: Totaux, colonne: string): number | string => {
    if (colonne === 'libelle') return cleTri(l.libelle);
    if (colonne === 'global') return l.total;
    if (colonne === 'vn') return l.vn;
    if (colonne === 'vo') return l.vo;
    if (colonne === 'effectif') return l.effectif;
    if (colonne === 'moyenne') return l.moyenne;
    if (colonne === 'anterieur') return ecarts.get(l.cle)?.totalAnterieur ?? 0;
    if (colonne === 'ecart') return ecarts.get(l.cle)?.ecart ?? 0;
    if (colonne.startsWith('marque:')) return l.parMarque[colonne.slice(7)] ?? 0;
    return 0;
  };

  /// LE TRI EST TOTAL, et ce n'est pas un detail de confort. Sur dix-neuf
  /// concessions dont dix-sept a zero, un tri par RDV laisse dix-sept lignes a
  /// egalite : sans second critere leur ordre relatif n'est pas garanti d'un
  /// rendu a l'autre, et une liste qui se reordonne toute seule sous les yeux est
  /// exactement ce que ce produit reproche au fichier. Le departage est le
  /// LIBELLE, toujours croissant — le meme que `classer` prend en dernier
  /// recours, et il est unique par axe.
  const triees = useMemo(() => {
    const copie = [...lignes];
    copie.sort((a, b) => {
      const va = valeurColonne(a, tri.colonne);
      const vb = valeurColonne(b, tri.colonne);
      const primaire = comparerSelon(va, vb, tri.croissant);
      return primaire !== 0 ? primaire : comparerLibelle(a.libelle, b.libelle);
    });
    return copie;
  }, [lignes, tri, ecarts]);

  const trier = (colonne: string, naturel: SensNaturel) =>
    setTri((t) => basculer(t, colonne, naturel));

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
            <EnTeteTriable colonne="libelle" libelle="Libellé" tri={tri} onTrier={trier} />
            <EnTeteTriable
              colonne="global"
              libelle="RDV"
              tri={tri}
              onTrier={trier}
              classe="nombre"
              naturel="nombre"
            />
            <EnTeteTriable
              colonne="vn"
              libelle="VN"
              tri={tri}
              onTrier={trier}
              classe="nombre"
              naturel="nombre"
            />
            <EnTeteTriable
              colonne="vo"
              libelle="VO"
              tri={tri}
              onTrier={trier}
              classe="nombre"
              naturel="nombre"
            />
            {marques.map((m) => (
              <EnTeteTriable
                key={m.id}
                colonne={`marque:${m.id}`}
                libelle={m.libelle}
                tri={tri}
                onTrier={trier}
                classe="nombre"
                naturel="nombre"
              />
            ))}
            <EnTeteTriable
              colonne="effectif"
              libelle="Effectif"
              tri={tri}
              onTrier={trier}
              classe="nombre debut-groupe"
              naturel="nombre"
            />
            <EnTeteTriable
              colonne="moyenne"
              libelle="Moy."
              tri={tri}
              onTrier={trier}
              classe="nombre"
              naturel="nombre"
            />
            {comparaison && (
              <>
                <EnTeteTriable
                  colonne="anterieur"
                  libelle={comparaison.anterieure.libelle}
                  tri={tri}
                  onTrier={trier}
                  classe="nombre debut-groupe"
                  naturel="nombre"
                />
                <EnTeteTriable
                  colonne="ecart"
                  libelle="Écart"
                  tri={tri}
                  onTrier={trier}
                  classe="nombre"
                  naturel="nombre"
                />
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {triees.map((l) => {
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
