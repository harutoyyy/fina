# 経理くん（fina） - Project Documentation

## Overview

経理くん（fina）はグループ会社12社の財務データ入力・管理を行う資金管理システム。
現金主義ベースの入出金管理、資金繰り表、借入/リース管理、給与管理を提供する。

## Architecture

- **Framework**: Next.js 16 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **ORM**: Prisma 5
- **DB**: PostgreSQL (Replit built-in)
- **Authentication**: Better Auth (email/password)
- **Runtime**: Node.js 20

## Project Structure

```
app/                    - Next.js App Router
  api/auth/[...all]/    - Better Auth API routes
  layout.tsx            - Root layout
  page.tsx              - Home page
  globals.css           - Global styles
lib/
  auth.ts               - Better Auth server config
  auth-client.ts        - Better Auth client (React hooks)
  prisma.ts             - Prisma client singleton
prisma/
  schema.prisma         - DB schema (30+ models)
  seed.ts               - Initial data seeding (12 companies, categories, etc.)
  migrations/           - Prisma migrations
docs/
  requirements.md       - Requirements specification (Japanese)
  db_design.md          - Database design document
public/                 - Static assets
```

## Database

- PostgreSQL via Replit built-in database
- Prisma ORM with migrations
- Key tables: companies, accounts, transactions (parent-child), monthly_balances, salary_entries, loan/lease contracts, audit_logs
- Better Auth tables: user, session, account, verification
- User profiles extend Better Auth with roles (ADMIN/OPERATOR) and company assignments

## Key Concepts

- Multi-tenant: All 12 companies in one DB, separated by company_id
- Amounts: BigInt (yen), income=positive, expense=negative
- Soft delete: isActive=false for masters
- Transaction parent-child: Parent = bank statement line, children = invoice details
- 3-level account categories: Major (PL) > Mid (account) > Sub (auxiliary)

## Environment Variables

- `DATABASE_URL`: PostgreSQL connection string (auto-managed by Replit)
- `BETTER_AUTH_SECRET`: Auth secret key

## Replit Configuration

- Dev server: `npm run dev` on port 5000 (0.0.0.0)
- `next.config.ts`: `allowedDevOrigins: ["*"]` for Replit proxy
- Deployment: autoscale with `npm run build` + `npm run start`
- Seed: `npx prisma db seed` (uses tsx)
