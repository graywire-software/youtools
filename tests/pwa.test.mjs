import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, cp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { chromium } from '../scripts/playwright.mjs';

const key = 'site:https://www.youtube.com';
const alias = 'site:https://youtube.com';
const html = '<!doctype html><html><head><title>Video title - YouTube</title><meta name="theme-color" content="#FFFFFF"></head><body>YT fixture</body></html>';
let temp, context, manager, youtube, aliasPage, ytPopup, pwaPopup, ytId, pwaId;
const errors = [];
const idFor = path => createHash('sha256').update(path, process.platform === 'win32' ? 'utf16le' : 'utf8')
  .digest('hex').slice(0, 32).replace(/[0-9a-f]/g, digit => String.fromCharCode(97 + parseInt(digit, 16)));
const storage = (popup, keys = [key, alias, 'youtubePwaSync']) => popup.evaluate(keys => chrome.storage.local.get(keys), keys);
const worker = id => context.serviceWorkers().find(worker => worker.url() === `chrome-extension://${id}/background.js`);
const enable = (id, enabled) => manager.evaluate(({ id, enabled }) => new Promise((resolve, reject) =>
  chrome.management.setEnabled(id, enabled, () => chrome.runtime.lastError ? reject(new Error(chrome.runtime.lastError.message)) : resolve())), { id, enabled });
async function saved() { return (await storage(ytPopup))[key]; }
async function settle(expected) {
  await ytPopup.waitForFunction(({ key, expected }) => chrome.storage.local.get(key).then(value =>
    Object.entries(expected).every(([name, wanted]) => value[key]?.[name] === wanted)), { key, expected });
  await pwaPopup.waitForFunction(({ key, expected }) => chrome.storage.local.get(key).then(value =>
    Object.entries(expected).every(([name, wanted]) => value[key]?.[name] === wanted)), { key, expected });
}
async function saveYouTools(settings) {
  const response = await ytPopup.evaluate(settings => chrome.runtime.sendMessage({ type: 'youtube-pwa-save', settings }), settings);
  assert.equal(response.ok, true, JSON.stringify(response));
}
async function theme(color) {
  await youtube.waitForFunction(color => document.querySelector('meta[name="theme-color"]')?.content === color, color);
}
before(async () => {
  temp = await mkdtemp(join(tmpdir(), 'youtools-pwa-test-'));
  const ytPath = join(temp, 'youtools'), pwaPath = join(temp, 'pwa');
  await cp(resolve('extension'), ytPath, { recursive: true });
  await cp(resolve('../pwa customizer/extension'), pwaPath, { recursive: true });
  ytId = idFor(ytPath); pwaId = idFor(pwaPath);
  for (const [path, peer] of [[ytPath, pwaId], [pwaPath, ytId]]) {
    const manifest = JSON.parse(await readFile(join(path, 'manifest.json'), 'utf8'));
    manifest.externally_connectable = { ids: [peer] };
    if (path === pwaPath) manifest.host_permissions = ['https://www.youtube.com/*', 'https://youtube.com/*'];
    await writeFile(join(path, 'manifest.json'), JSON.stringify(manifest));
  }
  context = await chromium.launchPersistentContext(join(temp, 'profile'), {
    headless: true, executablePath: process.env.YOUTOOLS_BROWSER,
    channel: process.env.YOUTOOLS_BROWSER ? undefined : 'chromium',
    args: [`--disable-extensions-except=${ytPath},${pwaPath}`, `--load-extension=${ytPath},${pwaPath}`],
    viewport: { width: 1000, height: 800 }
  });
  context.on('page', page => page.on('pageerror', error => errors.push(error.message)));
  await context.route(/^https:\/\/(www\.)?youtube\.com\//, route => route.fulfill({ contentType: 'text/html', body: html }));
  manager = await context.newPage(); await manager.goto('chrome://extensions/');
  await manager.waitForFunction(() => chrome.developerPrivate);
  ytPopup = await context.newPage(); await ytPopup.goto(`chrome-extension://${ytId}/popup.html`);
  await ytPopup.locator('#menus:not([disabled])').waitFor();
  await ytPopup.locator('#pwa-settings:not([disabled])').waitFor({ state: 'attached' });
  await ytPopup.getByRole('button', { name: 'Customize app window' }).click();
  youtube = await context.newPage(); await youtube.goto('https://www.youtube.com/watch?v=pwa-test');
  aliasPage = await context.newPage(); await aliasPage.goto('https://youtube.com/');
  pwaPopup = await context.newPage();
  await pwaPopup.addInitScript(() => {
    const query = chrome.tabs.query.bind(chrome.tabs);
    chrome.tabs.query = args => args.active && args.currentWindow
      ? query({ url: 'https://www.youtube.com/*' }).then(tabs => tabs.slice(0, 1)) : query(args);
  });
  await pwaPopup.goto(`chrome-extension://${pwaId}/popup.html`);
  await pwaPopup.locator('#enabled:not([disabled])').waitFor();
});
after(async () => {
  await context?.close();
  if (temp) { assert.equal(dirname(temp), tmpdir()); await rm(temp, { recursive: true, force: true, maxRetries: 5 }); }
});

test('PWA settings start off and valid UI edits mirror both extensions and YouTube origins', async () => {
  assert.equal(await ytPopup.locator('#pwa-enabled').isChecked(), false);
  assert.equal(await ytPopup.locator('#pwa-title-enabled').isChecked(), false);
  assert.equal(await youtube.title(), 'Video title - YouTube');
  assert.equal(await youtube.locator('[data-pwa-recolor]').count(), 0);
  await ytPopup.locator('#pwa-enabled').check(); await theme('#202124');
  await settle({ enabled: true, mode: 'dark' });
  assert.equal(await pwaPopup.locator('#enabled').isChecked(), true);
  await ytPopup.locator('#pwa-mode').selectOption('custom');
  await ytPopup.locator('#pwa-hex').fill(' abc ');
  await ytPopup.locator('#pwa-apply-color').click();
  await theme('#AABBCC'); await settle({ color: '#AABBCC' });
  assert.equal(await ytPopup.locator('#pwa-hex').inputValue(), '#AABBCC');
  await ytPopup.locator('#pwa-hex').fill('red; color: transparent');
  await ytPopup.locator('#pwa-apply-color').click();
  assert.equal(await ytPopup.locator('#pwa-hex').getAttribute('aria-invalid'), 'true');
  assert.equal((await saved()).color, '#AABBCC');
  await ytPopup.locator('#pwa-hex').fill('#AABBCC');
  await ytPopup.locator('#pwa-title-enabled').check();
  await youtube.waitForFunction(() => document.title === 'YouTube');
  await ytPopup.locator('#pwa-title-mode').selectOption('custom');
  await ytPopup.locator('#pwa-title').fill('  My   <YT> & videos  ');
  await ytPopup.locator('#pwa-title').press('Enter');
  await youtube.waitForFunction(() => document.title === 'My <YT> & videos');
  await settle({ title: 'My <YT> & videos', titleEnabled: true, titleMode: 'custom' });
  await aliasPage.waitForFunction(() => document.title === 'My <YT> & videos');
  assert.equal(await youtube.locator('meta[data-pwa-recolor]').count(), 1, 'one DOM owner');
  assert.equal(await youtube.locator('meta[data-youtools-pwa]').count(), 1);
  const values = await storage(pwaPopup);
  assert.deepEqual(values[key], values[alias]);
  assert.equal(await pwaPopup.locator('#page-title').inputValue(), 'My <YT> & videos');
  await ytPopup.setViewportSize({ width: 370, height: 600 });
  await ytPopup.screenshot({ path: 'test-results/pwa-popup-0.6.1.png' });
  assert.equal(await ytPopup.evaluate(() => document.documentElement.scrollWidth), 370);
});

test('PWA Customizer edits mirror back; disabling restores the latest native title and color', async () => {
  await pwaPopup.locator('input[name="mode"][value="light"]').click();
  await theme('#F5F5F5'); await settle({ mode: 'light' });
  await pwaPopup.locator('#page-title').fill('Saved in PWA Customizer');
  await pwaPopup.locator('#apply-title').click();
  await youtube.waitForFunction(() => document.title === 'Saved in PWA Customizer');
  await settle({ title: 'Saved in PWA Customizer' });
  await youtube.evaluate(() => {
    document.title = 'Next video - YouTube';
    document.querySelector('meta[name="theme-color"]:not([data-pwa-recolor])').content = '#123456';
  });
  await youtube.waitForFunction(() => document.title === 'Saved in PWA Customizer');
  await pwaPopup.locator('#title-enabled').click();
  await youtube.waitForFunction(() => document.title === 'Next video - YouTube');
  await pwaPopup.locator('#enabled').click(); await theme('#123456');
  await settle({ enabled: false, titleEnabled: false });
  assert.equal(await youtube.locator('meta[data-pwa-recolor]').count(), 0);
  assert.equal((await saved()).title, 'Saved in PWA Customizer', 'disabled text is retained');
});

test('simultaneous saves converge, stale records cannot overwrite them, and unrelated sites remain private', async () => {
  const previous = (await storage(pwaPopup)).youtubePwaSync;
  await pwaPopup.evaluate(() => chrome.storage.local.set({ 'site:https://example.com': { enabled: true, color: '#FF0000' } }));
  const base = await saved();
  await Promise.all([
    saveYouTools({ ...base, titleEnabled: true, title: 'YouTools edit' }),
    pwaPopup.evaluate(settings => chrome.runtime.sendMessage({ type: 'save-site', origin: 'https://www.youtube.com', settings }),
      { ...base, titleEnabled: true, title: 'Companion edit' })
  ]);
  await ytPopup.evaluate(() => chrome.runtime.sendMessage({ type: 'youtube-pwa-refresh' }));
  assert.deepEqual((await storage(ytPopup))[key], (await storage(pwaPopup))[key]);
  const latest = await saved();
  await worker(pwaId).evaluate(({ id, record }) => chrome.runtime.sendMessage(id, { type: 'youtube-pwa-sync-v1', record }), { id: ytId, record: previous });
  assert.deepEqual(await saved(), latest);
  assert.equal((await storage(ytPopup, ['site:https://example.com']))['site:https://example.com'], undefined);
  // An allowed extension's popup is still not allowed to impersonate its worker.
  const rejected = await pwaPopup.evaluate(({ id, record }) => chrome.runtime.sendMessage(id, { type: 'youtube-pwa-sync-v1', record }).catch(() => null), { id: ytId, record: previous });
  assert.equal(rejected == null, true);
  assert.equal(await youtube.evaluate(() => typeof chrome.runtime?.sendMessage), 'undefined');
});

test('YouTools works alone, reconnects after companion downtime, and Reset mirrors defaults', async () => {
  await pwaPopup.close();
  await enable(pwaId, false);
  const base = await saved();
  await saveYouTools({ ...base, enabled: true, mode: 'custom', color: '#112233', titleEnabled: true, title: 'While companion is disabled' });
  await youtube.reload(); await theme('#112233');
  await youtube.waitForFunction(() => document.title === 'While companion is disabled');
  await enable(pwaId, true);
  pwaPopup = await context.newPage(); await pwaPopup.goto(`chrome-extension://${pwaId}/popup.html`);
  await ytPopup.evaluate(() => chrome.runtime.sendMessage({ type: 'youtube-pwa-refresh' }));
  await settle({ title: 'While companion is disabled', color: '#112233' });
  await ytPopup.getByRole('button', { name: 'Reset', exact: true }).click();
  await settle({ enabled: false, titleEnabled: false, title: '', mode: 'dark' });
  await youtube.waitForFunction(() => document.title === 'Video title - YouTube');
  await theme('#FFFFFF');
  assert.equal(await youtube.locator('meta[data-pwa-recolor]').count(), 0);
  assert.deepEqual(errors, []);
});

test('PWA Customizer still applies YouTube settings when YouTools is disabled', async () => {
  await ytPopup.close();
  await enable(ytId, false);
  const settings = { enabled: true, mode: 'dark', color: '#202124', titleEnabled: true, titleMode: 'short', title: '' };
  const result = await pwaPopup.evaluate(settings => chrome.runtime.sendMessage({ type: 'save-site', origin: 'https://www.youtube.com', settings }), settings);
  assert.equal(result.ok, true, JSON.stringify(result));
  await youtube.reload();
  await theme('#202124');
  await youtube.waitForFunction(() => document.title === 'YouTube');
  assert.equal(await youtube.locator('meta[data-pwa-recolor]').count(), 1);
  assert.equal(await youtube.locator('meta[data-youtools-pwa]').count(), 0);
});

test('existing PWA preferences migrate into untouched YouTools without granting companion website access', async () => {
  await context.close();
  const ytPath = join(temp, 'youtools'), pwaPath = join(temp, 'pwa');
  const manifest = JSON.parse(await readFile(join(pwaPath, 'manifest.json'), 'utf8'));
  delete manifest.host_permissions;
  await writeFile(join(pwaPath, 'manifest.json'), JSON.stringify(manifest));
  context = await chromium.launchPersistentContext(join(temp, 'no-grants-profile'), {
    headless: true, executablePath: process.env.YOUTOOLS_BROWSER,
    channel: process.env.YOUTOOLS_BROWSER ? undefined : 'chromium',
    args: [`--disable-extensions-except=${ytPath},${pwaPath}`, `--load-extension=${ytPath},${pwaPath}`]
  });
  await context.route('https://www.youtube.com/**', route => route.fulfill({ contentType: 'text/html', body: html }));
  pwaPopup = await context.newPage();
  await pwaPopup.addInitScript(() => {
    const query = chrome.tabs.query.bind(chrome.tabs);
    chrome.tabs.query = args => args.active && args.currentWindow
      ? Promise.resolve([{ url: 'https://www.youtube.com/', id: 999 }]) : query(args);
  });
  await pwaPopup.goto(`chrome-extension://${pwaId}/popup.html`);
  assert.equal(await pwaPopup.evaluate(() => chrome.permissions.contains({ origins: ['https://www.youtube.com/*'] })), false);
  // Before 1.2, a saved title had no separate titleEnabled/titleMode fields.
  await pwaPopup.evaluate(key => chrome.storage.local.set({ [key]: { enabled: true, mode: 'custom', color: '#145678', title: 'Existing app name' } }), key);
  ytPopup = await context.newPage(); await ytPopup.goto(`chrome-extension://${ytId}/popup.html`);
  await settle({ enabled: true, color: '#145678', title: 'Existing app name', titleEnabled: true, titleMode: 'custom' });
  youtube = await context.newPage(); await youtube.goto('https://www.youtube.com/watch?v=legacy');
  await theme('#145678'); await youtube.waitForFunction(() => document.title === 'Existing app name');
  await saveYouTools({ ...await saved(), color: '#987654', title: 'Mirrored without a grant' });
  await settle({ color: '#987654', title: 'Mirrored without a grant' });
  await pwaPopup.reload(); await pwaPopup.locator('#enabled:not([disabled])').waitFor();
  assert.equal(await pwaPopup.locator('#enabled').isChecked(), true);
  assert.equal(await pwaPopup.locator('#page-title').inputValue(), 'Mirrored without a grant');
  assert.equal(await pwaPopup.evaluate(() => chrome.permissions.contains({ origins: ['https://www.youtube.com/*'] })), false);
});
