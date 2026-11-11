-- AlterTable
ALTER TABLE "expenses" ADD COLUMN     "budget_action_id" TEXT;

-- CreateIndex
CREATE INDEX "expenses_budget_action_id_idx" ON "expenses"("budget_action_id");

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_budget_action_id_fkey" FOREIGN KEY ("budget_action_id") REFERENCES "budget_actions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

