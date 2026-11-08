import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

await mkdir(".dev/evidence", { recursive: true });
const root = process.cwd();
const context = await chromium.launchPersistentContext(path.join(root, ".dev/library-view-profile"), {
  headless: true,
  channel: "chromium",
  userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/158.0.0.0 Safari/537.36",
  viewport: { width: 1440, height: 900 },
  args: ["--mute-audio", `--disable-extensions-except=${root}/dist`, `--load-extension=${root}/dist`],
});

try {
  const worker = context.serviceWorkers()[0] || await context.waitForEvent("serviceworker", {timeout:15000});
  await worker.evaluate(() => chrome.storage.local.set({ymeLibraryView:"grid", shuffleOnOpen:false}));
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("https://music.youtube.com/explore", {waitUntil:"domcontentloaded",timeout:60000});
  await page.locator("ytmusic-two-row-item-renderer").nth(3).waitFor({state:"attached",timeout:30000});
  // Preserve actual native cards, data bindings, and handlers. Only the signed-in Library shell is a fixture.
  await page.evaluate(() => {
    window.__libraryCards = [...document.querySelectorAll("ytmusic-two-row-item-renderer")].slice(0,4);
    window.__outsideStyle = window.__libraryCards[3].style.cssText;
    document.querySelector("ytmusic-app").navigate("FEmusic_liked_playlists");
  });
  await page.waitForURL((url)=>url.pathname==="/library/playlists");
  await page.evaluate(() => {
    const fixture=document.createElement("section");
    fixture.id="library-layout-fixture";
    fixture.style.cssText="position:fixed;inset:88px 24px 100px 250px;z-index:10000;overflow:auto;padding:24px;background:var(--yt-spec-general-background-a,#101010);color:var(--yt-spec-text-primary,#fff);font-family:Roboto,Arial,sans-serif";
    const heading=document.createElement('h1');heading.textContent='Library layout test';heading.style.cssText='font-size:24px;margin:0 0 12px';
    const note=document.createElement('p');note.textContent='Native YouTube Music cards inside a Library test shell; no account data.';note.style.cssText='color:#aaa;font-size:12px';
    const browse=document.createElement('ytmusic-browse-response');
    fixture.append(heading,note,browse);
    document.body.append(fixture);
  });
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  await page.evaluate(()=>{
    const browse=document.querySelector('#library-layout-fixture ytmusic-browse-response');
    browse.hidden=false;browse.style.setProperty('display','block','important');
    const header=document.createElement('header');
    const position=document.createElement('div');position.id='sort-position';position.style.cssText='display:flex;flex-direction:column;align-items:flex-end';
    position.append(document.createElement('ytmusic-sort-filter-button-renderer'));header.append(position);
    const grid=document.createElement('div');grid.id='fixture-grid';
    const items=document.createElement('div');items.id='items';grid.append(items);
    browse.append(header,grid);
  });
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  await page.evaluate(() => {
    const fixture=document.querySelector("#library-layout-fixture");
    const sort=fixture.querySelector("ytmusic-sort-filter-button-renderer");
    const sortButton=document.createElement('button');sortButton.id='fixture-sort';sortButton.type='button';sortButton.textContent='Recent activity';sortButton.style.cssText='height:38px;padding:0 16px;border:1px solid #444;border-radius:20px;background:#222;color:white';
    sort.replaceChildren(sortButton);
    window.__sortClicks=0;
    sort.querySelector("button").addEventListener("click",(event)=>{event.stopImmediatePropagation();window.__sortClicks++;},true);
    const items=fixture.querySelector("#fixture-grid #items");
    items.style.cssText="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:24px;margin-top:24px";
    items.append(...window.__libraryCards.slice(0,3));
    // Artist cards can center their details in the native grid.
    window.__libraryCards[1].querySelector(".details").style.textAlign="center";
    window.__gridBaseline=window.__libraryCards.slice(0,3).map((card)=>({width:getComputedStyle(card).width,style:card.style.cssText,imageStyle:card.querySelector('.image-wrapper')?.style.cssText}));
    window.__menuBaseline=window.__libraryCards.slice(0,3).map((card)=>{
      const menu=card.querySelector('ytmusic-menu-renderer');
      return menu?{menu,parent:menu.parentNode,next:menu.nextSibling,style:menu.style.cssText}:null;
    });
  });
  const selector=page.locator("#library-layout-fixture #yme-library-view-selector");
  await selector.waitFor({state:"visible"});
  assert.equal(await page.locator("#yme-library-view-selector").count(),1);
  const controlBox=await selector.boundingBox();
  const sortBox=await page.locator("#fixture-sort").boundingBox();
  assert.ok(Math.abs(controlBox.y+controlBox.height/2-sortBox.y-sortBox.height/2)<2,"Sort and view buttons must align on one row");
  assert.ok(controlBox.x+controlBox.width<=sortBox.x,"View controls must sit beside sort, not overlap it");
  const checks={alignedToolbar:true,nativeCardsInLibraryFixture:true};
  const dropdown=selector.getByRole('button',{name:'Library view',exact:true});
  await dropdown.click();
  assert.deepEqual(await selector.getByRole('menuitemradio').allTextContents(),['✓List view','✓Grid view']);
  await page.keyboard.press('Escape');
  const matchingStyles=await dropdown.evaluate((node)=>{
    const actual=getComputedStyle(node);
    const sort=getComputedStyle(document.querySelector('#fixture-sort'));
    return ['height','background-color','color','border-radius','border-top-width','font-size','font-family'].every(property=>actual.getPropertyValue(property)===sort.getPropertyValue(property));
  });
  assert.equal(matchingStyles,true,'The view dropdown must match the adjacent sort button styling');
  checks.dropdownMatchesSortButton=true;
  await dropdown.click();
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Enter');
  await page.waitForFunction(()=>document.querySelector('#library-layout-fixture #fixture-grid #items')?.style.flexDirection==='column');
  const list=await page.evaluate(()=>window.__libraryCards.slice(0,3).map((card)=>({
    x:card.getBoundingClientRect().x,y:card.getBoundingClientRect().y,height:card.getBoundingClientRect().height,
    image:card.querySelector('.image-wrapper')?.getBoundingClientRect().width,
    imageRight:card.querySelector('.image-wrapper')?.getBoundingClientRect().right,
    right:card.getBoundingClientRect().right,
    menu:(()=>{const menu=card.querySelector('ytmusic-menu-renderer');const rect=menu?.getBoundingClientRect();return rect?{x:rect.x,y:rect.y,width:rect.width,height:rect.height}:null;})(),
    display:getComputedStyle(card).display,
  })));
  const artistAlignment=await page.evaluate(()=>getComputedStyle(window.__libraryCards[1].querySelector(".details")).textAlign);
  assert.ok(["start", "left"].includes(artistAlignment), `Artist text must align at the start: ${artistAlignment}`);
  assert.equal(list.every((card)=>card.display==='flex' && card.image===56),true);
  assert.ok(list[1].y>=list[0].y+list[0].height && list[2].y>=list[1].y+list[1].height);
  assert.ok(list.every((card)=>Math.abs(card.x-list[0].x)<1));
  assert.ok(list.every((card)=>card.menu && card.menu.x>card.imageRight && card.menu.x+card.menu.width<=card.right+1),'List menus must sit at the row end, outside the artwork');
  assert.ok(list.every((card)=>Math.abs(card.menu.y+card.menu.height/2-card.y-card.height/2)<2),'List menus must be vertically centered');
  assert.equal(await page.evaluate(()=>window.__menuBaseline.every((saved,index)=>saved && saved.menu===window.__libraryCards[index].querySelector('ytmusic-menu-renderer') && !saved.menu.closest('.image-wrapper'))),true);
  const beforeMenuUrl=page.url();
  await page.locator('#library-layout-fixture ytmusic-menu-renderer').first().getByRole('button',{name:'Action menu',exact:true}).click();
  const nativePopup=page.locator('ytmusic-menu-popup-renderer:visible');
  await nativePopup.waitFor({state:'visible'});
  assert.equal(page.url(),beforeMenuUrl,'Opening the menu must not activate the artwork link');
  await page.keyboard.press('Escape');
  await nativePopup.waitFor({state:'hidden'});
  checks.nativeMenuOutsideArtwork=true;
  checks.nativeMenuStillOpens=true;
  assert.equal(await dropdown.textContent(),'List view');
  assert.equal(await worker.evaluate(async()=>(await chrome.storage.local.get('ymeLibraryView')).ymeLibraryView),'list');
  assert.equal(await page.evaluate(()=>window.__libraryCards[3].style.cssText===window.__outsideStyle),true);
  checks.listRowsWithSmallArtwork=true;
  checks.keyboardSelectionAndPersistence=true;
  checks.outsideCardsUntouched=true;
  await page.screenshot({path:'.dev/evidence/library-list-1440.png'});
  await page.locator('#fixture-sort').click();
  assert.equal(await page.evaluate(()=>window.__sortClicks),1);
  await page.locator('#fixture-sort').evaluate((node)=>{node.textContent='A to Z';});
  assert.equal(await selector.count(),1);
  checks.sortButtonPreserved=true;
  await page.evaluate(()=>document.querySelector('#library-layout-fixture #fixture-grid #items').append(window.__libraryCards[3]));
  await page.waitForFunction(()=>window.__libraryCards[3].style.width==='100%');
  checks.newlyLoadedRowsFollowLayout=true;
  await dropdown.click();
  await selector.getByRole('menuitemradio',{name:'Grid view'}).click();
  await page.waitForFunction(()=>document.querySelector('#library-layout-fixture #fixture-grid #items')?.style.display==='grid');
  assert.equal(await page.evaluate(()=>window.__libraryCards.slice(0,3).every((card,index)=>card.style.cssText===window.__gridBaseline[index].style && card.querySelector('.image-wrapper')?.style.cssText===window.__gridBaseline[index].imageStyle)),true);
  assert.equal(await page.evaluate(()=>window.__menuBaseline.every((saved)=>saved.menu.parentNode===saved.parent && saved.menu.nextSibling===saved.next && saved.menu.style.cssText===saved.style)),true);
  checks.gridRestoresNativeMenus=true;
  assert.equal(await page.evaluate(()=>window.__libraryCards[1].querySelector('.details').style.textAlign),'center');
  checks.gridRestoresNativeStyles=true;
  await page.screenshot({path:'.dev/evidence/library-grid-1440.png'});
  await worker.evaluate(()=>chrome.storage.local.set({ymeLibraryView:'list'}));
  await page.waitForFunction(()=>document.querySelector('#library-layout-fixture #fixture-grid #items')?.style.display==='flex');
  assert.equal(await dropdown.textContent(),'List view');
  checks.storageUpdatesApply=true;
  await page.evaluate(()=>document.querySelector('ytmusic-app').navigate('FEmusic_explore'));
  await page.waitForURL((url)=>url.pathname==='/explore');
  await page.waitForFunction(()=>!document.querySelector('#yme-library-view-selector'));
  assert.equal(await page.evaluate(()=>document.querySelector('#library-layout-fixture #fixture-grid #items').style.display),'grid');
  checks.navigationRestoresLayout=true;
  assert.deepEqual(errors,[]);
  await writeFile('.dev/evidence/library-view-checks.json',JSON.stringify({checks,list,errors},null,2));
  console.log(JSON.stringify({checks,list,errors},null,2));
} finally { await context.close(); }
