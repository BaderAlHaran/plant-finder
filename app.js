import { pipeline, env } from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.0.2";
import { PLANTS, NON_PLANT_LABELS } from "./plants.js";

// Always download the model from the Hugging Face hub (nothing is stored by this app).
env.allowLocalModels = false;

const MODEL = "Xenova/clip-vit-base-patch16";
const $ = (id) => document.getElementById(id);

let classifierPromise = null;
let currentImageUrl = null;

// ---------- Model ----------
function loadClassifier() {
  if (!classifierPromise) {
    const files = {};
    classifierPromise = pipeline("zero-shot-image-classification", MODEL, {
      progress_callback: (p) => {
        if (p.status === "progress" && p.total) {
          files[p.file] = { loaded: p.loaded, total: p.total };
          const all = Object.values(files);
          const loaded = all.reduce((s, f) => s + f.loaded, 0);
          const total = all.reduce((s, f) => s + f.total, 0);
          showStatus(`جارٍ تنزيل نموذج الذكاء الاصطناعي (أول مرة فقط)… ${Math.round(loaded / 1e6)} / ${Math.round(total / 1e6)} ميغابايت`, loaded / total);
        }
      }
    }).catch((err) => {
      classifierPromise = null;
      throw err;
    });
  }
  return classifierPromise;
}

// ---------- Identify ----------
// Decode the photo and shrink it so big phone pictures are fast to analyse.
// Rejects if the browser can't open the format (e.g. HEIC outside Safari).
function prepareImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 1024 / Math.max(img.naturalWidth, img.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.naturalWidth * scale);
      canvas.height = Math.round(img.naturalHeight * scale);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.92));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("unreadable"));
    };
    img.src = url;
  });
}

function showError(message) {
  showStatus(message);
  $("status").querySelector(".spinner").hidden = true;
  $("preview").hidden = true;
  $("uploadBody").hidden = false;
}

async function identify(file) {
  // Some Android phones give camera photos an empty type, so only reject known non-images.
  if (!file || (file.type && !file.type.startsWith("image/"))) return;
  $("results").hidden = true;
  $("care").hidden = true;

  try {
    currentImageUrl = await prepareImage(file);
  } catch {
    showError("لا يمكن فتح هذه الصورة. جرّبي صورة أخرى، أو التقطي صورة جديدة بزر الكاميرا.");
    return;
  }

  $("previewImg").src = currentImageUrl;
  $("preview").hidden = false;
  $("uploadBody").hidden = true;
  showStatus("جارٍ تجهيز الذكاء الاصطناعي…");

  try {
    const classifier = await loadClassifier();
    showStatus("جارٍ التعرّف على النبتة…");
    const labels = [...PLANTS.map((p) => p.label), ...NON_PLANT_LABELS];
    const output = await classifier(currentImageUrl, labels, { hypothesis_template: "a photo of {}." });
    showResults(output);
  } catch (err) {
    console.error(err);
    showError("تعذّر تحميل الذكاء الاصطناعي. تأكدي من اتصال الإنترنت ثم حاولي مرة أخرى.");
  }
}

function showResults(output) {
  hideStatus();
  const byLabel = new Map(PLANTS.map((p) => [p.label, p]));
  const plantScores = output.filter((o) => byLabel.has(o.label));
  const nonPlantScore = output.filter((o) => !byLabel.has(o.label)).reduce((s, o) => s + o.score, 0);
  const plantTotal = plantScores.reduce((s, o) => s + o.score, 0) || 1;

  // Re-normalise among plants only so the percentages are easy to read.
  const top = plantScores.slice(0, 3).map((o) => ({ plant: byLabel.get(o.label), pct: (o.score / plantTotal) * 100 }));

  const note = $("matchNote");
  note.innerHTML = "";
  if (nonPlantScore > 0.5) {
    note.innerHTML = `<div class="alert warn">⚠️ لا تبدو هذه الصورة كنبتة. جرّبي صورة أقرب للأوراق.</div>`;
  } else if (top[0].pct < 35) {
    note.innerHTML = `<div class="alert warn">🤔 النتيجة غير مؤكدة. قارني النتائج بالأسفل، أو جرّبي صورة أوضح.</div>`;
  } else {
    note.textContent = "اضغطي على أي نتيجة لعرض طريقة العناية بها.";
  }

  const list = $("matches");
  list.innerHTML = "";
  top.forEach(({ plant, pct }, i) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <button class="match${i === 0 ? " active" : ""}">
        <span class="name">${plant.name}</span>
        <span class="sci">${plant.scientific}</span>
        <span class="pct">${Math.round(pct)}%</span>
        <span class="meter"><span style="width:${pct.toFixed(1)}%"></span></span>
      </button>`;
    li.querySelector("button").addEventListener("click", (e) => {
      list.querySelectorAll(".match").forEach((b) => b.classList.remove("active"));
      e.currentTarget.classList.add("active");
      showCare(plant);
    });
    list.appendChild(li);
  });

  $("results").hidden = false;
  showCare(top[0].plant, false);
}

// ---------- Care guide ----------
function showCare(plant, scroll = true) {
  const toxic = plant.petSafe ? "" : "danger";
  const interval = plant.waterDays;
  const days = Array.from({ length: 14 }, (_, i) => {
    const on = interval <= 14 && i % interval === 0;
    return `<span class="${on ? "on" : ""}">${on ? "💧" : i + 1}</span>`;
  }).join("");
  // Arabic number agreement: يوم / يومين / 3–10 أيام / 11+ يومًا
  const everyDays = interval === 1 ? "كل يوم" : interval === 2 ? "كل يومين"
    : interval <= 10 ? `كل ${interval} أيام` : `كل ${interval} يومًا`;
  const calText = interval > 14
    ? `اسقيها تقريبًا مرة ${everyDays} – أقل من مرة كل أسبوعين.`
    : `مثال لأسبوعين في الربيع والصيف: اسقيها تقريبًا ${everyDays}.`;

  const info = [
    ["☀️ الإضاءة", plant.light],
    ["🪴 التربة", plant.soil],
    ["💨 الرطوبة", plant.humidity],
    ["🌡️ درجة الحرارة", plant.temperature],
    ["🧪 التسميد", plant.fertilizer],
    ["🐾 الأمان للحيوانات والأطفال", plant.toxicity],
    ["🔁 تغيير الأصيص", plant.repotting],
    ["✂️ الإكثار", plant.propagation]
  ].map(([t, v]) => `<div class="info"><h3>${t}</h3><p>${v}</p></div>`).join("");

  const care = $("care");
  care.innerHTML = `
    <div class="card">
      <div class="care-head">
        <div>
          <h2>${plant.name}</h2>
          <p class="sci">${plant.scientific}</p>
        </div>
        <div class="tags">
          <span class="tag">${plant.category}</span>
          <span class="tag">العناية: ${plant.difficulty}</span>
          <span class="tag ${toxic}">${toxic ? "سامة للحيوانات" : "آمنة للحيوانات"}</span>
        </div>
      </div>

      <div class="water-box">
        <h3>💧 السقي</h3>
        <div class="water-grid">
          <div><small>الربيع والصيف</small><strong>${plant.water.summer}</strong></div>
          <div><small>الخريف والشتاء</small><strong>${plant.water.winter}</strong></div>
        </div>
        <p style="margin:0">${plant.water.how}</p>
        <div class="calendar">${days}</div>
        <p class="cal-label">${calText} المسي التربة دائمًا قبل السقي – هذا دليل تقريبي وليس قاعدة ثابتة.</p>
      </div>

      <div class="info-grid">${info}</div>

      <div class="info list-box">
        <h3>🩺 مشاكل شائعة</h3>
        <ul>${plant.problems.map((p) => `<li>${p}</li>`).join("")}</ul>
      </div>
      <div class="info list-box">
        <h3>💡 نصائح</h3>
        <ul>${plant.tips.map((p) => `<li>${p}</li>`).join("")}</ul>
      </div>
    </div>`;
  care.hidden = false;
  if (scroll) care.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ---------- Status helpers ----------
function showStatus(text, progress) {
  $("status").hidden = false;
  $("status").querySelector(".spinner").hidden = false;
  $("statusText").textContent = text;
  const bar = $("progressBar");
  if (typeof progress === "number") {
    bar.hidden = false;
    $("progressFill").style.width = `${Math.min(100, progress * 100).toFixed(1)}%`;
  } else {
    bar.hidden = true;
  }
}
function hideStatus() { $("status").hidden = true; }

function reset() {
  $("preview").hidden = true;
  $("uploadBody").hidden = false;
  $("results").hidden = true;
  $("care").hidden = true;
  hideStatus();
  $("fileInput").value = "";
  $("cameraInput").value = "";
  if (currentImageUrl) URL.revokeObjectURL(currentImageUrl);
  currentImageUrl = null;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ---------- Inputs ----------
$("fileInput").addEventListener("change", (e) => identify(e.target.files[0]));
$("cameraInput").addEventListener("change", (e) => identify(e.target.files[0]));
$("againBtn").addEventListener("click", reset);

const drop = $("dropZone");
["dragenter", "dragover"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("drag"); }));
["dragleave", "drop"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove("drag"); }));
drop.addEventListener("drop", (e) => identify(e.dataTransfer.files[0]));
window.addEventListener("paste", (e) => {
  const item = [...(e.clipboardData?.items || [])].find((i) => i.type.startsWith("image/"));
  if (item) identify(item.getAsFile());
});

// ---------- Browse ----------
let activeCategory = "الكل";
const ALL = "الكل";
const categories = [ALL, ...new Set(PLANTS.map((p) => p.category))];

function renderChips() {
  $("chips").innerHTML = categories
    .map((c) => `<button class="chip${c === activeCategory ? " on" : ""}" data-cat="${c}">${c}</button>`)
    .join("");
}
function renderList() {
  const q = $("search").value.trim().toLowerCase();
  const items = PLANTS
    .filter((p) => activeCategory === ALL || p.category === activeCategory)
    .filter((p) => !q || `${p.name} ${p.scientific} ${p.category}`.toLowerCase().includes(q))
    .sort((a, b) => a.name.localeCompare(b.name, "ar"));
  const list = $("plantList");
  list.innerHTML = items.length
    ? items.map((p) => `<li><button data-id="${p.id}">${p.name}<small>${p.scientific}</small></button></li>`).join("")
    : `<li class="note">لا توجد نتائج.</li>`;
}
$("chips").addEventListener("click", (e) => {
  const cat = e.target.dataset?.cat;
  if (!cat) return;
  activeCategory = cat;
  renderChips();
  renderList();
});
$("plantList").addEventListener("click", (e) => {
  const id = e.target.closest("button")?.dataset.id;
  const plant = PLANTS.find((p) => p.id === id);
  if (plant) showCare(plant);
});
$("search").addEventListener("input", renderList);

renderChips();
renderList();
