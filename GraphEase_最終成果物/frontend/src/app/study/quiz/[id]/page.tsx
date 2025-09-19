// src/app/study/quiz/[id]/page.tsx
"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { QuizSession } from "@/components/study/QuizSession";
import type { Quiz } from "@/types";

/**
 * 日本語：
 * - このページは、クエリやモックから Quiz[] を組み立てて QuizSession に渡すだけの“フラッシュカード版”です。
 * - 本番では API から該当クイズを fetch して quizzes を作ってください。
 */
export default function QuizFlashcardPage() {
  const sp = useSearchParams();
  const title = sp.get("title") ?? "クイズ";
  const category = sp.get("category") ?? "学習";

  // デモ用：モック1問を作成（本番は API で quizzes を取得）
  const quizzes: Quiz[] = useMemo(
    () => [
      {
        id: "demo-1",
        question: `${category} - ${title}：波動関数とは何ですか？`,
        answer:
          "波動関数は量子系の状態を記述する関数で、粒子の位置や運動量の確率分布を与える。",
        category,
        noteId: "n/a",
        noteTitle: title,
      },
    ],
    [title, category]
  );

  // 一覧に戻る動作（今回は history back）
  const [toggle, setToggle] = useState(false);
  const onBack = () => history.back();

  return <QuizSession quizzes={quizzes} onBack={onBack} />;
}
