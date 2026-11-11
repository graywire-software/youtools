(() => {
  const R = PWARecolor;
  const key = R.keyFor('https://www.youtube.com');
  const section = document.createElement('section');
  section.className = 'menu'; section.dataset.menu = 'pwa';
  section.innerHTML = `
    <div class="menu-heading"><button class="menu-open" type="button" aria-expanded="false" aria-controls="panel-pwa">
      <span class="menu-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M7 6.5h.01M10 6.5h.01M9 13h6m-3 0v4"/></svg></span>
      <span class="menu-title">Customize app window</span><span class="chevron"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg></span>
    </button></div>
    <div class="menu-panel" id="panel-pwa" hidden><fieldset id="pwa-settings" disabled>
      <p class="help">Customize the installed YT app. Title changes also apply to regular tabs. Everything starts off.</p>
      <div class="setting"><span class="setting-copy"><strong>Recolor title bar</strong><small>Use the app window's theme color</small></span>
        <label class="visibility"><input id="pwa-enabled" type="checkbox" role="switch" aria-label="Recolor title bar"><span class="switch" aria-hidden="true"></span></label></div>
      <div id="pwa-color-controls" class="pwa-controls" hidden>
        <label for="pwa-mode">Color mode</label><select id="pwa-mode"><option value="dark">Force dark</option><option value="light">Force light</option><option value="custom">Custom</option></select>
        <div id="pwa-custom-color" hidden><label for="pwa-hex">Custom color</label><div class="pwa-input-row">
          <input id="pwa-swatch" type="color" aria-label="Choose custom color"><input id="pwa-hex" type="text" spellcheck="false" maxlength="20" placeholder="#202124" aria-describedby="pwa-error"><button id="pwa-apply-color" type="button">Apply</button>
        </div></div>
      </div>
      <div class="setting"><span class="setting-copy"><strong>Change page title</strong><small>Shorten the title or use your own text</small></span>
        <label class="visibility"><input id="pwa-title-enabled" type="checkbox" role="switch" aria-label="Change page title"><span class="switch" aria-hidden="true"></span></label></div>
      <div id="pwa-title-controls" class="pwa-controls" hidden>
        <label for="pwa-title-mode">Title mode</label><select id="pwa-title-mode"><option value="short">Short page title</option><option value="custom">Custom page title</option></select>
        <p class="help" id="pwa-short-help">Use YouTube as the page title. This can remove the extra title after the installed app name.</p>
        <div id="pwa-custom-title" hidden><label for="pwa-title">Custom page title</label><div class="pwa-input-row"><input id="pwa-title" type="text" maxlength="200" placeholder="YouTube"><button id="pwa-apply-title" type="button">Apply</button></div><p class="help">Browser may not allow the installed app name to be hidden.</p></div>
      </div>
      <p id="pwa-error" class="help error" role="alert" hidden></p>
      <p class="pwa-promo">YouTube settings mirror PWA Customizer when both updated extensions are installed. The latest saved changes win.<br><br>
        Want this for more apps? <a href="https://chromewebstore.google.com/" target="_blank" rel="noopener noreferrer">Download PWA Customizer</a>
        <small>Store listing coming soon.</small>
      </p>
    </fieldset></div>`;
  document.querySelector('#menus').append(section);
  // Replace the promotional homepage URL above with the published store listing.
  const $ = id => section.querySelector('#pwa-' + id);
  const opener = section.querySelector('.menu-open');
  opener.addEventListener('click', () => {
    const panel = section.querySelector('#panel-pwa'); panel.hidden = !panel.hidden;
    opener.setAttribute('aria-expanded', String(!panel.hidden));
  });
  let saved = R.settings(), busy = false;
  const error = text => { $('error').textContent = text; $('error').hidden = !text; };
  function render() {
    $('settings').disabled = busy;
    $('enabled').checked = saved.enabled;
    $('title-enabled').checked = saved.titleEnabled;
    $('mode').value = saved.mode;
    $('title-mode').value = saved.titleMode;
    $('color-controls').hidden = !saved.enabled;
    $('custom-color').hidden = saved.mode !== 'custom';
    $('title-controls').hidden = !saved.titleEnabled;
    $('custom-title').hidden = saved.titleMode !== 'custom';
    $('short-help').hidden = saved.titleMode !== 'short';
    for (const [id, value] of [['hex', saved.color], ['swatch', saved.color], ['title', saved.title]]) {
      if (document.activeElement !== $(id)) $(id).value = value;
    }
  }
  async function save(values) {
    if (busy) return false;
    busy = true; error(''); render();
    try {
      const response = await chrome.runtime.sendMessage({ type: 'youtube-pwa-save', settings: { ...saved, ...values } });
      if (!response?.ok) throw new Error(response?.error || 'Could not save app settings.');
      saved = R.settings(response.settings);
      // Reflect normalized text even when the field still has keyboard focus.
      if (Object.hasOwn(values, 'color')) $('hex').value = saved.color;
      if (Object.hasOwn(values, 'title')) $('title').value = saved.title;
      document.querySelector('#status').textContent = 'App settings saved on this browser';
      return true;
    } catch (e) { error(e.message); return false; }
    finally { busy = false; render(); }
  }
  $('enabled').addEventListener('change', e => save({ enabled: e.target.checked }));
  $('title-enabled').addEventListener('change', e => save({ titleEnabled: e.target.checked }));
  $('mode').addEventListener('change', e => save({ mode: e.target.value }));
  $('title-mode').addEventListener('change', e => save({ titleMode: e.target.value }));
  $('swatch').addEventListener('input', e => { $('hex').value = e.target.value.toUpperCase(); error(''); });
  $('hex').addEventListener('input', () => {
    const color = R.sanitizeHex($('hex').value); if (color) $('swatch').value = color;
    $('hex').removeAttribute('aria-invalid'); error('');
  });
  $('apply-color').addEventListener('click', () => {
    const color = R.sanitizeHex($('hex').value);
    if (!color) { error('Use a hex color like #ABC or #1A2B3C.'); $('hex').setAttribute('aria-invalid', 'true'); $('hex').focus(); return; }
    $('hex').removeAttribute('aria-invalid'); save({ color });
  });
  $('apply-title').addEventListener('click', () => save({ title: R.sanitizeTitle($('title').value) }));
  for (const [id, button] of [['hex', 'apply-color'], ['title', 'apply-title']]) {
    $(id).addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); $(button).click(); } });
  }
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes[key]) { saved = R.settings(changes[key].newValue); render(); }
  });
  globalThis.YouToolsPwa = { reset: () => save(R.settings()) };
  (async () => {
    try {
      await chrome.runtime.sendMessage({ type: 'youtube-pwa-refresh' });
      saved = R.settings((await chrome.storage.local.get(key))[key]); render();
    } catch { error('Could not load app settings. Reopen YouTools.'); }
  })();
})();
