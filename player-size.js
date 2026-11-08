export function createPlayerSizer(deepFind) {
  const originals = new Map();
  function set(element, property, value) {
    if (!originals.has(element)) originals.set(element, new Map());
    const values = originals.get(element);
    if (!values.has(property)) values.set(property, [element.style.getPropertyValue(property), element.style.getPropertyPriority(property)]);
    if (element.style.getPropertyValue(property) !== value) element.style.setProperty(property, value, "important");
  }
  function restore() {
    for (const [element, values] of originals) for (const [property, [value, priority]] of values) {
      if (value) element.style.setProperty(property, value, priority);
      else element.style.removeProperty(property);
    }
    originals.clear();
  }
  function restoreWidth(element) {
    const values = originals.get(element);
    if (!values?.has("width")) return;
    const [value, priority] = values.get("width");
    if (value) element.style.setProperty("width", value, priority);
    else element.style.removeProperty("width");
    values.delete("width");
  }
  return function updateLargePlayer(enabled) {
    if (!enabled) { restore(); return; }
    for (const element of originals.keys()) if (!element.isConnected) originals.delete(element);
    const bars = deepFind(document, "ytmusic-player-bar");
    if (!bars.length) return;
    const narrow = window.innerWidth < 768;
    const height = narrow ? "112px" : "120px";
    const buttonSize = narrow ? "40px" : "44px";
    const playSize = narrow ? "56px" : "64px";
    const playIconSize = narrow ? "40px" : "48px";
    set(document.documentElement, "--ytmusic-player-bar-height", height);
    for (const bar of bars) {
      set(bar, "height", height);
      set(bar, "min-height", height);
      for (const button of deepFind(bar, "yt-icon-button, button")) {
        for (const property of ["height", "min-width", "min-height"]) set(button, property, buttonSize);
        // Newer segmented voting buttons include a like count; do not squeeze that text into a square.
        if (!button.textContent.trim()) set(button, "width", buttonSize);
        else restoreWidth(button);
      }
      for (const icon of deepFind(bar, "yt-icon, .ytSpecButtonShapeNextIcon, .ytIconWrapperHost")) {
        set(icon, "width", "28px");
        set(icon, "height", "28px");
      }
      for (const play of deepFind(bar, '#play-pause-button, .play-pause-button, button[aria-label="Play"], button[aria-label="Pause"]')) {
        for (const target of [play, ...deepFind(play, "button")]) {
          for (const property of ["width", "height", "min-width", "min-height"]) set(target, property, playSize);
        }
        for (const icon of deepFind(play, "yt-icon, .ytSpecButtonShapeNextIcon, .ytIconWrapperHost")) {
          set(icon, "width", playIconSize);
          set(icon, "height", playIconSize);
        }
      }
      for (const image of deepFind(bar, ".thumbnail-image-wrapper, .thumbnail-image-wrapper > img")) {
        set(image, "width", "56px");
        set(image, "height", "56px");
      }
      for (const time of deepFind(bar, ".time-info")) set(time, "font-size", "14px");
      for (const volume of deepFind(bar, "#volume-slider")) set(volume, "flex-shrink", "0");
      for (const controls of deepFind(bar, "#right-controls")) {
        if (narrow) restoreWidth(controls);
        else set(controls, "width", "max-content");
      }
      // Scope seek changes to #progress-bar: volume sliders are intentionally untouched.
      for (const seek of deepFind(bar, "#progress-bar")) {
        set(seek, "--paper-slider-height", "8px");
        set(seek, "--paper-slider-knob-size", "16px");
        for (const track of deepFind(seek, ".bar-container, #sliderBar, #progressContainer, #primaryProgress, #secondaryProgress")) set(track, "height", "8px");
        for (const hitArea of deepFind(seek, "#sliderContainer, .slider-container")) {
          set(hitArea, "height", "32px");
          set(hitArea, "min-height", "32px");
        }
      }
    }
  };
}
