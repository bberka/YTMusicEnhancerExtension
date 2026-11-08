import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const root = process.cwd();
await mkdir(".dev/evidence", { recursive: true });
const context = await chromium.launchPersistentContext(path.join(root, ".dev/context-menu-profile"), {
  headless: true,
  channel: "chromium",
  userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/158.0.0.0 Safari/537.36",
  viewport: { width: 1440, height: 900 },
  args: ["--mute-audio", `--disable-extensions-except=${root}/dist`, `--load-extension=${root}/dist`],
});
try {
  const page = await context.newPage();
  await page.goto("https://music.youtube.com/explore", { waitUntil: "domcontentloaded", timeout: 60000 });
  const card = page.locator("ytmusic-two-row-item-renderer").first();
  await card.waitFor({ state: "visible", timeout: 30000 });
  await card.hover();
  await card.getByRole("button", { name: "Action menu", exact: true }).click();
  const popup = page.locator("ytmusic-menu-popup-renderer:visible");
  await popup.waitFor({ state: "visible" });
  await popup.locator('[role="menuitem"]').nth(1).evaluate(item => { item.style.minHeight = "48px"; });
  const heights = await popup.locator('[role="menuitem"]').evaluateAll(items => items.map(item => ({ text: item.textContent.trim(), height: item.getBoundingClientRect().height })));
  assert.ok(heights.length > 1 && heights.every(item => Math.abs(item.height - heights[0].height) < 1), `Menu items should have equal heights: ${JSON.stringify(heights)}`);
  const results = [];
  for (const width of [1440, 768, 440, 320]) {
    await page.setViewportSize({ width, height: 900 });
    const label = popup.locator(".text").first();
    await label.evaluate((node) => { node.textContent = "Add to playlist: ThisIsALongPlaylistNameWithoutSpacesThatMustNotForceTheContextMenuToScrollSideways"; });
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const metrics = await popup.evaluate((menu) => {
      const ancestors = [];
      for (let node = menu.parentElement; node && !node.matches("ytmusic-popup-container"); node = node.parentElement) ancestors.push(node);
      return [menu, ...menu.querySelectorAll("*"), ...ancestors].filter((node) => node.getClientRects().length).map((node) => {
        const style = getComputedStyle(node);
        const rect = node.getBoundingClientRect();
        return { tag: node.localName, id: node.id, class: node.className, width: rect.width, height: rect.height, x: rect.x, y: rect.y, clientWidth: node.clientWidth, scrollWidth: node.scrollWidth,
          overflowX: style.overflowX, maxWidth: style.maxWidth, whiteSpace: style.whiteSpace, inlineStyle: node.getAttribute("style") };
      });
    });
    results.push({ width, metrics });
    await writeFile(".dev/evidence/context-menu-checks.json", JSON.stringify(results, null, 2));
    await writeFile(".dev/evidence/context-menu-dom.html", await popup.evaluate((node) => node.outerHTML));
    const horizontalScrollers = metrics.filter((node) => ["auto", "scroll"].includes(node.overflowX) && node.scrollWidth > node.clientWidth + 1);
    assert.deepEqual(horizontalScrollers, [], `Context menu must not scroll horizontally at ${width}px`);
    const spacing=await popup.evaluate((menu)=>[menu,menu.querySelector('tp-yt-paper-listbox')].map((node)=>{
      const style=getComputedStyle(node);
      return {tag:node.localName,paddingTop:style.paddingTop,paddingBottom:style.paddingBottom,marginTop:style.marginTop,marginBottom:style.marginBottom};
    }));
    for(const container of spacing) {
      for(const property of ['paddingTop','paddingBottom','marginTop','marginBottom']) assert.equal(container[property],'0px',`${container.tag} ${property} must not add blank space at the menu edges`);
    }
    const text=await label.evaluate((node)=>{
      const row=node.closest('[role="menuitem"]');
      return {width:node.clientWidth,scrollWidth:node.scrollWidth,height:node.getBoundingClientRect().height,rowHeight:row.getBoundingClientRect().height};
    });
    assert.ok(text.scrollWidth<=text.width+1,'Long menu labels must wrap, not get clipped');
    assert.ok(text.rowHeight>=text.height,'Wrapped labels must not overlap the next menu action');
    const menuBox = await popup.boundingBox();
    if(width===1440) assert.ok(menuBox.width>242,'Menu width should grow beyond the old fixed cap when space allows');
    assert.ok(menuBox.x >= 0 && menuBox.x + menuBox.width <= width + 1, "Context menus must remain inside the viewport");
  }
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Escape");
  await popup.waitFor({ state: "hidden" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await card.hover();
  await card.getByRole("button", { name: "Action menu", exact: true }).click();
  await popup.waitFor({ state: "visible", timeout: 2000 });
  await page.keyboard.press("Escape");
  await popup.waitFor({ state: "hidden" });
  console.log("Context menus: no extra top/bottom padding or margins; long labels fit without horizontal scrolling on desktop and narrow viewports.");
} finally { await context.close(); }
