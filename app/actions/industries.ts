"use server"

import { prisma } from "@/lib/prisma"
import { requireSession } from "@/lib/auth-server"
import { revalidatePath } from "next/cache"
import { getCurrentUserProfile } from "@/app/actions/user-profile"

async function requireAdmin() {
  await requireSession()
  const profile = await getCurrentUserProfile()
  if (profile?.role !== "ADMIN") {
    throw new Error("業種マスタの編集は管理者のみ実行できます")
  }
}

export async function getIndustries() {
  await requireSession()
  return prisma.industryMaster.findMany({
    orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
  })
}

export async function createIndustry(data: {
  name: string
  code?: string
  displayOrder?: number
  notes?: string
}) {
  await requireAdmin()

  const name = data.name.trim()
  if (!name) throw new Error("業種名は必須です")

  const result = await prisma.industryMaster.create({
    data: {
      name,
      code: data.code?.trim() || null,
      displayOrder: data.displayOrder ?? 0,
      notes: data.notes?.trim() || null,
    },
  })

  revalidatePath("/master/industries")
  revalidatePath("/master/companies")
  return result
}

export async function updateIndustry(
  id: string,
  data: {
    name?: string
    code?: string | null
    displayOrder?: number
    isActive?: boolean
    notes?: string | null
  }
) {
  await requireAdmin()

  const existing = await prisma.industryMaster.findUnique({ where: { id } })
  if (!existing) throw new Error("業種マスタが見つかりません")

  const update: Record<string, unknown> = {}
  if (data.name !== undefined) {
    const n = data.name.trim()
    if (!n) throw new Error("業種名は必須です")
    update.name = n
  }
  if (data.code !== undefined) update.code = data.code?.trim() || null
  if (data.displayOrder !== undefined) update.displayOrder = data.displayOrder
  if (data.isActive !== undefined) update.isActive = data.isActive
  if (data.notes !== undefined) update.notes = data.notes?.trim() || null

  const result = await prisma.industryMaster.update({
    where: { id },
    data: update,
  })

  revalidatePath("/master/industries")
  revalidatePath("/master/companies")
  return result
}

export async function deleteIndustry(id: string) {
  await requireAdmin()

  const used = await prisma.company.count({ where: { industryMasterId: id } })
  if (used > 0) {
    throw new Error(`この業種は${used}社で使用されています。非有効化を使用してください`)
  }

  await prisma.industryMaster.delete({ where: { id } })
  revalidatePath("/master/industries")
  revalidatePath("/master/companies")
}
