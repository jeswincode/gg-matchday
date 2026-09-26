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

### `src/features/ratings/`
Frontend rating-specific configuration and presentation helpers. Keep UI labels/input constraints here; do not duplicate server-side scoring formulas.

## Major frontend feature boundaries

The next extraction stages will group existing UI by domain:

- `src/features/home/`
- `src/features/matches/`
- `src/features/calendar/`
- `src/features/players/`
- `src/features/leaderboard/`
- `src/features/awards/`
- `src/features/chat/`
- `src/features/admin/`
- `src/features/ratings/`

Existing components can be moved into these domains incrementally. Each extraction must keep behavior unchanged and pass lint, tests, and build before merge.

## UI/UX structure

Global styles should eventually live under `src/styles/`, while feature-specific styles stay beside their feature. Legacy versioned DOM scripts should be removed only after their behavior has been reproduced in React.

## App.jsx target

`src/App.jsx` should become the application shell: authentication wiring, top-level navigation, route/tab composition, and shared modal orchestration. Data loading, match editing, calendar behavior, and large page views should live in feature components/hooks.

## Debugging rule

When a bug is reported:

1. Identify the domain.
2. Start at that domain's component/service/hook.
3. Check its feature CSS.
4. Check shared UI only if the issue crosses domains.
5. For ratings, inspect `server/services/ratings/` first.
