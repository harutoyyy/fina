"use server"

import { prisma } from "@/lib/prisma"
import { requireSession } from "@/lib/auth-server"

// ============================================================
// 全社合算ビュー専用 Server Actions（読み取り専用）
// ============================================================

/**
 * ログインユーザーがアクセス可能な会社IDの配列を取得。
 * ADMIN は全社、それ以外は assignedCompanyIds に限定。
 */
async function getAccessibleCompanyIds(): Promise<string[]> {
  const session = await requireSession()
  const profile = await prisma.userProfile.findUnique({
    where: { authUserId: session.user.id },
  })

  if (profile?.role === "ADMIN" || !profile) {
    const all = await prisma.company.findMany({
      where: { status: "ACTIVE" },
      orderBy: { displayOrder: "asc" },
      select: { id: true },
    })
    return all.map((c) => c.id)
  }
  return profile.assignedCompanyIds
}

export type AllCompaniesRow = {
  id: string
  companyId: string
  companyName: string
  companyShortName: string | null
  transactionDate: string | null
  scheduledDate: string | null
  accountingMonth: string | null
  type: string
  status: string
  partnerName: string | null
  summary: string | null
  amount: string
  paymentMethod: string | null
  accountLabel: string | null
}

type ListResult = {
  data: AllCompaniesRow[]
  total: number
  totalPages: number
  totalAmount: string
}

async function buildRows(
  baseWhere: Record<string, unknown>,
  filters: { page?: number; pageSize?: number; companyIds: string[] }
): Promise<ListResult> {
  const page = filters.page || 1
  const pageSize = filters.pageSize || 100

  const where = {
    ...baseWhere,
    companyId: { in: filters.companyIds },
  }

  const [total, transactions, sumResult] = await Promise.all([
    prisma.transaction.count({ where }),
    prisma.transaction.findMany({
      where,
      orderBy: [{ scheduledDate: "asc" }, { transactionDate: "asc" }, { createdAt: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        company: { select: { id: true, name: true, shortName: true } },
        account: { select: { bankName: true, branchName: true, accountNumber: true } },
        partner: { select: { name: true } },
      },
    }),
    prisma.transaction.aggregate({
      where,
      _sum: { amount: true },
    }),
  ])

  const data: AllCompaniesRow[] = transactions.map((tx) => ({
    id: tx.id,
    companyId: tx.companyId,
    companyName: tx.company.name,
    companyShortName: tx.company.shortName,
    transactionDate: tx.transactionDate?.toISOString() ?? null,
    scheduledDate: tx.scheduledDate?.toISOString() ?? null,
    accountingMonth: tx.accountingMonth,
    type: tx.type,
    status: tx.status,
    partnerName: tx.partner?.name ?? tx.temporaryVendorName ?? null,
    summary: tx.summary,
    amount: tx.amount.toString(),
    paymentMethod: tx.paymentMethod,
    accountLabel: tx.account
      ? [tx.account.bankName, tx.account.branchName, tx.account.accountNumber].filter(Boolean).join(" ")
      : null,
  }))

  return {
    data,
    total,
    totalPages: Math.ceil(total / pageSize),
    totalAmount: (sumResult._sum.amount ?? BigInt(0)).toString(),
  }
}

// ============================================================
// 資金繰り（全社・指定月）
// ============================================================
export async function getAllCompaniesCashFlow(
  yearMonth: string,
  filters?: { page?: number; pageSize?: number }
): Promise<ListResult & { totalDeposit: string; totalWithdrawal: string }> {
  const companyIds = await getAccessibleCompanyIds()
  const base = await buildRows(
    { accountingMonth: yearMonth, parentId: null },
    { ...filters, companyIds }
  )

  // 入金/出金合計（全件対象、ページネーション無関係）
  const [depositAgg, withdrawalAgg] = await Promise.all([
    prisma.transaction.aggregate({
      where: { companyId: { in: companyIds }, accountingMonth: yearMonth, parentId: null, amount: { gt: 0 } },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: { companyId: { in: companyIds }, accountingMonth: yearMonth, parentId: null, amount: { lt: 0 } },
      _sum: { amount: true },
    }),
  ])

  return {
    ...base,
    totalDeposit: (depositAgg._sum.amount ?? BigInt(0)).toString(),
    totalWithdrawal: (withdrawalAgg._sum.amount ?? BigInt(0)).toString(),
  }
}

// ============================================================
// 経費（全社）
// ============================================================
export async function getAllCompaniesExpenses(filters?: {
  yearMonth?: string
  page?: number
  pageSize?: number
}): Promise<ListResult> {
  const companyIds = await getAccessibleCompanyIds()
  const where: Record<string, unknown> = {
    type: "EXPENSE",
    parentId: null,
  }
  if (filters?.yearMonth) where.accountingMonth = filters.yearMonth
  return buildRows(where, { ...filters, companyIds })
}

// ============================================================
// 売上（全社）
// ============================================================
export async function getAllCompaniesSales(filters?: {
  yearMonth?: string
  page?: number
  pageSize?: number
}): Promise<ListResult> {
  const companyIds = await getAccessibleCompanyIds()
  const where: Record<string, unknown> = {
    type: "SALES",
    parentId: null,
  }
  if (filters?.yearMonth) where.accountingMonth = filters.yearMonth
  return buildRows(where, { ...filters, companyIds })
}

// ============================================================
// 受領BOX（全社・証憑/受領日関連の経費）
// ============================================================
export async function getAllCompaniesExpenseBox(filters?: {
  page?: number
  pageSize?: number
  showReady?: boolean
}): Promise<ListResult> {
  const companyIds = await getAccessibleCompanyIds()
  const where: Record<string, unknown> = {
    type: "EXPENSE",
    parentId: null,
    OR: [
      { hasEvidence: true },
      { receivedDate: { not: null } },
      { evidenceNotRequired: true },
    ],
  }
  where.status = filters?.showReady ? { in: ["DRAFT", "READY"] } : "DRAFT"
  return buildRows(where, { ...filters, companyIds })
}

// ============================================================
// 全社サマリ（タイル用: 件数のみ）
// ============================================================
export async function getAllCompaniesSummary(yearMonth: string) {
  const companyIds = await getAccessibleCompanyIds()
  const [expenseCount, salesCount, expenseBoxCount, txCount] = await Promise.all([
    prisma.transaction.count({
      where: { companyId: { in: companyIds }, type: "EXPENSE", parentId: null, accountingMonth: yearMonth },
    }),
    prisma.transaction.count({
      where: { companyId: { in: companyIds }, type: "SALES", parentId: null, accountingMonth: yearMonth },
    }),
    prisma.transaction.count({
      where: {
        companyId: { in: companyIds },
        type: "EXPENSE",
        parentId: null,
        status: "DRAFT",
        OR: [
          { hasEvidence: true },
          { receivedDate: { not: null } },
          { evidenceNotRequired: true },
        ],
      },
    }),
    prisma.transaction.count({
      where: { companyId: { in: companyIds }, parentId: null, accountingMonth: yearMonth },
    }),
  ])

  return {
    companyCount: companyIds.length,
    expenseCount,
    salesCount,
    expenseBoxCount,
    transactionCount: txCount,
  }
}
