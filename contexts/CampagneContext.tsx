import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { NatureCampagne } from '../backend/src/auth/roles';

// ============================================================================
// LA CAMPAGNE COURANTE — partagee par tous les ecrans.
//
// POURQUOI CE FICHIER EXISTE. Chaque ecran portait SON propre `campagneId` dans
// un `useState`. Or `App` demonte l'ecran quitte et remonte l'ecran choisi :
// l'etat local mourait avec lui. Se mettre sur juin au tableau de bord, faire un
// tour dans la saisie, revenir — et retrouver septembre.
//
// Ce n'etait pas seulement agacant, c'etait TROMPEUR : deux ecrans pouvaient
// afficher deux campagnes differentes en meme temps, sans que rien ne le signale.
// On compare alors des chiffres de juin a une composition de tables de septembre.
//
// Une seule campagne courante, donc, pour toute l'application.
//
// ---------------------------------------------------------------------------
// CE QUE CE CONTEXTE NE FAIT PAS
// ---------------------------------------------------------------------------
// Il ne porte QUE l'identifiant choisi. Ni la liste des campagnes, ni leur
// contenu : chaque ecran charge ce dont il a besoin. Mettre les donnees ici en
// ferait un cache a invalider, et un cache qu'on oublie d'invalider affiche des
// chiffres perimes — exactement ce que l'interdit n.2 refuse en base.
//
// Il ne porte pas non plus la campagne de COMPARAISON du tableau de bord : c'est
// une autre question (« comparer a quoi ? »), qui n'a de sens que sur cet ecran.
//
// ---------------------------------------------------------------------------
// L'IDENTIFIANT PEUT ETRE PERIME, ET C'EST A L'APPELANT DE LE VOIR
// ---------------------------------------------------------------------------
// Il survit a un rechargement de page (`sessionStorage`), donc il peut designer
// une campagne archivee depuis, ou qu'un chef de table ne voit plus. Chaque ecran
// doit donc verifier que l'identifiant figure dans SA liste avant de s'en servir,
// et retomber sur son defaut sinon — c'est ce que fait `choisirDansListe`.
//
// `sessionStorage` meurt avec l'onglet du navigateur, ce qui est le bon horizon :
// on garde le contexte d'une session de travail, pas une preference durable qui
// suivrait quelqu'un d'une campagne a l'autre pendant des mois.
// ============================================================================

const CLE = 'grid.campagneCourante';

// ---------------------------------------------------------------------------
// DEUX ESPACES, DEUX CAMPAGNES COURANTES (GRID/VP, 20/10/2026)
// ---------------------------------------------------------------------------
// GRID classique et GRID/VP montent chacun leur fournisseur : la NATURE dit aux
// ecrans partages (saisie, Suivi) quelles campagnes lister, et la CLE de memoire
// est distincte. Sans cela, ouvrir une VP puis revenir a GRID classique y ferait
// atterrir sur la VP — que la liste de GRID classique ne contient pas.

/// Lecture defensive. `sessionStorage` peut lever — navigation privee, stockage
/// desactive par une politique d'entreprise — et une exception ici empecherait
/// l'application de monter. Elle ne vaut pas ce risque : sans elle, on repart
/// simplement sur le defaut de chaque ecran.
function lireMemoire(cle: string): string | null {
  try {
    return window.sessionStorage.getItem(cle);
  } catch {
    return null;
  }
}

function ecrireMemoire(cle: string, id: string | null): void {
  try {
    if (id === null) window.sessionStorage.removeItem(cle);
    else window.sessionStorage.setItem(cle, id);
  } catch {
    // Sans memoire, le contexte reste valable pour la duree de la session React :
    // le defaut corrige — les onglets ne se reinitialisent plus — tient quand meme.
  }
}

interface Contexte {
  /// `null` tant qu'aucun ecran n'a choisi. Ne jamais s'en servir sans avoir
  /// verifie qu'il figure dans la liste que l'ecran vient de charger.
  campagneId: string | null;
  choisir: (id: string | null) => void;
  /// Les campagnes de cet espace : `operation` pour GRID classique,
  /// `vente_privee` pour GRID/VP.
  nature: NatureCampagne;
}

const ContexteCampagne = createContext<Contexte | null>(null);

export function FournisseurCampagne({
  children,
  nature = 'operation',
}: {
  children: ReactNode;
  nature?: NatureCampagne;
}) {
  const cle = nature === 'operation' ? CLE : `${CLE}.${nature}`;
  const [campagneId, setId] = useState<string | null>(() => lireMemoire(cle));

  const choisir = useCallback(
    (id: string | null) => {
      setId(id);
      ecrireMemoire(cle, id);
    },
    [cle]
  );

  const valeur = useMemo(() => ({ campagneId, choisir, nature }), [campagneId, choisir, nature]);
  return <ContexteCampagne.Provider value={valeur}>{children}</ContexteCampagne.Provider>;
}

export function useCampagneCourante(): Contexte {
  const c = useContext(ContexteCampagne);
  if (!c) throw new Error('useCampagneCourante hors de FournisseurCampagne');
  return c;
}

/// Le choix d'un ecran au chargement de sa liste, en UNE ligne et une seule regle.
///
/// La campagne retenue est celle deja choisie SI elle figure dans la liste, sinon
/// le defaut de l'ecran. Chaque ecran garde donc son propre defaut — la saisie
/// ouvre sur une campagne ou l'on a quelque chose a faire, le tableau de bord sur
/// une campagne ouverte — et ce defaut ne s'applique que quand il n'y a rien a
/// respecter.
///
/// Rend l'identifiant a retenir, ou `null` si la liste est vide.
export function choisirDansListe<T extends { id: string }>(
  liste: T[],
  dejaChoisie: string | null,
  defaut: (liste: T[]) => T | undefined
): string | null {
  if (dejaChoisie !== null && liste.some((c) => c.id === dejaChoisie)) return dejaChoisie;
  return defaut(liste)?.id ?? null;
}
