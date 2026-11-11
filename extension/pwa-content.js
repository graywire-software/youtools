(() => {
  const R = PWARecolor;
  const key = R.keyFor('https://www.youtube.com');
  const theme = new PWARecolorTheme(document);
  theme.meta.dataset.youtoolsPwa = '';
  const title = new PWACustomizerTitle(document);
  let revision = 0;
  const apply = value => {
    const settings = R.settings(value);
    theme.set(settings.enabled ? R.colorFor(settings) : null);
    title.set(settings.titleEnabled ? settings.titleMode === 'short' ? 'YouTube' : settings.title : '');
  };
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && Object.hasOwn(changes, key)) {
      revision++;
      apply(changes[key].newValue);
    }
  });
  const initialRevision = revision;
  chrome.storage.local.get(key).then(saved => {
    if (revision === initialRevision) apply(saved[key]);
  }).catch(() => apply());
  // Reconnect after installing/updating either extension, without polling.
  const sync = () => {
    try { chrome.runtime.sendMessage({ type: 'youtube-pwa-refresh' }).catch(() => {}); }
    catch {
      // Unpacked extension reloads invalidate old page contexts synchronously.
      theme.set(null); title.set('');
      window.removeEventListener('pageshow', sync); window.removeEventListener('focus', sync);
    }
  };
  sync();
  window.addEventListener('pageshow', sync);
  window.addEventListener('focus', sync);
})();
