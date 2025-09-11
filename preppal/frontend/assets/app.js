// ==============================
// PrepPal Frontend (app.js 完成版)
// ==============================

// ちいさなヘルパ
const $ = (id) => document.getElementById(id);

// 録音まわりの状態
let mediaRecorder = null;
let chunks = [];
let t0 = 0;

// 現在ひらいている録音のID（ここだけを見る）
let currentId = null;

// ------------------------------------
// MediaRecorder 準備
// ------------------------------------
async function ensureRecorder() {
  if (mediaRecorder) return mediaRecorder;
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  mediaRecorder = new MediaRecorder(stream);

  mediaRecorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };

  mediaRecorder.onstop = async () => {
    try {
      const blob = new Blob(chunks, { type: "audio/webm" });
      chunks = [];
      const dur = Math.round((performance.now() - t0) / 1000);

      $("status").textContent = "Uploading…";
      const fd = new FormData();
      fd.append("audio", blob, "recording.webm");
      fd.append("language", "ja");
      fd.append("duration_sec", String(dur));

      const res = await fetch("/api/transcribe_and_summarize", {
        method: "POST",
        body: fd,
      });
      const json = await res.json();

      $("status").textContent = "Transcribed";
      await loadList();

      // ★ アップロード直後に自動でその録音を開く
      if (json && json.id) openDetail(json.id);
    } catch (e) {
      console.error(e);
      $("status").textContent = "Error";
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
    $("status").textContent = "Recording…（もう一度タップで停止）";
  }else{
    recArea.classList.remove("recording");
    btnMic.setAttribute("aria-pressed","false");
    // 停止直後は onstop 内でステータスを更新するので、ここでは触らない or 軽い表示
    if ($("status").textContent.startsWith("Recording…")){
      $("status").textContent = "Processing…";
    }
  }
}

// マイクの丸いボタンを押したら開始/停止をトグル
$("btnMic").addEventListener("click", async ()=>{
  try{
    const mr = await ensureRecorder();
    if (!isRecording){
      // 録音開始
      t0 = performance.now();
      mr.start();
      setRecordingUI(true);
    }else{
      // 録音停止（→ onstop が走ってアップロードなどが始まる）
      // 連打防止に少しの間だけ無効化
      $("btnMic").disabled = true;
      setTimeout(()=>($("btnMic").disabled=false), 500);
      mr.stop();
      setRecordingUI(false);
    }
  }catch(e){
    console.error(e);
    alert("マイク権限を許可してください。");
  }
});

// キーボードでも操作できるよう Enter/Space でクリック扱い（任意）
$("btnMic").addEventListener("keydown", (ev)=>{
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
  const m = Math.floor(sec / 60),
    s = Math.floor(sec % 60);
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
      row.innerHTML = `
        <div>
          <div class="item-title">${it.title || "Untitled"}</div>
          <div class="item-sub">${fmtDT(it.created_at)}</div>
        </div>
        <div class="meta">${fmtDur(it.duration_sec)}</div>
        <div class="pill">Transcribed</div>
      `;
      row.addEventListener("click", () => openDetail(it.id));
      box.appendChild(row);
    });

    // ★ まだ何も開いていなければ、先頭を自動で開く
    if (!currentId && items.length > 0) {
      openDetail(items[0].id);
    }
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

    currentId = id; // ★ここで記憶

    const titleInput = $("editTitle");
    const tx = $("tx");
    const sum = $("sum");
    const detail = $("detail");

    if (titleInput) titleInput.value = r.title || "";
    if (tx) tx.textContent = r.transcript || "";
    if (sum) sum.textContent = r.summary || "";
    if (detail) {
      detail.classList.add("active");
      detail.style.display = "block";
      detail.scrollIntoView({ behavior: "smooth" });
    }
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
    const res = await fetch(`/api/recordings/${currentId}/title`, {
      method: "POST",
      body: fd,
    });
    const json = await res.json();
    if (json.ok) {
      await loadList();
      alert("タイトルを更新しました");
    } else {
      alert("更新に失敗: " + (json.error || ""));
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
  $("next").textContent = "次回復習: " + json.next_review_at;

  try {
    if (window.Notification && Notification.permission !== "granted") {
      await Notification.requestPermission();
    }
    if (Notification.permission === "granted") {
      const ms = new Date(json.next_review_at).getTime() - Date.now();
      setTimeout(
        () => new Notification("PrepPal: 復習タイムです！"),
        Math.max(0, ms)
      );
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
  $("next").textContent = "次回復習: " + json.next_review_at;
});

// ------------------------------------
// 入力から再要約（重要センテンス → 再要約）
// ------------------------------------
const btnReSummInput = $("btnReSummInput");
if (btnReSummInput) {
  btnReSummInput.addEventListener("click", async () => {
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
    if (!json.ok) {
      alert("再要約に失敗しました");
      return;
    }

    // 要約の表示を更新
    const sumEl = $("sum");
    if (sumEl) sumEl.textContent = json.summary || "";
  });
}

// ------------------------------------
// 要約の読み上げ（TTS）
// ------------------------------------
const btnSpeak = $("btnSpeak");
if (btnSpeak) {
  btnSpeak.addEventListener("click", () => {
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
}

// ==================== テーマ切替（GitHub風：ライト/ダーク） ====================
// 日本語：ユーザの選択を localStorage に保存。未選択時はOS設定を自動適用。
(function(){
  const KEY = "preppal-theme"; // "light" | "dark"
  const root = document.documentElement;
  const btn  = document.getElementById("themeToggle");

  // 初期反映
  const saved = localStorage.getItem(KEY);
  if (saved === "light" || saved === "dark"){
    root.setAttribute("data-theme", saved);
  } else {
    // 何も保存がない場合はOS設定に追従（setAttributeしない）
  }

  // クリックでトグル
  if (btn){
    btn.addEventListener("click", ()=>{
      const cur = root.getAttribute("data-theme") || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
      const next = (cur === "dark") ? "light" : "dark";
      root.setAttribute("data-theme", next);
      localStorage.setItem(KEY, next);
      // アイコンを軽く切り替え（任意）
      btn.textContent = next === "dark" ? "🌗" : "🌞";
    });
    // 初期アイコン
    const initial = root.getAttribute("data-theme") || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    btn.textContent = initial === "dark" ? "🌗" : "🌞";
  }
})();
