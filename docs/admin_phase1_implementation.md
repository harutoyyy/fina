# Phase 1 実装計画書: 認証・権限・申請の DB 基盤と公開 register 廃止

| 項目 | 値 |
|---|---|
| ステータス | **着手前** |
| 作成日 | 2026-05-20 |
| 関連 | [admin_and_auth_design.md](./admin_and_auth_design.md) / [pwdx_integration_plan.md](./pwdx_integration_plan.md) |
| 担当（仮） | （要記入） |
| 想定工数 | 3〜5 営業日（うち migration 検証 1 日） |
| 影響範囲 | DB スキーマ / 認証 / 全 server actions / `app/(auth)/register` 削除 |

---

## 1. ゴール

[admin_and_auth_design.md §15 P1](./admin_and_auth_design.md) を実装する。要点は次の 5 つ。

1. **DB スキーマを 新管理モデル に拡張**（UserProfile 拡張 + 6 つの新規モデル）
2. **既存 UserRole enum を ScopeRole に rename + SUPER_ADMIN を追加**
3. **データ連携用カラムを Transaction / TradingPartner に先回りで追加**
4. **既存ユーザーをマイグレーションして新ロール体系に乗せる**
5. **公開 `/register` を削除**（以降は申請 + 許可モデル §7 へ）

**Phase 1 完了後の状態**: UI は変わらないが、DB と server actions が「申請 + 招待 + ロール階層 + 監査ログ + PWDX 連携設定」を扱える土台が整う。

---

## 2. スコープ

### 本フェーズで実装するもの

- Prisma スキーマ追加 / 変更
- データマイグレーション（既存ユーザー）
- 既存 server actions の権限チェック関数の共通化
- 公開 register ページの削除（とリダイレクト処理）
- PermissionTemplate のシードデータ投入

### 本フェーズで実装しないもの

- 管理者画面の UI（→ Phase 2 以降）
- 公開申請フォーム（→ Phase 2）
- セルフサービス・パスワードリセット UI（→ Phase 2）
- OIDC プロバイダ統合（→ Phase 6）
- PWDX データ同期（→ Phase 9）

---

## 3. 既存実装の調査結果

実装着手前に把握しておくべき既存実装の事実。

### 3.1 認証の構造

| モデル | 管轄 | 役割 |
|---|---|---|
| `User` | **better-auth が管理** | `id`, `name`, `email`, `emailVerified`, `image`, `createdAt`, `updatedAt` のみ。fina 独自カラムは追加しない |
| `AuthAccount` | **better-auth が管理** | `password`（ハッシュ）、`providerId`（"credential" / "pwdx" 等）、`accountId`（OIDC の sub 等）、`accessToken` / `idToken` / `refreshToken` を保持 |
| `Session` | **better-auth が管理** | セッショントークン |
| `UserProfile` | **fina 独自** | `role`, `displayName`, `assignedCompanyIds`, `isActive` を保持。本フェーズで拡張 |

**含意:**
- パスワードハッシュは **`AuthAccount.password`** に既に置かれている。設計ドキュメント §6.2 の `User.passwordHash` は **不要**
- OIDC の sub は `AuthAccount.accountId`（providerId="pwdx" のレコード）として better-auth が保存する。設計ドキュメント §6.2 の `User.externalSub` は **better-auth に任せられる**
- ただし、招待状照合の都合で `UserProfile` に `externalSub` をミラー保存する選択肢はある（後述）

### 3.2 既存 UserProfile

```prisma
model UserProfile {
  id                 String    @id @default(cuid())
  authUserId         String    @unique
  role               UserRole  @default(OPERATOR)     // ← rename 対象
  displayName        String
  assignedCompanyIds String[]                          // ← 既に複数会社対応
  isActive           Boolean   @default(true)
  createdAt          DateTime  @default(now())
  updatedAt          DateTime  @updatedAt
  user               User      @relation(...)
}
```

**含意（設計とのギャップ）:**
- 設計ドキュメントは「1人=1会社」だが、既存実装は **`assignedCompanyIds: String[]`** で複数会社割当可
- 既存運用が複数会社割当を使っているか確認が必要（後述の **修正方針**）

### 3.3 権限チェックの実装パターン

| ファイル | 関数 | パターン |
|---|---|---|
| `app/actions/user-profile.ts:15` | `getCurrentUserProfile()` | **共通関数あり** |
| `app/actions/industries.ts:8` | `requireAdmin()` | **個別重複** |
| `app/actions/company-groups.ts:8` | `requireAdmin()` | **個別重複** |
| `app/actions/sales-items.ts:13` | `requireAdmin()` | **個別重複** |
| `app/actions/transactions.ts:365` | `getUserRole(userId)` | **個別重複** |
| `app/actions/reconciliation.ts` ほか | `getCurrentUserProfile()` をインポート | 共通使用 |

**含意:**
- `requireAdmin` が 3 ファイルに重複しているので、本フェーズで `lib/auth-server.ts` に集約する
- `getUserRole` も同様

### 3.4 公開 register

| ファイル | 内容 |
|---|---|
| `app/(auth)/register/page.tsx` | better-auth の `signUp.email` を直接呼ぶ。誰でも自由にアカウント作成可 |

**含意:**
- 削除しても better-auth の signUp API は残るが、UI 経路から呼べなくなる
- API 経由のスパム登録対策は別途必要（middleware で `/api/auth/sign-up/*` をブロック）

---

## 4. 設計ドキュメントとのギャップと修正方針

| ID | ギャップ | 修正方針 |
|---|---|---|
| G-1 | 設計は `User.passwordHash` 直追加、実態は `AuthAccount.password` | 設計通り **追加しない**。better-auth に任せる |
| G-2 | 設計は `User.externalSub`、実態は `AuthAccount.providerId/accountId` で better-auth 管理 | better-auth に任せる。**ただし招待状照合の便宜のため `UserProfile.externalSub` をミラー保持**（OIDC 成功時にコピー） |
| G-3 | 設計は「1人=1会社」、実態は `assignedCompanyIds: String[]` で複数可 | **既存カラムを残しつつ `primaryCompanyId` を追加**。1:1 の原則はアプリ層でガード。SUPER_ADMIN や移行期は複数割当を許容 |
| G-4 | 設計は `User.scopeRole`、実態は `UserProfile.role` | `UserProfile.role` を `UserProfile.scopeRole` に rename |
| G-5 | 設計は新規 `UserRole` を別 enum で書いていたが、実態の `UserRole` enum を rename する形 | `UserRole` → `ScopeRole`、メンバーに `SUPER_ADMIN` 追加 |
| G-6 | 設計は `User.invitedBy`、実態 | `UserProfile.invitedBy` を追加 |
| G-7 | 設計は `User.lastLoginAt`、実態 | `UserProfile.lastLoginAt` を追加 |
| G-8 | 設計は `User.mustChangePassword`、実態 | `UserProfile.mustChangePassword` を追加 |

→ **全体方針**: `User` モデルは better-auth の管轄として touchしない。fina 独自フィールドは **すべて `UserProfile` に集約**。

---

## 5. Prisma スキーマ変更

### 5.1 enum

```prisma
// 既存 UserRole を rename
enum ScopeRole {
  SUPER_ADMIN      // 新規
  COMPANY_ADMIN    // 旧 ADMIN
  OPERATOR
  VIEWER

  @@schema("fina")
}

// 新規
enum AuthProvider {
  LOCAL
  PWDX_OIDC

  @@schema("fina")
}

// 新規
enum InvitationStatus {
  PENDING
  ACCEPTED
  REJECTED
  EXPIRED
  REVOKED

  @@schema("fina")
}
```

**Migration ノート:**
- `UserRole` → `ScopeRole` の rename は PostgreSQL では `ALTER TYPE userrole RENAME TO scoperole` で 1 ステップ
- 値の追加: `ALTER TYPE scoperole ADD VALUE 'SUPER_ADMIN' BEFORE 'COMPANY_ADMIN'`
- 値の rename: `ALTER TYPE scoperole RENAME VALUE 'ADMIN' TO 'COMPANY_ADMIN'`
- Prisma の自動 migration で `prisma migrate dev` する場合、データ保持を最優先にして **手書き SQL** を採用する

### 5.2 UserProfile 拡張

```prisma
model UserProfile {
  id                 String    @id @default(cuid())
  authUserId         String    @unique
  scopeRole          ScopeRole @default(OPERATOR)        // ← rename from role
  displayName        String

  // 会社割当
  primaryCompanyId   String?                             // NEW: 主たる所属（1人=1会社の運用上の primary）
  assignedCompanyIds String[]                            // 既存維持。SUPER_ADMIN は複数可、運用移行用

  // 認証関連
  authProvider       AuthProvider @default(LOCAL)        // NEW
  externalSub        String?    @unique                  // NEW: PWDX OIDC sub のミラー保管
  mustChangePassword Boolean    @default(false)          // NEW

  // 権限テンプレ
  templateKey        String?                             // NEW: PermissionTemplate.key
  permissionsOverride Json?                              // NEW: 将来の個別上書き用（v1 未使用）

  // 招待 / ログイン履歴
  invitedBy          String?                             // NEW: UserProfile.id 自参照
  lastLoginAt        DateTime?                           // NEW

  isActive           Boolean   @default(true)
  createdAt          DateTime  @default(now())
  updatedAt          DateTime  @updatedAt

  user               User      @relation(fields: [authUserId], references: [id], onDelete: Cascade)
  primaryCompany     Company?  @relation("UserProfilePrimaryCompany", fields: [primaryCompanyId], references: [id])
  template           PermissionTemplate? @relation(fields: [templateKey], references: [key])
  invitee            UserProfile? @relation("UserProfileInviter", fields: [invitedBy], references: [id])
  invitedProfiles    UserProfile[] @relation("UserProfileInviter")

  @@index([primaryCompanyId])
  @@index([scopeRole])
  @@index([authProvider])
  @@schema("fina")
  @@map("user_profiles_fina")
}
```

### 5.3 新規モデル

[admin_and_auth_design.md §6](./admin_and_auth_design.md) を反映。長くなるので主要なポイントだけ:

- `UserInvitation` (§6.3)
- `CompanyApplication` (§6.6)
- `PermissionTemplate` (§6.4)
- `PwdxIntegration` (§6.5)
- `AuditLog` (§6.8)
- `PasswordResetToken` (§6.7)

実装時は設計ドキュメントの Prisma 定義を **そのままコピー** する。ただし以下の調整:

| 差分 | 内容 |
|---|---|
| `UserInvitation.invitedBy` の参照先 | 設計では `User.id` → 実装では `UserProfile.id` に変更（fina 内のロールを持つのは UserProfile のため） |
| `CompanyApplication.reviewedBy` の参照先 | 同上 |
| `AuditLog.userId` の参照先 | 同上 |
| `PasswordResetToken.userId` の参照先 | better-auth の `User.id`（authUserId と整合） |

### 5.4 既存モデル拡張（データ連携先回り）

PWDX 連携実装フェーズ（P9）で migration が膨らまないよう、本フェーズで先に入れる。

```prisma
model Transaction {
  // ... 既存フィールド ...

  // データ連携用（NEW）
  externalSource  String?    // "pwdx" | "manual" | "xlsx" | "ocr" など
  externalRef     String?    // PWDX 請求/発注 ID 等の外部参照 ID（冪等キー）

  // ... 既存リレーション ...

  @@index([externalSource, externalRef])
  // 既存 index は維持
}

model TradingPartner {
  // ... 既存フィールド ...

  // データ連携用（NEW）
  externalSource  String?    // "pwdx" | "fina"
  externalId      String?    // PWDX 側 ID（externalSource とのペアでユニーク）

  @@unique([externalSource, externalId])
}
```

---

## 6. データマイグレーション

### 6.1 Prisma migration ファイル

```
prisma/migrations/2026XXXX_phase1_admin_foundation/
├── migration.sql       ← 手書き SQL
└── (Prisma 自動生成は不採用)
```

理由: enum の rename と値追加は Prisma 自動 migration が DROP + CREATE になりがちで、データを失うため。

### 6.2 SQL 順序

```sql
-- 1. enum 変更
ALTER TYPE fina."UserRole" RENAME TO "ScopeRole";
ALTER TYPE fina."ScopeRole" ADD VALUE 'SUPER_ADMIN' BEFORE 'COMPANY_ADMIN';
ALTER TYPE fina."ScopeRole" RENAME VALUE 'ADMIN' TO 'COMPANY_ADMIN';

-- 2. 新規 enum
CREATE TYPE fina."AuthProvider" AS ENUM ('LOCAL', 'PWDX_OIDC');
CREATE TYPE fina."InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'REVOKED');

-- 3. UserProfile 拡張
ALTER TABLE fina.user_profiles_fina
  ADD COLUMN "primaryCompanyId"     TEXT,
  ADD COLUMN "authProvider"         fina."AuthProvider" NOT NULL DEFAULT 'LOCAL',
  ADD COLUMN "externalSub"          TEXT UNIQUE,
  ADD COLUMN "mustChangePassword"   BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN "templateKey"          TEXT,
  ADD COLUMN "permissionsOverride"  JSONB,
  ADD COLUMN "invitedBy"            TEXT,
  ADD COLUMN "lastLoginAt"          TIMESTAMP;

-- 既存 role カラムは ScopeRole 型として残るが、column 名を scopeRole に rename
ALTER TABLE fina.user_profiles_fina RENAME COLUMN "role" TO "scopeRole";

-- 4. 新規テーブル
CREATE TABLE fina.permission_templates_fina (...);
CREATE TABLE fina.user_invitations_fina (...);
CREATE TABLE fina.company_applications_fina (...);
CREATE TABLE fina.pwdx_integrations_fina (...);
CREATE TABLE fina.audit_logs_fina (...);
CREATE TABLE fina.password_reset_tokens_fina (...);

-- 5. 既存 Transaction / TradingPartner 拡張
ALTER TABLE fina.transactions_fina
  ADD COLUMN "externalSource"  TEXT,
  ADD COLUMN "externalRef"     TEXT;
CREATE INDEX ON fina.transactions_fina ("externalSource", "externalRef");

ALTER TABLE fina.trading_partners_fina
  ADD COLUMN "externalSource"  TEXT,
  ADD COLUMN "externalId"      TEXT;
CREATE UNIQUE INDEX ON fina.trading_partners_fina ("externalSource", "externalId")
  WHERE "externalSource" IS NOT NULL;

-- 6. データ初期化（既存ユーザー）
-- 6-1. assignedCompanyIds の先頭を primaryCompanyId に
UPDATE fina.user_profiles_fina
SET "primaryCompanyId" = COALESCE("assignedCompanyIds"[1], NULL);

-- 6-2. テンプレート割当（既存 OPERATOR → ACCOUNTING_OPERATOR）
UPDATE fina.user_profiles_fina
SET "templateKey" = 'ACCOUNTING_OPERATOR'
WHERE "scopeRole" = 'OPERATOR';

UPDATE fina.user_profiles_fina
SET "templateKey" = 'EXECUTIVE_VIEWER'
WHERE "scopeRole" = 'VIEWER';

-- 6-3. COMPANY_ADMIN にはテンプレ不要（全権限）

-- 7. SUPER_ADMIN の手動昇格（次節参照）

-- 8. PermissionTemplate のシード（次節参照）
```

### 6.3 SUPER_ADMIN の初期登録

UI からは作れないので、CLI スクリプトを用意:

```typescript
// prisma/promote-super-admin.ts
import { prisma } from "@/lib/prisma";

const email = process.argv[2];
if (!email) { console.error("Usage: tsx promote-super-admin.ts <email>"); process.exit(1); }

const user = await prisma.user.findUnique({ where: { email } });
if (!user) { console.error(`User not found: ${email}`); process.exit(1); }

await prisma.userProfile.update({
  where: { authUserId: user.id },
  data: {
    scopeRole: "SUPER_ADMIN",
    primaryCompanyId: null,   // SUPER_ADMIN は所属会社不問
    templateKey: null,
  },
});

console.log(`Promoted ${email} to SUPER_ADMIN`);
```

**実行例:**
```bash
npx tsx prisma/promote-super-admin.ts h.oomuro@winners.jp
```

### 6.4 PermissionTemplate のシード

```typescript
// prisma/seed-permission-templates.ts
const templates = [
  {
    key: "ACCOUNTING_OPERATOR",
    name: "経理オペレーター",
    description: "経費・売上・原価・給与の登録と編集。確定・月締めは不可。",
    permissions: [
      "expenses:view", "expenses:create", "expenses:edit",
      "sales:view", "sales:create", "sales:edit",
      "costs:view", "costs:create", "costs:edit",
      "salary:view", "salary:create", "salary:edit",
      "cashflow_table:view",
      "master.partners:view", "master.accounts:view", "master.categories:view",
    ],
    isBuiltIn: true,
    displayOrder: 10,
  },
  {
    key: "ACCOUNTING_MANAGER",
    name: "経理マネージャー",
    description: "経理オペレーター + 確定・月締め。",
    permissions: [
      "expenses:view", "expenses:create", "expenses:edit", "expenses:confirm",
      "sales:view", "sales:create", "sales:edit", "sales:confirm",
      "costs:view", "costs:create", "costs:edit", "costs:confirm",
      "salary:view", "salary:create", "salary:edit", "salary:confirm",
      "cashflow_table:view", "month:lock",
      // master 系も view/edit 全般
      "master.partners:view", "master.partners:edit",
      "master.accounts:view", "master.accounts:edit",
      "master.categories:view", "master.categories:edit",
    ],
    isBuiltIn: true,
    displayOrder: 20,
  },
  {
    key: "SALES_STAFF",
    name: "営業担当",
    description: "売上の登録のみ。",
    permissions: [
      "sales:view", "sales:create", "sales:edit",
      "master.partners:view",
      "cashflow_table:view",
    ],
    isBuiltIn: true,
    displayOrder: 30,
  },
  {
    key: "PAYROLL_STAFF",
    name: "給与担当",
    description: "給与の登録のみ。",
    permissions: [
      "salary:view", "salary:create", "salary:edit", "salary:confirm",
      "master.payroll_groups:view", "master.deduction_categories:view",
    ],
    isBuiltIn: true,
    displayOrder: 40,
  },
  {
    key: "EXECUTIVE_VIEWER",
    name: "役員（閲覧）",
    description: "全機能の閲覧のみ。",
    permissions: [
      "expenses:view", "sales:view", "costs:view", "salary:view",
      "cashflow_table:view", "reports:view", "journal:view",
      "dashboard:view",
    ],
    isBuiltIn: true,
    displayOrder: 50,
  },
];

for (const t of templates) {
  await prisma.permissionTemplate.upsert({
    where: { key: t.key },
    create: t,
    update: t,
  });
}
```

実行: `npx tsx prisma/seed-permission-templates.ts`

---

## 7. アプリケーションコード変更

### 7.1 `lib/auth-server.ts` の拡張

既存 `requireSession` に加えて、ロール判定の共通関数を追加。

```typescript
// lib/auth-server.ts (拡張)
import { auth } from "./auth";
import { headers } from "next/headers";
import { prisma } from "./prisma";

export async function getServerSession() { /* 既存 */ }
export async function requireSession() { /* 既存 */ }

// ↓ NEW

export type ScopeRole = "SUPER_ADMIN" | "COMPANY_ADMIN" | "OPERATOR" | "VIEWER";

export type SessionContext = {
  userId: string;
  profileId: string;
  scopeRole: ScopeRole;
  primaryCompanyId: string | null;
  assignedCompanyIds: string[];
  templateKey: string | null;
  isActive: boolean;
};

export async function getSessionContext(): Promise<SessionContext> {
  const session = await requireSession();
  const profile = await prisma.userProfile.findUnique({
    where: { authUserId: session.user.id },
  });
  if (!profile || !profile.isActive) {
    throw new Error("Forbidden: profile not found or inactive");
  }
  return {
    userId: session.user.id,
    profileId: profile.id,
    scopeRole: profile.scopeRole as ScopeRole,
    primaryCompanyId: profile.primaryCompanyId,
    assignedCompanyIds: profile.assignedCompanyIds,
    templateKey: profile.templateKey,
    isActive: profile.isActive,
  };
}

export async function requireRole(...allowed: ScopeRole[]): Promise<SessionContext> {
  const ctx = await getSessionContext();
  if (!allowed.includes(ctx.scopeRole)) {
    throw new Error(`Forbidden: requires ${allowed.join(" or ")}`);
  }
  return ctx;
}

export async function requireSuperAdmin() {
  return requireRole("SUPER_ADMIN");
}

export async function requireCompanyAdmin() {
  return requireRole("SUPER_ADMIN", "COMPANY_ADMIN");
}

export async function hasPermission(
  ctx: SessionContext,
  permission: string
): Promise<boolean> {
  // SUPER_ADMIN は全権
  if (ctx.scopeRole === "SUPER_ADMIN") return true;
  // COMPANY_ADMIN は自社内で全権（v1 ではテンプレ不問）
  if (ctx.scopeRole === "COMPANY_ADMIN") return true;
  // OPERATOR / VIEWER はテンプレに従う
  if (!ctx.templateKey) return false;
  const template = await prisma.permissionTemplate.findUnique({
    where: { key: ctx.templateKey },
  });
  if (!template) return false;
  const perms = template.permissions as string[];
  return perms.includes(permission);
}
```

### 7.2 既存 `requireAdmin` の置き換え

3 ファイルで重複している `requireAdmin` を `lib/auth-server.ts` の `requireCompanyAdmin` に置き換える。

| ファイル | Before | After |
|---|---|---|
| `app/actions/industries.ts` | ローカル `requireAdmin()` 定義 | `import { requireCompanyAdmin } from "@/lib/auth-server"` |
| `app/actions/company-groups.ts` | 同上 | 同上 |
| `app/actions/sales-items.ts` | 同上 | 同上 |
| `app/actions/transactions.ts` | ローカル `getUserRole(userId)` | `getSessionContext()` |

### 7.3 `getCurrentUserProfile` の型更新

```typescript
// app/actions/user-profile.ts
export type CurrentUserProfile = {
  id: string;
  authUserId: string;
  scopeRole: ScopeRole;          // ← was string (role)
  displayName: string;
  primaryCompanyId: string | null; // ← NEW
  assignedCompanyIds: string[];
  templateKey: string | null;     // ← NEW
  isActive: boolean;
};
```

**既存呼び出し側の影響:**
- `profile?.role === "ADMIN"` → `profile?.scopeRole === "COMPANY_ADMIN"`
- 該当箇所をすべて置換（影響箇所は `app/(dashboard)/**/page.tsx` を中心に 10〜20 箇所程度）

### 7.4 公開 register の削除

| 変更内容 | ファイル |
|---|---|
| ページ削除 | `app/(auth)/register/page.tsx` |
| ディレクトリ削除 | `app/(auth)/register/` |
| ログイン画面の「新規登録」リンク削除 | `app/(auth)/login/page.tsx`（リンクが存在する場合） |
| better-auth の signUp API 経路の制限 | `lib/auth.ts` で `signUp` を無効化 or middleware で `/api/auth/sign-up/*` をブロック |
| `signUp.email` のインポート削除 | `lib/auth-client.ts` 等 |

**better-auth の signUp 無効化:**
```typescript
// lib/auth.ts
export const auth = betterAuth({
  // ...
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    // signUp は better-auth の設定で制御できない場合は middleware で行う
  },
});
```

middleware で API を保護:
```typescript
// middleware.ts
import { NextResponse } from "next/server";

export function middleware(req: Request) {
  const url = new URL(req.url);
  if (url.pathname.startsWith("/api/auth/sign-up")) {
    return new NextResponse("Not Found", { status: 404 });
  }
  if (url.pathname === "/register") {
    return NextResponse.redirect(new URL("/login", req.url));
  }
}

export const config = {
  matcher: ["/api/auth/sign-up/:path*", "/register"],
};
```

---

## 8. テスト計画

### 8.1 ユニットテスト

| 対象 | テスト内容 |
|---|---|
| `getSessionContext` | 有効ユーザー / 無効化ユーザー / プロフィール無し |
| `requireRole` | 各ロールごとの許可 / 拒否 |
| `hasPermission` | SUPER_ADMIN 全許可 / OPERATOR テンプレ準拠 / テンプレ無し時 false |

### 8.2 統合テスト

| シナリオ | 期待結果 |
|---|---|
| 既存 ADMIN ユーザーがログイン | scopeRole=COMPANY_ADMIN として扱われ、既存メニューに変化なし |
| 既存 OPERATOR ユーザーがログイン | scopeRole=OPERATOR、templateKey=ACCOUNTING_OPERATOR が付与され、既存機能が動く |
| `/register` にアクセス | `/login` にリダイレクト |
| `POST /api/auth/sign-up/email` | 404 が返る |
| `requireCompanyAdmin` 必須の action を OPERATOR で呼ぶ | "Forbidden" エラー |
| `prisma migrate deploy` を staging で実行 | データ損失なし |

### 8.3 マイグレーション検証

本番反映前に staging で:
1. 本番 DB の snapshot を staging に restore
2. 本番に近い件数で migration 実行
3. ユーザー数、UserProfile 数、Transaction 数が変わらないことを確認
4. 全ユーザーが正しく scopeRole にマップされているか確認
5. ログインテスト（既存ユーザー数名）
6. 主要 server actions の動作確認

---

## 9. ロールバック計画

migration 失敗時の戻し方:

```sql
-- 1. 新規テーブル削除
DROP TABLE fina.password_reset_tokens_fina;
DROP TABLE fina.audit_logs_fina;
DROP TABLE fina.pwdx_integrations_fina;
DROP TABLE fina.company_applications_fina;
DROP TABLE fina.user_invitations_fina;
DROP TABLE fina.permission_templates_fina;

-- 2. UserProfile カラム削除
ALTER TABLE fina.user_profiles_fina
  DROP COLUMN "lastLoginAt",
  DROP COLUMN "invitedBy",
  DROP COLUMN "permissionsOverride",
  DROP COLUMN "templateKey",
  DROP COLUMN "mustChangePassword",
  DROP COLUMN "externalSub",
  DROP COLUMN "authProvider",
  DROP COLUMN "primaryCompanyId";

ALTER TABLE fina.user_profiles_fina RENAME COLUMN "scopeRole" TO "role";

-- 3. Transaction / TradingPartner のカラム削除
ALTER TABLE fina.transactions_fina
  DROP COLUMN "externalRef",
  DROP COLUMN "externalSource";

ALTER TABLE fina.trading_partners_fina
  DROP COLUMN "externalId",
  DROP COLUMN "externalSource";

-- 4. enum 戻し
ALTER TYPE fina."ScopeRole" RENAME VALUE 'COMPANY_ADMIN' TO 'ADMIN';
-- SUPER_ADMIN メンバーの削除は PG では不可（一度作成された enum 値は削除不可）
-- → 代わりに該当ユーザーを COMPANY_ADMIN に戻して放置
ALTER TYPE fina."ScopeRole" RENAME TO "UserRole";

DROP TYPE fina."InvitationStatus";
DROP TYPE fina."AuthProvider";
```

**注意**: PostgreSQL の enum は値の削除ができない。`SUPER_ADMIN` メンバーは残るが、誰も使っていなければ実害なし。

---

## 10. 作業チェックリスト

実装着手者が上から順にチェックする想定。

### 10.1 事前確認
- [ ] 本ドキュメント全体を読了
- [ ] [admin_and_auth_design.md](./admin_and_auth_design.md) §6 のスキーマと整合
- [ ] 既存本番ユーザー数と ADMIN/OPERATOR/VIEWER の内訳を確認
- [ ] **SUPER_ADMIN に昇格するユーザーのメアドを 1 名決める**
- [ ] staging 環境の確保

### 10.2 スキーマ実装
- [ ] `prisma/schema.prisma` を更新（enum / UserProfile / 6 新規モデル / Transaction・TradingPartner 拡張）
- [ ] `prisma migrate dev --name phase1_admin_foundation --create-only` で migration ファイル生成
- [ ] 自動生成 SQL を本ドキュメント §6.2 に沿って **手書きで上書き**
- [ ] `prisma migrate dev` で local 反映
- [ ] `prisma generate` で client 更新

### 10.3 シード
- [ ] `prisma/seed-permission-templates.ts` を作成
- [ ] local で `npx tsx prisma/seed-permission-templates.ts` 実行
- [ ] PermissionTemplate が 5 件入っていることを確認

### 10.4 コード変更
- [ ] `lib/auth-server.ts` に `getSessionContext` / `requireRole` 等を追加
- [ ] `app/actions/industries.ts` の `requireAdmin` を `requireCompanyAdmin` に置換
- [ ] `app/actions/company-groups.ts` 同上
- [ ] `app/actions/sales-items.ts` 同上
- [ ] `app/actions/transactions.ts` の `getUserRole` を `getSessionContext` に置換
- [ ] `app/actions/user-profile.ts` の型を `ScopeRole` 対応に更新
- [ ] 各 `app/(dashboard)/**/page.tsx` で `profile.role === "ADMIN"` → `profile.scopeRole === "COMPANY_ADMIN"` 置換
- [ ] `app/(auth)/register/page.tsx` 削除
- [ ] `middleware.ts` で `/register` リダイレクトと `/api/auth/sign-up/*` ブロック追加

### 10.5 SUPER_ADMIN 設定
- [ ] `prisma/promote-super-admin.ts` を作成
- [ ] local で運用担当者のメアドを SUPER_ADMIN に昇格してログイン確認

### 10.6 検証
- [ ] `npm run build` がエラーなく通る
- [ ] `npm run lint` 通過
- [ ] 既存 E2E テスト全通過
- [ ] 既存 ADMIN ユーザーでログインしてダッシュボード表示
- [ ] 既存 OPERATOR ユーザーで経費入力ができる
- [ ] `/register` が `/login` にリダイレクト
- [ ] `POST /api/auth/sign-up/email` が 404

### 10.7 staging 反映
- [ ] 本番 DB snapshot を staging に restore
- [ ] migration 実行
- [ ] ユーザー数・取引数が変わらないことを確認
- [ ] 主要画面の動作確認
- [ ] SUPER_ADMIN 昇格スクリプトを staging で実行

### 10.8 本番反映
- [ ] メンテナンス時間の告知
- [ ] DB バックアップ
- [ ] `prisma migrate deploy`
- [ ] PermissionTemplate シード
- [ ] SUPER_ADMIN 昇格
- [ ] スモークテスト

---

## 11. 工数見積もり（参考）

| 作業 | 工数 |
|---|---|
| スキーマ設計の確定（本ドキュメント前提） | 0.5 日 |
| Prisma スキーマ更新 + migration SQL 作成 | 1 日 |
| シードスクリプト作成 | 0.25 日 |
| `lib/auth-server.ts` 拡張 + 重複 requireAdmin 統合 | 0.5 日 |
| 各 server actions の role 参照置換 | 0.5 日 |
| 画面側の `role === "ADMIN"` 置換 | 0.25 日 |
| `/register` 削除 + middleware 設定 | 0.25 日 |
| ローカルテスト + 既存 E2E 通過確認 | 0.5 日 |
| Staging 検証 | 0.5 日 |
| 本番反映 + 動作確認 | 0.25 日 |
| バッファ | 0.5 日 |
| **合計** | **約 5 営業日** |

---

## 12. リスクと対策

| ID | リスク | 影響度 | 対策 |
|---|---|---|---|
| R-1 | 既存ユーザーのログイン不可（migration ミス） | 高 | staging で本番相当データで検証。ロールバック SQL を事前準備 |
| R-2 | better-auth の signUp 無効化が完全でなく、API 経由で登録可能 | 中 | middleware で `/api/auth/sign-up/*` をブロック。E2E で 404 確認 |
| R-3 | `assignedCompanyIds` を使う既存運用が壊れる | 中 | `primaryCompanyId` を追加するのみで、`assignedCompanyIds` は維持。既存挙動に影響なし |
| R-4 | enum rename で migration が DROP + CREATE になる | 高 | 手書き SQL で `ALTER TYPE ... RENAME` を使う |
| R-5 | `User.passwordHash` を増やしてしまう（better-auth と二重管理） | 中 | 設計ドキュメントの該当カラムは無視し、AuthAccount.password に統一 |
| R-6 | `requireAdmin` 置換漏れで権限チェック抜け | 中 | grep で残存箇所を機械的に洗い出す |
| R-7 | `profile.role` 直参照箇所の置換漏れ | 中 | TypeScript の型を `role` を持たない形にして、コンパイルエラーで強制検出 |
| R-8 | 監査ログ未テーブル状態で server action が記録できない | 低 | AuditLog テーブルは Phase 1 で作成されているので問題なし。書き込みコードは Phase 4 |

---

## 13. 完了の定義（DoD）

以下すべてを満たしたら Phase 1 完了とみなす。

- [ ] 本番 DB に migration が反映されている
- [ ] 全ユーザーが新 ScopeRole に正しくマップされている
- [ ] PermissionTemplate が 5 件存在する
- [ ] SUPER_ADMIN が 1 名以上存在する
- [ ] 既存機能（経費入力・売上入力・資金繰り表 等）が全て動作
- [ ] `/register` が無効化されている
- [ ] `requireAdmin` の重複が解消されている
- [ ] `lib/auth-server.ts` に共通関数（`getSessionContext` / `requireRole` 等）がある
- [ ] AuditLog テーブルが存在する（書き込みは Phase 4）
- [ ] PwdxIntegration テーブルが存在する（UI は Phase 5）
- [ ] Transaction / TradingPartner に `externalSource` / `externalRef` / `externalId` カラムが存在する
- [ ] 既存 E2E テストが全通過
- [ ] ロールバック手順が staging で検証済み

---

## 14. Phase 2 への引き継ぎ事項

- 本フェーズで作った `PermissionTemplate` を、Phase 2 の招待画面で「テンプレ選択ドロップダウン」として使う
- `UserInvitation` テーブルは Phase 2 の招待フローで初めて書き込まれる
- `CompanyApplication` テーブルは Phase 2 の公開申請フォームで初めて書き込まれる
- `PasswordResetToken` テーブルは Phase 2 のセルフサービスリセットで初めて書き込まれる

---

*本ドキュメントは Phase 1 のみを扱います。Phase 2 以降は別実装計画書を用意してください。*
