"use client"

import { useEffect, useState, useCallback } from "react"
import {
  getCompanyGroupsWithCompanies,
  createCompanyGroup,
  updateCompanyGroup,
  deleteCompanyGroup,
  setGroupMembers,
} from "@/app/actions/company-groups"
import { getCompanies } from "@/app/actions/companies"
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
import { Plus, Pencil, Trash2, Users } from "lucide-react"

type GroupWithCompanies = Awaited<ReturnType<typeof getCompanyGroupsWithCompanies>>[number]
type CompanyRow = Awaited<ReturnType<typeof getCompanies>>[number]

const initialForm = {
  name: "",
  shortName: "",
  description: "",
  colorCode: "",
  displayOrder: 0,
  isActive: true,
}

export default function CompanyGroupsPage() {
  const [groups, setGroups] = useState<GroupWithCompanies[]>([])
  const [companies, setCompanies] = useState<CompanyRow[]>([])
  const [loading, setLoading] = useState(true)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<GroupWithCompanies | null>(null)
  const [form, setForm] = useState(initialForm)
  const [saving, setSaving] = useState(false)

  const [membersOpen, setMembersOpen] = useState(false)
  const [memberTarget, setMemberTarget] = useState<GroupWithCompanies | null>(null)
  const [memberIds, setMemberIds] = useState<string[]>([])
  const [memberSaving, setMemberSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [g, c] = await Promise.all([getCompanyGroupsWithCompanies(), getCompanies()])
      setGroups(g)
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
    setDialogOpen(true)
  }

  const openEdit = (g: GroupWithCompanies) => {
    setEditing(g)
    setForm({
      name: g.name,
      shortName: g.shortName ?? "",
      description: g.description ?? "",
      colorCode: g.colorCode ?? "",
      displayOrder: g.displayOrder,
      isActive: g.isActive,
    })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) {
      alert("グループ名は必須です")
      return
    }
    setSaving(true)
    try {
      if (editing) {
        await updateCompanyGroup(editing.id, {
          name: form.name,
          shortName: form.shortName || null,
          description: form.description || null,
          colorCode: form.colorCode || null,
          displayOrder: form.displayOrder,
          isActive: form.isActive,
        })
      } else {
        await createCompanyGroup({
          name: form.name,
          shortName: form.shortName || undefined,
          description: form.description || undefined,
          colorCode: form.colorCode || undefined,
          displayOrder: form.displayOrder,
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

  const handleDelete = async (g: GroupWithCompanies) => {
    if (!confirm(`グループ「${g.name}」を削除しますか？所属会社の紐付けも削除されます。`)) return
    try {
      await deleteCompanyGroup(g.id)
      await load()
    } catch (e) {
      alert(e instanceof Error ? e.message : "削除に失敗しました")
    }
  }

  const openMembers = (g: GroupWithCompanies) => {
    setMemberTarget(g)
    setMemberIds(g.companies.map((c) => c.id))
    setMembersOpen(true)
  }

  const toggleMember = (id: string) => {
    setMemberIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const saveMembers = async () => {
    if (!memberTarget) return
    setMemberSaving(true)
    try {
      await setGroupMembers(memberTarget.id, memberIds)
      setMembersOpen(false)
      await load()
    } catch (e) {
      alert(e instanceof Error ? e.message : "保存に失敗しました")
    } finally {
      setMemberSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">会社グループ</h1>
          <p className="text-muted-foreground">
            関連会社をグループ化してダッシュボードのタイル表示・グループ売上集計に使用します（PDF P1, P4）
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1" />
          新規追加
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>グループ一覧</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground text-center py-8">読み込み中...</p>
          ) : groups.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              グループが未登録です。「新規追加」から作成し、所属会社を割り当ててください。
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">表示順</TableHead>
                  <TableHead>グループ名</TableHead>
                  <TableHead>所属会社</TableHead>
                  <TableHead className="w-32">色</TableHead>
                  <TableHead className="w-20">状態</TableHead>
                  <TableHead className="text-right w-44">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groups.map((g) => (
                  <TableRow key={g.id}>
                    <TableCell>{g.displayOrder}</TableCell>
                    <TableCell>
                      <div className="font-medium">{g.name}</div>
                      {g.shortName && (
                        <div className="text-xs text-muted-foreground">{g.shortName}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {g.companies.length === 0 ? (
                          <span className="text-muted-foreground text-sm">—</span>
                        ) : (
                          g.companies.map((c) => (
                            <Badge key={c.id} variant="outline">
                              {c.shortName ?? c.name}
                            </Badge>
                          ))
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {g.colorCode ? (
                        <div className="flex items-center gap-2">
                          <span
                            className="inline-block w-4 h-4 rounded border"
                            style={{ background: g.colorCode }}
                          />
                          <span className="font-mono text-xs">{g.colorCode}</span>
                        </div>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      {g.isActive ? <Badge>有効</Badge> : <Badge variant="secondary">無効</Badge>}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openMembers(g)}>
                          <Users className="h-4 w-4 mr-1" />
                          会社
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => openEdit(g)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(g)}>
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
            <DialogTitle>{editing ? "グループを編集" : "グループを追加"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label>グループ名 *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="例: Aグループ、エグループ"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>略称</Label>
                <Input
                  value={form.shortName}
                  onChange={(e) => setForm((p) => ({ ...p, shortName: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>表示順</Label>
                <Input
                  type="number"
                  value={form.displayOrder}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, displayOrder: parseInt(e.target.value) || 0 }))
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>説明</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>タイル色（#RRGGBB）</Label>
              <div className="flex items-center gap-2">
                <Input
                  value={form.colorCode}
                  onChange={(e) => setForm((p) => ({ ...p, colorCode: e.target.value }))}
                  placeholder="#3b82f6"
                />
                {form.colorCode && (
                  <span
                    className="inline-block w-8 h-8 rounded border"
                    style={{ background: form.colorCode }}
                  />
                )}
              </div>
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
            <Button variant="outline" onClick={() => setDialogOpen(false)}>キャンセル</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "保存中..." : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={membersOpen} onOpenChange={setMembersOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {memberTarget?.name} の所属会社
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2 max-h-96 overflow-auto">
            {companies.map((c) => (
              <label
                key={c.id}
                className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={memberIds.includes(c.id)}
                  onChange={() => toggleMember(c.id)}
                  className="w-4 h-4"
                />
                <span className="font-medium">{c.shortName ?? c.name}</span>
                {c.shortName && (
                  <span className="text-xs text-muted-foreground">({c.name})</span>
                )}
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMembersOpen(false)}>キャンセル</Button>
            <Button onClick={saveMembers} disabled={memberSaving}>
              {memberSaving ? "保存中..." : `${memberIds.length}社を所属させる`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
