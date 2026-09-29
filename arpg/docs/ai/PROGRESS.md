# Progress

One entry per loop iteration, newest last.

## 1 - P0 foundations + P1 slice (no review yet)
- Docs: GDD, COMBAT (formulas), ARCHITECTURE, DECISIONS D1-D6.
- Toolchain: TS strict + esbuild IIFE (`charset: ascii`, byte check) + Vitest; 51 tests
  (RNG, modifiers, saves/migrations, content validation, item rolls, stat sheet,
  sim determinism incl. sliced catch-up, core purity grep).
- Core: sfc32 RNG, StatBag, versioned envelope with HM1 export, Act 1 (7 zones,
  2 bosses), Vanguard with 5 skills and 9 supports, 300+ generated bases, 44
  affixes with 8 tiers, 100 ms sim with packs, flasks, ES, leech, deaths,
  auto-push, auto-equip by build score, loot filter.
- UI: Shadow DOM game window (drag/resize, key isolation), pixel battle canvas,
  HUD meters, Hero (DPS/EHP breakdown with modifier sources), Gear (compare
  deltas), Skills (support DPS deltas), World, Log, Menu (export/import).
  Launcher card for the hub panel (own shadow root), ru/uk card strings.
- Offline: catch-up in 25k-step slices with a progress modal and the "while you
  were away" report. 24 h of sim takes ~0.4 s.
- Balance (tools/balance.ts, 2 seeds): Act 1 done in ~1-2 h, level ~24 at 8 h.
  Fixed mana starvation (regen 7%/s). Deaths are high early; tune in P5.
- Dev: arpg/dev/play.html (standalone, CSP nonce), dev/harness.html `?arpg=1`,
  `npm run smoke` (Playwright, fails on console errors). Screenshots checked.
- Next: code review of P0+P1 (combined, since P1 landed in the same tick).

## 2 - Review P0+P1, P2 core
- Code review subagent: 11 findings, all fixed:
  1. saves are validated (`core/validate.ts`) before the game trusts them; bad
     main falls back to backup; import swaps state only after validation;
  2. switching the addon off no longer injects the standalone opener;
  3. auto-equip ignored problems-scored builds (buildScore returned 0);
  4. loop/open double-start guards; 5. window refits on resize;
  6. Menu no longer rebuilds while typing; 7. leech capped per second;
  8. spell base damage no longer scaled by effectiveness;
  9. COMBAT.md numbers match the code, pinned by a test;
  10. worn gear is never salvaged, stash-full salvage is logged, equip checks
      the cap; 11. backup rotates every 5 min, pagehide writes a sync
      localStorage quick save; paste/copy/input no longer bubble to Discord.
- P2 core: 129-node passive tree (3 starts, 9 themed branches, 18-node ring,
  3 keystones) with allocate/refund (dust), Strider (bow) and Arcanist (spells)
  with 10 new skills and 5 supports, 10 crafting currencies (deterministic
  crafting RNG), relics (10), rule-based loot filter, currency drops, save v2
  migration with fixture test. UI: Tree (canvas pan/zoom), Forge, filter
  editor. 72 tests.

## 3 - Balance bot, P3 content, Review P2
- tools/bot.ts plays the balance sim like a player: best skill + greedy
  supports, greedy passives and ascendancy nodes by build score.
- P3: Acts 2 (Glass Barrens) and 3 (Sunfall), 14 zones, 11 monsters, 7 new
  bosses, story beats (boss text, act outros, "The road remembers" modal and
  report lines), three trials (open after a set zone, +2 ascendancy points on
  first clear, auto-push returns to the road), six ascendancies (6 nodes each)
  chosen in the Tree view, +2 passive points per act boss, save v3.
- Retune from bot runs: spellScale 1.06^L (was 1.075^L, spells were 8x
  weapons), hero life +16/level (was 12), monster damage 1.055^L.
  24 h bot result: Vanguard L48 Act 3, Strider L53 Sunfall, Arcanist L54.
- Review P2 (9 findings, all fixed): full stash no longer blocks upgrades
  (weakest unprotected stash item is salvaged instead); validation sanitises
  filter rules, relic rolls, affix rolls, passives (connected, unique, within
  budget); crafted items salvage as plain (Kindling dust exploit); geometry
  and quick save go through a KV that uses hub storage in Discord (no
  localStorage there); reset clears the quick save; destroy/init races use a
  generation counter; bow swap with a quiver at a full stash works.
