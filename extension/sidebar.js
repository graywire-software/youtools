(() => {
  'use strict';
  const tools = globalThis.YouTools;
  const ENTRY = 'ytd-guide-entry-renderer';
  const title = section => [...section.querySelectorAll('#guide-section-title,#header .title,#header')]
    .map(el => el.textContent.trim().toLowerCase()).find(Boolean) || '';
  const label = entry => (entry.querySelector('.title')?.textContent || entry.querySelector('a')?.title || '').trim().toLowerCase().replace(/^youtube /, 'yt ');
  const nativeNode = entry => entry.closest('ytd-guide-downloads-entry-renderer') || entry;

  function createSidebar(initial) {
    let settings = tools.normalize(initial), timer, footerState;
    const originalOrders = new WeakMap();
    function sortNodes(scope, key, entries) {
      const defaults = tools.defaults[key], order = settings[key];
      const custom = order.some((id, index) => id !== defaults[index]);
      let saved = originalOrders.get(scope);
      if (!custom && !saved?.has(key)) return;
      const current = Object.keys(entries).filter(id => entries[id]?.isConnected).sort((a, b) =>
        entries[a].compareDocumentPosition(entries[b]) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1);
      if (!saved) { saved = new Map(); originalOrders.set(scope, saved); }
      if (custom && !saved.has(key)) saved.set(key, current);
      const desired = custom ? order : [...saved.get(key), ...defaults.filter(id => !saved.get(key).includes(id))];
      const wanted = desired.filter(id => current.includes(id));
      if (wanted.some((id, index) => id !== current[index])) {
        // Keep native nodes and their listeners. Slots can span the collapsed
        // and expanded parts of a section; the native expand controls stay put.
        const slots = current.map(id => {
          const marker = document.createComment('YouTools order slot');
          entries[id].before(marker); return marker;
        });
        wanted.forEach((id, index) => slots[index].replaceWith(entries[id]));
      }
      if (!custom) saved.delete(key);
    }
    function restoreFooter() {
      const state = footerState;
      if (!state) return;
      clearTimeout(state.closeTimer);
      if (state.panel.matches(':popover-open')) state.panel.hidePopover();
      for (const { node, marker, parent } of state.moved) {
        if (node.isConnected) {
          if (marker.isConnected) marker.replaceWith(node);
          else if (parent.isConnected) parent.append(node);
        }
        marker.remove();
      }
      state.footer.removeAttribute('data-youtools-condensed-footer');
      state.block.remove(); footerState = null;
    }
    function moveIntoFooter(state, node, before = null) {
      if (!node || state.panel.contains(node)) return;
      const marker = document.createComment('YouTools footer position'), parent = node.parentElement;
      node.before(marker); state.moved.push({ node, marker, parent });
      state.panel.insertBefore(node, before);
    }
    function populateFooter(state, reportNode) {
      moveIntoFooter(state, reportNode, state.panel.firstChild);
      for (const child of [...state.footer.children]) {
        if (!child.matches('#copyright') && !child.querySelector('#copyright')) moveIntoFooter(state, child);
      }
      state.footer.setAttribute('data-youtools-condensed-footer', '');
    }
    function updateFooter(guide) {
      if (footerState && (footerState.guide !== guide || !footerState.block.isConnected ||
          guide.querySelector('#footer') !== footerState.footer)) restoreFooter();
      if (!settings.condensedFooter) { restoreFooter(); return; }
      const footer = guide.querySelector('#footer');
      if (!footer) return;
      const report = [...guide.querySelectorAll(ENTRY)].find(entry => label(entry) === 'report history');
      const reportSection = report?.closest('ytd-guide-section-renderer');
      const reportNode = reportSection?.querySelectorAll(ENTRY).length === 1 ? reportSection : report;
      // The lower guide sections may arrive after the footer has been condensed.
      if (footerState) { populateFooter(footerState, reportNode); return; }
      const block = document.createElement('div');
      block.setAttribute('data-youtools-footer-menu', '');
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'yt-simple-endpoint';
      button.textContent = 'Site navigation >';
      button.setAttribute('aria-expanded', 'false');
      button.setAttribute('aria-controls', 'youtools-site-navigation');
      const panel = document.createElement('div');
      panel.id = 'youtools-site-navigation'; panel.setAttribute('popover', 'auto');
      panel.setAttribute('data-youtools-site-panel', '');
      panel.setAttribute('role', 'region'); panel.setAttribute('aria-label', 'Site navigation');
      block.append(button, panel); footer.before(block);
      const state = footerState = { guide, footer, block, button, panel, moved: [], closeTimer: undefined };
      populateFooter(state, reportNode);
      const open = () => {
        clearTimeout(state.closeTimer);
        if (!panel.isConnected) return;
        const rect = button.getBoundingClientRect();
        panel.style.left = Math.max(8, Math.min(rect.right + 4, innerWidth - 288)) + 'px';
        panel.style.top = '8px';
        if (!panel.matches(':popover-open')) panel.showPopover();
        panel.style.top = Math.max(8, Math.min(rect.top, innerHeight - panel.getBoundingClientRect().height - 8)) + 'px';
        button.setAttribute('aria-expanded', 'true');
      };
      const close = () => {
        if (panel.matches(':popover-open')) panel.hidePopover();
        button.setAttribute('aria-expanded', 'false');
      };
      const leave = () => {
        clearTimeout(state.closeTimer);
        state.closeTimer = setTimeout(() => {
          if (!block.matches(':hover') && !panel.matches(':hover') && !block.contains(document.activeElement)) close();
        }, 180);
      };
      button.addEventListener('mouseenter', open);
      block.addEventListener('mouseleave', leave);
      panel.addEventListener('mouseenter', () => clearTimeout(state.closeTimer));
      panel.addEventListener('mouseleave', leave);
      block.addEventListener('focusout', leave);
      button.addEventListener('click', () => panel.matches(':popover-open') ? close() : open());
      button.addEventListener('keydown', event => {
        if (['ArrowRight', 'ArrowDown'].includes(event.key)) {
          event.preventDefault(); open(); panel.querySelector('a[href]')?.focus();
        }
      });
      panel.addEventListener('keydown', event => {
        if (event.key === 'Escape') { event.preventDefault(); close(); button.focus(); }
      });
      panel.addEventListener('toggle', () => button.setAttribute('aria-expanded', String(panel.matches(':popover-open'))));
    }
    function refresh() {
      timer = undefined;
      const guide = document.querySelector('ytd-guide-renderer');
      if (!guide) { if (footerState && !footerState.guide.isConnected) restoreFooter(); return; }
      guide.toggleAttribute('data-youtools-red-icons', settings.redSidebarIcons);
      for (const icon of guide.querySelectorAll('yt-icon')) {
        const entry = icon.closest(ENTRY);
        icon.toggleAttribute('data-youtools-chevron', !!entry && /^(show more|show less)$/.test(label(entry)));
      }
      guide.querySelectorAll('[data-youtools-sidebar-hidden]').forEach(el => el.removeAttribute('data-youtools-sidebar-hidden'));
      const hide = el => el?.setAttribute('data-youtools-sidebar-hidden', '');
      const sections = [...guide.querySelectorAll('ytd-guide-section-renderer')];
      const home = [...guide.querySelectorAll(ENTRY)].find(e => e.querySelector('a[href="/"]'));
      const sectionMap = { top: home?.closest('ytd-guide-section-renderer') };
      for (const section of sections) {
        const heading = title(section);
        if (heading === 'subscriptions') sectionMap.subscriptions = section;
        if (heading === 'you') sectionMap.you = section;
        if (heading === 'explore') sectionMap.explore = section;
        if (/^more from (youtube|yt)$/.test(heading)) sectionMap.more = section;
      }
      const group = home?.parentElement;
      const primary = group ? [...group.children].filter(e => e.matches(ENTRY)) : [];
      const shorts = primary.find(e => e.querySelector('a[title="Shorts"],a[href^="/shorts"]'));
      const native = primary.find(e => e.querySelector('a[href="/feed/subscriptions"]'));
      let shortcut = guide.querySelector('[data-youtools-subscriptions]');
      if (settings.condensedSubscriptions && sectionMap.subscriptions && home) {
        hide(sectionMap.subscriptions);
        if (native) { shortcut?.remove(); shortcut = null; }
        else {
          if (!shortcut) {
            shortcut = document.createElement('a'); shortcut.className = 'yt-simple-endpoint';
            shortcut.setAttribute('data-youtools-subscriptions', ''); shortcut.href = '/feed/subscriptions';
            shortcut.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3h14M3 6h18M3 9h18v12H3z" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="m10 12 5 3-5 3z" fill="currentColor"/></svg><span>Subscriptions</span>';
          }
          if (shortcut.parentElement !== group) (shorts || home).after(shortcut);
        }
      } else { shortcut?.remove(); shortcut = null; }
      if (settings.hideHome) hide(home);
      if (settings.hideShortsNavigation) hide(shorts);
      if (group) sortNodes(group, 'sidebarOrder', { home, shorts, subscriptions: native || shortcut });

      for (const menu of tools.sidebarMenus) {
        const section = sectionMap[menu.id];
        if (!section) continue;
        if (settings[menu.hide]) hide(section);
        if (!menu.entries || menu.id === 'top') continue;
        const entries = [...section.querySelectorAll(ENTRY)], nodes = {};
        for (const item of menu.entries) {
          const matches = entries.filter(entry => item.pinned ? /^(show more|show less)$/.test(label(entry)) : label(entry) === item.label.toLowerCase());
          if (settings[item.setting]) matches.forEach(entry => hide(nativeNode(entry)));
          if (!item.pinned && matches.length) nodes[item.id] = nativeNode(matches[0]);
        }
        sortNodes(section, menu.order, nodes);
      }
      // Footer is deliberately excluded: it is fixed and has no hide preference.
      sortNodes(guide, 'sectionOrder', sectionMap);
      updateFooter(guide);
    }
    const schedule = () => { timer ??= setTimeout(refresh, 100); };
    new MutationObserver(records => {
      if (records.some(record => {
        const target = record.target.nodeType === Node.TEXT_NODE ? record.target.parentElement : record.target;
        return target instanceof Element && (target.closest('ytd-guide-renderer') ||
          [...record.addedNodes].some(node => node instanceof Element && (node.matches('ytd-guide-renderer') || node.querySelector('ytd-guide-renderer'))));
      })) schedule();
    }).observe(document, { childList: true, subtree: true, characterData: true });
    schedule();
    return { update(next) { settings = tools.normalize(next); schedule(); }, refresh: schedule };
  }
  Object.assign(tools, { createSidebar });
})();
