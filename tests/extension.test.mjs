import { test, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { chromium } from '../scripts/playwright.mjs';

let context, profile, extensionId, page, popup;
const extension = resolve('extension');
const fixture = `<!doctype html><html><head><style>
body{background:#181818;color:white;font:16px system-ui}ytd-rich-item-renderer,ytd-video-renderer,ytd-shelf-renderer,ytd-rich-section-renderer,ytd-guide-entry-renderer,ytd-reel-shelf-renderer,yt-lockup-view-model{display:block;padding:8px}a{color:white}
#movie_player{position:relative;width:900px;height:500px;background:#222}.ytp-button{width:40px;height:40px;color:white;background:none;border:0}.ytp-right-controls{display:flex;position:absolute;bottom:0;right:0}.ytp-right-controls-right{display:flex}.ytp-contextmenu{position:absolute;top:50px;left:100px;background:#444;padding:20px}
</style></head><body>
<ytd-guide-entry-renderer id="shorts-nav"><a href="/shorts">Shorts</a></ytd-guide-entry-renderer>
<yt-tab-shape id="shorts-tab">Shorts</yt-tab-shape>
<ytd-guide-entry-renderer id="command-shorts-nav" is-primary><a title="Shorts">Shorts</a></ytd-guide-entry-renderer>
<yt-chip-cloud-chip-renderer id="shorts-chip">Shorts</yt-chip-cloud-chip-renderer>
<ytd-guide-entry-renderer id="games-nav"><a href="/gaming">Gaming</a></ytd-guide-entry-renderer>
<ytd-guide-entry-renderer id="playables-nav"><a href="/playables">Playables</a></ytd-guide-entry-renderer>
<ytd-guide-entry-renderer id="movies-nav"><a href="/feed/storefront">Movies & TV</a></ytd-guide-entry-renderer>
<div id="movie_player"><video muted></video><div class="ytp-right-controls"><div class="ytp-right-controls-left"><button class="ytp-settings-button ytp-button">⚙</button></div><div class="ytp-right-controls-right"><button class="ytp-size-button ytp-button" aria-label="Theater mode">▭</button><button class="ytp-fullscreen-button ytp-button">⛶</button></div></div><div class="ytp-ad-module" id="player-ad">Player ad</div></div>
<ytd-rich-section-renderer id="shorts-shelf"><ytd-reel-shelf-renderer><h2>Shorts</h2><ytd-reel-item-renderer>Short video</ytd-reel-item-renderer></ytd-reel-shelf-renderer></ytd-rich-section-renderer>
<ytd-video-renderer id="short-card"><a id="thumbnail" href="/shorts/abc">Short</a></ytd-video-renderer>
<yt-lockup-view-model id="modern-short"><a class="yt-lockup-view-model__content-image" href="/shorts/modern">Modern short</a></yt-lockup-view-model>
<ytd-shelf-renderer id="playables-shelf"><h2><a href="/playables">Playables</a></h2></ytd-shelf-renderer>
<ytd-shelf-renderer id="games-shelf"><h2>Games</h2></ytd-shelf-renderer>
<ytd-shelf-renderer id="movies-shelf"><h2>Primetime Movies</h2></ytd-shelf-renderer>
<grid-shelf-view-model id="topic-shorts-shelf"><h2>Emotional Family Moments</h2><ytm-shorts-lockup-view-model-v2><ytm-shorts-lockup-view-model>Shorts card</ytm-shorts-lockup-view-model></ytm-shorts-lockup-view-model-v2></grid-shelf-view-model>
<ytd-video-renderer id="ordinary"><a id="video-title" href="/watch?v=normal">Why Shorts, games and movies are popular</a><p><a href="/shorts/abc">Description link</a></p></ytd-video-renderer>
<ytd-shelf-renderer id="mixed"><h2>Recommended</h2><ytd-video-renderer><a id="thumbnail" href="/shorts/mixed">Short</a></ytd-video-renderer><ytd-video-renderer id="mixed-normal"><a id="thumbnail" href="/watch?v=normal">Normal</a></ytd-video-renderer></ytd-shelf-renderer>
<ytd-rich-item-renderer id="sponsored-short"><ytd-ad-slot-renderer><a id="thumbnail" href="/shorts/ad">Ad</a></ytd-ad-slot-renderer></ytd-rich-item-renderer>
<ytd-video-renderer id="sponsored-badge"><a id="thumbnail" href="/shorts/ad2">Ad</a><yt-badge-view-model>Sponsored</yt-badge-view-model></ytd-video-renderer>
<ytd-shelf-renderer id="sponsored-movies"><h2>Primetime Movies</h2><ytd-display-ad-renderer>Movie ad</ytd-display-ad-renderer></ytd-shelf-renderer>
<script>
window.miniClicks=0;
document.getElementById('movie_player').addEventListener('contextmenu', event => {
 event.preventDefault();
 const player=event.currentTarget;
 const open=()=>{
  const menu=document.createElement('div'); menu.className='ytp-contextmenu';
  menu.innerHTML='<div class="ytp-menuitem"><div class="ytp-menuitem-label">Miniplayer</div></div><div class="ytp-menuitem"><div class="ytp-menuitem-label">Stats for nerds</div></div>';
  menu.firstElementChild.addEventListener('click',()=>{window.miniClicks++;if(!window.rejectMini){player.classList.add('ytp-player-minimized');menu.remove();}});
  menu.addEventListener('keydown',event=>{if(event.key==='Escape')menu.remove();});
  (window.menuPortal ? document.body : player).append(menu);
 };
 if(window.menuDelay)setTimeout(open,window.menuDelay);else open();
});
window.prepareVideo=async()=>{const canvas=document.createElement('canvas');canvas.width=320;canvas.height=180;const c=canvas.getContext('2d');c.fillStyle='green';c.fillRect(0,0,320,180);const video=document.querySelector('video');video.srcObject=canvas.captureStream(10);window.frameTimer=setInterval(()=>c.fillRect(0,0,320,180),100);await video.play();};
</script></body></html>`;

before(async () => {
  profile = await mkdtemp(join(tmpdir(), 'youtools-test-'));
  context = await chromium.launchPersistentContext(profile, {
    headless: true,
    executablePath: process.env.YOUTOOLS_BROWSER,
    channel: process.env.YOUTOOLS_BROWSER ? undefined : 'chromium',
    args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
    viewport: { width: 1280, height: 900 }
  });
  const manager = await context.newPage();
  await manager.goto('chrome://extensions/');
  await manager.locator('extensions-item').waitFor();
  extensionId = await manager.locator('extensions-item').evaluateAll(items => items.find(el => el.data?.name === 'YouTools')?.id);
  assert.ok(extensionId, 'YouTools loaded as an actual unpacked extension');
  await manager.close();
});
after(async () => { await context?.close(); if (profile) await rm(profile, { recursive: true, force: true, maxRetries: 5 }); });
const openPopupMenus = async () => {
  await popup.locator('#menus:not([disabled])').waitFor();
  await popup.locator('.menu-open[aria-expanded="false"]').evaluateAll(buttons => buttons.forEach(button => button.click()));
};
beforeEach(async () => {
  popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  await popup.evaluate(() => chrome.storage.local.clear());
  // These behavior tests explicitly opt in; installation defaults are all off.
  await popup.evaluate(() => chrome.storage.local.set({
    showMiniplayerButton: true, showPipButton: true, hideShorts: true,
    hideShortsNavigation: true, hidePlayables: true, hideGames: true, hideMovies: true
  }));
  await openPopupMenus();
  page = await context.newPage();
  await page.route('https://www.youtube.com/**', route => route.fulfill({ contentType: 'text/html', body: fixture }));
  await page.goto('https://www.youtube.com/watch?v=fixture');
  await page.locator('.youtools-pip-button').waitFor();
  await page.waitForFunction(() => document.getElementById('short-card').hasAttribute('data-youtools-hidden'));
});
afterEach(async () => { await page?.close(); await popup?.close(); });
const hidden = id => page.locator(`#${id}`).evaluate(el => getComputedStyle(el).display === 'none');
const set = async values => {
  await popup.evaluate(values => chrome.storage.local.set(values), values);
  await page.waitForTimeout(250);
};
const assertDefaultSwitches = async () => {
  assert.equal(await popup.locator('input[data-hide]:not(:checked)').count(), 0, 'native content starts visible');
  assert.equal(await popup.locator('input:not([data-hide]):checked').count(), 0, 'optional customizations start off');
};

test('five independent filters, preserving normal content and every ad fixture', async () => {
  for (const id of ['shorts-nav','shorts-tab','command-shorts-nav','shorts-chip','games-nav','playables-nav','movies-nav','shorts-shelf','short-card','modern-short','topic-shorts-shelf','playables-shelf','games-shelf','movies-shelf']) assert.equal(await hidden(id), true, id);
  for (const id of ['ordinary','mixed','mixed-normal','sponsored-short','sponsored-badge','sponsored-movies','player-ad']) assert.equal(await hidden(id), false, id);
  await set({ hideShorts: false });
  assert.equal(await hidden('short-card'), false);
  assert.equal(await hidden('shorts-shelf'), false);
  assert.equal(await hidden('shorts-nav'), true);
  await set({ hideShortsNavigation: false });
  assert.equal(await hidden('shorts-nav'), false);
  assert.equal(await hidden('shorts-tab'), false);
  for (const [key, ids] of Object.entries({ hidePlayables: ['playables-nav','playables-shelf'], hideGames: ['games-nav','games-shelf'], hideMovies: ['movies-nav','movies-shelf'] })) {
    await set({ [key]: false });
    for (const id of ids) assert.equal(await hidden(id), false, id);
  }
});

test('popup saves and restores preferences across pages, reset works', async () => {
  await popup.getByRole('switch', { name: 'Show Shorts videos', exact: true }).check();
  await page.waitForFunction(() => !document.getElementById('short-card').hasAttribute('data-youtools-hidden'));
  await popup.reload(); await openPopupMenus();
  assert.equal(await popup.getByRole('switch', { name: 'Show Shorts videos', exact: true }).isChecked(), true);
  await page.reload();
  await page.locator('.youtools-pip-button').waitFor();
  assert.equal(await hidden('short-card'), false);
  await popup.getByRole('button', { name: 'Reset' }).click();
  await page.locator('.youtools-pip-button').waitFor({ state: 'detached' });
  assert.equal(await hidden('short-card'), false);
  await assertDefaultSwitches();
});

test('movie rating badges hide recommendation cards without hiding titles, mixed shelves, or ads', async () => {
  await page.evaluate(() => {
    const card = (id, rating, extra = '') => `<yt-lockup-view-model id="${id}"><a class="yt-lockup-metadata-view-model__title" href="/watch?v=${id}">Movie</a><div class="yt-content-metadata-view-model__metadata-row"><span class="yt-core-attributed-string">Comedy 1998</span><span class="yt-core-attributed-string">Free</span><span class="yt-badge-shape-wiz__text">${rating}</span>${extra}</div></yt-lockup-view-model>`;
    document.body.insertAdjacentHTML('beforeend',
      card('dirty-work', 'PG-13') + card('rated-r', 'R') + card('family-film', 'G') + card('tv-rated', 'TV-MA') +
      '<ytd-compact-video-renderer id="legacy-rating"><a id="video-title" href="/watch?v=legacy">Legacy movie</a><ytd-badge-supported-renderer><span class="badge-style-type-rating">PG</span></ytd-badge-supported-renderer></ytd-compact-video-renderer>' +
      card('rating-ad', 'PG-13', '<span class="yt-badge-shape-wiz__text">Sponsored</span>') +
      card('pending-rating', '') +
      '<yt-lockup-view-model id="rating-discussion"><h3><a class="yt-lockup-metadata-view-model__title" href="/watch?v=discussion">PG-13 movie reviews</a></h3><p id="description-text"><span class="yt-core-attributed-string">Rated PG-13</span></p><div class="yt-content-metadata-view-model__metadata-row"><span class="yt-badge-shape-wiz__text">New</span></div></yt-lockup-view-model>' +
      '<yt-lockup-view-model id="rating-title-only"><h3><a class="yt-lockup-metadata-view-model__title" href="/watch?v=title"><span class="yt-badge-shape-wiz__text">PG-13</span></a></h3></yt-lockup-view-model>' +
      '<ytd-shelf-renderer id="mixed-rated-shelf"><h2>Recommended</h2>' + card('mixed-rated-movie', 'NC-17') + '<ytd-video-renderer id="mixed-rated-normal"><a id="video-title" href="/watch?v=other">Normal video</a></ytd-video-renderer></ytd-shelf-renderer>');
  });
  await page.waitForFunction(() => document.getElementById('dirty-work').hasAttribute('data-youtools-hidden'));
  const movies = ['dirty-work', 'rated-r', 'family-film', 'tv-rated', 'legacy-rating', 'mixed-rated-movie'];
  for (const id of movies) assert.equal(await hidden(id), true, id);
  for (const id of ['rating-ad', 'pending-rating', 'rating-discussion', 'rating-title-only', 'mixed-rated-shelf', 'mixed-rated-normal', 'player-ad']) assert.equal(await hidden(id), false, id);
  await page.locator('#pending-rating .yt-badge-shape-wiz__text').evaluate(el => { el.textContent = 'PG-13'; });
  await page.waitForFunction(() => document.getElementById('pending-rating').hasAttribute('data-youtools-hidden'));
  await page.locator('#pending-rating .yt-badge-shape-wiz__text').evaluate(el => { el.textContent = 'New'; });
  await page.waitForFunction(() => !document.getElementById('pending-rating').hasAttribute('data-youtools-hidden'));
  // A recycled card or a late ad marker must undo the filter immediately.
  await page.locator('#dirty-work .yt-content-metadata-view-model__metadata-row').evaluate(el => {
    el.insertAdjacentHTML('beforeend', '<span class="yt-badge-shape-wiz__text">Sponsored</span>');
  });
  await page.waitForFunction(() => !document.getElementById('dirty-work').hasAttribute('data-youtools-hidden'));
  await popup.getByRole('switch', { name: 'Show Primetime and movies', exact: true }).check();
  await page.waitForFunction(() => !document.getElementById('rated-r').hasAttribute('data-youtools-hidden'));
  for (const id of movies) assert.equal(await hidden(id), false, id);
});

test('player toggles save independently, restore native controls, and survive reloads', async () => {
  await popup.getByRole('switch', { name: 'Show Miniplayer button', exact: true }).uncheck();
  await page.locator('.youtools-mini-button').waitFor({ state: 'detached' });
  assert.equal(await page.locator('.youtools-pip-button').count(), 1);
  assert.equal(await page.locator('#movie_player').evaluate(el => el.hasAttribute('data-youtools-mini')), false);
  await popup.getByRole('switch', { name: 'Show Picture-in-picture button', exact: true }).uncheck();
  await page.locator('.youtools-pip-button').waitFor({ state: 'detached' });
  await page.reload();
  await page.waitForFunction(() => document.getElementById('short-card').hasAttribute('data-youtools-hidden'));
  assert.equal(await page.locator('.youtools-button').count(), 0);
  await popup.reload(); await openPopupMenus();
  assert.equal(await popup.getByRole('switch', { name: 'Show Miniplayer button', exact: true }).isChecked(), false);
  await popup.getByRole('switch', { name: 'Show Miniplayer button', exact: true }).check();
  await page.locator('.youtools-mini-button').waitFor();
  assert.match(await page.locator('.ytp-size-button').evaluate(el => el.previousElementSibling.className), /youtools-mini-button/);
  await popup.getByRole('switch', { name: 'Show Picture-in-picture button', exact: true }).check();
  await page.locator('.youtools-pip-button').waitFor();
  assert.match(await page.locator('.ytp-size-button').evaluate(el => el.previousElementSibling.className), /youtools-pip-button/);
});

test('dynamic cards, recycled links, and late ad markers are re-evaluated', async () => {
  await page.evaluate(() => {
    const card = document.createElement('ytd-video-renderer'); card.id='dynamic';
    card.innerHTML='<a id="thumbnail" href="/shorts/new">New short</a>';document.body.append(card);
  });
  await page.waitForFunction(() => document.getElementById('dynamic').hasAttribute('data-youtools-hidden'));
  await page.locator('#dynamic a').evaluate(el => el.setAttribute('href','/watch?v=normal'));
  await page.waitForFunction(() => !document.getElementById('dynamic').hasAttribute('data-youtools-hidden'));
  await page.locator('#short-card').evaluate(el => el.append(document.createElement('ytd-ad-slot-renderer')));
  await page.waitForFunction(() => !document.getElementById('short-card').hasAttribute('data-youtools-hidden'));
});

test('player order, native Miniplayer action, and SPA controls replacement', async () => {
  const order = () => page.locator('.ytp-size-button').evaluate(el => [el.previousElementSibling.previousElementSibling.className,el.previousElementSibling.className]);
  assert.match((await order())[0], /youtools-mini-button/);
  assert.match((await order())[1], /youtools-pip-button/);
  await page.getByRole('button', { name: 'Miniplayer', exact: true }).click();
  await page.waitForFunction(() => document.getElementById('movie_player').classList.contains('ytp-player-minimized'));
  assert.equal(await page.evaluate(() => window.miniClicks), 1);
  await page.evaluate(() => {
    document.getElementById('movie_player').classList.remove('ytp-player-minimized');
    document.querySelector('.ytp-right-controls-right').innerHTML='<button class="ytp-size-button ytp-button">Theater</button>';
    document.dispatchEvent(new Event('yt-navigate-finish'));
  });
  await page.locator('.youtools-pip-button').waitFor();
  assert.equal(await page.locator('.youtools-pip-button').count(),1);
  assert.match((await order())[0], /youtools-mini-button/);
  await page.evaluate(() => { history.pushState({},'', '/');document.dispatchEvent(new Event('yt-navigate-finish')); });
  await page.locator('.youtools-pip-button').waitFor({ state: 'detached' });
  await page.evaluate(() => { history.pushState({},'', '/watch?v=next');document.dispatchEvent(new Event('yt-navigate-finish')); });
  await page.locator('.youtools-pip-button').waitFor();
  assert.equal(await page.locator('.youtools-pip-button').count(),1);
});

test('Miniplayer activates a delayed portaled menu and ignores inactive or foreign menus', async () => {
  await page.evaluate(() => {
    window.menuPortal = true;
    window.menuDelay = 180;
    window.wrongClicks = 0;
    const inactive = document.createElement('div');
    inactive.className = 'ytp-contextmenu';
    inactive.setAttribute('aria-hidden','true');
    inactive.innerHTML = '<div class="ytp-menuitem"><div class="ytp-menuitem-label">Miniplayer</div></div>';
    inactive.firstElementChild.addEventListener('click', () => window.wrongClicks++);
    document.body.append(inactive);
    const preview = document.createElement('div');
    preview.className = 'html5-video-player';
    preview.innerHTML = '<div class="ytp-contextmenu"><div class="ytp-menuitem"><div class="ytp-menuitem-label">Miniplayer</div></div></div>';
    preview.querySelector('.ytp-menuitem').addEventListener('click', () => window.wrongClicks++);
    document.body.append(preview);
  });
  await page.getByRole('button', { name: 'Miniplayer', exact: true }).click();
  await page.waitForFunction(() => document.getElementById('movie_player').classList.contains('ytp-player-minimized'));
  await page.waitForFunction(() => !document.documentElement.classList.contains('youtools-opening-miniplayer'));
  assert.equal(await page.evaluate(() => window.miniClicks), 1);
  assert.equal(await page.evaluate(() => window.wrongClicks), 0);
  assert.equal(await page.locator('body > .ytp-contextmenu:not([aria-hidden="true"])').count(), 0);
});

test('Miniplayer reports a rejected action and dismisses the temporary menu', async () => {
  await page.evaluate(() => { window.menuPortal = true; window.rejectMini = true; });
  await page.getByRole('button', { name: 'Miniplayer', exact: true }).click();
  await page.locator('.youtools-toast').waitFor();
  assert.match(await page.locator('.youtools-toast').textContent(), /unavailable/);
  assert.equal(await page.locator('.ytp-contextmenu').count(), 0);
  assert.equal(await page.evaluate(() => document.getElementById('movie_player').classList.contains('ytp-player-minimized')), false);
});

test('native video Picture-in-Picture enters and exits and restores site preference', async () => {
  await page.evaluate(() => window.prepareVideo());
  await page.locator('video').evaluate(el => el.setAttribute('disablepictureinpicture',''));
  await page.getByRole('button', { name: 'Picture-in-picture', exact: true }).click();
  await page.waitForFunction(() => document.pictureInPictureElement !== null);
  assert.equal(await page.locator('video').evaluate(el => el.hasAttribute('disablepictureinpicture')), false);
  await page.getByRole('button', { name: 'Exit picture-in-picture', exact: true }).click();
  await page.waitForFunction(() => document.pictureInPictureElement === null);
  assert.equal(await page.locator('video').evaluate(el => el.hasAttribute('disablepictureinpicture')), true);
  assert.equal(await page.locator('.youtools-pip-button').getAttribute('aria-pressed'), 'false');
});

test('unloaded video gives a useful error, and popup fits without scrolling', async () => {
  await page.getByRole('button', { name: 'Picture-in-picture', exact: true }).click();
  assert.match(await page.locator('.youtools-toast').textContent(), /Start the video/);
  await popup.setViewportSize({ width: 370, height: 600 });
  assert.equal(await popup.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  assert.equal(await popup.evaluate(() => document.body.scrollHeight <= 600), true);
  await mkdir('test-results', { recursive: true });
  await popup.screenshot({ path: 'test-results/popup.png', fullPage: true });
});


test('sidebar sections and condensed subscriptions restore without duplicates', async () => {
  await page.evaluate(() => {
    const guide=document.createElement('ytd-guide-renderer');
    guide.innerHTML='<ytd-guide-section-renderer><div><ytd-guide-entry-renderer><a href="/">Home</a></ytd-guide-entry-renderer><ytd-guide-entry-renderer><a title="Shorts">Shorts</a></ytd-guide-entry-renderer></div></ytd-guide-section-renderer><ytd-guide-section-renderer id="subs"><h3 id="guide-section-title"></h3><ytd-guide-collapsible-section-entry-renderer><div id="header">Subscriptions</div></ytd-guide-collapsible-section-entry-renderer><ytd-guide-entry-renderer>Channel</ytd-guide-entry-renderer></ytd-guide-section-renderer><ytd-guide-section-renderer id="explore"><h3 id="guide-section-title">Explore</h3></ytd-guide-section-renderer><ytd-guide-section-renderer id="more"><h3 id="guide-section-title">More from YouTube</h3></ytd-guide-section-renderer><ytd-guide-section-renderer><div id="header">You</div><ytd-guide-entry-renderer id="your-channel"><span class="title">Your channel</span></ytd-guide-entry-renderer><ytd-guide-entry-renderer id="your-videos"><span class="title">Your videos</span></ytd-guide-entry-renderer></ytd-guide-section-renderer>';
    document.body.append(guide);
  });
  await set({hideExplore:true,hideMoreFromYouTube:true,condensedSubscriptions:true,hideYourChannel:true,hideYourVideos:true});
  for(const id of ['subs','explore','more','your-channel','your-videos']) assert.equal(await hidden(id),true,id);
  assert.equal(await page.locator('[data-youtools-subscriptions]').count(),1);
  assert.equal(await page.locator('[data-youtools-subscriptions]').getAttribute('href'),'/feed/subscriptions');
  await set({hideExplore:false,hideMoreFromYouTube:false,condensedSubscriptions:false,hideYourChannel:false,hideYourVideos:false});
  for(const id of ['subs','explore','more','your-channel','your-videos']) assert.equal(await hidden(id),false,id);
  assert.equal(await page.locator('[data-youtools-subscriptions]').count(),0);
});

test('clicking scrolled popup toggles keeps the header and footer fixed', async () => {
  await popup.setViewportSize({ width: 370, height: 600 });
  await popup.locator('main').evaluate(el => { el.scrollTop = el.scrollHeight; });
  const geometry = () => popup.evaluate(() => ({
    scroll: document.scrollingElement.scrollTop,
    header: document.querySelector('header').getBoundingClientRect().top,
    footer: document.querySelector('footer').getBoundingClientRect().bottom,
    mainTop: document.querySelector('main').getBoundingClientRect().top
  }));
  const before = await geometry();
  for (const name of ['hideYourVideos', 'hideYourChannel', 'hideExplore']) {
    await popup.locator('[name=' + name + ']').click();
    await popup.waitForTimeout(150);
    assert.deepEqual(await geometry(), before, `Layout moved after clicking ${name}`);
  }
  assert.equal(before.scroll, 0);
  await popup.screenshot({ path: 'test-results/popup-sidebar.png' });
});

const installSidebar = () => page.evaluate(() => {
  const guide = document.createElement('ytd-guide-renderer');
  guide.innerHTML = `
    <ytd-guide-section-renderer><div id="primary-nav">
      <ytd-guide-entry-renderer id="home-entry"><a href="/"><yt-icon><svg><path d="M0 0h20v20H0z"/></svg></yt-icon><span class="title">Home</span></a></ytd-guide-entry-renderer>
      <ytd-guide-entry-renderer id="primary-shorts" is-primary><a title="Shorts"><yt-icon><svg><path d="M0 0h20v20H0z"/></svg></yt-icon><span class="title">Shorts</span></a></ytd-guide-entry-renderer>
      <div id="unrelated-entry">Other navigation</div>
    </div></ytd-guide-section-renderer>
    <ytd-guide-section-renderer id="subs"><h3 id="guide-section-title">Subscriptions</h3><ytd-guide-entry-renderer><a>Channel</a></ytd-guide-entry-renderer><ytd-guide-entry-renderer id="subs-more"><span class="title">Show more</span></ytd-guide-entry-renderer></ytd-guide-section-renderer>
    <ytd-guide-section-renderer id="you-section"><div id="header">You</div>
      <ytd-guide-entry-renderer id="history-entry"><a href="/feed/history"><yt-icon><svg><path d="M0 0h20v20H0z"/></svg></yt-icon><span class="title">History</span></a></ytd-guide-entry-renderer>
      <ytd-guide-collapsible-entry-renderer>
        <ytd-guide-entry-renderer id="you-more"><a title="Show more"><span class="title">Show more</span></a></ytd-guide-entry-renderer>
        <div id="expanded"><ytd-guide-entry-renderer id="extra-you-link"><span class="title">Downloads</span></ytd-guide-entry-renderer><ytd-guide-entry-renderer id="you-less"><a title="Show less"><span class="title">Show less</span></a></ytd-guide-entry-renderer></div>
      </ytd-guide-collapsible-entry-renderer>
    </ytd-guide-section-renderer>
    <ytd-guide-section-renderer><h3 id="guide-section-title">Explore</h3><ytd-guide-entry-renderer id="explore-more"><span class="title">Show more</span></ytd-guide-entry-renderer></ytd-guide-section-renderer>`;
  document.body.append(guide);
  window.homeClicks = 0;
  guide.querySelector('#home-entry a').addEventListener('click', event => { event.preventDefault(); window.homeClicks++; });
});
const navigationOrder = () => page.locator('#primary-nav').evaluate(el => [...el.children].map(e =>
  e.hasAttribute('data-youtools-subscriptions') ? 'subscriptions' : e.id));

const installFullSidebar = async () => {
  await installSidebar();
  await page.evaluate(() => {
    const row = (id, text, href = '#') => '<ytd-guide-entry-renderer id="' + id + '"><a href="' + href + '"><span class="title">' + text + '</span></a></ytd-guide-entry-renderer>';
    const guide = document.querySelector('ytd-guide-renderer');
    guide.querySelector('#home-entry').closest('ytd-guide-section-renderer').id = 'top-section';
    guide.querySelector('#you-section').innerHTML = '<div id="header">You</div><div id="section-items">' +
      row('your-channel', 'Your channel') + row('history-entry', 'History') + row('playlists-entry', 'Playlists') +
      row('later-entry', 'Watch later') + row('liked-entry', 'Liked videos') + row('your-videos', 'Your videos') +
      '<ytd-guide-downloads-entry-renderer id="downloads-wrapper">' + row('downloads-entry', 'Downloads') + '</ytd-guide-downloads-entry-renderer>' +
      '<ytd-guide-collapsible-entry-renderer id="you-expand">' + row('you-more', 'Show more') + '<div id="you-expanded" hidden>' + row('courses-entry', 'Courses') + row('you-less', 'Show less') + '</div></ytd-guide-collapsible-entry-renderer></div>';
    const explore = guide.querySelector('#explore-more').closest('ytd-guide-section-renderer'); explore.id = 'explore';
    explore.innerHTML = '<h3 id="guide-section-title">Explore</h3><div id="explore-items">' + row('music-entry', 'Music') + row('other-explore', 'Other topic') + row('live-entry', 'Live') +
      '<ytd-guide-collapsible-entry-renderer id="explore-expand">' + row('explore-more', 'Show more') + '<div id="explore-expanded" hidden>' + row('podcasts-entry', 'Podcasts') + row('memberships-entry', 'Memberships') + row('explore-less', 'Show less') + '</div></ytd-guide-collapsible-entry-renderer></div>';
    for (const prefix of ['you', 'explore']) {
      document.getElementById(prefix + '-more').addEventListener('click', () => { document.getElementById(prefix + '-expanded').hidden = false; });
      document.getElementById(prefix + '-less').addEventListener('click', () => { document.getElementById(prefix + '-expanded').hidden = true; });
    }
    const more = document.createElement('ytd-guide-section-renderer'); more.id = 'more';
    more.innerHTML = '<h3 id="guide-section-title">More from YouTube</h3><div>' + row('tv-entry', 'YouTube TV') + row('yt-music-entry', 'YouTube Music') + row('kids-entry', 'YouTube Kids') + '</div>'; guide.append(more);
    const report = document.createElement('ytd-guide-section-renderer'); report.id = 'report-section';
    report.innerHTML = row('report-entry', 'Report history', '/reporthistory'); guide.append(report);
    const footer = document.createElement('div'); footer.id = 'footer';
    footer.innerHTML = '<div id="guide-links-primary">' + ['About','Press','Copyright','Contact us','Creators','Advertise','Developers','Terms','Privacy','Policy & Safety','How YouTube works','Test new features','NFL Sunday Ticket'].map((name, i) => '<a href="/footer-link-' + i + '">' + name + '</a>').join(' ') + '</div><div id="copyright">Copyright notice</div>';
    guide.append(footer);
    window.originalFooter = footer; window.originalReport = document.getElementById('report-entry');
    window.aboutClicks = 0;
    footer.querySelector('a').addEventListener('click', event => { event.preventDefault(); window.aboutClicks++; });
  });
};

test('empty storage shows native content with customizations off, and Reset restores those defaults', async () => {
  await popup.evaluate(() => chrome.storage.local.clear());
  await popup.reload(); await openPopupMenus();
  await popup.locator('#menus:not([disabled])').waitFor();
  await page.reload();
  await installSidebar();
  await page.waitForTimeout(300);
  await assertDefaultSwitches();
  assert.equal(await page.locator('.youtools-button,[data-youtools-hidden],[data-youtools-sidebar-hidden],[data-youtools-red-icons],[data-youtools-subscriptions]').count(), 0);
  assert.deepEqual(await navigationOrder(), ['home-entry', 'primary-shorts', 'unrelated-entry']);
  await set({ redSidebarIcons: true, hideYouShowMore: true, condensedSubscriptions: true, sidebarOrder: ['subscriptions', 'shorts', 'home'] });
  await popup.getByRole('button', { name: 'Reset', exact: true }).click();
  await page.locator('[data-youtools-subscriptions]').waitFor({ state: 'detached' });
  await assertDefaultSwitches();
  assert.equal(await page.locator('[data-youtools-red-icons],[data-youtools-sidebar-hidden]').count(), 0);
  assert.deepEqual(await navigationOrder(), ['home-entry', 'primary-shorts', 'unrelated-entry']);
});

test('visibility switches consistently show when on, hide when off, and preserve legacy preferences', async () => {
  await installFullSidebar();
  // Existing hide preferences remain saved, but now render as an OFF switch.
  assert.equal(await popup.locator('[name=hideMovies]').isChecked(), false);
  assert.equal((await popup.evaluate(() => chrome.storage.local.get('hideMovies'))).hideMovies, true);
  await popup.getByRole('button', { name: 'Reset', exact: true }).click();
  await popup.waitForFunction(() => document.querySelector('[name=hideMovies]').checked);
  const examples = [
    ['hideShorts', 'short-card'], ['hidePlayables', 'playables-shelf'], ['hideGames', 'games-shelf'], ['hideMovies', 'movies-shelf'],
    ['hideTopMenu', 'top-section'], ['hideSubscriptionsSection', 'subs'], ['hideYouSection', 'you-section'], ['hideExplore', 'explore'], ['hideMoreFromYouTube', 'more'],
    ['hideHome', 'home-entry'], ['hideShortsNavigation', 'primary-shorts'], ['hideYourChannel', 'your-channel'],
    ['hideHistory', 'history-entry'], ['hideYourVideos', 'your-videos'], ['hideExploreMusic', 'music-entry'], ['hideYTKids', 'kids-entry']
  ];
  for (const [key, id] of examples) {
    const input = popup.locator(`[name=${key}]`);
    assert.equal(await input.isChecked(), true, key);
    await input.uncheck();
    await page.waitForFunction(id => getComputedStyle(document.getElementById(id)).display === 'none', id);
    assert.equal((await popup.evaluate(key => chrome.storage.local.get(key), key))[key], true, key);
    await input.check();
    await page.waitForFunction(id => getComputedStyle(document.getElementById(id)).display !== 'none', id);
  }
  await popup.reload(); await openPopupMenus();
  for (const [key] of examples) assert.equal(await popup.locator(`[name=${key}]`).isChecked(), true, key);
});

test('red sidebar icons and hiding You expand/collapse controls are scoped and reversible', async () => {
  await installSidebar();
  await set({ hideShortsNavigation: false, condensedSubscriptions: true });
  await page.evaluate(() => {
    document.querySelector('#you-more a').insertAdjacentHTML('afterbegin', '<yt-icon id="more-chevron"><svg><path d="M4 8l8 8 8-8"/></svg></yt-icon>');
    document.querySelector('#you-section #header').insertAdjacentHTML('beforeend', '<yt-icon class="arrow-icon" id="you-chevron"><svg><path d="M8 4l8 8-8 8"/></svg></yt-icon>');
  });
  const chevronColors = () => page.locator('#more-chevron,#you-chevron').evaluateAll(els => els.map(el => getComputedStyle(el).color));
  const originalChevrons = await chevronColors();
  const icons = '#home-entry yt-icon,#history-entry yt-icon,[data-youtools-subscriptions] svg';
  const colors = () => page.locator(icons).evaluateAll(els => els.map(el => getComputedStyle(el).color));
  const original = await colors();
  const textColor = await page.locator('#home-entry .title').evaluate(el => getComputedStyle(el).color);
  const playerColor = await page.locator('.youtools-pip-button svg').evaluate(el => getComputedStyle(el).color);
  await popup.getByRole('switch', { name: 'Red icons', exact: true }).check();
  await popup.locator('[name=hideYouShowMore]').uncheck();
  await page.waitForFunction(() => document.querySelector('#you-more').hasAttribute('data-youtools-sidebar-hidden'));
  assert.deepEqual(await colors(), ['rgb(255, 0, 51)', 'rgb(255, 0, 51)', 'rgb(255, 0, 51)']);
  assert.deepEqual(await chevronColors(), originalChevrons, 'Chevron colors stay native');
  assert.equal(await page.locator('#home-entry .title').evaluate(el => getComputedStyle(el).color), textColor);
  assert.equal(await page.locator('.youtools-pip-button svg').evaluate(el => getComputedStyle(el).color), playerColor);
  assert.equal(await hidden('you-more'), true);
  assert.equal(await hidden('you-less'), true);
  for (const id of ['extra-you-link', 'explore-more', 'subs-more']) assert.equal(await hidden(id), false, id);
  await page.locator('#you-more').evaluate(el => el.replaceWith(el.cloneNode(true)));
  await page.waitForTimeout(250);
  assert.equal(await hidden('you-more'), true);
  await popup.getByRole('switch', { name: 'Red icons', exact: true }).uncheck();
  await popup.locator('[name=hideYouShowMore]').check();
  await page.waitForFunction(() => !document.querySelector('#you-more').hasAttribute('data-youtools-sidebar-hidden'));
  assert.deepEqual(await colors(), original);
  assert.equal(await hidden('you-more'), false);
  assert.equal(await hidden('you-less'), false);
});

test('keyboard reordering persists order through toggles and rerenders without a mutation loop', async () => {
  await installSidebar();
  await set({ hideShortsNavigation: false, condensedSubscriptions: true });
  await popup.getByRole('button', { name: 'Reorder Condensed Subscriptions', exact: true }).press('ArrowUp');
  await popup.getByRole('button', { name: 'Reorder Condensed Subscriptions', exact: true }).press('ArrowUp');
  await page.waitForFunction(() => document.querySelector('#primary-nav').firstElementChild.hasAttribute('data-youtools-subscriptions'));
  assert.deepEqual(await navigationOrder(), ['subscriptions', 'home-entry', 'primary-shorts', 'unrelated-entry']);
  await page.locator('#home-entry a').click();
  assert.equal(await page.evaluate(() => window.homeClicks), 1, 'Native listener survives moving the entry');
  await popup.reload(); await openPopupMenus();
  await popup.locator('#menus:not([disabled])').waitFor();
  assert.deepEqual(await popup.locator('[data-order-list=sidebarOrder] > .order-item').evaluateAll(els => els.map(el => el.dataset.entry)), ['subscriptions', 'home', 'shorts']);
  await popup.getByRole('button', { name: 'Reorder Condensed Subscriptions', exact: true }).press('ArrowUp');
  assert.deepEqual(await popup.locator('[data-order-list=sidebarOrder] > .order-item').evaluateAll(els => els.map(el => el.dataset.entry)), ['subscriptions', 'home', 'shorts']);
  await set({ hideShortsNavigation: true, condensedSubscriptions: false });
  assert.equal(await hidden('primary-shorts'), true);
  await set({ condensedSubscriptions: true });
  assert.deepEqual(await navigationOrder(), ['subscriptions', 'home-entry', 'primary-shorts', 'unrelated-entry']);
  await page.reload();
  await installSidebar();
  await page.waitForFunction(() => document.querySelector('#primary-nav').firstElementChild.hasAttribute('data-youtools-subscriptions'));
  assert.equal(await hidden('primary-shorts'), true);
  assert.deepEqual(await page.evaluate(async () => {
    let changes = 0;
    const observer = new MutationObserver(records => { changes += records.length; });
    observer.observe(document.querySelector('#primary-nav'), { childList: true });
    document.dispatchEvent(new Event('yt-navigate-finish'));
    await new Promise(resolve => setTimeout(resolve, 450));
    observer.disconnect();
    return { changes, shortcuts: document.querySelectorAll('[data-youtools-subscriptions]').length };
  }), { changes: 0, shortcuts: 1 });
  await set({ sidebarOrder: ['shorts', 'home', 'subscriptions'], hideShortsNavigation: false });
  assert.deepEqual(await navigationOrder(), ['primary-shorts', 'home-entry', 'subscriptions', 'unrelated-entry']);
  await set({ sidebarOrder: ['home', 'home', 'invalid'] });
  assert.deepEqual(await navigationOrder(), ['home-entry', 'primary-shorts', 'subscriptions', 'unrelated-entry']);
});


test('nested popup supports real dragging, linked subscription switches, and fixed Footer', async () => {
  await installFullSidebar();
  await popup.setViewportSize({ width: 370, height: 600 });
  await popup.locator('.menu-open[aria-expanded="true"]').evaluateAll(buttons => buttons.forEach(button => button.click()));
  assert.equal(await popup.locator('#menus > .menu').count(), 4);
  assert.equal(await popup.locator('#panel-sidebar > :last-child [name=redSidebarIcons]').count(), 1);
  assert.equal(await popup.locator('#panel-pwa .pwa-promo').count(), 1);
  assert.equal(await popup.locator('main > .pwa-promo').count(), 0);
  assert.equal(await popup.locator('#panel-content .setting-icon').count(), 0);
  assert.equal(await popup.locator('#panel-player .setting-icon').count(), 2);
  assert.equal(await popup.locator('[data-menu=footer] .drag-handle').count(), 0);
  assert.equal(await popup.locator('[data-menu=footer] > .menu-heading input').count(), 0);
  await popup.getByRole('button', { name: 'Customize sidebar', exact: true }).click();
  await popup.locator('[data-menu=you] > .menu-heading').dragTo(popup.locator('[data-menu=top] > .menu-heading'), { targetPosition: { x: 90, y: 5 } });
  await page.waitForFunction(() => document.querySelector('ytd-guide-renderer').firstElementChild.id === 'you-section');
  assert.equal((await popup.evaluate(() => chrome.storage.local.get('sectionOrder'))).sectionOrder[0], 'you');
  assert.equal(await page.locator('ytd-guide-renderer > :last-child').getAttribute('id'), 'footer');
  await popup.getByRole('button', { name: 'Top Menu', exact: true }).click();
  await popup.getByRole('switch', { name: 'Show condensed Subscriptions', exact: true }).check();
  await page.locator('[data-youtools-subscriptions]').waitFor();
  assert.deepEqual(await popup.locator('[name=condensedSubscriptions]').evaluateAll(inputs => inputs.map(input => input.checked)), [true, true]);
  const top = popup.locator('[data-order-list=sidebarOrder]');
  await top.locator('[data-entry=subscriptions]').dragTo(top.locator('[data-entry=home]'), { targetPosition: { x: 90, y: 4 } });
  await page.waitForFunction(() => document.querySelector('#primary-nav').firstElementChild.hasAttribute('data-youtools-subscriptions'));
  assert.deepEqual((await popup.evaluate(() => chrome.storage.local.get('sidebarOrder'))).sidebarOrder, ['subscriptions', 'home', 'shorts']);
  await popup.getByRole('button', { name: 'Subscriptions', exact: true }).click();
  await popup.getByRole('switch', { name: 'Condensed subscriptions', exact: true }).uncheck();
  await page.locator('[data-youtools-subscriptions]').waitFor({ state: 'detached' });
  assert.deepEqual(await popup.locator('[name=condensedSubscriptions]').evaluateAll(inputs => inputs.map(input => input.checked)), [false, false]);
  await popup.screenshot({ path: 'test-results/popup-nested.png' });
});

test('You, Explore and More entries reorder across native expansion slots and restore', async () => {
  await installFullSidebar();
  const original = await page.locator('#you-section ytd-guide-entry-renderer').evaluateAll(els => els.map(el => el.id));
  await set({ youOrder: ['downloads','channel','history','playlists','later','liked','videos','courses','showMore'], exploreOrder: ['memberships','music','live','podcasts','showMore'], moreOrder: ['kids','tv','music'] });
  assert.equal(await page.locator('#section-items > :first-child').getAttribute('id'), 'downloads-wrapper');
  assert.equal(await page.locator('#explore-items > :first-child').getAttribute('id'), 'memberships-entry');
  assert.equal(await page.locator('#more div > :first-child').getAttribute('id'), 'kids-entry');
  assert.equal(await page.locator('#explore-items > :last-child').getAttribute('id'), 'explore-expand');
  await page.locator('#explore-more').click();
  assert.equal(await page.locator('#explore-expanded').evaluate(el => el.hidden), false);
  assert.equal(await page.locator('#podcasts-entry').isVisible(), true);
  await page.locator('#explore-less').click();
  assert.equal(await page.locator('#explore-expanded').evaluate(el => el.hidden), true);
  await popup.getByRole('button', { name: 'Reset', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('#section-items').firstElementChild.id === 'your-channel');
  assert.deepEqual(await page.locator('#you-section ytd-guide-entry-renderer').evaluateAll(els => els.map(el => el.id)), original);
  assert.equal(await page.locator('#explore-items > :first-child').getAttribute('id'), 'music-entry');
  const flags = { hideHome: true, hideYourChannel: true, hideHistory: true, hidePlaylists: true, hideWatchLater: true, hideLikedVideos: true, hideYourVideos: true, hideDownloads: true, hideCourses: true, hideYouShowMore: true, hideExploreMusic: true, hideExploreLive: true, hideExplorePodcasts: true, hideExploreMemberships: true, hideExploreShowMore: true, hideYTTV: true, hideYTMusic: true, hideYTKids: true };
  await set(flags);
  for (const id of ['home-entry','your-channel','history-entry','playlists-entry','later-entry','liked-entry','your-videos','downloads-wrapper','courses-entry','you-more','you-less','music-entry','live-entry','podcasts-entry','memberships-entry','explore-more','explore-less','tv-entry','yt-music-entry','kids-entry']) assert.equal(await hidden(id), true, id);
  for (const id of ['other-explore','subs-more','report-entry','footer']) assert.equal(await hidden(id), false, id);
  await set(Object.fromEntries(Object.keys(flags).map(key => [key, false])));
  await set({ youOrder: ['showMore','channel','history','playlists','later','liked','videos','downloads','courses'], exploreOrder: ['showMore','music','live','podcasts','memberships'] });
  assert.equal(await popup.locator('[data-order-list=youOrder] > :last-child').getAttribute('data-entry'), 'showMore');
  assert.equal(await popup.locator('[data-order-list=exploreOrder] > :last-child').getAttribute('data-entry'), 'showMore');
  assert.equal(await popup.locator('[data-pinned] .drag-handle').count(), 0);
  await set({ hideTopMenu: true, hideYouSection: true, hideSubscriptionsSection: true });
  for (const id of ['top-section','you-section','subs']) assert.equal(await hidden(id), true, id);
  assert.equal(await hidden('footer'), false);
});

test('condensed footer retains every original link and supports hover, keyboard, and restoration', async () => {
  await installFullSidebar();
  const links = await page.locator('#footer a').evaluateAll(els => els.map(el => el.getAttribute('href')));
  await set({ condensedFooter: true });
  const trigger = page.getByRole('button', { name: 'Site navigation >', exact: true });
  assert.equal(await page.locator('ytd-guide-renderer > #footer > #copyright').isVisible(), true);
  assert.equal(await page.locator('[data-youtools-site-panel] #copyright').count(), 0);
  await trigger.hover();
  await page.locator('[data-youtools-site-panel]:popover-open').waitFor();
  assert.equal(await trigger.getAttribute('aria-expanded'), 'true');
  assert.equal(await page.locator('ytd-guide-renderer > #footer > #copyright').isVisible(), true);
  assert.deepEqual(await page.locator('[data-youtools-site-panel] #guide-links-primary a').evaluateAll(els => els.map(el => el.getAttribute('href'))), links);
  assert.equal(await page.locator('[data-youtools-site-panel] #report-entry').isVisible(), true);
  await page.locator('[data-youtools-site-panel]').getByText('About', { exact: true }).click();
  assert.equal(await page.evaluate(() => window.aboutClicks), 1);
  await page.keyboard.press('Escape');
  await page.locator('[data-youtools-site-panel]:popover-open').waitFor({ state: 'hidden' });
  await trigger.focus(); await page.keyboard.press('ArrowRight');
  assert.equal(await page.locator('[data-youtools-site-panel]').evaluate(el => el.matches(':popover-open')), true);
  assert.equal(await page.evaluate(() => document.activeElement.closest('[data-youtools-site-panel]') !== null), true);
  await set({ condensedFooter: false });
  assert.equal(await page.locator('[data-youtools-footer-menu]').count(), 0);
  assert.equal(await page.evaluate(() => document.querySelector('ytd-guide-renderer > #footer') === window.originalFooter), true);
  assert.equal(await page.evaluate(() => document.querySelector('#report-section #report-entry') === window.originalReport), true);
  assert.deepEqual(await page.locator('#footer a').evaluateAll(els => els.map(el => el.getAttribute('href'))), links);
  await set({ condensedFooter: true });
  await set({ condensedFooter: false });
  assert.equal(await page.locator('#footer').count(), 1);
});


test('Report history arriving late joins the existing footer menu and restores correctly', async () => {
  await installFullSidebar();
  await page.evaluate(() => { window.delayedReportSection = document.querySelector('#report-section'); window.delayedReportSection.remove(); });
  await set({ condensedFooter: true });
  await page.locator('[data-youtools-footer-menu]').waitFor();
  await page.evaluate(() => document.querySelector('[data-youtools-footer-menu]').before(window.delayedReportSection));
  await page.waitForFunction(() => document.querySelector('[data-youtools-site-panel] #report-entry'));
  assert.equal(await page.locator('[data-youtools-site-panel]').count(), 1);
  assert.equal(await page.locator('[data-youtools-site-panel] > :first-child').getAttribute('id'), 'report-section');
  await set({ condensedFooter: false });
  assert.equal(await page.evaluate(() => document.querySelector('ytd-guide-renderer > #report-section') === window.delayedReportSection), true);
  assert.equal(await page.locator('#report-entry').count(), 1);
  assert.equal(await page.locator('ytd-guide-renderer > #footer').count(), 1);
});
