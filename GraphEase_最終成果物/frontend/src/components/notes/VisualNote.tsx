// src/components/notes/VisualNote.tsx
"use client";

import { Card, CardContent } from "@/components/ui/card";

/**
 * 日本語コメント：
 * - 与えられた要約テキスト（summary）から、見出しや箇条書きを“簡易ルール”で抽出して
 *   ビジュアルノート風に表示します（完全固定文言を廃止）
 * - 追加情報として keywords を渡すと、強調表示に使います（任意）
 */
type Props = {
  summary: string;
  keywords?: string[];
};

// 日本語コメント：句点・改行で分割して空要素を除去
function splitSentences(text: string): string[] {
  return (text || "")
    .replace(/\r\n/g, "\n")
    .split(/[。\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// 日本語コメント：セクションを簡易分類（超シンプルなルールベース）
function classify(sent: string): "title" | "point" | "app" | "note" | "other" {
  const s = sent.toLowerCase();
  if (/(とは|とは何|定義|概要|入門)/.test(sent)) return "title";
  if (/(ポイント|重要|特徴|利点|メリット|要点|まとめ)/.test(sent) || /o\(|オーダー|計算量|複雑さ/.test(sent))
    return "point";
  if (/(応用|活用|使い道|ユースケース|例|具体例)/.test(sent)) return "app";
  if (/(注意|課題|欠点|デメリット|限界|注意点)/.test(sent)) return "note";
  if (s.startsWith("例えば") || s.startsWith("たとえば")) return "app";
  return "other";
}

// 日本語コメント：キーワードを含む場合は <mark> で強調
function highlight(text: string, keywords?: string[]) {
  if (!keywords || keywords.length === 0) return text;
  let result = text;
  for (const k of keywords) {
    if (!k) continue;
    const esc = k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    result = result.replace(new RegExp(`(${esc})`, "gi"), "<mark>$1</mark>");
  }
  return result;
}

export function VisualNote({ summary, keywords = [] }: Props) {
  // 日本語コメント：文を分解 → 簡易分類
  const sentences = splitSentences(summary);
  const titleCand =
    sentences.find((s) => classify(s) === "title") || sentences[0] || "ノート";

  const points = sentences.filter((s) => classify(s) === "point").slice(0, 5);
  const apps = sentences.filter((s) => classify(s) === "app").slice(0, 5);
  const notes = sentences.filter((s) => classify(s) === "note").slice(0, 5);

  // 日本語コメント：どの分類にも入らなかった文はポイントに混ぜる（最大5件）
  const others = sentences.filter((s) => classify(s) === "other");
  while (points.length < 3 && others.length) {
    points.push(others.shift()!);
  }

  return (
    <Card>
      <CardContent className="p-5">
        {/* タイトル */}
        <div className="mb-4 text-lg font-semibold">
          📚 <span dangerouslySetInnerHTML={{ __html: highlight(titleCand, keywords) }} />
        </div>

        {/* ペールな背景の中にボディ */}
        <div className="rounded-xl bg-gradient-to-br from-green-50 to-emerald-50 p-4">
          {/* 主要ポイント */}
          {points.length > 0 && (
            <div className="mb-4">
              <div className="mb-2 font-medium">🔎 主要ポイント:</div>
              <ul className="list-disc space-y-1 pl-5 text-[0.95rem] text-gray-800">
                {points.map((p, i) => (
                  <li key={`p-${i}`} dangerouslySetInnerHTML={{ __html: highlight(p, keywords) }} />
                ))}
              </ul>
            </div>
          )}

          {/* 応用・使いどころ */}
          {apps.length > 0 && (
            <div className="mb-2">
              <div className="mb-2 font-medium">⚡ 実用的な応用:</div>
              <ul className="list-disc space-y-1 pl-5 text-[0.95rem] text-gray-800">
                {apps.map((a, i) => (
                  <li key={`a-${i}`} dangerouslySetInnerHTML={{ __html: highlight(a, keywords) }} />
                ))}
              </ul>
            </div>
          )}

          {/* 注意点 */}
          {notes.length > 0 && (
            <div className="mt-3">
              <div className="mb-2 font-medium">⚠️ 注意点:</div>
              <ul className="list-disc space-y-1 pl-5 text-[0.95rem] text-gray-800">
                {notes.map((n, i) => (
                  <li key={`n-${i}`} dangerouslySetInnerHTML={{ __html: highlight(n, keywords) }} />
                ))}
              </ul>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
