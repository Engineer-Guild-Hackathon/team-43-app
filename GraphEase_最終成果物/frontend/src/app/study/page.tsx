// src/app/study/page.tsx
import { StudyTab } from "@/components/study/StudyTab";

export default function StudyPage() {
  return (
    <div className="container mx-auto max-w-5xl p-4 md:p-6">
      <h1 className="mb-4 text-2xl font-bold">学習（クイズ一覧）</h1>
      <StudyTab />
    </div>
  );
}
