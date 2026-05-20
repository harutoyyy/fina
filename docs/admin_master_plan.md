# 管理者・認証・PWDX 連携 全 Phase マスタープラン

| 項目 | 値 |
|---|---|
| ステータス | **計画ドラフト** |
| 作成日 | 2026-05-20 |
| 全体工数（順次） | 約 50〜60 営業日（10〜12 週） |
| 並列化後の所要 | 約 10 週（4 ヶ月） |
| 関連ドキュメント | [admin_and_auth_design.md](./admin_and_auth_design.md) / [pwdx_integration_plan.md](./pwdx_integration_plan.md) / [admin_phase1_implementation.md](./admin_phase1_implementation.md) |

---

## 0. 全 Phase 一覧

| Phase | 名前 | 規模 | 工数（営業日） | PWDX 側依存 | 主成果物 |
|---|---|---|---|---|---|
| **P1** | スキーマ基盤・register 廃止 | 小〜中 | 5 | なし | DB 拡張、共通権限関数、ロール rename |
| **P2** | 公開申請 + 承認 + セルフリセット | 中 | 8 | なし | 申請フォーム、承認画面、パスリセット |
| **P3** | COMPANY_ADMIN 用ユーザー招待 | 中 | 6 | なし | ユーザー管理画面、招待画面、招待状一覧 |
| **P4** | 監査ログ + 月締め状況 | 小〜中 | 5 | なし | 監査ログ画面、月締めマトリクス |
| **P5** | PWDX 連携設定 UI（設定のみ） | 中 | 5 | なし | PwdxIntegration の管理画面、暗号化保管 |
| **P6** | OIDC プロバイダ統合 | 大 | 8 | **あり** | PWDX ログイン、sub/会社境界チェック |
| **P7** | 公開申請に PWDX 認証選択肢 | 小 | 3 | あり | 申請時の PWDX 認証分岐、pre-fill |
| **P8** | 招待画面に PWDX タイプ追加 | 小〜中 | 4 | あり | sub/user_id 招待、外部 ID 照合 |
| **P9** | PWDX データ同期 | 大 | 12 | あり | 取引先・請求・発注の同期 + 同期履歴 |

### 並列スケジュール（推奨）

```
Sprint 1 (1 週)     : P1 完走
Sprint 2 (2 週)     : P2 + P3 並列
Sprint 3 (1 週)     : P4 + P5 並列
─── ここまでで fina 単体運用が成立 ───
─── PWDX 側 Keycloak Client 登録待ち ───
Sprint 4 (2 週)     : P6
Sprint 5 (1 週)     : P7 + P8 並列
Sprint 6 (3 週)     : P9
                                  Total: 約 10 週
```

### 依存関係グラフ

```
            ┌── P2 (公開申請+承認+セルフリセット)
P1 ─────────┼── P3 (ユーザー招待)
            ├── P4 (監査ログ+月締め)
            └── P5 (PWDX連携設定UI) ──┐
                                       │
                                       ▼
                                   P6 (OIDC統合) ──┬── P7 (申請にPWDX認証)
                                                   ├── P8 (招待にPWDXタイプ)
                                                   └── P9 (データ同期)
```

---

## P1. スキーマ基盤・register 廃止

**詳細**: [admin_phase1_implementation.md](./admin_phase1_implementation.md) 参照。

| 項目 | 内容 |
|---|---|
| ゴール | DB 拡張・共通権限関数・既存ロール rename・公開 register 廃止 |
| 成果物 | UserProfile 拡張、6 つの新規テーブル、`lib/auth-server.ts` 拡張、PermissionTemplate 5 件 |
| 工数 | 5 営業日 |
| 完了 DoD | [admin_phase1_implementation.md §13](./admin_phase1_implementation.md) |

---

## P2. 公開申請 + 承認 + セルフサービスリセット

### ゴール

a 会社が公開フォームから fina の利用申請をし、SUPER_ADMIN が「許可」を押すだけで Company と初期 COMPANY_ADMIN が作られる。同時に LOCAL ユーザーのパスワードリセットがセルフサービスで完結する。

### 成果物

- 公開申請フォーム画面 `/apply`
- SUPER_ADMIN の申請一覧 + 承認画面 `/admin/system/applications`
- 申請承認時の自動作成ロジック（Company / UserProfile 等）
- セルフサービス・パスワードリセット画面 2 種
  - メアド入力 `/auth/forgot-password`
  - 新パスワード設定 `/auth/reset-password`
- メール送信基盤（SMTP / Resend / SES のいずれか）

### タスクリスト

#### コア機能
- [ ] 申請フォーム画面 `/apply` の UI 実装（PWDX なし版のみ）
- [ ] CompanyApplication 作成 server action
- [ ] reCAPTCHA / hCaptcha の統合
- [ ] メール検証メール送信（PENDING → 有効化）
- [ ] 申請一覧画面 `/admin/system/applications` の UI
- [ ] 申請詳細画面（重複チェック警告含む）
- [ ] 申請許可 server action（Company / UserProfile を作成）
- [ ] 申請却下 server action（コメント保存 + 却下通知メール）
- [ ] 30 日経過 PENDING を EXPIRED に更新する cron

#### セルフリセット
- [ ] `/auth/forgot-password` 画面
- [ ] PasswordResetToken 発行 server action（生トークン生成、ハッシュ保存、メール送信）
- [ ] `/auth/reset-password?token=xxx` 画面
- [ ] トークン検証 + パスワード更新 server action（既存セッション無効化含む）
- [ ] パスワードポリシー検証ユーティリティ
- [ ] メアド列挙攻撃対策（応答常時統一）
- [ ] レート制限（同一メアド / 同一 IP）
- [ ] セキュリティ通知メール（変更完了時）

#### メール基盤
- [ ] メール送信プロバイダ選定（Resend 推奨：DX 良 + 価格）
- [ ] テンプレート定義（申請受付 / 承認 / 却下 / パスリセット / 変更完了通知）
- [ ] 環境変数の追加（`RESEND_API_KEY` 等）
- [ ] ローカル開発時のメール表示（MailHog 等）

#### Phase 2 にも組み込む新規テーブル
- なし（Phase 1 の `CompanyApplication` / `PasswordResetToken` を使う）

### 画面リスト

| 画面 | パス | アクセス権 |
|---|---|---|
| 公開申請フォーム | `/apply` | 全公開 |
| 申請完了画面 | `/apply/done` | 全公開 |
| メアド検証完了画面 | `/apply/verify?token=xxx` | 全公開 |
| パスワードリセット要求 | `/auth/forgot-password` | 全公開 |
| パスワードリセット画面 | `/auth/reset-password?token=xxx` | 全公開（トークン必須） |
| 申請一覧 | `/admin/system/applications` | SUPER_ADMIN |
| 申請詳細 | `/admin/system/applications/[id]` | SUPER_ADMIN |

### 依存

- P1（CompanyApplication / PasswordResetToken テーブル）

### 工数: 8 営業日

| 作業 | 工数 |
|---|---|
| メール基盤セットアップ | 1 日 |
| 公開申請フォーム + メアド検証 | 1.5 日 |
| 申請一覧 + 承認画面 | 1.5 日 |
| 承認時の自動作成ロジック | 1 日 |
| セルフリセット 2 画面 + サーバ処理 | 1.5 日 |
| 各種セキュリティ対策（CAPTCHA / レート制限 / 列挙対策） | 1 日 |
| テスト | 0.5 日 |

---

## P3. COMPANY_ADMIN 用ユーザー招待

### ゴール

会社の COMPANY_ADMIN が自社の OPERATOR / VIEWER を招待し、メール経由でログインさせる。LOCAL 招待のみ実装（PWDX 招待は P8）。

### 成果物

- ユーザー管理画面 `/admin/users`
- ユーザー招待画面 `/admin/users/new`
- 招待状一覧画面 `/admin/invitations`
- 招待リンクからのログイン処理
- 管理者代行パスワードリセット

### タスクリスト

#### ユーザー管理
- [ ] ユーザー一覧画面（自社のみ表示、フィルタ・検索）
- [ ] ユーザー詳細編集画面
- [ ] ロール変更（COMPANY_ADMIN は OPERATOR/VIEWER 間のみ可）
- [ ] テンプレート変更（PermissionTemplate のドロップダウン）
- [ ] 無効化 / 再有効化
- [ ] 代行パスワードリセットボタン（COMPANY_ADMIN は自社ユーザーのみ）
- [ ] 最終ログイン日時の表示

#### 招待
- [ ] 招待画面（LOCAL タイプのみ）
- [ ] UserInvitation 作成 server action
- [ ] 初期パスワード自動生成
- [ ] 招待メール送信
- [ ] 招待リンクからのログイン処理（トークン検証）
- [ ] 強制パスワード変更画面（mustChangePassword=true 時）
- [ ] 14 日経過で EXPIRED に更新する cron
- [ ] 招待状一覧画面（自社のみ）
- [ ] 招待再送 / 取消

#### COMPANY_ADMIN 削除ガード
- [ ] 同一会社の COMPANY_ADMIN が 1 名のみの場合、削除・無効化を禁止

### 画面リスト

| 画面 | パス | アクセス権 |
|---|---|---|
| ユーザー一覧 | `/admin/users` | COMPANY_ADMIN+ |
| ユーザー詳細 | `/admin/users/[id]` | COMPANY_ADMIN+ |
| ユーザー招待 | `/admin/users/new` | COMPANY_ADMIN+ |
| 招待状一覧 | `/admin/invitations` | COMPANY_ADMIN+ |
| 招待リンク先 | `/auth/accept?token=xxx` | 招待されたユーザー |
| 強制パス変更 | `/auth/must-change-password` | 該当ユーザー |

### 依存

- P1（UserInvitation / PermissionTemplate テーブル、`requireCompanyAdmin`）
- P2（メール基盤、PasswordResetToken）

### 工数: 6 営業日

| 作業 | 工数 |
|---|---|
| ユーザー一覧 + 詳細 | 1.5 日 |
| 招待画面 + 招待状作成処理 | 1 日 |
| 招待状一覧 + 再送 / 取消 | 1 日 |
| 招待リンクからのログイン + 強制パス変更 | 1 日 |
| 管理者代行リセット | 0.5 日 |
| COMPANY_ADMIN 削除ガード + テスト | 1 日 |

---

## P4. 監査ログ + 月締め状況

### ゴール

誰がいつ何を変更したかを画面で追えるようにし、全社の月締め進捗を一画面で把握できる。

### 成果物

- 監査ログ書き込みのフック実装
- 監査ログ画面 `/admin/audit`
- 月締め状況画面 `/admin/month-close`

### タスクリスト

#### 監査ログ書き込み
- [ ] `AuditLog` 書き込みヘルパー関数（`lib/audit.ts`）
- [ ] 既存重要 server action にフックを追加:
  - [ ] `user.invite` / `user.role_change` / `user.deactivate` / `user.reset_password`
  - [ ] `company.create` (申請許可時) / `company.application_review`
  - [ ] `transaction.confirm` / `transaction.delete`
  - [ ] `month.lock` / `month.unlock`
  - [ ] `password.reset_requested` / `password.reset_completed`
  - [ ] `pwdx.integration_change` / `pwdx.sync_executed`（P5 / P9 で発火）

#### 監査ログ画面
- [ ] 一覧画面（自社のみ。SUPER_ADMIN は横断検索可）
- [ ] フィルタ: 期間 / ユーザー / アクション / 対象タイプ
- [ ] 詳細パネル（payload JSON 整形表示）
- [ ] CSV エクスポート

#### 月締め状況
- [ ] 会社 × 月 のマトリクス画面
- [ ] 「未締」セルクリック → 資金繰り表に遷移
- [ ] 直近 6 ヶ月表示、月切替

### 画面リスト

| 画面 | パス | アクセス権 |
|---|---|---|
| 監査ログ | `/admin/audit` | COMPANY_ADMIN+（SUPER_ADMIN は全社） |
| 月締め状況 | `/admin/month-close` | COMPANY_ADMIN+ |

### 依存

- P1（AuditLog テーブル）
- 既存の月締めロジック

### 工数: 5 営業日

| 作業 | 工数 |
|---|---|
| AuditLog 書き込みヘルパー | 0.5 日 |
| 各 server action へのフック組み込み | 1.5 日 |
| 監査ログ画面 + フィルタ | 1.5 日 |
| 月締め状況画面 | 1 日 |
| CSV エクスポート + テスト | 0.5 日 |

---

## P5. PWDX 連携設定 UI（設定のみ）

### ゴール

会社対会社の PWDX 連携を COMPANY_ADMIN が ON/OFF できる。同期処理は無いが、設定 UI と暗号化保管が完成する。

### 成果物

- PWDX 連携一覧画面 `/admin/pwdx`
- 会社ごとの詳細設定画面
- API キー / Client Secret の暗号化保管
- syncFeatures の ON/OFF UI（実体は P9 まで動かない）

### タスクリスト

#### 暗号化保管基盤
- [ ] KMS 選定（Vercel KV + 自前暗号化 / AWS KMS / GCP KMS のいずれか）
- [ ] 暗号化ユーティリティ実装（`lib/secrets.ts`）
- [ ] `PwdxIntegration.credentialKey` は KMS 参照キーのみ DB に保存
- [ ] 環境変数: `KMS_PROVIDER`, `KMS_KEY_ID` 等

#### 設定 UI
- [ ] 連携一覧画面（自社のみ。連携状況サマリ）
- [ ] 詳細設定画面（PWDX 企業 ID / API URL / API キー入力）
- [ ] API キー入力時の暗号化保存
- [ ] 「キー回転」ボタン（古いキーを失効、新キーを発行）
- [ ] syncFeatures のチェックボックス UI
- [ ] 「今すぐ同期」ボタン（P9 までは何もしない）
- [ ] 「同期履歴」リンク（P9 までは空一覧）

#### 重複チェック
- [ ] 同一 `pwdxCompanyId` が他会社で使われていないかチェック

### 画面リスト

| 画面 | パス | アクセス権 |
|---|---|---|
| PWDX 連携一覧 | `/admin/pwdx` | COMPANY_ADMIN+ |
| PWDX 連携詳細 | `/admin/pwdx/[companyId]` | COMPANY_ADMIN+ |

### 依存

- P1（PwdxIntegration テーブル）
- P3（管理者画面の枠が完成済み）

### 工数: 5 営業日

| 作業 | 工数 |
|---|---|
| KMS 選定 + 暗号化ユーティリティ | 1.5 日 |
| 連携一覧画面 | 1 日 |
| 詳細設定画面 + 保存処理 | 1.5 日 |
| 重複チェック + 監査ログ連動 + テスト | 1 日 |

---

## P5 完了時点で fina 単体運用が成立

ここまでで「申請 → 許可 → ユーザー追加 → 経理運用 → 月締め → 監査」が **PWDX なし** で完全に回ります。**LOCAL ユーザーだけで業務が成立** する状態。

PWDX 側の Keycloak Client 登録が完了次第、P6 以降に進めます。

---

## P6. OIDC プロバイダ統合（PWDX ログイン）

### ゴール

ログイン画面に「PWDX でログイン」ボタンが現れ、Keycloak Realm `pwdx` 経由で認証できる。既存 LOCAL ユーザーとの併存も維持。

### 成果物

- better-auth に OIDC プロバイダ追加
- ログイン画面に「PWDX でログイン」ボタン
- id_token 検証ロジック + sub / pwdx_company_id 取り出し
- 既存ユーザーとの紐付け（UserProfile.externalSub ミラー）

### 事前準備（PWDX 側）

- [ ] **PWDX 側で Keycloak Realm `pwdx` に fina を Client 登録**
- [ ] **Client ID と Client Secret を fina に共有**
- [ ] **Redirect URI を許可リストに追加** (`https://fina-five.vercel.app/api/auth/callback/pwdx`)
- [ ] **必須 Claims を返す設定**: `sub`, `pwdx_company_id`, `pwdx_user_id`, `name`

### タスクリスト

#### OIDC 統合
- [ ] better-auth に `generic-oauth` プラグイン追加（または oidc-provider プラグイン）
- [ ] 環境変数追加: `PWDX_OIDC_CLIENT_ID`, `PWDX_OIDC_CLIENT_SECRET`, `PWDX_OIDC_ISSUER_URL`
- [ ] OIDC discovery エンドポイント検証
- [ ] state / nonce 検証
- [ ] PKCE 対応
- [ ] id_token 検証ロジック（署名、有効期限、audience）
- [ ] Claims 取り出し（sub / pwdx_company_id / pwdx_user_id / name）

#### ログイン UI
- [ ] ログイン画面に「PWDX でログイン」ボタン追加（メアド+パスフォームの上）
- [ ] 認証成立時のリダイレクト処理
- [ ] エラー画面（招待されていない / 失効 / pwdx_company_id 不一致）

#### ユーザー紐付け
- [ ] OIDC 成功時に UserProfile.externalSub にミラー保存
- [ ] 既存 LOCAL ユーザーが OIDC でログインしようとした時の挙動定義
  - 案: メアド一致で「SSO 紐付け確認」画面を出す
- [ ] LOCAL ユーザーの「SSO に切り替え」ツール（既存ユーザーの一括移行用）

### 依存

- P1（UserProfile.externalSub カラム）
- **PWDX 側の Keycloak Client 登録**

### 工数: 8 営業日（うち 2 日は PWDX 側との調整待ち）

| 作業 | 工数 |
|---|---|
| OIDC プラグイン導入 + 設定 | 1.5 日 |
| Keycloak 接続テスト（PWDX 側と調整含む） | 2 日 |
| id_token 検証 + Claims 処理 | 1.5 日 |
| ログイン UI + リダイレクト | 1 日 |
| ユーザー紐付けロジック | 1 日 |
| E2E テスト | 1 日 |

---

## P7. 公開申請に PWDX 認証選択肢

### ゴール

公開申請フォームに「PWDX 認証で続行」ボタンを追加。認証成立で会社情報が pre-fill された申請を作成できる。

### 成果物

- 申請フォームの「PWDX 認証」分岐
- pwdxClaimsSnapshot の保存
- 承認時の PwdxIntegration 自動作成

### タスクリスト

- [ ] 申請フォームに「PWDX を使う」分岐 UI
- [ ] 「PWDX で認証して続行」ボタン
- [ ] OIDC 認証成立後の pre-fill フォーム
- [ ] pwdxClaimsSnapshot の JSON 保存
- [ ] 申請許可時のロジック修正:
  - PwdxIntegration を自動作成（enabled=true）
  - UserProfile.authProvider=PWDX_OIDC として作成
  - UserProfile.externalSub に sub 保存
- [ ] 申請者へのメール文面分岐（PWDX あり / なし）
- [ ] 承認画面の詳細表示に PWDX 情報追加

### 依存

- P2（申請フォーム / 承認画面）
- P6（OIDC 認証）

### 工数: 3 営業日

| 作業 | 工数 |
|---|---|
| 申請フォーム UI 拡張 | 1 日 |
| OIDC 認証経由の pre-fill | 0.5 日 |
| 承認時の PwdxIntegration 自動作成 | 1 日 |
| メール文面分岐 + テスト | 0.5 日 |

---

## P8. 招待画面に PWDX タイプ追加

### ゴール

COMPANY_ADMIN が「この PWDX ユーザーを fina にも招待」ができる。PWDX user_id / sub の手動入力 or PWDX 一覧 API（P9）からの選択。

### 成果物

- 招待画面の「認証タイプ：PWDX」分岐
- PWDX user_id / sub での照合ロジック
- 招待状の externalSub / externalUserId 保存

### タスクリスト

- [ ] 招待画面に「PWDX 連携」ラジオボタン
- [ ] PWDX 会社が連携設定されていない場合は選択不可
- [ ] PWDX user_id / sub の手動入力フィールド
- [ ] UserInvitation 作成時に externalSub / externalUserId 保存
- [ ] OIDC ログイン時の招待状照合ロジック:
  - 1) externalSub == id_token.sub で検索
  - 2) externalUserId == id_token.pwdx_user_id で検索
  - 3) pwdxCompanyId 境界チェック
- [ ] 招待状一覧の表示更新（識別子列を sub/user_id 対応）

### 依存

- P3（招待画面）
- P6（OIDC）

### 工数: 4 営業日

| 作業 | 工数 |
|---|---|
| 招待画面の認証タイプ分岐 | 1 日 |
| PWDX user_id 手動入力 UI | 0.5 日 |
| OIDC ログイン時の照合ロジック | 1.5 日 |
| 招待状一覧の表示更新 | 0.5 日 |
| テスト | 0.5 日 |

---

## P9. PWDX データ同期

### ゴール

PWDX → fina のデータ自動取込が動く。取引先・請求書・発注が日次バッチで同期され、必要なら fina → PWDX のフィードバックもできる。

### 成果物

- PWDX API クライアント
- 同期ジョブの実装（取引先 / 請求 / 発注）
- 同期スケジューラ（cron）
- 同期履歴テーブル（SyncJob / SyncJobLog 新規）
- エラーハンドリング + リトライ
- 入金消込結果の PWDX フィードバック（任意）

### 事前準備（PWDX 側）

- [ ] **PWDX 側の API 仕様確定**（pwdx_integration_plan.md のチェックシートが埋まっている）
- [ ] **API キー / OAuth Client 情報の発行**
- [ ] **サンドボックス環境の確保**

### タスクリスト

#### 同期基盤
- [ ] SyncJob / SyncJobLog テーブル追加
- [ ] PWDX API クライアント (`lib/pwdx-client.ts`)
- [ ] レート制限・リトライ・タイムアウトのハンドリング
- [ ] 同期ジョブ抽象（差分取得・upsert・エラー記録）

#### 同期実装
- [ ] UC-02 取引先マスタ同期（PWDX → fina TradingPartner）
- [ ] UC-01 請求書同期（PWDX → fina Transaction type=SALES）
- [ ] UC-03 発注同期（PWDX → fina Transaction type=COST_PAYMENT）
- [ ] UC-06 入金消込結果フィードバック（fina → PWDX、任意）

#### スケジューラ
- [ ] Vercel Cron / pg_cron / 別 worker のいずれかで日次起動
- [ ] 会社単位 × syncFeatures に従ってジョブ発火
- [ ] Webhook 受信エンドポイント（PWDX → fina の push 通知用、任意）

#### UI
- [ ] 「今すぐ同期」ボタンの実体実装（P5 で枠は完成済）
- [ ] 同期履歴画面（成功・失敗・件数表示）
- [ ] 失敗時の詳細表示 + 再実行ボタン
- [ ] 同期ジョブ実行ログ（AuditLog 連携）

#### 既存 Transaction との整合
- [ ] externalSource="pwdx" + externalRef でユニーク制約
- [ ] PWDX 由来取引の手動編集ガード（要決定）
- [ ] PWDX 側取消時の fina 取引の取消ステータス更新
- [ ] 同一 IDで再同期された時の挙動（上書き / スキップ）

### 画面リスト

| 画面 | パス | アクセス権 |
|---|---|---|
| 同期履歴 | `/admin/pwdx/[companyId]/sync-history` | COMPANY_ADMIN+ |
| 失敗詳細 | `/admin/pwdx/[companyId]/sync-history/[jobId]` | COMPANY_ADMIN+ |

### 依存

- P5（PwdxIntegration 設定 UI）
- P6（OIDC 認証で API キー / OAuth が機能する）
- **PWDX 側 API の確定**

### 工数: 12 営業日

| 作業 | 工数 |
|---|---|
| SyncJob テーブル追加 + 抽象設計 | 1 日 |
| PWDX API クライアント実装 | 2 日 |
| 取引先マスタ同期 | 1.5 日 |
| 請求書同期（売上取込） | 2 日 |
| 発注同期（原価支払取込） | 1.5 日 |
| スケジューラ + cron 設定 | 1 日 |
| 同期履歴画面 + 失敗詳細 | 1 日 |
| 入金消込フィードバック（任意） | 1 日 |
| パイロット運用 + 調整 | 1 日 |

---

## 全体工数まとめ

| Phase | 営業日 |
|---|---|
| P1 | 5 |
| P2 | 8 |
| P3 | 6 |
| P4 | 5 |
| P5 | 5 |
| P6 | 8 |
| P7 | 3 |
| P8 | 4 |
| P9 | 12 |
| **合計（順次）** | **56** |

### 並列化後

| Sprint | 営業日 | 内容 |
|---|---|---|
| Sprint 1 | 5 | P1 |
| Sprint 2 | 8 | P2 + P3 並列（P3 を担当者 B が並行） |
| Sprint 3 | 5 | P4 + P5 並列 |
| **PWDX 待ち** | 0〜10 | PWDX 側 Keycloak 設定 |
| Sprint 4 | 8 | P6 |
| Sprint 5 | 4 | P7 + P8 並列 |
| Sprint 6 | 12 | P9 |
| **合計** | **42 + 待機** | **約 10 週** |

---

## 共通の前提・規約

### 開発スタック

- Next.js 15（App Router）
- Prisma / Supabase Postgres
- better-auth
- TailwindCSS / shadcn/ui
- Vercel デプロイ

### 各 Phase 共通の DoD

1. 既存 E2E テストが全通過
2. 主要シナリオの新規テスト追加
3. staging で本番相当データで動作確認
4. ロールバック手順が用意されている
5. 関連ドキュメントが更新されている（USER_MANUAL.md / admin_and_auth_design.md）
6. AuditLog に該当アクションが記録される（P4 以降）

### コーディング規約

- server action から直接 prisma を叩かず、ドメインロジックは `lib/<domain>.ts` に集約
- 権限チェックは `lib/auth-server.ts` の `requireRole` / `hasPermission` を使う
- メール送信は `lib/mail.ts` のテンプレート関数を経由
- AuditLog 書き込みは `lib/audit.ts` のヘルパーを経由

### 並列開発の前提

- DB マイグレーションは Phase 1 で大半を完了させる（P9 の SyncJob のみ別追加）
- Phase 2〜5 はバックエンド・フロントエンドそれぞれ並列可
- Phase 6 以降は OIDC 統合を中心に直列

---

## 関連ドキュメント

| ドキュメント | 用途 |
|---|---|
| [admin_and_auth_design.md](./admin_and_auth_design.md) | 認証・権限・申請の設計仕様 |
| [admin_phase1_implementation.md](./admin_phase1_implementation.md) | Phase 1 の詳細実装計画 |
| [pwdx_integration_plan.md](./pwdx_integration_plan.md) | PWDX 連携のスコープと PWDX 側への質問票 |
| [USER_MANUAL.md](./USER_MANUAL.md) | エンドユーザー向けマニュアル |
| [db_design.md](./db_design.md) | fina の DB スキーマ |

---

## 次の Phase 計画書の作成

本ドキュメントは各 Phase の概要を整理したマスタープラン。**詳細実装計画書（admin_phase{N}_implementation.md）が必要なフェーズは、着手前に個別に作成** する。

Phase 1 の詳細版を雛形として、各 Phase 着手前に同じ詳細度で書き下ろす想定。

---

*このマスタープランは PWDX 側との合意状況とプロジェクトの優先順位変更に応じて見直しが必要です。*
