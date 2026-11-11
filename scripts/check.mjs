import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
const manifest = JSON.parse(await readFile('extension/manifest.json', 'utf8'));
assert.equal(manifest.manifest_version, 3);
assert.equal(manifest.name, 'YouTools');
assert.deepEqual(manifest.permissions, ['storage']);
assert.equal(manifest.host_permissions, undefined);
assert.deepEqual(manifest.background, { service_worker: 'background.js' });
assert.ok(manifest.externally_connectable.ids.every(id => /^[a-p]{32}$/.test(id)));
assert.equal(manifest.externally_connectable.matches, undefined);
for (const script of manifest.content_scripts) {
  assert.deepEqual(script.matches, ['https://www.youtube.com/*', 'https://youtube.com/*']);
  for (const file of [...script.js, ...script.css]) assert.ok((await stat(`extension/${file}`)).isFile());
}
for (const file of [manifest.action.default_popup, ...Object.values(manifest.icons)]) assert.ok((await stat(`extension/${file}`)).isFile());
for (const file of await readdir('extension')) {
  if (!file.endsWith('.js')) continue;
  const result = spawnSync(process.execPath, ['--check', `extension/${file}`], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
}
console.log('Manifest, least-privilege scope, assets, and JavaScript syntax verified.');
