/*
  Warnings:

  - Changed the type of `category` on the `athlete_category_seasons` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "Weapon" AS ENUM ('epee', 'fleuret', 'sabre');

-- CreateEnum
CREATE TYPE "FencingCategory" AS ENUM ('senior', 'u23', 'm20', 'm17', 'm15', 'm13', 'veteran');

-- AlterTable
ALTER TABLE "athlete_category_seasons" DROP COLUMN "category",
ADD COLUMN     "category" "FencingCategory" NOT NULL;

-- AlterTable
ALTER TABLE "competitions" ADD COLUMN     "category" "FencingCategory",
ADD COLUMN     "gender" "Gender",
ADD COLUMN     "weapon" "Weapon";

-- CreateIndex
CREATE INDEX "athlete_category_seasons_season_id_category_idx" ON "athlete_category_seasons"("season_id", "category");

-- CreateIndex
CREATE INDEX "competitions_weapon_gender_category_idx" ON "competitions"("weapon", "gender", "category");
