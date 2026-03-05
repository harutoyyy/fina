// ============================================================
// 経理くん（fina） テストデータ投入スクリプト
// 既存のマスタデータ（seed.ts）が投入済みの前提で、
// 業務データ（取引・給与・借入・リース等）を一括投入する
//
// 実行: npx tsx prisma/seed-testdata.ts
// ============================================================

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🧪 Inserting test data...');

  // ============================================================
  // 0. 既存マスタデータの取得
  // ============================================================
  const companies = await prisma.company.findMany({ orderBy: { displayOrder: 'asc' } });
  if (companies.length === 0) throw new Error('会社マスタが空です。先にseed.tsを実行してください');

  const okoshi = companies[0]; // 起工業
  const okoshiGroup = companies[1]; // 起グループ

  const accounts = await prisma.account.findMany({ where: { companyId: okoshi.id } });
  const mainAccount = accounts.find(a => a.isMain && !a.isVirtual);
  if (!mainAccount) throw new Error('起工業のメイン口座が見つかりません');

  const virtualSI = accounts.find(a => a.accountType === 'SOCIAL_INSURANCE_RESERVE');
  const virtualCT = accounts.find(a => a.accountType === 'CONSUMPTION_TAX_RESERVE');

  const partners = await prisma.tradingPartner.findMany({ where: { companyId: okoshi.id } });
  const ntt = partners.find(p => p.name === 'NTT東日本')!;
  const tepco = partners.find(p => p.name === '東京電力')!;
  const tokyoGas = partners.find(p => p.name === '東京ガス')!;
  const customer = partners.find(p => p.name === '○○建設')!;
  const subcontractor = partners.find(p => p.name === '△△工務店')!;
  const groupCompany = partners.find(p => p.name === '起グループ')!;

  const mids = await prisma.accountCategoryMid.findMany({ include: { major: true, subCategories: true } });
  const findMid = (name: string) => mids.find(m => m.name === name)!;

  const 通信費 = findMid('通信費');
  const 水道光熱費 = findMid('水道光熱費');
  const 地代家賃 = findMid('地代家賃');
  const リース料 = findMid('リース料');
  const 旅費交通費 = mids.find(m => m.name === '旅費交通費' && m.major.name === '販売管理費')!;
  const 支払手数料 = findMid('支払手数料');
  const 外注費 = findMid('外注費');
  const 売上 = mids.find(m => m.name === '売上' && m.major.name === '売上高')!;
  const 支払利息 = findMid('支払利息');
  const 事務所賃料 = findMid('事務所賃料');

  const payrollGroups = await prisma.payrollGroup.findMany({ where: { companyId: okoshi.id } });
  const pgKoji = payrollGroups.find(g => g.name === '工事部門')!;
  const pgEigyo = payrollGroups.find(g => g.name === '営業部門')!;
  const pgKanri = payrollGroups.find(g => g.name === '管理部門')!;

  console.log('✅ Existing master data loaded');

  // ============================================================
  // 1. 起工業にサブ口座を追加
  // ============================================================
  const subAccount = await prisma.account.create({
    data: {
      companyId: okoshi.id,
      bankName: '京葉銀行',
      bankCode: '0137',
      branchName: '松戸支店',
      branchCode: '101',
      accountNumber: '7654321',
      accountType: 'ORDINARY',
      accountHolder: 'ｵｺｼｺｳｷﾞﾖｳ',
      isMain: false,
      isVirtual: false,
      isVisible: true,
      displayOrder: 2,
    },
  });

  // 起グループにもメイン口座を作成
  const okoshiGroupAccount = await prisma.account.create({
    data: {
      companyId: okoshiGroup.id,
      bankName: '千葉銀行',
      bankCode: '0134',
      branchName: '柏支店',
      branchCode: '202',
      accountNumber: '9876543',
      accountType: 'ORDINARY',
      accountHolder: 'ｵｺｼｸﾞﾙｰﾌﾟ',
      isMain: true,
      isVirtual: false,
      isVisible: true,
      displayOrder: 1,
    },
  });
  await prisma.company.update({
    where: { id: okoshiGroup.id },
    data: { mainAccountId: okoshiGroupAccount.id },
  });

  // 月次残高（サブ口座・前月分も）
  await prisma.monthlyBalance.createMany({
    skipDuplicates: true,
    data: [
      { companyId: okoshi.id, accountId: subAccount.id, yearMonth: '2026-03', openingBalance: BigInt(2000000), closingBalance: BigInt(2000000) },
      { companyId: okoshi.id, accountId: mainAccount.id, yearMonth: '2026-02', openingBalance: BigInt(4500000), closingBalance: BigInt(5000000) },
      { companyId: okoshi.id, accountId: subAccount.id, yearMonth: '2026-02', openingBalance: BigInt(1800000), closingBalance: BigInt(2000000) },
      { companyId: okoshiGroup.id, accountId: okoshiGroupAccount.id, yearMonth: '2026-03', openingBalance: BigInt(8000000), closingBalance: BigInt(8000000) },
    ],
  });

  console.log('✅ Sub accounts & monthly balances created');

  // ============================================================
  // 2. 取引先の銀行口座・デフォルト科目
  // ============================================================
  await prisma.tradingPartnerBankAccount.createMany({
    data: [
      { partnerId: ntt.id, bankCode: '0001', branchCode: '001', accountType: 'ORDINARY', accountNumber: '1111111', accountHolder: 'ｴﾇﾃｨﾃｨﾋｶﾞｼﾆﾎﾝ' },
      { partnerId: subcontractor.id, bankCode: '0134', branchCode: '201', accountType: 'ORDINARY', accountNumber: '2222222', accountHolder: 'ｻﾝｶｸｺｳﾑﾃﾝ' },
      { partnerId: customer.id, bankCode: '0009', branchCode: '001', accountType: 'ORDINARY', accountNumber: '3333333', accountHolder: 'ﾏﾙﾏﾙｹﾝｾﾂ' },
    ],
  });

  await prisma.tradingPartnerDefault.createMany({
    data: [
      { partnerId: ntt.id, midId: 通信費.id },
      { partnerId: tepco.id, midId: 水道光熱費.id },
      { partnerId: tokyoGas.id, midId: 水道光熱費.id },
      { partnerId: subcontractor.id, midId: 外注費.id },
    ],
  });

  // 取引先サイト（定期支払テンプレ）
  await prisma.tradingPartnerSite.create({
    data: {
      partnerId: ntt.id,
      siteName: '本社回線',
      frequency: 'MONTHLY',
      dueDayRule: 'DAY_25',
      holidayAdjust: 'PREV_BUSINESS',
      amountType: 'FIXED',
      fixedAmount: BigInt(15000),
      midId: 通信費.id,
    },
  });

  console.log('✅ Trading partner bank accounts & defaults created');

  // ============================================================
  // 3. 経費取引（EXPENSE）各ステータス
  // ============================================================
  const expenseData = [
    // DRAFT: 未確定の経費
    { partner: ntt, mid: 通信費, amount: -15000, summary: '3月分 本社回線利用料', status: 'DRAFT', method: 'DIRECT_DEBIT', date: '2026-03-25', order: 1 },
    { partner: tepco, mid: 水道光熱費, amount: -32000, summary: '3月分 電気代', status: 'DRAFT', method: 'DIRECT_DEBIT', date: '2026-03-15', order: 2 },
    { partner: tokyoGas, mid: 水道光熱費, amount: -8500, summary: '3月分 ガス代', status: 'DRAFT', method: 'DIRECT_DEBIT', date: '2026-03-20', order: 3 },
    // READY: 確認待ち
    { partner: null, mid: 旅費交通費, amount: -25000, summary: 'ETC利用 3月分', status: 'READY', method: 'DIRECT_DEBIT', date: '2026-03-31', order: 4 },
    { partner: null, mid: 地代家賃, amount: -120000, summary: '事務所家賃 4月分', status: 'READY', method: 'BANK_TRANSFER', date: '2026-03-27', order: 5 },
    // CONFIRMED: 確定済み
    { partner: ntt, mid: 通信費, amount: -15000, summary: '2月分 本社回線利用料', status: 'CONFIRMED', method: 'DIRECT_DEBIT', date: '2026-02-25', order: 1, month: '2026-02' },
    { partner: tepco, mid: 水道光熱費, amount: -28000, summary: '2月分 電気代', status: 'CONFIRMED', method: 'DIRECT_DEBIT', date: '2026-02-15', order: 2, month: '2026-02' },
    // CANCELLED
    { partner: null, mid: 支払手数料, amount: -550, summary: '振込手数料（取消）', status: 'CANCELLED', method: 'BANK_TRANSFER', date: '2026-03-10', order: 10 },
  ];

  for (const e of expenseData) {
    const month = (e as { month?: string }).month || '2026-03';
    await prisma.transaction.create({
      data: {
        companyId: okoshi.id,
        accountId: mainAccount.id,
        partnerId: e.partner?.id || null,
        type: 'EXPENSE',
        status: e.status as 'DRAFT' | 'READY' | 'CONFIRMED' | 'CANCELLED',
        transactionDate: e.date ? new Date(e.date) : null,
        accountingMonth: month,
        amount: BigInt(e.amount),
        paymentMethod: e.method as 'BANK_TRANSFER' | 'DIRECT_DEBIT' | 'CASH_WITHDRAWAL',
        classification: 'FIXED',
        summary: e.summary,
        displayOrder: e.order,
        confirmedAt: e.status === 'CONFIRMED' ? new Date('2026-02-28') : null,
        details: {
          create: {
            midId: e.mid.id,
            subId: e.mid.subCategories[0]?.id || null,
            amount: BigInt(e.amount),
            classification: 'FIXED',
            summary: e.summary,
            displayOrder: 1,
          },
        },
      },
    });
  }
  console.log(`✅ ${expenseData.length} expense transactions created`);

  // ============================================================
  // 4. 売上取引（SALES）親子構造
  // ============================================================

  // 売上1: 確定済み（2月分・入金済み）
  const sales1 = await prisma.transaction.create({
    data: {
      companyId: okoshi.id,
      accountId: mainAccount.id,
      partnerId: customer.id,
      type: 'SALES',
      status: 'CONFIRMED',
      invoiceDate: new Date('2026-01-31'),
      scheduledDate: new Date('2026-02-28'),
      accountingMonth: '2026-02',
      amount: BigInt(3000000),
      invoiceAmount: BigInt(3150000),
      summary: '○○建設 1月分工事代金',
      displayOrder: 1,
      confirmedAt: new Date('2026-02-28'),
    },
  });
  // 入金明細（振込手数料控除あり）
  await prisma.transaction.create({
    data: {
      companyId: okoshi.id,
      accountId: mainAccount.id,
      partnerId: customer.id,
      type: 'SALES',
      status: 'CONFIRMED',
      parentId: sales1.id,
      transactionDate: new Date('2026-02-28'),
      accountingMonth: '2026-02',
      amount: BigInt(2999450),
      summary: '○○建設 1月分入金（手数料550円差引）',
      displayOrder: 1,
      confirmedAt: new Date('2026-02-28'),
    },
  });

  // 売上2: 準備完了（3月分・入金待ち）
  const sales2 = await prisma.transaction.create({
    data: {
      companyId: okoshi.id,
      accountId: mainAccount.id,
      partnerId: customer.id,
      type: 'SALES',
      status: 'READY',
      invoiceDate: new Date('2026-02-28'),
      scheduledDate: new Date('2026-03-31'),
      accountingMonth: '2026-03',
      amount: BigInt(4500000),
      invoiceAmount: BigInt(4725000),
      summary: '○○建設 2月分工事代金',
      displayOrder: 1,
    },
  });

  // 売上3: 下書き（3月分）
  await prisma.transaction.create({
    data: {
      companyId: okoshi.id,
      accountId: mainAccount.id,
      partnerId: customer.id,
      type: 'SALES',
      status: 'DRAFT',
      invoiceDate: new Date('2026-03-31'),
      scheduledDate: new Date('2026-04-30'),
      accountingMonth: '2026-03',
      amount: BigInt(2800000),
      invoiceAmount: BigInt(2940000),
      summary: '○○建設 3月分工事代金（予定）',
      displayOrder: 2,
    },
  });

  console.log('✅ Sales transactions with parent-child structure created');

  // ============================================================
  // 5. 原価支払取引（COST_PAYMENT）
  // ============================================================
  const costData = [
    { status: 'CONFIRMED', amount: -1500000, recorded: 1650000, transfer: 1500000, summary: '△△工務店 1月分外注費', date: '2026-02-25', month: '2026-02' },
    { status: 'READY', amount: -2200000, recorded: 2420000, transfer: 2200000, summary: '△△工務店 2月分外注費', date: '2026-03-25', month: '2026-03' },
    { status: 'DRAFT', amount: -800000, recorded: 880000, transfer: 800000, summary: '△△工務店 3月分外注費（予定）', date: '2026-04-25', month: '2026-03' },
  ];
  for (const c of costData) {
    await prisma.transaction.create({
      data: {
        companyId: okoshi.id,
        accountId: mainAccount.id,
        partnerId: subcontractor.id,
        type: 'COST_PAYMENT',
        status: c.status as 'DRAFT' | 'READY' | 'CONFIRMED',
        transactionDate: c.date ? new Date(c.date) : null,
        accountingMonth: c.month,
        amount: BigInt(c.amount),
        recordedAmount: BigInt(c.recorded),
        transferAmount: BigInt(c.transfer),
        paymentMethod: 'BANK_TRANSFER',
        summary: c.summary,
        displayOrder: 1,
        confirmedAt: c.status === 'CONFIRMED' ? new Date('2026-02-28') : null,
        details: {
          create: {
            midId: 外注費.id,
            amount: BigInt(c.amount),
            classification: 'VARIABLE',
            summary: c.summary,
            displayOrder: 1,
          },
        },
      },
    });
  }
  console.log('✅ Cost payment transactions created');

  // ============================================================
  // 6. 資金移動（TRANSFER）
  // ============================================================
  // 口座間振替
  const transfer1 = await prisma.transaction.create({
    data: {
      companyId: okoshi.id,
      accountId: mainAccount.id,
      type: 'TRANSFER',
      status: 'CONFIRMED',
      transactionDate: new Date('2026-03-05'),
      accountingMonth: '2026-03',
      amount: BigInt(-500000),
      summary: '千葉銀行→京葉銀行 資金移動',
      displayOrder: 1,
      confirmedAt: new Date('2026-03-05'),
    },
  });
  await prisma.fundTransfer.create({
    data: {
      transactionId: transfer1.id,
      fromAccountId: mainAccount.id,
      toAccountId: subAccount.id,
      transferDate: new Date('2026-03-05'),
      amount: BigInt(500000),
    },
  });

  // 会社間資金移動
  const transfer2 = await prisma.transaction.create({
    data: {
      companyId: okoshi.id,
      accountId: mainAccount.id,
      type: 'TRANSFER',
      status: 'DRAFT',
      transactionDate: new Date('2026-03-15'),
      accountingMonth: '2026-03',
      amount: BigInt(-1000000),
      summary: '起グループへ資金移動',
      displayOrder: 2,
    },
  });
  await prisma.fundTransfer.create({
    data: {
      transactionId: transfer2.id,
      fromAccountId: mainAccount.id,
      toAccountId: okoshiGroupAccount.id,
      transferDate: new Date('2026-03-15'),
      amount: BigInt(1000000),
      counterCompanyId: okoshiGroup.id,
    },
  });

  console.log('✅ Fund transfer transactions created');

  // ============================================================
  // 7. 給与データ（SalaryEntry + 控除 + 支払内訳）
  // ============================================================

  // 工事部門 3月分
  const salary1 = await prisma.salaryEntry.create({
    data: {
      payrollGroupId: pgKoji.id,
      payMonth: '2026-03',
      payDate: new Date('2026-03-25'),
      taxablePayment: BigInt(2500000),
      transportAllowance: BigInt(150000),
      miscExpenses: BigInt(30000),
      carryoverAdjust: BigInt(0),
      advanceExpenses: BigInt(50000),
      totalPayment: BigInt(2730000),
      socialInsuranceReserve: BigInt(375000),
      consumptionTaxReserve: BigInt(250000),
      totalDeduction: BigInt(480000),
      netPayment: BigInt(2250000),
      headcount: 15,
      status: 'READY',
      deductions: {
        create: [
          { itemName: '家賃控除', amount: BigInt(180000), displayOrder: 1 },
          { itemName: '通信費控除', amount: BigInt(45000), displayOrder: 2 },
          { itemName: '立替経費', amount: BigInt(80000), displayOrder: 3 },
          { itemName: '社会保険料(合算)', amount: BigInt(120000), displayOrder: 4 },
          { itemName: '源泉納税(合算)', amount: BigInt(55000), displayOrder: 5 },
        ],
      },
      paymentDetails: {
        create: [
          { paymentDate: new Date('2026-03-25'), paymentMethod: 'BANK_TRANSFER', accountId: mainAccount.id, amount: BigInt(2100000), displayOrder: 1 },
          { paymentDate: new Date('2026-03-25'), paymentMethod: 'CASH_WITHDRAWAL', accountId: mainAccount.id, amount: BigInt(150000), displayOrder: 2 },
        ],
      },
    },
  });

  // 営業部門 3月分
  const salary2 = await prisma.salaryEntry.create({
    data: {
      payrollGroupId: pgEigyo.id,
      payMonth: '2026-03',
      payDate: new Date('2026-03-25'),
      taxablePayment: BigInt(1200000),
      transportAllowance: BigInt(80000),
      miscExpenses: BigInt(0),
      carryoverAdjust: BigInt(0),
      advanceExpenses: BigInt(20000),
      totalPayment: BigInt(1300000),
      socialInsuranceReserve: BigInt(180000),
      consumptionTaxReserve: BigInt(120000),
      totalDeduction: BigInt(210000),
      netPayment: BigInt(1090000),
      headcount: 5,
      status: 'DRAFT',
      deductions: {
        create: [
          { itemName: '家賃控除', amount: BigInt(80000), displayOrder: 1 },
          { itemName: '社会保険料(合算)', amount: BigInt(85000), displayOrder: 2 },
          { itemName: '源泉納税(合算)', amount: BigInt(45000), displayOrder: 3 },
        ],
      },
      paymentDetails: {
        create: [
          { paymentDate: new Date('2026-03-25'), paymentMethod: 'BANK_TRANSFER', accountId: mainAccount.id, amount: BigInt(1090000), displayOrder: 1 },
        ],
      },
    },
  });

  // 管理部門 2月分（確定済み）
  const salary3 = await prisma.salaryEntry.create({
    data: {
      payrollGroupId: pgKanri.id,
      payMonth: '2026-02',
      payDate: new Date('2026-02-25'),
      taxablePayment: BigInt(800000),
      transportAllowance: BigInt(40000),
      miscExpenses: BigInt(0),
      carryoverAdjust: BigInt(0),
      advanceExpenses: BigInt(0),
      totalPayment: BigInt(840000),
      socialInsuranceReserve: BigInt(120000),
      consumptionTaxReserve: BigInt(80000),
      totalDeduction: BigInt(150000),
      netPayment: BigInt(690000),
      headcount: 3,
      status: 'CONFIRMED',
      confirmedAt: new Date('2026-02-24'),
      deductions: {
        create: [
          { itemName: '家賃控除', amount: BigInt(60000), displayOrder: 1 },
          { itemName: '社会保険料(合算)', amount: BigInt(55000), displayOrder: 2 },
          { itemName: '源泉納税(合算)', amount: BigInt(35000), displayOrder: 3 },
        ],
      },
      paymentDetails: {
        create: [
          { paymentDate: new Date('2026-02-25'), paymentMethod: 'BANK_TRANSFER', accountId: mainAccount.id, amount: BigInt(690000), displayOrder: 1 },
        ],
      },
    },
  });

  console.log('✅ Salary entries with deductions & payment details created');

  // ============================================================
  // 8. 借入契約（LoanContract + スケジュール）
  // ============================================================

  // 追加取引先: 銀行
  const bankPartner = await prisma.tradingPartner.create({
    data: {
      companyId: okoshi.id,
      name: '千葉銀行',
      type: 'VENDOR',
      tagKey: 'BANK',
      isActive: true,
    },
  });

  const shokokin = await prisma.tradingPartner.create({
    data: {
      companyId: okoshi.id,
      name: '商工中金',
      type: 'VENDOR',
      tagKey: 'BANK',
      isActive: true,
    },
  });

  // 借入1: 千葉銀行 元金均等 月次返済
  const loan1 = await prisma.loanContract.create({
    data: {
      companyId: okoshi.id,
      partnerId: bankPartner.id,
      contractName: '千葉銀行 設備資金',
      principalAmount: BigInt(30000000),
      executionDate: new Date('2025-04-01'),
      repaymentStartDate: new Date('2025-05-01'),
      repaymentMethod: 'EQUAL_PRINCIPAL',
      repaymentFrequency: 'MONTHLY',
      repaymentDay: 1,
      holidayAdjust: 'NEXT_BUSINESS',
      totalPayments: 60,
      completionDate: new Date('2030-04-01'),
      interestType: 'FIXED',
      interestRate: 1.5,
      interestTiming: 'ARREAR',
      dayCountBasis: 365,
      roundingRule: 'ROUND_HALF_UP',
      principalAdjust: 'LAST',
      remainingBalance: BigInt(24500000),
      status: 'ACTIVE',
    },
  });

  // スケジュール生成（直近6回分）
  const monthlyPrincipal1 = 500000; // 3000万÷60
  for (let i = 0; i < 6; i++) {
    const payNum = i + 11; // 2026年3月は11回目
    const dueDate = new Date(2026, 2 + i, 1); // 3月〜8月
    const remaining = 30000000 - (500000 * payNum);
    const interest = Math.round(remaining * 0.015 / 12);
    await prisma.loanSchedule.create({
      data: {
        contractId: loan1.id,
        paymentNumber: payNum,
        dueDate,
        principalAmount: BigInt(monthlyPrincipal1),
        interestAmount: BigInt(interest),
        totalAmount: BigInt(monthlyPrincipal1 + interest),
        remainingBalance: BigInt(remaining),
        isPaid: i === 0, // 3月分は支払済み
      },
    });
  }

  // 借入2: 商工中金 据置期間あり
  const loan2 = await prisma.loanContract.create({
    data: {
      companyId: okoshi.id,
      partnerId: shokokin.id,
      contractName: '商工中金 運転資金',
      principalAmount: BigInt(10000000),
      executionDate: new Date('2026-01-15'),
      repaymentStartDate: new Date('2026-07-15'),
      repaymentMethod: 'GRACE',
      repaymentFrequency: 'MONTHLY',
      repaymentDay: 15,
      holidayAdjust: 'PREV_BUSINESS',
      totalPayments: 36,
      interestType: 'VARIABLE',
      interestRate: 2.0,
      interestTiming: 'ARREAR',
      dayCountBasis: 365,
      roundingRule: 'ROUND_HALF_UP',
      principalAdjust: 'LAST',
      interestHistory: [
        { effectiveDate: '2026-01-15', rate: 2.0 },
      ],
      remainingBalance: BigInt(10000000),
      status: 'ACTIVE',
    },
  });

  // 据置期間中は利息のみ
  for (let i = 0; i < 6; i++) {
    const dueDate = new Date(2026, 1 + i, 15);
    const interest = Math.round(10000000 * 0.02 / 12);
    await prisma.loanSchedule.create({
      data: {
        contractId: loan2.id,
        paymentNumber: i + 1,
        dueDate,
        principalAmount: BigInt(0),
        interestAmount: BigInt(interest),
        totalAmount: BigInt(interest),
        remainingBalance: BigInt(10000000),
        isPaid: i < 2, // 2月・3月分は支払済み
      },
    });
  }

  console.log('✅ Loan contracts with schedules created');

  // ============================================================
  // 9. リース契約（LeaseContract + スケジュール）
  // ============================================================

  // リース取引先
  const leasePartner = await prisma.tradingPartner.create({
    data: {
      companyId: okoshi.id,
      name: 'オリックスリース',
      type: 'VENDOR',
      tagKey: 'EXPENSE',
      isActive: true,
    },
  });

  // 車両リース
  const lease1 = await prisma.leaseContract.create({
    data: {
      companyId: okoshi.id,
      partnerId: leasePartner.id,
      contractName: '社用車リース（ハイエース）',
      monthlyAmount: BigInt(55000),
      startDate: new Date('2025-04-01'),
      endDate: new Date('2030-03-31'),
      totalPayments: 60,
      paymentDay: 27,
      holidayAdjust: 'PREV_BUSINESS',
      accountId: mainAccount.id,
      midId: リース料.id,
      subId: リース料.subCategories.find(s => s.name === '車両リース')?.id,
      status: 'ACTIVE',
    },
  });

  for (let i = 0; i < 6; i++) {
    const dueDate = new Date(2026, 2 + i, 27);
    await prisma.leaseSchedule.create({
      data: {
        contractId: lease1.id,
        paymentNumber: i + 12, // 2026年3月は12回目
        dueDate,
        amount: BigInt(55000),
        isPaid: i === 0, // 3月分は支払済み
      },
    });
  }

  // OA機器リース
  const lease2 = await prisma.leaseContract.create({
    data: {
      companyId: okoshi.id,
      partnerId: leasePartner.id,
      contractName: '複合機リース（キヤノン）',
      monthlyAmount: BigInt(18000),
      startDate: new Date('2025-10-01'),
      endDate: new Date('2030-09-30'),
      totalPayments: 60,
      paymentDay: 5,
      holidayAdjust: 'NEXT_BUSINESS',
      accountId: mainAccount.id,
      midId: リース料.id,
      subId: リース料.subCategories.find(s => s.name === 'OA機器/その他リース')?.id,
      status: 'ACTIVE',
    },
  });

  for (let i = 0; i < 6; i++) {
    const dueDate = new Date(2026, 2 + i, 5);
    await prisma.leaseSchedule.create({
      data: {
        contractId: lease2.id,
        paymentNumber: i + 6,
        dueDate,
        amount: BigInt(18000),
        isPaid: i === 0,
      },
    });
  }

  console.log('✅ Lease contracts with schedules created');

  // ============================================================
  // 10. 現金引出バッチ
  // ============================================================

  // 現金払い経費を先に作成
  const cashExpense1 = await prisma.transaction.create({
    data: {
      companyId: okoshi.id,
      accountId: mainAccount.id,
      type: 'EXPENSE',
      status: 'DRAFT',
      transactionDate: new Date('2026-03-10'),
      accountingMonth: '2026-03',
      amount: BigInt(-5000),
      paymentMethod: 'CASH_WITHDRAWAL',
      summary: '現場消耗品購入',
      displayOrder: 20,
    },
  });

  const cashExpense2 = await prisma.transaction.create({
    data: {
      companyId: okoshi.id,
      accountId: mainAccount.id,
      type: 'EXPENSE',
      status: 'DRAFT',
      transactionDate: new Date('2026-03-10'),
      accountingMonth: '2026-03',
      amount: BigInt(-3000),
      paymentMethod: 'CASH_WITHDRAWAL',
      summary: '駐車場代',
      displayOrder: 21,
    },
  });

  const batch = await prisma.cashWithdrawalBatch.create({
    data: {
      companyId: okoshi.id,
      accountId: mainAccount.id,
      withdrawalDate: new Date('2026-03-10'),
      totalAmount: BigInt(50000),
      status: 'DRAFT',
    },
  });

  // リンク
  await prisma.transaction.updateMany({
    where: { id: { in: [cashExpense1.id, cashExpense2.id] } },
    data: { cashWithdrawalBatchId: batch.id },
  });

  // 金種表
  await prisma.cashDenomination.create({
    data: {
      batchId: batch.id,
      yen10000: 4,
      yen5000: 1,
      yen1000: 5,
      total: BigInt(50000),
      purposeLabel: '現場経費',
    },
  });

  console.log('✅ Cash withdrawal batch with denominations created');

  // ============================================================
  // 11. 定期支払テンプレート（RecurringTemplate）
  // ============================================================
  await prisma.recurringTemplate.createMany({
    data: [
      {
        companyId: okoshi.id,
        name: 'NTT 本社回線',
        frequency: 'MONTHLY',
        dueDayRule: 'DAY_25',
        holidayAdjust: 'PREV_BUSINESS',
        transactionType: 'EXPENSE',
        accountId: mainAccount.id,
        partnerId: ntt.id,
        midId: 通信費.id,
        amountType: 'FIXED',
        fixedAmount: BigInt(15000),
        paymentMethod: 'DIRECT_DEBIT',
        classification: 'FIXED',
        summary: '本社回線利用料',
        lastGeneratedMonth: '2026-03',
      },
      {
        companyId: okoshi.id,
        name: '事務所家賃',
        frequency: 'MONTHLY',
        dueDayRule: 'DAY_27',
        holidayAdjust: 'PREV_BUSINESS',
        transactionType: 'EXPENSE',
        accountId: mainAccount.id,
        midId: 事務所賃料.id,
        amountType: 'FIXED',
        fixedAmount: BigInt(120000),
        paymentMethod: 'BANK_TRANSFER',
        classification: 'FIXED',
        summary: '事務所賃料',
        lastGeneratedMonth: '2026-03',
      },
      {
        companyId: okoshi.id,
        name: '車両リース',
        frequency: 'MONTHLY',
        dueDayRule: 'DAY_27',
        holidayAdjust: 'PREV_BUSINESS',
        transactionType: 'EXPENSE',
        accountId: mainAccount.id,
        partnerId: leasePartner.id,
        midId: リース料.id,
        subId: リース料.subCategories.find(s => s.name === '車両リース')?.id,
        amountType: 'FIXED',
        fixedAmount: BigInt(55000),
        paymentMethod: 'DIRECT_DEBIT',
        classification: 'FIXED',
        summary: 'ハイエース リース料',
        lastGeneratedMonth: '2026-03',
      },
      {
        companyId: okoshi.id,
        name: '固定資産税',
        frequency: 'SPECIFIC_MONTHS',
        specificMonths: [5, 7, 12, 2],
        dueDayRule: 'MONTH_END',
        holidayAdjust: 'PREV_BUSINESS',
        transactionType: 'EXPENSE',
        accountId: mainAccount.id,
        midId: mids.find(m => m.name === '租税公課')!.id,
        amountType: 'FIXED',
        fixedAmount: BigInt(85000),
        paymentMethod: 'BANK_TRANSFER',
        classification: 'FIXED',
        summary: '固定資産税',
      },
    ],
  });

  console.log('✅ Recurring templates created');

  // ============================================================
  // 12. 月締め（2月分を締め済み）
  // ============================================================
  await prisma.monthClose.create({
    data: {
      companyId: okoshi.id,
      yearMonth: '2026-02',
      isClosed: true,
      closedAt: new Date('2026-03-05'),
      closedBy: 'system',
    },
  });

  console.log('✅ Month close for 2026-02 created');

  // ============================================================
  // 13. 監査ログ（サンプル）
  // ============================================================
  await prisma.auditLog.createMany({
    data: [
      {
        tableName: 'transactions',
        recordId: sales1.id,
        operation: 'CONFIRM',
        userId: 'system',
        timestamp: new Date('2026-02-28'),
        afterData: { status: 'CONFIRMED' },
        reason: null,
      },
      {
        tableName: 'month_closes',
        recordId: okoshi.id,
        operation: 'MONTH_CLOSE',
        userId: 'system',
        timestamp: new Date('2026-03-05'),
        afterData: { yearMonth: '2026-02', isClosed: true },
        reason: null,
      },
      {
        tableName: 'transactions',
        recordId: transfer1.id,
        operation: 'CREATE',
        userId: 'system',
        timestamp: new Date('2026-03-05'),
        afterData: { type: 'TRANSFER', amount: -500000 },
        reason: null,
      },
    ],
  });

  console.log('✅ Audit logs created');

  // ============================================================
  // 14. 口座ロール
  // ============================================================
  await prisma.accountRole.createMany({
    data: [
      { accountId: mainAccount.id, roleKey: 'SALARY_PAYMENT', roleName: '給与支払口座' },
      { accountId: mainAccount.id, roleKey: 'EXPENSE_PAYMENT', roleName: '経費支払口座' },
      { accountId: mainAccount.id, roleKey: 'INCOME_RECEIPT', roleName: '入金口座' },
      { accountId: subAccount.id, roleKey: 'EXPENSE_PAYMENT', roleName: '経費支払口座' },
    ],
  });

  console.log('✅ Account roles created');

  // ============================================================
  // Summary
  // ============================================================
  console.log('\n🎉 All test data inserted successfully!');
  console.log('');
  console.log('📊 Data summary:');
  console.log('  - Accounts: +2 (sub account + group company account)');
  console.log('  - Monthly Balances: +4 (multiple months & accounts)');
  console.log('  - Trading Partner Bank Accounts: 3');
  console.log('  - Trading Partner Defaults: 4');
  console.log('  - Trading Partner Sites: 1');
  console.log('  - Expense Transactions: 8 (DRAFT/READY/CONFIRMED/CANCELLED)');
  console.log('  - Sales Transactions: 3 parents + 1 child (with invoice/payment)');
  console.log('  - Cost Payment Transactions: 3');
  console.log('  - Transfer Transactions: 2 (internal + inter-company)');
  console.log('  - Fund Transfers: 2');
  console.log('  - Salary Entries: 3 (with deductions & payment details)');
  console.log('  - Loan Contracts: 2 (with 12 schedules)');
  console.log('  - Lease Contracts: 2 (with 12 schedules)');
  console.log('  - Cash Withdrawal Batch: 1 (with denominations)');
  console.log('  - Recurring Templates: 4');
  console.log('  - Month Close: 1 (2026-02)');
  console.log('  - Audit Logs: 3');
  console.log('  - Account Roles: 4');
  console.log('  - New Trading Partners: 3 (bank partners + lease)');
}

main()
  .catch((e) => {
    console.error('❌ Test data insertion failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
