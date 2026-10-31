-- AlterTable
ALTER TABLE "budget_actions" ADD COLUMN     "adjustment_federation" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "adjustment_reason" TEXT;

