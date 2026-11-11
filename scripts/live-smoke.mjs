import { chromium } from './playwright.mjs';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
const profile = await mkdtemp(join(tmpdir(), 'youtools-live-'));
const extension = resolve('extension');
const context = await chromium.launchPersistentContext(profile, {
  headless: true, executablePath: process.env.YOUTOOLS_BROWSER,
  channel: process.env.YOUTOOLS_BROWSER ? undefined : 'chromium',
  args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
  viewport: { width: 1440, height: 1000 }
});
const results = { browser: await context.browser().version() };
try {
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => { if (error.stack?.includes('chrome-extension://')) errors.push(error.message); });
  console.log('Opening live YouTube');
  await page.goto('https://www.youtube.com/watch?v=jNQXAC9IVRw', { waitUntil: 'domcontentloaded', timeout: 60000 });
  console.log('Loaded', await page.title());
  await page.locator('.youtools-pip-button').waitFor({ state: 'attached', timeout: 30000 });
  console.log('Extension controls attached');
  await page.waitForTimeout(1500);
  results.order = await page.locator('.ytp-size-button').evaluate(el => [el.previousElementSibling.previousElementSibling.className, el.previousElementSibling.className, el.className]);
  await mkdir('test-results', { recursive: true });
  await page.screenshot({ path: 'test-results/live-before.png' });
  const body = await page.locator('body').innerText();
  if (/Sign in to confirm|not a bot/.test(body)) {
    results.playbackLimitation = 'YouTube requires sign-in/bot verification in the fresh test profile. Live playback and Miniplayer interaction were not tested in this run.';
  } else {
    await page.locator('#movie_player').hover();
    await page.locator('#movie_player').click({ position: { x: 200, y: 160 } });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'test-results/live-player.png' });
    await page.locator('.youtools-mini-button').click();
    await page.waitForFunction(() => document.getElementById('movie_player')?.classList.contains('ytp-player-minimized'), null, { timeout: 10000 });
    results.nativeMiniplayer = true;
    results.miniplayerURL = page.url();
    await page.screenshot({ path: 'test-results/live-miniplayer.png' });
  }
  await page.goto('https://www.youtube.com/results?search_query=shorts', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  results.search = await page.evaluate(() => ({ hidden: [...document.querySelectorAll('[data-youtools-hidden]')].reduce((acc, el) => { const k=el.getAttribute('data-youtools-hidden');acc[k]=(acc[k]||0)+1;return acc; }, {}), visibleNormalVideos: [...document.querySelectorAll('ytd-video-renderer,yt-lockup-view-model')].filter(el => !el.closest('[data-youtools-hidden]')).length }));
  results.extensionErrors = errors;
  await page.screenshot({ path: 'test-results/live-search.png' });
  await writeFile('test-results/live-search.html', await page.content());
  await writeFile('test-results/live-smoke.json', JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
} finally { await context.close(); await rm(profile, { recursive: true, force: true, maxRetries: 5 }); }
