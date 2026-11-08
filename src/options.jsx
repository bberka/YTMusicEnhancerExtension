import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { ArrowDown, ArrowUp, Check, Compass, Disc3, Download, Home, Library, ListMusic, Loader2, Mic2, Music2, Plus, Radio, Settings2, Trash2, Users, Palette, PanelLeft, SlidersHorizontal, CircleHelp, Search, X, ThumbsUp, PanelRightOpen, ListPlus, SkipForward, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { defaults, actionNames, normalizeSettings, storage, validPath } from "./settings";
import "./options.css";

const icons = { home: Home, explore: Compass, library: Library, playlist: ListMusic, download: Download, song: Music2, album: Disc3, artist: Mic2, profile: Users, podcast: Radio };
const actionIcons = { like: ThumbsUp, preview: PanelRightOpen, remove: Trash2, queue: ListPlus, addPlaylist: ListMusic, radio: Radio, artist: Mic2, album: Disc3, share: Share2 };
const sectionIcons = { appearance: Palette, playlist: ListMusic, navigation: PanelLeft, player: SlidersHorizontal, help: CircleHelp };
const colors = [["match", "Match player"], ["red", "Red"], ["blue", "Blue"], ["green", "Green"], ["purple", "Purple"], ["plain", "Neutral"]];

function searchableText(node) {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(searchableText).join(" ");
  if (!React.isValidElement(node)) return "";
  const { title, description, children, choices, label } = node.props;
  return [title, description, label, searchableText(children), searchableText(choices)].filter(Boolean).join(" ");
}

function matchesSearch(text, query) {
  const value = text.toLocaleLowerCase();
  return query.trim().toLocaleLowerCase().split(/\s+/).every((term) => value.includes(term));
}

function Section({ id, title, description, children, query = "" }) {
  const visibleChildren = matchesSearch(`${title} ${description}`, query) ? children
    : React.Children.toArray(children).filter((child) => matchesSearch(searchableText(child), query));
  return <section aria-labelledby={`${id}-title`} className="scroll-mt-20 rounded-xl border bg-card p-5 sm:p-6">
    <h2 id={`${id}-title`} className="text-base font-semibold tracking-tight">{title}</h2>
    <p className="mt-1 mb-3 text-sm leading-relaxed text-muted-foreground">{description}</p>
    <div className="divide-y divide-border">{visibleChildren}</div>
  </section>;
}

function Row({ id, title, description, children, stacked = false }) {
  return <div className={`setting-row flex gap-5 py-4 ${stacked ? "flex-col" : "items-center justify-between"}`}>
    <div className="min-w-0">
      <label htmlFor={id} className="text-sm font-medium">{title}</label>
      {description && <p className="mt-1 max-w-prose text-xs leading-relaxed text-muted-foreground">{description}</p>}
    </div>
    {children}
  </div>;
}

function PreferenceSelect({ id, value, choices, onChange }) {
  return <Select value={value} onValueChange={onChange}>
    <SelectTrigger id={id} className="w-36 shrink-0 text-xs sm:w-40"><SelectValue /></SelectTrigger>
    <SelectContent position="popper">{choices.map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}</SelectContent>
  </Select>;
}

function OrderButtons({ label, index, length, move }) {
  return <div className="flex shrink-0 gap-1">
    <Button type="button" variant="ghost" size="icon" className="size-8" aria-label={`Move ${label} up`} disabled={index === 0} onClick={() => move(-1)}><ArrowUp className="size-4" /></Button>
    <Button type="button" variant="ghost" size="icon" className="size-8" aria-label={`Move ${label} down`} disabled={index === length - 1} onClick={() => move(1)}><ArrowDown className="size-4" /></Button>
  </div>;
}

function reordered(items, index, offset) {
  const next = [...items];
  const target = index + offset;
  if (index < 0 || target < 0 || target >= items.length) return next;
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

function App() {
  const [settings, setSettings] = useState(null);
  const current = useRef(null);
  const writes = useRef(Promise.resolve());
  const revision = useRef(0);
  const [status, setStatus] = useState("Loading settings…");
  const [saveState, setSaveState] = useState("loading");
  const [formError, setFormError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    let active = true;
    storage.get().then((stored) => {
      if (!active) return;
      const value = normalizeSettings(stored);
      current.current = value;
      setSettings(value);
      setStatus("All changes saved"); setSaveState("saved");
    }).catch(() => { if (active) setLoadError("Could not load settings. Reload this page to try again."); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!settings) return;
    const media = matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      document.documentElement.classList.toggle("dark", settings.theme === "dark" || (settings.theme === "system" && media.matches));
      document.documentElement.dataset.theme = document.documentElement.classList.contains("dark") ? "dark" : "light";
    };
    apply(); media.addEventListener("change", apply);
    document.documentElement.dataset.theme = document.documentElement.classList.contains("dark") ? "dark" : "light";
    return () => media.removeEventListener("change", apply);
  }, [settings?.theme]);

  function update(patch) {
    const value = { ...current.current, ...patch };
    current.current = value; setSettings(value);
    const version = ++revision.current;
    setStatus("Saving…"); setSaveState("saving");
    writes.current = writes.current.catch(() => {}).then(() => storage.set(value)).then(() => {
      if (version === revision.current) { setStatus("All changes saved"); setSaveState("saved"); }
    }).catch(() => {
      if (version === revision.current) { setStatus("Could not save. Change a setting to retry."); setSaveState("error"); }
    });
  }

  function toggle(key, id, title, description) {
    return <Row id={id} title={title} description={description}><Switch id={id} checked={settings[key]} onCheckedChange={(value) => update({ [key]: value })} /></Row>;
  }

  function addShortcut(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const label = String(data.get("label") || "").trim();
    const path = String(data.get("path") || "").trim();
    if (!label || !validPath(path)) { setFormError("Enter a name and a YouTube Music path starting with one slash."); return; }
    update({ sidebarShortcuts: [...settings.sidebarShortcuts, { id: crypto.randomUUID(), label, path, icon: "playlist", custom: true, enabled: true }] });
    setFormError(""); form.reset();
  }

  if (loadError) return <main className="mx-auto max-w-xl p-8" role="alert">{loadError}</main>;
  if (!settings) return <main className="flex min-h-screen items-center justify-center gap-2 text-sm text-muted-foreground" role="status"><Loader2 className="size-4 animate-spin" />Loading settings…</main>;
  const actionOrder = [...settings.quickActions, ...Object.keys(actionNames).filter((id) => !settings.quickActions.includes(id))];

  const panels = <>
          <Section id="appearance" title="Appearance" description="Choose the appearance of this settings page.">
            <Row id="theme-trigger" title="Theme" description="Follow your system, or choose a fixed theme."><PreferenceSelect id="theme-trigger" value={settings.theme} choices={[["system", "System"], ["light", "Light"], ["dark", "Dark"]]} onChange={(theme) => update({ theme })} /></Row>
          </Section>
          <Section id="playlist" title="Playlists" description="Choose the song row buttons available beside playlist tracks.">
            {toggle("quickActionsEnabled", "quick-actions-enabled", "Song row actions", "Show action buttons beside songs in playlists. Choose and reorder them below.")}
            <div className="py-4">
              <h3 className="text-sm font-medium">Choose song row buttons</h3>
              <p className="mt-1 mb-3 text-xs text-muted-foreground">Show or hide each button and use the arrows to change its order. The original three-dot menu stays available.</p>
              <fieldset disabled={!settings.quickActionsEnabled} className="space-y-1 disabled:opacity-50">
                <legend className="sr-only">Enabled actions and display order</legend>
                {actionOrder.map((id) => {
                  const index = settings.quickActions.indexOf(id);
                  const Icon = actionIcons[id];
                  return <div key={id} className="flex items-center gap-3 rounded-md px-2 py-1">
                    <Checkbox id={`action-${id}`} aria-label={`Show ${actionNames[id]}`} checked={index >= 0} onCheckedChange={(enabled) => update({ quickActions: enabled ? [...settings.quickActions, id] : settings.quickActions.filter((value) => value !== id) })} />
                    <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <label htmlFor={`action-${id}`} className="min-w-0 flex-1 text-sm">{actionNames[id]}</label>
                    {index >= 0 && <OrderButtons label={actionNames[id]} index={index} length={settings.quickActions.length} move={(offset) => update({ quickActions: reordered(settings.quickActions, index, offset) })} />}
                  </div>;
                })}
              </fieldset>
              <p className="mt-3 text-xs text-muted-foreground">Side play is experimental and may be blocked by YouTube.</p>
            </div>
            <Row id="action-color-trigger" title="Button color" description="Color used for playlist quick actions."><PreferenceSelect id="action-color-trigger" value={settings.actionColor} choices={colors} onChange={(actionColor) => update({ actionColor })} /></Row>
            <Row id="menu-color-trigger" title="Context menu color" description="Highlight color for track menu items."><PreferenceSelect id="menu-color-trigger" value={settings.menuColor} choices={colors} onChange={(menuColor) => update({ menuColor })} /></Row>
          </Section>
          <Section id="navigation" title="Navigation" description="Manage destinations in the full sidebar and compact rail.">
            <Row id="sidebar-width" title="Sidebar width" description="Resize the expanded sidebar. 100% is YouTube Music’s default width." stacked>
              <div className="flex w-full max-w-sm items-center gap-4">
                <input id="sidebar-width" type="range" min="75" max="150" step="5" value={settings.sidebarWidth} onChange={(event) => update({ sidebarWidth: Number(event.target.value) })} className="w-full accent-primary" />
                <output htmlFor="sidebar-width" className="w-12 shrink-0 text-right text-sm tabular-nums">{settings.sidebarWidth}%</output>
              </div>
            </Row>
            {toggle("compactSidebar", "compact-sidebar", "Compact top navigation", "Use shorter navigation rows and slightly smaller icons.")}
            {toggle("sidebarIcons", "sidebar-icons", "Playlist icons", "Show artwork or a fallback icon beside playlists in the lower sidebar. Top shortcuts always have icons.")}
            {toggle("compactLibrary", "compact-library", "Quiet playlist sidebar", "Hide owners and Auto playlist subtitles.")}
            {toggle("compactPlaylistSidebar", "compact-playlist-sidebar", "Compact playlist sidebar", "Use shorter playlist rows and smaller artwork.")}
            {toggle("hideNewPlaylist", "hide-new-playlist", "Hide New playlist button", "Remove the New playlist button from the sidebar.")}
            <div className="py-4">
              <h3 className="text-sm font-medium">Sidebar shortcuts</h3>
              <p className="mt-1 mb-4 text-xs text-muted-foreground">Choose what appears and use the arrows to set its order.</p>
              <div id="shortcut-list" className="space-y-1">
                {settings.sidebarShortcuts.map((item, index) => {
                  const Icon = icons[item.icon] || ListMusic;
                  return <div key={item.id} data-shortcut-row={item.id} className="flex min-w-0 items-center gap-2 rounded-lg px-1 py-1.5 sm:gap-3">
                    <Checkbox id={`shortcut-${item.id}`} aria-label={`Show ${item.label} in the sidebar`} checked={item.enabled} onCheckedChange={(enabled) => update({ sidebarShortcuts: settings.sidebarShortcuts.map((value) => value.id === item.id ? { ...value, enabled } : value) })} />
                    <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <div className="min-w-0 flex-1"><label htmlFor={`shortcut-${item.id}`} className="block truncate text-sm font-medium" title={item.label}>{item.label}</label><span className="block truncate text-xs text-muted-foreground">{item.path}</span></div>
                    <OrderButtons label={item.label} index={index} length={settings.sidebarShortcuts.length} move={(offset) => update({ sidebarShortcuts: reordered(settings.sidebarShortcuts, index, offset) })} />
                    {item.custom ? <Button size="icon" variant="ghost" className="size-8" aria-label={`Remove ${item.label} shortcut`} onClick={() => update({ sidebarShortcuts: settings.sidebarShortcuts.filter((value) => value.id !== item.id) })}><Trash2 className="size-4" /></Button> : <span className="hidden size-8 shrink-0 sm:block" />}
                  </div>;
                })}
              </div>
              <form onSubmit={addShortcut} className="mt-5 grid gap-3 sm:grid-cols-[1fr_1.5fr_auto] sm:items-end">
                <div><label htmlFor="shortcut-label" className="mb-1.5 block text-xs font-medium">Name</label><Input id="shortcut-label" name="label" placeholder="My playlist" maxLength={40} required /></div>
                <div><label htmlFor="shortcut-path" className="mb-1.5 block text-xs font-medium">YouTube Music path</label><Input id="shortcut-path" name="path" placeholder="/playlist?list=…" required aria-describedby="shortcut-hint" /></div>
                <Button type="submit" variant="secondary"><Plus className="size-4" />Add</Button>
              </form>
              <p id="shortcut-hint" className="mt-2 text-xs text-muted-foreground">Use a path on music.youtube.com, starting with /.</p>
              {formError && <p role="alert" className="mt-2 text-xs text-destructive">{formError}</p>}
            </div>
          </Section>
          <Section id="player" title="Player" description="Make playback controls easier to use.">
            {toggle("largeProgress", "large-progress", "Larger player bar", "Enlarge playback buttons, like/dislike, artwork, and the seek bar.")}
            <Row id="player-position" title="Player bar position" description="Choose where playback controls appear."><PreferenceSelect id="player-position" value={settings.playerPosition} choices={[["bottom", "Bottom"], ["top", "Top"]]} onChange={(playerPosition) => update({ playerPosition })} /></Row>
            {toggle("rememberVolume", "remember-volume", "Remember volume", "Restore your last volume when YouTube Music opens.")}
          </Section>
          <Section id="help" title="Help" description="Find usage guidance and troubleshooting tips.">
            <p className="py-4 text-sm"><a href="help.html" className="underline underline-offset-4">Open the help guide</a></p>
          </Section>
  </>;
  const visiblePanels = React.Children.toArray(panels.props.children).filter((panel) =>
    matchesSearch(`${panel.props.title} ${panel.props.description}`, query)
      || React.Children.toArray(panel.props.children).some((child) => matchesSearch(searchableText(child), query)));

  return <>
    <header className="border-b bg-card">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5 sm:px-8">
        <a href="#main" className="flex items-center gap-2.5 text-sm font-semibold"><span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground"><Music2 className="size-4" /></span>Music Enhancer</a>
        <span id="save-status" role="status" aria-live="polite" data-state={saveState} className="flex items-center gap-2 text-xs text-muted-foreground">{saveState === "saving" ? <Loader2 className="size-3.5 animate-spin" /> : saveState === "saved" ? <Check className="size-3.5" /> : null}{status}</span>
      </div>
    </header>
    <main id="main" className="mx-auto max-w-6xl px-4 py-8 sm:px-8 sm:py-10">
      <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
      <p className="mt-2 mb-5 text-sm text-muted-foreground">Your YouTube Music preferences. Changes save automatically.</p>
      <div role="search" className="relative mb-8 w-full">
        <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input type="text" role="searchbox" enterKeyHint="search" aria-label="Search settings" placeholder="Search settings…" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Escape") setQuery(""); }} className="pl-9 pr-10" />
        {query && <Button type="button" variant="ghost" size="icon" aria-label="Clear search" className="absolute right-1 top-1/2 size-7 -translate-y-1/2" onClick={() => setQuery("")}><X className="size-4" /></Button>}
      </div>
      <div className="grid items-start gap-7 md:grid-cols-[160px_minmax(0,1fr)] lg:gap-10">
        <nav aria-label="Settings sections" className="sticky top-0 z-10 flex gap-1 overflow-x-auto bg-background py-2 md:top-6 md:flex-col md:py-0">
          {visiblePanels.map(({ props: { id, title } }) => {
            const Icon = sectionIcons[id];
            return <a key={id} href={`#${id}-title`} className="flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"><Icon aria-hidden="true" className="size-4 shrink-0" />{title}</a>;
          })}
        </nav>
        <div className="min-w-0 space-y-5">
          {visiblePanels.map((panel) => React.cloneElement(panel, { query }))}
          {!visiblePanels.length && <p role="status" className="py-8 text-sm text-muted-foreground">No settings match “{query}”. Try another search or clear the search.</p>}
          <footer className="flex items-center justify-between gap-4 py-3 text-xs text-muted-foreground">
            <span>Music Enhancer 0.1.0</span>
            <AlertDialog><AlertDialogTrigger asChild><Button variant="ghost" size="sm" id="reset-settings"><Settings2 className="size-3.5" />Reset settings</Button></AlertDialogTrigger>
              <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Reset all settings?</AlertDialogTitle><AlertDialogDescription>This restores default preferences and removes custom sidebar shortcuts. Your YouTube playlists are not changed.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => update(structuredClone(defaults))}>Reset settings</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
            </AlertDialog>
          </footer>
        </div>
      </div>
    </main>
  </>;
}

createRoot(document.getElementById("root")).render(<App />);
