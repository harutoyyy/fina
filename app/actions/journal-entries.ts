"use server"

import { prisma } from "@/lib/prisma"
import { requireSession } from "@/lib/auth-server"
import type { Prisma } from "@prisma/client"

export type SerializableJournalEntry = {
  id: string
  voucherNo: number
  identifierFlag: number
  transactionDate: string // ISO date string
  drAccountKind: string | null
  drSubAccount: string | null
  drCompanyId: string | null
  drCompanyName: string | null
  drCompanyShortName: string | null
  drTaxClass: string | null
  drAmount: number
  drTaxAmount: number
  crAccountKind: string | null
  crSubAccount: string | null
  crCompanyId: string | null
  crCompanyName: string | null
  crCompanyShortName: string | null
  crTaxClass: string | null
  crAmount: number
  crTaxAmount: number
  summary: string | null
  refNumber: string | null
  voucherDueDate: string | null
  voucherType: number | null
  source: string | null
  memo: string | null
  tag1: number | null
  tag2: number | null
  adjustment: string | null
}

export type GetJournalEntriesResult = {
  rows: SerializableJournalEntry[]
  total: number
  page: number
  pageSize: number
  totalDr: number
  totalCr: number
}

export type GetJournalEntriesParams = {
  companyId?: string | null
  yearMonth?: string
  voucherNo?: number
  identifierFlag?: number
  accountKindKeyword?: string
  page?: number
  pageSize?: number
}

const DEFAULT_PAGE_SIZE = 100

function buildDateRange(yearMonth: string): { start: Date; end: Date } | null {
  // "YYYY-MM" -> [start of month, start of next month)
  const m = yearMonth.match(/^(\d{4})-(\d{2})$/)
  if (!m) return null
  const year = parseInt(m[1], 10)
  const month = parseInt(m[2], 10)
  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) return null
  const start = new Date(Date.UTC(year, month - 1, 1))
  const end = new Date(Date.UTC(month === 12 ? year + 1 : year, month === 12 ? 0 : month, 1))
  return { start, end }
}

export async function getJournalEntries(
  params: GetJournalEntriesParams
): Promise<GetJournalEntriesResult> {
  await requireSession()

  const {
    companyId,
    yearMonth,
    voucherNo,
    identifierFlag,
    accountKindKeyword,
    page = 1,
    pageSize = DEFAULT_PAGE_SIZE,
  } = params

  const where: Prisma.JournalEntryWhereInput = {}

  if (companyId) {
    where.OR = [{ drCompanyId: companyId }, { crCompanyId: companyId }]
  }

  if (yearMonth) {
    const range = buildDateRange(yearMonth)
    if (range) {
      where.transactionDate = {
        gte: range.start,
        lt: range.end,
      }
    }
  }

  if (typeof voucherNo === "number" && !isNaN(voucherNo)) {
    where.voucherNo = voucherNo
  }

  if (typeof identifierFlag === "number" && !isNaN(identifierFlag)) {
    where.identifierFlag = identifierFlag
  }

  if (accountKindKeyword && accountKindKeyword.trim().length > 0) {
    const kw = accountKindKeyword.trim()
    const accountKindClauses: Prisma.JournalEntryWhereInput[] = [
      { drAccountKind: { contains: kw, mode: "insensitive" } },
      { crAccountKind: { contains: kw, mode: "insensitive" } },
    ]

    if (where.OR) {
      // 既に companyId 条件で OR を使っているので AND で結合
      where.AND = [
        { OR: where.OR },
        { OR: accountKindClauses },
      ]
      delete where.OR
    } else {
      where.OR = accountKindClauses
    }
  }

  const safePage = page < 1 ? 1 : Math.floor(page)
  const safePageSize = pageSize < 1 ? DEFAULT_PAGE_SIZE : Math.min(Math.floor(pageSize), 500)

  // 並列実行: count + findMany
  // - SerializableJournalEntry が要求するカラムのみ select で取得（不要な createdAt 等を除外）
  // - drCompany / crCompany は shortName のみ必要（include だと Company 全列を読んでしまうので select で絞る）
  // - totalDr/totalCr はページ範囲合計（フッタ「当ページ 借方合計」表記）なので JS 集計を維持
  const [total, records] = await Promise.all([
    prisma.journalEntry.count({ where }),
    prisma.journalEntry.findMany({
      where,
      orderBy: [
        { transactionDate: "asc" },
        { voucherNo: "asc" },
      ],
      skip: (safePage - 1) * safePageSize,
      take: safePageSize,
      select: {
        id: true,
        voucherNo: true,
        identifierFlag: true,
        transactionDate: true,
        drAccountKind: true,
        drSubAccount: true,
        drCompanyId: true,
        drCompanyName: true,
        drTaxClass: true,
        drAmount: true,
        drTaxAmount: true,
        crAccountKind: true,
        crSubAccount: true,
        crCompanyId: true,
        crCompanyName: true,
        crTaxClass: true,
        crAmount: true,
        crTaxAmount: true,
        summary: true,
        refNumber: true,
        voucherDueDate: true,
        voucherType: true,
        source: true,
        memo: true,
        tag1: true,
        tag2: true,
        adjustment: true,
        drCompany: { select: { shortName: true } },
        crCompany: { select: { shortName: true } },
      },
    }),
  ])

  let totalDr = 0
  let totalCr = 0

  const rows: SerializableJournalEntry[] = records.map((r) => {
    const drAmount = Number(r.drAmount)
    const crAmount = Number(r.crAmount)
    totalDr += drAmount
    totalCr += crAmount
    return {
      id: r.id,
      voucherNo: r.voucherNo,
      identifierFlag: r.identifierFlag,
      transactionDate: r.transactionDate.toISOString(),
      drAccountKind: r.drAccountKind,
      drSubAccount: r.drSubAccount,
      drCompanyId: r.drCompanyId,
      drCompanyName: r.drCompanyName,
      drCompanyShortName: r.drCompany?.shortName ?? null,
      drTaxClass: r.drTaxClass,
      drAmount,
      drTaxAmount: Number(r.drTaxAmount),
      crAccountKind: r.crAccountKind,
      crSubAccount: r.crSubAccount,
      crCompanyId: r.crCompanyId,
      crCompanyName: r.crCompanyName,
      crCompanyShortName: r.crCompany?.shortName ?? null,
      crTaxClass: r.crTaxClass,
      crAmount,
      crTaxAmount: Number(r.crTaxAmount),
      summary: r.summary,
      refNumber: r.refNumber,
      voucherDueDate: r.voucherDueDate ? r.voucherDueDate.toISOString() : null,
      voucherType: r.voucherType,
      source: r.source,
      memo: r.memo,
      tag1: r.tag1,
      tag2: r.tag2,
      adjustment: r.adjustment,
    }
  })

  return {
    rows,
    total,
    page: safePage,
    pageSize: safePageSize,
    totalDr,
    totalCr,
  }
}
