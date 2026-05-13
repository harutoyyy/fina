"use server"

import { prisma } from "@/lib/prisma"
import { requireSession } from "@/lib/auth-server"
import { revalidatePath } from "next/cache"
import { bigintToJson } from "@/lib/format"
import crypto from "crypto"

// ============================================================
// クレジットカード マスタ
// ============================================================

export async function getCreditCards(companyId: string) {
  await requireSession()
  return prisma.creditCard.findMany({
    where: { companyId },
    orderBy: [{ isActive: "desc" }, { cardName: "asc" }],
  })
}

export async function createCreditCard(data: {
  companyId: string
  cardName: string
  cardBrand?: string
  cardLast4?: string
  holderName?: string
  paymentAccountId?: string
  closingDay?: number
  paymentDay?: number
  notes?: string
}) {
  await requireSession()
  if (!data.cardName.trim()) throw new Error("カード名は必須です")

  const row = await prisma.creditCard.create({
    data: {
      companyId: data.companyId,
      cardName: data.cardName.trim(),
      cardBrand: data.cardBrand?.trim() || null,
      cardLast4: data.cardLast4?.trim() || null,
      holderName: data.holderName?.trim() || null,
      paymentAccountId: data.paymentAccountId || null,
      closingDay: data.closingDay ?? null,
      paymentDay: data.paymentDay ?? null,
      notes: data.notes?.trim() || null,
    },
  })
  revalidatePath("/card-statements")
  return row
}

export async function updateCreditCard(
  id: string,
  data: {
    cardName?: string
    cardBrand?: string | null
    cardLast4?: string | null
    holderName?: string | null
    paymentAccountId?: string | null
    closingDay?: number | null
    paymentDay?: number | null
    isActive?: boolean
    notes?: string | null
  }
) {
  await requireSession()
  const update: Record<string, unknown> = {}
  if (data.cardName !== undefined) update.cardName = data.cardName.trim()
  if (data.cardBrand !== undefined) update.cardBrand = data.cardBrand?.trim() || null
  if (data.cardLast4 !== undefined) update.cardLast4 = data.cardLast4?.trim() || null
  if (data.holderName !== undefined) update.holderName = data.holderName?.trim() || null
  if (data.paymentAccountId !== undefined) update.paymentAccountId = data.paymentAccountId
  if (data.closingDay !== undefined) update.closingDay = data.closingDay
  if (data.paymentDay !== undefined) update.paymentDay = data.paymentDay
  if (data.isActive !== undefined) update.isActive = data.isActive
  if (data.notes !== undefined) update.notes = data.notes?.trim() || null

  const row = await prisma.creditCard.update({ where: { id }, data: update })
  revalidatePath("/card-statements")
  return row
}

export async function deleteCreditCard(id: string) {
  await requireSession()
  const used = await prisma.cardStatement.count({ where: { cardId: id } })
  if (used > 0) {
    throw new Error(`このカードには${used}件の明細があります。先に明細を削除するか、非有効化してください`)
  }
  await prisma.creditCard.delete({ where: { id } })
  revalidatePath("/card-statements")
}

// ============================================================
// カード明細
// ============================================================

export async function getCardStatements(params: {
  companyId: string
  cardId?: string
  statementMonth?: string // "YYYY-MM"
}) {
  await requireSession()
  const cards = await prisma.creditCard.findMany({
    where: { companyId: params.companyId },
    select: { id: true },
  })
  const cardIds = cards.map((c) => c.id)
  if (cardIds.length === 0) return []

  const where: Record<string, unknown> = {
    cardId: params.cardId ? params.cardId : { in: cardIds },
  }
  if (params.statementMonth) where.statementMonth = params.statementMonth

  const rows = await prisma.cardStatement.findMany({
    where,
    include: { card: { select: { id: true, cardName: true, cardLast4: true } } },
    orderBy: [{ statementDate: "desc" }],
  })
  return bigintToJson(rows) as Array<{
    id: string
    cardId: string
    statementMonth: string
    statementDate: string
    storeName: string
    amount: string
    category: string | null
    midId: string | null
    subId: string | null
    partnerId: string | null
    summary: string | null
    isPosted: boolean
    transactionId: string | null
    importBatchId: string | null
    rowHash: string | null
    card: { id: string; cardName: string; cardLast4: string | null }
    createdAt: string
    updatedAt: string
  }>
}

export async function updateCardStatement(
  id: string,
  data: {
    storeName?: string
    amount?: string
    category?: string | null
    midId?: string | null
    subId?: string | null
    partnerId?: string | null
    summary?: string | null
  }
) {
  await requireSession()
  const update: Record<string, unknown> = {}
  if (data.storeName !== undefined) update.storeName = data.storeName
  if (data.amount !== undefined) update.amount = BigInt(data.amount || "0")
  if (data.category !== undefined) update.category = data.category
  if (data.midId !== undefined) update.midId = data.midId
  if (data.subId !== undefined) update.subId = data.subId
  if (data.partnerId !== undefined) update.partnerId = data.partnerId
  if (data.summary !== undefined) update.summary = data.summary

  const row = await prisma.cardStatement.update({ where: { id }, data: update })
  revalidatePath("/card-statements")
  return bigintToJson(row)
}

export async function deleteCardStatement(id: string) {
  await requireSession()
  await prisma.cardStatement.delete({ where: { id } })
  revalidatePath("/card-statements")
}

// ============================================================
// インポート
// ============================================================

export type CardImportRow = {
  statementDate: string // YYYY-MM-DD
  storeName: string
  amount: number // 円
  category?: string
  summary?: string
}

export type CardImportResult = {
  total: number
  created: number
  skipped: number
  errors: string[]
  batchId: string | null
}

function rowHashOf(cardId: string, r: CardImportRow): string {
  const key = `${cardId}|${r.statementDate}|${r.storeName}|${r.amount}`
  return crypto.createHash("sha256").update(key).digest("hex").slice(0, 32)
}

export async function importCardStatements(params: {
  companyId: string
  cardId: string
  statementMonth: string // "YYYY-MM" 引落月
  sourceName?: string
  rows: CardImportRow[]
}): Promise<CardImportResult> {
  await requireSession()

  if (!/^\d{4}-\d{2}$/.test(params.statementMonth)) {
    throw new Error("引落月の形式が不正です（YYYY-MM）")
  }
  const card = await prisma.creditCard.findUnique({ where: { id: params.cardId } })
  if (!card || card.companyId !== params.companyId) {
    throw new Error("カードが見つかりません")
  }

  const batch = await prisma.importBatch.create({
    data: {
      companyId: params.companyId,
      batchType: "CARD",
      sourceName: params.sourceName ?? null,
      sourceFormat: "EXCEL",
      yearMonth: params.statementMonth,
      totalRows: params.rows.length,
      status: "DRAFT",
    },
  })

  const result: CardImportResult = {
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
      if (!row.statementDate || isNaN(new Date(row.statementDate).getTime())) {
        result.errors.push(`行${line}: 利用日の形式が不正です`)
        continue
      }
      if (!row.storeName?.trim()) {
        result.errors.push(`行${line}: 利用店名が空です`)
        continue
      }
      const hash = rowHashOf(params.cardId, row)
      const exists = await prisma.cardStatement.findFirst({
        where: { cardId: params.cardId, rowHash: hash },
        select: { id: true },
      })
      if (exists) {
        result.skipped += 1
        continue
      }
      await prisma.cardStatement.create({
        data: {
          cardId: params.cardId,
          statementMonth: params.statementMonth,
          statementDate: new Date(row.statementDate),
          storeName: row.storeName.trim(),
          amount: BigInt(Math.round(row.amount || 0)),
          category: row.category?.trim() || null,
          summary: row.summary?.trim() || null,
          rowHash: hash,
          importBatchId: batch.id,
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

  revalidatePath("/card-statements")
  return result
}

/**
 * 明細をまとめて取引に転記する。引落月の paymentDay にカードの支払口座から
 * 一括の Transaction を1件起票し、各カード明細の transactionId に紐付ける。
 * （まずは最小実装: TransactionDetail への分解は今後対応。）
 */
export async function postCardStatementsToTransaction(params: {
  companyId: string
  cardId: string
  statementMonth: string
  scheduledDate: string // YYYY-MM-DD
}) {
  await requireSession()

  const card = await prisma.creditCard.findUnique({
    where: { id: params.cardId },
    include: { statements: { where: { statementMonth: params.statementMonth, isPosted: false } } },
  })
  if (!card) throw new Error("カードが見つかりません")
  if (!card.paymentAccountId) throw new Error("カードに引落口座が設定されていません")
  if (card.statements.length === 0) throw new Error("転記対象の未転記明細がありません")

  const total = card.statements.reduce((sum, s) => sum + s.amount, BigInt(0))

  const tx = await prisma.$transaction(async (tx) => {
    const transaction = await tx.transaction.create({
      data: {
        companyId: params.companyId,
        accountId: card.paymentAccountId!,
        type: "EXPENSE",
        status: "DRAFT",
        scheduledDate: new Date(params.scheduledDate),
        accountingMonth: params.statementMonth,
        amount: -total,
        estimatedAmount: -total,
        paymentMethod: "DIRECT_DEBIT",
        classification: "VARIABLE",
        summary: `${card.cardName} カード引落 ${params.statementMonth}`,
      },
    })
    for (const s of card.statements) {
      await tx.cardStatement.update({
        where: { id: s.id },
        data: { isPosted: true, transactionId: transaction.id },
      })
    }
    return transaction
  })

  revalidatePath("/card-statements")
  revalidatePath("/cashflow-table")
  return { transactionId: tx.id, total: total.toString(), count: card.statements.length }
}
