import assert from "node:assert/strict";
import path from "node:path";
import { chromium } from "playwright";
const root = process.cwd();
const context = await chromium.launchPersistentContext(path.join(root, ".dev/scrollbar-check-profile"), {
  headless: process.env.YME_HEADED !== "1", channel: "chromium", viewport: { width: 1280, height: 800 },
  userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/158.0.0.0 Safari/537.36",
  args: [`--disable-extensions-except=${root}/dist`, `--load-extension=${root}/dist`],
});
try {
  const page = await context.newPage();
  await page.goto("https://music.youtube.com/", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.locator("#yme-sidebar-shortcuts").waitFor({ state: "attached", timeout: 60000 });
  const carousel = page.locator("ytmusic-carousel-shelf-renderer ytmusic-carousel ul#items").first();
  await carousel.waitFor({ state: "visible", timeout: 30000 });
  await page.waitForFunction(() => { const node = document.querySelector("ytmusic-carousel-shelf-renderer ytmusic-carousel ul#items"); return node && node.scrollWidth > node.clientWidth; });
  const horizontal = await carousel.evaluate(node => {
    const style = getComputedStyle(node), bar = getComputedStyle(node, "::-webkit-scrollbar");
    const button = getComputedStyle(node, "::-webkit-scrollbar-button");
    return { display: bar.display, height: bar.height, gutter: node.offsetHeight - node.clientHeight - parseFloat(style.borderTopWidth) - parseFloat(style.borderBottomWidth), thumb: getComputedStyle(node, "::-webkit-scrollbar-thumb").backgroundColor, button: button.display, overflow: style.overflowX, maxScroll: node.scrollWidth - node.clientWidth };
  });
  assert.notEqual(horizontal.display, "none", `Horizontal carousel scrollbar must be visible: ${JSON.stringify(horizontal)}`);
  assert.equal(horizontal.height, "3px");
  assert.equal(horizontal.gutter, 3, "Horizontal scrollbar should reserve 3px");
  assert.notEqual(horizontal.thumb, "rgba(0, 0, 0, 0)", "Horizontal scrollbar thumb should be visible");
  assert.equal(horizontal.button, "none");
  await carousel.evaluate(node => { node.scrollLeft = 120; });
  assert.ok(await carousel.evaluate(node => node.scrollLeft) > 0, "The carousel must remain horizontally scrollable");
  const results = await page.evaluate(() => {
    const sidebar = document.querySelector("#guide-renderer ytmusic-guide-section-renderer #items");
    const main = document.querySelector('ytmusic-app-layout #content[slot="content"]');
    const measure = node => {
      const fixture = document.createElement("div");
      fixture.style.cssText = "height:3000px;width:1px;pointer-events:none";
      node.append(fixture);
      node.style.setProperty("scrollbar-gutter", "stable", "important");
      const style = getComputedStyle(node), scroll = getComputedStyle(node, "::-webkit-scrollbar"), button = getComputedStyle(node, "::-webkit-scrollbar-button");
      const result = { color: style.scrollbarColor, scrollbar: scroll.width, gutter: node.offsetWidth - node.clientWidth - parseFloat(style.borderLeftWidth) - parseFloat(style.borderRightWidth), button: button.display, buttonHeight: button.height, overflow: node.scrollHeight > node.clientHeight };
      fixture.remove();
      return result;
    };
    return { sidebar: measure(sidebar), main: measure(main) };
  });
  for (const [name, value] of Object.entries(results)) {
    assert.equal(value.color, "auto", `${name}: native scrollbar color must not override the custom track`);
    assert.ok(value.overflow, `${name} must actually overflow`);
    assert.equal(value.scrollbar, "3px", `${name}: scrollbar should be 3px wide`);
    assert.equal(value.gutter, 3, `${name}: actual scrollbar gutter should be 3px`);
    assert.equal(value.button, "none", `${name}: scrollbar arrows must be removed`);
    assert.equal(value.buttonHeight, "0px");
  }
  console.log(JSON.stringify({ ...results, horizontal }));
} finally { await context.close(); }
