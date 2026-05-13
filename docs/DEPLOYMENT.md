# Vercelデプロイ手順

## 前提

- Supabaseプロジェクト (PostgreSQL + Storage) が稼働中
- Storageバケット `fina-evidences` が作成済み
- GitHubリポジトリにpush済み

## 1. Vercelプロジェクトの作成

1. https://vercel.com/new からGitHubリポジトリをインポート
2. Framework Preset: **Next.js** (自動検出)
3. Root Directory: `./` (リポジトリルート)
4. Build Command: `npm run vercel-build` (vercel.jsonで指定済み)
5. Install Command: デフォルト (`npm install`) でOK

## 2. 環境変数の設定

Vercel Dashboard → Project Settings → Environment Variables で以下を設定。

| 変数名 | Production | Preview | Development | 例 |
|---|---|---|---|---|
| `DATABASE_URL` | ✅ | ✅ | ✅ | `postgresql://postgres.xxx:pw@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true&schema=fina` |
| `DIRECT_URL` | ✅ | ✅ | ✅ | `postgresql://postgres.xxx:pw@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres?schema=fina` |
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | ✅ | ✅ | `https://xxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | ✅ | ✅ | `sb_publishable_...` |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | ✅ | ✅ | `sb_secret_...` ⚠️ Sensitive |
| `BETTER_AUTH_SECRET` | ✅ | ✅ | ✅ | `openssl rand -hex 32` で生成 ⚠️ Sensitive |
| `BETTER_AUTH_URL` | ✅ | — | — | `https://your-app.vercel.app` (Production用ドメインに合わせる) |

> Preview環境では `BETTER_AUTH_URL` を未設定にすると `VERCEL_URL` から自動でhttps URLが組み立てられる (`lib/auth.ts` で実装)。

## 3. データベース接続のポイント

- **`DATABASE_URL`**: Transaction Pooler (6543) を使用。サーバーレス関数からの短命接続向け。
- **`DIRECT_URL`**: Session Pooler (5432) を使用。`prisma migrate deploy` でビルド時に使われる。
- `pgbouncer=true` パラメータを `DATABASE_URL` に必ず付与する。

## 4. ビルド・デプロイ

1. GitHubリポジトリの対象ブランチ (例: `main`) にpush
2. Vercelが自動でビルドを開始
3. ビルド時に以下が実行される:
   - `npm install` (`postinstall` で `prisma generate` も実行)
   - `npm run vercel-build` = `prisma generate && prisma migrate deploy && next build`

## 5. デプロイ後の確認

- [ ] `/login` にアクセスでき、ログインフォームが表示される
- [ ] アカウント作成 → ログインが成功する (Cookieが `__Secure-better-auth.session_token` で発行される)
- [ ] ダッシュボードが表示される
- [ ] 証憑アップロードができる (Supabase Storage接続)
- [ ] Network → APIレスポンス内に環境変数が漏れていない

## 6. カスタムドメインを使う場合

1. Vercel Dashboard → Domains で独自ドメインを追加
2. `BETTER_AUTH_URL` をそのドメインに更新 (例: `https://fina.example.com`)
3. 再デプロイ

## トラブルシューティング

### `Error: PrismaClient is unable to run in this browser environment`
→ クライアントコンポーネントから直接 `prisma` をimportしている。Server Component / API Routeに移す。

### ログイン後すぐにログアウトされる
→ `BETTER_AUTH_URL` が実際のホスト名と一致していない。Production環境変数を確認。

### `prisma migrate deploy` がビルド時に失敗
→ `DIRECT_URL` が未設定、もしくはSupabaseのSession Pooler (5432) を指していない。

### 関数のタイムアウト
→ `vercel.json` の `maxDuration` を調整 (現在30秒)。Hobbyプランは最大10秒なので Pro 以上が必要。
