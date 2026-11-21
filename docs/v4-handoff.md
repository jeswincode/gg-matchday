# GG Matchday V4 handoff

## Working baseline

The active application branch is [`v4/fresh-start`](https://github.com/jeswincode/gg-matchday/tree/v4/fresh-start). Check that the Vercel branch deployment and Render API deployment are serving the intended application revision. [GitHub Actions](https://github.com/jeswincode/gg-matchday/actions/workflows/validate.yml?query=branch%3Av4%2Ffresh-start) records the build, lint, unit, browser, and isolated MongoDB restore checks.

| Area | Where to work |
| --- | --- |
| V4 frontend | [Vercel branch preview](https://gg-matchday-git-v4-fresh-start-jeswincode.vercel.app/). The Vite build uses `VITE_API_URL` with an `/api` suffix. |
| V4 API | [`gg-matchday-v4-fresh-api` on Render](https://dashboard.render.com/web/srv-dbuk4g6k1f9s73agustg), auto-deploying on commits to `v4/fresh-start`. Check [API health](https://gg-matchday-v4-fresh-api.onrender.com/api/health) for both database connections. The preview origin belongs in the API's `CORS_ORIGINS` and in Firebase's authorized domains when sign-in needs it. |
| V3 production | `main`, the production Vercel frontend, and Render service `gg-matchday`. Keep these outside V4 work. The older Render service `gg-matchday-v4-api` tracks `v4/development` and is outside this workflow too. |

## Architecture and local setup

- **Frontend.** React 19 and Vite 8. [`src/App.jsx`](../src/App.jsx) owns the shell, auth and shared state. [`src/features/`](../src/features/) contains Matchday, player, Admin, and Clubs views. [`src/lib/api.js`](../src/lib/api.js) supplies API auth headers, GET caching, and request deduplication for its callers.
- **Backend.** Node 24 and Express 5. [`server/app.js`](../server/app.js) mounts routes and middleware. [`server/server.js`](../server/server.js) connects MongoDB and starts scheduled jobs. Firebase Authentication supplies identity and Firebase Admin verifies tokens. Ratings, statistics, and Clubs economy logic live on the server. Gemini editorial generation is optional. See the [architecture guide](architecture.md) and [Clubs rules](v3-clubs-spec.md).
- **MongoDB.** The V4 Render service uses the dedicated `gg-matchday-v4` Atlas cluster. The core database is `gg_matchday_v4`, and `CLUBS_DB_NAME` selects `gg_matchday_v4_clubs` for the separate Clubs connection. Render's connection targets and the Atlas user's database and cluster scopes were checked on 20 November 2026. Verify the targets again if configuration changes. Keep production backup and Atlas credentials out of V4. See [database operations](database-operations.md).
- **Local development.** Use Node 24, run `npm ci`, and follow [`.env.example`](../.env.example) and the [README](../README.md) with local or V4-only credentials. Run `npm start` for the API on port 5000 and `npm run dev` for Vite. Use a MongoDB replica set for transaction-dependent flows. Playwright starts its own isolated database with fixtures and test-only authentication.

## Live profile approvals

Profile administration lists unlinked player accounts. The API excludes administrator roles and the configured administrator email and blocks direct linking attempts for either. Each eligible account stores one player ID, and a player can be linked to several accounts. The V4 API removes the legacy unique index for this field on startup in `gg_matchday_v4`.

1. A linked user submits a profile change. Profile Administration approves it through the server's admin-only route in [`server/routes/profileRequests.js`](../server/routes/profileRequests.js).
2. The API saves the player and approval, then emits `profile-updated` over [`GET /api/live/profile-updates`](https://gg-matchday-v4-fresh-api.onrender.com/api/live/profile-updates). The event carries only the public player ID. The stream checks persisted approvals every three seconds while it has subscribers so another API instance can observe an approval.
3. After API success, [`ProfileRequests.jsx`](../src/ProfileRequests.jsx) clears the pending row and shows confirmation. The approving tab also receives a local event. [`src/lib/profileLive.js`](../src/lib/profileLive.js) listens for both signals and invalidates player reads. Open profile and roster views fetch the affected player's current record. Reconnect, online, and foreground checks reconcile the player list, with a 20-second fallback while a visible page is disconnected.
4. The [Playwright regression](../tests/e2e/profile-live.spec.js) submits and approves a fixture via the API and checks that two independent viewer sessions update without a page reload. For a preview acceptance check, use a V4 test player and admin session, approve through the Admin UI, and confirm the pending row, a second open profile, and recovery after disconnect. A signed-in approval against the hosted preview was outside this documentation handoff.

## Feature-by-feature delivery

Take the next user-selected feature through local implementation, focused tests, desktop and mobile validation, V4 preview deployment, and a preview smoke check before moving on. Follow the [repository instructions](../AGENTS.md) for exact validation commands. Record any deployment lag between Vercel and Render. For performance work, measure the affected interaction and API requests before and after the change.

## Live data and performance

- Matchday Signature shares matte tab selections, subtle waves and etched GG marks with Clubs. Dark uses dusty lavender accents on navy and plum. Gold pairs burnished gold controls with muted sage details. Mobile uses a compact Home layout and desktop retains the V3-style layout and stadium media. Player profiles open at the identity header and organize their content into Overview, Stats, History and Honors.
- Matchday and Clubs share the Signature palette for base surfaces, raised controls, text and borders. Starting XI offers Pitch and List views of the same formation, common formation shortcuts, and direct player profile access. Returning from a player profile restores the lineup and scroll point. Leaderboard filters stay visible while scrolling and keep the previous results visible until the new filter returns.
- The player video, portrait and style badges live in one banner across all profile tabs. Authorized editors open the edit dialog from the portrait. Linked viewers use the same portrait to request changes. The signed-in account avatar opens appearance settings and access to the linked player profile from any Matchday tab. Admin account settings show account details and appearance controls.
- Matchday and Clubs dialogs use the selected theme's matte surfaces and a short entrance. Clubs adds motion to its header, controls and mobile menus while keeping the swipe pager ready. Reduced-motion settings disable these effects.

- Matchday and Clubs remember each tab’s scroll position while the app is open. The URL records the selected tab so links reopen that destination and browser Back and Forward follow tab navigation. Clubs destinations still follow the viewer’s existing access rules.

- Matchday keeps neighboring mobile tabs laid out and refreshes the primary tab data while the workspace is open. The mobile bottom dock matches the Clubs placement. The Matchday background video holds its frame during horizontal gestures and resumes after navigation settles, subject to the device's reduced-motion preference.
- V3 moves a single stage on touch. The V4 pager keeps the incoming page visible during the drag and moves only the two pane transforms per frame. It accepts shorter deliberate horizontal drags, keeps native vertical scrolling, and settles the drag in 95 ms. Native-touch browser tests cover a short drag and a second drag begun before the first has settled.

- Match records, rankings, calendar history, open match details, player statistics and awards, and news refresh from saved data. Clubs views refresh fixtures, formation, market, reviews, administration, and wallet data. Chat and notifications refresh for signed-in users. The existing `CHAT_ENABLED` setting controls chat availability.
- [The server](../server/services/liveData.js) watches selected MongoDB collections and sends refresh topics without records or identifiers on the public and authenticated streams. [The client](../src/lib/liveData.js) invalidates matching reads so active views use the normal APIs and access checks. It reconciles after reconnect, and uses bounded retries for outages.
- A controlled Chromium walkthrough of the built frontend at desktop and mobile widths recorded **7 → 0** REST reads before guest entry, **10 → 7** through Home, and **18 → 14** through the primary tabs and Clubs. Exact repeat reads in that walkthrough went from **4 → 0**. Both WebP welcome posters are about **88% smaller** than their original PNGs, which stay available as fallbacks. These measurements cover the test journey and asset sizes. Hosted latency under real traffic, free Render cold starts, and request fan-out on a large Clubs fixture list remain areas to measure.
- [Cross-session browser coverage](../tests/e2e/live-data.spec.js) exercises Matchday updates, reconnect recovery, announcements, and chat against isolated fixtures. [Club workflow coverage](../tests/e2e/clubs-workflows.spec.js) includes formation, signing, and budget changes appearing in already-open sessions.

## Clubs workspace

- Clubs uses a desktop navigation rail and a mobile dock. Match lists show confirmed upcoming fixtures and results. Linked squad members can switch to My Fixtures. Current captains submit fixture requests and handle decisions in the captain inbox. Pending requests and captain votes stay out of the public fixture response.
- Betting shows confirmed eligible fixtures and a player's open and settled bets. V4 allows squad members to bet on their own Club's fixtures using existing in-game credits. Limits, fixture deadlines, wallet debits, payouts, and refunds remain server-controlled. Bet history is scoped to the signed-in player and fetched in pages.
- My Player brings together the private wallet, personal and Club rewards, and Club career records. The header opens the linked account's full Matchday player profile. Players request edits from their own profile. Account linking and approval of profile edits are under Matchday Admin → Profile administration.
- Clubs Admin uses the Matchday Admin layout with Clubs styling. The grouped sidebar opens Dashboard, Applications, Clubs, Matches, Action queue, and Activity & audit. Desktop keeps navigation visible beside a separately scrolling work area. On mobile, Sections opens the sidebar drawer. The dashboard has shortcuts to active workflows and recent Club records, and Matches can be searched by Club, date, or record ID.
- The [Clubs workspace browser test](../tests/e2e/clubs-workspace.spec.js) checks captain and member views in independent sessions, a same-Club bet, private history, and a cancellation refund against isolated fixtures.

## Open in Codex

- **Desktop or CLI.** Open a local checkout of this repository on `v4/fresh-start`. For a fresh checkout, run `git clone --single-branch --branch v4/fresh-start https://github.com/jeswincode/gg-matchday.git`. In the desktop app, open the checkout folder as a local project. Use `git branch --show-current` to confirm the branch. Codex reads the root [`AGENTS.md`](../AGENTS.md). [Desktop setup](https://learn.chatgpt.com/docs/app) · [Repository instructions](https://learn.chatgpt.com/docs/agent-configuration/agents-md)
- **Cloud, if available.** Connect GitHub in Codex Cloud if prompted and grant access to `jeswincode/gg-matchday`. Choose the repository in a Cloud environment, select `v4/fresh-start` where offered, or have Codex check out the branch and verify it before editing. Use the local checkout if Cloud cannot operate on that branch. Use Node 24 and isolated development configuration. [Codex Cloud setup](https://learn.chatgpt.com/docs/cloud)

Suggested first task: “Read `AGENTS.md` and `docs/v4-handoff.md`, confirm `v4/fresh-start`, then work on the next feature I specify.”
- Matchday and the primary Clubs destinations share a swipe pager. The next panel renders alongside the current panel during a horizontal swipe. Tabs retain local state and prepare their core data ahead of navigation. The pager captures horizontal touch movement over buttons and cards, then suppresses the click from that drag. Inputs, native vertical scrolling, zoom, and genuinely horizontal scrollers keep their own gestures. A second swipe can finish the previous transition and begin immediately.
