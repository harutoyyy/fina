# ダッシュボード連携データ設計図

経理くん（fina）で入力・管理されている全データの一覧。
**除外**: 資金繰り表関連データ、資金移動（FundTransfer / TRANSFER取引）

---

## 1. 会社情報（Company）

ダッシュボードのテナント単位。全データは `companyId` で紐づく。

| フィールド | 型 | 説明 |
|---|---|---|
| id | string | 会社ID |
| name | string | 会社名 |
| shortName | string? | 略称 |
| industryType | string? | 業種 |
| representativeTitle | string? | 代表者役職 |
| representativeName | string? | 代表者氏名 |
| postalCode | string? | 郵便番号 |
| addressPrefecture | string? | 都道府県 |
| addressCity | string? | 市区町村 |
| addressStreet | string? | 番地 |
| addressBuilding | string? | 建物名 |
| phone | string? | 電話番号 |
| fax | string? | FAX番号 |
| email | string? | メールアドレス |
| corporateNumber | string? | 法人番号（13桁） |
| invoiceNumber | string? | インボイス登録番号 |
| fiscalMonth | int | 決算月（1〜12） |
| status | string | ACTIVE / DORMANT / LIQUIDATING |

**グループ**: 12社（建設7社、広告2社、その他3社）

---

## 2. 経費（Transaction type=EXPENSE）

### 入力項目

| フィールド | 型 | 説明 | 必須 |
|---|---|---|---|
| accountId | string | 支払口座 | ○ |
| partnerId | string? | 支払先（取引先） | |
| transactionDate | date? | 支払日 | |
| accountingMonth | string | 計上月（YYYY-MM） | ○ |
| paymentMethod | enum | 振込 / 引落 / 現金 | |
| amount | bigint | 金額（負数で記録） | ○ |
| summary | string? | 摘要 | |
| status | enum | DRAFT → READY → CONFIRMED | |
| hasEvidence | bool | 証憑添付済み | |

### 明細（TransactionDetail）

| フィールド | 型 | 説明 |
|---|---|---|
| midId | string? | 勘定科目（中項目） |
| subId | string? | 補助科目（小項目） |
| amount | bigint | 明細金額 |
| summary | string? | 明細摘要 |

### 証憑（Evidence）

| フィールド | 型 | 説明 |
|---|---|---|
| fileName | string | ファイル名 |
| fileUrl | string | S3 URL |
| fileSize | int? | ファイルサイズ |
| mimeType | string? | MIMEタイプ |
| uploadedBy | string | アップロードユーザー |

### ダッシュボード表示候補
- 月別経費合計（会社別）
- 勘定科目別経費内訳（円グラフ・棒グラフ）
- 取引先別経費ランキング
- 支払方法別集計
- 前月比・前年同月比
- ステータス別件数（下書き / 準備完了 / 確定済）

---

## 3. 売上（Transaction type=SALES）

### 入力項目（請求）

| フィールド | 型 | 説明 | 必須 |
|---|---|---|---|
| accountId | string | 入金口座 | ○ |
| partnerId | string? | 請求先（取引先） | |
| invoiceDate | date? | 請求日 | |
| scheduledDate | date? | 予定入金日 | |
| accountingMonth | string | 計上月 | ○ |
| amount | bigint | 請求金額 | ○ |
| invoiceAmount | bigint? | 請求額（親取引） | |
| summary | string? | 摘要 | |
| status | enum | DRAFT → READY → CONFIRMED | |

### 入力項目（入金 = 子取引）

| フィールド | 型 | 説明 | 必須 |
|---|---|---|---|
| parentId | string | 親請求ID | ○ |
| transactionDate | date | 入金日 | ○ |
| amount | bigint | 入金額 | ○ |

### 控除明細（TransactionDetail where deductionCategoryId != null）

| フィールド | 型 | 説明 |
|---|---|---|
| deductionCategoryId | string | 控除カテゴリ |
| deductionSubType | string? | OCCURRENCE（発生） / OFFSET（相殺） |
| amount | bigint | 控除金額 |
| summary | string? | 摘要 |
| signMultiplier | int | 1 or -1 |

### ダッシュボード表示候補
- 月別売上合計（会社別）
- 取引先別売上ランキング
- 入金率（入金済 / 請求額）
- 未入金一覧（残額 > 0）
- 控除合計
- 前月比・前年同月比

---

## 4. 原価支払（Transaction type=COST_PAYMENT）

### 入力項目

| フィールド | 型 | 説明 | 必須 |
|---|---|---|---|
| accountId | string | 支払口座 | ○ |
| partnerId | string? | 支払先 | |
| transactionDate | date? | 施工日 | |
| accountingMonth | string | 計上月 | ○ |
| recordedAmount | bigint? | 計上額（控除前） | |
| transferAmount | bigint? | 実支払額（振込額） | |
| amount | bigint | 合計金額（= 計上額） | ○ |
| summary | string? | 摘要 | |
| status | enum | DRAFT → READY → CONFIRMED | |

### 内訳明細（4行固定）

| 行 | 説明 |
|---|---|
| 1行目 | 労務費 |
| 2行目 | 法定福利 |
| 3行目 | 材料雑費 |
| 4行目 | 消費税 |

### 差額 = 計上額 − 実支払額 → 控除明細として管理

### ダッシュボード表示候補
- 月別原価合計（会社別）
- 支払先別原価ランキング
- 内訳比率（労務費 / 法定福利 / 材料雑費 / 消費税）
- 差額（控除）集計
- 前月比

---

## 5. 給与（SalaryEntry）

### 入力項目

| フィールド | 型 | 説明 | 必須 |
|---|---|---|---|
| payrollGroupId | string | 給与グループ | ○ |
| payMonth | string | 支給月（YYYY-MM） | ○ |
| payDate | date? | 支給日 | |
| headcount | int | 人数 | |
| taxablePayment | bigint | 課税支給額 | ○ |
| transportAllowance | bigint | 交通費 | |
| miscExpenses | bigint | 諸経費 | |
| carryoverAdjust | bigint | 繰越金調整 | |
| advanceExpenses | bigint | 立替経費 | |
| **totalPayment** | bigint | **総支給（自動計算）** | |
| **socialInsuranceReserve** | bigint | **社保積立（課税支給×15%）** | |
| **consumptionTaxReserve** | bigint | **消費税積立（課税支給×10%）** | |
| totalDeduction | bigint | 控除合計 | |
| **netPayment** | bigint | **差引支給（総支給−控除合計）** | |
| status | enum | DRAFT → READY → CONFIRMED | |

### 給与控除明細（SalaryDeduction）

| フィールド | 型 | 説明 |
|---|---|---|
| itemName | string | 控除項目名（家賃控除、貸金控除等） |
| amount | bigint | 金額 |
| midId | string? | 勘定科目（中項目） |
| subId | string? | 補助科目 |
| contentRows | json? | 内容行 [{description, amount}] |

### 給与支払内訳（SalaryPaymentDetail）

| フィールド | 型 | 説明 |
|---|---|---|
| paymentDate | date | 出金日 |
| paymentMethod | enum | 振込 / 引落 / 現金 |
| accountId | string? | 出金口座 |
| amount | bigint | 金額 |

### 給与グループ（PayrollGroup）

| フィールド | 型 | 説明 |
|---|---|---|
| name | string | 区分名（工事部門、営業部門等） |
| costType | string | COST（原価）/ SGA（販管費）/ OUTSOURCE（外注） |
| payDay | int? | 支給日（25, 27等） |
| headcount | int | 人数 |

### ダッシュボード表示候補
- 月別給与総額（会社別・グループ別）
- 支給項目別内訳
- 控除項目別内訳
- 社保積立・消費税積立の推移
- 人件費率（売上対比）
- 人数推移

---

## 6. 借入管理（LoanContract + LoanSchedule）

### 契約情報

| フィールド | 型 | 説明 | 必須 |
|---|---|---|---|
| contractName | string | 契約名 | ○ |
| partnerId | string? | 借入先 | |
| principalAmount | bigint | 借入金額 | ○ |
| executionDate | date | 実行日 | ○ |
| repaymentStartDate | date | 返済開始日 | ○ |
| repaymentMethod | string | 元金均等 / 一括 / 据置 等 | ○ |
| repaymentFrequency | string | 月次 / 四半期 / 半年 / 年次 | ○ |
| repaymentDay | int? | 返済日 | |
| totalPayments | int? | 返済回数 | |
| interestType | string | 固定 / 変動 | ○ |
| interestRate | decimal | 金利（%） | ○ |
| interestTiming | string | 前払 / 後払 | |
| remainingBalance | bigint | 残高 | |
| status | string | ACTIVE / COMPLETED / CANCELLED | |

### 返済スケジュール（LoanSchedule）

| フィールド | 型 | 説明 |
|---|---|---|
| paymentNumber | int | 回数 |
| dueDate | date | 返済日 |
| principalAmount | bigint | 元金 |
| interestAmount | bigint | 利息 |
| totalAmount | bigint | 合計 |
| remainingBalance | bigint | 残高 |
| isPaid | bool | 支払済み |

### ダッシュボード表示候補
- 借入残高合計（会社別）
- 月別返済予定額（元金・利息内訳）
- 借入先別残高
- 金利タイプ別残高
- 返済進捗率
- 今後12ヶ月の返済カレンダー

---

## 7. リース管理（LeaseContract + LeaseSchedule）

### 契約情報

| フィールド | 型 | 説明 | 必須 |
|---|---|---|---|
| contractName | string | 契約名 | ○ |
| partnerId | string? | リース先 | |
| monthlyAmount | bigint | 月額 | ○ |
| startDate | date | 開始日 | ○ |
| endDate | date? | 終了日 | |
| totalPayments | int? | 回数 | |
| paymentDay | int? | 支払日 | |
| accountId | string? | 支払口座 | |
| midId | string? | 勘定科目 | |
| status | string | ACTIVE / COMPLETED / CANCELLED | |

### 支払スケジュール（LeaseSchedule）

| フィールド | 型 | 説明 |
|---|---|---|
| paymentNumber | int | 回数 |
| dueDate | date | 支払日 |
| amount | bigint | 金額 |
| isPaid | bool | 支払済み |

### ダッシュボード表示候補
- リース支払合計（会社別）
- 月別リース支払予定
- 契約先別支払額
- 残回数・残額

---

## 8. 定期支払テンプレート（RecurringTemplate）

| フィールド | 型 | 説明 |
|---|---|---|
| name | string | テンプレート名 |
| frequency | string | MONTHLY / BIMONTHLY_ODD / BIMONTHLY_EVEN / QUARTERLY / YEARLY / SPECIFIC_MONTHS |
| specificMonths | int[] | 特定月（frequency=SPECIFIC_MONTHSの場合） |
| dueDayRule | string | MONTH_END / DAY_5 / DAY_10 / DAY_15 / DAY_20 / DAY_25 / DAY_27 |
| holidayAdjust | string | PREV_BUSINESS / NEXT_BUSINESS / NONE |
| transactionType | enum | EXPENSE / SALES / COST_PAYMENT / SALARY / LOAN |
| partnerId | string? | 取引先 |
| midId | string? | 勘定科目 |
| amountType | string | FIXED / VARIABLE / MANUAL |
| fixedAmount | bigint? | 固定金額 |
| paymentMethod | enum? | 支払方法 |
| summary | string? | 摘要 |
| lastGeneratedMonth | string? | 最終生成月 |
| isActive | bool | 有効フラグ |

### ダッシュボード表示候補
- 来月の自動生成予定一覧
- テンプレート数（種別別）

---

## 9. 月締め状態（MonthClose）

| フィールド | 型 | 説明 |
|---|---|---|
| yearMonth | string | 対象月（YYYY-MM） |
| isClosed | bool | 締め済みフラグ |
| closedAt | datetime? | 締め日時 |
| closedBy | string? | 締め実行者 |
| reopenedAt | datetime? | 解除日時 |
| reopenedBy | string? | 解除実行者 |
| reopenReason | string? | 解除理由 |

### ダッシュボード表示候補
- 各社の月締め状況一覧（未締め月のハイライト）

---

## 10. マスタデータ

### 10-1. 口座マスタ（Account）

| フィールド | 型 | 説明 |
|---|---|---|
| bankName | string? | 銀行名 |
| bankCode | string? | 銀行コード |
| branchName | string? | 支店名 |
| branchCode | string? | 支店コード |
| accountNumber | string? | 口座番号 |
| accountType | enum | ORDINARY / TERM / SOCIAL_INSURANCE_RESERVE / CONSUMPTION_TAX_RESERVE |
| accountHolder | string? | 名義カナ |
| isMain | bool | メイン口座 |
| isVirtual | bool | 仮想口座 |
| isActive | bool | 有効フラグ |

### 10-2. 勘定科目マスタ（3階層）

```
大項目（AccountCategoryMajor）
  ├── direction: INCOME（収益） or EXPENSE（費用）
  ├── name: 売上高 / 売上原価 / 販売管理費 / 営業外収益 / 営業外費用
  │
  └── 中項目（AccountCategoryMid）
        ├── name: 通信費 / 地代家賃 / 旅費交通費 / ...
        │
        └── 小項目（AccountCategorySub）
              └── name: 電気代 / ガス代 / 携帯電話 / ...
```

### 10-3. 取引先マスタ（TradingPartner）

| フィールド | 型 | 説明 |
|---|---|---|
| name | string | 取引先名 |
| nameKana | string? | フリガナ |
| type | enum | CUSTOMER / VENDOR / BOTH |
| tagKey | string | CUSTOMER / SUBCONTRACTOR / EXPENSE / BANK / GROUP_COMPANY / OTHER |
| isActive | bool | 有効フラグ |

**付随データ:**
- 取引先銀行口座（bankCode, branchCode, accountNumber, accountHolder）
- デフォルト科目（midId, subId）
- 契約/地点テンプレート（siteName, frequency, dueDayRule, fixedAmount）

### 10-4. 控除カテゴリ（DeductionCategory）

| フィールド | 型 | 説明 |
|---|---|---|
| forType | string | SALES or COST |
| name | string | カテゴリ名 |
| midId | string | デフォルト中項目 |
| subId | string? | デフォルト小項目 |
| hasSubTypes | bool | 発生/相殺の種別を持つか |
| signRule | json | 符号ルール |

---

## 11. 現金引出バッチ（CashWithdrawalBatch）

| フィールド | 型 | 説明 |
|---|---|---|
| accountId | string | 引出口座 |
| withdrawalDate | date | 引出日 |
| totalAmount | bigint | 引出金額 |
| status | enum | DRAFT → CONFIRMED |

### 金種表（CashDenomination）

| フィールド | 型 | 説明 |
|---|---|---|
| yen10000 〜 yen1 | int | 各金種の枚数 |
| total | bigint | 合計金額 |
| purposeLabel | string? | 用途ラベル |

---

## 12. 振込バッチ（TransferBatch / FB出力）

### バッチ

| フィールド | 型 | 説明 |
|---|---|---|
| accountId | string | 出金口座 |
| batchDate | date | 振込日 |
| purpose | string | GENERAL / SALARY / BONUS |
| status | string | DRAFT → CONFIRMED → FB_EXPORTED → TRANSFERRED |
| totalAmount | bigint | 合計金額 |
| totalFee | bigint | 手数料合計 |

### バッチ明細（TransferBatchItem）

| フィールド | 型 | 説明 |
|---|---|---|
| recipientName | string | 受取人名 |
| bankCode | string | 銀行コード |
| branchCode | string | 支店コード |
| accountNumber | string | 口座番号 |
| amount | bigint | 金額 |
| fee | bigint | 手数料 |
| isTransferred | bool | 振込済み |

---

## 全体ER図（簡略版）

```
Company (12社)
  ├── Account[] (口座マスタ)
  ├── TradingPartner[] (取引先マスタ)
  │     ├── BankAccount[]
  │     ├── Default (デフォルト科目)
  │     └── Site[] (地点テンプレート)
  │
  ├── Transaction[] (全取引)
  │     ├── type: EXPENSE    ← 経費
  │     ├── type: SALES      ← 売上（親子構造：請求→入金）
  │     ├── type: COST_PAYMENT ← 原価支払
  │     ├── type: SALARY     ← 給与仕訳
  │     └── type: LOAN       ← 借入返済
  │           │
  │           ├── TransactionDetail[] (明細・控除)
  │           └── Evidence[] (証憑)
  │
  ├── PayrollGroup[] (給与グループ)
  │     └── SalaryEntry[] (月別給与)
  │           ├── SalaryDeduction[] (控除明細)
  │           └── SalaryPaymentDetail[] (支払内訳)
  │
  ├── LoanContract[] (借入契約)
  │     └── LoanSchedule[] (返済スケジュール)
  │
  ├── LeaseContract[] (リース契約)
  │     └── LeaseSchedule[] (支払スケジュール)
  │
  ├── RecurringTemplate[] (定期支払テンプレ)
  ├── MonthClose[] (月締め状態)
  └── MonthlyBalance[] (月次残高)

AccountCategoryMajor (PL区分)
  └── AccountCategoryMid (勘定科目)
        └── AccountCategorySub (補助科目)

DeductionCategory (控除カテゴリマスタ)
```

---

## ダッシュボード推奨ビュー一覧

### 全社サマリー
| ビュー | データソース | 集計軸 |
|---|---|---|
| 月別PL概要 | Transaction (全type) | 会社 × 月 × direction |
| 売上合計 | Transaction (SALES) | 会社 × 月 |
| 経費合計 | Transaction (EXPENSE) | 会社 × 月 |
| 原価合計 | Transaction (COST_PAYMENT) | 会社 × 月 |
| 人件費合計 | SalaryEntry | 会社 × 月 |
| 借入残高 | LoanContract.remainingBalance | 会社 |

### 経費分析
| ビュー | データソース | 集計軸 |
|---|---|---|
| 科目別内訳 | TransactionDetail → mid/sub | 月 × 科目 |
| 取引先別 | Transaction.partnerId | 月 × 取引先 |
| 支払方法別 | Transaction.paymentMethod | 月 × 方法 |

### 売上分析
| ビュー | データソース | 集計軸 |
|---|---|---|
| 取引先別売上 | Transaction (SALES, parentId=null) | 月 × 取引先 |
| 入金率 | children.amount / invoiceAmount | 月 |
| 未入金リスト | invoiceAmount - sum(children.amount) > 0 | 取引先 |
| 控除内訳 | TransactionDetail (deductionCategoryId) | カテゴリ |

### 原価分析
| ビュー | データソース | 集計軸 |
|---|---|---|
| 支払先別原価 | Transaction (COST_PAYMENT) | 月 × 取引先 |
| 内訳比率 | TransactionDetail (労務費/法定福利/材料雑費/消費税) | 月 |
| 差額（控除）推移 | recordedAmount - transferAmount | 月 |

### 給与分析
| ビュー | データソース | 集計軸 |
|---|---|---|
| グループ別人件費 | SalaryEntry | 月 × グループ |
| 支給項目内訳 | SalaryEntry各フィールド | 月 |
| 控除項目内訳 | SalaryDeduction | 月 × 項目名 |
| 積立推移 | socialInsuranceReserve / consumptionTaxReserve | 月 |

### 借入・リース
| ビュー | データソース | 集計軸 |
|---|---|---|
| 返済予定カレンダー | LoanSchedule + LeaseSchedule | 月 |
| 残高推移 | LoanContract.remainingBalance | 月 |
| 金利負担 | LoanSchedule.interestAmount | 月 |

### 業務ステータス
| ビュー | データソース | 集計軸 |
|---|---|---|
| 月締め状況 | MonthClose | 会社 × 月 |
| 未確定取引数 | Transaction (status != CONFIRMED) | 会社 × type |
| 証憑未添付 | Transaction (hasEvidence = false, type=EXPENSE) | 件数 |
