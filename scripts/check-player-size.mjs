import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const root = process.cwd();
await mkdir(".dev/evidence", { recursive: true });
const context = await chromium.launchPersistentContext(path.join(root, ".dev/player-size-profile"), {
  headless: true,
  channel: "chromium",
  userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/158.0.0.0 Safari/537.36",
  viewport: { width: 1440, height: 900 },
  args: ["--mute-audio", `--disable-extensions-except=${root}/dist`, `--load-extension=${root}/dist`],
});
try {
  const worker = context.serviceWorkers()[0] || await context.waitForEvent("serviceworker");
  const options = await context.newPage();
  await options.goto(`chrome-extension://${new URL(worker.url()).hostname}/options.html`);
  await options.locator("#player-position").click();
  await options.getByRole("option", { name: "Bottom", exact: true }).click();
  const toggle = options.locator("#large-progress");
  await toggle.waitFor();
  if (await toggle.getAttribute("aria-checked") === "true") await toggle.click();
  await options.waitForFunction(async () => (await chrome.storage.local.get("largeProgress")).largeProgress === false);
  const page = await context.newPage();
  await page.goto("https://music.youtube.com/watch?v=fJ9rUzIMcZQ", { waitUntil: "domcontentloaded", timeout: 60000 });
  const play = page.locator('ytmusic-player-bar button[aria-label="Play"]:visible, ytmusic-player-bar button[aria-label="Pause"]:visible').first();
  await play.waitFor({ state: "visible", timeout: 45000 });
  async function measure() {
    const result = await page.waitForFunction(() => {
      const bar = document.querySelector("ytmusic-player-bar");
      const visible = (selector) => [...bar.querySelectorAll(selector)].find((node) => node.getClientRects().length && getComputedStyle(node).visibility !== "hidden");
      const size = (node) => node ? { width: node.getBoundingClientRect().width, height: node.getBoundingClientRect().height } : null;
      const play = visible('button[aria-label="Play"], button[aria-label="Pause"]');
      if (!play) return null;
      return {
        bar: size(bar), background: size(document.querySelector("ytmusic-app-layout #player-bar-background")), play: size(play),
        playIcon: size(play?.querySelector("yt-icon, .ytSpecButtonShapeNextIcon, .ytIconWrapperHost")),
        artwork: size(visible(".thumbnail-image-wrapper")),
        like: size(visible('button[aria-label="Like"]')),
        seek: size(visible("#progress-bar #primaryProgress")),
        volume: size(visible("#volume-slider #sliderContainer")),
      };
    });
    return result.jsonValue();
  }
  const native = await measure();
  await toggle.click();
  await page.waitForFunction(() => document.querySelector("ytmusic-player-bar")?.style.height === "120px");
  await page.waitForFunction(() => { const bg = document.querySelector("ytmusic-app-layout #player-bar-background"); const bar = document.querySelector("ytmusic-player-bar"); return bg && bar && bg.getBoundingClientRect().height >= bar.getBoundingClientRect().height - 1; }, null, {timeout: 2000});
  const large = await measure();
  await writeFile(".dev/evidence/player-size-checks.json", JSON.stringify({ native, large }, null, 2));
  assert.equal(large.bar.height, 120);
  assert.ok(large.background && large.background.height >= large.bar.height - 1, "The player background must cover the enlarged bar");
  assert.equal(large.play.width, 64);
  assert.equal(large.play.height, 64);
  assert.equal(large.playIcon.width, 48);
  assert.equal(large.playIcon.height, 48);
  assert.ok(large.bar.height > native.bar.height);
  assert.ok(large.play.width > native.play.width);
  if (native.artwork) assert.equal(large.artwork.width, 56);
  if (native.seek && large.seek) assert.equal(large.seek.height, 8);
  if (native.volume && large.volume) assert.equal(large.volume.height, native.volume.height, "The volume slider height must stay unchanged");
  await options.locator("#player-position").click();
  await options.getByRole("option", { name: "Top", exact: true }).click();
  await page.waitForFunction(() => {
    const bar = document.querySelector("ytmusic-player-bar")?.getBoundingClientRect();
    const nav = document.querySelector("ytmusic-nav-bar")?.getBoundingClientRect();
    const player = document.querySelector("ytmusic-player-page")?.getBoundingClientRect();
    return bar && nav && player && Math.abs(bar.top - nav.bottom) < 1 && player.top >= bar.bottom - 1;
  });
  // The seek control can be hidden during an ad; wait for normal playback.
  await page.waitForFunction(() => {
    const seek = document.querySelector("ytmusic-player-bar #progress-bar");
    return seek && getComputedStyle(seek).display !== "none" && seek.getBoundingClientRect().width > 0;
  }, null, { timeout: 60000 });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => {
    const bar = document.querySelector("ytmusic-player-bar")?.getBoundingClientRect();
    const player = document.querySelector("ytmusic-player-page")?.getBoundingClientRect();
    return document.documentElement.dataset.ymePlayerPosition === "top" && bar?.height === 120 && player && player.top >= bar.bottom - 1;
  }, null, { timeout: 45000 });
  await page.waitForFunction(() => {
    const seek = document.querySelector("ytmusic-player-bar #progress-bar");
    return seek && getComputedStyle(seek).display !== "none" && seek.getBoundingClientRect().width > 0;
  }, null, { timeout: 60000 });
  const seekLayout = await page.evaluate(() => {
    const bar = document.querySelector("ytmusic-player-bar").getBoundingClientRect();
    const track = document.querySelector("ytmusic-player-bar #progress-bar #primaryProgress").getBoundingClientRect();
    const seek = document.querySelector("ytmusic-player-bar #progress-bar");
    const hit = document.elementFromPoint(innerWidth / 2, track.top + track.height / 2);
    return { barBottom: bar.bottom, trackCenter: track.top + track.height / 2, clickable: seek.contains(hit) };
  });
  assert.ok(Math.abs(seekLayout.trackCenter - seekLayout.barBottom) <= 10, `Seek track should sit at the bottom edge of the top player: ${JSON.stringify(seekLayout)}`);
  assert.ok(seekLayout.clickable, `Seek track should be clickable: ${JSON.stringify(seekLayout)}`);
  const topLayout = await page.evaluate(() => {
    const rect = selector => { const r = document.querySelector(selector).getBoundingClientRect(); return { top: r.top, bottom: r.bottom, height: r.height }; };
    return { nav: rect("ytmusic-nav-bar"), bar: rect("ytmusic-player-bar"), player: rect("ytmusic-player-page") };
  });
  assert.ok(topLayout.player.top >= topLayout.bar.bottom - 1, "Player page must start below the top bar");
  const sidebar = await page.locator('#guide-renderer #yme-sidebar-shortcuts').boundingBox();
  if (sidebar) assert.ok(sidebar.y >= topLayout.bar.bottom - 1, "The top bar must not cover sidebar navigation");
  await page.evaluate(() => document.querySelector("ytmusic-app").navigate("FEmusic_home"));
  await page.waitForURL((url) => url.pathname === "/");
  await page.locator("ytmusic-browse-response:not([hidden]) ytmusic-section-list-renderer").first().waitFor({ state: "visible" });
  const browseLayout = await page.evaluate(() => {
    const bar = document.querySelector("ytmusic-player-bar").getBoundingClientRect();
    const content = document.querySelector("ytmusic-browse-response:not([hidden]) ytmusic-section-list-renderer").getBoundingClientRect();
    return { barBottom: bar.bottom, contentTop: content.top };
  });
  assert.ok(browseLayout.contentTop >= browseLayout.barBottom - 1, `The top bar must not cover page content: ${JSON.stringify(browseLayout)}`);
  await page.goBack();
  await page.waitForURL((url) => url.pathname === "/watch");
  await toggle.click();
  await page.waitForFunction(() => document.querySelector("ytmusic-player-bar")?.style.height === "");
  await page.waitForFunction(() => { const bar = document.querySelector("ytmusic-player-bar").getBoundingClientRect(); const nav = document.querySelector("ytmusic-nav-bar").getBoundingClientRect(); const player = document.querySelector("ytmusic-player-page").getBoundingClientRect(); return Math.abs(bar.top - nav.bottom) < 1 && player.top >= bar.bottom - 1; });
  const normalSeek = await page.evaluate(() => {
    const bar = document.querySelector("ytmusic-player-bar").getBoundingClientRect();
    const track = document.querySelector("ytmusic-player-bar #progress-bar #primaryProgress").getBoundingClientRect();
    return { barBottom: bar.bottom, trackCenter: track.top + track.height / 2 };
  });
  assert.ok(Math.abs(normalSeek.trackCenter - normalSeek.barBottom) <= 10, `Normal seek track should sit at the bottom edge: ${JSON.stringify(normalSeek)}`);
  await options.locator("#player-position").click();
  await options.getByRole("option", { name: "Bottom", exact: true }).click();
  await page.waitForFunction(() => Math.abs(document.querySelector("ytmusic-player-bar").getBoundingClientRect().bottom - innerHeight) < 1);
  const restored = await measure();
  assert.deepEqual(restored.play, native.play);
  assert.deepEqual(restored.bar, native.bar);
  await writeFile(".dev/evidence/player-size-checks.json", JSON.stringify({ native, large, restored }, null, 2));
  console.log(JSON.stringify({ native, large, restored }, null, 2));
} finally {
  await context.close();
}
