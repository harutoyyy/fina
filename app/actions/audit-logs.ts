"use server"

import { prisma } from "@/lib/prisma"
import { requireSession, requireCompanyAdmin } from "@/lib/auth-server"
import { decodeAuditLog, type DecodedAuditLog } from "@/lib/audit"
import type { Prisma } from "@prisma/client"

// ============================================================
// 既存実装互換 API (record単位の参照は引き続き全ユーザに開放)
// ============================================================

export async function getAuditLogs(params: {
  tableName?: string
  recordId?: string
  limit?: number
  offset?: number
}) {
  await requireSession()
  return prisma.auditLog.findMany({
    where: {
      ...(params.tableName && { tableName: params.tableName }),
      ...(params.recordId && { recordId: params.recordId }),
    },
    orderBy: { timestamp: "desc" },
    take: params.limit ?? 50,
    skip: params.offset ?? 0,
  })
}

export async function getAuditLogsForRecord(tableName: string, recordId: string) {
  await requireSession()
  return prisma.auditLog.findMany({
    where: { tableName, recordId },
    orderBy: { timestamp: "desc" },
  })
}

// ============================================================
// P4: 監査ログ一覧 (フィルタ + ページネーション + ユーザー名解決)
// ============================================================

export type AuditLogListItem = DecodedAuditLog & {
  userName: string | null
  userEmail: string | null
  companyName: string | null
}

export type AuditLogFilter = {
  /** YYYY-MM-DD */
  from?: string | null
  /** YYYY-MM-DD */
  to?: string | null
  userId?: string | null
  action?: string | null
  /** カンマで複数指定可。"User,Transaction" など */
  targetType?: string | null
  /** SUPER_ADMIN のみ指定可能。指定なしなら自社で絞る */
  companyId?: string | null
  /** 自由文字列検索: targetId / reason 部分一致 */
  query?: string | null
}

export type AuditLogListResult = {
  items: AuditLogListItem[]
  total: number
  page: number
  pageSize: number
  totalPages: number
  /** SUPER_ADMIN は全社可視 */
  canSeeAllCompanies: boolean
}

const DEFAULT_PAGE_SIZE = 50
const MAX_PAGE_SIZE = 200

async function buildAuditLogWhere(filter: AuditLogFilter, scopeCompanyIds: string[] | null) {
  const where: Prisma.AuditLogWhereInput = {}

  if (filter.from || filter.to) {
    where.timestamp = {}
    if (filter.from) {
      where.timestamp.gte = new Date(filter.from + "T00:00:00")
    }
    if (filter.to) {
      where.timestamp.lte = new Date(filter.to + "T23:59:59.999")
    }
  }

  if (filter.userId) {
    where.userId = filter.userId
  }

  if (filter.action) {
    where.operation = filter.action
  }

  if (filter.targetType) {
    const types = filter.targetType
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
    if (types.length === 1) {
      where.tableName = types[0]
    } else if (types.length > 1) {
      where.tableName = { in: types }
    }
  }

  if (filter.query) {
    where.OR = [
      { recordId: { contains: filter.query, mode: "insensitive" } },
      { reason: { contains: filter.query, mode: "insensitive" } },
    ]
  }

  // 会社境界の適用: AuditLog には companyId カラムが無いため、
  // afterData JSON 内の `__companyId` で絞り込む。
  // SUPER_ADMIN が特定会社を選んだ場合も同様。
  const targetCompanyIds: string[] | null =
    filter.companyId != null
      ? [filter.companyId]
      : scopeCompanyIds
  if (targetCompanyIds) {
    const orConds: Prisma.AuditLogWhereInput[] = targetCompanyIds.map((cid) => ({
      afterData: {
        path: ["__companyId"],
        equals: cid,
      } as Prisma.JsonNullableFilter<"AuditLog">,
    }))
    // 既存ロジック互換: 会社境界の判定不能 (afterData が無い) ログは
    // 一旦含めない (SUPER_ADMIN のみ全件閲覧)
    where.AND = [{ OR: orConds }]
  }

  return where
}

export async function listAuditLogs(
  filter: AuditLogFilter = {},
  pagination: { page?: number; pageSize?: number } = {},
): Promise<AuditLogListResult> {
  const ctx = await requireCompanyAdmin()

  const isSuper = ctx.scopeRole === "SUPER_ADMIN"
  const scopeCompanyIds = isSuper
    ? null
    : Array.from(
        new Set(
          [ctx.primaryCompanyId, ...(ctx.assignedCompanyIds ?? [])].filter(
            (v): v is string => typeof v === "string" && v.length > 0,
          ),
        ),
      )

  // COMPANY_ADMIN が他社 companyId を指定してきた場合は弾く
  if (!isSuper && filter.companyId && scopeCompanyIds && !scopeCompanyIds.includes(filter.companyId)) {
    throw new Error("Forbidden: cannot view audit logs of another company")
  }

  const where = await buildAuditLogWhere(filter, scopeCompanyIds)

  const page = Math.max(1, pagination.page ?? 1)
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, pagination.pageSize ?? DEFAULT_PAGE_SIZE))

  const [total, rows] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { timestamp: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ])

  const decoded = rows.map(decodeAuditLog)

  // ユーザー名・会社名の解決 (N+1 を避けるため一括取得)
  const userIds = Array.from(new Set(decoded.map((d) => d.userId)))
  const companyIds = Array.from(
    new Set(decoded.map((d) => d.companyId).filter((v): v is string => !!v)),
  )

  const [users, companies] = await Promise.all([
    userIds.length > 0
      ? prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true, email: true },
        })
      : Promise.resolve([]),
    companyIds.length > 0
      ? prisma.company.findMany({
          where: { id: { in: companyIds } },
          select: { id: true, name: true, shortName: true },
        })
      : Promise.resolve([]),
  ])

  const userMap = new Map(users.map((u) => [u.id, u]))
  const companyMap = new Map(companies.map((c) => [c.id, c]))

  const items: AuditLogListItem[] = decoded.map((d) => {
    const u = userMap.get(d.userId)
    const c = d.companyId ? companyMap.get(d.companyId) : null
    return {
      ...d,
      userName: u?.name ?? null,
      userEmail: u?.email ?? null,
      companyName: c ? (c.shortName ?? c.name) : null,
    }
  })

  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
    canSeeAllCompanies: isSuper,
  }
}

// ============================================================
// アクション一覧 / ターゲットタイプ一覧 (フィルタの選択肢用)
// ============================================================

export async function getAuditLogFacets(): Promise<{
  actions: string[]
  targetTypes: string[]
}> {
  await requireCompanyAdmin()

  // 件数が多い場合に備え、distinct を使う
  const [actionRows, typeRows] = await Promise.all([
    prisma.auditLog.findMany({
      distinct: ["operation"],
      select: { operation: true },
      orderBy: { operation: "asc" },
      take: 200,
    }),
    prisma.auditLog.findMany({
      distinct: ["tableName"],
      select: { tableName: true },
      orderBy: { tableName: "asc" },
      take: 200,
    }),
  ])

  return {
    actions: actionRows.map((r) => r.operation),
    targetTypes: typeRows.map((r) => r.tableName),
  }
}

// ============================================================
// CSV エクスポート
// ============================================================

function csvEscape(value: unknown): string {
  if (value == null) return ""
  let s: string
  if (typeof value === "object") {
    try {
      s = JSON.stringify(value)
    } catch {
      s = String(value)
    }
  } else {
    s = String(value)
  }
  if (s.includes(",") || s.includes("\"") || s.includes("\n") || s.includes("\r")) {
    return '"' + s.replace(/"/g, '""') + '"'
  }
  return s
}

/**
 * 監査ログを CSV 形式の文字列として返す。
 * BOM 付き UTF-8 を返すので、Excel でも文字化けしない。
 * クライアント側で `new Blob([csv], { type: "text/csv;charset=utf-8" })` して download する。
 */
export async function exportAuditLogsCsv(filter: AuditLogFilter = {}): Promise<string> {
  // 最大 10000 件まで取得 (大きすぎる場合は事前にフィルタを絞らせる)
  const MAX_EXPORT = 10000
  const result = await listAuditLogs(filter, { page: 1, pageSize: MAX_EXPORT })

  const headers = [
    "createdAt",
    "userId",
    "userName",
    "userEmail",
    "companyId",
    "companyName",
    "action",
    "targetType",
    "targetId",
    "reason",
    "ipAddress",
    "userAgent",
    "payload",
    "before",
  ]

  const lines: string[] = []
  lines.push(headers.join(","))

  for (const item of result.items) {
    lines.push(
      [
        item.createdAt.toISOString(),
        item.userId,
        item.userName,
        item.userEmail,
        item.companyId,
        item.companyName,
        item.action,
        item.targetType,
        item.targetId,
        item.reason,
        item.ipAddress,
        item.userAgent,
        item.payload,
        item.before,
      ]
        .map(csvEscape)
        .join(","),
    )
  }

  // BOM 付き UTF-8
  return "﻿" + lines.join("\r\n")
}
