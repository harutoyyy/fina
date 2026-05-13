--
-- PostgreSQL database dump
--

\restrict DtJR8IzDuK7Qwp7ZEI1ssQKVuVOEsngl7rxkWto9ekmLRDABM5YZ8jv3IhfyMLA

-- Dumped from database version 16.10
-- Dumped by pg_dump version 16.10

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: AccountType; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."AccountType" AS ENUM (
    'ORDINARY',
    'TERM',
    'SOCIAL_INSURANCE_RESERVE',
    'CONSUMPTION_TAX_RESERVE'
);


ALTER TYPE public."AccountType" OWNER TO postgres;

--
-- Name: PaymentMethod; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."PaymentMethod" AS ENUM (
    'BANK_TRANSFER',
    'DIRECT_DEBIT',
    'CASH_WITHDRAWAL'
);


ALTER TYPE public."PaymentMethod" OWNER TO postgres;

--
-- Name: TradingPartnerType; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."TradingPartnerType" AS ENUM (
    'CUSTOMER',
    'VENDOR',
    'BOTH'
);


ALTER TYPE public."TradingPartnerType" OWNER TO postgres;

--
-- Name: TransactionStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."TransactionStatus" AS ENUM (
    'DRAFT',
    'READY',
    'CONFIRMED',
    'CANCELLED'
);


ALTER TYPE public."TransactionStatus" OWNER TO postgres;

--
-- Name: TransactionType; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."TransactionType" AS ENUM (
    'EXPENSE',
    'SALES',
    'COST_PAYMENT',
    'SALARY',
    'LOAN',
    'TRANSFER'
);


ALTER TYPE public."TransactionType" OWNER TO postgres;

--
-- Name: UserRole; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."UserRole" AS ENUM (
    'ADMIN',
    'OPERATOR'
);


ALTER TYPE public."UserRole" OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


ALTER TABLE public._prisma_migrations OWNER TO postgres;

--
-- Name: account; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.account (
    id text NOT NULL,
    "accountId" text NOT NULL,
    "providerId" text NOT NULL,
    "userId" text NOT NULL,
    "accessToken" text,
    "refreshToken" text,
    "idToken" text,
    "accessTokenExpiresAt" timestamp(3) without time zone,
    "refreshTokenExpiresAt" timestamp(3) without time zone,
    scope text,
    password text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.account OWNER TO postgres;

--
-- Name: account_category_majors; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.account_category_majors (
    id text NOT NULL,
    name text NOT NULL,
    direction text NOT NULL,
    "displayOrder" integer DEFAULT 0 NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.account_category_majors OWNER TO postgres;

--
-- Name: account_category_mids; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.account_category_mids (
    id text NOT NULL,
    "majorId" text NOT NULL,
    name text NOT NULL,
    "displayOrder" integer DEFAULT 0 NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.account_category_mids OWNER TO postgres;

--
-- Name: account_category_subs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.account_category_subs (
    id text NOT NULL,
    "midId" text NOT NULL,
    name text NOT NULL,
    "displayOrder" integer DEFAULT 0 NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.account_category_subs OWNER TO postgres;

--
-- Name: account_roles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.account_roles (
    id text NOT NULL,
    "accountId" text NOT NULL,
    "roleKey" text NOT NULL,
    "roleName" text NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL
);


ALTER TABLE public.account_roles OWNER TO postgres;

--
-- Name: accounts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.accounts (
    id text NOT NULL,
    "companyId" text NOT NULL,
    "bankName" text,
    "bankCode" text,
    "branchName" text,
    "branchCode" text,
    "accountNumber" text,
    "accountType" public."AccountType" NOT NULL,
    "accountHolder" text,
    "isMain" boolean DEFAULT false NOT NULL,
    "isVirtual" boolean DEFAULT false NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "isVisible" boolean DEFAULT true NOT NULL,
    "displayOrder" integer DEFAULT 0 NOT NULL,
    "fbSettings" jsonb,
    "feeSettings" jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.accounts OWNER TO postgres;

--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.audit_logs (
    id text NOT NULL,
    "tableName" text NOT NULL,
    "recordId" text NOT NULL,
    operation text NOT NULL,
    "userId" text NOT NULL,
    "timestamp" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "beforeData" jsonb,
    "afterData" jsonb,
    reason text
);


ALTER TABLE public.audit_logs OWNER TO postgres;

--
-- Name: bank_masters; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.bank_masters (
    id text NOT NULL,
    "bankCode" text NOT NULL,
    "bankName" text NOT NULL,
    "bankNameKana" text,
    "isActive" boolean DEFAULT true NOT NULL
);


ALTER TABLE public.bank_masters OWNER TO postgres;

--
-- Name: branch_masters; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.branch_masters (
    id text NOT NULL,
    "bankCode" text NOT NULL,
    "branchCode" text NOT NULL,
    "branchName" text NOT NULL,
    "branchNameKana" text,
    "isActive" boolean DEFAULT true NOT NULL
);


ALTER TABLE public.branch_masters OWNER TO postgres;

--
-- Name: cash_denominations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.cash_denominations (
    id text NOT NULL,
    "batchId" text NOT NULL,
    yen10000 integer DEFAULT 0 NOT NULL,
    yen5000 integer DEFAULT 0 NOT NULL,
    yen2000 integer DEFAULT 0 NOT NULL,
    yen1000 integer DEFAULT 0 NOT NULL,
    yen500 integer DEFAULT 0 NOT NULL,
    yen100 integer DEFAULT 0 NOT NULL,
    yen50 integer DEFAULT 0 NOT NULL,
    yen10 integer DEFAULT 0 NOT NULL,
    yen5 integer DEFAULT 0 NOT NULL,
    yen1 integer DEFAULT 0 NOT NULL,
    total bigint DEFAULT 0 NOT NULL,
    "purposeLabel" text
);


ALTER TABLE public.cash_denominations OWNER TO postgres;

--
-- Name: cash_withdrawal_batches; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.cash_withdrawal_batches (
    id text NOT NULL,
    "companyId" text NOT NULL,
    "accountId" text NOT NULL,
    "withdrawalDate" timestamp(3) without time zone NOT NULL,
    "totalAmount" bigint NOT NULL,
    status public."TransactionStatus" DEFAULT 'DRAFT'::public."TransactionStatus" NOT NULL,
    "confirmedAt" timestamp(3) without time zone,
    "confirmedBy" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.cash_withdrawal_batches OWNER TO postgres;

--
-- Name: companies; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.companies (
    id text NOT NULL,
    name text NOT NULL,
    "nameKana" text,
    "shortName" text,
    "industryType" text,
    "representativeTitle" text,
    "representativeName" text,
    "postalCode" text,
    "addressPrefecture" text,
    "addressCity" text,
    "addressStreet" text,
    "addressBuilding" text,
    phone text,
    fax text,
    email text,
    website text,
    "corporateNumber" text,
    "invoiceNumber" text,
    "fiscalMonth" integer DEFAULT 3 NOT NULL,
    "establishedDate" timestamp(3) without time zone,
    status text DEFAULT 'ACTIVE'::text NOT NULL,
    "mainAccountId" text,
    "defaultAssigneeId" text,
    "displayOrder" integer DEFAULT 0 NOT NULL,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.companies OWNER TO postgres;

--
-- Name: deduction_categories; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.deduction_categories (
    id text NOT NULL,
    "forType" text NOT NULL,
    name text NOT NULL,
    "midId" text NOT NULL,
    "subId" text,
    "hasSubTypes" boolean DEFAULT false NOT NULL,
    "signRule" jsonb,
    "isActive" boolean DEFAULT true NOT NULL,
    "displayOrder" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.deduction_categories OWNER TO postgres;

--
-- Name: evidences; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.evidences (
    id text NOT NULL,
    "transactionId" text NOT NULL,
    "fileName" text NOT NULL,
    "fileUrl" text NOT NULL,
    "fileSize" integer,
    "mimeType" text,
    "uploadedBy" text NOT NULL,
    "uploadedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.evidences OWNER TO postgres;

--
-- Name: fund_transfers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.fund_transfers (
    id text NOT NULL,
    "transactionId" text NOT NULL,
    "fromAccountId" text NOT NULL,
    "toAccountId" text NOT NULL,
    "transferDate" timestamp(3) without time zone NOT NULL,
    amount bigint NOT NULL,
    "counterCompanyId" text,
    "counterTransactionId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.fund_transfers OWNER TO postgres;

--
-- Name: lease_contracts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.lease_contracts (
    id text NOT NULL,
    "companyId" text NOT NULL,
    "partnerId" text,
    "contractName" text NOT NULL,
    "monthlyAmount" bigint NOT NULL,
    "startDate" timestamp(3) without time zone NOT NULL,
    "endDate" timestamp(3) without time zone,
    "totalPayments" integer,
    "paymentDay" integer,
    "holidayAdjust" text DEFAULT 'PREV_BUSINESS'::text NOT NULL,
    "principalAdjust" text DEFAULT 'LAST'::text NOT NULL,
    "accountId" text,
    "midId" text,
    "subId" text,
    status text DEFAULT 'ACTIVE'::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.lease_contracts OWNER TO postgres;

--
-- Name: lease_schedules; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.lease_schedules (
    id text NOT NULL,
    "contractId" text NOT NULL,
    "paymentNumber" integer NOT NULL,
    "dueDate" timestamp(3) without time zone NOT NULL,
    amount bigint NOT NULL,
    "isPaid" boolean DEFAULT false NOT NULL,
    "transactionId" text
);


ALTER TABLE public.lease_schedules OWNER TO postgres;

--
-- Name: loan_contracts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.loan_contracts (
    id text NOT NULL,
    "companyId" text NOT NULL,
    "partnerId" text,
    "contractName" text NOT NULL,
    "principalAmount" bigint NOT NULL,
    "executionDate" timestamp(3) without time zone NOT NULL,
    "repaymentStartDate" timestamp(3) without time zone NOT NULL,
    "repaymentMethod" text NOT NULL,
    "repaymentFrequency" text NOT NULL,
    "repaymentDay" integer,
    "holidayAdjust" text DEFAULT 'PREV_BUSINESS'::text NOT NULL,
    "totalPayments" integer,
    "completionDate" timestamp(3) without time zone,
    "interestType" text NOT NULL,
    "interestRate" numeric(65,30) NOT NULL,
    "interestTiming" text DEFAULT 'ARREAR'::text NOT NULL,
    "dayCountBasis" integer DEFAULT 365 NOT NULL,
    "roundingRule" text DEFAULT 'ROUND_HALF_UP'::text NOT NULL,
    "principalAdjust" text DEFAULT 'LAST'::text NOT NULL,
    "interestHistory" jsonb,
    "remainingBalance" bigint DEFAULT 0 NOT NULL,
    status text DEFAULT 'ACTIVE'::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.loan_contracts OWNER TO postgres;

--
-- Name: loan_schedules; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.loan_schedules (
    id text NOT NULL,
    "contractId" text NOT NULL,
    "paymentNumber" integer NOT NULL,
    "dueDate" timestamp(3) without time zone NOT NULL,
    "principalAmount" bigint NOT NULL,
    "interestAmount" bigint NOT NULL,
    "totalAmount" bigint NOT NULL,
    "remainingBalance" bigint NOT NULL,
    "isPaid" boolean DEFAULT false NOT NULL,
    "transactionId" text
);


ALTER TABLE public.loan_schedules OWNER TO postgres;

--
-- Name: month_closes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.month_closes (
    id text NOT NULL,
    "companyId" text NOT NULL,
    "yearMonth" text NOT NULL,
    "isClosed" boolean DEFAULT false NOT NULL,
    "closedAt" timestamp(3) without time zone,
    "closedBy" text,
    "reopenedAt" timestamp(3) without time zone,
    "reopenedBy" text,
    "reopenReason" text
);


ALTER TABLE public.month_closes OWNER TO postgres;

--
-- Name: monthly_balances; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.monthly_balances (
    id text NOT NULL,
    "companyId" text NOT NULL,
    "accountId" text NOT NULL,
    "yearMonth" text NOT NULL,
    "openingBalance" bigint DEFAULT 0 NOT NULL,
    "closingBalance" bigint DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.monthly_balances OWNER TO postgres;

--
-- Name: payroll_groups; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.payroll_groups (
    id text NOT NULL,
    "companyId" text NOT NULL,
    name text NOT NULL,
    "costType" text NOT NULL,
    "midId" text,
    "payDay" integer,
    "payDayIsMonthEnd" boolean DEFAULT false NOT NULL,
    "holidayAdjust" text,
    "defaultAccountId" text,
    "defaultCashAccountId" text,
    "deductionPresets" jsonb,
    headcount integer DEFAULT 0 NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "displayOrder" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.payroll_groups OWNER TO postgres;

--
-- Name: recurring_templates; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.recurring_templates (
    id text NOT NULL,
    "companyId" text NOT NULL,
    name text NOT NULL,
    frequency text NOT NULL,
    "specificMonths" integer[],
    "startMonth" integer,
    "dueDayRule" text NOT NULL,
    "holidayAdjust" text DEFAULT 'PREV_BUSINESS'::text NOT NULL,
    "transactionType" public."TransactionType" NOT NULL,
    "accountId" text,
    "partnerId" text,
    "midId" text,
    "subId" text,
    "amountType" text NOT NULL,
    "fixedAmount" bigint,
    "paymentMethod" public."PaymentMethod",
    classification text,
    summary text,
    "assigneeId" text,
    "isActive" boolean DEFAULT true NOT NULL,
    "lastGeneratedMonth" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.recurring_templates OWNER TO postgres;

--
-- Name: salary_deductions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.salary_deductions (
    id text NOT NULL,
    "salaryEntryId" text NOT NULL,
    "itemName" text NOT NULL,
    amount bigint DEFAULT 0 NOT NULL,
    "midId" text,
    "subId" text,
    "contentRows" jsonb,
    "displayOrder" integer DEFAULT 0 NOT NULL
);


ALTER TABLE public.salary_deductions OWNER TO postgres;

--
-- Name: salary_entries; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.salary_entries (
    id text NOT NULL,
    "payrollGroupId" text NOT NULL,
    "payMonth" text NOT NULL,
    "payDate" timestamp(3) without time zone,
    "taxablePayment" bigint DEFAULT 0 NOT NULL,
    "transportAllowance" bigint DEFAULT 0 NOT NULL,
    "miscExpenses" bigint DEFAULT 0 NOT NULL,
    "carryoverAdjust" bigint DEFAULT 0 NOT NULL,
    "advanceExpenses" bigint DEFAULT 0 NOT NULL,
    "totalPayment" bigint DEFAULT 0 NOT NULL,
    "socialInsuranceReserve" bigint DEFAULT 0 NOT NULL,
    "consumptionTaxReserve" bigint DEFAULT 0 NOT NULL,
    "totalDeduction" bigint DEFAULT 0 NOT NULL,
    "netPayment" bigint DEFAULT 0 NOT NULL,
    headcount integer DEFAULT 0 NOT NULL,
    status public."TransactionStatus" DEFAULT 'DRAFT'::public."TransactionStatus" NOT NULL,
    "confirmedAt" timestamp(3) without time zone,
    "confirmedBy" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.salary_entries OWNER TO postgres;

--
-- Name: salary_journal_mappings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.salary_journal_mappings (
    id text NOT NULL,
    "deductionItemName" text NOT NULL,
    "majorId" text NOT NULL,
    "midId" text NOT NULL,
    "subId" text,
    classification text,
    "isActive" boolean DEFAULT true NOT NULL
);


ALTER TABLE public.salary_journal_mappings OWNER TO postgres;

--
-- Name: salary_payment_details; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.salary_payment_details (
    id text NOT NULL,
    "salaryEntryId" text NOT NULL,
    "paymentDate" timestamp(3) without time zone NOT NULL,
    "paymentMethod" public."PaymentMethod" NOT NULL,
    "accountId" text,
    amount bigint DEFAULT 0 NOT NULL,
    "displayOrder" integer DEFAULT 0 NOT NULL
);


ALTER TABLE public.salary_payment_details OWNER TO postgres;

--
-- Name: session; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.session (
    id text NOT NULL,
    "expiresAt" timestamp(3) without time zone NOT NULL,
    token text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "ipAddress" text,
    "userAgent" text,
    "userId" text NOT NULL
);


ALTER TABLE public.session OWNER TO postgres;

--
-- Name: trading_partner_bank_accounts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.trading_partner_bank_accounts (
    id text NOT NULL,
    "partnerId" text NOT NULL,
    "bankCode" text NOT NULL,
    "branchCode" text NOT NULL,
    "accountType" text NOT NULL,
    "accountNumber" text NOT NULL,
    "accountHolder" text NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.trading_partner_bank_accounts OWNER TO postgres;

--
-- Name: trading_partner_defaults; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.trading_partner_defaults (
    id text NOT NULL,
    "partnerId" text NOT NULL,
    "midId" text NOT NULL,
    "subId" text
);


ALTER TABLE public.trading_partner_defaults OWNER TO postgres;

--
-- Name: trading_partner_sites; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.trading_partner_sites (
    id text NOT NULL,
    "partnerId" text NOT NULL,
    "siteName" text NOT NULL,
    frequency text,
    "specificMonths" integer[],
    "startMonth" integer,
    "dueDayRule" text,
    "holidayAdjust" text,
    "amountType" text,
    "fixedAmount" bigint,
    "assigneeId" text,
    "midId" text,
    "subId" text,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.trading_partner_sites OWNER TO postgres;

--
-- Name: trading_partners; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.trading_partners (
    id text NOT NULL,
    "companyId" text NOT NULL,
    name text NOT NULL,
    "nameKana" text,
    type public."TradingPartnerType" NOT NULL,
    "tagKey" text NOT NULL,
    "tagDisplayName" text,
    "isActive" boolean DEFAULT true NOT NULL,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.trading_partners OWNER TO postgres;

--
-- Name: transaction_details; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.transaction_details (
    id text NOT NULL,
    "transactionId" text NOT NULL,
    "midId" text,
    "subId" text,
    amount bigint DEFAULT 0 NOT NULL,
    classification text,
    summary text,
    "deductionCategoryId" text,
    "deductionSubType" text,
    "signMultiplier" integer DEFAULT 1 NOT NULL,
    "displayOrder" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.transaction_details OWNER TO postgres;

--
-- Name: transactions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.transactions (
    id text NOT NULL,
    "companyId" text NOT NULL,
    "accountId" text NOT NULL,
    "partnerId" text,
    type public."TransactionType" NOT NULL,
    status public."TransactionStatus" DEFAULT 'DRAFT'::public."TransactionStatus" NOT NULL,
    "transactionDate" timestamp(3) without time zone,
    "scheduledDate" timestamp(3) without time zone,
    "accountingMonth" text NOT NULL,
    amount bigint DEFAULT 0 NOT NULL,
    "estimatedAmount" bigint,
    "actualAmount" bigint,
    "paymentMethod" public."PaymentMethod",
    classification text,
    summary text,
    "displayOrder" integer DEFAULT 0 NOT NULL,
    "confirmedAt" timestamp(3) without time zone,
    "confirmedBy" text,
    "readyAt" timestamp(3) without time zone,
    "readyBy" text,
    "invoiceDate" timestamp(3) without time zone,
    "invoiceAmount" bigint,
    "recordedAmount" bigint,
    "transferAmount" bigint,
    "linkedTransactionId" text,
    "parentId" text,
    "cashWithdrawalBatchId" text,
    "hasEvidence" boolean DEFAULT false NOT NULL,
    "amountUpdatedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.transactions OWNER TO postgres;

--
-- Name: transfer_batch_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.transfer_batch_items (
    id text NOT NULL,
    "batchId" text NOT NULL,
    "transactionId" text,
    "recipientName" text NOT NULL,
    "bankCode" text NOT NULL,
    "branchCode" text NOT NULL,
    "accountType" text NOT NULL,
    "accountNumber" text NOT NULL,
    amount bigint NOT NULL,
    fee bigint DEFAULT 0 NOT NULL,
    "feeOverride" boolean DEFAULT false NOT NULL,
    "isTransferred" boolean DEFAULT false NOT NULL,
    "displayOrder" integer DEFAULT 0 NOT NULL
);


ALTER TABLE public.transfer_batch_items OWNER TO postgres;

--
-- Name: transfer_batches; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.transfer_batches (
    id text NOT NULL,
    "companyId" text NOT NULL,
    "accountId" text NOT NULL,
    "batchDate" timestamp(3) without time zone NOT NULL,
    purpose text NOT NULL,
    status text DEFAULT 'DRAFT'::text NOT NULL,
    "fbExportedAt" timestamp(3) without time zone,
    "confirmedAt" timestamp(3) without time zone,
    "confirmedBy" text,
    "totalAmount" bigint DEFAULT 0 NOT NULL,
    "totalFee" bigint DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.transfer_batches OWNER TO postgres;

--
-- Name: user; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."user" (
    id text NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    "emailVerified" boolean DEFAULT false NOT NULL,
    image text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."user" OWNER TO postgres;

--
-- Name: user_profiles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_profiles (
    id text NOT NULL,
    "authUserId" text NOT NULL,
    role public."UserRole" DEFAULT 'OPERATOR'::public."UserRole" NOT NULL,
    "displayName" text NOT NULL,
    "assignedCompanyIds" text[],
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.user_profiles OWNER TO postgres;

--
-- Name: verification; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.verification (
    id text NOT NULL,
    identifier text NOT NULL,
    value text NOT NULL,
    "expiresAt" timestamp(3) without time zone NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.verification OWNER TO postgres;

--
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) FROM stdin;
6bc77204-58b9-4bad-9665-ab4d6cc30420	32d23fc709b939b6ff166fc4bf7bdba2ef0c79229315e4cd0dd260e2e47adf3d	2026-03-04 07:55:15.859043+00	20260304075515_init	\N	\N	2026-03-04 07:55:15.5817+00	1
0b1038d2-7127-46c3-bf09-9ec56b2eb7a1	344f7556f5200223a24dd301e87127590dff7e69e2a8db911cdc9ca64f72954d	2026-03-04 07:57:54.320922+00	20260304075754_add_better_auth_tables	\N	\N	2026-03-04 07:57:54.286054+00	1
\.


--
-- Data for Name: account; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.account (id, "accountId", "providerId", "userId", "accessToken", "refreshToken", "idToken", "accessTokenExpiresAt", "refreshTokenExpiresAt", scope, password, "createdAt", "updatedAt") FROM stdin;
ff9trTPHMqOJyOIIb49sk0eeLbAqZx3A	dZ68C4DTqitvoLGwkpcqQvaH6s7wwH3a	credential	dZ68C4DTqitvoLGwkpcqQvaH6s7wwH3a	\N	\N	\N	\N	\N	\N	da052c1994768d2ad2ee72a4efe00f38:22aa6f2c362b8e9ffa27f424f3a702a97137ebc4f27758c5cd806c71426042686114e5b5b2f06faeccbeb59d7136d0ee125ca0e360f863bda8d6c5bcbcbc786d	2026-03-04 08:40:15.76	2026-03-04 08:40:15.76
fn38nVU5Ov8AJzJHHbEjQ5J50FYMSmcP	RtlWlabUnwLwaxO0eotyKt9xarDBKAOn	credential	RtlWlabUnwLwaxO0eotyKt9xarDBKAOn	\N	\N	\N	\N	\N	\N	d1c37edf7c8ad6aa4d3ddbc13250b196:ad5100d7f0f97f0711cbdcb4befac619e9b2a96fee75e145ff3c8b54521b035e4a8f3326a52c8736389a7cf631f220a021a7e93c56d187c0facaa0a42270b3fb	2026-03-05 01:07:37.32	2026-03-05 01:07:37.32
V4o44AKQQ7T8JTeB7Xd3qxmanh3Zyzcp	CRfV8ZUDP2HxdIelKO3D6r1pKuHBYbGn	credential	CRfV8ZUDP2HxdIelKO3D6r1pKuHBYbGn	\N	\N	\N	\N	\N	\N	998d30aae8c856a90c928c839292af5d:9f5b7a8145a9defbc75b30a8da2526e7ffca3ab0f6969b9484d4af48ed20dc005582ed66b3f933a84caad13af06b96e401c7e155c9b2d50748d543ce8efdcd1e	2026-03-23 05:25:01.311	2026-03-23 05:25:01.311
\.


--
-- Data for Name: account_category_majors; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.account_category_majors (id, name, direction, "displayOrder", "isActive", "createdAt", "updatedAt") FROM stdin;
cmmcyqtse0012arvdqn8acidp	売上高	INCOME	1	t	2026-03-05 04:26:14.222	2026-03-05 04:26:14.222
cmmcyqtse0016arvdu9s69q20	その他費用	EXPENSE	6	t	2026-03-05 04:26:14.223	2026-03-05 04:26:14.223
cmmcyqtse0015arvdvcjjnyy3	営業外収益	INCOME	4	t	2026-03-05 04:26:14.223	2026-03-05 04:26:14.223
cmmcyqtse0013arvd4fobfxas	売上原価	EXPENSE	2	t	2026-03-05 04:26:14.222	2026-03-05 04:26:14.222
cmmcyqtse0014arvddopu5h46	販売管理費	EXPENSE	3	t	2026-03-05 04:26:14.223	2026-03-05 04:26:14.223
cmmcyqtse0017arvd7uygkx54	営業外費用	EXPENSE	5	t	2026-03-05 04:26:14.223	2026-03-05 04:26:14.223
\.


--
-- Data for Name: account_category_mids; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.account_category_mids (id, "majorId", name, "displayOrder", "isActive", "createdAt", "updatedAt") FROM stdin;
cmmcyqtsk0019arvdey5qf37l	cmmcyqtse0014arvddopu5h46	水道光熱費	1	t	2026-03-05 04:26:14.228	2026-03-05 04:26:14.228
cmmcyqtss001earvdijgiktyg	cmmcyqtse0014arvddopu5h46	通信費	2	t	2026-03-05 04:26:14.236	2026-03-05 04:26:14.236
cmmcyqtsy001karvdswtdbm0u	cmmcyqtse0014arvddopu5h46	地代家賃	3	t	2026-03-05 04:26:14.243	2026-03-05 04:26:14.243
cmmcyqtt5001oarvdpls32r3g	cmmcyqtse0014arvddopu5h46	事務所賃料	4	t	2026-03-05 04:26:14.249	2026-03-05 04:26:14.249
cmmcyqtt7001qarvdw7f7vius	cmmcyqtse0014arvddopu5h46	リース料	5	t	2026-03-05 04:26:14.251	2026-03-05 04:26:14.251
cmmcyqttc001uarvdg8txtzyy	cmmcyqtse0014arvddopu5h46	保険料	6	t	2026-03-05 04:26:14.257	2026-03-05 04:26:14.257
cmmcyqttj0021arvd1o9ez4zn	cmmcyqtse0014arvddopu5h46	支払手数料	7	t	2026-03-05 04:26:14.263	2026-03-05 04:26:14.263
cmmcyqtto0028arvdjwq5k13x	cmmcyqtse0014arvddopu5h46	旅費交通費	8	t	2026-03-05 04:26:14.269	2026-03-05 04:26:14.269
cmmcyqttu002earvdgy2u1c71	cmmcyqtse0014arvddopu5h46	消耗品費	9	t	2026-03-05 04:26:14.275	2026-03-05 04:26:14.275
cmmcyqtu0002jarvdfthap5o0	cmmcyqtse0014arvddopu5h46	諸会費	10	t	2026-03-05 04:26:14.28	2026-03-05 04:26:14.28
cmmcyqtu5002narvdb7vqdse3	cmmcyqtse0014arvddopu5h46	広告宣伝費	11	t	2026-03-05 04:26:14.285	2026-03-05 04:26:14.285
cmmcyqtua002sarvdvjsdi796	cmmcyqtse0014arvddopu5h46	車両費	12	t	2026-03-05 04:26:14.29	2026-03-05 04:26:14.29
cmmcyqtuf002zarvdsnfqtqpl	cmmcyqtse0014arvddopu5h46	会議費	13	t	2026-03-05 04:26:14.296	2026-03-05 04:26:14.296
cmmcyqtui0031arvdp5fzr5fp	cmmcyqtse0014arvddopu5h46	交際費	14	t	2026-03-05 04:26:14.298	2026-03-05 04:26:14.298
cmmcyqtuk0033arvdu89m8u1a	cmmcyqtse0014arvddopu5h46	支払報酬料	15	t	2026-03-05 04:26:14.301	2026-03-05 04:26:14.301
cmmcyqtuq0038arvd03l7u62a	cmmcyqtse0014arvddopu5h46	立替金	16	t	2026-03-05 04:26:14.306	2026-03-05 04:26:14.306
cmmcyqtus003aarvd86vyu6pl	cmmcyqtse0014arvddopu5h46	法定福利費	17	t	2026-03-05 04:26:14.309	2026-03-05 04:26:14.309
cmmcyqtuv003carvdscp23651	cmmcyqtse0014arvddopu5h46	福利厚生費	18	t	2026-03-05 04:26:14.312	2026-03-05 04:26:14.312
cmmcyqtuy003earvdueszcifd	cmmcyqtse0014arvddopu5h46	修繕費	19	t	2026-03-05 04:26:14.314	2026-03-05 04:26:14.314
cmmcyqtv0003garvd6k16ftid	cmmcyqtse0014arvddopu5h46	租税公課	20	t	2026-03-05 04:26:14.317	2026-03-05 04:26:14.317
cmmcyqtv3003iarvdj8pbhvdb	cmmcyqtse0014arvddopu5h46	雑費	21	t	2026-03-05 04:26:14.319	2026-03-05 04:26:14.319
cmmcyqtv5003karvdw9f777jm	cmmcyqtse0012arvdqn8acidp	売上	1	t	2026-03-05 04:26:14.322	2026-03-05 04:26:14.322
cmmcyqtv8003marvdwxjo6a0i	cmmcyqtse0012arvdqn8acidp	雑収入	2	t	2026-03-05 04:26:14.325	2026-03-05 04:26:14.325
cmmcyqtvb003oarvdrjjfm1xt	cmmcyqtse0013arvd4fobfxas	外注費	1	t	2026-03-05 04:26:14.327	2026-03-05 04:26:14.327
cmmcyqtvd003qarvdg1khj2a4	cmmcyqtse0013arvd4fobfxas	材料費	2	t	2026-03-05 04:26:14.33	2026-03-05 04:26:14.33
cmmcyqtvg003sarvdlkkw8fj2	cmmcyqtse0013arvd4fobfxas	労務費	3	t	2026-03-05 04:26:14.332	2026-03-05 04:26:14.332
cmmcyqtvi003uarvdaqisd85c	cmmcyqtse0013arvd4fobfxas	旅費交通費	4	t	2026-03-05 04:26:14.335	2026-03-05 04:26:14.335
cmmcyqtvo0040arvdizm0768e	cmmcyqtse0013arvd4fobfxas	現場経費	5	t	2026-03-05 04:26:14.34	2026-03-05 04:26:14.34
cmmcyqtvq0042arvd3bc9sby8	cmmcyqtse0015arvdvcjjnyy3	受取利息	1	t	2026-03-05 04:26:14.343	2026-03-05 04:26:14.343
cmmcyqtvt0044arvdnvaai522	cmmcyqtse0015arvdvcjjnyy3	雑収入	2	t	2026-03-05 04:26:14.345	2026-03-05 04:26:14.345
cmmcyqtvv0046arvd8wfef1ap	cmmcyqtse0017arvd7uygkx54	支払利息	1	t	2026-03-05 04:26:14.348	2026-03-05 04:26:14.348
cmmcyqtvy0048arvdt4vmlv8l	cmmcyqtse0017arvd7uygkx54	雑損失	2	t	2026-03-05 04:26:14.351	2026-03-05 04:26:14.351
cmmcyqtw1004aarvd79o72uat	cmmcyqtse0016arvdu9s69q20	社会保険積立	1	t	2026-03-05 04:26:14.353	2026-03-05 04:26:14.353
cmmcyqtw6004darvd983o9r4d	cmmcyqtse0016arvdu9s69q20	源泉所得税	2	t	2026-03-05 04:26:14.358	2026-03-05 04:26:14.358
cmmcyqtwc004garvdy4k4nbhb	cmmcyqtse0016arvdu9s69q20	貸金/立替金	3	t	2026-03-05 04:26:14.364	2026-03-05 04:26:14.364
cmmcyqtwh004jarvdzh2gahl1	cmmcyqtse0016arvdu9s69q20	消費税積立	4	t	2026-03-05 04:26:14.37	2026-03-05 04:26:14.37
\.


--
-- Data for Name: account_category_subs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.account_category_subs (id, "midId", name, "displayOrder", "isActive", "createdAt", "updatedAt") FROM stdin;
cmmcyqtsp001aarvdeb28xxjm	cmmcyqtsk0019arvdey5qf37l	電気代	1	t	2026-03-05 04:26:14.233	2026-03-05 04:26:14.233
cmmcyqtsp001barvdc3706u7g	cmmcyqtsk0019arvdey5qf37l	ガス代	2	t	2026-03-05 04:26:14.233	2026-03-05 04:26:14.233
cmmcyqtsp001carvdlnkbmmo6	cmmcyqtsk0019arvdey5qf37l	水道代	3	t	2026-03-05 04:26:14.233	2026-03-05 04:26:14.233
cmmcyqtsv001farvdy2vchyo7	cmmcyqtss001earvdijgiktyg	携帯電話	1	t	2026-03-05 04:26:14.239	2026-03-05 04:26:14.239
cmmcyqtsv001garvd8stofupf	cmmcyqtss001earvdijgiktyg	インターネット/固定電話	2	t	2026-03-05 04:26:14.239	2026-03-05 04:26:14.239
cmmcyqtsv001harvd5napmbhr	cmmcyqtss001earvdijgiktyg	クラウド/通信サービス	3	t	2026-03-05 04:26:14.239	2026-03-05 04:26:14.239
cmmcyqtsv001iarvdz5wbnxwd	cmmcyqtss001earvdijgiktyg	その他（通信）	4	t	2026-03-05 04:26:14.239	2026-03-05 04:26:14.239
cmmcyqtt1001larvdtcbefcll	cmmcyqtsy001karvdswtdbm0u	アパート	1	t	2026-03-05 04:26:14.246	2026-03-05 04:26:14.246
cmmcyqtt1001marvdv6i3vebl	cmmcyqtsy001karvdswtdbm0u	駐車場	2	t	2026-03-05 04:26:14.246	2026-03-05 04:26:14.246
cmmcyqtt9001rarvdqcif7b3s	cmmcyqtt7001qarvdw7f7vius	車両リース	1	t	2026-03-05 04:26:14.254	2026-03-05 04:26:14.254
cmmcyqtt9001sarvd3d2pwabw	cmmcyqtt7001qarvdw7f7vius	OA機器/その他リース	2	t	2026-03-05 04:26:14.254	2026-03-05 04:26:14.254
cmmcyqttg001varvd8b8urzpz	cmmcyqttc001uarvdg8txtzyy	労災	1	t	2026-03-05 04:26:14.26	2026-03-05 04:26:14.26
cmmcyqttg001warvdijgvgzbk	cmmcyqttc001uarvdg8txtzyy	自動車保険	2	t	2026-03-05 04:26:14.26	2026-03-05 04:26:14.26
cmmcyqttg001xarvdm3ipqvzo	cmmcyqttc001uarvdg8txtzyy	火災保険	3	t	2026-03-05 04:26:14.26	2026-03-05 04:26:14.26
cmmcyqttg001yarvdvdh0l4tq	cmmcyqttc001uarvdg8txtzyy	賠償責任	4	t	2026-03-05 04:26:14.26	2026-03-05 04:26:14.26
cmmcyqttg001zarvdga46y1jm	cmmcyqttc001uarvdg8txtzyy	その他（保険）	5	t	2026-03-05 04:26:14.26	2026-03-05 04:26:14.26
cmmcyqttl0022arvdzfqs0uoa	cmmcyqttj0021arvd1o9ez4zn	振込手数料	1	t	2026-03-05 04:26:14.266	2026-03-05 04:26:14.266
cmmcyqttl0023arvdrfurwant	cmmcyqttj0021arvd1o9ez4zn	引落手数料	2	t	2026-03-05 04:26:14.266	2026-03-05 04:26:14.266
cmmcyqttl0024arvd7l39jkle	cmmcyqttj0021arvd1o9ez4zn	ネットバンク利用料	3	t	2026-03-05 04:26:14.266	2026-03-05 04:26:14.266
cmmcyqttl0025arvdmbgp439r	cmmcyqttj0021arvd1o9ez4zn	口座維持/手数料	4	t	2026-03-05 04:26:14.266	2026-03-05 04:26:14.266
cmmcyqttl0026arvdiii4111x	cmmcyqttj0021arvd1o9ez4zn	その他（手数料）	5	t	2026-03-05 04:26:14.266	2026-03-05 04:26:14.266
cmmcyqttr0029arvdb25ny19t	cmmcyqtto0028arvdjwq5k13x	ETC	1	t	2026-03-05 04:26:14.272	2026-03-05 04:26:14.272
cmmcyqttr002aarvdha9u4pyg	cmmcyqtto0028arvdjwq5k13x	ガソリン	2	t	2026-03-05 04:26:14.272	2026-03-05 04:26:14.272
cmmcyqttr002barvdw8j6cm5g	cmmcyqtto0028arvdjwq5k13x	宿泊	3	t	2026-03-05 04:26:14.272	2026-03-05 04:26:14.272
cmmcyqttr002carvdsqb7jal6	cmmcyqtto0028arvdjwq5k13x	その他（旅費）	4	t	2026-03-05 04:26:14.272	2026-03-05 04:26:14.272
cmmcyqttw002farvddwqnn4ja	cmmcyqttu002earvdgy2u1c71	事務用品	1	t	2026-03-05 04:26:14.277	2026-03-05 04:26:14.277
cmmcyqttw002garvdeksv0qw2	cmmcyqttu002earvdgy2u1c71	現場消耗品	2	t	2026-03-05 04:26:14.277	2026-03-05 04:26:14.277
cmmcyqttw002harvd63umq3m9	cmmcyqttu002earvdgy2u1c71	その他（消耗）	3	t	2026-03-05 04:26:14.277	2026-03-05 04:26:14.277
cmmcyqtu2002karvdlfsj2ilo	cmmcyqtu0002jarvdfthap5o0	現場会費	1	t	2026-03-05 04:26:14.282	2026-03-05 04:26:14.282
cmmcyqtu2002larvd5auso2jq	cmmcyqtu0002jarvdfthap5o0	その他（会費）	2	t	2026-03-05 04:26:14.282	2026-03-05 04:26:14.282
cmmcyqtu7002oarvd7yr9rufa	cmmcyqtu5002narvdb7vqdse3	Web広告	1	t	2026-03-05 04:26:14.287	2026-03-05 04:26:14.287
cmmcyqtu7002parvdxzy0g0ca	cmmcyqtu5002narvdb7vqdse3	求人広告	2	t	2026-03-05 04:26:14.287	2026-03-05 04:26:14.287
cmmcyqtu7002qarvd8p2yvefz	cmmcyqtu5002narvdb7vqdse3	その他（広告）	3	t	2026-03-05 04:26:14.287	2026-03-05 04:26:14.287
cmmcyqtuc002tarvd90foqmot	cmmcyqtua002sarvdvjsdi796	車検	1	t	2026-03-05 04:26:14.293	2026-03-05 04:26:14.293
cmmcyqtuc002uarvdhpn2bq0p	cmmcyqtua002sarvdvjsdi796	整備	2	t	2026-03-05 04:26:14.293	2026-03-05 04:26:14.293
cmmcyqtuc002varvdxjv6288m	cmmcyqtua002sarvdvjsdi796	タイヤ	3	t	2026-03-05 04:26:14.293	2026-03-05 04:26:14.293
cmmcyqtuc002warvd28pf8j3n	cmmcyqtua002sarvdvjsdi796	税金（車関連）	4	t	2026-03-05 04:26:14.293	2026-03-05 04:26:14.293
cmmcyqtuc002xarvdmwgot1d7	cmmcyqtua002sarvdvjsdi796	その他（車両）	5	t	2026-03-05 04:26:14.293	2026-03-05 04:26:14.293
cmmcyqtun0034arvd3eosw6qj	cmmcyqtuk0033arvdu89m8u1a	税理士	1	t	2026-03-05 04:26:14.303	2026-03-05 04:26:14.303
cmmcyqtun0035arvdbakd0xv0	cmmcyqtuk0033arvdu89m8u1a	社労士	2	t	2026-03-05 04:26:14.303	2026-03-05 04:26:14.303
cmmcyqtun0036arvd7wizaq2k	cmmcyqtuk0033arvdu89m8u1a	その他（報酬）	3	t	2026-03-05 04:26:14.303	2026-03-05 04:26:14.303
cmmcyqtvl003varvdfycn73sh	cmmcyqtvi003uarvdaqisd85c	ETC	1	t	2026-03-05 04:26:14.337	2026-03-05 04:26:14.337
cmmcyqtvl003warvdgev8oyo2	cmmcyqtvi003uarvdaqisd85c	ガソリン	2	t	2026-03-05 04:26:14.337	2026-03-05 04:26:14.337
cmmcyqtvl003xarvdh8anc025	cmmcyqtvi003uarvdaqisd85c	宿泊	3	t	2026-03-05 04:26:14.337	2026-03-05 04:26:14.337
cmmcyqtvl003yarvd6mnbd8il	cmmcyqtvi003uarvdaqisd85c	その他（旅費）	4	t	2026-03-05 04:26:14.337	2026-03-05 04:26:14.337
cmmcyqtw3004barvd822ueui9	cmmcyqtw1004aarvd79o72uat	給与預かり分	1	t	2026-03-05 04:26:14.355	2026-03-05 04:26:14.355
cmmcyqtw9004earvdn7isgfq2	cmmcyqtw6004darvd983o9r4d	給与預かり分	1	t	2026-03-05 04:26:14.361	2026-03-05 04:26:14.361
cmmcyqtwe004harvdare96fjj	cmmcyqtwc004garvdy4k4nbhb	給与預かり分	1	t	2026-03-05 04:26:14.366	2026-03-05 04:26:14.366
cmmcyqtwk004karvd0nelq0kg	cmmcyqtwh004jarvdzh2gahl1	給与預かり分	1	t	2026-03-05 04:26:14.372	2026-03-05 04:26:14.372
\.


--
-- Data for Name: account_roles; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.account_roles (id, "accountId", "roleKey", "roleName", "isActive") FROM stdin;
cmmcyqu4i00b2arvdq2cc1wtq	cmmcyqts80011arvd35y96bh6	SALARY_PAYMENT	給与支払口座	t
cmmcyqu4i00b3arvdshd2xq4l	cmmcyqts80011arvd35y96bh6	EXPENSE_PAYMENT	経費支払口座	t
cmmcyqu4i00b4arvdu6hudoij	cmmcyqts80011arvd35y96bh6	INCOME_RECEIPT	入金口座	t
cmmcyqu4i00b5arvd2lpfggfx	cmmcyqtyd006darvd8cwm68ch	EXPENSE_PAYMENT	経費支払口座	t
\.


--
-- Data for Name: accounts; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.accounts (id, "companyId", "bankName", "bankCode", "branchName", "branchCode", "accountNumber", "accountType", "accountHolder", "isMain", "isVirtual", "isActive", "isVisible", "displayOrder", "fbSettings", "feeSettings", "createdAt", "updatedAt") FROM stdin;
cmmcyqtr5000carvd1mzcbnrx	cmmcyqtqg0000arvdkrit0l53	\N	\N	\N	\N	\N	SOCIAL_INSURANCE_RESERVE	\N	f	t	t	f	98	\N	\N	2026-03-05 04:26:14.178	2026-03-05 04:26:14.178
cmmcyqtr5000darvd3oxykto3	cmmcyqtqg0000arvdkrit0l53	\N	\N	\N	\N	\N	CONSUMPTION_TAX_RESERVE	\N	f	t	t	f	99	\N	\N	2026-03-05 04:26:14.178	2026-03-05 04:26:14.178
cmmcyqtr9000earvd42pf3yhq	cmmcyqtqv0005arvd9ihg7rjq	\N	\N	\N	\N	\N	SOCIAL_INSURANCE_RESERVE	\N	f	t	t	f	98	\N	\N	2026-03-05 04:26:14.181	2026-03-05 04:26:14.181
cmmcyqtr9000farvdpatjhose	cmmcyqtqv0005arvd9ihg7rjq	\N	\N	\N	\N	\N	CONSUMPTION_TAX_RESERVE	\N	f	t	t	f	99	\N	\N	2026-03-05 04:26:14.181	2026-03-05 04:26:14.181
cmmcyqtrc000garvds3q1quq6	cmmcyqtqu0003arvd1inrsxt3	\N	\N	\N	\N	\N	SOCIAL_INSURANCE_RESERVE	\N	f	t	t	f	98	\N	\N	2026-03-05 04:26:14.184	2026-03-05 04:26:14.184
cmmcyqtrc000harvd88fahfyl	cmmcyqtqu0003arvd1inrsxt3	\N	\N	\N	\N	\N	CONSUMPTION_TAX_RESERVE	\N	f	t	t	f	99	\N	\N	2026-03-05 04:26:14.184	2026-03-05 04:26:14.184
cmmcyqtrf000iarvd2nsleznp	cmmcyqtqy0008arvdcxys4abv	\N	\N	\N	\N	\N	SOCIAL_INSURANCE_RESERVE	\N	f	t	t	f	98	\N	\N	2026-03-05 04:26:14.188	2026-03-05 04:26:14.188
cmmcyqtrf000jarvdhn4e025v	cmmcyqtqy0008arvdcxys4abv	\N	\N	\N	\N	\N	CONSUMPTION_TAX_RESERVE	\N	f	t	t	f	99	\N	\N	2026-03-05 04:26:14.188	2026-03-05 04:26:14.188
cmmcyqtrj000karvd0cn6dynd	cmmcyqtqv0004arvdgo343ms2	\N	\N	\N	\N	\N	SOCIAL_INSURANCE_RESERVE	\N	f	t	t	f	98	\N	\N	2026-03-05 04:26:14.191	2026-03-05 04:26:14.191
cmmcyqtrj000larvd77356xs3	cmmcyqtqv0004arvdgo343ms2	\N	\N	\N	\N	\N	CONSUMPTION_TAX_RESERVE	\N	f	t	t	f	99	\N	\N	2026-03-05 04:26:14.191	2026-03-05 04:26:14.191
cmmcyqtrm000marvdjne95fi7	cmmcyqtqy0009arvd3241xwgv	\N	\N	\N	\N	\N	SOCIAL_INSURANCE_RESERVE	\N	f	t	t	f	98	\N	\N	2026-03-05 04:26:14.195	2026-03-05 04:26:14.195
cmmcyqtrm000narvdb7hggfva	cmmcyqtqy0009arvd3241xwgv	\N	\N	\N	\N	\N	CONSUMPTION_TAX_RESERVE	\N	f	t	t	f	99	\N	\N	2026-03-05 04:26:14.195	2026-03-05 04:26:14.195
cmmcyqtrp000oarvdi00di5qa	cmmcyqtqz000aarvd4yvizpwx	\N	\N	\N	\N	\N	SOCIAL_INSURANCE_RESERVE	\N	f	t	t	f	98	\N	\N	2026-03-05 04:26:14.198	2026-03-05 04:26:14.198
cmmcyqtrp000parvdeuhkdpao	cmmcyqtqz000aarvd4yvizpwx	\N	\N	\N	\N	\N	CONSUMPTION_TAX_RESERVE	\N	f	t	t	f	99	\N	\N	2026-03-05 04:26:14.198	2026-03-05 04:26:14.198
cmmcyqtrt000qarvde0mr7iu1	cmmcyqtqt0002arvdnsqm94mt	\N	\N	\N	\N	\N	SOCIAL_INSURANCE_RESERVE	\N	f	t	t	f	98	\N	\N	2026-03-05 04:26:14.201	2026-03-05 04:26:14.201
cmmcyqtrt000rarvdxd7eomda	cmmcyqtqt0002arvdnsqm94mt	\N	\N	\N	\N	\N	CONSUMPTION_TAX_RESERVE	\N	f	t	t	f	99	\N	\N	2026-03-05 04:26:14.201	2026-03-05 04:26:14.201
cmmcyqtrw000sarvd77tlvzat	cmmcyqtqy0007arvdljraw767	\N	\N	\N	\N	\N	SOCIAL_INSURANCE_RESERVE	\N	f	t	t	f	98	\N	\N	2026-03-05 04:26:14.204	2026-03-05 04:26:14.204
cmmcyqtrw000tarvd9i9p8hhk	cmmcyqtqy0007arvdljraw767	\N	\N	\N	\N	\N	CONSUMPTION_TAX_RESERVE	\N	f	t	t	f	99	\N	\N	2026-03-05 04:26:14.204	2026-03-05 04:26:14.204
cmmcyqtry000uarvd3ag2s6eq	cmmcyqtr2000barvdzxdiwks3	\N	\N	\N	\N	\N	SOCIAL_INSURANCE_RESERVE	\N	f	t	t	f	98	\N	\N	2026-03-05 04:26:14.207	2026-03-05 04:26:14.207
cmmcyqtry000varvddp1qwr3n	cmmcyqtr2000barvdzxdiwks3	\N	\N	\N	\N	\N	CONSUMPTION_TAX_RESERVE	\N	f	t	t	f	99	\N	\N	2026-03-05 04:26:14.207	2026-03-05 04:26:14.207
cmmcyqts1000warvdefy36rgf	cmmcyqtqx0006arvdz6aolm8e	\N	\N	\N	\N	\N	SOCIAL_INSURANCE_RESERVE	\N	f	t	t	f	98	\N	\N	2026-03-05 04:26:14.21	2026-03-05 04:26:14.21
cmmcyqts1000xarvdpumwdwz2	cmmcyqtqx0006arvdz6aolm8e	\N	\N	\N	\N	\N	CONSUMPTION_TAX_RESERVE	\N	f	t	t	f	99	\N	\N	2026-03-05 04:26:14.21	2026-03-05 04:26:14.21
cmmcyqts5000yarvdm20oagij	cmmcyqtqn0001arvdtq5k2dqy	\N	\N	\N	\N	\N	SOCIAL_INSURANCE_RESERVE	\N	f	t	t	f	98	\N	\N	2026-03-05 04:26:14.213	2026-03-05 04:26:14.213
cmmcyqts5000zarvdgneuhb0w	cmmcyqtqn0001arvdtq5k2dqy	\N	\N	\N	\N	\N	CONSUMPTION_TAX_RESERVE	\N	f	t	t	f	99	\N	\N	2026-03-05 04:26:14.213	2026-03-05 04:26:14.213
cmmcyqts80011arvd35y96bh6	cmmcyqtqg0000arvdkrit0l53	千葉銀行	0134	松戸支店	201	1234567	ORDINARY	ｵｺｼｺｳｷﾞﾖｳ	t	f	t	t	1	\N	\N	2026-03-05 04:26:14.216	2026-03-05 04:26:14.216
cmmcyqtyd006darvd8cwm68ch	cmmcyqtqg0000arvdkrit0l53	京葉銀行	0137	松戸支店	101	7654321	ORDINARY	ｵｺｼｺｳｷﾞﾖｳ	f	f	t	t	2	\N	\N	2026-03-05 04:26:14.437	2026-03-05 04:26:14.437
cmmcyqtyg006farvdk9q1p5mu	cmmcyqtqv0005arvd9ihg7rjq	千葉銀行	0134	柏支店	202	9876543	ORDINARY	ｵｺｼｸﾞﾙｰﾌﾟ	t	f	t	t	1	\N	\N	2026-03-05 04:26:14.441	2026-03-05 04:26:14.441
\.


--
-- Data for Name: audit_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.audit_logs (id, "tableName", "recordId", operation, "userId", "timestamp", "beforeData", "afterData", reason) FROM stdin;
cmmcyqu4f00azarvd2nn90k5d	transactions	cmmcyqu05007qarvdh6h2mgoc	CONFIRM	system	2026-02-28 00:00:00	\N	{"status": "CONFIRMED"}	\N
cmmcyqu4f00b0arvd8eqgyipg	month_closes	cmmcyqtqg0000arvdkrit0l53	MONTH_CLOSE	system	2026-03-05 00:00:00	\N	{"isClosed": true, "yearMonth": "2026-02"}	\N
cmmcyqu4f00b1arvdwpg7snzb	transactions	cmmcyqu0y008aarvdv6czdaju	CREATE	system	2026-03-05 00:00:00	\N	{"type": "TRANSFER", "amount": -500000}	\N
cmmcyu2lg0000fqaxudtk63bu	transactions	cmmcyqu0h007warvd0nsjocgg	UPDATE	RtlWlabUnwLwaxO0eotyKt9xarDBKAOn	2026-03-05 04:28:45.604	{"status": "DRAFT"}	{"status": "READY"}	\N
cmn2v2i6s00005egmwfixum5i	transactions	cmmcyqu0h007warvd0nsjocgg	UPDATE	CRfV8ZUDP2HxdIelKO3D6r1pKuHBYbGn	2026-03-23 07:25:21.173	{"accountingMonth": "2026-03"}	{"action": "DEFER", "accountingMonth": "2026-04"}	\N
cmn2v3a8p00015egmnae9rc9c	transactions	cmmcyqu0u0086arvdagztofey	UPDATE	CRfV8ZUDP2HxdIelKO3D6r1pKuHBYbGn	2026-03-23 07:25:57.53	{"accountingMonth": "2026-03"}	{"action": "DEFER", "accountingMonth": "2026-04"}	\N
cmn2ve6tx00025egmj1cz0lvt	transactions	cmmcyqtz2006uarvdp506awrm	UPDATE	CRfV8ZUDP2HxdIelKO3D6r1pKuHBYbGn	2026-03-23 07:34:26.325	{"id": "cmmcyqtz2006uarvdp506awrm", "type": "EXPENSE", "amount": "-15000", "status": "DRAFT", "readyAt": null, "readyBy": null, "summary": "3月分 本社回線利用料", "parentId": null, "accountId": "cmmcyqts80011arvd35y96bh6", "companyId": "cmmcyqtqg0000arvdkrit0l53", "createdAt": "2026-03-05T04:26:14.462Z", "partnerId": "cmmcyqtx1005garvd5nzr2vl6", "updatedAt": "2026-03-23T07:18:47.906Z", "confirmedAt": null, "confirmedBy": null, "hasEvidence": false, "invoiceDate": null, "actualAmount": null, "displayOrder": 1, "invoiceAmount": null, "paymentMethod": "DIRECT_DEBIT", "scheduledDate": null, "classification": "FIXED", "recordedAmount": null, "transferAmount": null, "accountingMonth": "2026-03", "amountUpdatedAt": null, "estimatedAmount": null, "transactionDate": "2026-03-25T00:00:00.000Z", "linkedTransactionId": null, "cashWithdrawalBatchId": null}	{"amount": "-15000", "summary": "3月分 本社回線利用料", "accountId": "cmmcyqts80011arvd35y96bh6", "partnerId": "cmmcyqtx1005garvd5nzr2vl6", "paymentMethod": "DIRECT_DEBIT", "accountingMonth": "2026-03", "transactionDate": "2026-03-25"}	\N
cmn2veguc00045egmni68fezs	transactions	cmmcyqtzd0072arvd0hdwomx8	UPDATE	CRfV8ZUDP2HxdIelKO3D6r1pKuHBYbGn	2026-03-23 07:34:39.301	{"id": "cmmcyqtzd0072arvd0hdwomx8", "type": "EXPENSE", "amount": "-8500", "status": "DRAFT", "readyAt": null, "readyBy": null, "summary": "3月分 ガス代", "parentId": null, "accountId": "cmmcyqts80011arvd35y96bh6", "companyId": "cmmcyqtqg0000arvdkrit0l53", "createdAt": "2026-03-05T04:26:14.473Z", "partnerId": "cmmcyqtx1005iarvd4zh9lxm0", "updatedAt": "2026-03-23T07:18:47.906Z", "confirmedAt": null, "confirmedBy": null, "hasEvidence": false, "invoiceDate": null, "actualAmount": null, "displayOrder": 9, "invoiceAmount": null, "paymentMethod": "DIRECT_DEBIT", "scheduledDate": null, "classification": "FIXED", "recordedAmount": null, "transferAmount": null, "accountingMonth": "2026-03", "amountUpdatedAt": null, "estimatedAmount": null, "transactionDate": "2026-03-20T00:00:00.000Z", "linkedTransactionId": null, "cashWithdrawalBatchId": null}	{"amount": "-8500", "summary": "3月分 ガス代", "accountId": "cmmcyqts80011arvd35y96bh6", "partnerId": "cmmcyqtx1005iarvd4zh9lxm0", "paymentMethod": "DIRECT_DEBIT", "accountingMonth": "2026-03", "transactionDate": "2026-03-20"}	\N
cmn2ver8t00065egmhuge9y37	transactions	cmmcyqtz9006yarvdm3gjms37	UPDATE	CRfV8ZUDP2HxdIelKO3D6r1pKuHBYbGn	2026-03-23 07:34:52.781	{"id": "cmmcyqtz9006yarvdm3gjms37", "type": "EXPENSE", "amount": "-32000", "status": "DRAFT", "readyAt": null, "readyBy": null, "summary": "3月分 電気代", "parentId": null, "accountId": "cmmcyqts80011arvd35y96bh6", "companyId": "cmmcyqtqg0000arvdkrit0l53", "createdAt": "2026-03-05T04:26:14.469Z", "partnerId": "cmmcyqtx1005karvdbtnhrz1e", "updatedAt": "2026-03-23T07:18:47.906Z", "confirmedAt": null, "confirmedBy": null, "hasEvidence": false, "invoiceDate": null, "actualAmount": null, "displayOrder": 7, "invoiceAmount": null, "paymentMethod": "DIRECT_DEBIT", "scheduledDate": null, "classification": "FIXED", "recordedAmount": null, "transferAmount": null, "accountingMonth": "2026-03", "amountUpdatedAt": null, "estimatedAmount": null, "transactionDate": "2026-03-15T00:00:00.000Z", "linkedTransactionId": null, "cashWithdrawalBatchId": null}	{"amount": "-32000", "summary": "3月分 電気代", "accountId": "cmmcyqts80011arvd35y96bh6", "partnerId": "cmmcyqtx1005karvdbtnhrz1e", "paymentMethod": "DIRECT_DEBIT", "accountingMonth": "2026-03", "transactionDate": "2026-03-15"}	\N
cmn2vk881000d5egmhw3hclxq	transactions	cmn2vk84s000a5egmk41ii1nh	CREATE	CRfV8ZUDP2HxdIelKO3D6r1pKuHBYbGn	2026-03-23 07:39:08.065	\N	{"type": "EXPENSE", "amount": "3500", "accountingMonth": "2026-03"}	\N
\.


--
-- Data for Name: bank_masters; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.bank_masters (id, "bankCode", "bankName", "bankNameKana", "isActive") FROM stdin;
cmmcyqtxb005warvd717ees4c	0001	みずほ銀行	ﾐｽﾞﾎ	t
cmmcyqtxd005xarvdq3qhytv7	0005	三菱UFJ銀行	ﾐﾂﾋﾞｼUFJ	t
cmmcyqtxg005yarvdsexfhbhq	0009	三井住友銀行	ﾐﾂｲｽﾐﾄﾓ	t
cmmcyqtxi005zarvdkobxdxl7	0010	りそな銀行	ﾘｿﾅ	t
cmmcyqtxl0060arvdae334g37	0033	PayPay銀行	ﾍﾟｲﾍﾟｲ	t
cmmcyqtxn0061arvdr1hyhdmf	0036	楽天銀行	ﾗｸﾃﾝ	t
cmmcyqtxq0062arvdqx75ic9c	0038	住信SBIネット銀行	ｽﾐｼﾝSBI	t
cmmcyqtxs0063arvdhjwsqkhp	0134	千葉銀行	ﾁﾊﾞ	t
cmmcyqtxu0064arvd1c7ab5v6	0135	千葉興業銀行	ﾁﾊﾞｺｳｷﾞﾖｳ	t
cmmcyqtxx0065arvdsw2g58jw	0137	京葉銀行	ｹｲﾖｳ	t
cmmcyqtxz0066arvdgga53y3o	1003	商工中金	ｼﾖｳｺｳﾁﾕｳｷﾝ	t
cmmcyqty20067arvdxlxcnu7t	2004	千葉信用金庫	ﾁﾊﾞｼﾝﾖｳｷﾝｺ	t
\.


--
-- Data for Name: branch_masters; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.branch_masters (id, "bankCode", "branchCode", "branchName", "branchNameKana", "isActive") FROM stdin;
cmmcyqty40068arvd3z49mcpx	0134	001	本店営業部	ﾎﾝﾃﾝ	t
cmmcyqty40069arvdvrhuh8z6	0134	201	松戸支店	ﾏﾂﾄﾞ	t
cmmcyqty4006aarvdx8yyfri9	0134	202	柏支店	ｶｼﾜ	t
cmmcyqty4006barvdlkra7c9b	0134	203	船橋支店	ﾌﾅﾊﾞｼ	t
\.


--
-- Data for Name: cash_denominations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.cash_denominations (id, "batchId", yen10000, yen5000, yen2000, yen1000, yen500, yen100, yen50, yen10, yen5, yen1, total, "purposeLabel") FROM stdin;
cmmcyqu4500asarvdewnzf0vw	cmmcyqu3z00aqarvddyc5782r	4	1	0	5	0	0	0	0	0	0	50000	現場経費
\.


--
-- Data for Name: cash_withdrawal_batches; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.cash_withdrawal_batches (id, "companyId", "accountId", "withdrawalDate", "totalAmount", status, "confirmedAt", "confirmedBy", "createdAt", "updatedAt") FROM stdin;
cmmcyqu3z00aqarvddyc5782r	cmmcyqtqg0000arvdkrit0l53	cmmcyqts80011arvd35y96bh6	2026-03-10 00:00:00	50000	DRAFT	\N	\N	2026-03-05 04:26:14.64	2026-03-05 04:26:14.64
cmn2vgkbw00085egminucd03i	cmmcyqtqg0000arvdkrit0l53	cmmcyqts80011arvd35y96bh6	2026-03-31 00:00:00	40000	DRAFT	\N	\N	2026-03-23 07:36:17.133	2026-03-23 07:36:17.133
\.


--
-- Data for Name: companies; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.companies (id, name, "nameKana", "shortName", "industryType", "representativeTitle", "representativeName", "postalCode", "addressPrefecture", "addressCity", "addressStreet", "addressBuilding", phone, fax, email, website, "corporateNumber", "invoiceNumber", "fiscalMonth", "establishedDate", status, "mainAccountId", "defaultAssigneeId", "displayOrder", notes, "createdAt", "updatedAt") FROM stdin;
cmmcyqtqn0001arvdtq5k2dqy	インフィニティグループ	\N	インフィニティ	その他	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	3	\N	ACTIVE	\N	\N	12	\N	2026-03-05 04:26:14.153	2026-03-05 04:26:14.153
cmmcyqtqu0003arvd1inrsxt3	松村建設	\N	松村建設	建設業	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	3	\N	ACTIVE	\N	\N	3	\N	2026-03-05 04:26:14.153	2026-03-05 04:26:14.153
cmmcyqtqv0004arvdgo343ms2	吉川建設	\N	吉川建設	建設業	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	3	\N	ACTIVE	\N	\N	5	\N	2026-03-05 04:26:14.153	2026-03-05 04:26:14.153
cmmcyqtqt0002arvdnsqm94mt	WINNERS	\N	WINNERS	広告業	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	3	\N	ACTIVE	\N	\N	8	\N	2026-03-05 04:26:14.153	2026-03-05 04:26:14.153
cmmcyqtqx0006arvdz6aolm8e	G-FARM	\N	G-FARM	その他	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	3	\N	ACTIVE	\N	\N	11	\N	2026-03-05 04:26:14.153	2026-03-05 04:26:14.153
cmmcyqtqy0008arvdcxys4abv	佐藤建設工業	\N	佐藤建設	建設業	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	3	\N	ACTIVE	\N	\N	4	\N	2026-03-05 04:26:14.152	2026-03-05 04:26:14.152
cmmcyqtqy0007arvdljraw767	CAREECH	\N	CAREECH	広告業	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	3	\N	ACTIVE	\N	\N	9	\N	2026-03-05 04:26:14.153	2026-03-05 04:26:14.153
cmmcyqtqy0009arvd3241xwgv	建設サポート	\N	建設サポート	建設業	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	3	\N	ACTIVE	\N	\N	6	\N	2026-03-05 04:26:14.153	2026-03-05 04:26:14.153
cmmcyqtqz000aarvd4yvizpwx	エイトグループ	\N	エイトG	建設業	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	3	\N	ACTIVE	\N	\N	7	\N	2026-03-05 04:26:14.154	2026-03-05 04:26:14.154
cmmcyqtr2000barvdzxdiwks3	WINNERS CLUB	\N	W-CLUB	その他	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	3	\N	ACTIVE	\N	\N	10	\N	2026-03-05 04:26:14.153	2026-03-05 04:26:14.153
cmmcyqtqg0000arvdkrit0l53	起工業	\N	起工業	建設業	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	3	\N	ACTIVE	cmmcyqts80011arvd35y96bh6	\N	1	\N	2026-03-05 04:26:14.152	2026-03-05 04:26:14.219
cmmcyqtqv0005arvd9ihg7rjq	起グループ	\N	起グループ	建設業	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	3	\N	ACTIVE	cmmcyqtyg006farvdk9q1p5mu	\N	2	\N	2026-03-05 04:26:14.152	2026-03-05 04:26:14.444
\.


--
-- Data for Name: deduction_categories; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.deduction_categories (id, "forType", name, "midId", "subId", "hasSubTypes", "signRule", "isActive", "displayOrder", "createdAt", "updatedAt") FROM stdin;
cmmcyqtwn004larvd4cd4mlne	SALES	前倒し入金	cmmcyqtv5003karvdw9f777jm	\N	t	{"offset": -1, "occurrence": 1}	t	1	2026-03-05 04:26:14.375	2026-03-05 04:26:14.375
cmmcyqtwn004marvd6se335mt	SALES	保留金	cmmcyqtv5003karvdw9f777jm	\N	t	{"offset": 1, "occurrence": -1}	t	2	2026-03-05 04:26:14.375	2026-03-05 04:26:14.375
cmmcyqtwn004narvdxd8pd0zr	SALES	値引	cmmcyqtv5003karvdw9f777jm	\N	f	\N	t	3	2026-03-05 04:26:14.375	2026-03-05 04:26:14.375
cmmcyqtwn004oarvd9xgdll1l	SALES	振込手数料	cmmcyqttj0021arvd1o9ez4zn	\N	f	\N	t	4	2026-03-05 04:26:14.375	2026-03-05 04:26:14.375
cmmcyqtwn004parvdldvy107q	SALES	その他控除（売上）	cmmcyqtv5003karvdw9f777jm	\N	f	\N	t	5	2026-03-05 04:26:14.375	2026-03-05 04:26:14.375
cmmcyqtwn004qarvdoq0ww4d6	COST	安全協力会費	cmmcyqtu0002jarvdfthap5o0	\N	f	\N	t	1	2026-03-05 04:26:14.375	2026-03-05 04:26:14.375
cmmcyqtwn004rarvdapxikzfu	COST	振込手数料	cmmcyqttj0021arvd1o9ez4zn	\N	f	\N	t	2	2026-03-05 04:26:14.375	2026-03-05 04:26:14.375
cmmcyqtwn004sarvdx7x5p2a6	COST	保留金	cmmcyqtvb003oarvdrjjfm1xt	\N	t	{"offset": 1, "occurrence": -1}	t	3	2026-03-05 04:26:14.375	2026-03-05 04:26:14.375
cmmcyqtwn004tarvdlnmyxw6j	COST	値引/値上	cmmcyqtvb003oarvdrjjfm1xt	\N	f	\N	t	4	2026-03-05 04:26:14.375	2026-03-05 04:26:14.375
cmmcyqtwn004uarvdav0frkaf	COST	その他控除（原価）	cmmcyqtvb003oarvdrjjfm1xt	\N	f	\N	t	5	2026-03-05 04:26:14.375	2026-03-05 04:26:14.375
\.


--
-- Data for Name: evidences; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.evidences (id, "transactionId", "fileName", "fileUrl", "fileSize", "mimeType", "uploadedBy", "uploadedAt") FROM stdin;
\.


--
-- Data for Name: fund_transfers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.fund_transfers (id, "transactionId", "fromAccountId", "toAccountId", "transferDate", amount, "counterCompanyId", "counterTransactionId", "createdAt", "updatedAt") FROM stdin;
cmmcyqu11008carvdi08jx4we	cmmcyqu0y008aarvdv6czdaju	cmmcyqts80011arvd35y96bh6	cmmcyqtyd006darvd8cwm68ch	2026-03-05 00:00:00	500000	\N	\N	2026-03-05 04:26:14.533	2026-03-05 04:26:14.533
cmmcyqu18008garvd2h4oh3qm	cmmcyqu14008earvdxydrtxm1	cmmcyqts80011arvd35y96bh6	cmmcyqtyg006farvdk9q1p5mu	2026-03-15 00:00:00	1000000	cmmcyqtqv0005arvd9ihg7rjq	\N	2026-03-05 04:26:14.54	2026-03-05 04:26:14.54
cmn2wanrs000v5egm7qp6sorc	cmn2wanqn000r5egmxqsa6ng1	cmmcyqts80011arvd35y96bh6	cmmcyqtr5000carvd1mzcbnrx	2026-03-23 07:59:41.271	180000	\N	\N	2026-03-23 07:59:41.272	2026-03-23 07:59:41.272
cmn2wans600115egmhjh9s9l0	cmn2wanrw000x5egmvt2cx37i	cmmcyqts80011arvd35y96bh6	cmmcyqtr5000darvd3oxykto3	2026-03-23 07:59:41.286	120000	\N	\N	2026-03-23 07:59:41.287	2026-03-23 07:59:41.287
\.


--
-- Data for Name: lease_contracts; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.lease_contracts (id, "companyId", "partnerId", "contractName", "monthlyAmount", "startDate", "endDate", "totalPayments", "paymentDay", "holidayAdjust", "principalAdjust", "accountId", "midId", "subId", status, "createdAt", "updatedAt") FROM stdin;
cmmcyqu2u009varvdk9r8ozsv	cmmcyqtqg0000arvdkrit0l53	cmmcyqtx1005rarvdpanvxlvg	社用車リース（ハイエース）	55000	2025-04-01 00:00:00	2030-03-31 00:00:00	60	27	PREV_BUSINESS	LAST	cmmcyqts80011arvd35y96bh6	cmmcyqtt7001qarvdw7f7vius	cmmcyqtt9001rarvdqcif7b3s	ACTIVE	2026-03-05 04:26:14.598	2026-03-05 04:26:14.598
cmmcyqu3c00a9arvdse9yh30q	cmmcyqtqg0000arvdkrit0l53	cmmcyqtx1005rarvdpanvxlvg	複合機リース（キヤノン）	18000	2025-10-01 00:00:00	2030-09-30 00:00:00	60	5	NEXT_BUSINESS	LAST	cmmcyqts80011arvd35y96bh6	cmmcyqtt7001qarvdw7f7vius	cmmcyqtt9001sarvd3d2pwabw	ACTIVE	2026-03-05 04:26:14.617	2026-03-05 04:26:14.617
\.


--
-- Data for Name: lease_schedules; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.lease_schedules (id, "contractId", "paymentNumber", "dueDate", amount, "isPaid", "transactionId") FROM stdin;
cmmcyqu2x009xarvd8fs0rdf6	cmmcyqu2u009varvdk9r8ozsv	12	2026-03-27 00:00:00	55000	t	\N
cmmcyqu30009zarvd0n0zo6jg	cmmcyqu2u009varvdk9r8ozsv	13	2026-04-27 00:00:00	55000	f	\N
cmmcyqu3300a1arvdqih39ity	cmmcyqu2u009varvdk9r8ozsv	14	2026-05-27 00:00:00	55000	f	\N
cmmcyqu3500a3arvdh3oi4c7e	cmmcyqu2u009varvdk9r8ozsv	15	2026-06-27 00:00:00	55000	f	\N
cmmcyqu3700a5arvdtub1il6y	cmmcyqu2u009varvdk9r8ozsv	16	2026-07-27 00:00:00	55000	f	\N
cmmcyqu3a00a7arvd9bmh7nf2	cmmcyqu2u009varvdk9r8ozsv	17	2026-08-27 00:00:00	55000	f	\N
cmmcyqu3f00abarvdaz9v2noe	cmmcyqu3c00a9arvdse9yh30q	6	2026-03-05 00:00:00	18000	t	\N
cmmcyqu3h00adarvd5vnz6euz	cmmcyqu3c00a9arvdse9yh30q	7	2026-04-05 00:00:00	18000	f	\N
cmmcyqu3k00afarvd7nhltv7v	cmmcyqu3c00a9arvdse9yh30q	8	2026-05-05 00:00:00	18000	f	\N
cmmcyqu3m00aharvdrydo3spq	cmmcyqu3c00a9arvdse9yh30q	9	2026-06-05 00:00:00	18000	f	\N
cmmcyqu3o00ajarvddphdj6ux	cmmcyqu3c00a9arvdse9yh30q	10	2026-07-05 00:00:00	18000	f	\N
cmmcyqu3r00alarvd6o04hwo1	cmmcyqu3c00a9arvdse9yh30q	11	2026-08-05 00:00:00	18000	f	\N
\.


--
-- Data for Name: loan_contracts; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.loan_contracts (id, "companyId", "partnerId", "contractName", "principalAmount", "executionDate", "repaymentStartDate", "repaymentMethod", "repaymentFrequency", "repaymentDay", "holidayAdjust", "totalPayments", "completionDate", "interestType", "interestRate", "interestTiming", "dayCountBasis", "roundingRule", "principalAdjust", "interestHistory", "remainingBalance", status, "createdAt", "updatedAt") FROM stdin;
cmmcyqu1s0093arvdl3q18kdc	cmmcyqtqg0000arvdkrit0l53	cmmcyqtx1005uarvdvvfshf3m	千葉銀行 設備資金	30000000	2025-04-01 00:00:00	2025-05-01 00:00:00	EQUAL_PRINCIPAL	MONTHLY	1	NEXT_BUSINESS	60	2030-04-01 00:00:00	FIXED	1.500000000000000000000000000000	ARREAR	365	ROUND_HALF_UP	LAST	\N	24500000	ACTIVE	2026-03-05 04:26:14.56	2026-03-05 04:26:14.56
cmmcyqu2b009harvd7j5ald0i	cmmcyqtqg0000arvdkrit0l53	cmmcyqtx1005parvdctp03pw3	商工中金 運転資金	10000000	2026-01-15 00:00:00	2026-07-15 00:00:00	GRACE	MONTHLY	15	PREV_BUSINESS	36	\N	VARIABLE	2.000000000000000000000000000000	ARREAR	365	ROUND_HALF_UP	LAST	[{"rate": 2, "effectiveDate": "2026-01-15"}]	10000000	ACTIVE	2026-03-05 04:26:14.579	2026-03-05 04:26:14.579
\.


--
-- Data for Name: loan_schedules; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.loan_schedules (id, "contractId", "paymentNumber", "dueDate", "principalAmount", "interestAmount", "totalAmount", "remainingBalance", "isPaid", "transactionId") FROM stdin;
cmmcyqu1w0095arvdu6gdt78g	cmmcyqu1s0093arvdl3q18kdc	11	2026-03-01 00:00:00	500000	30625	530625	24500000	t	\N
cmmcyqu1z0097arvd06u8y4mu	cmmcyqu1s0093arvdl3q18kdc	12	2026-04-01 00:00:00	500000	30000	530000	24000000	f	\N
cmmcyqu210099arvdohegfisn	cmmcyqu1s0093arvdl3q18kdc	13	2026-05-01 00:00:00	500000	29375	529375	23500000	f	\N
cmmcyqu24009barvdhflq4vhi	cmmcyqu1s0093arvdl3q18kdc	14	2026-06-01 00:00:00	500000	28750	528750	23000000	f	\N
cmmcyqu26009darvd539c9nv7	cmmcyqu1s0093arvdl3q18kdc	15	2026-07-01 00:00:00	500000	28125	528125	22500000	f	\N
cmmcyqu29009farvd0td9wkmu	cmmcyqu1s0093arvdl3q18kdc	16	2026-08-01 00:00:00	500000	27500	527500	22000000	f	\N
cmmcyqu2f009jarvdawyt5n7n	cmmcyqu2b009harvd7j5ald0i	1	2026-02-15 00:00:00	0	16667	16667	10000000	t	\N
cmmcyqu2h009larvdfgw59prm	cmmcyqu2b009harvd7j5ald0i	2	2026-03-15 00:00:00	0	16667	16667	10000000	t	\N
cmmcyqu2k009narvdvewvlaun	cmmcyqu2b009harvd7j5ald0i	3	2026-04-15 00:00:00	0	16667	16667	10000000	f	\N
cmmcyqu2m009parvd56zae9x2	cmmcyqu2b009harvd7j5ald0i	4	2026-05-15 00:00:00	0	16667	16667	10000000	f	\N
cmmcyqu2p009rarvd45glsl2f	cmmcyqu2b009harvd7j5ald0i	5	2026-06-15 00:00:00	0	16667	16667	10000000	f	\N
cmmcyqu2r009tarvd1qz4t2h6	cmmcyqu2b009harvd7j5ald0i	6	2026-07-15 00:00:00	0	16667	16667	10000000	f	\N
\.


--
-- Data for Name: month_closes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.month_closes (id, "companyId", "yearMonth", "isClosed", "closedAt", "closedBy", "reopenedAt", "reopenedBy", "reopenReason") FROM stdin;
cmmcyqu4c00ayarvdk78d4uyi	cmmcyqtqg0000arvdkrit0l53	2026-02	t	2026-03-05 00:00:00	system	\N	\N	\N
\.


--
-- Data for Name: monthly_balances; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.monthly_balances (id, "companyId", "accountId", "yearMonth", "openingBalance", "closingBalance", "createdAt", "updatedAt") FROM stdin;
cmmcyqtyn006garvdc4dkogso	cmmcyqtqg0000arvdkrit0l53	cmmcyqtyd006darvd8cwm68ch	2026-03	2000000	2000000	2026-03-05 04:26:14.447	2026-03-05 04:26:14.447
cmmcyqtyn006harvduojgn99c	cmmcyqtqg0000arvdkrit0l53	cmmcyqts80011arvd35y96bh6	2026-02	4500000	5000000	2026-03-05 04:26:14.447	2026-03-05 04:26:14.447
cmmcyqtyn006iarvdar2yg2dt	cmmcyqtqg0000arvdkrit0l53	cmmcyqtyd006darvd8cwm68ch	2026-02	1800000	2000000	2026-03-05 04:26:14.447	2026-03-05 04:26:14.447
cmmcyqtyn006jarvd6qj9uc7c	cmmcyqtqv0005arvd9ihg7rjq	cmmcyqtyg006farvdk9q1p5mu	2026-03	8000000	8000000	2026-03-05 04:26:14.447	2026-03-05 04:26:14.447
cmmcyqtx7005varvdmakl2dk8	cmmcyqtqg0000arvdkrit0l53	cmmcyqts80011arvd35y96bh6	2026-03	5000000	7590950	2026-03-05 04:26:14.396	2026-03-23 07:18:47.922
\.


--
-- Data for Name: payroll_groups; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.payroll_groups (id, "companyId", name, "costType", "midId", "payDay", "payDayIsMonthEnd", "holidayAdjust", "defaultAccountId", "defaultCashAccountId", "deductionPresets", headcount, "isActive", "displayOrder", "createdAt", "updatedAt") FROM stdin;
cmmcyqtwr004yarvdqi0kn280	cmmcyqtqg0000arvdkrit0l53	工事部門	COST	\N	\N	f	\N	\N	\N	\N	0	t	1	2026-03-05 04:26:14.379	2026-03-05 04:26:14.379
cmmcyqtwr0050arvdfy489ks5	cmmcyqtqg0000arvdkrit0l53	営業部門	SGA	\N	\N	f	\N	\N	\N	\N	0	t	2	2026-03-05 04:26:14.379	2026-03-05 04:26:14.379
cmmcyqtwr004zarvdz8h39nb3	cmmcyqtqg0000arvdkrit0l53	管理部門	SGA	\N	\N	f	\N	\N	\N	\N	0	t	3	2026-03-05 04:26:14.379	2026-03-05 04:26:14.379
\.


--
-- Data for Name: recurring_templates; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.recurring_templates (id, "companyId", name, frequency, "specificMonths", "startMonth", "dueDayRule", "holidayAdjust", "transactionType", "accountId", "partnerId", "midId", "subId", "amountType", "fixedAmount", "paymentMethod", classification, summary, "assigneeId", "isActive", "lastGeneratedMonth", "createdAt", "updatedAt") FROM stdin;
cmmcyqu4900awarvdhy3jr0p7	cmmcyqtqg0000arvdkrit0l53	固定資産税	SPECIFIC_MONTHS	{5,7,12,2}	\N	MONTH_END	PREV_BUSINESS	EXPENSE	cmmcyqts80011arvd35y96bh6	\N	cmmcyqtv0003garvd6k16ftid	\N	FIXED	85000	BANK_TRANSFER	FIXED	固定資産税	\N	t	\N	2026-03-05 04:26:14.649	2026-03-05 04:26:14.649
cmmcyqu4900atarvdf9r6ki8n	cmmcyqtqg0000arvdkrit0l53	NTT 本社回線	MONTHLY	\N	\N	DAY_25	PREV_BUSINESS	EXPENSE	cmmcyqts80011arvd35y96bh6	cmmcyqtx1005garvd5nzr2vl6	cmmcyqtss001earvdijgiktyg	\N	FIXED	15000	DIRECT_DEBIT	FIXED	本社回線利用料	\N	t	2026-04	2026-03-05 04:26:14.649	2026-03-23 07:45:15.263
cmmcyqu4900auarvdvyj2ss9g	cmmcyqtqg0000arvdkrit0l53	事務所家賃	MONTHLY	\N	\N	DAY_27	PREV_BUSINESS	EXPENSE	cmmcyqts80011arvd35y96bh6	\N	cmmcyqtt5001oarvdpls32r3g	\N	FIXED	120000	BANK_TRANSFER	FIXED	事務所賃料	\N	t	2026-04	2026-03-05 04:26:14.649	2026-03-23 07:45:15.277
cmmcyqu4900avarvd2e1p0611	cmmcyqtqg0000arvdkrit0l53	車両リース	MONTHLY	\N	\N	DAY_27	PREV_BUSINESS	EXPENSE	cmmcyqts80011arvd35y96bh6	cmmcyqtx1005rarvdpanvxlvg	cmmcyqtt7001qarvdw7f7vius	\N	FIXED	55000	DIRECT_DEBIT	FIXED	ハイエース リース料	\N	t	2026-04	2026-03-05 04:26:14.649	2026-03-23 07:45:15.289
\.


--
-- Data for Name: salary_deductions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.salary_deductions (id, "salaryEntryId", "itemName", amount, "midId", "subId", "contentRows", "displayOrder") FROM stdin;
cmmcyqu1b008jarvd775a05wg	cmmcyqu1b008iarvdrcdhzwpm	家賃控除	180000	\N	\N	\N	1
cmmcyqu1b008karvddz3mejeh	cmmcyqu1b008iarvdrcdhzwpm	通信費控除	45000	\N	\N	\N	2
cmmcyqu1b008larvd1ydg47b3	cmmcyqu1b008iarvdrcdhzwpm	立替経費	80000	\N	\N	\N	3
cmmcyqu1b008marvdhh24fcc8	cmmcyqu1b008iarvdrcdhzwpm	社会保険料(合算)	120000	\N	\N	\N	4
cmmcyqu1b008narvdmpd0f4lp	cmmcyqu1b008iarvdrcdhzwpm	源泉納税(合算)	55000	\N	\N	\N	5
cmmcyqu1h008sarvdsf2dknhj	cmmcyqu1h008rarvdz2hc0gdr	家賃控除	80000	\N	\N	\N	1
cmmcyqu1h008tarvd75fi66ct	cmmcyqu1h008rarvdz2hc0gdr	社会保険料(合算)	85000	\N	\N	\N	2
cmmcyqu1h008uarvdv7afw747	cmmcyqu1h008rarvdz2hc0gdr	源泉納税(合算)	45000	\N	\N	\N	3
cmmcyqu1m008yarvdhfhtrdy4	cmmcyqu1m008xarvd3xmgaz17	家賃控除	60000	\N	\N	\N	1
cmmcyqu1m008zarvd3lvhdk7q	cmmcyqu1m008xarvd3xmgaz17	社会保険料(合算)	55000	\N	\N	\N	2
cmmcyqu1m0090arvd1k9d2ada	cmmcyqu1m008xarvd3xmgaz17	源泉納税(合算)	35000	\N	\N	\N	3
\.


--
-- Data for Name: salary_entries; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.salary_entries (id, "payrollGroupId", "payMonth", "payDate", "taxablePayment", "transportAllowance", "miscExpenses", "carryoverAdjust", "advanceExpenses", "totalPayment", "socialInsuranceReserve", "consumptionTaxReserve", "totalDeduction", "netPayment", headcount, status, "confirmedAt", "confirmedBy", "createdAt", "updatedAt") FROM stdin;
cmmcyqu1b008iarvdrcdhzwpm	cmmcyqtwr004yarvdqi0kn280	2026-03	2026-03-25 00:00:00	2500000	150000	30000	0	50000	2730000	375000	250000	480000	2250000	15	READY	\N	\N	2026-03-05 04:26:14.543	2026-03-05 04:26:14.543
cmmcyqu1m008xarvd3xmgaz17	cmmcyqtwr004zarvdz8h39nb3	2026-02	2026-02-25 00:00:00	800000	40000	0	0	0	840000	120000	80000	150000	690000	3	CONFIRMED	2026-02-24 00:00:00	\N	2026-03-05 04:26:14.555	2026-03-05 04:26:14.555
cmmcyqu1h008rarvdz2hc0gdr	cmmcyqtwr0050arvdfy489ks5	2026-03	2026-03-25 00:00:00	1200000	80000	0	0	20000	1300000	180000	120000	210000	1090000	5	READY	\N	\N	2026-03-05 04:26:14.55	2026-03-23 07:59:41.29
\.


--
-- Data for Name: salary_journal_mappings; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.salary_journal_mappings (id, "deductionItemName", "majorId", "midId", "subId", classification, "isActive") FROM stdin;
cmmcyqtwx0051arvdzfgh862e	家賃控除	cmmcyqtse0014arvddopu5h46	cmmcyqtsy001karvdswtdbm0u	\N	FIXED	t
cmmcyqtwx0052arvd3ege6nns	通信費控除	cmmcyqtse0014arvddopu5h46	cmmcyqtss001earvdijgiktyg	\N	VARIABLE	t
cmmcyqtwx0053arvds6lsqccb	立替経費	cmmcyqtse0014arvddopu5h46	cmmcyqtuq0038arvd03l7u62a	\N	VARIABLE	t
cmmcyqtwx0054arvdnts1kk1e	印紙/在庫品	cmmcyqtse0014arvddopu5h46	cmmcyqttu002earvdgy2u1c71	\N	VARIABLE	t
cmmcyqtwx0055arvdesg5tkei	光熱費控除	cmmcyqtse0014arvddopu5h46	cmmcyqtsk0019arvdey5qf37l	\N	VARIABLE	t
cmmcyqtwx0056arvddu4ez7wq	保険料控除	cmmcyqtse0014arvddopu5h46	cmmcyqttc001uarvdg8txtzyy	\N	FIXED	t
cmmcyqtwx0057arvd8sbnlttz	交通費	cmmcyqtse0014arvddopu5h46	cmmcyqtto0028arvdjwq5k13x	\N	VARIABLE	t
cmmcyqtwx0058arvdhuja6zjv	社会保険料(合算)	cmmcyqtse0016arvdu9s69q20	cmmcyqtw1004aarvd79o72uat	\N	FIXED	t
cmmcyqtwx0059arvd1gws0s8n	源泉納税(合算)	cmmcyqtse0016arvdu9s69q20	cmmcyqtw6004darvd983o9r4d	\N	FIXED	t
cmmcyqtwx005aarvd4wssduox	貸金/立替金	cmmcyqtse0016arvdu9s69q20	cmmcyqtwc004garvdy4k4nbhb	\N	VARIABLE	t
cmmcyqtwx005barvdwmfk0h57	積立金	cmmcyqtse0016arvdu9s69q20	cmmcyqtwh004jarvdzh2gahl1	\N	FIXED	t
cmmcyqtwx005carvdyjjl5n4l	WINNERS立替営業交通費	cmmcyqtse0013arvd4fobfxas	cmmcyqtvi003uarvdaqisd85c	\N	VARIABLE	t
\.


--
-- Data for Name: salary_payment_details; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.salary_payment_details (id, "salaryEntryId", "paymentDate", "paymentMethod", "accountId", amount, "displayOrder") FROM stdin;
cmmcyqu1b008oarvdei9lkmaf	cmmcyqu1b008iarvdrcdhzwpm	2026-03-25 00:00:00	BANK_TRANSFER	cmmcyqts80011arvd35y96bh6	2100000	1
cmmcyqu1b008parvd31s4bo8p	cmmcyqu1b008iarvdrcdhzwpm	2026-03-25 00:00:00	CASH_WITHDRAWAL	cmmcyqts80011arvd35y96bh6	150000	2
cmmcyqu1h008varvdwplgv14a	cmmcyqu1h008rarvdz2hc0gdr	2026-03-25 00:00:00	BANK_TRANSFER	cmmcyqts80011arvd35y96bh6	1090000	1
cmmcyqu1m0091arvdspgrv5un	cmmcyqu1m008xarvd3xmgaz17	2026-02-25 00:00:00	BANK_TRANSFER	cmmcyqts80011arvd35y96bh6	690000	1
\.


--
-- Data for Name: session; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.session (id, "expiresAt", token, "createdAt", "updatedAt", "ipAddress", "userAgent", "userId") FROM stdin;
cX32kFxbZE2FyYVLTBl74Klzzvh8R1ob	2026-03-11 08:40:15.78	N9segGzy7yazo5CAlPzVuVz17OChQQT3	2026-03-04 08:40:15.78	2026-03-04 08:40:15.78	127.0.0.1	curl/8.14.1	dZ68C4DTqitvoLGwkpcqQvaH6s7wwH3a
P1QtbFNXaOWhrg2p9B3HZAAKaWDzWQUr	2026-03-11 08:40:21.931	ZnLofzy7oMj4pN8aohlq617X6HyWhGVu	2026-03-04 08:40:21.932	2026-03-04 08:40:21.932	127.0.0.1	curl/8.14.1	dZ68C4DTqitvoLGwkpcqQvaH6s7wwH3a
NfCd3uPkaQZI2fYW2jEbCuWEJdJcA0Sz	2026-03-11 08:41:08.975	SMiEy1mSRTcVjpXoNB6CE7TP4UDRcx7a	2026-03-04 08:41:08.975	2026-03-04 08:41:08.975	127.0.0.1	curl/8.14.1	dZ68C4DTqitvoLGwkpcqQvaH6s7wwH3a
RnqXPpfh2Upi2HbvzK7ELpe7mRWe3mR1	2026-03-11 08:44:39.245	j6HW3FvVUCZ06ARZT9gB9yVonlwzWUCY	2026-03-04 08:44:39.246	2026-03-04 08:44:39.246	127.0.0.1	curl/8.14.1	dZ68C4DTqitvoLGwkpcqQvaH6s7wwH3a
53xtoBy21dOHheRoDEO1oYxtD5AEJ7bk	2026-03-12 00:21:41.729	hndCOptlPDE03oY10LruRNmLk8Zs8Wph	2026-03-05 00:21:41.73	2026-03-05 00:21:41.73	127.0.0.1	curl/8.14.1	dZ68C4DTqitvoLGwkpcqQvaH6s7wwH3a
9JzocA7dkwKNF98rUtPmVJXchdmPdhLJ	2026-03-15 12:44:01.99	dMDqkC2bzZqln359bx6YlLAcd6LC6BFe	2026-03-05 01:07:37.329	2026-03-08 12:44:01.99	114.177.106.13	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36	RtlWlabUnwLwaxO0eotyKt9xarDBKAOn
qW24uS8chd7rJreF4UJGXON4yBG4WL84	2026-03-15 14:16:59.381	wgo8QuzBgwKEGXDDPwFY7CBKeZ2vMR2L	2026-03-05 01:43:42.321	2026-03-08 14:16:59.381	114.177.106.13	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36	RtlWlabUnwLwaxO0eotyKt9xarDBKAOn
NvahCosVZE6NLB36HtlXTLI9AqGdU1Xy	2026-03-30 05:25:01.321	TacmTeDoY39zDLghMVacKU4VToYJRQ3k	2026-03-23 05:25:01.322	2026-03-23 05:25:01.322	123.222.173.164	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36	CRfV8ZUDP2HxdIelKO3D6r1pKuHBYbGn
zdasi2CBbZMnwZwvepfor2OxjHTUlm8e	2026-03-30 05:26:38.548	BZZk819sUnwidfWl3geOyTBylICtsd4v	2026-03-23 05:26:38.548	2026-03-23 05:26:38.548	114.177.106.13	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36	RtlWlabUnwLwaxO0eotyKt9xarDBKAOn
\.


--
-- Data for Name: trading_partner_bank_accounts; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.trading_partner_bank_accounts (id, "partnerId", "bankCode", "branchCode", "accountType", "accountNumber", "accountHolder", "isActive", "createdAt", "updatedAt") FROM stdin;
cmmcyqtyr006karvdfwdp1lwn	cmmcyqtx1005garvd5nzr2vl6	0001	001	ORDINARY	1111111	ｴﾇﾃｨﾃｨﾋｶﾞｼﾆﾎﾝ	t	2026-03-05 04:26:14.451	2026-03-05 04:26:14.451
cmmcyqtyr006larvdkjm22rwy	cmmcyqtx1005jarvdtorqpw40	0134	201	ORDINARY	2222222	ｻﾝｶｸｺｳﾑﾃﾝ	t	2026-03-05 04:26:14.451	2026-03-05 04:26:14.451
cmmcyqtyr006marvd6djp0e7c	cmmcyqtx1005tarvdidm8p0gr	0009	001	ORDINARY	3333333	ﾏﾙﾏﾙｹﾝｾﾂ	t	2026-03-05 04:26:14.451	2026-03-05 04:26:14.451
\.


--
-- Data for Name: trading_partner_defaults; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.trading_partner_defaults (id, "partnerId", "midId", "subId") FROM stdin;
cmmcyqtyu006narvdvjza3gxk	cmmcyqtx1005garvd5nzr2vl6	cmmcyqtss001earvdijgiktyg	\N
cmmcyqtyu006oarvdn8j1maar	cmmcyqtx1005karvdbtnhrz1e	cmmcyqtsk0019arvdey5qf37l	\N
cmmcyqtyu006parvdi37x183k	cmmcyqtx1005iarvd4zh9lxm0	cmmcyqtsk0019arvdey5qf37l	\N
cmmcyqtyu006qarvdc3ohqg3d	cmmcyqtx1005jarvdtorqpw40	cmmcyqtvb003oarvdrjjfm1xt	\N
\.


--
-- Data for Name: trading_partner_sites; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.trading_partner_sites (id, "partnerId", "siteName", frequency, "specificMonths", "startMonth", "dueDayRule", "holidayAdjust", "amountType", "fixedAmount", "assigneeId", "midId", "subId", "isActive", "createdAt", "updatedAt") FROM stdin;
cmmcyqtyy006sarvdvllrsjlx	cmmcyqtx1005garvd5nzr2vl6	本社回線	MONTHLY	\N	\N	DAY_25	PREV_BUSINESS	FIXED	15000	\N	cmmcyqtss001earvdijgiktyg	\N	t	2026-03-05 04:26:14.458	2026-03-05 04:26:14.458
\.


--
-- Data for Name: trading_partners; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.trading_partners (id, "companyId", name, "nameKana", type, "tagKey", "tagDisplayName", "isActive", notes, "createdAt", "updatedAt") FROM stdin;
cmmcyqtx1005karvdbtnhrz1e	cmmcyqtqg0000arvdkrit0l53	東京電力	\N	VENDOR	EXPENSE	\N	t	\N	2026-03-05 04:26:14.389	2026-03-05 04:26:14.389
cmmcyqtx1005jarvdtorqpw40	cmmcyqtqg0000arvdkrit0l53	△△工務店	\N	VENDOR	SUBCONTRACTOR	\N	t	\N	2026-03-05 04:26:14.389	2026-03-05 04:26:14.389
cmmcyqtx1005garvd5nzr2vl6	cmmcyqtqg0000arvdkrit0l53	NTT東日本	\N	VENDOR	EXPENSE	\N	t	\N	2026-03-05 04:26:14.389	2026-03-05 04:26:14.389
cmmcyqtx1005parvdctp03pw3	cmmcyqtqg0000arvdkrit0l53	商工中金	\N	VENDOR	BANK	\N	t	\N	2026-03-05 04:26:14.389	2026-03-05 04:26:14.389
cmmcyqtx1005uarvdvvfshf3m	cmmcyqtqg0000arvdkrit0l53	千葉銀行	\N	VENDOR	BANK	\N	t	\N	2026-03-05 04:26:14.389	2026-03-05 04:26:14.389
cmmcyqtx1005tarvdidm8p0gr	cmmcyqtqg0000arvdkrit0l53	○○建設	\N	CUSTOMER	CUSTOMER	\N	t	\N	2026-03-05 04:26:14.39	2026-03-05 04:26:14.39
cmmcyqtx1005iarvd4zh9lxm0	cmmcyqtqg0000arvdkrit0l53	東京ガス	\N	VENDOR	EXPENSE	\N	t	\N	2026-03-05 04:26:14.389	2026-03-05 04:26:14.389
cmmcyqtx1005rarvdpanvxlvg	cmmcyqtqg0000arvdkrit0l53	オリックスリース	\N	VENDOR	EXPENSE	\N	t	\N	2026-03-05 04:26:14.389	2026-03-05 04:26:14.389
cmmcyqtx1005marvdj42p1yee	cmmcyqtqg0000arvdkrit0l53	起グループ	\N	BOTH	GROUP_COMPANY	\N	t	\N	2026-03-05 04:26:14.389	2026-03-05 04:26:14.389
\.


--
-- Data for Name: transaction_details; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.transaction_details (id, "transactionId", "midId", "subId", amount, classification, summary, "deductionCategoryId", "deductionSubType", "signMultiplier", "displayOrder", "createdAt", "updatedAt") FROM stdin;
cmmcyqtzh0078arvdxsox0fub	cmmcyqtzh0076arvd2dawcfd7	cmmcyqtto0028arvdjwq5k13x	\N	-25000	FIXED	ETC利用 3月分	\N	\N	1	1	2026-03-05 04:26:14.477	2026-03-05 04:26:14.477
cmmcyqtzn007carvdiezs9yg9	cmmcyqtzn007aarvdvl2m65xw	cmmcyqtsy001karvdswtdbm0u	\N	-120000	FIXED	事務所家賃 4月分	\N	\N	1	1	2026-03-05 04:26:14.483	2026-03-05 04:26:14.483
cmmcyqtzs007garvd13k8k0x0	cmmcyqtzs007earvdaoplbtbt	cmmcyqtss001earvdijgiktyg	\N	-15000	FIXED	2月分 本社回線利用料	\N	\N	1	1	2026-03-05 04:26:14.488	2026-03-05 04:26:14.488
cmmcyqtzx007karvdwtu4mrf5	cmmcyqtzx007iarvdwco72fwu	cmmcyqtsk0019arvdey5qf37l	\N	-28000	FIXED	2月分 電気代	\N	\N	1	1	2026-03-05 04:26:14.493	2026-03-05 04:26:14.493
cmmcyqu01007oarvdmr3f0unb	cmmcyqu01007marvdnbv6ewix	cmmcyqttj0021arvd1o9ez4zn	\N	-550	FIXED	振込手数料（取消）	\N	\N	1	1	2026-03-05 04:26:14.497	2026-03-05 04:26:14.497
cmmcyqu0k0080arvd63nrg1mq	cmmcyqu0k007yarvdgy7pn00x	cmmcyqtvb003oarvdrjjfm1xt	\N	-1500000	VARIABLE	△△工務店 1月分外注費	\N	\N	1	1	2026-03-05 04:26:14.516	2026-03-05 04:26:14.516
cmmcyqu0q0084arvdlu0qb755	cmmcyqu0q0082arvdra5fykj8	cmmcyqtvb003oarvdrjjfm1xt	\N	-2200000	VARIABLE	△△工務店 2月分外注費	\N	\N	1	1	2026-03-05 04:26:14.522	2026-03-05 04:26:14.522
cmmcyqu0u0088arvd7dowlbke	cmmcyqu0u0086arvdagztofey	cmmcyqtvb003oarvdrjjfm1xt	\N	-800000	VARIABLE	△△工務店 3月分外注費（予定）	\N	\N	1	1	2026-03-05 04:26:14.526	2026-03-05 04:26:14.526
cmn2ve6z900035egmvh08n1od	cmmcyqtz2006uarvdp506awrm	cmmcyqtss001earvdijgiktyg	cmmcyqtsv001garvd8stofupf	-15000	\N	3月分 本社回線利用料	\N	\N	1	0	2026-03-23 07:34:26.518	2026-03-23 07:34:26.518
cmn2vegzl00055egmnt1yq0hk	cmmcyqtzd0072arvd0hdwomx8	cmmcyqtsk0019arvdey5qf37l	cmmcyqtsp001barvdc3706u7g	-8500	\N	3月分 ガス代	\N	\N	1	0	2026-03-23 07:34:39.489	2026-03-23 07:34:39.489
cmn2veref00075egm6ggmy0s5	cmmcyqtz9006yarvdm3gjms37	cmmcyqtsk0019arvdey5qf37l	cmmcyqtsp001aarvdeb28xxjm	-32000	\N	3月分 電気代	\N	\N	1	0	2026-03-23 07:34:52.984	2026-03-23 07:34:52.984
cmn2vk84s000c5egmrk7detgh	cmn2vk84s000a5egmk41ii1nh	cmmcyqtsk0019arvdey5qf37l	\N	3500	\N	アパート電気代	\N	\N	1	0	2026-03-23 07:39:07.948	2026-03-23 07:39:07.948
cmn2vs3ju000h5egm5xykt0u0	cmn2vs3ir000f5egmx03dud42	cmmcyqtss001earvdijgiktyg	\N	15000	\N	本社回線利用料	\N	\N	1	0	2026-03-23 07:45:15.258	2026-03-23 07:45:15.258
cmn2vs3ka000l5egm8obwhikv	cmn2vs3k6000j5egmr5kovi3p	cmmcyqtt5001oarvdpls32r3g	\N	120000	\N	事務所賃料	\N	\N	1	0	2026-03-23 07:45:15.274	2026-03-23 07:45:15.274
cmn2vs3kl000p5egmawyq9awr	cmn2vs3kh000n5egm7qbrgnk6	cmmcyqtt7001qarvdw7f7vius	\N	55000	\N	ハイエース リース料	\N	\N	1	0	2026-03-23 07:45:15.285	2026-03-23 07:45:15.285
\.


--
-- Data for Name: transactions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.transactions (id, "companyId", "accountId", "partnerId", type, status, "transactionDate", "scheduledDate", "accountingMonth", amount, "estimatedAmount", "actualAmount", "paymentMethod", classification, summary, "displayOrder", "confirmedAt", "confirmedBy", "readyAt", "readyBy", "invoiceDate", "invoiceAmount", "recordedAmount", "transferAmount", "linkedTransactionId", "parentId", "cashWithdrawalBatchId", "hasEvidence", "amountUpdatedAt", "createdAt", "updatedAt") FROM stdin;
cmmcyqtzs007earvdaoplbtbt	cmmcyqtqg0000arvdkrit0l53	cmmcyqts80011arvd35y96bh6	cmmcyqtx1005garvd5nzr2vl6	EXPENSE	CONFIRMED	2026-02-25 00:00:00	\N	2026-02	-15000	\N	\N	DIRECT_DEBIT	FIXED	2月分 本社回線利用料	1	2026-02-28 00:00:00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	f	\N	2026-03-05 04:26:14.488	2026-03-05 04:26:14.488
cmmcyqtzx007iarvdwco72fwu	cmmcyqtqg0000arvdkrit0l53	cmmcyqts80011arvd35y96bh6	cmmcyqtx1005karvdbtnhrz1e	EXPENSE	CONFIRMED	2026-02-15 00:00:00	\N	2026-02	-28000	\N	\N	DIRECT_DEBIT	FIXED	2月分 電気代	2	2026-02-28 00:00:00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	f	\N	2026-03-05 04:26:14.493	2026-03-05 04:26:14.493
cmmcyqu05007qarvdh6h2mgoc	cmmcyqtqg0000arvdkrit0l53	cmmcyqts80011arvd35y96bh6	cmmcyqtx1005tarvdidm8p0gr	SALES	CONFIRMED	\N	2026-02-28 00:00:00	2026-02	3000000	\N	\N	\N	\N	○○建設 1月分工事代金	1	2026-02-28 00:00:00	\N	\N	\N	2026-01-31 00:00:00	3150000	\N	\N	\N	\N	\N	f	\N	2026-03-05 04:26:14.502	2026-03-05 04:26:14.502
cmmcyqu09007sarvd762hs6a1	cmmcyqtqg0000arvdkrit0l53	cmmcyqts80011arvd35y96bh6	cmmcyqtx1005tarvdidm8p0gr	SALES	CONFIRMED	2026-02-28 00:00:00	\N	2026-02	2999450	\N	\N	\N	\N	○○建設 1月分入金（手数料550円差引）	1	2026-02-28 00:00:00	\N	\N	\N	\N	\N	\N	\N	\N	cmmcyqu05007qarvdh6h2mgoc	\N	f	\N	2026-03-05 04:26:14.506	2026-03-05 04:26:14.506
cmmcyqu0k007yarvdgy7pn00x	cmmcyqtqg0000arvdkrit0l53	cmmcyqts80011arvd35y96bh6	cmmcyqtx1005jarvdtorqpw40	COST_PAYMENT	CONFIRMED	2026-02-25 00:00:00	\N	2026-02	-1500000	\N	\N	BANK_TRANSFER	\N	△△工務店 1月分外注費	1	2026-02-28 00:00:00	\N	\N	\N	\N	\N	1650000	1500000	\N	\N	\N	f	\N	2026-03-05 04:26:14.516	2026-03-05 04:26:14.516
cmmcyqu0y008aarvdv6czdaju	cmmcyqtqg0000arvdkrit0l53	cmmcyqts80011arvd35y96bh6	\N	TRANSFER	CONFIRMED	2026-03-05 00:00:00	\N	2026-03	-500000	\N	\N	\N	\N	千葉銀行→京葉銀行 資金移動	0	2026-03-05 00:00:00	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	f	\N	2026-03-05 04:26:14.53	2026-03-23 07:18:47.906
cmmcyqu14008earvdxydrtxm1	cmmcyqtqg0000arvdkrit0l53	cmmcyqts80011arvd35y96bh6	\N	TRANSFER	DRAFT	2026-03-15 00:00:00	\N	2026-03	-1000000	\N	\N	\N	\N	起グループへ資金移動	2	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	f	\N	2026-03-05 04:26:14.537	2026-03-23 07:18:47.906
cmmcyqu0h007warvd0nsjocgg	cmmcyqtqg0000arvdkrit0l53	cmmcyqts80011arvd35y96bh6	cmmcyqtx1005tarvdidm8p0gr	SALES	READY	\N	2026-04-30 00:00:00	2026-04	2800000	\N	\N	\N	\N	○○建設 3月分工事代金（予定）	8	\N	\N	2026-03-05 04:28:45.571	RtlWlabUnwLwaxO0eotyKt9xarDBKAOn	2026-03-31 00:00:00	2940000	\N	\N	\N	\N	\N	f	\N	2026-03-05 04:26:14.513	2026-03-23 07:25:21.139
cmmcyqu0u0086arvdagztofey	cmmcyqtqg0000arvdkrit0l53	cmmcyqts80011arvd35y96bh6	cmmcyqtx1005jarvdtorqpw40	COST_PAYMENT	DRAFT	2026-04-25 00:00:00	\N	2026-04	-800000	\N	\N	BANK_TRANSFER	\N	△△工務店 3月分外注費（予定）	5	\N	\N	\N	\N	\N	\N	880000	800000	\N	\N	\N	f	\N	2026-03-05 04:26:14.526	2026-03-23 07:25:57.526
cmn2vk84s000a5egmk41ii1nh	cmmcyqtqg0000arvdkrit0l53	cmmcyqts80011arvd35y96bh6	cmmcyqtx1005karvdbtnhrz1e	EXPENSE	DRAFT	2026-03-10 00:00:00	\N	2026-03	3500	\N	\N	CASH_WITHDRAWAL	\N	アパート電気代	0	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	cmmcyqu3z00aqarvddyc5782r	f	\N	2026-03-23 07:39:07.948	2026-03-23 07:39:22.764
cmmcyqtz2006uarvdp506awrm	cmmcyqtqg0000arvdkrit0l53	cmmcyqts80011arvd35y96bh6	cmmcyqtx1005garvd5nzr2vl6	EXPENSE	DRAFT	2026-03-25 00:00:00	\N	2026-03	-15000	\N	\N	DIRECT_DEBIT	FIXED	3月分 本社回線利用料	1	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	f	\N	2026-03-05 04:26:14.462	2026-03-23 07:34:26.526
cmn2vs3ir000f5egmx03dud42	cmmcyqtqg0000arvdkrit0l53	cmmcyqts80011arvd35y96bh6	cmmcyqtx1005garvd5nzr2vl6	EXPENSE	DRAFT	\N	2026-04-25 00:00:00	2026-04	15000	\N	\N	DIRECT_DEBIT	FIXED	本社回線利用料	0	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	f	\N	2026-03-23 07:45:15.219	2026-03-23 07:45:15.219
cmmcyqtzd0072arvd0hdwomx8	cmmcyqtqg0000arvdkrit0l53	cmmcyqts80011arvd35y96bh6	cmmcyqtx1005iarvd4zh9lxm0	EXPENSE	DRAFT	2026-03-20 00:00:00	\N	2026-03	-8500	\N	\N	DIRECT_DEBIT	FIXED	3月分 ガス代	9	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	f	\N	2026-03-05 04:26:14.473	2026-03-23 07:34:39.493
cmn2vs3k6000j5egmr5kovi3p	cmmcyqtqg0000arvdkrit0l53	cmmcyqts80011arvd35y96bh6	\N	EXPENSE	DRAFT	\N	2026-04-27 00:00:00	2026-04	120000	\N	\N	BANK_TRANSFER	FIXED	事務所賃料	0	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	f	\N	2026-03-23 07:45:15.27	2026-03-23 07:45:15.27
cmmcyqtz9006yarvdm3gjms37	cmmcyqtqg0000arvdkrit0l53	cmmcyqts80011arvd35y96bh6	cmmcyqtx1005karvdbtnhrz1e	EXPENSE	DRAFT	2026-03-15 00:00:00	\N	2026-03	-32000	\N	\N	DIRECT_DEBIT	FIXED	3月分 電気代	7	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	f	\N	2026-03-05 04:26:14.469	2026-03-23 07:34:52.987
cmn2vs3kh000n5egm7qbrgnk6	cmmcyqtqg0000arvdkrit0l53	cmmcyqts80011arvd35y96bh6	cmmcyqtx1005rarvdpanvxlvg	EXPENSE	DRAFT	\N	2026-04-27 00:00:00	2026-04	55000	\N	\N	DIRECT_DEBIT	FIXED	ハイエース リース料	0	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	f	\N	2026-03-23 07:45:15.281	2026-03-23 07:45:15.281
cmmcyqu3t00anarvdaauajrkv	cmmcyqtqg0000arvdkrit0l53	cmmcyqts80011arvd35y96bh6	\N	EXPENSE	DRAFT	2026-03-10 00:00:00	\N	2026-03	-5000	\N	\N	CASH_WITHDRAWAL	\N	現場消耗品購入	12	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	cmmcyqu3z00aqarvddyc5782r	f	\N	2026-03-05 04:26:14.634	2026-03-23 07:38:00.215
cmmcyqu3w00aparvdswqxbonj	cmmcyqtqg0000arvdkrit0l53	cmmcyqts80011arvd35y96bh6	\N	EXPENSE	DRAFT	2026-03-10 00:00:00	\N	2026-03	-3000	\N	\N	CASH_WITHDRAWAL	\N	駐車場代	13	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	cmmcyqu3z00aqarvddyc5782r	f	\N	2026-03-05 04:26:14.637	2026-03-23 07:38:00.441
cmn2wanri000t5egmmieu17ca	cmmcyqtqg0000arvdkrit0l53	cmmcyqtr5000carvd1mzcbnrx	\N	TRANSFER	DRAFT	\N	\N	2026-03	180000	\N	\N	\N	\N	給与積立（社保）2026-03 営業部門（入金）	0	\N	\N	\N	\N	\N	\N	\N	\N	cmn2wanqn000r5egmxqsa6ng1	\N	\N	f	\N	2026-03-23 07:59:41.262	2026-03-23 07:59:41.262
cmn2wanqn000r5egmxqsa6ng1	cmmcyqtqg0000arvdkrit0l53	cmmcyqts80011arvd35y96bh6	\N	TRANSFER	DRAFT	\N	\N	2026-03	-180000	\N	\N	\N	\N	給与積立（社保）2026-03 営業部門（出金）	0	\N	\N	\N	\N	\N	\N	\N	\N	cmn2wanri000t5egmmieu17ca	\N	\N	f	\N	2026-03-23 07:59:41.231	2026-03-23 07:59:41.268
cmmcyqu0q0082arvdra5fykj8	cmmcyqtqg0000arvdkrit0l53	cmmcyqts80011arvd35y96bh6	cmmcyqtx1005jarvdtorqpw40	COST_PAYMENT	READY	2026-03-25 00:00:00	\N	2026-03	-2200000	\N	\N	BANK_TRANSFER	\N	△△工務店 2月分外注費	3	\N	\N	\N	\N	\N	\N	2420000	2200000	\N	\N	\N	f	\N	2026-03-05 04:26:14.522	2026-03-23 07:18:47.906
cmmcyqtzh0076arvd2dawcfd7	cmmcyqtqg0000arvdkrit0l53	cmmcyqts80011arvd35y96bh6	\N	EXPENSE	READY	2026-03-31 00:00:00	\N	2026-03	-25000	\N	\N	DIRECT_DEBIT	FIXED	ETC利用 3月分	4	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	f	\N	2026-03-05 04:26:14.477	2026-03-23 07:18:47.906
cmmcyqu0d007uarvdjr6rsu6i	cmmcyqtqg0000arvdkrit0l53	cmmcyqts80011arvd35y96bh6	cmmcyqtx1005tarvdidm8p0gr	SALES	READY	\N	2026-03-31 00:00:00	2026-03	4500000	\N	\N	\N	\N	○○建設 2月分工事代金	6	\N	\N	\N	\N	2026-02-28 00:00:00	4725000	\N	\N	\N	\N	\N	f	\N	2026-03-05 04:26:14.509	2026-03-23 07:18:47.906
cmn2wanrz000z5egmovqwj1h9	cmmcyqtqg0000arvdkrit0l53	cmmcyqtr5000darvd3oxykto3	\N	TRANSFER	DRAFT	\N	\N	2026-03	120000	\N	\N	\N	\N	給与積立（消費税）2026-03 営業部門（入金）	0	\N	\N	\N	\N	\N	\N	\N	\N	cmn2wanrw000x5egmvt2cx37i	\N	\N	f	\N	2026-03-23 07:59:41.28	2026-03-23 07:59:41.28
cmn2wanrw000x5egmvt2cx37i	cmmcyqtqg0000arvdkrit0l53	cmmcyqts80011arvd35y96bh6	\N	TRANSFER	DRAFT	\N	\N	2026-03	-120000	\N	\N	\N	\N	給与積立（消費税）2026-03 営業部門（出金）	0	\N	\N	\N	\N	\N	\N	\N	\N	cmn2wanrz000z5egmovqwj1h9	\N	\N	f	\N	2026-03-23 07:59:41.276	2026-03-23 07:59:41.283
cmmcyqtzn007aarvdvl2m65xw	cmmcyqtqg0000arvdkrit0l53	cmmcyqts80011arvd35y96bh6	\N	EXPENSE	READY	2026-03-27 00:00:00	\N	2026-03	-120000	\N	\N	BANK_TRANSFER	FIXED	事務所家賃 4月分	10	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	f	\N	2026-03-05 04:26:14.483	2026-03-23 07:18:47.906
cmmcyqu01007marvdnbv6ewix	cmmcyqtqg0000arvdkrit0l53	cmmcyqts80011arvd35y96bh6	\N	EXPENSE	CANCELLED	2026-03-10 00:00:00	\N	2026-03	-550	\N	\N	BANK_TRANSFER	FIXED	振込手数料（取消）	11	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	f	\N	2026-03-05 04:26:14.497	2026-03-23 07:18:47.906
\.


--
-- Data for Name: transfer_batch_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.transfer_batch_items (id, "batchId", "transactionId", "recipientName", "bankCode", "branchCode", "accountType", "accountNumber", amount, fee, "feeOverride", "isTransferred", "displayOrder") FROM stdin;
\.


--
-- Data for Name: transfer_batches; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.transfer_batches (id, "companyId", "accountId", "batchDate", purpose, status, "fbExportedAt", "confirmedAt", "confirmedBy", "totalAmount", "totalFee", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: user; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."user" (id, name, email, "emailVerified", image, "createdAt", "updatedAt") FROM stdin;
9Nw3nl4V028uqNZZfwjwfZbcWbv4odoX	テスト管理者	admin@test.com	f	\N	2026-03-04 08:38:17.317	2026-03-04 08:38:17.317
dZ68C4DTqitvoLGwkpcqQvaH6s7wwH3a	テスト管理者	admin2@test.com	f	\N	2026-03-04 08:40:15.714	2026-03-04 08:40:15.714
RtlWlabUnwLwaxO0eotyKt9xarDBKAOn	大室　春翔	admin@example.com	f	\N	2026-03-05 01:07:37.068	2026-03-05 01:07:37.068
CRfV8ZUDP2HxdIelKO3D6r1pKuHBYbGn	野村　那央	keiri@example.com	f	\N	2026-03-23 05:25:01.278	2026-03-23 05:25:01.278
\.


--
-- Data for Name: user_profiles; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_profiles (id, "authUserId", role, "displayName", "assignedCompanyIds", "isActive", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Data for Name: verification; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.verification (id, identifier, value, "expiresAt", "createdAt", "updatedAt") FROM stdin;
\.


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: account_category_majors account_category_majors_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.account_category_majors
    ADD CONSTRAINT account_category_majors_pkey PRIMARY KEY (id);


--
-- Name: account_category_mids account_category_mids_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.account_category_mids
    ADD CONSTRAINT account_category_mids_pkey PRIMARY KEY (id);


--
-- Name: account_category_subs account_category_subs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.account_category_subs
    ADD CONSTRAINT account_category_subs_pkey PRIMARY KEY (id);


--
-- Name: account account_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.account
    ADD CONSTRAINT account_pkey PRIMARY KEY (id);


--
-- Name: account_roles account_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.account_roles
    ADD CONSTRAINT account_roles_pkey PRIMARY KEY (id);


--
-- Name: accounts accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: bank_masters bank_masters_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bank_masters
    ADD CONSTRAINT bank_masters_pkey PRIMARY KEY (id);


--
-- Name: branch_masters branch_masters_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.branch_masters
    ADD CONSTRAINT branch_masters_pkey PRIMARY KEY (id);


--
-- Name: cash_denominations cash_denominations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cash_denominations
    ADD CONSTRAINT cash_denominations_pkey PRIMARY KEY (id);


--
-- Name: cash_withdrawal_batches cash_withdrawal_batches_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cash_withdrawal_batches
    ADD CONSTRAINT cash_withdrawal_batches_pkey PRIMARY KEY (id);


--
-- Name: companies companies_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.companies
    ADD CONSTRAINT companies_pkey PRIMARY KEY (id);


--
-- Name: deduction_categories deduction_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deduction_categories
    ADD CONSTRAINT deduction_categories_pkey PRIMARY KEY (id);


--
-- Name: evidences evidences_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.evidences
    ADD CONSTRAINT evidences_pkey PRIMARY KEY (id);


--
-- Name: fund_transfers fund_transfers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fund_transfers
    ADD CONSTRAINT fund_transfers_pkey PRIMARY KEY (id);


--
-- Name: lease_contracts lease_contracts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lease_contracts
    ADD CONSTRAINT lease_contracts_pkey PRIMARY KEY (id);


--
-- Name: lease_schedules lease_schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lease_schedules
    ADD CONSTRAINT lease_schedules_pkey PRIMARY KEY (id);


--
-- Name: loan_contracts loan_contracts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.loan_contracts
    ADD CONSTRAINT loan_contracts_pkey PRIMARY KEY (id);


--
-- Name: loan_schedules loan_schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.loan_schedules
    ADD CONSTRAINT loan_schedules_pkey PRIMARY KEY (id);


--
-- Name: month_closes month_closes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.month_closes
    ADD CONSTRAINT month_closes_pkey PRIMARY KEY (id);


--
-- Name: monthly_balances monthly_balances_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.monthly_balances
    ADD CONSTRAINT monthly_balances_pkey PRIMARY KEY (id);


--
-- Name: payroll_groups payroll_groups_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payroll_groups
    ADD CONSTRAINT payroll_groups_pkey PRIMARY KEY (id);


--
-- Name: recurring_templates recurring_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.recurring_templates
    ADD CONSTRAINT recurring_templates_pkey PRIMARY KEY (id);


--
-- Name: salary_deductions salary_deductions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.salary_deductions
    ADD CONSTRAINT salary_deductions_pkey PRIMARY KEY (id);


--
-- Name: salary_entries salary_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.salary_entries
    ADD CONSTRAINT salary_entries_pkey PRIMARY KEY (id);


--
-- Name: salary_journal_mappings salary_journal_mappings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.salary_journal_mappings
    ADD CONSTRAINT salary_journal_mappings_pkey PRIMARY KEY (id);


--
-- Name: salary_payment_details salary_payment_details_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.salary_payment_details
    ADD CONSTRAINT salary_payment_details_pkey PRIMARY KEY (id);


--
-- Name: session session_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.session
    ADD CONSTRAINT session_pkey PRIMARY KEY (id);


--
-- Name: trading_partner_bank_accounts trading_partner_bank_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.trading_partner_bank_accounts
    ADD CONSTRAINT trading_partner_bank_accounts_pkey PRIMARY KEY (id);


--
-- Name: trading_partner_defaults trading_partner_defaults_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.trading_partner_defaults
    ADD CONSTRAINT trading_partner_defaults_pkey PRIMARY KEY (id);


--
-- Name: trading_partner_sites trading_partner_sites_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.trading_partner_sites
    ADD CONSTRAINT trading_partner_sites_pkey PRIMARY KEY (id);


--
-- Name: trading_partners trading_partners_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.trading_partners
    ADD CONSTRAINT trading_partners_pkey PRIMARY KEY (id);


--
-- Name: transaction_details transaction_details_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transaction_details
    ADD CONSTRAINT transaction_details_pkey PRIMARY KEY (id);


--
-- Name: transactions transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_pkey PRIMARY KEY (id);


--
-- Name: transfer_batch_items transfer_batch_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transfer_batch_items
    ADD CONSTRAINT transfer_batch_items_pkey PRIMARY KEY (id);


--
-- Name: transfer_batches transfer_batches_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transfer_batches
    ADD CONSTRAINT transfer_batches_pkey PRIMARY KEY (id);


--
-- Name: user user_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."user"
    ADD CONSTRAINT user_pkey PRIMARY KEY (id);


--
-- Name: user_profiles user_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_profiles
    ADD CONSTRAINT user_profiles_pkey PRIMARY KEY (id);


--
-- Name: verification verification_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.verification
    ADD CONSTRAINT verification_pkey PRIMARY KEY (id);


--
-- Name: account_roles_accountId_roleKey_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "account_roles_accountId_roleKey_key" ON public.account_roles USING btree ("accountId", "roleKey");


--
-- Name: audit_logs_tableName_recordId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "audit_logs_tableName_recordId_idx" ON public.audit_logs USING btree ("tableName", "recordId");


--
-- Name: audit_logs_timestamp_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX audit_logs_timestamp_idx ON public.audit_logs USING btree ("timestamp");


--
-- Name: audit_logs_userId_timestamp_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "audit_logs_userId_timestamp_idx" ON public.audit_logs USING btree ("userId", "timestamp");


--
-- Name: bank_masters_bankCode_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "bank_masters_bankCode_key" ON public.bank_masters USING btree ("bankCode");


--
-- Name: branch_masters_bankCode_branchCode_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "branch_masters_bankCode_branchCode_key" ON public.branch_masters USING btree ("bankCode", "branchCode");


--
-- Name: fund_transfers_transactionId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "fund_transfers_transactionId_key" ON public.fund_transfers USING btree ("transactionId");


--
-- Name: lease_schedules_contractId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "lease_schedules_contractId_idx" ON public.lease_schedules USING btree ("contractId");


--
-- Name: loan_schedules_contractId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "loan_schedules_contractId_idx" ON public.loan_schedules USING btree ("contractId");


--
-- Name: month_closes_companyId_yearMonth_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "month_closes_companyId_yearMonth_key" ON public.month_closes USING btree ("companyId", "yearMonth");


--
-- Name: monthly_balances_accountId_yearMonth_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "monthly_balances_accountId_yearMonth_key" ON public.monthly_balances USING btree ("accountId", "yearMonth");


--
-- Name: salary_entries_payrollGroupId_payMonth_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "salary_entries_payrollGroupId_payMonth_key" ON public.salary_entries USING btree ("payrollGroupId", "payMonth");


--
-- Name: salary_journal_mappings_deductionItemName_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "salary_journal_mappings_deductionItemName_key" ON public.salary_journal_mappings USING btree ("deductionItemName");


--
-- Name: session_token_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX session_token_key ON public.session USING btree (token);


--
-- Name: trading_partner_defaults_partnerId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "trading_partner_defaults_partnerId_key" ON public.trading_partner_defaults USING btree ("partnerId");


--
-- Name: transaction_details_transactionId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "transaction_details_transactionId_idx" ON public.transaction_details USING btree ("transactionId");


--
-- Name: transactions_companyId_accountId_accountingMonth_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "transactions_companyId_accountId_accountingMonth_idx" ON public.transactions USING btree ("companyId", "accountId", "accountingMonth");


--
-- Name: transactions_companyId_type_accountingMonth_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "transactions_companyId_type_accountingMonth_idx" ON public.transactions USING btree ("companyId", type, "accountingMonth");


--
-- Name: transactions_parentId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "transactions_parentId_idx" ON public.transactions USING btree ("parentId");


--
-- Name: user_email_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX user_email_key ON public."user" USING btree (email);


--
-- Name: user_profiles_authUserId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "user_profiles_authUserId_key" ON public.user_profiles USING btree ("authUserId");


--
-- Name: account_category_mids account_category_mids_majorId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.account_category_mids
    ADD CONSTRAINT "account_category_mids_majorId_fkey" FOREIGN KEY ("majorId") REFERENCES public.account_category_majors(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: account_category_subs account_category_subs_midId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.account_category_subs
    ADD CONSTRAINT "account_category_subs_midId_fkey" FOREIGN KEY ("midId") REFERENCES public.account_category_mids(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: account_roles account_roles_accountId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.account_roles
    ADD CONSTRAINT "account_roles_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES public.accounts(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: account account_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.account
    ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."user"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: accounts accounts_companyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT "accounts_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: branch_masters branch_masters_bankCode_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.branch_masters
    ADD CONSTRAINT "branch_masters_bankCode_fkey" FOREIGN KEY ("bankCode") REFERENCES public.bank_masters("bankCode") ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: cash_denominations cash_denominations_batchId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cash_denominations
    ADD CONSTRAINT "cash_denominations_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES public.cash_withdrawal_batches(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: evidences evidences_transactionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.evidences
    ADD CONSTRAINT "evidences_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES public.transactions(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: fund_transfers fund_transfers_fromAccountId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fund_transfers
    ADD CONSTRAINT "fund_transfers_fromAccountId_fkey" FOREIGN KEY ("fromAccountId") REFERENCES public.accounts(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: fund_transfers fund_transfers_toAccountId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fund_transfers
    ADD CONSTRAINT "fund_transfers_toAccountId_fkey" FOREIGN KEY ("toAccountId") REFERENCES public.accounts(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: fund_transfers fund_transfers_transactionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.fund_transfers
    ADD CONSTRAINT "fund_transfers_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES public.transactions(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: lease_contracts lease_contracts_companyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lease_contracts
    ADD CONSTRAINT "lease_contracts_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: lease_schedules lease_schedules_contractId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.lease_schedules
    ADD CONSTRAINT "lease_schedules_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES public.lease_contracts(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: loan_contracts loan_contracts_companyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.loan_contracts
    ADD CONSTRAINT "loan_contracts_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: loan_schedules loan_schedules_contractId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.loan_schedules
    ADD CONSTRAINT "loan_schedules_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES public.loan_contracts(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: month_closes month_closes_companyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.month_closes
    ADD CONSTRAINT "month_closes_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: monthly_balances monthly_balances_accountId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.monthly_balances
    ADD CONSTRAINT "monthly_balances_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES public.accounts(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: monthly_balances monthly_balances_companyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.monthly_balances
    ADD CONSTRAINT "monthly_balances_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: payroll_groups payroll_groups_companyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payroll_groups
    ADD CONSTRAINT "payroll_groups_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: recurring_templates recurring_templates_companyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.recurring_templates
    ADD CONSTRAINT "recurring_templates_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: salary_deductions salary_deductions_salaryEntryId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.salary_deductions
    ADD CONSTRAINT "salary_deductions_salaryEntryId_fkey" FOREIGN KEY ("salaryEntryId") REFERENCES public.salary_entries(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: salary_entries salary_entries_payrollGroupId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.salary_entries
    ADD CONSTRAINT "salary_entries_payrollGroupId_fkey" FOREIGN KEY ("payrollGroupId") REFERENCES public.payroll_groups(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: salary_payment_details salary_payment_details_salaryEntryId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.salary_payment_details
    ADD CONSTRAINT "salary_payment_details_salaryEntryId_fkey" FOREIGN KEY ("salaryEntryId") REFERENCES public.salary_entries(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: session session_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.session
    ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."user"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: trading_partner_bank_accounts trading_partner_bank_accounts_partnerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.trading_partner_bank_accounts
    ADD CONSTRAINT "trading_partner_bank_accounts_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES public.trading_partners(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: trading_partner_defaults trading_partner_defaults_midId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.trading_partner_defaults
    ADD CONSTRAINT "trading_partner_defaults_midId_fkey" FOREIGN KEY ("midId") REFERENCES public.account_category_mids(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: trading_partner_defaults trading_partner_defaults_partnerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.trading_partner_defaults
    ADD CONSTRAINT "trading_partner_defaults_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES public.trading_partners(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: trading_partner_defaults trading_partner_defaults_subId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.trading_partner_defaults
    ADD CONSTRAINT "trading_partner_defaults_subId_fkey" FOREIGN KEY ("subId") REFERENCES public.account_category_subs(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: trading_partner_sites trading_partner_sites_partnerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.trading_partner_sites
    ADD CONSTRAINT "trading_partner_sites_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES public.trading_partners(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: trading_partners trading_partners_companyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.trading_partners
    ADD CONSTRAINT "trading_partners_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: transaction_details transaction_details_midId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transaction_details
    ADD CONSTRAINT "transaction_details_midId_fkey" FOREIGN KEY ("midId") REFERENCES public.account_category_mids(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: transaction_details transaction_details_subId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transaction_details
    ADD CONSTRAINT "transaction_details_subId_fkey" FOREIGN KEY ("subId") REFERENCES public.account_category_subs(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: transaction_details transaction_details_transactionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transaction_details
    ADD CONSTRAINT "transaction_details_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES public.transactions(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: transactions transactions_accountId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT "transactions_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES public.accounts(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: transactions transactions_cashWithdrawalBatchId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT "transactions_cashWithdrawalBatchId_fkey" FOREIGN KEY ("cashWithdrawalBatchId") REFERENCES public.cash_withdrawal_batches(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: transactions transactions_companyId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT "transactions_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: transactions transactions_parentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT "transactions_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES public.transactions(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: transactions transactions_partnerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT "transactions_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES public.trading_partners(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: transfer_batch_items transfer_batch_items_batchId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transfer_batch_items
    ADD CONSTRAINT "transfer_batch_items_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES public.transfer_batches(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: user_profiles user_profiles_authUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_profiles
    ADD CONSTRAINT "user_profiles_authUserId_fkey" FOREIGN KEY ("authUserId") REFERENCES public."user"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict DtJR8IzDuK7Qwp7ZEI1ssQKVuVOEsngl7rxkWto9ekmLRDABM5YZ8jv3IhfyMLA

