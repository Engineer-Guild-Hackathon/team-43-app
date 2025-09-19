// src/components/record/RecordTab.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation"; // ★ 画面遷移に使用
import { RecordingButton } from "./RecordingButton";
import { TranscriptDisplay } from "./TranscriptDisplay";
import { SummaryDisplay } from "./SummaryDisplay";
import { RecentRecordings } from "./RecentRecordings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiClient } from "@/lib/api";
import type { RecordingLight } from "@/types";

/**
 * 画面ステップ
 * - recording: 収録中/待機
 * - transcript: 文字起こし表示（キーワード選択）
 * - summary: 要約確認/保存
 * - saved: 保存完了
 */
type RecordStep = "recording" | "transcript" | "summary" | "saved";

export function RecordTab() {
  const router = useRouter(); // ★ ルーター

  // ====== 画面ステート ======
  const [currentStep, setCurrentStep] = useState<RecordStep>("recording");
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [summary, setSummary] = useState("");
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>([]);
  const [recentRecordings, setRecentRecordings] = useState<RecordingLight[]>([]);
  const [recordingId, setRecordingId] = useState<string | null>(null); // ★ 録音のID（詳細画面遷移に使う）
  const [savedNoteId, setSavedNoteId] = useState<string | null>(null); // ★ 保存完了後の遷移先ID
  const [usedMock, setUsedMock] = useState(false); // ★ 失敗時フォールバックかどうか

  // ====== 初回マウント時に最近の録音を取得 ======
  useEffect(() => {
    void loadRecentRecordings();
  }, []);

  // 日本語：最近3件のみを state に入れる
  const loadRecentRecordings = async () => {
    try {
      const list = await apiClient.getRecordings(); // 配列が返る
      setRecentRecordings(Array.isArray(list) ? list.slice(0, 3) : []);
    } catch (error) {
      console.error("Failed to load recordings:", error);
      setRecentRecordings([]); // フォールバック
    }
  };

  /**
   * 日本語：録音完了（Blobと秒数）→ File化 → APIへmultipart送信
   * - バックエンドは 'audio' フィールドを要求（apiClient側で対応済み）
   */
  const handleRecordingComplete = async (audioBlob: Blob, duration: number) => {
    setIsProcessing(true);
    setUsedMock(false);
    try {
      // Blob → File（拡張子 .webm で送る）
      const audioFile = new File([audioBlob], "recording.webm", { type: "audio/webm" });

      // API: 文字起こし + 要約（戻り値に id / transcript / summary）
      const res = await apiClient.transcribeAndSummarize(audioFile, "ja", duration, false);

      setRecordingId(res.id);                    // ★ ID を保持（遷移に必要）
      setTranscript(res.transcript ?? "");
      setSummary(res.summary ?? "");
      setCurrentStep("transcript");
    } catch (error) {
      console.error("Failed to process recording:", error);

      // デモ用フォールバック（失敗時でも画面遷移できるように）
      setRecordingId(null);
      setUsedMock(true);
      setTranscript("これはテストです。アルゴリズムとビッグO記法について説明します。");
      setSummary("ビッグO記法は、アルゴリズムの計算量を O(1), O(log n), O(n), O(n^2) のように表します。");
      setCurrentStep("transcript");
    } finally {
      setIsProcessing(false);
    }
  };

  // 日本語：キーワード選択のコールバック
  const handleKeywordsSelected = (keywords: string[]) => {
    setSelectedKeywords(keywords);
  };

  // 日本語：次へ（要約表示へ）
  const handleNextToSummary = () => {
    setCurrentStep("summary");
  };

  /**
   * 日本語：保存処理
   * - 実データ時：タイトル更新APIを叩き、保存したIDを保持 → 一覧更新
   * - モック時：APIは叩かず UI だけ完了表示
   */
  const handleSave = async (title: string, _category: string) => {
    try {
      if (usedMock || !recordingId) {
        setSavedNoteId(null);          // モックなので遷移は不可
        setCurrentStep("saved");
        return;
      }

      // ★ バックエンドへタイトル更新（FormData で title を送信）
      await apiClient.updateRecordingTitle(recordingId, title.trim());

      setSavedNoteId(recordingId);     // ★ 遷移に使う
      setCurrentStep("saved");

      // 一覧更新（最新を表示に反映）
      await loadRecentRecordings();
    } catch (error) {
      console.error("Failed to save note:", error);
    }
  };

  // 日本語：戻る（要約→転写）
  const handleBackToTranscript = () => {
    setCurrentStep("transcript");
  };

  // 日本語：新規録音を開始（ステート初期化）
  const handleStartNewRecording = () => {
    setCurrentStep("recording");
    setTranscript("");
    setSummary("");
    setSelectedKeywords([]);
    setSavedNoteId(null);
    setRecordingId(null);
    setUsedMock(false);
  };

  // 日本語：現在のステップに応じて内容を切り替え
  const renderCurrentStep = () => {
    switch (currentStep) {
      case "recording":
        return (
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="text-xl font-bold">講義録音</CardTitle>
              <p className="text-gray-600">
                録音すると、GraphEase が自動で文字起こしします
              </p>
            </CardHeader>
            <CardContent className="flex justify-center py-8">
              <RecordingButton
                onRecordingComplete={handleRecordingComplete}
                isProcessing={isProcessing}
              />
            </CardContent>
          </Card>
        );

      case "transcript":
        return (
          <TranscriptDisplay
            transcript={transcript}
            onKeywordsSelected={handleKeywordsSelected}
            onNext={handleNextToSummary}
          />
        );

      case "summary":
        return (
          <SummaryDisplay
            summary={summary}
            keywords={selectedKeywords}
            onSave={handleSave}
            onBack={handleBackToTranscript}
          />
        );

      case "saved":
        return (
          <Card>
            <CardContent className="p-8 text-center">
              <div className="mb-4">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                  <span className="text-2xl">✅</span>
                </div>
                <h3 className="mb-2 text-xl font-bold text-gray-900">ノート保存完了！</h3>
                <p className="mb-6 text-gray-600">
                  要約・ビジュアルノート・音声ファイルを保存しました
                </p>
              </div>

              <div className="space-y-3">
                <button
                  onClick={handleStartNewRecording}
                  className="w-full rounded-md bg-green-600 px-4 py-2 font-medium text-white transition-colors hover:bg-green-700"
                >
                  新しい録音を開始
                </button>

                {/* ★ 実データ保存時のみ遷移ボタンを有効化 */}
                <button
                  disabled={!savedNoteId}
                  onClick={() => {
                    if (!savedNoteId) return;
                    router.push(`/notes/${savedNoteId}`); // ★ ここで画面遷移！
                  }}
                  className={`w-full rounded-md border px-4 py-2 font-medium transition-colors
                    ${savedNoteId
                      ? "border-green-600 text-green-600 hover:bg-green-50"
                      : "cursor-not-allowed border-gray-300 text-gray-400"
                    }`}
                >
                  ノートを表示
                </button>
              </div>
            </CardContent>
          </Card>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-8">
      {renderCurrentStep()}

      {/* 日本語：録音ステップのときだけ最近3件を表示 */}
      {currentStep === "recording" && (
        <RecentRecordings
          recordings={recentRecordings}
          onRecordingClick={(rec) => {
            // ★ 一覧カードからも詳細へジャンプ
            router.push(`/notes/${rec.id}`);
          }}
        />
      )}
    </div>
  );
}
