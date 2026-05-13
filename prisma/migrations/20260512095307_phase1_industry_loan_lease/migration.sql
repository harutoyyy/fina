-- Phase 1 拡張: PDF「経理くん 開発地図」差分対応
-- 1-B: 借入「保証協会」フラグ
-- 1-C: リース「車種分類」(代表/車/その他) + 車種・車両番号
-- 1-D: 業種マスタ追加 + 会社マスタへのFK

-- 1-D: 業種マスタ
CREATE TABLE "fina"."industry_masters_fina" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "industry_masters_fina_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "industry_masters_fina_name_key" ON "fina"."industry_masters_fina"("name");
CREATE UNIQUE INDEX "industry_masters_fina_code_key" ON "fina"."industry_masters_fina"("code");

-- 1-D: Company.industryMasterId 追加
ALTER TABLE "fina"."companies_fina" ADD COLUMN "industryMasterId" TEXT;

ALTER TABLE "fina"."companies_fina"
    ADD CONSTRAINT "companies_fina_industryMasterId_fkey"
    FOREIGN KEY ("industryMasterId") REFERENCES "fina"."industry_masters_fina"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- 1-B: 借入「保証協会」フラグ
ALTER TABLE "fina"."loan_contracts_fina"
    ADD COLUMN "isGuaranteeAssociation" BOOLEAN NOT NULL DEFAULT false;

-- 1-C: リース車種分類
ALTER TABLE "fina"."lease_contracts_fina"
    ADD COLUMN "assetCategory" TEXT NOT NULL DEFAULT 'OTHER',
    ADD COLUMN "vehicleModel" TEXT,
    ADD COLUMN "vehicleNumber" TEXT;

-- 既存業種マスタ初期データ（PDF P10-3 建設/広告/その他）
INSERT INTO "fina"."industry_masters_fina" ("id", "name", "code", "displayOrder", "isActive", "createdAt", "updatedAt") VALUES
    ('industry_construction', '建設', 'CONSTRUCTION', 10, true, NOW(), NOW()),
    ('industry_advertising', '広告', 'ADVERTISING', 20, true, NOW(), NOW()),
    ('industry_other', 'その他', 'OTHER', 90, true, NOW(), NOW());

-- 既存会社レコードの industryType 文字列から industryMasterId をベストエフォートで紐付け
UPDATE "fina"."companies_fina"
SET "industryMasterId" = 'industry_construction'
WHERE "industryType" IN ('建設', '建設業', 'CONSTRUCTION');

UPDATE "fina"."companies_fina"
SET "industryMasterId" = 'industry_advertising'
WHERE "industryType" IN ('広告', '広告業', 'ADVERTISING');

UPDATE "fina"."companies_fina"
SET "industryMasterId" = 'industry_other'
WHERE "industryType" IS NOT NULL AND "industryMasterId" IS NULL;
