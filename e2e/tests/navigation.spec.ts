import { test, expect } from "@playwright/test"

test.describe("Sidebar Navigation", () => {
  // Use larger viewport for sidebar visibility
  test.use({ viewport: { width: 1280, height: 720 } })

  test("should show sidebar with all navigation sections", async ({ page }) => {
    await page.goto("/dashboard")
    await expect(page.getByRole("heading", { name: "ダッシュボード" })).toBeVisible()

    // Main navigation
    await expect(page.getByRole("link", { name: "ダッシュボード" })).toBeVisible()
    await expect(page.getByRole("link", { name: "資金繰り表" })).toBeVisible()
    await expect(page.getByRole("link", { name: "資金移動" })).toBeVisible()

    // Input section
    await expect(page.getByRole("link", { name: "経費入力" })).toBeVisible()
    await expect(page.getByRole("link", { name: "経費確定BOX" })).toBeVisible()
    await expect(page.getByRole("link", { name: "売上入力" })).toBeVisible()
    await expect(page.getByRole("link", { name: "原価支払" })).toBeVisible()
    await expect(page.getByRole("link", { name: "給与入力" })).toBeVisible()

    // Management section
    await expect(page.getByRole("link", { name: "借入管理" })).toBeVisible()
    await expect(page.getByRole("link", { name: "リース管理" })).toBeVisible()
    await expect(page.getByRole("link", { name: "月次処理" })).toBeVisible()

    // Master section
    await expect(page.getByRole("link", { name: "会社一覧" })).toBeVisible()
    await expect(page.getByRole("link", { name: "銀行口座" })).toBeVisible()
    await expect(page.getByRole("link", { name: "取引先" })).toBeVisible()
  })

  const navRoutes = [
    { name: "資金繰り表", path: "/cashflow-table" },
    { name: "資金移動", path: "/cashflow" },
    { name: "経費入力", path: "/expenses" },
    { name: "経費確定BOX", path: "/expense-box" },
    { name: "売上入力", path: "/sales" },
    { name: "原価支払", path: "/costs" },
    { name: "給与入力", path: "/salary" },
    { name: "借入管理", path: "/loans" },
    { name: "会社一覧", path: "/master/companies" },
    { name: "銀行口座", path: "/master/accounts" },
    { name: "取引先", path: "/master/partners" },
    { name: "勘定科目", path: "/master/categories" },
  ]

  for (const route of navRoutes) {
    test(`should navigate to ${route.name}`, async ({ page }) => {
      // Increase timeout for webpack initial compilation
      test.setTimeout(60000)

      await page.goto("/dashboard")
      await expect(page.getByRole("link", { name: route.name })).toBeVisible()
      await page.getByRole("link", { name: route.name }).click()
      await page.waitForURL(`**${route.path}`, { timeout: 30000 })
      expect(page.url()).toContain(route.path)
    })
  }
})
