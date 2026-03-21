-- AlterTable
ALTER TABLE "Unit" ADD COLUMN     "slug" TEXT;

-- CreateIndex
CREATE INDEX "Unit_slug_idx" ON "Unit"("slug");
