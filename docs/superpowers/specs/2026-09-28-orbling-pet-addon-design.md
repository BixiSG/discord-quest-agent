# Orbling: the first addon (a pixel pet)

Date: 2026-09-28. Branch `feat/pet-addon`, not pushed until the maintainer has seen it.

## Goal

A tamagotchi-style pet in the HUD that people come back to several times a day,
tied to what the agent already does: **every orb quest the agent finishes feeds
the pet**, and claiming rewards makes it celebrate. It must cost nothing while
nobody is looking at it and never guilt-trip.

## Addon hub (quest-agent.js)

- Addons are `src/addons/*.js`. The launcher evaluates each one separately after
  the agent (a broken addon can't break the agent). An addon queues
  `{ id, icon, strings, init(api), mount(el, api), destroy() }` on
  `window.__questAgentAddons`; the hub drains the queue once it's ready.
- Settings > Addons lists them with a switch (off by default). Switching one on
  opens it. A switched-on addon gets a header button and a panel view.
- API: namespaced storage (`questAgent.addon.<id>`), `t`/`tn` for `<id>.*`
  strings (English in the addon, ru/uk in the locale files), `on("quests")`,
  `completions()`, `pace()`, `notify()`, `openQuests()`, `attention(bool)` (dot on
  the header button and on the title-bar button), `visible()`.
- Trust model: addons run in the page with the agent's access. Only first-party
  addons shipped in this repo. Discord's CSP blocks sandboxed iframes (verified);
  a Worker + OffscreenCanvas sandbox is the path if third-party addons ever come.

## The pet

**Character.** An *Orbling*: a round orb creature, our own design (not Wumpus,
not a Discord asset). Six colour variants, one rare. Name it at hatch.

**Life cycle.** Egg (tap to warm, hatches on the 5th tap) -> baby -> kid -> teen
-> adult. Growth is XP; when a stage is reached the pet is *ready to grow* and
evolves when the user taps it (a moment worth coming back for). The adult form
depends on how it was raised since it was a kid:

| Form | Raised mostly by | Look |
| --- | --- | --- |
| Gourmet | feeding | belly patch, rosy cheeks |
| Sprinter | playing | long ears, lightning mark |
| Dapper | cleaning and pats | bow tie, hair tuft |
| Astral (rare) | 6+ orb feasts | halo, starry body |
| Classic | a bit of everything | little horns, tail |

After three days as an adult it can leave on an **adventure**: it goes into the
album and a new egg arrives in a colour not collected yet. Album goal: 5 forms x
6 colours.

**Needs** (0-100): food, fun, energy, clean. They drain by the clock (slower at
night), are recomputed from timestamps whenever the pet is looked at, and never
kill it: the worst case is a sad, grubby Orbling that stops earning passive XP.
It sleeps at night (23:00-07:00 on the PC clock); naps are possible by day.

**Food.** Berries are free and endless (a little food, 1 XP). Quest food is the
good stuff: a finished quest worth under 500 orbs drops a *star snack*, 500+ an
*orb feast*. A daily gift adds snacks, a feast every third day of a streak and a
cake every seventh.

**Why people come back.**
- Quest food piles up while they're away; feeding it is the payoff for the
  agent's work.
- Needs that last a day: two or three check-ins a day keep it thriving.
- Daily gift with a streak (best streak kept).
- Evolution moments and the adult form reveal.
- Hats to collect (bow at hatch, party hat at the first growth, beanie at a 3-day
  streak, flower at a 7-day streak, crown at adulthood, witch hat in October).
- The album of past Orblings.
- A gift box appears in the room while quest rewards wait to be claimed; clicking
  it opens the Quests page, and claiming makes the pet celebrate (+XP).
- Gentle reminders, opt-out: at most one every 8 hours, never at night, only
  when the pet is hungry, bored or grubby. A pink dot on the title-bar button
  when it needs something.

**Anti-patterns avoided.** No death, no punishment for being away, no paid
anything, no endless notification pressure.

## Art

Pixel art, drawn in code (no image files, keeps the ASCII-only rule): a 128x80
scene at 3x, repainted at ~15 fps only while the view is open. The Orbling is
procedural (shaded ellipse body with outline and highlight, eyes, mouth,
blush, feet, per-stage features, per-form details) so it can squash, bounce,
blink, look around and change colour cheaply. Small items (food, hats, hearts,
Zzz, sparkles, gift box) are ASCII sprite grids. The room follows the PC clock:
sky in the window (day, dusk, night with stars and moon), a lamp that lights
up at night, a bed, a bowl, a plant, a rug.

## Cost

Nothing runs while the panel is closed except a 5-minute check (recompute
needs from timestamps, count new quest food, set the attention dot). The canvas
loop exists only while the view is open and stops when Discord is hidden.

## Review (before the maintainer's look)

An independent review found, and this branch fixes:

- **Double mount.** An addon that redrew the panel from inside `mount()` (the pet's
  `attention()` call) got a second view whose animation loop was never cancelled. The
  hub now claims the view before calling `mount()`.
- **Quest food granted twice after a restart.** Right after Discord starts its quest list
  is empty; the pet forgot what it had already been fed. It now ignores empty lists and
  remembers fed quests for 120 days instead of pruning to what's listed.
- Orb catch blocks other actions (and bedtime or an adventure ends it), renaming is view
  state (cancelling can't leave the pet unnamed), the attention dot updates after every
  action, `removeUI()` unmounts addon views, and a forced re-injection starts a fresh
  addon queue.

Verified: a Node simulation of restarts (food once per quest, each claim celebrated
once), the double-mount repro (one loop at 15 fps while open, none after leaving or
switching off), and the game guards in the harness.
