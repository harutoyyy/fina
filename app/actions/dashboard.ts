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

  const [accountCount, partnerCount, transactionCount] = await Promise.all([
    prisma.account.count({ where: { companyId, isActive: true } }),
    prisma.tradingPartner.count({ where: { companyId, isActive: true } }),
    prisma.transaction.count({ where: { companyId, accountingMonth: currentMonth } }),
  ])

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { mainAccountId: true },
  })

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

    const monthlyBalance = await prisma.monthlyBalance.findUnique({
      where: {
        accountId_yearMonth: { accountId: mainAccount.id, yearMonth: currentMonth },
      },
    })

    const openingBalance = monthlyBalance?.openingBalance ?? BigInt(0)

    const todayStr = today.toISOString().split("T")[0]
    const todayDate = new Date(todayStr)

    const pastTx = await prisma.transaction.findMany({
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
      include: { partner: { select: { name: true } } },
    })

    const futureTx = await prisma.transaction.findMany({
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
      include: { partner: { select: { name: true } } },
    })

    const allTxForBalance = await prisma.transaction.findMany({
      where: {
        companyId,
        accountId: mainAccount.id,
        accountingMonth: currentMonth,
      },
      orderBy: [{ displayOrder: "asc" }, { transactionDate: "asc" }],
    })

    let balance = openingBalance
    const balanceMap = new Map<string, bigint>()
    for (const tx of allTxForBalance) {
      balance += tx.amount
      balanceMap.set(tx.id, balance)
    }

    mainAccountBalance = balance.toString()

    const combined = [...pastTx.reverse(), ...futureTx]
    mainAccountTransactions = combined.map((tx) => ({
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

  const pendingExpenses = await prisma.transaction.count({
    where: { companyId, type: "EXPENSE", status: "READY" },
  })
  const pendingAgg = await prisma.transaction.aggregate({
    where: { companyId, type: "EXPENSE", status: "READY" },
    _sum: { amount: true },
  })

  return {
    accountCount,
    partnerCount,
    transactionCountThisMonth: transactionCount,
    mainAccountTransactions,
    mainAccountBalance,
    mainAccountName,
    pendingExpenses,
    pendingAmount: (pendingAgg._sum.amount ?? BigInt(0)).toString(),
  }
}
