"use client";

import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { LoginForm } from "@/components/auth/LoginForm";
import { SignupForm } from "@/components/auth/SignupForm";
import { RecordTab } from "@/components/record/RecordTab";
import { NotesTab } from "@/components/notes/NotesTab";
import { StudyTab } from "@/components/study/StudyTab";
import { useAuth } from "@/hooks/useAuth";

export default function Home() {
  const { user, isLoading, login, signup } = useAuth();
  const [activeTab, setActiveTab] = useState("record");
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-500">読み込み中...</div>
      </div>
    );
  }

  if (!user) {
    if (authMode === "login") {
      return (
        <LoginForm
          onLogin={login}
          onSwitchToSignup={() => setAuthMode("signup")}
        />
      );
    } else {
      return (
        <SignupForm
          onSignup={signup}
          onSwitchToLogin={() => setAuthMode("login")}
        />
      );
    }
  }

  const renderActiveTab = () => {
    switch (activeTab) {
      case "record":
        return <RecordTab />;
      case "notes":
        return <NotesTab />;
      case "study":
        return <StudyTab />;
      default:
        return <RecordTab />;
    }
  };

  return (
    <Layout
      activeTab={activeTab}
      onTabChange={setActiveTab}
      userName={user.name}
    >
      {renderActiveTab()}
    </Layout>
  );
}
