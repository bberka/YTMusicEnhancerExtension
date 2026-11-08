import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";

const root = process.cwd();
await mkdir(".dev/evidence", { recursive: true });
const context = await chromium.launchPersistentContext(path.join(root, ".dev/chrome-profile"), {
  headless: true,
  channel: "chromium",
  userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/158.0.0.0 Safari/537.36",
  viewport: { width: 1440, height: 900 },
  args: ["--mute-audio", `--disable-extensions-except=${root}/dist`, `--load-extension=${root}/dist`],
});
try {
  const worker = context.serviceWorkers()[0] || await context.waitForEvent("serviceworker", { timeout: 15000 });
  const extensionId = new URL(worker.url()).hostname;
  const errors = [];
  const options = await context.newPage();
  options.on("pageerror",(error)=>errors.push(error.message));
  await options.goto(`chrome-extension://${extensionId}/options.html`);
  await options.evaluate(() => chrome.storage.local.clear());
  await options.reload();
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("https://music.youtube.com/", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.locator("ytmusic-app").waitFor({ state: "attached", timeout: 30000 }).catch(async (error) => {
    console.log(JSON.stringify({url:page.url(), title:await page.title(), text:(await page.locator('body').innerText()).slice(0,1000)}));
    throw error;
  });
  await page.locator("ytmusic-guide-entry-renderer").first().waitFor({ state: "attached", timeout: 30000 });
  await page.waitForFunction(() => document.documentElement.dataset.ymePrimaryColor, { timeout: 15000 });
  await page.waitForFunction(() => document.querySelector("#yme-sidebar-shortcuts"), { timeout: 15000 });
  if (await page.locator("ytmusic-app").evaluate((node)=>node.hasAttribute("guide-collapsed"))) {
    await page.locator("ytmusic-nav-bar #guide-button button").click();
    await page.waitForFunction(()=>!document.querySelector("ytmusic-app")?.hasAttribute("guide-collapsed"));
  }
  if (process.argv.includes("--inspect-rail")) {
    await page.locator("ytmusic-nav-bar #guide-button button").click();
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    const rail = await page.evaluate(() => ({
      appAttributes:document.querySelector('ytmusic-app').getAttributeNames(),
      renderers:[...document.querySelectorAll('ytmusic-mini-guide-renderer, ytmusic-guide-renderer, ytmusic-pivot-bar-renderer, ytmusic-app-layout')].map((node)=>({html:node.outerHTML.slice(0,60000),visible:!!node.getClientRects().length})),
    }));
    await writeFile(".dev/evidence/rail-dom.json",JSON.stringify(rail,null,2));
    await page.screenshot({path:".dev/evidence/rail-before.png"});
    console.log(JSON.stringify({railFile:".dev/evidence/rail-dom.json",tags:rail.renderers.map(r=>({length:r.html.length,visible:r.visible})),app:rail.appAttributes}));
    process.exitCode=0;
    await context.close();
    process.exit();
  }
  await page.evaluate(() => { window.__docIdentity = "same-document"; });
  await page.locator("#guide-renderer .yme-sidebar-shortcut").filter({ hasText: /^Playlists$/ }).click();
  await page.waitForURL((url) => url.pathname === "/library/playlists");
  assert.equal(await page.evaluate(() => window.__docIdentity), "same-document", "Shortcut must not reload the music app");
  const checks = { shortcutSpaNavigation: true };
  const playlistToggle = options.getByRole("checkbox", { name: "Show Playlists in the sidebar", exact: true });
  await playlistToggle.uncheck();
  await page.locator("#guide-renderer .yme-sidebar-shortcut").filter({hasText:/^Playlists$/}).waitFor({state:"detached"});
  await playlistToggle.check();
  await page.locator("#guide-renderer .yme-sidebar-shortcut").filter({hasText:/^Playlists$/}).waitFor();
  checks.shortcutToggleFromSettings = true;
  for (let i=0;i<3;i++) await options.getByRole("button", {name:"Move Playlists up",exact:true}).click();
  await page.waitForFunction(() => document.querySelector("#yme-sidebar-shortcuts")?.firstElementChild?.textContent === "Playlists");
  checks.shortcutOrderFromSettings = true;
  const homeToggle = options.getByRole("checkbox", {name:"Show Home in the sidebar",exact:true});
  await homeToggle.uncheck();
  await page.waitForFunction(() => document.querySelector('[data-yme-nav-id="home"]')?.style.display === "none");
  await homeToggle.check();
  await page.waitForFunction(() => document.querySelector('[data-yme-nav-id="home"]')?.style.display === "");
  checks.nativeNavigationToggle = true;
  await options.evaluate(() => chrome.storage.local.set({ compactSidebar: true }));
  await page.waitForFunction(() => document.querySelector("ytmusic-guide-entry-renderer tp-yt-paper-item")?.style.height === "36px");
  assert.equal(await page.locator('#guide-renderer [data-yme-nav-id="home"] .guide-icon').evaluate((node)=>getComputedStyle(node).width),'20px');
  assert.equal(await page.locator('#guide-renderer .yme-sidebar-shortcut svg').first().evaluate((node)=>getComputedStyle(node).width),'20px');
  checks.nativeCompactRows = true;
  checks.compactNavigationIcons = true;
  await options.evaluate(() => chrome.storage.local.set({ compactSidebar: false }));
  await page.waitForFunction(() => document.querySelector("ytmusic-guide-entry-renderer tp-yt-paper-item")?.style.height === "");
  assert.equal(await page.locator('#guide-renderer [data-yme-nav-id="home"] .guide-icon').evaluate((node)=>getComputedStyle(node).width),'24px');
  assert.equal(await page.locator('#guide-renderer .yme-sidebar-shortcut svg').first().evaluate((node)=>getComputedStyle(node).width),'24px');
  checks.nativeRowRestoration = true;
  await page.locator("ytmusic-nav-bar #guide-button button").click();
  await page.waitForFunction(()=>document.querySelector('ytmusic-app')?.hasAttribute('guide-collapsed'));
  await page.locator("#mini-guide-renderer .yme-sidebar-shortcut").filter({hasText:/^Playlists$/}).waitFor({state:"visible"});
  await options.evaluate(()=>chrome.storage.local.set({compactSidebar:true}));
  await page.waitForFunction(()=>document.querySelector('#mini-guide-renderer [data-yme-nav-id="home"] .guide-icon')?.style.width==='20px');
  assert.equal(await page.locator('#mini-guide-renderer .yme-sidebar-shortcut svg').first().evaluate((node)=>getComputedStyle(node).width),'20px');
  await options.evaluate(()=>chrome.storage.local.set({compactSidebar:false}));
  await page.waitForFunction(()=>document.querySelector('#mini-guide-renderer [data-yme-nav-id="home"] .guide-icon')?.style.width==='');
  checks.narrowRailKeepsShortcuts = true;
  await page.screenshot({path:".dev/evidence/rail-after.png"});
  // A clearly named fixture verifies private-row mirroring without requiring account access.
  const fixtureTitle="Browser test playlist with an intentionally long name";
  await page.evaluate((title)=>{
    const row=document.createElement('ytmusic-guide-entry-renderer');
    row.dataset.ymeFixture='true';
    row.data={title:{runs:[{text:title}]},subtitle:{runs:[{text:'Fixture owner'}]},navigationEndpoint:{browseEndpoint:{browseId:'VLPLBrowserFixture'}}};
    document.querySelector('#guide-renderer #sections').append(row);
  },fixtureTitle);
  await page.locator('[data-yme-fixture] tp-yt-paper-item').waitFor({state:'attached'});
  await page.locator('[data-yme-fixture] .title').evaluate((node,title)=>{node.textContent=title;},fixtureTitle);
  await page.locator('[data-yme-fixture] tp-yt-paper-item').evaluate((node)=>node.addEventListener('click',(event)=>{
    event.preventDefault();event.stopImmediatePropagation();window.__railFixtureClicked=true;
  },true));
  const mirrored=page.getByRole('button',{name:fixtureTitle,exact:true});
  await mirrored.waitFor({state:'visible',timeout:10000}).catch(async(error)=>{
    console.log(await page.evaluate(()=>({source:document.querySelector('[data-yme-fixture]')?.outerHTML,rail:document.querySelector('#yme-rail-playlists')?.outerHTML})));
    throw error;
  });
  assert.equal(await mirrored.locator('svg').isVisible(),true);
  assert.equal(await mirrored.locator('.yme-rail-label').evaluate((node)=>getComputedStyle(node).textOverflow),'ellipsis');
  await mirrored.click();
  assert.equal(await page.evaluate(()=>window.__railFixtureClicked),true);
  checks.narrowPlaylistMirrorFixture=true;
  // Playlist icons and quiet rows are independent; top shortcuts always retain icons.
  for (const compactLibrary of [false,true]) {
    for (const sidebarIcons of [false,true]) {
      await options.evaluate((settings)=>chrome.storage.local.set(settings),{compactLibrary,sidebarIcons});
      await page.waitForFunction(({sidebarIcons,compactLibrary})=>{
        const source=document.querySelector('[data-yme-fixture]');
        const mirror=document.querySelector('#yme-rail-playlists button');
        const subtitle=source?.querySelector('.subtitle');
        return Boolean(mirror?.querySelector('svg, img'))===sidebarIcons
          && subtitle && (getComputedStyle(subtitle).display === 'none') === compactLibrary;
      },{sidebarIcons,compactLibrary});
      for (const guide of ['#guide-renderer','#mini-guide-renderer']) {
        assert.equal(await page.locator(`${guide} .yme-sidebar-shortcut`).evaluateAll(nodes=>nodes.length>0 && nodes.every(node=>node.querySelector('svg'))),true);
      }
      await page.locator('ytmusic-nav-bar #guide-button button').click();
      await page.waitForFunction(()=>!document.querySelector('ytmusic-app').hasAttribute('guide-collapsed'));
      assert.equal(await page.locator('[data-yme-fixture] .yme-library-art').count(),sidebarIcons?1:0);
      if(sidebarIcons) assert.equal(await page.locator('[data-yme-fixture] .yme-library-art').isVisible(),true);
      await page.locator('ytmusic-nav-bar #guide-button button').click();
      await mirrored.waitFor({state:'visible'});
    }
  }
  checks.playlistIconsIndependentOfQuietMode=true;
  checks.topShortcutIconsAlwaysPresent=true;
  await page.screenshot({path:'.dev/evidence/rail-playlist-fixture.png'});
  await page.locator('[data-yme-fixture]').evaluate((node)=>node.remove());
  await page.locator("ytmusic-nav-bar #guide-button button").click();
  await page.goto("https://music.youtube.com/watch?v=fJ9rUzIMcZQ", {waitUntil:"domcontentloaded",timeout:60000});
  await page.waitForFunction(() => document.querySelector("ytmusic-player-bar")?.style.height === "120px");
  await page.locator("ytmusic-player-bar #play-pause-button").waitFor({state:"visible",timeout:30000});
  const playControl=page.locator("ytmusic-player-bar #play-pause-button button");
  if(await playControl.getAttribute("aria-label")==="Play") await playControl.click();
  await page.waitForFunction(()=>{
    const bar=document.querySelector('ytmusic-player-bar');
    return bar && !bar.hasAttribute('is-advertisement') && bar.querySelector('.title')?.textContent.trim();
  },null,{timeout:90000});
  await page.locator("ytmusic-player-bar").hover();
  await page.locator('ytmusic-player-bar ytmusic-like-button-renderer button[aria-label="Like"]').waitFor({state:"visible",timeout:10000}).catch(async(error)=>{
    const diagnostic=await page.evaluate(()=>({html:document.querySelector('ytmusic-player-bar')?.outerHTML,buttons:[...document.querySelectorAll('ytmusic-player-bar button')].filter(node=>node.getClientRects().length).map(node=>({label:node.getAttribute('aria-label'),class:node.className,parent:node.parentElement.tagName,rect:{width:node.getBoundingClientRect().width,height:node.getBoundingClientRect().height}}))}));
    await writeFile('.dev/evidence/player-dom.json',JSON.stringify(diagnostic,null,2));
    console.log(JSON.stringify(diagnostic.buttons));
    throw error;
  });
  await page.locator("ytmusic-player-bar #progress-bar #progressContainer").waitFor({state:"visible",timeout:30000});
  await page.waitForFunction(() => document.querySelector("ytmusic-player-bar ytmusic-like-button-renderer button")?.style.height === "44px", {timeout:15000}).catch(async(error)=>{
    console.log(await page.evaluate(()=>({like:document.querySelector('ytmusic-player-bar ytmusic-like-button-renderer')?.outerHTML, height:document.querySelector('ytmusic-player-bar')?.style.height, errors:document.body.innerText.slice(-800)})));
    throw error;
  });
  const sizes = await page.evaluate(() => {
    const bar = document.querySelector("ytmusic-player-bar");
    const size = (selector) => {
      const node = [...bar.querySelectorAll(selector)].find((node)=>node.getClientRects().length);
      return node ? { width: getComputedStyle(node).width, height: getComputedStyle(node).height, top:node.getBoundingClientRect().top, display:getComputedStyle(node).display } : null;
    };
    return { bar: {height:getComputedStyle(bar).height}, like: size("ytmusic-like-button-renderer button"),
      play: size('button[aria-label="Play"], button[aria-label="Pause"]'), track: size("#progress-bar #primaryProgress"),
      volume: size("#volume-slider #sliderContainer") };
  });
  assert.equal(sizes.like.height, "44px");
  assert.equal(sizes.play.height, "64px");
  assert.equal(sizes.track.height, "8px");
  checks.largePlayer = sizes;
  assert.equal(await page.locator("#yme-comments-trigger, #yme-comments-drawer").count(),0);
  checks.customCommentsRemoved = true;
  await page.screenshot({path:".dev/evidence/player-large-1440.png"});
  await options.evaluate(() => chrome.storage.local.set({ largeProgress: false }));
  await page.waitForFunction(() => document.querySelector("ytmusic-player-bar")?.style.height === "");
  checks.playerSizeRestoration = true;
  await page.screenshot({path:".dev/evidence/player-native-1440.png"});
  checks.settingsSwitches = [];
  for (const [id,key] of [
    ["quick-actions-enabled","quickActionsEnabled"],
    ["sidebar-icons","sidebarIcons"],["compact-library","compactLibrary"],
    ["large-progress","largeProgress"],["remember-volume","rememberVolume"],
  ]) {
    const control=options.locator(`#${id}`);
    const initial=(await control.getAttribute("aria-checked"))==="true";
    for (const value of [!initial,initial]) {
      await control.click();
      await options.waitForFunction(async({key,value})=>(await chrome.storage.local.get(key))[key]===value,{key,value});
      assert.equal(await control.getAttribute("aria-checked"),String(value));
    }
    checks.settingsSwitches.push(key);
  }
  checks.settingsSelects=[];
  for(const [id,key,label,value] of [["action-color-trigger","actionColor","Blue","blue"],["menu-color-trigger","menuColor","Green","green"]]) {
    await options.locator(`#${id}`).click();
    await options.getByRole("option",{name:label,exact:true}).click();
    await options.waitForFunction(async({key,value})=>(await chrome.storage.local.get(key))[key]===value,{key,value});
    checks.settingsSelects.push(key);
  }
  await options.getByRole("button",{name:"Move Remove from playlist up",exact:true}).click();
  await page.waitForFunction(()=>document.documentElement.dataset.ymeActionColor==="blue" && document.documentElement.dataset.ymeMenuColor==="green");
  await options.waitForFunction(async()=>(await chrome.storage.local.get('quickActions')).quickActions[0]==="remove");
  checks.quickActionOrderFromSettings=true;
  await options.locator("#shortcut-label").fill("Test album");
  await options.locator("#shortcut-path").fill("/browse/MPREb_fixture");
  await options.getByRole("button",{name:"Add",exact:true}).click();
  await page.locator('#guide-renderer .yme-sidebar-shortcut[title="Test album"]').waitFor({state:"attached"});
  if (!await page.locator('ytmusic-app').evaluate((node)=>node.hasAttribute('guide-collapsed'))) await page.locator("ytmusic-nav-bar #guide-button button").click();
  await page.locator('#mini-guide-renderer .yme-sidebar-shortcut[title="Test album"]').waitFor({state:"attached"});
  await options.getByRole("button",{name:"Remove Test album shortcut",exact:true}).click();
  await page.waitForFunction(()=>document.querySelectorAll('.yme-sidebar-shortcut[title="Test album"]').length===0);
  checks.customShortcutAddRemove=true;
  await options.getByRole("checkbox",{name:"Show Downloads in the sidebar",exact:true}).check();
  await page.waitForFunction(()=>document.querySelector('.yme-sidebar-shortcut[title="Downloads"]')?.getAttribute('href')==='/browse/FEmusic_offline');
  checks.downloadsUsesOfflineBrowseUrl = true;
  await options.reload();
  await options.locator("#action-color-trigger").waitFor();
  assert.equal(await options.locator("#action-color-trigger").textContent(),"Blue");
  checks.settingsPersistAfterReload=true;
  checks.optionsViewports = [];
  for (const theme of ["light", "dark"]) {
    await options.locator("#theme-trigger").click();
    await options.getByRole("option", {name:theme === "light" ? "Light" : "Dark",exact:true}).click();
    await options.waitForFunction((value)=>document.documentElement.dataset.theme===value,theme);
    for (const width of [440, 768, 1440, 1920]) {
    await options.setViewportSize({width,height:1000});
    await options.evaluate(()=>window.scrollTo(0,0));
    await options.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await options.locator("#save-status").waitFor();
    const overflow = await options.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
    await options.screenshot({path:`.dev/evidence/options-${theme}-${width}.png`,fullPage:true});
    if (overflow) console.log(await options.evaluate(() => [...document.querySelectorAll('body *')].filter((node)=>node.getBoundingClientRect().right>innerWidth+1).slice(0,20).map((node)=>({tag:node.tagName,class:node.className,right:node.getBoundingClientRect().right,width:node.getBoundingClientRect().width}))));
    assert.equal(overflow,false,`Settings overflow at ${width}px`);
    checks.optionsViewports.push({theme,width});
    }
  }
  await options.locator("#reset-settings").click();
  await options.getByRole("alertdialog").getByRole("button",{name:"Cancel",exact:true}).click();
  assert.equal(await options.locator("#action-color-trigger").textContent(),"Blue");
  await options.locator("#reset-settings").click();
  await options.getByRole("alertdialog").getByRole("button",{name:"Reset settings",exact:true}).click();
  await options.waitForFunction(async()=>{
    const value=await chrome.storage.local.get(["theme","quickActions","rememberVolume"]);
    return value.theme==="system" && value.quickActions[0]==="like" && value.rememberVolume===false;
  });
  checks.resetConfirmation = true;
  await options.locator("#remember-volume").focus();
  await options.keyboard.press("Space");
  await options.waitForFunction(async()=>(await chrome.storage.local.get('rememberVolume')).rememberVolume===true);
  await options.keyboard.press("Space");
  await options.waitForFunction(async()=>(await chrome.storage.local.get('rememberVolume')).rememberVolume===false);
  checks.keyboardSwitchControl=true;
  await writeFile(".dev/evidence/browser-checks.json",JSON.stringify({checks,errors},null,2));
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({checks,errors},null,2));
} finally {
  await context.close();
}
