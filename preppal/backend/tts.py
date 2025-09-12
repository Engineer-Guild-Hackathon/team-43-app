# backend/tts.py
import hashlib
import os
import tempfile

from gtts import gTTS


def _tts_cache_path(text: str) -> str:
    h = hashlib.sha256(text.encode("utf-8")).hexdigest()[:16]
    out_dir = os.path.join(tempfile.gettempdir(), "preppal_tts")
    os.makedirs(out_dir, exist_ok=True)
    return os.path.join(out_dir, f"{h}.mp3")


def synthesize_to_file(text: str) -> str:
    """textをMP3にして一時フォルダへ保存し、そのパスを返す"""
    path = _tts_cache_path(text)
    if not os.path.exists(path):
        tts = gTTS(text=text, lang="ja")
        tts.save(path)
    return path
