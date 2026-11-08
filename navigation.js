// Runs in YouTube Music's page world so shortcuts can use its SPA router.
(() => {
  document.addEventListener("yme-restore-volume", (event) => {
    const volume = Number(document.documentElement.dataset.ymeRestoreVolume);
    const player = document.querySelector("ytmusic-player")?.getPlayer?.();
    if (!Number.isFinite(volume) || typeof player?.setVolume !== "function") return;
    player.setVolume(Math.max(0, Math.min(100, volume)));
    const slider = document.querySelector("ytmusic-player-bar #volume-slider");
    if (slider) slider.value = Math.max(0, Math.min(100, volume));
    event.preventDefault();
  });
  const browseIds = {
    "/": "FEmusic_home",
    "/explore": "FEmusic_explore",
    "/library": "FEmusic_library_landing",
    "/library/playlists": "FEmusic_liked_playlists",
    "/library/songs": "FEmusic_liked_videos",
    "/library/albums": "FEmusic_liked_albums",
    "/library/artists": "FEmusic_library_corpus_track_artists",
    "/library/channels": "FEmusic_library_corpus_artists",
    "/library/podcasts": "FEmusic_library_non_music_audio_list",
  };
  let frame = 0;
  let lastLocation = "";
  function publishGuideData() {
    frame = 0;
    let changed = false;
    const publish = (row, key, value) => {
      if (value && row.dataset[key] !== value) { row.dataset[key] = value; changed = true; }
      else if (!value && row.dataset[key]) { delete row.dataset[key]; changed = true; }
    };
    for (const row of document.querySelectorAll("ytmusic-guide-entry-renderer, ytmusic-guide-library-entry-renderer")) {
      const endpoint = row.data?.navigationEndpoint;
      const browseId = endpoint?.browseEndpoint?.browseId;
      const navId = { FEmusic_home: "home", FEmusic_explore: "explore", FEmusic_library_landing: "library" }[browseId];
      publish(row, "ymeNavId", navId);
      const playlistId = endpoint?.watchPlaylistEndpoint?.playlistId || endpoint?.watchEndpoint?.playlistId
        || (browseId?.startsWith("VL") ? browseId.slice(2) : null);
      publish(row, "ymePlaylistId", playlistId && /^[\w-]{2,150}$/.test(playlistId) ? playlistId : null);
      const thumbnails = row.data?.thumbnail?.thumbnails || row.data?.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails;
      const image = thumbnails?.at(-1)?.url;
      publish(row, "ymeThumbnail", typeof image === "string" && image.startsWith("https://") ? image : null);
    }
    for (const row of document.querySelectorAll("ytmusic-responsive-list-item-renderer")) {
      const data = row.data;
      const seen = new WeakSet();
      function findVideoId(value, depth = 0) {
        if (!value || typeof value !== "object" || depth > 9 || seen.has(value)) return null;
        seen.add(value);
        const id = value.watchEndpoint?.videoId || value.playlistItemData?.videoId;
        if (typeof id === "string" && /^[\w-]{6,20}$/.test(id)) return id;
        for (const child of Object.values(value)) {
          const found = findVideoId(child, depth + 1);
          if (found) return found;
        }
        return null;
      }
      const videoId = findVideoId(data);
      if (videoId && row.dataset.ymeVideoId !== videoId) { row.dataset.ymeVideoId = videoId; changed = true; }
      else if (!videoId && row.dataset.ymeVideoId) { delete row.dataset.ymeVideoId; changed = true; }
    }
    const routeChanged = lastLocation !== location.href;
    lastLocation = location.href;
    if (changed || routeChanged) document.dispatchEvent(new CustomEvent("yme-guide-data-ready"));
  }
  function scheduleGuideData() {
    if (!frame) frame = requestAnimationFrame(publishGuideData);
  }
  new MutationObserver(scheduleGuideData).observe(document, { childList: true, subtree: true });
  document.addEventListener("yt-page-data-updated", scheduleGuideData);
  document.addEventListener("yt-navigate-finish", scheduleGuideData);
  // History methods in the isolated content-script world do not observe the page router's calls.
  for (const method of ["pushState", "replaceState"]) {
    const original = history[method];
    history[method] = function (...args) {
      const result = original.apply(this, args);
      scheduleGuideData();
      return result;
    };
  }
  addEventListener("popstate", scheduleGuideData);
  scheduleGuideData();
  // Song menus expose the same endpoints before their popup is opened.
  document.addEventListener("yme-row-action", (event) => {
    const button = event.target;
    if (!(button instanceof Element) || !button.matches(".yme-quick-action")) return;
    const row = button.closest("ytmusic-responsive-list-item-renderer");
    const app = document.querySelector("ytmusic-app");
    if (!row || !app) return;
    const actions = {
      queue: { icons: ["ADD_TO_REMOTE_QUEUE"], label: /^add to queue$/i },
      addPlaylist: { icons: ["ADD_TO_PLAYLIST"], label: /^(?:add|save) to playlist$/i },
      remove: { icons: ["REMOVE_FROM_PLAYLIST", "PLAYLIST_REMOVE"], label: /^remove from (?:this )?playlist$/i },
      radio: { icons: ["MIX", "RADIO"], label: /^(?:start|go to) (?:radio|mix)$/i },
      artist: { icons: ["ARTIST"], label: /^(?:go to|view) artist$/i },
      album: { icons: ["ALBUM"], label: /^(?:go to|view) album$/i },
      share: { icons: ["SHARE"], label: /^share$/i },
    };
    const action = actions[button.dataset.ymeAction];
    if (!action) return;
    const menu = row.querySelector("ytmusic-menu-renderer");
    const items = menu?.data?.items || row.data?.menu?.menuRenderer?.items || [];
    const item = items.map((entry) => entry.menuServiceItemRenderer || entry.menuNavigationItemRenderer)
      .find((entry) => {
        if (!entry) return false;
        const text = entry.text?.runs?.map((run) => run.text || "").join("") || entry.text?.simpleText || "";
        return action.icons.includes(entry.icon?.iconType) || action.label.test(text.trim());
      });
    const endpoint = item?.serviceEndpoint || item?.navigationEndpoint;
    if (!endpoint) return;
    const method = endpoint.modalEndpoint ? app.handleModalEndpoint
      : endpoint.browseEndpoint || endpoint.watchEndpoint || endpoint.watchPlaylistEndpoint ? app.handleNavigationEndpoint
      : app.handleServiceEndpoint;
    if (typeof method !== "function") return;
    try {
      method.call(app, endpoint);
      event.preventDefault();
    } catch {
      // Leave the request unhandled so the extension can report that the action is unavailable.
    }
  });
  // The playlist shelf can open its native filter search without going through the menu.
  // Dispatching the same action the menu sends opens the search and loads its track metadata.
  document.addEventListener("yme-playlist-find", (event) => {
    const shelves = [...document.querySelectorAll("ytmusic-playlist-shelf-renderer")];
    const shelf = shelves.find((element) => element.getClientRects().length) || shelves[0];
    const playlistId = shelf?.data?.playlistId || new URLSearchParams(location.search).get("list");
    if (!shelf || !playlistId) return;
    try {
      shelf.dispatchEvent(new CustomEvent("yt-action", {
        bubbles: true,
        composed: true,
        cancelable: true,
        detail: {
          actionName: "yt-start-playlist-search",
          optionalAction: false,
          args: [{ playlistFilterSearchEndpoint: { playlistId } }],
          returnValue: [],
        },
      }));
      if (!shelf.showFilterSearch) return;
      event.preventDefault();
      requestAnimationFrame(() => {
        const input = document.querySelector('input[placeholder="Find on this page" i], input[aria-label="Find on this page" i]');
        if (input?.getClientRects().length) input.focus();
      });
    } catch {
      // Leave the request unhandled so the extension can report that search is unavailable.
    }
  });
  // The menu renderer exposes its shuffle endpoint even while its popup is closed.
  document.addEventListener("yme-shuffle-play", (event) => {
    const play = event.target;
    if (!(play instanceof Element)) return;
    const collection = play.closest("ytmusic-two-row-item-renderer, ytmusic-responsive-list-item-renderer, ytmusic-detail-header-renderer, ytmusic-responsive-header-renderer, ytmusic-editable-playlist-detail-header-renderer, ytmusic-guide-entry-renderer, ytmusic-guide-library-entry-renderer");
    const app = document.querySelector("ytmusic-app");
    if (!collection || typeof app?.handleNavigationEndpoint !== "function") return;
    const menus = collection.querySelectorAll("ytmusic-menu-renderer");
    let endpoint;
    for (const menu of menus) {
      const item = menu.data?.items?.find((entry) => entry.menuNavigationItemRenderer?.icon?.iconType === "MUSIC_SHUFFLE");
      endpoint = item?.menuNavigationItemRenderer?.navigationEndpoint;
      if (endpoint?.watchPlaylistEndpoint || endpoint?.watchEndpoint) break;
      endpoint = null;
    }
    if (!endpoint) {
      const native = collection.data?.mouseOverButton?.musicPlayButtonRenderer?.playNavigationEndpoint
        || play.data?.playNavigationEndpoint;
      const playlistId = native?.watchPlaylistEndpoint?.playlistId || native?.watchEndpoint?.playlistId || collection.dataset.ymePlaylistId;
      if (!playlistId || !/^[\w-]{2,150}$/.test(playlistId)) return;
      // The guide only exposes its normal-play endpoint. This is the shuffle parameter
      // YouTube Music supplies on its own playlist shuffle endpoints.
      endpoint = { watchPlaylistEndpoint: { playlistId, params: "wAEB8gECKAE%3D" } };
    }
    try {
      app.handleNavigationEndpoint(endpoint);
      event.preventDefault();
    } catch {
      // Let the native play button handle the click if its endpoint cannot be used.
    }
  });
  document.addEventListener("click", (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const link = event.composedPath().find((node) => node instanceof HTMLAnchorElement && node.classList.contains("yme-sidebar-shortcut"));
    if (!link || link.target || link.download) return;
    const url = new URL(link.href);
    if (url.origin !== location.origin || url.hash) return;
    let id = !url.search ? browseIds[url.pathname.replace(/\/$/, "") || "/"] : null;
    if (url.pathname.startsWith("/browse/") && !url.search) {
      const browseId = url.pathname.slice("/browse/".length);
      if (/^[\w-]{2,150}$/.test(browseId)) id = browseId;
    }
    if (url.pathname === "/playlist" && [...url.searchParams.keys()].every((key)=>key==="list")) {
      const playlistId = url.searchParams.get("list");
      if (playlistId && /^[\w-]{2,150}$/.test(playlistId)) id = `VL${playlistId}`;
    }
    const app = document.querySelector("ytmusic-app");
    if (!id || typeof app?.navigate !== "function") return;
    event.preventDefault();
    event.stopPropagation();
    app.navigate(id);
  }, true);
})();
