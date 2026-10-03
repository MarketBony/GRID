import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import './styles/composants-anciens.css';
import './styles/v2.css';
import { FondGrille } from './components/connexion/FondGrille';
import { IntroGrid } from './components/connexion/IntroGrid';
function A() {
  const [i, setI] = useState(0);
  return (<div className="v2 connexion-v2"><FondGrille />
    <form className="carte-connexion verre fort"><div className="marque-connexion"><span className="logo-anime"><img src="/grid.svg" alt="" /></span><span className="mot">GRID</span></div>
    <p className="faint" style={{ textAlign: 'center' }}>Campagnes de relance téléphonique · Groupe Bony</p>
    <button type="button" className="btn primary" style={{ width: '100%', height: 42 }} onClick={() => setI((n) => n + 1)}>Rejouer l'entrée</button></form>
    {i > 0 && <IntroGrid key={i} onFin={() => {}} />}</div>);
}
createRoot(document.getElementById('r')!).render(<A />);
