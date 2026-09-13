import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const remove=p=>{const f=path.join(root,p);if(fs.existsSync(f))fs.rmSync(f,{force:true});};
const edit=(p,fn)=>{const f=path.join(root,p);fs.writeFileSync(f,fn(fs.readFileSync(f,'utf8')));};
for(const p of ['server/models/Gallery.js','server/models/Like.js','server/routes/gallery.js','server/routes/interactions.js','src/components/LikeButton.jsx','.github/cleanup-trigger.txt','.github/workflows/cleanup-features.yml','.github/workflows/finish-feature-cleanup.yml'])remove(p);
edit('server/app.js',s=>s.replace('import galleryRoutes from "./routes/gallery.js";\n','').replace('import interactionRoutes from "./routes/interactions.js";\n','').replace('app.use("/api/interactions", interactionRoutes);\n','').replace('app.use("/api/gallery", galleryRoutes);\n',''));
edit('server/routes/stats.js',s=>s.replace("import Gallery from '../models/Gallery.js';\n",'').replace("router.get('/overview',safe(async(req,res)=>{const [players,matches,photos,goals]=await Promise.all([Player.countDocuments(),Match.countDocuments(),Gallery.countDocuments(),Match.aggregate([{$group:{_id:null,total:{$sum:{$add:['$teamA.score','$teamB.score']}}}}])]);res.json({players,matches,photos,goals:goals[0]?.total||0});}));","router.get('/overview',safe(async(req,res)=>{const [players,matches,goals]=await Promise.all([Player.countDocuments(),Match.countDocuments(),Match.aggregate([{$group:{_id:null,total:{$sum:{$add:['$teamA.score','$teamB.score']}}}}])]);res.json({players,matches,goals:goals[0]?.total||0});}));"));
edit('tests/api.test.js',s=>s.replace("const {default:Like}=await import('../server/models/Like.js');",'').replace("const {default:Gallery}=await import('../server/models/Gallery.js');",'').replace(',Like,Gallery,ProfileChangeRequest',',ProfileChangeRequest').replace(/test\('gallery associations validated; immutable likes deduplicated concurrently'.*?\);\n/s,''));
edit('src/v1.2-performance.js',s=>s.replace(/\n  const isGalleryImage = Boolean\([\s\S]*?\n  \);/,'').replace(/\n  if \(isGalleryImage\) \{[\s\S]*?\n  \}/,'').replace('isProfileImage ? 480 : isGalleryImage ? 900 : 1200','isProfileImage ? 480 : 1200'));
edit('src/App.jsx',s=>{
 s=s.replace("import LikeButton from './components/LikeButton';\n",'').replace('  GALLERY: "gallery",\n','').replace("import Clasico from './components/Clasico';\n", "import Clasico from './components/Clasico';\nimport PlayerComparisons from './components/PlayerComparisons';\n");
 s=s.replace("  const [galleryNext,setGalleryNext]=useState(null);\n  const [galleryMatch,setGalleryMatch]=useState('');\n  const [galleryPlayers,setGalleryPlayers]=useState([]);\n",'');
 s=s.replace(/\n  const \[\n    gallery,\n    setGallery,\n  \] = useState\(\[\]\);/,'');
 s=s.replace(/\n  const \[\n    galleryLoading,[\s\S]*?\n  \] = useState\(false\);/,'');
 s=s.replace(/\n  async function loadGallery\(page = 1\) \{[\s\S]*?\n  async function loadLeaderboard/,'\n  async function loadLeaderboard');
 s=s.replace(/\n  \/\/ =========================================================\n  \/\/ GALLERY[\s\S]*?\n  \/\/ =========================================================\n  \/\/ ADMIN/,'\n  // =========================================================\n  // ADMIN');
 s=s.replace('    loadGallery();\n','');
 s=s.replace('Matches, players, rankings, photos and','Matches, players, rankings and');
 s=s.replace(/\n            <HomeStat\n              label="PHOTOS"[\s\S]*?\n            \/>/,'');
 s=s.replace(/\n                        <LikeButton type="news" id=\{article\._id\} isSignedIn=\{isSignedIn\}\/>,?/, '');
 s=s.replace(/\n              action="Open Gallery"[\s\S]*?\n              \}/,'');
 s=s.replace(/\n        <section className="card quick-gallery-card">[\s\S]*?<\/section>/,'');
 s=s.replace(/\n          <section className="home-section">\n\n            <SectionHeading\n              eyebrow="GG MOMENTS"\n              title="Latest Photos"[\s\S]*?\n          <\/section>\n\n          \{leaderboard\.length >/, '\n          <PlayerComparisons players={players} statistics={leaderboard} onPlayer={(playerId) => showPlayer(playerId)} />\n\n          {leaderboard.length >');
 s=s.replace(/\n      \{\/\* =====================================================\n          GALLERY\n      ===================================================== \*\}[\s\S]*?\n      \{\/\* =====================================================\n          ADMIN/,'\n      {/* =====================================================\n          ADMIN');
 return s.replace(/\n              <LikeButton type="gallery" id=\{photo\._id\} isSignedIn=\{isSignedIn\}\/>/,'');
});
edit('.env.example',s=>s.replace('\nVITE_CLOUDINARY_CLOUD_NAME=\nVITE_CLOUDINARY_UPLOAD_PRESET=gg-matchday-gallery\n','\n'));
for(const f of fs.readdirSync(path.join(root,'src')).filter(x=>x.endsWith('.css'))){const p=path.join(root,'src',f);let s=fs.readFileSync(p,'utf8');s=s.replace(/[^{}]*?(?:gallery|like)[^{}]*\{[^{}]*\}/gi,'');fs.writeFileSync(p,s);}
const comparison=path.join(root,'src/components/PlayerComparisons.jsx');
if(!fs.existsSync(comparison))fs.writeFileSync(comparison,'export default function PlayerComparisons(){return <section className="home-section"><div className="section-heading"><div><p className="eyebrow">PLAYER INSIGHTS</p><h2>Player Comparisons</h2></div></div><div className="card"><p className="muted">Player comparison tools will appear here.</p></div></section>}\n');
