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
