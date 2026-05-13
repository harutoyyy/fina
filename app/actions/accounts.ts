"use server"

import { prisma } from "@/lib/prisma"
import { requireSession } from "@/lib/auth-server"
import { AccountType } from "@prisma/client"
import { revalidatePath } from "next/cache"

export async function getAccounts(companyId: string) {
  await requireSession()
  return prisma.account.findMany({
    where: { companyId },
    orderBy: { displayOrder: "asc" },
    include: {
      company: { select: { name: true, shortName: true } },
    },
  })
}

export async function createAccount(data: {
  companyId: string
  bankName?: string
  bankCode?: string
  branchName?: string
  branchCode?: string
  accountNumber?: string
  accountType: AccountType
  accountHolder?: string
  isMain?: boolean
}) {
  await requireSession()
  const maxOrder = await prisma.account.findFirst({
    where: { companyId: data.companyId },
    orderBy: { displayOrder: "desc" },
    select: { displayOrder: true },
  })

  const result = await prisma.account.create({
    data: {
      ...data,
      isMain: data.isMain || false,
      isVirtual: false,
      displayOrder: (maxOrder?.displayOrder || 0) + 1,
    },
  })
  revalidatePath("/master/accounts")
  return result
}

export async function updateAccount(id: string, data: {
  bankName?: string
  bankCode?: string
  branchName?: string
  branchCode?: string
  accountNumber?: string
  accountHolder?: string
  isMain?: boolean
  isActive?: boolean
  isVisible?: boolean
}) {
  await requireSession()
  const result = await prisma.account.update({
    where: { id },
    data,
  })
  revalidatePath("/master/accounts")
  return result
}

export async function toggleAccountActive(id: string) {
  await requireSession()
  const account = await prisma.account.findUnique({ where: { id } })
  if (!account) throw new Error("Account not found")
  const result = await prisma.account.update({
    where: { id },
    data: { isActive: !account.isActive },
  })
  revalidatePath("/master/accounts")
  return result
}
