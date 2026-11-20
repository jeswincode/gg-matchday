# GG Matchday V4 handoff

## Working baseline

Checked 20 November 2026. The application baseline is [`c248f25`](https://github.com/jeswincode/gg-matchday/commit/c248f25a63a4d8f8168d37e2d1e33cbe047525f7) on [`v4/fresh-start`](https://github.com/jeswincode/gg-matchday/tree/v4/fresh-start). Vercel showed `READY` and Render showed `live` for that revision. [GitHub Actions](https://github.com/jeswincode/gg-matchday/actions/runs/44711440828) passed lint, unit tests, the build and bundle check, desktop and mobile Playwright, and the isolated MongoDB restore smoke test.

| Area | Where to work |
| --- | --- |
| V4 frontend | [Vercel branch preview](https://gg-matchday-git-v4-fresh-start-jeswincode.vercel.app/). The Vite build uses `VITE_API_URL` with an `/api` suffix. |
| V4 API | [`gg-matchday-v4-fresh-api` on Render](https://dashboard.render.com/web/srv-dbuk4g6k1f9s73agustg), auto-deploying on commits to `v4/fresh-start`. Check [API health](https://gg-matchday-v4-fresh-api.onrender.com/api/health) for both database connections. The preview origin belongs in the API's `CORS_ORIGINS` and in Firebase's authorized domains when sign-in needs it. |
| V3 production | `main`, the production Vercel frontend, and Render service `gg-matchday`. Keep these outside V4 work. The older Render service `gg-matchday-v4-api` tracks `v4/development` and is outside this workflow too. |

## Architecture and local setup

- **Frontend.** React 19 and Vite 8. [`src/App.jsx`](../src/App.jsx) owns the shell, auth and shared state. [`src/features/`](../src/features/) contains Matchday, player, Admin, and Clubs views. [`src/lib/api.js`](../src/lib/api.js) supplies API auth headers, GET caching, and request deduplication for its callers.
- **Backend.** Node 24 and Express 5. [`server/app.js`](../server/app.js) mounts routes and middleware. [`server/server.js`](../server/server.js) connects MongoDB and starts scheduled jobs. Firebase Authentication supplies identity and Firebase Admin verifies tokens. Ratings, statistics, and Clubs economy logic live on the server. Gemini editorial generation is optional. See the [architecture guide](architecture.md) and [Clubs rules](v3-clubs-spec.md).
- **MongoDB.** Core Matchday uses `MONGODB_URI`. Clubs uses its own Mongoose connection via `CLUBS_MONGODB_URI` and optional `CLUBS_DB_NAME`. Health reports connectivity. Verify the effective database names and the preview users' access scope in Render and Atlas before a write test or deployment. The deployed database targets and credential scopes were not independently verified for this handoff. Use isolated V4 targets and keep production backup and Atlas credentials out of V4. See [database operations](database-operations.md).
- **Local development.** Use Node 24, run `npm ci`, and follow [`.env.example`](../.env.example) and the [README](../README.md) with local or V4-only credentials. Run `npm start` for the API on port 5000 and `npm run dev` for Vite. Use a MongoDB replica set for transaction-dependent flows. Playwright starts its own isolated database with fixtures and test-only authentication.

## Live profile approvals

1. A linked user submits a profile change. Profile Administration approves it through the server's admin-only route in [`server/routes/profileRequests.js`](../server/routes/profileRequests.js).
2. The API saves the player and approval, then emits `profile-updated` over [`GET /api/live/profile-updates`](https://gg-matchday-v4-fresh-api.onrender.com/api/live/profile-updates). The event carries only the public player ID. The stream checks persisted approvals every three seconds while it has subscribers so another API instance can observe an approval.
3. After API success, [`ProfileRequests.jsx`](../src/ProfileRequests.jsx) clears the pending row and shows confirmation. The approving tab also receives a local event. [`src/lib/profileLive.js`](../src/lib/profileLive.js) listens for both signals and invalidates the API cache. Open profile and roster views fetch the affected player's current record. Reconnect, online, focus and foreground checks reconcile the player list, with a 20-second fallback while a visible page is disconnected.
4. The [Playwright regression](../tests/e2e/profile-live.spec.js) submits and approves a fixture via the API and checks that two independent viewer sessions update without a page reload. For a preview acceptance check, use a V4 test player and admin session, approve through the Admin UI, and confirm the pending row, a second open profile, and recovery after disconnect. A signed-in approval against the hosted preview was outside this documentation handoff.

## Feature-by-feature delivery

Take the next user-selected feature through local implementation, focused tests, desktop and mobile validation, V4 preview deployment, and a preview smoke check before moving on. Follow the [repository instructions](../AGENTS.md) for exact validation commands. Record any deployment lag between Vercel and Render. For performance work, measure the affected interaction and API requests before and after the change.

- **Established baseline.** Home, Record, Leaderboard, Calendar, Players, and Clubs open without the earlier first-visit full-screen loading transition. Admin has an independently scrolling desktop sidebar, a mobile drawer, and a Back to Matchday control. Profile approvals support live updates as described above.
- **Open work.** Realtime coverage still needs validation or implementation for match recording and statistics, rankings, schedules, and Clubs operations and wallets. Chat and notifications need a dedicated review. Site-wide load and API latency have yet to be benchmarked; the navigation improvements are specific to the affected screens.

## Open in Codex

- **Desktop or CLI.** Open a local checkout of this repository on `v4/fresh-start`. For a fresh checkout, run `git clone --single-branch --branch v4/fresh-start https://github.com/jeswincode/gg-matchday.git`. In the desktop app, open the checkout folder as a local project. Use `git branch --show-current` to confirm the branch. Codex reads the root [`AGENTS.md`](../AGENTS.md). [Desktop setup](https://learn.chatgpt.com/docs/app) · [Repository instructions](https://learn.chatgpt.com/docs/agent-configuration/agents-md)
- **Cloud, if available.** Connect GitHub in Codex Cloud if prompted and grant access to `jeswincode/gg-matchday`. Choose the repository in a Cloud environment, select `v4/fresh-start` where offered, or have Codex check out the branch and verify it before editing. Use the local checkout if Cloud cannot operate on that branch. Use Node 24 and isolated development configuration. [Codex Cloud setup](https://learn.chatgpt.com/docs/cloud)

Suggested first task: “Read `AGENTS.md` and `docs/v4-handoff.md`, confirm `v4/fresh-start`, then work on the next feature I specify.”
