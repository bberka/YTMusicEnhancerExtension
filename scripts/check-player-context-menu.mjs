import assert from "node:assert/strict";
import path from "node:path";
import { chromium } from "playwright";

const root = process.cwd();
const context = await chromium.launchPersistentContext(path.join(root, ".dev/player-size-profile"), {
  headless: true,
  channel: "chromium",
  userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/158.0.0.0 Safari/537.36",
  viewport: { width: 1440, height: 900 },
  args: ["--mute-audio", `--disable-extensions-except=${root}/dist`, `--load-extension=${root}/dist`],
});
try {
  const page = await context.newPage();
  await page.goto("https://music.youtube.com/watch?v=fJ9rUzIMcZQ", { waitUntil: "domcontentloaded", timeout: 60000 });
  const bar = page.locator("ytmusic-player-bar");
  const button = bar.locator("ytmusic-menu-renderer button").first();
  await bar.locator('button[aria-label="Play"], button[aria-label="Pause"]').first().waitFor({ state: "visible", timeout: 60000 });
  await button.waitFor({ state: "attached", timeout: 60000 });
  const popup = page.locator("ytmusic-menu-popup-renderer:visible");
  for (let i = 0; i < 2; i++) {
    await bar.click({ button: "right", position: { x: 300, y: 35 } });
    await popup.waitFor({ state: "visible", timeout: 5000 });
    assert.ok(await popup.locator('[role="menuitem"]').count() > 0, "Native song actions should appear");
    const download = popup.locator("ytmusic-menu-service-item-download-renderer");
    if (await download.isVisible()) {
      const height = (await download.boundingBox()).height;
      const other = popup.locator('ytmusic-menu-service-item-renderer[role="menuitem"]').first();
      assert.ok(Math.abs(height - (await other.boundingBox()).height) < 1, "Download should match other menu entries");
    }
    await page.keyboard.press("Escape");
    await popup.waitFor({ state: "hidden" });
  }
  console.log("Player bar right-click opens and reopens the native song action menu.");
} finally {
  await context.close();
}
