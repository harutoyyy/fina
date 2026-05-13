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

  const lease = await prisma.leaseContract.create({
    data: {
      companyId: data.companyId,
      partnerId: data.partnerId || undefined,
      contractName: data.contractName,
      monthlyAmount: BigInt(data.monthlyAmount),
      startDate: new Date(data.startDate),
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
    },
  })

  if (data.totalPayments && data.totalPayments > 0) {
    const monthlyAmount = BigInt(data.monthlyAmount)
    const paymentDay = data.paymentDay || new Date(data.startDate).getDate()
    const startDate = new Date(data.startDate)

    const schedules = []
    for (let i = 0; i < data.totalPayments; i++) {
      const dueDate = new Date(startDate.getFullYear(), startDate.getMonth() + i, paymentDay)
      if (paymentDay > 28) {
        const lastDay = new Date(dueDate.getFullYear(), dueDate.getMonth() + 1, 0).getDate()
        if (paymentDay > lastDay) {
          dueDate.setDate(lastDay)
        }
      }

      schedules.push({
        contractId: lease.id,
        paymentNumber: i + 1,
        dueDate,
        amount: monthlyAmount,
        isPaid: false,
      })
    }

    if (schedules.length > 0) {
      await prisma.leaseSchedule.createMany({ data: schedules })
    }
  }

  const result = await prisma.leaseContract.findUnique({
    where: { id: lease.id },
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

  const existing = await prisma.leaseContract.findUnique({ where: { id } })
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

  const existing = await prisma.leaseContract.findUnique({ where: { id } })
  if (!existing || existing.companyId !== companyId) {
    throw new Error("LeaseContract not found")
  }

  await prisma.leaseContract.delete({ where: { id } })
  revalidatePath("/leases")
}

export async function regenerateLeaseSchedule(id: string, companyId: string) {
  await requireSession()

  const contract = await prisma.leaseContract.findUnique({ where: { id } })
  if (!contract || contract.companyId !== companyId) {
    throw new Error("LeaseContract not found")
  }

  const totalPayments = contract.totalPayments ?? 12
  const startDate = contract.startDate
  const paymentDay = contract.paymentDay ?? startDate.getDate()
  const monthlyAmount = contract.monthlyAmount

  await prisma.leaseSchedule.deleteMany({
    where: { contractId: id, isPaid: false },
  })

  const paidSchedules = await prisma.leaseSchedule.findMany({
    where: { contractId: id, isPaid: true },
    orderBy: { paymentNumber: "asc" },
  })

  const paidCount = paidSchedules.length
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

  const leases = await prisma.leaseContract.findMany({
    where: {
      companyId: params.companyId,
      assetCategory: "VEHICLE",
    },
    orderBy: { contractName: "asc" },
    include: {
      schedules: {
        orderBy: { paymentNumber: "asc" },
      },
    },
  })

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

  const rows = leases.map((lease) => {
    const monthMap = new Map<string, bigint>()
    for (const s of lease.schedules) {
      const ym = `${s.dueDate.getFullYear()}-${String(s.dueDate.getMonth() + 1).padStart(2, "0")}`
      monthMap.set(ym, (monthMap.get(ym) ?? BigInt(0)) + s.amount)
    }
    const cells = months.map((ym) => monthMap.get(ym)?.toString() ?? null)
    const total = months.reduce(
      (acc, ym) => acc + (monthMap.get(ym) ?? BigInt(0)),
      BigInt(0)
    )
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

  const monthTotals = months.map((ym, i) => {
    return rows
      .reduce((acc, r) => acc + (r.cells[i] ? BigInt(r.cells[i]!) : BigInt(0)), BigInt(0))
      .toString()
  })

  return {
    months,
    rows,
    monthTotals,
  }
}
