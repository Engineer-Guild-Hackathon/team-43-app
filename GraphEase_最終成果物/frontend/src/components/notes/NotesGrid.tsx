"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import type { RecordingLight } from "@/types";
import { formatDate } from "@/lib/utils"; // 日本語：日付フォーマット関数（既存 util を想定）

interface NotesGridProps {
  // 日本語：バックエンドから取得した実データをそのまま渡す
  notes: RecordingLight[];
  // 日本語：カードクリック時に親へ返す（詳細画面へ切替など）
  onNoteClick: (note: RecordingLight) => void;
}

export function NotesGrid({ notes, onNoteClick }: NotesGridProps) {
  // 日本語：タイトル／サマリを対象にした簡単検索
  const [searchQuery, setSearchQuery] = useState("");

  // 日本語：props の notes をそのまま使う（モックは使わない）
  const displayNotes = Array.isArray(notes) ? notes : [];

  const filteredNotes = displayNotes.filter((note) => {
    const title = (note.title ?? "").toLowerCase();
    // 日本語：RecordingLight には summary が無い想定なので any 経由であれば拾う
    const summary = ((note as any).summary ?? "").toLowerCase();
    const q = searchQuery.toLowerCase();
    return title.includes(q) || summary.includes(q);
  });

  return (
    <div className="space-y-6">
      {/* 検索ボックス */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <Input
          placeholder="ノートを検索..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* ノート一覧 */}
      <div className="space-y-4">
        {filteredNotes.map((note) => (
          <Card
            key={note.id}
            className="cursor-pointer transition-shadow hover:shadow-md"
            onClick={() => onNoteClick(note)}
          >
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="mb-1 text-xs text-gray-500">
                    {formatDate(note.created_at)}
                  </div>

                  <h3 className="mb-2 text-lg font-semibold text-gray-900">
                    {note.title}
                  </h3>

                  {/* 日本語：サマリを持っている場合のみ2行で表示 */}
                  {(note as any).summary && (
                    <p className="line-clamp-2 text-sm text-gray-600">
                      {(note as any).summary}
                    </p>
                  )}
                </div>

                <div className="text-sm text-gray-500">
                  {/* 日本語：分表示（存在する場合） */}
                  {note.duration_sec != null && note.duration_sec > 0
                    ? `${Math.round((note.duration_sec as number) / 60)} 分`
                    : ""}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredNotes.length === 0 && (
        <div className="py-12 text-center text-gray-500">ノートがありません</div>
      )}
    </div>
  );
}
