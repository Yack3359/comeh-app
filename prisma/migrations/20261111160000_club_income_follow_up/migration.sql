-- AlterTable
ALTER TABLE "budget_actions" ADD COLUMN     "club_income_follow_up" TEXT,
ADD COLUMN     "club_income_note" TEXT,
ADD COLUMN     "club_income_waived" DECIMAL(12,2) NOT NULL DEFAULT 0;

