// One-shot helper to generate solid-pink placeholder PNG icons.
// Run: node scripts/make-icons.cjs
// Replace public/icon-*.png with real artwork later — same filenames, no code changes needed.

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function crc32(buf) {
  const table = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = (table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8)) >>> 0;
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4); crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

// Solid color RGBA PNG with a slightly darker centered square as a "logo accent".
function makePng(size, bg, fg) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 2;   // color type RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const inner = Math.round(size * 0.42);
  const innerStart = Math.round((size - inner) / 2);
  const innerEnd = innerStart + inner;

  const rows = [];
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 3);
    row[0] = 0; // filter byte
    for (let x = 0; x < size; x++) {
      const isInner = x >= innerStart && x < innerEnd && y >= innerStart && y < innerEnd;
      const c = isInner ? fg : bg;
      row[1 + x * 3]     = c[0];
      row[1 + x * 3 + 1] = c[1];
      row[1 + x * 3 + 2] = c[2];
    }
    rows.push(row);
  }
  const raw = Buffer.concat(rows);
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

// Wade pink palette
const bg = [245, 184, 200]; // soft pink
const fg = [217, 130, 154]; // accent pink

const out = path.join(__dirname, '..', 'public');
fs.mkdirSync(out, { recursive: true });

const targets = [
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['apple-touch-icon.png', 180],
  ['icon-maskable-512.png', 512],
];
for (const [name, size] of targets) {
  fs.writeFileSync(path.join(out, name), makePng(size, bg, fg));
  console.log('wrote', name, size + 'x' + size);
}
