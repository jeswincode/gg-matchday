# GG Matchday V3 — Clubs Specification

This document is the implementation checklist for the Clubs mode. The source of truth is the latest product decisions recorded for V3; implementation must be checked against this document after every feature slice.

## Locked rules

### Club formation
- A club has a maximum of 4 active players.
- Four players must mutually agree before a club can be submitted.
- The flow is: founder starts formation -> invites the other players -> all four accept -> club name proposal -> captain vote -> captain fills club details -> admin approval.
- Club names are globally unique.
- Once an official club name is approved, it is permanent.
- Rejected club applications expose the rejection reason and may be revised and resubmitted.
- A club always has at least one captain at every contract-renewal boundary.
- Formation is a viewer-only squad-layout choice inside My Club; it does not affect contracts, captaincy, Club identity or football results.

### Captain system
- Only the top two players in the club by OVR are captain candidates.
- All four players, including both candidates, vote.
- A tie creates two co-captains.
- Any captain-required decision in a two-captain club requires both approvals.
- If one co-captain leaves while the other stays, the departing co-captain does not need to appoint a replacement.
- If the last remaining captain leaves, the club must appoint a replacement before the renewal takes effect.

### Contracts and membership
- A player may have only one active club at a time.
- Contracts renew on the first day every other month.
- Example: a club formed on September 20 has its first renewal boundary on November 1, then January 1, March 1, and so on.
- At renewal, the captain(s) decide whether to retain 0, 1 or 2 current players within the finalized renewal rule.
- Released players return to the auction/player pool.
- Players may transfer or join another club only when their active contract ends.

### Auctions and signing
- Clubs bid money to sign an uncontracted player.
- The player chooses which offered club to join.
- The chosen club's captain(s) must approve the signing.
- The signing amount is paid by the club and credited to the player.
- A player cannot sign while active in another club.

### Club economy
- Every club starts with 3,000.
- Club balance changes through: starting balance + match rewards + club achievements + competition rewards + club-vs-club betting winnings - auction purchases/other approved expenses.
- Betting is placed by individual users on the two clubs facing each other.
- The stake is debited only from the user's Clubs Player Wallet, provided sufficient balance exists.
- Betting is 10–100 credits per user per fixture; a user may place one active bet per fixture.
- A user may not bet on their own Club's fixture.
- Betting locks when the scheduled match begins.
- The winning outcome receives the full stake pool, split proportionally among winning bets, and winnings are credited to those users' Player Wallets.
- Incorrect bets lose their stake; draws, cancellations and completed fixtures with no valid winning stake refund the stake to the users' Player Wallets.
- Betting has no GG Match rating effect and has no Club Wallet relationship.

### Player economy
- Every player has a separate Clubs-mode balance.
- Player income includes signing payments.
- Player match rewards are individual awards such as MOTM and other defined club-match awards.
- Player wallets receive signing payments, individual Club rewards and valid betting winnings.

### Club matches
- Clubs request future matchups with other clubs.
- The receiving club accepts or declines.
- Actual football match recording continues through the existing Match Record.
- The main GG match remains the single source of truth for the football result and player performance data.
- Completed club-match data is synchronized to the Clubs database.
- Club-vs-club prediction uses player stats, match history, ratings and the two clubs' head-to-head record.
- Prediction is informational and does not alter GG ratings.

### Reviews
- Reviews are stored in the Clubs database.
- A reviewer may review a player as a teammate only after they have actually played together.
- A reviewer may review a player as an opponent only after they have actually played against each other.
- Each reviewer/reviewed relationship permits one teammate review and one opponent review.
- Reviews contain a 1–5 star rating and written observation.

### Club formations
The selectable 4-player formations are:
- 1-2-1
- 2-1-1
- 1-3
- 3-1
- 2-2

### Club history
- Club history is permanent.
- A player's historical club relationships remain visible after leaving.

### Club mode
- Clubs is a separate product mode with its own navigation.
- Transition between normal Matchday and Clubs should be smooth and wave-like.
- Clubs visual identity: dark charcoal with rose-gold accents.
- Ultimate Clubs is a dedicated Clubs page; additional features will be added from later product decisions.

## Implementation status

### Phase 1 — data foundation
- [x] Separate Clubs MongoDB connection path.
- [x] Clubs database health endpoint.
- [x] Clubs metadata endpoint exposing locked constants.
- [x] Core club, contract, wallet, formation, auction-offer, match, betting, review and history models.
- [x] One-active-club database constraint on active contracts.
- [x] One-review-per-relationship database constraint.
- [x] Unit tests for locked formation, budget, contract-boundary and captain-vote rules.

### Implementation progress
- [x] Full formation/invite/4-way agreement backend workflow.
- [x] Captain candidate calculation, four-way vote and co-captain state.
- [x] Captain detail submission state and admin approval/rejection/resubmission backend foundation.
- [x] Responsive Clubs formation/captain UI foundation.
- [x] Viewer-only squad formation selector reserved for My Club pitch presentation.

### Remaining implementation
- [x] Admin approval management UI.
- [x] Contract renewal state, captain retention decisions and release workflow foundation.
- [x] Auction/offer lifecycle and player selection.
- [x] Join-request lifecycle.
- [x] Player and club wallet mutation services with atomic balance/ledger updates.
- [x] Club-match scheduling and acceptance UI.
- [x] Sync from main Match Record into Clubs data.
- [x] Protected and automatic Club reward/MOTM settlement: 100 win, 50 draw, 10 appearance, 25 MOTM, 10 clean sheet, plus 25/50/100/50 Club achievement milestones.
- [x] Club-vs-club betting settlement: 10–100 credits, pooled winner payout, draw/cancellation/no-winner refunds.
- [x] Club-vs-club prediction engine: 30% OVR, 25% recent form, 20% average Match rating, 15% record, 10% head-to-head.
- [x] Player Reviews API/UI and eligibility checks against main Match data.
- [x] Player Attributes/OVR calculation and traceable evidence.
- [x] GG Player Card generation/sharing.
- [x] Clubs mode navigation and theme-aware charcoal / warm metallic Clubs visual system.
- [x] Ultimate Clubs page.
- [x] Responsive acceptance matrix covered for 320/375/390/430/768/820/1024/1440 CSS layouts; physical-device QA remains deployment-dependent.

### Finalized product decisions
- Auction offers expire after 48 hours; minimum bid is 25 credits; each subsequent active bid must be at least 5 credits higher.
- At renewal, captains may jointly retain 0, 1 or 2 players. Retaining fewer than 2 archives/dissolves the Club at the boundary and releases all contracts.
- A requested Club Match expires at the earlier of 24 hours after creation or one hour before kickoff.
- Betting is 10–100 credits per user per fixture, one active bet per user, with full-pool winner payout proportional to winning stakes and refunds on draw/cancellation/no valid winner.
- Prediction weighting is 30% OVR, 25% recent form, 20% average Match rating, 15% record and 10% head-to-head.
- Reward values are finalized in the locked reward constants.
