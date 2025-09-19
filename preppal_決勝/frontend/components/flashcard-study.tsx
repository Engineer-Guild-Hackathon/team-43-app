"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ChevronLeft, ChevronRight, RotateCcw, CheckCircle, XCircle, Brain } from "lucide-react"

interface Note {
  id: string
  title: string
  content: string
  subject: string
  tags: string[]
  date: string
  isStarred: boolean
  keyPoints: string[]
  summary: string
  source: "recording" | "manual"
  recordingId?: string
}

interface FlashCard {
  id: string
  question: string
  answer: string
  noteId: string
  subject: string
  difficulty: "easy" | "medium" | "hard"
  lastReviewed?: string
  correctCount: number
  totalAttempts: number
}

interface FlashcardStudyProps {
  notes: Note[]
}

export function FlashcardStudy({ notes }: FlashcardStudyProps) {
  const [flashcards, setFlashcards] = useState<FlashCard[]>([])
  const [currentCardIndex, setCurrentCardIndex] = useState(0)
  const [showAnswer, setShowAnswer] = useState(false)
  const [studyMode, setStudyMode] = useState<"all" | "subject">("all")
  const [selectedSubject, setSelectedSubject] = useState<string>("")
  const [sessionStats, setSessionStats] = useState({
    correct: 0,
    incorrect: 0,
    total: 0,
  })

  // ノートからフラッシュカードを生成
  const generateFlashcardsFromNotes = () => {
    // Geminiによるクイズ生成をシミュレート
    const generatedCards: FlashCard[] = []

    notes.forEach((note, noteIndex) => {
      // 各ノートから2-3個のクイズを生成
      const questionsPerNote = Math.min(3, note.keyPoints.length)

      for (let i = 0; i < questionsPerNote; i++) {
        const cardId = `card-${note.id}-${i}`
        let question = ""
        let answer = ""

        // キーポイントベースでクイズを生成
        if (note.keyPoints[i]) {
          if (note.subject === "コンピュータサイエンス") {
            question = `${note.title}について：${note.keyPoints[i].split("：")[0]}とは何ですか？`
            answer = note.keyPoints[i]
          } else if (note.subject === "数学") {
            question = `${note.title}において：${note.keyPoints[i].split("：")[0]}について説明してください。`
            answer = note.keyPoints[i]
          } else if (note.subject === "物理学") {
            question = `${note.title}に関して：${note.keyPoints[i].split("：")[0]}とはどのような現象ですか？`
            answer = note.keyPoints[i]
          } else {
            question = `${note.title}について：${note.keyPoints[i].split("：")[0]}について説明してください。`
            answer = note.keyPoints[i]
          }
        }

        generatedCards.push({
          id: cardId,
          question,
          answer,
          noteId: note.id,
          subject: note.subject,
          difficulty: i === 0 ? "easy" : i === 1 ? "medium" : "hard",
          correctCount: 0,
          totalAttempts: 0,
        })
      }
    })

    setFlashcards(generatedCards)
  }

  useEffect(() => {
    if (notes.length > 0 && flashcards.length === 0) {
      generateFlashcardsFromNotes()
    }
  }, [notes])

  const currentCards = studyMode === "all" ? flashcards : flashcards.filter((card) => card.subject === selectedSubject)

  const currentCard = currentCards[currentCardIndex]

  const handleAnswer = (isCorrect: boolean) => {
    if (!currentCard) return

    // 統計を更新
    setSessionStats((prev) => ({
      correct: prev.correct + (isCorrect ? 1 : 0),
      incorrect: prev.incorrect + (isCorrect ? 0 : 1),
      total: prev.total + 1,
    }))

    // カードの統計を更新
    setFlashcards((prev) =>
      prev.map((card) =>
        card.id === currentCard.id
          ? {
              ...card,
              correctCount: card.correctCount + (isCorrect ? 1 : 0),
              totalAttempts: card.totalAttempts + 1,
              lastReviewed: new Date().toISOString(),
            }
          : card,
      ),
    )

    // 次のカードに進む
    setTimeout(() => {
      nextCard()
    }, 1000)
  }

  const nextCard = () => {
    setShowAnswer(false)
    setCurrentCardIndex((prev) => (prev + 1) % currentCards.length)
  }

  const prevCard = () => {
    setShowAnswer(false)
    setCurrentCardIndex((prev) => (prev === 0 ? currentCards.length - 1 : prev - 1))
  }

  const resetSession = () => {
    setSessionStats({ correct: 0, incorrect: 0, total: 0 })
    setCurrentCardIndex(0)
    setShowAnswer(false)
  }

  const subjects = Array.from(new Set(notes.map((note) => note.subject)))

  if (currentCards.length === 0) {
    return (
      <div className="text-center py-12 space-y-4">
        <Brain className="w-12 h-12 text-muted-foreground mx-auto" />
        <h3 className="text-lg font-semibold">フラッシュカードがありません</h3>
        <p className="text-muted-foreground">
          まずは録音してノートを作成してください。ノートからフラッシュカードが自動生成されます。
        </p>
        <Button onClick={generateFlashcardsFromNotes} disabled={notes.length === 0}>
          <Brain className="w-4 h-4 mr-2" />
          フラッシュカードを生成
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* コントロールパネル */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-wrap gap-2">
          <Button
            variant={studyMode === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setStudyMode("all")
              setCurrentCardIndex(0)
              setShowAnswer(false)
            }}
          >
            すべて ({flashcards.length})
          </Button>
          {subjects.map((subject) => (
            <Button
              key={subject}
              variant={studyMode === "subject" && selectedSubject === subject ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setStudyMode("subject")
                setSelectedSubject(subject)
                setCurrentCardIndex(0)
                setShowAnswer(false)
              }}
            >
              {subject} ({flashcards.filter((card) => card.subject === subject).length})
            </Button>
          ))}
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={resetSession}>
            <RotateCcw className="w-4 h-4 mr-2" />
            リセット
          </Button>
        </div>
      </div>

      {/* 進捗とスタッツ */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600">{sessionStats.correct}</div>
            <div className="text-sm text-muted-foreground">正解</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-red-600">{sessionStats.incorrect}</div>
            <div className="text-sm text-muted-foreground">不正解</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{sessionStats.total}</div>
            <div className="text-sm text-muted-foreground">総回答数</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">
              {sessionStats.total > 0 ? Math.round((sessionStats.correct / sessionStats.total) * 100) : 0}%
            </div>
            <div className="text-sm text-muted-foreground">正答率</div>
          </CardContent>
        </Card>
      </div>

      {/* フラッシュカード */}
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <Badge variant="outline">
            {currentCardIndex + 1} / {currentCards.length}
          </Badge>
          <Badge variant="secondary">{currentCard?.subject}</Badge>
        </div>

        <Card className="min-h-[300px]">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">{showAnswer ? "答え" : "問題"}</CardTitle>
              <Badge
                variant={
                  currentCard?.difficulty === "easy"
                    ? "default"
                    : currentCard?.difficulty === "medium"
                      ? "secondary"
                      : "destructive"
                }
              >
                {currentCard?.difficulty === "easy" ? "簡単" : currentCard?.difficulty === "medium" ? "普通" : "難しい"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-center py-8">
              <p className="text-lg leading-relaxed">{showAnswer ? currentCard?.answer : currentCard?.question}</p>
            </div>

            <div className="flex flex-col gap-4">
              {!showAnswer ? (
                <Button onClick={() => setShowAnswer(true)} className="w-full" size="lg">
                  答えを表示
                </Button>
              ) : (
                <div className="flex gap-4">
                  <Button
                    onClick={() => handleAnswer(false)}
                    variant="outline"
                    className="flex-1 text-red-600 border-red-200 hover:bg-red-50"
                    size="lg"
                  >
                    <XCircle className="w-5 h-5 mr-2" />
                    不正解
                  </Button>
                  <Button
                    onClick={() => handleAnswer(true)}
                    className="flex-1 bg-green-600 hover:bg-green-700"
                    size="lg"
                  >
                    <CheckCircle className="w-5 h-5 mr-2" />
                    正解
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ナビゲーション */}
        <div className="flex justify-between mt-4">
          <Button variant="outline" onClick={prevCard} disabled={currentCards.length <= 1}>
            <ChevronLeft className="w-4 h-4 mr-2" />
            前のカード
          </Button>
          <Button variant="outline" onClick={nextCard} disabled={currentCards.length <= 1}>
            次のカード
            <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  )
}
