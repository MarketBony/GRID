-- ============================================================================
-- UN VENDEUR ABSENT D'UNE CAMPAGNE NE PEUT PAS ETRE AFFECTE A SES TABLES.
--
-- CE QUI A ETE OBSERVE, signale par l'utilisateur le 01/09/2026 : trois vendeurs
-- sortis fin juillet et fin aout figuraient encore dans les tables de la session
-- de SEPTEMBRE.
--
--   BLANDINE CLEMENT        sortie 2026-07-31  ->  TABLE 2 - EAA
--   PIERRE-EDOUARD LAROCHE  sortie 2026-07-31  ->  TABLE 5 - EAA
--   UGO FERVEL              sortie 2026-08-31  ->  TABLE 3 - EAA
--
-- La vue `relance.perimetre_saisie`, elle, les excluait correctement : l'ecran de
-- SAISIE ne les proposait pas, l'ecran des TABLES les affichait. Deux ecrans, une
-- campagne, deux reponses — et c'est celui qui compose les tables qui avait tort.
--
-- ---------------------------------------------------------------------------
-- POURQUOI LA REGLE MANQUAIT ICI ALORS QU'ELLE EXISTE PARTOUT AILLEURS
-- ---------------------------------------------------------------------------
-- Elle est ecrite dans `relance.perimetre_saisie` (lecture), dans
-- `utils/presenceVendeur.ts` (dashboard et, depuis aujourd'hui, ecran des
-- tables), et dans `relance.session_reprendre` — dont le commentaire dit meme
-- « verifie ici EN PLUS du trigger ».
--
-- CE TRIGGER N'EXISTAIT PAS. La ceinture sans les bretelles : `session_reprendre`
-- se gardait tout seul, mais `table_definir_vendeurs` et
-- `session_appliquer_repartition` ne verifiaient rien, et un `INSERT` direct par
-- PostgREST encore moins.
--
-- ---------------------------------------------------------------------------
-- CE QU'IL NE FAIT PAS, ET POURQUOI
-- ---------------------------------------------------------------------------
-- Il n'archive RIEN retroactivement. Le cas reel n'est d'ailleurs pas celui qu'il
-- attrape : les trois affectations etaient JUSTES quand elles ont ete posees, et
-- la date de sortie a ete renseignee apres. Aucun trigger sur `affectation` ne
-- peut voir venir une mise a jour de `vendeur`.
--
-- C'est donc la LECTURE qui doit trancher, et elle le fait desormais des deux
-- cotes. Ce trigger ferme l'autre direction : affecter quelqu'un dont on sait
-- DEJA qu'il est parti.
--
-- Et il ne detruit pas l'historique : une affectation de juin reste vraie pour
-- juin. Seule l'appartenance a une campagne ou le vendeur n'etait pas la est
-- refusee.
-- ============================================================================

SET search_path TO relance, public;

CREATE OR REPLACE FUNCTION relance.verifier_affectation_presence()
RETURNS trigger
LANGUAGE plpgsql
-- SECURITY DEFINER pour la meme raison que les huit autres `verifier_*` : sous
-- RLS, un trigger `invoker` ne voit que les lignes visibles a l'appelant. Il
-- rendrait alors un verdict FAUX — « ce vendeur n'existe pas » pour un vendeur
-- qui existe — au lieu de refuser ce qu'il doit refuser.
SECURITY DEFINER
SET search_path = relance, public, pg_temp
AS $fn$
DECLARE
  v      record;
  c      record;
BEGIN
  -- ARCHIVER RESTE TOUJOURS POSSIBLE. Sans cette sortie, retirer de sa table un
  -- vendeur qui vient de partir serait refuse par le controle cense l'empecher
  -- d'y etre : on ne pourrait plus corriger la situation qu'on denonce.
  IF NEW.archive_le IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT ve.nom, ve.date_entree, ve.date_sortie, ve.archive_le
    INTO v
    FROM relance.vendeur ve
   WHERE ve.id = NEW.vendeur_id;

  SELECT ca.libelle, ca.date_debut, ca.date_fin
    INTO c
    FROM relance.table_phoning tp
    JOIN relance.session_plaque sp ON sp.id = tp.session_plaque_id
    JOIN relance.campagne ca       ON ca.id = sp.campagne_id
   WHERE tp.id = NEW.table_id;

  IF v IS NULL OR c IS NULL THEN
    RETURN NEW; -- les cles etrangeres s'en chargeront, ce n'est pas notre role
  END IF;

  IF v.archive_le IS NOT NULL THEN
    RAISE EXCEPTION 'RELANCE: % est archive : il ne peut etre affecte a aucune table.', v.nom;
  END IF;

  -- MEME REGLE, MOT POUR MOT, QUE `relance.perimetre_saisie`. Une date nulle
  -- signifie << depuis toujours >> ou << pour toujours >> : le fichier source
  -- n'a pas les dates d'entree des 99 vendeurs importes.
  IF v.date_entree IS NOT NULL AND v.date_entree > c.date_fin THEN
    RAISE EXCEPTION
      'RELANCE: % entre le % : il n''etait pas encore la pendant « % » (% au %).',
      v.nom, to_char(v.date_entree, 'DD/MM/YYYY'), c.libelle,
      to_char(c.date_debut, 'DD/MM/YYYY'), to_char(c.date_fin, 'DD/MM/YYYY');
  END IF;

  IF v.date_sortie IS NOT NULL AND v.date_sortie < c.date_debut THEN
    RAISE EXCEPTION
      'RELANCE: % est sorti le % : il n''etait plus la pendant « % » (% au %).',
      v.nom, to_char(v.date_sortie, 'DD/MM/YYYY'), c.libelle,
      to_char(c.date_debut, 'DD/MM/YYYY'), to_char(c.date_fin, 'DD/MM/YYYY');
  END IF;

  RETURN NEW;
END
$fn$;

DROP TRIGGER IF EXISTS affectation_vendeur_present ON relance.affectation;
CREATE TRIGGER affectation_vendeur_present
  BEFORE INSERT OR UPDATE ON relance.affectation
  FOR EACH ROW EXECUTE FUNCTION relance.verifier_affectation_presence();

-- Le trigger n'est appelable que comme trigger ; on ne laisse pas `PUBLIC`
-- l'executer pour autant. Meme hygiene que le reste du schema.
REVOKE EXECUTE ON FUNCTION relance.verifier_affectation_presence() FROM PUBLIC;
