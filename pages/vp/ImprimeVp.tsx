import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { mobilisation } from '../../backend/src/utils/agregats';
import type { DonneesVp } from '../../services/vp';
import { heureCreneau, isoLocal, jourLong, jjmmaaaa, type PropsEcranVp } from './commun';

// ============================================================================
// LE PLANNING IMPRIME DU JOUR J — une feuille A4 paysage par vendeur : l'agenda de
// SA journee, une ligne par heure, des cases de 13 mm pour ecrire au crayon. Une
// heure sans RDV garde sa ligne VIDE : c'est la qu'on note un visiteur.
//
// Les regles du planning de GRID classique (CLAUDE.md) : AUCUN jeton de theme
// (le papier n'a pas de theme), et les feuilles imprimees vivent dans un PORTAIL
// sur <body> — descendantes de l'application, elles sortiraient en pages blanches.
// ============================================================================

export function ImprimeVp({ donnees }: PropsEcranVp) {
  const { vendeurs, rdvs } = donnees;
  const effectif = mobilisation(rdvs, vendeurs);
  const presents = vendeurs.filter((v) => effectif.has(v.id));
  const [choix, setChoix] = useState('tous');

  const imprimer = () => {
    const html = document.documentElement;
    html.classList.add('impression-vp');
    const fin = () => html.classList.remove('impression-vp');
    window.addEventListener('afterprint', fin, { once: true });
    window.print();
  };
  useEffect(() => () => document.documentElement.classList.remove('impression-vp'), []);

  const qui = choix === 'tous' ? presents.map((v) => v.id) : [choix];

  return (
    <div className="page vp-page">
      <section className="vp-ecran actif">
        <div className="app-head">
          <h2>Imprimé</h2>
          <div className="droite">
            <select className="select" style={{ width: 'auto' }} value={choix} onChange={(e) => setChoix(e.target.value)} aria-label="Feuilles à imprimer">
              <option value="tous">Toutes les feuilles ({presents.length})</option>
              {presents.map((v) => (
                <option key={v.id} value={v.id}>{v.nom}</option>
              ))}
            </select>
            <button type="button" className="btn primary" onClick={imprimer}>
              Imprimer
            </button>
          </div>
        </div>
        <Feuilles donnees={donnees} qui={qui} />
      </section>
      {createPortal(
        <div className="vp-impression">
          <Feuilles donnees={donnees} qui={qui} />
        </div>,
        document.body
      )}
    </div>
  );
}

function Feuilles({ donnees, qui }: { donnees: DonneesVp; qui: string[] }) {
  const { vp, vendeurs, rdvs, creneaux } = donnees;
  const lignes = [...creneaux].sort((a, b) => a.ordre - b.ordre);
  const edite = jjmmaaaa(isoLocal(new Date()));
  return (
    <div className="vp-feuilles">
      {qui.map((id) => {
        const v = vendeurs.find((x) => x.id === id);
        if (!v) return null;
        const siens = rdvs.filter((r) => r.vendeurId === id);
        return (
          <div className="vp-feuille" key={id}>
            <div className="en-tete">
              <div>
                <b>{v.nom}</b>
                <br />
                <span>
                  {v.typeVehicule}
                  {v.marques.length > 0 && ` · ${v.marques.map((m) => m.libelle).join(' / ')}`}
                </span>
              </div>
              <span>VP {vp.siteLibelle} · {jourLong(vp.jour)}</span>
            </div>
            <table>
              <colgroup>
                <col style={{ width: '14mm' }} />
                <col style={{ width: '62mm' }} />
                <col style={{ width: '30mm' }} />
                <col style={{ width: '20mm' }} />
                <col style={{ width: '48mm' }} />
                <col />
              </colgroup>
              <thead>
                <tr><th>Heure</th><th>Client</th><th>Véhicule</th><th>Venu</th><th>Issue</th><th>Notes</th></tr>
              </thead>
              <tbody>
                {lignes.map((c) => {
                  const ici = siens.filter((r) => r.creneauCode === c.code);
                  return (
                    <tr key={c.code}>
                      <td className="h">{heureCreneau(c.code)}</td>
                      <td>{ici.map((r) => r.client).join(' · ')}</td>
                      <td>{ici.map((r) => `${r.marque ?? ''} ${r.typeVehicule}`.trim()).join(' · ')}</td>
                      <td><span className="case-coche" /></td>
                      <td><span className="case-coche" />Cde <span className="case-coche" />Offre</td>
                      <td />
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="pied">
              <span>{siens.length} RDV au {edite}</span>
              <span>GRID</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
