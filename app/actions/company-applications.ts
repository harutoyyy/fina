"use server"

import { randomBytes, createHash } from "crypto"
import { revalidatePath } from "next/cache"
import { headers } from "next/headers"

import { prisma } from "@/lib/prisma"
import { requireSuperAdmin } from "@/lib/auth-server"
import {
  sendApplicationApproved,
  sendApplicationReceipt,
  sendApplicationRejected,
} from "@/lib/mail"

// ============================================================
// 公開申請: 会社追加フロー (Phase 2)
// 出典: docs/admin_and_auth_design.md §6.6, §7
// ============================================================

// PENDING の自動失効までの日数
const APPLICATION_EXPIRY_DAYS = 30
// パスワード設定リンクの有効期限 (分)
const PASSWORD_TOKEN_TTL_MIN = 30

function hashToken(raw: string) {
  return createHash("sha256").update(raw).digest("hex")
}

function getOrigin(headersInit: Headers) {
  const host = headersInit.get("x-forwarded-host") ?? headersInit.get("host")
  const proto = headersInit.get("x-forwarded-proto") ?? "http"
  if (!host) return "http://localhost:3003"
  return `${proto}://${host}`
}

// ------------------------------------------------------------
// 1. 公開申請の作成 (未ログイン経路)
// ------------------------------------------------------------

export type CreateApplicationInput = {
  companyName: string
  applicantName: string
  applicantEmail: string
  applicantPhone?: string
  notes?: string
}

export async function createApplication(input: CreateApplicationInput) {
  // TODO: rate limit (IP + email で 1 時間 5 件、24 時間 10 件)
  // TODO: CAPTCHA 検証 (reCAPTCHA / hCaptcha のサーバ側 verify)
  const companyName = input.companyName.trim()
  const applicantName = input.applicantName.trim()
  const applicantEmail = input.applicantEmail.trim().toLowerCase()
  const applicantPhone = input.applicantPhone?.trim() || undefined
  const notes = input.notes?.trim() || undefined

  if (!companyName || !applicantName || !applicantEmail) {
    throw new Error("必須項目が入力されていません")
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(applicantEmail)) {
    throw new Error("メールアドレスの形式が正しくありません")
  }

  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + APPLICATION_EXPIRY_DAYS)

  const application = await prisma.companyApplication.create({
    data: {
      status: "PENDING",
      applicantName,
      applicantEmail,
      applicantPhone,
      notes,
      companyName,
      usePwdx: false,
      expiresAt,
    },
  })

  await sendApplicationReceipt({
    to: applicantEmail,
    applicantName,
    companyName,
    applicationId: application.id,
  })

  return { id: application.id }
}

// ------------------------------------------------------------
// 2. 申請一覧 (SUPER_ADMIN のみ)
// ------------------------------------------------------------

export async function listApplications(params?: {
  status?: "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED"
}) {
  await requireSuperAdmin()
  return prisma.companyApplication.findMany({
    where: params?.status
      ? { status: params.status === "APPROVED" ? "ACCEPTED" : params.status }
      : undefined,
    orderBy: { createdAt: "desc" },
    include: {
      reviewer: { select: { id: true, displayName: true } },
    },
  })
}

export async function getApplication(id: string) {
  await requireSuperAdmin()
  return prisma.companyApplication.findUnique({
    where: { id },
    include: {
      reviewer: { select: { id: true, displayName: true } },
    },
  })
}

// ------------------------------------------------------------
// 3. 承認: Company + UserProfile を作成
// ------------------------------------------------------------

export async function approveApplication(applicationId: string, comment?: string) {
  const reviewer = await requireSuperAdmin()
  const app = await prisma.companyApplication.findUnique({
    where: { id: applicationId },
  })
  if (!app) throw new Error("申請が見つかりません")
  if (app.status !== "PENDING") {
    throw new Error("PENDING の申請のみ承認できます")
  }
  if (app.usePwdx) {
    // PWDX 連携承認は別フェーズで実装
    throw new Error("PWDX 連携申請の承認は別フェーズで実装します")
  }

  const rawToken = randomBytes(32).toString("base64url")
  const tokenHash = hashToken(rawToken)
  const tokenExpiresAt = new Date(Date.now() + PASSWORD_TOKEN_TTL_MIN * 60 * 1000)

  // 既存ユーザーの重複確認 (メアド重複は警告レベル: 別会社で再利用許容)
  // ここではエラーにはせず、承認時に新規 User を作る
  const result = await prisma.$transaction(async (tx) => {
    // 1. Company 作成
    const company = await tx.company.create({
      data: {
        name: app.companyName,
        status: "ACTIVE",
      },
    })

    // 2. better-auth User 作成 (passwordHash は null。初回設定リンクで設定)
    const authUserId = `usr_${randomBytes(12).toString("base64url")}`
    await tx.user.create({
      data: {
        id: authUserId,
        name: app.applicantName,
        email: app.applicantEmail,
        emailVerified: false,
      },
    })

    // 3. UserProfile 作成 (COMPANY_ADMIN)
    await tx.userProfile.create({
      data: {
        authUserId,
        displayName: app.applicantName,
        scopeRole: "COMPANY_ADMIN",
        authProvider: "LOCAL",
        primaryCompanyId: company.id,
        assignedCompanyIds: [company.id],
        mustChangePassword: true,
        isActive: true,
      },
    })

    // 4. PasswordResetToken 発行 (初回パスワード設定リンク)
    await tx.passwordResetToken.create({
      data: {
        userId: authUserId,
        tokenHash,
        expiresAt: tokenExpiresAt,
        requestedBy: reviewer.profileId,
      },
    })

    // 5. CompanyApplication 更新
    const updated = await tx.companyApplication.update({
      where: { id: applicationId },
      data: {
        status: "ACCEPTED",
        reviewedAt: new Date(),
        reviewedBy: reviewer.profileId,
        reviewComment: comment?.trim() || undefined,
        createdCompanyId: company.id,
        createdUserId: authUserId,
      },
    })

    return { company, authUserId, updated }
  })

  const hdrs = await headers()
  const origin = getOrigin(hdrs)
  const passwordSetupLink = `${origin}/reset-password?token=${rawToken}`

  await sendApplicationApproved({
    to: app.applicantEmail,
    applicantName: app.applicantName,
    companyName: app.companyName,
    passwordSetupLink,
  })

  revalidatePath("/admin/system/applications")
  revalidatePath(`/admin/system/applications/${applicationId}`)
  return {
    applicationId: result.updated.id,
    companyId: result.company.id,
    userId: result.authUserId,
  }
}

// ------------------------------------------------------------
// 4. 却下
// ------------------------------------------------------------

export async function rejectApplication(applicationId: string, comment: string) {
  const reviewer = await requireSuperAdmin()
  const trimmed = comment?.trim() ?? ""
  if (!trimmed) {
    throw new Error("却下理由を入力してください")
  }
  const app = await prisma.companyApplication.findUnique({
    where: { id: applicationId },
  })
  if (!app) throw new Error("申請が見つかりません")
  if (app.status !== "PENDING") {
    throw new Error("PENDING の申請のみ却下できます")
  }

  await prisma.companyApplication.update({
    where: { id: applicationId },
    data: {
      status: "REJECTED",
      reviewedAt: new Date(),
      reviewedBy: reviewer.profileId,
      reviewComment: trimmed,
    },
  })

  await sendApplicationRejected({
    to: app.applicantEmail,
    applicantName: app.applicantName,
    companyName: app.companyName,
    reviewComment: trimmed,
  })

  revalidatePath("/admin/system/applications")
  revalidatePath(`/admin/system/applications/${applicationId}`)
  return { ok: true }
}

// ------------------------------------------------------------
// 5. 期限切れ申請の自動 EXPIRED 化 (cron 想定)
// ------------------------------------------------------------

export async function expireOldApplications() {
  // TODO: 認証 (cron 専用のシークレットヘッダーや SUPER_ADMIN チェック)
  const now = new Date()
  const result = await prisma.companyApplication.updateMany({
    where: {
      status: "PENDING",
      expiresAt: { lt: now },
    },
    data: { status: "EXPIRED" },
  })
  return { expiredCount: result.count }
}

