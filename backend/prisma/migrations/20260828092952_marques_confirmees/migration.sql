-- AlterTable
ALTER TABLE "vendeur" ADD COLUMN     "marques_confirmees_le" TIMESTAMPTZ(6),
ADD COLUMN     "marques_confirmees_par" BIGINT;
