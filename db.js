const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'qrcodes.json');

function read() {
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch {
    return { nextId: 1, records: [] };
  }
}

function write(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
}

const db = {
  insert(struttura, numerocampo, url, qrImage) {
    const data = read();
    const record = {
      id: data.nextId++,
      struttura,
      numerocampo,
      url,
      qr_image: qrImage,
      created_at: new Date().toISOString()
    };
    data.records.push(record);
    write(data);
    return record.id;
  },

  all() {
    return read().records.slice().reverse(); // newest first
  },

  getById(id) {
    return read().records.find(r => r.id === Number(id)) || null;
  },

  delete(id) {
    const data = read();
    const before = data.records.length;
    data.records = data.records.filter(r => r.id !== Number(id));
    write(data);
    return data.records.length < before;
  }
};

module.exports = db;
