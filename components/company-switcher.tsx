"use client"

import { Building2 } from "lucide-react"
import { useCompany } from "@/contexts/company-context"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

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

  return (
    <Select
      value={selectedCompany?.id || ""}
      onValueChange={(value) => {
        const company = companies.find((c) => c.id === value)
        if (company) setSelectedCompany(company)
      }}
    >
      <SelectTrigger className="w-[200px]">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 shrink-0" />
          <SelectValue placeholder="会社を選択" />
        </div>
      </SelectTrigger>
      <SelectContent>
        {companies.map((company) => (
          <SelectItem key={company.id} value={company.id}>
            {company.shortName || company.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
