// ============================================================
// 指定メアドのユーザーを SUPER_ADMIN に昇格 (または新規作成)
//
// 使い方:
//   既存ユーザーの昇格:
//     npx tsx prisma/promote-super-admin.ts <email>
//
//   新規 User を作成して SUPER_ADMIN にする:
//     npx tsx prisma/promote-super-admin.ts <email> <password> [displayName]
//
//   例:
//     npx tsx prisma/promote-super-admin.ts haruto@example.com
//     npx tsx prisma/promote-super-admin.ts h.oomuro@winners.jp 'Hokibo1!' '大室春翔'
//
// 出典: docs/admin_phase1_implementation.md §6.3 (P1) / acceptInvitation のロジック流用
// ============================================================

import { PrismaClient } from "@prisma/client";
import { randomBytes } from "crypto";

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  const password = process.argv[3];
  const displayNameArg = process.argv[4];

  if (!email) {
    console.error("Usage:");
    console.error("  既存ユーザーを昇格:   npx tsx prisma/promote-super-admin.ts <email>");
    console.error("  新規ユーザー作成:     npx tsx prisma/promote-super-admin.ts <email> <password> [displayName]");
    process.exit(1);
  }

  console.log(`🔍 Looking up user by email: ${email}`);
  let user = await prisma.user.findUnique({ where: { email } });

  // ---------- 既存ユーザー + パスワード指定 → パスワード更新 ----------
  if (user && password) {
    if (password.length < 8) {
      console.error(`❌ パスワードは 8 文字以上にしてください`);
      process.exit(1);
    }
    console.log(`🔑 既存ユーザーのパスワードを更新します`);
    const { hashPassword } = await import("better-auth/crypto");
    const hashed = await hashPassword(password);

    // AuthAccount (providerId="credential") を upsert
    const existingAccount = await prisma.authAccount.findFirst({
      where: { userId: user.id, providerId: "credential" },
    });
    if (existingAccount) {
      await prisma.authAccount.update({
        where: { id: existingAccount.id },
        data: { password: hashed, updatedAt: new Date() },
      });
    } else {
      await prisma.authAccount.create({
        data: {
          id: `acc_${randomBytes(12).toString("hex")}`,
          accountId: user.id,
          providerId: "credential",
          userId: user.id,
          password: hashed,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
    }

    // 既存セッションを無効化 (安全のため)
    await prisma.session.deleteMany({ where: { userId: user.id } });

    console.log(`✅ パスワードを更新しました`);
    console.log(`   email:    ${email}`);
    console.log(`   password: ${password}`);
    console.log(`   全セッションを無効化しました (再ログインが必要)`);
    // ここから先で SUPER_ADMIN 昇格処理を続行
  }

  // ---------- 新規 User 作成パス ----------
  if (!user) {
    if (!password) {
      console.error(`❌ User not found: ${email}`);
      console.log(`\n📋 既存ユーザー一覧:`);
      const all = await prisma.user.findMany({
        select: { email: true, name: true },
        orderBy: { createdAt: "asc" },
      });
      if (all.length === 0) {
        console.log(`   (no users)`);
      } else {
        for (const u of all) {
          console.log(`   - ${u.email}  (${u.name})`);
        }
      }
      console.log(`\n💡 新規 User を作成する場合は password を指定してください:`);
      console.log(`   npx tsx prisma/promote-super-admin.ts ${email} <password> [displayName]`);
      process.exit(1);
    }

    if (password.length < 8) {
      console.error(`❌ パスワードは 8 文字以上にしてください`);
      process.exit(1);
    }

    const displayName = displayNameArg?.trim() || email.split("@")[0];

    console.log(`📝 User が存在しないので新規作成します`);
    console.log(`   email:       ${email}`);
    console.log(`   displayName: ${displayName}`);

    // better-auth/crypto でハッシュ
    const { hashPassword } = await import("better-auth/crypto");
    const hashed = await hashPassword(password);

    const userId = `usr_${randomBytes(12).toString("hex")}`;
    const accountId = `acc_${randomBytes(12).toString("hex")}`;
    const profileId = `prf_${randomBytes(12).toString("hex")}`;
    const now = new Date();

    await prisma.$transaction(async (tx) => {
      await tx.user.create({
        data: {
          id: userId,
          email,
          name: displayName,
          emailVerified: true,
          createdAt: now,
          updatedAt: now,
        },
      });
      await tx.authAccount.create({
        data: {
          id: accountId,
          accountId: userId,
          providerId: "credential",
          userId,
          password: hashed,
          createdAt: now,
          updatedAt: now,
        },
      });
      await tx.userProfile.create({
        data: {
          id: profileId,
          authUserId: userId,
          scopeRole: "SUPER_ADMIN",
          displayName,
          primaryCompanyId: null,
          assignedCompanyIds: [],
          authProvider: "LOCAL",
          templateKey: null,
          isActive: true,
        },
      });
    });

    console.log(`\n✅ User + UserProfile を作成し SUPER_ADMIN に設定`);
    console.log(`   userId:    ${userId}`);
    console.log(`   profileId: ${profileId}`);
    console.log(`   scopeRole: SUPER_ADMIN`);
    console.log(`\n🔑 ログイン情報:`);
    console.log(`   email:    ${email}`);
    console.log(`   password: ${password}`);
    console.log(`\n→ http://localhost:3003/login でログインできます`);
    return;
  }

  // ---------- 既存 User の昇格パス ----------
  let profile = await prisma.userProfile.findUnique({
    where: { authUserId: user.id },
  });

  if (!profile) {
    const displayName = displayNameArg?.trim() || user.name || email;
    console.log(`📝 UserProfile が無いので新規作成して SUPER_ADMIN にします`);
    profile = await prisma.userProfile.create({
      data: {
        authUserId: user.id,
        scopeRole: "SUPER_ADMIN",
        displayName,
        primaryCompanyId: null,
        templateKey: null,
        assignedCompanyIds: [],
        isActive: true,
        authProvider: "LOCAL",
      },
    });
    console.log(`\n✅ UserProfile を作成し SUPER_ADMIN に設定`);
    console.log(`   id:          ${profile.id}`);
    console.log(`   displayName: ${profile.displayName}`);
    console.log(`   scopeRole:   ${profile.scopeRole}`);
    return;
  }

  console.log(`📋 Current state:`);
  console.log(`   id:               ${profile.id}`);
  console.log(`   displayName:      ${profile.displayName}`);
  console.log(`   scopeRole:        ${profile.scopeRole}`);
  console.log(`   primaryCompanyId: ${profile.primaryCompanyId ?? "(null)"}`);
  console.log(`   templateKey:      ${profile.templateKey ?? "(null)"}`);

  if (profile.scopeRole === "SUPER_ADMIN") {
    console.log(`\n⚠ Already SUPER_ADMIN. No change.`);
    return;
  }

  const updated = await prisma.userProfile.update({
    where: { id: profile.id },
    data: {
      scopeRole: "SUPER_ADMIN",
      primaryCompanyId: null,
      templateKey: null,
    },
  });

  console.log(`\n✅ Promoted to SUPER_ADMIN`);
  console.log(`   id:        ${updated.id}`);
  console.log(`   scopeRole: ${updated.scopeRole}`);
}

main()
  .catch((e) => {
    console.error("❌ Promotion failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
