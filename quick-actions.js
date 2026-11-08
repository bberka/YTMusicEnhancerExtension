import { deepFind, findRowMenuButton, makeIcon, playlistKey } from "./content-utils.js";
import { showNotice } from "./notice.js";

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

export function createQuickActions() {
  const patchedRows = new WeakMap();

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
    dialog.tabIndex = -1;
    dialog.setAttribute("aria-label", "Side play bar. Press Escape or click outside to close.");
    const frame = document.createElement("iframe");
    frame.title = "Side play bar";
    frame.allow = "autoplay; encrypted-media; picture-in-picture";
    frame.src = `https://music.youtube.com/watch?v=${encodeURIComponent(videoId)}&autoplay=1&yme-sideplay=1`;
    dialog.append(frame);
    document.body.append(dialog);

    let restored = false;
    let cleanup = () => {};
    const restoreMainPlayer = () => {
      if (restored) return;
      restored = true;
      cleanup();
      frame.src = "about:blank";
      dialog.remove();
      for (const { media, time, wasPlaying } of pausedTracks) {
        if (!media.isConnected) continue;
        try { media.currentTime = time; } catch { /* The site may have replaced this media element. */ }
        if (wasPlaying) media.play().catch(() => {});
      }
    };
    const closeOnKey = (event) => {
      if (event.key === "Escape") restoreMainPlayer();
    };
    const closeOnOutside = (event) => {
      if (!dialog.contains(event.target)) restoreMainPlayer();
    };
    document.addEventListener("keydown", closeOnKey, true);
    document.addEventListener("pointerdown", closeOnOutside, true);
    cleanup = () => {
      document.removeEventListener("keydown", closeOnKey, true);
      document.removeEventListener("pointerdown", closeOnOutside, true);
    };
    dialog.show();
    dialog.focus();
  }

  function clear() {
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

  function enhance(settings) {
    if (!playlistKey() || !settings.quickActionsEnabled || !settings.quickActions.length) {
      clear();
      return;
    }
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

  return { enhance };
}

// Ask the page world to open the native menu, because its handlers live there.
document.addEventListener("contextmenu", (event) => {
  if (event.defaultPrevented || event.shiftKey) return;
  const path = event.composedPath();
  if (path.some((node) => node instanceof Element && node.matches("input, textarea, select, .yme-quick-action"))) return;
  const target = path.find((node) => node instanceof Element && node.matches("ytmusic-responsive-list-item-renderer, ytmusic-two-row-item-renderer, ytmusic-detail-header-renderer, ytmusic-responsive-header-renderer, ytmusic-editable-playlist-detail-header-renderer, ytmusic-player-bar, ytmusic-menu-renderer"));
  if (!target) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  document.dispatchEvent(new CustomEvent("yme-context-menu", {
    bubbles: true,
    composed: true,
    cancelable: true,
    detail: { clientX: event.clientX, clientY: event.clientY },
  }));
}, true);
