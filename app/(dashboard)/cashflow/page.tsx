"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { useCompany } from "@/contexts/company-context"
import { CompanySwitcher } from "@/components/company-switcher"
import { getAccounts } from "@/app/actions/accounts"
import { getFundTransfers, createFundTransfer, deleteFundTransfer } from "@/app/actions/fund-transfers"
import { getCompanies } from "@/app/actions/companies"
import { formatYen, getCurrentMonth, formatDate } from "@/lib/format"

type AccountItem = {
  id: string
  bankName: string | null
  branchName: string | null
  accountNumber: string | null
  accountType: string
  isVirtual: boolean
  companyId: string
  company?: { name: string; shortName: string | null }
}

type FundTransferItem = {
  id: string
  companyId: string
  accountId: string
  transactionDate: string | null
  accountingMonth: string
  amount: string
  summary: string | null
  account: { id: string; bankName: string | null; branchName: string | null }
  fundTransfer: {
    id: string
    fromAccountId: string
    toAccountId: string
    amount: string
    counterCompanyId: string | null
    fromAccount: { id: string; bankName: string | null; branchName: string | null }
    toAccount: { id: string; bankName: string | null; branchName: string | null }
  } | null
}

type CompanyItem = {
  id: string
  name: string
  shortName: string | null
}

function formatAccountName(account: { bankName: string | null; branchName: string | null }) {
  return [account.bankName, account.branchName].filter(Boolean).join(" / ") || "未設定"
}

export default function CashflowPage() {
  const { selectedCompany } = useCompany()
  const [accounts, setAccounts] = useState<AccountItem[]>([])
  const [allAccounts, setAllAccounts] = useState<AccountItem[]>([])
  const [transfers, setTransfers] = useState<FundTransferItem[]>([])
  const [companies, setCompanies] = useState<CompanyItem[]>([])
  const [filterMonth, setFilterMonth] = useState(getCurrentMonth())
  const [dialogOpen, setDialogOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [fromAccountId, setFromAccountId] = useState("")
  const [toAccountId, setToAccountId] = useState("")
  const [transferDate, setTransferDate] = useState(new Date().toISOString().split("T")[0])
  const [amount, setAmount] = useState("")
  const [accountingMonth, setAccountingMonth] = useState(getCurrentMonth())
  const [summary, setSummary] = useState("")
  const [isInterCompany, setIsInterCompany] = useState(false)
  const [counterCompanyId, setCounterCompanyId] = useState("")

  const loadData = useCallback(async () => {
    if (!selectedCompany) return
    setLoading(true)
    try {
      const [accts, txs, comps] = await Promise.all([
        getAccounts(selectedCompany.id),
        getFundTransfers(selectedCompany.id, filterMonth || undefined),
        getCompanies(),
      ])
      setAccounts(accts as AccountItem[])
      setTransfers(txs as FundTransferItem[])
      setCompanies(comps as CompanyItem[])
    } catch (err) {
      console.error("Failed to load data:", err)
    } finally {
      setLoading(false)
    }
  }, [selectedCompany, filterMonth])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    if (!isInterCompany || !counterCompanyId) {
      setAllAccounts(accounts)
      return
    }
    const loadCounterAccounts = async () => {
      try {
        const counterAccts = await getAccounts(counterCompanyId)
        setAllAccounts([...accounts, ...(counterAccts as AccountItem[])])
      } catch {
        setAllAccounts(accounts)
      }
    }
    loadCounterAccounts()
  }, [isInterCompany, counterCompanyId, accounts])

  const resetForm = () => {
    setFromAccountId("")
    setToAccountId("")
    setTransferDate(new Date().toISOString().split("T")[0])
    setAmount("")
    setAccountingMonth(getCurrentMonth())
    setSummary("")
    setIsInterCompany(false)
    setCounterCompanyId("")
  }

  const handleSubmit = async () => {
    if (!selectedCompany || !fromAccountId || !toAccountId || !amount) return
    if (fromAccountId === toAccountId) {
      alert("移動元と移動先は異なる口座を選択してください")
      return
    }
    setSubmitting(true)
    try {
      await createFundTransfer({
        companyId: selectedCompany.id,
        fromAccountId,
        toAccountId,
        transferDate,
        amount,
        accountingMonth,
        summary: summary || undefined,
        counterCompanyId: isInterCompany && counterCompanyId ? counterCompanyId : undefined,
      })
      setDialogOpen(false)
      resetForm()
      await loadData()
    } catch (err) {
      console.error("Failed to create fund transfer:", err)
      alert("資金移動の作成に失敗しました")
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (transactionId: string) => {
    if (!confirm("この資金移動を削除しますか？")) return
    try {
      await deleteFundTransfer(transactionId, selectedCompany!.id)
      await loadData()
    } catch (err) {
      console.error("Failed to delete fund transfer:", err)
      alert("削除に失敗しました")
    }
  }

  if (!selectedCompany) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">資金移動</h1>
          <p className="text-muted-foreground">会社を選択してください</p>
        </div>
        <CompanySwitcher />
      </div>
    )
  }

  const sourceAccounts = accounts.filter(a => !a.isVirtual)
  const destinationAccounts = (isInterCompany && counterCompanyId ? allAccounts : accounts).filter(a => !a.isVirtual)
  const otherCompanies = companies.filter(c => c.id !== selectedCompany.id)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">資金移動</h1>
          <p className="text-muted-foreground">口座間の資金移動を管理します</p>
        </div>
        <CompanySwitcher />
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm() }}>
          <DialogTrigger asChild>
            <Button>新規資金移動</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>資金移動</DialogTitle>
              <DialogDescription>口座間の資金移動を登録します</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>グループ会社間振替</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={isInterCompany}
                    onChange={(e) => {
                      setIsInterCompany(e.target.checked)
                      if (!e.target.checked) {
                        setCounterCompanyId("")
                        setToAccountId("")
                      }
                    }}
                    className="h-4 w-4"
                  />
                  <span className="text-sm">他社口座への振替</span>
                </div>
              </div>
              {isInterCompany && (
                <div className="grid gap-2">
                  <Label htmlFor="counterCompany">振替先会社</Label>
                  <Select value={counterCompanyId} onValueChange={(v) => { setCounterCompanyId(v); setToAccountId("") }}>
                    <SelectTrigger>
                      <SelectValue placeholder="会社を選択" />
                    </SelectTrigger>
                    <SelectContent>
                      {otherCompanies.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.shortName || c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="grid gap-2">
                <Label htmlFor="fromAccount">移動元口座</Label>
                <Select value={fromAccountId} onValueChange={setFromAccountId}>
                  <SelectTrigger>
                    <SelectValue placeholder="口座を選択" />
                  </SelectTrigger>
                  <SelectContent>
                    {sourceAccounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {formatAccountName(a)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="toAccount">移動先口座</Label>
                <Select value={toAccountId} onValueChange={setToAccountId}>
                  <SelectTrigger>
                    <SelectValue placeholder="口座を選択" />
                  </SelectTrigger>
                  <SelectContent>
                    {destinationAccounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.company ? `[${a.company.shortName || a.company.name}] ` : ""}{formatAccountName(a)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="transferDate">移動日</Label>
                  <Input
                    id="transferDate"
                    type="date"
                    value={transferDate}
                    onChange={(e) => setTransferDate(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="accountingMonth">計上月</Label>
                  <Input
                    id="accountingMonth"
                    type="month"
                    value={accountingMonth}
                    onChange={(e) => setAccountingMonth(e.target.value)}
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="amount">金額</Label>
                <Input
                  id="amount"
                  type="number"
                  placeholder="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  min="1"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="summary">摘要</Label>
                <Input
                  id="summary"
                  placeholder="資金移動の摘要（任意）"
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm() }}>キャンセル</Button>
              <Button
                onClick={handleSubmit}
                disabled={submitting || !fromAccountId || !toAccountId || !amount || (isInterCompany && !counterCompanyId)}
              >
                {submitting ? "登録中..." : "登録"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>資金移動一覧</CardTitle>
              <CardDescription>{selectedCompany.shortName || selectedCompany.name}の資金移動</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="filterMonth" className="text-sm">月:</Label>
              <Input
                id="filterMonth"
                type="month"
                value={filterMonth}
                onChange={(e) => setFilterMonth(e.target.value)}
                className="w-40"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">読み込み中...</div>
          ) : transfers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">資金移動データがありません</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>移動日</TableHead>
                  <TableHead>移動元</TableHead>
                  <TableHead>移動先</TableHead>
                  <TableHead className="text-right">金額</TableHead>
                  <TableHead>摘要</TableHead>
                  <TableHead>種別</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transfers.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>{formatDate(t.transactionDate)}</TableCell>
                    <TableCell>
                      {t.fundTransfer ? formatAccountName(t.fundTransfer.fromAccount) : "-"}
                    </TableCell>
                    <TableCell>
                      {t.fundTransfer ? formatAccountName(t.fundTransfer.toAccount) : "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      {t.fundTransfer ? formatYen(Number(t.fundTransfer.amount)) : formatYen(Math.abs(Number(t.amount)))}
                    </TableCell>
                    <TableCell>{t.summary || "-"}</TableCell>
                    <TableCell>
                      {t.fundTransfer?.counterCompanyId ? (
                        <Badge variant="secondary">会社間</Badge>
                      ) : (
                        <Badge variant="outline">社内</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(t.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        削除
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
