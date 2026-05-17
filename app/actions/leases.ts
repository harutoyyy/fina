"use server"

import { prisma } from "@/lib/prisma"
import { requireSession } from "@/lib/auth-server"
import { revalidatePath } from "next/cache"
import { bigintToJson } from "@/lib/format"

export async function getLeases(companyId: string) {
  await requireSession()
  const leases = await prisma.leaseContract.findMany({
    where: { companyId },
    orderBy: { createdAt: "desc" },
    include: {
      schedules: {
        orderBy: { paymentNumber: "asc" },
      },
    },
  })
  return bigintToJson(leases)
}

export async function getLease(id: string, companyId: string) {
  await requireSession()
  const lease = await prisma.leaseContract.findUnique({
    where: { id },
    include: {
      schedules: {
        orderBy: { paymentNumber: "asc" },
      },
    },
  })
  if (!lease || lease.companyId !== companyId) {
    throw new Error("LeaseContract not found")
  }
  return bigintToJson(lease)
}

export async function createLease(data: {
  companyId: string
  partnerId?: string
  contractName: string
  monthlyAmount: string
  startDate: string
  endDate?: string
  totalPayments?: number
  paymentDay?: number
  holidayAdjust?: string
  principalAdjust?: string
  accountId?: string
  midId?: string
  subId?: string
  assetCategory?: string
  vehicleModel?: string
  vehicleNumber?: string
}) {
  await requireSession()

  // ネスト書き込みで Contract + Schedule を 1 トランザクションで作成
  const monthlyAmount = BigInt(data.monthlyAmount)
  const startDate = new Date(data.startDate)
  const paymentDay = data.paymentDay || startDate.getDate()

  const scheduleItems: Array<{
    paymentNumber: number
    dueDate: Date
    amount: bigint
    isPaid: boolean
  }> = []
  if (data.totalPayments && data.totalPayments > 0) {
    for (let i = 0; i < data.totalPayments; i++) {
      const dueDate = new Date(startDate.getFullYear(), startDate.getMonth() + i, paymentDay)
      if (paymentDay > 28) {
        const lastDay = new Date(dueDate.getFullYear(), dueDate.getMonth() + 1, 0).getDate()
        if (paymentDay > lastDay) {
          dueDate.setDate(lastDay)
        }
      }
      scheduleItems.push({
        paymentNumber: i + 1,
        dueDate,
        amount: monthlyAmount,
        isPaid: false,
      })
    }
  }

  const result = await prisma.leaseContract.create({
    data: {
      companyId: data.companyId,
      partnerId: data.partnerId || undefined,
      contractName: data.contractName,
      monthlyAmount,
      startDate,
      endDate: data.endDate ? new Date(data.endDate) : undefined,
      totalPayments: data.totalPayments || undefined,
      paymentDay: data.paymentDay || undefined,
      holidayAdjust: data.holidayAdjust || "PREV_BUSINESS",
      principalAdjust: data.principalAdjust || "LAST",
      accountId: data.accountId || undefined,
      midId: data.midId || undefined,
      subId: data.subId || undefined,
      assetCategory: data.assetCategory || "OTHER",
      vehicleModel: data.vehicleModel || undefined,
      vehicleNumber: data.vehicleNumber || undefined,
      ...(scheduleItems.length > 0
        ? {
            schedules: {
              create: scheduleItems,
            },
          }
        : {}),
    },
    include: {
      schedules: {
        orderBy: { paymentNumber: "asc" },
      },
    },
  })

  revalidatePath("/leases")
  return bigintToJson(result)
}

export async function updateLease(
  id: string,
  companyId: string,
  data: {
    partnerId?: string | null
    contractName?: string
    monthlyAmount?: string
    startDate?: string
    endDate?: string | null
    totalPayments?: number | null
    paymentDay?: number | null
    holidayAdjust?: string
    principalAdjust?: string
    accountId?: string | null
    midId?: string | null
    subId?: string | null
    status?: string
    assetCategory?: string
    vehicleModel?: string | null
    vehicleNumber?: string | null
  }
) {
  await requireSession()

  const existing = await prisma.leaseContract.findUnique({
    where: { id },
    select: { companyId: true },
  })
  if (!existing || existing.companyId !== companyId) {
    throw new Error("LeaseContract not found")
  }

  const updateData: Record<string, unknown> = {}
  if (data.partnerId !== undefined) updateData.partnerId = data.partnerId
  if (data.contractName !== undefined) updateData.contractName = data.contractName
  if (data.monthlyAmount !== undefined) updateData.monthlyAmount = BigInt(data.monthlyAmount)
  if (data.startDate !== undefined) updateData.startDate = new Date(data.startDate)
  if (data.endDate !== undefined) updateData.endDate = data.endDate ? new Date(data.endDate) : null
  if (data.totalPayments !== undefined) updateData.totalPayments = data.totalPayments
  if (data.paymentDay !== undefined) updateData.paymentDay = data.paymentDay
  if (data.holidayAdjust !== undefined) updateData.holidayAdjust = data.holidayAdjust
  if (data.principalAdjust !== undefined) updateData.principalAdjust = data.principalAdjust
  if (data.accountId !== undefined) updateData.accountId = data.accountId
  if (data.midId !== undefined) updateData.midId = data.midId
  if (data.subId !== undefined) updateData.subId = data.subId
  if (data.status !== undefined) updateData.status = data.status
  if (data.assetCategory !== undefined) updateData.assetCategory = data.assetCategory
  if (data.vehicleModel !== undefined) updateData.vehicleModel = data.vehicleModel
  if (data.vehicleNumber !== undefined) updateData.vehicleNumber = data.vehicleNumber

  const result = await prisma.leaseContract.update({
    where: { id },
    data: updateData,
    include: {
      schedules: {
        orderBy: { paymentNumber: "asc" },
      },
    },
  })

  revalidatePath("/leases")
  return bigintToJson(result)
}

export async function deleteLease(id: string, companyId: string) {
  await requireSession()

  const existing = await prisma.leaseContract.findUnique({
    where: { id },
    select: { companyId: true },
  })
  if (!existing || existing.companyId !== companyId) {
    throw new Error("LeaseContract not found")
  }

  await prisma.leaseContract.delete({ where: { id } })
  revalidatePath("/leases")
}

export async function regenerateLeaseSchedule(id: string, companyId: string) {
  await requireSession()

  // 契約取得と既存スケジュール削除を並列実行 + 支払済件数を count で取得 (JS array 不要)
  const [contract, , paidCount] = await Promise.all([
    prisma.leaseContract.findUnique({ where: { id } }),
    prisma.leaseSchedule.deleteMany({
      where: { contractId: id, isPaid: false },
    }),
    prisma.leaseSchedule.count({
      where: { contractId: id, isPaid: true },
    }),
  ])
  if (!contract || contract.companyId !== companyId) {
    throw new Error("LeaseContract not found")
  }

  const totalPayments = contract.totalPayments ?? 12
  const startDate = contract.startDate
  const paymentDay = contract.paymentDay ?? startDate.getDate()
  const monthlyAmount = contract.monthlyAmount
  const remaining = totalPayments - paidCount

  if (remaining > 0) {
    const schedules = []
    for (let i = 0; i < remaining; i++) {
      const payNum = paidCount + i + 1
      const date = new Date(startDate.getFullYear(), startDate.getMonth() + payNum - 1, 1)
      const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
      date.setDate(Math.min(paymentDay, lastDay))

      schedules.push({
        contractId: id,
        paymentNumber: payNum,
        dueDate: date,
        amount: monthlyAmount,
      })
    }

    await prisma.leaseSchedule.createMany({ data: schedules })
  }

  revalidatePath("/leases")
  const result = await prisma.leaseContract.findUnique({
    where: { id },
    include: { schedules: { orderBy: { paymentNumber: "asc" } } },
  })
  return bigintToJson(result)
}

export async function markLeaseSchedulePaid(
  scheduleId: string,
  companyId: string,
  transactionId?: string
) {
  await requireSession()

  const schedule = await prisma.leaseSchedule.findUnique({
    where: { id: scheduleId },
    include: { contract: { select: { companyId: true } } },
  })
  if (!schedule || schedule.contract.companyId !== companyId) {
    throw new Error("LeaseSchedule not found")
  }

  const result = await prisma.leaseSchedule.update({
    where: { id: scheduleId },
    data: {
      isPaid: true,
      transactionId: transactionId || undefined,
    },
  })

  revalidatePath("/leases")
  return bigintToJson(result)
}

// ============================================================
// 車両支払シミュレーション（PDF P9）
// assetCategory='VEHICLE' のリース契約 × 月 マトリクスを返す
// ============================================================

export async function getVehicleLeaseMatrix(params: {
  companyId: string
  fromMonth: string // "YYYY-MM"
  toMonth: string   // "YYYY-MM"
}) {
  await requireSession()
  if (!/^\d{4}-\d{2}$/.test(params.fromMonth) || !/^\d{4}-\d{2}$/.test(params.toMonth)) {
    throw new Error("月の形式が不正です")
  }

  // 月リストを生成
  const months: string[] = []
  const [fy, fm] = params.fromMonth.split("-").map(Number)
  const [ty, tm] = params.toMonth.split("-").map(Number)
  let y = fy
  let m = fm
  while (y < ty || (y === ty && m <= tm)) {
    months.push(`${y}-${String(m).padStart(2, "0")}`)
    m++
    if (m > 12) { m = 1; y++ }
  }
  const monthIdx = new Map(months.map((mm, i) => [mm, i]))

  // 期間に絞ったスケジュールのみ取得 (全件 → 範囲指定で削減)
  const fromDate = new Date(fy, fm - 1, 1)
  const toDate = new Date(ty, tm, 1) // exclusive

  const leases = await prisma.leaseContract.findMany({
    where: {
      companyId: params.companyId,
      assetCategory: "VEHICLE",
    },
    orderBy: { contractName: "asc" },
    select: {
      id: true,
      contractName: true,
      vehicleModel: true,
      vehicleNumber: true,
      monthlyAmount: true,
      schedules: {
        where: {
          dueDate: { gte: fromDate, lt: toDate },
        },
        select: { dueDate: true, amount: true },
      },
    },
  })

  // 行ごとに 1パスで cells / 行合計 / 月合計を計算
  const monthTotalsBig = new Array<bigint>(months.length).fill(BigInt(0))
  const rows = leases.map((lease) => {
    const cellAmounts = new Array<bigint>(months.length).fill(BigInt(0))
    let total = BigInt(0)
    for (const s of lease.schedules) {
      const ym = `${s.dueDate.getFullYear()}-${String(s.dueDate.getMonth() + 1).padStart(2, "0")}`
      const idx = monthIdx.get(ym)
      if (idx === undefined) continue
      cellAmounts[idx] += s.amount
      total += s.amount
      monthTotalsBig[idx] += s.amount
    }
    const cells = cellAmounts.map((v) => (v === BigInt(0) ? null : v.toString()))
    return {
      id: lease.id,
      contractName: lease.contractName,
      vehicleModel: lease.vehicleModel ?? "",
      vehicleNumber: lease.vehicleNumber ?? "",
      monthlyAmount: lease.monthlyAmount.toString(),
      cells,
      total: total.toString(),
    }
  })

  return {
    months,
    rows,
    monthTotals: monthTotalsBig.map((v) => v.toString()),
  }
}
