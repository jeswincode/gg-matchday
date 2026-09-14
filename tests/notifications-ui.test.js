import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');

test('Community Chat exposes the three requested sections and the overview guidebook',()=>{const source=read('src/components/ChatEnhanced.jsx');assert.match(source,/Community chat/);assert.match(source,/Notifications/);assert.match(source,/Overview/);assert.match(source,/GG MATCHDAY GUIDEBOOK/);assert.match(source,/Ratings and GG Rating/);assert.match(source,/Community Chat/);});

test('Notifications UI supports admin publishing, deletion, unread state and five-day messaging',()=>{const source=read('src/components/ChatEnhanced.jsx');const css=read('src/components/notifications.css');assert.match(source,/api\('\/notifications'\)/);assert.match(source,/api\('\/notifications'\,\{method:'POST'/);assert.match(source,/api\(`\/notifications\/\$\{id\}`\,\{method:'DELETE'/);assert.match(source,/Mark all as read/);assert.match(source,/5 days/);assert.match(css,/gg-tab-dot/);assert.match(css,/notifications-unread/);assert.match(css,/data-theme="golden"/);});
