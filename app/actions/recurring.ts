"use server"

import { prisma } from "@/lib/prisma"
import { requireSession } from "@/lib/auth-server"
import { revalidatePath } from "next/cache"
import { bigintToJson } from "@/lib/format"
import { TransactionType, PaymentMethod } from "@prisma/client"

async function verifyCompanyAccess(companyId: string) {
  const company = await prisma.company.findUnique({ where: { id: companyId } })
  if (!company) {
    throw new Error("Company not found")
  }
  return company
}

export async function getRecurringTemplates(companyId: string) {
  await requireSession()
  await verifyCompanyAccess(companyId)

  const templates = await prisma.recurringTemplate.findMany({
    where: { companyId },
    orderBy: { createdAt: "desc" },
  })

  return bigintToJson(templates)
}

export async function createRecurringTemplate(data: {
  companyId: string
  name: string
  frequency: string
  specificMonths?: number[]
  startMonth?: number
  dueDayRule: string
  holidayAdjust?: string
  transactionType: TransactionType
  accountId?: string
  partnerId?: string
  midId?: string
  subId?: string
  amountType: string
  fixedAmount?: string
  paymentMethod?: PaymentMethod
  classification?: string
  summary?: string
  assigneeId?: string
}) {
  await requireSession()
  await verifyCompanyAccess(data.companyId)

  const result = await prisma.recurringTemplate.create({
    data: {
      companyId: data.companyId,
      name: data.name,
      frequency: data.frequency,
      specificMonths: data.specificMonths || [],
      startMonth: data.startMonth,
      dueDayRule: data.dueDayRule,
      holidayAdjust: data.holidayAdjust || "PREV_BUSINESS",
      transactionType: data.transactionType,
      accountId: data.accountId || null,
      partnerId: data.partnerId || null,
      midId: data.midId || null,
      subId: data.subId || null,
      amountType: data.amountType,
      fixedAmount: data.fixedAmount ? BigInt(data.fixedAmount) : null,
      paymentMethod: data.paymentMethod || null,
      classification: data.classification || null,
      summary: data.summary || null,
      assigneeId: data.assigneeId || null,
    },
  })

  revalidatePath("/recurring")
  return bigintToJson(result)
}

export async function updateRecurringTemplate(
  id: string,
  companyId: string,
  data: {
    name?: string
    frequency?: string
    specificMonths?: number[]
    startMonth?: number | null
    dueDayRule?: string
    holidayAdjust?: string
    transactionType?: TransactionType
    accountId?: string | null
    partnerId?: string | null
    midId?: string | null
    subId?: string | null
    amountType?: string
    fixedAmount?: string | null
    paymentMethod?: PaymentMethod | null
    classification?: string | null
    summary?: string | null
    assigneeId?: string | null
    isActive?: boolean
  }
) {
  await requireSession()
  await verifyCompanyAccess(companyId)

  const existing = await prisma.recurringTemplate.findUnique({ where: { id } })
  if (!existing || existing.companyId !== companyId) {
    throw new Error("Template not found")
  }

  const updateData: Record<string, unknown> = {}
  if (data.name !== undefined) updateData.name = data.name
  if (data.frequency !== undefined) updateData.frequency = data.frequency
  if (data.specificMonths !== undefined) updateData.specificMonths = data.specificMonths
  if (data.startMonth !== undefined) updateData.startMonth = data.startMonth
  if (data.dueDayRule !== undefined) updateData.dueDayRule = data.dueDayRule
  if (data.holidayAdjust !== undefined) updateData.holidayAdjust = data.holidayAdjust
  if (data.transactionType !== undefined) updateData.transactionType = data.transactionType
  if (data.accountId !== undefined) updateData.accountId = data.accountId
  if (data.partnerId !== undefined) updateData.partnerId = data.partnerId
  if (data.midId !== undefined) updateData.midId = data.midId
  if (data.subId !== undefined) updateData.subId = data.subId
  if (data.amountType !== undefined) updateData.amountType = data.amountType
  if (data.fixedAmount !== undefined) updateData.fixedAmount = data.fixedAmount ? BigInt(data.fixedAmount) : null
  if (data.paymentMethod !== undefined) updateData.paymentMethod = data.paymentMethod
  if (data.classification !== undefined) updateData.classification = data.classification
  if (data.summary !== undefined) updateData.summary = data.summary
  if (data.assigneeId !== undefined) updateData.assigneeId = data.assigneeId
  if (data.isActive !== undefined) updateData.isActive = data.isActive

  const result = await prisma.recurringTemplate.update({
    where: { id },
    data: updateData,
  })

  revalidatePath("/recurring")
  return bigintToJson(result)
}

export async function deleteRecurringTemplate(id: string, companyId: string) {
  await requireSession()
  await verifyCompanyAccess(companyId)

  const existing = await prisma.recurringTemplate.findUnique({ where: { id } })
  if (!existing || existing.companyId !== companyId) {
    throw new Error("Template not found")
  }

  await prisma.recurringTemplate.delete({ where: { id } })
  revalidatePath("/recurring")
}

function isTargetMonth(frequency: string, specificMonths: number[], month: number): boolean {
  switch (frequency) {
    case "MONTHLY":
      return true
    case "BIMONTHLY_ODD":
      return month % 2 === 1
    case "BIMONTHLY_EVEN":
      return month % 2 === 0
    case "QUARTERLY":
      return [1, 4, 7, 10].includes(month)
    case "YEARLY":
      return month === 1
    case "SPECIFIC_MONTHS":
      return specificMonths.includes(month)
    default:
      return false
  }
}

function getDueDate(yearMonth: string, dueDayRule: string): Date {
  const [yearStr, monthStr] = yearMonth.split("-")
  const year = parseInt(yearStr)
  const month = parseInt(monthStr)

  if (dueDayRule === "MONTH_END") {
    return new Date(year, month, 0)
  }

  const dayMatch = dueDayRule.match(/DAY_(\d+)/)
  if (dayMatch) {
    const day = parseInt(dayMatch[1])
    const lastDay = new Date(year, month, 0).getDate()
    return new Date(year, month - 1, Math.min(day, lastDay))
  }

  return new Date(year, month - 1, 1)
}

export async function generateRecurringTransactions(companyId: string, yearMonth: string) {
  await requireSession()
  await verifyCompanyAccess(companyId)

  const [yearStr, monthStr] = yearMonth.split("-")
  const month = parseInt(monthStr)

  const templates = await prisma.recurringTemplate.findMany({
    where: {
      companyId,
      isActive: true,
    },
  })

  const results: { templateId: string; templateName: string; transactionId: string }[] = []

  for (const template of templates) {
    if (!isTargetMonth(template.frequency, template.specificMonths, month)) {
      continue
    }

    if (template.lastGeneratedMonth && template.lastGeneratedMonth >= yearMonth) {
      continue
    }

    let amount = BigInt(0)
    if (template.amountType === "FIXED" && template.fixedAmount) {
      amount = template.fixedAmount
    } else if (template.amountType === "VARIABLE") {
      const prevMonth = getPreviousMonth(yearMonth)
      const prevTransaction = await prisma.transaction.findFirst({
        where: {
          companyId,
          accountingMonth: prevMonth,
          partnerId: template.partnerId,
          type: template.transactionType,
        },
        orderBy: { createdAt: "desc" },
      })
      if (prevTransaction) {
        amount = prevTransaction.amount
      }
    }

    const dueDate = getDueDate(yearMonth, template.dueDayRule)

    const transactionData: Record<string, unknown> = {
      companyId,
      type: template.transactionType,
      status: "DRAFT",
      accountingMonth: yearMonth,
      amount,
      scheduledDate: dueDate,
      summary: template.summary || template.name,
      classification: template.classification,
      paymentMethod: template.paymentMethod,
    }

    if (template.accountId) transactionData.accountId = template.accountId
    if (template.partnerId) transactionData.partnerId = template.partnerId

    if (!template.accountId) {
      const defaultAccount = await prisma.account.findFirst({
        where: { companyId, isMain: true, isActive: true },
      })
      if (defaultAccount) {
        transactionData.accountId = defaultAccount.id
      } else {
        const anyAccount = await prisma.account.findFirst({
          where: { companyId, isActive: true },
        })
        if (anyAccount) {
          transactionData.accountId = anyAccount.id
        } else {
          continue
        }
      }
    }

    const transaction = await prisma.transaction.create({
      data: transactionData as {
        companyId: string
        accountId: string
        type: TransactionType
        accountingMonth: string
        amount: bigint
        scheduledDate?: Date
        summary?: string
        classification?: string
        paymentMethod?: PaymentMethod
        partnerId?: string
      },
    })

    if (template.midId) {
      await prisma.transactionDetail.create({
        data: {
          transactionId: transaction.id,
          midId: template.midId,
          subId: template.subId || null,
          amount,
          summary: template.summary || template.name,
          displayOrder: 0,
        },
      })
    }

    await prisma.recurringTemplate.update({
      where: { id: template.id },
      data: { lastGeneratedMonth: yearMonth },
    })

    results.push({
      templateId: template.id,
      templateName: template.name,
      transactionId: transaction.id,
    })
  }

  revalidatePath("/recurring")
  revalidatePath("/expenses")
  revalidatePath("/sales")
  revalidatePath("/costs")
  return results
}

function getPreviousMonth(yearMonth: string): string {
  const [yearStr, monthStr] = yearMonth.split("-")
  let year = parseInt(yearStr)
  let month = parseInt(monthStr) - 1
  if (month === 0) {
    month = 12
    year -= 1
  }
  return `${year}-${String(month).padStart(2, "0")}`
}
