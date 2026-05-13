-- Phase 3-D: 売上項目メタマスタ
CREATE TABLE IF NOT EXISTS "fina"."sales_item_masters_fina" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "shortName" TEXT,
  "description" TEXT,
  "applicableCompanyIds" TEXT,
  "defaultClassification" TEXT,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "sales_item_masters_fina_pkey" PRIMARY KEY ("id")
);
