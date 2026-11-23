# CLAUDE.md

Personal fork of spicetify/cli (`origin` = AlessandroTelesca/spicetify-cli, `upstream` = spicetify/cli).
Commit and push directly on `main`.

## Own additions

- `Extensions/windowedFullscreen.js`: Spotify's full-screen button keeps the view inside the window
  (fakes the Fullscreen API) and keeps the left library sidebar visible.
  - On the host, `~/.config/spicetify/Extensions/windowedFullscreen.js` is a symlink to this file, so
    `spicetify apply` + restarting Spotify picks up edits. The host runs the upstream spicetify binary
    (`~/.spicetify`, v2.46.7); building this fork is only needed for changes to the Go CLI.

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
