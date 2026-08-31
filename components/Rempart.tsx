import { Component, type ErrorInfo, type ReactNode } from 'react';

// ============================================================================
// REMPART — frontiere d'erreur autour d'un ecran.
//
// Pourquoi ce fichier existe : un `undefined.includes(...)` dans l'ecran
// Vendeurs a rendu une PAGE BLANCHE MUETTE. L'application entiere disparait, la
// barre de navigation comprise, et rien a l'ecran ne dit ou regarder. Il a fallu
// ouvrir la console du navigateur pour apprendre quel champ manquait.
//
// C'est inacceptable en session : un chef de table qui perd son ecran a 19h un
// samedi ne va pas ouvrir les outils de developpement. Un ecran qui casse doit
// casser SEUL, nommer sa panne, et laisser les autres onglets utilisables.
//
// Volontairement une classe : React n'expose `componentDidCatch` a aucun hook.
// ============================================================================

interface Etat {
  erreur: Error | null;
}

export class Rempart extends Component<{ nom: string; children: ReactNode }, Etat> {
  state: Etat = { erreur: null };

  static getDerivedStateFromError(erreur: Error): Etat {
    return { erreur };
  }

  componentDidCatch(erreur: Error, infos: ErrorInfo) {
    // La console reste le seul endroit ou la pile complete est lisible ; l'ecran,
    // lui, ne montre que ce qui est actionnable.
    console.error(`[${this.props.nom}] ecran interrompu`, erreur, infos.componentStack);
  }

  /// Remonter d'onglet doit reparer : sans ca l'ecran reste mort jusqu'au
  /// rechargement complet, et on perd la session en cours.
  componentDidUpdate(precedent: { nom: string }) {
    if (precedent.nom !== this.props.nom && this.state.erreur) this.setState({ erreur: null });
  }

  render() {
    const { erreur } = this.state;
    if (!erreur) return this.props.children;

    return (
      <div className="erreur-bloc">
        <strong>L’écran « {this.props.nom} » s’est interrompu.</strong>
        <p style={{ margin: '0.5rem 0' }}>
          Les autres onglets restent utilisables, et <strong>aucune donnée n’est perdue</strong> :
          rien n’est enregistré depuis cet écran tant qu’il est dans cet état.
        </p>
        <p className="note" style={{ marginBottom: '0.7rem' }}>
          {erreur.message || 'Erreur sans message.'}
        </p>
        <div className="actions">
          <button type="button" onClick={() => this.setState({ erreur: null })}>
            Réessayer
          </button>
          <button type="button" className="secondaire" onClick={() => window.location.reload()}>
            Recharger l’application
          </button>
        </div>
      </div>
    );
  }
}
