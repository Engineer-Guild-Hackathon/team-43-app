// =========================
// 録音系
// =========================
export interface Recording {
  id: string;
  title: string;
  created_at: string;
  duration_sec?: number;
  transcript?: string;
  segments?: Array<{
    start: number;
    end: number;
    text: string;
  }>;
  summary?: string;
  audio_path?: string;
  highlights?: Array<{
    text: string;
    weight: number;
  }>;
  category?: string; // 追加しておくと後段で便利
}

export interface RecordingLight {
  id: string;
  title: string;
  created_at: string;
  duration_sec?: number;
  category?: string;
}

export interface TranscribeResponse {
  id: string;
  transcript: string;
  summary: string;
}

export interface ApiResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
}

// =========================
// 旧：1問だけのクイズ型（必要なら残す）
// 以前 `interface Quiz` だったものを改名
// =========================
export interface NoteQuizItem {
  id: string;
  question: string;
  answer: string;
  category: string;
  noteId: string;
  noteTitle: string;
}

// =========================
// 新：クイズ機能（一覧／詳細）
// =========================

// 一覧表示用の軽量型
export type QuizLight = {
  id: string;
  title: string;
  category: string;
  difficulty: "easy" | "normal" | "hard" | string;
  num_questions: number;
  created_at?: string;
};

// 詳細（実際の設問を含む）
export type Quiz = QuizLight & {
  questions: Array<
    | { type: "cloze"; q: string; a: string; difficulty: string }
    | { type: "bool"; q: string; a: "正しい" | "誤り"; difficulty: string }
    | { type: "short"; q: string; a: string; difficulty: string }
  >;
};
