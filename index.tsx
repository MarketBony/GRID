import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { FournisseurSession } from './contexts/SessionContext';
import { FournisseurTheme } from './contexts/ThemeContext';
import './index.css';

const racine = document.getElementById('racine');
if (!racine) throw new Error("Element #racine introuvable dans index.html");

createRoot(racine).render(
  <StrictMode>
    <FournisseurTheme>
      <FournisseurSession>
        <App />
      </FournisseurSession>
    </FournisseurTheme>
  </StrictMode>
);
