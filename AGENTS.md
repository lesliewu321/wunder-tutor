# Wunder Tutor — instructions for agents

Read `HANDOFF.md` before anything else: current state, what is live, what is in progress, how to add seasonal
lessons, commands and gotchas. `CLAUDE_HANDOFF.md` is the long history with the reasoning behind each decision.

Leslie's standing rules (details in HANDOFF.md):

- Deploy to the web only (`npm run deploy`), and only from a clean tree — never ship uncommitted, unfinished work.
  No APK / AAB / iOS builds until Leslie says so.
- Never print or ask for secret values; Leslie runs `npm run keys:push`.
- Don't push to GitHub unless asked. Don't stop Leslie's own dev server on port 5173.
- Wrangler KV / R2 commands need `--remote`.
- Every new app language and every new lesson, conversation, bonus activity and Scan feature must be translated
  across all supported app languages. Include those permutations in translation checks (Leslie, 2026-09-25).
- Children's recordings stay gitignored. Leaderboards show only avatar, random handle and two-letter region.
- Before finishing: `npm test`, `npm run typecheck`, `npm run content:check`, `npm run i18n:check`; then add a dated
  note to HANDOFF.md with the commit and the Pages deployment id.
