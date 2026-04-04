"use server"

import { prisma } from "@/lib/prisma"
import { requireSession } from "@/lib/auth-server"
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

export async function getEvidencesForTransaction(transactionId: string) {
  const tx = await getTransactionWithCompany(transactionId)
  await verifyCompanyAccess(tx.companyId)
  return prisma.evidence.findMany({
    where: { transactionId },
    orderBy: { uploadedAt: "desc" },
  })
}

export async function uploadEvidence(transactionId: string, data: {
  fileName: string
  fileSize: number
  mimeType: string
}) {
  const tx = await getTransactionWithCompany(transactionId)
  const session = await verifyCompanyAccess(tx.companyId)

  const mockUrl = `/uploads/mock/${transactionId}/${Date.now()}_${data.fileName}`

  const evidence = await prisma.evidence.create({
    data: {
      transactionId,
      fileName: data.fileName,
      fileUrl: mockUrl,
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

export async function deleteEvidence(evidenceId: string) {
  const evidence = await prisma.evidence.findUnique({
    where: { id: evidenceId },
    select: { transactionId: true },
  })
  if (!evidence) throw new Error("証憑が見つかりません")

  const tx = await getTransactionWithCompany(evidence.transactionId)
  await verifyCompanyAccess(tx.companyId)

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
