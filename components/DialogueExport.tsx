import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { VendeurSaisie } from '../services/saisie';

// ============================================================================
// SELECTION DES VENDEURS A IMPRIMER.
//
// ---------------------------------------------------------------------------
// POURQUOI CE N'EST PAS `MenuMultiple`
// ---------------------------------------------------------------------------
// Les deux affichent des cases a cocher, et c'est le seul point commun. Dans
// `MenuMultiple`, RIEN DE COCHE VEUT DIRE TOUT : c'est un filtre, et un filtre
// vide ne filtre pas. Ici, rien de coche veut dire RIEN A IMPRIMER : c'est une
// selection.
//
// Les plier dans un meme composant obligerait a lui passer un drapeau
// « le vide veut dire tout ou rien ? » — donc a lire ce drapeau pour comprendre
// n'importe lequel des deux usages. Deux semantiques opposees ne partagent pas un
// composant : elles partagent une apparence, ce qui est le travail du CSS.
//
// ---------------------------------------------------------------------------
// LE NOMBRE DE FEUILLES EST AFFICHE, ET C'EST LE POINT LE PLUS UTILE
// ---------------------------------------------------------------------------
// Une feuille par vendeur ET PAR MARQUE : un VN Renault + Dacia en fait deux. Sur
// une equipe de sept, on passe de « j'imprime mon equipe » a quatorze feuilles
// sans l'avoir vu venir. Le compte est donc dans le bouton lui-meme, avant le
// clic — pas dans la boite d'impression du navigateur, ou il est trop tard.
// ============================================================================

export function DialogueExport({
  vendeurs,
  onAnnuler,
  onImprimer,
}: {
  vendeurs: VendeurSaisie[];
  onAnnuler: () => void;
  onImprimer: (retenus: VendeurSaisie[]) => void;
}) {
  /// TOUS COCHES AU DEPART. C'est le cas courant — « j'imprime mon equipe » — et
  /// il ne doit demander aucun geste.
  const [retenus, setRetenus] = useState<string[]>(() => vendeurs.map((v) => v.id));
  const boite = useRef<HTMLDivElement>(null);

  // Echap annule, et le focus part sur la boite : sans quoi le clavier reste sur
  // le bouton qui a ouvert le dialogue, derriere le voile.
  useEffect(() => {
    boite.current?.focus();
    const auClavier = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onAnnuler();
    };
    document.addEventListener('keydown', auClavier);
    return () => document.removeEventListener('keydown', auClavier);
  }, [onAnnuler]);

  const basculer = (id: string) =>
    setRetenus((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]));

  const choisis = vendeurs.filter((v) => retenus.includes(v.id));
  /// UNE FEUILLE PAR VENDEUR ET PAR MARQUE — la meme regle que `paginer()`, et
  /// c'est volontairement le seul endroit ou elle est recomptee : ici on annonce,
  /// la-bas on produit. Si les deux divergeaient, l'annonce serait un mensonge.
  const feuilles = choisis.reduce((n, v) => n + v.sections.length, 0);

  return createPortal(
    <div className="voile-dialogue" onMouseDown={onAnnuler}>
      {/* `stopPropagation` : un clic DANS la boite ne doit pas la fermer. */}
      <div
        className="boite-dialogue glass-menu"
        role="dialog"
        aria-modal="true"
        aria-labelledby="titre-export"
        tabIndex={-1}
        ref={boite}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header>
          <h3 id="titre-export">Plannings à imprimer</h3>
          <p className="note">
            Une feuille par vendeur et par marque, en A4 paysage. Les cases vides sont
            faites pour être remplies au stylo.
          </p>
        </header>

        <div className="actions-selection">
          <button
            type="button"
            className="lien"
            onClick={() => setRetenus(vendeurs.map((v) => v.id))}
            disabled={retenus.length === vendeurs.length}
          >
            Tout cocher
          </button>
          <button
            type="button"
            className="lien"
            onClick={() => setRetenus([])}
            disabled={retenus.length === 0}
          >
            Tout décocher
          </button>
        </div>

        <ul className="liste-export">
          {vendeurs.map((v) => {
            const coche = retenus.includes(v.id);
            return (
              <li key={v.id}>
                <label>
                  <input type="checkbox" checked={coche} onChange={() => basculer(v.id)} />
                  <span className="nom-export">{v.nom}</span>
                  <span className="detail-export">
                    {v.siteCode} ·{' '}
                    {v.sections.length > 1
                      ? `${v.sections.length} feuilles`
                      : '1 feuille'}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>

        <footer>
          <button type="button" className="secondaire" onClick={onAnnuler}>
            Annuler
          </button>
          <button
            type="button"
            className="principal"
            disabled={feuilles === 0}
            onClick={() => onImprimer(choisis)}
          >
            {feuilles === 0
              ? 'Aucune feuille'
              : `Imprimer ${feuilles} feuille${feuilles > 1 ? 's' : ''}`}
          </button>
        </footer>
      </div>
    </div>,
    document.body
  );
}
