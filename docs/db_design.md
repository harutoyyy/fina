**経理くん（fina）**

**データベース設計書**

Prisma Schema + ER図 + テーブル定義

Version 1.0　\|　2026年3月4日

1\. 概要

本書は経理くん（fina）のデータベース設計を定義する。ORM（Prisma）のスキーマ定義を基準とし、各テーブルの役割・カラム・リレーション・インデックスを詳述する。

Prismaスキーマファイル（schema.prisma）は本書と同時に納品し、Replitでの開発開始時にそのまま使用できる。

設計方針

- マルチテナント構成：1DB内に全12社のデータを格納。company_idで分離

- 親子構造：取引（Transaction）は親子で管理。親＝通帳1行、子＝明細

- 金額はBigInt（円単位）：小数点なし、収入は正値、支出は負値

- ソフトデリート：マスタは削除せず isActive=false で無効化

- 監査ログ：Prisma Middlewareで自動記録。audit_logsテーブルに変更履歴を保持

- Better Auth連携：認証テーブルはBetter Authが自動生成。user_profilesで拡張

2\. テーブル一覧

全21エンティティ（Better Auth自動生成テーブルを除く）を以下のカテゴリに分類する。

認証・ユーザー

|                |                  |                                |
|----------------|------------------|--------------------------------|
| **テーブル名** | **Prismaモデル** | **役割**                       |
| user_profiles  | UserProfile      | ユーザー拡張（役割・担当会社） |

マスタデータ

|                               |                           |                                     |
|-------------------------------|---------------------------|-------------------------------------|
| **テーブル名**                | **Prismaモデル**          | **役割**                            |
| companies                     | Company                   | 会社マスタ（12社＋増減可）          |
| accounts                      | Account                   | 銀行口座・仮想口座マスタ            |
| account_roles                 | AccountRole               | 口座の役割（複数選択可）            |
| account_category_majors       | AccountCategoryMajor      | 大項目（PL区分）                    |
| account_category_mids         | AccountCategoryMid        | 中項目（勘定科目）                  |
| account_category_subs         | AccountCategorySub        | 小項目（補助科目）                  |
| trading_partners              | TradingPartner            | 取引先マスタ                        |
| trading_partner_bank_accounts | TradingPartnerBankAccount | 取引先の振込先口座                  |
| trading_partner_defaults      | TradingPartnerDefault     | 取引先デフォルト科目                |
| trading_partner_sites         | TradingPartnerSite        | 契約/地点テンプレ                   |
| payroll_groups                | PayrollGroup              | 給与グループマスタ                  |
| deduction_categories          | DeductionCategory         | 控除カテゴリマスタ（売上用/原価用） |
| bank_masters                  | BankMaster                | 銀行マスタ（初期同梱）              |
| branch_masters                | BranchMaster              | 支店マスタ（初期同梱）              |

トランザクションデータ

|                        |                     |                              |
|------------------------|---------------------|------------------------------|
| **テーブル名**         | **Prismaモデル**    | **役割**                     |
| transactions           | Transaction         | 取引データ（親子構造の親）   |
| transaction_details    | TransactionDetail   | 取引明細（子）               |
| monthly_balances       | MonthlyBalance      | 月次口座残高                 |
| salary_entries         | SalaryEntry         | 給与入力データ               |
| salary_deductions      | SalaryDeduction     | 給与控除明細                 |
| salary_payment_details | SalaryPaymentDetail | 給与支払内訳（出金イベント） |
| fund_transfers         | FundTransfer        | 資金移動                     |
| evidences              | Evidence            | 証憑ファイル                 |

バッチ処理

|                         |                     |                        |
|-------------------------|---------------------|------------------------|
| **テーブル名**          | **Prismaモデル**    | **役割**               |
| cash_withdrawal_batches | CashWithdrawalBatch | 現金引出バッチ         |
| cash_denominations      | CashDenomination    | 金種表                 |
| transfer_batches        | TransferBatch       | 振込バッチ（FB出力用） |
| transfer_batch_items    | TransferBatchItem   | 振込バッチ明細         |

テンプレート・スケジュール

|                         |                      |                        |
|-------------------------|----------------------|------------------------|
| **テーブル名**          | **Prismaモデル**     | **役割**               |
| recurring_templates     | RecurringTemplate    | 定期支払テンプレート   |
| loan_contracts          | LoanContract         | 借入契約管理           |
| loan_schedules          | LoanSchedule         | 借入返済スケジュール   |
| lease_contracts         | LeaseContract        | リース契約管理         |
| lease_schedules         | LeaseSchedule        | リーススケジュール     |
| salary_journal_mappings | SalaryJournalMapping | 給与自動仕訳マッピング |

運用・監査

|                |                  |                        |
|----------------|------------------|------------------------|
| **テーブル名** | **Prismaモデル** | **役割**               |
| month_closes   | MonthClose       | 月締め管理             |
| audit_logs     | AuditLog         | 監査ログ（全変更履歴） |

3\. ER図（概念レベル）

以下に主要エンティティの関係を示す。実線は外部キー参照、点線は論理的な関連を表す。

コア構造

Company（会社）を頂点としたスター構造。全データは company_id で分離される。

Company 1:N → Account（口座）

Company 1:N → TradingPartner（取引先）

Company 1:N → Transaction（取引）

Company 1:N → PayrollGroup（給与グループ）

Company 1:N → LoanContract（借入契約）

Company 1:N → LeaseContract（リース契約）

Company 1:N → RecurringTemplate（定期テンプレ）

取引の親子構造

Transaction（親）1:N → Transaction（子）… parentId による自己参照

Transaction 1:N → TransactionDetail … 科目・金額の明細

Transaction 1:N → Evidence … 証憑ファイル

勘定科目の3階層

AccountCategoryMajor（大項目）1:N → AccountCategoryMid（中項目）1:N → AccountCategorySub（小項目）

取引先の階層

TradingPartner 1:N → TradingPartnerBankAccount（振込先口座）

TradingPartner 1:1 → TradingPartnerDefault（デフォルト科目）

TradingPartner 1:N → TradingPartnerSite（契約/地点テンプレ）

給与の構造

PayrollGroup 1:N → SalaryEntry（月次入力）

SalaryEntry 1:N → SalaryDeduction（控除明細）

SalaryEntry 1:N → SalaryPaymentDetail（支払内訳）

借入・リースの構造

LoanContract 1:N → LoanSchedule（返済スケジュール）

LeaseContract 1:N → LeaseSchedule（リーススケジュール）

4\. 主要テーブル定義

以下に各テーブルのカラム定義を記載する。型はPrisma/PostgreSQL対応を併記。

4.1 companies（会社マスタ）

グループ全12社の基本情報。マルチテナントの基盤テーブル。

|                               |               |          |                            |
|-------------------------------|---------------|----------|----------------------------|
| **カラム**                    | **型**        | **必須** | **説明**                   |
| id                            | String (cuid) | ○        | 主キー                     |
| name                          | String        | ○        | 会社名                     |
| nameKana                      | String?       |          | フリガナ                   |
| shortName                     | String?       |          | 略称（帳票表示名）         |
| industryType                  | String?       |          | 業種                       |
| representativeTitle           | String?       |          | 代表者役職                 |
| representativeName            | String?       |          | 代表者氏名                 |
| postalCode                    | String?       |          | 郵便番号                   |
| addressPrefecture〜Building   | String?       |          | 住所（4分割）              |
| phone / fax / email / website | String?       |          | 連絡先                     |
| corporateNumber               | String?       |          | 法人番号（13桁）           |
| invoiceNumber                 | String?       |          | インボイス登録番号         |
| fiscalMonth                   | Int           | ○        | 決算月（1〜12）デフォルト3 |
| status                        | String        | ○        | ACTIVE/DORMANT/LIQUIDATING |
| mainAccountId                 | String?       |          | メイン口座ID               |
| defaultAssigneeId             | String?       |          | 経費確認BOXデフォルト担当  |
| displayOrder                  | Int           | ○        | 表示順                     |

4.2 accounts（口座マスタ）

会社に紐づく銀行口座と仮想口座（社会保険積立・消費税積立）。会社登録時に仮想口座2つを自動生成する。

|                         |               |          |                                                                |
|-------------------------|---------------|----------|----------------------------------------------------------------|
| **カラム**              | **型**        | **必須** | **説明**                                                       |
| id                      | String (cuid) | ○        | 主キー                                                         |
| companyId               | String (FK)   | ○        | 会社ID → companies.id                                          |
| bankName / bankCode     | String?       |          | 銀行名・コード                                                 |
| branchName / branchCode | String?       |          | 支店名・コード                                                 |
| accountNumber           | String?       |          | 口座番号                                                       |
| accountType             | Enum          | ○        | ORDINARY/TERM/SOCIAL_INSURANCE_RESERVE/CONSUMPTION_TAX_RESERVE |
| accountHolder           | String?       |          | 名義カナ（半角）                                               |
| isMain                  | Boolean       | ○        | メイン口座フラグ（会社あたり原則1つ）                          |
| isVirtual               | Boolean       | ○        | 仮想口座フラグ                                                 |
| isActive / isVisible    | Boolean       | ○        | 有効フラグ / 表示フラグ                                        |
| displayOrder            | Int           | ○        | 表示順                                                         |
| fbSettings              | Json?         |          | FB出力設定（口座×用途）                                        |
| feeSettings             | Json?         |          | 手数料設定（本支店/他支店/他行×金額帯）                        |

4.3 transactions（取引データ）

経理くんの中核テーブル。全取引種別（経費/売上/原価/給与/借入/振替）を統一的に管理する。親子構造を持ち、parentIdによる自己参照で明細を表現する。

|                                 |                   |          |                                                 |
|---------------------------------|-------------------|----------|-------------------------------------------------|
| **カラム**                      | **型**            | **必須** | **説明**                                        |
| id                              | String (cuid)     | ○        | 主キー                                          |
| companyId                       | String (FK)       | ○        | 会社ID                                          |
| accountId                       | String (FK)       | ○        | 対象口座ID                                      |
| partnerId                       | String? (FK)      |          | 取引先ID                                        |
| type                            | Enum              | ○        | EXPENSE/SALES/COST_PAYMENT/SALARY/LOAN/TRANSFER |
| status                          | Enum              | ○        | DRAFT/READY/CONFIRMED/CANCELLED                 |
| transactionDate                 | DateTime?         |          | 実出納日（実際の入出金日）                      |
| scheduledDate                   | DateTime?         |          | 予定日                                          |
| accountingMonth                 | String            | ○        | 計上月（YYYY-MM）                               |
| amount                          | BigInt            | ○        | 金額（収入:正, 支出:負）                        |
| estimatedAmount                 | BigInt?           |          | 予定金額                                        |
| actualAmount                    | BigInt?           |          | 実績金額                                        |
| paymentMethod                   | Enum?             |          | BANK_TRANSFER/DIRECT_DEBIT/CASH_WITHDRAWAL      |
| classification                  | String?           |          | FIXED/VARIABLE/TEMPORARY（固定/変動/臨時）      |
| summary                         | String?           |          | 摘要                                            |
| displayOrder                    | Int               | ○        | 資金繰り表内の表示順（ドラッグ並替対応）        |
| confirmedAt / confirmedBy       | DateTime?/String? |          | 確定日時・確定者                                |
| invoiceDate / invoiceAmount     | DateTime?/BigInt? |          | 売上固有：請求締日・請求額                      |
| recordedAmount / transferAmount | BigInt?           |          | 原価固有：計上額・振込額                        |
| linkedTransactionId             | String?           |          | 会社間取引の相手取引ID                          |
| parentId                        | String? (FK)      |          | 親取引ID（自己参照）                            |
| hasEvidence                     | Boolean           | ○        | 証憑添付フラグ                                  |
| amountUpdatedAt                 | DateTime?         |          | 金額変更日時（更新時のみ記録）                  |

> *⚠ 複合インデックス：(companyId, accountId, accountingMonth) / (companyId, type, accountingMonth) / (parentId)*

4.4 transaction_details（取引明細）

取引の子明細。科目（中項目・小項目）、金額、区分を保持する。控除明細もここで管理する。

|                     |               |          |                                           |
|---------------------|---------------|----------|-------------------------------------------|
| **カラム**          | **型**        | **必須** | **説明**                                  |
| id                  | String (cuid) | ○        | 主キー                                    |
| transactionId       | String (FK)   | ○        | 親取引ID → transactions.id（CASCADE削除） |
| midId               | String? (FK)  |          | 中項目ID → account_category_mids.id       |
| subId               | String? (FK)  |          | 小項目ID → account_category_subs.id       |
| amount              | BigInt        | ○        | 金額                                      |
| classification      | String?       |          | FIXED/VARIABLE/TEMPORARY                  |
| summary             | String?       |          | 摘要                                      |
| deductionCategoryId | String?       |          | 控除カテゴリID（売上・原価控除用）        |
| deductionSubType    | String?       |          | 発生/相殺（前倒し・保留金等）             |
| signMultiplier      | Int           | ○        | 符号（1 or -1）小項目により自動決定       |
| displayOrder        | Int           | ○        | 表示順                                    |

4.5 monthly_balances（月次残高）

口座×年月で期首・期末残高を管理。資金繰り表のヘッダ情報として使用する。

|                |               |          |                 |
|----------------|---------------|----------|-----------------|
| **カラム**     | **型**        | **必須** | **説明**        |
| id             | String (cuid) | ○        | 主キー          |
| companyId      | String (FK)   | ○        | 会社ID          |
| accountId      | String (FK)   | ○        | 口座ID          |
| yearMonth      | String        | ○        | 年月（YYYY-MM） |
| openingBalance | BigInt        | ○        | 期首残高（円）  |
| closingBalance | BigInt        | ○        | 期末残高（円）  |

> *⚠ 一意制約：(accountId, yearMonth)。残高は取引の並替（ドラッグ）時に即時再計算される。*

4.6 salary_entries（給与入力データ）

給与グループ×支給月の合計入力。個人単位の管理は行わない。社保積立（15%）・消費税積立（10%）を自動計算する。

|                        |               |          |                                 |
|------------------------|---------------|----------|---------------------------------|
| **カラム**             | **型**        | **必須** | **説明**                        |
| id                     | String (cuid) | ○        | 主キー                          |
| payrollGroupId         | String (FK)   | ○        | 給与グループID                  |
| payMonth               | String        | ○        | 支給月（YYYY-MM）               |
| payDate                | DateTime?     |          | 支給日                          |
| taxablePayment         | BigInt        | ○        | 課税支給                        |
| transportAllowance     | BigInt        | ○        | 交通費                          |
| miscExpenses           | BigInt        | ○        | 諸経費                          |
| carryoverAdjust        | BigInt        | ○        | 繰越金調整                      |
| advanceExpenses        | BigInt        | ○        | 立替経費                        |
| totalPayment           | BigInt        | ○        | 総支給（自動計算）              |
| socialInsuranceReserve | BigInt        | ○        | 社保積立（課税支給×15%）        |
| consumptionTaxReserve  | BigInt        | ○        | 消費税積立（課税支給×10%）      |
| totalDeduction         | BigInt        | ○        | 控除合計                        |
| netPayment             | BigInt        | ○        | 差引支給（総支給-控除合計）     |
| headcount              | Int           | ○        | 人数                            |
| status                 | Enum          | ○        | DRAFT/READY/CONFIRMED/CANCELLED |

> *⚠ 一意制約：(payrollGroupId, payMonth)。整合チェック：①総支給-控除合計＝差引支給 ②差引支給＝支払内訳合計。*

4.7 loan_contracts（借入契約）

銀行借入の契約管理。元金均等・据置・一括返済に対応。金利変更履歴をJSON配列で保持する。

|                    |               |          |                                          |
|--------------------|---------------|----------|------------------------------------------|
| **カラム**         | **型**        | **必須** | **説明**                                 |
| id                 | String (cuid) | ○        | 主キー                                   |
| companyId          | String (FK)   | ○        | 会社ID                                   |
| principalAmount    | BigInt        | ○        | 借入金額                                 |
| executionDate      | DateTime      | ○        | 実行日                                   |
| repaymentMethod    | String        | ○        | EQUAL_PRINCIPAL/GRACE/BULLET/QUARTERLY等 |
| repaymentFrequency | String        | ○        | MONTHLY/QUARTERLY/SEMIANNUAL/ANNUAL      |
| interestType       | String        | ○        | FIXED/VARIABLE                           |
| interestRate       | Decimal       | ○        | 金利（%）                                |
| interestTiming     | String        | ○        | ADVANCE/ARREAR（前払/後払）              |
| dayCountBasis      | Int           | ○        | 日割基準（365/360）                      |
| roundingRule       | String        | ○        | ROUND_HALF_UP（四捨五入）等              |
| principalAdjust    | String        | ○        | 端数調整 FIRST/LAST                      |
| interestHistory    | Json?         |          | 金利変更履歴 \[{effectiveDate, rate}\]   |
| remainingBalance   | BigInt        | ○        | 残高                                     |

4.8 audit_logs（監査ログ）

Prisma Middlewareで自動記録。月締め後の変更ログ（変更者/日時/変更前後）と確定日時ログの要件に対応する。保持期間は無期限。

|            |               |          |                                                                 |
|------------|---------------|----------|-----------------------------------------------------------------|
| **カラム** | **型**        | **必須** | **説明**                                                        |
| id         | String (cuid) | ○        | 主キー                                                          |
| tableName  | String        | ○        | 対象テーブル名                                                  |
| recordId   | String        | ○        | 対象レコードID                                                  |
| operation  | String        | ○        | CREATE/UPDATE/DELETE/CONFIRM/UNCONFIRM/MONTH_CLOSE/MONTH_REOPEN |
| userId     | String        | ○        | 操作ユーザーID                                                  |
| timestamp  | DateTime      | ○        | 操作日時（自動）                                                |
| beforeData | Json?         |          | 変更前の値（UPDATE/DELETE時）                                   |
| afterData  | Json?         |          | 変更後の値（CREATE/UPDATE時）                                   |
| reason     | String?       |          | 変更理由（月締め解除時は必須）                                  |

> *⚠ インデックス：(tableName, recordId) / (userId, timestamp) / (timestamp)。*

5\. ビジネスルールとDB制約

5.1 月締め制御

month_closesテーブルのisClosed=trueの月は以下の制約が適用される。

- 金額の変更は不可（アプリケーション層でバリデーション）

- 摘要・科目の変更は可能（ただし監査ログに変更前後を記録）

- 取消（CANCELLED化）は不可

- 月締め解除は管理者のみ、理由入力必須。audit_logsにMONTH_REOPENとして記録

5.2 確定フロー

取引種別ごとに確定フローが異なる。共通して、statusの遷移はアプリケーション層で制御する。

経費

- 準備完了条件：金額＋証憑添付＋取引先

- 確定は中項目（科目）必須（未入力の場合は確定不可）

売上

- 2段階確定：①請求確定（入力者可、confirmedAt/confirmedBy記録）②入金・控除確定（管理者のみ）

- 整合チェック：差額（請求-実入金合計）と控除合計が一致しない場合は確定不可。許容差額なし（0円一致）

原価支払

- 確定条件：全額支払完了後、差額（計上額-実支払合計）と控除合計が一致

- 分割支払中は確定不可

給与

- 整合チェック：①総支給-控除合計＝差引支給 ②差引支給＝支払内訳合計

- 準備完了は入力者、確定は給与管理者ロール

5.3 資金移動の整合性

- 会社間：fund_transfersで双方向リンク。一方の修正・削除は相手側にも連動

- 同一会社内（A→B）：A口座に資金移動1本を表示。B口座に実際の支払明細を表示。明細データは二重保持しない（参照表示）

5.4 自動計算ルール

- 親の金額＝子明細合計（自動算出、直接更新しない）

- 残高＝期首残高＋当月取引合計（取引の並替時に即時再計算）

- 給与の社保積立＝課税支給×15%、消費税積立＝課税支給×10%（入力時点で表示、準備完了で仮想口座に自動反映）

- 借入の利息＝残高×金利÷日割基準×日数（四捨五入デフォルト）

5.5 ソフトデリートと履歴保持

- マスタ（会社・口座・取引先・科目）は物理削除しない。isActive=falseで無効化

- 取引が紐づくマスタは削除不可（アプリケーション層でチェック）

- 取消済取引（CANCELLED）は論理削除として扱い、資金繰り表のデフォルト印刷対象外とする

6\. インデックス設計

Prismaの@@indexおよび@@uniqueで定義する主要インデックスを以下に示す。

|                     |                                         |          |                              |
|---------------------|-----------------------------------------|----------|------------------------------|
| **テーブル**        | **インデックス**                        | **種別** | **目的**                     |
| transactions        | (companyId, accountId, accountingMonth) | 複合     | 資金繰り表の表示（主クエリ） |
| transactions        | (companyId, type, accountingMonth)      | 複合     | 取引種別×月の集計            |
| transactions        | (parentId)                              | 単体     | 子明細の取得                 |
| transaction_details | (transactionId)                         | 単体     | 親取引からの明細取得         |
| monthly_balances    | (accountId, yearMonth)                  | UNIQUE   | 口座×月の残高一意性          |
| salary_entries      | (payrollGroupId, payMonth)              | UNIQUE   | グループ×月の一意性          |
| loan_schedules      | (contractId)                            | 単体     | 契約からのスケジュール取得   |
| lease_schedules     | (contractId)                            | 単体     | 契約からのスケジュール取得   |
| audit_logs          | (tableName, recordId)                   | 複合     | 特定レコードの変更履歴       |
| audit_logs          | (userId, timestamp)                     | 複合     | ユーザー別の操作履歴         |
| audit_logs          | (timestamp)                             | 単体     | 時系列での検索               |
| month_closes        | (companyId, yearMonth)                  | UNIQUE   | 会社×月の月締め一意性        |
| account_roles       | (accountId, roleKey)                    | UNIQUE   | 口座×役割の一意性            |

7\. 実装メモ

7.1 Prisma Middlewareによる監査ログ

以下の擬似コードでPrisma Middlewareを実装し、対象テーブルへのCRUD操作を自動的にaudit_logsに記録する。

対象テーブル：transactions, transaction_details, salary_entries, salary_deductions, monthly_balances, month_closes, accounts, trading_partners, payroll_groups

除外テーブル：audit_logs（無限ループ防止）、evidences（ファイルメタのみ）

7.2 BigInt金額の取り扱い

- PostgreSQLのBIGINT型（Prisma BigInt）を使用。円単位で小数点なし

- フロントエンド表示時にカンマ区切り（Intl.NumberFormat）で整形

- JSON APIではstring型として送受信（JavaScriptのNumber型は53bit精度のため）

7.3 初期データ投入

- 銀行・支店マスタ：seedスクリプトで全銀コード一覧を投入

- 大項目（PL区分）：売上高/売上原価/販売管理費/営業外収益/営業外費用/その他費用を投入

- 中項目・小項目：要求定義書の科目マスタ一覧を投入（水道光熱費→電気代/ガス代/水道代 等）

- 給与自動仕訳マッピング：要求定義書6.5の対応表をseedで投入

- 会社マスタ：12社をseedで投入。各社に仮想口座2つ（社保積立・消費税積立）を自動生成

7.4 JSON型カラムの型定義

Prismaではjson型の中身はスキーマで定義できないため、TypeScript側で型を定義する。以下に主要なJSON型カラムの期待構造を示す。

- accounts.fbSettings: { purpose: string, requesterCode?: string, commissionerCode?: string }

- accounts.feeSettings: { sameBranch: \[{maxAmount, fee}\], otherBranch: \[...\], otherBank: \[...\] }

- loan_contracts.interestHistory: \[{ effectiveDate: string, rate: number }\]

- payroll_groups.deductionPresets: \[{ name: string, midId?: string, subId?: string }\]

- salary_deductions.contentRows: \[{ description: string, amount: number }\]

7.5 マイグレーション戦略（再掲）

要件定義書v1.2 セクション10.8で定義済み。開発時は prisma migrate dev、本番は prisma migrate deploy を使用する。破壊的変更は2段階方式で実施する。

8\. 次のステップ

|            |                       |                                                          |
|------------|-----------------------|----------------------------------------------------------|
| **優先度** | **タスク**            | **説明**                                                 |
| 1          | Prismaスキーマの確定  | 本書のレビュー完了後、schema.prismaをリポジトリに配置    |
| 2          | seedスクリプト作成    | 初期データ（銀行マスタ・科目マスタ・12社・仮想口座）投入 |
| 3          | Prisma Middleware実装 | 監査ログの自動記録                                       |
| 4          | API設計               | 各画面に対応するAPIエンドポイントの設計                  |
| 5          | 画面設計              | ワイヤーフレームの作成（任意）                           |
| 6          | Replitで開発開始      | 本スキーマを使ってプロトタイプ開発                       |
