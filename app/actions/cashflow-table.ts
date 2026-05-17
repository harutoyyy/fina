"use server"

import { prisma } from "@/lib/prisma"
import { requireSession } from "@/lib/auth-server"
import { revalidatePath } from "next/cache"
import { bigintToJson } from "@/lib/format"
import { createAuditLog } from "@/lib/audit-log"
import { getCurrentUserProfile } from "@/app/actions/user-profile"

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
  estimatedAmount: string | null
  actualAmount: string | null
  invoiceAmount: string | null
  recordedAmount: string | null
  transferAmount: string | null
  paymentMethod: string | null
  linkedTransactionId: string | null  // グループ間取引判定（PDF P1: グループ間入金/出金区別）
  isInterGroup: boolean                // linkedTransactionId !== null の便利フラグ
  isOverdue: boolean                   // 予定日超過・未確定の取引（PDF P1: 未達薄色表示）
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

export type CheckpointData = {
  id: string
  checkpointDate: string
  verifiedBalance: string
  verifiedBy: string
  verifiedAt: string
  note: string | null
}

export type CashFlowTableData = {
  rows: CashFlowRow[]
  openingBalance: string
  totalDeposit: string
  totalWithdrawal: string
  closingBalance: string
  // PDF P1: グループ間入金/出金が分かるように
  interGroupDeposit: string
  interGroupWithdrawal: string
  checkpoints: CheckpointData[]
}

/**
 * 同日同時ルール: 引落(0) > 資金移動/振込/現金(1) > 入金(2)
 * PDF P1 「引落上位 → 資金移動・振込・現金 → 入金下位」
 */
function paymentPriority(tx: {
  amount: bigint
  paymentMethod: string | null
  type: string
}): number {
  if (tx.paymentMethod === "DIRECT_DEBIT") return 0
  if (
    tx.type === "TRANSFER" ||
    tx.paymentMethod === "BANK_TRANSFER" ||
    tx.paymentMethod === "CASH_WITHDRAWAL"
  ) {
    return 1
  }
  if (tx.amount > BigInt(0)) return 2
  return 1
}

/**
 * MonthlyBalance レコードがない月の月初残高を、
 * 直近の MonthlyBalance.closingBalance + 間の月の取引合計から算出する。
 */
async function calcOpeningBalance(
  accountId: string,
  yearMonth: string
): Promise<bigint> {
  // 指定月より前の最新の MonthlyBalance を取得
  const latestBalance = await prisma.monthlyBalance.findFirst({
    where: {
      accountId,
      yearMonth: { lt: yearMonth },
    },
    orderBy: { yearMonth: "desc" },
  })

  const baseBalance = latestBalance?.closingBalance ?? BigInt(0)
  const startMonth = latestBalance
    ? nextYearMonth(latestBalance.yearMonth)
    : null

  if (!startMonth || startMonth >= yearMonth) {
    return baseBalance
  }

  // 起点月から対象月の前月までの取引合計を加算
  const gap = await prisma.transaction.aggregate({
    where: {
      accountId,
      accountingMonth: { gte: startMonth, lt: yearMonth },
    },
    _sum: { amount: true },
  })

  return baseBalance + (gap._sum.amount ?? BigInt(0))
}

function nextYearMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number)
  const d = new Date(y, m, 1) // m is already 1-based, so this gives next month
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

export async function getCashFlowTable(
  companyId: string,
  accountId: string,
  yearMonth: string
): Promise<CashFlowTableData> {
  await requireSession()

  // 並列化: 会社存在確認 / 取引一覧 / 月初残高 / 突合チェックポイント を1ラウンドトリップで
  const [company, transactions, monthlyBalance, checkpoints] = await Promise.all([
    prisma.company.findUnique({ where: { id: companyId }, select: { id: true } }),
    prisma.transaction.findMany({
      where: {
        companyId,
        accountId,
        accountingMonth: yearMonth,
      },
      orderBy: [{ displayOrder: "asc" }, { transactionDate: "asc" }],
      // include を必要フィールドだけの select に絞る (BigInt列も明示)
      select: {
        id: true,
        transactionDate: true,
        scheduledDate: true,
        type: true,
        classification: true,
        status: true,
        amount: true,
        displayOrder: true,
        updatedAt: true,
        createdAt: true,
        estimatedAmount: true,
        actualAmount: true,
        invoiceAmount: true,
        recordedAmount: true,
        transferAmount: true,
        paymentMethod: true,
        linkedTransactionId: true,
        summary: true,
        temporaryVendorName: true,
        partner: { select: { id: true, name: true } },
        details: {
          orderBy: { displayOrder: "asc" },
          select: {
            id: true,
            midId: true,
            subId: true,
            amount: true,
            summary: true,
            displayOrder: true,
            mid: { select: { id: true, name: true } },
            sub: { select: { id: true, name: true } },
          },
        },
      },
    }),
    prisma.monthlyBalance.findUnique({
      where: {
        accountId_yearMonth: { accountId, yearMonth },
      },
      select: { openingBalance: true },
    }),
    prisma.reconciliationCheckpoint.findMany({
      where: { companyId, accountId, yearMonth },
      orderBy: { checkpointDate: "asc" },
    }),
  ])

  if (!company) {
    throw new Error("Company not found")
  }

  // 同日同時ルール: 同一日付内では PaymentMethod 優先度で並べ替える。
  // displayOrder が手動設定されている取引（>0）はその順序を尊重し、
  // 同じ displayOrder グループ内のみルール適用する。
  transactions.sort((a, b) => {
    const dateA = (a.transactionDate ?? a.scheduledDate)?.getTime() ?? 0
    const dateB = (b.transactionDate ?? b.scheduledDate)?.getTime() ?? 0
    if (dateA !== dateB) return dateA - dateB
    if (a.displayOrder !== b.displayOrder) return a.displayOrder - b.displayOrder
    const prioDiff = paymentPriority(a) - paymentPriority(b)
    if (prioDiff !== 0) return prioDiff
    return a.createdAt.getTime() - b.createdAt.getTime()
  })

  let openingBalance: bigint
  if (monthlyBalance) {
    openingBalance = monthlyBalance.openingBalance
  } else {
    openingBalance = await calcOpeningBalance(accountId, yearMonth)
  }

  let runningBalance = openingBalance
  let totalDeposit = BigInt(0)
  let totalWithdrawal = BigInt(0)
  let interGroupDeposit = BigInt(0)
  let interGroupWithdrawal = BigInt(0)

  // 未達判定の基準日（今日の始まり）
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const rows: CashFlowRow[] = transactions.map((tx) => {
    const amount = tx.amount
    if (amount > BigInt(0)) {
      totalDeposit += amount
    } else {
      totalWithdrawal += amount
    }
    runningBalance += amount

    const isInterGroup = tx.linkedTransactionId !== null
    if (isInterGroup) {
      if (amount > BigInt(0)) interGroupDeposit += amount
      else interGroupWithdrawal += amount
    }

    // PDF P1: 未達 = 予定日が過去かつ実日付未確定（actualAmount 未入力 or status != CONFIRMED）
    const sched = tx.scheduledDate
    const isOverdue =
      tx.status !== "CONFIRMED" &&
      sched !== null &&
      sched < todayStart &&
      (tx.actualAmount === null || tx.transactionDate === null)

    return {
      id: tx.id,
      transactionDate: tx.transactionDate?.toISOString() ?? null,
      scheduledDate: tx.scheduledDate?.toISOString() ?? null,
      type: tx.type,
      classification: tx.classification,
      status: tx.status,
      partnerId: tx.partner?.id ?? null,
      partnerName: tx.partner?.name ?? tx.temporaryVendorName ?? null,
      amount: amount.toString(),
      deposit: amount > BigInt(0) ? amount.toString() : "0",
      withdrawal: amount < BigInt(0) ? amount.toString() : "0",
      runningBalance: runningBalance.toString(),
      summary: tx.summary,
      displayOrder: tx.displayOrder,
      updatedAt: tx.updatedAt.toISOString(),
      estimatedAmount: tx.estimatedAmount?.toString() ?? null,
      actualAmount: tx.actualAmount?.toString() ?? null,
      invoiceAmount: tx.invoiceAmount?.toString() ?? null,
      recordedAmount: tx.recordedAmount?.toString() ?? null,
      transferAmount: tx.transferAmount?.toString() ?? null,
      paymentMethod: tx.paymentMethod,
      linkedTransactionId: tx.linkedTransactionId,
      isInterGroup,
      isOverdue,
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
    interGroupDeposit: interGroupDeposit.toString(),
    interGroupWithdrawal: interGroupWithdrawal.toString(),
    checkpoints: checkpoints.map((cp) => ({
      id: cp.id,
      checkpointDate: cp.checkpointDate.toISOString(),
      verifiedBalance: cp.verifiedBalance.toString(),
      verifiedBy: cp.verifiedBy,
      verifiedAt: cp.verifiedAt.toISOString(),
      note: cp.note,
    })),
  }
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

  const profile = await getCurrentUserProfile()
  if (profile?.role !== "ADMIN") {
    throw new Error("月締め操作は管理者のみ実行できます")
  }

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
    tableName: "month_closes_fina",
    recordId: result.id,
    operation: "MONTH_CLOSE",
    userId: session.user.id,
    afterData: { companyId, yearMonth },
  })

  revalidatePath("/cashflow-table")
  return bigintToJson(result)
}

export async function reopenMonth(
  companyId: string,
  yearMonth: string,
  reason: string
) {
  const session = await requireSession()
  await verifyCompanyAccess(companyId)

  const profile = await getCurrentUserProfile()
  if (profile?.role !== "ADMIN") {
    throw new Error("月締め操作は管理者のみ実行できます")
  }

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
    tableName: "month_closes_fina",
    recordId: result.id,
    operation: "MONTH_REOPEN",
    userId: session.user.id,
    beforeData: { companyId, yearMonth, isClosed: true },
    afterData: { companyId, yearMonth, isClosed: false },
    reason: reason.trim(),
  })

  revalidatePath("/cashflow-table")
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
    tableName: "transactions_fina",
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
  yearMonth: string,
  dateUpdates?: { transactionId: string; scheduledDate: string }[]
) {
  await requireSession()
  await verifyCompanyAccess(companyId)

  const ops = updates.map((u) =>
    prisma.transaction.update({
      where: { id: u.id },
      data: { displayOrder: u.displayOrder },
    })
  )

  if (dateUpdates && dateUpdates.length > 0) {
    for (const du of dateUpdates) {
      ops.push(
        prisma.transaction.update({
          where: { id: du.transactionId },
          data: { scheduledDate: new Date(du.scheduledDate) },
        })
      )
    }
  }

  await prisma.$transaction(ops)

  await recalculateClosingBalance(companyId, accountId, yearMonth)
  revalidatePath("/cashflow-table")
  return { success: true }
}
