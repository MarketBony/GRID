import { useState } from 'react';
import { useSession } from '../contexts/SessionContext';

export function Connexion() {
  const { connexion } = useSession();
  const [loginId, setLoginId] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  const soumettre = async (e: React.FormEvent) => {
    e.preventDefault();
    setErreur(null);
    setEnvoi(true);
    try {
      await connexion(loginId.trim(), motDePasse);
    } catch (err) {
      setErreur(err instanceof Error ? err.message : 'Connexion impossible.');
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <div className="connexion">
      {/* `glass-strong` et non `glass` : c'est un panneau de texte, la lisibilite
          passe avant la transparence. Meme arbitrage que sur GEARBOX. */}
      <form className="glass-strong" onSubmit={soumettre} style={{ borderRadius: 'var(--rayon)' }}>
        <span className="logotype">
          <img className="logotype-marque" src="/grid.svg" alt="" aria-hidden="true" />
          <span className="logotype-mot">GRID</span>
        </span>
        <p className="sous-titre">
          Pilotage des campagnes de relance telephonique
          <br />
          Groupe Bony
        </p>

        <label htmlFor="loginId">Identifiant</label>
        <input
          id="loginId"
          value={loginId}
          onChange={(e) => setLoginId(e.target.value)}
          autoComplete="username"
          autoFocus
          required
        />

        <label htmlFor="motDePasse">Mot de passe</label>
        <input
          id="motDePasse"
          type="password"
          value={motDePasse}
          onChange={(e) => setMotDePasse(e.target.value)}
          autoComplete="current-password"
          required
        />

        {erreur && (
          <p className="erreur-bloc" style={{ marginTop: '1rem' }}>
            {erreur}
          </p>
        )}

        <button
          type="submit"
          className="principal"
          disabled={envoi || !loginId || !motDePasse}
          style={{ marginTop: '1.4rem' }}
        >
          {envoi ? 'Connexion...' : 'Se connecter'}
        </button>
      </form>
    </div>
  );
}
