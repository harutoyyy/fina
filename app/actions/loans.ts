"use server"

import { prisma } from "@/lib/prisma"
import { requireSession } from "@/lib/auth-server"
import { revalidatePath } from "next/cache"
import { bigintToJson } from "@/lib/format"
import { Decimal } from "@prisma/client/runtime/library"

function addMonths(date: Date, months: number): Date {
  const result = new Date(date.getFullYear(), date.getMonth() + months, 1)
  const lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate()
  result.setDate(Math.min(date.getDate(), lastDay))
  return result
}

function getFrequencyMonths(frequency: string): number {
  switch (frequency) {
    case "MONTHLY": return 1
    case "QUARTERLY": return 3
    case "SEMIANNUAL": return 6
    case "ANNUAL": return 12
    default: return 1
  }
}

function daysBetween(a: Date, b: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24
  return Math.round(Math.abs(b.getTime() - a.getTime()) / msPerDay)
}

function setDay(date: Date, day: number): Date {
  const result = new Date(date)
  const lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate()
  result.setDate(Math.min(day, lastDay))
  return result
}

function generateRepaymentSchedule(params: {
  principalAmount: bigint
  repaymentMethod: string
  repaymentFrequency: string
  repaymentStartDate: Date
  repaymentDay: number | null
  totalPayments: number
  interestRate: Decimal
  dayCountBasis: number
  principalAdjust: string
}): {
  paymentNumber: number
  dueDate: Date
  principalAmount: bigint
  interestAmount: bigint
  totalAmount: bigint
  remainingBalance: bigint
}[] {
  const {
    principalAmount,
    repaymentMethod,
    repaymentFrequency,
    repaymentStartDate,
    repaymentDay,
    totalPayments,
    interestRate,
    dayCountBasis,
    principalAdjust,
  } = params

  const schedules: {
    paymentNumber: number
    dueDate: Date
    principalAmount: bigint
    interestAmount: bigint
    totalAmount: bigint
    remainingBalance: bigint
  }[] = []

  const freqMonths = getFrequencyMonths(repaymentFrequency)
  const rate = Number(interestRate) / 100
  let balance = principalAmount

  for (let i = 0; i < totalPayments; i++) {
    let dueDate = addMonths(repaymentStartDate, i * freqMonths)
    if (repaymentDay) {
      dueDate = setDay(dueDate, repaymentDay)
    }

    const prevDate = i === 0
      ? repaymentStartDate
      : schedules[i - 1].dueDate
    const days = i === 0 ? daysBetween(repaymentStartDate, dueDate) || 30 : daysBetween(prevDate, dueDate)
    const interestAmount = BigInt(Math.round(Number(balance) * rate * days / dayCountBasis))

    let principal: bigint

    if (repaymentMethod === "EQUAL_PRINCIPAL") {
      if (i === totalPayments - 1) {
        principal = balance
      } else {
        const basePrincipal = principalAmount / BigInt(totalPayments)
        if (principalAdjust === "FIRST" && i === 0) {
          const remainder = principalAmount - basePrincipal * BigInt(totalPayments)
          principal = basePrincipal + remainder
        } else if (principalAdjust === "LAST" && i === totalPayments - 1) {
          principal = balance
        } else {
          principal = basePrincipal
        }
        if (principal > balance) principal = balance
      }
    } else if (repaymentMethod === "BULLET") {
      principal = i === totalPayments - 1 ? balance : BigInt(0)
    } else if (repaymentMethod === "GRACE") {
      principal = i === totalPayments - 1 ? balance : BigInt(0)
    } else {
      const basePrincipal = principalAmount / BigInt(totalPayments)
      principal = i === totalPayments - 1 ? balance : basePrincipal
    }

    balance = balance - principal
    const total = principal + interestAmount

    schedules.push({
      paymentNumber: i + 1,
      dueDate,
      principalAmount: principal,
      interestAmount,
      totalAmount: total,
      remainingBalance: balance,
    })
  }

  return schedules
}

export async function getLoans(companyId: string) {
  await requireSession()

  const loans = await prisma.loanContract.findMany({
    where: { companyId },
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: { schedules: true },
      },
    },
  })

  return bigintToJson(loans)
}

export async function getLoan(id: string, companyId: string) {
  await requireSession()

  const loan = await prisma.loanContract.findUnique({
    where: { id },
    include: {
      schedules: {
        orderBy: { paymentNumber: "asc" },
      },
    },
  })

  if (!loan || loan.companyId !== companyId) {
    throw new Error("Loan contract not found")
  }

  return bigintToJson(loan)
}

export async function createLoan(data: {
  companyId: string
  partnerId?: string
  contractName: string
  principalAmount: string
  executionDate: string
  repaymentStartDate: string
  repaymentMethod: string
  repaymentFrequency: string
  repaymentDay?: number
  totalPayments: number
  interestType: string
  interestRate: string
  interestTiming?: string
  dayCountBasis?: number
  roundingRule?: string
  principalAdjust?: string
  holidayAdjust?: string
  completionDate?: string
  isGuaranteeAssociation?: boolean
}) {
  await requireSession()

  if (!data.totalPayments || data.totalPayments <= 0) {
    throw new Error("返済回数は1以上を指定してください")
  }

  const principalAmount = BigInt(data.principalAmount)
  const executionDate = new Date(data.executionDate)
  const repaymentStartDate = new Date(data.repaymentStartDate)
  const interestRate = new Decimal(data.interestRate)

  const scheduleItems = generateRepaymentSchedule({
    principalAmount,
    repaymentMethod: data.repaymentMethod,
    repaymentFrequency: data.repaymentFrequency,
    repaymentStartDate,
    repaymentDay: data.repaymentDay ?? null,
    totalPayments: data.totalPayments,
    interestRate,
    dayCountBasis: data.dayCountBasis ?? 365,
    principalAdjust: data.principalAdjust ?? "LAST",
  })

  const result = await prisma.loanContract.create({
    data: {
      companyId: data.companyId,
      partnerId: data.partnerId || undefined,
      contractName: data.contractName,
      principalAmount,
      executionDate,
      repaymentStartDate,
      repaymentMethod: data.repaymentMethod,
      repaymentFrequency: data.repaymentFrequency,
      repaymentDay: data.repaymentDay ?? undefined,
      totalPayments: data.totalPayments,
      interestType: data.interestType,
      interestRate,
      interestTiming: data.interestTiming ?? "ARREAR",
      dayCountBasis: data.dayCountBasis ?? 365,
      roundingRule: data.roundingRule ?? "ROUND_HALF_UP",
      principalAdjust: data.principalAdjust ?? "LAST",
      holidayAdjust: data.holidayAdjust ?? "PREV_BUSINESS",
      completionDate: data.completionDate ? new Date(data.completionDate) : undefined,
      remainingBalance: principalAmount,
      isGuaranteeAssociation: data.isGuaranteeAssociation ?? false,
      status: "ACTIVE",
      schedules: {
        create: scheduleItems.map((s) => ({
          paymentNumber: s.paymentNumber,
          dueDate: s.dueDate,
          principalAmount: s.principalAmount,
          interestAmount: s.interestAmount,
          totalAmount: s.totalAmount,
          remainingBalance: s.remainingBalance,
        })),
      },
    },
    include: {
      schedules: {
        orderBy: { paymentNumber: "asc" },
      },
    },
  })

  revalidatePath("/loans")
  return bigintToJson(result)
}

export async function updateLoan(
  id: string,
  companyId: string,
  data: {
    contractName?: string
    partnerId?: string | null
    principalAmount?: string
    executionDate?: string
    repaymentStartDate?: string
    repaymentMethod?: string
    repaymentFrequency?: string
    repaymentDay?: number | null
    totalPayments?: number
    interestType?: string
    interestRate?: string
    interestTiming?: string
    dayCountBasis?: number
    roundingRule?: string
    principalAdjust?: string
    holidayAdjust?: string
    completionDate?: string | null
    status?: string
    isGuaranteeAssociation?: boolean
  }
) {
  await requireSession()

  const existing = await prisma.loanContract.findUnique({
    where: { id },
    select: { companyId: true },
  })
  if (!existing || existing.companyId !== companyId) {
    throw new Error("Loan contract not found")
  }

  const updateData: Record<string, unknown> = {}
  if (data.contractName !== undefined) updateData.contractName = data.contractName
  if (data.partnerId !== undefined) updateData.partnerId = data.partnerId
  if (data.principalAmount !== undefined) updateData.principalAmount = BigInt(data.principalAmount)
  if (data.executionDate !== undefined) updateData.executionDate = new Date(data.executionDate)
  if (data.repaymentStartDate !== undefined) updateData.repaymentStartDate = new Date(data.repaymentStartDate)
  if (data.repaymentMethod !== undefined) updateData.repaymentMethod = data.repaymentMethod
  if (data.repaymentFrequency !== undefined) updateData.repaymentFrequency = data.repaymentFrequency
  if (data.repaymentDay !== undefined) updateData.repaymentDay = data.repaymentDay
  if (data.totalPayments !== undefined) updateData.totalPayments = data.totalPayments
  if (data.interestType !== undefined) updateData.interestType = data.interestType
  if (data.interestRate !== undefined) updateData.interestRate = new Decimal(data.interestRate)
  if (data.interestTiming !== undefined) updateData.interestTiming = data.interestTiming
  if (data.dayCountBasis !== undefined) updateData.dayCountBasis = data.dayCountBasis
  if (data.roundingRule !== undefined) updateData.roundingRule = data.roundingRule
  if (data.principalAdjust !== undefined) updateData.principalAdjust = data.principalAdjust
  if (data.holidayAdjust !== undefined) updateData.holidayAdjust = data.holidayAdjust
  if (data.completionDate !== undefined) updateData.completionDate = data.completionDate ? new Date(data.completionDate) : null
  if (data.status !== undefined) updateData.status = data.status
  if (data.isGuaranteeAssociation !== undefined) updateData.isGuaranteeAssociation = data.isGuaranteeAssociation

  const result = await prisma.loanContract.update({
    where: { id },
    data: updateData,
    include: {
      schedules: {
        orderBy: { paymentNumber: "asc" },
      },
    },
  })

  revalidatePath("/loans")
  return bigintToJson(result)
}

export async function deleteLoan(id: string, companyId: string) {
  await requireSession()

  const existing = await prisma.loanContract.findUnique({
    where: { id },
    select: { companyId: true, status: true },
  })
  if (!existing || existing.companyId !== companyId) {
    throw new Error("Loan contract not found")
  }
  if (existing.status !== "ACTIVE") {
    throw new Error("Only ACTIVE contracts can be deleted")
  }

  await prisma.loanContract.delete({ where: { id } })
  revalidatePath("/loans")
}

export async function markLoanSchedulePaid(
  scheduleId: string,
  companyId: string,
  transactionId?: string
) {
  await requireSession()

  const schedule = await prisma.loanSchedule.findUnique({
    where: { id: scheduleId },
    select: {
      id: true,
      contract: { select: { id: true, companyId: true } },
    },
  })
  if (!schedule || schedule.contract.companyId !== companyId) {
    throw new Error("Loan schedule not found")
  }

  // 更新後の schedule を返り値で受け取り、最新の支払済み schedule を並列取得
  const [updatedSchedule, latestPaid] = await Promise.all([
    prisma.loanSchedule.update({
      where: { id: scheduleId },
      data: {
        isPaid: true,
        transactionId: transactionId || undefined,
      },
    }),
    prisma.loanSchedule.findFirst({
      where: { contractId: schedule.contract.id, isPaid: true },
      orderBy: { paymentNumber: "desc" },
      select: { remainingBalance: true },
    }),
  ])

  if (latestPaid) {
    await prisma.loanContract.update({
      where: { id: schedule.contract.id },
      data: { remainingBalance: latestPaid.remainingBalance },
    })
  }

  revalidatePath("/loans")
  return bigintToJson(updatedSchedule)
}

export async function regenerateSchedule(contractId: string, companyId: string) {
  await requireSession()

  const contract = await prisma.loanContract.findUnique({
    where: { id: contractId },
    include: {
      schedules: {
        where: { isPaid: true },
        orderBy: { paymentNumber: "asc" },
      },
    },
  })
  if (!contract || contract.companyId !== companyId) {
    throw new Error("Loan contract not found")
  }

  const paidSchedules = contract.schedules
  const paidCount = paidSchedules.length
  const lastPaid = paidSchedules[paidSchedules.length - 1]
  const currentBalance = lastPaid ? lastPaid.remainingBalance : contract.principalAmount
  const remainingPayments = (contract.totalPayments ?? 0) - paidCount

  if (remainingPayments <= 0) {
    return bigintToJson(contract)
  }

  const startDate = lastPaid
    ? addMonths(lastPaid.dueDate, getFrequencyMonths(contract.repaymentFrequency))
    : contract.repaymentStartDate

  const newScheduleItems = generateRepaymentSchedule({
    principalAmount: currentBalance,
    repaymentMethod: contract.repaymentMethod,
    repaymentFrequency: contract.repaymentFrequency,
    repaymentStartDate: startDate,
    repaymentDay: contract.repaymentDay,
    totalPayments: remainingPayments,
    interestRate: contract.interestRate,
    dayCountBasis: contract.dayCountBasis,
    principalAdjust: contract.principalAdjust,
  })

  // 未払スケジュール削除 → 新規 createMany + 契約 remainingBalance 更新を並列化
  await prisma.loanSchedule.deleteMany({
    where: { contractId, isPaid: false },
  })
  await Promise.all([
    prisma.loanSchedule.createMany({
      data: newScheduleItems.map((s) => ({
        contractId,
        paymentNumber: paidCount + s.paymentNumber,
        dueDate: s.dueDate,
        principalAmount: s.principalAmount,
        interestAmount: s.interestAmount,
        totalAmount: s.totalAmount,
        remainingBalance: s.remainingBalance,
      })),
    }),
    prisma.loanContract.update({
      where: { id: contractId },
      data: { remainingBalance: currentBalance },
    }),
  ])

  const updated = await prisma.loanContract.findUnique({
    where: { id: contractId },
    include: {
      schedules: {
        orderBy: { paymentNumber: "asc" },
      },
    },
  })

  revalidatePath("/loans")
  return bigintToJson(updated)
}
