"use client";

import { RecordingLight } from "@/types";
import { formatDuration, formatDate } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

interface RecentRecordingsProps {
  recordings: RecordingLight[];
  onRecordingClick?: (recording: RecordingLight) => void;
}

export function RecentRecordings({ recordings, onRecordingClick }: RecentRecordingsProps) {
  if (recordings.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-gray-500">
          まだ録音がありません
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900">最近の録音</h3>
      
      <div className="space-y-3">
        {recordings.map((recording) => (
          <Card
            key={recording.id}
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => onRecordingClick?.(recording)}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900 truncate">
                    {recording.title}
                  </h4>
                  <p className="text-sm text-gray-600">
                    {formatDate(recording.created_at)}
                  </p>
                </div>
                
                <div className="flex items-center space-x-3">
                  <span className="text-sm font-mono text-gray-500">
                    {formatDuration(recording.duration_sec)}
                  </span>
                  <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                    文字起こし済み
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

