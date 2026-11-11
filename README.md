# YouTools

A standalone Manifest V3 extension for desktop YouTube in Brave and Chrome.

The player controls are ordered **Miniplayer → Picture-in-picture → Theater mode**. Miniplayer opens YouTube's own in-page player; PiP opens the browser's floating video window. The matching native control/menu entry is hidden to avoid duplicates. YouTube's Miniplayer retains its normal expand and close controls.

Click the YouTools toolbar icon for player controls, content visibility, sidebar customization, and app-window settings. Visibility switches consistently mean **on = visible, off = hidden**. A fresh installation preserves YouTube's normal content and sidebar, so those switches start on; optional player buttons, red icons, condensed layouts, and app-window overrides start off.

| Content | Hidden when switched off |
| --- | --- |
| Shorts videos | Shorts shelves and video cards in feeds, search, and recommendations |
| Shorts navigation | Shorts sidebar links, channel tabs, and filter chips |
| Playables | Playable game cards, shelves, and navigation |
| Games | Gaming navigation, dedicated game cards, and game shelves |
| Primetime & movies | Primetime/movie shelves, dedicated movie cards, and movie-store navigation |

Changes apply to open YouTube tabs. Turning a visibility switch on restores matching elements without reloading. Reset restores normal visibility and ordering and switches optional customizations off. Updating the extension preserves explicitly saved preferences, including hide choices from older versions. Regular videos about games, movies, or Shorts stay visible. Direct links are not redirected or blocked.

Version 0.6.1 also recognizes movie/TV rating badges (including PG-13) on recommendation cards. It checks badge and metadata fields rather than matching ratings mentioned in video titles or descriptions. Recycled cards and late badge changes are rechecked; identified ads and sponsored cards stay visible.

Verification for 0.6.1: all 26 integration tests passed in an isolated Brave profile. No live debugging was performed for this release.

Ads and identified sponsored content are excluded from filtering, including sponsored movie promotions. YouTools does not intercept network requests, alter ad playback, skip ads, or modify YouTube's advertising systems. Browser features or other installed extensions operate independently.

## Install in Brave or Chrome

1. Open `brave://extensions` or `chrome://extensions`.
2. Turn on **Developer mode**.
3. Click **Load unpacked** and select this folder:

   `E:\Google Drive\My Drive\Projects\youtools\extension`

4. Pin YouTools using the browser's Extensions menu.
5. Refresh existing YouTube tabs and choose your options in the YouTools popup. Enabled player buttons appear immediately left of Theater mode.

The `extension` folder is ready to load; no build or dependency installation is required. Keep it in place while using the unpacked extension. You can copy it to a local disk first if you do not want the loaded extension to depend on Google Drive being available. To update it after source changes, click **Reload** on the extension card, then refresh YouTube.

`dist/YouTools-0.6.1.zip` contains the same extension with `manifest.json` at its root. It has not been submitted to the store. Configure the companion IDs described below before publishing or moving the unpacked extensions.

For updates to an unpacked extension, reload **YouTools itself** on the extensions page before refreshing YouTube. Refreshing YouTube or clearing its cache does not update the browser's registered content-script list. The version badge in the popup shows the version actually registered in the browser.

## Permissions and privacy

Site access is limited to `https://www.youtube.com/*` and `https://youtube.com/*`; embedded players and other YouTube subdomains are outside this scope. There is no access to other websites, browser history, cookies, downloads, or installed extensions.

The only extension API permission is `storage`, used to remember preferences, navigation order, and app-window settings in `chrome.storage.local`. It adds no additional site access. Settings stay in that browser profile; they are not synced between Brave and Chrome. A local service worker exchanges only YouTube app-window preferences with the configured PWA Customizer extension. There is no account, server, analytics, remote code, or dependency on another extension. See [PRIVACY.md](PRIVACY.md).

## Behavior and compatibility

- PiP requires a playable video and browser support. An error message appears if it cannot open. The original `disablepictureinpicture` preference, if present, is restored when PiP ends.
- Miniplayer uses YouTube's existing button where available, otherwise its native context-menu action. It does not rely on the removed `i` shortcut or private JavaScript player APIs. Full screen must be exited before using Miniplayer. YouTube can disallow Miniplayer for particular videos.
- YouTube changes its markup frequently. Unknown content remains visible. URL and renderer-based matching handles most filters; some shelf names, channel tabs, and menu fallbacks are specific to the English interface. The current Miniplayer icon is also recognized independently of the interface language.
- The main controls are added on `/watch` pages. YouTube SPA navigation and replacement player controls are handled automatically.

## Development and verification

The extension itself is plain JavaScript, HTML, and CSS. Node.js 20+ and Playwright are needed only for development tests and icon generation.

```sh
npm ci
npx playwright install chromium
npm run check
npm test
npm run package
```

The integration tests load the actual extension into a fresh browser profile. They cover independent filters, ads, recycled cards, saved popup preferences, SPA control replacement, native HTML-video PiP entry/exit, and the Miniplayer context-menu integration. They use controlled YouTube-shaped fixtures; they are not a guarantee about every live YouTube experiment.

For installed Brave on Windows:

```powershell
$env:YOUTOOLS_BROWSER = 'C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe'
npm.cmd test
node scripts/live-smoke.mjs
```

Google Drive streaming volumes may reject npm package extraction. Install development dependencies on a local disk and point the test helper there:

```powershell
$env:YOUTOOLS_TOOLING = Join-Path $env:LOCALAPPDATA 'YouTools-dev'
npm.cmd install --prefix $env:YOUTOOLS_TOOLING playwright@1.64.1
$env:YOUTOOLS_BROWSER = 'C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe'
npm.cmd test
```

The live smoke test uses a temporary, signed-out profile and writes results under `test-results/`. It does not attach to or change your personal browser profile. If YouTube requires sign-in/bot verification, it reports that limitation and continues checking search filtering. Do not use it to bypass YouTube's restrictions.

The integration suite covers native player behavior, normal-content defaults, Reset, nested menus, mouse dragging, keyboard ordering, linked Subscriptions switches, fixed Footer and Show more rows, per-entry visibility, native expansion, footer hover/keyboard access, and restoration of original links. The six app-window tests exercise both extensions, real cross-extension messages, UI edits, restoration, conflicting/stale saves, companion downtime, standalone operation, legacy preference migration, and mirroring without a companion website grant. Their temporary copies change only extension-ID allowlists and fixture host grants; runtime scripts are unchanged. Version 0.6.1 adds regression checks for movie rating badges, ad exclusions, recycled metadata, consistent visibility switches, and the placement of Red icons and the companion promotion. Testing uses isolated browser profiles. App-window checks verify document titles and theme-color metadata; the browser's native PWA frame remains browser-controlled.

Extension icons are exported from `icon/icon.svg` at 16, 32, 48, and 128 pixels. Version 0.5.2 includes the updated SVG and regenerated PNG files. Run `node scripts/generate-icons.mjs` to regenerate them after changing the source artwork.

Version 0.3.2 fixes the condensed Subscriptions shortcut's color and alignment. It uses YouTube's native link theme styling because some builds no longer expose the public text-color variable. Its icon, text, and row width were checked against Home in the signed-in Brave sidebar; all matched. All eleven integration tests passed again.

## Implementation references

- [Chrome content scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts)
- [Chrome local storage API](https://developer.chrome.com/docs/extensions/reference/api/storage)
- [Chrome video Picture-in-Picture](https://developer.chrome.com/blog/entering-picture-in-picture)

YouTools is an independent project, not affiliated with YouTube or Google.


## Sidebar customization

The popup opens with four collapsed menus: **Player controls**, **Suggested content**, **Customize sidebar**, and **Customize app window**. Player control icons are retained; suggested-content rows have no icons. Existing saved preferences are preserved. Optional customizations start off for new installations; Reset restores normal visibility and the original ordering.

Customize sidebar contains six nested menus: Top Menu, Subscriptions, You, Explore, More from YT, and Footer, followed by Red icons at the end. Drag the first five menu headings to reorder the corresponding sections. Their inline switches show sections when on and hide them when off. Footer is the last submenu and has no hide switch or drag handle.

Inside Top Menu, You, Explore, and More from YT, drag entries to reorder them. Inline switches show entries when on and hide them when off. Hiding a section also hides its entries; their individual choices are retained. The Top Menu Condensed Subscriptions switch shows the shortcut when on; it is linked to the Condensed subscriptions switch in the Subscriptions menu. Enabling it replaces the full channel list with the shortcut. This feature starts off.

You includes Your channel, History, Playlists, Watch later, Liked videos, Your videos, Downloads, Courses, and Show more. Explore includes Music, Live, Podcasts, Memberships, and Show more. More from YT includes YT TV, YT Music, and YT Kids. Show more is fixed at the end of both lists; switching it off also hides Show less. Controls only affect entries available on the current account. Unknown entries remain intact. Existing native nodes and click handlers are retained, including Downloads and expandable groups.

Drag handles also support Up/Down and Home/End keys. Ordering is saved independently of visibility and reapplied after navigation. Reordering within a section uses the existing slots, including slots behind Show more, so native expansion remains available.

**Condensed footer** moves Report history and all existing footer links into **Site navigation >**, at the bottom of the sidebar. Hover to open its flyout; click or use the keyboard to open it as well. Escape dismisses it. The original links, destinations, and handlers are preserved, and disabling the option restores their original locations. The footer cannot be hidden or reordered. The copyright notice stays visible in the original footer below Site navigation >.

Red icons colors expanded-sidebar icons #ff0033, while chevrons keep their native color. Channel avatars retain their original images. English interface labels are used to identify sidebar entries; labels in the extension's More from YT menu use YT.

## App-window customization (0.6.0)

**Recolor title bar** offers Force dark (`#202124`), Force light (`#F5F5F5`), and a custom color. Enter three or six hex digits or choose a color, then Apply. This changes the page's theme-color hint for supported installed-app title bars; regular desktop tabs may not visibly change. The browser still controls the native window frame.

**Change page title** offers Short page title (`YouTube`) or up to 200 characters of custom text. Apply or press Enter to save custom text. Titles also change in regular YouTube tabs. The browser may retain the installed app name in the native window title; this does not rename the installed application. Turning either feature off restores YouTube's current value and remembers your choices. Both switches start off.

PWA Customizer **1.4.0** adds the matching integration. When both updated extensions are installed in the same profile, they mirror these six fields: color enabled, color mode, custom color, title enabled, title mode, and custom title. The two supported YouTube origins share the same choices. Sidebar/player/filter settings and PWA Customizer settings for other sites are never exchanged. An untouched installation imports an existing choice; subsequent saves use the latest revision, with a deterministic tie-break for simultaneous edits. Edits made while the companion is disabled reconcile when it is reopened or YouTube is revisited. Reset in YouTools resets the mirrored app settings too.

YouTools applies the YouTube title and theme when both are available, avoiding competing DOM observers. PWA Customizer works independently when YouTools is absent. Mirroring does not grant PWA Customizer website access. Reload both extensions and open YouTube tabs/app windows after updating their unpacked files.

The promotion at the bottom of **Customize app window** is combined with the mirroring explanation. It links to the Chrome Web Store homepage and says the listing is coming soon. Replace the link in `extension/pwa-popup.js` with PWA Customizer's actual listing URL after publication.

### Companion identity for development and publication

Chrome requires the recipient's extension ID for [cross-extension messaging](https://developer.chrome.com/docs/extensions/develop/concepts/messaging#external). Both manifests allow only the companion ID; no webpages can send these messages. Each worker also validates the sender and accepts only the YouTube settings protocol.

These unpacked builds are configured for the current project folders, preserving their existing IDs and saved preferences. Unpacked IDs change when their full paths change. After moving either folder, run `node scripts/configure-pwa-sync.mjs` from the YouTools project, then reload both extensions. The sibling project folder is expected to be named `pwa customizer`.

For Web Store builds, obtain both assigned IDs from draft store items and run `node scripts/configure-pwa-sync.mjs YOUTOOLS_ID PWA_CUSTOMIZER_ID`, then package both projects. This updates both manifests' allowlists. Do not publish a ZIP still configured with development IDs. No installation-list or extra website permission is needed.

The title, theme, and value-normalization modules were copied from PWA Customizer into `pwa-title.js`, `pwa-theme.js`, and `pwa-shared.js`; they run entirely inside YouTools. Keep the identical `pwa-sync.js` files in both projects together when changing the protocol.
