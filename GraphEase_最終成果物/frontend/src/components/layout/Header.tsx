"use client";

import { User } from "lucide-react";

interface HeaderProps {
  userName?: string;
}

export function Header({ userName = "mitu" }: HeaderProps) {
  return (
    <header className="border-b bg-white px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-green-600 text-white font-bold text-sm">
            📊
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">GraphEase</h1>
            <p className="text-sm text-gray-600">あなたの個人的な授業コンパニオン</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <User className="h-5 w-5 text-gray-600" />
          <span className="text-sm font-medium text-gray-900">{userName}</span>
        </div>
      </div>
    </header>
  );
}

