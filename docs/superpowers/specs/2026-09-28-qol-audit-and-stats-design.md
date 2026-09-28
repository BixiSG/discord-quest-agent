# QoL audit, quest history and the Stats view

Date: 2026-09-28. Target release: v1.5.0 (agent script v16). Later iterations
of the same audit ship as v1.5.x.

## Audit findings

Ranked by what they cost a user today.

| # | Area | Finding | Iteration |
| --- | --- | --- | --- |
| 1 | Data | "Orbs won" sums the claimed quests Discord still lists. Quests drop out of the store when they expire, so the number **shrinks** over time and there is no record of what the agent earned. | 1 |
| 2 | Data | No history at all: nothing says what finished when, how many orbs a day/week brought, or how much time the agent covered. | 1 |
| 3 | Config | `config.json` keys `toast`, `theme`, `language` (documented in the README) and `sound`, `volume` never reach the agent: the launcher only reads and forwards the keys in its own default table. Setting them does nothing. | 1 |
| 4 | Claiming | Rewards have a claim deadline (`rewardsConfig.rewardsExpireAt`, else the quest's `expiresAt`). The HUD never shows it and never reminds; a reward left unclaimed past it is lost. | 2 |
| 5 | Claiming | The ready-to-claim notification fires once. Nothing nudges again. | 2 |
| 6 | Queue | Queued / available rows show task time, not when the quest itself expires. | 2 |
| 7 | UX | Progress reads `video 420/900s`: raw seconds. `7:00 / 15:00` scans faster. | 3 |
| 8 | UX | Idle panel never says when it last looked for quests, so "idle" is indistinguishable from "stuck". | 3 |
| 9 | UX | The panel position resets on every Discord restart. | 3 |
| 10 | A11y | Row tools are `display:none` until hover and rows are not focusable, so the keyboard can't reach them. | 3 |
| 11 | Support | Bug reports need the Diagnostics shortcut; the HUD could copy the same state to the clipboard. | 3 |

## Iteration 1 design

### Ledger (persistent history)

One entry per finished quest, stored next to the settings in the borrowed
iframe `localStorage` under `questAgent.ledger.v1`:

```
{ v: 1, quests: { <questId>: { id, name, app, task, orbs, reward, secs,
                               completedAt, claimedAt, byAgent } } }
```

- `completedAt` / `claimedAt` are epoch ms taken from Discord's `userStatus`.
  When the agent finishes a task before the store has caught up, the entry is
  created with `Date.now()` and corrected on the next sync.
- `reward` is the name of a non-orb reward (avatar decoration, in-game item)
  or null. `secs` is the task target, used for "time saved".
- `byAgent` is true when this agent ran the task to 100%.
- Sync walks the store every 15 s, after every scan and when the panel opens,
  and writes only when an entry changed. First run backfills every finished
  quest Discord still lists, so the view is not empty on day one.
- Capped at 1000 entries (oldest completion dropped first).
- Days are the PC's local calendar days (the user's own timezone).

### Stats view

A chart button in the panel header (and a click on the "orbs won" tile)
opens it. The top stat strip hides, like in Settings.

- KPI cards, two rows of three: orbs finished **today**, **7 days**,
  **30 days** (each with a quest count); **orbs claimed** lifetime (with
  "+N to claim"), **quests done** (with "since <first date>"), **time saved**
  (with the average per quest).
- **Last 14 days** bar chart: one bar per day, stacked claimed (green) vs
  waiting to claim (amber), hover for the day's totals.
- **Daily log**, newest first: a header per day with its orb total, one line
  per quest (task icon, name, completion time, orbs or reward, claimed / to
  claim chip). Unclaimed lines open the Quests page. Seven days with activity
  show by default, "Show older days" reveals the rest.
- **Copy as CSV** puts the whole ledger on the clipboard (Discord's own
  clipboard bridge, else `navigator.clipboard`).

"Orbs won" on the main view takes the larger of the store sum and the
ledger's claimed total, so it no longer shrinks.

### Config fix

The launcher's default table and the runtime object gain `toast`, `sound`,
`volume`, `theme` and `language`, so `config.json` defaults work as
documented. HUD choices still win over them.

### Testing

`dev/harness.html` fakes Discord's webpack modules, stores, API and title
bar, loads `src/quest-agent.js` with mock quests (running, queued,
available, claimable, skipped, a 20-day claimed history with a non-orb
reward) and is served locally for the built-in browser. It is not shipped:
the updater copies `src`, `scripts` and the root files only.

## Iteration 2 (v1.5.1): UI/UX pass, kept light

Shipped findings 4-10 above, plus a second audit aimed at weight and look.

**Runtime cost found and fixed**

| Where | Cost | Fix |
| --- | --- | --- |
| Panel tick (1 s) | Rewrote the pause button's SVG every second | Written only when paused state or language changes |
| Panel tick | Summed the whole ledger every second for "orbs won" | Memoised on the ledger revision |
| Panel open | Built the snapshot twice per refresh (panel + badge) | Badge reuses the panel's snapshot; closed panel updates the badge only |
| Badge (5 s) | Rewrote badge text, classes and title every time | Skips all DOM writes when count, pause state and language are unchanged |
| Status dot | `box-shadow` keyframes: a repaint every frame while working | Pulse ring on `::after` with `transform`/`opacity` only (compositor) |
| Title-bar observer | In floating mode, three `querySelectorAll` on every Discord DOM mutation | Coalesced to at most one check per second; a dropped button is still restored at once |

**Orb icon (option A from the legal review):** `findOrbGlyph` scans the webpack
factories once, in an idle callback (6 ms measured on build 621195, ~60 ms
worst case), for the component Discord passes as `orbIconHook`, resolves its
module, and keeps only path data that passes a strict SVG-path check. Nothing
of Discord's is in the repository; `NOTICE.md` says so. Fallback: our diamond.

**Claim deadlines:** `rewardsConfig.rewardsExpireAt` is consistently the
quest's `expiresAt` + 30 days (checked on 80 live quests). Rows count down in
the last week, red in the last day; one batched reminder per quest under 48 h;
lost rewards leave *Ready to claim* and show as "expired" in Stats.

**Design touches (all static CSS or one-shot, transform/opacity animations):**
Claim button + check mark on claimable tiles, quest-color accent bar on
running rows, a one-time green flash when a reward becomes claimable since the
list was last drawn, staggered grow-in of the chart bars, `m:ss` progress, a
clickable orbs-waiting bar, keyboard focus rings, and
`prefers-reduced-motion` switching every animation off.

**Next candidates:** copy diagnostics from the HUD (finding 11), and a
compact mode for small windows.

## Iteration 3 (v1.5.2)

- Finding 11 shipped: **Report a problem** copies an in-client diagnostics
  report (versions, Discord build and channel, hook health, HUD mode, agent
  state, settings, quest summary; no tokens or messages) and opens the bug
  form; Settings > Maintenance has **Copy diagnostics** on its own. The
  shortcut-based diagnostics stay for when there is no HUD.
- Compact mode: dropped. Discord's own minimum window size always fits the
  400 px panel, and the panel already caps its height at 76% of the window.

## Open proposals (need a decision, not built)

- **History backup on disk.** The ledger lives in Discord's storage, so a
  Discord reinstall or cache wipe loses it. The resident launcher could read
  it over CDP now and then, keep `history.json` in the install folder, and hand
  it back on injection so the agent merges what it's missing. Cost: a timer
  and a file in the launcher, and PowerShell 5.1 code that can only be
  verified at a real login.
- **Real "Scan now".** Scan re-reads Discord's quest store; it never asks the
  server. If Discord doesn't refresh quests in a long-running client, new ones
  show up late. Fixing it means calling Discord's own quest-fetch action,
  another internal to find and keep working.
