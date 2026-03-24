// ============================================================
// 仮データ投入スクリプト
// 実行: npx tsx prisma/seed-sample-data.ts
// ============================================================

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Creating sample transaction data...');

  // 起工業を取得
  const company = await prisma.company.findFirst({ where: { shortName: '起工業' } });
  if (!company) throw new Error('起工業 not found');

  // メイン口座
  const mainAccount = await prisma.account.findFirst({
    where: { companyId: company.id, isMain: true, isVirtual: false },
  });
  if (!mainAccount) throw new Error('Main account not found');

  // 2つ目の口座を作成
  const subAccount = await prisma.account.create({
    data: {
      companyId: company.id,
      bankName: '三菱UFJ銀行',
      bankCode: '0005',
      branchName: '東京営業部',
      branchCode: '001',
      accountNumber: '7654321',
      accountType: 'ORDINARY',
      accountHolder: 'ｵｺｼｺｳｷﾞﾖｳ',
      isMain: false,
      isVirtual: false,
      isVisible: true,
      displayOrder: 2,
    },
  });

  // 松村建設にも口座追加
  const matsumura = await prisma.company.findFirst({ where: { shortName: '松村建設' } });
  if (matsumura) {
    await prisma.account.create({
      data: {
        companyId: matsumura.id,
        bankName: '千葉銀行',
        bankCode: '0134',
        branchName: '柏支店',
        branchCode: '202',
        accountNumber: '9876543',
        accountType: 'ORDINARY',
        accountHolder: 'ﾏﾂﾑﾗｹﾝｾﾂ',
        isMain: true,
        isVirtual: false,
        isVisible: true,
        displayOrder: 1,
      },
    });
  }

  // 取引先を取得
  const partners = await prisma.tradingPartner.findMany({
    where: { companyId: company.id },
  });
  const ntt = partners.find(p => p.name === 'NTT東日本');
  const tepco = partners.find(p => p.name === '東京電力');
  const tokyoGas = partners.find(p => p.name === '東京ガス');
  const customer = partners.find(p => p.name === '○○建設');
  const subcontractor = partners.find(p => p.name === '△△工務店');

  // 中項目を取得
  const 通信費 = await prisma.accountCategoryMid.findFirst({ where: { name: '通信費' } });
  const 水道光熱費 = await prisma.accountCategoryMid.findFirst({ where: { name: '水道光熱費' } });
  const 地代家賃 = await prisma.accountCategoryMid.findFirst({ where: { name: '地代家賃' } });
  const リース料 = await prisma.accountCategoryMid.findFirst({ where: { name: 'リース料' } });
  const 保険料 = await prisma.accountCategoryMid.findFirst({ where: { name: '保険料' } });
  const 売上 = await prisma.accountCategoryMid.findFirst({ where: { name: '売上' } });
  const 外注費 = await prisma.accountCategoryMid.findFirst({ where: { name: '外注費' } });
  const 支払利息 = await prisma.accountCategoryMid.findFirst({ where: { name: '支払利息' } });

  // 小項目を取得
  const 携帯電話 = await prisma.accountCategorySub.findFirst({ where: { name: '携帯電話' } });
  const 電気代 = await prisma.accountCategorySub.findFirst({ where: { name: '電気代' } });
  const ガス代 = await prisma.accountCategorySub.findFirst({ where: { name: 'ガス代' } });
  const アパート = await prisma.accountCategorySub.findFirst({ where: { name: 'アパート' } });
  const 車両リース = await prisma.accountCategorySub.findFirst({ where: { name: '車両リース' } });

  // ============================================================
  // 経費取引（2025年10月〜2026年3月の6ヶ月分）
  // ============================================================
  const months = ['2025-10', '2025-11', '2025-12', '2026-01', '2026-02', '2026-03'];

  for (const month of months) {
    const [year, mon] = month.split('-').map(Number);
    const baseDate = new Date(year, mon - 1, 25);

    // 通信費（NTT）
    const t1 = await prisma.transaction.create({
      data: {
        companyId: company.id,
        accountId: mainAccount.id,
        partnerId: ntt?.id,
        type: 'EXPENSE',
        status: month === '2026-03' ? 'DRAFT' : 'CONFIRMED',
        transactionDate: month !== '2026-03' ? baseDate : null,
        scheduledDate: baseDate,
        accountingMonth: month,
        amount: BigInt(-15000 - Math.floor(Math.random() * 5000)),
        paymentMethod: 'DIRECT_DEBIT',
        classification: 'FIXED',
        summary: `${month} 通信費（NTT）`,
        confirmedAt: month !== '2026-03' ? baseDate : null,
      },
    });
    await prisma.transactionDetail.create({
      data: {
        transactionId: t1.id,
        midId: 通信費?.id,
        subId: 携帯電話?.id,
        amount: t1.amount,
        classification: 'FIXED',
        summary: '携帯電話料金',
      },
    });

    // 電気代（東京電力）
    const t2 = await prisma.transaction.create({
      data: {
        companyId: company.id,
        accountId: mainAccount.id,
        partnerId: tepco?.id,
        type: 'EXPENSE',
        status: month === '2026-03' ? 'DRAFT' : 'CONFIRMED',
        transactionDate: month !== '2026-03' ? new Date(year, mon - 1, 20) : null,
        scheduledDate: new Date(year, mon - 1, 20),
        accountingMonth: month,
        amount: BigInt(-35000 - Math.floor(Math.random() * 15000)),
        paymentMethod: 'DIRECT_DEBIT',
        classification: 'VARIABLE',
        summary: `${month} 電気代`,
        confirmedAt: month !== '2026-03' ? new Date(year, mon - 1, 20) : null,
      },
    });
    await prisma.transactionDetail.create({
      data: {
        transactionId: t2.id,
        midId: 水道光熱費?.id,
        subId: 電気代?.id,
        amount: t2.amount,
        classification: 'VARIABLE',
        summary: '電気料金',
      },
    });

    // ガス代（東京ガス）
    const t3 = await prisma.transaction.create({
      data: {
        companyId: company.id,
        accountId: mainAccount.id,
        partnerId: tokyoGas?.id,
        type: 'EXPENSE',
        status: month === '2026-03' ? 'DRAFT' : 'CONFIRMED',
        transactionDate: month !== '2026-03' ? new Date(year, mon - 1, 15) : null,
        scheduledDate: new Date(year, mon - 1, 15),
        accountingMonth: month,
        amount: BigInt(-12000 - Math.floor(Math.random() * 8000)),
        paymentMethod: 'DIRECT_DEBIT',
        classification: 'VARIABLE',
        summary: `${month} ガス代`,
        confirmedAt: month !== '2026-03' ? new Date(year, mon - 1, 15) : null,
      },
    });
    await prisma.transactionDetail.create({
      data: {
        transactionId: t3.id,
        midId: 水道光熱費?.id,
        subId: ガス代?.id,
        amount: t3.amount,
        classification: 'VARIABLE',
        summary: 'ガス料金',
      },
    });

    // 家賃
    const t4 = await prisma.transaction.create({
      data: {
        companyId: company.id,
        accountId: mainAccount.id,
        type: 'EXPENSE',
        status: month === '2026-03' ? 'READY' : 'CONFIRMED',
        transactionDate: month !== '2026-03' ? new Date(year, mon - 1, 27) : null,
        scheduledDate: new Date(year, mon - 1, 27),
        accountingMonth: month,
        amount: BigInt(-150000),
        paymentMethod: 'BANK_TRANSFER',
        classification: 'FIXED',
        summary: `${month} 事務所家賃`,
        confirmedAt: month !== '2026-03' ? new Date(year, mon - 1, 27) : null,
      },
    });
    await prisma.transactionDetail.create({
      data: {
        transactionId: t4.id,
        midId: 地代家賃?.id,
        subId: アパート?.id,
        amount: t4.amount,
        classification: 'FIXED',
        summary: '松戸事務所',
      },
    });

    // リース料（車両）
    const t5 = await prisma.transaction.create({
      data: {
        companyId: company.id,
        accountId: mainAccount.id,
        type: 'EXPENSE',
        status: month === '2026-03' ? 'DRAFT' : 'CONFIRMED',
        transactionDate: month !== '2026-03' ? new Date(year, mon - 1, 27) : null,
        scheduledDate: new Date(year, mon - 1, 27),
        accountingMonth: month,
        amount: BigInt(-55000),
        paymentMethod: 'DIRECT_DEBIT',
        classification: 'FIXED',
        summary: `${month} 車両リース`,
        confirmedAt: month !== '2026-03' ? new Date(year, mon - 1, 27) : null,
      },
    });
    await prisma.transactionDetail.create({
      data: {
        transactionId: t5.id,
        midId: リース料?.id,
        subId: 車両リース?.id,
        amount: t5.amount,
        classification: 'FIXED',
        summary: 'ハイエース リース',
      },
    });

    // 保険料
    const t6 = await prisma.transaction.create({
      data: {
        companyId: company.id,
        accountId: mainAccount.id,
        type: 'EXPENSE',
        status: month === '2026-03' ? 'DRAFT' : 'CONFIRMED',
        transactionDate: month !== '2026-03' ? new Date(year, mon - 1, 10) : null,
        scheduledDate: new Date(year, mon - 1, 10),
        accountingMonth: month,
        amount: BigInt(-28000),
        paymentMethod: 'DIRECT_DEBIT',
        classification: 'FIXED',
        summary: `${month} 自動車保険`,
        confirmedAt: month !== '2026-03' ? new Date(year, mon - 1, 10) : null,
      },
    });
    await prisma.transactionDetail.create({
      data: {
        transactionId: t6.id,
        midId: 保険料?.id,
        amount: t6.amount,
        classification: 'FIXED',
        summary: '自動車保険',
      },
    });
  }
  console.log('✅ 経費取引（6ヶ月×6件 = 36件）作成');

  // ============================================================
  // 売上取引（月1〜2件）
  // ============================================================
  for (const month of months) {
    const [year, mon] = month.split('-').map(Number);

    // メイン売上
    const s1 = await prisma.transaction.create({
      data: {
        companyId: company.id,
        accountId: mainAccount.id,
        partnerId: customer?.id,
        type: 'SALES',
        status: month === '2026-03' ? 'DRAFT' : 'CONFIRMED',
        transactionDate: month !== '2026-03' ? new Date(year, mon - 1, 末日(year, mon)) : null,
        scheduledDate: new Date(year, mon - 1, 末日(year, mon)),
        accountingMonth: month,
        amount: BigInt(3000000 + Math.floor(Math.random() * 2000000)),
        invoiceDate: new Date(year, mon - 1, 末日(year, mon)),
        invoiceAmount: BigInt(3500000),
        paymentMethod: 'BANK_TRANSFER',
        summary: `${month} ○○建設 工事代金`,
        confirmedAt: month !== '2026-03' ? new Date(year, mon - 1, 末日(year, mon)) : null,
      },
    });
    await prisma.transactionDetail.create({
      data: {
        transactionId: s1.id,
        midId: 売上?.id,
        amount: s1.amount,
        summary: '工事代金',
      },
    });
  }
  console.log('✅ 売上取引（6件）作成');

  // ============================================================
  // 原価支払（外注費）
  // ============================================================
  for (const month of months) {
    const [year, mon] = month.split('-').map(Number);

    const c1 = await prisma.transaction.create({
      data: {
        companyId: company.id,
        accountId: mainAccount.id,
        partnerId: subcontractor?.id,
        type: 'COST_PAYMENT',
        status: month === '2026-03' ? 'DRAFT' : 'CONFIRMED',
        transactionDate: month !== '2026-03' ? new Date(year, mon - 1, 末日(year, mon)) : null,
        scheduledDate: new Date(year, mon - 1, 末日(year, mon)),
        accountingMonth: month,
        amount: BigInt(-800000 - Math.floor(Math.random() * 400000)),
        paymentMethod: 'BANK_TRANSFER',
        classification: 'VARIABLE',
        summary: `${month} △△工務店 外注費`,
        confirmedAt: month !== '2026-03' ? new Date(year, mon - 1, 末日(year, mon)) : null,
      },
    });
    await prisma.transactionDetail.create({
      data: {
        transactionId: c1.id,
        midId: 外注費?.id,
        amount: c1.amount,
        classification: 'VARIABLE',
        summary: '外注工事費',
      },
    });
  }
  console.log('✅ 原価支払取引（6件）作成');

  // ============================================================
  // 資金移動（月1回）
  // ============================================================
  for (const month of months.slice(0, 3)) {
    const [year, mon] = month.split('-').map(Number);

    const ft = await prisma.transaction.create({
      data: {
        companyId: company.id,
        accountId: mainAccount.id,
        type: 'TRANSFER',
        status: 'CONFIRMED',
        transactionDate: new Date(year, mon - 1, 5),
        accountingMonth: month,
        amount: BigInt(-500000),
        summary: `${month} 口座間資金移動`,
        confirmedAt: new Date(year, mon - 1, 5),
      },
    });

    await prisma.fundTransfer.create({
      data: {
        transactionId: ft.id,
        fromAccountId: mainAccount.id,
        toAccountId: subAccount.id,
        transferDate: new Date(year, mon - 1, 5),
        amount: BigInt(500000),
      },
    });
  }
  console.log('✅ 資金移動（3件）作成');

  // ============================================================
  // 月次残高（6ヶ月分）
  // ============================================================
  let balance = BigInt(5000000);
  for (const month of months) {
    // 月の取引合計を簡易計算
    const transactions = await prisma.transaction.findMany({
      where: { companyId: company.id, accountId: mainAccount.id, accountingMonth: month },
    });
    const monthTotal = transactions.reduce((sum, t) => sum + t.amount, BigInt(0));
    const closing = balance + monthTotal;

    await prisma.monthlyBalance.upsert({
      where: { accountId_yearMonth: { accountId: mainAccount.id, yearMonth: month } },
      update: { openingBalance: balance, closingBalance: closing },
      create: {
        companyId: company.id,
        accountId: mainAccount.id,
        yearMonth: month,
        openingBalance: balance,
        closingBalance: closing,
      },
    });
    balance = closing;
  }
  console.log('✅ 月次残高（6ヶ月分）更新');

  // ============================================================
  // 月締め（過去5ヶ月は締め済み）
  // ============================================================
  for (const month of months.slice(0, 5)) {
    await prisma.monthClose.create({
      data: {
        companyId: company.id,
        yearMonth: month,
        isClosed: true,
        closedAt: new Date(),
        closedBy: 'seed',
      },
    });
  }
  console.log('✅ 月締め（5ヶ月分）作成');

  // ============================================================
  // 借入契約
  // ============================================================
  const loan = await prisma.loanContract.create({
    data: {
      companyId: company.id,
      contractName: '設備資金借入（千葉銀行）',
      principalAmount: BigInt(30000000),
      executionDate: new Date(2025, 3, 1),
      repaymentStartDate: new Date(2025, 4, 1),
      repaymentMethod: 'EQUAL_PRINCIPAL',
      repaymentFrequency: 'MONTHLY',
      repaymentDay: 25,
      totalPayments: 60,
      interestType: 'FIXED',
      interestRate: 1.5,
      interestTiming: 'ARREAR',
      remainingBalance: BigInt(24500000),
      status: 'ACTIVE',
    },
  });

  // 返済スケジュール（12回分）
  let loanBalance = BigInt(30000000);
  const monthlyPrincipal = BigInt(500000);
  for (let i = 1; i <= 12; i++) {
    const interest = BigInt(Math.floor(Number(loanBalance) * 0.015 / 12));
    loanBalance -= monthlyPrincipal;
    await prisma.loanSchedule.create({
      data: {
        contractId: loan.id,
        paymentNumber: i,
        dueDate: new Date(2025, 3 + i, 25),
        principalAmount: monthlyPrincipal,
        interestAmount: interest,
        totalAmount: monthlyPrincipal + interest,
        remainingBalance: loanBalance,
        isPaid: i <= 10,
      },
    });
  }
  console.log('✅ 借入契約＋返済スケジュール（12回）作成');

  // ============================================================
  // リース契約
  // ============================================================
  const lease = await prisma.leaseContract.create({
    data: {
      companyId: company.id,
      contractName: 'ハイエース リース',
      monthlyAmount: BigInt(55000),
      startDate: new Date(2025, 0, 1),
      endDate: new Date(2029, 11, 31),
      totalPayments: 60,
      paymentDay: 27,
      accountId: mainAccount.id,
      midId: リース料?.id,
      subId: 車両リース?.id,
      status: 'ACTIVE',
    },
  });

  for (let i = 1; i <= 12; i++) {
    await prisma.leaseSchedule.create({
      data: {
        contractId: lease.id,
        paymentNumber: i,
        dueDate: new Date(2025, i - 1, 27),
        amount: BigInt(55000),
        isPaid: i <= 10,
      },
    });
  }
  console.log('✅ リース契約＋支払スケジュール（12回）作成');

  // ============================================================
  // 定期支払テンプレート
  // ============================================================
  await prisma.recurringTemplate.createMany({
    data: [
      {
        companyId: company.id,
        name: '事務所家賃',
        frequency: 'MONTHLY',
        dueDayRule: 'DAY_27',
        transactionType: 'EXPENSE',
        accountId: mainAccount.id,
        midId: 地代家賃?.id,
        subId: アパート?.id,
        amountType: 'FIXED',
        fixedAmount: BigInt(150000),
        paymentMethod: 'BANK_TRANSFER',
        classification: 'FIXED',
        summary: '松戸事務所 家賃',
        isActive: true,
      },
      {
        companyId: company.id,
        name: '車両リース',
        frequency: 'MONTHLY',
        dueDayRule: 'DAY_27',
        transactionType: 'EXPENSE',
        accountId: mainAccount.id,
        midId: リース料?.id,
        subId: 車両リース?.id,
        amountType: 'FIXED',
        fixedAmount: BigInt(55000),
        paymentMethod: 'DIRECT_DEBIT',
        classification: 'FIXED',
        summary: 'ハイエース リース料',
        isActive: true,
      },
      {
        companyId: company.id,
        name: '自動車保険',
        frequency: 'MONTHLY',
        dueDayRule: 'DAY_10',
        transactionType: 'EXPENSE',
        accountId: mainAccount.id,
        midId: 保険料?.id,
        amountType: 'FIXED',
        fixedAmount: BigInt(28000),
        paymentMethod: 'DIRECT_DEBIT',
        classification: 'FIXED',
        summary: '自動車保険料',
        isActive: true,
      },
    ],
  });
  console.log('✅ 定期支払テンプレート（3件）作成');

  // ============================================================
  // 給与データ（3ヶ月分）
  // ============================================================
  const payrollGroups = await prisma.payrollGroup.findMany({
    where: { companyId: company.id },
  });
  const koujiGroup = payrollGroups.find(g => g.name === '工事部門');

  if (koujiGroup) {
    for (const month of ['2026-01', '2026-02', '2026-03']) {
      const [year, mon] = month.split('-').map(Number);
      const entry = await prisma.salaryEntry.create({
        data: {
          payrollGroupId: koujiGroup.id,
          payMonth: month,
          payDate: new Date(year, mon - 1, 25),
          taxablePayment: BigInt(2800000),
          transportAllowance: BigInt(120000),
          miscExpenses: BigInt(50000),
          totalPayment: BigInt(2970000),
          socialInsuranceReserve: BigInt(420000),
          consumptionTaxReserve: BigInt(280000),
          totalDeduction: BigInt(350000),
          netPayment: BigInt(2620000),
          headcount: 8,
          status: month === '2026-03' ? 'DRAFT' : 'CONFIRMED',
          confirmedAt: month !== '2026-03' ? new Date(year, mon - 1, 25) : null,
        },
      });

      // 控除明細
      await prisma.salaryDeduction.createMany({
        data: [
          { salaryEntryId: entry.id, itemName: '家賃控除', amount: BigInt(200000), displayOrder: 1 },
          { salaryEntryId: entry.id, itemName: '通信費控除', amount: BigInt(80000), displayOrder: 2 },
          { salaryEntryId: entry.id, itemName: '立替経費', amount: BigInt(70000), displayOrder: 3 },
        ],
      });

      // 支払内訳
      await prisma.salaryPaymentDetail.create({
        data: {
          salaryEntryId: entry.id,
          paymentDate: new Date(year, mon - 1, 25),
          paymentMethod: 'BANK_TRANSFER',
          accountId: mainAccount.id,
          amount: BigInt(2620000),
        },
      });
    }
  }
  console.log('✅ 給与データ（3ヶ月分）作成');

  console.log('\n🎉 Sample data creation completed!');
}

// ヘルパー: 月末日
function 末日(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

main()
  .catch((e) => {
    console.error('❌ Failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
