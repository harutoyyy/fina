// ============================================================
// 指定メアドのユーザーに対して、新規のパスワード設定リンクを即発行する。
// (Resend 統合前にメール経路無しでも初回パスワード設定したい場合用)
//
// 実行: npx tsx prisma/issue-reset-link.ts <email>
// 例:   npx tsx prisma/issue-reset-link.ts haluomu0530@gmail.com
// ============================================================

import { PrismaClient } from "@prisma/client";
import { randomBytes, createHash } from "crypto";

const prisma = new PrismaClient();

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3003";
const TTL_MINUTES = 60; // メール経由ではないので少し長めに

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) {
    console.error("Usage: npx tsx prisma/issue-reset-link.ts <email>");
    process.exit(1);
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`❌ User not found: ${email}`);
    process.exit(1);
  }

  // 生トークン生成 → ハッシュを DB 保存
  const rawToken = randomBytes(32).toString("hex"); // 64 chars
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(Date.now() + TTL_MINUTES * 60 * 1000);

  // 既存の未消費トークンを invalidate (任意)
  await prisma.passwordResetToken.updateMany({
    where: { userId: user.id, consumedAt: null },
    data: { consumedAt: new Date() },
  });

  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt,
      requestedBy: null, // セルフサービス相当
    },
  });

  const url = `${BASE_URL}/reset-password?token=${rawToken}`;

  console.log("\n✅ パスワード設定リンクを発行しました\n");
  console.log("  対象:     ", email, `(${user.name})`);
  console.log("  有効期限: ", expiresAt.toISOString(), `(${TTL_MINUTES} 分)`);
  console.log("\n🔗 このリンクをブラウザで開いてください:\n");
  console.log("  " + url);
  console.log("\n💡 ワンタイム使用です。クリックして新パスワードを設定したらこのリンクは無効になります。\n");
}

main()
  .catch((e) => {
    console.error("❌", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
