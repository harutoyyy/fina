"use server"

/**
 * 資金繰表からの帳票生成 (PDF P1〜P2)
 * - 資金移動帳票: 自社口座 → 移動先口座
 * - 振込帳票: 振込先口座情報＋自社負担＋振込手数料＋合計
 * - 現金帳票: 出金口座＋金種表（10000/5000/1000/500/100/50/10/5/1）
 *
 * いずれも「連続した選択行（同一種別）」前提で取引IDの配列を受け取り、
 * 印刷可能な構造化データを返す。クライアント側で別ウィンドウHTMLとして印刷する。
 */

import { prisma } from "@/lib/prisma"
import { requireSession } from "@/lib/auth-server"

export type CompanyHeader = {
  companyName: string
  shortName: string | null
  representativeName: string | null
  postalCode: string | null
  address: string | null
  phone: string | null
  invoiceNumber: string | null
  corporateNumber: string | null
}

export type AccountInfo = {
  bankName: string | null
  bankCode: string | null
  branchName: string | null
  branchCode: string | null
  accountType: string | null
  accountNumber: string | null
  accountHolder: string | null
}

export type ReportRow = {
  id: string
  date: string | null     // 実日付 or 予定日 (YYYY-MM-DD)
  partnerName: string
  summary: string
  amount: string          // 絶対値の文字列（万円・円表記用）
  // 振込帳票専用
  partnerBank: AccountInfo | null
  feeBornBy: "SELF" | "PARTNER" | null
  feeAmount: string | null
}

export type FundTransferReport = {
  type: "FUND_TRANSFER"
  date: string
  selfAccount: AccountInfo
  destinationAccount: AccountInfo | null  // 資金移動先口座（FundTransfer から特定）
  rows: ReportRow[]
  totalAmount: string
  company: CompanyHeader
}

export type BankTransferReport = {
  type: "BANK_TRANSFER"
  date: string
  selfAccount: AccountInfo
  rows: ReportRow[]
  totalAmount: string         // 振込元金合計
  totalFeeAmount: string      // 自社負担手数料合計
  company: CompanyHeader
}

export type CashReport = {
  type: "CASH"
  date: string
  selfAccount: AccountInfo
  rows: ReportRow[]
  totalAmount: string
  // 金種表（合計のみ。明細ごとの内訳は手書きする想定）
  denominations: { value: number; count: number }[]
  company: CompanyHeader
}

export type CashFlowReport = FundTransferReport | BankTransferReport | CashReport

function buildCompanyHeader(c: {
  name: string
  shortName: string | null
  representativeName: string | null
  postalCode: string | null
  addressPrefecture: string | null
  addressCity: string | null
  addressStreet: string | null
  addressBuilding: string | null
  phone: string | null
  invoiceNumber: string | null
  corporateNumber: string | null
}): CompanyHeader {
  const address = [
    c.addressPrefecture,
    c.addressCity,
    c.addressStreet,
    c.addressBuilding,
  ]
    .filter(Boolean)
    .join("")
  return {
    companyName: c.name,
    shortName: c.shortName,
    representativeName: c.representativeName,
    postalCode: c.postalCode,
    address: address || null,
    phone: c.phone,
    invoiceNumber: c.invoiceNumber,
    corporateNumber: c.corporateNumber,
  }
}

function buildAccountInfo(a: {
  bankName: string | null
  bankCode: string | null
  branchName: string | null
  branchCode: string | null
  accountType: string
  accountNumber: string | null
  accountHolder: string | null
}): AccountInfo {
  return {
    bankName: a.bankName,
    bankCode: a.bankCode,
    branchName: a.branchName,
    branchCode: a.branchCode,
    accountType:
      a.accountType === "ORDINARY"
        ? "普通"
        : a.accountType === "CURRENT"
        ? "当座"
        : a.accountType,
    accountNumber: a.accountNumber,
    accountHolder: a.accountHolder,
  }
}

function buildPartnerAccountInfo(b: {
  bankCode: string
  branchCode: string
  accountType: string
  accountNumber: string
  accountHolder: string
}): AccountInfo {
  return {
    bankName: null,
    bankCode: b.bankCode,
    branchName: null,
    branchCode: b.branchCode,
    accountType: b.accountType === "ORDINARY" ? "普通" : "当座",
    accountNumber: b.accountNumber,
    accountHolder: b.accountHolder,
  }
}

export async function generateCashFlowReport(
  companyId: string,
  transactionIds: string[]
): Promise<CashFlowReport> {
  await requireSession()
  if (transactionIds.length === 0) {
    throw new Error("帳票作成には1件以上の取引を選択してください")
  }

  const [company, txs] = await Promise.all([
    prisma.company.findUnique({
      where: { id: companyId },
      select: {
        name: true,
        shortName: true,
        representativeName: true,
        postalCode: true,
        addressPrefecture: true,
        addressCity: true,
        addressStreet: true,
        addressBuilding: true,
        phone: true,
        invoiceNumber: true,
        corporateNumber: true,
      },
    }),
    prisma.transaction.findMany({
      where: { id: { in: transactionIds }, companyId },
      include: {
        account: true,
        partner: { include: { bankAccounts: true } },
        fundTransfer: { include: { toAccount: true } },
      },
      orderBy: [{ scheduledDate: "asc" }, { displayOrder: "asc" }],
    }),
  ])

  if (!company) throw new Error("会社が見つかりません")
  if (txs.length === 0) throw new Error("取引が見つかりません")

  const sample = txs[0]
  const selfAccount = buildAccountInfo(sample.account)
  const date = (sample.transactionDate ?? sample.scheduledDate)
    ?.toISOString()
    .split("T")[0] ?? ""
  const companyHeader = buildCompanyHeader(company)

  // 同一種別チェック（資金移動 or 振込 or 現金）
  const isAllFundTransfer = txs.every((t) => t.type === "TRANSFER")
  const isAllBankTransfer = txs.every(
    (t) => t.paymentMethod === "BANK_TRANSFER" && t.type !== "TRANSFER"
  )
  const isAllCash = txs.every((t) => t.paymentMethod === "CASH_WITHDRAWAL")

  if (!isAllFundTransfer && !isAllBankTransfer && !isAllCash) {
    throw new Error(
      "選択した取引の種別が混在しています。同じ種別（資金移動 / 振込 / 現金）の行のみ選択してください。"
    )
  }

  let totalAmount = BigInt(0)
  const rows: ReportRow[] = txs.map((t) => {
    const abs = t.amount < BigInt(0) ? -t.amount : t.amount
    totalAmount += abs
    const partnerBank = t.partner?.bankAccounts.find((b) => b.isActive) ?? null
    return {
      id: t.id,
      date: (t.transactionDate ?? t.scheduledDate)?.toISOString().split("T")[0] ?? null,
      partnerName: t.partner?.name ?? t.temporaryVendorName ?? "",
      summary: t.summary ?? "",
      amount: abs.toString(),
      partnerBank: partnerBank ? buildPartnerAccountInfo(partnerBank) : null,
      feeBornBy: null,    // TODO: スキーマに手数料負担情報があれば取得
      feeAmount: null,
    }
  })

  if (isAllFundTransfer) {
    // 移動先口座を FundTransfer から取得（複数取引なら先頭の移動先）
    const destAccount = sample.fundTransfer?.toAccount
      ? buildAccountInfo(sample.fundTransfer.toAccount)
      : null
    return {
      type: "FUND_TRANSFER",
      date,
      selfAccount,
      destinationAccount: destAccount,
      rows,
      totalAmount: totalAmount.toString(),
      company: companyHeader,
    }
  }

  if (isAllBankTransfer) {
    // 振込手数料は account.feeSettings から推定するロジックは省略し、
    // ヘッダーのみ表示。明細単位の手数料はクライアント側で手入力可能にする。
    return {
      type: "BANK_TRANSFER",
      date,
      selfAccount,
      rows,
      totalAmount: totalAmount.toString(),
      totalFeeAmount: "0",
      company: companyHeader,
    }
  }

  // CASH
  const denominations = [10000, 5000, 1000, 500, 100, 50, 10, 5, 1].map((v) => ({
    value: v,
    count: 0,
  }))
  return {
    type: "CASH",
    date,
    selfAccount,
    rows,
    totalAmount: totalAmount.toString(),
    denominations,
    company: companyHeader,
  }
}
