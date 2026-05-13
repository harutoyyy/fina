# 経理くん（fina） - Project Documentation

## Overview

経理くん（fina）はグループ会社12社の財務データ入力・管理を行う資金管理システム。
現金主義ベースの入出金管理、資金繰り表、借入/リース管理、給与管理を提供する。

## Architecture

- **Framework**: Next.js 16 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4 + shadcn/ui
- **ORM**: Prisma 5.22.0 (MUST stay at v5)
- **DB**: PostgreSQL (Replit built-in)
- **Authentication**: Better Auth (email/password)
- **Runtime**: Node.js 20

## Project Structure

```
app/
  (auth)/login/             - Login page
  (auth)/register/          - Registration page
  (dashboard)/layout.tsx    - Dashboard layout (sidebar + header)
  (dashboard)/dashboard/    - Main dashboard
  (dashboard)/master/
    companies/              - Company list & edit
    accounts/               - Bank account management
    banks/                  - Bank/branch master
    partners/               - Trading partner management (+ bank accounts, sites)
    categories/             - Account category management (3-level)
    deduction-categories/   - Deduction category master (sales/cost)
    settings/               - System settings (placeholder)
  (dashboard)/cashflow/     - Fund transfer input
  (dashboard)/cashflow-table/ - Cash flow table view
  (dashboard)/monthly-close/  - Monthly closing management
  (dashboard)/expenses/     - Expense input
  (dashboard)/sales/        - Sales input (parent-child)
  (dashboard)/costs/        - Cost payment input
  (dashboard)/salary/       - Salary/payroll input
  (dashboard)/loans/        - Loan contract management
  (dashboard)/leases/       - Lease contract management
  (dashboard)/recurring/    - Recurring payment templates
  api/auth/[...all]/        - Better Auth API routes
  api/companies/            - Companies API
  actions/                  - Server Actions (companies, accounts, partners, categories, transactions, fund-transfers, payroll, cashflow-table, loans, leases, recurring, bank-masters, partner-bank-accounts, partner-sites, deduction-categories, audit-logs)
  layout.tsx                - Root layout
  page.tsx                  - Home (redirects to /dashboard)
  globals.css               - Global styles + shadcn CSS variables
components/
  ui/                       - shadcn/ui components (button, card, input, label, dialog, select, dropdown-menu, separator, badge, table, tabs, switch)
  app-sidebar.tsx           - Sidebar navigation
  app-header.tsx            - Header with mobile nav, theme toggle, user menu
  company-switcher.tsx      - Company select dropdown
  theme-provider.tsx        - next-themes provider
  theme-toggle.tsx          - Dark/light mode toggle
contexts/
  company-context.tsx       - Company selection global state
lib/
  auth.ts                   - Better Auth server config
  auth-client.ts            - Better Auth client (React hooks)
  audit-log.ts              - Audit logging utility (createAuditLog, getAuditLogs)
  format.ts                 - Formatting helpers (formatYen, bigintToJson, etc.)
  prisma.ts                 - Prisma client singleton
  utils.ts                  - cn() utility
middleware.ts               - Auth middleware (redirect to /login if no session)
prisma/
  schema.prisma             - DB schema (30+ models)
  seed.ts                   - Initial data seeding (12 companies, categories, etc.)
  migrations/               - Prisma migrations
docs/
  requirements.md           - Requirements specification (Japanese)
  db_design.md              - Database design document
```

## Database

- PostgreSQL via Replit built-in database
- Prisma ORM with migrations
- Key tables: companies, accounts, transactions (parent-child), monthly_balances, salary_entries, loan/lease contracts, audit_logs
- Better Auth tables: user (@@map "user"), session (@@map "session"), AuthAccount (@@map "account"), verification
- User profiles extend Better Auth with roles (ADMIN/OPERATOR) and company assignments
- Domain Account model maps to "accounts" table (bank accounts) - no conflict with auth "account" table

## Key Concepts

- Multi-tenant: All 12 companies in one DB, separated by company_id
- Amounts: BigInt (yen), income=positive, expense=negative
- Soft delete: isActive=false for masters
- Transaction parent-child: Parent = bank statement line, children = invoice details
- 3-level account categories: Major (PL) > Mid (account) > Sub (auxiliary)

## Better Auth Config Notes

- Model mapping: `User`, `Session`, `AuthAccount` (account.modelName: "AuthAccount")
- Cookie name: `__Secure-better-auth.session_token` (HTTPS) or `better-auth.session_token` (HTTP)
- Middleware checks both cookie variants
- baseURL set via BETTER_AUTH_URL env var

## Environment Variables

- `DATABASE_URL`: PostgreSQL connection string (auto-managed by Replit)
- `BETTER_AUTH_SECRET`: Auth secret key
- `BETTER_AUTH_URL`: Base URL for Better Auth callbacks

## Replit Configuration

- Dev server: `npm run dev` on port 5000 (0.0.0.0)
- `next.config.ts`: allowedDevOrigins configured for Replit proxy
- Deployment: autoscale with `npm run build` + `npm run start`
- Seed: `npx prisma db seed` (uses tsx)

## Phase Status

- Phase 1 (Foundation): COMPLETE - Auth, layout, master management pages
- Phase 2 (Transactions): COMPLETE - Expense/sales/cost input, fund transfers
  - app/actions/transactions.ts: CRUD, status flow (DRAFT→READY→CONFIRMED)
  - app/actions/fund-transfers.ts: Inter/intra-company fund transfers with paired transactions
  - lib/format.ts: BigInt↔yen formatting, date utils
  - /expenses: Single-entry expense form, list with month/status filters, status workflow
  - /sales: Parent-child (invoice→payments), split payments, remaining balance tracking
  - /costs: Cost breakdown (labor/welfare/materials/tax), recorded vs actual amounts
  - /cashflow: Fund transfer form, inter-company support, transfer list
- Phase 3 (Payroll): COMPLETE - Salary/bonus management
  - app/actions/payroll.ts: PayrollGroup CRUD, SalaryEntry CRUD, deductions, payment details, status flow
  - /master/payroll-groups: Payroll group master management (name, cost type, pay day, accounts, headcount)
  - /salary: Salary entry input with auto-calculation (social insurance 15%, consumption tax 10%), deductions, payment details, status workflow
- Phase 4 (Reports): COMPLETE - Cash flow table, monthly closing
  - app/actions/cashflow-table.ts: Cash flow data retrieval, monthly balance CRUD, month close/reopen
  - /cashflow-table: Cash flow table view (company×account×month), summary cards, filters, running balance
  - /monthly-close: Monthly closing management (close/reopen with reason), balance settings per account
- Phase 5 (Advanced): COMPLETE - Loan/lease management, recurring templates
  - app/actions/loans.ts: LoanContract CRUD, repayment schedule auto-generation (equal principal/bullet/grace), paid marking, schedule regeneration. Validates totalPayments > 0.
  - app/actions/leases.ts: LeaseContract CRUD, payment schedule auto-generation, paid marking, schedule regeneration
  - app/actions/recurring.ts: RecurringTemplate CRUD, monthly transaction auto-generation with frequency logic (MONTHLY/BIMONTHLY/QUARTERLY/YEARLY/SPECIFIC_MONTHS), duplicate prevention via lastGeneratedMonth, variable amount copies from previous month
  - /loans: Loan contract list, creation with repayment schedule, detail view, schedule paid marking
  - /leases: Lease contract list, creation with payment schedule, detail view, schedule paid marking, regeneration
  - /recurring: Template list, creation with frequency/amount settings, monthly batch generation
- Step 1 (基盤強化): COMPLETE - Audit logging, bank master, deduction categories, partner bank accounts/sites with companyId ownership verification
- Step 1 (確定フロー強化): COMPLETE - A1-A4 (経費/売上/原価バリデーション、控除内訳入力UI)
- Step 1 (機能補完): COMPLETE - B7 (繰り延べ), C5 (経費確定BOX), B6 (給与自動仕訳)
- Step 2 (C1): COMPLETE - ダッシュボード実データ化 (口座/取引先数、メイン口座残高、直近取引)
- Step 2 (C2): COMPLETE - 会社マスタ不足フィールド追加 (建物名, メール, Web, 法人番号, 設立日, ステータス)
- Step 2 (B4): COMPLETE - 証憑アップロード（モック）: Evidence CRUD actions + 経費ページに証憑パネル統合
- Step 2 (B1): COMPLETE - 現金引出バッチ + 金種表: CashWithdrawalBatch actions + UI + sidebar
- Step 2 (C3): COMPLETE - 資金繰り表 印刷機能 (print CSS, 印刷ボタン)
- Step 2 (B5): COMPLETE - 給与Excelインポート (xlsx parser + import action + UI)

## New Files Added (Step 2)

- `app/actions/evidence.ts` - Evidence CRUD (upload mock, delete, list)
- `app/actions/cash-withdrawal.ts` - CashWithdrawalBatch CRUD, denomination, confirm/delete
- `app/actions/salary-import.ts` - Salary Excel import action
- `components/evidence-panel.tsx` - Evidence attachment dialog
- `components/salary-excel-import.tsx` - Salary Excel import UI with preview
- `app/(dashboard)/cash-withdrawal/page.tsx` - Cash withdrawal batch page
