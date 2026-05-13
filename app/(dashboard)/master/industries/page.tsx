"use client"

import { useEffect, useState } from "react"
import {
  getIndustries,
  createIndustry,
  updateIndustry,
  deleteIndustry,
} from "@/app/actions/industries"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Plus, Pencil, Trash2 } from "lucide-react"

type Industry = Awaited<ReturnType<typeof getIndustries>>[number]

const initialForm = {
  name: "",
  code: "",
  displayOrder: 0,
  isActive: true,
  notes: "",
}

export default function IndustriesMasterPage() {
  const [items, setItems] = useState<Industry[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Industry | null>(null)
  const [form, setForm] = useState(initialForm)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    const data = await getIndustries()
    setItems(data)
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const openCreate = () => {
    setEditing(null)
    setForm(initialForm)
    setDialogOpen(true)
  }

  const openEdit = (item: Industry) => {
    setEditing(item)
    setForm({
      name: item.name,
      code: item.code ?? "",
      displayOrder: item.displayOrder,
      isActive: item.isActive,
      notes: item.notes ?? "",
    })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    try {
      if (editing) {
        await updateIndustry(editing.id, {
          name: form.name,
          code: form.code || null,
          displayOrder: form.displayOrder,
          isActive: form.isActive,
          notes: form.notes || null,
        })
      } else {
        await createIndustry({
          name: form.name,
          code: form.code || undefined,
          displayOrder: form.displayOrder,
          notes: form.notes || undefined,
        })
      }
      setDialogOpen(false)
      await load()
    } catch (e) {
      alert(e instanceof Error ? e.message : "保存に失敗しました")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (item: Industry) => {
    if (!confirm(`業種「${item.name}」を削除しますか？`)) return
    try {
      await deleteIndustry(item.id)
      await load()
    } catch (e) {
      alert(e instanceof Error ? e.message : "削除に失敗しました")
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">業種マスタ</h1>
          <p className="text-muted-foreground">
            会社マスタで選択できる業種を管理します（建設/広告/その他、追加可）
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1" />
          新規追加
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>業種一覧</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground text-center py-8">読み込み中...</p>
          ) : items.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">業種が未登録です</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">表示順</TableHead>
                  <TableHead>業種名</TableHead>
                  <TableHead className="w-40">コード</TableHead>
                  <TableHead className="w-24">状態</TableHead>
                  <TableHead>備考</TableHead>
                  <TableHead className="text-right w-32">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.displayOrder}</TableCell>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell className="font-mono text-xs">{item.code ?? "—"}</TableCell>
                    <TableCell>
                      {item.isActive ? (
                        <Badge variant="default">有効</Badge>
                      ) : (
                        <Badge variant="secondary">無効</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {item.notes ?? "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEdit(item)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(item)}
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "業種を編集" : "業種を追加"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>業種名 *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="例: 建設、広告、その他"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>コード（任意）</Label>
                <Input
                  value={form.code}
                  onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))}
                  placeholder="CONSTRUCTION 等"
                />
              </div>
              <div className="space-y-2">
                <Label>表示順</Label>
                <Input
                  type="number"
                  value={form.displayOrder}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      displayOrder: parseInt(e.target.value) || 0,
                    }))
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>備考</Label>
              <Input
                value={form.notes}
                onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
              />
            </div>
            {editing && (
              <div className="flex items-center justify-between">
                <Label>有効フラグ</Label>
                <Switch
                  checked={form.isActive}
                  onCheckedChange={(c) => setForm((p) => ({ ...p, isActive: c }))}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              キャンセル
            </Button>
            <Button onClick={handleSave} disabled={saving || !form.name.trim()}>
              {saving ? "保存中..." : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
