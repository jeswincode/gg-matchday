# GG Matchday V4 — Product and implementation notes

> Status: active development on `GG-Matchday-v4`. This document describes the development branch, not a production release. `main` remains the production V3 line until V4 is reviewed and deliberately merged.

## Product direction

V4 should feel like a football world, not merely a statistics dashboard. It preserves Matchday's data-first identity and the existing Dark/Gold visual language while adapting useful product ideas from Leaflet BookReader:

- A persistent sense of place, translated into football career spaces and Club headquarters rather than copying Pip, artwork or source assets.
- Progression tied to meaningful and verifiable activity.
- A next useful action in context instead of competing prompts.
- Mobile layouts rearranged for real interaction, not merely scaled down.
- Practice and entertainment kept separate from official competitive records.

## V4 experience map

| Area | V4 experience | Source of truth |
| --- | --- | --- |
| Player profiles | Career Hub, dressing-room identity, record cards, honours cabinet, season archive, career timeline and milestone collectibles | Matchday player, match, statistics, award and achievement records |
| GG Grounds | Interactive football-campus map, draggable GG Scout companion, stadium, training, tactical, arcade, career and Club entrances | Existing Matchday/Clubs records and optional local practice data |
| Ultimate Clubs | Clickable Club campus map, Club HQ, clubhouse, Main Stadium, Training Complex, Transfer Office, Academy, Honours Hall and Operations Room | Existing Club APIs and approved Club state |
| Individual Training | Position-aware one-rep drills, immediate coaching feedback, accuracy and private session journal | Device-local, private training history |
| Club Training | Captain-created shared sessions, member invitations, RSVPs, captain attendance and completed-session history | New Club Training session records in the existing Clubs database |
| Play Centre | Penalties, crossbar, dribbling and free-kick arcade practice | Local practice simulation; personal bests stored in the current browser |
| Tactical Lab | 4v4 / 5v5 squad selection, formations, opposition scenarios and coach feedback | Existing player positions and available OVR snapshots; practice-only rules |
| Next objective | One current career milestone or the existing Clubs command-centre next action | Derived career statistics and the server-owned Clubs command centre |

## GG Grounds and Matchday navigation

Matchday keeps exactly five primary destinations: Home, Record, Leaderboard, Calendar and Players. Arcade and Tactical Lab are no longer primary tabs or mobile swipe destinations.

The Matchday header opens GG Grounds, and the floating GG Scout companion opens the same world. The companion can be dragged around the interface, offers short dialogue, has direct entrances to the map and Training Ground, and also supports keyboard activation.

The illustrated campus provides selectable buildings for:

- Main Stadium — opens Matchday match records.
- Training Ground — opens private, position-aware individual drills.
- Tactical Pavilion — opens the existing Tactical Lab.
- Arcade Pavilion — opens the existing arcade games.
- Dressing Room — opens the selected player's Career Hub.
- Ultimate Clubs Gate — opens the existing Clubs product.

The current map is an interactive illustrated campus with responsive building targets. It is not a 3D game engine or multiplayer world simulation.

## Player Career Hub

The Hub is integrated into player profiles and reads `GET /stats/player/:id?historyLimit=all`. It does not create replacement statistics or write to rating fields.

It presents player identity, career appearances, goals, assists, wins, clean sheets, average match rating, milestones, derived collectibles, local kit preferences, existing awards/achievements, performance analytics, season summaries and a recent-match timeline. A signed-in player's next career objective is also surfaced on the Matchday Home screen.

Milestone thresholds are deterministic and unit-tested in `tests/v4-career-progression.test.js`. They are derived achievements, not wallet rewards or a claim that a new server-side reward ledger exists.

## Ultimate Clubs Headquarters and campus map

The HQ is integrated into the existing My Club dashboard. The horizontal Club tab strip is replaced by a responsive illustrated campus map. The Club Plaza, Clubhouse, Main Stadium, Training Complex, Transfer Office, Academy & Scouting, Honours Hall and — for the dedicated admin-only experience — operations buildings route into real existing Club sections.

The map supports pointer/touch panning on its background. Selecting a building opens the matching workflow. Map panning is excluded from the old page-level swipe gesture so the same movement cannot accidentally change sections.

Existing squad, fixture, market, contract, wallet and administrative handlers remain in place. The map is a navigation surface, not a replacement business-logic layer.

The Club Headquarters presentation derives from approved Club state, completed synchronised ClubMatch fixtures, current roster size, available member OVR snapshots and Club history. Facility visuals do not spend or mint player credits, change contracts, affect market or auction behaviour, or write into wallet data.

## Individual Training Centre

Individual training is private by default. The initial programme contains decision drills for scanning, first touch, passing, finishing and defensive awareness. Drill selection supports both position abbreviations and full labels such as `CAM` and `Attacking Midfielder`. Unknown positions receive the complete programme rather than an empty result.

Each session presents one football situation at a time on a pitch view. The player makes one decision, receives immediate coaching feedback, sees progress through the repetitions, and completes with accuracy, duration and a private session record.

The journal is stored in browser local storage on the current device. It is not uploaded to an API, shared with Club members or used to modify player attributes. These are decision/awareness drills, not a physiological assessment or official skill rating.

## Shared Club Training Complex

Club training is separate from the player's private journal. It is backed by a new `ClubTrainingSession` model in the existing Clubs MongoDB database.

Current actions:
- Any current Club member can read their Club's team-session list.
- Only an elected captain can schedule a session.
- Captains choose a training focus and date/time; the current Club roster receives invitations by default.
- Invited members can accept or decline their invitation.
- Only a captain can mark invited members present/absent and complete a scheduled session.
- Completed sessions and their attendance history remain available to Club members.

The Club Training Complex is an actual destination on the campus map. The Training Centre facility tier progresses from completed shared Club sessions, not OVR. Club training does not create a new currency, consume Club or player credits, change player ratings/OVR, produce match results, or affect betting and settlement.

Integration tests in `tests/clubs.integration.test.js` cover permission boundaries, invitations, RSVP, attendance, completion, member visibility and wallet isolation.

Team sessions currently record schedule, participation and attendance; they do not yet include live chat, a real-time multiplayer drill, video upload, coach scoring, or a measured player-skill attribute. Individual practice remains private and device-local.

## GG Arcade

The existing Play Centre game logic remains the source for:
- Penalty Shootout.
- Crossbar Challenge.
- Dribble Run.
- Free Kick.

Personal bests are local to the browser and scoped to the player profile identifier where available. No arcade result is sent to the API, and the arcade does not create a global competitive leaderboard.

## Tactical Lab

Practice challenges cover a high press, low block, counter-attacking threat and midfield overload. Players can select a 4v4 or 5v5 squad, formation, approach and scouting response. The selected squad is visualised on a pitch.

Tactical evaluation lives in the pure module `src/features/play/play-engine.js`. OVR contributes only when an existing player snapshot is available; absent OVR is excluded rather than invented. Scenario scoring has unit tests in `tests/v4-play-centre.test.js`.

Tactical Lab is a learning/practice simulation, not a match engine. It does not affect player ratings, OVR, match records, official standings, Club Wallets, auctions or competitive rankings.

## Non-negotiable data and economy boundaries

1. **Match ratings remain canonical.** V4 does not recalculate, override or write match ratings, offensive/defensive ratings or OVR.
2. **Clubs money remains canonical.** V4 does not write to Club wallets, individual player wallets, auction offers, reward ledgers or betting/settlement records.
3. **Practice stays practice.** Arcade, tactical exercises and individual training never enter official match statistics or competitive leaderboards.
4. **Verified activity only.** Career progress reads server-provided Matchday statistics. Club progress reads approved Club and completed synchronised fixture/training records.
5. **No absence penalties.** Career progress, Club facilities, awards and achievements do not decay when a player is inactive.
6. **No fabricated data.** Unavailable OVR, honours, history or fixture data are shown as unavailable/empty, not inferred.
7. **Existing product workflows stay intact.** Matchday retains five primary tabs. Clubs navigation is map-first, but each building continues to use the existing permission-checked Club handlers and APIs.

## Deliberate first-release scope

These are intentionally not presented as completed features:

- Cross-device or account-wide arcade leaderboards.
- A server-backed cosmetic inventory or player-selected jersey wardrobe.
- New currencies, purchasable facilities, loot boxes or reward wallets.
- A live multiplayer tactical match simulator.
- Real-time shared Club mini-games, team video, or coach-scored skill assessments.
- A new Club competition/raid system.
- A full training curriculum writer or official player-skill attribute.

Those features require product decisions and, where persistence or competitive state is involved, an explicit server-side design.

## Further implementation sequence

1. Complete integration and responsive review of GG Grounds, the companion, Club campus map, private Training Centre, shared Club Training, Career Hub and Play Centre.
2. Run the full Node test suite, ESLint, production Vite build, bundle-size validation and Playwright browser flows; resolve failures before acceptance.
3. Review every map building, companion interaction, training loop and game entrance on mobile, tablet and desktop in Dark and Gold themes.
4. Decide whether player cosmetics and arcade records should remain device-local or become account-persisted; an account-wide competitive feature needs a server-owned, abuse-resistant design.
5. Only after validation and product acceptance should the branch be proposed for merge into `main`.

## Verification record

V4 changes are committed to the isolated `GG-Matchday-v4` branch. Commits are not proof of a successful build. CI and the browser experience must pass before merge or production deployment.
