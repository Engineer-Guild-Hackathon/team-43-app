"use client";

import { useState, useEffect } from "react";
import { NotesGrid } from "./NotesGrid";
import { NoteDetail } from "./NoteDetail";
import { apiClient } from "@/lib/api";
import { RecordingLight, Recording } from "@/types";

// ⬇⬇ ファイルの一番上、他の import と同じ場所に追加
import { useRouter } from "next/navigation";

export function NotesTab() {
  const router = useRouter();
  const [notes, setNotes] = useState<RecordingLight[]>([]);
  const [selectedNote, setSelectedNote] = useState<Recording | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadNotes();
  }, []);

  const loadNotes = async () => {
    try {
      const list = await apiClient.getRecordings();
      setNotes(Array.isArray(list) ? list : []);
    } catch (error) {
      console.error("Failed to load notes:", error);
      // Use mock data for demonstration
      setNotes([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNoteClick = async (note: RecordingLight) => {
    try {
      const fullNote = await apiClient.getRecording(note.id);
      setSelectedNote(fullNote);
    } catch (error) {
      console.error("Failed to load note details:", error);
      // Use mock data for demonstration
      const mockNote: Recording = {
        id: note.id,
        title: note.title,
        created_at: note.created_at,
        duration_sec: note.duration_sec,
        transcript: "Mock transcript data...",
        summary: "Mock summary data...",
        segments: [],
        highlights: [],
      };
      setSelectedNote(mockNote);
    }
  };

  const handleBack = () => {
    setSelectedNote(null);
  };

  const handleCreateQuiz = (noteId: string, noteTitle: string, summary: string) => {
    // This would typically navigate to the Study tab or create quiz directly
    console.log("Creating quiz for note:", noteId, noteTitle, summary);
    // For now, just show an alert
    alert(`クイズが作成されました: ${noteTitle}`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">ノートを読み込み中...</div>
      </div>
    );
  }

  if (selectedNote) {
    return (
      <NoteDetail
        note={selectedNote}
        onBack={handleBack}
        onCreateQuiz={handleCreateQuiz}
      />
    );
  }

  return (
    <NotesGrid
      notes={notes}
      // ⬇⬇ クリック時に遷移する
      onNoteClick={(note) => router.push(`/notes/${note.id}`)}
    />
  );
}

