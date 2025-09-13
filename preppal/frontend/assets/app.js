// ==============================
// PrepPal Frontend (app.js 完全版・修正版)
// ==============================

// ちいさなヘルパ
const $ = (id) => document.getElementById(id);

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
  }
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

      const res = await fetch("/api/transcribe_and_summarize", { method: "POST", body: fd });
      const json = await res.json();

      $("status") && ($("status").textContent = "Transcribed");
      await loadList();

      // 自動で詳細を開かない（ユーザーがクリックした時のみ）
      // if (json && json.id) openDetail(json.id);

    } catch (e) {
      console.error(e);
      $("status") && ($("status").textContent = "Error");
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
// Recent 一覧
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

async function loadList() {
  const box = $("list");
  if (!box) return;
  box.innerHTML = "";

  try {
    const res = await fetch("/api/recordings");
    const items = await res.json();

    if (!Array.isArray(items) || !items.length) {
      box.innerHTML = '<div class="muted">No recordings yet.</div>';
      return;
    }

    items.forEach((it) => {
      const row = document.createElement("div");
      row.className = "item";
      row.setAttribute("data-id", it.id); // ← 行識別用
      row.innerHTML = `
        <div>
          <div class="item-title">${it.title || "Untitled"}</div>
          <div class="item-sub">${fmtDT(it.created_at)}</div>
        </div>
        <div class="meta">${fmtDur(it.duration_sec)}</div>
        <div class="pill">Transcribed</div>
      `;

      // ★ トグル動作：同じ行をもう一度クリックで閉じる
      row.addEventListener("click", async () => {
        if (currentId === it.id && isDetailOpen()){
          // 今開いているのを閉じる
          currentId = null;
          hideDetail();
          updateSelectedRow(); // ハイライト解除
          return;
        }
        // 別のアイテム or 閉じている → 開く
        await openDetail(it.id);
      });

      box.appendChild(row);
    });

    // 自動オープンはしない
    // if (!currentId && items.length > 0) openDetail(items[0].id);

    // 再描画後にハイライトを再適用
    updateSelectedRow();

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
    const r = await fetch("/api/recordings/" + id).then((r) => r.json());

    currentId = id; // 選択IDを記憶

    const titleInput = $("editTitle");
    const tx = $("tx");
    const sum = $("sum");

    if (titleInput) titleInput.value = r.title || "";
    if (tx) tx.textContent = r.transcript || "";
    if (sum) sum.textContent = r.summary || "";

    showDetail();
    document.getElementById("detail")?.scrollIntoView({ behavior: "smooth" });

    // 選択行のハイライト更新
    updateSelectedRow();

        // ★★★ ここに追加：この録音の要約を読み上げ対象に初期化
    initTTSControls(id, 'summary');

  } catch (e) {
    console.error(e);
    alert("詳細の取得に失敗しました");
  }
}

// ------------------------------------
// タイトル編集
// ------------------------------------
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
    const fd = new FormData();
    fd.append("title", title);
    const res = await fetch(`/api/recordings/${currentId}/title`, { method: "POST", body: fd });
    const json = await res.json();

    if (json?.ok || json?.success || json?.status === "ok" || json?.title || json?.id) {
      await loadList();
      alert("タイトルを更新しました");
    } else {
      alert("更新に失敗: " + (json?.error || ""));
    }
  } catch (e) {
    console.error(e);
    alert("通信エラーが発生しました");
  }
});

// ------------------------------------
// リマインド（デモ/試験日）
// ------------------------------------
$("demo")?.addEventListener("click", async () => {
  const email = $("email")?.value || "";
  // できれば現在開いている録音に設定。なければ先頭に。
  let rid = currentId;
  if (!rid) {
    const list = await fetch("/api/recordings").then((r) => r.json());
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

  const res = await fetch("/api/reminders", { method: "POST", body: fd });
  const json = await res.json();
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
    const list = await fetch("/api/recordings").then((r) => r.json());
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

  const res = await fetch("/api/reminders", { method: "POST", body: fd });
  const json = await res.json();
  $("next") && ($("next").textContent = "次回復習: " + (json.next_review_at || "-"));

  // タイムラインへ直接追加
  if (json?.next_review_at) await addTimelineItemFromNext(json.next_review_at, "Review");
});

// ------------------------------------
// 入力から再要約（重要センテンス → 再要約）
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

  const res = await fetch(`/api/recordings/${currentId}/resummarize_from_text`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, boost }),
  });
  const json = await res.json();

  if (!json || !("summary" in json)) {
    alert("再要約に失敗しました");
    return;
  }

  const sumEl = $("sum");
  if (sumEl) sumEl.textContent = json.summary || "";
});

// ------------------------------------
// 要約の読み上げ（TTS）
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

// Record→「今の録音から取り込み」ボタンはそのまま利用可能
// （HTML上の #btnNoteFromCurrent を既に使っているため動作は同じ）
// --- 「今の録音から取り込み」実装（未選択時は先頭録音を使用、Notesタブへ遷移しエディタに流し込み、サイレント保存） ---
async function importCurrentRecordingToNote(){
  try{
    // 1) 録音IDを決定（currentId が無ければ先頭にフォールバック）
    let rid = window.currentId;
    if (!rid){
      const list = await fetch("/api/recordings").then(r=>r.json());
      if (!Array.isArray(list) || !list.length){
        alert("録音がありません。先に Record で録音してください。");
        return;
      }
      rid = list[0].id;
    }

    // 2) 録音詳細を取得
    const r = await fetch(`/api/recordings/${rid}`).then(r=>r.json());

    // 3) Notesタブへ遷移（あなたの setupTabs() が loadNotes() を呼びます）
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
      // recording_id を紐づけたいので currentId を一時的にこの録音にしておく
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

// クリックハンドラ登録
document.getElem

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
  const list = await fetch("/api/recordings").then(r=>r.json());
  const cards = [];
  for (const it of (list||[])){
    const r = await fetch("/api/recordings/"+it.id).then(r=>r.json());
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
  //   - 「見出し」セクションがあれば最優先
  //   - なければ最初の行や「## 見出し」/「見出し:」から拾う
  const mHead =
    t.match(/^\s*見出し\s*[:：]?\s*[\r\n-]*\s*(.+)$/m) ||
    t.match(/^\s*##\s*見出し\s*\n\s*-\s*(.+)$/m);
  if (mHead) {
    out.heading = mHead[1].trim().replace(/^[-•]\s*/, "");
  } else {
    // 先頭行の短いテキストを仮の見出しにする
    const firstLine = (t.split("\n").map(s=>s.trim()).find(Boolean) || "").slice(0, 24);
    out.heading = firstLine || "要約";
  }

  // 2) 要点（「要点」で始まるセクション → 箇条書き）
  //    ・見出しの次に「-」や「・」付き行を拾う
  const secPoints = t.split(/\n(?= *[＃#]*\s*要点)/)[1] || t; // 要点以降があれば優先
  const ptLines = secPoints.split("\n").map(s => s.trim());
  ptLines.forEach(line=>{
    // 「- ...」や「・...」を拾う（Markdown/日本語の箇条書き）
    const m = line.match(/^[-•・]\s*(.+)$/);
    if (m && out.points.length < 7) out.points.push(m[1].trim());
  });

  // 3) キーワード（「キーワード: A、B、C」形式）
  const mKey =
    t.match(/^\s*キーワード\s*[:：]\s*(.+)$/m) ||
    t.match(/^\s*##\s*キーワード\s*\n\s*-\s*(.+)$/m);
  if (mKey){
    out.keywords = mKey[1].split(/[、,]\s*/).map(s=>s.trim()).filter(Boolean).slice(0, 8);
  }

  // 4) Q&A（すでに実装済の extractQA を再利用：質問/回答/設問/解答対応）
  try{
    out.qa = extractQA(t).slice(0, 5); // 最大5組
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
  // name: 'light' | 'dark' | 'high'
  if (name === 'dark'){
    return {
      bg: '#0f172a', ink: '#e5e7eb',
      box: '#111827', line: '#334155',
      accent: '#22c55e', sub: '#93c5fd'
    };
  }
  if (name === 'high'){
    // ハイコントラスト（背景＝白or黒、インク＝反転）
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

// 日本語：図版を描画
function drawGraphicFromSummary(summaryText, themeName){
  const cvs = $("gReco");
  const alt = $("gRecoAlt");
  if (!cvs) return;
  const ctx = cvs.getContext('2d');

  // ブラウザのダークモード（data-theme含む）をざっくり確認
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
  // 左=見出し＋要点、右=キーワード＋Q&A
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
  // 箱背景
  ctx.fillStyle = theme.box;
  roundRect(ctx, leftX, y, leftW, boxH, 14, true, false);
  // タイトル
  ctx.fillStyle = theme.sub;
  ctx.font = `bold 16px ${fontSans}`;
  ctx.fillText("要点", leftX+14, y+22);
  // リスト
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

  // キーワードをタグ風に
  const keys = (S.keywords.length ? S.keywords : ["（なし）"]).slice(0,8);
  let kx = rightX + 14, ky = ry + 50;
  ctx.font = `15px ${fontSans}`;
  keys.forEach(word=>{
    const w = Math.ceil(ctx.measureText(word).width) + 18;
    if (kx + w > rightX + rightW - 14){
      kx = rightX + 14;
      ky += 30;
    }
    // タグ背景
    ctx.fillStyle = theme.bg === '#ffffff' ? '#eef2ff' : '#1f2937';
    roundRect(ctx, kx, ky-18, w, 26, 13, true, false);
    // 文字
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

  // 吹き出し風に Q と A を交互表示（絵文字で視覚的に）
  let qy = ry + 48;
  const QA = (S.qa.length ? S.qa : [{q:"（質問なし）", a:"（回答なし）"}]).slice(0,5);
  ctx.font = `15px ${fontSans}`;
  QA.forEach((pair, idx)=>{
    // Q
    ctx.fillStyle = theme.ink;
    const qLines = wrapText(ctx, `❓ ${pair.q || ""}`, rightW - 28);
    qLines.forEach((ln, i) => ctx.fillText(ln, rightX+14, qy + i*20));
    qy += Math.max(20*qLines.length + 4, 24);
    // A
    ctx.fillStyle = theme.accent;
    const aLines = wrapText(ctx, `💡 ${pair.a || ""}`, rightW - 28);
    aLines.forEach((ln, i) => ctx.fillText(ln, rightX+14, qy + i*20));
    qy += Math.max(20*aLines.length + 10, 26);
  });

  // 代替テキスト（説明）も生成
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

// 日本語：「図版を生成」ボタン
$("btnGenGraphic")?.addEventListener("click", ()=>{
  if (!currentId){
    alert("先に一覧から録音を1件開き、要約を表示してください。");
    return;
  }
  const summary = $("sum")?.textContent || "";
  if (!summary.trim()){
    alert("要約が空です。録音を選ぶか、要約を作成してください。");
    return;
  }
  const theme = $("gTheme")?.value || "light";
  drawGraphicFromSummary(summary, theme);
  const saver = $("btnSaveGraphic");
  if (saver) saver.disabled = false;
});

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

  // 1) 画面に今このラッパがどれくらいの高さで置けるかを計算
  const rectTop = wrap.getBoundingClientRect().top;          // 画面上からの距離（px）
  const vh      = window.innerHeight || document.documentElement.clientHeight;
  const availableH = Math.max(240, Math.floor(vh - rectTop - 16)); // 下マージン少し

  // 2) 幅は親コンテナに合わせる（wrapの内幅）
  const availableW = Math.floor(wrap.clientWidth || wrap.getBoundingClientRect().width);

  // 3) 4:3 の比率で、はみ出さない最大サイズにする
  //    - 幅に合わせたときの高さ: w * 3/4
  //    - 高さに合わせたときの幅: h * 4/3
  let targetW = availableW;
  let targetH = Math.floor(targetW * 3 / 4);
  if (targetH > availableH){
    targetH = availableH;
    targetW = Math.floor(targetH * 4 / 3);
  }

  // 4) 見た目サイズ（CSS）だけ変更（内部の解像度はそのまま）
  cvs.style.width  = targetW + "px";
  cvs.style.height = targetH + "px";

  // 5) ラッパの高さも合わせて“はみ出し”を防ぐ
  wrap.style.maxHeight = (targetH + 2) + "px"; // 枠線ぶん少し足す
}

// 初期化：ページロード時・リサイズ時・タブ切替時に呼ぶ
window.addEventListener("load", sizeGraphicCanvasToViewport);
window.addEventListener("resize", sizeGraphicCanvasToViewport);

// 既存の図版生成後にも呼んでおくと安心
const _origGenGraphic = document.getElementById("btnGenGraphic")?.onclick;
document.getElementById("btnGenGraphic")?.addEventListener("click", ()=>{
  // 既存の描画が終わったあと（次フレーム）にサイズ調整
  requestAnimationFrame(sizeGraphicCanvasToViewport);
});

// タブ「Record」を開いた時にも調整（既存 setupTabs の activate で追記してOK）
(function hookTabForGraphic(){
  const tabs = document.querySelectorAll('.tabs .tab');
  tabs.forEach(t=>{
    t.addEventListener('click', ()=>{
      if (t.dataset.target === 'view-record'){
        // タブ切替の描画が終わった後に
        setTimeout(sizeGraphicCanvasToViewport, 0);
      }
    });
  });
})();

// ==============================
// TTS（読み上げ）コントロール 完成形
// - 再生/停止トグルを1ボタンに統一
// - 「先頭から再生」ボタンを追加
// - 音量スライダー対応
// - 他録音へ切替やタブ移動時のクリーンアップも提供
// ==============================

let ttsState = {
  recordId: null,      // 現在対象の録音ID
  field: 'summary',    // 'summary' or 'transcript'
  audioEl: null,       // <audio id="ttsPlayer">
  toggleBtn: null,     // <button id="ttsToggleBtn">
  restartBtn: null,    // <button id="ttsRestartBtn">
  volumeEl: null       // <input id="ttsVolume">
};

/**
 * 読み上げUIの初期化：録音詳細を開いた直後に呼ぶ
 * @param {string} recordId - 録音ID
 * @param {string} field    - 'summary' or 'transcript'
 */
function initTTSControls(recordId, field = 'summary') {
  // DOM要素を取得（まだなら初回だけ）
  if (!ttsState.audioEl)   ttsState.audioEl   = document.getElementById('ttsPlayer');
  if (!ttsState.toggleBtn) ttsState.toggleBtn = document.getElementById('ttsToggleBtn');
  if (!ttsState.restartBtn)ttsState.restartBtn= document.getElementById('ttsRestartBtn');
  if (!ttsState.volumeEl)  ttsState.volumeEl  = document.getElementById('ttsVolume');

  // 要素が存在しない場合は何もしない（HTMLが未配置のケース）
  if (!ttsState.audioEl || !ttsState.toggleBtn || !ttsState.restartBtn || !ttsState.volumeEl) {
    console.warn('TTS UI 要素が見つかりません（index.html のブロックが貼られているか確認）');
    return;
  }

  // 二重イベント登録を避けるため、いったん解除
  detachTTSEvents();

  // 対象ID/フィールドを更新
  ttsState.recordId = recordId;
  ttsState.field = field;

  // バックエンドのTTSエンドポイントをソースに設定
  // 例: /api/tts/<id>?field=summary
  const src = `/api/tts/${encodeURIComponent(recordId)}?field=${encodeURIComponent(field)}`;
  ttsState.audioEl.src = src;
  ttsState.audioEl.load();            // 念のため再読込
  ttsState.audioEl.currentTime = 0;   // いつでも先頭から始められるよう0へ

  // UIを停止状態に揃える
  setTTSToggleUI(false);

  // イベント登録
  attachTTSEvents();
}

/** イベント登録 */
function attachTTSEvents() {
  ttsState.toggleBtn.addEventListener('click', onTTSToggleClick);
  ttsState.restartBtn.addEventListener('click', onTTSRestartClick);
  ttsState.audioEl.addEventListener('ended', onTTSEnded);
  ttsState.volumeEl.addEventListener('input', onTTSVolumeChange);
}

/** イベント解除（重複防止） */
function detachTTSEvents() {
  if (!ttsState.audioEl || !ttsState.toggleBtn || !ttsState.restartBtn || !ttsState.volumeEl) return;
  ttsState.toggleBtn.removeEventListener('click', onTTSToggleClick);
  ttsState.restartBtn.removeEventListener('click', onTTSRestartClick);
  ttsState.audioEl.removeEventListener('ended', onTTSEnded);
  ttsState.volumeEl.removeEventListener('input', onTTSVolumeChange);
}

/** トグルボタン：再生 ↔ 停止 */
async function onTTSToggleClick() {
  const a = ttsState.audioEl;
  // 「再生中判定」：paused=false かつ currentTime>0 を目安にする
  const playing = !a.paused && a.currentTime > 0;

  if (playing) {
    // 停止：currentTime は保持（ポーズ）
    a.pause();
    setTTSToggleUI(false);
  } else {
    try {
      await a.play();   // 初回はユーザー操作内なので自動再生制限を回避しやすい
      setTTSToggleUI(true);
    } catch (err) {
      console.warn('TTS 再生に失敗:', err);
      alert('ブラウザの自動再生制限で音声が再生できない場合があります。もう一度ボタンを押してください。');
      setTTSToggleUI(false);
    }
  }
}

/** 先頭から再生 */
async function onTTSRestartClick() {
  try {
    const a = ttsState.audioEl;
    a.pause();
    a.currentTime = 0;     // 先頭へ
    await a.play();
    setTTSToggleUI(true);
  } catch (err) {
    console.warn('TTS 先頭から再生に失敗:', err);
    setTTSToggleUI(false);
  }
}

/** 再生が自然終了したらUIを停止状態へ戻す */
function onTTSEnded() {
  setTTSToggleUI(false);
}

/** 音量変更（0.0〜1.0） */
function onTTSVolumeChange(e) {
  const v = Number(e.target.value);
  ttsState.audioEl.volume = isNaN(v) ? 1 : v;
}

/** トグルボタンのラベルとARIA属性を同期 */
function setTTSToggleUI(isPlaying) {
  if (!ttsState.toggleBtn) return;
  ttsState.toggleBtn.textContent = isPlaying ? '■ 停止' : '▶ 読み上げ';
  ttsState.toggleBtn.setAttribute('aria-pressed', isPlaying ? 'true' : 'false');
}

/**
 * （任意）タブ遷移や別録音に切り替える前に呼ぶと安全
 * - 再生を止めて先頭に戻す
 * - トグルUIを停止状態に揃える
 * - イベントを外す（次の initTTSControls で再登録）
 */
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
