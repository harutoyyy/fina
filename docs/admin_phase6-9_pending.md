# Phase 6〜9 実装待ちノート

| 項目 | 値 |
|---|---|
| ステータス | **PWDX 側準備待ち** |
| 作成日 | 2026-05-20 |
| 関連 | [admin_master_plan.md](./admin_master_plan.md) / [admin_and_auth_design.md](./admin_and_auth_design.md) / [pwdx_integration_plan.md](./pwdx_integration_plan.md) |

---

## なぜ未実装か

| Phase | 名前 | ブロッカー |
|---|---|---|
| **P6** | OIDC プロバイダ統合 | PWDX 側で Keycloak Realm `pwdx` に fina を Client 登録、Client ID/Secret の共有が必要 |
| **P7** | 公開申請に PWDX 認証選択肢 | P6 が前提 |
| **P8** | 招待画面に PWDX タイプ追加 | P6 が前提 |
| **P9** | PWDX データ同期 | PWDX 側の API 仕様確定 + サンドボックス環境が必要 (`pwdx_integration_plan.md` のチェックシートが空) |

P5 まで完了した時点で **fina は LOCAL ユーザーのみで完全運用が可能** (申請 → 許可 → ユーザー追加 → 経理 → 月締め → 監査)。P6 以降は PWDX 側の準備が整い次第着手します。

---

## P6. OIDC プロバイダ統合（PWDX ログイン）

### ゴール
ログイン画面に「PWDX でログイン」ボタンが現れ、Keycloak Realm `pwdx` 経由で認証できる。

### 着手前のチェックリスト（PWDX 側）

- [ ] Keycloak Realm `pwdx` に fina を Client 登録
- [ ] Client ID と Client Secret を fina に共有
- [ ] Redirect URI を許可リストに追加: `https://fina-five.vercel.app/api/auth/callback/pwdx`
- [ ] 必須 Claims を返す設定: `sub`, `pwdx_company_id`, `pwdx_user_id`, `name`
- [ ] discovery エンドポイント URL の共有: `https://...keycloak.../realms/pwdx/.well-known/openid-configuration`

### 着手前のチェックリスト（fina 側）

- [ ] `.env` に追加:
  - `PWDX_OIDC_CLIENT_ID`
  - `PWDX_OIDC_CLIENT_SECRET`
  - `PWDX_OIDC_ISSUER_URL`
- [ ] better-auth の `generic-oauth` プラグインの動作確認

### 実装ステップ

1. `lib/auth.ts` に better-auth 用 OIDC provider 追加
2. `app/(auth)/login/page.tsx` に「PWDX でログイン」ボタン
3. id_token 検証 + Claims 抽出 (`lib/oidc.ts`)
4. OIDC 成功時に `UserProfile.externalSub` にミラー保存
5. 既存 LOCAL ユーザーとの紐付け確認画面（メアド一致時）
6. エラー画面: 招待されていない / 失効 / `pwdx_company_id` 不一致

### 工数: 8 営業日（うち 2 日は PWDX 側との調整待ち）

---

## P7. 公開申請に PWDX 認証選択肢

### ゴール
公開申請フォームに「PWDX 認証で続行」ボタンを追加。認証成立で会社情報が pre-fill された申請を作成できる。

### 着手前提

- [ ] P6 完了
- [ ] P2 の `/apply` フォームが動作している

### 実装ステップ

1. `app/(auth)/apply/page.tsx` に「PWDX 認証を使う / 使わない」ラジオボタン
2. 「PWDX で認証して続行」ボタン → `/api/auth/oidc/pwdx` リダイレクト
3. 認証成立後 `/apply?prefill=oidc&claims=...` で pre-fill フォーム表示
4. `CompanyApplication.pwdxClaimsSnapshot` に JSON 保存
5. 承認時のロジック修正 (`app/actions/company-applications.ts`):
   - `usePwdx=true` の場合、`PwdxIntegration` を `enabled=true` で自動作成
   - `UserProfile.authProvider=PWDX_OIDC` として初期 COMPANY_ADMIN 作成
   - `UserProfile.externalSub` に sub 保存
6. 申請者への確認メール文面を PWDX あり / なしで分岐
7. 承認画面の詳細表示に PWDX 情報追加（pwdxClaimsSnapshot を整形表示）

### 工数: 3 営業日

---

## P8. 招待画面に PWDX タイプ追加

### ゴール
COMPANY_ADMIN が「この PWDX ユーザーを fina にも招待」ができる。

### 着手前提

- [ ] P6 完了
- [ ] P3 の `/admin/users/new` 招待画面が動作している
- [ ] 該当会社の `PwdxIntegration.enabled = true`

### 実装ステップ

1. `app/(dashboard)/admin/users/new/page.tsx` に「認証タイプ: LOCAL / PWDX」ラジオ
2. PWDX 連携が未設定の会社では PWDX タイプを選択不可（disabled）
3. PWDX タイプ選択時、`PWDX user_id` または `sub` の手動入力フィールドを表示
   - P9 完了後は「PWDX 一覧 API から選択」ピッカーを追加
4. `UserInvitation` 作成時に `authProvider=PWDX_OIDC`, `externalSub`/`externalUserId`/`pwdxCompanyId` を保存
5. OIDC ログイン時の招待状照合（`lib/invitation-matcher.ts`）:
   1. `externalSub == id_token.sub` で検索
   2. `externalUserId == id_token.pwdx_user_id` で検索
   3. `pwdxCompanyId` 境界チェック
6. 招待状一覧画面 `/admin/invitations` の表示に「識別子」列を追加（email / sub / user_id を切替表示）

### 工数: 4 営業日

---

## P9. PWDX データ同期

### ゴール
PWDX → fina のデータ自動取込が動く。

### 着手前提

- [ ] P5 完了（PwdxIntegration の保存先がある）
- [ ] P6 完了（OIDC 認証で API キー / OAuth が機能する）
- [ ] PWDX 側 API 仕様の確定（`pwdx_integration_plan.md` のチェックシートが埋まっている）
- [ ] API キー / OAuth Client 情報の発行
- [ ] サンドボックス環境の確保
- [ ] `Transaction.externalSource` / `externalRef` / `TradingPartner.externalSource` / `externalId` カラムが存在する（P1 で追加済）

### 新規テーブル

```prisma
model SyncJob {
  id              String   @id @default(cuid())
  companyId       String
  jobType         String   // "PARTNERS" | "INVOICES" | "ORDERS" | "PAYMENT_FEEDBACK"
  status          String   // "QUEUED" | "RUNNING" | "SUCCESS" | "FAILED"
  startedAt       DateTime?
  completedAt     DateTime?
  totalRecords    Int      @default(0)
  successCount    Int      @default(0)
  failureCount    Int      @default(0)
  errorMessage    String?
  triggeredBy     String?  // UserProfile.id or "CRON"
  createdAt       DateTime @default(now())

  logs            SyncJobLog[]

  @@index([companyId, jobType, status])
  @@index([startedAt])
  @@schema("fina")
  @@map("sync_jobs_fina")
}

model SyncJobLog {
  id            String   @id @default(cuid())
  jobId         String
  level         String   // "INFO" | "WARN" | "ERROR"
  message       String
  recordRef     String?  // 対象レコードの externalRef 等
  payload       Json?
  createdAt     DateTime @default(now())

  job           SyncJob  @relation(fields: [jobId], references: [id], onDelete: Cascade)

  @@index([jobId, level])
  @@schema("fina")
  @@map("sync_job_logs_fina")
}
```

### 実装ステップ

1. **SyncJob/SyncJobLog テーブル追加** (Prisma migration)
2. **`lib/pwdx-client.ts`** - PWDX API クライアント
   - レート制限・リトライ・タイムアウト
   - OAuth Bearer Token の自動更新
3. **`lib/sync-jobs/`** ディレクトリ:
   - `partners.ts` - UC-02 取引先マスタ同期 (PWDX → `TradingPartner`)
   - `invoices.ts` - UC-01 請求書同期 (PWDX → `Transaction` type=SALES)
   - `orders.ts` - UC-03 発注同期 (PWDX → `Transaction` type=COST_PAYMENT)
   - `payment-feedback.ts` - UC-06 入金消込フィードバック (fina → PWDX、任意)
4. **スケジューラ**:
   - Vercel Cron で日次起動 (`vercel.json`)
   - または `app/api/cron/pwdx-sync/route.ts` を Vercel Cron が叩く
   - 会社単位 × `syncFeatures` に従って起動
5. **「今すぐ同期」ボタンの実体実装** (P5 の `syncNow()` を本実装に置換)
6. **同期履歴画面の実装** (P5 で空表示の枠を埋める)
7. **失敗時の詳細表示 + 再実行ボタン**
8. **既存 Transaction との整合**:
   - `externalSource="pwdx"` + `externalRef` のユニーク制約 (P1 で追加済)
   - PWDX 由来取引の手動編集ガード（要決定）
   - PWDX 側取消時の fina 取引の取消ステータス更新
   - 同一 ID で再同期された時の挙動（上書き / スキップ）

### 工数: 12 営業日

---

## 並列着手の推奨順序

1. **P6** を最初に必ず完了させる (OIDC 基盤が他の前提)
2. **P7 + P8** を並列着手（共に P6 完了後）
3. **P9** を最後に着手（API 仕様確定が必要）

---

## 関連ドキュメント

- [admin_master_plan.md](./admin_master_plan.md) — 全 Phase の概要と工数
- [admin_and_auth_design.md](./admin_and_auth_design.md) — 認証・権限・申請の設計仕様
- [pwdx_integration_plan.md](./pwdx_integration_plan.md) — PWDX 連携のスコープと PWDX 側への質問票
- [admin_phase1_implementation.md](./admin_phase1_implementation.md) — Phase 1 詳細（実装済）

---

*このドキュメントは PWDX 側準備が整い次第更新します。各 Phase の着手前に、admin_phase1_implementation.md と同じ詳細度の実装計画書を作成してください。*
