# Music Enhancer

A lightweight, settings-first browser extension for YouTube Music.

## Develop and test

```sh
npm install
npm run dev       # preview the settings page in Vite
npm test          # extension and settings smoke tests
npm run build     # build a loadable extension in dist/
```

Load `dist/` as an unpacked extension after building in Chrome or Edge. For Firefox, load `dist/firefox/`. Vite is used for the options-page preview and production build; the extension itself has no runtime dependencies.

## Load it in Chrome or Edge

1. Open `chrome://extensions`.
2. Turn on **Developer mode**.
3. Choose **Load unpacked** and select this folder.
4. Click the Music Enhancer toolbar icon; it opens the full settings page, not a popup.

There is intentionally no toolbar popup. Clicking the toolbar icon opens the full settings page. Settings can be previewed in a normal browser through Vite, where they persist in local storage, or in Chrome as an extension options page, where they persist through `chrome.storage.local`.

Playlist quick actions, sidebar shortcuts, shuffle-on-open, menu/button color settings, a larger progress bar, and side-play preview are implemented as an initial pass. YouTube Music changes its DOM frequently, so test the content features on the live site before relying on them; the side-play iframe in particular may be restricted by the site's embedding policy.

The optional track-comments drawer requests public comments directly from YouTube's WEB InnerTube endpoint, anonymously and only when opened. It does not send requests to a project-operated server. The comments feature and playlist enhancement ideas were informed by [andronedev/ytm-comments](https://github.com/andronedev/ytm-comments) and [gormanity/ytm-enhancer](https://github.com/gormanity/ytm-enhancer); those projects are MIT-licensed. This extension is independent and is not affiliated with YouTube, Google, or the referenced projects.
