"use client"

import { useEffect, useState } from "react"
import { useCompany } from "@/contexts/company-context"
import { CompanySwitcher } from "@/components/company-switcher"
import { getPayrollGroups, createPayrollGroup, updatePayrollGroup, deletePayrollGroup } from "@/app/actions/payroll"
import { getAccounts } from "@/app/actions/accounts"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react"

type PayrollGroupItem = {
  id: string
  companyId: string
  name: string
  costType: string
  midId: string | null
  payDay: number | null
  payDayIsMonthEnd: boolean
  holidayAdjust: string | null
  defaultAccountId: string | null
  defaultCashAccountId: string | null
  deductionPresets: unknown
  headcount: number
  displayOrder: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}
type AccountItem = Awaited<ReturnType<typeof getAccounts>>[number]

const costTypeLabels: Record<string, string> = {
  COST: "原価",
  SGA: "販管費",
  OUTSOURCE: "外注",
}

const holidayAdjustLabels: Record<string, string> = {
  PREV_BUSINESS: "前営業日",
  NEXT_BUSINESS: "翌営業日",
}

export default function PayrollGroupsPage() {
  const { selectedCompany } = useCompany()
  const [groups, setGroups] = useState<PayrollGroupItem[]>([])
  const [accounts, setAccounts] = useState<AccountItem[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editGroup, setEditGroup] = useState<PayrollGroupItem | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    costType: "COST",
    payDay: "",
    payDayIsMonthEnd: false,
    holidayAdjust: "",
    defaultAccountId: "",
    defaultCashAccountId: "",
    headcount: "",
  })

  const loadData = async () => {
    if (!selectedCompany) return
    setLoading(true)
    const [groupsData, accountsData] = await Promise.all([
      getPayrollGroups(selectedCompany.id),
      getAccounts(selectedCompany.id),
    ])
    setGroups(groupsData as PayrollGroupItem[])
    setAccounts(accountsData)
    setLoading(false)
  }

  useEffect(() => { loadData() }, [selectedCompany])

  const openCreate = () => {
    setEditGroup(null)
    setFormData({
      name: "",
      costType: "COST",
      payDay: "",
      payDayIsMonthEnd: false,
      holidayAdjust: "",
      defaultAccountId: "",
      defaultCashAccountId: "",
      headcount: "",
    })
    setDialogOpen(true)
  }

  const openEdit = (group: PayrollGroupItem) => {
    setEditGroup(group)
    setFormData({
      name: group.name,
      costType: group.costType,
      payDay: group.payDay?.toString() || "",
      payDayIsMonthEnd: group.payDayIsMonthEnd,
      holidayAdjust: group.holidayAdjust || "",
      defaultAccountId: group.defaultAccountId || "",
      defaultCashAccountId: group.defaultCashAccountId || "",
      headcount: group.headcount?.toString() || "0",
    })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!selectedCompany) return
    setSaving(true)
    try {
      if (editGroup) {
        await updatePayrollGroup(editGroup.id, selectedCompany.id, {
          name: formData.name,
          costType: formData.costType,
          payDay: formData.payDayIsMonthEnd ? null : (formData.payDay ? parseInt(formData.payDay) : null),
          payDayIsMonthEnd: formData.payDayIsMonthEnd,
          holidayAdjust: formData.holidayAdjust || null,
          defaultAccountId: formData.defaultAccountId || null,
          defaultCashAccountId: formData.defaultCashAccountId || null,
          headcount: formData.headcount ? parseInt(formData.headcount) : 0,
        })
      } else {
        await createPayrollGroup({
          companyId: selectedCompany.id,
          name: formData.name,
          costType: formData.costType,
          payDay: formData.payDayIsMonthEnd ? undefined : (formData.payDay ? parseInt(formData.payDay) : undefined),
          payDayIsMonthEnd: formData.payDayIsMonthEnd,
          holidayAdjust: formData.holidayAdjust || undefined,
          defaultAccountId: formData.defaultAccountId || undefined,
          defaultCashAccountId: formData.defaultCashAccountId || undefined,
          headcount: formData.headcount ? parseInt(formData.headcount) : 0,
        })
      }
      setDialogOpen(false)
      loadData()
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (group: PayrollGroupItem) => {
    if (!selectedCompany) return
    if (!confirm(`「${group.name}」を削除しますか？`)) return
    setDeleting(true)
    try {
      await deletePayrollGroup(group.id, selectedCompany.id)
      loadData()
    } finally {
      setDeleting(false)
    }
  }

  const handleToggleActive = async (group: PayrollGroupItem) => {
    if (!selectedCompany) return
    await updatePayrollGroup(group.id, selectedCompany.id, {
      isActive: !group.isActive,
    })
    loadData()
  }

  const activeAccounts = accounts.filter(a => a.isActive && !a.isVirtual)

  if (!selectedCompany) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">給与グループ管理</h1>
        <Card><CardContent className="py-8 text-center text-muted-foreground">会社を選択してください</CardContent></Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">給与グループ管理</h1>
          <p className="text-muted-foreground">{selectedCompany.name} の給与グループを管理します</p>
        </div>
        <CompanySwitcher />
        <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />グループ追加</Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : groups.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">給与グループが登録されていません</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>グループ名</TableHead>
                  <TableHead>コスト種別</TableHead>
                  <TableHead>支給日</TableHead>
                  <TableHead>休日調整</TableHead>
                  <TableHead>デフォルト口座</TableHead>
                  <TableHead>人数</TableHead>
                  <TableHead>状態</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groups.map((group) => {
                  const defaultAccount = accounts.find(a => a.id === group.defaultAccountId)
                  return (
                    <TableRow key={group.id}>
                      <TableCell className="font-medium">{group.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{costTypeLabels[group.costType] || group.costType}</Badge>
                      </TableCell>
                      <TableCell>
                        {group.payDayIsMonthEnd ? "月末" : group.payDay ? `${group.payDay}日` : "-"}
                      </TableCell>
                      <TableCell>
                        {group.holidayAdjust ? holidayAdjustLabels[group.holidayAdjust] || group.holidayAdjust : "-"}
                      </TableCell>
                      <TableCell>
                        {defaultAccount ? `${defaultAccount.bankName || ""} ${defaultAccount.branchName || ""}` : "-"}
                      </TableCell>
                      <TableCell>{group.headcount}名</TableCell>
                      <TableCell>
                        <Badge variant={group.isActive ? "default" : "secondary"}>
                          {group.isActive ? "有効" : "無効"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(group)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(group)} disabled={deleting}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editGroup ? "給与グループの編集" : "給与グループの追加"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>グループ名 *</Label>
              <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>コスト種別</Label>
                <Select value={formData.costType} onValueChange={(v) => setFormData({ ...formData, costType: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="COST">原価</SelectItem>
                    <SelectItem value="SGA">販管費</SelectItem>
                    <SelectItem value="OUTSOURCE">外注</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>人数</Label>
                <Input type="number" value={formData.headcount} onChange={(e) => setFormData({ ...formData, headcount: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>支給日</Label>
                <Input
                  type="number"
                  min={1}
                  max={31}
                  value={formData.payDay}
                  onChange={(e) => setFormData({ ...formData, payDay: e.target.value })}
                  disabled={formData.payDayIsMonthEnd}
                  placeholder="例: 25"
                />
              </div>
              <div className="flex items-end gap-2 pb-1">
                <Switch
                  checked={formData.payDayIsMonthEnd}
                  onCheckedChange={(v) => setFormData({ ...formData, payDayIsMonthEnd: v, payDay: v ? "" : formData.payDay })}
                />
                <Label>月末</Label>
              </div>
            </div>
            <div className="space-y-2">
              <Label>休日調整</Label>
              <Select value={formData.holidayAdjust || "NONE"} onValueChange={(v) => setFormData({ ...formData, holidayAdjust: v === "NONE" ? "" : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">なし</SelectItem>
                  <SelectItem value="PREV_BUSINESS">前営業日</SelectItem>
                  <SelectItem value="NEXT_BUSINESS">翌営業日</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>デフォルト振込口座</Label>
              <Select value={formData.defaultAccountId || "NONE"} onValueChange={(v) => setFormData({ ...formData, defaultAccountId: v === "NONE" ? "" : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">なし</SelectItem>
                  {activeAccounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.bankName || "口座"} {a.branchName || ""} {a.accountNumber || ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>デフォルト現金引出口座</Label>
              <Select value={formData.defaultCashAccountId || "NONE"} onValueChange={(v) => setFormData({ ...formData, defaultCashAccountId: v === "NONE" ? "" : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">なし</SelectItem>
                  {activeAccounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.bankName || "口座"} {a.branchName || ""} {a.accountNumber || ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {editGroup && (
              <div className="flex items-center gap-2">
                <Button
                  variant={editGroup.isActive ? "destructive" : "default"}
                  size="sm"
                  onClick={() => { handleToggleActive(editGroup); setDialogOpen(false) }}
                >
                  {editGroup.isActive ? "無効にする" : "有効にする"}
                </Button>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>キャンセル</Button>
            <Button onClick={handleSave} disabled={saving || !formData.name}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editGroup ? "更新" : "追加"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
