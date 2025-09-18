# -*- coding: utf-8 -*-
# stt.py — 文字起こし（Whisper）。faster-whisper を優先し、無ければ openai-whisper にフォールバック
import os
from typing import Dict, List, TypedDict, Union

# 日本語コメント：faster-whisper は高速・省メモリ。失敗したら openai-whisper を使う
USE_FASTER = True
try:
    from faster_whisper import WhisperModel  # type: ignore
except Exception:
    USE_FASTER = False
    import whisper as openai_whisper  # フォールバック  # type: ignore

# 日本語コメント：環境変数からモデル設定を読み込む
WHISPER_MODEL_SIZE = os.getenv("WHISPER_MODEL", "small")  # tiny/base/small/...
WHISPER_DEVICE = os.getenv("WHISPER_DEVICE", "cpu")
WHISPER_PREC = os.getenv("WHISPER_PREC", "int8")

# 日本語：返り値の型（補助）
class Segment(TypedDict):
    start: float
    end: float
    text: str

class TranscribeResult(TypedDict):
    text: str
    segments: List[Segment]

# 日本語コメント：モデルをあらかじめロードしておく（毎回ロードは重い）
if USE_FASTER:
    whisper_model = WhisperModel(
        WHISPER_MODEL_SIZE,
        device=WHISPER_DEVICE,
        compute_type=WHISPER_PREC
    )
else:
    size = "base" if WHISPER_MODEL_SIZE == "small" else WHISPER_MODEL_SIZE
    whisper_model = openai_whisper.load_model(size)  # type: ignore

def transcribe_file(path: str, language: Union[str, None] = None) -> TranscribeResult:
    """
    日本語：音声ファイルを転写し、全文テキストとセグメント配列を返します。
    return:
      {
        "text": "全文テキスト ...",
        "segments": [
          {"start": 0.12, "end": 2.34, "text": "この区間の文字列"},
          ...
        ]
      }
    """
    if USE_FASTER:
        # faster-whisper: segments はイテラブル（Segmentオブジェクト）
        # vad_filter=True は無音区間を除去してセグメントが安定しやすい
        it, _info = whisper_model.transcribe(
            path,
            language=language,
            vad_filter=True
        )
        seg_list: List[Segment] = []
        # it はジェネレータのことがあるので先にリスト化
        for seg in it:
            # seg.start / seg.end / seg.text を安全に float/str 化
            s: Segment = {
                "start": float(getattr(seg, "start", 0.0) or 0.0),
                "end": float(getattr(seg, "end", 0.0) or 0.0),
                "text": str(getattr(seg, "text", "") or "")
            }
            seg_list.append(s)

        full = "".join(s["text"] for s in seg_list).strip()
        return {"text": full, "segments": seg_list}

    # --- openai-whisper フォールバック ---
    result = whisper_model.transcribe(path, language=language or "ja")  # type: ignore
    raw = result.get("segments") or []
    seg_list = []
    for s in raw:
        # openai-whisper は dict で返る：{"start": 0.0, "end": 1.2, "text": "..."}
        seg_list.append({
            "start": float(s.get("start", 0.0) or 0.0),
            "end": float(s.get("end", 0.0) or 0.0),
            "text": str(s.get("text", "") or "")
        })
    full = (result.get("text") or "").strip()
    return {"text": full, "segments": seg_list}
