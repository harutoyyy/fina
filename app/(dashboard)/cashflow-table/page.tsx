"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
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
  DragOverlay,
  type DragStartEvent,
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

const TYPE_TO_PAGE: Record<string, string> = {
  EXPENSE: "/expenses",
  SALES: "/sales",
  COST_PAYMENT: "/costs",
  SALARY: "/salary",
  LOAN: "/loans",
  TRANSFER: "/expenses",
}

function getVariance(row: CashFlowRow): number | null {
  const est = row.estimatedAmount ? Number(row.estimatedAmount) : null
  const act = row.actualAmount ? Number(row.actualAmount) : null
  if (est !== null && act !== null) return act - est

  const rec = row.recordedAmount ? Number(row.recordedAmount) : null
  const trn = row.transferAmount ? Number(row.transferAmount) : null
  if (rec !== null && trn !== null) return trn - rec

  const inv = row.invoiceAmount ? Number(row.invoiceAmount) : null
  const amt = Number(row.amount)
  if (inv !== null) return amt - inv

  return null
}

function SortableRow({
  row,
  isClosed,
  selectedRows,
  toggleRowSelection,
  handleDeferSingle,
  deferLoading,
  onDoubleClick,
  onRowClick,
  isSelected,
  isBeingDraggedWithGroup,
}: {
  row: CashFlowRow
  isClosed: boolean
  selectedRows: Set<string>
  toggleRowSelection: (id: string) => void
  handleDeferSingle: (id: string) => void
  deferLoading: boolean
  onDoubleClick: (row: CashFlowRow) => void
  onRowClick: (row: CashFlowRow) => void
  isSelected: boolean
  isBeingDraggedWithGroup: boolean
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
    opacity: isDragging ? 0.3 : isBeingDraggedWithGroup ? 0.5 : 1,
  }

  const deposit = Number(row.deposit)
  const withdrawal = Number(row.withdrawal)
  const detail = row.details[0]
  const categoryDisplay = detail
    ? [detail.midName, detail.subName].filter(Boolean).join(" / ")
    : "—"
  const canDefer = row.status !== "CONFIRMED"
  const variance = getVariance(row)

  return (
    <TableRow
      ref={setNodeRef}
      style={style}
      className={`cursor-pointer ${isSelected ? "bg-muted/50" : ""} ${isBeingDraggedWithGroup ? "bg-blue-50 dark:bg-blue-950/30" : ""}`}
      onClick={() => onRowClick(row)}
      onDoubleClick={() => onDoubleClick(row)}
    >
      <TableCell className="w-8 cursor-grab" {...attributes} {...listeners} onClick={(e) => e.stopPropagation()}>
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </TableCell>
      {!isClosed && (
        <TableCell onClick={(e) => e.stopPropagation()}>
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
      <TableCell>
        {row.partnerName
          ? (row.partnerId ? row.partnerName : <span className="text-orange-600">{row.partnerName}（仮）</span>)
          : "—"}
      </TableCell>
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
      <TableCell className={`text-right font-mono ${variance !== null && variance !== 0 ? (variance > 0 ? "text-green-600" : "text-red-600") : ""}`}>
        {variance !== null ? formatYen(variance) : "—"}
      </TableCell>
      <TableCell>
        <Badge variant={STATUS_VARIANTS[row.status] || "outline"}>
          {STATUS_LABELS[row.status] || row.status}
        </Badge>
      </TableCell>
      <TableCell onClick={(e) => e.stopPropagation()}>
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
  const router = useRouter()
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
  const [previewRow, setPreviewRow] = useState<CashFlowRow | null>(null)

  // 並べ替え時の日付設定ダイアログ
  const [reorderPending, setReorderPending] = useState<{
    reordered: CashFlowRow[]
    updates: { id: string; displayOrder: number }[]
    movedIds: string[]
    suggestedDay: string
  } | null>(null)
  const [reorderDay, setReorderDay] = useState("")
  const [reorderSaving, setReorderSaving] = useState(false)
  const [prevTableData, setPrevTableData] = useState<CashFlowTableData | null>(null)
  const [activeDragId, setActiveDragId] = useState<string | null>(null)

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

  const getSuggestedDay = (rows: CashFlowRow[], targetIndex: number): string => {
    // 移動先の直上の行の日付からDDを取得
    if (targetIndex > 0) {
      const above = rows[targetIndex - 1]
      const d = above.scheduledDate || above.transactionDate
      if (d) {
        const day = new Date(d).getDate()
        return String(day).padStart(2, "0")
      }
    }
    return "01"
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

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(event.active.id as string)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragId(null)
    const { active, over } = event
    if (!over || !selectedCompany || !tableData) return

    const draggedId = active.id as string
    // ドラッグした行がチェック済みなら、チェック済み行を全てまとめて移動
    const movedIds = selectedRows.has(draggedId)
      ? new Set(selectedRows)
      : new Set([draggedId])

    const rows = [...filteredRows]
    const overIndex = rows.findIndex((r) => r.id === over.id)
    if (overIndex === -1) return

    // ドロップ先が移動対象自身で、かつ1行だけなら何もしない
    if (active.id === over.id && movedIds.size <= 1) return

    // 移動対象の行と残りの行を分離
    const moved: CashFlowRow[] = []
    const rest: CashFlowRow[] = []
    rows.forEach((r) => {
      if (movedIds.has(r.id)) moved.push(r)
      else rest.push(r)
    })

    if (rest.length === 0) return // 全行が選択されている場合は移動不要

    // ドロップ先の行を基準に挿入位置を決定
    const overRow = rows[overIndex]
    const restIndex = rest.indexOf(overRow)

    let insertPos: number
    if (restIndex !== -1) {
      // ドロップ先が非移動行 → その行の前か後に挿入
      const draggedOrigIndex = rows.findIndex((r) => r.id === draggedId)
      insertPos = draggedOrigIndex < overIndex ? restIndex + 1 : restIndex
    } else {
      // ドロップ先も移動行 → 元のoverIndex前後の非移動行を基準にする
      insertPos = rest.length
      for (let i = overIndex + 1; i < rows.length; i++) {
        const idx = rest.indexOf(rows[i])
        if (idx !== -1) { insertPos = idx; break }
      }
    }

    const reordered = [
      ...rest.slice(0, insertPos),
      ...moved,
      ...rest.slice(insertPos),
    ]

    // 元の順序と変わっていなければ何もしない
    const isSame = reordered.every((r, i) => r.id === filteredRows[i]?.id)
    if (isSame) return

    const updates = reordered.map((r, i) => ({ id: r.id, displayOrder: i }))
    const blockStart = reordered.findIndex((r) => movedIds.has(r.id))
    const suggested = getSuggestedDay(reordered, blockStart)
    setReorderDay(suggested)
    setReorderPending({
      reordered,
      updates,
      movedIds: Array.from(movedIds),
      suggestedDay: suggested,
    })

    applyOptimisticReorder(reordered)
  }

  const handleConfirmReorder = async () => {
    if (!reorderPending || !selectedCompany) return
    setReorderSaving(true)
    try {
      const fullDate = `${selectedMonth}-${reorderDay.padStart(2, "0")}`
      const dateUpdates = reorderPending.movedIds.map((id) => ({
        transactionId: id,
        scheduledDate: fullDate,
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
      setReorderDay("")
      setReorderSaving(false)
      setPrevTableData(null)
    }
  }

  const handleCancelReorder = () => {
    if (prevTableData) setTableData(prevTableData)
    setReorderPending(null)
    setReorderDay("")
    setPrevTableData(null)
  }

  const handleRowDoubleClick = (row: CashFlowRow) => {
    const page = TYPE_TO_PAGE[row.type]
    if (page) {
      router.push(`${page}?edit=${row.id}`)
    }
  }

  const handleMoveSelected = (direction: "up" | "down") => {
    if (!tableData || !selectedCompany || selectedRows.size === 0) return

    const rows = [...filteredRows]
    // 選択行と非選択行を分離
    const selected: CashFlowRow[] = []
    const rest: CashFlowRow[] = []
    let firstSelectedIndex = -1

    rows.forEach((r, i) => {
      if (selectedRows.has(r.id)) {
        selected.push(r)
        if (firstSelectedIndex === -1) firstSelectedIndex = i
      } else {
        rest.push(r)
      }
    })

    if (selected.length === 0) return

    // 非選択行のみのリスト内で、選択ブロックの挿入位置を計算
    // 現在の挿入位置 = firstSelectedIndex の前にある非選択行の数
    let currentInsertPos = 0
    for (let i = 0; i < firstSelectedIndex; i++) {
      if (!selectedRows.has(rows[i].id)) currentInsertPos++
    }

    let newInsertPos: number
    if (direction === "up") {
      newInsertPos = Math.max(0, currentInsertPos - 1)
    } else {
      newInsertPos = Math.min(rest.length, currentInsertPos + 1)
    }

    if (newInsertPos === currentInsertPos) return

    // 非選択行リストに選択行ブロックを挿入
    const reordered = [
      ...rest.slice(0, newInsertPos),
      ...selected,
      ...rest.slice(newInsertPos),
    ]

    const updates = reordered.map((r, i) => ({ id: r.id, displayOrder: i }))
    const blockStartIndex = newInsertPos
    const suggested = getSuggestedDay(reordered, blockStartIndex)
    setReorderDay(suggested)
    setReorderPending({
      reordered,
      updates,
      movedIds: Array.from(selectedRows),
      suggestedDay: suggested,
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
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
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
                          onDoubleClick={handleRowDoubleClick}
                          onRowClick={setPreviewRow}
                          isSelected={previewRow?.id === row.id}
                          isBeingDraggedWithGroup={
                            activeDragId !== null &&
                            activeDragId !== row.id &&
                            selectedRows.has(activeDragId) &&
                            selectedRows.has(row.id)
                          }
                        />
                      ))}
                    </TableBody>
                  </SortableContext>
                </Table>
                <DragOverlay>
                  {activeDragId && selectedRows.has(activeDragId) && selectedRows.size > 1 ? (
                    <div className="bg-background border rounded-md shadow-lg p-3 text-sm font-medium">
                      {selectedRows.size}件の取引を移動中...
                    </div>
                  ) : activeDragId ? (
                    <div className="bg-background border rounded-md shadow-lg p-3 text-sm font-medium">
                      {filteredRows.find((r) => r.id === activeDragId)?.partnerName || "取引"} を移動中...
                    </div>
                  ) : null}
                </DragOverlay>
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
        <DialogContent className="sm:max-w-[360px]">
          <DialogHeader>
            <DialogTitle>並べ替え — 予定日の設定</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              {reorderPending?.movedIds.length === 1
                ? "移動した取引の予定日（日付）を設定してください。"
                : `${reorderPending?.movedIds.length}件の取引の予定日（日付）を設定してください。`}
            </p>
            <div className="space-y-2">
              <Label>{selectedMonth} の</Label>
              <div className="flex items-center gap-2">
                <Select value={reorderDay} onValueChange={setReorderDay}>
                  <SelectTrigger className="w-24">
                    <SelectValue placeholder="日" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: new Date(Number(selectedMonth.split("-")[0]), Number(selectedMonth.split("-")[1]), 0).getDate() }, (_, i) => {
                      const d = String(i + 1).padStart(2, "0")
                      return <SelectItem key={d} value={d}>{d}日</SelectItem>
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCancelReorder} disabled={reorderSaving}>
              キャンセル
            </Button>
            <Button
              onClick={handleConfirmReorder}
              disabled={reorderSaving || !reorderDay}
            >
              {reorderSaving ? "保存中..." : "確定"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {previewRow && (
        <Dialog open={true} onOpenChange={() => setPreviewRow(null)}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>取引プレビュー</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div className="text-muted-foreground">取引種別</div>
                <div>{TYPE_LABELS[previewRow.type] || previewRow.type}</div>
                <div className="text-muted-foreground">取引先</div>
                <div>{previewRow.partnerName || "—"}</div>
                <div className="text-muted-foreground">実出納日</div>
                <div>{previewRow.transactionDate ? formatDate(previewRow.transactionDate) : "—"}</div>
                <div className="text-muted-foreground">予定日</div>
                <div>{previewRow.scheduledDate ? formatDate(previewRow.scheduledDate) : "—"}</div>
                <div className="text-muted-foreground">金額</div>
                <div className="font-mono">{formatYen(Math.abs(Number(previewRow.amount)))}</div>
                {previewRow.estimatedAmount && (
                  <>
                    <div className="text-muted-foreground">予定金額</div>
                    <div className="font-mono">{formatYen(Math.abs(Number(previewRow.estimatedAmount)))}</div>
                  </>
                )}
                {previewRow.actualAmount && (
                  <>
                    <div className="text-muted-foreground">実績金額</div>
                    <div className="font-mono">{formatYen(Math.abs(Number(previewRow.actualAmount)))}</div>
                  </>
                )}
                {(() => {
                  const v = getVariance(previewRow)
                  if (v === null) return null
                  return (
                    <>
                      <div className="text-muted-foreground">差額</div>
                      <div className={`font-mono font-medium ${v > 0 ? "text-green-600" : v < 0 ? "text-red-600" : ""}`}>
                        {formatYen(v)}
                      </div>
                    </>
                  )
                })()}
                <div className="text-muted-foreground">ステータス</div>
                <div><Badge variant={STATUS_VARIANTS[previewRow.status] || "outline"}>{STATUS_LABELS[previewRow.status] || previewRow.status}</Badge></div>
                <div className="text-muted-foreground">摘要</div>
                <div>{previewRow.summary || "—"}</div>
              </div>
              {previewRow.details.length > 0 && (
                <div className="border-t pt-3 mt-3">
                  <p className="font-medium mb-2">内訳</p>
                  <div className="space-y-1">
                    {previewRow.details.map((d) => (
                      <div key={d.id} className="flex justify-between text-sm">
                        <span>{[d.midName, d.subName].filter(Boolean).join(" / ") || "—"}{d.summary ? ` (${d.summary})` : ""}</span>
                        <span className="font-mono">{formatYen(Math.abs(Number(d.amount)))}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPreviewRow(null)}>
                閉じる
              </Button>
              <Button onClick={() => { handleRowDoubleClick(previewRow); setPreviewRow(null) }}>
                編集画面へ
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
