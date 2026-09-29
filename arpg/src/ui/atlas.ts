// The Atlas tab: map stash, map crafting, the atlas tree and pinnacles.

import { ACTS, ATLAS, CURRENCIES, MAP_AREAS, MAP_MODS, MAX_TIER, PINNACLES, ZONES, tierName } from "../core/data";
import { scoutPinnacle, type Scout } from "../core/scout";
import type { GameState } from "../core/state";
import { autoXpCap, atlasPointsLeft, canTakeAtlas, craftMap, endgameOpen, mapLabel, queuePinnacle, setMapMode, setMapTier, takeAtlas } from "../core/maps";
import { h } from "./dom";
import { glyph } from "./glyphs";
import { MAP_DEATH_XP } from "../core/sim/engine";
import type { Ctx } from "./views";
import { scenery } from "./gfx/portrait";
import { spriteCanvas } from "./gfx/sprites";
import { MONSTER_CAST } from "./gfx/cast";

const MAP_CRAFTS = ["kindling", "reshaper", "graft", "crownseal", "forgeheart", "tempest", "starfall", "salt"];
const RCOLOR = { plain: "var(--r-plain)", enchanted: "var(--r-enchanted)", rare: "var(--r-rare)" };

export function atlasSig(c: Ctx): string {
    const s = c.state;
    return `${endgameOpen(s)}:${s.activity.mode}:${s.activity.mapTier}:${s.activity.autoCap}:${s.activity.pinnacle}:${s.maps.length}:${s.maps[s.maps.length - 1]?.uid}:${s.atlas.points}:${s.atlas.nodes.length}:${JSON.stringify(s.sigils)}:${c.sel.uid}:${s.craftSeq}`;
}

export function atlasView(c: Ctx): HTMLElement {
    const st = c.state;
    if (!endgameOpen(st)) {
        // Locked: what opens it, how far the hero is, and a glimpse of what waits.
        const gate = ZONES.a3_sunfall!;
        const pic = scenery(gate, 240, 80);
        pic.className = "gate-pic";
        const acts = h("div", { class: "gate-acts" }, ...ACTS.map(a => {
            const done = !!st.world.clears[a.zones[a.zones.length - 1]!];
            const here = a.zones.includes(st.activity.zone) || a.trial === st.activity.zone;
            return h("span", { class: `tag${done ? " done" : here ? " here" : ""}`, text: `Act ${a.id}${done ? ": cleared" : here ? ": here" : ""}` });
        }));
        return h("div", { class: "card col atlas-locked" }, h("h3", { text: "The Cinderlands" }),
            h("div", { class: "gate" }, pic, h("span", { class: "lock" }, glyph("block", 22))),
            h("div", { class: "story", text: "Past the crater the land is all ember and ash, and it never ends. Clear the Sunfall to walk it." }),
            h("div", { class: "row" }, h("span", { class: "sub", style: "margin:0", text: "Opens after" }), h("b", { text: `${gate.name} (area level ${gate.level})` }),
                h("span", { class: "muted", text: `the hero is level ${st.hero.level}` })),
            acts,
            h("div", { class: "sub", style: "margin:4px 0 0", text: `Then ${MAX_TIER} map tiers and the endless Depths` }),
            tierChips([]),
            h("div", { class: "muted", text: st.maps.length ? `${st.maps.length} map${st.maps.length === 1 ? "" : "s"} already found and kept for later.` : "Maps start to drop in Act 3; they are kept for later." }));
    }
    const root = h("div", { class: "col" });

    // Controls.
    const onMaps = st.activity.mode === "map";
    const mode = h("button", { class: `toggle${onMaps ? " on" : ""}`, attrs: { role: "switch", "aria-checked": String(onMaps) }, on: { click: () => c.act(s => setMapMode(s, !onMaps)) } },
        h("i"), h("span", null, h("b", { text: "Run maps" }), h("small", { text: "Instead of story zones. With no maps left: the Outskirts, which drop Tier 1 maps." })));
    const tiers = [...new Set([...st.maps.map(m => m.tier), ...(st.activity.mapTier ? [st.activity.mapTier] : [])])].sort((a, b) => a - b);
    const tierSel = h("select");
    tierSel.append(h("option", { text: "Highest tier first", attrs: { value: "0" } }));
    for (const t of tiers) tierSel.append(h("option", { text: `${tierName(t)} and below${st.maps.some(m => m.tier === t) ? "" : " (none in stash)"}`, attrs: { value: String(t) } }));
    tierSel.value = String(st.activity.mapTier);
    tierSel.addEventListener("change", () => c.act(s => setMapTier(s, +tierSel.value)));
    const deepest = Math.max(0, ...st.atlas.tiers);
    root.append(h("div", { class: "card col" },
        h("h3", { text: "The map device" }),
        mode,
        h("div", { class: "row" }, "Order", tierSel,
            h("span", { class: "tag", text: `${st.maps.length}/${st.mapCap} maps` }),
            h("span", { class: "tag", text: `Deepest: ${deepest ? tierName(deepest) : "none"}` }),
            autoXpCap(st) ? h("span", { class: "tag", title: "Auto-push keeps to tiers within 4 levels of the hero for experience", text: `XP cap: ${tierName(autoXpCap(st))}` }) : null,
            st.activity.autoCap ? h("span", { class: "tag ember", text: `Auto-push cap: ${tierName(st.activity.autoCap)}` }) : null),
        tierChips(st.atlas.tiers),
        h("div", { class: "muted", style: "font-size:12px", text: `Dying in a map loses it and ${MAP_DEATH_XP * 100}% of a level's experience. Mods make maps harder and richer.` })));

    // Map stash.
    const list = h("div", { class: "col", style: "gap:4px" });
    const maps = [...st.maps].sort((a, b) => b.tier - a.tier || b.mods.length - a.mods.length);
    for (const m of maps.slice(0, 40)) {
        const on = c.sel.uid === m.uid;
        const area = MAP_AREAS[m.area];
        const thumb = area ? scenery({ id: "map", name: area.name, palette: area.palette }, 84, 44) : null;
        if (thumb) thumb.className = "mthumb";
        list.append(h("div", { class: `zone map${on ? " on" : ""}`, style: "margin:0", on: { click: () => { c.sel = { uid: m.uid }; c.rerender(); } } },
            thumb,
            h("div", { class: "grow" }, h("div", { class: "row", style: "gap:6px" }, h("span", { class: "tag", style: `background:${RCOLOR[m.rarity]};color:#1a1410`, text: tierName(m.tier) }), h("b", { text: mapLabel(m) })),
                m.mods.length ? h("div", { class: "muted", style: "font-size:12px;margin-top:2px", text: m.mods.map(id => MAP_MODS[id]?.text ?? id).join(" / ") }) : null)));
    }
    if (!maps.length) list.append(h("div", { class: "muted", text: "No maps yet. The Outskirts and Act 3 drop them." }));
    const sel = st.maps.find(m => m.uid === c.sel.uid);
    const bench = h("div", { class: "row", style: "gap:4px" });
    if (sel) {
        for (const id of MAP_CRAFTS) {
            const have = st.currency[id] ?? 0;
            bench.append(h("button", { class: "btn alt", text: `${CURRENCIES[id]!.name} (${have})`, title: CURRENCIES[id]!.blurb, attrs: have ? {} : { disabled: "" },
                on: { click: () => c.act(s => craftMap(s, id, sel.uid)) } }));
        }
    }
    root.append(h("div", { class: "card col" }, h("h3", { text: "Maps" }), list,
        sel ? h("div", { class: "col" }, h("div", { class: "muted", text: `Craft ${mapLabel(sel)}:` }), bench) : null));

    // Atlas tree.
    const left = atlasPointsLeft(st);
    const grid = h("div", { class: "grid2" });
    for (const n of Object.values(ATLAS)) {
        const own = st.atlas.nodes.includes(n.id);
        const err = own ? null : canTakeAtlas(st, n.id);
        const locked = !own && !!err && err !== "no atlas points";
        grid.append(h("div", { class: `skill${own ? " on" : ""}${locked ? " locked" : ""}`, on: { click: () => { if (!own && !err) c.act(s => takeAtlas(s, n.id)); } } },
            h("div", { class: "grow" }, h("div", { class: "nm", text: n.name }), h("div", { class: "ds", text: n.text }),
                n.requires.length ? h("div", { class: "ds muted", text: `After: ${n.requires.map(r => ATLAS[r]?.name ?? r).join(", ")}` }) : null),
            h("div", { class: "tag", text: own ? "taken" : err ? (locked ? "locked" : "no points") : "take" })));
    }
    root.append(h("div", { class: "card col" }, h("h3", { text: `Atlas (${left} point${left === 1 ? "" : "s"} left)` }),
        h("div", { class: "muted", style: "font-size:12px", text: `First clears of tiers 1-${MAX_TIER} give a point each, every fifth Depth one more, pinnacles two.` }), grid));

    // Pinnacles.
    const pins = h("div", { class: "grid2" });
    for (const p of Object.values(PINNACLES)) {
        const have = st.sigils[p.sigil] ?? 0;
        const queued = st.activity.pinnacle === p.id;
        const cast = MONSTER_CAST[p.boss];
        const art = cast ? spriteCanvas(cast.sprite) : null;
        if (art) art.className = "pin-art";
        pins.append(h("div", { class: "skill pinnacle", style: "cursor:default" },
            art ? h("div", { class: "pin-frame", style: `background:${p.palette[0]}` }, art) : null,
            h("div", { class: "grow" }, h("div", { class: "nm", text: p.name }), h("div", { class: "ds", text: p.text }),
                h("div", { class: "ds muted", text: `Level ${p.level}. ${p.sigilName}s drop from map bosses at ${tierName(p.minTier)}+. Kills: ${st.pinnacleKills[p.id] ?? 0}.` }),
                scoutLine(c, p.id),
                h("div", { class: "row", style: "margin-top:6px;gap:6px" },
                    h("button", { class: "btn hot", text: queued ? "Next run" : `Challenge (${have}/${p.cost})`, attrs: have >= p.cost && !queued ? {} : { disabled: "" },
                        on: { click: () => c.act(s => queuePinnacle(s, p.id), `${p.name} is next`) } }),
                    h("button", { class: "btn alt", text: "Scout", title: "Fight it five times on a copy of your hero (nothing is spent) to see the odds",
                        on: { click: () => { scouted.set(scoutKey(st, p.id), scoutPinnacle(st, p.id, 5)); c.rerender(); } } })))));
    }
    root.append(h("div", { class: "card col" }, h("h3", { text: "Pinnacles" }), pins));
    return root;
}

/** Scout results, valid while the hero's sheet is unchanged. */
const scouted = new Map<string, Scout>();
const scoutKey = (st: GameState, id: string) => `${id}:${st.hero.rev}:${st.hero.level}`;

function scoutLine(c: Ctx, id: string): HTMLElement | null {
    const r = scouted.get(scoutKey(c.state, id));
    if (!r) return null;
    const odds = r.wins / Math.max(1, r.trials);
    const verdict = odds >= 0.8 ? "ready" : odds >= 0.4 ? "risky" : "not yet";
    return h("div", { class: `scout ${odds >= 0.8 ? "ok" : odds >= 0.4 ? "mid" : "bad"}`, text: `Scouted: won ${r.wins} of ${r.trials}${r.wins ? `, about ${r.seconds} s each` : ""} - ${verdict}` });
}

/** The tier ladder: one rung per tier, lit once cleared. */
function tierChips(done: number[]): HTMLElement {
    const row = h("div", { class: "ladder", attrs: { "aria-label": `Tiers cleared: ${done.length} of ${MAX_TIER}` } });
    for (let t = 1; t <= MAX_TIER; t++) row.append(h("span", { class: `rung${done.includes(t) ? " done" : ""}`, title: `${tierName(t)}${done.includes(t) ? ": cleared" : ""}`, text: String(t) }));
    return row;
}
