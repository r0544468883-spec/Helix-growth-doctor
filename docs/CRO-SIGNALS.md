# HELIX Growth Doctor — CRO Friction Signals (built 2026-08-18)

## What & why
The behavior tag collected only pageviews / clicks / funnel-steps / returns, and the heatmap was always
`demoHeat`. Added the highest-ROI CRO signals **without a heavy dependency** — deliberately NOT rrweb /
OpenReplay (full DOM session-replay), which would break the lightweight, first-party **privacy moat**.
Same beacon style, no PII, no DOM recording.

## New signals (end-to-end, wired)
1. **`public/helix-tag.js`** now also emits:
   - `scroll` `{depth 0..1}` — deepest scroll, flushed on tab-hide/unload
   - `rage` `{x,y}` — 3+ clicks in <800ms within a small radius (frustration)
   - `dead` `{x,y}` — click on a pointer-cursor element that isn't a real control
   - `time` `{seconds}` — time-on-page, flushed on exit
2. **`lib/analytics.ts`**:
   - `heatFromEvents(client, ws, {page?, grid?})` — real click heatmap (rage clicks weighted ×3).
     **Replaces `demoHeat`** once traffic flows.
   - `frictionFromEvents(client, ws)` → `FrictionSummary` (rage/dead counts, avg scroll depth, avg time,
     top friction pages).
3. **`lib/doctor.ts`** `diagnose(funnel, cohorts, friction?)` — new deterministic insights:
   rage/dead-click friction (crit at ≥10 rage) and shallow-scroll (<40% avg), both `action:'landing'`.
4. **`app/page.tsx`** — fetches real heat + friction for the workspace, passes real `heat` to the
   dashboard and `friction` into `diagnose` (demo fallback preserved for empty workspaces).

## Verify
`npx tsc --noEmit` → 0 errors. Live check once a site embeds the tag: rage-click a dead element a few
times, scroll shallowly, then confirm the dashboard heatmap lights up and a "חיכוך UX"/"גלילה רדודה"
insight appears.

## Deliberately not done (heavier options)
Full session replay (rrweb/OpenReplay) — a separate, privacy-sensitive decision (records the DOM). If the
moat allows an opt-in replay tier later, rrweb (MIT, self-hostable) is the reuse candidate. Reuse index:
`Desktop/HELIX - מאגר מקורות סקילים MCP ואייגנטים.docx`.
