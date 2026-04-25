let m3Operation = 'increase';

// ── TABS ──
document.querySelectorAll('.mode-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.mode-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.calc-panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('panel-' + tab.dataset.mode).classList.add('active');
  });
});

// ── HELPERS ──
function fmt(n) {
  if (n === null || isNaN(n) || !isFinite(n)) return null;
  const rounded = Math.round(n * 10000) / 10000;
  return rounded.toLocaleString('en-IN', { maximumFractionDigits: 4 });
}

function showResult(id) {
  const card = document.getElementById('result-' + id);
  card.querySelector('.result-placeholder').style.display = 'none';
  card.querySelector('.result-content').style.display = 'block';
  card.style.alignItems = 'flex-start';
}

function hideResult(id) {
  const card = document.getElementById('result-' + id);
  card.querySelector('.result-placeholder').style.display = 'block';
  card.querySelector('.result-content').style.display = 'none';
  card.style.alignItems = 'center';
}

function clearPanel(id) {
  document.querySelectorAll('#panel-' + id + ' input').forEach(i => i.value = '');
  hideResult(id);
}

function copyResult(elId, btn) {
  const text = document.getElementById(elId).textContent.replace(/[,%\s]/g, '');
  navigator.clipboard.writeText(text).then(() => {
    btn.classList.add('copied');
    btn.textContent = '✓ Copied!';
    setTimeout(() => {
      btn.classList.remove('copied');
      btn.innerHTML = `<svg viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy Result`;
    }, 2000);
  });
}

function setToggle(mode, op) {
  m3Operation = op;
  document.getElementById('m3-inc').classList.toggle('active', op === 'increase');
  document.getElementById('m3-dec').classList.toggle('active', op === 'decrease');
  calcMode3();
}

// ── MODE 0 ──
function calcMode0() {
  const pct = parseFloat(document.getElementById('m0-pct').value);
  const total = parseFloat(document.getElementById('m0-total').value);
  if (isNaN(pct) || isNaN(total)) return hideResult(0);
  const result = (pct / 100) * total;
  const r = fmt(result);
  if (!r) return hideResult(0);
  document.getElementById('r0-value').textContent = r;
  document.getElementById('r0-eq').textContent = `${pct}% of ${fmt(total)} = ${r}`;
  document.getElementById('r0-formula').textContent = `Result = (${pct} ÷ 100) × ${fmt(total)}\n       = ${r}`;
  showResult(0);
}
document.getElementById('m0-pct').addEventListener('input', calcMode0);
document.getElementById('m0-total').addEventListener('input', calcMode0);

// ── MODE 1 ──
function calcMode1() {
  const val = parseFloat(document.getElementById('m1-val').value);
  const total = parseFloat(document.getElementById('m1-total').value);
  if (isNaN(val) || isNaN(total) || total === 0) return hideResult(1);
  const result = (val / total) * 100;
  const r = fmt(result);
  if (!r) return hideResult(1);
  document.getElementById('r1-value').textContent = r + '%';
  document.getElementById('r1-eq').textContent = `${fmt(val)} is ${r}% of ${fmt(total)}`;
  document.getElementById('r1-formula').textContent = `% = (${fmt(val)} ÷ ${fmt(total)}) × 100\n  = ${r}%`;
  showResult(1);
}
document.getElementById('m1-val').addEventListener('input', calcMode1);
document.getElementById('m1-total').addEventListener('input', calcMode1);

// ── MODE 2 ──
function calcMode2() {
  const from = parseFloat(document.getElementById('m2-from').value);
  const to = parseFloat(document.getElementById('m2-to').value);
  if (isNaN(from) || isNaN(to) || from === 0) return hideResult(2);
  const change = ((to - from) / Math.abs(from)) * 100;
  const r = fmt(Math.abs(change));
  if (!r) return hideResult(2);
  const isIncrease = change >= 0;
  const sign = isIncrease ? '+' : '-';
  document.getElementById('r2-value').textContent = sign + r + '%';
  document.getElementById('r2-eq').textContent = `From ${fmt(from)} to ${fmt(to)}`;
  const badge = document.getElementById('r2-badge');
  badge.textContent = isIncrease ? '▲ Increase' : '▼ Decrease';
  badge.className = 'change-badge ' + (isIncrease ? 'increase' : 'decrease');
  document.getElementById('r2-formula').textContent = `% Change = ((${fmt(to)} − ${fmt(from)}) ÷ |${fmt(from)}|) × 100\n         = ${sign}${r}%`;
  showResult(2);
}
document.getElementById('m2-from').addEventListener('input', calcMode2);
document.getElementById('m2-to').addEventListener('input', calcMode2);

// ── MODE 3 ──
function calcMode3() {
  const val = parseFloat(document.getElementById('m3-val').value);
  const pct = parseFloat(document.getElementById('m3-pct').value);
  if (isNaN(val) || isNaN(pct)) return hideResult(3);
  const multiplier = m3Operation === 'increase' ? (1 + pct / 100) : (1 - pct / 100);
  const result = val * multiplier;
  const diff = fmt(Math.abs(result - val));
  const r = fmt(result);
  if (!r) return hideResult(3);
  const op = m3Operation === 'increase' ? 'increased' : 'decreased';
  const sign = m3Operation === 'increase' ? '+' : '-';
  document.getElementById('r3-value').textContent = r;
  document.getElementById('r3-eq').textContent = `${fmt(val)} ${op} by ${pct}% = ${r} (${sign}${diff})`;
  document.getElementById('r3-formula').textContent = `New Value = ${fmt(val)} × (1 ${m3Operation === 'increase' ? '+' : '−'} ${pct}/100)\n          = ${r}`;
  showResult(3);
}
document.getElementById('m3-val').addEventListener('input', calcMode3);
document.getElementById('m3-pct').addEventListener('input', calcMode3);

// ── MODE 4 ──
function calcMode4() {
  const val = parseFloat(document.getElementById('m4-val').value);
  const pct = parseFloat(document.getElementById('m4-pct').value);
  if (isNaN(val) || isNaN(pct) || pct === 0) return hideResult(4);
  const result = (val / pct) * 100;
  const r = fmt(result);
  if (!r) return hideResult(4);
  document.getElementById('r4-value').textContent = r;
  document.getElementById('r4-eq').textContent = `${fmt(val)} is ${pct}% of ${r}`;
  document.getElementById('r4-formula').textContent = `Whole = (${fmt(val)} ÷ ${pct}) × 100\n      = ${r}`;
  showResult(4);
}
document.getElementById('m4-val').addEventListener('input', calcMode4);
document.getElementById('m4-pct').addEventListener('input', calcMode4);

// ── MODE 5 ──
function calcMode5() {
  const a = parseFloat(document.getElementById('m5-a').value);
  const b = parseFloat(document.getElementById('m5-b').value);
  if (isNaN(a) || isNaN(b) || (a === 0 && b === 0)) return hideResult(5);
  const diff = Math.abs(a - b);
  const avg = (Math.abs(a) + Math.abs(b)) / 2;
  if (avg === 0) return hideResult(5);
  const result = (diff / avg) * 100;
  const r = fmt(result);
  if (!r) return hideResult(5);
  document.getElementById('r5-value').textContent = r + '%';
  document.getElementById('r5-eq').textContent = `Difference between ${fmt(a)} and ${fmt(b)}`;
  document.getElementById('r5-formula').textContent = `% Diff = (|${fmt(a)} − ${fmt(b)}| ÷ avg(${fmt(a)}, ${fmt(b)})) × 100\n       = ${r}%`;
  showResult(5);
}
document.getElementById('m5-a').addEventListener('input', calcMode5);
document.getElementById('m5-b').addEventListener('input', calcMode5);