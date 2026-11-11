import { chromium } from './playwright.mjs';
import { mkdir, writeFile } from 'node:fs/promises';

await mkdir('test-results', { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.YOUTOOLS_BROWSER });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
try {
  await page.goto('https://www.youtube.com/watch?v=jNQXAC9IVRw', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('#movie_player', { timeout: 30000 });
  await page.waitForTimeout(4000);
  const info = await page.evaluate(() => {
    const player = document.getElementById('movie_player');
    return {
      title: document.title,
      controls: [...document.querySelectorAll('.ytp-right-controls button')].map(el => ({ cls: el.className, label: el.getAttribute('aria-label'), parent: el.parentElement.className })),
      methods: Object.getOwnPropertyNames(player).filter(k => /mini|pip|key|size/i.test(k)),
      mini: document.querySelector('.ytp-miniplayer-button')?.outerHTML,
      errors: Array.from(document.querySelectorAll('.ytp-error-content-wrap')).map(el => el.textContent),
      scripts: [...document.scripts].map(s => s.src).filter(s => /base.js/.test(s)),
      video: !!document.querySelector('video'),
      api: Object.getOwnPropertyNames(player).filter(k => /event|mini/i.test(k))
    };
  });
  await writeFile('test-results/youtube-dom.html', await page.content());
  await page.screenshot({ path: 'test-results/youtube.png' });
  console.log(JSON.stringify(info, null, 2));
  await page.evaluate(() => document.getElementById('movie_player').handleGlobalKeyDown(73, false, false, false, false, 'i', 'KeyI'));
  await page.waitForTimeout(1500);
  console.log('After miniplayer key', await page.evaluate(() => ({ url: location.href, mini: document.querySelector('ytd-miniplayer')?.outerHTML.slice(0, 450), player: document.getElementById('movie_player').className })));
  await page.evaluate(() => {
    const player = document.getElementById('movie_player');
    player.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2, clientX: 150, clientY: 150 }));
  });
  console.log('Context menu', await page.locator('.ytp-contextmenu').evaluate(el => el.outerHTML));
  console.log('Miniplayer page API', await page.evaluate(() => {
    const app = document.querySelector('ytd-app');
    const mini = document.querySelector('ytd-miniplayer');
    const methods = el => { const result = []; for (let p = el; p && p !== HTMLElement.prototype; p = Object.getPrototypeOf(p)) result.push(...Object.getOwnPropertyNames(p).filter(k => /mini|collapse|expand/i.test(k))); return result; };
    return { app: methods(app), mini: methods(mini) };
  }));
  await page.locator('.ytp-contextmenu .ytp-menuitem').filter({ hasText: /^Miniplayer$/ }).click();
  await page.waitForTimeout(1000);
  console.log('After miniplayer menu', await page.evaluate(() => ({ url: location.href, player: document.getElementById('movie_player').className, mini: document.querySelector('ytd-miniplayer')?.outerHTML.slice(0, 250) })));
} finally {
  await browser.close();
}
