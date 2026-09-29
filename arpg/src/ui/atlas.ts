// The Atlas tab: map stash, map crafting, the atlas tree and pinnacles.

import { ATLAS, CURRENCIES, MAP_MODS, MAX_TIER, PINNACLES, tierName } from "../core/data";
import { atlasPointsLeft, canTakeAtlas, craftMap, endgameOpen, mapLabel, queuePinnacle, setMapMode, setMapTier, takeAtlas } from "../core/maps";
import { h } from "./dom";
import { MAP_DEATH_XP } from "../core/sim/engine";
import type { Ctx } from "./views";

const MAP_CRAFTS = ["kindling", "reshaper", "graft", "crownseal", "forgeheart", "tempest", "starfall", "salt"];
const RCOLOR = { plain: "var(--r-plain)", enchanted: "var(--r-enchanted)", rare: "var(--r-rare)" };

export function atlasSig(c: Ctx): string {
    const s = c.state;
    return `${endgameOpen(s)}:${s.activity.mode}:${s.activity.mapTier}:${s.activity.autoCap}:${s.activity.pinnacle}:${s.maps.length}:${s.maps[s.maps.length - 1]?.uid}:${s.atlas.points}:${s.atlas.nodes.length}:${JSON.stringify(s.sigils)}:${c.sel.uid}:${s.craftSeq}`;
}

export function atlasView(c: Ctx): HTMLElement {
    const st = c.state;
    if (!endgameOpen(st)) {
        return h("div", { class: "card col" }, h("h3", { text: "The Cinderlands" }),
            h("div", { class: "story", text: "Past the crater the land is all ember and ash, and it never ends. Clear the Sunfall to walk it." }),
            h("div", { class: "muted", text: "Maps also drop in Act 3 once you get there; keep them for later." }),
            h("div", { class: "tag", text: `${st.maps.length} maps collected` }));
    }
    const root = h("div", { class: "col" });

    // Controls.
    const mode = h("input", { attrs: { type: "checkbox" } });
    mode.checked = st.activity.mode === "map";
    mode.addEventListener("change", () => c.act(s => setMapMode(s, mode.checked)));
    const tiers = [...new Set([...st.maps.map(m => m.tier), ...(st.activity.mapTier ? [st.activity.mapTier] : [])])].sort((a, b) => a - b);
    const tierSel = h("select");
    tierSel.append(h("option", { text: "Highest tier first", attrs: { value: "0" } }));
    for (const t of tiers) tierSel.append(h("option", { text: `${tierName(t)} and below${st.maps.some(m => m.tier === t) ? "" : " (none in stash)"}`, attrs: { value: String(t) } }));
    tierSel.value = String(st.activity.mapTier);
    tierSel.addEventListener("change", () => c.act(s => setMapTier(s, +tierSel.value)));
    const deepest = Math.max(0, ...st.atlas.tiers);
    root.append(h("div", { class: "card col" },
        h("h3", { text: "The map device" }),
        h("label", { class: "chk" }, mode, "Run maps instead of story zones (no maps left: the Outskirts, which drop Tier 1 maps)"),
        h("div", { class: "row" }, "Order", tierSel,
            h("span", { class: "tag", text: `${st.maps.length}/${st.mapCap} maps` }),
            h("span", { class: "tag", text: `Deepest: ${deepest ? tierName(deepest) : "none"}` }),
            st.activity.autoCap ? h("span", { class: "tag", style: "background:var(--ember)", text: `Auto-push cap: ${tierName(st.activity.autoCap)}` }) : null),
        tierChips(st.atlas.tiers),
        h("div", { class: "muted", style: "font-size:11px", text: `Dying in a map loses it and ${MAP_DEATH_XP * 100}% of a level's experience. Mods make maps harder and richer.` })));

    // Map stash.
    const list = h("div", { class: "col", style: "gap:4px" });
    const maps = [...st.maps].sort((a, b) => b.tier - a.tier || b.mods.length - a.mods.length);
    for (const m of maps.slice(0, 40)) {
        const on = c.sel.uid === m.uid;
        list.append(h("div", { class: `zone${on ? " on" : ""}`, style: "margin:0", on: { click: () => { c.sel = { uid: m.uid }; c.rerender(); } } },
            h("div", { class: "tag", style: `background:${RCOLOR[m.rarity]}`, text: tierName(m.tier) }),
            h("div", { class: "grow" }, h("div", { style: "font-weight:800", text: mapLabel(m) }),
                m.mods.length ? h("div", { class: "muted", style: "font-size:11px", text: m.mods.map(id => MAP_MODS[id]?.text ?? id).join(" / ") }) : null)));
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
        h("div", { class: "muted", style: "font-size:11px", text: `First clears of tiers 1-${MAX_TIER} give a point each, every fifth Depth one more, pinnacles two.` }), grid));

    // Pinnacles.
    const pins = h("div", { class: "grid2" });
    for (const p of Object.values(PINNACLES)) {
        const have = st.sigils[p.sigil] ?? 0;
        const queued = st.activity.pinnacle === p.id;
        pins.append(h("div", { class: "skill", style: "cursor:default" },
            h("div", { class: "grow" }, h("div", { class: "nm", text: p.name }), h("div", { class: "ds", text: p.text }),
                h("div", { class: "ds muted", text: `Level ${p.level}. ${p.sigilName}s drop from map bosses at ${tierName(p.minTier)}+. Kills: ${st.pinnacleKills[p.id] ?? 0}.` }),
                h("button", { class: "btn hot", style: "margin-top:6px", text: queued ? "Next run" : `Challenge (${have}/${p.cost})`, attrs: have >= p.cost && !queued ? {} : { disabled: "" },
                    on: { click: () => c.act(s => queuePinnacle(s, p.id), `${p.name} is next`) } }))));
    }
    root.append(h("div", { class: "card col" }, h("h3", { text: "Pinnacles" }), pins));
    return root;
}

function tierChips(done: number[]): HTMLElement {
    const row = h("div", { class: "row", style: "gap:3px" });
    for (let t = 1; t <= MAX_TIER; t++) row.append(h("span", { class: "tag", style: done.includes(t) ? "background:var(--teal)" : "opacity:.5", text: String(t) }));
    return row;
}
