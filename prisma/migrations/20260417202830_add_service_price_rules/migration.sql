-- CreateTable
CREATE TABLE "ServicePriceRule" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "dayOfWeek" INTEGER[],
    "price" INTEGER NOT NULL,

    CONSTRAINT "ServicePriceRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ServicePriceRule_serviceId_idx" ON "ServicePriceRule"("serviceId");

-- AddForeignKey
ALTER TABLE "ServicePriceRule" ADD CONSTRAINT "ServicePriceRule_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;
