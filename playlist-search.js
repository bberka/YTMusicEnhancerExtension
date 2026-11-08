import { deepFind, makeIcon, playlistKey } from "./content-utils.js";
import { showNotice } from "./notice.js";

export function createPlaylistSearch() {
  let current = null;

  function open() {
    const request = new CustomEvent("yme-playlist-find", { bubbles: true, composed: true, cancelable: true });
    if (document.dispatchEvent(request)) showNotice("Find in playlist isn’t available on this page.");
  }

  function style() {
    for (const input of deepFind(document, 'input[placeholder="Find on this page" i], input[aria-label="Find on this page" i]')) {
      const root = input.getRootNode();
      if (root === document || root.querySelector("style[data-yme-find-input]")) continue;
      const sheet = document.createElement("style");
      sheet.dataset.ymeFindInput = "true";
      sheet.textContent = 'input[placeholder="Find on this page" i], input[aria-label="Find on this page" i] { box-sizing:border-box!important;height:40px!important;min-height:40px!important;padding:0 48px 0 16px!important;border:1px solid var(--yt-spec-10-percent-layer,#ffffff33)!important;border-radius:8px!important;font:400 16px Roboto,Arial,sans-serif!important;color:var(--yt-spec-text-primary,#fff)!important;background:var(--yt-spec-10-percent-layer,#ffffff1a)!important; }';
      sheet.textContent += `
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
      root.append(sheet);
    }
  }

  function update() {
    const key = playlistKey();
    const shelf = key && deepFind(document, "ytmusic-playlist-shelf-renderer")[0];
    const aligned = shelf && deepFind(shelf, "ytmusic-side-aligned-item-renderer")[0];
    const end = aligned && deepFind(aligned, "#end-items")[0];
    if (current && (current.key !== key || current.shelf !== shelf || !end || !current.button.isConnected)) {
      current.button.remove();
      current = null;
    }
    if (!end || current) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "yme-playlist-search";
    button.setAttribute("aria-label", "Find in playlist");
    button.title = "Find in playlist";
    button.style.cssText = "display:inline-grid;place-items:center;box-sizing:border-box;width:40px;height:40px;padding:8px;border:0;border-radius:50%;background:transparent;color:var(--yt-spec-text-primary,#fff);cursor:pointer";
    const icon = makeIcon("search");
    icon.style.cssText = "width:24px;height:24px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round";
    button.append(icon);
    button.addEventListener("click", open);
    end.append(button);
    current = { key, shelf, button };
  }

  return {
    refresh() {
      update();
      style();
    },
  };
}
