"use server"

import { prisma } from "@/lib/prisma"
import { requireSession } from "@/lib/auth-server"
import { supabaseAdmin, EVIDENCE_BUCKET } from "@/lib/supabase"
import { revalidatePath } from "next/cache"

async function verifyCompanyAccess(companyId: string) {
  await requireSession()
  const company = await prisma.company.findUnique({ where: { id: companyId } })
  if (!company) throw new Error("会社が見つかりません")
  return company
}

async function getTransactionWithCompany(transactionId: string) {
  const tx = await prisma.transaction.findUnique({
    where: { id: transactionId },
    select: { companyId: true },
  })
  if (!tx) throw new Error("取引が見つかりません")
  return tx
}

// T-10: 署名付きアップロードURLを取得
export async function getUploadUrl(transactionId: string, fileName: string) {
  const tx = await getTransactionWithCompany(transactionId)
  const session = await verifyCompanyAccess(tx.companyId)

  const ext = fileName.split(".").pop() || "pdf"
  const storagePath = `${tx.companyId}/${transactionId}/${Date.now()}_${crypto.randomUUID()}.${ext}`

  const { data, error } = await supabaseAdmin.storage
    .from(EVIDENCE_BUCKET)
    .createSignedUploadUrl(storagePath)

  if (error) throw new Error(`アップロードURL取得失敗: ${error.message}`)

  return {
    signedUrl: data.signedUrl,
    token: data.token,
    storagePath,
  }
}

// T-10: アップロード完了後にDBレコード作成
export async function uploadEvidence(transactionId: string, data: {
  fileName: string
  fileSize: number
  mimeType: string
  storagePath: string
}) {
  const tx = await getTransactionWithCompany(transactionId)
  const session = await verifyCompanyAccess(tx.companyId)

  const evidence = await prisma.evidence.create({
    data: {
      transactionId,
      fileName: data.fileName,
      fileUrl: data.storagePath,
      fileSize: data.fileSize,
      mimeType: data.mimeType,
      uploadedBy: session.user.id,
    },
  })

  // hasEvidence を true にし、receivedDate が未設定なら自動セット
  const fullTx = await prisma.transaction.findUnique({
    where: { id: transactionId },
    select: { receivedDate: true },
  })
  await prisma.transaction.update({
    where: { id: transactionId },
    data: {
      hasEvidence: true,
      ...(!fullTx?.receivedDate ? { receivedDate: new Date() } : {}),
    },
  })

  revalidatePath("/expenses")
  revalidatePath("/expense-box")
  return evidence
}

export async function getEvidencesForTransaction(transactionId: string) {
  const tx = await getTransactionWithCompany(transactionId)
  await verifyCompanyAccess(tx.companyId)
  return prisma.evidence.findMany({
    where: { transactionId },
    orderBy: { uploadedAt: "desc" },
  })
}

// T-10: 署名付き閲覧URLを取得
export async function getEvidenceViewUrl(evidenceId: string) {
  const evidence = await prisma.evidence.findUnique({
    where: { id: evidenceId },
  })
  if (!evidence) throw new Error("証憑が見つかりません")

  const tx = await getTransactionWithCompany(evidence.transactionId)
  await verifyCompanyAccess(tx.companyId)

  const { data, error } = await supabaseAdmin.storage
    .from(EVIDENCE_BUCKET)
    .createSignedUrl(evidence.fileUrl, 3600) // 1時間有効

  if (error) throw new Error(`閲覧URL取得失敗: ${error.message}`)
  return data.signedUrl
}

export async function deleteEvidence(evidenceId: string) {
  const evidence = await prisma.evidence.findUnique({
    where: { id: evidenceId },
    select: { id: true, transactionId: true, fileUrl: true },
  })
  if (!evidence) throw new Error("証憑が見つかりません")

  const tx = await getTransactionWithCompany(evidence.transactionId)
  await verifyCompanyAccess(tx.companyId)

  // Storage からファイル削除
  await supabaseAdmin.storage
    .from(EVIDENCE_BUCKET)
    .remove([evidence.fileUrl])

  await prisma.evidence.delete({ where: { id: evidenceId } })

  const remaining = await prisma.evidence.count({
    where: { transactionId: evidence.transactionId },
  })
  if (remaining === 0) {
    await prisma.transaction.update({
      where: { id: evidence.transactionId },
      data: { hasEvidence: false },
    })
  }

  revalidatePath("/expenses")
  revalidatePath("/expense-box")
  return { success: true }
}

// T-11: 証憑メタ情報の更新
export async function updateEvidenceMeta(evidenceId: string, data: {
  metaTransactionDate?: string | null
  metaVendorName?: string | null
  metaAmount?: string | null
}) {
  const evidence = await prisma.evidence.findUnique({
    where: { id: evidenceId },
    select: { transactionId: true },
  })
  if (!evidence) throw new Error("証憑が見つかりません")

  const tx = await getTransactionWithCompany(evidence.transactionId)
  await verifyCompanyAccess(tx.companyId)

  return prisma.evidence.update({
    where: { id: evidenceId },
    data: {
      metaTransactionDate: data.metaTransactionDate ? new Date(data.metaTransactionDate) : null,
      metaVendorName: data.metaVendorName || null,
      metaAmount: data.metaAmount ? BigInt(data.metaAmount) : null,
    },
  })
}

// T-11: 証憑メタ情報で検索
export async function searchEvidenceByMeta(companyId: string, query: string) {
  await verifyCompanyAccess(companyId)
  return prisma.evidence.findMany({
    where: {
      transaction: { companyId },
      metaVendorName: { contains: query, mode: "insensitive" },
    },
    include: {
      transaction: {
        select: { id: true, accountingMonth: true, amount: true },
      },
    },
    orderBy: { uploadedAt: "desc" },
    take: 50,
  })
}
