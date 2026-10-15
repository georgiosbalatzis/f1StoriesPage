// Paired public-artifact CPU x4 interaction profiles, with recorded provider responses.
// Usage and environment variables: perf/step5-global-runtime/README.md
const fs = require("fs"), http = require("http"), path = require("path"), zlib = require("zlib");
const { chromium } = require(process.cwd() + "/node_modules/playwright-core");
const { Launcher } = require(process.cwd() + "/node_modules/chrome-launcher");
const roots = { baseline: process.env.GLOBAL_BASELINE_ROOT, candidate: process.env.GLOBAL_CANDIDATE_ROOT }, fixtures = process.env.GLOBAL_PROVIDER_FIXTURES;
if (!roots.baseline || !roots.candidate || !fixtures) throw Error("Set GLOBAL_BASELINE_ROOT, GLOBAL_CANDIDATE_ROOT and GLOBAL_PROVIDER_FIXTURES");
const out = process.argv[2] || "/tmp/f1-step5-cues";
const runs = Number(process.argv[3] || 3);
const widths = (process.argv[4] || "390").split(",").map(Number);
const profiles = process.argv[5] || "fast4g";
const rows = [];
const mime = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".avif": "image/avif", ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg" };
let activeRoot = roots.baseline;
const server = http.createServer((req, res) => {
  let url = new URL(req.url, "http://x").pathname, file = path.join(activeRoot, url.endsWith("/") ? url + "index.html" : url);
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404).end();
    return;
  }
  let body = fs.readFileSync(file), type = mime[path.extname(file)] || "application/octet-stream";
  const compress = /text|json|svg/.test(type);
  if (compress) body = zlib.gzipSync(body);
  res.writeHead(200, { "Content-Type": type, ...compress ? { "Content-Encoding": "gzip" } : {}, "Cache-Control": "no-store" });
  res.end(body);
});
(async () => {
  fs.mkdirSync(out, { recursive: true });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const origin = "http://127.0.0.1:" + server.address().port;
  const browser = await chromium.launch({ executablePath: Launcher.getFirstInstallation() });
  try {
    for (const net of profiles.split(",")) for (const width of widths) for (let run = 0; run < runs; run++) for (const variant of run % 2 ? ["candidate", "baseline"] : ["baseline", "candidate"]) {
      activeRoot = roots[variant];
      const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: width < 768, hasTouch: width < 1024 });
      await context.addInitScript(() => {
        localStorage.setItem("f1stories-cookie-consent-v1", JSON.stringify({ ts: Date.now(), essential: true, analytics: false }));
        window.__cue = { observers: [], long: [], events: [] };
        for (const type of ["MutationObserver", "ResizeObserver"]) {
          const Native = window[type];
          window[type] = class extends Native {
            constructor(callback) {
              super((...args) => {
                const start2 = performance.now();
                try {
                  return callback(...args);
                } finally {
                  window.__cue.observers.push({ type, start: start2, duration: performance.now() - start2 });
                }
              });
            }
          };
        }
        new PerformanceObserver((l) => window.__cue.long.push(...l.getEntries().map((e) => ({ start: e.startTime, duration: e.duration })))).observe({ type: "longtask", buffered: true });
        new PerformanceObserver((l) => window.__cue.events.push(...l.getEntries().filter((e) => e.interactionId).map((e) => ({ name: e.name, start: e.startTime, duration: e.duration, processing: e.processingEnd - e.processingStart })))).observe({ type: "event", buffered: true, durationThreshold: 16 });
      });
      await context.route("**/*", (route) => {
        let url = new URL(route.request().url());
        if (url.origin === origin) return route.continue();
        let file;
        if (url.hostname === "api.openf1.org") {
          let endpoint = url.pathname.split("/").at(-1), session = url.searchParams.get("session_key");
          file = endpoint === "sessions" ? "openf1-sessions-2026.json" : `openf1-${endpoint}-${session}.json`;
        } else if (url.hostname === "api.jolpi.ca" && url.pathname.endsWith("/2026.json")) file = "jolpica-schedule-2026.json";
        if (file) {
          const raw = path.join(fixtures, file);
          const compressed = raw + ".gz";
          if (fs.existsSync(raw) || fs.existsSync(compressed)) return route.fulfill({ contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: fs.existsSync(raw) ? fs.readFileSync(raw) : zlib.gunzipSync(fs.readFileSync(compressed)) });
        }
        return route.abort();
      });
      const page = await context.newPage(), cdp = await context.newCDPSession(page);
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
      await cdp.send("Network.enable");
      await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: net === "slow4g" ? 150 : 40, downloadThroughput: (net === "slow4g" ? 1.6 : 9) * 1024 * 1024 / 8, uploadThroughput: (net === "slow4g" ? 750 : 1536) * 1024 / 8 });
      await cdp.send("Performance.enable");
      await cdp.send("Profiler.enable");
      await cdp.send("Profiler.start");
      await page.goto(origin + "/standings/", { waitUntil: "load" });
      await page.waitForTimeout(300);
      const metric = async () => Object.fromEntries((await cdp.send("Performance.getMetrics")).metrics.map((e) => [e.name, e.value]));
      const start = await metric();
      const interactions = [];
      for (const tab of ["tyre-pace", "drivers", "tyre-pace", "dirty-air", "drivers", "dirty-air", "debrief", "drivers", "debrief"]) {
        const before = await metric(), at = await page.evaluate(() => performance.now());
        if (width >= 1024) await page.locator("#tab-" + tab).click();
        else await page.selectOption("#standings-report-selector", tab);
        await page.waitForFunction((tab2) => {
          const p = document.getElementById("panel-" + tab2);
          return p && !p.hidden && p.classList.contains("active") && !p.querySelector('[class*="skeleton"],.standings-loading') && p.textContent.trim().length > 100 && (tab2 !== "tyre-pace" || p.querySelector(".tyre-pace-chart-scroll svg"));
        }, tab, { timeout: 3e4 });
        await page.waitForTimeout(200);
        const after = await metric();
        interactions.push({ tab, at, scriptMs: (after.ScriptDuration - before.ScriptDuration) * 1e3, layoutMs: (after.LayoutDuration - before.LayoutDuration) * 1e3, layoutCount: after.LayoutCount - before.LayoutCount });
      }
      const end = await metric();
      const { profile } = await cdp.send("Profiler.stop");
      const state = await page.evaluate(() => ({ ...window.__cue, cues: [...document.querySelectorAll(".horizontal-scroll-region")].map((r) => ({ text: r.querySelector(".horizontal-scroll-hint")?.textContent, hidden: r.firstElementChild.hidden, width: r.lastElementChild.clientWidth, scrollWidth: r.lastElementChild.scrollWidth, left: r.lastElementChild.scrollLeft, buttons: [...r.querySelectorAll("button")].map((b) => b.disabled) })) }));
      const row = { net, width, run, variant, scriptMs: (end.ScriptDuration - start.ScriptDuration) * 1e3, layoutMs: (end.LayoutDuration - start.LayoutDuration) * 1e3, layoutCount: end.LayoutCount - start.LayoutCount, interactions, ...state };
      rows.push(row);
      fs.writeFileSync(out + "/results.json", JSON.stringify(rows, null, 2));
      fs.writeFileSync(`${out}/${net}-${width}-${run}-${variant}.cpuprofile.gz`, zlib.gzipSync(JSON.stringify(profile)));
      console.log(net, width, run, variant, "script", row.scriptMs.toFixed(1), "layout", row.layoutMs.toFixed(1), "count", row.layoutCount, "observer", state.observers.reduce((a, b) => a + b.duration, 0).toFixed(1), "long", state.long.map((x) => x.duration.toFixed(1)).join(","));
      await context.close();
    }
  } finally {
    await browser.close();
    server.closeAllConnections();
    server.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
