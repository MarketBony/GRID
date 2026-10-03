import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { FournisseurSession } from './contexts/SessionContext';
import { FournisseurTheme } from './contexts/ThemeContext';
import { FournisseurCampagne } from './contexts/CampagneContext';
import { configurationSupabase } from './services/supabase';
import './styles/composants-anciens.css';
import './styles/v2.css';
import { appliquerPreferenceAnimations } from './pages/Reglages';

const racine = document.getElementById('racine');
if (!racine) throw new Error("Element #racine introuvable dans index.html");

/// UNE CONFIGURATION MANQUANTE DOIT SE VOIR, PAS FAIRE UNE PAGE BLANCHE.
///
/// La premiere version levait une exception au chargement de `services/supabase.ts`.
/// Une exception a l'import empeche React de monter : a l'ecran, cela donne le fond
/// degrade et RIEN d'autre. Constate en vrai sur le premier deploiement Cloudflare,
/// et diagnostiquable seulement en ouvrant la console — ce qu'un utilisateur ne fait
/// pas.
///
/// Ce produit refuse les echecs muets partout ailleurs ; il n'y a aucune raison de
/// s'en accorder un ici, au seul endroit ou l'application ne demarre pas du tout.
function EcranConfiguration({ manquantes }: { manquantes: string[] }) {
  return (
    <div className="connexion">
      <div className="glass-strong" style={{ borderRadius: 'var(--rayon)', padding: '1.6rem' }}>
        <span className="logotype">
          <img className="logotype-marque" src="/grid.svg" alt="" aria-hidden="true" />
          <span className="logotype-mot">GRID</span>
        </span>

        <h2 style={{ marginTop: '1.2rem' }}>Configuration incomplète</h2>
        <p className="note">
          L’application ne sait pas à quelle base se connecter. {manquantes.length > 1
            ? 'Ces variables sont absentes'
            : 'Cette variable est absente'} du build :
        </p>
        <ul className="note">
          {manquantes.map((v) => (
            <li key={v}>
              <code>{v}</code>
            </li>
          ))}
        </ul>
        <p className="note">
          <strong>Elles doivent être des variables de BUILD, pas d’exécution.</strong> Vite les
          fige dans le bundle au moment de la compilation : une variable déclarée côté
          hébergeur pour l’exécution ne sera jamais lue par un fichier déjà compilé.
        </p>
        <p className="note">
          En développement, les copier depuis <code>backend/.env.supabase.example</code> vers un
          fichier <code>.env</code> à la racine, puis relancer le serveur — Vite ne relit pas le{' '}
          <code>.env</code> à chaud.
        </p>
      </div>
    </div>
  );
}

// La preference « animations reduites » s'applique AVANT le premier rendu : sinon
// les entrees animees de la premiere page joueraient quand meme.
appliquerPreferenceAnimations();

// LE SERVICE WORKER, en production seulement : en developpement il servirait des
// fichiers perimes a Vite. Une nouvelle version S'ANNONCE (evenement
// `grid:nouvelle-version`, ecoute par la coquille) ; elle ne recharge jamais la
// page d'elle-meme — pas au milieu d'une saisie.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((enr) => {
        enr.addEventListener('updatefound', () => {
          const nouveau = enr.installing;
          nouveau?.addEventListener('statechange', () => {
            if (nouveau.state === 'installed' && navigator.serviceWorker.controller) {
              window.dispatchEvent(new CustomEvent('grid:nouvelle-version', { detail: nouveau }));
            }
          });
        });
      })
      .catch(() => undefined);
  });
}

createRoot(racine).render(
  <StrictMode>
    <FournisseurTheme>
      {configurationSupabase.complete ? (
        <FournisseurSession>
          <FournisseurCampagne>
            <App />
          </FournisseurCampagne>
        </FournisseurSession>
      ) : (
        <EcranConfiguration manquantes={configurationSupabase.manquantes} />
      )}
    </FournisseurTheme>
  </StrictMode>
);
