import { useState } from 'react';
import { useSession } from '../contexts/SessionContext';
import { Icone } from '../components/ui/Icone';
import { useReflet } from '../hooks/useReflet';

// ============================================================================
// CONNEXION — la premiere chose que voit un utilisateur, en DA v2 : le fond
// vivant, une carte de verre, le G en damier. La marque est `public/grid.svg`,
// la SOURCE UNIQUE du logotype (CLAUDE.md) : jamais recopiee en JSX.
//
// Le message d'erreur vient de `services/api.ts` et dit CE QUI S'EST PASSE :
// « mot de passe incorrect » seulement quand c'est le cas (03/10/2026).
// ============================================================================

export function Connexion() {
  const { connexion } = useSession();
  const reflet = useReflet();
  const [loginId, setLoginId] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [visible, setVisible] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  // Change a chaque echec : relance l'animation de secousse de la carte.
  const [secousse, setSecousse] = useState(0);

  const soumettre = async (e: React.FormEvent) => {
    e.preventDefault();
    setErreur(null);
    setEnvoi(true);
    try {
      await connexion(loginId.trim(), motDePasse);
    } catch (err) {
      setErreur(err instanceof Error ? err.message : 'Connexion impossible.');
      setSecousse((n) => n + 1);
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <div className="v2 connexion-v2">
      <div className="fond-vivant" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
      <form
        key={secousse}
        className={`carte-connexion verre fort${secousse > 0 ? ' secoue' : ''}`}
        onSubmit={soumettre}
        onPointerMove={reflet}
      >
        <div className="marque-connexion">
          <img src="/grid.svg" alt="" aria-hidden="true" />
          <span className="mot">GRID</span>
        </div>
        <p className="faint" style={{ margin: '4px 0 22px', textAlign: 'center' }}>
          Campagnes de relance téléphonique · Groupe Bony
        </p>

        <label className="field">
          <span className="label">Identifiant</span>
          <input
            className="input"
            value={loginId}
            onChange={(e) => setLoginId(e.target.value)}
            autoComplete="username"
            autoFocus
            required
            spellCheck={false}
          />
        </label>

        <label className="field" style={{ marginTop: 12 }}>
          <span className="label">Mot de passe</span>
          <span className="champ-mdp">
            <input
              className="input"
              type={visible ? 'text' : 'password'}
              value={motDePasse}
              onChange={(e) => setMotDePasse(e.target.value)}
              autoComplete="current-password"
              required
            />
            <button
              type="button"
              className="icon-btn"
              onClick={() => setVisible((v) => !v)}
              aria-label={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
              title={visible ? 'Masquer' : 'Afficher'}
            >
              <Icone nom={visible ? 'oeilBarre' : 'oeil'} petite />
            </button>
          </span>
        </label>

        {erreur && (
          <div className="bandeau-v2 erreur" role="alert" style={{ marginTop: 14 }}>
            {erreur}
          </div>
        )}

        <button type="submit" className="btn primary" disabled={envoi || !loginId || !motDePasse} style={{ marginTop: 20, width: '100%', height: 42 }}>
          {envoi ? 'Connexion…' : 'Se connecter'}
        </button>
      </form>
    </div>
  );
}
