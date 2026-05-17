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

    // 並列化: monthlyBalance / pastTx / futureTx / SQL合計 を1ラウンドトリップで
    const [monthlyBalance, pastTx, futureTx, monthSumAgg] = await Promise.all([
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
      // 月全件をJS側で走査せず SQL の SUM で口座残高を一括取得
      prisma.transaction.aggregate({
        where: {
          companyId,
          accountId: mainAccount.id,
          accountingMonth: currentMonth,
        },
        _sum: { amount: true },
      }),
    ])

    const openingBalance = monthlyBalance?.openingBalance ?? BigInt(0)
    const monthSum = monthSumAgg._sum.amount ?? BigInt(0)
    const closingBalance = openingBalance + monthSum

    mainAccountBalance = closingBalance.toString()

    // 表示する 8 件分の running balance のみ算出する。
    // 各表示取引について「displayOrder/transactionDate がそれ以下の合計」を
    // 1 クエリで取得すれば良いが、Prisma で複雑な OR/lte は厄介なので、
    // 表示行と同じ並び順の取引だけを引いてアキュムレートする (全件ではなく
    // 8 件分以下の prefix で済む) — ただし正確な prefix は前段の取引を含むため、
    // 「対象取引のID集合より前の取引すべて」を引く必要がある。
    // ここでは表示8件のIDだけのまとめサブクエリを使い、各表示行に対し
    // groupBy で running balance を算出する代わりに、必要範囲だけ findMany する。
    const displayed = [...pastTx.reverse(), ...futureTx]

    let balanceMap = new Map<string, bigint>()
    if (displayed.length > 0) {
      // 表示行に到達するまでの取引すべてを取り、累積する。
      // 月全体ではなく「表示行のうち最後の行までで終わる」prefix にしたいが、
      // 月内取引数は通常数十~数百件なので影響は小さい。BigInt列を最小化して取得。
      const prefixTx = await prisma.transaction.findMany({
        where: {
          companyId,
          accountId: mainAccount.id,
          accountingMonth: currentMonth,
        },
        orderBy: [{ displayOrder: "asc" }, { transactionDate: "asc" }],
        select: { id: true, amount: true },
      })
      let running = openingBalance
      const displayedIds = new Set(displayed.map((t) => t.id))
      for (const tx of prefixTx) {
        running += tx.amount
        if (displayedIds.has(tx.id)) {
          balanceMap.set(tx.id, running)
        }
      }
    }

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
