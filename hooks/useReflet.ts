import { useCallback } from 'react';

// ============================================================================
// LE REFLET QUI SUIT LE POINTEUR — matiere liquid glass (styles/v2.css, `.verre`).
//
// Deux variables CSS, `--mx` et `--my`, posees sur l'element survole ; le degrade
// radial du `background` les lit. Aucun calcul par image : on ecrit seulement
// quand le pointeur bouge, et le navigateur repeint ce petit element. Rien sur
// tactile — il n'y a pas de survol a suivre.
// ============================================================================

export function useReflet() {
  return useCallback((e: React.PointerEvent<HTMLElement>) => {
    if (e.pointerType !== 'mouse') return;
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${e.clientX - r.left}px`);
    el.style.setProperty('--my', `${e.clientY - r.top}px`);
  }, []);
}
