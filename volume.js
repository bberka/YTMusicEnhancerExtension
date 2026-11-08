import { extensionApi } from "./extension-api.js";
import { deepFind } from "./content-utils.js";

export function createVolumeMemory({ getSettings }) {
  let lastVolume = null;
  let restored = false;
  let writeTimer = 0;
  const patchedControls = new WeakSet();

  function playerRoots() {
    return document.querySelectorAll("ytmusic-player-bar, ytmusic-miniplayer, ytmusic-player-page, ytmusic-player");
  }

  function volumeControls() {
    const controls = [];
    for (const root of playerRoots()) {
      for (const control of deepFind(root, "#volume-slider, tp-yt-paper-slider, input[type='range']")) {
        const label = `${control.id} ${control.getAttribute("aria-label") || ""} ${control.getAttribute("title") || ""}`;
        if (/volume/i.test(label)) controls.push(control);
      }
    }
    return [...new Set(controls)];
  }

  function fractionFromControl(control) {
    const value = Number(control.getAttribute("aria-valuenow") ?? control.value);
    if (!Number.isFinite(value)) return null;
    const min = Number(control.min || 0);
    const max = Number(control.max || 100);
    return Math.min(1, Math.max(0, (value - min) / (max - min || 100)));
  }

  function save(value) {
    if (!getSettings().rememberVolume || !Number.isFinite(value)) return;
    lastVolume = Math.min(1, Math.max(0, value));
    clearTimeout(writeTimer);
    writeTimer = setTimeout(() => extensionApi.storage.local.set({ ymeLastVolume: lastVolume }), 250);
  }

  function restore() {
    if (!getSettings().rememberVolume || restored || !Number.isFinite(lastVolume)) return;
    const controls = volumeControls();
    const media = [];
    for (const root of playerRoots()) media.push(...deepFind(root, "audio, video"));
    if (!controls.length || !media.length) return;
    document.documentElement.dataset.ymeRestoreVolume = String(lastVolume * 100);
    const event = new Event("yme-restore-volume", { cancelable: true });
    document.dispatchEvent(event);
    delete document.documentElement.dataset.ymeRestoreVolume;
    restored = event.defaultPrevented;
  }

  return {
    load(value) {
      lastVolume = typeof value === "number" && Number.isFinite(value) ? value : null;
    },
    reset() {
      restored = false;
    },
    bind() {
      for (const control of volumeControls()) {
        if (patchedControls.has(control)) continue;
        patchedControls.add(control);
        const remember = () => {
          const value = fractionFromControl(control);
          if (value != null) save(value);
        };
        control.addEventListener("input", remember, { passive: true });
        control.addEventListener("change", remember, { passive: true });
      }
      restore();
    },
  };
}
