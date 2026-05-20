"use server"

// ============================================================
// PWDX 連携設定 Server Actions (Phase 5)
// ============================================================
//
// 設計: docs/admin_and_auth_design.md §6.5, §10.2.3, §11
// マスタープラン: docs/admin_master_plan.md §P5
//
// 本ファイルでは PWDX 連携の設定 CRUD のみを実装する。
// 実際の同期処理 (PWDX API への接続) は Phase 9 で実装。
// ============================================================

import { prisma } from "@/lib/prisma"
import { requireCompanyAdmin, requireSuperAdmin } from "@/lib/auth-server"
import { storeSecret, rotateSecret } from "@/lib/secrets"
import { revalidatePath } from "next/cache"

// ------------------------------------------------------------
// 型定義
// ------------------------------------------------------------

export type SyncFeatures = {
  partners: boolean
  invoices: boolean
  orders: boolean
  payments: boolean
}

export type PwdxIntegrationSummary = {
  companyId: string
  companyName: string
  companyShortName: string | null
  enabled: boolean
  pwdxCompanyId: string | null
  syncFeatures: SyncFeatures | null
  lastSyncedAt: string | null
  lastSyncStatus: string | null
  lastSyncMessage: string | null
  hasIntegration: boolean
}

export type PwdxIntegrationDetail = {
  id: string | null
  companyId: string
  companyName: string
  enabled: boolean
  pwdxCompanyId: string
  apiBaseUrl: string | null
  credentialKey: string
  hasCredential: boolean
  syncFeatures: SyncFeatures
  lastSyncedAt: string | null
  lastSyncStatus: string | null
  lastSyncMessage: string | null
}

const DEFAULT_SYNC_FEATURES: SyncFeatures = {
  partners: false,
  invoices: false,
  orders: false,
  payments: false,
}

function parseSyncFeatures(value: unknown): SyncFeatures {
  if (!value || typeof value !== "object") return { ...DEFAULT_SYNC_FEATURES }
  const obj = value as Record<string, unknown>
  return {
    partners: Boolean(obj.partners),
    invoices: Boolean(obj.invoices),
    orders: Boolean(obj.orders),
    payments: Boolean(obj.payments),
  }
}

// ------------------------------------------------------------
// 権限チェック: 指定会社へのアクセス可否
// ------------------------------------------------------------
//
// SUPER_ADMIN: 全社可
// COMPANY_ADMIN: primaryCompanyId または assignedCompanyIds に含まれる会社のみ
// ------------------------------------------------------------
async function assertCompanyAccess(companyId: string) {
  const ctx = await requireCompanyAdmin()
  if (ctx.scopeRole === "SUPER_ADMIN") return ctx

  const profile = await prisma.userProfile.findUnique({
    where: { id: ctx.profileId },
    select: { primaryCompanyId: true, assignedCompanyIds: true },
  })
  if (!profile) throw new Error("Forbidden: profile not found")
  const allowed =
    profile.primaryCompanyId === companyId ||
    (profile.assignedCompanyIds ?? []).includes(companyId)
  if (!allowed) {
    throw new Error("Forbidden: cannot manage PWDX integration of other company")
  }
  return ctx
}

// ------------------------------------------------------------
// 一覧: アクセス可能な会社の連携サマリを返す
// ------------------------------------------------------------

export async function listPwdxIntegrations(): Promise<PwdxIntegrationSummary[]> {
  const ctx = await requireCompanyAdmin()

  // SUPER_ADMIN は全社、COMPANY_ADMIN は自社のみ
  let companyIds: string[] | undefined
  if (ctx.scopeRole !== "SUPER_ADMIN") {
    const profile = await prisma.userProfile.findUnique({
      where: { id: ctx.profileId },
      select: { primaryCompanyId: true, assignedCompanyIds: true },
    })
    const ids = new Set<string>()
    if (profile?.primaryCompanyId) ids.add(profile.primaryCompanyId)
    for (const id of profile?.assignedCompanyIds ?? []) ids.add(id)
    companyIds = Array.from(ids)
    if (companyIds.length === 0) return []
  }

  const companies = await prisma.company.findMany({
    where: companyIds ? { id: { in: companyIds } } : undefined,
    orderBy: { displayOrder: "asc" },
    select: {
      id: true,
      name: true,
      shortName: true,
      pwdxIntegration: true,
    },
  })

  return companies.map((c) => {
    const integ = c.pwdxIntegration
    return {
      companyId: c.id,
      companyName: c.name,
      companyShortName: c.shortName,
      enabled: integ?.enabled ?? false,
      pwdxCompanyId: integ?.pwdxCompanyId ?? null,
      syncFeatures: integ ? parseSyncFeatures(integ.syncFeatures) : null,
      lastSyncedAt: integ?.lastSyncedAt?.toISOString() ?? null,
      lastSyncStatus: integ?.lastSyncStatus ?? null,
      lastSyncMessage: integ?.lastSyncMessage ?? null,
      hasIntegration: !!integ,
    }
  })
}

// ------------------------------------------------------------
// 詳細取得
// ------------------------------------------------------------

export async function getPwdxIntegration(
  companyId: string,
): Promise<PwdxIntegrationDetail | null> {
  await assertCompanyAccess(companyId)
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true, name: true, pwdxIntegration: true },
  })
  if (!company) return null

  const integ = company.pwdxIntegration
  if (!integ) {
    // 未設定状態を返す
    return {
      id: null,
      companyId: company.id,
      companyName: company.name,
      enabled: false,
      pwdxCompanyId: "",
      apiBaseUrl: null,
      credentialKey: "",
      hasCredential: false,
      syncFeatures: { ...DEFAULT_SYNC_FEATURES },
      lastSyncedAt: null,
      lastSyncStatus: null,
      lastSyncMessage: null,
    }
  }

  return {
    id: integ.id,
    companyId: company.id,
    companyName: company.name,
    enabled: integ.enabled,
    pwdxCompanyId: integ.pwdxCompanyId,
    apiBaseUrl: integ.apiBaseUrl,
    credentialKey: integ.credentialKey,
    hasCredential: !!integ.credentialKey,
    syncFeatures: parseSyncFeatures(integ.syncFeatures),
    lastSyncedAt: integ.lastSyncedAt?.toISOString() ?? null,
    lastSyncStatus: integ.lastSyncStatus,
    lastSyncMessage: integ.lastSyncMessage,
  }
}

// ------------------------------------------------------------
// 重複チェック: 他社で同じ pwdxCompanyId が使用されていないか
// ------------------------------------------------------------

export async function checkPwdxCompanyIdDuplicate(
  pwdxCompanyId: string,
  excludeCompanyId?: string,
): Promise<{ inUse: boolean; companyName: string | null }> {
  await requireCompanyAdmin()
  if (!pwdxCompanyId.trim()) return { inUse: false, companyName: null }

  const existing = await prisma.pwdxIntegration.findFirst({
    where: {
      pwdxCompanyId,
      ...(excludeCompanyId ? { companyId: { not: excludeCompanyId } } : {}),
    },
    select: { company: { select: { name: true } } },
  })
  return {
    inUse: !!existing,
    companyName: existing?.company.name ?? null,
  }
}

// ------------------------------------------------------------
// 登録/更新 (upsert)
// ------------------------------------------------------------

export type UpsertPwdxIntegrationInput = {
  companyId: string
  enabled: boolean
  pwdxCompanyId: string
  apiBaseUrl?: string | null
  /** 入力時のみ平文の API キー。null/undefined の場合は既存 credentialKey を維持する */
  apiKey?: string | null
  syncFeatures: SyncFeatures
}

export async function upsertPwdxIntegration(input: UpsertPwdxIntegrationInput) {
  await assertCompanyAccess(input.companyId)

  if (!input.pwdxCompanyId.trim()) {
    throw new Error("PWDX 企業 ID は必須です")
  }

  // 重複チェック
  const dup = await checkPwdxCompanyIdDuplicate(input.pwdxCompanyId, input.companyId)
  if (dup.inUse) {
    throw new Error(`PWDX 企業 ID は既に他会社 (${dup.companyName ?? "?"}) で使用されています`)
  }

  const existing = await prisma.pwdxIntegration.findUnique({
    where: { companyId: input.companyId },
    select: { id: true, credentialKey: true },
  })

  // API キーが入力されていれば暗号化保管しキーを更新、なければ既存を維持
  let credentialKey = existing?.credentialKey ?? ""
  if (input.apiKey !== undefined && input.apiKey !== null && input.apiKey !== "") {
    if (existing?.credentialKey) {
      credentialKey = await rotateSecret(input.companyId, existing.credentialKey, input.apiKey)
    } else {
      credentialKey = await storeSecret(input.companyId, input.apiKey)
    }
  } else if (!existing) {
    // 新規作成時で API キーが空の場合、placeholder を入れる (NOT NULL 制約のため)
    credentialKey = await storeSecret(input.companyId, "")
  }

  const syncFeatures: SyncFeatures = {
    partners: !!input.syncFeatures.partners,
    invoices: !!input.syncFeatures.invoices,
    orders: !!input.syncFeatures.orders,
    payments: !!input.syncFeatures.payments,
  }

  const result = await prisma.pwdxIntegration.upsert({
    where: { companyId: input.companyId },
    create: {
      companyId: input.companyId,
      enabled: input.enabled,
      pwdxCompanyId: input.pwdxCompanyId.trim(),
      apiBaseUrl: input.apiBaseUrl?.trim() || null,
      credentialKey,
      syncFeatures,
    },
    update: {
      enabled: input.enabled,
      pwdxCompanyId: input.pwdxCompanyId.trim(),
      apiBaseUrl: input.apiBaseUrl?.trim() || null,
      credentialKey,
      syncFeatures,
    },
  })

  // TODO(P4): audit ログ ("pwdx.integration_change") を発火する
  //   ※ lib/audit.ts は Phase 4 担当 Agent が作成中のため、本 Agent では呼ばない

  revalidatePath("/admin/pwdx")
  revalidatePath(`/admin/pwdx/${input.companyId}`)
  return result
}

// ------------------------------------------------------------
// 削除
// ------------------------------------------------------------

export async function deletePwdxIntegration(companyId: string) {
  await assertCompanyAccess(companyId)
  const result = await prisma.pwdxIntegration.delete({
    where: { companyId },
  })
  // TODO(KMS): 削除時には credentialKey の参照先を KMS 上で失効させる
  // TODO(P4): audit ログ ("pwdx.integration_change", op=DELETE) を発火する
  revalidatePath("/admin/pwdx")
  revalidatePath(`/admin/pwdx/${companyId}`)
  return result
}

// ------------------------------------------------------------
// API キー回転
// ------------------------------------------------------------

export async function rotateCredentialKey(companyId: string, newApiKey: string) {
  await assertCompanyAccess(companyId)
  if (!newApiKey || !newApiKey.trim()) {
    throw new Error("新しい API キーを入力してください")
  }
  const existing = await prisma.pwdxIntegration.findUnique({
    where: { companyId },
    select: { credentialKey: true },
  })
  if (!existing) {
    throw new Error("連携設定が見つかりません。先に連携を作成してください")
  }
  const newKey = await rotateSecret(companyId, existing.credentialKey, newApiKey)
  const result = await prisma.pwdxIntegration.update({
    where: { companyId },
    data: { credentialKey: newKey },
  })
  // TODO(P4): audit ログ ("pwdx.integration_change", op=ROTATE_KEY) を発火する
  revalidatePath(`/admin/pwdx/${companyId}`)
  return result
}

// ------------------------------------------------------------
// 今すぐ同期 (P9 まで no-op)
// ------------------------------------------------------------

export async function syncNow(companyId: string) {
  await assertCompanyAccess(companyId)
  // TODO(P9): 実際の PWDX API 同期処理を実装する
  //   - PwdxIntegration から credentialKey を取得し、getSecret() でプレーンキーを取り出す
  //   - syncFeatures に従って PWDX API を呼び出す
  //   - 同期結果を SyncJob テーブル (P9 で追加予定) に記録
  //   - lastSyncedAt / lastSyncStatus / lastSyncMessage を更新

  const now = new Date()
  const result = await prisma.pwdxIntegration.update({
    where: { companyId },
    data: {
      lastSyncedAt: now,
      lastSyncStatus: "PENDING",
      lastSyncMessage: "P9 で実装予定",
    },
  })
  revalidatePath(`/admin/pwdx/${companyId}`)
  return { ok: true, message: "P9 で実装予定", lastSyncedAt: result.lastSyncedAt }
}

// ------------------------------------------------------------
// SUPER_ADMIN 用: 全 PwdxIntegration を返す (P5 では一覧のみ)
// ------------------------------------------------------------

export async function listAllPwdxIntegrationsForSuperAdmin() {
  await requireSuperAdmin()
  return prisma.pwdxIntegration.findMany({
    orderBy: { createdAt: "desc" },
    include: { company: { select: { id: true, name: true, shortName: true } } },
  })
}

// ------------------------------------------------------------
// 同期履歴 (P9 まで空配列)
// ------------------------------------------------------------

export type SyncHistoryEntry = {
  id: string
  startedAt: string
  finishedAt: string | null
  status: string
  feature: string
  recordCount: number | null
  message: string | null
}

export async function listSyncHistory(companyId: string): Promise<SyncHistoryEntry[]> {
  await assertCompanyAccess(companyId)
  // TODO(P9): SyncJob テーブル追加後にここで履歴を取得する
  //   現状は空配列を返す
  return []
}
