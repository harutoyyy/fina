// 日本の祝日マスタ（2025-2030年対応）
// 固定祝日 + ハッピーマンデー + 春分/秋分（ルックアップ）+ 振替休日

// 春分・秋分の日（天文計算ではなくルックアップテーブル）
const VERNAL_EQUINOX: Record<number, number> = {
  2025: 20, 2026: 20, 2027: 21, 2028: 20, 2029: 20, 2030: 20,
}
const AUTUMNAL_EQUINOX: Record<number, number> = {
  2025: 23, 2026: 23, 2027: 23, 2028: 22, 2029: 23, 2030: 23,
}

/** 第N月曜日を取得 */
function nthMonday(year: number, month: number, n: number): Date {
  const first = new Date(year, month - 1, 1)
  const firstDay = first.getDay()
  const firstMonday = firstDay <= 1 ? 1 + (1 - firstDay) : 1 + (8 - firstDay)
  return new Date(year, month - 1, firstMonday + (n - 1) * 7)
}

/** 指定年の祝日一覧を生成 */
export function getJapaneseHolidays(year: number): Date[] {
  const holidays: Date[] = []

  // 固定祝日
  holidays.push(new Date(year, 0, 1))   // 元日
  holidays.push(new Date(year, 1, 11))  // 建国記念の日
  holidays.push(new Date(year, 1, 23))  // 天皇誕生日
  holidays.push(new Date(year, 3, 29))  // 昭和の日
  holidays.push(new Date(year, 4, 3))   // 憲法記念日
  holidays.push(new Date(year, 4, 4))   // みどりの日
  holidays.push(new Date(year, 4, 5))   // こどもの日
  holidays.push(new Date(year, 7, 11))  // 山の日
  holidays.push(new Date(year, 10, 3))  // 文化の日
  holidays.push(new Date(year, 10, 23)) // 勤労感謝の日

  // ハッピーマンデー
  holidays.push(nthMonday(year, 1, 2))  // 成人の日（1月第2月曜）
  holidays.push(nthMonday(year, 7, 3))  // 海の日（7月第3月曜）
  holidays.push(nthMonday(year, 9, 3))  // 敬老の日（9月第3月曜）
  holidays.push(nthMonday(year, 10, 2)) // スポーツの日（10月第2月曜）

  // 春分の日・秋分の日
  const vernal = VERNAL_EQUINOX[year]
  if (vernal) holidays.push(new Date(year, 2, vernal))
  const autumnal = AUTUMNAL_EQUINOX[year]
  if (autumnal) holidays.push(new Date(year, 8, autumnal))

  // 振替休日：祝日が日曜の場合、翌月曜を休日に
  const substitutes: Date[] = []
  for (const h of holidays) {
    if (h.getDay() === 0) {
      substitutes.push(new Date(h.getFullYear(), h.getMonth(), h.getDate() + 1))
    }
  }
  holidays.push(...substitutes)

  return holidays
}

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

/** 営業日かどうか（土日祝を除く） */
export function isBusinessDay(date: Date): boolean {
  const day = date.getDay()
  if (day === 0 || day === 6) return false

  const holidays = getJapaneseHolidays(date.getFullYear())
  const key = toDateKey(date)
  return !holidays.some((h) => toDateKey(h) === key)
}

/** 休日調整 */
export function adjustForHoliday(
  date: Date,
  mode: "PREV_BUSINESS" | "NEXT_BUSINESS" | "NONE"
): Date {
  if (mode === "NONE") return date

  const result = new Date(date)
  const step = mode === "PREV_BUSINESS" ? -1 : 1
  while (!isBusinessDay(result)) {
    result.setDate(result.getDate() + step)
  }
  return result
}
