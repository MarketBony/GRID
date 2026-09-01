import { supabase, txt, txtOuNull, verifier } from './supabase';
import { GRAINE, ecartCible, repartir, type TableCible, type VendeurAPlacer } from '../backend/src/utils/repartition';
import { trierPar } from '../backend/src/utils/tri';
import { etaitPresent } from '../backend/src/utils/presenceVendeur';
import type { TypeVehicule } from '../types';

// ============================================================================
// MODULE B — constructeur de tables.
//
// Les tables sont un SUPPLEMENT, pas le mode normal : deux plaques sur quatre
// n'avaient aucune table en juin 2026, et le perimetre par defaut est le site.
//
// LA REPARTITION GRAINE 42 TOURNE DANS LE NAVIGATEUR. `repartition.ts` est le
// MEME fichier qu'avant, avec ses 20 controles : F-B.5 exige que la repartition
// soit reproductible DONC contestable, et retranscrire l'algorithme en PL/pgSQL en
// aurait fait une seconde version. Le navigateur CALCULE, la fonction
// `session_appliquer_repartition` ECRIT — en une seule transaction, parce qu'une
// repartition a moitie appliquee est pire que pas de repartition du tout.
// ============================================================================

export interface VendeurTable {
  id: string;
  nom: string;
  typeVehicule: TypeVehicule;
  siteId: string;
  siteCode: string;
  siteLibelle: string;
  marqueIds: string[];
}

export interface TablePhoning {
  id: string;
  libelle: string;
  ordre: number;
  chefUtilisateurId: string | null;
  chefNom: string | null;
  marqueId: string | null;
  marqueLibelle: string | null;
  membres: VendeurTable[];
  effectif: number;
  ecartCible: number | null;
  posesAuto: number;
}

export interface PerimetreTables {
  session: {
    id: string;
    campagneId: string;
    campagneLibelle: string;
    cloturee: boolean;
    plaqueId: string;
    plaqueLibelle: string;
    mode: string;
    effectifCibleTable: number | null;
  };
  tables: TablePhoning[];
  reserve: VendeurTable[];
  marques: { id: string; code: string; libelle: string }[];
  chefsPossibles: {
    id: string;
    nom: string;
    loginId: string;
    encadrements: { role: string; siteCode: string }[];
    deLaPlaque: boolean;
    rolesGlobaux: string[];
  }[];
}

interface LigneVendeur {
  id: number;
  nom: string;
  type_vehicule: string;
  date_entree: string | null;
  date_sortie: string | null;
  site: { id: number; code: string; libelle: string; plaque_id: number } | null;
  vendeur_marque: { marque_id: number }[];
}

/// UN VENDEUR N'APPARTIENT PAS A UNE CAMPAGNE OU IL N'ETAIT PAS LA.
///
/// C'est la MEME regle que la vue `relance.perimetre_saisie`, et que le dashboard
/// (`etaitPresent`, deja importe la-bas). Cet ecran ne l'appliquait pas : il ne
/// filtrait que `archive_le`.
///
/// Consequence constatee le 01/09/2026, signalee par l'utilisateur : trois
/// vendeurs sortis fin juillet et fin aout figuraient encore dans les tables de la
/// session de SEPTEMBRE. L'ecran des tables et l'ecran de saisie ne disaient donc
/// pas la meme chose sur la meme campagne — celui de saisie, qui lit la vue, avait
/// raison.
///
/// Les affectations elles-memes restent en base : elles racontent une composition
/// qui a existe, et l'interdit n.1 ne les detruit pas. C'est l'APPARTENANCE A
/// CETTE CAMPAGNE qui est fausse, pas la ligne.
const estPresent = (v: LigneVendeur, campagne: { dateDebut: Date; dateFin: Date }): boolean =>
  etaitPresent(
    {
      dateEntree: v.date_entree ? new Date(v.date_entree) : null,
      dateSortie: v.date_sortie ? new Date(v.date_sortie) : null,
    },
    campagne
  );

const versVendeurTable = (v: LigneVendeur): VendeurTable => ({
  id: txt(v.id),
  nom: v.nom,
  typeVehicule: v.type_vehicule as TypeVehicule,
  siteId: txt(v.site?.id),
  siteCode: v.site?.code ?? '',
  siteLibelle: v.site?.libelle ?? '',
  marqueIds: (v.vendeur_marque ?? []).map((m) => txt(m.marque_id)),
});

// `date_entree` et `date_sortie` SONT NECESSAIRES ICI, meme si aucun ecran ne les
// affiche : elles decident si un vendeur appartient a CETTE campagne. Sans elles,
// l'ecran des tables composait avec des gens partis. Voir `estPresent` plus bas.
const SELECT_VENDEUR =
  'id, nom, type_vehicule, date_entree, date_sortie, ' +
  'site(id, code, libelle, plaque_id), vendeur_marque(marque_id)';

export async function chargerTables(sessionId: string): Promise<PerimetreTables> {
  const n = Number(sessionId);

  const session = verifier(
    await supabase
      .from('session_plaque')
      .select('id, mode, effectif_cible_table, campagne(id, libelle, cloturee, date_debut, date_fin), plaque(id, libelle)')
      .eq('id', n)
      .single()
  ) as unknown as {
    id: number;
    mode: string;
    effectif_cible_table: number | null;
    campagne: { id: number; libelle: string; cloturee: boolean; date_debut: string; date_fin: string } | null;
    plaque: { id: number; libelle: string } | null;
  };

  const plaqueId = session.plaque?.id ?? -1;

  // Les bornes de la campagne, une fois pour toutes. `campagne.date_debut` est un
  // `date` PostgreSQL rendu en `AAAA-MM-JJ` : `new Date` le lit en UTC a minuit,
  // ce qui convient — on compare des jours, jamais des instants.
  const bornes = {
    dateDebut: new Date(session.campagne?.date_debut ?? '1970-01-01'),
    dateFin: new Date(session.campagne?.date_fin ?? '2999-12-31'),
  };

  const [tables, vendeurs, marques, comptes] = await Promise.all([
    supabase
      .from('table_phoning')
      .select(
        'id, libelle, ordre, chef_utilisateur_id, marque_id, ' +
          'chef:utilisateur(nom), marque(libelle), ' +
          `affectation(origine, archive_le, vendeur(${SELECT_VENDEUR}))`
      )
      .eq('session_plaque_id', n)
      .is('archive_le', null)
      .order('ordre'),
    // Les vendeurs de LA PLAQUE. Le rattachement passe toujours par
    // `site.plaque_id` : ne jamais deriver la plaque autrement.
    supabase.from('vendeur').select(SELECT_VENDEUR).is('archive_le', null),
    supabase.from('marque').select('id, code, libelle').is('archive_le', null).order('ordre'),
    // LES CHEFS POSSIBLES, TOUS SITES CONFONDUS. Restreindre cette liste aux
    // encadrants de la plaque rendrait l'exercice inexprimable : cinq vendeurs de
    // cinq concessions, coaches par un chef venu d'une SIXIEME.
    supabase
      .from('utilisateur')
      .select('id, nom, login_id, role_global(role), encadrement_site(role, site(code, plaque_id))')
      .eq('actif', true)
      .is('archive_le', null)
      .order('nom'),
  ]);

  type LigneTable = {
    id: number;
    libelle: string;
    ordre: number;
    chef_utilisateur_id: number | null;
    marque_id: number | null;
    chef: { nom: string } | null;
    marque: { libelle: string } | null;
    affectation: { origine: string; archive_le: string | null; vendeur: LigneVendeur | null }[];
  };
  type LigneCompte = {
    id: number;
    nom: string;
    login_id: string;
    role_global: { role: string }[];
    encadrement_site: { role: string; site: { code: string; plaque_id: number } | null }[];
  };

  const lignesTables = verifier(tables) as unknown as LigneTable[];
  const tousVendeurs = (verifier(vendeurs) as unknown as LigneVendeur[]).filter(
    (v) => v.site?.plaque_id === plaqueId && estPresent(v, bornes)
  );

  const affectes = new Set<string>();
  const projetees: TablePhoning[] = lignesTables.map((t) => {
    // On ecarte aussi les membres ABSENTS de la campagne. Le cas arrive quand une
    // date de sortie est renseignee APRES la composition des tables : l'affectation
    // etait juste au moment ou elle a ete posee, elle ne l'est plus.
    const actives = (t.affectation ?? []).filter(
      (a) => !a.archive_le && a.vendeur && estPresent(a.vendeur, bornes)
    );
    const membres = trierPar(
      actives.map((a) => versVendeurTable(a.vendeur!)),
      (m) => m.nom
    );
    for (const m of membres) affectes.add(m.id);
    return {
      id: txt(t.id),
      libelle: t.libelle,
      ordre: t.ordre,
      chefUtilisateurId: txtOuNull(t.chef_utilisateur_id),
      chefNom: t.chef?.nom ?? null,
      marqueId: txtOuNull(t.marque_id),
      marqueLibelle: t.marque?.libelle ?? null,
      membres,
      effectif: membres.length,
      // F-B.6. `null` quand aucune cible n'est definie : pas de cible, pas
      // d'alerte — et surtout pas une alerte a zero.
      ecartCible: ecartCible(membres.length, session.effectif_cible_table),
      posesAuto: actives.filter((a) => a.origine === 'auto').length,
    };
  });

  return {
    session: {
      id: txt(session.id),
      campagneId: txt(session.campagne?.id),
      campagneLibelle: session.campagne?.libelle ?? '',
      cloturee: session.campagne?.cloturee ?? false,
      plaqueId: txt(session.plaque?.id),
      plaqueLibelle: session.plaque?.libelle ?? '',
      mode: session.mode,
      effectifCibleTable: session.effectif_cible_table,
    },
    tables: projetees,
    // LA RESERVE N'EST PAS UN RELIQUAT : F-B.8 dit qu'un vendeur non affecte reste
    // saisissable par son chef de site.
    reserve: trierPar(
      tousVendeurs.filter((v) => !affectes.has(txt(v.id))).map(versVendeurTable),
      (v) => v.nom
    ),
    marques: verifier(marques).map((m) => ({
      id: txt(m.id),
      code: m.code,
      libelle: m.libelle,
    })),
    chefsPossibles: (verifier(comptes) as unknown as LigneCompte[]).map((c) => ({
      id: txt(c.id),
      nom: c.nom,
      loginId: c.login_id,
      encadrements: (c.encadrement_site ?? [])
        .filter((e) => e.site)
        .map((e) => ({ role: e.role, siteCode: e.site!.code })),
      // Ordre d'affichage seulement, JAMAIS un refus.
      deLaPlaque: (c.encadrement_site ?? []).some((e) => e.site?.plaque_id === plaqueId),
      rolesGlobaux: (c.role_global ?? []).map((r) => r.role),
    })),
  };
}

export async function creerTable(sessionId: string, libelle: string, marqueId?: string | null) {
  // REACTIVATION PLUTOT QUE RECREATION : un libelle deja porte par une table
  // archivee se recupere en la desarchivant. L'historique reste sur une seule
  // ligne au lieu d'etre scinde entre deux.
  const existante = verifier(
    await supabase
      .from('table_phoning')
      .select('id')
      .eq('session_plaque_id', Number(sessionId))
      .eq('libelle', libelle)
      .maybeSingle()
  ) as { id: number } | null;

  const ordre = (verifier(
    await supabase
      .from('table_phoning')
      .select('ordre')
      .eq('session_plaque_id', Number(sessionId))
      .order('ordre', { ascending: false })
      .limit(1)
  ) as { ordre: number }[])[0]?.ordre;

  if (existante) {
    const r = verifier(
      await supabase
        .from('table_phoning')
        .update({ archive_le: null, marque_id: marqueId ? Number(marqueId) : null })
        .eq('id', existante.id)
        .select('id, libelle, ordre, marque_id')
        .single()
    ) as { id: number; libelle: string; ordre: number; marque_id: number | null };
    return { id: txt(r.id), libelle: r.libelle, ordre: r.ordre, marqueId: txtOuNull(r.marque_id), reactivee: true };
  }

  const r = verifier(
    await supabase
      .from('table_phoning')
      .insert({
        session_plaque_id: Number(sessionId),
        libelle,
        // 1..n, jamais 0 partout : la repartition departage les tables a charge
        // egale par le plus petit `ordre`, et des zeros rendraient le departage
        // non deterministe — ce que la graine 42 est censee empecher.
        ordre: (ordre ?? 0) + 1,
        marque_id: marqueId ? Number(marqueId) : null,
      })
      .select('id, libelle, ordre, marque_id')
      .single()
  ) as { id: number; libelle: string; ordre: number; marque_id: number | null };

  return { id: txt(r.id), libelle: r.libelle, ordre: r.ordre, marqueId: txtOuNull(r.marque_id), reactivee: false };
}

export async function modifierTable(
  tableId: string,
  champs: { libelle?: string; chefUtilisateurId?: string | null; marqueId?: string | null; ordre?: number }
) {
  const maj: Record<string, unknown> = {};
  if (champs.libelle !== undefined) maj.libelle = champs.libelle;
  if (champs.chefUtilisateurId !== undefined) {
    maj.chef_utilisateur_id = champs.chefUtilisateurId ? Number(champs.chefUtilisateurId) : null;
  }
  if (champs.marqueId !== undefined) maj.marque_id = champs.marqueId ? Number(champs.marqueId) : null;
  if (champs.ordre !== undefined) maj.ordre = champs.ordre;

  verifier(
    await supabase.from('table_phoning').update(maj).eq('id', Number(tableId)).select('id').single()
  );
  // L'ecran relit la session entiere ensuite : renvoyer une table partielle
  // l'obligerait a recomposer effectif, ecart et poses automatiques a la main.
  return { id: tableId } as unknown as TablePhoning;
}

/// F-B.1 dit « supprimer ». INTERDIT N.1 : on ARCHIVE. La fonction archive la
/// table ET ses affectations dans le meme geste — separees, elles laisseraient des
/// affectations actives pointant une table archivee.
export async function archiverTable(tableId: string) {
  const reponse = await supabase.rpc('table_archiver', { p_table_id: Number(tableId) });
  return verifier(reponse) as unknown as {
    archivee: string;
    affectationsArchivees: number;
    message: string;
  };
}

/// F-B.3. Remplace la composition EN UNE FOIS. Un vendeur retire revient en
/// reserve et reste saisissable par son chef de site.
export async function definirMembres(tableId: string, vendeurIds: string[]) {
  const reponse = await supabase.rpc('table_definir_vendeurs', {
    p_table_id: Number(tableId),
    p_vendeur_ids: vendeurIds.map(Number),
  });
  return verifier(reponse) as unknown as { retires: number; effectif: number };
}

export interface ResultatRepartition {
  graine: number;
  remplacer: boolean;
  placements: { tableId: string; libelle: string; vendeurIdsAjoutes: string[]; effectif: number }[];
  nonPlaces: { vendeurId: string; nom: string; raison: string }[];
  dejaEnPlace: number;
  message: string;
}

/// F-B.5, graine 42. `remplacer` REFAIT la composition entiere : c'est derriere un
/// drapeau explicite parce que cela archive un travail manuel.
export async function repartirAuto(
  sessionId: string,
  remplacer: boolean
): Promise<ResultatRepartition> {
  const perimetre = await chargerTables(sessionId);

  const projeter = (v: VendeurTable): VendeurAPlacer => ({
    id: v.id,
    nom: v.nom,
    marqueIds: v.marqueIds,
    typeVehicule: v.typeVehicule,
  });

  const cibles: TableCible[] = perimetre.tables.map((t) => ({
    id: t.id,
    libelle: t.libelle,
    ordre: t.ordre,
    // SPECIALISATION DECLAREE, jamais deduite des membres presents : une version
    // deduite laissait le premier vendeur tire au sort fixer la marque de la table
    // pour toujours, et la repartition rendait 11/8/10 au lieu de 10/10/9.
    marqueId: t.marqueId,
    membres: remplacer ? [] : t.membres.map(projeter),
  }));

  const dejaEnPlace = perimetre.tables.reduce((n, t) => n + t.membres.length, 0);
  const aPlacer = (remplacer
    ? [...perimetre.reserve, ...perimetre.tables.flatMap((t) => t.membres)]
    : perimetre.reserve
  ).map(projeter);

  const resultat = repartir(aPlacer, cibles);

  verifier(
    await supabase.rpc('session_appliquer_repartition', {
      p_session_id: Number(sessionId),
      p_placements: resultat.placements.map((p) => ({
        tableId: p.tableId,
        vendeurIdsAjoutes: p.vendeurIdsAjoutes,
      })),
      p_remplacer: remplacer,
    })
  );

  return {
    graine: GRAINE,
    remplacer,
    placements: resultat.placements,
    nonPlaces: resultat.nonPlaces,
    dejaEnPlace: remplacer ? 0 : dejaEnPlace,
    message:
      'Graine 42 : relancer cette repartition sur les memes donnees redonnera ' +
      'exactement la meme composition.' +
      (resultat.nonPlaces.length > 0
        ? ` ${resultat.nonPlaces.length} vendeur(s) restent en reserve — ils demeurent ` +
          'saisissables par leur chef de site.'
        : ''),
  };
}

export interface ResultatReprise {
  depuis: string;
  tablesCreees: number;
  tablesReprises: number;
  affectationsReprises: number;
  reportes: { nom: string; raison: string }[];
  message: string;
}

/// F-B.7. Ce qui ne peut pas suivre est REPORTE, jamais force : un vendeur parti
/// depuis, ou passe dans une autre plaque, est signale et laisse de cote.
export async function reprendreComposition(
  sessionId: string,
  depuisCampagneId: string
): Promise<ResultatReprise> {
  const reponse = await supabase.rpc('session_reprendre', {
    p_session_id: Number(sessionId),
    p_depuis_campagne_id: Number(depuisCampagneId),
  });
  const r = verifier(reponse) as unknown as {
    tablesCreees: number;
    affectationsReprises: number;
    reportes: { nom: string; raison: string }[];
  };

  return {
    depuis: depuisCampagneId,
    tablesCreees: r.tablesCreees,
    tablesReprises: r.tablesCreees,
    affectationsReprises: r.affectationsReprises,
    reportes: r.reportes ?? [],
    message:
      `${r.affectationsReprises} affectation(s) reprises.` +
      (r.reportes?.length
        ? ` ${r.reportes.length} vendeur(s) n'ont pas pu suivre et restent en reserve.`
        : ''),
  };
}
