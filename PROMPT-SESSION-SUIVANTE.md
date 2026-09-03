# Prompt de reprise — session suivante

*Écrit le 03/09/2026, après le lot « deux RDV par case + hygiène des droits ».*

Copier le bloc ci-dessous tel quel au démarrage de la session suivante.

---

Reprise du projet GRID. Lis `CLAUDE.md`, puis `ETAT-PROJET.md` (section **« CE QUI
RESTE »**, vers la fin) et `BUGS-CONNUS.md` (les deux premières sections). Ne relis
pas le reste : tout ce dont tu as besoin y est.

Contexte en trois phrases : GRID est **en ligne et opérationnel** sur
`https://grid.bonyauto-mobile.workers.dev/`, front statique sur Cloudflare, navigateur
attaquant Supabase en direct, **la RLS est la seule barrière d'autorisation**. Les
1107 RDV de juin sont en base et se recoupent à l'unité avec le classeur Excel, et le
module C affiche désormais le même chiffre. Les six suites sont vertes sur les deux
bases (39/39 · 89/89 · 10/10 · 27/27 · 20/20 · 19/19), `comparer` ne rend aucun écart.

**Il ne reste aucun travail bloquant pour la session de septembre.** Ce qui suit est
donc à trancher, pas à exécuter tête baissée : commence par me dire ce que tu ferais
en premier et pourquoi, avec les chiffres.

---

## Ce qui appartient à l'utilisateur, et que personne d'autre ne peut faire

Ces trois points ne sont pas du code. Ils étaient déjà en attente le 01/09 et le
03/09 ; les rappeler en fin de session ne suffit visiblement pas.

1. **Leaked Password Protection** — Supabase → *Authentication* → *Policies*. Un
   interrupteur. Compare les mots de passe à HaveIBeenPwned.
2. **Une copie de sauvegarde hors du dépôt.** Le dump hebdomadaire de `backup.yml`
   vit *dans* le dépôt : si le dépôt disparaît, la sauvegarde disparaît avec lui.
   C'est le seul point de la liste qui puisse coûter les données.
3. **Rotation des trois secrets exposés en conversation** : jeton `sbp_` (il ouvre le
   compte entier, gearbox compris), clé `sb_secret_`, mot de passe de la base.

## Les candidats, par ordre de valeur décroissante à mon sens

### a. L'Edge Function `gerer-comptes` — le seul trou fonctionnel connu

`services/utilisateurs.ts` l'appelle déjà pour **créer un compte**, **réinitialiser un
mot de passe** et **supprimer une identité**. Les trois échouent tant qu'elle n'est
pas écrite et déployée. Le reste de l'écran Comptes fonctionne (PostgREST + RPC).

En attendant, `npm --prefix backend run comptes-auth` fait le travail en ligne de
commande — donc ce n'est pas bloquant, mais c'est la dernière chose qui oblige à
ouvrir un terminal pour administrer le produit.

### b. Les marques des vendeurs VN sont encore un placeholder

Conséquence exacte, et elle est chiffrée : **R-C.1 ne protège pas les VN.** Le trigger
`rdv_marque_autorisee` fonctionne et il est testé, mais il autorise tout, puisque les
72 vendeurs VN sont tous déclarés bi-marque par le seed. N'importe quel RDV Dacia
passera sur un vendeur exclusivement Renault.

L'outil de correction existe (écran Vendeurs, import par collage, grille de cochage).
Ce n'est pas du code à écrire, c'est une donnée à fournir — vendeur par vendeur, et
elle ne se devine pas depuis le classeur : celui-ci donne une **activité**
(`REN 0 / DAC 20`), pas une **autorisation**.

### c. Les dates de la campagne de septembre 2026

Le seed pose du jeudi 10 au lundi 14 septembre, **par analogie avec juin, donc
inventées**. À confirmer ou corriger dans l'écran Campagnes — ce qui est aussi le
critère de recette n°2 : changer les jours d'une campagne doit prendre moins de
30 secondes et les 99 plannings doivent suivre. Aujourd'hui, 03/09, la session est
dans une semaine.

### d. Le pixel de la grille

Une ligne du planning fait 38,39 px si elle est vide et 39,41 px dès qu'elle contient
un nom (`.client` a un interligne de 2,4 rem, et une cellule de tableau compte sa
bordure dans sa `height`). Sur 11 créneaux, le rythme vertical peut donc dériver d'une
dizaine de pixels selon le remplissage.

Le remède tient en une ligne — `.client { line-height: 2.3rem }` — mais il change le
centrage vertical de **chaque nom du module C**, l'écran le plus sensible du produit.
C'est pour ça qu'il n'a pas été appliqué sans demander. Détail dans `BUGS-CONNUS.md`.

### e. Deux RDV d'essai archivés en septembre

`ESSAI PREMIER` / `ESSAI SECOND`, sur JEROME SABIN, 10/09 8h-9h. Laissés par la
vérification au clavier de `Ctrl+Entrée` le 03/09. **Archivés, donc comptés nulle
part** ; l'interdit n°1 empêche de les supprimer autrement que par la porte de purge.
À traiter seulement si leur présence gêne.

---

## Ce qu'il ne faut PAS « corriger »

Trois écarts sont **assumés et documentés**. Lis le pourquoi avant d'y toucher.

1. **Les vues `perimetre_saisie` et `rdv_agrege` contournent la RLS**
   (`SECURITY DEFINER`), signalées **CRITICAL** par Supabase. C'est délibéré :
   `rdv_agrege` sert les compteurs publics du tableau de bord sans colonne `client`, et
   `perimetre_saisie` calcule **l'autorisation elle-même** — en mode `invoker`, une
   politique restrictive future rétrécirait silencieusement le périmètre de quelqu'un.
   Les deux portent leur propre filtre `utilisateur_courant() IS NOT NULL`, et
   `test:rls` a trois contrôles dédiés à ce scénario. Détail dans `ETAT-BACKEND.md`.

2. **Les ports 5432/6543 sont bloqués par intermittence** depuis le poste du bureau.
   **Mesure avant de conclure à une panne** — ils répondaient le 31/08, plus le 01/09,
   puis de nouveau le 03/09. Le 443 passe toujours : `importer-rdv-juin.ts` montre
   comment écrire par PostgREST quand Prisma ne peut pas se connecter.

3. **Le décor de `test:rls` est posé par 2 instructions et non 1.** Ce n'est pas une
   optimisation laissée en chemin : `encadrement_site` et `affectation` portent six
   triggers `BEFORE` qui lisent d'autres tables du décor, et dans une instruction à
   CTE modifiantes une branche ne voit pas ce qu'une branche voisine vient d'insérer.
   Les réunir ferait juger quatre garde-fous sur un monde qu'ils ne voient pas.

## Quatre leçons à ne pas réapprendre

- **Une lecture paginée porte un ordre stable.** `LIMIT/OFFSET` sans `ORDER BY` rend le
  bon *nombre* de lignes et pas les *bonnes* : le contrôle de volume passe au vert
  pendant que les totaux sont faux. Constaté en vrai sur les 1107 RDV.
- **Un typecheck vert ne prouve rien sur le contrat de l'API.** PostgREST rend un
  tableau pour un embed enfant, jamais `null` — et `[]` est vrai en JavaScript. Une
  déclaration TypeScript fausse est un mensonge que le compilateur valide.
- **Une suite de sécurité ne dépend pas des données de production.** Les fixtures se
  **créent**, elles ne se **choisissent** pas.
- **Un pilote de navigateur n'est pas un utilisateur.** Vérifié une fois de plus le
  03/09 : le pilote n'envoie ni `Return` ni `Up` comme le clavier envoie `Enter` et
  `ArrowUp`. Deux fausses pistes en découlent immédiatement — on croit que
  l'application n'enregistre pas, alors que la touche n'est jamais arrivée. Avant de
  poursuivre un défaut d'ergonomie clavier trouvé par automatisation, le faire
  confirmer à la main.
