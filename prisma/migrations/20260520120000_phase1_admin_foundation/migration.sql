-- ============================================================
-- Phase 1: 認証・権限・申請の DB 基盤
-- Generated from docs/admin_phase1_implementation.md §6.2
--
-- 適用方法:
--   prisma migrate deploy        (本番)
--   prisma migrate dev           (開発)
--
-- 手書き理由:
--   - enum rename を Prisma 自動生成では DROP + CREATE になり、データを失うため
--   - PostgreSQL の ALTER TYPE ... RENAME / ADD VALUE を直接使う
-- ============================================================

-- ---------- 1. enum 変更 ----------

-- 1-1. UserRole → ScopeRole に rename
ALTER TYPE fina."UserRole" RENAME TO "ScopeRole";

-- 1-2. SUPER_ADMIN を追加 (COMPANY_ADMIN の前に)
ALTER TYPE fina."ScopeRole" ADD VALUE 'SUPER_ADMIN' BEFORE 'ADMIN';

-- 1-3. ADMIN を COMPANY_ADMIN に rename
ALTER TYPE fina."ScopeRole" RENAME VALUE 'ADMIN' TO 'COMPANY_ADMIN';

-- ---------- 2. 新規 enum ----------

CREATE TYPE fina."AuthProvider" AS ENUM ('LOCAL', 'PWDX_OIDC');
CREATE TYPE fina."InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'REVOKED');

-- ---------- 3. UserProfile 拡張 ----------

-- 3-1. role カラムを scopeRole に rename
ALTER TABLE fina.user_profiles_fina RENAME COLUMN "role" TO "scopeRole";

-- 3-2. 新規カラム追加
ALTER TABLE fina.user_profiles_fina
  ADD COLUMN "primaryCompanyId"    TEXT,
  ADD COLUMN "authProvider"        fina."AuthProvider" NOT NULL DEFAULT 'LOCAL',
  ADD COLUMN "externalSub"         TEXT,
  ADD COLUMN "mustChangePassword"  BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN "templateKey"         TEXT,
  ADD COLUMN "permissionsOverride" JSONB,
  ADD COLUMN "invitedBy"           TEXT,
  ADD COLUMN "lastLoginAt"         TIMESTAMP(3);

-- 3-3. ユニーク制約 + インデックス
CREATE UNIQUE INDEX "user_profiles_fina_externalSub_key" ON fina.user_profiles_fina("externalSub");
CREATE INDEX "user_profiles_fina_primaryCompanyId_idx" ON fina.user_profiles_fina("primaryCompanyId");
CREATE INDEX "user_profiles_fina_scopeRole_idx" ON fina.user_profiles_fina("scopeRole");
CREATE INDEX "user_profiles_fina_authProvider_idx" ON fina.user_profiles_fina("authProvider");

-- ---------- 4. 新規テーブル ----------

-- 4-1. PermissionTemplate
CREATE TABLE fina.permission_templates_fina (
  "key"          TEXT NOT NULL,
  "name"         TEXT NOT NULL,
  "description"  TEXT,
  "permissions"  JSONB NOT NULL,
  "isBuiltIn"    BOOLEAN NOT NULL DEFAULT TRUE,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL,

  CONSTRAINT "permission_templates_fina_pkey" PRIMARY KEY ("key")
);

-- 4-2. UserInvitation
CREATE TABLE fina.user_invitations_fina (
  "id"                  TEXT NOT NULL,
  "authProvider"        fina."AuthProvider" NOT NULL,
  "scopeRole"           fina."ScopeRole" NOT NULL,
  "templateKey"         TEXT,
  "companyId"           TEXT NOT NULL,
  "displayName"         TEXT NOT NULL,
  "email"               TEXT,
  "initialPasswordHash" TEXT,
  "initialPasswordHint" TEXT,
  "pwdxCompanyId"       TEXT,
  "externalSub"         TEXT,
  "externalUserId"      TEXT,
  "notifyEmail"         TEXT,
  "invitedBy"           TEXT NOT NULL,
  "invitedAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt"           TIMESTAMP(3) NOT NULL,
  "status"              fina."InvitationStatus" NOT NULL DEFAULT 'PENDING',
  "acceptedAt"          TIMESTAMP(3),
  "acceptedUserId"      TEXT,

  CONSTRAINT "user_invitations_fina_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "user_invitations_fina_authProvider_status_idx"           ON fina.user_invitations_fina("authProvider", "status");
CREATE INDEX "user_invitations_fina_companyId_status_idx"              ON fina.user_invitations_fina("companyId", "status");
CREATE INDEX "user_invitations_fina_pwdxCompanyId_externalSub_idx"     ON fina.user_invitations_fina("pwdxCompanyId", "externalSub");
CREATE INDEX "user_invitations_fina_pwdxCompanyId_externalUserId_idx"  ON fina.user_invitations_fina("pwdxCompanyId", "externalUserId");
CREATE INDEX "user_invitations_fina_email_status_idx"                  ON fina.user_invitations_fina("email", "status");
CREATE INDEX "user_invitations_fina_status_expiresAt_idx"              ON fina.user_invitations_fina("status", "expiresAt");

-- 4-3. CompanyApplication
CREATE TABLE fina.company_applications_fina (
  "id"                 TEXT NOT NULL,
  "status"             fina."InvitationStatus" NOT NULL DEFAULT 'PENDING',
  "applicantName"      TEXT NOT NULL,
  "applicantEmail"     TEXT NOT NULL,
  "applicantPhone"     TEXT,
  "notes"              TEXT,
  "companyName"        TEXT NOT NULL,
  "usePwdx"            BOOLEAN NOT NULL DEFAULT FALSE,
  "pwdxCompanyId"      TEXT,
  "pwdxCompanyName"    TEXT,
  "externalSub"        TEXT,
  "externalUserId"     TEXT,
  "pwdxClaimsSnapshot" JSONB,
  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt"         TIMESTAMP(3),
  "reviewedBy"         TEXT,
  "reviewComment"      TEXT,
  "expiresAt"          TIMESTAMP(3) NOT NULL,
  "createdCompanyId"   TEXT,
  "createdUserId"      TEXT,

  CONSTRAINT "company_applications_fina_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "company_applications_fina_status_createdAt_idx" ON fina.company_applications_fina("status", "createdAt");
CREATE INDEX "company_applications_fina_externalSub_idx"      ON fina.company_applications_fina("externalSub");
CREATE INDEX "company_applications_fina_pwdxCompanyId_idx"    ON fina.company_applications_fina("pwdxCompanyId");

-- 4-4. PwdxIntegration
CREATE TABLE fina.pwdx_integrations_fina (
  "id"              TEXT NOT NULL,
  "companyId"       TEXT NOT NULL,
  "enabled"         BOOLEAN NOT NULL DEFAULT FALSE,
  "pwdxCompanyId"   TEXT NOT NULL,
  "apiBaseUrl"      TEXT,
  "credentialKey"   TEXT NOT NULL,
  "syncFeatures"    JSONB NOT NULL,
  "lastSyncedAt"    TIMESTAMP(3),
  "lastSyncStatus"  TEXT,
  "lastSyncMessage" TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL,

  CONSTRAINT "pwdx_integrations_fina_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "pwdx_integrations_fina_companyId_key" ON fina.pwdx_integrations_fina("companyId");

-- 4-5. PasswordResetToken
CREATE TABLE fina.password_reset_tokens_fina (
  "id"          TEXT NOT NULL,
  "userId"      TEXT NOT NULL,
  "tokenHash"   TEXT NOT NULL,
  "expiresAt"   TIMESTAMP(3) NOT NULL,
  "consumedAt"  TIMESTAMP(3),
  "requestedBy" TEXT,
  "requestIp"   TEXT,
  "userAgent"   TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "password_reset_tokens_fina_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "password_reset_tokens_fina_tokenHash_key" ON fina.password_reset_tokens_fina("tokenHash");
CREATE INDEX "password_reset_tokens_fina_userId_consumedAt_idx" ON fina.password_reset_tokens_fina("userId", "consumedAt");
CREATE INDEX "password_reset_tokens_fina_expiresAt_idx"         ON fina.password_reset_tokens_fina("expiresAt");

-- ---------- 5. Transaction / TradingPartner 拡張 ----------

ALTER TABLE fina.transactions_fina
  ADD COLUMN "externalSource" TEXT,
  ADD COLUMN "externalRef"    TEXT;

CREATE INDEX "transactions_fina_externalSource_externalRef_idx"
  ON fina.transactions_fina("externalSource", "externalRef");

ALTER TABLE fina.trading_partners_fina
  ADD COLUMN "externalSource" TEXT,
  ADD COLUMN "externalId"     TEXT;

CREATE UNIQUE INDEX "trading_partners_fina_externalSource_externalId_key"
  ON fina.trading_partners_fina("externalSource", "externalId")
  WHERE "externalSource" IS NOT NULL;

-- ---------- 6. 外部キー ----------

-- UserProfile 関連
ALTER TABLE fina.user_profiles_fina
  ADD CONSTRAINT "user_profiles_fina_primaryCompanyId_fkey"
    FOREIGN KEY ("primaryCompanyId") REFERENCES fina.companies_fina("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "user_profiles_fina_templateKey_fkey"
    FOREIGN KEY ("templateKey") REFERENCES fina.permission_templates_fina("key") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "user_profiles_fina_invitedBy_fkey"
    FOREIGN KEY ("invitedBy") REFERENCES fina.user_profiles_fina("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- UserInvitation 関連
ALTER TABLE fina.user_invitations_fina
  ADD CONSTRAINT "user_invitations_fina_invitedBy_fkey"
    FOREIGN KEY ("invitedBy") REFERENCES fina.user_profiles_fina("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "user_invitations_fina_templateKey_fkey"
    FOREIGN KEY ("templateKey") REFERENCES fina.permission_templates_fina("key") ON DELETE SET NULL ON UPDATE CASCADE;

-- CompanyApplication 関連
ALTER TABLE fina.company_applications_fina
  ADD CONSTRAINT "company_applications_fina_reviewedBy_fkey"
    FOREIGN KEY ("reviewedBy") REFERENCES fina.user_profiles_fina("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- PwdxIntegration 関連
ALTER TABLE fina.pwdx_integrations_fina
  ADD CONSTRAINT "pwdx_integrations_fina_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES fina.companies_fina("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- PasswordResetToken 関連
ALTER TABLE fina.password_reset_tokens_fina
  ADD CONSTRAINT "password_reset_tokens_fina_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES fina.user_fina("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------- 7. 既存ユーザーの初期データ移行 ----------

-- 7-1. assignedCompanyIds の先頭を primaryCompanyId に
UPDATE fina.user_profiles_fina
SET "primaryCompanyId" = "assignedCompanyIds"[1]
WHERE array_length("assignedCompanyIds", 1) > 0
  AND "primaryCompanyId" IS NULL;

-- 7-2. テンプレート割当（OPERATOR → ACCOUNTING_OPERATOR, VIEWER → EXECUTIVE_VIEWER）
-- 注: PermissionTemplate のシードを先に実行する必要あり (seed-permission-templates.ts)
-- ここでは外部キー制約があるため、シード後に手動で実行する想定
-- UPDATE fina.user_profiles_fina SET "templateKey" = 'ACCOUNTING_OPERATOR' WHERE "scopeRole" = 'OPERATOR';
-- UPDATE fina.user_profiles_fina SET "templateKey" = 'EXECUTIVE_VIEWER'    WHERE "scopeRole" = 'VIEWER';

-- 7-3. COMPANY_ADMIN はテンプレ不要 (全権限)

-- 注: SUPER_ADMIN への昇格は prisma/promote-super-admin.ts で個別実施
