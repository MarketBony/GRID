import { StrictMode, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Segmente } from './components/Segmente';
import { MenuMultiple } from './components/MenuMultiple';
import { basculer, EnTeteTriable, type SensNaturel, type Tri } from './components/EnTeteTriable';
import { GrilleVendeur } from './components/GrilleVendeur';
import type { RdvSaisie, VendeurSaisie } from './services/saisie';
import { useIndicateurGlissant } from './hooks/useIndicateurGlissant';
import './index.css';

// ============================================================================
// ATELIER DE LA COUCHE VISUELLE — artefact de developpement, hors production.
//
// POURQUOI IL EXISTE. Les six ecrans de GRID sont derriere une session, et une
// session ne se fabrique pas sans saisir un mot de passe. Sans cet atelier, la
// couche visuelle ne pouvait etre jugee que sur l'ecran de connexion — un
// panneau et un bouton.
//
// CE QU'IL N'EST PAS : une maquette. Il importe les VRAIS composants et le VRAI
// `index.css`. Ce qu'on y voit est ce que la production affiche, aux donnees
// pres. Une maquette qui reimplemente les styles ne prouverait rien — c'est la
// meme raison qui interdit de recopier les utils partages.
//
// `vite build` ne prend que `index.html` en entree : ce fichier ne part jamais
// dans `dist`. A retirer du depot avant livraison.
// ============================================================================

const JOURS = [
  { jour: '2026-06-11', ordre: 1 },
  { jour: '2026-06-12', ordre: 2 },
  { jour: '2026-06-13', ordre: 3 },
  { jour: '2026-06-14', ordre: 4 },
  { jour: '2026-06-15', ordre: 5 },
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
].map((code, i) => ({ code, libelle: `${code.slice(0, 2)}h-${code.slice(6, 8)}h`, ordre: i + 1 }));

/// Un vendeur VN a DEUX sections : c'est le cas qui met la grille sous
/// contrainte — 110 cases, et les deux sections cote a cote.
const VENDEUR: VendeurSaisie = {
  id: '1',
  nom: 'ALEXANDRE DIOT',
  typeVehicule: 'VN',
  siteId: '1',
  siteCode: 'VI',
  siteLibelle: 'Vichy',
  // Les deux origines, pour que l'atelier monte le meme type que la production.
  dansMaTable: true,
  dansMonEquipe: true,
  sections: [
    { marqueId: '1', libelle: 'Renault' },
    { marqueId: '2', libelle: 'Dacia' },
  ],
};

const CLIENTS = ['DEVERNOIS', 'DE SOUSA', 'ROUVET', 'GORY', 'ANADON LUIS', 'COSTON', 'DAUBARD'];

/// Des RDV plausibles, dont UNE case a deux clients — le cas de juin 2026, pour
/// que l'empilement et son marqueur soient sous les yeux.
function rdvsDemo(): Map<string, RdvSaisie[]> {
  const m = new Map<string, RdvSaisie[]>();
  let id = 1;
  const poser = (marqueId: string, creneau: string, jour: string, client: string) => {
    const cle = `${marqueId}|${creneau}|${jour}`;
    const liste = m.get(cle) ?? [];
    liste.push({
      id: String(id++),
      vendeurId: '1',
      jour,
      creneauCode: creneau,
      marqueId,
      typeVehicule: 'VN',
      client,
      commentaire: null,
    });
    m.set(cle, liste);
  };
  poser('1', '09:00-10:00', '2026-06-11', CLIENTS[2]!);
  poser('1', '14:00-15:00', '2026-06-15', CLIENTS[0]!);
  poser('1', '14:00-15:00', '2026-06-15', CLIENTS[1]!); // la case a DEUX RDV
  poser('1', '17:00-18:00', '2026-06-12', CLIENTS[3]!);
  poser('2', '10:00-11:00', '2026-06-13', CLIENTS[4]!);
  poser('2', '16:00-17:00', '2026-06-14', CLIENTS[5]!);
  return m;
}

type Axe = 'vendeur' | 'site' | 'plaque' | 'table';
type Critere = 'global' | 'vn' | 'vo';

const LIGNES = [
  { cle: 'clf', libelle: 'Clermont-Ferrand', total: 218, vn: 180, vo: 38, effectif: 19 },
  { cle: 'moz', libelle: 'Mozac', total: 116, vn: 96, vo: 20, effectif: 7 },
  { cle: 'vi', libelle: 'Vichy', total: 104, vn: 88, vo: 16, effectif: 11 },
  { cle: 'iss', libelle: 'Issoire', total: 71, vn: 60, vo: 11, effectif: 9 },
  { cle: 'mass', libelle: 'Massagettes', total: 20, vn: 20, vo: 0, effectif: 1 },
  { cle: 'carm', libelle: 'Carmaux', total: 0, vn: 0, vo: 0, effectif: 1 },
];

function Atelier() {
  const [sombre, setSombre] = useState(true);
  const [axe, setAxe] = useState<Axe>('site');
  const [critere, setCritere] = useState<Critere>('global');
  const [tri, setTri] = useState<Tri>({ colonne: 'total', croissant: false });
  const [rdvs, setRdvs] = useState(rdvsDemo);
  const [journal, setJournal] = useState<string[]>([]);
  const [ligneActive, setLigneActive] = useState(2);
  const [voletOuvert, setVoletOuvert] = useState(false);

  // Le curseur glissant de la liste, meme hook que la pastille du segmente.
  const curseur = useIndicateurGlissant(ligneActive, LIGNES.length, 'y');

  // La barre de navigation, cablee comme dans `App.tsx` : c'est l'element le
  // plus visible du produit, il doit etre eprouvable ici.
  const [ongletActif, setOngletActif] = useState(0);

  // Les deux nouveautes du 08/09/2026, pour les VOIR : le selecteur d'origine de
  // la liste de saisie, et les filtres a choix multiple du classement.
  const [origine, setOrigine] = useState<'table' | 'equipe' | 'tout'>('table');
  const [plaquesRetenues, setPlaquesRetenues] = useState<string[]>([]);
  const [sitesRetenus, setSitesRetenus] = useState<string[]>([]);
  const basculerDansListe = (liste: string[], id: string) =>
    liste.includes(id) ? liste.filter((x) => x !== id) : [...liste, id];
  const ONGLETS = ['Saisie', 'Tableau de bord', 'Tables', 'Vendeurs', 'Campagnes', 'Comptes'];
  const navigation = useIndicateurGlissant(ongletActif, ONGLETS.length);

  // Le theme vit sur `<html>`, comme dans l'application.
  useMemo(() => {
    document.documentElement.classList.toggle('dark', sombre);
  }, [sombre]);

  const noter = (t: string) => setJournal((j) => [t, ...j].slice(0, 6));

  const triees = useMemo(() => {
    const v = (l: (typeof LIGNES)[number]) =>
      tri.colonne === 'libelle' ? l.libelle : (l as unknown as Record<string, number>)[tri.colonne] ?? 0;
    return [...LIGNES].sort((a, b) => {
      const x = v(a), y = v(b);
      const p = typeof x === 'number' && typeof y === 'number' ? x - y : String(x) < String(y) ? -1 : 1;
      return tri.croissant ? p : -p;
    });
  }, [tri]);

  const trier = (colonne: string, naturel: SensNaturel) =>
    setTri((t) => basculer(t, colonne, naturel));

  return (
    <div className="application">
      <header>
        <span className="logotype">
          <img className="logotype-marque" src="/grid.svg" alt="" aria-hidden="true" />
          <span className="logotype-mot">GRID</span>
        </span>
        <nav ref={navigation.conteneur} role="tablist" aria-label="Navigation">
          <span className="pilule-onglet" aria-hidden="true" ref={navigation.indicateur} />
          {ONGLETS.map((o, i) => (
            <button
              key={o}
              type="button"
              role="tab"
              aria-selected={i === ongletActif}
              ref={navigation.cible(i)}
              className={i === ongletActif ? 'onglet actif' : 'onglet'}
              onClick={() => {
                setOngletActif(i);
                noter(`onglet → ${o}`);
              }}
            >
              {o}
            </button>
          ))}
        </nav>
        <span className="identite">
          COUCHE VISUELLE<span className="etiquette">atelier</span>
        </span>
        <button type="button" className="bascule" onClick={() => setSombre((s) => !s)}>
          {sombre ? '☀' : '☾'}
        </button>
      </header>

      <main>
        <section className="ecran">
          <header className="ecran-entete">
            <div>
              <h2>Atelier</h2>
            </div>
            <div className="progression">
              <strong>1107</strong>
              <span>RDV sur le périmètre</span>
            </div>
          </header>

          <div className="succes-bloc">Enregistré — 1107 RDV sur le périmètre.</div>
          <div className="info-bloc">
            Campagne clôturée : les chiffres sont figés, la saisie est fermée.
          </div>

          <div className="barre-outils">
            <Segmente
              etiquette="Axe"
              valeur={axe}
              onChange={(a) => { setAxe(a); noter(`axe → ${a}`); }}
              options={[
                { valeur: 'vendeur', libelle: 'Vendeurs' },
                { valeur: 'site', libelle: 'Concessions' },
                { valeur: 'plaque', libelle: 'Plaques' },
                { valeur: 'table', libelle: 'Tables' },
              ]}
            />
            <Segmente
              etiquette="Critère"
              valeur={critere}
              onChange={(c) => { setCritere(c); noter(`critère → ${c}`); }}
              options={[
                { valeur: 'global', libelle: 'Général' },
                { valeur: 'vn', libelle: 'VN' },
                { valeur: 'vo', libelle: 'VO' },
              ]}
            />
            <button type="button" className="principal">Action principale</button>
            <button type="button" className="secondaire">Secondaire</button>
            <button type="button" className="lien">Lien</button>
            <label className="interrupteur">
              <input type="checkbox" defaultChecked /> Interrupteur
            </label>
          </div>

          <div className="grille-graphiques">
            <div className="carte">
              <h3>Surface « carte »<span className="etiquette">{axe}</span></h3>
              <div className="tableau-defilant">
                <table className="tableau">
                  <thead>
                    <tr>
                      <EnTeteTriable colonne="libelle" libelle="Libellé" tri={tri} onTrier={trier} />
                      <EnTeteTriable colonne="total" libelle="RDV" tri={tri} onTrier={trier} classe="nombre" naturel="nombre" />
                      <EnTeteTriable colonne="vn" libelle="VN" tri={tri} onTrier={trier} classe="nombre" naturel="nombre" />
                      <EnTeteTriable colonne="vo" libelle="VO" tri={tri} onTrier={trier} classe="nombre" naturel="nombre" />
                      <EnTeteTriable colonne="effectif" libelle="Effectif" tri={tri} onTrier={trier} classe="nombre debut-groupe" naturel="nombre" />
                    </tr>
                  </thead>
                  <tbody>
                    {triees.map((l) => (
                      <tr key={l.cle}>
                        <td>{l.libelle}</td>
                        <td className="nombre"><strong>{l.total}</strong></td>
                        <td className="nombre"><span className={l.vn === 0 ? 'zero' : ''}>{l.vn}</span></td>
                        <td className="nombre"><span className={l.vo === 0 ? 'zero' : ''}>{l.vo}</span></td>
                        <td className="nombre debut-groupe">{l.effectif}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="carte">
              <h3>Classement<span className="etiquette">{critere}</span></h3>
              <ol className="classement-complet defilant">
                {triees.map((l, i) => (
                  <li key={l.cle}>
                    <span className="rang">{i + 1}</span>
                    <span className="libelle">{l.libelle}</span>
                    <span className="detail">{l.effectif} vend.</span>
                    <strong>{l.total}</strong>
                  </li>
                ))}
              </ol>
            </div>
          </div>

          <div className="saisie-corps">
            <aside className="liste-vendeurs" ref={curseur.conteneur}>
              <span className="curseur-liste" aria-hidden="true" ref={curseur.indicateur} />
              {LIGNES.map((l, i) => (
                <button
                  type="button"
                  key={l.cle}
                  ref={curseur.cible(i)}
                  className={`vendeur ${i === ligneActive ? 'actif' : ''}`}
                  onClick={() => { setLigneActive(i); noter(`vendeur → ${l.libelle}`); }}
                >
                  <span className="nom">
                    {l.libelle.toUpperCase()}
                    <span className={`etiquette ${i % 2 ? 'vo' : 'vn'}`}>{i % 2 ? 'VO' : 'VN'}</span>
                  </span>
                  <span className="detail">{l.cle.toUpperCase()} · Ren {l.vn} / Dac {l.vo}</span>
                  <span className="compteur">{l.total}</span>
                </button>
              ))}
            </aside>

            <div className="zone-grille">
              <GrilleVendeur
                vendeur={VENDEUR}
                jours={JOURS}
                creneaux={CRENEAUX}
                rdvs={rdvs}
                figee={false}
                enregistrement={false}
                onPoser={async (section, creneau, jour, client) => {
                  noter(`posé « ${client} »`);
                  setRdvs((m) => {
                    const n = new Map(m);
                    const cle = `${section.marqueId}|${creneau}|${jour}`;
                    n.set(cle, [
                      ...(n.get(cle) ?? []),
                      { id: String(Date.now()), vendeurId: '1', jour, creneauCode: creneau,
                        marqueId: section.marqueId, typeVehicule: 'VN', client, commentaire: null },
                    ]);
                    return n;
                  });
                }}
                onModifier={async (r, client) => {
                  noter(`modifié « ${r.client} » → « ${client} »`);
                  setRdvs((m) => {
                    const n = new Map(m);
                    for (const [cle, liste] of n) {
                      if (liste.some((x) => x.id === r.id)) {
                        n.set(cle, liste.map((x) => (x.id === r.id ? { ...x, client } : x)));
                      }
                    }
                    return n;
                  });
                }}
                onArchiver={async (r) => {
                  noter(`archivé « ${r.client} »`);
                  setRdvs((m) => {
                    const n = new Map(m);
                    for (const [cle, liste] of n) {
                      const reste = liste.filter((x) => x.id !== r.id);
                      if (reste.length === 0) n.delete(cle); else n.set(cle, reste);
                    }
                    return n;
                  });
                }}
                onVendeurSuivant={() => noter('vendeur suivant')}
              />
            </div>
          </div>

          <div className="grille-graphiques">
            <div className="glass" style={{ padding: '1rem', borderRadius: 'var(--rayon)' }}>
              <h3 style={{ marginTop: 0 }}>Surface « glass »</h3>
              <p className="note">Palier léger — barres flottantes, menus.</p>
            </div>
            <div className="glass-strong" style={{ padding: '1rem', borderRadius: 'var(--rayon)' }}>
              <h3 style={{ marginTop: 0 }}>Surface « glass-strong »</h3>
              <p className="note">Palier dense — l'écran de connexion.</p>
            </div>
          </div>

          <section className="panneaux-live">
            <button
              type="button"
              className="bascule-panneaux"
              aria-expanded={voletOuvert}
              onClick={() => setVoletOuvert((o) => !o)}
            >
              <span className="chevron" aria-hidden="true">▸</span> Vue d’ensemble
              <span className="note">{voletOuvert ? 'masquer' : 'ouvrir le volet'}</span>
            </button>
            {voletOuvert && (
              <div className="grille-panneaux">
                <div className="panneau">
                  <header>
                    <h4>Les tables de CENTRE</h4>
                    <strong>458</strong>
                  </header>
                  <ul className="liste-panneau">
                    {LIGNES.slice(0, 4).map((l) => (
                      <li key={l.cle}>
                        <span className="libelle">{l.libelle}</span>
                        <span className="detail">{l.effectif} vend.</span>
                        <strong>{l.total}</strong>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="panneau">
                  <header>
                    <h4>Classement des concessions</h4>
                  </header>
                  <ul className="liste-panneau classement">
                    {LIGNES.map((l, i) => (
                      <li key={l.cle}>
                        <span className="rang">{i + 1}</span>
                        <span className="libelle">{l.libelle}</span>
                        <strong>{l.total}</strong>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </section>

          {/* ------------------------------------ nouveautes du 08/09/2026 */}
          <div className="carte">
            <h3>Filtres du classement — deux menus a choix multiple</h3>
            <div className="filtres-classement">
              <MenuMultiple
                etiquette="Plaques"
                libelleVide="Toutes"
                options={['CENTRE', 'NORD', 'SUD', 'SUD-OUEST'].map((p) => ({
                  id: p,
                  libelle: p,
                }))}
                retenus={plaquesRetenues}
                onChange={setPlaquesRetenues}
              />
              <MenuMultiple
                etiquette="Sites"
                libelleVide="Tous"
                options={[
                  'Clermont-Ferrand',
                  'Massagettes',
                  'Mozac',
                  'Ussel',
                  'Vichy',
                  'Moulins',
                  'Thiers',
                  'Le Puy',
                  'Mende',
                  'Issoire',
                  'Gaillac',
                  'Albi',
                  'Rodez',
                  'Millau',
                  'Figeac',
                  'Aurillac',
                  'Villefranche',
                  'Carmaux',
                  'Lavaur',
                ].map((st, i) => ({ id: st, libelle: st, detail: String(112 - i * 5) }))}
                retenus={sitesRetenus}
                onChange={setSitesRetenus}
              />
              {(plaquesRetenues.length > 0 || sitesRetenus.length > 0) && (
                <span className="compte-filtre">12 sur 99</span>
              )}
            </div>
          </div>

          <div className="carte">
            <h3>Origine de la liste de saisie</h3>
            <aside className="liste-vendeurs" style={{ maxWidth: '22rem' }}>
              <Segmente
                className="origine-saisie"
                etiquette="Qui afficher"
                valeur={origine}
                onChange={setOrigine}
                options={[
                  { valeur: 'table' as const, libelle: 'Ma table', detail: '6' },
                  { valeur: 'equipe' as const, libelle: 'Mon équipe', detail: '11' },
                  { valeur: 'tout' as const, libelle: 'Tout', detail: '15' },
                ]}
              />
              <div className="recherche-vendeur">
                <input placeholder="Chercher un vendeur, un site…" spellCheck={false} />
              </div>
            </aside>
          </div>

          <div className="carte">
            <h3>Journal des gestes</h3>
            {journal.length === 0 ? (
              <p className="note">Cliquer un segment, trier une colonne, saisir dans la grille.</p>
            ) : (
              <ul className="classement-complet">
                {journal.map((t, i) => (
                  <li key={i}><span className="libelle">{t}</span></li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

const racine = document.getElementById('racine');
if (!racine) throw new Error('#racine introuvable');
createRoot(racine).render(
  <StrictMode>
    <Atelier />
  </StrictMode>
);
