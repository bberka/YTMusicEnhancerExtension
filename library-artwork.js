import { extensionApi } from "./extension-api.js";
import { deepFind } from "./content-utils.js";

const likedMusicArtwork = "https://www.gstatic.com/youtube/media/ytm/images/pbg/liked-songs-delhi-1200.png";

export function createLibraryArtwork() {
  let cache = {};
  let writeTimer = 0;

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

  function rememberImage(id, thumbnail) {
    if (!id || !thumbnail) return;
    if (cache[id]?.thumbnail === thumbnail) return;
    cache[id] = { thumbnail, savedAt: Date.now() };
    const entries = Object.entries(cache)
      .filter(([, value]) => Date.now() - value.savedAt < 7 * 24 * 60 * 60 * 1000)
      .slice(-250);
    cache = Object.fromEntries(entries);
    clearTimeout(writeTimer);
    writeTimer = setTimeout(() => extensionApi.storage.local.set({ ymeLibraryArtworkCache: cache }), 500);
  }

  return {
    thumbnail: playlistThumbnail,
    playlistId: playlistIdFromEntry,
    rememberImage,
    cachedImage: (id) => safeThumbnailUrl(cache[id]?.thumbnail),
    load(value) {
      cache = Object.fromEntries(Object.entries(value || {}).filter(([, entry]) => entry?.thumbnail && Date.now() - entry.savedAt < 7 * 24 * 60 * 60 * 1000));
    },
    cacheRendered() {
      if (!location.pathname.startsWith("/library")) return;
      for (const card of deepFind(document, "ytmusic-two-row-item-renderer")) {
        const id = playlistIdFromEntry(card);
        if (id) rememberImage(id, playlistThumbnail(card));
      }
    },
  };
}
