// The World tab: auto-push, Hollow Night, the contract board, the ember shrine
// and the roads of the acts.

import { ACTS, CURRENCIES, ZONES } from "../core/data";
import { HOLLOW_PET, HOLLOW_RELIC, hollowNight, hollowNightsLeft, lanternsSnuffed } from "../core/season";
import { endgameOpen } from "../core/maps";
import { setZone } from "../core/game";
import type { GameState } from "../core/state";
import { fmt, fmtDuration, h } from "./dom";
import { spriteCanvas } from "./gfx/sprites";
import { HERO_CAST } from "./gfx/cast";
import { glyph } from "./glyphs";
import { scenery } from "./gfx/portrait";
import { claimContract, contractDust, rerollContract, rerollCost, type Contract } from "../core/contracts";
import { BLESSINGS, ORB_RESERVE, bless, blessingCost, setKeep, spareOrbValue } from "../core/shrine";
import { t, tn } from "../i18n";
import { actIntro, actName, actOutro, blessingName, blessingText, className, companionName, contractGoal, currencyName, relicName, zoneName, zoneStory } from "../i18n/names";
import { kv } from "./common";
import type { Ctx } from "./views";

/** Cleared acts the player opened again this session (the rest stay folded). */
const openActs = new Set<number>();

export function worldView(c: Ctx): HTMLElement {
    const st = c.state;
    const root = h("div", { class: "col", style: "gap:14px" });
    const inMaps = st.activity.mode === "map";
    const push = h("button", { class: `toggle${st.activity.autoPush ? " on" : ""}`, attrs: { role: "switch", "aria-checked": String(st.activity.autoPush) },
        on: { click: () => c.act(s => { s.activity.autoPush = !s.activity.autoPush; }) } },
        h("i"), h("span", null, h("b", { text: t("world.autoPush") }), h("small", { text: t("world.autoPushNote") })));
    root.append(push);
    if (hollowNight(st)) root.append(hollowCard(c));
    root.append(contractBoard(c), shrineCard(c));
    if (inMaps) root.append(h("div", { class: "note" }, glyph("atlas", 16), h("span", { text: t("world.inMaps") })));
    const hc = HERO_CAST[st.hero.cls];
    for (const act of ACTS) {
        if (!act.zones.some(z => st.world.unlocked.includes(z))) continue;
        const done = !!st.world.clears[act.zones[act.zones.length - 1]!];
        const current = !inMaps && (act.zones.includes(st.activity.zone) || act.trial === st.activity.zone);
        // A finished act folds to one line unless the hero is in it or the player opened it.
        if (done && !current && !openActs.has(act.id)) {
            const total = act.zones.reduce((a, z) => a + (st.world.clears[z] ?? 0), 0);
            root.append(h("div", { class: "card act folded" },
                h("h3", { text: t("world.act", { n: act.id, name: actName(act.id) }) }),
                h("div", { class: "row" }, h("span", { class: "tag done", text: t("world.cleared") }), h("span", { class: "muted grow", text: t("world.folded", { places: act.zones.length, clears: fmt(total) }) }),
                    h("button", { class: "btn alt small", text: t("world.openRoad"), on: { click: () => { openActs.add(act.id); c.rerender(); } } }))));
            continue;
        }
        const road = h("div", { class: "road" });
        const stop = (id: string, n: string) => {
            const z = ZONES[id]!;
            const open = st.world.unlocked.includes(id);
            const here = st.activity.mode === "zone" && st.activity.zone === id;
            const clears = st.world.clears[id] ?? 0;
            const thumb = scenery(z, 112, 62);
            thumb.className = "thumb";
            const name = zoneName(id);
            const el = h("button", { class: `stop${here ? " here" : ""}${open ? "" : " locked"}${z.trial ? " trial" : ""}${z.boss ? " boss" : ""}`,
                attrs: { "aria-label": open ? t("world.stopAria", { name, level: z.level, clears }) : t("world.stopAriaLocked", { name, level: z.level }) },
                title: open ? (z.story ? zoneStory(id) : name) : t("world.notReached"),
                on: { click: () => { if (open && !here) c.act(s => setZone(s, id), t("world.travelling", { zone: name })); } } },
                h("div", { class: "pic" }, thumb,
                    h("span", { class: "num-badge", text: n }),
                    z.boss ? h("span", { class: "flag boss", text: t("world.boss") }) : z.trial ? h("span", { class: "flag trial", text: t("world.trial") }) : null,
                    here && hc ? (() => { const a = spriteCanvas(hc.idle); if (a) a.className = "hero-mark"; return a; })() : null,
                    open ? null : h("span", { class: "lock" }, glyph("block", 18))),
                h("b", { text: name }),
                h("span", { class: "meta" }, h("span", { class: "tag", text: t("world.lvl", { n: z.level }) }), h("span", { text: open ? tn("world.clears", clears) : t("world.locked") })));
            return el;
        };
        act.zones.forEach((id, i) => {
            if (i) road.append(h("span", { class: `path${st.world.unlocked.includes(id) ? "" : " dim"}`, attrs: { "aria-hidden": "true" } }));
            road.append(stop(id, String(i + 1)));
        });
        const trial = h("div", { class: "trialrow" }, h("span", { class: "sub", text: t("world.offRoad") }), stop(act.trial, "T"));
        root.append(h("div", { class: "card act" },
            h("h3", { text: t("world.act", { n: act.id, name: actName(act.id) }) }),
            h("div", { class: "story muted", text: done ? actOutro(act.id) : actIntro(act.id) }),
            road, trial,
            done && !current ? h("div", { class: "row", style: "justify-content:flex-end;margin-top:8px" },
                h("button", { class: "btn alt small", text: t("world.foldRoad"), on: { click: () => { openActs.delete(act.id); c.rerender(); } } })) : null));
    }
    // Opening the tab lands on the hero's stop, not the top of Act 1.
    requestAnimationFrame(() => {
        const here = root.querySelector<HTMLElement>(".stop.here");
        const body = root.closest(".body") as HTMLElement | null;
        if (here && body && body.scrollTop === 0) {
            const top = here.getBoundingClientRect().top - body.getBoundingClientRect().top;
            if (top > body.clientHeight - 60) body.scrollTop = top - 80;
        }
    });
    return root;
}

const CONTRACT_GLYPH: Record<Contract["kind"], Parameters<typeof glyph>[0]> = { kills: "skills", champions: "chaos", bosses: "atlas", runs: "world", maps: "atlas", rares: "gem", lanterns: "pumpkin" };

/** The Hollow Night card changes with the lanterns snuffed and its two finds (empty outside October). */
export const hollowSig = (s: GameState) => (hollowNight(s) ? `${lanternsSnuffed(s)}:${hollowNightsLeft(s)}:${!!s.codex[HOLLOW_RELIC]}:${s.companions[HOLLOW_PET] !== undefined}` : "");

/** Hollow Night (October): what it is, the nights left, lanterns snuffed and its two finds. */
function hollowCard(c: Ctx): HTMLElement {
    const st = c.state;
    const find = (name: string, found: boolean) => h("div", { class: "row", style: "gap:8px" },
        h("span", { class: `tag${found ? " done" : ""}`, text: found ? t("hollow.found") : t("hollow.notYet") }), h("span", { text: name }));
    return h("div", { class: "card hollow" },
        h("h3", { class: "split" }, h("span", { class: "row", style: "gap:6px" }, glyph("pumpkin", 16), h("span", { text: t("hollow.title") })),
            h("span", { class: "num", text: tn("hollow.nights", hollowNightsLeft(st)) })),
        h("div", { class: "muted", style: "font-size:12px;margin-bottom:8px", text: t("hollow.blurb") }),
        kv([[t("hollow.snuffed"), fmt(lanternsSnuffed(st))]]),
        h("div", { class: "col", style: "gap:4px;margin-top:6px" },
            find(relicName(HOLLOW_RELIC), !!st.codex[HOLLOW_RELIC]),
            find(companionName(HOLLOW_PET), st.companions[HOLLOW_PET] !== undefined)),
        endgameOpen(st) ? h("div", { class: "muted", style: "font-size:12px;margin-top:8px", text: t("hollow.litMaps") }) : null);
}

/** Three standing goals: progress, reward, Claim when done, Reroll for dust otherwise. */
function contractBoard(c: Ctx): HTMLElement {
    const st = c.state;
    const cost = rerollCost(st);
    const rows = h("div", { class: "contracts" });
    st.contracts.list.forEach((k, i) => {
        const done = k.n >= k.target;
        rows.append(h("div", { class: `contract${done ? " done" : ""}` },
            h("span", { class: "cg" }, glyph(CONTRACT_GLYPH[k.kind], 16)),
            h("div", { class: "grow col", style: "gap:3px;min-width:0" },
                h("b", { text: contractGoal(k.kind, k.target, k.tier) }),
                h("div", { class: "meter" }, h("i", { style: `width:${Math.min(100, (k.n / k.target) * 100).toFixed(1)}%` }), h("span", { class: "num", text: `${fmt(k.n)} / ${fmt(k.target)}` })),
                h("span", { class: "muted", style: "font-size:12px", text: t("contracts.reward", { text: rewardLine(k, st) }) })),
            done ? h("button", { class: "btn small", text: t("contracts.claim"), on: { click: () => c.act(s => claimContract(s, i), t("contracts.claimed")) } })
                : h("button", { class: "btn alt small", text: t("contracts.reroll", { cost: fmt(cost) }), title: t("contracts.rerollTip", { cost: fmt(cost) }), attrs: st.dust >= cost ? {} : { disabled: "" },
                    on: { click: () => c.act(s => rerollContract(s, i)) } })));
    });
    return h("div", { class: "card" }, h("h3", { class: "split" }, h("span", { text: t("contracts.title") }), h("span", { class: "num", text: t("contracts.done", { n: fmt(st.contracts.done) }) })), rows);
}

/** What a contract pays, in words: "300 dust, 3 Kindling, a relic not in your codex". */
function rewardLine(k: Contract, s: GameState): string {
    const parts = [t("reward.dust", { n: contractDust(s, k) })];
    if (k.currency && CURRENCIES[k.currency[0]]) parts.push(t("reward.currency", { n: k.currency[1], name: currencyName(k.currency[0]) }));
    if (k.extra) parts.push(t(`reward.${k.extra}`));
    return parts.join(t("common.list"));
}

/** Minutes left on each blessing, what can be paid, the switches: the shrine card is rebuilt when these change. */
export function shrineSig(s: GameState): string {
    const cost = blessingCost(s);
    return `${BLESSINGS.map(b => Math.ceil(Math.max(0, (s.blessings[b.id] ?? 0) - s.simTo) / 60e3)).join(",")}:${s.dust >= cost}:${spareOrbValue(s) + s.dust >= cost}:${s.shrine.keep.join(",")}:${s.shrine.orbs}`;
}

const BLESS_GLYPH: Record<string, Parameters<typeof glyph>[0]> = { insight: "regen", fortune: "gem", plenty: "gear", hoard: "forge" };

/** The ember shrine: an hour of a blessing per offering, kept up on its own if asked; spare orbs can pay. */
function shrineCard(c: Ctx): HTMLElement {
    const st = c.state;
    const cost = blessingCost(st);
    const spare = spareOrbValue(st);
    const canPay = st.dust + (st.shrine.orbs ? spare : 0) >= cost;
    const rows = h("div", { class: "contracts" });
    for (const b of BLESSINGS) {
        const left = Math.max(0, (st.blessings[b.id] ?? 0) - st.simTo);
        const keep = st.shrine.keep.includes(b.id);
        rows.append(h("div", { class: `contract bless${left ? " done" : ""}` },
            h("span", { class: "cg" }, glyph(BLESS_GLYPH[b.id] ?? "gem", 16)),
            h("div", { class: "grow col", style: "gap:2px;min-width:0" },
                h("b", { text: t("shrine.line", { name: blessingName(b.id), text: blessingText(b.id, b.value) }) }),
                h("span", { class: "muted", style: "font-size:12px", text: left ? t(keep ? "shrine.leftKept" : "shrine.left", { time: fmtDuration(left) }) : keep ? t("shrine.keptUp") : t("shrine.notRunning") })),
            h("button", { class: `chip${keep ? " on" : ""}`, attrs: { role: "switch", "aria-checked": String(keep) }, title: t("shrine.keepTip"),
                on: { click: () => c.act(s => { setKeep(s, b.id, !keep); if (!keep && !left) return bless(s, b.id); }) } }, t("shrine.keep")),
            h("button", { class: "btn small", text: t("shrine.hour"), title: t(st.shrine.orbs ? "shrine.hourTipOrbs" : "shrine.hourTip", { name: blessingName(b.id), cost: fmt(cost) }), attrs: canPay ? {} : { disabled: "" },
                on: { click: () => c.act(s => bless(s, b.id), t("shrine.blessed", { name: blessingName(b.id) })) } })));
    }
    const orbs = h("button", { class: `toggle${st.shrine.orbs ? " on" : ""}`, attrs: { role: "switch", "aria-checked": String(st.shrine.orbs) },
        on: { click: () => c.act(s => { s.shrine.orbs = !s.shrine.orbs; }) } },
        h("i"), h("span", null, h("b", { text: t("shrine.orbs") }), h("small", { text: t("shrine.orbsNote", { n: ORB_RESERVE, v: fmt(spare) }) })));
    return h("div", { class: "card" }, h("h3", { class: "split" }, h("span", { text: t("shrine.title") }), h("span", { class: "num", text: t("shrine.cost", { cost: fmt(cost) }) })),
        h("div", { class: "muted", style: "font-size:12px;margin-bottom:8px", text: t("shrine.note") }), rows, h("div", { style: "margin-top:8px" }, orbs));
}
