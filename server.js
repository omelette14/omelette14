const express = require('express');
const path = require('path');
const db = require('./db');
const PDFDocument = require('pdfkit');

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

/* ── Save QR code ── */
app.post('/api/save', (req, res) => {
  const { struttura, numerocampo, qrImage } = req.body;
  if (!struttura || !numerocampo || !qrImage) {
    return res.status(400).json({ error: 'Campi mancanti' });
  }

  const url = `https://lookatmesport.com/?struttura=${encodeURIComponent(struttura)}&numerocampo=${numerocampo}`;
  const id = db.insert(struttura, numerocampo, url, qrImage);

  res.json({ id, message: 'Salvato con successo' });
});

/* ── List all ── */
app.get('/api/qrcodes', (req, res) => {
  const list = db.all().map(({ id, struttura, numerocampo, url, created_at }) => ({
    id, struttura, numerocampo, url, created_at
  }));
  res.json(list);
});

/* ── Single record ── */
app.get('/api/qrcodes/:id', (req, res) => {
  const qr = db.getById(req.params.id);
  if (!qr) return res.status(404).json({ error: 'Non trovato' });
  res.json(qr);
});

/* ── Inline image (for thumbnails) ── */
app.get('/api/qrcodes/:id/image', (req, res) => {
  const qr = db.getById(req.params.id);
  if (!qr) return res.status(404).json({ error: 'Non trovato' });

  const b64 = qr.qr_image.replace(/^data:image\/png;base64,/, '');
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.send(Buffer.from(b64, 'base64'));
});

/* ── Download PNG ── */
app.get('/api/qrcodes/:id/png', (req, res) => {
  const qr = db.getById(req.params.id);
  if (!qr) return res.status(404).json({ error: 'Non trovato' });

  const b64 = qr.qr_image.replace(/^data:image\/png;base64,/, '');
  const filename = `QR_${qr.struttura}_campo${qr.numerocampo}.png`;

  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(Buffer.from(b64, 'base64'));
});

/* ── Download PDF ── */
app.get('/api/qrcodes/:id/pdf', (req, res) => {
  const qr = db.getById(req.params.id);
  if (!qr) return res.status(404).json({ error: 'Non trovato' });

  const doc = new PDFDocument({ size: 'A4', margin: 60 });
  const filename = `QR_${qr.struttura}_campo${qr.numerocampo}.pdf`;

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  doc.pipe(res);

  const pageW = doc.page.width;

  // Black header
  doc.rect(0, 0, pageW, 80).fill('#000000');
  doc.fontSize(26).font('Helvetica-Bold').fillColor('#ffffff')
    .text('LookAtMe Sport', 0, 26, { align: 'center', width: pageW });

  doc.fillColor('#000000');

  // Info
  doc.moveDown(3.5);
  doc.fontSize(20).font('Helvetica-Bold').text(qr.struttura, { align: 'center' });
  doc.fontSize(14).font('Helvetica').text(`Campo ${qr.numerocampo}`, { align: 'center' });

  // URL
  doc.moveDown(0.4);
  doc.fontSize(9).fillColor('#888888').text(qr.url, { align: 'center' });
  doc.fillColor('#000000');

  // QR image
  doc.moveDown(1.5);
  const imgW = 260;
  const imgX = (pageW - imgW) / 2;
  const imgY = doc.y;
  const b64 = qr.qr_image.replace(/^data:image\/png;base64,/, '');
  doc.image(Buffer.from(b64, 'base64'), imgX, imgY, { width: imgW });

  // Footer
  const date = new Date(qr.created_at).toLocaleDateString('it-IT', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  });
  doc.fontSize(8).fillColor('#aaaaaa')
    .text(
      `Generato il ${date} — lookatmesport.com`,
      60,
      doc.page.height - 50,
      { align: 'center', width: pageW - 120 }
    );

  doc.end();
});

/* ── Delete ── */
app.delete('/api/qrcodes/:id', (req, res) => {
  const deleted = db.delete(req.params.id);
  if (!deleted) return res.status(404).json({ error: 'Non trovato' });
  res.json({ message: 'Eliminato con successo' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n  LookAtMe Backoffice → http://localhost:${PORT}\n`);
});
