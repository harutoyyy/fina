"use client"

import { useEffect, useState, useCallback } from "react"
import {
  getSalesItems,
  createSalesItem,
  updateSalesItem,
  deleteSalesItem,
} from "@/app/actions/sales-items"
import { getCompanies } from "@/app/actions/companies"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Plus, Pencil, Trash2 } from "lucide-react"

type Item = Awaited<ReturnType<typeof getSalesItems>>[number]
type CompanyRow = Awaited<ReturnType<typeof getCompanies>>[number]

const CLASSIFICATIONS = [
  { value: "_none", label: "指定なし" },
  { value: "FIXED", label: "固定" },
  { value: "VARIABLE", label: "変動" },
  { value: "TEMPORARY", label: "臨時" },
]

const initialForm = {
  name: "",
  shortName: "",
  description: "",
  applicableCompanyIds: [] as string[],
  defaultClassification: "_none",
  displayOrder: 0,
  isActive: true,
}

export default function SalesItemsMasterPage() {
  const [items, setItems] = useState<Item[]>([])
  const [companies, setCompanies] = useState<CompanyRow[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Item | null>(null)
  const [form, setForm] = useState(initialForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [i, c] = await Promise.all([getSalesItems(), getCompanies()])
      setItems(i)
      setCompanies(c)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const openCreate = () => {
    setEditing(null)
    setForm(initialForm)
    setError(null)
    setDialogOpen(true)
  }

  const openEdit = (it: Item) => {
    setEditing(it)
    setForm({
      name: it.name,
      shortName: it.shortName ?? "",
      description: it.description ?? "",
      applicableCompanyIds: it.applicableCompanyIdList,
      defaultClassification: it.defaultClassification ?? "_none",
      displayOrder: it.displayOrder,
      isActive: it.isActive,
    })
    setError(null)
    setDialogOpen(true)
  }

  const toggleCompany = (id: string) => {
    setForm((p) => ({
      ...p,
      applicableCompanyIds: p.applicableCompanyIds.includes(id)
        ? p.applicableCompanyIds.filter((x) => x !== id)
        : [...p.applicableCompanyIds, id],
    }))
  }

  const handleSave = async () => {
    setError(null)
    setSaving(true)
    try {
      const payload = {
        name: form.name,
        shortName: form.shortName || undefined,
        description: form.description || undefined,
        applicableCompanyIds: form.applicableCompanyIds,
        defaultClassification:
          form.defaultClassification === "_none" ? undefined : form.defaultClassification,
        displayOrder: form.displayOrder,
      }
      if (editing) {
        await updateSalesItem(editing.id, { ...payload, isActive: form.isActive })
      } else {
        await createSalesItem(payload)
      }
      setDialogOpen(false)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("この売上項目を削除します。よろしいですか？")) return
    await deleteSalesItem(id)
    await load()
  }

  const companyNameMap = new Map(companies.map((c) => [c.id, c.shortName || c.name]))

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">売上項目マスタ</h1>
          <p className="text-sm text-muted-foreground">
            売上区分（工事売上・地代収入・雑収入など）と対象会社を管理します。
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="w-4 h-4 mr-1" />
          新規
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>売上項目一覧</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground text-center py-4">読み込み中...</p>
          ) : items.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              項目が登録されていません
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>項目名</TableHead>
                  <TableHead>略称</TableHead>
                  <TableHead>区分</TableHead>
                  <TableHead>対象会社</TableHead>
                  <TableHead>有効</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((it) => (
                  <TableRow key={it.id}>
                    <TableCell className="font-medium">{it.name}</TableCell>
                    <TableCell>{it.shortName ?? "-"}</TableCell>
                    <TableCell className="text-sm">
                      {it.defaultClassification ?? "-"}
                    </TableCell>
                    <TableCell>
                      {it.applicableCompanyIdList.length === 0 ? (
                        <Badge variant="secondary">全社</Badge>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {it.applicableCompanyIdList.map((cid) => (
                            <Badge key={cid} variant="outline">
                              {companyNameMap.get(cid) ?? cid}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {it.isActive ? (
                        <Badge>有効</Badge>
                      ) : (
                        <Badge variant="secondary">無効</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => openEdit(it)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(it.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "売上項目を編集" : "売上項目を追加"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>項目名 *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="例: 工事売上"
              />
            </div>
            <div>
              <Label>略称</Label>
              <Input
                value={form.shortName}
                onChange={(e) => setForm({ ...form, shortName: e.target.value })}
              />
            </div>
            <div>
              <Label>デフォルト区分</Label>
              <Select
                value={form.defaultClassification}
                onValueChange={(v) => setForm({ ...form, defaultClassification: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CLASSIFICATIONS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>表示順</Label>
              <Input
                type="number"
                value={form.displayOrder}
                onChange={(e) =>
                  setForm({ ...form, displayOrder: parseInt(e.target.value || "0") })
                }
              />
            </div>
            <div className="col-span-2">
              <Label>説明</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="col-span-2">
              <Label>対象会社（空=全社対象）</Label>
              <div className="grid grid-cols-2 gap-2 mt-2 max-h-48 overflow-auto border rounded p-2">
                {companies.map((c) => (
                  <label
                    key={c.id}
                    className="flex items-center gap-2 text-sm cursor-pointer"
                  >
                    <Checkbox
                      checked={form.applicableCompanyIds.includes(c.id)}
                      onCheckedChange={() => toggleCompany(c.id)}
                    />
                    {c.shortName || c.name}
                  </label>
                ))}
              </div>
            </div>
            {editing && (
              <div className="col-span-2 flex items-center gap-2">
                <Switch
                  checked={form.isActive}
                  onCheckedChange={(v) => setForm({ ...form, isActive: v })}
                />
                <Label>有効</Label>
              </div>
            )}
          </div>
          {error && (
            <div className="text-sm text-destructive bg-destructive/10 p-2 rounded">
              {error}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              キャンセル
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "保存中..." : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
