import { test, expect } from "@playwright/test"
import { DashboardPage } from "../pages/DashboardPage"

test.describe("Dashboard", () => {
  test("should display dashboard heading and cards", async ({ page }) => {
    const dashboard = new DashboardPage(page)
    await dashboard.goto()

    await expect(dashboard.heading).toBeVisible()
    await expect(dashboard.accountCountCard).toBeVisible()
    await expect(dashboard.partnerCountCard).toBeVisible()
    await expect(dashboard.transactionCountCard).toBeVisible()
  })

  test("should show company info or setup guide", async ({ page }) => {
    const dashboard = new DashboardPage(page)
    await dashboard.goto()

    // Either a company is selected (shows company name) or setup guide is shown
    const hasCompany = await page.getByText("の概要").isVisible().catch(() => false)
    const hasSetupGuide = await dashboard.setupGuide.isVisible().catch(() => false)

    expect(hasCompany || hasSetupGuide).toBeTruthy()
  })
})
