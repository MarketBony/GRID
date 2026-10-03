import { useSonde } from '../../hooks/useSante';
import { part, RUPTURE_RTT, sonder, sonderDetail, tonDe, type Sonde, type Ton } from '../../services/sante';

// ============================================================================
// LA PASTILLE (tout le monde, dans l'Ile) et LA CONSOLE (administration, dans
// Reglages). Meme famille que la bande d'etat de l'app Forum 2026 : une ligne par
// mesure, une barre graduee en douze crans — un remplissage lisse se lit comme
// une barre de chargement, une rangee de crans se lit comme un instrument.
// ============================================================================

const LIBELLE: Record<Ton, string> = {
  ok: 'Base en forme',
  tiede: 'Base lente',
  chaud: 'Base très lente',
  coupe: 'Base injoignable',
};

/// UNE seule sonde legere par poste, toutes les 30 s, partagee par l'Ile et la
/// barre du bas : les deux sont montees ensemble, une seule est visible.
export const useSondeLegere = () => useSonde(sonder, 30_000);

export function PastilleSante({ mesure, erreur, compacte = false }: { mesure: Sonde | null; erreur: boolean; compacte?: boolean }) {
  const ton: Ton = erreur ? 'coupe' : mesure ? tonDe(part(mesure.rtt, RUPTURE_RTT)) : 'ok';
  const texte = erreur
    ? 'Base injoignable — les RDV saisis attendent dans la file et partiront au retour du réseau'
    : mesure
      ? `${LIBELLE[ton]} · réponse ${mesure.rtt} ms · ${mesure.rdv_10min} RDV ces 10 dernières minutes`
      : 'Mesure en cours…';
  return (
    <span className={`pastille-sante ${ton}${mesure || erreur ? '' : ' attente'}${compacte ? ' compacte' : ''}`} title={texte} role="status" aria-label={texte}>
      <i />
      {!compacte && mesure && !erreur && <span className="ms num">{mesure.rtt}</span>}
    </span>
  );
}

function Crans({ fraction, ton }: { fraction: number; ton: Ton }) {
  const N = 12;
  const pleins = Math.min(N, Math.max(fraction > 0 ? 1 : 0, Math.round(fraction * N)));
  return (
    <span className={`crans ${ton}`} aria-hidden="true">
      {Array.from({ length: N }, (_, i) => (
        <i key={i} className={i < pleins ? 'on' : ''} style={{ ['--k' as string]: i }} />
      ))}
    </span>
  );
}

function Mesure({ nom, valeur, fraction, ton, detail }: { nom: string; valeur: string; fraction: number; ton: Ton; detail: string }) {
  return (
    <div className={`mesure-sante ${ton}`} title={detail}>
      <span className="nom">{nom}</span>
      <Crans fraction={fraction} ton={ton} />
      <span className="valeur num">{valeur}</span>
    </div>
  );
}

const ilYA = (iso: string | null): string => {
  if (!iso) return 'jamais';
  const h = (Date.now() - new Date(iso).getTime()) / 3_600_000;
  if (h < 1) return `${Math.max(1, Math.round(h * 60))} min`;
  if (h < 48) return `${Math.round(h)} h`;
  return `${Math.round(h / 24)} j`;
};

/// La console de Reglages : sonde complete toutes les 10 s.
export function ConsoleSante() {
  const { mesure: h, erreur } = useSonde(sonderDetail, 10_000);

  if (!h) {
    return (
      <div className="card pad console-sante">
        <h3 className="card-titre">État de la base de données</h3>
        <p className="note">{erreur ? 'Base injoignable.' : 'Relevé en cours…'}</p>
      </div>
    );
  }

  const pRtt = part(h.rtt, RUPTURE_RTT);
  const pPool = part(h.pool, h.pool_max);
  const pVerrous = part(h.verrous, 5);
  const pBloq = part(h.bloquees, 3);
  const pTaille = part(h.taille_mo, h.taille_max_mo);
  // La mise en pause tombe a 7 jours sans activite : 5 jours, c'est deja tard.
  const joursSans = h.derniere_activite ? (Date.now() - new Date(h.derniere_activite).getTime()) / 86_400_000 : 7;
  const pPause = part(joursSans, 7);
  const zeroOuTon = (v: number, p: number): Ton => (v === 0 ? 'ok' : tonDe(Math.max(p, 0.6)));

  // LA SANTE GLOBALE est la PIRE des mesures, pas leur moyenne : une moyenne
  // noierait un blocage sous cinq voyants verts.
  const pire = Math.max(pRtt, pPool, pVerrous, pBloq, pTaille, pPause);
  const tonGlobal: Ton = erreur ? 'coupe' : tonDe(pire);
  const sante = erreur ? 0 : Math.round((1 - pire) * 100);
  const alerte = erreur
    ? 'Dernière sonde en échec : la base ne répond plus à ce poste.'
    : h.bloquees > 1
      ? 'Des transactions sont bloquées : la base n’est pas chargée, elle est coincée.'
      : h.pool >= h.pool_max - 2
        ? 'Le pool est presque plein : les postes suivants vont attendre.'
        : h.rtt >= 1200
          ? 'Réponse très lente : regarder le réseau du poste avant de soupçonner la base.'
          : pPause >= 0.7
            ? 'Aucune activité depuis plusieurs jours : Supabase met le projet en pause à 7 jours.'
            : pTaille >= 0.8
              ? 'La base approche du plafond de l’offre gratuite.'
              : null;

  return (
    <div className={`card pad console-sante ${tonGlobal}`}>
      <h3 className="card-titre">
        <span className={`pastille-sante ${tonGlobal}`}><i /></span>
        État de la base de données
        <span className="faint num heure">{h.heure}</span>
      </h3>
      <div className="mesures">
        <Mesure nom="Réponse" valeur={`${h.rtt} ms`} fraction={pRtt} ton={tonDe(pRtt)} detail="Aller-retour complet depuis ce poste, réseau compris." />
        <Mesure nom="Pool PostgREST" valeur={`${h.pool}/${h.pool_max}`} fraction={pPool} ton={tonDe(pPool)} detail={`Connexions en train de travailler, sur ${h.pool_max}. ${h.pool_ouvertes} ouvertes en réserve.`} />
        <Mesure nom="Verrous en attente" valeur={String(h.verrous)} fraction={pVerrous} ton={zeroOuTon(h.verrous, pVerrous)} detail="Requêtes qui attendent qu’une autre lâche un verrou. Doit rester à zéro." />
        <Mesure nom="Transactions bloquées" valeur={String(h.bloquees)} fraction={pBloq} ton={zeroOuTon(h.bloquees, pBloq)} detail="Transactions ouvertes qui n’avancent plus et tiennent leurs verrous." />
        <Mesure nom="Taille de la base" valeur={`${h.taille_mo} / ${h.taille_max_mo} Mo`} fraction={pTaille} ton={tonDe(pTaille)} detail="Plafond de l’offre gratuite de Supabase." />
        <Mesure nom="Dernière activité" valeur={ilYA(h.derniere_activite)} fraction={pPause} ton={tonDe(pPause)} detail="Supabase met le projet en pause après 7 jours sans activité." />
      </div>
      <div className={`global-sante ${tonGlobal}`}>
        <div className="ligne">
          <span>Santé globale</span>
          <b className="num">{sante}<i>%</i></b>
        </div>
        <div className="jauge-globale"><span style={{ transform: `scaleX(${sante / 100})` }} /></div>
        <div className="verdict">
          {tonGlobal === 'ok' ? 'Tout va bien' : tonGlobal === 'tiede' ? 'Sous tension — à surveiller' : tonGlobal === 'coupe' ? 'Injoignable' : 'Critique — agir maintenant'}
          {' · '}
          {h.rdv_min} RDV/min · {h.rdv_10min} en 10 min · {h.connexions_max} connexions max
        </div>
      </div>
      {alerte && <div className="bandeau-v2 avertissement">{alerte}</div>}
    </div>
  );
}
