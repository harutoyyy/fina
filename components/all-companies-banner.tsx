"use client"

import Link from "next/link"
import { Layers } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

/**
 * 「全社合算」モード時、編集系ページで表示する案内バナー。
 * クリックで /all-companies の読み取り専用ビューに誘導。
 */
export function AllCompaniesBanner({ feature }: { feature: string }) {
  return (
    <Card className="border-blue-300 bg-blue-50/50 dark:bg-blue-950/30 dark:border-blue-800">
      <CardContent className="py-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Layers className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <p className="font-medium text-sm">
                「全社合算」モードでは {feature} の編集はできません
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                全社のデータをまとめて確認するには「全社合算ビュー」をご利用ください。
                <br />
                個別会社で編集する場合は、上部の会社セレクターから会社を選択してください。
              </p>
            </div>
          </div>
          <Link href="/all-companies">
            <Button variant="default" size="sm">
              <Layers className="h-3.5 w-3.5 mr-1" />
              全社合算ビューを開く
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}
