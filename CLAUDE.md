# CLAUDE.md

Personal fork of spicetify/cli (`origin` = AlessandroTelesca/spicetify-cli, `upstream` = spicetify/cli).
Commit and push directly on `main`.

## Own additions

- `Extensions/windowedFullscreen.js`: Spotify's full-screen button keeps the view inside the window
  (fakes the Fullscreen API) and keeps the left library sidebar visible.
  - On the host, `~/.config/spicetify/Extensions/windowedFullscreen.js` is a symlink to this file, so
    `spicetify apply` + restarting Spotify picks up edits. The host runs the upstream spicetify binary
    (`~/.spicetify`, v2.46.7); building this fork is only needed for changes to the Go CLI.
- `Extensions/hideAnnouncements.js`: hides the Home "Announcement" promo banner (Spotify's HPTO ad).
  - Injects the CSS `[data-testid="home-ads-container"], [data-testid="home-ad-card"] { display: none !important; }`.
    That container comes from Spotify's lazy chunk `Apps/xpui/home-ads-container.js` and mounts above
    `.main-home-filterChipsContainer`.
  - Fallback: a MutationObserver on `.Root__main-view`, batched per animation frame and active only while
    `[data-testid=home-page]` is mounted. Among the Home section's siblings it hides any whose text equals the
    localized label `Spicetify.Locale.get("ad-formats.announcement")` (fixed fallbacks: Announcement,
    Ankündigung) and marks it `data-hide-announcement`.
  - The ad doesn't load on every launch (refetched at most every 30 minutes). To test, remove the extension
    from the config to get a BEFORE screenshot.
  - Spotify's native toggle: Settings "Show announcements about new releases"
    (`settings.showMusicAnnouncements`).
  - The installed file is a symlink to the repo, like `windowedFullscreen.js`.

## Host setup

- Spotify is the Flatpak `com.spotify.Client` (system install). App dir:
  `/var/lib/flatpak/app/com.spotify.Client/x86_64/stable/active/files/extra/share/spotify`,
  prefs: `~/.var/app/com.spotify.Client/config/spotify/prefs`. A Flatpak update resets the patch:
  re-run the two `sudo chmod a+wr` (dir, and `-R` on `Apps`) and `spicetify backup apply`.
- Theme: Sleek / UltraBlack. A user override runs Spotify under XWayland for the GNOME title bar
  (`--nosocket=wayland --socket=x11 --unset-env=ELECTRON_OZONE_PLATFORM_HINT`).
- Remote debugging: port 9222 is TeamSpeak's. Use `--remote-debugging-port=9333` for Spotify and never
  send commands to the TeamSpeak target.

## Testing: do visual checks yourself (required for UI changes)

Never ask the user for screenshots. Check UI changes yourself on the host Spotify (the user said to; the
VM's Spotify is not logged in):

1. `spicetify apply` restarts Spotify *without* a debug port, so afterwards:
   `pkill -x spotify; sleep 3; systemd-run --user --collect --quiet flatpak run com.spotify.Client --remote-debugging-port=9333`
2. `node tools/cdp.mjs eval '<js>'` runs JS in the Spotify page (click buttons by `aria-label`, read
   layout); `node tools/cdp.mjs shot out.png` screenshots only the Spotify page. Look at the PNG.
3. Full-screen button labels: `Enter Full screen` / `Exit full screen` (different case).
4. Test idle states for real: leave the mouse still ~20 s, then screenshot *and* check computed
   `opacity`/`visibility`. A hit-test (`elementFromPoint`) passes on an element faded to opacity 0, and
   forcing a class by hand does not reproduce what Spotify's own idle state does.

User preferences: never show the right sidebar (hidden by `windowedFullscreen.js`, also outside full screen).

Fallback when the host can't be used: the QEMU VM `lg-gnome50` (libvirt user session, `qemu:///session`,
files in `~/VMs/lg-gnome50`). Needs a one-time Spotify login by the user there. Full VM details are in
`~/GIT/simple-gnome-shell/CLAUDE.md`.

- SSH: `ssh -i ~/VMs/lg-gnome50/id_ed25519 -o UserKnownHostsFile=~/VMs/lg-gnome50/known_hosts -p 2222 lg@127.0.0.1`
  (for D-Bus/GUI commands set `DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/1000/bus` and
  `WAYLAND_DISPLAY=wayland-0` / `DISPLAY=:0`).
- In the VM Spotify is a *user* Flatpak (`~/.local/share/flatpak/...`), so spicetify needs no chmod there.
  Spotify must be logged in once in the VM (by the user, via virt-manager) before the main UI loads.
- The VM runs `lg-mpris-mock.service` (a fake player owning `org.mpris.MediaPlayer2.spotify`, used by the
  GNOME extension tests). Real Spotify sees that name and exits silently, so
  `systemctl --user stop lg-mpris-mock.service` before launching Spotify, and `start` it again when done.
- Launch from SSH (Spotify is X11-only there, same Flatpak override as the host):
  `systemd-run --user --collect --setenv=DISPLAY=:0 --setenv=XAUTHORITY=$(ls /run/user/1000/.mutter-Xwaylandauth.*) flatpak run com.spotify.Client --remote-debugging-port=9333`
- Run Spotify with `--remote-debugging-port=9333`, forward it with `ssh -L 9333:127.0.0.1:9333 ...`, and
  drive/inspect the page over CDP (Node 22 has a global `WebSocket`; `Runtime.evaluate`).
- Screenshots: `virsh -c qemu:///session screenshot lg-gnome50 out.ppm --screen 1` (1920x1080 primary),
  convert to PNG and look at it before reporting a UI change as working.

Focus-dependent behavior (auto full screen when the window is unfocused): `wmctrl -b add,hidden` does not
minimize under GNOME. Build `cc -O2 -o <scratch>/xwin tools/xwin.c -lX11` and use `xwin min <id>` /
`xwin activate <id>` (window id from `wmctrl -lx`, with `DISPLAY=:0 XAUTHORITY=/run/user/1000/.mutter-Xwaylandauth.*`).
Check `document.hasFocus()` and `xprop -id <id> WM_STATE` after each step; start each run from a known state.

Animations: `node tools/cdp.mjs frames <dir> <ms> '<js>'` records screencast frames while `<js>` runs (build a
contact sheet with `magick montage`); `node tools/cdp.mjs profile <ms> '<js>'` prints top self-time functions.
Spotify animates the Now Playing ("cinema") view with View Transitions (`html[data-transition=cinema-npv]`).
`windowedFullscreen.js` replaces the opening transition with its own fade (Spotify shows the view's background
only after `finished` resolves) and turns closing into a plain crossfade with sidebar/top bar/player bar still.
The ~0.7 s before anything moves is Spotify's own synchronous render (visualizer + OverlayScrollbars), not ours.
