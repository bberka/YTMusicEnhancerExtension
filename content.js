import { createSidebarEnhancer } from "./sidebar.js";
import { installExploreCache } from "./explore-cache.js";
import { createPlayerSizer } from "./player-size.js";
import { createLibraryView } from "./library-view.js";
import { defaults, normalizeSettings } from "./src/settings.js";
import { extensionApi } from "./extension-api.js";
import { colorValue, deepFind, makeIcon } from "./content-utils.js";
import { showNotice } from "./notice.js";
import { createQuickActions } from "./quick-actions.js";
import { createLibraryArtwork } from "./library-artwork.js";
import { createVolumeMemory } from "./volume.js";
import { createShuffleSync } from "./shuffle.js";
import { createPlaylistSearch } from "./playlist-search.js";
import { installHoverGuide } from "./hover-guide.js";

(() => {
  let settings = { ...defaults };
  let scheduled = false;
  let libraryView = "grid";
  const updatePlayerSize = createPlayerSizer(deepFind);
  const updateExplore = installExploreCache({ storage: extensionApi.storage.local, deepFind });
  const libraryArtwork = createLibraryArtwork();
  const volume = createVolumeMemory({ getSettings: () => settings });
  const shuffle = createShuffleSync();
  const quickActions = createQuickActions();
  const playlistSearch = createPlaylistSearch();

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
    root.style.setProperty("--yme-menu-accent", menuAccent());
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

  function menuAccent() {
    return colorValue(settings.menuColor, colorValue(settings.primaryColor, "#ff4e55"));
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
      menu.style.setProperty("--yme-menu-accent", menuAccent());
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

  function scheduleUpdate() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      updatePage();
    });
  }

  const updateSidebar = createSidebarEnhancer({
    deepFind,
    makeIcon,
    scheduleUpdate,
    thumbnail: libraryArtwork.thumbnail,
    playlistId: libraryArtwork.playlistId,
    rememberImage: libraryArtwork.rememberImage,
    cachedImage: libraryArtwork.cachedImage,
  });

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
    libraryArtwork.cacheRendered();
    updateSidebar(settings);
    updateExplore();
    quickActions.enhance(settings);
    playlistSearch.refresh();
    shuffle.update();
    updatePlayerSize(settings.largeProgress);
    updateContextMenus();
    volume.bind();
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
      if (changes.ymeShuffleEnabled) shuffle.setEnabled(changes.ymeShuffleEnabled.newValue);
      if (changes.quickActions) settings.quickActions = normalizeSettings(settings).quickActions;
      if (changes.sidebarShortcuts) settings.sidebarShortcuts = normalizeSettings(settings).sidebarShortcuts;
      if (changes.ymeLibraryArtworkCache) libraryArtwork.load(changes.ymeLibraryArtworkCache.newValue);
      if (changes.rememberVolume) {
        volume.reset();
        if (settings.rememberVolume) extensionApi.storage.local.get("ymeLastVolume").then((stored) => {
          volume.load(stored.ymeLastVolume);
          volume.bind();
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
    settings = normalizeSettings(stored);
    libraryArtwork.load(persisted.ymeLibraryArtworkCache);
    libraryView = ["list", "large-list"].includes(persisted.ymeLibraryView) ? persisted.ymeLibraryView : "grid";
    volume.load(persisted.ymeLastVolume);
    shuffle.setEnabled(persisted.ymeShuffleEnabled !== false);
    installNavigationHooks();
    installSidebarResize();
    installHoverGuide();
    scheduleUpdate();
  });
})();
