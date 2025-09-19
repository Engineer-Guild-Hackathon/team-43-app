"use client";

import { Header } from "./Header";
import { TabNavigation } from "./TabNavigation";

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
  userName?: string;
}

export function Layout({ children, activeTab, onTabChange, userName }: LayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header userName={userName} />
      <TabNavigation activeTab={activeTab} onTabChange={onTabChange} />
      <main className="container mx-auto px-6 py-8">
        {children}
      </main>
    </div>
  );
}

