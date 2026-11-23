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

  // Opening: Spotify's View Transition shows the view without its colored
  // background until the transition ends, then pops it in. Skip that
  // transition and fade the live view in instead (closing keeps the CSS
  // crossfade below, which looks right).
  const origVT = document.startViewTransition?.bind(document);
  if (origVT) {
    document.startViewTransition = function (arg) {
      const kind = root.dataset.transition || "";
      const opening = /^(cinema|right-sidebar-open)/.test(kind) && !document.querySelector(CINEMA);
      if (!opening) return origVT(arg);
      const update = typeof arg === "function" ? arg : arg?.update;
      const updated = Promise.resolve().then(() => update?.()).then(() => {
        document.querySelector(CINEMA)?.animate(
          [{ opacity: 0 }, { opacity: 1 }],
          { duration: 260, easing: "ease-out" },
        );
      });
      // Spotify only shows the view's background once `finished` resolves,
      // so resolve it right away and let the fade run on its own.
      return { ready: updated, updateCallbackDone: updated, finished: updated, skipTransition() {}, types: new Set() };
    };
  }

  // Spotify's full-screen mode is its expanded Now Playing view plus a second
  // layout step (top bar hidden), which makes the view jump twice. Send the
  // full-screen buttons to the expanded view instead: one step, same view.
  const expand = () =>
    document.querySelector('button[aria-label="Expand Now Playing view"]')?.click();
  document.addEventListener("click", (e) => {
    if (!e.target.closest?.('button[aria-label="Enter Full screen"]')) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (!document.querySelector(CINEMA)) expand();
  }, true);

  // --- 2. Keep the sidebar in the cinema view -----------------------------
  // The cinema view spans the left-sidebar..right-sidebar grid columns,
  // slides the sidebar off-screen with a transform and marks it `inert`.
  const style = document.createElement("style");
  style.id = "windowed-fullscreen";
  style.textContent = `
    ${SIDEBAR} {
      transform: none !important;
      opacity: 1 !important;
      visibility: visible !important;
    }
    ${CINEMA} {
      grid-column-start: main-view !important;
    }
    /* Transitions: Spotify animates the cinema view with View Transitions
       that slide the sidebar and page away and grow the view out of the
       right-sidebar Now Playing panel. With the sidebar kept and the right
       sidebar hidden that jumps, so: keep the frame (sidebar, top bar,
       player bar) still and crossfade the rest. */
    html:is([data-transition^="cinema"], [data-transition="right-sidebar-open"])
      *:not(.Root__nav-bar, .Root__now-playing-bar, .Root__globalNav),
    html:is([data-transition^="cinema"], [data-transition="right-sidebar-open"]) *::before,
    html:is([data-transition^="cinema"], [data-transition="right-sidebar-open"]) *::after {
      view-transition-name: none !important;
    }
    html:is([data-transition^="cinema"], [data-transition="right-sidebar-open"])::view-transition-group(*) {
      animation: none !important;
    }
    html:is([data-transition^="cinema"], [data-transition="right-sidebar-open"])::view-transition-old(*) {
      animation: wfs-fade-out 220ms ease both !important;
    }
    html:is([data-transition^="cinema"], [data-transition="right-sidebar-open"])::view-transition-new(*) {
      animation: wfs-fade-in 220ms ease both !important;
    }
    html[data-transition]::view-transition-old(left-sidebar-grid),
    html[data-transition]::view-transition-old(now-playing-bar),
    html[data-transition]::view-transition-old(global-nav-bar) {
      display: none !important;
    }
    html[data-transition]::view-transition-new(left-sidebar-grid),
    html[data-transition]::view-transition-new(now-playing-bar),
    html[data-transition]::view-transition-new(global-nav-bar) {
      animation: none !important;
    }
    @keyframes wfs-fade-in { from { opacity: 0; } }
    @keyframes wfs-fade-out { to { opacity: 0; } }
    /* Idle mode (mouse not moving): Spotify fades the player bar to
       opacity 0 and shows a big track-title overlay in the view. Keep the
       player bar visible all the time and drop the overlay. */
    html.wfs-cinema .Root__now-playing-bar,
    html.wfs-cinema .Root__now-playing-bar .main-nowPlayingBar-container {
      opacity: 1 !important;
      visibility: visible !important;
    }
    html.wfs-cinema ${CINEMA} .main-trackInfo-overlay {
      display: none !important;
    }
    /* The user never wants the right sidebar (Now Playing panel, queue,
       lyrics...). The grid column is "auto", so hiding it frees the space. */
    .Root__right-sidebar {
      display: none !important;
    }
    /* --controls-hidden also slides the view down over the player bar
       (negative margin + higher z-index). */
    html.wfs-cinema ${CINEMA}.Root__cinema-view--controls-hidden {
      margin-bottom: 0 !important;
      z-index: var(--above-everything-except-now-playing-bar-z-index) !important;
      border-radius: inherit !important;
    }
  `;
  (document.head || root).appendChild(style);

  // Idle mode: after a few seconds without mouse movement Spotify adds
  // --controls-hidden, which hides the view's top controls and slides the
  // view over the player bar. Never let it switch to idle mode.
  const HIDDEN = "Root__cinema-view--controls-hidden";
  const idleObserver = new MutationObserver((records) => {
    for (const r of records) if (r.target.classList.contains(HIDDEN)) r.target.classList.remove(HIDDEN);
  });
  let watched = null;

  const sync = () => {
    const cinema = document.querySelector(CINEMA);
    const on = !!cinema;
    root.classList.toggle("wfs-cinema", on);
    if (cinema !== watched) {
      idleObserver.disconnect();
      watched = cinema;
      if (cinema) {
        cinema.classList.remove(HIDDEN);
        idleObserver.observe(cinema, { attributes: true, attributeFilter: ["class"] });
      }
    }
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

  // Minimize the expanded view (leaving fake full screen first if Spotify
  // somehow got there); retry while Spotify is still mid-transition.
  const closeCinema = () => {
    if (fakeEl) document.exitFullscreen();
    let tries = 0;
    const minimize = () => {
      if (!document.querySelector(CINEMA) || tries++ > 10) return;
      document.querySelector('button[aria-label="Minimize Now Playing view"]')?.click();
      setTimeout(minimize, 400);
    };
    minimize();
  };

  // --- 4. Auto mode ------------------------------------------------------
  // While music plays and the Spotify window is not focused, show the
  // full-screen view; leave it again when the window gets focus or playback
  // pauses. Only views opened here are closed automatically, so a view the
  // user opened by hand is left alone.
  let autoOpened = false;
  let blurTimer = null;

  const isPlaying = () => !!window.Spicetify?.Player?.isPlaying?.();
  const openAuto = () => {
    if (document.hasFocus() || !isPlaying() || document.querySelector(CINEMA)) return;
    if (!document.querySelector('button[aria-label="Expand Now Playing view"]')) return;
    expand();
    autoOpened = true;
  };
  const closeAuto = () => {
    clearTimeout(blurTimer);
    if (!autoOpened) return;
    autoOpened = false;
    if (document.querySelector(CINEMA)) closeCinema();
  };

  window.addEventListener("blur", () => {
    clearTimeout(blurTimer);
    blurTimer = setTimeout(openAuto, 1000);
  });
  window.addEventListener("focus", closeAuto);

  (function hookPlayer() {
    const player = window.Spicetify?.Player;
    if (!player?.addEventListener) return setTimeout(hookPlayer, 300);
    player.addEventListener("onplaypause", () => {
      // isPlaying() can lag the event slightly
      setTimeout(() => (isPlaying() ? openAuto() : closeAuto()), 300);
    });
  })();

  (function hookHistory() {
    const history = window.Spicetify?.Platform?.History;
    if (!history) return setTimeout(hookHistory, 300);
    history.listen(() => {
      if (Date.now() - sidebarClickAt < 1500 && document.querySelector(CINEMA)) closeCinema();
    });
  })();
})();
