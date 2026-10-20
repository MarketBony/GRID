# GRID/VP — cadrage des ventes privées

Branche `feat/grid-vp`. Maquette : `maquette-vp.html` (racine, servie par Vite en
développement, exclue du build, données fictives).

## Ce qu'est une VP

Une opération commerciale **locale**, sur **un site** et à des dates fixées. Chaque
concession en fait une à deux par an. Le format est toujours le même, sur 3 jours :

| Jour | Ce qui se passe |
|---|---|
| J1, J2 | Phoning « en affaire » par les vendeurs du site, avec l'encadrant VP |
| J3 | La journée de vente privée, sur les RDV pris (1 h, horaires de GRID classique) |

- **Le marketing et l'encadrant VP sont des comptes `admin`.** Ce sont eux qui créent
  la VP et bloquent ses dates.
- **Chef de site et chef de vente sont des encadrants**, comme dans GRID classique :
  ils saisissent et suivent les RDV de leur site.
- **Seuls les vendeurs du site participent**, sans renfort.
- **Tous les RDV sont saisis à la main par les vendeurs.** Ceux qui arrivent par
  e-mail, SMS ou formulaire sont confirmés au phoning, puis saisis.
- **La tablette d'accueil est tenue par l'encadrant VP**, sous son compte admin. Il n'y
  a donc pas de palier dédié.
- **Pas de rétroplanning** dans GRID : l'ERP le fait déjà.
- **Pas de fork.** Un seul GRID, une seule base, et une interface VP.
- **Pas de SPARK pour l'instant.** Le pont viendra quand SPARK sera fini, en
  commençant par le référentiel vendeurs.

## Ce qui est retenu (20/10/2026)

| # | Apport | Écran de la maquette |
|---|---|---|
| 1 | Courbe de remplissage du jour J, heure par heure | Phoning |
| 2 | Projection : RDV attendus en fin de J2, au rythme récent | Phoning |
| 3 | Classement des vendeurs du site en direct, objectif de RDV par vendeur | Phoning |
| 4 | Agenda du jour J : vendeurs en colonnes, heures en lignes | Jour J |
| 5 | Réaffecter un RDV à un vendeur libre à la même heure | Jour J |
| 6 | Parcours du client sur tablette : attendu → arrivé → avec le vendeur → sortie et issue | Accueil |
| 7 | Mode projection, pour les sites équipés | Projection |
| 8 | Bilan de la VP ramené au vendeur, et comparaison entre VP **par vendeur** | Bilan |
| 9 | Planning imprimé du jour J : une feuille par vendeur, l'agenda de sa journée | Imprimé |
| 10 | Paramétrage, **admin seulement** : créer une VP, ses dates, ses créneaux, qui en est, l'objectif de RDV de chaque vendeur, la clôture | Paramétrage |
| 11 | Changer de VP depuis la barre. Un admin voit toutes les VP, un encadrant celles de ses sites | partout |

**Écartés :** la capacité du showroom par heure (inutile), et la liste de rappel après
la VP (elle n'aura d'intérêt qu'une fois GRID branché à SPARK).

## Réponses de l'utilisateur (20/10/2026)

- **Objectif de RDV : un par vendeur.** Il est saisi au paramétrage, avec un raccourci
  « appliquer à tous les présents ».
- **Bilan : les offres conclues les jours suivants comptent.** Une vente, c'est une
  commande saisie dans le Suivi jusqu'à la clôture de la VP, quel que soit le jour où
  elle est conclue. C'est pour ça que la clôture est un geste manuel, et qu'elle
  prévient s'il reste des offres en cours.
- **Le paramétrage et le changement de VP sont réservés aux admins.**
- **Réaffectation** : la réponse reçue (« un par vendeur ») porte sur l'objectif. La
  règle proposée reste à confirmer (question 1 ci-dessous).

## Le modèle (validé le 20/10/2026, migration `20261020142152_vente_privee`)

Le principe : **une VP est une campagne**. Elle hérite de tout ce que GRID classique sait
déjà faire (grille, créneaux, mobilisation, Suivi, trafic naturel, no show, clôture,
tableau des ventes). On n'ajoute que ce qui lui est propre.

| Besoin | Où | Remarque |
|---|---|---|
| Distinguer une VP | `campagne.nature` : `operation` (par défaut) ou `vente_privee` | Liste de valeurs : CHECK + `NATURES_CAMPAGNE` dans `auth/roles.ts` + `test:invariants` (interdit n.6) |
| Son site | `campagne.site_id`, FK `site` | CHECK : renseigné **si et seulement si** c'est une VP |
| J3, le jour des RDV | le seul `campagne_jour` de la campagne | `date_debut = date_fin = J3` |
| J1 et J2, le phoning | `campagne.phoning_du`, `campagne.phoning_au` | CHECK : obligatoires pour une VP, `phoning_du ≤ phoning_au < date_debut`. La projection en a besoin |
| Créneaux | `campagne_creneau`, inchangé | Ceux de GRID classique par défaut ; `campagne_definir_creneaux` existe |
| Seulement les vendeurs du site | **une condition de présence** `(c.site_id IS NULL OR v.site_id = c.site_id)` dans `perimetre_suivi` et dans la branche « table » de `perimetre_saisie` | Le périmètre n'est pas recopié (interdit n.4) : tout ce qui le lit (saisie, Suivi, politiques, `charger_*`) suit de lui-même |
| Présent / absent, motif | `mobilisation`, inchangée | La règle « absent avec RDV reste compté » est celle de `mobilisation()` |
| Objectif de RDV | `mobilisation.objectif_rdv`, entier ≥ 0, nullable | C'est une consigne saisie, pas un agrégat (interdit n.2) |
| Parcours d'accueil | `rdv_suivi.arrive_le`, `avec_vendeur_le`, `sorti_le` | CHECK sur l'ordre. Les issues existent déjà : Commande = `commande`, Offre = `offre_en_cours`, Sans suite = `clos_sans_suite`, `no_show` |
| Visiteur sans RDV | `rdv.source = 'showroom'` et `rdv_poser_showroom` | Existants |
| Réaffectation | `rdv.pris_par_vendeur_id`, nullable (NULL = le vendeur du RDV), et une RPC `rdv_reaffecter` | Le classement du phoning compte `coalesce(pris_par_vendeur_id, vendeur_id)`, les ventes comptent `vendeur_id`. Les triggers de marque autorisée s'appliquent au nouveau vendeur |
| Droits de paramétrage | `relance.peut_gerer_vp()` = `admin` seul, et `ROLES_GESTION_VP` dans `auth/roles.ts` | Contrôlée par `test:invariants` (famille 2), comme les deux autres paliers. **`direction` n'y a pas accès** |
| Calculs | `backend/src/utils/vp.ts` : remplissage par heure, projection, classement, bilan, comparaison par vendeur | Fonctions pures, testées par une suite `test:vp` |

**Côté écrans.** Le sélecteur de campagne de GRID classique exclut les VP. L'interface VP
ne lit que les siennes. Les classements et le tableau des ventes de GRID classique ne
changent pas.

**Ce qui doit être éprouvé par `test:rls`** :
- un admin ne voit, dans une VP, que les vendeurs de son site ;
- un encadrant du site saisit ;
- un encadrant d'un autre site ne voit rien ;
- `direction` ne peut ni créer ni paramétrer une VP ;
- la réaffectation refuse un vendeur hors du site, et une campagne close.

## Questions tranchées (20/10/2026)

1. **RDV réaffecté** : le phoning (classement, objectif) reste à celui qui a pris le
   RDV, la vente va à celui qui reçoit le client.
2. **`direction`** : aucun accès au paramétrage des VP.

## Où on en est

| Lot | État |
|---|---|
| Cadrage et maquette | **fait** — DA et fluidité validées |
| Modèle de données | **fait, sur les deux bases** (20/10/2026) : migration, `auth/roles.ts`, `test:rls` 168, `test:invariants` 15, `comparer` sans écart |
| Interface VP | à faire. **Avant la première VP créée en production**, GRID classique doit exclure les VP (voir `BUGS-CONNUS.md`) |
| Fonctions pures `utils/vp.ts` et `test:vp` | à faire, avec l'interface |

Écart avec la maquette, assumé : la maquette réaffecte vers un vendeur libre à la même
heure. La base, elle, ne vérifie pas que l'heure est libre : GRID accepte deux RDV par
case depuis le 03/09. L'interface proposera les vendeurs libres, et l'agenda signale les
doublons.
