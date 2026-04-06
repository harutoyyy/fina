-- AlterTable
ALTER TABLE "fina"."evidences_fina" ADD COLUMN     "metaAmount" BIGINT,
ADD COLUMN     "metaTransactionDate" TIMESTAMP(3),
ADD COLUMN     "metaVendorName" TEXT;

-- AlterTable
ALTER TABLE "fina"."transactions_fina" ADD COLUMN     "recurringTemplateId" TEXT;

-- CreateIndex
CREATE INDEX "transactions_fina_recurringTemplateId_idx" ON "fina"."transactions_fina"("recurringTemplateId");

-- AddForeignKey
ALTER TABLE "fina"."transactions_fina" ADD CONSTRAINT "transactions_fina_recurringTemplateId_fkey" FOREIGN KEY ("recurringTemplateId") REFERENCES "fina"."recurring_templates_fina"("id") ON DELETE SET NULL ON UPDATE CASCADE;
