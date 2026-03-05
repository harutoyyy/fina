"use server"

import { prisma } from "@/lib/prisma"
import { requireSession } from "@/lib/auth-server"
import { revalidatePath } from "next/cache"
import { bigintToJson } from "@/lib/format"
import { createAuditLog } from "@/lib/audit-log"

async function verifyCompanyAccess(companyId: string) {
  const company = await prisma.company.findUnique({ where: { id: companyId } })
  if (!company) {
    throw new Error("Company not found")
  }
  return company
}

export async function checkMonthClosed(companyId: string, yearMonth: string): Promise<boolean> {
  const monthClose = await prisma.monthClose.findUnique({
    where: { companyId_yearMonth: { companyId, yearMonth } },
  })
  return monthClose?.isClosed ?? false
}

export const isMonthClosed = checkMonthClosed

export async function ensureMonthOpen(companyId: string, yearMonth: string) {
  const closed = await checkMonthClosed(companyId, yearMonth)
  if (closed) {
    throw new Error(`Month ${yearMonth} is closed. Reopen it before making changes.`)
  }
}

export async function ensureMonthOpenForAmount(companyId: string, yearMonth: string) {
  const closed = await checkMonthClosed(companyId, yearMonth)
  if (closed) {
    throw new Error("月締め後は金額変更できません")
  }
}

export type CashFlowRow = {
  id: string
  transactionDate: string | null
  scheduledDate: string | null
  type: string
  classification: string | null
  status: string
  partnerId: string | null
  partnerName: string | null
  amount: string
  deposit: string
  withdrawal: string
  runningBalance: string
  summary: string | null
  displayOrder: number
  updatedAt: string
  details: {
    id: string
    midId: string | null
    subId: string | null
    midName: string | null
    subName: string | null
    amount: string
    summary: string | null
  }[]
}

export type CashFlowTableData = {
  rows: CashFlowRow[]
  openingBalance: string
  totalDeposit: string
  totalWithdrawal: string
  closingBalance: string
}

export async function getCashFlowTable(
  companyId: string,
  accountId: string,
  yearMonth: string
): Promise<CashFlowTableData> {
  await requireSession()
  await verifyCompanyAccess(companyId)

  const transactions = await prisma.transaction.findMany({
    where: {
      companyId,
      accountId,
      accountingMonth: yearMonth,
    },
    orderBy: [{ displayOrder: "asc" }, { transactionDate: "asc" }],
    include: {
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

  const monthlyBalance = await prisma.monthlyBalance.findUnique({
    where: {
      accountId_yearMonth: { accountId, yearMonth },
    },
  })

  const openingBalance = monthlyBalance?.openingBalance ?? BigInt(0)

  let runningBalance = openingBalance
  let totalDeposit = BigInt(0)
  let totalWithdrawal = BigInt(0)

  const rows: CashFlowRow[] = transactions.map((tx) => {
    const amount = tx.amount
    if (amount > BigInt(0)) {
      totalDeposit += amount
    } else {
      totalWithdrawal += amount
    }
    runningBalance += amount

    return {
      id: tx.id,
      transactionDate: tx.transactionDate?.toISOString() ?? null,
      scheduledDate: tx.scheduledDate?.toISOString() ?? null,
      type: tx.type,
      classification: tx.classification,
      status: tx.status,
      partnerId: tx.partner?.id ?? null,
      partnerName: tx.partner?.name ?? null,
      amount: amount.toString(),
      deposit: amount > BigInt(0) ? amount.toString() : "0",
      withdrawal: amount < BigInt(0) ? amount.toString() : "0",
      runningBalance: runningBalance.toString(),
      summary: tx.summary,
      displayOrder: tx.displayOrder,
      updatedAt: tx.updatedAt.toISOString(),
      details: tx.details.map((d) => ({
        id: d.id,
        midId: d.midId,
        subId: d.subId,
        midName: d.mid?.name ?? null,
        subName: d.sub?.name ?? null,
        amount: d.amount.toString(),
        summary: d.summary,
      })),
    }
  })

  const closingBalance = openingBalance + totalDeposit + totalWithdrawal

  return {
    rows,
    openingBalance: openingBalance.toString(),
    totalDeposit: totalDeposit.toString(),
    totalWithdrawal: totalWithdrawal.toString(),
    closingBalance: closingBalance.toString(),
  }
}

export async function getMonthlyBalance(
  companyId: string,
  accountId: string,
  yearMonth: string
) {
  await requireSession()
  await verifyCompanyAccess(companyId)

  const balance = await prisma.monthlyBalance.findUnique({
    where: {
      accountId_yearMonth: { accountId, yearMonth },
    },
  })

  return bigintToJson(balance)
}

export async function upsertMonthlyBalance(
  companyId: string,
  accountId: string,
  yearMonth: string,
  openingBalance: string
) {
  await requireSession()
  await verifyCompanyAccess(companyId)
  await ensureMonthOpen(companyId, yearMonth)

  const account = await prisma.account.findUnique({ where: { id: accountId } })
  if (!account || account.companyId !== companyId) {
    throw new Error("Account not found")
  }

  const openBal = BigInt(openingBalance)

  const transactions = await prisma.transaction.findMany({
    where: {
      companyId,
      accountId,
      accountingMonth: yearMonth,
    },
    select: { amount: true },
  })

  const totalAmount = transactions.reduce((sum, tx) => sum + tx.amount, BigInt(0))
  const closingBal = openBal + totalAmount

  const result = await prisma.monthlyBalance.upsert({
    where: {
      accountId_yearMonth: { accountId, yearMonth },
    },
    create: {
      companyId,
      accountId,
      yearMonth,
      openingBalance: openBal,
      closingBalance: closingBal,
    },
    update: {
      openingBalance: openBal,
      closingBalance: closingBal,
    },
  })

  revalidatePath("/cashflow-table")
  revalidatePath("/monthly-close")
  return bigintToJson(result)
}

export async function recalculateClosingBalance(
  companyId: string,
  accountId: string,
  yearMonth: string
) {
  await requireSession()
  await verifyCompanyAccess(companyId)

  const balance = await prisma.monthlyBalance.findUnique({
    where: {
      accountId_yearMonth: { accountId, yearMonth },
    },
  })

  if (!balance || balance.companyId !== companyId) {
    throw new Error("MonthlyBalance not found")
  }

  const transactions = await prisma.transaction.findMany({
    where: {
      companyId,
      accountId,
      accountingMonth: yearMonth,
    },
    select: { amount: true },
  })

  const totalAmount = transactions.reduce((sum, tx) => sum + tx.amount, BigInt(0))
  const closingBal = balance.openingBalance + totalAmount

  const result = await prisma.monthlyBalance.update({
    where: {
      accountId_yearMonth: { accountId, yearMonth },
    },
    data: {
      closingBalance: closingBal,
    },
  })

  revalidatePath("/cashflow-table")
  revalidatePath("/monthly-close")
  return bigintToJson(result)
}

export async function getMonthCloseStatus(
  companyId: string,
  yearMonth: string
) {
  await requireSession()
  await verifyCompanyAccess(companyId)

  const monthClose = await prisma.monthClose.findUnique({
    where: {
      companyId_yearMonth: { companyId, yearMonth },
    },
  })

  return bigintToJson(monthClose)
}

export async function closeMonth(
  companyId: string,
  yearMonth: string
) {
  const session = await requireSession()
  await verifyCompanyAccess(companyId)

  const result = await prisma.monthClose.upsert({
    where: {
      companyId_yearMonth: { companyId, yearMonth },
    },
    create: {
      companyId,
      yearMonth,
      isClosed: true,
      closedAt: new Date(),
      closedBy: session.user.id,
    },
    update: {
      isClosed: true,
      closedAt: new Date(),
      closedBy: session.user.id,
      reopenedAt: null,
      reopenedBy: null,
      reopenReason: null,
    },
  })

  await createAuditLog({
    tableName: "month_closes",
    recordId: result.id,
    operation: "MONTH_CLOSE",
    userId: session.user.id,
    afterData: { companyId, yearMonth },
  })

  revalidatePath("/cashflow-table")
  revalidatePath("/monthly-close")
  return bigintToJson(result)
}

export async function reopenMonth(
  companyId: string,
  yearMonth: string,
  reason: string
) {
  const session = await requireSession()
  await verifyCompanyAccess(companyId)

  if (!reason || reason.trim().length === 0) {
    throw new Error("Reopen reason is required")
  }

  const existing = await prisma.monthClose.findUnique({
    where: {
      companyId_yearMonth: { companyId, yearMonth },
    },
  })

  if (!existing || !existing.isClosed) {
    throw new Error("Month is not closed")
  }

  const result = await prisma.monthClose.update({
    where: {
      companyId_yearMonth: { companyId, yearMonth },
    },
    data: {
      isClosed: false,
      reopenedAt: new Date(),
      reopenedBy: session.user.id,
      reopenReason: reason.trim(),
    },
  })

  await createAuditLog({
    tableName: "month_closes",
    recordId: result.id,
    operation: "MONTH_REOPEN",
    userId: session.user.id,
    beforeData: { companyId, yearMonth, isClosed: true },
    afterData: { companyId, yearMonth, isClosed: false },
    reason: reason.trim(),
  })

  revalidatePath("/cashflow-table")
  revalidatePath("/monthly-close")
  return bigintToJson(result)
}

export async function deferTransaction(
  transactionId: string,
  companyId: string,
  targetMonth?: string
) {
  const session = await requireSession()
  await verifyCompanyAccess(companyId)

  const existing = await prisma.transaction.findUnique({
    where: { id: transactionId },
  })
  if (!existing || existing.companyId !== companyId) {
    throw new Error("Transaction not found")
  }

  if (existing.status === "CONFIRMED") {
    throw new Error("確定済の取引は繰り延べできません")
  }

  await ensureMonthOpen(companyId, existing.accountingMonth)

  const currentMonth = existing.accountingMonth
  let nextMonth: string
  if (targetMonth) {
    nextMonth = targetMonth
  } else {
    const [y, m] = currentMonth.split("-").map(Number)
    const nextDate = new Date(y, m, 1)
    nextMonth = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, "0")}`
  }

  let newScheduledDate = existing.scheduledDate
  if (existing.scheduledDate) {
    const [ny, nm] = nextMonth.split("-").map(Number)
    const oldDay = existing.scheduledDate.getDate()
    const lastDayOfNextMonth = new Date(ny, nm, 0).getDate()
    const day = Math.min(oldDay, lastDayOfNextMonth)
    newScheduledDate = new Date(ny, nm - 1, day)
  }

  const result = await prisma.transaction.update({
    where: { id: transactionId },
    data: {
      accountingMonth: nextMonth,
      scheduledDate: newScheduledDate,
    },
  })

  await createAuditLog({
    tableName: "transactions",
    recordId: transactionId,
    operation: "UPDATE",
    userId: session.user.id,
    beforeData: { accountingMonth: currentMonth },
    afterData: { accountingMonth: nextMonth, action: "DEFER" },
  })

  revalidatePath("/cashflow-table")
  return bigintToJson(result)
}

export async function deferTransactionsBatch(
  transactionIds: string[],
  companyId: string,
  targetMonth?: string
) {
  const session = await requireSession()
  await verifyCompanyAccess(companyId)

  const results = []
  for (const txId of transactionIds) {
    try {
      const result = await deferTransaction(txId, companyId, targetMonth)
      results.push({ id: txId, success: true, result })
    } catch (e) {
      results.push({ id: txId, success: false, error: e instanceof Error ? e.message : "Unknown error" })
    }
  }

  revalidatePath("/cashflow-table")
  return results
}

export async function updateDisplayOrder(
  transactionId: string,
  companyId: string,
  newOrder: number
) {
  await requireSession()
  await verifyCompanyAccess(companyId)

  const existing = await prisma.transaction.findUnique({
    where: { id: transactionId },
  })
  if (!existing || existing.companyId !== companyId) {
    throw new Error("Transaction not found")
  }

  const result = await prisma.transaction.update({
    where: { id: transactionId },
    data: { displayOrder: newOrder },
  })

  revalidatePath("/cashflow-table")
  return bigintToJson(result)
}

export async function reorderTransactions(
  updates: { id: string; displayOrder: number }[],
  companyId: string,
  accountId: string,
  yearMonth: string
) {
  await requireSession()
  await verifyCompanyAccess(companyId)

  await prisma.$transaction(
    updates.map((u) =>
      prisma.transaction.update({
        where: { id: u.id },
        data: { displayOrder: u.displayOrder },
      })
    )
  )

  await recalculateClosingBalance(companyId, accountId, yearMonth)
  revalidatePath("/cashflow-table")
  return { success: true }
}
