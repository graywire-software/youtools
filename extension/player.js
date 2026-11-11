(() => {
  'use strict';
  const ICONS = {
    pip: '<path d="M3 5h18v14H3V5Zm0 0v14h18V5H3Z" fill="none" stroke="currentColor" stroke-width="1.8"/><rect x="12" y="11" width="7" height="5" rx=".7" fill="currentColor"/>',
    mini: '<path d="M11 5h10v14H3v-7M3 5l6 6M3 10V5h5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><rect x="12" y="12" width="6" height="4" rx=".6" fill="currentColor"/>'
  };
  function isMiniplayerItem(item) {
    const label = item.querySelector('.ytp-menuitem-label')?.textContent.trim() || '';
    if (/^(mini[ -]?player|mini[ -]?lecteur|minirreproductor|mini[ -]?reproductor|miniplayer (\(i\))?|ミニプレーヤー|미니 플레이어)$/i.test(label)) return true;
    // Current YouTube Miniplayer icon, independent of interface language. This
    // deliberately fails closed if YouTube changes both the label and icon.
    return [...item.querySelectorAll('.ytp-menuitem-icon path')].some(path =>
      (path.getAttribute('d') || '').includes('M13 16V13H18V16H13Z')
    );
  }
  function createPlayerTools() {
    let settings = {};
    let current;
    let timer;
    let toastTimer;
    let awaitingMini = false;

    function notify(message) {
      if (!current?.player.isConnected) return;
      let toast = current.player.querySelector('.youtools-toast');
      if (!toast) {
        toast = document.createElement('div');
        toast.className = 'youtools-toast';
        toast.setAttribute('role', 'status');
        current.player.append(toast);
      }
      toast.textContent = message;
      toast.hidden = false;
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => { toast.hidden = true; }, 5000);
    }
    function button(kind, label, action) {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = `ytp-button youtools-button youtools-${kind}-button`;
      el.setAttribute('aria-label', label);
      el.setAttribute('aria-pressed', 'false');
      el.title = label;
      el.innerHTML = `<svg aria-hidden="true" viewBox="2 2 20 20" width="36" height="36">${ICONS[kind]}</svg>`;
      el.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); action(); });
      return el;
    }
    async function togglePip() {
      const video = current?.player.querySelector('video');
      if (!video) return notify('Start a video to use picture-in-picture.');
      try {
        if (document.pictureInPictureElement) {
          await document.exitPictureInPicture();
        } else {
          if (!document.pictureInPictureEnabled || !video.requestPictureInPicture) return notify('Picture-in-picture is not available in this browser.');
          if (!video.readyState) return notify('Start the video, then try picture-in-picture again.');
          // Restoring disablepictureinpicture while PiP is open makes Chromium
          // close it. Restore the site's preference when this PiP session ends.
          const disabled = video.hasAttribute('disablepictureinpicture');
          const value = video.getAttribute('disablepictureinpicture');
          const restore = () => { if (disabled) video.setAttribute('disablepictureinpicture', value || ''); };
          try {
            video.removeAttribute('disablepictureinpicture');
            if (disabled) video.addEventListener('leavepictureinpicture', restore, { once: true });
            await video.requestPictureInPicture();
          } catch (error) {
            video.removeEventListener('leavepictureinpicture', restore);
            restore();
            throw error;
          }
        }
      } catch {
        notify('Picture-in-picture could not open. Start playback and try again.');
      }
      syncState();
    }
    function contextMenus(player) {
      // YouTube may portal its popup into a container outside #movie_player.
      // Ignore menus belonging to another player, such as a thumbnail preview.
      return [...document.querySelectorAll('.ytp-contextmenu')].filter(menu => {
        const owner = menu.closest('.html5-video-player,#movie_player');
        return !owner || owner === player;
      });
    }
    function activeMenus(player) {
      return contextMenus(player).filter(menu => !menu.hidden && menu.getAttribute('aria-hidden') !== 'true' && getComputedStyle(menu).display !== 'none');
    }
    function activateMenuItem(player) {
      const item = activeMenus(player).flatMap(menu => [...menu.querySelectorAll('.ytp-menuitem')]).find(isMiniplayerItem);
      if (!item || item.getAttribute('aria-disabled') === 'true' || item.style.display === 'none') return false;
      item.click();
      return true;
    }
    function minimized() {
      return !!document.querySelector('#movie_player.ytp-player-minimized,ytd-miniplayer[active],ytd-miniplayer.ytdMiniplayerComponentVisible');
    }
    async function waitUntil(check, timeout) {
      const deadline = performance.now() + timeout;
      do {
        if (check()) return true;
        await new Promise(resolve => setTimeout(resolve, 40));
      } while (performance.now() < deadline);
      return check();
    }
    async function toggleMini() {
      if (awaitingMini || !current) return;
      if (document.fullscreenElement) return notify('Exit full screen to use YouTube’s Miniplayer.');
      const { player } = current;
      awaitingMini = true;
      try {
        if (document.pictureInPictureElement) await document.exitPictureInPicture();
        const native = player.querySelector('.ytp-miniplayer-button');
        let activated = false;
        if (native && !native.disabled && native.getAttribute('aria-disabled') !== 'true' && native.style.display !== 'none') {
          native.click();
          activated = true;
        } else {
          // Hide the temporary menu even when YouTube portals it outside the
          // player; activate its own action as soon as it has rendered.
          document.documentElement.classList.add('youtools-opening-miniplayer');
          const bounds = player.getBoundingClientRect();
          player.dispatchEvent(new MouseEvent('contextmenu', {
            bubbles: true, cancelable: true, button: 2, view: window,
            clientX: bounds.left + bounds.width / 2, clientY: bounds.top + bounds.height / 2
          }));
          activated = await waitUntil(() => activateMenuItem(player), 800);
        }
        if (!activated || !await waitUntil(minimized, 1500)) {
          for (const menu of activeMenus(player)) {
            menu.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true, cancelable: true }));
          }
          notify('YouTube’s Miniplayer is unavailable for this video.');
        }
      } catch {
        notify('YouTube’s Miniplayer could not open. Please try again.');
      } finally {
        document.documentElement.classList.remove('youtools-opening-miniplayer');
        awaitingMini = false;
      }
    }
    function syncState() {
      if (!current) return;
      const { player, pip, mini } = current;
      const inPip = !!document.pictureInPictureElement && player.contains(document.pictureInPictureElement);
      const label = inPip ? 'Exit picture-in-picture' : 'Picture-in-picture';
      pip.setAttribute('aria-pressed', String(inPip));
      pip.setAttribute('aria-label', label);
      pip.title = label;
      mini.disabled = !!document.fullscreenElement;
      mini.title = mini.disabled ? 'Miniplayer is unavailable in full screen' : 'Miniplayer';
    }
    function refresh() {
      timer = undefined;
      const player = document.getElementById('movie_player');
      const theater = player?.querySelector('.ytp-size-button');
      if (location.pathname !== '/watch' || !theater) {
        document.querySelectorAll('[data-youtools-miniplayer-menu]').forEach(item => item.removeAttribute('data-youtools-miniplayer-menu'));
        if (current) {
          current.pip.remove(); current.mini.remove();
          for (const attr of ['data-youtools-player', 'data-youtools-mini', 'data-youtools-pip']) current.player.removeAttribute(attr);
        }
        return;
      }
      if (current?.player !== player) {
        current?.pip.remove();
        current?.mini.remove();
        if (current) for (const attr of ['data-youtools-player', 'data-youtools-mini', 'data-youtools-pip']) current.player.removeAttribute(attr);
        current = { player, pip: button('pip', 'Picture-in-picture', togglePip), mini: button('mini', 'Miniplayer', toggleMini) };
      }
      const { pip, mini } = current;
      player.toggleAttribute('data-youtools-player', !!(settings.showMiniplayerButton || settings.showPipButton));
      player.toggleAttribute('data-youtools-mini', !!settings.showMiniplayerButton);
      player.toggleAttribute('data-youtools-pip', !!settings.showPipButton);
      // Insert in the Theater button's own group (2025+ layouts nest controls).
      if (settings.showPipButton) { if (theater.previousElementSibling !== pip) theater.before(pip); }
      else pip.remove();
      if (settings.showMiniplayerButton) {
        const anchor = settings.showPipButton ? pip : theater;
        if (anchor.previousElementSibling !== mini) anchor.before(mini);
      } else mini.remove();
      // Moving the action out of the context menu avoids a duplicate entry.
      for (const menu of contextMenus(player)) {
        menu.querySelectorAll('.ytp-menuitem').forEach(item => {
          item.toggleAttribute('data-youtools-miniplayer-menu', !!settings.showMiniplayerButton && isMiniplayerItem(item));
        });
      }
      syncState();
    }
    function schedule() { timer ??= setTimeout(refresh, 100); }
    const observer = new MutationObserver(records => {
      if (records.some(record => record.type === 'childList')) schedule();
    });
    observer.observe(document, { childList: true, subtree: true });
    document.addEventListener('enterpictureinpicture', syncState, true);
    document.addEventListener('leavepictureinpicture', syncState, true);
    document.addEventListener('fullscreenchange', syncState);
    schedule();
    return { refresh: schedule, update(next) { settings = next; schedule(); } };
  }
  Object.assign(globalThis.YouTools, { createPlayerTools });
})();
