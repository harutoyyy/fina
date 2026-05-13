"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { searchEvidenceByMeta } from "@/app/actions/evidence"
import { Search, ChevronDown, ChevronUp } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { formatYen } from "@/lib/format"

type SearchResult = Awaited<ReturnType<typeof searchEvidenceByMeta>>[number]

export function EvidenceSearch({ companyId }: { companyId: string }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  const handleSearch = async () => {
    if (!query.trim()) return
    setLoading(true)
    setSearched(true)
    try {
      const data = await searchEvidenceByMeta(companyId, query.trim())
      setResults(data)
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <Button variant="outline" size="sm" className="gap-1" onClick={() => setOpen(!open)}>
        <Search className="h-4 w-4" />
        証憑メタ検索
        {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </Button>
      {open && (
        <Card className="mt-2">
          <CardContent className="pt-4 space-y-3">
            <div className="flex gap-2">
              <Input
                className="h-8 text-sm"
                placeholder="取引先名で検索"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
              <Button size="sm" className="h-8" onClick={handleSearch} disabled={loading}>
                検索
              </Button>
            </div>
            {loading ? (
              <p className="text-sm text-muted-foreground">検索中...</p>
            ) : searched && results.length === 0 ? (
              <p className="text-sm text-muted-foreground">該当なし</p>
            ) : (
              results.length > 0 && (
                <div className="space-y-1 max-h-60 overflow-y-auto">
                  {results.map((r) => {
                    const meta = r as unknown as { metaVendorName?: string | null; metaTransactionDate?: string | null; metaAmount?: bigint | null }
                    return (
                      <div key={r.id} className="flex items-center justify-between text-sm p-2 rounded border">
                        <div>
                          <span className="font-medium">{meta.metaVendorName || "—"}</span>
                          {meta.metaTransactionDate && (
                            <span className="text-muted-foreground ml-2">
                              {new Date(meta.metaTransactionDate).toLocaleDateString("ja-JP")}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {meta.metaAmount && (
                            <span className="font-mono">{formatYen(Number(meta.metaAmount))}</span>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {r.transaction.accountingMonth}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
