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
