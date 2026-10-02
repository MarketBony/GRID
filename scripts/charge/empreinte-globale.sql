-- Etat global hors campagnes : vendeurs non fictifs, encadrements, comptes .test.
select 'vendeur (hors CHARGE)' as objet, count(*) as n, md5(string_agg(t::text, ',' order by t.id)) as md5
  from relance.vendeur t where t.nom not like 'CHARGE %'
union all
select 'vendeur_marque (hors CHARGE)', count(*), md5(string_agg(m::text, ',' order by m.vendeur_id, m.marque_id))
  from relance.vendeur_marque m join relance.vendeur v on v.id=m.vendeur_id where v.nom not like 'CHARGE %'
union all
select 'encadrement_site', count(*), md5(string_agg(t::text, ',' order by t.id)) from relance.encadrement_site t
union all
select 'utilisateur (login, actif, auth_uid)', count(*), md5(string_agg(login_id||'|'||actif||'|'||coalesce(auth_uid::text,''), ',' order by id)) from relance.utilisateur
union all
select 'role_global', count(*), md5(string_agg(t::text, ',' order by t.utilisateur_id, t.role)) from relance.role_global t
union all
select 'vendeurs CHARGE restants', count(*), '-' from relance.vendeur where nom like 'CHARGE %'
order by 1;
