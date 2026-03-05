"use server"

import { prisma } from "@/lib/prisma"
import { requireSession } from "@/lib/auth-server"
import { TransactionStatus, PaymentMethod } from "@prisma/client"
import { revalidatePath } from "next/cache"
import { bigintToJson } from "@/lib/format"

export async function getPayrollGroups(companyId: string) {
  await requireSession()
  const groups = await prisma.payrollGroup.findMany({
    where: { companyId },
    orderBy: { displayOrder: "asc" },
  })
  return bigintToJson(groups)
}

export async function createPayrollGroup(data: {
  companyId: string
  name: string
  costType: string
  midId?: string
  payDay?: number
  payDayIsMonthEnd?: boolean
  holidayAdjust?: string
  defaultAccountId?: string
  defaultCashAccountId?: string
  deductionPresets?: unknown
  headcount?: number
}) {
  await requireSession()

  const maxOrder = await prisma.payrollGroup.findFirst({
    where: { companyId: data.companyId },
    orderBy: { displayOrder: "desc" },
    select: { displayOrder: true },
  })

  const result = await prisma.payrollGroup.create({
    data: {
      companyId: data.companyId,
      name: data.name,
      costType: data.costType,
      midId: data.midId || undefined,
      payDay: data.payDay || undefined,
      payDayIsMonthEnd: data.payDayIsMonthEnd || false,
      holidayAdjust: data.holidayAdjust || undefined,
      defaultAccountId: data.defaultAccountId || undefined,
      defaultCashAccountId: data.defaultCashAccountId || undefined,
      deductionPresets: data.deductionPresets || undefined,
      headcount: data.headcount || 0,
      displayOrder: (maxOrder?.displayOrder || 0) + 1,
    },
  })

  revalidatePath("/master/payroll-groups")
  revalidatePath("/salary")
  return bigintToJson(result)
}

export async function updatePayrollGroup(
  id: string,
  companyId: string,
  data: {
    name?: string
    costType?: string
    midId?: string | null
    payDay?: number | null
    payDayIsMonthEnd?: boolean
    holidayAdjust?: string | null
    defaultAccountId?: string | null
    defaultCashAccountId?: string | null
    deductionPresets?: unknown
    headcount?: number
    isActive?: boolean
  }
) {
  await requireSession()

  const existing = await prisma.payrollGroup.findUnique({ where: { id } })
  if (!existing || existing.companyId !== companyId) {
    throw new Error("PayrollGroup not found")
  }

  const updateData: Record<string, unknown> = {}
  if (data.name !== undefined) updateData.name = data.name
  if (data.costType !== undefined) updateData.costType = data.costType
  if (data.midId !== undefined) updateData.midId = data.midId
  if (data.payDay !== undefined) updateData.payDay = data.payDay
  if (data.payDayIsMonthEnd !== undefined) updateData.payDayIsMonthEnd = data.payDayIsMonthEnd
  if (data.holidayAdjust !== undefined) updateData.holidayAdjust = data.holidayAdjust
  if (data.defaultAccountId !== undefined) updateData.defaultAccountId = data.defaultAccountId
  if (data.defaultCashAccountId !== undefined) updateData.defaultCashAccountId = data.defaultCashAccountId
  if (data.deductionPresets !== undefined) updateData.deductionPresets = data.deductionPresets
  if (data.headcount !== undefined) updateData.headcount = data.headcount
  if (data.isActive !== undefined) updateData.isActive = data.isActive

  const result = await prisma.payrollGroup.update({
    where: { id },
    data: updateData,
  })

  revalidatePath("/master/payroll-groups")
  revalidatePath("/salary")
  return bigintToJson(result)
}

export async function deletePayrollGroup(id: string, companyId: string) {
  await requireSession()

  const existing = await prisma.payrollGroup.findUnique({ where: { id } })
  if (!existing || existing.companyId !== companyId) {
    throw new Error("PayrollGroup not found")
  }

  await prisma.payrollGroup.delete({ where: { id } })
  revalidatePath("/master/payroll-groups")
  revalidatePath("/salary")
}

const salaryEntryInclude = {
  payrollGroup: {
    select: { id: true, name: true, costType: true, companyId: true },
  },
  deductions: {
    orderBy: { displayOrder: "asc" as const },
  },
  paymentDetails: {
    orderBy: { displayOrder: "asc" as const },
  },
}

export async function getSalaryEntries(
  companyId: string,
  payMonth?: string
) {
  await requireSession()

  const where: Record<string, unknown> = {
    payrollGroup: { companyId },
  }
  if (payMonth) where.payMonth = payMonth

  const entries = await prisma.salaryEntry.findMany({
    where,
    orderBy: [{ payMonth: "desc" }, { createdAt: "desc" }],
    include: salaryEntryInclude,
  })

  return bigintToJson(entries)
}

export async function createSalaryEntry(data: {
  payrollGroupId: string
  companyId: string
  payMonth: string
  payDate?: string
  taxablePayment?: string
  transportAllowance?: string
  miscExpenses?: string
  carryoverAdjust?: string
  advanceExpenses?: string
  headcount?: number
}) {
  await requireSession()

  const group = await prisma.payrollGroup.findUnique({
    where: { id: data.payrollGroupId },
  })
  if (!group || group.companyId !== data.companyId) {
    throw new Error("PayrollGroup not found")
  }

  const taxablePayment = BigInt(data.taxablePayment || "0")
  const transportAllowance = BigInt(data.transportAllowance || "0")
  const miscExpenses = BigInt(data.miscExpenses || "0")
  const carryoverAdjust = BigInt(data.carryoverAdjust || "0")
  const advanceExpenses = BigInt(data.advanceExpenses || "0")

  const totalPayment = taxablePayment + transportAllowance + miscExpenses + carryoverAdjust + advanceExpenses
  const socialInsuranceReserve = (taxablePayment * BigInt(15)) / BigInt(100)
  const consumptionTaxReserve = (taxablePayment * BigInt(10)) / BigInt(100)
  const netPayment = totalPayment

  const result = await prisma.salaryEntry.create({
    data: {
      payrollGroupId: data.payrollGroupId,
      payMonth: data.payMonth,
      payDate: data.payDate ? new Date(data.payDate) : undefined,
      taxablePayment,
      transportAllowance,
      miscExpenses,
      carryoverAdjust,
      advanceExpenses,
      totalPayment,
      socialInsuranceReserve,
      consumptionTaxReserve,
      totalDeduction: BigInt(0),
      netPayment,
      headcount: data.headcount || group.headcount || 0,
    },
    include: salaryEntryInclude,
  })

  revalidatePath("/salary")
  return bigintToJson(result)
}

export async function updateSalaryEntry(
  id: string,
  companyId: string,
  data: {
    payDate?: string | null
    taxablePayment?: string
    transportAllowance?: string
    miscExpenses?: string
    carryoverAdjust?: string
    advanceExpenses?: string
    headcount?: number
  }
) {
  await requireSession()

  const existing = await prisma.salaryEntry.findUnique({
    where: { id },
    include: { payrollGroup: { select: { companyId: true } }, deductions: true },
  })
  if (!existing || existing.payrollGroup.companyId !== companyId) {
    throw new Error("SalaryEntry not found")
  }
  if (existing.status !== "DRAFT") {
    throw new Error("Only DRAFT entries can be edited")
  }

  const taxablePayment = data.taxablePayment !== undefined ? BigInt(data.taxablePayment) : existing.taxablePayment
  const transportAllowance = data.transportAllowance !== undefined ? BigInt(data.transportAllowance) : existing.transportAllowance
  const miscExpenses = data.miscExpenses !== undefined ? BigInt(data.miscExpenses) : existing.miscExpenses
  const carryoverAdjust = data.carryoverAdjust !== undefined ? BigInt(data.carryoverAdjust) : existing.carryoverAdjust
  const advanceExpenses = data.advanceExpenses !== undefined ? BigInt(data.advanceExpenses) : existing.advanceExpenses

  const totalPayment = taxablePayment + transportAllowance + miscExpenses + carryoverAdjust + advanceExpenses
  const socialInsuranceReserve = (taxablePayment * BigInt(15)) / BigInt(100)
  const consumptionTaxReserve = (taxablePayment * BigInt(10)) / BigInt(100)
  const totalDeduction = existing.deductions.reduce((sum, d) => sum + d.amount, BigInt(0))
  const netPayment = totalPayment - totalDeduction

  const updateData: Record<string, unknown> = {
    taxablePayment,
    transportAllowance,
    miscExpenses,
    carryoverAdjust,
    advanceExpenses,
    totalPayment,
    socialInsuranceReserve,
    consumptionTaxReserve,
    totalDeduction,
    netPayment,
  }

  if (data.payDate !== undefined) {
    updateData.payDate = data.payDate ? new Date(data.payDate) : null
  }
  if (data.headcount !== undefined) {
    updateData.headcount = data.headcount
  }

  const result = await prisma.salaryEntry.update({
    where: { id },
    data: updateData,
    include: salaryEntryInclude,
  })

  revalidatePath("/salary")
  return bigintToJson(result)
}

export async function deleteSalaryEntry(id: string, companyId: string) {
  await requireSession()

  const existing = await prisma.salaryEntry.findUnique({
    where: { id },
    include: { payrollGroup: { select: { companyId: true } } },
  })
  if (!existing || existing.payrollGroup.companyId !== companyId) {
    throw new Error("SalaryEntry not found")
  }
  if (existing.status !== "DRAFT") {
    throw new Error("Only DRAFT entries can be deleted")
  }

  await prisma.salaryEntry.delete({ where: { id } })
  revalidatePath("/salary")
}

export async function upsertSalaryDeductions(
  salaryEntryId: string,
  companyId: string,
  deductions: {
    id?: string
    itemName: string
    amount: string
    midId?: string
    subId?: string
    contentRows?: unknown
  }[]
) {
  await requireSession()

  const entry = await prisma.salaryEntry.findUnique({
    where: { id: salaryEntryId },
    include: { payrollGroup: { select: { companyId: true } } },
  })
  if (!entry || entry.payrollGroup.companyId !== companyId) {
    throw new Error("SalaryEntry not found")
  }

  await prisma.salaryDeduction.deleteMany({ where: { salaryEntryId } })

  if (deductions.length > 0) {
    await prisma.salaryDeduction.createMany({
      data: deductions.map((d, i) => ({
        salaryEntryId,
        itemName: d.itemName,
        amount: BigInt(d.amount),
        midId: d.midId || null,
        subId: d.subId || null,
        contentRows: d.contentRows || undefined,
        displayOrder: i,
      })),
    })
  }

  const totalDeduction = deductions.reduce((sum, d) => sum + BigInt(d.amount), BigInt(0))
  const netPayment = entry.totalPayment - totalDeduction

  await prisma.salaryEntry.update({
    where: { id: salaryEntryId },
    data: { totalDeduction, netPayment },
  })

  revalidatePath("/salary")
}

export async function upsertPaymentDetails(
  salaryEntryId: string,
  companyId: string,
  details: {
    id?: string
    paymentDate: string
    paymentMethod: PaymentMethod
    accountId?: string
    amount: string
  }[]
) {
  await requireSession()

  const entry = await prisma.salaryEntry.findUnique({
    where: { id: salaryEntryId },
    include: { payrollGroup: { select: { companyId: true } } },
  })
  if (!entry || entry.payrollGroup.companyId !== companyId) {
    throw new Error("SalaryEntry not found")
  }

  const accountIds = details.map(d => d.accountId).filter(Boolean) as string[]
  if (accountIds.length > 0) {
    const validAccounts = await prisma.account.findMany({
      where: { id: { in: accountIds }, companyId },
      select: { id: true },
    })
    const validIds = new Set(validAccounts.map(a => a.id))
    for (const aid of accountIds) {
      if (!validIds.has(aid)) {
        throw new Error("Invalid account for this company")
      }
    }
  }

  await prisma.salaryPaymentDetail.deleteMany({ where: { salaryEntryId } })

  if (details.length > 0) {
    await prisma.salaryPaymentDetail.createMany({
      data: details.map((d, i) => ({
        salaryEntryId,
        paymentDate: new Date(d.paymentDate),
        paymentMethod: d.paymentMethod,
        accountId: d.accountId || null,
        amount: BigInt(d.amount),
        displayOrder: i,
      })),
    })
  }

  revalidatePath("/salary")
}

const validTransitions: Record<string, string[]> = {
  DRAFT: ["READY"],
  READY: ["DRAFT", "CONFIRMED"],
  CONFIRMED: [],
}

export async function updateSalaryStatus(
  id: string,
  companyId: string,
  status: TransactionStatus
) {
  const session = await requireSession()

  const existing = await prisma.salaryEntry.findUnique({
    where: { id },
    include: {
      payrollGroup: { select: { companyId: true } },
      deductions: true,
      paymentDetails: true,
    },
  })
  if (!existing || existing.payrollGroup.companyId !== companyId) {
    throw new Error("SalaryEntry not found")
  }

  const allowed = validTransitions[existing.status] || []
  if (!allowed.includes(status)) {
    throw new Error(`Cannot change status from ${existing.status} to ${status}`)
  }

  if (status === "READY" || status === "CONFIRMED") {
    const paymentTotal = existing.paymentDetails.reduce(
      (sum, d) => sum + d.amount,
      BigInt(0)
    )
    if (existing.netPayment !== paymentTotal) {
      throw new Error(
        `Payment details total (${paymentTotal}) does not match net payment (${existing.netPayment})`
      )
    }
  }

  const updateData: Record<string, unknown> = { status }

  if (status === "CONFIRMED") {
    updateData.confirmedAt = new Date()
    updateData.confirmedBy = session.user.id
  }

  const result = await prisma.salaryEntry.update({
    where: { id },
    data: updateData,
    include: salaryEntryInclude,
  })

  revalidatePath("/salary")
  return bigintToJson(result)
}
