import { libelleJour } from '../utils/grille';
import type { RdvSaisie, SectionVendeur, VendeurSaisie } from '../services/saisie';
import { cleRdv } from '../utils/grille';

// ============================================================================
// PLANNING IMPRIMABLE — le document qui part au mur de la concession.
//
// CE N'EST PAS LA GRILLE DE SAISIE, et ca ne doit pas l'etre. `GrilleVendeur`
// porte des champs, un curseur clavier, du verre et un theme sombre : trois
// choses inutiles sur du papier et une qui le rend illisible. Ce composant est
// un artefact separe, statique, en theme CLAIR force.
//
// ---------------------------------------------------------------------------
// LA CONTRAINTE QUI COMMANDE TOUT : ON ECRIT DESSUS
// ---------------------------------------------------------------------------
// Les encadrants collent ces planchesau mur et suivent les RDV AU CRAYON pendant
// les cinq jours. Une case doit donc pouvoir accueillir un nom ECRIT A LA MAIN,
// ce qui demande beaucoup plus de place qu'a l'ecran.
//
// Compte fait sur A4 paysage — 297 x 210 mm, marges 8 mm, soit 281 x 194 mm
// utiles :
//   - en-tete 24 mm, pied 10 mm -> 160 mm pour la grille ;
//   - 11 creneaux + 1 ligne de titre = 12 lignes -> 13,3 mm par ligne ;
//   - 1 colonne de creneaux (26 mm) + 5 jours -> 51 mm par jour.
// Une case de 51 x 13 mm se remplit au stylo sans effort.
//
// C'est ce calcul qui impose UNE PAGE PAR VENDEUR ET PAR MARQUE. Empiler les
// deux sections d'un vendeur VN sur une A4 tomberait a 6,6 mm par ligne, et les
// mettre cote a cote a 23 mm par colonne : on retrouverait l'etroitesse de
// l'ecran, sur un support ou l'on ecrit. En A3 paysage, la meme page respire au
// double et deux sections tiennent cote a cote — c'est le format a privilegier
// quand la concession a un traceur A3.
//
// ---------------------------------------------------------------------------
// CE QUI EST IMPRIME, ET CE QUI EST LAISSE VIDE
// ---------------------------------------------------------------------------
// Les RDV deja poses sont ECRITS : ce sont eux qu'on vient suivre. Les cases
// vides restent VIDES et sans trame — une trame grise mange l'encre et se voit
// sous le crayon. Chaque case porte une pastille a cocher : c'est le geste du
// suivi, « ce rendez-vous est venu ».
// ============================================================================

export interface PagePlanning {
  vendeur: VendeurSaisie;
  section: SectionVendeur;
}

/// Une page par couple (vendeur, section). L'ordre est celui de la liste des
/// vendeurs, puis celui des sections du vendeur — donc l'ordre des marques, qui
/// vient de la base et non d'un tri d'affichage.
export function paginer(vendeurs: VendeurSaisie[]): PagePlanning[] {
  const pages: PagePlanning[] = [];
  for (const vendeur of vendeurs) {
    for (const section of vendeur.sections) pages.push({ vendeur, section });
  }
  return pages;
}

const jourCourt = (iso: string): { jour: string; date: string } => {
  const [nom, date] = libelleJour(iso).split(' ');
  return { jour: (nom ?? '').slice(0, 3).toUpperCase(), date: date ?? '' };
};

export function PlanningImprimable({
  pages,
  jours,
  creneaux,
  rdvs,
  campagne,
  perimetre,
}: {
  pages: PagePlanning[];
  jours: { jour: string }[];
  creneaux: { code: string; libelle: string }[];
  /// Indexes par `cleRdv(marqueId, creneauCode, jour)`, comme a la saisie. Une
  /// case peut en porter PLUSIEURS — deux RDV dans un creneau existent, c'est
  /// tout l'objet du lot du 03/09.
  rdvs: Map<string, Map<string, RdvSaisie[]>>;
  campagne: { libelle: string; jours: { jour: string }[] };
  /// « Table 3 - EAA — CENTRE », ou le libelle du site. Ce qui situe la planche
  /// quand elle est seule sur un mur.
  perimetre: string;
}) {
  return (
    <div className="planning-imprimable">
      {pages.map(({ vendeur, section }) => {
        const pour = rdvs.get(vendeur.id);
        const total = creneaux.reduce(
          (n, c) =>
            n +
            jours.reduce(
              (m, j) => m + (pour?.get(cleRdv(section.marqueId, c.code, j.jour))?.length ?? 0),
              0
            ),
          0
        );

        return (
          <section className="page-planning" key={`${vendeur.id}-${section.marqueId ?? 'vo'}`}>
            <header className="entete-planning">
              <div className="qui">
                <h1>{vendeur.nom}</h1>
                <p>
                  {vendeur.siteLibelle} ({vendeur.siteCode}) · {perimetre}
                </p>
              </div>
              <div className="quoi">
                <span className="marque-planning">{section.libelle}</span>
                <p>{campagne.libelle}</p>
              </div>
            </header>

            <table className="grille-planning">
              <thead>
                <tr>
                  <th className="col-creneau">Créneau</th>
                  {jours.map((j) => {
                    const { jour, date } = jourCourt(j.jour);
                    return (
                      <th key={j.jour}>
                        <span className="jour-nom">{jour}</span>
                        <span className="jour-date">{date}</span>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {creneaux.map((c) => (
                  <tr key={c.code}>
                    <th className="col-creneau">{c.libelle}</th>
                    {jours.map((j) => {
                      const liste = pour?.get(cleRdv(section.marqueId, c.code, j.jour)) ?? [];
                      return (
                        <td key={j.jour} className={liste.length > 0 ? 'remplie' : undefined}>
                          {liste.map((r) => (
                            <span className="rdv-imprime" key={r.id}>
                              {/* LA PASTILLE EST LE GESTE DU SUIVI : on la coche
                                  au stylo quand le client est venu. */}
                              <span className="pastille" aria-hidden="true" />
                              <span className="nom-client">{r.client}</span>
                            </span>
                          ))}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>

            <footer className="pied-planning">
              <span>
                <strong>{total}</strong> RDV posés à l&apos;impression
              </span>
              <span className="suivi">
                Venus <span className="a-remplir" /> · Ventes <span className="a-remplir" />
              </span>
              <span className="marque-pied">GRID · Groupe Bony</span>
            </footer>
          </section>
        );
      })}
    </div>
  );
}
