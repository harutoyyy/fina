-- ============================================================
-- Phase 2 migration: 納税予定表 / カード明細 / 取込バッチ / 会社グループ
-- 対応: docs/pdf_vs_implementation_diff.md
-- ============================================================

-- 22. 納税予定表
CREATE TABLE IF NOT EXISTS "fina"."tax_payment_schedules_fina" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "taxType" TEXT NOT NULL,
    "fiscalYear" INTEGER NOT NULL,
    "periodLabel" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "scheduledAmount" BIGINT NOT NULL DEFAULT 0,
    "actualAmount" BIGINT,
    "basisAmount" BIGINT,
    "calculationMethod" TEXT,
    "isPaid" BOOLEAN NOT NULL DEFAULT false,
    "paidDate" TIMESTAMP(3),
    "transactionId" TEXT,
    "accountId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tax_payment_schedules_fina_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "tax_payment_schedules_fina_companyId_fiscalYear_taxType_idx"
    ON "fina"."tax_payment_schedules_fina"("companyId", "fiscalYear", "taxType");
CREATE INDEX IF NOT EXISTS "tax_payment_schedules_fina_dueDate_idx"
    ON "fina"."tax_payment_schedules_fina"("dueDate");

-- 23. クレジットカード
CREATE TABLE IF NOT EXISTS "fina"."credit_cards_fina" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "cardName" TEXT NOT NULL,
    "cardBrand" TEXT,
    "cardLast4" TEXT,
    "holderName" TEXT,
    "paymentAccountId" TEXT,
    "closingDay" INTEGER,
    "paymentDay" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credit_cards_fina_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "fina"."card_statements_fina" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "statementMonth" TEXT NOT NULL,
    "statementDate" TIMESTAMP(3) NOT NULL,
    "storeName" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "category" TEXT,
    "midId" TEXT,
    "subId" TEXT,
    "partnerId" TEXT,
    "summary" TEXT,
    "isPosted" BOOLEAN NOT NULL DEFAULT false,
    "transactionId" TEXT,
    "importBatchId" TEXT,
    "rowHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "card_statements_fina_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "card_statements_fina_cardId_statementMonth_idx"
    ON "fina"."card_statements_fina"("cardId", "statementMonth");
CREATE INDEX IF NOT EXISTS "card_statements_fina_rowHash_idx"
    ON "fina"."card_statements_fina"("rowHash");

ALTER TABLE "fina"."card_statements_fina"
    ADD CONSTRAINT "card_statements_fina_cardId_fkey" FOREIGN KEY ("cardId")
    REFERENCES "fina"."credit_cards_fina"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 24. 取込バッチ（DX代替）
CREATE TABLE IF NOT EXISTS "fina"."import_batches_fina" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "batchType" TEXT NOT NULL,
    "sourceName" TEXT,
    "sourceFormat" TEXT,
    "yearMonth" TEXT,
    "importedBy" TEXT,
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "appliedRows" INTEGER NOT NULL DEFAULT 0,
    "skippedRows" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "import_batches_fina_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "import_batches_fina_companyId_batchType_yearMonth_idx"
    ON "fina"."import_batches_fina"("companyId", "batchType", "yearMonth");

-- 25. 会社グループ
CREATE TABLE IF NOT EXISTS "fina"."company_groups_fina" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT,
    "description" TEXT,
    "colorCode" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_groups_fina_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "company_groups_fina_name_key"
    ON "fina"."company_groups_fina"("name");

CREATE TABLE IF NOT EXISTS "fina"."company_group_members_fina" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_group_members_fina_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "company_group_members_fina_groupId_companyId_key"
    ON "fina"."company_group_members_fina"("groupId", "companyId");
CREATE INDEX IF NOT EXISTS "company_group_members_fina_companyId_idx"
    ON "fina"."company_group_members_fina"("companyId");

ALTER TABLE "fina"."company_group_members_fina"
    ADD CONSTRAINT "company_group_members_fina_groupId_fkey" FOREIGN KEY ("groupId")
    REFERENCES "fina"."company_groups_fina"("id") ON DELETE CASCADE ON UPDATE CASCADE;
