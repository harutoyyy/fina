"use server"

import { prisma } from "@/lib/prisma"
import { requireSession } from "@/lib/auth-server"
import { revalidatePath } from "next/cache"
import { bigintToJson } from "@/lib/format"

export type TaxType =
  | "CORPORATE"      // 法人税
  | "CONSUMPTION"    // 消費税
  | "RESIDENT"       // 法人住民税
  | "BUSINESS"       // 事業税
  | "FIXED_ASSET"    // 固定資産税
  | "OTHER"

export const TAX_TYPE_LABELS: Record<TaxType, string> = {
  CORPORATE: "法人税",
  CONSUMPTION: "消費税",
  RESIDENT: "法人住民税",
  BUSINESS: "事業税",
  FIXED_ASSET: "固定資産税",
  OTHER: "その他",
}

// PDF P9: 中間納税の閾値
// 法人税: 前年確定税額 20万円超 → 中間1回（半期）
// 消費税:
//   48万円超〜400万円以下 → 中間1回（半期）
//   400万円超〜4800万円以下 → 中間3回（四半期）
//   4800万円超 → 中間11回（毎月）
type InterimRule = {
  count: number          // 中間納付回数（0=不要）
  label: string
  intervalMonths: number // 各納付の間隔
}

function getCorporateInterimRule(prevYearTax: bigint): InterimRule {
  if (prevYearTax > BigInt(200_000)) {
    return { count: 1, label: "中間（半期）", intervalMonths: 6 }
  }
  return { count: 0, label: "中間納付不要", intervalMonths: 0 }
}

function getConsumptionInterimRule(prevYearTax: bigint): InterimRule {
  if (prevYearTax > BigInt(48_000_000)) {
    return { count: 11, label: "中間（毎月）", intervalMonths: 1 }
  }
  if (prevYearTax > BigInt(4_000_000)) {
    return { count: 3, label: "中間（四半期）", intervalMonths: 3 }
  }
  if (prevYearTax > BigInt(480_000)) {
    return { count: 1, label: "中間（半期）", intervalMonths: 6 }
  }
  return { count: 0, label: "中間納付不要", intervalMonths: 0 }
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date.getFullYear(), date.getMonth() + months, 1)
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  d.setDate(Math.min(date.getDate(), lastDay))
  return d
}

export async function getTaxSchedules(params: {
  companyId: string
  fiscalYear?: number
  taxType?: TaxType
}) {
  await requireSession()
  const where: Record<string, unknown> = { companyId: params.companyId }
  if (params.fiscalYear) where.fiscalYear = params.fiscalYear
  if (params.taxType) where.taxType = params.taxType

  const rows = await prisma.taxPaymentSchedule.findMany({
    where,
    orderBy: [{ fiscalYear: "desc" }, { dueDate: "asc" }],
  })
  return bigintToJson(rows) as Array<{
    id: string
    companyId: string
    taxType: TaxType
    fiscalYear: number
    periodLabel: string
    dueDate: string
    scheduledAmount: string
    actualAmount: string | null
    basisAmount: string | null
    calculationMethod: string | null
    isPaid: boolean
    paidDate: string | null
    transactionId: string | null
    accountId: string | null
    notes: string | null
    createdAt: string
    updatedAt: string
  }>
}

export async function createTaxSchedule(data: {
  companyId: string
  taxType: TaxType
  fiscalYear: number
  periodLabel: string
  dueDate: string
  scheduledAmount: string
  basisAmount?: string
  calculationMethod?: string
  accountId?: string
  notes?: string
}) {
  await requireSession()
  if (!data.companyId) throw new Error("会社IDは必須です")
  if (!data.dueDate) throw new Error("納付期限は必須です")

  const row = await prisma.taxPaymentSchedule.create({
    data: {
      companyId: data.companyId,
      taxType: data.taxType,
      fiscalYear: data.fiscalYear,
      periodLabel: data.periodLabel,
      dueDate: new Date(data.dueDate),
      scheduledAmount: BigInt(data.scheduledAmount || "0"),
      basisAmount: data.basisAmount ? BigInt(data.basisAmount) : null,
      calculationMethod: data.calculationMethod ?? "MANUAL",
      accountId: data.accountId ?? null,
      notes: data.notes ?? null,
    },
  })
  revalidatePath("/tax-schedule")
  return bigintToJson(row)
}

export async function updateTaxSchedule(
  id: string,
  data: {
    periodLabel?: string
    dueDate?: string
    scheduledAmount?: string
    actualAmount?: string | null
    basisAmount?: string | null
    calculationMethod?: string
    isPaid?: boolean
    paidDate?: string | null
    accountId?: string | null
    notes?: string | null
  }
) {
  await requireSession()
  const update: Record<string, unknown> = {}
  if (data.periodLabel !== undefined) update.periodLabel = data.periodLabel
  if (data.dueDate !== undefined) update.dueDate = new Date(data.dueDate)
  if (data.scheduledAmount !== undefined) update.scheduledAmount = BigInt(data.scheduledAmount || "0")
  if (data.actualAmount !== undefined) {
    update.actualAmount = data.actualAmount === null ? null : BigInt(data.actualAmount)
  }
  if (data.basisAmount !== undefined) {
    update.basisAmount = data.basisAmount === null ? null : BigInt(data.basisAmount)
  }
  if (data.calculationMethod !== undefined) update.calculationMethod = data.calculationMethod
  if (data.isPaid !== undefined) update.isPaid = data.isPaid
  if (data.paidDate !== undefined) {
    update.paidDate = data.paidDate ? new Date(data.paidDate) : null
  }
  if (data.accountId !== undefined) update.accountId = data.accountId
  if (data.notes !== undefined) update.notes = data.notes

  const row = await prisma.taxPaymentSchedule.update({ where: { id }, data: update })
  revalidatePath("/tax-schedule")
  return bigintToJson(row)
}

export async function deleteTaxSchedule(id: string) {
  await requireSession()
  await prisma.taxPaymentSchedule.delete({ where: { id } })
  revalidatePath("/tax-schedule")
}

/**
 * 前年確定税額から中間納税スケジュールを自動生成。
 * 既存の同年度・同税目スケジュールは削除して再生成する（dryRun=trueでプレビューのみ）。
 *
 * 法人税: 前年確定額 > 20万円で中間1回（半期、+8ヶ月後納付）
 * 消費税: 前年確定額 > 48万円 / 400万円 / 4800万円 で 1回/3回/11回
 *
 * 仮定: 決算月 = company.fiscalMonth。確定申告期限は決算月+2ヶ月末日。
 */
export async function generateInterimTaxSchedules(params: {
  companyId: string
  fiscalYear: number       // 対象事業年度（決算月を含む年）
  taxType: "CORPORATE" | "CONSUMPTION"
  prevYearTaxAmount: string // 前年確定税額（円）
  dryRun?: boolean
}) {
  await requireSession()

  const company = await prisma.company.findUnique({
    where: { id: params.companyId },
    select: { id: true, fiscalMonth: true },
  })
  if (!company) throw new Error("会社が見つかりません")

  const fiscalMonth = company.fiscalMonth || 3
  const prevYearTax = BigInt(params.prevYearTaxAmount || "0")

  const rule =
    params.taxType === "CORPORATE"
      ? getCorporateInterimRule(prevYearTax)
      : getConsumptionInterimRule(prevYearTax)

  // 事業年度開始月 = 決算月 + 1
  const fyStartMonthZeroIdx = fiscalMonth % 12 // 0始まり
  const fyStartYear = fiscalMonth === 12 ? params.fiscalYear : params.fiscalYear - 1
  const fyStart = new Date(fyStartYear, fyStartMonthZeroIdx, 1)
  // 決算日（事業年度末日）
  const fyEnd = new Date(params.fiscalYear, fiscalMonth, 0)
  // 確定申告期限 = 決算月末 + 2ヶ月
  const finalDue = addMonths(new Date(fyEnd), 2)

  type Row = {
    periodLabel: string
    dueDate: Date
    scheduledAmount: bigint
    basisAmount: bigint
    calculationMethod: string
  }
  const rows: Row[] = []

  // 中間納税: 事業年度開始から「(i+1) × 期間 + 2ヶ月」が納付期限
  for (let i = 0; i < rule.count; i++) {
    const periodEnd = addMonths(fyStart, (i + 1) * rule.intervalMonths)
    const dueDate = addMonths(periodEnd, 2)
    // 各中間納付額 = 前年税額 / (rule.count + 1)
    const splitAmount = prevYearTax / BigInt(rule.count + 1)
    rows.push({
      periodLabel: rule.count === 1
        ? "中間"
        : `中間${i + 1}/${rule.count}`,
      dueDate,
      scheduledAmount: splitAmount,
      basisAmount: prevYearTax,
      calculationMethod:
        rule.intervalMonths === 1
          ? "INTERIM_MONTHLY"
          : rule.intervalMonths === 3
            ? "INTERIM_QUARTERLY"
            : "INTERIM_HALF",
    })
  }

  // 確定申告分（金額は未確定なので 0 でプレースホルダ）
  rows.push({
    periodLabel: "確定",
    dueDate: finalDue,
    scheduledAmount: BigInt(0),
    basisAmount: BigInt(0),
    calculationMethod: "FIXED_ANNUAL",
  })

  if (params.dryRun) {
    return {
      ruleLabel: rule.label,
      rows: rows.map((r) => ({
        ...r,
        dueDate: r.dueDate.toISOString(),
        scheduledAmount: r.scheduledAmount.toString(),
        basisAmount: r.basisAmount.toString(),
      })),
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.taxPaymentSchedule.deleteMany({
      where: {
        companyId: params.companyId,
        fiscalYear: params.fiscalYear,
        taxType: params.taxType,
        isPaid: false, // 未納分のみ再生成
      },
    })
    for (const r of rows) {
      await tx.taxPaymentSchedule.create({
        data: {
          companyId: params.companyId,
          taxType: params.taxType,
          fiscalYear: params.fiscalYear,
          periodLabel: r.periodLabel,
          dueDate: r.dueDate,
          scheduledAmount: r.scheduledAmount,
          basisAmount: r.basisAmount,
          calculationMethod: r.calculationMethod,
        },
      })
    }
  })

  revalidatePath("/tax-schedule")
  return {
    ruleLabel: rule.label,
    rows: rows.map((r) => ({
      ...r,
      dueDate: r.dueDate.toISOString(),
      scheduledAmount: r.scheduledAmount.toString(),
      basisAmount: r.basisAmount.toString(),
    })),
  }
}
