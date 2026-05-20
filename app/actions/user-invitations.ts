"use server"

// ============================================================
// ユーザー招待 (Phase 3)
// 出典: docs/admin_and_auth_design.md §6.3, §8.2, §8.3, §8.5
// 担当: P3 Agent
// 関連: lib/mail.ts (招待メール)
// ============================================================

import { prisma } from "@/lib/prisma"
import { requireCompanyAdmin, type ScopeRole } from "@/lib/auth-server"
import { hashPassword } from "better-auth/crypto"
import { randomBytes } from "node:crypto"
import { revalidatePath } from "next/cache"
import {
  sendUserInvitation,
  resendUserInvitation as sendResendInvitation,
} from "@/lib/mail"
import type { InvitationStatus } from "@prisma/client"

// ---------- 設定値 ----------

const DEFAULT_INVITATION_DAYS = 14
const INITIAL_PASSWORD_LENGTH = 12

// ---------- ユーティリティ ----------

/**
 * 初期パスワード生成 (12 文字、英大小+数字+記号混在)。
 * 設計の `16 文字` ガイダンスより短いが、UX (口頭/メール伝達) を考慮した妥協値。
 * TODO(P2/P6): 設定で長さを調整できるようにする
 */
function generateInitialPassword(length = INITIAL_PASSWORD_LENGTH): string {
  const upper = "ABCDEFGHJKMNPQRSTUVWXYZ" // 紛らわしい I, L, O を除く
  const lower = "abcdefghjkmnpqrstuvwxyz"
  const digit = "23456789"
  const symbol = "!@#$%&*+?"
  const all = upper + lower + digit + symbol

  // 各カテゴリから最低 1 文字を確保
  const required = [
    upper[randomBytes(1)[0] % upper.length],
    lower[randomBytes(1)[0] % lower.length],
    digit[randomBytes(1)[0] % digit.length],
    symbol[randomBytes(1)[0] % symbol.length],
  ]
  const rest: string[] = []
  for (let i = 0; i < length - required.length; i++) {
    rest.push(all[randomBytes(1)[0] % all.length])
  }
  // シャッフル
  const arr = [...required, ...rest]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randomBytes(1)[0] % (i + 1)
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr.join("")
}

/**
 * セッションコンテキストの会社境界チェック。
 * SUPER_ADMIN は全社、COMPANY_ADMIN は primaryCompanyId / assignedCompanyIds 内の会社のみ。
 */
function assertCompanyAccess(
  ctx: { scopeRole: ScopeRole; primaryCompanyId: string | null; assignedCompanyIds: string[] },
  companyId: string,
) {
  if (ctx.scopeRole === "SUPER_ADMIN") return
  const allowed = new Set<string>(
    [ctx.primaryCompanyId, ...(ctx.assignedCompanyIds ?? [])].filter(Boolean) as string[],
  )
  if (!allowed.has(companyId)) {
    throw new Error("Forbidden: company out of scope")
  }
}

/**
 * 招待リンク URL を組み立てる。
 * BETTER_AUTH_URL もしくは VERCEL_URL を優先。なければ localhost:3003。
 */
function buildInviteUrl(token: string): string {
  const base =
    process.env.BETTER_AUTH_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined) ||
    "http://localhost:3003"
  return `${base.replace(/\/$/, "")}/accept?token=${encodeURIComponent(token)}`
}

// ---------- listInvitations ----------

export type InvitationListItem = {
  id: string
  authProvider: "LOCAL" | "PWDX_OIDC"
  scopeRole: ScopeRole
  templateKey: string | null
  templateName: string | null
  companyId: string
  companyName: string | null
  displayName: string
  email: string | null
  externalSub: string | null
  externalUserId: string | null
  invitedAt: string
  expiresAt: string
  status: InvitationStatus
  inviterDisplayName: string | null
}

/**
 * 招待状一覧 (自社のみ。SUPER_ADMIN は全社)
 */
export async function listInvitations(filters?: {
  status?: InvitationStatus | "ALL"
  companyId?: string
}): Promise<InvitationListItem[]> {
  const ctx = await requireCompanyAdmin()

  const where: Record<string, unknown> = {}

  if (filters?.status && filters.status !== "ALL") {
    where.status = filters.status
  }

  if (ctx.scopeRole !== "SUPER_ADMIN") {
    const companyIds = Array.from(
      new Set(
        [ctx.primaryCompanyId, ...(ctx.assignedCompanyIds ?? [])].filter(Boolean) as string[],
      ),
    )
    if (companyIds.length === 0) return []
    where.companyId = { in: companyIds }
  } else if (filters?.companyId) {
    where.companyId = filters.companyId
  }

  const invitations = await prisma.userInvitation.findMany({
    where,
    orderBy: { invitedAt: "desc" },
    include: {
      template: { select: { key: true, name: true } },
      inviter: { select: { displayName: true } },
    },
  })

  // 会社名解決
  const companyIds = Array.from(new Set(invitations.map((i) => i.companyId)))
  const companies = await prisma.company.findMany({
    where: { id: { in: companyIds } },
    select: { id: true, name: true },
  })
  const companyMap = new Map(companies.map((c) => [c.id, c.name]))

  return invitations.map((inv) => ({
    id: inv.id,
    authProvider: inv.authProvider,
    scopeRole: inv.scopeRole as ScopeRole,
    templateKey: inv.templateKey,
    templateName: inv.template?.name ?? null,
    companyId: inv.companyId,
    companyName: companyMap.get(inv.companyId) ?? null,
    displayName: inv.displayName,
    email: inv.email,
    externalSub: inv.externalSub,
    externalUserId: inv.externalUserId,
    invitedAt: inv.invitedAt.toISOString(),
    expiresAt: inv.expiresAt.toISOString(),
    status: inv.status,
    inviterDisplayName: inv.inviter?.displayName ?? null,
  }))
}

// ---------- createInvitation ----------

export type CreateInvitationInput = {
  companyId: string
  email: string
  displayName: string
  scopeRole: "OPERATOR" | "VIEWER" // COMPANY_ADMIN への昇格は SUPER_ADMIN のみ
  templateKey: string
  customInitialPassword?: string // 手動指定時
  expiresInDays?: number
}

export type CreateInvitationResult = {
  id: string
  inviteUrl: string
  initialPassword: string // 管理者画面で初期パスを 1 度だけ表示するため返す
}

/**
 * LOCAL 招待状を作成する。
 * - COMPANY_ADMIN は自社のみ。SUPER_ADMIN は全社
 * - scopeRole は OPERATOR / VIEWER のみ (COMPANY_ADMIN 昇格は SUPER_ADMIN のみが別アクションで実施)
 * - 初期パスワードは自動生成 (12 文字)。手動指定可
 * - email が既存 User / 既存 PENDING 招待にあるならエラー
 */
export async function createInvitation(input: CreateInvitationInput): Promise<CreateInvitationResult> {
  const ctx = await requireCompanyAdmin()

  // バリデーション
  const email = input.email.trim().toLowerCase()
  if (!email || !/.+@.+\..+/.test(email)) {
    throw new Error("メールアドレスの形式が不正です")
  }
  if (!input.displayName.trim()) {
    throw new Error("表示名は必須です")
  }
  if (input.scopeRole !== "OPERATOR" && input.scopeRole !== "VIEWER") {
    throw new Error("招待時に指定できるスコープは OPERATOR / VIEWER のみです")
  }

  assertCompanyAccess(ctx, input.companyId)

  // テンプレ存在チェック
  const template = await prisma.permissionTemplate.findUnique({
    where: { key: input.templateKey },
  })
  if (!template) {
    throw new Error("指定された権限テンプレートが見つかりません")
  }

  // 重複チェック
  const existingUser = await prisma.user.findUnique({ where: { email } })
  if (existingUser) {
    throw new Error("このメールアドレスは既にユーザー登録済みです")
  }
  const existingPending = await prisma.userInvitation.findFirst({
    where: { email, status: "PENDING" },
  })
  if (existingPending) {
    throw new Error("このメールアドレス宛の招待が既に発行されています")
  }

  // 会社情報取得 (メール本文用)
  const company = await prisma.company.findUnique({
    where: { id: input.companyId },
    select: { name: true },
  })
  if (!company) {
    throw new Error("指定された会社が見つかりません")
  }

  // 初期パスワード生成 + ハッシュ
  const rawPassword = input.customInitialPassword?.trim() || generateInitialPassword()
  if (rawPassword.length < 8) {
    throw new Error("初期パスワードは 8 文字以上である必要があります")
  }
  const hashed = await hashPassword(rawPassword)

  const expiresInDays = input.expiresInDays ?? DEFAULT_INVITATION_DAYS
  const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)

  // 招待状作成 (id は token として URL に乗せる)
  const invitation = await prisma.userInvitation.create({
    data: {
      authProvider: "LOCAL",
      scopeRole: input.scopeRole,
      templateKey: input.templateKey,
      companyId: input.companyId,
      displayName: input.displayName.trim(),
      email,
      initialPasswordHash: hashed,
      initialPasswordHint: rawPassword.slice(0, 2) + "***", // 表示用ヒント (運用補助)
      invitedBy: ctx.profileId,
      expiresAt,
      status: "PENDING",
    },
  })

  const inviteUrl = buildInviteUrl(invitation.id)

  // メール送信
  await sendUserInvitation({
    to: email,
    displayName: invitation.displayName,
    companyName: company.name,
    inviteUrl,
    initialPassword: rawPassword,
    expiresAtIso: expiresAt.toISOString(),
    invitedByName: ctx.displayName,
  })

  revalidatePath("/admin/users")
  revalidatePath("/admin/invitations")

  return {
    id: invitation.id,
    inviteUrl,
    initialPassword: rawPassword,
  }
}

// ---------- resendInvitation ----------

/**
 * 招待状を再送する。
 * - PENDING のみ可
 * - 初期パスワードは再生成し、メールに新しいパスを載せる
 * - 有効期限も延長する
 */
export async function resendInvitation(invitationId: string): Promise<{ ok: true }> {
  const ctx = await requireCompanyAdmin()

  const invitation = await prisma.userInvitation.findUnique({
    where: { id: invitationId },
  })
  if (!invitation) throw new Error("招待状が見つかりません")
  if (invitation.status !== "PENDING") {
    throw new Error("PENDING でない招待状は再送できません")
  }
  if (invitation.authProvider !== "LOCAL") {
    throw new Error("LOCAL 以外の招待は P8 以降の対応です")
  }
  if (!invitation.email) {
    throw new Error("LOCAL 招待にメールアドレスが設定されていません")
  }

  assertCompanyAccess(ctx, invitation.companyId)

  const company = await prisma.company.findUnique({
    where: { id: invitation.companyId },
    select: { name: true },
  })
  if (!company) throw new Error("会社情報が見つかりません")

  // 新パスワード生成
  const rawPassword = generateInitialPassword()
  const hashed = await hashPassword(rawPassword)
  const expiresAt = new Date(Date.now() + DEFAULT_INVITATION_DAYS * 24 * 60 * 60 * 1000)

  await prisma.userInvitation.update({
    where: { id: invitationId },
    data: {
      initialPasswordHash: hashed,
      initialPasswordHint: rawPassword.slice(0, 2) + "***",
      expiresAt,
    },
  })

  const inviteUrl = buildInviteUrl(invitationId)

  await sendResendInvitation({
    to: invitation.email,
    displayName: invitation.displayName,
    companyName: company.name,
    inviteUrl,
    initialPassword: rawPassword,
    expiresAtIso: expiresAt.toISOString(),
    invitedByName: ctx.displayName,
  })

  revalidatePath("/admin/invitations")
  return { ok: true }
}

// ---------- revokeInvitation ----------

/**
 * 招待状を取消す (PENDING のみ)
 */
export async function revokeInvitation(invitationId: string): Promise<{ ok: true }> {
  const ctx = await requireCompanyAdmin()

  const invitation = await prisma.userInvitation.findUnique({
    where: { id: invitationId },
  })
  if (!invitation) throw new Error("招待状が見つかりません")
  if (invitation.status !== "PENDING") {
    throw new Error("PENDING でない招待状は取消できません")
  }

  assertCompanyAccess(ctx, invitation.companyId)

  await prisma.userInvitation.update({
    where: { id: invitationId },
    data: { status: "REVOKED" },
  })

  revalidatePath("/admin/invitations")
  revalidatePath("/admin/users")
  return { ok: true }
}

// ---------- expireOldInvitations (cron 用) ----------

/**
 * 期限切れ PENDING 招待を EXPIRED に変更する。
 * Phase 3 では cron は組まないが、手動 / 将来用に関数を提供。
 * TODO(P4): Vercel Cron / pg_cron などで日次起動する
 */
export async function expireOldInvitations(): Promise<{ updated: number }> {
  await requireCompanyAdmin()
  const now = new Date()
  const result = await prisma.userInvitation.updateMany({
    where: { status: "PENDING", expiresAt: { lt: now } },
    data: { status: "EXPIRED" },
  })
  return { updated: result.count }
}

// ---------- acceptInvitation (公開フロー) ----------

export type AcceptInvitationInput = {
  token: string
  email: string
  initialPassword: string
}

export type AcceptInvitationResult = {
  ok: true
  userId: string
  email: string
}

/**
 * 招待リンクからのログイン。
 * - 公開 (未認証) で呼ばれる
 * - email + initialPassword + token を照合して User + UserProfile を作る
 * - 作成成功で UserInvitation.status = ACCEPTED
 * - mustChangePassword=true を立てて初回ログイン後に強制変更させる
 *
 * 認証 (Session 確立) は呼び出し側の login フローに委ねる。
 * NOTE: 本関数は signUp ではないため middleware の /api/auth/sign-up ブロックは関係ない。
 *       直接 prisma で User と AuthAccount を作成する。
 */
export async function acceptInvitation(
  input: AcceptInvitationInput,
): Promise<AcceptInvitationResult> {
  // ※ requireSession は呼ばない (未認証ユーザーがアクセスする)
  const token = input.token?.trim()
  const email = input.email?.trim().toLowerCase()
  const password = input.initialPassword

  if (!token || !email || !password) {
    throw new Error("入力が不足しています")
  }

  const invitation = await prisma.userInvitation.findUnique({
    where: { id: token },
  })
  if (!invitation) {
    throw new Error("招待リンクが無効です")
  }
  if (invitation.status !== "PENDING") {
    throw new Error("この招待は既に処理済または失効しています")
  }
  if (invitation.expiresAt < new Date()) {
    // 自動 EXPIRED 化
    await prisma.userInvitation.update({
      where: { id: token },
      data: { status: "EXPIRED" },
    })
    throw new Error("招待リンクの有効期限が切れています")
  }
  if (invitation.authProvider !== "LOCAL") {
    throw new Error("LOCAL 以外の招待は P8 以降の対応です")
  }
  if (!invitation.email || invitation.email !== email) {
    throw new Error("メールアドレスが招待状と一致しません")
  }
  if (!invitation.initialPasswordHash) {
    throw new Error("招待状にパスワード情報がありません")
  }

  // パスワード検証
  const { verifyPassword } = await import("better-auth/crypto")
  const ok = await verifyPassword({ hash: invitation.initialPasswordHash, password })
  if (!ok) {
    throw new Error("初期パスワードが一致しません")
  }

  // 既存 User チェック (同 email)
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    throw new Error("既にこのメールアドレスで登録されています。通常のログインをご利用ください")
  }

  // User + AuthAccount + UserProfile をトランザクションで作成
  const userId = `usr_${randomBytes(12).toString("hex")}`
  const accountId = `acc_${randomBytes(12).toString("hex")}`
  const profileId = `prf_${randomBytes(12).toString("hex")}`
  const now = new Date()

  // パスワードはそのままハッシュ済を流用 (再ハッシュ不要)
  const passwordHashForAccount = invitation.initialPasswordHash

  await prisma.$transaction(async (tx) => {
    await tx.user.create({
      data: {
        id: userId,
        name: invitation.displayName,
        email,
        emailVerified: true,
        createdAt: now,
        updatedAt: now,
      },
    })
    await tx.authAccount.create({
      data: {
        id: accountId,
        accountId: userId,
        providerId: "credential",
        userId,
        password: passwordHashForAccount,
        createdAt: now,
        updatedAt: now,
      },
    })
    await tx.userProfile.create({
      data: {
        id: profileId,
        authUserId: userId,
        scopeRole: invitation.scopeRole,
        displayName: invitation.displayName,
        primaryCompanyId: invitation.companyId,
        assignedCompanyIds: [invitation.companyId],
        authProvider: "LOCAL",
        templateKey: invitation.templateKey,
        mustChangePassword: true,
        invitedBy: invitation.invitedBy,
        isActive: true,
      },
    })
    await tx.userInvitation.update({
      where: { id: token },
      data: {
        status: "ACCEPTED",
        acceptedAt: now,
        acceptedUserId: userId,
      },
    })
  })

  return { ok: true, userId, email }
}
