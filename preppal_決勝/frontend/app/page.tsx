"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { BookOpen, Mic, FileText, Brain, UserIcon, LogOut } from "lucide-react"
import { AudioRecorder } from "@/components/audio-recorder"
import { NotesManager } from "@/components/notes-manager"
import AuthWrapper from "@/components/auth-wrapper"
import { useRouter } from "next/navigation"
import { FlashcardStudy } from "@/components/flashcard-study"
import Link from "next/link"

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

interface Subject {
  id: string
  name: string
  color: string
  noteCount: number
}

interface AppUser {
  email: string
  name: string
}

function PrepPalContent() {
  const [user, setUser] = useState<AppUser | null>(null)
  const router = useRouter()

  useEffect(() => {
    const userData = localStorage.getItem("preppal_user")
    if (userData) {
      setUser(JSON.parse(userData))
    }
  }, [])

  const handleLogout = () => {
    localStorage.removeItem("preppal_user")
    router.push("/login")
  }

  const [notes, setNotes] = useState<Note[]>([
    {
      id: "1",
      title: "アルゴリズム - ビッグO記法",
      content:
        "ビッグO記法は、アルゴリズムの性能や複雑さを表現します。特に最悪の場合のシナリオを記述し、実行時間や使用する空間を表すために使用されます。一般的な複雑さには、O(1)、O(log n)、O(n)、O(n log n)、O(n²)、O(2^n)があります。",
      subject: "コンピュータサイエンス",
      tags: ["アルゴリズム", "複雑さ", "ビッグO"],
      date: "2024-12-05",
      isStarred: true,
      keyPoints: [
        "ビッグOは最悪の場合の性能を表す",
        "一般的な複雑さ: O(1), O(log n), O(n), O(n²)",
        "時間と空間の複雑さの両方に使用",
      ],
      summary: "ビッグO記法とアルゴリズム複雑さ解析の入門",
      source: "recording",
      recordingId: "rec-1",
    },
    {
      id: "2",
      title: "線形代数 - 行列演算",
      content:
        "行列の乗算は可換ではありません（一般的にAB ≠ BA）。単位行列Iは、任意の互換性のある行列Aに対してAI = IA = Aという性質を持ちます。行列の逆行列A⁻¹は、行列式が0でない正方行列にのみ存在します。",
      subject: "数学",
      tags: ["行列", "線形代数", "演算"],
      date: "2024-12-04",
      isStarred: false,
      keyPoints: ["行列の乗算は可換ではない", "単位行列: AI = IA = A", "逆行列は非特異正方行列に存在"],
      summary: "行列演算と逆行列の基本的性質",
      source: "recording",
      recordingId: "rec-2",
    },
    {
      id: "3",
      title: "量子力学 - 波動粒子二重性",
      content:
        "光は実験設定によって波動と粒子の両方の性質を示します。二重スリット実験はこの二重性を明確に示しています。観測されるとき、光子は粒子として振る舞い、観測されないときは波として振る舞い干渉パターンを作ります。",
      subject: "物理学",
      tags: ["量子", "波動粒子", "二重性"],
      date: "2024-12-03",
      isStarred: true,
      keyPoints: ["光は波動と粒子の両方の性質を持つ", "二重スリット実験が二重性を示す", "観測が振る舞いに影響する"],
      summary: "量子力学における波動粒子二重性の理解",
      source: "recording",
      recordingId: "rec-3",
    },
  ])

  const [subjects] = useState<Subject[]>([
    { id: "cs", name: "コンピュータサイエンス", color: "bg-blue-500", noteCount: 5 },
    { id: "math", name: "数学", color: "bg-green-500", noteCount: 3 },
    { id: "physics", name: "物理学", color: "bg-purple-500", noteCount: 4 },
    { id: "chemistry", name: "化学", color: "bg-orange-500", noteCount: 2 },
  ])

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">GraphEase</h1>
                <p className="text-sm text-muted-foreground">あなたの個人的な授業コンパニオン</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {user && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="flex items-center gap-2">
                      <UserIcon className="w-4 h-4" />
                      <span className="hidden sm:inline">{user.name}</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <Link href="/profile" className="flex items-center">
                        <UserIcon className="w-4 h-4 mr-2" />
                        プロフィール
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem disabled>
                      <UserIcon className="w-4 h-4 mr-2" />
                      {user.email}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleLogout}>
                      <LogOut className="w-4 h-4 mr-2" />
                      ログアウト
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        <Tabs defaultValue="record" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6 h-14">
            <TabsTrigger value="record" className="flex items-center gap-2 text-lg font-medium">
              <Mic className="w-5 h-5" />
              録音
            </TabsTrigger>
            <TabsTrigger value="notes" className="flex items-center gap-2 text-lg font-medium">
              <FileText className="w-5 h-5" />
              ノート
            </TabsTrigger>
            <TabsTrigger value="study" className="flex items-center gap-2 text-lg font-medium">
              <Brain className="w-5 h-5" />
              学習
            </TabsTrigger>
          </TabsList>

          <TabsContent value="record">
            <AudioRecorder
              onTranscriptionComplete={(segments) => {
                // 文字起こし完了時の処理
                console.log("Transcription completed:", segments)
              }}
              onNavigateToNotes={() => {
                // ノートタブに切り替え
                const notesTab = document.querySelector('[value="notes"]') as HTMLElement
                notesTab?.click()
              }}
            />
          </TabsContent>

          <TabsContent value="notes">
            <NotesManager notes={notes} subjects={subjects} onNotesChange={setNotes} />
          </TabsContent>

          <TabsContent value="study">
            <FlashcardStudy notes={notes} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

export default function PrepPalApp() {
  return (
    <AuthWrapper>
      <PrepPalContent />
    </AuthWrapper>
  )
}
