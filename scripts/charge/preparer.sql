-- PREPARATION DU BAC A SABLE (Octobre 2026 = campagne 933). Rejouable : ne cree que ce qui manque.
-- Ecrit : 3 comptes .test reactives, N vendeurs fictifs 'CHARGE nn' (VN, site CARM, entree 01/10/2026),
-- leurs marques, et UN encadrement durable (CARM / chef_de_vente_vn -> encadrant.test).
-- Aucune ligne n'est liee a Juin (1) ni Septembre (2) : date_entree 2026-10-01 > date_fin des deux.
\set ON_ERROR_STOP on
begin;
update relance.utilisateur set actif = true where login_id in ('admin.test','direction.test','encadrant.test');

insert into relance.vendeur (nom, site_id, type_vehicule, date_entree)
select 'CHARGE ' || lpad(g::text, 2, '0'), (select id from relance.site where code='CARM'), 'VN', date '2026-10-01'
from generate_series(1, :nb) g
where not exists (select 1 from relance.vendeur v where v.nom = 'CHARGE ' || lpad(g::text, 2, '0'));

insert into relance.vendeur_marque (vendeur_id, marque_id)
select v.id, m.id from relance.vendeur v, relance.marque m
where v.nom like 'CHARGE %' and m.code in ('RENAULT','DACIA')
on conflict do nothing;

insert into relance.encadrement_site (site_id, role, utilisateur_id)
select s.id, 'chef_de_vente_vn', u.id
from relance.site s, relance.utilisateur u
where s.code = 'CARM' and u.login_id = 'encadrant.test'
  and not exists (select 1 from relance.encadrement_site e where e.site_id = s.id and e.role = 'chef_de_vente_vn');
commit;
select v.id, v.nom, v.site_id, v.type_vehicule, v.date_entree from relance.vendeur v where nom like 'CHARGE %' order by nom;
select e.* from relance.encadrement_site e join relance.site s on s.id=e.site_id where s.code='CARM';
