import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import './styles/composants-anciens.css';
import './styles/v2.css';
import { FournisseurSession } from './contexts/SessionContext';
import { FournisseurTheme } from './contexts/ThemeContext';
import { Connexion } from './pages/Connexion';
import { IntroGrid } from './components/connexion/IntroGrid';
import { Coquille, type Rubrique } from './components/coquille/Coquille';

// ============================================================================
// ATELIER DE LA CONNEXION ET DE LA COQUILLE — servi en developpement, exclu du
// build (CLAUDE.md). Monte le VRAI ecran de connexion, meme quand une session est
// ouverte dans le navigateur, et rejoue l'entree animee a la demande.
// `?coquille` monte la VRAIE Ile, sans session : pour eprouver la goutte et sa
// largeur sans se connecter.
// ============================================================================

const RUBRIQUES: Rubrique[] = [
  { id: 'saisie', libelle: 'Saisie', icone: 'saisie' },
  { id: 'suivi', libelle: 'Suivi des RDV', court: 'Suivi', icone: 'suivi' },
  { id: 'tableau', libelle: 'Tableau de bord', court: 'Tableau', icone: 'tableau' },
  { id: 'effectifs', libelle: 'Effectifs', icone: 'effectifs' },
  { id: 'vendeurs', libelle: 'Vendeurs', icone: 'vendeurs', secondaire: true },
  { id: 'campagnes', libelle: 'Campagnes', icone: 'campagnes', secondaire: true },
  { id: 'reglages', libelle: 'Réglages', icone: 'reglages' },
];

function AtelierCoquille() {
  const [active, setActive] = useState('saisie');
  return (
    <div>
      <Coquille rubriques={RUBRIQUES} active={active} aller={setActive} nomCompte="Atelier" palier="admin" deconnexion={() => {}}>
        <div className="page"><div className="card pad">Rubrique : {active}</div></div>
      </Coquille>
    </div>
  );
}

function AtelierConnexion() {
  const [intro, setIntro] = useState(0);
  return (
    <>
      <Connexion />
      <div style={{ position: 'fixed', top: 12, right: 12, zIndex: 10000, display: 'flex', gap: 8 }}>
        <button type="button" onClick={() => document.documentElement.classList.toggle('dark')}>Clair / sombre</button>
        <button type="button" onClick={() => setIntro((n) => n + 1)}>Rejouer l'entrée</button>
      </div>
      {intro > 0 && <IntroGrid key={intro} onFin={() => {}} />}
    </>
  );
}

createRoot(document.getElementById('r')!).render(
  <FournisseurTheme>
    <FournisseurSession>{location.search.includes('coquille') ? <AtelierCoquille /> : <AtelierConnexion />}</FournisseurSession>
  </FournisseurTheme>
);
