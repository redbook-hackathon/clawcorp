import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import { deflateSync } from 'node:zlib';
import { getOpenClawResolvedDir } from './paths';

const require = createRequire(import.meta.url);
const openclawRequire = createRequire(join(getOpenClawResolvedDir(), 'package.json'));

function resolveOpenClawPackageJson(packageName: string): string {
  return openclawRequire.resolve(`${packageName}/package.json`);
}

const qrcodeTerminalPath = dirname(resolveOpenClawPackageJson('qrcode-terminal'));
const QRCode = require(join(qrcodeTerminalPath, 'vendor', 'QRCode', 'index.js'));
const QRErrorCorrectLevel = require(join(qrcodeTerminalPath, 'vendor', 'QRCode', 'QRErrorCorrectLevel.js'));

function createQrMatrix(input: string) {
  const qr = new QRCode(-1, QRErrorCorrectLevel.L);
  qr.addData(input);
  qr.make();
  return qr;
}

function fillPixel(
  buffer: Buffer,
  x: number,
  y: number,
  width: number,
  r: number,
  g: number,
  b: number,
  a = 255,
) {
  const index = (y * width + x) * 4;
  buffer[index] = r;
  buffer[index + 1] = g;
  buffer[index + 2] = b;
  buffer[index + 3] = a;
}

function createCrcTable() {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
}

const CRC_TABLE = createCrcTable();

function crc32(buffer: Buffer) {
  let crc = 0xffffffff;
  for (let index = 0; index < buffer.length; index += 1) {
    crc = CRC_TABLE[(crc ^ buffer[index]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer) {
  const typeBuffer = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crc = crc32(Buffer.concat([typeBuffer, data]));
  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crc, 0);
  return Buffer.concat([len, typeBuffer, data, crcBuffer]);
}

function encodePngRgba(buffer: Buffer, width: number, height: number) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let row = 0; row < height; row += 1) {
    const rawOffset = row * (stride + 1);
    raw[rawOffset] = 0;
    buffer.copy(raw, rawOffset + 1, row * stride, row * stride + stride);
  }
  const compressed = deflateSync(raw);
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', compressed),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

export function renderQrPngDataUrl(
  input: string,
  options: { scale?: number; marginModules?: number } = {},
): string {
  const { scale = 6, marginModules = 4 } = options;
  const qr = createQrMatrix(input);
  const modules = qr.getModuleCount();
  const size = (modules + marginModules * 2) * scale;
  const buffer = Buffer.alloc(size * size * 4, 255);

  for (let row = 0; row < modules; row += 1) {
    for (let col = 0; col < modules; col += 1) {
      if (!qr.isDark(row, col)) continue;
      const startX = (col + marginModules) * scale;
      const startY = (row + marginModules) * scale;
      for (let y = 0; y < scale; y += 1) {
        for (let x = 0; x < scale; x += 1) {
          fillPixel(buffer, startX + x, startY + y, size, 0, 0, 0, 255);
        }
      }
    }
  }

  const png = encodePngRgba(buffer, size, size);
  return `data:image/png;base64,${png.toString('base64')}`;
}
