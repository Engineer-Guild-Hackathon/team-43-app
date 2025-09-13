## チーム情報
- チーム番号: 43
- チーム名: 4THƎNA
- プロダクト名: GraphEase
- メンバー: Ryuto Kawabata, Mio Tabayashi, Takahiro Namatame, Kouichi Mitsui, Yuya Kamijyo

## デモ　/ プレゼン資料
- デモURL: 
- プレゼンURL：
# GraphEase — 学習支援アプリ

> チーム43（アテナ43）  
> メンバー: Ryuto Kawabata, Mio Tabayashi, Takahiro Namatame, Kouichi Mitsui, Yuya Kamijyo

---

## 概要

GraphEase は、音声から自動で文字起こし・要約を行い、  
**ノート化／学習カード化／復習スケジュール化／要約のグラフィック化（Canvas）／音声読み上げ（TTS）** までをワンストップで行える学習支援アプリです。  
フロントは **HTML/CSS/Vanilla JS**、サーバは **音声処理・要約・TTS** を担当します。

---

## 主な機能

- **録音 → 自動文字起こし & 要約**
  - ブラウザのマイクから録音し、サーバへアップロード（`/api/transcribe_and_summarize`）
  - 一覧（Recent）表示、詳細で原文/要約を閲覧
- **タイトル編集**
  - `/api/recordings/{id}/title` に POST して更新
- **ノート（Notes）**
  - 「今の録音から取り込み」で要約をノート化
  - 編集（見出し/箇条書き/ToDo/コード/リンク/引用などの簡易 Markdown）
  - 検索／タグ／ピン留め／バージョン履歴／自動保存／プレビュー
- **学習カード（Study）**
  - 要約から「Q: / A:」「質問：/回答：」「設問：/解答：」を抽出しカード化
  - フラッシュカード学習（表→裏→次）
- **タイムライン（Timeline）**
  - 復習予定をローカルに保持・一覧表示（`/api/reminders` から次回復習日時を取り込み）
- **グラフィック記録（Graphic Recording）**
  - 要約から「見出し・要点・キーワード・Q&A」を抽出し、Canvas 図版を生成 → PNG 保存
- **TTS（読み上げ）**
  - `/api/tts/{id}?field=summary|transcript` で要約/原文を音声再生
  - 再生/停止トグル、先頭から再生、音量調整

---

## 画面構成（タブ）

- **Record**: 録音、一覧、詳細（原文/要約／タイトル編集）、TTS、グラフィック生成  
- **Notes**: ノート作成・編集・検索・タグ・ピン・履歴・プレビュー・自動保存  
- **Timeline**: 復習予定（ローカル保持）一覧  
- **Study**: Q/A から作る学習カード、クイズ形式で学習  

---

## 主要 API（フロントが呼び出す想定）

> バックエンド実装は任意（例: FastAPI / Express / NestJS）。以下はフロントの期待する入出力です。

- `POST /api/transcribe_and_summarize`  
  form-data: `audio`(blob), `language`(ja 等), `duration_sec`  
  resp: `{ id, title, transcript, summary, created_at, duration_sec }`

- `GET /api/recordings`  
  resp: `[{ id, title, created_at, duration_sec }, ...]`

- `GET /api/recordings/{id}`  
  resp: `{ id, title, transcript, summary, created_at, duration_sec }`

- `POST /api/recordings/{id}/title`  
  form-data: `title`  
  resp: `{ ok: true, title }`

- `POST /api/recordings/{id}/resummarize_from_text`  
  json: `{ text, boost }`  
  resp: `{ summary }`（入力の重要センテンスに重み付けして再要約）

- `POST /api/reminders`  
  form-data: `recording_id`, `goal_date`(任意) or `demo=true`, `email`(任意)  
  resp: `{ next_review_at }`

- `GET /api/tts/{id}?field=summary|transcript`  
  音声ストリーム（`audio/mpeg` など）

---

## フロントエンドの実装ポイント（`app.js` 抜粋で実装済）

- **録音**: `MediaRecorder` を使用。`isTypeSupported` で MIME を選択（Safari 考慮）
- **アップロード**: 録音停止時に `Blob` を `/api/transcribe_and_summarize` へ送信 → `loadList()` で一覧再取得
- **詳細表示**: `openDetail(id)` が `/api/recordings/{id}` を取得し、原文/要約を描画
- **ノート**:
  - localStorage に `notes` を保存（`LS.get/LS.set`）
  - 早見の Markdown レンダラ `MD.render()`（見出し/リスト/ToDo/コード/リンク/引用/強調 など）
  - 800ms デバウンスの自動保存、バージョン履歴（最大20）
  - 検索／タグ／ピン／プレビュー／ショートカット（Cmd/Ctrl+S/B/I）
- **Q/A 抽出**: `extractQA()` が「Q: / A:」「質問：/回答：」「設問：/解答：」を解析 → `cards` に同期
- **グラフィック**:
  - `parseSummaryForGraphic()` で見出し/要点/キーワード/Q&A を抽出
  - `drawGraphicFromSummary()` が Canvas に描画し、PNG 保存可能
- **TTS**:
  - `initTTSControls(id, field)` で音声ソース設定
  - 再生/停止トグル、先頭から再生、音量、クリーンアップの各ハンドラ

---

## 技術スタック（想定）

- **フロント**: HTML / CSS / Vanilla JavaScript（依存ライブラリなし）
- **ブラウザ API**: MediaRecorder / Canvas / Notification / localStorage
- **サーバ**: 任意（例: Python FastAPI / Node.js Express など）
  - **音声認識**: 例) Whisper / 各種 Speech-to-Text API
  - **要約**: 例) LLM API（「要点・キーワード・Q&A」出力に最適化）
  - **TTS**: 例) 各種 TTS API（SSML/日本語対応）

- **データ保存**
  - 録音・文字起こし・要約: サーバ側 DB（例: Postgres）やオブジェクトストレージ
  - Notes / Cards / Timeline: ブラウザの `localStorage`

---

## セットアップ & 起動（例）

### フロント（静的配信）
1. `index.html`, `app.js`, `styles.css` を任意の静的サーバで配信  
   例: `npm i -g serve` → `serve .`
2. バックエンドと同一オリジンでない場合は **CORS** を設定

### サーバ（例）
1. `/api/*` を上記 API 仕様で実装  
2. `.env` に API キーや接続情報を設定  
3. 例: `PORT=8080` で起動し、フロントからは相対パス or 逆プロキシを利用

---

## 環境変数（例）

- `OPENAI_API_KEY`（または利用する ASR/LLM/TTS の API キー）
- `DATABASE_URL`（使用時）
- `TTS_VOICE`（任意）
- `MAX_RECORD_DURATION_SEC`（録音上限など）

---

## よくあるハマりどころ

- **マイク権限**: 録音は HTTPS または `localhost` のみで動作。権限許可必須
- **MIME 非対応**: Safari 向けに `audio/mp4;codecs=mp4a` を候補に含める（実装済）
- **自動再生ブロック**: TTS は初回ユーザー操作内で `audio.play()` を呼ぶ（実装済）
- **CORS**: フロントと API が別オリジンならサーバで CORS 設定
- **main へのデプロイ**: ブランチ保護/権限でマージ不可の場合は PR を作成し管理者レビューを依頼

---

## キーボードショートカット（Notes）

- `Cmd/Ctrl + S`: 保存  
- `Cmd/Ctrl + B`: 太字  
- `Cmd/Ctrl + I`: 斜体  

---

## デモ手順（例）

1. **Record** タブで録音 → 自動で要約生成  
2. 「今の録音から取り込み」で **Notes** にノート化  
3. **Study** にカードが反映 → クイズ開始  
4. **Record** 詳細で **TTS** 再生、**図版生成** → PNG 保存  
5. **Timeline** に復習予定を登録（デモ or 試験日）

---

## ライセンス

**TODO:**（MIT など任意）
