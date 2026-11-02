import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = path => fs.readFileSync(path, "utf8");

test("GG web app manifest declares an installable standalone football app", () => {
  const manifest = JSON.parse(read("public/manifest.webmanifest"));
  assert.equal(manifest.name, "GG â€” Football Worlds");
  assert.equal(manifest.start_url, "/");
  assert.equal(manifest.scope, "/");
  assert.equal(manifest.display, "standalone");
  assert.ok(manifest.icons.some(icon => icon.sizes === "192x192"));
  assert.ok(manifest.icons.some(icon => icon.sizes === "512x512"));
});

test("PWA shell caches only public application resources, never private API or media", () => {
  const worker = read("public/sw.js");
  assert.ok(worker.includes('url.pathname.startsWith("/api/")'));
  assert.ok(worker.includes('url.pathname.startsWith("/auth/")'));
  assert.ok(worker.includes('url.pathname.startsWith("/uploads/")'));
  assert.ok(worker.includes('caches.match("/offline.html")'));
  assert.ok(worker.includes('request.mode === "navigate"'));
});

test("PWA app shell registers the service worker in production builds", () => {
  const entry = read("src/main.jsx");
  assert.match(entry, /import.meta.env.PROD/);
  assert.ok(entry.includes("serviceWorker.register("));
  assert.match(entry, /sw.js/);
  assert.ok(read("index.html").includes("rel=\"manifest\" href=\"/manifest.webmanifest\""));
});

test("Global Map exposes install help without adding ano¶»§q«^