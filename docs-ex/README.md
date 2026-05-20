# 経理くん (fina) 開発者ドキュメント

経理くんの **画面・コード・データの対応関係** をまとめた開発者向けドキュメント群。

`docs/` (業務向けマニュアル・要件定義書) と分離して、ソースコードと一対一対応する情報を集約しています。

---

## 構成と役割分担

```
docs-ex/
├── README.md                ← 本書 (索引・ナビゲーション)
├── page-source-map.md       ← 画面 ↔ ソースコード 参照表
├── screen-specification.md  ← 全画面の仕様 + 横断ルール
└── screen-details.md        ← 画面ごとの深掘り詳細 (1ファイルに集約)
```

### 3 つのドキュメントの違い

| ドキュメント | 役割 | 行数 |
|---|---|---|
| [`page-source-map.md`](page-source-map.md) | **画面 ↔ ファイル** の参照表 | ~450 行 |
| [`screen-specification.md`](screen-specification.md) | **全画面の仕様 + 横断ルール** | ~1,000 行 |
| [`screen-details.md`](screen-details.md) | **1 画面ごとの深掘り詳細** (28 画面) | ~4,500 行 |

### より細かい比較

| 観点 | page-source-map | screen-specification | screen-details |
|---|---|---|---|
| URL リスト | ✅ | ✅ | ✅ |
| page.tsx ファイルパス | ✅ | ✅ | ✅ |
| Server Actions 一覧 | ✅ | ✅ | ✅ |
| **横断ルール** (権限・月締め・自動仕訳など) | ❌ | ✅ 第Ⅰ部 | ❌ (各画面に分散) |
| **画面の UI 構成** | ❌ | △ サマリ | ✅ 詳細 |
| **入力フォーム項目テーブル** | ❌ | △ サマリ | ✅ 型・必須・説明 |
| **ステータス遷移** | ❌ | ✅ 共通パターン | ✅ 個別 |
| **業務ルール** | ❌ | ✅ | ✅ |
| **Prisma 書き込みフィールド** | ❌ | ❌ | ✅ |
| **エラーメッセージ** | ❌ | ❌ | ✅ |
| **ソースコード行番号参照** | ❌ | ❌ | ✅ |
| **データモデル ER 図** | ❌ | ✅ 第Ⅳ部 | ❌ |
| **業務フロー** (月初/月末) | ❌ | ✅ 第Ⅲ部 | ❌ |
| **用語集** | ❌ | ✅ 付録 | ❌ |

---

## 用途別の読み始めるドキュメント

### 「`/expenses` のコードはどこ？」 — コードを探す
→ [`page-source-map.md`](page-source-map.md) を grep / 検索

### 「経費入力って何ができるの？」 — 画面の全貌を理解
→ [`screen-details.md`](screen-details.md) 内の **「経費入力」** セクション

### 「全画面の権限ってどうなってる？」 — 横断的な仕様を知る
→ [`screen-specification.md`](screen-specification.md) 第Ⅰ部 「2. 権限制御マトリクス」

### 「月締めの仕組みって？」 — システム全体の業務ルールを知る
→ [`screen-specification.md`](screen-specification.md) 第Ⅰ部 「3. 月締めロック仕様」

### 「fina ってどんなシステム？」 — 全体像を把握 (新人向け)
→ [`screen-specification.md`](screen-specification.md) を上から読む (第Ⅰ部 → 第Ⅱ部 → 業務フロー)

### 「新画面を追加するときの参考は？」 — 既存パターンを学ぶ
→ [`screen-details.md`](screen-details.md) 内の似た画面セクションを参照して構造を真似る

---

## メンテナンス方針

### 画面を追加したとき

1. [`page-source-map.md`](page-source-map.md) の該当カテゴリにエントリ追加
2. [`screen-details.md`](screen-details.md) に画面セクションを追加 (既存セクションを雛形にコピー)
3. [`screen-specification.md`](screen-specification.md) 第Ⅱ部に画面別仕様を追記

### 画面を削除したとき

1. [`page-source-map.md`](page-source-map.md) から削除
2. [`screen-details.md`](screen-details.md) から該当セクション削除
3. [`screen-specification.md`](screen-specification.md) から該当セクション削除
4. 他の画面の「関連画面」リンクから参照を除去

### 横断ルールを変えたとき (権限・月締め・自動仕訳など)

1. [`screen-specification.md`](screen-specification.md) 第Ⅰ部を更新 (一次情報)
2. 影響を受ける [`screen-details.md`](screen-details.md) の各画面セクションを更新

---

## 関連ドキュメント

| ドキュメント | 置き場所 | 内容 |
|---|---|---|
| 業務向けマニュアル | [`../docs/USER_MANUAL.md`](../docs/USER_MANUAL.md) | エンドユーザー (経理担当者) 向け |
| 要件定義書 | [`../docs/requirements.md`](../docs/requirements.md) | システム要求仕様 |
| DB 設計書 | [`../docs/db_design.md`](../docs/db_design.md) | Prisma スキーマ解説 |
| PDF 要件との差分 | [`../docs/pdf_vs_implementation_diff.md`](../docs/pdf_vs_implementation_diff.md) | 要件 PDF と実装の差分管理 |
| デプロイガイド | [`../docs/DEPLOYMENT.md`](../docs/DEPLOYMENT.md) | Vercel + Supabase の設定 |
