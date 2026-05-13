"use server"

import { prisma } from "@/lib/prisma"
import { requireSession } from "@/lib/auth-server"
import { revalidatePath } from "next/cache"
import { getCurrentUserProfile } from "@/app/actions/user-profile"

async function requireAdmin() {
  await requireSession()
  const profile = await getCurrentUserProfile()
  if (profile?.role !== "ADMIN") {
    throw new Error("会社グループの編集は管理者のみ実行できます")
  }
}

export async function getCompanyGroups() {
  await requireSession()
  return prisma.companyGroup.findMany({
    orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    include: {
      members: {
        orderBy: { displayOrder: "asc" },
      },
    },
  })
}

export async function getCompanyGroupsWithCompanies() {
  await requireSession()
  const groups = await prisma.companyGroup.findMany({
    where: { isActive: true },
    orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    include: { members: true },
  })

  const allCompanyIds = Array.from(new Set(groups.flatMap((g) => g.members.map((m) => m.companyId))))
  const companies = await prisma.company.findMany({
    where: { id: { in: allCompanyIds } },
    select: {
      id: true,
      name: true,
      shortName: true,
      status: true,
      industryMaster: { select: { name: true } },
    },
  })
  const companyMap = new Map(companies.map((c) => [c.id, c]))

  return groups.map((g) => ({
    ...g,
    companies: g.members
      .map((m) => companyMap.get(m.companyId))
      .filter((c): c is NonNullable<typeof c> => !!c),
  }))
}

export async function createCompanyGroup(data: {
  name: string
  shortName?: string
  description?: string
  colorCode?: string
  displayOrder?: number
}) {
  await requireAdmin()
  const name = data.name.trim()
  if (!name) throw new Error("グループ名は必須です")

  const row = await prisma.companyGroup.create({
    data: {
      name,
      shortName: data.shortName?.trim() || null,
      description: data.description?.trim() || null,
      colorCode: data.colorCode?.trim() || null,
      displayOrder: data.displayOrder ?? 0,
    },
  })
  revalidatePath("/master/company-groups")
  revalidatePath("/dashboard")
  return row
}

export async function updateCompanyGroup(
  id: string,
  data: {
    name?: string
    shortName?: string | null
    description?: string | null
    colorCode?: string | null
    displayOrder?: number
    isActive?: boolean
  }
) {
  await requireAdmin()
  const update: Record<string, unknown> = {}
  if (data.name !== undefined) {
    const n = data.name.trim()
    if (!n) throw new Error("グループ名は必須です")
    update.name = n
  }
  if (data.shortName !== undefined) update.shortName = data.shortName?.trim() || null
  if (data.description !== undefined) update.description = data.description?.trim() || null
  if (data.colorCode !== undefined) update.colorCode = data.colorCode?.trim() || null
  if (data.displayOrder !== undefined) update.displayOrder = data.displayOrder
  if (data.isActive !== undefined) update.isActive = data.isActive

  const row = await prisma.companyGroup.update({ where: { id }, data: update })
  revalidatePath("/master/company-groups")
  revalidatePath("/dashboard")
  return row
}

export async function deleteCompanyGroup(id: string) {
  await requireAdmin()
  await prisma.companyGroup.delete({ where: { id } })
  revalidatePath("/master/company-groups")
  revalidatePath("/dashboard")
}

export async function setGroupMembers(groupId: string, companyIds: string[]) {
  await requireAdmin()

  await prisma.$transaction(async (tx) => {
    await tx.companyGroupMember.deleteMany({ where: { groupId } })
    for (let i = 0; i < companyIds.length; i++) {
      await tx.companyGroupMember.create({
        data: {
          groupId,
          companyId: companyIds[i],
          displayOrder: i,
        },
      })
    }
  })

  revalidatePath("/master/company-groups")
  revalidatePath("/dashboard")
}

// ============================================================
// ダッシュボードタイル用サマリ
// ============================================================

export async function getGroupDashboardSummary(params: {
  yearMonth: string // "YYYY-MM"
}) {
  await requireSession()
  if (!/^\d{4}-\d{2}$/.test(params.yearMonth)) {
    throw new Error("月の形式が不正です")
  }

  const [groups, allCompanies] = await Promise.all([
    prisma.companyGroup.findMany({
      where: { isActive: true },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
      include: { members: true },
    }),
    prisma.company.findMany({
      where: { status: { not: "LIQUIDATING" } },
      select: { id: true, name: true, shortName: true },
      orderBy: { displayOrder: "asc" },
    }),
  ])

  // 月次残高合計を会社ごとに集計
  const balances = await prisma.monthlyBalance.groupBy({
    by: ["companyId"],
    where: { yearMonth: params.yearMonth },
    _sum: { closingBalance: true },
  })
  const balanceMap = new Map(
    balances.map((b) => [b.companyId, b._sum.closingBalance ?? BigInt(0)])
  )

  // 当月入出金合計
  const txAgg = await prisma.transaction.groupBy({
    by: ["companyId", "type"],
    where: {
      accountingMonth: params.yearMonth,
      status: { not: "CANCELLED" },
    },
    _sum: { amount: true },
  })
  type Totals = { income: bigint; expense: bigint }
  const totalsMap = new Map<string, Totals>()
  const ZERO = BigInt(0)
  for (const row of txAgg) {
    const t = totalsMap.get(row.companyId) ?? { income: ZERO, expense: ZERO }
    const sum = row._sum.amount ?? ZERO
    if (sum > ZERO) t.income += sum
    else t.expense += sum
    totalsMap.set(row.companyId, t)
  }

  const companyMap = new Map(allCompanies.map((c) => [c.id, c]))

  const groupTiles = groups.map((g) => {
    const companies = g.members
      .map((m) => companyMap.get(m.companyId))
      .filter((c): c is NonNullable<ReturnType<typeof companyMap.get>> => !!c)
    let balance = ZERO
    let income = ZERO
    let expense = ZERO
    for (const c of companies) {
      balance += balanceMap.get(c.id) ?? ZERO
      const t = totalsMap.get(c.id)
      if (t) {
        income += t.income
        expense += t.expense
      }
    }
    return {
      id: g.id,
      name: g.name,
      shortName: g.shortName,
      colorCode: g.colorCode,
      companyCount: companies.length,
      companyIds: companies.map((c) => c.id),
      companyNames: companies.map((c) => c.shortName ?? c.name),
      balance: balance.toString(),
      income: income.toString(),
      expense: expense.toString(),
    }
  })

  // 全社合計タイル（PDF P1: ダッシュボードの最上位タイル）
  let totalBalance = ZERO
  let totalIncome = ZERO
  let totalExpense = ZERO
  for (const [, bal] of balanceMap) totalBalance += bal
  for (const [, t] of totalsMap) {
    totalIncome += t.income
    totalExpense += t.expense
  }

  return {
    yearMonth: params.yearMonth,
    allCompaniesTile: {
      companyCount: allCompanies.length,
      balance: totalBalance.toString(),
      income: totalIncome.toString(),
      expense: totalExpense.toString(),
    },
    groupTiles,
  }
}
