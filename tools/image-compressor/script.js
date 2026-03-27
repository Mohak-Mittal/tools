// ─── IMAGE COMPRESSOR — script.js ────────────────────────────────────────────
// Features: drag & drop, batch compress, quality slider, format convert,
//           resize (aspect-ratio safe), per-image download, ZIP all, live stats

// ─── STATE ───────────────────────────────────────────────────────────────────
let images = [];
let selectedFormat = 'same';

// ─── DOM ─────────────────────────────────────────────────────────────────────
const dropZone       = document.getElementById('dropZone');
const fileInput      = document.getElementById('fileInput');
const addMoreInput   = document.getElementById('addMoreInput');
const settingsCard   = document.getElementById('settingsCard');
const resultsCard    = document.getElementById('resultsCard');
const imageListEl    = document.getElementById('imageList');
const qualitySlider  = document.getElementById('qualitySlider');
const qualityVal     = document.getElementById('qualityVal');
const compressAllBtn = document.getElementById('compressAllBtn');
const clearAllBtn    = document.getElementById('clearAllBtn');
const downloadAllBtn = document.getElementById('downloadAllBtn');
const doneCount      = document.getElementById('doneCount');
const summaryBar     = document.getElementById('summaryBar');
const fileCountLabel = document.getElementById('fileCountLabel');
const maxWidthInput  = document.getElementById('maxWidth');
const maxHeightInput = document.getElementById('maxHeight');

// ─── QUALITY SLIDER ──────────────────────────────────────────────────────────
qualitySlider.addEventListener('input', () => {
  qualityVal.textContent = qualitySlider.value + '%';
});

// ─── FORMAT BUTTONS ──────────────────────────────────────────────────────────
document.getElementById('formatBtns').addEventListener('click', e => {
  const btn = e.target.closest('.fmt-btn');
  if (!btn) return;
  document.querySelectorAll('.fmt-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  selectedFormat = btn.dataset.fmt;
});

// ─── FILE INPUT EVENTS ────────────────────────────────────────────────────────
fileInput.addEventListener('change',    e => handleFiles(e.target.files));
addMoreInput.addEventListener('change', e => handleFiles(e.target.files));
dropZone.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('dragover',  e => { e.preventDefault(); dropZone.classList.add('dragging'); });
dropZone.addEventListener('dragleave', e => { if (!dropZone.contains(e.relatedTarget)) dropZone.classList.remove('dragging'); });
dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('dragging');
  handleFiles(e.dataTransfer.files);
});

// ─── HANDLE FILES ─────────────────────────────────────────────────────────────
async function handleFiles(rawFiles) {
  const valid = Array.from(rawFiles).filter(f =>
    ['image/jpeg','image/png','image/webp'].includes(f.type)
  );
  if (!valid.length) { showToast('Only JPG, PNG and WebP images are supported.'); return; }

  for (const f of valid) {
    const id       = uid();
    const thumbUrl = URL.createObjectURL(f);
    const dims     = await getImageDimensions(f);
    images.push({
      id, file: f, name: f.name, origSize: f.size,
      origW: dims.w, origH: dims.h,
      status: 'pending',
      compressedBlob: null, compressedSize: 0, compW: 0, compH: 0,
      thumbUrl
    });
  }

  settingsCard.style.display = 'block';
  resultsCard.style.display  = 'block';
  renderImageList();
  updateFileCountLabel();
}

// ─── RENDER IMAGE LIST ────────────────────────────────────────────────────────
function renderImageList() {
  imageListEl.innerHTML = '';
  images.forEach(img => imageListEl.appendChild(buildItem(img)));
  updateDoneCount();
  updateSummaryBar();
}

function buildItem(img) {
  const item       = document.createElement('div');
  item.id          = 'img-' + img.id;
  item.className   = 'img-item ' + (img.status === 'done' ? 'done' : img.status === 'error' ? 'errored' : '');

  const thumbHTML  = img.thumbUrl
    ? `<img class="img-thumb" src="${escHtml(img.thumbUrl)}" alt="" />`
    : `<span class="img-thumb-placeholder">🖼️</span>`;

  item.innerHTML = `
    <div class="img-thumb-wrap">${thumbHTML}</div>
    <div class="img-info">
      <div class="img-name" title="${escHtml(img.name)}">${escHtml(img.name)}</div>
      <div class="img-meta-row">${buildMeta(img)}</div>
    </div>
    <div class="img-actions">${buildActions(img)}</div>
  `;
  return item;
}

function buildMeta(img) {
  if (img.status === 'done') {
    const saved = img.origSize - img.compressedSize;
    const pct   = Math.round((saved / img.origSize) * 100);
    return `
      <span class="img-size-orig">${fmtBytes(img.origSize)}</span>
      <span class="img-arrow">→</span>
      <span class="img-size-comp">${fmtBytes(img.compressedSize)}</span>
      <span class="img-savings ${saved < 0 ? 'worse' : ''}">${saved < 0 ? '+' : '-'}${Math.abs(pct)}%</span>
      <span class="img-dim">${img.compW}×${img.compH}px</span>
    `;
  }
  if (img.status === 'processing') return `<span class="img-status processing"><span class="spin-ring"></span>Compressing...</span>`;
  if (img.status === 'error')      return `<span class="img-status errored">❌ Failed</span>`;
  return `<span class="img-size-orig">${fmtBytes(img.origSize)}</span><span class="img-dim">${img.origW}×${img.origH}px</span>`;
}

function buildActions(img) {
  if (img.status === 'done')
    return `<button class="btn btn-dl" onclick="downloadSingle('${img.id}')">💾 Download</button>
            <button class="btn-sm" onclick="removeImage('${img.id}')">✕ Remove</button>`;
  if (img.status === 'processing') return '';
  return `<button class="btn-sm" onclick="removeImage('${img.id}')">✕ Remove</button>`;
}

// ─── COMPRESS ALL ─────────────────────────────────────────────────────────────
compressAllBtn.addEventListener('click', compressAll);

async function compressAll() {
  if (!images.length) { showToast('No images to compress.'); return; }

  const quality = parseInt(qualitySlider.value) / 100;
  const maxW    = parseInt(maxWidthInput.value)  || null;
  const maxH    = parseInt(maxHeightInput.value) || null;

  compressAllBtn.disabled    = true;
  compressAllBtn.textContent = '⏳ Compressing...';
  downloadAllBtn.style.display = 'none';

  for (const img of images) {
    if (img.status === 'done') continue;
    img.status = 'processing';
    patchItem(img);

    try {
      const result        = await compressImage(img.file, quality, maxW, maxH);
      img.status          = 'done';
      img.compressedBlob  = result.blob;
      img.compressedSize  = result.blob.size;
      img.compW           = result.w;
      img.compH           = result.h;
    } catch {
      img.status = 'error';
    }

    patchItem(img);
    updateSummaryBar();
    updateDoneCount();
  }

  compressAllBtn.disabled    = false;
  compressAllBtn.textContent = '🗜️ Re-Compress All';

  if (images.filter(i => i.status === 'done').length > 1)
    downloadAllBtn.style.display = 'inline-flex';
}

// ─── COMPRESS SINGLE IMAGE (canvas) ──────────────────────────────────────────
function compressImage(file, quality, maxW, maxH) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload  = e => {
      const img    = new Image();
      img.onerror  = reject;
      img.onload   = () => {
        const { w, h } = calcDims(img.width, img.height, maxW, maxH);
        const canvas   = document.createElement('canvas');
        canvas.width   = w;
        canvas.height  = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        const mime = selectedFormat === 'same' ? file.type : selectedFormat;
        const q    = mime === 'image/png' ? 1 : quality;
        canvas.toBlob(blob => {
          if (!blob) { reject(new Error('toBlob failed')); return; }
          resolve({ blob, w, h });
        }, mime, q);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// ─── ASPECT-RATIO SAFE DIMENSIONS ────────────────────────────────────────────
function calcDims(origW, origH, maxW, maxH) {
  let w = origW, h = origH;
  if (!maxW && !maxH) return { w, h };
  if (maxW && w > maxW) { h = Math.round(h * maxW / w); w = maxW; }
  if (maxH && h > maxH) { w = Math.round(w * maxH / h); h = maxH; }
  return { w, h };
}

// ─── PATCH SINGLE ITEM DOM (no full re-render) ───────────────────────────────
function patchItem(img) {
  const item = document.getElementById('img-' + img.id);
  if (!item) return;
  item.className = 'img-item ' + (img.status === 'done' ? 'done' : img.status === 'error' ? 'errored' : '');
  item.querySelector('.img-meta-row').innerHTML = buildMeta(img);
  item.querySelector('.img-actions').innerHTML  = buildActions(img);
}

// ─── DOWNLOAD SINGLE ─────────────────────────────────────────────────────────
function downloadSingle(id) {
  const img = images.find(i => i.id === id);
  if (!img || !img.compressedBlob) return;
  const ext  = img.compressedBlob.type.split('/')[1].replace('jpeg','jpg') || 'jpg';
  const base = img.name.replace(/\.[^.]+$/, '');
  const url  = URL.createObjectURL(img.compressedBlob);
  const a    = Object.assign(document.createElement('a'), { href: url, download: `${base}_compressed.${ext}` });
  a.click();
  URL.revokeObjectURL(url);
}

// ─── DOWNLOAD ALL AS ZIP ─────────────────────────────────────────────────────
downloadAllBtn.addEventListener('click', async () => {
  const done = images.filter(i => i.status === 'done');
  if (!done.length) { showToast('No compressed images yet.'); return; }

  downloadAllBtn.textContent = '⏳ Zipping...';
  downloadAllBtn.disabled    = true;

  const zip = new JSZip();
  done.forEach(img => {
    const ext  = img.compressedBlob.type.split('/')[1].replace('jpeg','jpg') || 'jpg';
    const base = img.name.replace(/\.[^.]+$/, '');
    zip.file(`${base}_compressed.${ext}`, img.compressedBlob);
  });

  const blob = await zip.generateAsync({ type: 'blob' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), { href: url, download: 'toolzone_compressed.zip' });
  a.click();
  URL.revokeObjectURL(url);

  downloadAllBtn.textContent = '📦 Download All (ZIP)';
  downloadAllBtn.disabled    = false;
});

// ─── REMOVE IMAGE ─────────────────────────────────────────────────────────────
function removeImage(id) {
  images = images.filter(i => i.id !== id);
  if (!images.length) { clearAll(); return; }
  renderImageList();
  updateFileCountLabel();
}

// ─── CLEAR ALL ───────────────────────────────────────────────────────────────
clearAllBtn.addEventListener('click', clearAll);
function clearAll() {
  images              = [];
  fileInput.value     = '';
  addMoreInput.value  = '';
  settingsCard.style.display    = 'none';
  resultsCard.style.display     = 'none';
  downloadAllBtn.style.display  = 'none';
  summaryBar.style.display      = 'none';
  imageListEl.innerHTML         = '';
  compressAllBtn.textContent    = '🗜️ Compress All';
  compressAllBtn.disabled       = false;
}

// ─── SUMMARY BAR ─────────────────────────────────────────────────────────────
function updateSummaryBar() {
  const done = images.filter(i => i.status === 'done');
  if (!done.length) { summaryBar.style.display = 'none'; return; }
  summaryBar.style.display = 'flex';
  const totalOrig = done.reduce((s, i) => s + i.origSize, 0);
  const totalComp = done.reduce((s, i) => s + i.compressedSize, 0);
  const saved     = totalOrig - totalComp;
  const pct       = Math.round((saved / totalOrig) * 100);
  document.getElementById('sumOriginal').textContent   = fmtBytes(totalOrig);
  document.getElementById('sumCompressed').textContent = fmtBytes(totalComp);
  document.getElementById('sumSaved').textContent      = (saved >= 0 ? '−' : '+') + fmtBytes(Math.abs(saved));
  document.getElementById('sumPct').textContent        = (saved >= 0 ? '−' : '+') + Math.abs(pct) + '%';
}

function updateDoneCount() {
  const done = images.filter(i => i.status === 'done').length;
  doneCount.textContent = `${done} / ${images.length} done`;
}

function updateFileCountLabel() {
  fileCountLabel.textContent = `${images.length} image${images.length !== 1 ? 's' : ''} added`;
  updateDoneCount();
}

// ─── UTILS ───────────────────────────────────────────────────────────────────
function getImageDimensions(file) {
  return new Promise(resolve => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload  = () => { resolve({ w: img.width,  h: img.height }); URL.revokeObjectURL(url); };
    img.onerror = () => { resolve({ w: 0, h: 0 }); URL.revokeObjectURL(url); };
    img.src = url;
  });
}

function fmtBytes(b) {
  if (b < 1024)    return b + ' B';
  if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
  return (b / 1048576).toFixed(2) + ' MB';
}

function uid()     { return Math.random().toString(36).slice(2, 10); }
function escHtml(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

// ─── TOAST ───────────────────────────────────────────────────────────────────
let toastTimer;
function showToast(msg) {
  let t = document.getElementById('tz-toast');
  if (!t) {
    t    = document.createElement('div');
    t.id = 'tz-toast';
    t.style.cssText = [
      'position:fixed','bottom:28px','left:50%',
      'transform:translateX(-50%) translateY(80px)',
      'background:#13131f','border:1px solid #7c5cfc','color:#eeeeff',
      'padding:12px 24px','border-radius:100px','font-size:0.85rem',
      'font-weight:600','z-index:999',
      "transition:transform 0.3s cubic-bezier(0.16,1,0.3,1)",
      'white-space:nowrap','box-shadow:0 8px 32px rgba(0,0,0,0.5)',
      "font-family:'Plus Jakarta Sans',sans-serif"
    ].join(';');
    document.body.appendChild(t);
  }
  t.textContent     = msg;
  t.style.transform = 'translateX(-50%) translateY(0)';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.style.transform = 'translateX(-50%) translateY(80px)'; }, 3000);
}