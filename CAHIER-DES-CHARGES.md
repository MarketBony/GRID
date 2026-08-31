# Cahier des charges — outil de relance téléphonique Groupe Bony

## 1. Contexte et problème résolu

Le Groupe Bony organise des campagnes de relance téléphonique sur 19 concessions
regroupées en 4 plaques. Chaque campagne mobilise 99 vendeurs sur une période de
quelques jours. Les rendez-vous obtenus sont consignés dans un classeur Excel partagé
sur SharePoint, qui remonte les totaux par vendeur, site, plaque et groupe, et produit
des classements.

### Ce qui ne fonctionne plus

Le classeur est structuré en grille : un rendez-vous n'existe pas comme enregistrement
mais comme **position** (onglet, ligne, colonne). Toute l'agrégation consiste à
re-déduire le sens depuis la géométrie. Constats mesurés sur le fichier de juin 2026 :

| Constat | Mesure |
|---|---|
| Références inter-feuilles codées en dur | 677 |
| Cellules à modifier pour changer les dates d'une campagne | 595 |
| Cellules à modifier pour changer les créneaux horaires | 2 178 + réécriture de 269 formules |
| Plage de classement vendeurs | **saturée à 99/99** — le prochain vendeur ajouté disparaît des classements sans erreur |
| Plage de classement concessions | saturée à 19/19 |
| Bugs actifs identifiés | `RANK!S9` et `RANK!S10` affichent un nom de vendeur dans la colonne RDV |
| Effectif par site (`RANK!AG`) | saisi à la main, fausse la moyenne RDV/vendeur dès qu'un vendeur part |

### Objectif

Un outil où **toute variable de structure est éditable dans un formulaire** et où
**aucun agrégat n'est maintenu à la main**.

---

## 2. Vocabulaire

| Terme | Définition |
|---|---|
| **Plaque** | Regroupement géographique de sites. 4 aujourd'hui : CENTRE (alias EAA), NORD, SUD, SUD-OUEST. Une plaque = une session de phoning |
| **Site** | Concession. 19 aujourd'hui. Rattachée à une plaque, rattachement modifiable |
| **Vendeur** | Commercial. Rattaché à un site. Porte ses marques autorisées |
| **Chef de site** | Vendeur ou responsable désigné, droits de saisie sur son site |
| **Table** | Groupe de vendeurs constitué **pour une campagne donnée**, animé par un chef de table, pouvant mélanger des vendeurs de plusieurs sites de la même plaque. Facultatif : une plaque peut fonctionner sans tables |
| **Chef de table** | Animateur d'une table pour une campagne. Peut être un chef de site ou un vendeur |
| **Campagne** | Exercice de relance daté. Porte ses jours et ses créneaux horaires. Les jours sont libres : ni forcément consécutifs, ni forcément ouvrés — la campagne de juin 2026 couvrait un week-end |
| **Session** | Croisement campagne × plaque. Porte le mode d'organisation (par site ou par table) |
| **RDV** | Rendez-vous obtenu. Rattaché à un vendeur, un jour, un créneau, une marque, un type |
| **VN / VO** | Véhicule neuf / véhicule d'occasion |
| **Marque** | Renault, Dacia, Alpine |

---

## 3. Rôles et droits

| Rôle | Peut |
|---|---|
| **Administrateur** | Tout. Seul à pouvoir modifier plaques, sites, vendeurs, campagnes |
| **Chef de plaque** | Composer les tables de sa plaque, saisir sur tous ses sites, voir tous les dashboards |
| **Chef de table** | Saisir les RDV des vendeurs de sa table, voir son classement |
| **Chef de site** | Saisir les RDV des vendeurs de son site |
| **Lecteur** | Consulter les dashboards, aucune saisie. Pour la direction |

Un utilisateur peut porter plusieurs rôles. Les droits de saisie sont **par campagne** :
être chef de table en juin ne donne aucun droit sur la campagne de septembre.

---

## 4. Module A — Administration des référentiels

Écran unique à onglets. C'est ici que se règle l'exigence « 100 % éditable ».

### A1 — Plaques

- **F-A1.1** Créer, renommer, réordonner une plaque
- **F-A1.2** Gérer un libellé alternatif (CENTRE est appelée EAA dans les onglets TABLES)
- **F-A1.3** Archiver une plaque. Interdit si elle porte des sites actifs — proposer de les réaffecter d'abord

### A2 — Sites

- **F-A2.1** Créer, renommer un site ; gérer son code court (CLF, MOZ, VNVOCL…)
- **F-A2.2** **Changer le rattachement à une plaque**, y compris pour un site portant de l'historique
- **F-A2.3** Archiver un site
- **F-A2.4** Créer un site sans vendeur (l'onglet `MDP` du fichier source est dans ce cas)

### A3 — Vendeurs

- **F-A3.1** Créer, renommer, rattacher à un site
- **F-A3.2** Cocher les marques autorisées : Renault, Dacia, Alpine, indépendamment
- **F-A3.3** Marquer comme chef de site
- **F-A3.4** Désactiver avec une date de sortie. Le vendeur disparaît des classements courants, son historique reste intact
- **F-A3.5** Transférer un vendeur d'un site à un autre en conservant son historique
- **F-A3.6** Import en masse par collage depuis Excel

### A4 — Campagnes

- **F-A4.1** Créer une campagne : libellé, date de début, date de fin
- **F-A4.2** **Choisir les jours retenus** — pas nécessairement consécutifs, pas nécessairement 5
- **F-A4.3** **Définir les créneaux horaires** — liste ordonnée, longueur libre
- **F-A4.4** Dupliquer une campagne précédente avec ses tables, en décalant les dates
- **F-A4.5** Définir, par plaque, le mode : `par_site` ou `par_table`
- **F-A4.6** Clôturer une campagne : plus de saisie, dashboards figés

### Règles

- **R-A.1** Aucune suppression physique. Tout est archivage. L'interface affiche le volume d'historique rattaché avant confirmation
- **R-A.2** Modifier les jours ou créneaux d'une campagne portant déjà des RDV n'est possible qu'après confirmation explicite listant les RDV qui deviendraient orphelins. L'utilisateur choisit : annuler, ou déplacer les RDV concernés
- **R-A.3** Aucune modification de référentiel ne recalcule quoi que ce soit : tous les agrégats sont calculés à la lecture

---

## 5. Module B — Constructeur de tables

Disponible pour une plaque en mode `par_table`.

- **F-B.1** Créer, renommer, supprimer une table dans une session
- **F-B.2** Désigner le chef de table parmi les vendeurs et chefs de site de la plaque
- **F-B.3** Affecter les vendeurs par glisser-déposer entre la réserve « non affectés » et les tables
- **F-B.4** Un vendeur ne peut appartenir qu'à une seule table par campagne
- **F-B.5** **Répartition automatique** : algorithme glouton, remplissage de la table la moins chargée, respect des marques quand la table est spécialisée. Graine fixée à **42** — le résultat doit être reproductible et donc contestable
- **F-B.6** Définir un effectif cible par table et alerter en cas d'écart
- **F-B.7** Reprendre la composition de la campagne précédente en un clic
- **F-B.8** Les vendeurs non affectés à une table restent saisissables par leur chef de site

### Règle

- **R-B.1** Une table ne peut contenir que des vendeurs de sa propre plaque

---

## 6. Module C — Planning de saisie

**C'est le cœur de l'outil.** Le chef de table y passe la durée de la session, souvent
avec un casque sur les oreilles. Toute friction s'y paie au centuple.

### Écran

Deux zones. À gauche, la liste des vendeurs de la table avec leur compteur de RDV. À
droite, le planning du vendeur sélectionné : les **jours de la campagne en colonnes**,
les **créneaux en lignes**, un sélecteur Renault / Dacia / Alpine limité aux marques
autorisées du vendeur.

### Exigences

- **F-C.1** Cliquer un nom dans la liste ouvre son planning **sans rechargement de page**
- **F-C.2** Cliquer une case vide ouvre la saisie du nom du client, au clavier, sans souris
- **F-C.3** `Entrée` valide et passe à la case suivante. `Échap` annule
- **F-C.4** Enregistrement immédiat, sans bouton « Sauvegarder ». Indicateur d'état discret
- **F-C.5** Les compteurs de gauche et le total de la table se mettent à jour à chaque saisie
- **F-C.6** Modifier ou supprimer un RDV depuis sa case
- **F-C.7** Navigation clavier complète dans la grille (flèches, Tab)
- **F-C.8** Naviguer d'un vendeur au suivant sans repasser par la liste
- **F-C.9** Fonctionner sur tablette : cases assez larges pour le doigt
- **F-C.10** Deux chefs de table qui saisissent en même temps ne se bloquent pas et voient les compteurs de l'autre se mettre à jour
- **F-C.11** Chaque RDV enregistre qui l'a saisi et quand

### Règles

- **R-C.1** Un vendeur ne peut recevoir un RDV que sur une marque qu'il est autorisé à vendre
- **R-C.2** Une case = un RDV. Deux RDV sur le même créneau exigent une confirmation
- **R-C.3** Aucune saisie possible sur une campagne clôturée
- **R-C.4** Un chef de table ne voit que les vendeurs de sa table pour la campagne en cours

---

## 7. Module D — Dashboard

- **F-D.1** Totaux par vendeur, site, plaque, groupe, ventilés VN / VO et par marque
- **F-D.2** Classements : sites, vendeurs, tables. Global, VN, VO
- **F-D.3** Moyenne RDV par vendeur et par site, **effectif calculé et non saisi**
- **F-D.4** Départage des ex æquo déterministe et documenté
- **F-D.5** Comparaison avec une campagne antérieure au choix (le fichier actuel fait ça à la main : « mars : 351 »)
- **F-D.6** Vue par table quand la plaque est en mode `par_table`, par site sinon
- **F-D.7** Export Excel du dashboard et du détail des RDV
- **F-D.8** Rafraîchissement automatique pendant une session, pour affichage sur écran collectif

---

## 8. Lotissement

| Lot | Contenu | Condition d'entrée |
|---|---|---|
| **0** | Corriger l'Excel existant : bugs `RANK!S9/S10`, extension des plages saturées, `NB_VEND` calculé, purge des résidus | À faire immédiatement si une campagne est imminente |
| **1** | Schéma, RLS, seed des référentiels, sauvegarde nocturne, maintien en éveil | V1 à V4 de `VIABILITE-FREEMIUM.md` validées |
| **2** | Module A — administration | Lot 1 |
| **3** | Module C — planning de saisie | Lot 2 |
| **4** | Module B — constructeur de tables | Lot 3 |
| **5** | Module D — dashboard | Lot 3 |
| **6** | Double saisie sur une campagne réelle, puis arrêt de l'Excel | Lots 2 à 5 |

Le lot 3 avant le lot 4 est délibéré : la saisie est le cœur, les tables sont un
raffinement. Une plaque sans tables doit pouvoir utiliser l'outil dès le lot 3.

---

## 9. Hors périmètre v1

Explicitement exclus, à ne pas anticiper dans le code :

- Les fichiers de ciblage et listes d'appel (produits par un pipeline séparé)
- L'issue du rendez-vous : venu, non venu, vendu
- L'intégration au CRM
- Les données clients au-delà du nom saisi dans la case
- L'application mobile native
- Le mode hors ligne

---

## 10. Critères de recette

L'outil remplace l'Excel quand, sur une campagne réelle :

1. Ajouter un vendeur prend moins de 30 secondes et il apparaît dans tous les classements
2. Changer les jours d'une campagne prend moins de 30 secondes et les 99 plannings suivent
3. Un chef de table saisit 20 RDV en moins de 3 minutes
4. Les totaux de l'outil et ceux du fichier Excel concordent à l'unité sur la campagne de double saisie
5. Trois chefs de table saisissent simultanément sans conflit ni perte
6. Aucun agrégat n'est stocké en base
