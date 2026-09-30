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
- [x] Review P0

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
- [x] Review P1

## P2 - depth
- [x] Canvas passive tree (shared tree, three class starts)
- [x] Classes: Strider (dex), Arcanist (int) with their skills
- [x] Crafting currencies + crafting bench UI
- [x] Loot filter (rules on rarity/slot/ilvl/affix count) + auto-salvage
- [x] Uniques
- [x] Review P2

## P3 - story
- [x] Acts 2 and 3 with story text, bosses
- [x] Ascendancy trials and two ascendancies per class
- [x] Review P3

## P4 - endgame
- [x] Maps with tiers and mods, map drops
- [x] Atlas tree
- [x] Pinnacle bosses
- [x] Infinite scaling (depth past tier 16)
- [x] Review P4

## P5 - ship
- [x] Balance pass with the headless simulator
- [x] Polish: tooltips, keyboard, perf audit, a11y basics
- [x] Launcher: user-installed addons from <Root>\addons\*.js
- [x] Install script for %LOCALAPPDATA%\DiscordQuestAgent\addons\arpg.js
- [x] FINAL_REPORT.md + screenshots
- [x] Review P5

## Round 8 - builds past level 26, feats, errands
Branch: `claude/nifty-gauss-gv1g8h`. Design notes: docs/ROADMAP.md, "Round 8".
- [x] Ascendancy nodes 7-8: the fourth trial's two points had nothing to buy
- [x] Late skills (six, levels 28-44) and supports (five, 28-40); supports with modifiers on the hero (Steadfast)
- [x] Ashfold map areas (three) and six map mods
- [x] Review A: background bug audit fixes + code review of the above
- [x] Feats, renown and titles (account-wide, kept across dawns)
- [x] Companion errands (idle companions fetch dust, currency, stones and maps, and grow)
- [x] Asked for on the way: sprite facing (lantern ghost, white-haired swordsman), Forge previews, a bigger passive tree
- [x] Balance pass with the bot, review B, docs, screenshots, changelog
- [x] More enemy sprites: three CC0 packs, five monsters with art of their own and a boss dragon

## Round 9 - mastery, omens, the pinnacle gate
Branch: `claude/nifty-gauss-gv1g8h` (restarted from main after 1.8.0). Design notes: docs/ROADMAP.md, "Round 9".
- [x] Skill mastery: skills grow with use, kept across dawns; a feat for mastery 10
- [x] Weekly omens: one per local week, shared by every player, never on pinnacles
- [ ] Balance: attack builds' late pinnacle survival (Iron Vow's cost), first relight toward 18-24 h
- [ ] Review C (mastery, omens) and fixes
- [ ] Docs, screenshots, changelog 1.9.0
