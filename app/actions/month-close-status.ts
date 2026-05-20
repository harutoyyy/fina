"use server"

import { prisma } from "@/lib/prisma"
import { requireCompanyAdmin } from "@/lib/auth-server"

// ============================================================
// P4: 月締め状況マトリクス (全社 × 直近 N ヶ月)
// ============================================================

export type MonthCloseCellStatus = "CLOSED" | "OPEN" | "NONE"

export type MonthCloseMatrixCell = {
  yearMonth: string
  status: MonthCloseCellStatus
  closedAt: string | null
  closedBy: string | null
  reopenedAt: string | null
  reopenedBy: string | null
  reopenReason: string | null
}

export type MonthCloseMatrixRow = {
  companyId: string
  companyName: string
  companyShortName: string | null
  cells: MonthCloseMatrixCell[]
}

export type MonthCloseMatrix = {
  yearMonths: string[]
  rows: MonthCloseMatrixRow[]
  canSeeAllCompanies: boolean
}

/**
 * `baseMonth` を起点に、直近 `months` ヶ月分の YYYY-MM を新しい順で返す。
 * 例: baseMonth="2026-05", months=6 → ["2026-05","2026-04",...,"2025-12"]
 */
function buildYearMonths(baseMonth: string, months: number): string[] {
  const m = baseMonth.match(/^(\d{4})-(\d{2})$/)
  if (!m) {
    const now = new Date()
    return buildYearMonths(
      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
      months,
    )
  }
  let year = parseInt(m[1], 10)
  let month = parseInt(m[2], 10)
  const result: string[] = []
  for (let i = 0; i < months; i++) {
    result.push(`${year}-${String(month).padStart(2, "0")}`)
    month -= 1
    if (month <= 0) {
      month = 12
      year -= 1
    }
  }
  return result
}

export async function getMonthCloseMatrix(params: {
  baseMonth?: string
  months?: number
} = {}): Promise<MonthCloseMatrix> {
  const ctx = await requireCompanyAdmin()
  const isSuper = ctx.scopeRole === "SUPER_ADMIN"

  const months = Math.min(24, Math.max(1, params.months ?? 6))
  const now = new Date()
  const baseMonth =
    params.baseMonth ??
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`

  const yearMonths = buildYearMonths(baseMonth, months)

  // 会社一覧 (COMPANY_ADMIN は自社のみ)
  let companyWhere: Parameters<typeof prisma.company.findMany>[0] = {
    orderBy: { displayOrder: "asc" },
    select: { id: true, name: true, shortName: true },
  }

  if (!isSuper) {
    const scopeIds = Array.from(
      new Set(
        [ctx.primaryCompanyId, ...(ctx.assignedCompanyIds ?? [])].filter(
          (v): v is string => typeof v === "string" && v.length > 0,
        ),
      ),
    )
    companyWhere = {
      ...companyWhere,
      where: { id: { in: scopeIds } },
    }
  }

  const companies = await prisma.company.findMany(companyWhere)
  const companyIds = companies.map((c) => c.id)

  if (companyIds.length === 0) {
    return { yearMonths, rows: [], canSeeAllCompanies: isSuper }
  }

  const monthCloses = await prisma.monthClose.findMany({
    where: {
      companyId: { in: companyIds },
      yearMonth: { in: yearMonths },
    },
    select: {
      companyId: true,
      yearMonth: true,
      isClosed: true,
      closedAt: true,
      closedBy: true,
      reopenedAt: true,
      reopenedBy: true,
      reopenReason: true,
    },
  })

  // companyId -> yearMonth -> record
  const byCompany = new Map<string, Map<string, (typeof monthCloses)[number]>>()
  for (const mc of monthCloses) {
    let m = byCompany.get(mc.companyId)
    if (!m) {
      m = new Map()
      byCompany.set(mc.companyId, m)
    }
    m.set(mc.yearMonth, mc)
  }

  const rows: MonthCloseMatrixRow[] = companies.map((c) => {
    const m = byCompany.get(c.id)
    const cells: MonthCloseMatrixCell[] = yearMonths.map((ym) => {
      const rec = m?.get(ym)
      let status: MonthCloseCellStatus
      if (!rec) {
        status = "NONE"
      } else if (rec.isClosed) {
        status = "CLOSED"
      } else {
        status = "OPEN"
      }
      return {
        yearMonth: ym,
        status,
        closedAt: rec?.closedAt?.toISOString() ?? null,
        closedBy: rec?.closedBy ?? null,
        reopenedAt: rec?.reopenedAt?.toISOString() ?? null,
        reopenedBy: rec?.reopenedBy ?? null,
        reopenReason: rec?.reopenReason ?? null,
      }
    })
    return {
      companyId: c.id,
      companyName: c.name,
      companyShortName: c.shortName ?? null,
      cells,
    }
  })

  return { yearMonths, rows, canSeeAllCompanies: isSuper }
}
