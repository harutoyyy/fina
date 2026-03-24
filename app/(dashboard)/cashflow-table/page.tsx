"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useCompany } from "@/contexts/company-context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { getAccounts } from "@/app/actions/accounts"
import { Checkbox } from "@/components/ui/checkbox"
import {
  getCashFlowTable,
  getMonthCloseStatus,
  closeMonth,
  reopenMonth,
  deferTransaction,
  deferTransactionsBatch,
  reorderTransactions,
  type CashFlowTableData,
  type CashFlowRow,
} from "@/app/actions/cashflow-table"
import { formatYen, formatDate, getCurrentMonth } from "@/lib/format"
import { Printer, GripVertical, ChevronUp, ChevronDown } from "lucide-react"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

type AccountOption = {
  id: string
  bankName: string | null
  branchName: string | null
  accountNumber: string | null
  isActive: boolean
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "下書き",
  READY: "準備完了",
  CONFIRMED: "確定済",
  CANCELLED: "取消済",
}

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  DRAFT: "outline",
  READY: "secondary",
  CONFIRMED: "default",
  CANCELLED: "destructive",
}

const TYPE_LABELS: Record<string, string> = {
  EXPENSE: "経費",
  SALES: "売上",
  COST_PAYMENT: "原価支払",
  SALARY: "給与",
  LOAN: "借入",
  TRANSFER: "振替",
}

const CLASSIFICATION_LABELS: Record<string, string> = {
  FIXED: "固定",
  VARIABLE: "変動",
  TEMPORARY: "臨時",
}

function SortableRow({
  row,
  isClosed,
  selectedRows,
  toggleRowSelection,
  handleDeferSingle,
  deferLoading,
}: {
  row: CashFlowRow
  isClosed: boolean
  selectedRows: Set<string>
  toggleRowSelection: (id: string) => void
  handleDeferSingle: (id: string) => void
  deferLoading: boolean
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: row.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const deposit = Number(row.deposit)
  const withdrawal = Number(row.withdrawal)
  const detail = row.details[0]
  const categoryDisplay = detail
    ? [detail.midName, detail.subName].filter(Boolean).join(" / ")
    : "—"
  const canDefer = row.status !== "CONFIRMED"

  return (
    <TableRow ref={setNodeRef} style={style}>
      <TableCell className="w-8 cursor-grab" {...attributes} {...listeners}>
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </TableCell>
      {!isClosed && (
        <TableCell>
          <Checkbox
            checked={selectedRows.has(row.id)}
            onCheckedChange={() => toggleRowSelection(row.id)}
            disabled={!canDefer}
          />
        </TableCell>
      )}
      <TableCell className="whitespace-nowrap">
        {row.transactionDate ? formatDate(row.transactionDate) : "—"}
      </TableCell>
      <TableCell className="whitespace-nowrap">
        {row.scheduledDate ? formatDate(row.scheduledDate) : "—"}
      </TableCell>
      <TableCell>
        <Badge variant="outline">
          {TYPE_LABELS[row.type] || row.type}
        </Badge>
      </TableCell>
      <TableCell>
        {row.classification ? CLASSIFICATION_LABELS[row.classification] || row.classification : "—"}
      </TableCell>
      <TableCell>{row.partnerName || "—"}</TableCell>
      <TableCell className="text-right font-mono text-green-600">
        {deposit > 0 ? formatYen(deposit) : ""}
      </TableCell>
      <TableCell className="text-right font-mono text-red-600">
        {withdrawal < 0 ? formatYen(Math.abs(withdrawal)) : ""}
      </TableCell>
      <TableCell className="text-right font-mono font-medium">
        {formatYen(Number(row.runningBalance))}
      </TableCell>
      <TableCell className="max-w-[200px] truncate">{row.summary || "—"}</TableCell>
      <TableCell className="text-sm">{categoryDisplay}</TableCell>
      <TableCell className="text-right font-mono">
        {row.details.length > 1
          ? formatYen(
              row.details.reduce((sum, d) => sum + Number(d.amount), 0) - Number(row.amount)
            )
          : "—"}
      </TableCell>
      <TableCell>
        <Badge variant={STATUS_VARIANTS[row.status] || "outline"}>
          {STATUS_LABELS[row.status] || row.status}
        </Badge>
      </TableCell>
      <TableCell>
        {!isClosed && canDefer && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleDeferSingle(row.id)}
            disabled={deferLoading}
          >
            繰延
          </Button>
        )}
      </TableCell>
    </TableRow>
  )
}

export default function CashFlowTablePage() {
  const { selectedCompany } = useCompany()
  const [accounts, setAccounts] = useState<AccountOption[]>([])
  const [selectedAccountId, setSelectedAccountId] = useState<string>("")
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth())
  const [tableData, setTableData] = useState<CashFlowTableData | null>(null)
  const [loading, setLoading] = useState(false)
  const [monthCloseStatus, setMonthCloseStatus] = useState<{ isClosed: boolean; closedAt: string | null } | null>(null)

  const [filterPartner, setFilterPartner] = useState("")
  const [filterStatus, setFilterStatus] = useState("ALL")
  const [filterType, setFilterType] = useState("ALL")

  const [reopenDialogOpen, setReopenDialogOpen] = useState(false)
  const [reopenReason, setReopenReason] = useState("")
  const [actionLoading, setActionLoading] = useState(false)
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set())
  const [deferLoading, setDeferLoading] = useState(false)

  // 並べ替え時の日付設定ダイアログ
  const [reorderPending, setReorderPending] = useState<{
    reordered: CashFlowRow[]
    updates: { id: string; displayOrder: number }[]
    movedIds: string[]
    suggestedDate: string
  } | null>(null)
  const [reorderDate, setReorderDate] = useState("")
  const [reorderSaving, setReorderSaving] = useState(false)
  const [prevTableData, setPrevTableData] = useState<CashFlowTableData | null>(null)

  const loadAccounts = useCallback(async (companyId: string) => {
    const accts = await getAccounts(companyId)
    const activeAccounts = accts.filter((a) => a.isActive).map((a) => ({
      id: a.id,
      bankName: a.bankName,
      branchName: a.branchName,
      accountNumber: a.accountNumber,
      isActive: a.isActive,
    }))
    setAccounts(activeAccounts)
    if (activeAccounts.length > 0 && !selectedAccountId) {
      setSelectedAccountId(activeAccounts[0].id)
    }
  }, [selectedAccountId])

  const loadTableData = useCallback(async (companyId: string, accountId: string, yearMonth: string) => {
    if (!accountId || !yearMonth) return
    setLoading(true)
    try {
      const [data, closeStatus] = await Promise.all([
        getCashFlowTable(companyId, accountId, yearMonth),
        getMonthCloseStatus(companyId, yearMonth),
      ])
      setTableData(data)
      setMonthCloseStatus(closeStatus as { isClosed: boolean; closedAt: string | null } | null)
    } catch (e) {
      console.error("Failed to load cash flow table:", e)
      setTableData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (selectedCompany) {
      loadAccounts(selectedCompany.id)
    }
  }, [selectedCompany, loadAccounts])

  useEffect(() => {
    if (selectedCompany && selectedAccountId && selectedMonth) {
      loadTableData(selectedCompany.id, selectedAccountId, selectedMonth)
    }
  }, [selectedCompany, selectedAccountId, selectedMonth, loadTableData])

  const filteredRows = useMemo(() => {
    if (!tableData) return []
    return tableData.rows.filter((row) => {
      if (filterPartner && row.partnerName && !row.partnerName.includes(filterPartner)) return false
      if (filterPartner && !row.partnerName) return false
      if (filterStatus !== "ALL" && row.status !== filterStatus) return false
      if (filterType !== "ALL" && row.type !== filterType) return false
      return true
    })
  }, [tableData, filterPartner, filterStatus, filterType])

  const handleCloseMonth = async () => {
    if (!selectedCompany || !selectedMonth) return
    if (!confirm("この月を締めますか？締め後は取引の編集ができなくなります。")) return
    setActionLoading(true)
    try {
      await closeMonth(selectedCompany.id, selectedMonth)
      await loadTableData(selectedCompany.id, selectedAccountId, selectedMonth)
    } catch (e) {
      console.error("Failed to close month:", e)
      alert("月締めに失敗しました")
    } finally {
      setActionLoading(false)
    }
  }

  const handleReopenMonth = async () => {
    if (!selectedCompany || !selectedMonth || !reopenReason.trim()) return
    setActionLoading(true)
    try {
      await reopenMonth(selectedCompany.id, selectedMonth, reopenReason)
      setReopenDialogOpen(false)
      setReopenReason("")
      await loadTableData(selectedCompany.id, selectedAccountId, selectedMonth)
    } catch (e) {
      console.error("Failed to reopen month:", e)
      alert("月締め解除に失敗しました")
    } finally {
      setActionLoading(false)
    }
  }

  const toggleRowSelection = (id: string) => {
    setSelectedRows((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAllRows = () => {
    const deferableRows = filteredRows.filter(r => r.status !== "CONFIRMED")
    if (selectedRows.size === deferableRows.length) {
      setSelectedRows(new Set())
    } else {
      setSelectedRows(new Set(deferableRows.map(r => r.id)))
    }
  }

  const handleDeferSelected = async () => {
    if (!selectedCompany || selectedRows.size === 0) return
    if (!confirm(`${selectedRows.size}件の取引を翌月へ繰り延べますか？`)) return
    setDeferLoading(true)
    try {
      await deferTransactionsBatch(Array.from(selectedRows), selectedCompany.id)
      setSelectedRows(new Set())
      await loadTableData(selectedCompany.id, selectedAccountId, selectedMonth)
    } catch (e) {
      console.error("Failed to defer:", e)
      alert("繰り延べに失敗しました")
    } finally {
      setDeferLoading(false)
    }
  }

  const handleDeferSingle = async (transactionId: string) => {
    if (!selectedCompany) return
    if (!confirm("この取引を翌月へ繰り延べますか？")) return
    setDeferLoading(true)
    try {
      await deferTransaction(transactionId, selectedCompany.id)
      await loadTableData(selectedCompany.id, selectedAccountId, selectedMonth)
    } catch (e) {
      console.error("Failed to defer:", e)
      alert(e instanceof Error ? e.message : "繰り延べに失敗しました")
    } finally {
      setDeferLoading(false)
    }
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const getSuggestedDate = (rows: CashFlowRow[], targetIndex: number): string => {
    // 移動先の直上の行の日付を取得
    if (targetIndex > 0) {
      const above = rows[targetIndex - 1]
      const d = above.scheduledDate || above.transactionDate
      if (d) return d.slice(0, 10)
    }
    // 直上がない場合は当月の1日
    return `${selectedMonth}-01`
  }

  const applyOptimisticReorder = (reordered: CashFlowRow[]) => {
    if (!tableData) return
    setPrevTableData(tableData)
    const openBal = Number(tableData.openingBalance)
    let running = openBal
    const updatedRows = reordered.map((r) => {
      const amt = Number(r.amount)
      running += amt
      return { ...r, runningBalance: running.toString() }
    })
    setTableData((prev) =>
      prev ? { ...prev, rows: updatedRows } : prev
    )
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id || !selectedCompany || !tableData) return

    const oldIndex = filteredRows.findIndex((r) => r.id === active.id)
    const newIndex = filteredRows.findIndex((r) => r.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    const reordered = arrayMove(filteredRows, oldIndex, newIndex)
    const updates = reordered.map((r, i) => ({ id: r.id, displayOrder: i }))

    const suggested = getSuggestedDate(reordered, newIndex)
    setReorderDate(suggested)
    setReorderPending({
      reordered,
      updates,
      movedIds: [active.id as string],
      suggestedDate: suggested,
    })

    applyOptimisticReorder(reordered)
  }

  const handleConfirmReorder = async () => {
    if (!reorderPending || !selectedCompany) return
    setReorderSaving(true)
    try {
      const dateUpdates = reorderPending.movedIds.map((id) => ({
        transactionId: id,
        scheduledDate: reorderDate,
      }))
      await reorderTransactions(
        reorderPending.updates,
        selectedCompany.id,
        selectedAccountId,
        selectedMonth,
        dateUpdates
      )
      await loadTableData(selectedCompany.id, selectedAccountId, selectedMonth)
    } catch (e) {
      console.error("Failed to reorder:", e)
      if (prevTableData) setTableData(prevTableData)
    } finally {
      setReorderPending(null)
      setReorderDate("")
      setReorderSaving(false)
      setPrevTableData(null)
    }
  }

  const handleCancelReorder = () => {
    if (prevTableData) setTableData(prevTableData)
    setReorderPending(null)
    setReorderDate("")
    setPrevTableData(null)
  }

  const handleMoveSelected = (direction: "up" | "down") => {
    if (!tableData || !selectedCompany || selectedRows.size === 0) return

    const rows = [...filteredRows]
    const selectedIndices = rows
      .map((r, i) => (selectedRows.has(r.id) ? i : -1))
      .filter((i) => i !== -1)
      .sort((a, b) => a - b)

    if (selectedIndices.length === 0) return
    const first = selectedIndices[0]
    const last = selectedIndices[selectedIndices.length - 1]

    if (direction === "up" && first === 0) return
    if (direction === "down" && last === rows.length - 1) return

    // Move the block of selected rows
    let reordered: CashFlowRow[]
    if (direction === "up") {
      const target = first - 1
      const item = rows.splice(target, 1)[0]
      rows.splice(last, 0, item)
      reordered = rows
    } else {
      const target = last + 1
      const item = rows.splice(target, 1)[0]
      rows.splice(first, 0, item)
      reordered = rows
    }

    const updates = reordered.map((r, i) => ({ id: r.id, displayOrder: i }))
    const targetIndex = direction === "up" ? first - 1 : first + 1
    const suggested = getSuggestedDate(reordered, targetIndex)
    setReorderDate(suggested)
    setReorderPending({
      reordered,
      updates,
      movedIds: Array.from(selectedRows),
      suggestedDate: suggested,
    })

    applyOptimisticReorder(reordered)
  }

  const isClosed = monthCloseStatus?.isClosed === true

  if (!selectedCompany) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">資金繰り表</h1>
          <p className="text-muted-foreground">会社を選択してください</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">資金繰り表</h1>
          <p className="text-muted-foreground">{selectedCompany.name} の資金繰り表</p>
        </div>
        <div className="flex items-center gap-2">
          {!isClosed && selectedRows.size > 0 && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleMoveSelected("up")}
              >
                <ChevronUp className="h-4 w-4 mr-1" />
                上へ
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleMoveSelected("down")}
              >
                <ChevronDown className="h-4 w-4 mr-1" />
                下へ
              </Button>
              <Button
                variant="outline"
                onClick={handleDeferSelected}
                disabled={deferLoading}
              >
                {deferLoading ? "処理中..." : `${selectedRows.size}件を翌月へ繰り延べ`}
              </Button>
            </>
          )}
          {isClosed ? (
            <Button
              variant="outline"
              onClick={() => setReopenDialogOpen(true)}
              disabled={actionLoading}
            >
              月締め解除
            </Button>
          ) : (
            <Button
              onClick={handleCloseMonth}
              disabled={actionLoading || !selectedMonth}
            >
              {actionLoading ? "処理中..." : "月締め"}
            </Button>
          )}
          {isClosed && (
            <Badge variant="default">締め済み</Badge>
          )}
          <Button variant="outline" size="icon" onClick={() => window.print()} title="印刷">
            <Printer className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">表示条件</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-1">
              <Label>口座</Label>
              <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                <SelectTrigger className="w-60">
                  <SelectValue placeholder="口座を選択" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {[a.bankName, a.branchName, a.accountNumber].filter(Boolean).join(" ") || a.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>月</Label>
              <Input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-44"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {tableData && (
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">期首残高</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatYen(Number(tableData.openingBalance))}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">当月入金合計</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-green-600">{formatYen(Number(tableData.totalDeposit))}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">当月支払合計</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-red-600">{formatYen(Math.abs(Number(tableData.totalWithdrawal)))}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">月末残高</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatYen(Number(tableData.closingBalance))}</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">フィルター</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-1">
              <Label>取引先</Label>
              <Input
                placeholder="取引先名で絞り込み"
                value={filterPartner}
                onChange={(e) => setFilterPartner(e.target.value)}
                className="w-48"
              />
            </div>
            <div className="space-y-1">
              <Label>ステータス</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">すべて</SelectItem>
                  <SelectItem value="DRAFT">下書き</SelectItem>
                  <SelectItem value="READY">準備完了</SelectItem>
                  <SelectItem value="CONFIRMED">確定済</SelectItem>
                  <SelectItem value="CANCELLED">取消済</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>取引種別</Label>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">すべて</SelectItem>
                  <SelectItem value="EXPENSE">経費</SelectItem>
                  <SelectItem value="SALES">売上</SelectItem>
                  <SelectItem value="COST_PAYMENT">原価支払</SelectItem>
                  <SelectItem value="SALARY">給与</SelectItem>
                  <SelectItem value="LOAN">借入</SelectItem>
                  <SelectItem value="TRANSFER">振替</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">取引一覧</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground text-center py-8">読み込み中...</p>
          ) : !tableData || filteredRows.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">取引データがありません</p>
          ) : (
            <div className="overflow-x-auto">
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8"></TableHead>
                      {!isClosed && (
                        <TableHead className="w-8">
                          <Checkbox
                            checked={selectedRows.size > 0 && selectedRows.size === filteredRows.filter(r => r.status !== "CONFIRMED").length}
                            onCheckedChange={() => toggleAllRows()}
                          />
                        </TableHead>
                      )}
                      <TableHead className="whitespace-nowrap">実出納日</TableHead>
                      <TableHead className="whitespace-nowrap">予定日</TableHead>
                      <TableHead className="whitespace-nowrap">取引種別</TableHead>
                      <TableHead className="whitespace-nowrap">固定/変動</TableHead>
                      <TableHead className="whitespace-nowrap">取引先</TableHead>
                      <TableHead className="text-right whitespace-nowrap">入金額</TableHead>
                      <TableHead className="text-right whitespace-nowrap">支払額</TableHead>
                      <TableHead className="text-right whitespace-nowrap">差引残高</TableHead>
                      <TableHead className="whitespace-nowrap">摘要</TableHead>
                      <TableHead className="whitespace-nowrap">中項目/小項目</TableHead>
                      <TableHead className="text-right whitespace-nowrap">差額</TableHead>
                      <TableHead className="whitespace-nowrap">ステータス</TableHead>
                      <TableHead className="whitespace-nowrap">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <SortableContext items={filteredRows.map((r) => r.id)} strategy={verticalListSortingStrategy}>
                    <TableBody>
                      {filteredRows.map((row) => (
                        <SortableRow
                          key={row.id}
                          row={row}
                          isClosed={isClosed}
                          selectedRows={selectedRows}
                          toggleRowSelection={toggleRowSelection}
                          handleDeferSingle={handleDeferSingle}
                          deferLoading={deferLoading}
                        />
                      ))}
                    </TableBody>
                  </SortableContext>
                </Table>
              </DndContext>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={reopenDialogOpen} onOpenChange={setReopenDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>月締め解除</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              {selectedMonth} の月締めを解除します。解除理由を入力してください。
            </p>
            <div className="space-y-2">
              <Label>解除理由 *</Label>
              <Input
                value={reopenReason}
                onChange={(e) => setReopenReason(e.target.value)}
                placeholder="解除理由を入力してください"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setReopenDialogOpen(false); setReopenReason("") }}>
              キャンセル
            </Button>
            <Button
              onClick={handleReopenMonth}
              disabled={actionLoading || !reopenReason.trim()}
            >
              {actionLoading ? "処理中..." : "解除する"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={reorderPending !== null} onOpenChange={(open) => { if (!open) handleCancelReorder() }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>並べ替え — 日付の設定</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              {reorderPending?.movedIds.length === 1
                ? "移動した取引の予定日を設定してください。"
                : `${reorderPending?.movedIds.length}件の取引の予定日を設定してください。`}
            </p>
            <div className="space-y-2">
              <Label>予定日</Label>
              <Input
                type="date"
                value={reorderDate}
                onChange={(e) => setReorderDate(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCancelReorder} disabled={reorderSaving}>
              キャンセル
            </Button>
            <Button
              onClick={handleConfirmReorder}
              disabled={reorderSaving || !reorderDate}
            >
              {reorderSaving ? "保存中..." : "この日付で確定"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
