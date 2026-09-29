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
- [ ] Hollowmarch: hero sheet grouping, world view (zone progress, farm vs push), forge/tree/atlas
      polish, the panel card restyled to match the new window.
- [ ] Live check of each iteration in Discord (copy `arpg\dist\arpg.js` to `addons\`, reload Discord).

## 4. Before shipping
- [ ] Fix whatever sections 1-3 turn up; for Hollowmarch run `cd arpg && npm install && npm run check`.
- [ ] Decide release shape: merge branch -> `main` with VERSION/CHANGELOG bump (the updater ships it to every user), or keep Hollowmarch as a separate install.
- [ ] Only after the user signs off: open a PR; never push `main` directly.

References: `arpg/README.md`, `arpg/docs/ai/FINAL_REPORT.md`, `arpg/docs/shots/`, `docs/orbling-*.png`.
