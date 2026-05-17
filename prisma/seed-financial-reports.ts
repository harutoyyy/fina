// ============================================================
// 財務レポート投入: docs/ダミーデータ企業_20260515.xlsx
//
// シート構成:
//   - 全社単月: 1ヶ月分の試算表 (会社×勘定科目)
//   - 貸･xxx (12社+鳶/広告合計): 貸借対照表 年間推移
//   - 損･xxx: 損益計算書 年間推移
//   - 製･xxx: 製造原価 年間推移
//
// 実行: npx tsx prisma/seed-financial-reports.ts
// ============================================================

import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';
import * as path from 'path';

const prisma = new PrismaClient();
const XLSX_PATH = path.resolve(__dirname, '../docs/ダミーデータ企業_20260515.xlsx');

// 月インデックス→ yearMonth
// 列: 5月度=2025-05, 6月度=2025-06, ..., 4月度=2026-04
const MONTH_COLUMNS: { col: number; yearMonth: string }[] = [
  { col: 1, yearMonth: '2025-05' },
  { col: 2, yearMonth: '2025-06' },
  { col: 3, yearMonth: '2025-07' },
  { col: 4, yearMonth: '2025-08' },
  { col: 5, yearMonth: '2025-09' },
  { col: 6, yearMonth: '2025-10' },
  // col 7 = 上半期残高（スキップ）
  { col: 8, yearMonth: '2025-11' },
  { col: 9, yearMonth: '2025-12' },
  { col: 10, yearMonth: '2026-01' },
  { col: 11, yearMonth: '2026-02' },
  { col: 12, yearMonth: '2026-03' },
  { col: 13, yearMonth: '2026-04' },
];

const FISCAL_YEAR = 2025; // 2025年5月〜2026年4月

// セル値を安全に数値化（null/undefined/NaN/文字列はすべて 0）
function safeNum(v: any): number {
  if (v === null || v === undefined || v === '') return 0;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

// 会社名マッピング (xlsx → Company.name)
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

const COMPANY_NAMES = Object.keys(COMPANY_MAP);

// シート名から会社名を抽出 (例: "貸･起工業" → "起工業")
function extractCompanyFromSheet(sheetName: string): string | null {
  // 貸･xxx, 損･xxx, 製･xxx のパターン
  const m = sheetName.match(/^[貸損製]･(.+)$/);
  if (!m) return null;
  return m[1];
}

// シート名からレポート種別を抽出
function extractReportType(sheetName: string): string | null {
  if (sheetName.startsWith('貸･')) return 'BALANCE_SHEET';
  if (sheetName.startsWith('損･')) return 'INCOME_STATEMENT';
  if (sheetName.startsWith('製･')) return 'MANUFACTURING_COST';
  return null;
}

// セクション見出し判定 ([売上高] のような形式)
function isSection(name: string): boolean {
  return /^\[.+\]$/.test(name);
}

// 合計行判定 (xxx合計, xxx計, 損益金額 など)
function isSubtotal(name: string): boolean {
  return /(合計|計|損益金額|金額|当期製品製造原価|総製造費用|売上原価|売上総損益|営業損益|経常損益|当期純損益|税引前当期純損益|差引預金残|前月＋当月増減)$/.test(name);
}

async function main() {
  console.log('🌱 Reading xlsx...');
  const wb = XLSX.readFile(XLSX_PATH);
  console.log(`✅ ${wb.SheetNames.length} sheets loaded`);

  const companies = await prisma.company.findMany();
  const companyByName = new Map<string, string>();
  for (const c of companies) {
    companyByName.set(c.name, c.id);
    if (c.shortName) companyByName.set(c.shortName, c.id);
  }

  // 既存の財務レポートをクリア（再投入可能にする）
  const deleted = await prisma.financialReport.deleteMany({});
  console.log(`🧹 Cleared ${deleted.count} previous financial reports`);

  let inserted = 0;
  const insertBatch: any[] = [];

  async function flush() {
    if (insertBatch.length === 0) return;
    await prisma.financialReport.createMany({ data: insertBatch });
    inserted += insertBatch.length;
    insertBatch.length = 0;
  }

  // ========================================================
  // 1. 「全社単月」: 単月の試算表（部門対比）
  //    ファイル名の日付から 2026-04 と推測（最新月）
  // ========================================================
  {
    const ws = wb.Sheets['全社単月'];
    if (ws) {
      const j = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null }) as any[][];
      // ヘッダー行は r9
      const header = j[9];
      // col 1=起工業 ... col 14=インフィニティ, col 15=全体 合計
      // 月度は r6 から推測 → 4月度 = 2026-04
      const yearMonth = '2026-04';

      let currentSection: string | null = null;
      let displayOrder = 0;

      for (let i = 10; i < j.length; i++) {
        const r = j[i];
        if (!r) continue;
        const name = r[0] ? String(r[0]).trim() : '';
        if (!name) continue;

        if (isSection(name)) {
          currentSection = name.replace(/^\[|\]$/g, '');
          // セクション見出し行 (各会社で投入)
          for (let c = 0; c < COMPANY_NAMES.length; c++) {
            const xlsxName = COMPANY_NAMES[c];
            const finaName = COMPANY_MAP[xlsxName];
            const cid = companyByName.get(finaName);
            if (!cid) continue;
            // 会社列のインデックス: 起工業=1, 起グループ=2, ... 順番に
            insertBatch.push({
              companyId: cid,
              reportType: 'TRIAL_BALANCE',
              scope: 'SINGLE',
              yearMonth,
              fiscalYear: FISCAL_YEAR,
              accountName: name,
              section: currentSection,
              amount: 0n,
              displayOrder: displayOrder++,
              isSection: true,
              isSubtotal: false,
            });
          }
          // 合計スコープ
          insertBatch.push({
            companyId: null,
            reportType: 'TRIAL_BALANCE',
            scope: 'ALL_TOTAL',
            scopeLabel: '全体 合計',
            yearMonth,
            fiscalYear: FISCAL_YEAR,
            accountName: name,
            section: currentSection,
            amount: 0n,
            displayOrder: displayOrder - 1,
            isSection: true,
            isSubtotal: false,
          });
          continue;
        }

        // 各会社列を処理
        for (let cIdx = 0; cIdx < COMPANY_NAMES.length; cIdx++) {
          const xlsxName = COMPANY_NAMES[cIdx];
          // 列位置を header から検索
          const colIdx = header?.findIndex((h: any) => h === xlsxName);
          if (colIdx === undefined || colIdx < 0) continue;
          const finaName = COMPANY_MAP[xlsxName];
          const cid = companyByName.get(finaName);
          if (!cid) continue;
          const v = safeNum(r[colIdx]);
          insertBatch.push({
            companyId: cid,
            reportType: 'TRIAL_BALANCE',
            scope: 'SINGLE',
            yearMonth,
            fiscalYear: FISCAL_YEAR,
            accountName: name,
            section: currentSection,
            amount: BigInt(Math.trunc(v)),
            displayOrder: displayOrder++,
            isSubtotal: isSubtotal(name),
            isSection: false,
          });
        }

        // 鳶 合計
        const tobiCol = header?.findIndex((h: any) => h === '鳶　合計');
        if (tobiCol !== undefined && tobiCol >= 0) {
          const v = safeNum(r[tobiCol]);
          insertBatch.push({
            companyId: null,
            reportType: 'TRIAL_BALANCE',
            scope: 'INDUSTRY_TOTAL',
            scopeLabel: '鳶 合計',
            yearMonth,
            fiscalYear: FISCAL_YEAR,
            accountName: name,
            section: currentSection,
            amount: BigInt(Math.trunc(v)),
            displayOrder: displayOrder++,
            isSubtotal: isSubtotal(name),
            isSection: false,
          });
        }
        // 広告 合計
        const adCol = header?.findIndex((h: any) => h === '広告　合計');
        if (adCol !== undefined && adCol >= 0) {
          const v = safeNum(r[adCol]);
          insertBatch.push({
            companyId: null,
            reportType: 'TRIAL_BALANCE',
            scope: 'INDUSTRY_TOTAL',
            scopeLabel: '広告 合計',
            yearMonth,
            fiscalYear: FISCAL_YEAR,
            accountName: name,
            section: currentSection,
            amount: BigInt(Math.trunc(v)),
            displayOrder: displayOrder++,
            isSubtotal: isSubtotal(name),
            isSection: false,
          });
        }
        // 全体 合計
        const allCol = header?.findIndex((h: any) => h === '全体　合計');
        if (allCol !== undefined && allCol >= 0) {
          const v = safeNum(r[allCol]);
          insertBatch.push({
            companyId: null,
            reportType: 'TRIAL_BALANCE',
            scope: 'ALL_TOTAL',
            scopeLabel: '全体 合計',
            yearMonth,
            fiscalYear: FISCAL_YEAR,
            accountName: name,
            section: currentSection,
            amount: BigInt(Math.trunc(v)),
            displayOrder: displayOrder++,
            isSubtotal: isSubtotal(name),
            isSection: false,
          });
        }

        if (insertBatch.length > 1000) await flush();
      }
      await flush();
      console.log(`✅ 全社単月: ${inserted} inserted so far`);
    }
  }

  // ========================================================
  // 2. 「貸･xxx」「損･xxx」「製･xxx」: 年間推移 (12ヶ月)
  // ========================================================
  for (const sheetName of wb.SheetNames) {
    const reportType = extractReportType(sheetName);
    if (!reportType) continue;
    const xlsxCompany = extractCompanyFromSheet(sheetName);
    if (!xlsxCompany) continue;

    // 合計スコープ判定
    let companyId: string | null = null;
    let scope = 'SINGLE';
    let scopeLabel: string | null = null;
    if (xlsxCompany === '鳶(合計)') {
      scope = 'INDUSTRY_TOTAL';
      scopeLabel = '鳶 合計';
    } else if (xlsxCompany === '広告(合計)') {
      scope = 'INDUSTRY_TOTAL';
      scopeLabel = '広告 合計';
    } else {
      const finaName = COMPANY_MAP[xlsxCompany];
      if (!finaName) continue;
      companyId = companyByName.get(finaName) ?? null;
      if (!companyId) continue;
    }

    const ws = wb.Sheets[sheetName];
    const j = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null }) as any[][];
    // ヘッダーは r7 (貸/製) または r8 (損)
    const headerRow = reportType === 'INCOME_STATEMENT' ? 8 : 7;
    const dataStart = headerRow + 1;

    let currentSection: string | null = null;
    let displayOrder = 0;

    for (let i = dataStart; i < j.length; i++) {
      const r = j[i];
      if (!r) continue;
      const name = r[0] ? String(r[0]).trim() : '';
      if (!name) continue;

      if (isSection(name)) {
        currentSection = name.replace(/^\[|\]$/g, '');
        // セクション行は12ヶ月とも0で投入
        for (const mc of MONTH_COLUMNS) {
          insertBatch.push({
            companyId,
            reportType,
            scope,
            scopeLabel,
            yearMonth: mc.yearMonth,
            fiscalYear: FISCAL_YEAR,
            accountName: name,
            section: currentSection,
            amount: 0n,
            displayOrder: displayOrder++,
            isSection: true,
            isSubtotal: false,
          });
        }
        continue;
      }

      for (const mc of MONTH_COLUMNS) {
        const v = safeNum(r[mc.col]);
        insertBatch.push({
          companyId,
          reportType,
          scope,
          scopeLabel,
          yearMonth: mc.yearMonth,
          fiscalYear: FISCAL_YEAR,
          accountName: name,
          section: currentSection,
          amount: BigInt(Math.trunc(v)),
          displayOrder: displayOrder++,
          isSubtotal: isSubtotal(name),
          isSection: false,
        });
      }

      if (insertBatch.length > 1500) await flush();
    }
    await flush();
    console.log(`✅ ${sheetName}: total inserted=${inserted}`);
  }

  await flush();

  console.log(`\n🎉 Done. Total inserted: ${inserted}`);

  // サマリ
  const byType = await prisma.financialReport.groupBy({
    by: ['reportType'],
    _count: { id: true },
  });
  console.log('\n📊 Summary by reportType:');
  for (const r of byType) {
    console.log(`  ${r.reportType}: ${r._count.id}`);
  }
}

main()
  .catch((e) => { console.error('❌', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
