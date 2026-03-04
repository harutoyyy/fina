"use client"

import { useEffect, useState } from "react"
import { useCompany } from "@/contexts/company-context"
import { getPartners, createPartner, updatePartner, togglePartnerActive } from "@/app/actions/partners"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Plus, Pencil, Loader2 } from "lucide-react"
import type { TradingPartnerType } from "@prisma/client"

type Partner = Awaited<ReturnType<typeof getPartners>>[number]

const typeLabels: Record<string, string> = {
  CUSTOMER: "請求先",
  VENDOR: "支払先",
  BOTH: "双方",
}

const tagLabels: Record<string, string> = {
  CUSTOMER: "顧客",
  SUBCONTRACTOR: "協力会社",
  EXPENSE: "経費",
  BANK: "銀行",
  GROUP_COMPANY: "グループ会社",
  OTHER: "その他",
}

export default function PartnersPage() {
  const { selectedCompany } = useCompany()
  const [partners, setPartners] = useState<Partner[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editPartner, setEditPartner] = useState<Partner | null>(null)
  const [saving, setSaving] = useState(false)
  const [showInactive, setShowInactive] = useState(false)
  const [formData, setFormData] = useState({
    name: "", nameKana: "", type: "VENDOR" as TradingPartnerType, tagKey: "EXPENSE", notes: "",
  })

  const loadPartners = async () => {
    if (!selectedCompany) return
    setLoading(true)
    const data = await getPartners(selectedCompany.id)
    setPartners(data)
    setLoading(false)
  }

  useEffect(() => { loadPartners() }, [selectedCompany])

  const openCreate = () => {
    setEditPartner(null)
    setFormData({ name: "", nameKana: "", type: "VENDOR", tagKey: "EXPENSE", notes: "" })
    setDialogOpen(true)
  }

  const openEdit = (partner: Partner) => {
    setEditPartner(partner)
    setFormData({
      name: partner.name, nameKana: partner.nameKana || "",
      type: partner.type, tagKey: partner.tagKey, notes: partner.notes || "",
    })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!selectedCompany) return
    setSaving(true)
    if (editPartner) {
      await updatePartner(editPartner.id, {
        name: formData.name, nameKana: formData.nameKana || undefined,
        type: formData.type, tagKey: formData.tagKey, notes: formData.notes || undefined,
      })
    } else {
      await createPartner({
        companyId: selectedCompany.id,
        name: formData.name, nameKana: formData.nameKana || undefined,
        type: formData.type, tagKey: formData.tagKey, notes: formData.notes || undefined,
      })
    }
    setSaving(false)
    setDialogOpen(false)
    loadPartners()
  }

  const filteredPartners = showInactive ? partners : partners.filter((p) => p.isActive)

  if (!selectedCompany) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">取引先管理</h1>
        <Card><CardContent className="py-8 text-center text-muted-foreground">会社を選択してください</CardContent></Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">取引先管理</h1>
          <p className="text-muted-foreground">{selectedCompany.name} の取引先を管理します</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowInactive(!showInactive)}>
            {showInactive ? "有効のみ表示" : "無効も表示"}
          </Button>
          <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />取引先追加</Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : filteredPartners.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">取引先が登録されていません</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>取引先名</TableHead>
                  <TableHead>フリガナ</TableHead>
                  <TableHead>種別</TableHead>
                  <TableHead>タグ</TableHead>
                  <TableHead>デフォルト科目</TableHead>
                  <TableHead>状態</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPartners.map((partner) => (
                  <TableRow key={partner.id}>
                    <TableCell className="font-medium">{partner.name}</TableCell>
                    <TableCell>{partner.nameKana || "-"}</TableCell>
                    <TableCell>{typeLabels[partner.type] || partner.type}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{tagLabels[partner.tagKey] || partner.tagKey}</Badge>
                    </TableCell>
                    <TableCell>
                      {partner.defaults[0] ? (
                        <span className="text-sm">
                          {partner.defaults[0].mid.name}
                          {partner.defaults[0].sub && ` / ${partner.defaults[0].sub.name}`}
                        </span>
                      ) : "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={partner.isActive ? "default" : "secondary"}>
                        {partner.isActive ? "有効" : "無効"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(partner)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
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
            <DialogTitle>{editPartner ? "取引先の編集" : "取引先の追加"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>取引先名 *</Label>
              <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>フリガナ</Label>
              <Input value={formData.nameKana} onChange={(e) => setFormData({ ...formData, nameKana: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>種別</Label>
                <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v as TradingPartnerType })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CUSTOMER">請求先</SelectItem>
                    <SelectItem value="VENDOR">支払先</SelectItem>
                    <SelectItem value="BOTH">双方</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>タグ</Label>
                <Select value={formData.tagKey} onValueChange={(v) => setFormData({ ...formData, tagKey: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CUSTOMER">顧客</SelectItem>
                    <SelectItem value="SUBCONTRACTOR">協力会社</SelectItem>
                    <SelectItem value="EXPENSE">経費</SelectItem>
                    <SelectItem value="BANK">銀行</SelectItem>
                    <SelectItem value="GROUP_COMPANY">グループ会社</SelectItem>
                    <SelectItem value="OTHER">その他</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>備考</Label>
              <Input value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} />
            </div>
            {editPartner && (
              <div>
                <Button
                  variant={editPartner.isActive ? "destructive" : "default"}
                  size="sm"
                  onClick={async () => { await togglePartnerActive(editPartner.id); setDialogOpen(false); loadPartners() }}
                >
                  {editPartner.isActive ? "無効にする" : "有効にする"}
                </Button>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>キャンセル</Button>
            <Button onClick={handleSave} disabled={saving || !formData.name}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editPartner ? "更新" : "追加"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
