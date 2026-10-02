import { ErreurApi, supabase, txt, txtOuNull, verifier } from './supabase';
import {
  AXES,
  classer,
  comparer,
  duPhoning,
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
    /// Ajoute le 08/09/2026 pour les filtres du classement. Sans lui, une ligne
    /// de l'axe « Vendeurs » ne porte que sa cle et son libelle : impossible de
    /// savoir de quel site elle releve, donc impossible de la filtrer.
    ///
    /// Ce rattachement N'EST PAS derive du libelle ni devine : il vient de la
    /// meme jointure `site.plaque_id` que le reste. Le rattachement d'un site a
    /// une plaque est modifiable, c'est un piege herite du fichier source.
    vendeurVersSite: Record<string, string>;
  };
  totaux: Record<Axe, Totaux[]>;
  /// Les classements, pour CHAQUE axe et CHAQUE critere.
  ///
  /// Il y en avait trois, de trois formes differentes : `classementsSites`
  /// ventile en general/VN/VO, `classementVendeurs` et `classementTables` en
  /// general seulement. Consequence : « le classement des vendeurs sur le VO »
  /// etait inexprimable, alors que `classer` sait le faire depuis toujours — et
  /// l'ecran devait porter un `if` par axe pour aller chercher le bon champ.
  ///
  /// Une seule forme, donc, et l'ecran n'a plus qu'a indexer. `classer` reste la
  /// source unique du departage des ex aequo.
  classements: Record<Axe, { global: Rang[]; vn: Rang[]; vo: Rang[] }>;

  /// LE TOTAL PAR JOUR DE LA CAMPAGNE ENTIERE. L'ecran le RECALCULE des qu'un
  /// filtre est actif — voir `vendeurs` et `rdvs` juste en dessous.
  parJour: TotalJour[];

  /// LE JEU BRUT, pour que l'ecran puisse recalculer un agregat sur un
  /// sous-ensemble sans second aller-retour.
  ///
  /// POURQUOI L'EXPOSER. Le graphique « par jour » ne suivait NI les filtres
  /// plaque/site NI le critere VN/VO : il affichait un agregat calcule une fois
  /// pour toute la campagne. Or `totauxParJour` est une fonction PURE qui prend
  /// la liste des vendeurs a considerer — il suffisait de la rejouer avec le
  /// sous-ensemble. Ces deux tableaux sont DEJA rapatries pour calculer les
  /// totaux ; les rendre ne coute aucune requete, seulement de les garder en
  /// memoire (~1 050 RDV et ~96 vendeurs sur septembre 2026).
  ///
  /// L'alternative aurait ete de recoder le comptage par jour dans l'ecran :
  /// une seconde implementation de la meme regle, donc deux verites a
  /// redemontrer. C'est exactement ce que l'interdit n.6 proscrit.
  vendeurs: LigneVendeur[];
  rdvs: LigneRdvTableau[];
}

/// Une ligne de `rdv_agrege` telle que la garde le tableau : la forme des
/// fonctions pures, plus l identifiant, sans lequel un archivage ou un evenement
/// rejoue ne pourrait pas etre applique en memoire.
export type LigneRdvTableau = LigneRdv & { id: string };

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
  rdvs: LigneRdvTableau[];
  rattachements: Dashboard['rattachements'];
}

/// Rapatrie tout ce qu'il faut pour une campagne, et RIEN de plus.
async function chargerCampagne(campagneId: string): Promise<Charge> {
  const id = Number(campagneId);

  // UN SEUL APPEL — lot 1 de PLAN-GRID-V2.md (03/10/2026). Il en fallait six, plus
  // la lecture paginee de `rdv_agrege`. `charger_tableau` est SECURITY INVOKER et
  // rend les MEMES formes que ces lectures : le code ci-dessous n'a change que de
  // source. LE RATTACHEMENT PLAQUE vient toujours d'une jointure sur
  // `site.plaque_id`, faite en base, jamais d'une derivation.
  const brut = verifier(await supabase.rpc('charger_tableau', { p_campagne_id: id })) as unknown as {
    campagne: unknown;
    jours: string[];
    sessions: unknown[];
    vendeurs: unknown[];
    affectations: unknown[];
    rdvs: { id: number; vendeur_id: number; type_vehicule: string; marque_id: number | null; jour: string; creneau_code: string; source?: string }[];
    nb_rdvs: number;
  };
  if (!brut.campagne) throw new ErreurApi('Campagne introuvable.', 404);
  const campagne = { data: brut.campagne, error: null };
  const jours = { data: brut.jours.map((jour) => ({ jour })), error: null };
  const sessions = { data: brut.sessions, error: null };
  const vendeurs = { data: brut.vendeurs, error: null };
  const affectations = { data: brut.affectations, error: null };

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
  const vendeurVersSite: Record<string, string> = {};
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
    if (v.site) vendeurVersSite[txt(v.id)] = txt(v.site.id);
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

  // LA LECTURE ORDONNEE ET VERIFIEE. Jusqu'au 03/10/2026 elle etait paginee par
  // `toutesLesLignes`, ordonnee sur `id` — sans ordre, deux pages se recouvraient
  // et les totaux etaient faux avec le bon nombre de lignes (constate le
  // 01/09/2026 sur les 1107 RDV de juin). `charger_tableau` ordonne en base.
  //
  // Le jsonb d'une fonction n'est pas tronque par la limite de lignes de
  // PostgREST, mais le controle de volume reste : il ne coute rien, et un total
  // faux affiche comme juste est le defaut que ce produit remplace.
  const rdvs = brut.rdvs;
  if (rdvs.length !== Number(brut.nb_rdvs)) {
    throw new ErreurApi(
      `Lecture incomplete : ${rdvs.length} RDV recuperes sur ${brut.nb_rdvs} annonces. ` +
        'Les totaux seraient faux — aucun chiffre ne sera affiche.',
      500
    );
  }

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
    // LE PHONING SEULEMENT : le trafic naturel n'entre dans aucun total ni
    // classement de la seance (D5). Le controle de volume ci-dessus porte sur
    // TOUT ce que la base a rendu ; le filtre vient apres, et c'est `duPhoning`,
    // source unique, qui le fait.
    rdvs: duPhoning(rdvs).map((r) => ({
      id: txt(r.id),
      vendeurId: txt(r.vendeur_id),
      typeVehicule: r.type_vehicule as LigneRdv['typeVehicule'],
      marqueId: txtOuNull(r.marque_id),
      jour: r.jour,
      creneauCode: r.creneau_code,
    })),
    rattachements: { siteVersPlaque, tableVersPlaque, vendeurVersSite },
  };
}

export async function chargerDashboard(campagneId: string): Promise<Dashboard> {
  return assembler(await chargerCampagne(campagneId));
}

/// Un RDV pose, modifie ou archive ailleurs, tel que le diffuse `diffuser_rdv()`.
/// La charge utile porte TOUS les champs de `rdv_agrege` — et jamais le client.
export interface EvenementRdv {
  id?: string;
  vendeurId?: string;
  jour?: string;
  creneauCode?: string;
  marqueId?: string | null;
  typeVehicule?: string;
  source?: string;
  archive?: boolean;
}

/// APPLIQUE UN EVENEMENT EN MEMOIRE — lot 1 de PLAN-GRID-V2.md (03/10/2026).
///
/// C'est LA mesure qui fait tenir une seance. Chaque poste rechargeait la vue
/// d'ensemble (7 requetes, plus de 1 000 lignes) a chaque RDV du groupe, regroupe
/// par fenetres de 30 s : ~17 000 requetes/heure pour 25 postes. Or le message
/// temps reel contient deja tout ce que la vue d'ensemble compte. On met donc a
/// jour la liste des RDV, et on REJOUE LES MEMES FONCTIONS PURES (`assembler`) :
/// aucun comptage n'est recode ici, interdit n.6 — `test:agregats` couvre ce
/// chemin comme l'autre.
///
/// Rend `null` quand l'evenement ne peut pas etre applique sans risque — charge
/// incomplete, vendeur inconnu de ce chargement (cree depuis) — : l'appelant
/// recharge alors, comme avant. Un chiffre faux affiche comme juste serait pire
/// qu'une requete de plus.
export function appliquerRdv(d: Dashboard, e: EvenementRdv): Dashboard | null {
  if (!e.id || !e.vendeurId || !e.jour || !e.creneauCode || !e.typeVehicule) return null;
  // Un RDV de trafic naturel n'existe pas pour le phoning (D5) : rien a appliquer.
  if (duPhoning([e]).length === 0) return d;
  const autres = d.rdvs.filter((r) => r.id !== e.id);
  if (e.archive) {
    if (autres.length === d.rdvs.length) return d;
    return assembler({ ...chargeDe(d), rdvs: autres });
  }
  if (!d.vendeurs.some((v) => v.id === e.vendeurId)) return null;
  const ligne: LigneRdvTableau = {
    id: e.id,
    vendeurId: e.vendeurId,
    typeVehicule: e.typeVehicule as LigneRdv['typeVehicule'],
    marqueId: e.marqueId ?? null,
    jour: e.jour,
    creneauCode: e.creneauCode,
  };
  return assembler({ ...chargeDe(d), rdvs: [...autres, ligne] });
}

const chargeDe = (d: Dashboard): Charge => ({
  campagne: {
    id: d.campagne.id,
    libelle: d.campagne.libelle,
    dateDebut: d.campagne.dateDebut,
    dateFin: d.campagne.dateFin,
    cloturee: d.campagne.cloturee,
  },
  jours: d.campagne.jours,
  sessions: d.sessions,
  vendeurs: d.vendeurs,
  rdvs: d.rdvs,
  rattachements: d.rattachements,
});

function assembler(charge: Charge): Dashboard {
  const { vendeurs, rdvs } = charge;

  const totaux = Object.fromEntries(
    AXES.map((axe) => [axe, totauxPar(axe, rdvs, vendeurs)])
  ) as Record<Axe, Totaux[]>;

  return {
    campagne: { ...charge.campagne, jours: charge.jours },
    sessions: charge.sessions,
    rattachements: charge.rattachements,
    totaux,
    // Les classements de l'onglet RANK, pour les cinq axes et les trois
    // criteres. Le departage des ex aequo est documente et deterministe dans
    // `agregats.ts` — jamais l'astuce Excel `valeur - ROW()/1000000`.
    //
    // 15 appels a `classer` au lieu de 5 : sur 104 lignes au plus, c'est
    // gratuit, et ca supprime le `if` par axe que l'ecran portait.
    classements: Object.fromEntries(
      AXES.map((axe) => [
        axe,
        {
          global: classer(totaux[axe], 'global'),
          vn: classer(totaux[axe], 'vn'),
          vo: classer(totaux[axe], 'vo'),
        },
      ])
    ) as Dashboard['classements'],
    parJour: totauxParJour(rdvs, charge.jours, vendeurs),
    vendeurs,
    rdvs,
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
