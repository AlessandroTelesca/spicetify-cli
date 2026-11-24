// NAME: Hide Announcements
// DESCRIPTION: Hides the "Announcement" promo banner (Spotify's home ad card)
// at the top of the Home page, without leaving a gap.

(function hideAnnouncements() {
  // --- 1. CSS (main path) ------------------------------------------------
  // Spotify renders the banner from its lazy "home-ads-container" chunk as
  //   <div data-testid="home-ads-container"><div data-testid="home-ad-card">…
  // directly above the Home page content. Hiding both by their test ids
  // removes it before it paints (no flash) and takes no layout space.
  const style = document.createElement("style");
  style.id = "hide-announcements";
  style.textContent = `
    [data-testid="home-ads-container"],
    [data-testid="home-ad-card"] { display: none !important; }
  `;
  (document.head || document.documentElement).appendChild(style);

  // --- 2. Fallback -------------------------------------------------------
  // In case Spotify renames the test ids: find the localized "Announcement"
  // label on Home and hide the block it sits in. Only blocks that are
  // siblings of the Home page section (i.e. above it, in the same wrapper)
  // are ever hidden, so normal shelves can't be hit.
  const HOME = '[data-testid="home-page"]';
  const HIDDEN = "data-hide-announcement";

  function labels() {
    const out = new Set(["Announcement", "Ankündigung"]);
    try {
      const t = window.Spicetify?.Locale?.get?.("ad-formats.announcement");
      if (typeof t === "string" && t && !t.includes("ad-formats")) out.add(t);
    } catch {}
    return out;
  }

  function scan() {
    const home = document.querySelector(HOME);
    const wrap = home?.parentElement;
    if (!wrap) return;
    const want = labels();
    for (const block of wrap.children) {
      if (block === home || block.hasAttribute(HIDDEN)) continue;
      if (block.matches(".main-home-homeHeader, .main-home-filterChipsContainer")) continue;
      // Leaf elements whose whole text is the label.
      const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        if (want.has(n.nodeValue.trim())) {
          block.setAttribute(HIDDEN, "");
          block.style.setProperty("display", "none", "important");
          break;
        }
      }
    }
  }

  // Cheap observer: coalesce bursts of mutations into one scan per frame,
  // and only scan while Home is mounted.
  let queued = false;
  const schedule = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      if (document.querySelector(HOME)) scan();
    });
  };

  function start() {
    const main = document.querySelector(".Root__main-view");
    if (!main) return setTimeout(start, 300);
    new MutationObserver(schedule).observe(main, { childList: true, subtree: true });
    schedule();
  }
  start();
})();
