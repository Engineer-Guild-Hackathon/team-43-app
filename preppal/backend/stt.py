# -*- coding: utf-8 -*-
# stt.py — 文字起こし（Whisper）。faster-whisper を優先し、無ければ openai-whisper にフォールバック
import os

# 日本語コメント：faster-whisper は高速・省メモリ。失敗したら openai-whisper を使う
USE_FASTER = True
try:
    from faster_whisper import WhisperModel
except Exception:
    USE_FASTER = False
    import whisper as openai_whisper  # フォールバック

# 日本語コメント：環境変数からモデル設定を読み込む
WHISPER_MODEL_SIZE = os.getenv("WHISPER_MODEL", "small")  # tiny/base/small/...
WHISPER_DEVICE = os.getenv("WHISPER_DEVICE", "cpu")
WHISPER_PREC = os.getenv("WHISPER_PREC", "int8")

# 日本語コメント：モデルをあらかじめロードしておく（毎回ロードは重い）
if USE_FASTER:
    whisper_model = WhisperModel(WHISPER_MODEL_SIZE, device=WHISPER_DEVICE, compute_type=WHISPER_PREC)
else:
    size = "base" if WHISPER_MODEL_SIZE == "small" else WHISPER_MODEL_SIZE
    whisper_model = openai_whisper.load_model(size)

def transcribe_file(path: str, language: str | None = None) -> str:
    """日本語：音声ファイルパスを受け取り、テキストにして返す"""
    if USE_FASTER:
        segments, _ = whisper_model.transcribe(path, language=language, vad_filter=True)
        return "".join(seg.text for seg in segments).strip()
    else:
        result = whisper_model.transcribe(path, language=language or "ja")
        return (result.get("text") or "").strip()
