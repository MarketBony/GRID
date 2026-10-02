import { useCallback, useEffect, useState } from 'react';
import { sansDiacritiques } from '../backend/src/utils/tri';
import {
  chargerComptes,
  creerCompte,
  libelleRoleEncadrement,
  libelleRoleGlobal,
  modifierCompte,
  reinitialiserMotDePasse,
  supprimerCompte,
  type Compte,
} from '../services/utilisateurs';

// ============================================================================
// ECRAN GESTION — les comptes. RESERVE A `admin`.
//
// « Je pourrais leur creer des comptes, et en supprimer a ma guise via cette
//   interface. Et une fois qu'ils sont dans la becane, ils seront disponibles a
//   l'affiliation de site dans l'onglet vendeurs, et de table dans l'onglet
//   table. »
//
// LES QUATRE PALIERS, du plus large au plus etroit :
//
//   Administrateur — tout, y compris cet ecran.
//   Direction      — tout SAUF cet ecran.
//   Encadrant      — aucun role : ses droits viennent de ses RATTACHEMENTS. Il lit
//                    tout (les compteurs sont publics) et ne saisit que pour les
//                    vendeurs de ses sites et de ses tables.
//   Lecteur        — lecture seule, aucune saisie.
//
// C'est le palier ENCADRANT qui fait tourner l'exercice : un chef de vente
// rattache a Clermont peut animer une table de Villefranche pour coacher des
// vendeurs de cinq concessions differentes.
//
// LE MOT DE PASSE N'APPARAIT QU'UNE FOIS, a la creation ou a la reinitialisation.
// Il n'est ni journalise ni stocke autrement que hache : l'ecran le montre le
// temps qu'on le note, et personne ne pourra le relire ensuite.
// ============================================================================

export function Gestion() {
  const [comptes, setComptes] = useState<Compte[]>([]);
  const [rolesGlobaux, setRolesGlobaux] = useState<string[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);
  const [occupe, setOccupe] = useState<string | null>(null);
  const [enCreation, setEnCreation] = useState(false);
  const [afficherInactifs, setAfficherInactifs] = useState(false);

  /// Le mot de passe a montrer UNE fois. Reste a l'ecran jusqu'a ce qu'on le
  /// ferme : le faire disparaitre tout seul garantirait qu'on le perde.
  const [aNoter, setANoter] = useState<{ nom: string; motDePasse: string } | null>(null);

  const recharger = useCallback(async () => {
    const r = await chargerComptes();
    setComptes(r.comptes);
    setRolesGlobaux(r.rolesGlobaux);
  }, []);

  useEffect(() => {
    recharger()
      .catch((e) => setErreur(e instanceof Error ? e.message : 'Chargement impossible.'))
      .finally(() => setChargement(false));
  }, [recharger]);

  const agir = async (id: string, action: () => Promise<string | void>) => {
    setErreur(null);
    setSucces(null);
    setOccupe(id);
    try {
      const message = await action();
      await recharger();
      if (typeof message === 'string') setSucces(message);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Operation impossible.');
    } finally {
      setOccupe(null);
    }
  };

  if (chargement) return <div className="attente">Chargement des comptes…</div>;

  const visibles = comptes.filter((c) => afficherInactifs || c.actif);
  const encadrants = comptes.filter((c) => c.actif && c.rolesGlobaux.length === 0);

  return (
    <section className="ecran">
      <header className="ecran-entete">
        <div>
          <h2>Gestion des comptes</h2>
          <p className="note">
            Un compte créé devient attribuable comme encadrant d’un site (onglet Vendeurs) et comme
            chef de table (onglet Tables), y compris sur une autre concession que la sienne.
          </p>
        </div>
        <div className="progression">
          <strong>{comptes.filter((c) => c.actif).length}</strong>
          <span>comptes actifs — dont {encadrants.length} encadrants</span>
        </div>
      </header>

      {erreur && <div className="erreur-bloc">{erreur}</div>}
      {succes && <div className="succes-bloc">{succes}</div>}

      {aNoter && (
        <div className="carte mot-de-passe-unique">
          <h3>Mot de passe de {aNoter.nom}</h3>
          <p className="note">
            <strong>Il n’apparaîtra plus.</strong> Seul son empreinte est conservée — personne, pas
            même un administrateur, ne pourra le relire. Le noter maintenant, ou le réinitialiser
            plus tard.
          </p>
          <code className="mot-de-passe">{aNoter.motDePasse}</code>
          <div className="actions">
            <button
              type="button"
              className="principal"
              onClick={() => {
                void navigator.clipboard?.writeText(aNoter.motDePasse).catch(() => undefined);
                setSucces('Mot de passe copié.');
              }}
            >
              Copier
            </button>
            <button type="button" className="secondaire" onClick={() => setANoter(null)}>
              J’ai noté
            </button>
          </div>
        </div>
      )}

      <div className="barre-outils">
        <button
          type="button"
          className={enCreation ? 'secondaire' : 'principal'}
          onClick={() => setEnCreation((o) => !o)}
        >
          {enCreation ? 'Annuler' : '+ Nouveau compte'}
        </button>
        <label className="interrupteur">
          <input
            type="checkbox"
            checked={afficherInactifs}
            onChange={(e) => setAfficherInactifs(e.target.checked)}
          />
          Afficher les comptes désactivés
        </label>
      </div>

      {enCreation && (
        <FormulaireCompte
          rolesGlobaux={rolesGlobaux}
          onAnnuler={() => setEnCreation(false)}
          onCreer={(champs) =>
            void agir('nouveau', async () => {
              const r = await creerCompte(champs);
              setANoter({ nom: r.compte.nom, motDePasse: r.motDePasse });
              setEnCreation(false);
              return `${r.compte.nom} créé.`;
            })
          }
        />
      )}

      <div className="carte">
        <h3>
          Comptes
          <span className="etiquette">{visibles.length}</span>
        </h3>
        <div className="tableau-defilant">
          <table className="tableau">
            <thead>
              <tr>
                <th>Nom</th>
                <th>Identifiant</th>
                <th>Palier</th>
                <th>Sites encadrés</th>
                <th>Tables animées</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visibles.map((c) => (
                <LigneCompte
                  key={c.id}
                  compte={c}
                  rolesGlobaux={rolesGlobaux}
                  occupe={occupe === c.id}
                  onChangerRole={(role) =>
                    void agir(c.id, async () => {
                      await modifierCompte(c.id, { roleGlobal: role });
                      return `${c.nom} : palier mis à jour.`;
                    })
                  }
                  onBasculerActif={() =>
                    void agir(c.id, async () => {
                      const r = await modifierCompte(c.id, { actif: !c.actif });
                      return r.actif
                        ? `${c.nom} réactivé.`
                        : `${c.nom} désactivé : ses encadrements de site sont libérés.`;
                    })
                  }
                  onReinitialiser={() =>
                    void agir(c.id, async () => {
                      const r = await reinitialiserMotDePasse(c.id);
                      setANoter({ nom: r.nom, motDePasse: r.motDePasse });
                    })
                  }
                  onSupprimer={() => {
                    const saisi = window.prompt(
                      `SUPPRESSION DÉFINITIVE du compte de ${c.nom}.\n\n` +
                        'Irréversible : le compte, son identité de connexion et ses rôles ' +
                        'disparaissent. Pour un retrait réversible, utiliser « désactiver ».' +
                        '\n\n' +
                        'Elle n’est possible que si ce compte n’explique plus rien — aucune ' +
                        'table animée, aucun rôle de campagne. Sinon la base refusera, et elle ' +
                        'aura raison : il documenterait encore une campagne passée.' +
                        '\n\n' +
                        `Pour confirmer, taper le nom exact :\n${c.nom}`
                    );
                    if (saisi === null) return;
                    void agir(c.id, async () => {
                      const r = await supprimerCompte(c.id, saisi);
                      return `${r.supprime} supprimé définitivement.`;
                    });
                  }}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- une ligne

function LigneCompte({
  compte,
  rolesGlobaux,
  occupe,
  onChangerRole,
  onBasculerActif,
  onReinitialiser,
  onSupprimer,
}: {
  compte: Compte;
  rolesGlobaux: string[];
  occupe: boolean;
  onChangerRole: (role: string | null) => void;
  onBasculerActif: () => void;
  onReinitialiser: () => void;
  onSupprimer: () => void;
}) {
  const palier = compte.rolesGlobaux[0] ?? '';
  const [arme, setArme] = useState(false);

  return (
    <tr className={compte.actif ? '' : 'sorti'}>
      <td>
        {compte.nom}
        {!compte.actif && <span className="etiquette">désactivé</span>}
        {compte.vendeur && (
          <span className="etiquette" title="Ce compte est aussi un vendeur.">
            vendeur
          </span>
        )}
      </td>
      <td>
        <code>{compte.loginId}</code>
      </td>
      <td>
        <select
          value={palier}
          disabled={occupe || !compte.actif}
          onChange={(e) => onChangerRole(e.target.value === '' ? null : e.target.value)}
          aria-label={`Palier de ${compte.nom}`}
        >
          {/* `aucun` n'est pas un manque : c'est le palier ENCADRANT, celui qui
              fait tourner l'exercice. */}
          <option value="">Encadrant</option>
          {rolesGlobaux.map((r) => (
            <option key={r} value={r}>
              {libelleRoleGlobal([r])}
            </option>
          ))}
        </select>
      </td>
      <td>
        {compte.sitesEncadres.length === 0 ? (
          <span className="note">—</span>
        ) : (
          <div className="puces-role">
            {compte.sitesEncadres.map((e) => (
              <span className="etiquette" key={e.id}>
                {e.siteCode} · {libelleRoleEncadrement(e.role)}
              </span>
            ))}
          </div>
        )}
      </td>
      <td>
        {compte.tablesAnimees.length === 0 ? (
          <span className="note">—</span>
        ) : (
          <div className="puces-role">
            {compte.tablesAnimees.map((t) => (
              // LA CAMPAGNE EST DANS L'ETIQUETTE, pas seulement dans l'infobulle.
              // Un chef qui anime la Table 1 de SUD sur juin ET sur septembre
              // affichait deux fois « TABLE 1 · SUD », ce qui se lit comme un
              // doublon de donnees. Le libelle d'une table n'identifie rien sans
              // sa campagne.
              <span className="etiquette" key={t.id}>
                {t.libelle} · {t.plaqueLibelle}
                <span className="etiquette-suffixe">
                  {t.campagneLibelle}
                  {t.campagneCloturee ? ' · cloturee' : ''}
                </span>
              </span>
            ))}
          </div>
        )}
      </td>
      <td className="colonne-actions">
        {/* EN DEUX CLICS (03/10/2026). C'etait un lien en un clic, sans
            confirmation : un clic de travers remplacait le mot de passe d'un
            collegue, et le nouveau ne s'affichait que chez celui qui avait clique.
            Le second clic nomme la personne ; sans lui, le bouton se desarme seul. */}
        <button
          type="button"
          className={arme ? 'lien danger' : 'lien'}
          onClick={() => {
            if (!arme) {
              setArme(true);
              window.setTimeout(() => setArme(false), 5000);
              return;
            }
            setArme(false);
            onReinitialiser();
          }}
          disabled={occupe}
        >
          {arme ? `remplacer le mot de passe de ${compte.nom} ?` : 'mot de passe'}
        </button>
        <button type="button" className="lien" onClick={onBasculerActif} disabled={occupe}>
          {compte.actif ? 'désactiver' : 'réactiver'}
        </button>
        {/* LA SUPPRESSION SE VOIT TOUJOURS, MEME QUAND ELLE EST IMPOSSIBLE.

            Elle n'apparaissait que sur un compte DEJA DESACTIVE : rien, sur un
            compte actif, ne laissait deviner qu'elle existait. On la cherchait,
            on ne la trouvait pas, on en concluait qu'elle n'avait pas ete faite —
            constate le 01/09/2026.

            Un bouton absent n'enseigne rien ; un bouton desactive qui dit
            POURQUOI enseigne la marche a suivre. La protection ne bouge pas d'un
            cran : desactiver d'abord, retaper le nom exact ensuite, et les deux
            verrous poses en base par `relance.utilisateur_purger` par-dessus. */}
        <button
          type="button"
          className="destructif"
          onClick={onSupprimer}
          disabled={occupe || compte.actif}
          title={
            compte.actif
              ? 'Désactiver le compte d’abord : la suppression définitive ne s’applique ' +
                'qu’à un compte déjà retiré du service.'
              : 'Suppression définitive. La base la refusera si ce compte anime une table ' +
                'ou porte un rôle de campagne : il expliquerait encore une campagne passée.'
          }
        >
          supprimer
        </button>
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------- creation

function FormulaireCompte({
  rolesGlobaux,
  onCreer,
  onAnnuler,
}: {
  rolesGlobaux: string[];
  onCreer: (champs: {
    nom: string;
    loginId: string;
    roleGlobal: string | null;
    motDePasse?: string;
  }) => void;
  onAnnuler: () => void;
}) {
  const [nom, setNom] = useState('');
  const [loginId, setLoginId] = useState('');
  const [roleGlobal, setRole] = useState('');
  const [motDePasse, setMotDePasse] = useState('');

  /// Proposition d'identifiant : initiale du prenom + nom, sans accent. On le
  /// PROPOSE sans l'imposer — deux homonymes existent, et c'est l'administrateur
  /// qui tranche.
  const proposer = (n: string) => {
    const mots = sansDiacritiques(n)
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(Boolean);
    if (mots.length === 0) return '';
    if (mots.length === 1) return mots[0]!.slice(0, 32);
    return (mots[0]![0] + mots[mots.length - 1]!).slice(0, 32);
  };

  const loginValide = /^[a-z0-9._-]{3,32}$/.test(loginId);
  const complet = nom.trim() !== '' && loginValide && (motDePasse === '' || motDePasse.length >= 8);

  return (
    <div className="apercu">
      <h3>Nouveau compte</h3>
      <div className="champs">
        <label>
          Nom
          <input
            value={nom}
            autoFocus
            placeholder="PRÉNOM NOM"
            onChange={(e) => {
              setNom(e.target.value);
              // Tant que l'identifiant n'a pas ete touche a la main, il suit le nom.
              if (loginId === '' || loginId === proposer(nom)) setLoginId(proposer(e.target.value));
            }}
          />
        </label>
        <label>
          Identifiant de connexion
          <input
            value={loginId}
            onChange={(e) => setLoginId(e.target.value.toLowerCase())}
            placeholder="pnom"
            spellCheck={false}
          />
        </label>
        <label>
          Palier
          <select value={roleGlobal} onChange={(e) => setRole(e.target.value)}>
            <option value="">Encadrant</option>
            {rolesGlobaux.map((r) => (
              <option key={r} value={r}>
                {libelleRoleGlobal([r])}
              </option>
            ))}
          </select>
        </label>
        <label>
          Mot de passe
          <input
            value={motDePasse}
            onChange={(e) => setMotDePasse(e.target.value)}
            placeholder="laisser vide = généré"
            spellCheck={false}
          />
        </label>
      </div>

      <p className="note">
        {roleGlobal === ''
          ? 'Un encadrant lit tout, et ne saisit que pour les vendeurs des sites qu’il encadre et des tables qu’il anime. Le rattachement se fait ensuite dans les onglets Vendeurs et Tables.'
          : roleGlobal === 'admin'
            ? 'Un administrateur a tous les accès, y compris cet écran.'
            : roleGlobal === 'direction'
              ? 'La direction a tous les accès sauf cet écran.'
              : 'Un lecteur consulte, sans jamais rien saisir.'}
        {!loginValide && loginId !== '' && (
          <>
            {' '}
            <span className="alerte">
              L’identifiant n’accepte que minuscules, chiffres, point, tiret et soulignement, de 3 à
              32 caractères.
            </span>
          </>
        )}
      </p>

      <div className="actions">
        <button
          type="button"
          className="principal"
          disabled={!complet}
          onClick={() =>
            onCreer({
              nom: nom.trim(),
              loginId,
              roleGlobal: roleGlobal === '' ? null : roleGlobal,
              ...(motDePasse === '' ? {} : { motDePasse }),
            })
          }
        >
          Créer le compte
        </button>
        <button type="button" className="secondaire" onClick={onAnnuler}>
          Annuler
        </button>
      </div>
    </div>
  );
}
