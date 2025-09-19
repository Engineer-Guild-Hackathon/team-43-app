// src/components/notes/NoteDetail.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Edit, Pause, Play, Save, Volume2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { Recording } from "@/types";
import { formatDuration } from "@/lib/utils";
import { apiClient } from "@/lib/api";
import { VisualNote } from "@/components/notes/VisualNote";

interface NoteDetailProps {
  note: Recording;
  onBack: () => void;
  onCreateQuiz: (noteId: string, noteTitle: string, summary: string) => void;
}

export function NoteDetail({ note, onBack, onCreateQuiz }: NoteDetailProps) {
  // ====== 再生制御 ======
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState<number>(note.duration_sec ?? 0);

  // rAF で進捗を滑らかに同期
  const tickRef = useRef<number | null>(null);
  const startTicker = () => {
    if (!audioRef.current) return;
    const loop = () => {
      if (audioRef.current) setCurrentTime(audioRef.current.currentTime || 0);
      tickRef.current = requestAnimationFrame(loop);
    };
    if (tickRef.current == null) tickRef.current = requestAnimationFrame(loop);
  };
  const stopTicker = () => {
    if (tickRef.current != null) {
      cancelAnimationFrame(tickRef.current);
      tickRef.current = null;
    }
  };
  useEffect(() => () => stopTicker(), []);

  // ====== タイトル編集 ======
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState(note.title);

  // ====== 編集フォーム（要約/カテゴリ） ======
  const originalSummary = note.summary ?? "";
  const [editSummary, setEditSummary] = useState(originalSummary);
  const [editCategory, setEditCategory] = useState<string>(
    ((note as any)?.category as string | undefined) ?? "general"
  );
  const [saving, setSaving] = useState(false);

  // ====== セグメント強調表示 ======
  const [highlightedSegment, setHighlightedSegment] = useState<number | null>(null);

  const transcript = note.transcript ?? "";
  const segments: Array<{ start?: number; text?: string }> = Array.isArray(note.segments)
    ? (note.segments as any[])
    : [];

  // --- 再生/一時停止 ---
  const handlePlayPause = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      stopTicker();
    } else {
      if (!Number.isFinite(audio.duration) || audio.duration === 0) {
        audio.load();
      }
      audio.play();
      setIsPlaying(true);
      startTicker();
    }
  };

  // --- セグメントクリック ---
  const handleSegmentClick = (seg: { start?: number }, index: number) => {
    setHighlightedSegment(index);
    const audio = audioRef.current;
    if (audio && typeof seg.start === "number") {
      audio.currentTime = seg.start;
      setCurrentTime(seg.start);
      if (!isPlaying) {
        audio.play();
        setIsPlaying(true);
        startTicker();
      }
    }
  };

  // --- タイトル保存 ---
  const handleSaveTitle = async () => {
    try {
      const newTitle = editedTitle.trim();
      if (!newTitle) return;
      await apiClient.updateRecordingTitle(note.id, newTitle);
      setIsEditingTitle(false);
    } catch (e) {
      console.error("Failed to update title:", e);
    }
  };

  // --- ノート全体の保存（要約/カテゴリ） ---
  const handleSaveNote = async () => {
    try {
      setSaving(true);
      await apiClient.updateRecording(note.id, {
        summary: editSummary,
        category: editCategory,
      });
      alert("ノートを更新しました");
    } catch (e) {
      console.error("Failed to save note:", e);
      alert("保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  // --- TTS ---
  const handleTTSPlay = () => {
    window.open(apiClient.getTtsUrl(note.id, "summary"), "_blank");
  };

  // --- クイズ作成（編集後の要約を渡す） ---
  const handleCreateQuizClick = () => {
    const summaryForQuiz = (editSummary || originalSummary || "").trim();
    onCreateQuiz(note.id, editedTitle, summaryForQuiz);
  };

  return (
    <div className="space-y-6">
      {/* ヘッダーバー */}
      <div className="flex items-center justify-between">
        <Button onClick={onBack} variant="ghost" className="flex items-center space-x-2">
          <ArrowLeft className="h-4 w-4" />
          <span>戻る</span>
        </Button>

        <div className="flex items-center space-x-2">
          <Button
            onClick={handleCreateQuizClick}
            className="bg-green-600 text-white hover:bg-green-700"
          >
            クイズを作成
          </Button>
        </div>
      </div>

      {/* タイトル編集 */}
      <div className="flex items-center space-x-3">
        {isEditingTitle ? (
          <div className="flex flex-1 items-center space-x-2">
            <Input
              value={editedTitle}
              onChange={(e) => setEditedTitle(e.target.value)}
              className="text-xl font-bold"
            />
            <Button onClick={handleSaveTitle} size="sm">
              <Save className="h-4 w-4" />
            </Button>
            <Button
              onClick={() => {
                setIsEditingTitle(false);
                setEditedTitle(note.title);
              }}
              variant="ghost"
              size="sm"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="flex flex-1 items-center space-x-3">
            <h1 className="text-2xl font-bold text-gray-900">{editedTitle}</h1>
            <Button onClick={() => setIsEditingTitle(true)} variant="ghost" size="sm">
              <Edit className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* 録音音声（進捗バー同期版） */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">録音音声</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex w-full items-center gap-4">
            {/* 再生/一時停止 */}
            <Button
              onClick={handlePlayPause}
              variant="outline"
              size="sm"
              className="flex items-center gap-2 shrink-0"
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              <span>{isPlaying ? "一時停止" : "再生"}</span>
            </Button>

            {/* 進行バー（実 duration で同期、はみ出し防止） */}
            <div className="min-w-0 flex-1">
              <div className="relative h-2 w-full overflow-hidden rounded-full bg-gray-200">
                <div
                  className="absolute inset-y-0 left-0 bg-green-600 transition-[width] duration-100"
                  style={{
                    width: `${
                      Math.min(
                        100,
                        Math.max(
                          0,
                          ((currentTime || 0) /
                            Math.max(1, duration || note.duration_sec || 1)) *
                            100
                        )
                      )
                    }%`,
                  }}
                />
              </div>
            </div>

            {/* 時間表示 */}
            <span className="shrink-0 font-mono text-xs text-gray-600 md:text-sm">
              {formatDuration(currentTime)} / {formatDuration(duration || note.duration_sec)}
            </span>
          </div>

          {/* 実音声 */}
          <audio
            ref={audioRef}
            className="hidden"
            src={apiClient.getRecordingAudioUrl(note.id)}
            onLoadedMetadata={(e) => {
              const a = e.target as HTMLAudioElement;
              setDuration(Number.isFinite(a.duration) ? a.duration : (note.duration_sec ?? 0));
            }}
            onTimeUpdate={(e) => {
              const a = e.target as HTMLAudioElement;
              setCurrentTime(a.currentTime || 0); // Safari フォールバック
            }}
            onPlay={() => {
              setIsPlaying(true);
              startTicker();
            }}
            onPause={() => {
              setIsPlaying(false);
              stopTicker();
            }}
            onEnded={() => {
              setIsPlaying(false);
              stopTicker();
              setCurrentTime(duration || currentTime);
            }}
          />
        </CardContent>
      </Card>

      {/* 本文グリッド */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* 文字起こし */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">文字起こし</CardTitle>
          </CardHeader>
          <CardContent>
            {segments.length > 0 ? (
              <div className="max-h-96 space-y-3 overflow-y-auto">
                {segments.map((seg, idx) => (
                  <div
                    key={idx}
                    onClick={() => handleSegmentClick(seg, idx)}
                    className={`cursor-pointer rounded-lg p-3 transition-colors ${
                      highlightedSegment === idx
                        ? "border-2 border-green-300 bg-green-100"
                        : "bg-gray-50 hover:bg-gray-100"
                    }`}
                  >
                    <div className="flex items-start space-x-3">
                      <span className="mt-1 font-mono text-xs text-gray-500">
                        {formatDuration(seg.start ?? 0)}
                      </span>
                      <p className="flex-1 text-sm leading-relaxed text-gray-800">{seg.text ?? ""}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="max-h-96 overflow-y-auto rounded-lg bg-gray-50 p-4 text-sm leading-relaxed text-gray-800">
                {transcript || "文字起こしはありません"}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 要約 + 編集フォーム */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">要約</CardTitle>
            <Button onClick={handleTTSPlay} variant="outline" size="sm" className="flex items-center space-x-2">
              <Volume2 className="h-4 w-4" />
              <span>読み上げ</span>
            </Button>
          </CardHeader>
          <CardContent>
            <textarea
              className="w-full rounded-md border p-2 text-sm"
              rows={5}
              value={editSummary}
              onChange={(e) => setEditSummary(e.target.value)}
            />
            <div className="mt-3 flex items-center space-x-2">
              <Input
                value={editCategory}
                onChange={(e) => setEditCategory(e.target.value)}
                placeholder="カテゴリ"
                className="flex-1"
              />
              <Button onClick={handleSaveNote} disabled={saving}>
                {saving ? "保存中..." : "保存"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ビジュアルノート（要約の下に表示） */}
      <Card className="mt-2">
        <CardHeader>
          <CardTitle className="text-lg">ビジュアルノート</CardTitle>
        </CardHeader>
        <CardContent>
          <VisualNote summary={editSummary || originalSummary} keywords={[]} />
        </CardContent>
      </Card>
    </div>
  );
}
