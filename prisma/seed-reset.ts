// ============================================================
// DB全リセット＆再投入スクリプト
// seed.ts + seed-testdata.ts を1回で安全に実行する
//
// 実行: npx tsx prisma/seed-reset.ts
// ============================================================

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function resetAll() {
  console.log('🗑️  Deleting all data...');

  // 依存関係の順序で削除（子→親）
  await prisma.cashDenomination.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.evidence.deleteMany();
  await prisma.transactionDetail.deleteMany();
  await prisma.fundTransfer.deleteMany();
  await prisma.transferBatchItem.deleteMany();
  await prisma.transferBatch.deleteMany();
  await prisma.salaryDeduction.deleteMany();
  await prisma.salaryPaymentDetail.deleteMany();
  await prisma.salaryEntry.deleteMany();
  await prisma.loanSchedule.deleteMany();
  await prisma.leaseSchedule.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.cashWithdrawalBatch.deleteMany();
  await prisma.loanContract.deleteMany();
  await prisma.leaseContract.deleteMany();
  await prisma.recurringTemplate.deleteMany();
  await prisma.monthClose.deleteMany();
  await prisma.monthlyBalance.deleteMany();
  await prisma.accountRole.deleteMany();
  await prisma.tradingPartnerSite.deleteMany();
  await prisma.tradingPartnerDefault.deleteMany();
  await prisma.tradingPartnerBankAccount.deleteMany();
  await prisma.tradingPartner.deleteMany();
  await prisma.payrollGroup.deleteMany();
  await prisma.salaryJournalMapping.deleteMany();
  await prisma.deductionCategory.deleteMany();
  await prisma.accountCategorySub.deleteMany();
  await prisma.accountCategoryMid.deleteMany();
  await prisma.accountCategoryMajor.deleteMany();
  await prisma.branchMaster.deleteMany();
  await prisma.bankMaster.deleteMany();
  await prisma.account.deleteMany();
  await prisma.company.deleteMany();
  // UserProfile, User等の認証テーブルはそのまま残す

  console.log('✅ All data deleted');
}

async function seedMaster() {
  console.log('\n🌱 Seeding master data...');

  // 1. 会社マスタ（12社）
  const companies = await Promise.all([
    { name: '起工業', shortName: '起工業', industryType: '建設業', fiscalMonth: 3, displayOrder: 1 },
    { name: '起グループ', shortName: '起グループ', industryType: '建設業', fiscalMonth: 3, displayOrder: 2 },
    { name: '松村建設', shortName: '松村建設', industryType: '建設業', fiscalMonth: 3, displayOrder: 3 },
    { name: '佐藤建設工業', shortName: '佐藤建設', industryType: '建設業', fiscalMonth: 3, displayOrder: 4 },
    { name: '吉川建設', shortName: '吉川建設', industryType: '建設業', fiscalMonth: 3, displayOrder: 5 },
    { name: '建設サポート', shortName: '建設サポート', industryType: '建設業', fiscalMonth: 3, displayOrder: 6 },
    { name: 'エイトグループ', shortName: 'エイトG', industryType: '建設業', fiscalMonth: 3, displayOrder: 7 },
    { name: 'WINNERS', shortName: 'WINNERS', industryType: '広告業', fiscalMonth: 3, displayOrder: 8 },
    { name: 'CAREECH', shortName: 'CAREECH', industryType: '広告業', fiscalMonth: 3, displayOrder: 9 },
    { name: 'WINNERS CLUB', shortName: 'W-CLUB', industryType: 'その他', fiscalMonth: 3, displayOrder: 10 },
    { name: 'G-FARM', shortName: 'G-FARM', industryType: 'その他', fiscalMonth: 3, displayOrder: 11 },
    { name: 'インフィニティグループ', shortName: 'インフィニティ', industryType: 'その他', fiscalMonth: 3, displayOrder: 12 },
  ].map(c => prisma.company.create({ data: c })));
  console.log(`  ${companies.length} companies`);

  // 2. 各社に仮想口座
  for (const company of companies) {
    await prisma.account.createMany({
      data: [
        { companyId: company.id, accountType: 'SOCIAL_INSURANCE_RESERVE', isMain: false, isVirtual: true, isVisible: false, displayOrder: 98 },
        { companyId: company.id, accountType: 'CONSUMPTION_TAX_RESERVE', isMain: false, isVirtual: true, isVisible: false, displayOrder: 99 },
      ],
    });
  }
  console.log('  Virtual accounts for all companies');

  // 3. 起工業メイン口座
  const mainAccount = await prisma.account.create({
    data: {
      companyId: companies[0].id,
      bankName: '千葉銀行', bankCode: '0134', branchName: '松戸支店', branchCode: '201',
      accountNumber: '1234567', accountType: 'ORDINARY', accountHolder: 'ｵｺｼｺｳｷﾞﾖｳ',
      isMain: true, isVirtual: false, isVisible: true, displayOrder: 1,
    },
  });
  await prisma.company.update({ where: { id: companies[0].id }, data: { mainAccountId: mainAccount.id } });
  console.log('  Main account for 起工業');

  // 4. 勘定科目マスタ
  const majors = await Promise.all([
    { name: '売上高', direction: 'INCOME', displayOrder: 1 },
    { name: '売上原価', direction: 'EXPENSE', displayOrder: 2 },
    { name: '販売管理費', direction: 'EXPENSE', displayOrder: 3 },
    { name: '営業外収益', direction: 'INCOME', displayOrder: 4 },
    { name: '営業外費用', direction: 'EXPENSE', displayOrder: 5 },
    { name: 'その他費用', direction: 'EXPENSE', displayOrder: 6 },
  ].map(m => prisma.accountCategoryMajor.create({ data: m })));

  const [売上高, 売上原価, 販管費, 営業外収益, 営業外費用, その他費用] = majors;

  async function createMidWithSubs(majorId: string, midName: string, displayOrder: number, subs: string[] = []) {
    const mid = await prisma.accountCategoryMid.create({ data: { majorId, name: midName, displayOrder } });
    if (subs.length > 0) {
      await prisma.accountCategorySub.createMany({
        data: subs.map((name, i) => ({ midId: mid.id, name, displayOrder: i + 1 })),
      });
    }
    return mid;
  }

  // 販管費
  const 水道光熱費 = await createMidWithSubs(販管費.id, '水道光熱費', 1, ['電気代', 'ガス代', '水道代']);
  const 通信費 = await createMidWithSubs(販管費.id, '通信費', 2, ['携帯電話', 'インターネット/固定電話', 'クラウド/通信サービス', 'その他（通信）']);
  const 地代家賃 = await createMidWithSubs(販管費.id, '地代家賃', 3, ['アパート', '駐車場']);
  const 事務所賃料 = await createMidWithSubs(販管費.id, '事務所賃料', 4);
  const リース料 = await createMidWithSubs(販管費.id, 'リース料', 5, ['車両リース', 'OA機器/その他リース']);
  const 保険料 = await createMidWithSubs(販管費.id, '保険料', 6, ['労災', '自動車保険', '火災保険', '賠償責任', 'その他（保険）']);
  const 支払手数料 = await createMidWithSubs(販管費.id, '支払手数料', 7, ['振込手数料', '引落手数料', 'ネットバンク利用料', '口座維持/手数料', 'その他（手数料）']);
  const 旅費交通費_販管 = await createMidWithSubs(販管費.id, '旅費交通費', 8, ['ETC', 'ガソリン', '宿泊', 'その他（旅費）']);
  const 消耗品費 = await createMidWithSubs(販管費.id, '消耗品費', 9, ['事務用品', '現場消耗品', 'その他（消耗）']);
  const 諸会費 = await createMidWithSubs(販管費.id, '諸会費', 10, ['現場会費', 'その他（会費）']);
  const 広告宣伝費 = await createMidWithSubs(販管費.id, '広告宣伝費', 11, ['Web広告', '求人広告', 'その他（広告）']);
  const 車両費 = await createMidWithSubs(販管費.id, '車両費', 12, ['車検', '整備', 'タイヤ', '税金（車関連）', 'その他（車両）']);
  await createMidWithSubs(販管費.id, '会議費', 13);
  await createMidWithSubs(販管費.id, '交際費', 14);
  await createMidWithSubs(販管費.id, '支払報酬料', 15, ['税理士', '社労士', 'その他（報酬）']);
  const 立替金 = await createMidWithSubs(販管費.id, '立替金', 16);
  await createMidWithSubs(販管費.id, '法定福利費', 17);
  await createMidWithSubs(販管費.id, '福利厚生費', 18);
  await createMidWithSubs(販管費.id, '修繕費', 19);
  const 租税公課 = await createMidWithSubs(販管費.id, '租税公課', 20);
  await createMidWithSubs(販管費.id, '雑費', 21);

  // 売上高
  const 売上 = await createMidWithSubs(売上高.id, '売上', 1);
  await createMidWithSubs(売上高.id, '雑収入', 2);

  // 売上原価
  const 外注費 = await createMidWithSubs(売上原価.id, '外注費', 1);
  await createMidWithSubs(売上原価.id, '材料費', 2);
  await createMidWithSubs(売上原価.id, '労務費', 3);
  const 旅費交通費_原価 = await createMidWithSubs(売上原価.id, '旅費交通費', 4, ['ETC', 'ガソリン', '宿泊', 'その他（旅費）']);
  await createMidWithSubs(売上原価.id, '現場経費', 5);

  // 営業外
  await createMidWithSubs(営業外収益.id, '受取利息', 1);
  await createMidWithSubs(営業外収益.id, '雑収入', 2);
  await createMidWithSubs(営業外費用.id, '支払利息', 1);
  await createMidWithSubs(営業外費用.id, '雑損失', 2);

  // その他費用
  const 社会保険積立 = await createMidWithSubs(その他費用.id, '社会保険積立', 1, ['給与預かり分']);
  const 源泉所得税 = await createMidWithSubs(その他費用.id, '源泉所得税', 2, ['給与預かり分']);
  const 貸金立替金 = await createMidWithSubs(その他費用.id, '貸金/立替金', 3, ['給与預かり分']);
  const 消費税積立 = await createMidWithSubs(その他費用.id, '消費税積立', 4, ['給与預かり分']);

  console.log('  Account categories (major/mid/sub)');

  // 5. 控除カテゴリマスタ
  await prisma.deductionCategory.createMany({
    data: [
      { forType: 'SALES', name: '前倒し入金', midId: 売上.id, hasSubTypes: true, signRule: { occurrence: 1, offset: -1 }, displayOrder: 1 },
      { forType: 'SALES', name: '保留金', midId: 売上.id, hasSubTypes: true, signRule: { occurrence: -1, offset: 1 }, displayOrder: 2 },
      { forType: 'SALES', name: '値引', midId: 売上.id, hasSubTypes: false, displayOrder: 3 },
      { forType: 'SALES', name: '振込手数料', midId: 支払手数料.id, hasSubTypes: false, displayOrder: 4 },
      { forType: 'SALES', name: 'その他控除（売上）', midId: 売上.id, hasSubTypes: false, displayOrder: 5 },
      { forType: 'COST', name: '安全協力会費', midId: 諸会費.id, hasSubTypes: false, displayOrder: 1 },
      { forType: 'COST', name: '振込手数料', midId: 支払手数料.id, hasSubTypes: false, displayOrder: 2 },
      { forType: 'COST', name: '保留金', midId: 外注費.id, hasSubTypes: true, signRule: { occurrence: -1, offset: 1 }, displayOrder: 3 },
      { forType: 'COST', name: '値引/値上', midId: 外注費.id, hasSubTypes: false, displayOrder: 4 },
      { forType: 'COST', name: 'その他控除（原価）', midId: 外注費.id, hasSubTypes: false, displayOrder: 5 },
    ],
  });
  console.log('  Deduction categories');

  // 6. 給与グループ
  const payrollGroups = await Promise.all([
    { companyId: companies[0].id, name: '工事部門', costType: 'COST', displayOrder: 1 },
    { companyId: companies[0].id, name: '営業部門', costType: 'SGA', displayOrder: 2 },
    { companyId: companies[0].id, name: '管理部門', costType: 'SGA', displayOrder: 3 },
  ].map(d => prisma.payrollGroup.create({ data: d })));
  console.log('  Payroll groups');

  // 7. 給与仕訳マッピング
  await prisma.salaryJournalMapping.createMany({
    data: [
      { deductionItemName: '家賃控除', majorId: 販管費.id, midId: 地代家賃.id, classification: 'FIXED' },
      { deductionItemName: '通信費控除', majorId: 販管費.id, midId: 通信費.id, classification: 'VARIABLE' },
      { deductionItemName: '立替経費', majorId: 販管費.id, midId: 立替金.id, classification: 'VARIABLE' },
      { deductionItemName: '印紙/在庫品', majorId: 販管費.id, midId: 消耗品費.id, classification: 'VARIABLE' },
      { deductionItemName: '光熱費控除', majorId: 販管費.id, midId: 水道光熱費.id, classification: 'VARIABLE' },
      { deductionItemName: '保険料控除', majorId: 販管費.id, midId: 保険料.id, classification: 'FIXED' },
      { deductionItemName: '交通費', majorId: 販管費.id, midId: 旅費交通費_販管.id, classification: 'VARIABLE' },
      { deductionItemName: '社会保険料(合算)', majorId: その他費用.id, midId: 社会保険積立.id, classification: 'FIXED' },
      { deductionItemName: '源泉納税(合算)', majorId: その他費用.id, midId: 源泉所得税.id, classification: 'FIXED' },
      { deductionItemName: '貸金/立替金', majorId: その他費用.id, midId: 貸金立替金.id, classification: 'VARIABLE' },
      { deductionItemName: '積立金', majorId: その他費用.id, midId: 消費税積立.id, classification: 'FIXED' },
      { deductionItemName: 'WINNERS立替営業交通費', majorId: 売上原価.id, midId: 旅費交通費_原価.id, classification: 'VARIABLE' },
    ],
  });
  console.log('  Salary journal mappings');

  // 8. 取引先
  const partnerData = [
    { companyId: companies[0].id, name: 'NTT東日本', type: 'VENDOR' as const, tagKey: 'EXPENSE' },
    { companyId: companies[0].id, name: '東京電力', type: 'VENDOR' as const, tagKey: 'EXPENSE' },
    { companyId: companies[0].id, name: '東京ガス', type: 'VENDOR' as const, tagKey: 'EXPENSE' },
    { companyId: companies[0].id, name: '○○建設', type: 'CUSTOMER' as const, tagKey: 'CUSTOMER' },
    { companyId: companies[0].id, name: '△△工務店', type: 'VENDOR' as const, tagKey: 'SUBCONTRACTOR' },
    { companyId: companies[0].id, name: '起グループ', type: 'BOTH' as const, tagKey: 'GROUP_COMPANY' },
    { companyId: companies[0].id, name: '千葉銀行', type: 'VENDOR' as const, tagKey: 'BANK' },
    { companyId: companies[0].id, name: '商工中金', type: 'VENDOR' as const, tagKey: 'BANK' },
    { companyId: companies[0].id, name: 'オリックスリース', type: 'VENDOR' as const, tagKey: 'EXPENSE' },
  ];
  const partners = await Promise.all(partnerData.map(p => prisma.tradingPartner.create({ data: { ...p, isActive: true } })));
  const [ntt, tepco, tokyoGas, customer, subcontractor, groupCompanyPartner, bankPartner, shokokin, leasePartner] = partners;
  console.log(`  ${partners.length} trading partners`);

  // 9. 月次残高
  await prisma.monthlyBalance.createMany({
    data: [
      { companyId: companies[0].id, accountId: mainAccount.id, yearMonth: '2026-03', openingBalance: BigInt(5000000), closingBalance: BigInt(5000000) },
    ],
  });

  // 10. 銀行マスタ
  const bankData = [
    { bankCode: '0001', bankName: 'みずほ銀行', bankNameKana: 'ﾐｽﾞﾎ' },
    { bankCode: '0005', bankName: '三菱UFJ銀行', bankNameKana: 'ﾐﾂﾋﾞｼUFJ' },
    { bankCode: '0009', bankName: '三井住友銀行', bankNameKana: 'ﾐﾂｲｽﾐﾄﾓ' },
    { bankCode: '0010', bankName: 'りそな銀行', bankNameKana: 'ﾘｿﾅ' },
    { bankCode: '0033', bankName: 'PayPay銀行', bankNameKana: 'ﾍﾟｲﾍﾟｲ' },
    { bankCode: '0036', bankName: '楽天銀行', bankNameKana: 'ﾗｸﾃﾝ' },
    { bankCode: '0038', bankName: '住信SBIネット銀行', bankNameKana: 'ｽﾐｼﾝSBI' },
    { bankCode: '0134', bankName: '千葉銀行', bankNameKana: 'ﾁﾊﾞ' },
    { bankCode: '0135', bankName: '千葉興業銀行', bankNameKana: 'ﾁﾊﾞｺｳｷﾞﾖｳ' },
    { bankCode: '0137', bankName: '京葉銀行', bankNameKana: 'ｹｲﾖｳ' },
    { bankCode: '1003', bankName: '商工中金', bankNameKana: 'ｼﾖｳｺｳﾁﾕｳｷﾝ' },
    { bankCode: '2004', bankName: '千葉信用金庫', bankNameKana: 'ﾁﾊﾞｼﾝﾖｳｷﾝｺ' },
  ];
  for (const bank of bankData) {
    await prisma.bankMaster.create({ data: bank });
  }
  await prisma.branchMaster.createMany({
    data: [
      { bankCode: '0134', branchCode: '001', branchName: '本店営業部', branchNameKana: 'ﾎﾝﾃﾝ' },
      { bankCode: '0134', branchCode: '201', branchName: '松戸支店', branchNameKana: 'ﾏﾂﾄﾞ' },
      { bankCode: '0134', branchCode: '202', branchName: '柏支店', branchNameKana: 'ｶｼﾜ' },
      { bankCode: '0134', branchCode: '203', branchName: '船橋支店', branchNameKana: 'ﾌﾅﾊﾞｼ' },
    ],
  });
  console.log('  Banks & branches');

  console.log('✅ Master data complete');

  // Return references for test data
  return {
    companies, mainAccount, payrollGroups,
    ntt, tepco, tokyoGas, customer, subcontractor, groupCompanyPartner, bankPartner, shokokin, leasePartner,
    通信費, 水道光熱費, 地代家賃, 事務所賃料, リース料, 旅費交通費_販管, 支払手数料, 外注費, 租税公課,
    売上, 販管費, その他費用,
  };
}

async function seedTestData(refs: Awaited<ReturnType<typeof seedMaster>>) {
  console.log('\n🧪 Seeding test data...');

  const {
    companies, mainAccount, payrollGroups,
    ntt, tepco, tokyoGas, customer, subcontractor, groupCompanyPartner, bankPartner, shokokin, leasePartner,
    通信費, 水道光熱費, 地代家賃, 事務所賃料, リース料, 旅費交通費_販管, 支払手数料, 外注費, 租税公課,
    売上, 販管費, その他費用,
  } = refs;

  const okoshi = companies[0];
  const okoshiGroup = companies[1];
  const [pgKoji, pgEigyo, pgKanri] = payrollGroups;

  // Reload mid categories with subs
  const mids = await prisma.accountCategoryMid.findMany({ include: { subCategories: true } });
  const findMidFull = (name: string) => {
    const ref = refs[name as keyof typeof refs]
    const refId = typeof ref === "string" ? ref : (ref && typeof ref === "object" && "id" in ref ? (ref as { id: string }).id : undefined)
    return mids.find(m => m.id === refId)
  }
  const リース料Full = mids.find(m => m.id === リース料.id)!;

  // --- サブ口座 ---
  const subAccount = await prisma.account.create({
    data: {
      companyId: okoshi.id,
      bankName: '京葉銀行', bankCode: '0137', branchName: '松戸支店', branchCode: '101',
      accountNumber: '7654321', accountType: 'ORDINARY', accountHolder: 'ｵｺｼｺｳｷﾞﾖｳ',
      isMain: false, isVirtual: false, isVisible: true, displayOrder: 2,
    },
  });

  const okoshiGroupAccount = await prisma.account.create({
    data: {
      companyId: okoshiGroup.id,
      bankName: '千葉銀行', bankCode: '0134', branchName: '柏支店', branchCode: '202',
      accountNumber: '9876543', accountType: 'ORDINARY', accountHolder: 'ｵｺｼｸﾞﾙｰﾌﾟ',
      isMain: true, isVirtual: false, isVisible: true, displayOrder: 1,
    },
  });
  await prisma.company.update({ where: { id: okoshiGroup.id }, data: { mainAccountId: okoshiGroupAccount.id } });

  await prisma.monthlyBalance.createMany({
    data: [
      { companyId: okoshi.id, accountId: subAccount.id, yearMonth: '2026-03', openingBalance: BigInt(2000000), closingBalance: BigInt(2000000) },
      { companyId: okoshi.id, accountId: mainAccount.id, yearMonth: '2026-02', openingBalance: BigInt(4500000), closingBalance: BigInt(5000000) },
      { companyId: okoshi.id, accountId: subAccount.id, yearMonth: '2026-02', openingBalance: BigInt(1800000), closingBalance: BigInt(2000000) },
      { companyId: okoshiGroup.id, accountId: okoshiGroupAccount.id, yearMonth: '2026-03', openingBalance: BigInt(8000000), closingBalance: BigInt(8000000) },
    ],
  });
  console.log('  Sub accounts & balances');

  // --- 取引先詳細 ---
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
  await prisma.tradingPartnerSite.create({
    data: {
      partnerId: ntt.id, siteName: '本社回線', frequency: 'MONTHLY',
      dueDayRule: 'DAY_25', holidayAdjust: 'PREV_BUSINESS',
      amountType: 'FIXED', fixedAmount: BigInt(15000), midId: 通信費.id,
    },
  });
  console.log('  Partner bank accounts, defaults & sites');

  // --- 経費取引（EXPENSE） ---
  const expenseData = [
    { partner: ntt, mid: 通信費, amount: -15000, summary: '3月分 本社回線利用料', status: 'DRAFT', method: 'DIRECT_DEBIT', date: '2026-03-25', order: 1 },
    { partner: tepco, mid: 水道光熱費, amount: -32000, summary: '3月分 電気代', status: 'DRAFT', method: 'DIRECT_DEBIT', date: '2026-03-15', order: 2 },
    { partner: tokyoGas, mid: 水道光熱費, amount: -8500, summary: '3月分 ガス代', status: 'DRAFT', method: 'DIRECT_DEBIT', date: '2026-03-20', order: 3 },
    { partner: null, mid: 旅費交通費_販管, amount: -25000, summary: 'ETC利用 3月分', status: 'READY', method: 'DIRECT_DEBIT', date: '2026-03-31', order: 4 },
    { partner: null, mid: 地代家賃, amount: -120000, summary: '事務所家賃 4月分', status: 'READY', method: 'BANK_TRANSFER', date: '2026-03-27', order: 5 },
    { partner: ntt, mid: 通信費, amount: -15000, summary: '2月分 本社回線利用料', status: 'CONFIRMED', method: 'DIRECT_DEBIT', date: '2026-02-25', order: 1, month: '2026-02' },
    { partner: tepco, mid: 水道光熱費, amount: -28000, summary: '2月分 電気代', status: 'CONFIRMED', method: 'DIRECT_DEBIT', date: '2026-02-15', order: 2, month: '2026-02' },
    { partner: null, mid: 支払手数料, amount: -550, summary: '振込手数料（取消）', status: 'CANCELLED', method: 'BANK_TRANSFER', date: '2026-03-10', order: 10 },
  ];
  for (const e of expenseData) {
    const month = (e as { month?: string }).month || '2026-03';
    await prisma.transaction.create({
      data: {
        companyId: okoshi.id, accountId: mainAccount.id, partnerId: e.partner?.id || null,
        type: 'EXPENSE', status: e.status as 'DRAFT' | 'READY' | 'CONFIRMED' | 'CANCELLED',
        transactionDate: new Date(e.date), accountingMonth: month,
        amount: BigInt(e.amount), paymentMethod: e.method as 'BANK_TRANSFER' | 'DIRECT_DEBIT' | 'CASH_WITHDRAWAL',
        classification: 'FIXED', summary: e.summary, displayOrder: e.order,
        confirmedAt: e.status === 'CONFIRMED' ? new Date('2026-02-28') : null,
        details: {
          create: {
            midId: e.mid.id, amount: BigInt(e.amount),
            classification: 'FIXED', summary: e.summary, displayOrder: 1,
          },
        },
      },
    });
  }
  console.log(`  ${expenseData.length} expense transactions`);

  // --- 売上取引（SALES）親子 ---
  const sales1 = await prisma.transaction.create({
    data: {
      companyId: okoshi.id, accountId: mainAccount.id, partnerId: customer.id,
      type: 'SALES', status: 'CONFIRMED',
      invoiceDate: new Date('2026-01-31'), scheduledDate: new Date('2026-02-28'),
      accountingMonth: '2026-02', amount: BigInt(3000000), invoiceAmount: BigInt(3150000),
      summary: '○○建設 1月分工事代金', displayOrder: 1, confirmedAt: new Date('2026-02-28'),
    },
  });
  await prisma.transaction.create({
    data: {
      companyId: okoshi.id, accountId: mainAccount.id, partnerId: customer.id,
      type: 'SALES', status: 'CONFIRMED', parentId: sales1.id,
      transactionDate: new Date('2026-02-28'), accountingMonth: '2026-02',
      amount: BigInt(2999450), summary: '○○建設 1月分入金（手数料550円差引）',
      displayOrder: 1, confirmedAt: new Date('2026-02-28'),
    },
  });
  await prisma.transaction.create({
    data: {
      companyId: okoshi.id, accountId: mainAccount.id, partnerId: customer.id,
      type: 'SALES', status: 'READY',
      invoiceDate: new Date('2026-02-28'), scheduledDate: new Date('2026-03-31'),
      accountingMonth: '2026-03', amount: BigInt(4500000), invoiceAmount: BigInt(4725000),
      summary: '○○建設 2月分工事代金', displayOrder: 1,
    },
  });
  await prisma.transaction.create({
    data: {
      companyId: okoshi.id, accountId: mainAccount.id, partnerId: customer.id,
      type: 'SALES', status: 'DRAFT',
      invoiceDate: new Date('2026-03-31'), scheduledDate: new Date('2026-04-30'),
      accountingMonth: '2026-03', amount: BigInt(2800000), invoiceAmount: BigInt(2940000),
      summary: '○○建設 3月分工事代金（予定）', displayOrder: 2,
    },
  });
  console.log('  Sales transactions (parent-child)');

  // --- 原価支払（COST_PAYMENT） ---
  for (const c of [
    { status: 'CONFIRMED', amount: -1500000, recorded: 1650000, transfer: 1500000, summary: '△△工務店 1月分外注費', date: '2026-02-25', month: '2026-02' },
    { status: 'READY', amount: -2200000, recorded: 2420000, transfer: 2200000, summary: '△△工務店 2月分外注費', date: '2026-03-25', month: '2026-03' },
    { status: 'DRAFT', amount: -800000, recorded: 880000, transfer: 800000, summary: '△△工務店 3月分外注費（予定）', date: '2026-04-25', month: '2026-03' },
  ]) {
    await prisma.transaction.create({
      data: {
        companyId: okoshi.id, accountId: mainAccount.id, partnerId: subcontractor.id,
        type: 'COST_PAYMENT', status: c.status as 'DRAFT' | 'READY' | 'CONFIRMED',
        transactionDate: new Date(c.date), accountingMonth: c.month,
        amount: BigInt(c.amount), recordedAmount: BigInt(c.recorded), transferAmount: BigInt(c.transfer),
        paymentMethod: 'BANK_TRANSFER', summary: c.summary, displayOrder: 1,
        confirmedAt: c.status === 'CONFIRMED' ? new Date('2026-02-28') : null,
        details: {
          create: { midId: 外注費.id, amount: BigInt(c.amount), classification: 'VARIABLE', summary: c.summary, displayOrder: 1 },
        },
      },
    });
  }
  console.log('  Cost payment transactions');

  // --- 資金移動（TRANSFER） ---
  const transfer1 = await prisma.transaction.create({
    data: {
      companyId: okoshi.id, accountId: mainAccount.id, type: 'TRANSFER', status: 'CONFIRMED',
      transactionDate: new Date('2026-03-05'), accountingMonth: '2026-03',
      amount: BigInt(-500000), summary: '千葉銀行→京葉銀行 資金移動',
      displayOrder: 1, confirmedAt: new Date('2026-03-05'),
    },
  });
  await prisma.fundTransfer.create({
    data: { transactionId: transfer1.id, fromAccountId: mainAccount.id, toAccountId: subAccount.id, transferDate: new Date('2026-03-05'), amount: BigInt(500000) },
  });

  const transfer2 = await prisma.transaction.create({
    data: {
      companyId: okoshi.id, accountId: mainAccount.id, type: 'TRANSFER', status: 'DRAFT',
      transactionDate: new Date('2026-03-15'), accountingMonth: '2026-03',
      amount: BigInt(-1000000), summary: '起グループへ資金移動', displayOrder: 2,
    },
  });
  await prisma.fundTransfer.create({
    data: { transactionId: transfer2.id, fromAccountId: mainAccount.id, toAccountId: okoshiGroupAccount.id, transferDate: new Date('2026-03-15'), amount: BigInt(1000000), counterCompanyId: okoshiGroup.id },
  });
  console.log('  Fund transfers');

  // --- 給与データ ---
  await prisma.salaryEntry.create({
    data: {
      payrollGroupId: pgKoji.id, payMonth: '2026-03', payDate: new Date('2026-03-25'),
      taxablePayment: BigInt(2500000), transportAllowance: BigInt(150000), miscExpenses: BigInt(30000),
      carryoverAdjust: BigInt(0), advanceExpenses: BigInt(50000), totalPayment: BigInt(2730000),
      socialInsuranceReserve: BigInt(375000), consumptionTaxReserve: BigInt(250000),
      totalDeduction: BigInt(480000), netPayment: BigInt(2250000), headcount: 15, status: 'READY',
      deductions: { create: [
        { itemName: '家賃控除', amount: BigInt(180000), displayOrder: 1 },
        { itemName: '通信費控除', amount: BigInt(45000), displayOrder: 2 },
        { itemName: '立替経費', amount: BigInt(80000), displayOrder: 3 },
        { itemName: '社会保険料(合算)', amount: BigInt(120000), displayOrder: 4 },
        { itemName: '源泉納税(合算)', amount: BigInt(55000), displayOrder: 5 },
      ]},
      paymentDetails: { create: [
        { paymentDate: new Date('2026-03-25'), paymentMethod: 'BANK_TRANSFER', accountId: mainAccount.id, amount: BigInt(2100000), displayOrder: 1 },
        { paymentDate: new Date('2026-03-25'), paymentMethod: 'CASH_WITHDRAWAL', accountId: mainAccount.id, amount: BigInt(150000), displayOrder: 2 },
      ]},
    },
  });
  await prisma.salaryEntry.create({
    data: {
      payrollGroupId: pgEigyo.id, payMonth: '2026-03', payDate: new Date('2026-03-25'),
      taxablePayment: BigInt(1200000), transportAllowance: BigInt(80000), miscExpenses: BigInt(0),
      carryoverAdjust: BigInt(0), advanceExpenses: BigInt(20000), totalPayment: BigInt(1300000),
      socialInsuranceReserve: BigInt(180000), consumptionTaxReserve: BigInt(120000),
      totalDeduction: BigInt(210000), netPayment: BigInt(1090000), headcount: 5, status: 'DRAFT',
      deductions: { create: [
        { itemName: '家賃控除', amount: BigInt(80000), displayOrder: 1 },
        { itemName: '社会保険料(合算)', amount: BigInt(85000), displayOrder: 2 },
        { itemName: '源泉納税(合算)', amount: BigInt(45000), displayOrder: 3 },
      ]},
      paymentDetails: { create: [
        { paymentDate: new Date('2026-03-25'), paymentMethod: 'BANK_TRANSFER', accountId: mainAccount.id, amount: BigInt(1090000), displayOrder: 1 },
      ]},
    },
  });
  await prisma.salaryEntry.create({
    data: {
      payrollGroupId: pgKanri.id, payMonth: '2026-02', payDate: new Date('2026-02-25'),
      taxablePayment: BigInt(800000), transportAllowance: BigInt(40000), miscExpenses: BigInt(0),
      carryoverAdjust: BigInt(0), advanceExpenses: BigInt(0), totalPayment: BigInt(840000),
      socialInsuranceReserve: BigInt(120000), consumptionTaxReserve: BigInt(80000),
      totalDeduction: BigInt(150000), netPayment: BigInt(690000), headcount: 3, status: 'CONFIRMED',
      confirmedAt: new Date('2026-02-24'),
      deductions: { create: [
        { itemName: '家賃控除', amount: BigInt(60000), displayOrder: 1 },
        { itemName: '社会保険料(合算)', amount: BigInt(55000), displayOrder: 2 },
        { itemName: '源泉納税(合算)', amount: BigInt(35000), displayOrder: 3 },
      ]},
      paymentDetails: { create: [
        { paymentDate: new Date('2026-02-25'), paymentMethod: 'BANK_TRANSFER', accountId: mainAccount.id, amount: BigInt(690000), displayOrder: 1 },
      ]},
    },
  });
  console.log('  Salary entries (3 groups)');

  // --- 借入契約 ---
  const loan1 = await prisma.loanContract.create({
    data: {
      companyId: okoshi.id, partnerId: bankPartner.id, contractName: '千葉銀行 設備資金',
      principalAmount: BigInt(30000000), executionDate: new Date('2025-04-01'), repaymentStartDate: new Date('2025-05-01'),
      repaymentMethod: 'EQUAL_PRINCIPAL', repaymentFrequency: 'MONTHLY', repaymentDay: 1,
      holidayAdjust: 'NEXT_BUSINESS', totalPayments: 60, completionDate: new Date('2030-04-01'),
      interestType: 'FIXED', interestRate: 1.5, interestTiming: 'ARREAR',
      dayCountBasis: 365, roundingRule: 'ROUND_HALF_UP', principalAdjust: 'LAST',
      remainingBalance: BigInt(24500000), status: 'ACTIVE',
    },
  });
  for (let i = 0; i < 6; i++) {
    const payNum = i + 11;
    const remaining = 30000000 - (500000 * payNum);
    const interest = Math.round(remaining * 0.015 / 12);
    await prisma.loanSchedule.create({
      data: { contractId: loan1.id, paymentNumber: payNum, dueDate: new Date(2026, 2 + i, 1), principalAmount: BigInt(500000), interestAmount: BigInt(interest), totalAmount: BigInt(500000 + interest), remainingBalance: BigInt(remaining), isPaid: i === 0 },
    });
  }

  const loan2 = await prisma.loanContract.create({
    data: {
      companyId: okoshi.id, partnerId: shokokin.id, contractName: '商工中金 運転資金',
      principalAmount: BigInt(10000000), executionDate: new Date('2026-01-15'), repaymentStartDate: new Date('2026-07-15'),
      repaymentMethod: 'GRACE', repaymentFrequency: 'MONTHLY', repaymentDay: 15,
      holidayAdjust: 'PREV_BUSINESS', totalPayments: 36,
      interestType: 'VARIABLE', interestRate: 2.0, interestTiming: 'ARREAR',
      dayCountBasis: 365, roundingRule: 'ROUND_HALF_UP', principalAdjust: 'LAST',
      interestHistory: [{ effectiveDate: '2026-01-15', rate: 2.0 }],
      remainingBalance: BigInt(10000000), status: 'ACTIVE',
    },
  });
  for (let i = 0; i < 6; i++) {
    const interest = Math.round(10000000 * 0.02 / 12);
    await prisma.loanSchedule.create({
      data: { contractId: loan2.id, paymentNumber: i + 1, dueDate: new Date(2026, 1 + i, 15), principalAmount: BigInt(0), interestAmount: BigInt(interest), totalAmount: BigInt(interest), remainingBalance: BigInt(10000000), isPaid: i < 2 },
    });
  }
  console.log('  Loan contracts (2) with schedules');

  // --- リース契約 ---
  const lease1 = await prisma.leaseContract.create({
    data: {
      companyId: okoshi.id, partnerId: leasePartner.id, contractName: '社用車リース（ハイエース）',
      monthlyAmount: BigInt(55000), startDate: new Date('2025-04-01'), endDate: new Date('2030-03-31'),
      totalPayments: 60, paymentDay: 27, holidayAdjust: 'PREV_BUSINESS',
      accountId: mainAccount.id, midId: リース料.id,
      subId: リース料Full.subCategories.find(s => s.name === '車両リース')?.id,
      status: 'ACTIVE',
    },
  });
  for (let i = 0; i < 6; i++) {
    await prisma.leaseSchedule.create({
      data: { contractId: lease1.id, paymentNumber: i + 12, dueDate: new Date(2026, 2 + i, 27), amount: BigInt(55000), isPaid: i === 0 },
    });
  }

  const lease2 = await prisma.leaseContract.create({
    data: {
      companyId: okoshi.id, partnerId: leasePartner.id, contractName: '複合機リース（キヤノン）',
      monthlyAmount: BigInt(18000), startDate: new Date('2025-10-01'), endDate: new Date('2030-09-30'),
      totalPayments: 60, paymentDay: 5, holidayAdjust: 'NEXT_BUSINESS',
      accountId: mainAccount.id, midId: リース料.id,
      subId: リース料Full.subCategories.find(s => s.name === 'OA機器/その他リース')?.id,
      status: 'ACTIVE',
    },
  });
  for (let i = 0; i < 6; i++) {
    await prisma.leaseSchedule.create({
      data: { contractId: lease2.id, paymentNumber: i + 6, dueDate: new Date(2026, 2 + i, 5), amount: BigInt(18000), isPaid: i === 0 },
    });
  }
  console.log('  Lease contracts (2) with schedules');

  // --- 現金引出バッチ ---
  const cashExp1 = await prisma.transaction.create({
    data: { companyId: okoshi.id, accountId: mainAccount.id, type: 'EXPENSE', status: 'DRAFT', transactionDate: new Date('2026-03-10'), accountingMonth: '2026-03', amount: BigInt(-5000), paymentMethod: 'CASH_WITHDRAWAL', summary: '現場消耗品購入', displayOrder: 20 },
  });
  const cashExp2 = await prisma.transaction.create({
    data: { companyId: okoshi.id, accountId: mainAccount.id, type: 'EXPENSE', status: 'DRAFT', transactionDate: new Date('2026-03-10'), accountingMonth: '2026-03', amount: BigInt(-3000), paymentMethod: 'CASH_WITHDRAWAL', summary: '駐車場代', displayOrder: 21 },
  });
  const batch = await prisma.cashWithdrawalBatch.create({
    data: { companyId: okoshi.id, accountId: mainAccount.id, withdrawalDate: new Date('2026-03-10'), totalAmount: BigInt(50000), status: 'DRAFT' },
  });
  await prisma.transaction.updateMany({ where: { id: { in: [cashExp1.id, cashExp2.id] } }, data: { cashWithdrawalBatchId: batch.id } });
  await prisma.cashDenomination.create({
    data: { batchId: batch.id, yen10000: 4, yen5000: 1, yen1000: 5, total: BigInt(50000), purposeLabel: '現場経費' },
  });
  console.log('  Cash withdrawal batch');

  // --- 定期テンプレート ---
  await prisma.recurringTemplate.createMany({
    data: [
      { companyId: okoshi.id, name: 'NTT 本社回線', frequency: 'MONTHLY', dueDayRule: 'DAY_25', holidayAdjust: 'PREV_BUSINESS', transactionType: 'EXPENSE', accountId: mainAccount.id, partnerId: ntt.id, midId: 通信費.id, amountType: 'FIXED', fixedAmount: BigInt(15000), paymentMethod: 'DIRECT_DEBIT', classification: 'FIXED', summary: '本社回線利用料', lastGeneratedMonth: '2026-03' },
      { companyId: okoshi.id, name: '事務所家賃', frequency: 'MONTHLY', dueDayRule: 'DAY_27', holidayAdjust: 'PREV_BUSINESS', transactionType: 'EXPENSE', accountId: mainAccount.id, midId: 事務所賃料.id, amountType: 'FIXED', fixedAmount: BigInt(120000), paymentMethod: 'BANK_TRANSFER', classification: 'FIXED', summary: '事務所賃料', lastGeneratedMonth: '2026-03' },
      { companyId: okoshi.id, name: '車両リース', frequency: 'MONTHLY', dueDayRule: 'DAY_27', holidayAdjust: 'PREV_BUSINESS', transactionType: 'EXPENSE', accountId: mainAccount.id, partnerId: leasePartner.id, midId: リース料.id, amountType: 'FIXED', fixedAmount: BigInt(55000), paymentMethod: 'DIRECT_DEBIT', classification: 'FIXED', summary: 'ハイエース リース料', lastGeneratedMonth: '2026-03' },
      { companyId: okoshi.id, name: '固定資産税', frequency: 'SPECIFIC_MONTHS', specificMonths: [5, 7, 12, 2], dueDayRule: 'MONTH_END', holidayAdjust: 'PREV_BUSINESS', transactionType: 'EXPENSE', accountId: mainAccount.id, midId: 租税公課.id, amountType: 'FIXED', fixedAmount: BigInt(85000), paymentMethod: 'BANK_TRANSFER', classification: 'FIXED', summary: '固定資産税' },
    ],
  });
  console.log('  Recurring templates (4)');

  // --- 月締め ---
  await prisma.monthClose.create({
    data: { companyId: okoshi.id, yearMonth: '2026-02', isClosed: true, closedAt: new Date('2026-03-05'), closedBy: 'system' },
  });
  console.log('  Month close (2026-02)');

  // --- 監査ログ ---
  await prisma.auditLog.createMany({
    data: [
      { tableName: 'transactions', recordId: sales1.id, operation: 'CONFIRM', userId: 'system', timestamp: new Date('2026-02-28'), afterData: { status: 'CONFIRMED' } },
      { tableName: 'month_closes', recordId: okoshi.id, operation: 'MONTH_CLOSE', userId: 'system', timestamp: new Date('2026-03-05'), afterData: { yearMonth: '2026-02', isClosed: true } },
      { tableName: 'transactions', recordId: transfer1.id, operation: 'CREATE', userId: 'system', timestamp: new Date('2026-03-05'), afterData: { type: 'TRANSFER', amount: -500000 } },
    ],
  });
  console.log('  Audit logs');

  // --- 口座ロール ---
  await prisma.accountRole.createMany({
    data: [
      { accountId: mainAccount.id, roleKey: 'SALARY_PAYMENT', roleName: '給与支払口座' },
      { accountId: mainAccount.id, roleKey: 'EXPENSE_PAYMENT', roleName: '経費支払口座' },
      { accountId: mainAccount.id, roleKey: 'INCOME_RECEIPT', roleName: '入金口座' },
      { accountId: subAccount.id, roleKey: 'EXPENSE_PAYMENT', roleName: '経費支払口座' },
    ],
  });
  console.log('  Account roles');

  console.log('✅ Test data complete');
}

async function main() {
  await resetAll();
  const refs = await seedMaster();
  await seedTestData(refs);

  console.log('\n🎉 Full reset + seed completed!');
  console.log('');
  console.log('📊 Summary:');
  console.log('  Companies: 12');
  console.log('  Accounts: 1 main + 1 sub + 1 group + virtual');
  console.log('  Partners: 9 (vendors, customer, banks, lease)');
  console.log('  Expenses: 10 (DRAFT/READY/CONFIRMED/CANCELLED)');
  console.log('  Sales: 3 parents + 1 child');
  console.log('  Cost Payments: 3');
  console.log('  Transfers: 2 (internal + inter-company)');
  console.log('  Salary Entries: 3 (with deductions & payments)');
  console.log('  Loans: 2 contracts + 12 schedules');
  console.log('  Leases: 2 contracts + 12 schedules');
  console.log('  Cash Withdrawal: 1 batch');
  console.log('  Recurring Templates: 4');
  console.log('  Month Close: 1 (2026-02)');
}

main()
  .catch((e) => {
    console.error('❌ Failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
