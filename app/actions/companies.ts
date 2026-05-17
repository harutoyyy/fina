"use server"

import { prisma } from "@/lib/prisma"
import { requireSession } from "@/lib/auth-server"
import { revalidatePath } from "next/cache"

export async function getCompanies() {
  await requireSession()
  return prisma.company.findMany({
    orderBy: { displayOrder: "asc" },
    include: {
      industryMaster: { select: { id: true, name: true } },
      _count: {
        select: {
          accounts: true,
          tradingPartners: true,
          transactions: true,
        },
      },
    },
  })
}

export async function getCompany(id: string) {
  await requireSession()
  return prisma.company.findUnique({
    where: { id },
    include: {
      industryMaster: { select: { id: true, name: true } },
      accounts: {
        orderBy: { displayOrder: "asc" },
      },
    },
  })
}

export async function updateCompany(id: string, data: {
  name?: string
  nameKana?: string
  shortName?: string
  industryType?: string
  industryMasterId?: string | null
  representativeTitle?: string
  representativeName?: string
  postalCode?: string
  addressPrefecture?: string
  addressCity?: string
  addressStreet?: string
  addressBuilding?: string
  phone?: string
  fax?: string
  email?: string
  website?: string
  corporateNumber?: string
  invoiceNumber?: string
  eTaxNumber?: string
  capitalAmount?: string | number | null
  accountingManager?: string
  fiscalMonth?: number
  establishedDate?: string
  status?: string
  notes?: string
}) {
  await requireSession()
  const { establishedDate, industryMasterId, capitalAmount, ...rest } = data
  const capitalBigInt =
    capitalAmount === undefined
      ? undefined
      : capitalAmount === null || capitalAmount === ""
      ? null
      : BigInt(String(capitalAmount).replace(/[^\d-]/g, "") || "0")
  const result = await prisma.company.update({
    where: { id },
    data: {
      ...rest,
      ...(industryMasterId !== undefined ? { industryMasterId } : {}),
      ...(capitalBigInt !== undefined ? { capitalAmount: capitalBigInt } : {}),
      establishedDate: establishedDate ? new Date(establishedDate) : undefined,
    },
  })
  revalidatePath("/master/companies")
  return result
}

/**
 * 資金繰表ページ用: 会社情報一覧パネルに表示する基本情報
 * PDF P1 「会社情報一覧」ピンク枠
 */
export async function getCompanyInfoSummary(companyId: string) {
  await requireSession()
  const c = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      id: true,
      name: true,
      shortName: true,
      corporateNumber: true,
      invoiceNumber: true,
      eTaxNumber: true,
      establishedDate: true,
      capitalAmount: true,
      accountingManager: true,
      representativeTitle: true,
      representativeName: true,
      fiscalMonth: true,
      industryMaster: { select: { name: true } },
    },
  })
  if (!c) return null
  return {
    ...c,
    capitalAmount: c.capitalAmount?.toString() ?? null,
    establishedDate: c.establishedDate?.toISOString() ?? null,
    industryName: c.industryMaster?.name ?? null,
  }
}
