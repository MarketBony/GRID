-- Alpine ne remonte pas dans le tableau des ventes (decision de l'utilisateur,
-- 05/10/2026), et nulle part ailleurs cela ne change rien. Une DONNEE par marque
-- et par site plutot qu'une exclusion en dur dans le code (interdit n.3).

-- AlterTable
ALTER TABLE "marque" ADD COLUMN     "tableau_ventes" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "site" ADD COLUMN     "tableau_ventes" BOOLEAN NOT NULL DEFAULT true;

UPDATE relance.marque SET tableau_ventes = false WHERE code = 'ALPINE';
UPDATE relance.site   SET tableau_ventes = false WHERE code = 'ALPINE';
