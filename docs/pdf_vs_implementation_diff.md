# PDF「経理くん 開発地図」 vs fina実装 差分マッピング

**対象PDF**: `mp2frkkt-経理システム構想.pdf`（全10ページ、手書き構想スケッチ）
**対象実装**: 本リポジトリ (Next.js + Prisma + Supabase)
**作成日**: 2026-05-12

凡例: ✅ 実装済み / △ 部分実装・要確認 / ❌ 未実装

---

## 全体像

- PDF全10枚は識別可能。タイトル「経理くん 開発地図」。
- 主要画面・機能セットは Phase 1〜3 完了時点で実装網羅。
- 残課題は「DX外部API連携（仕様未定）」「借入計算式の精密検証」「取引先のグループ共通化」など仕様未定・優先度低の項目のみ。
- PDFはあくまで初期構想スケッチ。詳細要件は `docs/requirements.md` の方が踏み込んでいる。

---

## ページ別 差分マッピング

### 📄 P1: オールメニュー・ダッシュボード・資金繰表・経費入力

| PDF構想 | 状況 | 根拠／メモ |
|---|---|---|
| サイドメニュー（経理くん配下の各画面） | ✅ | `components/app-sidebar.tsx` |
| ダッシュボード：会社グループタイル（A工業/Aグループ/A建設/W広告/C広告/G会社 等） | ✅ | Phase 2 で実装。`getGroupDashboardSummary` で「全社合計」＋グループ別タイルを月別表示 (`app/(dashboard)/dashboard/page.tsx`) |
| 確定線以降の支払予定 3〜5行 | △ | `app/actions/dashboard.ts` L86 前3+後5。「確定線基準」ではなく日付基準 |
| 資金繰表：会社/銀行/月フィルター | ✅ | `cashflow-table/page.tsx` L797-820 |
| 種別（資金移動/振込/引落/入金/現金） | ✅ | 同 L88-93 `PAYMENT_LABELS` |
| 確定線（手動） | ✅ | 「照合点」として実装 (`app/actions/reconciliation.ts`、Landmarkアイコン) |
| ダブルクリックで編集 | ✅ | `cashflow-table/page.tsx` L176 |
| 同日同時ルール（引落＞資金移動・振込・現金＞入金） | ❌ | `app/actions/cashflow-table.ts` は displayOrder + date のみ |
| ドラッグ&ドロップ並べ替え＋日付変更ポップアップ | ✅ | dnd-kit, L1030 |
| 残高即時再計算 | ✅ | runningBalance 計算 |
| 帳票作成（資金移動・現金 → PDF） | △ | `window.print()` のみ、PDFテンプレなし |

### 📄 P1下〜P2: 経費入力・経費一覧

| PDF構想 | 状況 | 根拠／メモ |
|---|---|---|
| 単票入力：予定日/実日付/相手先/内容/種別/金額/口座/科目/補助 | ✅ | `expenses/page.tsx` L138-168 |
| 振込/引落/資金移動/現金 + 固定/変動/臨時/定期 | ✅ | classification, paymentMethod（定期はテンプレ機能で代替） |
| 1経費入力で金額追加（家賃＋引落手数料） | △ | `TransactionDetail` 対応あり、UI限定 |
| PDF添付 / 帳票添付 | ✅ | `app/actions/evidence.ts` (Supabase Storage) |
| 毎月リセット動作 | ❌ | リセットロジックなし |
| 経費一覧タブ：未確定/確認待ち/完了 | △ | 状態(DRAFT/READY/CONFIRMED)＋区分タブ。「未入力フラグ」は明示なし |
| 取引先登録はグループ共通 | ❌ | `prisma/schema.prisma` L320 `TradingPartner.companyId` で会社別分離 |
| 登録者・登録日・更新日記録 | △ | createdAt/updatedAt はあるが登録者なし |
| 経費確定BOX（権限制限版） | ✅ | `expense-box/page.tsx` |

### 📄 P3〜P4: 売上入力

| PDF構想 | 状況 | 根拠／メモ |
|---|---|---|
| 売上一覧（実入金日/予定/元請/請求/入金/差額） | ✅ | `sales/page.tsx` L456 |
| 差額内訳（手数料/会費/現場経費/立替/値引値上/前倒/保留金） | ✅ | `components/deduction-details-panel.tsx` |
| 内訳の前回値自動反映 | △ | 要件定義書では「項目のみ前月自動コピー」記載あり、実装要確認 |
| 資金繰表へ展開表示（差額内訳を子行で） | △ | 子明細あり、UI展開要確認 |
| DXより出力（売上） | ❌ | DX連携未実装 |
| DX外売上手入力（地代/雑/派遣） | ❌ | 業種別集計の仕組みなし |
| Aグループ売上一覧（A工業と同形式） | ❌ | グループ会社の親概念がスキーマに無い |
| グループ売上（双方の会社に自動反映） | ❌ | – |
| 業種フィルター（建設/広告/その他） | △ | `Company.industryType` に文字列、フィルタUIなし |

### 📄 P5: 原価支払

| PDF構想 | 状況 | 根拠／メモ |
|---|---|---|
| 原価一覧（人工/法定福利/交通費/諸経費/材料費/消費税/差引/控除等） | △ | `Transaction.details` 保存、UI列固定の特化は弱い |
| 下請支払（DXより） | ❌ | DX連携なし |
| 控除内訳（会費/保険料/現場経費/立替代/その他、デフォルト登録） | △ | DeductionDetailsPanel あり、デフォルト分類は弱い |
| 作業員給与は給与入力から反映 | △ | 給与モジュールあり、自動反映ロジック要確認 |
| グループ会社支払 → グループ間入力で | ❌ | グループ間入力メニュー自体なし |
| 内訳（道具代/貸金/家賃 などのデフォルト相手先・科目） | △ | 汎用入力で対応、特化UIなし |

### 📄 P6: 給与入力

| PDF構想 | 状況 | 根拠／メモ |
|---|---|---|
| 会社×月フィルタ、給与一覧 | ✅ | `salary/page.tsx` L430 |
| DXより出力 | ❌ | DX連携なし |
| 丸っとExcel飲み込み（インポート） | ✅ | `components/salary-excel-import.tsx` |
| 個人入力不要（給与グループ単位） | ✅ | `payroll-groups` マスタ |
| 給与未確定 考え中（構想メモ） | – | – |

### 📄 P7: グループ間入力

| PDF構想 | 状況 | 根拠／メモ |
|---|---|---|
| 専用メニュー「グループ間入力」（売上/原価/経費/貸借） | ✅ | Phase 3 で実装。`/inter-group` ページ + サイドバーメニュー追加 |
| 支払会社で入力、入金側自動反映 | ✅ | `createInterGroupTransaction` で出金側を作成 → 受取側に `linkedTransactionId` で連動レコード自動生成。編集・削除も双方向同期 |
| 「会社→会社」追加、背景色で判別 | ✅ | 支払/受取側を Badge で色分け表示 |
| グループ間貸借の単独集計、資金繰表ではグループ借入で±表現 | △ | グループ間取引は `TRANSFER` + `fundTransfer.counterCompanyId` で識別可能、集計画面は未実装 |
| 入力内容は前月値反映（経費は固定/変動/臨時踏襲） | △ | 定期テンプレ (`recurring/page.tsx`) でカバー可 |

### 📄 P8: 借入管理

| PDF構想 | 状況 | 根拠／メモ |
|---|---|---|
| 借入一覧、月別残高 | ✅ | `loans/page.tsx` L481 |
| 設定画面：返済方法/頻度/返済日/回数/金利タイプ/金利%/元金調整 | ✅ | L237-377 |
| 保証協会チェックボックス | ❌ | – |
| 適用日付以降のみ変更（経過分は再計算しない） | △ | ロジック要確認 |
| 月返済額：自動計算＋手入力可、`借入額 ÷ 回数 = 100未満切捨 返済額 × (回数-1) = 元金調整額` | △ | スケジュール生成あり、計算式は要確認 |
| カレンダー自動読込（祝前祝後設定） | △ | `lib/holidays.ts` あり、UI連携要確認 |
| 会社別一覧（フィルタ：銀行/保証無有、項目多数）、PDF印刷 | ✅ | Phase 3 で実装。詳細ダイアログに「印刷/PDF」ボタン追加、別ウィンドウで A4 印刷用HTMLを開く |
| 返済シミュレーション（利息込、月別マトリクス） | △ | スケジュールはあるが横断マトリクスUIなし |

### 📄 P9: リース・納税予定表・定期支払・カード明細

| PDF構想 | 状況 | 根拠／メモ |
|---|---|---|
| リース一覧（代表/車/その他フィルタ、月別年額） | △ | 基本一覧のみ、車種分類フィールドなし (`leases/page.tsx`) |
| リース設定（定額/残クレ/回数、再リース、毎月支払日カレンダー読込） | △ | 基本項目のみ |
| 車のみ支払シミュレーション（車種/NO × 月別） | ✅ | Phase 3 で実装。`getVehicleLeaseMatrix` + `VehicleMatrixDialog` で車両分類リースの月別マトリクスを表示（行=契約・列=月・合計列・月合計行付き） |
| **納税予定表** | ✅ | Phase 2 で実装。`/tax-schedule` ページ + `TaxPaymentSchedule` テーブル + 中間納税自動生成 |
| 法人税/消費税 中間納税自動計算（20万/48万/400万閾値） | ✅ | `generateInterimTaxSchedules` で前年税額から判定（法人税 20万、消費税 48万/400万/4800万） |
| 定期支払（固定資産税/労働保険料） | △ | 経費の定期テンプレで代用可 (`recurring/page.tsx`)。`TaxPaymentSchedule.taxType = FIXED_ASSET` も可 |
| カード明細（交際費、美枝さんExcel） | ✅ | Phase 2 で実装。`/card-statements` ページ + `CreditCard` / `CardStatement` テーブル + Excel取込 + 引落取引へ転記 |

### 📄 P10: マスタ登録

| PDF構想 | 状況 | 根拠／メモ |
|---|---|---|
| 1. 会社マスタ（社名/略称/業種/決算月/口座/住所/代表者/法人番号/インボイス番号） | ✅ | `master/companies` |
| 2. 銀行マスタ（銀行・支店） | ✅ | `master/banks` |
| 3. 業種マスタ（建設/広告/その他、追加可） | ❌ | テーブルなし、`Company.industryType` の文字列のみ |
| 4. 種別設定（資金移動/振込/引落/入金/現金 + 固定/変動/臨時/定期） | ✅ | enum 実装あり、UIの種別マスタ画面はない |
| 売上原価内訳マスタ（「いらない」とメモあり） | – | – |
| 5. 結合グループ | ✅ | Phase 2 で実装。`/master/company-groups` ページ + `CompanyGroup` / `CompanyGroupMember` テーブル |
| 6. 借入・リース（プルダウン連動） | △ | 部分 |
| 7. 勘定科目・補助科目（3階層） | ✅ | `master/categories` |
| 8. ユーザー設定 | △ | `UserProfile` はあるがUI要確認 |
| 売上項目メタ（◯◯売上、対象会社チェック） | ✅ | Phase 3 で実装。`SalesItemMaster` テーブル + `/master/sales-items` ページ。対象会社チェックボックス（空=全社対象）、デフォルト区分、有効/無効、表示順管理 |

---

## 主要ギャップ（残課題、優先度高い順）

Phase 1〜3 でほぼ全項目を実装済み。残るのは仕様未定・優先度低の項目のみ。

1. **DX外部API連携** — 売上/原価/給与は Excel/CSV 取込で代替実装済み（Phase 2）。本物のDXシステムAPI連携は仕様未定のため未実装。
2. **借入計算式の精密検証** — PDF P8。`借入額 ÷ 回数 = 100未満切捨 返済額 × (回数-1) = 元金調整額` の計算式と実装の照合は未確認。
3. **資金繰表の確定線基準ロジック** — PDF P1。確定線（照合点）以降の支払予定 N行表示は現状「日付基準で前3+後5」のため、要件に応じて「照合点基準」に調整可能。
4. **取引先のグループ共通化** — PDF P2。現状 `TradingPartner.companyId` で会社別分離。グループ単位で共通化したい場合はスキーマ変更が必要。
5. **作業員給与の原価への自動反映** — PDF P5。給与モジュールと原価モジュールの自動連携ロジック要確認。

## 強み（PDFを超えて先行している部分）

- **照合点（確定線）機能** — `app/actions/reconciliation.ts`
- **経費確定BOX（権限制限）** — 要件定義追補で確定し実装済
- **証憑PDF添付（Supabase Storage）** — `app/actions/evidence.ts`
- **月次処理（月締め/解除、過去12ヶ月残高管理）** — 実装済
- **現金引出＋金種表** — `schema.prisma` `CashWithdrawal` 関連

---

## 関連ドキュメント

- `docs/requirements.md` — 詳細要件定義（PDFより踏み込んだ最新仕様）
- `docs/db_design.md` — DB設計
- `docs/expense_implementation_audit.md` — 経費機能の実装監査
- `docs/expense_implementation_plan.md` — 経費機能の実装計画
- `経理くん_操作マニュアル.md` — 操作マニュアル

---

## Phase 1 実装履歴（2026-05-12）

差分マッピング中の「小粒項目」を実装済み。

| 項目 | 該当ファイル |
|---|---|
| P1: 同日同時ルール（引落>振込/移動/現金>入金） | `app/actions/cashflow-table.ts` `paymentPriority` 関数追加、`getCashFlowTable` で同日内ソート |
| P5/P7: 売上控除内訳の前月項目自動コピー | `components/deduction-details-panel.tsx` で空時に `copyPreviousDeductions` 自動呼出 |
| P8: 借入「保証協会」フラグ | `LoanContract.isGuaranteeAssociation` カラム追加、`loans` ページに Checkbox + 一覧 Badge |
| P9: リース「車種分類」 | `LeaseContract.assetCategory/vehicleModel/vehicleNumber` 追加、`leases` ページに分類セレクト + フィルタ |
| P10-3: 業種マスタ | `IndustryMaster` モデル追加、`/master/industries` 画面新設、`Company.industryMasterId` でFK化 |

**Migration**: `prisma/migrations/20260512095307_phase1_industry_loan_lease/migration.sql`
適用方法: `npx prisma migrate deploy` または開発時は `npx prisma migrate dev`。

## Phase 2 実装履歴（2026-05-12）

主要4テーマを実装済み。Migration: `prisma/migrations/20260512100000_phase2_tax_card_group/migration.sql`。

| 項目 | 該当ファイル |
|---|---|
| P9: 納税予定表ページ＋テーブル | `app/(dashboard)/tax-schedule/page.tsx`, `app/actions/tax-schedule.ts`, `prisma/schema.prisma` (`TaxPaymentSchedule`) |
| P9: 中間納税自動生成（法人税 20万 / 消費税 48万・400万・4800万 閾値） | `generateInterimTaxSchedules` 関数 |
| P9: カード明細インポート（Excel/CSV取込、重複排除、引落取引へ転記） | `app/(dashboard)/card-statements/page.tsx`, `app/actions/card-statements.ts`, `prisma/schema.prisma` (`CreditCard`, `CardStatement`) |
| P3-5: 売上・原価 Excel/CSV 取込（DX連携代替） | `components/transaction-excel-import.tsx`, `app/actions/transaction-import.ts`, `prisma/schema.prisma` (`ImportBatch`) |
| P1: 会社グループ概念 | `prisma/schema.prisma` (`CompanyGroup`, `CompanyGroupMember`), `app/actions/company-groups.ts` |
| P1: ダッシュボード会社グループタイル（全社サマリ＋グループ別） | `app/(dashboard)/dashboard/page.tsx` + `getGroupDashboardSummary` |
| P10-5: 会社グループマスタ画面 | `app/(dashboard)/master/company-groups/page.tsx` |
| サイドバー: 納税予定表/カード明細/会社グループ メニュー追加 | `components/app-sidebar.tsx` |

**取込列仕様**
- 売上: `予定入金日 / 元請会社名 / 請求金額`（任意: `実入金日 / 実入金金額 / 摘要`）
- 原価: `予定支払日 / 支払先 / 計上額`（任意: `実支払日 / 振込額 / 摘要`）
- カード明細: `利用日 / 利用店名 / 金額`（任意: `カテゴリ / 摘要`）

**取引先**は名前一致で既存マスタとリンク、未登録なら自動作成（売上 → CUSTOMER、原価 → SUBCONTRACTOR）。
**重複排除**はカード明細のみ実装（`{cardId, statementDate, storeName, amount}` のハッシュ）。

## Phase 3 実装履歴（2026-05-12）

Phase 2 候補の残項目をまとめて実装。Migration: `prisma/migrations/20260512110000_phase3_sales_items/migration.sql`。

| 項目 | 該当ファイル |
|---|---|
| P7: グループ間入力メニュー（双方向自動反映） | `app/(dashboard)/inter-group/page.tsx`, `app/actions/inter-group.ts` |
| P7: 出金/入金 Transaction の双方向同期（作成・編集・削除） | `createInterGroupTransaction` / `updateInterGroupTransaction` / `deleteInterGroupTransaction` |
| P7: 同一グループ会社のフィルタ | `ensureSameGroup` / `getGroupCompaniesFor` |
| P8: 借入契約 PDF 印刷（別ウィンドウで A4 印刷HTML） | `app/(dashboard)/loans/page.tsx` `printLoanContract` 関数 |
| P9: 車両支払シミュレーションマトリクス（契約 × 月） | `app/actions/leases.ts` `getVehicleLeaseMatrix`, `app/(dashboard)/leases/page.tsx` `VehicleMatrixDialog` |
| P10: 売上項目メタマスタ（対象会社チェック付き） | `prisma/schema.prisma` (`SalesItemMaster`), `app/actions/sales-items.ts`, `app/(dashboard)/master/sales-items/page.tsx` |
| サイドバー: グループ間入力 / 売上項目マスタ メニュー追加 | `components/app-sidebar.tsx` |

**グループ間入力の仕様**
- 「支払会社で入力 → 受取会社側に自動でミラー取引生成」
- 支払会社・受取会社は同一 `CompanyGroup` に所属している必要あり（`ensureSameGroup` で検証）
- 内部的には `TRANSFER` 型 Transaction × 2 + `fundTransfer.counterCompanyId` で会社間連携を表現
- 編集・削除はどちらか一方から行え、相手側も同期される
- 一覧画面は出金側のみ表示（受取側はミラーなので重複しない）

**車両支払シミュレーション**
- `assetCategory='VEHICLE'` のリース契約のみが対象
- 開始月〜終了月の範囲で `LeaseSchedule.dueDate` を集計
- 行=契約・列=月・右端に契約別合計列・下端に月合計行・右下に総合計

**売上項目メタマスタ**
- `applicableCompanyIds` をカンマ区切り文字列で保持（空=全社対象）
- `getSalesItemsForCompany(companyId)` で会社別の利用可能項目を取得可能
- 管理者のみ編集可
