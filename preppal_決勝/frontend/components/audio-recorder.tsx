"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Mic, Play, Pause, Square, Trash2, Save, Loader2, ArrowRight, ArrowLeft } from "lucide-react"

interface TranscriptionSegment {
  id: string
  text: string
  timestamp: number
  isFinal: boolean
}

interface AudioRecorderProps {
  onTranscriptionComplete?: (segments: TranscriptionSegment[]) => void
  onNavigateToNotes?: () => void
}

export function AudioRecorder({ onTranscriptionComplete, onNavigateToNotes }: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [audioLevel, setAudioLevel] = useState(0)
  const [transcriptionSegments, setTranscriptionSegments] = useState<TranscriptionSegment[]>([])
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [currentTranscript, setCurrentTranscript] = useState("")
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [isGeneratingNote, setIsGeneratingNote] = useState(false)
  const [noteTitle, setNoteTitle] = useState("")
  const [noteSubject, setNoteSubject] = useState("")
  const [showKeywordSelection, setShowKeywordSelection] = useState(false)
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>([])
  const [fullTranscriptText, setFullTranscriptText] = useState("")
  const [selectedRecording, setSelectedRecording] = useState<any>(null)
  const [showTranscriptionDialog, setShowTranscriptionDialog] = useState(false)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const recognitionRef = useRef<any>(null)

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  const setupSpeechRecognition = () => {
    if ("webkitSpeechRecognition" in window || "SpeechRecognition" in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition
      recognitionRef.current = new SpeechRecognition()

      recognitionRef.current.continuous = true
      recognitionRef.current.interimResults = true
      recognitionRef.current.lang = "ja-JP"

      recognitionRef.current.onstart = () => {
        setIsTranscribing(true)
      }

      recognitionRef.current.onresult = (event: any) => {
        let interimTranscript = ""
        let finalTranscript = ""

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript
          if (event.results[i].isFinal) {
            finalTranscript += transcript
          } else {
            interimTranscript += transcript
          }
        }

        if (finalTranscript) {
          const newSegment: TranscriptionSegment = {
            id: Date.now().toString(),
            text: finalTranscript.trim(),
            timestamp: recordingTime,
            isFinal: true,
          }
          setTranscriptionSegments((prev) => [...prev, newSegment])
          setCurrentTranscript("")
        } else {
          setCurrentTranscript(interimTranscript)
        }
      }

      recognitionRef.current.onerror = (event: any) => {
        console.error("Speech recognition error:", event.error)
      }

      recognitionRef.current.onend = () => {
        setIsTranscribing(false)
        if (isRecording && !isPaused) {
          recognitionRef.current?.start()
        }
      }
    }
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })

      mediaRecorderRef.current = new MediaRecorder(stream)
      audioContextRef.current = new AudioContext()
      const source = audioContextRef.current.createMediaStreamSource(stream)
      analyserRef.current = audioContextRef.current.createAnalyser()
      source.connect(analyserRef.current)

      const updateAudioLevel = () => {
        if (analyserRef.current && isRecording) {
          const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount)
          analyserRef.current.getByteFrequencyData(dataArray)
          const average = dataArray.reduce((a, b) => a + b) / dataArray.length
          setAudioLevel(average)
          requestAnimationFrame(updateAudioLevel)
        }
      }

      setIsRecording(true)
      setRecordingTime(0)
      setTranscriptionSegments([])
      setCurrentTranscript("")
      setupSpeechRecognition()
      recognitionRef.current?.start()
      updateAudioLevel()
    } catch (error) {
      console.error("Error starting recording:", error)
    }
  }

  const togglePause = () => {
    setIsPaused(!isPaused)
    if (isPaused) {
      recognitionRef.current?.start()
    } else {
      recognitionRef.current?.stop()
    }
  }

  const stopRecording = () => {
    setIsRecording(false)
    setIsPaused(false)
    recognitionRef.current?.stop()

    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop()
    }

    if (audioContextRef.current) {
      audioContextRef.current.close()
    }

    if (transcriptionSegments.length > 0) {
      const fullText = transcriptionSegments.map((segment) => segment.text).join(" ")
      setFullTranscriptText(fullText)
      setShowKeywordSelection(true)
      const firstSegment = transcriptionSegments[0]?.text || ""
      const autoTitle = firstSegment.length > 30 ? firstSegment.substring(0, 30) + "..." : firstSegment
      setNoteTitle(autoTitle)
    }
  }

  const handleKeywordSelection = (word: string) => {
    setSelectedKeywords((prev) => (prev.includes(word) ? prev.filter((k) => k !== word) : [...prev, word]))
  }

  const proceedToSave = () => {
    setShowKeywordSelection(false)
    setShowSaveDialog(true)
  }

  const backToKeywordSelection = () => {
    setShowSaveDialog(false)
    setShowKeywordSelection(true)
  }

  const renderTextWithHighlight = (text: string) => {
    const words = text.split(/(\s+|[、。！？])/)
    return words.map((word, index) => {
      const cleanWord = word.trim()
      if (cleanWord && !cleanWord.match(/^[\s、。！？]+$/)) {
        const isSelected = selectedKeywords.includes(cleanWord)
        return (
          <span
            key={index}
            className={`cursor-pointer px-1 py-0.5 rounded transition-colors ${
              isSelected ? "bg-primary text-primary-foreground" : "hover:bg-accent hover:text-accent-foreground"
            }`}
            onClick={() => handleKeywordSelection(cleanWord)}
          >
            {word}
          </span>
        )
      }
      return <span key={index}>{word}</span>
    })
  }

  const discardTranscription = () => {
    setTranscriptionSegments([])
    setCurrentTranscript("")
    setShowSaveDialog(false)
    setShowKeywordSelection(false)
    setSelectedKeywords([])
    setFullTranscriptText("")
    setNoteTitle("")
    setNoteSubject("")
  }

  const saveTranscription = async () => {
    if (!noteTitle.trim()) return

    setIsGeneratingNote(true)

    await new Promise((resolve) => setTimeout(resolve, 2000))

    const fullText = transcriptionSegments.map((segment) => segment.text).join(" ")

    const newNote = {
      id: Date.now().toString(),
      title: noteTitle,
      content: fullText,
      subject: noteSubject || "一般",
      tags: ["録音から生成", ...selectedKeywords.slice(0, 3)],
      date: new Date().toISOString().split("T")[0],
      isStarred: false,
      keyPoints: selectedKeywords.length > 0 ? selectedKeywords : extractKeyPoints(fullText),
      summary: generateSummary(fullText),
      source: "recording" as const,
      recordingId: `rec-${Date.now()}`,
    }

    onTranscriptionComplete?.(transcriptionSegments)

    setIsGeneratingNote(false)
    setShowSaveDialog(false)
    setShowKeywordSelection(false)
    setSelectedKeywords([])
    setFullTranscriptText("")
    setTranscriptionSegments([])
    setNoteTitle("")
    setNoteSubject("")

    onNavigateToNotes?.()
  }

  const extractKeyPoints = (text: string): string[] => {
    const sentences = text.split(/[。！？]/).filter((s) => s.trim().length > 10)
    return sentences.slice(0, 3).map((s) => s.trim())
  }

  const generateSummary = (text: string): string => {
    return text.length > 100 ? text.substring(0, 100) + "..." : text
  }

  const viewRecordingTranscription = (recording: any) => {
    setSelectedRecording(recording)
    setShowTranscriptionDialog(true)
  }

  useEffect(() => {
    if (isRecording && !isPaused) {
      intervalRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1)
      }, 1000)
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [isRecording, isPaused])

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>講義録音</CardTitle>
          <CardDescription>講義を録音すると、GraphEaseが自動的に文字起こしします</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-center">
            <div className="relative">
              <div className="w-32 h-32 rounded-full border-4 border-primary/20 flex items-center justify-center">
                <div
                  className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center transition-all duration-150"
                  style={{
                    transform: `scale(${1 + (audioLevel / 255) * 0.3})`,
                    backgroundColor: isRecording
                      ? `oklch(0.45 0.15 160 / ${0.1 + (audioLevel / 255) * 0.3})`
                      : undefined,
                  }}
                >
                  {isRecording ? (
                    <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center animate-pulse">
                      <Mic className="w-8 h-8 text-primary-foreground" />
                    </div>
                  ) : (
                    <Mic className="w-8 h-8 text-muted-foreground" />
                  )}
                </div>
              </div>
              {isRecording && (
                <div className="absolute -top-2 -right-2">
                  <div className="w-4 h-4 bg-red-500 rounded-full animate-pulse"></div>
                </div>
              )}
            </div>
          </div>

          {isRecording && (
            <div className="text-center space-y-2">
              <div className="text-2xl font-mono font-bold text-primary">{formatTime(recordingTime)}</div>
              <div className="flex items-center justify-center gap-2">
                <p className="text-sm text-muted-foreground">{isPaused ? "録音一時停止中" : "録音中..."}</p>
                {isTranscribing && (
                  <Badge variant="secondary" className="bg-accent/10 text-accent">
                    文字起こし中
                  </Badge>
                )}
              </div>
            </div>
          )}

          <div className="flex items-center justify-center gap-4">
            {!isRecording ? (
              <Button onClick={startRecording} size="lg" className="bg-primary hover:bg-primary/90">
                <Mic className="w-5 h-5 mr-2" />
                録音開始
              </Button>
            ) : (
              <div className="flex gap-3">
                <Button onClick={togglePause} variant="outline" size="lg">
                  {isPaused ? (
                    <>
                      <Play className="w-5 h-5 mr-2" />
                      再開
                    </>
                  ) : (
                    <>
                      <Pause className="w-5 h-5 mr-2" />
                      一時停止
                    </>
                  )}
                </Button>
                <Button onClick={stopRecording} variant="destructive" size="lg">
                  <Square className="w-5 h-5 mr-2" />
                  停止
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {(isRecording || transcriptionSegments.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle>リアルタイム文字起こし</CardTitle>
            <CardDescription>リアルタイム音声テキスト変換</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-80 w-full border rounded-lg p-4">
              <div className="space-y-3">
                {transcriptionSegments.map((segment) => (
                  <div key={segment.id} className="flex gap-3">
                    <Badge variant="outline" className="text-xs shrink-0 mt-1">
                      {formatTime(segment.timestamp)}
                    </Badge>
                    <p className="text-sm leading-relaxed text-foreground">{segment.text}</p>
                  </div>
                ))}
                {currentTranscript && (
                  <div className="flex gap-3">
                    <Badge variant="outline" className="text-xs shrink-0 mt-1 bg-accent/10">
                      {formatTime(recordingTime)}
                    </Badge>
                    <p className="text-sm leading-relaxed text-muted-foreground italic">{currentTranscript}</p>
                  </div>
                )}
                {transcriptionSegments.length === 0 && !currentTranscript && (
                  <p className="text-muted-foreground text-center py-8">
                    話し始めるとリアルタイム文字起こしが表示されます...
                  </p>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      <Dialog open={showKeywordSelection} onOpenChange={setShowKeywordSelection}>
        <DialogContent className="max-w-5xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle>重要語句を選択してください</DialogTitle>
            <DialogDescription>
              文字起こしテキストから重要な語句をクリックして選択してください。選択された語句はノートのキーポイントとタグに使用されます。
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <ScrollArea className="h-80 w-full border rounded-lg p-4">
              <div className="text-sm leading-relaxed">{renderTextWithHighlight(fullTranscriptText)}</div>
            </ScrollArea>

            {selectedKeywords.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">選択された重要語句:</p>
                <div className="flex flex-wrap gap-2">
                  {selectedKeywords.map((keyword, index) => (
                    <Badge
                      key={index}
                      variant="default"
                      className="cursor-pointer"
                      onClick={() => handleKeywordSelection(keyword)}
                    >
                      {keyword} ×
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={discardTranscription}>
                <Trash2 className="w-4 h-4 mr-2" />
                削除
              </Button>
              <Button onClick={proceedToSave}>
                次へ
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>ノートを保存</DialogTitle>
            <DialogDescription>ノートのタイトルと科目を設定して保存してください。</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <ScrollArea className="h-32 w-full border rounded-lg p-3">
              <div className="space-y-2">
                {transcriptionSegments.map((segment) => (
                  <p key={segment.id} className="text-sm text-foreground">
                    {segment.text}
                  </p>
                ))}
              </div>
            </ScrollArea>

            {selectedKeywords.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">選択された重要語句:</p>
                <div className="flex flex-wrap gap-2">
                  {selectedKeywords.map((keyword, index) => (
                    <Badge key={index} variant="secondary">
                      {keyword}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-3">
              <Input placeholder="ノートのタイトル" value={noteTitle} onChange={(e) => setNoteTitle(e.target.value)} />
              <Select value={noteSubject} onValueChange={setNoteSubject}>
                <SelectTrigger>
                  <SelectValue placeholder="科目を選択" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="コンピュータサイエンス">コンピュータサイエンス</SelectItem>
                  <SelectItem value="数学">数学</SelectItem>
                  <SelectItem value="物理学">物理学</SelectItem>
                  <SelectItem value="化学">化学</SelectItem>
                  <SelectItem value="一般">一般</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-3 justify-between">
              <Button variant="outline" onClick={backToKeywordSelection}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                戻る
              </Button>
              <div className="flex gap-3">
                <Button variant="outline" onClick={discardTranscription} disabled={isGeneratingNote}>
                  <Trash2 className="w-4 h-4 mr-2" />
                  削除
                </Button>
                <Button onClick={saveTranscription} disabled={!noteTitle.trim() || isGeneratingNote}>
                  {isGeneratingNote ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ノート生成中...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      保存
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showTranscriptionDialog} onOpenChange={setShowTranscriptionDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedRecording?.title}</DialogTitle>
            <DialogDescription>
              {selectedRecording?.date} • {selectedRecording?.duration}
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="h-64 w-full border rounded-lg p-4">
            <p className="text-sm leading-relaxed">{selectedRecording?.transcription}</p>
          </ScrollArea>

          <div className="flex justify-end">
            <Button onClick={() => setShowTranscriptionDialog(false)}>閉じる</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <CardTitle>最近の録音</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              {
                title: "コンピュータサイエンス101 - アルゴリズム",
                date: "今日, 2:30 PM",
                duration: "45:23",
                transcription:
                  "今日はアルゴリズムの基本概念について学習します。アルゴリズムとは、問題を解決するための手順や方法を明確に定義したものです。効率的なアルゴリズムを設計することで、計算時間を短縮し、メモリ使用量を最適化できます。",
              },
              {
                title: "数学 - 線形代数",
                date: "昨日, 10:00 AM",
                duration: "52:15",
                transcription:
                  "線形代数は現代数学の基礎となる分野です。ベクトル空間、行列、線形変換などの概念を通じて、多次元の問題を扱います。これらの概念は機械学習やコンピュータグラフィックスなど、様々な分野で応用されています。",
              },
              {
                title: "物理学 - 量子力学",
                date: "12月3日, 3:15 PM",
                duration: "38:42",
                transcription:
                  "量子力学は原子や分子レベルでの物理現象を記述する理論です。古典物理学では説明できない現象を、波動関数や確率的な解釈を用いて説明します。量子もつれや重ね合わせなどの概念は、現代の量子コンピュータ技術の基礎となっています。",
              },
            ].map((recording, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-accent/50 transition-colors"
                onClick={() => viewRecordingTranscription(recording)}
              >
                <div>
                  <h4 className="font-medium text-foreground">{recording.title}</h4>
                  <p className="text-sm text-muted-foreground">{recording.date}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-mono text-foreground">{recording.duration}</p>
                  <Badge variant="secondary" className="text-xs">
                    文字起こし済み
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
