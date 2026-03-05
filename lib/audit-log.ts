import { prisma } from "./prisma"
import type { Prisma } from "@prisma/client"

export type AuditOperation =
  | "CREATE"
  | "UPDATE"
  | "DELETE"
  | "CONFIRM"
  | "UNCONFIRM"
  | "MONTH_CLOSE"
  | "MONTH_REOPEN"

export async function createAuditLog(params: {
  tableName: string
  recordId: string
  operation: AuditOperation
  userId: string
  beforeData?: Record<string, unknown> | null
  afterData?: Record<string, unknown> | null
  reason?: string
}) {
  return prisma.auditLog.create({
    data: {
      tableName: params.tableName,
      recordId: params.recordId,
      operation: params.operation,
      userId: params.userId,
      beforeData: params.beforeData ? (params.beforeData as Prisma.InputJsonValue) : undefined,
      afterData: params.afterData ? (params.afterData as Prisma.InputJsonValue) : undefined,
      reason: params.reason,
    },
  })
}

export async function getAuditLogs(params: {
  tableName?: string
  recordId?: string
  userId?: string
  limit?: number
  offset?: number
}) {
  return prisma.auditLog.findMany({
    where: {
      ...(params.tableName && { tableName: params.tableName }),
      ...(params.recordId && { recordId: params.recordId }),
      ...(params.userId && { userId: params.userId }),
    },
    orderBy: { timestamp: "desc" },
    take: params.limit ?? 50,
    skip: params.offset ?? 0,
  })
}

export async function getAuditLogsForRecord(tableName: string, recordId: string) {
  return prisma.auditLog.findMany({
    where: { tableName, recordId },
    orderBy: { timestamp: "desc" },
  })
}
