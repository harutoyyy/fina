"use client"

import { useEffect, useState } from "react"
import { useCompany } from "@/contexts/company-context"
import { getPartners, createPartner, updatePartner, togglePartnerActive } from "@/app/actions/partners"
import { getPartnerBankAccounts, createPartnerBankAccount, updatePartnerBankAccount, deletePartnerBankAccount } from "@/app/actions/partner-bank-accounts"
import { getPartnerSites, createPartnerSite, updatePartnerSite, deletePartnerSite } from "@/app/actions/partner-sites"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Plus, Pencil, Trash2, Loader2, Building, MapPin } from "lucide-react"
import type { TradingPartnerType } from "@prisma/client"

type Partner = Awaited<ReturnType<typeof getPartners>>[number]
type PartnerBankAccount = Awaited<ReturnType<typeof getPartnerBankAccounts>>[number]

const typeLabels: Record<string, string> = { CUSTOMER: "請求先", VENDOR: "支払先", BOTH: "双方" }
const tagLabels: Record<string, string> = {
  CUSTOMER: "顧客", SUBCONTRACTOR: "協力会社", EXPENSE: "経費",
  BANK: "銀行", GROUP_COMPANY: "グループ会社", OTHER: "その他",
}
const frequencyLabels: Record<string, string> = {
  MONTHLY: "毎月", BIMONTHLY_ODD: "隔月(奇数)", BIMONTHLY_EVEN: "隔月(偶数)",
  QUARTERLY: "四半期", YEARLY: "年次", SPECIFIC_MONTHS: "特定月",
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

  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null)
  const [bankAccounts, setBankAccounts] = useState<PartnerBankAccount[]>([])
  const [bankDialogOpen, setBankDialogOpen] = useState(false)
  const [editBankAccount, setEditBankAccount] = useState<PartnerBankAccount | null>(null)
  const [bankForm, setBankForm] = useState({
    bankCode: "", branchCode: "", accountType: "ORDINARY", accountNumber: "", accountHolder: "",
  })

  const [sites, setSites] = useState<Record<string, unknown>[]>([])
  const [siteDialogOpen, setSiteDialogOpen] = useState(false)
  const [editSite, setEditSite] = useState<Record<string, unknown> | null>(null)
  const [siteForm, setSiteForm] = useState({
    siteName: "", frequency: "", dueDayRule: "", holidayAdjust: "NONE", amountType: "", fixedAmount: "",
  })

  const loadPartners = async () => {
    if (!selectedCompany) return
    setLoading(true)
    const data = await getPartners(selectedCompany.id)
    setPartners(data)
    setLoading(false)
  }

  useEffect(() => { loadPartners() }, [selectedCompany])

  const selectPartner = async (partner: Partner) => {
    if (!selectedCompany) return
    setSelectedPartner(partner)
    const [accts, partnerSites] = await Promise.all([
      getPartnerBankAccounts(partner.id, selectedCompany.id),
      getPartnerSites(partner.id, selectedCompany.id),
    ])
    setBankAccounts(accts)
    setSites(partnerSites as Record<string, unknown>[])
  }

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

  const openBankCreate = () => {
    setEditBankAccount(null)
    setBankForm({ bankCode: "", branchCode: "", accountType: "ORDINARY", accountNumber: "", accountHolder: "" })
    setBankDialogOpen(true)
  }

  const openBankEdit = (acct: PartnerBankAccount) => {
    setEditBankAccount(acct)
    setBankForm({
      bankCode: acct.bankCode, branchCode: acct.branchCode,
      accountType: acct.accountType, accountNumber: acct.accountNumber, accountHolder: acct.accountHolder,
    })
    setBankDialogOpen(true)
  }

  const handleBankSave = async () => {
    if (!selectedPartner || !selectedCompany) return
    setSaving(true)
    try {
      if (editBankAccount) {
        await updatePartnerBankAccount(editBankAccount.id, selectedCompany.id, bankForm)
      } else {
        await createPartnerBankAccount({ partnerId: selectedPartner.id, companyId: selectedCompany.id, ...bankForm })
      }
      setBankDialogOpen(false)
      const accts = await getPartnerBankAccounts(selectedPartner.id, selectedCompany.id)
      setBankAccounts(accts)
    } catch { alert("保存に失敗しました") }
    setSaving(false)
  }

  const handleBankDelete = async (id: string) => {
    if (!selectedCompany || !confirm("この振込先口座を削除しますか？")) return
    await deletePartnerBankAccount(id, selectedCompany.id)
    if (selectedPartner) {
      const accts = await getPartnerBankAccounts(selectedPartner.id, selectedCompany.id)
      setBankAccounts(accts)
    }
  }

  const openSiteCreate = () => {
    setEditSite(null)
    setSiteForm({ siteName: "", frequency: "", dueDayRule: "", holidayAdjust: "NONE", amountType: "", fixedAmount: "" })
    setSiteDialogOpen(true)
  }

  const openSiteEdit = (site: Record<string, unknown>) => {
    setEditSite(site)
    setSiteForm({
      siteName: (site.siteName as string) || "",
      frequency: (site.frequency as string) || "",
      dueDayRule: (site.dueDayRule as string) || "",
      holidayAdjust: (site.holidayAdjust as string) || "NONE",
      amountType: (site.amountType as string) || "",
      fixedAmount: (site.fixedAmount as string) || "",
    })
    setSiteDialogOpen(true)
  }

  const handleSiteSave = async () => {
    if (!selectedPartner || !selectedCompany) return
    setSaving(true)
    try {
      if (editSite) {
        await updatePartnerSite(editSite.id as string, selectedCompany.id, {
          siteName: siteForm.siteName,
          frequency: siteForm.frequency || null,
          dueDayRule: siteForm.dueDayRule || null,
          holidayAdjust: siteForm.holidayAdjust || null,
          amountType: siteForm.amountType || null,
          fixedAmount: siteForm.fixedAmount || null,
        })
      } else {
        await createPartnerSite({
          partnerId: selectedPartner.id,
          companyId: selectedCompany.id,
          siteName: siteForm.siteName,
          frequency: siteForm.frequency || undefined,
          dueDayRule: siteForm.dueDayRule || undefined,
          holidayAdjust: siteForm.holidayAdjust || undefined,
          amountType: siteForm.amountType || undefined,
          fixedAmount: siteForm.fixedAmount || undefined,
        })
      }
      setSiteDialogOpen(false)
      const partnerSites = await getPartnerSites(selectedPartner.id, selectedCompany.id)
      setSites(partnerSites as Record<string, unknown>[])
    } catch { alert("保存に失敗しました") }
    setSaving(false)
  }

  const handleSiteDelete = async (id: string) => {
    if (!selectedCompany || !confirm("この地点を削除しますか？")) return
    await deletePartnerSite(id, selectedCompany.id)
    if (selectedPartner) {
      const partnerSites = await getPartnerSites(selectedPartner.id, selectedCompany.id)
      setSites(partnerSites as Record<string, unknown>[])
    }
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
                  <TableHead>振込口座</TableHead>
                  <TableHead>状態</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPartners.map((partner) => (
                  <TableRow key={partner.id} className={`cursor-pointer ${selectedPartner?.id === partner.id ? "bg-accent" : ""}`} onClick={() => selectPartner(partner)}>
                    <TableCell className="font-medium">{partner.name}</TableCell>
                    <TableCell>{partner.nameKana || "-"}</TableCell>
                    <TableCell>{typeLabels[partner.type] || partner.type}</TableCell>
                    <TableCell><Badge variant="outline">{tagLabels[partner.tagKey] || partner.tagKey}</Badge></TableCell>
                    <TableCell>
                      {partner.defaults[0] ? (
                        <span className="text-sm">{partner.defaults[0].mid.name}{partner.defaults[0].sub && ` / ${partner.defaults[0].sub.name}`}</span>
                      ) : "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{partner.bankAccounts.length}件</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={partner.isActive ? "default" : "secondary"}>{partner.isActive ? "有効" : "無効"}</Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); openEdit(partner) }}>
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

      {selectedPartner && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2"><Building className="h-4 w-4" />振込先口座</CardTitle>
                <Button size="sm" onClick={openBankCreate}><Plus className="h-4 w-4 mr-1" />追加</Button>
              </div>
              <p className="text-sm text-muted-foreground">{selectedPartner.name}</p>
            </CardHeader>
            <CardContent>
              {bankAccounts.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">振込先口座が登録されていません</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>銀行コード</TableHead>
                      <TableHead>支店コード</TableHead>
                      <TableHead>口座番号</TableHead>
                      <TableHead>名義</TableHead>
                      <TableHead>状態</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bankAccounts.map((acct) => (
                      <TableRow key={acct.id}>
                        <TableCell className="font-mono">{acct.bankCode}</TableCell>
                        <TableCell className="font-mono">{acct.branchCode}</TableCell>
                        <TableCell className="font-mono">{acct.accountNumber}</TableCell>
                        <TableCell>{acct.accountHolder}</TableCell>
                        <TableCell><Badge variant={acct.isActive ? "default" : "secondary"}>{acct.isActive ? "有効" : "無効"}</Badge></TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openBankEdit(acct)}><Pencil className="h-3 w-3" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => handleBankDelete(acct.id)}><Trash2 className="h-3 w-3" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2"><MapPin className="h-4 w-4" />契約/地点テンプレ</CardTitle>
                <Button size="sm" onClick={openSiteCreate}><Plus className="h-4 w-4 mr-1" />追加</Button>
              </div>
              <p className="text-sm text-muted-foreground">{selectedPartner.name}</p>
            </CardHeader>
            <CardContent>
              {sites.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">地点が登録されていません</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>地点名</TableHead>
                      <TableHead>頻度</TableHead>
                      <TableHead>支払日</TableHead>
                      <TableHead>金額タイプ</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sites.map((site) => (
                      <TableRow key={site.id as string}>
                        <TableCell className="font-medium">{site.siteName as string}</TableCell>
                        <TableCell>{site.frequency ? (frequencyLabels[String(site.frequency)] || String(site.frequency)) : "-"}</TableCell>
                        <TableCell>{site.dueDayRule ? String(site.dueDayRule) : "-"}</TableCell>
                        <TableCell>{site.amountType === "FIXED" ? "固定" : site.amountType === "VARIABLE" ? "変動" : site.amountType === "MANUAL" ? "手動" : "-"}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openSiteEdit(site)}><Pencil className="h-3 w-3" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => handleSiteDelete(site.id as string)}><Trash2 className="h-3 w-3" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editPartner ? "取引先の編集" : "取引先の追加"}</DialogTitle></DialogHeader>
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
                  variant={editPartner.isActive ? "destructive" : "default"} size="sm"
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
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{editPartner ? "更新" : "追加"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bankDialogOpen} onOpenChange={setBankDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editBankAccount ? "振込先口座の編集" : "振込先口座の追加"}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>銀行コード *</Label>
                <Input value={bankForm.bankCode} onChange={(e) => setBankForm({ ...bankForm, bankCode: e.target.value })} maxLength={4} placeholder="0001" />
              </div>
              <div className="space-y-2">
                <Label>支店コード *</Label>
                <Input value={bankForm.branchCode} onChange={(e) => setBankForm({ ...bankForm, branchCode: e.target.value })} maxLength={3} placeholder="001" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>口座種別</Label>
                <Select value={bankForm.accountType} onValueChange={(v) => setBankForm({ ...bankForm, accountType: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ORDINARY">普通</SelectItem>
                    <SelectItem value="CURRENT">当座</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>口座番号 *</Label>
                <Input value={bankForm.accountNumber} onChange={(e) => setBankForm({ ...bankForm, accountNumber: e.target.value })} maxLength={7} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>名義カナ（半角） *</Label>
              <Input value={bankForm.accountHolder} onChange={(e) => setBankForm({ ...bankForm, accountHolder: e.target.value })} placeholder="ｶﾌﾞｼｷｶﾞｲｼﾔ ○○" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBankDialogOpen(false)}>キャンセル</Button>
            <Button onClick={handleBankSave} disabled={saving || !bankForm.bankCode || !bankForm.branchCode || !bankForm.accountNumber || !bankForm.accountHolder}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={siteDialogOpen} onOpenChange={setSiteDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editSite ? "地点の編集" : "地点の追加"}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>地点名（物件名） *</Label>
              <Input value={siteForm.siteName} onChange={(e) => setSiteForm({ ...siteForm, siteName: e.target.value })} placeholder="例：Aアパート" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>頻度</Label>
                <Select value={siteForm.frequency} onValueChange={(v) => setSiteForm({ ...siteForm, frequency: v })}>
                  <SelectTrigger><SelectValue placeholder="選択" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MONTHLY">毎月</SelectItem>
                    <SelectItem value="BIMONTHLY_ODD">隔月（奇数月）</SelectItem>
                    <SelectItem value="BIMONTHLY_EVEN">隔月（偶数月）</SelectItem>
                    <SelectItem value="QUARTERLY">四半期</SelectItem>
                    <SelectItem value="YEARLY">年次</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>支払日ルール</Label>
                <Select value={siteForm.dueDayRule} onValueChange={(v) => setSiteForm({ ...siteForm, dueDayRule: v })}>
                  <SelectTrigger><SelectValue placeholder="選択" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MONTH_END">月末</SelectItem>
                    <SelectItem value="DAY_5">5日</SelectItem>
                    <SelectItem value="DAY_10">10日</SelectItem>
                    <SelectItem value="DAY_15">15日</SelectItem>
                    <SelectItem value="DAY_20">20日</SelectItem>
                    <SelectItem value="DAY_25">25日</SelectItem>
                    <SelectItem value="DAY_27">27日</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>休日調整</Label>
                <Select value={siteForm.holidayAdjust} onValueChange={(v) => setSiteForm({ ...siteForm, holidayAdjust: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">なし</SelectItem>
                    <SelectItem value="PREV_BUSINESS">前営業日</SelectItem>
                    <SelectItem value="NEXT_BUSINESS">翌営業日</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>金額タイプ</Label>
                <Select value={siteForm.amountType} onValueChange={(v) => setSiteForm({ ...siteForm, amountType: v })}>
                  <SelectTrigger><SelectValue placeholder="選択" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FIXED">固定</SelectItem>
                    <SelectItem value="VARIABLE">変動（前月コピー）</SelectItem>
                    <SelectItem value="MANUAL">手動</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {siteForm.amountType === "FIXED" && (
              <div className="space-y-2">
                <Label>固定金額</Label>
                <Input type="number" value={siteForm.fixedAmount} onChange={(e) => setSiteForm({ ...siteForm, fixedAmount: e.target.value })} />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSiteDialogOpen(false)}>キャンセル</Button>
            <Button onClick={handleSiteSave} disabled={saving || !siteForm.siteName}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
