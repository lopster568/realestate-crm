-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "dedupeKey" TEXT,
ADD COLUMN     "externalSource" TEXT,
ADD COLUMN     "intent" TEXT,
ADD COLUMN     "nextAction" TEXT,
ADD COLUMN     "score" INTEGER,
ADD COLUMN     "scoreBand" TEXT,
ADD COLUMN     "scoreReason" TEXT,
ADD COLUMN     "scoredAt" TIMESTAMP(3),
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Org" ADD COLUMN     "autoAssign" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "ingestKey" TEXT,
ADD COLUMN     "staleLeadDays" INTEGER NOT NULL DEFAULT 7;

-- CreateTable
CREATE TABLE "SavedView" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "shared" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedView_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SavedView_orgId_resource_idx" ON "SavedView"("orgId", "resource");

-- CreateIndex
CREATE INDEX "Lead_orgId_scoreBand_idx" ON "Lead"("orgId", "scoreBand");

-- CreateIndex
CREATE INDEX "Lead_tags_idx" ON "Lead" USING GIN ("tags");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_orgId_dedupeKey_key" ON "Lead"("orgId", "dedupeKey");

-- CreateIndex
CREATE UNIQUE INDEX "Org_ingestKey_key" ON "Org"("ingestKey");

-- AddForeignKey
ALTER TABLE "SavedView" ADD CONSTRAINT "SavedView_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedView" ADD CONSTRAINT "SavedView_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

