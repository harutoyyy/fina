// ============================================================
// 監査ログ書き込みヘルパー (P4)
//
// 設計ドキュメント (admin_and_auth_design.md §6.8) では、AuditLog は
// `action` / `targetType` / `targetId` / `payload` / `companyId` /
// `ipAddress` / `userAgent` のフィールドを持つ想定。
//
// しかし既存の `AuditLog` テーブル (prisma/schema.prisma) は次のフィールド:
//   tableName, recordId, operation, userId, beforeData, afterData, reason
//
// 既存テーブル/マイグレーションを壊さないため、本ヘルパーで両概念を
// 橋渡しする。設計概念 → 既存カラムのマッピングは以下:
//
//   action      → operation             (例: "user.invite")
//   targetType  → tableName             (例: "User")
//   targetId    → recordId
//   payload     → afterData (JSON)
//   companyId   → afterData.__companyId 内に格納 (既存に列が無いため)
//   ipAddress   → afterData.__ipAddress
//   userAgent   → afterData.__userAgent
//   reason      → reason
//
// 将来的に AuditLog にカラムを追加するか、別テーブルに移行した場合でも、
// この `recordAudit` を呼び出している側のコードは変更不要。
//
// TODO(P2/P3/P5/P9): 各 server action から本ヘルパーを呼び出し、
// 以下のアクションを記録する:
//   - user.invite / user.role_change / user.deactivate / user.reset_password
//   - company.create / company.application_review
//   - transaction.confirm / transaction.delete
//   - month.lock / month.unlock
//   - password.reset_requested / password.reset_completed
//   - pwdx.integration_change / pwdx.sync_executed
// ============================================================

import { prisma } from "./prisma"
import type { Prisma } from "@prisma/client"

export type RecordAuditInput = {
  userId: string
  companyId?: string | null
  action: string
  targetType: string
  targetId: string
  payload?: Record<string, unknown> | null
  reason?: string | null
  ipAddress?: string | null
  userAgent?: string | null
  /**
   * 互換オプション: 変更前のデータがあれば beforeData カラムにそのまま保存。
   * 既存 createAuditLog 利用箇所のスムーズな移行用。
   */
  before?: Record<string, unknown> | null
}

/**
 * 監査ログを書き込む。
 *
 * - 設計上の概念（action / targetType / targetId / payload / companyId / ipAddress / userAgent）
 *   を、既存 AuditLog テーブルのカラムに正しくマッピングする。
 * - payload には companyId / ipAddress / userAgent を `__` プレフィックスで埋め込み、
 *   後方互換を維持しつつコンテキスト情報を保存する。
 * - 失敗してもアプリ全体を落とさないため、エラーは握りつぶして console に出力する。
 *   （監査ログの欠落 < ビジネスロジックの停止）
 */
export async function recordAudit(input: RecordAuditInput): Promise<void> {
  const payloadObj: Record<string, unknown> = { ...(input.payload ?? {}) }
  if (input.companyId != null) {
    payloadObj.__companyId = input.companyId
  }
  if (input.ipAddress != null) {
    payloadObj.__ipAddress = input.ipAddress
  }
  if (input.userAgent != null) {
    payloadObj.__userAgent = input.userAgent
  }

  const hasPayloadKeys = Object.keys(payloadObj).length > 0
  const hasBefore = input.before != null && Object.keys(input.before).length > 0

  try {
    await prisma.auditLog.create({
      data: {
        tableName: input.targetType,
        recordId: input.targetId,
        operation: input.action,
        userId: input.userId,
        beforeData: hasBefore
          ? (input.before as Prisma.InputJsonValue)
          : undefined,
        afterData: hasPayloadKeys
          ? (payloadObj as Prisma.InputJsonValue)
          : undefined,
        reason: input.reason ?? undefined,
      },
    })
  } catch (err) {
    // 監査ログ書き込み失敗で業務処理を止めない
    console.error("[recordAudit] failed to write audit log:", err)
  }
}

// ============================================================
// 既存 AuditLog 行から設計概念へのデコード
// ============================================================

export type DecodedAuditLog = {
  id: string
  createdAt: Date
  userId: string
  action: string
  targetType: string
  targetId: string
  companyId: string | null
  payload: Record<string, unknown> | null
  before: Record<string, unknown> | null
  reason: string | null
  ipAddress: string | null
  userAgent: string | null
}

/**
 * `prisma.auditLog.findMany` で取得した生レコードを、設計概念のフィールド
 * 名に正規化する。`afterData` の `__companyId` / `__ipAddress` / `__userAgent`
 * を取り出して、payload 本体からは除外する。
 */
export function decodeAuditLog(row: {
  id: string
  timestamp: Date
  userId: string
  operation: string
  tableName: string
  recordId: string
  beforeData: unknown
  afterData: unknown
  reason: string | null
}): DecodedAuditLog {
  const after = isJsonObject(row.afterData) ? { ...row.afterData } : null
  const before = isJsonObject(row.beforeData) ? { ...row.beforeData } : null

  let companyId: string | null = null
  let ipAddress: string | null = null
  let userAgent: string | null = null

  if (after) {
    if (typeof after.__companyId === "string") {
      companyId = after.__companyId
      delete after.__companyId
    }
    if (typeof after.__ipAddress === "string") {
      ipAddress = after.__ipAddress
      delete after.__ipAddress
    }
    if (typeof after.__userAgent === "string") {
      userAgent = after.__userAgent
      delete after.__userAgent
    }
  }

  return {
    id: row.id,
    createdAt: row.timestamp,
    userId: row.userId,
    action: row.operation,
    targetType: row.tableName,
    targetId: row.recordId,
    companyId,
    payload: after && Object.keys(after).length > 0 ? after : null,
    before: before && Object.keys(before).length > 0 ? before : null,
    reason: row.reason,
    ipAddress,
    userAgent,
  }
}

function isJsonObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v)
}
