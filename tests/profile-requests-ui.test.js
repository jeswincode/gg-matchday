import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('ProfileRequests does not double-serialize API request bodies', () => {
  const source = fs.readFileSync(new URL('../src/ProfileRequests.jsx', import.meta.url), 'utf8');
  assert.match(source, /typeof options\.body === "string" \? options\.body : JSON\.stringify\(options\.body\)/);
});
