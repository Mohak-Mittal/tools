// ── STATE ──
const slabs = { m0: 5, m1: 5, m2: 5, m5: 18 };
let txType = 'intra';

// ── TABS ──
document.querySelectorAll('.mode-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.mode-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.calc-panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('panel-' + tab.dataset.mode).classList.add('active');
  });
});

// ── SLAB BUTTONS ──
document.querySelectorAll('.slab-btns').forEach(group => {
  group.querySelectorAll('.slab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      group.querySelectorAll('.slab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const key = group.id.replace('-slab', '');
      slabs[key] = parseFloat(btn.dataset.val);
      triggerCalc(key);
    });
  });
});

function triggerCalc(key) {
  if (key === 'm0') calc0();
  else if (key === 'm1') calc1();
  else if (key === 'm2') calc2();
  else if (key === 'm5') calc5();
}

// ── TRANSACTION TYPE (mode 2) ──
function setTxType(type) {
  txType = type;
  document.getElementById('m2-intra').classList.toggle('active', type === 'intra');
  document.getElementById('m2-inter').classList.toggle('active', type === 'inter');
  calc2();
}

// ── HELPERS ──
function fmt(n) {
  if (n === null || isNaN(n) || !isFinite(n)) return null;
  return '₹' + (Math.round(n * 100) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtN(n) {
  return (Math.round(n * 100) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
  const text = document.getElementById(elId).textContent.replace(/[₹,\s]/g, '');
  navigator.clipboard.writeText(text).then(() => {
    btn.classList.add('copied');
    const orig = btn.innerHTML;
    btn.textContent = '✓ Copied!';
    setTimeout(() => { btn.classList.remove('copied'); btn.innerHTML = orig; }, 2000);
  });
}

function breakdownHTML(base, gst, total, slab) {
  return `
    <div class="bd-row"><span>Base Price</span><span>${fmt(base)}</span></div>
    <div class="bd-row"><span>GST @ ${slab}%</span><span>${fmt(gst)}</span></div>
    <div class="bd-row bd-total"><span>Total Payable</span><span>${fmt(total)}</span></div>
  `;
}

// ── MODE 0: Add GST ──
function calc0() {
  const price = parseFloat(document.getElementById('m0-price').value);
  if (isNaN(price) || price <= 0) return hideResult(0);
  const slab = slabs.m0;
  const gst = (slab / 100) * price;
  const total = price + gst;
  document.getElementById('r0-gst').textContent = fmt(gst);
  document.getElementById('r0-total').textContent = fmt(total);
  document.getElementById('r0-breakdown').innerHTML = breakdownHTML(price, gst, total, slab);
  document.getElementById('r0-eq').textContent = `${fmt(price)} + ${slab}% GST = ${fmt(total)}`;
  showResult(0);
}
document.getElementById('m0-price').addEventListener('input', calc0);

// ── MODE 1: Remove GST ──
function calc1() {
  const inclusive = parseFloat(document.getElementById('m1-price').value);
  if (isNaN(inclusive) || inclusive <= 0) return hideResult(1);
  const slab = slabs.m1;
  const base = inclusive / (1 + slab / 100);
  const gst = inclusive - base;
  document.getElementById('r1-base').textContent = fmt(base);
  document.getElementById('r1-gst').textContent = fmt(gst);
  document.getElementById('r1-breakdown').innerHTML = `
    <div class="bd-row"><span>GST-Inclusive Price</span><span>${fmt(inclusive)}</span></div>
    <div class="bd-row"><span>GST @ ${slab}%</span><span>− ${fmt(gst)}</span></div>
    <div class="bd-row bd-total"><span>Base Price</span><span>${fmt(base)}</span></div>
  `;
  document.getElementById('r1-eq').textContent = `${fmt(inclusive)} ÷ (1 + ${slab}/100) = ${fmt(base)}`;
  showResult(1);
}
document.getElementById('m1-price').addEventListener('input', calc1);

// ── MODE 2: CGST / SGST Split ──
function calc2() {
  const price = parseFloat(document.getElementById('m2-price').value);
  if (isNaN(price) || price <= 0) return hideResult(2);
  const slab = slabs.m2;
  const totalGst = (slab / 100) * price;
  const total = price + totalGst;

  document.getElementById('r2-gst').textContent = fmt(totalGst);
  document.getElementById('r2-total').textContent = fmt(total);

  let splitHTML = '';
  if (txType === 'intra') {
    const half = totalGst / 2;
    splitHTML = `
      <div class="split-row"><span>Base Price</span><span class="split-val">${fmt(price)}</span></div>
      <div class="split-divider"></div>
      <div class="split-row"><span><span class="split-tag">CGST ${slab / 2}%</span></span><span class="split-val">${fmt(half)}</span></div>
      <div class="split-row"><span><span class="split-tag">SGST ${slab / 2}%</span></span><span class="split-val">${fmt(half)}</span></div>
      <div class="split-divider"></div>
      <div class="split-row"><strong>Total Payable</strong><span class="split-val">${fmt(total)}</span></div>
    `;
    document.getElementById('r2-eq').textContent = `Intra-State: CGST ${slab / 2}% + SGST ${slab / 2}% = ${slab}% total`;
  } else {
    splitHTML = `
      <div class="split-row"><span>Base Price</span><span class="split-val">${fmt(price)}</span></div>
      <div class="split-divider"></div>
      <div class="split-row igst"><span><span class="split-tag igst">IGST ${slab}%</span></span><span class="split-val">${fmt(totalGst)}</span></div>
      <div class="split-divider"></div>
      <div class="split-row"><strong>Total Payable</strong><span class="split-val">${fmt(total)}</span></div>
    `;
    document.getElementById('r2-eq').textContent = `Inter-State: IGST ${slab}% applied on base price`;
  }

  document.getElementById('r2-split').innerHTML = splitHTML;
  showResult(2);
}
document.getElementById('m2-price').addEventListener('input', calc2);

// ── MODE 3: Compare Slabs ──
function calc3() {
  const price = parseFloat(document.getElementById('m3-price').value);
  if (isNaN(price) || price <= 0) return hideResult(3);

  const allSlabs = [0, 0.1, 0.25, 1, 1.5, 3, 5, 7.5, 12, 18, 28];
  const rows = allSlabs.map(s => {
    const gst = (s / 100) * price;
    const total = price + gst;
    return `
      <div class="slab-row">
        <span class="slab-pct">${s}%</span>
        <span class="slab-gst">GST: ${fmt(gst)}</span>
        <span class="slab-total">${fmt(total)}</span>
      </div>
    `;
  }).join('');

  document.getElementById('r3-table').innerHTML = rows;
  showResult(3);
}
document.getElementById('m3-price').addEventListener('input', calc3);

// ── MODE 4: Multi-Item ──
function calc4() {
  const rows = document.querySelectorAll('#item-rows .item-row');
  let totalBase = 0, totalGst = 0;
  const tableRows = [];
  let hasAny = false;

  rows.forEach((row, i) => {
    const price = parseFloat(row.querySelector('.item-price').value);
    const slab = parseFloat(row.querySelector('.item-slab').value);
    if (isNaN(price) || price <= 0) return;
    hasAny = true;
    const gst = (slab / 100) * price;
    const total = price + gst;
    totalBase += price;
    totalGst += gst;
    tableRows.push(`
      <div class="multi-row">
        <span class="m-item">Item ${i + 1} (${slab}%)</span>
        <span class="m-gst">+${fmt(gst)}</span>
        <span class="m-total">${fmt(total)}</span>
      </div>
    `);
  });

  if (!hasAny) return hideResult(4);

  const grandTotal = totalBase + totalGst;
  tableRows.push(`
    <div class="multi-row multi-total">
      <span class="m-item">Grand Total</span>
      <span class="m-gst">GST: ${fmt(totalGst)}</span>
      <span class="m-total">${fmt(grandTotal)}</span>
    </div>
  `);

  document.getElementById('r4-gst').textContent = fmt(totalGst);
  document.getElementById('r4-total').textContent = fmt(grandTotal);
  document.getElementById('r4-eq').textContent = `Base: ${fmt(totalBase)} + GST: ${fmt(totalGst)} = ${fmt(grandTotal)}`;
  document.getElementById('r4-table').innerHTML = tableRows.join('');
  showResult(4);
}
document.querySelectorAll('#item-rows input, #item-rows select').forEach(el => {
  el.addEventListener('input', calc4);
  el.addEventListener('change', calc4);
});

// ── MODE 5: Invoice ──
function calc5() {
  const unitPrice = parseFloat(document.getElementById('m5-price').value);
  const qty = parseFloat(document.getElementById('m5-qty').value);
  if (isNaN(unitPrice) || isNaN(qty) || unitPrice <= 0 || qty <= 0) return hideResult(5);
  const slab = slabs.m5;
  const subtotal = unitPrice * qty;
  const gst = (slab / 100) * subtotal;
  const total = subtotal + gst;
  const halfGst = gst / 2;

  document.getElementById('r5-total').textContent = fmt(total);
  document.getElementById('r5-gst').textContent = fmt(gst);
  document.getElementById('r5-invoice').innerHTML = `
    <div class="inv-row"><span>Unit Price</span><span>${fmt(unitPrice)}</span></div>
    <div class="inv-row"><span>Quantity</span><span>${fmtN(qty)} units</span></div>
    <div class="inv-row"><span>Subtotal (before GST)</span><span>${fmt(subtotal)}</span></div>
    <div class="inv-row"><span>CGST @ ${slab / 2}%</span><span>${fmt(halfGst)}</span></div>
    <div class="inv-row"><span>SGST @ ${slab / 2}%</span><span>${fmt(halfGst)}</span></div>
    <div class="inv-row inv-total"><span>Invoice Total</span><span>${fmt(total)}</span></div>
  `;
  showResult(5);
}
document.getElementById('m5-price').addEventListener('input', calc5);
document.getElementById('m5-qty').addEventListener('input', calc5);