// ============================================================
// メール送信ユーティリティ
// 出典: docs/admin_and_auth_design.md §6.6, §6.7, §7
//
// 仕様:
//   - RESEND_API_KEY が設定されていれば Resend 経由で実送信
//   - 未設定なら従来通り console.log のみ (ローカル開発時のフォールバック)
//   - 送信失敗時は呼び出し側に throw せず、内部でログ出力するのみ
//     (申請承認・招待などのトランザクションを失敗させたくない)
//
// 環境変数:
//   RESEND_API_KEY        Resend の API キー (re_xxxxxxxxxxxx)
//   RESEND_FROM_EMAIL     送信元アドレス (例: "経理くん <noreply@your-domain.com>")
//                         未認証ドメインの場合は "onboarding@resend.dev" でテスト可
//   NEXT_PUBLIC_APP_URL   リンク生成用ベース URL (省略時 http://localhost:3003)
// ============================================================

import { Resend } from "resend"

type MailEnvelope = {
  to: string
  subject: string
  body: string
}

const DEFAULT_FROM = "経理くん <onboarding@resend.dev>"

function getResendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return null
  return new Resend(apiKey)
}

/**
 * メール送信本体。
 * - Resend 設定済 → 実送信 (失敗時は console.error してフォールバック)
 * - 未設定 → console.log にスタブ出力
 */
async function sendMail(env: MailEnvelope, kind: string): Promise<void> {
  const client = getResendClient()

  if (!client) {
    console.log("[mail.stub]", kind, JSON.stringify(env, null, 2))
    return
  }

  const from = process.env.RESEND_FROM_EMAIL || DEFAULT_FROM

  try {
    const result = await client.emails.send({
      from,
      to: env.to,
      subject: env.subject,
      text: env.body,
    })
    if ((result as { error?: unknown }).error) {
      console.error("[mail.resend.error]", kind, env.to, (result as { error?: unknown }).error)
    } else {
      console.log("[mail.resend.sent]", kind, env.to, "->", from)
    }
  } catch (e) {
    // 送信失敗してもアプリ側のトランザクションは続行させる
    console.error("[mail.resend.exception]", kind, env.to, e)
  }
}

/**
 * 公開申請受付の確認メール (申請者宛)。
 */
export async function sendApplicationReceipt(params: {
  to: string
  applicantName: string
  companyName: string
  applicationId: string
}) {
  await sendMail(
    {
      to: params.to,
      subject: "【経理くん】利用申請を受け付けました",
      body: [
        `${params.applicantName} 様`,
        ``,
        `会社「${params.companyName}」での経理くん利用申請を受け付けました。`,
        `受付番号: ${params.applicationId}`,
        ``,
        `運営担当者が確認後、改めて結果をご連絡いたします。`,
        `通常 1-3 営業日以内に審査が完了します。`,
      ].join("\n"),
    },
    "application_receipt",
  )
}

/**
 * 公開申請が承認されたお知らせ (申請者宛)。
 * passwordSetupLink を含むことで初回パスワード設定動線を案内。
 */
export async function sendApplicationApproved(params: {
  to: string
  applicantName: string
  companyName: string
  /** LOCAL 申請の場合に渡される。PWDX 連携時は undefined */
  passwordSetupLink?: string
}) {
  const lines = [
    `${params.applicantName} 様`,
    ``,
    `会社「${params.companyName}」での経理くん利用申請が承認されました。`,
    ``,
  ]
  if (params.passwordSetupLink) {
    lines.push(
      `下記リンクからパスワードを設定し、ログインしてください。`,
      `※ リンクの有効期限は 30 分です。`,
      ``,
      params.passwordSetupLink,
    )
  } else {
    lines.push(`経理くんログイン画面の「PWDX でログイン」からご利用ください。`)
  }
  await sendMail(
    {
      to: params.to,
      subject: "【経理くん】利用申請が承認されました",
      body: lines.join("\n"),
    },
    "application_approved",
  )
}

/**
 * 公開申請が却下されたお知らせ (申請者宛)。
 */
export async function sendApplicationRejected(params: {
  to: string
  applicantName: string
  companyName: string
  reviewComment: string
}) {
  await sendMail(
    {
      to: params.to,
      subject: "【経理くん】利用申請結果のお知らせ",
      body: [
        `${params.applicantName} 様`,
        ``,
        `会社「${params.companyName}」での経理くん利用申請につきまして、`,
        `誠に恐れ入りますが、今回は承認を見送らせていただきました。`,
        ``,
        `■ 運営担当者からのコメント`,
        params.reviewComment,
        ``,
        `ご不明点がございましたら、本メールへ返信いただくか、運営担当者までお問い合わせください。`,
      ].join("\n"),
    },
    "application_rejected",
  )
}

/**
 * パスワードリセットリンクのメール。
 * セルフサービス・管理者代行 いずれも本関数を経由する。
 */
export async function sendPasswordResetLink(params: {
  to: string
  displayName: string
  resetUrl: string
  expiresAtIso: string
}) {
  await sendMail(
    {
      to: params.to,
      subject: "【経理くん】パスワード再設定のご案内",
      body: [
        `${params.displayName} 様`,
        ``,
        `パスワード再設定のリクエストを受け付けました。`,
        `下記リンクをクリックして新しいパスワードを設定してください。`,
        ``,
        params.resetUrl,
        ``,
        `■ 有効期限: ${params.expiresAtIso}`,
        `■ リンクは 1 回のみ有効です。`,
        ``,
        `心当たりが無い場合は、本メールを破棄してください。`,
      ].join("\n"),
    },
    "password_reset_link",
  )
}

/**
 * パスワード変更完了の通知メール (攻撃検知用)。
 */
export async function sendPasswordChangedNotification(params: {
  to: string
  displayName: string
  changedAtIso: string
}) {
  await sendMail(
    {
      to: params.to,
      subject: "【経理くん】パスワードが変更されました",
      body: [
        `${params.displayName} 様`,
        ``,
        `${params.changedAtIso} にパスワードが変更されました。`,
        `心当たりが無い場合は、ただちに管理者へご連絡ください。`,
      ].join("\n"),
    },
    "password_changed_notification",
  )
}

// ============================================================
// Phase 3: COMPANY_ADMIN 用ユーザー招待メール
// 出典: docs/admin_and_auth_design.md §8.3
// ============================================================

/**
 * LOCAL ユーザー招待メール
 * - 招待リンク + 初期パスワードを通知する
 */
export async function sendUserInvitation(params: {
  to: string
  displayName: string
  companyName: string
  inviteUrl: string
  initialPassword: string
  expiresAtIso: string
  invitedByName?: string
}) {
  await sendMail(
    {
      to: params.to,
      subject: "【経理くん】ご招待のお知らせ",
      body: [
        `${params.displayName} 様`,
        ``,
        params.invitedByName
          ? `${params.invitedByName} さんから、経理くんへ招待されました。`
          : `経理くんへ招待されました。`,
        `所属会社: ${params.companyName}`,
        ``,
        `■ ログイン用 URL`,
        params.inviteUrl,
        ``,
        `■ 初期パスワード`,
        params.initialPassword,
        ``,
        `■ 有効期限: ${params.expiresAtIso}`,
        ``,
        `初回ログイン後、パスワードの変更を求められます。`,
        `心当たりが無い場合は、本メールを破棄してください。`,
      ].join("\n"),
    },
    "user_invitation",
  )
  return { ok: true as const }
}

/**
 * 招待状再送メール
 * - 既存の招待状を再送する場合に使う
 * - 初期パスワード再生成済みの場合は initialPassword を渡す
 */
export async function resendUserInvitation(params: {
  to: string
  displayName: string
  companyName: string
  inviteUrl: string
  initialPassword?: string
  expiresAtIso: string
  invitedByName?: string
}) {
  const lines = [
    `${params.displayName} 様`,
    ``,
    `経理くん招待状の再送です。`,
    `所属会社: ${params.companyName}`,
    ``,
    `■ ログイン用 URL`,
    params.inviteUrl,
    ``,
  ]
  if (params.initialPassword) {
    lines.push(`■ 初期パスワード (再発行)`, params.initialPassword, ``)
  } else {
    lines.push(`■ 初期パスワード`, `初回招待時にお送りしたパスワードをご利用ください。`, ``)
  }
  lines.push(
    `■ 有効期限: ${params.expiresAtIso}`,
    ``,
    `初回ログイン後、パスワードの変更を求められます。`,
  )
  await sendMail(
    {
      to: params.to,
      subject: "【経理くん】ご招待のお知らせ (再送)",
      body: lines.join("\n"),
    },
    "user_invitation_resend",
  )
  return { ok: true as const }
}

/**
 * 管理者代行パスワードリセット通知メール
 * - COMPANY_ADMIN が自社ユーザーのパスワードをリセットした際に対象ユーザーへ送信
 */
export async function sendPasswordResetByAdmin(params: {
  to: string
  displayName: string
  resetUrl: string
  expiresAtIso: string
  requestedByName: string
}) {
  await sendMail(
    {
      to: params.to,
      subject: "【経理くん】管理者によるパスワード再設定のお知らせ",
      body: [
        `${params.displayName} 様`,
        ``,
        `${params.requestedByName} さん (管理者) によって、パスワード再設定が要求されました。`,
        `下記リンクから新しいパスワードを設定してください。`,
        ``,
        params.resetUrl,
        ``,
        `■ 有効期限: ${params.expiresAtIso}`,
        `■ リンクは 1 回のみ有効です。`,
        ``,
        `心当たりが無い場合は、ただちに管理者へご連絡ください。`,
      ].join("\n"),
    },
    "password_reset_by_admin",
  )
  return { ok: true as const }
}
