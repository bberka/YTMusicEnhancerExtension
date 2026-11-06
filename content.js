(() => {
  const extensionApi = globalThis.browser ?? globalThis.chrome;
  const predefinedShortcuts = [
    { id: "library", label: "Library", path: "/library", icon: "library", enabled: true },
    { id: "downloads", label: "Downloads", path: "/library/downloads", icon: "download", enabled: true },
    { id: "playlists", label: "Playlists", path: "/library/playlists", icon: "playlist", enabled: true },
    { id: "songs", label: "Songs", path: "/library/songs", icon: "song", enabled: true },
    { id: "albums", label: "Albums", path: "/library/albums", icon: "album", enabled: true },
    { id: "artists", label: "Artists", path: "/library/artists", icon: "artist", enabled: true },
    { id: "profiles", label: "Profiles", path: "/library/channels", icon: "profile", enabled: true },
    { id: "podcasts", label: "Podcasts", path: "/library/podcasts", icon: "podcast", enabled: true },
  ];
  const defaults = {
    quickActions: ["preview", "remove", "queue", "next"],
    quickActionsEnabled: true,
    actionColor: "match",
    menuColor: "match",
    primaryColor: "red",
    shuffleOnOpen: true,
    sidebarIcons: true,
    sidebarShortcuts: predefinedShortcuts,
    largeProgress: true,
    rememberVolume: false,
    commentsEnabled: true,
  };
  const actionLabels = {
    preview: { button: "Side play", match: null },
    remove: { button: "Remove", match: /remove from playlist/i },
    queue: { button: "Queue", match: /add to queue/i },
    next: { button: "Play next", match: /play next/i },
  };
  const icons = [
    [/home/i, "home"],
    [/explore|discover/i, "explore"],
    [/library/i, "library"],
    [/liked|favorites/i, "liked"],
    [/playlist|mix/i, "playlist"],
    [/podcast/i, "podcast"],
    [/radio/i, "radio"],
  ];
  const iconPaths = {
    home: "M3 10.5 12 3l9 7.5M5.5 9v11h13V9M9 20v-6h6v6",
    explore: "M10.5 3a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15ZM16 16l5 5M8 13l2-5 5-2-2 5-5 2Z",
    library: "M4 5h16v15H4zM8 9h8M8 12h8M8 15h5",
    liked: "M20.8 8.7c0 5.1-8.8 11-8.8 11s-8.8-5.9-8.8-11A4.7 4.7 0 0 1 12 6a4.7 4.7 0 0 1 8.8 2.7Z",
    playlist: "M4 5h12M4 9h12M4 13h8M19 4v12.5a2.5 2.5 0 1 1-2-2.45V7l5-1v8.5a2.5 2.5 0 1 1-2-2.45",
    podcast: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM6.5 7.5a8 8 0 0 0 0 9M17.5 7.5a8 8 0 0 1 0 9M3 4a12 12 0 0 0 0 16M21 4a12 12 0 0 1 0 16",
    radio: "M4 8h16v12H4zM4 8l15-5M8 12h.01M12 12h.01M16 12h.01M8 16h8",
    download: "M12 3v12m0 0 5-5m-5 5-5-5M4 20h16",
    song: "M9 18V5l12-2v13M9 9l12-2M5 20a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm12-2a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
    album: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 5a4 4 0 1 1 0 8 4 4 0 0 1 0-8Z",
    artist: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 9a7 7 0 0 1 14 0",
    profile: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21a8 8 0 0 1 16 0",
    grid: "M3 3h8v8H3zm10 0h8v8h-8zM3 13h8v8H3zm10 0h8v8h-8z",
    list: "M3 5h2v2H3zm4 0h14v2H7zM3 11h2v2H3zm4 0h14v2H7zM3 17h2v2H3zm4 0h14v2H7z",
  };

  let settings = { ...defaults };
  let scheduled = false;
  let lastPlaylistKey = "";
  let shufflePendingKey = "";
  let libraryCache = {};
  let libraryView = "grid";
  let lastVolume = null;
  let volumeRestored = false;
  let cacheWriteTimer = 0;
  let volumeWriteTimer = 0;
  const patchedRows = new WeakMap();
  const patchedVolumeControls = new WeakSet();
  const patchedMedia = new WeakSet();
  const modifiedProgress = new Map();

  function getText(node) {
    return (node?.innerText || node?.textContent || "").replace(/\s+/g, " ").trim();
  }

  function deepFind(root, selector, results = []) {
    if (!root) return results;
    if (root.querySelectorAll) results.push(...root.querySelectorAll(selector));
    if (root.shadowRoot) deepFind(root.shadowRoot, selector, results);
    const elements = root.querySelectorAll ? root.querySelectorAll("*") : [];
    for (const element of elements) {
      if (element.shadowRoot) deepFind(element.shadowRoot, selector, results);
    }
    return results;
  }

  function setPageSettings() {
    const root = document.documentElement;
    root.dataset.ymeActionColor = settings.actionColor;
    root.dataset.ymeMenuColor = settings.menuColor;
    root.dataset.ymePrimaryColor = settings.primaryColor;
    root.classList.toggle("yme-large-progress", settings.largeProgress);
    root.classList.toggle("yme-sidebar-icons", settings.sidebarIcons);
    root.style.setProperty("--yme-menu-accent", colorValue(settings.menuColor, colorValue(settings.primaryColor, "#ff4e55")));
  }

  function colorValue(name, fallback) {
    return ({ red: "#ff4e55", blue: "#4b9cff", green: "#4cbd82", purple: "#b07cff", plain: "#a8aaa8", match: fallback })[name] || fallback;
  }

  function setOwnedStyle(element, property, value) {
    let originals = modifiedProgress.get(element);
    if (!originals) {
      originals = new Map();
      modifiedProgress.set(element, originals);
    }
    if (!originals.has(property)) {
      originals.set(property, [element.style.getPropertyValue(property), element.style.getPropertyPriority(property)]);
    }
    if (value == null) {
      const [original, priority] = originals.get(property);
      if (original) element.style.setProperty(property, original, priority);
      else element.style.removeProperty(property);
      originals.delete(property);
      if (!originals.size) modifiedProgress.delete(element);
      return;
    }
    element.style.setProperty(property, value, "important");
  }

  function updateProgressBar() {
    if (!settings.largeProgress) {
      for (const [element, originals] of modifiedProgress) {
        for (const property of [...originals.keys()]) setOwnedStyle(element, property, null);
      }
      return;
    }
    for (const root of document.querySelectorAll("ytmusic-player-bar, ytmusic-miniplayer, ytmusic-player-page")) {
      const targets = deepFind(root, "#progress-bar, tp-yt-paper-slider, #sliderContainer, .slider-container");
      for (const element of targets) {
        if (/volume/i.test(`${element.id} ${element.getAttribute("aria-label") || ""}`)) continue;
        if (element.matches("tp-yt-paper-slider, #progress-bar")) setOwnedStyle(element, "--paper-slider-height", "8px");
        if (element.matches("#sliderContainer, .slider-container")) {
          setOwnedStyle(element, "height", "8px");
          setOwnedStyle(element, "min-height", "8px");
        }
      }
    }
  }

  function updateMenuColors() {
    const css = `
      tp-yt-paper-item:hover, [role="menuitem"]:hover, ytmusic-menu-service-item-renderer:hover {
        background-color: color-mix(in srgb, var(--yme-menu-accent, #ff4e55) 18%, transparent) !important;
      }
      tp-yt-paper-item:focus-visible, [role="menuitem"]:focus-visible, ytmusic-menu-service-item-renderer:focus-visible {
        outline: 2px solid var(--yme-menu-accent, #ff4e55) !important;
        outline-offset: -2px;
      }`;
    for (const menu of document.querySelectorAll("ytmusic-menu-popup-renderer")) {
      menu.style.setProperty("--yme-menu-accent", colorValue(settings.menuColor, colorValue(settings.primaryColor, "#ff4e55")));
      const shadow = menu.shadowRoot;
      if (shadow && !shadow.querySelector("style[data-yme-menu-style]")) {
        const style = document.createElement("style");
        style.dataset.ymeMenuStyle = "true";
        style.textContent = css;
        shadow.append(style);
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
      if (url.protocol !== "https:" || !/(^|\.)googleusercontent\.com$|(^|\.)ytimg\.com$/i.test(url.hostname)) return null;
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
    for (const image of deepFind(entry, "img, yt-img-shadow")) {
      const innerImage = image.matches("img") ? image : deepFind(image, "img")[0];
      const url = safeThumbnailUrl(innerImage?.currentSrc || innerImage?.src || image.getAttribute("src"));
      if (url) return url;
    }
    const dataCandidates = [entry.data, entry.item, entry.playlist, entry.rendererData, entry.__data?.data];
    for (const data of dataCandidates) {
      const url = thumbnailFromData(data);
      if (url) return url;
    }
    return null;
  }

  function playerRoots() {
    return document.querySelectorAll("ytmusic-player-bar, ytmusic-miniplayer, ytmusic-player-page");
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
    const value = Number(control.value);
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
    if (!controls.length && !media.length) return;
    for (const control of controls) {
      const min = Number(control.min || 0);
      const max = Number(control.max || 100);
      control.value = String(min + lastVolume * (max - min));
      control.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
      control.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
    }
    for (const element of media) element.volume = lastVolume;
    volumeRestored = true;
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
    for (const root of playerRoots()) {
      for (const media of deepFind(root, "audio, video")) {
        if (patchedMedia.has(media)) continue;
        patchedMedia.add(media);
        media.addEventListener("volumechange", () => saveVolume(media.volume), { passive: true });
      }
    }
    restoreVolume();
  }

  function playlistIdFromEntry(entry) {
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
    libraryCache[id] = { thumbnail, savedAt: Date.now() };
    const entries = Object.entries(libraryCache)
      .filter(([, value]) => Date.now() - value.savedAt < 7 * 24 * 60 * 60 * 1000)
      .slice(-250);
    libraryCache = Object.fromEntries(entries);
    clearTimeout(cacheWriteTimer);
    cacheWriteTimer = setTimeout(() => extensionApi.storage.local.set({ ymeLibraryArtworkCache: libraryCache }), 500);
  }

  function mergeSidebarShortcuts(stored) {
    const saved = Array.isArray(stored) ? stored.filter((entry) => entry && typeof entry.path === "string" && entry.path.startsWith("/") && !entry.path.startsWith("//")) : [];
    const byId = new Map(saved.map((entry) => [entry.id, entry]));
    return [
      ...saved.map((entry) => ({ ...predefinedShortcuts.find((item) => item.id === entry.id), ...entry, enabled: entry.enabled !== false })),
      ...predefinedShortcuts.filter((entry) => !byId.has(entry.id)),
    ];
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
    button.textContent = info.button;
    button.title = info.match.source.replaceAll("\\s", " ");
    button.setAttribute("aria-label", `${info.button} this track`);
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (action === "preview") {
        openSidePlay(row);
        return;
      }
      runNativeAction(row, info.match);
    });
    return button;
  }

  function openSidePlay(row) {
    const trackLink = row.querySelector("a[href*='/watch?v=']") || deepFind(row, "a[href*='/watch?v=']")[0];
    if (!trackLink) {
      showNotice("Couldn’t identify this track for side play.");
      return;
    }
    let videoId;
    try {
      videoId = new URL(trackLink.href, location.origin).searchParams.get("v");
    } catch {
      videoId = null;
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

  function runNativeAction(row, matcher, attempt = 0) {
    const trigger = findRowMenuButton(row);
    if (!trigger) {
      showNotice("Couldn’t find this track’s menu. Use YouTube Music’s three-dot menu.");
      return;
    }

    if (attempt === 0) trigger.click();
    requestAnimationFrame(() => {
      const menuItems = deepFind(document, "ytmusic-menu-service-item-renderer, tp-yt-paper-item, [role='menuitem']");
      const item = menuItems.find((candidate) => matcher.test(getText(candidate)) && candidate.getClientRects().length);
      if (item) {
        item.click();
      } else if (attempt < 8) {
        setTimeout(() => runNativeAction(row, matcher, attempt + 1), 55);
      } else {
        showNotice("That action isn’t available here. The playlist may be read-only.");
      }
    });
  }

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
      patchedRows.set(row, actionKey);
    }
  }

  function enhanceSidebar() {
    if (settings.sidebarIcons) {
      for (const entry of document.querySelectorAll("ytmusic-guide-library-entry-renderer:not([data-yme-icon-checked])")) {
        entry.dataset.ymeIconChecked = "true";
        const hasNativeIcon = deepFind(entry, "yt-icon, yt-img-shadow, img").some((icon) => icon.getClientRects().length);
        if (hasNativeIcon) continue;
        const text = getText(entry);
        const id = playlistIdFromEntry(entry);
        const liveThumbnail = playlistThumbnail(entry);
        if (id && liveThumbnail) rememberLibraryImage(id, liveThumbnail);
        const thumbnail = liveThumbnail || (id && libraryCache[id]?.thumbnail);
        entry.dataset.ymeIconKind = /download/i.test(text)
          ? "download"
          : /liked|favorite/i.test(text)
            ? "liked"
            : /radio/i.test(text)
              ? "radio"
              : "playlist";
        if (thumbnail) {
          entry.dataset.ymeHasArt = "true";
          entry.style.setProperty("--yme-playlist-art", `url("${thumbnail.replaceAll('"', "%22")}")`);
        }
      }
    }

    const host = document.querySelector("ytmusic-guide-renderer") || document.querySelector("ytmusic-guide-content-renderer");
    if (!host) return;
    let shortcutList = document.querySelector("#yme-sidebar-shortcuts");
    if (!shortcutList) {
      shortcutList = document.createElement("div");
      shortcutList.id = "yme-sidebar-shortcuts";
      shortcutList.setAttribute("aria-label", "Music Enhancer shortcuts");
    }
    const libraryEntry = [...document.querySelectorAll("ytmusic-guide-entry-renderer")]
      .find((entry) => /^library$/i.test(getText(entry)));
    if (libraryEntry?.parentElement) libraryEntry.after(shortcutList);
    else if (shortcutList.parentElement !== host) host.append(shortcutList);
    const visibleShortcuts = (settings.sidebarShortcuts || []).filter((shortcut) => shortcut.enabled !== false);
    const signature = JSON.stringify(visibleShortcuts);
    if (shortcutList.dataset.signature === signature) return;
    shortcutList.replaceChildren();
    shortcutList.dataset.signature = signature;
    for (const shortcut of visibleShortcuts) {
      if (!shortcut?.label || !shortcut.path?.startsWith("/") || shortcut.path.startsWith("//")) continue;
      const link = document.createElement("a");
      link.className = "yme-sidebar-shortcut";
      link.href = shortcut.path;
      link.title = shortcut.label;
      const icon = iconPaths[shortcut.icon] ? shortcut.icon : "playlist";
      const iconNode = document.createElement("span");
      iconNode.className = "yme-sidebar-icon";
      iconNode.append(makeIcon(icon));
      const label = document.createElement("span");
      label.textContent = shortcut.label;
      link.append(iconNode, label);
      shortcutList.append(link);
    }
  }

  function enableShuffleForNewPlaylist() {
    const key = playlistKey();
    if (!key || !settings.shuffleOnOpen || key === lastPlaylistKey || key === shufflePendingKey) return;
    shufflePendingKey = key;
    const attempt = (count = 0) => {
      if (key !== playlistKey() || !settings.shuffleOnOpen) {
        if (shufflePendingKey === key) shufflePendingKey = "";
        return;
      }
      const buttons = deepFind(document, "button, [role='button'], yt-icon-button");
      const shuffle = buttons.find((button) => {
        const label = `${button.getAttribute("aria-label") || ""} ${button.getAttribute("title") || ""}`;
        return /shuffle/i.test(label);
      });
      if (shuffle) {
        shufflePendingKey = "";
        lastPlaylistKey = key;
        const label = `${shuffle.getAttribute("aria-label") || ""} ${shuffle.getAttribute("title") || ""}`;
        if (shuffle.getAttribute("aria-pressed") !== "true" && !/turn off|disable|stop/i.test(label)) shuffle.click();
      } else if (count < 8) {
        setTimeout(() => attempt(count + 1), 90);
      } else if (shufflePendingKey === key) {
        shufflePendingKey = "";
      }
    };
    requestAnimationFrame(() => attempt());
  }

  function updateLibraryViewSelector() {
    if (!location.pathname.startsWith("/library")) return;
    const controls = deepFind(document, "ytmusic-sort-filter-button-renderer, tp-yt-paper-button, button, [role='button']");
    const recent = controls.find((element) => /recent activity/i.test(`${getText(element)} ${element.getAttribute("aria-label") || ""} ${element.getAttribute("title") || ""}`));
    if (!recent?.parentElement) return;

    const id = "yme-library-view-selector";
    let selector = document.getElementById(id);
    if (!selector) {
      selector = document.createElement("div");
      selector.id = id;
      selector.setAttribute("aria-label", "Library layout");
      selector.className = "yme-library-view-selector";
      for (const view of ["list", "grid"]) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "yme-library-view-button";
        button.dataset.view = view;
        button.setAttribute("aria-label", `${view === "list" ? "List" : "Grid"} view`);
        button.title = `${view === "list" ? "List" : "Grid"} view`;
        button.append(makeIcon(view));
        button.addEventListener("click", () => setLibraryView(view));
        selector.append(button);
      }
    }
    const parent = recent.parentElement;
    if (selector.parentElement !== parent || selector.nextElementSibling !== recent) parent.insertBefore(selector, recent);
    paintLibraryViewSelector();
    const styleRoot = recent.getRootNode();
    if (styleRoot?.querySelector && !styleRoot.querySelector("style[data-yme-library-view-style]")) {
      const style = document.createElement("style");
      style.dataset.ymeLibraryViewStyle = "true";
      style.textContent = `
        #yme-library-view-selector { display:flex; gap:2px; align-items:center; margin-inline-end:8px; }
        .yme-library-view-button { width:34px; height:32px; display:grid; place-items:center; border:0; border-radius:6px; background:transparent; color:var(--yt-spec-text-secondary,#aaa); cursor:pointer; }
        .yme-library-view-button:hover { background:var(--yt-spec-10-percent-layer,#ffffff1a); color:var(--yt-spec-text-primary,#fff); }
        .yme-library-view-button[aria-pressed="true"] { background:var(--yt-spec-10-percent-layer,#ffffff1a); color:var(--yt-spec-text-primary,#fff); }
        .yme-library-view-button svg { width:18px; height:18px; fill:none; stroke:currentColor; stroke-width:1.8; stroke-linecap:round; stroke-linejoin:round; }
        :host-context(html[data-yme-library-view="list"]) ytmusic-two-row-item-renderer { width:100%!important; min-height:72px!important; }
        :host-context(html[data-yme-library-view="list"]) ytmusic-two-row-item-renderer #thumbnail { width:56px!important; height:56px!important; }
      `;
      if (styleRoot === document) document.head.append(style);
      else styleRoot.append(style);
    }
  }

  function paintLibraryViewSelector() {
    document.documentElement.dataset.ymeLibraryView = libraryView;
    const selector = document.querySelector("#yme-library-view-selector");
    if (!selector) return;
    for (const button of selector.querySelectorAll("button[data-view]")) {
      button.setAttribute("aria-pressed", String(button.dataset.view === libraryView));
    }
  }

  function setLibraryView(view) {
    libraryView = view === "list" ? "list" : "grid";
    paintLibraryViewSelector();
    extensionApi.storage.local.set({ ymeLibraryView: libraryView });
    const nativeControl = deepFind(document, "button, [role='button'], yt-icon-button")
      .find((element) => !element.closest("#yme-library-view-selector") && new RegExp(`${libraryView} view`, "i").test(`${element.getAttribute("aria-label") || ""} ${element.getAttribute("title") || ""}`));
    nativeControl?.click();
  }

  function updatePage() {
    setPageSettings();
    enhanceSidebar();
    const key = playlistKey();
    if (!key || !settings.quickActionsEnabled || !settings.quickActions.length) {
      for (const bar of document.querySelectorAll(".yme-quick-actions")) bar.remove();
    }
    enhancePlaylistRows();
    enableShuffleForNewPlaylist();
    updateProgressBar();
    updateMenuColors();
    bindVolumeControls();
    updateLibraryViewSelector();
  }

  function relevantMutation(record) {
    for (const node of record.addedNodes) {
      if (node.nodeType !== Node.ELEMENT_NODE) continue;
      if (node.matches?.("ytmusic-responsive-list-item-renderer, ytmusic-guide-entry-renderer, ytmusic-guide-library-entry-renderer, ytmusic-player-bar, ytmusic-menu-popup-renderer, tp-yt-paper-slider, ytmusic-two-row-item-renderer")) return true;
      if (node.querySelector?.("ytmusic-responsive-list-item-renderer, ytmusic-guide-entry-renderer, ytmusic-guide-library-entry-renderer, ytmusic-player-bar, ytmusic-menu-popup-renderer, tp-yt-paper-slider, ytmusic-two-row-item-renderer")) return true;
      if (node.parentElement?.closest("ytmusic-guide-library-entry-renderer:not([data-yme-icon-checked])")) return true;
    }
    return false;
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
    extensionApi.storage.onChanged.addListener((changes, area) => {
      if (area !== "local") return;
      for (const [key, change] of Object.entries(changes)) {
        if (key in settings) settings[key] = change.newValue ?? defaults[key];
      }
      if (changes.shuffleOnOpen) lastPlaylistKey = "";
      if (changes.rememberVolume) {
        volumeRestored = false;
        if (settings.rememberVolume) extensionApi.storage.local.get("ymeLastVolume").then((stored) => {
          lastVolume = typeof stored.ymeLastVolume === "number" ? stored.ymeLastVolume : null;
          bindVolumeControls();
        });
      }
      if (changes.ymeLibraryView) libraryView = changes.ymeLibraryView.newValue === "list" ? "list" : "grid";
      scheduleUpdate();
    });

    const observer = new MutationObserver((records) => {
      if (records.some(relevantMutation)) scheduleUpdate();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  Promise.all([
    extensionApi.storage.local.get(defaults),
    extensionApi.storage.local.get(["ymeLibraryArtworkCache", "ymeLibraryView", "ymeLastVolume"]),
  ]).then(([stored, persisted]) => {
    settings = { ...defaults, ...stored };
    if (!Array.isArray(settings.quickActions)) settings.quickActions = [...defaults.quickActions];
    settings.sidebarShortcuts = mergeSidebarShortcuts(stored.sidebarShortcuts);
    libraryCache = Object.fromEntries(Object.entries(persisted.ymeLibraryArtworkCache || {}).filter(([, entry]) => entry?.thumbnail && Date.now() - entry.savedAt < 7 * 24 * 60 * 60 * 1000));
    libraryView = persisted.ymeLibraryView === "list" ? "list" : "grid";
    lastVolume = typeof persisted.ymeLastVolume === "number" ? persisted.ymeLastVolume : null;
    installNavigationHooks();
    scheduleUpdate();
  });
})();
