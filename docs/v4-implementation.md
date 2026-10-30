# GG Matchday V4 — Product and implementation notes

> Status: active development on \`GG-Matchday-v4\`. This document describes the current branch, not a production release. \`main\` remains the production V3 line until V4 is reviewed and deliberately merged.

## Product direction

V4 should feel like a football world, not merely a statistics dashboard. It preserves Matchday's data-first identity and the existing Dark/Gold visual language while borrowing product-design principles from Leaflet BookReader:

- A persistent sense of place, translated into football career spaces and Club headquarters rather than copying Pip, pixel art, or Leaflet's game assets.
- Progression should be understandable at a glance and tied to meaningful activity.
- Put the next useful action in context instead of overwhelming the user with competing prompts.
- Rearrange interfaces for mobile; do not only shrink desktop layouts.
- Keep optional practice and entertainment separate from official competitive records.

## V4 experience map

| Area | V4 experience | Source of truth |
| --- | --- | --- |
| Player profiles | Career Hub, dressing-room identity, record cards, honours cabinet, season archive, career timeline and milestone collectibles | Matchday player, match, statistics, award and achievement records |
| Ultimate Clubs | Club Headquarters, evolving home-ground/facility presentation, club record and recent history | Approved Clubs, completed synchronised ClubMatch records, roster and OVR snapshots |
| Play Centre | Penalties, crossbar, dribbling and free-kick arcade practice | Local practice simulation; best scores stored only in the current browser |
| Tactical Lab | 4v4 / 5v5 squad selection, formation choices, opposition scenarios and coach feedback | Existing player positions and available OVR snapshots; scenario rules are practice-only |
| Next objective | One current career milestone or the existing Clubs command-centre next action | Derived career statistics and the existing server-owned Clubs command centre |

## Implementation currently on this branch

### Player Career Hub

The Hub is integrated into each player profile and reads \`GET /stats/player/:id?historyLimit=all\`. It does not create replacement statistics or write to rating fields.

It presents:

- Player identity and jersey-number illustration.
- OVR only from the existing attribute snapshot passed by the profile.
- Career appearances, goals, assists, wins, clean sheets and average match rating.
- The next objective, calculated from career record counts.
- Milestone progression for appearances, goals, assists, clean sheets and wins.
- Collectible milestone levels, generated from achieved thresholds.
- Existing Award records and any Achievement records already stored.
- Season summaries and a recent-match timeline.

Milestone thresholds are deterministic and are unit-tested in \`tests/v4-career-progression.test.js\`. They are derived achievements, not wallet rewards or a claim that a new reward ledger exists.

### Ultimate Clubs Headquarters

The HQ is integrated at the top of the existing My Club dashboard. Existing squad, fixture, market, contract, wallet and administrative workflows remain in place.

Its visual spaces derive from:

- Completed, synchronised ClubMatch fixtures.
- The current Club roster size.
- The average availability of member OVR snapshots, using the existing all-members-complete rule.
- Club history records.

The stadium, training centre, academy and honours presentation are visual tiers. They do not spend or mint player credits, do not write to Club budgets, do not modify contract state, and do not alter market or auction behaviour.

### GG Arcade

The initial Play Centre includes:

- Penalty Shootout.
- Crossbar Challenge.
- Dribble Run.
- Free Kick.

Personal bests are deliberately local to the browser for this first slice. No arcade result is sent to the API, and the arcade does not create a global leaderboard. This prevents local practice scores from becoming a false competitive statistic.

### Tactical Lab

Practice challenges cover a high press, low block, counter-attacking threat and midfield overload. Players can create a 4v4 or 5v5 practice squad, choose a matching shape, select an approach and respond to the scouting scenario.

Tactical evaluation is a small pure module in \`src/features/play/play-engine.js\`. OVR contributes only when an existing player OVR snapshot is available; an absent OVR is excluded rather than invented. Scenarios and scoring have unit tests in \`tests/v4-play-centre.test.js\`.

Tactical Lab is a learning/practice simulation, not a match engine. It does not affect player ratings, OVR, match records, official standings or Clubs.

## Non-negotiable data and economy boundaries

1. **Match ratings remain canonical.** V4 does not recalculate, override or write match ratings, offensive/defensive ratings or OVR.
2. **Clubs money remains canonical.** V4 does not write to Club wallets, individual player wallets, auction offers, reward ledgers or betting/settlement records.
3. **Practice stays practice.** Arcade and tactical results never enter official match statistics or competitive leaderboards.
4. **Verified activity only.** Career progress reads server-provided Matchday statistics. Club progress reads approved Club and completed synchronised fixture records.
5. **No absence penalties.** The new experience does not decay career progress, Club facilities, awards or achievements when a player is inactive.
6. **No fabricated data.** Unavailable OVR, honours, history or fixture data are shown as unavailable/empty, not inferred.
7. **Existing product workflows stay intact.** The current Matchday and Clubs navigation and established workflows are retained; V4 adds the new spaces instead of replacing their operational logic.

## Deliberate first-release scope

These are intentionally not presented as completed features:

- Cross-device or account-wide arcade leaderboards.
- A server-backed cosmetic inventory or player-selected jersey wardrobe.
- New currencies, purchasable facilities, loot boxes or reward wallets.
- A live multiplayer tactical match simulator.
- A new Club competition/raid system.
- A new achievement writer or reward ledger.

Those features require product decisions and, where persistence or competitive state is involved, an explicit server-side design. The existing Achievement model is read by the profile endpoint, but a complete catalogue/unlock service is not assumed to exist.

## Further implementation sequence

1. Complete integration and responsive review of Career Hub, Club HQ and Play Centre.
2. Run the full Node test suite, ESLint and Vite production build; fix any regressions before asking for acceptance.
3. Review the full Career Hub and Club HQ on narrow mobile, wide mobile, tablet and desktop in both Dark and Gold themes.
4. Decide whether the cosmetic catalogue is derived-only or should be account-persisted across devices.
5. If account-persisted, add an authenticated, idempotent server-owned unlock ledger derived from eligible Matchday and approved Club events. Define replay/rebuild, backfill, eligibility, caps and administrative correction before enabling it.
6. Decide whether Arcade best scores should remain device-local or become account-linked; a global leaderboard would need anti-abuse validation and a clear separation from official football rankings.
7. Only after tests and product acceptance should this branch be proposed for a pull request to \`main\`.

## Verification record

The V4 work is committed directly to the isolated \`GG-Matchday-v4\` branch. Do not treat commits as proof of a successful local build. CI and the browser experience must be checked before merge or deployment.
