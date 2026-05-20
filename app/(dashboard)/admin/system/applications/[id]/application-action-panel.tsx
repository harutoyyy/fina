"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  approveApplication,
  rejectApplication,
} from "@/app/actions/company-applications"

export function ApplicationActionPanel({ applicationId }: { applicationId: string }) {
  const router = useRouter()
  const [comment, setComment] = useState("")
  const [error, setError] = useState("")
  const [pendingAction, setPendingAction] = useState<"approve" | "reject" | null>(null)
  const [confirmAction, setConfirmAction] = useState<"approve" | "reject" | null>(null)

  const handleApprove = async () => {
    setError("")
    setPendingAction("approve")
    try {
      await approveApplication(applicationId, comment || undefined)
      setConfirmAction(null)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "承認に失敗しました")
    } finally {
      setPendingAction(null)
    }
  }

  const handleReject = async () => {
    setError("")
    if (!comment.trim()) {
      setError("却下理由を入力してください")
      return
    }
    setPendingAction("reject")
    try {
      await rejectApplication(applicationId, comment)
      setConfirmAction(null)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "却下に失敗しました")
    } finally {
      setPendingAction(null)
    }
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="comment">コメント (却下時は必須)</Label>
        <Input
          id="comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="却下理由・備考"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() => {
            setError("")
            setConfirmAction("approve")
          }}
        >
          承認する
        </Button>
        <Button
          variant="destructive"
          onClick={() => {
            setError("")
            if (!comment.trim()) {
              setError("却下理由を入力してください")
              return
            }
            setConfirmAction("reject")
          }}
        >
          却下する
        </Button>
      </div>

      <Dialog
        open={confirmAction !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmAction(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmAction === "approve" ? "申請を承認しますか?" : "申請を却下しますか?"}
            </DialogTitle>
            <DialogDescription>
              {confirmAction === "approve"
                ? "Company / UserProfile (COMPANY_ADMIN) を作成し、申請者にパスワード設定リンクをメール送信します。"
                : "申請者に却下通知メールを送信します。この操作は取り消せません。"}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setConfirmAction(null)}
              disabled={pendingAction !== null}
            >
              キャンセル
            </Button>
            {confirmAction === "approve" ? (
              <Button onClick={handleApprove} disabled={pendingAction !== null}>
                {pendingAction === "approve" && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                承認
              </Button>
            ) : (
              <Button
                variant="destructive"
                onClick={handleReject}
                disabled={pendingAction !== null}
              >
                {pendingAction === "reject" && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                却下
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
