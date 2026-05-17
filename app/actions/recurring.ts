"use server"

import { prisma } from "@/lib/prisma"
import { requireSession } from "@/lib/auth-server"
import { revalidatePath } from "next/cache"
import { bigintToJson } from "@/lib/format"
import { TransactionType, PaymentMethod } from "@prisma/client"
import { adjustForHoliday } from "@/lib/holidays"

async function verifyCompanyAccess(companyId: string) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true },
  })
  if (!company) {
    throw new Error("Company not found")
  }
  return company
}

// デフォルト口座を取得（isMain 優先、なければアクティブな口座任意）
// findFirst + OR で 1クエリに集約
async function resolveDefaultAccountId(companyId: string): Promise<string | null> {
  const accounts = await prisma.account.findMany({
    where: { companyId, isActive: true },
    select: { id: true, isMain: true },
    orderBy: { isMain: "desc" }, // main を先頭
    take: 1,
  })
  return accounts[0]?.id ?? null
}

export async function getRecurringTemplates(companyId: string) {
  // セッション・会社確認・テンプレート取得を並列実行
  const [, , templates] = await Promise.all([
    requireSession(),
    verifyCompanyAccess(companyId),
    prisma.recurringTemplate.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
    }),
  ])

  return bigintToJson(templates)
}

export async function createRecurringTemplate(data: {
  companyId: string
  name: string
  frequency: string
  specificMonths?: number[]
  startMonth?: number
  dueDayRule: string
  holidayAdjust?: string
  transactionType: TransactionType
  accountId?: string
  partnerId?: string
  midId?: string
  subId?: string
  amountType: string
  fixedAmount?: string
  paymentMethod?: PaymentMethod
  classification?: string
  accountingMonthOffset?: number
  summary?: string
  assigneeId?: string
}) {
  await Promise.all([requireSession(), verifyCompanyAccess(data.companyId)])

  const result = await prisma.recurringTemplate.create({
    data: {
      companyId: data.companyId,
      name: data.name,
      frequency: data.frequency,
      specificMonths: data.specificMonths || [],
      startMonth: data.startMonth,
      dueDayRule: data.dueDayRule,
      holidayAdjust: data.holidayAdjust || "PREV_BUSINESS",
      transactionType: data.transactionType,
      accountId: data.accountId || null,
      partnerId: data.partnerId || null,
      midId: data.midId || null,
      subId: data.subId || null,
      amountType: data.amountType,
      fixedAmount: data.fixedAmount ? BigInt(data.fixedAmount) : null,
      paymentMethod: data.paymentMethod || null,
      classification: data.classification || null,
      accountingMonthOffset: data.accountingMonthOffset ?? 0,
      summary: data.summary || null,
      assigneeId: data.assigneeId || null,
    },
  })

  revalidatePath("/recurring")
  return bigintToJson(result)
}

export async function updateRecurringTemplate(
  id: string,
  companyId: string,
  data: {
    name?: string
    frequency?: string
    specificMonths?: number[]
    startMonth?: number | null
    dueDayRule?: string
    holidayAdjust?: string
    transactionType?: TransactionType
    accountId?: string | null
    partnerId?: string | null
    midId?: string | null
    subId?: string | null
    amountType?: string
    fixedAmount?: string | null
    paymentMethod?: PaymentMethod | null
    classification?: string | null
    accountingMonthOffset?: number
    summary?: string | null
    assigneeId?: string | null
    isActive?: boolean
  }
) {
  // セッション・会社確認・既存テンプレート取得を並列実行
  const [, , existing] = await Promise.all([
    requireSession(),
    verifyCompanyAccess(companyId),
    prisma.recurringTemplate.findUnique({
      where: { id },
      select: { companyId: true },
    }),
  ])
  if (!existing || existing.companyId !== companyId) {
    throw new Error("Template not found")
  }

  const updateData: Record<string, unknown> = {}
  if (data.name !== undefined) updateData.name = data.name
  if (data.frequency !== undefined) updateData.frequency = data.frequency
  if (data.specificMonths !== undefined) updateData.specificMonths = data.specificMonths
  if (data.startMonth !== undefined) updateData.startMonth = data.startMonth
  if (data.dueDayRule !== undefined) updateData.dueDayRule = data.dueDayRule
  if (data.holidayAdjust !== undefined) updateData.holidayAdjust = data.holidayAdjust
  if (data.transactionType !== undefined) updateData.transactionType = data.transactionType
  if (data.accountId !== undefined) updateData.accountId = data.accountId
  if (data.partnerId !== undefined) updateData.partnerId = data.partnerId
  if (data.midId !== undefined) updateData.midId = data.midId
  if (data.subId !== undefined) updateData.subId = data.subId
  if (data.amountType !== undefined) updateData.amountType = data.amountType
  if (data.fixedAmount !== undefined) updateData.fixedAmount = data.fixedAmount ? BigInt(data.fixedAmount) : null
  if (data.paymentMethod !== undefined) updateData.paymentMethod = data.paymentMethod
  if (data.classification !== undefined) updateData.classification = data.classification
  if (data.accountingMonthOffset !== undefined) updateData.accountingMonthOffset = data.accountingMonthOffset
  if (data.summary !== undefined) updateData.summary = data.summary
  if (data.assigneeId !== undefined) updateData.assigneeId = data.assigneeId
  if (data.isActive !== undefined) updateData.isActive = data.isActive

  const result = await prisma.recurringTemplate.update({
    where: { id },
    data: updateData,
  })

  revalidatePath("/recurring")
  return bigintToJson(result)
}

export async function deleteRecurringTemplate(id: string, companyId: string) {
  const [, , existing] = await Promise.all([
    requireSession(),
    verifyCompanyAccess(companyId),
    prisma.recurringTemplate.findUnique({
      where: { id },
      select: { companyId: true },
    }),
  ])
  if (!existing || existing.companyId !== companyId) {
    throw new Error("Template not found")
  }

  await prisma.recurringTemplate.delete({ where: { id } })
  revalidatePath("/recurring")
}

function isTargetMonth(frequency: string, specificMonths: number[], month: number): boolean {
  switch (frequency) {
    case "MONTHLY":
      return true
    case "BIMONTHLY_ODD":
      return month % 2 === 1
    case "BIMONTHLY_EVEN":
      return month % 2 === 0
    case "QUARTERLY":
      return [1, 4, 7, 10].includes(month)
    case "YEARLY":
      return month === 1
    case "SPECIFIC_MONTHS":
      return specificMonths.includes(month)
    default:
      return false
  }
}

function getDueDate(yearMonth: string, dueDayRule: string, holidayAdjust?: string): Date {
  const [yearStr, monthStr] = yearMonth.split("-")
  const year = parseInt(yearStr)
  const month = parseInt(monthStr)

  let rawDate: Date
  if (dueDayRule === "MONTH_END") {
    rawDate = new Date(year, month, 0)
  } else {
    const dayMatch = dueDayRule.match(/DAY_(\d+)/)
    if (dayMatch) {
      const day = parseInt(dayMatch[1])
      const lastDay = new Date(year, month, 0).getDate()
      rawDate = new Date(year, month - 1, Math.min(day, lastDay))
    } else {
      rawDate = new Date(year, month - 1, 1)
    }
  }

  return adjustForHoliday(
    rawDate,
    (holidayAdjust as "PREV_BUSINESS" | "NEXT_BUSINESS" | "NONE") || "NONE"
  )
}

export async function generateRecurringTransactions(companyId: string, yearMonth: string) {
  const [, , templates] = await Promise.all([
    requireSession(),
    verifyCompanyAccess(companyId),
    prisma.recurringTemplate.findMany({
      where: { companyId, isActive: true },
    }),
  ])

  const [, monthStr] = yearMonth.split("-")
  const month = parseInt(monthStr)
  const prevMonth = getPreviousMonth(yearMonth)

  // 対象テンプレートのみ絞り込み
  const eligible = templates.filter(
    (t) =>
      isTargetMonth(t.frequency, t.specificMonths, month) &&
      !(t.lastGeneratedMonth && t.lastGeneratedMonth >= yearMonth)
  )
  if (eligible.length === 0) return []

  // VARIABLE テンプレートの前月金額を一括取得 (N+1 排除)
  const variableTemplateIds = eligible
    .filter((t) => t.amountType === "VARIABLE")
    .map((t) => t.id)

  const prevTxByTemplate = new Map<string, bigint>()
  if (variableTemplateIds.length > 0) {
    const prevTxs = await prisma.transaction.findMany({
      where: {
        recurringTemplateId: { in: variableTemplateIds },
        accountingMonth: prevMonth,
      },
      select: { recurringTemplateId: true, amount: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    })
    for (const tx of prevTxs) {
      if (tx.recurringTemplateId && !prevTxByTemplate.has(tx.recurringTemplateId)) {
        prevTxByTemplate.set(tx.recurringTemplateId, tx.amount)
      }
    }
  }

  // フォールバック対象 (templateId 取れなかった VARIABLE) の前月取引を一括取得
  const fallbackTargets = eligible.filter(
    (t) =>
      t.amountType === "VARIABLE" &&
      !prevTxByTemplate.has(t.id) &&
      (t.partnerId !== null)
  )
  const fallbackKey = (partnerId: string, type: TransactionType) => `${partnerId}|${type}`
  const fallbackMap = new Map<string, bigint>()
  if (fallbackTargets.length > 0) {
    const partnerIds = Array.from(new Set(fallbackTargets.map((t) => t.partnerId!).filter(Boolean)))
    const fallbackTxs = await prisma.transaction.findMany({
      where: {
        companyId,
        accountingMonth: prevMonth,
        partnerId: { in: partnerIds },
      },
      select: { partnerId: true, type: true, amount: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    })
    for (const tx of fallbackTxs) {
      if (!tx.partnerId) continue
      const k = fallbackKey(tx.partnerId, tx.type)
      if (!fallbackMap.has(k)) fallbackMap.set(k, tx.amount)
    }
  }

  // accountId 未指定テンプレ用にデフォルト口座を1回だけ解決
  const needsDefaultAccount = eligible.some((t) => !t.accountId)
  const defaultAccountId = needsDefaultAccount ? await resolveDefaultAccountId(companyId) : null

  const results: { templateId: string; templateName: string; transactionId: string }[] = []

  for (const template of eligible) {
    let amount = BigInt(0)
    if (template.amountType === "FIXED" && template.fixedAmount) {
      amount = template.fixedAmount
    } else if (template.amountType === "VARIABLE") {
      const v = prevTxByTemplate.get(template.id)
      if (v !== undefined) {
        amount = v
      } else if (template.partnerId) {
        amount = fallbackMap.get(fallbackKey(template.partnerId, template.transactionType)) ?? BigInt(0)
      }
    }

    const dueDate = getDueDate(yearMonth, template.dueDayRule, template.holidayAdjust)
    const accountingMonth = applyMonthOffset(yearMonth, template.accountingMonthOffset || 0)

    const accountId = template.accountId ?? defaultAccountId
    if (!accountId) continue

    const transactionData: Record<string, unknown> = {
      companyId,
      accountId,
      type: template.transactionType,
      status: "DRAFT",
      accountingMonth,
      amount,
      scheduledDate: dueDate,
      summary: template.summary || template.name,
      classification: template.classification,
      paymentMethod: template.paymentMethod,
      recurringTemplateId: template.id,
    }
    if (template.partnerId) transactionData.partnerId = template.partnerId

    const transaction = await prisma.transaction.create({
      data: transactionData as {
        companyId: string
        accountId: string
        type: TransactionType
        accountingMonth: string
        amount: bigint
        scheduledDate?: Date
        summary?: string
        classification?: string
        paymentMethod?: PaymentMethod
        partnerId?: string
        recurringTemplateId?: string
      },
    })

    // 子レコード作成・テンプレ更新を並列化
    await Promise.all([
      template.midId
        ? prisma.transactionDetail.create({
            data: {
              transactionId: transaction.id,
              midId: template.midId,
              subId: template.subId || null,
              amount,
              summary: template.summary || template.name,
              displayOrder: 0,
            },
          })
        : Promise.resolve(),
      prisma.recurringTemplate.update({
        where: { id: template.id },
        data: { lastGeneratedMonth: yearMonth },
      }),
    ])

    results.push({
      templateId: template.id,
      templateName: template.name,
      transactionId: transaction.id,
    })
  }

  revalidatePath("/recurring")
  revalidatePath("/expenses")
  revalidatePath("/sales")
  revalidatePath("/costs")
  return results
}

function getPreviousMonth(yearMonth: string): string {
  return applyMonthOffset(yearMonth, -1)
}

function applyMonthOffset(yearMonth: string, offset: number): string {
  const [yearStr, monthStr] = yearMonth.split("-")
  let year = parseInt(yearStr)
  let month = parseInt(monthStr) + offset
  while (month < 1) {
    month += 12
    year -= 1
  }
  while (month > 12) {
    month -= 12
    year += 1
  }
  return `${year}-${String(month).padStart(2, "0")}`
}

// 自動生成: lastGeneratedMonth から当月までの未生成月を全て埋める
export async function autoGenerateRecurringTransactions(companyId: string) {
  const [, , templates] = await Promise.all([
    requireSession(),
    verifyCompanyAccess(companyId),
    prisma.recurringTemplate.findMany({ where: { companyId, isActive: true } }),
  ])

  const now = new Date()
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`

  if (templates.length === 0) return []

  // デフォルト口座を 1回だけ解決
  const needsDefaultAccount = templates.some((t) => !t.accountId)
  const defaultAccountId = needsDefaultAccount ? await resolveDefaultAccountId(companyId) : null

  // VARIABLE テンプレートが必要とする全 (templateId, prevMonth) 過去取引を 1クエリで先取得
  // 期間: 最古の startMonth - 1 から currentMonth - 1 まで
  const variableTemplateIds = templates
    .filter((t) => t.amountType === "VARIABLE")
    .map((t) => t.id)

  // 前月金額のキャッシュ: key=`${templateId}|${prevYearMonth}`
  const prevAmountByKey = new Map<string, bigint>()
  if (variableTemplateIds.length > 0) {
    const prevTxs = await prisma.transaction.findMany({
      where: {
        recurringTemplateId: { in: variableTemplateIds },
      },
      select: { recurringTemplateId: true, accountingMonth: true, amount: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    })
    for (const tx of prevTxs) {
      if (!tx.recurringTemplateId) continue
      const k = `${tx.recurringTemplateId}|${tx.accountingMonth}`
      if (!prevAmountByKey.has(k)) prevAmountByKey.set(k, tx.amount)
    }
  }

  // partner ベースのフォールバック取引も 1クエリで取得 (テンプレが partnerId 持つ VARIABLE のみ)
  const partnerIds = Array.from(
    new Set(
      templates
        .filter((t) => t.amountType === "VARIABLE" && t.partnerId)
        .map((t) => t.partnerId!)
    )
  )
  const fallbackByKey = new Map<string, bigint>() // key = partnerId|type|month
  if (partnerIds.length > 0) {
    const fallbackTxs = await prisma.transaction.findMany({
      where: { companyId, partnerId: { in: partnerIds } },
      select: { partnerId: true, type: true, accountingMonth: true, amount: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    })
    for (const tx of fallbackTxs) {
      if (!tx.partnerId) continue
      const k = `${tx.partnerId}|${tx.type}|${tx.accountingMonth}`
      if (!fallbackByKey.has(k)) fallbackByKey.set(k, tx.amount)
    }
  }

  const allResults: { templateId: string; templateName: string; transactionId: string; month: string }[] = []

  for (const template of templates) {
    // 開始月を決定: lastGeneratedMonth の翌月、またはテンプレート作成月
    let startMonth: string
    if (template.lastGeneratedMonth) {
      startMonth = applyMonthOffset(template.lastGeneratedMonth, 1)
    } else {
      const created = template.createdAt
      startMonth = `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, "0")}`
    }

    let targetMonth = startMonth
    while (targetMonth <= currentMonth) {
      const [, monthStr] = targetMonth.split("-")
      const month = parseInt(monthStr)

      if (isTargetMonth(template.frequency, template.specificMonths, month)) {
        let amount = BigInt(0)
        if (template.amountType === "FIXED" && template.fixedAmount) {
          amount = template.fixedAmount
        } else if (template.amountType === "VARIABLE") {
          const prevMonth = getPreviousMonth(targetMonth)
          const v = prevAmountByKey.get(`${template.id}|${prevMonth}`)
          if (v !== undefined) {
            amount = v
          } else if (template.partnerId) {
            amount =
              fallbackByKey.get(`${template.partnerId}|${template.transactionType}|${prevMonth}`) ??
              BigInt(0)
          }
        }

        const dueDate = getDueDate(targetMonth, template.dueDayRule, template.holidayAdjust)
        const accountingMonth = applyMonthOffset(targetMonth, template.accountingMonthOffset || 0)

        const accountId = template.accountId ?? defaultAccountId
        if (!accountId) {
          targetMonth = applyMonthOffset(targetMonth, 1)
          continue
        }

        const transaction = await prisma.transaction.create({
          data: {
            companyId,
            accountId,
            type: template.transactionType,
            status: "DRAFT",
            accountingMonth,
            amount,
            scheduledDate: dueDate,
            summary: template.summary || template.name,
            classification: template.classification,
            paymentMethod: template.paymentMethod,
            partnerId: template.partnerId,
            recurringTemplateId: template.id,
          },
        })

        // 生成した取引をキャッシュへ反映 → 後続月で前月参照に使える
        const txKey = `${template.id}|${accountingMonth}`
        if (!prevAmountByKey.has(txKey)) prevAmountByKey.set(txKey, amount)

        await Promise.all([
          template.midId
            ? prisma.transactionDetail.create({
                data: {
                  transactionId: transaction.id,
                  midId: template.midId,
                  subId: template.subId || null,
                  amount,
                  summary: template.summary || template.name,
                  displayOrder: 0,
                },
              })
            : Promise.resolve(),
          prisma.recurringTemplate.update({
            where: { id: template.id },
            data: { lastGeneratedMonth: targetMonth },
          }),
        ])

        allResults.push({
          templateId: template.id,
          templateName: template.name,
          transactionId: transaction.id,
          month: targetMonth,
        })
      }

      targetMonth = applyMonthOffset(targetMonth, 1)
    }
  }

  if (allResults.length > 0) {
    revalidatePath("/recurring")
    revalidatePath("/expenses")
    revalidatePath("/sales")
    revalidatePath("/costs")
  }

  return allResults
}

export async function getExpenseTemplates(companyId: string) {
  const [, , templates] = await Promise.all([
    requireSession(),
    verifyCompanyAccess(companyId),
    prisma.recurringTemplate.findMany({
      where: {
        companyId,
        transactionType: "EXPENSE",
      },
      orderBy: { createdAt: "desc" },
    }),
  ])

  return bigintToJson(templates)
}
