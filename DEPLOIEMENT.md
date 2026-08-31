# DEPLOIEMENT — GRID sur le VPS

Mise a jour : 31/08/2026. Ecrit APRES reconnaissance du serveur, pas de memoire.

---

## Etat constate du VPS, le 31/08/2026

Releve en lecture seule. C'est la base de tout ce qui suit.

| | |
|---|---|
| Hote | `vps-58e5eff3.vps.ovh.net` — `51.83.75.181` / `2001:41d0:367:827::1` |
| OS | Ubuntu 26.04 LTS, en service depuis 53 jours |
| Ressources | 8 vCPU, 22 Gio de RAM (1,1 Gio utilises), 184 Gio libres sur 193 |
| Docker | 29.6.1, Compose v5.3.1 |
| Utilisateur | `ubuntu`, `sudo` sans mot de passe, **pas** dans le groupe `docker` |
| Ports ecoutes | 22 (sshd), 80 et 443 (`docker-proxy` → `gearbox-caddy-1`) |
| Postgres | **aucun** sur la machine. Gearbox utilise Supabase |
| Cron | vide, pour `ubuntu` comme pour `root` |

Gearbox, projet compose `gearbox`, defini par `/home/ubuntu/gearbox/docker-compose.yml` :

| Conteneur | Image | Role |
|---|---|---|
| `gearbox-caddy-1` | `caddy:2-alpine` | **tient 80 et 443**, config `/home/ubuntu/gearbox/Caddyfile` en montage lie |
| `gearbox-api-1` | `gearbox-api` | port 3000, interne |
| `gearbox-web-1` | `gearbox-web` | port 80, interne |

Reseau `gearbox_app-network`. Volumes `gearbox_caddy_data`, `gearbox_caddy_config`,
`gearbox_uploads_data`.

**La marge est confortable** : GRID ajoute trois conteneurs dont un Postgres, sur une
machine qui utilise 1,1 Gio de 22 et 5 % de son disque.

---

## Ce qui garantit que gearbox n'est pas entrave

L'exigence est explicite : *« Je ne veux qu'il ne soit en aucun cas mele a Gearbox et
qu'il entrave son fonctionnement. »* Voici, point par point, ce qui la tient — et le
seul endroit ou elle ne peut pas etre tenue a 100 %.

| Ressource | Separation |
|---|---|
| Conteneurs | projet compose `grid` → `grid-db-1`, `grid-api-1`, `grid-web-1`. Aucun nom partage |
| Volumes | `grid_db_data`. Les volumes de gearbox ne sont ni lus ni montes |
| Base de donnees | conteneur a nous, sur un reseau **prive** (`grid_interne`), **sans aucun port publie**. Ni gearbox ni l'internet ne peuvent l'atteindre |
| Fichiers | tout dans `/home/ubuntu/grid/`. Le `docker-compose.yml` de gearbox n'est pas modifie |
| Deploiements | un `docker compose up` sur GRID ne touche aucun conteneur de gearbox, et l'inverse est vrai |

### Le seul point de contact : le port 443

Un seul processus peut ecouter 443, et c'est `gearbox-caddy-1`. GRID doit donc passer par
lui. Deux consequences, et **rien de plus** :

1. **Une ligne ajoutee a son `Caddyfile`** — le contenu de `grid.caddy`. Les blocs de site
   de Caddy sont independants : un bloc ajoute ne peut pas modifier le comportement d'un
   autre.
2. **`grid-api` et `grid-web` rejoignent `gearbox_app-network`**, declare `external` dans
   notre compose. Gearbox n'en sait rien et son fichier n'est pas touche. Notre base, elle,
   n'est PAS sur ce reseau.

Deux garde-fous sur ce point de contact :

- **`caddy reload` valide avant d'appliquer.** Si le bloc de GRID est mal ecrit, Caddy
  refuse, dit pourquoi, et **continue de servir gearbox avec l'ancienne configuration**.
  On n'utilise donc jamais `restart`, qui couperait gearbox le temps du redemarrage et
  pour de bon si la config etait invalide.
- **Le `Caddyfile` est sauvegarde horodate avant d'etre touche**, avec un retour arriere
  d'une ligne (etape 6).

### Le piege evite, qui aurait casse gearbox

Sur un reseau Docker, chaque service porte **son nom comme alias DNS**. Gearbox a deja
`api` et `web` sur `gearbox_app-network`. Nommer nos services `api` et `web` aurait rendu
ces deux noms ambigus : Docker aurait repondu deux adresses en alternance, et le Caddy de
gearbox aurait proxifie **une requete sur deux vers GRID**. D'ou `grid-api` et `grid-web`.

Le controle est a l'etape 5, et il est a faire.

---

## Prealable qui n'est pas de notre ressort

**L'enregistrement DNS `grid.bonyauto-mobile.com` n'existe pas** (verifie le 31/08/2026 :
`Non-existent domain`). A creer chez le registrar, comme `gearbox` :

```
grid.bonyauto-mobile.com.   A      51.83.75.181
grid.bonyauto-mobile.com.   AAAA   2001:41d0:367:827::1
```

**A faire AVANT l'etape 6.** Caddy demande le certificat des la premiere requete sur le
domaine, et Let's Encrypt limite le nombre de tentatives echouees par domaine et par
heure. Demander un certificat pour un domaine qui ne resout pas grille ce quota pour
rien.

Verification, depuis n'importe quelle machine :

```bash
nslookup grid.bonyauto-mobile.com
```

---

## Deploiement

Toutes les commandes se lancent depuis `/home/ubuntu/grid` sur le VPS, en `ubuntu`.
`ubuntu` n'est pas dans le groupe `docker` : **`sudo` devant chaque `docker`**.

### 1. Cloner

```bash
ssh ubuntu@51.83.75.181
git clone https://github.com/MarketBony/GRID.git /home/ubuntu/grid
cd /home/ubuntu/grid
```

Le depot est prive : `git clone` demandera un identifiant. Utiliser un **jeton d'acces
personnel** avec la portee `repo` comme mot de passe (le mot de passe GitHub ne fonctionne
plus pour git depuis 2021).

### 2. Le fichier `.env`

```bash
cp .env.example .env
nano .env
```

Quatre lignes a decommenter et renseigner, et rien d'autre :

```
DOMAIN=grid.bonyauto-mobile.com
POSTGRES_PASSWORD=<openssl rand -base64 24>
JWT_SECRET=<openssl rand -hex 32>
RETENTION_JOURS=30
```

Generer les deux secrets sur le VPS :

```bash
echo "POSTGRES_PASSWORD=$(openssl rand -base64 24)"
echo "JWT_SECRET=$(openssl rand -hex 32)"
```

**Ces valeurs ne sont ecrites que la.** `.env` est dans `.gitignore` — verifie. Le mot de
passe Postgres n'a pas a etre memorise : rien ne s'y connecte a la main, la base ne publie
aucun port.

`JWT_SECRET` de production **doit differer** de celui de developpement : le changer
deconnecte tout le monde, et c'est le seul moyen de revoquer tous les jetons en bloc.

### 3. Construire et demarrer, SANS toucher a Caddy

```bash
sudo docker compose up -d --build
```

L'API joue `prisma migrate deploy` a son demarrage, puis refuse de demarrer si les listes
de roles du code et les contraintes CHECK de la base divergent
(`utils/verifierInvariants.ts`). Un conteneur qui ne monte pas est un signal.

```bash
sudo docker compose ps
sudo docker compose logs grid-api --tail 40
```

Attendu : trois conteneurs `Up`, `grid-db-1` en `healthy`, et dans les journaux de l'API
les 13 migrations appliquees puis l'ecoute sur 3001.

**Gearbox est intact a ce stade** — rien ne l'a touche. Le verifier :

```bash
curl -sI https://gearbox.bonyauto-mobile.com | head -1
```

### 4. Semer la base

La base de production nait **vide**. Sans le seed, aucun compte n'existe et personne ne
peut se connecter.

```bash
sudo docker compose exec grid-api npx tsx prisma/seed.ts
```

Attendu : 3 marques, 4 plaques, 19 sites, 99 vendeurs, 196 `vendeur_marque`, 2 campagnes,
8 tables, 48 affectations, et **un mot de passe affiche UNE SEULE FOIS** pour le compte
`admin`. Le noter immediatement : il n'est stocke nulle part.

Si le mot de passe a ete perdu :

```bash
sudo docker compose exec -e MOT_DE_PASSE='...' grid-api npx tsx prisma/mot-de-passe.ts admin
```

Les cinq comptes suffixes `.test` **ne doivent jamais exister sur le serveur** :
`comptes-test.ts` n'est pas dans l'image (`.dockerignore`), c'est le seul moyen sur de
tenir la regle.

### 5. Le controle qui protege gearbox

**A faire avant de toucher au Caddyfile.** On verifie que les noms DNS de gearbox n'ont
pas ete rendus ambigus par l'arrivee de GRID sur son reseau :

```bash
sudo docker compose -p gearbox exec caddy sh -c \
  'nslookup api 2>/dev/null | tail -6; echo ---; nslookup web 2>/dev/null | tail -6'
```

**Attendu : UNE seule adresse par nom.** Deux adresses pour `api` ou `web` veut dire
qu'un service de GRID porte le meme nom qu'un service de gearbox : ne pas continuer,
arreter GRID (`sudo docker compose down`), corriger les noms de services, recommencer.

Et dans l'autre sens, nos deux noms doivent resoudre :

```bash
sudo docker compose -p gearbox exec caddy sh -c \
  'nslookup grid-api 2>/dev/null | tail -4; echo ---; nslookup grid-web 2>/dev/null | tail -4'
```

### 6. Brancher le domaine — l'etape qui touche gearbox

Le DNS de l'etape « prealable » doit resoudre. Sinon, s'arreter la.

**Sauvegarder d'abord :**

```bash
cp /home/ubuntu/gearbox/Caddyfile /home/ubuntu/gearbox/Caddyfile.avant-grid-$(date +%Y%m%d-%H%M%S)
ls -la /home/ubuntu/gearbox/Caddyfile*
```

**Ajouter le bloc de GRID** a la fin du Caddyfile de gearbox :

```bash
printf '\n' >> /home/ubuntu/gearbox/Caddyfile
cat /home/ubuntu/grid/grid.caddy >> /home/ubuntu/gearbox/Caddyfile
cat /home/ubuntu/gearbox/Caddyfile
```

`grid.caddy` est court et commenté en quatre lignes : le fichier est ajouté tel quel,
commentaires compris. Ils expliquent, dans le Caddyfile de gearbox, pourquoi ce bloc est
là et où en trouver le mode opératoire — c'est exactement l'endroit où quelqu'un se posera
la question.

**Valider AVANT d'appliquer** — c'est cette commande qui rend l'operation sans risque :

```bash
sudo docker compose -p gearbox exec caddy caddy validate --config /etc/caddy/Caddyfile
```

Si elle echoue : restaurer la sauvegarde (voir plus bas) et corriger. **Ne pas
recharger.**

**Recharger a chaud**, sans redemarrer le conteneur :

```bash
sudo docker compose -p gearbox exec caddy caddy reload --config /etc/caddy/Caddyfile
```

### 7. Verifier les deux sites

```bash
curl -sI https://gearbox.bonyauto-mobile.com | head -1   # gearbox, doit repondre 200
curl -sI https://grid.bonyauto-mobile.com | head -1      # GRID
curl -s https://grid.bonyauto-mobile.com/api/sante
```

Le certificat de GRID est emis a la premiere requete ; la toute premiere peut prendre
quelques secondes. `sudo docker compose -p gearbox logs caddy --tail 30` le dit.

Puis dans un navigateur : se connecter en `admin`, verifier la saisie, le tableau de bord,
et **le temps reel** — deux onglets, un RDV saisi d'un cote doit faire monter le compteur
de l'autre. C'est ce qui prouve que la regle `/socket.io/*` du bloc Caddy fonctionne.

### Retour arriere de l'etape 6, en une ligne

```bash
cp /home/ubuntu/gearbox/Caddyfile.avant-grid-<horodatage> /home/ubuntu/gearbox/Caddyfile \
  && sudo docker compose -p gearbox exec caddy caddy reload --config /etc/caddy/Caddyfile
```

Gearbox retrouve son etat exact. GRID devient injoignable de l'exterieur mais continue de
tourner.

---

## Sauvegardes

**Supabase les faisait pour gearbox. Ici, elles sont a notre charge** — c'est la
contrepartie assumee de la decision du 31/08/2026.

`scripts/sauvegarde.sh` fait trois choses la ou un `pg_dump` n'en fait qu'une : il dumpe,
il **restaure le dump dans une base jetable et compte les lignes metier**, et il ne fait
tourner la rotation que si cette epreuve passe.

C'est le meme principe que les garde-fous de la base : une sauvegarde jamais restauree
n'est pas une sauvegarde, c'est un fichier.

Premiere execution, a la main, en lisant la sortie :

```bash
cd /home/ubuntu/grid
chmod +x scripts/sauvegarde.sh
./scripts/sauvegarde.sh
```

Puis en cron, tous les jours a 4 h 12 (pas a 4 h 00 : les taches de tout le monde y sont) :

```bash
crontab -e
```

```
12 4 * * * cd /home/ubuntu/grid && ./scripts/sauvegarde.sh >> /home/ubuntu/grid/sauvegardes/cron.log 2>&1
```

### Restaurer pour de vrai

```bash
cd /home/ubuntu/grid
sudo docker compose stop grid-api
gunzip -c sauvegardes/grid-<horodatage>.sql.gz \
  | sudo docker compose exec -T db psql -U grid -d grid -v ON_ERROR_STOP=1
sudo docker compose start grid-api
```

### Ce qui manque encore, et il faut le savoir

**Ces sauvegardes vivent sur le meme disque que la base qu'elles sauvegardent.** Elles
protegent d'une fausse manoeuvre — un vendeur purge par erreur, une campagne abimee — mais
**pas de la perte du VPS**. Une copie hors du serveur reste a mettre en place. Gearbox a
un `backup.yml` en GitHub Actions ; GRID ne peut pas le copier tel quel, sa base ne
publiant aucun port : il faudrait une cle de deploiement et un `scp` depuis le workflow.
**A traiter, et non a oublier.**

---

## Mettre a jour GRID

```bash
cd /home/ubuntu/grid
git pull
sudo docker compose up -d --build
sudo docker compose logs grid-api --tail 30
```

Les migrations sont jouees par le conteneur au demarrage. **Une migration se joue toujours
en local d'abord** — c'est le pipeline, et il ne change pas parce qu'on est en production.

Rien de tout cela ne touche gearbox : projets compose distincts.

---

## Ce que ce runbook ne couvre pas encore

- **Copie de sauvegarde hors du VPS** (voir ci-dessus).
- **Renouvellement des certificats** : Caddy le fait seul, avec le meme volume
  `gearbox_caddy_data` que gearbox. Rien a faire, mais rien a supprimer non plus.
- **Mot de passe SSH du serveur** : il a ete transmis en clair dans une conversation le
  31/08/2026. L'authentification par cle fonctionne et est celle utilisee ; le mot de
  passe merite d'etre change, et l'authentification par mot de passe desactivee
  (`PasswordAuthentication no`) une fois la cle confirmee comme unique acces.
