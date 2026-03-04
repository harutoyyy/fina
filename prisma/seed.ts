// ============================================================
// 経理くん（fina） Seed Script
// prisma/seed.ts として配置
// 実行: npx prisma db seed
// ============================================================

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // ============================================================
  // 1. 会社マスタ（12社）
  // ============================================================
  const companies = await Promise.all([
    // 建設業（7社）
    { name: '起工業', shortName: '起工業', industryType: '建設業', fiscalMonth: 3, displayOrder: 1 },
    { name: '起グループ', shortName: '起グループ', industryType: '建設業', fiscalMonth: 3, displayOrder: 2 },
    { name: '松村建設', shortName: '松村建設', industryType: '建設業', fiscalMonth: 3, displayOrder: 3 },
    { name: '佐藤建設工業', shortName: '佐藤建設', industryType: '建設業', fiscalMonth: 3, displayOrder: 4 },
    { name: '吉川建設', shortName: '吉川建設', industryType: '建設業', fiscalMonth: 3, displayOrder: 5 },
    { name: '建設サポート', shortName: '建設サポート', industryType: '建設業', fiscalMonth: 3, displayOrder: 6 },
    { name: 'エイトグループ', shortName: 'エイトG', industryType: '建設業', fiscalMonth: 3, displayOrder: 7 },
    // 広告業（2社）
    { name: 'WINNERS', shortName: 'WINNERS', industryType: '広告業', fiscalMonth: 3, displayOrder: 8 },
    { name: 'CAREECH', shortName: 'CAREECH', industryType: '広告業', fiscalMonth: 3, displayOrder: 9 },
    // その他（3社）
    { name: 'WINNERS CLUB', shortName: 'W-CLUB', industryType: 'その他', fiscalMonth: 3, displayOrder: 10 },
    { name: 'G-FARM', shortName: 'G-FARM', industryType: 'その他', fiscalMonth: 3, displayOrder: 11 },
    { name: 'インフィニティグループ', shortName: 'インフィニティ', industryType: 'その他', fiscalMonth: 3, displayOrder: 12 },
  ].map(c => prisma.company.create({ data: c })));

  console.log(`✅ ${companies.length} companies created`);

  // ============================================================
  // 2. 各社に仮想口座（社保積立・消費税積立）を自動生成
  // ============================================================
  for (const company of companies) {
    await prisma.account.createMany({
      data: [
        {
          companyId: company.id,
          accountType: 'SOCIAL_INSURANCE_RESERVE',
          isMain: false,
          isVirtual: true,
          isVisible: false,
          displayOrder: 98,
        },
        {
          companyId: company.id,
          accountType: 'CONSUMPTION_TAX_RESERVE',
          isMain: false,
          isVirtual: true,
          isVisible: false,
          displayOrder: 99,
        },
      ],
    });
  }
  console.log('✅ Virtual accounts created for all companies');

  // ============================================================
  // 3. サンプル銀行口座（起工業のみ）
  // ============================================================
  const sampleAccount = await prisma.account.create({
    data: {
      companyId: companies[0].id,
      bankName: '千葉銀行',
      bankCode: '0134',
      branchName: '松戸支店',
      branchCode: '201',
      accountNumber: '1234567',
      accountType: 'ORDINARY',
      accountHolder: 'ｵｺｼｺｳｷﾞﾖｳ',
      isMain: true,
      isVirtual: false,
      isVisible: true,
      displayOrder: 1,
    },
  });

  // メイン口座IDを会社に設定
  await prisma.company.update({
    where: { id: companies[0].id },
    data: { mainAccountId: sampleAccount.id },
  });
  console.log('✅ Sample bank account created for 起工業');

  // ============================================================
  // 4. 勘定科目マスタ（3階層）
  // ============================================================

  // --- 大項目 ---
  const majors = await Promise.all([
    { name: '売上高', direction: 'INCOME', displayOrder: 1 },
    { name: '売上原価', direction: 'EXPENSE', displayOrder: 2 },
    { name: '販売管理費', direction: 'EXPENSE', displayOrder: 3 },
    { name: '営業外収益', direction: 'INCOME', displayOrder: 4 },
    { name: '営業外費用', direction: 'EXPENSE', displayOrder: 5 },
    { name: 'その他費用', direction: 'EXPENSE', displayOrder: 6 },
  ].map(m => prisma.accountCategoryMajor.create({ data: m })));

  const [売上高, 売上原価, 販管費, 営業外収益, 営業外費用, その他費用] = majors;

  // --- 中項目＋小項目 ---
  // Helper: 中項目を作成し、小項目があれば一括作成
  async function createMidWithSubs(
    majorId: string,
    midName: string,
    displayOrder: number,
    subs: string[] = []
  ) {
    const mid = await prisma.accountCategoryMid.create({
      data: { majorId, name: midName, displayOrder },
    });
    if (subs.length > 0) {
      await prisma.accountCategorySub.createMany({
        data: subs.map((name, i) => ({
          midId: mid.id,
          name,
          displayOrder: i + 1,
        })),
      });
    }
    return mid;
  }

  // -- 販売管理費 配下 --
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
  const 会議費 = await createMidWithSubs(販管費.id, '会議費', 13);
  const 交際費 = await createMidWithSubs(販管費.id, '交際費', 14);
  const 支払報酬料 = await createMidWithSubs(販管費.id, '支払報酬料', 15, ['税理士', '社労士', 'その他（報酬）']);
  const 立替金 = await createMidWithSubs(販管費.id, '立替金', 16);
  const 法定福利費 = await createMidWithSubs(販管費.id, '法定福利費', 17);
  const 福利厚生費 = await createMidWithSubs(販管費.id, '福利厚生費', 18);
  const 修繕費 = await createMidWithSubs(販管費.id, '修繕費', 19);
  const 租税公課 = await createMidWithSubs(販管費.id, '租税公課', 20);
  const 雑費_販管 = await createMidWithSubs(販管費.id, '雑費', 21);

  // -- 売上高 配下 --
  const 売上 = await createMidWithSubs(売上高.id, '売上', 1);
  const 雑収入_売上 = await createMidWithSubs(売上高.id, '雑収入', 2);

  // -- 売上原価 配下 --
  const 外注費 = await createMidWithSubs(売上原価.id, '外注費', 1);
  const 材料費 = await createMidWithSubs(売上原価.id, '材料費', 2);
  const 労務費 = await createMidWithSubs(売上原価.id, '労務費', 3);
  const 旅費交通費_原価 = await createMidWithSubs(売上原価.id, '旅費交通費', 4, ['ETC', 'ガソリン', '宿泊', 'その他（旅費）']);
  const 現場経費 = await createMidWithSubs(売上原価.id, '現場経費', 5);

  // -- 営業外収益 配下 --
  const 受取利息 = await createMidWithSubs(営業外収益.id, '受取利息', 1);
  const 雑収入_営業外 = await createMidWithSubs(営業外収益.id, '雑収入', 2);

  // -- 営業外費用 配下 --
  const 支払利息 = await createMidWithSubs(営業外費用.id, '支払利息', 1);
  const 雑損失 = await createMidWithSubs(営業外費用.id, '雑損失', 2);

  // -- その他費用 配下 --
  const 社会保険積立 = await createMidWithSubs(その他費用.id, '社会保険積立', 1, ['給与預かり分']);
  const 源泉所得税 = await createMidWithSubs(その他費用.id, '源泉所得税', 2, ['給与預かり分']);
  const 貸金立替金 = await createMidWithSubs(その他費用.id, '貸金/立替金', 3, ['給与預かり分']);
  const 消費税積立 = await createMidWithSubs(その他費用.id, '消費税積立', 4, ['給与預かり分']);

  console.log('✅ Account categories (major/mid/sub) created');

  // ============================================================
  // 5. 控除カテゴリマスタ（売上用・原価用）
  // ============================================================

  // 売上用控除カテゴリ
  await prisma.deductionCategory.createMany({
    data: [
      { forType: 'SALES', name: '前倒し入金', midId: 売上.id, hasSubTypes: true, signRule: { occurrence: 1, offset: -1 }, displayOrder: 1 },
      { forType: 'SALES', name: '保留金', midId: 売上.id, hasSubTypes: true, signRule: { occurrence: -1, offset: 1 }, displayOrder: 2 },
      { forType: 'SALES', name: '値引', midId: 売上.id, hasSubTypes: false, displayOrder: 3 },
      { forType: 'SALES', name: '振込手数料', midId: 支払手数料.id, hasSubTypes: false, displayOrder: 4 },
      { forType: 'SALES', name: 'その他控除（売上）', midId: 売上.id, hasSubTypes: false, displayOrder: 5 },
    ],
  });

  // 原価用控除カテゴリ
  await prisma.deductionCategory.createMany({
    data: [
      { forType: 'COST', name: '安全協力会費', midId: 諸会費.id, hasSubTypes: false, displayOrder: 1 },
      { forType: 'COST', name: '振込手数料', midId: 支払手数料.id, hasSubTypes: false, displayOrder: 2 },
      { forType: 'COST', name: '保留金', midId: 外注費.id, hasSubTypes: true, signRule: { occurrence: -1, offset: 1 }, displayOrder: 3 },
      { forType: 'COST', name: '値引/値上', midId: 外注費.id, hasSubTypes: false, displayOrder: 4 },
      { forType: 'COST', name: 'その他控除（原価）', midId: 外注費.id, hasSubTypes: false, displayOrder: 5 },
    ],
  });

  console.log('✅ Deduction categories created');

  // ============================================================
  // 6. 給与グループマスタ（起工業サンプル）
  // ============================================================
  await prisma.payrollGroup.createMany({
    data: [
      { companyId: companies[0].id, name: '工事部門', costType: 'COST', displayOrder: 1 },
      { companyId: companies[0].id, name: '営業部門', costType: 'SGA', displayOrder: 2 },
      { companyId: companies[0].id, name: '管理部門', costType: 'SGA', displayOrder: 3 },
    ],
  });
  console.log('✅ Sample payroll groups created for 起工業');

  // ============================================================
  // 7. 給与自動仕訳マッピング
  // ============================================================
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
  console.log('✅ Salary journal mappings created');

  // ============================================================
  // 8. サンプル取引先（起工業）
  // ============================================================
  await prisma.tradingPartner.createMany({
    data: [
      { companyId: companies[0].id, name: 'NTT東日本', type: 'VENDOR', tagKey: 'EXPENSE', isActive: true },
      { companyId: companies[0].id, name: '東京電力', type: 'VENDOR', tagKey: 'EXPENSE', isActive: true },
      { companyId: companies[0].id, name: '東京ガス', type: 'VENDOR', tagKey: 'EXPENSE', isActive: true },
      { companyId: companies[0].id, name: '○○建設', type: 'CUSTOMER', tagKey: 'CUSTOMER', isActive: true },
      { companyId: companies[0].id, name: '△△工務店', type: 'VENDOR', tagKey: 'SUBCONTRACTOR', isActive: true },
      { companyId: companies[0].id, name: '起グループ', type: 'BOTH', tagKey: 'GROUP_COMPANY', isActive: true },
    ],
  });
  console.log('✅ Sample trading partners created for 起工業');

  // ============================================================
  // 9. 月次残高初期値（起工業メイン口座 2026年3月）
  // ============================================================
  await prisma.monthlyBalance.create({
    data: {
      companyId: companies[0].id,
      accountId: sampleAccount.id,
      yearMonth: '2026-03',
      openingBalance: BigInt(5000000), // 500万円
      closingBalance: BigInt(5000000),
    },
  });
  console.log('✅ Sample monthly balance created');

  // ============================================================
  // 10. 銀行マスタ（主要銀行のみ。本番はCSVインポート）
  // ============================================================
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

  // サンプル支店（千葉銀行のみ）
  await prisma.branchMaster.createMany({
    data: [
      { bankCode: '0134', branchCode: '001', branchName: '本店営業部', branchNameKana: 'ﾎﾝﾃﾝ' },
      { bankCode: '0134', branchCode: '201', branchName: '松戸支店', branchNameKana: 'ﾏﾂﾄﾞ' },
      { bankCode: '0134', branchCode: '202', branchName: '柏支店', branchNameKana: 'ｶｼﾜ' },
      { bankCode: '0134', branchCode: '203', branchName: '船橋支店', branchNameKana: 'ﾌﾅﾊﾞｼ' },
    ],
  });
  console.log(`✅ ${bankData.length} banks + sample branches created`);

  console.log('\n🎉 Seed completed!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
