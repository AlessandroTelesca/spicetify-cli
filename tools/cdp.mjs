// node cdp.mjs eval '<js>'   |   node cdp.mjs shot out.png
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
} else {
  const d = await call("Runtime.evaluate", { expression: arg, returnByValue: true, awaitPromise: true });
  const r = d.result.result; console.log(typeof r.value === "string" ? r.value : JSON.stringify(r.value ?? d.result, null, 1));
}
ws.close();
