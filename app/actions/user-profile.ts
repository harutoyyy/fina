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
