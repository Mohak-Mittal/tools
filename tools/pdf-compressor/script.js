// ── PDF COMPRESSOR script.js ─────────────────────────────────────
// Strategy: render each PDF page to canvas using PDF.js,
// then re-encode as JPEG at chosen quality, rebuild PDF with pdf-lib.

pdfjsLib.GlobalWorkerOptions.workerSrc =
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

let pdfFile = null;
let compressedBytes = null;
let origSize = 0;

const $ = id => document.getElementById(id);

const dropZone    = $('dropZone');
const fileInput   = $('fileInput');
const fileLoaded  = $('fileLoaded');
const flName      = $('flName');
const flMeta      = $('flMeta');
const removeFile  = $('removeFile');
const fileInfo    = $('fileInfo');
const compressBtn = $('compressBtn');
const clearBtn    = $('clearBtn');
const downloadBtn = $('downloadBtn');
const compressAgainBtn=$('compressAgainBtn');
const statusMsg   = $('statusMsg');
const emptyState  = $('emptyState');
const progressPanel=$('progressPanel');
const successPanel= $('successPanel');
const ppBarFill   = $('ppBarFill');
const ppLabel     = $('ppLabel');
const spPct       = $('spPct');
const spOrig      = $('spOrig');
const spComp      = $('spComp');
const spNote      = $('spNote');
const resultStatus= $('resultStatus');
const fileStats   = $('fileStats');
const savingsBarWrap=$('savingsBarWrap');
const savingsBarFill=$('savingsBarFill');

// Quality map per level
const QUALITY_MAP = { low: 0.85, medium: 0.65, high: 0.45, extreme: 0.25 };
// Scale map — lower scale = smaller render = smaller file
const SCALE_MAP   = { low: 1.5,  medium: 1.2,  high: 1.0,  extreme: 0.8  };

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
  const f = e.dataTransfer.files[0]; if (f) loadFile(f);
});
removeFile.addEventListener('click', clearAll);
clearBtn.addEventListener('click',    clearAll);
compressBtn.addEventListener('click', doCompress);
downloadBtn.addEventListener('click', doDownload);
compressAgainBtn.addEventListener('click', () => {
  showCenter('empty');
  compressBtn.disabled = false;
  compressedBytes = null;
  statusMsg.textContent = `${pdfFile.name} loaded — Adjust settings and compress again`;
  resultStatus.textContent = 'No result yet';
});

// ── LOAD FILE ────────────────────────────────────────────────────
async function loadFile(file) {
  if (!file || (!file.type.includes('pdf') && !file.name.toLowerCase().endsWith('.pdf'))) {
    toast('Please select a valid PDF file.'); return;
  }
  pdfFile = file;
  origSize = file.size;
  flName.textContent = file.name;
  flMeta.textContent = `${fmtBytes(file.size)}`;

  // Try to get page count
  try {
    const buf = await readBuf(file);
    const doc = await pdfjsLib.getDocument({ data: buf }).promise;
    flMeta.textContent = `${fmtBytes(file.size)} · ${doc.numPages} pages`;
    fileInfo.textContent = `${doc.numPages} pages`;
  } catch { fileInfo.textContent = fmtBytes(file.size); }

  dropZone.style.display   = 'none';
  fileLoaded.style.display = 'block';
  fileStats.style.display  = 'none';
  savingsBarWrap.style.display = 'none';
  compressBtn.disabled = false;
  compressedBytes = null;
  showCenter('empty');
  statusMsg.textContent = `${file.name} loaded — Choose compression level in Settings then click Compress PDF`;
}

// ── COMPRESS ─────────────────────────────────────────────────────
async function doCompress() {
  if (!pdfFile) return;

  const level     = document.querySelector('input[name="compLevel"]:checked').value;
  const quality   = QUALITY_MAP[level];
  const scale     = SCALE_MAP[level];
  const removeMeta= $('optRemoveMeta').checked;
  const grayscale = $('optGrayscale').checked;
  const openAfter = $('optOpenAfter').checked;

  compressBtn.disabled = true;
  showCenter('progress');
  statusMsg.textContent = 'Compressing...';

  try {
    const buf       = await readBuf(pdfFile);
    const pdfJs     = await pdfjsLib.getDocument({ data: buf }).promise;
    const numPages  = pdfJs.numPages;
    const outPdf    = await PDFLib.PDFDocument.create();

    // Remove metadata if requested
    if (!removeMeta) {
      // keep metadata (do nothing)
    }

    for (let i = 1; i <= numPages; i++) {
      const pct = Math.round(10 + ((i - 1) / numPages) * 82);
      ppBarFill.style.width = pct + '%';
      ppLabel.textContent   = `Compressing page ${i} of ${numPages}...`;

      const page     = await pdfJs.getPage(i);
      const viewport = page.getViewport({ scale });

      const canvas  = document.createElement('canvas');
      canvas.width  = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');

      // Grayscale filter
      if (grayscale) ctx.filter = 'grayscale(100%)';

      await page.render({ canvasContext: ctx, viewport }).promise;

      // Get JPEG data
      const imgData = canvas.toDataURL('image/jpeg', quality);
      const base64  = imgData.split(',')[1];
      const imgBytes= Uint8Array.from(atob(base64), c => c.charCodeAt(0));

      const jpgImage  = await outPdf.embedJpg(imgBytes);
      const pdfPage   = outPdf.addPage([viewport.width, viewport.height]);
      pdfPage.drawImage(jpgImage, { x: 0, y: 0, width: viewport.width, height: viewport.height });

      await delay(10);
    }

    ppBarFill.style.width = '98%'; ppLabel.textContent = 'Finalising...';
    await delay(100);

    compressedBytes = await outPdf.save();
    ppBarFill.style.width = '100%';
    await delay(200);

    const compSize = compressedBytes.byteLength;
    const saved    = origSize - compSize;
    const pct      = Math.round((saved / origSize) * 100);

    spPct.textContent  = (pct >= 0 ? '-' : '+') + Math.abs(pct) + '%';
    spOrig.textContent = fmtBytes(origSize);
    spComp.textContent = fmtBytes(compSize);
    spNote.textContent = pct < 5
      ? 'This PDF may be mostly text or already optimized, which limits how much it can be reduced.'
      : `Your file is ${Math.abs(pct)}% smaller — great result!`;

    resultStatus.textContent = `${fmtBytes(compSize)} (${pct >= 0 ? '-' : '+'}${Math.abs(pct)}%)`;
    statusMsg.textContent = `✅ Compressed from ${fmtBytes(origSize)} to ${fmtBytes(compSize)} — ${Math.abs(pct)}% smaller`;

    // Update left panel stats
    fileStats.style.display  = 'block';
    savingsBarWrap.style.display = 'block';
    $('statOrig').textContent  = fmtBytes(origSize);
    $('statComp').textContent  = fmtBytes(compSize);
    $('statSaved').textContent = (saved >= 0 ? '−' : '+') + fmtBytes(Math.abs(saved));
    $('statPct').textContent   = (pct >= 0 ? '−' : '+') + Math.abs(pct) + '%';
    savingsBarFill.style.width = Math.min(Math.max(pct, 0), 100) + '%';

    showCenter('success');

    // Mobile: jump to output tab
    if (window.innerWidth <= 900) {
      document.querySelectorAll('.mtab').forEach(b => b.classList.remove('active'));
      document.querySelector('[data-tab="output"]').classList.add('active');
      document.querySelectorAll('[data-tab-content]').forEach(p =>
        p.classList.toggle('mobile-active', p.dataset.tabContent === 'output'));
    }

    if (openAfter) window.open(URL.createObjectURL(new Blob([compressedBytes], { type: 'application/pdf' })), '_blank');

  } catch(err) {
    console.error(err);
    toast('Compression failed. The PDF may be encrypted or corrupted.');
    showCenter('empty');
    compressBtn.disabled = false;
  }
}

function doDownload() {
  if (!compressedBytes) return;
  const name = ($('outputName').value.trim() || 'compressed') + '.pdf';
  Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(new Blob([compressedBytes], { type: 'application/pdf' })),
    download: name
  }).click();
}

function clearAll() {
  pdfFile = null; compressedBytes = null; origSize = 0;
  fileInput.value = '';
  dropZone.style.display   = 'flex';
  fileLoaded.style.display = 'none';
  fileStats.style.display  = 'none';
  savingsBarWrap.style.display = 'none';
  compressBtn.disabled = true;
  fileInfo.textContent = 'No file loaded';
  resultStatus.textContent = 'No result yet';
  statusMsg.textContent = 'Ready — Upload a PDF to compress';
  showCenter('empty');
}

function showCenter(state) {
  emptyState.style.display    = state === 'empty'    ? 'block' : 'none';
  progressPanel.style.display = state === 'progress' ? 'block' : 'none';
  successPanel.style.display  = state === 'success'  ? 'block' : 'none';
}

// ── UTILS ────────────────────────────────────────────────────────
function readBuf(file) {
  return new Promise((res,rej) => { const r = new FileReader(); r.onload = e => res(e.target.result); r.onerror = rej; r.readAsArrayBuffer(file); });
}
function fmtBytes(b) { if(b<1024)return b+' B'; if(b<1048576)return(b/1024).toFixed(1)+' KB'; return(b/1048576).toFixed(2)+' MB'; }
function delay(ms){ return new Promise(r=>setTimeout(r,ms)); }

let toastT;
function toast(msg) {
  let t = document.getElementById('tz-toast');
  if (!t) { t = document.createElement('div'); t.id='tz-toast'; t.style.cssText="position:fixed;bottom:34px;left:50%;transform:translateX(-50%) translateY(60px);background:#1e1e1e;border:1px solid #5cf8c8;color:#e0e0e0;padding:9px 20px;border-radius:4px;font-size:12px;font-weight:500;z-index:999;transition:transform 0.25s ease;white-space:nowrap;box-shadow:0 4px 20px rgba(0,0,0,.6);font-family:'Inter',sans-serif;max-width:90vw;text-align:center;"; document.body.appendChild(t); }
  t.textContent=msg; t.style.transform='translateX(-50%) translateY(0)';
  clearTimeout(toastT); toastT=setTimeout(()=>{ t.style.transform='translateX(-50%) translateY(60px)'; },3500);
}