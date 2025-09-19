import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDuration(seconds?: number): string {
  if (!seconds) return '0:00';
  
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
  
  if (diffInHours < 24) {
    return date.toLocaleTimeString('ja-JP', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  } else if (diffInHours < 24 * 7) {
    return date.toLocaleDateString('ja-JP', { 
      month: 'numeric', 
      day: 'numeric',
      hour: '2-digit', 
      minute: '2-digit' 
    });
  } else {
    return date.toLocaleDateString('ja-JP', { 
      year: 'numeric',
      month: 'numeric', 
      day: 'numeric' 
    });
  }
}

export function generateQuizFromSummary(summary: string, noteTitle: string, noteId: string) {
  // Simple quiz generation logic - in a real app, this would use AI
  const sentences = summary.split('。').filter(s => s.trim().length > 10);
  const quizzes = sentences.slice(0, 3).map((sentence, index) => {
    const words = sentence.trim().split(/\s+/);
    const keyWord = words.find(word => word.length > 3) || words[0];
    
    return {
      id: `${noteId}-quiz-${index}`,
      question: `${noteTitle}について：${keyWord}とは何ですか？`,
      answer: sentence.trim() + '。',
      category: noteTitle,
      noteId,
      noteTitle
    };
  });
  
  return quizzes;
}

