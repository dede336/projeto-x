import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const router = Router();

const UNNAMED_DIR = path.resolve(process.cwd(), "src/seeds/unnamed_temp");
const MAPPING_FILE = path.resolve(process.cwd(), "src/seeds/unnamed_mapping.json");

function getUnnamedImages(): string[] {
  if (!fs.existsSync(UNNAMED_DIR)) return [];
  return fs.readdirSync(UNNAMED_DIR).filter((f) => /\.(png|jpg|gif|webp)$/i.test(f)).sort((a, b) => {
    const na = parseInt(a.match(/\d+/)?.[0] ?? "0");
    const nb = parseInt(b.match(/\d+/)?.[0] ?? "0");
    return na - nb;
  });
}

function loadMapping(): Record<string, string> {
  if (!fs.existsSync(MAPPING_FILE)) return {};
  try { return JSON.parse(fs.readFileSync(MAPPING_FILE, "utf-8")); } catch { return {}; }
}

router.get("/image/:filename", (req, res) => {
  const filename = path.basename(req.params.filename);
  const filepath = path.join(UNNAMED_DIR, filename);
  if (!fs.existsSync(filepath)) return res.status(404).send("Not found");
  res.sendFile(filepath);
});

router.post("/save", (req, res) => {
  const { names } = req.body as { names: Record<string, string> };
  if (!names || typeof names !== "object") return res.status(400).json({ error: "Invalid body" });
  const existing = loadMapping();
  const merged = { ...existing, ...names };
  fs.writeFileSync(MAPPING_FILE, JSON.stringify(merged, null, 2));
  res.json({ ok: true, saved: Object.keys(names).length });
});

router.get("/mapping", (req, res) => {
  res.json(loadMapping());
});

function buildHashGroups(images: string[]): Record<string, string[]> {
  const hashMap: Record<string, string[]> = {};
  for (const f of images) {
    try {
      const buf = fs.readFileSync(path.join(UNNAMED_DIR, f));
      const h = crypto.createHash("md5").update(buf).digest("hex");
      if (!hashMap[h]) hashMap[h] = [];
      hashMap[h].push(f);
    } catch { /* skip */ }
  }
  return Object.fromEntries(Object.entries(hashMap).filter(([, v]) => v.length > 1));
}

router.get("/", (req, res) => {
  const images = getUnnamedImages();
  const mapping = loadMapping();
  const total = images.length;
  const named = images.filter((f) => mapping[f]?.trim()).length;

  // Build duplicate name index from current mapping
  const nameIndex: Record<string, string[]> = {};
  for (const [file, name] of Object.entries(mapping)) {
    if (!name?.trim()) continue;
    const key = name.trim().toLowerCase();
    if (!nameIndex[key]) nameIndex[key] = [];
    nameIndex[key].push(file);
  }
  const dupNames = new Set(Object.keys(nameIndex).filter(k => nameIndex[k].length > 1));

  // Build hash groups (identical image content)
  const hashGroups = buildHashGroups(images);
  // file -> sibling files with same content
  const identicalMap: Record<string, string[]> = {};
  for (const siblings of Object.values(hashGroups)) {
    for (const f of siblings) {
      identicalMap[f] = siblings.filter(s => s !== f);
    }
  }

  const dupCount = images.filter(f => {
    const n = mapping[f]?.trim().toLowerCase();
    return (n && dupNames.has(n)) || !!identicalMap[f];
  }).length;

  const rows = images.map((filename) => {
    const saved = mapping[filename] ?? "";
    const isDone = saved.trim().length > 0;
    const isDupName = isDone && dupNames.has(saved.trim().toLowerCase());
    const isDupContent = !!identicalMap[filename];
    const isDup = isDupName || isDupContent;

    const nameSiblings = isDupName
      ? nameIndex[saved.trim().toLowerCase()].filter(f => f !== filename).join(", ")
      : "";
    const contentSiblings = isDupContent ? identicalMap[filename].join(", ") : "";

    let badgeHtml = `<div class="dup-badge" id="dup-${filename}" style="display:none"></div>`;
    if (isDupName && isDupContent) {
      badgeHtml = `<div class="dup-badge" id="dup-${filename}">⚠️ Nome duplicado em: <strong>${nameSiblings}</strong><br>🔁 Imagem idêntica a: <strong>${contentSiblings}</strong></div>`;
    } else if (isDupName) {
      badgeHtml = `<div class="dup-badge" id="dup-${filename}">⚠️ Nome duplicado — também em: <strong>${nameSiblings}</strong></div>`;
    } else if (isDupContent) {
      badgeHtml = `<div class="dup-badge identical-badge" id="dup-${filename}">🔁 Imagem idêntica a: <strong>${contentSiblings}</strong> — pode pular esta!</div>`;
    }

    return `
    <tr id="row-${filename}" class="${isDone ? "done" : ""}${isDupName ? " dup" : ""}${isDupContent ? " identical" : ""}">
      <td class="img-cell">
        <img src="/api/naming-tool/image/${filename}" alt="${filename}" loading="lazy" />
        <div class="filename">${filename}</div>
      </td>
      <td class="input-cell">
        <div class="input-wrap">
          <input type="text"
            id="input-${filename}"
            class="name-input"
            data-file="${filename}"
            value="${saved}"
            placeholder="Nome do Digimon..."
            autocomplete="off"
            oninput="checkDuplicate(this)"
          />
          <button class="save-btn" onclick="saveOne('${filename}')">✓</button>
        </div>
        ${badgeHtml}
      </td>
    </tr>`;
  }).join("");

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Nomear Imagens de Digimons</title>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: 'Segoe UI', sans-serif; background: #0f0f1a; color: #e0e0e0; }
header { background: #1a1a2e; padding: 16px 24px; display: flex; align-items: center; gap: 16px; position: sticky; top: 0; z-index: 100; box-shadow: 0 2px 12px #000a; }
header h1 { font-size: 20px; color: #a78bfa; }
.progress-bar { flex: 1; background: #2d2d4a; border-radius: 8px; height: 12px; overflow: hidden; }
.progress-fill { height: 100%; background: linear-gradient(90deg, #7c3aed, #a78bfa); border-radius: 8px; transition: width 0.4s; }
.progress-text { font-size: 13px; color: #a78bfa; white-space: nowrap; }
.filter-bar { background: #16162a; padding: 10px 24px; display: flex; gap: 10px; align-items: center; flex-wrap: wrap; border-bottom: 1px solid #2d2d4a; position: sticky; top: 65px; z-index: 99; }
.filter-btn { padding: 6px 16px; border-radius: 20px; border: 1px solid #3d3d60; background: transparent; color: #a0a0c0; cursor: pointer; font-size: 13px; transition: all 0.2s; }
.filter-btn.active { background: #7c3aed; border-color: #7c3aed; color: #fff; }
.filter-btn.dup-btn.active { background: #b45309; border-color: #b45309; }
#search-box { padding: 6px 14px; border-radius: 20px; border: 1px solid #3d3d60; background: #1a1a2e; color: #e0e0e0; font-size: 13px; width: 220px; }
.save-all-btn { margin-left: auto; padding: 8px 20px; border-radius: 20px; border: none; background: #7c3aed; color: #fff; cursor: pointer; font-size: 14px; font-weight: 600; }
.save-all-btn:hover { background: #6d28d9; }
table { width: 100%; border-collapse: collapse; }
tr { border-bottom: 1px solid #1e1e34; transition: background 0.15s; }
tr:hover { background: #16162a; }
tr.done .img-cell { opacity: 0.65; }
tr.done .name-input { border-color: #4ade80; color: #4ade80; }
tr.dup .name-input { border-color: #f59e0b !important; color: #f59e0b !important; }
tr.identical { background: #0e1a1a; }
tr.identical .name-input { border-color: #22d3ee !important; color: #22d3ee !important; }
.identical-badge { color: #22d3ee !important; background: #071518 !important; border-color: #0e7490 !important; }
.img-cell { padding: 12px 16px 12px 24px; width: 200px; text-align: center; }
.img-cell img { max-width: 120px; max-height: 120px; object-fit: contain; border-radius: 6px; background: #1a1a2e; display: block; margin: 0 auto 6px; }
.filename { font-size: 11px; color: #666; word-break: break-all; }
.input-cell { padding: 12px 24px 12px 12px; }
.input-wrap { display: flex; align-items: center; gap: 8px; }
.name-input { flex: 1; padding: 10px 14px; border-radius: 8px; border: 1px solid #3d3d60; background: #1a1a2e; color: #e0e0e0; font-size: 15px; transition: border-color 0.2s; }
.name-input:focus { outline: none; border-color: #7c3aed; }
.save-btn { padding: 10px 14px; border-radius: 8px; border: none; background: #3d3d60; color: #a78bfa; cursor: pointer; font-size: 16px; flex-shrink: 0; }
.save-btn:hover { background: #7c3aed; color: #fff; }
.dup-badge { margin-top: 6px; font-size: 12px; color: #f59e0b; background: #1c150a; border: 1px solid #78350f; border-radius: 6px; padding: 5px 10px; }
.toast { position: fixed; bottom: 24px; right: 24px; background: #4ade80; color: #000; padding: 12px 20px; border-radius: 10px; font-weight: 600; font-size: 14px; opacity: 0; transform: translateY(10px); transition: all 0.3s; pointer-events: none; z-index: 999; }
.toast.show { opacity: 1; transform: translateY(0); }
.toast.error { background: #f87171; }
.toast.warn { background: #fbbf24; }
</style>
</head>
<body>
<header>
  <h1>🦕 Nomear Imagens Digimon</h1>
  <div class="progress-bar"><div class="progress-fill" id="progress-fill" style="width:${Math.round((named/total)*100)}%"></div></div>
  <div class="progress-text" id="progress-text">${named}/${total} nomeados</div>
</header>
<div class="filter-bar">
  <button class="filter-btn active" onclick="setFilter('all', this)">Todos (${total})</button>
  <button class="filter-btn" onclick="setFilter('unnamed', this)">Sem nome (${total - named})</button>
  <button class="filter-btn" onclick="setFilter('named', this)">Nomeados (${named})</button>
  <button class="filter-btn dup-btn" onclick="setFilter('dup', this)">⚠️ Duplicados (${dupCount})</button>
  <button class="filter-btn" style="border-color:#0e7490;color:#22d3ee" onclick="setFilter('identical', this)">🔁 Idênticas (${Object.keys(identicalMap).length})</button>
  <input type="text" id="search-box" placeholder="Buscar por arquivo ou nome..." oninput="applyFilter()" />
  <button class="save-all-btn" onclick="saveAll()">💾 Salvar Todos</button>
</div>
<table id="main-table">
  <tbody>${rows}</tbody>
</table>
<div class="toast" id="toast"></div>

<script>
let currentFilter = 'all';

// Build name→[files] index in JS for real-time dup detection
const nameMap = {}; // lowercase name → Set of files
document.querySelectorAll('.name-input').forEach(inp => {
  const v = inp.value.trim().toLowerCase();
  if (v) {
    if (!nameMap[v]) nameMap[v] = new Set();
    nameMap[v].add(inp.dataset.file);
  }
});

function checkDuplicate(inp) {
  const file = inp.dataset.file;
  const oldVal = inp._lastVal ?? '';
  const newVal = inp.value.trim().toLowerCase();
  if (oldVal === newVal) return;
  inp._lastVal = newVal;

  // Remove from old name
  if (oldVal && nameMap[oldVal]) {
    nameMap[oldVal].delete(file);
    if (nameMap[oldVal].size === 0) delete nameMap[oldVal];
    // Update siblings that had old name
    refreshDupBadges(oldVal);
  }

  // Add to new name
  if (newVal) {
    if (!nameMap[newVal]) nameMap[newVal] = new Set();
    nameMap[newVal].add(file);
    refreshDupBadges(newVal);
  }

  // Update this row's badge immediately
  updateRowDup(file, newVal);
}

function refreshDupBadges(nameLower) {
  if (!nameLower) return;
  const files = nameMap[nameLower] ? [...nameMap[nameLower]] : [];
  files.forEach(f => updateRowDup(f, nameLower));
}

function updateRowDup(file, nameLower) {
  const row = document.getElementById('row-' + file);
  const badge = document.getElementById('dup-' + file);
  const inp = document.getElementById('input-' + file);
  if (!row || !badge || !inp) return;

  const currentName = inp.value.trim().toLowerCase();
  const siblings = nameMap[currentName] ? [...nameMap[currentName]].filter(f => f !== file) : [];
  const isDup = siblings.length > 0;

  if (isDup) {
    row.classList.add('dup');
    badge.style.display = '';
    badge.innerHTML = '⚠️ Nome duplicado — também em: <strong>' + siblings.join(', ') + '</strong>';
  } else {
    row.classList.remove('dup');
    badge.style.display = 'none';
    badge.innerHTML = '';
  }
}

function updateProgress() {
  const named = document.querySelectorAll('tr.done').length;
  const total = document.querySelectorAll('tr[id^="row-"]').length;
  const pct = Math.round((named/total)*100);
  document.getElementById('progress-fill').style.width = pct + '%';
  document.getElementById('progress-text').textContent = named + '/' + total + ' nomeados';
}

function showToast(msg, type) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show' + (type ? ' ' + type : '');
  clearTimeout(t._t);
  t._t = setTimeout(() => t.className = 'toast', 2800);
}

async function saveOne(filename) {
  const inp = document.getElementById('input-' + filename);
  const name = inp.value.trim();

  // Check for dups before saving
  const siblings = nameMap[name.toLowerCase()] ? [...nameMap[name.toLowerCase()]].filter(f => f !== filename) : [];
  if (siblings.length > 0) {
    showToast('⚠️ "' + name + '" já está em: ' + siblings.join(', '), 'warn');
  }

  const names = {}; names[filename] = name;
  try {
    const r = await fetch('/api/naming-tool/save', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({names}) });
    const j = await r.json();
    if (j.ok) {
      const row = document.getElementById('row-' + filename);
      if (name) { row.classList.add('done'); } else { row.classList.remove('done'); }
      if (siblings.length === 0) showToast(name ? '✓ ' + name + ' salvo!' : 'Nome removido');
      updateProgress();
      applyFilter();
    }
  } catch(e) { showToast('Erro ao salvar', 'error'); }
}

async function saveAll() {
  const inputs = document.querySelectorAll('.name-input');
  const names = {};
  inputs.forEach(inp => { names[inp.dataset.file] = inp.value.trim(); });
  const dups = Object.values(nameMap).filter(s => s.size > 1).length;
  if (dups > 0) showToast('⚠️ Salvando com ' + dups + ' nome(s) duplicado(s)!', 'warn');
  try {
    const r = await fetch('/api/naming-tool/save', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({names}) });
    const j = await r.json();
    if (j.ok) {
      document.querySelectorAll('.name-input').forEach(inp => {
        const row = document.getElementById('row-' + inp.dataset.file);
        if (inp.value.trim()) row.classList.add('done'); else row.classList.remove('done');
      });
      if (dups === 0) showToast('✓ ' + j.saved + ' entradas salvas!');
      updateProgress();
      applyFilter();
    }
  } catch(e) { showToast('Erro ao salvar', 'error'); }
}

document.querySelectorAll('.name-input').forEach(inp => {
  inp._lastVal = inp.value.trim().toLowerCase();
  inp.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      saveOne(inp.dataset.file);
      const rows = [...document.querySelectorAll('tr[id^="row-"]:not([style*="display: none"])')];
      const idx = rows.findIndex(r => r.id === 'row-' + inp.dataset.file);
      if (idx >= 0 && idx < rows.length - 1) {
        const next = rows[idx+1].querySelector('.name-input');
        if (next) next.focus();
      }
    }
  });
});

function setFilter(f, btn) {
  currentFilter = f;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  applyFilter();
}

function applyFilter() {
  const search = document.getElementById('search-box').value.toLowerCase();
  document.querySelectorAll('tr[id^="row-"]').forEach(row => {
    const isDone = row.classList.contains('done');
    const isDup = row.classList.contains('dup');
    const filename = row.querySelector('.filename')?.textContent?.toLowerCase() ?? '';
    const inputVal = row.querySelector('.name-input')?.value?.toLowerCase() ?? '';
    let show = true;
    const isIdentical = row.classList.contains('identical');
    if (currentFilter === 'named' && !isDone) show = false;
    if (currentFilter === 'unnamed' && isDone) show = false;
    if (currentFilter === 'dup' && !isDup) show = false;
    if (currentFilter === 'identical' && !isIdentical) show = false;
    if (search && !filename.includes(search) && !inputVal.includes(search)) show = false;
    row.style.display = show ? '' : 'none';
  });
}
</script>
</body>
</html>`;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(html);
});

export default router;
