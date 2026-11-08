import { extensionApi } from "./extension-api.js";
import { deepFind } from "./content-utils.js";

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

export function createShuffleSync() {
  let enabled = true;
  let applying = false;
  let timer = null;
  let observedPlayer = null;
  const observer = new MutationObserver(() => schedule());

  function schedule() {
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      const bar = document.querySelector("ytmusic-player-bar");
      const button = bar?.querySelector("yt-icon-button.shuffle button, #expand-shuffle button");
      if (!bar || !button || button.disabled || !bar.getClientRects().length) return;
      if (bar.hasAttribute("shuffle-on") !== enabled) {
        applying = true;
        button.click();
        applying = false;
      }
    }, 300);
  }

  document.addEventListener("click", (event) => {
    if (applying) return;
    const path = event.composedPath();
    const bar = path.find((node) => node instanceof Element && node.matches("ytmusic-player-bar"));
    if (!bar || !path.some((node) => node instanceof Element && node.matches("yt-icon-button.shuffle, #expand-shuffle"))) return;
    enabled = !bar.hasAttribute("shuffle-on");
    clearTimeout(timer);
    timer = null;
    extensionApi.storage.local.set({ ymeShuffleEnabled: enabled });
  }, true);

  document.addEventListener("click", (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
    const path = event.composedPath();
    const play = path.find((node) => node instanceof Element && (node.matches("ytmusic-play-button-renderer") || node.matches("button, [role=button], yt-icon-button") && /^play(?:\s|$)/i.test(labelOf(node))));
    if (!play || /pause|shuffle/i.test(labelOf(play))) return;
    const container = path.find((node) => node instanceof Element && node.matches(collectionSelector));
    if (!container) return;
    const type = collectionType(container);
    if (!enabled || !type) return;
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

  return {
    update() {
      const bar = document.querySelector("ytmusic-player-bar");
      if (bar !== observedPlayer) {
        observer.disconnect();
        observedPlayer = bar;
        if (bar) observer.observe(bar, { attributes: true, attributeFilter: ["shuffle-on"] });
      }
      schedule();
    },
    setEnabled(value) {
      enabled = value !== false;
      schedule();
    },
  };
}
