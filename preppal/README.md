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

PrepPal — Record → STT → Summary

講義や会議を録音して、文字起こし（STT） → 要約ノート生成 → 入力からの再要約 → 読み上げ（TTS） まで行うミニアプリ。
フロントは静的HTML/JS、バックエンドは FastAPI です。

✅ 機能

ブラウザで録音（1ボタン開始/停止）・音声アップロード

Whisper（faster-whisper）で 文字起こし

Gemini 1.5（任意） or フォールバックで 要点要約

「重要センテンス」を入力 → 再要約（自由指示OK）

要約を 読み上げ（TTS, MP3）

Recent 一覧／詳細／タイトル編集

ダーク／ライト切替（ローカル保存）

復習リマインド（デモ30秒 or 試験日から自動計算、メール任意）

すべてメモリ保存（MVP）—再起動で消えます

1) リポジトリの取得（初回だけ）
A. Git が入っていない場合

Windows: Git for Windows
 をインストール
（PowerShell で git --version と打って表示されればOK）

macOS: xcode-select --install（または Homebrew で brew install git）

Linux: sudo apt-get install -y git など

B. クローン
git clone https://github.com/<your-account>/<your-repo>.git
cd <your-repo>

2) 依存の準備
A. Python と仮想環境

Python 3.10+ 推奨（3.11 動作確認済み）

# Windows (PowerShell)
py -m venv .venv
.\.venv\Scripts\Activate.ps1

# macOS / Linux
python3 -m venv .venv
source .venv/bin/activate

B. FFmpeg のインストール（音声デコードで必須）

Windows:

winget install Gyan.FFmpeg


macOS:

brew install ffmpeg


Ubuntu/Debian:

sudo apt-get update && sudo apt-get install -y ffmpeg

C. Python パッケージ

requirements.txt を作って以下を保存 → インストール

fastapi
uvicorn[standard]
python-multipart

# STT
faster-whisper

# 要約 (Gemini 任意)
google-generativeai

# 読み上げ (TTS)
gTTS

# 送信メール(任意・使用時のみ設定)

pip install -r requirements.txt


※ もし faster-whisper が重い／入らない場合は pip install openai-whisper に切替し、backend/stt.py のフォールバックを使ってください。

3) 環境変数（任意）

.env をプロジェクト直下に作成（任意）。無くても動きます。

# Whisper の動作指定（任意）
WHISPER_MODEL=small   # tiny/base/small/medium/large
WHISPER_DEVICE=cpu
WHISPER_PREC=int8

# 要約で Gemini を使う場合（任意）
GEMINI_API_KEY=xxxx

# リマインドをメール送信したい場合（任意）
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your_account
SMTP_PASS=your_password
SMTP_FROM=your_account@example.com


Windows PowerShell で一時的に設定するなら:

$env:GEMINI_API_KEY="xxxx"

4) 起動

プロジェクト直下から：

# Windows
py -m backend.main

# macOS / Linux
python -m backend.main


表示:
Uvicorn running on http://127.0.0.1:8000 が出ればOK。

ブラウザで http://127.0.0.1:8000
 を開く。
初回はブラウザに マイク許可 を与えてください。

5) 使い方（クイック）

マイクの丸ボタンをクリック → 録音開始
再度クリック → 停止 & アップロード（ETAも表示）

「Recent」一覧に項目が出る → クリックで詳細を開く

Title を編集 → Save

Summary が表示

「重要センテンス入力」にキーワードや指示を入れて
「入力から再要約」 を押す → Summary が更新

🔊 要約を読み上げ を押す → MP3 が再生

右上の 🌙/☀️ でダーク/ライト切替（次回も記憶）

リマインド：

30秒デモ（通知 & 任意でメール）

試験日ベースで登録（日付入力 → 最適な間隔で初回復習）

6) フォルダ構成
.
├─ backend/
│  ├─ main.py          # FastAPI 本体（静的配信 + API）
│  ├─ stt.py           # 文字起こし（faster-whisper / フォールバック）
│  ├─ summarizer.py    # 要約/再要約ロジック（Gemini or 簡易）
│  ├─ tts.py           # gTTSで読み上げMP3生成
│  ├─ storage.py       # メモリ保存（録音・リマインド）
│  ├─ reminders.py     # 30秒ごとの送信チェック（メール任意）
│  └─ __init__.py
├─ frontend/
│  ├─ index.html       # 画面（GitHub風のダーク/ライト対応）
│  └─ assets/
│     ├─ style.css
│     └─ app.js
└─ README.md


⚠️ 現状データは メモリ保持 のMVP設計です。サーバ再起動で消えます（DB化は将来タスク）。

7) トラブルシュート（よくある）

git: command not found
→ Git をインストールして PATH を通してください。

No module named fastapi
→ 仮想環境が有効か確認し、pip install -r requirements.txt。

FFmpeg が無い／アップロードで失敗
→ FFmpeg をインストール（上記手順）。

録音ができない / 送信されない
→ ブラウザの マイク許可 を「許可」にする。
→ 別タブや別アプリでマイク使用中だと録音できない場合あり。

音声再生されない
→ ブラウザの自動再生ブロックにより失敗する事があります。
もう一度ボタンを押すか、サイトの音声自動再生を許可。

ポートが塞がっている
→ 既に他プロセスが :8000 を使用。--port を変えるか、元のプロセスを停止。

Whisper が重い/遅い
→ WHISPER_MODEL=tiny（または base/small）に下げる。
→ CPUの場合は WHISPER_DEVICE=cpu、WHISPER_PREC=int8 で軽量化。

8) 開発メモ

自動リロードで起動（任意）

uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload


Lint/Format はお好みで（black, ruff など）

9) ライセンス

（未設定なら追記してください）

付録：動作確認チェックリスト

 http://127.0.0.1:8000 が開く

 録音ボタン 1クリックで開始／再クリックで停止→アップロード

 Recent に表示 → クリックで詳細が開く

 タイトル編集→保存で一覧も更新

 重要センテンス入力→「入力から再要約」で Summary 更新

 🔊 要約を読み上げ が再生される

 ダーク／ライト切替が保存される

 30秒デモ／試験日ベースのリマインドが登録される
