// ============================================================
// PermissionTemplate 5件をシード
// 実行: npx tsx prisma/seed-permission-templates.ts
//
// 出典: docs/admin_phase1_implementation.md §6.4
// ============================================================

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type TemplateSeed = {
  key: string;
  name: string;
  description: string;
  permissions: string[];
  isBuiltIn: boolean;
  displayOrder: number;
};

const templates: TemplateSeed[] = [
  {
    key: "ACCOUNTING_OPERATOR",
    name: "経理オペレーター",
    description: "経費・売上・原価・給与の登録と編集。確定・月締めは不可。",
    permissions: [
      "expenses:view", "expenses:create", "expenses:edit",
      "sales:view", "sales:create", "sales:edit",
      "costs:view", "costs:create", "costs:edit",
      "salary:view", "salary:create", "salary:edit",
      "cashflow_table:view",
      "master.partners:view", "master.accounts:view", "master.categories:view",
    ],
    isBuiltIn: true,
    displayOrder: 10,
  },
  {
    key: "ACCOUNTING_MANAGER",
    name: "経理マネージャー",
    description: "経理オペレーター + 確定・月締め。",
    permissions: [
      "expenses:view", "expenses:create", "expenses:edit", "expenses:confirm",
      "sales:view", "sales:create", "sales:edit", "sales:confirm",
      "costs:view", "costs:create", "costs:edit", "costs:confirm",
      "salary:view", "salary:create", "salary:edit", "salary:confirm",
      "cashflow_table:view", "month:lock",
      "master.partners:view", "master.partners:edit",
      "master.accounts:view", "master.accounts:edit",
      "master.categories:view", "master.categories:edit",
    ],
    isBuiltIn: true,
    displayOrder: 20,
  },
  {
    key: "SALES_STAFF",
    name: "営業担当",
    description: "売上の登録のみ。",
    permissions: [
      "sales:view", "sales:create", "sales:edit",
      "master.partners:view",
      "cashflow_table:view",
    ],
    isBuiltIn: true,
    displayOrder: 30,
  },
  {
    key: "PAYROLL_STAFF",
    name: "給与担当",
    description: "給与の登録のみ。",
    permissions: [
      "salary:view", "salary:create", "salary:edit", "salary:confirm",
      "master.payroll_groups:view", "master.deduction_categories:view",
    ],
    isBuiltIn: true,
    displayOrder: 40,
  },
  {
    key: "EXECUTIVE_VIEWER",
    name: "役員（閲覧）",
    description: "全機能の閲覧のみ。",
    permissions: [
      "expenses:view", "sales:view", "costs:view", "salary:view",
      "cashflow_table:view", "reports:view", "journal:view",
      "dashboard:view",
    ],
    isBuiltIn: true,
    displayOrder: 50,
  },
];

async function main() {
  console.log("🌱 Seeding PermissionTemplate...");

  for (const t of templates) {
    await prisma.permissionTemplate.upsert({
      where: { key: t.key },
      create: {
        key: t.key,
        name: t.name,
        description: t.description,
        permissions: t.permissions,
        isBuiltIn: t.isBuiltIn,
        displayOrder: t.displayOrder,
      },
      update: {
        name: t.name,
        description: t.description,
        permissions: t.permissions,
        isBuiltIn: t.isBuiltIn,
        displayOrder: t.displayOrder,
      },
    });
    console.log(`  ✓ ${t.key}: ${t.name}`);
  }

  const total = await prisma.permissionTemplate.count();
  console.log(`\n✅ Done. PermissionTemplate count = ${total}`);
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
