"use server"

import { prisma } from "@/lib/prisma"
import { requireSession } from "@/lib/auth-server"
import { revalidatePath } from "next/cache"

export type SalaryImportRow = {
  payrollGroupName: string
  payMonth: string
  payDate: string
  headcount: number
  taxablePayment: number
  transportAllowance: number
  miscExpenses: number
  carryoverAdjust: number
  advanceExpenses: number
}

export type SalaryImportResult = {
  total: number
  created: number
  updated: number
  errors: string[]
}

export async function importSalaryEntries(
  companyId: string,
  rows: SalaryImportRow[]
): Promise<SalaryImportResult> {
  await requireSession()

  const groups = await prisma.payrollGroup.findMany({
    where: { companyId },
    select: { id: true, name: true },
  })
  const groupMap = new Map(groups.map((g) => [g.name, g.id]))

  const result: SalaryImportResult = {
    total: rows.length,
    created: 0,
    updated: 0,
    errors: [],
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const lineNum = i + 2

    const groupId = groupMap.get(row.payrollGroupName)
    if (!groupId) {
      result.errors.push(`行${lineNum}: 給与グループ「${row.payrollGroupName}」が見つかりません`)
      continue
    }

    if (!row.payMonth || !/^\d{4}-\d{2}$/.test(row.payMonth)) {
      result.errors.push(`行${lineNum}: 支給月の形式が不正です（YYYY-MM）`)
      continue
    }

    if (!row.payDate || isNaN(new Date(row.payDate).getTime())) {
      result.errors.push(`行${lineNum}: 支給日の形式が不正です（YYYY-MM-DD）`)
      continue
    }

    const totalPayment =
      row.taxablePayment +
      row.transportAllowance +
      row.miscExpenses +
      row.carryoverAdjust +
      row.advanceExpenses

    const socialInsuranceReserve = Math.round(row.taxablePayment * 0.15)
    const consumptionTaxReserve = Math.round(row.taxablePayment * 0.10)

    const existing = await prisma.salaryEntry.findFirst({
      where: { payrollGroupId: groupId, payMonth: row.payMonth },
    })

    try {
      if (existing) {
        if (existing.status !== "DRAFT") {
          result.errors.push(`行${lineNum}: ${row.payrollGroupName}/${row.payMonth} は確定済みのため更新できません`)
          continue
        }
        await prisma.salaryEntry.update({
          where: { id: existing.id },
          data: {
            payDate: new Date(row.payDate),
            headcount: row.headcount,
            taxablePayment: BigInt(row.taxablePayment),
            transportAllowance: BigInt(row.transportAllowance),
            miscExpenses: BigInt(row.miscExpenses),
            carryoverAdjust: BigInt(row.carryoverAdjust),
            advanceExpenses: BigInt(row.advanceExpenses),
            totalPayment: BigInt(totalPayment),
            socialInsuranceReserve: BigInt(socialInsuranceReserve),
            consumptionTaxReserve: BigInt(consumptionTaxReserve),
            netPayment: BigInt(totalPayment - Number(existing.totalDeduction)),
          },
        })
        result.updated++
      } else {
        await prisma.salaryEntry.create({
          data: {
            payrollGroupId: groupId,
            payMonth: row.payMonth,
            payDate: new Date(row.payDate),
            headcount: row.headcount,
            taxablePayment: BigInt(row.taxablePayment),
            transportAllowance: BigInt(row.transportAllowance),
            miscExpenses: BigInt(row.miscExpenses),
            carryoverAdjust: BigInt(row.carryoverAdjust),
            advanceExpenses: BigInt(row.advanceExpenses),
            totalPayment: BigInt(totalPayment),
            socialInsuranceReserve: BigInt(socialInsuranceReserve),
            consumptionTaxReserve: BigInt(consumptionTaxReserve),
            totalDeduction: BigInt(0),
            netPayment: BigInt(totalPayment),
            status: "DRAFT",
          },
        })
        result.created++
      }
    } catch (e: unknown) {
      result.errors.push(`行${lineNum}: ${e instanceof Error ? e.message : "保存エラー"}`)
    }
  }

  revalidatePath("/salary")
  return result
}

export async function getPayrollGroupNames(companyId: string) {
  await requireSession()
  const groups = await prisma.payrollGroup.findMany({
    where: { companyId },
    select: { name: true },
    orderBy: { name: "asc" },
  })
  return groups.map((g) => g.name)
}
