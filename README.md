# GG-Matchday

GG-Matchday V2 extends the existing v1.4 application in place. The React/Vite client and Express/MongoDB API remain the single application.

## Local setup

Copy `.env.example` to `.env`, fill in the Firebase, MongoDB, and Gemini values, then run `npm ci`, `npm run dev`, and `npm start` in separate terminals. Set `CHAT_ENABLED=true` only when the ephemeral monthly chat should be available.

The current branch adds match detail and MOTM voting, ratings and eligibility, formations, profile insights, achievements, awards, El Clásico history, Hall of Fame, player comparisons, editorial AI, and the responsive Golden Gooner theme with reduced-motion support.
