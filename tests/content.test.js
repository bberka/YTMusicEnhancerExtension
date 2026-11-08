import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { JSDOM } from "jsdom";

const sidebar = await readFile(new URL("../sidebar.js", import.meta.url), "utf8");
const explore = await readFile(new URL("../explore-cache.js", import.meta.url), "utf8");
const playerSize = await readFile(new URL("../player-size.js", import.meta.url), "utf8");
const libraryView = await readFile(new URL("../library-view.js", import.meta.url), "utf8");
const extensionApiModule = await readFile(new URL("../extension-api.js", import.meta.url), "utf8");
const contentUtils = await readFile(new URL("../content-utils.js", import.meta.url), "utf8");
const notice = await readFile(new URL("../notice.js", import.meta.url), "utf8");
const volume = await readFile(new URL("../volume.js", import.meta.url), "utf8");
const shuffle = await readFile(new URL("../shuffle.js", import.meta.url), "utf8");
const playlistSearch = await readFile(new URL("../playlist-search.js", import.meta.url), "utf8");
const libraryArtwork = await readFile(new URL("../library-artwork.js", import.meta.url), "utf8");
const quickActions = await readFile(new URL("../quick-actions.js", import.meta.url), "utf8");
const hoverGuide = await readFile(new URL("../hover-guide.js", import.meta.url), "utf8");
const settingsModule = await readFile(new URL("../src/settings.js", import.meta.url), "utf8");
const content = await readFile(new URL("../content.js", import.meta.url), "utf8");
const source = [extensionApiModule, contentUtils, notice, volume, shuffle, playlistSearch, libraryArtwork, quickActions, hoverGuide, settingsModule, sidebar, explore, playerSize, libraryView]
  .map((text) => text.replace(/^import .*;\n/gm, "").replace(/^export (function|const|let|class) /gm, "$1 "))
  .join("\n") + content.replace(/^import .*;\n/gm, "");

async function sidebarFixture(stored = {}, { now } = {}) {
  const dom = new JSDOM(`<!doctype html><html lang="en"><head></head><body>
    <ytmusic-guide-renderer><div id="nav">
      <ytmusic-guide-entry-renderer><a href="/">Home</a></ytmusic-guide-entry-renderer>
      <ytmusic-guide-entry-renderer><a href="/explore">Explore</a></ytmusic-guide-entry-renderer>
      <ytmusic-guide-entry-renderer><a href="/library">Library</a></ytmusic-guide-entry-renderer>
    </div><ytmusic-guide-library-entry-renderer></ytmusic-guide-library-entry-renderer></ytmusic-guide-renderer>
    </body></html>`, { url: "https://music.youtube.com/", runScripts: "outside-only" });
  const { window } = dom;
  if (!window.structuredClone) window.structuredClone = globalThis.structuredClone;
  if (now !== undefined) window.Date.now = () => now;
  const entry = window.document.querySelector("ytmusic-guide-library-entry-renderer");
  entry.attachShadow({ mode: "open" }).innerHTML = `<a id="endpoint" href="/playlist?list=PLfixture">
    <div id="text-container"><span class="title">Legacy of metal</span><span class="subtitle">berggatal</span></div></a>`;
  const frames = [];
  const listeners = [];
  window.requestAnimationFrame = (callback) => frames.push(callback);
  window.chrome = {
    storage: {
      local: {
        get: async (defaults) => Array.isArray(defaults) ? Object.fromEntries(defaults.map((key)=>[key,stored[key]]))
          : typeof defaults === "object" ? { ...defaults, ...stored } : { [defaults]: stored[defaults] },
        set: async (values) => Object.assign(stored, values),
      },
      onChanged: { addListener: (listener) => listeners.push(listener) },
    },
  };
  window.eval(source);
  await new Promise((resolve) => setImmediate(resolve));
  function flush() {
    for (let count = 0; frames.length && count < 10; count++) frames.splice(0).forEach((callback) => callback());
  }
  flush();
  return { dom, window, entry, flush, listeners };
}

test("New playlist button can be hidden and restored without hiding other controls", async () => {
  const fixture = await sidebarFixture({ hideNewPlaylist: false });
  try {
    const host = fixture.window.document.querySelector("ytmusic-guide-renderer");
    const button = fixture.window.document.createElement("button");
    button.id = "new-playlist-button";
    button.style.display = "inline-flex";
    host.append(button);
    await new Promise((resolve) => setImmediate(resolve)); fixture.flush();
    assert.equal(button.style.display, "inline-flex");
    fixture.listeners[0]({ hideNewPlaylist: { newValue: true } }, "local"); fixture.flush();
    assert.equal(button.style.display, "none");
    assert.notEqual(host.querySelector('[data-yme-nav-id="home"]').style.display, "none");
    fixture.listeners[0]({ hideNewPlaylist: { newValue: false } }, "local"); fixture.flush();
    assert.equal(button.style.display, "inline-flex");
  } finally { fixture.dom.window.close(); }
});

test("legacy shortcut settings keep Home and Explore above Library and added shortcuts", async () => {
  const fixture = await sidebarFixture({ sidebarShortcuts: [
    { id: "library", label: "Library", path: "/library", enabled: true, native: true },
    { id: "playlists", label: "Playlists", path: "/library/playlists", enabled: true },
  ] });
  try {
    const rows = [...fixture.window.document.querySelector("#yme-sidebar-shortcuts").children];
    assert.deepEqual(rows.slice(0, 3).map((row) => row.textContent.trim()), ["Home", "Explore", "Library"]);
    assert.equal(rows[3].textContent.trim(), "Playlists");
  } finally { fixture.dom.window.close(); }
});

test("sidebar active state follows navigation instead of stale native selection or focus",async()=>{
  const fixture=await sidebarFixture();
  try {
    const explore=fixture.window.document.querySelector('a[href="/explore"]').parentElement;
    explore.setAttribute("active","");
    explore.querySelector("a").setAttribute("aria-current","true");
    fixture.window.history.pushState({},"","/library/playlists");fixture.flush();
    const playlists=fixture.window.document.querySelector('[data-shortcut-id="playlists"]');
    assert.equal(playlists.getAttribute("aria-current"),"page");
    assert.equal(explore.hasAttribute("active"),false);
    assert.equal(explore.querySelector("a").getAttribute("aria-current"),null);
    fixture.window.history.pushState({},"","/explore");fixture.flush();
    assert.equal(playlists.getAttribute("aria-current"),null);
    assert.equal(explore.hasAttribute("active"),true);
    assert.equal(explore.querySelector("a").getAttribute("aria-current"),"page");
    // YouTube can update its selection after the SPA route event.
    explore.removeAttribute("active");
    await new Promise((resolve)=>setImmediate(resolve));fixture.flush();
    assert.equal(explore.hasAttribute("active"),true);
  } finally {fixture.dom.window.close();}
});

test("sidebar active routes choose the specific destination and handle browse aliases and query IDs",async()=>{
  const fixture=await sidebarFixture({sidebarShortcuts:[
    {id:"downloads",label:"Downloads",path:"/browse/FEmusic_offline",enabled:true},
    {id:"metal",label:"Metal",path:"/playlist?list=PLmetal",enabled:true,custom:true},
  ]});
  try {
    const nav=fixture.window.document.querySelector("#yme-sidebar-shortcuts");
    for(const [path,expected] of [
      ["/", "home"], ["/library/playlists/", "playlists"],
      ["/browse/FEmusic_liked_playlists", "playlists"], ["/library/albums", "library"],
      ["/browse/FEmusic_offline", "downloads"], ["/playlist?list=PLmetal&index=2", "metal"],
      ["/browse/VLPLmetal", "metal"], ["/playlist?list=PLother", null], ["/watch?v=video", null],
    ]) {
      fixture.window.history.pushState({},"",path);fixture.flush();
      const current=[...nav.querySelectorAll('[aria-current="page"]')];
      assert.equal(current.length,expected?1:0,path);
      if(expected) assert.equal(current[0].dataset.shortcutId || current[0].closest("[data-yme-nav-id]")?.dataset.ymeNavId,expected,path);
    }
  } finally {fixture.dom.window.close();}
});

test("playlist rows get a real visible fallback icon inside their shadow root", async () => {
  const fixture = await sidebarFixture();
  try {
    assert.ok(fixture.entry.shadowRoot.querySelector(".yme-library-art svg"), "missing playlist icon");
    assert.equal(fixture.entry.shadowRoot.querySelector(".yme-library-art").style.width,"40px");
    assert.equal(fixture.entry.shadowRoot.querySelector(".yme-library-art").style.height,"40px");
    assert.equal(fixture.entry.shadowRoot.querySelector("a").style.paddingInlineStart,"64px");
  } finally { fixture.dom.window.close(); }
});

test("sidebar accepts YouTube's Liked Music artwork without trusting unrelated gstatic URLs",async()=>{
  const likedArt="https://www.gstatic.com/youtube/media/ytm/images/pbg/liked-songs-delhi-1200.png";
  for(const [url,allowed] of [[likedArt,true],["https://www.gstatic.com/unrelated.png",false],[likedArt.replace("www.gstatic.com","www.gstatic.com.evil.test"),false]]) {
    const fixture=await sidebarFixture();
    try {
      const native=fixture.window.document.createElement("img");native.src=url;
      fixture.entry.shadowRoot.querySelector("a").prepend(native);
      await new Promise((resolve)=>setImmediate(resolve));fixture.flush();
      const shown=fixture.entry.shadowRoot.querySelector(".yme-library-art img");
      assert.equal(shown?.src || null,allowed?likedArt:null,url);
    } finally {fixture.dom.window.close();}
  }
});

test("Liked Music uses its official artwork in wide and narrow sidebars even without native thumbnails",async()=>{
  const fixture=await sidebarFixture();
  try {
    fixture.entry.dataset.ymePlaylistId="LM";
    fixture.entry.shadowRoot.querySelector("a").href="/playlist?list=LM";
    const mini=fixture.window.document.createElement("ytmusic-guide-renderer");
    mini.id="mini-guide-renderer";mini.setAttribute("is-collapsed","");
    mini.innerHTML='<div id="sections"><div><ytmusic-guide-entry-renderer is-primary><a href="/">Home</a></ytmusic-guide-entry-renderer><ytmusic-guide-entry-renderer is-primary><a href="/explore">Explore</a></ytmusic-guide-entry-renderer><ytmusic-guide-entry-renderer is-primary><a href="/library">Library</a></ytmusic-guide-entry-renderer></div></div>';
    fixture.window.document.body.append(mini);
    await new Promise((resolve)=>setImmediate(resolve));fixture.flush();
    const expected="https://www.gstatic.com/youtube/media/ytm/images/pbg/liked-songs-delhi-1200.png";
    assert.equal(fixture.entry.shadowRoot.querySelector(".yme-library-art img")?.src,expected);
    assert.equal(mini.querySelector(".yme-rail-art img")?.src,expected);
  } finally {fixture.dom.window.close();}
});

test("quiet playlist mode hides owner text and restores it when disabled", async () => {
  const fixture = await sidebarFixture({ compactLibrary: true });
  try {
    const root = fixture.entry.shadowRoot;
    assert.equal(root.querySelector(".subtitle").style.display, "none");
    assert.equal(fixture.entry.style.height, "");
    assert.equal(root.querySelector("a").style.height, "");
    assert.equal(root.querySelector("a").style.minHeight, "48px");
    fixture.listeners[0]({ compactLibrary: { newValue: false } }, "local");
    fixture.flush();
    assert.equal(root.querySelector(".subtitle").style.display, "");
  } finally { fixture.dom.window.close(); }
});

test("compact playlist rows are independent of quiet mode and restore original sizing", async () => {
  const fixture = await sidebarFixture({ compactLibrary: false });
  try {
    const root = fixture.entry.shadowRoot;
    const link = root.querySelector("a");
    fixture.listeners[0]({ compactPlaylistSidebar: { newValue: true } }, "local"); fixture.flush();
    assert.equal(link.style.height, "44px");
    assert.equal(root.querySelector(".yme-library-art").style.width, "32px");
    assert.equal(root.querySelector(".subtitle").style.display, "");
    fixture.listeners[0]({ compactLibrary: { newValue: true } }, "local"); fixture.flush();
    assert.equal(link.style.height, "44px");
    assert.equal(root.querySelector(".subtitle").style.display, "none");
    fixture.listeners[0]({ compactPlaylistSidebar: { newValue: false } }, "local"); fixture.flush();
    assert.equal(link.style.height, "");
    assert.equal(root.querySelector(".yme-library-art").style.width, "40px");
    assert.equal(root.querySelector(".subtitle").style.display, "none");
  } finally { fixture.dom.window.close(); }
});

test("a playlist row rendered after startup receives its icon", async () => {
  const fixture = await sidebarFixture();
  try {
    const root = fixture.entry.shadowRoot;
    root.replaceChildren();
    await new Promise((resolve) => setImmediate(resolve));
    fixture.flush();
    root.innerHTML = '<a href="/playlist?list=PLlate"><span class="title">Late playlist</span></a>';
    await new Promise((resolve) => setImmediate(resolve));
    fixture.flush();
    assert.ok(root.querySelector(".yme-library-art svg"));
  } finally { fixture.dom.window.close(); }
});

test("all quick actions including preview render without throwing", async () => {
  const fixture = await sidebarFixture({ quickActions: ["like", "preview", "remove", "queue"] });
  try {
    fixture.window.history.pushState({}, "", "/playlist?list=PLfixture");
    const row = fixture.window.document.createElement("ytmusic-responsive-list-item-renderer");
    row.innerHTML = "<ytmusic-menu-renderer></ytmusic-menu-renderer>";
    fixture.window.document.body.append(row);
    fixture.flush();
    assert.equal(row.querySelectorAll(".yme-quick-action").length, 4);
    assert.equal(row.querySelector(".yme-quick-action").title, "Like");
    for (const button of row.querySelectorAll(".yme-quick-action")) {
      assert.equal(button.textContent, "");
      assert.ok(button.querySelector('svg[aria-hidden="true"] path'));
      assert.ok(button.title);
      assert.ok(button.getAttribute("aria-label"));
    }
    fixture.listeners[0]({quickActions:{newValue:["remove","queue"]}},"local");fixture.flush();
    assert.deepEqual([...row.querySelectorAll(".yme-quick-action")].map(button=>button.title),["Remove","Queue"]);
    fixture.listeners[0]({quickActionsEnabled:{newValue:false}},"local");fixture.flush();
    assert.equal(row.querySelector(".yme-quick-actions"),null);
  } finally { fixture.dom.window.close(); }
});

test("custom like activates the native like control and keeps the menu", async () => {
  const fixture = await sidebarFixture();
  try {
    fixture.window.history.pushState({}, "", "/playlist?list=PLfixture");
    const row = fixture.window.document.createElement("ytmusic-responsive-list-item-renderer");
    row.innerHTML = '<ytmusic-like-button-renderer><button aria-label="Like"></button><button aria-label="Dislike"></button></ytmusic-like-button-renderer><ytmusic-menu-renderer><button aria-label="More options"></button></ytmusic-menu-renderer>';
    fixture.window.document.body.append(row);
    let likes = 0;
    row.querySelector('[aria-label="Like"]').addEventListener("click", () => likes++);
    fixture.flush();
    row.querySelector('[title="Like"]').click();
    assert.equal(likes, 1);
    assert.ok(row.querySelector('ytmusic-menu-renderer [aria-label="More options"]'));
    assert.ok(row.classList.contains("yme-has-actions"));
    fixture.listeners[0]({quickActionsEnabled:{newValue:false}}, "local"); fixture.flush();
    assert.equal(row.classList.contains("yme-has-actions"), false);
  } finally { fixture.dom.window.close(); }
});

test("native ratings disappear for existing action preferences and late-rendered controls", async () => {
  const fixture = await sidebarFixture({ quickActions: ["preview", "remove", "queue", "next"] });
  try {
    fixture.window.history.pushState({}, "", "/playlist?list=PLfixture");
    const row = fixture.window.document.createElement("ytmusic-responsive-list-item-renderer");
    row.innerHTML = '<ytmusic-menu-renderer></ytmusic-menu-renderer>';
    fixture.window.document.body.append(row); fixture.flush();
    const rating = fixture.window.document.createElement("ytmusic-like-button-renderer");
    rating.innerHTML = '<button aria-label="Like"></button>';
    row.append(rating);
    await new Promise((resolve) => setImmediate(resolve)); fixture.flush();
    assert.ok(row.classList.contains("yme-has-like"), "native rating must be hidden after it appears");
  } finally { fixture.dom.window.close(); }
});

test("context menu sizing styles mount once in both light and shadow DOM",async()=>{
  const fixture=await sidebarFixture();
  try {
    const menu=fixture.window.document.createElement("ytmusic-menu-popup-renderer");
    const shadow=menu.attachShadow({mode:"open"});
    shadow.innerHTML='<tp-yt-paper-listbox><div role="menuitem"><span class="text">Long menu label</span></div></tp-yt-paper-listbox>';
    fixture.window.document.body.append(menu);
    await new Promise((resolve)=>setImmediate(resolve));fixture.flush();
    const sheet=fixture.window.document.querySelector('style[data-yme-menu-style]');
    assert.ok(sheet);
    assert.match(sheet.textContent,/max-width: calc\(100vw - 24px\)/);
    assert.match(sheet.textContent,/overflow-wrap: anywhere/);
    assert.equal(shadow.querySelectorAll('style[data-yme-menu-style]').length,1);
    fixture.window.dispatchEvent(new fixture.window.Event("yt-page-data-updated"));fixture.flush();
    assert.equal(fixture.window.document.querySelectorAll('style[data-yme-menu-style]').length,1);
    assert.equal(shadow.querySelectorAll('style[data-yme-menu-style]').length,1);
  } finally {fixture.dom.window.close();}
});

test("sidebar updates are idempotent and icon toggles undo owned styles", async () => {
  const fixture = await sidebarFixture();
  try {
    const nav = fixture.window.document.querySelector("#nav");
    let mutations = 0;
    const observer = new fixture.window.MutationObserver((records) => { mutations += records.length; });
    observer.observe(nav, { childList: true, subtree: true });
    fixture.listeners[0]({ compactSidebar: { newValue: false } }, "local");
    fixture.flush();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(mutations, 0);
    fixture.listeners[0]({ sidebarIcons: { newValue: false } }, "local");
    fixture.flush();
    assert.equal(fixture.entry.shadowRoot.querySelector(".yme-library-art"), null);
    assert.equal(fixture.entry.shadowRoot.querySelector("a").style.paddingInlineStart, "");
    observer.disconnect();
  } finally { fixture.dom.window.close(); }
});

test("saved Explore appears while loading and yields to the live page", async () => {
  const now = 1700000000000;
  const fixture = await sidebarFixture({ ymeExploreSnapshot: {
    version: 1, locale: "en", savedAt: now, sections: [
      { title: "New releases", items: [{ title: "Cached album", href: "/browse/MPREcached" }] },
    ],
  } }, { now });
  try {
    const { window } = fixture;
    const page = window.document.createElement("ytmusic-browse-response");
    page.getClientRects = () => [{}];
    window.document.body.append(page);
    window.history.pushState({}, "", "/explore");
    fixture.flush();
    assert.match(page.querySelector("#yme-explore-preview").textContent, /Cached album/);
    page.insertAdjacentHTML("beforeend", `<a href="/charts">Charts</a><ytmusic-carousel-shelf-renderer>
      <h2>New releases</h2><ytmusic-two-row-item-renderer><a href="/browse/MPRElive"><span class="title">Live album</span></a></ytmusic-two-row-item-renderer>
      </ytmusic-carousel-shelf-renderer>`);
    window.dispatchEvent(new window.Event("yt-page-data-updated"));
    fixture.flush();
    assert.equal(page.querySelector("#yme-explore-preview"), null);
    assert.match(page.textContent, /Live album/);
    window.history.pushState({}, "", "/");
    fixture.flush();
    assert.equal(window.document.querySelector("#yme-explore-preview"), null);
  } finally { fixture.dom.window.close(); }
});

test("larger seek bars do not resize volume-slider internals", async () => {
  const fixture = await sidebarFixture();
  try {
    const { window } = fixture;
    const bar = window.document.createElement("ytmusic-player-bar");
    bar.innerHTML = '<tp-yt-paper-slider id="progress-bar"></tp-yt-paper-slider><tp-yt-paper-slider id="volume-slider"></tp-yt-paper-slider>';
    const seek = bar.querySelector("#progress-bar").attachShadow({ mode: "open" });
    seek.innerHTML = '<div id="sliderContainer"></div>';
    const volume = bar.querySelector("#volume-slider").attachShadow({ mode: "open" });
    volume.innerHTML = '<div id="sliderContainer"></div>';
    window.document.body.append(bar);
    window.history.pushState({}, "", "/");
    fixture.flush();
    assert.equal(seek.querySelector("div").style.height, "32px");
    assert.equal(volume.querySelector("div").style.height, "");
    fixture.listeners[0]({ largeProgress: { newValue: false } }, "local");
    fixture.flush();
    assert.equal(seek.querySelector("div").style.height, "");
  } finally { fixture.dom.window.close(); }
});

test("shortcut ordering can place Playlists before native navigation", async () => {
  const fixture = await sidebarFixture({ sidebarOrderVersion: 1, sidebarShortcuts: [
    { id: "playlists", label: "Playlists", path: "/library/playlists", enabled: true },
    { id: "home", label: "Home", path: "/", native: true, enabled: true },
    { id: "explore", label: "Explore", path: "/explore", native: true, enabled: true },
    { id: "library", label: "Library", path: "/library", native: true, enabled: true },
  ] });
  try {
    const host = fixture.window.document.querySelector("#nav");
    const rows = [...host.querySelectorAll("ytmusic-guide-entry-renderer, .yme-sidebar-shortcut")];
    assert.deepEqual(rows.map((row) => row.textContent.trim()), ["Playlists", "Home", "Explore", "Library"]);
  } finally { fixture.dom.window.close(); }
});

test("current paper-item playlist rows receive icons and lose owner subtitles", async () => {
  const fixture = await sidebarFixture();
  try {
    const row = fixture.window.document.createElement("ytmusic-guide-entry-renderer");
    row.innerHTML = '<tp-yt-paper-item role="link"><div class="title-column"><yt-formatted-string class="title">Workout playlist</yt-formatted-string><div class="subtitle-group"><yt-formatted-string class="subtitle">Owner name</yt-formatted-string></div></div></tp-yt-paper-item>';
    fixture.window.document.querySelector("ytmusic-guide-renderer").append(row);
    await new Promise((resolve) => setImmediate(resolve));
    fixture.flush();
    assert.ok(row.querySelector(".yme-library-art svg"));
    assert.equal(row.querySelector(".subtitle").style.display, "none");
    assert.equal(row.querySelector("tp-yt-paper-item").style.height, "");
  } finally { fixture.dom.window.close(); }
});

test("larger player sizes late like buttons without confusing icon-button classes", async () => {
  const fixture = await sidebarFixture();
  try {
    const bar = fixture.window.document.createElement("ytmusic-player-bar");
    bar.innerHTML = '<yt-icon-button id="play-pause-button"><yt-icon></yt-icon></yt-icon-button><ytmusic-like-button-renderer></ytmusic-like-button-renderer>';
    fixture.window.document.body.append(bar);
    await new Promise((resolve) => setImmediate(resolve));
    fixture.flush();
    assert.equal(bar.style.height, "120px");
    bar.querySelector("ytmusic-like-button-renderer").innerHTML = '<yt-button-shape><button class="ytSpecButtonShapeNextIconButton" style="height:36px"><div class="ytSpecButtonShapeNextIcon"></div></button></yt-button-shape>';
    await new Promise((resolve) => setImmediate(resolve));
    fixture.flush();
    assert.equal(bar.querySelector("button").style.height, "44px");
    assert.equal(bar.querySelector(".ytSpecButtonShapeNextIcon").style.height, "28px");
    assert.equal(bar.querySelector("#play-pause-button").style.height, "64px");
    fixture.listeners[0]({largeProgress:{newValue:false}},"local");
    fixture.flush();
    assert.equal(bar.querySelector("button").style.height,"36px");
    assert.equal(bar.style.height, "");
  } finally { fixture.dom.window.close(); }
});

test("narrow rail retains shortcuts and mirrors playlist icons and trimmed labels", async () => {
  const fixture = await sidebarFixture();
  try {
    let clicked = false;
    fixture.entry.shadowRoot.querySelector("a").addEventListener("click",(event)=>{event.preventDefault();clicked=true;});
    const mini = fixture.window.document.createElement("ytmusic-guide-renderer");
    mini.id="mini-guide-renderer";
    mini.setAttribute("is-collapsed","");
    mini.innerHTML='<div id="sections"><div id="items"><ytmusic-guide-entry-renderer is-primary><a href="/">Home</a></ytmusic-guide-entry-renderer><ytmusic-guide-entry-renderer is-primary><a href="/explore">Explore</a></ytmusic-guide-entry-renderer><ytmusic-guide-entry-renderer is-primary><a href="/library">Library</a></ytmusic-guide-entry-renderer></div></div>';
    fixture.window.document.body.append(mini);
    await new Promise((resolve)=>setImmediate(resolve));
    fixture.flush();
    assert.equal(mini.querySelector(".yme-sidebar-shortcut").title,"Playlists");
    const playlist=mini.querySelector(".yme-rail-playlist");
    assert.equal(playlist.title,"Legacy of metal");
    assert.ok(playlist.querySelector("svg"));
    assert.equal(playlist.querySelector(".yme-rail-label").style.textOverflow,"ellipsis");
    assert.equal(playlist.style.width,"100%");
    assert.equal(playlist.querySelector(".yme-rail-art").style.width,"40px");
    assert.equal(playlist.parentElement.parentElement.id,"sections");
    assert.equal(playlist.parentElement.style.overflowY,"auto");
    fixture.entry.dataset.ymeThumbnail="https://i.ytimg.com/vi/fixture/default.jpg";
    fixture.window.document.dispatchEvent(new fixture.window.Event("yme-guide-data-ready"));fixture.flush();
    const slot=mini.querySelector(".yme-rail-art");
    assert.ok(slot.querySelector("img"));
    assert.ok(slot.querySelector("svg"));
    assert.equal(slot.querySelector("img").style.position,"absolute","loading artwork cannot add a second layout row");
    slot.querySelector("img").dispatchEvent(new fixture.window.Event("error"));
    assert.equal(slot.querySelector("img"),null);
    assert.ok(slot.querySelector("svg"),"failed images retain the fallback in the same slot");
    mini.querySelector(".yme-rail-playlist").click();
    assert.equal(clicked,true);
  } finally { fixture.dom.window.close(); }
});

test("larger player enlarges modern play icons and preserves volume space across resize and disable",async()=>{
  const fixture=await sidebarFixture();
  try {
    const bar=fixture.window.document.createElement("ytmusic-player-bar");
    bar.innerHTML='<button aria-label="Play" style="width:52px;height:52px"><yt-icon style="width:40px;height:40px"></yt-icon></button><div id="right-controls" style="width:328px"><tp-yt-paper-slider id="volume-slider"></tp-yt-paper-slider></div>';
    fixture.window.document.body.append(bar);
    await new Promise((resolve)=>setImmediate(resolve));fixture.flush();
    const button=bar.querySelector("button");
    const icon=bar.querySelector("yt-icon");
    const controls=bar.querySelector("#right-controls");
    const volume=bar.querySelector("#volume-slider");
    assert.equal(button.style.width,"64px");
    assert.equal(icon.style.width,"48px");
    assert.equal(volume.style.flexShrink,"0");
    assert.equal(controls.style.width,"max-content");
    fixture.window.innerWidth=600;
    fixture.window.dispatchEvent(new fixture.window.Event("resize"));fixture.flush();
    assert.equal(button.style.width,"56px");
    assert.equal(bar.style.height,"112px");
    assert.equal(icon.style.width,"40px");
    assert.equal(controls.style.width,"328px");
    fixture.listeners[0]({largeProgress:{newValue:false}},"local");fixture.flush();
    assert.equal(button.style.width,"52px");
    assert.equal(icon.style.width,"40px");
    assert.equal(volume.style.flexShrink,"");
  } finally {fixture.dom.window.close();}
});

test("modern voting buttons keep their text width as the like count loads", async () => {
  const fixture=await sidebarFixture();
  try {
    const bar=fixture.window.document.createElement("ytmusic-player-bar");
    bar.innerHTML='<button aria-label="Like" style="width:88px"></button>';
    fixture.window.document.body.append(bar);
    await new Promise((resolve)=>setImmediate(resolve));fixture.flush();
    const button=bar.querySelector("button");
    assert.equal(button.style.width,"44px");
    button.textContent="15K";
    await new Promise((resolve)=>setImmediate(resolve));fixture.flush();
    assert.equal(button.style.width,"88px");
    assert.equal(button.style.height,"44px");
  } finally { fixture.dom.window.close(); }
});

test("compact navigation shrinks native and shortcut icons and restores original sizes",async()=>{
  const fixture=await sidebarFixture();
  try {
    const home=fixture.window.document.querySelector("ytmusic-guide-entry-renderer");
    const icon=fixture.window.document.createElement("yt-icon");
    icon.className="guide-icon";icon.style.cssText="width:24px;height:24px;flex-basis:24px";
    home.prepend(icon);
    fixture.listeners[0]({compactSidebar:{newValue:true}},"local");fixture.flush();
    assert.equal(icon.style.width,"20px");
    assert.equal(icon.style.height,"20px");
    assert.equal(fixture.window.document.querySelector(".yme-sidebar-shortcut svg").style.width,"20px");
    fixture.listeners[0]({compactSidebar:{newValue:false}},"local");fixture.flush();
    assert.equal(icon.style.width,"24px");
    assert.equal(icon.style.height,"24px");
    assert.equal(icon.style.flexBasis,"24px");
    assert.equal(fixture.window.document.querySelector(".yme-sidebar-shortcut svg").style.width,"24px");
  } finally {fixture.dom.window.close();}
});

test("playlist icon preference never removes top shortcut icons",async()=>{
  const fixture=await sidebarFixture({sidebarIcons:false,compactLibrary:false});
  try {
    const shortcut=fixture.window.document.querySelector(".yme-sidebar-shortcut");
    assert.ok(shortcut.querySelector("svg"));
    assert.equal(fixture.entry.shadowRoot.querySelector(".yme-library-art"),null);
    assert.notEqual(fixture.entry.shadowRoot.querySelector(".subtitle").style.display,"none");
    fixture.listeners[0]({sidebarIcons:{newValue:true}},"local");fixture.flush();
    assert.equal(fixture.window.document.querySelector(".yme-sidebar-shortcut"),shortcut);
    assert.ok(fixture.entry.shadowRoot.querySelector(".yme-library-art svg"));
    assert.notEqual(fixture.entry.shadowRoot.querySelector(".subtitle").style.display,"none");
    fixture.listeners[0]({compactLibrary:{newValue:true}},"local");fixture.flush();
    assert.ok(fixture.entry.shadowRoot.querySelector(".yme-library-art svg"));
    assert.equal(fixture.entry.shadowRoot.querySelector(".subtitle").style.display,"none");
  } finally {fixture.dom.window.close();}
});

test("Playlists shortcut keeps its note head separate from the stem",async()=>{
  const fixture=await sidebarFixture();
  try {
    const path=fixture.window.document.querySelector('[data-shortcut-id="playlists"] svg path').getAttribute("d");
    assert.equal((path.match(/M/g)||[]).length,5,"three list lines, a stem, and an independent note head");
    assert.equal(path,fixture.entry.shadowRoot.querySelector(".yme-library-art svg path").getAttribute("d"),"lower playlist fallbacks use the same corrected glyph");
  } finally {fixture.dom.window.close();}
});

test("a playlist's trailing menu icon does not suppress its leading playlist icon",async()=>{
  const fixture=await sidebarFixture();
  try {
    const menu=fixture.window.document.createElement("ytmusic-menu-renderer");
    menu.innerHTML='<yt-icon><svg><path d="M3 3h1v1H3z" /></svg></yt-icon>';
    menu.querySelector("svg").getClientRects=()=>[{}];
    fixture.entry.shadowRoot.querySelector("a").append(menu);
    await new Promise((resolve)=>setImmediate(resolve));fixture.flush();
    assert.ok(fixture.entry.shadowRoot.querySelector(".yme-library-art svg"));
    assert.ok(menu.querySelector("svg"));
  } finally {fixture.dom.window.close();}
});

test("hidden native playlist glyphs cannot suppress wide artwork or fallbacks",async()=>{
  const fixture=await sidebarFixture({compactLibrary:false});
  try {
    const row=fixture.entry;
    const native=fixture.window.document.createElement("span");
    native.className="guide-icon";
    native.style.display="none";
    native.innerHTML='<svg><path d="M3 6h12" /></svg>';
    row.shadowRoot.querySelector("a").prepend(native);
    await new Promise((resolve)=>setImmediate(resolve));fixture.flush();
    assert.ok(row.shadowRoot.querySelector(".yme-library-art svg"));
    row.dataset.ymeThumbnail="https://i.ytimg.com/vi/fixture/default.jpg";
    fixture.window.document.dispatchEvent(new fixture.window.Event("yme-guide-data-ready"));fixture.flush();
    assert.equal(row.shadowRoot.querySelector(".yme-library-art img").src,row.dataset.ymeThumbnail);
    assert.notEqual(row.shadowRoot.querySelector(".subtitle").style.display,"none");
    fixture.listeners[0]({sidebarIcons:{newValue:false}},"local");fixture.flush();
    assert.equal(row.shadowRoot.querySelector(".yme-library-art"),null);
    assert.equal(native.style.display,"none");
  } finally {fixture.dom.window.close();}
});

async function libraryFixture(stored={}) {
  const fixture=await sidebarFixture(stored);
  const page=fixture.window.document.createElement("ytmusic-browse-response");
  page.innerHTML=`<ytmusic-library-header-renderer><div id="sort-position" style="display:flex;flex-direction:column;align-items:flex-end">
    <ytmusic-sort-filter-button-renderer><button>Recent activity</button></ytmusic-sort-filter-button-renderer>
    </div></ytmusic-library-header-renderer>
    <ytmusic-grid-renderer><div id="items" style="display:grid;grid-template-columns:repeat(3,160px)">
      <ytmusic-two-row-item-renderer><div id="container" style="display:block"><div id="thumbnail" style="width:160px;height:160px"></div><div class="details"><a class="title" href="/playlist?list=PLone">One</a><span class="subtitle">Owner</span></div></div></ytmusic-two-row-item-renderer>
      <ytmusic-two-row-item-renderer><div id="container"><div id="thumbnail"></div><div class="details"><a class="title" href="/playlist?list=PLtwo">Two</a></div></div></ytmusic-two-row-item-renderer>
    </div></ytmusic-grid-renderer>`;
  fixture.window.document.body.append(page);
  fixture.window.history.pushState({},"","/library/playlists");
  fixture.flush();
  return {...fixture,page};
}

function selectLibraryView(fixture, view) {
  const selector=fixture.page.querySelector('#yme-library-view-selector');
  assert.ok(selector);
  selector.querySelector('.yme-library-view-dropdown').click();
  selector.querySelector(`[data-view="${view}"]`).click();
}

test("Library view menu matches the sort button and reflects saved selection",async()=>{
  const fixture=await libraryFixture({ymeLibraryView:"list"});
  try {
    const sort=fixture.page.querySelector('ytmusic-sort-filter-button-renderer button');
    sort.style.cssText='height:38px;padding:0 16px;border:1px solid #444;border-radius:20px;background:#222;color:white;font:500 14px Arial';
    fixture.window.dispatchEvent(new fixture.window.Event("yt-page-data-updated"));fixture.flush();
    const selector=fixture.page.querySelector('#yme-library-view-selector');
    const button=selector.querySelector('.yme-library-view-dropdown');
    const menu=selector.querySelector('[role="menu"]');
    assert.equal(button.getAttribute("aria-label"),"Library view");
    assert.equal(button.textContent,"List view");
    assert.equal(selector.querySelector('[data-view="list"]').getAttribute("aria-checked"),"true");
    for(const property of ["height","background-color","color","border-radius","font-size","font-family"]) {
      assert.equal(fixture.window.getComputedStyle(button).getPropertyValue(property),fixture.window.getComputedStyle(sort).getPropertyValue(property),property);
    }
    button.click(); assert.equal(menu.hidden,false);
    menu.dispatchEvent(new fixture.window.KeyboardEvent("keydown",{key:"Escape",bubbles:true}));
    assert.equal(menu.hidden,true); assert.equal(fixture.window.document.activeElement,button);
    selectLibraryView(fixture,"grid");
    assert.equal(button.textContent,"Grid view");
    fixture.listeners[0]({ymeLibraryView:{newValue:"list"}},"local");fixture.flush();
    assert.equal(button.textContent,"List view");
  } finally {fixture.dom.window.close();}
});

test("Library view controls share a horizontal row with the sort control",async()=>{
  const fixture=await libraryFixture();
  try {
    const selector=fixture.page.querySelector("#yme-library-view-selector");
    assert.ok(selector);
    assert.equal(selector.parentElement.style.flexDirection,"row");
    assert.equal(selector.parentElement.querySelector("ytmusic-sort-filter-button-renderer")?.textContent,"Recent activity");
  } finally {fixture.dom.window.close();}
});

test("Library list view changes both grid flow and card structure; grid restores originals",async()=>{
  const fixture=await libraryFixture();
  try {
    selectLibraryView(fixture,"list");
    const items=fixture.page.querySelector("ytmusic-grid-renderer #items");
    assert.equal(items.style.display,"flex");
    assert.equal(items.style.flexDirection,"column");
    assert.equal(fixture.page.querySelector("#container").style.display,"flex");
    assert.equal(fixture.page.querySelector("#thumbnail").style.width,"56px");
    selectLibraryView(fixture,"grid");
    assert.equal(items.style.display,"grid");
    assert.equal(items.style.flexDirection,"");
    assert.equal(fixture.page.querySelector("#container").style.display,"block");
    assert.equal(fixture.page.querySelector("#thumbnail").style.width,"160px");
  } finally {fixture.dom.window.close();}
});

test("Library list menus move outside artwork without replacing native nodes or handlers",async()=>{
  const fixture=await libraryFixture();
  try {
    const card=fixture.page.querySelector("ytmusic-two-row-item-renderer");
    card.innerHTML='<a class="image-wrapper" href="/playlist?list=PLone"><ytmusic-item-thumbnail-overlay-renderer><button class="play">Play</button><ytmusic-menu-renderer class="menu" slot="menu" style="position:absolute;right:8px;top:8px;opacity:0"><button aria-label="Action menu">More</button></ytmusic-menu-renderer><span class="after-menu"></span></ytmusic-item-thumbnail-overlay-renderer></a><div class="details"><span class="title">One</span></div>';
    const menu=card.querySelector("ytmusic-menu-renderer");
    const originalParent=menu.parentNode;
    const originalNext=menu.nextSibling;
    const originalStyle=menu.style.cssText;
    let menuClicks=0;
    let imageClicks=0;
    menu.querySelector("button").addEventListener("click",(event)=>{event.stopPropagation();menuClicks++;});
    card.querySelector(".image-wrapper").addEventListener("click",()=>imageClicks++);
    selectLibraryView(fixture,"list");
    assert.equal(menu.parentNode,card,"the menu must no longer live inside the small image or its link");
    assert.equal(menu.style.position,"static");
    assert.equal(menu.style.opacity,"1");
    assert.equal(card.querySelectorAll("ytmusic-menu-renderer").length,1);
    menu.querySelector("button").click();
    assert.equal(menuClicks,1);
    assert.equal(imageClicks,0);
    selectLibraryView(fixture,"grid");
    assert.equal(menu.parentNode,originalParent);
    assert.equal(menu.nextSibling,originalNext);
    assert.equal(menu.style.cssText,originalStyle);
    selectLibraryView(fixture,"list");
    fixture.window.history.pushState({},"","/");fixture.flush();
    assert.equal(menu.parentNode,originalParent,"leaving Library restores the grid's native menu location");
    assert.equal(menu.style.cssText,originalStyle);
  } finally {fixture.dom.window.close();}
});

test("late-loaded Library menus use the list layout and restore without duplicates",async()=>{
  const fixture=await libraryFixture({ymeLibraryView:"list"});
  try {
    const card=fixture.page.querySelector("ytmusic-two-row-item-renderer");
    const thumbnail=card.querySelector("#thumbnail");
    const menu=fixture.window.document.createElement("ytmusic-menu-renderer");
    menu.innerHTML='<button aria-label="Action menu">More</button>';
    thumbnail.append(menu);
    await new Promise((resolve)=>setImmediate(resolve));fixture.flush();
    assert.equal(menu.parentNode,card);
    fixture.window.dispatchEvent(new fixture.window.Event("yt-page-data-updated"));fixture.flush();
    assert.equal(card.querySelectorAll("ytmusic-menu-renderer").length,1);
    selectLibraryView(fixture,"grid");
    assert.equal(menu.parentNode,thumbnail);
    assert.equal(menu.style.position,"");
    assert.equal(thumbnail.childNodes.length,1,"restoration removes the temporary position marker");
  } finally {fixture.dom.window.close();}
});

test("Library selector uses structural sort markers after sorting or language changes",async()=>{
  const fixture=await libraryFixture();
  try {
    fixture.page.querySelector("ytmusic-sort-filter-button-renderer button").textContent="A to Z";
    fixture.page.querySelector("#yme-library-view-selector")?.remove();
    fixture.window.dispatchEvent(new fixture.window.Event("yt-page-data-updated"));
    fixture.flush();
    assert.ok(fixture.page.querySelector("#yme-library-view-selector"));
  } finally {fixture.dom.window.close();}
});

test("Library layout persists but does not resize cards after navigating Home",async()=>{
  const fixture=await libraryFixture({ymeLibraryView:"list"});
  try {
    assert.equal(fixture.page.querySelector("ytmusic-grid-renderer #items").style.display,"flex");
    fixture.window.history.pushState({},"","/");fixture.flush();
    assert.equal(fixture.page.querySelector("ytmusic-grid-renderer #items").style.display,"grid");
    assert.equal(fixture.page.querySelector("#yme-library-view-selector"),null);
    assert.equal(fixture.window.document.documentElement.dataset.ymeLibraryView,undefined);
  } finally {fixture.dom.window.close();}
});

test("replacing the sort renderer preserves the new native button and only one selector",async()=>{
  const fixture=await libraryFixture();
  try {
    let clicks=0;
    const replacement=fixture.window.document.createElement("ytmusic-sort-filter-button-renderer");
    const button=fixture.window.document.createElement("button");button.textContent="Newest";
    button.addEventListener("click",()=>clicks++);replacement.append(button);
    fixture.page.querySelector("ytmusic-sort-filter-button-renderer").replaceWith(replacement);
    fixture.window.dispatchEvent(new fixture.window.Event("yt-page-data-updated"));fixture.flush();
    assert.equal(replacement.isConnected,true);
    assert.equal(fixture.page.querySelectorAll("#yme-library-view-selector").length,1);
    button.click();assert.equal(clicks,1);
  } finally {fixture.dom.window.close();}
});

test("Library list mode does not change recommendation carousels",async()=>{
  const fixture=await libraryFixture();
  try {
    const carousel=fixture.window.document.createElement("ytmusic-carousel");
    carousel.attachShadow({mode:"open"}).innerHTML='<div id="items"><ytmusic-two-row-item-renderer style="width:160px"><a class="image-wrapper">Recommendation</a></ytmusic-two-row-item-renderer></div>';
    fixture.page.append(carousel);
    selectLibraryView(fixture,"list");
    assert.equal(carousel.shadowRoot.querySelector("ytmusic-two-row-item-renderer").style.width,"160px");
    assert.equal(carousel.shadowRoot.querySelector("#items").style.display,"");
  } finally {fixture.dom.window.close();}
});

test("collection play respects the player shuffle state", async () => {
  const fixture = await sidebarFixture();
  try {
    const { document } = fixture.window;
    const makeCard = (href) => {
      const card = document.createElement("ytmusic-two-row-item-renderer");
      card.innerHTML = `<a href="${href}">Collection</a><button aria-label="Play">Play</button><button aria-label="Shuffle play">Shuffle</button>`;
      document.body.append(card);
      let plays = 0, shuffles = 0;
      card.querySelector('[aria-label="Play"]').addEventListener("click", () => plays++);
      card.querySelector('[aria-label="Shuffle play"]').addEventListener("click", () => shuffles++);
      return { card, counts: () => [plays, shuffles] };
    };
    const playlist = makeCard('/playlist?list=PLfixture');
    const album = makeCard('/browse/MPREfixture');
    playlist.card.querySelector('[aria-label="Play"]').click();
    album.card.querySelector('[aria-label="Play"]').click();
    assert.deepEqual(playlist.counts(), [0, 1]);
    assert.deepEqual(album.counts(), [0, 1]);
    fixture.listeners[0]({ ymeShuffleEnabled: { newValue: false } }, "local");
    playlist.card.querySelector('[aria-label="Play"]').click();
    album.card.querySelector('[aria-label="Play"]').click();
    assert.deepEqual(playlist.counts(), [1, 1]);
    assert.deepEqual(album.counts(), [1, 1]);
  } finally { fixture.dom.window.close(); }
});

test("collection play invokes the page shuffle endpoint without opening the menu", async () => {
  const fixture = await sidebarFixture();
  try {
    const { document } = fixture.window;
    const card = document.createElement("ytmusic-two-row-item-renderer");
    card.innerHTML = `<a href="/playlist?list=PLfixture">Playlist</a><button aria-label="Play">Play</button><ytmusic-menu-renderer><button aria-label="More">More</button></ytmusic-menu-renderer>`;
    document.body.append(card);
    let played = 0, shuffled = 0, menuOpened = 0;
    card.querySelector('[aria-label="Play"]').addEventListener("click", () => played++);
    card.querySelector('[aria-label="More"]').addEventListener("click", () => menuOpened++);
    document.addEventListener("yme-shuffle-play", (event) => { shuffled++; event.preventDefault(); });
    card.querySelector('[aria-label="Play"]').click();
    assert.equal(played, 0);
    assert.equal(shuffled, 1);
    assert.equal(menuOpened, 0);
  } finally { fixture.dom.window.close(); }
});

test("Bigger list view persists and switches cleanly between list sizes and grid", async () => {
  const fixture = await libraryFixture({ ymeLibraryView: "large-list" });
  try {
    const card = fixture.page.querySelector("ytmusic-two-row-item-renderer");
    const image = card.querySelector("#thumbnail");
    const selector = fixture.page.querySelector("#yme-library-view-selector");
    assert.equal(selector.querySelector(".yme-library-view-dropdown").textContent, "Bigger list view");
    assert.equal(selector.querySelector('[data-view="large-list"]').getAttribute("aria-checked"), "true");
    assert.equal(card.style.minHeight, "96px");
    assert.equal(image.style.width, "80px");
    selectLibraryView(fixture, "list");
    assert.equal(card.style.minHeight, "72px");
    assert.equal(image.style.width, "56px");
    selectLibraryView(fixture, "large-list");
    assert.equal(card.style.minHeight, "96px");
    assert.equal((await fixture.window.chrome.storage.local.get("ymeLibraryView")).ymeLibraryView, "large-list");
    selectLibraryView(fixture, "grid");
    assert.equal(card.style.minHeight, "");
    assert.equal(image.style.width, "160px");
  } finally { fixture.dom.window.close(); }
});

test("playlist search icon invokes the playlist header's native find action", async () => {
  const fixture = await sidebarFixture();
  try {
    const { document } = fixture.window;
    const header = document.createElement("ytmusic-responsive-header-renderer");
    header.innerHTML = '<ytmusic-menu-renderer><button aria-label="More options"></button></ytmusic-menu-renderer>';
    document.body.append(header);
    const menu = header.querySelector("ytmusic-menu-renderer");
    menu.getClientRects = () => [{}];
    const shelf = document.createElement("ytmusic-playlist-shelf-renderer");
    shelf.innerHTML = '<ytmusic-side-aligned-item-renderer><div id="start-items"><button>Sort</button></div><div id="end-items"></div></ytmusic-side-aligned-item-renderer><ytmusic-responsive-list-item-renderer>Song</ytmusic-responsive-list-item-renderer>';
    document.body.append(shelf);
    let opened = 0, invoked = 0;
    menu.querySelector("button").addEventListener("click", () => {
      opened++;
      const popup = document.createElement("ytmusic-menu-popup-renderer");
      popup.getClientRects = () => [{}];
      const item = document.createElement("ytmusic-menu-service-item-renderer");
      item.textContent = "Find in playlist";
      item.getClientRects = () => [{}];
      item.addEventListener("click", () => invoked++);
      popup.append(item); document.body.append(popup);
    });
    document.addEventListener("yme-playlist-find", (event) => { invoked++; event.preventDefault(); });
    fixture.window.history.pushState({}, "", "/playlist?list=PLtest"); fixture.flush();
    const button = shelf.querySelector('#end-items button[aria-label="Find in playlist"]');
    assert.ok(button);
    assert.equal(button.textContent, "");
    assert.ok(button.querySelector("svg"));
    assert.equal(shelf.querySelector("#start-items .yme-playlist-search"), null);
    button.click(); fixture.flush();
    assert.equal(opened, 0);
    assert.equal(invoked, 1);
    assert.equal(shelf.querySelector("input"), null);
    assert.equal(shelf.querySelector("ytmusic-responsive-list-item-renderer").style.display, "");
    fixture.window.history.pushState({}, "", "/explore"); fixture.flush();
    assert.equal(button.isConnected, false);
  } finally { fixture.dom.window.close(); }
});

test("hide New playlist handles the current labeled button without a fixed id", async () => {
  const fixture = await sidebarFixture({ hideNewPlaylist: true });
  try {
    const host = fixture.window.document.querySelector("ytmusic-guide-renderer");
    const section = fixture.window.document.createElement("ytmusic-button-renderer");
    section.innerHTML = '<button aria-label="New playlist"><span>New playlist</span></button>';
    host.append(section);
    await new Promise((resolve) => setImmediate(resolve)); fixture.flush();
    assert.equal(section.querySelector("button").style.display, "none");
    fixture.listeners[0]({ hideNewPlaylist: { newValue: false } }, "local"); fixture.flush();
    assert.equal(section.querySelector("button").style.display, "");
  } finally { fixture.dom.window.close(); }
});

test("additional row actions invoke the endpoint without opening the native menu", async () => {
  const fixture = await sidebarFixture({ quickActions: ["addPlaylist", "radio", "artist", "album", "share"] });
  try {
    const { document } = fixture.window;
    fixture.window.history.pushState({}, "", "/playlist?list=PLfixture");
    const row = document.createElement("ytmusic-responsive-list-item-renderer");
    row.innerHTML = '<ytmusic-menu-renderer><button aria-label="More options"></button></ytmusic-menu-renderer>';
    document.body.append(row);
    fixture.flush();
    const nativeMenu = row.querySelector("ytmusic-menu-renderer");
    row.getBoundingClientRect = () => ({ width: 600, left: 0, right: 600 });
    nativeMenu.getBoundingClientRect = () => ({ width: 150, left: 390, right: 540 });
    nativeMenu.querySelector("button").getBoundingClientRect = () => ({ width: 40, left: 500, right: 540 });
    row.dispatchEvent(new fixture.window.Event("pointerenter"));
    assert.equal(row.querySelector(".yme-quick-actions").style.insetInlineEnd, "104px");
    assert.equal(row.querySelector("ytmusic-menu-renderer"), nativeMenu);
    let menuOpened = 0, actionInvoked = 0;
    nativeMenu.querySelector("button").addEventListener("click", () => menuOpened++);
    document.addEventListener("yme-row-action", (event) => { if (event.target.dataset.ymeAction === "addPlaylist") { actionInvoked++; event.preventDefault(); } });
    const buttons = [...row.querySelectorAll(".yme-quick-action")];
    assert.deepEqual(buttons.map((button) => button.title), ["Add to playlist", "Start radio", "Go to artist", "Go to album", "Share"]);
    buttons[0].click(); fixture.flush();
    assert.equal(menuOpened, 0);
    assert.equal(actionInvoked, 1);
    assert.ok(row.querySelector('ytmusic-menu-renderer button[aria-label="More options"]'));
  } finally { fixture.dom.window.close(); }
});

test("hiding New playlist removes the playlist section's top inset and restores it", async () => {
  const fixture = await sidebarFixture({ hideNewPlaylist: false });
  try {
    const { document } = fixture.window;
    const host = document.querySelector("ytmusic-guide-renderer");
    const section = document.createElement("ytmusic-guide-section-renderer");
    section.style.paddingBlockStart = "16px";
    section.innerHTML = '<div id="items" style="padding-block-start: 12px; margin-block-start: 6px"><ytmusic-guide-library-entry-renderer><a href="/playlist?list=PLone">Playlist</a></ytmusic-guide-library-entry-renderer></div>';
    host.append(section);
    await new Promise((resolve) => setImmediate(resolve)); fixture.flush();
    const items = section.querySelector("#items");
    fixture.listeners[0]({ hideNewPlaylist: { newValue: true } }, "local"); fixture.flush();
    assert.equal(section.style.paddingBlockStart, "0px");
    assert.equal(items.style.paddingBlockStart, "0px");
    assert.equal(items.style.marginBlockStart, "0px");
    fixture.listeners[0]({ hideNewPlaylist: { newValue: false } }, "local"); fixture.flush();
    assert.equal(section.style.paddingBlockStart, "16px");
    assert.equal(items.style.paddingBlockStart, "12px");
    assert.equal(items.style.marginBlockStart, "6px");
  } finally { fixture.dom.window.close(); }
});

test("hiding New playlist removes inset from playlist wrappers outside a guide section", async () => {
  const fixture = await sidebarFixture({ hideNewPlaylist: false });
  try {
    const { document } = fixture.window;
    const host = document.querySelector("ytmusic-guide-renderer");
    const wrapper = document.createElement("div");
    wrapper.style.paddingBlockStart = "20px";
    wrapper.innerHTML = '<div class="playlist-items" style="margin-block-start: 12px"><ytmusic-guide-entry-renderer><a href="/playlist?list=PLone">Liked Music</a></ytmusic-guide-entry-renderer></div>';
    host.append(wrapper);
    await new Promise((resolve) => setImmediate(resolve)); fixture.flush();
    const items = wrapper.firstElementChild;
    fixture.listeners[0]({ hideNewPlaylist: { newValue: true } }, "local"); fixture.flush();
    assert.equal(wrapper.style.paddingBlockStart, "0px");
    assert.equal(items.style.marginBlockStart, "0px");
    fixture.listeners[0]({ hideNewPlaylist: { newValue: false } }, "local"); fixture.flush();
    assert.equal(wrapper.style.paddingBlockStart, "20px");
    assert.equal(items.style.marginBlockStart, "12px");
  } finally { fixture.dom.window.close(); }
});

test("right-click anywhere on a playlist song opens its native menu immediately again after dismissal", async () => {
  const fixture = await sidebarFixture({ quickActionsEnabled: false });
  try {
    const { document, MouseEvent } = fixture.window;
    fixture.window.history.pushState({}, "", "/playlist?list=PLfixture");
    const row = document.createElement("ytmusic-responsive-list-item-renderer");
    row.innerHTML = '<div class="thumbnail">Artwork</div><a class="title">Song</a><div class="empty-space"></div><ytmusic-menu-renderer><button aria-label="More options"></button></ytmusic-menu-renderer>';
    document.body.append(row); fixture.flush();
    let opens = 0;
    row.querySelector('ytmusic-menu-renderer button').addEventListener("click", () => opens++);
    for (const target of [row, row.querySelector('.thumbnail'), row.querySelector('.empty-space'), row.querySelector('.title')]) {
      const event = new MouseEvent("contextmenu", { bubbles: true, cancelable: true, button: 2 });
      target.dispatchEvent(event);
      assert.equal(event.defaultPrevented, true);
    }
    assert.equal(opens, 4);
  } finally { fixture.dom.window.close(); }
});

test("side play resolves a track from row metadata without a watch link", async () => {
  const fixture = await sidebarFixture({ quickActions: ["preview"] });
  try {
    const { document } = fixture.window;
    fixture.window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
    fixture.window.history.pushState({}, "", "/playlist?list=PLfixture");
    const row = document.createElement("ytmusic-responsive-list-item-renderer");
    row.dataset.ymeVideoId = "abc123XYZ01";
    row.innerHTML = "<ytmusic-menu-renderer></ytmusic-menu-renderer>";
    document.body.append(row); fixture.flush();
    row.querySelector(".yme-quick-action").click();
    assert.match(document.querySelector("#yme-sideplay iframe").src, /abc123XYZ01/);
  } finally { fixture.dom.window.close(); }
});

