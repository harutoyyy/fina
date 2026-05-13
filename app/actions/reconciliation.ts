"use server"

import { prisma } from "@/lib/prisma"
import { requireSession } from "@/lib/auth-server"
import { revalidatePath } from "next/cache"
import { bigintToJson } from "@/lib/format"
import { getCurrentUserProfile } from "@/app/actions/user-profile"

async function verifyCompanyAccess(companyId: string) {
  const company = await prisma.company.findUnique({ where: { id: companyId } })
  if (!company) throw new Error("Company not found")
  return company
}

export async function getCheckpoints(companyId: string, accountId: string, yearMonth: string) {
  await requireSession()
  await verifyCompanyAccess(companyId)

  const checkpoints = await prisma.reconciliationCheckpoint.findMany({
    where: { companyId, accountId, yearMonth },
    orderBy: { checkpointDate: "asc" },
  })

  return bigintToJson(checkpoints) as {
    id: string
    companyId: string
    accountId: string
    checkpointDate: string
    yearMonth: string
    verifiedBalance: string
    verifiedBy: string
    verifiedAt: string
    note: string | null
  }[]
}

export async function createCheckpoint(data: {
  companyId: string
  accountId: string
  checkpointDate: string
  yearMonth: string
  verifiedBalance: string
  note?: string
}) {
  const session = await requireSession()
  await verifyCompanyAccess(data.companyId)

  // VIEWER, ADMIN: 作成可能 / OPERATOR: ブロック
  const profile = await getCurrentUserProfile()
  if (profile?.role === "OPERATOR") {
    throw new Error("照合点の設定は管理者または閲覧者のみ実行できます")
  }

  const result = await prisma.reconciliationCheckpoint.create({
    data: {
      companyId: data.companyId,
      accountId: data.accountId,
      checkpointDate: new Date(data.checkpointDate),
      yearMonth: data.yearMonth,
      verifiedBalance: BigInt(data.verifiedBalance),
      verifiedBy: session.user.id,
      note: data.note || null,
    },
  })

  revalidatePath("/cashflow-table")
  return bigintToJson(result)
}

export async function updateCheckpoint(
  id: string,
  companyId: string,
  data: {
    verifiedBalance?: string
    note?: string | null
  }
) {
  await requireSession()
  await verifyCompanyAccess(companyId)

  const profile = await getCurrentUserProfile()
  if (profile?.role === "OPERATOR") {
    throw new Error("照合点の編集は管理者または閲覧者のみ実行できます")
  }

  const existing = await prisma.reconciliationCheckpoint.findUnique({ where: { id } })
  if (!existing || existing.companyId !== companyId) {
    throw new Error("Checkpoint not found")
  }

  const updateData: Record<string, unknown> = {}
  if (data.verifiedBalance !== undefined) updateData.verifiedBalance = BigInt(data.verifiedBalance)
  if (data.note !== undefined) updateData.note = data.note

  const result = await prisma.reconciliationCheckpoint.update({
    where: { id },
    data: updateData,
  })

  revalidatePath("/cashflow-table")
  return bigintToJson(result)
}

export async function deleteCheckpoint(id: string, companyId: string) {
  await requireSession()
  await verifyCompanyAccess(companyId)

  // 削除: ADMIN のみ
  const profile = await getCurrentUserProfile()
  if (profile?.role !== "ADMIN") {
    throw new Error("照合点の削除は管理者のみ実行できます")
  }

  const existing = await prisma.reconciliationCheckpoint.findUnique({ where: { id } })
  if (!existing || existing.companyId !== companyId) {
    throw new Error("Checkpoint not found")
  }

  await prisma.reconciliationCheckpoint.delete({ where: { id } })
  revalidatePath("/cashflow-table")
}
