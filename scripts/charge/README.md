# Test de charge GRID (mesure de depart)

Rejouable tel quel apres les correctifs. Il execute le **vrai code du front**
(`services/api.ts`, `campagnes.ts`, `saisie.ts`, `dashboard.ts`, et les fenetres de
`hooks/useRechargementCoalesce.ts`), bundle par esbuild, dans un `worker_thread` par poste.

## Lancer

```bash
# MOT_DE_PASSE = mot de passe des comptes .test (variable d'environnement, jamais en argument)
MOT_DE_PASSE="..." node scripts/charge/lancer.mjs
# options : voir l'en-tete de lancer.mjs, p. ex.
MOT_DE_PASSE="..." node scripts/charge/lancer.mjs --paliers 10x258,25x258 --duree 180 --connexions 0
```

Une seule commande : empreintes avant, preparation, test de connexions simultanees, pre-connexion
cadencee des postes, paliers (postes x RDV/h total), nettoyage, empreintes apres, sante finale.
Secrets lus dans `backend/.env.supabase` et `.env` (jamais affiches). Sorties dans `scripts/charge/out/`
(ignore par git) : `rapport-<run>.json`, `empreinte-avant/apres-<run>.txt`,
`pg_stat_statements-avant-<run>.csv`.

Autres commandes : `preparer`, `nettoyer`, `empreinte`. Si un run est interrompu, `nettoyer`
remet tout en etat (il est idempotent).

## Ce qu'il ecrit en base (Supabase de production, UNIQUEMENT campagne 933 « Octobre 2026 »)

- `relance.utilisateur` : `actif = true` sur `admin.test`, `direction.test`, `encadrant.test`
  (remis a `false` a la fin) ; mot de passe Auth de ces trois comptes (a poser une fois avec
  `MOT_DE_PASSE=... npm --prefix backend run comptes-auth -- admin.test direction.test encadrant.test`).
- `relance.vendeur` / `vendeur_marque` : N vendeurs fictifs `CHARGE nn` (VN, Renault+Dacia, site CARM,
  `date_entree` 01/10/2026 donc invisibles de Juin et Septembre).
- `relance.encadrement_site` : une ligne CARM / `chef_de_vente_vn` -> `encadrant.test` (archivee a la fin ;
  la ligne reste en table, aucun `DELETE` n'est possible).
- `relance.rdv` : amorcage SQL (`amorcer.sql`, par defaut jusqu'a 900 RDV `AMORCAGE CHARGE`, pour que la
  vue d'ensemble ait un volume realiste) puis les RDV poses/modifies/archives par les postes virtuels
  via le vrai `poserRdv` / `modifierRdv` / `archiverRdv`.
- `pg_stat_statements_reset()` : avant le test et apres chaque palier.

Rien n'est ecrit sur les campagnes 1 et 2 ; `empreinte.sql` le prouve (count + md5 avant/apres).

## Nettoyage

`nettoyer.sql` : archive chaque vendeur `CHARGE %` puis le purge par la porte officielle
`relance.vendeur_purger(id, nom)` (supprime aussi ses RDV, donc tous ceux du test), archive
l'encadrement CARM, remet les trois comptes `.test` a `actif = false`.

## Ce qui est emule, et les ecarts connus

- Les postes partagent 3 comptes (`encadrant.test` ~80 %, `admin.test`, `direction.test`) : pas de
  creation de comptes. Le filtre d'echo du temps reel (`auteur === moi`) ne marcherait pas entre postes
  du meme compte ; l'outil compare donc aux RDV ecrits par le poste lui-meme.
- Perimetre : `encadrant.test` voit tous les vendeurs fictifs. Pour emuler un chef de table, un poste
  non administrateur n'est « concerne » (rechargement du perimetre, fenetre 8 s) que par les evenements de
  ses `--perimetre-poste` vendeurs (2 sur 20 par defaut, soit ~10 %). `--perimetre-poste 0` applique le
  filtre reel du front (tous concernes : pire cas). Admin/direction sont toujours concernes.
- Les connexions sont cadencees (`--pacing`, 1 / 10,5 s) pour rester sous la limite d'Auth par IP ; le cas
  « 30 connexions d'un coup » est mesure separement (`--connexions`).
- Le navigateur n'est pas mesure (rendu, JS) ; le temps de chargement initial est celui des requetes.
- Apres un changement de signature dans `services/*` ou `hooks/useRechargementCoalesce.ts`, adapter `poste.ts`.
