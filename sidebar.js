export function createSidebarEnhancer({ deepFind, makeIcon, scheduleUpdate, thumbnail, playlistId, rememberImage, cachedImage }) {
  const observed = new WeakSet();
  const originals = new WeakMap();
  const railSources = new WeakMap();

  function style(element, property, value) {
    let values = originals.get(element);
    if (!values) originals.set(element, values = new Map());
    if (value === null) {
      if (!values.has(property)) return;
      const [original, priority] = values.get(property);
      if (original) element.style.setProperty(property, original, priority);
      else element.style.removeProperty(property);
      values.delete(property);
      return;
    }
    if (!values.has(property)) values.set(property, [element.style.getPropertyValue(property), element.style.getPropertyPriority(property)]);
    if (element.style.getPropertyValue(property) !== value) element.style.setProperty(property, value, "important");
  }

  function observe(root) {
    if (observed.has(root)) return;
    observed.add(root);
    new MutationObserver(scheduleUpdate).observe(root, { childList: true, subtree: true, characterData: true,
      attributes: true, attributeFilter: ["src", "href", "active", "aria-current"] });
    root.addEventListener("load", scheduleUpdate, true);
  }

  function paintArtwork(slot, art) {
    if (slot.dataset.art === (art || "fallback")) return;
    slot.dataset.art = art || "fallback";
    const svg = makeIcon("playlist");
    svg.style.cssText = "width:24px;height:24px;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round";
    slot.replaceChildren(svg);
    if (!art) return;
    const image = document.createElement("img");
    image.alt = "";
    image.referrerPolicy = "no-referrer";
    image.style.cssText = "position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:4px";
    image.addEventListener("error", () => image.remove(), { once: true });
    image.src = art;
    slot.append(image);
  }

  function libraryRow(entry, settings) {
    const root = entry.shadowRoot || entry;
    observe(root);
    const link = deepFind(entry, "a, #endpoint, tp-yt-paper-item, [role='link']")[0];
    if (!link) return; // Polymer may not have rendered this row yet.
    const subtitleNodes = deepFind(entry, "#subtitle, .subtitle, #sub-title, .secondary-text, .subtitle-group");
    for (const target of [entry, link]) {
      style(target, "min-height", settings.compactPlaylistSidebar ? "44px" : settings.sidebarIcons ? "48px" : null);
      style(target, "height", settings.compactPlaylistSidebar ? "44px" : null);
      style(target, "box-sizing", settings.compactPlaylistSidebar ? "border-box" : null);
    }
    style(link, "padding-block", settings.compactPlaylistSidebar ? "0px" : null);
    for (const node of subtitleNodes) style(node, "display", settings.compactLibrary ? "none" : null);

    const id = playlistId(entry);
    const live = thumbnail(entry);
    if (id && live) rememberImage(id, live);
    const art = live || cachedImage(id);
    const excluded = ".yme-library-art, ytmusic-menu-renderer, .menu, .subtitle-group, #inline-badges, .subtitle, .avatar, .owner";
    const nativeArtwork = deepFind(entry, ".guide-icon, ytmusic-thumbnail-renderer, yt-img-shadow, img")
      .filter((node) => !node.closest(excluded));
    // Own the leading slot: native playlist icons may have SVG paths but be hidden by site CSS.
    for (const native of nativeArtwork) style(native, "display", settings.sidebarIcons ? "none" : null);
    let icon = root.querySelector(".yme-library-art");
    if (!settings.sidebarIcons) {
      icon?.remove();
      style(link, "padding-inline-start", null);
      style(link, "position", null);
      return;
    }
    if (!icon) {
      icon = document.createElement("span");
      icon.className = "yme-library-art";
      icon.setAttribute("aria-hidden", "true");
      icon.style.cssText = "position:absolute;inset-inline-start:12px;top:50%;transform:translateY(-50%);display:grid;place-items:center;pointer-events:none;color:var(--yt-spec-text-secondary,#aaa)";
      link.prepend(icon);
    }
    const size = settings.compactPlaylistSidebar ? "32px" : "40px";
    icon.style.width = size;
    icon.style.height = size;
    style(link, "position", "relative");
    style(link, "padding-inline-start", settings.compactPlaylistSidebar ? "56px" : "64px");
    paintArtwork(icon, art);
  }

  function identify(entry) {
    if (["home", "explore", "library"].includes(entry.dataset.ymeNavId)) return entry.dataset.ymeNavId;
    if (entry.dataset.ymePlaylistId) return null;
    const anchor = deepFind(entry, "a[href]")[0];
    if (anchor) {
      const path = new URL(anchor.href, location.origin).pathname.replace(/\/$/, "") || "/";
      const id = ({ "/": "home", "/explore": "explore", "/library": "library",
        "/browse/FEmusic_home": "home", "/browse/FEmusic_explore": "explore", "/browse/FEmusic_library_landing": "library" })[path];
      if (id) return id;
    }
    const text = (deepFind(entry, ".title, #title, yt-formatted-string")[0]?.textContent || entry.textContent || "").trim().toLowerCase();
    return ["home", "explore", "library"].includes(text) ? text : null;
  }

  function navigationRoute(value) {
    const url = new URL(value, location.origin);
    const aliases = {
      FEmusic_home: "/", FEmusic_explore: "/explore", FEmusic_library_landing: "/library",
      FEmusic_liked_playlists: "/library/playlists", FEmusic_liked_videos: "/library/songs",
      FEmusic_liked_albums: "/library/albums", FEmusic_library_corpus_track_artists: "/library/artists",
      FEmusic_library_corpus_artists: "/library/channels", FEmusic_library_non_music_audio_list: "/library/podcasts",
    };
    let path = url.pathname.replace(/\/+$/, "") || "/";
    if (path.startsWith("/browse/VL")) {
      url.searchParams.set("list", path.slice("/browse/VL".length));
      path = "/playlist";
    } else if (path.startsWith("/browse/")) path = aliases[path.slice("/browse/".length)] || path;
    return { path, query: url.searchParams };
  }

  function activeShortcut(settings) {
    const current = navigationRoute(location.href);
    let active = null;
    let bestScore = -1;
    for (const item of settings.sidebarShortcuts) {
      if (!item.enabled) continue;
      const target = navigationRoute(item.path);
      const exact = target.path === current.path;
      const parent = item.native && target.path !== "/" && current.path.startsWith(`${target.path}/`);
      if ((!exact && !parent) || ![...target.query].every(([key, value]) => current.query.get(key) === value)) continue;
      const score = (exact ? 10000 : 0) + target.path.length + target.query.size * 100;
      if (score > bestScore) { active = item.id; bestScore = score; }
    }
    return active;
  }

  function markCurrent(element, current) {
    if (current) {
      if (element.getAttribute("aria-current") !== "page") element.setAttribute("aria-current", "page");
    } else if (element.hasAttribute("aria-current")) element.removeAttribute("aria-current");
  }

  function updateHost(host, settings, sourceRows, activeId) {
    const collapsed = host.id === "mini-guide-renderer" || host.hasAttribute("is-collapsed");
    const navigationId = collapsed ? "yme-sidebar-rail-shortcuts" : "yme-sidebar-shortcuts";
    observe(host.shadowRoot || host);
    const newPlaylistButtons = deepFind(host, "#new-playlist-button, button, [role='button'], yt-button-renderer, ytmusic-button-renderer")
      .filter((button) => {
        if (button.id === "new-playlist-button") return true;
        const label = (button.getAttribute("aria-label") || button.getAttribute("title") || button.textContent || "").trim();
        return /^(new|create) playlist$/i.test(label);
      });
    for (const button of newPlaylistButtons) style(button, "display", settings.hideNewPlaylist ? "none" : null);
    const entries = deepFind(host, "ytmusic-guide-entry-renderer");
    for (const row of deepFind(host, "ytmusic-guide-library-entry-renderer, ytmusic-guide-entry-renderer")) {
      if (!identify(row) && !row.hasAttribute("is-primary")) libraryRow(row, settings);
    }
    const native = new Map();
    for (const entry of entries) {
      const id = identify(entry);
      if (!id) continue;
      if (entry.dataset.ymeNavId !== id) entry.dataset.ymeNavId = id;
      native.set(id, entry);
      const preset = settings.sidebarShortcuts.find((item) => item.id === id);
      const current = id === activeId;
      if (entry.hasAttribute("active") !== current) entry.toggleAttribute("active", current);
      const endpoint = deepFind(entry, "a, #endpoint, tp-yt-paper-item, [role='link']")[0];
      if (endpoint) markCurrent(endpoint, current);
      style(entry, "display", preset?.enabled === false ? "none" : null);
      for (const target of [entry, deepFind(entry, "a, #endpoint, tp-yt-paper-item, [role='link']")[0]].filter(Boolean)) {
        style(target, "height", settings.compactSidebar && !collapsed ? "36px" : null);
        style(target, "min-height", settings.compactSidebar && !collapsed ? "36px" : null);
        for (const [property, value] of [["width", "100%"], ["max-width", "100%"], ["min-width", "0px"], ["box-sizing", "border-box"], ["margin-inline", "0px"]]) {
          style(target, property, collapsed ? value : null);
        }
      }
      if (collapsed) {
        const link = deepFind(entry, "a, #endpoint, tp-yt-paper-item, [role='link']")[0];
        if (link) style(link, "padding-inline", null);
        for (const title of deepFind(entry, ".title-column")) {
          style(title, "max-width", "100%");
          style(title, "min-width", "0px");
        }
      }
      for (const icon of deepFind(entry, ".guide-icon, yt-icon")) {
        style(icon, "width", settings.compactSidebar ? "20px" : null);
        style(icon, "height", settings.compactSidebar ? "20px" : null);
        style(icon, "flex-basis", settings.compactSidebar ? "20px" : null);
      }
    }
    const ordered = settings.sidebarShortcuts.filter((item) => item.native).map((item) => native.get(item.id)).filter(Boolean);
    if (!ordered.length) return;
    let shortcuts = deepFind(host, `#${navigationId}`)[0];
    const parent = shortcuts?.parentElement || ordered[0].parentElement;
    if (!ordered.every((entry) => entry.parentElement === parent || entry.parentElement === shortcuts)) return;
    const root = parent.getRootNode();
    if (!root.querySelector("style[data-yme-sidebar]")) {
      const sheet = document.createElement("style");
      sheet.dataset.ymeSidebar = "true";
      sheet.textContent = `.yme-sidebar-shortcut:hover, .yme-sidebar-shortcut[aria-current="page"] { background:var(--yt-spec-10-percent-layer,#ffffff1a); }
        .yme-sidebar-shortcut:focus:not(:focus-visible) { outline:none; }
        .yme-sidebar-shortcut:focus-visible, .yme-rail-playlist:focus-visible { outline:2px solid var(--yt-spec-text-primary,#fff);outline-offset:-2px; }
        .yme-rail-playlist:hover { background:var(--yt-spec-10-percent-layer,#ffffff1a); }`;
      (root === document ? document.head : root).append(sheet);
    }
    if (!shortcuts) {
      shortcuts = document.createElement("div");
      shortcuts.id = navigationId;
      shortcuts.setAttribute("role", "navigation");
      shortcuts.setAttribute("aria-label", "Music navigation");
      shortcuts.style.cssText = "display:grid;gap:0;margin:0;padding:0;border:0;min-width:0;box-sizing:border-box;width:100%";
      parent.insertBefore(shortcuts, [...parent.children].find((node) => ordered.includes(node)));
    }
    const desired = [];
    for (const item of settings.sidebarShortcuts) {
      if (item.native) {
        if (native.has(item.id)) desired.push(native.get(item.id));
        continue;
      }
      if (!item.enabled) continue;
      const signature = JSON.stringify([item, settings.compactSidebar, collapsed]);
      let link = [...shortcuts.querySelectorAll(".yme-sidebar-shortcut")].find((node) => node.dataset.shortcutId === item.id);
      if (link?.dataset.signature === signature) { desired.push(link); continue; }
      link = document.createElement("a");
      link.dataset.shortcutId = item.id;
      link.dataset.signature = signature;
      link.href = item.path;
      link.title = item.label;
      link.className = "yme-sidebar-shortcut";
      link.style.cssText = `box-sizing:border-box;display:flex;align-items:center;gap:20px;min-height:${settings.compactSidebar ? 36 : 48}px;padding:0 16px;border-radius:8px;color:var(--yt-spec-text-primary,#fff);font:500 16px/24px Roboto,Arial,sans-serif;text-decoration:none`;
      if (collapsed) link.style.cssText = `box-sizing:border-box;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;min-height:${settings.compactSidebar ? 60 : 64}px;min-width:0;width:100%;margin:0;padding:6px 2px;border-radius:8px;color:var(--yt-spec-text-primary,#fff);font:500 10px/14px Roboto,Arial,sans-serif;text-decoration:none`;
      const icon = makeIcon(item.icon);
      const size = settings.compactSidebar ? 20 : 24;
      icon.style.cssText = `width:${size}px;height:${size}px;flex:0 0 ${size}px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round`;
      link.append(icon);
      const label = document.createElement("span");
      label.textContent = item.label;
      label.style.cssText = "max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap";
      link.append(label);
      desired.push(link);
    }
    for (const node of [...shortcuts.children]) if (!desired.includes(node)) node.remove();
    desired.forEach((node, index) => {
      if (shortcuts.children[index] !== node) shortcuts.insertBefore(node, shortcuts.children[index] || null);
    });
    for (const link of shortcuts.querySelectorAll(".yme-sidebar-shortcut")) markCurrent(link, link.dataset.shortcutId === activeId);
    const primarySection = shortcuts.closest("ytmusic-guide-section-renderer");
    if (primarySection) {
      for (const divider of deepFind(primarySection, "#divider")) {
        style(divider, "margin-block", collapsed ? null : settings.hideNewPlaylist ? "4px" : "8px");
      }
    }
    if (!collapsed) {
      // Playlist rows may also live in wrappers outside a guide section.
      for (const row of deepFind(host, "ytmusic-guide-library-entry-renderer, ytmusic-guide-entry-renderer")) {
        if (identify(row) || row.hasAttribute("is-primary")) continue;
        for (let parent = row.parentElement; parent && parent !== host && !parent.contains(shortcuts); parent = parent.parentElement) {
          style(parent, "padding-block-start", settings.hideNewPlaylist ? "0px" : null);
          style(parent, "margin-block-start", settings.hideNewPlaylist ? "0px" : null);
        }
      }
      // The native playlist section can retain its top inset after its create button is hidden.
      for (const section of deepFind(host, "ytmusic-guide-section-renderer")) {
        if (section === primarySection || !deepFind(section, "ytmusic-guide-library-entry-renderer, ytmusic-guide-entry-renderer").some((row) => !identify(row) && !row.hasAttribute("is-primary"))) continue;
        for (const container of [section, ...deepFind(section, "#items")]) {
          style(container, "padding-block-start", settings.hideNewPlaylist ? "0px" : null);
          style(container, "margin-block-start", settings.hideNewPlaylist ? "0px" : null);
        }
      }
    }
    if (collapsed) {
      const sections = deepFind(host, "#sections")[0] || host;
      style(sections, "display", "flex");
      style(sections, "flex-direction", "column");
      style(sections, "overflow", "hidden");
      style(sections, "scrollbar-gutter", "auto");
      style(sections, "box-sizing", "border-box");
      style(sections, "width", "100%");
      style(sections, "padding", "0px");
      style(sections, "height", "calc(100dvh - 64px - var(--ytmusic-player-bar-height, 72px))");
      style(sections, "max-height", "calc(100dvh - 64px - var(--ytmusic-player-bar-height, 72px))");
      // Native #items is a nested scroller with an inset. Keep navigation fixed above the playlist scroller.
      for (const container of new Set([parent, shortcuts.parentElement])) {
        style(container, "box-sizing", "border-box");
        style(container, "width", "100%");
        style(container, "padding", "0px");
        style(container, "margin", "0px");
        style(container, "overflow", "visible");
      }
      const primary = shortcuts.closest("ytmusic-guide-section-renderer");
      if (primary) {
        style(primary, "flex", "0 0 auto");
        style(primary, "width", "100%");
        for (const divider of deepFind(primary, "#divider")) style(divider, "display", "none");
      }
      let playlists = deepFind(host, "#yme-rail-playlists")[0];
      if (!playlists) {
        playlists = document.createElement("nav");
        playlists.id = "yme-rail-playlists";
        playlists.setAttribute("aria-label", "Your playlists");
        playlists.style.cssText = "box-sizing:border-box;display:flex;flex-direction:column;flex:1 1 auto;min-height:0;min-width:0;width:100%;overflow-y:auto;overflow-x:hidden;scrollbar-gutter:auto;overscroll-behavior:contain;border-top:1px solid var(--yt-spec-10-percent-layer,#ffffff1a);padding:4px 0;margin:4px 0 0";
        sections.append(playlists);
      }
      railSources.set(playlists, sourceRows);
      const items = sourceRows.map((row) => ({
        title: deepFind(row, ".title, #title")[0]?.textContent?.trim() || "Playlist",
        art: thumbnail(row) || cachedImage(playlistId(row)),
      }));
      style(playlists, "display", items.length ? "flex" : "none");
      const signature = JSON.stringify([items, settings.sidebarIcons, settings.compactPlaylistSidebar]);
      if (playlists.dataset.signature === signature) return;
      playlists.dataset.signature = signature;
      playlists.replaceChildren();
      items.forEach((item, index) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "yme-rail-playlist";
        button.title = item.title;
        button.setAttribute("aria-label", item.title);
        button.style.cssText = `box-sizing:border-box;display:flex;flex-direction:column;align-items:center;justify-content:center;flex:0 0 auto;gap:${settings.compactPlaylistSidebar ? 2 : 5}px;min-height:${settings.compactPlaylistSidebar ? 52 : 60}px;min-width:0;width:100%;margin:0;padding:${settings.compactPlaylistSidebar ? 4 : 6}px 2px;border:0;border-radius:6px;background:transparent;color:var(--yt-spec-text-primary,#fff);font:500 10px/14px Roboto,Arial,sans-serif;cursor:pointer`;
        {
          const slot = document.createElement("span");
          slot.className = "yme-rail-art";
          slot.setAttribute("aria-hidden", "true");
          const artworkSize = settings.compactPlaylistSidebar ? 32 : 40;
          slot.style.cssText = `position:relative;display:grid;place-items:center;flex:0 0 ${artworkSize}px;width:${artworkSize}px;height:${artworkSize}px;color:var(--yt-spec-text-secondary,#aaa)`;
          paintArtwork(slot, item.art);
          button.append(slot);
        }
        const label = document.createElement("span");
        label.className = "yme-rail-label";
        label.textContent = item.title;
        label.style.cssText = "display:block;width:100%;min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis";
        button.append(label);
        button.addEventListener("click", () => {
          const row = railSources.get(playlists)?.[index];
          deepFind(row, "tp-yt-paper-item, a, #endpoint, [role='link']")[0]?.click();
        });
        playlists.append(button);
      });
      playlists.hidden = items.length === 0;
    }
  }

  return function updateSidebar(settings) {
    const hosts = deepFind(document, "ytmusic-guide-renderer, ytmusic-guide-content-renderer")
      .filter((host) => !host.parentElement?.closest("ytmusic-guide-renderer, ytmusic-guide-content-renderer"));
    const expanded = hosts.find((host) => host.id !== "mini-guide-renderer" && !host.hasAttribute("is-collapsed"));
    const sourceRows = expanded ? deepFind(expanded, "ytmusic-guide-library-entry-renderer, ytmusic-guide-entry-renderer")
      .filter((row) => !identify(row) && !row.hasAttribute("is-primary")) : [];
    const activeId = activeShortcut(settings);
    for (const host of hosts) updateHost(host, settings, sourceRows, activeId);
  };
}
