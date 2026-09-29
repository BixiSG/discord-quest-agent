# Hollowmarch - roadmap

Standalone idle action RPG that runs inside Discord as a Quest Agent addon.
It has no link to quests: it never reads quest data, orbs or completions.

Working branch: `feat/pet-addon-jjbs70` (carries the addon hub from v1.7.0).
Never push `main`: it feeds every user's self-updater.

Each loop tick takes the first unchecked item, finishes it with tests and a
green build, appends one entry to PROGRESS.md and pushes. The last item of
every phase is a code review by a subagent; confirmed findings get fixed
before the next phase starts.

## P0 - foundations
- [x] GDD, combat math, architecture docs (docs/GDD.md, COMBAT.md, ARCHITECTURE.md)
- [x] Toolchain: TypeScript strict, esbuild IIFE (ASCII-only), Vitest
- [x] Seeded RNG, stat/modifier engine, save envelope + migrations
- [x] Dev harness: plain browser page (dev/play.html) and the mock hub in dev/harness.html
- [ ] Review P0

## P1 - vertical slice
- [x] Content: Vanguard class, skills, supports, item bases, affixes, Act 1 zones + boss
- [x] Items: generation with affix tiers, rarities, item level
- [x] Combat sim: auto-combat over packs, deaths, flasks, boss
- [x] Progression: XP/levels, zone unlocks, auto-push
- [x] Offline progress + "while you were away" report
- [x] Headless balance simulator (tools/balance.ts)
- [x] UI: overlay window (Shadow DOM, drag/resize), launcher card, battle view,
      inventory/equipment, character sheet with DPS/EHP breakdown, skills
- [x] Saves: IndexedDB, export/import
- [ ] Review P1

## P2 - depth
- [ ] Canvas passive tree (shared tree, three class starts)
- [ ] Classes: Strider (dex), Arcanist (int) with their skills
- [ ] Crafting currencies + crafting bench UI
- [ ] Loot filter (rules on rarity/slot/ilvl/affix count) + auto-salvage
- [ ] Uniques
- [ ] Review P2

## P3 - story
- [ ] Acts 2 and 3 with story text, bosses
- [ ] Ascendancy trials and two ascendancies per class
- [ ] Review P3

## P4 - endgame
- [ ] Maps with tiers and mods, map drops
- [ ] Atlas tree
- [ ] Pinnacle bosses
- [ ] Infinite scaling (depth past tier 16)
- [ ] Review P4

## P5 - ship
- [ ] Balance pass with the headless simulator
- [ ] Polish: tooltips, keyboard, perf audit, a11y basics
- [ ] Launcher: user-installed addons from <Root>\addons\*.js
- [ ] Install script for %LOCALAPPDATA%\DiscordQuestAgent\addons\arpg.js
- [ ] FINAL_REPORT.md + screenshots
- [ ] Review P5
