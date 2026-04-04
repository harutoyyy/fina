"use server"

import { prisma } from "@/lib/prisma"
import { requireSession } from "@/lib/auth-server"

export type CurrentUserProfile = {
  id: string
  authUserId: string
  role: string
  displayName: string
  assignedCompanyIds: string[]
  isActive: boolean
}

export async function getCurrentUserProfile(): Promise<CurrentUserProfile | null> {
  const session = await requireSession()

  const profile = await prisma.userProfile.findUnique({
    where: { authUserId: session.user.id },
  })

  if (!profile) return null

  return {
    id: profile.id,
    authUserId: profile.authUserId,
    role: profile.role,
    displayName: profile.displayName,
    assignedCompanyIds: profile.assignedCompanyIds,
    isActive: profile.isActive,
  }
}

// ============================================================
// 受領BOX用データ取得
// 対象条件: 証憑あり OR 受領日あり OR 証憑なしOK
// ============================================================
export async function getExpenseBoxItems(
  companyId: string,
  filters?: {
    receivedDateFrom?: string
    receivedDateTo?: string
    receivedDatePreset?: "today" | "this_week" | "this_month"
    evidenceFilter?: "attached" | "not_required" | "missing"
    partnerSearch?: string
    scheduledDateFrom?: string
    scheduledDateTo?: string
    showReady?: boolean  // true=準備完了も表示、false=未準備完了のみ
  }
) {
  const session = await requireSession()

  const profile = await prisma.userProfile.findUnique({
    where: { authUserId: session.user.id },
  })

  const isAdmin = profile?.role === "ADMIN"

  if (!isAdmin && profile?.assignedCompanyIds) {
    if (!profile.assignedCompanyIds.includes(companyId)) {
      return []
    }
  }

  // 受領BOX対象: 証憑あり OR 受領日あり OR 証憑なしOK
  const where: Record<string, unknown> = {
    companyId,
    type: "EXPENSE",
    parentId: null,
    OR: [
      { hasEvidence: true },
      { receivedDate: { not: null } },
      { evidenceNotRequired: true },
    ],
  }

  // デフォルト: 未準備完了のみ（DRAFTのみ）
  if (filters?.showReady) {
    where.status = { in: ["DRAFT", "READY"] }
  } else {
    where.status = "DRAFT"
  }

  // 受領日フィルタ
  if (filters?.receivedDatePreset) {
    const now = new Date()
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    let from: Date
    let to: Date = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000 - 1)

    if (filters.receivedDatePreset === "today") {
      from = startOfDay
    } else if (filters.receivedDatePreset === "this_week") {
      const day = now.getDay()
      from = new Date(startOfDay.getTime() - (day === 0 ? 6 : day - 1) * 24 * 60 * 60 * 1000)
      to = new Date(from.getTime() + 7 * 24 * 60 * 60 * 1000 - 1)
    } else {
      from = new Date(now.getFullYear(), now.getMonth(), 1)
      to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
    }
    where.receivedDate = { gte: from, lte: to }
  } else if (filters?.receivedDateFrom || filters?.receivedDateTo) {
    const dateFilter: Record<string, Date> = {}
    if (filters.receivedDateFrom) dateFilter.gte = new Date(filters.receivedDateFrom)
    if (filters.receivedDateTo) dateFilter.lte = new Date(filters.receivedDateTo + "T23:59:59")
    where.receivedDate = dateFilter
  }

  // 証憑フィルタ
  if (filters?.evidenceFilter === "attached") {
    where.hasEvidence = true
  } else if (filters?.evidenceFilter === "not_required") {
    where.evidenceNotRequired = true
  } else if (filters?.evidenceFilter === "missing") {
    where.hasEvidence = false
    where.evidenceNotRequired = false
  }

  // 取引先検索（部分一致: 正規取引先名 OR 仮取引先名）
  if (filters?.partnerSearch) {
    where.OR = [
      { partner: { name: { contains: filters.partnerSearch, mode: "insensitive" } } },
      { temporaryVendorName: { contains: filters.partnerSearch, mode: "insensitive" } },
    ]
  }

  // 予定日フィルタ
  if (filters?.scheduledDateFrom || filters?.scheduledDateTo) {
    const schedFilter: Record<string, Date> = {}
    if (filters.scheduledDateFrom) schedFilter.gte = new Date(filters.scheduledDateFrom)
    if (filters.scheduledDateTo) schedFilter.lte = new Date(filters.scheduledDateTo + "T23:59:59")
    where.scheduledDate = schedFilter
  }

  const transactions = await prisma.transaction.findMany({
    where,
    orderBy: [{ scheduledDate: "asc" }, { createdAt: "asc" }],
    include: {
      account: { select: { id: true, bankName: true, branchName: true, accountNumber: true } },
      partner: { select: { id: true, name: true } },
      details: {
        orderBy: { displayOrder: "asc" },
        include: {
          mid: { select: { id: true, name: true } },
          sub: { select: { id: true, name: true } },
        },
      },
    },
  })

  return transactions.map((tx) => ({
    id: tx.id,
    companyId: tx.companyId,
    accountId: tx.accountId,
    partnerId: tx.partnerId,
    type: tx.type,
    status: tx.status,
    transactionDate: tx.transactionDate?.toISOString() ?? null,
    scheduledDate: tx.scheduledDate?.toISOString() ?? null,
    accountingMonth: tx.accountingMonth,
    amount: tx.amount.toString(),
    paymentMethod: tx.paymentMethod,
    summary: tx.summary,
    hasEvidence: tx.hasEvidence,
    evidenceNotRequired: tx.evidenceNotRequired,
    receivedDate: tx.receivedDate?.toISOString() ?? null,
    temporaryVendorName: tx.temporaryVendorName,
    partner: tx.partner ? { id: tx.partner.id, name: tx.partner.name } : null,
    account: {
      id: tx.account.id,
      bankName: tx.account.bankName,
      branchName: tx.account.branchName,
      accountNumber: tx.account.accountNumber,
    },
    details: tx.details.map((d) => ({
      id: d.id,
      midId: d.midId,
      midName: d.mid?.name ?? null,
      subName: d.sub?.name ?? null,
      amount: d.amount.toString(),
      summary: d.summary,
    })),
  }))
}

// ============================================================
// 支払月BOX用（従来互換）
// ============================================================
export async function getExpensesForOperator(
  companyId: string,
  month?: string
) {
  const session = await requireSession()

  const profile = await prisma.userProfile.findUnique({
    where: { authUserId: session.user.id },
  })

  const isAdmin = profile?.role === "ADMIN"

  const where: Record<string, unknown> = {
    companyId,
    type: "EXPENSE",
    status: { in: ["DRAFT", "READY"] },
  }

  if (month) {
    where.accountingMonth = month
  }

  if (!isAdmin && profile?.assignedCompanyIds) {
    if (!profile.assignedCompanyIds.includes(companyId)) {
      return []
    }
  }

  const transactions = await prisma.transaction.findMany({
    where,
    orderBy: [{ status: "asc" }, { transactionDate: "asc" }],
    include: {
      account: { select: { id: true, bankName: true, branchName: true, accountNumber: true } },
      partner: { select: { id: true, name: true } },
      details: {
        orderBy: { displayOrder: "asc" },
        include: {
          mid: { select: { id: true, name: true } },
          sub: { select: { id: true, name: true } },
        },
      },
    },
  })

  return transactions.map((tx) => ({
    id: tx.id,
    companyId: tx.companyId,
    accountId: tx.accountId,
    partnerId: tx.partnerId,
    type: tx.type,
    status: tx.status,
    transactionDate: tx.transactionDate?.toISOString() ?? null,
    accountingMonth: tx.accountingMonth,
    amount: tx.amount.toString(),
    paymentMethod: tx.paymentMethod,
    summary: tx.summary,
    hasEvidence: tx.hasEvidence,
    evidenceNotRequired: tx.evidenceNotRequired,
    receivedDate: tx.receivedDate?.toISOString() ?? null,
    temporaryVendorName: tx.temporaryVendorName,
    partner: tx.partner ? { id: tx.partner.id, name: tx.partner.name } : null,
    account: {
      id: tx.account.id,
      bankName: tx.account.bankName,
      branchName: tx.account.branchName,
      accountNumber: tx.account.accountNumber,
    },
    details: tx.details.map((d) => ({
      id: d.id,
      midId: d.midId,
      midName: d.mid?.name ?? null,
      subName: d.sub?.name ?? null,
      amount: d.amount.toString(),
      summary: d.summary,
    })),
  }))
}
