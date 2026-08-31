-- ##########################################################################
-- ## OBSOLETE — conserve en REFERENCE HISTORIQUE, ne plus appliquer.      ##
-- ## Source de verite : backend/prisma/schema.prisma et backend/prisma/   ##
-- ## seed.ts. Les defauts de ce fichier et leur traitement sont listes    ##
-- ## dans BUGS-CONNUS.md, section << Defauts de schema.sql >>.            ##
-- ##########################################################################

-- Relance Bony — seed des référentiels
-- Extrait de tableau_phoning_reltel_JUIN_(2).xlsx
-- 4 plaques, 19 sites, 99 vendeurs, 8 tables de la campagne de juin 2026.
--
-- ##################################################################
-- ## TODO BLOQUANT — MARQUES AUTORISEES PAR VENDEUR               ##
-- ##                                                              ##
-- ## Cette donnee N'EXISTE PAS dans le fichier Excel source : tous ##
-- ## les blocs vendeur y portent une section Renault ET une        ##
-- ## section Dacia, quelle que soit la realite du terrain.        ##
-- ##                                                              ##
-- ## Les valeurs ci-dessous sont donc un PLACEHOLDER : renault=true,##
-- ## dacia=true, sauf le site ALPINE. Elles doivent etre corrigees ##
-- ## site par site AVANT la mise en service, sinon la regle R-C.1  ##
-- ## (marque autorisee) ne protege rien.                          ##
-- ##################################################################

set search_path to relance, public;

begin;

-- ---------------------------------------------------------------- plaques
insert into plaque (libelle, alias, ordre) values ('CENTRE', 'EAA', 1);
insert into plaque (libelle, alias, ordre) values ('NORD', null, 2);
insert into plaque (libelle, alias, ordre) values ('SUD', null, 3);
insert into plaque (libelle, alias, ordre) values ('SUD-OUEST', null, 4);

-- ---------------------------------------------------------------- sites
insert into site (code, libelle, plaque_id) select 'MASS', 'Massagettes', id from plaque where libelle = 'CENTRE';
insert into site (code, libelle, plaque_id) select 'MOZ', 'Mozac', id from plaque where libelle = 'CENTRE';
insert into site (code, libelle, plaque_id) select 'CLF', 'Clermont-Ferrand', id from plaque where libelle = 'CENTRE';
insert into site (code, libelle, plaque_id) select 'USS', 'Ussel', id from plaque where libelle = 'CENTRE';
insert into site (code, libelle, plaque_id) select 'ALPINE', 'Alpine', id from plaque where libelle = 'CENTRE';
insert into site (code, libelle, plaque_id) select 'VI', 'Vichy', id from plaque where libelle = 'NORD';
insert into site (code, libelle, plaque_id) select 'MOU', 'Moulins', id from plaque where libelle = 'NORD';
insert into site (code, libelle, plaque_id) select 'TH', 'Thiers', id from plaque where libelle = 'NORD';
insert into site (code, libelle, plaque_id) select 'PUY', 'Le Puy', id from plaque where libelle = 'SUD';
insert into site (code, libelle, plaque_id) select 'MEN', 'Mende', id from plaque where libelle = 'SUD';
insert into site (code, libelle, plaque_id) select 'ISS', 'Issoire', id from plaque where libelle = 'SUD';
insert into site (code, libelle, plaque_id) select 'GAILL', 'Gaillac', id from plaque where libelle = 'SUD-OUEST';
insert into site (code, libelle, plaque_id) select 'ALBI', 'Albi', id from plaque where libelle = 'SUD-OUEST';
insert into site (code, libelle, plaque_id) select 'RDZ', 'Rodez', id from plaque where libelle = 'SUD-OUEST';
insert into site (code, libelle, plaque_id) select 'MILL', 'Millau', id from plaque where libelle = 'SUD-OUEST';
insert into site (code, libelle, plaque_id) select 'FIGEAC', 'Figeac', id from plaque where libelle = 'SUD-OUEST';
insert into site (code, libelle, plaque_id) select 'AUR', 'Aurillac', id from plaque where libelle = 'SUD-OUEST';
insert into site (code, libelle, plaque_id) select 'VDR', 'Villefranche', id from plaque where libelle = 'SUD-OUEST';
insert into site (code, libelle, plaque_id) select 'CARM', 'Carmaux', id from plaque where libelle = 'SUD-OUEST';
-- Onglet MDP du fichier source : coquille vide, site sans vendeur. A confirmer.
-- insert into site (code, libelle, plaque_id) select 'MDP', 'A confirmer', id from plaque where libelle = 'CENTRE';

-- ---------------------------------------------------------------- vendeurs
insert into vendeur (nom, site_id, renault, dacia, alpine) select 'QUENTIN VANINI', id, true, true, false from site where code = 'MASS';
insert into vendeur (nom, site_id, renault, dacia, alpine) select 'VIRGINIE CUMINAL', id, true, true, false from site where code = 'MASS';
insert into vendeur (nom, site_id, renault, dacia, alpine) select 'ANTHONY DONAS', id, true, true, false from site where code = 'MOZ';
insert into vendeur (nom, site_id, renault, dacia, alpine) select 'JORDAN CALDEIRA', id, true, true, false from site where code = 'MOZ';
insert into vendeur (nom, site_id, renault, dacia, alpine) select 'ROBIN RABOISSON', id, true, true, false from site where code = 'MOZ';
insert into vendeur (nom, site_id, renault, dacia, alpine) select 'KEVIN DIJOUX', id, true, true, false from site where code = 'MOZ';
insert into vendeur (nom, site_id, renault, dacia, alpine) select 'UGO FERVEL', id, true, true, false from site where code = 'MOZ';
insert into vendeur (nom, site_id, renault, dacia, alpine) select 'YANN DE OLIVEIRA', id, true, true, false from site where code = 'MOZ';
insert into vendeur (nom, site_id, renault, dacia, alpine) select 'MATTHIAS VALLE', id, true, true, false from site where code = 'MOZ';
insert into vendeur (nom, site_id, renault, dacia, alpine) select 'VALENTIN PARPINELLI', id, true, true, false from site where code = 'CLF';
insert into vendeur (nom, site_id, renault, dacia, alpine) select 'THIERRY DUBERNAT', id, true, true, false from site where code = 'CLF';
insert into vendeur (nom, site_id, renault, dacia, alpine) select 'OCEANE ESPINASSE', id, true, true, false from site where code = 'CLF';
insert into vendeur (nom, site_id, renault, dacia, alpine) select 'BLANDINE CLÉMENT', id, true, true, false from site where code = 'CLF';
insert into vendeur (nom, site_id, renault, dacia, alpine) select 'THOMAS SOULIER', id, true, true, false from site where code = 'CLF';
insert into vendeur (nom, site_id, renault, dacia, alpine) select 'CHRISTOPHE BROSSEAU', id, true, true, false from site where code = 'CLF';
insert into vendeur (nom, site_id, renault, dacia, alpine) select 'THÉO ROUSSET', id, true, true, false from site where code = 'CLF';
insert into vendeur (nom, site_id, renault, dacia, alpine) select 'QUENTIN BELLAIGUES', id, true, true, false from site where code = 'CLF';
insert into vendeur (nom, site_id, renault, dacia, alpine) select 'JEAN-PIERRE FERRIER', id, true, true, false from site where code = 'CLF';
insert into vendeur (nom, site_id, renault, dacia, alpine) select 'JULIEN BIASUTTI', id, true, true, false from site where code = 'CLF';
insert into vendeur (nom, site_id, renault, dacia, alpine) select 'PIERRE-EDOUARD LAROCHE', id, true, true, false from site where code = 'CLF';
insert into vendeur (nom, site_id, renault, dacia, alpine) select 'ANTOINE BASTIEN', id, true, true, false from site where code = 'CLF';
insert into vendeur (nom, site_id, renault, dacia, alpine) select 'DYLAN GUERRET', id, true, true, false from site where code = 'CLF';
insert into vendeur (nom, site_id, renault, dacia, alpine) select 'JOAO TEIXEIRA', id, true, true, false from site where code = 'CLF';
insert into vendeur (nom, site_id, renault, dacia, alpine) select 'THIERRY MARTINEZ', id, true, true, false from site where code = 'CLF';
insert into vendeur (nom, site_id, renault, dacia, alpine) select 'JEROME SABIN', id, true, true, false from site where code = 'CLF';
insert into vendeur (nom, site_id, renault, dacia, alpine) select 'ROBIN GUERY', id, true, true, false from site where code = 'USS';
insert into vendeur (nom, site_id, renault, dacia, alpine) select 'JULIEN SPADAT', id, true, true, false from site where code = 'USS';
insert into vendeur (nom, site_id, renault, dacia, alpine) select 'STÉPHANE VANDAMME', id, true, true, false from site where code = 'USS';
insert into vendeur (nom, site_id, renault, dacia, alpine) select 'SÉBASTIEN MIRA', id, false, false, true from site where code = 'ALPINE';
insert into vendeur (nom, site_id, renault, dacia, alpine) select 'EMILIEN SOLEILHAVOUP', id, false, false, true from site where code = 'ALPINE';
insert into vendeur (nom, site_id, renault, dacia, alpine) select 'ALEXANDRE CHAVIGNON', id, true, true, false from site where code = 'VI';
insert into vendeur (nom, site_id, renault, dacia, alpine) select 'MICHEL GUILLERM', id, true, true, false from site where code = 'VI';
insert into vendeur (nom, site_id, renault, dacia, alpine) select 'ALEXANDRE DIOT', id, true, true, false from site where code = 'VI';
insert into vendeur (nom, site_id, renault, dacia, alpine) select 'DYLAN MEYRIAL', id, true, true, false from site where code = 'VI';
insert into vendeur (nom, site_id, renault, dacia, alpine) select 'YOANN TRIBOULET', id, true, true, false from site where code = 'VI';
insert into vendeur (nom, site_id, renault, dacia, alpine) select 'MATTIS BONNAMOUR', id, true, true, false from site where code = 'VI';
insert into vendeur (nom, site_id, renault, dacia, alpine) select 'VIKTORIIA BONDARENKO', id, true, true, false from site where code = 'VI';
insert into vendeur (nom, site_id, renault, dacia, alpine) select 'NICOLAS BOUCHET', id, true, true, false from site where code = 'VI';
insert into vendeur (nom, site_id, renault, dacia, alpine) select 'CLÉMENT JACQUET', id, true, true, false from site where code = 'VI';
insert into vendeur (nom, site_id, renault, dacia, alpine) select 'ROMARIC RAMBERT', id, true, true, false from site where code = 'VI';
insert into vendeur (nom, site_id, renault, dacia, alpine) select 'CLÉMENT RAYA', id, true, true, false from site where code = 'VI';
insert into vendeur (nom, site_id, renault, dacia, alpine) select 'SYLVETTE ROGUE', id, true, true, false from site where code = 'MOU';
insert into vendeur (nom, site_id, renault, dacia, alpine) select 'SEBASTIEN DUBOST', id, true, true, false from site where code = 'MOU';
insert into vendeur (nom, site_id, renault, dacia, alpine) select 'MARC PALUMBO', id, true, true, false from site where code = 'MOU';
insert into vendeur (nom, site_id, renault, dacia, alpine) select 'PAULINE COIGNET', id, true, true, false from site where code = 'MOU';
insert into vendeur (nom, site_id, renault, dacia, alpine) select 'JULIEN LE QUELLEC', id, true, true, false from site where code = 'MOU';
insert into vendeur (nom, site_id, renault, dacia, alpine) select 'ROMAIN DENIS', id, true, true, false from site where code = 'MOU';
insert into vendeur (nom, site_id, renault, dacia, alpine) select 'LOUIS DUBOST', id, true, true, false from site where code = 'TH';
insert into vendeur (nom, site_id, renault, dacia, alpine) select 'CYNTHIA VALLIN', id, true, true, false from site where code = 'TH';
insert into vendeur (nom, site_id, renault, dacia, alpine) select 'AXEL DUMONT', id, true, true, false from site where code = 'TH';
insert into vendeur (nom, site_id, renault, dacia, alpine) select 'DAMIEN DAGOSTINO', id, true, true, false from site where code = 'TH';
insert into vendeur (nom, site_id, renault, dacia, alpine) select 'ALEXANDRE PINOT', id, true, true, false from site where code = 'TH';
insert into vendeur (nom, site_id, renault, dacia, alpine) select 'ARNAUD GALLAND', id, true, true, false from site where code = 'PUY';
insert into vendeur (nom, site_id, renault, dacia, alpine) select 'GUILLAUME SAVINEL', id, true, true, false from site where code = 'PUY';
insert into vendeur (nom, site_id, renault, dacia, alpine) select 'JEAN-PAUL RANVOISE', id, true, true, false from site where code = 'PUY';
insert into vendeur (nom, site_id, renault, dacia, alpine) select 'ARTHUR DURANTON', id, true, true, false from site where code = 'PUY';
insert into vendeur (nom, site_id, renault, dacia, alpine) select 'VALENTIN MOLINES', id, true, true, false from site where code = 'PUY';
insert into vendeur (nom, site_id, renault, dacia, alpine) select 'RICHARD WEISSELDINGER', id, true, true, false from site where code = 'PUY';
insert into vendeur (nom, site_id, renault, dacia, alpine) select 'JÉRÉMY DA COSTA', id, true, true, false from site where code = 'MEN';
insert into vendeur (nom, site_id, renault, dacia, alpine) select 'DYLAN NOGUEIRA', id, true, true, false from site where code = 'MEN';
insert into vendeur (nom, site_id, renault, dacia, alpine) select 'WILLIAM PASCAL', id, true, true, false from site where code = 'MEN';
insert into vendeur (nom, site_id, renault, dacia, alpine) select 'YOANN PICARD', id, true, true, false from site where code = 'ISS';
insert into vendeur (nom, site_id, renault, dacia, alpine) select 'STANISLAS RODAMEL', id, true, true, false from site where code = 'ISS';
insert into vendeur (nom, site_id, renault, dacia, alpine) select 'JULIEN MONATTE', id, true, true, false from site where code = 'ISS';
insert into vendeur (nom, site_id, renault, dacia, alpine) select 'MAGALI MICHEL', id, true, true, false from site where code = 'ISS';
insert into vendeur (nom, site_id, renault, dacia, alpine) select 'AMÉLIE HERVÉ', id, true, true, false from site where code = 'ISS';
insert into vendeur (nom, site_id, renault, dacia, alpine) select 'SÉBASTIEN DUMONT', id, true, true, false from site where code = 'ISS';
insert into vendeur (nom, site_id, renault, dacia, alpine) select 'REDWANE TOULOUSE', id, true, true, false from site where code = 'ISS';
insert into vendeur (nom, site_id, renault, dacia, alpine) select 'STÉPHANE DALLO-BELLESSA', id, true, true, false from site where code = 'ISS';
insert into vendeur (nom, site_id, renault, dacia, alpine) select 'FRANCOIS LENAIC', id, true, true, false from site where code = 'ISS';
insert into vendeur (nom, site_id, renault, dacia, alpine) select 'CHRISTIAN CAUQUIL', id, true, true, false from site where code = 'GAILL';
insert into vendeur (nom, site_id, renault, dacia, alpine) select 'JULIEN SEBE', id, true, true, false from site where code = 'GAILL';
insert into vendeur (nom, site_id, renault, dacia, alpine) select 'GUILLAUME SEGUI', id, true, true, false from site where code = 'GAILL';
insert into vendeur (nom, site_id, renault, dacia, alpine) select 'FLAVIEN MILLON', id, true, true, false from site where code = 'GAILL';
insert into vendeur (nom, site_id, renault, dacia, alpine) select 'DANIEL DIAS FERNANDES', id, true, true, false from site where code = 'ALBI';
insert into vendeur (nom, site_id, renault, dacia, alpine) select 'AURÉLIE BOMPART', id, true, true, false from site where code = 'ALBI';
insert into vendeur (nom, site_id, renault, dacia, alpine) select 'EMMA GUEGUEN', id, true, true, false from site where code = 'ALBI';
insert into vendeur (nom, site_id, renault, dacia, alpine) select 'FLORENT THOMASSIN', id, true, true, false from site where code = 'ALBI';
insert into vendeur (nom, site_id, renault, dacia, alpine) select 'ROMAIN BOISSONNADE', id, true, true, false from site where code = 'RDZ';
insert into vendeur (nom, site_id, renault, dacia, alpine) select 'MARINE FLAUJAGUET', id, true, true, false from site where code = 'RDZ';
insert into vendeur (nom, site_id, renault, dacia, alpine) select 'ALEXIS COMPANS', id, true, true, false from site where code = 'RDZ';
insert into vendeur (nom, site_id, renault, dacia, alpine) select 'RÉMI DEGAND', id, true, true, false from site where code = 'RDZ';
insert into vendeur (nom, site_id, renault, dacia, alpine) select 'ARNAUD LOPEZ', id, true, true, false from site where code = 'RDZ';
insert into vendeur (nom, site_id, renault, dacia, alpine) select 'DORIAN FRANCE', id, true, true, false from site where code = 'RDZ';
insert into vendeur (nom, site_id, renault, dacia, alpine) select 'DAMIEN RULHE', id, true, true, false from site where code = 'RDZ';
insert into vendeur (nom, site_id, renault, dacia, alpine) select 'NICOLAS CAYRON', id, true, true, false from site where code = 'MILL';
insert into vendeur (nom, site_id, renault, dacia, alpine) select 'MATHIS FRANCOIS', id, true, true, false from site where code = 'MILL';
insert into vendeur (nom, site_id, renault, dacia, alpine) select 'ELSA AGRINIER', id, true, true, false from site where code = 'MILL';
insert into vendeur (nom, site_id, renault, dacia, alpine) select 'DORIAN ALLEGRE', id, true, true, false from site where code = 'FIGEAC';
insert into vendeur (nom, site_id, renault, dacia, alpine) select 'MATIS BRUNO', id, true, true, false from site where code = 'FIGEAC';
insert into vendeur (nom, site_id, renault, dacia, alpine) select 'CLÉMENT MALGOUZOU', id, true, true, false from site where code = 'FIGEAC';
insert into vendeur (nom, site_id, renault, dacia, alpine) select 'YOHAN BANYIK', id, true, true, false from site where code = 'AUR';
insert into vendeur (nom, site_id, renault, dacia, alpine) select 'ROMAIN COMBOURIEU', id, true, true, false from site where code = 'AUR';
insert into vendeur (nom, site_id, renault, dacia, alpine) select 'STÉPHANE SUC', id, true, true, false from site where code = 'AUR';
insert into vendeur (nom, site_id, renault, dacia, alpine) select 'ANTONIN LUC', id, true, true, false from site where code = 'AUR';
insert into vendeur (nom, site_id, renault, dacia, alpine) select 'MAGALI BRUGIER', id, true, true, false from site where code = 'VDR';
insert into vendeur (nom, site_id, renault, dacia, alpine) select 'THOMAS BERT', id, true, true, false from site where code = 'VDR';
insert into vendeur (nom, site_id, renault, dacia, alpine) select 'AZIZ CHOUAY', id, true, true, false from site where code = 'VDR';
insert into vendeur (nom, site_id, renault, dacia, alpine) select 'GEOFFREY SALGUES', id, true, true, false from site where code = 'CARM';

-- ---------------------------------------------------------------- campagne juin 2026
-- Jours et creneaux repris de l'onglet CLF. A adapter pour la campagne suivante :
-- c'est precisement ce que l'outil rend editable en deux champs.
insert into campagne (libelle, date_debut, date_fin)
values ('Juin 2026', '2026-06-11', '2026-06-15');

insert into campagne_jour (campagne_id, jour, ordre)
select c.id, j.jour, j.ordre from campagne c,
 (values ('2026-06-11'::date,1),('2026-06-12',2),('2026-06-13',3),
         ('2026-06-14',4),('2026-06-15',5)) as j(jour,ordre)
where c.libelle = 'Juin 2026';

insert into campagne_creneau (campagne_id, code, libelle, ordre)
select c.id, x.code, x.libelle, x.ordre from campagne c,
 (values ('08:00-09:00','8h-9h',1),('09:00-10:00','9h-10h',2),('10:00-11:00','10h-11h',3),
         ('11:00-12:00','11h-12h',4),('12:00-13:00','12h-13h',5),('13:00-14:00','13h-14h',6),
         ('14:00-15:00','14h-15h',7),('15:00-16:00','15h-16h',8),('16:00-17:00','16h-17h',9),
         ('17:00-18:00','17h-18h',10),('18:00-19:00','18h-19h',11)) as x(code,libelle,ordre)
where c.libelle = 'Juin 2026';

-- Sessions : CENTRE et SUD en tables, NORD et SUD-OUEST par site.
-- Constate sur les donnees de juin : seules ces deux plaques ont un onglet TABLES.
insert into session (campagne_id, plaque_id, mode, effectif_cible_table)
select c.id, p.id,
       case when p.libelle in ('CENTRE','SUD') then 'par_table' else 'par_site' end,
       case when p.libelle in ('CENTRE','SUD') then 6 else null end
from campagne c cross join plaque p where c.libelle = 'Juin 2026';

-- ---------------------------------------------------------------- tables de juin
insert into table_phoning (session_id, libelle, ordre)
select s.id, 'SÉVERINE BESSON — TABLE 1', 0
from session s join campagne c on c.id = s.campagne_id
               join plaque p   on p.id = s.plaque_id
where c.libelle = 'Juin 2026' and p.libelle = 'CENTRE';
insert into affectation (table_id, vendeur_id)
select tp.id, v.id
from table_phoning tp
 join session s on s.id = tp.session_id
 join campagne c on c.id = s.campagne_id
 join plaque p on p.id = s.plaque_id, vendeur v
where c.libelle = 'Juin 2026' and p.libelle = 'CENTRE'
  and tp.libelle = 'SÉVERINE BESSON — TABLE 1' and v.nom = 'PIERRE-EDOUARD LAROCHE';
insert into affectation (table_id, vendeur_id)
select tp.id, v.id
from table_phoning tp
 join session s on s.id = tp.session_id
 join campagne c on c.id = s.campagne_id
 join plaque p on p.id = s.plaque_id, vendeur v
where c.libelle = 'Juin 2026' and p.libelle = 'CENTRE'
  and tp.libelle = 'SÉVERINE BESSON — TABLE 1' and v.nom = 'ANTOINE BASTIEN';
insert into affectation (table_id, vendeur_id)
select tp.id, v.id
from table_phoning tp
 join session s on s.id = tp.session_id
 join campagne c on c.id = s.campagne_id
 join plaque p on p.id = s.plaque_id, vendeur v
where c.libelle = 'Juin 2026' and p.libelle = 'CENTRE'
  and tp.libelle = 'SÉVERINE BESSON — TABLE 1' and v.nom = 'VALENTIN PARPINELLI';
insert into affectation (table_id, vendeur_id)
select tp.id, v.id
from table_phoning tp
 join session s on s.id = tp.session_id
 join campagne c on c.id = s.campagne_id
 join plaque p on p.id = s.plaque_id, vendeur v
where c.libelle = 'Juin 2026' and p.libelle = 'CENTRE'
  and tp.libelle = 'SÉVERINE BESSON — TABLE 1' and v.nom = 'THIERRY DUBERNAT';
insert into affectation (table_id, vendeur_id)
select tp.id, v.id
from table_phoning tp
 join session s on s.id = tp.session_id
 join campagne c on c.id = s.campagne_id
 join plaque p on p.id = s.plaque_id, vendeur v
where c.libelle = 'Juin 2026' and p.libelle = 'CENTRE'
  and tp.libelle = 'SÉVERINE BESSON — TABLE 1' and v.nom = 'JULIEN SPADAT';
insert into affectation (table_id, vendeur_id)
select tp.id, v.id
from table_phoning tp
 join session s on s.id = tp.session_id
 join campagne c on c.id = s.campagne_id
 join plaque p on p.id = s.plaque_id, vendeur v
where c.libelle = 'Juin 2026' and p.libelle = 'CENTRE'
  and tp.libelle = 'SÉVERINE BESSON — TABLE 1' and v.nom = 'ROBIN RABOISSON';
insert into table_phoning (session_id, libelle, ordre)
select s.id, 'THIERRY COIGNAC — TABLE 2', 0
from session s join campagne c on c.id = s.campagne_id
               join plaque p   on p.id = s.plaque_id
where c.libelle = 'Juin 2026' and p.libelle = 'CENTRE';
insert into affectation (table_id, vendeur_id)
select tp.id, v.id
from table_phoning tp
 join session s on s.id = tp.session_id
 join campagne c on c.id = s.campagne_id
 join plaque p on p.id = s.plaque_id, vendeur v
where c.libelle = 'Juin 2026' and p.libelle = 'CENTRE'
  and tp.libelle = 'THIERRY COIGNAC — TABLE 2' and v.nom = 'JEROME SABIN';
insert into affectation (table_id, vendeur_id)
select tp.id, v.id
from table_phoning tp
 join session s on s.id = tp.session_id
 join campagne c on c.id = s.campagne_id
 join plaque p on p.id = s.plaque_id, vendeur v
where c.libelle = 'Juin 2026' and p.libelle = 'CENTRE'
  and tp.libelle = 'THIERRY COIGNAC — TABLE 2' and v.nom = 'DYLAN GUERRET';
insert into affectation (table_id, vendeur_id)
select tp.id, v.id
from table_phoning tp
 join session s on s.id = tp.session_id
 join campagne c on c.id = s.campagne_id
 join plaque p on p.id = s.plaque_id, vendeur v
where c.libelle = 'Juin 2026' and p.libelle = 'CENTRE'
  and tp.libelle = 'THIERRY COIGNAC — TABLE 2' and v.nom = 'SÉBASTIEN MIRA';
insert into affectation (table_id, vendeur_id)
select tp.id, v.id
from table_phoning tp
 join session s on s.id = tp.session_id
 join campagne c on c.id = s.campagne_id
 join plaque p on p.id = s.plaque_id, vendeur v
where c.libelle = 'Juin 2026' and p.libelle = 'CENTRE'
  and tp.libelle = 'THIERRY COIGNAC — TABLE 2' and v.nom = 'CHRISTOPHE BROSSEAU';
insert into affectation (table_id, vendeur_id)
select tp.id, v.id
from table_phoning tp
 join session s on s.id = tp.session_id
 join campagne c on c.id = s.campagne_id
 join plaque p on p.id = s.plaque_id, vendeur v
where c.libelle = 'Juin 2026' and p.libelle = 'CENTRE'
  and tp.libelle = 'THIERRY COIGNAC — TABLE 2' and v.nom = 'ANTHONY DONAS';
insert into affectation (table_id, vendeur_id)
select tp.id, v.id
from table_phoning tp
 join session s on s.id = tp.session_id
 join campagne c on c.id = s.campagne_id
 join plaque p on p.id = s.plaque_id, vendeur v
where c.libelle = 'Juin 2026' and p.libelle = 'CENTRE'
  and tp.libelle = 'THIERRY COIGNAC — TABLE 2' and v.nom = 'JORDAN CALDEIRA';
insert into table_phoning (session_id, libelle, ordre)
select s.id, 'LUCIEN MARCHETTI — TABLE 3', 0
from session s join campagne c on c.id = s.campagne_id
               join plaque p   on p.id = s.plaque_id
where c.libelle = 'Juin 2026' and p.libelle = 'CENTRE';
insert into affectation (table_id, vendeur_id)
select tp.id, v.id
from table_phoning tp
 join session s on s.id = tp.session_id
 join campagne c on c.id = s.campagne_id
 join plaque p on p.id = s.plaque_id, vendeur v
where c.libelle = 'Juin 2026' and p.libelle = 'CENTRE'
  and tp.libelle = 'LUCIEN MARCHETTI — TABLE 3' and v.nom = 'BLANDINE CLÉMENT';
insert into affectation (table_id, vendeur_id)
select tp.id, v.id
from table_phoning tp
 join session s on s.id = tp.session_id
 join campagne c on c.id = s.campagne_id
 join plaque p on p.id = s.plaque_id, vendeur v
where c.libelle = 'Juin 2026' and p.libelle = 'CENTRE'
  and tp.libelle = 'LUCIEN MARCHETTI — TABLE 3' and v.nom = 'JOAO TEIXEIRA';
insert into affectation (table_id, vendeur_id)
select tp.id, v.id
from table_phoning tp
 join session s on s.id = tp.session_id
 join campagne c on c.id = s.campagne_id
 join plaque p on p.id = s.plaque_id, vendeur v
where c.libelle = 'Juin 2026' and p.libelle = 'CENTRE'
  and tp.libelle = 'LUCIEN MARCHETTI — TABLE 3' and v.nom = 'THÉO ROUSSET';
insert into affectation (table_id, vendeur_id)
select tp.id, v.id
from table_phoning tp
 join session s on s.id = tp.session_id
 join campagne c on c.id = s.campagne_id
 join plaque p on p.id = s.plaque_id, vendeur v
where c.libelle = 'Juin 2026' and p.libelle = 'CENTRE'
  and tp.libelle = 'LUCIEN MARCHETTI — TABLE 3' and v.nom = 'QUENTIN BELLAIGUES';
insert into affectation (table_id, vendeur_id)
select tp.id, v.id
from table_phoning tp
 join session s on s.id = tp.session_id
 join campagne c on c.id = s.campagne_id
 join plaque p on p.id = s.plaque_id, vendeur v
where c.libelle = 'Juin 2026' and p.libelle = 'CENTRE'
  and tp.libelle = 'LUCIEN MARCHETTI — TABLE 3' and v.nom = 'ROBIN GUERY';
insert into affectation (table_id, vendeur_id)
select tp.id, v.id
from table_phoning tp
 join session s on s.id = tp.session_id
 join campagne c on c.id = s.campagne_id
 join plaque p on p.id = s.plaque_id, vendeur v
where c.libelle = 'Juin 2026' and p.libelle = 'CENTRE'
  and tp.libelle = 'LUCIEN MARCHETTI — TABLE 3' and v.nom = 'EMILIEN SOLEILHAVOUP';
insert into table_phoning (session_id, libelle, ordre)
select s.id, 'JF LARGET — TABLE 4', 0
from session s join campagne c on c.id = s.campagne_id
               join plaque p   on p.id = s.plaque_id
where c.libelle = 'Juin 2026' and p.libelle = 'CENTRE';
insert into affectation (table_id, vendeur_id)
select tp.id, v.id
from table_phoning tp
 join session s on s.id = tp.session_id
 join campagne c on c.id = s.campagne_id
 join plaque p on p.id = s.plaque_id, vendeur v
where c.libelle = 'Juin 2026' and p.libelle = 'CENTRE'
  and tp.libelle = 'JF LARGET — TABLE 4' and v.nom = 'THIERRY MARTINEZ';
insert into affectation (table_id, vendeur_id)
select tp.id, v.id
from table_phoning tp
 join session s on s.id = tp.session_id
 join campagne c on c.id = s.campagne_id
 join plaque p on p.id = s.plaque_id, vendeur v
where c.libelle = 'Juin 2026' and p.libelle = 'CENTRE'
  and tp.libelle = 'JF LARGET — TABLE 4' and v.nom = 'OCEANE ESPINASSE';
insert into affectation (table_id, vendeur_id)
select tp.id, v.id
from table_phoning tp
 join session s on s.id = tp.session_id
 join campagne c on c.id = s.campagne_id
 join plaque p on p.id = s.plaque_id, vendeur v
where c.libelle = 'Juin 2026' and p.libelle = 'CENTRE'
  and tp.libelle = 'JF LARGET — TABLE 4' and v.nom = 'JEAN-PIERRE FERRIER';
insert into affectation (table_id, vendeur_id)
select tp.id, v.id
from table_phoning tp
 join session s on s.id = tp.session_id
 join campagne c on c.id = s.campagne_id
 join plaque p on p.id = s.plaque_id, vendeur v
where c.libelle = 'Juin 2026' and p.libelle = 'CENTRE'
  and tp.libelle = 'JF LARGET — TABLE 4' and v.nom = 'VIRGINIE CUMINAL';
insert into affectation (table_id, vendeur_id)
select tp.id, v.id
from table_phoning tp
 join session s on s.id = tp.session_id
 join campagne c on c.id = s.campagne_id
 join plaque p on p.id = s.plaque_id, vendeur v
where c.libelle = 'Juin 2026' and p.libelle = 'CENTRE'
  and tp.libelle = 'JF LARGET — TABLE 4' and v.nom = 'KEVIN DIJOUX';
insert into affectation (table_id, vendeur_id)
select tp.id, v.id
from table_phoning tp
 join session s on s.id = tp.session_id
 join campagne c on c.id = s.campagne_id
 join plaque p on p.id = s.plaque_id, vendeur v
where c.libelle = 'Juin 2026' and p.libelle = 'CENTRE'
  and tp.libelle = 'JF LARGET — TABLE 4' and v.nom = 'UGO FERVEL';
insert into table_phoning (session_id, libelle, ordre)
select s.id, 'MICKAEL MASSON — TABLE 5', 0
from session s join campagne c on c.id = s.campagne_id
               join plaque p   on p.id = s.plaque_id
where c.libelle = 'Juin 2026' and p.libelle = 'CENTRE';
insert into affectation (table_id, vendeur_id)
select tp.id, v.id
from table_phoning tp
 join session s on s.id = tp.session_id
 join campagne c on c.id = s.campagne_id
 join plaque p on p.id = s.plaque_id, vendeur v
where c.libelle = 'Juin 2026' and p.libelle = 'CENTRE'
  and tp.libelle = 'MICKAEL MASSON — TABLE 5' and v.nom = 'STÉPHANE VANDAMME';
insert into affectation (table_id, vendeur_id)
select tp.id, v.id
from table_phoning tp
 join session s on s.id = tp.session_id
 join campagne c on c.id = s.campagne_id
 join plaque p on p.id = s.plaque_id, vendeur v
where c.libelle = 'Juin 2026' and p.libelle = 'CENTRE'
  and tp.libelle = 'MICKAEL MASSON — TABLE 5' and v.nom = 'YANN DE OLIVEIRA';
insert into affectation (table_id, vendeur_id)
select tp.id, v.id
from table_phoning tp
 join session s on s.id = tp.session_id
 join campagne c on c.id = s.campagne_id
 join plaque p on p.id = s.plaque_id, vendeur v
where c.libelle = 'Juin 2026' and p.libelle = 'CENTRE'
  and tp.libelle = 'MICKAEL MASSON — TABLE 5' and v.nom = 'MATTHIAS VALLE';
insert into affectation (table_id, vendeur_id)
select tp.id, v.id
from table_phoning tp
 join session s on s.id = tp.session_id
 join campagne c on c.id = s.campagne_id
 join plaque p on p.id = s.plaque_id, vendeur v
where c.libelle = 'Juin 2026' and p.libelle = 'CENTRE'
  and tp.libelle = 'MICKAEL MASSON — TABLE 5' and v.nom = 'QUENTIN VANINI';
insert into affectation (table_id, vendeur_id)
select tp.id, v.id
from table_phoning tp
 join session s on s.id = tp.session_id
 join campagne c on c.id = s.campagne_id
 join plaque p on p.id = s.plaque_id, vendeur v
where c.libelle = 'Juin 2026' and p.libelle = 'CENTRE'
  and tp.libelle = 'MICKAEL MASSON — TABLE 5' and v.nom = 'JULIEN BIASUTTI';
insert into affectation (table_id, vendeur_id)
select tp.id, v.id
from table_phoning tp
 join session s on s.id = tp.session_id
 join campagne c on c.id = s.campagne_id
 join plaque p on p.id = s.plaque_id, vendeur v
where c.libelle = 'Juin 2026' and p.libelle = 'CENTRE'
  and tp.libelle = 'MICKAEL MASSON — TABLE 5' and v.nom = 'THOMAS SOULIER';
insert into table_phoning (session_id, libelle, ordre)
select s.id, 'FRANCK NOGUES — TABLE 1', 0
from session s join campagne c on c.id = s.campagne_id
               join plaque p   on p.id = s.plaque_id
where c.libelle = 'Juin 2026' and p.libelle = 'SUD';
insert into affectation (table_id, vendeur_id)
select tp.id, v.id
from table_phoning tp
 join session s on s.id = tp.session_id
 join campagne c on c.id = s.campagne_id
 join plaque p on p.id = s.plaque_id, vendeur v
where c.libelle = 'Juin 2026' and p.libelle = 'SUD'
  and tp.libelle = 'FRANCK NOGUES — TABLE 1' and v.nom = 'YOANN PICARD';
insert into affectation (table_id, vendeur_id)
select tp.id, v.id
from table_phoning tp
 join session s on s.id = tp.session_id
 join campagne c on c.id = s.campagne_id
 join plaque p on p.id = s.plaque_id, vendeur v
where c.libelle = 'Juin 2026' and p.libelle = 'SUD'
  and tp.libelle = 'FRANCK NOGUES — TABLE 1' and v.nom = 'DYLAN NOGUEIRA';
insert into affectation (table_id, vendeur_id)
select tp.id, v.id
from table_phoning tp
 join session s on s.id = tp.session_id
 join campagne c on c.id = s.campagne_id
 join plaque p on p.id = s.plaque_id, vendeur v
where c.libelle = 'Juin 2026' and p.libelle = 'SUD'
  and tp.libelle = 'FRANCK NOGUES — TABLE 1' and v.nom = 'VALENTIN MOLINES';
insert into affectation (table_id, vendeur_id)
select tp.id, v.id
from table_phoning tp
 join session s on s.id = tp.session_id
 join campagne c on c.id = s.campagne_id
 join plaque p on p.id = s.plaque_id, vendeur v
where c.libelle = 'Juin 2026' and p.libelle = 'SUD'
  and tp.libelle = 'FRANCK NOGUES — TABLE 1' and v.nom = 'GUILLAUME SAVINEL';
insert into affectation (table_id, vendeur_id)
select tp.id, v.id
from table_phoning tp
 join session s on s.id = tp.session_id
 join campagne c on c.id = s.campagne_id
 join plaque p on p.id = s.plaque_id, vendeur v
where c.libelle = 'Juin 2026' and p.libelle = 'SUD'
  and tp.libelle = 'FRANCK NOGUES — TABLE 1' and v.nom = 'REDWANE TOULOUSE';
insert into affectation (table_id, vendeur_id)
select tp.id, v.id
from table_phoning tp
 join session s on s.id = tp.session_id
 join campagne c on c.id = s.campagne_id
 join plaque p on p.id = s.plaque_id, vendeur v
where c.libelle = 'Juin 2026' and p.libelle = 'SUD'
  and tp.libelle = 'FRANCK NOGUES — TABLE 1' and v.nom = 'MAGALI MICHEL';
insert into table_phoning (session_id, libelle, ordre)
select s.id, 'JÉRÔME HÉBERT — TABLE 2', 0
from session s join campagne c on c.id = s.campagne_id
               join plaque p   on p.id = s.plaque_id
where c.libelle = 'Juin 2026' and p.libelle = 'SUD';
insert into affectation (table_id, vendeur_id)
select tp.id, v.id
from table_phoning tp
 join session s on s.id = tp.session_id
 join campagne c on c.id = s.campagne_id
 join plaque p on p.id = s.plaque_id, vendeur v
where c.libelle = 'Juin 2026' and p.libelle = 'SUD'
  and tp.libelle = 'JÉRÔME HÉBERT — TABLE 2' and v.nom = 'JEAN-PAUL RANVOISE';
insert into affectation (table_id, vendeur_id)
select tp.id, v.id
from table_phoning tp
 join session s on s.id = tp.session_id
 join campagne c on c.id = s.campagne_id
 join plaque p on p.id = s.plaque_id, vendeur v
where c.libelle = 'Juin 2026' and p.libelle = 'SUD'
  and tp.libelle = 'JÉRÔME HÉBERT — TABLE 2' and v.nom = 'ARTHUR DURANTON';
insert into affectation (table_id, vendeur_id)
select tp.id, v.id
from table_phoning tp
 join session s on s.id = tp.session_id
 join campagne c on c.id = s.campagne_id
 join plaque p on p.id = s.plaque_id, vendeur v
where c.libelle = 'Juin 2026' and p.libelle = 'SUD'
  and tp.libelle = 'JÉRÔME HÉBERT — TABLE 2' and v.nom = 'AMÉLIE HERVÉ';
insert into affectation (table_id, vendeur_id)
select tp.id, v.id
from table_phoning tp
 join session s on s.id = tp.session_id
 join campagne c on c.id = s.campagne_id
 join plaque p on p.id = s.plaque_id, vendeur v
where c.libelle = 'Juin 2026' and p.libelle = 'SUD'
  and tp.libelle = 'JÉRÔME HÉBERT — TABLE 2' and v.nom = 'SÉBASTIEN DUMONT';
insert into affectation (table_id, vendeur_id)
select tp.id, v.id
from table_phoning tp
 join session s on s.id = tp.session_id
 join campagne c on c.id = s.campagne_id
 join plaque p on p.id = s.plaque_id, vendeur v
where c.libelle = 'Juin 2026' and p.libelle = 'SUD'
  and tp.libelle = 'JÉRÔME HÉBERT — TABLE 2' and v.nom = 'WILLIAM PASCAL';
insert into affectation (table_id, vendeur_id)
select tp.id, v.id
from table_phoning tp
 join session s on s.id = tp.session_id
 join campagne c on c.id = s.campagne_id
 join plaque p on p.id = s.plaque_id, vendeur v
where c.libelle = 'Juin 2026' and p.libelle = 'SUD'
  and tp.libelle = 'JÉRÔME HÉBERT — TABLE 2' and v.nom = 'FRANCOIS LENAIC';
insert into table_phoning (session_id, libelle, ordre)
select s.id, 'GILLES PARRAIN — TABLE 3', 0
from session s join campagne c on c.id = s.campagne_id
               join plaque p   on p.id = s.plaque_id
where c.libelle = 'Juin 2026' and p.libelle = 'SUD';
insert into affectation (table_id, vendeur_id)
select tp.id, v.id
from table_phoning tp
 join session s on s.id = tp.session_id
 join campagne c on c.id = s.campagne_id
 join plaque p on p.id = s.plaque_id, vendeur v
where c.libelle = 'Juin 2026' and p.libelle = 'SUD'
  and tp.libelle = 'GILLES PARRAIN — TABLE 3' and v.nom = 'ARNAUD GALLAND';
insert into affectation (table_id, vendeur_id)
select tp.id, v.id
from table_phoning tp
 join session s on s.id = tp.session_id
 join campagne c on c.id = s.campagne_id
 join plaque p on p.id = s.plaque_id, vendeur v
where c.libelle = 'Juin 2026' and p.libelle = 'SUD'
  and tp.libelle = 'GILLES PARRAIN — TABLE 3' and v.nom = 'RICHARD WEISSELDINGER';
insert into affectation (table_id, vendeur_id)
select tp.id, v.id
from table_phoning tp
 join session s on s.id = tp.session_id
 join campagne c on c.id = s.campagne_id
 join plaque p on p.id = s.plaque_id, vendeur v
where c.libelle = 'Juin 2026' and p.libelle = 'SUD'
  and tp.libelle = 'GILLES PARRAIN — TABLE 3' and v.nom = 'JÉRÉMY DA COSTA';
insert into affectation (table_id, vendeur_id)
select tp.id, v.id
from table_phoning tp
 join session s on s.id = tp.session_id
 join campagne c on c.id = s.campagne_id
 join plaque p on p.id = s.plaque_id, vendeur v
where c.libelle = 'Juin 2026' and p.libelle = 'SUD'
  and tp.libelle = 'GILLES PARRAIN — TABLE 3' and v.nom = 'STÉPHANE DALLO-BELLESSA';
insert into affectation (table_id, vendeur_id)
select tp.id, v.id
from table_phoning tp
 join session s on s.id = tp.session_id
 join campagne c on c.id = s.campagne_id
 join plaque p on p.id = s.plaque_id, vendeur v
where c.libelle = 'Juin 2026' and p.libelle = 'SUD'
  and tp.libelle = 'GILLES PARRAIN — TABLE 3' and v.nom = 'STANISLAS RODAMEL';
insert into affectation (table_id, vendeur_id)
select tp.id, v.id
from table_phoning tp
 join session s on s.id = tp.session_id
 join campagne c on c.id = s.campagne_id
 join plaque p on p.id = s.plaque_id, vendeur v
where c.libelle = 'Juin 2026' and p.libelle = 'SUD'
  and tp.libelle = 'GILLES PARRAIN — TABLE 3' and v.nom = 'JULIEN MONATTE';

-- Chefs de table : SEVERINE BESSON, THIERRY COIGNAC, LUCIEN MARCHETTI, JF LARGET,
-- MICKAEL MASSON (CENTRE), FRANCK NOGUES, JEROME HEBERT, GILLES PARRAIN (SUD).
-- Aucun n'apparait dans la liste des 99 vendeurs : ce sont des encadrants.
-- A creer comme utilisateurs, puis rattacher via table_phoning.chef_user_id.

commit;

