import { createSidebarEnhancer } from "./sidebar.js";
import { installExploreCache } from "./explore-cache.js";
import { createPlayerSizer } from "./player-size.js";
import { createLibraryView } from "./library-view.js";

(() => {
  const extensionApi = globalThis.browser ?? globalThis.chrome;
  const predefinedShortcuts = [
    { id: "home", label: "Home", path: "/", icon: "home", enabled: true, native: true },
    { id: "explore", label: "Explore", path: "/explore", icon: "explore", enabled: true, native: true },
    { id: "library", label: "Library", path: "/library", icon: "library", enabled: true, native: true },
    { id: "playlists", label: "Playlists", path: "/library/playlists", icon: "playlist", enabled: true },
    { id: "downloads", label: "Downloads", path: "/browse/FEmusic_offline", icon: "download", enabled: false },
    { id: "songs", label: "Songs", path: "/library/songs", icon: "song", enabled: false },
    { id: "albums", label: "Albums", path: "/library/albums", icon: "album", enabled: false },
    { id: "artists", label: "Artists", path: "/library/artists", icon: "artist", enabled: false },
    { id: "profiles", label: "Profiles", path: "/library/channels", icon: "profile", enabled: false },
    { id: "podcasts", label: "Podcasts", path: "/library/podcasts", icon: "podcast", enabled: false },
  ];
  const defaults = {
    quickActions: ["like", "queue"],
    quickActionsEnabled: true,
    actionColor: "match",
    menuColor: "match",
    primaryColor: "red",
    sidebarWidth: 100,
    sidebarResize: false,
    sidebarIcons: true,
    compactSidebar: false,
    compactLibrary: true,
    compactPlaylistSidebar: false,
    hideNewPlaylist: true,
    sidebarShortcuts: predefinedShortcuts,
    sidebarOrderVersion: 1,
    largeProgress: true,
    playerPosition: "bottom",
    rememberVolume: false,
  };
  const likedMusicArtwork = "https://www.gstatic.com/youtube/media/ytm/images/pbg/liked-songs-delhi-1200.png";
  const actionLabels = {
    like: { button: "Like", match: null },
    preview: { button: "Side play", match: null },
    remove: { button: "Remove", match: /remove from playlist/i },
    queue: { button: "Queue", match: /add to queue/i },
    addPlaylist: { button: "Add to playlist", match: /add to playlist/i },
    radio: { button: "Start radio", match: /(?:start|go to) radio/i },
    artist: { button: "Go to artist", match: /(?:go to|view) artist/i },
    album: { button: "Go to album", match: /(?:go to|view) album/i },
    share: { button: "Share", match: /^share(?:\s|$)/i },
  };
  const iconPaths = {
    like: "M7 10v10H3V10h4Zm0 9h10a2 2 0 0 0 2-1.6l1-5A2 2 0 0 0 18 10h-4l1-5a2 2 0 0 0-2-2l-1 4-5 5",
    preview: "M3 5h18v14H3zM15 5v14M6 9l5 3-5 3Z",
    remove: "M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7",
    queue: "M3 5h14M3 9h14M3 13h8M17 13v8M13 17h8",
    next: "M4 5v14l10-7ZM18 5v14",
    addPlaylist: "M3 6h12M3 10h12M3 14h8M18 13v8M14 17h8",
    share: "M18 8a3 3 0 1 0-2.8-4M6 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm12 6a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM8.6 10.5l6.8-4M8.6 13.5l6.8 4",
    home: "M3 10.5 12 3l9 7.5M5.5 9v11h13V9M9 20v-6h6v6",
    explore: "M10.5 3a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15ZM16 16l5 5M8 13l2-5 5-2-2 5-5 2Z",
    search: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm6-2 4 4",
    library: "M4 5h16v15H4zM8 9h8M8 12h8M8 15h5",
    liked: "M20.8 8.7c0 5.1-8.8 11-8.8 11s-8.8-5.9-8.8-11A4.7 4.7 0 0 1 12 6a4.7 4.7 0 0 1 8.8 2.7Z",
    playlist: "M3 6h11M3 10h11M3 14h7M21 15V4l-4 1M21 15a3 3 0 1 1-6 0a3 3 0 0 1 6 0",
    podcast: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM6.5 7.5a8 8 0 0 0 0 9M17.5 7.5a8 8 0 0 1 0 9M3 4a12 12 0 0 0 0 16M21 4a12 12 0 0 1 0 16",
    radio: "M4 8h16v12H4zM4 8l15-5M8 12h.01M12 12h.01M16 12h.01M8 16h8",
    download: "M12 3v12m0 0 5-5m-5 5-5-5M4 20h16",
    song: "M9 18V5l12-2v13M9 9l12-2M5 20a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm12-2a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
    album: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 5a4 4 0 1 1 0 8 4 4 0 0 1 0-8Z",
    artist: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 9a7 7 0 0 1 14 0",
    profile: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21a8 8 0 0 1 16 0",
    grid: "M3 3h8v8H3zm10 0h8v8h-8zM3 13h8v8H3zm10 0h8v8h-8z",
    list: "M3 5h2v2H3zm4 0h14v2H7zM3 11h2v2H3zm4 0h14v2H7zM3 17h2v2H3zm4 0h14v2H7z",
    chevronDown: "M6 9l6 6 6-6",
  };

  let settings = { ...defaults };
  let shuffleEnabled = true;
  let applyingShuffle = false;
  let shuffleTimer;
  let observedPlayer = null;
  const shuffleObserver = new MutationObserver(() => scheduleShuffleSync());
  let scheduled = false;
  let libraryCache = {};
  let libraryView = "grid";
  let lastVolume = null;
  let volumeRestored = false;
  let cacheWriteTimer = 0;
  let volumeWriteTimer = 0;
  const patchedRows = new WeakMap();
  const patchedVolumeControls = new WeakSet();
  const updatePlayerSize = createPlayerSizer(deepFind);
  const updateExplore = installExploreCache({ storage: extensionApi.storage.local, deepFind });

  function getText(node) {
    return (node?.innerText || node?.textContent || "").replace(/\s+/g, " ").trim();
  }

  const scrollbarRoots = new WeakSet();
  function styleScrollbar(root) {
    if (!root || scrollbarRoots.has(root)) return;
    scrollbarRoots.add(root);
    const style = document.createElement("style");
    style.textContent = `
      :host, :host *:not(#yme-scrollbar-override#yme-scrollbar-override#yme-scrollbar-override) { scrollbar-width:auto!important; scrollbar-color:auto!important; }
      :host::-webkit-scrollbar, :host *:not(#yme-scrollbar-override#yme-scrollbar-override#yme-scrollbar-override)::-webkit-scrollbar { display:block!important; width:3px!important; height:3px!important; }
      :host::-webkit-scrollbar-thumb, :host *:not(#yme-scrollbar-override#yme-scrollbar-override#yme-scrollbar-override)::-webkit-scrollbar-thumb { background:#777!important; border-radius:4px!important; }
      :host::-webkit-scrollbar-track, :host *:not(#yme-scrollbar-override#yme-scrollbar-override#yme-scrollbar-override)::-webkit-scrollbar-track { background:transparent!important; }
      :host::-webkit-scrollbar-button, :host *:not(#yme-scrollbar-override#yme-scrollbar-override#yme-scrollbar-override)::-webkit-scrollbar-button { display:none!important; width:0!important; height:0!important; }
      @supports (-moz-appearance: none) { :host, :host *:not(#yme-scrollbar-override#yme-scrollbar-override#yme-scrollbar-override) { scrollbar-width:thin!important; scrollbar-color:#777 transparent!important; } }
    `;
    root.append(style);
  }

  function deepFind(root, selector, results = []) {
    if (!root) return results;
    if (root.querySelectorAll) results.push(...root.querySelectorAll(selector));
    if (root.shadowRoot) {
      styleScrollbar(root.shadowRoot);
      deepFind(root.shadowRoot, selector, results);
    }
    const elements = root.querySelectorAll ? root.querySelectorAll("*") : [];
    for (const element of elements) {
      if (element.shadowRoot) {
        styleScrollbar(element.shadowRoot);
        deepFind(element.shadowRoot, selector, results);
      }
    }
    return results;
  }

  function setPageSettings() {
    const root = document.documentElement;
    const width = typeof settings.sidebarWidth === "number" && Number.isFinite(settings.sidebarWidth) ? Math.min(150, Math.max(75, settings.sidebarWidth)) : 100;
    root.style.setProperty("--yme-sidebar-width", `${width * 2.4}px`);
    root.dataset.ymeActionColor = settings.actionColor;
    root.dataset.ymeMenuColor = settings.menuColor;
    root.dataset.ymePrimaryColor = settings.primaryColor;
    root.dataset.ymePlayerPosition = settings.playerPosition === "top" ? "top" : "bottom";
    root.classList.toggle("yme-large-progress", settings.largeProgress);
    root.classList.toggle("yme-sidebar-icons", settings.sidebarIcons);
    root.classList.toggle("yme-compact-sidebar", settings.compactSidebar);
    root.classList.toggle("yme-resize-sidebar", settings.sidebarResize);
    document.getElementById("yme-sidebar-resize")?.setAttribute("aria-valuenow", String(width));
    root.style.setProperty("--yme-menu-accent", colorValue(settings.menuColor, colorValue(settings.primaryColor, "#ff4e55")));
  }

  function installSidebarResize() {
    const handle = document.createElement("div");
    handle.id = "yme-sidebar-resize";
    handle.setAttribute("role", "separator");
    handle.setAttribute("aria-label", "Resize sidebar");
    handle.setAttribute("aria-orientation", "vertical");
    handle.tabIndex = 0;
    document.documentElement.append(handle);
    function setWidth(width, save) {
      const percent = Math.max(75, Math.min(150, Math.round(width / 2.4 / 5) * 5));
      settings.sidebarWidth = percent;
      setPageSettings();
      handle.setAttribute("aria-valuenow", String(percent));
      if (save) extensionApi.storage.local.set({ sidebarWidth: percent });
    }
    handle.setAttribute("aria-valuemin", "75");
    handle.setAttribute("aria-valuemax", "150");
    handle.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      handle.setPointerCapture(event.pointerId);
    });
    handle.addEventListener("pointermove", (event) => {
      if (handle.hasPointerCapture(event.pointerId)) setWidth(event.clientX, false);
    });
    handle.addEventListener("pointerup", (event) => {
      if (handle.hasPointerCapture(event.pointerId)) { setWidth(event.clientX, true); handle.releasePointerCapture(event.pointerId); }
    });
    handle.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      setWidth((settings.sidebarWidth + (event.key === "ArrowRight" ? 5 : -5)) * 2.4, true);
    });
  }

  function colorValue(name, fallback) {
    return ({ red: "#ff4e55", blue: "#4b9cff", green: "#4cbd82", purple: "#b07cff", plain: "#a8aaa8", match: fallback })[name] || fallback;
  }

  function updateContextMenus() {
    const css = `
      ytmusic-menu-popup-renderer, :host(ytmusic-menu-popup-renderer),
      ytmusic-menu-popup-renderer tp-yt-paper-listbox, :host(ytmusic-menu-popup-renderer) tp-yt-paper-listbox {
        padding-block: 0 !important;
        margin-block: 0 !important;
      }
      ytmusic-menu-popup-renderer, :host(ytmusic-menu-popup-renderer) {
        box-sizing: border-box !important;
        width: max-content !important;
        min-width: 0 !important;
        max-width: calc(100vw - 24px) !important;
        overflow-x: hidden !important;
      }
      ytmusic-menu-popup-renderer tp-yt-paper-listbox, :host(ytmusic-menu-popup-renderer) tp-yt-paper-listbox {
        box-sizing: border-box !important;
        width: max-content !important;
        min-width: 0 !important;
        max-width: 100% !important;
      }
      ytmusic-menu-popup-renderer [role="menuitem"], :host(ytmusic-menu-popup-renderer) [role="menuitem"],
      ytmusic-menu-popup-renderer #navigation-endpoint, :host(ytmusic-menu-popup-renderer) #navigation-endpoint {
        box-sizing: border-box !important;
        width: auto !important;
        min-width: 0 !important;
        max-width: 100% !important;
        height: auto !important;
        min-height: 36px !important;
        padding-block: 0 !important;
      }
      ytmusic-menu-popup-renderer ytmusic-menu-service-item-download-renderer tp-yt-paper-item,
      :host(ytmusic-menu-popup-renderer) ytmusic-menu-service-item-download-renderer tp-yt-paper-item {
        box-sizing: border-box !important;
        height: auto !important;
        min-height: 36px !important;
        padding-block: 0 !important;
      }
      ytmusic-menu-popup-renderer .text, :host(ytmusic-menu-popup-renderer) .text {
        min-width: 0 !important;
        white-space: normal !important;
        overflow-wrap: anywhere !important;
      }
      ytmusic-menu-popup-renderer :is(tp-yt-paper-item, [role="menuitem"], ytmusic-menu-service-item-renderer):hover,
      :host(ytmusic-menu-popup-renderer) :is(tp-yt-paper-item, [role="menuitem"], ytmusic-menu-service-item-renderer):hover {
        background-color: color-mix(in srgb, var(--yme-menu-accent, #ff4e55) 18%, transparent) !important;
      }
      ytmusic-menu-popup-renderer :is(tp-yt-paper-item, [role="menuitem"], ytmusic-menu-service-item-renderer):focus-visible,
      :host(ytmusic-menu-popup-renderer) :is(tp-yt-paper-item, [role="menuitem"], ytmusic-menu-service-item-renderer):focus-visible {
        outline: 2px solid var(--yme-menu-accent, #ff4e55) !important;
        outline-offset: -2px;
      }`;
    for (const menu of deepFind(document, "ytmusic-menu-popup-renderer")) {
      menu.style.setProperty("--yme-menu-accent", colorValue(settings.menuColor, colorValue(settings.primaryColor, "#ff4e55")));
      for (const root of [document, menu.shadowRoot].filter(Boolean)) {
        if (!root.querySelector("style[data-yme-menu-style]")) {
          const style = document.createElement("style");
          style.dataset.ymeMenuStyle = "true";
          style.textContent = css;
          (root === document ? document.head : root).append(style);
        }
      }
    }
  }

  function makeIcon(name) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", iconPaths[name] || iconPaths.playlist);
    svg.append(path);
    return svg;
  }

  function safeThumbnailUrl(value) {
    if (typeof value !== "string") return null;
    try {
      const url = new URL(value, location.origin);
      if (url.protocol !== "https:" || (!/(^|\.)googleusercontent\.com$|(^|\.)ytimg\.com$/i.test(url.hostname) && url.href !== likedMusicArtwork)) return null;
      return url.href;
    } catch {
      return null;
    }
  }

  function thumbnailFromData(value, depth = 0, seen = new WeakSet()) {
    if (depth > 5 || value == null) return null;
    if (typeof value === "string") return safeThumbnailUrl(value);
    if (typeof value !== "object" || seen.has(value)) return null;
    seen.add(value);
    if (Array.isArray(value)) {
      for (const item of value.slice(0, 30)) {
        const found = thumbnailFromData(item, depth + 1, seen);
        if (found) return found;
      }
      return null;
    }
    const pairs = Object.entries(value).slice(0, 80).sort(([a], [b]) => {
      const weight = (key) => /thumbnail|image|artwork|cover/i.test(key) ? 0 : 1;
      return weight(a) - weight(b);
    });
    for (const [key, child] of pairs) {
      if (typeof child === "string" && !/thumbnail|image|artwork|cover|url|src/i.test(key)) continue;
      const found = thumbnailFromData(child, depth + 1, seen);
      if (found) return found;
    }
    return null;
  }

  function playlistThumbnail(entry) {
    const exposed = safeThumbnailUrl(entry.dataset.ymeThumbnail);
    if (exposed) return exposed;
    for (const image of deepFind(entry, "img, yt-img-shadow")) {
      if (image.closest(".yme-library-art, ytmusic-menu-renderer, .menu, .subtitle-group, .subtitle, #inline-badges, .avatar, .owner")) continue;
      const innerImage = image.matches("img") ? image : deepFind(image, "img")[0];
      const url = safeThumbnailUrl(innerImage?.currentSrc || innerImage?.src || image.getAttribute("src"));
      if (url) return url;
    }
    const dataCandidates = [entry.data, entry.item, entry.playlist, entry.rendererData, entry.__data?.data];
    for (const data of dataCandidates) {
      const url = thumbnailFromData(data);
      if (url) return url;
    }
    if (["LM", "VLLM"].includes(playlistIdFromEntry(entry))) return likedMusicArtwork;
    return null;
  }

  function playerRoots() {
    return document.querySelectorAll("ytmusic-player-bar, ytmusic-miniplayer, ytmusic-player-page, ytmusic-player");
  }

  function volumeControls() {
    const controls = [];
    for (const root of playerRoots()) {
      for (const control of deepFind(root, "#volume-slider, tp-yt-paper-slider, input[type='range']")) {
        const label = `${control.id} ${control.getAttribute("aria-label") || ""} ${control.getAttribute("title") || ""}`;
        if (/volume/i.test(label)) controls.push(control);
      }
    }
    return [...new Set(controls)];
  }

  function fractionFromControl(control) {
    const value = Number(control.getAttribute("aria-valuenow") ?? control.value);
    if (!Number.isFinite(value)) return null;
    const min = Number(control.min || 0);
    const max = Number(control.max || 100);
    return Math.min(1, Math.max(0, (value - min) / (max - min || 100)));
  }

  function saveVolume(value) {
    if (!settings.rememberVolume || !Number.isFinite(value)) return;
    lastVolume = Math.min(1, Math.max(0, value));
    clearTimeout(volumeWriteTimer);
    volumeWriteTimer = setTimeout(() => extensionApi.storage.local.set({ ymeLastVolume: lastVolume }), 250);
  }

  function restoreVolume() {
    if (!settings.rememberVolume || volumeRestored || !Number.isFinite(lastVolume)) return;
    const controls = volumeControls();
    const media = [];
    for (const root of playerRoots()) media.push(...deepFind(root, "audio, video"));
    if (!controls.length || !media.length) return;
    document.documentElement.dataset.ymeRestoreVolume = String(lastVolume * 100);
    const event = new Event("yme-restore-volume", { cancelable: true });
    document.dispatchEvent(event);
    delete document.documentElement.dataset.ymeRestoreVolume;
    volumeRestored = event.defaultPrevented;
  }

  function bindVolumeControls() {
    for (const control of volumeControls()) {
      if (patchedVolumeControls.has(control)) continue;
      patchedVolumeControls.add(control);
      const remember = () => {
        const value = fractionFromControl(control);
        if (value != null) saveVolume(value);
      };
      control.addEventListener("input", remember, { passive: true });
      control.addEventListener("change", remember, { passive: true });
    }
    restoreVolume();
  }

  function playlistIdFromEntry(entry) {
    if (entry.dataset.ymePlaylistId) return entry.dataset.ymePlaylistId;
    const anchor = deepFind(entry, "a[href*='list=']")[0];
    if (anchor) {
      try { return new URL(anchor.href, location.origin).searchParams.get("list"); } catch { /* Ignore malformed site URLs. */ }
    }
    const candidates = [entry.data, entry.item, entry.playlist, entry.rendererData, entry.__data?.data];
    for (const value of candidates) {
      const id = findPlaylistId(value);
      if (id) return id;
    }
    return null;
  }

  function findPlaylistId(value, depth = 0, seen = new WeakSet()) {
    if (!value || typeof value !== "object" || depth > 4 || seen.has(value)) return null;
    seen.add(value);
    for (const [key, child] of Object.entries(value).slice(0, 60)) {
      if (/playlistId|browseId/i.test(key) && typeof child === "string" && /^PL|^VL|^OLAK/i.test(child)) return child;
      if (child && typeof child === "object") {
        const found = findPlaylistId(child, depth + 1, seen);
        if (found) return found;
      }
    }
    return null;
  }

  function rememberLibraryImage(id, thumbnail) {
    if (!id || !thumbnail) return;
    if (libraryCache[id]?.thumbnail === thumbnail) return;
    libraryCache[id] = { thumbnail, savedAt: Date.now() };
    const entries = Object.entries(libraryCache)
      .filter(([, value]) => Date.now() - value.savedAt < 7 * 24 * 60 * 60 * 1000)
      .slice(-250);
    libraryCache = Object.fromEntries(entries);
    clearTimeout(cacheWriteTimer);
    cacheWriteTimer = setTimeout(() => extensionApi.storage.local.set({ ymeLibraryArtworkCache: libraryCache }), 500);
  }

  function mergeSidebarShortcuts(stored, orderVersion = 0) {
    const saved = Array.isArray(stored) ? stored.filter((entry) => entry
      && typeof entry.id === "string" && typeof entry.label === "string"
      && typeof entry.path === "string" && entry.path.startsWith("/") && !entry.path.startsWith("//") && !entry.path.includes("\\")) : [];
    const byId = new Map(saved.map((entry) => [entry.id, entry]));
    const normalized = [
      ...saved.map((entry) => {
        const preset = predefinedShortcuts.find((item) => item.id === entry.id);
        return { ...preset, ...entry, path: entry.id === "downloads" ? "/browse/FEmusic_offline" : entry.path, native: Boolean(preset?.native), enabled: entry.enabled !== false };
      }),
      ...predefinedShortcuts.filter((entry) => !byId.has(entry.id)),
    ];
    const legacy = orderVersion !== 1;
    return legacy
      ? [...predefinedShortcuts.filter((entry) => entry.native).map((entry) => ({ ...entry, enabled: byId.get(entry.id)?.enabled !== false })), ...normalized.filter((entry) => !entry.native)]
      : normalized;
  }

  function playlistKey() {
    if (!location.pathname.startsWith("/playlist")) return "";
    return new URL(location.href).searchParams.get("list") || "";
  }

  function scheduleUpdate() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      updatePage();
    });
  }

  function createQuickAction(action, row) {
    const button = document.createElement("button");
    const info = actionLabels[action];
    button.type = "button";
    button.className = "yme-quick-action";
    button.dataset.ymeAction = action;
    button.append(makeIcon(action));
    button.title = info.button;
    button.setAttribute("aria-label", `${info.button} this track`);
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (action === "like") {
        const rating = deepFind(row, "ytmusic-like-button-renderer")[0];
        const buttons = rating ? deepFind(rating, "button, [role=button], yt-icon-button") : [];
        const like = buttons.find((element) => /(^|\b)(like|unlike)(\b|$)/i.test(`${element.getAttribute("aria-label") || ""} ${element.getAttribute("title") || ""}`) && !/dislike/i.test(`${element.getAttribute("aria-label") || ""} ${element.getAttribute("title") || ""}`)) || (rating && deepFind(rating, "#like-button button, #like-button")[0]);
        if (like) like.click();
        else showNotice("Like is unavailable for this track.");
        return;
      }
      if (action === "preview") {
        openSidePlay(row);
        return;
      }
      const request = new CustomEvent("yme-row-action", { bubbles: true, composed: true, cancelable: true });
      if (button.dispatchEvent(request)) showNotice("That action isn’t available for this track.");
    });
    return button;
  }

  function openSidePlay(row) {
    const trackLink = deepFind(row, "a[href]").find((link) => {
      try { const url = new URL(link.href, location.origin); return url.pathname === "/watch" && url.searchParams.has("v"); }
      catch { return false; }
    });
    let videoId = row.dataset.ymeVideoId || null;
    if (!videoId && trackLink) {
      try { videoId = new URL(trackLink.href, location.origin).searchParams.get("v"); } catch { videoId = null; }
    }
    if (!videoId || !/^[\w-]{6,20}$/.test(videoId)) {
      showNotice("Couldn’t identify this track for side play.");
      return;
    }
    if (document.querySelector("#yme-sideplay")) return;

    const pausedTracks = deepFind(document, "audio, video").map((media) => ({
      media,
      time: media.currentTime,
      wasPlaying: !media.paused,
    }));
    for (const { media, wasPlaying } of pausedTracks) if (wasPlaying) media.pause();

    const dialog = document.createElement("dialog");
    dialog.id = "yme-sideplay";
    dialog.setAttribute("aria-label", "Side play preview");
    const header = document.createElement("div");
    header.className = "yme-sideplay-header";
    const title = document.createElement("strong");
    title.textContent = "Side play";
    const close = document.createElement("button");
    close.type = "button";
    close.className = "yme-sideplay-close";
    close.textContent = "Close";
    header.append(title, close);
    const frame = document.createElement("iframe");
    frame.title = "One-off track preview";
    frame.allow = "autoplay; encrypted-media; picture-in-picture";
    frame.src = `https://music.youtube.com/watch?v=${encodeURIComponent(videoId)}&autoplay=1`;
    dialog.append(header, frame);
    document.body.append(dialog);

    let restored = false;
    const restoreMainPlayer = () => {
      if (restored) return;
      restored = true;
      frame.src = "about:blank";
      dialog.remove();
      for (const { media, time, wasPlaying } of pausedTracks) {
        if (!media.isConnected) continue;
        try { media.currentTime = time; } catch { /* The site may have replaced this media element. */ }
        if (wasPlaying) media.play().catch(() => {});
      }
    };
    close.addEventListener("click", restoreMainPlayer, { once: true });
    dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      restoreMainPlayer();
    }, { once: true });
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) restoreMainPlayer();
    });
    dialog.showModal();
    close.focus();
  }

  function findRowMenuButton(row) {
    const candidates = deepFind(row, "button, [role='button'], yt-icon-button, .dropdown-trigger, #button");
    return candidates.find((element) => {
      const label = `${element.getAttribute("aria-label") || ""} ${element.getAttribute("title") || ""}`;
      return /more|menu|options/i.test(label) || element.matches(".dropdown-trigger");
    }) || deepFind(row, "ytmusic-menu-renderer")[0];
  }

  // Open the native song menu from the player bar or anywhere on a song row.
  document.addEventListener("contextmenu", (event) => {
    if (event.defaultPrevented || event.shiftKey) return;
    const path = event.composedPath();
    if (path.some((node) => node instanceof Element && node.matches("input, textarea, select, .yme-quick-action"))) return;
    const bar = path.find((node) => node instanceof Element && node.matches("ytmusic-player-bar"));
    const row = path.find((node) => node instanceof Element && node.matches("ytmusic-responsive-list-item-renderer"));
    const menu = bar && deepFind(bar, "ytmusic-menu-renderer")[0];
    const trigger = menu ? findRowMenuButton(menu) : row ? findRowMenuButton(row) : null;
    if (!trigger) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    trigger.click();
  }, true);

  function showNotice(message) {
    let notice = document.querySelector("#yme-notice");
    if (!notice) {
      notice = document.createElement("div");
      notice.id = "yme-notice";
      notice.setAttribute("role", "status");
      document.body.append(notice);
    }
    notice.textContent = message;
    notice.classList.add("yme-notice-visible");
    clearTimeout(notice.dismissTimer);
    notice.dismissTimer = setTimeout(() => notice.classList.remove("yme-notice-visible"), 2800);
  }

  function enhancePlaylistRows() {
    if (!playlistKey() || !settings.quickActionsEnabled || !settings.quickActions.length) return;
    for (const row of document.querySelectorAll("ytmusic-responsive-list-item-renderer")) {
      if (!row.querySelector("ytmusic-menu-renderer") && !deepFind(row, "ytmusic-menu-renderer").length) continue;

      row.classList.add("yme-has-actions");
      row.classList.add("yme-has-like");
      let bar = row.querySelector(":scope > .yme-quick-actions");
      const actionKey = settings.quickActions.join(",");
      if (bar && patchedRows.get(row) === actionKey) continue;
      if (bar) bar.remove();
      bar = document.createElement("div");
      bar.className = "yme-quick-actions";
      bar.setAttribute("aria-label", "Quick track actions");
      for (const action of settings.quickActions) {
        if (actionLabels[action]) bar.append(createQuickAction(action, row));
      }
      row.append(bar);
      const positionActions = () => {
        const menu = deepFind(row, "ytmusic-menu-renderer")[0];
        if (!menu) return;
        const rowBox = row.getBoundingClientRect();
        const menuBox = (findRowMenuButton(menu) || menu).getBoundingClientRect();
        if (!rowBox.width || !menuBox.width) return;
        const rtl = getComputedStyle(row).direction === "rtl";
        const offset = rtl ? menuBox.right - rowBox.left : rowBox.right - menuBox.left;
        bar.style.insetInlineEnd = `${Math.max(48, Math.ceil(offset + 4))}px`;
      };
      if (row.ymePositionActions) {
        row.removeEventListener("pointerenter", row.ymePositionActions);
        row.removeEventListener("focusin", row.ymePositionActions);
      }
      row.ymePositionActions = positionActions;
      row.addEventListener("pointerenter", positionActions);
      row.addEventListener("focusin", positionActions);
      positionActions();
      patchedRows.set(row, actionKey);
    }
  }

  const updateSidebar = createSidebarEnhancer({
    deepFind,
    makeIcon,
    scheduleUpdate,
    thumbnail: playlistThumbnail,
    playlistId: playlistIdFromEntry,
    rememberImage: rememberLibraryImage,
    cachedImage: (id) => safeThumbnailUrl(libraryCache[id]?.thumbnail),
  });

  function cacheRenderedLibraryArtwork() {
    if (!location.pathname.startsWith("/library")) return;
    for (const card of deepFind(document, "ytmusic-two-row-item-renderer")) {
      const id = playlistIdFromEntry(card);
      if (id) rememberLibraryImage(id, playlistThumbnail(card));
    }
  }

  // Route collection play actions through YouTube Music's shuffle endpoint.
  const collectionSelector = "ytmusic-two-row-item-renderer, ytmusic-responsive-list-item-renderer, ytmusic-detail-header-renderer, ytmusic-responsive-header-renderer, ytmusic-editable-playlist-detail-header-renderer, ytmusic-guide-entry-renderer, ytmusic-guide-library-entry-renderer";
  function collectionType(container) {
    if (container.dataset.ymePlaylistId) return /^OLAK5uy_/i.test(container.dataset.ymePlaylistId) ? "album" : "playlist";
    const links = deepFind(container, "a[href]");
    const paths = links.map((link) => link.getAttribute("href") || "");
    // A song row can contain album and playlist links in its metadata.
    if (container.matches("ytmusic-responsive-list-item-renderer") && paths.some((path) => /^\/watch(?:\?|$)/i.test(path))) return null;
    const text = `${container.getAttribute("aria-label") || ""} ${container.textContent || ""}`;
    if (paths.some((path) => /\/browse\/MPRE|[?&]list=OLAK5uy_/i.test(path)) || /\balbum\b/i.test(text)) return "album";
    if (paths.some((path) => /\/playlist\?|[?&]list=|\/browse\/VL/i.test(path)) || /\bplaylist\b/i.test(text)) return "playlist";
    if (container.matches("ytmusic-detail-header-renderer, ytmusic-responsive-header-renderer, ytmusic-editable-playlist-detail-header-renderer")) {
      if (/^\/browse\/MPRE/i.test(location.pathname) || /^OLAK5uy_/i.test(new URLSearchParams(location.search).get("list") || "")) return "album";
      if (location.pathname === "/playlist") return "playlist";
    }
    return null;
  }
  function labelOf(node) {
    return `${node.getAttribute("aria-label") || ""} ${node.getAttribute("title") || ""} ${node.textContent || ""}`.trim();
  }
  function scheduleShuffleSync() {
    if (shuffleTimer) return;
    shuffleTimer = setTimeout(() => {
      shuffleTimer = null;
      const bar = document.querySelector("ytmusic-player-bar");
      const button = bar?.querySelector("yt-icon-button.shuffle button, #expand-shuffle button");
      if (!bar || !button || button.disabled || !bar.getClientRects().length) return;
      if (bar.hasAttribute("shuffle-on") !== shuffleEnabled) {
        applyingShuffle = true;
        button.click();
        applyingShuffle = false;
      }
    }, 300);
  }
  function updateShuffleState() {
    const bar = document.querySelector("ytmusic-player-bar");
    if (bar !== observedPlayer) {
      shuffleObserver.disconnect();
      observedPlayer = bar;
      if (bar) shuffleObserver.observe(bar, { attributes: true, attributeFilter: ["shuffle-on"] });
    }
    scheduleShuffleSync();
  }
  document.addEventListener("click", (event) => {
    if (applyingShuffle) return;
    const path = event.composedPath();
    const bar = path.find(node => node instanceof Element && node.matches("ytmusic-player-bar"));
    if (!bar || !path.some(node => node instanceof Element && node.matches("yt-icon-button.shuffle, #expand-shuffle"))) return;
    shuffleEnabled = !bar.hasAttribute("shuffle-on");
    clearTimeout(shuffleTimer);
    shuffleTimer = null;
    extensionApi.storage.local.set({ ymeShuffleEnabled: shuffleEnabled });
  }, true);
  document.addEventListener("click", (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
    const path = event.composedPath();
    const play = path.find((node) => node instanceof Element && (node.matches("ytmusic-play-button-renderer") || node.matches("button, [role=button], yt-icon-button") && /^play(?:\s|$)/i.test(labelOf(node))));
    if (!play || /pause|shuffle/i.test(labelOf(play))) return;
    const container = path.find((node) => node instanceof Element && node.matches(collectionSelector));
    if (!container) return;
    const type = collectionType(container);
    if (!shuffleEnabled || !type) return;
    const request = new CustomEvent("yme-shuffle-play", { bubbles: true, composed: true, cancelable: true });
    if (!play.dispatchEvent(request)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    const nativeShuffle = deepFind(container, "button, [role=button], yt-button-renderer, yt-icon-button").find((node) => /shuffle/i.test(labelOf(node)));
    if (nativeShuffle) {
      event.preventDefault();
      event.stopImmediatePropagation();
      nativeShuffle.click();
    }
  }, true);

  let playlistSearch = null;

  function openNativePlaylistSearch() {
    const request = new CustomEvent("yme-playlist-find", { bubbles: true, composed: true, cancelable: true });
    if (document.dispatchEvent(request)) showNotice("Find in playlist isn’t available on this page.");
  }

  function styleNativePlaylistSearch() {
    for (const input of deepFind(document, 'input[placeholder="Find on this page" i], input[aria-label="Find on this page" i]')) {
      const root = input.getRootNode();
      if (root === document || root.querySelector("style[data-yme-find-input]")) continue;
      const style = document.createElement("style");
      style.dataset.ymeFindInput = "true";
      style.textContent = 'input[placeholder="Find on this page" i], input[aria-label="Find on this page" i] { box-sizing:border-box!important;height:40px!important;min-height:40px!important;padding:0 48px 0 16px!important;border:1px solid var(--yt-spec-10-percent-layer,#ffffff33)!important;border-radius:8px!important;font:400 16px Roboto,Arial,sans-serif!important;color:var(--yt-spec-text-primary,#fff)!important;background:var(--yt-spec-10-percent-layer,#ffffff1a)!important; }';
      style.textContent += `
        #filter-search-bar-container { display:flex!important; align-items:center!important; gap:12px!important; margin-bottom:0!important; }
        #filter-search-bar-container #filter-search-bar { flex:1 1 auto!important; min-width:0!important; height:40px!important; }
        #filter-search-bar-container .ytmusicPlaylistFilterSearchShelfClearButton { right:12px!important; top:50%!important; transform:translateY(-50%)!important; }
        #filter-search-bar-container + [role="list"] { padding-block-start:16px!important; }
        #filter-search-bar-container > :last-child { flex:none!important; }
        #filter-search-bar-container > :last-child button { display:inline-flex!important; align-items:center!important; justify-content:center!important; box-sizing:border-box!important; height:40px!important; min-height:40px!important; min-width:80px!important; padding:0 16px!important; border:1px solid var(--yt-spec-10-percent-layer,#ffffff33)!important; border-radius:20px!important; color:var(--yt-spec-text-primary,#fff)!important; background:var(--yt-spec-10-percent-layer,#ffffff1a)!important; font:500 14px Roboto,Arial,sans-serif!important; cursor:pointer!important; }
        #filter-search-bar-container > :last-child button:hover { background:var(--yt-spec-20-percent-layer,#ffffff33)!important; }
        #filter-search-bar-container > :last-child button:focus-visible { outline:2px solid var(--yt-spec-call-to-action,#3ea6ff)!important; outline-offset:2px!important; }
        input[aria-label="Find on this page" i]:focus { outline:2px solid var(--yt-spec-call-to-action,#3ea6ff)!important; outline-offset:-2px!important; }
      `;
      root.append(style);
    }
  }

  function updatePlaylistSearch() {
    const key = playlistKey();
    const shelf = key && deepFind(document, "ytmusic-playlist-shelf-renderer")[0];
    const aligned = shelf && deepFind(shelf, "ytmusic-side-aligned-item-renderer")[0];
    const end = aligned && deepFind(aligned, "#end-items")[0];
    if (playlistSearch && (playlistSearch.key !== key || playlistSearch.shelf !== shelf || !end || !playlistSearch.button.isConnected)) {
      playlistSearch.button.remove();
      playlistSearch = null;
    }
    if (!end || playlistSearch) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "yme-playlist-search";
    button.setAttribute("aria-label", "Find in playlist");
    button.title = "Find in playlist";
    button.style.cssText = "display:inline-grid;place-items:center;box-sizing:border-box;width:40px;height:40px;padding:8px;border:0;border-radius:50%;background:transparent;color:var(--yt-spec-text-primary,#fff);cursor:pointer";
    const icon = makeIcon("search");
    icon.style.cssText = "width:24px;height:24px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round";
    button.append(icon);
    button.addEventListener("click", openNativePlaylistSearch);
    end.append(button);
    playlistSearch = { key, shelf, button };
  }

  const updateLibraryView = createLibraryView({
    deepFind,
    makeIcon,
    scheduleUpdate,
    onChange(view) {
      libraryView = view;
      extensionApi.storage.local.set({ ymeLibraryView: view }).catch(() => showNotice("Couldn’t save the Library layout. Try switching it again."));
    },
  });

  function updatePage() {
    setPageSettings();
    cacheRenderedLibraryArtwork();
    updateSidebar(settings);
    updateExplore();
    const key = playlistKey();
    if (!key || !settings.quickActionsEnabled || !settings.quickActions.length) {
      for (const bar of document.querySelectorAll(".yme-quick-actions")) bar.remove();
      for (const row of document.querySelectorAll(".yme-has-actions")) {
        row.classList.remove("yme-has-actions", "yme-has-like");
        if (row.ymePositionActions) {
          row.removeEventListener("pointerenter", row.ymePositionActions);
          row.removeEventListener("focusin", row.ymePositionActions);
          delete row.ymePositionActions;
        }
      }
    }
    enhancePlaylistRows();
    updatePlaylistSearch();
    styleNativePlaylistSearch();
    updateShuffleState();
    updatePlayerSize(settings.largeProgress);
    updateContextMenus();
    bindVolumeControls();
    updateLibraryView(libraryView);
  }

  function relevantMutation(record) {
    if (record.target.closest?.("ytmusic-player-bar, ytmusic-miniplayer")) return true;
    for (const node of record.addedNodes) {
      if (node.nodeType !== Node.ELEMENT_NODE) continue;
      if (node.matches?.("ytmusic-player, video, audio") || node.querySelector?.("ytmusic-player, video, audio")) return true;
      if (node.matches?.('input[placeholder="Find on this page" i], input[aria-label="Find on this page" i]') || node.querySelector?.('input[placeholder="Find on this page" i], input[aria-label="Find on this page" i]')) return true;
      if (node.matches?.("ytmusic-responsive-list-item-renderer, ytmusic-guide-entry-renderer, ytmusic-guide-library-entry-renderer, ytmusic-player-bar, ytmusic-menu-popup-renderer, tp-yt-paper-slider, ytmusic-two-row-item-renderer, ytmusic-browse-response, ytmusic-grid-renderer, ytmusic-sort-filter-button-renderer, ytmusic-playlist-shelf-renderer, ytmusic-side-aligned-item-renderer")) return true;
      if (node.querySelector?.("ytmusic-responsive-list-item-renderer, ytmusic-guide-entry-renderer, ytmusic-guide-library-entry-renderer, ytmusic-player-bar, ytmusic-menu-popup-renderer, tp-yt-paper-slider, ytmusic-two-row-item-renderer, ytmusic-browse-response, ytmusic-grid-renderer, ytmusic-sort-filter-button-renderer, ytmusic-playlist-shelf-renderer, ytmusic-side-aligned-item-renderer")) return true;
      if (node.parentElement?.closest("ytmusic-guide-library-entry-renderer:not([data-yme-icon-checked])")) return true;
    }
    return false;
  }

  function installHoverGuide() {
    let pointerInside = false;
    let focusInside = false;
    function update() {
      const app = document.querySelector("ytmusic-app");
      const rail = app?.querySelector("#mini-guide-renderer");
      const drawer = app?.querySelector("#guide");
      const visibleRail = rail && rail.getClientRects().length && getComputedStyle(rail).visibility !== "hidden";
      app?.classList.toggle("yme-hover-guide", Boolean(visibleRail && !drawer?.hasAttribute("opened") && (pointerInside || focusInside)));
    }
    document.addEventListener("pointermove", (event) => {
      if (event.pointerType === "touch") return;
      const app = document.querySelector("ytmusic-app");
      const rail = app?.querySelector("#mini-guide-renderer");
      if (!rail || !rail.getClientRects().length || getComputedStyle(rail).visibility === "hidden") { pointerInside = false; update(); return; }
      const rect = rail.getBoundingClientRect();
      const expanded = app.classList.contains("yme-hover-guide");
      const width = expanded ? parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--yme-sidebar-width")) || 240 : rect.width;
      pointerInside = event.clientX >= rect.left && event.clientX < rect.left + width && event.clientY >= rect.top && event.clientY < rect.bottom;
      update();
    }, { passive: true });
    document.addEventListener("pointerleave", () => { pointerInside = false; update(); });
    document.addEventListener("focusin", (event) => {
      focusInside = Boolean(event.target.matches?.(":focus-visible") && event.target.closest?.("#mini-guide-renderer"));
      update();
    });
    document.addEventListener("focusout", () => setTimeout(() => {
      focusInside = Boolean(document.activeElement?.matches?.(":focus-visible") && document.activeElement?.closest?.("#mini-guide-renderer"));
      update();
    }, 0));
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") { pointerInside = false; focusInside = false; update(); }
    });
    addEventListener("resize", () => { pointerInside = false; focusInside = false; update(); });
  }

  function installNavigationHooks() {
    for (const method of ["pushState", "replaceState"]) {
      const original = history[method];
      history[method] = function (...args) {
        const result = original.apply(this, args);
        scheduleUpdate();
        return result;
      };
    }
    addEventListener("popstate", scheduleUpdate, { passive: true });
    addEventListener("resize", scheduleUpdate, { passive: true });
    addEventListener("yt-navigate-finish", scheduleUpdate, { passive: true });
    addEventListener("yt-page-data-updated", scheduleUpdate, { passive: true });
    document.addEventListener("yme-guide-data-ready", scheduleUpdate);
    extensionApi.storage.onChanged.addListener((changes, area) => {
      if (area !== "local") return;
      for (const [key, change] of Object.entries(changes)) {
        if (key in settings) settings[key] = change.newValue ?? defaults[key];
      }
      if (changes.ymeShuffleEnabled) {
        shuffleEnabled = changes.ymeShuffleEnabled.newValue !== false;
        scheduleShuffleSync();
      }
      if (changes.quickActions && Array.isArray(settings.quickActions)) settings.quickActions = settings.quickActions.filter((action) => action in actionLabels);
      if (changes.sidebarShortcuts) settings.sidebarShortcuts = mergeSidebarShortcuts(settings.sidebarShortcuts, settings.sidebarOrderVersion);
      if (changes.ymeLibraryArtworkCache) libraryCache = changes.ymeLibraryArtworkCache.newValue || {};
      if (changes.rememberVolume) {
        volumeRestored = false;
        if (settings.rememberVolume) extensionApi.storage.local.get("ymeLastVolume").then((stored) => {
          lastVolume = typeof stored.ymeLastVolume === "number" ? stored.ymeLastVolume : null;
          bindVolumeControls();
        });
      }
      if (changes.ymeLibraryView) libraryView = ["list", "large-list"].includes(changes.ymeLibraryView.newValue) ? changes.ymeLibraryView.newValue : "grid";
      scheduleUpdate();
    });

    const observer = new MutationObserver((records) => {
      if (records.some(relevantMutation)) scheduleUpdate();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  Promise.all([
    extensionApi.storage.local.get({ ...defaults, sidebarOrderVersion: 0 }),
    extensionApi.storage.local.get(["ymeLibraryArtworkCache", "ymeLibraryView", "ymeLastVolume", "ymeShuffleEnabled"]),
  ]).then(([stored, persisted]) => {
    settings = { ...defaults, ...stored };
    shuffleEnabled = persisted.ymeShuffleEnabled !== false;
    settings.quickActions = Array.isArray(settings.quickActions) ? settings.quickActions.filter((action) => action in actionLabels) : [...defaults.quickActions];
    settings.sidebarShortcuts = mergeSidebarShortcuts(stored.sidebarShortcuts, stored.sidebarOrderVersion);
    settings.sidebarOrderVersion = 1;
    libraryCache = Object.fromEntries(Object.entries(persisted.ymeLibraryArtworkCache || {}).filter(([, entry]) => entry?.thumbnail && Date.now() - entry.savedAt < 7 * 24 * 60 * 60 * 1000));
    libraryView = ["list", "large-list"].includes(persisted.ymeLibraryView) ? persisted.ymeLibraryView : "grid";
    lastVolume = typeof persisted.ymeLastVolume === "number" ? persisted.ymeLastVolume : null;
    installNavigationHooks();
    installSidebarResize();
    installHoverGuide();
    scheduleUpdate();
  });
})();
