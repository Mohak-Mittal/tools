// ─── PDF MERGER — script.js ──────────────────────────────────────────────────
// Uses: pdf-lib (loaded via CDN in index.html)
// Features: drag & drop upload, reorder, delete, merge, download

// ─── STATE ──────────────────────────────────────────────────────────────────
let files = []; // Array of { id, file, name, size, pages }
let mergedPdfBytes = null;
let dragSrcIndex = null;

// ─── DOM REFS ────────────────────────────────────────────────────────────────
const dropZone      = document.getElementById('dropZone');
const fileInput     = document.getElementById('fileInput');
const addMoreInput  = document.getElementById('addMoreInput');
const fileListCard  = document.getElementById('fileListCard');
const mergeCard     = document.getElementById('mergeCard');
const downloadCard  = document.getElementById('downloadCard');
const fileListEl    = document.getElementById('fileList');
const totalInfo     = document.getElementById('totalInfo');
const clearAllBtn   = document.getElementById('clearAllBtn');
const mergeBtn      = document.getElementById('mergeBtn');
const mergeBtnText  = document.getElementById('mergeBtnText');
const mergeBtnIcon  = document.getElementById('mergeBtnIcon');
const mergeHint     = document.getElementById('mergeHint');
const progressWrap  = document.getElementById('progressWrap');
const progressFill  = document.getElementById('progressFill');
const progressLabel = document.getElementById('progressLabel');
const downloadBtn   = document.getElementById('downloadBtn');
const mergeAgainBtn = document.getElementById('mergeAgainBtn');
const successInfo   = document.getElementById('successInfo');
const outputName    = document.getElementById('outputName');

// ─── FILE INPUT EVENTS ───────────────────────────────────────────────────────
fileInput.addEventListener('change', e => handleFileSelection(e.target.files));
addMoreInput.addEventListener('change', e => handleFileSelection(e.target.files));
clearAllBtn.addEventListener('click', clearAll);

// ─── DROP ZONE EVENTS ────────────────────────────────────────────────────────
dropZone.addEventListener('click', () => fileInput.click());

dropZone.addEventListener('dragover', e => {
  e.preventDefault();
  dropZone.classList.add('dragging');
});

dropZone.addEventListener('dragleave', e => {
  if (!dropZone.contains(e.relatedTarget)) {
    dropZone.classList.remove('dragging');
  }
});

dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('dragging');
  handleFileSelection(e.dataTransfer.files);
});

// ─── HANDLE FILE SELECTION ────────────────────────────────────────────────────
async function handleFileSelection(rawFiles) {
  const pdfs = Array.from(rawFiles).filter(f =>
    f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
  );

  if (pdfs.length === 0) {
    showToast('⚠️ Please select valid PDF files only.');
    return;
  }

  // Get page count for each PDF
  for (const f of pdfs) {
    const id = generateId();
    const pages = await getPdfPageCount(f);
    files.push({ id, file: f, name: f.name, size: f.size, pages });
  }

  renderFileList();
  showCards();
  resetMergeState();
}

// ─── GET PDF PAGE COUNT (using pdf-lib) ──────────────────────────────────────
async function getPdfPageCount(file) {
  try {
    const bytes = await readFileAsArrayBuffer(file);
    const pdf   = await PDFLib.PDFDocument.load(bytes, { ignoreEncryption: true });
    return pdf.getPageCount();
  } catch {
    return '?';
  }
}

// ─── RENDER FILE LIST ────────────────────────────────────────────────────────
function renderFileList() {
  fileListEl.innerHTML = '';

  files.forEach((f, index) => {
    const item = document.createElement('div');
    item.className    = 'file-item';
    item.dataset.index = index;
    item.draggable    = true;

    item.innerHTML = `
      <span class="drag-handle" title="Drag to reorder">⠿</span>
      <span class="file-order-num">${index + 1}</span>
      <span class="file-icon">📄</span>
      <div class="file-info">
        <div class="file-name" title="${escHtml(f.name)}">${escHtml(f.name)}</div>
        <div class="file-meta">${formatBytes(f.size)} · ${f.pages} page${f.pages !== 1 ? 's' : ''}</div>
      </div>
      <div class="file-actions">
        <button class="icon-btn move-up"   title="Move up"   onclick="moveFile(${index}, -1)">↑</button>
        <button class="icon-btn move-down" title="Move down" onclick="moveFile(${index}, +1)">↓</button>
        <button class="icon-btn delete"    title="Remove"    onclick="removeFile(${index})">✕</button>
      </div>
    `;

    // ── Drag-to-reorder events ──
    item.addEventListener('dragstart', () => {
      dragSrcIndex = index;
      setTimeout(() => item.classList.add('dragging-item'), 0);
    });

    item.addEventListener('dragend', () => {
      item.classList.remove('dragging-item');
      document.querySelectorAll('.file-item').forEach(el => el.classList.remove('drag-over'));
    });

    item.addEventListener('dragover', e => {
      e.preventDefault();
      document.querySelectorAll('.file-item').forEach(el => el.classList.remove('drag-over'));
      item.classList.add('drag-over');
    });

    item.addEventListener('drop', e => {
      e.preventDefault();
      item.classList.remove('drag-over');
      if (dragSrcIndex !== null && dragSrcIndex !== index) {
        const moved = files.splice(dragSrcIndex, 1)[0];
        files.splice(index, 0, moved);
        dragSrcIndex = null;
        renderFileList();
        updateTotalInfo();
        resetMergeState();
      }
    });

    fileListEl.appendChild(item);
  });

  updateTotalInfo();
}

// ─── MOVE FILE (arrow buttons) ───────────────────────────────────────────────
function moveFile(index, direction) {
  const newIndex = index + direction;
  if (newIndex < 0 || newIndex >= files.length) return;
  const temp         = files[index];
  files[index]       = files[newIndex];
  files[newIndex]    = temp;
  renderFileList();
  resetMergeState();
}

// ─── REMOVE FILE ─────────────────────────────────────────────────────────────
function removeFile(index) {
  files.splice(index, 1);
  if (files.length === 0) {
    clearAll();
    return;
  }
  renderFileList();
  resetMergeState();
}

// ─── CLEAR ALL ───────────────────────────────────────────────────────────────
function clearAll() {
  files          = [];
  mergedPdfBytes = null;
  fileListCard.style.display  = 'none';
  mergeCard.style.display     = 'none';
  downloadCard.style.display  = 'none';
  fileInput.value             = '';
  addMoreInput.value          = '';
  resetMergeState();
}

// ─── SHOW / HIDE CARDS ───────────────────────────────────────────────────────
function showCards() {
  if (files.length > 0) {
    fileListCard.style.display = 'block';
    mergeCard.style.display    = 'block';
    downloadCard.style.display = 'none';
  }
}

function resetMergeState() {
  mergedPdfBytes = null;
  progressWrap.style.display = 'none';
  setProgress(0, '');
  mergeBtn.disabled  = false;
  mergeBtnText.textContent = 'Merge PDFs';
  mergeBtnIcon.textContent = '🔗';
  updateMergeHint();
  downloadCard.style.display = 'none';
}

function updateMergeHint() {
  if (files.length < 2) {
    mergeHint.textContent = '⚠️ Add at least 2 PDF files to merge.';
    mergeBtn.disabled = true;
  } else {
    mergeHint.textContent = `${files.length} files will be merged in the order shown above.`;
    mergeBtn.disabled = false;
  }
}

function updateTotalInfo() {
  const totalSize  = files.reduce((s, f) => s + f.size, 0);
  const totalPages = files.reduce((s, f) => s + (typeof f.pages === 'number' ? f.pages : 0), 0);
  totalInfo.textContent = `${files.length} file${files.length !== 1 ? 's' : ''} · ${formatBytes(totalSize)} · ~${totalPages} pages`;
  updateMergeHint();
}

// ─── MERGE ───────────────────────────────────────────────────────────────────
mergeBtn.addEventListener('click', mergePdfs);

async function mergePdfs() {
  if (files.length < 2) {
    showToast('⚠️ Please add at least 2 PDF files.');
    return;
  }

  // UI: loading state
  mergeBtn.disabled        = true;
  mergeBtnText.textContent = 'Merging...';
  mergeBtnIcon.textContent = '⏳';
  progressWrap.style.display = 'block';
  downloadCard.style.display = 'none';
  setProgress(5, 'Starting...');

  try {
    const mergedPdf = await PDFLib.PDFDocument.create();
    const pageOrder = document.querySelector('input[name="pageOrder"]:checked').value;

    for (let i = 0; i < files.length; i++) {
      const pct   = Math.round(10 + (i / files.length) * 80);
      setProgress(pct, `Processing file ${i + 1} of ${files.length}: ${files[i].name}`);

      const bytes    = await readFileAsArrayBuffer(files[i].file);
      let srcPdf;
      try {
        srcPdf = await PDFLib.PDFDocument.load(bytes, { ignoreEncryption: true });
      } catch (err) {
        showToast(`⚠️ Could not read "${files[i].name}". It may be password-protected or corrupted.`);
        resetMergeState();
        return;
      }

      let pageIndices = srcPdf.getPageIndices();
      if (pageOrder === 'reverse') pageIndices = [...pageIndices].reverse();

      const copiedPages = await mergedPdf.copyPages(srcPdf, pageIndices);
      copiedPages.forEach(p => mergedPdf.addPage(p));

      // Small delay so progress is visible
      await delay(50);
    }

    setProgress(95, 'Finalising...');
    await delay(100);

    mergedPdfBytes = await mergedPdf.save();
    const totalPages = mergedPdf.getPageCount();

    setProgress(100, 'Done!');
    await delay(300);

    // Show download card
    successInfo.textContent = `${files.length} PDFs merged · ${totalPages} total pages · ${formatBytes(mergedPdfBytes.byteLength)}`;
    downloadCard.style.display = 'block';
    downloadCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  } catch (err) {
    console.error(err);
    showToast('❌ Something went wrong. Please try again.');
    resetMergeState();
  }
}

// ─── DOWNLOAD ────────────────────────────────────────────────────────────────
downloadBtn.addEventListener('click', () => {
  if (!mergedPdfBytes) return;
  const name = (outputName.value.trim() || 'merged') + '.pdf';
  const blob = new Blob([mergedPdfBytes], { type: 'application/pdf' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
});

mergeAgainBtn.addEventListener('click', clearAll);

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = e => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

function setProgress(pct, label) {
  progressFill.style.width    = pct + '%';
  progressLabel.textContent   = label;
}

function formatBytes(bytes) {
  if (bytes < 1024)       return bytes + ' B';
  if (bytes < 1048576)    return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(2) + ' MB';
}

function generateId() {
  return Math.random().toString(36).slice(2);
}

function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ─── TOAST ───────────────────────────────────────────────────────────────────
let toastTimeout;
function showToast(msg) {
  let toast = document.getElementById('tz-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'tz-toast';
    toast.style.cssText = `
      position: fixed; bottom: 28px; left: 50%; transform: translateX(-50%) translateY(80px);
      background: #13131f; border: 1px solid #fc5c7d; color: #eeeeff;
      padding: 12px 24px; border-radius: 100px; font-size: 0.85rem; font-weight: 600;
      z-index: 999; transition: transform 0.3s cubic-bezier(0.16,1,0.3,1);
      white-space: nowrap; box-shadow: 0 8px 32px rgba(0,0,0,0.5);
      font-family: 'Plus Jakarta Sans', sans-serif;
    `;
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.transform = 'translateX(-50%) translateY(0)';
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.style.transform = 'translateX(-50%) translateY(80px)';
  }, 3000);
}