-- NETTOYAGE : archive puis PURGE chaque vendeur fictif par la porte officielle relance.vendeur_purger
-- (qui supprime aussi ses RDV), archive l'encadrement CARM cree, remet les comptes .test a actif=false.
\set ON_ERROR_STOP on
begin;
-- vendeur_purger exige un administrateur : on se fait passer pour admin.test, le temps de la transaction.
select set_config('request.jwt.claim.sub', (select auth_uid::text from relance.utilisateur where login_id='admin.test'), true);
select set_config('request.jwt.claims', json_build_object('sub',(select auth_uid::text from relance.utilisateur where login_id='admin.test'),'role','authenticated')::text, true);
select 'admin courant = ' || relance.utilisateur_courant() as verif;
update relance.vendeur set archive_le = now() where nom like 'CHARGE %' and archive_le is null;
select v.nom, (relance.vendeur_purger(v.id, v.nom))->>'nbRdv' as rdv_supprimes from relance.vendeur v where v.nom like 'CHARGE %' order by v.nom;
update relance.encadrement_site e set archive_le = now()
  from relance.site s, relance.utilisateur u
 where s.id = e.site_id and u.id = e.utilisateur_id and s.code='CARM' and e.role='chef_de_vente_vn'
   and u.login_id='encadrant.test' and e.archive_le is null;
update relance.utilisateur set actif = false where login_id in ('admin.test','direction.test','encadrant.test');
commit;
