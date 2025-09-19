"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { BookOpen, User, Mail, Calendar, FileText, Brain, Mic, ArrowLeft } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"

interface AppUser {
  email: string
  name: string
}

export default function ProfilePage() {
  const [user, setUser] = useState<AppUser | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState("")
  const router = useRouter()

  useEffect(() => {
    const userData = localStorage.getItem("preppal_user")
    if (userData) {
      const parsedUser = JSON.parse(userData)
      setUser(parsedUser)
      setEditName(parsedUser.name)
    } else {
      router.push("/login")
    }
  }, [router])

  const handleSaveProfile = () => {
    if (user && editName.trim()) {
      const updatedUser = { ...user, name: editName.trim() }
      localStorage.setItem("preppal_user", JSON.stringify(updatedUser))
      setUser(updatedUser)
      setIsEditing(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem("preppal_user")
    router.push("/login")
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">読み込み中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  戻る
                </Button>
              </Link>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                  <BookOpen className="w-5 h-5 text-primary-foreground" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-foreground">GraphEase</h1>
                  <p className="text-sm text-muted-foreground">プロフィール設定</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 max-w-4xl">
        <div className="grid gap-6 md:grid-cols-3">
          {/* プロフィール情報 */}
          <div className="md:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="w-5 h-5" />
                  プロフィール情報
                </CardTitle>
                <CardDescription>アカウントの基本情報を管理します</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">氏名</Label>
                  {isEditing ? (
                    <Input
                      id="name"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="氏名を入力"
                    />
                  ) : (
                    <div className="flex items-center justify-between">
                      <p className="text-foreground font-medium">{user.name}</p>
                      <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                        編集
                      </Button>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">メールアドレス</Label>
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <p className="text-foreground">{user.email}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>アカウント作成日</Label>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <p className="text-foreground">2024年12月5日</p>
                  </div>
                </div>

                {isEditing && (
                  <div className="flex gap-2 pt-4">
                    <Button onClick={handleSaveProfile} disabled={!editName.trim()}>
                      保存
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsEditing(false)
                        setEditName(user.name)
                      }}
                    >
                      キャンセル
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>学習統計</CardTitle>
                <CardDescription>あなたの学習活動の概要</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-accent/10 rounded-lg">
                    <div className="flex items-center justify-center mb-2">
                      <FileText className="w-6 h-6 text-primary" />
                    </div>
                    <p className="text-2xl font-bold text-foreground">12</p>
                    <p className="text-sm text-muted-foreground">作成したノート</p>
                  </div>
                  <div className="text-center p-4 bg-accent/10 rounded-lg">
                    <div className="flex items-center justify-center mb-2">
                      <Mic className="w-6 h-6 text-primary" />
                    </div>
                    <p className="text-2xl font-bold text-foreground">8</p>
                    <p className="text-sm text-muted-foreground">録音セッション</p>
                  </div>
                  <div className="text-center p-4 bg-accent/10 rounded-lg">
                    <div className="flex items-center justify-center mb-2">
                      <Brain className="w-6 h-6 text-primary" />
                    </div>
                    <p className="text-2xl font-bold text-foreground">24</p>
                    <p className="text-sm text-muted-foreground">学習セッション</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* サイドバー */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>よく使用する科目</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                    コンピュータサイエンス
                  </Badge>
                  <span className="text-sm text-muted-foreground">5ノート</span>
                </div>
                <div className="flex items-center justify-between">
                  <Badge variant="secondary" className="bg-green-100 text-green-800">
                    数学
                  </Badge>
                  <span className="text-sm text-muted-foreground">3ノート</span>
                </div>
                <div className="flex items-center justify-between">
                  <Badge variant="secondary" className="bg-purple-100 text-purple-800">
                    物理学
                  </Badge>
                  <span className="text-sm text-muted-foreground">4ノート</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>アカウント設定</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button variant="outline" className="w-full justify-start bg-transparent">
                  <Mail className="w-4 h-4 mr-2" />
                  通知設定
                </Button>
                <Button variant="outline" className="w-full justify-start bg-transparent">
                  <User className="w-4 h-4 mr-2" />
                  プライバシー設定
                </Button>
                <Separator />
                <Button variant="destructive" className="w-full" onClick={handleLogout}>
                  ログアウト
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
