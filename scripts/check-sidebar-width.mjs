import assert from "node:assert/strict";
import path from "node:path";
import { chromium } from "playwright";

const root = process.cwd();
const context = await chromium.launchPersistentContext(path.join(root, ".dev/sidebar-width-profile"), {
  headless: true, channel: "chromium", viewport: { width: 1440, height: 900 },
  userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/158.0.0.0 Safari/537.36",
  args: [`--disable-extensions-except=${root}/dist`, `--load-extension=${root}/dist`],
});
try {
  const worker = context.serviceWorkers()[0] || await context.waitForEvent("serviceworker");
  const options = await context.newPage();
  await options.goto(`chrome-extension://${new URL(worker.url()).hostname}/options.html`);
  const slider = options.locator("#sidebar-width");
  await slider.waitFor();
  await slider.fill("100");
  const page = await context.newPage();
  await page.goto("https://music.youtube.com/", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.locator("#guide-renderer").waitFor({ state: "attached", timeout: 45000 });
  const app = page.locator("ytmusic-app");
  if (await app.evaluate(node => node.hasAttribute("guide-collapsed"))) await page.locator("ytmusic-nav-bar #guide-button button").click();
  await page.locator("#guide-renderer").waitFor({ state: "visible", timeout: 45000 });
  const measure = () => page.evaluate(() => ({
    guide: document.querySelector("#guide-renderer").getBoundingClientRect().width,
    layout: parseFloat(getComputedStyle(document.querySelector("ytmusic-app")).getPropertyValue("--ytmusic-guide-width")),
  }));
  for (const [percent, pixels] of [[75, 180], [150, 360], [100, 240]]) {
    await slider.fill(String(percent));
    await page.waitForFunction(pixels => Math.abs(document.querySelector("#guide-renderer").getBoundingClientRect().width - pixels) < 1 && Math.abs(parseFloat(getComputedStyle(document.querySelector("ytmusic-app")).getPropertyValue("--ytmusic-guide-width")) - pixels) < 1, pixels);
    assert.deepEqual(await measure(), { guide: pixels, layout: pixels });
  }
  await slider.fill("125");
  await page.waitForFunction(() => document.querySelector("#guide-renderer").getBoundingClientRect().width === 300);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.querySelector("#guide-renderer")?.getBoundingClientRect().width === 300, null, {timeout: 45000});
  await page.locator("ytmusic-nav-bar #guide-button button").click();
  await page.waitForFunction(() => document.querySelector("ytmusic-app")?.hasAttribute("guide-collapsed"));
  assert.equal(await app.evaluate(node => parseFloat(getComputedStyle(node).getPropertyValue("--ytmusic-guide-width"))), 72);
  await page.setViewportSize({ width: 800, height: 900 });
  await page.waitForFunction(() => parseFloat(getComputedStyle(document.querySelector("ytmusic-app")).getPropertyValue("--ytmusic-guide-width")) === 72);
  await page.locator("ytmusic-nav-bar #guide-button button").click();
  await page.waitForFunction(() => Math.abs(document.querySelector("#guide-wrapper").getBoundingClientRect().width - 300) < 1);
  console.log("Sidebar width updates from settings, survives reload, and preserves the collapsed rail.");
} finally { await context.close(); }
