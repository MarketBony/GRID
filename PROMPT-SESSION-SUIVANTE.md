# Prompt de reprise — session suivante

*Réécrit le 02/10/2026, après la livraison de la création de campagne. Les versions
précédentes sont dans l'historique git.*

---

## Où on en est, au 02/10/2026 au soir

- GRID est **en ligne** : `https://grid.bonyauto-mobile.workers.dev/`. Le front est
  statique sur Cloudflare Workers, le navigateur attaque Supabase en direct, et
  **la RLS est la seule barrière d'autorisation**.
- Juin (1 110 RDV) et septembre (1 053 RDV) sont **clôturées** par l'utilisateur. Les
  3 RDV de septembre saisis dans juin restent où ils sont : c'est arbitré.
- **Session phoning d'octobre le 06/10/2026.** Le bouton « Nouvelle campagne »
  (`relance.campagne_creer`) est en production depuis le 02/10 et vérifié de bout en
  bout sur Supabase. Détail : `ETAT-PROJET.md`, section du 02/10.
- `master` = `origin/master`. Les branches `chore/docs-reprise-24-09` et
  `feat/creer-campagne` sont fusionnées.

## Ce qui reste, dans l'ordre

1. **Créer « Octobre 2026 »**. C'est la première utilisation réelle du bouton.
   Libellé et dates à demander à l'utilisateur. Puis vérifier les jours et composer
   les tables de CENTRE et SUD (onglet Tables).
2. **`test:garde-fous` 34/39 sur Supabase** (39/39 en local). La suite s'appuie sur la
   vraie campagne de juin, désormais clôturée. Remède : des données d'essai créées
   dans la transaction de chaque contrôle, comme `poserDecor` dans `tester-rls.ts`.
   Voir `BUGS-CONNUS.md`, en tête. À faire **après** la session du 06/10.
3. **F-A4.4** — dupliquer une campagne avec ses tables : pas fait.
4. L'utilisateur a annoncé un **« gros chantier »** pour GRID (« nouvelle
   dimension »). Il n'est pas encore décrit : le lui demander.
5. Les gestes qui appartiennent à l'utilisateur : `ETAT-PROJET.md`, « CE QUI RESTE ».

## Méthode — ce qui n'est pas dans CLAUDE.md

- **ECU / graphify.** GRID est branché sur ECU, le graphe de connaissance des projets
  Bony (`C:\Users\Operateur\Documents\ECU`, mode d'emploi `NOUVEAU-PROJET-BONY.md`).
  - Avant de grepper ou de lire des fichiers, interroger le graphe :
    `graphify query "…"`, `graphify explain "Symbole"`. Il faut d'abord
    `$env:PATH = "$env:USERPROFILE\.local\bin;$env:PATH"`.
  - Le hook `post-commit` régénère `graphify-out/` (exclu de git).
  - **Ne jamais commiter dans le dépôt ECU** depuis GRID.
  - Une passe documents (`/graphify .`) coûte environ 20 000 tokens par fichier :
    donner le coût et demander avant de la lancer.
- **Le front de développement (`npm run dev`) attaque Supabase EN PRODUCTION**
  (`.env`), pas la base locale. Une migration doit donc être en production avant
  tout test au navigateur. Et une campagne ne se supprime pas (interdit n°1) :
  jamais de campagne « test » en production.
- **Les ports 5432/6543 sont de nouveau bloqués depuis le bureau** (mesuré le 02/10 :
  seul le 443 passe). Les migrations et les suites sur Supabase se jouent en partage
  de connexion 4G. Aucun jeton `sbp_` n'est stocké sur le poste.
- **`origin/master` avance sans nous** : le bot de sauvegarde y pousse un dump chaque
  semaine. Faire un `git fetch` avant de fusionner dans `master`.
- **PowerShell 5.1** : `git commit -F -` avec un here-string échoue. Écrire le
  message dans un fichier temporaire, depuis le shell Bash.
- **psql** : `C:\Program Files\PostgreSQL\17\bin\psql.exe` (absent du PATH Bash).
  Retirer `?schema=relance` de `DIRECT_URL` avant de le passer à psql.

## Ce qu'il ne faut PAS « corriger »

1. Les vues `perimetre_saisie` et `rdv_agrege` en `SECURITY DEFINER`, signalées
   CRITICAL par Supabase : c'est délibéré (voir `ETAT-BACKEND.md`).
2. L'effectif ne compte la réserve que si elle a saisi : « ACCEPTÉ » dans
   `BUGS-CONNUS.md`.
3. Le décor de `test:rls` posé en 2 instructions et non en 1.
