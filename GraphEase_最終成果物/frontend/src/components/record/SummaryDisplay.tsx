// src/components/record/SummaryDisplay.tsx
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { VisualNote } from "@/components/notes/VisualNote"; // ★ 追加：自動生成ビジュアルノート

type Props = {
  summary: string;              // 日本語：要約テキスト
  keywords: string[];           // 日本語：選択した重要語（強調に使用）
  onSave: (title: string, category: string) => void;
  onBack: () => void;
};

export function SummaryDisplay({ summary, keywords, onSave, onBack }: Props) {
  // 日本語：保存用の仮タイトル（先頭30字を既定値に）
  const defaultTitle =
    (summary?.trim()?.slice(0, 30) || "ノート").replace(/\s+/g, " ");

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      {/* 左：要約テキスト */}
      <Card>
        <CardHeader>
          <CardTitle>要約</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-wrap text-sm leading-7 text-gray-800">
            {summary || "要約はありません"}
          </p>
        </CardContent>
      </Card>

      {/* 右：ビジュアルノート（自動生成） */}
      <div className="space-y-4">
        <div className="text-lg font-semibold">ビジュアルノート</div>
        <VisualNote summary={summary} keywords={keywords} /> {/* ★ ここが固定→動的化 */}
      </div>

      {/* 下：操作ボタン */}
      <div className="col-span-1 md:col-span-2 flex justify-end gap-3">
        <Button variant="outline" onClick={onBack}>
          戻る
        </Button>
        <Button
          onClick={() => onSave(defaultTitle, "default")}
          className="bg-green-600 hover:bg-green-700 text-white"
        >
          保存する
        </Button>
      </div>
    </div>
  );
}
