/*
  Warnings:

  - A unique constraint covering the columns `[slug]` on the table `Unit` will be added. If there are existing duplicate values, this will fail.
  - Made the column `slug` on table `Unit` required. This step will fail if there are existing NULL values in that column.

*/
-- DropIndex
DROP INDEX "Unit_slug_idx";

-- AlterTable
ALTER TABLE "Unit" ALTER COLUMN "slug" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Unit_slug_key" ON "Unit"("slug");
