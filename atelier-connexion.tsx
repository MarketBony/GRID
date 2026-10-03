import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import './styles/composants-anciens.css';
import './styles/v2.css';
import { FournisseurSession } from './contexts/SessionContext';
import { Connexion } from './pages/Connexion';
import { IntroGrid } from './components/connexion/IntroGrid';

// ============================================================================
// ATELIER DE LA CONNEXION — servi en developpement, exclu du build (CLAUDE.md).
// Monte le VRAI ecran de connexion, meme quand une session est ouverte dans le
// navigateur, et rejoue l'entree animee a la demande. Bascule clair/sombre en
// haut a droite : la connexion doit rester sombre dans les deux cas.
// ============================================================================

function Atelier() {
  const [intro, setIntro] = useState(0);
  return (
    <FournisseurSession>
      <Connexion />
      <div style={{ position: 'fixed', top: 12, right: 12, zIndex: 10000, display: 'flex', gap: 8 }}>
        <button type="button" onClick={() => document.documentElement.classList.toggle('dark')}>Clair / sombre</button>
        <button type="button" onClick={() => setIntro((n) => n + 1)}>Rejouer l'entrée</button>
      </div>
      {intro > 0 && <IntroGrid key={intro} onFin={() => {}} />}
    </FournisseurSession>
  );
}

createRoot(document.getElementById('r')!).render(<Atelier />);
