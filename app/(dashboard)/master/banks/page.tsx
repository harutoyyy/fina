"use client"

import { useEffect, useState } from "react"
import { getBanks, getBankWithBranches, createBank, updateBank, createBranch, updateBranch, seedMajorBanks } from "@/app/actions/bank-masters"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Plus, Pencil, Search, Loader2, ChevronRight, Database } from "lucide-react"

type Bank = Awaited<ReturnType<typeof getBanks>>[number]
type BankWithBranches = Awaited<ReturnType<typeof getBankWithBranches>>

export default function BanksPage() {
  const [banks, setBanks] = useState<Bank[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [bankDialogOpen, setBankDialogOpen] = useState(false)
  const [editBank, setEditBank] = useState<Bank | null>(null)
  const [bankForm, setBankForm] = useState({ bankCode: "", bankName: "", bankNameKana: "" })
  const [saving, setSaving] = useState(false)
  const [seeding, setSeeding] = useState(false)

  const [selectedBank, setSelectedBank] = useState<BankWithBranches | null>(null)
  const [branchSearch, setBranchSearch] = useState("")
  const [branchDialogOpen, setBranchDialogOpen] = useState(false)
  const [editBranch, setEditBranch] = useState<NonNullable<BankWithBranches>["branches"][number] | null>(null)
  const [branchForm, setBranchForm] = useState({ branchCode: "", branchName: "", branchNameKana: "" })

  const loadBanks = async (query?: string) => {
    setLoading(true)
    const data = await getBanks(query || undefined)
    setBanks(data)
    setLoading(false)
  }

  useEffect(() => { loadBanks() }, [])

  const handleSearch = () => {
    loadBanks(searchQuery || undefined)
  }

  const handleSeedBanks = async () => {
    setSeeding(true)
    try {
      const result = await seedMajorBanks()
      alert(`${result.created}件の銀行マスタを登録しました`)
      loadBanks()
    } catch {
      alert("登録に失敗しました")
    }
    setSeeding(false)
  }

  const openBankCreate = () => {
    setEditBank(null)
    setBankForm({ bankCode: "", bankName: "", bankNameKana: "" })
    setBankDialogOpen(true)
  }

  const openBankEdit = (bank: Bank) => {
    setEditBank(bank)
    setBankForm({ bankCode: bank.bankCode, bankName: bank.bankName, bankNameKana: bank.bankNameKana || "" })
    setBankDialogOpen(true)
  }

  const saveBank = async () => {
    setSaving(true)
    try {
      if (editBank) {
        await updateBank(editBank.bankCode, { bankName: bankForm.bankName, bankNameKana: bankForm.bankNameKana || undefined })
      } else {
        await createBank(bankForm)
      }
      setBankDialogOpen(false)
      loadBanks()
    } catch {
      alert("保存に失敗しました")
    }
    setSaving(false)
  }

  const toggleBankActive = async (bank: Bank) => {
    await updateBank(bank.bankCode, { isActive: !bank.isActive })
    loadBanks()
  }

  const selectBank = async (bank: Bank) => {
    const data = await getBankWithBranches(bank.bankCode)
    setSelectedBank(data)
    setBranchSearch("")
  }

  const openBranchCreate = () => {
    setEditBranch(null)
    setBranchForm({ branchCode: "", branchName: "", branchNameKana: "" })
    setBranchDialogOpen(true)
  }

  const openBranchEdit = (branch: NonNullable<BankWithBranches>["branches"][number]) => {
    setEditBranch(branch)
    setBranchForm({ branchCode: branch.branchCode, branchName: branch.branchName, branchNameKana: branch.branchNameKana || "" })
    setBranchDialogOpen(true)
  }

  const saveBranch = async () => {
    if (!selectedBank) return
    setSaving(true)
    try {
      if (editBranch) {
        await updateBranch(editBranch.id, { branchName: branchForm.branchName, branchNameKana: branchForm.branchNameKana || undefined })
      } else {
        await createBranch({ bankCode: selectedBank.bankCode, ...branchForm })
      }
      setBranchDialogOpen(false)
      const data = await getBankWithBranches(selectedBank.bankCode)
      setSelectedBank(data)
    } catch {
      alert("保存に失敗しました")
    }
    setSaving(false)
  }

  const toggleBranchActive = async (branch: NonNullable<BankWithBranches>["branches"][number]) => {
    if (!selectedBank) return
    await updateBranch(branch.id, { isActive: !branch.isActive })
    const data = await getBankWithBranches(selectedBank.bankCode)
    setSelectedBank(data)
  }

  const filteredBranches = selectedBank?.branches.filter((b) => {
    if (!branchSearch) return true
    return b.branchCode.includes(branchSearch) || b.branchName.includes(branchSearch) || b.branchNameKana?.includes(branchSearch)
  }) || []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">銀行・支店マスタ</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleSeedBanks} disabled={seeding}>
            {seeding ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Database className="h-4 w-4 mr-2" />}
            主要銀行一括登録
          </Button>
          <Button onClick={openBankCreate}>
            <Plus className="h-4 w-4 mr-2" />銀行追加
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">銀行一覧</CardTitle>
            <div className="flex gap-2">
              <Input placeholder="銀行コード・銀行名で検索" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSearch()} />
              <Button variant="outline" size="icon" onClick={handleSearch}><Search className="h-4 w-4" /></Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : banks.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">銀行データがありません。「主要銀行一括登録」で初期データを登録してください。</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20">コード</TableHead>
                    <TableHead>銀行名</TableHead>
                    <TableHead>カナ</TableHead>
                    <TableHead className="w-20">状態</TableHead>
                    <TableHead className="w-24"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {banks.map((bank) => (
                    <TableRow key={bank.bankCode} className={`cursor-pointer ${selectedBank?.bankCode === bank.bankCode ? "bg-accent" : ""}`} onClick={() => selectBank(bank)}>
                      <TableCell className="font-mono">{bank.bankCode}</TableCell>
                      <TableCell>{bank.bankName}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{bank.bankNameKana}</TableCell>
                      <TableCell><Badge variant={bank.isActive ? "default" : "secondary"}>{bank.isActive ? "有効" : "無効"}</Badge></TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); openBankEdit(bank) }}><Pencil className="h-4 w-4" /></Button>
                          <ChevronRight className="h-4 w-4 mt-2 text-muted-foreground" />
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
            <CardTitle className="text-lg">
              {selectedBank ? `${selectedBank.bankName} - 支店一覧` : "支店一覧"}
            </CardTitle>
            {selectedBank && (
              <div className="flex gap-2">
                <Input placeholder="支店コード・支店名で検索" value={branchSearch} onChange={(e) => setBranchSearch(e.target.value)} />
                <Button onClick={openBranchCreate}><Plus className="h-4 w-4 mr-2" />支店追加</Button>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {!selectedBank ? (
              <p className="text-center text-muted-foreground py-8">左の銀行一覧から銀行を選択してください</p>
            ) : filteredBranches.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">支店データがありません</p>
            ) : (
              <div className="max-h-[600px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-20">コード</TableHead>
                      <TableHead>支店名</TableHead>
                      <TableHead>カナ</TableHead>
                      <TableHead className="w-20">状態</TableHead>
                      <TableHead className="w-16"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredBranches.map((branch) => (
                      <TableRow key={branch.id}>
                        <TableCell className="font-mono">{branch.branchCode}</TableCell>
                        <TableCell>{branch.branchName}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{branch.branchNameKana}</TableCell>
                        <TableCell><Badge variant={branch.isActive ? "default" : "secondary"}>{branch.isActive ? "有効" : "無効"}</Badge></TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => openBranchEdit(branch)}><Pencil className="h-4 w-4" /></Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={bankDialogOpen} onOpenChange={setBankDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editBank ? "銀行編集" : "銀行追加"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>銀行コード</Label>
              <Input value={bankForm.bankCode} onChange={(e) => setBankForm({ ...bankForm, bankCode: e.target.value })} disabled={!!editBank} maxLength={4} />
            </div>
            <div>
              <Label>銀行名</Label>
              <Input value={bankForm.bankName} onChange={(e) => setBankForm({ ...bankForm, bankName: e.target.value })} />
            </div>
            <div>
              <Label>銀行名カナ</Label>
              <Input value={bankForm.bankNameKana} onChange={(e) => setBankForm({ ...bankForm, bankNameKana: e.target.value })} />
            </div>
            {editBank && (
              <div className="flex items-center gap-2">
                <Label>ステータス</Label>
                <Button variant="outline" size="sm" onClick={() => toggleBankActive(editBank)}>
                  {editBank.isActive ? "無効にする" : "有効にする"}
                </Button>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBankDialogOpen(false)}>キャンセル</Button>
            <Button onClick={saveBank} disabled={saving || !bankForm.bankCode || !bankForm.bankName}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={branchDialogOpen} onOpenChange={setBranchDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editBranch ? "支店編集" : "支店追加"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>支店コード</Label>
              <Input value={branchForm.branchCode} onChange={(e) => setBranchForm({ ...branchForm, branchCode: e.target.value })} disabled={!!editBranch} maxLength={3} />
            </div>
            <div>
              <Label>支店名</Label>
              <Input value={branchForm.branchName} onChange={(e) => setBranchForm({ ...branchForm, branchName: e.target.value })} />
            </div>
            <div>
              <Label>支店名カナ</Label>
              <Input value={branchForm.branchNameKana} onChange={(e) => setBranchForm({ ...branchForm, branchNameKana: e.target.value })} />
            </div>
            {editBranch && (
              <div className="flex items-center gap-2">
                <Label>ステータス</Label>
                <Button variant="outline" size="sm" onClick={() => toggleBranchActive(editBranch)}>
                  {editBranch.isActive ? "無効にする" : "有効にする"}
                </Button>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBranchDialogOpen(false)}>キャンセル</Button>
            <Button onClick={saveBranch} disabled={saving || !branchForm.branchCode || !branchForm.branchName}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
