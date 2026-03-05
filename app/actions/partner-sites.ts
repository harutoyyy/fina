"use server"

import { prisma } from "@/lib/prisma"
import { requireSession } from "@/lib/auth-server"
import { revalidatePath } from "next/cache"
import { bigintToJson } from "@/lib/format"
import { createAuditLog } from "@/lib/audit-log"

async function verifyPartnerOwnership(partnerId: string, companyId: string) {
  const partner = await prisma.tradingPartner.findUnique({
    where: { id: partnerId },
  })
  if (!partner) throw new Error("Trading partner not found")
  if (partner.companyId !== companyId) throw new Error("Unauthorized: partner does not belong to this company")
  return partner
}

export async function getPartnerSites(partnerId: string, companyId: string) {
  await requireSession()
  await verifyPartnerOwnership(partnerId, companyId)
  const sites = await prisma.tradingPartnerSite.findMany({
    where: { partnerId },
    orderBy: { siteName: "asc" },
  })
  return bigintToJson(sites)
}

export async function createPartnerSite(data: {
  partnerId: string
  companyId: string
  siteName: string
  frequency?: string
  specificMonths?: number[]
  startMonth?: number
  dueDayRule?: string
  holidayAdjust?: string
  amountType?: string
  fixedAmount?: string
  assigneeId?: string
  midId?: string
  subId?: string
}) {
  const session = await requireSession()
  await verifyPartnerOwnership(data.partnerId, data.companyId)

  const result = await prisma.tradingPartnerSite.create({
    data: {
      partnerId: data.partnerId,
      siteName: data.siteName,
      frequency: data.frequency || undefined,
      specificMonths: data.specificMonths || [],
      startMonth: data.startMonth,
      dueDayRule: data.dueDayRule || undefined,
      holidayAdjust: data.holidayAdjust || "NONE",
      amountType: data.amountType || undefined,
      fixedAmount: data.fixedAmount ? BigInt(data.fixedAmount) : undefined,
      assigneeId: data.assigneeId || undefined,
      midId: data.midId || undefined,
      subId: data.subId || undefined,
    },
  })

  await createAuditLog({
    tableName: "trading_partner_sites",
    recordId: result.id,
    operation: "CREATE",
    userId: session.user.id,
    afterData: { ...data, fixedAmount: data.fixedAmount } as Record<string, unknown>,
  })

  revalidatePath("/master/partners")
  return bigintToJson(result)
}

export async function updatePartnerSite(
  id: string,
  companyId: string,
  data: {
    siteName?: string
    frequency?: string | null
    specificMonths?: number[]
    startMonth?: number | null
    dueDayRule?: string | null
    holidayAdjust?: string | null
    amountType?: string | null
    fixedAmount?: string | null
    assigneeId?: string | null
    midId?: string | null
    subId?: string | null
    isActive?: boolean
  }
) {
  const session = await requireSession()

  const existing = await prisma.tradingPartnerSite.findUnique({
    where: { id },
    include: { partner: true },
  })
  if (!existing) throw new Error("Site not found")
  if (existing.partner.companyId !== companyId) throw new Error("Unauthorized")

  const updateData: Record<string, unknown> = {}
  if (data.siteName !== undefined) updateData.siteName = data.siteName
  if (data.frequency !== undefined) updateData.frequency = data.frequency
  if (data.specificMonths !== undefined) updateData.specificMonths = data.specificMonths
  if (data.startMonth !== undefined) updateData.startMonth = data.startMonth
  if (data.dueDayRule !== undefined) updateData.dueDayRule = data.dueDayRule
  if (data.holidayAdjust !== undefined) updateData.holidayAdjust = data.holidayAdjust
  if (data.amountType !== undefined) updateData.amountType = data.amountType
  if (data.fixedAmount !== undefined) updateData.fixedAmount = data.fixedAmount ? BigInt(data.fixedAmount) : null
  if (data.assigneeId !== undefined) updateData.assigneeId = data.assigneeId
  if (data.midId !== undefined) updateData.midId = data.midId
  if (data.subId !== undefined) updateData.subId = data.subId
  if (data.isActive !== undefined) updateData.isActive = data.isActive

  const result = await prisma.tradingPartnerSite.update({
    where: { id },
    data: updateData,
  })

  await createAuditLog({
    tableName: "trading_partner_sites",
    recordId: id,
    operation: "UPDATE",
    userId: session.user.id,
    beforeData: bigintToJson(existing) as Record<string, unknown>,
    afterData: data as Record<string, unknown>,
  })

  revalidatePath("/master/partners")
  return bigintToJson(result)
}

export async function deletePartnerSite(id: string, companyId: string) {
  const session = await requireSession()

  const existing = await prisma.tradingPartnerSite.findUnique({
    where: { id },
    include: { partner: true },
  })
  if (!existing) throw new Error("Site not found")
  if (existing.partner.companyId !== companyId) throw new Error("Unauthorized")

  await createAuditLog({
    tableName: "trading_partner_sites",
    recordId: id,
    operation: "DELETE",
    userId: session.user.id,
    beforeData: bigintToJson(existing) as Record<string, unknown>,
  })

  await prisma.tradingPartnerSite.delete({ where: { id } })
  revalidatePath("/master/partners")
}
