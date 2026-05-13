"use server"

import { prisma } from "@/lib/prisma"
import { requireSession } from "@/lib/auth-server"
import { TradingPartnerType } from "@prisma/client"
import { revalidatePath } from "next/cache"

export async function getPartners(companyId: string) {
  await requireSession()
  return prisma.tradingPartner.findMany({
    where: { companyId },
    orderBy: { name: "asc" },
    include: {
      bankAccounts: true,
      defaults: {
        include: {
          mid: true,
          sub: true,
        },
      },
    },
  })
}

export async function createPartner(data: {
  companyId: string
  name: string
  nameKana?: string
  type: TradingPartnerType
  tagKey: string
  notes?: string
}) {
  await requireSession()
  const result = await prisma.tradingPartner.create({ data })
  revalidatePath("/master/partners")
  return result
}

export async function updatePartner(id: string, data: {
  name?: string
  nameKana?: string
  type?: TradingPartnerType
  tagKey?: string
  isActive?: boolean
  notes?: string
}) {
  await requireSession()
  const result = await prisma.tradingPartner.update({
    where: { id },
    data,
  })
  revalidatePath("/master/partners")
  return result
}

export async function togglePartnerActive(id: string) {
  await requireSession()
  const partner = await prisma.tradingPartner.findUnique({ where: { id } })
  if (!partner) throw new Error("Partner not found")
  const result = await prisma.tradingPartner.update({
    where: { id },
    data: { isActive: !partner.isActive },
  })
  revalidatePath("/master/partners")
  return result
}
