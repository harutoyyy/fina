import { redirect } from "next/navigation"

/**
 * 旧「経費確定BOX」ページ。
 * 経費入力 (/expenses) の「受領BOX」タブに統合済み。
 * ブックマーク互換のためのリダイレクトのみ。
 */
export default function ExpenseBoxRedirect() {
  redirect("/expenses?tab=RECEIVED")
}
