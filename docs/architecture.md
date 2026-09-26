# Phase 2 Architecture

## Domain boundaries

### `server/services/ratings/`
Single home for rating formulas, weights, thresholds, and rating-related tests.

- `config.js` — formula weights and eligibility constants
- `core.js` — pure rating calculations
- `index.js` — public rating-service API

**Rule:** future GG, offensive, defensive, result, or match-rating formula changes start here. Route handlers and UI should consume these functions rather than reimplement formulas.

### `server/services/statistics.js`
Builds statistics from matches and delegates rating calculations to the ratings service. It owns aggregation, not formula definitions.

## Frontend feature ownership

The Phase 2 frontend boundaries now cover the major application surfaces:

- `src/features/home/HomePage.jsx` — Home presentation
- `src/features/matches/MatchRecordForm.jsx` — Match Record editor presentation
- `src/features/calendar/Calendar.jsx` — calendar state, loading, month navigation, and day presentation
- `src/features/players/PlayersDirectory.jsx` — player directory presentation
- `src/features/players/PlayerProfile.jsx` — player profile presentation
- `src/features/admin/AdminPage.jsx` — admin access-control presentation
- `src/features/ratings/` — rating input configuration and labels
- `src/components/Leaderboard.jsx`, `Awards.jsx`, `Chat.jsx`, and `Clasico.jsx` remain self-contained feature components because they already have clear boundaries.

`src/App.jsx` remains the application shell. It owns authentication, permissions, top-level data loading, mutation workflows, tab/modal orchestration, and the callbacks/state passed into feature views.

**Rule:** feature extraction must preserve the existing API contracts, callbacks, permissions, UI classes, and mobile behavior. Business workflows stay in the shell until they have a clearly isolated service/hook boundary.

## Shared UI

Reusable presentation primitives live under `src/components/ui/`:

- `SectionHeading.jsx`
- `MatchHistoryCard.jsx`
- `AccessDenied.jsx`
- `match-history.css`

Date formatting is centralized in `src/lib/date.js`.

## Legacy cleanup

The obsolete v1.4 direct-DOM Record and Match History enhancement layers have been removed. Their active behavior is now owned by React feature/components.

The obsolete Vite Calendar transform workaround has also been removed now that Calendar is a real React feature component.

The v1.2 image optimization layer remains intentionally active because it provides framework-agnostic image delivery optimization and is not a feature-rendering workaround.

## Validation

The existing validation workflow runs:

1. `npm ci`
2. `npm run lint`
3. `npm test`
4. `npm run build`
5. server-side `node --check` syntax validation

It now also runs for the Phase 2 architecture branch, so future Phase 2 changes receive the same automated gate before being considered for promotion to `main`.

## App.jsx target

The Phase 2 target is now substantially realized: `App.jsx` is the application shell rather than the owner of every page's presentation. Further decomposition should be driven by concrete domain ownership or a measured maintenance problem, not by creating unnecessary tiny files.

## Debugging rule

When a bug is reported:

1. Identify the domain.
2. Start at that domain's component/service/hook.
3. Check its feature CSS or shared UI.
4. Check shared UI only if the issue crosses domains.
5. For ratings, inspect `server/services/ratings/` first.
