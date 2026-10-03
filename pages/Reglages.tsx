import { useEffect, useState } from 'react';
import { Icone } from '../components/ui/Icone';
import { useSession } from '../contexts/SessionContext';
import { useTheme } from '../contexts/ThemeContext';
import { changerMonMotDePasse } from '../services/api';
import { Comptes } from '../components/comptes/Comptes';

// ============================================================================
// REGLAGES — les sections dependent du PALIER, a la Gearbox (D3 de
// PLAN-GRID-V2.md). Tout le monde : son compte et l'apparence. L'admin, en plus :
// la gestion des comptes. Filtrer les sections n'est QUE de l'affichage
// (interdit n.5) : chaque action reste revalidee par la base.
// ============================================================================

type Section = 'compte' | 'apparence' | 'comptes';

const CLE_ANIMATIONS = 'grid.animations-reduites';

export function Reglages() {
  const { session } = useSession();
  const droits = session?.droits;
  const sections: { id: Section; libelle: string; couleur: string }[] = [
    { id: 'compte', libelle: 'Mon compte', couleur: 'var(--info)' },
    { id: 'apparence', libelle: 'Apparence', couleur: 'var(--bony-violet)' },
    ...(droits?.gereUtilisateurs ? [{ id: 'comptes' as const, libelle: 'Comptes', couleur: 'var(--bony-orange)' }] : []),
  ];
  const [section, setSection] = useState<Section>('compte');

  return (
    <div className="page">
      <div className="app-head enter">
        <h1>Réglages</h1>
        <span className="sub">{session?.utilisateur.nom}</span>
      </div>
      <div className="reglages-grille">
        <div className="card enter" style={{ padding: 8, alignSelf: 'start', ['--i' as string]: 1 }}>
          {sections.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`reglages-section${s.id === section ? ' actif' : ''}`}
              onClick={() => setSection(s.id)}
            >
              <span className="pastille" style={{ background: s.couleur }} aria-hidden="true">
                {s.libelle[0]}
              </span>
              {s.libelle}
            </button>
          ))}
        </div>
        <div className="enter" style={{ ['--i' as string]: 2, minWidth: 0 }}>
          {section === 'compte' && <MonCompte />}
          {section === 'apparence' && <Apparence />}
          {section === 'comptes' && droits?.gereUtilisateurs && <Comptes />}
        </div>
      </div>
    </div>
  );
}

function MonCompte() {
  const { session } = useSession();
  const u = session?.utilisateur;
  return (
    <div className="card pad" style={{ display: 'grid', gap: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span className="avatar-v2">{(u?.nom ?? '?').split(/\s+/).map((m) => m[0]).slice(0, 2).join('')}</span>
        <div>
          <b style={{ fontSize: 15 }}>{u?.nom}</b>
          <div className="faint">Identifiant : {u?.loginId}</div>
        </div>
      </div>
      <ChoisirMotDePasse />
    </div>
  );
}

/// Choisir son mot de passe. Le meme formulaire sert a l'ecran obligatoire qui
/// suit une reinitialisation (`doitChangerMdp`, D14) : un seul chemin, un seul
/// ensemble de regles.
export function ChoisirMotDePasse({ obligatoire = false, apres }: { obligatoire?: boolean; apres?: () => void }) {
  const [nouveau, setNouveau] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);
  const { rafraichir } = useSession();

  const valide = nouveau.length >= 12 && nouveau === confirmation;

  const envoyer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valide) return;
    setEnvoi(true);
    setMessage(null);
    try {
      await changerMonMotDePasse(nouveau);
      setNouveau('');
      setConfirmation('');
      setMessage({ ok: true, texte: 'Mot de passe changé.' });
      await rafraichir();
      apres?.();
    } catch (err) {
      setMessage({ ok: false, texte: err instanceof Error ? err.message : 'Changement impossible.' });
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <form onSubmit={envoyer} style={{ display: 'grid', gap: 10, maxWidth: 420 }}>
      <b>{obligatoire ? 'Choisissez votre mot de passe' : 'Changer mon mot de passe'}</b>
      {obligatoire && (
        <p className="muted" style={{ margin: 0 }}>
          Un administrateur a réinitialisé votre mot de passe. Choisissez-en un que vous seul connaissez.
        </p>
      )}
      <label className="field">
        <span className="label">Nouveau mot de passe</span>
        <input className="input" type="password" autoComplete="new-password" value={nouveau} onChange={(e) => setNouveau(e.target.value)} />
      </label>
      <label className="field">
        <span className="label">Confirmation</span>
        <input className="input" type="password" autoComplete="new-password" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} />
      </label>
      <span className="faint" style={{ fontSize: 12 }}>
        6 caractères au moins.{' '}
        {confirmation !== '' && nouveau !== confirmation && <span style={{ color: 'var(--danger)' }}>Les deux saisies diffèrent.</span>}
      </span>
      {message && <span style={{ color: message.ok ? 'var(--ok)' : 'var(--danger)', fontWeight: 600 }}>{message.texte}</span>}
      <button type="submit" className="btn primary" disabled={!valide || envoi} style={{ justifySelf: 'start' }}>
        <Icone nom="coche" petite /> {envoi ? 'Enregistrement…' : 'Enregistrer'}
      </button>
    </form>
  );
}

function Apparence() {
  const { theme, basculer } = useTheme();
  const [reduites, setReduites] = useState(() => document.documentElement.classList.contains('animations-reduites'));
  useEffect(() => {
    document.documentElement.classList.toggle('animations-reduites', reduites);
    try {
      localStorage.setItem(CLE_ANIMATIONS, reduites ? 'oui' : 'non');
    } catch {
      // Preference de confort : sans stockage, elle vaut pour la session seulement.
    }
  }, [reduites]);

  return (
    <div className="card pad" style={{ display: 'grid', gap: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <b>Thème</b>
          <div className="faint">Sombre par défaut : la saisie reste affichée des heures, souvent projetée.</div>
        </div>
        <button type="button" className="btn" onClick={(e) => basculer({ x: e.clientX, y: e.clientY })}>
          <Icone nom={theme === 'sombre' ? 'soleil' : 'lune'} petite /> {theme === 'sombre' ? 'Passer en clair' : 'Passer en sombre'}
        </button>
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
        <div style={{ flex: 1 }}>
          <b>Animations réduites</b>
          <div className="faint">Pour un poste lent, ou par confort.</div>
        </div>
        <input type="checkbox" className="interrupteur-v2" checked={reduites} onChange={(e) => setReduites(e.target.checked)} />
      </label>
    </div>
  );
}

/// Applique la preference « animations reduites » au demarrage, avant le premier
/// rendu de l'application.
export function appliquerPreferenceAnimations() {
  try {
    if (localStorage.getItem(CLE_ANIMATIONS) === 'oui') document.documentElement.classList.add('animations-reduites');
  } catch {
    // Rien : la valeur par defaut s'applique.
  }
}
