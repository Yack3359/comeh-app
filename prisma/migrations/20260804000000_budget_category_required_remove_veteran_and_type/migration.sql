-- Nettoyage préalable : aucune donnée réelle ne doit dépendre de VETERAN ou
-- des lignes de budget "toutes catégories confondues" (fencing_category
-- NULL) — ce sont soit des valeurs jamais utilisées en production, soit des
-- lignes de test locales dont on corrige justement le comportement bugué.

DELETE FROM "athlete_category_seasons" WHERE "category" = 'veteran';
UPDATE "competitions" SET "category" = NULL WHERE "category" = 'veteran';
DELETE FROM "budgets" WHERE "fencing_category" = 'veteran' OR "fencing_category" IS NULL;
UPDATE "expenses" SET "fencing_category" = NULL WHERE "fencing_category" = 'veteran';

-- AlterEnum: retire VETERAN de FencingCategory
BEGIN;
CREATE TYPE "FencingCategory_new" AS ENUM ('senior', 'u23', 'm20', 'm17', 'm15', 'm13');
ALTER TABLE "athlete_category_seasons" ALTER COLUMN "category" TYPE "FencingCategory_new" USING ("category"::text::"FencingCategory_new");
ALTER TABLE "competitions" ALTER COLUMN "category" TYPE "FencingCategory_new" USING ("category"::text::"FencingCategory_new");
ALTER TABLE "budgets" ALTER COLUMN "fencing_category" TYPE "FencingCategory_new" USING ("fencing_category"::text::"FencingCategory_new");
ALTER TABLE "expenses" ALTER COLUMN "fencing_category" TYPE "FencingCategory_new" USING ("fencing_category"::text::"FencingCategory_new");
ALTER TYPE "FencingCategory" RENAME TO "FencingCategory_old";
ALTER TYPE "FencingCategory_new" RENAME TO "FencingCategory";
DROP TYPE "FencingCategory_old";
COMMIT;

-- AlterTable: budgets.fencing_category devient obligatoire (plus de ligne
-- "recap" ambiguë ; le total "toutes catégories" est désormais calculé,
-- jamais saisi).
ALTER TABLE "budgets" ALTER COLUMN "fencing_category" SET NOT NULL;

-- AlterTable: suppression du champ "type" (redondant avec la catégorie de
-- dépense).
ALTER TABLE "expenses" DROP COLUMN "type";
DROP TYPE "ExpenseType";

-- AlterTable: compétition sélective ou non.
ALTER TABLE "competitions" ADD COLUMN "is_selective" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: observations libres sur un résultat (individuel ou équipe).
ALTER TABLE "results" ADD COLUMN "observations" TEXT;
