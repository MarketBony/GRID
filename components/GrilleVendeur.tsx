import { useCallback, useEffect, useRef, useState } from 'react';
import type { RdvSaisie, SectionVendeur, VendeurSaisie } from '../services/saisie';
import { cleRdv, libelleJour } from '../utils/grille';

// ============================================================================
// LA GRILLE — le coeur du produit.
//
// Reproduit exactement la geometrie du fichier source : jours en COLONNES,
// creneaux en LIGNES, et une SECTION par marque autorisee pour un vendeur VN
// (« RENAULT » puis « DACIA », ou « ALPINE » seule sur le site Alpine). Un vendeur
// VO n'a qu'une section, sans marque.
//
// Les sections sont EMPILEES et visibles ensemble, sans selecteur a basculer :
// c'est ce que fait le fichier, et c'est ce qui permet au chef de voir ses deux
// compteurs se remplir en meme temps.
//
// CLAVIER (F-C.2 a F-C.8), la seule chose qui compte vraiment ici : le chef a un
// casque sur les oreilles et ne doit pas lacher son clavier.
//   - fleches et Tab : deplacent la case active
//   - Entree : ouvre la saisie, puis valide ET DESCEND d'une case
//   - Echap : annule
//   - Suppr : archive le RDV de la case
// Aucun bouton d'enregistrement : la validation ecrit (F-C.4).
// ============================================================================

export interface CelluleRef {
  sectionIndex: number;
  ligne: number;
  colonne: number;
}

const memeCellule = (a: CelluleRef | null, b: CelluleRef) =>
  !!a && a.sectionIndex === b.sectionIndex && a.ligne === b.ligne && a.colonne === b.colonne;


export function GrilleVendeur({
  vendeur,
  jours,
  creneaux,
  rdvs,
  figee,
  enregistrement,
  onPoser,
  onModifier,
  onArchiver,
  onVendeurSuivant,
}: {
  vendeur: VendeurSaisie;
  jours: { jour: string; ordre: number }[];
  creneaux: { code: string; libelle: string; ordre: number }[];
  /// RDV du vendeur affiche, indexes par `marqueId|creneauCode|jour`.
  rdvs: Map<string, RdvSaisie>;
  figee: boolean;
  enregistrement: boolean;
  onPoser: (section: SectionVendeur, creneauCode: string, jour: string, client: string) => Promise<void>;
  onModifier: (rdv: RdvSaisie, client: string) => Promise<void>;
  onArchiver: (rdv: RdvSaisie) => Promise<void>;
  onVendeurSuivant: () => void;
}) {
  const [active, setActive] = useState<CelluleRef | null>(null);
  const [edition, setEdition] = useState<CelluleRef | null>(null);
  const [brouillon, setBrouillon] = useState('');
  const champ = useRef<HTMLInputElement | null>(null);
  const conteneur = useRef<HTMLDivElement | null>(null);

  // DOUBLE ECRITURE A EMPECHER. `Entree` valide, ce qui demonte le champ, ce qui
  // declenche son `onBlur`, qui validait une SECONDE fois — avec la valeur figee
  // dans sa fermeture, donc en creant un doublon. Observe en base : le meme client
  // deux fois sur la meme case, et invisible a l'ecran puisque la case n'en affiche
  // qu'un.
  //
  // Un `state` ne suffit pas : le `onBlur` lit la fermeture de son rendu, pas la
  // valeur a jour. D'ou une ref, mise a jour SYNCHRONEMENT, que le `onBlur`
  // consulte pour savoir si la validation a deja eu lieu.
  const editionRef = useRef<CelluleRef | null>(null);
  const majEdition = (c: CelluleRef | null) => {
    editionRef.current = c;
    setEdition(c);
  };

  // Meme raison pour la case active : lue depuis la fermeture du rendu, elle
  // renvoyait une position perimee et une frappe rapide revenait sur la case
  // precedente.
  // Et le brouillon, pour la meme raison : `valider` lisait la valeur de son
  // rendu, donc potentiellement sans la derniere lettre frappee.
  const brouillonRef = useRef('');
  const majBrouillon = (v: string | ((p: string) => string)) => {
    brouillonRef.current = typeof v === 'function' ? v(brouillonRef.current) : v;
    setBrouillon(brouillonRef.current);
  };

  const activeRef = useRef<CelluleRef | null>(null);
  const majActive = (c: CelluleRef | null) => {
    activeRef.current = c;
    setActive(c);
  };

  // Changer de vendeur remet la case active en haut a gauche : le chef enchaine
  // les vendeurs (F-C.8) et doit repartir d'un point connu, pas de la position
  // heritee du precedent.
  useEffect(() => {
    majActive(null);
    majEdition(null);
    majBrouillon('');
  }, [vendeur.id]);

  useEffect(() => {
    if (edition) champ.current?.focus();
  }, [edition]);

  const sections = vendeur.sections;

  const deplacer = useCallback(
    (depuis: CelluleRef, dl: number, dc: number): CelluleRef => {
      let { sectionIndex, ligne, colonne } = depuis;

      colonne = Math.max(0, Math.min(jours.length - 1, colonne + dc));
      ligne += dl;

      // Franchir le haut ou le bas d'une section passe a la section voisine : les
      // sections empilees se parcourent comme une seule grille continue, ce qui
      // evite de reprendre la souris entre Renault et Dacia.
      while (ligne < 0 && sectionIndex > 0) {
        sectionIndex -= 1;
        ligne += creneaux.length;
      }
      while (ligne >= creneaux.length && sectionIndex < sections.length - 1) {
        sectionIndex += 1;
        ligne -= creneaux.length;
      }
      ligne = Math.max(0, Math.min(creneaux.length - 1, ligne));

      return { sectionIndex, ligne, colonne };
    },
    [creneaux.length, jours.length, sections.length]
  );

  const rdvDe = (c: CelluleRef): RdvSaisie | undefined =>
    rdvs.get(cleRdv(sections[c.sectionIndex].marqueId, creneaux[c.ligne].code, jours[c.colonne].jour));

  const ouvrir = (c: CelluleRef) => {
    if (figee) return;
    majActive(c);
    majBrouillon(rdvDe(c)?.client ?? '');
    majEdition(c);
  };

  /// Valide la case. `suivante` explicite la destination du curseur ; `true` sur
  /// `puisDescendre` prend la case du dessous, ce qui est le geste par defaut :
  /// on remonte une colonne de creneaux pour un meme jour.
  const valider = async (c: CelluleRef, puisDescendre: boolean, suivante?: CelluleRef) => {
    const texte = brouillonRef.current.trim();
    const existant = rdvDe(c);
    majEdition(null);
    majBrouillon('');

    // Le deplacement du curseur se fait AVANT l'attente reseau : le chef doit
    // pouvoir enchainer la case suivante sans attendre la reponse du serveur.
    const cible = suivante ?? (puisDescendre ? deplacer(c, 1, 0) : null);
    if (cible) {
      majActive(cible);
      conteneur.current?.focus();
    }

    if (texte === '') {
      // Vider une case revient a retirer le RDV : c'est le geste naturel, et il
      // passe par l'archivage, jamais par une suppression.
      if (existant) await onArchiver(existant);
    } else if (existant) {
      if (texte !== existant.client) await onModifier(existant, texte);
    } else {
      await onPoser(sections[c.sectionIndex], creneaux[c.ligne].code, jours[c.colonne].jour, texte);
    }
  };

  const surTouche = async (e: React.KeyboardEvent) => {
    if (figee) return;
    const c = activeRef.current ?? active ?? { sectionIndex: 0, ligne: 0, colonne: 0 };

    // `editionRef.current` et NON l'etat `edition` : le gestionnaire capture l'etat
    // du rendu ou il a ete attache, et les touches frappees entre deux rendus
    // voient donc une valeur PERIMEE. Consequence observee : les lettres 2 a N d'un
    // mot repassaient par la branche « ouvrir la saisie », qui REMPLACE le brouillon
    // au lieu de l'etendre — un mot entier disparaissait entre deux validations.
    //
    // La ref est mise a jour synchronement, elle dit toujours la verite.
    if (editionRef.current) {
      if (e.key === 'Escape') {
        e.preventDefault();
        majEdition(null);
        majBrouillon('');
        conteneur.current?.focus();
        return;
      }

      // COURSE A NE PAS PERDRE. Entre le moment ou une lettre ouvre la saisie et
      // celui ou React monte le champ et lui donne le focus, il s'ecoule un rendu.
      // Les lettres frappees pendant cet intervalle arrivent encore sur le
      // CONTENEUR, pas sur le champ. La premiere version les ignorait : un dactylo
      // rapide perdait le milieu de son mot — observe en test, « FORMENTI » tape
      // d'un trait ne laissait rien.
      //
      // On les AJOUTE au brouillon au lieu de les jeter. La frappe est donc
      // integralement conservee, quelle que soit la vitesse.
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        majBrouillon((b) => b + e.key);
        return;
      }

      // ET `Entree` AUSSI, ici. C'etait le maillon manquant.
      //
      // Quand la frappe est plus rapide que le montage du champ, le focus est
      // encore sur le CONTENEUR : `Entree` arrivait donc dans cette branche, ou
      // rien ne le traitait, et il etait purement avale. Symptome observe : sur
      // trois mots tapes d'affilee, le DEUXIEME disparaissait systematiquement —
      // son `Entree` ne validait pas, et le mot suivant l'ecrasait.
      //
      // Le champ garde son propre gestionnaire pour le cas normal ; celui-ci
      // couvre la fenetre ou il n'existe pas encore.
      if (e.key === 'Enter') {
        e.preventDefault();
        await valider(c, true);
        return;
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        await valider(c, false, deplacer(c, 0, e.shiftKey ? -1 : 1));
        return;
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        majActive(deplacer(c, 1, 0));
        break;
      case 'ArrowUp':
        e.preventDefault();
        majActive(deplacer(c, -1, 0));
        break;
      case 'ArrowRight':
        e.preventDefault();
        majActive(deplacer(c, 0, 1));
        break;
      case 'ArrowLeft':
        e.preventDefault();
        majActive(deplacer(c, 0, -1));
        break;
      case 'Tab':
        // Tab parcourt la ligne puis passe a la suivante, comme dans un tableur.
        e.preventDefault();
        majActive(
          c.colonne === jours.length - 1
            ? deplacer({ ...c, colonne: 0 }, 1, 0)
            : deplacer(c, 0, 1)
        );
        break;
      case 'Enter':
        e.preventDefault();
        ouvrir(c);
        break;
      case 'Delete':
      case 'Backspace': {
        e.preventDefault();
        const r = rdvDe(c);
        if (r) await onArchiver(r);
        break;
      }
      case 'n':
      case 'N':
        // Passer au vendeur suivant sans repasser par la liste (F-C.8).
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          onVendeurSuivant();
        }
        break;
      default:
        // Taper directement une lettre ouvre la saisie avec cette lettre : c'est
        // ce qui permet d'enchainer sans jamais appuyer sur Entree d'abord.
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault();
          majActive(c);
          majBrouillon(e.key);
          majEdition(c);
        }
    }
  };

  return (
    <div
      className="grille"
      tabIndex={0}
      ref={conteneur}
      onKeyDown={surTouche}
      role="grid"
      aria-label={`Planning de ${vendeur.nom}`}
    >
      {sections.map((section, sectionIndex) => (
        <table className="tableau-grille" key={section.marqueId ?? 'sansMarque'}>
          <thead>
            <tr>
              <th className="entete-section" scope="col">
                <span className="etiquette marque">{section.libelle}</span>
              </th>
              {jours.map((j) => (
                <th key={j.jour} scope="col">
                  {libelleJour(j.jour)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {creneaux.map((cr, ligne) => (
              <tr key={cr.code}>
                <th className="creneau" scope="row">
                  {cr.libelle}
                </th>
                {jours.map((j, colonne) => {
                  const c = { sectionIndex, ligne, colonne };
                  const rdv = rdvs.get(cleRdv(section.marqueId, cr.code, j.jour));
                  const estActive = memeCellule(active, c);
                  const estEdition = memeCellule(edition, c);

                  return (
                    <td
                      key={j.jour}
                      className={[
                        'case',
                        rdv ? 'remplie' : '',
                        estActive ? 'active' : '',
                        figee ? 'figee' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      onClick={() => (figee ? undefined : ouvrir(c))}
                      aria-selected={estActive}
                    >
                      {estEdition ? (
                        // `Entree` et `Echap` sont traites ICI, explicitement.
                        //
                        // Une premiere version s'appuyait sur la soumission
                        // implicite d'un `<form>` : elle depend du nombre de champs
                        // et de la presence d'un bouton de soumission, elle varie
                        // d'un navigateur a l'autre, et elle ne se declenche pas du
                        // tout sur un evenement clavier synthetique. Resultat
                        // observe : trois noms tapes a la suite atterrissaient dans
                        // la MEME case. Sur l'interaction la plus utilisee du
                        // produit, on ne delegue pas a une subtilite du navigateur.
                        <input
                          ref={champ}
                          value={brouillon}
                          onChange={(e) => majBrouillon(e.target.value)}
                          onBlur={() => {
                            // `Entree` a deja valide et remis la ref a null : le
                            // `onBlur` du champ demonte ne doit PAS revalider,
                            // sinon il recree le RDV avec la valeur figee dans sa
                            // fermeture. C'est ce qui produisait un doublon
                            // invisible a l'ecran.
                            if (memeCellule(editionRef.current, c)) void valider(c, false);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              e.stopPropagation();
                              void valider(c, true);
                            } else if (e.key === 'Escape') {
                              e.preventDefault();
                              e.stopPropagation();
                              majEdition(null);
                              majBrouillon('');
                              conteneur.current?.focus();
                            } else if (e.key === 'Tab') {
                              // Tab valide aussi, puis se decale d'une colonne :
                              // c'est le reflexe d'un tableur.
                              e.preventDefault();
                              e.stopPropagation();
                              void valider(c, false, deplacer(c, 0, e.shiftKey ? -1 : 1));
                            }
                          }}
                          spellCheck={false}
                          aria-label={`${cr.libelle} ${libelleJour(j.jour)}`}
                        />
                      ) : (
                        <span className="client">{rdv?.client ?? ''}</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      ))}

      <p className="note aide-clavier">
        Taper directement pour saisir · <kbd>Entrée</kbd> valide et descend ·{' '}
        <kbd>Échap</kbd> annule · <kbd>flèches</kbd> et <kbd>Tab</kbd> se déplacent ·{' '}
        <kbd>Suppr</kbd> retire · <kbd>Ctrl</kbd>+<kbd>N</kbd> vendeur suivant
        {enregistrement && <span className="etat-enregistrement"> · enregistrement…</span>}
      </p>
    </div>
  );
}


