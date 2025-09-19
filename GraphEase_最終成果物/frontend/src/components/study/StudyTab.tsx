// src/components/study/StudyTab.tsx
"use client";

import { useEffect, useMemo, useState, startTransition } from "react";
import { Plus, RotateCcw } from "lucide-react";

import { apiClient } from "@/lib/api";
import type { QuizLight, Quiz } from "@/types";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import NewQuizFromNoteDialog from "./NewQuizFromNoteDialog";
import { QuizSession } from "./QuizSession";

// ---- 成績の保存キー（localStorage 共有）----
const LS_KEY = "quiz:stats";

// 成績の型
type Stats = {
  correct: number;
  incorrect: number;
  totalAnswered: number;
  accuracy: number; // 0-100
};

// 初期値
const defaultStats: Stats = { correct: 0, incorrect: 0, totalAnswered: 0, accuracy: 0 };

export function StudyTab() {
  // ====== 一覧・状態 ======
  const [quizzes, setQuizzes] = useState<QuizLight[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  // フラッシュカードをこのタブ内で表示するための状態
  const [selectedQuizzes, setSelectedQuizzes] = useState<Quiz[] | null>(null);

  // 成績（累積）— 画面またぎで保持
  const [stats, setStats] = useState<Stats>(defaultStats);

  // 新規作成ダイアログ
  const [openNew, setOpenNew] = useState(false);

  // ====== 1) 起動時に前回の成績を復元 ======
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<Stats>;
        setStats({
          correct: parsed.correct ?? 0,
          incorrect: parsed.incorrect ?? 0,
          totalAnswered: parsed.totalAnswered ?? 0,
          accuracy: parsed.accuracy ?? 0,
        });
      }
    } catch {
      /* noop */
    }
  }, []);

  // ====== 2) 出題画面（QuizSession）からの成績更新イベントを受け取る ======
  useEffect(() => {
    const onUpdate = (e: Event) => {
      const detail = (e as CustomEvent).detail as Stats | undefined;
      if (!detail) return;

      // レンダリング中の setState 警告を避けるため、描画後にスケジュール
      setTimeout(() => {
        startTransition(() => {
          setStats(detail);
          try {
            localStorage.setItem(LS_KEY, JSON.stringify(detail));
          } catch {
            /* noop */
          }
        });
      }, 0);
    };

    window.addEventListener("quiz-stats:update", onUpdate as EventListener);
    return () => window.removeEventListener("quiz-stats:update", onUpdate as EventListener);
  }, []);

  // ====== 一覧ロード ======
  const load = async () => {
    try {
      setLoading(true);
      const res = await apiClient.getQuizzes(); // { quizzes: QuizLight[] } を期待
      setQuizzes(res?.quizzes ?? []);
    } catch (e) {
      console.error("failed to load quizzes:", e);
      setQuizzes([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  // ====== カテゴリ集計（ボタン用） ======
  const categories = useMemo(() => {
    const map = new Map<string, number>();
    for (const q of quizzes) {
      const key = q.category || "general";
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    const items = Array.from(map.entries()).map(([id, count]) => ({ id, label: id, count }));
    return [{ id: "all", label: "すべて", count: quizzes.length }, ...items];
  }, [quizzes]);

  // ====== 絞り込み後の一覧 ======
  const filtered = useMemo(() => {
    if (selectedCategory === "all") return quizzes;
    return quizzes.filter((q) => (q.category || "general") === selectedCategory);
  }, [quizzes, selectedCategory]);

  // ====== 成績リセット（ユーザー操作のみ） ======
  const handleResetStats = () => {
    setStats(defaultStats);
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(defaultStats));
    } catch {
      /* noop */
    }
  };

  // ====== クイズ開始：詳細を取りに行き、フラッシュカード形式へ変換 ======
  const handleStartQuiz = async (q: QuizLight) => {
    try {
      const detail = await apiClient.getQuiz(q.id);

      const cards: Quiz[] =
        Array.isArray((detail as any).questions) && (detail as any).questions.length > 0
          ? (detail as any).questions.map((item: any, idx: number) => ({
              id: `${q.id}-${idx + 1}`,
              question: String(item?.q ?? ""),
              answer: String(item?.a ?? ""),
              category: q.category || "general",
              noteId: (detail as any).noteId || "",
              noteTitle: q.title,
            }))
          : [
              {
                id: `${q.id}-only`,
                question: `${q.title}：問題が見つかりませんでした。`,
                answer: "クイズ詳細 API から questions が返っていません。",
                category: q.category || "general",
                noteId: "",
                noteTitle: q.title,
              },
            ];

      setSelectedQuizzes(cards); // これで QuizSession を表示
    } catch (e) {
      console.error("failed to start quiz:", e);
      setSelectedQuizzes([
        {
          id: `${q.id}-demo`,
          question: `${q.title}：フラッシュカードの表示テストですか？`,
          answer: "はい。API取得に失敗した場合のフォールバックです。",
          category: q.category || "general",
          noteId: "",
          noteTitle: q.title,
        },
      ]);
    }
  };

  // ====== フラッシュカード表示（内部で CustomEvent を投げる想定） ======
  if (selectedQuizzes) {
    return (
      <QuizSession
        quizzes={selectedQuizzes}
        onBack={() => setSelectedQuizzes(null)}
        // （オプション）もし QuizSession が onResult をサポートしているなら、ここで累積反映も可能
        // onResult={(isCorrect) => {
        //   const next = (() => {
        //     const correct = stats.correct + (isCorrect ? 1 : 0);
        //     const incorrect = stats.incorrect + (!isCorrect ? 1 : 0);
        //     const totalAnswered = stats.totalAnswered + 1;
        //     const accuracy = totalAnswered ? Math.round((correct / totalAnswered) * 100) : 0;
        //     return { correct, incorrect, totalAnswered, accuracy };
        //   })();
        //   setStats(next);
        //   try { localStorage.setItem(LS_KEY, JSON.stringify(next)); } catch {}
        // }}
      />
    );
  }

  // ====== 一覧画面 ======
  if (loading) {
    return <div className="p-6 text-gray-500">読み込み中…</div>;
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{stats.correct}</div>
            <div className="text-sm text-gray-600">正解</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-red-600">{stats.incorrect}</div>
            <div className="text-sm text-gray-600">不正解</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-gray-900">{stats.totalAnswered}</div>
            <div className="text-sm text-gray-600">総回答数</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{stats.accuracy}%</div>
            <div className="text-sm text-gray-600">正答率</div>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <Button
              key={c.id}
              onClick={() => setSelectedCategory(c.id)}
              variant={selectedCategory === c.id ? "default" : "outline"}
              className={selectedCategory === c.id ? "bg-green-600 hover:bg-green-700" : ""}
            >
              {c.label} ({c.count})
            </Button>
          ))}
        </div>

        <Button onClick={handleResetStats} variant="outline" className="flex items-center gap-2">
          <RotateCcw className="h-4 w-4" />
          <span>リセット</span>
        </Button>
      </div>

      {/* Quiz Cards */}
      {filtered.length === 0 ? (
        <div className="rounded-lg border bg-white p-6 text-center text-gray-600">
          このカテゴリのクイズはありません。
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((q) => (
            <Card key={q.id} className="transition-shadow hover:shadow-md">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="mb-1 flex items-center gap-2 text-sm text-gray-500">
                      <span className="inline-block rounded-full border px-2 py-0.5 text-xs">
                        {q.category}
                      </span>
                      <span className="inline-block rounded-full border px-2 py-0.5 text-xs">
                        {q.difficulty}
                      </span>
                      {q.created_at && (
                        <span className="text-xs text-gray-400">
                          {new Date(q.created_at).toLocaleString()}
                        </span>
                      )}
                    </div>

                    <div className="mb-1 text-lg font-semibold">{q.title}</div>
                    <div className="mb-3 text-gray-600">問題数: {q.num_questions}</div>
                  </div>

                  <Button
                    className="bg-green-600 text-white hover:bg-green-700"
                    onClick={() => handleStartQuiz(q)}
                  >
                    開始
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Quiz Button */}
      <Card
        role="button"
        onClick={() => setOpenNew(true)}
        className="cursor-pointer border-2 border-dashed border-gray-300 transition-colors hover:border-green-400"
      >
        <CardContent className="p-8 text-center">
          <div className="flex flex-col items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <Plus className="h-6 w-6 text-green-600" />
            </div>
            <h3 className="text-lg font-medium text-gray-900">新しいクイズを作成</h3>
            <p className="text-sm text-gray-600">ノートから新しいクイズを作成できます</p>
          </div>
        </CardContent>
      </Card>

      {/* 作成ダイアログ（成功時に一覧を再読込） */}
      <NewQuizFromNoteDialog open={openNew} onOpenChange={setOpenNew} onCreated={load} />
    </div>
  );
}

export default StudyTab;
