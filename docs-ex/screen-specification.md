# fina 画面仕様書 (Screen Specification)

経理くん (fina) の全画面の **UI 構成・機能・業務ルール・データ連携** を 1 ファイルに集約した仕様書。

> 📌 **docs-ex/ 全体のドキュメント役割分担は [`README.md`](README.md) を参照。**
> - ファイル参照表 → [`page-source-map.md`](page-source-map.md)
> - 画面ごとの深掘り (フォーム項目・エラー文・行番号付き) → [`screen-details.md`](screen-details.md)

最終更新: 2026-05-18

---

# 第Ⅰ部 横断仕様 (全画面共通)

## 1. ステータス遷移パターン

すべての取引系画面 (経費 / 売上 / 原価 / 給与 / 借入 / リース) は以下の共通遷移を持つ。

```
DRAFT (下書き) ──[準備完了]──> READY (確認待ち) ──[管理者確定]──> CONFIRMED (確定済)
       ↑                                                                  │
       └────────────[月締め解除でロールバック可能]──────────────────┘

(取消) CANCELLED ← 任意ステータス (月締め前のみ)
```

| ステータス | 内部キー | 説明 | 表示色 |
|---|---|---|---|
| 下書き | `DRAFT` | 入力途中 | outline (灰) |
| 準備完了 | `READY` | 入力完了・確定待ち | secondary (青) |
| 確定済 | `CONFIRMED` | 月締めで確定 | default (緑) |
| 取消済 | `CANCELLED` | 取消された | destructive (赤) |

### 1.1 各画面での確定条件

| 画面 | 準備完了 (DRAFT→READY) | 確定 (READY→CONFIRMED) |
|---|---|---|
| 経費 | 金額 + 取引先 + 証憑添付 (or 不要フラグ) | + 中項目必須 |
| 売上 | 請求の入力完了 (請求確定: 入力者可) | 入金・控除完了 (ADMIN, 差額=控除合計) |
| 原価 | 計上額 + 振込額 入力 | 全額支払完了 + 差額=控除合計 (ADMIN) |
| 給与 | 整合チェック OK (3 式一致) | 給与管理者ロール |
| 借入 | (即 CONFIRMED) | ADMIN による契約作成・支払済マーク |
| リース | 同上 | 同上 |

## 2. 権限制御マトリクス

| 画面カテゴリ | ADMIN | OPERATOR | VIEWER |
|---|---|---|---|
| 全画面 表示 | ✅ | ✅ (自社のみ) | ✅ |
| マスタ編集 | ✅ | ❌ | ❌ |
| 取引 新規/編集 | ✅ | ✅ | ❌ |
| 取引 確定 (CONFIRMED) | ✅ | ❌ | ❌ |
| 月締め / 解除 | ✅ | ❌ | ❌ |
| 帳票作成 | ✅ | ✅ | ✅ |
| FB データ出力 | ✅ | ❌ | ❌ |
| 監査ログ閲覧 | ✅ | ❌ | ❌ |
| 通帳照合点 | ✅ | ✅ | ✅ |

### 2.1 OPERATOR (経費入力者) の制約

- 自社のみ閲覧可能
- **口座残高や資金繰り表全体は閲覧不可** (PDF 要件)
- 代替として「経費入力 → 受領BOX タブ」で **自分の担当分のみ** が表示される
- 中項目 (科目) 未入力でも準備完了は可能

## 3. 月締めロック仕様

`MonthClose.isClosed = true` の月 + 会社の組合せでは以下を制御:

| 操作 | 月締め前 | 月締め後 |
|---|---|---|
| 金額変更 | ✅ | ❌ `月締め後は金額変更できません` |
| 口座変更 | ✅ | ❌ |
| 日付変更 | ✅ | ❌ |
| 支払方法変更 | ✅ | ❌ |
| **摘要・科目変更** | ✅ | ✅ (`UPDATE_AFTER_CLOSE` で監査ログ記録) |
| 取消 (CANCELLED) | ✅ | ❌ `月締め後は取消できません` |
| 新規入力 | ✅ | ❌ |
| 月締め解除 (ADMIN, 理由必須) | — | ✅ |

月締め / 解除は `app/actions/cashflow-table.ts` の `closeMonth` / `reopenMonth` で実行。`AuditLog (operation=MONTH_CLOSE / MONTH_REOPEN)` を生成。

## 4. 取引の親子構造

[`prisma/schema.prisma`](../prisma/schema.prisma) の `Transaction` モデル:

```
Transaction (親)
  ├── parentId = null
  ├── 通帳に出る1回の動き
  └── 金額 = 子明細合計 (自動算出)

Transaction (子)
  ├── parentId = <親のid>
  ├── 請求書単位 / 控除 / 案件単位 / 科目単位
  └── 個別の金額・科目を保持

TransactionDetail (孫)
  ├── transactionId = <親 or 子のid>
  └── 内訳行 (人工/法福/材料/控除 等)
```

### 4.1 親子構造の主な用途

| 種別 | 親 | 子 |
|---|---|---|
| 売上 | 請求 (`invoiceDate`, `amount`) | 入金 (`transactionDate`, `accountId`) — 分割可 |
| 原価 | 計上 (`recordedAmount`, 控除前) | (なし。`transferAmount` で実支払を保持) |
| 経費 | 1 明細 = 親 (子なし) | — |
| 給与 | (SalaryEntry を別モデルで保持) | — |
| カード | 引落 (集約) | 各利用明細 (TransactionDetail) |

## 5. 同日同時ルール (paymentPriority)

[`app/actions/cashflow-table.ts:102-118`](../app/actions/cashflow-table.ts#L102) で実装。同じ `scheduledDate` 内の並び順を機械的に確定:

| 優先度 | 種別 / 支払方法 |
|---|---|
| 0 (上) | `DIRECT_DEBIT` (引落) |
| 1 (中) | `TRANSFER` 種別 / `BANK_TRANSFER` / `CASH_WITHDRAWAL` (振込・資金移動・現金) |
| 2 (下) | 上記以外 (= 入金) |

## 6. グループ間取引のペア構造

`Transaction.linkedTransactionId` で双方向リンク:

```
Transaction A (会社X 出金) {
  type=EXPENSE / COST_PAYMENT,
  amount=-X, linkedTransactionId=<Bのid>
}
Transaction B (会社Y 入金) {
  type=SALES, amount=+X,
  linkedTransactionId=<Aのid>
}
```

- 一方を削除 → 相手も連動削除
- 一方を編集 → 相手も連動更新
- 資金繰り表で **紫の左ボーダー + G間 バッジ** で表示

## 7. 自動仕訳ルール (給与控除 → 勘定科目)

`SalaryJournalMapping` で控除項目 → 勘定科目の固定マッピングを管理:

| 控除項目 | 大項目 | 中項目 | 小項目 | 区分 |
|---|---|---|---|---|
| 家賃控除 | 販管費 | 地代家賃 | 地代家賃 | 固定 |
| 通信費控除 | 販管費 | 通信費 | 通信費 | 変動 |
| 立替経費 | 販管費 | 立替金 | 立替金 | 変動 |
| 印紙/在庫品 | 販管費 | 消耗品費 | 消耗品費 | 変動 |
| 光熱費控除 | 販管費 | 水道光熱費 | 水道光熱費 | 変動 |
| 保険料控除 | 販管費 | 保険料 | 保険料 | 固定 |
| 交通費 | 販管費 | 旅費交通費 | 旅費交通費 | 変動 |
| 社会保険料 (合算) | その他費用 | 社会保険積立 | 給与預かり分 | 定期 |
| 源泉納税 (合算) | その他費用 | 源泉所得税 | 給与預かり分 | 定期 |
| 貸金/立替金 | その他費用 | 貸金/立替金 | 給与預かり分 | 変動 |
| 積立金 | その他費用 | 消費税積立 | 給与預かり分 | 定期 |
| WINNERS立替営業交通費 | 売上原価 | 旅費交通費 | 旅費交通費 | 変動 |

## 8. 仮想口座 (社会保険・消費税)

各会社に自動付与される 2 種の仮想口座:

| accountType | 用途 | 自動入金 |
|---|---|---|
| `SOCIAL_INSURANCE_RESERVE` | 社会保険積立 | 課税支給 × **15%** を給与準備完了時に振替 |
| `CONSUMPTION_TAX_RESERVE` | 消費税積立 | 課税支給 × **10%** を給与準備完了時に振替 |

- 通常は資金繰り表上で非表示
- フィルタ/表示切替で表示可能
- 残高はレポートで参照可能

## 9. 証憑添付フロー (Supabase Storage)

経費入力等の証憑 PDF は Supabase Storage に保存。

```
[ユーザー操作]              [Server Action]                    [Supabase Storage]
   ファイル選択
       ↓
   uploadEvidence ──────> getUploadUrl(transactionId, fileName)
                                 ↓
                          署名付きアップロード URL 発行 ──────> 直接 PUT
                                 ↓
                          Evidence レコード作成
                          (filename, fileUrl, transactionId)

   閲覧時:
   getEvidenceViewUrl(evidenceId) ──────> 署名付き閲覧 URL 発行
```

`Evidence` モデル: `id, transactionId, filename, fileUrl, mimeType, fileSize, uploadedAt, uploadedBy`

## 10. BigInt 金額・符号ルール

- 全金額は `BigInt` (Prisma) / `String` (JSON シリアライズ時)
- 単位: **円** (小数点なし)
- 符号:
  - 収入 (売上高、営業外収益) = **正値**
  - 支出 (原価、経費、給与等) = **負値**
- 資金繰り表での表示:
  - 入金列: 正値の絶対値
  - 支払列: 負値の絶対値
  - 残高: `期首残高 + Σamount` (符号付き加算)

## 11. 監査ログ (AuditLog)

`AuditLog` モデルで以下の操作を自動記録:

| operation | 発生タイミング |
|---|---|
| `CREATE` | 取引・マスタの新規作成 |
| `UPDATE` | 取引・マスタの更新 |
| `UPDATE_AFTER_CLOSE` | 月締め後の摘要・科目変更 |
| `DELETE` | レコード削除 |
| `MONTH_CLOSE` | 月締め実行 |
| `MONTH_REOPEN` | 月締め解除 (理由必須) |
| `STATUS_CHANGE` | DRAFT→READY→CONFIRMED 遷移 |

記録項目: `tableName, recordId, operation, userId, beforeData, afterData, reason?, ipAddress?, userAgent?, createdAt`

---

# 第Ⅱ部 画面別 詳細仕様

## A. 認証 (2画面)

### A.1 ログイン (`/login`)

#### UI 構成
- カード中央配置 (ロゴ + 「経理くん」)
- メール / パスワード 入力
- 「ログイン」ボタン (ロード中スピナー)
- 「新規登録」リンク → `/register`

#### 機能
- Better Auth `signIn.email({email, password})` を呼び出し
- 成功時: `/dashboard` へ遷移
- 失敗時: `メールアドレスまたはパスワードが正しくありません`

#### 業務ルール
- セッション保持 30 日間
- パスワードリセット未実装 (DB 側で対応)

#### データ連携
- R: `User`, `AuthAccount`
- W: `Session`

### A.2 新規登録 (`/register`)

#### UI 構成
- 氏名・メール・パスワード入力
- 「登録」ボタン

#### 機能
- Better Auth `signUp.email()` で User + Session 同時作成
- 成功 → 自動ログイン → `/dashboard`

#### 業務ルール
- 登録直後はロール未設定。管理者が `UserProfile` を作成して初めて機能が完全利用可能
- メールはユニーク制約

#### データ連携
- W: `User`, `AuthAccount`, `Session`

---

## B. メイン (4画面)

### B.1 ダッシュボード (`/dashboard`)

#### UI 構成
- 会社セレクター + 月セレクター (グループ別サマリ用)
- **グループ別サマリカード**: 全社合計タイル + グループ別タイル
- **KPI カード 4 枚**: 会社 / 口座数 / 取引先数 / 今月の取引
- **残高・待機カード 2 枚**: メイン口座残高 / 経費確定待ち
- **メイン口座 直近の入出金テーブル**: 前 3 行 + 後 5 行 (基準日 = 今日)
- **セットアップガイド** (会社未選択時のみ)

#### 機能
- 集計表示のみ。書き込みなし
- `getDashboardData()` で 5 クエリ並列実行
- `getGroupDashboardSummary()` でグループ別タイル取得

#### 業務ルール
- メイン口座 = `Company.mainAccountId` (未指定なら `displayOrder` 最小のアクティブ口座)
- 経費確定待ち = `Transaction.where({type:EXPENSE, status:READY})` の集計

#### データ連携
- R: `Company`, `Account`, `MonthlyBalance`, `Transaction`, `TradingPartner`, `CompanyGroup`, `CompanyGroupMember`

→ 詳細: [`screen-details.md`](screen-details.md)

### B.2 資金繰り表 (`/cashflow-table`)

#### UI 構成
- ヘッダー: タイトル + 会社セレクター + ツールバー (繰延 / 月締め / 帳票作成 / 印刷)
- 表示条件カード: 口座 + 月 + フィルタ (取引先名・ステータス・取引種別)
- **サマリーカード 5 枚**: 期首残高 / 当月入金合計 / 当月支払合計 / 予測残高 (月末) / 会社情報
  - 入金/支払カードに「内 グループ間」内訳
- **メインテーブル**: ☑ / ⋮⋮ / 実出納日 / 予定日 / 種別 / 区分 / ステータス / 取引先 / 摘要 / 入金 / 支払 / 残高 / 差額 / 操作
- ダイアログ: 月締め解除 / 並べ替え日付設定 / 照合点設定 / 会社情報詳細 / 帳票プレビュー / 行プレビュー

#### 機能
- **DnD 並べ替え**: チェック済み行をブロック移動。日付設定ダイアログで挿入位置の日を確定
- **複数行繰延**: 選択行を翌月へ一括移動
- **月締め / 解除**: ADMIN のみ。解除は理由必須
- **通帳照合点**: 任意行に残高チェックポイント
- **帳票作成**: 同一種別の連続選択行から 3 種類の A4 帳票生成
- **行ダブルクリック**: 該当入力画面 (`/expenses?edit=<id>` 等) へ遷移

#### 業務ルール
- 同日同時ルール (引落→振込→入金)
- 未達判定: `status !== CONFIRMED && scheduledDate < 今日 && (actualAmount null OR transactionDate null)` → 薄色 + 未達バッジ
- グループ間判定: `linkedTransactionId !== null` → 紫左ボーダー + G間 バッジ
- 帳票種別の自動判定:
  - `FundTransfer` 紐づき → 資金移動帳票
  - `paymentMethod=BANK_TRANSFER` → 振込依頼書
  - `paymentMethod=CASH_WITHDRAWAL` → 現金支払帳票 (金種表付)

#### データ連携
- R: `Transaction`, `MonthlyBalance`, `ReconciliationCheckpoint`, `Company`, `Account`, `FundTransfer`, `TradingPartnerBankAccount`
- W: `Transaction (displayOrder, scheduledDate)`, `MonthClose`, `ReconciliationCheckpoint`, `AuditLog`

→ 詳細: [`screen-details.md`](screen-details.md)

### B.3 グループ別サマリ (`/group-summary`)

#### UI 構成
- 月セレクター
- 全社合計タイル + グループ別タイル
- カラーコードで色分け、所属会社バッジ

#### 機能
- ダッシュボードのタイル部分を画面全体で表示
- サイドメニュー非表示 (URL 直接アクセス)

#### 業務ルール
- 集計表示のみ。書き込みなし

#### データ連携
- R: `CompanyGroup`, `CompanyGroupMember`, `Company`, `MonthlyBalance`, `Transaction`

→ 詳細: [`screen-details.md`](screen-details.md)

### B.4 資金移動 (`/cashflow`)

#### UI 構成
- ヘッダー + 「+ 新規資金移動」ボタン
- 月フィルタ
- 資金移動一覧テーブル (振替元/先 会社・口座、金額、状態)

#### 機能
- 会社間 or 同社内の振替を登録
- **ペア取引の自動生成**: `Transaction (出金) + Transaction (入金) + FundTransfer` を 1 操作で作成
- 削除時はペア両方を連動削除

#### 業務ルール
- 振替元/先が同口座は不可
- 月締め後は変更不可

#### データ連携
- R: `Company`, `Account`, `MonthClose`
- W: `Transaction (type=TRANSFER, 2件)`, `FundTransfer`

→ 詳細: [`screen-details.md`](screen-details.md)

---

## C. 入力 (5画面)

### C.1 経費入力 (`/expenses`)

#### UI 構成
- **4 タブ**: 固定 / 変動 / 臨時 / 受領BOX (URL `?tab=` で初期タブ指定)
- 臨時タブ:
  - 月セレクター + 「口座は混在」表記 + 「+ 新規経費」ボタン
  - 3 サブタブ (未確定 / 確認待ち / 完了 → DRAFT/READY/CONFIRMED)
  - テーブル列: ☑ / フラグ / 予定日付 / 相手先 / 内容 / 金額 / 帳票 / 操作
- 受領BOX タブ:
  - 「+ 新規請求書を追加」ボタン → 臨時タブの入力ダイアログを開く
- ダイアログ: 臨時経費フォーム / 証憑添付パネル / 正規化

#### 機能
- 経費 CRUD + ステータス遷移
- 証憑 PDF 添付 (Supabase Storage)
- 仮取引先名入力 → 後日正規化
- 同社内資金移動の自動生成 (チェック時)
- フラグ判定:
  - **繰返登録済** = `recurringTemplateId !== null`
  - **前月数値** = 繰返登録済 + 前月に同 `recurringTemplateId` の取引あり
  - **未入力有** = `hasMissingRequiredFields()` (実日付/予定日/種別/金額/口座/相手先 のいずれか欠落)

#### 業務ルール
- DRAFT→READY: 金額 + 取引先 + 証憑 (or 不要)
- READY→CONFIRMED: 中項目必須 (ADMIN のみ)
- 月締め後: 摘要・科目のみ編集可

#### データ連携
- R: `RecurringTemplate`, `TradingPartner`, `TradingPartnerBankAccount`, `AccountCategoryMid/Sub`, `Account`, `MonthClose`, `UserProfile`
- W: `Transaction (type=EXPENSE)`, `TransactionDetail`, `Evidence`, `TemporaryBankAccount`, `FundTransfer`, `AuditLog`

→ 詳細: [`screen-details.md`](screen-details.md)

### C.2 売上入力 (`/sales`)

#### UI 構成
- ヘッダー + Excel 取込 + 「+ 新規請求」
- 月 + ステータスフィルタ
- 親子テーブル: 請求 (展開で入金子を表示)
  - 列: 請求日 / 入金予定日 / 取引先 / 請求金額 / 入金合計 / 残額 / 控除合計 / 差額 / ステータス
- ダイアログ: 請求 / 入金 / 編集 / 控除内訳パネル

#### 機能
- 親子構造: 請求 (親) + 入金 (子、複数) + 控除明細
- **2 段階確定**: ①請求確定 (入力者) → ②入金・控除確定 (ADMIN)
- 控除内訳: カテゴリ別に複数行入力

#### 業務ルール
- 整合チェック: `差額 (請求 − 入金合計) = 控除合計`
- 全額入金完了前: 差額不一致は警告のみ
- 全額入金完了後: 差額不一致は確定不可
- 月締め後: 摘要のみ編集可

#### データ連携
- R: `DeductionCategory (scope=SALES)`, `TradingPartner`, `Account`, `MonthClose`
- W: `Transaction (type=SALES, 親子)`, `TransactionDetail`, `AuditLog`

→ 詳細: [`screen-details.md`](screen-details.md)

### C.3 原価支払 (`/costs`)

#### UI 構成
- ヘッダー + Excel 取込 + 「+ 新規原価支払」
- 月 + ステータスフィルタ
- 一覧テーブル: 稼働日 / 支払先 / 人工 / 法福 / 材料 / 消費税 / 合計 / 実支払 / 差額 / 控除合計 / ステータス / 操作
- ダイアログ: 原価フォーム / 控除内訳パネル

#### 機能
- **計上額 vs 振込額** の 2 つを保持
- 内訳 4 行: 人工費 / 法定福利費 / 材料・諸経費 / 消費税
- 控除内訳: カテゴリ別 (協力会費・保険料・立替金回収 等)

#### 業務ルール
- 資金繰り表には **振込額のみ** 反映
- 確定不可条件: 分割支払中、差額 ≠ 控除合計
- 証憑添付は必須にしない (別システム前提)

#### データ連携
- R: `DeductionCategory (scope=COST)`, `TradingPartner`, `TradingPartnerBankAccount`, `Account`, `MonthClose`
- W: `Transaction (type=COST_PAYMENT)`, `TransactionDetail (4内訳 + 控除)`, `AuditLog`

→ 詳細: [`screen-details.md`](screen-details.md)

### C.4 給与入力 (`/salary`)

#### UI 構成
- ヘッダー + Salary Excel 取込
- 月セレクター
- 給与エントリ一覧: 給与グループ / 支給日 / 課税支給 / 総支給 / 社保 (15%) / 消費税 (10%) / 控除合計 / 差引支給 / 人数 / ステータス
- ダイアログ: 給与エントリ / 控除内訳 / 支払内訳

#### 機能
- 給与グループ単位の合計入力 (個人明細管理外)
- **自動計算**: `socialInsurance = taxable×0.15`, `consumptionTax = taxable×0.10`
- 控除内訳: 項目別 + 内容行
- 支払内訳: 複数の出金イベント (振込/引落/現金引出)
- 自動仕訳生成: 控除 → 対応科目への振替

#### 業務ルール
- **整合チェック (必須一致)**:
  1. `総支給 − 控除合計 = 差引支給`
  2. `差引支給 = Σ paymentDetails.amount`
- 確定は給与管理者ロール (ADMIN 以外でも可、解除は ADMIN)
- 仮想口座への自動反映 (社保 15% + 消費税 10%)

#### データ連携
- R: `PayrollGroup`, `SalaryJournalMapping`, `Company`, `Account`
- W: `SalaryEntry`, `SalaryDeduction`, `SalaryPaymentDetail`, `Transaction (自動仕訳)`, `TransactionDetail`, `FundTransfer (仮想口座へ)`

→ 詳細: [`screen-details.md`](screen-details.md)

### C.5 グループ間入力 (`/inter-group`)

#### UI 構成
- ヘッダー + 「+ 新規入力」 + 「前月コピー」
- カテゴリタブ: 売上/原価 / 経費 / 貸付/借入 / 配当 / サービス対価 / その他
- 一覧テーブル: 取引日 / 自社 → 相手会社 / 金額 / 区分 / 摘要 / 操作

#### 機能
- 双方向ペア取引の自動生成 (`linkedTransactionId` で相互リンク)
- 前月コピー: 前月のグループ間取引をプレビュー → 選択コピー
- 連動削除・連動更新

#### 業務ルール
- グループ会社のみ相手指定可 (`getGroupCompaniesFor`)
- 経費カテゴリでは固定/変動/臨時区分対応
- 月締め後は変更不可

#### データ連携
- R: `Company`, `CompanyGroupMember`, `Account`, `FundTransfer`
- W: `Transaction (双方向ペア, linkedTransactionId)`

→ 詳細: [`screen-details.md`](screen-details.md)

---

## D. 管理 (6画面)

### D.1 現金引出 (`/cash-withdrawal`)

#### UI 構成
- 月セレクター + 「+ 新規バッチ」
- バッチ一覧 (引出日 / 出金口座 / 金額 / 子用途数 / 整合 / ステータス)
- バッチ詳細: 子用途明細 + **金種表** (9 種類: 1〜10000 円)
- ダイアログ: バッチフォーム / 用途リンク / 金種表編集

#### 機能
- 親 = 通帳の引出 1 回、子 = 用途明細
- 子はリンク (既存の現金 Transaction) or 手入力
- 金種自動提案 (`suggestDenomination(amount)`: 最小枚数優先)
- 用途と金種は別々に印刷可

#### 業務ルール
- **確定条件 (厳格 3 一致)**: 親引出金額 = 子用途合計 = 金種表合計
- 確定は ADMIN のみ
- 引出日と用途支払予定日は異なって良い

#### データ連携
- R: `Company`, `Account`
- W: `CashWithdrawalBatch`, `CashDenomination`, `Transaction`

→ 詳細: [`screen-details.md`](screen-details.md)

### D.2 借入管理 (`/loans`)

#### UI 構成
- 借入契約一覧 (契約名 / 借入先 / 借入額 / 残高 / 返済方式 / 金利 / ステータス)
- 詳細: 契約情報 + 返済スケジュール表 (支払済チェック)
- 印刷ビュー: A4 縦の借入契約書 HTML

#### 機能
- 返済方式: 元金均等 / 据置 / 一括 (元利均等は対象外)
- スケジュール自動生成 (元金 / 利息 / 残高)
- 金利改定時は未確定将来分のみ再計算
- 支払済マーク → `Transaction` 自動生成

#### 業務ルール
- `totalPayments > 0` 必須
- 金利改定で確定済支払は維持
- 信用保証協会フラグあり

#### データ連携
- R: `TradingPartner (タグ=銀行)`
- W: `LoanContract`, `LoanSchedule`, `Transaction (支払済時)`

→ 詳細: [`screen-details.md`](screen-details.md)

### D.3 リース管理 (`/leases`)

#### UI 構成
- リース一覧 (契約名 / 種別 / 車種・ナンバー / 月額 / 開始日 / 回数 / ステータス)
- 詳細: 支払スケジュール表

#### 機能
- 資産カテゴリ: 代表 / 車 / その他
- 単純スケジュール (利息計算なし)
- 端数調整: 初回 or 最終回
- 休日調整: NONE / PREV / NEXT

#### 業務ルール
- 月初一括反映 (ADMIN による再生成)
- 支払済マーク → 支払取引を自動生成

#### データ連携
- R: `TradingPartner`, `Account`, `AccountCategoryMid/Sub`
- W: `LeaseContract`, `LeaseSchedule`, `Transaction`

→ 詳細: [`screen-details.md`](screen-details.md)

### D.4 納税予定表 (`/tax-schedule`)

#### UI 構成
- 年度 + 税目フィルタ
- 一覧テーブル (税目 / 年度 / 期 / 納期 / 予定 / 実支払 / 状態)
- ダイアログ: 納税予定 / 中間納税生成

#### 機能
- 税目: 法人税 / 消費税 / 法人住民税 / 事業税 / 固定資産税 / その他
- 中間納税の自動生成 (法人税・消費税の閾値判定)

#### 業務ルール
- 法人税: 前年税額 20 万円超で半期 1 回
- 消費税: 48 万円超〜400 万円以下で半期、〜4800 万円で 3 回、超で 11 回

#### データ連携
- R: `Company`
- W: `TaxPaymentSchedule`

→ 詳細: [`screen-details.md`](screen-details.md)

### D.5 カード明細 (`/card-statements`)

#### UI 構成
- カード + 月セレクター
- サマリ (利用件数 / 利用合計 / 引落日)
- 明細テーブル (利用日 / 利用先 / 金額 / 中項目 / ステータス)
- カードマスタ管理ダイアログ
- インポートダイアログ (CSV/Excel)

#### 機能
- カード × 月 × 明細の階層
- インポート → DRAFT
- Transaction へ転記 (POST) → POSTED へ
- 引落日に集約された 1 行で資金繰り表に反映

#### 業務ルール
- 取込履歴は `ImportBatch` で管理 (ロールバック可)
- カードマスタには引落口座・引落日・締め日を保持

#### データ連携
- R: `Account`, `TradingPartner`, `AccountCategoryMid`
- W: `CardStatement`, `CreditCard`, `ImportBatch`, `Transaction (POST 時)`, `TransactionDetail`

→ 詳細: [`screen-details.md`](screen-details.md)

### D.6 定期支払 (`/recurring`)

#### UI 構成
- テンプレ一覧 (区分 / 取引先 / 科目 / 口座 / 頻度 / 支払日 / 金額タイプ)
- 「今月分を一括生成」ボタン
- ダイアログ: テンプレフォーム

#### 機能
- 頻度: 毎月 / 隔月奇偶 / 四半期 / 年次 / 特定月
- 金額タイプ: 固定 / 変動 (前月コピー) / 手入力
- 月初一括生成 (`generateRecurringTransactions`)
- 期限超過の検知

#### 業務ルール
- 重複防止: `lastGeneratedMonth >= 対象月` のテンプレはスキップ
- 休日調整: NONE / PREV / NEXT (日本祝日対応)
- 変動金額: 前月実績から自動転記、なければ 0 円

#### データ連携
- R: `Company`, `Account`, `TradingPartner`, `AccountCategoryMid/Sub`
- W: `RecurringTemplate`, `Transaction (生成、status=DRAFT)`, `TransactionDetail`

→ 詳細: [`screen-details.md`](screen-details.md)

---

## E. マスタ (11画面)

### E.1 会社一覧 (`/master/companies`)

#### UI 構成
- 一覧テーブル (会社名 / 業種 / 代表者 / 決算月 / メイン口座 / ステータス)
- 編集ダイアログ (3 列レイアウト × 5 ブロック)

#### 機能
- 必須項目: 会社名・フリガナ・業種・代表者・住所・電話・インボイス番号・決算月・メイン口座
- 追加項目 (PDF P1): **e-Tax 番号 / 資本金 / 経理担当者**

#### 業務ルール
- 削除制約: データ紐づけなしのみ可
- メイン口座は会社あたり原則 1 つ
- ステータス: ACTIVE / DORMANT / LIQUIDATING

#### データ連携
- R: `IndustryMaster`, `Account`
- W: `Company`

→ 詳細: [`screen-details.md`](screen-details.md)

### E.2 会社グループ (`/master/company-groups`)

#### UI 構成
- グループ一覧 + メンバー編集ダイアログ

#### 機能
- グループ CRUD (名前 / 略称 / カラー / 表示順 / 有効)
- メンバー編集 (`setGroupMembers` で差分検出 INSERT/DELETE)

#### 業務ルール
- 1 社が複数グループに所属可
- カスケード削除可

#### データ連携
- R: `Company`
- W: `CompanyGroup`, `CompanyGroupMember`

→ 詳細: [`screen-details.md`](screen-details.md)

### E.3 銀行口座 (`/master/accounts`)

#### UI 構成
- 一覧テーブル + 口座フォーム

#### 機能
- 口座 CRUD + 役割管理 (複数選択可)
- 種別: 普通 / 定期 / 社保積立 / 消費税積立 (仮想)
- FB 出力設定 (用途別)

#### 業務ルール
- 仮想口座は会社作成時に自動付与
- 無効化と非表示は別フラグ
- メイン口座は会社あたり 1 つ

#### データ連携
- R: `BankMaster`, `BranchMaster`
- W: `Account`, `AccountRole`

→ 詳細: [`screen-details.md`](screen-details.md)

### E.4 銀行・支店 (`/master/banks`)

#### UI 構成
- 銀行検索 → 銀行一覧 → 支店一覧

#### 機能
- 銀行・支店マスタの CRUD
- 主要銀行シード機能

#### 業務ルール
- サイドメニュー非表示 (URL 直接アクセス)
- 全銀協公式コードを保持

#### データ連携
- W: `BankMaster`, `BranchMaster`

→ 詳細: [`screen-details.md`](screen-details.md)

### E.5 業種 (`/master/industries`)

#### UI 構成
- 業種一覧 + フォーム

#### 機能
- 業種 CRUD (名前 / 略称 / 表示順)

#### 業務ルール
- 使用中の業種は削除不可

#### データ連携
- W: `IndustryMaster`

→ 詳細: [`screen-details.md`](screen-details.md)

### E.6 売上項目 (`/master/sales-items`)

#### UI 構成
- 売上項目一覧 + 適用会社チェックボックス

#### 機能
- 売上項目 CRUD + 適用会社の限定 (空 = 全社対象)

#### 業務ルール
- `applicableCompanyIds` カンマ区切り保持
- 管理者のみ編集可

#### データ連携
- W: `SalesItemMaster`

→ 詳細: [`screen-details.md`](screen-details.md)

### E.7 取引先 (`/master/partners`)

#### UI 構成
- タグ・種別フィルタ + 一覧テーブル
- 取引先フォーム / 銀行口座管理 / 地点管理

#### 機能
- 取引先 CRUD + 子テーブル (銀行口座 / 地点 / デフォルト科目)
- タグ (固定 6 種): 顧客 / 協力会社 / 経費 / 銀行 / グループ会社 / その他

#### 業務ルール
- 権限により候補絞り込み (売上担当=顧客中心 etc.)
- 振込先口座は複数登録可、無効化で履歴保持
- 取引のある取引先は削除不可

#### データ連携
- R: `BankMaster`, `AccountCategoryMid/Sub`
- W: `TradingPartner`, `TradingPartnerBankAccount`, `TradingPartnerSite`, `TradingPartnerDefault`

→ 詳細: [`screen-details.md`](screen-details.md)

### E.8 給与グループ (`/master/payroll-groups`)

#### UI 構成
- グループ一覧 + コピー作成

#### 機能
- 給与グループ CRUD (会社別)
- 区分は **固定** (原価 / 販管 / 外注、変更不可)
- 既存からコピー作成可

#### 業務ルール
- 0 円行表示ルール (前月実績あり→当月 0 円表示、2 ヶ月連続 0 円→デフォ非表示)
- 削除は過去エントリなしのみ

#### データ連携
- R: `Account`, `AccountCategoryMid`
- W: `PayrollGroup`

→ 詳細: [`screen-details.md`](screen-details.md)

### E.9 勘定科目 (`/master/categories`)

#### UI 構成
- 階層ツリー (大 → 中 → 小)
- 中項目・小項目ダイアログ

#### 機能
- 3 階層管理: 大項目 (PL区分・固定) / 中項目 / 小項目
- 小項目は中項目別に限定候補

#### 業務ルール
- 大項目は seed で固定 (販管費 / 製造原価 / 営業外費用 / 営業外収益 / 特別 等)
- 中項目: 確定時必須
- 小項目: 任意 (全部出し禁止)
- 削除: 未使用のみ可

#### データ連携
- R: `AccountCategoryMajor`
- W: `AccountCategoryMid`, `AccountCategorySub`

→ 詳細: [`screen-details.md`](screen-details.md)

### E.10 控除カテゴリ (`/master/deduction-categories`)

#### UI 構成
- 売上用 / 原価用タブ
- カテゴリフォーム (デフォルト科目 + 符号方針)

#### 機能
- 売上・原価で別マスタ
- 符号方針: NORMAL / OCCURS_OFFSET (発生/相殺) / SIGNED (符号可)

#### 業務ルール
- デフォルト科目未設定でも準備完了は可、確定は不可
- 前倒し入金・保留金: 発生/相殺の小項目で符号自動決定

#### データ連携
- R: `AccountCategoryMid/Sub`
- W: `DeductionCategory`

→ 詳細: [`screen-details.md`](screen-details.md)

### E.11 設定 (`/master/settings`)

プレースホルダ画面 (将来拡張用)。

→ 詳細: [`screen-details.md`](screen-details.md)

---

# 第Ⅲ部 標準業務フロー

## F.1 月初のセットアップ

```
1. マスタ管理 → 会社・口座・取引先・科目が登録済か確認
2. /recurring → 「今月分を一括生成」で固定/変動の経費取引を生成
3. /cashflow-table で月初残高・月末予測残高を確認
```

## F.2 日々のオペレーション

```
[請求書受領]
  /expenses?tab=RECEIVED → 受領BOX で受領日を記録
  → 取引先・金額・科目を入力
  → 証憑 PDF を添付
  → 「準備完了」へ

[支払手続き]
  /cashflow-table → 支払予定一覧を確認
  → DnD で順序を入れ替え
  → FB データ出力 → 銀行アップロード
  → 引落完了後「確定」へ

[通帳照合]
  /cashflow-table → 通帳と突合
  → 一致した行で「照合点設定」(残高入力)
  → 差額が出れば自動アラート
```

## F.3 月末締め作業

```
1. すべての取引のステータスを「確定」(CONFIRMED) に
2. 通帳と最終残高を突合
3. /cashflow-table → 月選択 → 「月締め」ボタン (ADMIN)
4. 月末残高が翌月の月初残高に自動繰越
```

## F.4 月末締めの解除

```
1. /cashflow-table → 該当月を選択
2. 「月締め解除」ボタン (ADMIN)
3. 解除理由を入力 (必須)
4. AuditLog (operation=MONTH_REOPEN) が記録される
```

---

# 第Ⅳ部 データモデル全体図

## G.1 主要テーブル関係 (ER 概略)

```
Company ─┬─── Account ──── MonthlyBalance
         │           └──── AccountRole
         │
         ├─── TradingPartner ─┬─ TradingPartnerBankAccount
         │                    ├─ TradingPartnerSite
         │                    └─ TradingPartnerDefault
         │
         ├─── Transaction ─┬─ TransactionDetail
         │                 ├─ Evidence
         │                 ├─ Transaction (parentId)
         │                 ├─ Transaction (linkedTransactionId) ─ グループ間
         │                 ├─ FundTransfer
         │                 ├─ CashWithdrawalBatch
         │                 └─ recurringTemplateId
         │
         ├─── MonthClose
         ├─── SalaryEntry ─┬─ SalaryDeduction
         │                 └─ SalaryPaymentDetail
         │
         ├─── LoanContract ── LoanSchedule
         ├─── LeaseContract ── LeaseSchedule
         ├─── RecurringTemplate
         ├─── TaxPaymentSchedule
         ├─── CardStatement ── CreditCard
         ├─── ReconciliationCheckpoint
         └─── AuditLog

CompanyGroup ── CompanyGroupMember ── Company

AccountCategoryMajor ── AccountCategoryMid ── AccountCategorySub
                                    │
                                    └── 各 Transaction / DeductionCategory / RecurringTemplate から参照

BankMaster ── BranchMaster ── (Account, TradingPartnerBankAccount から参照)

User (Better Auth) ── Session
              └─ UserProfile ── Company (所属)

PayrollGroup ── SalaryEntry (会社×支給月×グループ)
SalaryJournalMapping (給与控除 → 勘定科目)

IndustryMaster ── Company
SalesItemMaster ── Company (applicableCompanyIds)
DeductionCategory (scope=SALES|COST) ── AccountCategoryMid/Sub
ImportBatch (取込履歴)
```

## G.2 共通マスタ一覧

| マスタ | 用途 | 編集権限 |
|---|---|---|
| `Company` | 12 グループ会社の基本情報 | ADMIN |
| `IndustryMaster` | 業種 | ADMIN |
| `CompanyGroup` / `CompanyGroupMember` | 業種別グルーピング | ADMIN |
| `Account` / `AccountRole` | 銀行口座 (普通/定期/仮想2種) | ADMIN |
| `BankMaster` / `BranchMaster` | 全銀協 銀行・支店 | ADMIN |
| `TradingPartner` 系 (4テーブル) | 取引先 (タグ 6 種) | ADMIN + OPERATOR (制限あり) |
| `AccountCategoryMajor/Mid/Sub` | 3 階層勘定科目 | ADMIN |
| `DeductionCategory` | 控除カテゴリ (売上/原価別) | ADMIN |
| `PayrollGroup` | 給与グループ (会社別) | ADMIN |
| `SalesItemMaster` | 売上項目 (会社限定可) | ADMIN |
| `SalaryJournalMapping` | 給与控除 → 科目マッピング | ADMIN |

---

# 第Ⅴ部 主要 Server Action インデックス

| Action ファイル | 主要関数 | 主な書き込み先 |
|---|---|---|
| `accounts.ts` | `getAccounts`, `createAccount`, `updateAccount`, `toggleAccountActive` | `Account` |
| `audit-logs.ts` | `getAuditLogs`, `getAuditLogsForRecord` | (R only) |
| `bank-masters.ts` | `getBanks`, `getBankWithBranches`, `searchBranches`, `seedMajorBanks` | `BankMaster`, `BranchMaster` |
| `card-statements.ts` | `getCardStatements`, `importCardStatements`, `postCardStatementsToTransaction` | `CardStatement`, `CreditCard`, `ImportBatch` |
| `cash-withdrawal.ts` | `createCashWithdrawalBatch`, `linkTransactionToBatch`, `upsertDenomination`, `suggestDenomination`, `confirmCashWithdrawalBatch` | `CashWithdrawalBatch`, `CashDenomination` |
| `cashflow-table.ts` | `getCashFlowTable`, `closeMonth`, `reopenMonth`, `deferTransaction`, `reorderTransactions`, `recalculateClosingBalance` | `Transaction`, `MonthClose`, `MonthlyBalance` |
| `categories.ts` | `getCategories`, `createMidCategory`, `createSubCategory` | `AccountCategoryMid/Sub` |
| `companies.ts` | `getCompanies`, `updateCompany`, `getCompanyInfoSummary` | `Company` |
| `company-groups.ts` | `getCompanyGroups`, `setGroupMembers`, `getGroupDashboardSummary` | `CompanyGroup`, `CompanyGroupMember` |
| `dashboard.ts` | `getDashboardData` | (R only) |
| `deduction-categories.ts` | `getDeductionCategories`, `createDeductionCategory` | `DeductionCategory` |
| `evidence.ts` | `getUploadUrl`, `uploadEvidence`, `getEvidenceViewUrl`, `searchEvidenceByMeta` | `Evidence` |
| `fund-transfers.ts` | `getFundTransfers`, `createFundTransfer`, `deleteFundTransfer` | `FundTransfer`, `Transaction` |
| `industries.ts` | `getIndustries`, `createIndustry` | `IndustryMaster` |
| `inter-group.ts` | `createInterGroupSale/Expense`, `copyPreviousMonthInterGroup`, `getGroupCompaniesFor` | `Transaction (pair)` |
| `leases.ts` | `getLeases`, `createLease`, `regenerateLeaseSchedule`, `markLeaseSchedulePaid`, `getVehicleLeaseMatrix` | `LeaseContract`, `LeaseSchedule` |
| `loans.ts` | `getLoans`, `createLoan`, `regenerateSchedule`, `markLoanSchedulePaid` | `LoanContract`, `LoanSchedule` |
| `partner-bank-accounts.ts` | (4 関数) | `TradingPartnerBankAccount` |
| `partner-sites.ts` | (4 関数) | `TradingPartnerSite` |
| `partners.ts` | `getPartners`, `createPartner`, `updatePartner`, `togglePartnerActive` | `TradingPartner` |
| `payroll.ts` | `getSalaryEntries`, `upsertSalaryDeductions`, `upsertPaymentDetails`, `generateSalaryJournalEntries` | `SalaryEntry`, `SalaryDeduction`, `SalaryPaymentDetail`, `Transaction (自動仕訳)` |
| `reconciliation.ts` | `createCheckpoint`, `updateCheckpoint`, `deleteCheckpoint` | `ReconciliationCheckpoint` |
| `recurring.ts` | `generateRecurringTransactions`, `autoGenerateRecurringTransactions` | `RecurringTemplate`, `Transaction (一括生成)` |
| `salary-import.ts` | `importSalaryEntries` | `SalaryEntry` |
| `sales-items.ts` | `getSalesItems`, `getSalesItemsForCompany` | `SalesItemMaster` |
| `tax-schedule.ts` | `getTaxSchedules`, `createTaxSchedule`, `generateInterimTaxSchedules` | `TaxPaymentSchedule` |
| `transaction-import.ts` | `importSalesTransactions`, `importCostTransactions` | `Transaction`, `ImportBatch` |
| `transactions.ts` | `getTransactions`, `createTransaction`, `updateTransaction`, `updateTransactionStatus`, `normalizePartner` | `Transaction`, `TransactionDetail` |
| `user-profile.ts` | `getCurrentUserProfile`, `getExpenseBoxItems` | (R only) |

---

# 付録: 用語集

| 用語 | 意味 |
|---|---|
| **資金繰り表** | 現金の出入りを時系列で一覧化した表 |
| **月締め** | その月の取引を確定し編集不可ロック |
| **計上月** (`accountingMonth`) | その取引を「何月分」として計上するか |
| **予定日** (`scheduledDate`) | 実際に出納される予定の日 |
| **実出納日** (`transactionDate`) | 実際に出納が行われた日 |
| **照合点** | 通帳の実残高と一致した時点をマーキング |
| **証憑** | 取引の裏付け書類 (請求書・領収書 PDF) |
| **正規化** | 仮入力した取引先名をマスタの正式取引先と紐付け |
| **FB データ** | 全銀協フォーマットの振込データファイル |
| **同日同時ルール** | 同日内で「引落 → 振込/移動 → 入金」順 |
| **休日調整** | 支払予定日が祝日・土日の場合に前後の営業日へ移動 |
| **仮想口座** | 社保積立・消費税積立用の会社内仮想口座 |
| **G間** | グループ間取引 (`linkedTransactionId !== null`) |
| **未達** | 予定日が過去で未確定な取引 |
| **準備完了** | 入力者が確認した状態 (READY) |
| **確定** | 管理者が承認した状態 (CONFIRMED) |
