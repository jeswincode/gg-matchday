# GG Matchday V4

## Branch and environment

- The source of truth is `jeswincode/gg-matchday`. Use `v4/fresh-start` for V4 development, commits, pushes, and preview deployments. Verify the repository and branch before editing or publishing. If the checkout is on another branch or detached, switch to the existing V4 branch before making changes.
- Preserve `main` and the V3 production frontend, API, authentication configuration, and databases. Keep V4 changes, deployments, and configuration scoped to the [V4 preview](https://gg-matchday-git-v4-fresh-start-jeswincode.vercel.app/) and its `gg-matchday-v4-fresh-api` Render service. Keep the older `v4/development` service outside this workflow.
- Use local fixtures or confirmed V4-only resources for authenticated and write tests. Verify both the core and Clubs database targets before running any preview workflow that writes data. Treat production credentials, backups, and databases as out of scope for V4 tests, seeds, migrations, and restores. Keep secrets in untracked local configuration or the relevant secret manager.
- Read [the V4 handoff](docs/v4-handoff.md) for the active baseline, environment links, and known gaps. Follow [the architecture guide](docs/architecture.md) and [Clubs specification](docs/v3-clubs-spec.md) when changing the corresponding areas.

## Feature workflow

1. Work on one requested feature at a time. Define the affected roles, expected behavior, and desktop/mobile acceptance criteria. Trace the existing UI, API, and data paths before editing. Preserve the established Matchday and Clubs rules and server-side permissions.
2. Give buttons immediate pressed or pending feedback and prevent duplicate submissions. Show success when the API confirms it, keep errors recoverable, and preserve the shell and scroll position where practical. When other viewers should see a change, verify synchronization without a page reload, including reconnect or foreground recovery. Respect reduced motion and both Matchday themes.
3. Use Node 24 and `npm ci`. For feature changes, run `npm run lint`, `npm test`, `npm run build`, `npm run check:bundle`, and the relevant Playwright suites. For full browser verification, run `npm run test:e2e -- --project=chromium-desktop --workers=1` and then `npm run test:e2e -- --project=chromium-mobile --workers=1` so each gets fresh fixtures. Use independent browser sessions for cross-user changes.
4. Validate before pushing since Render auto-deploys V4 commits. For each feature release, verify the Vercel branch preview, the live Render API revision, and the affected workflow using V4 test data. Record the commit, results, and any unverified behavior. Update the handoff when the deployed baseline or a known gap changes.
