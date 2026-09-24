# Prompt de reprise — session suivante

*Réécrit le 24/09/2026, après la session de septembre et le branchement sur ECU.
La version du 03/09 préparait la session de septembre ; elle est dans l'historique git.*

Copier le bloc ci-dessous tel quel au démarrage de la session suivante.

---

Reprise du projet GRID. Lis `CLAUDE.md`, puis dans `ETAT-PROJET.md` les deux
sections **« Où en est le projet »** (en tête) et **« CE QUI RESTE »** (en fin de
fichier), et la première entrée de `BUGS-CONNUS.md`. Pour tout le reste, interroge
d'abord le graphe (`graphify query "…"`) avant de lire des fichiers.

Contexte en trois phrases : GRID est **en ligne** sur
`https://grid.bonyauto-mobile.workers.dev/` — front statique sur Cloudflare Workers,
navigateur attaquant Supabase en direct, **la RLS est la seule barrière
d'autorisation**. La session de septembre s'y est saisie : 1 053 RDV, malgré une
panne le 08/09 (effet de meute du temps réel, corrigé le jour même). Dernier lot de
code le 10/09.

---

## Ce qui appartient à l'utilisateur

Liste tenue à jour dans `ETAT-PROJET.md`, « CE QUI RESTE » — ne pas la recopier ici.
En tête : trois RDV de septembre saisis dans la campagne de juin, et aucune campagne
clôturée.

## Ce qu'il ne faut PAS « corriger »

1. **Les vues `perimetre_saisie` et `rdv_agrege` contournent la RLS**
   (`SECURITY DEFINER`), signalées **CRITICAL** par Supabase. C'est délibéré et
   compensé — détail dans `ETAT-BACKEND.md`.
2. **L'effectif compte la réserve seulement si elle a saisi** — arbitré par
   l'utilisateur le 08/09, consigné « ACCEPTÉ » dans `BUGS-CONNUS.md`.
3. **Le décor de `test:rls` est posé par 2 instructions et non 1** : des triggers
   `BEFORE` lisent d'autres tables du décor, et une CTE modifiante ne voit pas ce
   qu'une branche voisine vient d'insérer.

## Cinq leçons à ne pas réapprendre

- **Une diffusion à N destinataires qui déclenche un rechargement chez chacun est
  quadratique.** Deux onglets en développement ne la montrent pas ; 25 postes en
  session l'ont mise à terre. Toute réaction à un événement diffusé se regroupe et se
  disperse (`hooks/useRechargementCoalesce.ts`).
- **Une fonction d'autorisation citée dans une vue ou une politique s'écrit
  `(SELECT f())`.** Une fonction `STABLE` avec `SET` n'est pas inlinée : appelée à nu,
  elle est évaluée par ligne.
- **Une lecture paginée porte un ordre stable.** `LIMIT/OFFSET` sans `ORDER BY` rend
  le bon *nombre* de lignes et pas les *bonnes*.
- **Une suite de sécurité ne dépend pas des données de production.** Les fixtures se
  **créent**, elles ne se **choisissent** pas.
- **Un pilote de navigateur n'est pas un utilisateur.** Il n'envoie pas les touches
  comme un clavier, et son volet masqué ne mesure pas le mouvement. Un défaut
  d'ergonomie trouvé par automatisation se confirme à la main.
