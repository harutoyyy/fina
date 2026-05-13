"use server"

import { prisma } from "@/lib/prisma"
import { requireSession } from "@/lib/auth-server"
import { revalidatePath } from "next/cache"
import { createAuditLog } from "@/lib/audit-log"

export async function getBanks(query?: string) {
  await requireSession()
  return prisma.bankMaster.findMany({
    where: query
      ? {
          OR: [
            { bankCode: { contains: query } },
            { bankName: { contains: query } },
            { bankNameKana: { contains: query } },
          ],
        }
      : undefined,
    orderBy: { bankCode: "asc" },
    take: 100,
  })
}

export async function getBankWithBranches(bankCode: string) {
  await requireSession()
  return prisma.bankMaster.findUnique({
    where: { bankCode },
    include: {
      branches: {
        orderBy: { branchCode: "asc" },
      },
    },
  })
}

export async function searchBranches(bankCode: string, query?: string) {
  await requireSession()
  return prisma.branchMaster.findMany({
    where: {
      bankCode,
      ...(query
        ? {
            OR: [
              { branchCode: { contains: query } },
              { branchName: { contains: query } },
              { branchNameKana: { contains: query } },
            ],
          }
        : {}),
    },
    orderBy: { branchCode: "asc" },
    take: 100,
  })
}

export async function createBank(data: {
  bankCode: string
  bankName: string
  bankNameKana?: string
}) {
  const session = await requireSession()
  const result = await prisma.bankMaster.create({ data })

  await createAuditLog({
    tableName: "bank_masters_fina",
    recordId: result.id,
    operation: "CREATE",
    userId: session.user.id,
    afterData: data as Record<string, unknown>,
  })

  revalidatePath("/master/banks")
  return result
}

export async function updateBank(
  bankCode: string,
  data: { bankName?: string; bankNameKana?: string; isActive?: boolean }
) {
  const session = await requireSession()

  const existing = await prisma.bankMaster.findUnique({ where: { bankCode } })
  if (!existing) throw new Error("Bank not found")

  const result = await prisma.bankMaster.update({
    where: { bankCode },
    data,
  })

  await createAuditLog({
    tableName: "bank_masters_fina",
    recordId: result.id,
    operation: "UPDATE",
    userId: session.user.id,
    beforeData: existing as unknown as Record<string, unknown>,
    afterData: data as Record<string, unknown>,
  })

  revalidatePath("/master/banks")
  return result
}

export async function createBranch(data: {
  bankCode: string
  branchCode: string
  branchName: string
  branchNameKana?: string
}) {
  const session = await requireSession()
  const result = await prisma.branchMaster.create({ data })

  await createAuditLog({
    tableName: "branch_masters_fina",
    recordId: result.id,
    operation: "CREATE",
    userId: session.user.id,
    afterData: data as Record<string, unknown>,
  })

  revalidatePath("/master/banks")
  return result
}

export async function updateBranch(
  id: string,
  data: { branchName?: string; branchNameKana?: string; isActive?: boolean }
) {
  const session = await requireSession()

  const existing = await prisma.branchMaster.findUnique({ where: { id } })
  if (!existing) throw new Error("Branch not found")

  const result = await prisma.branchMaster.update({
    where: { id },
    data,
  })

  await createAuditLog({
    tableName: "branch_masters_fina",
    recordId: result.id,
    operation: "UPDATE",
    userId: session.user.id,
    beforeData: existing as unknown as Record<string, unknown>,
    afterData: data as Record<string, unknown>,
  })

  revalidatePath("/master/banks")
  return result
}

export async function seedMajorBanks() {
  const session = await requireSession()

  const majorBanks = [
    { bankCode: "0001", bankName: "みずほ銀行", bankNameKana: "ミズホ" },
    { bankCode: "0005", bankName: "三菱UFJ銀行", bankNameKana: "ミツビシユーエフジェイ" },
    { bankCode: "0009", bankName: "三井住友銀行", bankNameKana: "ミツイスミトモ" },
    { bankCode: "0010", bankName: "りそな銀行", bankNameKana: "リソナ" },
    { bankCode: "0017", bankName: "埼玉りそな銀行", bankNameKana: "サイタマリソナ" },
    { bankCode: "0033", bankName: "PayPay銀行", bankNameKana: "ペイペイ" },
    { bankCode: "0034", bankName: "セブン銀行", bankNameKana: "セブン" },
    { bankCode: "0035", bankName: "ソニー銀行", bankNameKana: "ソニー" },
    { bankCode: "0036", bankName: "楽天銀行", bankNameKana: "ラクテン" },
    { bankCode: "0038", bankName: "住信SBIネット銀行", bankNameKana: "スミシンエスビーアイネット" },
    { bankCode: "0039", bankName: "auじぶん銀行", bankNameKana: "エーユージブン" },
    { bankCode: "0040", bankName: "イオン銀行", bankNameKana: "イオン" },
    { bankCode: "0116", bankName: "北海道銀行", bankNameKana: "ホッカイドウ" },
    { bankCode: "0117", bankName: "青森銀行", bankNameKana: "アオモリ" },
    { bankCode: "0118", bankName: "みちのく銀行", bankNameKana: "ミチノク" },
    { bankCode: "0119", bankName: "秋田銀行", bankNameKana: "アキタ" },
    { bankCode: "0120", bankName: "北都銀行", bankNameKana: "ホクト" },
    { bankCode: "0121", bankName: "荘内銀行", bankNameKana: "ショウナイ" },
    { bankCode: "0122", bankName: "山形銀行", bankNameKana: "ヤマガタ" },
    { bankCode: "0125", bankName: "岩手銀行", bankNameKana: "イワテ" },
    { bankCode: "0126", bankName: "東北銀行", bankNameKana: "トウホク" },
    { bankCode: "0128", bankName: "七十七銀行", bankNameKana: "シチジュウシチ" },
    { bankCode: "0129", bankName: "東邦銀行", bankNameKana: "トウホウ" },
    { bankCode: "0130", bankName: "群馬銀行", bankNameKana: "グンマ" },
    { bankCode: "0131", bankName: "足利銀行", bankNameKana: "アシカガ" },
    { bankCode: "0133", bankName: "常陽銀行", bankNameKana: "ジョウヨウ" },
    { bankCode: "0134", bankName: "筑波銀行", bankNameKana: "ツクバ" },
    { bankCode: "0135", bankName: "武蔵野銀行", bankNameKana: "ムサシノ" },
    { bankCode: "0137", bankName: "千葉銀行", bankNameKana: "チバ" },
    { bankCode: "0138", bankName: "千葉興業銀行", bankNameKana: "チバコウギョウ" },
    { bankCode: "0140", bankName: "きらぼし銀行", bankNameKana: "キラボシ" },
    { bankCode: "0142", bankName: "横浜銀行", bankNameKana: "ヨコハマ" },
    { bankCode: "9900", bankName: "ゆうちょ銀行", bankNameKana: "ユウチョ" },
  ]

  let created = 0
  for (const bank of majorBanks) {
    const exists = await prisma.bankMaster.findUnique({
      where: { bankCode: bank.bankCode },
    })
    if (!exists) {
      await prisma.bankMaster.create({ data: bank })
      created++
    }
  }

  await createAuditLog({
    tableName: "bank_masters_fina",
    recordId: "seed",
    operation: "CREATE",
    userId: session.user.id,
    afterData: { action: "seedMajorBanks", created, total: majorBanks.length },
  })

  revalidatePath("/master/banks")
  return { created, total: majorBanks.length }
}
