// windowedFullscreen: keep Spotify's full-screen view inside the window
// instead of taking over the whole screen.
(function windowedFullscreen() {
  let fakeEl = null;

  const fire = (el) => {
    const ev = new Event("fullscreenchange", { bubbles: true });
    (el || document).dispatchEvent(ev);
    document.dispatchEvent(new Event("fullscreenchange"));
  };

  Object.defineProperty(Document.prototype, "fullscreenElement", {
    configurable: true,
    get() { return fakeEl; },
  });
  Object.defineProperty(Document.prototype, "webkitFullscreenElement", {
    configurable: true,
    get() { return fakeEl; },
  });

  Element.prototype.requestFullscreen = function () {
    fakeEl = this;
    document.documentElement.classList.add("windowed-fullscreen");
    setTimeout(() => fire(this), 0);
    return Promise.resolve();
  };
  Element.prototype.webkitRequestFullscreen = Element.prototype.requestFullscreen;

  Document.prototype.exitFullscreen = function () {
    const el = fakeEl;
    fakeEl = null;
    document.documentElement.classList.remove("windowed-fullscreen");
    setTimeout(() => fire(el), 0);
    return Promise.resolve();
  };
  Document.prototype.webkitExitFullscreen = Document.prototype.exitFullscreen;

  // Keep the left library sidebar visible: squeeze the full-screen overlay
  // into the space to the right of it.
  const sidebar = () =>
    document.getElementById("Desktop_LeftSidebar_Id") ||
    document.querySelector(".Root__nav-bar");

  const overlays = () => {
    const vw = innerWidth, vh = innerHeight, out = [];
    for (const el of document.body.querySelectorAll("*")) {
      const cs = getComputedStyle(el);
      if (cs.position !== "fixed" && cs.position !== "absolute") continue;
      const r = el.getBoundingClientRect();
      if (r.left <= 1 && r.top <= 1 && r.width >= vw - 2 && r.height >= vh - 2 &&
          !el.contains(sidebar()) && !el.closest("[data-wfs]")) out.push(el);
    }
    // keep only outermost matches
    return out.filter((el) => !out.some((o) => o !== el && o.contains(el)));
  };

  let squeezed = [];
  const squeeze = () => {
    const sb = sidebar();
    if (!fakeEl || !sb) return;
    const left = Math.round(sb.getBoundingClientRect().right);
    for (const el of overlays()) {
      el.dataset.wfs = "";
      squeezed.push(el);
    }
    for (const el of squeezed) {
      el.style.setProperty("left", left + "px", "important");
      el.style.setProperty("width", `calc(100vw - ${left}px)`, "important");
      el.style.setProperty("right", "auto", "important");
    }
    sb.style.setProperty("z-index", "2147483647", "important");
    sb.style.setProperty("position", "relative", "important");
  };
  const unsqueeze = () => {
    for (const el of squeezed) {
      delete el.dataset.wfs;
      ["left", "width", "right"].forEach((p) => el.style.removeProperty(p));
    }
    squeezed = [];
    const sb = sidebar();
    if (sb) ["z-index", "position"].forEach((p) => sb.style.removeProperty(p));
  };

  document.addEventListener("fullscreenchange", () => {
    if (fakeEl) {
      // overlay renders a moment after the event; retry briefly
      [50, 200, 600].forEach((t) => setTimeout(squeeze, t));
    } else unsqueeze();
  });
  addEventListener("resize", () => fakeEl && squeeze());

  // Real fullscreen would be left with Esc; mimic that.
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && fakeEl) document.exitFullscreen();
  }, true);
})();
