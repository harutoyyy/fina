// ============================================================
// サーバーサイド認証ユーティリティ
// Phase 1: ScopeRole / SessionContext / requireRole / hasPermission を追加
// 出典: docs/admin_phase1_implementation.md §7.1
// ============================================================

import { auth } from "./auth"
import { headers } from "next/headers"
import { prisma } from "./prisma"

// ---------- セッション ----------

export async function getServerSession() {
  const session = await auth.api.getSession({
    headers: await headers(),
  })
  return session
}

export async function requireSession() {
  const session = await getServerSession()
  if (!session) {
    throw new Error("Unauthorized")
  }
  return session
}

// ---------- ロール / 権限 ----------

export type ScopeRole = "SUPER_ADMIN" | "COMPANY_ADMIN" | "OPERATOR" | "VIEWER"

export type SessionContext = {
  userId: string
  profileId: string
  scopeRole: ScopeRole
  displayName: string
  primaryCompanyId: string | null
  assignedCompanyIds: string[]
  templateKey: string | null
  isActive: boolean
}

/**
 * セッション + UserProfile を取得し、コンテキストとして返す。
 * 非アクティブまたはプロファイル不在の場合は Forbidden を投げる。
 */
export async function getSessionContext(): Promise<SessionContext> {
  const session = await requireSession()
  const profile = await prisma.userProfile.findUnique({
    where: { authUserId: session.user.id },
  })
  if (!profile) {
    throw new Error("Forbidden: profile not found")
  }
  if (!profile.isActive) {
    throw new Error("Forbidden: profile is inactive")
  }
  return {
    userId: session.user.id,
    profileId: profile.id,
    scopeRole: profile.scopeRole as ScopeRole,
    displayName: profile.displayName,
    primaryCompanyId: profile.primaryCompanyId,
    assignedCompanyIds: profile.assignedCompanyIds,
    templateKey: profile.templateKey,
    isActive: profile.isActive,
  }
}

/**
 * 指定ロールのいずれかを持つことを要求する。
 */
export async function requireRole(...allowed: ScopeRole[]): Promise<SessionContext> {
  const ctx = await getSessionContext()
  if (!allowed.includes(ctx.scopeRole)) {
    throw new Error(`Forbidden: requires ${allowed.join(" or ")}`)
  }
  return ctx
}

/**
 * SUPER_ADMIN のみ許可。
 */
export async function requireSuperAdmin() {
  return requireRole("SUPER_ADMIN")
}

/**
 * SUPER_ADMIN または COMPANY_ADMIN を許可。
 * 既存の `requireAdmin` の置き換え。
 */
export async function requireCompanyAdmin() {
  return requireRole("SUPER_ADMIN", "COMPANY_ADMIN")
}

/**
 * 細かい権限 (permissions テンプレ準拠) のチェック。
 * - SUPER_ADMIN は全許可
 * - COMPANY_ADMIN は自社内で全許可 (v1 ではテンプレ不問)
 * - OPERATOR / VIEWER は templateKey 経由で permissions 配列を参照
 */
export async function hasPermission(
  ctx: SessionContext,
  permission: string,
): Promise<boolean> {
  if (ctx.scopeRole === "SUPER_ADMIN") return true
  if (ctx.scopeRole === "COMPANY_ADMIN") return true
  if (!ctx.templateKey) return false

  const template = await prisma.permissionTemplate.findUnique({
    where: { key: ctx.templateKey },
  })
  if (!template) return false

  const perms = Array.isArray(template.permissions)
    ? (template.permissions as unknown as string[])
    : []
  return perms.includes(permission)
}

/**
 * permission を満たさない場合は Forbidden を投げる。
 */
export async function requirePermission(permission: string): Promise<SessionContext> {
  const ctx = await getSessionContext()
  const ok = await hasPermission(ctx, permission)
  if (!ok) {
    throw new Error(`Forbidden: missing permission "${permission}"`)
  }
  return ctx
}
