"use client"

import { useEffect, useState } from "react"
import { getCategories, createMidCategory, updateMidCategory, createSubCategory, updateSubCategory } from "@/app/actions/categories"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { ChevronDown, ChevronRight, Plus, Pencil, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

type CategoryData = Awaited<ReturnType<typeof getCategories>>

export default function CategoriesPage() {
  const [categories, setCategories] = useState<CategoryData>([])
  const [loading, setLoading] = useState(true)
  const [expandedMajors, setExpandedMajors] = useState<Set<string>>(new Set())
  const [expandedMids, setExpandedMids] = useState<Set<string>>(new Set())

  const [addMidDialog, setAddMidDialog] = useState<{ majorId: string; majorName: string } | null>(null)
  const [addSubDialog, setAddSubDialog] = useState<{ midId: string; midName: string } | null>(null)
  const [editMidDialog, setEditMidDialog] = useState<{ id: string; name: string; isActive: boolean } | null>(null)
  const [editSubDialog, setEditSubDialog] = useState<{ id: string; name: string; isActive: boolean } | null>(null)
  const [newName, setNewName] = useState("")
  const [saving, setSaving] = useState(false)

  const loadCategories = async () => {
    setLoading(true)
    const data = await getCategories()
    setCategories(data)
    setExpandedMajors(new Set(data.map((m) => m.id)))
    setLoading(false)
  }

  useEffect(() => { loadCategories() }, [])

  const toggleMajor = (id: string) => {
    const next = new Set(expandedMajors)
    next.has(id) ? next.delete(id) : next.add(id)
    setExpandedMajors(next)
  }

  const toggleMid = (id: string) => {
    const next = new Set(expandedMids)
    next.has(id) ? next.delete(id) : next.add(id)
    setExpandedMids(next)
  }

  const handleAddMid = async () => {
    if (!addMidDialog || !newName.trim()) return
    setSaving(true)
    await createMidCategory({ majorId: addMidDialog.majorId, name: newName.trim() })
    setSaving(false)
    setAddMidDialog(null)
    setNewName("")
    loadCategories()
  }

  const handleAddSub = async () => {
    if (!addSubDialog || !newName.trim()) return
    setSaving(true)
    await createSubCategory({ midId: addSubDialog.midId, name: newName.trim() })
    setSaving(false)
    setAddSubDialog(null)
    setNewName("")
    loadCategories()
  }

  const handleEditMid = async () => {
    if (!editMidDialog) return
    setSaving(true)
    await updateMidCategory(editMidDialog.id, { name: newName.trim() || undefined })
    setSaving(false)
    setEditMidDialog(null)
    setNewName("")
    loadCategories()
  }

  const handleEditSub = async () => {
    if (!editSubDialog) return
    setSaving(true)
    await updateSubCategory(editSubDialog.id, { name: newName.trim() || undefined })
    setSaving(false)
    setEditSubDialog(null)
    setNewName("")
    loadCategories()
  }

  const handleToggleMidActive = async (id: string, isActive: boolean) => {
    await updateMidCategory(id, { isActive: !isActive })
    loadCategories()
  }

  const handleToggleSubActive = async (id: string, isActive: boolean) => {
    await updateSubCategory(id, { isActive: !isActive })
    loadCategories()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">勘定科目管理</h1>
        <p className="text-muted-foreground">大項目（PL区分）&gt; 中項目（勘定科目）&gt; 小項目（補助科目）の3階層で管理します</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : (
        <div className="space-y-4">
          {categories.map((major) => (
            <Card key={major.id}>
              <CardHeader className="cursor-pointer py-3" onClick={() => toggleMajor(major.id)}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {expandedMajors.has(major.id) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    <CardTitle className="text-base">{major.name}</CardTitle>
                    <Badge variant={major.direction === "INCOME" ? "default" : "secondary"}>
                      {major.direction === "INCOME" ? "収入" : "支出"}
                    </Badge>
                    <span className="text-sm text-muted-foreground">({major.midCategories.length}科目)</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); setAddMidDialog({ majorId: major.id, majorName: major.name }); setNewName("") }}
                  >
                    <Plus className="mr-1 h-3 w-3" />中項目追加
                  </Button>
                </div>
              </CardHeader>
              {expandedMajors.has(major.id) && (
                <CardContent className="pt-0">
                  <div className="space-y-1">
                    {major.midCategories.map((mid) => (
                      <div key={mid.id} className="border rounded-lg">
                        <div
                          className="flex items-center justify-between px-4 py-2 cursor-pointer hover:bg-muted/50"
                          onClick={() => toggleMid(mid.id)}
                        >
                          <div className="flex items-center gap-2">
                            {mid.subCategories.length > 0 ? (
                              expandedMids.has(mid.id) ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />
                            ) : <span className="w-3" />}
                            <span className={cn("text-sm", !mid.isActive && "text-muted-foreground line-through")}>{mid.name}</span>
                            {!mid.isActive && <Badge variant="outline" className="text-xs">無効</Badge>}
                            {mid.subCategories.length > 0 && (
                              <span className="text-xs text-muted-foreground">({mid.subCategories.length})</span>
                            )}
                          </div>
                          <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setAddSubDialog({ midId: mid.id, midName: mid.name }); setNewName("") }}>
                              <Plus className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setEditMidDialog({ id: mid.id, name: mid.name, isActive: mid.isActive }); setNewName(mid.name) }}>
                              <Pencil className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                        {expandedMids.has(mid.id) && mid.subCategories.length > 0 && (
                          <div className="border-t px-4 py-2 bg-muted/20">
                            {mid.subCategories.map((sub) => (
                              <div key={sub.id} className="flex items-center justify-between py-1 pl-6">
                                <span className={cn("text-sm", !sub.isActive && "text-muted-foreground line-through")}>
                                  {sub.name}
                                  {!sub.isActive && <Badge variant="outline" className="ml-2 text-xs">無効</Badge>}
                                </span>
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setEditSubDialog({ id: sub.id, name: sub.name, isActive: sub.isActive }); setNewName(sub.name) }}>
                                  <Pencil className="h-3 w-3" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!addMidDialog} onOpenChange={(open) => !open && setAddMidDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>中項目（勘定科目）の追加 - {addMidDialog?.majorName}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>科目名 *</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="例: 消耗品費" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddMidDialog(null)}>キャンセル</Button>
            <Button onClick={handleAddMid} disabled={saving || !newName.trim()}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}追加
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!addSubDialog} onOpenChange={(open) => !open && setAddSubDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>小項目（補助科目）の追加 - {addSubDialog?.midName}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>補助科目名 *</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="例: 電気代" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddSubDialog(null)}>キャンセル</Button>
            <Button onClick={handleAddSub} disabled={saving || !newName.trim()}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}追加
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editMidDialog} onOpenChange={(open) => !open && setEditMidDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>中項目の編集</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>科目名</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} />
            </div>
            {editMidDialog && (
              <Button
                variant={editMidDialog.isActive ? "destructive" : "default"}
                size="sm"
                onClick={() => { handleToggleMidActive(editMidDialog.id, editMidDialog.isActive); setEditMidDialog(null) }}
              >
                {editMidDialog.isActive ? "無効にする" : "有効にする"}
              </Button>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditMidDialog(null)}>キャンセル</Button>
            <Button onClick={handleEditMid} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}更新
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editSubDialog} onOpenChange={(open) => !open && setEditSubDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>小項目の編集</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>補助科目名</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} />
            </div>
            {editSubDialog && (
              <Button
                variant={editSubDialog.isActive ? "destructive" : "default"}
                size="sm"
                onClick={() => { handleToggleSubActive(editSubDialog.id, editSubDialog.isActive); setEditSubDialog(null) }}
              >
                {editSubDialog.isActive ? "無効にする" : "有効にする"}
              </Button>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditSubDialog(null)}>キャンセル</Button>
            <Button onClick={handleEditSub} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}更新
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
