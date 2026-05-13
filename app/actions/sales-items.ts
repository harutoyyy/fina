"use server"

import { prisma } from "@/lib/prisma"
import { requireSession } from "@/lib/auth-server"
import { revalidatePath } from "next/cache"
import { getCurrentUserProfile } from "@/app/actions/user-profile"

// ============================================================
// 売上項目メタマスタ（PDF P10）
// 例: 工事売上、地代収入、雑収入。対象会社チェック付き。
// ============================================================

async function requireAdmin() {
  await requireSession()
  const profile = await getCurrentUserProfile()
  if (profile?.role !== "ADMIN") {
    throw new Error("売上項目マスタの編集は管理者のみ実行できます")
  }
}

function parseApplicable(s?: string | null): string[] {
  if (!s) return []
  return s.split(",").map((x) => x.trim()).filter(Boolean)
}

function joinApplicable(ids: string[]): string | null {
  const cleaned = Array.from(new Set(ids.filter(Boolean)))
  return cleaned.length ? cleaned.join(",") : null
}

export async function getSalesItems() {
  await requireSession()
  const items = await prisma.salesItemMaster.findMany({
    orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
  })
  return items.map((i) => ({
    ...i,
    applicableCompanyIdList: parseApplicable(i.applicableCompanyIds),
  }))
}

export async function getSalesItemsForCompany(companyId: string) {
  await requireSession()
  const items = await prisma.salesItemMaster.findMany({
    where: { isActive: true },
    orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
  })
  return items.filter((i) => {
    const ids = parseApplicable(i.applicableCompanyIds)
    return ids.length === 0 || ids.includes(companyId)
  })
}

export async function createSalesItem(data: {
  name: string
  shortName?: string
  description?: string
  applicableCompanyIds?: string[]
  defaultClassification?: string
  displayOrder?: number
}) {
  await requireAdmin()
  const name = data.name.trim()
  if (!name) throw new Error("項目名は必須です")
  const row = await prisma.salesItemMaster.create({
    data: {
      name,
      shortName: data.shortName?.trim() || null,
      description: data.description?.trim() || null,
      applicableCompanyIds: joinApplicable(data.applicableCompanyIds ?? []),
      defaultClassification: data.defaultClassification || null,
      displayOrder: data.displayOrder ?? 0,
    },
  })
  revalidatePath("/master/sales-items")
  revalidatePath("/sales")
  return row
}

export async function updateSalesItem(
  id: string,
  data: {
    name?: string
    shortName?: string | null
    description?: string | null
    applicableCompanyIds?: string[]
    defaultClassification?: string | null
    displayOrder?: number
    isActive?: boolean
  }
) {
  await requireAdmin()
  const update: Record<string, unknown> = {}
  if (data.name !== undefined) {
    const n = data.name.trim()
    if (!n) throw new Error("項目名は必須です")
    update.name = n
  }
  if (data.shortName !== undefined) update.shortName = data.shortName?.trim() || null
  if (data.description !== undefined) update.description = data.description?.trim() || null
  if (data.applicableCompanyIds !== undefined) {
    update.applicableCompanyIds = joinApplicable(data.applicableCompanyIds)
  }
  if (data.defaultClassification !== undefined) {
    update.defaultClassification = data.defaultClassification || null
  }
  if (data.displayOrder !== undefined) update.displayOrder = data.displayOrder
  if (data.isActive !== undefined) update.isActive = data.isActive
  const row = await prisma.salesItemMaster.update({ where: { id }, data: update })
  revalidatePath("/master/sales-items")
  revalidatePath("/sales")
  return row
}

export async function deleteSalesItem(id: string) {
  await requireAdmin()
  await prisma.salesItemMaster.delete({ where: { id } })
  revalidatePath("/master/sales-items")
  revalidatePath("/sales")
}
