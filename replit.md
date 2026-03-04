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
    partners/               - Trading partner management
    categories/             - Account category management (3-level)
    settings/               - System settings (placeholder)
  (dashboard)/cashflow/     - Cash flow (placeholder)
  (dashboard)/expenses/     - Expense input (placeholder)
  (dashboard)/sales/        - Sales input (placeholder)
  (dashboard)/costs/        - Cost payment (placeholder)
  (dashboard)/salary/       - Payroll (placeholder)
  (dashboard)/loans/        - Loan management (placeholder)
  (dashboard)/leases/       - Lease management (placeholder)
  (dashboard)/recurring/    - Recurring templates (placeholder)
  api/auth/[...all]/        - Better Auth API routes
  api/companies/            - Companies API
  actions/                  - Server Actions (companies, accounts, partners, categories)
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
- Phase 2 (Transactions): TODO - Expense/sales/cost input, fund transfers
- Phase 3 (Payroll): TODO - Salary/bonus management
- Phase 4 (Reports): TODO - Cash flow table, monthly closing
- Phase 5 (Advanced): TODO - Loan/lease management, recurring templates
