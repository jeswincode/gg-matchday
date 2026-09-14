import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');

test('Player Comparisons keeps its player dependency stable and supports the comparison contract',()=>{
  const source=read('src/components/PlayerComparisons.jsx');
  assert.match(source,/const players=useMemo\(\(\)=>Array\.isArray\(playerData\)\?playerData:\[\],\[playerData\]\);/);
  assert.match(source,/selectedIds\.length>=2&&selectedIds\.length<=3/);
  assert.match(source,/Promise\.all\(selectedIds\.map\(playerId=>api\(`\/stats\/player\/\$\{playerId\}`\)\)\)/);
  assert.match(source,/Goals/);
  assert.match(source,/Assists/);
  assert.match(source,/Attacking/);
  assert.match(source,/Defending/);
  assert.match(source,/GG Rating/);
  assert.match(source,/Performance trend/);
  assert.match(source,/Recorded match ratings from oldest to newest/);
});

test('Latest News uses an internal scroll viewport rather than growing the page',()=>{
  const css=read('src/news-scroll.css');
  const app=read('src/App.jsx');
  assert.match(css,/\.news-list\{[^}]*max-height:476px[^}]*overflow-y:auto/);
  assert.match(css,/\.news-card\{min-height:145px\}/);
  assert.match(css,/@media\(max-width:600px\)\{\.news-list\{max-height:440px/);
  assert.match(app,/<div className="news-list">/);
  assert.match(app,/news\.slice\(0,6\)\.map/);
});
