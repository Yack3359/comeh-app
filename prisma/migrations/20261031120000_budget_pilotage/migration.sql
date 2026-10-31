-- CreateEnum
CREATE TYPE "BudgetPostKind" AS ENUM ('fonctionnement', 'stage', 'competition', 'autre');

-- CreateEnum
CREATE TYPE "BudgetActionStatus" AS ENUM ('option', 'budgetee', 'engagee', 'realisee', 'annulee', 'hors_budget');

-- CreateEnum
CREATE TYPE "BudgetActionOrigin" AS ENUM ('reconduite', 'nouvelle');

-- AlterTable
ALTER TABLE "fiscal_years" ADD COLUMN     "restitution_amount" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "budget_posts" (
    "id" TEXT NOT NULL,
    "fiscal_year_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "kind" "BudgetPostKind" NOT NULL DEFAULT 'autre',
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "budget_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budget_actions" (
    "id" TEXT NOT NULL,
    "post_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "matrix_key" TEXT,
    "origin" "BudgetActionOrigin",
    "status" "BudgetActionStatus" NOT NULL DEFAULT 'budgetee',
    "included_in_budget" BOOLEAN NOT NULL DEFAULT true,
    "proposed_saving" BOOLEAN NOT NULL DEFAULT false,
    "fencing_categories" "FencingCategory"[] DEFAULT ARRAY[]::"FencingCategory"[],
    "planned_month" INTEGER,
    "season_id" TEXT,
    "competition_id" TEXT,
    "initial_gross" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "initial_club_income" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "initial_federation" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "revised_gross" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "revised_club_income" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "revised_federation" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "revision_reason" TEXT,
    "previous_year_amount" DECIMAL(12,2),
    "estimated_federation" DECIMAL(12,2),
    "actual_gross" DECIMAL(12,2),
    "actual_club_income" DECIMAL(12,2),
    "actual_federation" DECIMAL(12,2),
    "notes" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "budget_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budget_snapshots" (
    "id" TEXT NOT NULL,
    "fiscal_year_id" TEXT NOT NULL,
    "as_of_date" DATE NOT NULL,
    "source_file_name" TEXT NOT NULL,
    "file_url" TEXT,
    "imported_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data" JSONB NOT NULL,

    CONSTRAINT "budget_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "budget_posts_fiscal_year_id_code_key" ON "budget_posts"("fiscal_year_id", "code");

-- CreateIndex
CREATE INDEX "budget_actions_post_id_idx" ON "budget_actions"("post_id");

-- CreateIndex
CREATE INDEX "budget_actions_status_idx" ON "budget_actions"("status");

-- CreateIndex
CREATE INDEX "budget_actions_season_id_idx" ON "budget_actions"("season_id");

-- CreateIndex
CREATE INDEX "budget_actions_competition_id_idx" ON "budget_actions"("competition_id");

-- CreateIndex
CREATE INDEX "budget_snapshots_fiscal_year_id_as_of_date_idx" ON "budget_snapshots"("fiscal_year_id", "as_of_date");

-- AddForeignKey
ALTER TABLE "budget_posts" ADD CONSTRAINT "budget_posts_fiscal_year_id_fkey" FOREIGN KEY ("fiscal_year_id") REFERENCES "fiscal_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_actions" ADD CONSTRAINT "budget_actions_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "budget_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_actions" ADD CONSTRAINT "budget_actions_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "seasons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_actions" ADD CONSTRAINT "budget_actions_competition_id_fkey" FOREIGN KEY ("competition_id") REFERENCES "competitions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_snapshots" ADD CONSTRAINT "budget_snapshots_fiscal_year_id_fkey" FOREIGN KEY ("fiscal_year_id") REFERENCES "fiscal_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_snapshots" ADD CONSTRAINT "budget_snapshots_imported_by_fkey" FOREIGN KEY ("imported_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

