-- AlterTable: le classement (type "ranking") ne porte plus de score/rond,
-- ceux-ci deviennent des résultats individuels de poule/tableau (type
-- "bout"). Le score est désormais saisi en 2 nombres (un par tireur) plutôt
-- qu'en texte libre, et l'on ajoute un classement initial (seedRank) et un
-- adversaire "équipe" en texte libre (compétitions internationales par
-- équipe : l'équipe adverse n'est pas une entité gérée dans l'outil).
ALTER TABLE "results" DROP COLUMN "pool_result",
DROP COLUMN "score",
ADD COLUMN     "opponent_team_name" TEXT,
ADD COLUMN     "score_against" INTEGER,
ADD COLUMN     "score_for" INTEGER,
ADD COLUMN     "seed_rank" INTEGER;

-- CreateTable: composition d'une équipe (tireurs qui la composent).
CREATE TABLE "team_members" (
    "id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "athlete_id" TEXT NOT NULL,
    "bib_number" INTEGER,

    CONSTRAINT "team_members_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "team_members_team_id_idx" ON "team_members"("team_id");

-- CreateIndex
CREATE INDEX "team_members_athlete_id_idx" ON "team_members"("athlete_id");

-- CreateIndex
CREATE UNIQUE INDEX "team_members_team_id_athlete_id_key" ON "team_members"("team_id", "athlete_id");

-- AddForeignKey
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_athlete_id_fkey" FOREIGN KEY ("athlete_id") REFERENCES "athletes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
