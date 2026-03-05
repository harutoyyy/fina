"use client"

import { useEffect, useState, useRef } from "react"
import { getEvidencesForTransaction, uploadEvidence, deleteEvidence } from "@/app/actions/evidence"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Loader2, Upload, Trash2, FileText, Image, File } from "lucide-react"

type Evidence = Awaited<ReturnType<typeof getEvidencesForTransaction>>[number]

function getFileIcon(mimeType: string | null) {
  if (!mimeType) return <File className="h-5 w-5" />
  if (mimeType.startsWith("image/")) return <Image className="h-5 w-5" />
  return <FileText className="h-5 w-5" />
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
    for (const file of Array.from(files)) {
      await uploadEvidence(transactionId, {
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
      })
    }
    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ""
    load()
  }

  const handleDelete = async (id: string) => {
    await deleteEvidence(id)
    load()
  }

  return (
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
              ファイルを添付（モック）
            </Button>
            <p className="text-xs text-muted-foreground mt-1">
              ※ 現在はファイル情報のみ記録されます（実ファイルはS3連携後に保存）
            </p>
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
                  className="flex items-center gap-3 p-2 rounded border bg-muted/30"
                >
                  {getFileIcon(ev.mimeType)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{ev.fileName}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(ev.fileSize)} · {new Date(ev.uploadedAt).toLocaleDateString("ja-JP")}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(ev.id)}
                    className="shrink-0"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
