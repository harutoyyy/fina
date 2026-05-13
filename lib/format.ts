export function formatYen(amount: bigint | number | null | undefined): string {
  if (amount === null || amount === undefined) return "¥0"
  const num = typeof amount === "bigint" ? Number(amount) : amount
  return `¥${num.toLocaleString("ja-JP")}`
}

export function parseYen(value: string): bigint {
  const cleaned = value.replace(/[¥,、\s]/g, "").replace(/[０-９]/g, (s) =>
    String.fromCharCode(s.charCodeAt(0) - 0xFEE0)
  )
  const num = parseInt(cleaned, 10)
  if (isNaN(num)) return BigInt(0)
  return BigInt(num)
}

export function getCurrentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return ""
  const d = typeof date === "string" ? new Date(date) : date
  return d.toLocaleDateString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit" })
}

export function toISODateString(date: Date): string {
  return date.toISOString().split("T")[0]
}

export function bigintToJson(obj: unknown): unknown {
  return JSON.parse(
    JSON.stringify(obj, (_key, value) =>
      typeof value === "bigint" ? value.toString() : value
    )
  )
}
