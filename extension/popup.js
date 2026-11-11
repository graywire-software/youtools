(() => {
  'use strict';
  const tools = globalThis.YouTools;
  const form = document.querySelector('#settings');
  const fieldset = form.querySelector('fieldset');
  const reset = document.querySelector('#reset');
  const status = document.querySelector('#status');
  const main = document.querySelector('main');
  document.querySelector('.version').textContent = chrome.runtime.getManifest().version;
  let settings, dragging, blockDrag = false;
  const icons = {
    player: '<rect x="3" y="5" width="18" height="14"/><path d="m10 9 5 3-5 3z"/>',
    content: '<path d="M3 5h18M6 12h12M10 19h4"/><path d="m17 16 4 4m0-4-4 4"/>',
    sidebar: '<rect x="3" y="4" width="18" height="16"/><path d="M9 4v16M5 8h2m-2 4h2m-2 4h2"/>',
    mini: '<path d="M11 5h10v14H3v-7M3 5l6 6M3 10V5h5"/><rect x="12" y="12" width="6" height="4"/>',
    pip: '<rect x="3" y="5" width="18" height="14"/><rect x="12" y="11" width="6" height="5"/>',
    grip: '<path d="M8 5h.01M16 5h.01M8 12h.01M16 12h.01M8 19h.01M16 19h.01" stroke-width="3"/>',
    lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V6a4 4 0 0 1 8 0v4"/>',
    chevron: '<path d="m9 5 7 7-7 7"/>'
  };
  const svg = name => '<svg viewBox="0 0 24 24" aria-hidden="true">' + icons[name] + '</svg>';
  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  };
  function toggle(key, label, hide = false) {
    const wrap = el('label', 'visibility');
    wrap.title = label;
    const input = document.createElement('input');
    input.type = 'checkbox'; input.name = key;
    input.setAttribute('role', 'switch'); input.setAttribute('aria-label', label);
    if (hide) input.dataset.hide = '';
    const track = el('span', 'switch'); track.setAttribute('aria-hidden', 'true');
    wrap.append(input, track);
    return wrap;
  }
  function handle(label) {
    const button = el('button', 'drag-handle');
    button.type = 'button'; button.innerHTML = svg('grip');
    button.setAttribute('aria-label', 'Reorder ' + label);
    button.title = 'Drag to reorder, or use the up/down arrow keys';
    return button;
  }
  function menu(id, title, parent, { icon, reorder = false, hide } = {}) {
    const section = el('section', 'menu');
    section.dataset.menu = id;
    const heading = el('div', 'menu-heading');
    if (reorder) {
      section.classList.add('order-item'); section.dataset.entry = id;
      heading.draggable = true; heading.dataset.drag = '';
      heading.append(handle(title));
    }
    const button = el('button', 'menu-open');
    button.type = 'button'; button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-controls', 'panel-' + id);
    if (icon) { const span = el('span', 'menu-icon'); span.innerHTML = svg(icon); button.append(span); }
    const chevron = el('span', 'chevron'); chevron.innerHTML = svg('chevron');
    button.append(el('span', 'menu-title', title), chevron);
    const panel = el('div', 'menu-panel');
    panel.id = 'panel-' + id; panel.hidden = true;
    heading.append(button);
    if (hide) heading.append(toggle(hide, 'Show ' + title + ' section', true));
    section.append(heading, panel); parent.append(section);
    button.addEventListener('click', () => {
      panel.hidden = !panel.hidden;
      button.setAttribute('aria-expanded', String(!panel.hidden));
    });
    return panel;
  }
  function setting(parent, key, label, description, icon, aria = label) {
    const row = el('div', 'setting');
    if (icon) { const span = el('span', 'setting-icon'); span.innerHTML = svg(icon); row.append(span); }
    const copy = el('span', 'setting-copy');
    copy.append(el('strong', '', label));
    if (description) copy.append(el('small', '', description));
    row.append(copy, toggle(key, aria, key.startsWith('hide'))); parent.append(row);
  }
  function list(parent, orderKey) {
    const node = el('div', 'order-list'); node.dataset.orderList = orderKey;
    parent.append(node); return node;
  }
  const player = menu('player', 'Player controls', fieldset, { icon: 'player' });
  setting(player, 'showMiniplayerButton', 'Miniplayer button', 'Keep watching while browsing YT', 'mini', 'Show Miniplayer button');
  setting(player, 'showPipButton', 'Picture-in-picture button', 'Watch in a floating window', 'pip', 'Show Picture-in-picture button');
  const content = menu('content', 'Suggested content', fieldset, { icon: 'content' });
  content.append(el('p', 'help', 'On shows content. Off hides it.'));
  setting(content, 'hideShorts', 'Shorts videos', 'Shelves and short-form video cards', null, 'Show Shorts videos');
  setting(content, 'hidePlayables', 'Playables', 'Playable game cards and shelves', null, 'Show Playables');
  setting(content, 'hideGames', 'Games', 'Gaming navigation and game shelves', null, 'Show Games');
  setting(content, 'hideMovies', 'Primetime & movies', 'Movie cards, rating badges, shelves, and store navigation', null, 'Show Primetime and movies');
  const sidebar = menu('sidebar', 'Customize sidebar', fieldset, { icon: 'sidebar' });
  sidebar.append(el('p', 'help', 'Drag menu headings to reorder sections. On shows a section; off hides it and its entries. Use Up/Down on a drag handle with the keyboard.'));
  const sections = list(sidebar, 'sectionOrder');
  for (const group of tools.sidebarMenus) {
    const panel = menu(group.id, group.label, group.id === 'footer' ? sidebar : sections, { reorder: group.id !== 'footer', hide: group.hide });
    if (group.entries) {
      panel.append(el('p', 'help', group.id === 'top'
        ? 'Drag to reorder. On shows an entry; off hides it. Condensed Subscriptions replaces the full channel list with a shortcut.'
        : 'Drag to reorder. On shows an entry; off hides it. Entries appear when available in your account.' + (group.entries.some(item => item.pinned) ? ' Show more stays last.' : '')));
      const entries = list(panel, group.order);
      for (const item of group.entries) {
        const row = el('div', 'entry-row order-item');
        row.dataset.entry = item.id;
        if (item.pinned) {
          row.dataset.pinned = '';
          const lock = el('span', 'pinned'); lock.innerHTML = svg('lock'); lock.title = 'Always last';
          row.append(lock);
        } else {
          row.draggable = true; row.dataset.drag = ''; row.append(handle(item.label));
        }
        row.append(el('span', 'entry-title', item.label), toggle(item.setting, item.enable ? 'Show condensed Subscriptions' : 'Show ' + item.label, !item.enable));
        entries.append(row);
      }
    } else if (group.id === 'subscriptions') {
      setting(panel, 'condensedSubscriptions', 'Condensed subscriptions', 'Replace the channel list with one Subscriptions shortcut in Top Menu. This is the same switch as the Top Menu shortcut.');
    } else if (group.id === 'footer') {
      panel.append(el('p', 'help', 'Footer stays at the bottom and cannot be hidden or reordered.'));
      setting(panel, 'condensedFooter', 'Condensed footer', 'Place Report history and all footer links in Site navigation >. Open it by hovering, clicking, or using the keyboard.');
    }
  }
  setting(sidebar, 'redSidebarIcons', 'Red icons', 'YT red for sidebar icons');
  const message = (text, error = false) => { status.textContent = text; status.classList.toggle('error', error); };
  function render() {
    if (!settings) return;
    for (const input of form.querySelectorAll('input')) {
      if (!(input.name in tools.defaults)) continue;
      const visibility = input.hasAttribute('data-hide');
      input.checked = visibility ? !settings[input.name] : settings[input.name];
      if (visibility) input.closest('.order-item')?.classList.toggle('is-hidden', !input.checked);
    }
    for (const group of form.querySelectorAll('[data-order-list]')) {
      settings[group.dataset.orderList].forEach((id, index) => {
        const row = [...group.children].find(node => node.dataset.entry === id);
        if (row && group.children[index] !== row) group.insertBefore(row, group.children[index] || null);
      });
    }
  }
  async function save(values) {
    fieldset.disabled = true; reset.disabled = true;
    try {
      await chrome.storage.local.set(values);
      settings = tools.normalize({ ...settings, ...values });
      message('Preferences saved on this browser'); return true;
    } catch { message('Could not save. Please try again.', true); return false; }
    finally { render(); fieldset.disabled = false; reset.disabled = false; }
  }
  form.addEventListener('submit', event => event.preventDefault());
  form.addEventListener('change', event => {
    const input = event.target;
    if (input.matches('input[type="checkbox"]') && input.name in tools.defaults) {
      save({ [input.name]: input.hasAttribute('data-hide') ? !input.checked : input.checked });
    }
  });
  async function move(group, id, target) {
    const key = group.dataset.orderList;
    const order = [...settings[key]];
    const row = [...group.children].find(node => node.dataset.entry === id);
    if (!row || row.hasAttribute('data-pinned')) return;
    const last = order.length - 1 - group.querySelectorAll(':scope > [data-pinned]').length;
    target = Math.max(0, Math.min(last, target));
    const index = order.indexOf(id);
    if (index === target) return;
    order.splice(index, 1); order.splice(target, 0, id);
    if (await save({ [key]: order })) {
      row.querySelector('.drag-handle')?.focus({ preventScroll: true });
      message('Order saved');
    }
  }
  form.addEventListener('keydown', event => {
    if (!event.target.matches('.drag-handle') || !['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const row = event.target.closest('.order-item'), group = row.parentElement;
    const order = settings[group.dataset.orderList], index = order.indexOf(row.dataset.entry);
    const target = event.key === 'Home' ? 0 : event.key === 'End' ? order.length - 1 : index + (event.key === 'ArrowUp' ? -1 : 1);
    move(group, row.dataset.entry, target);
  });
  form.addEventListener('pointerdown', event => { blockDrag = !!event.target.closest('.visibility'); });
  const clearDrop = () => form.querySelectorAll('.drop-before,.drop-after').forEach(row => row.classList.remove('drop-before', 'drop-after'));
  form.addEventListener('dragstart', event => {
    const source = event.target.closest('[data-drag]');
    const row = source?.closest('.order-item');
    if (!row || blockDrag || fieldset.disabled) { event.preventDefault(); return; }
    dragging = { row, group: row.parentElement };
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', row.dataset.entry);
    event.dataTransfer.setDragImage(source, 10, 15);
    row.classList.add('dragging');
    event.stopPropagation();
  });
  function dropTarget(event) {
    if (!dragging) return null;
    let row = event.target.closest('.order-item');
    while (row && row.parentElement !== dragging.group) row = row.parentElement.closest('.order-item');
    if (!row || row === dragging.row) return null;
    const rect = (row.querySelector(':scope > .menu-heading') || row).getBoundingClientRect();
    return { row, after: !row.hasAttribute('data-pinned') && event.clientY > rect.top + rect.height / 2 };
  }
  form.addEventListener('dragover', event => {
    if (!dragging) return;
    event.preventDefault(); event.dataTransfer.dropEffect = 'move';
    const bounds = main.getBoundingClientRect();
    if (event.clientY < bounds.top + 36) main.scrollTop -= 12;
    else if (event.clientY > bounds.bottom - 36) main.scrollTop += 12;
    clearDrop();
    const target = dropTarget(event);
    if (target) target.row.classList.add(target.after ? 'drop-after' : 'drop-before');
  });
  form.addEventListener('drop', event => {
    if (!dragging) return;
    event.preventDefault();
    const target = dropTarget(event);
    if (target) {
      const order = settings[dragging.group.dataset.orderList].filter(id => id !== dragging.row.dataset.entry);
      const index = order.indexOf(target.row.dataset.entry) + (target.after ? 1 : 0);
      move(dragging.group, dragging.row.dataset.entry, index);
    }
    clearDrop();
  });
  form.addEventListener('dragend', () => {
    dragging?.row.classList.remove('dragging'); dragging = null; clearDrop();
  });
  reset.addEventListener('click', async () => {
    if (globalThis.YouToolsPwa && !await globalThis.YouToolsPwa.reset()) return;
    await save(tools.defaults);
  });
  chrome.storage.onChanged.addListener(async (_, area) => {
    if (area !== 'local') return;
    try { settings = await tools.readSettings(); if (!dragging) render(); } catch { /* Popup closed. */ }
  });
  tools.readSettings().then(value => {
    settings = value; render(); fieldset.disabled = false; reset.disabled = false;
    message('Preferences saved locally');
  }).catch(() => message('Could not load preferences. Reopen YouTools.', true));
})();
