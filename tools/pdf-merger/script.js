// ── PDF MERGER script.js ─────────────────────────────────────────

let files = [];
let mergedPdfBytes = null;
let dragSrcIndex = null;
let selectedFileId = null;

// DOM
const dropZone     = document.getElementById('dropZone');
const fileInput    = document.getElementById('fileInput');
const addMoreInput = document.getElementById('addMoreInput');
const fileListEl   = document.getElementById('fileList');
const mergeBtn     = document.getElementById('mergeBtn');
const clearAllBtn  = document.getElementById('clearAllBtn');
const downloadBtn  = document.getElementById('downloadBtn');
const mergeAgainBtn= document.getElementById('mergeAgainBtn');
const outputName   = document.getElementById('outputName');
const fileCount    = document.getElementById('fileCount');
const totalInfo    = document.getElementById('totalInfo');
const mergeStatus  = document.getElementById('mergeStatus');
const statusMsg    = document.getElementById('statusMsg');
const emptyState   = document.getElementById('emptyState');
const mergePreview = document.getElementById('mergePreview');
const progressPanel= document.getElementById('progressPanel');
const successPanel = document.getElementById('successPanel');
const mpFlow       = document.getElementById('mpFlow');
const ppBarFill    = document.getElementById('ppBarFill');
const ppTitle      = document.getElementById('ppTitle');
const ppLabel      = document.getElementById('ppLabel');
const spInfo       = document.getElementById('spInfo');
const perFileEditor= document.getElementById('perFileEditor');
const pfRange      = document.getElementById('pfRange');
const pfRotation   = document.getElementById('pfRotation');

// ── FILE INPUT ───────────────────────────────────────────────────
fileInput.addEventListener('change',    e => addFiles(e.target.files));
addMoreInput.addEventListener('change', e => addFiles(e.target.files));

// FIX: prevent double dialog — ignore clicks from label/input elements
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

clearAllBtn.addEventListener('click', clearAll);
mergeBtn.addEventListener('click', mergePdfs);
mergeAgainBtn.addEventListener('click', clearAll);
downloadBtn.addEventListener('click', doDownload);

// Per-file options sync
pfRange.addEventListener('input',    () => updateSelectedFile());
pfRotation.addEventListener('change',() => updateSelectedFile());

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
  const hasFiles = files.length > 0;

  // Toggle drop zone / file list
  dropZone.style.display  = hasFiles ? 'none' : 'flex';
  fileListEl.style.display = hasFiles ? 'flex' : 'none';

  // File count
  fileCount.textContent = hasFiles ? `${files.length} file${files.length !== 1 ? 's' : ''}` : '0 files';

  // Total info
  const totalSize  = files.reduce((s, f) => s + f.size, 0);
  const totalPages = files.reduce((s, f) => s + (typeof f.pages === 'number' ? f.pages : 0), 0);
  totalInfo.textContent = hasFiles ? `${fmtBytes(totalSize)} · ~${totalPages}pp` : '';

  // Merge button
  mergeBtn.disabled = files.length < 2;
  mergeStatus.textContent = files.length < 2
    ? (files.length === 1 ? 'Add 1 more PDF' : 'No files added')
    : `${files.length} files ready to merge`;

  // Status bar
  statusMsg.textContent = hasFiles
    ? `${files.length} file${files.length !== 1 ? 's' : ''} loaded — Arrange order, set options, then click Merge PDFs`
    : 'Ready — Add PDF files to begin';

  // Build file list
  fileListEl.innerHTML = '';
  files.forEach((f, i) => {
    const item = document.createElement('div');
    item.className = 'file-item' + (f.id === selectedFileId ? ' selected' : '');
    item.dataset.index = i;
    item.draggable = true;
    item.title = f.name;

    const rangeBadge = f.range ? `<span class="fi-range-badge">p:${f.range}</span>` : '';
    const rotBadge   = f.rotation !== '0' ? `<span class="fi-rot-badge">${f.rotation}°</span>` : '';

    item.innerHTML = `
      <span class="fi-drag">⠿</span>
      <span class="fi-num">${i + 1}</span>
      <span class="fi-icon">📄</span>
      <div class="fi-info">
        <div class="fi-name">${esc(f.name)}</div>
        <div class="fi-meta">${fmtBytes(f.size)} · ${f.pages}pp ${rangeBadge}${rotBadge}</div>
      </div>
      <div class="fi-actions">
        <button class="fi-btn" title="Move up"   onclick="move(${i},-1)">↑</button>
        <button class="fi-btn" title="Move down" onclick="move(${i},+1)">↓</button>
        <button class="fi-btn del" title="Remove" onclick="remove(${i})">✕</button>
      </div>
    `;

    // Select file to edit per-file options
    item.addEventListener('click', e => {
      if (e.target.closest('.fi-btn')) return;
      selectedFileId = (selectedFileId === f.id) ? null : f.id;
      renderPerFileEditor();
      render();
    });

    // Drag reorder
    item.addEventListener('dragstart', () => { dragSrcIndex = i; setTimeout(() => item.classList.add('dragging-item'), 0); });
    item.addEventListener('dragend',   () => { item.classList.remove('dragging-item'); document.querySelectorAll('.file-item').forEach(x => x.classList.remove('drag-over')); });
    item.addEventListener('dragover',  e => { e.preventDefault(); document.querySelectorAll('.file-item').forEach(x => x.classList.remove('drag-over')); item.classList.add('drag-over'); });
    item.addEventListener('drop', e => {
      e.preventDefault(); item.classList.remove('drag-over');
      if (dragSrcIndex !== null && dragSrcIndex !== i) {
        const moved = files.splice(dragSrcIndex, 1)[0];
        files.splice(i, 0, moved);
        dragSrcIndex = null;
        render(); renderMergePreview();
      }
    });

    fileListEl.appendChild(item);
  });

  // Center panel
  showCenter(hasFiles ? 'preview' : 'empty');
  if (hasFiles) renderMergePreview();
}

function renderMergePreview() {
  mpFlow.innerHTML = '';
  files.forEach((f, i) => {
    const item = document.createElement('div');
    item.className = 'mp-item';
    const details = [
      f.range ? `Pages: ${f.range}` : `All ${f.pages} pages`,
      f.rotation !== '0' ? `Rotate ${f.rotation}°` : ''
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
      const arrow = document.createElement('div');
      arrow.className = 'mp-arrow'; arrow.textContent = '↓';
      mpFlow.appendChild(arrow);
    }
  });
}

function renderPerFileEditor() {
  const f = files.find(x => x.id === selectedFileId);
  if (!f) { perFileEditor.style.display = 'none'; return; }
  perFileEditor.style.display = 'block';
  pfRange.value    = f.range;
  pfRotation.value = f.rotation;
}

function updateSelectedFile() {
  const f = files.find(x => x.id === selectedFileId);
  if (!f) return;
  f.range    = pfRange.value;
  f.rotation = pfRotation.value;
  render();
  renderMergePreview();
}

function showCenter(state) {
  emptyState.style.display   = state === 'empty'    ? 'block' : 'none';
  mergePreview.style.display = state === 'preview'  ? 'block' : 'none';
  progressPanel.style.display= state === 'progress' ? 'block' : 'none';
  successPanel.style.display = state === 'success'  ? 'block' : 'none';
}

// ── MOVE / REMOVE ────────────────────────────────────────────────
function move(index, dir) {
  const n = index + dir;
  if (n < 0 || n >= files.length) return;
  [files[index], files[n]] = [files[n], files[index]];
  render();
}

function remove(index) {
  if (selectedFileId === files[index].id) { selectedFileId = null; perFileEditor.style.display = 'none'; }
  files.splice(index, 1);
  if (!files.length) { clearAll(); return; }
  render();
}

function clearAll() {
  files = []; mergedPdfBytes = null; selectedFileId = null;
  fileInput.value = ''; addMoreInput.value = '';
  perFileEditor.style.display = 'none';
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
  ppTitle.textContent = 'Merging files...';

  const pageOrder = document.querySelector('input[name="pageOrder"]:checked').value;
  const addBlank  = document.getElementById('optBlankPage').checked;
  const padOdd    = document.getElementById('optOddPad').checked;
  const openAfter = document.getElementById('optOpenAfter').checked;
  const sizeOvr   = document.getElementById('pageSizeOverride').value;

  try {
    const out = await PDFLib.PDFDocument.create();

    for (let i = 0; i < files.length; i++) {
      const f   = files[i];
      const pct = Math.round(10 + (i / files.length) * 82);
      ppBarFill.style.width = pct + '%';
      ppLabel.textContent   = `Processing ${i + 1} of ${files.length}: ${f.name}`;

      const bytes = await readBuf(f.file);
      let src;
      try { src = await PDFLib.PDFDocument.load(bytes, { ignoreEncryption: true }); }
      catch { toast(`Skipped "${f.name}" — may be protected or corrupted.`); continue; }

      let indices = parseRange(f.range, src.getPageCount());
      if (pageOrder === 'reverse') indices = [...indices].reverse();

      const copied = await out.copyPages(src, indices);
      const rot = parseInt(f.rotation) || 0;

      copied.forEach(page => {
        if (rot) page.setRotation(PDFLib.degrees((page.getRotation().angle + rot) % 360));
        if (sizeOvr === 'A4')     page.setSize(PDFLib.PageSizes.A4[0], PDFLib.PageSizes.A4[1]);
        if (sizeOvr === 'Letter') page.setSize(PDFLib.PageSizes.Letter[0], PDFLib.PageSizes.Letter[1]);
        out.addPage(page);
      });

      if (padOdd && out.getPageCount() % 2 !== 0) {
        const bp = out.addPage();
        const lp = copied[copied.length - 1];
        if (lp) bp.setSize(lp.getWidth(), lp.getHeight());
      }
      if (addBlank && i < files.length - 1) {
        const bp = out.addPage();
        const lp = copied[copied.length - 1];
        if (lp) bp.setSize(lp.getWidth(), lp.getHeight());
      }

      await delay(40);
    }

    ppBarFill.style.width = '98%';
    ppLabel.textContent   = 'Finalising...';
    await delay(100);

    mergedPdfBytes = await out.save();
    ppBarFill.style.width = '100%';
    await delay(200);

    spInfo.textContent = `${files.length} files merged · ${out.getPageCount()} pages · ${fmtBytes(mergedPdfBytes.byteLength)}`;
    statusMsg.textContent = `✅ Done — ${out.getPageCount()} pages · ${fmtBytes(mergedPdfBytes.byteLength)} — Ready to download`;
    showCenter('success');

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
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(new Blob([mergedPdfBytes], { type: 'application/pdf' })),
    download: name
  });
  a.click();
}

// ── UTILS ────────────────────────────────────────────────────────
async function getPageCount(file) {
  try {
    const pdf = await PDFLib.PDFDocument.load(await readBuf(file), { ignoreEncryption: true });
    return pdf.getPageCount();
  } catch { return '?'; }
}

function readBuf(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = e => res(e.target.result); r.onerror = rej;
    r.readAsArrayBuffer(file);
  });
}

function fmtBytes(b) {
  if (b < 1024) return b + ' B';
  if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
  return (b / 1048576).toFixed(2) + ' MB';
}

function uid()    { return Math.random().toString(36).slice(2); }
function esc(s)   { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function delay(ms){ return new Promise(r => setTimeout(r, ms)); }

let toastT;
function toast(msg) {
  let t = document.getElementById('tz-toast');
  if (!t) {
    t = document.createElement('div'); t.id = 'tz-toast';
    t.style.cssText = "position:fixed;bottom:34px;left:50%;transform:translateX(-50%) translateY(60px);background:#1e1e1e;border:1px solid #e05c5c;color:#e0e0e0;padding:9px 20px;border-radius:4px;font-size:12px;font-weight:500;z-index:999;transition:transform 0.25s ease;white-space:nowrap;box-shadow:0 4px 20px rgba(0,0,0,0.6);font-family:'Inter',sans-serif;";
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.transform = 'translateX(-50%) translateY(0)';
  clearTimeout(toastT);
  toastT = setTimeout(() => { t.style.transform = 'translateX(-50%) translateY(60px)'; }, 3500);
}

// Init
render();