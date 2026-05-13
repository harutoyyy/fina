"use client"

import { useEffect, useState, useRef } from "react"
import { getEvidencesForTransaction, getUploadUrl, uploadEvidence, deleteEvidence, getEvidenceViewUrl, updateEvidenceMeta } from "@/app/actions/evidence"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Loader2, Upload, Trash2, FileText, Image, File, Eye, Pencil, Save } from "lucide-react"

type Evidence = Awaited<ReturnType<typeof getEvidencesForTransaction>>[number]

function getFileIcon(mimeType: string | null) {
  if (!mimeType) return <File className="h-5 w-5" />
  if (mimeType.startsWith("image/")) return <Image className="h-5 w-5" />
  return <FileText className="h-5 w-5" />
}

function isRecentUpload(date: string | Date, hoursAgo = 48): boolean {
  return Date.now() - new Date(date).getTime() < hoursAgo * 3600_000
}

function formatFileSize(bytes: number | null) {
  if (!bytes) return "-"
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function EvidencePanel({
  transactionId,
  open,
  onOpenChange,
}: {
  transactionId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [evidences, setEvidences] = useState<Evidence[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewMime, setPreviewMime] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [metaForm, setMetaForm] = useState({ date: "", vendor: "", amount: "" })
  const [metaSaving, setMetaSaving] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const load = async () => {
    setLoading(true)
    const data = await getEvidencesForTransaction(transactionId)
    setEvidences(data)
    setLoading(false)
  }

  useEffect(() => {
    if (open) load()
  }, [open, transactionId])

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    setUploading(true)
    try {
      for (const file of Array.from(files)) {
        // 署名付きURLを取得
        const { signedUrl, token, storagePath } = await getUploadUrl(transactionId, file.name)

        // クライアントから直接 Supabase Storage にアップロード
        const uploadRes = await fetch(signedUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type },
          body: file,
        })

        if (!uploadRes.ok) {
          throw new Error(`アップロード失敗: ${file.name}`)
        }

        // DBレコード作成
        await uploadEvidence(transactionId, {
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
          storagePath,
        })
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "アップロードに失敗しました")
    }
    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ""
    load()
  }

  const handleDelete = async (id: string) => {
    if (!confirm("この証憑を削除しますか？")) return
    await deleteEvidence(id)
    load()
  }

  // T-12: プレビュー
  const handlePreview = async (ev: Evidence) => {
    try {
      const url = await getEvidenceViewUrl(ev.id)
      setPreviewUrl(url)
      setPreviewMime(ev.mimeType)
    } catch (err) {
      alert(err instanceof Error ? err.message : "プレビューに失敗しました")
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>証憑管理</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleFileSelect}
                accept="image/*,.pdf,.xlsx,.xls,.csv"
              />
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="w-full"
              >
                {uploading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" />
                )}
                ファイルを添付
              </Button>
            </div>

            {loading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : evidences.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">証憑なし</p>
            ) : (
              <div className="space-y-2">
                {evidences.map((ev) => (
                  <div
                    key={ev.id}
                    className={`flex items-center gap-3 p-2 rounded border ${isRecentUpload(ev.uploadedAt) ? "bg-blue-50 dark:bg-blue-950/30 border-blue-200" : "bg-muted/30"}`}
                  >
                    {getFileIcon(ev.mimeType)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        <p className="text-sm font-medium truncate">{ev.fileName}</p>
                        {isRecentUpload(ev.uploadedAt) && (
                          <Badge variant="outline" className="text-[10px] px-1 py-0 text-blue-600 border-blue-300 shrink-0">NEW</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(ev.fileSize)} · {new Date(ev.uploadedAt).toLocaleDateString("ja-JP")}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handlePreview(ev)}
                      className="shrink-0"
                      title="プレビュー"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        if (editingId === ev.id) {
                          setEditingId(null)
                        } else {
                          setEditingId(ev.id)
                          setMetaForm({
                            date: (ev as Record<string, unknown>).metaTransactionDate
                              ? new Date((ev as Record<string, unknown>).metaTransactionDate as string).toISOString().split("T")[0]
                              : "",
                            vendor: ((ev as Record<string, unknown>).metaVendorName as string) || "",
                            amount: (ev as Record<string, unknown>).metaAmount
                              ? String((ev as Record<string, unknown>).metaAmount)
                              : "",
                          })
                        }
                      }}
                      className="shrink-0"
                      title="メタ編集"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(ev.id)}
                      className="shrink-0"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                    {editingId === ev.id && (
                      <div className="w-full mt-2 space-y-2 border-t pt-2" onClick={(e) => e.stopPropagation()}>
                        <div className="grid grid-cols-3 gap-2">
                          <Input
                            type="date"
                            className="h-7 text-xs"
                            placeholder="取引日"
                            value={metaForm.date}
                            onChange={(e) => setMetaForm((f) => ({ ...f, date: e.target.value }))}
                          />
                          <Input
                            type="text"
                            className="h-7 text-xs"
                            placeholder="取引先名"
                            value={metaForm.vendor}
                            onChange={(e) => setMetaForm((f) => ({ ...f, vendor: e.target.value }))}
                          />
                          <Input
                            type="number"
                            className="h-7 text-xs"
                            placeholder="金額"
                            value={metaForm.amount}
                            onChange={(e) => setMetaForm((f) => ({ ...f, amount: e.target.value }))}
                          />
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs w-full"
                          disabled={metaSaving}
                          onClick={async () => {
                            setMetaSaving(true)
                            try {
                              await updateEvidenceMeta(ev.id, {
                                metaTransactionDate: metaForm.date || null,
                                metaVendorName: metaForm.vendor || null,
                                metaAmount: metaForm.amount || null,
                              })
                              setEditingId(null)
                              load()
                            } catch (err) {
                              alert(err instanceof Error ? err.message : "保存に失敗しました")
                            } finally {
                              setMetaSaving(false)
                            }
                          }}
                        >
                          <Save className="h-3 w-3 mr-1" />
                          保存
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* T-12: プレビューダイアログ */}
      <Dialog open={!!previewUrl} onOpenChange={(o) => { if (!o) { setPreviewUrl(null); setPreviewMime(null) } }}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>証憑プレビュー</DialogTitle>
          </DialogHeader>
          <div className="overflow-auto max-h-[75vh]">
            {previewUrl && previewMime?.startsWith("image/") && (
              <img src={previewUrl} alt="証憑プレビュー" className="max-w-full" />
            )}
            {previewUrl && previewMime === "application/pdf" && (
              <iframe src={previewUrl} className="w-full h-[70vh]" />
            )}
            {previewUrl && !previewMime?.startsWith("image/") && previewMime !== "application/pdf" && (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">このファイル形式はプレビューできません</p>
                <Button asChild>
                  <a href={previewUrl} target="_blank" rel="noopener noreferrer">ダウンロード</a>
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
