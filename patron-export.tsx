import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { PlanningImprimable, paginer } from './components/PlanningImprimable';
import type { RdvSaisie, VendeurSaisie } from './services/saisie';
import { cleRdv } from './utils/grille';
import './styles/composants-anciens.css';

// ============================================================================
// PATRON DU PLANNING IMPRIMABLE — artefact de developpement, hors production.
//
// Il monte le VRAI composant avec la VRAIE feuille (`styles/composants-anciens.css`), sur les donnees de
// l'ecran de saisie du 08/09/2026 pour que le patron soit reconnaissable.
//
// `vite build` ne prend que `index.html` en entree : ce fichier ne part jamais
// dans `dist`. Verifie a chaque lot, `dist` doit contenir 4 fichiers.
// ============================================================================

const JOURS = [
  { jour: '2026-09-10' },
  { jour: '2026-09-11' },
  { jour: '2026-09-12' },
  { jour: '2026-09-13' },
  { jour: '2026-09-14' },
];

const CRENEAUX = [
  '08:00-09:00',
  '09:00-10:00',
  '10:00-11:00',
  '11:00-12:00',
  '12:00-13:00',
  '13:00-14:00',
  '14:00-15:00',
  '15:00-16:00',
  '16:00-17:00',
  '17:00-18:00',
  '18:00-19:00',
].map((code) => ({
  code,
  libelle: `${code.slice(0, 2)}h-${code.slice(6, 8)}h`,
}));

const RENAULT = { marqueId: '1', libelle: 'Renault' };
const DACIA = { marqueId: '2', libelle: 'Dacia' };

/// Trois vendeurs, choisis pour couvrir les trois cas de mise en page :
/// un VN charge sur deux marques, un VN leger, un VO a une seule section.
const VENDEURS: VendeurSaisie[] = [
  {
    id: '1',
    nom: 'KEVIN DIJOUX',
    typeVehicule: 'VN',
    siteId: '2',
    siteCode: 'MOZ',
    siteLibelle: 'Mozac',
    dansMaTable: true,
    dansMonEquipe: true,
    sections: [RENAULT, DACIA],
  },
  {
    id: '2',
    nom: 'ANTHONY DONAS',
    typeVehicule: 'VN',
    siteId: '2',
    siteCode: 'MOZ',
    siteLibelle: 'Mozac',
    dansMaTable: true,
    dansMonEquipe: true,
    sections: [RENAULT, DACIA],
  },
  {
    id: '3',
    nom: 'MATTHIAS VALLE',
    typeVehicule: 'VO',
    siteId: '2',
    siteCode: 'MOZ',
    siteLibelle: 'Mozac',
    dansMaTable: false,
    dansMonEquipe: true,
    sections: [{ marqueId: null, libelle: 'VO' }],
  },
];

let sequence = 0;
const rdv = (
  vendeurId: string,
  marqueId: string | null,
  jour: string,
  creneauCode: string,
  client: string
): RdvSaisie => ({
  id: String(++sequence),
  vendeurId,
  jour,
  creneauCode,
  marqueId,
  typeVehicule: marqueId === null ? 'VO' : 'VN',
  client,
  commentaire: null,
});

/// Les RDV. On y met exprès une case a DEUX rendez-vous — c'est le cas que le
/// lot du 03/09 a rendu possible, et il faut voir comment il tient sur papier.
const TOUS: RdvSaisie[] = [
  rdv('1', '1', '2026-09-10', '09:00-10:00', 'Bernard'),
  rdv('1', '1', '2026-09-10', '14:00-15:00', 'Chassaing'),
  rdv('1', '1', '2026-09-11', '10:00-11:00', 'Morin R5'),
  rdv('1', '1', '2026-09-11', '11:00-12:00', 'Laparra'),
  rdv('1', '1', '2026-09-11', '15:00-16:00', 'Morin Captur'),
  rdv('1', '1', '2026-09-12', '10:00-11:00', 'Mallet Sandero'),
  rdv('1', '1', '2026-09-12', '10:00-11:00', 'Passebois'),
  rdv('1', '1', '2026-09-12', '16:00-17:00', 'Brelhiat'),
  rdv('1', '1', '2026-09-13', '11:00-12:00', 'Thillet'),
  rdv('1', '1', '2026-09-14', '09:00-10:00', 'Lorderon'),
  rdv('1', '1', '2026-09-14', '17:00-18:00', 'Brun'),
  rdv('1', '2', '2026-09-11', '14:00-15:00', 'Gardette'),
  rdv('2', '1', '2026-09-12', '10:00-11:00', 'Mallet Sandero'),
  rdv('2', '1', '2026-09-11', '14:00-15:00', 'Morin R5'),
  rdv('2', '1', '2026-09-11', '15:00-16:00', 'Morin Captur'),
  rdv('3', null, '2026-09-10', '10:00-11:00', 'Jordy'),
  rdv('3', null, '2026-09-12', '15:00-16:00', 'Lagarde'),
  rdv('3', null, '2026-09-13', '09:00-10:00', 'Dias Fernandes'),
];

/// Meme indexation qu'a la saisie : `vendeurId` -> `cleRdv` -> liste.
const index = new Map<string, Map<string, RdvSaisie[]>>();
for (const r of TOUS) {
  const pour = index.get(r.vendeurId) ?? new Map<string, RdvSaisie[]>();
  const cle = cleRdv(r.marqueId, r.creneauCode, r.jour);
  pour.set(cle, [...(pour.get(cle) ?? []), r]);
  index.set(r.vendeurId, pour);
}

function Patron() {
  return (
    <PlanningImprimable
      pages={paginer(VENDEURS)}
      jours={JOURS}
      creneaux={CRENEAUX}
      rdvs={index}
      campagne={{ libelle: 'Septembre 2026', jours: JOURS }}
      perimetre="Table 3 - EAA — CENTRE"
    />
  );
}

const racine = document.getElementById('racine');
if (!racine) throw new Error('#racine introuvable');
createRoot(racine).render(
  <StrictMode>
    <Patron />
  </StrictMode>
);
