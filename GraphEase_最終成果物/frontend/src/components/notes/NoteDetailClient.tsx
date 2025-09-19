// src/components/notes/NoteDetailClient.tsx
"use client";

import { useRouter } from "next/navigation";
import { NoteDetail } from "@/components/notes/NoteDetail";
import { apiClient } from "@/lib/api";
import type { Recording } from "@/types";

/**
 * Server Component から受け取った note をクライアント層で使う。
 * 「戻る」「クイズ作成」などイベント系の実装をここに集約。
 */
type Props = { note: Recording };

export default function NoteDetailClient({ note }: Props) {
  const router = useRouter();

  // 「クイズを作成」ボタンの実装
  const handleCreateQuiz = async (
    noteId: string,
    noteTitle: string,
    summary: string
  ) => {
    try {
      const res = await apiClient.createQuizFromSummary({
        recordingId: noteId,
        title: noteTitle,
        summary, // ← NoteDetail から編集後の要約が渡ってくる
        category: (note as any)?.category ?? "general",
        difficulty: "normal",
      });
      if (res.ok) {
        // 作成成功 → 学習タブへ
        router.push("/study");
      } else {
        alert("クイズの作成に失敗しました。");
      }
    } catch (e) {
      console.error("create quiz failed:", e);
      alert("クイズ作成に失敗しました。ログを確認してください。");
    }
  };

  return (
    <NoteDetail
      note={note}
      onBack={() => router.back()}
      onCreateQuiz={handleCreateQuiz}
    />
  );
}
