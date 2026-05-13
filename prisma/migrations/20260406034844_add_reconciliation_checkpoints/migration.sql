-- CreateTable
CREATE TABLE "fina"."reconciliation_checkpoints_fina" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "checkpointDate" TIMESTAMP(3) NOT NULL,
    "yearMonth" TEXT NOT NULL,
    "verifiedBalance" BIGINT NOT NULL,
    "verifiedBy" TEXT NOT NULL,
    "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,

    CONSTRAINT "reconciliation_checkpoints_fina_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "reconciliation_checkpoints_fina_accountId_yearMonth_checkpo_key" ON "fina"."reconciliation_checkpoints_fina"("accountId", "yearMonth", "checkpointDate");

-- AddForeignKey
ALTER TABLE "fina"."reconciliation_checkpoints_fina" ADD CONSTRAINT "reconciliation_checkpoints_fina_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "fina"."companies_fina"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fina"."reconciliation_checkpoints_fina" ADD CONSTRAINT "reconciliation_checkpoints_fina_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "fina"."accounts_fina"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
