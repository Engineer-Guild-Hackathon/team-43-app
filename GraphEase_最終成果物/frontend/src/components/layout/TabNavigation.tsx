"use client";

import { Mic, FileText, GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";

interface TabNavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const tabs = [
  {
    id: "record",
    label: "録音",
    icon: Mic,
  },
  {
    id: "notes",
    label: "ノート",
    icon: FileText,
  },
  {
    id: "study",
    label: "学習",
    icon: GraduationCap,
  },
];

export function TabNavigation({ activeTab, onTabChange }: TabNavigationProps) {
  return (
    <div className="border-b bg-white">
      <div className="flex">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "flex flex-1 items-center justify-center space-x-2 px-6 py-4 text-base font-medium transition-colors",
                isActive
                  ? "border-b-2 border-green-600 bg-green-50 text-green-700"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              )}
            >
              <Icon className="h-5 w-5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

