"use server"

// ============================================================
// ユーザー管理 (Phase 3)
// 出典: docs/admin_and_auth_design.md §10.2.1
// 担当: P3 Agent
// ============================================================

import { prisma } from "@/lib/prisma"
import {
  requireCompanyAdmin,
  requireSession,
  type ScopeRole,
} from "@/lib/auth-server"
import { revalidatePath } from "next/cache"
import { randomBytes, createHash } from "node:crypto"
import { sendPasswordResetByAdmin } from "@/lib/mail"

const RESET_TOKEN_TTL_MS = 30 * 60 * 1000 // 30 分

// ---------- 共通ユーティリティ ----------

function assertCompanyAccess(
  ctx: { scopeRole: ScopeRole; primaryCompanyId: string | null; assignedCompanyIds: string[] },
  targetCompanyId: string | null,
) {
  if (ctx.scopeRole === "SUPER_ADMIN") return
  if (!targetCompanyId) {
    throw new Error("Forbidden: 対象ユーザーに会社が割当てられていません")
  }
  const allowed = new Set<string>(
    [ctx.primaryCompanyId, ...(ctx.assignedCompanyIds ?? [])].filter(Boolean) as string[],
  )
  if (!allowed.has(targetCompanyId)) {
    throw new Error("Forbidden: company out of scope")
  }
}

function buildResetUrl(token: string): string {
  const base =
    process.env.BETTER_AUTH_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined) ||
    "http://localhost:3003"
  return `${base.replace(/\/$/, "")}/reset-password?token=${encodeURIComponent(token)}`
}

/**
 * 同一会社の COMPANY_ADMIN が他にいるかチェック。
 * 削除・無効化・降格時のガード用。
 */
async function isLastCompanyAdmin(profileId: string, companyId: string): Promise<boolean> {
  const others = await prisma.userProfile.count({
    where: {
      id: { not: profileId },
      scopeRole: "COMPANY_ADMIN",
      primaryCompanyId: companyId,
      isActive: true,
    },
  })
  return others === 0
}

// ---------- listUsers ----------

export type UserListItem = {
  id: string // UserProfile.id
  authUserId: string // User.id (better-auth)
  email: string | null
  displayName: string
  scopeRole: ScopeRole
  authProvider: "LOCAL" | "PWDX_OIDC"
  externalSub: string | null
  templateKey: string | null
  templateName: string | null
  primaryCompanyId: string | null
  primaryCompanyName: string | null
  isActive: boolean
  mustChangePassword: boolean
  lastLoginAt: string | null
}

/**
 * ユーザー一覧
 * - SUPER_ADMIN: 全社のユーザー
 * - COMPANY_ADMIN: 自社のみ
 */
export async function listUsers(filters?: {
  scopeRole?: ScopeRole | "ALL"
  authProvider?: "LOCAL" | "PWDX_OIDC" | "ALL"
  isActive?: "ACTIVE" | "INACTIVE" | "ALL"
  search?: string
  companyId?: string
}): Promise<UserListItem[]> {
  const ctx = await requireCompanyAdmin()

  const where: Record<string, unknown> = {}

  if (filters?.scopeRole && filters.scopeRole !== "ALL") {
    where.scopeRole = filters.scopeRole
  }
  if (filters?.authProvider && filters.authProvider !== "ALL") {
    where.authProvider = filters.authProvider
  }
  if (filters?.isActive === "ACTIVE") {
    where.isActive = true
  } else if (filters?.isActive === "INACTIVE") {
    where.isActive = false
  }

  if (ctx.scopeRole !== "SUPER_ADMIN") {
    const companyIds = Array.from(
      new Set(
        [ctx.primaryCompanyId, ...(ctx.assignedCompanyIds ?? [])].filter(Boolean) as string[],
      ),
    )
    if (companyIds.length === 0) return []
    where.primaryCompanyId = { in: companyIds }
  } else if (filters?.companyId) {
    where.primaryCompanyId = filters.companyId
  }

  if (filters?.search?.trim()) {
    const q = filters.search.trim()
    where.OR = [
      { displayName: { contains: q, mode: "insensitive" } },
      { user: { email: { contains: q, mode: "insensitive" } } },
    ]
  }

  const profiles = await prisma.userProfile.findMany({
    where,
    orderBy: [{ isActive: "desc" }, { displayName: "asc" }],
    include: {
      user: { select: { id: true, email: true } },
      template: { select: { key: true, name: true } },
      primaryCompany: { select: { id: true, name: true } },
    },
  })

  return profiles.map((p) => ({
    id: p.id,
    authUserId: p.authUserId,
    email: p.user?.email ?? null,
    displayName: p.displayName,
    scopeRole: p.scopeRole as ScopeRole,
    authProvider: p.authProvider,
    externalSub: p.externalSub,
    templateKey: p.templateKey,
    templateName: p.template?.name ?? null,
    primaryCompanyId: p.primaryCompanyId,
    primaryCompanyName: p.primaryCompany?.name ?? null,
    isActive: p.isActive,
    mustChangePassword: p.mustChangePassword,
    lastLoginAt: p.lastLoginAt?.toISOString() ?? null,
  }))
}

// ---------- getUserDetail ----------

export type UserDetail = UserListItem & {
  assignedCompanyIds: string[]
  assignedCompanies: Array<{ id: string; name: string }>
  createdAt: string
  updatedAt: string
}

export async function getUserDetail(profileId: string): Promise<UserDetail | null> {
  const ctx = await requireCompanyAdmin()

  const p = await prisma.userProfile.findUnique({
    where: { id: profileId },
    include: {
      user: { select: { id: true, email: true } },
      template: { select: { key: true, name: true } },
      primaryCompany: { select: { id: true, name: true } },
    },
  })
  if (!p) return null

  // 自社のみアクセス可
  assertCompanyAccess(ctx, p.primaryCompanyId)

  // 割当会社の一覧を解決
  const assignedIds = p.assignedCompanyIds ?? []
  const assignedCompanies =
    assignedIds.length > 0
      ? await prisma.company.findMany({
          where: { id: { in: assignedIds } },
          select: { id: true, name: true },
          orderBy: { displayOrder: "asc" },
        })
      : []

  return {
    id: p.id,
    authUserId: p.authUserId,
    email: p.user?.email ?? null,
    displayName: p.displayName,
    scopeRole: p.scopeRole as ScopeRole,
    authProvider: p.authProvider,
    externalSub: p.externalSub,
    templateKey: p.templateKey,
    templateName: p.template?.name ?? null,
    primaryCompanyId: p.primaryCompanyId,
    primaryCompanyName: p.primaryCompany?.name ?? null,
    isActive: p.isActive,
    mustChangePassword: p.mustChangePassword,
    lastLoginAt: p.lastLoginAt?.toISOString() ?? null,
    assignedCompanyIds: assignedIds,
    assignedCompanies,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  }
}

// ---------- updateUserRole ----------

/**
 * スコープロールを変更する。
 * - COMPANY_ADMIN: OPERATOR / VIEWER 間の変更のみ可
 * - SUPER_ADMIN: 任意のロールに変更可
 * - 自分自身のロールは変えられない
 * - 最後の COMPANY_ADMIN を降格しようとした場合はエラー
 */
export async function updateUserRole(
  profileId: string,
  newRole: ScopeRole,
): Promise<{ ok: true }> {
  const ctx = await requireCompanyAdmin()

  const target = await prisma.userProfile.findUnique({ where: { id: profileId } })
  if (!target) throw new Error("ユーザーが見つかりません")
  assertCompanyAccess(ctx, target.primaryCompanyId)

  if (target.id === ctx.profileId) {
    throw new Error("自分自身のロールは変更できません")
  }

  // COMPANY_ADMIN の権限制限: 昇格 (COMPANY_ADMIN / SUPER_ADMIN) は不可
  if (ctx.scopeRole === "COMPANY_ADMIN") {
    if (newRole === "SUPER_ADMIN") {
      throw new Error("SUPER_ADMIN への昇格は SUPER_ADMIN のみが行えます")
    }
    if (newRole === "COMPANY_ADMIN") {
      throw new Error("COMPANY_ADMIN への昇格は SUPER_ADMIN のみが行えます")
    }
    // 対象が COMPANY_ADMIN の場合の降格も SUPER_ADMIN のみ
    if (target.scopeRole === "COMPANY_ADMIN") {
      throw new Error("COMPANY_ADMIN の降格は SUPER_ADMIN のみが行えます")
    }
    if (target.scopeRole === "SUPER_ADMIN") {
      throw new Error("SUPER_ADMIN の変更は SUPER_ADMIN のみが行えます")
    }
  }

  // 最後の COMPANY_ADMIN ガード (降格)
  if (target.scopeRole === "COMPANY_ADMIN" && newRole !== "COMPANY_ADMIN" && target.primaryCompanyId) {
    if (await isLastCompanyAdmin(target.id, target.primaryCompanyId)) {
      throw new Error("会社に COMPANY_ADMIN が他にいないため、降格できません")
    }
  }

  await prisma.userProfile.update({
    where: { id: profileId },
    data: { scopeRole: newRole },
  })

  revalidatePath("/admin/users")
  revalidatePath(`/admin/users/${profileId}`)
  return { ok: true }
}

// ---------- updateUserTemplate ----------

export async function updateUserTemplate(
  profileId: string,
  templateKey: string | null,
): Promise<{ ok: true }> {
  const ctx = await requireCompanyAdmin()

  const target = await prisma.userProfile.findUnique({ where: { id: profileId } })
  if (!target) throw new Error("ユーザーが見つかりません")
  assertCompanyAccess(ctx, target.primaryCompanyId)

  if (templateKey) {
    const tpl = await prisma.permissionTemplate.findUnique({
      where: { key: templateKey },
    })
    if (!tpl) throw new Error("指定された権限テンプレートが見つかりません")
  }

  await prisma.userProfile.update({
    where: { id: profileId },
    data: { templateKey },
  })

  revalidatePath("/admin/users")
  revalidatePath(`/admin/users/${profileId}`)
  return { ok: true }
}

// ---------- deactivateUser / reactivateUser ----------

export async function deactivateUser(profileId: string): Promise<{ ok: true }> {
  const ctx = await requireCompanyAdmin()

  const target = await prisma.userProfile.findUnique({ where: { id: profileId } })
  if (!target) throw new Error("ユーザーが見つかりません")
  assertCompanyAccess(ctx, target.primaryCompanyId)

  if (target.id === ctx.profileId) {
    throw new Error("自分自身を無効化することはできません")
  }

  if (target.scopeRole === "SUPER_ADMIN" && ctx.scopeRole !== "SUPER_ADMIN") {
    throw new Error("SUPER_ADMIN の無効化は SUPER_ADMIN のみが行えます")
  }
  if (target.scopeRole === "COMPANY_ADMIN" && ctx.scopeRole !== "SUPER_ADMIN") {
    throw new Error("COMPANY_ADMIN の無効化は SUPER_ADMIN のみが行えます")
  }

  // 最後の COMPANY_ADMIN ガード
  if (target.scopeRole === "COMPANY_ADMIN" && target.primaryCompanyId) {
    if (await isLastCompanyAdmin(target.id, target.primaryCompanyId)) {
      throw new Error("会社に COMPANY_ADMIN が他にいないため、無効化できません")
    }
  }

  await prisma.userProfile.update({
    where: { id: profileId },
    data: { isActive: false },
  })

  revalidatePath("/admin/users")
  revalidatePath(`/admin/users/${profileId}`)
  return { ok: true }
}

export async function reactivateUser(profileId: string): Promise<{ ok: true }> {
  const ctx = await requireCompanyAdmin()
  const target = await prisma.userProfile.findUnique({ where: { id: profileId } })
  if (!target) throw new Error("ユーザーが見つかりません")
  assertCompanyAccess(ctx, target.primaryCompanyId)

  await prisma.userProfile.update({
    where: { id: profileId },
    data: { isActive: true },
  })

  revalidatePath("/admin/users")
  revalidatePath(`/admin/users/${profileId}`)
  return { ok: true }
}

// ---------- adminResetPassword ----------

/**
 * 管理者代行パスワードリセット
 * - 対象は LOCAL ユーザーのみ
 * - PasswordResetToken を発行し、対象ユーザーへメール送信
 * - DB には SHA-256 ハッシュのみ保存
 */
export async function adminResetPassword(
  profileId: string,
): Promise<{ ok: true; resetUrl: string }> {
  const ctx = await requireCompanyAdmin()

  const target = await prisma.userProfile.findUnique({
    where: { id: profileId },
    include: { user: { select: { id: true, email: true } } },
  })
  if (!target) throw new Error("ユーザーが見つかりません")
  assertCompanyAccess(ctx, target.primaryCompanyId)

  if (target.authProvider !== "LOCAL") {
    throw new Error("PWDX 認証ユーザーのパスワードリセットは PWDX 側で実施してください")
  }
  if (!target.user?.email) {
    throw new Error("対象ユーザーにメールアドレスがありません")
  }

  // 生トークン (32 byte = 64 hex)
  const rawToken = randomBytes(32).toString("hex")
  const tokenHash = createHash("sha256").update(rawToken).digest("hex")
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS)

  await prisma.passwordResetToken.create({
    data: {
      userId: target.user.id,
      tokenHash,
      expiresAt,
      requestedBy: ctx.profileId,
    },
  })

  const resetUrl = buildResetUrl(rawToken)

  await sendPasswordResetByAdmin({
    to: target.user.email,
    displayName: target.displayName,
    resetUrl,
    expiresAtIso: expiresAt.toISOString(),
    requestedByName: ctx.displayName,
  })

  return { ok: true, resetUrl }
}

// ---------- getPermissionTemplates (招待画面用) ----------

export async function getPermissionTemplates() {
  await requireCompanyAdmin()
  return prisma.permissionTemplate.findMany({
    orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    select: { key: true, name: true, description: true },
  })
}

// ---------- getCompaniesForAdmin (招待画面用 / ユーザー一覧フィルタ用) ----------

/**
 * 管理者の権限スコープ内の会社一覧を返す。
 * COMPANY_ADMIN: 自社のみ
 * SUPER_ADMIN: 全社
 */
export async function getCompaniesForAdmin() {
  const ctx = await requireCompanyAdmin()

  if (ctx.scopeRole === "SUPER_ADMIN") {
    return prisma.company.findMany({
      orderBy: { displayOrder: "asc" },
      select: { id: true, name: true, shortName: true },
    })
  }

  const ids = Array.from(
    new Set(
      [ctx.primaryCompanyId, ...(ctx.assignedCompanyIds ?? [])].filter(Boolean) as string[],
    ),
  )
  if (ids.length === 0) return []

  return prisma.company.findMany({
    where: { id: { in: ids } },
    orderBy: { displayOrder: "asc" },
    select: { id: true, name: true, shortName: true },
  })
}

// ---------- changeMyPassword (mustChangePassword フロー用) ----------

/**
 * 自分自身のパスワードを変更し、mustChangePassword を false にする。
 * 初回ログイン時の強制変更画面から呼ばれる。
 */
export async function changeMyPassword(input: {
  currentPassword: string
  newPassword: string
}): Promise<{ ok: true }> {
  const session = await requireSession()
  const userId = session.user.id

  if (input.newPassword.length < 8) {
    throw new Error("新しいパスワードは 8 文字以上である必要があります")
  }
  if (input.currentPassword === input.newPassword) {
    throw new Error("新しいパスワードは現在のものと異なる必要があります")
  }

  const { verifyPassword, hashPassword } = await import("better-auth/crypto")

  // 現在のパスワード検証
  const account = await prisma.authAccount.findFirst({
    where: { userId, providerId: "credential" },
  })
  if (!account?.password) {
    throw new Error("認証情報が見つかりません")
  }
  const ok = await verifyPassword({
    hash: account.password,
    password: input.currentPassword,
  })
  if (!ok) {
    throw new Error("現在のパスワードが正しくありません")
  }

  const newHash = await hashPassword(input.newPassword)

  await prisma.$transaction(async (tx) => {
    await tx.authAccount.update({
      where: { id: account.id },
      data: { password: newHash, updatedAt: new Date() },
    })
    await tx.userProfile.updateMany({
      where: { authUserId: userId },
      data: { mustChangePassword: false },
    })
  })

  return { ok: true }
}
