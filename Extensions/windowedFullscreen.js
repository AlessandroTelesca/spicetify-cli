// NAME: Windowed Fullscreen
// DESCRIPTION: Spotify's full-screen button keeps the view inside the window,
// and the expanded Now Playing view keeps the left library sidebar usable.

(function windowedFullscreen() {
  const root = document.documentElement;
  const SIDEBAR = ".Root__nav-bar";
  const CINEMA = ".Root__cinema-view";

  // --- 1. Never go real full screen --------------------------------------
  // The full-screen button opens the expanded Now Playing view ("cinema
  // view") and asks for full screen. Fake the Fullscreen API so the cinema
  // view stays inside the window.
  let fakeEl = null;
  const fire = () => document.dispatchEvent(new Event("fullscreenchange"));

  for (const prop of ["fullscreenElement", "webkitFullscreenElement"]) {
    Object.defineProperty(Document.prototype, prop, {
      configurable: true,
      get() { return fakeEl; },
    });
  }
  Element.prototype.requestFullscreen = function () {
    fakeEl = this;
    setTimeout(fire, 0);
    return Promise.resolve();
  };
  Element.prototype.webkitRequestFullscreen = Element.prototype.requestFullscreen;
  Document.prototype.exitFullscreen = function () {
    fakeEl = null;
    setTimeout(fire, 0);
    return Promise.resolve();
  };
  Document.prototype.webkitExitFullscreen = Document.prototype.exitFullscreen;

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && fakeEl) document.exitFullscreen();
  }, true);

  // --- 2. Keep the sidebar in the cinema view -----------------------------
  // The cinema view spans the left-sidebar..right-sidebar grid columns,
  // slides the sidebar off-screen with a transform and marks it `inert`.
  const style = document.createElement("style");
  style.id = "windowed-fullscreen";
  style.textContent = `
    html.wfs-cinema ${SIDEBAR} {
      transform: none !important;
      opacity: 1 !important;
      visibility: visible !important;
    }
    html.wfs-cinema ${CINEMA} {
      grid-column-start: main-view !important;
    }
  `;
  (document.head || root).appendChild(style);

  const sync = () => {
    const on = !!document.querySelector(CINEMA);
    root.classList.toggle("wfs-cinema", on);
    if (!on) return;
    for (const el of document.querySelectorAll(`${SIDEBAR}[inert], [inert]:has(${SIDEBAR})`)) {
      el.inert = false;
      el.removeAttribute("inert");
    }
  };
  new MutationObserver(sync).observe(root, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["inert"],
  });
  sync();

  // --- 3. Opening something from the sidebar leaves the cinema view -------
  // Spotify would navigate inside the cinema view and leave a broken layout.
  let sidebarClickAt = 0;
  document.addEventListener("click", (e) => {
    if (e.target.closest?.(SIDEBAR)) sidebarClickAt = Date.now();
  }, true);

  const closeCinema = () => {
    if (fakeEl) document.exitFullscreen();
    document.querySelector('button[aria-label="Minimize Now Playing view"]')?.click();
  };

  (function hookHistory() {
    const history = window.Spicetify?.Platform?.History;
    if (!history) return setTimeout(hookHistory, 300);
    history.listen(() => {
      if (Date.now() - sidebarClickAt < 1500 && document.querySelector(CINEMA)) closeCinema();
    });
  })();
})();
