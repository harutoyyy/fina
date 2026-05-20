# 経理くん (fina) — ページ × ソースコード一覧

各画面 (URL) と、そのページを構成するソースコード (page.tsx / Server Actions / コンポーネント / ライブラリ) の対応表。

> 📌 **docs-ex/ 全体のドキュメント役割分担は [`README.md`](README.md) を参照。**
> - 横断仕様・業務ルール → [`screen-specification.md`](screen-specification.md)
> - 画面ごとの深掘り詳細 → [`screen-details.md`](screen-details.md)

最終更新: 2026-05-18

---

## 凡例

- **URL**: ブラウザでアクセスする URL パス
- **Page**: ページ実体 (`app/.../page.tsx`)
- **Server Actions**: そのページが呼び出す Server Actions (`app/actions/*.ts`)
- **Components**: 専用コンポーネント (汎用 `components/ui/*` は割愛)
- **Lib / Context**: 共有ライブラリ・コンテキスト

shadcn/ui (`components/ui/*`) はほぼ全画面で共通利用のため、各ページ欄では省略します。一覧は末尾の「共通コンポーネント」参照。

---

## 0. ルート & 認証

| 画面 | URL | Page | Server Actions | Components / Lib |
|---|---|---|---|---|
| ルート (リダイレクト) | `/` | `app/page.tsx` | — | — (`next/navigation` のみ) |
| ログイン | `/login` | `app/(auth)/login/page.tsx` | — | `lib/auth-client.ts` |
| 新規登録 | `/register` | `app/(auth)/register/page.tsx` | — | `lib/auth-client.ts` |
| 経費確定BOX (旧) | `/expense-box` | `app/(dashboard)/expense-box/page.tsx` | — | リダイレクト stub → `/expenses` |

ミドルウェア: `middleware.ts` (未認証時に `/login` へ転送)
ダッシュボードレイアウト: `app/(dashboard)/layout.tsx` (`<AppSidebar/>` + `<AppHeader/>` + `<CompanyProvider/>`)

---

## 1. メイン (サイドバー: 無印)

### 1.1 ダッシュボード

| 項目 | 値 |
|---|---|
| URL | `/dashboard` |
| Page | `app/(dashboard)/dashboard/page.tsx` |
| Server Actions | `app/actions/dashboard.ts` / `app/actions/company-groups.ts` |
| Components | `components/company-switcher.tsx` |
| Context / Lib | `contexts/company-context.tsx` / `lib/format.ts` |

### 1.2 資金繰り表

| 項目 | 値 |
|---|---|
| URL | `/cashflow-table` |
| Page | `app/(dashboard)/cashflow-table/page.tsx` |
| Server Actions | `app/actions/cashflow-table.ts` / `app/actions/cashflow-reports.ts` / `app/actions/accounts.ts` / `app/actions/companies.ts` / `app/actions/reconciliation.ts` |
| Components | `components/company-switcher.tsx` |
| Context / Lib | `contexts/company-context.tsx` / `lib/format.ts` |

### 1.3 グループ別サマリ (※ 隠れページ／参考)

| 項目 | 値 |
|---|---|
| URL | `/group-summary` |
| Page | `app/(dashboard)/group-summary/page.tsx` |
| Server Actions | `app/actions/company-groups.ts` |
| Components | — |
| Context / Lib | `lib/format.ts` |

### 1.4 資金移動 (会社間)

| 項目 | 値 |
|---|---|
| URL | `/cashflow` |
| Page | `app/(dashboard)/cashflow/page.tsx` |
| Server Actions | `app/actions/fund-transfers.ts` / `app/actions/accounts.ts` / `app/actions/companies.ts` |
| Components | `components/company-switcher.tsx` |
| Context / Lib | `contexts/company-context.tsx` / `lib/format.ts` |

---

## 2. 入力 (サイドバー: 入力)

### 2.1 経費入力 (4タブ: 固定/変動/臨時/受領BOX)

| 項目 | 値 |
|---|---|
| URL | `/expenses` (タブ: `?tab=FIXED\|VARIABLE\|TEMPORARY\|RECEIVED`) |
| Page | `app/(dashboard)/expenses/page.tsx` |
| Server Actions | `app/actions/transactions.ts` / `app/actions/accounts.ts` / `app/actions/cashflow-table.ts` / `app/actions/categories.ts` / `app/actions/fund-transfers.ts` / `app/actions/partners.ts` / `app/actions/user-profile.ts` |
| Components | `components/company-switcher.tsx` / `components/evidence-panel.tsx` |
| Context / Lib | `contexts/company-context.tsx` / `lib/format.ts` |

### 2.2 売上入力

| 項目 | 値 |
|---|---|
| URL | `/sales` |
| Page | `app/(dashboard)/sales/page.tsx` |
| Server Actions | `app/actions/transactions.ts` / `app/actions/accounts.ts` / `app/actions/cashflow-table.ts` / `app/actions/categories.ts` / `app/actions/partners.ts` |
| Components | `components/company-switcher.tsx` / `components/deduction-details-panel.tsx` / `components/transaction-excel-import.tsx` |
| Context / Lib | `contexts/company-context.tsx` / `lib/format.ts` |

### 2.3 原価支払

| 項目 | 値 |
|---|---|
| URL | `/costs` |
| Page | `app/(dashboard)/costs/page.tsx` |
| Server Actions | `app/actions/transactions.ts` / `app/actions/accounts.ts` / `app/actions/cashflow-table.ts` / `app/actions/partners.ts` |
| Components | `components/company-switcher.tsx` / `components/deduction-details-panel.tsx` / `components/transaction-excel-import.tsx` |
| Context / Lib | `contexts/company-context.tsx` / `lib/format.ts` |

### 2.4 給与入力

| 項目 | 値 |
|---|---|
| URL | `/salary` |
| Page | `app/(dashboard)/salary/page.tsx` |
| Server Actions | `app/actions/payroll.ts` / `app/actions/accounts.ts` |
| Components | `components/company-switcher.tsx` / `components/salary-excel-import.tsx` |
| Context / Lib | `contexts/company-context.tsx` / `lib/format.ts` |

### 2.5 グループ間入力

| 項目 | 値 |
|---|---|
| URL | `/inter-group` |
| Page | `app/(dashboard)/inter-group/page.tsx` |
| Server Actions | `app/actions/inter-group.ts` / `app/actions/accounts.ts` |
| Components | `components/company-switcher.tsx` |
| Context / Lib | `contexts/company-context.tsx` / `lib/format.ts` |

---

## 3. 管理 (サイドバー: 管理)

### 3.1 現金引出

| 項目 | 値 |
|---|---|
| URL | `/cash-withdrawal` |
| Page | `app/(dashboard)/cash-withdrawal/page.tsx` |
| Server Actions | `app/actions/cash-withdrawal.ts` / `app/actions/accounts.ts` |
| Components | `components/company-switcher.tsx` |
| Context / Lib | `contexts/company-context.tsx` / `lib/format.ts` |

### 3.2 借入管理

| 項目 | 値 |
|---|---|
| URL | `/loans` |
| Page | `app/(dashboard)/loans/page.tsx` |
| Server Actions | `app/actions/loans.ts` / `app/actions/partners.ts` |
| Components | `components/company-switcher.tsx` |
| Context / Lib | `contexts/company-context.tsx` / `lib/format.ts` |

### 3.3 リース管理

| 項目 | 値 |
|---|---|
| URL | `/leases` |
| Page | `app/(dashboard)/leases/page.tsx` |
| Server Actions | `app/actions/leases.ts` / `app/actions/accounts.ts` / `app/actions/categories.ts` / `app/actions/partners.ts` |
| Components | `components/company-switcher.tsx` |
| Context / Lib | `contexts/company-context.tsx` / `lib/format.ts` |

### 3.4 納税予定表

| 項目 | 値 |
|---|---|
| URL | `/tax-schedule` |
| Page | `app/(dashboard)/tax-schedule/page.tsx` |
| Server Actions | `app/actions/tax-schedule.ts` |
| Components | `components/company-switcher.tsx` |
| Context / Lib | `contexts/company-context.tsx` / `lib/format.ts` / `lib/tax-schedule.ts` |

### 3.5 カード明細

| 項目 | 値 |
|---|---|
| URL | `/card-statements` |
| Page | `app/(dashboard)/card-statements/page.tsx` |
| Server Actions | `app/actions/card-statements.ts` / `app/actions/accounts.ts` |
| Components | `components/company-switcher.tsx` |
| Context / Lib | `contexts/company-context.tsx` / `lib/format.ts` |

### 3.6 定期支払 (テンプレート)

| 項目 | 値 |
|---|---|
| URL | `/recurring` |
| Page | `app/(dashboard)/recurring/page.tsx` |
| Server Actions | `app/actions/recurring.ts` / `app/actions/accounts.ts` / `app/actions/categories.ts` / `app/actions/partners.ts` |
| Components | `components/company-switcher.tsx` |
| Context / Lib | `contexts/company-context.tsx` / `lib/format.ts` |

---

## 4. マスタ (サイドバー: マスタ)

### 4.1 会社一覧

| 項目 | 値 |
|---|---|
| URL | `/master/companies` |
| Page | `app/(dashboard)/master/companies/page.tsx` |
| Server Actions | `app/actions/companies.ts` / `app/actions/industries.ts` |
| Components | `components/company-switcher.tsx` |
| Context / Lib | `contexts/company-context.tsx` |

### 4.2 会社グループ

| 項目 | 値 |
|---|---|
| URL | `/master/company-groups` |
| Page | `app/(dashboard)/master/company-groups/page.tsx` |
| Server Actions | `app/actions/company-groups.ts` / `app/actions/companies.ts` |
| Components | — |
| Context / Lib | — |

### 4.3 銀行口座

| 項目 | 値 |
|---|---|
| URL | `/master/accounts` |
| Page | `app/(dashboard)/master/accounts/page.tsx` |
| Server Actions | `app/actions/accounts.ts` |
| Components | `components/company-switcher.tsx` |
| Context / Lib | `contexts/company-context.tsx` |

### 4.4 銀行・支店 (※ 隠れページ／参考)

| 項目 | 値 |
|---|---|
| URL | `/master/banks` |
| Page | `app/(dashboard)/master/banks/page.tsx` |
| Server Actions | `app/actions/bank-masters.ts` |
| Components | — |
| Context / Lib | — |

### 4.5 業種

| 項目 | 値 |
|---|---|
| URL | `/master/industries` |
| Page | `app/(dashboard)/master/industries/page.tsx` |
| Server Actions | `app/actions/industries.ts` |
| Components | — |
| Context / Lib | — |

### 4.6 売上項目

| 項目 | 値 |
|---|---|
| URL | `/master/sales-items` |
| Page | `app/(dashboard)/master/sales-items/page.tsx` |
| Server Actions | `app/actions/sales-items.ts` / `app/actions/companies.ts` |
| Components | — |
| Context / Lib | — |

### 4.7 取引先

| 項目 | 値 |
|---|---|
| URL | `/master/partners` |
| Page | `app/(dashboard)/master/partners/page.tsx` |
| Server Actions | `app/actions/partners.ts` / `app/actions/partner-bank-accounts.ts` / `app/actions/partner-sites.ts` |
| Components | `components/company-switcher.tsx` |
| Context / Lib | `contexts/company-context.tsx` |

### 4.8 給与グループ

| 項目 | 値 |
|---|---|
| URL | `/master/payroll-groups` |
| Page | `app/(dashboard)/master/payroll-groups/page.tsx` |
| Server Actions | `app/actions/payroll.ts` / `app/actions/accounts.ts` |
| Components | `components/company-switcher.tsx` |
| Context / Lib | `contexts/company-context.tsx` |

### 4.9 勘定科目

| 項目 | 値 |
|---|---|
| URL | `/master/categories` |
| Page | `app/(dashboard)/master/categories/page.tsx` |
| Server Actions | `app/actions/categories.ts` |
| Components | — |
| Context / Lib | `lib/utils.ts` |

### 4.10 控除カテゴリ

| 項目 | 値 |
|---|---|
| URL | `/master/deduction-categories` |
| Page | `app/(dashboard)/master/deduction-categories/page.tsx` |
| Server Actions | `app/actions/deduction-categories.ts` / `app/actions/categories.ts` |
| Components | — |
| Context / Lib | — |

### 4.11 設定

| 項目 | 値 |
|---|---|
| URL | `/master/settings` |
| Page | `app/(dashboard)/master/settings/page.tsx` |
| Server Actions | — |
| Components | — |
| Context / Lib | — |

---

## 5. Server Actions リファレンス

`app/actions/*.ts` の役割一覧 (アルファベット順)。

| Action ファイル | 主な役割 | 主に使われるページ |
|---|---|---|
| `accounts.ts` | 銀行口座マスタ CRUD | 各入力画面 / マスタ「銀行口座」 |
| `audit-logs.ts` | 監査ログの記録・取得 | — (内部利用) |
| `bank-masters.ts` | 全銀協 銀行・支店マスタ | `/master/banks` |
| `card-statements.ts` | カード明細 CRUD | `/card-statements` |
| `cash-withdrawal.ts` | 現金引出バッチ・金種表 | `/cash-withdrawal` |
| `cashflow-reports.ts` | 資金繰り表からの帳票生成 (資金移動 / 振込 / 現金 + 金種表) | `/cashflow-table` |
| `cashflow-table.ts` | 資金繰り表データ取得・月締め・期首残高 | `/cashflow-table`, `/expenses`, `/sales`, `/costs` |
| `categories.ts` | 勘定科目 (3階層) マスタ | マスタ「勘定科目」, 各入力画面 |
| `companies.ts` | 会社マスタ | `/master/companies`, `/cashflow-table` 他 |
| `company-groups.ts` | 会社グループ | `/dashboard`, `/group-summary`, `/master/company-groups` |
| `dashboard.ts` | ダッシュボード集計 (残高・取引数等) | `/dashboard` |
| `deduction-categories.ts` | 売上/原価の控除カテゴリ | `/master/deduction-categories` |
| `evidence.ts` | 証憑 (PDF) CRUD | (内部 / EvidencePanel) |
| `fund-transfers.ts` | 会社間・同社内 資金移動 | `/cashflow`, `/expenses` |
| `industries.ts` | 業種マスタ | `/master/industries`, `/master/companies` |
| `inter-group.ts` | グループ間取引入力 | `/inter-group` |
| `leases.ts` | リース契約・スケジュール | `/leases` |
| `loans.ts` | 借入契約・返済スケジュール | `/loans` |
| `partner-bank-accounts.ts` | 取引先の銀行口座 | `/master/partners` |
| `partner-sites.ts` | 取引先の現場 (物件) | `/master/partners` |
| `partners.ts` | 取引先マスタ | `/master/partners`, 各入力画面 |
| `payroll.ts` | 給与グループ・給与エントリ | `/salary`, `/master/payroll-groups` |
| `reconciliation.ts` | 通帳照合点 | `/cashflow-table` |
| `recurring.ts` | 定期支払テンプレート | `/recurring`, `/expenses` |
| `salary-import.ts` | 給与 Excel 取込 | (SalaryExcelImport コンポーネント) |
| `sales-items.ts` | 売上項目マスタ | `/master/sales-items` |
| `tax-schedule.ts` | 納税予定 | `/tax-schedule` |
| `transaction-import.ts` | 取引 Excel 取込 | (TransactionExcelImport コンポーネント) |
| `transactions.ts` | 取引 (経費・売上・原価) CRUD | `/expenses`, `/sales`, `/costs` |
| `user-profile.ts` | ユーザーロール・会社割当・経費BOX抽出 | `/expenses` 他 |

---

## 6. 共通コンポーネント

`components/*.tsx` の役割一覧。`components/ui/*` は shadcn/ui で全画面共通のため割愛。

| コンポーネント | 役割 |
|---|---|
| `app-sidebar.tsx` | 左サイドバーナビゲーション |
| `app-header.tsx` | 上部ヘッダー (ロゴ / モバイルメニュー / テーマ切替 / ユーザーメニュー) |
| `company-switcher.tsx` | 会社切替プルダウン (各ページ右上) |
| `deduction-details-panel.tsx` | 控除内訳サイドパネル (売上 / 原価) |
| `evidence-panel.tsx` | 証憑 (PDF) 添付パネル (経費入力等) |
| `evidence-search.tsx` | 証憑検索ボックス |
| `pagination.tsx` | ページネーション (前へ/次へ + 件数表示) |
| `salary-excel-import.tsx` | 給与 Excel 取込 UI |
| `theme-provider.tsx` | next-themes プロバイダ (ライト/ダーク) |
| `theme-toggle.tsx` | テーマ切替ボタン |
| `transaction-excel-import.tsx` | 取引 Excel 取込 UI |
| `ui/*` | shadcn/ui (button, card, input, label, dialog, select, dropdown-menu, separator, badge, table, tabs, switch, checkbox, etc.) |

---

## 7. 共通ライブラリ・コンテキスト

| ファイル | 役割 |
|---|---|
| `lib/auth.ts` | Better Auth サーバー設定 |
| `lib/auth-client.ts` | Better Auth クライアント (React Hooks) |
| `lib/auth-server.ts` | サーバー側セッション取得・認証ヘルパー (`requireSession` 等) |
| `lib/prisma.ts` | Prisma Client シングルトン |
| `lib/format.ts` | 円表示 / 日付フォーマット / BigInt→JSON 変換ヘルパー |
| `lib/utils.ts` | `cn()` ユーティリティ (Tailwind クラス結合) |
| `lib/audit-log.ts` | 監査ログ記録ヘルパー |
| `lib/tax-schedule.ts` | 納税種別ラベル定数 |
| `contexts/company-context.tsx` | 選択中の会社をグローバル管理 (`useCompany()`) |
| `middleware.ts` | 認証ミドルウェア (Cookie チェック → `/login` 転送) |

---

## 付録: ディレクトリ構造の早見表

```
app/
  page.tsx                        ← / (redirect → /dashboard)
  layout.tsx                      ← ルート Layout
  globals.css
  (auth)/
    login/page.tsx                ← /login
    register/page.tsx             ← /register
  (dashboard)/
    layout.tsx                    ← ダッシュボード共通レイアウト
    dashboard/page.tsx            ← /dashboard
    cashflow-table/page.tsx       ← /cashflow-table
    cashflow/page.tsx             ← /cashflow
    group-summary/page.tsx        ← /group-summary
    expenses/page.tsx             ← /expenses (4タブ)
    expense-box/page.tsx          ← /expense-box (redirect → /expenses)
    sales/page.tsx                ← /sales
    costs/page.tsx                ← /costs
    salary/page.tsx               ← /salary
    inter-group/page.tsx          ← /inter-group
    cash-withdrawal/page.tsx      ← /cash-withdrawal
    loans/page.tsx                ← /loans
    leases/page.tsx               ← /leases
    tax-schedule/page.tsx         ← /tax-schedule
    card-statements/page.tsx      ← /card-statements
    recurring/page.tsx            ← /recurring
    master/
      companies/page.tsx          ← /master/companies
      company-groups/page.tsx     ← /master/company-groups
      accounts/page.tsx           ← /master/accounts
      banks/page.tsx              ← /master/banks
      industries/page.tsx         ← /master/industries
      sales-items/page.tsx        ← /master/sales-items
      partners/page.tsx           ← /master/partners
      payroll-groups/page.tsx     ← /master/payroll-groups
      categories/page.tsx         ← /master/categories
      deduction-categories/page.tsx ← /master/deduction-categories
      settings/page.tsx           ← /master/settings
  actions/
    *.ts                          ← Server Actions (上表参照)
  api/
    auth/[...all]/route.ts        ← Better Auth API
    companies/                    ← (Companies API)
components/
  *.tsx                           ← カスタムコンポーネント
  ui/*                            ← shadcn/ui
contexts/
  company-context.tsx
lib/
  *.ts                            ← 共通ヘルパー
prisma/
  schema.prisma                   ← DB スキーマ (50近いモデル)
  migrations/                     ← Prisma migrations
  seed*.ts                        ← シード
middleware.ts                     ← 認証ミドルウェア
```
