"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { BookOpen, ArrowRight } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    // Simple validation
    if (!email || !password) {
      setError("すべてのフィールドを入力してください")
      setIsLoading(false)
      return
    }

    // Simulate login (in real app, this would be an API call)
    setTimeout(() => {
      // Store auth state in localStorage for demo
      localStorage.setItem("preppal_user", JSON.stringify({ email, name: email.split("@")[0] }))
      router.push("/")
    }, 1000)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <BookOpen className="h-6 w-6 text-emerald-600" />
            </div>
            <h1 className="text-2xl font-bold text-emerald-900">GraphEase</h1>
          </div>
          <CardTitle className="text-xl">おかえりなさい</CardTitle>
          <CardDescription>GraphEaseアカウントにサインインして学習を続けましょう</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">メールアドレス</Label>
              <Input
                id="email"
                type="email"
                placeholder="メールアドレスを入力"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">パスワード</Label>
              <Input
                id="password"
                type="password"
                placeholder="パスワードを入力"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700" disabled={isLoading}>
              {isLoading ? "サインイン中..." : "サインイン"}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-gray-600">
            アカウントをお持ちでない方は{" "}
            <Link href="/signup" className="text-emerald-600 hover:text-emerald-700 font-medium">
              サインアップ
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
