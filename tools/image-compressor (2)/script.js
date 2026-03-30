// ── IMAGE COMPRESSOR script.js ──────────────────────────────────

let images = [];
let selectedId = null;
let selectedFormat = 'same';

const $ = id => document.getElementById(id);

const dropZone      = $('dropZone');
const fileInput     = $('fileInput');
const addMoreInput  = $('addMoreInput');
const queueList     = $('queueList');
const queueCount    = $('queueCount');
const compressBtn   = $('compressBtn');
const clearAllBtn   = $('clearAllBtn');
const downloadAllBtn= $('downloadAllBtn');
const qualitySlider = $('qualitySlider');
const qualityVal    = $('qualityVal');
const perQSlider    = $('perQSlider');
const perQVal       = $('perQVal');
const statusMsg     = $('statusMsg');
const maxWidthInput = $('maxWidth');
const maxHeightInput= $('maxHeight');
const summarySection= $('summarySection');
const perImageSection=$('perImageSection');
const perImageName  = $('perImageName');
const emptyState    = $('emptyState');
const previewWrap   = $('previewWrap');
const savingBar     = $('savingBar');
const previewLabel  = $('previewLabel');

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
if (window.innerWidth <= 900) {
  document.querySelector('[data-tab-content="queue"]').classList.add('mobile-active');
}

// ── SLIDERS ──────────────────────────────────────────────────────
qualitySlider.addEventListener('input', () => { qualityVal.textContent = qualitySlider.value + '%'; });
perQSlider.addEventListener('input', () => {
  perQVal.textContent = perQSlider.value + '%';
  const img = images.find(i => i.id === selectedId);
  if (img) { img.customQuality = parseInt(perQSlider.value); img.status = 'pending'; patchItem(img); }
});
$('resetPerQBtn').addEventListener('click', () => {
  const img = images.find(i => i.id === selectedId);
  if (!img) return;
  img.customQuality = null; img.status = 'pending'; patchItem(img);
  perQSlider.value = qualitySlider.value; perQVal.textContent = qualitySlider.value + '%';
  toast('Custom quality removed — using global setting.');
});

// ── FORMAT BUTTONS ───────────────────────────────────────────────
$('fmtGrid').addEventListener('click', e => {
  const btn = e.target.closest('.fmt-btn');
  if (!btn) return;
  document.querySelectorAll('.fmt-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  selectedFormat = btn.dataset.fmt;
});

// ── FILE INPUT ───────────────────────────────────────────────────
fileInput.addEventListener('change',    e => handleFiles(e.target.files));
addMoreInput.addEventListener('change', e => handleFiles(e.target.files));

dropZone.addEventListener('click', e => {
  if (e.target.closest('label') || e.target.tagName === 'INPUT') return;
  fileInput.click();
});
dropZone.addEventListener('dragover',  e => { e.preventDefault(); dropZone.classList.add('dragging'); });
dropZone.addEventListener('dragleave', e => { if (!dropZone.contains(e.relatedTarget)) dropZone.classList.remove('dragging'); });
dropZone.addEventListener('drop', e => {
  e.preventDefault(); dropZone.classList.remove('dragging');
  handleFiles(e.dataTransfer.files);
});

compressBtn.addEventListener('click',    compressAll);
clearAllBtn.addEventListener('click',    clearAll);
downloadAllBtn.addEventListener('click', downloadZip);

// ── HANDLE FILES ─────────────────────────────────────────────────
async function handleFiles(raw) {
  const valid = Array.from(raw).filter(f => ['image/jpeg','image/png','image/webp'].includes(f.type));
  if (!valid.length) { toast('Only JPG, PNG and WebP images are supported.'); return; }

  for (const f of valid) {
    const dims = await getDims(f);
    images.push({
      id: uid(), file: f, name: f.name,
      origSize: f.size, origW: dims.w, origH: dims.h,
      status: 'pending',
      compressedBlob: null, compressedSize: 0, compW: 0, compH: 0,
      thumbUrl: URL.createObjectURL(f),
      customQuality: null
    });
  }
  renderQueue(); updateUI();
}

// ── RENDER QUEUE ─────────────────────────────────────────────────
function renderQueue() {
  const has = images.length > 0;
  dropZone.style.display   = has ? 'none' : 'flex';
  queueList.style.display  = has ? 'flex' : 'none';
  queueList.innerHTML = '';
  queueCount.textContent = has ? `${images.length} image${images.length !== 1 ? 's' : ''}` : '0 images';

  images.forEach(img => {
    const el = document.createElement('div');
    el.id        = 'qi-' + img.id;
    el.className = 'qi' + (img.id === selectedId ? ' selected' : '') + (img.status !== 'pending' ? ' ' + img.status : '');
    el.title     = `${img.name} — Click to see Before/After preview`;

    const savingHTML = img.status === 'done' ? (() => {
      const pct  = Math.round((1 - img.compressedSize / img.origSize) * 100);
      return `<span class="qi-saving ${pct >= 0 ? 'good' : 'bad'}">${pct >= 0 ? '-' : '+'}${Math.abs(pct)}%</span>`;
    })() : '';

    el.innerHTML = `
      <img class="qi-thumb" src="${esc(img.thumbUrl)}" alt="" />
      <div class="qi-info">
        <div class="qi-name">${esc(img.name)}</div>
        <div class="qi-meta">
          ${fmtBytes(img.origSize)}
          ${img.status === 'done' ? `→ ${fmtBytes(img.compressedSize)}` : `· ${img.origW}×${img.origH}`}
          ${savingHTML}
          ${img.status === 'processing' ? '<span class="spin-ring"></span>' : ''}
          ${img.customQuality !== null ? `<span style="color:var(--accent);font-size:9px;font-weight:700;" title="This image has a custom quality setting">Q:${img.customQuality}%</span>` : ''}
        </div>
      </div>
      ${img.status === 'done' ? `<button class="qi-dl" title="Download this compressed image" onclick="dlSingle('${img.id}')">💾</button>` : ''}
      <button class="qi-rm" title="Remove this image from the queue" onclick="removeImg('${img.id}')">✕</button>
    `;

    el.addEventListener('click', e => {
      if (e.target.closest('button')) return;
      selectedId = selectedId === img.id ? null : img.id;
      renderQueue();
      renderPreview();
      renderPerImage();
      // Switch mobile to preview tab
      if (window.innerWidth <= 900 && selectedId) {
        document.querySelectorAll('.mtab').forEach(b => b.classList.remove('active'));
        document.querySelector('[data-tab="preview"]').classList.add('active');
        document.querySelectorAll('[data-tab-content]').forEach(p => p.classList.toggle('mobile-active', p.dataset.tabContent === 'preview'));
      }
    });
    queueList.appendChild(el);
  });
}

function patchItem(img) {
  const el = document.getElementById('qi-' + img.id);
  if (!el) return;
  el.className = 'qi' + (img.id === selectedId ? ' selected' : '') + (img.status !== 'pending' ? ' ' + img.status : '');
  const meta = el.querySelector('.qi-meta');
  if (!meta) return;
  const pct = img.status === 'done' ? Math.round((1 - img.compressedSize / img.origSize) * 100) : null;
  meta.innerHTML = `
    ${fmtBytes(img.origSize)}
    ${img.status === 'done' ? `→ ${fmtBytes(img.compressedSize)}` : `· ${img.origW}×${img.origH}`}
    ${pct !== null ? `<span class="qi-saving ${pct >= 0 ? 'good' : 'bad'}">${pct >= 0 ? '-' : '+'}${Math.abs(pct)}%</span>` : ''}
    ${img.status === 'processing' ? '<span class="spin-ring"></span>' : ''}
    ${img.customQuality !== null ? `<span style="color:var(--accent);font-size:9px;font-weight:700;">Q:${img.customQuality}%</span>` : ''}
  `;
  // Patch download button
  const actions = el.querySelector('.qi-dl');
  if (!actions && img.status === 'done') {
    const dlBtn = document.createElement('button');
    dlBtn.className = 'qi-dl'; dlBtn.title = 'Download this compressed image';
    dlBtn.textContent = '💾';
    dlBtn.onclick = () => dlSingle(img.id);
    el.insertBefore(dlBtn, el.querySelector('.qi-rm'));
  }
}

// ── PREVIEW ──────────────────────────────────────────────────────
function renderPreview() {
  const img = images.find(i => i.id === selectedId);
  if (!img) {
    emptyState.style.display  = 'flex';
    previewWrap.style.display = 'none';
    previewLabel.textContent  = 'Select an image to preview';
    return;
  }
  emptyState.style.display  = 'none';
  previewWrap.style.display = 'flex';
  previewLabel.textContent  = img.name;

  $('prevOrig').src = img.thumbUrl;
  $('prevOrigInfo').textContent = `${fmtBytes(img.origSize)} · ${img.origW}×${img.origH}px`;

  if (img.status === 'done' && img.compressedBlob) {
    $('prevComp').src = URL.createObjectURL(img.compressedBlob);
    $('prevCompInfo').textContent = `${fmtBytes(img.compressedSize)} · ${img.compW}×${img.compH}px`;
    const saved = img.origSize - img.compressedSize;
    const pct   = Math.round((saved / img.origSize) * 100);
    savingBar.style.display = 'flex';
    $('savingVal').textContent = `${pct >= 0 ? '-' : '+'}${Math.abs(pct)}%`;
    $('savingVal').style.color = pct >= 0 ? 'var(--green2)' : '#e05c5c';
  } else {
    $('prevComp').src = '';
    $('prevCompInfo').textContent = img.status === 'processing' ? '⏳ Compressing...' : 'Compress first to see result';
    savingBar.style.display = 'none';
  }
}

// ── PER-IMAGE SETTINGS ───────────────────────────────────────────
function renderPerImage() {
  const img = images.find(i => i.id === selectedId);
  perImageSection.style.display = img ? 'block' : 'none';
  if (!img) return;
  perImageName.textContent = img.name;
  const q = img.customQuality !== null ? img.customQuality : parseInt(qualitySlider.value);
  perQSlider.value = q; perQVal.textContent = q + '%';
}

// ── COMPRESS ALL ─────────────────────────────────────────────────
async function compressAll() {
  if (!images.length) { toast('No images to compress.'); return; }

  const quality = parseInt(qualitySlider.value) / 100;
  const maxW    = parseInt(maxWidthInput.value)  || null;
  const maxH    = parseInt(maxHeightInput.value) || null;

  // Always reset all so re-compress works
  images.forEach(img => { img.status = 'pending'; img.compressedBlob = null; img.compressedSize = 0; });
  renderQueue();

  compressBtn.disabled    = true;
  compressBtn.textContent = '⏳ Compressing...';
  downloadAllBtn.style.display = 'none';

  for (const img of images) {
    img.status = 'processing'; patchItem(img);

    try {
      const q      = img.customQuality !== null ? img.customQuality / 100 : quality;
      const result = await compressOne(img.file, q, maxW, maxH);
      img.status         = 'done';
      img.compressedBlob = result.blob;
      img.compressedSize = result.blob.size;
      img.compW          = result.w;
      img.compH          = result.h;
    } catch { img.status = 'error'; }

    patchItem(img);
    if (img.id === selectedId) renderPreview();
    updateSummary();
  }

  compressBtn.disabled    = false;
  compressBtn.textContent = '🗜️ Compress All';

  const done = images.filter(i => i.status === 'done').length;
  if (done > 1) downloadAllBtn.style.display = 'inline-flex';
  statusMsg.textContent = `✅ Done — ${done}/${images.length} compressed`;
  renderQueue();
}

// ── COMPRESS ONE ─────────────────────────────────────────────────
function compressOne(file, quality, maxW, maxH) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload  = e => {
      const img = new Image();
      img.onerror = reject;
      img.onload  = () => {
        const { w, h } = calcDims(img.width, img.height, maxW, maxH);
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        const mime = selectedFormat === 'same' ? file.type : selectedFormat;
        canvas.toBlob(blob => {
          if (!blob) { reject(new Error('toBlob failed')); return; }
          resolve({ blob, w, h });
        }, mime, mime === 'image/png' ? 1 : quality);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

function calcDims(w, h, maxW, maxH) {
  if (!maxW && !maxH) return { w, h };
  if (maxW && w > maxW) { h = Math.round(h * maxW / w); w = maxW; }
  if (maxH && h > maxH) { w = Math.round(w * maxH / h); h = maxH; }
  return { w, h };
}

// ── DOWNLOAD SINGLE ──────────────────────────────────────────────
function dlSingle(id) {
  const img = images.find(i => i.id === id);
  if (!img?.compressedBlob) return;
  const ext  = img.compressedBlob.type.split('/')[1].replace('jpeg','jpg') || 'jpg';
  Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(img.compressedBlob),
    download: img.name.replace(/\.[^.]+$/, '') + '_compressed.' + ext
  }).click();
}

// ── DOWNLOAD ZIP ─────────────────────────────────────────────────
async function downloadZip() {
  const done = images.filter(i => i.status === 'done');
  if (!done.length) { toast('No compressed images yet. Compress first!'); return; }
  downloadAllBtn.textContent = '⏳ Zipping...';
  downloadAllBtn.disabled    = true;

  const zip = new JSZip();
  done.forEach(img => {
    const ext = img.compressedBlob.type.split('/')[1].replace('jpeg','jpg') || 'jpg';
    zip.file(img.name.replace(/\.[^.]+$/, '') + '_compressed.' + ext, img.compressedBlob);
  });

  const blob = await zip.generateAsync({ type: 'blob' });
  Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'toolzone_compressed.zip' }).click();
  downloadAllBtn.textContent = '📦 ZIP';
  downloadAllBtn.disabled    = false;
}

// ── REMOVE ───────────────────────────────────────────────────────
function removeImg(id) {
  images = images.filter(i => i.id !== id);
  if (selectedId === id) { selectedId = null; renderPreview(); renderPerImage(); }
  if (!images.length) { clearAll(); return; }
  renderQueue(); updateUI(); updateSummary();
}

function clearAll() {
  images = []; selectedId = null;
  fileInput.value = ''; addMoreInput.value = '';
  downloadAllBtn.style.display  = 'none';
  summarySection.style.display  = 'none';
  perImageSection.style.display = 'none';
  emptyState.style.display  = 'flex';
  previewWrap.style.display = 'none';
  compressBtn.textContent   = '🗜️ Compress All';
  compressBtn.disabled      = true;
  renderQueue(); updateUI();
}

// ── SUMMARY ──────────────────────────────────────────────────────
function updateSummary() {
  const done = images.filter(i => i.status === 'done');
  summarySection.style.display = done.length ? 'block' : 'none';
  if (!done.length) return;
  const totalOrig = done.reduce((s, i) => s + i.origSize, 0);
  const totalComp = done.reduce((s, i) => s + i.compressedSize, 0);
  const saved     = totalOrig - totalComp;
  const pct       = Math.round((saved / totalOrig) * 100);
  $('sumOrig').textContent  = fmtBytes(totalOrig);
  $('sumComp').textContent  = fmtBytes(totalComp);
  $('sumSaved').textContent = `${pct >= 0 ? '-' : '+'}${Math.abs(pct)}% (${fmtBytes(Math.abs(saved))})`;
}

function updateUI() {
  const n = images.length;
  statusMsg.textContent = n
    ? `${n} image${n !== 1 ? 's' : ''} ready — Adjust settings then click Compress All`
    : 'Ready — Drop images to begin';
  compressBtn.disabled = n === 0;
}

// ── UTILS ────────────────────────────────────────────────────────
function getDims(file) {
  return new Promise(resolve => {
    const img = new Image(); const url = URL.createObjectURL(file);
    img.onload  = () => { resolve({ w: img.width, h: img.height }); URL.revokeObjectURL(url); };
    img.onerror = () => { resolve({ w: 0, h: 0 }); URL.revokeObjectURL(url); };
    img.src = url;
  });
}
function fmtBytes(b) {
  if (b < 1024) return b + ' B'; if (b < 1048576) return (b/1024).toFixed(1) + ' KB'; return (b/1048576).toFixed(2) + ' MB';
}
function uid()  { return Math.random().toString(36).slice(2, 10); }
function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

let toastT;
function toast(msg) {
  let t = document.getElementById('tz-toast');
  if (!t) {
    t = document.createElement('div'); t.id = 'tz-toast';
    t.style.cssText = "position:fixed;bottom:34px;left:50%;transform:translateX(-50%) translateY(60px);background:#1e1e1e;border:1px solid #7c5cfc;color:#e0e0e0;padding:9px 20px;border-radius:4px;font-size:12px;font-weight:500;z-index:999;transition:transform 0.25s ease;white-space:nowrap;box-shadow:0 4px 20px rgba(0,0,0,.6);font-family:'Inter',sans-serif;max-width:90vw;text-align:center;";
    document.body.appendChild(t);
  }
  t.textContent = msg; t.style.transform = 'translateX(-50%) translateY(0)';
  clearTimeout(toastT); toastT = setTimeout(() => { t.style.transform = 'translateX(-50%) translateY(60px)'; }, 3500);
}

updateUI();