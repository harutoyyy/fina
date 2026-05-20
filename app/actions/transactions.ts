"use server"

import { prisma } from "@/lib/prisma"
import { requireSession } from "@/lib/auth-server"
import { TransactionType, TransactionStatus, PaymentMethod } from "@prisma/client"
import { revalidatePath } from "next/cache"
import { bigintToJson } from "@/lib/format"
import { ensureMonthOpen, checkMonthClosed } from "@/app/actions/cashflow-table"
import { createAuditLog } from "@/lib/audit-log"

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
  classification: string | null
  summary: string | null
  parentId: string | null
  invoiceDate: string | null
  invoiceAmount: string | null
  recordedAmount: string | null
  transferAmount: string | null
  hasEvidence: boolean
  evidenceNotRequired: boolean
  receivedDate: string | null
  temporaryVendorName: string | null
  isDateException: boolean
  confirmedAt: string | null
  confirmedBy: string | null
  recurringTemplateId: string | null
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

// children と details は include ではなく select で必要列のみに絞る。
// 旧実装は children に親と同じ 20+ カラムを全部取得していたが、
// 子取引で表示に使うのは id/amount/status/transactionDate/summary だけ。
// details の mid/sub も id/name のみ必要。
const detailSelect = {
  id: true,
  midId: true,
  subId: true,
  amount: true,
  summary: true,
  displayOrder: true,
  mid: { select: { id: true, name: true } },
  sub: { select: { id: true, name: true } },
} as const

const transactionInclude = {
  account: {
    select: { id: true, bankName: true, branchName: true, accountNumber: true },
  },
  partner: {
    select: { id: true, name: true },
  },
  details: {
    orderBy: { displayOrder: "asc" as const },
    select: detailSelect,
  },
  children: {
    orderBy: { displayOrder: "asc" as const },
    select: {
      id: true,
      amount: true,
      status: true,
      transactionDate: true,
      summary: true,
      details: {
        orderBy: { displayOrder: "asc" as const },
        select: detailSelect,
      },
    },
  },
}

export async function getTransactions(
  companyId: string,
  type: TransactionType,
  accountingMonth?: string,
  status?: TransactionStatus,
  pagination?: { page: number; pageSize: number }
): Promise<{ data: TransactionWithRelations[]; total: number }> {
  await requireSession()
  const where: Record<string, unknown> = {
    companyId,
    type,
    parentId: null,
  }
  if (accountingMonth) where.accountingMonth = accountingMonth
  if (status) where.status = status

  // 並列化: count と findMany を1ラウンドトリップで
  const [total, transactions] = await Promise.all([
    prisma.transaction.count({ where }),
    prisma.transaction.findMany({
      where,
      orderBy: [{ transactionDate: "desc" }, { createdAt: "desc" }],
      include: transactionInclude,
      ...(pagination ? { skip: (pagination.page - 1) * pagination.pageSize, take: pagination.pageSize } : {}),
    }),
  ])

  return { data: bigintToJson(transactions) as TransactionWithRelations[], total }
}

export async function createTransaction(data: {
  companyId: string
  accountId: string
  partnerId?: string
  temporaryVendorName?: string
  type: TransactionType
  transactionDate?: string
  scheduledDate?: string
  accountingMonth: string
  amount: string
  estimatedAmount?: string
  actualAmount?: string
  paymentMethod?: PaymentMethod
  summary?: string
  classification?: string
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
  temporaryBankAccount?: {
    bankCode: string
    bankName?: string
    branchCode: string
    branchName?: string
    accountType: string
    accountNumber: string
    accountHolder: string
  }
}) {
  const session = await requireSession()
  // 並列化: 役割確認と月締めチェック (独立)
  const [role] = await Promise.all([
    getUserRole(session.user.id),
    ensureMonthOpen(data.companyId, data.accountingMonth),
  ])
  if (role === "VIEWER") {
    throw new Error("閲覧者は経費を作成できません")
  }

  const result = await prisma.transaction.create({
    data: {
      companyId: data.companyId,
      accountId: data.accountId,
      partnerId: data.partnerId || undefined,
      temporaryVendorName: data.temporaryVendorName || undefined,
      type: data.type,
      transactionDate: data.transactionDate ? new Date(data.transactionDate) : undefined,
      scheduledDate: data.scheduledDate ? new Date(data.scheduledDate) : undefined,
      accountingMonth: data.accountingMonth,
      amount: BigInt(data.amount),
      estimatedAmount: data.estimatedAmount ? BigInt(data.estimatedAmount) : undefined,
      actualAmount: data.actualAmount ? BigInt(data.actualAmount) : undefined,
      paymentMethod: data.paymentMethod || undefined,
      summary: data.summary || undefined,
      classification: data.classification || undefined,
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
      temporaryBankAccount: data.temporaryBankAccount
        ? {
            create: {
              bankCode: data.temporaryBankAccount.bankCode,
              bankName: data.temporaryBankAccount.bankName || null,
              branchCode: data.temporaryBankAccount.branchCode,
              branchName: data.temporaryBankAccount.branchName || null,
              accountType: data.temporaryBankAccount.accountType,
              accountNumber: data.temporaryBankAccount.accountNumber,
              accountHolder: data.temporaryBankAccount.accountHolder,
            },
          }
        : undefined,
    },
    include: transactionInclude,
  })

  await createAuditLog({
    tableName: "transactions_fina",
    recordId: result.id,
    operation: "CREATE",
    userId: session.user.id,
    afterData: { type: data.type, amount: data.amount, accountingMonth: data.accountingMonth },
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
    temporaryVendorName?: string | null
    transactionDate?: string | null
    scheduledDate?: string | null
    accountingMonth?: string
    amount?: string
    estimatedAmount?: string | null
    actualAmount?: string | null
    paymentMethod?: PaymentMethod | null
    classification?: string | null
    summary?: string | null
    invoiceDate?: string | null
    invoiceAmount?: string | null
    recordedAmount?: string | null
    transferAmount?: string | null
    receivedDate?: string | null
  }
) {
  const session = await requireSession()
  // 並列化: 役割確認と取引取得 (独立)
  const [role, existing] = await Promise.all([
    getUserRole(session.user.id),
    prisma.transaction.findUnique({ where: { id } }),
  ])
  if (role === "VIEWER") {
    throw new Error("閲覧者は経費を編集できません")
  }
  if (!existing || existing.companyId !== companyId) {
    throw new Error("Transaction not found")
  }

  const monthClosed = await checkMonthClosed(companyId, existing.accountingMonth)

  if (monthClosed) {
    // 月締め後: 摘要・科目のみ変更可、金額/口座/日付/支払方法はブロック
    const amountFields = ["accountId", "transactionDate", "scheduledDate", "accountingMonth", "amount", "paymentMethod", "invoiceDate", "invoiceAmount", "recordedAmount", "transferAmount"] as const
    for (const field of amountFields) {
      if (data[field] !== undefined) {
        const existingVal = existing[field as keyof typeof existing]
        const newVal = data[field]
        if (String(existingVal ?? "") !== String(newVal ?? "")) {
          throw new Error("月締め後は金額変更できません")
        }
      }
    }
  } else {
    if (existing.status !== "DRAFT") {
      throw new Error("Only DRAFT transactions can be edited")
    }
  }

  const beforeData = bigintToJson(existing) as Record<string, unknown>
  const updateData: Record<string, unknown> = {}
  if (data.accountId !== undefined) updateData.accountId = data.accountId
  if (data.partnerId !== undefined) updateData.partnerId = data.partnerId
  if (data.temporaryVendorName !== undefined) updateData.temporaryVendorName = data.temporaryVendorName
  if (data.transactionDate !== undefined) updateData.transactionDate = data.transactionDate ? new Date(data.transactionDate) : null
  if (data.scheduledDate !== undefined) {
    updateData.scheduledDate = data.scheduledDate ? new Date(data.scheduledDate) : null
    // T-09: 繰り返しテンプレート由来の明細で予定日を手変更した場合、isDateException = true
    if (existing.recurringTemplateId && data.scheduledDate) {
      const origDate = existing.scheduledDate?.toISOString().split("T")[0] ?? ""
      if (origDate !== data.scheduledDate) {
        updateData.isDateException = true
      }
    }
  }
  if (data.accountingMonth !== undefined) updateData.accountingMonth = data.accountingMonth
  if (data.amount !== undefined) updateData.amount = BigInt(data.amount)
  if (data.estimatedAmount !== undefined) updateData.estimatedAmount = data.estimatedAmount ? BigInt(data.estimatedAmount) : null
  if (data.actualAmount !== undefined) updateData.actualAmount = data.actualAmount ? BigInt(data.actualAmount) : null
  if (data.paymentMethod !== undefined) updateData.paymentMethod = data.paymentMethod
  if (data.classification !== undefined) updateData.classification = data.classification
  if (data.summary !== undefined) updateData.summary = data.summary
  if (data.invoiceDate !== undefined) updateData.invoiceDate = data.invoiceDate ? new Date(data.invoiceDate) : null
  if (data.invoiceAmount !== undefined) updateData.invoiceAmount = data.invoiceAmount ? BigInt(data.invoiceAmount) : null
  if (data.recordedAmount !== undefined) updateData.recordedAmount = data.recordedAmount ? BigInt(data.recordedAmount) : null
  if (data.transferAmount !== undefined) updateData.transferAmount = data.transferAmount ? BigInt(data.transferAmount) : null
  if (data.receivedDate !== undefined) updateData.receivedDate = data.receivedDate ? new Date(data.receivedDate) : null

  const result = await prisma.transaction.update({
    where: { id },
    data: updateData,
    include: transactionInclude,
  })

  await createAuditLog({
    tableName: "transactions_fina",
    recordId: id,
    operation: monthClosed ? "UPDATE_AFTER_CLOSE" : "UPDATE",
    userId: session.user.id,
    beforeData,
    afterData: data as Record<string, unknown>,
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

/**
 * 認証済セッションのユーザーロールを取得する。
 * Phase 1 で UserRole → ScopeRole に rename したため、内部的に
 * SUPER_ADMIN / COMPANY_ADMIN を旧 "ADMIN" 相当として返す。
 * これにより、既存の `role !== "ADMIN"` 判定箇所を変更せず動かせる。
 */
async function getUserRole(userId: string): Promise<string> {
  const profile = await prisma.userProfile.findUnique({
    where: { authUserId: userId },
    select: { scopeRole: true },
  })
  const scopeRole = profile?.scopeRole ?? "OPERATOR"
  // SUPER_ADMIN / COMPANY_ADMIN は旧 ADMIN として扱う
  if (scopeRole === "SUPER_ADMIN" || scopeRole === "COMPANY_ADMIN") return "ADMIN"
  return scopeRole
}

async function validateExpenseReady(tx: { id: string; partnerId: string | null; temporaryVendorName: string | null; hasEvidence: boolean; evidenceNotRequired: boolean }) {
  if (!tx.partnerId && !tx.temporaryVendorName) {
    throw new Error("準備完了には取引先（または仮取引先名）が必要です")
  }
  if (!tx.hasEvidence && !tx.evidenceNotRequired) {
    throw new Error("準備完了には証憑添付（または証憑なしOK）が必要です")
  }
}

async function validateExpenseConfirmed(tx: { id: string; partnerId: string | null; temporaryVendorName: string | null }) {
  if (!tx.partnerId) {
    throw new Error("確定には正規取引先の登録が必要です。仮取引先名を正規化してください")
  }
  // count に置換: 中項目を持つ明細が1件でもあるか
  const midCount = await prisma.transactionDetail.count({
    where: { transactionId: tx.id, midId: { not: null } },
  })
  if (midCount === 0) {
    throw new Error("確定には勘定科目（中項目）が必要です")
  }
}

async function validateSalesConfirmed(tx: { id: string; invoiceAmount: bigint | null }, role: string) {
  if (role !== "ADMIN") {
    throw new Error("入金・控除確定は管理者のみ実行できます")
  }
  // 並列化 + aggregate に置換: findMany+reduce を sum 一発に
  const [childrenAgg, deductionAgg] = await Promise.all([
    prisma.transaction.aggregate({
      where: { parentId: tx.id },
      _sum: { amount: true },
    }),
    prisma.transactionDetail.aggregate({
      where: { transactionId: tx.id, deductionCategoryId: { not: null } },
      _sum: { amount: true },
    }),
  ])
  const actualPayments = childrenAgg._sum.amount ?? BigInt(0)
  const invoiceAmount = tx.invoiceAmount || BigInt(0)
  const diff = invoiceAmount - actualPayments
  const deductionTotal = deductionAgg._sum.amount ?? BigInt(0)

  if (diff !== deductionTotal) {
    throw new Error(`差額（${diff}）と控除合計（${deductionTotal}）が一致しません`)
  }
}

async function validateSalesReadyRevert(tx: { id: string }, role: string) {
  if (role !== "ADMIN") {
    throw new Error("請求確定の解除は管理者のみ実行できます")
  }
}

async function validateCostConfirmed(tx: { id: string; recordedAmount: bigint | null }, role: string) {
  if (role !== "ADMIN") {
    throw new Error("原価確定は管理者のみ実行できます")
  }
  // 並列化 + count/aggregate に置換
  const [unpaidCount, childrenAgg, deductionAgg] = await Promise.all([
    prisma.transaction.count({
      where: { parentId: tx.id, status: { not: "CONFIRMED" } },
    }),
    prisma.transaction.aggregate({
      where: { parentId: tx.id },
      _sum: { amount: true },
    }),
    prisma.transactionDetail.aggregate({
      where: { transactionId: tx.id, deductionCategoryId: { not: null } },
      _sum: { amount: true },
    }),
  ])
  if (unpaidCount > 0) {
    throw new Error("分割支払中は確定できません（未確定の支払があります）")
  }
  const actualPayments = childrenAgg._sum.amount ?? BigInt(0)
  const recordedAmount = tx.recordedAmount || BigInt(0)
  const diff = recordedAmount - actualPayments
  const deductionTotal = deductionAgg._sum.amount ?? BigInt(0)

  if (diff !== deductionTotal) {
    throw new Error(`差額（計上額−実支払: ${diff}）と控除合計（${deductionTotal}）が一致しません`)
  }
}

export async function updateTransactionStatus(
  id: string,
  companyId: string,
  status: TransactionStatus
) {
  const session = await requireSession()
  // 並列化: 役割確認と取引取得 (独立)
  const [role, existing] = await Promise.all([
    getUserRole(session.user.id),
    prisma.transaction.findUnique({ where: { id } }),
  ])

  if (role === "VIEWER") {
    throw new Error("閲覧者はステータス変更できません")
  }

  if (!existing || existing.companyId !== companyId) {
    throw new Error("Transaction not found")
  }

  const allowed = validTransitions[existing.status] || []
  if (!allowed.includes(status)) {
    throw new Error(`Cannot change status from ${existing.status} to ${status}`)
  }

  const monthClosed = await checkMonthClosed(companyId, existing.accountingMonth)
  if (monthClosed && status === "CANCELLED") {
    throw new Error("月締め後は取消できません")
  }

  if (existing.type === "EXPENSE") {
    if (status === "READY") {
      await validateExpenseReady(existing)
    } else if (status === "CONFIRMED") {
      if (role !== "ADMIN") {
        throw new Error("経費の確定は管理者のみ実行できます")
      }
      await validateExpenseConfirmed(existing)
    }
  }

  if (existing.type === "SALES") {
    if (status === "CONFIRMED" && existing.parentId === null) {
      await validateSalesConfirmed(existing, role)
    }
    if (status === "DRAFT" && existing.status === "READY" && existing.parentId === null) {
      await validateSalesReadyRevert(existing, role)
    }
  }

  if (existing.type === "COST_PAYMENT") {
    if (status === "CONFIRMED") {
      await validateCostConfirmed(existing, role)
    }
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

  const operation = status === "CONFIRMED" ? "CONFIRM" : status === "DRAFT" ? "UNCONFIRM" : "UPDATE"
  await createAuditLog({
    tableName: "transactions_fina",
    recordId: id,
    operation,
    userId: session.user.id,
    beforeData: { status: existing.status },
    afterData: { status },
  })

  revalidatePath("/expenses")
  revalidatePath("/sales")
  revalidatePath("/costs")
  return bigintToJson(result)
}

// T-03: 証憑なしOKフラグの設定（管理者のみ）
export async function setEvidenceNotRequired(id: string, companyId: string, value: boolean) {
  const session = await requireSession()
  // 並列化: 役割確認と取引取得 (独立)
  const [role, existing] = await Promise.all([
    getUserRole(session.user.id),
    prisma.transaction.findUnique({ where: { id } }),
  ])
  if (role !== "ADMIN") {
    throw new Error("証憑なしOKの設定は管理者のみ実行できます")
  }

  if (!existing || existing.companyId !== companyId) {
    throw new Error("Transaction not found")
  }

  const result = await prisma.transaction.update({
    where: { id },
    data: { evidenceNotRequired: value },
  })

  await createAuditLog({
    tableName: "transactions_fina",
    recordId: id,
    operation: "UPDATE",
    userId: session.user.id,
    beforeData: { evidenceNotRequired: existing.evidenceNotRequired },
    afterData: { evidenceNotRequired: value },
  })

  revalidatePath("/expenses")
  revalidatePath("/expense-box")
  return bigintToJson(result)
}

// T-13: 仮取引先 → 正規取引先への正規化（管理者のみ）
export async function normalizePartner(
  transactionId: string,
  companyId: string,
  partnerId: string,
  registerBankAccount?: boolean // 仮口座を正式口座として登録するか
) {
  const session = await requireSession()
  // 並列化: 役割確認と取引取得 (独立)
  const [role, existing] = await Promise.all([
    getUserRole(session.user.id),
    prisma.transaction.findUnique({
      where: { id: transactionId },
      include: { temporaryBankAccount: true },
    }),
  ])
  if (role !== "ADMIN") {
    throw new Error("取引先の正規化は管理者のみ実行できます")
  }

  if (!existing || existing.companyId !== companyId) {
    throw new Error("Transaction not found")
  }
  if (!existing.temporaryVendorName && existing.partnerId) {
    throw new Error("この取引は既に正規取引先が設定されています")
  }

  const beforeData = {
    partnerId: existing.partnerId,
    temporaryVendorName: existing.temporaryVendorName,
  }

  // 仮口座を正式口座として登録
  if (registerBankAccount && existing.temporaryBankAccount) {
    const tmpAcct = existing.temporaryBankAccount
    await prisma.tradingPartnerBankAccount.create({
      data: {
        partnerId,
        bankCode: tmpAcct.bankCode,
        branchCode: tmpAcct.branchCode,
        accountType: tmpAcct.accountType,
        accountNumber: tmpAcct.accountNumber,
        accountHolder: tmpAcct.accountHolder,
      },
    })
    // 仮口座を削除
    await prisma.temporaryBankAccount.delete({ where: { id: tmpAcct.id } })
  }

  // 正規取引先に紐付け、仮取引先名をクリア
  const result = await prisma.transaction.update({
    where: { id: transactionId },
    data: {
      partnerId,
      temporaryVendorName: null,
    },
    include: transactionInclude,
  })

  await createAuditLog({
    tableName: "transactions_fina",
    recordId: transactionId,
    operation: "PARTNER_NORMALIZED",
    userId: session.user.id,
    beforeData,
    afterData: { partnerId, temporaryVendorName: null },
  })

  revalidatePath("/expenses")
  revalidatePath("/expense-box")
  revalidatePath("/cashflow-table")
  return bigintToJson(result)
}

// 仮取引先名を持つ取引を一覧取得（管理者用）
export async function getTemporaryVendorTransactions(companyId: string) {
  await requireSession()
  const transactions = await prisma.transaction.findMany({
    where: {
      companyId,
      temporaryVendorName: { not: null },
      partnerId: null,
    },
    orderBy: { createdAt: "desc" },
    include: {
      ...transactionInclude,
      temporaryBankAccount: true,
    },
  })
  return bigintToJson(transactions)
}

export async function deleteTransaction(id: string, companyId: string) {
  const session = await requireSession()
  // 並列化: 役割確認と取引取得 (独立)
  const [role, existing] = await Promise.all([
    getUserRole(session.user.id),
    prisma.transaction.findUnique({ where: { id } }),
  ])
  if (role === "VIEWER") {
    throw new Error("閲覧者は経費を削除できません")
  }

  if (!existing || existing.companyId !== companyId) {
    throw new Error("Transaction not found")
  }
  if (existing.status !== "DRAFT") {
    throw new Error("Only DRAFT transactions can be deleted")
  }
  await ensureMonthOpen(companyId, existing.accountingMonth)

  await createAuditLog({
    tableName: "transactions_fina",
    recordId: id,
    operation: "DELETE",
    userId: session.user.id,
    beforeData: bigintToJson(existing) as Record<string, unknown>,
  })

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
    deductionCategoryId?: string
    deductionSubType?: string
    signMultiplier?: number
  }[]
) {
  const session = await requireSession()

  const tx = await prisma.transaction.findUnique({ where: { id: transactionId } })
  if (tx) {
    const monthClosed = await checkMonthClosed(tx.companyId, tx.accountingMonth)
    if (monthClosed) {
      // 月締め後は金額変更をブロック、科目と摘要のみ許可
      const existingDetails = await prisma.transactionDetail.findMany({
        where: { transactionId },
        orderBy: { displayOrder: "asc" },
      })
      for (let i = 0; i < details.length; i++) {
        const existing = existingDetails[i]
        if (existing && BigInt(details[i].amount) !== existing.amount) {
          throw new Error("月締め後は金額変更できません")
        }
      }
      // 科目/摘要のみ更新 + 監査ログ記録 (N+1 を Promise.all で並列化)
      const updates: Promise<unknown>[] = []
      for (let i = 0; i < details.length; i++) {
        const existing = existingDetails[i]
        if (existing) {
          const beforeDetail = { midId: existing.midId, subId: existing.subId, summary: existing.summary }
          const afterDetail = { midId: details[i].midId || null, subId: details[i].subId || null, summary: details[i].summary || null }
          updates.push(
            prisma.transactionDetail.update({
              where: { id: existing.id },
              data: afterDetail,
            })
          )
          if (beforeDetail.midId !== afterDetail.midId || beforeDetail.subId !== afterDetail.subId || beforeDetail.summary !== afterDetail.summary) {
            updates.push(
              createAuditLog({
                tableName: "transaction_details_fina",
                recordId: existing.id,
                operation: "UPDATE_AFTER_CLOSE",
                userId: session.user.id,
                beforeData: beforeDetail as Record<string, unknown>,
                afterData: afterDetail as Record<string, unknown>,
              })
            )
          }
        }
      }
      await Promise.all(updates)
      revalidatePath("/expenses")
      revalidatePath("/sales")
      revalidatePath("/costs")
      return
    }
  }

  await prisma.transactionDetail.deleteMany({ where: { transactionId } })

  if (details.length > 0) {
    await prisma.transactionDetail.createMany({
      data: details.map((d, i) => ({
        transactionId,
        midId: d.midId || null,
        subId: d.subId || null,
        amount: BigInt(d.amount),
        summary: d.summary || null,
        deductionCategoryId: d.deductionCategoryId || null,
        deductionSubType: d.deductionSubType || null,
        signMultiplier: d.signMultiplier ?? 1,
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

export async function upsertDeductionDetails(
  transactionId: string,
  companyId: string,
  deductions: {
    deductionCategoryId: string
    deductionSubType?: string
    amount: string
    summary?: string
  }[]
) {
  const session = await requireSession()

  const tx = await prisma.transaction.findUnique({ where: { id: transactionId } })
  if (!tx || tx.companyId !== companyId) {
    throw new Error("Transaction not found")
  }

  // 並列化: 控除明細削除 + 非控除明細の件数取得（count）+ カテゴリ取得
  const categoryIds = deductions.map((d) => d.deductionCategoryId)
  const [, startOrder, categories] = await Promise.all([
    prisma.transactionDetail.deleteMany({
      where: { transactionId, deductionCategoryId: { not: null } },
    }),
    prisma.transactionDetail.count({
      where: { transactionId, deductionCategoryId: null },
    }),
    categoryIds.length > 0
      ? prisma.deductionCategory.findMany({
          where: { id: { in: categoryIds } },
        })
      : Promise.resolve([] as Awaited<ReturnType<typeof prisma.deductionCategory.findMany>>),
  ])

  if (deductions.length > 0) {
    const catMap = new Map(categories.map(c => [c.id, c]))

    await prisma.transactionDetail.createMany({
      data: deductions.map((d, i) => {
        const cat = catMap.get(d.deductionCategoryId)
        const signRule = cat?.signRule as { occurrence?: number; offset?: number } | null
        const sign = d.deductionSubType === "OFFSET" ? (signRule?.offset ?? -1) : (signRule?.occurrence ?? 1)
        return {
          transactionId,
          midId: cat?.midId || null,
          subId: cat?.subId || null,
          amount: BigInt(d.amount),
          summary: d.summary || cat?.name || null,
          deductionCategoryId: d.deductionCategoryId,
          deductionSubType: d.deductionSubType || null,
          signMultiplier: sign,
          displayOrder: startOrder + i,
        }
      }),
    })
  }

  await createAuditLog({
    tableName: "transaction_details_fina",
    recordId: transactionId,
    operation: "UPDATE",
    userId: session.user.id,
    afterData: { deductionCount: deductions.length },
  })

  revalidatePath("/sales")
  revalidatePath("/costs")
  return { success: true }
}

export async function copyPreviousDeductions(
  transactionId: string,
  companyId: string
) {
  await requireSession()

  // select 絞り込み: 必要カラムのみ
  const tx = await prisma.transaction.findUnique({
    where: { id: transactionId },
    select: { companyId: true, partnerId: true, type: true, accountingMonth: true },
  })
  if (!tx || tx.companyId !== companyId) {
    throw new Error("Transaction not found")
  }

  const previousTx = await prisma.transaction.findFirst({
    where: {
      companyId,
      partnerId: tx.partnerId,
      type: tx.type,
      accountingMonth: { lt: tx.accountingMonth },
    },
    orderBy: { accountingMonth: "desc" },
    select: { id: true },
  })

  if (!previousTx) {
    return { found: false, deductions: [] }
  }

  // select 絞り込み: 必要カラムのみ
  const details = await prisma.transactionDetail.findMany({
    where: {
      transactionId: previousTx.id,
      deductionCategoryId: { not: null },
    },
    orderBy: { displayOrder: "asc" },
    select: { deductionCategoryId: true, deductionSubType: true, summary: true },
  })

  if (details.length === 0) {
    return { found: false, deductions: [] }
  }

  return {
    found: true,
    deductions: details.map((d) => ({
      deductionCategoryId: d.deductionCategoryId!,
      deductionSubType: d.deductionSubType || "",
      amount: "0",
      summary: d.summary || "",
    })),
  }
}

export async function getDeductionDetailsForTransaction(transactionId: string) {
  await requireSession()

  const details = await prisma.transactionDetail.findMany({
    where: {
      transactionId,
      deductionCategoryId: { not: null },
    },
    orderBy: { displayOrder: "asc" },
  })

  return bigintToJson(details) as {
    id: string
    deductionCategoryId: string
    deductionSubType: string | null
    amount: string
    summary: string | null
    signMultiplier: number
  }[]
}
