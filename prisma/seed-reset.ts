// ============================================================
// DB全リセット＆再投入スクリプト
// seed.ts + seed-testdata.ts を1回で安全に実行する
//
// 実行: npx tsx prisma/seed-reset.ts
// ============================================================

import { PrismaClient } from '@prisma/client';
import { seedAllCompanyMasters, seedAllCompanyTransactions } from './seed-all-companies';

const prisma = new PrismaClient();

async function resetAll() {
  console.log('🗑️  Deleting all data...');

  // 依存関係の順序で削除（子→親）
  await prisma.cashDenomination.deleteMany();
  await prisma.temporaryBankAccount.deleteMany();
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
    売上, 販管費, その他費用, 車両費, 消耗品費,
  };
}

async function seedTestData(refs: Awaited<ReturnType<typeof seedMaster>>) {
  console.log('\n🧪 Seeding test data...');

  const {
    companies, mainAccount, payrollGroups,
    ntt, tepco, tokyoGas, customer, subcontractor, groupCompanyPartner, bankPartner, shokokin, leasePartner,
    通信費, 水道光熱費, 地代家賃, 事務所賃料, リース料, 旅費交通費_販管, 支払手数料, 外注費, 租税公課,
    売上, 販管費, その他費用, 車両費, 消耗品費,
  } = refs;

  const okoshi = companies[0];
  const okoshiGroup = companies[1];
  const [pgKoji, pgEigyo, pgKanri] = payrollGroups;

  // Reload mid categories with subs
  const mids = await prisma.accountCategoryMid.findMany({ include: { subCategories: true } });
  const findMidFull = (name: string) => mids.find(m => m.id === refs[name as keyof typeof refs])
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

  // --- 臨時経費（TEMPORARY）大量データ ---
  const tempExpenseData = [
    { partner: null, tempVendor: '山田商店', mid: 消耗品費, amount: -45000, summary: '事務用品一式購入', status: 'DRAFT', method: 'BANK_TRANSFER', date: '2026-03-08', received: '2026-03-08', hasEvidence: true },
    { partner: null, tempVendor: '佐々木設備', mid: null, amount: -180000, summary: '現場仮設電気工事', status: 'DRAFT', method: 'BANK_TRANSFER', date: '2026-03-12', received: '2026-03-12', hasEvidence: true },
    { partner: null, tempVendor: null, mid: 旅費交通費_販管, amount: -35000, summary: '現場視察 高速代・宿泊', status: 'DRAFT', method: 'BANK_TRANSFER', date: '2026-03-15', received: null, hasEvidence: false, evidenceNotRequired: true },
    { partner: null, tempVendor: '鈴木鉄工所', mid: null, amount: -520000, summary: '鉄骨加工費', status: 'READY', method: 'BANK_TRANSFER', date: '2026-03-20', received: '2026-03-19', hasEvidence: true },
    { partner: ntt, tempVendor: null, mid: 通信費, amount: -8800, summary: '追加回線工事費（臨時）', status: 'DRAFT', method: 'BANK_TRANSFER', date: '2026-03-22', received: '2026-03-22', hasEvidence: true },
    { partner: null, tempVendor: '田中塗装', mid: null, amount: -350000, summary: '外壁塗装費', status: 'DRAFT', method: 'BANK_TRANSFER', date: '2026-03-25', received: '2026-03-24', hasEvidence: true },
    { partner: null, tempVendor: '中村重機', mid: null, amount: -280000, summary: 'クレーン作業費', status: 'DRAFT', method: 'BANK_TRANSFER', date: '2026-04-05', received: null, hasEvidence: false },
    { partner: null, tempVendor: '高橋建材', mid: null, amount: -165000, summary: '型枠材料費', status: 'DRAFT', method: 'BANK_TRANSFER', date: '2026-04-10', received: '2026-04-09', hasEvidence: true },
    { partner: null, tempVendor: null, mid: 消耗品費, amount: -12500, summary: 'ヘルメット・安全帯購入', status: 'READY', method: 'CASH_WITHDRAWAL', date: '2026-03-18', received: '2026-03-18', hasEvidence: true },
    { partner: null, tempVendor: '松本電機', mid: null, amount: -95000, summary: '分電盤取付工事', status: 'DRAFT', method: 'BANK_TRANSFER', date: '2026-04-15', received: null, hasEvidence: false },
    { partner: tepco, tempVendor: null, mid: 水道光熱費, amount: -7200, summary: '現場仮設電力 追加請求', status: 'DRAFT', method: 'DIRECT_DEBIT', date: '2026-03-28', received: '2026-03-28', hasEvidence: true },
    { partner: null, tempVendor: '伊藤測量', mid: null, amount: -75000, summary: '境界測量費', status: 'DRAFT', method: 'BANK_TRANSFER', date: '2026-04-08', received: null, hasEvidence: false },
    { partner: null, tempVendor: '渡辺設計事務所', mid: null, amount: -430000, summary: '構造計算書作成', status: 'DRAFT', method: 'BANK_TRANSFER', date: '2026-04-12', received: '2026-04-11', hasEvidence: true },
    { partner: null, tempVendor: null, mid: 車両費, amount: -55000, summary: '社用車タイヤ交換', status: 'READY', method: 'CASH_WITHDRAWAL', date: '2026-03-20', received: '2026-03-20', hasEvidence: true, evidenceNotRequired: false },
    { partner: null, tempVendor: '小林清掃', mid: null, amount: -35000, summary: '現場清掃費', status: 'DRAFT', method: 'BANK_TRANSFER', date: '2026-04-03', received: null, hasEvidence: false },
  ];

  for (let i = 0; i < tempExpenseData.length; i++) {
    const e = tempExpenseData[i];
    const month = e.date.startsWith('2026-04') ? '2026-04' : '2026-03';
    const tx = await prisma.transaction.create({
      data: {
        companyId: okoshi.id, accountId: mainAccount.id,
        partnerId: e.partner?.id || null,
        temporaryVendorName: e.tempVendor || null,
        type: 'EXPENSE', status: e.status as 'DRAFT' | 'READY',
        scheduledDate: new Date(e.date), accountingMonth: month,
        amount: BigInt(e.amount),
        paymentMethod: e.method as 'BANK_TRANSFER' | 'DIRECT_DEBIT' | 'CASH_WITHDRAWAL',
        classification: 'TEMPORARY', summary: e.summary, displayOrder: 30 + i,
        hasEvidence: e.hasEvidence || false,
        evidenceNotRequired: (e as { evidenceNotRequired?: boolean }).evidenceNotRequired || false,
        receivedDate: e.received ? new Date(e.received) : null,
        readyAt: e.status === 'READY' ? new Date(e.date) : null,
      },
    });

    // 仮取引先名がある場合、一部に仮口座も作成
    if (e.tempVendor && i % 3 === 0) {
      await prisma.temporaryBankAccount.create({
        data: {
          transactionId: tx.id,
          bankCode: '0134', bankName: '千葉銀行',
          branchCode: '201', branchName: '松戸支店',
          accountType: 'ORDINARY',
          accountNumber: String(4000000 + i),
          accountHolder: `ｶﾘ${e.tempVendor.slice(0, 3)}`,
        },
      });
    }
  }
  console.log(`  ${tempExpenseData.length} temporary expenses (with temp vendors & bank accounts)`);

  // --- isDateException のある経費 ---
  await prisma.transaction.create({
    data: {
      companyId: okoshi.id, accountId: mainAccount.id, partnerId: ntt.id,
      type: 'EXPENSE', status: 'DRAFT',
      scheduledDate: new Date('2026-04-28'), accountingMonth: '2026-04',
      amount: BigInt(-15000), paymentMethod: 'DIRECT_DEBIT',
      classification: 'FIXED', summary: '4月分 本社回線利用料（支払日変更）',
      isDateException: true, displayOrder: 50,
      details: { create: { midId: 通信費.id, amount: BigInt(-15000), classification: 'FIXED', summary: '本社回線利用料', displayOrder: 1 } },
    },
  });
  console.log('  isDateException example');

  // --- 月次残高（全期間） ---
  const balanceMonths: { ym: string; main: [number, number]; sub: [number, number] }[] = [
    { ym: '2025-04', main: [3200000, 3800000], sub: [1500000, 1600000] },
    { ym: '2025-05', main: [3800000, 4100000], sub: [1600000, 1700000] },
    { ym: '2025-06', main: [4100000, 3900000], sub: [1700000, 1650000] },
    { ym: '2025-07', main: [3900000, 4300000], sub: [1650000, 1800000] },
    { ym: '2025-08', main: [4300000, 4000000], sub: [1800000, 1750000] },
    { ym: '2025-09', main: [4000000, 4500000], sub: [1750000, 1900000] },
    { ym: '2025-10', main: [4500000, 4200000], sub: [1900000, 1850000] },
    { ym: '2025-11', main: [4200000, 4600000], sub: [1850000, 2000000] },
    { ym: '2025-12', main: [4600000, 4400000], sub: [2000000, 1950000] },
    { ym: '2026-01', main: [4400000, 4500000], sub: [1950000, 1800000] },
  ];
  const balRows = balanceMonths.flatMap(b => [
    { companyId: okoshi.id, accountId: mainAccount.id, yearMonth: b.ym, openingBalance: BigInt(b.main[0]), closingBalance: BigInt(b.main[1]) },
    { companyId: okoshi.id, accountId: subAccount.id, yearMonth: b.ym, openingBalance: BigInt(b.sub[0]), closingBalance: BigInt(b.sub[1]) },
  ]);
  await prisma.monthlyBalance.createMany({ data: balRows });
  console.log(`  Monthly balances: ${balanceMonths.length} months × 2 accounts`);

  // --- 月締め（過去月） ---
  const closedMonths = ['2025-04','2025-05','2025-06','2025-07','2025-08','2025-09','2025-10','2025-11','2025-12','2026-01'];
  await prisma.monthClose.createMany({
    data: closedMonths.map(ym => ({
      companyId: okoshi.id, yearMonth: ym, isClosed: true,
      closedAt: new Date(`${ym}-01`), closedBy: 'system',
    })),
    skipDuplicates: true,
  });
  console.log(`  Month closes: ${closedMonths.length} months`);

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

  // ============================================================
  // 起工業 大量データ生成（10倍化）
  // 2025-04〜2026-04 の13ヶ月 × 多種経費・売上・原価・給与・振替
  // ============================================================
  console.log('\n📊 Generating 10x data for 起工業...');

  // 擬似乱数（再現可能）
  function srand(seed: number): number {
    const x = Math.sin(seed * 9301 + 49297) * 233280;
    return x - Math.floor(x);
  }
  function vary(base: number, seed: number, range = 0.3): number {
    return Math.round(base * (1 - range + srand(seed) * range * 2) / 100) * 100;
  }
  function lastDay(y: number, m: number): number { return new Date(y, m, 0).getDate(); }

  const bulkMonths: string[] = [];
  for (let y = 2025; y <= 2026; y++) {
    const maxM = y === 2025 ? 12 : 4;
    for (let m = 1; m <= maxM; m++) bulkMonths.push(`${y}-${String(m).padStart(2, '0')}`);
  }

  // 経費テンプレート（10種の異なる経費）
  const expTemplates = [
    { partner: ntt, mid: 通信費, base: 15000, summary: '本社回線利用料', method: 'DIRECT_DEBIT' as const, cls: 'FIXED' },
    { partner: tepco, mid: 水道光熱費, base: 35000, summary: '電気代', method: 'DIRECT_DEBIT' as const, cls: 'VARIABLE' },
    { partner: tokyoGas, mid: 水道光熱費, base: 12000, summary: 'ガス代', method: 'DIRECT_DEBIT' as const, cls: 'VARIABLE' },
    { partner: null, mid: 地代家賃, base: 120000, summary: '事務所家賃', method: 'BANK_TRANSFER' as const, cls: 'FIXED' },
    { partner: null, mid: 旅費交通費_販管, base: 28000, summary: 'ETC利用', method: 'DIRECT_DEBIT' as const, cls: 'VARIABLE' },
    { partner: leasePartner, mid: リース料, base: 55000, summary: '車両リース料', method: 'DIRECT_DEBIT' as const, cls: 'FIXED' },
    { partner: null, mid: 支払手数料, base: 5500, summary: '振込手数料', method: 'BANK_TRANSFER' as const, cls: 'VARIABLE' },
    { partner: null, mid: 水道光熱費, base: 8000, summary: '水道代', method: 'DIRECT_DEBIT' as const, cls: 'VARIABLE' },
    { partner: leasePartner, mid: リース料, base: 18000, summary: '複合機リース', method: 'DIRECT_DEBIT' as const, cls: 'FIXED' },
    { partner: null, mid: 旅費交通費_販管, base: 45000, summary: '出張旅費', method: 'BANK_TRANSFER' as const, cls: 'VARIABLE' },
  ];

  // 原価取引先ローテーション用
  const costPartners = [subcontractor, groupCompanyPartner];
  const costSummaries = [
    '外注費（現場A）', '外注費（現場B）', '材料費', '重機リース', '仮設材',
  ];

  // 売上取引先ローテーション用
  const salesSummaries = [
    '工事代金', '追加工事', '設計変更分', '竣工精算',
  ];

  let bulkExpCount = 0;
  let bulkSalesCount = 0;
  let bulkCostCount = 0;
  let bulkSalaryCount = 0;
  let bulkTransferCount = 0;

  for (let mIdx = 0; mIdx < bulkMonths.length; mIdx++) {
    const month = bulkMonths[mIdx];
    const [yr, mn] = month.split('-').map(Number);
    const isRecent = mIdx >= bulkMonths.length - 2; // 直近2ヶ月
    const isDraft = mIdx >= bulkMonths.length - 1;   // 最新月

    // --- 経費：10件/月 ---
    for (let eIdx = 0; eIdx < expTemplates.length; eIdx++) {
      const t = expTemplates[eIdx];
      const seed = mIdx * 100 + eIdx;
      const amt = vary(t.base, seed);
      const day = 5 + Math.floor(srand(seed + 7) * 23);
      const txDate = new Date(yr, mn - 1, Math.min(day, lastDay(yr, mn)));
      const status = isDraft ? 'DRAFT' : (isRecent && eIdx < 3 ? 'READY' : 'CONFIRMED');

      await prisma.transaction.create({
        data: {
          companyId: okoshi.id, accountId: mainAccount.id,
          partnerId: t.partner?.id || null,
          type: 'EXPENSE', status: status as 'DRAFT' | 'READY' | 'CONFIRMED',
          transactionDate: txDate, scheduledDate: txDate, accountingMonth: month,
          amount: BigInt(-amt), actualAmount: status === 'CONFIRMED' ? BigInt(-amt) : null,
          paymentMethod: t.method, classification: t.cls, summary: `${month} ${t.summary}`,
          confirmedAt: status === 'CONFIRMED' ? txDate : null, displayOrder: eIdx + 1,
          details: { create: { midId: t.mid.id, amount: BigInt(-amt), classification: t.cls, summary: t.summary, displayOrder: 1 } },
        },
      });
      bulkExpCount++;
    }

    // --- 売上：3〜4件/月 ---
    const salesCount = 3 + (mIdx % 2);
    for (let sIdx = 0; sIdx < salesCount; sIdx++) {
      const seed = mIdx * 200 + sIdx;
      const amt = vary(3500000, seed, 0.4);
      const invoiceAmt = Math.round(amt * 1.1);
      const status = isDraft ? 'DRAFT' : (isRecent ? 'READY' : 'CONFIRMED');
      const invoiceDate = new Date(yr, mn - 2, lastDay(yr, mn - 1)); // 前月末
      const schedDate = new Date(yr, mn - 1, lastDay(yr, mn));

      const salesTx = await prisma.transaction.create({
        data: {
          companyId: okoshi.id, accountId: mainAccount.id, partnerId: customer.id,
          type: 'SALES', status: status as 'DRAFT' | 'READY' | 'CONFIRMED',
          invoiceDate, scheduledDate: schedDate, accountingMonth: month,
          amount: BigInt(amt), invoiceAmount: BigInt(invoiceAmt),
          summary: `${month} ○○建設 ${salesSummaries[sIdx % salesSummaries.length]}`,
          confirmedAt: status === 'CONFIRMED' ? schedDate : null, displayOrder: sIdx + 1,
          details: { create: { midId: 売上.id, amount: BigInt(amt), summary: salesSummaries[sIdx % salesSummaries.length], displayOrder: 1 } },
        },
      });

      // 確定済みなら入金子取引も作成
      if (status === 'CONFIRMED') {
        const fee = 550;
        await prisma.transaction.create({
          data: {
            companyId: okoshi.id, accountId: mainAccount.id, partnerId: customer.id,
            type: 'SALES', status: 'CONFIRMED', parentId: salesTx.id,
            transactionDate: schedDate, accountingMonth: month,
            amount: BigInt(amt - fee), summary: `○○建設 入金（手数料${fee}円差引）`,
            confirmedAt: schedDate, displayOrder: 1,
          },
        });
        bulkSalesCount++;
      }
      bulkSalesCount++;
    }

    // --- 原価支払：3件/月 ---
    for (let cIdx = 0; cIdx < 3; cIdx++) {
      const seed = mIdx * 300 + cIdx;
      const amt = vary(1200000, seed, 0.4);
      const partner = costPartners[cIdx % costPartners.length];
      const status = isDraft ? 'DRAFT' : (isRecent ? 'READY' : 'CONFIRMED');
      const txDate = new Date(yr, mn - 1, 25);

      await prisma.transaction.create({
        data: {
          companyId: okoshi.id, accountId: mainAccount.id, partnerId: partner.id,
          type: 'COST_PAYMENT', status: status as 'DRAFT' | 'READY' | 'CONFIRMED',
          transactionDate: txDate, scheduledDate: txDate, accountingMonth: month,
          amount: BigInt(-amt), actualAmount: status === 'CONFIRMED' ? BigInt(-amt) : null,
          recordedAmount: BigInt(Math.round(amt * 1.1)), transferAmount: BigInt(amt),
          paymentMethod: 'BANK_TRANSFER', classification: 'VARIABLE',
          summary: `${month} ${partner.name} ${costSummaries[cIdx % costSummaries.length]}`,
          confirmedAt: status === 'CONFIRMED' ? txDate : null, displayOrder: cIdx + 1,
          details: { create: { midId: 外注費.id, amount: BigInt(-amt), classification: 'VARIABLE', summary: costSummaries[cIdx % costSummaries.length], displayOrder: 1 } },
        },
      });
      bulkCostCount++;
    }

    // --- 給与：3グループ/月（手動作成済みの月はスキップ）---
    const skipSalary = ['2026-02', '2026-03'].includes(month);
    if (!skipSalary) for (const [pgIdx, pg] of [pgKoji, pgEigyo, pgKanri].entries()) {
      const seed = mIdx * 400 + pgIdx;
      const basePayByGroup = [2700000, 1300000, 840000][pgIdx];
      const totalPay = vary(basePayByGroup, seed, 0.1);
      const transport = Math.round(totalPay * 0.05);
      const misc = pgIdx === 0 ? Math.round(totalPay * 0.01) : 0;
      const advance = pgIdx === 0 ? vary(50000, seed + 1) : 0;
      const siReserve = Math.round(totalPay * 0.14);
      const ctReserve = Math.round(totalPay * 0.09);
      const rentDed = vary([180000, 80000, 60000][pgIdx], seed + 2, 0.1);
      const telecomDed = vary([45000, 30000, 20000][pgIdx], seed + 3, 0.1);
      const advanceDed = pgIdx === 0 ? vary(80000, seed + 4) : 0;
      const siDed = vary([120000, 85000, 55000][pgIdx], seed + 5, 0.1);
      const taxDed = vary([55000, 45000, 35000][pgIdx], seed + 6, 0.1);
      const totalDed = rentDed + telecomDed + advanceDed + siDed + taxDed;
      const netPay = totalPay - totalDed;
      const status = isDraft ? 'DRAFT' : (isRecent ? 'READY' : 'CONFIRMED');
      const payDate = new Date(yr, mn - 1, 25);

      // 給与トランザクション
      await prisma.transaction.create({
        data: {
          companyId: okoshi.id, accountId: mainAccount.id,
          type: 'SALARY', status: status as 'DRAFT' | 'READY' | 'CONFIRMED',
          transactionDate: payDate, scheduledDate: payDate, accountingMonth: month,
          amount: BigInt(-totalPay), actualAmount: status === 'CONFIRMED' ? BigInt(-totalPay) : null,
          paymentMethod: 'BANK_TRANSFER', summary: `${month} ${pg.name}給与`,
          confirmedAt: status === 'CONFIRMED' ? payDate : null, displayOrder: pgIdx + 1,
        },
      });

      // SalaryEntry
      const deductions: { itemName: string; amount: bigint; displayOrder: number }[] = [
        { itemName: '家賃控除', amount: BigInt(rentDed), displayOrder: 1 },
        { itemName: '通信費控除', amount: BigInt(telecomDed), displayOrder: 2 },
        { itemName: '社会保険料(合算)', amount: BigInt(siDed), displayOrder: 3 },
        { itemName: '源泉納税(合算)', amount: BigInt(taxDed), displayOrder: 4 },
      ];
      if (advanceDed > 0) {
        deductions.push({ itemName: '立替経費', amount: BigInt(advanceDed), displayOrder: 5 });
      }

      await prisma.salaryEntry.create({
        data: {
          payrollGroupId: pg.id, payMonth: month, payDate,
          taxablePayment: BigInt(Math.round(totalPay * 0.88)),
          transportAllowance: BigInt(transport),
          miscExpenses: BigInt(misc),
          advanceExpenses: BigInt(advance),
          totalPayment: BigInt(totalPay),
          socialInsuranceReserve: BigInt(siReserve),
          consumptionTaxReserve: BigInt(ctReserve),
          totalDeduction: BigInt(totalDed),
          netPayment: BigInt(netPay),
          headcount: [15, 5, 3][pgIdx],
          status: status as 'DRAFT' | 'READY' | 'CONFIRMED',
          confirmedAt: status === 'CONFIRMED' ? payDate : null,
          deductions: { create: deductions },
          paymentDetails: { create: [
            { paymentDate: payDate, paymentMethod: 'BANK_TRANSFER', accountId: mainAccount.id, amount: BigInt(pgIdx === 0 ? netPay - 150000 : netPay), displayOrder: 1 },
            ...(pgIdx === 0 ? [{ paymentDate: payDate, paymentMethod: 'CASH_WITHDRAWAL' as const, accountId: mainAccount.id, amount: BigInt(150000), displayOrder: 2 }] : []),
          ] },
        },
      });
      bulkSalaryCount++;
    }

    // --- 資金移動：1件/月 ---
    if (mIdx % 2 === 0) {
      const amt = vary(500000, mIdx * 500, 0.3);
      const txDate = new Date(yr, mn - 1, 5);
      const status = isDraft ? 'DRAFT' : 'CONFIRMED';

      const ft = await prisma.transaction.create({
        data: {
          companyId: okoshi.id, accountId: mainAccount.id,
          type: 'TRANSFER', status: status as 'DRAFT' | 'CONFIRMED',
          transactionDate: txDate, accountingMonth: month,
          amount: BigInt(-amt), summary: `${month} 千葉銀行→京葉銀行 資金移動`,
          confirmedAt: status === 'CONFIRMED' ? txDate : null, displayOrder: 1,
        },
      });
      await prisma.fundTransfer.create({
        data: { transactionId: ft.id, fromAccountId: mainAccount.id, toAccountId: subAccount.id, transferDate: txDate, amount: BigInt(amt) },
      });
      bulkTransferCount++;
    }
  }

  console.log(`  経費: ${bulkExpCount}件`);
  console.log(`  売上: ${bulkSalesCount}件`);
  console.log(`  原価: ${bulkCostCount}件`);
  console.log(`  給与: ${bulkSalaryCount}件（SalaryEntry）`);
  console.log(`  振替: ${bulkTransferCount}件`);
  console.log(`  合計: ${bulkExpCount + bulkSalesCount + bulkCostCount + bulkSalaryCount * 1 + bulkTransferCount}件+`);

  console.log('✅ Test data complete (10x for 起工業)');
}

async function main() {
  await resetAll();
  const refs = await seedMaster();
  await seedTestData(refs);

  // 全12社分のマスタデータ（口座・取引先・給与グループ）を追加
  const midMap: Record<string, { id: string }> = {
    '売上': refs.売上,
    '外注費': refs.外注費,
    '通信費': refs.通信費,
    '水道光熱費': refs.水道光熱費,
    '地代家賃': refs.地代家賃,
    '消耗品費': { id: (await prisma.accountCategoryMid.findFirst({ where: { name: '消耗品費' } }))!.id },
    '広告宣伝費': { id: (await prisma.accountCategoryMid.findFirst({ where: { name: '広告宣伝費' } }))!.id },
  };

  const { companyAccounts, companyPartners, companyPayrolls } = await seedAllCompanyMasters(refs.companies, midMap);

  // 全12社分のトランザクション（経費/売上/給与/原価支払）を追加
  await seedAllCompanyTransactions(
    refs.companies,
    refs.mainAccount.id,
    companyAccounts,
    companyPartners,
    companyPayrolls,
    midMap,
  );

  console.log('\n🎉 Full reset + seed completed!');
  console.log('');
  console.log('📊 Summary:');
  console.log('  Companies: 12');
  console.log('  Accounts: 12 main + 11 term + virtual (48+ total)');
  console.log('  Partners: 9 (起工業) + 46 (他社) = 55');
  console.log('  Payroll Groups: 3 (起工業) + 18 (他社) = 21');
  console.log('  起工業 detail: Expenses 10, Sales 4, Cost 3, Transfers 2, Salary 3, Loans 2, Leases 2');
  console.log('  他11社: 各16ヶ月 × (経費3 + 売上1 + 原価1 + 給与1) = 約1056件');
  console.log('  Total Transactions: ~1080+ (起工業 detailed + 他社 16ヶ月×6種×11)');
}

main()
  .catch((e) => {
    console.error('❌ Failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
