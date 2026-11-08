import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const manifest = JSON.parse(await readFile(new URL("../manifest.json", import.meta.url), "utf8"));

test("toolbar click opens settings without a popup", async () => {
  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.options_ui.page, "options.html");
  assert.equal(manifest.action.default_title, "Music Enhancer");
  assert.equal(manifest.action.default_popup, undefined);
  assert.equal(manifest.background.service_worker, "background.js");
  await readFile(new URL("../background.js", import.meta.url));
  await readFile(new URL("../options.html", import.meta.url));
});

test("manifest icon files exist at all declared sizes", async () => {
  for (const path of Object.values(manifest.icons)) {
    await readFile(new URL(`../${path}`, import.meta.url));
  }
});

test("YouTube Music content assets are declared and present", async () => {
  const content = manifest.content_scripts.find((script) => script.js.includes("content.js"));
  assert.ok(content);
  await readFile(new URL(`../${content.js[0]}`, import.meta.url));
  await readFile(new URL(`../${content.css[0]}`, import.meta.url));
});

test("custom comments injection and extra YouTube permissions are removed", async () => {
  const options = await readFile(new URL("../src/options.jsx", import.meta.url), "utf8");
  assert.ok(manifest.content_scripts.every((entry)=>!entry.js.includes("comments.js")));
  assert.deepEqual(manifest.host_permissions,["https://music.youtube.com/*"]);
  assert.doesNotMatch(options,/comments-enabled|Comments drawer/);
});

test("settings include the requested editable playlist and sidebar defaults", async () => {
  const source = await readFile(new URL("../src/settings.js", import.meta.url), "utf8");
  const optionsHtml = await readFile(new URL("../src/options.jsx", import.meta.url), "utf8");
  assert.match(source, /quickActions: \["like", "queue"\]/);
  assert.match(source, /id: "home", label: "Home"/);
  assert.match(source, /id: "explore", label: "Explore"/);
  assert.match(source, /compactSidebar: false/);
  assert.match(optionsHtml, /"compact-sidebar"/);
  assert.match(source, /label: "Playlists"/);
  assert.match(source, /"downloads", "Downloads"/);
});
