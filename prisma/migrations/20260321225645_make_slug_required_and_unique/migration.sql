/*
  Warnings:

  - A unique constraint covering the columns `[slug]` on the table `Unit` will be added. If there are existing duplicate values, this will fail.
  - Made the column `slug` on table `Unit` required. This step will fail if there are existing NULL values in that column.

*/
-- DropIndex
DROP INDEX "Unit_slug_idx";

-- Fill null slugs with generated values based on name
UPDATE "Unit" 
SET "slug" = LOWER(REGEXP_REPLACE(REGEXP_REPLACE("name", '[^a-zA-Z0-9\s-]', '', 'g'), '\s+', '-', 'g'))
WHERE "slug" IS NULL;

-- Handle potential duplicates by appending shop ID
UPDATE "Unit" u1
SET "slug" = u1."slug" || '-' || u1."shopId"
WHERE EXISTS (
  SELECT 1 FROM "Unit" u2 
  WHERE u2."slug" = u1."slug" 
  AND u2."id" != u1."id"
);

-- AlterTable
ALTER TABLE "Unit" ALTER COLUMN "slug" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Unit_slug_key" ON "Unit"("slug");
