-- CreateEnum
CREATE TYPE "Role" AS ENUM ('admin', 'comeh_member', 'readonly');

-- CreateEnum
CREATE TYPE "ExpenseType" AS ENUM ('hebergement', 'deplacement');

-- CreateEnum
CREATE TYPE "ExpenseSource" AS ENUM ('manuel', 'import');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('femme', 'homme', 'autre');

-- CreateEnum
CREATE TYPE "Handedness" AS ENUM ('droitier', 'gaucher');

-- CreateEnum
CREATE TYPE "GripType" AS ENUM ('cross', 'droite');

-- CreateEnum
CREATE TYPE "PlayStyle" AS ENUM ('offensif', 'contre_offensif', 'defensif', 'mixte', 'autre');

-- CreateEnum
CREATE TYPE "ImportSourceType" AS ENUM ('pdf', 'image', 'excel');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('pending', 'extracted', 'validated', 'failed');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'comeh_member',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "diff_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seasons" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,

    CONSTRAINT "seasons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fiscal_years" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,

    CONSTRAINT "fiscal_years_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budget_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "season_id" TEXT NOT NULL,

    CONSTRAINT "budget_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budgets" (
    "id" TEXT NOT NULL,
    "season_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "planned_amount" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "budgets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expenses" (
    "id" TEXT NOT NULL,
    "season_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "type" "ExpenseType" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "date" DATE NOT NULL,
    "description" TEXT NOT NULL,
    "competition_id" TEXT,
    "trip_id" TEXT,
    "created_by" TEXT NOT NULL,
    "source" "ExpenseSource" NOT NULL DEFAULT 'manuel',
    "attachment_url" TEXT,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trips" (
    "id" TEXT NOT NULL,
    "competition_id" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "participants" JSONB NOT NULL,

    CONSTRAINT "trips_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "athletes" (
    "id" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "gender" "Gender" NOT NULL,
    "country" TEXT NOT NULL,
    "handedness" "Handedness",
    "grip_type" "GripType",
    "play_style" "PlayStyle",
    "club" TEXT,

    CONSTRAINT "athletes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "athlete_category_seasons" (
    "athlete_id" TEXT NOT NULL,
    "season_id" TEXT NOT NULL,
    "category" TEXT NOT NULL,

    CONSTRAINT "athlete_category_seasons_pkey" PRIMARY KEY ("athlete_id","season_id")
);

-- CreateTable
CREATE TABLE "teams" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "season_id" TEXT NOT NULL,

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competitions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "season_id" TEXT NOT NULL,
    "level" TEXT NOT NULL,

    CONSTRAINT "competitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "results" (
    "id" TEXT NOT NULL,
    "competition_id" TEXT NOT NULL,
    "athlete_id" TEXT,
    "team_id" TEXT,
    "opponent_athlete_id" TEXT,
    "rank" INTEGER,
    "score" TEXT,
    "round" TEXT,

    CONSTRAINT "results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_batches" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "source_type" "ImportSourceType" NOT NULL,
    "file_url" TEXT NOT NULL,
    "status" "ImportStatus" NOT NULL DEFAULT 'pending',
    "raw_extraction_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "import_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_SeasonFiscalYears" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_created_at_idx" ON "audit_logs"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "seasons_label_key" ON "seasons"("label");

-- CreateIndex
CREATE UNIQUE INDEX "fiscal_years_label_key" ON "fiscal_years"("label");

-- CreateIndex
CREATE INDEX "budget_categories_season_id_idx" ON "budget_categories"("season_id");

-- CreateIndex
CREATE UNIQUE INDEX "budget_categories_season_id_name_key" ON "budget_categories"("season_id", "name");

-- CreateIndex
CREATE INDEX "budgets_category_id_idx" ON "budgets"("category_id");

-- CreateIndex
CREATE UNIQUE INDEX "budgets_season_id_category_id_key" ON "budgets"("season_id", "category_id");

-- CreateIndex
CREATE INDEX "expenses_season_id_date_idx" ON "expenses"("season_id", "date");

-- CreateIndex
CREATE INDEX "expenses_category_id_idx" ON "expenses"("category_id");

-- CreateIndex
CREATE INDEX "expenses_competition_id_idx" ON "expenses"("competition_id");

-- CreateIndex
CREATE INDEX "expenses_trip_id_idx" ON "expenses"("trip_id");

-- CreateIndex
CREATE INDEX "expenses_created_by_idx" ON "expenses"("created_by");

-- CreateIndex
CREATE INDEX "trips_competition_id_idx" ON "trips"("competition_id");

-- CreateIndex
CREATE INDEX "athletes_last_name_first_name_idx" ON "athletes"("last_name", "first_name");

-- CreateIndex
CREATE INDEX "athletes_country_idx" ON "athletes"("country");

-- CreateIndex
CREATE INDEX "athlete_category_seasons_season_id_category_idx" ON "athlete_category_seasons"("season_id", "category");

-- CreateIndex
CREATE INDEX "teams_season_id_idx" ON "teams"("season_id");

-- CreateIndex
CREATE UNIQUE INDEX "teams_season_id_name_key" ON "teams"("season_id", "name");

-- CreateIndex
CREATE INDEX "competitions_season_id_date_idx" ON "competitions"("season_id", "date");

-- CreateIndex
CREATE INDEX "results_competition_id_idx" ON "results"("competition_id");

-- CreateIndex
CREATE INDEX "results_athlete_id_idx" ON "results"("athlete_id");

-- CreateIndex
CREATE INDEX "results_team_id_idx" ON "results"("team_id");

-- CreateIndex
CREATE INDEX "results_opponent_athlete_id_idx" ON "results"("opponent_athlete_id");

-- CreateIndex
CREATE INDEX "import_batches_user_id_created_at_idx" ON "import_batches"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "import_batches_status_idx" ON "import_batches"("status");

-- CreateIndex
CREATE UNIQUE INDEX "_SeasonFiscalYears_AB_unique" ON "_SeasonFiscalYears"("A", "B");

-- CreateIndex
CREATE INDEX "_SeasonFiscalYears_B_index" ON "_SeasonFiscalYears"("B");

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_categories" ADD CONSTRAINT "budget_categories_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "budget_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "seasons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "budget_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_competition_id_fkey" FOREIGN KEY ("competition_id") REFERENCES "competitions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trips" ADD CONSTRAINT "trips_competition_id_fkey" FOREIGN KEY ("competition_id") REFERENCES "competitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "athlete_category_seasons" ADD CONSTRAINT "athlete_category_seasons_athlete_id_fkey" FOREIGN KEY ("athlete_id") REFERENCES "athletes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "athlete_category_seasons" ADD CONSTRAINT "athlete_category_seasons_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competitions" ADD CONSTRAINT "competitions_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "seasons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "results" ADD CONSTRAINT "results_competition_id_fkey" FOREIGN KEY ("competition_id") REFERENCES "competitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "results" ADD CONSTRAINT "results_athlete_id_fkey" FOREIGN KEY ("athlete_id") REFERENCES "athletes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "results" ADD CONSTRAINT "results_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "results" ADD CONSTRAINT "results_opponent_athlete_id_fkey" FOREIGN KEY ("opponent_athlete_id") REFERENCES "athletes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_SeasonFiscalYears" ADD CONSTRAINT "_SeasonFiscalYears_A_fkey" FOREIGN KEY ("A") REFERENCES "fiscal_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_SeasonFiscalYears" ADD CONSTRAINT "_SeasonFiscalYears_B_fkey" FOREIGN KEY ("B") REFERENCES "seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
