-- AMORCAGE : :n RDV synthetiques (client 'AMORCAGE CHARGE') sur les vendeurs fictifs, Octobre 2026 (933) uniquement.
-- Sert a donner a la vue d'ensemble un volume realiste (une journee de phoning ~900 RDV) : sans cela
-- la lecture paginee de rdv_agrege serait triviale. Insere par SQL direct (propriete postgres).
-- Garde-fou : refuse si Octobre contient des RDV qui ne sont pas des RDV du test.
\set ON_ERROR_STOP on
begin;
do $$ begin
  if exists (select 1 from relance.rdv r where r.campagne_id = 933 and r.vendeur_id not in (select id from relance.vendeur where nom like 'CHARGE %')) then
    raise exception 'Octobre contient des RDV etrangers au test : on refuse d''ecrire';
  end if;
  if (select cloturee from relance.campagne where id = 933) then raise exception 'Octobre cloturee'; end if;
end $$;
insert into relance.rdv (campagne_id, vendeur_id, jour, creneau_code, marque_id, type_vehicule, client)
select 933, v.id, j.jour, c.code, m.marque_id, 'VN', 'AMORCAGE CHARGE ' || g
from generate_series(1, :n) g
cross join lateral (select id from relance.vendeur where nom like 'CHARGE %' order by random() + g * 0 limit 1) v
cross join lateral (select jour from relance.campagne_jour where campagne_id = 933 order by random() + g * 0 limit 1) j
cross join lateral (select code from relance.campagne_creneau where campagne_id = 933 order by random() + g * 0 limit 1) c
cross join lateral (select marque_id from relance.vendeur_marque where vendeur_id = v.id order by random() + g * 0 limit 1) m;
commit;
select count(*) as rdv_octobre from relance.rdv where campagne_id = 933;
