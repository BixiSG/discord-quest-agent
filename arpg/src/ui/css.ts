// Neo-brutalist look: warm paper (or night ink), black 3px lines, hard offset
// shadows, loud flat colours, condensed caps for anything that is a label.
// Everything is scoped to the game's shadow root. All text is the game's own
// pixel font (gfx/webfont.ts, registered from bytes so Discord's CSP allows
// it); Bahnschrift and Segoe UI are only fallbacks.

export const CSS = `
:host { all: initial; }
* { box-sizing: border-box; }
[hidden] { display: none !important; }
.hm {
  --paper: #f6ecd6; --paper2: #ecd9b0; --card: #fffaf0; --nav: #efe1c1; --text: #1a1410; --muted: #6b5d4b; --line: #1a1410; --ink: #1a1410;
  --ember: #ff5a36; --gold: #ffc233; --teal: #19b3a3; --blue: #3a7bff; --violet: #8b5cf6; --green: #3fbf5f; --red: #e5383b;
  --r-plain: #d8d2c6; --r-enchanted: #5aa9ff; --r-rare: #ffd23f; --r-relic: #ff8a1f;
  --sh: 4px 4px 0 var(--line);
  /* "Hollow Pixel" (gfx/webfont.ts): 8 font pixels to the em, so sizes stay at 8/12/16/24px. */
  --display: "Hollow Pixel", Bahnschrift, "DIN Alternate", "Arial Narrow", "Segoe UI", sans-serif;
  --body: "Hollow Pixel", "Segoe UI", system-ui, -apple-system, sans-serif;
  --mono: "Hollow Pixel", "Cascadia Mono", Consolas, "Courier New", monospace;
  font: 12px/1.5 var(--body); color: var(--text); font-synthesis: none;
}
.hm.dark { --paper: #221b15; --paper2: #2d241c; --card: #30271f; --nav: #1a1410; --text: #f3e7d3; --muted: #b5a48b; --line: #050403;
  --r-plain: #8f877b; }
.cap { font-family: var(--display); font-stretch: condensed; text-transform: uppercase; letter-spacing: 1px; font-weight: 700; }

/* ---- frame ---- */
.win {
  position: fixed; z-index: 10050; display: grid; grid-template-rows: auto auto auto minmax(0, 1fr); grid-template-columns: minmax(0, 1fr);
  min-width: 380px; min-height: 340px; background: var(--paper); border: 3px solid var(--line);
  box-shadow: 8px 8px 0 var(--line); overflow: hidden; container: win / inline-size;
}
.win:focus { outline: none; }
.win.flash { animation: flash .5s cubic-bezier(.2,.8,.3,1); }
@keyframes flash { 0% { box-shadow: 8px 8px 0 var(--line), 0 0 0 6px var(--gold); } 100% { box-shadow: 8px 8px 0 var(--line), 0 0 0 0 var(--gold); } }
.bar { display: flex; align-items: center; gap: 10px; height: 34px; padding-right: 5px; background: var(--ember); color: #1a1410;
  border-bottom: 3px solid var(--line); cursor: move; user-select: none; touch-action: none; }
.logo { align-self: stretch; display: flex; align-items: center; padding: 0 11px; background: #1a1410; color: var(--ember);
  font: 700 16px/1 var(--display); font-stretch: condensed; letter-spacing: 3px; text-transform: uppercase; }
.who { flex: 1; min-width: 0; display: flex; align-items: baseline; gap: 9px; white-space: nowrap; overflow: hidden; }
.who b { font: 700 16px/1 var(--display); font-stretch: condensed; text-transform: uppercase; letter-spacing: 1px; }
.who span { font-weight: 600; font-size: 12px; overflow: hidden; text-overflow: ellipsis; }
.ctls { display: flex; gap: 5px; }
.ctl { width: 26px; height: 24px; padding: 0; display: grid; place-items: center; cursor: pointer; background: #fff4dc; color: #1a1410;
  border: 2px solid #1a1410; box-shadow: 2px 2px 0 #1a1410; }
.ctl:hover { background: var(--gold); }
.ctl.x:hover { background: #1a1410; color: var(--ember); }
.ctl.snd.off { background: #1a1410; color: var(--ember); }
.ctl:active { transform: translate(2px, 2px); box-shadow: none; }
button:focus-visible, select:focus-visible, input:focus-visible, textarea:focus-visible, .win:focus-visible { outline: 3px dashed var(--ember); outline-offset: 2px; }
.grip { position: absolute; right: 0; bottom: 0; width: 18px; height: 18px; cursor: nwse-resize; touch-action: none; z-index: 4;
  background: linear-gradient(135deg, transparent 50%, var(--line) 50%, var(--line) 60%, transparent 60%, transparent 70%, var(--line) 70%, var(--line) 80%, transparent 80%); }
.win.max .grip { display: none; }

/* stage + HUD */
.top { border-bottom: 3px solid var(--line); }
.stage { position: relative; background: #111; overflow: hidden; min-height: 60px; }
.stage canvas { position: absolute; left: 0; top: 0; image-rendering: pixelated; display: block; }
.top.nostage { display: none; }
.hudw { background: #1a1410; border-bottom: 3px solid var(--line); line-height: 0; overflow: hidden; }
.hudw canvas { display: block; image-rendering: pixelated; }

/* nav rail + content */
.main { display: grid; grid-template-columns: 142px minmax(0, 1fr); min-height: 0; }
.nav { display: flex; flex-direction: column; background: var(--nav); border-right: 3px solid var(--line); overflow: auto; scrollbar-width: none; }
.nav button { position: relative; display: grid; grid-template-columns: 16px 1fr auto; align-items: center; gap: 8px; padding: 8px 10px 8px 12px;
  background: transparent; color: var(--text); border: 0; border-bottom: 2px solid var(--line); cursor: pointer; text-align: left;
  font: 700 16px/1 var(--display); font-stretch: condensed; letter-spacing: 1px; text-transform: uppercase; }
.nav button svg { opacity: .8; }
.nav button .key { font: 700 8px/1 var(--mono); color: var(--muted); }
.nav button:hover:not(.on) { background: var(--paper2); }
.nav button.on { background: var(--gold); color: #1a1410; box-shadow: inset 5px 0 0 #1a1410; }
.nav button.on svg { opacity: 1; } .nav button.on .key { color: #1a1410; }
.nav .badge { position: absolute; right: 26px; top: 50%; transform: translateY(-50%); min-width: 17px; height: 15px; padding: 0 3px; background: var(--ember); color: #1a1410;
  border: 2px solid var(--line); font: 800 8px/11px var(--mono); text-align: center; }
.body { overflow: auto; padding: 14px 16px 22px; min-width: 0; position: relative; scrollbar-width: thin; scrollbar-color: var(--line) transparent; }
.body::-webkit-scrollbar { width: 12px; } .body::-webkit-scrollbar-thumb { background: var(--line); border: 3px solid var(--paper); }
.win.creating .top, .win.creating .hudw, .win.creating .nav, .win.creating .ctl.sz, .win.creating .ctl.mn { display: none; }
.win.creating .main { grid-template-columns: 1fr; }

/* mini mode: the battle itself, a strip that keeps playing; tiny buttons over it, no title bar */
.minibox { display: none; }
.win.mini { grid-template-rows: auto auto; min-width: 0; min-height: 0; box-shadow: 6px 6px 0 var(--line); }
.win.mini .main, .win.mini .grip, .win.mini .toasts, .win.mini .logo, .win.mini .who, .win.mini .ctl.sz, .win.mini .ctl.mx { display: none; }
.win.mini .bar { position: absolute; top: 4px; right: 4px; z-index: 4; height: auto; padding: 0; background: none; border: 0; cursor: default; }
.win.mini .ctls { gap: 3px; opacity: .6; transition: opacity .12s; }
.win.mini:hover .ctls, .win.mini .ctls:focus-within { opacity: 1; }
.win.mini .ctl { width: 20px; height: 18px; box-shadow: 1px 1px 0 #1a1410; }
.win.mini .top, .win.mini .top.nostage { display: block; }
.win.mini .stage { min-height: 0; cursor: move; touch-action: none; }
.win.mini .hudw { border-bottom: 0; }
.win.mini .minibox { display: flex; flex-direction: column; align-items: stretch; gap: 3px; position: absolute; left: 4px; right: 4px; bottom: 4px; z-index: 3; }
.minibox .mlast { display: none; }
.minibox .mlast.ping { display: block; align-self: flex-start; max-width: 100%; padding: 3px 6px; background: rgba(10, 8, 6, .85); color: #f3e7d3;
  font: 700 12px/1.1 var(--display); font-stretch: condensed; letter-spacing: 1px; text-transform: uppercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  border-left: 4px solid var(--gold); animation: tin .22s cubic-bezier(.2,.8,.3,1); }
.minibox .mlast.t-relic { border-left-color: var(--r-relic); } .minibox .mlast.t-rare { border-left-color: var(--r-rare); }
.minibox .mlast.t-road { border-left-color: var(--teal); } .minibox .mlast.t-err { border-left-color: var(--ember); }
/* dialogs wait hidden while the window is a strip; this row brings the window back for them */
.win.mini > .modal { display: none; }
.mnote { display: flex; align-items: center; gap: 7px; width: 100%; min-height: 30px; padding: 0 4px; cursor: pointer; text-align: left; color: #1a1410;
  border: 6px solid transparent; border-image: var(--fr-gold) 8 fill / 6px; background: none; filter: drop-shadow(2px 2px 0 var(--line)); font: inherit; }
.mnote:hover { filter: drop-shadow(2px 2px 0 var(--line)) brightness(1.08); }
.mnote b { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font: 700 12px/1 var(--display); font-stretch: condensed; letter-spacing: 1px; text-transform: uppercase; }
.mnote span { flex: none; font: 700 8px/1 var(--mono); text-transform: uppercase; }
.mprog { display: grid; gap: 3px; padding: 3px 5px 4px; background: rgba(10, 8, 6, .85); }
.mprog span { font: 700 8px/1.1 var(--mono); color: #f3e7d3; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mprog .progress { height: 9px; border-width: 2px; }

/* one column when the window is narrow */
@container win (max-width: 640px) {
  .main { grid-template-columns: 1fr; grid-template-rows: auto minmax(0, 1fr); }
  .nav { flex-direction: row; border-right: 0; border-bottom: 3px solid var(--line); overflow-x: auto; }
  .nav button { flex: 1 0 auto; grid-template-columns: auto; justify-items: center; padding: 8px 10px; border-bottom: 0; border-right: 2px solid var(--line); }
  .nav button .lbl, .nav button .key { display: none; }
  .nav button.on { box-shadow: inset 0 -5px 0 #1a1410; }
  .nav .badge { right: 1px; top: 1px; transform: none; min-width: 15px; }
}

/* toasts */
.toasts { position: absolute; left: 154px; bottom: 14px; display: flex; flex-direction: column; gap: 6px; z-index: 6; pointer-events: none; max-width: calc(100% - 178px); }
.win.mini .toasts, .win.creating .toasts { left: 10px; max-width: calc(100% - 20px); }
@container win (max-width: 640px) { .toasts { left: 12px; max-width: calc(100% - 24px); } }
.toast { background: var(--card); color: var(--text); border: 3px solid var(--line); box-shadow: 4px 4px 0 var(--line); padding: 6px 11px;
  font: 700 12px/1.2 var(--display); font-stretch: condensed; text-transform: uppercase; letter-spacing: 1px; animation: tin .22s cubic-bezier(.2,.8,.3,1); }
.toast.out { animation: tout .22s ease forwards; }
.toast.t-rare { background: var(--r-rare); color: #1a1410; } .toast.t-relic { background: var(--r-relic); color: #1a1410; }
.toast.t-enchanted { background: var(--r-enchanted); color: #1a1410; } .toast.t-level { background: #1a1410; color: var(--gold); }
.toast.t-road { background: var(--teal); color: #1a1410; } .toast.t-err { background: var(--ember); color: #1a1410; }
@keyframes tin { from { transform: translateX(-14px); opacity: 0; } to { transform: none; opacity: 1; } }
@keyframes tout { to { transform: translateX(-14px); opacity: 0; } }

/* ---- content ---- */
.row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.col { display: flex; flex-direction: column; gap: 8px; }
.grow { flex: 1; }
.card { background: var(--card); border: 3px solid var(--line); box-shadow: var(--sh); padding: 9px 11px; min-width: 0; }
.card h3 { margin: 0 0 7px; font: 700 12px/1.1 var(--display); font-stretch: condensed; text-transform: uppercase; letter-spacing: 1px; }
.card > h3:first-child { margin: -9px -11px 9px; padding: 7px 11px 6px; background: var(--paper2); border-bottom: 3px solid var(--line); }
.btn { cursor: pointer; font: 700 12px/1 var(--display); font-stretch: condensed; text-transform: uppercase; letter-spacing: 1px; padding: 7px 12px 6px;
  background: var(--gold); color: #1a1410; border: 3px solid var(--line); box-shadow: 3px 3px 0 var(--line); }
.btn:hover { transform: translate(-1px, -1px); box-shadow: 4px 4px 0 var(--line); }
.btn:active { transform: translate(2px, 2px); box-shadow: 1px 1px 0 var(--line); }
.btn.alt { background: var(--card); color: var(--text); }
.btn.hot { background: var(--ember); color: #1a1410; }
.btn:disabled { opacity: .45; cursor: default; transform: none; box-shadow: 3px 3px 0 var(--line); }
.x { cursor: pointer; background: var(--card); color: var(--text); border: 2px solid var(--line); width: 24px; height: 24px; font-weight: 900; box-shadow: 2px 2px 0 var(--line); padding: 0; }
.x:hover { background: var(--gold); color: #1a1410; }
.tag { display: inline-block; font: 700 12px/1.3 var(--display); font-stretch: condensed; letter-spacing: 1px; padding: 1px 6px; border: 2px solid var(--line); background: var(--paper2); text-transform: uppercase; }
.muted { color: var(--muted); }
.num { font-variant-numeric: tabular-nums; font-family: var(--mono); }
.kv { display: grid; grid-template-columns: 1fr auto; gap: 0 12px; }
.kv > * { padding: 2px 0; border-bottom: 1px dashed color-mix(in srgb, var(--line) 18%, transparent); }
.kv > :nth-child(odd) { color: var(--muted); }
.kv > :nth-child(even) { text-align: right; font-weight: 700; }
.kv .click { cursor: pointer; text-decoration: underline dotted; text-underline-offset: 3px; }
.kv .click:hover { color: var(--text); }
.big { font: 700 24px/1 var(--display); font-stretch: condensed; letter-spacing: 1px; }
.grid2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 14px; align-items: start; }
.slots { display: grid; grid-template-columns: repeat(4, 56px); gap: 6px; }
.cell { position: relative; width: 56px; height: 56px; border: 3px solid var(--line); background: var(--card); cursor: pointer; display: flex; align-items: center; justify-content: center; }
.cell:hover { transform: translate(-1px, -1px); box-shadow: 3px 3px 0 var(--line); }
.cell canvas { width: 36px; height: 36px; image-rendering: pixelated; }
.cell .lbl { position: absolute; bottom: 1px; left: 3px; font: 700 8px/1 var(--display); font-stretch: condensed; letter-spacing: 1px; color: var(--muted); text-transform: uppercase; }
.cell.sel { outline: 3px solid var(--ember); outline-offset: 1px; }
.cell.plain { background: var(--r-plain); } .cell.enchanted { background: var(--r-enchanted); } .cell.rare { background: var(--r-rare); } .cell.relic { background: var(--r-relic); }
.cell.plain .lbl, .cell.enchanted .lbl, .cell.rare .lbl, .cell.relic .lbl { color: #1a1410; }
.cell.empty { cursor: default; background: repeating-linear-gradient(45deg, var(--paper), var(--paper) 6px, var(--paper2) 6px, var(--paper2) 12px); }
.cell.empty:hover { transform: none; box-shadow: none; }
.stash { display: grid; grid-template-columns: repeat(auto-fill, 48px); gap: 5px; }
.stash .cell { width: 48px; height: 48px; }
.stash .cell canvas { width: 30px; height: 30px; }
.item { min-width: 220px; }
.item .name { font: 700 16px/1.15 var(--display); font-stretch: condensed; letter-spacing: 0; padding: 6px 9px 5px; border-bottom: 3px solid var(--line); margin: -9px -11px 7px; }
.item .name.plain { background: var(--r-plain); color: #1a1410; } .item .name.enchanted { background: var(--r-enchanted); color: #1a1410; }
.item .name.rare { background: var(--r-rare); color: #1a1410; } .item .name.relic { background: var(--r-relic); color: #1a1410; }
.item .aff { font-size: 12px; }
.item .aff b { font: 700 8px var(--mono); color: var(--muted); margin-left: 5px; }
.item hr { border: 0; border-top: 2px dashed var(--line); margin: 7px 0; }
.up { color: var(--green); font-weight: 800; } .down { color: var(--red); font-weight: 800; }
.hm.dark .up { color: #6fe08a; } .hm.dark .down { color: #ff6b6d; }
.skill { display: flex; gap: 8px; align-items: flex-start; padding: 7px 9px; border: 3px solid var(--line); background: var(--card); cursor: pointer; box-shadow: 3px 3px 0 var(--line); }
.skill:hover:not(.locked):not(.on) { background: var(--paper2); }
.skill.on { background: var(--gold); color: #1a1410; }
.skill.on .muted { color: #4d4030; }
.skill.locked { opacity: .5; cursor: default; }
.skill .nm { font: 700 16px/1.1 var(--display); font-stretch: condensed; letter-spacing: 0; text-transform: uppercase; }
.skill .ds { font-size: 12px; }
.zone { display: flex; gap: 8px; align-items: center; padding: 7px 9px; border: 3px solid var(--line); background: var(--card); cursor: pointer; margin-bottom: 6px; }
.zone:hover:not(.locked):not(.on) { background: var(--paper2); }
.zone.on { background: var(--teal); color: #1a1410; }
.zone.on .muted { color: #16433e; }
.zone.locked { opacity: .45; cursor: default; }
.log .entry { display: flex; gap: 8px; align-items: baseline; padding: 4px 0; border-bottom: 1px dashed color-mix(in srgb, var(--line) 25%, transparent); font-size: 12px; }
.log .entry .tag { flex: none; min-width: 52px; text-align: center; }
.log .when { flex: none; font-size: 8px; }

/* section headers outside cards, flat lists, chips */
.sec { display: flex; align-items: baseline; gap: 8px; margin: 0 0 7px; font: 700 16px/1 var(--display); font-stretch: condensed; text-transform: uppercase; letter-spacing: 2px; }
.sec .muted { font: 600 12px/1 var(--body); text-transform: none; letter-spacing: 0; }
.card h3.split { display: flex; flex-wrap: wrap; gap: 4px 12px; justify-content: space-between; align-items: baseline; }
.card h3.split .num { font-size: 12px; letter-spacing: 0; }
.list { background: var(--card); border: 3px solid var(--line); box-shadow: var(--sh); }
.li { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 3px 12px; padding: 8px 10px; border-bottom: 2px solid var(--line); cursor: pointer; }
.li:last-child { border-bottom: 0; }
.li:hover:not(.locked):not(.on), .li:focus-visible { background: var(--paper2); outline: none; }
.li.on { background: var(--gold); color: #1a1410; cursor: default; }
.li.on .tag { border-color: #1a1410; }
.li.locked { cursor: default; opacity: .5; }
.li .nm { font: 700 16px/1.1 var(--display); font-stretch: condensed; text-transform: uppercase; letter-spacing: 0; }
.li .meta { grid-column: 2; grid-row: 1 / span 3; display: flex; align-items: flex-start; justify-content: flex-end; text-align: right; }
.li .ds { grid-column: 1; font-size: 12px; }
.li .tags { grid-column: 1; display: flex; gap: 4px; flex-wrap: wrap; margin-top: 2px; }
.li .tags .tag { font-size: 8px; padding: 0 5px; }
.delta { font: 700 12px/1 var(--mono); }
.li.on .up { color: #146b2c; } .li.on .down { color: #9e1d1f; }
.chips { display: flex; gap: 4px; flex-wrap: wrap; }
.chip { font: 700 12px/1 var(--display); font-stretch: condensed; text-transform: uppercase; letter-spacing: 1px; padding: 5px 8px 4px;
  border: 2px solid var(--line); background: var(--card); color: var(--text); cursor: pointer; }
.chip:hover:not(.on) { background: var(--paper2); }
.chip.on { background: var(--text); color: var(--paper); }
.chip b { font: 700 8px/1 var(--mono); margin-left: 5px; opacity: .75; }

/* gear: equipped and stash on the left, the picked item stays in view on the right */
.gear { display: grid; grid-template-columns: minmax(0, auto) minmax(0, 1fr); gap: 14px; align-items: start; }
.gear select { padding: 3px 6px; font-size: 12px; }
@container win (max-width: 760px) { .gear { grid-template-columns: 1fr; } }
.gpop { position: absolute; z-index: 7; width: 300px; max-width: calc(100% - 12px); animation: tipin .12s ease-out; }
.gpop .popx { position: absolute; right: 6px; top: 6px; width: 22px; height: 22px; z-index: 1; }
.gpop .item .name { padding-right: 32px; }
.popacts { margin-top: 8px; padding-top: 8px; border-top: 2px dashed color-mix(in srgb, var(--line) 50%, transparent); }
.info { width: 22px; height: 22px; padding: 0; cursor: help; border: 2px solid currentColor; background: none; color: inherit; font: 700 12px/1 var(--mono); align-self: center; }
.info:hover, .info:focus-visible { background: var(--gold); color: #1a1410; border-color: #1a1410; }
.cell.upg::after { content: ""; position: absolute; right: -3px; top: -3px; border-style: solid; border-width: 0 14px 14px 0; border-color: transparent var(--green) transparent transparent; }
.cell.upg::before { content: ""; position: absolute; right: -3px; top: -3px; border-style: solid; border-width: 0 17px 17px 0; border-color: transparent var(--line) transparent transparent; }
.cell.req canvas { opacity: .4; }
.cell.req { filter: saturate(.4); }
.hint h3 { margin-bottom: 7px; }
.modal { position: absolute; inset: 0; background: rgba(26, 20, 16, .55); display: flex; align-items: center; justify-content: center; z-index: 5; padding: 16px; }
.modal > .card { max-width: 460px; width: 100%; max-height: 100%; overflow: auto; animation: pop .2s cubic-bezier(.2,.8,.3,1); }
@keyframes pop { from { transform: translateY(8px); opacity: 0; } to { transform: none; opacity: 1; } }
input[type=text], textarea, select { font: inherit; padding: 5px 7px; border: 3px solid var(--line); background: var(--card); color: var(--text); }
textarea { width: 100%; min-height: 70px; font-family: var(--mono); font-size: 12px; }
label.chk { display: flex; gap: 6px; align-items: center; cursor: pointer; font-weight: 700; }
input[type=checkbox] { accent-color: var(--ember); width: 15px; height: 15px; }
.progress { height: 18px; border: 3px solid var(--line); background: var(--card); } .progress i { display: block; height: 100%; background: var(--teal); }
.story { font-style: italic; border-left: 6px solid var(--ember); padding-left: 9px; }

/* ---- pixel frames: border-image art from gfx/frames.ts, pixel type from gfx/pix.ts ---- */
.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
.pxc { display: block; image-rendering: pixelated; }
.card, .list { border: 8px solid transparent; border-image: var(--fr-card) 8 fill / 8px; background: none; box-shadow: none;
  filter: drop-shadow(4px 4px 0 var(--line)); padding: 3px 5px 5px; }
.hm.dark .card, .hm.dark .list { filter: drop-shadow(4px 4px 0 #000); }
.card > h3:first-child { margin: -3px -5px 10px; padding: 6px 8px; background: #1a1410; color: #ffc233; border: 0;
  clip-path: polygon(0 2px, 2px 2px, 2px 0, calc(100% - 2px) 0, calc(100% - 2px) 2px, 100% 2px, 100% calc(100% - 2px), calc(100% - 2px) calc(100% - 2px), calc(100% - 2px) 100%, 2px 100%, 2px calc(100% - 2px), 0 calc(100% - 2px)); }
.card > h3:first-child .num { color: #b5a48b; }
.card h3 { color: var(--text); }
.card h3 .pxc, .sec .pxc { display: inline-block; vertical-align: middle; }
.item .name { margin: -3px -5px 8px; border: 0; clip-path: polygon(0 2px, 2px 2px, 2px 0, calc(100% - 2px) 0, calc(100% - 2px) 2px, 100% 2px, 100% 100%, 0 100%); }
.btn { border: 8px solid transparent; border-image: var(--fr-gold) 8 fill / 8px; background: none; box-shadow: none; padding: 1px 5px;
  filter: drop-shadow(3px 3px 0 var(--line)); min-height: 34px; display: inline-flex; align-items: center; justify-content: center; }
.hm.dark .btn { filter: drop-shadow(3px 3px 0 #000); }
.btn:hover { transform: translate(-1px, -1px); box-shadow: none; filter: drop-shadow(4px 4px 0 var(--line)) brightness(1.06); }
.btn:active { transform: translate(2px, 2px); box-shadow: none; filter: drop-shadow(1px 1px 0 var(--line)); }
.btn.alt { border-image-source: var(--fr-alt); background: none; }
.btn.hot { border-image-source: var(--fr-ember); background: none; }
.btn:disabled { opacity: .45; box-shadow: none; filter: none; }
.cell { border: 8px solid transparent; border-image: var(--fr-sunk) 8 fill / 8px; background: none; }
.cell:hover { box-shadow: none; filter: brightness(1.12); }
.cell.plain { border-image-source: var(--fr-plain); background: none; } .cell.enchanted { border-image-source: var(--fr-enchanted); background: none; }
.cell.rare { border-image-source: var(--fr-rare); background: none; } .cell.relic { border-image-source: var(--fr-relic); background: none; }
.cell.rare, .cell.relic { filter: drop-shadow(0 0 3px color-mix(in srgb, var(--r-rare) 55%, transparent)); }
.cell.relic { filter: drop-shadow(0 0 4px color-mix(in srgb, var(--r-relic) 70%, transparent)); }
.cell.empty { border-image-source: var(--fr-empty); background: none; }
.cell .lbl { bottom: -1px; left: 0; color: var(--muted); }
.cell.plain .lbl, .cell.enchanted .lbl, .cell.rare .lbl, .cell.relic .lbl { display: none; }
.cell canvas.ic { width: auto; height: auto; }
.cell.upg::after { right: -5px; top: -5px; } .cell.upg::before { right: -5px; top: -5px; }
.stash { grid-template-columns: repeat(auto-fill, 52px); gap: 3px; }
.stash .cell { width: 52px; height: 52px; }
.skill, .zone { border: 8px solid transparent; border-image: var(--fr-alt) 8 fill / 8px; background: none; box-shadow: none; padding: 1px 3px; }
.skill:hover:not(.locked):not(.on), .zone:hover:not(.locked):not(.on) { background: none; filter: brightness(1.05); }
.skill.on { border-image-source: var(--fr-gold); background: none; }
.zone.on { border-image-source: var(--fr-teal); background: none; }
.li { border-bottom: 2px solid var(--line); }
.list { padding: 0; }
.li.on { background: #ffc233; }

/* paper doll, tooltips, drag and drop */
.doll { display: grid; grid-template-columns: 56px minmax(112px, 1fr) 56px; grid-template-rows: repeat(5, 56px); gap: 6px 10px; max-width: 330px;
  grid-template-areas: "helmet fig amulet" "weapon fig offhand" "body fig gloves" "ring1 fig ring2" "belt fig boots"; margin: 0 auto; }
.doll [data-slot="weapon"] { grid-area: weapon; } .doll [data-slot="offhand"] { grid-area: offhand; } .doll [data-slot="helmet"] { grid-area: helmet; }
.doll [data-slot="body"] { grid-area: body; } .doll [data-slot="gloves"] { grid-area: gloves; } .doll [data-slot="boots"] { grid-area: boots; }
.doll [data-slot="belt"] { grid-area: belt; } .doll [data-slot="amulet"] { grid-area: amulet; } .doll [data-slot="ring1"] { grid-area: ring1; } .doll [data-slot="ring2"] { grid-area: ring2; }
.doll .fig { grid-area: fig; position: relative; display: flex; align-items: flex-end; justify-content: center; padding-bottom: 14px;
  border: 8px solid transparent; border-image: var(--fr-sunk) 8 fill / 8px; overflow: hidden; }
.doll .fig::after { content: ""; position: absolute; left: 18%; right: 18%; bottom: 10px; height: 6px; background: rgba(0,0,0,.35); border-radius: 50%; }
.doll .fig::before { content: ""; position: absolute; inset: 0; background: repeating-linear-gradient(0deg, transparent 0 6px, rgba(0,0,0,.05) 6px 7px); }
.figart { image-rendering: pixelated; position: relative; z-index: 1; }
.tip { position: absolute; z-index: 8; pointer-events: none; max-width: 560px; animation: tipin .12s ease-out; }
.tip .card { margin: 0; }
.tipcols { display: flex; gap: 10px; align-items: flex-start; }
.tipcols > * { width: 250px; }
.tiplbl { font: 700 12px/1 var(--display); font-stretch: condensed; text-transform: uppercase; letter-spacing: 2px; color: var(--muted); padding-left: 2px; }
@keyframes tipin { from { opacity: 0; transform: translateY(3px); } }
.cell[draggable="true"] { cursor: grab; }
.gear.dragging .cell.drop-ok { outline: 2px dashed var(--teal); outline-offset: 1px; }
.cell.over, .stash.over { filter: brightness(1.35) drop-shadow(0 0 4px var(--teal)); }
.gear.dragging .anvil { outline: 2px dashed var(--ember); outline-offset: 2px; }
.anvil { display: inline-flex; align-items: center; gap: 6px; padding: 2px 8px; min-height: 34px; color: var(--text);
  border: 8px solid transparent; border-image: var(--fr-sunk) 8 fill / 8px; font: 700 12px/1 var(--display); font-stretch: condensed; text-transform: uppercase; letter-spacing: 1px; }
.anvil.over { filter: brightness(1.3) drop-shadow(0 0 5px var(--ember)); color: var(--ember); }
.nav button { grid-template-columns: 16px auto 1fr auto; }
.nav .badge { position: static; transform: none; order: 3; justify-self: end; margin-right: 6px; }
.nav button .key { order: 4; }
.nav button .lbl { order: 2; } .nav button svg { order: 1; }

/* hero: a character sheet */
.sheet { display: grid; grid-template-columns: minmax(0, 330px) minmax(0, 1fr) minmax(0, 300px); gap: 14px; align-items: start; }
@container win (max-width: 1100px) { .sheet { grid-template-columns: minmax(0, 330px) minmax(0, 1fr); } .sheet > :last-child { grid-column: 1 / -1; } }
@container win (max-width: 760px) { .sheet { grid-template-columns: 1fr; } }
.portrait-frame { position: relative; line-height: 0; border: 8px solid transparent; border-image: var(--fr-sunk) 8 fill / 8px; }
.portrait { image-rendering: pixelated; max-width: 100%; height: auto !important; }
.where-tag { position: absolute; left: 6px; bottom: 6px; line-height: 1.2; padding: 2px 6px; background: rgba(10,8,6,.78); color: #f3e7d3;
  font: 700 12px/1.2 var(--display); font-stretch: condensed; letter-spacing: 1px; text-transform: uppercase; }
.tag.lv { background: #1a1410; color: #ffc233; border-color: #1a1410; } .tag.asc { background: var(--violet); color: #fff; }
.xpbar { height: 8px; margin: 8px 0 4px; background: #1a1410; border: 2px solid var(--line); } .xpbar i { display: block; height: 100%; background: #ffc233; }
.attrs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-top: 8px; }
.attr { display: grid; grid-template-columns: auto 1fr; grid-template-rows: auto auto; column-gap: 6px; align-items: center; padding: 4px 6px;
  border: 8px solid transparent; border-image: var(--fr-alt) 8 fill / 8px; }
.attr svg { grid-row: 1 / span 2; } .attr b { font-size: 16px; line-height: 1; } .attr span { font: 700 8px/1 var(--display); font-stretch: condensed; letter-spacing: 1px; text-transform: uppercase; color: var(--muted); }
.attr.might svg { color: #e5383b; } .attr.grace svg { color: #3fbf5f; } .attr.wit svg { color: #3a7bff; }
.bigrow { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 10px; }
.bigstat { flex: 1 1 150px; display: flex; flex-direction: column; gap: 6px; padding: 10px 12px; background: #1a1410; color: #f3e7d3;
  clip-path: polygon(0 3px, 3px 3px, 3px 0, calc(100% - 3px) 0, calc(100% - 3px) 3px, 100% 3px, 100% calc(100% - 3px), calc(100% - 3px) calc(100% - 3px), calc(100% - 3px) 100%, 3px 100%, 3px calc(100% - 3px), 0 calc(100% - 3px)); }
.bigstat b { display: block; font: 700 12px/1 var(--display); font-stretch: condensed; letter-spacing: 1px; text-transform: uppercase; }
.bigstat span { font-size: 12px; color: #b5a48b; }
.formula { display: flex; flex-wrap: wrap; align-items: stretch; gap: 4px; margin-bottom: 10px; }
.fchip { display: flex; flex-direction: column; gap: 2px; padding: 4px 8px; min-width: 56px; text-align: left; font: inherit; color: var(--text); cursor: default;
  border: 8px solid transparent; border-image: var(--fr-alt) 8 fill / 8px; margin: -4px 0; }
button.fchip { cursor: pointer; } button.fchip:hover { filter: brightness(1.08); }
.fchip span { font: 700 8px/1 var(--display); font-stretch: condensed; letter-spacing: 1px; text-transform: uppercase; color: var(--muted); }
.fchip b { font-size: 16px; line-height: 1.1; }
.fchip.total { border-image-source: var(--fr-gold); color: #1a1410; } .fchip.total span { color: #4d4030; }
.fop { align-self: center; font: 700 16px/1 var(--mono); color: var(--muted); padding: 0 1px; }
.resrow { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
.res { display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 6px 2px 4px; font: inherit; color: var(--text); cursor: pointer;
  border: 8px solid transparent; border-image: var(--fr-sunk) 8 fill / 8px; }
.res b { font-size: 16px; } .res span { font-size: 8px; color: var(--muted); text-align: center; }
.res.fire svg { color: #ff5a36; } .res.cold svg { color: #3a9bff; } .res.lightning svg { color: #e0b800; } .res.chaos svg { color: #8b5cf6; }
.res.neg b { color: var(--red); } .res.cap b { color: var(--green); } .hm.dark .res.cap b { color: #6fe08a; }
.res:hover, .stat:hover { filter: brightness(1.1); }
.tiles { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-bottom: 10px; }
.stat { display: grid; grid-template-columns: auto 1fr; grid-template-rows: auto auto; column-gap: 6px; align-items: center; text-align: left; padding: 4px 6px;
  font: inherit; color: var(--text); cursor: pointer; border: 8px solid transparent; border-image: var(--fr-alt) 8 fill / 8px; }
.stat svg { grid-row: 1 / span 2; } .stat b { font-size: 16px; line-height: 1.05; } .stat span { font: 700 8px/1 var(--display); font-stretch: condensed; letter-spacing: 1px; text-transform: uppercase; color: var(--muted); }
.stat.heart svg { color: #e5383b; } .stat.esorb svg { color: #7fd1ff; } .stat.regen svg { color: #3fbf5f; } .stat.armour svg { color: #9aa4b2; } .stat.evasion svg { color: #19b3a3; } .stat.block svg { color: #ffc233; }
.sub { font: 700 12px/1.2 var(--display); font-stretch: condensed; letter-spacing: 1px; text-transform: uppercase; color: var(--muted); margin: 2px 0 6px; }

.meter { position: relative; height: 18px; background: #1a1410; border: 2px solid var(--line); overflow: hidden; }
.meter i { position: absolute; left: 0; top: 0; bottom: 0; }
.meter span { position: relative; display: block; padding-left: 6px; font: 700 12px/14px var(--mono); color: #f3e7d3; text-shadow: 1px 1px 0 #000; white-space: nowrap; }
.tiles { grid-template-columns: repeat(auto-fill, minmax(118px, 1fr)); }
.stat, .attr { min-width: 0; } .stat b, .stat span, .attr b { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* world: each act is a road of stops with their scenery */
.toggle { display: flex; align-items: center; gap: 10px; padding: 4px 8px; text-align: left; font: inherit; color: var(--text); cursor: pointer;
  border: 8px solid transparent; border-image: var(--fr-alt) 8 fill / 8px; align-self: flex-start; }
.toggle i { flex: none; position: relative; width: 38px; height: 20px; background: #1a1410; border: 2px solid var(--line); }
.toggle i::after { content: ""; position: absolute; top: 2px; left: 2px; width: 12px; height: 12px; background: #6b5d4b; transition: left .12s; }
.toggle.on i::after { left: 20px; background: #19b3a3; }
.toggle b { display: block; font: 700 12px/1.1 var(--display); font-stretch: condensed; text-transform: uppercase; letter-spacing: 1px; }
.toggle small { color: var(--muted); font-size: 12px; }
.act .story { margin-bottom: 12px; }
.road { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 0; }
.path { width: 18px; height: 4px; background: repeating-linear-gradient(90deg, var(--line) 0 4px, transparent 4px 7px); }
.path.dim { opacity: .35; }
.stop { width: 132px; display: flex; flex-direction: column; gap: 4px; padding: 3px; text-align: left; font: inherit; color: var(--text); cursor: pointer;
  border: 8px solid transparent; border-image: var(--fr-alt) 8 fill / 8px; }
.stop:hover:not(.locked):not(.here) { filter: brightness(1.07); transform: translateY(-1px); }
.stop.here { border-image-source: var(--fr-teal); color: #1a1410; }
.stop.here .meta span:not(.tag) { color: #16433e; }
.stop.locked { cursor: default; opacity: .6; }
.stop.locked .thumb { filter: grayscale(1) brightness(.45); }
.stop .pic { position: relative; line-height: 0; border: 2px solid var(--line); background: #1a1410; }
.stop .thumb { width: 100%; image-rendering: pixelated; }
.stop b { font: 700 12px/1.15 var(--display); font-stretch: condensed; letter-spacing: 0; text-transform: uppercase; }
.stop .meta { display: flex; align-items: center; gap: 5px; font-size: 8px; color: var(--muted); }
.num-badge { position: absolute; left: 0; top: 0; min-width: 16px; padding: 2px 3px; background: #1a1410; color: #ffc233; font: 700 8px/1 var(--mono); text-align: center; line-height: 12px; }
.flag { position: absolute; right: 0; top: 0; padding: 2px 5px; font: 700 8px/12px var(--display); font-stretch: condensed; letter-spacing: 1px; text-transform: uppercase; color: #1a1410; }
.flag.boss { background: var(--ember); } .flag.trial { background: var(--violet); color: #fff; }
.hero-mark { position: absolute; left: 50%; bottom: 4px; transform: translateX(-50%); image-rendering: pixelated; }
.lock { position: absolute; inset: 0; display: grid; place-items: center; color: #f3e7d3; }
.trialrow { display: flex; align-items: center; gap: 10px; margin-top: 10px; padding-top: 10px; border-top: 2px dashed color-mix(in srgb, var(--line) 40%, transparent); }
.stop.trial:not(.here) { border-image-source: var(--fr-sunk); }

/* skills: the socket bar */
.links { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 0; }
.links { flex-wrap: nowrap; }
@container win (max-width: 640px) { .links { flex-wrap: wrap; } }
.link { flex: 0 1 18px; min-width: 8px; height: 6px; background: #1a1410; border-top: 2px solid #6b5d4b; }
.hm.dark .link { background: #000; border-top-color: #4a3d31; }
.link.off { opacity: .3; }
.sock { flex: 1 1 0; min-width: 66px; max-width: 104px; display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 6px 2px 4px; font: inherit; color: var(--text);
  border: 8px solid transparent; border-image: var(--fr-sunk) 8 fill / 8px; }
button.sock { cursor: pointer; } button.sock:hover { filter: brightness(1.12); }
.sock.main { flex-grow: 1.3; max-width: 128px; border-image-source: var(--fr-gold); color: #1a1410; }
.sock b { font: 700 12px/1.15 var(--display); letter-spacing: 1px; text-transform: uppercase; text-align: center; max-width: 100%; overflow-wrap: normal; }
.sock.main b { font-size: 12px; }
.sock.empty b, .sock.locked b { color: var(--muted); }
.sock.locked { opacity: .55; }
.gem { position: relative; display: inline-block; line-height: 0; filter: drop-shadow(1px 1px 0 #1a1410) drop-shadow(-1px -1px 0 #1a1410); }
.gem .shine { position: absolute; inset: 0; color: #ffffff; opacity: .75; }
.hole { color: var(--muted); line-height: 0; }
.li .nm { display: flex; align-items: center; gap: 6px; }
.li.locked .gem { filter: grayscale(1); }

/* forge: rack, anvil, shelf */
.smithy { display: grid; grid-template-columns: minmax(0, 1fr) minmax(250px, 320px) minmax(260px, 1fr); gap: 14px; align-items: start; }
@container win (max-width: 1080px) { .smithy { grid-template-columns: minmax(0, 1fr) minmax(250px, 1fr); } .smithy > :last-child { grid-column: 1 / -1; } }
@container win (max-width: 700px) { .smithy { grid-template-columns: 1fr; } }
.cell .worn { position: absolute; left: -2px; bottom: -3px; padding: 0 3px; background: #1a1410; color: #ffc233; font: 700 8px/12px var(--display); font-stretch: condensed; letter-spacing: 1px; text-transform: uppercase; }
.anvil-plate { display: grid; place-items: center; height: 96px; margin-bottom: 10px; border: 8px solid transparent; border-image: var(--fr-sunk) 8 fill / 8px;
  background: radial-gradient(ellipse at 50% 100%, rgba(255,120,40,.35), transparent 70%); color: var(--muted); }
.anvil-plate.rare, .anvil-plate.relic { background: radial-gradient(ellipse at 50% 100%, rgba(255,194,51,.45), transparent 70%); }
.anvil-art { width: 68px !important; height: 68px !important; image-rendering: pixelated; filter: drop-shadow(0 3px 0 rgba(0,0,0,.4)); }
.anvilcard .item { filter: none; }
.shelf { display: flex; flex-direction: column; gap: 6px; }
.cur { display: grid; grid-template-columns: auto 1fr auto; gap: 8px; align-items: center; padding: 2px 4px; border: 8px solid transparent; border-image: var(--fr-alt) 8 fill / 8px; }
.cur.none .orb canvas { filter: grayscale(.8) brightness(.8); }
.cur b { display: block; font: 700 12px/1.1 var(--display); font-stretch: condensed; letter-spacing: 1px; text-transform: uppercase; }
.cur .grow span { font-size: 12px; color: var(--muted); }
.orb { position: relative; width: 38px; height: 38px; display: grid; place-items: center; }
.orb canvas { image-rendering: pixelated; }
.orb .count { position: absolute; right: -6px; bottom: -4px; min-width: 18px; padding: 0 3px; background: #1a1410; color: #ffc233; font-size: 8px; line-height: 14px; text-align: center; }
.btn.small { min-height: 28px; padding: 0 4px; }
.treecv { border: 8px solid transparent; border-image: var(--fr-sunk) 8 fill / 8px; box-sizing: border-box; }
.treewrap { position: relative; }
.treepop { position: absolute; z-index: 3; width: 260px; max-width: calc(100% - 16px); pointer-events: none; animation: tipin .12s ease-out; }
.treepop.pinned { pointer-events: auto; }
.treepop h3 { font-size: 12px; }
.smith { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
.dust { display: flex; align-items: center; gap: 6px; padding: 4px 10px; background: #1a1410; color: #ffc233; }
.dust b { font-size: 16px; } .dust span { font: 700 12px/1 var(--display); font-stretch: condensed; letter-spacing: 1px; text-transform: uppercase; color: #b5a48b; }

/* atlas */
.ladder { display: flex; gap: 2px; flex-wrap: wrap; }
.rung { width: 26px; height: 26px; display: grid; place-items: center; background: #1a1410; color: #6b5d4b; font: 700 12px/1 var(--mono); border: 2px solid var(--line); }
.rung.done { background: var(--teal); color: #1a1410; }
.zone.map { gap: 10px; }
.mthumb { flex: none; width: 84px; height: 44px; image-rendering: pixelated; border: 2px solid var(--line); }
.zone.map b { font: 700 12px/1.1 var(--display); font-stretch: condensed; letter-spacing: 0; text-transform: uppercase; }
.pinnacle { align-items: stretch; }
.pin-frame { flex: none; width: 92px; display: grid; place-items: end center; padding: 4px; border: 2px solid var(--line); overflow: hidden; }
.pin-art { image-rendering: pixelated; max-width: 84px; max-height: 90px; object-fit: contain; }

/* the game's own tooltips (tips.ts) */
.htip { position: absolute; z-index: 20; max-width: 300px; padding: 3px 6px; pointer-events: none; white-space: pre-line;
  color: #f3e7d3; font: 12px/1.45 var(--body); border: 6px solid transparent; border-image: var(--fr-plaque) 8 fill / 6px;
  filter: drop-shadow(3px 3px 0 #000); animation: tipin .1s ease-out; }

/* states: notes, warnings, locked things */
.tag { color: var(--text); }
.li.on .tag, .skill.on .tag, .zone.on .tag, .stop.here .tag { background: #1a1410; color: #ffc233; border-color: #1a1410; }
.tag.done, .tag.teal { background: var(--teal); color: #1a1410; } .tag.here, .tag.gold { background: var(--gold); color: #1a1410; } .tag.ember { background: var(--ember); color: #1a1410; }
.note { display: flex; align-items: center; gap: 8px; padding: 6px 10px; background: #1a1410; color: #f3e7d3; font-size: 12px; border-left: 6px solid var(--teal); }
.note svg { color: var(--teal); flex: none; }
.warnbar { display: flex; align-items: center; gap: 8px; margin: -2px 0 8px; padding: 5px 8px; background: var(--ember); color: #1a1410; font-size: 12px; font-weight: 700; }
.warnbar svg { flex: none; }
.card > h3 .num.full { color: var(--ember); }
.stash-note { grid-column: 1 / -1; padding: 4px 0 6px; font-size: 12px; }
.cell.blocked, .cell.only { cursor: default; }
.cell.blocked { border-image-source: var(--fr-empty); background: repeating-linear-gradient(135deg, transparent 0 5px, color-mix(in srgb, var(--line) 22%, transparent) 5px 7px); background-clip: padding-box; }
.cell.blocked .lbl, .cell.only .lbl { display: block; color: var(--muted); }
.cell[role="button"]:focus-visible { outline: 3px dashed var(--ember); outline-offset: 1px; }
.x:disabled { opacity: .35; cursor: default; }
.x:disabled:hover { background: var(--card); color: var(--text); }
.act.folded .row { flex-wrap: nowrap; }
.act.folded .muted { font-size: 12px; }
.atlas-locked { gap: 10px; }
.gate { position: relative; line-height: 0; border: 2px solid var(--line); background: #1a1410; }
.gate-pic { display: block; width: 100%; height: auto; max-height: 150px; object-fit: cover; image-rendering: pixelated; filter: saturate(.55) brightness(.9); }
.gate .lock { color: #ffc233; }
.gate-acts { display: flex; gap: 6px; flex-wrap: wrap; }

/* creation: three callings in their scenery */
.create { max-width: 840px; margin: 0 auto; display: flex; flex-direction: column; gap: 12px; }
.create .sec { margin: 4px 0 0; }
.callings { display: grid; grid-template-columns: repeat(auto-fit, minmax(236px, 1fr)); gap: 12px; }
.calling { display: flex; flex-direction: column; gap: 6px; padding: 3px 3px 6px; text-align: left; font: inherit; color: var(--text); cursor: pointer; min-width: 0;
  border: 8px solid transparent; border-image: var(--fr-alt) 8 fill / 8px; filter: drop-shadow(3px 3px 0 var(--line)); }
.hm.dark .calling { filter: drop-shadow(3px 3px 0 #000); }
.calling:hover:not(.on) { filter: drop-shadow(3px 3px 0 var(--line)) brightness(1.08); }
.calling.on { border-image-source: var(--fr-gold); color: #1a1410; }
.calling.on .muted { color: #4d4030; }
.cpic { position: relative; display: block; line-height: 0; border: 2px solid var(--line); background: #1a1410; overflow: hidden; }
.cscene { width: 100%; aspect-ratio: 120 / 84; image-rendering: pixelated; }
.calling:not(.on) .cscene { filter: saturate(.5) brightness(.7); }
.cpick { position: absolute; left: 0; top: 0; padding: 3px 6px; background: #1a1410; color: #ffc233; line-height: 1; font: 700 12px/1 var(--display); font-stretch: condensed; letter-spacing: 1px; text-transform: uppercase; }
.cname { display: block; padding: 2px 2px 0; font: 700 16px/1 var(--display); font-stretch: condensed; letter-spacing: 2px; text-transform: uppercase; border-left: 6px solid var(--cc); padding-left: 7px; }
.cattrs { display: flex; gap: 10px; padding: 0 2px; }
.cattr { display: inline-flex; align-items: center; gap: 4px; } .cattr b { font-size: 16px; } .cattr small { font: 700 8px/1 var(--display); font-stretch: condensed; letter-spacing: 1px; text-transform: uppercase; opacity: .75; }
.cattr.might svg { color: #e5383b; } .cattr.grace svg { color: #2f9e4f; } .cattr.wit svg { color: #3a7bff; }
.calling .ds { padding: 0 2px; font-size: 12px; }
.namebar { flex-wrap: nowrap; } .namebar input { flex: 1; min-width: 0; font-size: 16px; } .namebar .btn { flex: none; }

/* log: a journal with a pixel mark per kind */
.log { background-image: repeating-linear-gradient(0deg, transparent 0 23px, color-mix(in srgb, var(--line) 10%, transparent) 23px 24px); }
.log .entry { border-bottom: 0; min-height: 24px; align-items: center; }
.log .lg { flex: none; width: 22px; height: 22px; display: grid; place-items: center; color: #1a1410; border: 2px solid var(--line); }
.log .entry.k-death .grow { color: var(--red); } .hm.dark .log .entry.k-death .grow { color: #ff8a8c; }
.log .entry.k-level .grow, .log .entry.k-boss .grow { font-weight: 700; }
/* narrow window, after the rules above it overrides: every tab fits the icon row, sockets keep their names */
@container win (max-width: 640px) {
  .nav button { display: flex; justify-content: center; align-items: center; flex: 1 1 0; min-width: 0; padding: 9px 0; }
  .nav .badge { position: absolute; right: 1px; top: 1px; margin: 0; min-width: 14px; height: 13px; line-height: 9px; }
  .sock { min-width: 84px; }
}
.portrait-frame { text-align: center; }
/* round 3: locks, marks, the relic codex, the forge's hone and bench */
.cell .lockb { position: absolute; left: -4px; top: -4px; width: 15px; height: 15px; display: grid; place-items: center; background: #1a1410; color: #ffc233; border: 1px solid #ffc233; z-index: 1; }
.cell.mark { outline: 3px dashed var(--ember); outline-offset: 1px; }
.cell.mark canvas { opacity: .55; }
.stash.codex .cell { cursor: default; }
.stash.codex .cell.relic { cursor: pointer; }
.cell.ghost, .cell.unknown { border-image-source: var(--fr-empty); }
.cell.ghost canvas { filter: grayscale(1) brightness(.75); opacity: .6; }
.cell.ghost .cnt { position: absolute; right: -2px; bottom: -3px; padding: 0 3px; background: #1a1410; color: #e6d9b8; font: 700 8px/12px var(--mono); }
.cell.unknown .q { font: 700 20px/1 var(--display); color: var(--muted); opacity: .6; }
.tools { gap: 6px; flex-wrap: wrap; }
.tag.q { background: var(--teal); color: #1a1410; } .tag.lk { background: #1a1410; color: #ffc233; border-color: #1a1410; display: inline-flex; align-items: center; gap: 3px; }
.aff.bench { color: var(--teal); } .hm.dark .aff.bench { color: #6fe0cf; }
.work { display: flex; flex-direction: column; gap: 8px; margin-top: 10px; padding-top: 10px; border-top: 2px dashed color-mix(in srgb, var(--line) 50%, transparent); }
.work .wrow { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.work .wrow > b { min-width: 48px; font: 700 12px/1 var(--display); font-stretch: condensed; letter-spacing: 1px; text-transform: uppercase; }
.work select { flex: 1 1 140px; min-width: 0; }
.qbar { flex: 1 1 80px; height: 8px; border: 2px solid var(--line); background: var(--paper2); position: relative; }
.qbar i { position: absolute; inset: 0 auto 0 0; background: var(--teal); }
/* worn items in item lists: a gold frame and tag; hover links between the doll and the stash */
.cell.wornc::after { content: ""; position: absolute; inset: -6px; border: 2px solid #ffc233; box-shadow: 0 0 6px rgba(255,194,51,.55); pointer-events: none; }
.cell.wornc .worn { background: #ffc233; color: #1a1410; border: 1px solid #1a1410; z-index: 1; white-space: nowrap; }
.gridsep { grid-column: 1 / -1; display: flex; align-items: center; gap: 6px; padding: 4px 0 2px; font: 700 12px/1 var(--display); font-stretch: condensed; letter-spacing: 1px; text-transform: uppercase; color: var(--muted); }
.gridsep::after { content: ""; flex: 1; border-bottom: 2px dashed color-mix(in srgb, var(--line) 40%, transparent); }
.doll .cell.cmp { outline: 3px solid #ffc233; outline-offset: 1px; animation: cmpglow .9s ease-in-out infinite alternate; }
@keyframes cmpglow { from { outline-color: #ffc233; } to { outline-color: #ff8a3a; } }
.gear.slotpick .stash .cell[data-uid]:not(.fits) { opacity: .3; }
.gear.slotpick .stash .cell.fits { outline: 2px solid var(--teal); outline-offset: 1px; }
/* companions (Hero tab) */
.pet-now { display: flex; gap: 12px; align-items: center; margin-bottom: 10px; }
.pet-stage { flex: none; width: 104px; height: 104px; display: grid; place-items: end center; padding-bottom: 8px; border: 8px solid transparent; border-image: var(--fr-sunk) 8 fill / 8px; background: radial-gradient(ellipse at 50% 85%, rgba(255,194,51,.25), transparent 65%); }
.petart { image-rendering: pixelated; }
.pet-stage .petart { max-width: 84px; max-height: 84px; object-fit: contain; }
.pet-bonus { font-weight: 700; color: var(--teal); } .hm.dark .pet-bonus { color: #6fe0cf; }
.pet-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(92px, 1fr)); gap: 6px; }
.pet { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 4px 2px 5px; min-width: 0; font: inherit; color: var(--text); text-align: center; cursor: pointer;
  border: 8px solid transparent; border-image: var(--fr-alt) 8 fill / 8px; }
.pet .pic { height: 40px; display: grid; place-items: end center; }
.pet .pic .petart { max-height: 40px; max-width: 64px; width: auto !important; height: auto !important; }
.pet b { font-size: 12px; line-height: 1.1; } .pet span:last-child { font-size: 11px; color: var(--muted); }
.pet.on { border-image-source: var(--fr-gold); color: #1a1410; cursor: default; } .pet.on span:last-child { color: #4d4030; }
.pet.unknown { cursor: default; opacity: .6; } .pet.unknown .q { font: 700 22px/1 var(--display); color: var(--muted); }
.pet:hover:not(.on):not(.unknown) { filter: brightness(1.08); }
.scout { margin-top: 4px; padding: 2px 6px; display: inline-block; font: 700 12px/1.3 var(--display); font-stretch: condensed; letter-spacing: 1px; text-transform: uppercase; border: 2px solid var(--line); }
.scout.ok { background: var(--green); color: #1a1410; } .scout.mid { background: var(--gold); color: #1a1410; } .scout.bad { background: var(--ember); color: #1a1410; }
/* round 5: stones, sockets, the market, echoes, the Rekindling */
.stonechip { display: inline-grid; place-items: center; filter: drop-shadow(1px 1px 0 #1a1410); }
.stonechip.empty { color: var(--muted); filter: none; }
.stonechip.t0 { opacity: .55; } .stonechip.t1 { opacity: .7; } .stonechip.t2 { opacity: .85; }
.stonechip.t4 { filter: drop-shadow(0 0 3px currentColor) drop-shadow(1px 1px 0 #1a1410); }
.sockrows { display: flex; flex-direction: column; gap: 2px; }
.sockrow { display: flex; align-items: center; gap: 6px; }
.sockwork { align-items: center; }
.sock1 { display: inline-flex; align-items: center; gap: 3px; }
.sock1 select { max-width: 150px; }
.offers { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 6px; }
.offer { display: flex; align-items: center; gap: 8px; padding: 4px 6px; min-width: 0; border: 8px solid transparent; border-image: var(--fr-alt) 8 fill / 8px; }
.offer.sold { opacity: .5; }
.offer .name { font-size: 13px; line-height: 1.15; overflow: hidden; text-overflow: ellipsis; }
.offer .tag.up { background: var(--green); color: #1a1410; align-self: flex-start; }
.offer .cell { flex: none; width: 48px; height: 48px; }
.stonebig { width: 32px; display: grid; place-items: center; }
.pouch { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 4px; }
.pouchrow { display: flex; align-items: center; gap: 8px; padding: 2px 4px; border-bottom: 1px dashed color-mix(in srgb, var(--line) 30%, transparent); }
.echoes .echo { padding: 6px 8px; border: 8px solid transparent; border-image: var(--fr-alt) 8 fill / 8px; }
.echoes .echo.unheard { opacity: .6; }
.echoes .echo .story { margin-top: 4px; }
.dawncard .shards { display: flex; align-items: center; gap: 6px; }
.dawncard .shard { color: var(--muted); opacity: .45; } .dawncard .shard.on { color: #ffc233; opacity: 1; filter: drop-shadow(0 0 3px #ffc233); }
.tag.dawn { background: #ffc233; color: #1a1410; border-color: #1a1410; }
/* Hollow Night (October) */
.card.hollow { box-shadow: 0 0 0 2px #ff7a1a inset; }
.card.hollow h3 .pxc, .card.hollow h3 svg { color: #ff7a1a; }
.tag.lit { background: #ff7a1a; color: #1a1410; }
/* first-time hints */
.note.hint1 { border-left-color: var(--gold); margin-bottom: 8px; }
.note.hint1 svg { color: var(--gold); }
.note.hint1 .btn { flex: none; }
.perks { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 6px; }
.perk { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; padding: 6px 8px; text-align: left; font: inherit; color: var(--text); cursor: pointer;
  border: 8px solid transparent; border-image: var(--fr-alt) 8 fill / 8px; }
.perk span { font-size: 12px; color: var(--muted); }
.perk.on { border-image-source: var(--fr-gold); color: #1a1410; cursor: default; }
.perk:hover:not(.on) { filter: brightness(1.08); }
.contracts { display: flex; flex-direction: column; gap: 6px; }
.contract { display: flex; align-items: center; gap: 10px; padding: 4px 6px; border: 8px solid transparent; border-image: var(--fr-alt) 8 fill / 8px; }
.contract.done { border-image-source: var(--fr-gold); color: #1a1410; }
.contract.done .muted { color: #4d4030; }
.contract .cg { flex: none; width: 26px; height: 26px; display: grid; place-items: center; background: #1a1410; color: #ffc233; border: 2px solid var(--line); }
.contract .meter { height: 14px; } .contract .meter i { background: var(--teal); } .contract.done .meter i { background: var(--gold); } .contract .meter span { font-size: 11px; line-height: 10px; }
/* Longer words (Russian and Ukrainian run 20-40% longer): a socket label whose word doesn't fit drops to the
   small size (views.ts measures it) instead of breaking the word; small caps labels lose their letter-spacing. */
.sock b.long { font-size: 8px; line-height: 1.3; letter-spacing: 0; overflow-wrap: anywhere; }
.lang-ru .cattrs, .lang-uk .cattrs { flex-wrap: wrap; row-gap: 2px; }
.lang-ru .cattr small, .lang-uk .cattr small, .lang-ru .attr span, .lang-uk .attr span, .lang-ru .stat span, .lang-uk .stat span,
.lang-ru .fchip span, .lang-uk .fchip span { letter-spacing: 0; }
@media (prefers-reduced-motion: reduce) { .hm *, .hm *::before, .hm *::after { animation: none !important; transition: none !important; } }
`;
