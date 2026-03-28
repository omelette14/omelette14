/* ── State ── */
let currentQRData = null;
let currentStruttura = '';
let currentNumerocampo = '';

const BASE = 'https://lookatmesport.com';

/* ── URL preview ── */
['struttura', 'numerocampo'].forEach(id => {
  document.getElementById(id).addEventListener('input', updatePreview);
});

function updatePreview() {
  const s = document.getElementById('struttura').value.trim();
  const n = document.getElementById('numerocampo').value;
  const box = document.getElementById('urlBox');
  const text = document.getElementById('urlText');

  if (s || n) {
    text.textContent = `${BASE}/?struttura=${s || '*struttura*'}&numerocampo=${n || '*Ncampo*'}`;
    box.hidden = false;
  } else {
    box.hidden = true;
  }
}

/* ── Form submit ── */
document.getElementById('qrForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  currentStruttura = document.getElementById('struttura').value.trim();
  currentNumerocampo = document.getElementById('numerocampo').value;

  const url = `${BASE}/?struttura=${encodeURIComponent(currentStruttura)}&numerocampo=${currentNumerocampo}`;

  try {
    await generateQRWithLogo(url);

    const card = document.getElementById('previewCard');
    card.hidden = false;
    document.getElementById('previewMeta').innerHTML =
      `<strong>${escapeHtml(currentStruttura)}</strong> &mdash; Campo ${currentNumerocampo}`;

    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } catch (err) {
    console.error(err);
    showToast('Errore nella generazione del QR code', 'error');
  }
});

/* ── QR + logo generation ── */
async function generateQRWithLogo(url) {
  const canvas = document.getElementById('qrCanvas');
  const SIZE = 400;
  canvas.width = SIZE;
  canvas.height = SIZE;

  // Draw QR code onto canvas
  await QRCode.toCanvas(canvas, url, {
    errorCorrectionLevel: 'H',
    margin: 2,
    width: SIZE,
    color: { dark: '#000000', light: '#ffffff' }
  });

  const ctx = canvas.getContext('2d');

  // Calculate logo area (22% of QR size)
  const logoSize = Math.floor(SIZE * 0.22);
  const logoX = Math.floor((SIZE - logoSize) / 2);
  const logoY = Math.floor((SIZE - logoSize) / 2);
  const pad = 10;

  // White background behind logo
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(logoX - pad, logoY - pad, logoSize + pad * 2, logoSize + pad * 2);

  // Load and draw icon-only logo (no text)
  await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, logoX, logoY, logoSize, logoSize);
      resolve();
    };
    img.onerror = reject;
    img.src = '/logo-icon.svg';
  });

  currentQRData = canvas.toDataURL('image/png');
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
    if (res.ok) {
      showToast('QR code salvato nel database!', 'success');
      loadHistory();
    } else {
      showToast(data.error || 'Errore nel salvataggio', 'error');
    }
  } catch {
    showToast('Errore di connessione al server', 'error');
  }
}

/* ── Download PNG (client-side) ── */
function downloadPNG() {
  if (!currentQRData) return;
  const a = document.createElement('a');
  a.href = currentQRData;
  a.download = `QR_${currentStruttura}_campo${currentNumerocampo}.png`;
  a.click();
}

/* ── Download PDF (client-side) ── */
function downloadPDF() {
  if (!currentQRData) return;

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();

  // Black header bar
  doc.setFillColor(0, 0, 0);
  doc.rect(0, 0, pageW, 28, 'F');
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('LookAtMe Sport', pageW / 2, 18, { align: 'center' });

  // Details
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(currentStruttura, pageW / 2, 50, { align: 'center' });

  doc.setFontSize(13);
  doc.setFont('helvetica', 'normal');
  doc.text(`Campo ${currentNumerocampo}`, pageW / 2, 60, { align: 'center' });

  // URL
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  const url = `${BASE}/?struttura=${encodeURIComponent(currentStruttura)}&numerocampo=${currentNumerocampo}`;
  doc.text(url, pageW / 2, 70, { align: 'center' });

  // QR image
  const imgSize = 120;
  const imgX = (pageW - imgSize) / 2;
  doc.addImage(currentQRData, 'PNG', imgX, 80, imgSize, imgSize);

  // Footer
  const today = new Date().toLocaleDateString('it-IT', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  });
  doc.setFontSize(8);
  doc.setTextColor(160, 160, 160);
  doc.text(`Generato il ${today} — lookatmesport.com`, pageW / 2, 210, { align: 'center' });

  doc.save(`QR_${currentStruttura}_campo${currentNumerocampo}.pdf`);
}

/* ── Load history ── */
async function loadHistory() {
  try {
    const res = await fetch('/api/qrcodes');
    const list = await res.json();
    renderHistory(list);
  } catch {
    console.error('Impossibile caricare la cronologia');
  }
}

function renderHistory(list) {
  const el = document.getElementById('qrList');

  if (!list.length) {
    el.innerHTML = '<p class="empty">Nessun QR code salvato</p>';
    return;
  }

  el.innerHTML = `<div class="qr-grid">${list.map(qr => `
    <div class="qr-item" id="item-${qr.id}">
      <img
        src="/api/qrcodes/${qr.id}/image"
        alt="QR ${escapeHtml(qr.struttura)}"
        loading="lazy"
      >
      <div class="item-name">${escapeHtml(qr.struttura)}</div>
      <div class="item-campo">Campo ${qr.numerocampo}</div>
      <div class="item-date">${formatDate(qr.created_at)}</div>
      <div class="item-actions">
        <a
          href="/api/qrcodes/${qr.id}/png"
          download
          class="btn btn-outline btn-xs"
        >PNG</a>
        <a
          href="/api/qrcodes/${qr.id}/pdf"
          class="btn btn-outline btn-xs"
        >PDF</a>
        <button
          class="btn btn-danger btn-xs"
          onclick="deleteQR(${qr.id})"
        >Elimina</button>
      </div>
    </div>
  `).join('')}</div>`;
}

/* ── Delete ── */
async function deleteQR(id) {
  if (!confirm('Eliminare questo QR code dal database?')) return;

  try {
    const res = await fetch(`/api/qrcodes/${id}`, { method: 'DELETE' });
    if (res.ok) {
      showToast('QR code eliminato', 'success');
      loadHistory();
    } else {
      showToast('Errore nell\'eliminazione', 'error');
    }
  } catch {
    showToast('Errore di connessione', 'error');
  }
}

/* ── Helpers ── */
function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function formatDate(str) {
  return new Date(str).toLocaleDateString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

let toastTimer;
function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast ${type} show`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.className = 'toast'; }, 3500);
}

/* ── Init ── */
loadHistory();
