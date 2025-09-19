"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Quiz } from "@/types";
import { cn } from "@/lib/utils";

interface QuizCardProps {
  quiz: Quiz;
  currentIndex: number;
  totalQuizzes: number;
  onNext: () => void;
  onPrevious: () => void;
  onAnswer: (isCorrect: boolean) => void;
}

export function QuizCard({ 
  quiz, 
  currentIndex, 
  totalQuizzes, 
  onNext, 
  onPrevious, 
  onAnswer 
}: QuizCardProps) {
  const [isFlipped, setIsFlipped] = useState(false);
  const [userAnswer, setUserAnswer] = useState<boolean | null>(null);

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
  };

  const handleAnswer = (isCorrect: boolean) => {
    setUserAnswer(isCorrect);
    onAnswer(isCorrect);
  };

  const handleReset = () => {
    setIsFlipped(false);
    setUserAnswer(null);
  };

  const handleNext = () => {
    handleReset();
    onNext();
  };

  const handlePrevious = () => {
    handleReset();
    onPrevious();
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Progress */}
      <div className="mb-6">
        <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
          <span>{currentIndex + 1} / {totalQuizzes}</span>
          <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">
            {quiz.category}
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-green-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${((currentIndex + 1) / totalQuizzes) * 100}%` }}
          />
        </div>
      </div>

      {/* Quiz Card */}
      <div className="relative h-80 mb-6">
        <div 
          className={cn(
            "absolute inset-0 w-full h-full transition-transform duration-500 transform-style-preserve-3d cursor-pointer",
            isFlipped && "rotate-y-180"
          )}
          onClick={handleFlip}
        >
          {/* Front Side - Question */}
          <Card className="absolute inset-0 w-full h-full backface-hidden">
            <CardContent className="p-8 h-full flex flex-col justify-center">
              <div className="text-center">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">問題</h2>
                <p className="text-lg text-gray-800 leading-relaxed">
                  {quiz.question}
                </p>
                <div className="mt-8">
                  <p className="text-sm text-gray-500">
                    カードをクリックして答えを表示
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Back Side - Answer */}
          <Card className="absolute inset-0 w-full h-full backface-hidden rotate-y-180">
            <CardContent className="p-8 h-full flex flex-col justify-center">
              <div className="text-center">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">答え</h2>
                <p className="text-lg text-gray-800 leading-relaxed">
                  {quiz.answer}
                </p>
                
                {userAnswer === null && (
                  <div className="mt-8 space-y-3">
                    <p className="text-sm text-gray-600 mb-4">
                      答えを知っていましたか？
                    </p>
                    <div className="flex justify-center space-x-4">
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAnswer(false);
                        }}
                        variant="outline"
                        className="px-6 py-2"
                      >
                        簡単
                      </Button>
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAnswer(true);
                        }}
                        className="bg-green-600 hover:bg-green-700 text-white px-6 py-2"
                      >
                        普通
                      </Button>
                    </div>
                  </div>
                )}

                {userAnswer !== null && (
                  <div className="mt-8">
                    <div className={cn(
                      "inline-flex items-center px-3 py-1 rounded-full text-sm font-medium",
                      userAnswer ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                    )}>
                      {userAnswer ? "正解" : "普通"}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between">
        <Button
          onClick={handlePrevious}
          disabled={currentIndex === 0}
          variant="outline"
          className="flex items-center space-x-2"
        >
          <ChevronLeft className="h-4 w-4" />
          <span>前のカード</span>
        </Button>

        <Button
          onClick={handleReset}
          variant="ghost"
          className="flex items-center space-x-2"
        >
          <RotateCcw className="h-4 w-4" />
          <span>リセット</span>
        </Button>

        <Button
          onClick={handleNext}
          disabled={currentIndex === totalQuizzes - 1}
          className="flex items-center space-x-2 bg-green-600 hover:bg-green-700 text-white"
        >
          <span>次のカード</span>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <style jsx>{`
        .transform-style-preserve-3d {
          transform-style: preserve-3d;
        }
        .backface-hidden {
          backface-visibility: hidden;
        }
        .rotate-y-180 {
          transform: rotateY(180deg);
        }
      `}</style>
    </div>
  );
}

