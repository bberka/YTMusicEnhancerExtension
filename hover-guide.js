export function installHoverGuide() {
  let pointerInside = false;
  let focusInside = false;
  function update() {
    const app = document.querySelector("ytmusic-app");
    const rail = app?.querySelector("#mini-guide-renderer");
    const drawer = app?.querySelector("#guide");
    const visibleRail = rail && rail.getClientRects().length && getComputedStyle(rail).visibility !== "hidden";
    app?.classList.toggle("yme-hover-guide", Boolean(visibleRail && !drawer?.hasAttribute("opened") && (pointerInside || focusInside)));
  }
  document.addEventListener("pointermove", (event) => {
    if (event.pointerType === "touch") return;
    const app = document.querySelector("ytmusic-app");
    const rail = app?.querySelector("#mini-guide-renderer");
    if (!rail || !rail.getClientRects().length || getComputedStyle(rail).visibility === "hidden") { pointerInside = false; update(); return; }
    const rect = rail.getBoundingClientRect();
    const expanded = app.classList.contains("yme-hover-guide");
    const width = expanded ? parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--yme-sidebar-width")) || 240 : rect.width;
    pointerInside = event.clientX >= rect.left && event.clientX < rect.left + width && event.clientY >= rect.top && event.clientY < rect.bottom;
    update();
  }, { passive: true });
  document.addEventListener("pointerleave", () => { pointerInside = false; update(); });
  document.addEventListener("focusin", (event) => {
    focusInside = Boolean(event.target.matches?.(":focus-visible") && event.target.closest?.("#mini-guide-renderer"));
    update();
  });
  document.addEventListener("focusout", () => setTimeout(() => {
    focusInside = Boolean(document.activeElement?.matches?.(":focus-visible") && document.activeElement?.closest?.("#mini-guide-renderer"));
    update();
  }, 0));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") { pointerInside = false; focusInside = false; update(); }
  });
  addEventListener("resize", () => { pointerInside = false; focusInside = false; update(); });
}
