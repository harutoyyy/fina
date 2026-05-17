// ============================================================
// 各メニュー10件補充シード
// 既存 seed.ts / seed-testdata.ts 実行済みの前提
// 不足しているテーブルに10件補充する（起工業中心）
//
// 実行: npx tsx prisma/seed-ten-each.ts
// ============================================================

import { PrismaClient, TransactionType, TransactionStatus, PaymentMethod, AccountType } from '@prisma/client';

const prisma = new PrismaClient();

function ymd(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day));
}

async function main() {
  console.log('🌱 Seeding 10-each missing data...');

  // ============================================================
  // マスタ取得
  // ============================================================
  const companies = await prisma.company.findMany({ orderBy: { displayOrder: 'asc' } });
  if (companies.length === 0) throw new Error('Run seed.ts first');
  const okoshi = companies[0];

  const accounts = await prisma.account.findMany({ where: { companyId: okoshi.id } });
  const mainAccount = accounts.find(a => a.isMain && !a.isVirtual);
  if (!mainAccount) throw new Error('main account not found');

  const partners = await prisma.tradingPartner.findMany({ where: { companyId: okoshi.id } });
  const partnerByName = (n: string) => partners.find(p => p.name === n);
  const anyVendor = partners.find(p => p.type === 'VENDOR' || p.type === 'BOTH')!;

  const mids = await prisma.accountCategoryMid.findMany({ include: { major: true } });
  const findMid = (name: string, majorName?: string) =>
    mids.find(m => m.name === name && (majorName ? m.major.name === majorName : true));

  const 通信費 = findMid('通信費')!;
  const 水道光熱費 = findMid('水道光熱費')!;
  const 地代家賃 = findMid('地代家賃')!;
  const リース料 = findMid('リース料')!;
  const 支払手数料 = findMid('支払手数料')!;
  const 支払利息 = findMid('支払利息')!;
  const 旅費販管 = findMid('旅費交通費', '販売管理費')!;
  const 消耗品費 = findMid('消耗品費')!;
  const 会議費 = findMid('会議費')!;
  const 交際費 = findMid('交際費')!;
  const 租税公課 = findMid('租税公課')!;

  console.log('✅ master loaded');

  // ============================================================
  // 1. IndustryMaster (業種) 10件
  // ============================================================
  const industries = [
    { name: '建設業', code: 'CONST', displayOrder: 1 },
    { name: '広告業', code: 'AD', displayOrder: 2 },
    { name: '不動産業', code: 'REAL', displayOrder: 3 },
    { name: '製造業', code: 'MFG', displayOrder: 4 },
    { name: '小売業', code: 'RETAIL', displayOrder: 5 },
    { name: 'サービス業', code: 'SVC', displayOrder: 6 },
    { name: 'IT・通信業', code: 'IT', displayOrder: 7 },
    { name: '飲食業', code: 'FOOD', displayOrder: 8 },
    { name: '運輸業', code: 'LOGI', displayOrder: 9 },
    { name: 'その他', code: 'OTHER', displayOrder: 10 },
  ];
  for (const ind of industries) {
    await prisma.industryMaster.upsert({
      where: { name: ind.name },
      create: ind,
      update: ind,
    });
  }
  console.log('✅ IndustryMaster: 10');

  // ============================================================
  // 2. SalesItemMaster (売上項目) 10件
  // ============================================================
  const salesItems = [
    { name: '工事売上', shortName: '工事', defaultClassification: 'VARIABLE', displayOrder: 1 },
    { name: '設計売上', shortName: '設計', defaultClassification: 'VARIABLE', displayOrder: 2 },
    { name: '保守売上', shortName: '保守', defaultClassification: 'FIXED', displayOrder: 3 },
    { name: '広告売上', shortName: '広告', defaultClassification: 'VARIABLE', displayOrder: 4 },
    { name: '地代収入', shortName: '地代', defaultClassification: 'FIXED', displayOrder: 5 },
    { name: '家賃収入', shortName: '家賃', defaultClassification: 'FIXED', displayOrder: 6 },
    { name: 'コンサル売上', shortName: 'コンサル', defaultClassification: 'VARIABLE', displayOrder: 7 },
    { name: 'ライセンス売上', shortName: 'ライセンス', defaultClassification: 'FIXED', displayOrder: 8 },
    { name: '販売手数料', shortName: '手数料', defaultClassification: 'VARIABLE', displayOrder: 9 },
    { name: '雑収入', shortName: '雑収', defaultClassification: 'TEMPORARY', displayOrder: 10 },
  ];
  const existingSI = await prisma.salesItemMaster.count();
  if (existingSI < 10) {
    for (const s of salesItems) {
      await prisma.salesItemMaster.create({ data: s });
    }
  }
  console.log('✅ SalesItemMaster: 10');

  // ============================================================
  // 3. CompanyGroup (会社グループ) 10件 + メンバー
  // ============================================================
  const groupSpecs = [
    { name: '起グループ', shortName: '起G', colorCode: '#4F46E5', companyIdx: [0, 1, 2], displayOrder: 1 },
    { name: '松村グループ', shortName: '松村G', colorCode: '#059669', companyIdx: [2], displayOrder: 2 },
    { name: '佐藤グループ', shortName: '佐藤G', colorCode: '#DC2626', companyIdx: [3], displayOrder: 3 },
    { name: '吉川グループ', shortName: '吉川G', colorCode: '#EA580C', companyIdx: [4], displayOrder: 4 },
    { name: '建設サポートG', shortName: '建設SG', colorCode: '#7C3AED', companyIdx: [5], displayOrder: 5 },
    { name: 'エイトグループ', shortName: 'エイトG', colorCode: '#0891B2', companyIdx: [6], displayOrder: 6 },
    { name: 'WINNERSグループ', shortName: 'W-G', colorCode: '#DB2777', companyIdx: [7, 8, 9], displayOrder: 7 },
    { name: 'CAREECHグループ', shortName: 'CG', colorCode: '#16A34A', companyIdx: [8], displayOrder: 8 },
    { name: 'G-FARMグループ', shortName: 'GF', colorCode: '#CA8A04', companyIdx: [10], displayOrder: 9 },
    { name: 'インフィニティG', shortName: 'インフィG', colorCode: '#475569', companyIdx: [11], displayOrder: 10 },
  ];
  for (const g of groupSpecs) {
    const existing = await prisma.companyGroup.findFirst({ where: { name: g.name } });
    if (existing) continue;
    const created = await prisma.companyGroup.create({
      data: {
        name: g.name,
        shortName: g.shortName,
        colorCode: g.colorCode,
        displayOrder: g.displayOrder,
      },
    });
    for (let i = 0; i < g.companyIdx.length; i++) {
      const cIdx = g.companyIdx[i];
      if (cIdx >= companies.length) continue;
      await prisma.companyGroupMember.create({
        data: {
          groupId: created.id,
          companyId: companies[cIdx].id,
          role: i === 0 ? 'PARENT' : 'MEMBER',
          displayOrder: i,
        },
      });
    }
  }
  console.log('✅ CompanyGroup: 10');

  // ============================================================
  // 4. TaxPaymentSchedule (納税予定表) 10件 (起工業)
  // ============================================================
  const fy = 2026;
  const taxSchedules = [
    { taxType: 'CORPORATE',   periodLabel: '確定',  dueDate: ymd(fy, 5, 31),  scheduledAmount: 1_200_000n },
    { taxType: 'CORPORATE',   periodLabel: '中間1', dueDate: ymd(fy, 11, 30), scheduledAmount: 600_000n },
    { taxType: 'CONSUMPTION', periodLabel: '確定',  dueDate: ymd(fy, 5, 31),  scheduledAmount: 2_400_000n },
    { taxType: 'CONSUMPTION', periodLabel: '中間1', dueDate: ymd(fy, 8, 31),  scheduledAmount: 600_000n },
    { taxType: 'CONSUMPTION', periodLabel: '中間2', dueDate: ymd(fy, 11, 30), scheduledAmount: 600_000n },
    { taxType: 'CONSUMPTION', periodLabel: '中間3', dueDate: ymd(fy + 1, 2, 28), scheduledAmount: 600_000n },
    { taxType: 'RESIDENT',    periodLabel: '確定',  dueDate: ymd(fy, 5, 31),  scheduledAmount: 350_000n },
    { taxType: 'BUSINESS',    periodLabel: '確定',  dueDate: ymd(fy, 5, 31),  scheduledAmount: 280_000n },
    { taxType: 'FIXED_ASSET', periodLabel: '第1期', dueDate: ymd(fy, 6, 30),  scheduledAmount: 180_000n },
    { taxType: 'FIXED_ASSET', periodLabel: '第2期', dueDate: ymd(fy, 9, 30),  scheduledAmount: 180_000n },
  ];
  const existingTax = await prisma.taxPaymentSchedule.count({ where: { companyId: okoshi.id } });
  if (existingTax < 10) {
    for (const t of taxSchedules) {
      await prisma.taxPaymentSchedule.create({
        data: {
          companyId: okoshi.id,
          fiscalYear: fy,
          accountId: mainAccount.id,
          calculationMethod: 'MANUAL',
          ...t,
        },
      });
    }
  }
  console.log('✅ TaxPaymentSchedule: 10');

  // ============================================================
  // 5. CreditCard (10) + CardStatement (10)
  // ============================================================
  const cardSpecs = [
    { cardName: '法人VISAゴールド', cardBrand: 'VISA', cardLast4: '1001', holderName: 'OKOSHI KOGYO', closingDay: 15, paymentDay: 10 },
    { cardName: 'JCB法人カード', cardBrand: 'JCB', cardLast4: '1002', holderName: 'OKOSHI KOGYO', closingDay: 15, paymentDay: 10 },
    { cardName: '楽天ビジネスカード', cardBrand: 'VISA', cardLast4: '1003', holderName: 'OKOSHI KOGYO', closingDay: 27, paymentDay: 27 },
    { cardName: 'アメックスビジネス', cardBrand: 'AMEX', cardLast4: '1004', holderName: 'OKOSHI KOGYO', closingDay: 5, paymentDay: 26 },
    { cardName: 'ダイナースクラブ', cardBrand: 'DINERS', cardLast4: '1005', holderName: 'OKOSHI KOGYO', closingDay: 15, paymentDay: 10 },
    { cardName: 'MUFGカード', cardBrand: 'MASTER', cardLast4: '1006', holderName: 'OKOSHI KOGYO', closingDay: 15, paymentDay: 10 },
    { cardName: 'SMBCカード', cardBrand: 'VISA', cardLast4: '1007', holderName: 'OKOSHI KOGYO', closingDay: 15, paymentDay: 10 },
    { cardName: 'りそなカード', cardBrand: 'JCB', cardLast4: '1008', holderName: 'OKOSHI KOGYO', closingDay: 15, paymentDay: 10 },
    { cardName: 'セゾン法人カード', cardBrand: 'VISA', cardLast4: '1009', holderName: 'OKOSHI KOGYO', closingDay: 10, paymentDay: 4 },
    { cardName: 'オリコビジネスカード', cardBrand: 'MASTER', cardLast4: '1010', holderName: 'OKOSHI KOGYO', closingDay: 31, paymentDay: 27 },
  ];
  for (let i = 0; i < cardSpecs.length; i++) {
    const spec = cardSpecs[i];
    const existing = await prisma.creditCard.findFirst({ where: { companyId: okoshi.id, cardName: spec.cardName } });
    if (existing) continue;
    const card = await prisma.creditCard.create({
      data: {
        companyId: okoshi.id,
        paymentAccountId: mainAccount.id,
        ...spec,
        isActive: true,
      },
    });
    // 各カードにつき明細を1件入れる（合計10件）
    await prisma.cardStatement.create({
      data: {
        cardId: card.id,
        statementMonth: '2026-05',
        statementDate: ymd(2026, 5, 1 + i),
        storeName: ['Amazon Business', 'スターバックス', 'ENEOS', 'Apple Store', 'JR東日本', 'ANA', '楽天市場', 'ヨドバシ', 'コストコ', 'タイムズ24'][i],
        amount: BigInt((i + 1) * 3500),
        category: ['消耗品', '会議費', 'ガソリン', '消耗品', '旅費', '旅費', '消耗品', '消耗品', '会議費', '駐車場'][i],
        midId: [消耗品費.id, 会議費.id, 旅費販管.id, 消耗品費.id, 旅費販管.id, 旅費販管.id, 消耗品費.id, 消耗品費.id, 会議費.id, 旅費販管.id][i],
        summary: `${spec.cardName} 5月利用`,
        isPosted: false,
      },
    });
  }
  console.log('✅ CreditCard: 10 + CardStatement: 10');

  // ============================================================
  // 6. LoanContract (借入) を10件まで補充
  // ============================================================
  const existingLoanCount = await prisma.loanContract.count({ where: { companyId: okoshi.id } });
  const lender = partnerByName('千葉銀行') || anyVendor;
  const loansToAdd = Math.max(0, 10 - existingLoanCount);
  for (let i = 0; i < loansToAdd; i++) {
    const n = existingLoanCount + i + 1;
    const principal = BigInt((10 + i) * 1_000_000);
    await prisma.loanContract.create({
      data: {
        companyId: okoshi.id,
        partnerId: lender?.type === 'BOTH' || lender?.type === 'VENDOR' ? lender.id : null,
        contractName: `運転資金借入 No.${n}`,
        principalAmount: principal,
        executionDate: ymd(2025, 1 + (i % 12), 5),
        repaymentStartDate: ymd(2025, 2 + (i % 11), 27),
        repaymentMethod: 'EQUAL_PRINCIPAL',
        repaymentFrequency: 'MONTHLY',
        repaymentDay: 27,
        holidayAdjust: 'NEXT_BUSINESS',
        totalPayments: 60,
        completionDate: ymd(2030, 1 + (i % 12), 27),
        interestType: 'FIXED',
        interestRate: '1.50',
        interestTiming: 'ARREAR',
        dayCountBasis: 365,
        roundingRule: 'ROUND_HALF_UP',
        principalAdjust: 'LAST',
        remainingBalance: principal,
        status: 'ACTIVE',
        isGuaranteeAssociation: i % 2 === 0,
      },
    });
  }
  console.log(`✅ LoanContract: +${loansToAdd}`);

  // ============================================================
  // 7. LeaseContract (リース) を10件まで補充
  // ============================================================
  const existingLeaseCount = await prisma.leaseContract.count({ where: { companyId: okoshi.id } });
  const leaseAssets = [
    { name: '社用車 ハイエース', cat: 'VEHICLE', model: 'ハイエース', num: '習志野300あ1234' },
    { name: '社用車 プリウス', cat: 'VEHICLE', model: 'プリウス', num: '習志野300あ5678' },
    { name: '社用車 N-VAN', cat: 'VEHICLE', model: 'N-VAN', num: '習志野300あ9012' },
    { name: '代表車 アルファード', cat: 'REPRESENTATIVE', model: 'アルファード', num: '習志野300あ0001' },
    { name: '複合機 リコー', cat: 'OTHER', model: null, num: null },
    { name: '複合機 富士フイルム', cat: 'OTHER', model: null, num: null },
    { name: 'サーバ機器', cat: 'OTHER', model: null, num: null },
    { name: 'NEC PC リース', cat: 'OTHER', model: null, num: null },
    { name: '電話交換機', cat: 'OTHER', model: null, num: null },
    { name: '工事用機材', cat: 'OTHER', model: null, num: null },
  ];
  const leasePartner = partnerByName('オリックス自動車') || anyVendor;
  const leasesToAdd = Math.max(0, 10 - existingLeaseCount);
  for (let i = 0; i < leasesToAdd; i++) {
    const idx = existingLeaseCount + i;
    const a = leaseAssets[idx % leaseAssets.length];
    await prisma.leaseContract.create({
      data: {
        companyId: okoshi.id,
        partnerId: leasePartner?.id ?? null,
        contractName: a.name,
        monthlyAmount: BigInt(20_000 + (i * 5_000)),
        startDate: ymd(2024, 4, 1),
        endDate: ymd(2029, 3, 31),
        totalPayments: 60,
        paymentDay: 27,
        holidayAdjust: 'NEXT_BUSINESS',
        principalAdjust: 'LAST',
        accountId: mainAccount.id,
        midId: リース料.id,
        status: 'ACTIVE',
        assetCategory: a.cat,
        vehicleModel: a.model,
        vehicleNumber: a.num,
      },
    });
  }
  console.log(`✅ LeaseContract: +${leasesToAdd}`);

  // ============================================================
  // 8. CashWithdrawalBatch (現金引出) を10件まで補充
  // ============================================================
  const existingCWCount = await prisma.cashWithdrawalBatch.count({ where: { companyId: okoshi.id } });
  const cwToAdd = Math.max(0, 10 - existingCWCount);
  for (let i = 0; i < cwToAdd; i++) {
    const idx = existingCWCount + i;
    const amount = BigInt(50_000 + idx * 10_000);
    const batch = await prisma.cashWithdrawalBatch.create({
      data: {
        companyId: okoshi.id,
        accountId: mainAccount.id,
        withdrawalDate: ymd(2026, 5, 1 + idx),
        totalAmount: amount,
        status: idx % 2 === 0 ? 'CONFIRMED' : 'READY',
      },
    });
    // 金種表（簡易）
    const tenK = Number(amount) >= 10000 ? Math.floor(Number(amount) / 10000) : 0;
    const remainder = Number(amount) - tenK * 10000;
    await prisma.cashDenomination.create({
      data: {
        batchId: batch.id,
        yen10000: tenK,
        yen1000: Math.floor(remainder / 1000),
        total: amount,
        purposeLabel: '小口現金補充',
      },
    });
  }
  console.log(`✅ CashWithdrawalBatch: +${cwToAdd}`);

  // ============================================================
  // 9. RecurringTemplate (定期支払) を10件まで補充
  // ============================================================
  const existingRTCount = await prisma.recurringTemplate.count({ where: { companyId: okoshi.id } });
  const rtSpecs = [
    { name: '事務所家賃', frequency: 'MONTHLY', dueDayRule: 'DAY_25', amount: 350_000n, midId: 地代家賃.id, partnerName: null },
    { name: '電気代', frequency: 'MONTHLY', dueDayRule: 'DAY_27', amount: 45_000n, midId: 水道光熱費.id, partnerName: '東京電力' },
    { name: 'ガス代', frequency: 'MONTHLY', dueDayRule: 'MONTH_END', amount: 12_000n, midId: 水道光熱費.id, partnerName: '東京ガス' },
    { name: '携帯電話料金', frequency: 'MONTHLY', dueDayRule: 'DAY_15', amount: 28_000n, midId: 通信費.id, partnerName: 'NTT東日本' },
    { name: '光回線', frequency: 'MONTHLY', dueDayRule: 'DAY_20', amount: 6_600n, midId: 通信費.id, partnerName: 'NTT東日本' },
    { name: 'コピー機リース', frequency: 'MONTHLY', dueDayRule: 'DAY_27', amount: 35_000n, midId: リース料.id, partnerName: null },
    { name: '車両リース', frequency: 'MONTHLY', dueDayRule: 'DAY_27', amount: 48_000n, midId: リース料.id, partnerName: null },
    { name: '駐車場代', frequency: 'MONTHLY', dueDayRule: 'DAY_5', amount: 22_000n, midId: 地代家賃.id, partnerName: null },
    { name: 'ネットバンキング手数料', frequency: 'MONTHLY', dueDayRule: 'MONTH_END', amount: 3_300n, midId: 支払手数料.id, partnerName: null },
    { name: '社会保険料引落', frequency: 'MONTHLY', dueDayRule: 'MONTH_END', amount: 580_000n, midId: 租税公課.id, partnerName: null },
  ];
  const rtToAdd = Math.max(0, 10 - existingRTCount);
  for (let i = 0; i < rtToAdd; i++) {
    const s = rtSpecs[existingRTCount + i] ?? rtSpecs[i];
    const p = s.partnerName ? partnerByName(s.partnerName) : null;
    await prisma.recurringTemplate.create({
      data: {
        companyId: okoshi.id,
        name: s.name,
        frequency: s.frequency,
        dueDayRule: s.dueDayRule,
        holidayAdjust: 'PREV_BUSINESS',
        transactionType: 'EXPENSE',
        accountId: mainAccount.id,
        partnerId: p?.id ?? null,
        midId: s.midId,
        amountType: 'FIXED',
        fixedAmount: s.amount,
        paymentMethod: 'DIRECT_DEBIT',
        classification: 'FIXED',
        summary: s.name,
        isActive: true,
      },
    });
  }
  console.log(`✅ RecurringTemplate: +${rtToAdd}`);

  // ============================================================
  // 10. グループ間入力 (Transaction with linkedTransactionId) 10件
  // 起工業 ↔ 起グループ (companies[1]) の対称取引
  // ============================================================
  if (companies.length >= 2) {
    const okoshiGroup = companies[1];
    const ogAccounts = await prisma.account.findMany({ where: { companyId: okoshiGroup.id, isVirtual: false } });
    const ogMain = ogAccounts.find(a => a.isMain) ?? ogAccounts[0];
    if (ogMain) {
      const existingIG = await prisma.transaction.count({
        where: { companyId: okoshi.id, linkedTransactionId: { not: null } },
      });
      const igToAdd = Math.max(0, 10 - existingIG);
      // 起工業側の取引先「起グループ」を取得
      const partnerOG = partnerByName('起グループ');
      // 起グループ側の取引先「起工業」を作成 or 取得
      let partnerOK = await prisma.tradingPartner.findFirst({
        where: { companyId: okoshiGroup.id, name: '起工業' },
      });
      if (!partnerOK) {
        partnerOK = await prisma.tradingPartner.create({
          data: {
            companyId: okoshiGroup.id,
            name: '起工業',
            type: 'BOTH',
            tagKey: 'GROUP_COMPANY',
          },
        });
      }
      for (let i = 0; i < igToAdd; i++) {
        const amount = BigInt(100_000 + i * 50_000);
        const day = 5 + i;
        // 起工業側: 出金 (-)
        const okoshiTx = await prisma.transaction.create({
          data: {
            companyId: okoshi.id,
            accountId: mainAccount.id,
            partnerId: partnerOG?.id ?? null,
            type: 'TRANSFER',
            status: 'CONFIRMED',
            transactionDate: ymd(2026, 5, day),
            scheduledDate: ymd(2026, 5, day),
            accountingMonth: '2026-05',
            amount: -amount,
            paymentMethod: 'BANK_TRANSFER',
            classification: 'TEMPORARY',
            summary: `起グループへ立替金返金 ${i + 1}`,
          },
        });
        // 起グループ側: 入金 (+)
        const ogTx = await prisma.transaction.create({
          data: {
            companyId: okoshiGroup.id,
            accountId: ogMain.id,
            partnerId: partnerOK.id,
            type: 'TRANSFER',
            status: 'CONFIRMED',
            transactionDate: ymd(2026, 5, day),
            scheduledDate: ymd(2026, 5, day),
            accountingMonth: '2026-05',
            amount: amount,
            paymentMethod: 'BANK_TRANSFER',
            classification: 'TEMPORARY',
            summary: `起工業から立替金回収 ${i + 1}`,
            linkedTransactionId: okoshiTx.id,
          },
        });
        await prisma.transaction.update({
          where: { id: okoshiTx.id },
          data: { linkedTransactionId: ogTx.id },
        });
      }
      console.log(`✅ Inter-group transactions: +${igToAdd}`);
    }
  }

  // ============================================================
  // サマリ出力
  // ============================================================
  console.log('\n📊 Final counts (okoshi):');
  const c = okoshi.id;
  console.log({
    IndustryMaster: await prisma.industryMaster.count(),
    SalesItemMaster: await prisma.salesItemMaster.count(),
    CompanyGroup: await prisma.companyGroup.count(),
    TaxPaymentSchedule: await prisma.taxPaymentSchedule.count({ where: { companyId: c } }),
    CreditCard: await prisma.creditCard.count({ where: { companyId: c } }),
    CardStatement: await prisma.cardStatement.count({ where: { card: { companyId: c } } }),
    Loan: await prisma.loanContract.count({ where: { companyId: c } }),
    Lease: await prisma.leaseContract.count({ where: { companyId: c } }),
    CashWithdrawal: await prisma.cashWithdrawalBatch.count({ where: { companyId: c } }),
    Recurring: await prisma.recurringTemplate.count({ where: { companyId: c } }),
    InterGroup: await prisma.transaction.count({ where: { companyId: c, linkedTransactionId: { not: null } } }),
  });

  console.log('\n🎉 Seed completed');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
