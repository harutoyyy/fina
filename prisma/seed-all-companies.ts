// ============================================================
// 全12社シードデータ定義
// seed-reset.ts から呼び出して使う
// ============================================================

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// --- 全社の銀行口座定義 ---
const companyBankData: Record<number, { bankName: string; branchName: string; accountHolder: string }> = {
  0:  { bankName: '千葉銀行',     branchName: '松戸支店',   accountHolder: 'ｵｺｼｺｳｷﾞﾖｳ' },
  1:  { bankName: '千葉銀行',     branchName: '柏支店',     accountHolder: 'ｵｺｼｸﾞﾙｰﾌﾟ' },
  2:  { bankName: '千葉興業銀行', branchName: '本店',       accountHolder: 'ﾏﾂﾑﾗｹﾝｾﾂ' },
  3:  { bankName: '京葉銀行',     branchName: '千葉支店',   accountHolder: 'ｻﾄｳｹﾝｾﾂｺｳｷﾞﾖｳ' },
  4:  { bankName: '千葉銀行',     branchName: '船橋支店',   accountHolder: 'ﾖｼｶﾜｹﾝｾﾂ' },
  5:  { bankName: '千葉信用金庫', branchName: '本店',       accountHolder: 'ｹﾝｾﾂｻﾎﾟｰﾄ' },
  6:  { bankName: '千葉銀行',     branchName: '柏支店',     accountHolder: 'ｴｲﾄｸﾞﾙｰﾌﾟ' },
  7:  { bankName: '三菱UFJ銀行',  branchName: '渋谷支店',   accountHolder: 'ｳｨﾅｰｽﾞ' },
  8:  { bankName: 'みずほ銀行',   branchName: '新宿支店',   accountHolder: 'ｷｬﾘｰﾁ' },
  9:  { bankName: '三井住友銀行', branchName: '池袋支店',   accountHolder: 'ｳｨﾅｰｽﾞｸﾗﾌﾞ' },
  10: { bankName: 'りそな銀行',   branchName: '池袋支店',   accountHolder: 'ｼﾞｰﾌｧｰﾑ' },
  11: { bankName: '三菱UFJ銀行',  branchName: '品川支店',   accountHolder: 'ｲﾝﾌｨﾆﾃｨｸﾞﾙｰﾌﾟ' },
};

// --- 全社の取引先定義 ---
type PartnerDef = { name: string; type: 'CUSTOMER' | 'VENDOR' | 'BOTH'; tagKey: string };
const companyPartnerData: Record<number, PartnerDef[]> = {
  // comp_1 起工業: seed-reset.ts で個別に作成済み → ここではスキップ
  0: [],
  1: [
    { name: '（株）高岡建材センター', type: 'VENDOR', tagKey: 'SUBCONTRACTOR' },
    { name: '国土交通省北陸地方整備局', type: 'CUSTOMER', tagKey: 'CUSTOMER' },
    { name: '（株）石川鉄工所', type: 'VENDOR', tagKey: 'EXPENSE' },
  ],
  2: [
    { name: '（株）越前コンクリート', type: 'VENDOR', tagKey: 'SUBCONTRACTOR' },
    { name: '富山市役所', type: 'CUSTOMER', tagKey: 'CUSTOMER' },
    { name: '（有）加賀塗装', type: 'VENDOR', tagKey: 'EXPENSE' },
    { name: '北陸電力（株）', type: 'VENDOR', tagKey: 'EXPENSE' },
    { name: '（株）立山測量', type: 'BOTH', tagKey: 'SUBCONTRACTOR' },
  ],
  3: [
    { name: '（株）金沢機械リース', type: 'VENDOR', tagKey: 'SUBCONTRACTOR' },
    { name: '石川県庁', type: 'CUSTOMER', tagKey: 'CUSTOMER' },
    { name: '（株）北陸ガス設備', type: 'VENDOR', tagKey: 'EXPENSE' },
  ],
  4: [
    { name: '（株）砺波重機', type: 'VENDOR', tagKey: 'SUBCONTRACTOR' },
    { name: '砺波市役所', type: 'CUSTOMER', tagKey: 'CUSTOMER' },
    { name: '（有）南砺建材', type: 'BOTH', tagKey: 'SUBCONTRACTOR' },
    { name: 'NTT西日本', type: 'VENDOR', tagKey: 'EXPENSE' },
  ],
  5: [
    { name: '（株）富山機材', type: 'VENDOR', tagKey: 'SUBCONTRACTOR' },
    { name: '起工業', type: 'CUSTOMER', tagKey: 'GROUP_COMPANY' },
    { name: '（株）日本海測量', type: 'VENDOR', tagKey: 'EXPENSE' },
  ],
  6: [
    { name: '（株）北陸生コン', type: 'VENDOR', tagKey: 'SUBCONTRACTOR' },
    { name: '高岡市役所', type: 'CUSTOMER', tagKey: 'CUSTOMER' },
    { name: '（有）八尾建機', type: 'VENDOR', tagKey: 'EXPENSE' },
    { name: '（株）呉西土木', type: 'BOTH', tagKey: 'SUBCONTRACTOR' },
  ],
  7: [
    { name: '（株）メディアプランニング', type: 'VENDOR', tagKey: 'SUBCONTRACTOR' },
    { name: '（株）ABC商事', type: 'CUSTOMER', tagKey: 'CUSTOMER' },
    { name: '（株）デジタルクリエイト', type: 'VENDOR', tagKey: 'EXPENSE' },
    { name: 'Google Japan LLC', type: 'VENDOR', tagKey: 'EXPENSE' },
  ],
  8: [
    { name: '（株）リクルーティング東京', type: 'VENDOR', tagKey: 'SUBCONTRACTOR' },
    { name: '（株）TKホールディングス', type: 'CUSTOMER', tagKey: 'CUSTOMER' },
    { name: 'AWS Japan（株）', type: 'VENDOR', tagKey: 'EXPENSE' },
  ],
  9: [
    { name: '（株）イベントプロ', type: 'VENDOR', tagKey: 'SUBCONTRACTOR' },
    { name: '（株）スポーツファン', type: 'CUSTOMER', tagKey: 'CUSTOMER' },
    { name: '（株）東京印刷', type: 'VENDOR', tagKey: 'EXPENSE' },
  ],
  10: [
    { name: '（株）北陸農材', type: 'VENDOR', tagKey: 'SUBCONTRACTOR' },
    { name: 'JA富山', type: 'BOTH', tagKey: 'CUSTOMER' },
    { name: '（有）越中種苗', type: 'VENDOR', tagKey: 'EXPENSE' },
    { name: '道の駅ファーム富山', type: 'CUSTOMER', tagKey: 'CUSTOMER' },
  ],
  11: [
    { name: '（株）グローバルコンサル', type: 'VENDOR', tagKey: 'SUBCONTRACTOR' },
    { name: '（株）ネクストホールディングス', type: 'CUSTOMER', tagKey: 'CUSTOMER' },
    { name: '（株）品川オフィス管理', type: 'VENDOR', tagKey: 'EXPENSE' },
    { name: 'Microsoft Japan（株）', type: 'VENDOR', tagKey: 'EXPENSE' },
  ],
};

// --- 全社の給与グループ定義 ---
type PayrollDef = { name: string; costType: string; headcount: number; payDay: number | null; payDayIsMonthEnd: boolean };
const companyPayrollData: Record<number, PayrollDef[]> = {
  // comp_1: seed-reset.ts で個別に作成済み → ここではスキップ
  0: [],
  1:  [{ name: '現場作業員', costType: 'COST', headcount: 20, payDay: 25, payDayIsMonthEnd: false },
       { name: '管理部門', costType: 'SGA', headcount: 8, payDay: 25, payDayIsMonthEnd: false }],
  2:  [{ name: '現場作業員', costType: 'COST', headcount: 12, payDay: 27, payDayIsMonthEnd: false },
       { name: '管理部門', costType: 'SGA', headcount: 4, payDay: 27, payDayIsMonthEnd: false }],
  3:  [{ name: '技術職', costType: 'COST', headcount: 10, payDay: 25, payDayIsMonthEnd: false },
       { name: '事務職', costType: 'SGA', headcount: 3, payDay: 25, payDayIsMonthEnd: false }],
  4:  [{ name: '現場', costType: 'COST', headcount: 8, payDay: null, payDayIsMonthEnd: true },
       { name: '管理', costType: 'SGA', headcount: 3, payDay: null, payDayIsMonthEnd: true }],
  5:  [{ name: '作業員', costType: 'COST', headcount: 6, payDay: 25, payDayIsMonthEnd: false }],
  6:  [{ name: '現場部門', costType: 'COST', headcount: 18, payDay: 25, payDayIsMonthEnd: false },
       { name: '管理部門', costType: 'SGA', headcount: 7, payDay: 25, payDayIsMonthEnd: false }],
  7:  [{ name: '正社員', costType: 'SGA', headcount: 12, payDay: 25, payDayIsMonthEnd: false },
       { name: '業務委託', costType: 'OUTSOURCE', headcount: 5, payDay: 25, payDayIsMonthEnd: false }],
  8:  [{ name: '正社員', costType: 'SGA', headcount: 8, payDay: null, payDayIsMonthEnd: true }],
  9:  [{ name: 'スタッフ', costType: 'SGA', headcount: 6, payDay: 25, payDayIsMonthEnd: false }],
  10: [{ name: '農場スタッフ', costType: 'SGA', headcount: 4, payDay: 25, payDayIsMonthEnd: false }],
  11: [{ name: '管理部門', costType: 'SGA', headcount: 10, payDay: 25, payDayIsMonthEnd: false }],
};

// --- トランザクション生成���テンプレート ---
// 各社ごとに複数の経費パターン（midName + summary）を持つ
type CompanyTxTemplate = {
  expenses: { summary: string; midName: string; baseAmount: number }[];
  salesSummary: string;
  salesBaseAmount: number;
  costSummary: string;
  costBaseAmount: number;
  salaryBaseAmount: number;
};

const companyTxTemplates: Record<number, CompanyTxTemplate> = {
  0: {
    expenses: [
      { summary: '電気工事用部材', midName: '消耗品費', baseAmount: 182000 },
      { summary: '現場消耗品', midName: '消耗品費', baseAmount: 45000 },
      { summary: '事務用品購入', midName: '消耗品費', baseAmount: 28000 },
    ],
    salesSummary: '道路改修工事', salesBaseAmount: 3500000,
    costSummary: '外注費（北陸建材）', costBaseAmount: 1450000,
    salaryBaseAmount: 2850000,
  },
  1: {
    expenses: [
      { summary: '鉄骨加工費', midName: '消耗品費', baseAmount: 345000 },
      { summary: '重機燃料費', midName: '消耗品費', baseAmount: 78000 },
      { summary: '現場事務所電気代', midName: '水道光熱費', baseAmount: 52000 },
    ],
    salesSummary: '河川護岸工事', salesBaseAmount: 4800000,
    costSummary: '建材仕入（高岡建材）', costBaseAmount: 1980000,
    salaryBaseAmount: 4200000,
  },
  2: {
    expenses: [
      { summary: '電気料金', midName: '水道光熱費', baseAmount: 87000 },
      { summary: 'ガス料金', midName: '水道光熱費', baseAmount: 35000 },
      { summary: '水道料金', midName: '水道光熱費', baseAmount: 22000 },
    ],
    salesSummary: '市道舗装工事', salesBaseAmount: 2100000,
    costSummary: 'コンクリート仕入', costBaseAmount: 870000,
    salaryBaseAmount: 1980000,
  },
  3: {
    expenses: [
      { summary: 'ガス設備点検費', midName: '水道光熱費', baseAmount: 126000 },
      { summary: '安全装備購入', midName: '消耗品費', baseAmount: 64000 },
      { summary: '車両整備費', midName: '消耗品費', baseAmount: 95000 },
    ],
    salesSummary: '建築基礎工事', salesBaseAmount: 1850000,
    costSummary: '重機リース（金沢機械）', costBaseAmount: 650000,
    salaryBaseAmount: 1650000,
  },
  4: {
    expenses: [
      { summary: 'インターネット回線料', midName: '通信費', baseAmount: 54000 },
      { summary: '携帯電話料金', midName: '通信費', baseAmount: 38000 },
      { summary: 'ETC利用料', midName: '消耗品費', baseAmount: 42000 },
    ],
    salesSummary: '農道整備工事', salesBaseAmount: 980000,
    costSummary: '重機レンタル', costBaseAmount: 420000,
    salaryBaseAmount: 1200000,
  },
  5: {
    expenses: [
      { summary: '測量業務委託', midName: '消耗品費', baseAmount: 210000 },
      { summary: '事務所家賃', midName: '地代家賃', baseAmount: 120000 },
      { summary: '通信費', midName: '通信費', baseAmount: 35000 },
    ],
    salesSummary: '現場管理業務', salesBaseAmount: 1200000,
    costSummary: '機材購入（富山機材）', costBaseAmount: 380000,
    salaryBaseAmount: 1050000,
  },
  6: {
    expenses: [
      { summary: '建機リース料', midName: '消耗品費', baseAmount: 498000 },
      { summary: '現場電気代', midName: '水道光熱費', baseAmount: 67000 },
      { summary: '安全協力会費', midName: '消耗品費', baseAmount: 30000 },
    ],
    salesSummary: '市庁舎改築工事', salesBaseAmount: 3200000,
    costSummary: '生コン仕入', costBaseAmount: 1650000,
    salaryBaseAmount: 3800000,
  },
  7: {
    expenses: [
      { summary: 'Google広告費', midName: '広告宣伝費', baseAmount: 320000 },
      { summary: 'Meta広告費', midName: '広告宣伝費', baseAmount: 185000 },
      { summary: 'デザイン外注費', midName: '消耗品費', baseAmount: 250000 },
    ],
    salesSummary: 'Web広告運用', salesBaseAmount: 2750000,
    costSummary: '制作外注費', costBaseAmount: 890000,
    salaryBaseAmount: 2400000,
  },
  8: {
    expenses: [
      { summary: 'AWSサーバー費', midName: '通信費', baseAmount: 178000 },
      { summary: 'Slack/SaaS費', midName: '通信費', baseAmount: 65000 },
      { summary: 'オフィス家賃', midName: '地代家賃', baseAmount: 350000 },
    ],
    salesSummary: '人材紹介フィー', salesBaseAmount: 1650000,
    costSummary: '人材紹介外注費', costBaseAmount: 560000,
    salaryBaseAmount: 1600000,
  },
  9: {
    expenses: [
      { summary: '会報印刷費', midName: '消耗品費', baseAmount: 95000 },
      { summary: 'イベント会場費', midName: '消耗品費', baseAmount: 180000 },
      { summary: '通信費', midName: '通信費', baseAmount: 28000 },
    ],
    salesSummary: '会費収入', salesBaseAmount: 850000,
    costSummary: 'イベント運営委託', costBaseAmount: 320000,
    salaryBaseAmount: 1100000,
  },
  10: {
    expenses: [
      { summary: '種苗購入費', midName: '消耗品費', baseAmount: 67000 },
      { summary: '肥料・農薬費', midName: '消耗品費', baseAmount: 45000 },
      { summary: '農業機械燃料', midName: '消耗品費', baseAmount: 38000 },
    ],
    salesSummary: '農産物直売', salesBaseAmount: 520000,
    costSummary: '農材仕入', costBaseAmount: 180000,
    salaryBaseAmount: 720000,
  },
  11: {
    expenses: [
      { summary: 'オフィス賃料', midName: '地代家賃', baseAmount: 410000 },
      { summary: 'クラウドサービス費', midName: '通信費', baseAmount: 125000 },
      { summary: '交通費（出張）', midName: '消耗品費', baseAmount: 85000 },
    ],
    salesSummary: 'コンサルフィー', salesBaseAmount: 4200000,
    costSummary: 'コンサル外注費', costBaseAmount: 1200000,
    salaryBaseAmount: 2200000,
  },
};

// 16ヶ月分の対象月（2025-01〜2026-04）
const MONTHS: string[] = [];
for (let y = 2025; y <= 2026; y++) {
  const maxM = y === 2025 ? 12 : 4;
  for (let m = 1; m <= maxM; m++) {
    MONTHS.push(`${y}-${String(m).padStart(2, '0')}`);
  }
}

// 擬似乱数（シード固定で再現可能）
function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

// 金額にランダムな揺れを加える（±20%）
function varyAmount(base: number, seed: number): number {
  const factor = 0.8 + seededRandom(seed) * 0.4; // 0.8〜1.2
  return Math.round(base * factor / 1000) * 1000; // 千円��位に丸め
}

// 月の支払日を生成（25日 or 月末）
function payDate(month: string, day: number): Date {
  const [y, m] = month.split('-').map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  return new Date(y, m - 1, Math.min(day, lastDay));
}

// ステー��スを月に応じて変化
function statusForMonth(monthIdx: number): 'DRAFT' | 'READY' | 'CONFIRMED' {
  if (monthIdx >= 15) return 'DRAFT';      // 2026-04 = 下書き
  if (monthIdx >= 14) return 'READY';      // 2026-03 = 準備完了
  return 'CONFIRMED';                       // 2025-01〜2026-02 = 確定済み
}

// ============================================================
// 全社の口座・取引先・給与グループを作成
// ============================================================
export async function seedAllCompanyMasters(
  companies: { id: string; name: string }[],
  midMap: Record<string, { id: string }>,
) {
  console.log('\n📦 Seeding all-company master data...');

  const companyAccounts: Record<number, { mainId: string; termId: string }> = {};

  // --- 1. 銀行口座（普通・定期）---
  for (let i = 0; i < companies.length; i++) {
    // comp_0（起工業）は seed-reset.ts で既に作成済み → スキップ
    if (i === 0) continue;

    const bank = companyBankData[i];
    if (!bank) continue;

    const main = await prisma.account.create({
      data: {
        companyId: companies[i].id,
        bankName: bank.bankName,
        branchName: bank.branchName,
        accountNumber: `${i + 1}234567`,
        accountType: 'ORDINARY',
        accountHolder: bank.accountHolder,
        isMain: true,
        isVirtual: false,
        isVisible: true,
        displayOrder: 1,
      },
    });

    const term = await prisma.account.create({
      data: {
        companyId: companies[i].id,
        bankName: bank.bankName,
        branchName: bank.branchName,
        accountNumber: `${i + 1}234568`,
        accountType: 'TERM',
        accountHolder: bank.accountHolder,
        isMain: false,
        isVirtual: false,
        isVisible: true,
        displayOrder: 2,
      },
    });

    await prisma.company.update({
      where: { id: companies[i].id },
      data: { mainAccountId: main.id },
    });

    companyAccounts[i] = { mainId: main.id, termId: term.id };
  }
  console.log('  Bank accounts for 11 companies');

  // --- 2. 取引先 ---
  const companyPartners: Record<number, { id: string; type: string; tagKey: string; name: string }[]> = {};
  for (let i = 0; i < companies.length; i++) {
    const defs = companyPartnerData[i];
    if (!defs || defs.length === 0) continue;

    const created = await Promise.all(
      defs.map(p => prisma.tradingPartner.create({
        data: { companyId: companies[i].id, name: p.name, type: p.type, tagKey: p.tagKey, isActive: true },
      }))
    );
    companyPartners[i] = created.map((c, j) => ({ id: c.id, type: defs[j].type, tagKey: defs[j].tagKey, name: defs[j].name }));
  }
  console.log('  Trading partners for 11 companies');

  // --- 3. 給与グループ ---
  const companyPayrolls: Record<number, { id: string; name: string }[]> = {};
  for (let i = 0; i < companies.length; i++) {
    const defs = companyPayrollData[i];
    if (!defs || defs.length === 0) continue;

    const created = await Promise.all(
      defs.map((d, j) => prisma.payrollGroup.create({
        data: {
          companyId: companies[i].id,
          name: d.name,
          costType: d.costType,
          headcount: d.headcount,
          payDay: d.payDay,
          payDayIsMonthEnd: d.payDayIsMonthEnd,
          holidayAdjust: 'PREV_BUSINESS',
          isActive: true,
          displayOrder: j + 1,
        },
      }))
    );
    companyPayrolls[i] = created.map(c => ({ id: c.id, name: c.name }));
  }
  console.log('  Payroll groups for 11 companies');

  console.log('✅ All-company master data complete');
  return { companyAccounts, companyPartners, companyPayrolls };
}

// ============================================================
// 全社のトランザクション（経費/売上/給与/原価支払）を12ヶ月分作成
// 11社 × 12ヶ月 × (経費3件 + 売上1件 + 原価1件 + 給与1件) ≈ 792件
// ============================================================
export async function seedAllCompanyTransactions(
  companies: { id: string; name: string }[],
  mainAccountId: string,
  companyAccounts: Record<number, { mainId: string; termId: string }>,
  companyPartners: Record<number, { id: string; type: string; tagKey: string; name: string }[]>,
  companyPayrolls: Record<number, { id: string; name: string }[]>,
  midMap: Record<string, { id: string }>,
) {
  console.log('\n📊 Seeding all-company transactions (12 months × 6 types)...');

  companyAccounts[0] = { mainId: mainAccountId, termId: '' };

  const 売上mid = midMap['売上'];
  const 外注費mid = midMap['外注費'];
  let totalTx = 0;
  let totalSalary = 0;

  for (let i = 0; i < companies.length; i++) {
    const acct = companyAccounts[i];
    if (!acct) continue;
    // 起工業(i=0) も含めて全社生成

    const partners = companyPartners[i] || [];
    const payrolls = companyPayrolls[i] || [];
    const tmpl = companyTxTemplates[i];
    if (!tmpl) continue;

    const expensePartners = partners.filter(p => p.tagKey === 'EXPENSE');
    const customerPartner = partners.find(p => p.type === 'CUSTOMER' || p.tagKey === 'CUSTOMER');
    const vendorPartners = partners.filter(p => p.tagKey === 'SUBCONTRACTOR');

    for (let mIdx = 0; mIdx < MONTHS.length; mIdx++) {
      const month = MONTHS[mIdx];
      const status = statusForMonth(mIdx);
      const isConfirmed = status === 'CONFIRMED';
      const seed = i * 100 + mIdx;

      // --- 経費（EXPENSE）: 各テンプレート分（2〜3件/月）---
      for (let eIdx = 0; eIdx < tmpl.expenses.length; eIdx++) {
        const exp = tmpl.expenses[eIdx];
        const expMid = midMap[exp.midName];
        const amt = varyAmount(exp.baseAmount, seed + eIdx * 17);
        const day = 10 + Math.floor(seededRandom(seed + eIdx * 31) * 18); // 10〜27日
        const txDate = payDate(month, day);
        const partner = expensePartners[eIdx % Math.max(expensePartners.length, 1)] || null;

        await prisma.transaction.create({
          data: {
            companyId: companies[i].id,
            accountId: acct.mainId,
            partnerId: partner?.id || null,
            type: 'EXPENSE',
            status,
            transactionDate: txDate,
            scheduledDate: txDate,
            accountingMonth: month,
            amount: BigInt(-amt),
            actualAmount: isConfirmed ? BigInt(-amt) : null,
            paymentMethod: eIdx % 2 === 0 ? 'BANK_TRANSFER' : 'DIRECT_DEBIT',
            classification: eIdx === 0 ? 'VARIABLE' : 'FIXED',
            summary: `${month} ${exp.summary}`,
            confirmedAt: isConfirmed ? txDate : null,
            displayOrder: eIdx + 1,
            details: {
              create: {
                midId: expMid?.id,
                amount: BigInt(-amt),
                classification: eIdx === 0 ? 'VARIABLE' : 'FIXED',
                summary: exp.summary,
                displayOrder: 1,
              },
            },
          },
        });
        totalTx++;
      }

      // --- 売上（SALES）: 1件/月 ---
      const salesAmt = varyAmount(tmpl.salesBaseAmount, seed + 200);
      const salesDate = payDate(month, 28);
      await prisma.transaction.create({
        data: {
          companyId: companies[i].id,
          accountId: acct.mainId,
          partnerId: customerPartner?.id || null,
          type: 'SALES',
          status,
          transactionDate: salesDate,
          scheduledDate: salesDate,
          accountingMonth: month,
          amount: BigInt(salesAmt),
          actualAmount: isConfirmed ? BigInt(salesAmt) : null,
          invoiceAmount: BigInt(salesAmt),
          paymentMethod: 'BANK_TRANSFER',
          summary: `${month} ${tmpl.salesSummary}`,
          confirmedAt: isConfirmed ? salesDate : null,
          displayOrder: 1,
          details: {
            create: {
              midId: 売上mid?.id,
              amount: BigInt(salesAmt),
              summary: tmpl.salesSummary,
              displayOrder: 1,
            },
          },
        },
      });
      totalTx++;

      // --- 原価支払（COST_PAYMENT）: 1件/月 ---
      const costAmt = varyAmount(tmpl.costBaseAmount, seed + 300);
      const costDate = payDate(month, 25);
      const costPartner = vendorPartners[mIdx % Math.max(vendorPartners.length, 1)] || null;
      await prisma.transaction.create({
        data: {
          companyId: companies[i].id,
          accountId: acct.mainId,
          partnerId: costPartner?.id || null,
          type: 'COST_PAYMENT',
          status,
          transactionDate: costDate,
          scheduledDate: costDate,
          accountingMonth: month,
          amount: BigInt(-costAmt),
          actualAmount: isConfirmed ? BigInt(-costAmt) : null,
          paymentMethod: 'BANK_TRANSFER',
          classification: 'VARIABLE',
          summary: `${month} ${tmpl.costSummary}`,
          confirmedAt: isConfirmed ? costDate : null,
          displayOrder: 1,
          details: {
            create: {
              midId: 外注費mid?.id,
              amount: BigInt(-costAmt),
              classification: 'VARIABLE',
              summary: tmpl.costSummary,
              displayOrder: 1,
            },
          },
        },
      });
      totalTx++;

      // --- 給与（SALARY）+ SalaryEntry: 1件/月 ---
      const salaryAmt = varyAmount(tmpl.salaryBaseAmount, seed + 400);
      const salaryD = payDate(month, 25);

      await prisma.transaction.create({
        data: {
          companyId: companies[i].id,
          accountId: acct.mainId,
          type: 'SALARY',
          status,
          transactionDate: salaryD,
          scheduledDate: salaryD,
          accountingMonth: month,
          amount: BigInt(-salaryAmt),
          actualAmount: isConfirmed ? BigInt(-salaryAmt) : null,
          paymentMethod: 'BANK_TRANSFER',
          summary: `${month}分給与`,
          confirmedAt: isConfirmed ? salaryD : null,
          displayOrder: 1,
        },
      });
      totalTx++;

      if (payrolls.length > 0) {
        const siReserve = Math.round(salaryAmt * 0.08);
        const ctReserve = Math.round(salaryAmt * 0.04);
        const rentDed = Math.round(salaryAmt * 0.06);
        const telecomDed = Math.round(salaryAmt * 0.02);
        const totalDed = rentDed + telecomDed;
        const netPay = salaryAmt - totalDed;

        await prisma.salaryEntry.create({
          data: {
            payrollGroupId: payrolls[mIdx % payrolls.length].id,
            payMonth: month,
            payDate: salaryD,
            taxablePayment: BigInt(Math.round(salaryAmt * 0.88)),
            transportAllowance: BigInt(Math.round(salaryAmt * 0.05)),
            totalPayment: BigInt(salaryAmt),
            socialInsuranceReserve: BigInt(siReserve),
            consumptionTaxReserve: BigInt(ctReserve),
            totalDeduction: BigInt(totalDed),
            netPayment: BigInt(netPay),
            headcount: payrolls[0].name.includes('現場') || payrolls[0].name.includes('作業') ? 10 : 5,
            status,
            confirmedAt: isConfirmed ? salaryD : null,
            deductions: {
              create: [
                { itemName: '家賃控除', amount: BigInt(rentDed), displayOrder: 1 },
                { itemName: '通信費控除', amount: BigInt(telecomDed), displayOrder: 2 },
              ],
            },
            paymentDetails: {
              create: [{
                paymentDate: salaryD,
                paymentMethod: 'BANK_TRANSFER',
                accountId: acct.mainId,
                amount: BigInt(netPay),
                displayOrder: 1,
              }],
            },
          },
        });
        totalSalary++;
      }
    }

    console.log(`  ${companies[i].name}: done`);
  }

  console.log(`✅ All-company transactions complete (${totalTx} transactions, ${totalSalary} salary entries)`);
}
