import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const write = (file, content) => fs.writeFileSync(path.join(root, file), content);
const edit = (file, fn) => write(file, fn(read(file)));

// Fix the regression test to exercise Mongoose pre-validation middleware.
edit('tests/match-score.test.js', s => s.replaceAll('match.validateSync()', 'match.validate()'));

// ProfileRequests has its own lightweight API helper. Accept both object and
// already-serialized bodies so existing calls cannot be double encoded.
edit('src/ProfileRequests.jsx', s => s.replace(
  '    ...options,\n    headers:',
  '    ...options,\n    ...(options.body !== undefined ? { body: typeof options.body === "string" ? options.body : JSON.stringify(options.body) } : {}),\n    headers:'
));

// Remove the second, global API cache. api.js is the single frontend data
// cache; keeping fetch unmodified avoids stale-data interactions between two caches.
edit('src/v1.2-performance.js', s => {
  const start = s.indexOf('const API_CACHE_TTL =');
  const end = s.indexOf('function isCloudinaryImage');
  if (start < 0 || end < 0) throw new Error('performance cache block not found');
  const replacement = `function isCloudinaryImage`;
  return s.slice(0, start) + replacement + s.slice(end + 'function isCloudinaryImage'.length);
});

// Authentication should only write when identity/profile fields actually changed.
edit('server/middleware/auth.js', s => s.replace(
  /    } else \{[\s\S]*?      await user\.save\(\);\n    \}/,
`    } else {
      const configuredAdminEmail =
        (process.env.ADMIN_EMAIL || "").toLowerCase().trim();
      let changed = false;

      if (email && email !== user.email) {
        user.email = email;
        changed = true;
      }
      if (name && name !== user.name) {
        user.name = name;
        changed = true;
      }
      if (photoURL && photoURL !== user.profileImage) {
        user.profileImage = photoURL;
        changed = true;
      }
      if (email && email === configuredAdminEmail && user.role !== "admin") {
        user.role = "admin";
        changed = true;
      }
      if (email && email === configuredAdminEmail && user.accessRequest !== "none") {
        user.accessRequest = "none";
        changed = true;
      }

      if (changed) await user.save();
    }`
));

// A player can belong to at most one account. Sparse uniqueness permits many
// unlinked users while making the link itself race-safe at the database level.
edit('server/models/User.js', s => {
  if (!s.includes('userSchema.index({ playerProfile: 1, unique: true, sparse: true });')) {
    s = s.replace('export default mongoose.model(', 'userSchema.index({ playerProfile: 1, unique: true, sparse: true });\n\nexport default mongoose.model(');
  }
  return s;
});

// Only one pending profile request may exist per account, even under concurrent submissions.
edit('server/models/ProfileChangeRequest.js', s => {
  if (!s.includes('profileChangeRequestSchema.index({ requestedBy: 1 },')) {
    s = s.replace('export default mongoose.model(', 'profileChangeRequestSchema.index({ requestedBy: 1 }, { unique: true, partialFilterExpression: { status: "pending" } });\n\nexport default mongoose.model(');
  }
  return s;
});

// Strengthen player deletion integrity: linked accounts and pending profile requests
// are references that must survive only while the player survives.
edit('server/routes/players.js', s => {
  s = s.replace('import Match from "../models/Match.js";', 'import Match from "../models/Match.js";\nimport User from "../models/User.js";\nimport ProfileChangeRequest from "../models/ProfileChangeRequest.js";');
  const marker = '    if (hasMatchHistory) {\n';
  const insert = `    const [linkedAccount, pendingRequest] = await Promise.all([
      User.exists({ playerProfile: player._id }),
      ProfileChangeRequest.exists({ player: player._id, status: "pending" }),
    ]);

    if (linkedAccount) {
      return res.status(409).json({
        message: "This player is linked to a user account and cannot be deleted. Unlink the account first.",
      });
    }

    if (pendingRequest) {
      return res.status(409).json({
        message: "This player has a pending profile request and cannot be deleted.",
      });
    }

`;
  if (!s.includes('This player is linked to a user account')) s = s.replace(marker, insert + marker);
  // Tighten the existing position field validation.
  s = s.replace(
    '    player.position = typeof position === "string" ? position.trim() : "";\n',
    '    player.position = typeof position === "string" ? position.trim() : "";\n    if (player.position && !approvedPositions.includes(player.position)) {\n      return res.status(400).json({ message: "Choose a valid primary position." });\n    }\n'
  );
  return s;
});

// Make account linking rely on the unique database constraint as the final arbiter.
edit('server/routes/profileSecurity.js', s => s.replace(
  '  await user.save();\n  res.json({ message: `${user.name || user.email} is linked to ${player.name}.`, user });',
  '  try {\n    await user.save();\n  } catch (error) {\n    if (error?.code === 11000) return res.status(409).json({ message: `${player.name} is already linked to another account.` });\n    throw error;\n  }\n  res.json({ message: `${user.name || user.email} is linked to ${player.name}.`, user });'
));

// Keep legacy score repair conservative. Matches with no event/own-goal history
// are left untouched because their stored score may be the only authoritative record.
edit('server/services/history.js', s => s.replace(
  'for(const match of matches){const scores=getMatchScores(match);if(Number(match.teamA?.score)!==scores.teamA||Number(match.teamB?.score)!==scores.teamB)ops.push({updateOne:{filter:{_id:match._id},update:{$set:{\'teamA.score\':scores.teamA,\'teamB.score\':scores.teamB}}}});}',
  'for(const match of matches){const hasEvents=Array.isArray(match.events)&&match.events.length>0;const hasOwnGoals=Array.isArray(match.participants)&&match.participants.some(p=>Number(p.ownGoals||0)>0);if(!hasEvents&&!hasOwnGoals)continue;const scores=getMatchScores(match);if(Number(match.teamA?.score)!==scores.teamA||Number(match.teamB?.score)!==scores.teamB)ops.push({updateOne:{filter:{_id:match._id},update:{$set:{\'teamA.score\':scores.teamA,\'teamB.score\':scores.teamB}}}});}'
));

// The score displayed for existing matches should use the same authoritative
// derivation as statistics, without requiring a destructive database rewrite.
edit('server/routes/matches.js', s => {
  if (!s.includes('normalizeMatchScores')) s = s.replace('import { scheduleHistory } from "../services/history.js";', 'import { scheduleHistory } from "../services/history.js";\nimport { normalizeMatchScores } from "../services/statistics.js";');
  s = s.replace('          .limit(Math.min(100,Math.max(1,Number(req.query.limit)||50)));', '          .limit(Math.min(100,Math.max(1,Number(req.query.limit)||50)));\n      matches.forEach(normalizeMatchScores);');
  return s;
});

edit('server/routes/matchDetail.js', s => {
  if (!s.includes("normalizeMatchScores")) s = s.replace("import {id} from '../services/statistics.js';", "import {id,normalizeMatchScores} from '../services/statistics.js';");
  s = s.replace("if(!match)return res.status(404).json({message:'Match not found.'});const votes", "if(!match)return res.status(404).json({message:'Match not found.'});normalizeMatchScores(match);const votes");
  return s;
});

edit('server/routes/immersiveNews.js', s => {
  if (!s.includes('normalizeMatchScores')) s = s.replace("import Match from \"../models/Match.js\";", "import Match from \"../models/Match.js\";\nimport { normalizeMatchScores } from \"../services/statistics.js\";");
  s = s.replace('    const facts = factsFor(match);', '    normalizeMatchScores(match);\n    const facts = factsFor(match);');
  s = s.replace('      message: "Failed to generate immersive commentary.",\n      error: error.message,', '      message: "Failed to generate immersive commentary.",');
  return s;
});

// Correct fallback score ordering in AI match news.
edit('server/services/aiNews.js', s => s.replace(
  '${winner} finished ahead ${scoreA}-${scoreB === scoreA ? scoreA : scoreA > scoreB ? scoreA : scoreB}.',
  '${winner} finished ahead ${scoreA}-${scoreB}.'
));

// app-level CORS: preserve the current permissive behavior when no environment
// value is configured, while allowing production to restrict origins explicitly.
edit('server/app.js', s => s.replace(
  'app.use(cors());',
  'const allowedOrigins = (process.env.CORS_ORIGINS || "").split(",").map(value => value.trim()).filter(Boolean);\napp.use(cors(allowedOrigins.length ? { origin: allowedOrigins } : undefined));'
));

// Add a small source-level regression test for the ProfileRequests serialization contract.
write('tests/profile-requests-ui.test.js', `import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport fs from 'node:fs';\n\ntest('ProfileRequests does not double-serialize API request bodies', () => {\n  const source = fs.readFileSync(new URL('../src/ProfileRequests.jsx', import.meta.url), 'utf8');\n  assert.match(source, /typeof options\\.body === "string" \\? options\\.body : JSON\\.stringify\\(options\\.body\\)/);\n});\n`);

// Make the shared API helper explicitly own JSON serialization and preserve any
// custom headers. This keeps future callers from needing to know fetch details.
edit('src/lib/api.js', s => s.replace(
  "const response=await fetch(`${API_URL}${path}`,{...options,method,signal,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})});",
  "const response=await fetch(`${API_URL}${path}`,{...options,method,signal,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},...(body!==undefined?{body:typeof body==='string'?body:JSON.stringify(body)}:{})});"
));

// Remove the now-obsolete startup score rewrite. GET/statistics normalization is
// non-destructive and therefore safer for legacy records.
edit('server/server.js', s => s.replace("import {repairMatchScores,scheduleHistory} from './services/history.js';", "import {scheduleHistory} from './services/history.js';").replace("const repaired=await repairMatchScores();if(repaired)console.log(`Repaired ${repaired} match score(s).`);", ""));

// Clean the now-unused repair function/import from history service.
edit('server/services/history.js', s => {
  s = s.replace("import {buildStatistics,milestoneRules,selectAwards,getMatchScores} from './statistics.js';", "import {buildStatistics,milestoneRules,selectAwards} from './statistics.js';");
  s = s.replace(/export async function repairMatchScores\(\)\{[\s\S]*?return ops\.length;\}\n/, '');
  return s;
});

console.log('Application hardening applied.');
