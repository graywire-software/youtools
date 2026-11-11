(() => {
  'use strict';
  const CARD = [
    'ytd-rich-item-renderer', 'ytd-video-renderer', 'ytd-grid-video-renderer',
    'ytd-compact-video-renderer', 'ytd-reel-item-renderer', 'yt-lockup-view-model',
    'ytm-shorts-lockup-view-model', 'ytm-shorts-lockup-view-model-v2',
    'ytd-mini-game-card-renderer', 'ytd-game-card-renderer',
    'ytd-movie-renderer', 'ytd-grid-movie-renderer', 'ytd-compact-movie-renderer'
  ].join(',');
  const SHELF = 'ytd-rich-section-renderer,ytd-reel-shelf-renderer,ytd-rich-shelf-renderer,ytd-shelf-renderer,grid-shelf-view-model,yt-horizontal-list-renderer';
  const NAV = 'ytd-guide-entry-renderer,ytd-mini-guide-entry-renderer,yt-tab-shape,tp-yt-paper-tab,yt-chip-cloud-chip-renderer';
  const CANDIDATES = `${CARD},${SHELF},${NAV}`;
  // Positive identification only: an unrecognized card stays visible. Never
  // select the player, an arbitrary ancestor, or a whole results/feed container.
  const AD = [
    'ytd-ad-slot-renderer', 'ytd-in-feed-ad-layout-renderer', 'ytd-display-ad-renderer',
    'ytd-promoted-sparkles-web-renderer', 'ytd-promoted-video-renderer',
    'ytd-promoted-sparkles-text-search-renderer', 'ytd-search-pyv-renderer',
    'ytd-action-companion-ad-renderer', 'ytd-companion-slot-renderer',
    'yt-ad-slot-renderer', 'yt-mealbar-promo-renderer', '[is-ad]', '[ad-slot]',
    '[data-ad-impressions]', '.ytp-ad-module', '.ytp-ad-overlay-container',
    '.badge-style-type-ad', '.yt-badge-view-model--ad',
    'a[href*="googleadservices.com"]', 'a[href*="doubleclick.net"]', 'a[href^="/pagead/"]'
  ].join(',');
  const BADGES = 'ytd-badge-supported-renderer,yt-badge-view-model,.badge,.yt-core-attributed-string,.yt-badge-shape__text,.yt-badge-shape-wiz__text';
  const RATING_BADGES = [
    'ytd-badge-supported-renderer', 'yt-badge-view-model', '.badge',
    '[class*="badge-style-type-"]', '.yt-badge-shape__text', '.yt-badge-shape-wiz__text',
    '.yt-content-metadata-view-model__metadata-text',
    '.yt-content-metadata-view-model__metadata-row .yt-core-attributed-string'
  ].join(',');
  const MOVIE_RATING = /^(?:(?:rated|rating:?)\s+)?(?:G|PG|PG[\s-]?13|R|NC[\s-]?17|TV[\s-]?(?:Y7(?:[\s-]FV)?|Y|G|PG|14|MA)|NR|unrated|not rated)$/i;

  function hasMovieRating(card) {
    return [...card.querySelectorAll(RATING_BADGES)].some(badge => {
      // Ratings belong to metadata, never a video title, channel, or description.
      if (badge.closest('h3,#video-title,#video-title-link,.yt-lockup-metadata-view-model__title,#channel-name,#description-text')) return false;
      return [badge.textContent, badge.getAttribute('aria-label')].some(value =>
        value && MOVIE_RATING.test(value.replace(/\s+/g, ' ').trim()));
    });
  }
  const AD_LABEL = /^(ad|ads|advertisement|sponsored|promoted|anzeige|gesponsert|publicité|sponsorisé|patrocinado|anuncio|pubblicità|sponsorizzato|広告|スポンサー|광고)$/i;

  function containsAd(element) {
    if (element.closest(AD) || element.querySelector(AD)) return true;
    // Also protect a nested card when its containing renderer carries the badge.
    const wrapper = element.closest('ytd-rich-item-renderer,ytd-video-renderer,ytd-compact-video-renderer') || element;
    return [wrapper, ...wrapper.querySelectorAll(`${BADGES},[aria-label]`)].some(el =>
      AD_LABEL.test((el.getAttribute('aria-label') || '').trim()) ||
      (el.matches(BADGES) && AD_LABEL.test(el.textContent.trim()))
    );
  }

  function categoryForURL(href) {
    try {
      const url = new URL(href, location.origin);
      if (!['www.youtube.com', 'youtube.com'].includes(url.hostname)) return null;
      const path = url.pathname.replace(/\/$/, '');
      if (/^\/shorts(?:\/|$)/.test(path)) return 'shorts';
      if (/^\/playables(?:\/|$)/.test(path)) return 'playables';
      if (/^\/(gaming|games)(?:\/|$)/.test(path) || path === '/channel/UCOpNcN46UbXVtpKMrmU4Abg') return 'games';
      if (/^\/feed\/(storefront|movies)(?:\/|$)/.test(path)) return 'movies';
    } catch { /* Not a navigable URL. */ }
    return null;
  }

  const headingCategory = text => {
    const title = text.trim().toLowerCase();
    if (/^(shorts|youtube shorts)$/.test(title)) return 'shorts';
    if (/^(playables|youtube playables|playables on youtube)$/.test(title)) return 'playables';
    if (/^(games|gaming|youtube gaming|games for you|play games)$/.test(title)) return 'games';
    if (/^(primetime (movies|channels)|movies( & tv)?|movies and tv|youtube movies( & tv)?|free movies|free with ads)$/.test(title)) return 'movies';
    return null;
  };

  function classify(element) {
    if (element.matches(NAV)) {
      for (const link of element.querySelectorAll('a[href]')) {
        const category = categoryForURL(link.getAttribute('href'));
        if (category) return category === 'shorts' ? 'shortsNavigation' : category;
      }
      // Current Shorts sidebar entries use a command endpoint without an href.
      // Limit this fallback to primary/mini navigation, never subscription links.
      if (element.matches('ytd-guide-entry-renderer[is-primary],ytd-mini-guide-entry-renderer') && element.querySelector('a[title="Shorts"]:not([href])')) return 'shortsNavigation';
      if (element.matches('yt-tab-shape,tp-yt-paper-tab,yt-chip-cloud-chip-renderer') && /^shorts$/i.test(element.textContent.trim())) return 'shortsNavigation';
      return null;
    }
    if (element.matches('ytd-reel-shelf-renderer,ytd-reel-item-renderer,ytm-shorts-lockup-view-model,ytm-shorts-lockup-view-model-v2,[is-shorts]')) return 'shorts';
    if (element.matches('ytd-mini-game-card-renderer')) return 'playables';
    if (element.matches('ytd-game-card-renderer')) return 'games';
    if (element.matches('ytd-movie-renderer,ytd-grid-movie-renderer,ytd-compact-movie-renderer')) return 'movies';

    if (element.matches(SHELF)) {
      if (element.querySelector('ytd-reel-shelf-renderer,ytd-rich-shelf-renderer[is-shorts]')) return 'shorts';
      // Do not infer a whole shelf from one of its video titles or thumbnails.
      for (const heading of element.querySelectorAll('#title-container,#header,h2,[role="heading"]')) {
        if (heading.closest(CARD)) continue;
        for (const link of heading.querySelectorAll('a[href]')) {
          const category = categoryForURL(link.getAttribute('href'));
          if (category) return category;
        }
        const category = headingCategory(heading.textContent);
        if (category) return category;
      }
      // New search shelves have arbitrary titles (e.g. a topic) and use a
      // grid-shelf-view-model. Remove their empty shell only when every outer
      // media card positively identifies the same filterable category.
      const cards = [...element.querySelectorAll(CARD)].filter(card => {
        const parentCard = card.parentElement.closest(CARD);
        return !parentCard || !element.contains(parentCard);
      });
      if (cards.length) {
        const categories = cards.map(classify);
        if (categories[0] && categories.every(category => category === categories[0])) return categories[0];
      }
      return null;
    }

    // Only the card's media/title link identifies its category. A creator's
    // description, title mentioning Shorts, or unrelated channel link does not.
    const links = element.querySelectorAll('a#thumbnail[href],a#video-title[href],a#video-title-link[href],a.yt-lockup-view-model__content-image[href],a.yt-lockup-metadata-view-model__title[href],a.shortsLockupViewModelHostEndpoint[href]');
    for (const link of links) {
      const category = categoryForURL(link.getAttribute('href'));
      if (category) return category;
    }
    if (element.querySelector('ytm-shorts-lockup-view-model,ytm-shorts-lockup-view-model-v2,ytd-reel-item-renderer')) return 'shorts';
    if (element.querySelector('ytd-mini-game-card-renderer')) return 'playables';
    if (element.querySelector('ytd-game-card-renderer')) return 'games';
    if (hasMovieRating(element)) return 'movies';
    return null;
  }

  const keys = {
    shorts: 'hideShorts', shortsNavigation: 'hideShortsNavigation',
    playables: 'hidePlayables', games: 'hideGames', movies: 'hideMovies'
  };

  function createFilters(initial) {
    let settings = initial;
    let timer;
    const pending = new Set();
    function inspect(element) {
      const category = classify(element);
      const hide = !!category && settings[keys[category]] && !containsAd(element);
      if (hide) {
        if (element.getAttribute('data-youtools-hidden') !== category) element.setAttribute('data-youtools-hidden', category);
      } else {
        element.removeAttribute('data-youtools-hidden');
      }
    }
    function flush() {
      timer = undefined;
      const elements = new Set();
      for (const root of pending) {
        if (!root.isConnected) continue;
        if (root.matches?.(CANDIDATES)) elements.add(root);
        root.querySelectorAll?.(CANDIDATES).forEach(el => elements.add(el));
        for (let parent = root.parentElement; parent; parent = parent.parentElement) {
          if (parent.matches(CANDIDATES)) elements.add(parent);
        }
      }
      pending.clear();
      elements.forEach(inspect);
    }
    function queue(root = document) {
      if (root.nodeType === Node.TEXT_NODE) root = root.parentElement;
      if (!root) return;
      if (root === document) pending.clear();
      if (!pending.has(document)) pending.add(root);
      // Bound the pending set during large SPA updates.
      if (pending.size > 150) { pending.clear(); pending.add(document); }
      timer ??= setTimeout(flush, 80);
    }
    const observer = new MutationObserver(records => {
      for (const record of records) {
        if (record.target.nodeType === Node.ELEMENT_NODE && record.target.closest('#movie_player')) continue;
        queue(record.target);
      }
    });
    observer.observe(document, {
      childList: true, subtree: true, characterData: true, attributes: true,
      attributeFilter: ['href', 'title', 'aria-label', 'is-shorts', 'is-ad', 'ad-slot', 'class']
    });
    queue();
    return {
      refresh: () => queue(),
      update(next) { settings = next; queue(); },
      stop() { observer.disconnect(); clearTimeout(timer); }
    };
  }
  Object.assign(globalThis.YouTools, { createFilters });
})();
