"use client"

import { Building2, Layers } from "lucide-react"
import { useCompany, ALL_COMPANIES_ID, ALL_COMPANIES_OPTION, isAllCompanies } from "@/contexts/company-context"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectSeparator } from "@/components/ui/select"

export function CompanySwitcher() {
  const { companies, selectedCompany, setSelectedCompany, loading } = useCompany()

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-2">
        <Building2 className="h-4 w-4" />
        <span className="text-sm text-muted-foreground">...</span>
      </div>
    )
  }

  const isAll = isAllCompanies(selectedCompany)

  return (
    <Select
      value={selectedCompany?.id || ""}
      onValueChange={(value) => {
        if (value === ALL_COMPANIES_ID) {
          setSelectedCompany(ALL_COMPANIES_OPTION)
          return
        }
        const company = companies.find((c) => c.id === value)
        if (company) setSelectedCompany(company)
      }}
    >
      <SelectTrigger className="w-[200px]">
        <div className="flex items-center gap-2">
          {isAll ? <Layers className="h-4 w-4 shrink-0" /> : <Building2 className="h-4 w-4 shrink-0" />}
          <SelectValue placeholder="会社を選択" />
        </div>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL_COMPANIES_ID}>
          <div className="flex items-center gap-2">
            <Layers className="h-3.5 w-3.5" />
            <span className="font-medium">全社合算</span>
          </div>
        </SelectItem>
        <SelectSeparator />
        {companies.map((company) => (
          <SelectItem key={company.id} value={company.id}>
            {company.shortName || company.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
