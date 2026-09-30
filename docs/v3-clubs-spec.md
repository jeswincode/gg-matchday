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
- At renewal, the captain(s) decide which 2 of the 4 players are retained.
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
- Betting is between the two clubs facing each other.
- The winning club receives the full amount staked by both clubs.
- Betting winnings never go to player wallets.

### Player economy
- Every player has a separate Clubs-mode balance.
- Player income includes signing payments.
- Player match rewards are individual awards such as MOTM and other defined club-match awards.
- Player wallets never receive match-betting winnings.

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

### Not yet implemented
- [ ] Full formation/invite/4-way agreement workflow.
- [ ] Admin approval workflow and rejection/resubmission UI.
- [ ] Captain voting UI/API and co-captain approval workflow.
- [ ] Contract-cycle renewal job/workflow.
- [ ] Retention selection and release-to-pool workflow.
- [ ] Auction/offer lifecycle and player selection.
- [ ] Join-request lifecycle.
- [ ] Player and club wallet mutation services with atomic balance/ledger updates.
- [ ] Club-match scheduling and acceptance UI.
- [ ] Sync from main Match Record into Clubs data.
- [ ] Club reward/MOTM settlement.
- [ ] Club-vs-club prediction engine.
- [ ] Player Reviews UI/API and eligibility checks against main Match data.
- [ ] Player Attributes/OVR calculation and traceable evidence.
- [ ] GG Player Card generation/sharing.
- [ ] Clubs mode navigation and charcoal/rose-gold visual system.
- [ ] Ultimate Clubs page.
- [ ] Responsive mobile QA for all new Clubs screens.

### Open product decisions
- Auction timing/round duration, bid increment and minimum bid.
- Betting stake limits and exact draw/cancellation rules.
- Exact reward amounts/formulas for club wins, MOTM, achievements and competitions.
- What happens when a club has fewer than two willing retained players at renewal.
- Exact Club Match request expiry/cancellation behaviour.
- Exact prediction weighting.
