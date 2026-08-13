-- AlterTable: suivi individuel façon CR-INDIV (résultat de poule et
-- classement de poule, distincts du classement final "rank").
ALTER TABLE "results" ADD COLUMN "pool_result" TEXT;
ALTER TABLE "results" ADD COLUMN "pool_rank" INTEGER;
