"use server"

import { prisma } from "@/lib/prisma"
import { requireSession } from "@/lib/auth-server"
import { revalidatePath } from "next/cache"
import { bigintToJson } from "@/lib/format"

// ============================================================
// グループ間入力（PDF P7）
// 支払会社で1件作成すると、受取会社側にミラー取引を自動作成。
// linkedTransactionId で双方向参照を維持。
// 編集・削除はどちらか一方から行い、相手側も同期される。
// ============================================================

async function ensureSameGroup(payerCompanyId: string, receiverCompanyId: string) {
  if (payerCompanyId === receiverCompanyId) {
    throw new Error("支払会社と受取会社が同一です")
  }
  const memberships = await prisma.companyGroupMember.findMany({
    where: { companyId: { in: [payerCompanyId, receiverCompanyId] } },
    select: { groupId: true, companyId: true },
  })
  const payerGroups = new Set(
    memberships.filter((m) => m.companyId === payerCompanyId).map((m) => m.groupId)
  )
  const sharedGroup = memberships.find(
    (m) => m.companyId === receiverCompanyId && payerGroups.has(m.groupId)
  )
  if (!sharedGroup) {
    throw new Error("支払会社と受取会社が同じグループに所属していません")
  }
  return sharedGroup.groupId
}

export async function getInterGroupTransactions(params: {
  companyId?: string
  accountingMonth?: string
}) {
  await requireSession()
  const where: Record<string, unknown> = {
    type: "TRANSFER",
    parentId: null,
    linkedTransactionId: { not: null },
    fundTransfer: { counterCompanyId: { not: null } },
  }
  if (params.accountingMonth) where.accountingMonth = params.accountingMonth
  if (params.companyId) {
    where.OR = [
      { companyId: params.companyId },
      { fundTransfer: { counterCompanyId: params.companyId } },
    ]
  }

  const rows = await prisma.transaction.findMany({
    where,
    orderBy: [{ transactionDate: "desc" }, { createdAt: "desc" }],
    include: {
      company: { select: { id: true, name: true, shortName: true } },
      account: { select: { id: true, bankName: true, branchName: true } },
      fundTransfer: {
        include: {
          fromAccount: { select: { id: true, bankName: true, branchName: true } },
          toAccount: { select: { id: true, bankName: true, branchName: true } },
        },
      },
    },
  })

  // 出金側のみ返す（amount < 0）
  const outgoingOnly = rows.filter((r) => r.amount < BigInt(0))

  const counterCompanyIds = Array.from(
    new Set(
      outgoingOnly
        .map((r) => r.fundTransfer?.counterCompanyId)
        .filter((v): v is string => !!v)
    )
  )
  const counterCompanies = await prisma.company.findMany({
    where: { id: { in: counterCompanyIds } },
    select: { id: true, name: true, shortName: true },
  })
  const counterMap = new Map(counterCompanies.map((c) => [c.id, c]))

  return bigintToJson(
    outgoingOnly.map((r) => ({
      ...r,
      counterCompany: r.fundTransfer?.counterCompanyId
        ? counterMap.get(r.fundTransfer.counterCompanyId) ?? null
        : null,
    }))
  )
}

export async function createInterGroupTransaction(data: {
  payerCompanyId: string
  payerAccountId: string
  receiverCompanyId: string
  receiverAccountId: string
  transactionDate: string
  accountingMonth: string
  amount: string
  summary?: string
  classification?: string
}) {
  await requireSession()
  await ensureSameGroup(data.payerCompanyId, data.receiverCompanyId)
  const amount = BigInt(data.amount)
  if (amount <= BigInt(0)) throw new Error("金額は正の数で入力してください")
  const transactionDate = new Date(data.transactionDate)

  const result = await prisma.$transaction(async (tx) => {
    const out = await tx.transaction.create({
      data: {
        companyId: data.payerCompanyId,
        accountId: data.payerAccountId,
        type: "TRANSFER",
        transactionDate,
        accountingMonth: data.accountingMonth,
        amount: -amount,
        summary: data.summary || "グループ間支払",
        classification: data.classification || null,
      },
    })

    const inn = await tx.transaction.create({
      data: {
        companyId: data.receiverCompanyId,
        accountId: data.receiverAccountId,
        type: "TRANSFER",
        transactionDate,
        accountingMonth: data.accountingMonth,
        amount: amount,
        summary: data.summary || "グループ間入金",
        classification: data.classification || null,
        linkedTransactionId: out.id,
      },
    })

    await tx.transaction.update({
      where: { id: out.id },
      data: { linkedTransactionId: inn.id },
    })

    await tx.fundTransfer.create({
      data: {
        transactionId: out.id,
        fromAccountId: data.payerAccountId,
        toAccountId: data.receiverAccountId,
        transferDate: transactionDate,
        amount,
        counterCompanyId: data.receiverCompanyId,
        counterTransactionId: inn.id,
      },
    })

    return { out, inn }
  })

  revalidatePath("/inter-group")
  revalidatePath("/cashflow-table")
  revalidatePath("/dashboard")
  return bigintToJson(result)
}

export async function updateInterGroupTransaction(
  payerTransactionId: string,
  data: {
    transactionDate?: string
    accountingMonth?: string
    amount?: string
    summary?: string
    classification?: string
  }
) {
  await requireSession()
  const payer = await prisma.transaction.findUnique({
    where: { id: payerTransactionId },
    include: { fundTransfer: true },
  })
  if (!payer) throw new Error("取引が見つかりません")
  if (!payer.linkedTransactionId) throw new Error("ミラー取引が存在しません")

  const update: Record<string, unknown> = {}
  if (data.transactionDate) update.transactionDate = new Date(data.transactionDate)
  if (data.accountingMonth) update.accountingMonth = data.accountingMonth
  if (data.summary !== undefined) update.summary = data.summary
  if (data.classification !== undefined) update.classification = data.classification

  await prisma.$transaction(async (tx) => {
    if (data.amount !== undefined) {
      const amount = BigInt(data.amount)
      if (amount <= BigInt(0)) throw new Error("金額は正の数で入力してください")
      await tx.transaction.update({
        where: { id: payer.id },
        data: { ...update, amount: -amount, amountUpdatedAt: new Date() },
      })
      await tx.transaction.update({
        where: { id: payer.linkedTransactionId! },
        data: { ...update, amount, amountUpdatedAt: new Date() },
      })
      if (payer.fundTransfer) {
        await tx.fundTransfer.update({
          where: { transactionId: payer.id },
          data: {
            amount,
            transferDate: data.transactionDate
              ? new Date(data.transactionDate)
              : undefined,
          },
        })
      }
    } else {
      await tx.transaction.update({ where: { id: payer.id }, data: update })
      await tx.transaction.update({
        where: { id: payer.linkedTransactionId! },
        data: update,
      })
      if (payer.fundTransfer && data.transactionDate) {
        await tx.fundTransfer.update({
          where: { transactionId: payer.id },
          data: { transferDate: new Date(data.transactionDate) },
        })
      }
    }
  })

  revalidatePath("/inter-group")
  revalidatePath("/cashflow-table")
  revalidatePath("/dashboard")
}

export async function deleteInterGroupTransaction(payerTransactionId: string) {
  await requireSession()
  const payer = await prisma.transaction.findUnique({
    where: { id: payerTransactionId },
  })
  if (!payer) throw new Error("取引が見つかりません")

  await prisma.$transaction(async (tx) => {
    if (payer.linkedTransactionId) {
      await tx.fundTransfer.deleteMany({ where: { transactionId: payer.id } })
      await tx.transaction.update({
        where: { id: payer.linkedTransactionId },
        data: { linkedTransactionId: null },
      })
      await tx.transaction.delete({ where: { id: payer.linkedTransactionId } })
    }
    await tx.transaction.delete({ where: { id: payer.id } })
  })

  revalidatePath("/inter-group")
  revalidatePath("/cashflow-table")
  revalidatePath("/dashboard")
}

// ============================================================
// 入力フォーム用のヘルパ：同一グループ会社一覧
// ============================================================

export async function getGroupCompaniesFor(companyId: string) {
  await requireSession()
  const memberships = await prisma.companyGroupMember.findMany({
    where: { companyId },
    select: { groupId: true },
  })
  const groupIds = memberships.map((m) => m.groupId)
  if (groupIds.length === 0) return []

  const peers = await prisma.companyGroupMember.findMany({
    where: { groupId: { in: groupIds }, companyId: { not: companyId } },
    select: { companyId: true },
  })
  const peerIds = Array.from(new Set(peers.map((p) => p.companyId)))

  return prisma.company.findMany({
    where: { id: { in: peerIds }, status: { not: "LIQUIDATING" } },
    select: { id: true, name: true, shortName: true },
    orderBy: { displayOrder: "asc" },
  })
}
