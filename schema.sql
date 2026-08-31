-- ##########################################################################
-- ## OBSOLETE — conserve en REFERENCE HISTORIQUE, ne plus appliquer.      ##
-- ## Source de verite : backend/prisma/schema.prisma et backend/prisma/   ##
-- ## seed.ts. Les defauts de ce fichier et leur traitement sont listes    ##
-- ## dans BUGS-CONNUS.md, section << Defauts de schema.sql >>.            ##
-- ##########################################################################

-- Relance Bony — schéma initial
-- PostgreSQL / Supabase
-- Principe : aucun agrégat stocké, aucune suppression physique.

create schema if not exists relance;
set search_path to relance, public;

-- ---------------------------------------------------------------- référentiels

create table plaque (
  id            bigint generated always as identity primary key,
  libelle       text not null unique,
  alias         text,                       -- CENTRE est appelée EAA dans l'Excel
  ordre         int  not null default 0,
  archive_le    timestamptz,
  cree_le       timestamptz not null default now(),
  cree_par      uuid references auth.users(id)
);

create table site (
  id            bigint generated always as identity primary key,
  code          text not null unique,       -- CLF, MOZ, USS...
  libelle       text not null,
  plaque_id     bigint not null references plaque(id),
  archive_le    timestamptz,
  cree_le       timestamptz not null default now(),
  cree_par      uuid references auth.users(id)
);
create index on site (plaque_id) where archive_le is null;

create table vendeur (
  id            bigint generated always as identity primary key,
  nom           text not null,
  site_id       bigint not null references site(id),
  renault       boolean not null default false,
  dacia         boolean not null default false,
  alpine        boolean not null default false,
  chef_de_site  boolean not null default false,
  user_id       uuid references auth.users(id), -- null si le vendeur ne se connecte pas
  date_sortie   date,
  cree_le       timestamptz not null default now(),
  cree_par      uuid references auth.users(id),
  constraint au_moins_une_marque check (renault or dacia or alpine)
);
create index on vendeur (site_id) where date_sortie is null;

-- ---------------------------------------------------------------- campagnes

create table campagne (
  id            bigint generated always as identity primary key,
  libelle       text not null,
  date_debut    date not null,
  date_fin      date not null,
  cloturee      boolean not null default false,
  cree_le       timestamptz not null default now(),
  cree_par      uuid references auth.users(id),
  constraint dates_coherentes check (date_fin >= date_debut)
);

-- Les jours retenus : ni forcément consécutifs, ni forcément 5.
create table campagne_jour (
  campagne_id   bigint not null references campagne(id) on delete cascade,
  jour          date   not null,
  ordre         int    not null,
  primary key (campagne_id, jour)
);

-- Les créneaux : liste ordonnée, longueur libre.
create table campagne_creneau (
  campagne_id   bigint not null references campagne(id) on delete cascade,
  code          text   not null,            -- '09:00-10:00'
  libelle       text   not null,            -- '9h-10h'
  ordre         int    not null,
  primary key (campagne_id, code)
);

-- Une session = campagne × plaque. Porte le mode d'organisation.
create table session (
  id            bigint generated always as identity primary key,
  campagne_id   bigint not null references campagne(id) on delete cascade,
  plaque_id     bigint not null references plaque(id),
  mode          text   not null default 'par_site'
                check (mode in ('par_site','par_table')),
  effectif_cible_table int,
  unique (campagne_id, plaque_id)
);

-- ---------------------------------------------------------------- tables de phoning

create table table_phoning (
  id            bigint generated always as identity primary key,
  session_id    bigint not null references session(id) on delete cascade,
  libelle       text   not null,
  chef_id       bigint references vendeur(id),
  chef_user_id  uuid   references auth.users(id),
  ordre         int    not null default 0,
  unique (session_id, libelle)
);

-- Affectation vendeur -> table, valable pour UNE campagne.
-- Ne jamais transformer ceci en colonne de vendeur.
create table affectation (
  table_id      bigint not null references table_phoning(id) on delete cascade,
  vendeur_id    bigint not null references vendeur(id),
  primary key (table_id, vendeur_id)
);

-- ---------------------------------------------------------------- rdv

create table rdv (
  id            bigint generated always as identity primary key,
  campagne_id   bigint not null references campagne(id),
  vendeur_id    bigint not null references vendeur(id),
  jour          date   not null,
  creneau_code  text   not null,
  marque        text   not null check (marque in ('RENAULT','DACIA','ALPINE')),
  type_vehicule text   not null check (type_vehicule in ('VN','VO')),
  client        text   not null,
  commentaire   text,
  cree_le       timestamptz not null default now(),
  cree_par      uuid references auth.users(id),
  modifie_le    timestamptz,
  modifie_par   uuid references auth.users(id),
  foreign key (campagne_id, jour)         references campagne_jour(campagne_id, jour),
  foreign key (campagne_id, creneau_code) references campagne_creneau(campagne_id, code)
);
create index on rdv (campagne_id, vendeur_id);
create index on rdv (campagne_id, jour, creneau_code);

-- Les deux clés étrangères composites ci-dessus sont le garde-fou de R-A.2 :
-- supprimer un jour ou un créneau d'une campagne portant des RDV échoue au niveau
-- de la base. L'interface doit donc traiter le cas explicitement, pas le subir.

-- Un vendeur ne peut être dans deux tables pour la même campagne (R-B.4).
-- Un index unique ne suffit pas : la campagne n'est atteignable qu'en remontant
-- table_phoning -> session. D'où le trigger.
create or replace function check_affectation_unique() returns trigger as $$
begin
  if exists (
    select 1
    from affectation a
    join table_phoning t  on t.id = a.table_id
    join session s        on s.id = t.session_id
    join table_phoning t2 on t2.id = new.table_id
    join session s2       on s2.id = t2.session_id
    where a.vendeur_id = new.vendeur_id
      and s.campagne_id = s2.campagne_id
      and a.table_id <> new.table_id
  ) then
    raise exception 'Vendeur % déjà affecté à une autre table de cette campagne', new.vendeur_id;
  end if;
  return new;
end $$ language plpgsql;

create trigger affectation_unique
  before insert or update on affectation
  for each row execute function check_affectation_unique();

-- Un vendeur ne peut recevoir un RDV que sur une marque autorisée (R-C.1).
create or replace function check_marque_autorisee() returns trigger as $$
declare v vendeur;
begin
  select * into v from vendeur where id = new.vendeur_id;
  if (new.marque = 'RENAULT' and not v.renault)
  or (new.marque = 'DACIA'   and not v.dacia)
  or (new.marque = 'ALPINE'  and not v.alpine) then
    raise exception 'Vendeur % non autorisé sur la marque %', v.nom, new.marque;
  end if;
  return new;
end $$ language plpgsql;

create trigger rdv_marque_autorisee
  before insert or update on rdv
  for each row execute function check_marque_autorisee();

-- Aucune saisie sur campagne clôturée (R-C.3).
create or replace function check_campagne_ouverte() returns trigger as $$
begin
  if (select cloturee from campagne where id = coalesce(new.campagne_id, old.campagne_id)) then
    raise exception 'Campagne clôturée : saisie impossible';
  end if;
  return coalesce(new, old);
end $$ language plpgsql;

create trigger rdv_campagne_ouverte
  before insert or update or delete on rdv
  for each row execute function check_campagne_ouverte();

-- ---------------------------------------------------------------- vues d'agrégation
-- Aucun total n'est stocké. Tout se calcule ici.

create view v_rdv_enrichi as
select r.*, v.nom as vendeur_nom, v.site_id, s.libelle as site_libelle,
       s.plaque_id, p.libelle as plaque_libelle
from rdv r
join vendeur v on v.id = r.vendeur_id
join site s    on s.id = v.site_id
join plaque p  on p.id = s.plaque_id;

create view v_total_vendeur as
select campagne_id, vendeur_id, vendeur_nom, site_id, plaque_id,
       count(*)                                             as total,
       count(*) filter (where type_vehicule = 'VN')          as vn,
       count(*) filter (where type_vehicule = 'VO')          as vo,
       count(*) filter (where marque = 'RENAULT')            as renault,
       count(*) filter (where marque = 'DACIA')              as dacia,
       count(*) filter (where marque = 'ALPINE')             as alpine
from v_rdv_enrichi
group by 1,2,3,4,5;

-- Effectif CALCULÉ, jamais saisi. Corrige le défaut de RANK!AG du fichier Excel.
create view v_total_site as
select c.id as campagne_id, s.id as site_id, s.libelle, s.plaque_id,
       count(distinct v.id) filter (where v.date_sortie is null) as effectif,
       coalesce(sum(t.total), 0)                                 as total,
       coalesce(sum(t.vn), 0)                                    as vn,
       coalesce(sum(t.vo), 0)                                    as vo,
       round(coalesce(sum(t.total), 0)::numeric
             / nullif(count(distinct v.id) filter (where v.date_sortie is null), 0), 2) as moyenne
from campagne c
cross join site s
left join vendeur v      on v.site_id = s.id
left join v_total_vendeur t on t.vendeur_id = v.id and t.campagne_id = c.id
where s.archive_le is null
group by 1,2,3,4;

-- ---------------------------------------------------------------- RLS
-- Activée partout, sans exception. Politiques à écrire au lot 1 en fonction
-- de la table de rôles, non modélisée ici.

alter table plaque           enable row level security;
alter table site             enable row level security;
alter table vendeur          enable row level security;
alter table campagne         enable row level security;
alter table campagne_jour    enable row level security;
alter table campagne_creneau enable row level security;
alter table session          enable row level security;
alter table table_phoning    enable row level security;
alter table affectation      enable row level security;
alter table rdv              enable row level security;
