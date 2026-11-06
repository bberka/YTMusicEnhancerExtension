const predefinedShortcuts = [
  { id: "library", label: "Library", path: "/library", icon: "library", enabled: true },
  { id: "downloads", label: "Downloads", path: "/library/downloads", icon: "download", enabled: true },
  { id: "playlists", label: "Playlists", path: "/library/playlists", icon: "playlist", enabled: true },
  { id: "songs", label: "Songs", path: "/library/songs", icon: "song", enabled: true },
  { id: "albums", label: "Albums", path: "/library/albums", icon: "album", enabled: true },
  { id: "artists", label: "Artists", path: "/library/artists", icon: "artist", enabled: true },
  { id: "profiles", label: "Profiles", path: "/library/channels", icon: "profile", enabled: true },
  { id: "podcasts", label: "Podcasts", path: "/library/podcasts", icon: "podcast", enabled: true },
];

const defaults = {
  theme: "system",
  density: "comfortable",
  reduceMotion: false,
  quickActions: ["preview", "remove", "queue", "next"],
  quickActionsEnabled: true,
  actionColor: "match",
  menuColor: "match",
  primaryColor: "red",
  shuffleOnOpen: true,
  sidebarIcons: true,
  sidebarShortcuts: structuredClone(predefinedShortcuts),
  largeProgress: true,
  rememberVolume: false,
  commentsEnabled: true,
};

const actionNames = {
  preview: "Side play (preview)",
  remove: "Remove from playlist",
  queue: "Add to queue",
  next: "Play next",
};

const storage = {
  async get(defaultValues) {
    const extensionApi = globalThis.browser ?? globalThis.chrome;
    if (extensionApi?.storage?.local) return extensionApi.storage.local.get(defaultValues);
    try {
      return { ...defaultValues, ...JSON.parse(localStorage.getItem("music-enhancer-settings") || "{}") };
    } catch {
      return { ...defaultValues };
    }
  },
  async set(values) {
    const extensionApi = globalThis.browser ?? globalThis.chrome;
    if (extensionApi?.storage?.local) return extensionApi.storage.local.set(values);
    const current = await storage.get(defaults);
    localStorage.setItem("music-enhancer-settings", JSON.stringify({ ...current, ...values }));
  },
};

const controls = {
  theme: document.querySelector("#theme"),
  density: document.querySelector("#density"),
  reduceMotion: document.querySelector("#reduce-motion"),
  actionColor: document.querySelector("#action-color"),
  menuColor: document.querySelector("#menu-color"),
  primaryColor: document.querySelector("#primary-color"),
  shuffleOnOpen: document.querySelector("#shuffle-on-open"),
  quickActionsEnabled: document.querySelector("#quick-actions-enabled"),
  sidebarIcons: document.querySelector("#sidebar-icons"),
  largeProgress: document.querySelector("#large-progress"),
  rememberVolume: document.querySelector("#remember-volume"),
  commentsEnabled: document.querySelector("#comments-enabled"),
};
const status = document.querySelector("#save-status");
let quickActions = [...defaults.quickActions];
let sidebarShortcuts = structuredClone(defaults.sidebarShortcuts);

function applySettings(settings) {
  const resolvedTheme = settings.theme === "system"
    ? (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark")
    : settings.theme;

  document.documentElement.dataset.theme = resolvedTheme;
  document.documentElement.dataset.density = settings.density;
  document.documentElement.dataset.reduceMotion = String(settings.reduceMotion);
  document.documentElement.dataset.primaryColor = settings.primaryColor;
}

function renderSettings(settings) {
  controls.theme.value = settings.theme;
  controls.density.value = settings.density;
  controls.reduceMotion.checked = settings.reduceMotion;
  controls.actionColor.value = settings.actionColor;
  controls.menuColor.value = settings.menuColor;
  controls.primaryColor.value = settings.primaryColor;
  controls.shuffleOnOpen.checked = settings.shuffleOnOpen;
  controls.quickActionsEnabled.checked = settings.quickActionsEnabled;
  controls.sidebarIcons.checked = settings.sidebarIcons;
  controls.largeProgress.checked = settings.largeProgress;
  controls.rememberVolume.checked = settings.rememberVolume;
  controls.commentsEnabled.checked = settings.commentsEnabled;
  quickActions = [...settings.quickActions];
  sidebarShortcuts = structuredClone(settings.sidebarShortcuts);
  for (const control of Object.values(controls)) {
    if (control instanceof HTMLSelectElement) syncCustomSelect(control);
  }
  renderQuickActions();
  renderShortcuts();
  applySettings(settings);
}

function renderShortcuts() {
  const list = document.querySelector("#shortcut-list");
  list.replaceChildren();
  for (const shortcut of sidebarShortcuts) {
    const row = document.createElement("div");
    row.className = "shortcut-item";
    const enabledLabel = document.createElement("label");
    enabledLabel.className = "shortcut-enabled";
    const toggle = document.createElement("input");
    toggle.type = "checkbox";
    toggle.checked = shortcut.enabled !== false;
    toggle.setAttribute("aria-label", `Show ${shortcut.label} in the sidebar`);
    toggle.addEventListener("change", () => {
      shortcut.enabled = toggle.checked;
      saveSettings();
    });
    enabledLabel.append(toggle);
    const icon = document.createElement("span");
    icon.textContent = shortcut.icon || "playlist";
    icon.setAttribute("aria-hidden", "true");
    const label = document.createElement("span");
    label.textContent = shortcut.label;
    const path = document.createElement("span");
    path.className = "shortcut-path";
    path.textContent = shortcut.path;
    const reorder = document.createElement("span");
    reorder.className = "shortcut-reorder";
    const index = sidebarShortcuts.indexOf(shortcut);
    const up = makeOrderButton("↑", `Move ${shortcut.label} up`, index === 0, () => moveShortcut(shortcut.id, -1));
    const down = makeOrderButton("↓", `Move ${shortcut.label} down`, index === sidebarShortcuts.length - 1, () => moveShortcut(shortcut.id, 1));
    reorder.append(up, down);
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "shortcut-remove";
    remove.textContent = "×";
    remove.title = `Remove ${shortcut.label} shortcut`;
    remove.setAttribute("aria-label", remove.title);
    remove.disabled = !shortcut.custom;
    remove.addEventListener("click", () => {
      if (!shortcut.custom) return;
      sidebarShortcuts = sidebarShortcuts.filter((item) => item.id !== shortcut.id);
      renderShortcuts();
      saveSettings();
    });
    row.append(enabledLabel, icon, label, path, reorder, remove);
    list.append(row);
  }
}

function makeOrderButton(text, label, disabled, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "shortcut-order-button";
  button.textContent = text;
  button.title = label;
  button.setAttribute("aria-label", label);
  button.disabled = disabled;
  button.addEventListener("click", onClick);
  return button;
}

function moveShortcut(id, offset) {
  const index = sidebarShortcuts.findIndex((item) => item.id === id);
  const target = index + offset;
  if (index < 0 || target < 0 || target >= sidebarShortcuts.length) return;
  [sidebarShortcuts[index], sidebarShortcuts[target]] = [sidebarShortcuts[target], sidebarShortcuts[index]];
  renderShortcuts();
  saveSettings();
}

function setupCustomSelects() {
  for (const select of Object.values(controls)) {
    if (!(select instanceof HTMLSelectElement) || select.dataset.enhanced) continue;
    const wrapper = document.createElement("div");
    wrapper.className = "custom-select";
    select.before(wrapper);
    wrapper.append(select);

    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.id = `${select.id}-trigger`;
    trigger.className = "custom-select-trigger flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm transition focus-visible:outline-none";
    trigger.setAttribute("role", "combobox");
    trigger.setAttribute("aria-haspopup", "listbox");
    trigger.setAttribute("aria-expanded", "false");
    trigger.setAttribute("aria-controls", `${select.id}-listbox`);
    const value = document.createElement("span");
    const chevron = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    chevron.setAttribute("viewBox", "0 0 20 20");
    chevron.setAttribute("aria-hidden", "true");
    chevron.classList.add("select-chevron");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", "m5 7.5 5 5 5-5");
    chevron.append(path);
    trigger.append(value, chevron);

    const listbox = document.createElement("div");
    listbox.id = `${select.id}-listbox`;
    listbox.className = "custom-select-listbox";
    listbox.setAttribute("role", "listbox");
    listbox.hidden = true;

    [...select.options].forEach((option, index) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "custom-select-option flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition";
      item.id = `${select.id}-option-${index}`;
      item.setAttribute("role", "option");
      item.dataset.value = option.value;
      item.textContent = option.textContent;
      const check = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      check.setAttribute("viewBox", "0 0 20 20");
      check.setAttribute("aria-hidden", "true");
      const checkPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
      checkPath.setAttribute("d", "m4 10 4 4 8-8");
      check.append(checkPath);
      item.append(check);
      item.addEventListener("click", () => {
        select.value = option.value;
        syncCustomSelect(select);
        select.dispatchEvent(new Event("change", { bubbles: true }));
        closeCustomSelect(wrapper, trigger);
        trigger.focus();
      });
      listbox.append(item);
    });

    const label = document.querySelector(`label[for="${select.id}"]`);
    if (label) label.htmlFor = trigger.id;
    select.classList.add("native-select-hidden");
    select.tabIndex = -1;
    select.setAttribute("aria-hidden", "true");
    select.dataset.enhanced = "true";
    wrapper.append(trigger, listbox);

    trigger.addEventListener("click", () => {
      if (listbox.hidden) openCustomSelect(wrapper, trigger, select);
      else closeCustomSelect(wrapper, trigger);
    });
    trigger.addEventListener("keydown", (event) => {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
        event.preventDefault();
        openCustomSelect(wrapper, trigger, select);
        const options = [...listbox.querySelectorAll('[role="option"]')];
        const selected = Math.max(0, options.findIndex((item) => item.dataset.value === select.value));
        options[event.key === "ArrowUp" ? Math.max(0, selected - 1) : selected]?.focus();
      }
    });
    listbox.addEventListener("keydown", (event) => {
      const items = [...listbox.querySelectorAll('[role="option"]')];
      const index = items.indexOf(document.activeElement);
      let next = index;
      if (event.key === "ArrowDown") next = Math.min(items.length - 1, index + 1);
      else if (event.key === "ArrowUp") next = Math.max(0, index - 1);
      else if (event.key === "Home") next = 0;
      else if (event.key === "End") next = items.length - 1;
      else if (event.key === "Escape") {
        event.preventDefault();
        closeCustomSelect(wrapper, trigger);
        trigger.focus();
        return;
      } else return;
      event.preventDefault();
      items[next]?.focus();
    });
    select.addEventListener("change", () => syncCustomSelect(select));
  }

  document.addEventListener("pointerdown", (event) => {
    for (const wrapper of document.querySelectorAll(".custom-select.is-open")) {
      if (!wrapper.contains(event.target)) {
        const trigger = wrapper.querySelector(".custom-select-trigger");
        closeCustomSelect(wrapper, trigger);
      }
    }
  });
}

function syncCustomSelect(select) {
  const wrapper = select.closest(".custom-select");
  if (!wrapper) return;
  const selected = select.options[select.selectedIndex];
  wrapper.querySelector(".custom-select-trigger span").textContent = selected?.textContent || "Choose an option";
  for (const option of wrapper.querySelectorAll('[role="option"]')) {
    const active = option.dataset.value === select.value;
    option.setAttribute("aria-selected", String(active));
    option.classList.toggle("is-selected", active);
  }
}

function openCustomSelect(wrapper, trigger, select) {
  for (const open of document.querySelectorAll(".custom-select.is-open")) {
    closeCustomSelect(open, open.querySelector(".custom-select-trigger"));
  }
  wrapper.classList.add("is-open");
  trigger.setAttribute("aria-expanded", "true");
  wrapper.querySelector(".custom-select-listbox").hidden = false;
  syncCustomSelect(select);
}

function closeCustomSelect(wrapper, trigger) {
  wrapper.classList.remove("is-open");
  trigger?.setAttribute("aria-expanded", "false");
  const listbox = wrapper.querySelector(".custom-select-listbox");
  if (listbox) listbox.hidden = true;
}

function renderQuickActions() {
  const list = document.querySelector("#action-list");
  list.replaceChildren();

  Object.entries(actionNames).forEach(([id, name]) => {
    const row = document.createElement("label");
    row.className = "action-option";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = quickActions.includes(id);
    checkbox.setAttribute("aria-label", `Show ${name}`);
    checkbox.addEventListener("change", () => {
      quickActions = checkbox.checked
        ? [...quickActions, id]
        : quickActions.filter((action) => action !== id);
      renderQuickActions();
      saveSettings();
    });

    const title = document.createElement("span");
    title.textContent = name;
    const index = quickActions.indexOf(id);
    const up = document.createElement("button");
    up.type = "button";
    up.textContent = "↑";
    up.title = `Move ${name} up`;
    up.disabled = index <= 0;
    up.addEventListener("click", () => moveAction(id, -1));
    const down = document.createElement("button");
    down.type = "button";
    down.textContent = "↓";
    down.title = `Move ${name} down`;
    down.disabled = index < 0 || index === quickActions.length - 1;
    down.addEventListener("click", () => moveAction(id, 1));

    row.append(checkbox, title, up, down);
    list.append(row);
  });
}

function moveAction(id, offset) {
  const index = quickActions.indexOf(id);
  const nextIndex = index + offset;
  if (index < 0 || nextIndex < 0 || nextIndex >= quickActions.length) return;
  [quickActions[index], quickActions[nextIndex]] = [quickActions[nextIndex], quickActions[index]];
  renderQuickActions();
  saveSettings();
}

function readControls() {
  return {
    theme: controls.theme.value,
    density: controls.density.value,
    reduceMotion: controls.reduceMotion.checked,
    quickActions,
    quickActionsEnabled: controls.quickActionsEnabled.checked,
    actionColor: controls.actionColor.value,
    menuColor: controls.menuColor.value,
    primaryColor: controls.primaryColor.value,
    shuffleOnOpen: controls.shuffleOnOpen.checked,
    sidebarIcons: controls.sidebarIcons.checked,
    sidebarShortcuts,
    largeProgress: controls.largeProgress.checked,
    rememberVolume: controls.rememberVolume.checked,
    commentsEnabled: controls.commentsEnabled.checked,
  };
}

async function saveSettings() {
  const settings = readControls();
  applySettings(settings);
  status.textContent = "Saving…";
  status.dataset.state = "saving";

  try {
    await storage.set(settings);
    status.textContent = "All changes saved";
    status.dataset.state = "saved";
  } catch {
    status.textContent = "Couldn’t save settings";
    status.dataset.state = "error";
  }
}

async function initialize() {
  setupCustomSelects();
  const stored = await storage.get(defaults);
  const settings = { ...defaults, ...stored };
  settings.quickActions = Array.isArray(stored.quickActions)
    ? stored.quickActions.filter((action) => Object.hasOwn(actionNames, action))
    : [...defaults.quickActions];
  const savedShortcuts = Array.isArray(stored.sidebarShortcuts) ? stored.sidebarShortcuts : [];
  const validShortcuts = savedShortcuts.filter((shortcut) => shortcut && typeof shortcut.label === "string" && typeof shortcut.path === "string" && shortcut.path.startsWith("/") && !shortcut.path.startsWith("//"));
  const savedById = new Map(validShortcuts.map((shortcut) => [shortcut.id, shortcut]));
  settings.sidebarShortcuts = [
    ...validShortcuts.map((shortcut) => ({
      ...predefinedShortcuts.find((item) => item.id === shortcut.id),
      ...shortcut,
      custom: !predefinedShortcuts.some((item) => item.id === shortcut.id),
      enabled: shortcut.enabled !== false,
    })),
    ...predefinedShortcuts.filter((shortcut) => !savedById.has(shortcut.id)),
  ];
  renderSettings(settings);

  for (const control of Object.values(controls)) {
    control.addEventListener("change", saveSettings);
  }

  document.querySelector("#shortcut-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const label = String(form.get("label") || "").trim();
    const path = String(form.get("path") || "").trim();
    if (!label || !path.startsWith("/") || path.startsWith("//")) {
      document.querySelector("#shortcut-path").setCustomValidity("Enter a path on music.youtube.com, starting with one slash.");
      document.querySelector("#shortcut-path").reportValidity();
      return;
    }
    document.querySelector("#shortcut-path").setCustomValidity("");
    sidebarShortcuts = [...sidebarShortcuts, {
      id: crypto.randomUUID(),
      label,
      path,
      icon: /download/i.test(label) ? "download" : "playlist",
      enabled: true,
      custom: true,
    }];
    renderShortcuts();
    event.currentTarget.reset();
    saveSettings();
  });

  document.querySelector("#reset-settings").addEventListener("click", async () => {
    renderSettings(defaults);
    await saveSettings();
  });

  matchMedia("(prefers-color-scheme: light)").addEventListener("change", () => {
    if (controls.theme.value === "system") applySettings(readControls());
  });
}

initialize();
