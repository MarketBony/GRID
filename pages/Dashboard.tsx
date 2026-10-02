import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AXES,
  appliquerRdv,
  chargerComparaison,
  chargerDashboard,
  type Axe,
  type Comparaison,
  type Dashboard as DonneesDashboard,
  type EvenementRdv,
  type Rang,
  type Totaux,
} from '../services/dashboard';
import { chargerCampagnes, type CampagneResume } from '../services/campagnes';
import { totauxParJour } from '../backend/src/utils/agregats';
import { chargerSaisie } from '../services/saisie';
import { useReferentiels } from '../hooks/useReferentiels';
import { useTempsReel } from '../hooks/useTempsReel';
import {
  FENETRE_VUE_ENSEMBLE,
  useRechargementCoalesce,
} from '../hooks/useRechargementCoalesce';
import { exporterDashboard } from '../utils/exportExcel';
import { libelleJour } from '../utils/grille';
import { BandeauKpi, BarresHorizontales, BarresParJour } from '../components/Graphiques';
import { Segmente } from '../components/Segmente';
import { MenuMultiple } from '../components/MenuMultiple';
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

  /// FILTRES DU CLASSEMENT — plaques et sites, choix MULTIPLE, demandes apres
  /// l'exercice du 08/09/2026. Vide = aucun filtre, et c'est le seul etat qui
  /// signifie « tout » : un filtre qui contiendrait toutes les valeurs se
  /// lirait pareil a l'ecran mais cesserait de suivre l'arrivee d'un site.
  const [plaquesRetenues, setPlaquesRetenues] = useState<string[]>([]);
  const [sitesRetenus, setSitesRetenus] = useState<string[]>([]);
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
  //
  // REGROUPES DEPUIS L'INCIDENT DU 08/09/2026. Le tableau de bord est le poste le
  // plus couteux du produit — il recalcule les agregats de TOUTE la campagne — et
  // il recevait un evenement par RDV saisi n'importe ou dans le groupe. Ouvert sur
  // un ecran collectif pendant une session a 258 RDV/heure, un seul onglet
  // declenchait 258 recalculs complets. Ils sont desormais regroupes par fenetre,
  // avec une gigue : les chiffres retardent de moins d'une minute, ce qui est sans
  // consequence pour un ecran qu'on regarde, et ne coute plus la session.
  const majTableau = useRechargementCoalesce(() => {
    if (campagneId) void recharger(campagneId).catch(() => undefined);
  }, FENETRE_VUE_ENSEMBLE);

  // LE MESSAGE S'APPLIQUE EN MEMOIRE depuis le 03/10/2026 (lot 1 de
  // PLAN-GRID-V2.md) : il porte tout ce que le tableau compte. Un ecran collectif
  // ouvert pendant une seance ne coute plus une requete par fenetre de 30 s. Le
  // rechargement regroupe ne sert plus qu'aux cas que la memoire ne sait pas
  // trancher (vendeur cree depuis le chargement) et aux tables recomposees.
  const donneesRef = useRef<DonneesDashboard | null>(null);
  donneesRef.current = donnees;

  useTempsReel(campagneId, {
    'rdv:modifie': (charge) => {
      const d = donneesRef.current;
      if (!d) return;
      const suivant = appliquerRdv(d, (charge ?? {}) as EvenementRdv);
      if (suivant) setDonnees(suivant);
      else majTableau();
    },
    'tables:modifiees': majTableau,
    reconnecte: majTableau,
  });

  // Resynchronisation de securite, toutes les ~5 minutes, decalee au hasard par
  // poste : elle rattrape un message perdu sans jamais faire repartir les ecrans
  // ensemble. Meme regle que l'ecran de saisie.
  useEffect(() => {
    if (!campagneId) return;
    const t = window.setInterval(
      () => void recharger(campagneId).catch(() => undefined),
      5 * 60_000 + Math.random() * 60_000
    );
    return () => window.clearInterval(t);
  }, [campagneId, recharger]);

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

  // ------------------------------------------------------- filtres du classement
  //
  // OU S'APPLIQUENT-ILS. La plaque vaut pour tout axe dont le rattachement est
  // connu ; le site ne vaut que pour les vendeurs et les sites. UNE TABLE MELANGE
  // LES SITES par construction — « 5 vendeurs de 5 concessions differentes », c'est
  // tout l'interet de l'exercice — donc la filtrer par site n'aurait aucun sens.
  const { siteVersPlaque, tableVersPlaque, vendeurVersSite } = donnees.rattachements;
  const filtrePlaqueSApplique = axe === 'vendeur' || axe === 'site' || axe === 'table' || axe === 'plaque';
  const filtreSiteSApplique = axe === 'vendeur' || axe === 'site';

  /// Le rattachement d'une LIGNE de classement, selon l'axe courant. Jamais
  /// derive du libelle : il vient des tables de correspondance du service.
  const rattachementLigne = (cle: string): { siteId: string | null; plaqueId: string | null } => {
    switch (axe) {
      case 'vendeur': {
        const siteId = vendeurVersSite[cle] ?? null;
        return { siteId, plaqueId: siteId ? (siteVersPlaque[siteId] ?? null) : null };
      }
      case 'site':
        return { siteId: cle, plaqueId: siteVersPlaque[cle] ?? null };
      case 'table':
        return { siteId: null, plaqueId: tableVersPlaque[cle] ?? null };
      case 'plaque':
        return { siteId: null, plaqueId: cle };
      default:
        return { siteId: null, plaqueId: null };
    }
  };

  const retenue = (cle: string): boolean => {
    const { siteId, plaqueId } = rattachementLigne(cle);
    if (filtrePlaqueSApplique && plaquesRetenues.length > 0) {
      if (plaqueId === null || !plaquesRetenues.includes(plaqueId)) return false;
    }
    if (filtreSiteSApplique && sitesRetenus.length > 0) {
      if (siteId === null || !sitesRetenus.includes(siteId)) return false;
    }
    return true;
  };

  const filtreActif =
    (filtrePlaqueSApplique && plaquesRetenues.length > 0) ||
    (filtreSiteSApplique && sitesRetenus.length > 0);

  // LE TABLEAU DES TOTAUX ET LE CLASSEMENT SUIVENT LE MEME FILTRE. Deux listes
  // du meme axe qui ne montreraient pas les memes lignes seraient un piege :
  // c'est exactement l'ecart 1107/1105 sous une autre forme.
  const lignes = filtreActif ? donnees.totaux[axe].filter((t) => retenue(t.cle)) : donnees.totaux[axe];
  // UNE INDEXATION, plus un `if` par axe. Les cinq axes et les trois criteres ont
  // desormais la meme forme cote service — voir `services/dashboard.ts`.
  const tousLesRangs: Rang[] = donnees.classements[axe][critere];
  // LES RANGS NE SONT PAS RECALCULES. Un vendeur 7e du groupe reste 7e quand on
  // filtre sur son site : le filtre CHOISIT QUI ON REGARDE, il ne refait pas le
  // classement. Renumeroter donnerait deux verites pour le meme vendeur selon
  // l'ecran ouvert.
  const rangs: Rang[] = filtreActif ? tousLesRangs.filter((r) => retenue(r.cle)) : tousLesRangs;

  /// LE GRAPHIQUE PAR JOUR SUIT LES FILTRES, ET C'EST UN RECALCUL.
  ///
  /// Il affichait `donnees.parJour` — un agregat calcule UNE FOIS par le service
  /// sur toute la campagne — et ignorait donc les menus plaque/site ET le
  /// critere VN/VO. Signale par l'utilisateur le 10/09/2026.
  ///
  /// On rejoue `totauxParJour`, la fonction PURE deja employee par le service et
  /// couverte par `test:agregats`, sur le sous-ensemble de vendeurs retenu. Pas
  /// de comptage par jour recode ici : ce serait une seconde implementation de
  /// la meme regle, donc deux verites a redemontrer.
  ///
  /// LE FILTRE PORTE SUR LES VENDEURS, pas sur les lignes de classement. Une
  /// ligne de classement appartient a l'axe courant (une table, une plaque) ;
  /// `totauxParJour` veut savoir quels VENDEURS compter. Les deux gardes sont
  /// les memes que pour le classement — un filtre site invisible a l'ecran ne
  /// doit pas agir en douce quand on passe sur l'axe « Tables ».
  const vendeursRetenus = filtreActif
    ? donnees.vendeurs.filter((v) => {
        if (filtrePlaqueSApplique && plaquesRetenues.length > 0
            && !plaquesRetenues.includes(v.plaqueId)) return false;
        if (filtreSiteSApplique && sitesRetenus.length > 0
            && !sitesRetenus.includes(v.siteId)) return false;
        return true;
      })
    : donnees.vendeurs;

  const parJour = filtreActif
    ? totauxParJour(donnees.rdvs, donnees.campagne.jours, vendeursRetenus)
    : donnees.parJour;

  /// LE CRITERE COMMANDE LA HAUTEUR DE LA BARRE. Sur « VN » ou « VO », la barre
  /// vaut ce seau et non le total — sinon le segmente ne gouvernait que le
  /// classement, et deux commandes voisines n'agissaient pas sur les memes
  /// blocs.
  ///
  /// `part` — la surimpression qui montre la part VN dans le total — n'a de sens
  /// qu'en « General ». Sur « VN » elle vaudrait la barre entiere, sur « VO »
  /// zero : dans les deux cas elle n'apprend rien.
  const barresParJour = parJour.map((j) => ({
    cle: j.jour,
    libelle: libelleJour(j.jour).replace(/ /, '\n'),
    valeur: critere === 'vn' ? j.vn : critere === 'vo' ? j.vo : j.total,
    part: critere === 'global' ? j.vn : undefined,
    detail:
      critere === 'vn' ? `${j.vn} VN` : critere === 'vo' ? `${j.vo} VO` : `${j.vn} VN · ${j.vo} VO`,
  }));

  /// Les plaques, depuis les SESSIONS de la campagne : ce sont celles qui y
  /// participent, et non les quatre du referentiel.
  const plaquesDisponibles = donnees.sessions
    .map((s) => ({ id: s.plaqueId, libelle: s.plaqueLibelle }))
    .sort((a, b) => a.libelle.localeCompare(b.libelle, 'fr'));

  /// Les sites, restreints aux plaques retenues quand il y en a : sans ca la
  /// rangee compte vingt puces et devient illisible.
  const sitesDisponibles = donnees.totaux.site
    .filter((t) => plaquesRetenues.length === 0 || plaquesRetenues.includes(siteVersPlaque[t.cle] ?? ''))
    .map((t) => ({ id: t.cle, libelle: t.libelle }))
    .sort((a, b) => a.libelle.localeCompare(b.libelle, 'fr'));



  /// CHANGER LES PLAQUES ELAGUE LES SITES RETENUS. Sans ca un site reste retenu
  /// alors qu'il a disparu du menu, et le classement se vide sans que rien a
  /// l'ecran ne l'explique.
  const changerPlaques = (suivantes: string[]) => {
    setPlaquesRetenues(suivantes);
    if (suivantes.length > 0) {
      setSitesRetenus((actuels) =>
        actuels.filter((siteId) => suivantes.includes(siteVersPlaque[siteId] ?? ''))
      );
    }
  };

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
        <Segmente
          etiquette="Axe d'analyse"
          valeur={axe}
          onChange={setAxe}
          options={AXES.filter((a) => a !== 'groupe').map((a) => ({
            valeur: a,
            libelle: LIBELLES_AXE[a],
          }))}
        />

        {/* LE CRITERE EST ICI, plus dans le titre du classement en bas de page.
            Il gouverne le graphique ET le classement, donc il appartient a la
            barre d'outils avec l'axe. Enfoui dans un `h3`, il commandait deux
            blocs sans etre visible depuis l'un des deux. */}
        <Segmente
          etiquette="Critère"
          valeur={critere}
          onChange={setCritere}
          options={[
            { valeur: 'global' as const, libelle: 'Général' },
            { valeur: 'vn' as const, libelle: 'VN' },
            { valeur: 'vo' as const, libelle: 'VO' },
          ]}
        />

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

      {/* ------------------------------------------- filtres plaque / site
          DEUX MENUS DEROULANTS, et non une puce par valeur. La premiere version
          posait une puce par site : vingt puces sur deux rangees, qui
          repoussaient les graphiques sous la ligne de flottaison pour un reglage
          qu'on touche une fois par consultation. Le cout d'affichage d'un filtre
          doit suivre la frequence a laquelle on s'en sert, pas le nombre de
          valeurs qu'il porte.

          Le compte filtre reste ecrit A COTE des menus : c'est la seule chose
          qui dit qu'un filtre est actif quand les deux menus sont fermes. */}
      {filtrePlaqueSApplique && (
        <div className="filtres-classement">
          <MenuMultiple
            etiquette="Plaques"
            libelleVide="Toutes"
            options={plaquesDisponibles.map((p) => ({ id: p.id, libelle: p.libelle }))}
            retenus={plaquesRetenues}
            onChange={changerPlaques}
          />

          {filtreSiteSApplique && (
            <MenuMultiple
              etiquette="Sites"
              libelleVide="Tous"
              options={sitesDisponibles.map((st) => ({ id: st.id, libelle: st.libelle }))}
              retenus={sitesRetenus}
              onChange={setSitesRetenus}
            />
          )}

          {filtreActif && (
            <span className="compte-filtre">
              {rangs.length} sur {tousLesRangs.length}
            </span>
          )}
        </div>
      )}

      {/* ----------------------------------------- graphiques cote a cote */}
      <div className="grille-graphiques">
        <div className="carte">
          <h3>
            Par jour
            <span className="etiquette">{parJour.length} jours</span>
            {critere !== 'global' && (
              <span className="etiquette">{critere.toUpperCase()}</span>
            )}
            {/* L'ETIQUETTE DE FILTRE EST OBLIGATOIRE, pas decorative. Sans elle,
                ce graphique afficherait des chiffres filtres a cote d'un bandeau
                de KPI qui reste sur la campagne entiere : deux nombres qui ne
                s'accordent pas sur le meme ecran, sans que rien ne l'explique.
                C'est l'ecart 1107/1105 sous une autre forme. */}
            {filtreActif && (
              <span className="etiquette">
                {vendeursRetenus.length} vendeurs sur {donnees.vendeurs.length}
              </span>
            )}
          </h3>
          <BarresParJour barres={barresParJour} />
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
