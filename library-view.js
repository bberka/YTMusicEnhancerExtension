function onLibraryRoute() {
  return /^\/library(?:\/|$)/.test(location.pathname)
    || /^\/browse\/FEmusic_(?:library_|liked_)/.test(location.pathname);
}

function visible(element) {
  for (let node = element; node; node = node.parentElement || node.getRootNode().host) {
    if (node.hidden || getComputedStyle(node).display === "none") return false;
  }
  return true;
}

export function createLibraryView({ deepFind, makeIcon, onChange, scheduleUpdate }) {
  const originals = new Map();
  const movedMenus = new Map();
  const observed = new WeakSet();
  let toolbar = null;
  let sortControl = null;
  let dismissMenu = null;

  function set(element, property, value) {
    if (!originals.has(element)) originals.set(element, new Map());
    const values = originals.get(element);
    if (!values.has(property)) values.set(property, [element.style.getPropertyValue(property), element.style.getPropertyPriority(property)]);
    if (element.style.getPropertyValue(property) !== value) element.style.setProperty(property, value, "important");
  }

  function restoreLayout() {
    for (const [menu, { marker, parent }] of movedMenus) {
      if (marker.parentNode) marker.replaceWith(menu);
      else parent.append(menu);
    }
    movedMenus.clear();
    for (const [element, properties] of originals) {
      for (const [property, [value, priority]] of properties) {
        if (value) element.style.setProperty(property, value, priority);
        else element.style.removeProperty(property);
      }
    }
    originals.clear();
  }

  function removeToolbar() {
    if (toolbar?.isConnected && sortControl?.parentElement === toolbar) toolbar.before(sortControl);
    if (dismissMenu) document.removeEventListener("pointerdown", dismissMenu);
    dismissMenu = null;
    toolbar?.remove();
    toolbar = null;
    sortControl = null;
  }

  function observe(root) {
    if (!observed.has(root)) {
      observed.add(root);
      new MutationObserver(scheduleUpdate).observe(root, { childList: true, subtree: true, characterData: true,
        attributes: true, attributeFilter: ["hidden"] });
    }
    for (const node of root.querySelectorAll("*")) if (node.shadowRoot) observe(node.shadowRoot);
  }

  function createToolbar(sort) {
    if (toolbar?.isConnected && sortControl === sort && sort.parentElement === toolbar && toolbar.querySelector("#yme-library-view-selector")) return;
    if (toolbar?.isConnected && sort !== sortControl && toolbar.contains(sort)) toolbar.before(sort);
    removeToolbar();
    sortControl = sort;
    toolbar = document.createElement("div");
    toolbar.className = "yme-library-toolbar";
    toolbar.style.cssText = "display:flex;flex-direction:row;align-items:center;justify-content:flex-end;gap:8px;flex-wrap:nowrap;max-width:100%;width:max-content;margin-inline-start:auto;align-self:flex-end";
    const selector = document.createElement("div");
    selector.id = "yme-library-view-selector";
    selector.style.cssText = "position:relative;display:inline-flex;align-items:center;flex:0 0 auto";
    const dropdown = document.createElement("button");
    dropdown.type = "button";
    dropdown.className = "yme-library-view-dropdown";
    dropdown.setAttribute("aria-label", "Library view");
    dropdown.setAttribute("aria-haspopup", "menu");
    dropdown.setAttribute("aria-expanded", "false");
    dropdown.style.cssText = "box-sizing:border-box;min-width:116px;height:36px;padding:0 38px 0 16px;border:1px solid var(--yt-spec-10-percent-layer,#ffffff1a);border-radius:18px;background:var(--yt-spec-10-percent-layer,#ffffff1a);color:var(--yt-spec-text-primary,#fff);font:500 14px Roboto,Arial,sans-serif;cursor:pointer;text-align:start";
    const menu = document.createElement("div");
    menu.className = "yme-library-view-menu";
    menu.setAttribute("role", "menu");
    menu.setAttribute("aria-label", "Library view");
    menu.hidden = true;
    menu.innerHTML = '<div class="yme-library-view-heading">View</div>';
    for (const [mode, label] of [["list", "List view"], ["large-list", "Bigger list view"], ["grid", "Grid view"]]) {
      const option = document.createElement("button");
      option.type = "button";
      option.dataset.view = mode;
      option.setAttribute("role", "menuitemradio");
      option.innerHTML = `<span class="yme-view-check" aria-hidden="true">✓</span><span>${label}</span>`;
      option.addEventListener("click", () => { onChange(mode); update(mode); close(true); });
      menu.append(option);
    }
    function close(focus = false) {
      menu.hidden = true;
      dropdown.setAttribute("aria-expanded", "false");
      if (focus) dropdown.focus();
    }
    dropdown.addEventListener("click", () => {
      if (!menu.hidden) return close();
      menu.hidden = false;
      dropdown.setAttribute("aria-expanded", "true");
      (menu.querySelector('[aria-checked="true"]') || menu.querySelector("button"))?.focus();
    });
    menu.addEventListener("keydown", (event) => {
      if (event.key === "Escape" || event.key === "Tab") { close(event.key === "Escape"); return; }
      if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const options = [...menu.querySelectorAll("button")];
      const index = options.indexOf(document.activeElement);
      const next = event.key === "Home" ? 0 : event.key === "End" ? options.length - 1 : (index + (event.key === "ArrowDown" ? 1 : -1) + options.length) % options.length;
      options[next].focus();
    });
    dismissMenu = (event) => { if (!selector.contains(event.target)) close(); };
    document.addEventListener("pointerdown", dismissMenu);
    const arrow = makeIcon("chevronDown");
    arrow.style.cssText = "position:absolute;inset-inline-end:14px;top:18px;transform:translateY(-50%);width:14px;height:14px;pointer-events:none;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round";
    selector.append(dropdown, arrow, menu);
    sort.before(toolbar);
    toolbar.append(selector, sort);
    const root = toolbar.getRootNode();
    if (!root.querySelector("style[data-yme-library-controls]")) {
      const sheet = document.createElement("style");
      sheet.dataset.ymeLibraryControls = "true";
      sheet.textContent = `.yme-library-view-dropdown:focus-visible { outline:2px solid var(--yt-spec-text-primary,#fff);outline-offset:2px; }
        .yme-library-view-menu { position:absolute;z-index:1000;top:calc(100% + 2px);inset-inline-start:0;min-width:240px;padding:8px 0;background:var(--ytmusic-menu-background-color,var(--yt-spec-menu-background,#212121));color:var(--yt-spec-text-primary,#fff);box-shadow:0 4px 16px #0008;border:1px solid var(--yt-spec-10-percent-layer,#ffffff1a);font:400 14px Roboto,Arial,sans-serif; }
        .yme-library-view-menu[hidden] { display:none; }
        .yme-library-view-heading { padding:12px 24px 16px;border-bottom:1px solid var(--yt-spec-10-percent-layer,#ffffff1a);font-weight:500; }
        .yme-library-view-menu button { display:flex;align-items:center;gap:16px;width:100%;min-height:48px;padding:0 16px;border:0;background:transparent;color:inherit;font:inherit;text-align:start;cursor:pointer; }
        .yme-library-view-menu button:hover, .yme-library-view-menu button:focus-visible { background:var(--yt-spec-10-percent-layer,#ffffff1a);outline:none; }
        .yme-view-check { display:inline-flex;align-items:center;justify-content:center;width:24px;font-size:22px;visibility:hidden; }
        [aria-checked="true"] .yme-view-check { visibility:visible; }`;
      (root === document ? document.head : root).append(sheet);
    }
  }

  function paintDropdown(view) {
    const dropdown = toolbar?.querySelector(".yme-library-view-dropdown");
    if (!dropdown) return;
    dropdown.textContent = ({ list: "List view", "large-list": "Bigger list view", grid: "Grid view" })[view] || "Grid view";
    for (const option of toolbar.querySelectorAll(".yme-library-view-menu [role=menuitemradio]")) option.setAttribute("aria-checked", String(option.dataset.view === view));
    const button = deepFind(sortControl, "button, tp-yt-paper-button, [role='button']").find(visible);
    if (!button) return;
    const nativeStyle = getComputedStyle(button);
    for (const property of ["height", "background-color", "color", "border", "border-radius", "font-family", "font-size", "font-weight", "line-height", "letter-spacing"]) {
      const value = nativeStyle.getPropertyValue(property);
      if (value && value !== "auto" && dropdown.style.getPropertyValue(property) !== value) dropdown.style.setProperty(property, value);
    }
    dropdown.parentElement.style.color = nativeStyle.color;
  }

  function listCard(card, large) {
    const imageSize = large ? "80px" : "56px";
    set(card, "display", "flex");
    set(card, "align-items", "center");
    set(card, "text-align", "start");
    set(card, "gap", "16px");
    set(card, "width", "100%");
    set(card, "max-width", "100%");
    set(card, "min-width", "0px");
    set(card, "height", "auto");
    set(card, "min-height", large ? "96px" : "72px");
    set(card, "margin", "0px");
    set(card, "padding", "8px 0px");
    set(card, "box-sizing", "border-box");
    for (const wrapper of deepFind(card, "#container")) {
      set(wrapper, "display", "flex");
      set(wrapper, "align-items", "center");
      set(wrapper, "gap", "16px");
      set(wrapper, "width", "100%");
      set(wrapper, "min-width", "0px");
      set(wrapper, "flex", "1 1 0%");
    }
    for (const image of deepFind(card, ".image-wrapper, #thumbnail")) {
      for (const property of ["width", "height", "min-width", "max-width"]) set(image, property, imageSize);
      set(image, "flex", `0 0 ${imageSize}`);
      set(image, "padding", "0px");
      set(image, "margin", "0px");
      set(image, "aspect-ratio", "1");
    }
    for (const image of deepFind(card, "ytmusic-thumbnail-renderer, yt-img-shadow, .image-wrapper img, #thumbnail img")) {
      set(image, "width", "100%");
      set(image, "height", "100%");
      if (image.localName === "img") set(image, "object-fit", "cover");
    }
    for (const details of deepFind(card, ".details")) {
      set(details, "min-width", "0px");
      set(details, "flex", "1 1 0%");
      set(details, "margin", "0px");
      set(details, "text-align", "start");
      set(details, "align-items", "flex-start");
    }
    for (const title of deepFind(card, ".title")) {
      set(title, "white-space", "nowrap");
      set(title, "overflow", "hidden");
      set(title, "text-overflow", "ellipsis");
    }
    for (const menu of deepFind(card, "ytmusic-menu-renderer")) {
      const row = card.shadowRoot || card;
      if (menu.parentNode !== row) {
        if (!movedMenus.has(menu)) {
          const marker = document.createComment("yme-library-menu");
          const parent = menu.parentNode;
          menu.before(marker);
          movedMenus.set(menu, { marker, parent });
        }
        row.append(menu);
      }
      set(menu, "position", "static");
      set(menu, "transform", "none");
      set(menu, "display", "flex");
      set(menu, "align-self", "center");
      set(menu, "flex", "0 0 auto");
      set(menu, "min-width", "40px");
      set(menu, "margin", "0px");
      set(menu, "margin-inline-start", "auto");
      set(menu, "opacity", "1");
      set(menu, "visibility", "visible");
      set(menu, "pointer-events", "auto");
    }
    for (const footer of deepFind(card, "#footer-button")) if (!footer.children.length && !footer.textContent.trim()) set(footer, "display", "none");
  }

  function update(view) {
    if (!onLibraryRoute()) {
      restoreLayout(); removeToolbar();
      delete document.documentElement.dataset.ymeLibraryView;
      return;
    }
    const pages = deepFind(document, "ytmusic-browse-response, ytmusic-library-page-renderer").filter(visible);
    const page = pages.find((node) => deepFind(node, "ytmusic-sort-filter-button-renderer").some(visible)) || pages[0];
    if (!page) { restoreLayout(); removeToolbar(); return; }
    observe(page);
    const sort = deepFind(page, "ytmusic-sort-filter-button-renderer").find(visible)
      || deepFind(page, "button, [role='button']").find((node) => visible(node) && /^(recent activity|a to z|z to a|recently added)$/i.test((node.textContent || "").trim()));
    if (sort) createToolbar(sort);
    else removeToolbar();
    document.documentElement.dataset.ymeLibraryView = view;
    paintDropdown(view);
    if (view !== "list" && view !== "large-list") { restoreLayout(); return; }
    for (const element of originals.keys()) if (!element.isConnected) originals.delete(element);
    const groups = new Map();
    for (const card of deepFind(page, "ytmusic-two-row-item-renderer")) {
      // Carousel recommendations are not the Library's grid and retain their horizontal layout.
      let ancestor = card;
      let carousel = false;
      while (ancestor && ancestor !== page) {
        if (ancestor.matches("ytmusic-carousel, ytmusic-carousel-shelf-renderer")) { carousel = true; break; }
        ancestor = ancestor.parentElement || ancestor.getRootNode().host;
      }
      if (carousel) continue;
      const items = card.parentElement;
      if (!items) continue;
      if (!groups.has(items)) groups.set(items, []);
      groups.get(items).push(card);
    }
    for (const [items, cards] of groups) {
      observe(items.getRootNode() instanceof ShadowRoot ? items.getRootNode() : items);
      set(items, "display", "flex");
      set(items, "flex-direction", "column");
      set(items, "flex-wrap", "nowrap");
      set(items, "align-items", "stretch");
      set(items, "gap", "0px");
      for (const card of cards) {
        if (card.shadowRoot) observe(card.shadowRoot);
        listCard(card, view === "large-list");
      }
    }
  }
  return update;
}
