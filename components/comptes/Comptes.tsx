import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icone } from '../ui/Icone';
import { useIndicateurGlissant } from '../../hooks/useIndicateurGlissant';
import { cleTri } from '../../backend/src/utils/tri';
import {
  chargerComptes,
  creerCompte,
  libelleRoleEncadrement,
  libelleRoleGlobal,
  modifierCompte,
  reinitialiserMotDePasse,
  supprimerCompte,
  type Compte,
} from '../../services/utilisateurs';

// ============================================================================
// LA GESTION DES COMPTES, en v2 — lot 7 de PLAN-GRID-V2.md. Reservee a `admin`
// par la base (`peut_gerer_utilisateurs`) : cet ecran ne fait qu'AFFICHER selon
// le palier, il n'autorise rien (interdit n.5).
//
// Une liste qu'on filtre, et une fiche en volet. Le journal des comptes
// (`journal_compte`) est toujours tenu par la base, mais n'est plus affiche :
// retire le 05/10/2026, l'utilisateur ne l'avait jamais demande.
// ============================================================================

type Filtre = 'actifs' | 'tous' | 'desactives';
const FILTRES: { id: Filtre; libelle: string }[] = [
  { id: 'actifs', libelle: 'Actifs' },
  { id: 'desactives', libelle: 'Désactivés' },
  { id: 'tous', libelle: 'Tous' },
];
const PALIERS: { valeur: string | null; libelle: string }[] = [
  { valeur: null, libelle: 'Encadrant' },
  { valeur: 'lecteur', libelle: 'Lecteur' },
  { valeur: 'direction', libelle: 'Direction' },
  { valeur: 'admin', libelle: 'Administrateur' },
];

const initiales = (nom: string) =>
  nom.split(/\s+/).filter(Boolean).map((m) => m[0]).slice(0, 2).join('').toUpperCase();

export function Comptes() {
  const [comptes, setComptes] = useState<Compte[]>([]);
  const [filtre, setFiltre] = useState<Filtre>('actifs');
  const [recherche, setRecherche] = useState('');
  const [fiche, setFiche] = useState<string | null>(null);
  const [creation, setCreation] = useState(false);
  const [aNoter, setANoter] = useState<{ nom: string; motDePasse: string } | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);
  const [chargement, setChargement] = useState(true);

  const recharger = useCallback(async () => {
    const { comptes: c } = await chargerComptes();
    setComptes(c);
  }, []);

  useEffect(() => {
    recharger()
      .catch((e) => setMessage({ ok: false, texte: e instanceof Error ? e.message : 'Chargement impossible.' }))
      .finally(() => setChargement(false));
  }, [recharger]);

  const visibles = useMemo(() => {
    const q = cleTri(recherche.trim());
    return comptes
      .filter((c) => (filtre === 'tous' ? true : filtre === 'actifs' ? c.actif : !c.actif))
      .filter((c) => !q || cleTri(`${c.nom} ${c.loginId}`).includes(q));
  }, [comptes, filtre, recherche]);

  const segFiltre = useIndicateurGlissant(FILTRES.findIndex((f) => f.id === filtre), FILTRES.length);

  /// Une action sur un compte : on la joue, on relit, et on DIT ce qui s'est passe.
  const agir = async (action: () => Promise<string | void>) => {
    setMessage(null);
    try {
      const texte = await action();
      await recharger();
      if (texte) setMessage({ ok: true, texte });
    } catch (e) {
      setMessage({ ok: false, texte: e instanceof Error ? e.message : 'Opération impossible.' });
    }
  };

  const compteOuvert = comptes.find((c) => c.id === fiche) ?? null;

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div className="card pad" style={{ display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <b style={{ fontSize: 15 }}>Comptes</b>
          <span className="faint num">{comptes.filter((c) => c.actif).length} actifs</span>
          <button type="button" className="btn primary" style={{ marginLeft: 'auto' }} onClick={() => setCreation(true)}>
            <Icone nom="plus" petite /> Nouveau compte
          </button>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="seg" ref={segFiltre.conteneur}>
            <span className="pouce" ref={segFiltre.indicateur} aria-hidden="true" />
            {FILTRES.map((f, i) => (
              <button key={f.id} type="button" ref={segFiltre.cible(i)} aria-pressed={f.id === filtre} onClick={() => setFiltre(f.id)}>
                {f.libelle}
              </button>
            ))}
          </div>
          <label className="recherche-v2">
            <Icone nom="recherche" petite />
            <input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Nom ou identifiant…" />
          </label>
        </div>

        {message && <div className={`bandeau-v2${message.ok ? '' : ' erreur'}`} role="status">{message.texte}</div>}

        {aNoter && (
          <div className="mdp-a-noter enter">
            <div>
              <b>Mot de passe provisoire de {aNoter.nom}</b>
              <div className="faint">Il n’apparaîtra plus. La personne choisira le sien à sa prochaine connexion.</div>
            </div>
            <code>{aNoter.motDePasse}</code>
            <button type="button" className="btn sm" onClick={() => void navigator.clipboard?.writeText(aNoter.motDePasse).catch(() => undefined)}>
              Copier
            </button>
            <button type="button" className="icon-btn" onClick={() => setANoter(null)} aria-label="J'ai noté">
              <Icone nom="fermer" petite />
            </button>
          </div>
        )}

        {chargement ? (
          <div className="skel" style={{ height: 200 }} />
        ) : (
          <div className="liste-comptes">
            {visibles.map((c, k) => (
              <button key={c.id} type="button" className={`ligne-compte enter${c.actif ? '' : ' inactif'}`} style={{ ['--i' as string]: Math.min(k, 14) }} onClick={() => setFiche(c.id)}>
                <span className="avatar-v2 petit">{initiales(c.nom)}</span>
                <span className="identite">
                  <b>{c.nom}</b>
                  <span className="faint">{c.loginId}</span>
                </span>
                <span className="badge" style={{ ['--c' as string]: c.rolesGlobaux.includes('admin') ? 'var(--bony-orange)' : c.rolesGlobaux.includes('direction') ? 'var(--bony-violet)' : 'var(--info)' }}>
                  {libelleRoleGlobal(c.rolesGlobaux)}
                </span>
                <span className="faint num details">
                  {c.sitesEncadres.length > 0 && `${c.sitesEncadres.length} site${c.sitesEncadres.length > 1 ? 's' : ''}`}
                  {c.tablesAnimees.length > 0 && ` · ${c.tablesAnimees.length} table${c.tablesAnimees.length > 1 ? 's' : ''}`}
                </span>
                {!c.actif && <span className="badge">désactivé</span>}
              </button>
            ))}
            {visibles.length === 0 && <div className="empty">Aucun compte.</div>}
          </div>
        )}
      </div>

      {compteOuvert && (
        <FicheCompte
          compte={compteOuvert}
          fermer={() => setFiche(null)}
          agir={agir}
          noter={setANoter}
        />
      )}
      {creation && (
        <FormulaireCreation
          fermer={() => setCreation(false)}
          creer={(champs) =>
            agir(async () => {
              const r = await creerCompte(champs);
              setCreation(false);
              setANoter({ nom: r.compte.nom, motDePasse: r.motDePasse });
              return `${r.compte.nom} créé.`;
            })
          }
        />
      )}
    </div>
  );
}

function Volet({ titre, fermer, children }: { titre: string; fermer: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const surTouche = (e: KeyboardEvent) => e.key === 'Escape' && fermer();
    window.addEventListener('keydown', surTouche);
    return () => window.removeEventListener('keydown', surTouche);
  }, [fermer]);
  return createPortal(
    <div className="v2">
      <div className="v2-voile" onClick={fermer} />
      <div className="v2-volet verre fort" role="dialog" aria-label={titre}>
        {children}
      </div>
    </div>,
    document.body
  );
}

function FicheCompte({
  compte: c,
  fermer,
  agir,
  noter,
}: {
  compte: Compte;
  fermer: () => void;
  agir: (a: () => Promise<string | void>) => Promise<void>;
  noter: (n: { nom: string; motDePasse: string }) => void;
}) {
  const [armeMdp, setArmeMdp] = useState(false);
  const [suppression, setSuppression] = useState('');
  const palier = c.rolesGlobaux[0] ?? null;

  return (
    <Volet titre={`Compte de ${c.nom}`} fermer={fermer}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <span className="avatar-v2">{initiales(c.nom)}</span>
        <div style={{ flex: 1 }}>
          <h3 style={{ margin: 0 }}>{c.nom}</h3>
          <span className="faint">{c.loginId} · créé le {new Date(c.creeLe).toLocaleDateString('fr-FR')}</span>
        </div>
        <button type="button" className="icon-btn" onClick={fermer} aria-label="Fermer">
          <Icone nom="fermer" />
        </button>
      </div>

      <div style={{ display: 'grid', gap: 14, marginTop: 18 }}>
        <label className="field">
          <span className="label">Palier</span>
          <select
            className="select"
            value={palier ?? ''}
            onChange={(e) => void agir(async () => {
              await modifierCompte(c.id, { roleGlobal: e.target.value || null });
              return `${c.nom} : palier mis à jour.`;
            })}
          >
            {PALIERS.map((p) => <option key={p.libelle} value={p.valeur ?? ''}>{p.libelle}</option>)}
          </select>
        </label>

        {(c.sitesEncadres.length > 0 || c.tablesAnimees.length > 0) && (
          <div className="field">
            <span className="label">Ce qu’il encadre</span>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {c.sitesEncadres.map((s) => (
                <span key={s.id} className="badge">{s.siteLibelle} · {libelleRoleEncadrement(s.role)}</span>
              ))}
              {c.tablesAnimees.map((t) => (
                <span key={t.id} className="badge" style={{ ['--c' as string]: 'var(--bony-violet)' }}>
                  {t.libelle} · {t.plaqueLibelle} · {t.campagneLibelle}
                </span>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            className={`btn${armeMdp ? ' danger' : ''}`}
            onClick={() => {
              // EN DEUX CLICS : le second nomme la personne (03/10/2026).
              if (!armeMdp) {
                setArmeMdp(true);
                window.setTimeout(() => setArmeMdp(false), 5000);
                return;
              }
              setArmeMdp(false);
              void agir(async () => {
                const r = await reinitialiserMotDePasse(c.id);
                noter({ nom: r.nom, motDePasse: r.motDePasse });
                fermer();
                return `Mot de passe de ${c.nom} réinitialisé.`;
              });
            }}
          >
            {armeMdp ? `Remplacer le mot de passe de ${c.nom} ?` : 'Réinitialiser le mot de passe'}
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => void agir(async () => {
              const r = await modifierCompte(c.id, { actif: !c.actif });
              return r.actif ? `${c.nom} réactivé.` : `${c.nom} désactivé : ses encadrements sont libérés.`;
            })}
          >
            {c.actif ? 'Désactiver' : 'Réactiver'}
          </button>
        </div>

        {!c.actif && (
          <div className="field">
            <span className="label">Suppression définitive</span>
            <span className="faint" style={{ fontSize: 12 }}>
              Possible seulement si ce compte n’explique plus rien (aucune table, aucun RDV saisi ni suivi). Retaper le nom exact.
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="input" value={suppression} onChange={(e) => setSuppression(e.target.value)} placeholder={c.nom} />
              <button
                type="button"
                className="btn danger"
                disabled={suppression !== c.nom}
                onClick={() => void agir(async () => {
                  await supprimerCompte(c.id, suppression);
                  fermer();
                  return `${c.nom} supprimé.`;
                })}
              >
                Supprimer
              </button>
            </div>
          </div>
        )}
      </div>
    </Volet>
  );
}

function FormulaireCreation({
  fermer,
  creer,
}: {
  fermer: () => void;
  creer: (champs: { nom: string; loginId: string; roleGlobal: string | null }) => Promise<void>;
}) {
  const [nom, setNom] = useState('');
  const [loginId, setLoginId] = useState('');
  const [palier, setPalier] = useState('');
  const loginValide = /^[a-z0-9._-]+$/.test(loginId);
  return (
    <Volet titre="Nouveau compte" fermer={fermer}>
      <h3>Nouveau compte</h3>
      <p className="faint" style={{ margin: '0 0 14px' }}>Un mot de passe provisoire est tiré au hasard ; la personne choisira le sien à sa première connexion.</p>
      <div style={{ display: 'grid', gap: 12 }}>
        <label className="field">
          <span className="label">Nom</span>
          <input className="input" value={nom} onChange={(e) => setNom(e.target.value)} autoFocus />
        </label>
        <label className="field">
          <span className="label">Identifiant</span>
          <input className="input" value={loginId} onChange={(e) => setLoginId(e.target.value.toLowerCase())} placeholder="ex. jdupont" spellCheck={false} />
          {loginId !== '' && !loginValide && <span style={{ color: 'var(--danger)', fontSize: 12 }}>Lettres minuscules, chiffres, point, tiret.</span>}
        </label>
        <label className="field">
          <span className="label">Palier</span>
          <select className="select" value={palier} onChange={(e) => setPalier(e.target.value)}>
            {PALIERS.map((p) => <option key={p.libelle} value={p.valeur ?? ''}>{p.libelle}</option>)}
          </select>
        </label>
      </div>
      <div className="pied">
        <button type="button" className="btn ghost" onClick={fermer}>Annuler</button>
        <button type="button" className="btn primary" disabled={!nom.trim() || !loginValide} onClick={() => void creer({ nom: nom.trim(), loginId, roleGlobal: palier || null })}>
          Créer
        </button>
      </div>
    </Volet>
  );
}
