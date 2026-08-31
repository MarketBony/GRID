/// Cle d'indexation d'un RDV dans une grille : section, creneau, jour.
///
/// Vit dans son propre fichier et NON a cote du composant : Vite refuse le
/// rafraichissement a chaud d'un module qui exporte a la fois un composant React
/// et autre chose (« Could not Fast Refresh — export is incompatible »). Il
/// rechargeait donc la page entiere a chaque edition de la grille, ce qui rend le
/// developpement de l'ecran de saisie penible et les tests manuels trompeurs — on
/// croit observer un bug de saisie alors qu'on observe un rechargement.
export const cleRdv = (marqueId: string | null, creneauCode: string, jour: string) =>
  `${marqueId ?? 'sansMarque'}|${creneauCode}|${jour}`;

/// `2026-06-13` -> `samedi 13/06`. Le jour de la semaine est utile : la campagne
/// de juin 2026 couvrait un week-end, dimanche compris, et un chef doit voir tout
/// de suite ou il saisit.
export function libelleJour(iso: string): string {
  const jours = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  const d = new Date(`${iso}T12:00:00Z`);
  const [, m, j] = iso.split('-');
  return `${jours[d.getUTCDay()]} ${j}/${m}`;
}
