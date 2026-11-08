# Music Enhancer

A lightweight, settings-first browser extension for YouTube Music.

## Develop and test

```sh
npm install
npm run dev       # preview the settings page in Vite
npm test          # DOM regression tests and Chrome/Firefox build validation
npm run build     # build a loadable extension in dist/
npx playwright install chromium  # one-time browser test setup
npm run test:browser             # real-site, headless extension checks
npm run test:library-view        # native cards in a Library test shell
```

Load `dist/` as an unpacked extension after building in Chrome or Edge. For Firefox, load `dist/firefox/`. The settings page uses React, Tailwind CSS, and official shadcn/ui components backed by Radix. Everything is bundled locally. The YouTube Music content scripts do not load React.

## Load it in Chrome or Edge

1. Open `chrome://extensions`.
2. Turn on **Developer mode**.
3. Choose **Load unpacked** and select the built `dist/` folder.
4. Click the Music Enhancer toolbar icon; it opens the full settings page, not a popup.

There is intentionally no toolbar popup. Clicking the toolbar icon opens the full settings page. Settings can be previewed in a normal browser through Vite, where they persist in local storage, or in Chrome as an extension options page, where they persist through `chrome.storage.local`.

**Larger player bar** enlarges playback buttons, like/dislike controls, artwork, and the seek track together. Turning it off restores original inline styles. The existing `largeProgress` storage preference is retained for upgrades. Choose **Top** or **Bottom** for the player bar in Player settings.

Playlist quick actions, shuffle play, menu/button colors, and side-play are still initial implementations. In particular, the side-play iframe may be restricted by YouTube Music's embedding policy. See `IDEAS.md` for remaining work rather than treating a visible setting as proof of live-site validation.

Fresh installs hide the New playlist sidebar button and enable Like and Add to queue song-row actions. Side play and Remove from playlist can be enabled in settings. Shuffle play and compact layouts are opt-in; saved preferences are kept.

## Sidebar and caching

- **Quiet playlist sidebar** is on by default: hides owner and “Auto playlist” subtitles while keeping the original row height. Turn it off to show subtitles again.
- **Compact playlist sidebar** shortens playlist rows and uses smaller artwork independently of quiet mode.
- **Playlist icons** controls only the lower playlist list and its narrow-rail mirrors. It shows artwork when available or a leading playlist glyph otherwise. It is independent of quiet mode. Top navigation and added shortcuts always keep their icons, even when playlist icons are off.
- **Compact top navigation** uses shorter navigation rows and 20 px icons for native destinations and added shortcuts, including the narrow rail. Turning it off restores native icon sizes and 24 px shortcut icons; native icon designs are preserved.
- Native destinations and added shortcuts share one route-based active state in both sidebar modes. Playlists highlights on its own page rather than leaving Explore or Library selected; back/forward navigation and reloads update the highlight too. Keyboard focus remains separate from the active page.
- Sidebar playlists use 40 px artwork/fallback slots. The narrow rail keeps navigation fixed above an independently scrolling playlist list, with ellipsized names and full-name tooltips; fluid row widths leave room for the scrollbar without clipping icons or labels.
- Playlists is the only added shortcut enabled on a fresh installation. Previously saved shortcut toggles are preserved. Old ordering data is migrated to put Home and Explore back before Library.
- Native destinations and added shortcuts follow the same saved order. Supported library shortcuts use YouTube Music's SPA router instead of reloading the page and interrupting playback. Modified clicks retain normal browser behavior.
- Downloads points to `https://music.youtube.com/browse/FEmusic_offline`. Old preset URLs migrate automatically.
- Artwork URLs from rendered playlists are cached locally for seven days, with an SVG fallback for playlists without artwork. No audio is cached.
- Explore saves up to six sections of links and artwork URLs for six hours. Reopening Explore can show this saved preview while the native page loads; fresh native content replaces it. The first visit still needs to load normally, and images rely on the browser's own image cache. This is not an offline copy or a guarantee of instant navigation.

## Library layout

A List view/Grid view dropdown appears beside the native sort control on Library pages and matches its styling. List mode changes the card container to vertical rows with 56 px artwork, rather than just stretching individual grid cards. Grid mode restores original styles. The choice is stored locally and updates across tabs. Sort changes and newly loaded rows retain the selector; recommendation carousels and non-Library pages are not restyled.

`npm run test:library-view` checks toolbar geometry, keyboard selection, persistence, late-loaded cards, and restoration in headless Chromium. It uses real public YouTube Music cards inside a Library fixture because the test profile is not signed in.

The custom comments drawer and its button have been removed. Use YouTube Music's native comments interface. The extension does not request comment APIs or read session cookies.

`npm test` covers DOM regressions and both extension build variants. `npm run test:browser` loads the actual extension in headless Chromium with an isolated profile at `.dev/chrome-profile`. It resets extension settings in that test profile, mutes audio, checks live Playlists navigation without a document reload, exercises shortcut toggles/reordering from settings, measures player controls, and checks settings at four viewport widths in both themes. Evidence is saved under `.dev/evidence/`, not committed. The test does not read or modify another project's browser profile.

Private library rows still need signed-in live-site validation. After rebuilding, reload the extension **and the YouTube Music tab**.

Playlist enhancement ideas were informed by [gormanity/ytm-enhancer](https://github.com/gormanity/ytm-enhancer), an MIT-licensed project. This extension is independent and is not affiliated with YouTube, Google, or the referenced project.
