import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { Script } from "node:vm";
import test from "node:test";

test("both browser builds contain complete, classic content scripts", async () => {
  execFileSync("npm", ["run", "build"], { cwd: new URL("../", import.meta.url), stdio: "pipe" });
  for (const directory of ["dist/", "dist/firefox/"]) {
    const base = new URL(`../${directory}`, import.meta.url);
    const manifest = JSON.parse(await readFile(new URL("manifest.json", base), "utf8"));
    for (const content of manifest.content_scripts) {
      for (const file of content.js) {
        const source = await readFile(new URL(file, base), "utf8");
        assert.doesNotThrow(() => new Script(source), `${directory}${file} must run without module imports`);
      }
      for (const file of content.css || []) await readFile(new URL(file, base));
    }
    for (const file of Object.values(manifest.icons)) await readFile(new URL(file, base));
    if (directory.includes("firefox")) assert.deepEqual(manifest.background, { scripts: ["background.js"] });
    else assert.deepEqual(manifest.background, { service_worker: "background.js" });
    const options = await readFile(new URL(manifest.options_ui.page, base), "utf8");
    assert.doesNotMatch(options, /id="primary-color"/);
    assert.match(options, /id="root"/);
    const settingsScript = await readFile(new URL("options.js",base),"utf8");
    assert.match(settingsScript, /compact-library/);
  }
});
