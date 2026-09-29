# Local session to-do: Orbling (pet) + Hollowmarch (idle ARPG)

Branch: `feat/pet-addon-jjbs70`, with both addons plus the launcher change.
`main` is untouched; do not merge or push `main` until the user signs off.

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

Open for the user:
- [ ] Reload Discord (or restart it) to get round 3 live: new quest-agent.js (Orbling window),
      pet.js and arpg.js load together on the next inject.
- [ ] Late unwearable keepers: at level ~72 upkeep fills the stash with drops that need 74+
      (they are worth the most). Harmless (wearable upgrades are equipped on drop) but a worth
      penalty for items far above the hero's level is an option.

## 4. Before shipping
- [ ] Fix whatever sections 1-3 turn up; for Hollowmarch run `cd arpg && npm install && npm run check`.
- [ ] Decide release shape: merge branch -> `main` with VERSION/CHANGELOG bump (the updater ships it to every user), or keep Hollowmarch as a separate install.
- [ ] Only after the user signs off: open a PR; never push `main` directly.

References: `arpg/README.md`, `arpg/docs/ai/FINAL_REPORT.md`, `arpg/docs/shots/`, `docs/orbling-*.png`.
