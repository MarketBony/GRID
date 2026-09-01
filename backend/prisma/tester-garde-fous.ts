// ============================================================================
// TEST DES GARDE-FOUS DE LA BASE
//
// Verifie que les invariants se DECLENCHENT vraiment. Une contrainte qu'on n'a
// jamais vue refuser quelque chose n'est pas une contrainte, c'est une intention.
//
// Chaque test tourne dans SA transaction, toujours annulee : rien ne subsiste en
// base. C'est aussi la seule facon de tester proprement, puisqu'une instruction
// en echec avorte la transaction en cours — un test par transaction evite qu'un
// echec attendu ne contamine le suivant. Et cela evite d'avoir besoin de
// supprimer quoi que ce soit, ce que les triggers interdisent par ailleurs.
//
// Usage : npm --prefix backend run test:garde-fous
// ============================================================================

import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

const ROLLBACK = 'ROLLBACK_VOULU';
type Tx = Prisma.TransactionClient;

const resultats: { nom: string; ok: boolean; detail: string }[] = [];

/// Attend que l'operation ECHOUE avec un message contenant `motif`.
async function doitRefuser(nom: string, motif: string, operation: (tx: Tx) => Promise<unknown>) {
  try {
    await prisma.$transaction(async (tx) => {
      await operation(tx);
      throw new Error(ROLLBACK); // l'operation a passe : c'est l'echec du test
    });
    resultats.push({ nom, ok: false, detail: 'accepte alors que ce devait etre refuse' });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (message.includes(ROLLBACK)) {
      resultats.push({ nom, ok: false, detail: 'accepte alors que ce devait etre refuse' });
    } else if (message.includes(motif)) {
      resultats.push({ nom, ok: true, detail: `refuse : ${motif}` });
    } else {
      resultats.push({
        nom,
        ok: false,
        detail: `refuse pour une AUTRE raison que "${motif}" : ${message.slice(0, 160).replace(/\s+/g, ' ')}`,
      });
    }
  }
}

/// Attend que l'operation REUSSISSE. La transaction est annulee ensuite.
async function doitAccepter(nom: string, operation: (tx: Tx) => Promise<unknown>) {
  try {
    await prisma.$transaction(async (tx) => {
      await operation(tx);
      throw new Error(ROLLBACK);
    });
    resultats.push({ nom, ok: false, detail: 'transaction non annulee (anormal)' });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (message.includes(ROLLBACK)) {
      resultats.push({ nom, ok: true, detail: 'accepte' });
    } else {
      resultats.push({
        nom,
        ok: false,
        detail: `refuse alors que ce devait passer : ${message.slice(0, 200).replace(/\s+/g, ' ')}`,
      });
    }
  }
}

const jour = (iso: string) => new Date(`${iso}T00:00:00Z`);

async function main() {
  const rdvAvant = await prisma.rdv.count();
  const juin = await prisma.campagne.findUniqueOrThrow({ where: { libelle: 'Juin 2026' } });
  const renault = await prisma.marque.findUniqueOrThrow({ where: { code: 'RENAULT' } });
  const alpine = await prisma.marque.findUniqueOrThrow({ where: { code: 'ALPINE' } });

  // Un vendeur autorise Renault + Dacia, mais PAS Alpine (cas des 97 sur 99).
  // Un vendeur VN autorise Renault : c'est le cas majoritaire (70 des 99), et le
  // seul sur lequel les tests de marque ont un sens. Un vendeur VO n'a pas de
  // marque du tout.
  const vendeurRenault = await prisma.vendeur.findFirstOrThrow({
    where: { typeVehicule: 'VN', marques: { some: { marqueId: renault.id } } },
    orderBy: { id: 'asc' },
  });

  const premierJour = await prisma.campagneJour.findFirstOrThrow({
    where: { campagneId: juin.id },
    orderBy: { ordre: 'asc' },
  });
  const premierCreneau = await prisma.campagneCreneau.findFirstOrThrow({
    where: { campagneId: juin.id },
    orderBy: { ordre: 'asc' },
  });

  const rdvValide = {
    campagneId: juin.id,
    vendeurId: vendeurRenault.id,
    jour: premierJour.jour,
    creneauCode: premierCreneau.code,
    marqueId: renault.id,
    typeVehicule: 'VN',
    client: 'CLIENT TEST',
  };

  // ---------------------------------------------------------------- R-C.1
  await doitAccepter('R-C.1  RDV sur une marque autorisee', (tx) =>
    tx.rdv.create({ data: rdvValide })
  );

  await doitRefuser(
    "R-C.1  RDV sur une marque NON autorisee",
    "n'est pas autorise a vendre",
    (tx) => tx.rdv.create({ data: { ...rdvValide, marqueId: alpine.id } })
  );

  // ---------------------------------------------------------------- VN/VO
  // Le metier du vendeur est un SCALAIRE (VN ou VO), lu dans l'onglet RESULTATS du
  // fichier source. Trois invariants en decoulent, tous verifies ici.

  // 1. Le type du RDV doit etre celui de son vendeur. Sans ce controle, les totaux
  //    VN/VO de l'onglet SUIVI melangeraient deux metiers.
  await doitRefuser(
    'VN/VO  RDV dont le type contredit le metier du vendeur',
    'il ne peut pas recevoir un RDV',
    (tx) => tx.rdv.create({ data: { ...rdvValide, typeVehicule: 'VO' } })
  );

  // 2. Un vendeur VN DOIT porter une marque : c'est elle qui donne les sections de
  //    sa grille (« NB RDV RENAULT », « NB RDV DACIA »).
  await doitRefuser(
    'VN/VO  RDV d un vendeur VN sans marque',
    'la marque du RDV est obligatoire',
    (tx) => tx.rdv.create({ data: { ...rdvValide, marqueId: null } })
  );

  // 3. Un vendeur VO ne DOIT PAS porter de marque : le fichier ne lui donne aucune
  //    ventilation, seulement un total.
  const vendeurVo = await prisma.vendeur.findFirstOrThrow({
    where: { typeVehicule: 'VO' },
    orderBy: { id: 'asc' },
  });

  await doitAccepter('VN/VO  RDV d un vendeur VO sans marque', (tx) =>
    tx.rdv.create({
      data: { ...rdvValide, vendeurId: vendeurVo.id, typeVehicule: 'VO', marqueId: null },
    })
  );

  await doitRefuser(
    'VN/VO  RDV d un vendeur VO AVEC une marque',
    'ses RDV ne portent pas de marque',
    (tx) =>
      tx.rdv.create({
        data: { ...rdvValide, vendeurId: vendeurVo.id, typeVehicule: 'VO', marqueId: renault.id },
      })
  );

  await doitRefuser('CHECK  metier de vendeur invalide', 'vendeur_type_check', (tx) =>
    tx.vendeur.update({ where: { id: vendeurRenault.id }, data: { typeVehicule: 'VD' } })
  );

  // ---------------------------------------------------------------- R-A.2
  // Cle etrangere composite : un jour hors campagne doit echouer EN BASE, pour
  // que l'interface soit obligee de traiter le cas au lieu de creer un orphelin.
  await doitRefuser(
    'R-A.2  RDV sur un jour absent de la campagne',
    'foreign key constraint',
    (tx) => tx.rdv.create({ data: { ...rdvValide, jour: jour('2026-07-01') } })
  );

  await doitRefuser(
    'R-A.2  RDV sur un creneau absent de la campagne',
    'foreign key constraint',
    (tx) => tx.rdv.create({ data: { ...rdvValide, creneauCode: '23:00-00:00' } })
  );

  // ---------------------------------------------------------------- CHECK
  await doitRefuser('CHECK  type de vehicule invalide', 'rdv_type_vehicule_check', (tx) =>
    tx.rdv.create({ data: { ...rdvValide, typeVehicule: 'VD' } })
  );

  await doitRefuser('CHECK  nom de client vide', 'rdv_client_non_vide_check', (tx) =>
    tx.rdv.create({ data: { ...rdvValide, client: '   ' } })
  );

  await doitRefuser('CHECK  role global inconnu', 'role_global_role_check', (tx) =>
    tx.roleGlobal.create({ data: { utilisateurId: 1n, role: 'superadmin' } })
  );

  // Un `chef_plaque` sans plaque ne donne aucun droit tout en ressemblant a un
  // droit accorde : le pire cas d'un modele d'autorisation.
  await doitRefuser('CHECK  chef_plaque sans plaque', 'role_campagne_portee_check', (tx) =>
    tx.roleCampagne.create({
      data: { campagneId: juin.id, utilisateurId: 1n, role: 'chef_plaque' },
    })
  );

  // ---------------------------------------------------------------- R-B.4
  const tables = await prisma.tablePhoning.findMany({
    where: { sessionPlaque: { campagneId: juin.id } },
    include: { sessionPlaque: true, affectations: { take: 1, where: { archiveLe: null } } },
    orderBy: { id: 'asc' },
  });
  const table1 = tables.find((t) => t.affectations.length > 0);
  const table2 = tables.find(
    (t) => table1 && t.id !== table1.id && t.sessionPlaque.plaqueId === table1.sessionPlaque.plaqueId
  );
  const vendeurDejaAffecte = table1?.affectations[0]?.vendeurId;

  if (table1 && table2 && vendeurDejaAffecte) {
    await doitRefuser(
      'R-B.4  vendeur affecte a une SECONDE table de la campagne',
      'deja affecte a la table',
      (tx) => tx.affectation.create({ data: { tableId: table2.id, vendeurId: vendeurDejaAffecte } })
    );

    // Regression du bug trouve par le test d'idempotence du seed : reaffecter a
    // la MEME table n'a jamais ete une violation de R-B.4.
    await doitAccepter('R-B.4  reaffectation a la MEME table (non-regression)', (tx) =>
      tx.affectation.upsert({
        where: { tableId_vendeurId: { tableId: table1.id, vendeurId: vendeurDejaAffecte } },
        update: { archiveLe: null },
        create: { tableId: table1.id, vendeurId: vendeurDejaAffecte },
      })
    );
  } else {
    resultats.push({
      nom: 'R-B.4  tests d\'affectation',
      ok: false,
      detail: 'jeu de donnees insuffisant (deux tables de la meme plaque requises)',
    });
  }

  // ---------------------------------------------------------------- R-B.1
  // << Une table ne peut contenir que des vendeurs de sa propre plaque. >>
  //
  // Regle inscrite au cahier des charges depuis le debut, et que RIEN ne tenait
  // avant la migration `20260828160000_affectation_meme_plaque`. Elle n'avait pose
  // aucun probleme parce que seul le seed ecrivait des affectations. Le module B
  // change cela : c'est l'ecran qui peut la violer.
  if (table1) {
    const plaqueDeLaTable = table1.sessionPlaque.plaqueId;
    // Un vendeur d'une AUTRE plaque, trouve par jointure sur `site.plaque_id` —
    // jamais par une plaque derivee autrement.
    const etranger = await prisma.vendeur.findFirst({
      where: { site: { plaqueId: { not: plaqueDeLaTable } } },
      select: { id: true, nom: true, site: { select: { plaque: { select: { libelle: true } } } } },
    });

    if (etranger) {
      await doitRefuser(
        'R-B.1  vendeur d\'une AUTRE plaque affecte a la table',
        'autre plaque',
        (tx) => tx.affectation.create({ data: { tableId: table1.id, vendeurId: etranger.id } })
      );
    } else {
      resultats.push({
        nom: 'R-B.1  affectation hors plaque',
        ok: false,
        detail: 'jeu de donnees insuffisant (aucun vendeur d\'une autre plaque)',
      });
    }

    // Non-regression : le garde-fou ne doit pas gener une affectation LEGITIME.
    // Un invariant qui refuse tout est aussi inutile qu'un invariant qui n'a
    // jamais rien refuse.
    // Le vendeur doit etre de la MEME plaque ET libre de toute affectation sur
    // cette campagne : un vendeur deja place ailleurs serait refuse par R-B.4, et
    // le test accuserait le mauvais invariant. C'est exactement ce qui est arrive
    // a la premiere ecriture de ce test.
    // LE VENDEUR EST FABRIQUE ICI, PAS CHERCHE EN BASE — et c'est un correctif.
    //
    // Cette version cherchait un vendeur de la plaque encore libre sur la campagne.
    // Sur une base FRAICHEMENT SEEDEE il n'en existe aucun : CENTRE compte
    // 30 vendeurs et 5 tables de 6, l'effectif est exactement sature. Le test ne
    // tournait donc que sur une base polluee par des executions precedentes — en
    // local, deux vendeurs residuels le rendaient possible. Il a saute au premier
    // passage sur Supabase, ou la base etait propre : 32 controles au lieu de 33.
    //
    // Un controle qui ne s'execute que par accident ne prouve rien, et sa
    // disparition etait SILENCIEUSE : le `if` n'avait pas de `else`, contrairement
    // a toutes les autres branches de ce fichier. Les deux defauts sont corriges —
    // le vendeur est cree dans la transaction annulee, et l'absence de site
    // remonte comme un echec au lieu de s'evaporer.
    const siteDeLaPlaque = await prisma.site.findFirst({
      where: { plaqueId: plaqueDeLaTable },
      select: { id: true },
    });
    if (siteDeLaPlaque) {
      await doitAccepter('R-B.1  vendeur de LA MEME plaque accepte (non-regression)', async (tx) => {
        const neuf = await tx.vendeur.create({
          data: {
            nom: 'GARDE-FOU MEME PLAQUE',
            siteId: siteDeLaPlaque.id,
            // `VO` : aucune marque a poser, donc le controle porte bien sur
            // R-B.1 et ne peut pas trebucher sur R-C.1 au passage.
            typeVehicule: 'VO',
          },
          select: { id: true },
        });
        return tx.affectation.create({ data: { tableId: table1.id, vendeurId: neuf.id } });
      });
    } else {
      resultats.push({
        nom: 'R-B.1  vendeur de LA MEME plaque accepte (non-regression)',
        ok: false,
        detail: 'jeu de donnees insuffisant (aucun site sur la plaque de la table)',
      });
    }
  }

  // ---------------------------------------------------------------- presence
  //
  // UN VENDEUR ABSENT DE LA CAMPAGNE N'ENTRE PAS DANS SES TABLES.
  //
  // La regle vivait dans la vue `perimetre_saisie` (lecture) et dans
  // `session_reprendre` — dont le commentaire disait « verifie ici EN PLUS du
  // trigger ». Ce trigger n'existait pas : `table_definir_vendeurs`,
  // `session_appliquer_repartition` et un INSERT direct par PostgREST ne
  // verifiaient rien. Constate le 01/09/2026, signale par l'utilisateur : trois
  // vendeurs sortis en juillet et aout figuraient dans la session de septembre.
  //
  // Les deux bornes sont eprouvees, parce qu'elles se trompent dans des sens
  // opposes : sorti AVANT le debut, entre APRES la fin.
  if (table1) {
    const plaqueDeLaTable = table1.sessionPlaque.plaqueId;
    const siteDeLaPlaque = await prisma.site.findFirst({
      where: { plaqueId: plaqueDeLaTable },
      select: { id: true },
    });

    if (siteDeLaPlaque) {
      // Le vendeur est FABRIQUE dans la transaction annulee, jamais cherche en
      // base : un controle qui ne s'execute que si le jeu de donnees s'y prete
      // ne prouve rien, et sa disparition serait silencieuse. Lecon de R-B.1.
      const avecDates = (dateEntree: Date | null, dateSortie: Date | null) => async (tx: Tx) => {
        const neuf = await tx.vendeur.create({
          data: {
            nom: 'GARDE-FOU PRESENCE',
            siteId: siteDeLaPlaque.id,
            typeVehicule: 'VO', // aucune marque a poser : on ne teste que la presence
            dateEntree,
            dateSortie,
          },
          select: { id: true },
        });
        return tx.affectation.create({ data: { tableId: table1.id, vendeurId: neuf.id } });
      };

      // Juin 2026 court du 11 au 15.
      await doitRefuser(
        'presence  vendeur SORTI avant la campagne, affecte a une table',
        'est sorti le',
        avecDates(null, new Date('2026-05-31'))
      );

      await doitRefuser(
        'presence  vendeur ENTRE apres la campagne, affecte a une table',
        "il n'etait pas encore la",
        avecDates(new Date('2026-07-01'), null)
      );

      // Non-regression : un vendeur PRESENT passe. Un garde-fou qui refuse tout
      // est aussi inutile qu'un garde-fou qui n'a jamais rien refuse.
      await doitAccepter(
        'presence  vendeur present pendant la campagne accepte (non-regression)',
        avecDates(new Date('2026-01-01'), new Date('2026-12-31'))
      );
    } else {
      resultats.push({
        nom: "presence  affectation d'un vendeur absent",
        ok: false,
        detail: 'jeu de donnees insuffisant (aucun site sur la plaque de la table)',
      });
    }
  }

  // ------------------------------------------------- dates contre RDV existants
  //
  // ON NE DECLARE PAS ABSENT QUELQU'UN DONT LES RDV PROUVENT LA PRESENCE.
  //
  // Constate le 01/09/2026 : deux vendeurs ont recu une `date_entree` posterieure
  // a juin alors qu'ils y avaient 13 et 16 RDV. Le tableau de bord de juin est
  // passe de 1107 a 1078 SANS erreur ni avertissement — la donnee brute restait
  // juste, seule la lecture mentait.
  //
  // LE JEU EST FABRIQUE DANS LA TRANSACTION, comme pour R-B.1 et R-B.5 : la base
  // locale n'a aucun RDV de juin — ils ne vivent que sur Supabase — et un controle
  // qui ne tourne que sur une des deux bases ne garde que la moitie du temps.
  {
    const jourJuin = await prisma.campagneJour.findFirst({
      where: { campagneId: juin.id },
      orderBy: { ordre: 'asc' },
      select: { jour: true },
    });
    const creneauJuin = await prisma.campagneCreneau.findFirst({
      where: { campagneId: juin.id },
      orderBy: { ordre: 'asc' },
      select: { code: true },
    });
    const siteQuelconque = await prisma.site.findFirst({
      where: { archiveLe: null },
      orderBy: { id: 'asc' },
      select: { id: true },
    });

    /// Un vendeur VO — donc sans marque a poser — porteur d'UN RDV de juin.
    /// `VO` evite de trebucher sur R-C.1 : ce n'est pas ce qu'on teste ici.
    const avecUnRdvEnJuin = async (tx: Tx) => {
      const v = await tx.vendeur.create({
        data: { nom: 'GARDE-FOU DATES', siteId: siteQuelconque!.id, typeVehicule: 'VO' },
        select: { id: true },
      });
      await tx.rdv.create({
        data: {
          campagneId: juin.id,
          vendeurId: v.id,
          jour: jourJuin!.jour,
          creneauCode: creneauJuin!.code,
          typeVehicule: 'VO',
          client: 'GARDE-FOU',
        },
      });
      return v.id;
    };

    if (jourJuin && creneauJuin && siteQuelconque) {
      // Juin court du 11 au 15 : une entree en juillet et une sortie en mai
      // excluent toutes deux le vendeur de la campagne ou il a des RDV.
      await doitRefuser(
        'dates  entree APRES une campagne ou le vendeur a des RDV',
        'disparaitraient des totaux',
        async (tx) => {
          const id = await avecUnRdvEnJuin(tx);
          return tx.vendeur.update({ where: { id }, data: { dateEntree: new Date('2026-07-31') } });
        }
      );

      await doitRefuser(
        'dates  sortie AVANT une campagne ou le vendeur a des RDV',
        'disparaitraient des totaux',
        async (tx) => {
          const id = await avecUnRdvEnJuin(tx);
          return tx.vendeur.update({ where: { id }, data: { dateSortie: new Date('2026-05-31') } });
        }
      );

      // Non-regression : des dates COHERENTES avec ses RDV passent. Un garde-fou
      // qui refuse toute date rendrait impossible de declarer un depart.
      await doitAccepter(
        'dates  sortie APRES la campagne acceptee (non-regression)',
        async (tx) => {
          const id = await avecUnRdvEnJuin(tx);
          return tx.vendeur.update({
            where: { id },
            data: { dateEntree: null, dateSortie: new Date('2026-08-31') },
          });
        }
      );
    } else {
      resultats.push({
        nom: 'dates  coherence avec les RDV existants',
        ok: false,
        detail: 'jeu de donnees insuffisant (jour, creneau ou site de juin introuvable)',
      });
    }
  }

  // ---------------------------------------------------------------- R-B.5
  // Une table SPECIALISEE n'accueille que des vendeurs autorises sur sa marque.
  //
  // La specialisation est DECLAREE (`table_phoning.marque_id`) et non deduite des
  // membres presents : une version deduite faisait dependre la composition du
  // tirage au sort, et la repartition rendait 11/8/10 au lieu de 10/10/9.
  if (table1) {
    const plaqueDeLaTable = table1.sessionPlaque.plaqueId;
    const alpine = await prisma.marque.findFirst({
      where: { code: 'ALPINE' },
      select: { id: true },
    });

    /// UN SITE DE LA PLAQUE DE LA TABLE, pour fabriquer un vendeur de secours quand
    /// aucun vendeur reel ne convient. Jointure sur `site.plaque_id` : ne jamais
    /// deriver la plaque autrement.
    ///
    /// Ces trois garde-fous cherchaient un vendeur reel LIBRE et se taisaient quand
    /// il n'y en avait pas. Ils dependaient donc de la composition des tables du
    /// moment, ce qui n'a aucun rapport avec ce qu'ils verifient.
    const siteDeLaPlaque = (
      await prisma.site.findFirst({
        where: { plaqueId: plaqueDeLaTable, archiveLe: null },
        select: { id: true },
      })
    )?.id;
    // Un vendeur de la BONNE plaque, NON autorise sur Alpine, et libre.
    const nonAutorise = alpine
      ? await prisma.vendeur.findFirst({
          where: {
            site: { plaqueId: plaqueDeLaTable },
            typeVehicule: 'VN',
            marques: { none: { marqueId: alpine.id } },
            affectations: {
              none: { archiveLe: null, table: { sessionPlaque: { campagneId: juin.id } } },
            },
          },
          select: { id: true },
        })
      : null;

    // SI AUCUN VENDEUR REEL NE CONVIENT, ON EN FABRIQUE UN DANS LA TRANSACTION.
    //
    // `doitRefuser` et `doitAccepter` forcent un ROLLBACK : rien de ce qui est cree
    // ici ne survit. C'est ce qui rend ces trois garde-fous independants de la
    // composition du moment — voir le commentaire de `siteDeLaPlaque`.
    if (alpine && siteDeLaPlaque) {
      await doitRefuser(
        'R-B.5  vendeur non autorise sur la marque de la table specialisee',
        'pas autorise a vendre',
        async (tx) => {
          await tx.tablePhoning.update({
            where: { id: table1.id },
            data: { marqueId: alpine.id },
          });
          const vendeurId =
            nonAutorise?.id ??
            (
              await tx.vendeur.create({
                data: { nom: 'GARDE-FOU VN SANS ALPINE', siteId: siteDeLaPlaque, typeVehicule: 'VN' },
                select: { id: true },
              })
            ).id;
          return tx.affectation.create({ data: { tableId: table1.id, vendeurId } });
        }
      );
    } else {
      resultats.push({
        nom: 'R-B.5  affectation hors marque',
        ok: false,
        detail: 'jeu de donnees insuffisant (marque ALPINE ou site de la plaque introuvable)',
      });
    }

    // Un vendeur VO n'a AUCUNE ventilation par marque : une table specialisee
    // n'a pas de sens pour lui.
    const vo = alpine
      ? await prisma.vendeur.findFirst({
          where: {
            site: { plaqueId: plaqueDeLaTable },
            typeVehicule: 'VO',
            affectations: {
              none: { archiveLe: null, table: { sessionPlaque: { campagneId: juin.id } } },
            },
          },
          select: { id: true },
        })
      : null;

    // CE GARDE-FOU AVAIT DISPARU EN SILENCE.
    //
    // Il ne tournait que `if (alpine && vo)`, sans branche `else`. Le seul VO libre
    // de CENTRE etait `MARC TESTEUR` ; sa purge, decidee le 31/08/2026, a fait
    // passer la suite de 33 a 32 verifications SANS AUCUN MESSAGE. Un garde-fou
    // qu'on croit couvert et qui ne tourne pas est pire qu'un garde-fou absent :
    // le compteur ment.
    if (alpine && siteDeLaPlaque) {
      await doitRefuser(
        'R-B.5  vendeur VO dans une table specialisee',
        'aucune ventilation par marque',
        async (tx) => {
          await tx.tablePhoning.update({
            where: { id: table1.id },
            data: { marqueId: alpine.id },
          });
          const vendeurId =
            vo?.id ??
            (
              await tx.vendeur.create({
                data: { nom: 'GARDE-FOU VO', siteId: siteDeLaPlaque, typeVehicule: 'VO' },
                select: { id: true },
              })
            ).id;
          return tx.affectation.create({ data: { tableId: table1.id, vendeurId } });
        }
      );
    } else {
      resultats.push({
        nom: 'R-B.5  vendeur VO dans une table specialisee',
        ok: false,
        detail: 'jeu de donnees insuffisant (marque ALPINE ou site de la plaque introuvable)',
      });
    }

    // Non-regression : une table MIXTE (`marque_id` a null) n'impose rien. C'est
    // le cas normal, et le seul observe en juin 2026.
    //
    // LE VENDEUR EST FABRIQUE, JAMAIS CHOISI EN BASE — et c'est un correctif du
    // 01/09/2026. Cette version prenait « un vendeur de la plaque encore libre sur
    // la campagne ». Sur une base REELLEMENT UTILISEE, ce vendeur peut etre
    // n'importe qui : sur Supabase il est tombe sur BAPTISTE DUBOIS, entre le
    // 01/09/2026, qu'un nouveau trigger refuse a bon droit dans une table de JUIN.
    // Le test accusait alors R-B.5 d'un refus qui venait d'ailleurs.
    //
    // Meme lecon que R-B.1 plus haut : un controle qui depend de ce que la base
    // contient ce jour-la ne teste pas ce qu'il croit tester. Sans date d'entree ni
    // de sortie, le vendeur fabrique est present sur toutes les campagnes.
    if (siteDeLaPlaque) {
      await doitAccepter('R-B.5  table MIXTE : aucune contrainte (non-regression)', async (tx) => {
        await tx.tablePhoning.update({ where: { id: table1.id }, data: { marqueId: null } });
        const neuf = await tx.vendeur.create({
          data: { nom: 'GARDE-FOU MIXTE', siteId: siteDeLaPlaque, typeVehicule: 'VN' },
          select: { id: true },
        });
        return tx.affectation.create({ data: { tableId: table1.id, vendeurId: neuf.id } });
      });
    } else {
      resultats.push({
        nom: 'R-B.5  table MIXTE : aucune contrainte (non-regression)',
        ok: false,
        detail: 'jeu de donnees insuffisant (aucun site sur la plaque de la table)',
      });
    }
  }

  // ---------------------------------------------------------------- R-A3.7
  // UN SEUL ENCADRANT PAR (SITE, ROLE).
  //
  // Ces tests portaient sur deux drapeaux de `vendeur` — `chef_de_site` et
  // `chef_de_vente`. C'ETAIT UNE ERREUR DE MODELE, corrigee par la migration
  // `20260831180000` : un encadrant est un COMPTE rattache a un site, pas un
  // drapeau sur une ligne de vendeur.
  //
  // Le pourquoi, dans les mots de l'utilisateur : « je mets 5 vendeurs de 5
  // concessions differentes, et un chef de vente en chef de table d'une AUTRE
  // concession pour les coacher ». Avec un drapeau sur `vendeur`, le selecteur ne
  // pouvait proposer que les vendeurs du site : la mixite etait inexprimable.
  // LES SITES SONT FABRIQUES DANS CHAQUE TRANSACTION, jamais pris en base — et
  // c'est un correctif du 01/09/2026.
  //
  // Cette version prenait le site d'identifiant le plus bas. Sur une base neuve il
  // n'a aucun encadrant, et tout passait. Sur SUPABASE, ou l'outil sert
  // reellement, MASS avait deja un chef de site : `encadrementSite.create`
  // heurtait l'unique `(site, role)` et TROIS controles viraient au rouge sans que
  // rien ne soit casse.
  //
  // Pire, le controle voisin — « un SECOND encadrant sur le MEME (site, role) est
  // refuse » — passait alors au VERT pour la mauvaise raison : c'est le PREMIER
  // `create` qui echouait, pas le second. Un test qui reussit par accident est
  // plus dangereux qu'un test qui echoue.
  //
  // Meme lecon que R-B.1 et R-B.5 : ce qui doit etre eprouve, c'est la contrainte,
  // pas l'etat de la base ce jour-la.
  const plaquePourEncadrement = await prisma.plaque.findFirstOrThrow({
    where: { archiveLe: null },
    orderBy: { id: 'asc' },
    select: { id: true },
  });

  /// Un site VIERGE, cree dans la transaction annulee. Le code est unique en base :
  /// on le suffixe pour que deux appels dans la meme transaction ne se heurtent pas.
  const siteVierge = async (tx: Tx, suffixe: string) =>
    tx.site.create({
      data: {
        code: `GF-${suffixe}`,
        libelle: `GARDE-FOU ${suffixe}`,
        plaqueId: plaquePourEncadrement.id,
      },
      select: { id: true },
    });
  const deuxComptes = await prisma.utilisateur.findMany({
    where: { actif: true, archiveLe: null },
    orderBy: { id: 'asc' },
    take: 2,
    select: { id: true, nom: true },
  });

  if (deuxComptes.length >= 2) {
    const [a, b] = deuxComptes;

    await doitAccepter('R-A3.7  un premier encadrant sur (site, role)', async (tx) => {
      const s = await siteVierge(tx, 'A');
      return tx.encadrementSite.create({
        data: { siteId: s.id, role: 'chef_de_site', utilisateurId: a!.id },
      });
    });

    await doitRefuser(
      'R-A3.7  un SECOND encadrant sur le MEME (site, role)',
      'Unique constraint',
      async (tx) => {
        const s = await siteVierge(tx, 'A');
        await tx.encadrementSite.create({
          data: { siteId: s.id, role: 'chef_de_site', utilisateurId: a!.id },
        });
        return tx.encadrementSite.create({
          data: { siteId: s.id, role: 'chef_de_site', utilisateurId: b!.id },
        });
      }
    );

    // Les trois roles COEXISTENT sur un meme site : un chef de site, un chef de
    // vente VN, un chef de vente VO. C'est le cas des gros sites.
    await doitAccepter('R-A3.7  les trois roles coexistent sur un site', async (tx) => {
      const s = await siteVierge(tx, 'A');
      await tx.encadrementSite.create({
        data: { siteId: s.id, role: 'chef_de_site', utilisateurId: a!.id },
      });
      await tx.encadrementSite.create({
        data: { siteId: s.id, role: 'chef_de_vente_vn', utilisateurId: b!.id },
      });
      return tx.encadrementSite.create({
        data: { siteId: s.id, role: 'chef_de_vente_vo', utilisateurId: a!.id },
      });
    });

    // UN MEME COMPTE ENCADRE PLUSIEURS SITES. Ce n'est pas une tolerance : c'est
    // le cas normal d'un chef de vente qui couvre deux concessions.
    await doitAccepter('R-A3.7  un meme compte encadre DEUX sites', async (tx) => {
      const s1 = await siteVierge(tx, 'A');
      const s2 = await siteVierge(tx, 'B');
      await tx.encadrementSite.create({
        data: { siteId: s1.id, role: 'chef_de_site', utilisateurId: a!.id },
      });
      return tx.encadrementSite.create({
        data: { siteId: s2.id, role: 'chef_de_site', utilisateurId: a!.id },
      });
    });

    await doitRefuser(
      'CHECK  role d encadrement inconnu',
      'encadrement_site_role_check',
      async (tx) => {
        const s = await siteVierge(tx, 'A');
        return tx.encadrementSite.create({
          data: { siteId: s.id, role: 'chef_de_tout', utilisateurId: a!.id },
        });
      }
    );

    // Un compte DESACTIVE ne doit pas rester rattache : il donnerait un encadrant
    // fantome dans le selecteur d'une table.
    await doitRefuser(
      'R-A3.7  un compte desactive ne peut pas encadrer',
      'est desactive',
      async (tx) => {
        const s = await siteVierge(tx, 'A');
        await tx.utilisateur.update({ where: { id: b!.id }, data: { actif: false } });
        return tx.encadrementSite.create({
          data: { siteId: s.id, role: 'chef_de_vente_vn', utilisateurId: b!.id },
        });
      }
    );

    await doitRefuser(
      'Interdit n.1  DELETE sur encadrement_site',
      'suppression interdite',
      async (tx) => {
        const s = await siteVierge(tx, 'A');
        const e = await tx.encadrementSite.create({
          data: { siteId: s.id, role: 'chef_de_site', utilisateurId: a!.id },
        });
        return tx.$executeRawUnsafe('DELETE FROM relance.encadrement_site WHERE id = $1', e.id);
      }
    );
  } else {
    resultats.push({
      nom: 'R-A3.7  encadrement',
      ok: false,
      detail: 'jeu de donnees insuffisant (deux comptes actifs requis)',
    });
  }

  // ------------------------------------------------- interdit n.1 : la PORTE
  //
  // C'EST LE TEST LE PLUS IMPORTANT DE CE FICHIER depuis l'ouverture de la purge.
  //
  // L'interdit n.1 n'a pas ete leve : par defaut aucun `DELETE` ne passe. Ce qui
  // existe, c'est UNE porte, ouverte explicitement pour la duree d'UNE
  // transaction. Les deux moities doivent etre verifiees — qu'elle refuse par
  // defaut, ET qu'elle s'ouvre quand on le demande. Verifier une seule des deux
  // laisserait passer soit un garde-fou desarme, soit une purge impossible.
  await doitRefuser(
    'Interdit n.1  DELETE refuse PAR DEFAUT, porte fermee',
    'suppression interdite',
    (tx) => tx.$executeRawUnsafe('DELETE FROM relance.vendeur WHERE id = $1', vendeurRenault.id)
  );

  await doitAccepter(
    'Interdit n.1  la porte de purge s ouvre quand on la nomme',
    async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL relance.purge_autorisee = 'oui'`);
      // Un vendeur jetable, cree puis detruit dans la meme transaction annulee.
      const jetable = await tx.vendeur.create({
        data: {
          nom: 'VENDEUR JETABLE PURGE',
          siteId: vendeurRenault.siteId,
          typeVehicule: 'VN',
        },
      });
      return tx.$executeRawUnsafe('DELETE FROM relance.vendeur WHERE id = $1', jetable.id);
    }
  );

  // Et elle se REFERME : la meme transaction, sans le `SET LOCAL`, doit refuser.
  await doitRefuser(
    'Interdit n.1  la porte ne reste pas ouverte d une transaction a l autre',
    'suppression interdite',
    (tx) => tx.$executeRawUnsafe('DELETE FROM relance.rdv WHERE id = $1', -1)
  );

  // ---------------------------------------------------------------- R-C.3
  await doitRefuser('R-C.3  saisie sur une campagne cloturee', 'est cloturee', async (tx) => {
    await tx.campagne.update({ where: { id: juin.id }, data: { cloturee: true } });
    return tx.rdv.create({ data: rdvValide });
  });

  // ---------------------------------------------------------------- interdit n.1
  await doitRefuser('Interdit n.1  DELETE sur vendeur', 'suppression interdite', (tx) =>
    tx.vendeur.delete({ where: { id: vendeurRenault.id } })
  );

  await doitRefuser('Interdit n.1  DELETE sur campagne', 'suppression interdite', (tx) =>
    tx.campagne.delete({ where: { id: juin.id } })
  );

  // ---------------------------------------------------------------- restitution
  const largeur = Math.max(...resultats.map((r) => r.nom.length));
  console.log('');
  for (const r of resultats) {
    console.log(`${r.ok ? 'OK  ' : 'ECHEC'} ${r.nom.padEnd(largeur)}  ${r.detail}`);
  }

  const echecs = resultats.filter((r) => !r.ok).length;
  console.log(`\n${resultats.length - echecs}/${resultats.length} garde-fous verifies.`);

  // Aucune donnee ne doit subsister : toutes les transactions ont ete annulees.
  //
  // On compare AU DEPART ET A L'ARRIVEE, et non a zero : la base de developpement
  // porte des RDV laisses par d'autres verifications, et un seuil fixe rendait ce
  // controle faussement rouge des le second passage. Ce qui importe est que CE
  // script n'ajoute rien.
  const rdvApres = await prisma.rdv.count();
  const residu = rdvApres - rdvAvant;
  console.log(
    `RDV en base : ${rdvAvant} avant, ${rdvApres} apres — residu ${residu} (doit etre 0)`
  );

  if (echecs > 0 || residu !== 0) process.exit(1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
