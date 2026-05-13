"use server"

import { prisma } from "@/lib/prisma"
import { requireSession } from "@/lib/auth-server"
import { revalidatePath } from "next/cache"

export type SalesImportRow = {
  scheduledDate: string  // YYYY-MM-DD 予定入金日
  transactionDate?: string // YYYY-MM-DD 実入金日
  partnerName: string   // 元請会社名（取引先）
  invoiceAmount: number // 請求金額
  actualAmount?: number // 実入金金額
  summary?: string
}

export type CostImportRow = {
  scheduledDate: string  // YYYY-MM-DD 予定支払日
  transactionDate?: string
  partnerName: string   // 支払先
  recordedAmount: number // 計上額（控除前）
  transferAmount?: number // 振込額（実支払）
  summary?: string
}

export type ImportResult = {
  total: number
  created: number
  skipped: number
  errors: string[]
  batchId: string | null
}

async function findOrCreatePartner(params: {
  companyId: string
  name: string
  type: "CUSTOMER" | "VENDOR"
}): Promise<string> {
  const existing = await prisma.tradingPartner.findFirst({
    where: { companyId: params.companyId, name: params.name.trim() },
    select: { id: true },
  })
  if (existing) return existing.id

  const created = await prisma.tradingPartner.create({
    data: {
      companyId: params.companyId,
      name: params.name.trim(),
      type: params.type,
      tagKey: params.type === "CUSTOMER" ? "CUSTOMER" : "SUBCONTRACTOR",
    },
    select: { id: true },
  })
  return created.id
}

/**
 * 売上取込（PDF P3 DX代替）。
 * accountingMonth = yearMonth、scheduledDate を予定入金日として SALES transaction を一括起票。
 */
export async function importSalesTransactions(params: {
  companyId: string
  accountId: string         // 入金予定口座
  yearMonth: string         // "YYYY-MM"（計上月）
  sourceName?: string
  rows: SalesImportRow[]
}): Promise<ImportResult> {
  await requireSession()
  if (!/^\d{4}-\d{2}$/.test(params.yearMonth)) {
    throw new Error("計上月の形式が不正です（YYYY-MM）")
  }

  const account = await prisma.account.findUnique({ where: { id: params.accountId } })
  if (!account || account.companyId !== params.companyId) {
    throw new Error("入金口座が見つかりません")
  }

  const batch = await prisma.importBatch.create({
    data: {
      companyId: params.companyId,
      batchType: "SALES",
      sourceName: params.sourceName ?? null,
      sourceFormat: "EXCEL",
      yearMonth: params.yearMonth,
      totalRows: params.rows.length,
      status: "DRAFT",
    },
  })

  const result: ImportResult = {
    total: params.rows.length,
    created: 0,
    skipped: 0,
    errors: [],
    batchId: batch.id,
  }

  for (let i = 0; i < params.rows.length; i++) {
    const row = params.rows[i]
    const line = i + 2
    try {
      if (!row.scheduledDate || isNaN(new Date(row.scheduledDate).getTime())) {
        result.errors.push(`行${line}: 予定入金日の形式が不正です`)
        continue
      }
      if (!row.partnerName?.trim()) {
        result.errors.push(`行${line}: 元請会社名が空です`)
        continue
      }
      if (!row.invoiceAmount && row.invoiceAmount !== 0) {
        result.errors.push(`行${line}: 請求金額が不正です`)
        continue
      }
      const partnerId = await findOrCreatePartner({
        companyId: params.companyId,
        name: row.partnerName,
        type: "CUSTOMER",
      })
      const amount = BigInt(Math.round(row.actualAmount ?? row.invoiceAmount))
      await prisma.transaction.create({
        data: {
          companyId: params.companyId,
          accountId: params.accountId,
          partnerId,
          type: "SALES",
          status: "DRAFT",
          scheduledDate: new Date(row.scheduledDate),
          transactionDate: row.transactionDate ? new Date(row.transactionDate) : null,
          accountingMonth: params.yearMonth,
          amount,
          estimatedAmount: BigInt(Math.round(row.invoiceAmount)),
          actualAmount: row.actualAmount ? BigInt(Math.round(row.actualAmount)) : null,
          invoiceAmount: BigInt(Math.round(row.invoiceAmount)),
          paymentMethod: "BANK_TRANSFER",
          summary: row.summary ?? null,
        },
      })
      result.created += 1
    } catch (e) {
      result.errors.push(`行${line}: ${e instanceof Error ? e.message : "不明なエラー"}`)
    }
  }

  await prisma.importBatch.update({
    where: { id: batch.id },
    data: {
      appliedRows: result.created,
      skippedRows: result.skipped,
      status: result.created > 0 ? "APPLIED" : "CANCELLED",
    },
  })

  revalidatePath("/sales")
  revalidatePath("/cashflow-table")
  return result
}

/**
 * 原価取込（PDF P3-5 DX代替）。
 * COST_PAYMENT transaction を一括起票。控除内訳は手動入力前提（取込時は recordedAmount のみ）。
 */
export async function importCostTransactions(params: {
  companyId: string
  accountId: string         // 支払口座
  yearMonth: string
  sourceName?: string
  rows: CostImportRow[]
}): Promise<ImportResult> {
  await requireSession()
  if (!/^\d{4}-\d{2}$/.test(params.yearMonth)) {
    throw new Error("計上月の形式が不正です（YYYY-MM）")
  }

  const account = await prisma.account.findUnique({ where: { id: params.accountId } })
  if (!account || account.companyId !== params.companyId) {
    throw new Error("支払口座が見つかりません")
  }

  const batch = await prisma.importBatch.create({
    data: {
      companyId: params.companyId,
      batchType: "COST",
      sourceName: params.sourceName ?? null,
      sourceFormat: "EXCEL",
      yearMonth: params.yearMonth,
      totalRows: params.rows.length,
      status: "DRAFT",
    },
  })

  const result: ImportResult = {
    total: params.rows.length,
    created: 0,
    skipped: 0,
    errors: [],
    batchId: batch.id,
  }

  for (let i = 0; i < params.rows.length; i++) {
    const row = params.rows[i]
    const line = i + 2
    try {
      if (!row.scheduledDate || isNaN(new Date(row.scheduledDate).getTime())) {
        result.errors.push(`行${line}: 予定支払日の形式が不正です`)
        continue
      }
      if (!row.partnerName?.trim()) {
        result.errors.push(`行${line}: 支払先が空です`)
        continue
      }
      const partnerId = await findOrCreatePartner({
        companyId: params.companyId,
        name: row.partnerName,
        type: "VENDOR",
      })
      const recorded = BigInt(Math.round(row.recordedAmount || 0))
      const transfer = row.transferAmount
        ? BigInt(Math.round(row.transferAmount))
        : recorded
      await prisma.transaction.create({
        data: {
          companyId: params.companyId,
          accountId: params.accountId,
          partnerId,
          type: "COST_PAYMENT",
          status: "DRAFT",
          scheduledDate: new Date(row.scheduledDate),
          transactionDate: row.transactionDate ? new Date(row.transactionDate) : null,
          accountingMonth: params.yearMonth,
          amount: -transfer,
          estimatedAmount: -transfer,
          recordedAmount: recorded,
          transferAmount: transfer,
          paymentMethod: "BANK_TRANSFER",
          summary: row.summary ?? null,
        },
      })
      result.created += 1
    } catch (e) {
      result.errors.push(`行${line}: ${e instanceof Error ? e.message : "不明なエラー"}`)
    }
  }

  await prisma.importBatch.update({
    where: { id: batch.id },
    data: {
      appliedRows: result.created,
      skippedRows: result.skipped,
      status: result.created > 0 ? "APPLIED" : "CANCELLED",
    },
  })

  revalidatePath("/costs")
  revalidatePath("/cashflow-table")
  return result
}

export async function getImportBatches(params: { companyId: string; batchType?: string }) {
  await requireSession()
  const where: Record<string, unknown> = { companyId: params.companyId }
  if (params.batchType) where.batchType = params.batchType
  return prisma.importBatch.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 50,
  })
}
