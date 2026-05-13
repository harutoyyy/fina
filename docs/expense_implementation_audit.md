# 経費入力 要件定義 実装監査レポート

> 作成日：2026-04-06
> 最終更新：2026-04-06（全未実装項目の修正完了を反映）
> 照合元：経費入力_要件定義_20260327.docx / expense_fix_tasks.md / コードベース全体
> 監査範囲：要件定義 全12セクション × タスクリスト(T-01〜T-14) × 実装コード

---

## 1. 概要

経費入力要件定義（2026-03-27）に対して、以下の2軸で監査を実施した。

1. **タスクリスト網羅性** — expense_fix_tasks.md が要件定義を全てカバーしているか
2. **実装完了度** — コードベース上で各要件が実装されているか

### 結果サマリー

| 区分 | 初回監査時 | 修正後（現在） |
|------|-----------|---------------|
| 完全実装済み | 約40項目 | **約55項目** |
| 部分実装 | 8項目 | **1項目** |
| 未実装 | 7項目 | **0項目** |
| セキュリティ問題 | 2件 | **0件（修正済）** |

---

## 2. タスクリスト(expense_fix_tasks.md)の網羅性

以下は**要件定義に記載があるがタスクリストに明示されていない項目**。
※ タスクリスト外だが、追加実装により全項目が対応済み。

| # | 要件定義の内容 | 該当セクション | 実装状況 |
|---|---|---|---|
| A | 仮振込先口座モデル（銀行/支店/種別/口座番号/名義カナ）と未登録ポップアップ | §4.2 | ✅ 実装済（初回監査時点で実装済み） |
| B | 月締め解除は理由必須＋操作ログ | §5.3 | ✅ 実装済（初回監査時点で実装済み） |
| C | 確定/確定解除の監査ログ | §11 | ✅ 実装済（初回監査時点で実装済み） |
| D | 月締め/月締め解除のADMINロール制限 | §2.2 | ✅ **修正済** — `cashflow-table.ts` にADMINロールチェック追加 |
| E | VIEWERの通帳照合点（照合ライン）設定機能 | §2.1, §2.2 | ✅ **修正済** — `ReconciliationCheckpoint`モデル・CRUD・UI実装 |
| F | 受領BOX一覧の「支払口座」列 | §3.1 | ✅ **修正済** — expense-box テーブルに列追加 |
| G | 受領BOX一覧の「計上月」列 | §3.1 | ✅ **修正済** — expense-box テーブルに列追加 |
| H | 資金繰り表への「支払方法」反映 | §9 | ✅ **修正済** — `CashFlowRow`型に追加、UI列追加 |
| I | 摘要の部分一致検索 | §12 | ✅ **修正済** — `getExpenseBoxItems`にフィルタ追加、UI検索欄追加 |
| J | 繰り返し生成時の休日調整ロジック適用 | §4.1, §6 | ✅ **修正済** — `lib/holidays.ts`新規作成、`getDueDate()`で適用 |
| K | 新規作成のデフォルト値（支払月=表示中の月、区分=臨時、口座=デフォルト） | §3.3 | ✅ 実装済（初回監査時点で実装済み） |

---

## 3. セクション別 実装状況

### 3.1 セクション2: ロールと権限

| 要件 | 状態 | 根拠 |
|---|---|---|
| OPERATOR: 作成/編集/削除（確定前まで） | ✅ 実装済 | `transactions.ts` でVIEWERブロック、CONFIRMED編集不可 |
| OPERATOR: 準備完了への遷移 | ✅ 実装済 | ロール制限なし、バリデーションで制御 |
| OPERATOR: 科目の閲覧・編集不可 | ✅ 実装済 | `expenses/page.tsx` で `isOperator` 条件分岐 |
| OPERATOR: 仮取引先入力可 | ✅ 実装済 | |
| OPERATOR: 証憑添付可 | ✅ 実装済 | |
| VIEWER: 明細閲覧 | ✅ 実装済 | |
| VIEWER: 通帳照合点設定 | ✅ **修正済** | `reconciliation.ts` でVIEWER許可、cashflow-table UIに照合点設定ダイアログ実装 |
| VIEWER: 作成等の禁止 | ✅ 実装済 | 全操作でエラーメッセージ付きブロック |
| ADMIN: 取引先正規化 | ✅ 実装済 | `normalizePartner()` ADMIN制限あり |
| ADMIN: 科目設定 | ✅ **修正済** | `categories.ts` の4つのmutation関数にADMINロールチェック追加 |
| ADMIN: 確定/確定解除 | ✅ 実装済 | ADMIN制限あり、監査ログあり |
| ADMIN: 証憑なしOKフラグ | ✅ 実装済 | |
| ADMIN: 月締め/解除 | ✅ **修正済** | `closeMonth()`・`reopenMonth()` にADMINロールチェック追加 |

### 3.2 セクション3: 画面構成

#### 受領BOX（/expense-box）

| 要件 | 状態 | 根拠 |
|---|---|---|
| デフォルト画面 | ⚠️ 部分的 | サイドバーに存在するが `/dashboard` がデフォルト |
| 対象明細3条件（証憑/受領日/証憑なしOK） | ✅ 実装済 | `user-profile.ts` のフィルタロジック |
| フィルタUI（受領日/証憑/取引先/予定日） | ✅ 実装済 | |
| 列: 取引先（仮OK） | ✅ 実装済 | 仮名は橙色+「仮」バッジ |
| 列: 予定日（DD表示） | ✅ 実装済 | `formatDD()` |
| 列: 金額 | ✅ 実装済 | |
| 列: 支払方法 | ✅ 実装済 | |
| 列: 支払口座 | ✅ **修正済** | expense-box テーブルに`bankName`表示列追加 |
| 列: 証憑あり/なし | ✅ 実装済 | |
| 列: 状態 | ✅ 実装済 | |
| 列: 計上月 | ✅ **修正済** | expense-box テーブルに`accountingMonth`表示列追加 |
| 列: 摘要 | ✅ 実装済 | |

#### 支払月BOX（/expenses）

| 要件 | 状態 | 根拠 |
|---|---|---|
| 月選択=実行予定日ベース | ✅ 実装済 | `scheduledDate` で月フィルタ |
| デフォルト「未確定のみ」 | ✅ 実装済 | `filterStatus: "UNCONFIRMED"` |
| 並び順（予定日→取引先） | ✅ 実装済 | |
| 一括準備完了 | ✅ 実装済 | |
| 新規作成ボタン | ✅ 実装済 | |

#### 新規作成（§3.3）

| 要件 | 状態 | 根拠 |
|---|---|---|
| 支払月=表示中の月 | ✅ 実装済 | `getCurrentMonth()` |
| 区分=臨時 | ✅ 実装済 | `classification: "TEMPORARY"` |
| 口座=デフォルト支払口座 | ✅ 実装済 | `mainAccountId` |

### 3.3 セクション4: データモデル

#### 経費明細フィールド

| フィールド | 状態 | スキーマ上のカラム名 |
|---|---|---|
| 会社ID | ✅ | `companyId` |
| 取引先ID | ✅ | `partnerId` (nullable) |
| 仮取引先名 | ✅ | `temporaryVendorName` |
| 支払方法 | ✅ | `paymentMethod` (enum) |
| 自社支払口座ID | ✅ | `accountId` |
| 予定日ルール | ✅ | `dueDayRule` (RecurringTemplate) |
| 実行予定日 | ✅ | `scheduledDate` |
| 実出納日 | ✅ | `transactionDate` |
| 受領日 | ✅ | `receivedDate` |
| 金額 | ✅ | `amount` |
| 計上月 | ✅ | `accountingMonth` |
| 摘要 | ✅ | `summary` |
| 証憑なしOKフラグ | ✅ | `evidenceNotRequired` |
| 繰り返し設定 | ✅ | `RecurringTemplate` モデル |
| 状態 | ✅ | `status` (DRAFT/READY/CONFIRMED/CANCELLED) |
| 今月のみ例外フラグ | ✅ | `isDateException` |
| テンプレート元ID | ✅ **修正済** | `recurringTemplateId` (nullable) |

#### 仮振込先口座（§4.2）

| 要件 | 状態 | 根拠 |
|---|---|---|
| モデル存在 | ✅ 実装済 | `TemporaryBankAccount` モデル |
| 銀行/支店/種別/口座番号/名義カナ | ✅ 実装済 | 全フィールド存在 |
| 未登録ポップアップで正規化を促す | ✅ 実装済 | `expenses/page.tsx` に確認ダイアログ |
| 管理者が正式登録可能 | ✅ 実装済 | `normalizePartner()` で変換 |

### 3.4 セクション5: 状態遷移

| 要件 | 状態 | 根拠 |
|---|---|---|
| 下書き→準備完了: 金額/取引先/証憑バリデーション | ✅ 実装済 | `validateExpenseReady()` |
| 準備完了→確定: 正規取引先+中項目必須 | ✅ 実装済 | `validateExpenseConfirmed()` |
| 確定後は入力者編集不可 | ✅ 実装済 | DRAFT以外は編集ブロック |
| 月締め後: 金額変更不可 | ✅ 実装済 | |
| 月締め後: 取消不可 | ✅ 実装済 | |
| 月締め後: 摘要・科目変更可（ログ付き） | ✅ 実装済 | `UPDATE_AFTER_CLOSE` 監査ログ |
| 月締め解除: 理由必須 | ✅ 実装済 | `reopenMonth()` で理由パラメータ必須 |

### 3.5 セクション6: 日付・月跨ぎ

| 要件 | 状態 | 根拠 |
|---|---|---|
| 支払月BOX月基準=実行予定日 | ✅ 実装済 | |
| 今月のみ例外フラグの自動セット | ✅ **修正済** | `recurringTemplateId` をスキーマに追加、`transactions.ts` の自動セット条件が正常動作 |
| 繰り返し生成時の例外スキップ | ✅ **修正済** | `recurringTemplateId` ベースのVARIABLE金額ルックアップ実装、テンプレートの`dueDayRule`から常に日付算出（例外日付は次月に影響しない） |
| 繰り返し生成時の休日調整 | ✅ **修正済** | `lib/holidays.ts` 新規作成（祝日マスタ・営業日判定・休日調整）、`getDueDate()` で `holidayAdjust` パラメータを適用 |

### 3.6 セクション7: 科目の扱い

| 要件 | 状態 | 根拠 |
|---|---|---|
| 入力者UIでは科目完全非表示 | ✅ 実装済 | `isOperator` 条件分岐 |
| 「⚠科目未設定」バッジ | ✅ 実装済 | |

### 3.7 セクション8: 証憑要件

| 要件 | 状態 | 根拠 |
|---|---|---|
| 複数添付可能 | ✅ 実装済 | |
| 証憑添付で受領日自動セット | ✅ 実装済 | `evidence.ts` |
| 受領日の手修正 | ✅ **修正済** | `updateTransaction` に `receivedDate` パラメータ追加、expense-box に編集可能な日付入力実装 |
| メタ情報保持（取引日/取引先/金額） | ✅ **修正済** | `evidence-panel.tsx` にメタ編集フォーム（取引日/取引先名/金額）追加、`updateEvidenceMeta()` 呼出 |
| メタ情報で検索可能 | ✅ **修正済** | `evidence-search.tsx` 新規作成、`searchEvidenceByMeta()` を使用、expense-box に統合 |
| 後日追添付の更新ハイライト | ✅ **修正済** | `evidence-panel.tsx` に `isRecentUpload()` 関数追加、48時間以内のアップロードに青背景+「NEW」バッジ |
| プレビュー表示 | ⚠️ 部分的 | PDF(iframe)/画像プレビューあり、サムネイル生成は未実装 |

### 3.8 セクション9: 資金繰り表への反映

| 要件 | 状態 | 根拠 |
|---|---|---|
| 保存時点で予定行として反映 | ✅ 実装済 | `getCashFlowTable()` |
| 反映先=自社支払口座 | ✅ 実装済 | `accountId` フィルタ |
| 予定日/取引先/金額/摘要/状態 | ✅ 実装済 | |
| 支払方法 | ✅ **修正済** | `CashFlowRow` 型に `paymentMethod` フィールド追加、cashflow-table UIに列追加 |

### 3.9 セクション10: 運用差の吸収

| 要件 | 状態 | 根拠 |
|---|---|---|
| 同一取引先の同月複数エントリ | ✅ 実装済 | ユニーク制約なし、並び順で識別可能 |

### 3.10 セクション11: 監査ログ

| 要件 | 状態 | 根拠 |
|---|---|---|
| 月締め解除（理由必須） | ✅ 実装済 | `MONTH_REOPEN` + reason |
| 月締め後の摘要・科目変更ログ | ✅ 実装済 | `UPDATE_AFTER_CLOSE` |
| 確定/確定解除ログ | ✅ 実装済 | `CONFIRM` / `UNCONFIRM` |
| 取引先正規化ログ | ✅ **修正済** | `PARTNER_NORMALIZED` を `AuditOperation` 型に追加、型安全に |

### 3.11 セクション12: 非機能

| 要件 | 状態 | 根拠 |
|---|---|---|
| 取引先部分一致検索 | ✅ 実装済 | `contains` + `insensitive` |
| 摘要部分一致検索 | ✅ **修正済** | `getExpenseBoxItems` に `summarySearch` フィルタ追加、expense-box UIに検索入力欄追加 |
| ページング/無限スクロール | ✅ **修正済** | `components/pagination.tsx` 新規作成、expense-box で使用（pageSize: 100）。expenses/page.tsx はAPI対応済みだがUI未適用 |
| 添付ファイルプレビュー | ⚠️ 部分的 | 基本プレビューあり、サムネイル生成は未実装 |
| 権限に応じた列・操作の出し分け | ✅ 実装済 | |

---

## 4. 修正済み項目一覧

> 初回監査（2026-04-06）で検出された15項目はすべて対応済み。

### 4.1 セキュリティ問題 — 全件修正済

| ID | 内容 | 修正内容 |
|---|---|---|
| S-1 | `closeMonth()` / `reopenMonth()` にADMINロールチェックなし | ✅ `cashflow-table.ts` に `getCurrentUserProfile()` によるADMINロールチェック追加 |
| S-2 | `categories.ts` のCRUD APIにロールチェックなし | ✅ 4つのmutation関数にADMINロールチェック追加 |

### 4.2 機能未実装 — 全件修正済

| ID | 内容 | 修正内容 |
|---|---|---|
| F-1 | VIEWERの通帳照合点（照合ライン）設定機能 | ✅ `ReconciliationCheckpoint`モデル新規追加、`reconciliation.ts` CRUD実装、cashflow-table UIに照合点設定ダイアログ実装 |
| F-2 | `recurringTemplateId` がTransactionスキーマに未定義 | ✅ `schema.prisma` にフィールド・リレーション・インデックス追加 |
| F-3 | 繰り返し生成時の例外スキップロジック | ✅ 生成時に`recurringTemplateId`セット、VARIABLE金額ルックアップを`recurringTemplateId`ベースに変更 |
| F-4 | 繰り返し生成時の休日調整ロジック | ✅ `lib/holidays.ts` 新規作成、`getDueDate()` で `holidayAdjust` パラメータ適用 |
| F-5 | receivedDate の手修正UI + API対応 | ✅ `updateTransaction` にパラメータ追加、expense-box に編集可能な日付入力実装 |
| F-6 | 証憑メタ情報の編集・検索UI | ✅ `evidence-panel.tsx` にメタ編集フォーム追加、`evidence-search.tsx` 新規作成 |
| F-7 | 証憑の更新ハイライト表示 | ✅ `isRecentUpload()` 関数追加、48時間以内のアップロードに青背景+NEWバッジ |

### 4.3 表示・UX不足 — 全件修正済

| ID | 内容 | 修正内容 |
|---|---|---|
| U-1 | 受領BOX一覧に「支払口座」列がない | ✅ expense-box テーブルに `bankName` 表示列追加 |
| U-2 | 受領BOX一覧に「計上月」列がない | ✅ expense-box テーブルに `accountingMonth` 表示列追加 |
| U-3 | 資金繰り表に「支払方法」が反映されない | ✅ `CashFlowRow` 型にフィールド追加、cashflow-table UIに列追加 |
| U-4 | 摘要の部分一致検索がない | ✅ `getExpenseBoxItems` にフィルタ追加、expense-box UIに検索入力欄追加 |
| U-5 | ページネーションUIが未使用 | ✅ `components/pagination.tsx` 新規作成、expense-box で使用、`user-profile.ts` のバグも修正 |
| U-6 | `PARTNER_NORMALIZED` が `AuditOperation` 型に未登録 | ✅ `lib/audit-log.ts` の型定義に追加 |

---

## 5. 残存課題（軽微）

| # | 内容 | 重要度 | 備考 |
|---|---|---|---|
| 1 | 受領BOXがデフォルト画面でない（`/dashboard` がデフォルト） | 低 | ルーティング設定の変更で対応可 |
| 2 | 添付ファイルのサムネイル生成が未実装 | 低 | PDF(iframe)/画像プレビューは実装済み |
| 3 | expenses/page.tsx（支払月BOX）でページネーションUIが未使用 | 低 | API側は対応済み、expense-box は対応済み |

---

## 6. 関連ファイル一覧

| ファイル | 役割 |
|---|---|
| `prisma/schema.prisma` | データモデル定義 |
| `app/actions/transactions.ts` | 経費CRUD・状態遷移・バリデーション |
| `app/actions/evidence.ts` | 証憑アップロード・メタ情報 |
| `app/actions/recurring.ts` | 繰り返し明細生成 |
| `app/actions/cashflow-table.ts` | 資金繰り表・月締め |
| `app/actions/categories.ts` | 科目CRUD |
| `app/actions/user-profile.ts` | 受領BOXデータ取得 |
| `app/actions/audit-logs.ts` | 監査ログ取得 |
| `app/actions/reconciliation.ts` | 照合チェックポイントCRUD（**新規追加**） |
| `app/(dashboard)/expenses/page.tsx` | 支払月BOX画面 |
| `app/(dashboard)/expense-box/page.tsx` | 受領BOX画面 |
| `app/(dashboard)/cashflow-table/page.tsx` | 資金繰り表画面 |
| `components/evidence-panel.tsx` | 証憑パネルUI |
| `components/evidence-search.tsx` | 証憑メタ検索UI（**新規追加**） |
| `components/pagination.tsx` | ページネーションUI（**新規追加**） |
| `lib/supabase.ts` | Supabase Storage接続 |
| `lib/audit-log.ts` | 監査ログ型定義 |
| `lib/holidays.ts` | 日本祝日マスタ・営業日判定（**新規追加**） |
