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

## 4 - Review P3, P4 endgame
- Review P3 (6 findings, all fixed): rewards ledger (`world.rewards`) with an
  idempotent `reconcileRewards()` run on every load, so pre-P3 saves get their
  trial unlocks, act and trial points exactly once (v4 migration infers what
  P3 already paid); auto-push retreats out of trials; full-stash upgrades
  salvage the cheapest of stash + displaced items (never relics or crafted),
  with a log line; filter rules with only invalid conditions are dropped, not
  widened; ascendancy node validation; story beats share one window.
- P4: the Cinderlands. Maps (tier 1-16, then Depths forever: level 74+N,
  x1.06^N life/damage, more quantity/rarity), 10 map areas, 12 map mods,
  map crafting with the item currencies, map drops (Act 3 at 25%, Outskirts
  when out of maps), 18-node atlas tree (points per first tier clear, every
  fifth Depth, pinnacles), 4 pinnacle bosses behind sigils from map bosses,
  map death costs the map and 5% of a level, map auto-tiering (3 deaths ->
  a tier lower, 5 clean -> highest again). Atlas tab. Save v4. 92 tests.
- Balance (strider, 1 seed, 168 h): Act 3 done ~12 h, T8 at 48 h, T9 at
  144 h, level 63. Softer boss damage (-15-25%), +20 life/level, bigger life/ES
  affixes. Known: deaths ~30/h in maps stall levels, dust piles up unused;
  bot does not craft. P5 balance pass.
- Tools: tools/run-ts.mjs (run any TS tool), tools/make-save.ts (bot-played
  HM1 export), tools/shots-endgame.mjs (imports it and screenshots late views).

## 5 - Review P4, launcher + installer, balance pass
- Review P4 (5 findings, all fixed): map runs were discarded on every load
  (validate treated zone "map" as unknown) - the worst bug so far, now
  covered by a test; choosing a story zone in map mode leaves map mode and
  lets the running map finish; map mode before the endgame is repaired on
  load; auto-push keeps its own `autoCap` instead of overwriting the player's
  tier choice; the tier selector always shows the active cap.
- Launcher: `Get-AddonFiles` + `Invoke-AddonInjection` load
  `<Root>\addons\*.js` (user files win by name) and escape payloads to ASCII;
  `dev/test-addons.ps1` tests them against a fake `Invoke-CdpEval` (run with
  pwsh 7.4 here; the code sticks to 5.1 syntax). `arpg/install/` has
  Install-Hollowmarch.ps1/.bat and Uninstall-Hollowmarch.bat.
- Balance pass (bot, 3 seeds x 3 classes, 48 h):
  - Death probe: 80% of deaths were map bosses -> map bosses x0.6 life,
    x0.8 damage; map death XP 5% -> 3%.
  - Attack hit chance fell to ~39% at L67 (linear accuracy vs exponential
    evasion) -> base accuracy follows the evasion curve.
  - Auto-push advanced on clean clears only, so tanky heroes outran their XP
    (L22 in L37 zones at ~5% XP) -> push needs level >= next zone - 2; the
    map device keeps to tiers within hero level + 4.
  - Trials were never visited by auto-push (no ascendancy) -> auto-push tries
    an open trial at trial level + 2, retrying 3 levels later.
  - Dust piled up (1M) with no sink -> Forge a rare (40 + 6L dust, highest
    item level reached, crafted so it salvages as plain).
  - Tree: Vigour ring nodes +15 life and 3% increased life.
  Result at 48 h: Vanguard L73-74 T12-16, Strider L75-78 T13-16, Arcanist
  L79-80 Depth 2-5; deaths down from ~30/h to ~6-35/h depending on class.

## 6 - Polish, mana-honest DPS, pacing
- Polish: hero sprite holds the equipped weapon kind (bow, staff, wand, axes,
  maces, daggers, swords) and shows an off-hand; keys 1-9 switch tabs, Esc
  dismisses the top dialog (never confirms); tabs are role=tab with
  aria-selected, dialogs role=dialog, visible focus outlines; view signatures
  checked 4x/s instead of every frame.
- Perf audit (tools/perf.mjs, headless Chromium): 60 fps, median frame
  16.7 ms, no long tasks; a 24 h catch-up for a fresh hero takes ~1 s.
- Sheet DPS is mana-honest (`min(speed, manaRegen / manaCost)`); spell builds
  were running at a fraction of their shown DPS. Mana cost growth 2%/level.
  With it the bot picked sustainable builds and progression jumped, so the XP
  curve is now 3x (story ~8 h, maps over days, Depths after).
- Strider base life 52 -> 62 (it trailed on survival).
- Balance at 96 h (1 seed each): Vanguard L71 T17, Strider L63 T10,
  Arcanist L71 T17. Strider still the weakest; noted for later.
- Screenshots regenerated into arpg/docs/shots; arpg/README.md written.

## 7 - Review P5, final report
- Review P5 (5 findings, all fixed): forged rares roll bases the hero can
  wear and skip the loot filter (refused when the stash is full, before
  paying); the map device's XP cap yields to the player's tier and to level
  100, and is shown in the Atlas tab; mana sustain accounts for regeneration
  while travelling (fight share 0.6, matches the sim); auto-push's map cap
  only ever goes down. Launcher and installer: no findings. 99 tests.
- FINAL_REPORT.md written; roadmap complete.
