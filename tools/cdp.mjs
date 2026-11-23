// node cdp.mjs eval '<js>'   |   node cdp.mjs shot out.png   |   node cdp.mjs click X Y   |   node cdp.mjs frames DIR MS [JS]   |   node cdp.mjs profile MS JS
import { writeFileSync } from "node:fs";
const list = await (await fetch("http://127.0.0.1:9333/json")).json();
const page = list.find(p => p.type === "page" && /xpui/.test(p.url));
if (!page) { console.log("no spotify page"); process.exit(1); }
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise(r => ws.onopen = r);
const call = (method, params) => new Promise(res => {
  const id = Math.random() * 1e9 | 0;
  const h = m => { const d = JSON.parse(m.data); if (d.id === id) { ws.removeEventListener("message", h); res(d); } };
  ws.addEventListener("message", h);
  ws.send(JSON.stringify({ id, method, params }));
});
const [mode, arg] = process.argv.slice(2);
if (mode === "shot") {
  const d = await call("Page.captureScreenshot", { format: "png" });
  writeFileSync(arg, Buffer.from(d.result.data, "base64")); console.log("saved", arg);
} else if (mode === "click") {
  const [x, y] = [Number(arg), Number(process.argv[4])];
  for (const type of ["mouseMoved", "mousePressed", "mouseReleased"])
    await call("Input.dispatchMouseEvent", { type, x, y, button: "left", clickCount: 1 });
  console.log("clicked", x, y);
} else if (mode === "frames") {
  // node cdp.mjs frames <outdir> <ms> [js to run after start]
  const [dir, ms, js] = [arg, Number(process.argv[4] || 1500), process.argv[5]];
  const { mkdirSync } = await import("node:fs"); mkdirSync(dir, { recursive: true });
  let n = 0; const t0 = Date.now();
  ws.addEventListener("message", (m) => {
    const d = JSON.parse(m.data);
    if (d.method !== "Page.screencastFrame") return;
    const t = String(Date.now() - t0).padStart(5, "0");
    writeFileSync(`${dir}/f${String(n++).padStart(3, "0")}_${t}ms.jpg`, Buffer.from(d.params.data, "base64"));
    ws.send(JSON.stringify({ id: 1e9 + n, method: "Page.screencastFrameAck", params: { sessionId: d.params.sessionId } }));
  });
  await call("Page.startScreencast", { format: "jpeg", quality: 60, everyNthFrame: 1 });
  if (js) await call("Runtime.evaluate", { expression: js });
  await new Promise((r) => setTimeout(r, ms));
  await call("Page.stopScreencast", {});
  console.log("frames", n);
} else if (mode === "profile") {
  // node cdp.mjs profile <ms> <js>  -> top self-time functions while <js> runs
  const [ms, js] = [Number(arg), process.argv[4]];
  await call("Profiler.enable", {}); await call("Profiler.setSamplingInterval", { interval: 200 });
  await call("Profiler.start", {});
  await call("Runtime.evaluate", { expression: js });
  await new Promise((r) => setTimeout(r, ms));
  const { result: { profile } } = await call("Profiler.stop", {});
  const self = new Map(), dt = profile.timeDeltas, total = dt.reduce((a, b) => a + b, 0) / 1000;
  const byId = new Map(profile.nodes.map((n) => [n.id, n]));
  profile.samples.forEach((id, i) => { const n = byId.get(id).callFrame;
    const k = `${n.functionName || "(anon)"} ${n.url.split("/").pop()}:${n.lineNumber + 1}:${n.columnNumber + 1}`;
    self.set(k, (self.get(k) || 0) + (dt[i] || 0) / 1000); });
  console.log("total ms", Math.round(total));
  [...self].sort((a, b) => b[1] - a[1]).slice(0, 25).forEach(([k, v]) => console.log(v.toFixed(1).padStart(7), k));
} else {
  const d = await call("Runtime.evaluate", { expression: arg, returnByValue: true, awaitPromise: true });
  const r = d.result.result; console.log(typeof r.value === "string" ? r.value : JSON.stringify(r.value ?? d.result, null, 1));
}
ws.close();
