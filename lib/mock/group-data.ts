// グループ12社の財務モックデータ

export type Industry = "建設" | "広告" | "その他"

export interface Company {
  id: string
  name: string
  shortName: string
  industry: Industry
}

export const COMPANIES: Company[] = [
  // 建設 7社
  { id: "c1", name: "起工業株式会社", shortName: "起工業", industry: "建設" },
  { id: "c2", name: "起建設株式会社", shortName: "起建設", industry: "建設" },
  { id: "c3", name: "起土木株式会社", shortName: "起土木", industry: "建設" },
  { id: "c4", name: "起設備工業株式会社", shortName: "起設備", industry: "建設" },
  { id: "c5", name: "起電気工事株式会社", shortName: "起電気", industry: "建設" },
  { id: "c6", name: "起塗装株式会社", shortName: "起塗装", industry: "建設" },
  { id: "c7", name: "起鉄筋工業株式会社", shortName: "起鉄筋", industry: "建設" },
  // 広告 2社
  { id: "c8", name: "起広告株式会社", shortName: "起広告", industry: "広告" },
  { id: "c9", name: "起メディア株式会社", shortName: "起メディア", industry: "広告" },
  // その他 3社
  { id: "c10", name: "起グループホールディングス", shortName: "起HD", industry: "その他" },
  { id: "c11", name: "起不動産株式会社", shortName: "起不動産", industry: "その他" },
  { id: "c12", name: "起サービス株式会社", shortName: "起サービス", industry: "その他" },
]

export const MONTHS = ["2025-10", "2025-11", "2025-12", "2026-01", "2026-02"]

export const MONTH_LABELS: Record<string, string> = {
  "2025-10": "2025年10月",
  "2025-11": "2025年11月",
  "2025-12": "2025年12月",
  "2026-01": "2026年1月",
  "2026-02": "2026年2月",
}

// 月締め状態
export type CloseStatus = "closed" | "in_progress" | "open"

export interface MonthlyClose {
  companyId: string
  month: string
  status: CloseStatus
}

// 月次財務データ
export interface MonthlyFinancial {
  companyId: string
  month: string
  sales: number
  expenses: number
  cost: number
  salary: number
  profit: number // sales - expenses - cost - salary
}

// 売上明細
export interface SalesDetail {
  companyId: string
  month: string
  partnerName: string
  amount: number
  receivedAmount: number
  receivedRate: number // %
}

// 経費明細
export interface ExpenseDetail {
  companyId: string
  month: string
  category: string
  partnerName: string
  amount: number
}

// 原価明細
export interface CostDetail {
  companyId: string
  month: string
  laborCost: number        // 労務費
  legalWelfare: number     // 法定福利費
  materialCost: number     // 材料費
  consumptionTax: number   // 消費税
}

// 給与明細
export interface SalaryDetail {
  companyId: string
  month: string
  headcount: number
  grossPay: number         // 総支給額
  deductions: number       // 控除合計
  netPay: number           // 差引支給額
  reserve: number          // 積立金
}

// 借入契約
export interface LoanContract {
  id: string
  companyId: string
  bankName: string
  principalAmount: number
  remainingBalance: number
  interestRate: number
  monthlyPayment: number
  startDate: string
  endDate: string
}

// リース契約
export interface LeaseContract {
  id: string
  companyId: string
  lessorName: string
  itemName: string
  totalAmount: number
  remainingBalance: number
  monthlyPayment: number
  startDate: string
  endDate: string
}

// --- データ生成ヘルパー ---

function seededRandom(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 16807 + 0) % 2147483647
    return s / 2147483647
  }
}

function generateMonthlyFinancials(): MonthlyFinancial[] {
  const data: MonthlyFinancial[] = []
  const rand = seededRandom(42)

  const baseScales: Record<string, { sales: number; expenseRate: number; costRate: number; salaryRate: number }> = {
    c1:  { sales: 85_000_000, expenseRate: 0.08, costRate: 0.55, salaryRate: 0.18 },
    c2:  { sales: 65_000_000, expenseRate: 0.09, costRate: 0.52, salaryRate: 0.20 },
    c3:  { sales: 45_000_000, expenseRate: 0.10, costRate: 0.58, salaryRate: 0.17 },
    c4:  { sales: 38_000_000, expenseRate: 0.07, costRate: 0.50, salaryRate: 0.22 },
    c5:  { sales: 32_000_000, expenseRate: 0.08, costRate: 0.48, salaryRate: 0.21 },
    c6:  { sales: 22_000_000, expenseRate: 0.09, costRate: 0.53, salaryRate: 0.19 },
    c7:  { sales: 18_000_000, expenseRate: 0.11, costRate: 0.56, salaryRate: 0.16 },
    c8:  { sales: 28_000_000, expenseRate: 0.15, costRate: 0.30, salaryRate: 0.35 },
    c9:  { sales: 15_000_000, expenseRate: 0.14, costRate: 0.28, salaryRate: 0.38 },
    c10: { sales: 12_000_000, expenseRate: 0.20, costRate: 0.10, salaryRate: 0.45 },
    c11: { sales: 20_000_000, expenseRate: 0.12, costRate: 0.25, salaryRate: 0.30 },
    c12: { sales: 10_000_000, expenseRate: 0.18, costRate: 0.20, salaryRate: 0.40 },
  }

  for (const company of COMPANIES) {
    const scale = baseScales[company.id]
    for (const month of MONTHS) {
      const variance = 0.85 + rand() * 0.30 // 85% ~ 115%
      const sales = Math.round(scale.sales * variance)
      const expenses = Math.round(sales * scale.expenseRate * (0.9 + rand() * 0.2))
      const cost = Math.round(sales * scale.costRate * (0.9 + rand() * 0.2))
      const salary = Math.round(sales * scale.salaryRate * (0.9 + rand() * 0.2))
      data.push({
        companyId: company.id,
        month,
        sales,
        expenses,
        cost,
        salary,
        profit: sales - expenses - cost - salary,
      })
    }
  }
  return data
}

function generateMonthlyCloses(): MonthlyClose[] {
  const data: MonthlyClose[] = []
  for (const company of COMPANIES) {
    for (let i = 0; i < MONTHS.length; i++) {
      let status: CloseStatus
      if (i < 3) status = "closed"
      else if (i === 3) status = company.id <= "c8" ? "closed" : "in_progress"
      else status = "open"
      data.push({ companyId: company.id, month: MONTHS[i], status })
    }
  }
  return data
}

const PARTNERS = [
  "大成建設", "鹿島建設", "清水建設", "大林組", "竹中工務店",
  "前田建設", "三井住友建設", "西松建設", "戸田建設", "安藤ハザマ",
  "電通", "博報堂", "ADKホールディングス", "サイバーエージェント",
  "東急不動産", "三菱地所", "住友不動産",
]

function generateSalesDetails(): SalesDetail[] {
  const data: SalesDetail[] = []
  const rand = seededRandom(123)

  for (const company of COMPANIES) {
    const partnerCount = 3 + Math.floor(rand() * 4)
    for (const month of MONTHS) {
      for (let p = 0; p < partnerCount; p++) {
        const partner = PARTNERS[Math.floor(rand() * PARTNERS.length)]
        const amount = Math.round((2_000_000 + rand() * 15_000_000))
        const receivedRate = rand() > 0.2 ? 100 : Math.round(rand() * 80)
        data.push({
          companyId: company.id,
          month,
          partnerName: partner,
          amount,
          receivedAmount: Math.round(amount * receivedRate / 100),
          receivedRate,
        })
      }
    }
  }
  return data
}

const EXPENSE_CATEGORIES = [
  "旅費交通費", "接待交際費", "消耗品費", "通信費", "水道光熱費",
  "地代家賃", "保険料", "租税公課", "支払手数料", "車両費",
  "修繕費", "福利厚生費", "広告宣伝費", "研修費", "雑費",
]

function generateExpenseDetails(): ExpenseDetail[] {
  const data: ExpenseDetail[] = []
  const rand = seededRandom(456)

  for (const company of COMPANIES) {
    for (const month of MONTHS) {
      const count = 5 + Math.floor(rand() * 8)
      for (let i = 0; i < count; i++) {
        data.push({
          companyId: company.id,
          month,
          category: EXPENSE_CATEGORIES[Math.floor(rand() * EXPENSE_CATEGORIES.length)],
          partnerName: PARTNERS[Math.floor(rand() * PARTNERS.length)],
          amount: Math.round(50_000 + rand() * 2_000_000),
        })
      }
    }
  }
  return data
}

function generateCostDetails(): CostDetail[] {
  const data: CostDetail[] = []
  const rand = seededRandom(789)

  for (const company of COMPANIES) {
    for (const month of MONTHS) {
      const total = 10_000_000 + rand() * 40_000_000
      data.push({
        companyId: company.id,
        month,
        laborCost: Math.round(total * (0.45 + rand() * 0.1)),
        legalWelfare: Math.round(total * (0.10 + rand() * 0.05)),
        materialCost: Math.round(total * (0.25 + rand() * 0.1)),
        consumptionTax: Math.round(total * (0.08 + rand() * 0.04)),
      })
    }
  }
  return data
}

function generateSalaryDetails(): SalaryDetail[] {
  const data: SalaryDetail[] = []
  const rand = seededRandom(321)

  const headcounts: Record<string, number> = {
    c1: 45, c2: 35, c3: 25, c4: 20, c5: 18, c6: 12, c7: 10,
    c8: 22, c9: 12, c10: 8, c11: 15, c12: 10,
  }

  for (const company of COMPANIES) {
    const hc = headcounts[company.id]
    for (const month of MONTHS) {
      const avgPay = 300_000 + rand() * 200_000
      const grossPay = Math.round(hc * avgPay)
      const deductions = Math.round(grossPay * (0.18 + rand() * 0.05))
      const reserve = Math.round(hc * (10_000 + rand() * 20_000))
      data.push({
        companyId: company.id,
        month,
        headcount: hc,
        grossPay,
        deductions,
        netPay: grossPay - deductions,
        reserve,
      })
    }
  }
  return data
}

function generateLoanContracts(): LoanContract[] {
  const rand = seededRandom(654)
  const banks = ["みずほ銀行", "三菱UFJ銀行", "三井住友銀行", "りそな銀行", "横浜銀行", "千葉銀行", "日本政策金融公庫"]
  const data: LoanContract[] = []

  const configs: { companyId: string; count: number }[] = [
    { companyId: "c1", count: 2 }, { companyId: "c2", count: 2 },
    { companyId: "c3", count: 1 }, { companyId: "c4", count: 1 },
    { companyId: "c5", count: 1 }, { companyId: "c8", count: 1 },
    { companyId: "c10", count: 1 }, { companyId: "c11", count: 1 },
  ]

  let idCounter = 1
  for (const cfg of configs) {
    for (let i = 0; i < cfg.count; i++) {
      const principal = Math.round((30_000_000 + rand() * 170_000_000))
      const remaining = Math.round(principal * (0.3 + rand() * 0.6))
      const rate = Math.round((0.5 + rand() * 2.5) * 100) / 100
      data.push({
        id: `loan-${idCounter++}`,
        companyId: cfg.companyId,
        bankName: banks[Math.floor(rand() * banks.length)],
        principalAmount: principal,
        remainingBalance: remaining,
        interestRate: rate,
        monthlyPayment: Math.round(remaining / (24 + rand() * 60)),
        startDate: "2023-04-01",
        endDate: "2028-03-31",
      })
    }
  }
  return data
}

function generateLeaseContracts(): LeaseContract[] {
  const rand = seededRandom(987)
  const lessors = ["オリックス", "三菱HCキャピタル", "芙蓉総合リース", "東京センチュリー", "日立キャピタル", "SMFLキャピタル"]
  const items = [
    "トラック", "ユニック車", "バックホウ", "クレーン車", "高所作業車",
    "複合機", "サーバー", "エアコン", "フォークリフト", "発電機",
    "溶接機", "コンプレッサー",
  ]
  const data: LeaseContract[] = []

  let idCounter = 1
  for (const company of COMPANIES) {
    const count = company.industry === "建設" ? 2 : 1
    for (let i = 0; i < count; i++) {
      const total = Math.round(1_500_000 + rand() * 8_500_000)
      const remaining = Math.round(total * (0.2 + rand() * 0.7))
      data.push({
        id: `lease-${idCounter++}`,
        companyId: company.id,
        lessorName: lessors[Math.floor(rand() * lessors.length)],
        itemName: items[Math.floor(rand() * items.length)],
        totalAmount: total,
        remainingBalance: remaining,
        monthlyPayment: Math.round(total / (36 + rand() * 24)),
        startDate: "2024-01-01",
        endDate: "2027-12-31",
      })
    }
  }
  return data
}

// --- エクスポートされるデータ ---

export const monthlyFinancials = generateMonthlyFinancials()
export const monthlyCloses = generateMonthlyCloses()
export const salesDetails = generateSalesDetails()
export const expenseDetails = generateExpenseDetails()
export const costDetails = generateCostDetails()
export const salaryDetails = generateSalaryDetails()
export const loanContracts = generateLoanContracts()
export const leaseContracts = generateLeaseContracts()

// --- ヘルパー関数 ---

export function getCompany(id: string): Company | undefined {
  return COMPANIES.find((c) => c.id === id)
}

export function getFinancials(companyIds: string[], month: string): MonthlyFinancial[] {
  return monthlyFinancials.filter(
    (d) => companyIds.includes(d.companyId) && d.month === month
  )
}

export function getFinancialsByMonth(companyIds: string[]): Record<string, MonthlyFinancial[]> {
  const result: Record<string, MonthlyFinancial[]> = {}
  for (const month of MONTHS) {
    result[month] = getFinancials(companyIds, month)
  }
  return result
}

export function aggregateFinancials(items: MonthlyFinancial[]) {
  return items.reduce(
    (acc, d) => ({
      sales: acc.sales + d.sales,
      expenses: acc.expenses + d.expenses,
      cost: acc.cost + d.cost,
      salary: acc.salary + d.salary,
      profit: acc.profit + d.profit,
    }),
    { sales: 0, expenses: 0, cost: 0, salary: 0, profit: 0 }
  )
}
