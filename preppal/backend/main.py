# -*- coding: utf-8 -*-
"""
main.py — FastAPI：フロント配信 + API
機能:
- 録音アップロード → 文字起こし → 要約 → 保存
- 一覧 / 詳細 取得、タイトル編集
- リマインド登録（別スレッドで送信）
- 入力した重要文を重み付けにして再要約
- 要約（または転写）の読み上げ（MP3を返す）

前提: 同ディレクトリにある下記モジュールを利用します
- stt.py        … transcribe_file()
- summarizer.py … summarize(), make_weighted_summary()
- storage.py    … add_record(), get_record(), list_records_light(), update_title(), add_reminder()
- reminders.py  … start()
- tts.py        … synthesize_to_file(text) -> mp3一時ファイルパス
"""

from __future__ import annotations
import os
import tempfile
from uuid import uuid4
from datetime import datetime, timedelta
from typing import Optional

from fastapi import (
    FastAPI, UploadFile, File, Form, Body, HTTPException
)
from fastapi.responses import (
    JSONResponse, HTMLResponse, PlainTextResponse, FileResponse
)
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

# 自作モジュール
from .stt import transcribe_file
from .summarizer import summarize, make_weighted_summary
from .storage import (
    add_record, get_record, list_records_light, update_title as storage_update_title,
    add_reminder as storage_add_reminder
)
from .reminders import start as start_reminders
from .tts import synthesize_to_file


# ===== FastAPI アプリ準備 =====
app = FastAPI(title="PrepPal — STT + Summary")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_credentials=True,
    allow_methods=["*"], allow_headers=["*"],
)

# ===== 静的ファイル配信（/ と /assets）=====
FRONT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend"))
ASSETS_DIR = os.path.join(FRONT_DIR, "assets")

@app.get("/", response_class=HTMLResponse)
def index():
    """トップページ（録音UI＋一覧＋詳細＋編集＋リマインド）"""
    return FileResponse(os.path.join(FRONT_DIR, "index.html"))

app.mount("/assets", StaticFiles(directory=ASSETS_DIR), name="assets")

@app.get("/favicon.ico")
def favicon():
    return PlainTextResponse("", status_code=204)


# ===== API =====
@app.post("/api/transcribe_and_summarize")
async def transcribe_and_summarize(
    audio: UploadFile = File(...),
    language: Optional[str] = Form(None),
    duration_sec: Optional[float] = Form(None),
):
    """音声→文字起こし→要約→保存→結果返却"""
    # 一時保存
    with tempfile.NamedTemporaryFile(delete=False, suffix=".webm") as tmp:
        contents = await audio.read()
        tmp.write(contents)
        tmp_path = tmp.name

    try:
        # 文字起こし
        transcript = transcribe_file(tmp_path, language=language or "ja")
        # 要約
        summary = summarize(transcript)

        # 保存
        rec = {
            "id": str(uuid4()),
            "title": audio.filename or "recording",
            "created_at": datetime.utcnow().isoformat(),
            "duration_sec": float(duration_sec) if duration_sec is not None else None,
            "transcript": transcript,
            "summary": summary,
            "highlights": [],  # 重み付き再要約用に保持
        }
        add_record(rec)

        return JSONResponse({"id": rec["id"], "transcript": transcript, "summary": summary})
    finally:
        try:
            os.remove(tmp_path)
        except Exception:
            pass


@app.get("/api/recordings")
def list_recordings():
    """Recent（軽量）"""
    return list_records_light()


@app.get("/api/recordings/{rid}")
def get_recording(rid: str):
    """詳細（転写・要約）"""
    r = get_record(rid)
    if not r:
        return JSONResponse({"error": "not found"}, status_code=404)
    return r


@app.post("/api/recordings/{rid}/title")
def update_title(rid: str, title: str = Form(...)):
    """録音タイトルを更新"""
    if not title.strip():
        return JSONResponse({"ok": False, "error": "空のタイトルは設定できません"}, status_code=400)
    ok = storage_update_title(rid, title.strip())
    if ok:
        return {"ok": True}
    raise HTTPException(status_code=404, detail="recording not found")


@app.post("/api/reminders")
def add_reminder(
    recording_id: str = Form(...),
    email: Optional[str] = Form(None),
    goal_date: Optional[str] = Form(None),
    demo: Optional[str] = Form(None),  # "true" なら30秒後
):
    """
    - demo="true" → 30秒後
    - goal_date(YYYY-MM-DD) → 残期間の約20%（30日超は約10%）を初回間隔に
    """
    rec = get_record(recording_id)
    title = rec["title"] if rec else "Recording"

    now = datetime.utcnow()
    if (demo or "").lower() == "true":
        due = now + timedelta(seconds=30)
    else:
        if not goal_date:
            return JSONResponse({"error": "goal_date が必要です（例: 2025-09-20）"}, status_code=400)
        goal = datetime.fromisoformat(goal_date)
        days = max((goal - now).days, 1)
        ratio = 0.20 if days <= 30 else 0.10
        due = now + timedelta(days=max(int(days * ratio), 1))

    storage_add_reminder({
        "id": str(uuid4()),
        "email": email,
        "due_at": due,
        "title": title,
        "recording_id": recording_id,
        "sent": False,
    })
    return {"next_review_at": due.isoformat(), "will_email": bool(email)}


# ===== リマインド監視ループ開始 =====
start_reminders()


@app.post("/api/recordings/{rid}/resummarize_from_text")
def resummarize_from_text(rid: str, payload: dict = Body(...)):
    """
    入力した重要センテンス（改行区切り）を重み付きハイライトとして扱い、要約を作り直す。
    payload 例: {"text":"行ごとに重要文", "boost":2.0}
    """
    rec = get_record(rid)
    if not rec:
        raise HTTPException(status_code=404, detail="recording not found")

    raw = (payload.get("text") or "").strip()
    boost = float(payload.get("boost", 2.0))
    if not raw:
        raise HTTPException(status_code=400, detail="text is empty")

    wants = [ln.strip() for ln in raw.replace("\r\n", "\n").split("\n") if ln.strip()]
    rec["highlights"] = [{"text": w, "weight": boost} for w in wants]

    # 要約を作り直す（summarizer.py 側でAPIキーなどは内部処理）
    new_summary = make_weighted_summary(rec.get("transcript", ""), rec["highlights"])
    if new_summary:
        rec["summary"] = new_summary

    return {"ok": True, "summary": rec["summary"], "highlights": rec["highlights"]}


@app.get("/api/tts/{rid}")
def tts_summary(rid: str, field: str = "summary"):
    """
    要約（または transcript）を読み上げて MP3 を返す。
    例: /api/tts/<id>?field=summary
    """
    rec = get_record(rid)
    if not rec:
        raise HTTPException(status_code=404, detail="recording not found")

    target_field = field or "summary"
    text = (rec.get(target_field) or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="nothing to read")

    mp3_path = synthesize_to_file(text)  # 一時ファイルパス
    return FileResponse(mp3_path, media_type="audio/mpeg", filename=f"{rid}-{target_field}.mp3")


# ===== 直接起動用 =====
if __name__ == "__main__":
    import uvicorn
    # Windows向けに reload=False
    uvicorn.run(app, host="127.0.0.1", port=8000, reload=False)
