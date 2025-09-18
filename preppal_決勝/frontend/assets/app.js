// ==============================
// PrepPal Frontend (app.js 完全版・修正版)
// ==============================

// ちいさなヘルパ
const $ = (id) => document.getElementById(id);

// ==============================
// トースト & ローディングユーティリティ（追加）
// ==============================

// 日本語：トーストを表示（右下に小さな通知を出す）
function showToast(message, type = "info", title = "") {
  const host = document.getElementById("toastHost");
  if (!host) return;
  const div = document.createElement("div");
  div.className = `toast ${type}`;
  div.innerHTML = `
    ${title ? `<div class="toast-title">${title}</div>` : ""}
    <div class="toast-body">${message}</div>
  `;
  host.appendChild(div);
  // 4秒で自動消滅
  setTimeout(() => {
    div.style.opacity = "0";
    div.style.transform = "translateY(6px)";
    setTimeout(() => div.remove(), 200);
  }, 4000);
}

// 日本語：画面全体のローディング表示のON/OFF
function setLoading(on) {
  const ov = document.getElementById("loadingOverlay");
  if (!ov) return;
  if (on) ov.removeAttribute("hidden");
  else ov.setAttribute("hidden", "");
}

// 日本語：API共通ラッパ（fetch を包んでローディング/エラー処理）
async function apiFetch(url, options = {}) {
  setLoading(true);
  try {
    const res = await fetch(url, options);
    if (!res.ok) {
      const txt = await res.text().catch(()=> "");
      throw new Error(`${res.status} ${res.statusText} ${txt || ""}`);
    }
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) return await res.json();
    return await res.text();
  } catch (e) {
    console.error("[API] error:", e);
    showToast("通信または処理でエラーが発生しました。", "error", "エラー");
    throw e;
  } finally {
    setLoading(false);
  }
}

// 日本語：フォーム送信用（multipart/form-data）
async function apiPostForm(url, formData) {
  return await apiFetch(url, { method: "POST", body: formData });
}


// 録音まわりの状態
let mediaRecorder = null;
let chunks = [];
let t0 = 0;

// 現在ひらいている録音のID（選択状態の判定にも使う）
let currentId = null;


// ------------------------------------
// Details の開閉ヘルパ
// ------------------------------------
function isDetailOpen(){
  const detail = document.getElementById("detail");
  return !!(detail && detail.classList.contains("active") && detail.style.display !== "none");
}
function showDetail(){
  const detail = document.getElementById("detail");
  if (detail){
    detail.classList.add("active");
    detail.style.display = "block";
  }
}
function hideDetail(){
  const detail = document.getElementById("detail");
  if (detail){
    detail.classList.remove("active");
    detail.style.display = "none";
     detail.setAttribute("aria-hidden", "true");
  }
}

// ==============================
// 「もっと見る」トグル（転写/要約）
// ==============================

function initMoreToggles(){
  const tx = document.getElementById('tx');
  const sm = document.getElementById('sum');
  const b1 = document.getElementById('btnMoreTx');
  const b2 = document.getElementById('btnMoreSum');

  // 日本語：初期は閉じる（classを付与）
  if (tx) tx.classList.add('collapsible', 'collapsed');
  if (sm) sm.classList.add('collapsible', 'collapsed');

  // 日本語：汎用トグル関数
  const toggle = (preEl, btnEl)=>{
    if (!preEl || !btnEl) return;
    const isCollapsed = preEl.classList.toggle('collapsed'); // 付け外し
    const expanded = !isCollapsed;
    btnEl.setAttribute('aria-expanded', String(expanded));
    btnEl.textContent = expanded ? '閉じる' : 'もっと見る';
  };

  b1?.addEventListener('click', ()=> toggle(tx, b1));
  b2?.addEventListener('click', ()=> toggle(sm, b2));
}

// 起動時に呼ぶ
document.addEventListener('DOMContentLoaded', initMoreToggles);

// 録音詳細を開いたときは“毎回”閉じた状態に戻す（自然な体験）
function resetMoreToggles(){
  const tx = document.getElementById('tx');
  const sm = document.getElementById('sum');
  const b1 = document.getElementById('btnMoreTx');
  const b2 = document.getElementById('btnMoreSum');
  if (tx){ tx.classList.add('collapsible','collapsed'); }
  if (sm){ sm.classList.add('collapsible','collapsed'); }
  if (b1){ b1.setAttribute('aria-expanded','false'); b1.textContent='もっと見る'; }
  if (b2){ b2.setAttribute('aria-expanded','false'); b2.textContent='もっと見る'; }
}

// 選択行のハイライト更新
function updateSelectedRow(){
  document.querySelectorAll(".item.selected").forEach(el => el.classList.remove("selected"));
  if (!currentId) return;
  const row = document.querySelector(`.item[data-id="${currentId}"]`);
  if (row) row.classList.add("selected");
}

// ------------------------------------
// MediaRecorder：互換性の高い MIME を自動選択（Safari等対策）
// ------------------------------------
function pickAudioMime(){
  const cands = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4;codecs=mp4a', // Safari 向け保険
    'audio/mp4'
  ];
  for (const m of cands){
    if (window.MediaRecorder?.isTypeSupported?.(m)) return m;
  }
  return ''; // ブラウザ任せ
}

// ------------------------------------
// MediaRecorder 準備
// ------------------------------------
async function ensureRecorder() {
  if (mediaRecorder) return mediaRecorder;
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

  // 対応MIMEを優先して作成
  const mimeType = pickAudioMime();
  mediaRecorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);

  mediaRecorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };

  mediaRecorder.onstop = async () => {
    try {
      // 実MIMEに合わせるため type指定なしでBlob生成
      const blob = new Blob(chunks);
      chunks = [];
      const dur = Math.max(1, Math.round((performance.now() - t0) / 1000));

      $("status") && ($("status").textContent = "Uploading…");
      const fd = new FormData();
      fd.append("audio", blob, "recording.webm"); // 便宜上webm拡張子でOK
      fd.append("language", "ja");
      fd.append("duration_sec", String(dur));

// ★ 追加：RAG を使うか（チェックボックス #useRag があれば true を送る）
const useRagOn = document.getElementById("useRag")?.checked ? "true" : "false";
fd.append("use_rag", useRagOn);

      // ▼ 従来の fetch を自前ラッパへ置換
      const json = await apiPostForm("/api/transcribe_and_summarize", fd);

      $("status") && ($("status").textContent = "Transcribed");
      showToast("アップロードと要約が完了しました。", "success", "完了");
      await loadList();

      // 自動で詳細を開かない（ユーザーがクリックした時のみ）
      // if (json && json.id) openDetail(json.id);

    } catch (e) {
      console.error(e);
      $("status") && ($("status").textContent = "Error");
      showToast("アップロードに失敗しました。", "error", "エラー");
      alert("アップロードに失敗しました。");
    }
  };

  return mediaRecorder;
}

// ------------------------------------
// 録音ボタン
// ------------------------------------
let isRecording = false;

function setRecordingUI(on){
  isRecording = on;
  const recArea = $("recArea");
  const btnMic  = $("btnMic");
  if (!recArea || !btnMic) return;
  if (on){
    recArea.classList.add("recording");           // 緑のリングのアニメが回る
    btnMic.setAttribute("aria-pressed","true");
    $("status") && ($("status").textContent = "Recording…（もう一度タップで停止）");
  }else{
    recArea.classList.remove("recording");
    btnMic.setAttribute("aria-pressed","false");
    if ($("status")?.textContent.startsWith("Recording…")){
      $("status").textContent = "Processing…";
    }
  }
}

$("btnMic")?.addEventListener("click", async ()=>{
  try{
    const mr = await ensureRecorder();
    if (!isRecording){
      // 録音開始
      t0 = performance.now();
      mr.start();
      setRecordingUI(true);
    }else{
      // 録音停止（→ onstop が走る）
      $("btnMic").disabled = true;               // 連打防止
      setTimeout(()=>($("btnMic").disabled=false), 500);
      mr.stop();
      setRecordingUI(false);
    }
  }catch(e){
    console.error(e);
    alert("マイク権限を許可してください。");
  }
});

// キーボードでも操作（Enter / Space）
$("btnMic")?.addEventListener("keydown", (ev)=>{
  if (ev.code === "Space" || ev.code === "Enter"){
    ev.preventDefault();
    $("btnMic").click();
  }
});

// ------------------------------------
// Recent 一覧（カード化対応）
// ------------------------------------
function fmtDT(iso) {
  try {
    const d = new Date(iso);
    return (
      d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) +
      " · " +
      d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
    );
  } catch {
    return iso || "";
  }
}
function fmtDur(sec) {
  if (sec === undefined || sec === null) return "—:—";
  const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
  return String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
}

// 日本語：カードUIで一覧を描画（新規）
function renderRecordingsAsCards(records, container){
  container.innerHTML = "";

  if (!records || !records.length){
    container.innerHTML = `<div class="muted">No recordings yet.</div>`;
    return;
  }

  for (const it of records){
    const card = document.createElement("div");
    card.className = "card item";          // 既存の選択ハイライトも効かせる
    card.setAttribute("data-id", it.id);

    const title = document.createElement("div");
    title.className = "card-title item-title";
    title.textContent = it.title || "Untitled";

    const meta = document.createElement("div");
    meta.className = "card-meta item-sub";
    meta.textContent = `${fmtDT(it.created_at)}｜${fmtDur(it.duration_sec)}`;

    const badge = document.createElement("div");
    badge.className = "pill";
    badge.textContent = "Transcribed";

    const actions = document.createElement("div");
    actions.className = "card-actions";

    // [開く]：詳細を読み込む
    const btnOpen = document.createElement("button");
    btnOpen.textContent = "開く";
    btnOpen.onclick = async (ev) => {
      ev.stopPropagation();
      await openDetail(it.id);
    };

    // [タイトル編集]
    const btnEdit = document.createElement("button");
    btnEdit.textContent = "タイトル編集";
    btnEdit.onclick = async (ev) => {
      ev.stopPropagation();
      const newTitle = prompt("新しいタイトルを入力", it.title || "");
      if (!newTitle || !newTitle.trim()) return;
      try{
        await updateTitle(it.id, newTitle.trim());
      }catch(e){}
    };

    actions.appendChild(btnOpen);
    actions.appendChild(btnEdit);

    // クリックで開閉（同じ行のトグル）
    card.addEventListener("click", async () => {
      if (currentId === it.id && isDetailOpen()){
        currentId = null;
        hideDetail();
        updateSelectedRow();
        return;
      }
      await openDetail(it.id);
    });

    card.appendChild(title);
    card.appendChild(meta);
    card.appendChild(badge);
    card.appendChild(actions);
    container.appendChild(card);
  }

  // 再描画後に選択ハイライトを再適用
  updateSelectedRow();
}

async function loadList() {
  const box = $("list");
  if (!box) return;
  box.innerHTML = "";

  try {
    // ▼ 置換：apiFetchで取得
    const items = await apiFetch("/api/recordings");
    renderRecordingsAsCards(items, box);

  } catch (e) {
    console.error(e);
    box.innerHTML = '<div class="muted">Failed to load.</div>';
  }
}
loadList();


// ------------------------------------
// 詳細を開く
// ------------------------------------
async function openDetail(id) {
  try {
    // ▼ 置換：apiFetchで詳細取得
    const r = await apiFetch("/api/recordings/" + id);

    currentId = id; // 選択IDを記憶

    const titleInput = $("editTitle");
    const tx = $("tx");
    const sum = $("sum");

    if (titleInput) titleInput.value = r.title || "";
    /* ★ ここを差し替え：segments があれば span 分割、無ければ従来通り */
if (tx){
  const segs = Array.isArray(r.segments) ? r.segments : [];
  if (segs.length){
    // XSS対策のエスケープ関数
    const esc = (s)=> String(s||'').replace(/[&<>]/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;' }[m]));
    tx.innerHTML = segs.map(s =>
      `<span class="seg" data-start="${Number(s.start)||0}" data-end="${Number(s.end)||0}">${esc(s.text)}</span>`
    ).join("");
    tx.classList.add("transcript");
  }else{
    tx.textContent = r.transcript || "";
  }
}

if (sum) sum.textContent = r.summary || "";


    showDetail();
    document.getElementById("detail")?.scrollIntoView({ behavior: "smooth" });

    // 選択行のハイライト更新
    updateSelectedRow();

    // ★ この録音の要約を読み上げ対象に初期化
    initTTSControls(id, 'summary');

        
    /* ★ 追記：もっと見るを初期状態（閉）に戻す */
    resetMoreToggles();

    
    /* ★ 追加：元音声の同期ハイライト初期化 */
    initRecAudioAndSync(id);

    // ==============================
// 元音声の再生と転写ハイライト同期
// ==============================
function initRecAudioAndSync(id){
  const audio = document.getElementById('recPlayer');
  const box = document.getElementById('tx');
  if (!audio || !box) return;

  // 音声のURLを設定（存在しなければ404になるがUIは壊れません）
  audio.src = `/api/recordings/${encodeURIComponent(id)}/audio`;

  const segs = Array.from(box.querySelectorAll('span.seg'));
  if (!segs.length){
    // セグメントがない場合は同期不要
    return;
  }

  let last = null;
  function tick(){
    const t = audio.currentTime || 0;
    // 現在位置に含まれるセグメントを探す（最初に当たったもの）
    const hit = segs.find(el => t >= (+el.dataset.start) && t < (+el.dataset.end));
    if (hit !== last){
      last?.classList.remove('active');
      if (hit){
        hit.classList.add('active');
        // 見える位置までスクロール。初回は滑らかに、それ以外は軽めに。
        hit.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
      last = hit || null;
    }
  }
  audio.addEventListener('timeupdate', tick);

  // クリックでシーク
  box.addEventListener('click', (ev)=>{
    const span = ev.target.closest('span.seg');
    if (!span) return;
    const s = parseFloat(span.dataset.start || '0');
    audio.currentTime = s;
    audio.play().catch(()=>{});
  });
}


  } catch (e) {
    console.error(e);
    showToast("詳細の取得に失敗しました。", "error", "エラー");
    alert("詳細の取得に失敗しました");
  }
}

// ------------------------------------
// タイトル編集（置換済み）
// ------------------------------------
async function updateTitle(id, newTitle){
  const fd = new FormData();
  fd.append("title", newTitle);
  await apiPostForm(`/api/recordings/${id}/title`, fd);
  showToast("タイトルを更新しました。", "success");
  await loadList();
}

$("btnSaveTitle")?.addEventListener("click", async () => {
  try {
    if (!currentId) {
      alert("項目を選択してください");
      return;
    }
    const title = $("editTitle").value.trim();
    if (!title) {
      alert("タイトルを入力してください");
      return;
    }
    await updateTitle(currentId, title);
  } catch (e) {
    console.error(e);
    showToast("通信エラーが発生しました。", "error", "エラー");
    alert("通信エラーが発生しました");
  }
});

// ------------------------------------
// リマインド（デモ/試験日）— fetch置換
// ------------------------------------
$("demo")?.addEventListener("click", async () => {
  const email = $("email")?.value || "";
  // できれば現在開いている録音に設定。なければ先頭に。
  let rid = currentId;
  if (!rid) {
    const list = await apiFetch("/api/recordings");
    if (!list.length) {
      alert("録音がありません");
      return;
    }
    rid = list[0].id;
  }
  const fd = new FormData();
  fd.append("recording_id", rid);
  fd.append("demo", "true");
  if (email) fd.append("email", email);

  const json = await apiPostForm("/api/reminders", fd);
  $("next") && ($("next").textContent = "次回復習: " + (json.next_review_at || "-"));

  // タイムラインへ直接追加
  if (json?.next_review_at) await addTimelineItemFromNext(json.next_review_at, "Review");

  try {
    if (window.Notification && Notification.permission !== "granted") {
      await Notification.requestPermission();
    }
    if (Notification.permission === "granted" && json?.next_review_at) {
      const ms = new Date(json.next_review_at).getTime() - Date.now();
      setTimeout(() => new Notification("PrepPal: 復習タイムです！"), Math.max(0, ms));
    }
  } catch {}
});

$("schedule")?.addEventListener("click", async () => {
  const email = $("email")?.value || "";
  const goal = $("goal")?.value || "";
  if (!goal) {
    alert("試験日を選択してください");
    return;
  }
  let rid = currentId;
  if (!rid) {
    const list = await apiFetch("/api/recordings");
    if (!list.length) {
      alert("録音がありません");
      return;
    }
    rid = list[0].id;
  }
  const fd = new FormData();
  fd.append("recording_id", rid);
  fd.append("goal_date", goal);
  if (email) fd.append("email", email);

  const json = await apiPostForm("/api/reminders", fd);
  $("next") && ($("next").textContent = "次回復習: " + (json.next_review_at || "-"));

  // タイムラインへ直接追加
  if (json?.next_review_at) await addTimelineItemFromNext(json.next_review_at, "Review");
});

// ------------------------------------
// 入力から再要約（重要センテンス → 再要約）— fetch置換
// ------------------------------------
$("btnReSummInput")?.addEventListener("click", async () => {
  if (!currentId) {
    alert("先に一覧から1件開いてください。");
    return;
  }
  const text = ($("hlInput")?.value || "").trim();
  if (!text) {
    alert("重要センテンスを入力してください。");
    return;
  }
  const boost = parseFloat($("hlWeight")?.value || "2.0");

  const json = await apiFetch(`/api/recordings/${currentId}/resummarize_from_text`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, boost }),
  });

  if (!json || !("summary" in json)) {
    alert("再要約に失敗しました");
    return;
  }

  const sumEl = $("sum");
  if (sumEl) sumEl.textContent = json.summary || "";

  // ★日本語: 再要約したので、TTS音声ソースを更新すべき印としてフラグON
  window.__ttsDirty = true;

  showToast("再要約が完了しました。", "success", "完了");
});

// ------------------------------------
// 要約の読み上げ（TTS）— 既存のまま
// ------------------------------------
$("btnSpeak")?.addEventListener("click", () => {
  if (!currentId) {
    alert("先に一覧から1件開いてください。");
    return;
  }
  const audio = $("ttsPlayer");
  if (!audio) return;
  audio.src = `/api/tts/${currentId}?field=summary`;
  audio.play().catch(() =>
    alert("音声の自動再生がブロックされました。もう一度ボタンを押してください。")
  );
});

// ==================== テーマ切替（GitHub風：ライト/ダーク） ====================
(function(){
  const KEY = "preppal-theme"; // "light" | "dark"
  const root = document.documentElement;
  const btn  = document.getElementById("themeToggle");

  // 初期反映
  const saved = localStorage.getItem(KEY);
  if (saved === "light" || saved === "dark"){
    root.setAttribute("data-theme", saved);
  }

  // クリックでトグル
  if (btn){
    btn.addEventListener("click", ()=>{
      const cur = root.getAttribute("data-theme") || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
      const next = (cur === "dark") ? "light" : "dark";
      root.setAttribute("data-theme", next);
      localStorage.setItem(KEY, next);
      btn.textContent = next === "dark" ? "🌗" : "🌞";
    });
    // 初期アイコン
    const initial = root.getAttribute("data-theme") || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    btn.textContent = initial === "dark" ? "🌗" : "🌞";
  }
})();

// ==============================
// タブ切替（Record / Notes / Timeline / Study）
// ==============================
(function setupTabs(){
  const tabs = document.querySelectorAll('.tabs .tab');

  function activate(targetId){
    // タブの aria-selected を更新
    tabs.forEach(t => t.setAttribute('aria-selected', String(t.dataset.target === targetId)));

    // ビューの表示/非表示を更新
    document.querySelectorAll('.view').forEach(v=>{
      const on = (v.id === targetId);
      v.hidden = !on;
      v.classList.toggle('active', on);
    });

    // 画面ごとの初期化
    if (targetId === 'view-notes') loadNotes();
    if (targetId === 'view-timeline') loadTimeline();
    if (targetId === 'view-study') refreshStudyEmptyState();
  }

  tabs.forEach(tab=>{
    tab.addEventListener('click', ()=> activate(tab.dataset.target));
  });

  // 初期は Record を表示
  activate('view-record');
})();

// ==============================
// localStorage ユーティリティ
// ==============================
const LS = {
  get(key, fallback){ try{ return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; }catch{return fallback} },
  set(key, val){ localStorage.setItem(key, JSON.stringify(val)); }
};

// ==============================
// 表示設定（フォント/サイズ）の保存・復元
// ==============================

// 日本語：localStorageキー
const UI_FONT_KEY = 'ui.font';
const UI_SIZE_KEY = 'ui.size';

// 日本語：設定をDOMへ適用（:root の CSS変数を書き換える）
function applyFontSettings(opt){
  const root = document.documentElement;
  if (opt?.family !== undefined){
    const fam = (opt.family || '').trim();
    root.style.setProperty('--ui-font', fam || 'var(--font-sans)');
  }
  if (opt?.sizePx !== undefined){
    const n = Number(opt.sizePx) || 14;
    root.style.setProperty('--ui-font-size', `${n}px`);
  }
}

// 日本語：保存（localStorage）
function saveFontSettings(family, sizePx){
  if (family !== undefined) LS.set(UI_FONT_KEY, family);
  if (sizePx !== undefined) LS.set(UI_SIZE_KEY, sizePx);
}

// 日本語：初期化（UIの値と見た目を同期）
function initFontSettingsUI(){
  const sel = document.getElementById('uiFontFamily');
  const num = document.getElementById('uiFontSize');
  const reset = document.getElementById('uiFontReset');

  const savedFam  = LS.get(UI_FONT_KEY, '');
  const savedSize = LS.get(UI_SIZE_KEY, 14);

  // UIへ反映
  if (sel) sel.value = savedFam || '';
  if (num) num.value = savedSize;

  // 見た目へ反映
  applyFontSettings({ family: savedFam, sizePx: savedSize });

  // 変更イベント
  sel?.addEventListener('change', ()=>{
    const v = sel.value;
    saveFontSettings(v, undefined);
    applyFontSettings({ family: v });
    if (typeof showToast === 'function') showToast('フォントを更新', v || '既定', 'info');
  });
  num?.addEventListener('change', ()=>{
    const n = Math.min(22, Math.max(12, Number(num.value)||14));
    num.value = n;
    saveFontSettings(undefined, n);
    applyFontSettings({ sizePx: n });
    if (typeof showToast === 'function') showToast('文字サイズを更新', `${n}px`, 'info');
  });
  reset?.addEventListener('click', ()=>{
    saveFontSettings('', 14);
    if (sel) sel.value = '';
    if (num) num.value = 14;
    applyFontSettings({ family: '', sizePx: 14 });
    if (typeof showToast === 'function') showToast('表示設定をリセット', '既定に戻しました', 'success');
  });
}

// 日本語：起動時に初期化
document.addEventListener('DOMContentLoaded', initFontSettingsUI);


// ==============================
// Notes：編集可能（新規/保存/削除/検索/履歴/タグ/ピン/プレビュー/自動保存）
// ==============================
const Note = {
  get currentId(){ return this._id ?? null; },
  set currentId(v){ this._id=v; }
};

// 軽量 Markdown レンダラ（見出し/引用/リスト/ToDo/コード/リンク/強調）
const MD = {
  render(src){
    const esc = (s)=>s.replace(/[&<>"]/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[m]));
    let t = esc(src || '');

    // ```code```
    t = t.replace(/```([\s\S]*?)```/g, (_, code)=>`<pre><code>${esc(code)}</code></pre>`);

    // #, ##, ###
    t = t.replace(/^###\s+(.*)$/gm, '<h3>$1</h3>');
    t = t.replace(/^##\s+(.*)$/gm, '<h2>$1</h2>');
    t = t.replace(/^#\s+(.*)$/gm, '<h1>$1</h1>');

    // 引用
    t = t.replace(/^\>\s?(.*)$/gm, '<blockquote>$1</blockquote>');

    // 番号リスト
    t = t.replace(/(^|\n)(\d+\.\s.*(?:\n(?!\n|\d+\. ).*)*)/g, (m, brk, body)=>{
      const items = body.split(/\n/).map(l=>l.replace(/^\d+\.\s?/, '').trim()).filter(Boolean);
      return `${brk}<ol>` + items.map(i=>`<li>${i}</li>`).join('') + '</ol>';
    });
    // 箇条書き
    t = t.replace(/(^|\n)([-•・]\s.*(?:\n(?!\n|[-•・]\s).*)*)/g, (m, brk, body)=>{
      const items = body.split(/\n/).map(l=>l.replace(/^[-•・]\s?/, '').trim()).filter(Boolean);
      return `${brk}<ul>` + items.map(i=>`<li>${i}</li>`).join('') + '</ul>';
    });
    // ToDo [ ] / [x]
    t = t.replace(/(^|\n)(\[( |x)\]\s.*(?:\n(?!\n|\[( |x)\]\s).*)*)/gi, (m, brk, body)=>{
      const items = body.split(/\n/).map(l=>l.trim()).filter(Boolean).map(l=>{
        const done = /\[x\]/i.test(l);
        return `<li><label><input type="checkbox" ${done?'checked':''} disabled> ${esc(l.replace(/^\[( |x)\]\s*/i,''))}</label></li>`;
      });
      return `${brk}<ul class="todo">` + items.join('') + '</ul>';
    });

    // インライン
    t = t.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    t = t.replace(/\*(.+?)\*/g, '<em>$1</em>');
    t = t.replace(/`(.+?)`/g, '<code>$1</code>');
    t = t.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');

    // 段落
    t = t.replace(/\n{2,}/g, '</p><p>');
    t = `<p>${t}</p>`;
    return t;
  }
};

// --- テキストエリア選択編集ユーティリティ ---
function getTA(){ return document.getElementById('noteBody'); }
function surroundSelection(before, after){
  const ta = getTA(); if (!ta) return;
  const { selectionStart:s, selectionEnd:e, value:v } = ta;
  const out = v.slice(0,s) + before + v.slice(s,e) + after + v.slice(e);
  ta.value = out;
  ta.setSelectionRange(s + before.length, e + before.length);
  ta.focus(); triggerPreview(); queueAutosave();
}
function prefixLines(prefix){
  const ta = getTA(); if (!ta) return;
  const { selectionStart:s, selectionEnd:e, value:v } = ta;
  const head = v.lastIndexOf('\n', s - 1) + 1;
  const tail = v.indexOf('\n', e); const end = tail === -1 ? v.length : tail;
  const block = v.slice(head, end).split('\n').map(l => l ? (prefix + l) : l).join('\n');
  ta.value = v.slice(0, head) + block + v.slice(end);
  ta.setSelectionRange(head, head + block.length);
  ta.focus(); triggerPreview(); queueAutosave();
}
function setHeading(level){
  const ta = getTA(); if (!ta) return;
  const { selectionStart:s, value:v } = ta;
  const head = v.lastIndexOf('\n', s - 1) + 1;
  const lineEnd = v.indexOf('\n', s); const end = lineEnd === -1 ? v.length : lineEnd;
  const line = v.slice(head, end).replace(/^#{1,3}\s*/,'');
  ta.value = v.slice(0, head) + '#'.repeat(level) + ' ' + line + v.slice(end);
  ta.setSelectionRange(head, head + line.length + level + 1);
  ta.focus(); triggerPreview(); queueAutosave();
}
function insertAtCursor(text){
  const ta = getTA(); if (!ta) return;
  const { selectionStart:s, selectionEnd:e, value:v } = ta;
  ta.value = v.slice(0,s) + text + v.slice(e);
  const pos = s + text.length;
  ta.setSelectionRange(pos,pos);
  ta.focus(); triggerPreview(); queueAutosave();
}

// --- ツールバー（HTML側の .editor-toolbar を操作） ---
document.querySelector('.editor-toolbar')?.addEventListener('click', (ev)=>{
  const btn = ev.target.closest('button'); if (!btn) return;
  const cmd = btn.dataset.cmd;
  if (cmd === 'bold')  return surroundSelection('**','**');
  if (cmd === 'italic')return surroundSelection('*','*');
  if (cmd === 'code')  return surroundSelection('`','`');
  if (cmd === 'ul')    return prefixLines('- ');
  if (cmd === 'ol')    return prefixLines('1. ');
  if (cmd === 'todo')  return prefixLines('[ ] ');
  if (cmd === 'quote') return prefixLines('> ');
  if (cmd === 'h1')    return setHeading(1);
  if (cmd === 'h2')    return setHeading(2);
  if (cmd === 'h3')    return setHeading(3);
  if (cmd === 'link'){
    const url = prompt('URL を入力してください（https://…）'); if (!url) return;
    return surroundSelection('[',`](${url})`);
  }
  if (cmd === 'stamp'){
    const ts = new Date().toLocaleString();
    return insertAtCursor(`\n> _${ts}_\n`);
  }
});

// --- プレビュー切替 & 自動更新 ---
document.getElementById('btnTogglePreview')?.addEventListener('click', ()=>{
  const box = document.getElementById('notePreview');
  const ta  = getTA();
  const toPreview = box.hidden;
  if (toPreview){ box.innerHTML = MD.render(ta.value); box.hidden = false; ta.hidden = true; }
  else { box.hidden = true; ta.hidden = false; ta.focus(); }
});
function triggerPreview(){
  const box = document.getElementById('notePreview');
  if (!box?.hidden){ box.innerHTML = MD.render(getTA().value); }
}

// --- 一覧描画（検索/タグ/ピン対応） ---
function loadNotes(){
  let list = LS.get('notes', []);
  const box = $("notesList"); if (!box) return;
  const q = ($("noteSearch")?.value || "").toLowerCase();
  box.innerHTML = "";

  // ピン留め → 更新日時新しい順
  list.sort((a,b)=>{
    if ((b.pinned|0) !== (a.pinned|0)) return (b.pinned|0) - (a.pinned|0);
    return new Date(b.updated_at||b.created_at) - new Date(a.updated_at||a.created_at);
  });

  const filtered = list.filter(n => {
    const tags = (n.tags||[]).join(',').toLowerCase();
    return !q || (n.title||"").toLowerCase().includes(q) || (n.body||"").toLowerCase().includes(q) || tags.includes(q);
  });

  if (!filtered.length){
    box.innerHTML = '<div class="muted">ノートはまだありません。</div>';
    return;
  }

  filtered.forEach(n=>{
    const row = document.createElement('div');
    row.className = 'item';
    row.innerHTML = `
      <div>
        <div class="item-title">${n.title || '(untitled)'} ${n.pinned ? '📌' : ''}</div>
        <div class="item-sub">${new Date(n.updated_at||n.created_at).toLocaleString()}</div>
        <div>${(n.tags||[]).map(t=>`<span class="tag-pill">${t}</span>`).join('')}</div>
      </div>
      <div class="meta">note</div>
      <button class="btn btn-danger">Delete</button>
    `;
    row.addEventListener('click', (ev)=>{
      if (ev.target.tagName === 'BUTTON') return;
      openNote(n.id);
    });
    row.querySelector('button').addEventListener('click', (ev)=>{
      ev.stopPropagation();
      deleteNote(n.id);
    });
    box.appendChild(row);
  });
}
$("noteSearch")?.addEventListener('input', loadNotes);

// --- 新規／開く／保存／削除／履歴 ---
function newNote(){
  Note.currentId = null;
  $("noteTitle").value = "";
  $("noteBody").value  = "";
  $("noteTags").value  = "";
  $("notePinned").checked = false;
  $("noteMeta").textContent = "新規ノート";
  $("noteHistory").innerHTML = `<option value="">履歴を選択して復元…</option>`;
  $("noteSaved").textContent = "未保存";
  triggerPreview();
}
$("btnNoteNew")?.addEventListener('click', newNote);

function openNote(id){
  const notes = LS.get('notes', []);
  const n = notes.find(x=>x.id === id);
  if (!n) return;
  Note.currentId = n.id;
  $("noteTitle").value = n.title || "";
  $("noteBody").value  = n.body  || "";
  $("noteTags").value  = (n.tags||[]).join(', ');
  $("notePinned").checked = !!n.pinned;
  $("noteMeta").textContent = `編集中: ${new Date(n.updated_at||n.created_at).toLocaleString()}（ID: ${n.id.slice(0,8)}…）`;
  $("noteSaved").textContent = "表示中";
  const sel = $("noteHistory");
  sel.innerHTML = `<option value="">履歴を選択して復元…</option>` + (n.versions||[])
    .slice().reverse()
    .map(v=>`<option value="${v.id}">${new Date(v.at).toLocaleString()}</option>`).join('');
  triggerPreview();
}
function snapshot(note){
  const v = { id: crypto.randomUUID(), at: new Date().toISOString(), body: note.body };
  const MAX = 20;
  note.versions = (note.versions||[]).concat(v).slice(-MAX);
}
function parseTags(s){ return (s||'').split(',').map(t=>t.trim()).filter(Boolean); }

function saveNote(opts={}){
  const title = $("noteTitle").value.trim();
  const body  = $("noteBody").value;
  const tags  = parseTags($("noteTags").value);
  const pinned = $("notePinned").checked;
  if (!title && !body) { if (!opts.silent) alert("タイトルか本文を入力してください。"); return; }

  const nowIso = new Date().toISOString();
  let notes = LS.get('notes', []);

  if (!Note.currentId){
    const id = crypto.randomUUID();
    const recId = window.currentId || null;
    const n = { id, recording_id: recId, title, body, tags, pinned, created_at: nowIso, updated_at: nowIso, versions: [] };
    snapshot(n);
    notes.unshift(n);
    LS.set('notes', notes);
    Note.currentId = id;
    $("noteMeta").textContent = `作成: ${new Date(nowIso).toLocaleString()}（ID: ${id.slice(0,8)}…）`;
    updateCardsForNote(n);
    loadNotes();
    if (!opts.silent) alert("ノートを作成しました。");
  } else {
    const idx = notes.findIndex(x=>x.id === Note.currentId);
    if (idx === -1) return alert("ノートが見つかりませんでした。");
    const old = notes[idx];
    const n = { ...old, title, body, tags, pinned, updated_at: nowIso };
    snapshot(n);
    notes[idx] = n;
    LS.set('notes', notes);
    $("noteMeta").textContent = `更新: ${new Date(nowIso).toLocaleString()}（ID: ${n.id.slice(0,8)}…）`;
    updateCardsForNote(n);
    loadNotes();
    if (!opts.silent) alert("ノートを保存しました。");
  }
  $("noteSaved").textContent = `最終保存: ${new Date().toLocaleTimeString()}`;
  openNote(Note.currentId); // 履歴プルダウン更新
}
$("btnNoteSave")?.addEventListener('click', ()=> saveNote());

function deleteNote(id){
  const notes = LS.get('notes', []);
  const n = notes.find(x=>x.id === id);
  if (!n) return;
  if (!confirm("このノートを削除しますか？")) return;
  LS.set('notes', notes.filter(x=>x.id !== id));
  const cards = LS.get('cards', []);
  LS.set('cards', cards.filter(c => c.note_id !== id));
  if (Note.currentId === id) newNote();
  loadNotes();
  refreshStudyEmptyState();
  alert("ノートを削除しました。");
}
$("btnNoteDelete")?.addEventListener('click', ()=>{
  if (!Note.currentId) return alert("削除するノートがありません。");
  deleteNote(Note.currentId);
});

// 履歴復元
$("btnNoteRestore")?.addEventListener('click', ()=>{
  if (!Note.currentId) return alert("対象ノートがありません。");
  const verId = $("noteHistory").value;
  if (!verId) return alert("履歴を選択してください。");
  const notes = LS.get('notes', []);
  const n = notes.find(x=>x.id === Note.currentId);
  const ver = (n?.versions||[]).find(v=>v.id === verId);
  if (!ver) return alert("履歴が見つかりません。");
  $("noteBody").value = ver.body || "";
  triggerPreview();
  queueAutosave.flush();
  saveNote({silent:true});
});

// Record→「今の録音から取り込み」実装（fetch置換）
async function importCurrentRecordingToNote(){
  try{
    // 1) 録音IDを決定（currentId が無ければ先頭にフォールバック）
    let rid = window.currentId;
    if (!rid){
      const list = await apiFetch("/api/recordings");
      if (!Array.isArray(list) || !list.length){
        alert("録音がありません。先に Record で録音してください。");
        return;
      }
      rid = list[0].id;
    }

    // 2) 録音詳細を取得
    const r = await apiFetch(`/api/recordings/${rid}`);

    // 3) Notesタブへ遷移
    const notesTab = Array.from(document.querySelectorAll('.tabs .tab')).find(t => t.dataset.target === 'view-notes');
    if (notesTab) notesTab.click();

    // 4) 新規ノートを開いて内容を流し込み
    if (typeof newNote === 'function') newNote();
    const titleEl = document.getElementById("noteTitle");
    const bodyEl  = document.getElementById("noteBody");
    if (!titleEl || !bodyEl){
      alert("Notesエディタの要素が見つかりません（#noteTitle / #noteBody）");
      return;
    }
    const title = r.title ? `From: ${r.title}` : "From Recording";
    const body  = r.summary || r.transcript || "";
    titleEl.value = title;
    bodyEl.value  = body;

    // 5) プレビュー更新 & サイレント保存
    if (typeof triggerPreview === 'function') triggerPreview();
    if (typeof saveNote === 'function'){
      const prev = window.currentId;
      window.currentId = rid;
      saveNote({ silent:true });
      window.currentId = prev;
    }

    // 6) 取り込み完了表示＆フォーカス
    const savedLabel = document.getElementById("noteSaved");
    if (savedLabel) savedLabel.textContent = "取り込み完了";
    bodyEl.focus();
  }catch(err){
    console.error(err);
    alert("取り込みに失敗しました。コンソールを確認してください。");
  }
}


// --- 自動保存（800ms デバウンス）＆ショートカット ---
function debounce(fn, ms){
  let t; const f = (...a)=>{ clearTimeout(t); t = setTimeout(()=>fn(...a), ms); };
  f.flush = ()=>{ clearTimeout(t); fn(); };
  return f;
}
const queueAutosave = debounce(()=> saveNote({silent:true}), 800);
["noteTitle","noteBody","noteTags","notePinned"].forEach(id=>{
  const el = document.getElementById(id);
  if (!el) return;
  const ev = (id==="notePinned") ? "change" : "input";
  el.addEventListener(ev, ()=>{
    $("noteSaved").textContent = "編集中…";
    triggerPreview();
    queueAutosave();
  });
});
// Ctrl/Cmd + S / B / I
document.addEventListener('keydown', (e)=>{
  const onNotes = !document.getElementById('view-notes').hidden;
  if (!onNotes) return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase()==='s'){ e.preventDefault(); saveNote(); }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase()==='b'){ e.preventDefault(); surroundSelection('**','**'); }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase()==='i'){ e.preventDefault(); surroundSelection('*','*'); }
});

// --- Notes→Study 同期（要約Q/Aからカードを更新） ---
function updateCardsForNote(note){
  const qa = extractQA(note.body||"");
  const cards = LS.get('cards', []).filter(c => c.note_id !== note.id);
  qa.forEach(x => cards.push({ id: crypto.randomUUID(), q: x.q, a: x.a, note_id: note.id, recording_id: note.recording_id || null }));
  LS.set('cards', cards);
  refreshStudyEmptyState();
}


// ==============================
// Timeline：リマインダーの予定を一覧化（クライアント保持）
// ==============================
async function addTimelineItemFromNext(nextIso, label){
  const list = LS.get('timeline', []);
  list.push({ id: crypto.randomUUID(), when: nextIso, label: label || "Review", created_at: new Date().toISOString() });
  list.sort((a,b)=> new Date(a.when) - new Date(b.when));
  LS.set('timeline', list);
  loadTimeline();
}

function loadTimeline(){
  const list = LS.get('timeline', []);
  const box = $("timelineList");
  if (!box) return;
  box.innerHTML = "";
  if (!list.length){
    box.innerHTML = '<div class="muted">スケジュールはまだありません。Record からリマインド登録してください。</div>';
    return;
  }
  list.forEach(ev=>{
    const row = document.createElement('div');
    row.className = 'item';
    row.innerHTML = `
      <div>
        <div class="item-title">${ev.label || 'Review'}</div>
        <div class="item-sub">${new Date(ev.when).toLocaleString()}</div>
      </div>
      <div class="meta">⏰</div>
      <button class="btn">Done</button>
    `;
    row.querySelector('button').addEventListener('click', ()=>{
      const next = LS.get('timeline', []).filter(x=>x.id !== ev.id);
      LS.set('timeline', next);
      loadTimeline();
    });
    box.appendChild(row);
  });
}

// ==============================
// Study：Q/A 抽出（Q:/A:、質問：/回答：、設問：/解答： に対応）
// ==============================
function extractQA(summaryText){
  const text = (summaryText || "").replace(/\r\n/g, "\n").trim();
  if (!text) return [];

  // 「復習用Q&A」セクションを優先
  let target = text;
  const qaStart = text.indexOf("復習用Q&A");
  if (qaStart >= 0){
    const tail = text.slice(qaStart);
    const nextHdr = tail.search(/\n(?= *(見出し|要点|キーワード|ToDo|学習用付録|用語メモ|重要引用|未決事項)\s*[:：])/);
    target = (nextHdr >= 0) ? tail.slice(0, nextHdr) : tail;
  }

  const lines = target.split("\n").map(s => s.trim()).filter(Boolean);

  // 質問側（Q: / 質問： / 設問：）、回答側（A: / 回答： / 解答：）
  const qRe = /^(?:Q|質問|設問)\s*[:：]\s*(.+)$/i;
  const aRe = /^(?:A|回答|解答)\s*[:：]\s*(.+)$/i;

  const out = [];
  for (const line of lines){
    const mq = line.match(qRe);
    if (mq){
      out.push({ q: mq[1].trim(), a: "" });
      continue;
    }
    const ma = line.match(aRe);
    if (ma){
      if (out.length){
        out[out.length - 1].a = ma[1].trim();
      } else {
        out.push({ q: "", a: ma[1].trim() });
      }
    }
  }

  return out
    .filter(qa => (qa.q && qa.q.length) || (qa.a && qa.a.length))
    .map(qa => ({
      q: qa.q || "(質問が抽出できませんでした)",
      a: qa.a || "(回答が抽出できませんでした)"
    }));
}

function refreshStudyEmptyState(){
  const cards = LS.get('cards', []);
  $("studyEmpty") && ($("studyEmpty").style.display = cards.length ? "none" : "block");
  $("quizBox") && ($("quizBox").style.display = cards.length ? "block" : "none");
}

$("btnBuildCards")?.addEventListener('click', async ()=>{
  // 全録音を走査して /api/recordings/{id} の summary から Q/A を抽出して cards に再構築
  const list = await apiFetch("/api/recordings");
  const cards = [];
  for (const it of (list||[])){
    const r = await apiFetch("/api/recordings/"+it.id);
    const qa = extractQA(r.summary||"");
    qa.forEach(x => cards.push({ id: crypto.randomUUID(), q: x.q, a: x.a, recording_id: it.id }));
  }
  LS.set('cards', cards);
  alert(`カードを ${cards.length} 件作成しました。`);
  refreshStudyEmptyState();
});

// シンプルなフラッシュカード（表→裏→次へ）
let QUIZ = { idx: 0, cards: [] };

$("btnStartQuiz")?.addEventListener('click', ()=>{
  const cards = LS.get('cards', []);
  if (!cards.length){
    alert("カードがありません。まずは再構築してください。");
    return;
  }
  // シャッフル
  QUIZ.cards = cards.slice().sort(()=> Math.random() - .5);
  QUIZ.idx = 0;
  showQuiz();
});

$("btnFlip")?.addEventListener('click', ()=>{
  const back = $("quizBack");
  if (!back) return;
  back.style.display = back.style.display === "none" ? "block" : "none";
});

$("btnNext")?.addEventListener('click', ()=>{
  if (!QUIZ.cards.length) return;
  QUIZ.idx++;
  if (QUIZ.idx >= QUIZ.cards.length){
    alert("お疲れさま！最後まで到達しました。");
    QUIZ.idx = 0;
  }
  showQuiz();
});

function showQuiz(){
  const cur = QUIZ.cards[QUIZ.idx] || {};
  $("quizCounter") && ($("quizCounter").textContent = `${QUIZ.idx+1} / ${QUIZ.cards.length}`);
  $("quizFront") && ($("quizFront").textContent = "Q: " + (cur.q || ""));
  $("quizBack") && ($("quizBack").textContent  = "A: " + (cur.a || "(未抽出)"));
  $("quizBack") && ($("quizBack").style.display = "none");
}

// ------------------------------------
// 初期表示時は Details を閉じておく（保険）
// ------------------------------------
(function initDetailClosed(){
  hideDetail();
})();


// ==============================
// Graphic Recording：要約→図版（Canvas）
// ==============================

// 日本語：要約テキストから「見出し・要点・キーワード・Q&A」を素朴に抽出
function parseSummaryForGraphic(text){
  const t = (text || "").replace(/\r\n/g, "\n");
  const out = { heading: "", points: [], keywords: [], qa: [] };

  // 1) 見出し
  const mHead =
    t.match(/^\s*見出し\s*[:：]?\s*[\r\n-]*\s*(.+)$/m) ||
    t.match(/^\s*##\s*見出し\s*\n\s*-\s*(.+)$/m);
  if (mHead) {
    out.heading = mHead[1].trim().replace(/^[-•]\s*/, "");
  } else {
    const firstLine = (t.split("\n").map(s=>s.trim()).find(Boolean) || "").slice(0, 24);
    out.heading = firstLine || "要約";
  }

  // 2) 要点
  const secPoints = t.split(/\n(?= *[＃#]*\s*要点)/)[1] || t;
  const ptLines = secPoints.split("\n").map(s => s.trim());
  ptLines.forEach(line=>{
    const m = line.match(/^[-•・]\s*(.+)$/);
    if (m && out.points.length < 7) out.points.push(m[1].trim());
  });

  // 3) キーワード
  const mKey =
    t.match(/^\s*キーワード\s*[:：]\s*(.+)$/m) ||
    t.match(/^\s*##\s*キーワード\s*\n\s*-\s*(.+)$/m);
  if (mKey){
    out.keywords = mKey[1].split(/[、,]\s*/).map(s=>s.trim()).filter(Boolean).slice(0, 8);
  }

  // 4) Q&A
  try{
    out.qa = extractQA(t).slice(0, 5);
  }catch{
    out.qa = [];
  }

  return out;
}

// 日本語：行の自動折返し（Canvas用）
function wrapText(ctx, text, maxWidth){
  const words = (text || "").split(/(\s+)/); // 空白も保持して自然に
  const lines = [];
  let line = "";
  for (const w of words){
    const test = line + w;
    if (ctx.measureText(test).width > maxWidth && line){
      lines.push(line.trim());
      line = w.trim();
    }else{
      line = test;
    }
  }
  if (line.trim()) lines.push(line.trim());
  return lines;
}

// 日本語：テーマ適用（背景色・アクセント色など）
function getGraphicTheme(name, pageThemeIsDark){
  if (name === 'dark'){
    return {
      bg: '#0f172a', ink: '#e5e7eb',
      box: '#111827', line: '#334155',
      accent: '#22c55e', sub: '#93c5fd'
    };
  }
  if (name === 'high'){
    const bg = getComputedStyle(document.documentElement)
      .getPropertyValue('--g-bg-high').trim() || (pageThemeIsDark ? '#000' : '#fff');
    const ink = getComputedStyle(document.documentElement)
      .getPropertyValue('--g-ink-high').trim() || (pageThemeIsDark ? '#fff' : '#000');
    return {
      bg, ink,
      box: bg === '#000000' ? '#111' : '#fff',
      line: ink,
      accent: '#00e676',
      sub: ink
    };
  }
  // default light
  return {
    bg: '#ffffff', ink: '#111827',
    box: '#f8fafc', line: '#cbd5e1',
    accent: '#16a34a', sub: '#2563eb'
  };
}

// 日本語：図版を描画（通常レイアウト）
function drawGraphicFromSummary(summaryText, themeName){
  const cvs = $("gReco");
  const alt = $("gRecoAlt");
  if (!cvs) return;
  const ctx = cvs.getContext('2d');

  const pageDark = (document.documentElement.getAttribute('data-theme') === 'dark') ||
                   window.matchMedia?.('(prefers-color-scheme: dark)')?.matches;

  const theme = getGraphicTheme(themeName || 'light', pageDark);
  const W = cvs.width, H = cvs.height;
  ctx.clearRect(0,0,W,H);

  // 背景
  ctx.fillStyle = theme.bg;
  ctx.fillRect(0,0,W,H);

  // 共通フォント
  const fontSans = 'system-ui, -apple-system, Segoe UI, Roboto, "Noto Sans JP", "Hiragino Kaku Gothic ProN", Meiryo, sans-serif';

  // 枠（レイアウト）
  const pad = 32;
  const colGap = 24;
  const leftW = Math.floor((W - pad*2 - colGap) * 0.55);
  const rightW = (W - pad*2 - colGap) - leftW;
  const leftX = pad;
  const rightX = pad + leftW + colGap;
  let y = pad;

  const S = parseSummaryForGraphic(summaryText);

  // 見出し
  ctx.fillStyle = theme.ink;
  ctx.font = `bold 30px ${fontSans}`;
  const headLines = wrapText(ctx, S.heading || "要約", leftW);
  headLines.forEach((line,i)=>{
    ctx.fillText(line, leftX, y + i*36);
  });
  y += Math.max(36*headLines.length + 12, 48);

  // 要点ボックス
  const boxH = 320;
  ctx.fillStyle = theme.box;
  roundRect(ctx, leftX, y, leftW, boxH, 14, true, false);
  ctx.fillStyle = theme.sub;
  ctx.font = `bold 16px ${fontSans}`;
  ctx.fillText("要点", leftX+14, y+22);
  ctx.fillStyle = theme.ink;
  ctx.font = `16px ${fontSans}`;
  let ly = y + 48;
  const bullet = "• ";
  (S.points.length ? S.points : ["（抽出できませんでした）"]).slice(0,7).forEach(pt=>{
    const lines = wrapText(ctx, bullet + pt, leftW - 24);
    lines.forEach((ln, idx)=>{
      ctx.fillText(ln, leftX+14, ly + idx*22);
    });
    ly += Math.max(22*lines.length + 6, 26);
  });

  // 右カラム 上段：キーワード
  let ry = pad;
  const keyH = 160;
  ctx.fillStyle = theme.box;
  roundRect(ctx, rightX, ry, rightW, keyH, 14, true, false);
  ctx.fillStyle = theme.sub;
  ctx.font = `bold 16px ${fontSans}`;
  ctx.fillText("キーワード", rightX+14, ry+22);

  const keys = (S.keywords.length ? S.keywords : ["（なし）"]).slice(0,8);
  let kx = rightX + 14, ky = ry + 50;
  ctx.font = `15px ${fontSans}`;
  keys.forEach(word=>{
    const w = Math.ceil(ctx.measureText(word).width) + 18;
    if (kx + w > rightX + rightW - 14){
      kx = rightX + 14;
      ky += 30;
    }
    ctx.fillStyle = theme.bg === '#ffffff' ? '#eef2ff' : '#1f2937';
    roundRect(ctx, kx, ky-18, w, 26, 13, true, false);
    ctx.fillStyle = theme.ink;
    ctx.fillText(word, kx+9, ky);
    kx += w + 8;
  });
  ry += keyH + 18;

  // 右カラム 下段：Q&A
  const qaH = H - ry - pad;
  ctx.fillStyle = theme.box;
  roundRect(ctx, rightX, ry, rightW, qaH, 14, true, false);
  ctx.fillStyle = theme.sub;
  ctx.font = `bold 16px ${fontSans}`;
  ctx.fillText("復習用Q&A", rightX+14, ry+22);

  let qy = ry + 48;
  const QA = (S.qa.length ? S.qa : [{q:"（質問なし）", a:"（回答なし）"}]).slice(0,5);
  ctx.font = `15px ${fontSans}`;
  QA.forEach((pair, idx)=>{
    ctx.fillStyle = theme.ink;
    const qLines = wrapText(ctx, `❓ ${pair.q || ""}`, rightW - 28);
    qLines.forEach((ln, i) => ctx.fillText(ln, rightX+14, qy + i*20));
    qy += Math.max(20*qLines.length + 4, 24);
    ctx.fillStyle = theme.accent;
    const aLines = wrapText(ctx, `💡 ${pair.a || ""}`, rightW - 28);
    aLines.forEach((ln, i) => ctx.fillText(ln, rightX+14, qy + i*20));
    qy += Math.max(20*aLines.length + 10, 26);
  });

  // Altテキスト
  const altLines = [];
  altLines.push(`見出し: ${S.heading || ""}`);
  altLines.push(`要点:`);
  (S.points.length ? S.points : ["（抽出できませんでした）"]).forEach((p,i)=> altLines.push(`  - ${p}`));
  altLines.push(`キーワード: ${(S.keywords || []).join("、") || "（なし）"}`);
  if (S.qa?.length){
    altLines.push("復習用Q&A:");
    S.qa.forEach((qa,i)=>{
      altLines.push(`  Q${i+1}: ${qa.q || ""}`);
      altLines.push(`  A${i+1}: ${qa.a || ""}`);
    });
  }
  const altText = $("gRecoAlt");
  if (alt) alt.textContent = altLines.join("\n");
}

// 日本語：角丸矩形を描くヘルパ
function roundRect(ctx, x, y, w, h, r, fill, stroke){
  if (w < 0) { x += w; w = Math.abs(w); }
  if (h < 0) { y += h; h = Math.abs(h); }
  r = Math.min(r, w/2, h/2);
  ctx.beginPath();
  ctx.moveTo(x+r, y);
  ctx.arcTo(x+w, y, x+w, y+h, r);
  ctx.arcTo(x+w, y+h, x, y+h, r);
  ctx.arcTo(x, y+h, x, y, r);
  ctx.arcTo(x, y, x+w, y, r);
  ctx.closePath();
  if (fill) ctx.fill();
  if (stroke) ctx.stroke();
}

// ==============================
// ★追加: ピクト中心（文字少なめ）モード
// ==============================
const PICTO_RULES = [
  { rx: /(目的|目標|ゴール|達成)/, emoji: "🎯" },
  { rx: /(手順|方法|手法|プロセス|アルゴリズム)/, emoji: "🧭" },
  { rx: /(注意|リスク|課題|問題|危険)/, emoji: "⚠️" },
  { rx: /(期限|締切|時間|時刻|スケジュール)/, emoji: "⏰" },
  { rx: /(データ|統計|数値|精度|スコア|評価)/, emoji: "📊" },
  { rx: /(実験|検証|テスト|結果)/, emoji: "🧪" },
  { rx: /(質問|疑問|Q&A|Q：)/, emoji: "❓" },
  { rx: /(回答|説明|A：|結論|まとめ)/, emoji: "💡" },
  { rx: /(学習|復習|暗記|ノート|教科書)/, emoji: "📘" },
  { rx: /(音声|録音|マイク|発話)/, emoji: "🎤" },
];
function pickEmojiFromText(t){
  for (const r of PICTO_RULES){ if (r.rx.test(t)) return r.emoji; }
  return "🟩"; // フォールバック
}

// 日本語：キャンバス上のホットスポット（クリック領域）を保持
let gRecoHotspots = [];

// 日本語：ピクト中心レイアウトの描画
function drawGraphicPictFromSummary(summaryText, themeName){
  const cvs   = document.getElementById("gReco");
  const altEl = document.getElementById("gRecoAlt");
  if (!cvs) return;
  const ctx = cvs.getContext("2d");

  if (altEl) {
    altEl.textContent = "ヒント: 各ピクトをクリック/タップすると読み上げます。\n（描画準備中…）";
  }

  try {
    const pageDark = (document.documentElement.getAttribute('data-theme') === 'dark') ||
                     (window.matchMedia?.('(prefers-color-scheme: dark)')?.matches);
    const theme = getGraphicTheme(themeName || 'light', pageDark);

    const W = cvs.width, H = cvs.height;
    ctx.clearRect(0,0,W,H);
    ctx.fillStyle = theme.bg;
    ctx.fillRect(0,0,W,H);

    gRecoHotspots = [];
    cvs.style.cursor = "default";

    const S = parseSummaryForGraphic(summaryText);

    const pad  = 38;
    const gap  = 24;
    const cols = 3;
    const rows = 2;

    ctx.fillStyle = theme.ink;
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.font = `bold 34px system-ui, "Noto Sans JP", sans-serif`;

    const headingText  = (S.heading || "要約");
    const headingLines = wrapText(ctx, headingText, W - pad*2);
    const headingDraw  = headingLines.slice(0, 2);
    headingDraw.forEach((ln, i) => {
      ctx.fillText(ln, pad, pad + 36*i);
    });
    const gridTop = pad + 36*Math.max(1, headingDraw.length) + 24;

    const tileW = Math.floor((W - pad*2 - gap*(cols-1)) / cols);
    const tileH = Math.floor((H - pad - gridTop - gap*(rows-1)) / rows);

    const points = (S.points && S.points.length ? S.points : ["重要ポイント未抽出"]).slice(0, 6);

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    points.forEach((pt, i) => {
      const c = i % cols;
      const r = Math.floor(i / cols);
      const x = pad + c * (tileW + gap);
      const y = gridTop + r * (tileH + gap);

      ctx.fillStyle = theme.box;
      roundRect(ctx, x, y, tileW, tileH, 18, true, false);

      const emoji = pickEmojiFromText(pt);
      const cx = x + tileW/2;
      const cy = y + tileH/2 - 8;
      ctx.fillStyle = theme.ink;
      ctx.font = `84px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji"`;
      ctx.fillText(emoji, cx, cy);

      ctx.font = `bold 22px system-ui, "Noto Sans JP", sans-serif`;
      ctx.fillStyle = theme.accent;
      ctx.beginPath();
      ctx.arc(x + 26, y + 26, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = (theme.bg === "#ffffff") ? "#083344" : "#001b1b";
      ctx.fillText(String(i + 1), x + 26, y + 27);

      gRecoHotspots.push({ x, y, w: tileW, h: tileH, text: pt });
    });

    ctx.strokeStyle = theme.line;
    ctx.lineWidth = 2.5;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols - 1; c++) {
        const x1 = pad + c * (tileW + gap) + tileW;
        const y1 = gridTop + r * (tileH + gap) + tileH/2;
        const x2 = pad + (c + 1) * (tileW + gap);
        const y2 = y1;
        ctx.beginPath();
        ctx.moveTo(x1 + 6, y1);
        ctx.lineTo(x2 - 6, y2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x2 - 12, y2 - 6);
        ctx.lineTo(x2 - 2,  y2);
        ctx.lineTo(x2 - 12, y2 + 6);
        ctx.stroke();
      }
    }

    const altLines = [];
    altLines.push(`見出し: ${S.heading || ""}`);
    altLines.push(`ポイント（${points.length}件）:`);
    points.forEach((p, i) => altLines.push(`  ${i + 1}. ${p}`));
    altLines.push("ヒント: 各ピクトをクリック/タップすると読み上げます。");
    if (altEl) altEl.textContent = altLines.join("\n");

    cvs.onclick = (ev) => {
      const rect   = cvs.getBoundingClientRect();
      const scaleX = cvs.width  / rect.width;
      const scaleY = cvs.height / rect.height;
      const px = (ev.clientX - rect.left) * scaleX;
      const py = (ev.clientY - rect.top)  * scaleY;

      const hit = gRecoHotspots.find(h => px >= h.x && px <= h.x + h.w && py >= h.y && py <= h.y + h.h);
      if (!hit) return;

      try { window.speechSynthesis.cancel(); } catch {}
      const u = new SpeechSynthesisUtterance(hit.text);
      u.lang = "ja-JP";
      window.speechSynthesis.speak(u);
    };

    if (gRecoHotspots.length) cvs.style.cursor = "pointer";

  } catch (err) {
    console.error("drawGraphicPictFromSummary error:", err);
    if (altEl){
      altEl.textContent =
        "ピクト中心の描画でエラーが発生しました。\n" +
        "（詳しくはブラウザのコンソールを確認してください）\n" +
        "ヒント: いったん通常レイアウトで生成→もう一度ピクト中心を試してください。";
    }
  }
}

// 日本語：図版を生成（ピクト中心モード対応）
(() => {
  const btn = document.getElementById("btnGenGraphic");
  if (!btn) return;
  btn.onclick = null;

  btn.addEventListener("click", () => {
    if (!currentId){
      alert("先に一覧から録音を1件開き、要約を表示してください。");
      return;
    }
    const summary = (document.getElementById("sum")?.textContent || "").trim();
    if (!summary){
      alert("要約が空です。録音を選ぶか、要約を作成してください。");
      return;
    }

    const theme = document.getElementById("gTheme")?.value || "light";
    const pictEl = document.getElementById("gPictMode");
    const pict   = !!(pictEl && pictEl.checked);

    console.debug("[Graphic] pictMode =", pict, "theme =", theme);

    const altEl = document.getElementById("gRecoAlt");
    if (altEl) {
      altEl.textContent = pict
        ? "（ピクト中心で生成中…）\nヒント: 各ピクトをクリック/タップすると読み上げます。"
        : "（通常レイアウトで生成中…）";
    }

    try {
      if (pict) {
        drawGraphicPictFromSummary(summary, theme);
      } else {
        drawGraphicFromSummary(summary, theme);
      }
      requestAnimationFrame(sizeGraphicCanvasToViewport);
      const saver = document.getElementById("btnSaveGraphic");
      if (saver) saver.disabled = false;

    } catch (e) {
      console.error("[Graphic] render error:", e);
      alert("図版の生成でエラーが発生しました。コンソールをご確認ください。");
    }
  });
})();

// 日本語：PNG保存
$("btnSaveGraphic")?.addEventListener("click", ()=>{
  const cvs = $("gReco");
  if (!cvs) return;
  const link = document.createElement("a");
  link.download = `preppal_graphic_${(new Date()).toISOString().slice(0,10)}.png`;
  link.href = cvs.toDataURL("image/png");
  link.click();
});

// ==============================
// ビューポートに収めるリサイズ
// ==============================
function sizeGraphicCanvasToViewport(){
  const wrap = document.getElementById("gRecoWrap");
  const cvs  = document.getElementById("gReco");
  if (!wrap || !cvs) return;

  const rectTop = wrap.getBoundingClientRect().top;
  const vh      = window.innerHeight || document.documentElement.clientHeight;
  const availableH = Math.max(240, Math.floor(vh - rectTop - 16));

  const availableW = Math.floor(wrap.clientWidth || wrap.getBoundingClientRect().width);

  let targetW = availableW;
  let targetH = Math.floor(targetW * 3 / 4);
  if (targetH > availableH){
    targetH = availableH;
    targetW = Math.floor(targetH * 4 / 3);
  }

  cvs.style.width  = targetW + "px";
  cvs.style.height = targetH + "px";
  wrap.style.maxHeight = (targetH + 2) + "px";
}
window.addEventListener("load", sizeGraphicCanvasToViewport);
window.addEventListener("resize", sizeGraphicCanvasToViewport);
document.getElementById("btnGenGraphic")?.addEventListener("click", ()=>{
  requestAnimationFrame(sizeGraphicCanvasToViewport);
});
(function hookTabForGraphic(){
  const tabs = document.querySelectorAll('.tabs .tab');
  tabs.forEach(t=>{
    t.addEventListener('click', ()=>{
      if (t.dataset.target === 'view-record'){
        setTimeout(sizeGraphicCanvasToViewport, 0);
      }
    });
  });
})();

// ==============================
// TTS（読み上げ）コントロール 完成形
// ==============================
let ttsState = {
  recordId: null,
  field: 'summary',
  audioEl: null,
  toggleBtn: null,
  restartBtn: null,
  volumeEl: null
};

function initTTSControls(recordId, field = 'summary') {
  if (!ttsState.audioEl)   ttsState.audioEl   = document.getElementById('ttsPlayer');
  if (!ttsState.toggleBtn) ttsState.toggleBtn = document.getElementById('ttsToggleBtn');
  if (!ttsState.restartBtn)ttsState.restartBtn= document.getElementById('ttsRestartBtn');
  if (!ttsState.volumeEl)  ttsState.volumeEl  = document.getElementById('ttsVolume');

  if (!ttsState.audioEl || !ttsState.toggleBtn || !ttsState.restartBtn || !ttsState.volumeEl) {
    console.warn('TTS UI 要素が見つかりません（index.html のブロックが貼られているか確認）');
    return;
  }

  detachTTSEvents();

  ttsState.recordId = recordId;
  ttsState.field = field;

  const src = `/api/tts/${encodeURIComponent(recordId)}?field=${encodeURIComponent(field)}`;
  ttsState.audioEl.src = src;
  ttsState.audioEl.load();
  ttsState.audioEl.currentTime = 0;
  setTTSToggleUI(false);
  attachTTSEvents();
}

function attachTTSEvents() {
  ttsState.toggleBtn.addEventListener('click', onTTSToggleClick);
  ttsState.restartBtn.addEventListener('click', onTTSRestartClick);
  ttsState.audioEl.addEventListener('ended', onTTSEnded);
  ttsState.volumeEl.addEventListener('input', onTTSVolumeChange);
}
function detachTTSEvents() {
  if (!ttsState.audioEl || !ttsState.toggleBtn || !ttsState.restartBtn || !ttsState.volumeEl) return;
  ttsState.toggleBtn.removeEventListener('click', onTTSToggleClick);
  ttsState.restartBtn.removeEventListener('click', onTTSRestartClick);
  ttsState.audioEl.removeEventListener('ended', onTTSEnded);
  ttsState.volumeEl.removeEventListener('input', onTTSVolumeChange);
}
async function onTTSToggleClick() {
  const a = ttsState.audioEl;
  const playing = !a.paused && a.currentTime > 0;

  if (playing) {
    a.pause();
    setTTSToggleUI(false);
  } else {
    try {
      if (window.__ttsDirty) {
        const rid = ttsState.recordId;
        const field = ttsState.field || 'summary';
        const src = `/api/tts/${encodeURIComponent(rid)}?field=${encodeURIComponent(field)}&ts=${Date.now()}`;
        a.src = src;
        a.load();
        a.currentTime = 0;
        window.__ttsDirty = false;
      }
      await a.play();
      setTTSToggleUI(true);
    } catch (err) {
      console.warn('TTS 再生に失敗:', err);
      alert('ブラウザの自動再生制限で音声が再生できない場合があります。もう一度ボタンを押してください。');
      setTTSToggleUI(false);
    }
  }
}
async function onTTSRestartClick() {
  try {
    const a = ttsState.audioEl;
    const rid = ttsState.recordId;
    const field = ttsState.field || 'summary';
    if (window.__ttsDirty) {
      a.src = `/api/tts/${encodeURIComponent(rid)}?field=${encodeURIComponent(field)}&ts=${Date.now()}`;
      a.load();
      window.__ttsDirty = false;
    }
    a.pause();
    a.currentTime = 0;
    await a.play();
    setTTSToggleUI(true);
  } catch (err) {
    console.warn('TTS 先頭から再生に失敗:', err);
    setTTSToggleUI(false);
  }
}
function onTTSEnded() { setTTSToggleUI(false); }
function onTTSVolumeChange(e) {
  const v = Number(e.target.value);
  ttsState.audioEl.volume = isNaN(v) ? 1 : v;
}
function setTTSToggleUI(isPlaying) {
  if (!ttsState.toggleBtn) return;
  ttsState.toggleBtn.textContent = isPlaying ? '■ 停止' : '▶ 読み上げ';
  ttsState.toggleBtn.setAttribute('aria-pressed', isPlaying ? 'true' : 'false');
}
function cleanupTTS() {
  if (ttsState.audioEl) {
    try {
      ttsState.audioEl.pause();
      ttsState.audioEl.currentTime = 0;
    } catch {}
  }
  setTTSToggleUI(false);
  detachTTSEvents();
}

// ==============================
// Materials (RAG) — 資料アップロード
// ==============================
document.getElementById('btnMatUpload')?.addEventListener('click', async ()=>{
  try{
    const f = document.getElementById('matFile')?.files?.[0];
    if (!f){ alert('ファイルを選択してください'); return; }
    const title = document.getElementById('matTitle')?.value || f.name;

    const fd = new FormData();
    fd.append('file', f);
    fd.append('title', title);

    // ローディング表示（任意）
    showLoading(true);

    const r = await fetch('/api/materials/upload', { method:'POST', body: fd });
    const j = await r.json();

    showLoading(false);

    if (j?.ok){
      showToast('資料を登録しました', `${j.kind} / チャンク: ${j.chunks}`, 'success');
    }else{
      showToast('登録に失敗', j?.error || 'unknown error', 'error');
    }
  }catch(err){
    console.error(err);
    showLoading(false);
    showToast('登録エラー', String(err), 'error');
  }
});

// 既存のトースト/ローディング関数がない場合は、最低限のダミーを用意
function showLoading(on){
  const el = document.getElementById('loadingOverlay');
  if (!el) return;
  el.hidden = !on;
}
