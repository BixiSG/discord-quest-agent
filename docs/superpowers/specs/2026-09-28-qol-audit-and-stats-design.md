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
