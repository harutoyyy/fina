// ============================================================
// 仕訳帳投入: docs/ダミーデータ_202505_202604.xlsx の全行を
// JournalEntry テーブルに格納する。
//
// xlsx 14,756行 (ヘッダー含めて 14,757) を1行1仕訳として保存。
//
// 実行: npx tsx prisma/seed-journal-entries.ts
// ============================================================

import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';
import * as path from 'path';

const prisma = new PrismaClient();
const XLSX_PATH = path.resolve(__dirname, '../docs/ダミーデータ_202505_202604.xlsx');

// 列インデックス（ヘッダー確認済）
const COL = {
  IDENTIFIER: 0,   // 識別フラグ
  VOUCHER_NO: 1,   // 伝票No
  SETTLEMENT: 2,   // 決算
  DATE: 3,         // 取引日付
  DR_KIND: 4,      // 借方勘定科目
  DR_SUB: 5,       // 借方補助科目
  DR_COMPANY: 6,   // 借方部門
  DR_TAX: 7,       // 借方税区分
  DR_AMOUNT: 8,    // 借方金額
  DR_TAX_AMT: 9,   // 借方税金額
  CR_KIND: 10,
  CR_SUB: 11,
  CR_COMPANY: 12,
  CR_TAX: 13,
  CR_AMOUNT: 14,
  CR_TAX_AMT: 15,
  SUMMARY: 16,
  REF_NUMBER: 17,
  DUE_DATE: 18,
  TYPE: 19,
  SOURCE: 20,
  MEMO: 21,
  TAG1: 22,
  TAG2: 23,
  ADJUSTMENT: 24,
};

// 会社名マッピング xlsx → fina Company.name
const COMPANY_MAP: Record<string, string> = {
  '起工業': '起工業',
  '起グループ': '起グループ',
  '松村建設': '松村建設',
  '佐藤建設工業': '佐藤建設工業',
  '吉川建設': '吉川建設',
  '建設サポート': '建設サポート',
  'エイトグループ': 'エイトグループ',
  'WINNERS': 'WINNERS',
  'CAREECH': 'CAREECH',
  'WINNERS CLUB': 'WINNERS CLUB',
  'G-FARM': 'G-FARM',
  'インフィニティ': 'インフィニティグループ',
};

// 「R.07/05/01」 → Date(2025/5/1)
function parseReiwaDate(s: any): Date | null {
  if (!s) return null;
  const str = String(s);
  const m = str.match(/^R\.(\d+)\/(\d+)\/(\d+)$/);
  if (m) {
    const reiwa = parseInt(m[1], 10);
    const month = parseInt(m[2], 10);
    const day = parseInt(m[3], 10);
    return new Date(Date.UTC(2018 + reiwa, month - 1, day));
  }
  // Excel シリアル値
  if (typeof s === 'number') {
    return new Date(Date.UTC(1899, 11, 30 + Math.floor(s)));
  }
  return null;
}

function safeBigInt(v: any): bigint {
  if (v === null || v === undefined || v === '') return 0n;
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return 0n;
  return BigInt(Math.trunc(n));
}

function safeInt(v: any): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

function safeStr(v: any): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

async function main() {
  console.log('🌱 Reading xlsx...');
  const wb = XLSX.readFile(XLSX_PATH);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null }) as any[][];
  console.log(`✅ ${rows.length} rows loaded (incl. header)`);

  // 既存マスタ
  const companies = await prisma.company.findMany();
  const companyByName = new Map<string, string>();
  for (const c of companies) {
    companyByName.set(c.name, c.id);
    if (c.shortName) companyByName.set(c.shortName, c.id);
  }

  function resolveCompanyId(xlsxName: any): string | null {
    const name = safeStr(xlsxName);
    if (!name) return null;
    const mapped = COMPANY_MAP[name] ?? name;
    return companyByName.get(mapped) ?? null;
  }

  // 既存仕訳をクリア（再実行可能に）
  const deleted = await prisma.journalEntry.deleteMany({});
  console.log(`🧹 Cleared ${deleted.count} previous journal entries`);

  let inserted = 0;
  let skippedNoDate = 0;
  let skippedNoVoucher = 0;
  const batch: any[] = [];
  const BATCH = 1000;

  async function flush() {
    if (batch.length === 0) return;
    await prisma.journalEntry.createMany({ data: batch });
    inserted += batch.length;
    batch.length = 0;
  }

  const start = Date.now();

  // 1行目はヘッダーなのでスキップ
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r) continue;

    const date = parseReiwaDate(r[COL.DATE]);
    if (!date) { skippedNoDate++; continue; }

    const voucherNo = safeInt(r[COL.VOUCHER_NO]);
    if (voucherNo === null) { skippedNoVoucher++; continue; }

    const identifierFlag = safeInt(r[COL.IDENTIFIER]) ?? 0;
    const drCompanyName = safeStr(r[COL.DR_COMPANY]);
    const crCompanyName = safeStr(r[COL.CR_COMPANY]);

    batch.push({
      voucherNo,
      identifierFlag,
      transactionDate: date,
      drAccountKind: safeStr(r[COL.DR_KIND]),
      drSubAccount: safeStr(r[COL.DR_SUB]),
      drCompanyId: resolveCompanyId(drCompanyName),
      drCompanyName: drCompanyName,
      drTaxClass: safeStr(r[COL.DR_TAX]),
      drAmount: safeBigInt(r[COL.DR_AMOUNT]),
      drTaxAmount: safeBigInt(r[COL.DR_TAX_AMT]),
      crAccountKind: safeStr(r[COL.CR_KIND]),
      crSubAccount: safeStr(r[COL.CR_SUB]),
      crCompanyId: resolveCompanyId(crCompanyName),
      crCompanyName: crCompanyName,
      crTaxClass: safeStr(r[COL.CR_TAX]),
      crAmount: safeBigInt(r[COL.CR_AMOUNT]),
      crTaxAmount: safeBigInt(r[COL.CR_TAX_AMT]),
      summary: safeStr(r[COL.SUMMARY]),
      refNumber: safeStr(r[COL.REF_NUMBER]),
      voucherDueDate: parseReiwaDate(r[COL.DUE_DATE]),
      voucherType: safeInt(r[COL.TYPE]),
      source: safeStr(r[COL.SOURCE]),
      memo: safeStr(r[COL.MEMO]),
      tag1: safeInt(r[COL.TAG1]),
      tag2: safeInt(r[COL.TAG2]),
      adjustment: safeStr(r[COL.ADJUSTMENT]),
    });

    if (batch.length >= BATCH) {
      await flush();
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      console.log(`  ... ${inserted} inserted (${elapsed}s)`);
    }
  }
  await flush();

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`\n✅ Done in ${elapsed}s`);
  console.log(`  inserted: ${inserted}`);
  console.log(`  skipped (no date): ${skippedNoDate}`);
  console.log(`  skipped (no voucher): ${skippedNoVoucher}`);

  // 集計
  const byFlag = await prisma.journalEntry.groupBy({
    by: ['identifierFlag'],
    _count: { id: true },
  });
  console.log('\n📊 By identifierFlag:');
  for (const b of byFlag) console.log(`  ${b.identifierFlag}: ${b._count.id}`);

  // 起工業の件数
  const okoshi = companies.find(c => c.name === '起工業');
  if (okoshi) {
    const cnt = await prisma.journalEntry.count({
      where: { OR: [{ drCompanyId: okoshi.id }, { crCompanyId: okoshi.id }] },
    });
    console.log(`\n🏢 起工業を含む仕訳: ${cnt}`);
  }
}

main()
  .catch(e => { console.error('❌', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
