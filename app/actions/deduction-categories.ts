"use server"

import { prisma } from "@/lib/prisma"
import { requireSession } from "@/lib/auth-server"
import { revalidatePath } from "next/cache"
import { createAuditLog } from "@/lib/audit-log"

export type DeductionCategoryWithRelations = {
  id: string
  forType: string
  name: string
  midId: string
  subId: string | null
  hasSubTypes: boolean
  signRule: unknown
  isActive: boolean
  displayOrder: number
  createdAt: Date
  updatedAt: Date
}

export async function getDeductionCategories(forType: "SALES" | "COST") {
  await requireSession()
  return prisma.deductionCategory.findMany({
    where: { forType },
    orderBy: { displayOrder: "asc" },
  })
}

export async function createDeductionCategory(data: {
  forType: "SALES" | "COST"
  name: string
  midId: string
  subId?: string
  hasSubTypes?: boolean
  signRule?: { occurrence: number; offset: number }
  displayOrder?: number
}) {
  const session = await requireSession()

  const result = await prisma.deductionCategory.create({
    data: {
      forType: data.forType,
      name: data.name,
      midId: data.midId,
      subId: data.subId || undefined,
      hasSubTypes: data.hasSubTypes ?? false,
      signRule: data.signRule ?? undefined,
      displayOrder: data.displayOrder ?? 0,
    },
  })

  await createAuditLog({
    tableName: "deduction_categories_fina",
    recordId: result.id,
    operation: "CREATE",
    userId: session.user.id,
    afterData: data as unknown as Record<string, unknown>,
  })

  revalidatePath("/master/deduction-categories")
  return result
}

export async function updateDeductionCategory(
  id: string,
  data: {
    name?: string
    midId?: string
    subId?: string | null
    hasSubTypes?: boolean
    signRule?: { occurrence: number; offset: number } | null
    isActive?: boolean
    displayOrder?: number
  }
) {
  const session = await requireSession()

  const existing = await prisma.deductionCategory.findUnique({ where: { id } })
  if (!existing) throw new Error("Deduction category not found")

  const result = await prisma.deductionCategory.update({
    where: { id },
    data: {
      ...data,
      signRule: data.signRule === null ? undefined : data.signRule ?? undefined,
    },
  })

  await createAuditLog({
    tableName: "deduction_categories_fina",
    recordId: id,
    operation: "UPDATE",
    userId: session.user.id,
    beforeData: existing as unknown as Record<string, unknown>,
    afterData: data as unknown as Record<string, unknown>,
  })

  revalidatePath("/master/deduction-categories")
  return result
}

export async function deleteDeductionCategory(id: string) {
  const session = await requireSession()

  const existing = await prisma.deductionCategory.findUnique({ where: { id } })
  if (!existing) throw new Error("Deduction category not found")

  await createAuditLog({
    tableName: "deduction_categories_fina",
    recordId: id,
    operation: "DELETE",
    userId: session.user.id,
    beforeData: existing as unknown as Record<string, unknown>,
  })

  await prisma.deductionCategory.delete({ where: { id } })
  revalidatePath("/master/deduction-categories")
}
