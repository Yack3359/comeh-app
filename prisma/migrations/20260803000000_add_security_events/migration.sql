-- CreateEnum
CREATE TYPE "SecurityEventType" AS ENUM ('login_success', 'login_failure', 'access_denied');

-- CreateTable
CREATE TABLE "security_events" (
    "id" TEXT NOT NULL,
    "type" "SecurityEventType" NOT NULL,
    "email" TEXT,
    "user_id" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "detail" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "security_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "security_events_type_created_at_idx" ON "security_events"("type", "created_at");

-- CreateIndex
CREATE INDEX "security_events_user_id_idx" ON "security_events"("user_id");

-- AddForeignKey
ALTER TABLE "security_events" ADD CONSTRAINT "security_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
