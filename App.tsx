import { useState } from 'react';
import { Rempart } from './components/Rempart';
import { useSession } from './contexts/SessionContext';
import { useTheme } from './contexts/ThemeContext';
import { Connexion } from './pages/Connexion';
import { Vendeurs } from './pages/Vendeurs';
import { Campagne } from './pages/Campagne';
import { Saisie } from './pages/Saisie';
import { Tables } from './pages/Tables';
import { Dashboard } from './pages/Dashboard';
import { Gestion } from './pages/Gestion';

type Onglet = 'saisie' | 'tableau' | 'tables' | 'vendeurs' | 'campagne' | 'gestion';

const LIBELLES: Record<Onglet, string> = {
  saisie: 'Saisie',
  tableau: 'Tableau de bord',
  tables: 'Tables',
  vendeurs: 'Vendeurs',
  campagne: 'Campagnes',
  gestion: 'Comptes',
};

/// Ordre des onglets : la SAISIE d'abord, toujours. C'est le coeur du produit, et
/// l'ecran d'accueil d'un chef de table qui se connecte pendant une session.
/// Viennent ensuite les ecrans de preparation, dans l'ordre ou on les utilise :
/// on compose les tables, on regle les vendeurs, on parametre la campagne.
/// Ecrans d'administration : `admin` ET `direction`.
const ONGLETS_ADMIN: Onglet[] = ['tables', 'vendeurs', 'campagne'];

/// La GESTION DES COMPTES est le seul ecran reserve a `admin`. C'est toute la
/// difference entre les deux paliers hauts, et sa raison d'etre : sans cette
/// frontiere, `direction` pourrait se promouvoir administrateur.
const ONGLETS_GESTION: Onglet[] = ['gestion'];

/// Le tableau de bord est ouvert a TOUT compte actif : les compteurs sont publics,
/// et c'est ce qui donne un objet au role Lecteur. C'est aussi ce que fait le
/// fichier — l'onglet RANK est lisible par tous.
const ONGLETS_TOUS: Onglet[] = ['saisie', 'tableau'];

/// Coquille de l'application. Les modules arrivent dans l'ordre du lotissement :
/// A3-marques et A4-campagne (J2), C-saisie (J3-J4), B-tables (J5), D-dashboard
/// (J6). L'ecran de saisie est le coeur du produit : en cas d'arbitrage entre
/// l'elegance d'un ecran d'administration et la fluidite de la saisie, la saisie
/// gagne toujours.
///
/// La navigation reservee aux admins est un CONFORT, pas une securite : chaque
/// route de l'API revalide les droits (interdit n.5).
export default function App() {
  const { session, chargement, deconnexion } = useSession();
  const { theme, basculer } = useTheme();
  // La saisie est l'ecran d'accueil : c'est le coeur du produit, pas une rubrique
  // parmi d'autres. Un chef de table qui se connecte pendant une session doit y
  // etre deja.
  const [onglet, setOnglet] = useState<Onglet>('saisie');

  if (chargement) return <div className="attente">Chargement...</div>;
  if (!session) return <Connexion />;

  const { utilisateur, droits } = session;

  return (
    <div className="application">
      <header>
        <span className="logotype">
          <img className="logotype-marque" src="/grid.svg" alt="" aria-hidden="true" />
          <span className="logotype-mot">GRID</span>
        </span>

        <nav>
          {ONGLETS_TOUS.map((o) => (
            <button
              key={o}
              type="button"
              className={onglet === o ? 'onglet actif' : 'onglet'}
              onClick={() => setOnglet(o)}
            >
              {LIBELLES[o]}
            </button>
          ))}
          {droits.administre &&
            ONGLETS_ADMIN.map((o) => (
              <button
                key={o}
                type="button"
                className={onglet === o ? 'onglet actif' : 'onglet'}
                onClick={() => setOnglet(o)}
              >
                {LIBELLES[o]}
              </button>
            ))}
          {droits.gereUtilisateurs &&
            ONGLETS_GESTION.map((o) => (
              <button
                key={o}
                type="button"
                className={onglet === o ? 'onglet actif' : 'onglet'}
                onClick={() => setOnglet(o)}
              >
                {LIBELLES[o]}
              </button>
            ))}
        </nav>

        <span className="identite">
          {utilisateur.nom}
          {droits.admin && <span className="etiquette">admin</span>}
          {droits.direction && <span className="etiquette">direction</span>}
          {droits.lecteur && <span className="etiquette">lecteur</span>}
          {!droits.admin && !droits.direction && !droits.lecteur && (
            <span className="etiquette">encadrant</span>
          )}
        </span>
        <button
          type="button"
          className="bascule"
          onClick={basculer}
          title={theme === 'sombre' ? 'Passer en clair' : 'Passer en sombre'}
          aria-label={theme === 'sombre' ? 'Passer en clair' : 'Passer en sombre'}
        >
          {theme === 'sombre' ? '☀' : '☾'}
        </button>
        <button type="button" className="lien" onClick={deconnexion}>
          Se deconnecter
        </button>
      </header>

      <main>
        {/* Une frontiere PAR ONGLET, pas une seule autour de tout : un ecran qui
            casse ne doit pas emporter la navigation avec lui. La cle force le
            remontage a chaque changement d'onglet. */}
        <Rempart nom={LIBELLES[onglet]} key={onglet}>
          {onglet === 'saisie' && <Saisie />}
          {onglet === 'tableau' && <Dashboard />}
          {onglet === 'tables' && droits.administre && <Tables />}
          {onglet === 'vendeurs' && droits.administre && <Vendeurs />}
          {onglet === 'campagne' && droits.administre && <Campagne />}
          {onglet === 'gestion' && droits.gereUtilisateurs && <Gestion />}
        </Rempart>
      </main>
    </div>
  );
}
