(() => {
  'use strict';
  const tools = globalThis.YouTools;
  const player = tools.createPlayerTools();
  let filters;
  const sidebar = tools.createSidebar({});
  let revision = 0;
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !Object.keys(changes).some(key => key in tools.defaults)) return;
    loadSettings();
  });
  async function loadSettings() {
    const request = ++revision;
    try {
      const settings = await tools.readSettings();
      if (request !== revision) return;
      player.update(settings);
      sidebar.update(settings);
      if (filters) filters.update(settings);
      else filters = tools.createFilters(settings);
    } catch {
      // A disabled/reloaded extension must not unexpectedly hide more content.
      filters?.update(tools.defaults);
      player.update({});
      sidebar.update({});
    }
  }
  document.addEventListener('yt-navigate-finish', () => { filters?.refresh(); player.refresh(); sidebar.refresh(); });
  window.addEventListener('pageshow', () => { filters?.refresh(); player.refresh(); });
  loadSettings();
})();
