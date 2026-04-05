import { Page, Locator } from "@playwright/test"

export class DashboardPage {
  readonly page: Page
  readonly heading: Locator
  readonly companyCard: Locator
  readonly accountCountCard: Locator
  readonly partnerCountCard: Locator
  readonly transactionCountCard: Locator
  readonly setupGuide: Locator

  constructor(page: Page) {
    this.page = page
    this.heading = page.getByRole("heading", { name: "ダッシュボード" })
    this.companyCard = page.getByText("会社").first()
    this.accountCountCard = page.getByText("口座数")
    this.partnerCountCard = page.getByText("取引先数")
    this.transactionCountCard = page.getByText("今月の取引")
    this.setupGuide = page.getByText("セットアップガイド")
  }

  async goto() {
    await this.page.goto("/dashboard")
  }
}
