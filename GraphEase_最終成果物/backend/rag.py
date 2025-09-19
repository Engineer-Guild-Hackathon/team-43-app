# -*- coding: utf-8 -*-
# rag.py — 配布資料RAGの最小実装（FAISS + sentence-transformers）
import os, json, uuid
from typing import List, Dict, Tuple
import numpy as np
import faiss

# ローカル埋め込み（軽量・無料）
from sentence_transformers import SentenceTransformer
_EMB_NAME = os.getenv("RAG_EMB_MODEL", "sentence-transformers/all-MiniLM-L6-v2")
_model = SentenceTransformer(_EMB_NAME)
DIM = 384  # 上モデルの出力次元

# 保存先（data/materials, data/rag）
BASE_DIR = os.path.abspath(os.path.dirname(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
MATS_DIR = os.path.join(DATA_DIR, "materials")
RAG_DIR  = os.path.join(DATA_DIR, "rag")
os.makedirs(MATS_DIR, exist_ok=True)
os.makedirs(RAG_DIR,  exist_ok=True)

INDEX_PATH = os.path.join(RAG_DIR, "faiss.index")
META_PATH  = os.path.join(RAG_DIR, "meta.jsonl")

# ---------- 各拡張子 → テキスト抽出 ----------
def extract_text_from_pdf(path: str) -> str:
    import pdfplumber
    out = []
    with pdfplumber.open(path) as pdf:
        for p in pdf.pages:
            out.append(p.extract_text() or "")
    return "\n".join(out).strip()

def extract_text_from_docx(path: str) -> str:
    import docx
    doc = docx.Document(path)
    return "\n".join(p.text or "" for p in doc.paragraphs).strip()

def extract_text_from_xlsx(path: str) -> str:
    import pandas as pd
    out = []
    xls = pd.ExcelFile(path)
    for sheet in xls.sheet_names:
        df = xls.parse(sheet, dtype=str).fillna("")
        out.append(f"### Sheet: {sheet}")
        out.append("\n".join(" ".join(map(str, row)) for _, row in df.iterrows()))
    return "\n".join(out).strip()

def extract_text_any(path: str) -> Tuple[str, str]:
    """(kind, text) を返す"""
    low = path.lower()
    if low.endswith(".pdf"):  return "pdf",  extract_text_from_pdf(path)
    if low.endswith(".docx"): return "docx", extract_text_from_docx(path)
    if low.endswith(".xlsx") or low.endswith(".xls"): return "xlsx", extract_text_from_xlsx(path)
    if low.endswith(".txt"):
        try:
            with open(path, "r", encoding="utf-8") as f: return "txt", f.read()
        except:
            with open(path, "r", encoding="cp932", errors="ignore") as f: return "txt", f.read()
    return "unknown", ""

# ---------- チャンク分割（素朴） ----------
def chunk_text(text: str, size: int = 800, overlap: int = 120) -> List[str]:
    text = text.replace("\r\n", "\n")
    out, i, n = [], 0, len(text)
    while i < n:
        out.append(text[i:i+size])
        i += max(1, size - overlap)
    return [c.strip() for c in out if c.strip()]

# ---------- FAISS の読み書き ----------
def _load_or_new_index() -> faiss.IndexFlatIP:
    if os.path.exists(INDEX_PATH):
        return faiss.read_index(INDEX_PATH)
    return faiss.IndexFlatIP(DIM)  # 内積類似度

def _save_index(index: faiss.IndexFlatIP):
    faiss.write_index(index, INDEX_PATH)

def _append_meta(rows: List[Dict]):
    with open(META_PATH, "a", encoding="utf-8") as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")

def _load_all_meta() -> List[Dict]:
    if not os.path.exists(META_PATH): return []
    out = []
    with open(META_PATH, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line: continue
            try: out.append(json.loads(line))
            except: pass
    return out

def _encode(texts: List[str]) -> np.ndarray:
    vecs = _model.encode(texts, normalize_embeddings=True)
    return np.array(vecs, dtype="float32")

# ---------- 追加 & 検索 ----------
def add_material_and_index(title: str, filepath: str) -> Dict:
    """ファイルから抽出→分割→埋め込み→FAISS 追加"""
    kind, text = extract_text_any(filepath)
    if not text:
        return {"ok": False, "error": "テキスト抽出に失敗", "kind": kind}
    chunks = chunk_text(text)
    if not chunks:
        return {"ok": False, "error": "有効なテキストなし", "kind": kind}

    vecs = _encode(chunks)
    index = _load_or_new_index()
    index.add(vecs)
    _save_index(index)

    mat_id = str(uuid.uuid4())
    rows = []
    for i, ch in enumerate(chunks):
        rows.append({"mat_id": mat_id, "title": title, "filepath": filepath, "kind": kind, "chunk_id": i, "text": ch})
    _append_meta(rows)
    return {"ok": True, "mat_id": mat_id, "chunks": len(chunks), "kind": kind}

def search_similar(query: str, top_k: int = 5) -> List[Dict]:
    meta = _load_all_meta()
    if not meta: return []
    index = _load_or_new_index()
    if index.ntotal == 0: return []
    qv = _encode([query])
    scores, idxs = index.search(qv, top_k)
    res = []
    for score, idx in zip(scores[0], idxs[0]):
        if 0 <= idx < len(meta):
            m = dict(meta[idx])
            m["_score"] = float(score)
            res.append(m)
    return res
