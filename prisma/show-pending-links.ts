// ============================================================
// 申請承認 / 招待 / パスリセット で発行されたリンクを一覧表示
//
// Resend など本物のメール送信が未統合のうちは、サーバ ログを掘らずに
// このスクリプトで全リンクを取り出してブラウザに貼ればよい。
//
// 実行: npx tsx prisma/show-pending-links.ts
// ============================================================

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3003";

async function main() {
  console.log(`📋 ベース URL: ${BASE_URL}\n`);

  // ---------- 1. PasswordResetToken (未使用かつ未失効) ----------
  console.log("=".repeat(72));
  console.log("🔑 未使用の パスワード設定 / リセット リンク");
  console.log("=".repeat(72));
  const tokens = await prisma.passwordResetToken.findMany({
    where: { consumedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  if (tokens.length === 0) {
    console.log("  (なし)\n");
  } else {
    for (const t of tokens) {
      const user = await prisma.user.findUnique({
        where: { id: t.userId },
        select: { email: true, name: true },
      });
      console.log(`\n  📧 ${user?.email ?? "(不明)"} (${user?.name ?? ""})`);
      console.log(`     有効期限: ${t.expiresAt.toISOString()}`);
      console.log(`     ※ 生トークン (生成時のみ取得可) はDBに保存されないため、`);
      console.log(`        承認時に console.log された URL から取得 or 新規発行が必要。`);
      console.log(`     userId: ${t.userId}`);
    }
    console.log();
  }

  // ---------- 2. 直近の承認済申請 ----------
  console.log("=".repeat(72));
  console.log("✅ 直近 ACCEPTED 申請 (createdUserId が紐付いている)");
  console.log("=".repeat(72));
  const accepted = await prisma.companyApplication.findMany({
    where: { status: "ACCEPTED" },
    orderBy: { reviewedAt: "desc" },
    take: 10,
  });
  if (accepted.length === 0) {
    console.log("  (なし)\n");
  } else {
    for (const a of accepted) {
      console.log(`\n  📧 ${a.applicantEmail} (${a.applicantName})`);
      console.log(`     会社名: ${a.companyName}`);
      console.log(`     承認日時: ${a.reviewedAt?.toISOString() ?? "?"}`);
      console.log(`     createdUserId:    ${a.createdUserId ?? "(null)"}`);
      console.log(`     createdCompanyId: ${a.createdCompanyId ?? "(null)"}`);
    }
    console.log();
  }

  // ---------- 3. 招待状 PENDING (再送可能) ----------
  console.log("=".repeat(72));
  console.log("✉️  PENDING 招待状 (招待リンク = /accept?token=ID)");
  console.log("=".repeat(72));
  const invitations = await prisma.userInvitation.findMany({
    where: { status: "PENDING" },
    orderBy: { invitedAt: "desc" },
    take: 10,
  });
  if (invitations.length === 0) {
    console.log("  (なし)\n");
  } else {
    for (const inv of invitations) {
      console.log(`\n  📧 ${inv.email ?? "(no email)"} (${inv.displayName})`);
      console.log(`     companyId: ${inv.companyId}`);
      console.log(`     有効期限: ${inv.expiresAt.toISOString()}`);
      console.log(`     リンク:`);
      console.log(`     ${BASE_URL}/accept?token=${inv.id}`);
    }
    console.log();
  }

  console.log("=".repeat(72));
  console.log(
    "💡 PasswordResetToken は『生トークンを DB に保存しない』設計のため、",
  );
  console.log(
    "   承認時に出た console.log を見逃した場合は、",
  );
  console.log(
    "   /forgot-password にメアドを入れて再発行してください。",
  );
  console.log("=".repeat(72));
}

main()
  .catch((e) => {
    console.error("❌", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
