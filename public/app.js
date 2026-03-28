/* ══════════════════════════════════════════════
   LookAtMe Backoffice — app.js
   Artistic QR: circular dots + logo watermark
   ══════════════════════════════════════════════ */

let currentQRData    = null;
let currentStruttura = '';
let currentNumerocampo = '';
let logoImage        = null;   // the real SVG loaded as Image

const BASE = 'https://lookatmesport.com';

/* ── Load real SVG logo ── */
async function loadLogo() {
  return new Promise(resolve => {
    const img = new Image();
    img.onload  = () => { logoImage = img; resolve(); };
    img.onerror = () => resolve();          // still works without logo
    img.src = '/logo.svg';
  });
}

/* ── URL preview ── */
['struttura', 'numerocampo'].forEach(id => {
  document.getElementById(id).addEventListener('input', updatePreview);
});

function updatePreview() {
  const s = document.getElementById('struttura').value.trim();
  const n = document.getElementById('numerocampo').value;
  const box  = document.getElementById('urlBox');
  const text = document.getElementById('urlText');
  if (s || n) {
    text.textContent = `${BASE}/?struttura=${s || '*struttura*'}&numerocampo=${n || '*Ncampo*'}`;
    box.hidden = false;
  } else {
    box.hidden = true;
  }
}

/* ── Form submit ── */
document.getElementById('qrForm').addEventListener('submit', async e => {
  e.preventDefault();
  currentStruttura   = document.getElementById('struttura').value.trim();
  currentNumerocampo = document.getElementById('numerocampo').value;

  const btn = e.target.querySelector('button[type="submit"]');
  btn.textContent = 'Generazione in corso…';
  btn.disabled = true;

  try {
    await generateArtisticQR(currentStruttura, currentNumerocampo);

    const card = document.getElementById('previewCard');
    card.hidden = false;
    document.getElementById('previewMeta').innerHTML =
      `<strong>${escapeHtml(currentStruttura)}</strong> &mdash; Campo ${currentNumerocampo}`;
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } catch (err) {
    console.error('QR generation error:', err);
    showToast('Errore nella generazione del QR code', 'error');
  } finally {
    btn.textContent = 'Genera QR Code';
    btn.disabled = false;
  }
});

/* ══════════════════════════════════════════
   ARTISTIC QR RENDERER
   1. Fetch matrix data from server
   2. White canvas
   3. Logo as faint stippled watermark
   4. QR modules as circular dots
   5. Prominent logo in center
   ══════════════════════════════════════════ */
async function generateArtisticQR(struttura, numerocampo) {
  const res = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ struttura, numerocampo: parseInt(numerocampo, 10) })
  });
  if (!res.ok) throw new Error((await res.json()).error || 'Server error');
  const { matrix, size } = await res.json();

  await renderArtisticQR(matrix, size);
  currentQRData = document.getElementById('qrCanvas').toDataURL('image/png');
}

async function renderArtisticQR(matrix, size) {
  const canvas = document.getElementById('qrCanvas');
  const S = 500;                              // canvas size px
  canvas.width  = S;
  canvas.height = S;
  const ctx = canvas.getContext('2d');

  /* 1 ── White background */
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, S, S);

  /* 2 ── Logo as faint watermark covering the whole QR area
          Draw it lightly so the dots appear to emerge from it */
  if (logoImage) {
    // Soft outer glow: scale logo to cover most of the canvas
    const logoW = S * 0.72;
    const logoH = logoW * (logoImage.naturalHeight / logoImage.naturalWidth);
    const lx = (S - logoW) / 2;
    const ly = (S - logoH) / 2;

    ctx.globalAlpha = 0.09;
    ctx.drawImage(logoImage, lx, ly, logoW, logoH);
    ctx.globalAlpha = 1.0;
  }

  /* 3 ── QR dots as circles with subtle radial gradient */
  const margin     = 2;                       // quiet zone in modules
  const cellSize   = S / (size + margin * 2);
  const offset     = margin * cellSize;
  const dotRadius  = cellSize * 0.44;         // slightly < half cell → gap between dots

  // Radial gradient: slightly lighter in center, pure black at edges
  const grad = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S * 0.65);
  grad.addColorStop(0,   '#1a1a1a');
  grad.addColorStop(0.6, '#0a0a0a');
  grad.addColorStop(1,   '#000000');

  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (matrix[row * size + col]) {
        const cx = offset + col * cellSize + cellSize / 2;
        const cy = offset + row * cellSize + cellSize / 2;
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, dotRadius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  /* 4 ── Center logo overlay — white rounded bg + real logo */
  const logoSize  = Math.floor(S * 0.21);
  const logoX     = Math.floor((S - logoSize) / 2);
  const logoY     = Math.floor((S - logoSize) / 2);
  const pad       = 11;

  // White rounded rectangle
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  roundRect(ctx, logoX - pad, logoY - pad, logoSize + pad * 2, logoSize + pad * 2, 9);
  ctx.fill();

  // Thin border
  ctx.strokeStyle = 'rgba(0,0,0,0.08)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  roundRect(ctx, logoX - pad, logoY - pad, logoSize + pad * 2, logoSize + pad * 2, 9);
  ctx.stroke();

  if (logoImage) {
    ctx.drawImage(logoImage, logoX, logoY, logoSize, logoSize);
  }
}

/* polyfill for ctx.roundRect (Safari < 15.4 / older Edge) */
function roundRect(ctx, x, y, w, h, r) {
  if (ctx.roundRect) {
    ctx.roundRect(x, y, w, h, r);
  } else {
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }
}

/* ── Save to database ── */
async function saveQR() {
  if (!currentQRData) return;
  try {
    const res = await fetch('/api/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        struttura: currentStruttura,
        numerocampo: parseInt(currentNumerocampo, 10),
        qrImage: currentQRData
      })
    });
    const data = await res.json();
    if (res.ok) { showToast('QR code salvato!', 'success'); loadHistory(); }
    else          showToast(data.error || 'Errore nel salvataggio', 'error');
  } catch { showToast('Errore di connessione', 'error'); }
}

/* ── Download PNG ── */
function downloadPNG() {
  if (!currentQRData) return;
  const a = document.createElement('a');
  a.href     = currentQRData;
  a.download = `QR_${currentStruttura}_campo${currentNumerocampo}.png`;
  a.click();
}

/* ── Download PDF (client-side jsPDF) ── */
function downloadPDF() {
  if (!currentQRData) return;
  const { jsPDF } = window.jspdf;
  const doc   = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();

  doc.setFillColor(0, 0, 0);
  doc.rect(0, 0, pageW, 28, 'F');
  doc.setFontSize(16).setFont('helvetica', 'bold').setTextColor(255, 255, 255);
  doc.text('LookAtMe Sport', pageW / 2, 18, { align: 'center' });

  doc.setTextColor(0, 0, 0).setFontSize(18).setFont('helvetica', 'bold');
  doc.text(currentStruttura, pageW / 2, 50, { align: 'center' });
  doc.setFontSize(13).setFont('helvetica', 'normal');
  doc.text(`Campo ${currentNumerocampo}`, pageW / 2, 60, { align: 'center' });

  doc.setFontSize(8).setTextColor(120, 120, 120);
  const url = `${BASE}/?struttura=${encodeURIComponent(currentStruttura)}&numerocampo=${currentNumerocampo}`;
  doc.text(url, pageW / 2, 70, { align: 'center' });

  const imgSize = 130;
  doc.addImage(currentQRData, 'PNG', (pageW - imgSize) / 2, 78, imgSize, imgSize);

  doc.setFontSize(8).setTextColor(160, 160, 160);
  doc.text(
    `Generato il ${new Date().toLocaleDateString('it-IT')} — lookatmesport.com`,
    pageW / 2, 215, { align: 'center' }
  );
  doc.save(`QR_${currentStruttura}_campo${currentNumerocampo}.pdf`);
}

/* ── History ── */
async function loadHistory() {
  try {
    const list = await (await fetch('/api/qrcodes')).json();
    renderHistory(list);
  } catch { console.error('Impossibile caricare la cronologia'); }
}

function renderHistory(list) {
  const el = document.getElementById('qrList');
  if (!list.length) { el.innerHTML = '<p class="empty">Nessun QR code salvato</p>'; return; }
  el.innerHTML = `<div class="qr-grid">${list.map(qr => `
    <div class="qr-item" id="item-${qr.id}">
      <img src="/api/qrcodes/${qr.id}/image" alt="QR ${escapeHtml(qr.struttura)}" loading="lazy">
      <div class="item-name">${escapeHtml(qr.struttura)}</div>
      <div class="item-campo">Campo ${qr.numerocampo}</div>
      <div class="item-date">${formatDate(qr.created_at)}</div>
      <div class="item-actions">
        <a href="/api/qrcodes/${qr.id}/png" download class="btn btn-outline btn-xs">PNG</a>
        <a href="/api/qrcodes/${qr.id}/pdf" class="btn btn-outline btn-xs">PDF</a>
        <button class="btn btn-danger btn-xs" onclick="deleteQR(${qr.id})">Elimina</button>
      </div>
    </div>`).join('')}</div>`;
}

async function deleteQR(id) {
  if (!confirm('Eliminare questo QR code?')) return;
  try {
    const res = await fetch(`/api/qrcodes/${id}`, { method: 'DELETE' });
    if (res.ok) { showToast('Eliminato', 'success'); loadHistory(); }
    else          showToast("Errore nell'eliminazione", 'error');
  } catch { showToast('Errore di connessione', 'error'); }
}

/* ── Helpers ── */
function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function formatDate(str) {
  return new Date(str).toLocaleDateString('it-IT', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

let toastTimer;
function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent  = msg;
  t.className    = `toast ${type} show`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.className = 'toast'; }, 3500);
}

/* ── Init ── */
(async () => {
  await loadLogo();
  // update header img once logo is ready
  if (logoImage) {
    document.getElementById('headerLogo').src = logoImage.src;
  }
  loadHistory();
})();
