# -*- coding: utf-8 -*-
"""
main.py — FastAPI：フロント配信(任意) + API
機能:
- 録音アップロード → 文字起こし → 要約 → 保存
- 一覧 / 詳細 取得、タイトル編集
- リマインド登録（別スレッドで送信）
- 入力した重要文を重み付けにして再要約
- 要約（または転写）の読み上げ（MP3を返す）

ポイント（この版の変更点）:
- 以前は frontend/ が無いと RuntimeError で落ちていました。
- 本版では frontend/ が無くても **APIのみで起動**できます（= Next.js 別起動でもOK）。
- frontend/ が見つかったときだけ、静的配信(/assets) と "/" の index を有効化します。
"""

from __future__ import annotations
import os
import tempfile
import shutil
from uuid import uuid4
from datetime import datetime, timedelta
from typing import Optional

from fastapi import FastAPI, UploadFile, File, Form, Body, HTTPException
from fastapi.responses import JSONResponse, HTMLResponse, PlainTextResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
# 既存 import 群の下あたりに追加（既にあるものは重複不要）
from fastapi import Form

# =========================
# 自作モジュールの読み込み
# =========================
from .stt import transcribe_file  # 音声→文字起こし
from .summarizer import summarize, make_weighted_summary  # 要約/重み付き再要約
from .storage import (
    add_record, get_record, list_records_light,
    update_title as storage_update_title,
    add_reminder as storage_add_reminder,
)
from .reminders import start as start_reminders  # リマインド監視ループ開始
from .tts import synthesize_to_file  # テキスト→MP3

# ---- RAG は任意（インストール状況に応じて自動OFF）----
try:
    from . import rag
    RAG_AVAILABLE = True
except Exception as _e:
    print("[INFO] RAG disabled:", _e)
    RAG_AVAILABLE = False


# =============================================================================
# フロントのパス解決（任意に変更）
# - 見つかった場合のみ静的配信を有効化
# - 見つからなくてもエラーにせず API のみで起動
# =============================================================================
BACKEND_DIR = os.path.abspath(os.path.dirname(__file__))
CANDIDATES = [
    # 例: backend/../frontend
    os.path.abspath(os.path.join(BACKEND_DIR, "..", "frontend")),
    # 例: (実行CWD)/frontend
    os.path.abspath(os.path.join(os.getcwd(), "frontend")),
]
FRONT_DIR = next((p for p in CANDIDATES if os.path.isdir(p)), None)

# =============================================================================
# 録音ファイルの保存先（元音声を配信用に残す）
# =============================================================================
DATA_DIR = os.path.join(BACKEND_DIR, "data")
RECORDINGS_DIR = os.path.join(DATA_DIR, "recordings")
os.makedirs(RECORDINGS_DIR, exist_ok=True)

# =============================================================================
# FastAPI アプリ準備 + CORS
# =============================================================================
app = FastAPI(title="PrepPal — STT + Summary (API)")

# 日本語：開発中はオリジンを広めに許可（必要に応じて絞ってください）
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # 例: ["http://localhost:3000", "http://192.168.56.1:3000"]
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =============================================================================
# 静的ファイル配信（frontend がある場合のみ）
# =============================================================================
if FRONT_DIR:
    ASSETS_DIR = os.path.join(FRONT_DIR, "assets")
    if os.path.isdir(ASSETS_DIR):
        # 例）http://127.0.0.1:8000/assets/app.js → frontend/assets/app.js
        app.mount("/assets", StaticFiles(directory=ASSETS_DIR), name="assets")

    @app.get("/", response_class=HTMLResponse)
    def index():
        """トップページ（frontend/index.html を返す。無ければ簡易メッセージ）"""
        index_path = os.path.join(FRONT_DIR, "index.html")
        if not os.path.isfile(index_path):
            # 日本語：index.html が無い場合の簡易応答
            return HTMLResponse("<h1>Frontend not found</h1><p>API は動作中です。</p>", status_code=200)
        return FileResponse(index_path)
else:
    @app.get("/", response_class=PlainTextResponse)
    def root_health():
        """フロント無しモード用のヘルスエンドポイント"""
        return PlainTextResponse("API is running (frontend not mounted).", status_code=200)

# favicon（無ければ 204）
@app.get("/favicon.ico")
def favicon():
    return PlainTextResponse("", status_code=204)


# =============================================================================
# API 本体
# =============================================================================

@app.post("/api/transcribe_and_summarize")
async def transcribe_and_summarize(
    audio: UploadFile = File(...),
    language: Optional[str] = Form(None),
    duration_sec: Optional[float] = Form(None),
    use_rag: Optional[bool] = Form(False),  # true ならRAG文脈を付与
):
    """
    日本語：音声→文字起こし→（任意RAG文脈付）要約→保存→結果返却
    - segments（区間情報）は同期ハイライト用に保持
    - 元音声は backend/data/recordings/<id>.webm として残す
    """
    # --- 一時保存（UploadFile をファイルに落とす） ---
    with tempfile.NamedTemporaryFile(delete=False, suffix=".webm") as tmp:
        contents = await audio.read()
        tmp.write(contents)
        tmp_path = tmp.name

    rid = str(uuid4())

    try:
        # --- 文字起こし（dict or str 両対応） ---
        ret_stt = transcribe_file(tmp_path, language=language or "ja")
        if isinstance(ret_stt, dict):
            transcript = ret_stt.get("text", "") or ""
            segments   = ret_stt.get("segments", []) or []
        else:
            transcript = str(ret_stt or "")
            segments   = []

        # --- RAG（任意） ---
        rag_context = ""
        if use_rag and RAG_AVAILABLE:
            try:
                hits = rag.search_similar(transcript, top_k=5)
                ctx_lines = [f"{h.get('text','')}" for h in hits]
                rag_context = "\n\n".join(ctx_lines)[:4000]
            except Exception as e:
                print("[WARN] RAG search failed:", e)

        # --- 要約 ---
        if rag_context:
            prompt_body = transcript + "\n\n---\n参考資料:\n" + rag_context
            summary = summarize(prompt_body)
        else:
            summary = summarize(transcript)

        # --- 元音声の恒久保存（失敗しても致命ではない） ---
        final_audio_path = os.path.join(RECORDINGS_DIR, f"{rid}.webm")
        try:
            shutil.move(tmp_path, final_audio_path)
            tmp_path = None  # finally で消さない
        except Exception as e:
            print("[WARN] failed to move audio:", e)
            final_audio_path = None

        # --- 保存（storage.py に辞書ごと渡す） ---
        rec = {
            "id": rid,
            "title": audio.filename or "recording",
            "created_at": datetime.utcnow().isoformat(),
            "duration_sec": float(duration_sec) if duration_sec is not None else None,
            "transcript": transcript,
            "segments": segments,
            "summary": summary,
            "audio_path": final_audio_path,
            "highlights": [],  # 重み付き再要約で使う
        }
        add_record(rec)

        return JSONResponse({"id": rec["id"], "transcript": transcript, "summary": summary})

    finally:
        # 日本語：move 済みなら tmp_path は None。None でないときのみ削除。
        if tmp_path:
            try:
                os.remove(tmp_path)
            except Exception:
                pass


@app.get("/api/recordings")
def list_recordings():
    """日本語：軽量一覧（Recent）"""
    return list_records_light()


@app.get("/api/recordings/{rid}")
def get_recording(rid: str):
    """日本語：詳細（転写・要約）"""
    r = get_record(rid)
    if not r:
        return JSONResponse({"error": "not found"}, status_code=404)
    return r


@app.get("/api/recordings/{rid}/audio")
def get_recording_audio(rid: str):
    """日本語：保存している元音声（webm）を返す。同期ハイライト再生で使用。"""
    r = get_record(rid)
    if not r:
        raise HTTPException(status_code=404, detail="recording not found")
    path = r.get("audio_path")
    if not path or (not os.path.exists(path)):
        raise HTTPException(status_code=404, detail="audio not found")
    return FileResponse(path, media_type="audio/webm", filename=f"{rid}.webm")


# ★ ルールベースの超軽量クイズ生成（要約 -> 3問程度）
def make_quiz_from_summary(summary: str, difficulty: str = "normal"):
    # 句点で分割して短文を拾う
    sents = [s.strip() for s in summary.replace("\r\n", "\n").split("。") if s.strip()]
    # 穴埋め候補（名詞っぽい単語をざっくり：全角/半角英数と長めのカタカナ等）
    import re
    def blanks(sent):
        cands = re.findall(r"[A-Za-z0-9_+\-*/^()]+|[ァ-ヴー]{3,}|[A-Za-z][a-z]{2,}", sent)
        return [c for c in cands if len(c) >= 3][:1]  # 1個だけ空欄化

    questions = []
    for s in sents[:5]:
        keys = blanks(s)
        if not keys:
            # ○×にする
            q = {"type": "bool", "q": s, "a": "正しい", "difficulty": difficulty}
        else:
            k = keys[0]
            q = {
                "type": "cloze",
                "q": s.replace(k, "____"),
                "a": k,
                "difficulty": difficulty
            }
        questions.append(q)

    if not questions:
        questions = [{"type": "short", "q": "要約のキーワードは？", "a": summary[:20], "difficulty": difficulty}]
    return questions[:3]

# === クイズAPI ===
from .storage import add_quiz, list_quizzes_light, get_quiz

@app.post("/api/quizzes/from_summary")
def create_quiz_from_summary(
    recording_id: Optional[str] = Form(None),
    title: str = Form(...),
    summary: str = Form(...),
    category: Optional[str] = Form("general"),
    difficulty: Optional[str] = Form("normal"),
):
    qs = make_quiz_from_summary(summary, difficulty=difficulty)
    qid = str(uuid4())
    quiz = {
        "id": qid,
        "title": title,
        "category": category,
        "difficulty": difficulty,
        "created_at": datetime.utcnow().isoformat(),
        "recording_id": recording_id,
        "questions": qs,
    }
    add_quiz(quiz)
    return {"ok": True, "quiz": {"id": qid, "title": title, "category": category,
                                 "difficulty": difficulty, "num_questions": len(qs)}}

@app.get("/api/quizzes")
def list_quizzes():
    return {"quizzes": list_quizzes_light()}

@app.get("/api/quizzes/{qid}")
def get_quiz_detail(qid: str):
    q = get_quiz(qid)
    if not q:
        raise HTTPException(status_code=404, detail="quiz not found")
    return q


@app.post("/api/materials/upload")
async def upload_material(file: UploadFile = File(...), title: Optional[str] = Form(None)):
    """
    日本語：PDF/Word/Excel/TXT を受け取り、抽出→分割→埋め込み→FAISSに追加
    - RAG が無効のときは 503 を返す
    """
    if not RAG_AVAILABLE:
        return JSONResponse({"ok": False, "error": "RAG disabled"}, status_code=503)

    fname = f"{uuid4()}_{file.filename}"
    tmp = os.path.join(tempfile.gettempdir(), fname)
    final = os.path.join(rag.MATS_DIR, fname)

    with open(tmp, "wb") as f:
        f.write(await file.read())
    try:
        shutil.move(tmp, final)
    except Exception:
        final = tmp  # 移動失敗時は一時のまま

    title = title or file.filename or "material"
    ret = rag.add_material_and_index(title=title, filepath=final)
    return JSONResponse(ret, status_code=200 if ret.get("ok") else 400)


@app.post("/api/recordings/{rid}/title")
def update_title(rid: str, title: str = Form(...)):
    """日本語：録音タイトルを更新"""
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
    goal_date: Optional[str] = Form(None),  # YYYY-MM-DD
    demo: Optional[str] = Form(None),       # "true" なら30秒後
):
    """
    日本語：
    - demo="true" → 30秒後にリマインド
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
        goal = datetime.fromisoformat(goal_date)  # "YYYY-MM-DD" もOK
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


@app.post("/api/recordings/{rid}/resummarize_from_text")
def resummarize_from_text(rid: str, payload: dict = Body(...)):
    """
    日本語：
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
    日本語：
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


@app.post("/api/recordings/{rid}/update")
def update_recording_fields(
    rid: str,
    title: Optional[str] = Form(None),
    summary: Optional[str] = Form(None),
    transcript: Optional[str] = Form(None),
    category: Optional[str] = Form(None),
):
    """
    日本語：
    - 任意のフィールド（title/summary/transcript/category）を部分更新
    - storage.get_record() が dict を返す実装なら、その場で書き換えで OK
      （もしファイル永続化が必要なら、storage.py に update_fields を用意して呼び出してください）
    """
    r = get_record(rid)
    if not r:
        raise HTTPException(status_code=404, detail="recording not found")

    changed = False
    if title is not None:
        r["title"] = title.strip()
        changed = True
    if summary is not None:
        r["summary"] = summary
        changed = True
    if transcript is not None:
        r["transcript"] = transcript
        changed = True
    if category is not None:
        r["category"] = category
        changed = True

    return {"ok": True, "changed": changed, "record": r}

# =============================================================================
# 直接起動（python -m backend.main）
# =============================================================================
if __name__ == "__main__":
    import uvicorn
    # 日本語：Windows向けに reload=False（ファイルロック回避のため）
    uvicorn.run(app, host="127.0.0.1", port=8000, reload=False)
