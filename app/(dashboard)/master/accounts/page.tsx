"use client"

import { useEffect, useState } from "react"
import { useCompany } from "@/contexts/company-context"
import { CompanySwitcher } from "@/components/company-switcher"
import { getAccounts, createAccount, updateAccount, toggleAccountActive } from "@/app/actions/accounts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import { Plus, Pencil, Loader2 } from "lucide-react"
import type { AccountType } from "@prisma/client"

type AccountWithCompany = Awaited<ReturnType<typeof getAccounts>>[number]

const accountTypeLabels: Record<string, string> = {
  ORDINARY: "普通預金",
  TERM: "定期預金",
  SOCIAL_INSURANCE_RESERVE: "社保積立",
  CONSUMPTION_TAX_RESERVE: "消費税積立",
}

export default function AccountsPage() {
  const { selectedCompany } = useCompany()
  const [accounts, setAccounts] = useState<AccountWithCompany[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editAccount, setEditAccount] = useState<AccountWithCompany | null>(null)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    bankName: "", bankCode: "", branchName: "", branchCode: "",
    accountNumber: "", accountType: "ORDINARY" as AccountType,
    accountHolder: "", isMain: false,
  })

  const loadAccounts = async () => {
    if (!selectedCompany) return
    setLoading(true)
    const data = await getAccounts(selectedCompany.id)
    setAccounts(data)
    setLoading(false)
  }

  useEffect(() => { loadAccounts() }, [selectedCompany])

  const openCreate = () => {
    setEditAccount(null)
    setFormData({
      bankName: "", bankCode: "", branchName: "", branchCode: "",
      accountNumber: "", accountType: "ORDINARY",
      accountHolder: "", isMain: false,
    })
    setDialogOpen(true)
  }

  const openEdit = (account: AccountWithCompany) => {
    setEditAccount(account)
    setFormData({
      bankName: account.bankName || "", bankCode: account.bankCode || "",
      branchName: account.branchName || "", branchCode: account.branchCode || "",
      accountNumber: account.accountNumber || "", accountType: account.accountType,
      accountHolder: account.accountHolder || "", isMain: account.isMain,
    })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!selectedCompany) return
    setSaving(true)
    if (editAccount) {
      await updateAccount(editAccount.id, {
        bankName: formData.bankName || undefined,
        bankCode: formData.bankCode || undefined,
        branchName: formData.branchName || undefined,
        branchCode: formData.branchCode || undefined,
        accountNumber: formData.accountNumber || undefined,
        accountHolder: formData.accountHolder || undefined,
        isMain: formData.isMain,
      })
    } else {
      await createAccount({
        companyId: selectedCompany.id,
        bankName: formData.bankName || undefined,
        bankCode: formData.bankCode || undefined,
        branchName: formData.branchName || undefined,
        branchCode: formData.branchCode || undefined,
        accountNumber: formData.accountNumber || undefined,
        accountType: formData.accountType,
        accountHolder: formData.accountHolder || undefined,
        isMain: formData.isMain,
      })
    }
    setSaving(false)
    setDialogOpen(false)
    loadAccounts()
  }

  const handleToggleActive = async (id: string) => {
    await toggleAccountActive(id)
    loadAccounts()
  }

  if (!selectedCompany) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">銀行口座管理</h1>
        <Card><CardContent className="py-8 text-center text-muted-foreground">会社を選択してください</CardContent></Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">銀行口座管理</h1>
          <p className="text-muted-foreground">{selectedCompany.name} の口座を管理します</p>
        </div>
        <CompanySwitcher />
        <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />口座追加</Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : accounts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">口座が登録されていません</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>銀行名</TableHead>
                  <TableHead>支店名</TableHead>
                  <TableHead>口座番号</TableHead>
                  <TableHead>種別</TableHead>
                  <TableHead>名義</TableHead>
                  <TableHead>メイン</TableHead>
                  <TableHead>状態</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.filter(a => !a.isVirtual).map((account) => (
                  <TableRow key={account.id}>
                    <TableCell className="font-medium">{account.bankName || "-"}</TableCell>
                    <TableCell>{account.branchName || "-"}</TableCell>
                    <TableCell>{account.accountNumber || "-"}</TableCell>
                    <TableCell>{accountTypeLabels[account.accountType] || account.accountType}</TableCell>
                    <TableCell>{account.accountHolder || "-"}</TableCell>
                    <TableCell>{account.isMain ? <Badge>メイン</Badge> : "-"}</TableCell>
                    <TableCell>
                      <Badge variant={account.isActive ? "default" : "secondary"}>
                        {account.isActive ? "有効" : "無効"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(account)}>
                          <Pencil className="h-4 w-4" />
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
            <DialogTitle>{editAccount ? "口座の編集" : "口座の追加"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>銀行名</Label>
                <Input value={formData.bankName} onChange={(e) => setFormData({ ...formData, bankName: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>銀行コード</Label>
                <Input value={formData.bankCode} onChange={(e) => setFormData({ ...formData, bankCode: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>支店名</Label>
                <Input value={formData.branchName} onChange={(e) => setFormData({ ...formData, branchName: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>支店コード</Label>
                <Input value={formData.branchCode} onChange={(e) => setFormData({ ...formData, branchCode: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>口座番号</Label>
                <Input value={formData.accountNumber} onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })} />
              </div>
              {!editAccount && (
                <div className="space-y-2">
                  <Label>口座種別</Label>
                  <Select value={formData.accountType} onValueChange={(v) => setFormData({ ...formData, accountType: v as AccountType })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ORDINARY">普通預金</SelectItem>
                      <SelectItem value="TERM">定期預金</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label>名義（カナ）</Label>
              <Input value={formData.accountHolder} onChange={(e) => setFormData({ ...formData, accountHolder: e.target.value })} />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={formData.isMain} onCheckedChange={(v) => setFormData({ ...formData, isMain: v })} />
              <Label>メイン口座</Label>
            </div>
            {editAccount && (
              <div className="flex items-center gap-2">
                <Button variant={editAccount.isActive ? "destructive" : "default"} size="sm" onClick={() => { handleToggleActive(editAccount.id); setDialogOpen(false) }}>
                  {editAccount.isActive ? "無効にする" : "有効にする"}
                </Button>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>キャンセル</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editAccount ? "更新" : "追加"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
