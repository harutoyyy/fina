"use server"

import { prisma } from "@/lib/prisma"
import { requireSession } from "@/lib/auth-server"
import { revalidatePath } from "next/cache"
import { bigintToJson } from "@/lib/format"

export async function getFundTransfers(companyId: string, accountingMonth?: string) {
  await requireSession()
  const where: Record<string, unknown> = {
    companyId,
    type: "TRANSFER",
    parentId: null,
  }
  if (accountingMonth) where.accountingMonth = accountingMonth

  const transfers = await prisma.transaction.findMany({
    where,
    orderBy: [{ transactionDate: "desc" }, { createdAt: "desc" }],
    include: {
      account: { select: { id: true, bankName: true, branchName: true } },
      fundTransfer: {
        include: {
          fromAccount: { select: { id: true, bankName: true, branchName: true } },
          toAccount: { select: { id: true, bankName: true, branchName: true } },
        },
      },
    },
  })

  return bigintToJson(transfers)
}

export async function createFundTransfer(data: {
  companyId: string
  fromAccountId: string
  toAccountId: string
  transferDate: string
  amount: string
  accountingMonth: string
  summary?: string
  counterCompanyId?: string
}) {
  await requireSession()
  const amount = BigInt(data.amount)
  const transferDate = new Date(data.transferDate)

  const result = await prisma.$transaction(async (tx) => {
    const outTransaction = await tx.transaction.create({
      data: {
        companyId: data.companyId,
        accountId: data.fromAccountId,
        type: "TRANSFER",
        transactionDate: transferDate,
        accountingMonth: data.accountingMonth,
        amount: -amount,
        summary: data.summary || "資金移動（出金）",
      },
    })

    const inTransaction = await tx.transaction.create({
      data: {
        companyId: data.counterCompanyId || data.companyId,
        accountId: data.toAccountId,
        type: "TRANSFER",
        transactionDate: transferDate,
        accountingMonth: data.accountingMonth,
        amount: amount,
        summary: data.summary || "資金移動（入金）",
        linkedTransactionId: outTransaction.id,
      },
    })

    await tx.transaction.update({
      where: { id: outTransaction.id },
      data: { linkedTransactionId: inTransaction.id },
    })

    await tx.fundTransfer.create({
      data: {
        transactionId: outTransaction.id,
        fromAccountId: data.fromAccountId,
        toAccountId: data.toAccountId,
        transferDate,
        amount,
        counterCompanyId: data.counterCompanyId || null,
        counterTransactionId: data.counterCompanyId ? inTransaction.id : null,
      },
    })

    return { outTransaction, inTransaction }
  })

  revalidatePath("/cashflow")
  return bigintToJson(result)
}

export async function deleteFundTransfer(transactionId: string, companyId: string) {
  await requireSession()

  const transaction = await prisma.transaction.findUnique({
    where: { id: transactionId },
    include: { fundTransfer: true },
  })
  if (!transaction || transaction.companyId !== companyId) {
    throw new Error("Transaction not found")
  }

  await prisma.$transaction(async (tx) => {
    if (transaction.linkedTransactionId) {
      await tx.fundTransfer.deleteMany({ where: { transactionId: transaction.linkedTransactionId } })
      await tx.transaction.delete({ where: { id: transaction.linkedTransactionId } })
    }
    await tx.fundTransfer.deleteMany({ where: { transactionId } })
    await tx.transaction.delete({ where: { id: transactionId } })
  })

  revalidatePath("/cashflow")
}
