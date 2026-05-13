import { Page, Locator } from "@playwright/test"

export class RegisterPage {
  readonly page: Page
  readonly nameInput: Locator
  readonly emailInput: Locator
  readonly passwordInput: Locator
  readonly submitButton: Locator
  readonly errorMessage: Locator
  readonly loginLink: Locator

  constructor(page: Page) {
    this.page = page
    this.nameInput = page.locator("#name")
    this.emailInput = page.locator("#email")
    this.passwordInput = page.locator("#password")
    this.submitButton = page.getByRole("button", { name: "アカウント作成" })
    this.errorMessage = page.locator(".bg-destructive\\/10")
    this.loginLink = page.getByRole("link", { name: "ログイン" })
  }

  async goto() {
    await this.page.goto("/register")
  }

  async register(name: string, email: string, password: string) {
    await this.nameInput.fill(name)
    await this.emailInput.fill(email)
    await this.passwordInput.fill(password)
    await this.submitButton.click()
  }
}
