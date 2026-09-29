# Hollowmarch - final report

Branch: `feat/pet-addon-jjbs70` (this session could not push `feat/arpg`; see
DECISIONS D1). `main` was never touched. Everything lives in `arpg/`, plus
the launcher change in `src/QuestAgent.ps1`, its test `dev/test-addons.ps1`,
the harness hook in `dev/harness.html` and ru/uk card strings in
`src/locales/`.

## What was built

A standalone idle ARPG that runs in Discord as a Quest Agent addon, with no
link to quests. All phases P0-P5 of the roadmap are done.

| Area | Result |
|---|---|
| Core | Pure deterministic sim (sfc32 RNG, no DOM or clocks, enforced by a test), 100 ms combat steps, offline catch-up through the same sim (24 h cap, ~1 s in the browser) |
| Content | 3 classes, 15 skills, 14 supports, 3 acts (21 zones, 3 trials, 9 bosses, story beats), 6 ascendancies, 300+ item bases, 44 affixes x 8 tiers, 10 relics, 129-node passive tree with 3 keystones |
| Economy | 10 crafting currencies, forge (currency or a rare for a slot for ember dust), ordered loot filter, auto-equip by build score |
| Endgame | Maps tier 1-16 with 12 mods, endless Depths, 10 map areas, map crafting, 18-node atlas, 4 pinnacles behind sigils |
| UI | Shadow DOM window (drag, resize, key isolation, keys 1-9 / Esc, ARIA roles), pixel battle canvas, 9 tabs: Hero (DPS/EHP breakdowns with modifier sources), Gear (compare deltas), Forge, Skills (support DPS deltas), Tree (canvas), World, Atlas, Log, Menu (export/import, filter editor). Launcher card in the 400 px hub panel |
| Saves | IndexedDB with rotating backup, hub-backed quick save on pagehide (Discord has no localStorage), HM1 export/import, save format v4 with migrations 1->4, validation + repair, rewards ledger |
| Tooling | TS strict, esbuild IIFE with an ASCII byte check (265 KiB), Vitest (99 tests), headless balance simulator with a bot player, Playwright smoke/screenshot/perf scripts |
| Install | Launcher loads `<Root>\addons\*.js` (user files win, payload escaped to ASCII), `arpg/install/Install-Hollowmarch.bat` and uninstaller |

## Screenshots

In `arpg/docs/shots/` (retaken after the art pass and rounds 3-4, a level-75
bot hero): character creation (01), battle (02), the "while you were away"
report (03), gear (04), hero sheet with its companion (05), skills (06), world
with contracts and the shrine (07), menu (08), passive tree (09), forge (10),
atlas (11).

## Quality

- Code review subagent after every phase: 11 + 9 + 6 + 5 + 5 findings, all
  fixed with tests. The worst: map runs were discarded on every load (P4),
  saves could destroy both main and backup (P1), older saves missed trial and
  act rewards (P3).
- Balance: bot runs showed and fixed attack accuracy collapsing (39% hit at
  L67), spells outscaling weapons 8x, auto-push outrunning its XP, trials
  never visited, mana-starved builds reporting fake DPS, and dust with no sink.
- Browser: 60 fps, no long tasks, no console errors in standalone and mock
  Discord runs.

## Balance snapshot (bot, 1 seed per class, simulated hours)

| class | 8 h | 24 h | 72 h |
|---|---|---|---|
| Vanguard | L52, T7 | L68, T14 | L70, T13-16 |
| Strider | L40, T1 | L59, T8 | L67, T12-13 |
| Arcanist | L46, T4 | L61, T11 | L70, T17 |

Story takes ~8 h, maps a few days, the Depths and pinnacles are the long
tail. Level 100 is far off by design (XP curve x3).

## Known gaps / next steps

1. **Late deaths**: past T13 heroes die ~30-50 times an hour, mostly to map
   bosses; auto-push handles it, but a smarter flask or a boss-only tier cap
   would feel better.
2. **Strider** trails the other two on survival.
3. **Pinnacles** were never beaten by the bot in 96 h; they may be too hard,
   or the bot too naive (it never crafts maps or items with currency).
4. **Localisation**: only the launcher card is in ru/uk; the game UI is English.
5. **Not tested on the live Discord client** from this sandbox: the harness
   mimics its CSP and hub, and IndexedDB/Shadow DOM were verified there by the
   user earlier. A first live run should check the addon card, the window
   over Discord's layers, and a close/reopen catch-up.
6. The launcher change reaches users only when this branch is merged; until
   then the installer warns that the agent ignores the addons folder.

## How to try it

    cd arpg && npm install && npm run check
    python dev/serve.py        # from the repository root
    # standalone:  http://127.0.0.1:8765/arpg/dev/play.html
    # mock Discord: http://127.0.0.1:8765/dev/harness.html?arpg=1&view=addon:arpg

On Windows with the agent installed: `arpg\install\Install-Hollowmarch.bat`,
restart the agent, Settings > Addons > Hollowmarch.
