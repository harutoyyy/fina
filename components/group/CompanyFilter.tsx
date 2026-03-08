"use client"

import { COMPANIES, type Industry } from "@/lib/mock/group-data"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const INDUSTRIES: { label: string; value: Industry | "all" }[] = [
  { label: "全社", value: "all" },
  { label: "建設", value: "建設" },
  { label: "広告", value: "広告" },
  { label: "その他", value: "その他" },
]

interface CompanyFilterProps {
  selectedIds: string[]
  onChange: (ids: string[]) => void
}

export function CompanyFilter({ selectedIds, onChange }: CompanyFilterProps) {
  const allSelected = selectedIds.length === COMPANIES.length

  function handleIndustry(value: Industry | "all") {
    if (value === "all") {
      onChange(COMPANIES.map((c) => c.id))
    } else {
      onChange(COMPANIES.filter((c) => c.industry === value).map((c) => c.id))
    }
  }

  function toggleCompany(id: string) {
    if (selectedIds.includes(id)) {
      if (selectedIds.length === 1) return // 最低1社
      onChange(selectedIds.filter((s) => s !== id))
    } else {
      onChange([...selectedIds, id])
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {INDUSTRIES.map((ind) => {
          const isActive =
            ind.value === "all"
              ? allSelected
              : COMPANIES.filter((c) => c.industry === ind.value).every((c) =>
                  selectedIds.includes(c.id)
                )
          return (
            <Button
              key={ind.value}
              variant={isActive ? "default" : "outline"}
              size="sm"
              className="h-7 text-xs"
              onClick={() => handleIndustry(ind.value)}
            >
              {ind.label}
            </Button>
          )
        })}
      </div>
      <div className="flex flex-wrap gap-1">
        {COMPANIES.map((company) => (
          <Button
            key={company.id}
            variant="ghost"
            size="sm"
            className={cn(
              "h-6 px-2 text-xs",
              selectedIds.includes(company.id)
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground opacity-50"
            )}
            onClick={() => toggleCompany(company.id)}
          >
            {company.shortName}
          </Button>
        ))}
      </div>
    </div>
  )
}
