import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Segmente } from '../../components/Segmente';
import { Icone, type NomIcone } from '../../components/ui/Icone';
import { useCampagneCourante, choisirDansListe } from '../../contexts/CampagneContext';
import { useSession } from '../../contexts/SessionContext';
import { useTheme } from '../../contexts/ThemeContext';
import { chargerDonneesVp, chargerVps, type DonneesVp, type VpResume } from '../../services/vp';
import { Saisie } from '../Saisie';
import { isoLocal, jj, jjmmaaaa, jourLong } from './commun';

const Pilotage = lazy(() => import('./Pilotage').then((m) => ({ default: m.Pilotage })));
const JourJ = lazy(() => import('./JourJ').then((m) => ({ default: m.JourJ })));
const Accueil = lazy(() => import('./Accueil').then((m) => ({ default: m.Accueil })));
const Projection = lazy(() => import('./Projection').then((m) => ({ default: m.Projection })));
const Bilan = lazy(() => import('./Bilan').then((m) => ({ default: m.Bilan })));
const ImprimeVp = lazy(() => import('./ImprimeVp').then((m) => ({ default: m.ImprimeVp })));
const Parametrage = lazy(() => import('./Parametrage').then((m) => ({ default: m.Parametrage })));
const Suivi = lazy(() => import('../Suivi').then((m) => ({ default: m.Suivi })));

// ============================================================================
// GRID/VP — LA COQUILLE DE LA VENTE PRIVEE (20/10/2026, PLAN-GRID-VP.md).
//
// Un autre ESPACE que GRID classique, pas un ecran de plus : sa barre, ses
// onglets, sa VP courante (`FournisseurCampagne nature="vente_privee"`, monte par
// `App`). On y entre par le bouton discret de l'Ile, on en sort par « GRID ».
//
// LA SAISIE ET LE SUIVI SONT CEUX DE GRID CLASSIQUE, tels quels : ils lisent la
// nature de l'espace et ne listent que les VP. Le perimetre — les vendeurs du
// site — est tenu par la base (`perimetre_saisie`), pas par cet ecran.
//
// Les ecrans du jour J se RAFRAICHISSENT toutes les 20 s tant que l'onglet est
// visible : une dizaine de postes au plus, aucune mesure de charge a craindre.
// ============================================================================

type EcranVp = 'saisie' | 'pilotage' | 'jour' | 'accueil' | 'suivi' | 'projection' | 'bilan' | 'imprime' | 'parametrage';

const ECRANS: { id: EcranVp; libelle: string; icone: NomIcone; admin?: boolean }[] = [
  { id: 'saisie', libelle: 'Saisie', icone: 'saisie' },
  { id: 'pilotage', libelle: 'Phoning', icone: 'pilotage' },
  { id: 'jour', libelle: 'Jour J', icone: 'agenda' },
  { id: 'accueil', libelle: 'Accueil', icone: 'accueil' },
  { id: 'suivi', libelle: 'Suivi', icone: 'suivi' },
  { id: 'projection', libelle: 'Projection', icone: 'projection' },
  { id: 'bilan', libelle: 'Bilan', icone: 'tableau' },
  { id: 'imprime', libelle: 'Imprimé', icone: 'imprime' },
  { id: 'parametrage', libelle: 'Paramétrage', icone: 'reglages', admin: true },
];
/// Les ecrans qui lisent `DonneesVp` et se rafraichissent.
const VIVANTS = new Set<EcranVp>(['pilotage', 'jour', 'accueil', 'projection']);
const CLE_ECRAN = 'grid.vp.ecran';

const lireEcran = (): EcranVp => {
  try {
    const e = window.sessionStorage.getItem(CLE_ECRAN) as EcranVp | null;
    return e && ECRANS.some((x) => x.id === e) ? e : 'pilotage';
  } catch {
    return 'pilotage';
  }
};

const Attente = () => (
  <div className="page vp-page">
    <div className="skel" style={{ height: 40, width: 260 }} />
    <div className="skel" style={{ height: 220 }} />
  </div>
);

interface Props {
  retour: () => void;
  nomCompte: string;
  palier: string;
  deconnexion: () => void;
}

export function GridVp({ retour, nomCompte, palier, deconnexion }: Props) {
  const { session } = useSession();
  const gereVp = session?.droits.gereVp === true;
  const { campagneId, choisir } = useCampagneCourante();
  const { theme, basculer } = useTheme();

  const [vps, setVps] = useState<VpResume[] | null>(null);
  const [donnees, setDonnees] = useState<DonneesVp | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [ecranDemande, setEcran] = useState<EcranVp>(lireEcran);
  const [maintenant, setMaintenant] = useState(() => new Date());
  const [menuOuvert, setMenuOuvert] = useState(false);

  const ecrans = ECRANS.filter((e) => !e.admin || gereVp);
  const ecran: EcranVp = ecrans.some((e) => e.id === ecranDemande) ? ecranDemande : 'pilotage';
  const changerEcran = (e: EcranVp) => {
    setEcran(e);
    try {
      window.sessionStorage.setItem(CLE_ECRAN, e);
    } catch {
      // sans memoire, l'onglet vaut pour la session React
    }
  };

  const chargerListe = useCallback(async (retenir?: string) => {
    try {
      const liste = await chargerVps();
      setVps(liste);
      const aujourdHui = isoLocal(new Date());
      const id = choisirDansListe(
        liste,
        retenir ?? campagneId,
        // A defaut de choix : la prochaine VP ouverte, sinon la plus recente.
        (l) => [...l].filter((v) => !v.cloturee && v.jour >= aujourdHui).sort((a, b) => a.jour.localeCompare(b.jour))[0] ?? l[0]
      );
      choisir(id);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Chargement impossible.');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    void chargerListe();
  }, [chargerListe]);

  const vp = vps?.find((v) => v.id === campagneId) ?? null;

  const recharger = useCallback(async () => {
    if (!vp) return;
    try {
      setDonnees(await chargerDonneesVp(vp));
      setErreur(null);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Chargement impossible.');
    }
  }, [vp]);

  useEffect(() => {
    setDonnees(null);
    void recharger();
  }, [recharger]);
  // Changer d'onglet RELIT : un RDV pose dans la Saisie (qui charge ses propres
  // donnees) doit se voir aussitot dans Phoning ou Jour J — constate a l'essai le
  // 20/10, l'onglet montrait l'etat d'avant la pose jusqu'au rafraichissement.
  const premier = useRef(true);
  useEffect(() => {
    if (premier.current) {
      premier.current = false;
      return;
    }
    void recharger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ecran]);

  // L'horloge, et le rafraichissement des ecrans du jour J.
  const enCours = useRef(false);
  useEffect(() => {
    const t = window.setInterval(() => {
      setMaintenant(new Date());
      if (document.visibilityState !== 'visible' || !VIVANTS.has(ecran) || enCours.current) return;
      enCours.current = true;
      void recharger().finally(() => (enCours.current = false));
    }, 20_000);
    return () => window.clearInterval(t);
  }, [ecran, recharger]);

  const options = useMemo(() => ecrans.map((e) => ({ valeur: e.id, libelle: e.libelle })), [ecrans]);
  const props = donnees && { donnees, maintenant, recharger, gereVp };

  let contenu: React.ReactNode;
  if (erreur && !donnees) contenu = <div className="page vp-page"><div className="card pad">{erreur}</div></div>;
  else if (vps === null) contenu = <Attente />;
  else if (vps.length === 0 && !gereVp)
    contenu = (
      <div className="page vp-page">
        <div className="card empty">Aucune vente privée sur vos sites pour l’instant.</div>
      </div>
    );
  else if (ecran === 'parametrage' || vps.length === 0)
    contenu = (
      <Parametrage
        vps={vps}
        vp={vp}
        donnees={donnees}
        choisir={(id) => {
          choisir(id);
        }}
        rechargerListe={(id) => chargerListe(id)}
        recharger={recharger}
      />
    );
  else if (ecran === 'saisie') contenu = <Saisie />;
  else if (ecran === 'suivi') contenu = <Suivi />;
  else if (!props) contenu = <Attente />;
  else if (ecran === 'pilotage') contenu = <Pilotage {...props} />;
  else if (ecran === 'jour') contenu = <JourJ {...props} />;
  else if (ecran === 'accueil') contenu = <Accueil {...props} />;
  else if (ecran === 'projection') contenu = <Projection {...props} />;
  else if (ecran === 'bilan') contenu = <Bilan {...props} vps={vps} />;
  else contenu = <ImprimeVp {...props} />;

  return (
    <div className="v2">
      <div className="fond-vivant" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>

      <header className="vp-barre verre">
        <img className="logo" src="/grid.svg" alt="GRID" />
        <ChoixVp vps={vps ?? []} vp={vp} ouvert={menuOuvert} setOuvert={setMenuOuvert} choisir={choisir} versParametrage={gereVp ? () => changerEcran('parametrage') : undefined} />
        <Segmente options={options} valeur={ecran} onChange={changerEcran} etiquette="Écrans de la vente privée" className="vp-onglets" />
        <div className="droite">
          <button type="button" className="btn sm" onClick={retour} title="Revenir à GRID classique">
            <Icone nom="retour" petite /> GRID
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={(e) => basculer({ x: e.clientX, y: e.clientY })}
            title={theme === 'sombre' ? 'Passer en clair' : 'Passer en sombre'}
            aria-label={theme === 'sombre' ? 'Passer en clair' : 'Passer en sombre'}
          >
            <Icone nom={theme === 'sombre' ? 'soleil' : 'lune'} />
          </button>
          <button type="button" className="icon-btn" onClick={deconnexion} title={`${nomCompte} · ${palier} — se déconnecter`} aria-label="Se déconnecter">
            <Icone nom="sortie" />
          </button>
        </div>
      </header>

      <main className="contenu-v2">
        <Suspense fallback={<Attente />}>{contenu}</Suspense>
      </main>
    </div>
  );
}

/// LE CHOIX DE LA VP — un menu dans un PORTAIL (CLAUDE.md : un panneau flottant
/// ne vit jamais en `absolute` dans son parent). Un admin y voit toutes les VP,
/// un encadrant celles que `campagne` lui montre ; la saisie et le Suivi ne lui
/// ouvrent ensuite que les vendeurs de SES sites.
function ChoixVp({
  vps,
  vp,
  ouvert,
  setOuvert,
  choisir,
  versParametrage,
}: {
  vps: VpResume[];
  vp: VpResume | null;
  ouvert: boolean;
  setOuvert: (o: boolean) => void;
  choisir: (id: string) => void;
  versParametrage?: () => void;
}) {
  const bouton = useRef<HTMLButtonElement | null>(null);
  const [pos, setPos] = useState({ left: 12, top: 70 });
  useEffect(() => {
    if (!ouvert) return;
    const r = bouton.current?.getBoundingClientRect();
    if (r) setPos({ left: Math.max(12, r.left), top: r.bottom + 10 });
    const fermer = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.vp-menu, .vp-choix-vp')) setOuvert(false);
    };
    const echap = (e: KeyboardEvent) => e.key === 'Escape' && setOuvert(false);
    document.addEventListener('mousedown', fermer);
    document.addEventListener('keydown', echap);
    return () => {
      document.removeEventListener('mousedown', fermer);
      document.removeEventListener('keydown', echap);
    };
  }, [ouvert, setOuvert]);

  const aujourdHui = isoLocal(new Date());
  const groupe = (v: VpResume) => (v.cloturee ? 'Closes' : v.jour < aujourdHui ? 'À clôturer' : v.phoningDu <= aujourdHui ? 'En cours' : 'Préparées');
  const ordre = ['En cours', 'À clôturer', 'Préparées', 'Closes'];
  const groupes = ordre
    .map((g) => [g, vps.filter((v) => groupe(v) === g)] as const)
    .filter(([, l]) => l.length > 0);

  return (
    <>
      <button
        ref={bouton}
        type="button"
        className="titre vp-choix-vp"
        aria-haspopup="menu"
        aria-expanded={ouvert}
        onClick={() => setOuvert(!ouvert)}
        title="Changer de vente privée"
      >
        <b>
          <span>{vp ? `VP · ${vp.siteLibelle}` : 'Ventes privées'}</span>
          <Icone nom="bas" petite />
        </b>
        <span>{vp ? `Phoning ${jj(vp.phoningDu)}–${jj(vp.phoningAu)} · Vente privée ${jjmmaaaa(vp.jour)}` : 'Aucune VP'}</span>
      </button>
      {ouvert &&
        createPortal(
          <div className="v2">
            <div className="vp-menu verre fort" role="menu" style={pos}>
              {groupes.length === 0 && <div className="groupe">Aucune VP</div>}
              {groupes.map(([g, l]) => (
                <div key={g}>
                  <div className="groupe">{g}</div>
                  {l.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      className="ligne-vp"
                      role="menuitem"
                      onClick={() => {
                        choisir(v.id);
                        setOuvert(false);
                      }}
                    >
                      <span>{v.id === vp?.id && <Icone nom="coche" petite />}</span>
                      <span>
                        <b>VP · {v.siteLibelle}</b>
                        <small>{jourLong(v.jour)}</small>
                      </span>
                      <span />
                    </button>
                  ))}
                </div>
              ))}
              {versParametrage && (
                <div className="pied-menu">
                  <button
                    type="button"
                    className="ligne-vp"
                    onClick={() => {
                      setOuvert(false);
                      versParametrage();
                    }}
                  >
                    <span />
                    <span>
                      <b>Paramétrage des VP</b>
                      <small>créer, dates, vendeurs, objectifs</small>
                    </span>
                    <span />
                  </button>
                </div>
              )}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
