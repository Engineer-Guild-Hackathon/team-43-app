// src/lib/api.ts
// 日本語コメント：フロントからバックエンドAPIを叩くクライアント
// JSON と multipart のヘッダの違いに注意。

import {
  Recording,
  RecordingLight,
  TranscribeResponse,
  QuizLight,
  Quiz,
} from "@/types";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000";

export class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE) {
    this.baseUrl = baseUrl;
  }

  // ---- 共通: JSON リクエスト ----
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const res = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`API Error ${res.status}: ${text || res.statusText}`);
    }
    if (res.status === 204) return undefined as unknown as T;
    return (await res.json()) as T;
  }

  // ---- 共通: multipart/form-data（Content-Type は付けない）----
  private async requestFormData<T>(endpoint: string, formData: FormData): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const res = await fetch(url, { method: "POST", body: formData });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`API Error ${res.status}: ${text || res.statusText}`);
    }
    return (await res.json()) as T;
  }

  // ---- Health ----
  async health(): Promise<string> {
    const res = await fetch(`${this.baseUrl}/`, { method: "GET" });
    if (!res.ok) throw new Error(`Health Error ${res.status}`);
    return res.text();
  }

  // ---- 録音 → 文字起こし/要約 ----
  async transcribeAndSummarize(
    file: File,
    language: string = "ja",
    durationSec?: number,
    useRag: boolean = false
  ): Promise<TranscribeResponse> {
    const formData = new FormData();
    formData.append("audio", file); // ★ バックエンドは 'audio' を期待
    formData.append("language", language);
    if (durationSec != null) formData.append("duration_sec", String(durationSec));
    formData.append("use_rag", String(useRag));
    return this.requestFormData<TranscribeResponse>("/api/transcribe_and_summarize", formData);
  }

  // ---- 録音一覧 ----
  async getRecordings(): Promise<RecordingLight[]> {
    return this.request<RecordingLight[]>("/api/recordings");
  }

  // ---- 録音詳細 ----
  async getRecording(id: string): Promise<Recording> {
    return this.request<Recording>(`/api/recordings/${id}`);
  }

  // ---- 録音音声URL ----
  getRecordingAudioUrl(id: string): string {
    return `${this.baseUrl}/api/recordings/${id}/audio`;
  }

  // ---- タイトル更新（Form）----
  async updateRecordingTitle(id: string, title: string): Promise<{ ok: boolean }> {
    const fd = new FormData();
    fd.append("title", title);
    return this.requestFormData<{ ok: boolean }>(`/api/recordings/${id}/title`, fd);
  }

  // ---- 録音の部分更新（任意フィールド）----
  async updateRecording(
    id: string,
    fields: { title?: string; summary?: string; transcript?: string; category?: string }
  ): Promise<{ ok: boolean; record: any }> {
    const form = new FormData();
    if (fields.title !== undefined) form.append("title", fields.title);
    if (fields.summary !== undefined) form.append("summary", fields.summary);
    if (fields.transcript !== undefined) form.append("transcript", fields.transcript);
    if (fields.category !== undefined) form.append("category", fields.category);
    return this.requestFormData(`/api/recordings/${id}/update`, form);
  }

  // ---- 重み付き再要約（JSON）----
  async resummarizeFromText(
    id: string,
    text: string,
    boost: number = 2.0
  ): Promise<{ ok: boolean; summary: string; highlights: Array<{ text: string; weight: number }> }> {
    return this.request(`/api/recordings/${id}/resummarize_from_text`, {
      method: "POST",
      body: JSON.stringify({ text, boost }),
    });
  }

  // ---- TTS URL ----
  getTtsUrl(id: string, field: string = "summary"): string {
    return `${this.baseUrl}/api/tts/${id}?field=${encodeURIComponent(field)}`;
  }

  // ---- RAG 資料アップロード ----
  async uploadMaterial(file: File, title?: string): Promise<{ ok: boolean; error?: string }> {
    const formData = new FormData();
    formData.append("file", file);
    if (title) formData.append("title", title);
    return this.requestFormData<{ ok: boolean; error?: string }>("/api/materials/upload", formData);
  }

  // ---- クイズ関連 ----
  async createQuizFromSummary(params: {
    recordingId?: string;
    title: string;
    summary: string;
    category?: string;
    difficulty?: "easy" | "normal" | "hard";
  }): Promise<{ ok: boolean; quiz: { id: string; title: string; category: string; difficulty: string; num_questions: number } }> {
    const fd = new FormData();
    if (params.recordingId) fd.append("recording_id", params.recordingId);
    fd.append("title", params.title);
    fd.append("summary", params.summary);
    fd.append("category", params.category ?? "general");
    fd.append("difficulty", params.difficulty ?? "normal");
    return this.requestFormData("/api/quizzes/from_summary", fd);
  }

  async getQuizzes(): Promise<{ quizzes: QuizLight[] }> {
    return this.request<{ quizzes: QuizLight[] }>("/api/quizzes");
  }

  async getQuiz(id: string): Promise<Quiz> {
    return this.request<Quiz>(`/api/quizzes/${id}`);
  }
}

export const apiClient = new ApiClient();
