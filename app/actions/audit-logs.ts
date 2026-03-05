"use server"

import { prisma } from "@/lib/prisma"
import { requireSession } from "@/lib/auth-server"

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
