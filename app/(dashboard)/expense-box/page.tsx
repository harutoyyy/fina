import { redirect } from "next/navigation"

/**
 * 旧「経費確定BOX」ページ。
 * 経費入力 (/expenses) に統合済み。
 * ブックマーク互換のためのリダイレクトのみ。
 */
export default function ExpenseBoxRedirect() {
  redirect("/expenses")
}
