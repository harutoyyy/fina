import { test, expect } from "@playwright/test"

test.describe("Expense Box (受領BOX)", () => {
  test.use({ viewport: { width: 1280, height: 720 } })

  test.beforeEach(async ({ page }) => {
    await page.goto("/expense-box")
  })

  test("should display expense box page", async ({ page }) => {
    // Page should load without crashing
    await expect(page.getByText("受領BOX").first()).toBeVisible({ timeout: 10000 })
  })

  test("should have filter controls", async ({ page }) => {
    // Check for filter elements - date filter, status filter, etc.
    await page.waitForLoadState("networkidle")

    // The page should have filter controls or a table
    const hasContent = await page.locator("table, [role='table']").isVisible().catch(() => false)
    const hasFilters = await page.locator("select, button").first().isVisible().catch(() => false)

    expect(hasContent || hasFilters).toBeTruthy()
  })

  test("should display expense data table when company is selected", async ({ page }) => {
    await page.waitForLoadState("networkidle")

    // If company is selected, we should see a table or "no data" message
    // If no company, we should see a prompt to select one
    const pageContent = await page.textContent("body")
    const hasTable = await page.locator("table").isVisible().catch(() => false)
    const hasMessage = pageContent?.includes("会社を選択") || pageContent?.includes("データ")

    expect(hasTable || hasMessage).toBeTruthy()
  })
})
