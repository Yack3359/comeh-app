-- CreateEnum
CREATE TYPE "FiscalYearPhase" AS ENUM ('preparation', 'execution');

-- CreateEnum
CREATE TYPE "BudgetProposalStatus" AS ENUM ('proposee', 'retenue', 'a_arbitrer', 'ecartee');

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'contributor';

-- AlterTable
ALTER TABLE "fiscal_years" ADD COLUMN     "phase" "FiscalYearPhase" NOT NULL DEFAULT 'execution',
ADD COLUMN     "preparation_deadline" DATE,
ADD COLUMN     "target_federation" DECIMAL(12,2);

-- AlterTable
ALTER TABLE "budget_actions" ADD COLUMN     "amounts_confirmed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "athlete_count" INTEGER,
ADD COLUMN     "day_count" INTEGER,
ADD COLUMN     "proposal_status" "BudgetProposalStatus",
ADD COLUMN     "proposed_by_id" TEXT,
ADD COLUMN     "source_action_id" TEXT,
ADD COLUMN     "staff_count" INTEGER;

-- AddForeignKey
ALTER TABLE "budget_actions" ADD CONSTRAINT "budget_actions_proposed_by_id_fkey" FOREIGN KEY ("proposed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_actions" ADD CONSTRAINT "budget_actions_source_action_id_fkey" FOREIGN KEY ("source_action_id") REFERENCES "budget_actions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

