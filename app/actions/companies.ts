"use server"

import { prisma } from "@/lib/prisma"
import { requireSession } from "@/lib/auth-server"
import { revalidatePath } from "next/cache"

export async function getCompanies() {
  await requireSession()
  return prisma.company.findMany({
    orderBy: { displayOrder: "asc" },
    include: {
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
  fiscalMonth?: number
  establishedDate?: string
  status?: string
  notes?: string
}) {
  await requireSession()
  const { establishedDate, ...rest } = data
  const result = await prisma.company.update({
    where: { id },
    data: {
      ...rest,
      establishedDate: establishedDate ? new Date(establishedDate) : undefined,
    },
  })
  revalidatePath("/master/companies")
  return result
}
