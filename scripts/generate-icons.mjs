import { chromium } from './playwright.mjs';
import { readFile, copyFile } from 'node:fs/promises';
const browser = await chromium.launch({ headless: true, executablePath: process.env.YOUTOOLS_BROWSER });
try {
  const page = await browser.newPage();
  await copyFile('icon/icon.svg', 'extension/icons/icon.svg');
  const svg = await readFile('icon/icon.svg', 'utf8');
  for (const size of [16, 32, 48, 128]) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<style>body{margin:0}svg{width:100vw;height:100vh;display:block}</style>${svg}`);
    await page.screenshot({ path: `extension/icons/${size}.png`, omitBackground: true });
  }
} finally { await browser.close(); }
