# -*- coding: utf-8 -*-
# mailer.py — メール送信（環境変数が揃っている時だけ送る）
import os, smtplib
from email.message import EmailMessage

SMTP_HOST = os.getenv("SMTP_HOST")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER")
SMTP_PASS = os.getenv("SMTP_PASS")
SMTP_FROM = os.getenv("SMTP_FROM") or SMTP_USER

def send_email(to_addr: str, subject: str, body: str) -> bool:
    """日本語：SMTP設定がある時だけメール送信。成功=True"""
    if not SMTP_HOST or not SMTP_FROM:
        return False
    try:
        msg = EmailMessage()
        msg["From"] = SMTP_FROM
        msg["To"] = to_addr
        msg["Subject"] = subject
        msg.set_content(body)
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as s:
            s.starttls()
            if SMTP_USER and SMTP_PASS:
                s.login(SMTP_USER, SMTP_PASS)
            s.send_message(msg)
        return True
    except Exception as e:
        print("[MAIL] 送信失敗:", e)
        return False
