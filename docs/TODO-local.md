# Local session to-do: Orbling (pet) + Hollowmarch (idle ARPG)

Branch: `feat/pet-addon-jjbs70`, with both addons plus the launcher change.
`main` is untouched; do not merge or push `main` until the user signs off.

## >>> NEXT SESSION: start here (Round 7 done 2026-09-29: Act 4 shipped to the PR)

State: branch `feat/pet-addon-jjbs70` pushed; PR https://github.com/BixiSG/discord-quest-agent/pull/1
(1.7.0, open, no CI in the repo). Save v8, 229 tests, en/ru/uk. Act 4 (Ashfold) is in.

Live on this PC (2026-09-29 16:10): Discord restarted with port 9222 by the BRANCH agent, started
hidden by the scheduled task "QA dev branch hidden" (wscript src\launch.vbs -NoUpdate); the Act 4
build is hot-swapped in (the user's hero: L45 arcanist, v8, past the Sunfall so maps stay open).
The INSTALLED agent (v1.6.1, attach-only) was stopped to keep it from injecting its old v20 agent
first; at the next login Vencord Watch starts it again and the branch agent is gone, so Hollowmarch
disappears until either the PR is merged (the installed agent then updates itself to 1.7.0 at its
start - the 6-hourly check is new in 1.7.0, 1.6.1 only checks at start) or the branch task is run.
Repo-root `addons\arpg.js` is a copy of the shipped build (user addons win over src/addons).

Open, needing the user:
- [ ] Merge PR #1 (ships 1.7.0 to everyone through the updater).
- [ ] After the merge: restart the installed agent here (or reboot) so it updates; then delete the
      tasks "QA dev branch run" and "QA dev branch hidden" and the repo-root `addons\` copy.

Round 8 candidates besides E:
- [ ] Attack builds vs pinnacles: two-handed Vanguards/Striders die before the enrage window
      (survival, chaos res 0); the Hollow Crown is only beaten by invested casters. The Strider is
      weakest overall (one seed never relights in 160 h). Measure with `tools/dawns.ts` (3 callings
      x 2 seeds) and `tools/pinnacles.ts <dump> invest level=88`; dumps via `DUMP=dir`.
- [ ] Stone pouch overflow late (hundreds of Radiants with every socket full): a use for them.

Working rules (from memory, repeated so nothing is lost):
- `cd arpg && npm run check` after every change (tsc + vitest + build; the build also writes
  `src/addons/arpg.js`). Commit as BixiSG, **no Co-Authored-By trailer**. No push without the user.
- All game text goes through `arpg/src/i18n` (en source, ru/uk complete - tests enforce parity);
  core errors need an `err.*` key or a pattern in `i18n/errors.ts`; `pushLog` takes a key.
- Screens: `arpg/tools/cdp/` (README there) - headless Chrome shots, one small JPEG sheet.
- Live deploy: `arpg/tools/cdp/live-read.mjs` (check), then `live-hotswap.mjs` - never a plain
  reload while the dev agent is down. Balance: `tools/probe.ts`, `tools/pinnacles.ts`.
- Orbling and Hollowmarch are separate projects: no crossovers.

### A. Ship readiness (first; the push itself needs the user's yes)
1. [x] Addon size: shipped `src/addons/arpg.js` is minified with ru/uk packed (deflate + base64,
       sync inflater `i18n/inflate.ts`, decoded on first use): 1390 -> ~740 KiB; CDP payload
       1.57 MB -> ~775 KB, PS 5.1 prep ~70 ms. `dist/` stays readable; `?shipped=1` on
       dev/play.html and the harness runs the shipped file.
2. [x] Not stuck: a real-session probe (scheduled task) shows the install at **v1.6.1**, self-updated
       2026-09-29 06:49, resident since 12:49 (PID in QuestAgent.ps1 -AttachOnly). "v1.4.3" was the
       tool shell's stale virtual copy of `%LOCALAPPDATA%\DiscordQuestAgent` (see memory
       tool-shell-job-kills-children). Real gap fixed: the resident agent now re-checks for updates
       every 6 h (it only checked at start). After 1.7.0 merges, this PC updates by itself at the
       agent's next check/start; the page picks it up on the next Discord reload. The branch task
       "QA dev branch run" can be deleted then.
3. [x] Release pass: harness (hub v22, Orbling window + Esc, Hollowmarch card -> game, en/ru, no
       errors), `dev/test-addons.ps1` on PS 5.1 7/7, CHANGELOG 1.7.0 dated 2026-09-29, README shots
       12-15 + 05-hero-ru. **Open: the user's go for push + PR `feat/pet-addon-jjbs70` -> `main`.**

### B. Timely content: October
4. [x] Hollow Night (`core/season.ts`, GDD section): lantern-touched monsters (5%, pumpkin over the
       head), lantern-lit maps, The Hollow Grin (relic), Pumpkin Wisp (companion), lantern contract,
       World card, quest-panel ribbon, story beat; `state.tz` from the UI; `?hollow=1` forces it.

### C. Polish what round 5 added
5. [x] First-time hints (one line, dismissible, once each): Market, sockets, stone pouch, echoes,
       the Rekindling; Menu > "Show hints again".
6. [x] Sounds for stone found (good tiers), echo heard, market buy, relight (synth in `ui/sfx.ts`).
7. [x] Gear tab: socket pips on item cells (filled/empty), a "has empty sockets" filter, and a text
       search over names and affix lines (works in all three languages).
8. [x] Keyboard: Market buy/refresh and Forge socket controls reachable and labelled; focus kept.
9. [x] Split `ui/views.ts` (1,260 lines) into per-tab modules (hero, gear, skills, world, log, menu,
       creation) - a pure move, checked with the shots scenario.

### D. Balance (measure with the tools first)
10. [x] Dawn loop: the bot invests (hone, drill, temper, stones, market) and goes for missing shards
        first. Found: tanky casters outlasted pinnacles (dawn VII in 160 h), attack builds never beat
        the King. Now pinnacles enrage (90 s, +2%/s), the King/Choir are retuned, dawns are 10%
        tougher: first relight 18-36 h for every calling, the loop slows at dawn II-IV (GDD).
11. [x] Dust still inflated with investing (11M at 240 h). Sink: Temper relics in the Forge (a roll
        moves toward its best, never worse; 200 x ilvl x 1.4^n). Also fixed: the relic case kept the
        worse Voidsinger (a downside roll now scores better low).
12. [x] The Hollow Crown opens at dawn II; first kill: one more perk for good + Crownbreaker. Tuned to
        stay harder than the King for every hero measured; an invested dawn II caster wins it.

### E. Bigger content (one per session, pick with the user)
13. [ ] Skill mastery: skills and supports level with use (small % bonus), bars on the Skills tab.
14. [ ] Feats: lifetime milestones with titles and small rewards (stash room, a perk reroll).
15. [ ] Build loadouts: save/restore skill + supports + gear (+ passives with a dust respec cost).
16. [x] Act 4, Ashfold (round 7): 7 zones L42-50, Trial of Lanterns, 6 monsters, 3 bosses, 2 relics,
        companion Wick, spell impacts. Art: Gothicvania Town + Magic Pack 9 (user OK'd, CC0) plus
        unused cemetery/night-town art. The Lamplighter opens the maps; save v8 keeps them for heroes
        already past the Sunfall. Round 8 picks from 13-15 or the balance items above.

Orbling (separate project, only if the user asks): section 1's live checklist was never run.

Recommended order: A1-A3 (ask about the push), B4, then C5-C9, D10-D12, then pick from E.

## 0. Run the branch on this PC
- [x] Close the installed agent.
- [x] Check out `feat/pet-addon-jjbs70` in a working copy (used the repo folder itself: a new folder
      created from Claude's tool shell, e.g. `%USERPROFILE%\qa-dev`, is invisible to the real session).
- [x] Copy `%LOCALAPPDATA%\DiscordQuestAgent\config.json` into the working copy (keeps the debug port).
- [x] `mkdir addons` + `copy arpg\dist\arpg.js addons\` (the launcher loads `<Root>\addons\*.js`).
- [x] Start with `.\Start-QuestAgent.bat -NoUpdate` (without `-NoUpdate` the updater pulls `main` over the branch).
      Started through a scheduled task so it runs in the real session; it restarted the portless
      Discord with port 9222 and injected agent v21 with both addons registered.
- [ ] In Discord: quest panel > Settings > Addons > switch on Orbling and Hollowmarch.

## 1. Orbling (pet, v1.7.0, `src/addons/pet.js`)
- [ ] Header button appears, view opens, pixel room renders (day and night).
- [ ] Hatch the egg, feed, play, clean, nap; needs drain over time.
- [ ] A finished orb quest drops food; claiming a reward makes it celebrate.
- [ ] Hats, daily gift, streaks, Orb catch mini-game (arrow keys).
- [ ] ru/uk texts, dark/light theme, no console errors.
- [ ] Decide: balance, art or mechanic changes wanted?

## 2. Hollowmarch (idle ARPG, `arpg/`)
First live run (never tested in real Discord, only the mock harness):
- [ ] Addon card shows in the panel (ru/uk card strings too).
- [ ] "Start a hero" opens the game window above Discord (z-index 10050).
- [ ] Drag, resize, 1-9 tabs and Esc work; typing or pasting in the game does NOT reach Discord's chat box.
- [ ] Character creation, then battle canvas animates, loot drops, auto-equip works.
- [ ] Close the window, wait a few minutes, reopen: catch-up progress and the "while you were away" report.
- [ ] Restart Discord: the hero loads from IndexedDB; the window position is kept (hub storage, since Discord has no localStorage).
- [ ] Menu > Export / Import round trip.
- [ ] Switch the addon off in Settings: the window closes cleanly and no stray button is left on the page.
- [ ] DevTools console: no errors or CSP violations.

Play-feel review (user's call):
- [ ] Look and feel: neo-brutalist UI, pixel art, readability at the default size.
- [ ] Pacing: story about 8 h idle, maps over days. Too fast or too slow?
- [ ] Known balance gaps: late map deaths (30-50/h, mostly map bosses), Strider weakest, pinnacles maybe too hard.
- [ ] Localisation: only the card is in ru/uk; translate the game UI?

## 3. Installer / launcher (Windows PowerShell 5.1)
- [x] `powershell -NoProfile -File dev\test-addons.ps1` passes on 5.1 (it was only run on pwsh 7.4).
      Passed on 5.1.26100 (7/7).
- [ ] `arpg\install\Install-Hollowmarch.bat` against a real install warns that the old launcher ignores `addons\`, then the uninstaller removes it.

## QoL and UI loop (2026-09-29, local commits only, nothing pushed)
- [x] Hub: any switched-on addon can get its own button in Discord's title bar (Settings > Addons,
      nested row). Addons may define `launch(api)` for what that button does.
- [x] Hollowmarch frame: pixel-glyph nav rail with hotkeys and counters, vitals column next to the
      battle, XP strip with time-to-level, stage size toggle (normal/large/hidden), mini strip that
      keeps playing, maximize (double-click title), stacked toasts for rares, relics, levels, roads.
- [x] Hollowmarch views: gear/stash side by side with filters, upgrade markers and E/S keys;
      skills as flat lists with per-skill DPS and best-swap supports; log filter chips.
- [x] Orbling QoL: hub `api.status()` tooltips on its buttons, next-need forecast, opt-in eating
      quest food on its own.
- [x] Hollowmarch art pass (user picked CC0 packs + brutalist pixel): animated Gothicvania heroes and
      monsters, parallax backdrops, pixel HUD (globes, skill cooldown, XP), synthesized sound with mute.
- [x] Every tab reworked so it reads as a game, not a web page: pixel frames and pixel type, Dungeon
      Crawl item icons, Gear paper doll with hover-compare and drag and drop, Hero character sheet,
      Skills socket bar, World act roads with scenery, Forge smithy with currency orbs, Tree as an
      ember constellation, Atlas ladder and map thumbnails, Log journal icons, Menu switches.
- [x] UI states pass (user, 2026-09-29). Mini strip: dialogs wait hidden behind a strip row that
      brings the window back, replay progress and toasts live in the strip, Esc is inert. Creation:
      no stage/mini buttons. Narrow/small windows: grid can't outgrow the window, all 9 tabs in the
      icon row, flexible skill sockets. Dead: HUD globe reads DEAD + seconds. Gear: stash-full bar,
      empty-stash text, 2-hand/Quiver off-hand. World: cleared acts fold, map-mode note, opens on
      the hero. Atlas before endgame: gate, act progress, dark ladder. Forge: dust-needed note.
      Tags readable on gold/teal rows. Keyboard: slots/rack focusable, focus tooltips, focus kept
      across rebuilds. Sound now starts off (old saved "on" ignored).
- [x] Quest-panel card in the game's look, with closed / playing / in-the-strip states and
      Show / Fold / Full window actions (ru/uk strings). Creation screen with class portraits.
- [x] Atlas as an 8-bit palette PNG: build 1.2 MB -> 610 KiB.
- [x] Round 2 from the user's live screenshots (2026-09-29): mini strip is the fight itself (no
      title bar/logo/event line), windows stay under Discord's title bar, tree node card as a
      popup, Gear without the hint card (help behind [i], picked item as a popover), the game's
      own tooltips for every title, and the pixel font everywhere ("Hollow Pixel", generated by
      `npm run font`, loaded from bytes - CSP-safe, checked live).
- [ ] Live look in Discord: round 2 is copied to the checkout's `addons` folder but Discord was not
      reloaded (the game was open in the strip); it goes live on the next reload.
- [ ] Balance note from the bot saves: map auto-push drops the tier after 3 deaths, then after 5
      clean maps goes straight back to the top tier and dies 3 more times (each death costs the map
      and 3% of a level). Stepping the cap up one tier at a time would stop that loop. Not changed.

## Round 3: QoL, inventory, content (2026-09-29, local commits only, nothing pushed)

Ask: "another round of QoL, what content we can add, go over all the mechanics (especially inventory
management); Orbling in its own window, not inside the quest panel".

Findings from a bot run (`tools/_probe.ts`, Vanguard, 48 h, bot spends passives and forges):
- The stash is 60/60 after 1 h and never moves again: by 2 h all 60 are rares 10+ levels behind the
  hero (old gear that auto-equip pushed into the stash). Every new keeper is salvaged instead of the junk.
- Auto-equip only looks at new drops: a stash item whose level requirement is met later is never worn.
- Dust and currency pile up with nothing to spend them on: 337k dust and 1.8k Kindling at 24 h.
- Map deaths run away late: 462 at 24 h, 1531 at 48 h, level stalls at ~70. Auto-push drops the
  cap after 3 deaths, then after 5 clean maps jumps straight back to the top tier (the loop noted above).
- 10 relics for 100 levels; nothing to collect or aim for between pinnacles.

Done (each step: tests where it is core, `npm run check`, a commit; 128 tests):
1. [x] Orbling window (hub + pet.js): `window: { w, h }` addons open in a floating hub window
   (`.qb-aw`, z 10002, drag, Esc, position in `SETTINGS.winPos`, under Discord's title bar,
   remount on theme/language); header button, title-bar button and switch-on open it.
2. [x] Stash upkeep, locks, relic case (best copy per relic, off-stash), codex (+1% rarity per
   relic), level-ups wear stash upgrades. Save v5 (moves stash relics into the case).
3. [x] Stash room for dust (+10 per purchase, 60 -> 150, 250 dust rising x2.2).
4. [x] Bulk tools: Equip upgrades, Salvage outdated/plain/enchanted/marked (shift-click), lock (L).
5. [x] Forge: Hone (quality 0-20), Bench (chosen affix, 3 Graft + dust), Forge until upgrade,
   Reroll until upgrade; worked items lock.
6. [x] Maps: the device dampens deeper maps to the auto-push cap (it ignored the cap when only
   deeper maps were held - the real cause of the death loop); 2 failed maps lower the cap, 8
   clean raise it one tier. Bot Vanguard at 48 h: level 79 (was 71), half the deaths.
7. [x] 16 more relics (26 total), codex in the Gear tab's Relics chip.
8. [x] UI for all of it (Gear, Forge, Menu upkeep switch, filter "base N+ behind", away report
   lists swaps and new relics). Checked in headless Chrome against bot saves.
9. [x] Contract board on the World tab (3 goals, ~20-35 min each, dust + currency, sometimes a
   missing relic / 3 maps / a sigil; reroll for dust; World tab counter).
10. [x] Docs (GDD, arpg README). `tools/probe.ts` prints a long-run health report.
    Build copied to `addonsrpg.js`; NOT live yet: the game was open (mini strip) in Discord,
    so no reload. The user's real save (v4, level 29) was read over CDP and run through the v5
    migration offline: fine (4 relics to the case, upkeep swapping, 2 h sim in 235 ms).

Follow-up loop (2026-09-29 afternoon):
- [x] Upkeep no longer hoards gear far above the hero's level (worth -3 per level beyond +2):
      the 24 h bot run keeps 0-5 such items instead of 60.
- [x] Worn items marked in every item list: gold frame + worn tag in the Gear group filters (worn
      pieces listed first), the codex and the Forge rack (grouped Worn / Stash / Relic case); hover a
      stash item and the doll slot it would replace glows, hover a slot and the fitting items light up.
- [x] Windows come back after a Discord reload or restart: hub addon windows (`SETTINGS.winOpen`)
      and the game (hub key `reopen`, back in the strip if it was folded). Closing by hand forgets it.
- [x] Live: build copied, game closed cleanly (with the reopen flag), Discord reloaded at 12:32. The
      branch agent was not running any more (its task ended at 7:16; whatever kept it alive until
      11:01 was gone), so it was restarted with `Start-ScheduledTask 'QA dev branch run'`. After the
      inject: agent v21, the game reopened in the strip, the save is v5 (level 34, stash 58/60, 4
      relics in the case, 3 contracts running).

## Round 4 (2026-09-29 evening): "do what's best for the project in all aspects"

User: Orbling and Hollowmarch are two separate projects (no crossover), but a pet idea is good for
Hollowmarch on its own. Pushing stays off until the user says so (standing "don't push yet").

Done (148 tests; each step committed):
1. [x] Companions: nine, baby-sized CC0 sprites behind the hero, bond levels 1-20, act bosses give
   one each (also to old saves), rare boss/map/pinnacle drops, contract reward. Hero-tab card. Save v6.
2. [x] Ember shrine on the World tab: Insight/Fortune/Plenty/Hoard for an hour, priced by level,
   spare orbs (above 50 of a kind) pay first, Keep up. Bot run: orb piles gone, level 76 at 24 h.
3. [x] Pinnacle scout (five fights on a copy of the hero) on the Atlas; the bot only queues when a
   scout wins 2 of 3. Map auto-push back-off (the clean streak to climb doubles per drop until a
   level-up): late deaths halved, level 80-83 at 24-32 h. All callings now land at 76-80 in 24 h.
4. [x] Loot filter: affix rules with readable names, presets (Starter, Lean, Endgame, Resist hunter).
5. [x] Release prep, nothing pushed: Hollowmarch ships with the agent (build also writes
   `src/addons/arpg.js`; off until switched on), AGENT_VERSION 22, CHANGELOG/README (en/ru) sections,
   arpg README install text, shots retaken. Fix found on the way: contracts pay dust by the claim level.
6. [ ] Localisation (ru/uk): running as a background job in its own worktree (i18n tables, Cyrillic
   glyphs for the pixel font, all UI, log and content texts). To review and merge.

Live (13:10): the branch agent's console window was closed around 12:45 (its scheduled task ended
with a Ctrl+C-style exit, as in the morning), and Vencord Watch then started the installed agent
(v1.4.3, attach-only). A Discord reload would bring that old agent back (no addons), so round 4
was hot-swapped instead: the built arpg.js evaluated into the running page (the hub replaces the
addon, the game reopened itself in the strip). The save is v6: level 35, Salt Crab out, Dune Pup
found. The page still runs the branch agent injected at 12:32 until the next reload/restart.

Release checklist (for when the user says go):
- [ ] Merge the localisation branch (after review), rebuild, `npm run check`, harness pass.
- [ ] PR from `feat/pet-addon-jjbs70` to `main` (title: "1.7.0: addons hub - Orbling and
      Hollowmarch"); VERSION already 1.7.0; the updater ships on merge.
- [ ] After merge: the installed agent here is v1.4.3 - updating it (or keeping the branch agent
      running) is what gets 1.7.0 onto this PC.

## Round 5 (2026-09-29 evening): traders, sockets, the ending

User: "think further of features/story/updates/endgame. maybe some traders with items/gems/etc,
maybe weapon socketing." Design in `arpg/docs/ROADMAP.md`. Built after the localisation merge so
new text goes into the en/ru/uk tables from the start.
- [x] 5a core: sockets + ember stones (6 kinds x 5 tiers, effect by slot; drops tuned to ~27
      Radiants by 24 h, Radiant only by cutting), the Wandering Market (Pedlar, Jeweller; 2 h rotation).
- [x] 5b core: 12 echoes (8 from map bosses, 4 from pinnacles), every third an atlas point.
      Cartographer not built yet (maps are plentiful; low value).
- [x] 5c core: the Rekindling (three sun shards; new dawn keeps the collection + an heirloom;
      +10% xp/dust, +1 passive point, world 15% tougher/20% richer per dawn; ten dawn perks).
- [x] Pinnacle balance: they were unbeatable past the Drowned Sun; now an invested level-85 build
      wins the Choir 2/3 and nearly the King (tools/pinnacles.ts). The Hollow Crown stays optional.
- [x] Localisation merged (ru/uk, Cyrillic pixel font, 1,748+ keys; bundle 1.39 MB because the
      ASCII build escapes Cyrillic).
- [x] UI for 5a-5c in en/ru/uk: Market tab (key 0), sockets on item cards and in the Forge, the
      stone pouch with cutting, echoes in the Log, the Rekindling card, relight dialog, dawn story,
      perk pick, Menu badge. Checked in headless Chrome (en and ru). 197 tests.

## Next updates (roadmap, 2026-09-29)

Ship readiness (next, needs the user's call on the release shape):
- [ ] Release shape. Proposal: ship the hub, Orbling and Hollowmarch in 1.7.0 through the updater,
      Hollowmarch off until switched on (it already is). Needs: CHANGELOG bullets for Hollowmarch (it
      has none yet), `AGENT_VERSION` 21 -> 22 (the hub script changed: windowed addons, winOpen), a
      PR from this branch. Alternative: keep Hollowmarch a separate install (`arpg\install`).
- [ ] Sections 1-3 above: the live checklist for Orbling and Hollowmarch, the PS 5.1 installer test.
- [ ] Refresh `arpg/docs/shots/` (they predate the art pass and round 3) for the README.

Soon (Hollowmarch 1.x):
- [ ] Localisation: only the card speaks ru/uk; the game UI is English. Extract a string table.
- [ ] Late economy: dust still inflates (~650k at 24 h) and Kindling/Reshaper pile into the
      thousands. Ideas: a currency exchange (10 common -> 1 rarer), an ember shrine (dust for a timed
      XP/rarity blessing), dust costs on map crafting.
- [ ] Pinnacles: the bot dies ~15 times per 4 h there. A readiness check (DPS/EHP vs the boss)
      before auto-queueing, and a look at their numbers.
- [ ] Loot filter editor: affix-group rules ("keep rings with fire resistance") and presets.
- [ ] Build loadouts: save/restore skill, supports and gear sets; a passive respec cost for dust.
- [ ] Contracts: zone contracts ("clear Act 2 places"), no-death streaks, one bigger weekly contract.
- [ ] Feats: lifetime milestones with small permanent rewards (a title, stash room).

Later:
- [ ] Content: more skills (15) and supports (14), minions or totems as a new archetype; unique map
      bosses and areas (maps reuse act bosses); an Act 4 or a Depths league mechanic.
- [ ] Seasonal events (October: a Hollow Night relic; Orbling already has the witch hat).
- [ ] Hub windows: resizable, a 2x/3x scale for Orbling.

## 4. Before shipping
- [ ] Fix whatever sections 1-3 turn up; for Hollowmarch run `cd arpg && npm install && npm run check`.
- [ ] Decide release shape: merge branch -> `main` with VERSION/CHANGELOG bump (the updater ships it to every user), or keep Hollowmarch as a separate install.
- [ ] Only after the user signs off: open a PR; never push `main` directly.

References: `arpg/README.md`, `arpg/docs/ai/FINAL_REPORT.md`, `arpg/docs/shots/`, `docs/orbling-*.png`.
