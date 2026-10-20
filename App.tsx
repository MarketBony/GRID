import { lazy, Suspense, useEffect, useState } from 'react';
import { Rempart } from './components/Rempart';
import { Coquille, avecTransition, type Rubrique } from './components/coquille/Coquille';
import { FournisseurCampagne } from './contexts/CampagneContext';
import { useSession } from './contexts/SessionContext';
import { Connexion } from './pages/Connexion';
import { IntroGrid, consommerIntro } from './components/connexion/IntroGrid';
import { Saisie } from './pages/Saisie';
import { ChoisirMotDePasse } from './pages/Reglages';

// LES RUBRIQUES SECONDAIRES SE CHARGENT A LA DEMANDE (lot 4, 03/10/2026). La
// saisie est l'ecran d'accueil d'une seance : elle part dans le premier
// chargement. Le tableau de bord (et ses graphiques), la preparation, le suivi et
// les reglages ne coutent rien tant qu'on ne les ouvre pas.
const Dashboard = lazy(() => import('./pages/Dashboard').then((m) => ({ default: m.Dashboard })));
const Suivi = lazy(() => import('./pages/Suivi').then((m) => ({ default: m.Suivi })));
const Tables = lazy(() => import('./pages/Tables').then((m) => ({ default: m.Tables })));
const Vendeurs = lazy(() => import('./pages/Vendeurs').then((m) => ({ default: m.Vendeurs })));
const Campagne = lazy(() => import('./pages/Campagne').then((m) => ({ default: m.Campagne })));
const Reglages = lazy(() => import('./pages/Reglages').then((m) => ({ default: m.Reglages })));
// GRID/VP (20/10/2026) : un espace a part, charge seulement quand on y entre.
const GridVp = lazy(() => import('./pages/vp/GridVp').then((m) => ({ default: m.GridVp })));

/// L'espace ouvert — GRID classique ou GRID/VP — survit a un rechargement de
/// l'onglet (`sessionStorage`, comme la campagne courante), pas au-dela.
type Espace = 'classique' | 'vp';
const CLE_ESPACE = 'grid.espace';
function lireEspace(): Espace {
  try {
    return window.sessionStorage.getItem(CLE_ESPACE) === 'vp' ? 'vp' : 'classique';
  } catch {
    return 'classique';
  }
}

/// Ce qui s'affiche le temps d'aller chercher une rubrique : un squelette, pas
/// un ecran vide qui se lirait comme une panne.
const Attente = () => (
  <div className="page">
    <div className="skel" style={{ height: 40, width: 260 }} />
    <div className="skel" style={{ height: 220 }} />
  </div>
);

// ============================================================================
// L'APPLICATION — coquille v2 (lot 4 de PLAN-GRID-V2.md).
//
// L'ORDRE DES RUBRIQUES : la SAISIE d'abord, toujours — c'est le coeur du produit
// et l'ecran d'accueil d'un chef de table qui se connecte pendant une seance.
// Puis le tableau de bord, ouvert a TOUT compte actif (les compteurs sont
// publics, c'est ce qui donne un objet au palier Lecteur). Puis la preparation,
// dans l'ordre ou on s'en sert : les effectifs, les vendeurs, la campagne.
// Enfin les Reglages, dont les SECTIONS dependent du palier — la gestion des
// comptes y vit, reservee a `admin` (sans cette frontiere, `direction` pourrait
// se promouvoir administrateur).
//
// La navigation filtree par palier est un CONFORT, pas une securite : chaque
// lecture et chaque ecriture sont revalidees par la RLS (interdit n.5).
// ============================================================================

type Id = 'saisie' | 'suivi' | 'tableau' | 'effectifs' | 'vendeurs' | 'campagnes' | 'reglages';

const TOUTES: Record<Id, Rubrique> = {
  saisie: { id: 'saisie', libelle: 'Saisie', icone: 'saisie' },
  // Le suivi des RDV pris, en concession (lot 6). Memes personnes, meme perimetre.
  suivi: { id: 'suivi', libelle: 'Suivi des RDV', court: 'Suivi', icone: 'suivi' },
  tableau: { id: 'tableau', libelle: 'Tableau de bord', court: 'Tableau', icone: 'tableau' },
  // « Effectifs » et non plus « Tables » (D12) : c'est la gestion des vendeurs
  // presents a chaque session, en mode table comme en mode site.
  effectifs: { id: 'effectifs', libelle: 'Effectifs', icone: 'effectifs' },
  vendeurs: { id: 'vendeurs', libelle: 'Vendeurs', icone: 'vendeurs', secondaire: true },
  campagnes: { id: 'campagnes', libelle: 'Campagnes', icone: 'campagnes', secondaire: true },
  reglages: { id: 'reglages', libelle: 'Réglages', icone: 'reglages' },
};

export default function App() {
  const { session, chargement, deconnexion } = useSession();
  const [active, setActive] = useState<Id>('saisie');
  const [espace, setEspace] = useState<Espace>(lireEspace);
  const changerEspace = (e: Espace) =>
    avecTransition(() => {
      setEspace(e);
      try {
        window.sessionStorage.setItem(CLE_ESPACE, e);
      } catch {
        // sans memoire, l'espace vaut pour la session React
      }
    }, e === 'vp' ? 1 : -1);
  // L'entree animee : seulement apres une connexion reussie, une seule fois.
  const [intro, setIntro] = useState(false);
  useEffect(() => {
    if (session && consommerIntro()) setIntro(true);
  }, [session]);

  if (chargement) return <div className="chargement-initial" role="status" aria-label="Chargement" />;
  if (!session) return <Connexion />;

  const { utilisateur, droits } = session;

  // D14 : un mot de passe remplace par un administrateur se REMPLACE a la
  // connexion suivante. Rien d'autre n'est accessible avant.
  if (utilisateur.doitChangerMdp) {
    return (
      <div className="v2">
        <div className="fond-vivant" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
        <div className="page" style={{ maxWidth: 520, paddingTop: '12vh' }}>
          <div className="card pad verre fort enter">
            <ChoisirMotDePasse obligatoire />
          </div>
          <button type="button" className="btn ghost" onClick={deconnexion} style={{ justifySelf: 'center' }}>
            Se déconnecter
          </button>
        </div>
      </div>
    );
  }

  const ids: Id[] = [
    ...(droits.lecteur && !droits.administre ? [] : (['saisie', 'suivi'] as Id[])),
    'tableau',
    ...(droits.administre ? (['effectifs', 'vendeurs', 'campagnes'] as Id[]) : []),
    'reglages',
  ];
  const rubriques = ids.map((id) => TOUTES[id]);
  const courante: Id = ids.includes(active) ? active : ids[0]!;

  const palier = droits.admin ? 'admin' : droits.direction ? 'direction' : droits.lecteur ? 'lecteur' : 'encadrant';

  // GRID/VP s'ouvre a qui peut saisir : un admin la parametre, un encadrant y
  // saisit et y suit les RDV de SES sites — c'est la RLS qui le decide, pas ce
  // test, qui ne fait qu'afficher le bouton (interdit n.5).
  const accesVp = !(droits.lecteur && !droits.administre);
  if (espace === 'vp' && accesVp) {
    return (
      <>
        {intro && <IntroGrid onFin={() => setIntro(false)} />}
        <FournisseurCampagne nature="vente_privee">
          <Rempart nom="GRID/VP">
            <Suspense fallback={<div className="v2"><Attente /></div>}>
              <GridVp retour={() => changerEspace('classique')} nomCompte={utilisateur.nom} palier={palier} deconnexion={deconnexion} />
            </Suspense>
          </Rempart>
        </FournisseurCampagne>
      </>
    );
  }

  return (
    <>
    {intro && <IntroGrid onFin={() => setIntro(false)} />}
    <Coquille
      rubriques={rubriques}
      active={courante}
      aller={(id) => setActive(id as Id)}
      nomCompte={utilisateur.nom}
      palier={palier}
      deconnexion={deconnexion}
      versVp={accesVp ? () => changerEspace('vp') : undefined}
    >
      {/* Une frontiere PAR RUBRIQUE : un ecran qui casse n'emporte pas la
          navigation avec lui. La cle force le remontage au changement. */}
      <Rempart nom={TOUTES[courante].libelle} key={courante}>
        <Suspense fallback={<Attente />}>
        {courante === 'reglages' ? (
          <Reglages />
        ) : courante === 'suivi' ? (
          <Suivi />
        ) : courante === 'saisie' ? (
          <Saisie />
        ) : courante === 'tableau' ? (
          <Dashboard />
        ) : courante === 'effectifs' && droits.administre ? (
          <Tables />
        ) : courante === 'vendeurs' && droits.administre ? (
          <Vendeurs />
        ) : courante === 'campagnes' && droits.administre ? (
          <Campagne />
        ) : (
          <div className="page page-ancienne">

            {courante === 'effectifs' && droits.administre && <Tables />}
            {courante === 'vendeurs' && droits.administre && <Vendeurs />}
            {courante === 'campagnes' && droits.administre && <Campagne />}
          </div>
        )}
        </Suspense>
      </Rempart>
    </Coquille>
    </>
  );
}
