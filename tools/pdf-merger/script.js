// ── PDF MERGER script.js ─────────────────────────────────────────

let files = [];
let mergedPdfBytes = null;
let dragSrcIndex = null;
let selectedFileId = null;

const $ = id => document.getElementById(id);

const dropZone    = $('dropZone');
const fileInput   = $('fileInput');
const addMoreInput= $('addMoreInput');
const fileListEl  = $('fileList');
const mergeBtn    = $('mergeBtn');
const clearAllBtn = $('clearAllBtn');
const downloadBtn = $('downloadBtn');
const mergeAgainBtn=$('mergeAgainBtn');
const outputName  = $('outputName');
const fileCount   = $('fileCount');
const totalInfo   = $('totalInfo');
const mergeStatus = $('mergeStatus');
const statusMsg   = $('statusMsg');
const emptyState  = $('emptyState');
const mergePreview= $('mergePreview');
const progressPanel=$('progressPanel');
const successPanel= $('successPanel');
const mpFlow      = $('mpFlow');
const ppBarFill   = $('ppBarFill');
const ppTitle     = $('ppTitle');
const ppLabel     = $('ppLabel');
const spInfo      = $('spInfo');
const perFileSection=$('perFileSection');
const perFileName = $('perFileName');
const pfRange     = $('pfRange');
const pfRotation  = $('pfRotation');

// ── MOBILE TABS ──────────────────────────────────────────────────
document.querySelectorAll('.mtab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.mtab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const tab = btn.dataset.tab;
    document.querySelectorAll('[data-tab-content]').forEach(p => {
      p.classList.toggle('mobile-active', p.dataset.tabContent === tab);
    });
  });
});
// Activate first tab on mobile
if (window.innerWidth <= 900) {
  document.querySelector('[data-tab-content="files"]').classList.add('mobile-active');
}

// ── FILE INPUT ───────────────────────────────────────────────────
fileInput.addEventListener('change',    e => addFiles(e.target.files));
addMoreInput.addEventListener('change', e => addFiles(e.target.files));

dropZone.addEventListener('click', e => {
  if (e.target.closest('label') || e.target.tagName === 'INPUT') return;
  fileInput.click();
});
dropZone.addEventListener('dragover',  e => { e.preventDefault(); dropZone.classList.add('dragging'); });
dropZone.addEventListener('dragleave', e => { if (!dropZone.contains(e.relatedTarget)) dropZone.classList.remove('dragging'); });
dropZone.addEventListener('drop', e => {
  e.preventDefault(); dropZone.classList.remove('dragging');
  addFiles(e.dataTransfer.files);
});

clearAllBtn.addEventListener('click',  clearAll);
mergeBtn.addEventListener('click',     mergePdfs);
mergeAgainBtn.addEventListener('click',clearAll);
downloadBtn.addEventListener('click',  doDownload);
pfRange.addEventListener('input',      syncPerFile);
pfRotation.addEventListener('change',  syncPerFile);

// ── ADD FILES ────────────────────────────────────────────────────
async function addFiles(raw) {
  const pdfs = Array.from(raw).filter(f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
  if (!pdfs.length) { toast('Please select valid PDF files only.'); return; }
  for (const f of pdfs) {
    const pages = await getPageCount(f);
    files.push({ id: uid(), file: f, name: f.name, size: f.size, pages, range: '', rotation: '0' });
  }
  render();
}

// ── RENDER ───────────────────────────────────────────────────────
function render() {
  const has = files.length > 0;

  dropZone.style.display   = has ? 'none' : 'flex';
  fileListEl.style.display = has ? 'flex' : 'none';

  fileCount.textContent   = has ? `${files.length} file${files.length !== 1 ? 's' : ''}` : '0 files';
  mergeBtn.disabled       = files.length < 2;
  mergeStatus.textContent = files.length < 2
    ? (files.length === 1 ? 'Need 1 more PDF' : 'No files added')
    : `${files.length} files ready`;

  const totalSize  = files.reduce((s, f) => s + f.size, 0);
  const totalPages = files.reduce((s, f) => s + (typeof f.pages === 'number' ? f.pages : 0), 0);
  totalInfo.textContent = has ? `${fmtBytes(totalSize)} · ~${totalPages}pp` : '';

  statusMsg.textContent = has
    ? `${files.length} file(s) loaded — Arrange order then click Merge PDFs`
    : 'Ready — Add PDF files to begin';

  // Build file list
  fileListEl.innerHTML = '';
  files.forEach((f, i) => {
    const el = document.createElement('div');
    el.className = 'file-item' + (f.id === selectedFileId ? ' selected' : '');
    el.dataset.index = i;
    el.draggable = true;
    el.title = `${f.name} — Click to configure page range and rotation`;

    const rb = f.range ? `<span class="fi-badge fi-badge-blue">p:${f.range}</span>` : '';
    const rotb = f.rotation !== '0' ? `<span class="fi-badge fi-badge-gray">${f.rotation}°</span>` : '';

    el.innerHTML = `
      <span class="fi-drag" title="Drag to reorder">⠿</span>
      <span class="fi-num">${i + 1}</span>
      <span class="fi-icon">📄</span>
      <div class="fi-info">
        <div class="fi-name">${esc(f.name)}</div>
        <div class="fi-meta">${fmtBytes(f.size)} · ${f.pages}pp ${rb}${rotb}</div>
      </div>
      <div class="fi-actions">
        <button class="fi-btn" title="Move up in merge order" onclick="move(${i},-1)">↑</button>
        <button class="fi-btn" title="Move down in merge order" onclick="move(${i},+1)">↓</button>
        <button class="fi-btn del" title="Remove this file" onclick="remove(${i})">✕</button>
      </div>
    `;

    el.addEventListener('click', e => {
      if (e.target.closest('.fi-btn')) return;
      selectedFileId = selectedFileId === f.id ? null : f.id;
      renderPerFile();
      render();
    });

    el.addEventListener('dragstart', () => { dragSrcIndex = i; setTimeout(() => el.classList.add('dragging-item'), 0); });
    el.addEventListener('dragend',   () => { el.classList.remove('dragging-item'); document.querySelectorAll('.file-item').forEach(x => x.classList.remove('drag-over')); });
    el.addEventListener('dragover',  e2 => { e2.preventDefault(); document.querySelectorAll('.file-item').forEach(x => x.classList.remove('drag-over')); el.classList.add('drag-over'); });
    el.addEventListener('drop', e2 => {
      e2.preventDefault(); el.classList.remove('drag-over');
      if (dragSrcIndex !== null && dragSrcIndex !== i) {
        const moved = files.splice(dragSrcIndex, 1)[0];
        files.splice(i, 0, moved);
        dragSrcIndex = null;
        render(); renderMergePreview();
      }
    });
    fileListEl.appendChild(el);
  });

  showCenter(has ? 'preview' : 'empty');
  if (has) renderMergePreview();
}

function renderMergePreview() {
  mpFlow.innerHTML = '';
  files.forEach((f, i) => {
    const item = document.createElement('div');
    item.className = 'mp-item';
    const details = [
      f.range ? `Pages: ${f.range}` : `All ${f.pages} pages`,
      f.rotation !== '0' ? `Rotated ${f.rotation}°` : ''
    ].filter(Boolean).join(' · ');
    item.innerHTML = `
      <span class="mp-num">${i + 1}</span>
      <span class="mp-icon">📄</span>
      <div class="mp-info">
        <div class="mp-name">${esc(f.name)}</div>
        <div class="mp-detail">${fmtBytes(f.size)} · ${details}</div>
      </div>
    `;
    mpFlow.appendChild(item);
    if (i < files.length - 1) {
      const a = document.createElement('div');
      a.className = 'mp-arrow'; a.textContent = '↓';
      mpFlow.appendChild(a);
    }
  });
}

function renderPerFile() {
  const f = files.find(x => x.id === selectedFileId);
  perFileSection.style.display = f ? 'block' : 'none';
  if (!f) return;
  perFileName.textContent = `Configuring: ${f.name}`;
  pfRange.value    = f.range;
  pfRotation.value = f.rotation;
}

function syncPerFile() {
  const f = files.find(x => x.id === selectedFileId);
  if (!f) return;
  f.range    = pfRange.value;
  f.rotation = pfRotation.value;
  render(); renderMergePreview();
}

function showCenter(state) {
  emptyState.style.display    = state === 'empty'    ? 'block' : 'none';
  mergePreview.style.display  = state === 'preview'  ? 'block' : 'none';
  progressPanel.style.display = state === 'progress' ? 'block' : 'none';
  successPanel.style.display  = state === 'success'  ? 'block' : 'none';
}

function move(i, dir) {
  const n = i + dir;
  if (n < 0 || n >= files.length) return;
  [files[i], files[n]] = [files[n], files[i]];
  render();
}

function remove(i) {
  if (selectedFileId === files[i].id) { selectedFileId = null; perFileSection.style.display = 'none'; }
  files.splice(i, 1);
  if (!files.length) { clearAll(); return; }
  render();
}

function clearAll() {
  files = []; mergedPdfBytes = null; selectedFileId = null;
  fileInput.value = ''; addMoreInput.value = '';
  perFileSection.style.display = 'none';
  mergeBtn.disabled = true;
  render();
}

// ── PAGE RANGE PARSER ────────────────────────────────────────────
function parseRange(str, max) {
  if (!str.trim()) return Array.from({ length: max }, (_, i) => i);
  const set = new Set();
  str.split(',').forEach(p => {
    const t = p.trim();
    const m = t.match(/^(\d+)\s*-\s*(\d+)$/);
    if (m) { for (let i = +m[1]; i <= Math.min(+m[2], max); i++) set.add(i - 1); }
    else { const n = parseInt(t); if (!isNaN(n) && n >= 1 && n <= max) set.add(n - 1); }
  });
  return [...set].sort((a, b) => a - b);
}

// ── MERGE ────────────────────────────────────────────────────────
async function mergePdfs() {
  if (files.length < 2) return;
  mergeBtn.disabled = true;
  showCenter('progress');

  const pageOrder = document.querySelector('input[name="pageOrder"]:checked').value;
  const addBlank  = $('optBlankPage').checked;
  const padOdd    = $('optOddPad').checked;
  const openAfter = $('optOpenAfter').checked;
  const sizeOvr   = $('pageSizeOverride').value;

  try {
    const out = await PDFLib.PDFDocument.create();

    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      ppBarFill.style.width = Math.round(10 + (i / files.length) * 82) + '%';
      ppLabel.textContent   = `Processing ${i + 1} of ${files.length}: ${f.name}`;

      const bytes = await readBuf(f.file);
      let src;
      try { src = await PDFLib.PDFDocument.load(bytes, { ignoreEncryption: true }); }
      catch { toast(`Skipped "${f.name}" — may be password protected.`); continue; }

      let indices = parseRange(f.range, src.getPageCount());
      if (pageOrder === 'reverse') indices = [...indices].reverse();

      const copied = await out.copyPages(src, indices);
      const rot    = parseInt(f.rotation) || 0;

      copied.forEach(page => {
        if (rot) page.setRotation(PDFLib.degrees((page.getRotation().angle + rot) % 360));
        if (sizeOvr === 'A4')     page.setSize(PDFLib.PageSizes.A4[0], PDFLib.PageSizes.A4[1]);
        if (sizeOvr === 'Letter') page.setSize(PDFLib.PageSizes.Letter[0], PDFLib.PageSizes.Letter[1]);
        out.addPage(page);
      });

      if (padOdd && out.getPageCount() % 2 !== 0) {
        const bp = out.addPage(); const lp = copied[copied.length - 1];
        if (lp) bp.setSize(lp.getWidth(), lp.getHeight());
      }
      if (addBlank && i < files.length - 1) {
        const bp = out.addPage(); const lp = copied[copied.length - 1];
        if (lp) bp.setSize(lp.getWidth(), lp.getHeight());
      }
      await delay(40);
    }

    ppBarFill.style.width = '98%'; ppLabel.textContent = 'Finalising...';
    await delay(100);
    mergedPdfBytes = await out.save();
    ppBarFill.style.width = '100%';
    await delay(200);

    spInfo.textContent = `${files.length} files merged · ${out.getPageCount()} total pages · ${fmtBytes(mergedPdfBytes.byteLength)}`;
    statusMsg.textContent = `✅ Done — ${out.getPageCount()} pages · ${fmtBytes(mergedPdfBytes.byteLength)}`;
    showCenter('success');

    // Switch mobile tab to output
    if (window.innerWidth <= 900) {
      document.querySelectorAll('.mtab').forEach(b => b.classList.remove('active'));
      document.querySelector('[data-tab="output"]').classList.add('active');
      document.querySelectorAll('[data-tab-content]').forEach(p => p.classList.toggle('mobile-active', p.dataset.tabContent === 'output'));
    }

    if (openAfter) window.open(URL.createObjectURL(new Blob([mergedPdfBytes], { type: 'application/pdf' })), '_blank');

  } catch (err) {
    console.error(err);
    toast('Something went wrong. Please try again.');
    mergeBtn.disabled = false;
    showCenter('preview');
  }
}

function doDownload() {
  if (!mergedPdfBytes) return;
  const name = (outputName.value.trim() || 'merged') + '.pdf';
  Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(new Blob([mergedPdfBytes], { type: 'application/pdf' })),
    download: name
  }).click();
}

// ── UTILS ────────────────────────────────────────────────────────
async function getPageCount(file) {
  try { return (await PDFLib.PDFDocument.load(await readBuf(file), { ignoreEncryption: true })).getPageCount(); }
  catch { return '?'; }
}
function readBuf(file) {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = e => res(e.target.result); r.onerror = rej; r.readAsArrayBuffer(file); });
}
function fmtBytes(b) {
  if (b < 1024) return b + ' B'; if (b < 1048576) return (b/1024).toFixed(1) + ' KB'; return (b/1048576).toFixed(2) + ' MB';
}
function uid()    { return Math.random().toString(36).slice(2); }
function esc(s)   { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function delay(ms){ return new Promise(r => setTimeout(r, ms)); }

let toastT;
function toast(msg) {
  let t = document.getElementById('tz-toast');
  if (!t) {
    t = document.createElement('div'); t.id = 'tz-toast';
    t.style.cssText = "position:fixed;bottom:34px;left:50%;transform:translateX(-50%) translateY(60px);background:#1e1e1e;border:1px solid #e05c5c;color:#e0e0e0;padding:9px 20px;border-radius:4px;font-size:12px;font-weight:500;z-index:999;transition:transform 0.25s ease;white-space:nowrap;box-shadow:0 4px 20px rgba(0,0,0,.6);font-family:'Inter',sans-serif;max-width:90vw;text-align:center;";
    document.body.appendChild(t);
  }
  t.textContent = msg; t.style.transform = 'translateX(-50%) translateY(0)';
  clearTimeout(toastT); toastT = setTimeout(() => { t.style.transform = 'translateX(-50%) translateY(60px)'; }, 3500);
}

render();