import fs from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";

const assetDirectory = path.resolve("dist/assets");
if (!fs.existsSync(assetDirectory)) {
  console.error("Bundle budget check failed: dist/assets does not exist. Run the production build first.");
  process.exit(1);
}

const javascriptFiles = fs.readdirSync(assetDirectory)
  .filter(file => file.endsWith(".js"))
  .map(file => {
    const absolutePath = path.join(assetDirectory, file);
    const source = fs.readFileSync(absolutePath);
    return { file, rawBytes: source.length, gzipBytes: gzipSync(source, { level: 9 }).length };
  });

if (javascriptFiles.length === 0) {
  console.error("Bundle budget check failed: no JavaScript assets were produced.");
  process.exit(1);
}

const largestChunkBudget = Number(process.env.MAX_JS_CHUNK_GZIP_BYTES || 250 * 1024);
const totalBudget = Number(process.env.MAX_TOTAL_JS_GZIP_BYTES || 700 * 1024);
const totalGzipBytes = javascriptFiles.reduce((sum, file) => sum + file.gzipBytes, 0);
const largest = [...javascriptFiles].sort((a, b) => b.gzipBytes - a.gzipBytes)[0];

console.log("JavaScript bundle sizes (gzip):");
for (const file of [...javascriptFiles].sort((a, b) => b.gzipBytes - a.gzipBytes)) {
  console.log(`  ${file.file}: ${(file.gzipBytes / 1024).toFixed(1)} KiB gzip (${(file.rawBytes / 1024).toFixed(1)} KiB raw)`);
}
console.log(`Total JS: ${(totalGzipBytes / 1024).toFixed(1)} KiB gzip across ${javascriptFiles.length} chunks`);

const violations = [];
if (largest.gzipBytes > largestChunkBudget) {
  violations.push(`Largest chunk ${largest.file} is ${Math.ceil(largest.gzipBytes / 1024)} KiB gzip; budget is ${Math.ceil(largestChunkBudget / 1024)} KiB.`);
}
if (totalGzipBytes > totalBudget) {
  violations.push(`Total JS is ${Math.ceil(totalGzipBytes / 1024)} KiB gzip; budget is ${Math.ceil(totalBudget / 1024)} KiB.`);
}
if (violations.length) {
  console.error("JavaScript bundle budget exceeded:\n" + violations.map(value => `- ${value}`).join("\n"));
  process.exit(1);
}
console.log("JavaScript bundle budget passed.");
