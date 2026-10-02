import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RdvSaisie, SectionVendeur, VendeurSaisie } from '../../services/saisie';
import { cleRdv, libelleJour } from '../../utils/grille';
import { useIndicateurGlissant } from '../../hooks/useIndicateurGlissant';

// ============================================================================
// LA GRILLE UNIQUE — D20 de PLAN-GRID-V2.md (03/10/2026).
//
// UNE grille par vendeur, toutes marques confondues : jours en colonnes, creneaux
// en lignes. La marque ne decoupe plus la grille en deux, elle se CHOISIT au
// moment de poser le RDV — par defaut la derniere utilisee pour ce vendeur.
//
// LE MODELE NE BOUGE PAS. Chaque RDV porte toujours sa marque (`rdv.marque_id`),
// R-C.1 et ses triggers verifient toujours qu'elle est autorisee : c'est un
// changement d'INTERFACE. Une case montre donc les RDV de toutes les marques, avec
// une pastille de marque pour chacun.
//
// LE GESTE CLAVIER EST CELUI DE `GrilleVendeur`, A L'IDENTIQUE — on ne fait pas
// reapprendre une seance la veille : taper saisit, `Entree` valide et descend,
// `Echap` annule, fleches et `Tab` se deplacent, `Suppr` retire, `Ctrl+Entree`
// ajoute un second RDV dans la case, `Ctrl+N` passe au vendeur suivant.
// Trois gestes s'ajoutent (D13) : `Alt+M` change de marque, `Ctrl+Z` annule la
// derniere pose, et la saisie express pose dans la prochaine case libre.
// ============================================================================

interface Cellule {
  ligne: number;
  colonne: number;
}

const memeCellule = (a: Cellule | null, b: Cellule) => !!a && a.ligne === b.ligne && a.colonne === b.colonne;

const classeMarque = (libelle: string) => {
  const l = libelle.toLowerCase();
  return l.includes('renault') ? 'renault' : l.includes('dacia') ? 'dacia' : l.includes('alpine') ? 'alpine' : 'vo';
};

/// La marque retenue par vendeur, pour la seance : un chef de table qui a pose
/// trois Dacia de suite pour un vendeur ne doit pas re-choisir Dacia au
/// quatrieme. En memoire seulement — rien a stocker d'une seance a l'autre.
const derniereMarque = new Map<string, number>();

export function GrilleUnique({
  vendeur,
  jours,
  creneaux,
  rdvs,
  figee,
  onPoser,
  onModifier,
  onArchiver,
  onVendeurSuivant,
}: {
  vendeur: VendeurSaisie;
  jours: { jour: string; ordre: number }[];
  creneaux: { code: string; libelle: string; ordre: number }[];
  rdvs: Map<string, RdvSaisie[]>;
  figee: boolean;
  onPoser: (section: SectionVendeur, creneauCode: string, jour: string, client: string) => Promise<void>;
  onModifier: (rdv: RdvSaisie, client: string) => Promise<void>;
  onArchiver: (rdv: RdvSaisie) => Promise<void>;
  onVendeurSuivant: () => void;
}) {
  const sections = vendeur.sections;
  const [marque, setMarque] = useState(() => derniereMarque.get(vendeur.id) ?? 0);
  const [active, setActive] = useState<Cellule | null>(null);
  const [edition, setEdition] = useState<{ cellule: Cellule; ajout: boolean } | null>(null);
  const [brouillon, setBrouillon] = useState('');
  const [express, setExpress] = useState('');
  const [posees, setPosees] = useState<Set<string>>(new Set());
  const [annonce, setAnnonce] = useState<string | null>(null);
  const derniere = useRef<{ cellule: Cellule; client: string; quand: number } | null>(null);
  const conteneur = useRef<HTMLDivElement | null>(null);
  const champ = useRef<HTMLInputElement | null>(null);
  // Les refs portent l'etat que les gestionnaires clavier doivent lire A JOUR :
  // deux frappes rapprochees ne laissent pas a React le temps de re-rendre.
  const activeRef = useRef<Cellule | null>(null);
  const editionRef = useRef<{ cellule: Cellule; ajout: boolean } | null>(null);
  const brouillonRef = useRef('');

  const majActive = (c: Cellule | null) => {
    activeRef.current = c;
    setActive(c);
  };
  const majEdition = (e: { cellule: Cellule; ajout: boolean } | null) => {
    editionRef.current = e;
    setEdition(e);
  };
  const majBrouillon = (v: string) => {
    brouillonRef.current = v;
    setBrouillon(v);
  };

  // Changer de vendeur repart d'une grille sans curseur ni saisie en cours, et
  // reprend la marque qu'on utilisait pour LUI.
  useEffect(() => {
    majActive(null);
    majEdition(null);
    majBrouillon('');
    setMarque(Math.min(derniereMarque.get(vendeur.id) ?? 0, Math.max(0, sections.length - 1)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendeur.id]);

  useEffect(() => {
    if (edition) champ.current?.focus();
  }, [edition]);

  const choisirMarque = (i: number) => {
    setMarque(i);
    derniereMarque.set(vendeur.id, i);
  };

  /// Les RDV d'une case, TOUTES MARQUES. Ordre : identifiant croissant (les
  /// provisoires a la fin), le meme que `inserer` dans `pages/Saisie.tsx`.
  const rdvsDe = useCallback(
    (c: Cellule): RdvSaisie[] =>
      sections
        .flatMap((s) => rdvs.get(cleRdv(s.marqueId, creneaux[c.ligne]!.code, jours[c.colonne]!.jour)) ?? [])
        .sort((a, b) => (a.enAttente ? Infinity : Number(a.id)) - (b.enAttente ? Infinity : Number(b.id))),
    [rdvs, sections, creneaux, jours]
  );

  const deplacer = (c: Cellule, dl: number, dc: number): Cellule => ({
    ligne: Math.max(0, Math.min(creneaux.length - 1, c.ligne + dl)),
    colonne: Math.max(0, Math.min(jours.length - 1, c.colonne + dc)),
  });

  const section = sections[marque] ?? sections[0];
  const libelleMarque = (marqueId: string | null) =>
    sections.find((s) => s.marqueId === marqueId)?.libelle ?? 'VO';

  const poser = async (c: Cellule, client: string) => {
    if (!section) return;
    const cle = `${c.ligne}|${c.colonne}|${client}`;
    derniere.current = { cellule: c, client, quand: Date.now() };
    setPosees((p) => new Set(p).add(cle));
    window.setTimeout(() => setPosees((p) => {
      const n = new Set(p);
      n.delete(cle);
      return n;
    }), 900);
    await onPoser(section, creneaux[c.ligne]!.code, jours[c.colonne]!.jour, client);
  };

  const ouvrir = (c: Cellule, ajout = false) => {
    if (figee) return;
    majActive(c);
    majBrouillon(ajout ? '' : (rdvsDe(c)[0]?.client ?? ''));
    majEdition({ cellule: c, ajout });
  };

  const valider = async (puisDescendre: boolean, suivante?: Cellule) => {
    const e = editionRef.current;
    if (!e) return;
    const texte = brouillonRef.current.trim();
    const existant = rdvsDe(e.cellule)[0];
    majEdition(null);
    majBrouillon('');
    // Le curseur avance AVANT l'attente reseau : on enchaine sans attendre la base.
    const cible = suivante ?? (puisDescendre ? deplacer(e.cellule, 1, 0) : null);
    if (cible) majActive(cible);
    conteneur.current?.focus();
    if (e.ajout) {
      if (texte !== '') await poser(e.cellule, texte);
    } else if (texte === '') {
      if (existant) await onArchiver(existant);
    } else if (existant) {
      if (texte !== existant.client) await onModifier(existant, texte);
    } else {
      await poser(e.cellule, texte);
    }
  };

  /// CTRL+Z : retirer la derniere pose, pendant 10 secondes. C'est un ARCHIVAGE
  /// (interdit n.1) : le RDV sort des totaux, pas de l'historique.
  const annulerDerniere = async () => {
    const d = derniere.current;
    if (!d || Date.now() - d.quand > 10_000) {
      setAnnonce('Rien à annuler.');
      return;
    }
    const r = rdvsDe(d.cellule).find((x) => x.client === d.client.toUpperCase() || x.client === d.client);
    if (!r) return;
    if (r.enAttente) {
      setAnnonce(`${r.client} est encore en cours d'envoi : réessayer dans un instant.`);
      return;
    }
    derniere.current = null;
    await onArchiver(r);
    setAnnonce(`${r.client} retiré.`);
  };

  useEffect(() => {
    if (!annonce) return;
    const t = window.setTimeout(() => setAnnonce(null), 2600);
    return () => window.clearTimeout(t);
  }, [annonce]);

  /// SAISIE EXPRESS (D13, n.2) : la PROCHAINE case libre a partir du curseur,
  /// dans l'ordre de lecture d'une journee — on descend les creneaux d'un jour,
  /// puis on passe au jour suivant.
  const prochaineLibre = (depuis: Cellule | null): Cellule | null => {
    const debut = depuis ? depuis.colonne * creneaux.length + depuis.ligne : 0;
    const total = creneaux.length * jours.length;
    for (let k = 0; k < total; k++) {
      const n = (debut + k) % total;
      const c = { colonne: Math.floor(n / creneaux.length), ligne: n % creneaux.length };
      if (rdvsDe(c).length === 0) return c;
    }
    return null;
  };

  const poserExpress = async () => {
    const client = express.trim();
    if (!client || figee) return;
    const c = prochaineLibre(activeRef.current);
    if (!c) {
      setAnnonce('Toutes les cases de ce vendeur sont prises.');
      return;
    }
    setExpress('');
    majActive(deplacer(c, 1, 0));
    await poser(c, client);
  };

  const surTouche = async (e: React.KeyboardEvent) => {
    if (figee) return;
    if (e.altKey && (e.key === 'm' || e.key === 'M') && sections.length > 1) {
      e.preventDefault();
      choisirMarque((marque + 1) % sections.length);
      return;
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z') && !editionRef.current) {
      e.preventDefault();
      await annulerDerniere();
      return;
    }
    const c = activeRef.current ?? { ligne: 0, colonne: 0 };
    if (editionRef.current) return; // le champ gere ses propres touches
    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); majActive(deplacer(c, 1, 0)); break;
      case 'ArrowUp': e.preventDefault(); majActive(deplacer(c, -1, 0)); break;
      case 'ArrowRight': e.preventDefault(); majActive(deplacer(c, 0, 1)); break;
      case 'ArrowLeft': e.preventDefault(); majActive(deplacer(c, 0, -1)); break;
      case 'Tab':
        e.preventDefault();
        majActive(c.colonne === jours.length - 1 ? deplacer({ ...c, colonne: 0 }, 1, 0) : deplacer(c, 0, 1));
        break;
      case 'Enter': e.preventDefault(); ouvrir(c, e.ctrlKey || e.metaKey); break;
      case 'Delete':
      case 'Backspace': {
        e.preventDefault();
        const r = rdvsDe(c)[0];
        if (r) await onArchiver(r);
        break;
      }
      case 'n':
      case 'N':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          onVendeurSuivant();
          break;
        }
      // eslint-disable-next-line no-fallthrough
      default:
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault();
          majActive(c);
          majBrouillon(e.key);
          majEdition({ cellule: c, ajout: false });
        }
    }
  };

  const seg = useIndicateurGlissant(marque, sections.length);
  const aujourdHui = useMemo(() => new Date().toISOString().slice(0, 10), []);

  return (
    <div className="grille-v2" tabIndex={0} ref={conteneur} onKeyDown={surTouche} role="grid" aria-label={`Planning de ${vendeur.nom}`}>
      <div className="grille-outils">
        <label className="express">
          <svg className="i sm" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
          <input
            value={express}
            disabled={figee}
            placeholder="Nom du client — Entrée pose dans la prochaine case libre"
            onChange={(e) => setExpress(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Enter') {
                e.preventDefault();
                void poserExpress();
              }
              if (e.altKey && (e.key === 'm' || e.key === 'M') && sections.length > 1) {
                e.preventDefault();
                choisirMarque((marque + 1) % sections.length);
              }
            }}
          />
          <span className="kbd">⏎</span>
        </label>
        {sections.length > 1 && (
          <div className="seg" ref={seg.conteneur} role="radiogroup" aria-label="Marque du prochain RDV">
            <span className="pouce" ref={seg.indicateur} aria-hidden="true" />
            {sections.map((s, i) => (
              <button
                key={s.marqueId ?? 'vo'}
                type="button"
                ref={seg.cible(i)}
                aria-pressed={i === marque}
                onClick={() => choisirMarque(i)}
                title="Alt+M pour changer de marque"
              >
                <span className={`point-marque ${classeMarque(s.libelle)}`} aria-hidden="true" /> {s.libelle}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grille-defile">
        <table className="tableau-v2">
          <thead>
            <tr>
              <th aria-hidden="true" />
              {jours.map((j) => (
                <th key={j.jour} scope="col" className={j.jour === aujourdHui ? 'aujourdhui' : undefined}>
                  {libelleJour(j.jour)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {creneaux.map((cr, ligne) => (
              <tr key={cr.code}>
                <th scope="row" className="creneau">{cr.libelle}</th>
                {jours.map((j, colonne) => {
                  const c = { ligne, colonne };
                  const lesRdv = rdvsDe(c);
                  const enEdition = edition && memeCellule(edition.cellule, c);
                  const vientDEtrePosee = lesRdv.some((r) => posees.has(`${ligne}|${colonne}|${r.client}`));
                  return (
                    <td
                      key={j.jour}
                      className={[
                        'case-v2',
                        lesRdv.length > 0 ? 'remplie' : '',
                        lesRdv.length > 1 ? 'multiple' : '',
                        lesRdv.some((r) => r.enAttente) ? 'en-attente' : '',
                        memeCellule(active, c) ? 'active' : '',
                        vientDEtrePosee ? 'posee' : '',
                        j.jour === aujourdHui ? 'aujourdhui' : '',
                        figee ? 'figee' : '',
                      ].filter(Boolean).join(' ')}
                      onClick={() => !figee && ouvrir(c)}
                      aria-selected={memeCellule(active, c)}
                    >
                      {enEdition ? (
                        <input
                          ref={champ}
                          value={brouillon}
                          spellCheck={false}
                          onChange={(e) => majBrouillon(e.target.value)}
                          onBlur={() => {
                            if (editionRef.current && memeCellule(editionRef.current.cellule, c)) void valider(false);
                          }}
                          onKeyDown={(e) => {
                            if (e.altKey && (e.key === 'm' || e.key === 'M') && sections.length > 1) {
                              e.preventDefault();
                              e.stopPropagation();
                              choisirMarque((marque + 1) % sections.length);
                              return;
                            }
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              e.stopPropagation();
                              void valider(true);
                            } else if (e.key === 'Escape') {
                              e.preventDefault();
                              e.stopPropagation();
                              majEdition(null);
                              majBrouillon('');
                              conteneur.current?.focus();
                            } else if (e.key === 'Tab') {
                              e.preventDefault();
                              e.stopPropagation();
                              void valider(false, deplacer(c, 0, e.shiftKey ? -1 : 1));
                            }
                          }}
                          aria-label={`${cr.libelle} ${libelleJour(j.jour)}${edition?.ajout ? ' — second RDV' : ''}`}
                        />
                      ) : (
                        lesRdv.map((r) => (
                          <span className="rdv" key={r.id} title={`${r.client} — ${libelleMarque(r.marqueId)}`}>
                            {sections.length > 1 && <span className={`point-marque ${classeMarque(libelleMarque(r.marqueId))}`} aria-hidden="true" />}
                            <span className="client">{r.client}</span>
                          </span>
                        ))
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="aide-v2">
        Taper pour saisir · <span className="kbd">Entrée</span> valide · <span className="kbd">Échap</span> annule ·{' '}
        <span className="kbd">Ctrl</span>+<span className="kbd">Entrée</span> 2ᵉ RDV ·{' '}
        {sections.length > 1 && (<><span className="kbd">Alt</span>+<span className="kbd">M</span> marque · </>)}
        <span className="kbd">Ctrl</span>+<span className="kbd">Z</span> annule la dernière pose ·{' '}
        <span className="kbd">Ctrl</span>+<span className="kbd">N</span> vendeur suivant
        {annonce && <span className="annonce-grille" role="status">{annonce}</span>}
      </p>
    </div>
  );
}
