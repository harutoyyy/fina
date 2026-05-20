// ============================================================
// シークレット保管ユーティリティ (Phase 5: スタブ実装)
// ============================================================
//
// PWDX 連携用の API キー等を暗号化して保管するためのユーティリティ。
//
// TODO(KMS): 本格的な KMS 統合は Phase 5 完成後に実装予定。
//   候補:
//     - AWS KMS  (推奨: 既存 AWS インフラがある場合)
//     - GCP KMS
//     - Vercel KV + 自前 AES-256-GCM 暗号化
//     - HashiCorp Vault
//
//   現状はローカル開発のためのスタブ実装。
//   - `storeSecret`: credentialKey を生成し、ローカル環境では `process.env.FINA_SECRETS_<key>`
//     にプレーンで設定されたシークレット値を期待する。実体は DB の credentialKey 列に
//     KMS の参照キー (= storeSecret が返した値) のみを保存する。
//   - `getSecret`: 同上。`process.env.FINA_SECRETS_<key>` を返す。
//
//   本実装時の変更箇所:
//     1. `storeSecret`: KMS に対して暗号化済値の格納 + 参照キー発行
//     2. `getSecret`:   KMS から参照キーで復号値を取得
//     3. `rotateSecret`: KMS 上で旧キーを失効し、新キーを発行
//     4. 環境変数 `KMS_PROVIDER`, `KMS_KEY_ID` 等の追加
//
// 設計詳細: docs/admin_and_auth_design.md §11.1
// ============================================================

import { randomBytes } from "crypto"

/**
 * シークレット参照キーのプレフィックス。
 * DB の credentialKey 列にはこの形式の文字列のみを保存する。
 */
const SECRET_KEY_PREFIX = "secret_"

/**
 * シークレットを格納し、参照キー (credentialKey) を返す。
 *
 * 本実装では KMS にシークレットを暗号化保存し、KMS 上の識別子を返すべきだが、
 * スタブとして `secret_<scope>_<random>` 形式の文字列を返す。
 *
 * @param scope  シークレットの所属範囲 (例: companyId)
 * @param value  プレーンシークレット値 (今は使用していない: 環境変数で代用)
 * @returns      DB に保存する参照キー
 */
export async function storeSecret(scope: string, value: string): Promise<string> {
  // TODO(KMS): 本実装では value を KMS に暗号化保存する
  // 現状のスタブは scope と乱数のみで参照キーを生成し、value は無視する
  void value
  const rand = randomBytes(12).toString("hex")
  return `${SECRET_KEY_PREFIX}${scope}_${rand}`
}

/**
 * 参照キーからプレーンシークレットを取得する。
 *
 * スタブ実装では、`process.env.FINA_SECRETS_<scope>` を返す。
 * 本実装では KMS の参照キーから復号値を取得する。
 *
 * @param credentialKey  DB の credentialKey 列に保存されている参照キー
 * @returns              プレーンシークレット (見つからない場合は null)
 */
export async function getSecret(credentialKey: string): Promise<string | null> {
  // TODO(KMS): 本実装では credentialKey を使って KMS から復号値を取得する
  if (!credentialKey.startsWith(SECRET_KEY_PREFIX)) {
    return null
  }
  // 参照キーは `secret_<scope>_<rand>` 形式。scope は env 変数名に対応する
  const withoutPrefix = credentialKey.slice(SECRET_KEY_PREFIX.length)
  const scope = withoutPrefix.split("_").slice(0, -1).join("_")
  if (!scope) return null
  return process.env[`FINA_SECRETS_${scope.toUpperCase()}`] ?? null
}

/**
 * シークレットを回転 (rotation) し、新しい参照キーを返す。
 * 旧キーは失効させる (KMS 統合後)。
 *
 * @param scope        シークレットの所属範囲 (例: companyId)
 * @param oldKey       旧参照キー (失効対象)
 * @param newValue     新しいプレーンシークレット値 (今は使用していない)
 * @returns            新しい参照キー
 */
export async function rotateSecret(
  scope: string,
  oldKey: string,
  newValue: string,
): Promise<string> {
  // TODO(KMS): 本実装では以下を行う
  //   1. 新シークレットを KMS に保存して新参照キーを取得
  //   2. 旧参照キー (oldKey) を KMS 上で失効処理
  void oldKey
  return storeSecret(scope, newValue)
}

/**
 * 参照キーをマスクして表示する。UI で "********" として見せたい場合に使う。
 *
 * @param credentialKey  DB の credentialKey 列の値
 * @returns              マスクされた文字列 (例: "secret_<prefix>...")
 */
export function maskSecretKey(credentialKey: string | null | undefined): string {
  if (!credentialKey) return ""
  if (credentialKey.length <= 12) return "********"
  return credentialKey.slice(0, 10) + "..." + "*".repeat(8)
}
