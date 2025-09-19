// src/components/study/QuizSession.tsx
"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Quiz } from "@/types";

type SessionStats = {
  correct: number;
  incorrect: number;
  totalAnswered: number;
  accuracy: number; // 0-100
};

interface QuizSessionProps {
  quizzes: Quiz[];
  onBack: () => void;
  /**
   * オプション: 回答時に true/false を親へ渡したい場合に使用（未使用でも可）
   * 親が CustomEvent で受け取る構成なら不要です。
   */
  onResult?: (isCorrect: boolean) => void;
  /**
   * オプション: 進捗（本セッション内の統計）を親へ渡す場合に使用
   */
  onProgress?: (stats: Omit<SessionStats, "accuracy">) => void;
}

export function QuizSession({
  quizzes,
  onBack,
  onResult,
  onProgress,
}: QuizSessionProps) {
  // 出題インデックス・表示制御
  const [idx, setIdx] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);

  // 本セッションの統計（画面上に表示）
  const [stats, setStats] = useState<Omit<SessionStats, "accuracy">>({
    correct: 0,
    incorrect: 0,
    totalAnswered: 0,
  });

  const accuracy = useMemo(
    () =>
      stats.totalAnswered === 0
        ? 0
        : Math.round((stats.correct / stats.totalAnswered) * 100),
    [stats]
  );

  const current = useMemo(() => quizzes[idx], [quizzes, idx]);
  const isLast = idx === quizzes.length - 1;

  // ---- 親(StudyTab)へ累積統計を通知（CustomEvent）----
  const dispatchGlobalStats = (next: Omit<SessionStats, "accuracy">) => {
    const detail: SessionStats = {
      ...next,
      accuracy:
        next.totalAnswered === 0
          ? 0
          : Math.round((next.correct / next.totalAnswered) * 100),
    };
    try {
      window.dispatchEvent(
        new CustomEvent<SessionStats>("quiz-stats:update", { detail })
      );
    } catch {
      // window が無い環境(SSR)はそもそも呼ばれない想定
    }
  };

  // ---- 回答ボタン（正解/不正解）----
  const mark = (result: "correct" | "incorrect") => {
    // 親へ単発結果（任意）
    onResult?.(result === "correct");

    setStats((prev) => {
      const next = {
        correct: prev.correct + (result === "correct" ? 1 : 0),
        incorrect: prev.incorrect + (result === "incorrect" ? 1 : 0),
        totalAnswered: prev.totalAnswered + 1,
      };

      // 親にセッション内の進捗をコールバック（任意）
      onProgress?.(next);

      // グローバル（親）に CustomEvent で累積を通知
      dispatchGlobalStats(next);

      return next;
    });

    // 次のカードへ
    if (!isLast) {
      setIdx((i) => i + 1);
      setShowAnswer(false);
    }
  };

  // ---- セッションリセット（表示だけ初期化。親の累積は触らない）----
  const resetSession = () => {
    setIdx(0);
    setShowAnswer(false);
    const init = { correct: 0, incorrect: 0, totalAnswered: 0 };
    setStats(init);
    // 画面上の統計だけを初期化する。親へはイベント送らない（累積は維持）
    onProgress?.(init);
  };

  // ---- 最終カードを解き切ったときに出す完了ビュー ----
  const finished =
    idx === quizzes.length - 1 && stats.totalAnswered >= quizzes.length;

  return (
    <div className="space-y-6">
      {/* 上部バー */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={onBack} className="flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" />
          戻る
        </Button>

        <div className="flex items-center gap-6 text-sm text-gray-600">
          <div>
            正解:{" "}
            <span className="font-semibold text-green-600">{stats.correct}</span>
          </div>
          <div>
            不正解:{" "}
            <span className="font-semibold text-red-600">{stats.incorrect}</span>
          </div>
          <div>
            総回答: <span className="font-semibold">{stats.totalAnswered}</span>
          </div>
          <div>
            正答率:{" "}
            <span className="font-semibold text-blue-600">{accuracy}%</span>
          </div>
        </div>

        <Button variant="outline" onClick={resetSession} className="flex items-center gap-2">
          <RotateCcw className="h-4 w-4" />
          リセット
        </Button>
      </div>

      {/* 進捗バー */}
      <div className="h-2 w-full rounded-full bg-gray-200">
        <div
          className="h-2 rounded-full bg-green-600 transition-all"
          style={{
            width: `${
              quizzes.length === 0 ? 0 : ((idx + 1) / quizzes.length) * 100
            }%`,
          }}
        />
      </div>

      {/* カード */}
      <Card className="select-none">
        <CardContent className="p-8">
          {/* 完了メッセージ */}
          {finished ? (
            <div className="flex flex-col items-center gap-6 py-8">
              <div className="text-2xl font-semibold text-gray-900">お疲れさま！</div>
              <div className="text-gray-600">
                {quizzes.length} 問を解きました。正答率 {accuracy}%。
              </div>
              <div className="flex gap-3">
                <Button onClick={resetSession} className="bg-green-600 hover:bg-green-700 text-white">
                  もう一度
                </Button>
                <Button variant="outline" onClick={onBack}>
                  一覧へ戻る
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="mb-4 flex items-center justify-between">
                <div className="rounded-full border px-3 py-1 text-xs text-gray-600">
                  {current?.category ?? "general"}
                </div>
                <div className="text-sm text-gray-500">
                  {idx + 1} / {quizzes.length}
                </div>
              </div>

              <div
                className="cursor-pointer rounded-lg border bg-white p-8 text-center shadow-sm hover:shadow"
                onClick={() => setShowAnswer((v) => !v)}
              >
                <div className="mb-2 text-sm text-gray-500">
                  {showAnswer ? "答え" : "問題"}
                </div>
                <div className="leading-relaxed text-lg font-medium text-gray-900">
                  {showAnswer ? current.answer : current.question}
                </div>
                <div className="mt-3 text-xs text-gray-400">
                  カードをクリックして{showAnswer ? "問題" : "答え"}を表示
                </div>
              </div>

              <div className="mt-6 flex items-center justify-between">
                <Button variant="outline" onClick={() => setShowAnswer((v) => !v)}>
                  {showAnswer ? "問題を見る" : "答えを見る"}
                </Button>

                <div className="flex items-center gap-2">
                  <Button
                    className="bg-green-600 text-white hover:bg-green-700"
                    onClick={() => mark("correct")}
                  >
                    正解
                  </Button>
                  <Button variant="destructive" onClick={() => mark("incorrect")}>
                    不正解
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default QuizSession;
