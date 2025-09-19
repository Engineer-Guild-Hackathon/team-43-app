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
import shutil  # ★ 追加
import tempfile
from datetime import datetime, timedelta
from typing import Optional
from uuid import uuid4

from fastapi import Body, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse, PlainTextResponse
from fastapi.staticfiles import StaticFiles

from . import rag  # ★ 追加：RAGモジュールを使う
from .reminders import start as start_reminders
from .storage import add_record, get_record, list_records_light
from .storage import add_reminder as storage_add_reminder
from .storage import update_title as storage_update_title

# 自作モジュール
from .stt import transcribe_file
from .summarizer import make_weighted_summary, summarize
from .tts import synthesize_to_file

# =============================================================================
# フロントのパス解決（堅牢版）
# =============================================================================
# 1) backend/ から見た ../frontend を最優先
# 2) 実行CWDからの ./frontend もフォールバックで許容
BACKEND_DIR = os.path.abspath(os.path.dirname(__file__))
CANDIDATES = [
    os.path.abspath(os.path.join(BACKEND_DIR, "..", "frontend")),
    os.path.abspath(os.path.join(os.getcwd(), "frontend")),
]
FRONT_DIR = next((p for p in CANDIDATES if os.path.isdir(p)), None)
if not FRONT_DIR:
    raise RuntimeError(
        "frontend フォルダが見つかりません。以下のいずれかに配置してください：\n"
        f"  - {os.path.abspath(os.path.join(BACKEND_DIR, '..', 'frontend'))}\n"
        f"  - {os.path.abspath(os.path.join(os.getcwd(), 'frontend'))}"
    )

ASSETS_DIR = os.path.join(FRONT_DIR, "assets")
if not os.path.isdir(ASSETS_DIR):
    raise RuntimeError(
        f"assets フォルダが見つかりません: {ASSETS_DIR}\nfrontend/assets に style.css / app.js を配置してください。"
    )

# =============================================================================
# 録音ファイルの保存先（元音声を配信用に残す）
# =============================================================================
DATA_DIR = os.path.join(BACKEND_DIR, "data")
RECORDINGS_DIR = os.path.join(DATA_DIR, "recordings")
os.makedirs(RECORDINGS_DIR, exist_ok=True)


# =============================================================================
# FastAPI アプリ準備
# =============================================================================
app = FastAPI(title="PrepPal — STT + Summary")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---- 静的ファイル配信（/assets と /） ----
# 例）http://127.0.0.1:8000/assets/app.js → frontend/assets/app.js
app.mount("/assets", StaticFiles(directory=ASSETS_DIR), name="assets")


@app.get("/", response_class=HTMLResponse)
def index():
    """トップページ（index.html を返す）"""
    index_path = os.path.join(FRONT_DIR, "index.html")
    if not os.path.isfile(index_path):
        return PlainTextResponse("frontend/index.html が見つかりません。", status_code=500)
    return FileResponse(index_path)


# favicon 無しのときは 204 を返す（ログが気になるなら /assets/favicon.ico を置く）
@app.get("/favicon.ico")
def favicon():
    return PlainTextResponse("", status_code=204)


# =============================================================================
# API
# =============================================================================
@app.post("/api/transcribe_and_summarize")
async def transcribe_and_summarize(
    audio: UploadFile = File(...),
    language: Optional[str] = Form(None),
    duration_sec: Optional[float] = Form(None),
    use_rag: Optional[bool] = Form(False),  # RAGを使うか
):
    """音声→文字起こし→要約→保存→結果返却（segments と元音声保存に対応）"""
    # 一時保存
    with tempfile.NamedTemporaryFile(delete=False, suffix=".webm") as tmp:
        contents = await audio.read()
        tmp.write(contents)
        tmp_path = tmp.name

    # 新規ID（元音声の保存にも使う）
    rid = str(uuid4())

    try:
        # 文字起こし（dict/str 両対応）
        ret_stt = transcribe_file(tmp_path, language=language or "ja")

        if isinstance(ret_stt, dict):
            transcript = ret_stt.get("text", "") or ""
            segments = ret_stt.get("segments", []) or []
        else:
            # ret_stt が str（テキストのみ）の場合
            transcript = str(ret_stt or "")
            segments = []

        # --- RAG（任意） ---
        rag_context = ""
        if use_rag:
            hits = rag.search_similar(transcript, top_k=5)
            ctx_lines = [f"【{h.get('title', 'material')}】{h.get('text', '')}" for h in hits]
            rag_context = "\n\n".join(ctx_lines)[:4000]

        # 要約（RAG文脈があれば一緒に渡す）
        if rag_context:
            summary = summarize(transcript + "\n\n---\n参考資料:\n" + rag_context)
        else:
            summary = summarize(transcript)

        # 元音声を恒久保存（/backend/data/recordings/<id>.webm）
        final_audio_path = os.path.join(RECORDINGS_DIR, f"{rid}.webm")
        try:
            shutil.move(tmp_path, final_audio_path)
            tmp_path = None  # 以降の finally で消さない
        except Exception:
            # move に失敗したら、そのまま tmp を残して続行（致命傷ではない）
            final_audio_path = None

        # 保存（storage.py は辞書に未知キーがあってもそのまま保持できる想定）
        rec = {
            "id": rid,
            "title": audio.filename or "recording",
            "created_at": datetime.utcnow().isoformat(),
            "duration_sec": float(duration_sec) if duration_sec is not None else None,
            "transcript": transcript,
            "segments": segments,  # 同期ハイライト用
            "summary": summary,
            "audio_path": final_audio_path,  # 元音声のローカルパス
            "highlights": [],  # 重み付き再要約用に保持
        }
        add_record(rec)

        return JSONResponse({"id": rec["id"], "transcript": transcript, "summary": summary})
    except FileNotFoundError as fe:
        raise HTTPException(status_code=400, detail=str(fe))
    except Exception as e:
        raise HTTPException(status_code=421, detail=str(e))

    finally:
        # tmp を move 済みなら None にしているので消さない
        if tmp_path:
            try:
                os.remove(tmp_path)
            except Exception:
                pass


@app.get("/api/recordings")
def list_recordings():
    """Recent（軽量一覧）"""
    return list_records_light()


@app.get("/api/recordings/{rid}")
def get_recording(rid: str):
    """詳細（転写・要約）"""
    r = get_record(rid)
    if not r:
        return JSONResponse({"error": "not found"}, status_code=404)
    return r


@app.get("/api/recordings/{rid}/audio")
def get_recording_audio(rid: str):
    """保存している元音声（webm）を返す。同期ハイライトの基準として再生に使用。"""
    r = get_record(rid)
    if not r:
        raise HTTPException(status_code=404, detail="recording not found")
    path = r.get("audio_path")
    if not path or (not os.path.exists(path)):
        raise HTTPException(status_code=404, detail="audio not found")
    return FileResponse(path, media_type="audio/webm", filename=f"{rid}.webm")


@app.post("/api/materials/upload")
async def upload_material(file: UploadFile = File(...), title: Optional[str] = Form(None)):
    """PDF/Word/Excel/TXT を受け取り、抽出→分割→埋め込み→FAISSに追加"""
    import shutil

    fname = f"{uuid4()}_{file.filename}"
    tmp = os.path.join(tempfile.gettempdir(), fname)
    final = os.path.join(rag.MATS_DIR, fname)

    with open(tmp, "wb") as f:
        f.write(await file.read())
    try:
        shutil.move(tmp, final)
    except:
        final = tmp  # 移動失敗時は一時のまま

    title = title or file.filename or "material"
    ret = rag.add_material_and_index(title=title, filepath=final)
    return JSONResponse(ret, status_code=200 if ret.get("ok") else 400)


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
        # fromisoformat は "YYYY-MM-DD" もOK
        goal = datetime.fromisoformat(goal_date)
        days = max((goal - now).days, 1)
        ratio = 0.20 if days <= 30 else 0.10
        due = now + timedelta(days=max(int(days * ratio), 1))

    storage_add_reminder(
        {
            "id": str(uuid4()),
            "email": email,
            "due_at": due,
            "title": title,
            "recording_id": recording_id,
            "sent": False,
        }
    )
    return {"next_review_at": due.isoformat(), "will_email": bool(email)}


# ---- リマインド監視ループ開始 ----
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

    # 要約を作り直す
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


# =============================================================================
# 直接起動（python -m backend.main）
# =============================================================================
if __name__ == "__main__":
    import uvicorn

    # Windows向けに reload=False
    uvicorn.run(app, host="127.0.0.1", port=8000, reload=False)
