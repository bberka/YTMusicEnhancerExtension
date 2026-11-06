(() => {
  const api = globalThis.browser ?? globalThis.chrome;
  const endpoints = [
    "https://music.youtube.com/youtubei/v1/next?prettyPrint=false",
    "https://www.youtube.com/youtubei/v1/next?prettyPrint=false",
  ];
  const clientVersion = "2.20261016.01.00";
  const buttons = new WeakSet();
  const state = {
    enabled: true,
    open: false,
    videoId: null,
    sort: "top",
    sortTokens: {},
    continuation: null,
    comments: [],
    loading: false,
    controller: null,
    height: 480,
    preferredEndpoint: 0,
  };

  function deepFind(root, selector, output = []) {
    if (!root) return output;
    if (root.querySelectorAll) output.push(...root.querySelectorAll(selector));
    if (root.shadowRoot) deepFind(root.shadowRoot, selector, output);
    const children = root.querySelectorAll ? root.querySelectorAll("*") : [];
    for (const child of children) if (child.shadowRoot) deepFind(child.shadowRoot, selector, output);
    return output;
  }

  function currentVideoId() {
    const pageId = new URL(location.href).searchParams.get("v");
    if (pageId) return pageId;
    for (const player of document.querySelectorAll("ytmusic-player-bar, ytmusic-miniplayer, ytmusic-player-page")) {
      const link = deepFind(player, "a[href*='watch?v=']").find((anchor) => anchor.href);
      if (!link) continue;
      const id = new URL(link.href, location.origin).searchParams.get("v");
      if (id) return id;
    }
    return null;
  }

  function makeBubbleIcon() {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", "M4 4h16v12H9l-5 4V4Zm4 5h8m-8 3h5");
    svg.append(path);
    return svg;
  }

  function addButtonToPlayer() {
    if (!state.enabled) {
      document.querySelectorAll("#yme-comments-trigger").forEach((button) => button.remove());
      return;
    }
    const players = document.querySelectorAll("ytmusic-player-bar, ytmusic-miniplayer, ytmusic-player-page");
    for (const player of players) {
      if (deepFind(player, "#yme-comments-trigger").length) continue;
      const button = document.createElement("button");
      button.id = "yme-comments-trigger";
      button.type = "button";
      button.title = "Track comments";
      button.setAttribute("aria-label", "Open comments for the playing track");
      button.append(makeBubbleIcon());
      button.addEventListener("click", toggleDrawer);
      const target = deepFind(player, "#right-controls, #right-controls-buttons, #buttons, .right-controls")[0] || player;
      target.append(button);
      if (target === player) button.dataset.floating = "true";
      const root = button.getRootNode();
      if (root?.querySelector && !root.querySelector("style[data-yme-comments-style]")) {
        const style = document.createElement("style");
        style.dataset.ymeCommentsStyle = "true";
        style.textContent = commentsButtonCss;
        if (root === document) document.head.append(style);
        else root.append(style);
      }
    }
  }

  const commentsButtonCss = `
    #yme-comments-trigger { width:40px;height:40px;display:grid;place-items:center;flex:0 0 auto;border:0;border-radius:50%;background:transparent;color:var(--yt-spec-text-primary,#fff);cursor:pointer; }
    #yme-comments-trigger:hover { background:var(--yt-spec-10-percent-layer,#ffffff1a); }
    #yme-comments-trigger svg { width:21px;height:21px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round; }
    #yme-comments-trigger[data-floating="true"] { position:fixed;z-index:999990;right:20px;bottom:86px;background:#202222;border:1px solid #444;box-shadow:0 5px 22px #0007; }
  `;

  function walk(value, visit, state = { seen: new WeakSet(), count: 0 }) {
    if (!value || typeof value !== "object" || state.seen.has(value) || state.count > 100000) return;
    state.seen.add(value);
    state.count++;
    visit(value);
    for (const child of Object.values(value)) walk(child, visit, state);
  }

  function plainText(value) {
    if (typeof value === "string") return value;
    if (typeof value?.simpleText === "string") return value.simpleText;
    if (Array.isArray(value?.runs)) return value.runs.map((run) => run?.text || "").join("");
    if (typeof value?.content === "string") return value.content;
    return "";
  }

  function continuationToken(item) {
    return item?.continuationItemRenderer?.continuationEndpoint?.continuationCommand?.token
      || item?.continuationItemRenderer?.button?.buttonRenderer?.command?.continuationCommand?.token
      || null;
  }

  function parseComments(json) {
    const entities = new Map();
    for (const mutation of json?.frameworkUpdates?.entityBatchUpdate?.mutations || []) {
      const entity = mutation?.payload?.commentEntityPayload;
      if (entity?.properties?.commentId) entities.set(entity.properties.commentId, entity);
    }

    const threads = [];
    const headers = [];
    const continuations = [];
    const replies = [];
    walk(json, (node) => {
      if (node.commentThreadRenderer) threads.push(node.commentThreadRenderer);
      if (node.commentsHeaderRenderer) headers.push(node.commentsHeaderRenderer);
      if (node.continuationItemRenderer) continuations.push(node);
      if (node.commentViewModel && !node.commentThreadRenderer) replies.push(node.commentViewModel);
    });

    const items = [];
    const seen = new Set();
    for (const thread of threads) {
      const view = thread?.commentViewModel?.commentViewModel || thread?.commentViewModel || {};
      const id = view.commentId;
      const entity = entities.get(id);
      const properties = entity?.properties || {};
      const content = plainText(properties.content || view.content || view.contentText);
      if (!id || !content || seen.has(id)) continue;
      seen.add(id);
      const author = entity?.author || properties.author || view.author || {};
      const replyContents = thread?.replies?.commentRepliesRenderer?.contents || [];
      items.push({
        id,
        text: content,
        author: plainText(author.displayName || author.name),
        avatar: author.avatarThumbnailUrl || author.avatar?.thumbnails?.at(-1)?.url || null,
        published: properties.publishedTime || view.publishedTime || "",
        pinned: plainText(view.pinnedText),
        creator: Boolean(author.isCreator),
        verified: Boolean(author.isVerified),
        artist: Boolean(author.isArtist),
        replyCount: plainText(entity?.toolbar?.replyCount),
        replyToken: replyContents.map(continuationToken).find(Boolean) || null,
      });
    }

    for (const view of replies) {
      const id = view.commentViewModel?.commentId || view.commentId;
      const entity = entities.get(id);
      const properties = entity?.properties || {};
      const text = plainText(properties.content || view.content);
      if (!id || !text || seen.has(id)) continue;
      seen.add(id);
      const author = entity?.author || properties.author || view.author || {};
      items.push({ id, text, author: plainText(author.displayName || author.name), avatar: author.avatarThumbnailUrl || null, published: properties.publishedTime || "", replyToken: null });
    }

    const sortTokens = { top: null, newest: null };
    let totalCount = "";
    for (const header of headers) {
      const sortItems = header?.sortMenu?.sortFilterSubMenuRenderer?.subMenuItems || [];
      for (const item of sortItems) {
        const label = plainText(item.title || item.titleText).toLowerCase();
        const token = item?.serviceEndpoint?.continuationCommand?.token;
        if (label.includes("newest")) sortTokens.newest = token;
        else if (label.includes("top")) sortTokens.top = token;
      }
      totalCount = plainText(header.countText || header.commentsCount) || totalCount;
    }
    const nextPage = continuations.map(continuationToken).find(Boolean) || null;
    return { items, sortTokens, nextPage, totalCount };
  }

  function localeContext() {
    const parts = (document.documentElement.lang || navigator.language || "en-US").split(/[-_]/);
    return { hl: parts[0] || "en", gl: (parts[1] || "US").toUpperCase() };
  }

  async function postNext(body, signal) {
    let error;
    for (let offset = 0; offset < endpoints.length; offset++) {
      const index = (state.preferredEndpoint + offset) % endpoints.length;
      try {
        const response = await fetch(endpoints[index], {
          method: "POST",
          credentials: "omit",
          signal,
          headers: {
            "content-type": "application/json",
            "x-youtube-client-name": "1",
            "x-youtube-client-version": clientVersion,
          },
          body: JSON.stringify({
            context: { client: { clientName: "WEB", clientVersion, ...localeContext() } },
            ...body,
          }),
        });
        if (!response.ok) throw new Error(`YouTube returned ${response.status}`);
        const json = await response.json();
        if (!json?.contents && !json?.onResponseReceivedEndpoints && !json?.frameworkUpdates) throw new Error("Unexpected comments response");
        state.preferredEndpoint = index;
        return json;
      } catch (cause) {
        if (cause?.name === "AbortError") throw cause;
        error = cause;
      }
    }
    throw error || new Error("Could not load comments");
  }

  function createDrawer() {
    let drawer = document.querySelector("#yme-comments-drawer");
    if (drawer) return drawer;
    drawer = document.createElement("aside");
    drawer.id = "yme-comments-drawer";
    drawer.setAttribute("role", "dialog");
    drawer.setAttribute("aria-label", "Track comments");
    drawer.setAttribute("aria-modal", "false");
    drawer.style.height = `${state.height}px`;
    const resize = document.createElement("div");
    resize.className = "yme-comments-resize";
    resize.setAttribute("role", "separator");
    resize.setAttribute("aria-label", "Resize comments drawer");
    const header = document.createElement("header");
    header.className = "yme-comments-header";
    const title = document.createElement("div");
    title.innerHTML = "<strong>Comments</strong><span class='yme-comments-count'></span>";
    const sort = document.createElement("div");
    sort.className = "yme-comments-sort";
    for (const value of ["top", "newest"]) {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.sort = value;
      button.textContent = value === "top" ? "Top" : "Newest";
      button.addEventListener("click", () => changeSort(value));
      sort.append(button);
    }
    const close = document.createElement("button");
    close.type = "button";
    close.className = "yme-comments-close";
    close.setAttribute("aria-label", "Close comments");
    close.textContent = "×";
    close.addEventListener("click", closeDrawer);
    header.append(title, sort, close);
    const list = document.createElement("div");
    list.className = "yme-comments-list";
    list.addEventListener("scroll", () => {
      if (list.scrollTop + list.clientHeight >= list.scrollHeight - 220) loadMore();
    }, { passive: true });
    drawer.append(resize, header, list);
    document.body.append(drawer);
    bindResize(drawer, resize);
    return drawer;
  }

  function bindResize(drawer, handle) {
    handle.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      handle.setPointerCapture(event.pointerId);
      const start = event.clientY;
      const initial = drawer.getBoundingClientRect().height;
      const move = (moveEvent) => {
        state.height = Math.max(260, Math.min(window.innerHeight - 60, initial + start - moveEvent.clientY));
        drawer.style.height = `${state.height}px`;
      };
      const up = () => {
        handle.removeEventListener("pointermove", move);
        handle.removeEventListener("pointerup", up);
        api.storage.local.set({ ymeCommentsHeight: state.height });
      };
      handle.addEventListener("pointermove", move);
      handle.addEventListener("pointerup", up, { once: true });
    });
  }

  function setDrawerMessage(message, isError = false) {
    const list = document.querySelector("#yme-comments-drawer .yme-comments-list");
    if (!list) return;
    list.replaceChildren();
    const note = document.createElement("p");
    note.className = isError ? "yme-comments-error" : "yme-comments-message";
    note.textContent = message;
    list.append(note);
  }

  function appendComment(parent, comment, isReply = false) {
    const card = document.createElement("article");
    card.className = `yme-comment${isReply ? " yme-comment-reply" : ""}`;
    if (comment.avatar) {
      const image = document.createElement("img");
      image.className = "yme-comment-avatar";
      image.src = comment.avatar;
      image.alt = "";
      image.loading = "lazy";
      card.append(image);
    } else {
      const spacer = document.createElement("span");
      spacer.className = "yme-comment-avatar-placeholder";
      card.append(spacer);
    }
    const content = document.createElement("div");
    content.className = "yme-comment-content";
    const meta = document.createElement("div");
    meta.className = "yme-comment-meta";
    const author = document.createElement("strong");
    author.textContent = comment.author || "YouTube user";
    meta.append(author);
    if (comment.creator) meta.append(makeBadge("Creator"));
    if (comment.verified) meta.append(makeBadge("Verified"));
    if (comment.artist) meta.append(makeBadge("Artist"));
    if (comment.published) {
      const date = document.createElement("span");
      date.textContent = comment.published;
      meta.append(date);
    }
    if (comment.pinned) {
      const pinned = document.createElement("span");
      pinned.className = "yme-comment-pinned";
      pinned.textContent = "Pinned";
      content.append(pinned);
    }
    const body = document.createElement("p");
    body.className = "yme-comment-text";
    const text = comment.text || "";
    body.textContent = text.length > 600 ? `${text.slice(0, 600)}…` : text;
    content.append(meta, body);
    if (text.length > 600) {
      const more = document.createElement("button");
      more.type = "button";
      more.className = "yme-comment-read-more";
      more.textContent = "Read more";
      more.addEventListener("click", () => {
        body.textContent = text;
        more.remove();
      }, { once: true });
      content.append(more);
    }
    if (comment.replyToken && comment.replyCount) {
      const replies = document.createElement("button");
      replies.type = "button";
      replies.className = "yme-comment-replies";
      replies.textContent = `View ${comment.replyCount} replies`;
      replies.addEventListener("click", () => loadReplies(comment.replyToken, content, replies), { once: true });
      content.append(replies);
    }
    card.append(content);
    parent.append(card);
  }

  function makeBadge(text) {
    const badge = document.createElement("span");
    badge.className = "yme-comment-badge";
    badge.textContent = text;
    return badge;
  }

  function renderComments(comments, append = false) {
    const drawer = createDrawer();
    const list = drawer.querySelector(".yme-comments-list");
    if (!append) list.replaceChildren();
    for (const comment of comments) appendComment(list, comment);
    const count = drawer.querySelector(".yme-comments-count");
    count.textContent = state.totalCount ? ` · ${state.totalCount}` : "";
    for (const button of drawer.querySelectorAll(".yme-comments-sort button")) {
      button.setAttribute("aria-pressed", String(button.dataset.sort === state.sort));
    }
    if (!comments.length && !append) setDrawerMessage("No comments found for this track.");
  }

  async function loadInitial() {
    if (!state.videoId) {
      setDrawerMessage("Play a track with a YouTube video to view its comments.", true);
      return;
    }
    state.controller?.abort();
    state.controller = new AbortController();
    state.loading = true;
    state.comments = [];
    state.continuation = null;
    setDrawerMessage("Loading comments…");
    try {
      const first = parseComments(await postNext({ videoId: state.videoId }, state.controller.signal));
      state.sortTokens = first.sortTokens;
      state.totalCount = first.totalCount;
      const token = first.sortTokens[state.sort] || first.nextPage;
      if (first.items.length) state.comments = first.items;
      if (token) {
        const page = parseComments(await postNext({ continuation: token }, state.controller.signal));
        state.comments = page.items;
        state.continuation = page.nextPage;
        state.totalCount = page.totalCount || state.totalCount;
      }
      renderComments(state.comments);
    } catch (error) {
      if (error?.name !== "AbortError") setDrawerMessage("Couldn’t load comments. YouTube may have changed its comments service.", true);
    } finally {
      state.loading = false;
    }
  }

  async function loadMore() {
    if (state.loading || !state.continuation || !state.open) return;
    state.loading = true;
    try {
      const page = parseComments(await postNext({ continuation: state.continuation }, state.controller?.signal));
      state.continuation = page.nextPage;
      state.comments.push(...page.items);
      renderComments(page.items, true);
    } catch (error) {
      if (error?.name !== "AbortError") state.continuation = null;
    } finally {
      state.loading = false;
    }
  }

  async function loadReplies(token, parent, button) {
    button.textContent = "Loading replies…";
    try {
      const page = parseComments(await postNext({ continuation: token }, state.controller?.signal));
      const group = document.createElement("div");
      group.className = "yme-comment-reply-list";
      for (const reply of page.items) appendComment(group, reply, true);
      parent.append(group);
      button.remove();
    } catch {
      button.textContent = "Couldn’t load replies";
    }
  }

  async function changeSort(sort) {
    if (state.sort === sort || !state.open) return;
    state.sort = sort;
    await loadInitial();
  }

  function openDrawer() {
    const drawer = createDrawer();
    drawer.style.height = `${state.height}px`;
    requestAnimationFrame(() => drawer.classList.add("is-open"));
    state.open = true;
    state.videoId = currentVideoId();
    loadInitial();
    document.addEventListener("keydown", onEscape);
  }

  function closeDrawer() {
    const drawer = document.querySelector("#yme-comments-drawer");
    state.controller?.abort();
    state.open = false;
    drawer?.classList.remove("is-open");
    document.removeEventListener("keydown", onEscape);
  }

  function onEscape(event) {
    if (event.key === "Escape" && state.open) closeDrawer();
  }

  function toggleDrawer() {
    if (state.open) closeDrawer();
    else openDrawer();
  }

  async function syncCurrentTrack() {
    if (!state.open) return;
    const id = currentVideoId();
    if (!id || id === state.videoId) return;
    state.videoId = id;
    state.sort = "top";
    await loadInitial();
  }

  function installPlayerObservers() {
    addButtonToPlayer();
    for (const player of document.querySelectorAll("ytmusic-player-bar, ytmusic-miniplayer, ytmusic-player-page")) {
      if (player.dataset.ymeCommentsObserved) continue;
      player.dataset.ymeCommentsObserved = "true";
      new MutationObserver(syncCurrentTrack).observe(player, { childList: true, characterData: true, subtree: true });
    }
  }

  function init() {
    Promise.all([
      api.storage.local.get({ commentsEnabled: true }),
      api.storage.local.get("ymeCommentsHeight"),
    ]).then(([settings, stored]) => {
      state.enabled = settings.commentsEnabled !== false;
      state.height = Math.max(260, Math.min(window.innerHeight - 60, Number(stored.ymeCommentsHeight) || 480));
      installPlayerObservers();
      new MutationObserver(installPlayerObservers).observe(document.documentElement, { childList: true, subtree: true });
    });
    api.storage.onChanged.addListener((changes, area) => {
      if (area !== "local" || !changes.commentsEnabled) return;
      state.enabled = changes.commentsEnabled.newValue !== false;
      installPlayerObservers();
      if (!state.enabled) closeDrawer();
    });
    addEventListener("popstate", syncCurrentTrack, { passive: true });
  }

  init();
})();
