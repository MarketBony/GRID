> **PÉRIMÉ — 28/08/2026.** Ce document conclut sur Supabase Auth, Cloudflare Pages
> et des crons GitHub. L'hébergement se fait finalement sur le VPS existant, avec
> Supabase comme Postgres managée seulement. Ses vérifications V1 et V2 sont sans
> objet, V3 est réglée (`eu-west-3` = Paris) et V4 est traitée par les workflows
> repris de gearbox. Conservé pour le raisonnement et le journal de décision.
> Voir `ETAT-PROJET.md` et `DEPLOIEMENT.md`.

# Viabilité de l'hébergement gratuit

## 0. Avertissement sur la fiabilité de ce document

Les informations ci-dessous sont datées de **mai 2026**. Les conditions des offres
gratuites changent fréquemment — quotas, régions, politique de mise en veille.

Chaque affirmation porte un niveau de certitude :

- **[HAUTE]** — principe structurel, peu susceptible de changer
- **[MOYENNE]** — valeur chiffrée susceptible d'avoir bougé
- **[À VÉRIFIER]** — décisif pour le projet, doit être confirmé avant de coder

Aucune de ces lignes ne remplace une lecture des CGU au moment où tu déploies.

---

## 1. Architecture retenue

| Couche | Choix | Coût |
|---|---|---|
| Base de données | Supabase (PostgreSQL) — **compte existant** | 0 € |
| Authentification | Supabase Auth, provider Azure / Entra ID | 0 € |
| Hébergement front | Cloudflare Pages | 0 € |
| Maintien en éveil | GitHub Actions (cron quotidien) | 0 € |
| Sauvegarde | Export nocturne via GitHub Actions | 0 € |

Raison du choix de Supabase plutôt qu'une nouvelle base : un compte existe déjà et
porte des bases en production. Introduire un second fournisseur de données double la
surface de maintenance sans bénéfice.

---

## 2. Les quatre vérifications bloquantes

À faire avant d'écrire du code. Trois se règlent dans ton dashboard Supabase.

### V1 — Nombre de projets actifs autorisés en gratuit **[À VÉRIFIER — BLOQUANT]**

Le plan gratuit Supabase limite le nombre de **projets actifs simultanés**
(historiquement 2). **[MOYENNE]**

C'est le point le plus dangereux du projet, précisément parce que tu as déjà des bases.
Si tes projets existants occupent déjà le quota, tu ne pourras pas créer celui-ci en
gratuit — et aucune astuce technique ne contourne ça.

**Vérification :** dashboard Supabase → liste des organisations → compter les projets
actifs sur l'organisation en plan Free.

**Si le quota est atteint, trois issues :**
- créer une seconde organisation gratuite (à confirmer que c'est autorisé)
- héberger cette base dans un projet existant, dans un `schema` PostgreSQL dédié
  (`relance`) plutôt qu'une nouvelle base — techniquement propre, isole les objets,
  ne consomme aucun projet supplémentaire
- passer au plan payant (~25 $/mois par organisation)

La deuxième issue est la plus élégante et devrait être le plan par défaut :
**un schéma `relance` dans un projet existant**. Elle évite le problème plutôt que
de le contourner.

### V2 — Mise en pause après inactivité **[HAUTE sur le principe]**

Les projets gratuits sont mis en pause après une période sans requête (historiquement
7 jours). **[MOYENNE sur la durée]** Le projet ne se réveille pas seul : il faut le
relancer à la main depuis le dashboard.

**Pourquoi c'est un problème ici :** l'outil sert quelques jours par mois pendant les
campagnes. Entre deux campagnes, il dépasse le seuil et se met en pause. Le chef de
table qui ouvre l'app en septembre trouve une erreur de connexion.

**Mitigation :** un cron GitHub Actions qui exécute un `SELECT 1` chaque jour.
Coût : ~30 minutes de runner par mois, sur un quota gratuit de 2 000 minutes pour un
dépôt privé. **[MOYENNE]**

Cette mitigation est fiable mais elle est un point de défaillance : si le cron casse
sans que personne ne le remarque, la pause revient. Prévoir une alerte en cas d'échec.

**Vérification :** confirmer la durée actuelle du seuil, et que le cron suffit à
réinitialiser le compteur (une requête `SELECT` compte-t-elle comme activité ?).

### V3 — Région d'hébergement des données **[À VÉRIFIER]**

Les données contiennent des **noms de clients** — donnée personnelle au sens du RGPD.
La base doit être créée dans une région européenne (Francfort, Paris ou Irlande selon
les régions ouvertes). **[HAUTE sur le principe, MOYENNE sur la liste]**

**Point critique :** la région d'un projet Supabase **ne se change pas après création**.
Si tu retiens l'option « schéma dans un projet existant » de V1, vérifie d'abord dans
quelle région ce projet a été créé. S'il est aux États-Unis, l'option tombe.

### V4 — Sauvegardes **[À VÉRIFIER]**

Le plan gratuit n'offre pas de restauration à un instant donné (PITR) et la profondeur
des sauvegardes automatiques est limitée. **[MOYENNE]**

Pour un outil dont dépendent une trentaine de managers, c'est le vrai trou de l'offre
gratuite — bien plus que les quotas. **Mitigation obligatoire, pas optionnelle :**
export `pg_dump` nocturne via GitHub Actions vers un dépôt privé ou SharePoint.
À implémenter dans le lot 1, pas plus tard.

---

## 3. Ce qui n'est pas un problème : la volumétrie

Le dimensionnement est surabondant d'un facteur ~100. Chiffres établis depuis le fichier
Excel réel :

| Grandeur | Valeur | Limite gratuite | Marge |
|---|---|---|---|
| Vendeurs | 99 | — | — |
| Créneaux par vendeur et par campagne | 110 (5 jours × 11 créneaux × 2 marques) | — | — |
| RDV théoriques max par campagne | 10 890 | — | — |
| RDV réels observés (juin 2026) | ~2 000 | — | — |
| Lignes `rdv` par an (12 campagnes) | ~24 000 | — | — |
| Taille correspondante | ~5 Mo/an | 500 Mo **[MOYENNE]** | ~100 ans |
| Utilisateurs authentifiés | ~30 | 50 000 MAU **[MOYENNE]** | ×1 600 |
| Requêtes/mois | ~50 000 | non plafonné en lecture | — |

Conclusion : les quotas ne seront jamais le facteur limitant. Les seuls risques réels
sont **V1 (quota de projets)**, **V2 (mise en pause)** et **V4 (sauvegardes)**.

---

## 4. Hébergement du front — ce qu'il faut savoir

| Plateforme | Usage commercial en gratuit | Verdict |
|---|---|---|
| **Cloudflare Pages** | Autorisé **[HAUTE]** | **Retenu** |
| **Azure Static Web Apps** | Autorisé, auth Entra ID native **[MOYENNE]** | Alternative sérieuse — vous êtes déjà sur Microsoft |
| Vercel Hobby | **Interdit par les CGU** **[HAUTE]** | À écarter. Ça fonctionnera, et un jour tu recevras un courrier. Plan Pro ~20 $/mois |
| Netlify Free | Zone grise selon les versions des CGU **[FAIBLE]** | À ne pas retenir sans lecture des CGU |

Azure Static Web Apps mérite un examen : l'authentification Entra ID y est intégrée
sans limite de sièges, l'abonnement existe déjà chez vous, et l'IT n'a rien à valider.
Si la vérification V1 impose de toute façon un arbitrage, autant traiter les deux en même temps.

---

## 5. Le point que ce document ne peut pas résoudre

Les offres gratuites n'ont **aucun engagement de service**. Un incident chez le
fournisseur pendant une session de phoning avec trois tables en ligne n'a aucun recours.

Coût du passage en payant, pour référence : ~25 $/mois côté base, ~20 $/mois côté front
si Cloudflare ne convient plus. Soit ~500 €/an pour un outil qui pilote l'activité
commerciale de 19 concessions.

C'est un arbitrage de direction, pas un arbitrage technique. Il est posé ici pour qu'il
soit conscient.

---

## 6. Journal de décision

| Date | Décision | Motif |
|---|---|---|
| — | Supabase plutôt que Cloudflare D1 | Compte et compétence déjà en place |
| — | Cloudflare Pages plutôt que Vercel | CGU Vercel Hobby interdisent l'usage commercial |
| — | Archivage systématique, jamais de suppression physique | Protection de l'historique de campagne |
| — | Aucun agrégat stocké en base | Cause racine de la fragilité du fichier Excel |
| **À trancher** | Projet dédié ou schéma dans un projet existant | Dépend de V1 et V3 |
| **À trancher** | Cloudflare Pages ou Azure Static Web Apps | Dépend de l'appétence IT pour du hors-tenant |
