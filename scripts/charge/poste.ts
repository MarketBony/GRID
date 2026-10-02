// ============================================================================
// UN POSTE VIRTUEL = un onglet GRID ouvert sur l'ecran de saisie.
//
// Ce fichier est bundle par esbuild AVEC le vrai code du front : `connexion`,
// `sessionCourante`, `chargerCampagnes`, `chargerSaisie`, `chargerDashboard`,
// `poserRdv`, `modifierRdv`, `archiverRdv` sont les fonctions de services/*, et
// `supabase` est le client de services/supabase.ts. Chaque worker_thread charge sa
// propre instance du module : son propre client, sa propre session, son propre
// canal Realtime.
//
// Ce qui est REPRODUIT (parce que c'est du React, inexecutable hors navigateur) :
//   - pages/Saisie.tsx : l'enchainement du chargement, `rechargerVueDEnsemble`
//     (appelee apres chaque ecriture de l'auteur), les deux rechargements
//     regroupes declenches par le temps reel ;
//   - hooks/useRechargementCoalesce.ts : la formule fenetre + gigue (<= fenetre/2).
//     Les FENETRES sont IMPORTEES du hook : si on les change, l'outil suit ;
//   - hooks/useTempsReel.ts : setAuth, utilisateur_courant, canal prive
//     `campagne-<id>`, evenement broadcast `rdv` ;
//   - contexts/SessionContext.tsx : sessionCourante() a la connexion (deux fois :
//     l'appel explicite de connexion() ET le rechargement declenche par
//     l'evenement SIGNED_IN). Plus a TOKEN_REFRESHED depuis le lot 1.
//
// VERSION « LOT 1 » (03/10/2026) — le comportement de pages/Saisie.tsx apres le
// lot 1 de PLAN-GRID-V2.md : la vue d'ensemble s'applique EN MEMOIRE
// (`appliquerRdv`), plus de rechargement apres sa propre ecriture ni apres un
// echec, pose en un appel idempotent (`rdv_poser`), resynchronisation toutes les
// ~5 min. La version d'origine, utilisee pour la mesure de depart, est celle de
// `master` au 02/10/2026.
// ============================================================================
import { connexion, sessionCourante } from '../../services/api';
import { supabase } from '../../services/supabase';
import { chargerCampagnes } from '../../services/campagnes';
import {
  archiverRdv,
  chargerSaisie,
  modifierRdv,
  nouvelleCle,
  poserRdv,
  type PerimetreSaisie,
} from '../../services/saisie';
import { appliquerRdv, chargerDashboard, type Dashboard, type EvenementRdv } from '../../services/dashboard';
import { FENETRE_PERIMETRE, FENETRE_VUE_ENSEMBLE } from '../../hooks/useRechargementCoalesce';

type Emit = (e: Record<string, unknown>) => void;

interface Config {
  id: number;
  login: string;
  motDePasse: string;
  emit: Emit;
}

const alea = <T,>(l: T[]): T => l[Math.floor(Math.random() * l.length)]!;
const exponentielle = (moyenneMs: number) => -Math.log(1 - Math.random()) * moyenneMs;
const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function creerPoste(cfg: Config) {
  const { emit } = cfg;
  const poste = cfg.id;

  /// Mesure une operation de haut niveau (un appel de service du front).
  async function op<T>(nom: string, fn: () => Promise<T>): Promise<T> {
    const t0 = Date.now();
    try {
      const r = await fn();
      emit({ k: 'op', poste, nom, t0, ms: Date.now() - t0, ok: true });
      return r;
    } catch (e) {
      emit({
        k: 'op',
        poste,
        nom,
        t0,
        ms: Date.now() - t0,
        ok: false,
        erreur: String((e as Error)?.message ?? e).slice(0, 120),
      });
      throw e;
    }
  }

  // ------------------------------------------------------------ etat de l'ecran
  let donnees: PerimetreSaisie | null = null;
  let tableau: Dashboard | null = null;
  let campagneId: string | null = null;
  let actif = false;
  let canal: ReturnType<typeof supabase.channel> | null = null;
  const minuteurs = new Set<ReturnType<typeof setTimeout>>();
  const mesRdvIds = new Set<string>();
  const mesRdvArchivables: string[] = [];
  let ecrituresEnCours = 0;
  let params: Record<string, any> = {};
  let ecoute = false;

  // Auth : ce que fait SessionContext.
  supabase.auth.onAuthStateChange((evt) => {
    if (evt === 'SIGNED_IN') {
      void op('sessionCourante(evt ' + evt + ')', () => sessionCourante()).catch(() => undefined);
    }
  });

  const rechargerPerimetre = async (id: string) => {
    donnees = await op('chargerSaisie', () => chargerSaisie(id));
  };
  // Saisie.tsx : `chargerDashboard(id).then(setDashboard).catch(() => setDashboard(null))`
  const rechargerVueDEnsemble = (id: string) => {
    op('chargerDashboard', () => chargerDashboard(id))
      .then((d) => {
        tableau = d;
      })
      .catch(() => undefined);
  };

  // useRechargementCoalesce : si un minuteur est arme, l'evenement est absorbe.
  function coalesce(action: () => void, fenetreMs: number) {
    let m: ReturnType<typeof setTimeout> | null = null;
    return () => {
      if (m !== null) return;
      const gigue = Math.random() * fenetreMs * 0.5;
      m = setTimeout(() => {
        m = null;
        if (actif) action();
      }, fenetreMs + gigue);
      minuteurs.add(m);
    };
  }
  const majPerimetre = coalesce(() => {
    if (campagneId) void rechargerPerimetre(campagneId).catch(() => undefined);
  }, FENETRE_PERIMETRE);
  const majVueDEnsemble = coalesce(() => {
    if (campagneId) rechargerVueDEnsemble(campagneId);
  }, FENETRE_VUE_ENSEMBLE);

  /// Le filtre de Saisie.tsx : `!concerne || donnees.vendeurs.some(v => v.id === concerne)`.
  /// Si `perimetrePoste > 0` (et poste non administrateur), on EMULE un perimetre de table :
  /// seuls les vendeurs de mon sous-ensemble me concernent. Sinon, filtre reel du front.
  const concerne = (vendeurId?: string) => {
    if (!vendeurId) return true;
    if (params.perimetrePoste > 0 && !params.grosCompte) return params.sousEnsemble.includes(vendeurId);
    return (donnees?.vendeurs ?? []).some((v) => v.id === vendeurId);
  };

  async function abonner(id: string) {
    const t0 = Date.now();
    const { data } = await supabase.auth.getSession();
    const jeton = data.session?.access_token;
    if (!jeton) {
      emit({ k: 'sub', poste, etat: 'SANS_JETON' });
      return;
    }
    await supabase.realtime.setAuth(jeton);
    await supabase.rpc('utilisateur_courant'); // useTempsReel lit `moi` pour l'echo
    await new Promise<void>((resolve) => {
      let fini = false;
      const clore = () => {
        if (!fini) {
          fini = true;
          resolve();
        }
      };
      canal = supabase
        .channel(`campagne-${id}`, { config: { private: true } })
        .on('broadcast', { event: 'tables' }, () => {
          majPerimetre();
          majVueDEnsemble();
        })
        .on('broadcast', { event: 'rdv' }, (message) => {
          const tRecv = Date.now();
          const charge = (message.payload ?? {}) as { id?: string; vendeurId?: string };
          emit({ k: 'rt', poste, id: charge.id, tRecv });
          // Echo local : ici les postes partagent 3 comptes, donc comparer `auteur` a MON
          // compte jetterait les evenements des autres postes du meme compte. On compare
          // aux RDV que CE poste a ecrits, avec un delai pour les ecritures en vol.
          setTimeout(
            () => {
              if (!actif) return;
              if (charge.id && mesRdvIds.has(charge.id)) return;
              // Lot 1 : la vue d'ensemble s'applique en memoire.
              const suivant = tableau ? appliquerRdv(tableau, charge as EvenementRdv) : null;
              if (suivant) tableau = suivant;
              else majVueDEnsemble();
              if (concerne(charge.vendeurId)) majPerimetre();
            },
            ecrituresEnCours > 0 ? 1500 : 300
          );
        })
        .subscribe((etat, erreur) => {
          emit({ k: 'sub', poste, etat, t0: Date.now(), ms: Date.now() - t0, erreur: erreur?.message });
          if (etat === 'SUBSCRIBED' || etat === 'CHANNEL_ERROR' || etat === 'TIMED_OUT' || etat === 'CLOSED') clore();
        });
      setTimeout(clore, 20_000);
    });
  }

  // -------------------------------------------------------- boucle de saisie
  function planifierPose() {
    if (!actif || !params.moyenneMs) return;
    const m = setTimeout(async () => {
      minuteurs.delete(m);
      if (!actif) return;
      try {
        await ecrire();
      } finally {
        planifierPose();
      }
    }, exponentielle(params.moyenneMs));
    minuteurs.add(m);
  }

  async function ecrire() {
    if (!donnees || !campagneId) return;
    const tirage = Math.random();
    ecrituresEnCours++;
    try {
      if (tirage < params.pArchive && mesRdvArchivables.length > 0) {
        const id = mesRdvArchivables.splice(Math.floor(Math.random() * mesRdvArchivables.length), 1)[0]!;
        const tSend = Date.now();
        emit({ k: 'ecrit', poste, id, tSend, genre: 'archive' });
        await op('archiverRdv', () => archiverRdv(id));
        emit({ k: 'ack', poste, id, tAck: Date.now() });
        // Lot 1 : plus de rechargement, l'archivage s'applique en memoire.
      } else if (tirage < params.pArchive + params.pModif && mesRdvArchivables.length > 0) {
        const id = alea(mesRdvArchivables);
        const tSend = Date.now();
        emit({ k: 'ecrit', poste, id, tSend, genre: 'modif' });
        await op('modifierRdv', () => modifierRdv(id, 'TEST CHARGE ' + Math.random().toString(36).slice(2, 8)));
        emit({ k: 'ack', poste, id, tAck: Date.now() });
        // modifier() ne recharge rien
      } else {
        const candidats = donnees.vendeurs.filter((v) => params.sousEnsemble.includes(v.id) && v.sections.length > 0);
        if (candidats.length === 0) return;
        const v = alea(candidats);
        const section = alea(v.sections);
        const jour = alea(donnees.campagne.jours).jour;
        const creneau = alea(donnees.campagne.creneaux).code;
        const tSend = Date.now();
        const { rdv } = await op('poserRdv', () =>
          poserRdv({
            campagneId: campagneId!,
            vendeurId: v.id,
            typeVehicule: v.typeVehicule,
            cle: nouvelleCle(),
            jour,
            creneauCode: creneau,
            marqueId: section.marqueId,
            client: 'TEST CHARGE ' + Math.random().toString(36).slice(2, 8),
          })
        );
        mesRdvIds.add(rdv.id);
        mesRdvArchivables.push(rdv.id);
        emit({ k: 'ecrit', poste, id: rdv.id, tSend, genre: 'pose' });
        emit({ k: 'ack', poste, id: rdv.id, tAck: Date.now() });
        // Lot 1 : sa propre pose s'applique en memoire, sans rechargement.
        if (tableau) tableau = appliquerRdv(tableau, { ...rdv, archive: false }) ?? tableau;
      }
    } catch {
      // Lot 1 : plus de relecture sur echec (la file d'attente rejoue la pose).
    } finally {
      ecrituresEnCours--;
    }
  }

  // ------------------------------------------------------------ commandes
  async function commande(m: any) {
    switch (m.cmd) {
      case 'login': {
        const t0 = Date.now();
        try {
          await op('connexion', () => connexion(cfg.login, cfg.motDePasse));
          return { ok: true, ms: Date.now() - t0 };
        } catch (e: any) {
          const c = e?.corps;
          return {
            ok: false,
            ms: Date.now() - t0,
            statut: c?.status ?? null,
            code: c?.code ?? null,
            message: c?.message ?? String(e?.message),
            messageFront: String(e?.message),
          };
        }
      }
      case 'ouvrir': {
        params = m.params;
        actif = true;
        mesRdvIds.clear();
        mesRdvArchivables.length = 0;
        const t0 = Date.now();
        // 1. SessionContext monte : rafraichir() -> sessionCourante()
        await op('sessionCourante(montage)', () => sessionCourante());
        // 2. Saisie monte : chargerCampagnes() puis choix de la campagne
        const cs = await op('chargerCampagnes', () => chargerCampagnes());
        const retenue =
          cs.find((c) => c.id === params.campagneId) ?? cs.find((c) => !c.cloturee && c.vendeursSaisissables > 0);
        if (!retenue) throw new Error('Campagne introuvable');
        campagneId = retenue.id;
        // 3. campagneId pose : les trois effets partent ensemble
        let tSaisie = 0;
        await Promise.all([
          rechargerPerimetre(campagneId).then(() => {
            tSaisie = Date.now() - t0;
          }),
          op('chargerDashboard', () => chargerDashboard(campagneId!))
            .then((d) => {
              tableau = d;
            })
            .catch(() => undefined),
          abonner(campagneId),
        ]);
        ecoute = true;
        // Lot 1 : resynchronisation de securite toutes les ~5 min, decalee par poste.
        const resync = setInterval(() => {
          if (!actif || !campagneId) return;
          void rechargerPerimetre(campagneId).catch(() => undefined);
          rechargerVueDEnsemble(campagneId);
        }, 5 * 60_000 + Math.random() * 60_000);
        minuteurs.add(resync as unknown as ReturnType<typeof setTimeout>);
        return {
          ms: Date.now() - t0,
          msSaisie: tSaisie,
          vendeurs: donnees?.vendeurs.length ?? 0,
          rdvs: donnees?.rdvs.length ?? 0,
        };
      }
      case 'saisir': {
        params = { ...params, ...m.params };
        planifierPose();
        return { ok: true };
      }
      case 'fermer': {
        actif = false;
        for (const t of minuteurs) {
          clearTimeout(t);
          clearInterval(t as unknown as ReturnType<typeof setInterval>);
        }
        minuteurs.clear();
        if (canal) {
          await supabase.removeChannel(canal).catch(() => undefined);
          canal = null;
        }
        await dormir(500);
        return { ok: true, ecoute };
      }
      default:
        throw new Error('commande inconnue ' + m.cmd);
    }
  }

  return { commande };
}
