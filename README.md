# GG Matchday V3

GG Matchday is a football-tracking and club-management platform for recording matches, tracking player performance, comparing players, and running a separate community Clubs experience.

The application is built as one project with a React/Vite frontend and an Express API. MongoDB stores application data, Firebase provides user authentication, and Google Gemini can generate football editorial content when configured.

## What the website includes

### Matchday

- **Match recording and history** — record football matches, teams, participants, scores, goal events, assists, own goals, and player performance.
- **Player directory and profiles** — explore players, player histories, positions, attributes, and performance.
- **Ratings and OVR** — calculate match ratings, GG/offensive/defensive statistics, and position-aware player attributes.
- **Rankings and analytics** — leaderboards, top scorers, assists, player comparisons, head-to-head history, match insights, and season statistics.
- **Match detail and awards** — review match data, vote for Man of the Match (MOTM), and surface awards and achievements.
- **Calendar and history** — browse matches by date and open match details.
- **Football news** — show match reports and editorial content, with an AI-generated path and a factual fallback.
- **El Clásico and Hall of Fame** — explore rivalry history and notable player achievements.
- **Notifications and community chat** — authenticated notifications and optional live chat.
- **Account and admin workflows** — request editor access, link accounts to player profiles, submit profile changes for review, and manage authorised records.
- **Responsive themes** — Dark and Gold Matchday experiences, mobile-specific refinements, and reduced-motion support.

### Ultimate Clubs

Clubs is a separate product mode with its own navigation, data models, business rules, and database connection. Its main areas are **Club Hub, My Club, Market, Matches, Players, Reviews, and Admin**.

The current Clubs workflows include:

- Forming a club with member invitations and agreement, captain selection, Club details approval, and administrator review.
- Managing membership, captain decisions, contract renewals, and historical club relationships.
- Discovering eligible players, making auction offers, choosing offers, and approving signings.
- Requesting and accepting club fixtures.
- Synchronising eligible completed Club matches from the regular Match Record.
- Tracking club and player wallets, reward transactions, match predictions, and club-vs-club betting.
- Reviewing players as teammates or opponents when the match-history eligibility rules are satisfied.
- Administering applications, Clubs, and Club matches.

Clubs rules such as formation, captain approval, contract boundaries, wallet separation, auction limits, fixture dates, rewards, and betting settlement are documented in [the V3 Clubs specification](docs/v3-clubs-spec.md). When changing this area, treat that specification and the corresponding backend code/tests as the reference; do not implement Club money or betting as frontend-only state.

## Technology

- **Frontend:** React 19, Vite 8, JavaScript, CSS
- **API:** Node.js 24, Express 5
- **Data:** MongoDB with Mongoose; a separate connection can be configured for the Clubs database
- **Authentication:** Firebase Authentication on the client and Firebase Admin token verification on the server
- **AI editorial:** Google Gemini via `@google/genai` (optional)
- **Automated checks:** Node.js test runner, Playwright, ESLint, and GitHub Actions

## Repository layout

| Path | Responsibility |
| --- | --- |
| `src/App.jsx` | Main application shell, authentication state, top-level data, navigation, permissions and workflow coordination |
| `src/features/home/` | Home page and Matchday overview |
| `src/features/matches/` | Match recording presentation |
| `src/features/calendar/` | Calendar state, match loading and date navigation |
| `src/features/players/` | Player directory and profile views |
| `src/features/ratings/` | Rating input configuration and client-side rating utilities |
| `src/features/clubs/` | Clubs mode, club workflows and player analytics |
| `src/features/admin/` | Administrative screens and access-control UI |
| `src/components/` | Shared and self-contained UI features |
| `src/lib/api.js` | API client, authentication headers, request deduplication and short-lived GET caching |
| `server/app.js` | Express app, middleware and API route registration |
| `server/routes/` | HTTP endpoints and route-level validation/authorization |
| `server/models/` | MongoDB/Mongoose models |
| `server/models/clubs/` | Clubs-specific persistence models |
| `server/services/ratings/` | Canonical match/player rating formulas and configuration |
| `server/services/statistics.js` | Match-derived statistics and leaderboard calculations |
| `server/services/playerAttributes.js` | Position-aware player attribute and OVR calculations |
| `server/services/clubs*.js` | Club synchronization, economy, betting, prediction, maintenance and settlement workflows |
| `server/config/clubsRules.js` | Shared Clubs limits, constants and date/contract rules |
| `tests/` | Unit, API, integration, and UI regression tests |
| `tests/e2e/` | Playwright end-to-end browser tests |
| `scripts/` | Bundle checks, MongoDB backup/restore and operational utilities |
| `docs/` | Architecture, Clubs rules, database operations and reliability guidance |
| `.github/workflows/` | Automated validation and scheduled backup/restore drill |

For architectural boundaries and the preferred approach to bug fixes, see [Architecture](docs/architecture.md).

## Requirements

- Node.js **24.x** (the version is specified in `.nvmrc`)
- npm
- A reachable MongoDB deployment for core Matchday data
- A Firebase project with Authentication configured for the sign-in method used by the app
- A separate Clubs MongoDB URI if you want Clubs fully available; it may share a cluster with the core database when deliberately configured that way
- A Gemini API key only if AI-generated editorial content is required

MongoDB Atlas is suitable for development. Workflows that use MongoDB transactions need a transaction-capable deployment, such as a replica set; a plain standalone local MongoDB instance does not support multi-document transactions.

## Local development

### 1. Install dependencies

Clone the repository, select the expected Node version, and install the lockfile-defined dependencies:

```bash
git clone https://github.com/jeswincode/gg-matchday.git
cd gg-matchday
nvm use
npm ci
```

If your shell does not support `nvm`, install Node.js 24.x using your preferred version manager.

### 2. Configure environment variables

Copy the example file:

```bash
cp .env.example .env
```

On Windows Command Prompt, use `copy .env.example .env`; in PowerShell, use `Copy-Item .env.example .env`.

Fill in the values for your environment. Keep credentials in your local, untracked `.env` file or the relevant deployment secret manager. Never commit real credentials.

| Variable | Purpose |
| --- | --- |
| `PORT` | API port; defaults to `5000` |
| `MONGODB_URI` | Core Matchday MongoDB connection string |
| `CLUBS_MONGODB_URI` | Clubs database connection string. If not configured or unavailable, the server logs a warning and core Matchday may still start, but Clubs will not be fully available |
| `CLUBS_DB_NAME` | Optional database-name override for the Clubs connection |
| `ADMIN_EMAIL` | Email that can receive administrator access when the Firebase identity proves that the email is verified |
| `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` | Server-side Firebase Admin credentials; the private key can use escaped newlines |
| `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID` | Firebase client configuration for the Vite app |
| `VITE_API_URL` | Optional API base URL for the frontend; defaults to `http://localhost:5000/api` |
| `CHAT_ENABLED` | Set to exactly `true` to enable the optional community chat; default is `false` |
| `GEMINI_API_KEY` | Optional Gemini API key for AI editorial generation |
| `GEMINI_MODEL` | Optional model override for editorial generation |
| `WEATHER_DEFAULT_CITY`, `WEATHER_TIMEZONE` | Optional weather defaults |
| `MONGODB_STORAGE_QUOTA_MB` | Optional quota value for the administrator database-health meter; defaults to 512 MB |

The full list and example values are in [`.env.example`](.env.example). Some deployments may configure optional variables through the hosting provider instead of a local file.

### 3. Start the API and frontend

Open two terminals from the repository root.

**Terminal A — API:**

```bash
npm start
```

For automatic server restarts during development, use `npm run server` instead.

**Terminal B — frontend:**

```bash
npm run dev
```

Vite prints the local development URL, usually `http://localhost:5173`. The API defaults to `http://localhost:5000`.

Configure both Firebase client settings and server-side Firebase Admin credentials if you need authenticated workflows. The frontend's Firebase configuration alone is not sufficient for the API to verify sign-in tokens.

## Authentication and permissions

- Users authenticate through Firebase; the API verifies Firebase ID tokens using Firebase Admin.
- A first-time user is created as a viewer unless the configured, verified administrator identity grants admin access.
- Editor and administrator actions are guarded by server middleware. Hiding a UI control is not a substitute for backend authorization.
- Users can request editor access; an administrator reviews access requests and can manage editor permissions.
- Profile changes submitted by a linked player are handled through a request/review flow rather than being treated as unrestricted profile edits.
- Community chat requires authentication and is disabled unless `CHAT_ENABLED=true`. The current implementation limits each user to three messages per calendar month and expires stored messages after five days.

## Useful commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start Vite frontend development server |
| `npm start` | Start the Express API |
| `npm run server` | Start API with Node's watch mode |
| `npm run build` | Create the production frontend build |
| `npm run preview` | Preview the built frontend locally |
| `npm run lint` | Run ESLint |
| `npm test` | Run Node test files matching `tests/*.test.js` |
| `npm run test:e2e` | Run Playwright browser tests in `tests/e2e/` |
| `npm run check:bundle` | Check built JavaScript bundle budgets |

Run the standard validation sequence before proposing a change:

```bash
npm run lint
npm test
npm run build
npm run check:bundle
npm run test:e2e
```

Playwright may need its browser dependencies installed on a new machine:

```bash
npx playwright install chromium
```

The end-to-end test configuration starts a dedicated test API and Vite server. It uses test-only authentication settings; do not use test credentials in a production environment.

## Domain rules and implementation guidance

- **Ratings:** Keep canonical formula weights, rating boundaries, and eligibility rules in `server/services/ratings/`. UI code and route handlers should call these services rather than implement their own formulas.
- **Statistics:** Use `server/services/statistics.js` for aggregation and sorting logic. Persisted player/season snapshots are maintained separately.
- **Match records:** A change to participants, goals, own goals, team scores or match status may affect match detail, ratings, player statistics, news, historical aggregates and Clubs synchronization. Check all dependent workflows.
- **OVR:** Player attribute calculations are position-aware and use recent performance. Check both the source data and calculated/derived attribute paths before changing them.
- **Clubs:** Treat the Clubs database and its wallet ledgers as separate from the core Matchday data. Keep economy changes in backend services and preserve transaction and idempotency protections.
- **UI and themes:** Preserve accessibility, keyboard navigation, mobile behaviour, Dark/Gold theme consistency and reduced-motion support when changing presentation.
- **Cache behaviour:** The frontend API client deduplicates pending GET requests and caches successful GET responses for 15 seconds. Successful mutations invalidate that cache. Investigate cache invalidation when data appears stale.
- **Bug-fix workflow:** Start with the owning feature, route, or service; check its tests and styles; then inspect shared code only when the issue crosses feature boundaries.

## Deployment and operations

The frontend and API are separate runtime concerns even though they live in the same repository. Configure the deployed frontend's API URL, the server's environment variables, Firebase settings, MongoDB access rules, and CORS policy for the intended production domains.

Before a production release:

1. Review the exact diff and confirm no secrets or local environment files are included.
2. Run the validation commands and resolve failures.
3. Review database/schema changes and take a verified backup before migrations or risky data operations.
4. Confirm environment variables and database access for both core Matchday and Clubs.
5. Verify the deployed frontend, API health endpoint, authentication, and the affected workflows after deployment.

### Runtime diagnostics

The administrator **Database Health** panel reads two protected APIs:

- `GET /api/system/database-health` reports application-level MongoDB data/index sizes, estimated collection counts, and usage against a reference threshold. Unless `MONGODB_STORAGE_QUOTA_MB` is explicitly configured (minimum 1 MB), the reference defaults to 512 MB. This is not an authoritative MongoDB Atlas cluster quota or billing metric.
- `GET /api/system/operations-health` performs live pings to the core database and configured Clubs database, and displays recent outcomes for Open-Meteo, Gemini and Matchday-to-Clubs synchronization, plus a bounded 15-minute API error/latency summary.

API telemetry retains at most 1,000 recent request observations, 50 recent server-error/slow-request incidents, and 100 route buckets per process. It records status codes, durations, request IDs and Express route templates—not query strings, concrete resource IDs, request bodies, or auth data. It shows 4xx/5xx counts, HTTP 429 counts, slow requests, average/p50/p95 latency, and safe recent incident references. Samples and route counters are process-local, reset when the API restarts, and are not a durable log or SLA. “Not observed” means no request has exercised that provider in this process.

Weather refreshes may return a previously successful stale cache when Open-Meteo fails; the response's `freshness` object labels that result and provides its age rather than presenting stale data as a new success. Provider health cards show recent failures and fallback use.

Backup/restore health is not inferred from provider or database telemetry. The dashboard clearly labels backup workflow evidence as **not connected** because the runtime does not currently query GitHub Actions runs or artifact storage. Use the [MongoDB Backup and Restore Drill workflow](https://github.com/jeswincode/gg-matchday/actions/workflows/mongodb-backup.yml) and its isolated restore results to establish backup creation, verification, and restore success separately.

### Automated backup and recovery

The repository includes a scheduled GitHub Actions workflow for encrypted core and Clubs MongoDB backups. The workflow validates the archives and restores them into isolated temporary databases before uploading encrypted artifacts, which are retained for 30 days.

Configure the required GitHub Actions secrets and variables as described in [Database Operations](docs/database-operations.md). The backup workflow needs Atlas service-account credentials to manage temporary network access when connecting to Atlas. Keep the backup encryption key separately from the backup artifacts.

Restore operations have explicit safety gates. Read the recovery documentation before using `scripts/restore-mongodb.sh`; never run restore tests against production. The automated restore drill is intended to restore into isolated temporary MongoDB databases.

For incident diagnostics and recovery procedures, see the [Reliability Runbook](docs/operations/reliability-runbook.md).

## Security notes

- Never commit `.env`, Firebase service-account JSON, private keys, MongoDB connection strings, API keys, or backup encryption keys.
- Configure `ADMIN_EMAIL` to the intended administrator identity and keep its Firebase email verification requirement intact.
- Do not set `E2E_TEST_AUTH_SECRET` or `VITE_E2E_TEST_AUTH_SECRET` in production. The server and Vite production build explicitly guard against these test-only settings.
- Do not widen MongoDB Atlas network access to `0.0.0.0/0` as a shortcut for development or backup jobs.
- Treat encrypted backups and their encryption keys as separate sensitive assets.
- Review dependency and GitHub Actions updates before merging them.

## Documentation

- [Architecture and feature boundaries](docs/architecture.md)
- [V3 Clubs specification](docs/v3-clubs-spec.md)
- [Database operations and backup/restore instructions](docs/database-operations.md)
- [Reliability runbook](docs/operations/reliability-runbook.md)

## Contributing

1. Create a focused branch from `main`.
2. Make the smallest change that fixes the issue or delivers the feature.
3. Add or update tests for the affected behaviour, including regression coverage when fixing a bug.
4. Run the relevant tests and the standard validation sequence.
5. Open a pull request with the observed problem, root cause, implementation summary, test results, and any deployment or migration notes.

GG Matchday is an actively developed project. The running state of external services and the live deployment must be verified independently from the source code.
