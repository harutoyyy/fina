import { test, expect } from "@playwright/test"
import { LoginPage } from "../pages/LoginPage"
import { RegisterPage } from "../pages/RegisterPage"

// These tests run without stored auth state
test.use({ storageState: { cookies: [], origins: [] } })

test.describe("Login Page", () => {
  test("should display login form", async ({ page }) => {
    const loginPage = new LoginPage(page)
    await loginPage.goto()

    await expect(page.getByText("経理くん")).toBeVisible()
    await expect(page.getByText("ログイン").first()).toBeVisible()
    await expect(loginPage.emailInput).toBeVisible()
    await expect(loginPage.passwordInput).toBeVisible()
    await expect(loginPage.submitButton).toBeVisible()
    await expect(loginPage.registerLink).toBeVisible()
  })

  test("should show error on invalid credentials", async ({ page }) => {
    const loginPage = new LoginPage(page)
    await loginPage.goto()

    await loginPage.login("nonexistent@example.com", "wrongpassword")

    await expect(loginPage.errorMessage).toBeVisible({ timeout: 10000 })
  })

  test("should navigate to register page", async ({ page }) => {
    const loginPage = new LoginPage(page)
    await loginPage.goto()

    await loginPage.registerLink.click()
    await page.waitForURL("**/register", { timeout: 15000 })

    await expect(page.getByText("新規登録").first()).toBeVisible()
  })

  test("should redirect unauthenticated user to login", async ({ page }) => {
    await page.goto("/dashboard")
    await page.waitForURL("**/login", { timeout: 15000 })

    await expect(page.getByText("ログイン").first()).toBeVisible()
  })
})

test.describe("Registration Page", () => {
  test("should display registration form", async ({ page }) => {
    const registerPage = new RegisterPage(page)
    await registerPage.goto()

    await expect(page.getByText("新規登録").first()).toBeVisible()
    await expect(registerPage.nameInput).toBeVisible()
    await expect(registerPage.emailInput).toBeVisible()
    await expect(registerPage.passwordInput).toBeVisible()
    await expect(registerPage.submitButton).toBeVisible()
    await expect(registerPage.loginLink).toBeVisible()
  })

  test("should validate password length", async ({ page }) => {
    const registerPage = new RegisterPage(page)
    await registerPage.goto()

    // The password input has minLength=8, so the browser enforces it
    await expect(registerPage.passwordInput).toHaveAttribute("minLength", "8")
  })

  test("should register and redirect to dashboard", async ({ page }) => {
    const registerPage = new RegisterPage(page)
    await registerPage.goto()

    const uniqueEmail = `e2e-register-${Date.now()}@example.com`
    await registerPage.register("テスト太郎", uniqueEmail, "testpassword123")

    await page.waitForURL("**/dashboard", { timeout: 30000 })
    await expect(page.getByRole("heading", { name: "ダッシュボード" })).toBeVisible()
  })
})
