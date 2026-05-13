"use client"

import { useEffect, useState } from "react"
import { getDeductionCategories, createDeductionCategory, updateDeductionCategory, deleteDeductionCategory } from "@/app/actions/deduction-categories"
import { getCategories } from "@/app/actions/categories"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react"

type DeductionCategory = Awaited<ReturnType<typeof getDeductionCategories>>[number]
type CategoryTree = Awaited<ReturnType<typeof getCategories>>

export default function DeductionCategoriesPage() {
  const [salesCategories, setSalesCategories] = useState<DeductionCategory[]>([])
  const [costCategories, setCostCategories] = useState<DeductionCategory[]>([])
  const [categoryTree, setCategoryTree] = useState<CategoryTree>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<"SALES" | "COST">("SALES")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editCategory, setEditCategory] = useState<DeductionCategory | null>(null)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    midId: "",
    subId: "",
    hasSubTypes: false,
    displayOrder: 0,
  })

  const loadData = async () => {
    setLoading(true)
    const [sales, cost, tree] = await Promise.all([
      getDeductionCategories("SALES"),
      getDeductionCategories("COST"),
      getCategories(),
    ])
    setSalesCategories(sales)
    setCostCategories(cost)
    setCategoryTree(tree)
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  const midCategories = categoryTree.flatMap((major) =>
    major.midCategories.map((mid) => ({ ...mid, majorName: major.name }))
  )

  const selectedMid = midCategories.find((m) => m.id === formData.midId)
  const subCategories = selectedMid?.subCategories || []

  const openCreate = () => {
    setEditCategory(null)
    setFormData({ name: "", midId: "", subId: "", hasSubTypes: false, displayOrder: 0 })
    setDialogOpen(true)
  }

  const openEdit = (cat: DeductionCategory) => {
    setEditCategory(cat)
    setFormData({
      name: cat.name,
      midId: cat.midId,
      subId: cat.subId || "",
      hasSubTypes: cat.hasSubTypes,
      displayOrder: cat.displayOrder,
    })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      if (editCategory) {
        await updateDeductionCategory(editCategory.id, {
          name: formData.name,
          midId: formData.midId,
          subId: formData.subId || null,
          hasSubTypes: formData.hasSubTypes,
          displayOrder: formData.displayOrder,
        })
      } else {
        await createDeductionCategory({
          forType: activeTab,
          name: formData.name,
          midId: formData.midId,
          subId: formData.subId || undefined,
          hasSubTypes: formData.hasSubTypes,
          displayOrder: formData.displayOrder,
        })
      }
      setDialogOpen(false)
      loadData()
    } catch {
      alert("保存に失敗しました")
    }
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm("このカテゴリを削除しますか？")) return
    try {
      await deleteDeductionCategory(id)
      loadData()
    } catch {
      alert("削除に失敗しました")
    }
  }

  const toggleActive = async (cat: DeductionCategory) => {
    await updateDeductionCategory(cat.id, { isActive: !cat.isActive })
    loadData()
  }

  const renderTable = (categories: DeductionCategory[]) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-12">順</TableHead>
          <TableHead>カテゴリ名</TableHead>
          <TableHead>デフォルト中項目</TableHead>
          <TableHead>デフォルト小項目</TableHead>
          <TableHead className="w-20">発生/相殺</TableHead>
          <TableHead className="w-20">状態</TableHead>
          <TableHead className="w-24"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {categories.length === 0 ? (
          <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">カテゴリがありません</TableCell></TableRow>
        ) : (
          categories.map((cat) => {
            const mid = midCategories.find((m) => m.id === cat.midId)
            const sub = mid?.subCategories.find((s) => s.id === cat.subId)
            return (
              <TableRow key={cat.id}>
                <TableCell>{cat.displayOrder}</TableCell>
                <TableCell className="font-medium">{cat.name}</TableCell>
                <TableCell>{mid?.name || "-"}</TableCell>
                <TableCell>{sub?.name || "-"}</TableCell>
                <TableCell>{cat.hasSubTypes ? <Badge variant="outline">あり</Badge> : "-"}</TableCell>
                <TableCell>
                  <Badge variant={cat.isActive ? "default" : "secondary"} className="cursor-pointer" onClick={() => toggleActive(cat)}>
                    {cat.isActive ? "有効" : "無効"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(cat)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(cat.id)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            )
          })
        )}
      </TableBody>
    </Table>
  )

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin" /></div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">控除カテゴリマスタ</h1>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />カテゴリ追加</Button>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "SALES" | "COST")}>
        <TabsList>
          <TabsTrigger value="SALES">売上控除</TabsTrigger>
          <TabsTrigger value="COST">原価控除</TabsTrigger>
        </TabsList>
        <TabsContent value="SALES">
          <Card>
            <CardHeader><CardTitle className="text-lg">売上控除カテゴリ</CardTitle></CardHeader>
            <CardContent>{renderTable(salesCategories)}</CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="COST">
          <Card>
            <CardHeader><CardTitle className="text-lg">原価控除カテゴリ</CardTitle></CardHeader>
            <CardContent>{renderTable(costCategories)}</CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editCategory ? "カテゴリ編集" : "カテゴリ追加"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>カテゴリ名</Label>
              <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="例：振込手数料" />
            </div>
            <div>
              <Label>デフォルト中項目（勘定科目）</Label>
              <Select value={formData.midId} onValueChange={(v) => setFormData({ ...formData, midId: v, subId: "" })}>
                <SelectTrigger><SelectValue placeholder="中項目を選択" /></SelectTrigger>
                <SelectContent>
                  {midCategories.filter((m) => m.isActive).map((mid) => (
                    <SelectItem key={mid.id} value={mid.id}>{mid.majorName} &gt; {mid.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {subCategories.length > 0 && (
              <div>
                <Label>デフォルト小項目（補助科目）</Label>
                <Select value={formData.subId} onValueChange={(v) => setFormData({ ...formData, subId: v })}>
                  <SelectTrigger><SelectValue placeholder="小項目を選択（任意）" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">（なし）</SelectItem>
                    {subCategories.filter((s) => s.isActive).map((sub) => (
                      <SelectItem key={sub.id} value={sub.id}>{sub.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex items-center gap-2">
              <input type="checkbox" id="hasSubTypes" checked={formData.hasSubTypes} onChange={(e) => setFormData({ ...formData, hasSubTypes: e.target.checked })} />
              <Label htmlFor="hasSubTypes">発生/相殺の小項目を持つ</Label>
            </div>
            <div>
              <Label>表示順</Label>
              <Input type="number" value={formData.displayOrder} onChange={(e) => setFormData({ ...formData, displayOrder: parseInt(e.target.value) || 0 })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>キャンセル</Button>
            <Button onClick={handleSave} disabled={saving || !formData.name || !formData.midId}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
