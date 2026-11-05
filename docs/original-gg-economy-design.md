# Original GG — XP and Economy Design

## Product principles

- **Earned-only progression:** no real-money purchases or paid power in the initial release.
- **Server authority:** the API derives prices, XP, coin rewards, level gates and ownership. The browser sends action identifiers, not balances or reward amounts.
- **Auditable value:** every coin/XP grant and spend has a durable ledger entry; one-time rewards have unique claim records.
- **Two complementary tracks:** XP measures long-term participation; GG Coins are a spendable currency for cosmetics and home improvements.
- **Sources and sinks:** rewards enter through a small number of understandable activities and leave through optional customisation/upgrades.
- **Bounded earning:** global and source-specific daily caps limit farming while keeping normal play rewarding.

## Player progression

The player record stores:

| Field | Meaning |
|---|---|
| `xp` | Current lifetime XP total |
| `level` | Derived player level, capped at 100 |
| `xpIntoLevel` | XP earned since the current level threshold |
| `xpForNextLevel` | XP interval between this level and the next |
| `lifetimeXpEarned` | Auditable lifetime XP earned |
| `coins` | Current spendable GG Coin balance |
| `lifetimeCoinsEarned` | Lifetime coins earned, excluding spending |

Level threshold:

`XP(level) = floor(100 × (level − 1)^1.65)`

The curve starts accessible (level 2 at 100 XP), then gradually asks for more commitment. The level is recalculated on the server from total XP; the client never submits a level.

## Reward sources

| Source | XP | GG Coins | Rules |
|---|---:|---:|---|
| Original GG welcome tour | 40 | 20 | One-time per linked player |
| Training session | 8–54 typical; hard cap 60 | 4–13 typical; hard cap 14 | Derived from validated workout counts and duration |
| First training session achievement | 20 | 10 | One-time |
| Five sessions achievement | 35 | 15 | One-time |
| Ten sessions achievement | 60 | 25 | One-time |
| 500 recorded counts achievement | 30 | 15 | One-time |
| 2,000 recorded counts achievement | 75 | 35 | One-time |
| Level-up bonus | — | 15 per level gained, max 75 per reward event | Included in daily coin cap |

Training rewards use a bounded formula based on at most 200 counts and 30 minutes of duration. The client cannot choose the reward. Workout logs are still self-reported counters rather than biometric proof, so training rewards are deliberately capped. Competitive arcade challenge rewards remain disabled until the game can verify completion events rather than merely elapsed time.

## Daily limits

- Global daily cap: **250 XP and 120 GG Coins**.
- Training-only sub-cap: **150 XP and 70 GG Coins**.
- Caps use a UTC day key and reset at 00:00 UTC.
- The server records both global and training-specific totals in `worldDailyProgress`.
- Tutorial and achievement rewards share the global caps; they cannot bypass them.

## Currency sinks and unlocks

| Sink | Cost / gate |
|---|---|
| Silver Hair | 90 coins, level 1 |
| Golden Boots | 120 coins, level 2 |
| Neon Training Kit | 180 coins, level 3 |
| Residence level 2 | 293 coins, player level 2 |
| Residence level 3+ | `round(100 × nextLevel^1.55)`, player level must meet the target level |
| Residence cap | Level 10 |

Cosmetic duplicates increase inventory quantity. Equipping a cosmetic updates the saved avatar appearance and marks the owned inventory item as equipped. Residence upgrades debit the same wallet and write a ledger record in the same transaction.

## Transaction and abuse controls

- Authenticated player identity comes from the server session and linked player profile.
- Catalogue prices and level gates are server-owned.
- Purchases use a conditional balance debit (`coins >= price`) and an idempotency key bound to the requested item.
- Wallet debit, inventory grant and ledger write commit together in a MongoDB transaction.
- Reward claims use a unique `(playerId, sourceKey)` key; achievement records use unique `(playerId, achievementId)` keys.
- Reward, daily-progress and wallet changes share one transaction, so a failed write cannot leave a partial payout.
- Home upgrades are level-gated, balance-checked and idempotent.
- No coins or XP are awarded for idle presence or unverified challenge times.

## Persistence

All new collections live on the existing GG Clubs MongoDB connection. Existing Clubs wallets, transactions and V3 player records are not repurposed:

- `worldEconomies`
- `worldEconomyLedger`
- `worldInventoryItems`
- `worldDailyProgress`
- `worldRewardClaims`
- `worldAchievements`

## Tuning and release notes

The initial values are conservative starting parameters, not permanent balance claims. Before production release, playtest the time-to-first-cosmetic, daily earning pace and home-upgrade costs with real session data. Adjust the server-owned rules centrally, then rerun progression tests and review the ledger. Keep the no-real-money boundary for the first release.

## Design and security references

- Unity, *Building an in-game economy*: model currency sources and sinks together so rewards and spending remain balanced — https://unity.com/how-to/building-game-economy-guide-part-2
- Unity Economy documentation: separate currency, inventory items, purchases and server-authoritative configuration — https://docs.unity.com/en-us/economy
- OWASP, *Business Logic Security Cheat Sheet*: derive prices server-side, enforce workflow state, prevent replay and race conditions, and test business invariants — https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html
- MongoDB, *Transactions*: use multi-document ACID transactions when wallet, inventory and ledger changes must commit or roll back together — https://www.mongodb.com/docs/manual/core/transactions/
- MongoDB, *Atomicity and Transactions*: use conditional update predicates and unique indexes to protect concurrent balance changes and one-time claims — https://www.mongodb.com/docs/manual/core/write-operations-atomicity/
