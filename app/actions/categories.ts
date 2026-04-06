"use server"

import { prisma } from "@/lib/prisma"
import { requireSession } from "@/lib/auth-server"
import { revalidatePath } from "next/cache"
import { getCurrentUserProfile } from "@/app/actions/user-profile"

export async function getCategories() {
  await requireSession()
  return prisma.accountCategoryMajor.findMany({
    orderBy: { displayOrder: "asc" },
    include: {
      midCategories: {
        orderBy: { displayOrder: "asc" },
        include: {
          subCategories: {
            orderBy: { displayOrder: "asc" },
          },
        },
      },
    },
  })
}

export async function createMidCategory(data: {
  majorId: string
  name: string
}) {
  await requireSession()
  const profile = await getCurrentUserProfile()
  if (profile?.role !== "ADMIN") throw new Error("管理者のみ実行できます")
  const maxOrder = await prisma.accountCategoryMid.findFirst({
    where: { majorId: data.majorId },
    orderBy: { displayOrder: "desc" },
    select: { displayOrder: true },
  })
  const result = await prisma.accountCategoryMid.create({
    data: {
      ...data,
      displayOrder: (maxOrder?.displayOrder || 0) + 1,
    },
  })
  revalidatePath("/master/categories")
  return result
}

export async function updateMidCategory(id: string, data: {
  name?: string
  isActive?: boolean
}) {
  await requireSession()
  const profile = await getCurrentUserProfile()
  if (profile?.role !== "ADMIN") throw new Error("管理者のみ実行できます")
  const result = await prisma.accountCategoryMid.update({
    where: { id },
    data,
  })
  revalidatePath("/master/categories")
  return result
}

export async function createSubCategory(data: {
  midId: string
  name: string
}) {
  await requireSession()
  const profile = await getCurrentUserProfile()
  if (profile?.role !== "ADMIN") throw new Error("管理者のみ実行できます")
  const maxOrder = await prisma.accountCategorySub.findFirst({
    where: { midId: data.midId },
    orderBy: { displayOrder: "desc" },
    select: { displayOrder: true },
  })
  const result = await prisma.accountCategorySub.create({
    data: {
      ...data,
      displayOrder: (maxOrder?.displayOrder || 0) + 1,
    },
  })
  revalidatePath("/master/categories")
  return result
}

export async function updateSubCategory(id: string, data: {
  name?: string
  isActive?: boolean
}) {
  await requireSession()
  const profile = await getCurrentUserProfile()
  if (profile?.role !== "ADMIN") throw new Error("管理者のみ実行できます")
  const result = await prisma.accountCategorySub.update({
    where: { id },
    data,
  })
  revalidatePath("/master/categories")
  return result
}
