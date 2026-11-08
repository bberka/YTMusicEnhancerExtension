import assert from "node:assert/strict";
import test from "node:test";
import { validateExploreSnapshot } from "../explore-cache.js";

const now = 100000000;
const sample = () => ({ version: 1, locale: "en", savedAt: now - 1000, sections: [
  { title: "New releases", items: [{ title: "Album", href: "/browse/MPREfixture", image: "https://lh3.googleusercontent.com/art" }] },
] });

test("Explore snapshots expire and never cross language settings", () => {
  assert.ok(validateExploreSnapshot(sample(), "en", now));
  assert.equal(validateExploreSnapshot(sample(), "tr", now), null);
  assert.equal(validateExploreSnapshot({ ...sample(), savedAt: now - 7 * 3600000 }, "en", now), null);
  assert.equal(validateExploreSnapshot({ ...sample(), savedAt: now + 1 }, "en", now), null);
});

test("Explore cache rejects external navigation and untrusted image URLs", () => {
  const value = sample();
  value.sections[0].items.push({ title: "Bad link", href: "javascript:alert(1)" });
  value.sections[0].items[0].image = "https://evil.example/track";
  const result = validateExploreSnapshot(value, "en", now);
  assert.equal(result.sections[0].items.length, 1);
  assert.equal(result.sections[0].items[0].image, null);
  assert.equal(result.sections[0].items[0].href, "https://music.youtube.com/browse/MPREfixture");
});

test("Explore cache is bounded and malformed entries are ignored", () => {
  const value = sample();
  value.sections = [null, ...Array(10).fill(value.sections[0])];
  assert.equal(validateExploreSnapshot(value, "en", now).sections.length, 5);
  assert.equal(validateExploreSnapshot({ ...value, sections: [null, {}] }, "en", now), null);
});
