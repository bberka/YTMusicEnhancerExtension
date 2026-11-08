# Music Enhancer: product ideas

An idea backlog for a lightweight, fast, customizable companion to YouTube Music. The extension should use a settings page rather than a toolbar popup. The goal is to make common listening and playlist tasks easier while keeping sensible defaults for people who do not want to configure everything.

## Progress snapshot

### Checked in the real, headless YouTube Music browser

- Playlists opens through YouTube Music's SPA router without a full document reload.
- Shortcut enable/disable and ordering changes from settings are applied, including moving Playlists before native Home.
- Native Home visibility, compact top rows, and restoration work.
- Larger player bar enlarges playback controls, like/dislike, artwork, and the seek track. Disabling it restores native styling.
- The settings page fits 440, 768, 1440, and 1920 pixel viewports. The browser script also checks both themes.
- Settings are implemented with React, Tailwind, and official shadcn/ui controls. Browser checks exercise preference persistence and shortcut management through the UI.
- The mini-guide retains enabled shortcuts. Playlist mirroring has fixture coverage; personal-library verification requires sign-in.

### Implemented, but not fully verified in a signed-in session

- Private playlist artwork/fallback icons and quiet owner-free rows, including current paper-item renderers. DOM regression tests pass; real private-library validation remains open.
- Playlist quick actions, shuffle automation, remembered volume, and native menu colors.
- Explore preview caching, bounded to six hours. DOM restoration tests pass; live Explore capture/refresh still needs a dedicated check.
- The Library list/grid control has DOM regression tests and a headless check using native cards inside a Library shell. A signed-in Library session still needs verification. Side play remains experimental.

### Still missing

- Save-to-playlist picker persistence, playlist/artist/channel dialogs, and moving the player to the top.
- Full feature parity with the referenced extension. Its features are inspiration, not automatically implemented by attribution.

The custom comments drawer was removed at the user's request. YouTube Music's native comments remain untouched; comment enhancements are no longer part of the active scope.

Still to implement or validate: keep the save-to-playlist picker open, open playlists/artists/channels in dialogs, move the player to the top, and ensure side-play can be isolated without the site blocking its embedded player.

## Playlist management

- Add configurable quick actions to playlist track rows, so common actions do not require opening the three-dot menu.
- Let users choose, reorder, enable or disable, and recolor those actions.
- Make **Remove from playlist** available from a track's context menu or inline action without first playing the track.
- Make adding music to a playlist easier and more reliable.
- Add an option to keep the save-to-playlist picker open after adding a track. Default: off.
- Add an optional **Shuffle on playlist open** preference. Do not change shuffle behavior unless enabled.
- Improve the consistency of music-entry context-menu triggers; retain the native menu as a fallback.

## Navigation and browsing

- Add recognizable icons to left-sidebar entries such as playlists, library, and other navigation destinations.
- Offer an option to open playlists in a dialog instead of navigating away from the current page.
- Offer the same dialog-style opening for artist and channel pages.

## Player and visual customization

- Enlarge the full player bar, including like/dislike and the seek track.
- Allow the player to be moved to the top of the page.
- The primary/accent color control was removed at the user's request; action/menu color controls remain.
- Allow colors to be set for context-action menus, including three-dot menus, and customize them consistently across menu types.
- Keep appearance choices configurable, with good defaults for users who do not change settings.

## Speed and interaction quality

- Fix perceived and actual lag in YouTube Music while keeping the extension lightweight and responsive.
- Cache only reusable extension data (preferences, resolved action labels, and small UI state); do not keep stale track/page data or duplicate YouTube Music's own cache.
- Avoid repeatedly scanning or rebuilding the whole YouTube Music page. Batch DOM updates, observe only relevant regions where possible, and invalidate cached elements when YouTube Music replaces them.
- Handle YouTube Music's dynamic page updates without making context menus or injected controls unreliable.
- Prefer native YouTube Music actions where possible, and fail safely when a native action is unavailable.

## Side-play / one-off listening

- Let the user play one track in a small side dialog without navigating away from the current playlist or replacing its queue.
- Opening side-play pauses the normal player, then plays the selected track separately.
- Preserve the original playlist, queue, current track, and playback position while side-play is open.
- Closing the dialog should return to the original session and resume normal playback from its saved position (confirm this behavior before implementation).
- Keep this separate from **Play next** and **Add to queue**: side-play is a temporary audition, not a queue edit.
- Prefer the site's own playback facilities if they can support an isolated preview; do not silently mutate the user's queue to simulate it.

## Initial defaults to validate

- Sidebar icons: on.
- Larger player bar: on.
- Quick actions: remove from playlist, add to queue, and play next; users can change the selection and order.
- Quick-action color: match the player/theme.
- Shuffle on playlist open: off.
- Keep the save-to-playlist picker open: off.

These defaults are starting points, not fixed behavior; settings should let users customize the features they use.

## Implementation notes

- Playlist/artist/channel dialogs and native menu behavior need validation against YouTube Music's live, frequently changing UI before implementation.
- Avoid simulating playback or destructive actions through fragile selectors. Confirm the target track and use the site's own action when available.
- Keep the options page as the sole extension-owned settings surface; no toolbar popup is planned.
