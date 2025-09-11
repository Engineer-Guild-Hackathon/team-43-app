# PrepPal (Record → STT → Summary)

## セットアップ
```bash
# 依存インストール
pip install -r backend/requirements.txt

# (任意) 環境変数
# Windows: setx GEMINI_API_KEY "YOUR_KEY"
# mac/Linux: export GEMINI_API_KEY="YOUR_KEY"
# SMTP_* を設定するとリマインドをメール送信できます（未設定ならWeb通知のみ）
# .env は使っていません（必要なら dotenv を追加してください）
