// The Atlas tab: map stash, map crafting, the atlas tree and pinnacles.

import { ACTS, ATLAS, CURRENCIES, MAP_AREAS, MAX_TIER, PINNACLES, ZONES } from "../core/data";
import { scoutPinnacle, type Scout } from "../core/scout";
import type { GameState } from "../core/state";
import { autoXpCap, atlasPointsLeft, canTakeAtlas, craftMap, endgameOpen, queuePinnacle, setMapMode, setMapTier, takeAtlas } from "../core/maps";
import { h } from "./dom";
import { glyph } from "./glyphs";
import { MAP_DEATH_XP } from "../core/sim/engine";
import type { Ctx } from "./views";
import { scenery } from "./gfx/portrait";
import { spriteCanvas } from "./gfx/sprites";
import { MONSTER_CAST } from "./gfx/cast";
import { t, tn } from "../i18n";
import { atlasName, atlasText, currencyBlurb, currencyName, mapLabel, mapModText, pinName, pinText, sigilName, tierName, zoneName } from "../i18n/names";

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
            return h("span", { class: `tag${done ? " done" : here ? " here" : ""}`, text: t(done ? "atlas.actCleared" : here ? "atlas.actHere" : "atlas.act", { n: a.id }) });
        }));
        return h("div", { class: "card col atlas-locked" }, h("h3", { text: t("atlas.lands") }),
            h("div", { class: "gate" }, pic, h("span", { class: "lock" }, glyph("block", 22))),
            h("div", { class: "story", text: t("atlas.story") }),
            h("div", { class: "row" }, h("span", { class: "sub", style: "margin:0", text: t("atlas.opensAfter") }), h("b", { text: t("atlas.gate", { zone: zoneName(gate.id), level: gate.level }) }),
                h("span", { class: "muted", text: t("atlas.heroLevel", { n: st.hero.level }) })),
            acts,
            h("div", { class: "sub", style: "margin:4px 0 0", text: t("atlas.then", { n: MAX_TIER }) }),
            tierChips([]),
            h("div", { class: "muted", text: st.maps.length ? tn("atlas.kept", st.maps.length) : t("atlas.dropLater") }));
    }
    const root = h("div", { class: "col" });

    // Controls.
    const onMaps = st.activity.mode === "map";
    const mode = h("button", { class: `toggle${onMaps ? " on" : ""}`, attrs: { role: "switch", "aria-checked": String(onMaps) }, on: { click: () => c.act(s => setMapMode(s, !onMaps)) } },
        h("i"), h("span", null, h("b", { text: t("atlas.runMaps") }), h("small", { text: t("atlas.runMapsNote") })));
    const tiers = [...new Set([...st.maps.map(m => m.tier), ...(st.activity.mapTier ? [st.activity.mapTier] : [])])].sort((a, b) => a - b);
    const tierSel = h("select");
    tierSel.append(h("option", { text: t("atlas.highest"), attrs: { value: "0" } }));
    for (const tier of tiers) tierSel.append(h("option", { text: t(st.maps.some(m => m.tier === tier) ? "atlas.andBelow" : "atlas.andBelowNone", { tier: tierName(tier) }), attrs: { value: String(tier) } }));
    tierSel.value = String(st.activity.mapTier);
    tierSel.addEventListener("change", () => c.act(s => setMapTier(s, +tierSel.value)));
    const deepest = Math.max(0, ...st.atlas.tiers);
    root.append(h("div", { class: "card col" },
        h("h3", { text: t("atlas.device") }),
        mode,
        h("div", { class: "row" }, t("atlas.order"), tierSel,
            h("span", { class: "tag", text: t("atlas.count", { n: st.maps.length, cap: st.mapCap }) }),
            h("span", { class: "tag", text: t("atlas.deepest", { tier: deepest ? tierName(deepest) : t("atlas.none") }) }),
            autoXpCap(st) ? h("span", { class: "tag", title: t("atlas.xpCapTip"), text: t("atlas.xpCap", { tier: tierName(autoXpCap(st)) }) }) : null,
            st.activity.autoCap ? h("span", { class: "tag ember", text: t("atlas.autoCap", { tier: tierName(st.activity.autoCap) }) }) : null),
        tierChips(st.atlas.tiers),
        h("div", { class: "muted", style: "font-size:12px", text: t("atlas.deathNote", { n: MAP_DEATH_XP * 100 }) })));

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
                m.mods.length ? h("div", { class: "muted", style: "font-size:12px;margin-top:2px", text: m.mods.map(id => mapModText(id)).join(" / ") }) : null)));
    }
    if (!maps.length) list.append(h("div", { class: "muted", text: t("atlas.noMaps") }));
    const sel = st.maps.find(m => m.uid === c.sel.uid);
    const bench = h("div", { class: "row", style: "gap:4px" });
    if (sel) {
        for (const id of MAP_CRAFTS) {
            const have = st.currency[id] ?? 0;
            bench.append(h("button", { class: "btn alt", text: t("common.count", { label: currencyName(id), n: have }), title: currencyBlurb(id), attrs: have ? {} : { disabled: "" },
                on: { click: () => c.act(s => craftMap(s, id, sel.uid)) } }));
        }
    }
    root.append(h("div", { class: "card col" }, h("h3", { text: t("atlas.maps") }), list,
        sel ? h("div", { class: "col" }, h("div", { class: "muted", text: t("atlas.craft", { map: mapLabel(sel) }) }), bench) : null));

    // Atlas tree.
    const left = atlasPointsLeft(st);
    const grid = h("div", { class: "grid2" });
    for (const n of Object.values(ATLAS)) {
        const own = st.atlas.nodes.includes(n.id);
        const err = own ? null : canTakeAtlas(st, n.id);
        const locked = !own && !!err && err !== "no atlas points";
        grid.append(h("div", { class: `skill${own ? " on" : ""}${locked ? " locked" : ""}`, on: { click: () => { if (!own && !err) c.act(s => takeAtlas(s, n.id)); } } },
            h("div", { class: "grow" }, h("div", { class: "nm", text: atlasName(n.id) }), h("div", { class: "ds", text: atlasText(n.id) }),
                n.requires.length ? h("div", { class: "ds muted", text: t("atlas.after", { list: n.requires.map(r => (ATLAS[r] ? atlasName(r) : r)).join(t("common.list")) }) }) : null),
            h("div", { class: "tag", text: own ? t("atlas.taken") : err ? (locked ? t("atlas.locked") : t("atlas.noPoints")) : t("atlas.take") })));
    }
    root.append(h("div", { class: "card col" }, h("h3", { text: tn("atlas.tree", left) }),
        h("div", { class: "muted", style: "font-size:12px", text: t("atlas.pointsNote", { n: MAX_TIER }) }), grid));

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
            h("div", { class: "grow" }, h("div", { class: "nm", text: pinName(p.id) }), h("div", { class: "ds", text: pinText(p.id) }),
                h("div", { class: "ds muted", text: t("atlas.pinInfo", { level: p.level, sigil: sigilName(p.id), tier: tierName(p.minTier), kills: st.pinnacleKills[p.id] ?? 0 }) }),
                scoutLine(c, p.id),
                h("div", { class: "row", style: "margin-top:6px;gap:6px" },
                    h("button", { class: "btn hot", text: queued ? t("atlas.nextRun") : t("atlas.challenge", { have, cost: p.cost }), attrs: have >= p.cost && !queued ? {} : { disabled: "" },
                        on: { click: () => c.act(s => queuePinnacle(s, p.id), t("atlas.isNext", { name: pinName(p.id) })) } }),
                    h("button", { class: "btn alt", text: t("atlas.scout"), title: t("atlas.scoutTip"),
                        on: { click: () => { scouted.set(scoutKey(st, p.id), scoutPinnacle(st, p.id, 5)); c.rerender(); } } })))));
    }
    root.append(h("div", { class: "card col" }, h("h3", { text: t("atlas.pinnacles") }), pins));
    return root;
}

/** Scout results, valid while the hero's sheet is unchanged. */
const scouted = new Map<string, Scout>();
const scoutKey = (st: GameState, id: string) => `${id}:${st.hero.rev}:${st.hero.level}`;

function scoutLine(c: Ctx, id: string): HTMLElement | null {
    const r = scouted.get(scoutKey(c.state, id));
    if (!r) return null;
    const odds = r.wins / Math.max(1, r.trials);
    const verdict = t(odds >= 0.8 ? "atlas.ready" : odds >= 0.4 ? "atlas.risky" : "atlas.notYet");
    return h("div", { class: `scout ${odds >= 0.8 ? "ok" : odds >= 0.4 ? "mid" : "bad"}`, text: t(r.wins ? "atlas.scoutedTime" : "atlas.scouted", { wins: r.wins, n: r.trials, s: r.seconds, verdict }) });
}

/** The tier ladder: one rung per tier, lit once cleared. */
function tierChips(done: number[]): HTMLElement {
    const row = h("div", { class: "ladder", attrs: { "aria-label": t("atlas.ladderAria", { n: done.length, max: MAX_TIER }) } });
    for (let k = 1; k <= MAX_TIER; k++) row.append(h("span", { class: `rung${done.includes(k) ? " done" : ""}`, title: done.includes(k) ? t("atlas.rungCleared", { tier: tierName(k) }) : tierName(k), text: String(k) }));
    return row;
}
