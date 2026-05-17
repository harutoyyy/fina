"use server"

import { prisma } from "@/lib/prisma"
import { requireSession } from "@/lib/auth-server"
import { revalidatePath } from "next/cache"
import { bigintToJson } from "@/lib/format"

// ============================================================
// グループ間入力（PDF P7 / 手書きスケッチ準拠）
//
// 3カテゴリ:
//   - sale     : 売上/原価   支払側=COST_PAYMENT  受取側=SALES
//   - expense  : 経費        支払側=EXPENSE       受取側=SALES（雑収入扱い）
//   - lending  : 貸借        支払側=TRANSFER(−)   受取側=TRANSFER(+)   ＋ FundTransfer
//
// いずれも 支払側 と 受取側 を linkedTransactionId で双方向リンク。
// 編集・削除はどちらか一方から行えば相手側も同期される。
// ============================================================

export type InterGroupCategory = "sale" | "expense" | "lending"

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

function payerTypeFor(category: InterGroupCategory) {
  if (category === "sale") return "COST_PAYMENT" as const
  if (category === "expense") return "EXPENSE" as const
  return "TRANSFER" as const
}

function receiverTypeFor(category: InterGroupCategory) {
  return "SALES" as const  // 売上/経費補填は受取側=SALES、貸借は別途オーバーライド
}

// ------------------------------------------------------------
// 一覧取得（カテゴリ別）
// 出金側（amount<0）のみ返す。相手会社情報を補完。
// ------------------------------------------------------------
export async function getInterGroupTransactions(params: {
  companyId?: string
  accountingMonth?: string
  category: InterGroupCategory
}) {
  await requireSession()

  let typeFilter: { in: ("EXPENSE" | "SALES" | "COST_PAYMENT" | "TRANSFER")[] }
  if (params.category === "sale") {
    typeFilter = { in: ["COST_PAYMENT", "SALES"] }
  } else if (params.category === "expense") {
    typeFilter = { in: ["EXPENSE", "SALES"] }
  } else {
    typeFilter = { in: ["TRANSFER"] }
  }

  const where: Record<string, unknown> = {
    type: typeFilter,
    parentId: null,
    linkedTransactionId: { not: null },
  }
  if (params.category === "lending") {
    where.fundTransfer = { counterCompanyId: { not: null } }
  } else {
    // 経費/売上原価: linkedTransactionId 経由で相手会社判定
    where.companyGroupLinked = true
  }
  if (params.accountingMonth) where.accountingMonth = params.accountingMonth
  if (params.companyId) {
    where.companyId = params.companyId
  }

  // 支払側のみ取得（amount<0 を SQL where に押し込み、JS filter を排除）
  delete where.companyGroupLinked
  where.amount = { lt: BigInt(0) }
  const outgoingOnly = await prisma.transaction.findMany({
    where,
    orderBy: [{ transactionDate: "desc" }, { createdAt: "desc" }],
    include: {
      company: { select: { id: true, name: true, shortName: true } },
      account: { select: { id: true, bankName: true, branchName: true } },
      partner: { select: { id: true, name: true } },
      fundTransfer: {
        include: {
          fromAccount: { select: { id: true, bankName: true, branchName: true } },
          toAccount: { select: { id: true, bankName: true, branchName: true } },
        },
      },
    },
  })

  // 並列化: linkedTransaction と counterCompany 解決を1ラウンドトリップで
  const linkedIds = outgoingOnly
    .map((r) => r.linkedTransactionId)
    .filter((v): v is string => !!v)
  const counterIds = Array.from(
    new Set(
      outgoingOnly
        .map((r) => r.fundTransfer?.counterCompanyId)
        .filter((v): v is string => !!v)
    )
  )
  const [linkedRows, counterCompanies] = await Promise.all([
    linkedIds.length > 0
      ? prisma.transaction.findMany({
          where: { id: { in: linkedIds } },
          // select 絞り込み: 必要カラムのみ
          select: {
            id: true,
            company: { select: { id: true, name: true, shortName: true } },
            account: { select: { id: true, bankName: true, branchName: true } },
          },
        })
      : Promise.resolve([] as Array<{
          id: string
          company: { id: string; name: string; shortName: string | null } | null
          account: { id: string; bankName: string | null; branchName: string | null } | null
        }>),
    counterIds.length > 0
      ? prisma.company.findMany({
          where: { id: { in: counterIds } },
          select: { id: true, name: true, shortName: true },
        })
      : Promise.resolve([] as Array<{ id: string; name: string; shortName: string | null }>),
  ])
  const linkedMap = new Map(linkedRows.map((l) => [l.id, l]))
  const counterMap = new Map(counterCompanies.map((c) => [c.id, c]))

  return bigintToJson(
    outgoingOnly.map((r) => {
      const linked = r.linkedTransactionId ? linkedMap.get(r.linkedTransactionId) : null
      const counterCompany =
        linked?.company ??
        (r.fundTransfer?.counterCompanyId
          ? counterMap.get(r.fundTransfer.counterCompanyId) ?? null
          : null)
      return {
        ...r,
        counterCompany,
        counterAccount: linked?.account ?? r.fundTransfer?.toAccount ?? null,
      }
    })
  )
}

// ------------------------------------------------------------
// 売上原価: 支払側=COST_PAYMENT、受取側=SALES
// ------------------------------------------------------------
export async function createInterGroupSale(data: {
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
  return createInterGroupNonTransfer({ ...data, category: "sale" })
}

// ------------------------------------------------------------
// 経費: 支払側=EXPENSE、受取側=SALES（雑収入）
// ------------------------------------------------------------
export async function createInterGroupExpense(data: {
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
  return createInterGroupNonTransfer({ ...data, category: "expense" })
}

async function createInterGroupNonTransfer(data: {
  payerCompanyId: string
  payerAccountId: string
  receiverCompanyId: string
  receiverAccountId: string
  transactionDate: string
  accountingMonth: string
  amount: string
  summary?: string
  classification?: string
  category: "sale" | "expense"
}) {
  await requireSession()
  await ensureSameGroup(data.payerCompanyId, data.receiverCompanyId)
  const amount = BigInt(data.amount)
  if (amount <= BigInt(0)) throw new Error("金額は正の数で入力してください")
  const transactionDate = new Date(data.transactionDate)

  const payerType = payerTypeFor(data.category)
  const receiverType = receiverTypeFor(data.category)

  const labelPair =
    data.category === "sale"
      ? { out: "グループ間原価支払", in: "グループ間売上" }
      : { out: "グループ間経費", in: "グループ間収益" }

  const result = await prisma.$transaction(async (tx) => {
    const out = await tx.transaction.create({
      data: {
        companyId: data.payerCompanyId,
        accountId: data.payerAccountId,
        type: payerType,
        transactionDate,
        accountingMonth: data.accountingMonth,
        amount: -amount,
        summary: data.summary || labelPair.out,
        classification: data.classification || null,
      },
    })

    const inn = await tx.transaction.create({
      data: {
        companyId: data.receiverCompanyId,
        accountId: data.receiverAccountId,
        type: receiverType,
        transactionDate,
        accountingMonth: data.accountingMonth,
        amount: amount,
        summary: data.summary || labelPair.in,
        classification: data.classification || null,
        linkedTransactionId: out.id,
      },
    })

    await tx.transaction.update({
      where: { id: out.id },
      data: { linkedTransactionId: inn.id },
    })

    return { out, inn }
  })

  revalidatePath("/inter-group")
  revalidatePath("/cashflow-table")
  revalidatePath("/dashboard")
  return bigintToJson(result)
}

// ------------------------------------------------------------
// 貸借（既存挙動）: 支払側=TRANSFER(−)、受取側=TRANSFER(+) ＋ FundTransfer
// ------------------------------------------------------------
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

// ------------------------------------------------------------
// 更新（カテゴリ自動判定）
// ------------------------------------------------------------
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
      // 並列化: 双方の transaction.update は独立、fundTransfer は別 PK
      const updates: Promise<unknown>[] = [
        tx.transaction.update({
          where: { id: payer.id },
          data: { ...update, amount: -amount, amountUpdatedAt: new Date() },
        }),
        tx.transaction.update({
          where: { id: payer.linkedTransactionId! },
          data: { ...update, amount, amountUpdatedAt: new Date() },
        }),
      ]
      if (payer.fundTransfer) {
        updates.push(
          tx.fundTransfer.update({
            where: { transactionId: payer.id },
            data: {
              amount,
              transferDate: data.transactionDate
                ? new Date(data.transactionDate)
                : undefined,
            },
          })
        )
      }
      await Promise.all(updates)
    } else {
      // 並列化: 双方の transaction.update + fundTransfer.update は独立
      const updates: Promise<unknown>[] = [
        tx.transaction.update({ where: { id: payer.id }, data: update }),
        tx.transaction.update({
          where: { id: payer.linkedTransactionId! },
          data: update,
        }),
      ]
      if (payer.fundTransfer && data.transactionDate) {
        updates.push(
          tx.fundTransfer.update({
            where: { transactionId: payer.id },
            data: { transferDate: new Date(data.transactionDate) },
          })
        )
      }
      await Promise.all(updates)
    }
  })

  revalidatePath("/inter-group")
  revalidatePath("/cashflow-table")
  revalidatePath("/dashboard")
}

// ------------------------------------------------------------
// 削除（カテゴリ自動判定）
// ------------------------------------------------------------
export async function deleteInterGroupTransaction(payerTransactionId: string) {
  await requireSession()
  const payer = await prisma.transaction.findUnique({
    where: { id: payerTransactionId },
  })
  if (!payer) throw new Error("取引が見つかりません")

  await prisma.$transaction(async (tx) => {
    if (payer.linkedTransactionId) {
      // 並列化: fundTransfer 削除 と linkedTransactionId のリンク解除は独立
      await Promise.all([
        tx.fundTransfer.deleteMany({ where: { transactionId: payer.id } }),
        tx.transaction.update({
          where: { id: payer.linkedTransactionId },
          data: { linkedTransactionId: null },
        }),
      ])
      // 双方の transaction.delete は両方リンク解除済みなので並列実行可
      await Promise.all([
        tx.transaction.delete({ where: { id: payer.linkedTransactionId } }),
        tx.transaction.delete({ where: { id: payer.id } }),
      ])
    } else {
      await tx.transaction.delete({ where: { id: payer.id } })
    }
  })

  revalidatePath("/inter-group")
  revalidatePath("/cashflow-table")
  revalidatePath("/dashboard")
}

// ------------------------------------------------------------
// 前月コピー（PDF赤字メモ「入力内容は前月値反映」要件）
// 前月のグループ間取引（指定カテゴリ）を当月の計上月でコピーする。
// 経費の固定/変動/臨時 区分はそのまま踏襲（classification をコピー）。
// 既存月にデータがある場合はそのまま追加する（重複排除は呼出側で確認）。
// ------------------------------------------------------------
export async function copyPreviousMonthInterGroup(params: {
  companyId: string
  category: InterGroupCategory
  targetMonth: string  // YYYY-MM
}) {
  await requireSession()
  // 前月計算
  const [yStr, mStr] = params.targetMonth.split("-")
  const y = parseInt(yStr, 10)
  const m = parseInt(mStr, 10)
  const prev = new Date(y, m - 2, 1)
  const prevMonth = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`

  const sources = await getInterGroupTransactions({
    companyId: params.companyId,
    accountingMonth: prevMonth,
    category: params.category,
  })

  if (!Array.isArray(sources) || sources.length === 0) {
    return { copied: 0, prevMonth }
  }

  // 並列化: 取引コピーを Promise.all で同時実行（順序非依存）
  const tasks: Promise<unknown>[] = []
  for (const s of sources as Array<{
    transactionDate?: string | null
    accountId: string
    amount: string
    summary: string | null
    classification: string | null
    counterCompany: { id: string } | null
    counterAccount: { id: string } | null
  }>) {
    if (!s.counterCompany?.id || !s.counterAccount?.id) continue
    if (!s.transactionDate) continue
    const original = new Date(s.transactionDate)
    const day = Math.min(original.getDate(), 28)
    const newDate = new Date(y, m - 1, day)
    const newDateStr = newDate.toISOString().slice(0, 10)

    const absAmount = (-BigInt(s.amount)).toString()
    const payload = {
      payerCompanyId: params.companyId,
      payerAccountId: s.accountId,
      receiverCompanyId: s.counterCompany.id,
      receiverAccountId: s.counterAccount.id,
      transactionDate: newDateStr,
      accountingMonth: params.targetMonth,
      amount: absAmount,
      summary: s.summary ?? undefined,
      classification: s.classification ?? undefined,
    }

    if (params.category === "sale") {
      tasks.push(createInterGroupSale(payload))
    } else if (params.category === "expense") {
      tasks.push(createInterGroupExpense(payload))
    } else {
      tasks.push(createInterGroupTransaction(payload))
    }
  }
  await Promise.all(tasks)
  const copied = tasks.length

  return { copied, prevMonth }
}

// ============================================================
// 入力フォーム用のヘルパ：同一グループ会社一覧
// ============================================================
export async function getGroupCompaniesFor(companyId: string) {
  await requireSession()
  // 1クエリ目で groupIds を取得 (依存あり)
  const memberships = await prisma.companyGroupMember.findMany({
    where: { companyId },
    select: { groupId: true },
  })
  const groupIds = memberships.map((m) => m.groupId)
  if (groupIds.length === 0) return []

  // 2クエリ目で peer companies を1回で取得（peerIds 中間 findMany を集約）
  const peers = await prisma.companyGroupMember.findMany({
    where: { groupId: { in: groupIds }, companyId: { not: companyId } },
    select: { companyId: true },
    distinct: ["companyId"],
  })
  const peerIds = peers.map((p) => p.companyId)
  if (peerIds.length === 0) return []

  return prisma.company.findMany({
    where: { id: { in: peerIds }, status: { not: "LIQUIDATING" } },
    select: { id: true, name: true, shortName: true },
    orderBy: { displayOrder: "asc" },
  })
}
