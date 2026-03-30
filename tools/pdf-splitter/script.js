// ── PDF SPLITTER script.js ───────────────────────────────────────

let pdfFile = null;
let pdfDoc  = null;
let totalPages = 0;
let selectedPages = new Set();
let splitBlobs = [];

const $ = id => document.getElementById(id);

// DOM
const dropZone    = $('dropZone');
const fileInput   = $('fileInput');
const fileLoaded  = $('fileLoaded');
const flName      = $('flName');
const flMeta      = $('flMeta');
const removeFile  = $('removeFile');
const fileInfo    = $('fileInfo');
const pageGrid    = $('pageGrid');
const splitBtn    = $('splitBtn');
const clearBtn    = $('clearBtn');
const statusMsg   = $('statusMsg');
const emptyState  = $('emptyState');
const splitResult = $('splitResult');
const srList      = $('srList');
const srActions   = $('srActions');
const progressPanel=$('progressPanel');
const ppBarFill   = $('ppBarFill');
const ppLabel     = $('ppLabel');
const downloadAllBtn=$('downloadAllBtn');
const rangeSection=$('rangeSection');
const everyNSection=$('everyNSection');
const selectedSection=$('selectedSection');
const selectedCount=$('selectedCount');
const namePrefix  = $('namePrefix');
const namePreview = $('namePreview');
const splitPreviewCount=$('splitPreviewCount');

// ── MOBILE TABS ──────────────────────────────────────────────────
document.querySelectorAll('.mtab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.mtab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('[data-tab-content]').forEach(p =>
      p.classList.toggle('mobile-active', p.dataset.tabContent === btn.dataset.tab));
  });
});
if (window.innerWidth <= 900)
  document.querySelector('[data-tab-content="upload"]').classList.add('mobile-active');

// ── FILE INPUT ───────────────────────────────────────────────────
fileInput.addEventListener('change', e => loadFile(e.target.files[0]));
dropZone.addEventListener('click', e => {
  if (e.target.closest('label') || e.target.tagName === 'INPUT') return;
  fileInput.click();
});
dropZone.addEventListener('dragover',  e => { e.preventDefault(); dropZone.classList.add('dragging'); });
dropZone.addEventListener('dragleave', e => { if (!dropZone.contains(e.relatedTarget)) dropZone.classList.remove('dragging'); });
dropZone.addEventListener('drop', e => {
  e.preventDefault(); dropZone.classList.remove('dragging');
  const f = e.dataTransfer.files[0];
  if (f) loadFile(f);
});

removeFile.addEventListener('click', clearAll);
clearBtn.addEventListener('click', clearAll);
splitBtn.addEventListener('click', doSplit);
downloadAllBtn.addEventListener('click', downloadZip);
namePrefix.addEventListener('input', updateNamePreview);

// ── METHOD RADIO ─────────────────────────────────────────────────
document.querySelectorAll('input[name="splitMethod"]').forEach(r => {
  r.addEventListener('change', () => {
    rangeSection.style.display    = r.value === 'range'    ? 'block' : 'none';
    everyNSection.style.display   = r.value === 'every_n'  ? 'block' : 'none';
    selectedSection.style.display = r.value === 'selected' ? 'block' : 'none';
  });
});

// ── LOAD FILE ────────────────────────────────────────────────────
async function loadFile(file) {
  if (!file || (!file.type.includes('pdf') && !file.name.toLowerCase().endsWith('.pdf'))) {
    toast('Please select a valid PDF file.'); return;
  }
  pdfFile = file;
  try {
    const buf = await readBuf(file);
    pdfDoc = await PDFLib.PDFDocument.load(buf, { ignoreEncryption: true });
    totalPages = pdfDoc.getPageCount();

    flName.textContent = file.name;
    flMeta.textContent = `${fmtBytes(file.size)} · ${totalPages} pages`;
    fileInfo.textContent = `${totalPages} pages`;
    dropZone.style.display  = 'none';
    fileLoaded.style.display = 'block';
    splitBtn.disabled = false;
    statusMsg.textContent = `${file.name} loaded — Choose split method in Options then click Split PDF`;

    buildPageGrid();
    showCenter('empty');
    updateNamePreview();
  } catch(e) {
    toast('Could not read PDF — it may be corrupted or password-protected.');
    clearAll();
  }
}

// ── PAGE GRID ────────────────────────────────────────────────────
function buildPageGrid() {
  pageGrid.innerHTML = '';
  selectedPages.clear();
  for (let i = 1; i <= totalPages; i++) {
    const el = document.createElement('div');
    el.className = 'pg-item';
    el.dataset.page = i;
    el.title = `Page ${i} — Click to select/deselect for "Selected Pages" mode`;
    el.innerHTML = `<span class="pg-num">${i}</span><span class="pg-label">pg</span>`;
    el.addEventListener('click', () => togglePage(i, el));
    pageGrid.appendChild(el);
  }
}

function togglePage(n, el) {
  if (selectedPages.has(n)) { selectedPages.delete(n); el.classList.remove('selected'); }
  else { selectedPages.add(n); el.classList.add('selected'); }
  selectedCount.textContent = `${selectedPages.size} page${selectedPages.size !== 1 ? 's' : ''} selected`;
}

// ── NAME PREVIEW ─────────────────────────────────────────────────
function updateNamePreview() {
  const p = namePrefix.value.trim() || 'split';
  namePreview.textContent = `${p}_1.pdf, ${p}_2.pdf…`;
}

// ── SPLIT ────────────────────────────────────────────────────────
async function doSplit() {
  if (!pdfDoc) return;
  const method = document.querySelector('input[name="splitMethod"]:checked').value;
  const prefix = namePrefix.value.trim() || 'split';

  // Build page groups
  let groups = [];
  if (method === 'every') {
    for (let i = 0; i < totalPages; i++) groups.push({ label: `${prefix}_${i+1}`, pages: [i] });
  } else if (method === 'every_n') {
    const n = Math.max(1, parseInt($('nInput').value) || 2);
    let idx = 1;
    for (let i = 0; i < totalPages; i += n) {
      const chunk = [];
      for (let j = i; j < Math.min(i + n, totalPages); j++) chunk.push(j);
      groups.push({ label: `${prefix}_${idx++}`, pages: chunk });
    }
  } else if (method === 'range') {
    const lines = $('rangeInput').value.split('\n').map(l => l.trim()).filter(Boolean);
    if (!lines.length) { toast('Please enter at least one page range.'); return; }
    lines.forEach((line, idx) => {
      const pages = parseRange(line, totalPages);
      if (pages.length) groups.push({ label: `${prefix}_${idx + 1}`, pages });
    });
    if (!groups.length) { toast('No valid page ranges found. Example: 1-3'); return; }
  } else if (method === 'selected') {
    if (!selectedPages.size) { toast('No pages selected. Click pages in the grid on the left.'); return; }
    groups.push({ label: `${prefix}_selected`, pages: [...selectedPages].sort((a,b)=>a-b).map(p => p - 1) });
  }

  if (!groups.length) { toast('Nothing to split.'); return; }

  splitBtn.disabled = true;
  showCenter('progress');
  splitBlobs = [];

  try {
    for (let i = 0; i < groups.length; i++) {
      const g = groups[i];
      ppBarFill.style.width = Math.round(10 + (i / groups.length) * 85) + '%';
      ppLabel.textContent   = `Creating ${g.label}.pdf (${i+1}/${groups.length})...`;

      const newPdf = await PDFLib.PDFDocument.create();
      const copied = await newPdf.copyPages(pdfDoc, g.pages);
      copied.forEach(p => newPdf.addPage(p));
      const bytes = await newPdf.save();
      splitBlobs.push({ name: g.label + '.pdf', bytes, pages: g.pages.length, size: bytes.byteLength });
      await delay(30);
    }

    ppBarFill.style.width = '100%'; ppLabel.textContent = 'Done!';
    await delay(200);

    showCenter('result');
    renderResult(splitBlobs, prefix);
    splitPreviewCount.textContent = `${splitBlobs.length} output file${splitBlobs.length !== 1 ? 's' : ''}`;
    statusMsg.textContent = `✅ Split into ${splitBlobs.length} file${splitBlobs.length !== 1 ? 's' : ''}`;

    // Mobile: jump to output tab
    if (window.innerWidth <= 900) {
      document.querySelectorAll('.mtab').forEach(b => b.classList.remove('active'));
      document.querySelector('[data-tab="output"]').classList.add('active');
      document.querySelectorAll('[data-tab-content]').forEach(p =>
        p.classList.toggle('mobile-active', p.dataset.tabContent === 'output'));
    }
  } catch(err) {
    console.error(err); toast('Something went wrong. Please try again.');
    showCenter('empty');
  }
  splitBtn.disabled = false;
}

function renderResult(blobs, prefix) {
  srList.innerHTML = '';
  blobs.forEach((b, i) => {
    const el = document.createElement('div');
    el.className = 'sr-item';
    el.innerHTML = `
      <span class="sr-num">${i+1}</span>
      <span class="sr-icon">📄</span>
      <div class="sr-info">
        <div class="sr-name">${esc(b.name)}</div>
        <div class="sr-detail">${b.pages} page${b.pages!==1?'s':''} · ${fmtBytes(b.size)}</div>
      </div>
      <button class="sr-dl" title="Download this file" onclick="dlOne(${i})">💾 Download</button>
    `;
    srList.appendChild(el);
  });
  srActions.style.display = blobs.length > 1 ? 'flex' : 'none';
}

function dlOne(i) {
  const b = splitBlobs[i];
  if (!b) return;
  Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(new Blob([b.bytes], { type: 'application/pdf' })),
    download: b.name
  }).click();
}

async function downloadZip() {
  if (!splitBlobs.length) return;
  downloadAllBtn.textContent = '⏳ Zipping...'; downloadAllBtn.disabled = true;
  const zip = new JSZip();
  splitBlobs.forEach(b => zip.file(b.name, b.bytes));
  const blob = await zip.generateAsync({ type: 'blob' });
  Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'split_pdfs.zip' }).click();
  downloadAllBtn.textContent = '📦 Download All as ZIP'; downloadAllBtn.disabled = false;
}

function clearAll() {
  pdfFile = null; pdfDoc = null; totalPages = 0;
  selectedPages.clear(); splitBlobs = [];
  fileInput.value = '';
  dropZone.style.display   = 'flex';
  fileLoaded.style.display = 'none';
  splitBtn.disabled = true;
  fileInfo.textContent = 'No file loaded';
  statusMsg.textContent = 'Ready — Upload a PDF to begin';
  showCenter('empty');
  splitPreviewCount.textContent = 'Nothing to preview';
}

function showCenter(state) {
  emptyState.style.display    = state === 'empty'    ? 'block' : 'none';
  splitResult.style.display   = state === 'result'   ? 'block' : 'none';
  progressPanel.style.display = state === 'progress' ? 'block' : 'none';
}

// ── PAGE RANGE PARSER ────────────────────────────────────────────
function parseRange(str, max) {
  const set = new Set();
  str.split(',').forEach(p => {
    const t = p.trim();
    const m = t.match(/^(\d+)\s*-\s*(\d+)$/);
    if (m) { for (let i = +m[1]; i <= Math.min(+m[2], max); i++) set.add(i - 1); }
    else { const n = parseInt(t); if (!isNaN(n) && n >= 1 && n <= max) set.add(n - 1); }
  });
  return [...set].sort((a,b) => a - b);
}

// ── UTILS ────────────────────────────────────────────────────────
function readBuf(file) {
  return new Promise((res,rej) => { const r = new FileReader(); r.onload = e => res(e.target.result); r.onerror = rej; r.readAsArrayBuffer(file); });
}
function fmtBytes(b) { if(b<1024)return b+' B'; if(b<1048576)return(b/1024).toFixed(1)+' KB'; return(b/1048576).toFixed(2)+' MB'; }
function uid()    { return Math.random().toString(36).slice(2); }
function esc(s)   { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function delay(ms){ return new Promise(r=>setTimeout(r,ms)); }

let toastT;
function toast(msg) {
  let t = document.getElementById('tz-toast');
  if (!t) { t = document.createElement('div'); t.id='tz-toast'; t.style.cssText="position:fixed;bottom:34px;left:50%;transform:translateX(-50%) translateY(60px);background:#1e1e1e;border:1px solid #fc5c7d;color:#e0e0e0;padding:9px 20px;border-radius:4px;font-size:12px;font-weight:500;z-index:999;transition:transform 0.25s ease;white-space:nowrap;box-shadow:0 4px 20px rgba(0,0,0,.6);font-family:'Inter',sans-serif;max-width:90vw;text-align:center;"; document.body.appendChild(t); }
  t.textContent=msg; t.style.transform='translateX(-50%) translateY(0)';
  clearTimeout(toastT); toastT=setTimeout(()=>{ t.style.transform='translateX(-50%) translateY(60px)'; },3500);
}