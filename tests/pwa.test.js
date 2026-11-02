import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read = path => fs.readFileSync(path, "utf8");

test("GG web app manifest declares an installable standalone football app", () => {
  const manifest = JSON.parse(read("public/manifest.webmanifest"));
  assert.ok(manifest.name.includes("GG"));
  assert.equal(manifest.start_url, "/");
  assert.equal(manifest.scope, "/");
  assert.equal(manifest.display, "standalone");
  assert.ok(manifest.icons.some(icon => icon.sizes === "192x192"));
  assert.ok(manifest.icons.some(icon => icon.sizes === "512x512"));
});

test("PWA shell caches only public app resources, never private API or media", () => {
  const worker = read("public/sw.js");
  assert.ok(worker.includes('url.pathname.startsWith("/api/")'));
  assert.ok(worker.includes('url.pathname.startsWith("/auth/")'));
  assert.ok(worker.includes('url.pathname.startsWith("/uploads/")'));
  assert.ok(worker.includes('request.mode === "navigate"'));
  assert.ok(worker.includes('caches.match("/offline.html")'));
  assert.ok(worker.includes('request.headers.has("authorization")'));
  assert.ok(worker.includes('cache.put("/", response.clone())'));
});

test("PWA registers the worker only for production builds", () => {
  const entry = read("src/main.jsx");
  assert.match(entry, /import.meta.env.PROD/);
  assert.ok(entry.includes("serviceWorker.register('/sw.js'"));
  assert.match(entry, /sw.js/);
  assert.ok(read("index.html").includes('rel="manifest" href="/manifest.webmanifest"'));
});

test("Global Map UI presents one shared World and the admin Gmail access manager", () => {
  const page = read("src/features/globalMap/GlobalMapPage.jsx");
  const scene = read("src/features/globalMap/GlobalMapScene.jsx");
  assert.ok(page.includes('slice(0, 1)'));
  assert.ok(page.includes('api("/worlds/admin/access")'));
  assert.ok(page.includes('method: "DELETE"'));
  assert.ok(page.includes("administrator-linked Gmail"));
  assert.ok(scene.includes("ACCESS LINKED"));
  assert.ok(!page.includes("/join-requests"));
  assert.ok(!page.includes('api("/worlds",'));
});
