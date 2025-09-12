# -*- coding: utf-8 -*-
# summarizer.py — Gemini 1.5 Flash で要約（フォールバックあり）
import os
import google.generativeai as genai

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "AIzaSyDAUO5T3sHD9YbtidgEOFdqlJ5wC1QfSX8")
gemini = None
if GEMINI_API_KEY:
    try:
        genai.configure(api_key=GEMINI_API_KEY)
        gemini = genai.GenerativeModel("gemini-1.5-flash")
    except Exception as e:
        print("[WARN] Gemini 初期化失敗:", e)
        gemini = None

PROMPT_TEMPLATE = """あなたは厳密で丁寧な日本語要約者です。以下の「本文」は講義/会議の文字起こしです。
推測や創作はせず、本文に含まれる事実のみを基に、規定の体裁で**Markdown**を出力してください。
箇条書きは各行1文で簡潔に。代名詞は可能な限り具体化してください。

# 出力フォーマット（この見出し名と順序を厳守）
## 見出し
- 8〜20文字、内容の核を短く表す

## 要点
- 3〜5行。重要事項・決定事項・理由・数値など、具体性を優先
- 主語を明確化（誰が／何が）

## キーワード
- 3〜6語。読点（、）で区切る。固有名詞や専門用語を優先

## ToDo
- 2〜3行。担当者が本文にあれば（担当: 氏名）を付す。締切が本文にあれば日付を明記
- 不明な点は「（期限不明）」のように明記

---
## 学習用付録（任意）
- 用語メモ（最大5項目、形式：用語：短い定義）
- 重要引用（最大3件、原文の短い抜粋を「…」で括る。可能なら[mm:ss]のタイムスタンプ）
- 確認すべき未決事項（最大3件）
- 復習用Q&A（3〜5組、形式：Q: … / A: …）

# ルール
- 本文にない情報は書かない。推測しない。
- 数値・日時・場所は原文どおりに。
- ノイズや言い直しは要点に入れない。
- 可能なら時系列で重要事項を整理。

本文:
{body}
"""


def summarize(text: str) -> str:
    """日本語：テキストを受け取り、要約文を返す（Gemini→失敗時フォールバック）"""
    if gemini:
        try:
            res = gemini.generate_content(PROMPT_TEMPLATE.format(body=text))
            return (res.text or "").strip()
        except Exception as e:
            return f"（Gemini要約に失敗: {e}）\n- {text[:120]}..."
    # フォールバック（簡易）
    lines = [l for l in text.split("。") if l.strip()]
    head = (lines[0][:20] + "…") if lines else "要約"
    pts  = "\n- " + "\n- ".join(lines[:3]) if lines else "- （要点なし）"
    return f"{head}{pts}"


# === 追加：重み付き再要約（Geminiがあれば使う / なくても簡易版で動く） ===
from typing import List, Dict

def split_sentences_ja(text: str) -> list:
    """簡易：日本語を文っぽく分ける（。！？で区切る）"""
    import re
    if not text:
        return []
    parts = re.split(r'(?<=[。！？])\s*', text.strip())
    return [p for p in parts if p]

def make_weighted_summary(transcript: str, highlights: List[Dict], gemini=None) -> str:
    """
    transcript: 文字起こし全文
    highlights: [{"text":"重要文", "weight":2.0}, ...]
    gemini: ある場合は良い感じに要約、無い場合は簡易版
    """
    if not transcript:
        return "（本文がありません）"

    if gemini:
        hi_txt = "\n".join([f"- ({h.get('weight',1)}x) {h.get('text','')}" for h in highlights or []])
        prompt = f"""あなたは重要度付きハイライトを反映して要約を再構成する日本語エディタです。
推測はせず、本文からのみ抽出してください。ハイライトの重み（x値）が大きいほど相対的に強調します。
出力は**Markdown**で、見出し名と順序を厳守してください。

# 出力フォーマット
## 見出し
- 8〜20文字

## 要点
- 4〜6行。ハイライトを優先しつつ全体の脈絡が分かるように補完
- 主語・時制を明確に。数値・日時・固有名詞は原文どおり

## ハイライト反映のメモ
- 1〜2行。どのハイライト（例：2.0x/1.5x）を主として反映したかを簡潔に言及

---
## 学習用付録（任意）
- 用語メモ（最大5項目、形式：用語：短い定義）
- 重要引用（最大3件。「…」で括る。可能なら[mm:ss]）
- 復習用Q&A（3〜5組、形式：Q: … / A: …）

# 入力
[ハイライト一覧（重み）]
{highlights}

[転写本文]
{transcript}
"""
        try:
            res = gemini.generate_content(prompt)
            return (res.text or "").strip()
        except Exception as e:
            return f"（Gemini再要約に失敗: {e}）"

    # ここからは簡易版（Geminiなし）
    sents = split_sentences_ja(transcript)
    picks = [h["text"] for h in highlights or [] if h.get("text")]
    for s in sents:
        if len(picks) >= 6:
            break
        if s not in picks:
            picks.append(s)
    head = (picks[0][:20] + "…") if picks else "要約"
    return head + "\n- " + "\n- ".join(picks[:6])

