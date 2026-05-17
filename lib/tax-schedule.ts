export type TaxType =
  | "CORPORATE"      // 法人税
  | "CONSUMPTION"    // 消費税
  | "RESIDENT"       // 法人住民税
  | "BUSINESS"       // 事業税
  | "FIXED_ASSET"    // 固定資産税
  | "OTHER"

export const TAX_TYPE_LABELS: Record<TaxType, string> = {
  CORPORATE: "法人税",
  CONSUMPTION: "消費税",
  RESIDENT: "法人住民税",
  BUSINESS: "事業税",
  FIXED_ASSET: "固定資産税",
  OTHER: "その他",
}
