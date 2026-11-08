const cacheKey = "ymeExploreSnapshot";
const lifetime = 6 * 60 * 60 * 1000;

function musicUrl(value) {
  try {
    const url = new URL(value, "https://music.youtube.com");
    return url.origin === "https://music.youtube.com" && /^\/(browse|playlist|watch|moods_and_genres|new_releases|charts)(\b|\/)/.test(url.pathname) ? url.href : null;
  } catch { return null; }
}

export function validateExploreSnapshot(value, locale, now = Date.now()) {
  if (!value || value.version !== 1 || value.locale !== locale || !Number.isFinite(value.savedAt)
    || value.savedAt > now || now - value.savedAt > lifetime || !Array.isArray(value.sections)) return null;
  const sections = value.sections.slice(0, 6).flatMap((section) => {
    if (!section || typeof section.title !== "string" || !Array.isArray(section.items)) return [];
    const items = section.items.slice(0, 16).flatMap((item) => {
      const href = item && musicUrl(item.href);
      if (!href || typeof item.title !== "string" || !item.title.trim()) return [];
      let image = null;
      try {
        const url = new URL(item.image);
        if (url.protocol === "https:" && /(^|\.)(ytimg|googleusercontent|ggpht)\.com$/.test(url.hostname)) image = url.href;
      } catch { /* Artwork is optional. */ }
      return [{ href, title: item.title.slice(0, 200), image }];
    });
    return items.length ? [{ title: section.title.slice(0, 100), items }] : [];
  });
  return sections.length ? { version: 1, locale, savedAt: value.savedAt, sections } : null;
}

export function installExploreCache({ storage, deepFind }) {
  const locale = document.documentElement.lang || navigator.language;
  let snapshot = null;
  let pending = 0;
  let signature = "";
  let frame = 0;
  let preview = null;

  function readSections(page) {
    // A route can change before Polymer replaces the previous page's contents.
    const isExplore = page.getAttribute("browse-id") === "FEmusic_explore"
      || deepFind(page, "a[href]").some((link) => /^\/(moods_and_genres|new_releases|charts)(\/|$)/.test(new URL(link.href).pathname));
    if (!isExplore) return [];
    const sections = [];
    for (const shelf of deepFind(page, "ytmusic-carousel-shelf-renderer, ytmusic-grid-renderer")) {
      const title = deepFind(shelf, "h2, #title")[0]?.textContent?.trim();
      if (!title) continue;
      const items = [];
      const seen = new Set();
      for (const card of deepFind(shelf, "ytmusic-two-row-item-renderer, ytmusic-navigation-button-renderer")) {
        const link = deepFind(card, "a[href]").find((anchor) => musicUrl(anchor.href));
        if (!link || seen.has(link.href)) continue;
        seen.add(link.href);
        const label = deepFind(card, ".title, #title")[0]?.textContent?.trim() || link.textContent?.trim() || link.title;
        if (!label) continue;
        const img = deepFind(card, "img")[0];
        items.push({ href: link.href, title: label, image: img?.currentSrc || img?.src || null });
      }
      if (items.length) sections.push({ title, items });
    }
    return sections;
  }

  function removePreview() {
    preview?.remove();
    preview = null;
  }

  function render(page) {
    if (preview?.isConnected || !snapshot) return;
    preview = document.createElement("section");
    preview.id = "yme-explore-preview";
    preview.setAttribute("aria-label", "Saved Explore content");
    const note = document.createElement("p");
    note.className = "yme-explore-note";
    note.textContent = "Saved Explore • Refreshing…";
    preview.append(note);
    for (const section of snapshot.sections) {
      const heading = document.createElement("h2");
      heading.textContent = section.title;
      const row = document.createElement("div");
      row.className = "yme-explore-row";
      for (const item of section.items) {
        const link = document.createElement("a");
        link.href = item.href;
        if (item.image) {
          const image = document.createElement("img");
          image.src = item.image;
          image.alt = "";
          image.loading = "lazy";
          image.referrerPolicy = "no-referrer";
          link.append(image);
        }
        const title = document.createElement("span");
        title.textContent = item.title;
        link.append(title);
        row.append(link);
      }
      preview.append(heading, row);
    }
    page.prepend(preview);
  }

  function update() {
    frame = 0;
    clearTimeout(pending);
    if (location.pathname !== "/explore") {
      removePreview();
      return;
    }
    const page = deepFind(document, "ytmusic-browse-response").find((node) =>
      !node.hidden && !node.closest("[hidden]") && node.getClientRects().length);
    if (!page) return;
    const sections = readSections(page);
    if (!sections.length) {
      if (snapshot && !validateExploreSnapshot(snapshot, locale)) snapshot = null;
      render(page);
      return;
    }
    removePreview();
    const next = validateExploreSnapshot({ version: 1, locale, savedAt: Date.now(), sections }, locale);
    if (!next) return;
    const nextSignature = JSON.stringify(next.sections);
    if (nextSignature === signature) return;
    pending = setTimeout(() => {
      if (location.pathname !== "/explore") return;
      snapshot = next;
      signature = nextSignature;
      storage.set({ [cacheKey]: snapshot }).catch(() => {});
    }, 800);
  }

  function schedule() {
    if (!frame) frame = requestAnimationFrame(update);
  }
  storage.get(cacheKey).then((stored) => {
    snapshot = validateExploreSnapshot(stored[cacheKey], locale);
    signature = snapshot ? JSON.stringify(snapshot.sections) : "";
    schedule();
  }).catch(() => {});
  new MutationObserver((records) => {
    if (records.some((record) => !record.target.closest?.("#yme-explore-preview"))) schedule();
  }).observe(document.documentElement, { childList: true, subtree: true });
  for (const event of ["yt-navigate-finish", "yt-page-data-updated", "popstate"]) addEventListener(event, schedule);
  return schedule;
}
