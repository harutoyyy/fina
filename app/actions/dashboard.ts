"use server"

import { prisma } from "@/lib/prisma"
import { requireSession } from "@/lib/auth-server"

export type DashboardSummary = {
  accountCount: number
  partnerCount: number
  transactionCountThisMonth: number
  mainAccountTransactions: {
    id: string
    transactionDate: string | null
    scheduledDate: string | null
    partnerName: string | null
    amount: string
    runningBalance: string
    type: string
    summary: string | null
    status: string
  }[]
  mainAccountBalance: string
  mainAccountName: string | null
  pendingExpenses: number
  pendingAmount: string
}

export async function getDashboardData(companyId: string): Promise<DashboardSummary> {
  await requireSession()

  const today = new Date()
  const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`

  // 並列化: counts / company / pending aggregates をまとめて1ラウンドトリップで実行
  const [
    accountCount,
    partnerCount,
    transactionCount,
    company,
    pendingAgg,
  ] = await Promise.all([
    prisma.account.count({ where: { companyId, isActive: true } }),
    prisma.tradingPartner.count({ where: { companyId, isActive: true } }),
    prisma.transaction.count({ where: { companyId, accountingMonth: currentMonth } }),
    prisma.company.findUnique({
      where: { id: companyId },
      select: { mainAccountId: true },
    }),
    prisma.transaction.aggregate({
      where: { companyId, type: "EXPENSE", status: "READY" },
      _sum: { amount: true },
      _count: { _all: true },
    }),
  ])

  const mainAccount = company?.mainAccountId
    ? await prisma.account.findUnique({
        where: { id: company.mainAccountId },
        select: { id: true, bankName: true, branchName: true, accountNumber: true },
      })
    : await prisma.account.findFirst({
        where: { companyId, isActive: true },
        orderBy: { displayOrder: "asc" },
        select: { id: true, bankName: true, branchName: true, accountNumber: true },
      })

  let mainAccountTransactions: DashboardSummary["mainAccountTransactions"] = []
  let mainAccountBalance = "0"
  let mainAccountName: string | null = null

  if (mainAccount) {
    mainAccountName = [mainAccount.bankName, mainAccount.branchName, mainAccount.accountNumber]
      .filter(Boolean)
      .join(" ")

    const todayStr = today.toISOString().split("T")[0]
    const todayDate = new Date(todayStr)

    // 軽量化したフィールドセット (BigInt 列を最小限に)
    const txSelect = {
      id: true,
      transactionDate: true,
      scheduledDate: true,
      amount: true,
      type: true,
      summary: true,
      status: true,
      displayOrder: true,
      partner: { select: { name: true } },
    } as const

    // 並列化: monthlyBalance / pastTx / futureTx / 月全件 (合計+残高計算用) を1ラウンドトリップで
    // 旧実装は aggregate + findMany を別々に投げていたが、月全件 findMany 1回で
    // 月合計と prefix running balance の両方が出せるため 1 RTT 削減。
    const [monthlyBalance, pastTx, futureTx, allMonthTx] = await Promise.all([
      prisma.monthlyBalance.findUnique({
        where: {
          accountId_yearMonth: { accountId: mainAccount.id, yearMonth: currentMonth },
        },
        select: { openingBalance: true },
      }),
      prisma.transaction.findMany({
        where: {
          companyId,
          accountId: mainAccount.id,
          accountingMonth: currentMonth,
          OR: [
            { transactionDate: { lte: todayDate } },
            { transactionDate: null, scheduledDate: { lte: todayDate } },
          ],
        },
        orderBy: [{ transactionDate: "desc" }],
        take: 3,
        select: txSelect,
      }),
      prisma.transaction.findMany({
        where: {
          companyId,
          accountId: mainAccount.id,
          accountingMonth: currentMonth,
          OR: [
            { transactionDate: { gt: todayDate } },
            { transactionDate: null, scheduledDate: { gt: todayDate } },
          ],
        },
        orderBy: [{ transactionDate: "asc" }, { scheduledDate: "asc" }],
        take: 5,
        select: txSelect,
      }),
      prisma.transaction.findMany({
        where: {
          companyId,
          accountId: mainAccount.id,
          accountingMonth: currentMonth,
        },
        orderBy: [{ displayOrder: "asc" }, { transactionDate: "asc" }],
        select: { id: true, amount: true },
      }),
    ])

    const openingBalance = monthlyBalance?.openingBalance ?? BigInt(0)
    const displayed = [...pastTx.reverse(), ...futureTx]

    // 月合計と表示行の running balance を 1 パスで同時計算
    const displayedIds = new Set(displayed.map((t) => t.id))
    const balanceMap = new Map<string, bigint>()
    let running = openingBalance
    let monthSum = BigInt(0)
    for (const tx of allMonthTx) {
      monthSum += tx.amount
      running += tx.amount
      if (displayedIds.has(tx.id)) {
        balanceMap.set(tx.id, running)
      }
    }

    const closingBalance = openingBalance + monthSum
    mainAccountBalance = closingBalance.toString()

    mainAccountTransactions = displayed.map((tx) => ({
      id: tx.id,
      transactionDate: tx.transactionDate?.toISOString() ?? null,
      scheduledDate: tx.scheduledDate?.toISOString() ?? null,
      partnerName: tx.partner?.name ?? null,
      amount: tx.amount.toString(),
      runningBalance: (balanceMap.get(tx.id) ?? BigInt(0)).toString(),
      type: tx.type,
      summary: tx.summary,
      status: tx.status,
    }))
  }

  return {
    accountCount,
    partnerCount,
    transactionCountThisMonth: transactionCount,
    mainAccountTransactions,
    mainAccountBalance,
    mainAccountName,
    pendingExpenses: pendingAgg._count._all,
    pendingAmount: (pendingAgg._sum.amount ?? BigInt(0)).toString(),
  }
}
