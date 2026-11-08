export const shortcuts = [
  { id: "home", label: "Home", path: "/", icon: "home", enabled: true, native: true },
  { id: "explore", label: "Explore", path: "/explore", icon: "explore", enabled: true, native: true },
  { id: "library", label: "Library", path: "/library", icon: "library", enabled: true, native: true },
  { id: "playlists", label: "Playlists", path: "/library/playlists", icon: "playlist", enabled: true },
  ...[
    ["downloads", "Downloads", "/browse/FEmusic_offline", "download"],
    ["songs", "Songs", "/library/songs", "song"],
    ["albums", "Albums", "/library/albums", "album"],
    ["artists", "Artists", "/library/artists", "artist"],
    ["profiles", "Profiles", "/library/channels", "profile"],
    ["podcasts", "Podcasts", "/library/podcasts", "podcast"],
  ].map(([id, label, path, icon]) => ({ id, label, path, icon, enabled: false })),
];

export const actionNames = { like: "Like", preview: "Side play (preview)", remove: "Remove from playlist", queue: "Add to queue", addPlaylist: "Add to playlist", radio: "Start radio", artist: "Go to artist", album: "Go to album", share: "Share" };

export const defaults = {
  theme: "system",
  quickActions: ["like", "queue"], quickActionsEnabled: true,
  actionColor: "match", menuColor: "match", primaryColor: "red",
  sidebarWidth: 100, sidebarIcons: true, compactSidebar: false, compactLibrary: true, compactPlaylistSidebar: false, hideNewPlaylist: true,
  sidebarShortcuts: shortcuts, sidebarOrderVersion: 1,
  largeProgress: true, playerPosition: "bottom", rememberVolume: false,
};

export function validPath(value) {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") && !value.includes("\\");
}

export function normalizeSettings(stored = {}) {
  const result = { ...structuredClone(defaults), ...stored };
  for (const [key, value] of Object.entries(defaults)) if (typeof value === "boolean" && typeof result[key] !== "boolean") result[key] = value;
  result.sidebarWidth = typeof result.sidebarWidth === "number" && Number.isFinite(result.sidebarWidth) ? Math.min(150, Math.max(75, result.sidebarWidth)) : 100;
  const choices = { theme: ["system", "dark", "light"], playerPosition: ["top", "bottom"],
    actionColor: ["match", "red", "blue", "green", "purple", "plain"], menuColor: ["match", "red", "blue", "green", "purple", "plain"] };
  for (const [key, values] of Object.entries(choices)) if (!values.includes(result[key])) result[key] = defaults[key];
  result.quickActions = Array.isArray(stored.quickActions) ? [...new Set(stored.quickActions.filter((id) => Object.hasOwn(actionNames, id)))] : [...defaults.quickActions];
  const seen = new Set();
  const saved = Array.isArray(stored.sidebarShortcuts) ? stored.sidebarShortcuts.filter((item) => {
    if (!item || typeof item.id !== "string" || typeof item.label !== "string" || !validPath(item.path) || seen.has(item.id)) return false;
    seen.add(item.id); return true;
  }) : [];
  let normalized = saved.map((item) => {
    const preset = shortcuts.find((value) => value.id === item.id);
    return { ...preset, ...item, path: item.id === "downloads" ? "/browse/FEmusic_offline" : item.path, native: Boolean(preset?.native), custom: !preset, enabled: item.enabled !== false };
  });
  normalized.push(...structuredClone(shortcuts.filter((item) => !seen.has(item.id))));
  if (stored.sidebarOrderVersion !== 1) normalized = [
    ...shortcuts.filter((item) => item.native).map((item) => ({ ...item, enabled: normalized.find((value) => value.id === item.id)?.enabled !== false })),
    ...normalized.filter((item) => !item.native),
  ];
  result.sidebarShortcuts = normalized;
  result.sidebarOrderVersion = 1;
  return Object.fromEntries(Object.keys(defaults).map((key) => [key, result[key]]));
}

export const storage = {
  async get() {
    const api = globalThis.browser ?? globalThis.chrome;
    if (api?.storage?.local) return api.storage.local.get(Object.keys(defaults));
    try { return JSON.parse(localStorage.getItem("music-enhancer-settings") || "{}"); }
    catch { return {}; }
  },
  async set(values) {
    const api = globalThis.browser ?? globalThis.chrome;
    if (api?.storage?.local) return api.storage.local.set(values);
    localStorage.setItem("music-enhancer-settings", JSON.stringify(values));
  },
};
