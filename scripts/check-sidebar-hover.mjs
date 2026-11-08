import assert from "node:assert/strict";
import path from "node:path";
import { chromium } from "playwright";
const root = process.cwd();
const context = await chromium.launchPersistentContext(path.join(root, ".dev/sidebar-hover-profile"), {
  headless: true, channel: "chromium", viewport: { width: 1440, height: 900 },
  userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/158.0.0.0 Safari/537.36",
  args: [`--disable-extensions-except=${root}/dist`, `--load-extension=${root}/dist`],
});
try {
  const worker = context.serviceWorkers()[0] || await context.waitForEvent("serviceworker");
  await worker.evaluate(() => chrome.storage.local.set({ sidebarWidth: 125 }));
  const page = await context.newPage();
  await page.goto("https://music.youtube.com/", { waitUntil: "domcontentloaded", timeout: 60000 });
  const app = page.locator("ytmusic-app"), mini = page.locator("#mini-guide-renderer"), guide = page.locator("#guide-renderer");
  await page.locator("#guide-renderer").waitFor({ state: "attached", timeout: 45000 });
  const toggle = page.locator("ytmusic-nav-bar #guide-button button");
  if (!(await app.evaluate(el => el.hasAttribute("guide-collapsed")))) await toggle.click();
  await mini.waitFor({ state: "visible" });
  await page.mouse.move(700, 350);
  await guide.waitFor({ state: "hidden" });
  const contentPosition = await page.locator("ytmusic-browse-response #content-wrapper").first().evaluate(el => el.getBoundingClientRect().left);
  const label = mini.locator(".title-column").first();
  assert.equal(await label.isVisible(), false, "Collapsed rail must show icons without labels");
  await page.mouse.move(25, 90);
  await page.waitForFunction(() => Math.round(document.querySelector("#mini-guide-renderer").getBoundingClientRect().width) === 300);
  assert.equal(await guide.isVisible(), false, "The separate full guide must remain hidden");
  assert.equal(await label.isVisible(), true, "The same rail must reveal its labels");
  const rect = await mini.boundingBox();
  assert.equal(Math.round(rect.width), 300);
  assert.ok(Math.abs(rect.x) < 1);
  assert.equal(await page.locator("ytmusic-browse-response #content-wrapper").first().evaluate(el => el.getBoundingClientRect().left), contentPosition, "Overlay must not shift page content");
  await page.mouse.move(200, rect.y + 30);
  assert.equal(Math.round((await mini.boundingBox()).width), 300, "Rail stays expanded while the pointer enters it");
  await mini.locator('[data-yme-nav-id="explore"] tp-yt-paper-item').click();
  await page.waitForURL(url => url.pathname === "/explore");
  await page.mouse.move(700, 350);
  await page.waitForFunction(() => Math.round(document.querySelector("#mini-guide-renderer").getBoundingClientRect().width) === 72);
  assert.equal(await label.isVisible(), false);
  await toggle.click();
  await guide.waitFor({ state: "visible" });
  assert.equal(await app.evaluate(el => el.hasAttribute("guide-collapsed")), false);
  await page.setViewportSize({ width: 800, height: 900 });
  await page.mouse.move(700, 350);
  await mini.waitFor({ state: "visible" });
  await page.mouse.move(25, 90);
  await page.waitForFunction(() => Math.round(document.querySelector("#mini-guide-renderer").getBoundingClientRect().width) === 300);
  await page.waitForFunction(() => { const el = document.querySelector("#guide-renderer"); return getComputedStyle(el).visibility === "hidden" || el.getBoundingClientRect().right <= 1; });
  await page.mouse.move(700, 350);
  await page.waitForFunction(() => Math.round(document.querySelector("#mini-guide-renderer").getBoundingClientRect().width) === 72);
  await page.setViewportSize({ width: 500, height: 900 });
  await mini.waitFor({ state: "visible" });
  await page.mouse.move(25, 90);
  await page.waitForFunction(() => Math.round(document.querySelector("#mini-guide-renderer").getBoundingClientRect().width) === 300);
  await page.waitForFunction(() => { const el = document.querySelector("#guide-renderer"); return getComputedStyle(el).visibility === "hidden" || el.getBoundingClientRect().right <= 1; });
  console.log("The same icon rail widens and reveals labels on desktop and small screens without shifting page content.");
} finally { await context.close(); }
