# CDP tools (screenshots and live deploys)

Small Node scripts that drive Chrome or the live Discord client over the Chrome
DevTools Protocol. Node 22+ (global `WebSocket` and `fetch`), no dependencies.

## Screenshots (headless Chrome)

1. Serve the repo root: `python -m http.server 8778 --bind 127.0.0.1` (from the repo root).
2. Make a hero if the scenario needs one: `node tools/run-ts.mjs tools/make-save.ts 70 vanguard ../dev/out/hm-70h.txt`.
3. Run a scenario: `W=1180 H=820 LANGX=ru node tools/cdp/shoot.mjs tools/cdp/example-tabs.mjs`.
   PNGs go to `dev/out/shots/` (git-ignored).
4. Look at one small sheet, not the PNGs: `python tools/cdp/sheet.py sheet.jpg r5-market-ru r5-forge-ru`
   (written to `dev/out/`).

`shoot.mjs` gives a scenario `nav(url)`, `ev(expr)` (Runtime.evaluate, awaits
promises), `shot(name, selector)` (clips to an element in the game's shadow root),
`click(selector, index, { shift })` and `sleep(ms)`. `dev/play.html?reset=1&lang=ru`
runs the game without the hub; `__hollowmarch.game.ctx` is the game context
(`importSave(text)`, `state`, `rerender()`).

## Live Discord (port 9222)

- `live-read.mjs`: read-only. Agent version, whether the game is open or in the strip,
  and a copy of the save in `dev/out/live-save.json` - run it through the migration
  offline before deploying a new save version.
- `live-hotswap.mjs <built arpg.js>`: saves the open game, evaluates the build in the
  page; the hub replaces the addon and the game reopens itself. Use this, not a reload:
  when the branch agent is not running, a reload hands Discord to the old installed
  agent (no addons).
- `live-verify.mjs`: polls until the agent and the game are back and prints their state.

Rules: never reload or close the user's Discord without checking there is no voice
call and no unsent message; keep test browsers muted; stop Chrome and the http server
when done.
