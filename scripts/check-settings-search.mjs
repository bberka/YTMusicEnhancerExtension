import assert from "node:assert/strict";
import path from "node:path";
import { chromium } from "playwright";

const root = process.cwd();
const context = await chromium.launchPersistentContext(path.join(root, ".dev/settings-search-profile"), {
  headless: true,
  channel: "chromium",
  args: [`--disable-extensions-except=${root}/dist`, `--load-extension=${root}/dist`],
});
try {
  const worker = context.serviceWorkers()[0] || await context.waitForEvent("serviceworker");
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`chrome-extension://${new URL(worker.url()).hostname}/options.html`);
  const search = page.getByRole("searchbox", { name: "Search settings" });
  await search.waitFor();
  for (const width of [1280, 440]) {
    await page.setViewportSize({ width, height: 900 });
    await search.fill("example");
    const geometry = await search.evaluate(input => {
      const field = input.getBoundingClientRect();
      const main = document.querySelector("main").getBoundingClientRect();
      const style = getComputedStyle(document.querySelector("main"));
      const clear = document.querySelector('[aria-label="Clear search"]').getBoundingClientRect();
      return { field: { left: field.left, right: field.right, top: field.top, bottom: field.bottom }, main: { left: main.left, right: main.right }, paddingLeft: parseFloat(style.paddingLeft), paddingRight: parseFloat(style.paddingRight), clear: { left: clear.left, right: clear.right, top: clear.top, bottom: clear.bottom }, inputType: input.type };
    });
    assert.ok(Math.abs(geometry.field.left - geometry.main.left - geometry.paddingLeft) < 1 && Math.abs(geometry.main.right - geometry.paddingRight - geometry.field.right) < 1, `Search should span the content width: ${JSON.stringify(geometry)}`);
    assert.ok(geometry.clear.left >= geometry.field.left && geometry.clear.right <= geometry.field.right && geometry.clear.top >= geometry.field.top && geometry.clear.bottom <= geometry.field.bottom, "Clear button should stay inside the search field");
    assert.equal(geometry.inputType, "text", "A text input avoids the browser’s duplicate search clear control");
    assert.equal(await page.getByRole("button", { name: "Clear search" }).count(), 1);
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  await search.fill("");

  const checkboxBox = await page.getByRole("checkbox").first().boundingBox();
  assert.equal(checkboxBox.width, 20);
  assert.equal(checkboxBox.height, 20);
  const switchBox = await page.getByRole("switch").first().boundingBox();
  assert.equal(switchBox.width, 40);
  assert.equal(switchBox.height, 24);
  assert.equal(await page.getByText("Layout density", { exact: true }).count(), 0);
  assert.equal(await page.getByText("Comfortable", { exact: true }).count(), 0);
  assert.equal(await page.getByText("Reduce motion", { exact: true }).count(), 0);
  const links = page.getByRole("navigation", { name: "Settings sections" }).getByRole("link");
  const names = ["Appearance", "Playlists", "Navigation", "Player", "Help"];
  assert.deepEqual(await links.allTextContents(), names);
  assert.equal(await links.evaluateAll((nodes) => nodes.every((node) => node.querySelector('svg[aria-hidden="true"]'))), true);
  for (const [query, section, control] of [
    ["REMEMBER volume", "Player", "#remember-volume"],
    ["theme", "Appearance", "#theme-trigger"],
    ["Queue", "Playlists", "#action-queue"],
    ["Downloads", "Navigation", "#shortcut-downloads"],
    ["troubleshooting", "Help", "#help-title"],
  ]) {
    await search.fill(query);
    await page.locator(control).waitFor({ state: "visible" });
    assert.deepEqual(await links.allTextContents(), [section]);
    assert.equal(await page.locator("section").count(), 1);
  }
  await search.fill("remember volume");
  assert.equal(await page.locator("#large-progress").count(), 0);
  const volume = page.locator("#remember-volume");
  const before = await volume.getAttribute("aria-checked");
  await volume.click();
  await page.waitForFunction(async (before) => String((await chrome.storage.local.get("rememberVolume")).rememberVolume) !== before, before);
  await search.press("Escape");
  assert.deepEqual(await links.allTextContents(), names);
  assert.equal(await volume.getAttribute("aria-checked"), String(before !== "true"));
  await volume.click();
  await search.fill("nothing-matches-this-setting");
  assert.equal(await links.count(), 0);
  assert.equal(await page.locator("section").count(), 0);
  assert.equal(await page.getByText("No settings match", { exact: false }).isVisible(), true);
  await page.getByRole("button", { name: "Clear search", exact: true }).click();
  assert.deepEqual(await links.allTextContents(), names);
  await page.setViewportSize({ width: 440, height: 900 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  assert.deepEqual(errors, []);
  console.log("Settings search: five icon links, matching sections and rows, nested actions/shortcuts, editable results, clearing, empty state, and mobile overflow passed.");
} finally {
  await context.close();
}
