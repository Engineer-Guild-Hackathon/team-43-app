// src/components/study/NewQuizFromNoteDialog.tsx
"use client";


import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api";
import type { RecordingLight, Recording } from "@/types";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/**
 * 日本語：
 * 「＋ 新しいクイズを作成」を押すと開くダイアログ。
 * - ノート（録音）を選択
 * - 難易度/カテゴリを選択
 * - 選んだノートの「要約」からクイズを自動生成 → 保存
 */
type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void; // 作成完了後に一覧をリロードするためのコールバック
};

export default function NewQuizFromNoteDialog({ open, onOpenChange, onCreated }: Props) {
  // 日本語：ノート一覧（軽量）を取得してセレクト表示に使う
  const [notes, setNotes] = useState<RecordingLight[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(false);

  // 日本語：ユーザが選択したもの
  const [selectedId, setSelectedId] = useState<string>("");
  const [difficulty, setDifficulty] = useState<"easy" | "normal" | "hard">("normal");
  const [category, setCategory] = useState<string>("general");

  // 日本語：作成中フラグ
  const [creating, setCreating] = useState(false);
  const disabled = !selectedId || creating;

  // 日本語：ダイアログが開いたタイミングでノート一覧を取得
  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        setLoadingNotes(true);
        const res = await apiClient.getRecordings();
        // バックエンドの返し方に両対応（配列 or {recordings: [...] }）
        const list = Array.isArray(res) ? res : (res?.recordings ?? []);
        setNotes(list);
      } catch (e) {
        console.error("failed to load notes:", e);
        setNotes([]);
      } finally {
        setLoadingNotes(false);
      }
    })();
  }, [open]);

  // 日本語：作成処理
  const handleCreate = async () => {
    if (!selectedId) return;
    setCreating(true);
    try {
      // 1) 詳細を取って要約を得る
      const detail: Recording = await apiClient.getRecording(selectedId);
      const title = detail.title || "Quiz";
      const summary = detail.summary || "";

      if (!summary.trim()) {
        alert("このノートには要約がありません。先に要約を作成してください。");
        return;
      }

      // 2) 要約からクイズ作成APIを呼ぶ
      const res = await apiClient.createQuizFromSummary({
        recordingId: detail.id,
        title,
        summary,
        category,
        difficulty,
      });

      if (res?.ok) {
        // 3) 成功 → 親に通知して一覧を再読込
        onOpenChange(false);
        onCreated();
      } else {
        alert("クイズ作成に失敗しました。ログを確認してください。");
      }
    } catch (e) {
      console.error("create quiz failed:", e);
      alert("クイズ作成に失敗しました。");
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>ノートからクイズを作成</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* ノート選択 */}
          <div>
            <div className="mb-1 text-sm text-gray-600">ノートを選択</div>
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="w-full rounded-md border border-gray-300 bg-white p-2 text-sm focus:border-green-500 focus:outline-none"
              disabled={loadingNotes}
            >
              <option value="">{loadingNotes ? "読み込み中…" : "選択してください"}</option>
              {notes.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.title}（{new Date(n.created_at).toLocaleDateString()}）
                </option>
              ))}
            </select>
          </div>

          {/* 難易度 */}
          <div>
            <div className="mb-1 text-sm text-gray-600">難易度</div>
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value as any)}
              className="w-full rounded-md border border-gray-300 bg-white p-2 text-sm focus:border-green-500 focus:outline-none"
            >
              <option value="easy">簡単</option>
              <option value="normal">普通</option>
              <option value="hard">難しい</option>
            </select>
          </div>

          {/* カテゴリ */}
          <div>
            <div className="mb-1 text-sm text-gray-600">カテゴリ</div>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-md border border-gray-300 bg-white p-2 text-sm focus:border-green-500 focus:outline-none"
            >
              <option value="general">一般</option>
              <option value="computer_science">コンピュータサイエンス</option>
              <option value="math">数学</option>
              <option value="physics">物理学</option>
              <option value="language">語学</option>
            </select>
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={creating}>
            キャンセル
          </Button>
          <Button
            onClick={handleCreate}
            disabled={disabled}
            className="bg-green-600 text-white hover:bg-green-700"
          >
            {creating ? "作成中…" : "作成する"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
