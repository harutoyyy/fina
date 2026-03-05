"use server"

import { prisma } from "@/lib/prisma"
import { requireSession } from "@/lib/auth-server"
import { TransactionType, TransactionStatus, PaymentMethod } from "@prisma/client"
import { revalidatePath } from "next/cache"
import { bigintToJson } from "@/lib/format"

export type TransactionWithRelations = {
  id: string
  companyId: string
  accountId: string
  partnerId: string | null
  type: string
  status: string
  transactionDate: string | null
  scheduledDate: string | null
  accountingMonth: string
  amount: string
  estimatedAmount: string | null
  actualAmount: string | null
  paymentMethod: string | null
  summary: string | null
  parentId: string | null
  invoiceDate: string | null
  invoiceAmount: string | null
  recordedAmount: string | null
  transferAmount: string | null
  hasEvidence: boolean
  confirmedAt: string | null
  confirmedBy: string | null
  createdAt: string
  updatedAt: string
  account: { id: string; bankName: string | null; branchName: string | null; accountNumber: string | null }
  partner: { id: string; name: string } | null
  details: {
    id: string
    midId: string | null
    subId: string | null
    amount: string
    summary: string | null
    mid: { id: string; name: string } | null
    sub: { id: string; name: string } | null
  }[]
  children: {
    id: string
    amount: string
    status: string
    transactionDate: string | null
    summary: string | null
    details: {
      id: string
      midId: string | null
      subId: string | null
      amount: string
      summary: string | null
      mid: { id: string; name: string } | null
      sub: { id: string; name: string } | null
    }[]
  }[]
}

const transactionInclude = {
  account: {
    select: { id: true, bankName: true, branchName: true, accountNumber: true },
  },
  partner: {
    select: { id: true, name: true },
  },
  details: {
    orderBy: { displayOrder: "asc" as const },
    include: {
      mid: { select: { id: true, name: true } },
      sub: { select: { id: true, name: true } },
    },
  },
  children: {
    orderBy: { displayOrder: "asc" as const },
    include: {
      details: {
        orderBy: { displayOrder: "asc" as const },
        include: {
          mid: { select: { id: true, name: true } },
          sub: { select: { id: true, name: true } },
        },
      },
    },
  },
}

export async function getTransactions(
  companyId: string,
  type: TransactionType,
  accountingMonth?: string,
  status?: TransactionStatus
): Promise<TransactionWithRelations[]> {
  await requireSession()
  const where: Record<string, unknown> = {
    companyId,
    type,
    parentId: null,
  }
  if (accountingMonth) where.accountingMonth = accountingMonth
  if (status) where.status = status

  const transactions = await prisma.transaction.findMany({
    where,
    orderBy: [{ transactionDate: "desc" }, { createdAt: "desc" }],
    include: transactionInclude,
  })

  return bigintToJson(transactions) as TransactionWithRelations[]
}

export async function createTransaction(data: {
  companyId: string
  accountId: string
  partnerId?: string
  type: TransactionType
  transactionDate?: string
  scheduledDate?: string
  accountingMonth: string
  amount: string
  paymentMethod?: PaymentMethod
  summary?: string
  parentId?: string
  invoiceDate?: string
  invoiceAmount?: string
  recordedAmount?: string
  transferAmount?: string
  details?: {
    midId?: string
    subId?: string
    amount: string
    summary?: string
  }[]
}) {
  await requireSession()

  const result = await prisma.transaction.create({
    data: {
      companyId: data.companyId,
      accountId: data.accountId,
      partnerId: data.partnerId || undefined,
      type: data.type,
      transactionDate: data.transactionDate ? new Date(data.transactionDate) : undefined,
      scheduledDate: data.scheduledDate ? new Date(data.scheduledDate) : undefined,
      accountingMonth: data.accountingMonth,
      amount: BigInt(data.amount),
      paymentMethod: data.paymentMethod || undefined,
      summary: data.summary || undefined,
      parentId: data.parentId || undefined,
      invoiceDate: data.invoiceDate ? new Date(data.invoiceDate) : undefined,
      invoiceAmount: data.invoiceAmount ? BigInt(data.invoiceAmount) : undefined,
      recordedAmount: data.recordedAmount ? BigInt(data.recordedAmount) : undefined,
      transferAmount: data.transferAmount ? BigInt(data.transferAmount) : undefined,
      details: data.details
        ? {
            create: data.details.map((d, i) => ({
              midId: d.midId || undefined,
              subId: d.subId || undefined,
              amount: BigInt(d.amount),
              summary: d.summary || undefined,
              displayOrder: i,
            })),
          }
        : undefined,
    },
    include: transactionInclude,
  })

  revalidatePath("/expenses")
  revalidatePath("/sales")
  revalidatePath("/costs")
  return bigintToJson(result)
}

export async function updateTransaction(
  id: string,
  companyId: string,
  data: {
    accountId?: string
    partnerId?: string | null
    transactionDate?: string | null
    scheduledDate?: string | null
    accountingMonth?: string
    amount?: string
    paymentMethod?: PaymentMethod | null
    summary?: string | null
    invoiceDate?: string | null
    invoiceAmount?: string | null
    recordedAmount?: string | null
    transferAmount?: string | null
  }
) {
  await requireSession()

  const existing = await prisma.transaction.findUnique({ where: { id } })
  if (!existing || existing.companyId !== companyId) {
    throw new Error("Transaction not found")
  }
  if (existing.status !== "DRAFT") {
    throw new Error("Only DRAFT transactions can be edited")
  }

  const updateData: Record<string, unknown> = {}
  if (data.accountId !== undefined) updateData.accountId = data.accountId
  if (data.partnerId !== undefined) updateData.partnerId = data.partnerId
  if (data.transactionDate !== undefined) updateData.transactionDate = data.transactionDate ? new Date(data.transactionDate) : null
  if (data.scheduledDate !== undefined) updateData.scheduledDate = data.scheduledDate ? new Date(data.scheduledDate) : null
  if (data.accountingMonth !== undefined) updateData.accountingMonth = data.accountingMonth
  if (data.amount !== undefined) updateData.amount = BigInt(data.amount)
  if (data.paymentMethod !== undefined) updateData.paymentMethod = data.paymentMethod
  if (data.summary !== undefined) updateData.summary = data.summary
  if (data.invoiceDate !== undefined) updateData.invoiceDate = data.invoiceDate ? new Date(data.invoiceDate) : null
  if (data.invoiceAmount !== undefined) updateData.invoiceAmount = data.invoiceAmount ? BigInt(data.invoiceAmount) : null
  if (data.recordedAmount !== undefined) updateData.recordedAmount = data.recordedAmount ? BigInt(data.recordedAmount) : null
  if (data.transferAmount !== undefined) updateData.transferAmount = data.transferAmount ? BigInt(data.transferAmount) : null

  const result = await prisma.transaction.update({
    where: { id },
    data: updateData,
    include: transactionInclude,
  })

  revalidatePath("/expenses")
  revalidatePath("/sales")
  revalidatePath("/costs")
  return bigintToJson(result)
}

const validTransitions: Record<string, string[]> = {
  DRAFT: ["READY", "CANCELLED"],
  READY: ["DRAFT", "CONFIRMED"],
  CONFIRMED: [],
  CANCELLED: ["DRAFT"],
}

export async function updateTransactionStatus(
  id: string,
  companyId: string,
  status: TransactionStatus
) {
  const session = await requireSession()

  const existing = await prisma.transaction.findUnique({ where: { id } })
  if (!existing || existing.companyId !== companyId) {
    throw new Error("Transaction not found")
  }

  const allowed = validTransitions[existing.status] || []
  if (!allowed.includes(status)) {
    throw new Error(`Cannot change status from ${existing.status} to ${status}`)
  }

  const updateData: Record<string, unknown> = { status }

  if (status === "READY") {
    updateData.readyAt = new Date()
    updateData.readyBy = session.user.id
  } else if (status === "CONFIRMED") {
    updateData.confirmedAt = new Date()
    updateData.confirmedBy = session.user.id
  }

  const result = await prisma.transaction.update({
    where: { id },
    data: updateData,
  })

  revalidatePath("/expenses")
  revalidatePath("/sales")
  revalidatePath("/costs")
  return bigintToJson(result)
}

export async function deleteTransaction(id: string, companyId: string) {
  await requireSession()

  const existing = await prisma.transaction.findUnique({ where: { id } })
  if (!existing || existing.companyId !== companyId) {
    throw new Error("Transaction not found")
  }
  if (existing.status !== "DRAFT") {
    throw new Error("Only DRAFT transactions can be deleted")
  }

  await prisma.transaction.delete({ where: { id } })
  revalidatePath("/expenses")
  revalidatePath("/sales")
  revalidatePath("/costs")
}

export async function upsertTransactionDetails(
  transactionId: string,
  details: {
    id?: string
    midId?: string
    subId?: string
    amount: string
    summary?: string
  }[]
) {
  await requireSession()

  await prisma.transactionDetail.deleteMany({ where: { transactionId } })

  if (details.length > 0) {
    await prisma.transactionDetail.createMany({
      data: details.map((d, i) => ({
        transactionId,
        midId: d.midId || null,
        subId: d.subId || null,
        amount: BigInt(d.amount),
        summary: d.summary || null,
        displayOrder: i,
      })),
    })
  }

  const totalAmount = details.reduce((sum, d) => sum + BigInt(d.amount), BigInt(0))
  await prisma.transaction.update({
    where: { id: transactionId },
    data: { amount: totalAmount },
  })

  revalidatePath("/expenses")
  revalidatePath("/sales")
  revalidatePath("/costs")
}
