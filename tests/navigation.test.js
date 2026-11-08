import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { JSDOM } from "jsdom";

const source = await readFile(new URL("../navigation.js", import.meta.url), "utf8");

test("page-world route changes notify content scripts even when guide metadata is unchanged", () => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "https://music.youtube.com/explore", runScripts: "outside-only" });
  try {
    const { window } = dom;
    const frames = [];
    const notifications = [];
    window.requestAnimationFrame = (callback) => { frames.push(callback); return frames.length; };
    window.document.addEventListener("yme-guide-data-ready", () => notifications.push(window.location.pathname));
    window.eval(source);
    const flush = () => frames.splice(0).forEach((callback) => callback());
    flush();
    notifications.length = 0;
    window.history.pushState({}, "", "/library/playlists");flush();
    assert.deepEqual(notifications, ["/library/playlists"]);
    window.history.replaceState({}, "", "/library/songs");flush();
    assert.deepEqual(notifications, ["/library/playlists", "/library/songs"]);
    window.document.dispatchEvent(new window.Event("yt-page-data-updated"));flush();
    assert.equal(notifications.length, 2, "unchanged routes and metadata do not generate an update loop");
  } finally { dom.window.close(); }
});

test("song row publishes its video ID from native playlist data", () => {
  const dom = new JSDOM('<!doctype html><html><body><ytmusic-responsive-list-item-renderer></ytmusic-responsive-list-item-renderer></body></html>', { url: "https://music.youtube.com/playlist?list=PLfixture", runScripts: "outside-only" });
  try {
    const { window } = dom;
    const row = window.document.querySelector("ytmusic-responsive-list-item-renderer");
    row.data = { overlay: { content: { playNavigationEndpoint: { watchEndpoint: { videoId: "abc123XYZ01" } } } } };
    const frames = [];
    window.requestAnimationFrame = (callback) => { frames.push(callback); return frames.length; };
    window.eval(source);
    frames.splice(0).forEach((callback) => callback());
    assert.equal(row.dataset.ymeVideoId, "abc123XYZ01");
    row.data = { playlistItemData: { videoId: "other123456" } };
    window.document.dispatchEvent(new window.Event("yt-page-data-updated"));
    frames.splice(0).forEach((callback) => callback());
    assert.equal(row.dataset.ymeVideoId, "other123456");
  } finally { dom.window.close(); }
});


test("shuffle play uses the collection's native endpoint without opening a menu", () => {
  const dom = new JSDOM('<!doctype html><html><body><ytmusic-app></ytmusic-app><ytmusic-responsive-header-renderer><ytmusic-play-button-renderer></ytmusic-play-button-renderer><ytmusic-menu-renderer></ytmusic-menu-renderer></ytmusic-responsive-header-renderer></body></html>', { url: "https://music.youtube.com/playlist?list=PLfixture", runScripts: "outside-only" });
  try {
    const { window } = dom;
    window.requestAnimationFrame = () => 1;
    const endpoint = { watchPlaylistEndpoint: { playlistId: "PLfixture", params: "native-shuffle" } };
    window.document.querySelector("ytmusic-menu-renderer").data = { items: [{ menuNavigationItemRenderer: { icon: { iconType: "MUSIC_SHUFFLE" }, navigationEndpoint: endpoint } }] };
    let called;
    window.document.querySelector("ytmusic-app").handleNavigationEndpoint = (value) => { called = value; };
    window.eval(source);
    const event = new window.CustomEvent("yme-shuffle-play", { bubbles: true, cancelable: true, composed: true });
    window.document.querySelector("ytmusic-play-button-renderer").dispatchEvent(event);
    assert.equal(called, endpoint);
    assert.equal(event.defaultPrevented, true);
  } finally { dom.window.close(); }
});

test("sidebar playlist play creates a shuffle endpoint without opening a menu", () => {
  const dom = new JSDOM('<!doctype html><html><body><ytmusic-app></ytmusic-app><ytmusic-guide-entry-renderer><ytmusic-play-button-renderer></ytmusic-play-button-renderer></ytmusic-guide-entry-renderer></body></html>', { url: "https://music.youtube.com/", runScripts: "outside-only" });
  try {
    const { window } = dom;
    window.requestAnimationFrame = () => 1;
    const row = window.document.querySelector("ytmusic-guide-entry-renderer");
    row.data = { mouseOverButton: { musicPlayButtonRenderer: { playNavigationEndpoint: { watchPlaylistEndpoint: { playlistId: "LM", params: "wAEB" } } } } };
    let called;
    window.document.querySelector("ytmusic-app").handleNavigationEndpoint = (value) => { called = value; };
    window.eval(source);
    const event = new window.CustomEvent("yme-shuffle-play", { bubbles: true, cancelable: true, composed: true });
    row.querySelector("ytmusic-play-button-renderer").dispatchEvent(event);
    assert.equal(called.watchPlaylistEndpoint.playlistId, "LM");
    assert.equal(called.watchPlaylistEndpoint.params, "wAEB8gECKAE%3D");
    assert.equal(event.defaultPrevented, true);
  } finally { dom.window.close(); }
});


test("song actions invoke native service and navigation endpoints without opening a menu", () => {
  const dom = new JSDOM('<!doctype html><html><body><ytmusic-app></ytmusic-app><ytmusic-responsive-list-item-renderer><ytmusic-menu-renderer><button aria-label="Action menu"></button></ytmusic-menu-renderer><button class="yme-quick-action"></button></ytmusic-responsive-list-item-renderer></body></html>', {url:"https://music.youtube.com/playlist?list=PLfixture",runScripts:"outside-only"});
  try {
    const { window } = dom;
    window.requestAnimationFrame = () => 1;
    const row = window.document.querySelector("ytmusic-responsive-list-item-renderer");
    const queue = { queueAddEndpoint: { queueTarget: { videoId: "abc123" } } };
    const artist = { browseEndpoint: { browseId: "UC123" } };
    const share = { shareEntityEndpoint: { serializedShareEntity: "share" } };
    const modal = { modalEndpoint: { modal: {} } };
    const remove = { playlistEditEndpoint: { actions: [{ action: "ACTION_REMOVE_VIDEO", setVideoId: "fixture" }] } };
    row.querySelector("ytmusic-menu-renderer").data = { items: [
      { menuServiceItemRenderer: { icon: { iconType: "ADD_TO_REMOTE_QUEUE" }, serviceEndpoint: queue } },
      { menuNavigationItemRenderer: { icon: { iconType: "ARTIST" }, navigationEndpoint: artist } },
      { menuNavigationItemRenderer: { icon: { iconType: "SHARE" }, navigationEndpoint: share } },
      { menuNavigationItemRenderer: { icon: { iconType: "ADD_TO_PLAYLIST" }, navigationEndpoint: modal } },
      { menuServiceItemRenderer: { text: { runs: [{ text: "Remove from playlist" }] }, serviceEndpoint: remove } },
    ] };
    const app = window.document.querySelector("ytmusic-app");
    let service, navigation, dialog, opened = 0;
    app.handleModalEndpoint = (endpoint) => { dialog = endpoint; };
    app.handleServiceEndpoint = (endpoint) => { service = endpoint; };
    app.handleNavigationEndpoint = (endpoint) => { navigation = endpoint; };
    row.querySelector('ytmusic-menu-renderer button').addEventListener('click', () => opened++);
    window.eval(source);
    const button = row.querySelector('.yme-quick-action');
    button.dataset.ymeAction = 'queue';
    const action = () => button.dispatchEvent(new window.CustomEvent('yme-row-action', {bubbles:true,composed:true,cancelable:true}));
    assert.equal(action(), false);
    assert.equal(service, queue);
    button.dataset.ymeAction = 'artist';
    assert.equal(action(), false);
    assert.equal(navigation, artist);
    button.dataset.ymeAction = 'share';
    assert.equal(action(), false);
    assert.equal(service, share);
    button.dataset.ymeAction = 'addPlaylist';
    assert.equal(action(), false);
    assert.equal(dialog, modal);
    button.dataset.ymeAction = 'remove';
    assert.equal(action(), false);
    assert.equal(service, remove);
    button.dataset.ymeAction = 'unavailable';
    assert.equal(action(), true, 'unavailable actions must remain unhandled');
    assert.equal(opened, 0);
  } finally { dom.window.close(); }
});
