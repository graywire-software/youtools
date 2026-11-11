import { chromium } from './playwright.mjs';
const browser = await chromium.launch({ headless: true, executablePath: process.env.YOUTOOLS_BROWSER });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  if (process.argv.includes('--inspect-debugging')) {
    await page.goto('brave://inspect/#remote-debugging');
    console.log(await page.locator('body').innerText());
    await browser.close();
    process.exit(0);
  }
  await page.goto('https://www.youtube.com/watch?v=jNQXAC9IVRw', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#movie_player', { state: 'attached' });
  await page.waitForFunction(() => typeof document.getElementById('movie_player')?.handleGlobalKeyDown === 'function');
  await page.waitForTimeout(3000);
  const result = await page.evaluate(async () => {
    const player = document.getElementById('movie_player');
    player.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2, clientX: 150, clientY: 150 }));
    const items = [...document.querySelectorAll('.ytp-contextmenu .ytp-menuitem')];
    const item = items.find(el => /miniplayer/i.test(el.textContent));
    const report = { labels: items.map(el => ({ text: el.textContent, display: el.style.display })), found: !!item };
    report.menus = [...document.querySelectorAll('[role="menu"],.ytp-contextmenu')].map(el => ({ html: el.outerHTML.slice(0, 1800), inPlayer: player.contains(el) }));
    report.handlers = ['ytd-player', 'ytd-watch-flexy', 'ytd-app'].map(selector => {
      const el = document.querySelector(selector);
      const controller = el?.polymerController || el?.inst || el;
      const methods = {};
      for (let p = controller; p && p !== HTMLElement.prototype && p !== Object.prototype; p = Object.getPrototypeOf(p)) {
        for (const key of Object.getOwnPropertyNames(p).filter(k => /collapse|miniplayer/i.test(k))) {
          const descriptor = Object.getOwnPropertyDescriptor(p, key);
          if (typeof descriptor.value === 'function') methods[key] = descriptor.value.toString().slice(0,1800);
        }
      }
      return { selector, methods };
    });
    const delay = () => new Promise(resolve => setTimeout(resolve, 300));
    if (item) {
      item.click();
      await delay();
      report.afterClick = { url: location.href, minimized: player.classList.contains('ytp-player-minimized') };
      if (!report.afterClick.minimized) {
        for (const type of ['mousedown', 'mouseup', 'click']) item.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, clientX: 180, clientY: 210, view: window }));
        await delay();
        report.afterMouse = { url: location.href, minimized: player.classList.contains('ytp-player-minimized') };
      }
    }
    return report;
  });
  console.log(JSON.stringify(result, null, 2));
} finally { await browser.close(); }
