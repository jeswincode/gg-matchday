import fs from 'node:fs';
const p='src/App.jsx';
let s=fs.readFileSync(p,'utf8');
const start='      {/* =====================================================\n          GALLERY';
const end='      {/* =====================================================\n          ADMIN';
const a=s.indexOf(start),b=s.indexOf(end,a);
if(a<0||b<0)throw new Error('Gallery render block not found');
s=s.slice(0,a)+'      {/* =====================================================\n          ADMIN'+s.slice(b+end.length);
s=s.replace(/\n        <section className="card quick-gallery-card">[\s\S]*?<\/section>/,'');
s=s.replace(/\n                        <LikeButton[^\n]*\n?/g,'');
fs.writeFileSync(p,s);
const t='tests/match-score.test.js';
if(fs.existsSync(t)){let x=fs.readFileSync(t,'utf8');x=x.replace(/validateSync\(\)/g,'validate()');x=x.replace(/test\(([^\n]*populated[^\n]*),\(\)=>/g,'test($1,async()=>');fs.writeFileSync(t,x);}
const workflow=`name: Validate\n\non:\n  push:\n    branches: [main]\n  pull_request:\n    branches: [main]\n\njobs:\n  validate:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - uses: actions/setup-node@v4\n        with:\n          node-version: 22\n          cache: npm\n      - run: npm ci\n      - run: npm run lint\n      - run: npm test\n      - run: npm run build\n      - run: node --check server/server.js\n      - run: node --check server/routes/profileSecurity.js\n      - run: node --check server/routes/profileRequests.js\n`;
fs.writeFileSync('.github/workflows/validate.yml',workflow);
for(const f of ['scripts/cleanup-features.mjs','scripts/finalize-feature-cleanup.mjs'])fs.rmSync(f,{force:true});
