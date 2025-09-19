"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Search, Edit3, Tag, Clock, FileText, ArrowLeft, Save, X } from "lucide-react"

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

interface NotesManagerProps {
  notes: Note[]
  subjects: Subject[]
  onNotesChange: (notes: Note[]) => void
}

export function NotesManager({ notes, subjects, onNotesChange }: NotesManagerProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedSubject, setSelectedSubject] = useState<string>("all")
  const [selectedNote, setSelectedNote] = useState<Note | null>(null)
  const [isEditingNote, setIsEditingNote] = useState(false)
  const [editingNote, setEditingNote] = useState<Note | null>(null)

  const filteredNotes = notes.filter((note) => {
    const matchesSearch =
      note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      note.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      note.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()))

    const matchesSubject = selectedSubject === "all" || note.subject === selectedSubject

    return matchesSearch && matchesSubject
  })

  const startEditingNote = (note: Note) => {
    setEditingNote({ ...note })
    setIsEditingNote(true)
  }

  const saveEditedNote = () => {
    if (editingNote) {
      const updatedNotes = notes.map((note) =>
        note.id === editingNote.id
          ? {
              ...editingNote,
              tags:
                typeof editingNote.tags === "string"
                  ? editingNote.tags
                      .split(",")
                      .map((tag) => tag.trim())
                      .filter(Boolean)
                  : editingNote.tags,
            }
          : note,
      )
      onNotesChange(updatedNotes)
      setIsEditingNote(false)
      setEditingNote(null)
      setSelectedNote(null)
    }
  }

  const cancelEditing = () => {
    setIsEditingNote(false)
    setEditingNote(null)
  }

  if (selectedNote && !isEditingNote) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => setSelectedNote(null)}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            ノート一覧に戻る
          </Button>
          <Button onClick={() => startEditingNote(selectedNote)}>
            <Edit3 className="w-4 h-4 mr-2" />
            編集
          </Button>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <CardTitle className="text-2xl mb-2">{selectedNote.title}</CardTitle>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <div
                      className={`w-2 h-2 rounded-full ${subjects.find((s) => s.name === selectedNote.subject)?.color || "bg-gray-400"}`}
                    />
                    {selectedNote.subject}
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {selectedNote.date}
                  </div>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {selectedNote.keyPoints.length > 0 && (
              <div>
                <h3 className="font-semibold text-lg mb-3">キーポイント</h3>
                <ul className="space-y-2">
                  {selectedNote.keyPoints.map((point, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <span className="w-2 h-2 bg-primary rounded-full mt-2 shrink-0" />
                      <span className="text-foreground">{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div>
              <h3 className="font-semibold text-lg mb-3">内容</h3>
              <div className="prose prose-sm max-w-none">
                <p className="text-foreground leading-relaxed whitespace-pre-wrap">{selectedNote.content}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {selectedNote.tags.map((tag) => (
                <Badge key={tag} variant="secondary">
                  <Tag className="w-3 h-3 mr-1" />
                  {tag}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (isEditingNote && editingNote) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={cancelEditing}>
            <X className="w-4 h-4 mr-2" />
            キャンセル
          </Button>
          <Button onClick={saveEditedNote}>
            <Save className="w-4 h-4 mr-2" />
            保存
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>ノートを編集</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              placeholder="ノートのタイトル"
              value={editingNote.title}
              onChange={(e) => setEditingNote((prev) => (prev ? { ...prev, title: e.target.value } : null))}
            />

            <Select
              value={editingNote.subject}
              onValueChange={(value) => setEditingNote((prev) => (prev ? { ...prev, subject: value } : null))}
            >
              <SelectTrigger>
                <SelectValue placeholder="科目を選択" />
              </SelectTrigger>
              <SelectContent>
                {subjects.map((subject) => (
                  <SelectItem key={subject.id} value={subject.name}>
                    {subject.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Textarea
              placeholder="ノートの内容"
              value={editingNote.content}
              onChange={(e) => setEditingNote((prev) => (prev ? { ...prev, content: e.target.value } : null))}
              rows={12}
            />

            <Input
              placeholder="タグ（カンマ区切り）"
              value={Array.isArray(editingNote.tags) ? editingNote.tags.join(", ") : editingNote.tags}
              onChange={(e) => setEditingNote((prev) => (prev ? { ...prev, tags: e.target.value } : null))}
            />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Search and Filter Bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="ノート、タグ、内容を検索..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={selectedSubject} onValueChange={setSelectedSubject}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="科目でフィルター" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">すべての科目</SelectItem>
                {subjects.map((subject) => (
                  <SelectItem key={subject.id} value={subject.name}>
                    {subject.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Subject Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {subjects.map((subject) => (
          <Card key={subject.id} className="cursor-pointer hover:shadow-md transition-shadow">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${subject.color}`} />
                <div>
                  <p className="font-medium text-sm">{subject.name}</p>
                  <p className="text-xs text-muted-foreground">{subject.noteCount} ノート</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Notes List */}
      <div className="space-y-4">
        {filteredNotes.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  {searchQuery || selectedSubject !== "all"
                    ? "現在のフィルターに一致するノートがありません"
                    : "まだノートがありません。講義を録音してノートを作成してください。"}
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          filteredNotes.map((note) => (
            <Card
              key={note.id}
              className="hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => setSelectedNote(note)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg mb-2">{note.title}</CardTitle>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <div
                          className={`w-2 h-2 rounded-full ${subjects.find((s) => s.name === note.subject)?.color || "bg-gray-400"}`}
                        />
                        {note.subject}
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {note.date}
                      </div>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground leading-relaxed">{note.summary}</p>

                {note.keyPoints.length > 0 && (
                  <div>
                    <h4 className="font-medium text-sm mb-2">キーポイント:</h4>
                    <ul className="space-y-1">
                      {note.keyPoints.slice(0, 2).map((point, index) => (
                        <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                          <span className="w-1 h-1 bg-primary rounded-full mt-2 shrink-0" />
                          {point}
                        </li>
                      ))}
                      {note.keyPoints.length > 2 && (
                        <li className="text-xs text-muted-foreground">
                          他 {note.keyPoints.length - 2} 個のポイント...
                        </li>
                      )}
                    </ul>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <div className="flex flex-wrap gap-1">
                    {note.tags.slice(0, 3).map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        <Tag className="w-3 h-3 mr-1" />
                        {tag}
                      </Badge>
                    ))}
                    {note.tags.length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{note.tags.length - 3}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedNote(note)
                      }}
                    >
                      <FileText className="w-4 h-4 mr-1" />
                      詳細
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        startEditingNote(note)
                      }}
                    >
                      <Edit3 className="w-4 h-4 mr-1" />
                      編集
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
