// xwin: minimize or activate an X11 window, to test focus-dependent behavior.
// Build: cc -O2 -o xwin tools/xwin.c -lX11
// Usage: xwin min <window-id>   |   xwin activate <window-id>
#include <X11/Xlib.h>
#include <X11/Xutil.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

int main(int argc, char **argv) {
    if (argc != 3) {
        fprintf(stderr, "usage: %s min|activate <window-id>\n", argv[0]);
        return 2;
    }
    Display *dpy = XOpenDisplay(NULL);
    if (!dpy) {
        fprintf(stderr, "cannot open display\n");
        return 1;
    }
    Window win = (Window)strtoul(argv[2], NULL, 0);
    int screen = DefaultScreen(dpy);

    if (strcmp(argv[1], "min") == 0) {
        XIconifyWindow(dpy, win, screen);
    } else if (strcmp(argv[1], "activate") == 0) {
        XEvent ev = {0};
        ev.xclient.type = ClientMessage;
        ev.xclient.window = win;
        ev.xclient.message_type = XInternAtom(dpy, "_NET_ACTIVE_WINDOW", False);
        ev.xclient.format = 32;
        ev.xclient.data.l[0] = 2; /* source: pager, so the WM honors it */
        ev.xclient.data.l[1] = CurrentTime;
        XSendEvent(dpy, RootWindow(dpy, screen), False,
                   SubstructureRedirectMask | SubstructureNotifyMask, &ev);
    } else {
        fprintf(stderr, "unknown action %s\n", argv[1]);
        return 2;
    }
    XFlush(dpy);
    XCloseDisplay(dpy);
    return 0;
}
