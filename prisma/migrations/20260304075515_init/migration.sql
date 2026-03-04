-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'OPERATOR');

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('ORDINARY', 'TERM', 'SOCIAL_INSURANCE_RESERVE', 'CONSUMPTION_TAX_RESERVE');

-- CreateEnum
CREATE TYPE "TradingPartnerType" AS ENUM ('CUSTOMER', 'VENDOR', 'BOTH');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('EXPENSE', 'SALES', 'COST_PAYMENT', 'SALARY', 'LOAN', 'TRANSFER');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('DRAFT', 'READY', 'CONFIRMED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('BANK_TRANSFER', 'DIRECT_DEBIT', 'CASH_WITHDRAWAL');

-- CreateTable
CREATE TABLE "user_profiles" (
    "id" TEXT NOT NULL,
    "authUserId" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'OPERATOR',
    "displayName" TEXT NOT NULL,
    "assignedCompanyIds" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "companies" (
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

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "bankName" TEXT,
    "bankCode" TEXT,
    "branchName" TEXT,
    "branchCode" TEXT,
    "accountNumber" TEXT,
    "accountType" "AccountType" NOT NULL,
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

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_roles" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "roleKey" TEXT NOT NULL,
    "roleName" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "account_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monthly_balances" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "yearMonth" TEXT NOT NULL,
    "openingBalance" BIGINT NOT NULL DEFAULT 0,
    "closingBalance" BIGINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "monthly_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_category_majors" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_category_majors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_category_mids" (
    "id" TEXT NOT NULL,
    "majorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_category_mids_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_category_subs" (
    "id" TEXT NOT NULL,
    "midId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_category_subs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trading_partners" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameKana" TEXT,
    "type" "TradingPartnerType" NOT NULL,
    "tagKey" TEXT NOT NULL,
    "tagDisplayName" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trading_partners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trading_partner_bank_accounts" (
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

    CONSTRAINT "trading_partner_bank_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trading_partner_defaults" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "midId" TEXT NOT NULL,
    "subId" TEXT,

    CONSTRAINT "trading_partner_defaults_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trading_partner_sites" (
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

    CONSTRAINT "trading_partner_sites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "partnerId" TEXT,
    "type" "TransactionType" NOT NULL,
    "status" "TransactionStatus" NOT NULL DEFAULT 'DRAFT',
    "transactionDate" TIMESTAMP(3),
    "scheduledDate" TIMESTAMP(3),
    "accountingMonth" TEXT NOT NULL,
    "amount" BIGINT NOT NULL DEFAULT 0,
    "estimatedAmount" BIGINT,
    "actualAmount" BIGINT,
    "paymentMethod" "PaymentMethod",
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
    "amountUpdatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transaction_details" (
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

    CONSTRAINT "transaction_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evidences" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileSize" INTEGER,
    "mimeType" TEXT,
    "uploadedBy" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evidences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_groups" (
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

    CONSTRAINT "payroll_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "salary_entries" (
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
    "status" "TransactionStatus" NOT NULL DEFAULT 'DRAFT',
    "confirmedAt" TIMESTAMP(3),
    "confirmedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "salary_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "salary_deductions" (
    "id" TEXT NOT NULL,
    "salaryEntryId" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "amount" BIGINT NOT NULL DEFAULT 0,
    "midId" TEXT,
    "subId" TEXT,
    "contentRows" JSONB,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "salary_deductions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "salary_payment_details" (
    "id" TEXT NOT NULL,
    "salaryEntryId" TEXT NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL,
    "paymentMethod" "PaymentMethod" NOT NULL,
    "accountId" TEXT,
    "amount" BIGINT NOT NULL DEFAULT 0,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "salary_payment_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deduction_categories" (
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

    CONSTRAINT "deduction_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fund_transfers" (
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

    CONSTRAINT "fund_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_withdrawal_batches" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "withdrawalDate" TIMESTAMP(3) NOT NULL,
    "totalAmount" BIGINT NOT NULL,
    "status" "TransactionStatus" NOT NULL DEFAULT 'DRAFT',
    "confirmedAt" TIMESTAMP(3),
    "confirmedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cash_withdrawal_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_denominations" (
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

    CONSTRAINT "cash_denominations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recurring_templates" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "specificMonths" INTEGER[],
    "startMonth" INTEGER,
    "dueDayRule" TEXT NOT NULL,
    "holidayAdjust" TEXT NOT NULL DEFAULT 'PREV_BUSINESS',
    "transactionType" "TransactionType" NOT NULL,
    "accountId" TEXT,
    "partnerId" TEXT,
    "midId" TEXT,
    "subId" TEXT,
    "amountType" TEXT NOT NULL,
    "fixedAmount" BIGINT,
    "paymentMethod" "PaymentMethod",
    "classification" TEXT,
    "summary" TEXT,
    "assigneeId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastGeneratedMonth" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recurring_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loan_contracts" (
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

    CONSTRAINT "loan_contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loan_schedules" (
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

    CONSTRAINT "loan_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lease_contracts" (
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

    CONSTRAINT "lease_contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lease_schedules" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "paymentNumber" INTEGER NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "amount" BIGINT NOT NULL,
    "isPaid" BOOLEAN NOT NULL DEFAULT false,
    "transactionId" TEXT,

    CONSTRAINT "lease_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "month_closes" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "yearMonth" TEXT NOT NULL,
    "isClosed" BOOLEAN NOT NULL DEFAULT false,
    "closedAt" TIMESTAMP(3),
    "closedBy" TEXT,
    "reopenedAt" TIMESTAMP(3),
    "reopenedBy" TEXT,
    "reopenReason" TEXT,

    CONSTRAINT "month_closes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transfer_batches" (
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

    CONSTRAINT "transfer_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transfer_batch_items" (
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

    CONSTRAINT "transfer_batch_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "salary_journal_mappings" (
    "id" TEXT NOT NULL,
    "deductionItemName" TEXT NOT NULL,
    "majorId" TEXT NOT NULL,
    "midId" TEXT NOT NULL,
    "subId" TEXT,
    "classification" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "salary_journal_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "tableName" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "beforeData" JSONB,
    "afterData" JSONB,
    "reason" TEXT,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_masters" (
    "id" TEXT NOT NULL,
    "bankCode" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "bankNameKana" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "bank_masters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branch_masters" (
    "id" TEXT NOT NULL,
    "bankCode" TEXT NOT NULL,
    "branchCode" TEXT NOT NULL,
    "branchName" TEXT NOT NULL,
    "branchNameKana" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "branch_masters_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_profiles_authUserId_key" ON "user_profiles"("authUserId");

-- CreateIndex
CREATE UNIQUE INDEX "account_roles_accountId_roleKey_key" ON "account_roles"("accountId", "roleKey");

-- CreateIndex
CREATE UNIQUE INDEX "monthly_balances_accountId_yearMonth_key" ON "monthly_balances"("accountId", "yearMonth");

-- CreateIndex
CREATE UNIQUE INDEX "trading_partner_defaults_partnerId_key" ON "trading_partner_defaults"("partnerId");

-- CreateIndex
CREATE INDEX "transactions_companyId_accountId_accountingMonth_idx" ON "transactions"("companyId", "accountId", "accountingMonth");

-- CreateIndex
CREATE INDEX "transactions_companyId_type_accountingMonth_idx" ON "transactions"("companyId", "type", "accountingMonth");

-- CreateIndex
CREATE INDEX "transactions_parentId_idx" ON "transactions"("parentId");

-- CreateIndex
CREATE INDEX "transaction_details_transactionId_idx" ON "transaction_details"("transactionId");

-- CreateIndex
CREATE UNIQUE INDEX "salary_entries_payrollGroupId_payMonth_key" ON "salary_entries"("payrollGroupId", "payMonth");

-- CreateIndex
CREATE UNIQUE INDEX "fund_transfers_transactionId_key" ON "fund_transfers"("transactionId");

-- CreateIndex
CREATE INDEX "loan_schedules_contractId_idx" ON "loan_schedules"("contractId");

-- CreateIndex
CREATE INDEX "lease_schedules_contractId_idx" ON "lease_schedules"("contractId");

-- CreateIndex
CREATE UNIQUE INDEX "month_closes_companyId_yearMonth_key" ON "month_closes"("companyId", "yearMonth");

-- CreateIndex
CREATE UNIQUE INDEX "salary_journal_mappings_deductionItemName_key" ON "salary_journal_mappings"("deductionItemName");

-- CreateIndex
CREATE INDEX "audit_logs_tableName_recordId_idx" ON "audit_logs"("tableName", "recordId");

-- CreateIndex
CREATE INDEX "audit_logs_userId_timestamp_idx" ON "audit_logs"("userId", "timestamp");

-- CreateIndex
CREATE INDEX "audit_logs_timestamp_idx" ON "audit_logs"("timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "bank_masters_bankCode_key" ON "bank_masters"("bankCode");

-- CreateIndex
CREATE UNIQUE INDEX "branch_masters_bankCode_branchCode_key" ON "branch_masters"("bankCode", "branchCode");

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_roles" ADD CONSTRAINT "account_roles_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_balances" ADD CONSTRAINT "monthly_balances_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_balances" ADD CONSTRAINT "monthly_balances_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_category_mids" ADD CONSTRAINT "account_category_mids_majorId_fkey" FOREIGN KEY ("majorId") REFERENCES "account_category_majors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_category_subs" ADD CONSTRAINT "account_category_subs_midId_fkey" FOREIGN KEY ("midId") REFERENCES "account_category_mids"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trading_partners" ADD CONSTRAINT "trading_partners_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trading_partner_bank_accounts" ADD CONSTRAINT "trading_partner_bank_accounts_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "trading_partners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trading_partner_defaults" ADD CONSTRAINT "trading_partner_defaults_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "trading_partners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trading_partner_defaults" ADD CONSTRAINT "trading_partner_defaults_midId_fkey" FOREIGN KEY ("midId") REFERENCES "account_category_mids"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trading_partner_defaults" ADD CONSTRAINT "trading_partner_defaults_subId_fkey" FOREIGN KEY ("subId") REFERENCES "account_category_subs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trading_partner_sites" ADD CONSTRAINT "trading_partner_sites_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "trading_partners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "trading_partners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_cashWithdrawalBatchId_fkey" FOREIGN KEY ("cashWithdrawalBatchId") REFERENCES "cash_withdrawal_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_details" ADD CONSTRAINT "transaction_details_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_details" ADD CONSTRAINT "transaction_details_midId_fkey" FOREIGN KEY ("midId") REFERENCES "account_category_mids"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_details" ADD CONSTRAINT "transaction_details_subId_fkey" FOREIGN KEY ("subId") REFERENCES "account_category_subs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidences" ADD CONSTRAINT "evidences_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_groups" ADD CONSTRAINT "payroll_groups_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_entries" ADD CONSTRAINT "salary_entries_payrollGroupId_fkey" FOREIGN KEY ("payrollGroupId") REFERENCES "payroll_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_deductions" ADD CONSTRAINT "salary_deductions_salaryEntryId_fkey" FOREIGN KEY ("salaryEntryId") REFERENCES "salary_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_payment_details" ADD CONSTRAINT "salary_payment_details_salaryEntryId_fkey" FOREIGN KEY ("salaryEntryId") REFERENCES "salary_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fund_transfers" ADD CONSTRAINT "fund_transfers_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fund_transfers" ADD CONSTRAINT "fund_transfers_fromAccountId_fkey" FOREIGN KEY ("fromAccountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fund_transfers" ADD CONSTRAINT "fund_transfers_toAccountId_fkey" FOREIGN KEY ("toAccountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_denominations" ADD CONSTRAINT "cash_denominations_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "cash_withdrawal_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_templates" ADD CONSTRAINT "recurring_templates_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_contracts" ADD CONSTRAINT "loan_contracts_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_schedules" ADD CONSTRAINT "loan_schedules_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "loan_contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lease_contracts" ADD CONSTRAINT "lease_contracts_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lease_schedules" ADD CONSTRAINT "lease_schedules_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "lease_contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "month_closes" ADD CONSTRAINT "month_closes_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfer_batch_items" ADD CONSTRAINT "transfer_batch_items_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "transfer_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branch_masters" ADD CONSTRAINT "branch_masters_bankCode_fkey" FOREIGN KEY ("bankCode") REFERENCES "bank_masters"("bankCode") ON DELETE RESTRICT ON UPDATE CASCADE;
