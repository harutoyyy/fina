"use server"

import { prisma } from "@/lib/prisma"
import { requireSession } from "@/lib/auth-server"

export type ReportType =
  | "TRIAL_BALANCE"
  | "INCOME_STATEMENT"
  | "BALANCE_SHEET"
  | "MANUFACTURING_COST"

export type ReportScope = "SINGLE" | "INDUSTRY_TOTAL" | "ALL_TOTAL"

export type FinancialReportRow = {
  id: string
  accountName: string
  section: string | null
  amount: number
  displayOrder: number
  isSubtotal: boolean
  isSection: boolean
  notes: string | null
}

export type TrialBalanceData = {
  yearMonth: string
  rows: FinancialReportRow[]
}

export type YearlyMonthCell = {
  yearMonth: string
  amount: number
}

export type YearlyReportRow = {
  accountName: string
  section: string | null
  displayOrder: number
  isSubtotal: boolean
  isSection: boolean
  monthly: YearlyMonthCell[]
  total: number
}

export type YearlyReportData = {
  reportType: ReportType
  fiscalYear: number
  months: string[] // ["YYYY-MM", ...] 5月〜4月の12ヶ月
  rows: YearlyReportRow[]
}

export type ScopeOption = {
  scope: ReportScope
  label: string
}

// 事業年度（5月〜4月）の12ヶ月分の年月文字列を返す
function buildFiscalMonths(fiscalYear: number): string[] {
  const months: string[] = []
  for (let i = 0; i < 12; i++) {
    // 5月始まり: i=0 -> May (5), i=7 -> Dec (12), i=8 -> Jan of next year
    const monthIndex = 5 + i // 5,6,7,...,16
    const year = fiscalYear + Math.floor((monthIndex - 1) / 12)
    const month = ((monthIndex - 1) % 12) + 1
    months.push(`${year}-${String(month).padStart(2, "0")}`)
  }
  return months
}

/**
 * 単月の試算表データを取得
 * - companyId が指定されていれば SINGLE スコープでその会社の月別データを取得
 * - companyId が null かつ scope が指定されていれば合計スコープのデータを取得
 */
export async function getTrialBalance(params: {
  companyId?: string | null
  scope?: ReportScope
  scopeLabel?: string
  yearMonth: string
}): Promise<TrialBalanceData> {
  await requireSession()

  const { companyId, scope = "SINGLE", scopeLabel, yearMonth } = params

  const where: {
    reportType: string
    yearMonth: string
    scope: ReportScope
    companyId?: string | null
    scopeLabel?: string
  } = {
    reportType: "TRIAL_BALANCE",
    yearMonth,
    scope,
  }

  if (scope === "SINGLE") {
    if (companyId) where.companyId = companyId
  } else {
    where.companyId = null
    if (scopeLabel) where.scopeLabel = scopeLabel
  }

  const records = await prisma.financialReport.findMany({
    where,
    orderBy: [{ displayOrder: "asc" }, { accountName: "asc" }],
  })

  return {
    yearMonth,
    rows: records.map((r) => ({
      id: r.id,
      accountName: r.accountName,
      section: r.section,
      amount: Number(r.amount),
      displayOrder: r.displayOrder,
      isSubtotal: r.isSubtotal,
      isSection: r.isSection,
      notes: r.notes,
    })),
  }
}

/**
 * 年間推移データを取得（指定会社・指定レポート種別、5月〜4月の12ヶ月分）
 * 行は勘定科目ごとに集約し、月別の値と当期合計を持つ。
 */
export async function getYearlyReport(params: {
  companyId?: string | null
  scope?: ReportScope
  scopeLabel?: string
  reportType: ReportType
  fiscalYear: number
}): Promise<YearlyReportData> {
  await requireSession()

  const {
    companyId,
    scope = "SINGLE",
    scopeLabel,
    reportType,
    fiscalYear,
  } = params

  const months = buildFiscalMonths(fiscalYear)

  const where: {
    reportType: ReportType
    yearMonth: { in: string[] }
    scope: ReportScope
    companyId?: string | null
    scopeLabel?: string
    fiscalYear?: number
  } = {
    reportType,
    yearMonth: { in: months },
    scope,
  }

  if (scope === "SINGLE") {
    if (companyId) where.companyId = companyId
  } else {
    where.companyId = null
    if (scopeLabel) where.scopeLabel = scopeLabel
  }

  // fiscalYear が DB に格納されていれば優先する（同月でも年度違いを区別するため）
  // ただし NULL の場合があるため OR で吸収する
  const records = await prisma.financialReport.findMany({
    where: {
      ...where,
      OR: [{ fiscalYear }, { fiscalYear: null }],
    },
    orderBy: [{ displayOrder: "asc" }, { accountName: "asc" }],
  })

  // 勘定科目ごとに集約
  type AggKey = string
  const agg = new Map<
    AggKey,
    {
      accountName: string
      section: string | null
      displayOrder: number
      isSubtotal: boolean
      isSection: boolean
      perMonth: Map<string, bigint>
    }
  >()

  // 同一勘定科目は section と name のみで集約する
  // （displayOrder は月ごとに別値が入っているケースがあるため key には含めない）
  for (const r of records) {
    const key = `${r.section ?? ""}::${r.accountName}`
    let entry = agg.get(key)
    if (!entry) {
      entry = {
        accountName: r.accountName,
        section: r.section,
        // 最小 displayOrder を採用してソート順を安定させる
        displayOrder: r.displayOrder,
        isSubtotal: r.isSubtotal,
        isSection: r.isSection,
        perMonth: new Map(),
      }
      agg.set(key, entry)
    } else if (r.displayOrder < entry.displayOrder) {
      entry.displayOrder = r.displayOrder
    }
    const prev = entry.perMonth.get(r.yearMonth) ?? BigInt(0)
    entry.perMonth.set(r.yearMonth, prev + r.amount)
  }

  const rows: YearlyReportRow[] = Array.from(agg.values())
    .sort((a, b) => {
      if (a.displayOrder !== b.displayOrder)
        return a.displayOrder - b.displayOrder
      return a.accountName.localeCompare(b.accountName, "ja")
    })
    .map((entry) => {
      const monthly = months.map((ym) => ({
        yearMonth: ym,
        amount: Number(entry.perMonth.get(ym) ?? BigInt(0)),
      }))
      const total = monthly.reduce((sum, m) => sum + m.amount, 0)
      return {
        accountName: entry.accountName,
        section: entry.section,
        displayOrder: entry.displayOrder,
        isSubtotal: entry.isSubtotal,
        isSection: entry.isSection,
        monthly,
        total,
      }
    })

  return {
    reportType,
    fiscalYear,
    months,
    rows,
  }
}

/**
 * 利用可能な月リスト（YYYY-MM、降順）
 */
export async function getAvailableMonths(): Promise<string[]> {
  await requireSession()

  const records = await prisma.financialReport.findMany({
    select: { yearMonth: true },
    distinct: ["yearMonth"],
    orderBy: { yearMonth: "desc" },
  })

  return records.map((r) => r.yearMonth)
}

/**
 * 利用可能な合計スコープ（鳶 合計 / 広告 合計 / 全体 合計 等）
 */
export async function getAvailableScopes(): Promise<ScopeOption[]> {
  await requireSession()

  const records = await prisma.financialReport.findMany({
    where: {
      scope: { in: ["INDUSTRY_TOTAL", "ALL_TOTAL"] },
    },
    select: { scope: true, scopeLabel: true },
    distinct: ["scope", "scopeLabel"],
  })

  const seen = new Map<string, ScopeOption>()
  for (const r of records) {
    const label = r.scopeLabel ?? (r.scope === "ALL_TOTAL" ? "全体 合計" : "合計")
    const key = `${r.scope}::${label}`
    if (!seen.has(key)) {
      seen.set(key, { scope: r.scope as ReportScope, label })
    }
  }

  return Array.from(seen.values()).sort((a, b) => {
    // ALL_TOTAL を最後に、INDUSTRY_TOTAL を先に
    if (a.scope !== b.scope) {
      return a.scope === "ALL_TOTAL" ? 1 : -1
    }
    return a.label.localeCompare(b.label, "ja")
  })
}
