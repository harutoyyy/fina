# 経理くん (fina) — 画面別 詳細ドキュメント (Screen Details)

全 28 画面の **UI 構成・入力フォーム項目・ステータス遷移・業務ルール・権限制御・使用 Server Actions・データ連携先 (Prisma モデル)・エラー / 関連画面** を画面別に集約した 1 ファイル版。

> 📌 **docs-ex/ 全体のドキュメント役割分担は [`README.md`](README.md) を参照。**
> - ファイル参照表 → [`page-source-map.md`](page-source-map.md)
> - 横断仕様・業務ルール → [`screen-specification.md`](screen-specification.md)
> - **本書 = 画面ごとの深掘り (フォーム項目・エラー文・行番号参照)**

## 階層

- **H2** = カテゴリ (A. 認証 / B. メイン / C. 入力 / D. 管理 / E. マスタ)
- **H3** = 画面 (例: `### ログイン (`/login`)`)
- **H4** = セクション (概要 / UI 構成 / 入力フォーム項目 / 等)

最終更新: 2026-05-18

---

## 目次


### A. 認証 (2画面)

- [ログイン (`/login`)](#ログイン-login)
- [新規登録 (`/register`)](#新規登録-register)

### B. メイン (4画面)

- [ダッシュボード (`/dashboard`)](#ダッシュボード-dashboard)
- [資金繰り表 (`/cashflow-table`)](#資金繰り表-cashflow-table)
- [グループ別サマリ (`/group-summary`)](#グループ別サマリ-group-summary)
- [資金移動 (`/cashflow`)](#資金移動-cashflow)

### C. 入力 (5画面)

- [経費入力 (`/expenses`)](#経費入力-expenses)
- [売上入力 (`/sales`)](#売上入力-sales)
- [原価支払 (`/costs`)](#原価支払-costs)
- [給与入力 (`/salary`)](#給与入力-salary)
- [グループ間入力 (`/inter-group`)](#グループ間入力-inter-group)

### D. 管理 (6画面)

- [現金引出 (`/cash-withdrawal`)](#現金引出-cash-withdrawal)
- [借入管理 (`/loans`)](#借入管理-loans)
- [リース管理 (`/leases`)](#リース管理-leases)
- [納税予定表 (`/tax-schedule`)](#納税予定表-tax-schedule)
- [カード明細 (`/card-statements`)](#カード明細-card-statements)
- [定期支払 (`/recurring`)](#定期支払-recurring)

### E. マスタ (11画面)

- [会社一覧 (`/master/companies`)](#会社一覧-master-companies)
- [会社グループ (`/master/company-groups`)](#会社グループ-master-company-groups)
- [銀行口座 (`/master/accounts`)](#銀行口座-master-accounts)
- [銀行・支店 (`/master/banks`)](#銀行・支店-master-banks)
- [業種 (`/master/industries`)](#業種-master-industries)
- [売上項目 (`/master/sales-items`)](#売上項目-master-sales-items)
- [取引先 (`/master/partners`)](#取引先-master-partners)
- [給与グループ (`/master/payroll-groups`)](#給与グループ-master-payroll-groups)
- [勘定科目 (`/master/categories`)](#勘定科目-master-categories)
- [控除カテゴリ (`/master/deduction-categories`)](#控除カテゴリ-master-deduction-categories)
- [設定 (`/master/settings`)](#設定-master-settings)

---

## A. 認証 (2画面)


### ログイン (`/login`)

#### 1. 概要

メール + パスワードでログインする画面。Better Auth を経由してセッションを発行する。

- ページ実体: [`app/(auth)/login/page.tsx`](../app/(auth)/login/page.tsx) (97行)
- クライアント: [`lib/auth-client.ts`](../lib/auth-client.ts) (`signIn.email`)
- API: [`app/api/auth/[...all]/route.ts`](../app/api/auth/[...all]/route.ts) (Better Auth ハンドラ)
- サーバー設定: [`lib/auth.ts`](../lib/auth.ts)

#### 2. URL とクエリパラメータ

| URL | 説明 |
|---|---|
| `/login` | ログイン画面 |

`middleware.ts` で未認証アクセス時は自動で `/login` へリダイレクト。

#### 3. 画面構成 (UI 詳細)

##### 3.1 ロゴ + タイトル

- アイコン (`<Landmark />`) + 「経理くん」 (h2 サイズ)
- カードタイトル「ログイン」
- カード説明「アカウント情報を入力してください」

##### 3.2 フォーム

| 項目 | 型 | 説明 |
|---|---|---|
| メールアドレス | email | placeholder=`user@example.com` |
| パスワード | password | (text 入力時はマスク) |
| ログインボタン | submit | ロード中は `<Loader2 />` スピナー表示 |

##### 3.3 エラー表示

- 失敗時: `bg-destructive/10 p-3 text-destructive` のアラート
- メッセージ: `メールアドレスまたはパスワードが正しくありません` / `ログインに失敗しました`

##### 3.4 フッタ

- 「アカウントをお持ちでない方は **新規登録** へ」リンク (`/register`)

#### 4. 認証フロー

```
1. ユーザー入力 → handleSubmit
2. signIn.email({email, password}) を呼び出し (Better Auth)
3. result.error あり → エラーメッセージ表示
4. result.error なし → router.push("/dashboard")
```

セッションは Cookie で発行:
- `better-auth.session_token` (HTTP)
- `__Secure-better-auth.session_token` (HTTPS)

`middleware.ts` がこの 2 つを判定して認証状態を確認。

#### 5. 業務ルール

##### 5.1 セッション保持

- 30 日間保持 (Better Auth 既定)
- 「ログイン状態を保持」チェックを外せば都度ログイン (未実装)

##### 5.2 パスワードリセット

現状はパスワードリセット機能未実装 (DB 側で再設定が必要)。

##### 5.3 自社のみ閲覧

OPERATOR ロールのユーザーは `UserProfile` で自社が割り当てられており、他社は閲覧不可。

#### 6. 権限制御

ログイン画面自体は全ユーザーアクセス可能 (認証前)。ログイン成功後のリダイレクト先 (`/dashboard`) で `UserProfile.role` が判定される:
- ADMIN: 全機能
- OPERATOR: 自社のみ・経費入力中心
- VIEWER: 閲覧のみ

#### 7. 使用 Server Actions

なし (Better Auth API を直接呼び出し)。

#### 8. データ連携先 (Prisma モデル)

| モデル | R | W | 役割 |
|---|---|---|---|
| `User` (Better Auth) | ✅ | — | メール/ハッシュ済パスワード照合 |
| `Session` (Better Auth) | — | ✅ | セッション発行 |
| `AuthAccount` (Better Auth) | ✅ | — | 認証アカウント |
| `UserProfile` | ✅ | — | ロール・所属会社の参照 (ログイン後) |

##### Better Auth テーブルマッピング

| Prisma モデル | DB テーブル |
|---|---|
| `User` | `user` |
| `Session` | `session` |
| `AuthAccount` | `account` |
| `Verification` | `verification` |

Domain の `Account` (銀行口座) と Better Auth の `account` テーブルは別物 (`AuthAccount.modelName="AuthAccount"` で衝突回避)。

#### 9. 関連画面・連携

| 画面 | 連携内容 |
|---|---|
| [`/register`](register.md) | 新規登録 |
| [`/dashboard`](dashboard.md) | 成功時の遷移先 |
| `middleware.ts` | 未認証時の `/login` 強制リダイレクト |

#### 10. 環境変数

| 変数 | 説明 |
|---|---|
| `BETTER_AUTH_SECRET` | セッショントークン生成のシークレット |
| `BETTER_AUTH_URL` | コールバック URL のベース (例: `http://localhost:3003`) |
| `DATABASE_URL` | PostgreSQL 接続 (Supabase pooler) |

### 新規登録 (`/register`)

#### 1. 概要

氏名・メール・パスワードで新規ユーザーを登録する画面。登録完了で自動的にログインしダッシュボードへ遷移する。

- ページ実体: [`app/(auth)/register/page.tsx`](../app/(auth)/register/page.tsx)
- クライアント: [`lib/auth-client.ts`](../lib/auth-client.ts) (`signUp.email`)
- API: [`app/api/auth/[...all]/route.ts`](../app/api/auth/[...all]/route.ts) (Better Auth ハンドラ)

#### 2. URL とクエリパラメータ

| URL | 説明 |
|---|---|
| `/register` | 新規登録画面 |

#### 3. 画面構成 (UI 詳細)

##### 3.1 ロゴ + タイトル

- アイコン (`<Landmark />`) + 「経理くん」
- カードタイトル「新規登録」
- カード説明「アカウントを作成してください」

##### 3.2 フォーム

| 項目 | 型 | 必須 | 説明 |
|---|---|---|---|
| 氏名 | text | ✅ | `name` (User.name) |
| メールアドレス | email | ✅ | `email` |
| パスワード | password | ✅ | 規定の強度バリデーション |
| 登録ボタン | submit | — | ロード中スピナー |

##### 3.3 エラー表示

- 登録失敗時: アラート表示
- パスワード強度不足
- メール重複

##### 3.4 フッタ

- 「既にアカウントをお持ちの方は **ログイン** へ」リンク (`/login`)

#### 4. 認証フロー

```
1. ユーザー入力 → handleSubmit
2. signUp.email({name, email, password}) を呼び出し
3. Better Auth が User + AuthAccount + Session を作成
4. result.error なし → router.push("/dashboard")
```

#### 5. 業務ルール

##### 5.1 自動ログイン

登録完了 → セッション自動発行 → ダッシュボードへ遷移。

##### 5.2 ロール・所属会社の設定

- 登録直後は `UserProfile` 未作成
- 管理者が後から `UserProfile` を作成 (ADMIN/OPERATOR/VIEWER + 所属会社)
- それまでは権限不足で機能制限される

##### 5.3 パスワード強度

Better Auth 既定の強度ルール (大文字・小文字・数字・8 文字以上 等)。

##### 5.4 重複制御

メールアドレスはユニーク。重複登録は不可。

#### 6. 権限制御

新規登録は全ユーザー可能 (認証前の画面)。

> **運用注意**: 本番環境では新規登録を制限したい場合があるため、将来的に管理者承認制への変更が検討される。

#### 7. 使用 Server Actions

なし (Better Auth API を直接呼び出し)。

#### 8. データ連携先 (Prisma モデル)

| モデル | R | W | 役割 |
|---|---|---|---|
| `User` (Better Auth) | — | ✅ | 新規ユーザー作成 (パスワードはハッシュ化) |
| `Session` (Better Auth) | — | ✅ | 自動ログインのセッション発行 |
| `AuthAccount` (Better Auth) | — | ✅ | 認証アカウント作成 |

##### 主な書き込みフィールド

```
User { id (UUID), email (unique), name, emailVerified=false, image=null, createdAt, updatedAt }
AuthAccount { userId, providerId="credential", accountId=email, password (hashed), ... }
Session { userId, expiresAt (now + 30d), token, ipAddress, userAgent }
```

#### 9. 関連画面・連携

| 画面 | 連携内容 |
|---|---|
| [`/login`](login.md) | 通常ログイン |
| [`/dashboard`](dashboard.md) | 成功時の遷移先 |
| `lib/auth.ts` | Better Auth サーバー設定 |

#### 10. 注意事項

- 登録直後はロールが未設定なので、機能が制限される
- 管理者が `UserProfile` を作成して初めて完全に使えるようになる
- 将来的に「管理者承認制」への変更が検討される

## B. メイン (4画面)


### ダッシュボード (`/dashboard`)

#### 1. 概要

ログイン直後に表示される **会社別の概要画面**。選択中会社の KPI・メイン口座残高・直近入出金・経費確定待ち・グループ全体のタイルを 1 画面に集約。書き込みは行わず、純粋な集計表示画面。

- ページ実体: [`app/(dashboard)/dashboard/page.tsx`](../app/(dashboard)/dashboard/page.tsx) (325行)
- 主アクション: [`app/actions/dashboard.ts`](../app/actions/dashboard.ts) + [`app/actions/company-groups.ts`](../app/actions/company-groups.ts)

#### 2. URL とクエリパラメータ

| URL | 説明 |
|---|---|
| `/dashboard` | デフォルト |
| `/` | このページへリダイレクト |

クエリパラメータなし。

#### 3. 画面構成 (UI 詳細)

##### 3.1 ヘッダー

- `<h1>ダッシュボード</h1>` + `${selectedCompany.name} の概要`
- 右上に `<CompanySwitcher />`
- 会社未選択時は `会社を選択してください` を表示

##### 3.2 グループ別サマリカード (PDF P1)

- 月セレクター (`<input type="month">`)
- **全社合計タイル** (背景強調): 全 12 社合算
  - 会社数 / 残高 / 入金 / 出金
- **グループ別タイル** (グリッド): `CompanyGroupMember` から会社を抽出
  - グループ名 / 会社数 / 残高 / 入金 / 出金
  - 所属会社をバッジで最大 4 件 (+N) 表示
  - グループにカラーコードがあれば左ボーダーで色分け
- グループ未登録時は「会社グループが未登録です。マスタ →「会社グループ」から作成してください」と案内

##### 3.3 KPI カード (4枚)

| カード | アイコン | データソース |
|---|---|---|
| 会社 | Building2 | `selectedCompany.name` + `industryType` |
| 口座数 | CreditCard | `data.accountCount` |
| 取引先数 | Handshake | `data.partnerCount` |
| 今月の取引 | FileText | `data.transactionCountThisMonth` |

##### 3.4 残高 + 待機カード (2枚)

| カード | アイコン | データソース |
|---|---|---|
| メイン口座残高 | TrendingUp | `data.mainAccountBalance` + `mainAccountName` |
| 経費確定待ち | Inbox | `data.pendingExpenses` + 合計 `pendingAmount` |

##### 3.5 メイン口座 直近の入出金テーブル

| 列 | 内容 |
|---|---|
| 日付 | `transactionDate` or `scheduledDate` |
| 種別 | Badge (経費/売上/原価/給与/借入/振替) |
| 取引先 | partner.name |
| 摘要 | summary (truncate max-w-48) |
| 金額 | + は緑、− は赤 |
| 残高 | runningBalance |
| 状態 | Badge (下書き/準備完了/確定済) |

##### 3.6 セットアップガイドカード (条件付き)

会社未選択時のみ表示:
```
まずは以下の順序でセットアップしてください:
  1. マスタ管理 → 会社一覧で会社情報を確認
  2. マスタ管理 → 銀行口座で口座を登録
  3. マスタ管理 → 取引先を登録
  4. 各入力画面から取引データを入力
```

#### 4. 主要な集計ロジック

##### 4.1 メイン口座の決定 (`dashboard.ts:55-64`)

1. `Company.mainAccountId` が設定されていれば、それを使う
2. なければ、`Account` の中で `isActive=true` かつ `displayOrder` が最小のものを使う

##### 4.2 経費確定待ち (`pendingAgg`)

```ts
prisma.transaction.aggregate({
  where: { companyId, type: "EXPENSE", status: "READY" },
  _sum: { amount: true },
  _count: { _all: true },
})
```

#### 5. 権限制御

| 操作 | ADMIN | OPERATOR | VIEWER |
|---|---|---|---|
| 表示 | ✅ | ✅ (自社のみ) | ✅ |
| グループ全体タイル | ✅ | ✅ (情報の表示は可) | ✅ |

OPERATOR (経費入力者) はメイン口座残高や全グループの集計を見られないようサーバ側で制御する仕様だが、現状は `selectedCompany` が自社に限定されることでアクセス制御される。

#### 6. 使用 Server Actions

| 関数 | 引数 | 役割 |
|---|---|---|
| `getDashboardData(companyId)` | string | KPI・メイン口座取引・経費確定待ちを 1 ラウンドトリップで集約 |
| `getGroupDashboardSummary({yearMonth})` | { yearMonth } | グループ別タイル + 全社合計タイル |

`getDashboardData()` は `Promise.all` で 5 つのクエリを並列実行: accountCount / partnerCount / transactionCount / company / pendingAgg。

#### 7. データ連携先 (Prisma モデル)

| モデル | R | W | 役割 |
|---|---|---|---|
| `Company` | ✅ | — | mainAccountId・industryType |
| `Account` | ✅ | — | アクティブ口座数・メイン口座 |
| `MonthlyBalance` | ✅ | — | メイン口座の月初残高 |
| `Transaction` | ✅ | — | 今月の件数・直近取引・経費確定待ち集計 |
| `TradingPartner` | ✅ | — | アクティブな取引先数 |
| `CompanyGroup` / `CompanyGroupMember` | ✅ | — | グループ別タイル |

**書き込みなし** (集計表示のみ)。

#### 8. 関連画面・連携

| 画面 | 連携内容 |
|---|---|
| [`/master/companies`](master-companies.md) | メイン口座・industryType の編集元 |
| [`/master/accounts`](master-accounts.md) | 口座の登録 |
| [`/master/partners`](master-partners.md) | 取引先の登録 |
| [`/master/company-groups`](master-company-groups.md) | グループ別タイルの定義元 |
| [`/cashflow-table`](cashflow-table.md) | 直近入出金の詳細画面 |
| [`/expenses`](expenses.md) | 経費確定待ちの解消先 |

#### 9. パフォーマンス

- `getDashboardData()` は **並列5クエリ** で集約 (~ 100ms 想定)
- `getGroupDashboardSummary()` は **グループ数 × 集計** なので、グループが多いと遅延あり
- `data.mainAccountTransactions` は最大 8 件 (基準日の前 3 + 後 5)

### 資金繰り表 (`/cashflow-table`)

#### 1. 概要

会社 × 口座 × 月 単位で取引を時系列に並べる **メイン業務画面**。残高推移の確認・並べ替え・繰延・月締め・通帳照合・帳票作成までを一画面で完結する。「現金主義」ベースで実出納日を基準に処理する。

- ページ実体: [`app/(dashboard)/cashflow-table/page.tsx`](../app/(dashboard)/cashflow-table/page.tsx) (1,588行)
- 主アクション: [`app/actions/cashflow-table.ts`](../app/actions/cashflow-table.ts)
- 帳票生成: [`app/actions/cashflow-reports.ts`](../app/actions/cashflow-reports.ts)
- 照合点: [`app/actions/reconciliation.ts`](../app/actions/reconciliation.ts)

#### 2. URL とクエリパラメータ

| URL | 説明 |
|---|---|
| `/cashflow-table` | デフォルト (今月・主口座) |

クエリパラメータはなし。会社・口座・月はすべて UI のセレクターで切替。

#### 3. 画面構成 (UI 詳細)

##### 3.1 ヘッダー (タイトル + 会社セレクター)

- `<h1>資金繰り表</h1>` + 会社名サブテキスト
- 右上に `<CompanySwitcher />`
- アクションボタン群:
  - **繰り延べ** (選択行があるとき表示, 件数を表示)
  - **月締め** / **月締め解除** (ADMIN・状態により切替)
  - **帳票作成** (選択行があるとき表示)
  - **印刷** (常時)

##### 3.2 表示条件カード

| 項目 | 説明 |
|---|---|
| 口座 | 自社口座 (`isActive=true`) のドロップダウン |
| 月 | `<input type="month">` (デフォルト = 今月) |
| 取引先名フィルタ | 部分一致 |
| ステータス | ALL / DRAFT / READY / CONFIRMED / CANCELLED |
| 取引種別 | ALL / EXPENSE / SALES / COST_PAYMENT / SALARY / LOAN / TRANSFER |

##### 3.3 サマリーカード (5枚)

| カード | 内容 |
|---|---|
| 期首残高 | `MonthlyBalance.openingBalance` を参照 |
| 当月入金合計 | + 値の合計。下に「内 グループ間」を併記 |
| 当月支払合計 | − 値の絶対値合計。下に「内 グループ間」を併記 |
| **予測残高 (月末)** | `openingBalance + Σamount` |
| 会社情報 | 法人番号 / 設立日 / 資本金 を要約表示。クリックで詳細ダイアログ |

##### 3.4 メインテーブル (取引一覧)

列構成 (左から):

| 列 | 内容 | 備考 |
|---|---|---|
| ☑ | 行選択 (繰延・帳票用) | CONFIRMED は選択不可 |
| ⋮⋮ | ドラッグハンドル | `<GripVertical />` |
| 実出納日 | `transactionDate` | YYYY/MM/DD |
| 予定日 | `scheduledDate` | YYYY/MM/DD |
| 種別 | Badge (経費/売上/原価/給与/借入/振替) + **G間** / **未達** バッジ |
| 区分 | 固定 / 変動 / 臨時 |
| ステータス | 下書き / 準備完了 / 確定済 / 取消済 |
| 取引先 | `partner.name` or `temporaryVendorName` |
| 摘要 | `summary` |
| 入金 | `> 0` なら緑色 |
| 支払 | `< 0` なら赤色 (絶対値表示) |
| 差引残高 | runningBalance |
| 差額 | 予定 vs 実績 (`getVariance()`) |
| 操作 | 繰延 / 編集 / 照合点 アイコン |

##### 3.5 ダイアログ

| ダイアログ | 用途 | 表示条件 |
|---|---|---|
| **月締め解除** | 解除理由必須 (ADMIN) | 月締め済かつ「月締め解除」クリック時 |
| **並べ替え日付設定** | DnD 後に挿入位置の日を確定 | ドラッグ完了時 |
| **照合点設定** | 残高入力 + 任意の備考 | 行の照合点アイコンクリック時 |
| **会社情報詳細** | 法人番号・代表者・住所・e-Tax・経理担当者 等 | 会社情報カードクリック時 |
| **帳票プレビュー** | 種別ごとの内容を確認 → 印刷 | 帳票作成ボタンクリック後 |
| **行プレビュー** | クリックした行の詳細表示 | 行クリック時 |

#### 4. ステータス・取引種別の凡例

| 定数 | 値 | 表示 |
|---|---|---|
| Status | `DRAFT` / `READY` / `CONFIRMED` / `CANCELLED` | 下書き / 準備完了 / 確定済 / 取消済 |
| Type | `EXPENSE` / `SALES` / `COST_PAYMENT` / `SALARY` / `LOAN` / `TRANSFER` | 経費 / 売上 / 原価支払 / 給与 / 借入 / 振替 |
| Classification | `FIXED` / `VARIABLE` / `TEMPORARY` | 固定 / 変動 / 臨時 |
| PaymentMethod | `BANK_TRANSFER` / `DIRECT_DEBIT` / `CASH_WITHDRAWAL` | 振込 / 引落 / 現金引出 |

#### 5. 業務ルール

##### 5.1 同日同時ルール (paymentPriority)

同じ日付内の並び順は機械的に固定する。[`cashflow-table.ts:102-118`](../app/actions/cashflow-table.ts#L102) `paymentPriority()` 関数:

1. **優先度 0 (上位)**: `DIRECT_DEBIT` (引落)
2. **優先度 1 (中位)**: `TRANSFER` 種別、`BANK_TRANSFER`、`CASH_WITHDRAWAL` (振込・資金移動・現金)
3. **優先度 2 (下位)**: 上記以外 (= 入金)

##### 5.2 月締めロック

- `MonthClose.isClosed = true` の月は **金額・口座・日付・支払方法・取消** をブロック
- 摘要・科目のみ変更可 (ログに記録)
- 月締め後の編集は監査ログで `UPDATE_AFTER_CLOSE` として残る

##### 5.3 未達判定 (isOverdue)

`status !== "CONFIRMED"` AND `scheduledDate < 今日` AND `(actualAmount === null OR transactionDate === null)`
[`cashflow-table.ts:247-252`](../app/actions/cashflow-table.ts#L247)

→ 行を `opacity-60 italic` で薄色表示 + **未達** バッジ。

##### 5.4 グループ間取引判定 (isInterGroup)

`linkedTransactionId !== null` の取引は左ボーダーが紫 + **G間** バッジ。サマリーの「内 グループ間」内訳に集計される。

##### 5.5 DnD 並べ替え

[`page.tsx:669-741`](../app/(dashboard)/cashflow-table/page.tsx#L669) `handleDragEnd`

- チェック済み行を含めるとブロック移動
- ドロップ完了後、**並べ替え日付設定ダイアログ**で挿入位置の `scheduledDate` (日付) を確定
- 楽観的更新 → DB 同期 → 失敗時はロールバック (`applyOptimisticReorder` / `handleConfirmReorder`)

##### 5.6 繰り延べ (Defer)

- 単行: 行の操作ボタン → 翌月へ
- 複数行: チェックボックスで選択 → ヘッダの「N件を翌月へ繰り延べ」
- 確定済 (`CONFIRMED`) は対象外
- 月締め済の月では実行不可

##### 5.7 帳票作成

[`cashflow-reports.ts`](../app/actions/cashflow-reports.ts) `generateCashFlowReport(companyId, transactionIds[])`

- 選択行は **同一種別** のみ (混在しているとエラー)
- 種別の判定:
  - `FundTransfer` が紐づく → **資金移動帳票** (FUND_TRANSFER)
  - `paymentMethod=BANK_TRANSFER` → **振込依頼書** (BANK_TRANSFER)
  - `paymentMethod=CASH_WITHDRAWAL` → **現金支払帳票** (CASH)
- 帳票本体は `buildReportHtml()` で A4 縦の HTML を別ウィンドウに出力 → `window.print()`

#### 6. 権限制御

| 操作 | ADMIN | OPERATOR | VIEWER |
|---|---|---|---|
| 表示 | ✅ | ✅ | ✅ |
| 並べ替え | ✅ | ✅ | ❌ |
| 繰延 | ✅ | ✅ | ❌ |
| 月締め / 解除 | ✅ | ❌ | ❌ |
| 照合点設定 | ✅ | ✅ | ✅ |
| 帳票作成 | ✅ | ✅ | ✅ |

#### 7. 使用 Server Actions (詳細)

| 関数 | 引数 | 役割 |
|---|---|---|
| `getCashFlowTable(companyId, accountId, yearMonth)` | 3 文字列 | 表本体 (行 + サマリ + 照合点) を返す |
| `getMonthCloseStatus(companyId, yearMonth)` | 同上 | 月締めステータス |
| `closeMonth(companyId, yearMonth)` | 同上 | 月締め実行 (ADMIN チェック) |
| `reopenMonth(companyId, yearMonth, reason)` | + 理由必須 | 月締め解除 (ADMIN + reason) |
| `deferTransaction(transactionId, companyId)` | | 単行繰延 |
| `deferTransactionsBatch(ids[], companyId)` | | 複数行繰延 |
| `reorderTransactions(updates, companyId, accountId, yearMonth, dateUpdates)` | | DnD後の順序+日付更新 |
| `recalculateClosingBalance(companyId, accountId, yearMonth)` | | 月末残高再計算 (内部使用) |
| `getCompanyInfoSummary(companyId)` | | 会社情報カード用 |
| `generateCashFlowReport(companyId, transactionIds[])` | | 帳票生成 |
| `createCheckpoint` / `updateCheckpoint` / `deleteCheckpoint` | | 照合点 CRUD |

#### 8. データ連携先 (Prisma モデル)

| モデル | R | W | 役割 |
|---|---|---|---|
| `Transaction` | ✅ | ✅ | 取引明細 (`displayOrder`, `scheduledDate` を並べ替えで更新) |
| `TransactionDetail` | ✅ | — | 子明細の表示 (科目内訳) |
| `MonthClose` | ✅ | ✅ | 月締めステータス (`isClosed`, `closedAt`, `closedBy`, `reopenedAt`, `reopenedBy`, `reopenReason`) |
| `MonthlyBalance` | ✅ | — | 期首残高の参照 (内部で前月の `closingBalance` から計算) |
| `ReconciliationCheckpoint` | ✅ | ✅ | 通帳照合点 (`verifiedBalance`, `note`) |
| `Company` | ✅ | — | 会社情報カード・帳票ヘッダ |
| `Account` | ✅ | — | 口座セレクター・帳票の自社口座情報 |
| `FundTransfer` | ✅ | — | 帳票生成時の移動先口座特定 |
| `TradingPartnerBankAccount` | ✅ | — | 振込依頼書の振込先口座情報 |
| `AuditLog` | — | ✅ | 月締め / 解除のログ (`operation=MONTH_CLOSE` / `MONTH_REOPEN`) |

##### 主な書き込みフィールド

**月締め (`closeMonth`)**:
```
MonthClose.{ isClosed=true, closedAt=now, closedBy=userId,
            reopenedAt=null, reopenedBy=null, reopenReason=null }
+ AuditLog (operation=MONTH_CLOSE, afterData={companyId, yearMonth})
```

**月締め解除 (`reopenMonth`)**:
```
MonthClose.{ isClosed=false, reopenedAt=now, reopenedBy=userId, reopenReason }
+ AuditLog (operation=MONTH_REOPEN, beforeData/afterData, reason)
```

**並べ替え (`reorderTransactions`)**:
```
Transaction[].{ displayOrder, scheduledDate (移動行のみ) }
```

#### 9. エラー / アラート

| シナリオ | メッセージ |
|---|---|
| 月締め後の金額変更 | `月締め後は金額変更できません` |
| 月締め後の取消 | `月締め後は取消できません` |
| 月締め操作を非ADMIN | `月締め操作は管理者のみ実行できます` |
| 解除理由なし | `Reopen reason is required` |
| 帳票で種別混在 | `選択した取引の種別が混在しています。同じ種別（資金移動 / 振込 / 現金）の行のみ選択してください。` |
| 帳票印刷でポップアップブロック | `ポップアップがブロックされました。許可してください。` |

#### 10. 関連画面・連携

| 画面 | 連携内容 |
|---|---|
| [`/expenses`](expenses.md) | 行ダブルクリック → `?edit=<txId>` で編集ダイアログを開く |
| [`/sales`](sales.md) | 同上 (売上行) |
| [`/costs`](costs.md) | 同上 (原価行) |
| [`/salary`](salary.md) | 同上 (給与行) |
| [`/loans`](loans.md) | 同上 (借入行) |
| [`/cashflow`](cashflow.md) | TRANSFER 行の発生源 |
| [`/inter-group`](inter-group.md) | G間 行の発生源 |
| [`/recurring`](recurring.md) | 定期テンプレ由来の取引が混在 |
| [`/master/companies`](master-companies.md) | 会社情報カードの編集元 |
| [`/master/accounts`](master-accounts.md) | 口座マスタ |

#### 11. 注意事項

- 月締め後の取引は **金額・口座・日付・支払方法・取消** がブロックされる。摘要・科目のみ変更可能。
- DnD 並べ替え時に「日付設定ダイアログ」をキャンセルすると、楽観的更新がロールバックされる。
- 帳票作成は **連続選択した同一種別** のみ。混在時は明確なエラーメッセージで拒否。
- 通帳照合点を設定すると、その時点での残高がチェックポイントとして残り、後で通帳との突合に使える。

### グループ別サマリ (`/group-summary`)

#### 1. 概要

会社グループ単位の残高・入金・出金タイルを並べて、グループ別の資金状況を一覧する画面。ダッシュボードの「グループ別サマリ」カードと同じデータを画面いっぱいで表示する。

- ページ実体: [`app/(dashboard)/group-summary/page.tsx`](../app/(dashboard)/group-summary/page.tsx) (150行 — シンプル)
- 主アクション: [`app/actions/company-groups.ts`](../app/actions/company-groups.ts) `getGroupDashboardSummary`

> 現状サイドメニューには表示されておらず、URL `/group-summary` で直接アクセスする運用 (将来再導入の候補)。ダッシュボードに同じカードが埋め込まれている。

#### 2. URL とクエリパラメータ

| URL | 説明 |
|---|---|
| `/group-summary` | デフォルト = 今月 |

クエリパラメータはなし。月は UI で切替。

#### 3. 画面構成 (UI 詳細)

##### 3.1 ヘッダー

- タイトル「グループ別サマリ」
- 月セレクター (`<input type="month">`)

##### 3.2 全社合計タイル (1枚)

| 項目 | 値 |
|---|---|
| 会社数 | `allCompaniesTile.companyCount` |
| 残高 | `allCompaniesTile.balance` (formatYen) |
| 入金 | `allCompaniesTile.income` |
| 出金 | `allCompaniesTile.expense` |

背景: `bg-primary/5` で全社合計を強調。

##### 3.3 グループ別タイル (グリッド)

各グループタイルに表示:

| 項目 | 値 |
|---|---|
| グループ名 | `tile.name` |
| 会社数 | `tile.companyCount` |
| 残高 | `tile.balance` |
| 入金 | `tile.income` |
| 出金 | `tile.expense` |
| 所属会社 | バッジ (最大 4 件 + `+N`) |

`tile.colorCode` があれば左ボーダーで色分け:
```css
{ borderLeftWidth: 4, borderLeftColor: tile.colorCode }
```

##### 3.4 グループ未登録時

```
会社グループが未登録です。マスタ →「会社グループ」から作成してください。
```

#### 4. 集計ロジック

[`company-groups.ts`](../app/actions/company-groups.ts) `getGroupDashboardSummary`:

1. すべての `CompanyGroup` を取得
2. 各グループの `CompanyGroupMember` から会社 ID を抽出
3. 対象月の `Transaction` で income/expense を集計
4. `MonthlyBalance` で残高を取得 (該当月)
5. **全社合計タイル** は全会社の合計
6. **グループタイル** はそれぞれのメンバー合計

#### 5. 権限制御

| 操作 | ADMIN | OPERATOR | VIEWER |
|---|---|---|---|
| 表示 | ✅ | ✅ | ✅ |

OPERATOR (経費入力者) は自社のみ閲覧の制約があるため、本画面は管理者・閲覧者向け。

#### 6. 使用 Server Actions

| 関数 | 引数 | 役割 |
|---|---|---|
| `getGroupDashboardSummary({yearMonth})` | { yearMonth: "YYYY-MM" } | 全社合計タイル + グループ別タイル |

#### 7. データ連携先 (Prisma モデル)

| モデル | R | W | 役割 |
|---|---|---|---|
| `CompanyGroup` | ✅ | — | グループ定義 |
| `CompanyGroupMember` | ✅ | — | グループ ↔ 会社の中間テーブル |
| `Company` | ✅ | — | 会社名・略称 |
| `MonthlyBalance` | ✅ | — | 残高集計 |
| `Transaction` | ✅ | — | 入金・出金集計 |

書き込みなし。

#### 8. 関連画面・連携

| 画面 | 連携内容 |
|---|---|
| [`/dashboard`](dashboard.md) | 同じタイルがダッシュボード上にも表示される (上部カード) |
| [`/master/company-groups`](master-company-groups.md) | グループ定義の編集元 |
| [`/master/companies`](master-companies.md) | 会社マスタ |

#### 9. 注意事項

- サイドバーには表示されないため、URL 直接アクセスが必要
- ダッシュボードに同じカードがあるので、本画面は実用上ほぼ重複機能
- 将来的にダッシュボードとマージするか、本画面を削除する判断が必要

### 資金移動 (`/cashflow`)

#### 1. 概要

会社間・同社内の **資金移動 (振替)** を入力する画面。振替元口座を減・振替先口座を増として、両方の資金繰り表に対称的に反映される。

- ページ実体: [`app/(dashboard)/cashflow/page.tsx`](../app/(dashboard)/cashflow/page.tsx) (398行)
- 主アクション: [`app/actions/fund-transfers.ts`](../app/actions/fund-transfers.ts)

#### 2. URL とクエリパラメータ

| URL | 説明 |
|---|---|
| `/cashflow` | デフォルト |

#### 3. 画面構成 (UI 詳細)

##### 3.1 ヘッダー

- タイトル「資金移動」 + 会社名
- 右上に `<CompanySwitcher />`
- 「+ 新規資金移動」ボタン

##### 3.2 フィルタ

| 項目 | 説明 |
|---|---|
| 月 | `<input type="month">` |

##### 3.3 資金移動一覧テーブル

| 列 | 内容 |
|---|---|
| 予定日 | `scheduledDate` |
| 実出納日 | `transactionDate` |
| 振替元会社 | `sourceCompany.name` |
| 振替元口座 | `sourceAccount` (銀行+支店+口座番号) |
| 振替先会社 | `destinationCompany.name` |
| 振替先口座 | `destinationAccount` |
| 金額 | 振替金額 |
| 摘要 | summary |
| ステータス | DRAFT/READY/CONFIRMED |
| 操作 | 編集 / 削除 |

##### 3.4 ダイアログ

| ダイアログ | 用途 |
|---|---|
| 資金移動フォーム | 新規 / 編集 |

#### 4. 入力フォーム項目

| 項目 | 型 | 必須 | 説明 |
|---|---|---|---|
| 振替元会社 | select | ✅ | 自社 (selectedCompany) で固定 |
| 振替元口座 | select | ✅ | 自社の口座 |
| 振替先会社 | select | ✅ | 自社 (同社内) or 他社 |
| 振替先口座 | select | ✅ | 振替先会社の口座 |
| 金額 | number | ✅ | 正値 |
| 予定日 | date | ✅ | `scheduledDate` |
| 実出納日 | date | △ | `transactionDate` |
| 計上月 | month | ✅ | `accountingMonth` |
| 摘要 | text | — | |

#### 5. 業務ルール

##### 5.1 会社間資金移動 vs 同社内資金移動

| 種別 | 説明 | 連携 |
|---|---|---|
| **会社間** | 自社 → 別会社へ送金 | 相手会社側にも対応取引を自動生成。両会社で承認が必要 |
| **同社内** | 自社の口座 A → 口座 B | 1 つの `FundTransfer` で両口座に反映 (`type=TRANSFER`) |

##### 5.2 ペア取引の連動

`FundTransfer` 1 レコードに対して、`Transaction` 2 レコード (出金 + 入金) が紐づく:

```
FundTransfer {
  sourceAccountId, destinationAccountId,
  amount, scheduledDate, ...,
  outgoingTransactionId, incomingTransactionId
}
Transaction (出金) { type=TRANSFER, amount=-X, accountId=source }
Transaction (入金) { type=TRANSFER, amount=+X, accountId=destination }
```

削除すると、両方の Transaction が連動削除される。

##### 5.3 月締めロック

月締め済の月には新規作成・編集・削除は不可。

#### 6. 権限制御

| 操作 | ADMIN | OPERATOR | VIEWER |
|---|---|---|---|
| 表示 | ✅ | ✅ | ✅ |
| 新規 | ✅ | ✅ | ❌ |
| 編集 | ✅ | ✅ | ❌ |
| 削除 | ✅ | ❌ (DRAFT 自分のみ) | ❌ |

#### 7. 使用 Server Actions

| 関数 | 引数 | 役割 |
|---|---|---|
| `getFundTransfers(companyId, month?)` | | 一覧取得 |
| `createFundTransfer({sourceCompanyId, sourceAccountId, destCompanyId, destAccountId, amount, scheduledDate, ...})` | | 新規 (ペア取引を同時生成) |
| `deleteFundTransfer(transactionId, companyId)` | | 削除 (両ペアを連動削除) |
| `getAccounts(companyId)` | | 口座選択 |
| `getCompanies()` | | 振替先会社選択 |

#### 8. データ連携先 (Prisma モデル)

| モデル | R | W | 役割 |
|---|---|---|---|
| `FundTransfer` | ✅ | ✅ | 振替の親レコード |
| `Transaction` | ✅ | ✅ | 振替元・先のペア取引 (`type=TRANSFER`) |
| `Company` | ✅ | — | 振替先会社選択 |
| `Account` | ✅ | — | 口座マスタ |
| `MonthClose` | ✅ | — | 月締めチェック |

##### 主な書き込みフィールド

```
FundTransfer {
  companyId (元会社),
  sourceAccountId, destinationCompanyId, destinationAccountId,
  amount, scheduledDate, accountingMonth,
  status=DRAFT
}
Transaction[] {
  // 出金
  { type=TRANSFER, companyId=元, accountId=元口座, amount=-X, scheduledDate, fundTransferId },
  // 入金
  { type=TRANSFER, companyId=先, accountId=先口座, amount=+X, scheduledDate, fundTransferId }
}
```

#### 9. エラー / アラート

| シナリオ | メッセージ |
|---|---|
| 同口座を振替元・先に指定 | `振替元と振替先が同じ口座です` |
| 月締め後の編集 | `月締め後は変更できません` |

#### 10. 関連画面・連携

| 画面 | 連携内容 |
|---|---|
| [`/cashflow-table`](cashflow-table.md) | 生成された振替取引が反映 (`type=TRANSFER`) |
| [`/inter-group`](inter-group.md) | グループ間の貸付/配当等 (会計仕訳寄り) はこちら |
| [`/expenses`](expenses.md) | 経費入力時の「原資の資金移動を作成する」オプションも `FundTransfer` を発生させる |
| [`/master/accounts`](master-accounts.md) | 口座マスタ |

## C. 入力 (5画面)


### 経費入力 (`/expenses`)

#### 1. 概要

経費取引の登録・編集を行う **4 タブ構成** の画面 (固定 / 変動 / 臨時 / 受領BOX)。請求書受領 → 入力 → 確認 → 確定 までを 1 画面で完結する。

- ページ実体: [`app/(dashboard)/expenses/page.tsx`](../app/(dashboard)/expenses/page.tsx) (1,126行)
- 旧 `/expense-box` は本ページの **受領BOX タブ** に統合済 ([`expense-box/page.tsx`](../app/(dashboard)/expense-box/page.tsx) は redirect stub)

#### 2. URL とクエリパラメータ

| URL | 説明 |
|---|---|
| `/expenses` | デフォルト = 「臨時」タブ |
| `/expenses?tab=FIXED` | 固定タブ |
| `/expenses?tab=VARIABLE` | 変動タブ |
| `/expenses?tab=TEMPORARY` | 臨時タブ |
| `/expenses?tab=RECEIVED` | 受領BOX タブ |
| `/expenses?edit=<txId>` | 該当取引を編集ダイアログで開く (資金繰り表からの遷移) |

#### 3. 画面構成 (UI 詳細)

##### 3.1 タブ

| タブ | キー | 内容 |
|---|---|---|
| 固定 | `FIXED` | `RecurringTemplate (frequency=*)` から自動生成された取引 |
| 変動 | `VARIABLE` | 同上 (金額タイプ「変動」) |
| 臨時 | `TEMPORARY` | 単発入力。**経費一覧** (3 サブタブ DRAFT/READY/CONFIRMED) |
| 受領BOX | `RECEIVED` | 処理待ち請求書だけを集めた作業ボックス |

##### 3.2 臨時タブ (経費一覧)

ヘッダー:
- タイトル「経費一覧」
- 月セレクター + 「口座は混在」表記
- **「+ 新規経費」** ボタン

サブタブ (3 ステータス):
| サブタブ | キー (status) | 内容 |
|---|---|---|
| 未確定 | `DRAFT` | 入力途中・確認待ち |
| 確認待ち | `READY` | 入力完了済・確定待ち |
| 完了 | `CONFIRMED` | 月締めで確定 |

テーブル列:
| 列 | 内容 | 表示条件 |
|---|---|---|
| ☑ | 一括選択 | 未確定タブのみ |
| フラグ | 繰返登録済 / 前月数値 / 未入力有 のバッジ | |
| 予定日付 | `scheduledDate` 昇順 ↓ | |
| 相手先 | `partner.name` or `temporaryVendorName` | |
| 内容 | `summary` (30文字想定) | |
| 金額 | 右寄せ・カンマ区切り | |
| 帳票 | 有 / 不要 / 無 のバッジ | |
| 操作 | 📎証憑 / ✏️編集 / ✅準備完了 / 🗑️削除 | |

##### 3.3 受領BOX タブ

- `ExpenseInboxTab` 相当のロジックを `expenses/page.tsx` 内に内包
- **「+ 新規請求書を追加」**ボタンで「臨時タブ」の入力フォームを開く (受領モード)
- 列は 臨時タブと同じ + 受領日 / 添付フラグを強調

##### 3.4 ダイアログ

| ダイアログ | 用途 |
|---|---|
| 臨時経費フォーム (新規/編集) | 1 取引の入力 |
| 証憑添付パネル (`EvidencePanel`) | PDF アップロード |
| 仮取引先 → 正規化 | 仮入力した取引先名をマスタに紐付け |

#### 4. 入力フォーム項目 (臨時経費)

| 項目 | 型 | 必須 | 説明 |
|---|---|---|---|
| 口座 | select | ✅ | 自社口座 (active のみ) |
| 取引先 | select / 仮入力 | △ | マスタから or 仮取引先名 (`temporaryVendorName`) |
| 実出納日 | date | △ | 入金/出金が起きた日 |
| 予定日 | date | △ | スケジュール日 |
| 計上月 | month | ✅ | `accountingMonth` (YYYY-MM) |
| 支払方法 | select | △ | 振込 / 引落 / 現金 |
| 金額 | number | ✅ | 正の値 (DB 上は支出= 負) |
| 中項目 | select | △ | 勘定科目 (確定時必須) |
| 小項目 | select | — | 中項目に応じて候補表示 |
| 摘要 | text | — | 内容説明 |
| 振込先情報 (振込時) | bank/branch/...   | — | コード・名義 (Row 5) |
| 同社内資金移動オプション | checkbox | — | 「原資の資金移動を作成する」 |

#### 5. ステータス遷移

```
DRAFT (下書き) ──[準備完了ボタン]──> READY (確認待ち) ──[管理者の確定]──> CONFIRMED (確定済)
       ↑                                                                          │
       └─────────────────[月締め解除でロールバック可能]──────────────────┘
```

準備完了の必須要件 (経費入力者):
- 金額
- 取引先 (または `evidenceNotRequired=true`)
- 証憑添付 (または不要フラグ)

確定の必須要件 (ADMIN):
- 中項目（勘定科目）必須

#### 6. フラグ判定ロジック

[`expenses/page.tsx:137-170`](../app/(dashboard)/expenses/page.tsx#L137) `hasMissingRequiredFields()`:

| フラグ | 条件 |
|---|---|
| **繰返登録済** | `tx.recurringTemplateId !== null` |
| **前月数値** | 繰返登録済 + 前月にも同じ `recurringTemplateId` 取引が存在 |
| **未入力有** | 実日付 / 予定日 / 種別 / 金額 / 口座 / 相手先 のいずれか欠落 (OPERATOR でない場合は科目も対象)。`summary` のみ任意 |

#### 7. 業務ルール

##### 7.1 月締めロック

`monthClosed=true` の月では:
- 金額・口座・日付・支払方法・取消 をブロック
- 摘要・科目のみ変更可能
- ダイアログタイトルに「(月締め中：摘要・科目のみ変更可)」を表示
- 編集時は `disabled={editingId !== null && monthClosed}` を各フォーム要素に適用

##### 7.2 同社内資金移動の自動生成

[`expenses/page.tsx:174-175`](../app/(dashboard)/expenses/page.tsx#L174)

`tempForm.accountId` が **メイン口座以外** で「原資の資金移動を作成する」をチェック:
- メイン口座 (A) → 支払口座 (B) への `FundTransfer` を自動生成
- A 口座には資金移動 1 本、B 口座には実際の支払明細を表示

##### 7.3 仮取引先の正規化

- 入力時にマスタにない取引先名を `temporaryVendorName` として保存可能
- 後日「正規化」ボタンで既存マスタへ紐付け、または新規取引先作成
- `normalizePartner()` action が処理

#### 8. 権限制御

| 操作 | ADMIN | OPERATOR | VIEWER |
|---|---|---|---|
| 表示 | ✅ | ✅ (自社のみ) | ✅ |
| 新規入力 | ✅ | ✅ | ❌ |
| 編集 (DRAFT/READY) | ✅ | ✅ | ❌ |
| 準備完了 → READY | ✅ | ✅ | ❌ |
| 確定 → CONFIRMED | ✅ | ❌ | ❌ |
| 削除 | ✅ | ✅ (DRAFT のみ) | ❌ |
| 月締め後の科目変更 | ✅ | ❌ | ❌ |

OPERATOR (経費入力者) は **口座残高・他取引閲覧不可** で、代替として受領BOX タブが提供される。

#### 9. 使用 Server Actions (詳細)

| 関数 | 役割 |
|---|---|
| `getTransactions(companyId, type, month?, status?)` | 経費一覧取得 (ページング付き) |
| `createTransaction(data)` | 新規経費の作成 |
| `updateTransaction(id, data)` | 既存経費の更新 (月締め後は限定的) |
| `updateTransactionStatus(id, status, companyId)` | DRAFT → READY → CONFIRMED の遷移 |
| `deleteTransaction(id, companyId)` | 削除 (月締め後は取消不可) |
| `upsertTransactionDetails(id, details)` | 子明細 (内訳) の一括更新 |
| `normalizePartner(transactionId, partnerId)` | 仮取引先 → マスタへ紐付け |
| `setEvidenceNotRequired(id, companyId, value)` | 証憑不要フラグの切替 |
| `getExpenseBoxItems(companyId, month)` | 受領BOX 用の絞り込み取得 (user-profile.ts) |
| `getCurrentUserProfile()` | ロール判定 (ADMIN/OPERATOR/VIEWER) |
| `checkMonthClosed(companyId, yearMonth)` | 月締めチェック |
| `createFundTransfer(data)` | 同社内資金移動の自動生成 |

#### 10. データ連携先 (Prisma モデル)

| モデル | R | W | 役割 |
|---|---|---|---|
| `Transaction` | ✅ | ✅ | 経費取引本体 (`type=EXPENSE`) |
| `TransactionDetail` | ✅ | ✅ | 親子取引の子明細 (内訳・控除) |
| `Evidence` | ✅ | ✅ | 証憑PDFの添付 (S3保存) |
| `RecurringTemplate` | ✅ | — | フラグ「繰返登録済」「前月数値」判定 |
| `TradingPartner` | ✅ | — | 取引先選択 |
| `TradingPartnerBankAccount` | ✅ | — | 振込先口座の自動補完 |
| `TemporaryBankAccount` | ✅ | ✅ | 仮の振込先口座 (取引固有) |
| `AccountCategoryMid` / `AccountCategorySub` | ✅ | — | 科目選択 |
| `Account` | ✅ | — | 口座選択 |
| `MonthClose` | ✅ | — | 月締めチェック |
| `UserProfile` | ✅ | — | OPERATOR / ADMIN 判定 |
| `FundTransfer` | — | ✅ | 同社内資金移動の生成 |
| `AuditLog` | — | ✅ | 月締め後の変更ログ (`UPDATE_AFTER_CLOSE`) |

##### 主な書き込みフィールド

**新規経費 (`createTransaction`)**:
```
Transaction { type=EXPENSE, companyId, accountId, partnerId?, temporaryVendorName?,
              transactionDate, scheduledDate, accountingMonth, amount (負値),
              paymentMethod, summary, classification, status=DRAFT }
TransactionDetail[] { transactionId, midId, subId?, amount, summary? }
```

**月締め後の編集**:
- 金額・口座等の更新を試行 → `Error("月締め後は金額変更できません")` を投げる
- 摘要・科目のみ更新 + `AuditLog.operation=UPDATE_AFTER_CLOSE` を記録

#### 11. エラー / アラート

| シナリオ | メッセージ |
|---|---|
| 月締め後の金額変更 | `月締め後は金額変更できません` |
| 月締め後の取消 | `月締め後は取消できません` |
| 削除 → ADMIN以外で確定済 | `Only ADMIN can delete confirmed transactions` |
| 中項目なしで確定試行 | `中項目（勘定科目）は確定時必須です` |

#### 12. 関連画面・連携

| 画面 | 連携内容 |
|---|---|
| [`/cashflow-table`](cashflow-table.md) | 入力された経費がそのまま反映。ダブルクリックで `?edit=<id>` 戻り |
| [`/recurring`](recurring.md) | 固定・変動タブの自動生成元 (`RecurringTemplate`) |
| [`/master/categories`](master-categories.md) | 勘定科目マスタ |
| [`/master/partners`](master-partners.md) | 取引先マスタ + 振込先口座 |
| [`/master/accounts`](master-accounts.md) | 自社口座マスタ |
| [`/master/deduction-categories`](master-deduction-categories.md) | 控除カテゴリ |

### 売上入力 (`/sales`)

#### 1. 概要

売上請求と入金消込を **親子構造 (請求/入金/控除)** で管理する画面。請求 → 分割入金 → 控除内訳 を一覧形式で入力でき、確定は 2 段階。

- ページ実体: [`app/(dashboard)/sales/page.tsx`](../app/(dashboard)/sales/page.tsx) (682行)

#### 2. URL とクエリパラメータ

| URL | 説明 |
|---|---|
| `/sales` | デフォルト |
| `/sales?edit=<txId>` | 該当取引を編集ダイアログで開く (資金繰り表からの遷移) |

#### 3. 画面構成 (UI 詳細)

##### 3.1 ヘッダー

- タイトル「売上入力」 + 会社名
- 右上に `<CompanySwitcher />` と `<TransactionExcelImport />` (Excel 取込)
- 「+ 新規請求」ボタン

##### 3.2 フィルタ

| 項目 | 説明 |
|---|---|
| 月 | `<input type="month">` → `accountingMonth` 単位 |
| ステータス | ALL / DRAFT / READY / CONFIRMED / CANCELLED |

##### 3.3 取引一覧テーブル

| 列 | 内容 |
|---|---|
| 展開 | クリックで子 (入金行) を表示 |
| 請求日 | `invoiceDate` |
| 入金予定日 | `scheduledDate` |
| 取引先 | `partner.name` (種別=`CUSTOMER` or `BOTH`) |
| 請求金額 | 親の `amount` |
| 入金合計 | 子取引 (入金) の合計 |
| 残額 | 請求 − 入金合計 |
| 控除合計 | 控除明細の合計 |
| 差額 | 残額 − 控除合計 (整合チェック) |
| ステータス | 下書き/準備完了/確定済 |
| 操作 | 入金追加 / 控除入力 / 編集 / 削除 |

##### 3.4 ダイアログ

| ダイアログ | 用途 |
|---|---|
| 請求作成 (`invoiceDialogOpen`) | 親 (請求) の入力 |
| 入金追加 (`paymentDialogOpen`) | 子 (入金) を親に追加 |
| 編集 (`editDialogOpen`) | 既存の請求 or 入金を編集 |
| 控除内訳パネル (`DeductionDetailsPanel`) | 控除カテゴリの一覧を縦展開で複数行入力 |

#### 4. 入力フォーム項目

##### 4.1 請求 (親)

| 項目 | 型 | 必須 | 説明 |
|---|---|---|---|
| 口座 | select | ✅ | 入金口座 |
| 取引先 | select | ✅ | 種別=CUSTOMER/BOTH のみ |
| 請求日 | date | △ | `invoiceDate` |
| 入金予定日 | date | △ | `scheduledDate` |
| 計上月 | month | ✅ | `accountingMonth` |
| 金額 | number | ✅ | 請求金額 (+ 正値) |
| 中項目 | select | △ | 売上科目 (確定時必須) |
| 小項目 | select | — | 任意 |
| 摘要 | text | — | 内容 |

##### 4.2 入金 (子)

| 項目 | 型 | 必須 | 説明 |
|---|---|---|---|
| 入金口座 | select | ✅ | 親から自動コピー |
| 実入金日 | date | ✅ | `transactionDate` |
| 入金金額 | number | ✅ | 分割可 |
| 摘要 | text | — | |

##### 4.3 控除内訳

控除カテゴリは `deduction-categories.ts` から `scope=SALES` を取得:
- 振込手数料 / 現場経費 / 立替金 / 値引値上 (符号扱える) / 前倒し入金 (発生/相殺) / 保留金 (発生/相殺)
- カテゴリ × 金額 × 任意の摘要 を複数行入力可能

#### 5. ステータス遷移 (2 段階)

```
DRAFT (下書き)
  │
  ├──[① 請求確定]──> READY (請求確定済・入金待ち)
  │   (入力者可、確定日時・確定者を記録。解除は ADMIN のみ)
  │
  └──[② 入金・控除確定]──> CONFIRMED (確定済)
      (ADMIN のみ。全額入金完了 + 差額=控除合計 が必須)
```

確定不可条件 (CONFIRMED 不可):
- 分割入金中 (残額 > 0)
- 差額 ≠ 控除合計 (許容差額なし = 0 円一致)

#### 6. 業務ルール

##### 6.1 整合チェック (アラート)

`差額 (請求 − 実入金合計) ≠ 控除合計`:
- 全額入金完了前 → 警告 (準備完了は可)
- 全額入金完了後 → エラー (確定不可)

##### 6.2 月締めロック

`monthClosed=true` の月では金額変更不可、摘要のみ編集可能。

##### 6.3 控除の自動仕訳

控除カテゴリには **デフォルト科目 (中/小)** が設定されている。控除入力時に対応カテゴリへ自動振替する子取引を生成する想定 (PDF 要件)。

#### 7. 権限制御

| 操作 | ADMIN | OPERATOR | VIEWER |
|---|---|---|---|
| 表示 | ✅ | ✅ | ✅ |
| 請求作成 | ✅ | ✅ | ❌ |
| 入金追加 | ✅ | ✅ | ❌ |
| 控除入力 | ✅ | ✅ | ❌ |
| 請求確定 → READY | ✅ | ✅ | ❌ |
| 入金・控除確定 → CONFIRMED | ✅ | ❌ | ❌ |
| 確定解除 (READY/CONFIRMED → DRAFT) | ✅ | ❌ | ❌ |

#### 8. 使用 Server Actions (詳細)

| 関数 | 役割 |
|---|---|
| `getTransactions(companyId, "SALES", month?, status?)` | 売上一覧取得 |
| `createTransaction({type: "SALES", ...})` | 親 (請求) or 子 (入金) を作成 |
| `updateTransaction(id, data)` | 既存取引の更新 |
| `updateTransactionStatus(id, status, companyId)` | ステータス遷移 |
| `deleteTransaction(id, companyId)` | 削除 |
| `upsertTransactionDetails(transactionId, details[])` | 控除明細の一括更新 |
| `getDeductionDetailsForTransaction(transactionId)` | 控除内訳取得 |
| `getDeductionCategories("SALES")` | 控除カテゴリ取得 |
| `checkMonthClosed(companyId, yearMonth)` | 月締めチェック |

#### 9. データ連携先 (Prisma モデル)

| モデル | R | W | 役割 |
|---|---|---|---|
| `Transaction` | ✅ | ✅ | 親 (請求) + 子 (入金) ペア |
| `TransactionDetail` | ✅ | ✅ | 入金明細・控除明細 |
| `DeductionCategory` | ✅ | — | 売上用控除カテゴリ (`scope=SALES`) |
| `TradingPartner` | ✅ | — | 顧客選択 |
| `Account` | ✅ | — | 入金口座 |
| `AccountCategoryMid` / `AccountCategorySub` | ✅ | — | 売上科目選択 |
| `MonthClose` | ✅ | — | 月締めチェック |

##### 主な書き込みフィールド

**請求作成**:
```
Transaction { type=SALES, parentId=null, amount (正値), invoiceDate,
              scheduledDate, accountingMonth, status=DRAFT }
TransactionDetail[] { midId, subId?, amount, summary? }
```

**入金追加**:
```
Transaction { type=SALES, parentId=<請求のid>, amount (正値),
              transactionDate (実入金日), accountId, status=DRAFT }
```

**控除入力 (`upsertTransactionDetails`)**:
```
TransactionDetail[] { transactionId=<請求のid>, deductionCategoryId,
                      midId (controlカテゴリのデフォルト), amount, summary? }
```

#### 10. エラー / アラート

| シナリオ | メッセージ |
|---|---|
| 月締め後の金額変更 | `月締め後は金額変更できません` |
| 全額入金完了後の差額不一致 | `差額と控除合計が一致しないため確定できません` |
| 中項目未設定で確定 | `中項目（勘定科目）は確定時必須です` |
| OPERATOR が確定試行 | `Only ADMIN can confirm sales transactions` |

#### 11. 関連画面・連携

| 画面 | 連携内容 |
|---|---|
| [`/cashflow-table`](cashflow-table.md) | 実入金日の入金行が反映。請求は予定行 |
| [`/master/deduction-categories`](master-deduction-categories.md) | 売上用控除カテゴリのマスタ |
| [`/master/partners`](master-partners.md) | 顧客 (取引先) マスタ |
| [`/master/categories`](master-categories.md) | 売上科目マスタ |
| [`/costs`](costs.md) | 関連する原価支払 |

### 原価支払 (`/costs`)

#### 1. 概要

工事原価・下請への支払を、**計上額 (控除前)** と **振込額 (実支払)** の 2 つで保持する画面。資金繰り表には振込額のみが反映され、控除内訳は PL 集計用。

- ページ実体: [`app/(dashboard)/costs/page.tsx`](../app/(dashboard)/costs/page.tsx) (537行)

#### 2. URL とクエリパラメータ

| URL | 説明 |
|---|---|
| `/costs` | デフォルト |
| `/costs?edit=<txId>` | 該当取引を編集ダイアログで開く |

#### 3. 画面構成 (UI 詳細)

##### 3.1 ヘッダー

- タイトル「原価支払」 + 会社名
- 右上に `<CompanySwitcher />` + `<TransactionExcelImport />`
- 「+ 新規原価支払」ボタン

##### 3.2 フィルタ

| 項目 | 説明 |
|---|---|
| 月 | `<input type="month">` |
| ステータス | ALL / DRAFT / READY / CONFIRMED / CANCELLED |

##### 3.3 一覧テーブル

| 列 | 内容 |
|---|---|
| 稼働日 | `transactionDate` |
| 支払先 | `partner.name` |
| 人工 | 内訳 1 |
| 法定福利費 | 内訳 2 |
| 材料・諸経費 | 内訳 3 |
| 消費税 | 内訳 4 |
| 合計 (計上額) | 4 つの合計 |
| 実支払金額 | `transferAmount` |
| 差額 | 計上額 − 実支払 |
| 控除合計 | 控除内訳の合計 |
| ステータス | DRAFT/READY/CONFIRMED |
| 操作 | 控除入力 / 編集 / 削除 |

##### 3.4 ダイアログ

| ダイアログ | 用途 |
|---|---|
| 原価支払フォーム | 新規 / 編集 |
| 控除内訳パネル (`DeductionDetailsPanel`) | 控除カテゴリ × 金額 を複数行 |

#### 4. 入力フォーム項目

##### 4.1 親 (原価支払)

| 項目 | 型 | 必須 | 説明 |
|---|---|---|---|
| 口座 | select | ✅ | 支払口座 |
| 支払先 | select | ✅ | `TradingPartner` |
| 稼働日 | date | △ | `transactionDate` |
| 計上月 | month | ✅ | `accountingMonth` |
| 人工費 | number | — | 内訳 1 (`laborCost`) |
| 法定福利費 | number | — | 内訳 2 (`welfareCost`) |
| 材料・諸経費 | number | — | 内訳 3 (`materialCost`) |
| 消費税 | number | — | 内訳 4 (`taxAmount`) |
| 合計 | (自動) | — | 4 つの合計 |
| 実支払金額 | number | ✅ | `transferAmount` |
| 差額 | (自動) | — | 計上 − 実支払 |
| 摘要 | text | — | |

##### 4.2 控除内訳

控除カテゴリは `getDeductionCategories("COST")` から取得:
- 協力会費 / 保険料 / 立替金回収 / 貸金回収 / 家賃 / 給与控除 / その他控除

#### 5. ステータス遷移

```
DRAFT (下書き) ──[準備完了]──> READY ──[ADMIN 確定]──> CONFIRMED
```

確定不可条件 (CONFIRMED 不可):
- 分割支払中 (未払残あり)
- 差額 (計上 − 実支払) ≠ 控除合計

#### 6. 業務ルール

##### 6.1 計上額 vs 振込額

- `amount` (= 親の金額) = 実支払金額 = 振込額 = 資金繰り表に反映
- `recordedAmount` = 計上額 = PL 集計用
- 差額 = `recordedAmount - amount` を控除で説明する

##### 6.2 月締めロック

`monthClosed=true` の月では金額・口座変更不可。摘要のみ編集可能。

##### 6.3 整合チェック

支払完了後、差額 ≠ 控除合計 のときは確定不可。

##### 6.4 証憑添付

原価入力では証憑添付は **必須としない** (別システム前提)。

#### 7. 権限制御

| 操作 | ADMIN | OPERATOR | VIEWER |
|---|---|---|---|
| 表示 | ✅ | ✅ | ✅ |
| 入力 | ✅ | ✅ | ❌ |
| 編集 (DRAFT/READY) | ✅ | ✅ | ❌ |
| 準備完了 | ✅ | ✅ | ❌ |
| 確定 → CONFIRMED | ✅ | ❌ | ❌ |
| 削除 | ✅ | ✅ (DRAFT のみ) | ❌ |

#### 8. 使用 Server Actions

| 関数 | 役割 |
|---|---|
| `getTransactions(companyId, "COST_PAYMENT", month?, status?)` | 原価一覧取得 |
| `createTransaction({type: "COST_PAYMENT", ...})` | 新規 |
| `updateTransaction(id, data)` | 更新 |
| `updateTransactionStatus(id, status, companyId)` | 遷移 |
| `deleteTransaction(id, companyId)` | 削除 |
| `upsertTransactionDetails(transactionId, details[])` | 内訳・控除の一括更新 |
| `getDeductionDetailsForTransaction(transactionId)` | 控除内訳取得 |
| `getDeductionCategories("COST")` | 控除カテゴリ |
| `checkMonthClosed(companyId, yearMonth)` | 月締めチェック |

#### 9. データ連携先 (Prisma モデル)

| モデル | R | W | 役割 |
|---|---|---|---|
| `Transaction` | ✅ | ✅ | 原価取引 (`type=COST_PAYMENT`) |
| `TransactionDetail` | ✅ | ✅ | 内訳 (人工/法福/材料/消費税) + 控除明細 |
| `DeductionCategory` | ✅ | — | 原価用控除カテゴリ (`scope=COST`) |
| `TradingPartner` | ✅ | — | 支払先 (下請) |
| `TradingPartnerBankAccount` | ✅ | — | 支払先口座の自動補完 |
| `Account` | ✅ | — | 支払口座 |
| `MonthClose` | ✅ | — | 月締めチェック |

##### 主な書き込みフィールド

**新規 (`createTransaction`)**:
```
Transaction { type=COST_PAYMENT, companyId, accountId, partnerId,
              transactionDate, accountingMonth,
              amount = transferAmount (実支払・負値),
              recordedAmount = laborCost+welfareCost+materialCost+taxAmount (計上額),
              transferAmount,
              status=DRAFT }
TransactionDetail[] {  // 内訳 4 行
  { midId=人工費科目, amount=laborCost },
  { midId=法福費科目, amount=welfareCost },
  { midId=材料諸経費科目, amount=materialCost },
  { midId=消費税科目, amount=taxAmount },
}
```

**控除入力**:
```
TransactionDetail[] { transactionId, deductionCategoryId, midId (default),
                      amount, summary? }
```

#### 10. エラー / アラート

| シナリオ | メッセージ |
|---|---|
| 月締め後の金額変更 | `月締め後は金額変更できません` |
| 分割支払中の確定試行 | `分割支払中の取引は確定できません` |
| 差額不一致の確定試行 | `差額と控除合計が一致しないため確定できません` |
| OPERATOR が確定試行 | `Only ADMIN can confirm cost payments` |

#### 11. 関連画面・連携

| 画面 | 連携内容 |
|---|---|
| [`/cashflow-table`](cashflow-table.md) | `transferAmount` が支払行として反映 (実出納日) |
| [`/sales`](sales.md) | 売上 → 原価への紐付け (将来) |
| [`/master/deduction-categories`](master-deduction-categories.md) | 原価用控除カテゴリ |
| [`/master/partners`](master-partners.md) | 支払先マスタ |

### 給与入力 (`/salary`)

#### 1. 概要

毎月の給与・賞与を **給与グループ単位で合計入力** する画面。個人明細は管理対象外。控除と支払内訳を保持し、課税支給を基に **社会保険積立 (15%)** と **消費税積立 (10%)** を自動計算 + 仮想口座へ自動反映する。

- ページ実体: [`app/(dashboard)/salary/page.tsx`](../app/(dashboard)/salary/page.tsx) (829行)

#### 2. URL とクエリパラメータ

| URL | 説明 |
|---|---|
| `/salary` | デフォルト = 今月 |
| `/salary?edit=<entryId>` | 該当エントリ編集 (資金繰り表から) |

#### 3. 画面構成 (UI 詳細)

##### 3.1 ヘッダー

- タイトル「給与入力」 + 会社名
- 右上に `<CompanySwitcher />` と `<SalaryExcelImport />` (Excel 合計取込)
- 「+ 新規給与エントリ」ボタン

##### 3.2 フィルタ

| 項目 | 説明 |
|---|---|
| 支給月 | `<input type="month">` (`payMonth`) |

##### 3.3 給与エントリ一覧

| 列 | 内容 |
|---|---|
| 給与グループ | `payrollGroup.name` (区分 COST/SGA/OUTSOURCE 表示) |
| 支給日 | `payDate` |
| 課税支給 | `taxablePayment` |
| 総支給 | `totalPayment` (自動計算) |
| 社保積立 (15%) | `socialInsuranceReserve` |
| 消費税積立 (10%) | `consumptionTaxReserve` |
| 控除合計 | `totalDeduction` |
| 差引支給 | `netPayment` |
| 人数 | `headcount` |
| ステータス | DRAFT / READY / CONFIRMED |
| 操作 | 控除入力 / 支払内訳 / 編集 / 確定 / 削除 |

##### 3.4 ダイアログ

| ダイアログ | 用途 |
|---|---|
| 給与エントリ (`dialogOpen`) | 親 (給与グループ × 月) の入力 |
| 控除内訳 (`deductionDialogOpen`) | 項目名 × 金額の複数行入力 |
| 支払内訳 (`paymentDialogOpen`) | 出金イベントの複数行入力 |

#### 4. 入力フォーム項目

##### 4.1 給与エントリ (親)

| 項目 | 型 | 必須 | 説明 |
|---|---|---|---|
| 給与グループ | select | ✅ | `PayrollGroup` |
| 支給日 | date | ✅ | `payDate` |
| 課税支給 | number | ✅ | `taxablePayment` (積立計算の基礎) |
| 交通費 | number | — | `transportAllowance` |
| 諸経費 | number | — | `miscExpenses` |
| 繰越金調整 | number | — | `carryoverAdjust` |
| 立替経費 | number | — | `advanceExpenses` |
| 総支給 (自動) | — | — | `taxable + transport + misc + carryover + advance` |
| 社保積立 (自動 15%) | — | — | `Math.floor(taxablePayment * 0.15)` |
| 消費税積立 (自動 10%) | — | — | `Math.floor(taxablePayment * 0.10)` |
| 人数 | number | ✅ | `headcount` |

##### 4.2 控除内訳 (子)

| 項目 | 説明 |
|---|---|
| 項目名 | 例: 家賃控除, 健康保険, 所得税, 住民税, 雇用保険, 厚生年金, 介護保険, その他源泉 |
| 金額 | 負値 |
| 自動仕訳マッピング (`midId`, `subId`) | [自動仕訳テーブル](#52-自動仕訳マッピング)参照 |

##### 4.3 支払内訳 (子)

| 項目 | 説明 |
|---|---|
| 出金日 | `paymentDate` (実出納日、資金繰り表に反映される日) |
| 支払方法 | BANK_TRANSFER / DIRECT_DEBIT / CASH_WITHDRAWAL |
| 出金口座 | `accountId` |
| 金額 | 正値 |

#### 5. 業務ルール

##### 5.1 自動計算

[`salary/page.tsx:138-144`](../app/(dashboard)/salary/page.tsx#L138)

```ts
totalPayment = taxablePayment + transportAllowance + miscExpenses + carryoverAdjust + advanceExpenses
socialInsuranceReserve = Math.floor(taxablePayment * 0.15)
consumptionTaxReserve  = Math.floor(taxablePayment * 0.10)
netPayment = totalPayment − totalDeduction
```

積立は **入力時点で表示**。準備完了時点で原価支払一覧/積立(仮想口座)へ自動反映し、確定前は変更に追随更新。

##### 5.2 自動仕訳マッピング

`SalaryJournalMapping` で給与控除 → 勘定科目への紐付けを管理:

| 控除項目 | 大項目 | 中項目 | 小項目 | 区分 |
|---|---|---|---|---|
| 家賃控除 | 販管費 | 地代家賃 | 地代家賃 | 固定 |
| 通信費控除 | 販管費 | 通信費 | 通信費 | 変動 |
| 立替経費 | 販管費 | 立替金 | 立替金 | 変動 |
| 印紙/在庫品 | 販管費 | 消耗品費 | 消耗品費 | 変動 |
| 光熱費控除 | 販管費 | 水道光熱費 | 水道光熱費 | 変動 |
| 保険料控除 | 販管費 | 保険料 | 保険料 | 固定 |
| 交通費 | 販管費 | 旅費交通費 | 旅費交通費 | 変動 |
| 社会保険料 (合算) | その他費用 | 社会保険積立 | 給与預かり分 | 定期 |
| 源泉納税 (合算) | その他費用 | 源泉所得税 | 給与預かり分 | 定期 |
| 貸金/立替金 | その他費用 | 貸金/立替金 | 給与預かり分 | 変動 |
| 積立金 | その他費用 | 消費税積立 | 給与預かり分 | 定期 |

##### 5.3 整合チェック (必須一致)

1. `totalPayment - totalDeduction = netPayment`
2. `netPayment = Σ paymentDetails.amount` (振込 + 現金引出)

未一致時は **準備完了不可**。

##### 5.4 仮想口座への自動反映

- 社会保険積立 (15%) → 仮想口座「社会保険料積立」への振替
- 消費税積立 (10%) → 仮想口座「消費税積立」への振替
- `FundTransfer` + `Transaction` で表現

##### 5.5 表示ビューの分離

- **給与入力者ビュー**: 集計用項目 (15%/10% 等) は非表示または簡易表示
- **管理者ビュー**: 全項目表示

#### 6. ステータス遷移

```
DRAFT ──[整合チェック OK + 準備完了]──> READY ──[給与管理者 確定]──> CONFIRMED
```

確定は **給与管理者ロール** が実施 (確定日時ログを保持)。解除は ADMIN のみ。

#### 7. 権限制御

| 操作 | ADMIN | OPERATOR (給与入力者) | VIEWER |
|---|---|---|---|
| 表示 | ✅ | ✅ | ✅ |
| 新規入力 | ✅ | ✅ | ❌ |
| 編集 (DRAFT/READY) | ✅ | ✅ | ❌ |
| 準備完了 | ✅ | ✅ | ❌ |
| 確定 → CONFIRMED | ✅ | ❌ (給与管理者ロールのみ) | ❌ |
| 確定解除 | ✅ | ❌ | ❌ |

#### 8. 使用 Server Actions

| 関数 | 役割 |
|---|---|
| `getPayrollGroups(companyId)` | 給与グループマスタ |
| `getSalaryEntries(companyId, payMonth)` | 給与エントリ一覧 |
| `createSalaryEntry(data)` | 新規 |
| `updateSalaryEntry(id, data, companyId)` | 更新 |
| `deleteSalaryEntry(id, companyId)` | 削除 |
| `upsertSalaryDeductions(entryId, deductions[])` | 控除内訳の一括更新 |
| `upsertPaymentDetails(entryId, paymentDetails[])` | 支払内訳の一括更新 |
| `updateSalaryStatus(id, status, companyId)` | 遷移 |
| `generateSalaryJournalEntries(entryId, companyId)` | 自動仕訳の生成 |
| `getSalaryJournalMappings()` | 自動仕訳マッピング取得 |

#### 9. データ連携先 (Prisma モデル)

| モデル | R | W | 役割 |
|---|---|---|---|
| `SalaryEntry` | ✅ | ✅ | 給与親 (会社×支給月×給与グループ) |
| `SalaryDeduction` | ✅ | ✅ | 控除明細 |
| `SalaryPaymentDetail` | ✅ | ✅ | 支払内訳 (出金イベント) |
| `PayrollGroup` | ✅ | — | 給与グループ |
| `SalaryJournalMapping` | ✅ | — | 控除→自動仕訳マッピング |
| `Transaction` | — | ✅ | 自動仕訳の生成 (社保・消費税積立等) |
| `TransactionDetail` | — | ✅ | 自動仕訳の内訳 |
| `FundTransfer` | — | ✅ | 仮想口座への振替 |
| `Company` | ✅ | — | 会社マスタ |
| `Account` | ✅ | — | 支払口座 + 仮想口座 |

##### 主な書き込みフィールド

**新規エントリ**:
```
SalaryEntry {
  companyId, payrollGroupId, payMonth, payDate,
  taxablePayment, transportAllowance, miscExpenses, carryoverAdjust, advanceExpenses,
  totalPayment (自動), socialInsuranceReserve (15%自動), consumptionTaxReserve (10%自動),
  totalDeduction (子集計後), netPayment (自動),
  headcount, status=DRAFT
}
```

**自動仕訳生成 (`generateSalaryJournalEntries`)**:
- `SalaryDeduction` ごとに対応する `Transaction` + `TransactionDetail` を生成
- 社保 15% / 消費税 10% は仮想口座への `FundTransfer` も生成

#### 10. エラー / アラート

| シナリオ | メッセージ |
|---|---|
| 整合チェック失敗 | `総支給−控除合計と差引支給が一致しません` |
| 支払内訳合計の不一致 | `差引支給と支払内訳合計が一致しません` |
| 月締め後の変更 | `月締め後は金額変更できません` |
| OPERATOR が確定 | `Only ADMIN can confirm salary entries` |

#### 11. 関連画面・連携

| 画面 | 連携内容 |
|---|---|
| [`/cashflow-table`](cashflow-table.md) | `SalaryPaymentDetail` の出金イベントが資金繰り表に反映 |
| [`/cash-withdrawal`](cash-withdrawal.md) | 現金引出による給与支払を集約 |
| [`/master/payroll-groups`](master-payroll-groups.md) | 給与グループマスタ |
| [`/master/deduction-categories`](master-deduction-categories.md) | 控除カテゴリ (給与用ではないが共通) |
| [`/master/categories`](master-categories.md) | 自動仕訳の科目参照 |

### グループ間入力 (`/inter-group`)

#### 1. 概要

グループ会社間の取引 (売上/原価・経費・貸付/借入・配当・サービス相殺など) を専用画面で登録する。一方の会社で出金、相手会社で入金として **双方に対称的に同時計上** し、グループ内取引の二重カウントを防止する。

- ページ実体: [`app/(dashboard)/inter-group/page.tsx`](../app/(dashboard)/inter-group/page.tsx) (588行)
- 主アクション: [`app/actions/inter-group.ts`](../app/actions/inter-group.ts)

#### 2. URL とクエリパラメータ

| URL | 説明 |
|---|---|
| `/inter-group` | デフォルト = 今月 |

#### 3. 画面構成 (UI 詳細)

##### 3.1 ヘッダー

- タイトル「グループ間入力」 + 会社名
- 右上に `<CompanySwitcher />`
- 「+ 新規入力」ボタン
- 「前月コピー」ボタン (`<Copy />` アイコン)

##### 3.2 取引カテゴリ (タブ)

| キー | ラベル | 説明 | カラー |
|---|---|---|---|
| `sale` | 売上 / 原価 | 支払会社で入力 → 受取会社へ売上として自動反映 | emerald |
| `expense` | 経費 | 支払会社で入力 → 受取会社へ収益として自動反映 (固定/変動/臨時 区分対応) | amber |
| `loan` | 貸付/借入 | 一方が貸付 → 相手が借入 | blue |
| `dividend` | 配当 | 親会社への配当 | violet |
| `service` | サービス対価 | サービス相殺など | slate |
| `other` | その他 | 上記以外 | gray |

##### 3.3 一覧テーブル

| 列 | 内容 |
|---|---|
| 取引日 | `transactionDate` |
| 計上月 | `accountingMonth` |
| 自社 | `company.shortName` |
| 自社口座 | `account.bankName` |
| → | アイコン (`<ArrowRight />`) |
| 相手会社 | `counterCompany.shortName` |
| 相手口座 | `counterAccount.bankName` |
| 金額 | `amount` (formatYen) |
| 区分 | 固定/変動/臨時 (経費カテゴリのみ) |
| 摘要 | `summary` |
| 操作 | 編集 / 削除 |

##### 3.4 ダイアログ

| ダイアログ | 用途 |
|---|---|
| 新規入力 (カテゴリ別) | 売上・経費・その他の入力フォーム |
| 前月コピープレビュー | 前月のグループ間取引を一覧表示 → 選択コピー |
| 編集 | 既存取引の編集 (両会社の取引を同時更新) |

#### 4. 入力フォーム項目

| 項目 | 型 | 必須 | 説明 |
|---|---|---|---|
| 受取会社 | select | ✅ | グループ会社 (`getGroupCompaniesFor`) |
| 支払元口座 | select | ✅ | 自社口座 |
| 受取口座 | select | ✅ | 相手会社の口座 |
| 取引日 | date | ✅ | `transactionDate` |
| 計上月 | month | ✅ | `accountingMonth` |
| 金額 | number | ✅ | 正値 (出金側で負・入金側で正に変換) |
| 区分 | select | △ | 経費カテゴリのみ: FIXED/VARIABLE/TEMPORARY |
| 摘要 | text | — | |

#### 5. 業務ルール

##### 5.1 ペア取引の対称生成

一方の入力で **両会社の Transaction を同時生成**:

```
Transaction (自社・支払) {
  type=EXPENSE or COST_PAYMENT, companyId=自社, amount=-X,
  linkedTransactionId=相手取引のid
}
Transaction (相手・受取) {
  type=SALES or その他, companyId=相手, amount=+X,
  linkedTransactionId=自社取引のid
}
```

`linkedTransactionId` で相互参照。

##### 5.2 連動削除・更新

- 一方を削除 → 相手取引も連動削除
- 一方を編集 → 相手取引も連動更新

##### 5.3 グループ会社の絞り込み

`getGroupCompaniesFor(companyId)` で:
- 自社が所属する `CompanyGroup` のメンバー会社のみ取得
- 自社自身は除外

##### 5.4 前月コピー

`copyPreviousMonthInterGroup({sourceMonth, targetMonth, companyId})`:
- 前月の全グループ間取引を取得
- プレビュー画面で選択
- 選択分を `targetMonth` にコピー (取引日・金額は維持、`accountingMonth` を変更)

#### 6. 権限制御

| 操作 | ADMIN | OPERATOR | VIEWER |
|---|---|---|---|
| 表示 | ✅ | ✅ | ✅ |
| 新規 | ✅ | ✅ | ❌ |
| 編集 | ✅ | ✅ | ❌ |
| 削除 | ✅ | ❌ | ❌ |
| 前月コピー | ✅ | ✅ | ❌ |

#### 7. 使用 Server Actions

| 関数 | 役割 |
|---|---|
| `getInterGroupTransactions({companyId, yearMonth?})` | 一覧取得 |
| `createInterGroupSale({...})` | 売上カテゴリ用ヘルパー |
| `createInterGroupExpense({...})` | 経費カテゴリ用ヘルパー |
| `createInterGroupTransaction({category, ...})` | 汎用 |
| `updateInterGroupTransaction(id, data)` | 更新 (両会社) |
| `deleteInterGroupTransaction(payerTransactionId)` | 削除 (両会社) |
| `copyPreviousMonthInterGroup({sourceMonth, targetMonth, companyId})` | 前月コピー |
| `getGroupCompaniesFor(companyId)` | グループメンバー取得 |
| `getAccounts(companyId)` | 口座選択 |

#### 8. データ連携先 (Prisma モデル)

| モデル | R | W | 役割 |
|---|---|---|---|
| `Transaction` | ✅ | ✅ | 双方向ペア取引 (`linkedTransactionId` で相互リンク) |
| `Company` | ✅ | — | 相手会社の選択 |
| `CompanyGroupMember` | ✅ | — | グループ会社の絞り込み |
| `Account` | ✅ | — | 口座マスタ |
| `FundTransfer` | ✅ | — | 既存の振替との関連表示 |

##### 主な書き込みフィールド

`createInterGroupSale`:
```
Transaction (自社・支払) {
  type=COST_PAYMENT, companyId=自社, accountId=自社口座,
  amount=-X, transactionDate, accountingMonth,
  linkedTransactionId=(相手の id),
  partnerId=自社内グループ会社=null, summary
}
Transaction (相手・受取) {
  type=SALES, companyId=相手, accountId=相手口座,
  amount=+X, transactionDate, accountingMonth,
  linkedTransactionId=(自社の id)
}
```

#### 9. エラー / アラート

| シナリオ | メッセージ |
|---|---|
| グループメンバー外を相手指定 | `相手会社は同じグループの会社のみ選択できます` |
| 月締め後の編集 | `月締め後は変更できません` |
| `linkedTransactionId` が片方欠落 | `グループ間取引のペアが壊れています` |

#### 10. 関連画面・連携

| 画面 | 連携内容 |
|---|---|
| [`/cashflow-table`](cashflow-table.md) | 生成行は紫の左ボーダー + **G間** バッジで表示 |
| [`/cashflow`](cashflow.md) | 単純な資金移動 (グループ会社間でも) はこちら |
| [`/master/company-groups`](master-company-groups.md) | グループ定義 |
| [`/master/companies`](master-companies.md) | 会社マスタ |

## D. 管理 (6画面)


### 現金引出 (`/cash-withdrawal`)

#### 1. 概要

ATM・窓口で複数の現金支払 (給与等) をまとめて引き出す **現金引出バッチ** を作成・管理する画面。親 = 通帳の現金引出 1 回、子 = 用途明細、金種表まで保持する。

- ページ実体: [`app/(dashboard)/cash-withdrawal/page.tsx`](../app/(dashboard)/cash-withdrawal/page.tsx) (429行)
- 主アクション: [`app/actions/cash-withdrawal.ts`](../app/actions/cash-withdrawal.ts)

#### 2. URL とクエリパラメータ

| URL | 説明 |
|---|---|
| `/cash-withdrawal` | デフォルト = 今月 |

#### 3. 画面構成 (UI 詳細)

##### 3.1 ヘッダー

- タイトル「現金引出」 + 会社名
- 右上に `<CompanySwitcher />`
- 月セレクター
- 「+ 新規バッチ」ボタン

##### 3.2 バッチ一覧テーブル

| 列 | 内容 |
|---|---|
| 引出日 | `withdrawalDate` |
| 出金口座 | `account.bankName` |
| 引出金額 | `totalAmount` |
| 子用途数 | 子明細件数 |
| 子用途合計 | 子の金額合計 |
| 金種合計 | 金種表の金額合計 |
| 整合 | ✅ (3 一致) / ❌ |
| ステータス | DRAFT / READY / CONFIRMED |
| 操作 | 詳細 / 確定 / 削除 |

##### 3.3 バッチ詳細ビュー

**子用途明細** (`Transaction` から link or 手入力):
| 列 | 内容 |
|---|---|
| 用途 | 取引名 (給与 / 経費 等) |
| 取引先 | partner.name |
| 金額 | 子の金額 |
| 操作 | 解除 (unlink) |

**金種表** (`CashDenomination`):
| 金種 | 枚数 |
|---|---|
| 10000 円 | n |
| 5000 円 | n |
| 1000 円 | n |
| 500 円 | n |
| 100 円 | n |
| 50 円 | n |
| 10 円 | n |
| 5 円 | n |
| 1 円 | n |
| **合計** | totalAmount |

「自動提案」ボタン (`suggestDenomination(amount)`) で最小枚数優先の金種を計算。

##### 3.4 ダイアログ

| ダイアログ | 用途 |
|---|---|
| バッチフォーム | 引出日 / 口座 / 引出金額 |
| 用途リンク | 未紐づけの現金 Transaction 一覧から選択 |
| 金種表編集 | 9 種類の枚数入力 |

#### 4. 入力フォーム項目

##### 4.1 バッチ (親)

| 項目 | 型 | 必須 | 説明 |
|---|---|---|---|
| 引出日 | date | ✅ | `withdrawalDate` (= 実出納日) |
| 出金口座 | select | ✅ | `accountId` |
| 引出金額 | number | ✅ | `totalAmount` |
| 摘要 | text | — | |

##### 4.2 子用途 (link or 手入力)

- リンク基本: `linkTransactionToBatch(batchId, transactionId)`
- 手入力: 新規 `Transaction { paymentMethod=CASH_WITHDRAWAL }` を作成して紐づけ

#### 5. 業務ルール

##### 5.1 確定条件 (厳格)

[`confirmCashWithdrawalBatch`](../app/actions/cash-withdrawal.ts):

1. **親引出金額 = 子用途合計** (`totalAmount = Σ children.amount`)
2. **金種表合計 = 引出金額** (`Σ denomination.value × count = totalAmount`)
3. 3 つすべて一致が必須

不一致時は確定不可。

##### 5.2 自動金種提案

[`suggestDenomination(amount)`](../app/actions/cash-withdrawal.ts):
- 最小枚数優先で 1 円〜1 万円を組み合わせ
- 金額にぴったり一致する組合せを返す
- 給与等で手入力で上書き可

##### 5.3 引出日と用途支払予定日は異なって良い

- 親バッチの `withdrawalDate` (= 実出納日) と
- 子用途の `Transaction.scheduledDate` (支払予定日) は別
- 運用上、引出と支払を同日扱いだが厳密には別

##### 5.4 用途と金種は別印刷可

用途一覧と金種表を別々に印刷できる。

#### 6. 権限制御

| 操作 | ADMIN | OPERATOR | VIEWER |
|---|---|---|---|
| 表示 | ✅ | ✅ | ✅ |
| 新規バッチ | ✅ | ✅ | ❌ |
| 用途リンク | ✅ | ✅ | ❌ |
| 金種表編集 | ✅ | ✅ | ❌ |
| **確定** | ✅ | ❌ | ❌ |
| 削除 | ✅ | ❌ | ❌ |

#### 7. 使用 Server Actions

| 関数 | 役割 |
|---|---|
| `getCashWithdrawalBatches(companyId, month?)` | バッチ一覧 |
| `createCashWithdrawalBatch({...})` | 新規バッチ |
| `linkTransactionToBatch(batchId, transactionId)` | 用途をバッチに紐づけ |
| `unlinkTransactionFromBatch(transactionId)` | 紐づけ解除 |
| `getUnlinkedCashTransactions(companyId, month?)` | 未紐づけの現金 Transaction (リンク候補) |
| `upsertDenomination(batchId, {value, count})` | 金種枚数の登録/更新 |
| `suggestDenomination(amount)` | 自動金種提案 |
| `confirmCashWithdrawalBatch(batchId)` | 確定 (ADMIN、3 一致チェック) |
| `deleteCashWithdrawalBatch(batchId)` | 削除 |

#### 8. データ連携先 (Prisma モデル)

| モデル | R | W | 役割 |
|---|---|---|---|
| `CashWithdrawalBatch` | ✅ | ✅ | 現金引出バッチ親 |
| `CashDenomination` | ✅ | ✅ | 金種内訳 |
| `Transaction` | ✅ | ✅ | 子用途明細 (link) + 親通帳行 |
| `Company` | ✅ | — | 会社マスタ |
| `Account` | ✅ | — | 出金口座 |

##### 主な書き込みフィールド

**新規バッチ**:
```
CashWithdrawalBatch {
  companyId, accountId, withdrawalDate,
  totalAmount, status=DRAFT
}
Transaction { type=EXPENSE, paymentMethod=CASH_WITHDRAWAL,
              amount=-totalAmount, accountId=出金口座,
              cashWithdrawalBatchId=自身のid }
```

**用途リンク**:
```
Transaction.cashWithdrawalBatchId = batchId
```

**金種表**:
```
CashDenomination[] {
  batchId, value (1|5|10|50|100|500|1000|5000|10000), count
}
```

**確定**:
```
CashWithdrawalBatch.status = CONFIRMED, confirmedAt = now, confirmedBy = userId
```

#### 9. エラー / アラート

| シナリオ | メッセージ |
|---|---|
| 親 ≠ 子合計 | `親引出金額と子用途合計が一致しません` |
| 金種合計 ≠ 引出金額 | `金種表合計と引出金額が一致しません` |
| OPERATOR が確定 | `Only ADMIN can confirm cash withdrawal batches` |

#### 10. 関連画面・連携

| 画面 | 連携内容 |
|---|---|
| [`/cashflow-table`](cashflow-table.md) | 引出 1 件として実支払日に反映 |
| [`/salary`](salary.md) | 現金引出による給与支払の発生源 |
| [`/master/accounts`](master-accounts.md) | 出金口座マスタ |

### 借入管理 (`/loans`)

#### 1. 概要

金融機関からの借入契約と返済スケジュールを管理する画面。返済方式 (元金均等 / 据置 / 一括) と金利改定履歴を保持し、スケジュールを自動生成して資金繰り表へ未確定で反映する。借入契約書の **印刷ビュー** も提供。

- ページ実体: [`app/(dashboard)/loans/page.tsx`](../app/(dashboard)/loans/page.tsx) (631行)
- 主アクション: [`app/actions/loans.ts`](../app/actions/loans.ts)

#### 2. URL とクエリパラメータ

| URL | 説明 |
|---|---|
| `/loans` | デフォルト |

#### 3. 画面構成 (UI 詳細)

##### 3.1 ヘッダー

- タイトル「借入管理」 + 会社名
- 右上に `<CompanySwitcher />`
- 「+ 新規借入契約」ボタン

##### 3.2 借入契約一覧テーブル

| 列 | 内容 |
|---|---|
| 契約名 | `contractName` |
| 借入先 | `partner.name` |
| 借入額 | `principalAmount` |
| 残高 | 未払スケジュールの合計 |
| 実行日 | `executionDate` |
| 返済方式 | EQUAL_PRINCIPAL / BULLET / GRACE_PERIOD |
| 金利 | `interestRate` (%) + `interestType` (FIXED/VARIABLE) |
| 信用保証協会 | `isGuaranteeAssociation` ✅ |
| ステータス | ACTIVE / COMPLETED / CANCELLED |
| 操作 | 詳細表示 / 印刷 / 削除 |

##### 3.3 借入詳細ビュー

契約情報 + 返済スケジュール表 (チェックボックスで支払済マーク可能):

| 列 | 内容 |
|---|---|
| 回 | `paymentNumber` |
| 期日 | `dueDate` |
| 元金 | `principalAmount` |
| 利息 | `interestAmount` |
| 合計 | `totalAmount` |
| 残高 | `remainingBalance` |
| 状態 | 支払済 / 未払 ✓ |

##### 3.4 ダイアログ

| ダイアログ | 用途 |
|---|---|
| 借入契約フォーム | 新規 / 編集 |
| 借入契約書 印刷 | 別ウィンドウで A4 縦の HTML 出力 (`printLoanContract`) |

#### 4. 入力フォーム項目

| 項目 | 型 | 必須 | 説明 |
|---|---|---|---|
| 契約名 | text | ✅ | `contractName` |
| 借入先 | select | ✅ | `TradingPartner` (タグ「銀行」) |
| 借入額 | number | ✅ | `principalAmount` |
| 実行日 | date | ✅ | `executionDate` |
| 返済開始日 | date | ✅ | `repaymentStartDate` |
| 返済方式 | select | ✅ | EQUAL_PRINCIPAL / BULLET / GRACE_PERIOD |
| 返済頻度 | select | ✅ | MONTHLY / QUARTERLY / SEMIANNUAL / ANNUAL |
| 返済日 | number | △ | `repaymentDay` (1-31) |
| 回数 | number | △ | `totalPayments` |
| 利息前払/後払 | select | ✅ | PREPAID / POSTPAID |
| 金利 | number (%) | ✅ | `interestRate` |
| 金利タイプ | select | ✅ | FIXED / VARIABLE |
| 日割基準 | select | ✅ | DAYS_365 / DAYS_360 |
| 信用保証協会 | checkbox | — | `isGuaranteeAssociation` |
| 元金端数調整 | select | — | FIRST / LAST |
| 利息端数処理 | select | — | ROUND / FLOOR / CEIL (デフォルト ROUND) |

#### 5. 業務ルール

##### 5.1 返済方式 (`repaymentMethod`)

| 値 | 説明 |
|---|---|
| `EQUAL_PRINCIPAL` | 元金均等。元金は定額、利息は残高 × 金利 |
| `BULLET` | 期日一括。最終回に元金 + 利息一括 |
| `GRACE_PERIOD` | 据置 (利息のみ)。指定期間は利息のみ、その後元金均等 |

※ 元利均等は初期対象外 (要件外)。

##### 5.2 スケジュール自動生成

`regenerateSchedule(contractId, companyId)`:
- 既存スケジュールを全削除 → 再生成
- 利息計算: 残高 × 金利 / 日割基準 × 期間日数 (端数 ROUND/FLOOR/CEIL)
- 金利変更時は **未確定将来分のみ** 再計算 (確定済は維持)

##### 5.3 残高一覧

任意時点での残高を出力可能 (未払スケジュールの合計)。

##### 5.4 支払済マーク

`markLoanSchedulePaid(scheduleId, companyId, paid: boolean)`:
- スケジュール行を「支払済」にマーク
- 対応する `Transaction` (借入返済) を生成 (`transactionId` で紐づけ)

##### 5.5 印刷ビュー

[`loans/page.tsx:25-78`](../app/(dashboard)/loans/page.tsx#L25) `printLoanContract()`:
- 別ウィンドウで A4 縦の HTML を出力
- 契約情報 + 返済スケジュール表
- `window.print()` で自動印刷ダイアログ

#### 6. 権限制御

| 操作 | ADMIN | OPERATOR | VIEWER |
|---|---|---|---|
| 表示 | ✅ | ✅ | ✅ |
| 新規 / 編集 | ✅ | ❌ | ❌ |
| スケジュール再生成 | ✅ | ❌ | ❌ |
| 支払済マーク | ✅ | ✅ | ❌ |
| 削除 | ✅ | ❌ | ❌ |
| 印刷 | ✅ | ✅ | ✅ |

#### 7. 使用 Server Actions

| 関数 | 役割 |
|---|---|
| `getLoans(companyId)` | 借入一覧 |
| `getLoan(id, companyId)` | 詳細 + スケジュール |
| `createLoan({...})` | 新規 + 初回スケジュール生成 |
| `updateLoan(id, data, companyId)` | 契約更新 |
| `deleteLoan(id, companyId)` | 削除 (スケジュールも連動) |
| `markLoanSchedulePaid(scheduleId, companyId, paid)` | 支払済マーク |
| `regenerateSchedule(contractId, companyId)` | スケジュール再生成 (ADMIN) |

#### 8. データ連携先 (Prisma モデル)

| モデル | R | W | 役割 |
|---|---|---|---|
| `LoanContract` | ✅ | ✅ | 借入契約本体 |
| `LoanSchedule` | ✅ | ✅ | 返済スケジュール (元金・利息・残高) |
| `TradingPartner` | ✅ | — | 借入先選択 (タグ「銀行」) |
| `Transaction` | — | ✅ | 支払済マーク時に返済取引を生成 |

##### 主な書き込みフィールド

`createLoan`:
```
LoanContract {
  companyId, contractName, partnerId, principalAmount, executionDate,
  repaymentStartDate, repaymentMethod, repaymentFrequency, repaymentDay,
  totalPayments, interestRate, interestType, paymentTiming,
  daysBasis (DAYS_365|DAYS_360), interestRounding,
  isGuaranteeAssociation, status=ACTIVE
}
LoanSchedule[] {
  contractId, paymentNumber, dueDate,
  principalAmount, interestAmount, totalAmount, remainingBalance,
  isPaid=false
}
```

#### 9. エラー / アラート

| シナリオ | メッセージ |
|---|---|
| `totalPayments <= 0` | `Total payments must be greater than 0` |
| OPERATOR が新規 | `Only ADMIN can create loan contracts` |
| スケジュール再生成中の確定済支払消去 | スキップ (未確定将来分のみ再計算) |

#### 10. 関連画面・連携

| 画面 | 連携内容 |
|---|---|
| [`/cashflow-table`](cashflow-table.md) | 返済スケジュールが資金繰り表に未確定で反映 (`type=LOAN`) |
| [`/master/partners`](master-partners.md) | 借入先マスタ (タグ「銀行」) |

### リース管理 (`/leases`)

#### 1. 概要

リース契約 (代表 / 車 / その他) を契約単位で管理する画面。月額・期間・回数・支払日ルール・休日調整を保持し、月初一括でスケジュールを資金繰り表へ反映する。

- ページ実体: [`app/(dashboard)/leases/page.tsx`](../app/(dashboard)/leases/page.tsx) (729行)
- 主アクション: [`app/actions/leases.ts`](../app/actions/leases.ts)

#### 2. URL とクエリパラメータ

| URL | 説明 |
|---|---|
| `/leases` | デフォルト |

#### 3. 画面構成 (UI 詳細)

##### 3.1 ヘッダー

- タイトル「リース管理」 + 会社名
- 右上に `<CompanySwitcher />`
- 「+ 新規リース契約」ボタン

##### 3.2 リース一覧テーブル

| 列 | 内容 |
|---|---|
| 契約名 | `contractName` |
| 種別 | Badge: 代表 / 車 / その他 (`assetCategory`) |
| 車種・ナンバー | `vehicleModel` + `vehicleNumber` (VEHICLE のみ) |
| リース先 | `partner.name` |
| 月額 | `monthlyAmount` |
| 開始日 | `startDate` |
| 終了日 | `endDate` |
| 回数 | `totalPayments` |
| 支払日 | `paymentDay` |
| ステータス | ACTIVE / COMPLETED / CANCELLED |
| 操作 | 詳細表示 / スケジュール再生成 / 削除 |

##### 3.3 リース詳細ビュー

支払スケジュール表 (チェックボックスで支払済):

| 列 | 内容 |
|---|---|
| 回 | `paymentNumber` |
| 期日 | `dueDate` |
| 金額 | `amount` |
| 状態 | 支払済 / 未払 ✓ |

##### 3.4 ダイアログ

| ダイアログ | 用途 |
|---|---|
| リース契約フォーム | 新規 / 編集 |
| 車両リース マトリクス (`getVehicleLeaseMatrix`) | 車両のみ・月別の集計 |

#### 4. 資産カテゴリ (`assetCategory`)

| 値 | ラベル | 説明 |
|---|---|---|
| `REPRESENTATIVE` | 代表 | 代表的なリース契約 |
| `VEHICLE` | 車 | 車両リース (車種・ナンバー必須) |
| `OTHER` | その他 | OA機器・その他 |

#### 5. 入力フォーム項目

| 項目 | 型 | 必須 | 説明 |
|---|---|---|---|
| 契約名 | text | ✅ | `contractName` |
| 資産カテゴリ | select | ✅ | REPRESENTATIVE / VEHICLE / OTHER |
| 車種 | text | △ (VEHICLE) | `vehicleModel` |
| ナンバー | text | △ (VEHICLE) | `vehicleNumber` |
| リース先 | select | ✅ | `TradingPartner` |
| 月額 | number | ✅ | `monthlyAmount` |
| 開始日 | date | ✅ | `startDate` |
| 回数 | number | △ | `totalPayments` |
| 支払日 | number | ✅ | `paymentDay` (1-31) |
| 休日調整 | select | ✅ | NONE / PREV_BUSINESS_DAY / NEXT_BUSINESS_DAY |
| 端数調整 | select | — | FIRST / LAST (初回 or 最終回で調整) |
| 出金口座 | select | ✅ | 自社口座 |
| 中項目 (科目) | select | ✅ | `AccountCategoryMid` (例: リース料) |
| 小項目 | select | — | 車両リース / OA機器/その他リース |

#### 6. 業務ルール

##### 6.1 単純スケジュール (利息計算なし)

借入と違い、リースは利息計算なし。月額 × 回数 = 総支払額。

`regenerateLeaseSchedule(contractId, companyId)`:
1. 既存スケジュール全削除
2. `startDate` から `totalPayments` 回分を `paymentDay` 基準で生成
3. 端数調整 (`principalAdjust`) で初回 or 最終回を調整

##### 6.2 休日調整

`holidayAdjust`:
| 値 | 説明 |
|---|---|
| `NONE` | 調整なし |
| `PREV_BUSINESS_DAY` | 休日なら前営業日 |
| `NEXT_BUSINESS_DAY` | 休日なら翌営業日 |

##### 6.3 月初一括反映

月初に `regenerateLeaseSchedule` を ADMIN が実行することで、その月のリース支払予定が資金繰り表に反映される。

#### 7. 権限制御

| 操作 | ADMIN | OPERATOR | VIEWER |
|---|---|---|---|
| 表示 | ✅ | ✅ | ✅ |
| 新規 / 編集 | ✅ | ❌ | ❌ |
| スケジュール再生成 | ✅ | ❌ | ❌ |
| 支払済マーク | ✅ | ✅ | ❌ |
| 削除 | ✅ | ❌ | ❌ |

#### 8. 使用 Server Actions

| 関数 | 役割 |
|---|---|
| `getLeases(companyId)` | リース一覧 |
| `getLease(id, companyId)` | 詳細 + スケジュール |
| `createLease({...})` | 新規 + 初回スケジュール生成 |
| `updateLease(id, data, companyId)` | 契約更新 |
| `deleteLease(id, companyId)` | 削除 |
| `regenerateLeaseSchedule(id, companyId)` | スケジュール再生成 |
| `markLeaseSchedulePaid(scheduleId, companyId, paid)` | 支払済マーク |
| `getVehicleLeaseMatrix({companyId, year})` | 車両リース 月別マトリクス |

#### 9. データ連携先 (Prisma モデル)

| モデル | R | W | 役割 |
|---|---|---|---|
| `LeaseContract` | ✅ | ✅ | リース契約本体 |
| `LeaseSchedule` | ✅ | ✅ | 支払スケジュール |
| `TradingPartner` | ✅ | — | リース先選択 |
| `Account` | ✅ | — | 出金口座 |
| `AccountCategoryMid` / `AccountCategorySub` | ✅ | — | 勘定科目 |
| `Transaction` | — | ✅ | 支払済マーク時に支払取引を生成 |

##### 主な書き込みフィールド

```
LeaseContract {
  companyId, partnerId, contractName, monthlyAmount,
  startDate, endDate, totalPayments, paymentDay,
  holidayAdjust, principalAdjust, accountId,
  midId, subId, status=ACTIVE,
  assetCategory (REPRESENTATIVE|VEHICLE|OTHER),
  vehicleModel?, vehicleNumber?
}
LeaseSchedule[] {
  contractId, paymentNumber, dueDate, amount, isPaid=false
}
```

#### 10. 関連画面・連携

| 画面 | 連携内容 |
|---|---|
| [`/cashflow-table`](cashflow-table.md) | スケジュールが資金繰り表に未確定で反映 |
| [`/master/partners`](master-partners.md) | リース先マスタ |
| [`/master/categories`](master-categories.md) | リース料の勘定科目 |
| [`/master/accounts`](master-accounts.md) | 出金口座マスタ |

### 納税予定表 (`/tax-schedule`)

#### 1. 概要

法人税・消費税・地方税の納税予定を会社別に管理する画面。中間納税の自動生成 (法人税・消費税の閾値判定) を提供し、納税予定を資金繰り表へ反映する。

- ページ実体: [`app/(dashboard)/tax-schedule/page.tsx`](../app/(dashboard)/tax-schedule/page.tsx) (622行)
- 主アクション: [`app/actions/tax-schedule.ts`](../app/actions/tax-schedule.ts)
- 共通ラベル: [`lib/tax-schedule.ts`](../lib/tax-schedule.ts) (`TAX_TYPE_LABELS`, `TaxType` 型)

#### 2. URL とクエリパラメータ

| URL | 説明 |
|---|---|
| `/tax-schedule` | デフォルト = 今年度 |

#### 3. 画面構成 (UI 詳細)

##### 3.1 ヘッダー

- タイトル「納税予定表」 + 会社名
- 右上に `<CompanySwitcher />`
- 「+ 新規予定」ボタン
- 「中間納税を自動生成」ボタン (`<Calculator />` アイコン)

##### 3.2 フィルタ

| 項目 | 説明 |
|---|---|
| 年度 | `fiscalYear` (number, デフォルト = 今年) |
| 税目 | ALL / CORPORATE / CONSUMPTION / RESIDENT / BUSINESS / FIXED_ASSET / OTHER |

##### 3.3 一覧テーブル

| 列 | 内容 |
|---|---|
| 税目 | Badge (法人税/消費税/法人住民税/事業税/固定資産税/その他) |
| 年度 | `fiscalYear` |
| 期 | `periodLabel` (確定 / 中間1〜4 / 予定) |
| 納期 | `dueDate` |
| 予定金額 | `scheduledAmount` |
| 基礎金額 | `basisAmount` (前年確定税額等) |
| 実支払 | `actualAmount` (paid 時のみ) |
| 状態 | ✓ 支払済 / 未払 |
| 備考 | `notes` |
| 操作 | 編集 / 削除 |

##### 3.4 ダイアログ

| ダイアログ | 用途 |
|---|---|
| 納税予定フォーム | 新規 / 編集 |
| 中間納税生成 | 法人税・消費税の中間納税ルール選択 → プレビュー → 一括生成 |

#### 4. 税目 (`TaxType`)

| 値 | ラベル | 説明 |
|---|---|---|
| `CORPORATE` | 法人税 | 中間あり |
| `CONSUMPTION` | 消費税 | 中間あり |
| `RESIDENT` | 法人住民税 | |
| `BUSINESS` | 事業税 | |
| `FIXED_ASSET` | 固定資産税 | |
| `OTHER` | その他 | |

定義位置: [`lib/tax-schedule.ts`](../lib/tax-schedule.ts)

#### 5. 期 (`periodLabel`)

| 値 | 説明 |
|---|---|
| `確定` | 確定申告分 |
| `中間` | 単一の中間 |
| `中間1` ~ `中間4` | 法人税で 4 回中間 |
| `予定` | 予定納税 |

#### 6. 入力フォーム項目

| 項目 | 型 | 必須 | 説明 |
|---|---|---|---|
| 税目 | select | ✅ | TaxType |
| 年度 | number | ✅ | `fiscalYear` |
| 期 | select | ✅ | `periodLabel` |
| 納期 | date | ✅ | `dueDate` |
| 予定金額 | number | ✅ | `scheduledAmount` |
| 基礎金額 | number | — | `basisAmount` (前年確定税額) |
| 支払済 | checkbox | — | `isPaid` |
| 実支払日 | date | △ | `paidDate` (isPaid 時) |
| 実支払額 | number | △ | `actualAmount` (isPaid 時) |
| 備考 | text | — | `notes` |

#### 7. 業務ルール

##### 7.1 中間納税の自動生成

[`generateInterimTaxSchedules`](../app/actions/tax-schedule.ts) は、税目別に閾値判定で中間納税を生成:

**法人税の中間納税ルール:**

| 前年確定税額 | 中間納税 | 期 |
|---|---|---|
| 20 万円超 ~ 60 万円以下 | 1 回 (半期) | 中間 |
| 60 万円超 | 1 回 (半期) ※ 仮決算 vs 予定申告は別 | 中間 |
| 20 万円以下 | なし | — |

**消費税の中間納税ルール:**

| 前年確定税額 | 中間納税 | 期 |
|---|---|---|
| 48 万円超 ~ 400 万円以下 | 1 回 (半期) | 中間 |
| 400 万円超 ~ 4,800 万円以下 | 3 回 (四半期) | 中間1~3 |
| 4,800 万円超 | 11 回 (毎月) | 中間1~11 |
| 48 万円以下 | なし | — |

##### 7.2 プレビュー → 確定

中間納税生成ダイアログ:
1. 税目・年度・前年確定税額を入力
2. **プレビューボタン**: 計算結果を表示 (期・納期・予定金額)
3. **一括生成**: プレビュー内容を `TaxPaymentSchedule` に INSERT

#### 8. 権限制御

| 操作 | ADMIN | OPERATOR | VIEWER |
|---|---|---|---|
| 表示 | ✅ | ✅ | ✅ |
| 新規 / 編集 | ✅ | ❌ | ❌ |
| 中間納税生成 | ✅ | ❌ | ❌ |
| 削除 | ✅ | ❌ | ❌ |
| 支払済マーク | ✅ | ✅ | ❌ |

#### 9. 使用 Server Actions

| 関数 | 役割 |
|---|---|
| `getTaxSchedules({companyId, fiscalYear?, taxType?})` | 一覧 |
| `createTaxSchedule({...})` | 新規 |
| `updateTaxSchedule(id, data)` | 更新 |
| `deleteTaxSchedule(id)` | 削除 |
| `generateInterimTaxSchedules({taxType, fiscalYear, prevYearTaxAmount, companyId})` | 中間納税生成 (プレビュー + 確定の二段階) |

#### 10. データ連携先 (Prisma モデル)

| モデル | R | W | 役割 |
|---|---|---|---|
| `TaxPaymentSchedule` | ✅ | ✅ | 納税予定本体 |
| `Company` | ✅ | — | 会社マスタ |

##### 主な書き込みフィールド

```
TaxPaymentSchedule {
  companyId, taxType (TaxType enum),
  fiscalYear, periodLabel,
  dueDate, scheduledAmount, basisAmount,
  isPaid, paidDate, actualAmount, notes
}
```

#### 11. エラー / アラート

| シナリオ | メッセージ |
|---|---|
| 閾値以下で中間生成 | `前年確定税額が閾値以下のため中間納税は不要です` |
| 過去年度の編集 | (制限なし。任意の年度を編集可能) |

#### 12. 関連画面・連携

| 画面 | 連携内容 |
|---|---|
| [`/cashflow-table`](cashflow-table.md) | 納税予定が資金繰り表に反映 (`type=EXPENSE` or 専用種別) |
| [`/master/companies`](master-companies.md) | 会社マスタ (決算月など) |

### カード明細 (`/card-statements`)

#### 1. 概要

法人クレジットカードの明細を管理する画面。利用明細を CSV/Excel から取込し、引落日にまとめて資金繰り表へ反映する。明細はカード単位 (`CreditCard`) で管理。

- ページ実体: [`app/(dashboard)/card-statements/page.tsx`](../app/(dashboard)/card-statements/page.tsx) (883行)
- 主アクション: [`app/actions/card-statements.ts`](../app/actions/card-statements.ts)

#### 2. URL とクエリパラメータ

| URL | 説明 |
|---|---|
| `/card-statements` | デフォルト = 今月・最初のカード |

#### 3. 画面構成 (UI 詳細)

##### 3.1 ヘッダー

- タイトル「カード明細」 + 会社名
- 右上に `<CompanySwitcher />`
- 「カードマスタ管理」「明細取込」ボタン

##### 3.2 コントロール

| 項目 | 説明 |
|---|---|
| カード | `<Select>` `CreditCard` 一覧 |
| 月 | `<input type="month">` (`statementMonth`) |
| ステータス | ALL / DRAFT / POSTED |

##### 3.3 サマリーカード

| カード | 内容 |
|---|---|
| 利用件数 | 当月の `CardStatement` 件数 |
| 利用合計 | 金額合計 |
| 引落日 | カードの `withdrawalDay` |

##### 3.4 明細テーブル

| 列 | 内容 |
|---|---|
| 利用日 | `useDate` |
| 利用先 | `merchantName` |
| 金額 | `amount` |
| 摘要 | `description` |
| 中項目 | `mid.name` (任意設定可) |
| ステータス | DRAFT / POSTED |
| 操作 | 編集 / 削除 |

##### 3.5 カードマスタ管理ダイアログ

`CreditCard` の CRUD:
| 項目 | 説明 |
|---|---|
| カード名 | |
| 引落口座 | `accountId` |
| 引落日 | `withdrawalDay` (1-31) |
| 締め日 | `closingDay` |
| 取引先 (カード会社) | `partnerId` |
| 有効フラグ | |

##### 3.6 取込ダイアログ

CSV/Excel 取込:
| ステップ | 内容 |
|---|---|
| ファイル選択 | CSV / Excel |
| プレビュー | 取込前の確認 |
| マッピング | カード会社別のフォーマット選択 |
| 取込 | `ImportBatch` 生成 + 明細 INSERT |

#### 4. 入力フォーム項目 (明細)

| 項目 | 型 | 必須 | 説明 |
|---|---|---|---|
| カード | select | ✅ | `creditCardId` |
| 利用日 | date | ✅ | `useDate` |
| 利用先 | text | ✅ | `merchantName` |
| 金額 | number | ✅ | `amount` |
| 中項目 | select | — | 勘定科目 (`midId`) |
| 摘要 | text | — | `description` |

#### 5. 業務ルール

##### 5.1 ステータス遷移

```
DRAFT (取込直後) ──[Transaction へ転記 (POST)]──> POSTED (資金繰り表反映済)
```

`postCardStatementsToTransaction()` で対象月の全 DRAFT 明細を引落日に集約した 1 行の `Transaction` として生成。明細は POSTED に更新。

##### 5.2 引落日への集約

カード 1 枚 × 月 1 つ → `Transaction` 1 件 (合計金額):
- 個別明細は `TransactionDetail` として保持
- 資金繰り表には 1 行で表示 (詳細は展開で確認)

##### 5.3 インポートバッチ

すべての取込操作は `ImportBatch` レコードを残す:
- 取込日時、ファイル名、件数、結果ステータス
- ロールバック可能 (バッチ単位で削除)

#### 6. 権限制御

| 操作 | ADMIN | OPERATOR | VIEWER |
|---|---|---|---|
| 表示 | ✅ | ✅ | ✅ |
| 明細入力 / 編集 | ✅ | ✅ | ❌ |
| 取込 | ✅ | ✅ | ❌ |
| カードマスタ | ✅ | ❌ | ❌ |
| Transaction へ転記 | ✅ | ❌ | ❌ |
| 削除 | ✅ | ❌ | ❌ |

#### 7. 使用 Server Actions

| 関数 | 役割 |
|---|---|
| `getCreditCards(companyId)` | カードマスタ一覧 |
| `createCreditCard({...})` | カード新規 |
| `updateCreditCard(id, data)` | カード更新 |
| `deleteCreditCard(id)` | カード削除 |
| `getCardStatements({companyId, creditCardId, yearMonth?})` | 明細一覧 |
| `updateCardStatement(id, data)` | 明細更新 |
| `deleteCardStatement(id)` | 明細削除 |
| `importCardStatements({...})` | CSV/Excel 取込 |
| `postCardStatementsToTransaction({creditCardId, yearMonth})` | 当月明細を Transaction へ転記 |

#### 8. データ連携先 (Prisma モデル)

| モデル | R | W | 役割 |
|---|---|---|---|
| `CardStatement` | ✅ | ✅ | カード利用明細 |
| `CreditCard` | ✅ | ✅ | カードマスタ |
| `ImportBatch` | ✅ | ✅ | 取込履歴 |
| `Account` | ✅ | — | 引落口座選択 |
| `TradingPartner` | ✅ | — | カード会社選択 |
| `Transaction` | — | ✅ | POST 時に引落 1 行を生成 |
| `TransactionDetail` | — | ✅ | 利用明細を子明細として保持 |
| `AccountCategoryMid` | ✅ | — | 中項目選択 |

##### 主な書き込みフィールド

**明細取込**:
```
ImportBatch { companyId, batchType=CARD, fileName, importedAt, count }
CardStatement[] {
  creditCardId, importBatchId, useDate, merchantName, amount,
  description?, midId?, status=DRAFT
}
```

**Transaction への転記**:
```
Transaction { type=EXPENSE, accountId=引落口座,
              amount=-合計金額, scheduledDate=引落日, paymentMethod=DIRECT_DEBIT }
TransactionDetail[] { 各 CardStatement を子明細化 }
CardStatement[].status=POSTED + transactionId=新規取引id
```

#### 9. 関連画面・連携

| 画面 | 連携内容 |
|---|---|
| [`/cashflow-table`](cashflow-table.md) | 引落日に集約された 1 行が反映 |
| [`/master/accounts`](master-accounts.md) | 引落口座マスタ |
| [`/master/partners`](master-partners.md) | カード会社マスタ |
| [`/master/categories`](master-categories.md) | 中項目選択 |

### 定期支払 (`/recurring`)

#### 1. 概要

毎月発生する固定・準固定取引のテンプレートを登録し、ボタン 1 つで翌月分の取引を一括生成する画面。経費入力の「固定 / 変動」タブの元となるテンプレートを管理する。

- ページ実体: [`app/(dashboard)/recurring/page.tsx`](../app/(dashboard)/recurring/page.tsx) (636行)
- 主アクション: [`app/actions/recurring.ts`](../app/actions/recurring.ts)

#### 2. URL とクエリパラメータ

| URL | 説明 |
|---|---|
| `/recurring` | デフォルト |

#### 3. 画面構成 (UI 詳細)

##### 3.1 ヘッダー

- タイトル「定期支払」 + 会社名
- 右上に `<CompanySwitcher />`
- 「+ 新規テンプレート」ボタン
- 「今月分を一括生成」ボタン

##### 3.2 テンプレート一覧テーブル

| 列 | 内容 |
|---|---|
| テンプレ名 | `name` |
| 区分 | 固定 / 変動 (`classification`) |
| 取引先 | `partner.name` |
| 中項目 | `mid.name` |
| 小項目 | `sub.name` |
| 口座 | `account.bankName` |
| 頻度 | MONTHLY / BIMONTHLY (奇/偶) / QUARTERLY / YEARLY / SPECIFIC_MONTHS |
| 支払日 | `paymentDay` |
| 休日調整 | NONE / PREV / NEXT |
| 金額タイプ | FIXED / VARIABLE / MANUAL |
| 金額 | (FIXED のみ表示) |
| 最終生成月 | `lastGeneratedMonth` |
| 有効 | `isActive` ✅ |
| 操作 | 編集 / 削除 |

##### 3.3 ダイアログ

| ダイアログ | 用途 |
|---|---|
| テンプレートフォーム | 新規 / 編集 |
| 一括生成プレビュー | 生成予定の取引一覧 → 確定 |

#### 4. 入力フォーム項目

| 項目 | 型 | 必須 | 説明 |
|---|---|---|---|
| テンプレ名 | text | ✅ | `name` |
| 区分 | select | ✅ | 固定 / 変動 (`classification`) |
| 取引先 | select | ✅ | `partnerId` |
| 中項目 | select | ✅ | `AccountCategoryMid` |
| 小項目 | select | — | 中項目に応じて候補 |
| 口座 | select | ✅ | `accountId` |
| 摘要 | text | — | `summary` |
| **頻度** | select | ✅ | MONTHLY / BIMONTHLY_ODD / BIMONTHLY_EVEN / QUARTERLY / YEARLY / SPECIFIC_MONTHS |
| 開始月 | month | ✅ | `startMonth` (生成開始の YYYY-MM) |
| 終了月 | month | — | `endMonth` (任意) |
| 特定月 (SPECIFIC のみ) | multi-select | △ | `specificMonths` (1-12 の配列) |
| 支払日 | number | ✅ | `paymentDay` (1-31 or 末) |
| 休日調整 | select | ✅ | NONE / PREV_BUSINESS_DAY / NEXT_BUSINESS_DAY |
| **金額タイプ** | select | ✅ | FIXED / VARIABLE / MANUAL |
| 金額 | number | △ | FIXED 時に入力 (`amount`) |

#### 5. 頻度設定 (`frequency`)

| 値 | 説明 |
|---|---|
| `MONTHLY` | 毎月 |
| `BIMONTHLY_ODD` | 隔月 (奇数月: 1,3,5,7,9,11) |
| `BIMONTHLY_EVEN` | 隔月 (偶数月: 2,4,6,8,10,12) |
| `QUARTERLY` | 四半期 (1,4,7,10 等の 3 ヶ月おき) |
| `YEARLY` | 年次 |
| `SPECIFIC_MONTHS` | 特定月のみ (`specificMonths` で指定) |

#### 6. 金額設定 (`amountType`)

| 値 | 説明 |
|---|---|
| `FIXED` | 固定額。テンプレに金額を保持 |
| `VARIABLE` | 変動 (前月コピー)。生成時に前月実績から自動転記 |
| `MANUAL` | 手入力。生成時は 0 円、後で手入力 |

#### 7. 業務ルール

##### 7.1 月初一括生成

`generateRecurringTransactions(companyId, yearMonth)`:
1. 該当月に生成すべき (頻度マッチ) テンプレートを抽出
2. 重複防止: `lastGeneratedMonth >= yearMonth` のものはスキップ
3. 各テンプレートから `Transaction` + `TransactionDetail` を生成 (status=DRAFT)
4. テンプレートの `lastGeneratedMonth` を更新

##### 7.2 自動一括生成 (バッチ用)

`autoGenerateRecurringTransactions(companyId)`:
- 当月分を全社一括生成 (cron バッチで毎月 1 日に実行想定)

##### 7.3 休日調整 (`holidayAdjust`)

- `NONE`: 調整なし
- `PREV_BUSINESS_DAY`: 休日なら前営業日
- `NEXT_BUSINESS_DAY`: 休日なら翌営業日

日本祝日対応 (内部ライブラリ or `lib/format.ts`)。

##### 7.4 変動金額の自動転記

`amountType=VARIABLE` のとき:
- 生成時に前月の同テンプレ由来 `Transaction.amount` を引き継ぐ
- 前月実績がなければ 0 円

##### 7.5 期限超過の検知

`lastGeneratedMonth` と現在月を比較:
- 超過しているテンプレは赤色表示
- 「支払漏れ検知一覧」を別カードで表示

#### 8. 権限制御

| 操作 | ADMIN | OPERATOR | VIEWER |
|---|---|---|---|
| 表示 | ✅ | ✅ | ✅ |
| 新規 / 編集 | ✅ | ✅ | ❌ |
| 削除 | ✅ | ❌ | ❌ |
| 一括生成 | ✅ | ✅ | ❌ |

#### 9. 使用 Server Actions

| 関数 | 役割 |
|---|---|
| `getRecurringTemplates(companyId)` | 一覧 |
| `createRecurringTemplate({...})` | 新規 |
| `updateRecurringTemplate(id, data)` | 更新 |
| `deleteRecurringTemplate(id, companyId)` | 削除 |
| `generateRecurringTransactions(companyId, yearMonth)` | 月次一括生成 (手動) |
| `autoGenerateRecurringTransactions(companyId)` | 月次一括生成 (自動) |
| `getExpenseTemplates(companyId)` | 経費入力画面用の固定/変動テンプレ取得 |

#### 10. データ連携先 (Prisma モデル)

| モデル | R | W | 役割 |
|---|---|---|---|
| `RecurringTemplate` | ✅ | ✅ | テンプレート定義・`lastGeneratedMonth` |
| `Transaction` | — | ✅ | 月次一括生成の出力先 (未確定) |
| `TransactionDetail` | — | ✅ | 自動生成された子明細 |
| `Company` | ✅ | — | 会社マスタ |
| `Account` | ✅ | — | 口座マスタ |
| `TradingPartner` | ✅ | — | 取引先マスタ |
| `AccountCategoryMid` / `AccountCategorySub` | ✅ | — | 科目マスタ |

##### 主な書き込みフィールド

**新規テンプレート**:
```
RecurringTemplate {
  companyId, name, classification (FIXED/VARIABLE),
  partnerId, midId, subId, accountId,
  frequency, specificMonths?, startMonth, endMonth?,
  paymentDay, holidayAdjust,
  amountType (FIXED/VARIABLE/MANUAL), amount?,
  summary?, isActive=true, lastGeneratedMonth=null
}
```

**月次生成**:
```
For each matching template:
  Transaction {
    companyId, type=EXPENSE, accountId, partnerId,
    scheduledDate=計算日 (paymentDay + 休日調整),
    accountingMonth=yearMonth, amount=-X,
    classification, recurringTemplateId=templateId,
    status=DRAFT
  }
  TransactionDetail { midId, subId?, amount=-X }
  
RecurringTemplate.lastGeneratedMonth = yearMonth (更新)
```

#### 11. エラー / アラート

| シナリオ | メッセージ |
|---|---|
| 二重生成試行 | スキップ (`lastGeneratedMonth >= yearMonth` のもの) |
| 開始月未到達のテンプレ | スキップ |
| 終了月超過のテンプレ | スキップ |

#### 12. 関連画面・連携

| 画面 | 連携内容 |
|---|---|
| [`/expenses`](expenses.md) | 「固定」「変動」タブで生成済みのテンプレ由来取引を表示。「繰返登録済」「前月数値」バッジ判定の元 |
| [`/cashflow-table`](cashflow-table.md) | 生成された取引が反映 |
| [`/master/categories`](master-categories.md) | 科目マスタ |
| [`/master/partners`](master-partners.md) | 取引先マスタ |
| [`/master/accounts`](master-accounts.md) | 口座マスタ |

## E. マスタ (11画面)


### 会社一覧 (`/master/companies`)

#### 1. 概要

グループ各社 (自社利用) の基本情報を登録・編集するマスタ画面。請求書・帳票・FB 出力・資金繰り・権限割当の基礎となる。

- ページ実体: [`app/(dashboard)/master/companies/page.tsx`](../app/(dashboard)/master/companies/page.tsx) (325行)
- 主アクション: [`app/actions/companies.ts`](../app/actions/companies.ts)

#### 2. URL とクエリパラメータ

| URL | 説明 |
|---|---|
| `/master/companies` | 一覧 + 編集 |

#### 3. 画面構成 (UI 詳細)

##### 3.1 ヘッダー

- タイトル「会社一覧」
- 右上に `<CompanySwitcher />`

##### 3.2 一覧テーブル

| 列 | 内容 |
|---|---|
| 会社名 | `name` |
| フリガナ | `nameKana` |
| 略称 | `shortName` |
| 業種 | `industryMaster.name` |
| 代表者 | `representativeTitle` + `representativeName` |
| 決算月 | `fiscalMonth` 月 |
| メイン口座 | (連携表示) |
| ステータス | ACTIVE / DORMANT / LIQUIDATING |
| 操作 | 編集 |

##### 3.3 編集ダイアログ (大判)

**基本情報** (3列レイアウト):
- 会社名 / フリガナ / 略称
- 代表者役職 / 代表者氏名
- 業種 / 決算月 / ステータス

**住所** (3列):
- 郵便番号 / 都道府県 / 市区町村 / 番地 / 建物名

**連絡先** (3列):
- 電話 / FAX / メール / Web

**税務情報** (3列):
- 法人番号 (13桁) / インボイス登録番号 / **e-Tax 利用者識別番号**

**追加情報** (3列):
- **資本金 (円)** / **経理担当者** / 設立日

**備考**: textarea

#### 4. 入力フォーム項目

##### 4.1 必須項目

| 項目 | 型 | 説明 |
|---|---|---|
| 会社名 | text | `name` |
| 会社名フリガナ | text | `nameKana` |
| 業種 | select | `industryMasterId` |
| 代表者役職 | text | `representativeTitle` |
| 代表者氏名 | text | `representativeName` |
| 郵便番号 | text | `postalCode` |
| 都道府県 | text | `addressPrefecture` |
| 市区町村 | text | `addressCity` |
| 番地 | text | `addressStreet` |
| 電話番号 | text | `phone` |
| インボイス登録番号 | text | `invoiceNumber` |
| 決算月 | number | `fiscalMonth` (1-12) |
| メイン口座 | (口座マスタで指定) | `mainAccountId` |

##### 4.2 任意項目

| 項目 | 型 | 説明 |
|---|---|---|
| 建物名 | text | `addressBuilding` |
| FAX 番号 | text | `fax` |
| メール | email | `email` |
| Web URL | url | `website` |
| 略称 | text | `shortName` (帳票表示) |
| 法人番号 | text (13桁) | `corporateNumber` |
| **e-Tax 番号** | text | `eTaxNumber` (PDF P1 追加) |
| **資本金 (円)** | number (BigInt) | `capitalAmount` (PDF P1 追加) |
| **経理担当者** | text | `accountingManager` (PDF P1 追加) |
| 設立日 | date | `establishedDate` |
| ステータス | select | `status` (ACTIVE/DORMANT/LIQUIDATING) |
| 備考 | textarea | `notes` |

#### 5. 業務ルール

##### 5.1 削除制約

- データ紐づけが無い会社のみ削除可能
- 取引・口座・マスタ参照がある場合は削除不可
- → 利用停止 (`status=DORMANT`) で運用

##### 5.2 メイン口座

- 会社あたり原則 1 つ (会社マスタで必須)
- 口座マスタ (`/master/accounts`) で「メイン口座」役割を持つ口座から自動判定

##### 5.3 必須フィールド警告

`invoiceNumber` や `eTaxNumber` は税務上必須だが、入力なしでも保存可能 (警告のみ)。

#### 6. 権限制御

| 操作 | ADMIN | OPERATOR | VIEWER |
|---|---|---|---|
| 表示 | ✅ | ✅ | ✅ |
| 編集 | ✅ | ❌ | ❌ |
| 新規 | ✅ | ❌ | ❌ |
| 削除 | ✅ | ❌ | ❌ |

#### 7. 使用 Server Actions

| 関数 | 役割 |
|---|---|
| `getCompanies()` | 全社一覧 |
| `getCompany(id)` | 1 社取得 |
| `updateCompany(id, data)` | 更新 (新規は seed で投入) |
| `getCompanyInfoSummary(companyId)` | 資金繰り表の会社情報カード用 |
| `getIndustries()` | 業種選択肢 |

#### 8. データ連携先 (Prisma モデル)

| モデル | R | W | 役割 |
|---|---|---|---|
| `Company` | ✅ | ✅ | 会社マスタ本体 |
| `IndustryMaster` | ✅ | — | 業種参照 |
| `Account` | ✅ | — | メイン口座の決定参照 |

##### 主な書き込みフィールド (updateCompany)

```
Company {
  name, nameKana, shortName, industryMasterId,
  representativeTitle, representativeName,
  postalCode, addressPrefecture, addressCity, addressStreet, addressBuilding,
  phone, fax, email, website,
  corporateNumber, invoiceNumber,
  eTaxNumber, capitalAmount (BigInt), accountingManager,  // PDF P1 追加
  fiscalMonth, establishedDate, status, notes
}
```

`capitalAmount` は文字列入力 → BigInt 変換 (`BigInt(String(capitalAmount).replace(/[^\d-]/g, "") || "0")`)。

#### 9. 関連画面・連携

| 画面 | 連携内容 |
|---|---|
| [`/dashboard`](dashboard.md) | メイン口座・industryType の表示元 |
| [`/cashflow-table`](cashflow-table.md) | 会社情報カードの表示元 |
| [`/master/industries`](master-industries.md) | 業種マスタ |
| [`/master/accounts`](master-accounts.md) | 口座マスタ |
| [`/master/company-groups`](master-company-groups.md) | グループ所属の管理 |

### 会社グループ (`/master/company-groups`)

#### 1. 概要

会社を複数のグループにまとめるマスタ画面 (例: 建設業 7 社 / 広告業 2 社 / その他 3 社)。ダッシュボードや `/group-summary` のタイル集計で利用される。

- ページ実体: [`app/(dashboard)/master/company-groups/page.tsx`](../app/(dashboard)/master/company-groups/page.tsx) (367行)
- 主アクション: [`app/actions/company-groups.ts`](../app/actions/company-groups.ts)

#### 2. URL とクエリパラメータ

| URL | 説明 |
|---|---|
| `/master/company-groups` | 一覧 + 編集 |

#### 3. 画面構成 (UI 詳細)

##### 3.1 ヘッダー

- タイトル「会社グループ」
- 「+ 新規グループ」ボタン

##### 3.2 グループ一覧テーブル

| 列 | 内容 |
|---|---|
| 名前 | `name` |
| 略称 | `shortName` |
| カラー | `colorCode` (色付きのドット) |
| 表示順 | `displayOrder` |
| 会社数 | メンバー会社数 |
| 有効 | `isActive` ✅ |
| 操作 | メンバー編集 / 編集 / 削除 |

##### 3.3 ダイアログ

| ダイアログ | 用途 |
|---|---|
| グループフォーム | 名前 / 略称 / 色 / 表示順 / 有効 |
| メンバー編集 | グループに会社を所属させる (`setGroupMembers`) |

#### 4. 入力フォーム項目

##### 4.1 グループ

| 項目 | 型 | 必須 | 説明 |
|---|---|---|---|
| 名前 | text | ✅ | `name` (例: 建設業) |
| 略称 | text | — | `shortName` (例: 建設) |
| カラーコード | color | — | `colorCode` (#RRGGBB) |
| 表示順 | number | ✅ | `displayOrder` |
| 有効 | switch | — | `isActive` |

##### 4.2 メンバー編集

- 全社の一覧 (チェックボックス)
- チェック ON で `CompanyGroupMember` に INSERT
- チェック OFF で削除
- 1 社が複数グループに所属可能 (多対多)

#### 5. 業務ルール

##### 5.1 用途

- ダッシュボードのグループ別タイル集計
- グループ間取引 (`/inter-group`) の対象判定

##### 5.2 削除制約

- メンバーが存在しても削除可能 (`CompanyGroupMember` は cascade で削除)
- ただし他の機能で参照されている場合は無効化推奨

#### 6. 権限制御

| 操作 | ADMIN | OPERATOR | VIEWER |
|---|---|---|---|
| 表示 | ✅ | ✅ | ✅ |
| 新規 / 編集 / 削除 | ✅ | ❌ | ❌ |
| メンバー編集 | ✅ | ❌ | ❌ |

#### 7. 使用 Server Actions

| 関数 | 役割 |
|---|---|
| `getCompanyGroups()` | 一覧 (メンバー数付き) |
| `getCompanyGroupsWithCompanies()` | メンバー会社の詳細付き一覧 |
| `createCompanyGroup({name, shortName?, colorCode?, displayOrder})` | 新規 |
| `updateCompanyGroup(id, data)` | 更新 |
| `deleteCompanyGroup(id)` | 削除 |
| `setGroupMembers(groupId, companyIds[])` | メンバー一括設定 (差分検出して INSERT/DELETE) |
| `getCompanies()` | メンバー編集の候補一覧 |

#### 8. データ連携先 (Prisma モデル)

| モデル | R | W | 役割 |
|---|---|---|---|
| `CompanyGroup` | ✅ | ✅ | グループ定義 |
| `CompanyGroupMember` | ✅ | ✅ | グループ ↔ 会社の中間テーブル |
| `Company` | ✅ | — | 会社一覧の参照 |

##### 主な書き込みフィールド

```
CompanyGroup { name, shortName, colorCode, displayOrder, isActive }
CompanyGroupMember[] { groupId, companyId }
```

#### 9. 関連画面・連携

| 画面 | 連携内容 |
|---|---|
| [`/dashboard`](dashboard.md) | グループ別タイルで利用 |
| [`/group-summary`](group-summary.md) | グループ集計の表示元 |
| [`/inter-group`](inter-group.md) | グループ間取引の対象判定 |

### 銀行口座 (`/master/accounts`)

#### 1. 概要

各会社の銀行口座を登録・編集するマスタ画面。普通預金・定期預金・社会保険積立 (仮想口座)・消費税積立 (仮想口座) の 4 種別を管理する。

- ページ実体: [`app/(dashboard)/master/accounts/page.tsx`](../app/(dashboard)/master/accounts/page.tsx) (248行)
- 主アクション: [`app/actions/accounts.ts`](../app/actions/accounts.ts)

#### 2. URL とクエリパラメータ

| URL | 説明 |
|---|---|
| `/master/accounts` | 一覧 + 編集 |

#### 3. 画面構成 (UI 詳細)

##### 3.1 ヘッダー

- タイトル「銀行口座」 + 会社名
- 右上に `<CompanySwitcher />`
- 「+ 新規口座」ボタン

##### 3.2 口座一覧テーブル

| 列 | 内容 |
|---|---|
| 銀行 | `bankName` (+ コード) |
| 支店 | `branchName` (+ コード) |
| 種別 | Badge (普通/定期/社保積立/消費税積立) |
| 口座番号 | `accountNumber` |
| 名義 | `accountHolder` |
| 役割 | Badge (メイン / 支払 / 給与 / 仮想) |
| 表示順 | `displayOrder` |
| 有効 | `isActive` ✅ |
| 非表示 | `isHidden` ✅ |
| 操作 | 編集 / 有効切替 |

##### 3.3 ダイアログ

| ダイアログ | 用途 |
|---|---|
| 口座フォーム | 新規 / 編集 |

#### 4. 口座種別 (`accountType`)

| 値 | ラベル | 説明 |
|---|---|---|
| `ORDINARY` | 普通預金 | 通常口座 |
| `SAVINGS` | 定期預金 | 定期口座 |
| `SOCIAL_INSURANCE_RESERVE` | 社会保険積立 | 仮想口座 |
| `CONSUMPTION_TAX_RESERVE` | 消費税積立 | 仮想口座 |

仮想口座は会社ごとに自動付与 (シードで作成)。

#### 5. 入力フォーム項目

| 項目 | 型 | 必須 | 説明 |
|---|---|---|---|
| 銀行コード | text | △ | `bankCode` (検索) |
| 銀行名 | text | ✅ | `bankName` |
| 支店コード | text | △ | `branchCode` |
| 支店名 | text | ✅ | `branchName` |
| 口座種別 | select | ✅ | `accountType` (4 種) |
| 口座番号 | text | ✅ | `accountNumber` |
| 名義カナ | text | ✅ | `accountHolder` (半角カナ) |
| 表示順 | number | ✅ | `displayOrder` |
| 有効 | switch | — | `isActive` |
| 非表示 | switch | — | `isHidden` (普段の候補から除外) |
| メイン口座 | switch | — | 会社のメイン口座フラグ |
| FB 出力設定 | (詳細) | — | 依頼人コード / 委託者コード等 (用途別) |

##### FB 出力設定 (オプション)

| 項目 | 説明 |
|---|---|
| 用途 | TRANSFER (総合振込) / SALARY (給与) / BONUS (賞与) |
| 依頼人コード | 振込依頼人コード |
| 委託者コード | 委託者コード |

#### 6. 業務ルール

##### 6.1 役割 (`AccountRole`)

口座は複数の役割を持てる (多対多):
- メイン口座 (会社あたり原則 1 つ)
- 支払口座 (複数可)
- 給与口座
- 仮想口座 (社保 / 消費税)

デフォルト役割を用意し、表示名変更・追加・利用停止が可能 (内部キー固定 + 追加は自社キー)。

##### 6.2 仮想口座

- 会社作成時に自動付与 (シード処理)
- 通常は非表示 (`isHidden=true`)
- 必要時のみ表示

##### 6.3 無効化と非表示

- `isActive=false`: 新規候補から除外、過去取引は閲覧可
- `isHidden=true`: 普段の候補から除外、フィルタで表示可

#### 7. 権限制御

| 操作 | ADMIN | OPERATOR | VIEWER |
|---|---|---|---|
| 表示 | ✅ | ✅ | ✅ |
| 新規 / 編集 | ✅ | ❌ | ❌ |
| 有効切替 | ✅ | ❌ | ❌ |

#### 8. 使用 Server Actions

| 関数 | 役割 |
|---|---|
| `getAccounts(companyId)` | 会社の口座一覧 |
| `createAccount({...})` | 新規 |
| `updateAccount(id, data)` | 更新 |
| `toggleAccountActive(id)` | 有効/無効の切替 |

#### 9. データ連携先 (Prisma モデル)

| モデル | R | W | 役割 |
|---|---|---|---|
| `Account` | ✅ | ✅ | 口座本体 |
| `AccountRole` | ✅ | ✅ | 役割 (複数選択可) |
| `Company` | ✅ | — | 会社マスタ参照 |
| `BankMaster` / `BranchMaster` | ✅ | — | コード検索 |

##### 主な書き込みフィールド

```
Account {
  companyId, bankCode, bankName, branchCode, branchName,
  accountType (ORDINARY|SAVINGS|SOCIAL_INSURANCE_RESERVE|CONSUMPTION_TAX_RESERVE),
  accountNumber, accountHolder, displayOrder,
  isActive, isHidden, isMain,
  fbSettings (JSON)
}
AccountRole[] { accountId, role }
```

#### 10. 関連画面・連携

| 画面 | 連携内容 |
|---|---|
| [`/cashflow-table`](cashflow-table.md) | 口座選択 |
| [`/master/companies`](master-companies.md) | メイン口座指定 |
| [`/cashflow`](cashflow.md) | 資金移動の振替元・先 |
| [`/master/banks`](master-banks.md) | 銀行・支店マスタの検索元 |

### 銀行・支店 (`/master/banks`)

#### 1. 概要

全銀協データから取り込んだ銀行・支店マスタを閲覧・編集する画面。FB 出力や振込先口座入力時の銀行/支店コード検索に利用される。

> 現状サイドメニューには表示されておらず、URL `/master/banks` で直接アクセスする運用 (参照用)。

- ページ実体: [`app/(dashboard)/master/banks/page.tsx`](../app/(dashboard)/master/banks/page.tsx) (318行)
- 主アクション: [`app/actions/bank-masters.ts`](../app/actions/bank-masters.ts)

#### 2. URL とクエリパラメータ

| URL | 説明 |
|---|---|
| `/master/banks` | 一覧 + 検索 |

#### 3. 画面構成 (UI 詳細)

##### 3.1 ヘッダー

- タイトル「銀行・支店マスタ」
- 「+ 新規銀行」ボタン

##### 3.2 銀行検索

| 項目 | 説明 |
|---|---|
| キーワード | 銀行名 / コードで部分一致 |

##### 3.3 銀行一覧テーブル

| 列 | 内容 |
|---|---|
| コード | `bankCode` (4 桁) |
| 銀行名 | `bankName` |
| カナ | `bankNameKana` |
| 支店数 | (連携カウント) |
| 操作 | 支店一覧 / 編集 |

##### 3.4 支店一覧 (銀行選択後)

| 列 | 内容 |
|---|---|
| 支店コード | `branchCode` (3 桁) |
| 支店名 | `branchName` |
| カナ | `branchNameKana` |
| 操作 | 編集 |

##### 3.5 ダイアログ

| ダイアログ | 用途 |
|---|---|
| 銀行フォーム | 新規 / 編集 |
| 支店フォーム | 新規 / 編集 |
| 主要銀行シード | 初期データの一括投入 (`seedMajorBanks`) |

#### 4. 入力フォーム項目

##### 4.1 銀行

| 項目 | 型 | 必須 | 説明 |
|---|---|---|---|
| 銀行コード | text (4桁) | ✅ | `bankCode` |
| 銀行名 | text | ✅ | `bankName` |
| カナ | text | — | `bankNameKana` |

##### 4.2 支店

| 項目 | 型 | 必須 | 説明 |
|---|---|---|---|
| 銀行 | (固定) | ✅ | `bankCode` |
| 支店コード | text (3桁) | ✅ | `branchCode` |
| 支店名 | text | ✅ | `branchName` |
| カナ | text | — | `branchNameKana` |

#### 5. 業務ルール

##### 5.1 初期データ

- 全銀協データを基にした主要銀行のシードあり (`seedMajorBanks`)
- ゆうちょ等の特殊口座にも対応

##### 5.2 検索

- `getBanks(query)`: 銀行名/コードで部分一致
- `getBankWithBranches(bankCode)`: 銀行 + 配下の支店すべて
- `searchBranches(bankCode, query)`: 支店検索

##### 5.3 編集の用途

- 振込先口座入力時のサジェスト
- FB 出力時のコード参照

#### 6. 権限制御

| 操作 | ADMIN | OPERATOR | VIEWER |
|---|---|---|---|
| 表示 | ✅ | ✅ | ✅ |
| 新規 / 編集 | ✅ | ❌ | ❌ |
| シード一括投入 | ✅ | ❌ | ❌ |

#### 7. 使用 Server Actions

| 関数 | 役割 |
|---|---|
| `getBanks(query?)` | 銀行検索 |
| `getBankWithBranches(bankCode)` | 銀行 + 支店一覧 |
| `searchBranches(bankCode, query?)` | 支店検索 |
| `createBank({...})` | 銀行新規 |
| `updateBank(bankCode, data)` | 銀行更新 |
| `createBranch({...})` | 支店新規 |
| `updateBranch(bankCode, branchCode, data)` | 支店更新 |
| `seedMajorBanks()` | 主要銀行シード一括投入 |

#### 8. データ連携先 (Prisma モデル)

| モデル | R | W | 役割 |
|---|---|---|---|
| `BankMaster` | ✅ | ✅ | 銀行マスタ |
| `BranchMaster` | ✅ | ✅ | 支店マスタ |

##### 主な書き込みフィールド

```
BankMaster { bankCode, bankName, bankNameKana }
BranchMaster { bankCode, branchCode, branchName, branchNameKana }
```

#### 9. 関連画面・連携

| 画面 | 連携内容 |
|---|---|
| [`/master/accounts`](master-accounts.md) | 自社口座の銀行/支店選択 |
| [`/master/partners`](master-partners.md) | 取引先口座の銀行/支店選択 |

#### 10. 注意事項

- サイドバーには表示されない (URL 直接アクセス)
- 初期データは `seedMajorBanks()` または手動入力で投入
- 編集は慎重に (全銀協公式コードを変更すると振込で問題発生)

### 業種 (`/master/industries`)

#### 1. 概要

会社マスタで使用する業種 (建設業・広告業・その他等) を管理するマスタ画面。

- ページ実体: [`app/(dashboard)/master/industries/page.tsx`](../app/(dashboard)/master/industries/page.tsx) (256行)
- 主アクション: [`app/actions/industries.ts`](../app/actions/industries.ts)

#### 2. URL とクエリパラメータ

| URL | 説明 |
|---|---|
| `/master/industries` | 一覧 + 編集 |

#### 3. 画面構成 (UI 詳細)

##### 3.1 ヘッダー

- タイトル「業種」
- 「+ 新規業種」ボタン

##### 3.2 一覧テーブル

| 列 | 内容 |
|---|---|
| 名前 | `name` |
| 略称 | `shortName` |
| 表示順 | `displayOrder` |
| 使用中会社数 | (連携カウント) |
| 有効 | `isActive` |
| 操作 | 編集 / 削除 |

##### 3.3 ダイアログ

| ダイアログ | 用途 |
|---|---|
| 業種フォーム | 新規 / 編集 |

#### 4. 入力フォーム項目

| 項目 | 型 | 必須 | 説明 |
|---|---|---|---|
| 名前 | text | ✅ | `name` (例: 建設業) |
| 略称 | text | — | `shortName` (例: 建設) |
| 表示順 | number | ✅ | `displayOrder` |
| 有効 | switch | — | `isActive` |

#### 5. 業務ルール

##### 5.1 初期データ (12 社)

- 建設業: 起工業、起グループ、松村建設、佐藤建設工業、吉川建設、建設サポート、エイトグループ (7 社)
- 広告業: WINNERS、CAREECH (2 社)
- その他: WINNERS CLUB、G-FARM、インフィニティグループ (3 社)

##### 5.2 削除制約

- 使用中の業種は削除不可
- → 利用停止 (`isActive=false`) で運用

#### 6. 権限制御

| 操作 | ADMIN | OPERATOR | VIEWER |
|---|---|---|---|
| 表示 | ✅ | ✅ | ✅ |
| 新規 / 編集 / 削除 | ✅ | ❌ | ❌ |

#### 7. 使用 Server Actions

| 関数 | 役割 |
|---|---|
| `getIndustries()` | 一覧 |
| `createIndustry({name, shortName?, displayOrder})` | 新規 |
| `updateIndustry(id, data)` | 更新 |
| `deleteIndustry(id)` | 削除 (使用中チェック) |

#### 8. データ連携先 (Prisma モデル)

| モデル | R | W | 役割 |
|---|---|---|---|
| `IndustryMaster` | ✅ | ✅ | 業種マスタ |
| `Company` | ✅ | — | 業種使用中チェック |

##### 主な書き込みフィールド

```
IndustryMaster { name, shortName, displayOrder, isActive }
```

#### 9. 関連画面・連携

| 画面 | 連携内容 |
|---|---|
| [`/master/companies`](master-companies.md) | 業種選択 |

### 売上項目 (`/master/sales-items`)

#### 1. 概要

売上の内訳項目 (例: 工事種別、商品カテゴリ等) を管理するマスタ画面。会社別に利用可能項目を制限できる。

- ページ実体: [`app/(dashboard)/master/sales-items/page.tsx`](../app/(dashboard)/master/sales-items/page.tsx) (341行)
- 主アクション: [`app/actions/sales-items.ts`](../app/actions/sales-items.ts)

#### 2. URL とクエリパラメータ

| URL | 説明 |
|---|---|
| `/master/sales-items` | 一覧 + 編集 |

#### 3. 画面構成 (UI 詳細)

##### 3.1 ヘッダー

- タイトル「売上項目」
- 「+ 新規項目」ボタン

##### 3.2 一覧テーブル

| 列 | 内容 |
|---|---|
| 名前 | `name` |
| 略称 | `shortName` |
| 適用会社 | バッジ (空 = 全社) |
| 表示順 | `displayOrder` |
| 有効 | `isActive` |
| 操作 | 編集 / 削除 |

##### 3.3 ダイアログ

| ダイアログ | 用途 |
|---|---|
| 売上項目フォーム | 新規 / 編集 + 適用会社チェックボックス一覧 |

#### 4. 入力フォーム項目

| 項目 | 型 | 必須 | 説明 |
|---|---|---|---|
| 名前 | text | ✅ | `name` |
| 略称 | text | — | `shortName` |
| 表示順 | number | ✅ | `displayOrder` |
| 有効 | switch | — | `isActive` |
| 適用会社 | checkbox[] | — | `applicableCompanyIds` (空 = 全社対象) |

#### 5. 業務ルール

##### 5.1 適用会社の制限

- `applicableCompanyIds` をカンマ区切り文字列で保持
- 空 → 全社対象
- 値あり → そのIDの会社でのみ利用可能

##### 5.2 会社別の利用可能項目取得

`getSalesItemsForCompany(companyId)`:
```ts
SalesItemMaster.filter(item =>
  !item.applicableCompanyIds  // 全社対象
  || item.applicableCompanyIds.split(",").includes(companyId)
)
```

##### 5.3 削除制約

- 使用中の項目は削除不可 (将来実装)
- 現状は無効化 (`isActive=false`) を推奨

#### 6. 権限制御

| 操作 | ADMIN | OPERATOR | VIEWER |
|---|---|---|---|
| 表示 | ✅ | ✅ | ✅ |
| 新規 / 編集 / 削除 | ✅ | ❌ | ❌ |

#### 7. 使用 Server Actions

| 関数 | 役割 |
|---|---|
| `getSalesItems()` | 全項目 |
| `getSalesItemsForCompany(companyId)` | 会社別利用可能項目 |
| `createSalesItem({...})` | 新規 |
| `updateSalesItem(id, data)` | 更新 |
| `deleteSalesItem(id)` | 削除 |
| `getCompanies()` | 適用会社選択 |

#### 8. データ連携先 (Prisma モデル)

| モデル | R | W | 役割 |
|---|---|---|---|
| `SalesItemMaster` | ✅ | ✅ | 売上項目本体 |
| `Company` | ✅ | — | 適用会社の表示用 |

##### 主な書き込みフィールド

```
SalesItemMaster {
  name, shortName?, displayOrder, isActive,
  applicableCompanyIds (string, カンマ区切り or 空)
}
```

#### 9. 関連画面・連携

| 画面 | 連携内容 |
|---|---|
| [`/sales`](sales.md) | 売上入力時の項目選択 (将来) |
| [`/master/companies`](master-companies.md) | 適用会社マスタ |

### 取引先 (`/master/partners`)

#### 1. 概要

取引先 (顧客・協力会社・経費・銀行・グループ会社・その他) を一元管理するマスタ画面。取引先タグ・銀行口座・地点 (現場) を子テーブルで保持する。

- ページ実体: [`app/(dashboard)/master/partners/page.tsx`](../app/(dashboard)/master/partners/page.tsx) (572行)
- 主アクション: [`app/actions/partners.ts`](../app/actions/partners.ts)
- 銀行口座: [`app/actions/partner-bank-accounts.ts`](../app/actions/partner-bank-accounts.ts)
- 地点: [`app/actions/partner-sites.ts`](../app/actions/partner-sites.ts)

#### 2. URL とクエリパラメータ

| URL | 説明 |
|---|---|
| `/master/partners` | 一覧 + 編集 |

#### 3. 画面構成 (UI 詳細)

##### 3.1 ヘッダー

- タイトル「取引先」 + 会社名
- 右上に `<CompanySwitcher />`
- 「+ 新規取引先」ボタン

##### 3.2 フィルタ

| 項目 | 説明 |
|---|---|
| タグ | ALL / 顧客 / 協力会社 / 経費 / 銀行 / グループ会社 / その他 |
| 種別 | ALL / CUSTOMER / SUPPLIER / BOTH |
| キーワード | 名前 / フリガナで部分一致 |

##### 3.3 一覧テーブル

| 列 | 内容 |
|---|---|
| 名前 | `name` |
| フリガナ | `nameKana` |
| タグ | Badge (顧客/協力会社/経費/銀行/グループ会社/その他) |
| 種別 | CUSTOMER / SUPPLIER / BOTH |
| デフォルト科目 | `defaults[0].mid.name` (+ subName) |
| 銀行口座数 | (連携カウント) |
| 地点数 | (連携カウント) |
| 有効 | `isActive` ✅ |
| 操作 | 編集 / 銀行口座 / 地点 / 有効切替 |

##### 3.4 ダイアログ

| ダイアログ | 用途 |
|---|---|
| 取引先フォーム | 名称・タグ・種別・デフォルト科目 |
| 銀行口座管理 | 取引先の振込先口座を複数管理 |
| 地点管理 | 取引先配下の地点 (物件) 管理 |

#### 4. タグ・種別

##### 4.1 タグ (`tagKey`, 固定)

| 内部キー | 表示名 (変更可) | 用途 |
|---|---|---|
| `CUSTOMER` | 顧客 | 売上の請求先 |
| `SUPPLIER` | 協力会社 | 経費・原価支払の支払先 |
| `EXPENSE` | 経費 | 経費中心の取引先 |
| `BANK` | 銀行 | 借入先・金融機関 |
| `GROUP_COMPANY` | グループ会社 | 同一取引先マスタ内のグループ会社 |
| `OTHER` | その他 | 上記以外 |

表示名は管理者が任意に変更可能 (例: 顧客→元請/親会社)。

##### 4.2 種別 (`type`, `TradingPartnerType`)

| 値 | 説明 |
|---|---|
| `CUSTOMER` | 請求先 (売上) |
| `SUPPLIER` | 支払先 (経費/原価) |
| `BOTH` | 請求先 + 支払先 (両方) |

#### 5. 入力フォーム項目

##### 5.1 取引先 (親)

| 項目 | 型 | 必須 | 説明 |
|---|---|---|---|
| 名前 | text | ✅ | `name` |
| フリガナ | text | — | `nameKana` |
| タグ | select | ✅ | `tagKey` (固定 6 種) |
| 種別 | select | ✅ | `type` (CUSTOMER/SUPPLIER/BOTH) |
| デフォルト中項目 | select | — | `TradingPartnerDefault.midId` |
| デフォルト小項目 | select | — | `TradingPartnerDefault.subId` |
| 備考 | textarea | — | `notes` |

##### 5.2 銀行口座 (子)

| 項目 | 型 | 必須 | 説明 |
|---|---|---|---|
| 銀行コード | text | ✅ | `bankCode` (検索) |
| 銀行名 | text | ✅ | `bankName` |
| 支店コード | text | ✅ | `branchCode` |
| 支店名 | text | ✅ | `branchName` |
| 口座種別 | select | ✅ | ORDINARY / CURRENT |
| 口座番号 | text | ✅ | `accountNumber` |
| 名義カナ | text | ✅ | `accountHolder` (半角カナ) |
| 有効 | switch | — | `isActive` (利用停止で履歴保持) |

##### 5.3 地点 (子)

| 項目 | 型 | 必須 | 説明 |
|---|---|---|---|
| 地点名 | text | ✅ | `siteName` (物件名等) |
| 周期 | select | — | MONTHLY / BIMONTHLY_ODD / BIMONTHLY_EVEN / QUARTERLY / SPECIFIC |
| 予定日ルール | select | — | END_OF_MONTH / SPECIFIC_DAY (`paymentDay`) |
| 休日調整 | select | — | NONE / PREV / NEXT |
| 担当者 | text | — | `assignedTo` |
| 有効 | switch | — | |

#### 6. 業務ルール

##### 6.1 権限による候補絞り込み

- 売上担当: タグ「顧客」中心の取引先のみサジェスト
- 経費担当: タグ「経費」中心の取引先のみ
- 管理者: 全件

タブ増殖を避ける設計。

##### 6.2 振込先口座の複数登録

- 取引先 1 件に複数銀行口座を登録可
- 必須: 銀行/支店コード、種別、口座番号、名義カナ (半角)
- 無効化 (`isActive=false`) で履歴保持

##### 6.3 地点 (物件) テンプレ

- 家賃・水道光熱費・通信費 等の定期取引で利用
- 入力しない取引も多いため必須ではない
- 担当者割当はテンプレに任意で保持

##### 6.4 デフォルト科目

- 取引先選択時に経費入力・売上入力で `midId`/`subId` を自動セット
- 中/小 両方 or 中のみ (小がないカテゴリ)

##### 6.5 削除制約

- 取引のある取引先は削除不可
- → 利用停止 (`isActive=false`) で運用

#### 7. 権限制御

| 操作 | ADMIN | OPERATOR | VIEWER |
|---|---|---|---|
| 表示 | ✅ | ✅ (タグ別フィルタあり) | ✅ |
| 新規 / 編集 | ✅ | ✅ (デフォルト科目以外) | ❌ |
| 銀行口座管理 | ✅ | ✅ | ❌ |
| 地点管理 | ✅ | ✅ | ❌ |
| 削除 / 有効切替 | ✅ | ❌ | ❌ |

#### 8. 使用 Server Actions

| 関数 | 役割 |
|---|---|
| `getPartners(companyId)` | 取引先一覧 (デフォルト科目付き) |
| `createPartner({...})` | 新規 |
| `updatePartner(id, data)` | 更新 |
| `togglePartnerActive(id)` | 有効/無効切替 |
| `getPartnerBankAccounts(partnerId, companyId)` | 銀行口座一覧 |
| `createPartnerBankAccount({...})` | 口座新規 |
| `updatePartnerBankAccount(id, data, companyId)` | 口座更新 |
| `deletePartnerBankAccount(id, companyId)` | 口座削除 |
| `getPartnerSites(partnerId, companyId)` | 地点一覧 |
| `createPartnerSite({...})` | 地点新規 |
| `updatePartnerSite(id, data, companyId)` | 地点更新 |
| `deletePartnerSite(id, companyId)` | 地点削除 |

#### 9. データ連携先 (Prisma モデル)

| モデル | R | W | 役割 |
|---|---|---|---|
| `TradingPartner` | ✅ | ✅ | 取引先本体 |
| `TradingPartnerBankAccount` | ✅ | ✅ | 振込先口座 |
| `TradingPartnerSite` | ✅ | ✅ | 地点 (物件) |
| `TradingPartnerDefault` | ✅ | ✅ | デフォルト科目 |
| `AccountCategoryMid` / `AccountCategorySub` | ✅ | — | 科目選択 |
| `BankMaster` / `BranchMaster` | ✅ | — | 銀行・支店検索 |

##### 主な書き込みフィールド

```
TradingPartner {
  companyId, name, nameKana, tagKey (固定キー),
  type (CUSTOMER|SUPPLIER|BOTH), isActive, notes
}
TradingPartnerBankAccount {
  partnerId, bankCode, bankName, branchCode, branchName,
  accountType (ORDINARY|CURRENT), accountNumber, accountHolder,
  isActive
}
TradingPartnerSite {
  partnerId, siteName, frequency, paymentDay,
  holidayAdjust, assignedTo
}
TradingPartnerDefault { partnerId, midId, subId? }
```

#### 10. 関連画面・連携

| 画面 | 連携内容 |
|---|---|
| [`/expenses`](expenses.md) / [`/sales`](sales.md) / [`/costs`](costs.md) | 取引先選択 + デフォルト科目自動セット |
| [`/loans`](loans.md) | 借入先 (タグ「銀行」) |
| [`/leases`](leases.md) | リース先 |
| [`/cashflow-table`](cashflow-table.md) | 振込依頼書の振込先口座情報 |
| [`/master/categories`](master-categories.md) | デフォルト科目 |
| [`/master/banks`](master-banks.md) | 銀行/支店マスタ |

### 給与グループ (`/master/payroll-groups`)

#### 1. 概要

給与計算単位を会社ごとに管理するマスタ画面。区分 (原価/販管/外注) を固定で持ち、支給日・支払口座のデフォルト・控除セットを保持する。

- ページ実体: [`app/(dashboard)/master/payroll-groups/page.tsx`](../app/(dashboard)/master/payroll-groups/page.tsx) (364行)
- 主アクション: [`app/actions/payroll.ts`](../app/actions/payroll.ts)

#### 2. URL とクエリパラメータ

| URL | 説明 |
|---|---|
| `/master/payroll-groups` | 一覧 + 編集 |

#### 3. 画面構成 (UI 詳細)

##### 3.1 ヘッダー

- タイトル「給与グループ」 + 会社名
- 右上に `<CompanySwitcher />`
- 「+ 新規グループ」ボタン

##### 3.2 一覧テーブル

| 列 | 内容 |
|---|---|
| グループ名 | `name` |
| 区分 | Badge (原価 / 販管 / 外注) |
| 支給日 | `payDay` (1-31 or 月末) |
| 休日調整 | NONE / PREV / NEXT |
| 振込口座 (デフォ) | `transferAccount.bankName` |
| 現金引出口座 (デフォ) | `cashAccount.bankName` |
| 人数 | `headcount` |
| 有効 | `isActive` ✅ |
| 操作 | 編集 / コピー / 削除 |

##### 3.3 ダイアログ

| ダイアログ | 用途 |
|---|---|
| 給与グループフォーム | 新規 / 編集 |
| コピー作成 | 既存グループからコピー (名前のみ変更) |

#### 4. 区分 (`costType`)

| 値 | ラベル | 説明 |
|---|---|---|
| `COST` | 原価 | 製造原価 (工事部門等) |
| `SGA` | 販管 | 販売管理費 (営業部門等) |
| `OUTSOURCE` | 外注 | 外注費 |

#### 5. 入力フォーム項目

| 項目 | 型 | 必須 | 説明 |
|---|---|---|---|
| グループ名 | text | ✅ | `name` (例: 工事部門) |
| 区分 | select | ✅ | `costType` (COST/SGA/OUTSOURCE) |
| 紐づく中項目 | select | — | `linkedMidId` (給与関連科目) |
| 支給日 | number / 月末 | ✅ | `payDay` (1-31 or 末) |
| 休日調整 | select | ✅ | NONE / PREV_BUSINESS_DAY / NEXT_BUSINESS_DAY |
| 振込口座 (デフォ) | select | — | `defaultTransferAccountId` |
| 現金引出口座 (デフォ) | select | — | `defaultCashAccountId` |
| 人数 | number | — | `headcount` |
| 有効 | switch | — | `isActive` |

##### 控除セット (任意)

- よく使う控除項目をテンプレートとしてグループに保持
- 給与入力時に自動展開

#### 6. 業務ルール

##### 6.1 区分は固定

`costType` は新規作成時に決定し、後から変更不可 (整合性のため)。

##### 6.2 既存からコピー

「コピー作成」で既存グループの設定をすべて引き継いで新規作成。名前のみ変更。

##### 6.3 0 円行の表示ルール

- 前月実績あり → 当月 0 円表示 (デフォルト)
- 2 ヶ月連続 0 円 → デフォ非表示 (表示切替可)

##### 6.4 削除制約

- 過去の `SalaryEntry` がある場合は削除不可
- → 無効化で運用

#### 7. 権限制御

| 操作 | ADMIN | OPERATOR | VIEWER |
|---|---|---|---|
| 表示 | ✅ | ✅ | ✅ |
| 新規 / 編集 | ✅ | ❌ | ❌ |
| コピー | ✅ | ❌ | ❌ |
| 削除 | ✅ | ❌ | ❌ |

#### 8. 使用 Server Actions

| 関数 | 役割 |
|---|---|
| `getPayrollGroups(companyId)` | 一覧 |
| `createPayrollGroup({...})` | 新規 |
| `updatePayrollGroup(id, data, companyId)` | 更新 |
| `deletePayrollGroup(id, companyId)` | 削除 |
| `getAccounts(companyId)` | デフォルト口座選択 |

#### 9. データ連携先 (Prisma モデル)

| モデル | R | W | 役割 |
|---|---|---|---|
| `PayrollGroup` | ✅ | ✅ | 給与グループ本体 |
| `Account` | ✅ | — | デフォルト口座選択 |
| `Company` | ✅ | — | 会社マスタ参照 |
| `AccountCategoryMid` | ✅ | — | 紐づく中項目選択 |
| `SalaryEntry` | ✅ | — | 削除制約チェック |

##### 主な書き込みフィールド

```
PayrollGroup {
  companyId, name, costType (COST|SGA|OUTSOURCE),
  linkedMidId, payDay, holidayAdjust,
  defaultTransferAccountId, defaultCashAccountId,
  headcount, isActive
}
```

#### 10. 既存登録

23 区分 (全 12 社分) が seed で投入済み。

#### 11. 関連画面・連携

| 画面 | 連携内容 |
|---|---|
| [`/salary`](salary.md) | グループ単位の給与入力 |
| [`/master/accounts`](master-accounts.md) | デフォルト口座マスタ |
| [`/master/categories`](master-categories.md) | 紐づく中項目 |

### 勘定科目 (`/master/categories`)

#### 1. 概要

勘定科目を **3 階層** (大項目 / 中項目 / 小項目) で管理するマスタ画面。中項目は確定時必須、小項目は任意。

- ページ実体: [`app/(dashboard)/master/categories/page.tsx`](../app/(dashboard)/master/categories/page.tsx) (277行)
- 主アクション: [`app/actions/categories.ts`](../app/actions/categories.ts)

#### 2. URL とクエリパラメータ

| URL | 説明 |
|---|---|
| `/master/categories` | 一覧 + 編集 |

#### 3. 画面構成 (UI 詳細)

##### 3.1 ヘッダー

- タイトル「勘定科目」
- 「+ 新規中項目」 / 「+ 新規小項目」 ボタン

##### 3.2 階層ツリー表示

```
大項目 (PL区分)
  ├── 中項目 (勘定科目)
  │   ├── 小項目 (補助科目)
  │   └── 小項目
  └── 中項目
      └── (小項目なし)
```

各レベルに表示:
- 名前 / 表示順 / 有効フラグ / 編集ボタン

##### 3.3 ダイアログ

| ダイアログ | 用途 |
|---|---|
| 中項目フォーム | 名前 / 所属大項目 / 表示順 / 区分 / 有効 |
| 小項目フォーム | 名前 / 所属中項目 / 表示順 / 有効 |

#### 4. 3 階層構造

##### 4.1 大項目 (`AccountCategoryMajor`)

PL 区分: マスタとして必須。
| 名前 | 方向 (`direction`) |
|---|---|
| 売上高 | INCOME |
| 売上原価 | EXPENSE |
| 販売管理費 | EXPENSE |
| 営業外収益 | INCOME |
| 営業外費用 | EXPENSE |
| 特別利益 | INCOME |
| 特別損失 | EXPENSE |
| その他費用 | EXPENSE |

通常は新規追加せず、シード値を維持。

##### 4.2 中項目 (`AccountCategoryMid`)

勘定科目: 通常使用する分類。
- 例: 通信費・地代家賃・支払手数料・外注費・法定福利費 等
- 取引の **確定時必須**
- `classification` (FIXED/VARIABLE/TEMPORARY) は科目ではなく取引属性

##### 4.3 小項目 (`AccountCategorySub`)

補助科目: 中項目配下の任意項目。
- 中項目に応じた **限定候補表示** (全部出し禁止)
- 例:
  - 水道光熱費 → 電気代/ガス代/水道代
  - 通信費 → 携帯電話/インターネット/クラウドサービス
  - 地代家賃 → アパート/駐車場
  - 保険料 → 労災/自動車保険/火災保険/賠償責任
  - 旅費交通費 → ETC/ガソリン/宿泊
  - 消耗品費 → 事務用品/現場消耗品

#### 5. 入力フォーム項目

##### 5.1 中項目

| 項目 | 型 | 必須 | 説明 |
|---|---|---|---|
| 名前 | text | ✅ | `name` |
| 所属大項目 | select | ✅ | `majorId` |
| 表示順 | number | ✅ | `displayOrder` |
| 有効 | switch | — | `isActive` |

##### 5.2 小項目

| 項目 | 型 | 必須 | 説明 |
|---|---|---|---|
| 名前 | text | ✅ | `name` |
| 所属中項目 | select | ✅ | `midId` |
| 表示順 | number | ✅ | `displayOrder` |
| 有効 | switch | — | `isActive` |

#### 6. 業務ルール

##### 6.1 確定時の必須性

- **中項目**: 取引確定時 (CONFIRMED) は必須
- **小項目**: 確定時も任意 (未入力警告のみ)

##### 6.2 限定候補表示

小項目は中項目を選択した後、対応する小項目のみが選択肢に表示される。全部出しは UX 上禁止。

##### 6.3 削除制約

- 使用中の科目は削除不可
- 未使用のみ削除可
- → 無効化 (`isActive=false`) で運用

##### 6.4 表示順

- 表示順は必須
- 同一階層内で並び替え

#### 7. 権限制御

| 操作 | ADMIN | OPERATOR | VIEWER |
|---|---|---|---|
| 表示 | ✅ | ✅ | ✅ |
| 中項目新規 / 編集 | ✅ | ❌ | ❌ |
| 小項目新規 / 編集 | ✅ | ❌ | ❌ |
| 削除 | ✅ | ❌ | ❌ |

#### 8. 使用 Server Actions

| 関数 | 役割 |
|---|---|
| `getCategories()` | 全階層 (大→中→小) ツリー取得 |
| `createMidCategory({name, majorId, displayOrder})` | 中項目新規 |
| `updateMidCategory(id, data)` | 中項目更新 |
| `createSubCategory({name, midId, displayOrder})` | 小項目新規 |
| `updateSubCategory(id, data)` | 小項目更新 |

#### 9. データ連携先 (Prisma モデル)

| モデル | R | W | 役割 |
|---|---|---|---|
| `AccountCategoryMajor` | ✅ | — | 大項目 (シード固定) |
| `AccountCategoryMid` | ✅ | ✅ | 中項目 |
| `AccountCategorySub` | ✅ | ✅ | 小項目 |

##### 主な書き込みフィールド

```
AccountCategoryMid {
  name, majorId, displayOrder, isActive
}
AccountCategorySub {
  name, midId, displayOrder, isActive
}
```

#### 10. 関連画面・連携

| 画面 | 連携内容 |
|---|---|
| [`/expenses`](expenses.md) | 中項目・小項目選択 |
| [`/sales`](sales.md) | 売上科目選択 |
| [`/costs`](costs.md) | 原価科目選択 |
| [`/leases`](leases.md) | リース料科目 |
| [`/recurring`](recurring.md) | テンプレ科目 |
| [`/master/deduction-categories`](master-deduction-categories.md) | 控除カテゴリのデフォルト科目 |
| [`/master/partners`](master-partners.md) | 取引先のデフォルト科目 |

### 控除カテゴリ (`/master/deduction-categories`)

#### 1. 概要

売上・原価それぞれの控除カテゴリを別マスタで管理する画面。各カテゴリにデフォルト科目 (中/小) と符号方針 (発生/相殺) を持つ。

- ページ実体: [`app/(dashboard)/master/deduction-categories/page.tsx`](../app/(dashboard)/master/deduction-categories/page.tsx) (249行)
- 主アクション: [`app/actions/deduction-categories.ts`](../app/actions/deduction-categories.ts)

#### 2. URL とクエリパラメータ

| URL | 説明 |
|---|---|
| `/master/deduction-categories` | 一覧 + 編集 |

#### 3. 画面構成 (UI 詳細)

##### 3.1 ヘッダー

- タイトル「控除カテゴリ」
- 「+ 新規カテゴリ」ボタン

##### 3.2 タブ

| タブ | キー (`forType`) | 内容 |
|---|---|---|
| 売上用 | `SALES` | 売上控除カテゴリ (振込手数料・現場経費・値引値上 等) |
| 原価用 | `COST` | 原価控除カテゴリ (協力会費・保険料・立替金 等) |

##### 3.3 一覧テーブル (各タブ)

| 列 | 内容 |
|---|---|
| 名前 | `name` |
| デフォルト中項目 | `defaultMid.name` |
| デフォルト小項目 | `defaultSub.name` |
| 符号方針 | 通常 / 発生・相殺対 (前倒し入金・保留金) / 符号可 (値引値上) |
| 表示順 | `displayOrder` |
| 有効 | `isActive` |
| 操作 | 編集 / 削除 |

##### 3.4 ダイアログ

| ダイアログ | 用途 |
|---|---|
| カテゴリフォーム | 名前 / デフォルト科目 / 符号方針 / 表示順 |

#### 4. 入力フォーム項目

| 項目 | 型 | 必須 | 説明 |
|---|---|---|---|
| 用途 | select | ✅ | SALES / COST (タブと連動) |
| 名前 | text | ✅ | `name` |
| デフォルト中項目 | select | — | `defaultMidId` (空でも準備完了は可) |
| デフォルト小項目 | select | — | `defaultSubId` |
| 符号方針 | select | — | NORMAL / OCCURS_OFFSET / SIGNED |
| 表示順 | number | ✅ | `displayOrder` |
| 有効 | switch | — | `isActive` |

#### 5. 符号方針 (`signPolicy`)

| 値 | 説明 | 例 |
|---|---|---|
| `NORMAL` | 通常 (符号は明細から自動判定) | 振込手数料、協力会費 |
| `OCCURS_OFFSET` | 発生/相殺の小項目で符号を自動決定 | 前倒し入金、保留金 |
| `SIGNED` | 入力者が符号を扱える | 値引/値上、端数調整 |

#### 6. 業務ルール

##### 6.1 用途別マスタ分離

- 売上用と原価用は完全に別マスタ
- カテゴリ名称も別 (重複可)
- 売上画面では `forType=SALES` のみ、原価画面では `forType=COST` のみ表示

##### 6.2 デフォルト科目未設定

- 未設定でも準備完了は可
- ただし **確定不可** (中項目必須)

##### 6.3 前倒し入金・保留金

- カテゴリ内に小項目「発生」「相殺」を持つ
- 金額は常に正で入力
- 符号 (±) は小項目により自動決定
- 月次で発生/相殺を別集計可能

##### 6.4 値引/値上

- 符号を扱える
- 端数調整も含む (必要に応じてプラス/マイナス)

##### 6.5 親会社の控除コピー

直近の入力月を探索して「項目のみ (カテゴリ/小項目/摘要)」を次月以降に自動生成 (金額・証憑はコピーしない)。

##### 6.6 削除制約

- 使用中の場合は削除不可
- 無効化で運用

#### 7. 権限制御

| 操作 | ADMIN | OPERATOR | VIEWER |
|---|---|---|---|
| 表示 | ✅ | ✅ | ✅ |
| 新規 / 編集 / 削除 | ✅ | ❌ | ❌ |

#### 8. 使用 Server Actions

| 関数 | 役割 |
|---|---|
| `getDeductionCategories(forType: "SALES" \| "COST")` | 一覧 (用途別) |
| `createDeductionCategory({...})` | 新規 |
| `updateDeductionCategory(id, data)` | 更新 |
| `deleteDeductionCategory(id)` | 削除 |
| `getCategories()` | デフォルト科目選択 (中/小) |

#### 9. データ連携先 (Prisma モデル)

| モデル | R | W | 役割 |
|---|---|---|---|
| `DeductionCategory` | ✅ | ✅ | 控除カテゴリ本体 |
| `AccountCategoryMid` | ✅ | — | デフォルト中項目 |
| `AccountCategorySub` | ✅ | — | デフォルト小項目 |

##### 主な書き込みフィールド

```
DeductionCategory {
  forType (SALES|COST), name,
  defaultMidId?, defaultSubId?,
  signPolicy (NORMAL|OCCURS_OFFSET|SIGNED),
  displayOrder, isActive
}
```

#### 10. 関連画面・連携

| 画面 | 連携内容 |
|---|---|
| [`/sales`](sales.md) | 売上の控除内訳入力 (`forType=SALES`) |
| [`/costs`](costs.md) | 原価の控除内訳入力 (`forType=COST`) |
| [`/master/categories`](master-categories.md) | デフォルト中/小項目の選択先 |

### 設定 (`/master/settings`)

#### 1. 概要

システム設定 (将来拡張用のプレースホルダ画面)。現状はほぼ実装内容なし。

- ページ実体: [`app/(dashboard)/master/settings/page.tsx`](../app/(dashboard)/master/settings/page.tsx) (28行 — 最小実装)

#### 2. URL とクエリパラメータ

| URL | 説明 |
|---|---|
| `/master/settings` | プレースホルダ表示 |

#### 3. 画面構成

##### 3.1 現状

- タイトル「設定」のみ
- カード 1 枚に説明文 (実装予定の機能の案内)

##### 3.2 将来の実装候補

将来は以下を統合する想定:
- システム全般の設定
- 通知設定 (Slack/Email)
- バックアップスケジュール
- 監査ログ閲覧 (現状は内部のみ)
- ユーザー管理 (Better Auth 連携)
- 通貨・タイムゾーン
- メール送信設定
- API トークン管理

#### 4. 入力フォーム項目

なし。

#### 5. 使用 Server Actions

なし。

#### 6. データ連携先 (Prisma モデル)

なし。

#### 7. 権限制御

| 操作 | ADMIN | OPERATOR | VIEWER |
|---|---|---|---|
| 表示 | ✅ | ✅ | ✅ |

#### 8. 関連画面・連携

| 画面 | 連携内容 |
|---|---|
| [`/master/*`](README.md) | 各種マスタ |
