import { useLayoutEffect, useMemo, useRef } from 'react';
import { duPhoning } from '../../backend/src/utils/agregats';
import {
  classementPhoning,
  courbeCumul,
  dureePhoning,
  fenetrePhoning,
  heuresCreuses,
  projection,
  remplissage,
  type FenetrePhoning,
} from '../../backend/src/utils/vp';
import { decimal, heureCreneau, jj, jourLong, Kpi, pct, type PropsEcranVp } from './commun';

// ============================================================================
// PHONING (J1-J2) — ce que regarde l'encadrant VP pendant que la salle appelle.
// La saisie, elle, est la grille de GRID classique (onglet Saisie).
// Tout est recalcule a chaque lecture par les fonctions de `utils/vp.ts`.
// ============================================================================

export function Pilotage({ donnees, maintenant }: PropsEcranVp) {
  const { vp, rdvs, vendeurs, creneaux } = donnees;
  const fenetre = useMemo(() => fenetrePhoning(vp.phoningDu, vp.phoningAu, creneaux), [vp, creneaux]);
  const classement = useMemo(() => classementPhoning(rdvs, vendeurs), [rdvs, vendeurs]);
  const lignesRemplissage = useMemo(() => remplissage(rdvs, creneaux), [rdvs, creneaux]);
  const creuses = useMemo(() => new Set(heuresCreuses(lignesRemplissage, 3)), [lignesRemplissage]);
  const proj = fenetre ? projection(rdvs, fenetre, maintenant) : null;

  const pris = duPhoning(rdvs).length;
  const objectif = classement.reduce((s, l) => s + (l.objectif ?? 0), 0);
  const derniereHeure = duPhoning(rdvs).filter((r) => maintenant.getTime() - new Date(r.creeLe).getTime() < 3_600_000).length;
  const moment =
    !fenetre || proj === null
      ? ''
      : proj.ecoule <= 0
        ? `commence le ${jourLong(vp.phoningDu)}`
        : proj.ecoule >= proj.duree
          ? 'phoning terminé'
          : `${proj.ecoule < dureePhoning(fenetre) / 2 ? 'J1' : 'J2'} · ${maintenant.getHours()} h ${String(maintenant.getMinutes()).padStart(2, '0')}`;

  return (
    <div className="page vp-page">
      <section className="vp-ecran actif">
        <div className="app-head">
          <h2>Phoning</h2>
          <span className="sub">{moment}</span>
        </div>

        <div className="kpis">
          <Kpi l="RDV pris" v={pris} d={objectif ? `${pct(pris / objectif)} de l’objectif` : 'aucun objectif posé'} accent />
          <Kpi
            l="Projection fin J2"
            v={proj ? proj.projete : '—'}
            d={proj && objectif ? (proj.projete >= objectif ? 'objectif atteint' : `${objectif - proj.projete} sous l’objectif`) : undefined}
          />
          <Kpi l="Objectif" v={objectif || '—'} d={`${classement.length} vendeurs`} />
          <Kpi l="Dernière heure" v={derniereHeure} d="RDV pris" />
          <Kpi l="Moyenne" v={decimal(classement.length ? pris / classement.length : null)} d="RDV par vendeur" />
        </div>

        <div className="vp-deux">
          <div className="card pad">
            <h3 className="card-titre">
              Classement en direct <span className="badge">{classement.length} vendeurs</span>
            </h3>
            <Classement lignes={classement} />
          </div>
          <div style={{ display: 'grid', gap: 14 }}>
            <div className="card pad">
              <h3 className="card-titre">Remplissage du {jj(vp.jour)}, heure par heure</h3>
              <Courbe lignes={lignesRemplissage} creuses={creuses} />
              <div className="vp-legende">
                <span><i style={{ background: 'var(--bony-grad)' }} />VN</span>
                <span><i style={{ background: 'var(--info)' }} />VO</span>
                {creuses.size > 0 && pris > 0 && (
                  <span style={{ color: 'var(--ok)' }}>
                    Heures creuses : {lignesRemplissage.filter((l) => creuses.has(l.code)).map((l) => heureCreneau(l.code)).join(', ')}
                  </span>
                )}
              </div>
            </div>
            <div className="card pad">
              <h3 className="card-titre">
                Projection {proj && <span className="badge">{decimal(proj.rythme)} RDV / h</span>}
              </h3>
              {fenetre && proj ? (
                <GrapheProjection fenetre={fenetre} rdvs={rdvs} pris={pris} projete={proj.projete} ecoule={proj.ecoule} objectif={objectif} />
              ) : (
                <div className="empty">Les dates de phoning ou les créneaux ne permettent pas de projeter.</div>
              )}
              <div className="vp-legende">
                <span><i style={{ background: 'var(--bony-orange)' }} />RDV pris</span>
                <span><i style={{ background: 'transparent', boxShadow: 'inset 0 0 0 2px var(--bony-violet)' }} />au rythme des 4 dernières heures</span>
                <span><i style={{ background: 'var(--ok)' }} />objectif</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

/// LE CLASSEMENT SE REORDONNE EN GLISSANT (FLIP) : chaque ligne part de son
/// ancienne place et rejoint la nouvelle, au ressort — composee par le GPU,
/// `transform` seul.
function Classement({ lignes }: { lignes: ReturnType<typeof classementPhoning> }) {
  const liste = useRef<HTMLOListElement | null>(null);
  const avant = useRef(new Map<string, number>());
  const rangs = useRef(new Map<string, number>());
  useLayoutEffect(() => {
    const ol = liste.current;
    if (!ol) return;
    const ressort = getComputedStyle(document.documentElement).getPropertyValue('--ressort-ample').trim() || 'ease-out';
    const reduit = document.documentElement.classList.contains('animations-reduites') || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    ol.querySelectorAll<HTMLLIElement>('li[data-id]').forEach((li) => {
      const id = li.dataset.id!;
      const haut = li.getBoundingClientRect().top;
      const de = avant.current.get(id);
      if (!reduit && de !== undefined && de !== haut) {
        li.animate([{ transform: `translateY(${de - haut}px)` }, { transform: 'none' }], { duration: 700, easing: ressort });
      }
      avant.current.set(id, haut);
    });
  }, [lignes]);
  const montes = new Set(lignes.filter((l, i) => (rangs.current.get(l.vendeurId) ?? i) > i).map((l) => l.vendeurId));
  useLayoutEffect(() => {
    lignes.forEach((l, i) => rangs.current.set(l.vendeurId, i));
  }, [lignes]);

  if (lignes.length === 0) return <div className="empty">Aucun vendeur dans cette VP.</div>;
  return (
    <ol className="vp-classement" ref={liste}>
      {lignes.map((l) => (
        <li key={l.vendeurId} data-id={l.vendeurId} className={montes.has(l.vendeurId) ? 'monte' : ''}>
          <span className="rang">{l.rang}</span>
          <span className="nom">{l.nom}</span>
          <span className="jauge-col">
            {l.objectif ? (
              <>
                <div className="vp-jauge">
                  <i style={{ transform: `scaleX(${Math.min(1, l.rdv / l.objectif)})` }} />
                </div>
                <div className="vp-jauge-lib">
                  <span>{pct(l.rdv / l.objectif)}</span>
                  <span>obj. {l.objectif}</span>
                </div>
              </>
            ) : (
              <div className="vp-jauge-lib"><span>sans objectif</span></div>
            )}
          </span>
          <span className="n">{l.rdv}</span>
        </li>
      ))}
    </ol>
  );
}

function Courbe({ lignes, creuses }: { lignes: ReturnType<typeof remplissage>; creuses: Set<string> }) {
  const L = 560, H = 190, g = 26, bas = H - 22;
  const larg = (L - g) / Math.max(1, lignes.length);
  const max = Math.max(4, ...lignes.map((l) => l.total));
  const y = (v: number) => bas - (v / max) * (bas - 10);
  const pas = Math.ceil(max / 4);
  return (
    <svg className="vp-svg" viewBox={`0 0 ${L} ${H}`} role="img" aria-label="RDV par heure le jour de la VP">
      <defs>
        <linearGradient id="vp-gvn" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#f75632" />
          <stop offset="1" stopColor="#a52fce" />
        </linearGradient>
      </defs>
      {Array.from({ length: Math.floor(max / pas) + 1 }, (_, i) => i * pas).map((k) => (
        <g key={k}>
          <line className="grille-l" x1={g} x2={L} y1={y(k)} y2={y(k)} />
          <text x={0} y={y(k) + 4}>{k}</text>
        </g>
      ))}
      {lignes.map((l, i) => {
        const x = g + i * larg + 5, w = larg - 10;
        return (
          <g key={l.code}>
            <rect x={x} y={y(l.vn)} width={w} height={bas - y(l.vn)} rx={5} fill="url(#vp-gvn)">
              <title>{`${heureCreneau(l.code)} : ${l.vn} VN`}</title>
            </rect>
            {l.vo > 0 && (
              <rect x={x} y={y(l.vn + l.vo)} width={w} height={Math.max(0, y(l.vn) - y(l.vn + l.vo) - 2)} rx={5} fill="var(--info)" opacity={0.75}>
                <title>{`${heureCreneau(l.code)} : ${l.vo} VO`}</title>
              </rect>
            )}
            <text x={x + w / 2} y={H - 6} textAnchor="middle" style={creuses.has(l.code) ? { fill: 'var(--ok)' } : undefined}>
              {heureCreneau(l.code).replace(' ', '')}
            </text>
            <text x={x + w / 2} y={y(l.total) - 6} textAnchor="middle" style={{ fill: 'var(--text-2)' }}>
              {l.total}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function GrapheProjection({
  fenetre,
  rdvs,
  pris,
  projete,
  ecoule,
  objectif,
}: {
  fenetre: FenetrePhoning;
  rdvs: PropsEcranVp['donnees']['rdvs'];
  pris: number;
  projete: number;
  ecoule: number;
  objectif: number;
}) {
  const L = 560, H = 190, g = 26, bas = H - 22;
  const duree = dureePhoning(fenetre);
  const max = Math.max(objectif, projete, pris, 4) * 1.1;
  const x = (t: number) => g + (t / duree) * (L - g - 6);
  const y = (v: number) => bas - (v / max) * (bas - 8);
  const points = courbeCumul(rdvs, fenetre);
  const trace = [`${x(0)},${y(0)}`, ...points.map((p) => `${x(p.t)},${y(p.n)}`), `${x(Math.min(ecoule, duree))},${y(pris)}`].join(' ');
  const parJour = fenetre.fin - fenetre.debut;
  return (
    <svg className="vp-svg" viewBox={`0 0 ${L} ${H}`} role="img" aria-label="RDV cumulés et projection">
      <defs>
        <linearGradient id="vp-gl" x1="0" x2="1">
          <stop offset="0" stopColor="#f75632" />
          <stop offset="1" stopColor="#a52fce" />
        </linearGradient>
      </defs>
      {fenetre.jours.map((j, i) => (
        <g key={j}>
          {i > 0 && <line x1={x(i * parJour)} x2={x(i * parJour)} y1={6} y2={bas} className="grille-l" strokeDasharray="3 4" />}
          <text x={x(i * parJour + parJour / 2)} y={H - 6} textAnchor="middle">
            J{i + 1} · {jj(j)}
          </text>
        </g>
      ))}
      {objectif > 0 && (
        <>
          <line x1={g} x2={L} y1={y(objectif)} y2={y(objectif)} stroke="var(--ok)" strokeWidth={1.5} strokeDasharray="6 5" />
          <text x={g} y={y(objectif) - 6} style={{ fill: 'var(--ok)' }}>objectif {objectif}</text>
        </>
      )}
      <polyline points={trace} fill="none" stroke="url(#vp-gl)" strokeWidth={3} strokeLinejoin="round" />
      {ecoule < duree && (
        <line x1={x(ecoule)} y1={y(pris)} x2={x(duree)} y2={y(projete)} stroke="var(--bony-violet)" strokeWidth={2.5} strokeDasharray="5 5" />
      )}
      <circle cx={x(Math.min(ecoule, duree))} cy={y(pris)} r={5} fill="var(--bony-orange)" />
      <text x={x(duree)} y={y(projete) - 8} textAnchor="end" style={{ fill: 'var(--text)', fontSize: 13 }}>
        ≈ {projete} en fin de J2
      </text>
    </svg>
  );
}
