import assert from "node:assert/strict";
import path from "node:path";
import { chromium } from "playwright";
const root = process.cwd();
const context = await chromium.launchPersistentContext(path.join(root, ".dev/player-size-profile"), {
  headless: true, channel: "chromium", viewport: { width: 1440, height: 900 },
  userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/158.0.0.0 Safari/537.36",
  args: ["--mute-audio", `--disable-extensions-except=${root}/dist`, `--load-extension=${root}/dist`],
});
try {
  const worker = context.serviceWorkers()[0] || await context.waitForEvent("serviceworker");
  await worker.evaluate(() => chrome.storage.local.remove("ymeShuffleEnabled"));
  const page = await context.newPage();
  await page.goto("https://music.youtube.com/watch?v=fJ9rUzIMcZQ", { waitUntil: "domcontentloaded", timeout: 60000 });
  const bar = page.locator("ytmusic-player-bar");
  await bar.locator('button[aria-label="Play"], button[aria-label="Pause"]').first().waitFor({ state: "visible", timeout: 60000 });
  await page.waitForFunction(() => document.querySelector("ytmusic-player-bar")?.hasAttribute("shuffle-on"), null, { timeout: 20000 });
  const button = bar.locator("yt-icon-button.shuffle button");
  await button.click();
  await page.waitForFunction(() => !document.querySelector("ytmusic-player-bar")?.hasAttribute("shuffle-on"));
  await page.waitForTimeout(800);
  assert.equal(await bar.getAttribute("shuffle-on"), null);
  assert.equal(await worker.evaluate(async () => (await chrome.storage.local.get("ymeShuffleEnabled")).ymeShuffleEnabled), false);
  await page.reload({ waitUntil: "domcontentloaded" });
  await bar.locator('button[aria-label="Play"], button[aria-label="Pause"]').first().waitFor({ state: "visible", timeout: 60000 });
  await page.waitForTimeout(1500);
  assert.equal(await bar.getAttribute("shuffle-on"), null);
  await button.click();
  await page.waitForFunction(() => document.querySelector("ytmusic-player-bar")?.hasAttribute("shuffle-on"));
  await page.goto("https://music.youtube.com/watch?v=3JZ_D3ELwOQ", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForFunction(() => document.querySelector("ytmusic-player-bar")?.hasAttribute("shuffle-on"), null, { timeout: 30000 });
  assert.equal(await worker.evaluate(async () => (await chrome.storage.local.get("ymeShuffleEnabled")).ymeShuffleEnabled), true);
  console.log("Shuffle defaults on, respects a manual off toggle, and persists across reload and a new track.");
} finally { await context.close(); }
