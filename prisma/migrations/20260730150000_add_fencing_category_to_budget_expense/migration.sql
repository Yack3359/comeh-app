-- DropIndex
DROP INDEX "budgets_season_id_category_id_key";

-- AlterTable
ALTER TABLE "budgets" ADD COLUMN     "fencing_category" "FencingCategory";

-- AlterTable
ALTER TABLE "expenses" ADD COLUMN     "fencing_category" "FencingCategory";

-- CreateIndex
CREATE INDEX "budgets_season_id_fencing_category_idx" ON "budgets"("season_id", "fencing_category");

-- CreateIndex
CREATE UNIQUE INDEX "budgets_season_id_category_id_fencing_category_key" ON "budgets"("season_id", "category_id", "fencing_category");

-- CreateIndex
CREATE INDEX "expenses_season_id_fencing_category_idx" ON "expenses"("season_id", "fencing_category");

