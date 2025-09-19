"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface TranscriptDisplayProps {
  transcript: string;
  onKeywordsSelected: (keywords: string[]) => void;
  onNext: () => void;
}

export function TranscriptDisplay({ transcript, onKeywordsSelected, onNext }: TranscriptDisplayProps) {
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>([]);
  
  // Simple keyword extraction - split by sentences and common delimiters
  const extractPotentialKeywords = (text: string): string[] => {
    const sentences = text.split(/[。！？\n]/).filter(s => s.trim().length > 0);
    const keywords: string[] = [];
    
    sentences.forEach(sentence => {
      // Extract phrases that might be important (simple heuristic)
      const words = sentence.trim().split(/[、，\s]+/);
      words.forEach(word => {
        if (word.length >= 3 && word.length <= 20) {
          keywords.push(word.trim());
        }
      });
    });
    
    // Remove duplicates and return first 10
    return [...new Set(keywords)].slice(0, 10);
  };

  const potentialKeywords = extractPotentialKeywords(transcript);

  const toggleKeyword = (keyword: string) => {
    setSelectedKeywords(prev => 
      prev.includes(keyword)
        ? prev.filter(k => k !== keyword)
        : [...prev, keyword]
    );
  };

  const handleNext = () => {
    onKeywordsSelected(selectedKeywords);
    onNext();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">リアルタイム文字起こし</CardTitle>
          <p className="text-sm text-gray-600">リアルタイム音声テキスト変換</p>
        </CardHeader>
        <CardContent>
          <div className="bg-gray-50 rounded-lg p-4 max-h-64 overflow-y-auto">
            <div className="flex items-start space-x-3">
              <div className="text-sm text-gray-500 font-mono">00:00</div>
              <div className="flex-1 text-sm text-gray-800 leading-relaxed">
                {transcript || "文字起こし結果がここに表示されます..."}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {transcript && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">重要語句を選択してください</CardTitle>
            <p className="text-sm text-gray-600">
              文字起こしテキストから重要な語句をクリックして選択してください。選択された語句はノートのキーポイントとタグに使用されます。
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {potentialKeywords.map((keyword, index) => (
                  <button
                    key={index}
                    onClick={() => toggleKeyword(keyword)}
                    className={cn(
                      "px-3 py-1 rounded-full text-sm font-medium transition-colors",
                      selectedKeywords.includes(keyword)
                        ? "bg-green-600 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    )}
                  >
                    {keyword}
                  </button>
                ))}
              </div>
              
              {selectedKeywords.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">選択された重要語句:</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedKeywords.map((keyword, index) => (
                      <span
                        key={index}
                        className="px-2 py-1 bg-green-100 text-green-800 rounded text-sm"
                      >
                        {keyword} ×
                      </span>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="flex justify-between items-center pt-4">
                <Button variant="outline" className="px-4 py-2">
                  <span className="mr-2">🗑️</span>
                  削除
                </Button>
                
                <Button
                  onClick={handleNext}
                  className="bg-green-600 hover:bg-green-700 text-white px-6 py-2"
                >
                  次へ →
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

