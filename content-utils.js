const iconPaths = {
  like: "M7 10v10H3V10h4Zm0 9h10a2 2 0 0 0 2-1.6l1-5A2 2 0 0 0 18 10h-4l1-5a2 2 0 0 0-2-2l-1 4-5 5",
  preview: "M3 5h18v14H3zM15 5v14M6 9l5 3-5 3Z",
  remove: "M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7",
  queue: "M3 5h14M3 9h14M3 13h8M17 13v8M13 17h8",
  addPlaylist: "M3 6h12M3 10h12M3 14h8M18 13v8M14 17h8",
  share: "M18 8a3 3 0 1 0-2.8-4M6 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm12 6a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM8.6 10.5l6.8-4M8.6 13.5l6.8 4",
  home: "M3 10.5 12 3l9 7.5M5.5 9v11h13V9M9 20v-6h6v6",
  explore: "M10.5 3a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15ZM16 16l5 5M8 13l2-5 5-2-2 5-5 2Z",
  search: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm6-2 4 4",
  library: "M4 5h16v15H4zM8 9h8M8 12h8M8 15h5",
  playlist: "M3 6h11M3 10h11M3 14h7M21 15V4l-4 1M21 15a3 3 0 1 1-6 0a3 3 0 0 1 6 0",
  podcast: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM6.5 7.5a8 8 0 0 0 0 9M17.5 7.5a8 8 0 0 1 0 9M3 4a12 12 0 0 0 0 16M21 4a12 12 0 0 1 0 16",
  radio: "M4 8h16v12H4zM4 8l15-5M8 12h.01M12 12h.01M16 12h.01M8 16h8",
  download: "M12 3v12m0 0 5-5m-5 5-5-5M4 20h16",
  song: "M9 18V5l12-2v13M9 9l12-2M5 20a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm12-2a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
  album: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 5a4 4 0 1 1 0 8 4 4 0 0 1 0-8Z",
  artist: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 9a7 7 0 0 1 14 0",
  profile: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21a8 8 0 0 1 16 0",
  chevronDown: "M6 9l6 6 6-6",
};

export function makeIcon(name) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", iconPaths[name] || iconPaths.playlist);
  svg.append(path);
  return svg;
}

const scrollbarRoots = new WeakSet();
function styleScrollbar(root) {
  if (!root || scrollbarRoots.has(root)) return;
  scrollbarRoots.add(root);
  const style = document.createElement("style");
  style.textContent = `
    :host, :host *:not(#yme-scrollbar-override#yme-scrollbar-override#yme-scrollbar-override) { scrollbar-width:auto!important; scrollbar-color:auto!important; }
    :host::-webkit-scrollbar, :host *:not(#yme-scrollbar-override#yme-scrollbar-override#yme-scrollbar-override)::-webkit-scrollbar { display:block!important; width:3px!important; height:3px!important; }
    :host::-webkit-scrollbar-thumb, :host *:not(#yme-scrollbar-override#yme-scrollbar-override#yme-scrollbar-override)::-webkit-scrollbar-thumb { background:#777!important; border-radius:4px!important; }
    :host::-webkit-scrollbar-track, :host *:not(#yme-scrollbar-override#yme-scrollbar-override#yme-scrollbar-override)::-webkit-scrollbar-track { background:transparent!important; }
    :host::-webkit-scrollbar-button, :host *:not(#yme-scrollbar-override#yme-scrollbar-override#yme-scrollbar-override)::-webkit-scrollbar-button { display:none!important; width:0!important; height:0!important; }
    @supports (-moz-appearance: none) { :host, :host *:not(#yme-scrollbar-override#yme-scrollbar-override#yme-scrollbar-override) { scrollbar-width:thin!important; scrollbar-color:#777 transparent!important; } }
  `;
  root.append(style);
}

export function deepFind(root, selector, results = []) {
  if (!root) return results;
  if (root.querySelectorAll) results.push(...root.querySelectorAll(selector));
  if (root.shadowRoot) {
    styleScrollbar(root.shadowRoot);
    deepFind(root.shadowRoot, selector, results);
  }
  const elements = root.querySelectorAll ? root.querySelectorAll("*") : [];
  for (const element of elements) {
    if (element.shadowRoot) {
      styleScrollbar(element.shadowRoot);
      deepFind(element.shadowRoot, selector, results);
    }
  }
  return results;
}

export function colorValue(name, fallback) {
  return ({ red: "#ff4e55", blue: "#4b9cff", green: "#4cbd82", purple: "#b07cff", plain: "#a8aaa8", match: fallback })[name] || fallback;
}

export function playlistKey() {
  if (!location.pathname.startsWith("/playlist")) return "";
  return new URL(location.href).searchParams.get("list") || "";
}

export function findRowMenuButton(row) {
  const candidates = deepFind(row, "button, [role='button'], yt-icon-button, .dropdown-trigger, #button");
  return candidates.find((element) => {
    const label = `${element.getAttribute("aria-label") || ""} ${element.getAttribute("title") || ""}`;
    return /more|menu|options/i.test(label) || element.matches(".dropdown-trigger");
  }) || deepFind(row, "ytmusic-menu-renderer")[0];
}
