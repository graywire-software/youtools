import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { deflateRawSync } from 'node:zlib';
await import('./check.mjs');
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) { crc ^= byte; for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0); }
  return (crc ^ 0xffffffff) >>> 0;
}
async function files(dir, prefix = '') {
  const result = [];
  for (const item of await readdir(dir, { withFileTypes: true })) {
    const name = `${prefix}${item.name}`;
    if (item.isDirectory()) result.push(...await files(join(dir, item.name), `${name}/`));
    else result.push({ name, data: await readFile(join(dir, item.name)) });
  }
  return result;
}
const entries = await files('extension');
const local = [], central = [];
let offset = 0;
for (const { name, data } of entries) {
  const filename = Buffer.from(name);
  const compressed = deflateRawSync(data);
  const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50, 0); header.writeUInt16LE(20, 4);
  header.writeUInt16LE(8, 8); header.writeUInt16LE(33, 12);
  header.writeUInt32LE(crc32(data), 14); header.writeUInt32LE(compressed.length, 18);
  header.writeUInt32LE(data.length, 22); header.writeUInt16LE(filename.length, 26);
  local.push(header, filename, compressed);
  const directory = Buffer.alloc(46);
  directory.writeUInt32LE(0x02014b50, 0); directory.writeUInt16LE(20, 4);
  header.copy(directory, 6, 4, 30); directory.writeUInt32LE(offset, 42);
  central.push(directory, filename);
  offset += header.length + filename.length + compressed.length;
}
const centralData = Buffer.concat(central);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
end.writeUInt32LE(centralData.length, 12); end.writeUInt32LE(offset, 16);
const { version } = JSON.parse(await readFile('extension/manifest.json', 'utf8'));
await mkdir('dist', { recursive: true });
const target = `dist/YouTools-${version}.zip`;
await writeFile(target, Buffer.concat([...local, centralData, end]));
console.log(`Packaged ${entries.length} files → ${target}`);
