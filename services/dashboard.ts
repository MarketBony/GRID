import { supabase, txt, txtOuNull, verifier, toutesLesLignes } from './supabase';
import {
  AXES,
  classer,
  comparer,
  totauxPar,
  totauxParJour,
  type Axe,
  type Ecart as EcartAgregat,
  type LigneRdv,
  type LigneVendeur,
  type Rang as RangAgregat,
  type TotalJour as TotalJourAgregat,
  type Totaux as TotauxAgregat,
} from '../backend/src/utils/agregats';
import { etaitPresent } from '../backend/src/utils/presenceVendeur';

// ============================================================================
// MODULE D — le tableau de bord, et les panneaux live du module C.
//
// LE CALCUL N'A PAS CHANGE D'UNE LIGNE, IL A CHANGE D'ENDROIT. `agregats.ts` est
// le MEME fichier qu'avant, avec ses 27 controles contre les 1107 RDV reels de
// juin 2026 — il tourne desormais dans le navigateur. C'est ce qui permet de
// supprimer l'API sans avoir a redemontrer que les totaux sont justes.
//
// LE NOM DU CLIENT NE PEUT PAS ARRIVER ICI. On lit `rdv_agrege`, une vue qui n'a
// ni `client` ni `commentaire`. C'est ce qui remplace `redacterRdvs` : la
// protection n'est plus un filtre qu'une nouvelle route pourrait oublier, elle est
// structurelle — le champ n'existe pas.
//
// L'EFFECTIF EST CALCULE, JAMAIS SAISI (F-D.3), et il est calcule POUR CETTE
// CAMPAGNE : la bonne question n'est pas « ce vendeur est-il encore la ? » mais
// « etait-il la PENDANT cette campagne ? ». `etaitPresent` est la source unique de
// cette regle, partagee avec la base.
// ============================================================================

export { AXES } from '../backend/src/utils/agregats';
export type { Axe } from '../backend/src/utils/agregats';

export type Totaux = TotauxAgregat;
export type Rang = RangAgregat;
export type TotalJour = TotalJourAgregat;
export type Ecart = EcartAgregat;

export interface Dashboard {
  campagne: {
    id: string;
    libelle: string;
    dateDebut: string;
    dateFin: string;
    cloturee: boolean;
    jours: string[];
  };
  sessions: {
    id: string;
    plaqueId: string;
    plaqueLibelle: string;
    mode: string;
    effectifCibleTable: number | null;
  }[];
  rattachements: {
    siteVersPlaque: Record<string, string>;
    tableVersPlaque: Record<string, string>;
  };
  totaux: Record<Axe, Totaux[]>;
  classementsSites: { global: Rang[]; vn: Rang[]; vo: Rang[] };
  classementVendeurs: Rang[];
  classementTables: Rang[];
  parJour: TotalJour[];
}

export interface Comparaison {
  axe: Axe;
  courante: { id: string; libelle: string };
  anterieure: { id: string; libelle: string };
  ecarts: Ecart[];
}

interface Charge {
  campagne: { id: string; libelle: string; dateDebut: string; dateFin: string; cloturee: boolean };
  jours: string[];
  sessions: Dashboard['sessions'];
  vendeurs: LigneVendeur[];
  rdvs: LigneRdv[];
  rattachements: Dashboard['rattachements'];
}

/// Rapatrie tout ce qu'il faut pour une campagne, et RIEN de plus.
async function chargerCampagne(campagneId: string): Promise<Charge> {
  const id = Number(campagneId);

  const [campagne, jours, sessions, vendeurs, affectations] = await Promise.all([
    supabase
      .from('campagne')
      .select('id, libelle, date_debut, date_fin, cloturee')
      .eq('id', id)
      .single(),
    supabase.from('campagne_jour').select('jour').eq('campagne_id', id).order('ordre'),
    supabase
      .from('session_plaque')
      .select('id, mode, effectif_cible_table, plaque(id, libelle, ordre)')
      .eq('campagne_id', id)
      .is('archive_le', null),
    // LE RATTACHEMENT PLAQUE VIENT D'UNE JOINTURE sur `site.plaque_id`, jamais
    // d'une derivation : le rattachement d'un site a une plaque est MODIFIABLE,
    // c'est un piege herite du fichier source.
    supabase
      .from('vendeur')
      .select('id, nom, type_vehicule, date_entree, date_sortie, site(id, libelle, plaque(id, libelle))')
      .is('archive_le', null),
    supabase
      .from('affectation')
      .select('vendeur_id, table_phoning!inner(id, libelle, session_plaque!inner(campagne_id, plaque_id))')
      .is('archive_le', null)
      .eq('table_phoning.session_plaque.campagne_id', id),
  ]);

  const c = verifier(campagne) as {
    id: number;
    libelle: string;
    date_debut: string;
    date_fin: string;
    cloturee: boolean;
  };

  type LigneSession = {
    id: number;
    mode: string;
    effectif_cible_table: number | null;
    plaque: { id: number; libelle: string; ordre: number } | null;
  };
  type LigneV = {
    id: number;
    nom: string;
    type_vehicule: string;
    date_entree: string | null;
    date_sortie: string | null;
    site: { id: number; libelle: string; plaque: { id: number; libelle: string } | null } | null;
  };
  type LigneAff = {
    vendeur_id: number;
    table_phoning: {
      id: number;
      libelle: string;
      session_plaque: { campagne_id: number; plaque_id: number } | null;
    } | null;
  };

  const bornes = { dateDebut: new Date(c.date_debut), dateFin: new Date(c.date_fin) };

  const lignesAff = verifier(affectations) as unknown as LigneAff[];
  const tableParVendeur = new Map<number, { id: string; libelle: string; plaqueId: string }>();
  const tableVersPlaque: Record<string, string> = {};
  for (const a of lignesAff) {
    if (!a.table_phoning?.session_plaque) continue;
    tableParVendeur.set(a.vendeur_id, {
      id: txt(a.table_phoning.id),
      libelle: a.table_phoning.libelle,
      plaqueId: txt(a.table_phoning.session_plaque.plaque_id),
    });
    tableVersPlaque[txt(a.table_phoning.id)] = txt(a.table_phoning.session_plaque.plaque_id);
  }

  const siteVersPlaque: Record<string, string> = {};
  const lignesV = (verifier(vendeurs) as unknown as LigneV[]).filter((v) =>
    // LA PRESENCE PENDANT LA CAMPAGNE, et non « aujourd'hui ». Sans ce filtre,
    // la moyenne RDV/vendeur d'une campagne passee change des qu'un vendeur part —
    // c'est le bug `RANK!AG` du fichier Excel par un autre chemin.
    etaitPresent(
      {
        dateEntree: v.date_entree ? new Date(v.date_entree) : null,
        dateSortie: v.date_sortie ? new Date(v.date_sortie) : null,
      },
      bornes
    )
  );

  const lignesVendeur: LigneVendeur[] = lignesV.map((v) => {
    const table = tableParVendeur.get(v.id) ?? null;
    if (v.site?.plaque) siteVersPlaque[txt(v.site.id)] = txt(v.site.plaque.id);
    return {
      id: txt(v.id),
      nom: v.nom,
      siteId: txt(v.site?.id),
      siteLibelle: v.site?.libelle ?? '',
      plaqueId: txt(v.site?.plaque?.id),
      plaqueLibelle: v.site?.plaque?.libelle ?? '',
      tableId: table?.id ?? null,
      tableLibelle: table?.libelle ?? null,
      typeVehicule: v.type_vehicule as LigneVendeur['typeVehicule'],
    };
  });

  // LA LECTURE PAGINEE, ORDONNEE ET VERIFIEE.
  //
  // Trois choses, et il en faut trois. `toutesLesLignes` ORDONNE sur `id` — sans
  // ordre, deux pages d'une meme requete peuvent se recouvrir et le tableau de
  // bord affiche des totaux faux avec le bon nombre de lignes (constate le
  // 01/09/2026 sur les 1107 RDV de juin). Elle compare ensuite le nombre rapatrie
  // au `count` exact et LEVE en cas d'ecart : la limite de PostgREST tronque sans
  // erreur. Un total faux affiche comme un total juste serait exactement le
  // defaut que ce produit remplace.
  const rdvs = await toutesLesLignes<{
    vendeur_id: number;
    type_vehicule: string;
    marque_id: number | null;
    jour: string;
    creneau_code: string;
  }>((de, a) =>
    supabase
      .from('rdv_agrege')
      .select('vendeur_id, type_vehicule, marque_id, jour, creneau_code', { count: 'exact' })
      .eq('campagne_id', id)
      .is('archive_le', null)
      .range(de, a),
    'id'
  );

  return {
    campagne: {
      id: txt(c.id),
      libelle: c.libelle,
      dateDebut: c.date_debut,
      dateFin: c.date_fin,
      cloturee: c.cloturee,
    },
    jours: verifier(jours).map((j) => j.jour as string),
    sessions: (verifier(sessions) as unknown as LigneSession[])
      .slice()
      .sort((a, b) => (a.plaque?.ordre ?? 0) - (b.plaque?.ordre ?? 0))
      .map((s) => ({
        id: txt(s.id),
        plaqueId: txt(s.plaque?.id),
        plaqueLibelle: s.plaque?.libelle ?? '',
        mode: s.mode,
        effectifCibleTable: s.effectif_cible_table,
      })),
    vendeurs: lignesVendeur,
    rdvs: rdvs.map((r) => ({
      vendeurId: txt(r.vendeur_id),
      typeVehicule: r.type_vehicule as LigneRdv['typeVehicule'],
      marqueId: txtOuNull(r.marque_id),
      jour: r.jour,
      creneauCode: r.creneau_code,
    })),
    rattachements: { siteVersPlaque, tableVersPlaque },
  };
}

export async function chargerDashboard(campagneId: string): Promise<Dashboard> {
  const charge = await chargerCampagne(campagneId);
  const { vendeurs, rdvs } = charge;

  const totaux = Object.fromEntries(
    AXES.map((axe) => [axe, totauxPar(axe, rdvs, vendeurs)])
  ) as Record<Axe, Totaux[]>;

  return {
    campagne: { ...charge.campagne, jours: charge.jours },
    sessions: charge.sessions,
    rattachements: charge.rattachements,
    totaux,
    // Les trois classements de l'onglet RANK. Le departage des ex aequo est
    // documente et deterministe dans `agregats.ts` — jamais l'astuce Excel
    // `valeur - ROW()/1000000`.
    classementsSites: {
      global: classer(totaux.site, 'global'),
      vn: classer(totaux.site, 'vn'),
      vo: classer(totaux.site, 'vo'),
    },
    classementVendeurs: classer(totaux.vendeur, 'global'),
    classementTables: classer(totaux.table, 'global'),
    parJour: totauxParJour(rdvs, charge.jours, vendeurs),
  };
}

/// F-D.5. Remplace le « mars : 351 » ecrit a la main dans l'onglet SUIVI.
///
/// L'EFFECTIF EST RECALCULE POUR CHAQUE CAMPAGNE avec ses propres bornes : un
/// vendeur present en juin et parti depuis compte dans juin et pas dans septembre.
/// C'est tout l'objet de `etaitPresent`, et c'est pour cela que les deux campagnes
/// sont chargees separement plutot que filtrees a partir d'un seul jeu.
export async function chargerComparaison(
  campagneId: string,
  autreId: string,
  axe: Axe = 'site'
): Promise<Comparaison> {
  const [courant, anterieur] = await Promise.all([
    chargerCampagne(campagneId),
    chargerCampagne(autreId),
  ]);

  return {
    axe,
    courante: { id: courant.campagne.id, libelle: courant.campagne.libelle },
    anterieure: { id: anterieur.campagne.id, libelle: anterieur.campagne.libelle },
    ecarts: comparer(
      totauxPar(axe, courant.rdvs, courant.vendeurs),
      totauxPar(axe, anterieur.rdvs, anterieur.vendeurs)
    ),
  };
}
