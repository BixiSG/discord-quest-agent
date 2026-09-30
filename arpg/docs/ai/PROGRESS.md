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

## 8 - Round 8: builds past level 26, feats, errands
Plan in docs/ROADMAP.md ("Round 8"); items in ROADMAP.md here. Built, each with
tests (287 at the end, from 250):
- Ascendancy nodes 7-8 (the fourth trial's points): one offence, one defence
  each; the attack ascendancies' defence nodes carry life and less damage taken.
- Six late skills (28-44) and five supports (28-38); Steadfast is the first
  support with modifiers on the hero, and the Skills tab shows EHP for it.
  Bows were ~4x behind melee: bow damage 2.0 per base, Grace gives projectile
  attack damage, Longdraw, stronger late bow skills.
- Ashfold in the Cinderlands: three map areas (13 in all, each with its own
  backdrop) and six map mods (18).
- Feats (37, renown 67 in all, 12 titles), earned retroactively on load; save v9.
- Companion errands (scavenge, forage, delve, scout; two hours, three at once,
  "keep them busy" on by default).
- Asked for on the way: the lantern ghost and the white-haired swordsman face
  the hero; the Forge previews what a currency, the hone or the bench would
  do on the item; the passive tree grew to 171 nodes (nine masteries, three
  far keystones).
- Review A (a background audit plus a code review of R8.1-R8.3), about 20 bugs,
  among them a map mod that did nothing, forged items stashed and salvaged at
  once, relights keeping the worse relic, a shared uid, upkeep ignoring its
  switch, unwearable off-hands, stale buttons, a Buy that was enabled but
  refused, and Forge until upgrade paying for an upgrade it then salvaged.
- Review B (feats, errands, tree, previews): 7 bugs, all fixed with tests - a
  feat lost when relighting right after the last pinnacle, errands that never
  came home while the hero kept dying, a scout that brought nothing after a
  relight, save ids like "toString" accepted (every validate lookup is
  own-keys only now), Forge previews freezing the tab, the errand picker
  resetting, unlabelled Wear buttons.
- Balance: the bot now clears with a pack-weighted score (the build score
  picked Heartseeker for the Strider's early game, a third slower) and fights
  pinnacles with its best single-target skill. Late skills retuned on
  bot-played heroes (Gravecleave, Tidal Crash, Sunpiercer, Blight Arrow).
  Dawn pacing: round 8 had every calling relight at 12-16 h and then every
  10-15 h for good; sun pinnacles +15% life and pinnacle toughness compounding
  per dawn (x1.15^d on top of the world's 10%): over two simulated weeks,
  dawns I-IV take 11-16 h each, then 15-35 h; Arcanist dawn VIII, Strider VI,
  Vanguard V - see GDD, "The dawn loop after round 8".
- Tools: `npm run smoke` was broken on main (a nav selector from before the
  rail); it tours all ten tabs again and fails on console errors.
- Enemy sprites: once opengameart.org was allowed, 28 CC0 candidates were
  compared on a contact sheet against the Gothicvania art; three packs were
  kept (ansimuz's Sideview Fantasy collection, LetargicDev's hooded ghost,
  Reemax's zombie). Five monsters that wore a tinted look-alike have their
  own sprites now (Drowned Wretch, Mire Hag, Gull, Eel, the Cinder Matron as
  a fire-breathing dragon), and the Chapel Keeper takes the freed shrieking
  shade. The packer gained "order" (RPG-maker walks play 0-1-2-1); every
  sprite was checked facing the hero, idle and attacking, in the battle view.

## 9 - Round 9: mastery, omens, the pinnacle gate
Plan in docs/ROADMAP.md ("Round 9"); 1.8.0 went live first (PR #2). Built, each
with tests (305 at the end, from 287), save v10:
- Skill mastery: kills made with a skill (a boss ten) raise it to mastery 10
  (1000 x n^2 points a level): 1.5% more damage a level, 10% less mana from 5,
  10% faster at 10. Kept across dawns; the Skills tab tags every skill, a new
  level is a toast, a chronicle line and an away-report line; feat Weaponmaster
  (38 feats, 13 titles, 69 renown).
- Weekly omens: seven, one per local week (Monday to Sunday, the player's
  clock), the same for everyone, never twice in a row; each a trade-off with a
  reward. The omen sits on the hero (sheet stays pure), leaves pinnacles as
  they are, and shows on the World tab with next week's.
- Review C: the omen order ran A-B-A-B across a cycle, a week that turned
  while the game was closed was never announced, pinnacles took the omen's
  hero side too, a clock moved back re-announced the week, the Hero tab's
  breakdowns missed supports and mastery, and the Salvage button showed dust
  without the dawn, perk and omen shares.
- Balance: Iron Vow's armour came free to casters (it slowed attacks only); it
  now slows both. A sun pinnacle with 35% more life and a 10% dawn step were
  measured and dropped (weak builds walled for days, strong ones barely
  slowed). EHP counted evasion against physical hits only, while the fight
  evades whole attacks; auto-equip swapped the Strider's evasion for energy
  shield and seed 777 stood at dawn 0 for 70 h. Fixed: first relight 15-22 h
  for every calling, dawns VI at 103-148 h (GDD, "The dawn loop after round
  8"). Left for round 10: the upgrade score (offence 0.6, defence 0.4) trades
  a shield for a glass cannon at dawn III.
- Screenshots 19 (omen card) and 20 (mastery tags) from a 40 h Arcanist save.
