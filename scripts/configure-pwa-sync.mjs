// Unpacked IDs depend on their full folder paths. For store builds, pass both
// assigned IDs: node scripts/configure-pwa-sync.mjs YOUTOOLS_ID PWA_CUSTOMIZER_ID
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
const paths = [resolve('extension'), resolve('../pwa customizer/extension')];
const idFor = path => createHash('sha256').update(path, process.platform === 'win32' ? 'utf16le' : 'utf8')
  .digest('hex').slice(0, 32).replace(/[0-9a-f]/g, digit => String.fromCharCode(97 + parseInt(digit, 16)));
const ids = process.argv.slice(2);
if (!ids.length) ids.push(...paths.map(idFor));
if (ids.length !== 2 || ids.some(id => !/^[a-p]{32}$/.test(id))) throw new Error('Provide both extension IDs, or no arguments for these unpacked folders.');
for (let i = 0; i < paths.length; i++) {
  const path = paths[i] + '/manifest.json';
  const manifest = JSON.parse(await readFile(path, 'utf8'));
  manifest.externally_connectable = { ids: [ids[1 - i]] };
  await writeFile(path, JSON.stringify(manifest, null, 2) + '\n');
}
console.log('Configured YouTools and PWA Customizer:', ids.join(' / '));
