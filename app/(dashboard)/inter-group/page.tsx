"use client"

import { useEffect, useState, useCallback } from "react"
import { useCompany } from "@/contexts/company-context"
import { CompanySwitcher } from "@/components/company-switcher"
import {
  getInterGroupTransactions,
  createInterGroupTransaction,
  createInterGroupSale,
  createInterGroupExpense,
  updateInterGroupTransaction,
  deleteInterGroupTransaction,
  getGroupCompaniesFor,
  copyPreviousMonthInterGroup,
  type InterGroupCategory,
} from "@/app/actions/inter-group"
import { getAccounts } from "@/app/actions/accounts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Plus, Pencil, Trash2, ArrowRight, Copy } from "lucide-react"
import { formatYen } from "@/lib/format"

type TransferRow = {
  id: string
  companyId: string
  accountId: string
  amount: string
  transactionDate: string | null
  accountingMonth: string
  summary: string | null
  classification: string | null
  linkedTransactionId: string | null
  company: { id: string; name: string; shortName: string | null }
  account: { id: string; bankName: string | null; branchName: string | null }
  fundTransfer: {
    fromAccount: { id: string; bankName: string | null; branchName: string | null } | null
    toAccount: { id: string; bankName: string | null; branchName: string | null } | null
    counterCompanyId: string | null
  } | null
  counterCompany: { id: string; name: string; shortName: string | null } | null
  counterAccount: { id: string; bankName: string | null; branchName: string | null } | null
}
type PeerCompany = Awaited<ReturnType<typeof getGroupCompaniesFor>>[number]
type AccountRow = Awaited<ReturnType<typeof getAccounts>>[number]

function currentMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

const initialForm = {
  receiverCompanyId: "",
  payerAccountId: "",
  receiverAccountId: "",
  transactionDate: "",
  accountingMonth: currentMonth(),
  amount: "",
  summary: "",
  classification: "",
}

const CATEGORY_META: Record<
  InterGroupCategory,
  { label: string; helper: string; tint: string }
> = {
  sale: {
    label: "売上 / 原価",
    helper: "支払会社で入力 → 受取会社へ売上として自動反映",
    tint: "bg-emerald-50 dark:bg-emerald-950/30",
  },
  expense: {
    label: "経費",
    helper: "支払会社で入力 → 受取会社へ収益として自動反映 (固定/変動/臨時 区分対応)",
    tint: "bg-amber-50 dark:bg-amber-950/30",
  },
  lending: {
    label: "貸借",
    helper: "資金移動。グループ間貸借として単独集計され、資金繰表ではグループ借入で+−表現",
    tint: "bg-violet-50 dark:bg-violet-950/30",
  },
}

export default function InterGroupPage() {
  const { selectedCompany, loading: companyLoading } = useCompany()
  const [category, setCategory] = useState<InterGroupCategory>("sale")
  const [rows, setRows] = useState<TransferRow[]>([])
  const [peers, setPeers] = useState<PeerCompany[]>([])
  const [payerAccounts, setPayerAccounts] = useState<AccountRow[]>([])
  const [receiverAccounts, setReceiverAccounts] = useState<AccountRow[]>([])
  const [month, setMonth] = useState<string>(currentMonth())
  const [loading, setLoading] = useState(false)
  const [copying, setCopying] = useState(false)
  const [copyMsg, setCopyMsg] = useState<string | null>(null)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<TransferRow | null>(null)
  const [form, setForm] = useState(initialForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!selectedCompany) return
    setLoading(true)
    try {
      const [data, peerList, accs] = await Promise.all([
        getInterGroupTransactions({
          companyId: selectedCompany.id,
          accountingMonth: month,
          category,
        }),
        getGroupCompaniesFor(selectedCompany.id),
        getAccounts(selectedCompany.id),
      ])
      setRows(data as TransferRow[])
      setPeers(peerList)
      setPayerAccounts(accs)
    } finally {
      setLoading(false)
    }
  }, [selectedCompany, month, category])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    async function loadReceiver() {
      if (!form.receiverCompanyId) {
        setReceiverAccounts([])
        return
      }
      const accs = await getAccounts(form.receiverCompanyId)
      setReceiverAccounts(accs)
    }
    loadReceiver()
  }, [form.receiverCompanyId])

  const openCreate = () => {
    setEditing(null)
    setForm({
      ...initialForm,
      accountingMonth: month,
      transactionDate: new Date().toISOString().slice(0, 10),
    })
    setError(null)
    setDialogOpen(true)
  }

  const openEdit = (r: TransferRow) => {
    setEditing(r)
    setForm({
      receiverCompanyId: r.counterCompany?.id ?? "",
      payerAccountId: r.accountId,
      receiverAccountId: r.counterAccount?.id ?? "",
      transactionDate: r.transactionDate
        ? new Date(r.transactionDate).toISOString().slice(0, 10)
        : "",
      accountingMonth: r.accountingMonth,
      amount: String(-BigInt(r.amount as unknown as string)),
      summary: r.summary ?? "",
      classification: r.classification ?? "",
    })
    setError(null)
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!selectedCompany) return
    setError(null)
    setSaving(true)
    try {
      if (editing) {
        await updateInterGroupTransaction(editing.id, {
          transactionDate: form.transactionDate,
          accountingMonth: form.accountingMonth,
          amount: form.amount,
          summary: form.summary || undefined,
          classification: form.classification || undefined,
        })
      } else {
        if (!form.receiverCompanyId) throw new Error("受取会社を選択してください")
        if (!form.payerAccountId) throw new Error("支払口座を選択してください")
        if (!form.receiverAccountId) throw new Error("受取口座を選択してください")
        if (!form.amount) throw new Error("金額を入力してください")
        const payload = {
          payerCompanyId: selectedCompany.id,
          payerAccountId: form.payerAccountId,
          receiverCompanyId: form.receiverCompanyId,
          receiverAccountId: form.receiverAccountId,
          transactionDate: form.transactionDate,
          accountingMonth: form.accountingMonth,
          amount: form.amount,
          summary: form.summary || undefined,
          classification: form.classification || undefined,
        }
        if (category === "sale") await createInterGroupSale(payload)
        else if (category === "expense") await createInterGroupExpense(payload)
        else await createInterGroupTransaction(payload)
      }
      setDialogOpen(false)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (r: TransferRow) => {
    if (!confirm("この取引と相手側ミラー取引を削除します。よろしいですか？")) return
    await deleteInterGroupTransaction(r.id)
    await load()
  }

  const handleCopyPrev = async () => {
    if (!selectedCompany) return
    setCopying(true)
    setCopyMsg(null)
    try {
      const res = await copyPreviousMonthInterGroup({
        companyId: selectedCompany.id,
        category,
        targetMonth: month,
      })
      setCopyMsg(
        res.copied > 0
          ? `前月(${res.prevMonth})から ${res.copied} 件を当月にコピーしました`
          : `前月(${res.prevMonth})にコピー対象データはありません`
      )
      await load()
    } catch (e) {
      setCopyMsg(e instanceof Error ? e.message : String(e))
    } finally {
      setCopying(false)
    }
  }

  if (companyLoading) return <div className="p-6">読み込み中...</div>
  if (!selectedCompany) return <div className="p-6">会社を選択してください</div>

  const meta = CATEGORY_META[category]
  const totalAmount = rows.reduce((acc, r) => acc + -BigInt(r.amount as unknown as string), BigInt(0))

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">グループ間入力</h1>
          <p className="text-sm text-muted-foreground">{meta.helper}</p>
        </div>
        <CompanySwitcher />
        <div className="flex items-center gap-2">
          <Input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="w-36"
          />
          <Button
            variant="outline"
            onClick={handleCopyPrev}
            disabled={copying || peers.length === 0}
            title="前月分の同カテゴリ取引を当月にコピー（経費の固定/変動/臨時もそのまま）"
          >
            <Copy className="w-4 h-4 mr-1" />
            前月コピー
          </Button>
          <Button onClick={openCreate} disabled={peers.length === 0}>
            <Plus className="w-4 h-4 mr-1" />
            新規
          </Button>
        </div>
      </div>

      {copyMsg && (
        <div className="text-sm bg-blue-50 dark:bg-blue-950/30 text-blue-800 dark:text-blue-200 p-2 rounded border border-blue-200 dark:border-blue-800">
          {copyMsg}
        </div>
      )}

      {peers.length === 0 && (
        <Card>
          <CardContent className="p-4 text-sm text-muted-foreground">
            この会社は会社グループに所属していないか、同じグループに他の会社がいません。
            「マスタ → 会社グループ」でグループを設定してください。
          </CardContent>
        </Card>
      )}

      <Tabs value={category} onValueChange={(v) => setCategory(v as InterGroupCategory)}>
        <TabsList>
          <TabsTrigger value="sale">{CATEGORY_META.sale.label}</TabsTrigger>
          <TabsTrigger value="expense">{CATEGORY_META.expense.label}</TabsTrigger>
          <TabsTrigger value="lending">{CATEGORY_META.lending.label}</TabsTrigger>
        </TabsList>
        <TabsContent value={category}>
          <Card className={meta.tint}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>
                  {selectedCompany.name} の {meta.label} ({month})
                </span>
                <Badge variant="outline" className="text-sm font-mono">
                  合計 {formatYen(totalAmount)}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="p-4 text-center text-sm text-muted-foreground">読み込み中...</div>
              ) : rows.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  この月の{meta.label}グループ間取引はありません
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>実行日</TableHead>
                      <TableHead>支払会社</TableHead>
                      <TableHead></TableHead>
                      <TableHead>受取会社</TableHead>
                      <TableHead>支払口座</TableHead>
                      <TableHead>受取口座</TableHead>
                      <TableHead className="text-right">金額</TableHead>
                      {category === "expense" && <TableHead>区分</TableHead>}
                      <TableHead>摘要</TableHead>
                      <TableHead className="w-24"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r) => {
                      const absAmount = -BigInt(r.amount as unknown as string)
                      return (
                        <TableRow key={r.id}>
                          <TableCell>
                            {r.transactionDate
                              ? new Date(r.transactionDate).toLocaleDateString("ja-JP")
                              : "-"}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">
                              {r.company.shortName ?? r.company.name}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            <ArrowRight className="w-4 h-4" />
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {r.counterCompany?.shortName ??
                                r.counterCompany?.name ??
                                "-"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs">
                            {r.account.bankName ?? ""}
                            {r.account.branchName ?? ""}
                          </TableCell>
                          <TableCell className="text-xs">
                            {r.counterAccount?.bankName ?? ""}
                            {r.counterAccount?.branchName ?? ""}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {formatYen(absAmount)}
                          </TableCell>
                          {category === "expense" && (
                            <TableCell>
                              {r.classification === "FIXED" && (
                                <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300">
                                  固定
                                </Badge>
                              )}
                              {r.classification === "VARIABLE" && (
                                <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">
                                  変動
                                </Badge>
                              )}
                              {r.classification === "TEMPORARY" && (
                                <Badge variant="outline" className="bg-orange-100 text-orange-800 border-orange-300">
                                  臨時
                                </Badge>
                              )}
                              {!r.classification && <span className="text-muted-foreground">-</span>}
                            </TableCell>
                          )}
                          <TableCell className="text-sm">{r.summary ?? ""}</TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => openEdit(r)}
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDelete(r)}
                              >
                                <Trash2 className="w-3.5 h-3.5 text-destructive" />
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
        </TabsContent>
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editing ? `${meta.label}を編集` : `${meta.label}を追加`}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>支払会社</Label>
              <Input value={selectedCompany.name} disabled />
            </div>
            <div>
              <Label>受取会社</Label>
              <Select
                value={form.receiverCompanyId}
                onValueChange={(v) =>
                  setForm({ ...form, receiverCompanyId: v, receiverAccountId: "" })
                }
                disabled={!!editing}
              >
                <SelectTrigger>
                  <SelectValue placeholder="選択" />
                </SelectTrigger>
                <SelectContent>
                  {peers.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>支払口座</Label>
              <Select
                value={form.payerAccountId}
                onValueChange={(v) => setForm({ ...form, payerAccountId: v })}
                disabled={!!editing}
              >
                <SelectTrigger>
                  <SelectValue placeholder="選択" />
                </SelectTrigger>
                <SelectContent>
                  {payerAccounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.bankName ?? ""} {a.branchName ?? ""}{" "}
                      {a.accountNumber ?? ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>受取口座</Label>
              <Select
                value={form.receiverAccountId}
                onValueChange={(v) => setForm({ ...form, receiverAccountId: v })}
                disabled={!!editing}
              >
                <SelectTrigger>
                  <SelectValue placeholder="選択" />
                </SelectTrigger>
                <SelectContent>
                  {receiverAccounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.bankName ?? ""} {a.branchName ?? ""}{" "}
                      {a.accountNumber ?? ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>実行日</Label>
              <Input
                type="date"
                value={form.transactionDate}
                onChange={(e) =>
                  setForm({ ...form, transactionDate: e.target.value })
                }
              />
            </div>
            <div>
              <Label>計上月</Label>
              <Input
                type="month"
                value={form.accountingMonth}
                onChange={(e) =>
                  setForm({ ...form, accountingMonth: e.target.value })
                }
              />
            </div>
            <div>
              <Label>金額（円）</Label>
              <Input
                type="number"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
              />
            </div>
            <div>
              <Label>区分</Label>
              <Select
                value={form.classification || "_none"}
                onValueChange={(v) =>
                  setForm({ ...form, classification: v === "_none" ? "" : v })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="-" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">指定なし</SelectItem>
                  <SelectItem value="FIXED">固定</SelectItem>
                  <SelectItem value="VARIABLE">変動</SelectItem>
                  <SelectItem value="TEMPORARY">臨時</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>摘要</Label>
              <Input
                value={form.summary}
                onChange={(e) => setForm({ ...form, summary: e.target.value })}
              />
            </div>
          </div>
          {error && (
            <div className="text-sm text-destructive bg-destructive/10 p-2 rounded">
              {error}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              キャンセル
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "保存中..." : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
