# -*- coding: utf-8 -*-
# storage.py — 簡易ストア（MVP：メモリ上の配列）
from __future__ import annotations

from typing import Any, Dict, List, Optional

# 日本語コメント：サーバ再起動で消えます。永続化したい場合はSQLite等に置き換え。
RECORDS: List[Dict[str, Any]] = (
    []
)  # [{id,title,created_at,transcript,summary,duration_sec}]
REMINDERS: List[Dict[str, Any]] = []  # [{id,email,due_at,recording_id,title,sent}]


def add_record(rec: Dict[str, Any]) -> None:
    RECORDS.insert(0, rec)


def list_records() -> List[Dict[str, Any]]:
    return [
        {
            "id": r["id"],
            "title": r["title"],
            "created_at": r["created_at"],
            "duration_sec": r["duration_sec"],
        }
        for r in RECORDS
    ]


def get_record(rid: str) -> Optional[Dict[str, Any]]:
    for r in RECORDS:
        if r["id"] == rid:
            return r
    return None


def update_title(rid: str, title: str) -> bool:
    for r in RECORDS:
        if r["id"] == rid:
            r["title"] = title
            return True
    return False


def add_reminder(rem: Dict[str, Any]) -> None:
    REMINDERS.append(rem)


def iter_due_reminders(now) -> List[Dict[str, Any]]:
    return [r for r in REMINDERS if not r.get("sent") and r["due_at"] <= now]


# 既にあるはずの全体リスト
RECORDS = []  # [{id,title,created_at,transcript,summary,...}]


def get_record(rid: str):
    """IDから1件取得。見つからなければ None"""
    return next((r for r in RECORDS if r.get("id") == rid), None)


def list_records_light():
    """一覧用(軽量)の形にして返す"""
    return [
        {
            "id": r.get("id"),
            "title": r.get("title"),
            "created_at": r.get("created_at"),
            "duration_sec": r.get("duration_sec"),
        }
        for r in RECORDS
    ]


def add_record(rec: dict):
    RECORDS.insert(0, rec)


def update_title(rid: str, title: str) -> bool:
    rec = get_record(rid)
    if not rec:
        return False
    rec["title"] = title
    return True
