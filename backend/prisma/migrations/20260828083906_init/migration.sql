-- CreateTable
CREATE TABLE "utilisateur" (
    "id" BIGSERIAL NOT NULL,
    "login_id" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "cree_le" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cree_par" BIGINT,
    "archive_le" TIMESTAMPTZ(6),

    CONSTRAINT "utilisateur_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_global" (
    "utilisateur_id" BIGINT NOT NULL,
    "role" TEXT NOT NULL,
    "cree_le" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cree_par" BIGINT,

    CONSTRAINT "role_global_pkey" PRIMARY KEY ("utilisateur_id","role")
);

-- CreateTable
CREATE TABLE "role_campagne" (
    "id" BIGSERIAL NOT NULL,
    "campagne_id" BIGINT NOT NULL,
    "utilisateur_id" BIGINT NOT NULL,
    "role" TEXT NOT NULL,
    "plaque_id" BIGINT,
    "site_id" BIGINT,
    "cree_le" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cree_par" BIGINT,
    "archive_le" TIMESTAMPTZ(6),

    CONSTRAINT "role_campagne_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plaque" (
    "id" BIGSERIAL NOT NULL,
    "libelle" TEXT NOT NULL,
    "alias" TEXT,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "cree_le" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cree_par" BIGINT,
    "archive_le" TIMESTAMPTZ(6),

    CONSTRAINT "plaque_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site" (
    "id" BIGSERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "plaque_id" BIGINT NOT NULL,
    "cree_le" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cree_par" BIGINT,
    "archive_le" TIMESTAMPTZ(6),

    CONSTRAINT "site_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marque" (
    "id" BIGSERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "cree_le" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cree_par" BIGINT,
    "archive_le" TIMESTAMPTZ(6),

    CONSTRAINT "marque_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendeur" (
    "id" BIGSERIAL NOT NULL,
    "nom" TEXT NOT NULL,
    "site_id" BIGINT NOT NULL,
    "chef_de_site" BOOLEAN NOT NULL DEFAULT false,
    "utilisateur_id" BIGINT,
    "date_entree" DATE,
    "date_sortie" DATE,
    "cree_le" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cree_par" BIGINT,

    CONSTRAINT "vendeur_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendeur_marque" (
    "vendeur_id" BIGINT NOT NULL,
    "marque_id" BIGINT NOT NULL,
    "cree_le" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cree_par" BIGINT,

    CONSTRAINT "vendeur_marque_pkey" PRIMARY KEY ("vendeur_id","marque_id")
);

-- CreateTable
CREATE TABLE "campagne" (
    "id" BIGSERIAL NOT NULL,
    "libelle" TEXT NOT NULL,
    "date_debut" DATE NOT NULL,
    "date_fin" DATE NOT NULL,
    "cloturee" BOOLEAN NOT NULL DEFAULT false,
    "cree_le" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cree_par" BIGINT,
    "archive_le" TIMESTAMPTZ(6),

    CONSTRAINT "campagne_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campagne_jour" (
    "campagne_id" BIGINT NOT NULL,
    "jour" DATE NOT NULL,
    "ordre" INTEGER NOT NULL,
    "cree_le" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cree_par" BIGINT,

    CONSTRAINT "campagne_jour_pkey" PRIMARY KEY ("campagne_id","jour")
);

-- CreateTable
CREATE TABLE "campagne_creneau" (
    "campagne_id" BIGINT NOT NULL,
    "code" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "ordre" INTEGER NOT NULL,
    "cree_le" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cree_par" BIGINT,

    CONSTRAINT "campagne_creneau_pkey" PRIMARY KEY ("campagne_id","code")
);

-- CreateTable
CREATE TABLE "session_plaque" (
    "id" BIGSERIAL NOT NULL,
    "campagne_id" BIGINT NOT NULL,
    "plaque_id" BIGINT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'par_site',
    "effectif_cible_table" INTEGER,
    "cree_le" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cree_par" BIGINT,
    "archive_le" TIMESTAMPTZ(6),

    CONSTRAINT "session_plaque_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "table_phoning" (
    "id" BIGSERIAL NOT NULL,
    "session_plaque_id" BIGINT NOT NULL,
    "libelle" TEXT NOT NULL,
    "chef_utilisateur_id" BIGINT,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "cree_le" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cree_par" BIGINT,
    "archive_le" TIMESTAMPTZ(6),

    CONSTRAINT "table_phoning_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "affectation" (
    "id" BIGSERIAL NOT NULL,
    "table_id" BIGINT NOT NULL,
    "vendeur_id" BIGINT NOT NULL,
    "origine" TEXT NOT NULL DEFAULT 'manuel',
    "cree_le" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cree_par" BIGINT,
    "archive_le" TIMESTAMPTZ(6),

    CONSTRAINT "affectation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rdv" (
    "id" BIGSERIAL NOT NULL,
    "campagne_id" BIGINT NOT NULL,
    "vendeur_id" BIGINT NOT NULL,
    "jour" DATE NOT NULL,
    "creneau_code" TEXT NOT NULL,
    "marque_id" BIGINT NOT NULL,
    "type_vehicule" TEXT NOT NULL,
    "client" TEXT NOT NULL,
    "commentaire" TEXT,
    "cree_le" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cree_par" BIGINT,
    "modifie_le" TIMESTAMPTZ(6),
    "modifie_par" BIGINT,
    "archive_le" TIMESTAMPTZ(6),
    "archive_par" BIGINT,

    CONSTRAINT "rdv_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "utilisateur_login_id_key" ON "utilisateur"("login_id");

-- CreateIndex
CREATE INDEX "role_campagne_campagne_id_utilisateur_id_idx" ON "role_campagne"("campagne_id", "utilisateur_id");

-- CreateIndex
CREATE UNIQUE INDEX "plaque_libelle_key" ON "plaque"("libelle");

-- CreateIndex
CREATE UNIQUE INDEX "site_code_key" ON "site"("code");

-- CreateIndex
CREATE UNIQUE INDEX "vendeur_utilisateur_id_key" ON "vendeur"("utilisateur_id");

-- CreateIndex
CREATE UNIQUE INDEX "campagne_libelle_key" ON "campagne"("libelle");

-- CreateIndex
CREATE UNIQUE INDEX "session_plaque_campagne_id_plaque_id_key" ON "session_plaque"("campagne_id", "plaque_id");

-- CreateIndex
CREATE INDEX "affectation_vendeur_id_idx" ON "affectation"("vendeur_id");

-- CreateIndex
CREATE UNIQUE INDEX "affectation_table_id_vendeur_id_key" ON "affectation"("table_id", "vendeur_id");

-- CreateIndex
CREATE INDEX "rdv_campagne_id_vendeur_id_idx" ON "rdv"("campagne_id", "vendeur_id");

-- CreateIndex
CREATE INDEX "rdv_campagne_id_jour_creneau_code_idx" ON "rdv"("campagne_id", "jour", "creneau_code");

-- AddForeignKey
ALTER TABLE "role_global" ADD CONSTRAINT "role_global_utilisateur_id_fkey" FOREIGN KEY ("utilisateur_id") REFERENCES "utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_campagne" ADD CONSTRAINT "role_campagne_campagne_id_fkey" FOREIGN KEY ("campagne_id") REFERENCES "campagne"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_campagne" ADD CONSTRAINT "role_campagne_utilisateur_id_fkey" FOREIGN KEY ("utilisateur_id") REFERENCES "utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_campagne" ADD CONSTRAINT "role_campagne_plaque_id_fkey" FOREIGN KEY ("plaque_id") REFERENCES "plaque"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_campagne" ADD CONSTRAINT "role_campagne_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "site"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site" ADD CONSTRAINT "site_plaque_id_fkey" FOREIGN KEY ("plaque_id") REFERENCES "plaque"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendeur" ADD CONSTRAINT "vendeur_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendeur" ADD CONSTRAINT "vendeur_utilisateur_id_fkey" FOREIGN KEY ("utilisateur_id") REFERENCES "utilisateur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendeur_marque" ADD CONSTRAINT "vendeur_marque_vendeur_id_fkey" FOREIGN KEY ("vendeur_id") REFERENCES "vendeur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendeur_marque" ADD CONSTRAINT "vendeur_marque_marque_id_fkey" FOREIGN KEY ("marque_id") REFERENCES "marque"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campagne_jour" ADD CONSTRAINT "campagne_jour_campagne_id_fkey" FOREIGN KEY ("campagne_id") REFERENCES "campagne"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campagne_creneau" ADD CONSTRAINT "campagne_creneau_campagne_id_fkey" FOREIGN KEY ("campagne_id") REFERENCES "campagne"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_plaque" ADD CONSTRAINT "session_plaque_campagne_id_fkey" FOREIGN KEY ("campagne_id") REFERENCES "campagne"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_plaque" ADD CONSTRAINT "session_plaque_plaque_id_fkey" FOREIGN KEY ("plaque_id") REFERENCES "plaque"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "table_phoning" ADD CONSTRAINT "table_phoning_session_plaque_id_fkey" FOREIGN KEY ("session_plaque_id") REFERENCES "session_plaque"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "table_phoning" ADD CONSTRAINT "table_phoning_chef_utilisateur_id_fkey" FOREIGN KEY ("chef_utilisateur_id") REFERENCES "utilisateur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affectation" ADD CONSTRAINT "affectation_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "table_phoning"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affectation" ADD CONSTRAINT "affectation_vendeur_id_fkey" FOREIGN KEY ("vendeur_id") REFERENCES "vendeur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rdv" ADD CONSTRAINT "rdv_campagne_id_fkey" FOREIGN KEY ("campagne_id") REFERENCES "campagne"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rdv" ADD CONSTRAINT "rdv_vendeur_id_fkey" FOREIGN KEY ("vendeur_id") REFERENCES "vendeur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rdv" ADD CONSTRAINT "rdv_marque_id_fkey" FOREIGN KEY ("marque_id") REFERENCES "marque"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rdv" ADD CONSTRAINT "rdv_campagne_id_jour_fkey" FOREIGN KEY ("campagne_id", "jour") REFERENCES "campagne_jour"("campagne_id", "jour") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rdv" ADD CONSTRAINT "rdv_campagne_id_creneau_code_fkey" FOREIGN KEY ("campagne_id", "creneau_code") REFERENCES "campagne_creneau"("campagne_id", "code") ON DELETE RESTRICT ON UPDATE CASCADE;
