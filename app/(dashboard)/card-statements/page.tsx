"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useCompany } from "@/contexts/company-context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Plus, Pencil, Trash2, Upload, FileSpreadsheet, Send } from "lucide-react"
import { formatYen, formatDate, getCurrentMonth, parseYen } from "@/lib/format"
import {
  getCreditCards,
  createCreditCard,
  updateCreditCard,
  deleteCreditCard,
  getCardStatements,
  updateCardStatement,
  deleteCardStatement,
  importCardStatements,
  postCardStatementsToTransaction,
  type CardImportRow,
  type CardImportResult,
} from "@/app/actions/card-statements"
import { getAccounts } from "@/app/actions/accounts"

type CreditCardRow = Awaited<ReturnType<typeof getCreditCards>>[number]
type StatementRow = Awaited<ReturnType<typeof getCardStatements>>[number]
type AccountRow = Awaited<ReturnType<typeof getAccounts>>[number]

const EXPECTED_HEADERS = ["利用日", "利用店名", "金額"]

const initialCardForm = {
  cardName: "",
  cardBrand: "",
  cardLast4: "",
  holderName: "",
  paymentAccountId: "",
  closingDay: "",
  paymentDay: "",
  notes: "",
}

export default function CardStatementsPage() {
  const { selectedCompany } = useCompany()
  const [cards, setCards] = useState<CreditCardRow[]>([])
  const [statements, setStatements] = useState<StatementRow[]>([])
  const [accounts, setAccounts] = useState<AccountRow[]>([])
  const [loading, setLoading] = useState(true)

  const [cardFilter, setCardFilter] = useState<string>("ALL")
  const [monthFilter, setMonthFilter] = useState<string>(getCurrentMonth())

  // カードマスタ
  const [cardDialogOpen, setCardDialogOpen] = useState(false)
  const [editingCard, setEditingCard] = useState<CreditCardRow | null>(null)
  const [cardForm, setCardForm] = useState(initialCardForm)
  const [cardSaving, setCardSaving] = useState(false)

  // インポート
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [importCardId, setImportCardId] = useState("")
  const [importMonth, setImportMonth] = useState(getCurrentMonth())
  const [importRows, setImportRows] = useState<CardImportRow[]>([])
  const [importSource, setImportSource] = useState("")
  const [importError, setImportError] = useState("")
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<CardImportResult | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 取引転記
  const [postDialogOpen, setPostDialogOpen] = useState(false)
  const [postCardId, setPostCardId] = useState("")
  const [postScheduledDate, setPostScheduledDate] = useState("")
  const [posting, setPosting] = useState(false)

  // 明細編集
  const [stmtDialogOpen, setStmtDialogOpen] = useState(false)
  const [editingStmt, setEditingStmt] = useState<StatementRow | null>(null)
  const [stmtForm, setStmtForm] = useState({
    storeName: "",
    amount: "",
    category: "",
    summary: "",
  })
  const [stmtSaving, setStmtSaving] = useState(false)

  const load = useCallback(async () => {
    if (!selectedCompany) return
    setLoading(true)
    try {
      const [c, s, a] = await Promise.all([
        getCreditCards(selectedCompany.id),
        getCardStatements({
          companyId: selectedCompany.id,
          cardId: cardFilter === "ALL" ? undefined : cardFilter,
          statementMonth: monthFilter || undefined,
        }),
        getAccounts(selectedCompany.id),
      ])
      setCards(c)
      setStatements(s)
      setAccounts(a)
    } finally {
      setLoading(false)
    }
  }, [selectedCompany, cardFilter, monthFilter])

  useEffect(() => {
    load()
  }, [load])

  // ============= カードマスタ =============

  const openCreateCard = () => {
    setEditingCard(null)
    setCardForm(initialCardForm)
    setCardDialogOpen(true)
  }

  const openEditCard = (c: CreditCardRow) => {
    setEditingCard(c)
    setCardForm({
      cardName: c.cardName,
      cardBrand: c.cardBrand ?? "",
      cardLast4: c.cardLast4 ?? "",
      holderName: c.holderName ?? "",
      paymentAccountId: c.paymentAccountId ?? "",
      closingDay: c.closingDay?.toString() ?? "",
      paymentDay: c.paymentDay?.toString() ?? "",
      notes: c.notes ?? "",
    })
    setCardDialogOpen(true)
  }

  const handleSaveCard = async () => {
    if (!selectedCompany) return
    if (!cardForm.cardName.trim()) {
      alert("カード名は必須です")
      return
    }
    setCardSaving(true)
    try {
      if (editingCard) {
        await updateCreditCard(editingCard.id, {
          cardName: cardForm.cardName,
          cardBrand: cardForm.cardBrand || null,
          cardLast4: cardForm.cardLast4 || null,
          holderName: cardForm.holderName || null,
          paymentAccountId: cardForm.paymentAccountId || null,
          closingDay: cardForm.closingDay ? parseInt(cardForm.closingDay) : null,
          paymentDay: cardForm.paymentDay ? parseInt(cardForm.paymentDay) : null,
          notes: cardForm.notes || null,
        })
      } else {
        await createCreditCard({
          companyId: selectedCompany.id,
          cardName: cardForm.cardName,
          cardBrand: cardForm.cardBrand || undefined,
          cardLast4: cardForm.cardLast4 || undefined,
          holderName: cardForm.holderName || undefined,
          paymentAccountId: cardForm.paymentAccountId || undefined,
          closingDay: cardForm.closingDay ? parseInt(cardForm.closingDay) : undefined,
          paymentDay: cardForm.paymentDay ? parseInt(cardForm.paymentDay) : undefined,
          notes: cardForm.notes || undefined,
        })
      }
      setCardDialogOpen(false)
      await load()
    } catch (e) {
      alert(e instanceof Error ? e.message : "保存に失敗しました")
    } finally {
      setCardSaving(false)
    }
  }

  const handleDeleteCard = async (c: CreditCardRow) => {
    if (!confirm(`カード「${c.cardName}」を削除しますか？`)) return
    try {
      await deleteCreditCard(c.id)
      await load()
    } catch (e) {
      alert(e instanceof Error ? e.message : "削除に失敗しました")
    }
  }

  // ============= 明細インポート =============

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImportError("")
    setImportRows([])
    setImportResult(null)
    setImportSource(file.name)

    try {
      const XLSX = await import("xlsx")
      const buffer = await file.arrayBuffer()
      const wb = XLSX.read(buffer, { type: "array", cellDates: true })
      const sheet = wb.Sheets[wb.SheetNames[0]]
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { raw: false })

      if (json.length === 0) {
        setImportError("データが見つかりません")
        return
      }
      const headers = Object.keys(json[0])
      const missing = EXPECTED_HEADERS.filter((h) => !headers.includes(h))
      if (missing.length > 0) {
        setImportError(`必要な列が不足しています: ${missing.join(", ")}（${EXPECTED_HEADERS.join("/")} 列が必要）`)
        return
      }

      const rows: CardImportRow[] = json.map((r) => {
        const dateRaw = r["利用日"]
        let dateStr = ""
        if (dateRaw instanceof Date) {
          dateStr = dateRaw.toISOString().slice(0, 10)
        } else {
          const s = String(dateRaw || "").trim()
          // 2024/01/15 や 2024-01-15 を正規化
          const parsed = new Date(s.replace(/\//g, "-"))
          dateStr = isNaN(parsed.getTime()) ? "" : parsed.toISOString().slice(0, 10)
        }
        const amountRaw = String(r["金額"] || "0").replace(/[,¥\s]/g, "")
        return {
          statementDate: dateStr,
          storeName: String(r["利用店名"] || "").trim(),
          amount: parseInt(amountRaw) || 0,
          category: r["カテゴリ"] ? String(r["カテゴリ"]) : undefined,
          summary: r["摘要"] ? String(r["摘要"]) : undefined,
        }
      })

      setImportRows(rows)
    } catch (e) {
      setImportError(e instanceof Error ? e.message : "ファイルの読み込みに失敗しました")
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const handleImport = async () => {
    if (!selectedCompany) return
    if (!importCardId) {
      alert("カードを選択してください")
      return
    }
    setImporting(true)
    try {
      const res = await importCardStatements({
        companyId: selectedCompany.id,
        cardId: importCardId,
        statementMonth: importMonth,
        sourceName: importSource,
        rows: importRows,
      })
      setImportResult(res)
      await load()
    } catch (e) {
      alert(e instanceof Error ? e.message : "インポートに失敗しました")
    } finally {
      setImporting(false)
    }
  }

  // ============= 明細編集 =============

  const openEditStmt = (s: StatementRow) => {
    setEditingStmt(s)
    setStmtForm({
      storeName: s.storeName,
      amount: s.amount,
      category: s.category ?? "",
      summary: s.summary ?? "",
    })
    setStmtDialogOpen(true)
  }

  const handleSaveStmt = async () => {
    if (!editingStmt) return
    setStmtSaving(true)
    try {
      await updateCardStatement(editingStmt.id, {
        storeName: stmtForm.storeName,
        amount: parseYen(stmtForm.amount).toString(),
        category: stmtForm.category || null,
        summary: stmtForm.summary || null,
      })
      setStmtDialogOpen(false)
      await load()
    } catch (e) {
      alert(e instanceof Error ? e.message : "保存に失敗しました")
    } finally {
      setStmtSaving(false)
    }
  }

  const handleDeleteStmt = async (s: StatementRow) => {
    if (!confirm(`「${s.storeName}」（${formatYen(BigInt(s.amount))}）を削除しますか？`)) return
    try {
      await deleteCardStatement(s.id)
      await load()
    } catch (e) {
      alert(e instanceof Error ? e.message : "削除に失敗しました")
    }
  }

  // ============= 取引転記 =============

  const handlePost = async () => {
    if (!selectedCompany || !postCardId) return
    if (!postScheduledDate) {
      alert("引落予定日を入力してください")
      return
    }
    setPosting(true)
    try {
      const res = await postCardStatementsToTransaction({
        companyId: selectedCompany.id,
        cardId: postCardId,
        statementMonth: monthFilter,
        scheduledDate: postScheduledDate,
      })
      alert(`取引を作成しました（${res.count}件、合計 ${formatYen(BigInt(res.total))}）`)
      setPostDialogOpen(false)
      await load()
    } catch (e) {
      alert(e instanceof Error ? e.message : "転記に失敗しました")
    } finally {
      setPosting(false)
    }
  }

  if (!selectedCompany) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">会社を選択してください</p>
      </div>
    )
  }

  const totalAmount = statements.reduce((sum, s) => sum + BigInt(s.amount), BigInt(0))
  const unpostedCount = statements.filter((s) => !s.isPosted).length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">カード明細</h1>
          <p className="text-muted-foreground">
            クレジットカード利用明細を取り込み、引落取引へ転記します（PDF P9）
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setImportDialogOpen(true)}>
            <Upload className="h-4 w-4 mr-1" />
            Excel取込
          </Button>
          <Button variant="outline" onClick={openCreateCard}>
            <Plus className="h-4 w-4 mr-1" />
            カード追加
          </Button>
        </div>
      </div>

      {/* カードマスタ */}
      <Card>
        <CardHeader>
          <CardTitle>登録カード</CardTitle>
        </CardHeader>
        <CardContent>
          {cards.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              カードが未登録です。「カード追加」から登録してください。
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>カード名</TableHead>
                  <TableHead>ブランド</TableHead>
                  <TableHead>末尾</TableHead>
                  <TableHead>名義人</TableHead>
                  <TableHead>引落口座</TableHead>
                  <TableHead>締/支払</TableHead>
                  <TableHead>状態</TableHead>
                  <TableHead className="text-right w-28">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cards.map((c) => {
                  const acct = accounts.find((a) => a.id === c.paymentAccountId)
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.cardName}</TableCell>
                      <TableCell>{c.cardBrand ?? "—"}</TableCell>
                      <TableCell className="font-mono">{c.cardLast4 ?? "—"}</TableCell>
                      <TableCell>{c.holderName ?? "—"}</TableCell>
                      <TableCell className="text-sm">
                        {acct ? `${acct.bankName ?? ""} ${acct.accountNumber ?? ""}` : "—"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {c.closingDay ? `${c.closingDay}日締` : "—"} / {c.paymentDay ? `${c.paymentDay}日払` : "—"}
                      </TableCell>
                      <TableCell>
                        {c.isActive ? <Badge>有効</Badge> : <Badge variant="secondary">無効</Badge>}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEditCard(c)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDeleteCard(c)}>
                            <Trash2 className="h-4 w-4 text-red-600" />
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

      {/* 明細一覧 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
          <CardTitle>利用明細</CardTitle>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Label className="text-sm whitespace-nowrap">カード</Label>
              <Select value={cardFilter} onValueChange={setCardFilter}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">すべて</SelectItem>
                  {cards.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.cardName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-sm whitespace-nowrap">引落月</Label>
              <Input
                type="month"
                value={monthFilter}
                onChange={(e) => setMonthFilter(e.target.value)}
                className="w-36"
              />
            </div>
            {cardFilter !== "ALL" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setPostCardId(cardFilter)
                  setPostScheduledDate("")
                  setPostDialogOpen(true)
                }}
              >
                <Send className="h-4 w-4 mr-1" />
                取引へ転記
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div className="rounded border p-3">
              <div className="text-xs text-muted-foreground">利用合計</div>
              <div className="text-lg font-semibold mt-1">{formatYen(totalAmount)}</div>
            </div>
            <div className="rounded border p-3">
              <div className="text-xs text-muted-foreground">件数</div>
              <div className="text-lg font-semibold mt-1">{statements.length}</div>
            </div>
            <div className="rounded border p-3">
              <div className="text-xs text-muted-foreground">未転記</div>
              <div className="text-lg font-semibold mt-1 text-orange-600">{unpostedCount}</div>
            </div>
          </div>

          {loading ? (
            <p className="text-muted-foreground text-center py-8">読み込み中...</p>
          ) : statements.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              明細がありません。「Excel取込」から取り込んでください。
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>利用日</TableHead>
                  <TableHead>カード</TableHead>
                  <TableHead>利用店名</TableHead>
                  <TableHead>カテゴリ</TableHead>
                  <TableHead className="text-right">金額</TableHead>
                  <TableHead>摘要</TableHead>
                  <TableHead className="w-24">転記</TableHead>
                  <TableHead className="text-right w-28">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {statements.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono text-sm">{formatDate(s.statementDate)}</TableCell>
                    <TableCell className="text-sm">{s.card.cardName}</TableCell>
                    <TableCell>{s.storeName}</TableCell>
                    <TableCell className="text-sm">{s.category ?? "—"}</TableCell>
                    <TableCell className="text-right font-mono">
                      {formatYen(BigInt(s.amount))}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                      {s.summary ?? "—"}
                    </TableCell>
                    <TableCell>
                      {s.isPosted ? (
                        <Badge variant="secondary">転記済</Badge>
                      ) : (
                        <Badge>未転記</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEditStmt(s)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteStmt(s)}
                          disabled={s.isPosted}
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
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

      {/* カードマスタ ダイアログ */}
      <Dialog open={cardDialogOpen} onOpenChange={setCardDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCard ? "カードを編集" : "カードを追加"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label>カード名 *</Label>
              <Input
                value={cardForm.cardName}
                onChange={(e) => setCardForm((p) => ({ ...p, cardName: e.target.value }))}
                placeholder="例: 法人VISA"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>ブランド</Label>
                <Select
                  value={cardForm.cardBrand || "NONE"}
                  onValueChange={(v) =>
                    setCardForm((p) => ({ ...p, cardBrand: v === "NONE" ? "" : v }))
                  }
                >
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">—</SelectItem>
                    <SelectItem value="VISA">VISA</SelectItem>
                    <SelectItem value="JCB">JCB</SelectItem>
                    <SelectItem value="MASTER">MASTER</SelectItem>
                    <SelectItem value="AMEX">AMEX</SelectItem>
                    <SelectItem value="DINERS">DINERS</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>末尾4桁</Label>
                <Input
                  value={cardForm.cardLast4}
                  maxLength={4}
                  onChange={(e) => setCardForm((p) => ({ ...p, cardLast4: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>名義人</Label>
              <Input
                value={cardForm.holderName}
                onChange={(e) => setCardForm((p) => ({ ...p, holderName: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>引落口座</Label>
              <Select
                value={cardForm.paymentAccountId || "NONE"}
                onValueChange={(v) =>
                  setCardForm((p) => ({ ...p, paymentAccountId: v === "NONE" ? "" : v }))
                }
              >
                <SelectTrigger><SelectValue placeholder="未設定" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">未設定</SelectItem>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.bankName ?? ""} {a.branchName ?? ""} {a.accountNumber ?? ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>締日</Label>
                <Input
                  type="number"
                  value={cardForm.closingDay}
                  min={1}
                  max={31}
                  onChange={(e) => setCardForm((p) => ({ ...p, closingDay: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>支払日</Label>
                <Input
                  type="number"
                  value={cardForm.paymentDay}
                  min={1}
                  max={31}
                  onChange={(e) => setCardForm((p) => ({ ...p, paymentDay: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>備考</Label>
              <Input
                value={cardForm.notes}
                onChange={(e) => setCardForm((p) => ({ ...p, notes: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCardDialogOpen(false)}>キャンセル</Button>
            <Button onClick={handleSaveCard} disabled={cardSaving}>
              {cardSaving ? "保存中..." : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* インポート ダイアログ */}
      <Dialog
        open={importDialogOpen}
        onOpenChange={(o) => {
          setImportDialogOpen(o)
          if (!o) {
            setImportRows([])
            setImportError("")
            setImportResult(null)
            setImportSource("")
          }
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>カード明細を取り込む</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="text-sm text-muted-foreground">
              Excel/CSV 列: <code className="bg-muted px-1 rounded">{EXPECTED_HEADERS.join(" / ")}</code>
              （任意: カテゴリ / 摘要）
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>カード *</Label>
                <Select value={importCardId} onValueChange={setImportCardId}>
                  <SelectTrigger><SelectValue placeholder="カードを選択" /></SelectTrigger>
                  <SelectContent>
                    {cards.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.cardName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>引落月</Label>
                <Input
                  type="month"
                  value={importMonth}
                  onChange={(e) => setImportMonth(e.target.value)}
                />
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={handleFileSelect}
            />
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={!importCardId}
            >
              <FileSpreadsheet className="h-4 w-4 mr-1" />
              ファイルを選択
            </Button>
            {importSource && (
              <div className="text-xs text-muted-foreground">選択中: {importSource}</div>
            )}
            {importError && (
              <div className="rounded border border-red-300 bg-red-50 text-red-800 p-2 text-sm">
                {importError}
              </div>
            )}
            {importRows.length > 0 && (
              <div className="max-h-72 overflow-auto border rounded">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>利用日</TableHead>
                      <TableHead>利用店名</TableHead>
                      <TableHead className="text-right">金額</TableHead>
                      <TableHead>カテゴリ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {importRows.map((r, i) => (
                      <TableRow key={i}>
                        <TableCell>{r.statementDate}</TableCell>
                        <TableCell>{r.storeName}</TableCell>
                        <TableCell className="text-right font-mono">
                          {formatYen(BigInt(r.amount || 0))}
                        </TableCell>
                        <TableCell>{r.category ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            {importResult && (
              <div className="rounded border bg-muted/30 p-3 text-sm space-y-1">
                <div>取込件数: {importResult.total}</div>
                <div>新規登録: {importResult.created}</div>
                <div>重複スキップ: {importResult.skipped}</div>
                {importResult.errors.length > 0 && (
                  <div className="text-red-700">
                    エラー {importResult.errors.length}件:
                    <ul className="list-disc ml-5">
                      {importResult.errors.slice(0, 5).map((e, i) => (
                        <li key={i}>{e}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportDialogOpen(false)}>閉じる</Button>
            <Button
              onClick={handleImport}
              disabled={importing || importRows.length === 0 || !importCardId}
            >
              {importing ? "取込中..." : `${importRows.length}件を取り込む`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 明細編集ダイアログ */}
      <Dialog open={stmtDialogOpen} onOpenChange={setStmtDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>明細を編集</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label>利用店名</Label>
              <Input
                value={stmtForm.storeName}
                onChange={(e) => setStmtForm((p) => ({ ...p, storeName: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>金額</Label>
              <Input
                value={stmtForm.amount}
                onChange={(e) => setStmtForm((p) => ({ ...p, amount: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>カテゴリ</Label>
              <Input
                value={stmtForm.category}
                onChange={(e) => setStmtForm((p) => ({ ...p, category: e.target.value }))}
                placeholder="交際費 / 消耗品 等"
              />
            </div>
            <div className="space-y-2">
              <Label>摘要</Label>
              <Input
                value={stmtForm.summary}
                onChange={(e) => setStmtForm((p) => ({ ...p, summary: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStmtDialogOpen(false)}>キャンセル</Button>
            <Button onClick={handleSaveStmt} disabled={stmtSaving}>
              {stmtSaving ? "保存中..." : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 取引転記ダイアログ */}
      <Dialog open={postDialogOpen} onOpenChange={setPostDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>引落取引へ転記</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="text-sm text-muted-foreground">
              選択中のカード「{cards.find((c) => c.id === postCardId)?.cardName ?? ""}」の
              {monthFilter} 未転記明細を1件の引落取引にまとめます。
            </div>
            <div className="space-y-2">
              <Label>引落予定日</Label>
              <Input
                type="date"
                value={postScheduledDate}
                onChange={(e) => setPostScheduledDate(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPostDialogOpen(false)}>キャンセル</Button>
            <Button onClick={handlePost} disabled={posting}>
              {posting ? "転記中..." : "転記する"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
