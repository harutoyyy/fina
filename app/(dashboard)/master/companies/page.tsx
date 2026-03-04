"use client"

import { useEffect, useState } from "react"
import { useCompany } from "@/contexts/company-context"
import { getCompanies, updateCompany } from "@/app/actions/companies"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Pencil, Loader2 } from "lucide-react"

type CompanyWithCounts = Awaited<ReturnType<typeof getCompanies>>[number]

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<CompanyWithCounts[]>([])
  const [loading, setLoading] = useState(true)
  const [editCompany, setEditCompany] = useState<CompanyWithCounts | null>(null)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    name: "", nameKana: "", shortName: "", industryType: "",
    representativeTitle: "", representativeName: "",
    postalCode: "", addressPrefecture: "", addressCity: "", addressStreet: "", addressBuilding: "",
    phone: "", fax: "", email: "", website: "",
    corporateNumber: "", invoiceNumber: "",
    fiscalMonth: 3, notes: "",
  })

  const loadCompanies = async () => {
    setLoading(true)
    const data = await getCompanies()
    setCompanies(data)
    setLoading(false)
  }

  useEffect(() => { loadCompanies() }, [])

  const openEdit = (company: CompanyWithCounts) => {
    setEditCompany(company)
    setFormData({
      name: company.name, nameKana: company.nameKana || "", shortName: company.shortName || "",
      industryType: company.industryType || "", representativeTitle: company.representativeTitle || "",
      representativeName: company.representativeName || "", postalCode: company.postalCode || "",
      addressPrefecture: company.addressPrefecture || "", addressCity: company.addressCity || "",
      addressStreet: company.addressStreet || "", addressBuilding: company.addressBuilding || "",
      phone: company.phone || "", fax: company.fax || "", email: company.email || "",
      website: company.website || "", corporateNumber: company.corporateNumber || "",
      invoiceNumber: company.invoiceNumber || "", fiscalMonth: company.fiscalMonth,
      notes: company.notes || "",
    })
  }

  const handleSave = async () => {
    if (!editCompany) return
    setSaving(true)
    await updateCompany(editCompany.id, {
      ...formData,
      nameKana: formData.nameKana || undefined,
      shortName: formData.shortName || undefined,
      industryType: formData.industryType || undefined,
      representativeTitle: formData.representativeTitle || undefined,
      representativeName: formData.representativeName || undefined,
      postalCode: formData.postalCode || undefined,
      addressPrefecture: formData.addressPrefecture || undefined,
      addressCity: formData.addressCity || undefined,
      addressStreet: formData.addressStreet || undefined,
      addressBuilding: formData.addressBuilding || undefined,
      phone: formData.phone || undefined,
      fax: formData.fax || undefined,
      email: formData.email || undefined,
      website: formData.website || undefined,
      corporateNumber: formData.corporateNumber || undefined,
      invoiceNumber: formData.invoiceNumber || undefined,
      notes: formData.notes || undefined,
    })
    setSaving(false)
    setEditCompany(null)
    loadCompanies()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">会社一覧</h1>
        <p className="text-muted-foreground">グループ会社の基本情報を管理します</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>登録済み会社</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>順序</TableHead>
                  <TableHead>会社名</TableHead>
                  <TableHead>略称</TableHead>
                  <TableHead>業種</TableHead>
                  <TableHead>決算月</TableHead>
                  <TableHead>ステータス</TableHead>
                  <TableHead className="text-right">口座数</TableHead>
                  <TableHead className="text-right">取引先数</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {companies.map((company) => (
                  <TableRow key={company.id}>
                    <TableCell>{company.displayOrder}</TableCell>
                    <TableCell className="font-medium">{company.name}</TableCell>
                    <TableCell>{company.shortName || "-"}</TableCell>
                    <TableCell>{company.industryType || "-"}</TableCell>
                    <TableCell>{company.fiscalMonth}月</TableCell>
                    <TableCell>
                      <Badge variant={company.status === "ACTIVE" ? "default" : "secondary"}>
                        {company.status === "ACTIVE" ? "稼働中" : company.status === "DORMANT" ? "休眠" : "清算中"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{company._count.accounts}</TableCell>
                    <TableCell className="text-right">{company._count.tradingPartners}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(company)}>
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

      <Dialog open={!!editCompany} onOpenChange={(open) => !open && setEditCompany(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>会社情報の編集</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>会社名 *</Label>
                <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>フリガナ</Label>
                <Input value={formData.nameKana} onChange={(e) => setFormData({ ...formData, nameKana: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>略称</Label>
                <Input value={formData.shortName} onChange={(e) => setFormData({ ...formData, shortName: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>業種</Label>
                <Input value={formData.industryType} onChange={(e) => setFormData({ ...formData, industryType: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>代表者役職</Label>
                <Input value={formData.representativeTitle} onChange={(e) => setFormData({ ...formData, representativeTitle: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>代表者氏名</Label>
                <Input value={formData.representativeName} onChange={(e) => setFormData({ ...formData, representativeName: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>郵便番号</Label>
                <Input value={formData.postalCode} onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>都道府県</Label>
                <Input value={formData.addressPrefecture} onChange={(e) => setFormData({ ...formData, addressPrefecture: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>市区町村</Label>
                <Input value={formData.addressCity} onChange={(e) => setFormData({ ...formData, addressCity: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>番地</Label>
                <Input value={formData.addressStreet} onChange={(e) => setFormData({ ...formData, addressStreet: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>電話番号</Label>
                <Input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>FAX</Label>
                <Input value={formData.fax} onChange={(e) => setFormData({ ...formData, fax: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>インボイス番号</Label>
                <Input value={formData.invoiceNumber} onChange={(e) => setFormData({ ...formData, invoiceNumber: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>決算月</Label>
                <Input type="number" min={1} max={12} value={formData.fiscalMonth} onChange={(e) => setFormData({ ...formData, fiscalMonth: parseInt(e.target.value) || 3 })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>備考</Label>
              <Input value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditCompany(null)}>キャンセル</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
