"use client";

import { useState, useRef } from "react";
import { Mic, Square, Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface RecordingButtonProps {
  onRecordingComplete: (audioBlob: Blob, duration: number) => void;
  isProcessing?: boolean;
}

export function RecordingButton({ onRecordingComplete, isProcessing = false }: RecordingButtonProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [duration, setDuration] = useState(0);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const pausedTimeRef = useRef<number>(0);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const startTimer = () => {
    intervalRef.current = setInterval(() => {
      const now = Date.now();
      const elapsed = (now - startTimeRef.current - pausedTimeRef.current) / 1000;
      setDuration(elapsed);
    }, 100);
  };

  const stopTimer = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const requestPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setHasPermission(true);
      return stream;
    } catch (error) {
      console.error("Microphone permission denied:", error);
      setHasPermission(false);
      return null;
    }
  };

  const startRecording = async () => {
    const stream = await requestPermission();
    if (!stream) return;

    streamRef.current = stream;
    chunksRef.current = [];
    
    const mediaRecorder = new MediaRecorder(stream);
    mediaRecorderRef.current = mediaRecorder;

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };

    mediaRecorder.onstop = () => {
      const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
      onRecordingComplete(audioBlob, duration);
      
      // Cleanup
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    };

    mediaRecorder.start();
    setIsRecording(true);
    setIsPaused(false);
    startTimeRef.current = Date.now();
    pausedTimeRef.current = 0;
    setDuration(0);
    startTimer();
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      stopTimer();
      pausedTimeRef.current += Date.now() - startTimeRef.current;
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "paused") {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      startTimeRef.current = Date.now();
      startTimer();
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);
      stopTimer();
    }
  };

  if (hasPermission === false) {
    return (
      <div className="text-center">
        <p className="text-red-600 mb-4">マイクへのアクセスが拒否されました。</p>
        <Button onClick={() => setHasPermission(null)} variant="outline">
          再試行
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center space-y-6">
      {/* Recording Circle */}
      <div className="relative">
        <div
          className={cn(
            "w-32 h-32 rounded-full flex items-center justify-center transition-all duration-300",
            isRecording
              ? "bg-green-600 shadow-lg animate-pulse"
              : "bg-gray-100 hover:bg-gray-200 border-2 border-green-200"
          )}
        >
          <Mic
            className={cn(
              "w-12 h-12 transition-colors",
              isRecording ? "text-white" : "text-gray-600"
            )}
          />
        </div>
        
        {/* Recording indicator dot */}
        {isRecording && (
          <div className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full animate-pulse" />
        )}
      </div>

      {/* Timer */}
      {isRecording && (
        <div className="text-center">
          <div className="text-3xl font-mono font-bold text-green-600 mb-2">
            {formatTime(duration)}
          </div>
          <div className="text-sm text-gray-600">
            {isPaused ? "一時停止中..." : "録音中... 文字起こし中"}
          </div>
        </div>
      )}

      {/* Control Buttons */}
      <div className="flex space-x-4">
        {!isRecording ? (
          <Button
            onClick={startRecording}
            disabled={isProcessing}
            className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-md font-medium"
          >
            <Mic className="w-4 h-4 mr-2" />
            {isProcessing ? "処理中..." : "録音開始"}
          </Button>
        ) : (
          <>
            {!isPaused ? (
              <Button
                onClick={pauseRecording}
                variant="outline"
                className="px-4 py-2"
              >
                <Pause className="w-4 h-4 mr-2" />
                一時停止
              </Button>
            ) : (
              <Button
                onClick={resumeRecording}
                variant="outline"
                className="px-4 py-2"
              >
                <Play className="w-4 h-4 mr-2" />
                再開
              </Button>
            )}
            
            <Button
              onClick={stopRecording}
              variant="destructive"
              className="px-4 py-2"
            >
              <Square className="w-4 h-4 mr-2" />
              停止
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

