-- CreateTable
CREATE TABLE "TimeBlock" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "duration" INTEGER NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TimeBlock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TimeBlock_shopId_date_idx" ON "TimeBlock"("shopId", "date");

-- CreateIndex
CREATE INDEX "TimeBlock_professionalId_date_idx" ON "TimeBlock"("professionalId", "date");

-- AddForeignKey
ALTER TABLE "TimeBlock" ADD CONSTRAINT "TimeBlock_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeBlock" ADD CONSTRAINT "TimeBlock_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "Professional"("id") ON DELETE CASCADE ON UPDATE CASCADE;
