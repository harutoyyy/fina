-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "fina";

-- CreateEnum
CREATE TYPE "fina"."UserRole" AS ENUM ('ADMIN', 'OPERATOR', 'VIEWER');

-- CreateEnum
CREATE TYPE "fina"."AccountType" AS ENUM ('ORDINARY', 'TERM', 'SOCIAL_INSURANCE_RESERVE', 'CONSUMPTION_TAX_RESERVE');

-- CreateEnum
CREATE TYPE "fina"."TradingPartnerType" AS ENUM ('CUSTOMER', 'VENDOR', 'BOTH');

-- CreateEnum
CREATE TYPE "fina"."TransactionType" AS ENUM ('EXPENSE', 'SALES', 'COST_PAYMENT', 'SALARY', 'LOAN', 'TRANSFER');

-- CreateEnum
CREATE TYPE "fina"."TransactionStatus" AS ENUM ('DRAFT', 'READY', 'CONFIRMED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "fina"."PaymentMethod" AS ENUM ('BANK_TRANSFER', 'DIRECT_DEBIT', 'CASH_WITHDRAWAL');

-- CreateTable
CREATE TABLE "fina"."user_fina" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_fina_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fina"."session_fina" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "session_fina_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fina"."account_fina" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_fina_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fina"."verification_fina" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_fina_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fina"."user_profiles_fina" (
    "id" TEXT NOT NULL,
    "authUserId" TEXT NOT NULL,
    "role" "fina"."UserRole" NOT NULL DEFAULT 'OPERATOR',
    "displayName" TEXT NOT NULL,
    "assignedCompanyIds" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_profiles_fina_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fina"."companies_fina" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameKana" TEXT,
    "shortName" TEXT,
    "industryType" TEXT,
    "representativeTitle" TEXT,
    "representativeName" TEXT,
    "postalCode" TEXT,
    "addressPrefecture" TEXT,
    "addressCity" TEXT,
    "addressStreet" TEXT,
    "addressBuilding" TEXT,
    "phone" TEXT,
    "fax" TEXT,
    "email" TEXT,
    "website" TEXT,
    "corporateNumber" TEXT,
    "invoiceNumber" TEXT,
    "fiscalMonth" INTEGER NOT NULL DEFAULT 3,
    "establishedDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "mainAccountId" TEXT,
    "defaultAssigneeId" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companies_fina_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fina"."accounts_fina" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "bankName" TEXT,
    "bankCode" TEXT,
    "branchName" TEXT,
    "branchCode" TEXT,
    "accountNumber" TEXT,
    "accountType" "fina"."AccountType" NOT NULL,
    "accountHolder" TEXT,
    "isMain" BOOLEAN NOT NULL DEFAULT false,
    "isVirtual" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "fbSettings" JSONB,
    "feeSettings" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_fina_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fina"."account_roles_fina" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "roleKey" TEXT NOT NULL,
    "roleName" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "account_roles_fina_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fina"."monthly_balances_fina" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "yearMonth" TEXT NOT NULL,
    "openingBalance" BIGINT NOT NULL DEFAULT 0,
    "closingBalance" BIGINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "monthly_balances_fina_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fina"."account_category_majors_fina" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_category_majors_fina_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fina"."account_category_mids_fina" (
    "id" TEXT NOT NULL,
    "majorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_category_mids_fina_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fina"."account_category_subs_fina" (
    "id" TEXT NOT NULL,
    "midId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_category_subs_fina_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fina"."trading_partners_fina" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameKana" TEXT,
    "type" "fina"."TradingPartnerType" NOT NULL,
    "tagKey" TEXT NOT NULL,
    "tagDisplayName" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trading_partners_fina_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fina"."trading_partner_bank_accounts_fina" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "bankCode" TEXT NOT NULL,
    "branchCode" TEXT NOT NULL,
    "accountType" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "accountHolder" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trading_partner_bank_accounts_fina_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fina"."trading_partner_defaults_fina" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "midId" TEXT NOT NULL,
    "subId" TEXT,

    CONSTRAINT "trading_partner_defaults_fina_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fina"."trading_partner_sites_fina" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "siteName" TEXT NOT NULL,
    "frequency" TEXT,
    "specificMonths" INTEGER[],
    "startMonth" INTEGER,
    "dueDayRule" TEXT,
    "holidayAdjust" TEXT,
    "amountType" TEXT,
    "fixedAmount" BIGINT,
    "assigneeId" TEXT,
    "midId" TEXT,
    "subId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trading_partner_sites_fina_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fina"."transactions_fina" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "partnerId" TEXT,
    "type" "fina"."TransactionType" NOT NULL,
    "status" "fina"."TransactionStatus" NOT NULL DEFAULT 'DRAFT',
    "transactionDate" TIMESTAMP(3),
    "scheduledDate" TIMESTAMP(3),
    "accountingMonth" TEXT NOT NULL,
    "amount" BIGINT NOT NULL DEFAULT 0,
    "estimatedAmount" BIGINT,
    "actualAmount" BIGINT,
    "paymentMethod" "fina"."PaymentMethod",
    "classification" TEXT,
    "summary" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "confirmedAt" TIMESTAMP(3),
    "confirmedBy" TEXT,
    "readyAt" TIMESTAMP(3),
    "readyBy" TEXT,
    "invoiceDate" TIMESTAMP(3),
    "invoiceAmount" BIGINT,
    "recordedAmount" BIGINT,
    "transferAmount" BIGINT,
    "linkedTransactionId" TEXT,
    "parentId" TEXT,
    "cashWithdrawalBatchId" TEXT,
    "hasEvidence" BOOLEAN NOT NULL DEFAULT false,
    "evidenceNotRequired" BOOLEAN NOT NULL DEFAULT false,
    "receivedDate" TIMESTAMP(3),
    "temporaryVendorName" TEXT,
    "isDateException" BOOLEAN NOT NULL DEFAULT false,
    "amountUpdatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transactions_fina_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fina"."transaction_details_fina" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "midId" TEXT,
    "subId" TEXT,
    "amount" BIGINT NOT NULL DEFAULT 0,
    "classification" TEXT,
    "summary" TEXT,
    "deductionCategoryId" TEXT,
    "deductionSubType" TEXT,
    "signMultiplier" INTEGER NOT NULL DEFAULT 1,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transaction_details_fina_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fina"."evidences_fina" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileSize" INTEGER,
    "mimeType" TEXT,
    "uploadedBy" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evidences_fina_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fina"."payroll_groups_fina" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "costType" TEXT NOT NULL,
    "midId" TEXT,
    "payDay" INTEGER,
    "payDayIsMonthEnd" BOOLEAN NOT NULL DEFAULT false,
    "holidayAdjust" TEXT,
    "defaultAccountId" TEXT,
    "defaultCashAccountId" TEXT,
    "deductionPresets" JSONB,
    "headcount" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_groups_fina_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fina"."salary_entries_fina" (
    "id" TEXT NOT NULL,
    "payrollGroupId" TEXT NOT NULL,
    "payMonth" TEXT NOT NULL,
    "payDate" TIMESTAMP(3),
    "taxablePayment" BIGINT NOT NULL DEFAULT 0,
    "transportAllowance" BIGINT NOT NULL DEFAULT 0,
    "miscExpenses" BIGINT NOT NULL DEFAULT 0,
    "carryoverAdjust" BIGINT NOT NULL DEFAULT 0,
    "advanceExpenses" BIGINT NOT NULL DEFAULT 0,
    "totalPayment" BIGINT NOT NULL DEFAULT 0,
    "socialInsuranceReserve" BIGINT NOT NULL DEFAULT 0,
    "consumptionTaxReserve" BIGINT NOT NULL DEFAULT 0,
    "totalDeduction" BIGINT NOT NULL DEFAULT 0,
    "netPayment" BIGINT NOT NULL DEFAULT 0,
    "headcount" INTEGER NOT NULL DEFAULT 0,
    "status" "fina"."TransactionStatus" NOT NULL DEFAULT 'DRAFT',
    "confirmedAt" TIMESTAMP(3),
    "confirmedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "salary_entries_fina_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fina"."salary_deductions_fina" (
    "id" TEXT NOT NULL,
    "salaryEntryId" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "amount" BIGINT NOT NULL DEFAULT 0,
    "midId" TEXT,
    "subId" TEXT,
    "contentRows" JSONB,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "salary_deductions_fina_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fina"."salary_payment_details_fina" (
    "id" TEXT NOT NULL,
    "salaryEntryId" TEXT NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL,
    "paymentMethod" "fina"."PaymentMethod" NOT NULL,
    "accountId" TEXT,
    "amount" BIGINT NOT NULL DEFAULT 0,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "salary_payment_details_fina_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fina"."deduction_categories_fina" (
    "id" TEXT NOT NULL,
    "forType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "midId" TEXT NOT NULL,
    "subId" TEXT,
    "hasSubTypes" BOOLEAN NOT NULL DEFAULT false,
    "signRule" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deduction_categories_fina_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fina"."fund_transfers_fina" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "fromAccountId" TEXT NOT NULL,
    "toAccountId" TEXT NOT NULL,
    "transferDate" TIMESTAMP(3) NOT NULL,
    "amount" BIGINT NOT NULL,
    "counterCompanyId" TEXT,
    "counterTransactionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fund_transfers_fina_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fina"."cash_withdrawal_batches_fina" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "withdrawalDate" TIMESTAMP(3) NOT NULL,
    "totalAmount" BIGINT NOT NULL,
    "status" "fina"."TransactionStatus" NOT NULL DEFAULT 'DRAFT',
    "confirmedAt" TIMESTAMP(3),
    "confirmedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cash_withdrawal_batches_fina_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fina"."cash_denominations_fina" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "yen10000" INTEGER NOT NULL DEFAULT 0,
    "yen5000" INTEGER NOT NULL DEFAULT 0,
    "yen2000" INTEGER NOT NULL DEFAULT 0,
    "yen1000" INTEGER NOT NULL DEFAULT 0,
    "yen500" INTEGER NOT NULL DEFAULT 0,
    "yen100" INTEGER NOT NULL DEFAULT 0,
    "yen50" INTEGER NOT NULL DEFAULT 0,
    "yen10" INTEGER NOT NULL DEFAULT 0,
    "yen5" INTEGER NOT NULL DEFAULT 0,
    "yen1" INTEGER NOT NULL DEFAULT 0,
    "total" BIGINT NOT NULL DEFAULT 0,
    "purposeLabel" TEXT,

    CONSTRAINT "cash_denominations_fina_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fina"."recurring_templates_fina" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "specificMonths" INTEGER[],
    "startMonth" INTEGER,
    "dueDayRule" TEXT NOT NULL,
    "holidayAdjust" TEXT NOT NULL DEFAULT 'PREV_BUSINESS',
    "transactionType" "fina"."TransactionType" NOT NULL,
    "accountId" TEXT,
    "partnerId" TEXT,
    "midId" TEXT,
    "subId" TEXT,
    "amountType" TEXT NOT NULL,
    "fixedAmount" BIGINT,
    "paymentMethod" "fina"."PaymentMethod",
    "classification" TEXT,
    "accountingMonthOffset" INTEGER NOT NULL DEFAULT 0,
    "summary" TEXT,
    "assigneeId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastGeneratedMonth" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recurring_templates_fina_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fina"."loan_contracts_fina" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "partnerId" TEXT,
    "contractName" TEXT NOT NULL,
    "principalAmount" BIGINT NOT NULL,
    "executionDate" TIMESTAMP(3) NOT NULL,
    "repaymentStartDate" TIMESTAMP(3) NOT NULL,
    "repaymentMethod" TEXT NOT NULL,
    "repaymentFrequency" TEXT NOT NULL,
    "repaymentDay" INTEGER,
    "holidayAdjust" TEXT NOT NULL DEFAULT 'PREV_BUSINESS',
    "totalPayments" INTEGER,
    "completionDate" TIMESTAMP(3),
    "interestType" TEXT NOT NULL,
    "interestRate" DECIMAL(65,30) NOT NULL,
    "interestTiming" TEXT NOT NULL DEFAULT 'ARREAR',
    "dayCountBasis" INTEGER NOT NULL DEFAULT 365,
    "roundingRule" TEXT NOT NULL DEFAULT 'ROUND_HALF_UP',
    "principalAdjust" TEXT NOT NULL DEFAULT 'LAST',
    "interestHistory" JSONB,
    "remainingBalance" BIGINT NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loan_contracts_fina_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fina"."loan_schedules_fina" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "paymentNumber" INTEGER NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "principalAmount" BIGINT NOT NULL,
    "interestAmount" BIGINT NOT NULL,
    "totalAmount" BIGINT NOT NULL,
    "remainingBalance" BIGINT NOT NULL,
    "isPaid" BOOLEAN NOT NULL DEFAULT false,
    "transactionId" TEXT,

    CONSTRAINT "loan_schedules_fina_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fina"."lease_contracts_fina" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "partnerId" TEXT,
    "contractName" TEXT NOT NULL,
    "monthlyAmount" BIGINT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "totalPayments" INTEGER,
    "paymentDay" INTEGER,
    "holidayAdjust" TEXT NOT NULL DEFAULT 'PREV_BUSINESS',
    "principalAdjust" TEXT NOT NULL DEFAULT 'LAST',
    "accountId" TEXT,
    "midId" TEXT,
    "subId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lease_contracts_fina_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fina"."lease_schedules_fina" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "paymentNumber" INTEGER NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "amount" BIGINT NOT NULL,
    "isPaid" BOOLEAN NOT NULL DEFAULT false,
    "transactionId" TEXT,

    CONSTRAINT "lease_schedules_fina_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fina"."month_closes_fina" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "yearMonth" TEXT NOT NULL,
    "isClosed" BOOLEAN NOT NULL DEFAULT false,
    "closedAt" TIMESTAMP(3),
    "closedBy" TEXT,
    "reopenedAt" TIMESTAMP(3),
    "reopenedBy" TEXT,
    "reopenReason" TEXT,

    CONSTRAINT "month_closes_fina_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fina"."transfer_batches_fina" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "batchDate" TIMESTAMP(3) NOT NULL,
    "purpose" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "fbExportedAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "confirmedBy" TEXT,
    "totalAmount" BIGINT NOT NULL DEFAULT 0,
    "totalFee" BIGINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transfer_batches_fina_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fina"."transfer_batch_items_fina" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "transactionId" TEXT,
    "recipientName" TEXT NOT NULL,
    "bankCode" TEXT NOT NULL,
    "branchCode" TEXT NOT NULL,
    "accountType" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "fee" BIGINT NOT NULL DEFAULT 0,
    "feeOverride" BOOLEAN NOT NULL DEFAULT false,
    "isTransferred" BOOLEAN NOT NULL DEFAULT false,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "transfer_batch_items_fina_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fina"."salary_journal_mappings_fina" (
    "id" TEXT NOT NULL,
    "deductionItemName" TEXT NOT NULL,
    "majorId" TEXT NOT NULL,
    "midId" TEXT NOT NULL,
    "subId" TEXT,
    "classification" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "salary_journal_mappings_fina_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fina"."temporary_bank_accounts_fina" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "bankCode" TEXT NOT NULL,
    "bankName" TEXT,
    "branchCode" TEXT NOT NULL,
    "branchName" TEXT,
    "accountType" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "accountHolder" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "temporary_bank_accounts_fina_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fina"."audit_logs_fina" (
    "id" TEXT NOT NULL,
    "tableName" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "beforeData" JSONB,
    "afterData" JSONB,
    "reason" TEXT,

    CONSTRAINT "audit_logs_fina_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fina"."bank_masters_fina" (
    "id" TEXT NOT NULL,
    "bankCode" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "bankNameKana" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "bank_masters_fina_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fina"."branch_masters_fina" (
    "id" TEXT NOT NULL,
    "bankCode" TEXT NOT NULL,
    "branchCode" TEXT NOT NULL,
    "branchName" TEXT NOT NULL,
    "branchNameKana" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "branch_masters_fina_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_fina_email_key" ON "fina"."user_fina"("email");

-- CreateIndex
CREATE UNIQUE INDEX "session_fina_token_key" ON "fina"."session_fina"("token");

-- CreateIndex
CREATE UNIQUE INDEX "user_profiles_fina_authUserId_key" ON "fina"."user_profiles_fina"("authUserId");

-- CreateIndex
CREATE UNIQUE INDEX "account_roles_fina_accountId_roleKey_key" ON "fina"."account_roles_fina"("accountId", "roleKey");

-- CreateIndex
CREATE UNIQUE INDEX "monthly_balances_fina_accountId_yearMonth_key" ON "fina"."monthly_balances_fina"("accountId", "yearMonth");

-- CreateIndex
CREATE UNIQUE INDEX "trading_partner_defaults_fina_partnerId_key" ON "fina"."trading_partner_defaults_fina"("partnerId");

-- CreateIndex
CREATE INDEX "transactions_fina_companyId_accountId_accountingMonth_idx" ON "fina"."transactions_fina"("companyId", "accountId", "accountingMonth");

-- CreateIndex
CREATE INDEX "transactions_fina_companyId_type_accountingMonth_idx" ON "fina"."transactions_fina"("companyId", "type", "accountingMonth");

-- CreateIndex
CREATE INDEX "transactions_fina_parentId_idx" ON "fina"."transactions_fina"("parentId");

-- CreateIndex
CREATE INDEX "transaction_details_fina_transactionId_idx" ON "fina"."transaction_details_fina"("transactionId");

-- CreateIndex
CREATE UNIQUE INDEX "salary_entries_fina_payrollGroupId_payMonth_key" ON "fina"."salary_entries_fina"("payrollGroupId", "payMonth");

-- CreateIndex
CREATE UNIQUE INDEX "fund_transfers_fina_transactionId_key" ON "fina"."fund_transfers_fina"("transactionId");

-- CreateIndex
CREATE INDEX "loan_schedules_fina_contractId_idx" ON "fina"."loan_schedules_fina"("contractId");

-- CreateIndex
CREATE INDEX "lease_schedules_fina_contractId_idx" ON "fina"."lease_schedules_fina"("contractId");

-- CreateIndex
CREATE UNIQUE INDEX "month_closes_fina_companyId_yearMonth_key" ON "fina"."month_closes_fina"("companyId", "yearMonth");

-- CreateIndex
CREATE UNIQUE INDEX "salary_journal_mappings_fina_deductionItemName_key" ON "fina"."salary_journal_mappings_fina"("deductionItemName");

-- CreateIndex
CREATE UNIQUE INDEX "temporary_bank_accounts_fina_transactionId_key" ON "fina"."temporary_bank_accounts_fina"("transactionId");

-- CreateIndex
CREATE INDEX "audit_logs_fina_tableName_recordId_idx" ON "fina"."audit_logs_fina"("tableName", "recordId");

-- CreateIndex
CREATE INDEX "audit_logs_fina_userId_timestamp_idx" ON "fina"."audit_logs_fina"("userId", "timestamp");

-- CreateIndex
CREATE INDEX "audit_logs_fina_timestamp_idx" ON "fina"."audit_logs_fina"("timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "bank_masters_fina_bankCode_key" ON "fina"."bank_masters_fina"("bankCode");

-- CreateIndex
CREATE UNIQUE INDEX "branch_masters_fina_bankCode_branchCode_key" ON "fina"."branch_masters_fina"("bankCode", "branchCode");

-- AddForeignKey
ALTER TABLE "fina"."session_fina" ADD CONSTRAINT "session_fina_userId_fkey" FOREIGN KEY ("userId") REFERENCES "fina"."user_fina"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fina"."account_fina" ADD CONSTRAINT "account_fina_userId_fkey" FOREIGN KEY ("userId") REFERENCES "fina"."user_fina"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fina"."user_profiles_fina" ADD CONSTRAINT "user_profiles_fina_authUserId_fkey" FOREIGN KEY ("authUserId") REFERENCES "fina"."user_fina"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fina"."accounts_fina" ADD CONSTRAINT "accounts_fina_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "fina"."companies_fina"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fina"."account_roles_fina" ADD CONSTRAINT "account_roles_fina_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "fina"."accounts_fina"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fina"."monthly_balances_fina" ADD CONSTRAINT "monthly_balances_fina_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "fina"."companies_fina"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fina"."monthly_balances_fina" ADD CONSTRAINT "monthly_balances_fina_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "fina"."accounts_fina"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fina"."account_category_mids_fina" ADD CONSTRAINT "account_category_mids_fina_majorId_fkey" FOREIGN KEY ("majorId") REFERENCES "fina"."account_category_majors_fina"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fina"."account_category_subs_fina" ADD CONSTRAINT "account_category_subs_fina_midId_fkey" FOREIGN KEY ("midId") REFERENCES "fina"."account_category_mids_fina"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fina"."trading_partners_fina" ADD CONSTRAINT "trading_partners_fina_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "fina"."companies_fina"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fina"."trading_partner_bank_accounts_fina" ADD CONSTRAINT "trading_partner_bank_accounts_fina_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "fina"."trading_partners_fina"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fina"."trading_partner_defaults_fina" ADD CONSTRAINT "trading_partner_defaults_fina_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "fina"."trading_partners_fina"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fina"."trading_partner_defaults_fina" ADD CONSTRAINT "trading_partner_defaults_fina_midId_fkey" FOREIGN KEY ("midId") REFERENCES "fina"."account_category_mids_fina"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fina"."trading_partner_defaults_fina" ADD CONSTRAINT "trading_partner_defaults_fina_subId_fkey" FOREIGN KEY ("subId") REFERENCES "fina"."account_category_subs_fina"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fina"."trading_partner_sites_fina" ADD CONSTRAINT "trading_partner_sites_fina_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "fina"."trading_partners_fina"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fina"."transactions_fina" ADD CONSTRAINT "transactions_fina_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "fina"."companies_fina"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fina"."transactions_fina" ADD CONSTRAINT "transactions_fina_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "fina"."accounts_fina"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fina"."transactions_fina" ADD CONSTRAINT "transactions_fina_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "fina"."trading_partners_fina"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fina"."transactions_fina" ADD CONSTRAINT "transactions_fina_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "fina"."transactions_fina"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fina"."transactions_fina" ADD CONSTRAINT "transactions_fina_cashWithdrawalBatchId_fkey" FOREIGN KEY ("cashWithdrawalBatchId") REFERENCES "fina"."cash_withdrawal_batches_fina"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fina"."transaction_details_fina" ADD CONSTRAINT "transaction_details_fina_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "fina"."transactions_fina"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fina"."transaction_details_fina" ADD CONSTRAINT "transaction_details_fina_midId_fkey" FOREIGN KEY ("midId") REFERENCES "fina"."account_category_mids_fina"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fina"."transaction_details_fina" ADD CONSTRAINT "transaction_details_fina_subId_fkey" FOREIGN KEY ("subId") REFERENCES "fina"."account_category_subs_fina"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fina"."evidences_fina" ADD CONSTRAINT "evidences_fina_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "fina"."transactions_fina"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fina"."payroll_groups_fina" ADD CONSTRAINT "payroll_groups_fina_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "fina"."companies_fina"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fina"."salary_entries_fina" ADD CONSTRAINT "salary_entries_fina_payrollGroupId_fkey" FOREIGN KEY ("payrollGroupId") REFERENCES "fina"."payroll_groups_fina"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fina"."salary_deductions_fina" ADD CONSTRAINT "salary_deductions_fina_salaryEntryId_fkey" FOREIGN KEY ("salaryEntryId") REFERENCES "fina"."salary_entries_fina"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fina"."salary_payment_details_fina" ADD CONSTRAINT "salary_payment_details_fina_salaryEntryId_fkey" FOREIGN KEY ("salaryEntryId") REFERENCES "fina"."salary_entries_fina"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fina"."fund_transfers_fina" ADD CONSTRAINT "fund_transfers_fina_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "fina"."transactions_fina"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fina"."fund_transfers_fina" ADD CONSTRAINT "fund_transfers_fina_fromAccountId_fkey" FOREIGN KEY ("fromAccountId") REFERENCES "fina"."accounts_fina"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fina"."fund_transfers_fina" ADD CONSTRAINT "fund_transfers_fina_toAccountId_fkey" FOREIGN KEY ("toAccountId") REFERENCES "fina"."accounts_fina"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fina"."cash_denominations_fina" ADD CONSTRAINT "cash_denominations_fina_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "fina"."cash_withdrawal_batches_fina"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fina"."recurring_templates_fina" ADD CONSTRAINT "recurring_templates_fina_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "fina"."companies_fina"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fina"."loan_contracts_fina" ADD CONSTRAINT "loan_contracts_fina_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "fina"."companies_fina"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fina"."loan_schedules_fina" ADD CONSTRAINT "loan_schedules_fina_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "fina"."loan_contracts_fina"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fina"."lease_contracts_fina" ADD CONSTRAINT "lease_contracts_fina_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "fina"."companies_fina"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fina"."lease_schedules_fina" ADD CONSTRAINT "lease_schedules_fina_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "fina"."lease_contracts_fina"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fina"."month_closes_fina" ADD CONSTRAINT "month_closes_fina_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "fina"."companies_fina"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fina"."transfer_batch_items_fina" ADD CONSTRAINT "transfer_batch_items_fina_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "fina"."transfer_batches_fina"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fina"."temporary_bank_accounts_fina" ADD CONSTRAINT "temporary_bank_accounts_fina_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "fina"."transactions_fina"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fina"."branch_masters_fina" ADD CONSTRAINT "branch_masters_fina_bankCode_fkey" FOREIGN KEY ("bankCode") REFERENCES "fina"."bank_masters_fina"("bankCode") ON DELETE RESTRICT ON UPDATE CASCADE;

