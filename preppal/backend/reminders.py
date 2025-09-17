# -*- coding: utf-8 -*-
# reminders.py — リマインド送信ループ（30秒間隔）
import threading
import time
from datetime import datetime

from . import storage
from .mailer import send_email

_started = False


def _loop():
    while True:
        try:
            now = datetime.utcnow()
            for r in storage.iter_due_reminders(now):
                ok = True
                if r.get("email"):
                    ok = send_email(
                        r["email"],
                        subject=f"[PrepPal] 復習リマインド: {r['title']}",
                        body=f"次回復習の時間です。\nタイトル: {r['title']}\n時刻(UTC): {r['due_at'].isoformat()}",
                    )
                r["sent"] = True if ok else False
        except Exception as e:
            print("[REMINDER] loop error:", e)
        time.sleep(30)


def start():
    """日本語：多重起動を避けつつバックグラウンドスレッド開始"""
    global _started
    if _started:
        return
    t = threading.Thread(target=_loop, daemon=True)
    t.start()
    _started = True
