(() => {
  'use strict';
  const entry = (id, label, setting, extra = {}) => ({ id, label, setting, ...extra });
  const sidebarMenus = [
    { id: 'top', label: 'Top Menu', hide: 'hideTopMenu', order: 'sidebarOrder', entries: [
      entry('home', 'Home', 'hideHome'), entry('shorts', 'Shorts', 'hideShortsNavigation'),
      entry('subscriptions', 'Condensed Subscriptions', 'condensedSubscriptions', { enable: true })
    ] },
    { id: 'subscriptions', label: 'Subscriptions', hide: 'hideSubscriptionsSection' },
    { id: 'you', label: 'You', hide: 'hideYouSection', order: 'youOrder', entries: [
      entry('channel', 'Your channel', 'hideYourChannel'), entry('history', 'History', 'hideHistory'),
      entry('playlists', 'Playlists', 'hidePlaylists'), entry('later', 'Watch later', 'hideWatchLater'),
      entry('liked', 'Liked videos', 'hideLikedVideos'), entry('videos', 'Your videos', 'hideYourVideos'),
      entry('downloads', 'Downloads', 'hideDownloads'), entry('courses', 'Courses', 'hideCourses'),
      entry('showMore', 'Show more', 'hideYouShowMore', { pinned: true })
    ] },
    { id: 'explore', label: 'Explore', hide: 'hideExplore', order: 'exploreOrder', entries: [
      entry('music', 'Music', 'hideExploreMusic'), entry('live', 'Live', 'hideExploreLive'),
      entry('podcasts', 'Podcasts', 'hideExplorePodcasts'), entry('memberships', 'Memberships', 'hideExploreMemberships'),
      entry('showMore', 'Show more', 'hideExploreShowMore', { pinned: true })
    ] },
    { id: 'more', label: 'More from YT', hide: 'hideMoreFromYouTube', order: 'moreOrder', entries: [
      entry('tv', 'YT TV', 'hideYTTV'), entry('music', 'YT Music', 'hideYTMusic'), entry('kids', 'YT Kids', 'hideYTKids')
    ] },
    { id: 'footer', label: 'Footer' }
  ];
  const defaults = {
    showMiniplayerButton: false, showPipButton: false, redSidebarIcons: false,
    condensedSubscriptions: false, condensedFooter: false,
    hideShorts: false, hidePlayables: false, hideGames: false, hideMovies: false,
    sectionOrder: Object.freeze(sidebarMenus.filter(menu => menu.id !== 'footer').map(menu => menu.id))
  };
  for (const menu of sidebarMenus) {
    if (menu.hide) defaults[menu.hide] = false;
    if (menu.order) defaults[menu.order] = Object.freeze(menu.entries.map(item => item.id));
    for (const item of menu.entries || []) defaults[item.setting] = false;
  }
  Object.freeze(defaults);
  const normalize = values => Object.fromEntries(Object.entries(defaults).map(([key, fallback]) => {
    if (!Array.isArray(fallback)) return [key, typeof values?.[key] === 'boolean' ? values[key] : fallback];
    const value = values?.[key];
    const valid = Array.isArray(value) && value.length === fallback.length &&
      new Set(value).size === value.length && value.every(id => fallback.includes(id));
    const order = valid ? [...value] : [...fallback];
    return [key, order.includes('showMore') ? [...order.filter(id => id !== 'showMore'), 'showMore'] : order];
  }));
  globalThis.YouTools = {
    defaults, sidebarMenus, normalize,
    async readSettings() { return normalize(await chrome.storage.local.get(Object.keys(defaults))); }
  };
})();
