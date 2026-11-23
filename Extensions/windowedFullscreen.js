// NAME: Windowed Fullscreen
// DESCRIPTION: Spotify's full-screen button keeps the view inside the window
// and leaves the left library sidebar visible.

(function windowedFullscreen() {
  let fakeEl = null;
  const root = document.documentElement;

  // Spotify's full-screen view is the "cinema view": it spans the
  // left-sidebar..right-sidebar grid columns and slides the library sidebar
  // off-screen with a transform. Undo both while in windowed full screen.
  const style = document.createElement("style");
  style.id = "windowed-fullscreen";
  style.textContent = `
    html.windowed-fullscreen .Root__nav-bar {
      transform: none !important;
      opacity: 1 !important;
      visibility: visible !important;
    }
    html.windowed-fullscreen .Root__cinema-view {
      grid-column-start: main-view !important;
    }
  `;
  (document.head || root).appendChild(style);

  const fire = () => document.dispatchEvent(new Event("fullscreenchange"));

  // Fake the Fullscreen API so the window itself never goes full screen.
  for (const prop of ["fullscreenElement", "webkitFullscreenElement"]) {
    Object.defineProperty(Document.prototype, prop, {
      configurable: true,
      get() { return fakeEl; },
    });
  }

  Element.prototype.requestFullscreen = function () {
    fakeEl = this;
    root.classList.add("windowed-fullscreen");
    setTimeout(fire, 0);
    return Promise.resolve();
  };
  Element.prototype.webkitRequestFullscreen = Element.prototype.requestFullscreen;

  Document.prototype.exitFullscreen = function () {
    fakeEl = null;
    root.classList.remove("windowed-fullscreen");
    setTimeout(fire, 0);
    return Promise.resolve();
  };
  Document.prototype.webkitExitFullscreen = Document.prototype.exitFullscreen;

  // Real full screen is left with Esc; mimic that.
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && fakeEl) document.exitFullscreen();
  }, true);
})();
