import { test as setup, expect } from "@playwright/test"
import { RegisterPage } from "../pages/RegisterPage"

const AUTH_FILE = "e2e/.auth/user.json"

setup("create account and authenticate", async ({ page }) => {
  const timestamp = Date.now()
  const registerPage = new RegisterPage(page)
  await registerPage.goto()

  await registerPage.register(
    "E2Eテストユーザー",
    `e2e-${timestamp}@example.com`,
    "testpassword123"
  )

  // Wait for redirect to dashboard after registration
  await page.waitForURL("**/dashboard", { timeout: 15000 })
  await expect(page.getByRole("heading", { name: "ダッシュボード" })).toBeVisible()

  // Save auth state
  await page.context().storageState({ path: AUTH_FILE })
})
