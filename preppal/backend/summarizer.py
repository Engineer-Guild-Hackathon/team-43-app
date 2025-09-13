# -*- coding: utf-8 -*-
"""
summarizer.py — Gemini 2.5 Flash で要約（プレーンテキスト出力）
- 要約: summarize()
- 重み付き再要約: make_weighted_summary()
  ※ どちらも Markdown は使わず、「・」や日本語の見出し語だけに統一
"""

import os
from typing import List, Dict
import google.generativeai as genai

# === Gemini 初期化（環境変数優先／未設定ならフォールバック） ===
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "AIzaSyDAUO5T3sHD9YbtidgEOFdqlJ5wC1QfSX8").strip()
gemini = None
if GEMINI_API_KEY:
    try:
        genai.configure(api_key=GEMINI_API_KEY)
        gemini = genai.GenerativeModel("gemini-2.5-flash")
    except Exception as e:
        print("[WARN] Gemini 初期化失敗:", e)
        gemini = None
else:
    print("[INFO] GEMINI_API_KEY が未設定のため、フォールバック（簡易要約）のみ動作します。")

# === プレーンテキスト要約プロンプト（Markdown禁止） ===
PROMPT_TEMPLATE = """あなたは厳密で丁寧な日本語要約者です。以下の「本文」は講義/会議の文字起こしです。
推測や創作はせず、本文に含まれる事実のみを基に、**Markdownや記号(#, *, -, ``` など)を一切使わず**、音声読み上げしやすいプレーンテキストで出力してください。
箇条書きは「・」を用いてください。英記号の多用は避け、日本語の見出し語を使ってください。

# 出力フォーマット（この見出し語と順序を厳守。コロン以外の記号は最小限）
見出し: 8〜20文字で内容の核
要点:
・3〜5行、重要事項・決定事項・理由・数値を具体的に（主語を明確に）
キーワード: 3〜6語を読点「、」で区切る（固有名詞や専門用語）
ToDo:
・2〜3行。担当者や締切が本文にあれば含める。なければ「期限不明」など明記。
学習用付録:
・用語メモ（最大5項目、形式「用語：短い定義」）
・重要引用（最大3件、短い抜粋を「…」で囲む。可能なら[mm:ss]を残す）
・未決事項（最大3件）
・復習用Q&A（3〜5組、形式「質問：…」「回答：…」）

本文:
{body}
"""

def summarize(text: str) -> str:
    """テキストを受け取り、音声向けプレーンテキスト要約を返す（Gemini→失敗時フォールバック）"""
    if gemini:
        try:
            res = gemini.generate_content(PROMPT_TEMPLATE.format(body=text))
            return (res.text or "").strip()
        except Exception as e:
            return f"要約エラー：Gemini要約に失敗しました。概要抜粋:\n・{text[:120]}…（詳細省略）"
    # フォールバック（簡易）
    lines = [l for l in text.replace("\r\n", "\n").split("。") if l.strip()]
    head = f"見出し: { (lines[0][:18] + '…') if lines else '要約' }"
    pts  = "要点:\n" + "\n".join([f"・{s.strip()}。" for s in lines[:3]]) if lines else "要点:\n・内容が少ないため要約できません。"
    return f"{head}\n{pts}\nキーワード: \nToDo:\n学習用付録:\n"

# === ユーティリティ：日本語を文で分割（簡易） ===
def split_sentences_ja(text: str) -> list:
    """簡易：日本語を文っぽく分ける（。！？で区切る）"""
    import re
    if not text:
        return []
    parts = re.split(r'(?<=[。！？])\s*', text.strip())
    return [p for p in parts if p]

def make_weighted_summary(transcript: str, highlights: List[Dict], gemini_model=None) -> str:
    """
    transcript: 文字起こし全文
    highlights: [{"text":"重要文", "weight":2.0}, ...]
    gemini_model: 明示指定がなければモジュールの gemini を使う
    返り値は音声向けプレーンテキスト（Markdown禁止）
    """
    if not transcript:
        return "見出し: 本文がありません\n要点:\n・本文が空のため再要約できません。"

    if gemini_model is None:
        gemini_model = gemini

    if gemini_model:
        # 人が読みやすいハイライト文字列
        hi_txt = "\n".join(
            f"・重み{h.get('weight',1)}：{h.get('text','').strip()}"
            for h in (highlights or []) if h.get("text")
        )
        prompt = f"""あなたは重要度付きハイライトを反映して、本文から要約を再構成する日本語エディタです。
推測はせず、本文からのみ抽出してください。重みが大きいほど相対的に強調します。
**Markdownや記号(#, *, -, ``` など)は使わない**で、音声読み上げしやすいプレーンテキストで出力してください。
箇条書きは「・」を使い、日本語の見出し語を使ってください。

出力フォーマット（順序厳守）:
見出し: 8〜20文字
要点:
・4〜6行（重みの高いハイライトを優先しつつ、全体の脈絡が分かるように）
キーワード: 3〜6語（読点「、」区切り）
ToDo:
・2〜3行（担当者/期限が本文にあれば含める）
学習用付録:
・用語メモ（最大5項目、形式「用語：短い定義」）
・重要引用（最大3件、「…」で囲む。可能なら[mm:ss]）
・復習用Q&A（3〜5組、「質問：…」「回答：…」）

[ハイライト一覧]
{hi_txt if hi_txt else "・（指定なし）"}

[転写本文]
{transcript}
"""
        try:
            res = gemini_model.generate_content(prompt)
            return (res.text or "").strip()
        except Exception as e:
            return "見出し: 再要約エラー\n要点:\n・Gemini再要約に失敗しました。"

    # ここからは簡易版（Geminiなし）
    sents = split_sentences_ja(transcript)
    picks = [h["text"].strip() for h in (highlights or []) if h.get("text")]
    for s in sents:
        if len(picks) >= 6:
            break
        if s and s not in picks:
            picks.append(s)
    head = f"見出し: {(picks[0][:18] + '…') if picks else '要約'}"
    body = "\n".join(f"・{x}" for x in picks[:6])
    return f"{head}\n要点:\n{body}\nキーワード: \nToDo:\n学習用付録:\n"
