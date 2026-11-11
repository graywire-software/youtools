import { chromium } from './playwright.mjs';
import { readFile } from 'node:fs/promises';
const browser = await chromium.launch({ headless: true, executablePath: process.env.YOUTOOLS_BROWSER });
try {
  const page = await browser.newPage();
  console.log(JSON.stringify(await page.evaluate(html => {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return {
      nav: [...doc.querySelectorAll('ytd-guide-entry-renderer,ytd-mini-guide-entry-renderer')].filter(el => /Shorts/.test(el.textContent)).map(el => el.outerHTML.slice(0, 3500)),
      shortsAncestors: [...doc.querySelectorAll('[data-youtools-hidden="shorts"]')].slice(0, 2).map(el => { const path=[];for(let p=el;p && path.length<7;p=p.parentElement)path.push({tag:p.tagName,cls:p.className,id:p.id});return path; }),
      headers: [...doc.querySelectorAll('h2')].filter(el => /Shorts|Emotional/.test(el.textContent)).map(el => ({ html:el.outerHTML, parent:el.parentElement.outerHTML.slice(0,3000) })),
      navAll: [...doc.querySelectorAll('a')].filter(el => el.textContent.trim()==='Shorts').map(el=>el.outerHTML.slice(0,1500))
    };
  }, await readFile('test-results/live-search.html','utf8')),null,2));
} finally { await browser.close(); }
