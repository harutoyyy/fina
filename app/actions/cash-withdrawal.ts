"use server"

import { prisma } from "@/lib/prisma"
import { requireSession } from "@/lib/auth-server"
import { revalidatePath } from "next/cache"
import { bigintToJson } from "@/lib/format"

async function verifyCompanyAccess(companyId: string) {
  const session = await requireSession()
  const profile = await prisma.userProfile.findUnique({
    where: { authUserId: session.user.id },
    select: { assignedCompanyIds: true },
  })
  if (!profile) throw new Error("プロフィールが見つかりません")
  const ids = profile.assignedCompanyIds as string[]
  if (!ids.includes(companyId)) throw new Error("この会社へのアクセス権がありません")
  return session
}

async function getBatchWithCompany(batchId: string) {
  const batch = await prisma.cashWithdrawalBatch.findUnique({
    where: { id: batchId },
    select: { companyId: true },
  })
  if (!batch) throw new Error("バッチが見つかりません")
  return batch
}

export async function getCashWithdrawalBatches(companyId: string, month?: string) {
  await verifyCompanyAccess(companyId)
  const where: Record<string, unknown> = { companyId }
  if (month) {
    const [y, m] = month.split("-").map(Number)
    where.withdrawalDate = {
      gte: new Date(y, m - 1, 1),
      lt: new Date(y, m, 1),
    }
  }

  const batches = await prisma.cashWithdrawalBatch.findMany({
    where,
    include: {
      linkedTransactions: {
        include: {
          partner: { select: { name: true } },
        },
        orderBy: { displayOrder: "asc" },
      },
      denominations: true,
    },
    orderBy: { withdrawalDate: "asc" },
  })
  return bigintToJson(batches) as typeof batches
}

export async function createCashWithdrawalBatch(data: {
  companyId: string
  accountId: string
  withdrawalDate: string
  totalAmount: number
}) {
  await verifyCompanyAccess(data.companyId)
  const batch = await prisma.cashWithdrawalBatch.create({
    data: {
      companyId: data.companyId,
      accountId: data.accountId,
      withdrawalDate: new Date(data.withdrawalDate),
      totalAmount: BigInt(data.totalAmount),
    },
  })
  revalidatePath("/cash-withdrawal")
  return bigintToJson(batch) as typeof batch
}

export async function linkTransactionToBatch(batchId: string, transactionId: string) {
  const batch = await getBatchWithCompany(batchId)
  await verifyCompanyAccess(batch.companyId)

  const tx = await prisma.transaction.findUnique({
    where: { id: transactionId },
    select: { companyId: true },
  })
  if (!tx || tx.companyId !== batch.companyId) throw new Error("取引が見つからないか、同一会社ではありません")

  await prisma.transaction.update({
    where: { id: transactionId },
    data: { cashWithdrawalBatchId: batchId },
  })
  revalidatePath("/cash-withdrawal")
  return { success: true }
}

export async function unlinkTransactionFromBatch(transactionId: string) {
  const tx = await prisma.transaction.findUnique({
    where: { id: transactionId },
    select: { companyId: true },
  })
  if (!tx) throw new Error("取引が見つかりません")
  await verifyCompanyAccess(tx.companyId)

  await prisma.transaction.update({
    where: { id: transactionId },
    data: { cashWithdrawalBatchId: null },
  })
  revalidatePath("/cash-withdrawal")
  return { success: true }
}

export async function getUnlinkedCashTransactions(companyId: string, month?: string) {
  await verifyCompanyAccess(companyId)
  const where: Record<string, unknown> = {
    companyId,
    paymentMethod: "CASH_WITHDRAWAL",
    cashWithdrawalBatchId: null,
  }
  if (month) {
    where.accountingMonth = month
  }
  const txs = await prisma.transaction.findMany({
    where,
    include: {
      partner: { select: { name: true } },
    },
    orderBy: { transactionDate: "asc" },
  })
  return bigintToJson(txs) as typeof txs
}

export async function upsertDenomination(batchId: string, data: {
  yen10000: number
  yen5000: number
  yen2000: number
  yen1000: number
  yen500: number
  yen100: number
  yen50: number
  yen10: number
  yen5: number
  yen1: number
}) {
  const batch = await getBatchWithCompany(batchId)
  await verifyCompanyAccess(batch.companyId)

  const total =
    data.yen10000 * 10000 +
    data.yen5000 * 5000 +
    data.yen2000 * 2000 +
    data.yen1000 * 1000 +
    data.yen500 * 500 +
    data.yen100 * 100 +
    data.yen50 * 50 +
    data.yen10 * 10 +
    data.yen5 * 5 +
    data.yen1 * 1

  const existing = await prisma.cashDenomination.findFirst({
    where: { batchId },
  })

  if (existing) {
    const result = await prisma.cashDenomination.update({
      where: { id: existing.id },
      data: { ...data, total: BigInt(total) },
    })
    revalidatePath("/cash-withdrawal")
    return bigintToJson(result) as typeof result
  }

  const result = await prisma.cashDenomination.create({
    data: { batchId, ...data, total: BigInt(total) },
  })
  revalidatePath("/cash-withdrawal")
  return bigintToJson(result) as typeof result
}

export async function suggestDenomination(amount: number) {
  let remaining = amount
  const yen10000 = Math.floor(remaining / 10000); remaining %= 10000
  const yen5000 = Math.floor(remaining / 5000); remaining %= 5000
  const yen2000 = 0
  const yen1000 = Math.floor(remaining / 1000); remaining %= 1000
  const yen500 = Math.floor(remaining / 500); remaining %= 500
  const yen100 = Math.floor(remaining / 100); remaining %= 100
  const yen50 = Math.floor(remaining / 50); remaining %= 50
  const yen10 = Math.floor(remaining / 10); remaining %= 10
  const yen5 = Math.floor(remaining / 5); remaining %= 5
  const yen1 = remaining

  return { yen10000, yen5000, yen2000, yen1000, yen500, yen100, yen50, yen10, yen5, yen1 }
}

export async function confirmCashWithdrawalBatch(batchId: string) {
  const batchMeta = await getBatchWithCompany(batchId)
  const session = await verifyCompanyAccess(batchMeta.companyId)

  const batch = await prisma.cashWithdrawalBatch.findUnique({
    where: { id: batchId },
    include: {
      linkedTransactions: true,
      denominations: true,
    },
  })
  if (!batch) throw new Error("バッチが見つかりません")

  const childTotal = batch.linkedTransactions.reduce(
    (sum, tx) => sum + Number(tx.amount),
    0
  )
  if (childTotal !== Number(batch.totalAmount)) {
    throw new Error(`引出金額 (${Number(batch.totalAmount).toLocaleString()}円) と用途明細合計 (${childTotal.toLocaleString()}円) が一致しません`)
  }

  if (batch.denominations.length > 0) {
    const denomTotal = batch.denominations.reduce(
      (sum, d) => sum + Number(d.total),
      0
    )
    if (denomTotal !== Number(batch.totalAmount)) {
      throw new Error(`金種合計 (${denomTotal.toLocaleString()}円) と引出金額 (${Number(batch.totalAmount).toLocaleString()}円) が一致しません`)
    }
  }

  const result = await prisma.cashWithdrawalBatch.update({
    where: { id: batchId },
    data: {
      status: "CONFIRMED",
      confirmedAt: new Date(),
      confirmedBy: session.user.id,
    },
  })
  revalidatePath("/cash-withdrawal")
  return bigintToJson(result) as typeof result
}

export async function deleteCashWithdrawalBatch(batchId: string) {
  const batchMeta = await getBatchWithCompany(batchId)
  await verifyCompanyAccess(batchMeta.companyId)

  const batch = await prisma.cashWithdrawalBatch.findUnique({
    where: { id: batchId },
    select: { status: true },
  })
  if (!batch) throw new Error("バッチが見つかりません")
  if (batch.status === "CONFIRMED") throw new Error("確定済みバッチは削除できません")

  await prisma.transaction.updateMany({
    where: { cashWithdrawalBatchId: batchId },
    data: { cashWithdrawalBatchId: null },
  })
  await prisma.cashDenomination.deleteMany({ where: { batchId } })
  await prisma.cashWithdrawalBatch.delete({ where: { id: batchId } })

  revalidatePath("/cash-withdrawal")
  return { success: true }
}
