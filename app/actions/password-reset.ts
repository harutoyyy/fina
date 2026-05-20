"use server"

import { randomBytes, createHash } from "crypto"
import { headers } from "next/headers"
import { hashPassword } from "better-auth/crypto"

import { prisma } from "@/lib/prisma"
import {
  sendPasswordChangedNotification,
  sendPasswordResetLink,
} from "@/lib/mail"

// ============================================================
// セルフサービス パスワードリセット (Phase 2)
// 出典: docs/admin_and_auth_design.md §4.2 (パスワードリセット節)
//
// メアド列挙攻撃対策のため、リクエスト系 (requestPasswordReset) は
// 成功 / 失敗いずれも同一のレスポンス { ok: true } を返す。
// ============================================================

const RESET_TOKEN_TTL_MIN = 30
const PASSWORD_MIN_LENGTH = 8

function hashToken(raw: string) {
  return createHash("sha256").update(raw).digest("hex")
}

function validatePasswordPolicy(password: string) {
  if (password.length < PASSWORD_MIN_LENGTH) {
    throw new Error(`パスワードは ${PASSWORD_MIN_LENGTH} 文字以上で入力してください`)
  }
  // TODO: 文字種チェック (大小英字+数字)、過去パスワード再利用禁止、辞書ワード排除 等
}

function getOrigin(headersInit: Headers) {
  const host = headersInit.get("x-forwarded-host") ?? headersInit.get("host")
  const proto = headersInit.get("x-forwarded-proto") ?? "http"
  if (!host) return "http://localhost:3003"
  return `${proto}://${host}`
}

// ------------------------------------------------------------
// 1. メアド送信 → トークン発行 + メール送信
// ------------------------------------------------------------

export async function requestPasswordReset(email: string) {
  // TODO: rate limit
  //   同一メアド: 1 時間に 3 回まで
  //   同一 IP:   1 時間に 5 回まで
  // TODO: CAPTCHA 検証
  const target = email?.trim().toLowerCase()
  if (!target || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(target)) {
    // 形式不正でも列挙されないよう ok を返す
    return { ok: true }
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email: target },
      include: { profile: true },
    })

    // 該当無し / PWDX_OIDC / 無効化済 はサイレントに無視 (列挙対策)
    if (!user || !user.profile || !user.profile.isActive) {
      return { ok: true }
    }
    if (user.profile.authProvider !== "LOCAL") {
      return { ok: true }
    }

    const rawToken = randomBytes(32).toString("base64url")
    const tokenHash = hashToken(rawToken)
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MIN * 60 * 1000)
    const hdrs = await headers()
    const ip = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null
    const userAgent = hdrs.get("user-agent") ?? null

    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
        requestedBy: null, // セルフ要求
        requestIp: ip,
        userAgent,
      },
    })

    const origin = getOrigin(hdrs)
    const resetUrl = `${origin}/reset-password?token=${rawToken}`

    await sendPasswordResetLink({
      to: target,
      displayName: user.profile.displayName,
      resetUrl,
      expiresAtIso: expiresAt.toISOString(),
    })
  } catch (err) {
    // 内部エラーも列挙されないよう握りつぶす (ログだけは残す)
    console.error("[password-reset] requestPasswordReset failed", err)
  }

  return { ok: true }
}

// ------------------------------------------------------------
// 2. トークン検証 (リセット画面で URL の token を検証する)
// ------------------------------------------------------------

export type ValidateResetTokenResult =
  | { valid: true; displayName: string }
  | { valid: false; reason: "NOT_FOUND" | "EXPIRED" | "CONSUMED" }

export async function validateResetToken(rawToken: string): Promise<ValidateResetTokenResult> {
  if (!rawToken) return { valid: false, reason: "NOT_FOUND" }
  const tokenHash = hashToken(rawToken)
  const token = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    include: {
      user: { include: { profile: true } },
    },
  })
  if (!token) return { valid: false, reason: "NOT_FOUND" }
  if (token.consumedAt) return { valid: false, reason: "CONSUMED" }
  if (token.expiresAt < new Date()) return { valid: false, reason: "EXPIRED" }
  const name = token.user.profile?.displayName ?? token.user.name
  return { valid: true, displayName: name }
}

// ------------------------------------------------------------
// 3. 新パスワード設定 → 全セッション無効化 + 通知
// ------------------------------------------------------------

export async function completePasswordReset(params: {
  token: string
  newPassword: string
}) {
  // TODO: rate limit (同一 IP, 同一 user)
  validatePasswordPolicy(params.newPassword)

  const tokenHash = hashToken(params.token)
  const token = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    include: { user: { include: { profile: true } } },
  })
  if (!token) throw new Error("リンクが無効です")
  if (token.consumedAt) throw new Error("このリンクは既に使用済みです")
  if (token.expiresAt < new Date()) throw new Error("リンクの有効期限が切れています")

  const newHash = await hashPassword(params.newPassword)
  const now = new Date()

  await prisma.$transaction(async (tx) => {
    // 1. 既存の credential account を更新 or 新規作成
    const credAccount = await tx.authAccount.findFirst({
      where: { userId: token.userId, providerId: "credential" },
    })
    if (credAccount) {
      await tx.authAccount.update({
        where: { id: credAccount.id },
        data: { password: newHash, updatedAt: now },
      })
    } else {
      // 初回設定 (申請承認直後のケース)
      await tx.authAccount.create({
        data: {
          id: `acc_${createHash("sha256")
            .update(`${token.userId}:${now.getTime()}`)
            .digest("hex")
            .slice(0, 24)}`,
          userId: token.userId,
          accountId: token.userId,
          providerId: "credential",
          password: newHash,
        },
      })
    }

    // 2. プロファイル: mustChangePassword=false
    if (token.user.profile) {
      await tx.userProfile.update({
        where: { id: token.user.profile.id },
        data: { mustChangePassword: false },
      })
    }

    // 3. token 消費
    await tx.passwordResetToken.update({
      where: { id: token.id },
      data: { consumedAt: now },
    })

    // 4. 既存セッションを全無効化 (better-auth Session レコードを全削除)
    await tx.session.deleteMany({
      where: { userId: token.userId },
    })
  })

  // 5. 通知メール (best-effort)
  try {
    await sendPasswordChangedNotification({
      to: token.user.email,
      displayName: token.user.profile?.displayName ?? token.user.name,
      changedAtIso: now.toISOString(),
    })
  } catch (err) {
    console.error("[password-reset] completePasswordReset notification failed", err)
  }

  return { ok: true }
}
