# Hollowmarch - architecture

    arpg/
      src/
        core/            pure, deterministic, no DOM, no clocks
          rng.ts         seeded PRNG (sfc32) + helpers
          stats.ts       modifier engine
          data/          content tables (classes, skills, items, zones, ...)
          items.ts       item generation and crafting
          character.ts   derive the hero's stat sheet (DPS/EHP breakdown)
          sim/           combat step, runs, offline catch-up
          fray.ts        the Fray: the player-steered fight on the road's zone or a
                         map (arena, horde waves, motes, boons, roll, 60 Hz step;
                         shares sim/engine's maths)
          state.ts       GameState + reducers for player actions
          save.ts        versioned save envelope + migrations
        i18n/            strings: en.ts (source) + ru.ts, uk.ts; content names,
                         plurals, log references, the core's messages
        platform/        browser glue: IndexedDB store, clock, hub adapter
        ui/              Shadow DOM overlay, canvas renderers, and one module
                         per tab (views.ts dispatches: hero, gear, forge,
                         skills, tree, world, atlas, log, menu, market;
                         itemui.ts and common.ts are what they share)
          fray.ts        the Fray's canvas renderer (arena, sprites, motes, boon
                         offer, HUD text; zoom 1-4x)
        main.ts          entry: registers with the hub or boots standalone
      test/              Vitest, one file per core module + content checks
      tools/             balance simulator, ASCII check
      dev/play.html      plain browser page (no Discord, no hub)
      dist/arpg.js       one IIFE, pure ASCII (build output, committed); the
                         minified copy that ships is ../src/addons/arpg.js

## Rules

1. **Core is pure.** `src/core` never touches `window`, `document`, `Date`,
   `Math.random` or timers. Time comes in as an argument; randomness comes
   from `Rng`. This is what makes offline progress, the balance simulator and
   the tests trustworthy. A lint test greps `src/core` for these names.
2. **Data-driven content.** Classes, skills, supports, bases, affixes,
   uniques, zones, monsters, map mods and passives are plain tables keyed by
   id. `test/content.test.ts` validates references, id uniqueness, tier
   ordering and value ranges, so new content fails fast.
3. **One state object.** `GameState` is plain JSON (no classes, no Maps) so
   it saves as is. Actions are functions `(state, ...) => void` that mutate
   it in place; the UI calls them and re-renders.
4. **Derived, never stored.** The stat sheet is recomputed from state when
   something changes (equipment, points, skills) and cached by a version
   counter, never saved.
5. **Saves are versioned.** `{ v, savedAt, state }`. `migrate()` walks
   `MIGRATIONS[v]` up to `SAVE_VERSION`. Every migration has a fixture test.
6. **Scale.** Registries are `Record<string, T>`; adding a class, act or map
   mod is a data change. Sim cost is linear in simulated time, independent of
   content size. Offline catch-up runs in slices (yielding to the UI) and can
   move to a Worker without changing the core.
7. **Every string the player reads goes through `src/i18n`.** UI strings are
   written in `en.ts`; content strings (names, blurbs, affix lines, story) are
   generated from the data tables by id, so the data stays the source of its
   English. `ru.ts` and `uk.ts` cover every key (`test/i18n.test.ts` checks
   keys, placeholders, plural and gender forms, and that the pixel font can
   draw every character). Plurals are `one|other` in English and
   `one|few|many` in Russian and Ukrainian; an adjective before an item name
   has `m|f|n|p` forms and agrees with the base noun's gender. Chronicle
   entries are saved as a key plus params (content as `@kind:id` references)
   with the English text alongside, so they read in the current language and
   old saves still read. The core's action and save messages stay English
   (tests read them); `i18n/errors.ts` maps them onto translated strings.
   The language is the hub's `api.lang()` in Discord (followed live), else
   `?lang=` or the browser's.

## Runtime in Discord

- The launcher injects `arpg.js` after the agent. It pushes a definition onto
  `window.__questAgentAddons` (id `arpg`). The hub mounts a **launcher card**
  in the 400 px panel; the game itself opens in its own **overlay window**: a
  Shadow DOM root on `document.body`, z-index 10050, draggable and resizable,
  which stops key events from reaching Discord.
- The Fray (rounds 10-11) takes over the stage: the app swaps the battle canvas
  for the Fray's arena and the tabs hide while it runs. The idle clock is held
  at `now` (`simTo` follows the wall clock), so nothing is caught up afterwards;
  the sim is stepped from the animation frame, and the keys (WASD, arrows,
  Space, Q, 1-3, +/-, P, Esc, Enter) and the wheel over the arena stay inside
  the overlay like all the others. Losing focus pauses; closing the window or
  folding to the mini strip abandons the fray, which is never saved, only its
  tallies are.
- While the overlay is closed nothing ticks or draws. The save records
  `savedAt`; opening the overlay (or the card) catches up from it.
- Saves go to IndexedDB (`hollowmarch`, store `saves`). Export/import is a
  base64 text blob. The hub's small `api.save` keeps only the card summary.
- CSP: no iframes, no fetches, no inline handlers. All art is drawn from code
  or inlined; listeners use `addEventListener`.
- The bundle must be pure ASCII: esbuild's default charset escapes non-ASCII
  and `tools/check-ascii.mjs` fails the build otherwise.

## Standalone

`dev/play.html` loads `dist/arpg.js`, which boots straight into the overlay
when no hub is present (`?standalone=1` or no `__questAgent`).
