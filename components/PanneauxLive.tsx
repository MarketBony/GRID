import { useMemo, useState } from 'react';
import type { Dashboard, Rang, Totaux } from '../services/dashboard';
import { trierPar } from '../backend/src/utils/tri';

// ============================================================================
// PANNEAUX LIVE DU MODULE C.
//
// Le mot LIVE vient du fichier source : ses trois classements de l'onglet RANK
// sont titres « CLASSEMENT LIVE ». Ces chiffres sont regardes PENDANT la session,
// pas apres — c'est ce qui distingue cet outil d'un rapport.
//
// AUCUN CALCUL ICI. Tout vient de `services/dashboard.ts`, donc de `agregats.ts`,
// verifie contre les 1107 RDV reels de juin 2026. Recalculer un total dans un
// composant creerait un second endroit ou la regle vit : c'est exactement ce qui
// a produit deux denominateurs de progression divergents.
//
// LA SAISIE GARDE LA PRIORITE. Les panneaux sont replies par defaut : en cas
// d'arbitrage entre l'elegance d'un tableau de bord et la fluidite de la saisie,
// la saisie gagne toujours. Le choix d'ouverture est memorise par navigateur.
// ============================================================================

const CLE_OUVERTURE = 'relance.panneaux';

const lireOuverture = (): boolean => {
  try {
    return localStorage.getItem(CLE_OUVERTURE) === 'ouverts';
  } catch {
    // Navigation privee, stockage bloque : on retombe sur le defaut, replies.
    return false;
  }
};

const ecrireOuverture = (ouverts: boolean) => {
  try {
    localStorage.setItem(CLE_OUVERTURE, ouverts ? 'ouverts' : 'replies');
  } catch {
    // Sans importance : le panneau fonctionne, il ne se souviendra pas.
  }
};

export function PanneauxLive({
  dashboard,
  plaqueId,
  tableId,
}: {
  dashboard: Dashboard | null;
  /// La plaque du perimetre de l'utilisateur. `null` pour un admin qui voit tout :
  /// aucune plaque n'est « la sienne », on montre alors le groupe entier.
  plaqueId: string | null;
  /// La table qu'il anime, s'il en anime une. Elle est mise en avant.
  tableId: string | null;
}) {
  const [ouverts, setOuverts] = useState(lireOuverture);

  const basculer = () => {
    const suivant = !ouverts;
    setOuverts(suivant);
    ecrireOuverture(suivant);
  };

  return (
    <section className="panneaux-live">
      <button type="button" className="bascule-panneaux" onClick={basculer} aria-expanded={ouverts}>
        {ouverts ? '▾' : '▸'} Vue d’ensemble
        <span className="note">
          {ouverts ? 'masquer' : 'les autres tables, le classement des concessions'}
        </span>
      </button>

      {ouverts &&
        (dashboard === null ? (
          <p className="note">Chargement de la vue d’ensemble…</p>
        ) : (
          <div className="grille-panneaux">
            <PanneauPlaque dashboard={dashboard} plaqueId={plaqueId} tableId={tableId} />
            <PanneauClassement dashboard={dashboard} />
          </div>
        ))}
    </section>
  );
}

// ---------------------------------------------------------------- ma plaque

/// LES AUTRES TABLES DE MA PLAQUE — l'equivalent de l'onglet `TABLES(EAA)`.
///
/// Alimente par un calcul, et non par les 677 references de ligne figees du
/// fichier source (`=RÉSULTATS!A31`), qui cassaient des qu'on inserait une ligne.
///
/// QUAND LA PLAQUE EST EN `par_site`, CE SONT LES SITES qui s'affichent cote a
/// cote. Les tables sont un supplement, le site est le mode normal : NORD et
/// SUD-OUEST n'avaient aucune table en juin 2026, et le panneau doit leur etre
/// aussi utile qu'aux autres.
function PanneauPlaque({
  dashboard,
  plaqueId,
  tableId,
}: {
  dashboard: Dashboard;
  plaqueId: string | null;
  tableId: string | null;
}) {
  const session = plaqueId
    ? (dashboard.sessions.find((s) => s.plaqueId === plaqueId) ?? null)
    : null;

  const { titre, lignes, axe } = useMemo(() => {
    // Aucune plaque propre (admin) : on montre les plaques, c'est la vue
    // d'ensemble la plus utile a ce niveau.
    if (!plaqueId) {
      return {
        titre: 'Les plaques',
        axe: 'plaque' as const,
        lignes: [...dashboard.totaux.plaque].sort((a, b) => b.total - a.total),
      };
    }

    const parTable = session?.mode === 'par_table';
    if (parTable) {
      const desMiennes = dashboard.totaux.table.filter(
        (t) => dashboard.rattachements.tableVersPlaque[t.cle] === plaqueId
      );
      // La reserve (`sansTable`) n'a pas de plaque : elle regroupe les non
      // affectes de TOUT le groupe. On ne l'affiche pas ici, elle brouillerait
      // le total de la plaque.
      return {
        titre: `Les tables de ${session?.plaqueLibelle ?? 'ma plaque'}`,
        axe: 'table' as const,
        lignes: trierPar(desMiennes, (t) => t.libelle),
      };
    }

    const desMiens = dashboard.totaux.site.filter(
      (s) => dashboard.rattachements.siteVersPlaque[s.cle] === plaqueId
    );
    return {
      titre: `Les sites de ${session?.plaqueLibelle ?? 'ma plaque'}`,
      axe: 'site' as const,
      lignes: desMiens.sort((a, b) => b.total - a.total),
    };
  }, [dashboard, plaqueId, session]);

  const total = lignes.reduce((n, l) => n + l.total, 0);

  return (
    <div className="panneau">
      <header>
        <h4>{titre}</h4>
        <strong>{total}</strong>
      </header>

      {lignes.length === 0 ? (
        <p className="note">
          {axe === 'table'
            ? 'Cette plaque est en mode « par table » mais n’a encore aucune table. Le module Tables en crée.'
            : 'Aucun périmètre à afficher.'}
        </p>
      ) : (
        <ul className="liste-panneau">
          {lignes.map((l) => (
            <li key={l.cle} className={l.cle === tableId ? 'mienne' : ''}>
              <span className="libelle">
                {l.libelle}
                {l.cle === tableId && <span className="etiquette">ma table</span>}
              </span>
              <span className="detail">
                {l.effectif} vend. · {l.moyenne} / vend.
              </span>
              <strong>{l.total}</strong>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- classement

const CRITERES = [
  { cle: 'global' as const, libelle: 'Général' },
  { cle: 'vn' as const, libelle: 'VN' },
  { cle: 'vo' as const, libelle: 'VO' },
];

/// CLASSEMENT LIVE DES CONCESSIONS — les trois classements de l'onglet `RANK`.
///
/// Departage `total desc, vn desc, libelle asc`, documente dans `agregats.ts`.
/// Jamais l'astuce `valeur - ROW()/1000000` du fichier, qui dependait de la
/// POSITION de la ligne : inserer un vendeur reclassait des concessions sans que
/// rien ne change dans leurs chiffres.
///
/// Les ex aequo sont SIGNALES. L'ordre entre deux concessions a egalite est
/// stable, mais il est arbitraire : le taire ferait lire une hierarchie qui
/// n'existe pas — et ce panneau finit projete sur un ecran collectif.
function PanneauClassement({ dashboard }: { dashboard: Dashboard }) {
  const [critere, setCritere] = useState<'global' | 'vn' | 'vo'>('global');
  const rangs: Rang[] = dashboard.classements.site[critere];
  const valeur = (r: Rang) => (critere === 'global' ? r.total : critere === 'vn' ? r.vn : r.vo);

  return (
    <div className="panneau">
      <header>
        <h4>Classement des concessions</h4>
        <div className="segments">
          {CRITERES.map((c) => (
            <button
              key={c.cle}
              type="button"
              className={critere === c.cle ? 'segment actif' : 'segment'}
              onClick={() => setCritere(c.cle)}
            >
              {c.libelle}
            </button>
          ))}
        </div>
      </header>

      <ul className="liste-panneau classement">
        {rangs.map((r) => (
          <li key={r.cle}>
            <span className="rang">{r.rang}</span>
            <span className="libelle">
              {r.libelle}
              {r.exAequo && (
                <span className="etiquette" title="Égalité : l’ordre entre les ex æquo est stable mais arbitraire.">
                  ex æquo
                </span>
              )}
            </span>
            <strong>{valeur(r)}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

/// Total du groupe, pour l'en-tete de la saisie. Extrait ici pour que l'ecran de
/// saisie n'aille pas chercher dans la structure du dashboard.
export const totalGroupe = (dashboard: Dashboard | null): Totaux | null =>
  dashboard?.totaux.groupe[0] ?? null;
