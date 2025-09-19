// src/app/notes/[id]/page.tsx
// 日本語コメント：このファイルは Server Component（デフォルト）なので、
// データ取得だけを行い、イベントハンドラはクライアント側ラッパーに任せます。

import NoteDetailClient from "@/components/notes/NoteDetailClient"; // ★ default import に注意
import { notFound } from "next/navigation";

type PageProps = { params: { id: string } };

export default async function NoteDetailPage({ params }: PageProps) {
  // 日本語：バックエンドのベースURL（.env.local の NEXT_PUBLIC_API_BASE を優先）
  const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000";

  // 日本語：録音詳細をバックエンドから取得（SSR側なので fetch でOK）
  try {
    const res = await fetch(`${API_BASE}/api/recordings/${params.id}`, {
      cache: "no-store", // 毎回最新を取得
      // next: { revalidate: 0 } でも同様の効果
    });

    if (!res.ok) {
      // 日本語：存在しないIDなど → 404 ページへ
      return notFound();
    }

    const note = await res.json();
    if (!note?.id) {
      // 日本語：念のためデータ妥当性チェック
      return notFound();
    }

    // 日本語：クライアント側ラッパーへ note を渡す
    return (
      <div className="container mx-auto max-w-5xl p-4 md:p-6">
        <NoteDetailClient note={note} />
      </div>
    );
  } catch (err) {
    // 日本語：ネットワーク等の例外時も 404 相当の画面に
    console.error("Failed to fetch note detail:", err);
    return notFound();
  }
}
