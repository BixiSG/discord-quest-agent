// Neo-brutalist look: cream paper, black 3px lines, hard offset shadows,
// loud flat colours. Everything is scoped to the game's shadow root.

export const CSS = `
:host { all: initial; }
* { box-sizing: border-box; }
.hm {
  --paper: #fff4dc; --paper2: #ffe3a8; --card: #ffffff; --text: #111111; --muted: #5b5446; --line: #111111;
  --ember: #ff5a36; --gold: #ffc233; --teal: #19b3a3; --blue: #3a7bff; --violet: #8b5cf6; --green: #3fbf5f; --red: #e5383b;
  --r-plain: #d8d8d8; --r-enchanted: #5aa9ff; --r-rare: #ffd23f; --r-relic: #ff8a1f;
  --sh: 4px 4px 0 var(--line);
  font: 13px/1.35 "Segoe UI", system-ui, -apple-system, sans-serif; color: var(--text);
}
.hm.dark { --paper: #2a2533; --paper2: #3a3346; --card: #342e40; --text: #f7f1e6; --muted: #bdb3a3; --line: #000000; }
.win {
  position: fixed; z-index: 10050; display: flex; flex-direction: column; min-width: 360px; min-height: 320px;
  background: var(--paper); border: 3px solid var(--line); box-shadow: 8px 8px 0 var(--line); overflow: hidden;
}
.bar { display: flex; align-items: center; gap: 8px; padding: 6px 8px; background: var(--ember); border-bottom: 3px solid var(--line); cursor: move; user-select: none; touch-action: none; }
.bar .logo { font-weight: 900; letter-spacing: 1px; font-size: 14px; color: #111; text-transform: uppercase; }
.bar .who { flex: 1; font-weight: 700; color: #111; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
button:focus-visible, select:focus-visible, input:focus-visible, textarea:focus-visible, .win:focus-visible { outline: 3px dashed var(--ember); outline-offset: 2px; }
.win:focus { outline: none; }
.x { cursor: pointer; background: var(--card); color: var(--text); border: 2px solid var(--line); width: 26px; height: 26px; font-weight: 900; box-shadow: 2px 2px 0 var(--line); }
.x:hover { background: var(--gold); color: #111; }
.grip { position: absolute; right: 0; bottom: 0; width: 18px; height: 18px; cursor: nwse-resize; touch-action: none;
  background: linear-gradient(135deg, transparent 50%, var(--line) 50%, var(--line) 60%, transparent 60%, transparent 70%, var(--line) 70%, var(--line) 80%, transparent 80%); }
.stage { position: relative; border-bottom: 3px solid var(--line); background: #111; flex: none; }
.stage canvas { display: block; width: 100%; height: 100%; image-rendering: pixelated; }
.hud { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 10px; padding: 6px 8px; border-bottom: 3px solid var(--line); background: var(--paper2); flex: none; }
.meter { position: relative; height: 16px; border: 2px solid var(--line); background: var(--card); overflow: hidden; }
.meter i { position: absolute; left: 0; top: 0; bottom: 0; }
.meter span { position: relative; font-size: 11px; font-weight: 800; padding-left: 4px; line-height: 12px; color: var(--text); text-shadow: 1px 1px 0 var(--paper); white-space: nowrap; }
.tabs { display: flex; gap: 0; border-bottom: 3px solid var(--line); background: var(--paper); flex: none; overflow-x: auto; }
.tabs button { flex: 1; min-width: 60px; padding: 6px 4px; background: transparent; border: 0; border-right: 3px solid var(--line); font-weight: 800; color: var(--text); cursor: pointer; font-size: 12px; text-transform: uppercase; }
.tabs button:last-child { border-right: 0; }
.tabs button.on { background: var(--gold); color: #111; }
.tabs button:hover:not(.on) { background: var(--paper2); }
.body { flex: 1; overflow: auto; padding: 10px; }
.row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.col { display: flex; flex-direction: column; gap: 8px; }
.grow { flex: 1; }
.card { background: var(--card); border: 3px solid var(--line); box-shadow: var(--sh); padding: 8px 10px; }
.card h3 { margin: 0 0 6px; font-size: 12px; font-weight: 900; text-transform: uppercase; letter-spacing: .5px; }
.btn { cursor: pointer; font: inherit; font-weight: 800; padding: 5px 10px; background: var(--gold); color: #111; border: 3px solid var(--line); box-shadow: 3px 3px 0 var(--line); }
.btn:hover { transform: translate(-1px, -1px); box-shadow: 4px 4px 0 var(--line); }
.btn:active { transform: translate(2px, 2px); box-shadow: 1px 1px 0 var(--line); }
.btn.alt { background: var(--card); color: var(--text); }
.btn.hot { background: var(--ember); color: #111; }
.btn:disabled { opacity: .45; cursor: default; transform: none; box-shadow: 3px 3px 0 var(--line); }
.tag { display: inline-block; font-size: 10px; font-weight: 800; padding: 1px 5px; border: 2px solid var(--line); background: var(--paper2); text-transform: uppercase; }
.muted { color: var(--muted); }
.num { font-variant-numeric: tabular-nums; font-family: "Cascadia Mono", Consolas, "Courier New", monospace; }
.kv { display: grid; grid-template-columns: 1fr auto; gap: 1px 12px; }
.kv > :nth-child(odd) { color: var(--muted); }
.kv > :nth-child(even) { text-align: right; font-weight: 700; }
.kv .click { cursor: pointer; text-decoration: underline dotted; }
.big { font-size: 22px; font-weight: 900; }
.grid2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px; }
.slots { display: grid; grid-template-columns: repeat(4, 56px); gap: 6px; }
.cell { position: relative; width: 56px; height: 56px; border: 3px solid var(--line); background: var(--card); cursor: pointer; display: flex; align-items: center; justify-content: center; }
.cell canvas { width: 36px; height: 36px; image-rendering: pixelated; }
.cell .lbl { position: absolute; bottom: 1px; left: 2px; font-size: 9px; font-weight: 800; color: var(--muted); text-transform: uppercase; }
.cell.sel { outline: 3px solid var(--ember); outline-offset: 1px; }
.cell.plain { background: var(--r-plain); } .cell.enchanted { background: var(--r-enchanted); } .cell.rare { background: var(--r-rare); } .cell.relic { background: var(--r-relic); }
.cell.empty { background: repeating-linear-gradient(45deg, var(--paper), var(--paper) 6px, var(--paper2) 6px, var(--paper2) 12px); }
.stash { display: grid; grid-template-columns: repeat(auto-fill, 48px); gap: 4px; }
.stash .cell { width: 48px; height: 48px; }
.stash .cell canvas { width: 30px; height: 30px; }
.item { min-width: 220px; }
.item .name { font-weight: 900; font-size: 14px; padding: 4px 6px; border: 3px solid var(--line); margin: -8px -10px 6px; }
.item .name.plain { background: var(--r-plain); color: #111; } .item .name.enchanted { background: var(--r-enchanted); color: #111; }
.item .name.rare { background: var(--r-rare); color: #111; } .item .name.relic { background: var(--r-relic); color: #111; }
.item .aff { font-size: 12px; }
.item .aff b { font-size: 9px; color: var(--muted); margin-left: 4px; }
.item hr { border: 0; border-top: 2px dashed var(--line); margin: 6px 0; }
.up { color: var(--green); font-weight: 800; } .down { color: var(--red); font-weight: 800; }
.skill { display: flex; gap: 8px; align-items: flex-start; padding: 6px 8px; border: 3px solid var(--line); background: var(--card); cursor: pointer; box-shadow: 3px 3px 0 var(--line); }
.skill.on { background: var(--gold); color: #111; }
.skill.locked { opacity: .5; cursor: default; }
.skill .nm { font-weight: 900; }
.skill .ds { font-size: 11px; }
.zone { display: flex; gap: 8px; align-items: center; padding: 6px 8px; border: 3px solid var(--line); background: var(--card); cursor: pointer; margin-bottom: 6px; }
.zone.on { background: var(--teal); color: #111; }
.zone.locked { opacity: .45; cursor: default; }
.log div { padding: 2px 0; border-bottom: 1px dashed var(--muted); font-size: 12px; }
.modal { position: absolute; inset: 0; background: rgba(0,0,0,.45); display: flex; align-items: center; justify-content: center; z-index: 5; padding: 16px; }
.modal .card { max-width: 440px; width: 100%; max-height: 100%; overflow: auto; }
input[type=text], textarea, select { font: inherit; padding: 5px 7px; border: 3px solid var(--line); background: var(--card); color: var(--text); }
textarea { width: 100%; min-height: 70px; font-family: Consolas, monospace; font-size: 11px; }
label.chk { display: flex; gap: 6px; align-items: center; cursor: pointer; font-weight: 700; }
.toast { position: absolute; left: 50%; bottom: 14px; transform: translateX(-50%); background: var(--card); border: 3px solid var(--line); box-shadow: var(--sh); padding: 6px 12px; font-weight: 800; z-index: 6; pointer-events: none; }
.progress { height: 18px; border: 3px solid var(--line); background: var(--card); } .progress i { display: block; height: 100%; background: var(--teal); }
.story { font-style: italic; border-left: 6px solid var(--ember); padding-left: 8px; }
`;
