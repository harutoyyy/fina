import { test as base, expect } from "@playwright/test"

export const TEST_USER = {
  name: "E2Eテストユーザー",
  email: `e2e-test-${Date.now()}@example.com`,
  password: "testpassword123",
}

export const test = base
export { expect }
