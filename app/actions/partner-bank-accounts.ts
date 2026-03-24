"use server"

import { prisma } from "@/lib/prisma"
import { requireSession } from "@/lib/auth-server"
import { revalidatePath } from "next/cache"
import { createAuditLog } from "@/lib/audit-log"

async function verifyPartnerOwnership(partnerId: string, companyId: string) {
  const partner = await prisma.tradingPartner.findUnique({
    where: { id: partnerId },
  })
  if (!partner) throw new Error("Trading partner not found")
  if (partner.companyId !== companyId) throw new Error("Unauthorized: partner does not belong to this company")
  return partner
}

export async function getPartnerBankAccounts(partnerId: string, companyId: string) {
  await requireSession()
  await verifyPartnerOwnership(partnerId, companyId)
  return prisma.tradingPartnerBankAccount.findMany({
    where: { partnerId },
    orderBy: { createdAt: "asc" },
  })
}

export async function createPartnerBankAccount(data: {
  partnerId: string
  companyId: string
  bankCode: string
  branchCode: string
  accountType: string
  accountNumber: string
  accountHolder: string
}) {
  const session = await requireSession()
  await verifyPartnerOwnership(data.partnerId, data.companyId)

  const { companyId, ...createData } = data
  const result = await prisma.tradingPartnerBankAccount.create({ data: createData })

  await createAuditLog({
    tableName: "trading_partner_bank_accounts_fina",
    recordId: result.id,
    operation: "CREATE",
    userId: session.user.id,
    afterData: data as Record<string, unknown>,
  })

  revalidatePath("/master/partners")
  return result
}

export async function updatePartnerBankAccount(
  id: string,
  companyId: string,
  data: {
    bankCode?: string
    branchCode?: string
    accountType?: string
    accountNumber?: string
    accountHolder?: string
    isActive?: boolean
  }
) {
  const session = await requireSession()

  const existing = await prisma.tradingPartnerBankAccount.findUnique({
    where: { id },
    include: { partner: true },
  })
  if (!existing) throw new Error("Bank account not found")
  if (existing.partner.companyId !== companyId) throw new Error("Unauthorized")

  const result = await prisma.tradingPartnerBankAccount.update({
    where: { id },
    data,
  })

  await createAuditLog({
    tableName: "trading_partner_bank_accounts_fina",
    recordId: id,
    operation: "UPDATE",
    userId: session.user.id,
    beforeData: existing as unknown as Record<string, unknown>,
    afterData: data as Record<string, unknown>,
  })

  revalidatePath("/master/partners")
  return result
}

export async function deletePartnerBankAccount(id: string, companyId: string) {
  const session = await requireSession()

  const existing = await prisma.tradingPartnerBankAccount.findUnique({
    where: { id },
    include: { partner: true },
  })
  if (!existing) throw new Error("Bank account not found")
  if (existing.partner.companyId !== companyId) throw new Error("Unauthorized")

  await createAuditLog({
    tableName: "trading_partner_bank_accounts_fina",
    recordId: id,
    operation: "DELETE",
    userId: session.user.id,
    beforeData: existing as unknown as Record<string, unknown>,
  })

  await prisma.tradingPartnerBankAccount.delete({ where: { id } })
  revalidatePath("/master/partners")
}
