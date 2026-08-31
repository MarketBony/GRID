# Modèle de données

## 1. Principe directeur

Le fichier Excel traite un rendez-vous comme une **position** : onglet `CLF`, ligne 8,
colonne `D` signifie « Parpinelli, Renault, vendredi 12, 10h-11h ». Le sens est porté
par la géométrie, et 677 formules servent à le reconstituer.

Ici, un rendez-vous est une **ligne** qui porte son sens. Rien n'est déduit d'une
position, donc rien ne casse quand la structure bouge.

```
plaque (4)
  └── site (19)              plaque_id modifiable
        └── vendeur (99)     marques autorisées, date_sortie

campagne                     jours + créneaux = données, pas du code
  ├── campagne_jour (n)
  ├── campagne_creneau (n)
  └── session (campagne × plaque)     mode = par_site | par_table
        └── table_phoning (0..n)
              └── affectation (table × vendeur)
                    └── rdv
```

## 2. Les cinq décisions structurantes

### 2.1 L'affectation à une table est une relation, pas un attribut

Une première version du modèle portait `table_id` sur `vendeur`. **C'était faux.** Les
tables sont recomposées à chaque campagne : un vendeur en table 1 en juin peut être en
table 3 en septembre. Avec un attribut, monter les tables de septembre écrasait la
composition de juin et l'historique devenait illisible.

D'où `affectation (table_id, vendeur_id)`, où `table_phoning` appartient à une `session`
qui appartient à une `campagne`. L'unicité « un vendeur, une seule table par campagne »
n'est donc pas exprimable en index unique — elle passe par un trigger.

### 2.2 Le rdv ne connaît ni son site ni sa plaque

Il connaît son vendeur. Site, plaque, marques autorisées : tout se joint. C'est ce qui
permet de **changer le rattachement d'un site à une autre plaque** sans toucher une
ligne de données : les agrégats des deux plaques suivent immédiatement.

Corollaire dans le code : ne jamais dupliquer `site_id` ou `plaque_id` sur `rdv`, même
« pour optimiser ». La table fait 24 000 lignes par an.

### 2.3 Les jours et créneaux sont des lignes

`campagne_jour` et `campagne_creneau` remplacent les 595 cellules d'en-tête et les
2 178 cellules de créneaux du fichier Excel. Le planning de saisie construit ses
colonnes et ses lignes depuis ces deux tables.

Les clés étrangères composites sur `rdv` — `(campagne_id, jour)` et
`(campagne_id, creneau_code)` — font que supprimer un jour portant des RDV **échoue en
base**. L'interface doit donc traiter le cas explicitement (règle R-A.2) plutôt que de
créer des orphelins silencieux.

### 2.4 Le mode d'organisation est porté par la session, pas par la plaque

Vérifié sur les données de juin 2026 : CENTRE et SUD utilisent des tables, NORD et
SUD-OUEST non. Et rien ne dit que ce sera pareil en septembre.

`session.mode` permet à chaque plaque de changer de mode d'une campagne à l'autre, sans
que le choix de juin contamine celui de septembre.

### 2.5 Aucun agrégat n'est stocké

Pas de colonne `total_rdv`, pas de table de synthèse. Les vues `v_total_vendeur` et
`v_total_site` calculent tout à la lecture.

Le cas d'école est l'effectif par site : dans le fichier Excel, `RANK!AG` est saisi à
la main (2, 7, 11, 6, 6, 4, 4, 7, 3, 16, 3, 5, 3, 9…). Dès qu'un vendeur part sans que
quelqu'un décrémente, la moyenne RDV/vendeur est fausse et personne ne le voit.
Ici : `count(distinct vendeur) where date_sortie is null`.

## 3. Départage des ex æquo dans les classements

Le fichier Excel utilise `valeur - ROW()/1000000` pour forcer un ordre unique. C'est
ingénieux et parfaitement illisible : le rang dépend du numéro de ligne, donc de
l'ordre dans lequel les vendeurs ont été ajoutés au fichier.

Règle retenue, à appliquer partout :

```sql
order by total desc, vn desc, nom asc
```

Déterministe, indépendante de l'ordre d'insertion, et explicable à un vendeur qui
contesterait sa place.

## 4. Répartition automatique des tables

Algorithme glouton à graine fixe :

1. Trier les vendeurs non affectés par site, puis par nom (ordre stable)
2. Mélanger avec une graine de **42**
3. Pour chacun, l'affecter à la table de sa plaque ayant le moins de membres
4. À égalité de charge, prendre la table de plus petit `ordre`
5. Si les tables sont spécialisées par marque, ne considérer que les tables compatibles

La graine fixe n'est pas un détail : elle rend le résultat reproductible, donc
vérifiable, donc contestable. Un chef de plaque qui trouve la répartition injuste doit
pouvoir la rejouer à l'identique.

## 5. Ce que le seed contient, et ce qui manque

Extrait de `tableau_phoning_reltel_JUIN_(2).xlsx` :

| Donnée | Volume | Fiabilité |
|---|---|---|
| Plaques | 4 | Sûre — onglet `SUIVI` |
| Sites et rattachement à une plaque | 19 | Sûre — onglets `SUIVI` et `RÉSULTATS` |
| Vendeurs et leur site | 99 | Sûre — blocs des 19 onglets site |
| Tables de juin et leur composition | 8 tables, 48 vendeurs | Sûre — chaînes `TABLES` → `RÉSULTATS` → onglet site, résolues intégralement |
| Jours et créneaux de juin | 5 jours, 11 créneaux | Sûre — onglet `CLF` |
| **Marques autorisées par vendeur** | — | **ABSENTE DU FICHIER** |

### Le trou à combler avant la mise en service

Le fichier Excel donne à **tous** les vendeurs une section Renault et une section Dacia,
y compris à ceux qui ne vendent qu'une marque. La capacité réelle par vendeur n'y est
donc pas.

Le seed pose un placeholder `renault = true, dacia = true` (et `alpine` seul pour le
site Alpine). **Tant que ce n'est pas corrigé site par site, la règle R-C.1 ne protège
rien** : n'importe quel RDV Dacia passera sur un vendeur exclusivement Renault.

À traiter en priorité au lot 1.

### Deux observations à trancher

- **Les 8 chefs de table ne figurent pas parmi les 99 vendeurs** (Séverine Besson,
  Thierry Coignac, Lucien Marchetti, JF Larget, Mickael Masson, Franck Nogues,
  Jérôme Hébert, Gilles Parrain). Ce sont des encadrants sans bloc de saisie. Le modèle
  le permet via `table_phoning.chef_user_id`, mais il faut confirmer qu'ils ne doivent
  jamais recevoir de RDV en propre.
- **L'onglet `MDP` est vide.** Site à venir ou résidu ? La ligne correspondante est
  commentée dans le seed.
