-- Phase 4: 資金繰表ページ強化（PDF P1 対応）
-- 会社情報一覧パネルに必要な項目を Company テーブルに追加

ALTER TABLE "fina"."companies_fina"
  ADD COLUMN IF NOT EXISTS "eTaxNumber" TEXT,
  ADD COLUMN IF NOT EXISTS "capitalAmount" BIGINT,
  ADD COLUMN IF NOT EXISTS "accountingManager" TEXT;
