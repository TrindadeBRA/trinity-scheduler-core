-- AlterTable
ALTER TABLE "Shop" ADD COLUMN     "niche" TEXT NOT NULL DEFAULT 'barbearia';

-- Add check constraint for valid niche values
ALTER TABLE "Shop" ADD CONSTRAINT "Shop_niche_check" 
  CHECK ("niche" IN ('barbearia', 'salao-beleza'));
