(() => {
  if (new URLSearchParams(location.search).get("yme-sideplay") !== "1") return;
  const style = document.createElement("style");
  style.dataset.ymeSideplay = "true";
  style.textContent = `
    html, body { overflow: hidden !important; background: #030303 !important; }
    ytmusic-nav-bar, #nav-bar-background, #nav-bar-divider,
    #guide, #mini-guide, #mini-guide-background, #mini-guide-renderer,
    #content, ytmusic-player-page, ytmusic-miniplayer, #player-bar-background,
    .fullscreen-overlay, ytmusic-content-update-chip, ytmusic-network-status-banner {
      display: none !important;
    }
    ytmusic-app, ytmusic-app-layout {
      height: 100% !important;
      min-height: 0 !important;
      overflow: hidden !important;
      background: #030303 !important;
    }
    ytmusic-player-bar {
      position: fixed !important;
      inset: 0 !important;
      width: 100% !important;
      height: 100% !important;
      min-height: 100% !important;
      max-height: 100% !important;
      margin: 0 !important;
      padding: 0 !important;
      box-sizing: border-box !important;
    }
    ytmusic-player-bar { z-index: 1 !important; }
  `;
  document.documentElement.append(style);
})();
