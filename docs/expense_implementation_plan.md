# 経費入力 要件定義 未実装項目 実装計画

> 作成日：2026-04-06
> 照合元：`docs/expense_implementation_audit.md`（監査レポート）
> 対象：未実装15項目（セキュリティ2件・機能7件・UX6件）
> 目的：要件定義（2026-03-27）との乖離を解消し、全セクションの完全実装を達成する

---

## 1. 実装順序とフェーズ構成

```
Phase 1 (即時) ── セキュリティ修正
  S-1, S-2                             # 並行可

Phase 2 (小規模) ── 型/スキーマ/UIの小修正
  U-6 → F-2 → F-5                      # 依存チェーン
  U-1/U-2, U-3, U-4, F-7               # 並行可（独立したUI修正）

Phase 3 (中規模) ── ロジック/UI機能追加
  F-4 → F-3                            # 休日ロジック → 繰り返し生成（依存あり）
  F-6, U-5                             # 並行可（独立）

Phase 4 (新規機能) ── 照合ライン
  F-1                                   # 設計 → スキーマ → API → UI
```

---

## 2. Phase 1: セキュリティ修正

### S-1: 月締め/解除APIにADMINロールチェック追加

| 項目 | 内容 |
|------|------|
| 対象ファイル | `app/actions/cashflow-table.ts` |
| 対象関数 | `closeMonth()` (L349), `reopenMonth()` (L390) |
| 問題 | `requireSession()` + `verifyCompanyAccess()` のみで、ロール制限なし |
| 影響 | 認証済みユーザーなら誰でも月締め/解除が可能 |

**修正内容:**

`await verifyCompanyAccess(companyId)` の直後に以下を挿入（両関数とも）:

```typescript
import { getCurrentUserProfile } from "@/app/actions/user-profile"

// closeMonth(), reopenMonth() 内:
const profile = await getCurrentUserProfile()
if (profile?.role !== "ADMIN") {
  throw new Error("月締め操作は管理者のみ実行できます")
}
```

---

### S-2: 科目CRUD APIにADMINロールチェック追加

| 項目 | 内容 |
|------|------|
| 対象ファイル | `app/actions/categories.ts` |
| 対象関数 | `createMidCategory()`, `updateMidCategory()`, `createSubCategory()`, `updateSubCategory()` |
| 問題 | `requireSession()` のみでロール制限なし |
| 影響 | OPERATORが直接API呼出しで科目変更が可能 |

**修正内容:**

```typescript
import { getCurrentUserProfile } from "@/app/actions/user-profile"

async function requireAdmin() {
  const profile = await getCurrentUserProfile()
  if (profile?.role !== "ADMIN") throw new Error("管理者のみ実行できます")
}
```

- 上記4つのmutation関数で `requireSession()` 直後に `await requireAdmin()` を追加
- `getCategories()` は読み取り専用のため変更なし

---

## 3. Phase 2: 小規模修正

### U-6: AuditOperation型に PARTNER_NORMALIZED 追加

| 項目 | 内容 |
|------|------|
| 対象ファイル | `lib/audit-log.ts` (L4-12) |
| 問題 | `normalizePartner()` が使用する `"PARTNER_NORMALIZED"` が型定義に未登録 |

**修正内容:**

```typescript
export type AuditOperation =
  | "CREATE"
  | "UPDATE"
  | "UPDATE_AFTER_CLOSE"
  | "DELETE"
  | "CONFIRM"
  | "UNCONFIRM"
  | "MONTH_CLOSE"
  | "MONTH_REOPEN"
  | "PARTNER_NORMALIZED"   // ← 追加
```

---

### F-2: Transaction スキーマに recurringTemplateId 追加

| 項目 | 内容 |
|------|------|
| 対象ファイル | `prisma/schema.prisma` |
| 問題 | `transactions.ts` L264 が `existing.recurringTemplateId` を参照するがフィールド未定義 |
| 影響 | `isDateException` の自動セットが常に不発 |

**修正内容:**

Transaction モデル (L488付近) に追加:

```prisma
recurringTemplateId String?
recurringTemplate   RecurringTemplate? @relation(fields: [recurringTemplateId], references: [id])
@@index([recurringTemplateId])
```

RecurringTemplate モデルに逆リレーション追加:

```prisma
transactions Transaction[]
```

**マイグレーション:**

```bash
npx prisma migrate dev --name add_recurring_template_id
```

---

### F-5: receivedDate の手修正対応

| 項目 | 内容 |
|------|------|
| 対象ファイル | `app/actions/transactions.ts` (L205-299), `app/(dashboard)/expense-box/page.tsx` |
| 問題 | `updateTransaction` のパラメータに `receivedDate` がなく手修正不可 |
| 要件 | §8「受領日は手修正可」 |

**修正内容:**

**transactions.ts:**

1. データパラメータ型 (L208-222) に追加: `receivedDate?: string | null`
2. 更新データ構築部 (L260付近) に追加:
   ```typescript
   if (data.receivedDate !== undefined) {
     updateData.receivedDate = data.receivedDate ? new Date(data.receivedDate) : null
   }
   ```
3. 月締め後ブロックリストには含めない（メタデータのため変更可）

**expense-box/page.tsx:**

- receivedDate セル (L323-325) をクリック可能な日付入力に変更
- 変更時に `updateTransaction(id, companyId, { receivedDate: value })` を呼出

---

### U-1, U-2: 受領BOXに「支払口座」「計上月」列追加

| 項目 | 内容 |
|------|------|
| 対象ファイル | `app/(dashboard)/expense-box/page.tsx` |
| 問題 | 要件 §3.1 で必要な列がテーブルにない |
| 備考 | データは既にクエリで取得済み（`user-profile.ts` L146-161 で account を include） |

**修正内容:**

テーブルヘッダー (L290-300) に2列追加（「支払方法」の後）:

```tsx
<TableHead>支払口座</TableHead>
<TableHead>計上月</TableHead>
```

テーブルボディに対応セル追加:

```tsx
<TableCell className="text-sm whitespace-nowrap">
  {exp.account?.bankName || "—"}
</TableCell>
<TableCell className="text-sm whitespace-nowrap font-mono">
  {exp.accountingMonth || "—"}
</TableCell>
```

空行の `colSpan` を +2 に更新。

---

### U-3: 資金繰り表に「支払方法」反映

| 項目 | 内容 |
|------|------|
| 対象ファイル | `app/actions/cashflow-table.ts`, `app/(dashboard)/cashflow-table/page.tsx` |
| 問題 | `CashFlowRow` 型に `paymentMethod` フィールドがない |
| 要件 | §9「支払方法を反映」 |

**修正内容:**

**cashflow-table.ts:**

1. `CashFlowRow` 型 (L40-70) に追加: `paymentMethod: string | null`
2. `getCashFlowTable()` 行マッピング (L191付近) に追加: `paymentMethod: tx.paymentMethod`
   （クエリは `include` を使用しておりフィールドは既に取得済み）

**cashflow-table/page.tsx:**

1. `PAYMENT_LABELS` 定数を追加:
   ```typescript
   const PAYMENT_LABELS: Record<string, string> = {
     BANK_TRANSFER: "振込",
     DIRECT_DEBIT: "引落",
     CASH_WITHDRAWAL: "現金",
   }
   ```
2. テーブルヘッダーに「支払方法」列追加
3. 行レンダリングに対応セル追加

---

### U-4: 受領BOXに摘要検索追加

| 項目 | 内容 |
|------|------|
| 対象ファイル | `app/actions/user-profile.ts`, `app/(dashboard)/expense-box/page.tsx` |
| 問題 | 取引先検索はあるが摘要の部分一致検索がない |
| 要件 | §12「取引先・摘要は部分一致」 |

**修正内容:**

**user-profile.ts — `getExpenseBoxItems()`:**

1. フィルタパラメータ型 (L40-51) に追加: `summarySearch?: string`
2. Prisma where句 (L127付近) に追加:
   ```typescript
   if (filters?.summarySearch) {
     where.summary = { contains: filters.summarySearch, mode: "insensitive" }
   }
   ```

**expense-box/page.tsx:**

1. state追加: `const [summarySearch, setSummarySearch] = useState("")`
2. フィルタUIグリッドに入力欄追加:
   ```tsx
   <div className="space-y-1">
     <Label className="text-xs">摘要</Label>
     <Input className="h-8 text-sm" placeholder="部分一致検索"
       value={summarySearch} onChange={(e) => setSummarySearch(e.target.value)} />
   </div>
   ```
3. `loadData` のフィルタオブジェクトに `summarySearch` を追加
4. `useCallback` の依存配列に追加

---

### F-7: 証憑の更新ハイライト表示

| 項目 | 内容 |
|------|------|
| 対象ファイル | `components/evidence-panel.tsx` |
| 問題 | 後日追添付時の視覚的なハイライトがない |
| 要件 | §8「更新ハイライト表示」 |

**修正内容:**

1. ヘルパー関数追加:
   ```typescript
   function isRecentUpload(date: string | Date, hoursAgo = 48): boolean {
     return Date.now() - new Date(date).getTime() < hoursAgo * 3600_000
   }
   ```
2. 証憑アイテム (L147付近) に条件付きハイライト:
   - 背景色: `bg-blue-50 dark:bg-blue-950/30 border-blue-200`
   - 「NEW」バッジをアップロード日の隣に表示

---

## 4. Phase 3: 中規模修正

### F-4: 休日調整ロジック実装

| 項目 | 内容 |
|------|------|
| 新規ファイル | `lib/holidays.ts` |
| 対象ファイル | `app/actions/recurring.ts` |
| 問題 | `holidayAdjust` がスキーマに保存されるが `getDueDate()` で未使用 |
| 要件 | §4.1, §6「休日調整」 |

**新規ファイル: `lib/holidays.ts`**

```typescript
// 日本の祝日マスタ（2025-2028年分をハードコード）
// 固定祝日 + ハッピーマンデー + 春分/秋分（ルックアップテーブル）+ 振替休日

export function getJapaneseHolidays(year: number): Date[]
export function isBusinessDay(date: Date): boolean  // 土日祝を除く
export function adjustForHoliday(
  date: Date,
  mode: "PREV_BUSINESS" | "NEXT_BUSINESS" | "NONE"
): Date
```

実装方針:
- 固定祝日（元日、建国記念の日、天皇誕生日など）はハードコード
- ハッピーマンデー（成人の日、海の日、敬老の日、スポーツの日）は第N月曜計算
- 春分/秋分は年ごとのルックアップテーブル（2025-2030年分）
- 振替休日：祝日が日曜の場合、翌月曜を休日に

**recurring.ts 修正:**

1. `getDueDate()` (L176-193) のシグネチャ変更:
   ```typescript
   function getDueDate(yearMonth: string, dueDayRule: string, holidayAdjust?: string): Date
   ```
2. 日付算出後に `adjustForHoliday(rawDate, holidayAdjust || "NONE")` を適用
3. 呼出元を更新:
   - `generateRecurringTransactions()` L239
   - `autoGenerateRecurringTransactions()` L394

---

### F-3: 繰り返し生成の例外スキップロジック

| 項目 | 内容 |
|------|------|
| 対象ファイル | `app/actions/recurring.ts` |
| 前提 | F-2 (recurringTemplateId) が完了していること |
| 問題 | 生成時にtemplateIdが設定されず、VARIABLE金額のルックアップが不正確 |
| 要件 | §6.2「今月のみ例外フラグを立て、次月以降へは影響させない」 |

**修正内容:**

1. **生成時に `recurringTemplateId` をセット:**
   - `generateRecurringTransactions()` L243-253: `transactionData` に `recurringTemplateId: template.id` 追加
   - `autoGenerateRecurringTransactions()` L417-431: 同上

2. **VARIABLE金額ルックアップの精緻化:**
   - 現在: `partnerId + type + prevMonth` で検索
   - 変更後: `recurringTemplateId + prevMonth` で検索（より正確）

3. **例外フラグの扱い:**
   - 日付: テンプレートの `dueDayRule` から常に算出するため、例外日付は次月に影響しない（既に正しい動作）
   - 金額: `isDateException = true` の前月トランザクションがあっても、次月は通常通り生成（スキップしない）
   - この仕様を明示的にコメントで記載

---

### F-6: 証憑メタ情報の編集・検索UI

| 項目 | 内容 |
|------|------|
| 対象ファイル | `components/evidence-panel.tsx` |
| 新規ファイル | `components/evidence-search.tsx` |
| 問題 | メタ情報のDB・関数は存在するがUIがない |
| 要件 | §8「メタ情報を保持し検索可能にする」 |
| 既存関数 | `updateEvidenceMeta()` (evidence.ts L144), `searchEvidenceByMeta()` (evidence.ts L169) |

**evidence-panel.tsx 修正:**

- 各証憑アイテムに「メタ編集」トグルボタン追加
- 展開時に3フィールド表示:
  - 取引日 (`<Input type="date">`)
  - 取引先名 (`<Input type="text">`)
  - 金額 (`<Input type="number">`)
- 保存ボタンで既存の `updateEvidenceMeta()` を呼出
- state: `editingEvidenceId: string | null`, `metaForm` (3フィールド)

**新規ファイル: `components/evidence-search.tsx`**

- `searchEvidenceByMeta()` を使った検索コンポーネント
- 取引先名で部分一致検索 → 結果リスト表示（取引先名/取引日/金額/紐付きトランザクション）
- 受領BOXページにコラプシブルセクションとして配置

---

### U-5: ページネーションUI実装

| 項目 | 内容 |
|------|------|
| 新規ファイル | `components/pagination.tsx` |
| 対象ファイル | `app/actions/user-profile.ts`, `expense-box/page.tsx`, `expenses/page.tsx` |
| 問題 | APIはページネーション対応済みだがUIが全件取得のまま |
| 要件 | §12「大量件数に耐える」 |
| 既知バグ | `getExpenseBoxItems` L164 の `return` が到達不能コードを生成 |

**バグ修正（最優先）: `app/actions/user-profile.ts` L164-199**

```
現在: L164 で return transactions.map(...) → L199 が到達不能
修正: return を const items = に変更 → L199 の return { data: items, total, totalPages } を有効化
```

**新規ファイル: `components/pagination.tsx`**

- Props: `currentPage: number`, `totalPages: number`, `onPageChange: (page: number) => void`
- shadcn/ui の Button を使用
- 前へ / ページ番号（省略記号対応）/ 次へ ボタン

**expense-box/page.tsx:**

- state追加: `page` (default 1), `totalPages`
- `getExpenseBoxItems` に `page`, `pageSize: 100` を渡す
- レスポンスから `total`/`totalPages` を取得
- フィルタ変更時に `page = 1` にリセット
- テーブル下部に `<Pagination>` コンポーネント配置

**expenses/page.tsx:**

- state追加: `page` (default 1), `total`
- `getTransactions` に `{ page, pageSize: 50 }` を渡す（API対応済み）
- `totalPages = Math.ceil(total / 50)` を算出
- テーブル下部に `<Pagination>` コンポーネント配置

---

## 5. Phase 4: 新規機能

### F-1: 通帳照合点（照合ライン）機能

| 項目 | 内容 |
|------|------|
| 新規ファイル | `app/actions/reconciliation.ts` |
| 対象ファイル | `prisma/schema.prisma`, `cashflow-table.ts`, `cashflow-table/page.tsx` |
| 問題 | 照合ライン機能自体が存在しない |
| 要件 | §2.2「VIEWERは通帳照合点設定が可能」 |

**スキーマ追加: `prisma/schema.prisma`**

```prisma
model ReconciliationCheckpoint {
  id              String   @id @default(cuid())
  companyId       String
  accountId       String
  checkpointDate  DateTime
  yearMonth       String   // "YYYY-MM"
  verifiedBalance BigInt
  verifiedBy      String
  verifiedAt      DateTime @default(now())
  note            String?

  company         Company  @relation(fields: [companyId], references: [id])
  account         Account  @relation(fields: [accountId], references: [id])

  @@unique([accountId, yearMonth, checkpointDate])
  @@schema("fina")
  @@map("reconciliation_checkpoints_fina")
}
```

- Company, Account モデルに逆リレーション追加
- マイグレーション実行

**新規ファイル: `app/actions/reconciliation.ts`**

```typescript
export async function getCheckpoints(companyId, accountId, yearMonth)
export async function createCheckpoint(data: {
  companyId, accountId, checkpointDate, yearMonth, verifiedBalance, note?
})
export async function updateCheckpoint(id, companyId, data)
export async function deleteCheckpoint(id, companyId)
```

権限ルール:
- VIEWER, ADMIN: 作成/更新可能
- OPERATOR: ブロック
- 削除: ADMIN のみ

**cashflow-table.ts 修正:**

- `getCashFlowTable()` の戻り値にチェックポイント配列を追加
- `CashFlowTableData` 型を拡張:
  ```typescript
  checkpoints: {
    id: string
    checkpointDate: string
    verifiedBalance: string
    verifiedBy: string
    verifiedAt: string
    note: string | null
  }[]
  ```

**cashflow-table/page.tsx 修正:**

- 行にチェックポイント一致マーカー表示（色付き下線 + 「照合済」バッジ）
- 残高不一致時の警告表示（`verifiedBalance !== runningBalance` → 差額表示）
- 行アクションに「照合点設定」ボタン追加
  - ダイアログ: 確認残高（`runningBalance` で初期値）、メモ入力
  - 保存で `createCheckpoint()` 呼出
- 既存チェックポイントの編集/削除対応
- VIEWER ロールでも操作可能に（要件定義 §2.2 準拠）

---

## 6. 修正対象ファイル一覧

### 既存ファイル修正

| ファイル | 修正内容 | Phase |
|---|---|---|
| `app/actions/cashflow-table.ts` | ADMINロールチェック + paymentMethod追加 + チェックポイント | 1, 2, 4 |
| `app/actions/categories.ts` | ADMINロールチェック | 1 |
| `lib/audit-log.ts` | PARTNER_NORMALIZED型追加 | 2 |
| `prisma/schema.prisma` | recurringTemplateId + ReconciliationCheckpoint | 2, 4 |
| `app/actions/transactions.ts` | receivedDate対応 | 2 |
| `app/(dashboard)/expense-box/page.tsx` | 列追加 + 摘要検索 + receivedDate編集 + ページネーション | 2, 3 |
| `app/actions/user-profile.ts` | 摘要検索フィルタ + バグ修正(items変数) | 2, 3 |
| `app/actions/recurring.ts` | templateId設定 + holidayAdjust適用 | 3 |
| `components/evidence-panel.tsx` | メタ編集UI + ハイライト | 2, 3 |
| `app/(dashboard)/expenses/page.tsx` | ページネーション | 3 |
| `app/(dashboard)/cashflow-table/page.tsx` | paymentMethod列 + 照合ラインUI | 2, 4 |

### 新規ファイル

| ファイル | 内容 | Phase |
|---|---|---|
| `lib/holidays.ts` | 日本祝日マスタ + 営業日判定 + 休日調整 | 3 |
| `components/pagination.tsx` | 再利用可能ページネーションコンポーネント | 3 |
| `components/evidence-search.tsx` | 証憑メタ情報検索コンポーネント | 3 |
| `app/actions/reconciliation.ts` | 照合チェックポイントCRUD | 4 |

---

## 7. 既知バグ（実装時に合わせて修正）

| ファイル | 行 | 内容 |
|---|---|---|
| `app/actions/user-profile.ts` | L164-199 | `return transactions.map(...)` により L199 が到達不能。`const items =` に変更必要 |
| `app/actions/user-profile.ts` | L123 | `partnerSearch` 設定時に `where.OR` を上書きし、証憑フィルタのOR条件が消失。`where.AND` で結合するよう修正 |

---

## 8. 検証方法

| Phase | 検証内容 |
|---|---|
| Phase 1 | OPERATOR/VIEWERでログインし、月締め・科目変更APIを直接呼出 → エラー返却を確認 |
| Phase 2 | 受領BOXで新列（支払口座/計上月）表示確認、receivedDate編集、摘要検索、資金繰り表で支払方法表示確認 |
| Phase 3 | 繰り返しテンプレートから生成 → 休日調整確認。ページネーションで2ページ目データ取得確認 |
| Phase 4 | VIEWER権限で資金繰り表にログイン → 照合点設定 → 残高不一致時の警告表示確認 |
| 全体 | `npx prisma migrate dev` 成功、TypeScriptコンパイルエラーなし、既存E2Eテスト通過 |
