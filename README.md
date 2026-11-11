# YouTools

YouTools is a browser extension for making desktop YouTube feel more like yours. Add convenient player buttons, choose which kinds of content appear, and arrange the sidebar around the links you use. It works in Brave and Chrome and saves your choices in your browser.

## What you can do

### Control your player

Add buttons beside YouTube’s Theater mode control:

- **Miniplayer** opens YouTube’s own in-page player, so you can keep browsing while you watch.
- **Picture-in-picture** opens a floating browser window that stays available while you use other apps or tabs.

Both buttons are optional. Miniplayer availability depends on YouTube and the video; picture-in-picture requires browser support and a playable video.

### Choose what you see

Independently show or hide:

- **Shorts videos**, including shelves and cards in feeds, search, and recommendations.
- **Shorts navigation**, including sidebar links, channel tabs, and filter chips.
- **Playables**, including game cards, shelves, and navigation.
- **Games**, including gaming navigation and dedicated game cards and shelves.
- **Primetime and movies**, including movie shelves, dedicated cards, and movie-store navigation.

Regular videos about games or movies stay visible, and direct links are not blocked. Ads and identified sponsored content are excluded from filtering; YouTools does not block or skip ads. Changes apply to open YouTube tabs, and turning a category back on restores it without a reload.

### Make the sidebar your own

- Show or hide sidebar sections and individual links.
- Drag sections and links into your preferred order; keyboard controls are available too.
- Replace the full subscriptions list with a compact shortcut.
- Move footer links into a **Site navigation** menu at the bottom of the sidebar.
- Give sidebar icons a YouTube-red accent.

YouTube’s own expandable groups and links continue to work. Available links depend on your account.

### Customize your YouTube app window

If you use YouTube as an installed browser app, choose a dark, light, or custom title-bar color. You can also use a short or custom page title. Page titles change in regular YouTube tabs too; title-bar appearance depends on the browser and operating system.

YouTools works on its own. If you also use the compatible PWA Customizer extension, the two can share YouTube’s title and color settings in the same browser profile.

## Getting started

1. Open `brave://extensions` in Brave or `chrome://extensions` in Chrome.
2. Turn on **Developer mode**.
3. Select **Load unpacked** and choose the `extension` folder inside this project.
4. Pin YouTools from the browser’s Extensions menu, then refresh any open YouTube tabs.
5. Click the YouTools toolbar icon to choose your settings.

No build or dependency installation is needed to load the extension. Keep the selected folder in place, or copy it to a local disk before loading it. After updating the unpacked extension, click **Reload** on its extensions page and refresh YouTube tabs. The popup shows the registered version.

The popup groups options under **Player controls**, **Suggested content**, **Customize sidebar**, and **Customize app window**. Visibility switches use **on = visible** and **off = hidden**. On a fresh install, YouTube’s normal content and sidebar remain visible; optional customizations start off. **Reset** restores those defaults and the original sidebar order.

## Privacy and compatibility

YouTools runs on desktop `youtube.com` and stores preferences locally in your browser profile. It has no account, analytics, external server, or remote code. Its only extension API permission is storage. When configured, it exchanges YouTube app-window settings locally with PWA Customizer. See [PRIVACY.md](PRIVACY.md) for details.

YouTube changes frequently, so some features may need updates as its interface changes. Some sidebar and filtering choices depend on English interface labels. Unknown content and sidebar entries are left visible.

## Development

The extension is built with JavaScript, HTML, and CSS. Node.js 20+ and Playwright are needed for development checks and tests, not for installation.

```sh
npm ci
npx playwright install chromium
npm run check
npm test
npm run package
```

The tests run the extension in isolated browser profiles against controlled fixtures. `dist/YouTools-0.6.1.zip` is the packaged extension; it has not been submitted to the store.

For PWA Customizer integration, both extensions must allowlist each other’s extension IDs. Unpacked IDs depend on their folder paths. After moving either project, run `node scripts/configure-pwa-sync.mjs` and reload both extensions; the sibling project is expected to be named `pwa customizer`. For store builds, pass both assigned IDs to that script before packaging. The promotional link in `extension/pwa-popup.js` also needs the actual listing URL before publication.

YouTools is an independent project and is not affiliated with YouTube or Google.
