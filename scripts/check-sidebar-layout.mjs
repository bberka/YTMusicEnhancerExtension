import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

await mkdir(".dev/evidence", { recursive: true });
const root = process.cwd();
const context = await chromium.launchPersistentContext(path.join(root, ".dev/sidebar-layout-profile"), {
  headless: true,
  channel: "chromium",
  userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/158.0.0.0 Safari/537.36",
  viewport: { width: 1440, height: 900 },
  args: ["--mute-audio", `--disable-extensions-except=${root}/dist`, `--load-extension=${root}/dist`],
});
try {
  const worker = context.serviceWorkers()[0] || await context.waitForEvent("serviceworker");
  await worker.evaluate(() => chrome.storage.local.set({ sidebarIcons: true, compactLibrary: false, compactPlaylistSidebar: false }));
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const artwork = "https://i.ytimg.com/vi/YMEfixture/default.jpg";
  await page.route(artwork, (route) => route.fulfill({
    contentType: "image/svg+xml",
    body: '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#315d87"/><path d="M12 48 28 16l12 32 12-20" fill="none" stroke="#fff" stroke-width="5"/></svg>',
  }));
  await page.goto("https://music.youtube.com/", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.locator("#yme-sidebar-shortcuts").waitFor({ state: "attached" });
  if (await page.locator("ytmusic-app").evaluate((node) => node.hasAttribute("guide-collapsed"))) await page.locator("ytmusic-nav-bar #guide-button button").click();
  async function assertActive(id) {
    await page.waitForFunction((id) => ["#guide-renderer", "#mini-guide-renderer"].every((guide) => {
      const host = document.querySelector(guide);
      if (!host) return guide === "#mini-guide-renderer";
      const current = [...host.querySelectorAll('[aria-current="page"]')];
      const selected = current[0];
      const selectedId = selected?.dataset.shortcutId || selected?.closest("[data-yme-nav-id]")?.dataset.ymeNavId;
      return current.length === 1 && selectedId === id
        && [...host.querySelectorAll("[data-yme-nav-id][active]")].every((node) => node.dataset.ymeNavId === id);
    }), id);
  }
  await assertActive("home");
  await page.locator('#guide-renderer [data-yme-nav-id="explore"] tp-yt-paper-item').click();
  await page.waitForURL((url) => url.pathname === "/explore");
  await assertActive("explore");
  const playlistsShortcut = page.locator('#guide-renderer [data-shortcut-id="playlists"]');
  await playlistsShortcut.click();
  await page.waitForURL((url) => url.pathname === "/library/playlists");
  await assertActive("playlists");
  await page.mouse.move(600, 300);
  await playlistsShortcut.evaluate((node) => node.blur());
  const selectedColor = await playlistsShortcut.evaluate((node) => getComputedStyle(node).backgroundColor);
  assert.notEqual(selectedColor, "rgba(0, 0, 0, 0)", "Playlists needs a persistent highlight, not only a focus outline");
  // A late native selection update must not restore Explore's old highlight.
  await page.locator('#guide-renderer [data-yme-nav-id="explore"]').evaluate((node) => node.setAttribute("active", ""));
  await page.waitForFunction(() => !document.querySelector('#guide-renderer [data-yme-nav-id="explore"]').hasAttribute("active"));
  await page.goBack();
  await page.waitForURL((url) => url.pathname === "/explore");
  await assertActive("explore");
  assert.notEqual(await playlistsShortcut.evaluate((node) => getComputedStyle(node).backgroundColor), selectedColor);
  await page.goForward();
  await page.waitForURL((url) => url.pathname === "/library/playlists");
  await assertActive("playlists");
  await page.reload({ waitUntil: "domcontentloaded" });
  await assertActive("playlists");
  await page.locator("ytmusic-nav-bar #guide-button button").click();
  await page.locator('#mini-guide-renderer [data-yme-nav-id="explore"] tp-yt-paper-item').click();
  await page.waitForURL((url) => url.pathname === "/explore");
  await assertActive("explore");
  await page.locator('#mini-guide-renderer [data-shortcut-id="playlists"]').click();
  await page.waitForURL((url) => url.pathname === "/library/playlists");
  await assertActive("playlists");
  await page.locator("ytmusic-nav-bar #guide-button button").click();
  await page.locator('#guide-renderer [data-yme-nav-id="home"] tp-yt-paper-item').click();
  await page.waitForURL((url) => url.pathname === "/");
  await assertActive("home");
  await page.evaluate(({ artwork }) => {
    const section = document.createElement("div");
    section.id = "yme-fixture-playlists";
    const note = document.createElement("p");
    note.textContent = "Playlist layout fixtures";
    note.style.cssText = "font:11px Arial;color:#aaa;margin:8px 16px";
    section.append(note);
    const titles = ["Liked Music", "if it ain't screamin i ain't lifting", "legacy of metal", "GYM PHONK 2023", "New Phonk Songs 2025", "Workout Radio • Phonk", "Gym Motivation - NO PAIN", "Classical for Studying", "Funk'em", "afterglow"];
    titles.forEach((title, index) => {
      const row = document.createElement("ytmusic-guide-entry-renderer");
      row.dataset.layoutFixture = String(index);
      row.data = {
        title: { runs: [{ text: title }] }, subtitle: { runs: [{ text: index ? "Fixture owner" : "Auto playlist" }] },
        navigationEndpoint: { browseEndpoint: { browseId: index === 0 ? "VLLM" : `VLPLLayoutFixture${index}` } },
        ...(index === 0 ? {} : { thumbnail: { thumbnails: [{ url: artwork, width: 64, height: 64 }] } }),
      };
      section.append(row);
    });
    document.querySelector("#guide-renderer #sections").append(section);
  }, { artwork });
  await page.locator('[data-layout-fixture="9"] tp-yt-paper-item').waitFor({ state: "attached" });
  await page.locator("[data-layout-fixture]").evaluateAll((rows) => rows.forEach((row) => {
    row.querySelector(".title").textContent = row.data.title.runs[0].text;
    row.querySelector(".title").removeAttribute("is-empty");
    const subtitle = row.querySelector(".subtitle");
    if (subtitle) { subtitle.textContent = row.data.subtitle.runs[0].text; subtitle.removeAttribute("is-empty"); }
    // Some guide variants size rows from their title/subtitle content rather than fixing a row height.
    if (["1","2"].includes(row.dataset.layoutFixture)) {
      const link=row.querySelector("tp-yt-paper-item");
      for (const node of [row,link]) {
        node.style.setProperty("height","auto","important");
        node.style.setProperty("min-height","0px","important");
      }
      link.style.setProperty("padding-block","8px","important");
    }
  }));
  // Native playlist rows can retain SVG geometry in a hidden .guide-icon.
  await page.locator('[data-layout-fixture="0"]').evaluate((row) => {
    let icon = row.querySelector(".guide-icon");
    if (!icon) { icon = document.createElement("span"); icon.className = "guide-icon"; row.querySelector("tp-yt-paper-item").prepend(icon); }
    icon.style.display = "none";
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    const path = document.createElementNS(svg.namespaceURI, "path");
    path.setAttribute("d", "M3 6h12M3 10h12M3 14h8"); svg.append(path); icon.replaceChildren(svg);
    row.dispatchEvent(new Event("load", { bubbles: true }));
  });
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const likedArtwork="https://www.gstatic.com/youtube/media/ytm/images/pbg/liked-songs-delhi-1200.png";
  await page.waitForFunction((src)=>{
    const image=document.querySelector('[data-layout-fixture="0"] .yme-library-art img');
    return image?.src===src && image.naturalWidth>0;
  },likedArtwork);
  const wide = await page.locator("[data-layout-fixture]").evaluateAll((rows) => rows.map((row) => {
    const art = row.querySelector(".yme-library-art");
    const image = art?.querySelector("img");
    const rect = art?.getBoundingClientRect();
    return { title: row.querySelector(".title")?.textContent, iconVisible: Boolean(rect?.width && rect?.height), imageLoaded: Boolean(image?.naturalWidth), rowWidth: row.getBoundingClientRect().width,
      artworkWidth:rect?.width,artworkHeight:rect?.height,rowHeight:row.getBoundingClientRect().height,artworkRight:rect?.right,titleX:row.querySelector('.title')?.getBoundingClientRect().x };
  }));
  await writeFile(".dev/evidence/sidebar-layout-wide.json", JSON.stringify(wide, null, 2));
  assert.ok(wide.every(row=>row.artworkWidth===40 && row.artworkHeight===40 && row.rowHeight>=40 && row.titleX>=row.artworkRight+8),'Wide artwork must be 40 px and fit without overlapping the text');
  await page.screenshot({ path: ".dev/evidence/sidebar-wide-fixture.png" });
  await page.waitForFunction(() => [...document.querySelectorAll('[data-layout-fixture]:not([data-layout-fixture="0"]) .yme-library-art img')].length === 9
    && [...document.querySelectorAll('[data-layout-fixture]:not([data-layout-fixture="0"]) .yme-library-art img')].every((image) => image.naturalWidth > 0));
  const beforeQuiet=await page.locator("[data-layout-fixture]").evaluateAll(rows=>rows.map(row=>({y:row.getBoundingClientRect().y,height:row.getBoundingClientRect().height})));
  await worker.evaluate(() => chrome.storage.local.set({ compactLibrary: true }));
  await page.waitForFunction(() => getComputedStyle(document.querySelector('[data-layout-fixture="1"] .subtitle')).display === "none");
  const afterQuiet=await page.locator("[data-layout-fixture]").evaluateAll(rows=>rows.map(row=>({y:row.getBoundingClientRect().y,height:row.getBoundingClientRect().height})));
  assert.ok(afterQuiet.every(row => row.height >= 40), "Quiet rows must fit their artwork");
  const quietBounds=await page.locator("[data-layout-fixture]").evaluateAll(rows=>rows.map(row=>{
    const art=row.querySelector('.yme-library-art').getBoundingClientRect();
    const rect=row.getBoundingClientRect();
    const title=row.querySelector(".title").getBoundingClientRect();
    return {top:rect.top,bottom:rect.bottom,artTop:art.top,artBottom:art.bottom,titleCenter:title.top+title.height/2,rowCenter:rect.top+rect.height/2};
  }));
  assert.ok(quietBounds.every((row,index)=>row.artTop>=row.top && row.artBottom<=row.bottom && (!index || row.artTop>=quietBounds[index-1].artBottom)),"Quiet artwork must stay inside its own row and never overlap neighboring entries");
  assert.ok(quietBounds.every(row => Math.abs(row.titleCenter - (row.artTop + row.artBottom) / 2) < 2), "Quiet playlist titles must be vertically centered");
  assert.equal(await page.locator("[data-layout-fixture] .yme-library-art").count(), 10);
  assert.equal(await page.locator('[data-layout-fixture="1"] .subtitle').isVisible(), false);
  await page.screenshot({ path: ".dev/evidence/sidebar-wide-quiet-fixture.png" });
  await worker.evaluate(() => chrome.storage.local.set({ compactLibrary: false }));
  await page.waitForFunction(() => getComputedStyle(document.querySelector('[data-layout-fixture="1"] .subtitle')).display !== "none");
  await worker.evaluate(() => chrome.storage.local.set({ compactPlaylistSidebar: true }));
  await page.waitForFunction(() => document.querySelector('[data-layout-fixture="0"] .yme-library-art')?.style.width === "32px");
  const compact = await page.locator("[data-layout-fixture]").evaluateAll(rows => rows.map(row => {
    const box = row.getBoundingClientRect(), art = row.querySelector(".yme-library-art").getBoundingClientRect();
    const title = row.querySelector(".title").getBoundingClientRect(), subtitle = row.querySelector(".subtitle").getBoundingClientRect();
    return { top: box.top, bottom: box.bottom, height: box.height, artTop: art.top, artBottom: art.bottom, titleTop: title.top, titleBottom: title.bottom, subtitleTop: subtitle.top, subtitleBottom: subtitle.bottom };
  }));
  assert.ok(compact.every((row, index) => row.height < beforeQuiet[index].height && row.artTop >= row.top && row.artBottom <= row.bottom && row.titleTop >= row.top && row.subtitleBottom <= row.bottom && row.subtitleTop >= row.titleBottom - 1 && (!index || row.top >= compact[index - 1].bottom - 1)), "Compact rows must fit text and artwork without overlap");
  await worker.evaluate(() => chrome.storage.local.set({ compactLibrary: true }));
  await page.waitForFunction(() => getComputedStyle(document.querySelector('[data-layout-fixture="1"] .subtitle')).display === "none");
  assert.equal(await page.locator('[data-layout-fixture="0"]').evaluate(row => row.getBoundingClientRect().height), compact[0].height);
  await worker.evaluate(() => chrome.storage.local.set({ compactPlaylistSidebar: false, compactLibrary: false }));
  await page.waitForFunction(() => document.querySelector('[data-layout-fixture="0"] .yme-library-art')?.style.width === "40px");
  await page.locator("ytmusic-nav-bar #guide-button button").click();
  await page.locator("#yme-rail-playlists").waitFor({ state: "visible" });
  await page.waitForFunction((src)=>{
    const image=document.querySelector('#yme-rail-playlists button[aria-label="Liked Music"] img');
    return image?.src===src && image.naturalWidth>0;
  },likedArtwork);
  const scrollbar = await page.locator("#yme-rail-playlists").evaluate((node) => ({ width: getComputedStyle(node, "::-webkit-scrollbar").width, mode: getComputedStyle(node).scrollbarWidth, gutter: node.offsetWidth - node.clientWidth }));
  assert.equal(scrollbar.width, "3px");
  assert.equal(scrollbar.mode, "auto");
  assert.ok(scrollbar.gutter <= 3, `Scrollbar consumes too much rail width: ${JSON.stringify(scrollbar)}`);
  // Reserve classic scrollbar space too; headless overlay scrollbars otherwise hide clipping bugs.
  await page.locator("#mini-guide-renderer #sections, #yme-rail-playlists").evaluateAll((nodes) => nodes.forEach((node) => {
    if (getComputedStyle(node).overflowY === "auto") node.style.scrollbarGutter = "stable";
  }));
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const narrow = await page.locator("#mini-guide-renderer").evaluate((host) => {
    const sections = host.querySelector("#yme-rail-playlists");
    const bounds = sections.getBoundingClientRect();
    return {
      hostWidth: host.getBoundingClientRect().width,
      viewport: { x: bounds.x, width: sections.clientWidth, height: sections.clientHeight, scrollWidth: sections.scrollWidth, scrollHeight: sections.scrollHeight },
      entries: [...host.querySelectorAll("#yme-sidebar-rail-shortcuts > *, .yme-rail-playlist")].map((node) => {
        const rect = node.getBoundingClientRect();
        const scroller = node.closest("#yme-rail-playlists") || host.querySelector("#sections");
        return { title: node.getAttribute("title") || node.textContent.trim(), x: rect.x, width: rect.width,
          artworkWidth:node.querySelector('.yme-rail-art')?.getBoundingClientRect().width,
          availableX: scroller.getBoundingClientRect().x, availableWidth: scroller.clientWidth };
      }),
    };
  });
  await writeFile(".dev/evidence/sidebar-layout-narrow.json", JSON.stringify(narrow, null, 2));
  await page.screenshot({ path: ".dev/evidence/sidebar-narrow-fixture.png" });
  assert.ok(narrow.viewport.scrollHeight > narrow.viewport.height, "Long playlist rails must scroll vertically");
  assert.ok(narrow.entries.filter(entry=>entry.artworkWidth!==undefined).every(entry=>entry.artworkWidth===40),'Narrow playlist artwork must also be 40 px');
  assert.ok(narrow.viewport.scrollWidth <= narrow.viewport.width, "Rail must not overflow horizontally");
  assert.ok(narrow.entries.every((entry) => entry.x >= entry.availableX && entry.x + entry.width <= entry.availableX + entry.availableWidth + 1), "Native and added entries must fit within the rail, excluding scrollbar space");
  const homeBefore = await page.locator('#mini-guide-renderer [data-yme-nav-id="home"]').boundingBox();
  await page.locator("#yme-rail-playlists button").last().scrollIntoViewIfNeeded();
  const homeAfter = await page.locator('#mini-guide-renderer [data-yme-nav-id="home"]').boundingBox();
  assert.equal(homeBefore.y, homeAfter.y, "Scrolling playlists must not displace top navigation");
  assert.ok(wide.every((row) => row.iconVisible), "Every wide playlist row needs a visible leading artwork/fallback slot");
  assert.equal(await page.locator("#yme-rail-playlists button").count(), 10);
  const normalRailHeight = await page.locator("#yme-rail-playlists button").first().evaluate(node => node.getBoundingClientRect().height);
  await worker.evaluate(() => chrome.storage.local.set({ compactPlaylistSidebar: true }));
  await page.waitForFunction(() => document.querySelector("#yme-rail-playlists .yme-rail-art")?.style.width === "32px");
  assert.ok(await page.locator("#yme-rail-playlists button").first().evaluate(node => node.getBoundingClientRect().height) < normalRailHeight);
  await worker.evaluate(() => chrome.storage.local.set({ compactPlaylistSidebar: false }));
  await page.waitForFunction(() => document.querySelector("#yme-rail-playlists .yme-rail-art")?.style.width === "40px");
  await page.mouse.move(700, 350);
  const rail = page.locator("#yme-rail-playlists");
  await rail.evaluate(node => { node.scrollTop = 50; });
  const beforeExpand = await rail.evaluate(node => node.scrollTop);
  const dimensions = () => page.evaluate(() => {
    const rect = selector => { const r = document.querySelector(selector).getBoundingClientRect(); return { top: r.top, height: r.height, width: r.width }; };
    return { nav: rect('#mini-guide-renderer [data-yme-nav-id="home"] tp-yt-paper-item'),
      icon: rect('#mini-guide-renderer [data-yme-nav-id="home"] .guide-icon'),
      art: rect('#yme-rail-playlists .yme-rail-art'), rail: rect('#mini-guide') };
  });
  const beforeSizes = await dimensions();
  await page.mouse.move(25, 400);
  await page.waitForFunction(() => document.querySelector("ytmusic-app")?.classList.contains("yme-hover-guide"));
  assert.equal(await rail.evaluate(node => node.scrollTop), beforeExpand, "Expanding must retain the playlist scroll position");
  const afterSizes = await dimensions();
  assert.equal(afterSizes.nav.top, beforeSizes.nav.top, "Navigation rows must not move when expanding");
  assert.equal(afterSizes.nav.height, beforeSizes.nav.height, "Navigation rows must keep their height when expanding");
  assert.equal(afterSizes.icon.width, beforeSizes.icon.width);
  assert.equal(afterSizes.icon.height, beforeSizes.icon.height);
  assert.ok(Math.abs(afterSizes.icon.top - beforeSizes.icon.top) <= 1, "Navigation icons must stay vertically aligned");
  assert.deepEqual(afterSizes.art, beforeSizes.art, "Playlist artwork size and vertical position must stay fixed");
  assert.equal(beforeSizes.rail.top, 64, "The rail background must start below the top navigation");
  const hovered = page.locator("#yme-rail-playlists button").nth(2);
  await hovered.scrollIntoViewIfNeeded();
  await page.mouse.move(700, 350);
  const normalColor = await hovered.evaluate(node => getComputedStyle(node).backgroundColor);
  const box = await hovered.boundingBox();
  await page.mouse.move(25, box.y + box.height / 2);
  await page.waitForFunction(() => document.querySelector("ytmusic-app")?.classList.contains("yme-hover-guide"));
  const expandedBox = await hovered.boundingBox();
  await page.mouse.move(100, expandedBox.y + expandedBox.height / 2);
  await page.waitForFunction(({ index, color }) => getComputedStyle(document.querySelectorAll("#yme-rail-playlists button")[index]).backgroundColor !== color, { index: 2, color: normalColor });
  assert.equal(await page.locator("#yme-rail-playlists .yme-rail-label").first().isVisible(), true);
  await page.mouse.move(700, 350);
  for (const sidebarIcons of [false, true]) {
    await worker.evaluate((sidebarIcons) => chrome.storage.local.set({ sidebarIcons }), sidebarIcons);
    await page.waitForFunction((sidebarIcons) => document.querySelectorAll("[data-layout-fixture] .yme-library-art").length === (sidebarIcons ? 10 : 0), sidebarIcons);
    assert.equal(await page.locator("#yme-rail-playlists .yme-rail-art").count(), 10);
    assert.equal(await page.locator('[data-layout-fixture] .yme-library-art').count(), sidebarIcons ? 10 : 0);
    assert.equal(await page.locator("#mini-guide-renderer .yme-sidebar-shortcut svg").count(), 1);
  }
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ activeState: { nativeAndCustom: true, wideAndNarrow: true, staleNativeSelection: true, historyBackForward: true, reload: true }, wide, narrow, errors }, null, 2));
} finally { await context.close(); }
