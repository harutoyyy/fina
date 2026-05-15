// ============================================================
// docs/ダミーデータ_202505_202604.xlsx を fina に投入する
//
// 各行（複式簿記）から「実出納取引」だけを抽出し、
// Transaction として投入する。
//
// 実行: npx tsx prisma/seed-from-xlsx.ts
// ============================================================

import { PrismaClient, TransactionType, TransactionStatus, PaymentMethod } from '@prisma/client';
import * as XLSX from 'xlsx';
import * as path from 'path';

const prisma = new PrismaClient();
const XLSX_PATH = path.resolve(__dirname, '../docs/ダミーデータ_202505_202604.xlsx');

// 列インデックス
const COL_BATCH = 0;       // 伝票区分 (2000/2100/2101/2110/2111)
const COL_VOUCHER = 1;     // 伝票番号
const COL_DATE = 3;        // 日付 (R.07/05/01)
const COL_DR_KIND = 4;     // 借方種別
const COL_DR_SUB = 5;      // 借方補助
const COL_DR_COMPANY = 6;  // 借方会社
const COL_DR_TAX = 7;
const COL_DR_AMOUNT = 8;
const COL_CR_KIND = 10;    // 貸方種別
const COL_CR_SUB = 11;     // 貸方補助
const COL_CR_COMPANY = 12;
const COL_CR_TAX = 13;
const COL_CR_AMOUNT = 14;
const COL_SUMMARY = 16;    // 摘要

// 会社名マッピング（xlsx → fina の Company.shortName/name）
const COMPANY_NAME_MAP: Record<string, string> = {
  '起グループ': '起グループ',
  '起工業': '起工業',
  'WINNERS CLUB': 'WINNERS CLUB',
  '松村建設': '松村建設',
  '佐藤建設工業': '佐藤建設工業',
  '吉川建設': '吉川建設',
  '建設サポート': '建設サポート',
  'G-FARM': 'G-FARM',
  'エイトグループ': 'エイトグループ',
  'WINNERS': 'WINNERS',
  'インフィニティ': 'インフィニティグループ',
  'CAREECH': 'CAREECH',
};

// 「R.07/05/01」 → Date(2025/5/1)
function parseReiwaDate(s: string | null): Date | null {
  if (!s) return null;
  const m = String(s).match(/^R\.(\d+)\/(\d+)\/(\d+)$/);
  if (!m) return null;
  const reiwa = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  const day = parseInt(m[3], 10);
  const year = 2018 + reiwa; // R.1 = 2019
  return new Date(Date.UTC(year, month - 1, day));
}

function yyyymm(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

// 取引種別の推測
function inferType(kind: string, batch: number): TransactionType {
  if (kind.includes('売上') || kind === '車両売上' || kind === '残土売上' || kind === '派遣売上' || kind === '予定外入金') return 'SALES';
  if (kind.startsWith('[製]')) return 'COST_PAYMENT';
  if (kind === 'グループ売上高') return 'SALES';
  if (kind === '銀行返済' || kind === 'グループ借入' || kind === '銀行新規') return 'LOAN';
  if (kind === '役員報酬' || kind === '給料手当' || kind === 'その他給与預かり分') return 'SALARY';
  if (kind === '定期預金' || kind === '別段預金') return 'TRANSFER';
  if (kind === '納税') return 'EXPENSE';
  // その他経費系
  if (kind.includes('経費') || kind === '保留金' || kind === '前倒し入金' || kind === '予定外支払' || kind === '特別経費') return 'EXPENSE';
  return 'EXPENSE';
}

// 分類 (FIXED/VARIABLE/TEMPORARY)
function inferClassification(kind: string): string | null {
  if (kind.includes('固定')) return 'FIXED';
  if (kind.includes('変動')) return 'VARIABLE';
  if (kind.includes('臨時') || kind === '予定外支払' || kind === '予定外入金') return 'TEMPORARY';
  return null;
}

// 中項目マッピング
const MID_NAME_MAP: Record<string, string> = {
  '支払手数料': '支払手数料',
  '振込手数料': '支払手数料',
  '車両費': '車両費',
  '旅費交通費': '旅費交通費',
  '消耗品費': '消耗品費',
  '保険料': '保険料',
  '事務所賃料': '事務所賃料',
  '地代家賃': '地代家賃',
  '支払報酬料': '支払報酬料',
  '法定福利費': '法定福利費',
  '福利厚生費': '福利厚生費',
  '会議費': '会議費',
  '交際費': '交際費',
  '通信費': '通信費',
  '水道光熱費': '水道光熱費',
  '広告宣伝費': '広告宣伝費',
  '修繕費': '修繕費',
  '租税公課': '租税公課',
  '雑費': '雑費',
  '建設業売上': '売上',
  'WC売上': '売上',
  'リース売上': '売上',
  '自動車税': '租税公課',
};

async function main() {
  console.log('🌱 Reading xlsx ...');
  const wb = XLSX.readFile(XLSX_PATH);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null }) as any[][];
  console.log(`✅ ${rows.length} rows loaded`);

  // 既存マスタを取得
  const companies = await prisma.company.findMany();
  const companyByName = new Map<string, typeof companies[0]>();
  for (const c of companies) {
    companyByName.set(c.name, c);
    if (c.shortName) companyByName.set(c.shortName, c);
  }

  const accounts = await prisma.account.findMany({ where: { isVirtual: false, isActive: true } });
  // 会社ID × 銀行名 → Account
  function findAccount(companyId: string, bankName: string | null): typeof accounts[0] | undefined {
    const list = accounts.filter(a => a.companyId === companyId);
    if (bankName) {
      // 「千葉銀行　メイン」「三井住友銀行」など、銀行名を含むかで判定
      const norm = bankName.replace(/\s+/g, '').replace('メイン', '');
      const hit = list.find(a => a.bankName && norm.includes(a.bankName.replace(/\s+/g, '')));
      if (hit) return hit;
    }
    return list.find(a => a.isMain) ?? list[0];
  }

  // 中項目
  const mids = await prisma.accountCategoryMid.findMany({ include: { major: true } });
  function findMid(subOrKind: string | null) {
    if (!subOrKind) return null;
    const mapped = MID_NAME_MAP[subOrKind];
    if (mapped) {
      return mids.find(m => m.name === mapped);
    }
    // 直接一致
    return mids.find(m => m.name === subOrKind);
  }

  // 取引先マスタ（キャッシュ）。会社別で「仮取引先」を扱う
  const partnerCache = new Map<string, string>(); // key=`${companyId}|${name}` → partnerId
  async function ensurePartner(companyId: string, name: string | null): Promise<string | null> {
    if (!name) return null;
    const cleaned = name.replace(/\/+$/, '').trim();
    if (!cleaned) return null;
    const key = `${companyId}|${cleaned}`;
    if (partnerCache.has(key)) return partnerCache.get(key)!;
    let p = await prisma.tradingPartner.findFirst({ where: { companyId, name: cleaned } });
    if (!p) {
      p = await prisma.tradingPartner.create({
        data: {
          companyId,
          name: cleaned,
          type: 'BOTH',
          tagKey: 'OTHER',
          notes: 'xlsx取込で自動作成',
        },
      });
    }
    partnerCache.set(key, p.id);
    return p.id;
  }

  // 既存ダミー取込を識別するため、summary に [xlsx] を含める
  let inserted = 0;
  let skippedCashboth = 0;   // 借方0+貸方0
  let skippedNoCompany = 0;  // 会社未対応
  let skippedJournalOnly = 0; // 普通預金が関わらない仕訳
  let skippedNoAccount = 0;
  let salaryCount = 0;
  let salesCount = 0;
  let expenseCount = 0;
  let costCount = 0;
  let transferCount = 0;
  let loanCount = 0;

  console.log('🚀 inserting transactions ...');

  const startTime = Date.now();

  // 既存の xlsx 投入を一度クリア（再実行可能にするため）
  const existed = await prisma.transaction.deleteMany({
    where: { summary: { startsWith: '[xlsx]' } },
  });
  console.log(`🧹 Cleared previous xlsx imports: ${existed.count}`);

  // また、xlsxインポートで作った仮取引先もクリア（孤立を防ぐ）
  // → ただし参照されている可能性があるので注意。今回は notes で識別したものに限定し、
  //   関連 transaction が無いものだけ削除。
  await prisma.tradingPartner.deleteMany({
    where: { notes: 'xlsx取込で自動作成', transactions: { none: {} } },
  });

  // バッチ処理用バッファ
  const txBuffer: any[] = [];
  const BATCH_SIZE = 500;

  async function flush() {
    if (txBuffer.length === 0) return;
    await prisma.transaction.createMany({ data: txBuffer });
    inserted += txBuffer.length;
    txBuffer.length = 0;
  }

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!r) continue;

    const drAmt = Number(r[COL_DR_AMOUNT] ?? 0);
    const crAmt = Number(r[COL_CR_AMOUNT] ?? 0);
    if (drAmt === 0 && crAmt === 0) { skippedCashboth++; continue; }

    const drKind = r[COL_DR_KIND] ? String(r[COL_DR_KIND]) : '';
    const crKind = r[COL_CR_KIND] ? String(r[COL_CR_KIND]) : '';
    const isDrCash = drKind === '普通預金';
    const isCrCash = crKind === '普通預金';

    if (!isDrCash && !isCrCash) {
      // 純粋仕訳（控除明細・給与預かりなど）→ スキップ
      skippedJournalOnly++;
      continue;
    }

    // 入金か出金か
    let isIncome: boolean;
    let companyXlsx: string;
    let bankName: string | null;
    let otherKind: string;
    let otherSub: string | null;
    let amount: number;

    if (isDrCash) {
      // 借方が普通預金 → 入金
      isIncome = true;
      companyXlsx = String(r[COL_DR_COMPANY] ?? '');
      bankName = r[COL_DR_SUB] ? String(r[COL_DR_SUB]) : null;
      otherKind = crKind;
      otherSub = r[COL_CR_SUB] ? String(r[COL_CR_SUB]) : null;
      amount = drAmt;
    } else {
      // 貸方が普通預金 → 出金
      isIncome = false;
      companyXlsx = String(r[COL_CR_COMPANY] ?? '');
      bankName = r[COL_CR_SUB] ? String(r[COL_CR_SUB]) : null;
      otherKind = drKind;
      otherSub = r[COL_DR_SUB] ? String(r[COL_DR_SUB]) : null;
      amount = crAmt;
    }

    if (!companyXlsx) { skippedNoCompany++; continue; }
    const companyName = COMPANY_NAME_MAP[companyXlsx];
    const company = companyName ? companyByName.get(companyName) : undefined;
    if (!company) { skippedNoCompany++; continue; }

    const account = findAccount(company.id, bankName);
    if (!account) { skippedNoAccount++; continue; }

    const date = parseReiwaDate(r[COL_DATE]);
    if (!date) continue;

    const type = inferType(otherKind, Number(r[COL_BATCH] ?? 2000));
    const classification = inferClassification(otherKind);
    const mid = findMid(otherSub) ?? findMid(otherKind);
    const summary = r[COL_SUMMARY] ? String(r[COL_SUMMARY]) : '';

    // 取引先（摘要から推測）
    let partnerId: string | null = null;
    if (summary) {
      // 「ノブ建/」「クラブミリオン」のような部分。"/" の前を取引先名とする
      const candidate = summary.split('/')[0].trim();
      if (candidate && candidate.length > 0 && candidate.length < 50) {
        partnerId = await ensurePartner(company.id, candidate);
      }
    }

    const signedAmount = isIncome ? amount : -amount;

    // 振込/引落の区別: 1万円以下や手数料は引落、それ以外は振込
    let paymentMethod: PaymentMethod | null = null;
    if (!isIncome) {
      if (otherSub === '振込手数料' || otherSub === '支払手数料' || amount < 5000) {
        paymentMethod = 'DIRECT_DEBIT';
      } else {
        paymentMethod = 'BANK_TRANSFER';
      }
    }

    txBuffer.push({
      companyId: company.id,
      accountId: account.id,
      partnerId,
      type,
      status: 'CONFIRMED',
      transactionDate: date,
      scheduledDate: date,
      accountingMonth: yyyymm(date),
      amount: BigInt(signedAmount),
      paymentMethod,
      classification,
      summary: `[xlsx] ${summary}`.slice(0, 200),
      confirmedAt: new Date(),
    });

    // カウント
    switch (type) {
      case 'SALES': salesCount++; break;
      case 'EXPENSE': expenseCount++; break;
      case 'COST_PAYMENT': costCount++; break;
      case 'SALARY': salaryCount++; break;
      case 'TRANSFER': transferCount++; break;
      case 'LOAN': loanCount++; break;
    }

    if (txBuffer.length >= BATCH_SIZE) {
      await flush();
      if (inserted % 2000 === 0) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`  ... inserted=${inserted} (${elapsed}s)`);
      }
    }
  }
  await flush();

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`✅ Done in ${elapsed}s\n`);

  console.log('📊 Summary:');
  console.log({
    inserted_total: inserted,
    by_type: {
      SALES: salesCount,
      EXPENSE: expenseCount,
      COST_PAYMENT: costCount,
      SALARY: salaryCount,
      TRANSFER: transferCount,
      LOAN: loanCount,
    },
    skipped: {
      both_zero: skippedCashboth,
      no_company: skippedNoCompany,
      journal_only: skippedJournalOnly,
      no_account: skippedNoAccount,
    },
  });
}

main()
  .catch((e) => { console.error('❌', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
