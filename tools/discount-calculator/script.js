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
function fmt(n, currency = false) {
  if (n === null || isNaN(n) || !isFinite(n)) return null;
  const r = Math.round(n * 100) / 100;
  if (currency) return '₹' + r.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return r.toLocaleString('en-IN', { maximumFractionDigits: 2 });
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

function setBar(barId, discPct) {
  const clamped = Math.min(Math.max(discPct, 0), 100);
  document.getElementById(barId).style.width = clamped + '%';
}

function copyResult(elId, btn) {
  const text = document.getElementById(elId).textContent.replace(/[₹,\s]/g, '');
  navigator.clipboard.writeText(text).then(() => {
    btn.classList.add('copied');
    const orig = btn.innerHTML;
    btn.textContent = '✓ Copied!';
    setTimeout(() => { btn.classList.remove('copied'); btn.innerHTML = orig; }, 2000);
  });
}

// ── MODE 0: Sale Price ──
function calc0() {
  const price = parseFloat(document.getElementById('m0-price').value);
  const disc = parseFloat(document.getElementById('m0-disc').value);
  if (isNaN(price) || isNaN(disc)) return hideResult(0);
  const saved = (disc / 100) * price;
  const sale = price - saved;
  document.getElementById('r0-sale').textContent = fmt(sale, true);
  document.getElementById('r0-save').textContent = fmt(saved, true);
  document.getElementById('r0-eq').textContent = `${fmt(price, true)} − ${disc}% = ${fmt(sale, true)}`;
  setBar('r0-bar', disc);
  showResult(0);
}
document.getElementById('m0-price').addEventListener('input', calc0);
document.getElementById('m0-disc').addEventListener('input', calc0);

// ── MODE 1: You Save ──
function calc1() {
  const price = parseFloat(document.getElementById('m1-price').value);
  const disc = parseFloat(document.getElementById('m1-disc').value);
  if (isNaN(price) || isNaN(disc)) return hideResult(1);
  const saved = (disc / 100) * price;
  const pay = price - saved;
  document.getElementById('r1-save').textContent = fmt(saved, true);
  document.getElementById('r1-pay').textContent = fmt(pay, true);
  document.getElementById('r1-eq').textContent = `${disc}% of ${fmt(price, true)} = ${fmt(saved, true)} saved`;
  setBar('r1-bar', disc);
  showResult(1);
}
document.getElementById('m1-price').addEventListener('input', calc1);
document.getElementById('m1-disc').addEventListener('input', calc1);

// ── MODE 2: Original Price ──
function calc2() {
  const sale = parseFloat(document.getElementById('m2-sale').value);
  const disc = parseFloat(document.getElementById('m2-disc').value);
  if (isNaN(sale) || isNaN(disc) || disc >= 100) return hideResult(2);
  const orig = sale / (1 - disc / 100);
  const saved = orig - sale;
  document.getElementById('r2-orig').textContent = fmt(orig, true);
  document.getElementById('r2-save').textContent = fmt(saved, true);
  document.getElementById('r2-eq').textContent = `Sale ${fmt(sale, true)} after ${disc}% off → MRP was ${fmt(orig, true)}`;
  showResult(2);
}
document.getElementById('m2-sale').addEventListener('input', calc2);
document.getElementById('m2-disc').addEventListener('input', calc2);

// ── MODE 3: Discount % ──
function calc3() {
  const orig = parseFloat(document.getElementById('m3-orig').value);
  const sale = parseFloat(document.getElementById('m3-sale').value);
  if (isNaN(orig) || isNaN(sale) || orig === 0) return hideResult(3);
  const saved = orig - sale;
  const disc = (saved / orig) * 100;
  document.getElementById('r3-disc').textContent = fmt(disc) + '%';
  document.getElementById('r3-save').textContent = fmt(saved, true);
  document.getElementById('r3-eq').textContent = `${fmt(orig, true)} → ${fmt(sale, true)} = ${fmt(disc)}% off`;
  setBar('r3-bar', disc);
  showResult(3);
}
document.getElementById('m3-orig').addEventListener('input', calc3);
document.getElementById('m3-sale').addEventListener('input', calc3);

// ── MODE 4: Double Discount ──
function calc4() {
  const price = parseFloat(document.getElementById('m4-price').value);
  const d1 = parseFloat(document.getElementById('m4-d1').value);
  const d2 = parseFloat(document.getElementById('m4-d2').value);
  if (isNaN(price) || isNaN(d1) || isNaN(d2)) return hideResult(4);
  const after1 = price * (1 - d1 / 100);
  const after2 = after1 * (1 - d2 / 100);
  const saved = price - after2;
  const effDisc = (saved / price) * 100;
  document.getElementById('r4-final').textContent = fmt(after2, true);
  document.getElementById('r4-saved').textContent = fmt(saved, true);
  document.getElementById('r4-eff').textContent = fmt(effDisc) + '%';
  document.getElementById('r4-steps').innerHTML =
    `Step 1: ${fmt(price, true)} − ${d1}% = ${fmt(after1, true)}<br>` +
    `Step 2: ${fmt(after1, true)} − ${d2}% = ${fmt(after2, true)}<br>` +
    `<strong>Note: ${d1}% + ${d2}% ≠ ${fmt(effDisc)}% (discounts compound)</strong>`;
  document.getElementById('r4-eq').textContent = `Effective discount: ${fmt(effDisc)}% off original price`;
  showResult(4);
}
document.getElementById('m4-price').addEventListener('input', calc4);
document.getElementById('m4-d1').addEventListener('input', calc4);
document.getElementById('m4-d2').addEventListener('input', calc4);

// ── MODE 5: Best Deal ──
function calc5() {
  const products = [
    { name: 'Product A', price: parseFloat(document.getElementById('m5-a-price').value), disc: parseFloat(document.getElementById('m5-a-disc').value) },
    { name: 'Product B', price: parseFloat(document.getElementById('m5-b-price').value), disc: parseFloat(document.getElementById('m5-b-disc').value) },
    { name: 'Product C', price: parseFloat(document.getElementById('m5-c-price').value), disc: parseFloat(document.getElementById('m5-c-disc').value) },
  ];

  const valid = products.filter(p => !isNaN(p.price) && !isNaN(p.disc) && p.price > 0);
  if (valid.length < 2) return hideResult(5);

  valid.forEach(p => {
    p.sale = p.price * (1 - p.disc / 100);
    p.saved = p.price - p.sale;
    p.savePct = p.disc;
  });

  const winner = valid.reduce((a, b) => a.sale < b.sale ? a : b);

  document.getElementById('r5-winner').textContent = winner.name + ' — ' + fmt(winner.sale, true);
  document.getElementById('r5-eq').textContent = `Lowest final price after discount`;

  const table = document.getElementById('r5-table');
  table.innerHTML = valid.map(p => `
    <div class="deal-row-result ${p === winner ? 'winner' : ''}">
      <span class="deal-name">${p.name}</span>
      <span class="deal-price">${fmt(p.sale, true)} <small style="color:var(--text-soft);font-weight:500">(save ${fmt(p.saved, true)})</small></span>
      ${p === winner ? '<span class="deal-tag">Best Deal</span>' : ''}
    </div>
  `).join('');

  showResult(5);
}
['m5-a-price','m5-a-disc','m5-b-price','m5-b-disc','m5-c-price','m5-c-disc'].forEach(id => {
  document.getElementById(id).addEventListener('input', calc5);
});