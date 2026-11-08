import assert from "node:assert/strict";
import test from "node:test";
import { defaults, normalizeSettings, validPath } from "../src/settings.js";

test("settings migration repairs old ordering and preserves disabled destinations", () => {
  const result = normalizeSettings({ sidebarShortcuts: [{ id:"library",label:"Library",path:"/library",enabled:false,native:true }] });
  assert.deepEqual(result.sidebarShortcuts.slice(0,3).map((row)=>row.id),["home","explore","library"]);
  assert.equal(result.sidebarShortcuts[2].enabled,false);
  assert.equal(result.sidebarShortcuts.filter((row)=>row.id==="library").length,1);
  assert.equal(result.sidebarOrderVersion,1);
});

test("current shortcut and action order survives React settings reload", () => {
  const settings = structuredClone(defaults);
  const playlists = settings.sidebarShortcuts.find((row)=>row.id==="playlists");
  settings.sidebarShortcuts = [playlists,...settings.sidebarShortcuts.filter((row)=>row.id!=="playlists")];
  settings.quickActions=["remove","queue","preview"];
  const result=normalizeSettings(settings);
  assert.equal(result.sidebarShortcuts[0].id,"playlists");
  assert.deepEqual(result.quickActions,["remove","queue","preview"]);
});

test("invalid settings are normalized without leaking cache data into preferences", () => {
  const result=normalizeSettings({ theme:"invalid",density:null,rememberVolume:"yes",commentsEnabled:true,quickActions:["remove","invalid","remove"],ymeExploreSnapshot:{private:"not a preference"}});
  assert.equal(result.theme,"system");
  assert.equal(result.rememberVolume,false);
  assert.equal(result.commentsEnabled,undefined);
  assert.equal(result.density,undefined);
  assert.deepEqual(result.quickActions,["remove"]);
  assert.equal(result.ymeExploreSnapshot,undefined);
});

test("player position defaults to bottom and accepts the saved top choice", () => {
  assert.equal(normalizeSettings({}).playerPosition, "bottom");
  assert.equal(normalizeSettings({playerPosition: "top"}).playerPosition, "top");
  assert.equal(normalizeSettings({playerPosition: "sideways"}).playerPosition, "bottom");
});

test("Downloads migrates to the correct offline browse URL",()=>{
  const result=normalizeSettings({sidebarShortcuts:[{id:"downloads",label:"Downloads",path:"/library/downloads",enabled:true}]});
  assert.equal(result.sidebarShortcuts.find((item)=>item.id==="downloads").path,"/browse/FEmusic_offline");
});

test("custom links cannot escape the YouTube Music origin", () => {
  assert.equal(validPath("/playlist?list=PLtest"),true);
  for (const path of ["//evil.example","/\\evil.example","https://evil.example","javascript:alert(1)"]) assert.equal(validPath(path),false);
  const result=normalizeSettings({sidebarShortcuts:[{id:"bad",label:"Bad",path:"//evil.example"}]});
  assert.equal(result.sidebarShortcuts.some((row)=>row.id==="bad"),false);
});

test("fresh defaults hide New playlist and preserve explicitly saved choices", () => {
  const fresh = normalizeSettings();
  assert.equal(fresh.hideNewPlaylist, true);
  assert.deepEqual(fresh.quickActions, ["like", "queue"]);
  assert.equal("shufflePlaylistPlay" in fresh, false);
  assert.equal("shuffleAlbumPlay" in fresh, false);
  const saved = normalizeSettings({ hideNewPlaylist: false, quickActions: ["preview", "remove"] });
  assert.equal(saved.hideNewPlaylist, false);
  assert.deepEqual(saved.quickActions, ["preview", "remove"]);
});
