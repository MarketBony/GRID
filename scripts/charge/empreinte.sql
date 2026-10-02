-- Empreinte d'integrite : count(*) + md5 de chaque ensemble de lignes d'une campagne.
-- Usage : psql -v c=<campagne_id> -f empreinte.sql
select 'rdv' as objet, count(*) as n, coalesce(md5(string_agg(t::text, ',' order by t.id)),'-') as md5
  from relance.rdv t where t.campagne_id = :c
union all
select 'table_phoning', count(*), coalesce(md5(string_agg(t::text, ',' order by t.id)),'-')
  from relance.table_phoning t join relance.session_plaque sp on sp.id = t.session_plaque_id where sp.campagne_id = :c
union all
select 'affectation', count(*), coalesce(md5(string_agg(a::text, ',' order by a.id)),'-')
  from relance.affectation a join relance.table_phoning t on t.id = a.table_id
  join relance.session_plaque sp on sp.id = t.session_plaque_id where sp.campagne_id = :c
union all
select 'session_plaque', count(*), coalesce(md5(string_agg(t::text, ',' order by t.id)),'-')
  from relance.session_plaque t where t.campagne_id = :c
union all
select 'campagne_jour', count(*), coalesce(md5(string_agg(t::text, ',' order by t.jour)),'-')
  from relance.campagne_jour t where t.campagne_id = :c
union all
select 'campagne_creneau', count(*), coalesce(md5(string_agg(t::text, ',' order by t.code)),'-')
  from relance.campagne_creneau t where t.campagne_id = :c
union all
select 'role_campagne', count(*), coalesce(md5(string_agg(t::text, ',' order by t.id)),'-')
  from relance.role_campagne t where t.campagne_id = :c
union all
select 'campagne', count(*), coalesce(md5(string_agg(t::text, ',' order by t.id)),'-')
  from relance.campagne t where t.id = :c
order by 1;
