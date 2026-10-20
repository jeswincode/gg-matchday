import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("Database Health explains application storage references and refreshes operational observations", () => {
  const component = fs.readFileSync(new URL("../src/components/DatabaseHealth.jsx", import.meta.url), "utf8");
  const backend = fs.readFileSync(new URL("../server/routes/system.js", import.meta.url), "utf8");
  const health = fs.readFileSync(new URL("../server/services/providerHealth.js", import.meta.url), "utf8");
  const styles = fs.readFileSync(new URL("../src/components/database-health.css", import.meta.url), "utf8");

  assert.match(component, /\/system\/database-health/);
  assert.match(component, /\/system\/operations-health/);
  assert.match(component, /setInterval/);
  assert.match(component, /60_000/);
  assert.match(component, /estimatedDocumentCount/);
  assert.match(component, /not an authoritative cluster quota or billing metric/i);
  assert.match(component, /No external-provider probes are run by this screen/i);
  assert.match(component, /Backup\/restore status is not monitored by this runtime endpoint/i);
  assert.match(backend, /router\.get\("\/operations-health", requireAuth, requireAdmin/);
  assert.match(backend, /quotaReferenceSource/);
  assert.match(backend, /ratingDisputes/);
  assert.match(health, /process-local-observations/);
  assert.match(health, /SAFE_REASON_CODES/);
  assert.match(styles, /@media\(max-width:720px\)/);
});
