// The Skills tab: the skill and its supports, each with what it would change.

import { MASTERY_BOSS, MASTERY_DAMAGE, MASTERY_MANA, MASTERY_MANA_AT, MASTERY_MAX, MASTERY_SPEED, SKILLS, SUPPORTS, masteryLevel, masteryNeed } from "../core/data";
import { deriveSheet, supportSlots, type Sheet } from "../core/character";
import { setSkill, setSupports } from "../core/game";
import { fmt, h, pct } from "./dom";
import { glyph } from "./glyphs";
import { t } from "../i18n";
import { skillBlurb, skillName, supportBlurb, supportName, tagName } from "../i18n/names";
import type { Ctx } from "./views";

const pctDelta = (a: number, b: number) => b / Math.max(0.01, a) - 1;

/** One EHP number for a sheet: the geometric mean over physical and the elements (as buildScore weighs it). */
const ehpOf = (s: Sheet) => Math.pow(s.ehp.phys * s.ehp.fire * s.ehp.cold * s.ehp.lightning, 0.25);

const fmtPct = (d: number) => `${d >= 0 ? "+" : ""}${(d * 100).toFixed(Math.abs(d) < 0.1 ? 1 : 0)}%`;

/** A skill's mastery: its level, and (on hover) what it gives and how far the next level is. */
function masteryTag(points: number): HTMLElement {
    const n = masteryLevel(points);
    const lines = [n > 0 ? t("skills.masteryNow", { n, max: MASTERY_MAX, dmg: fmt(MASTERY_DAMAGE * n) }) : ""];
    if (n < MASTERY_MAX) {
        const lo = masteryNeed(n), hi = masteryNeed(n + 1);
        lines.push(t("skills.masteryNext", { pct: Math.floor(((points - lo) / (hi - lo)) * 100), next: n + 1, boss: MASTERY_BOSS }));
    } else lines.push(t("skills.masteryTop"));
    lines.push(t("skills.masteryPerks", { at: MASTERY_MANA_AT, mana: MASTERY_MANA, max: MASTERY_MAX, speed: MASTERY_SPEED }));
    return h("span", { class: `tag mastery${n >= MASTERY_MAX ? " top" : n > 0 ? " on" : ""}`, text: t("skills.mastery", { n }), title: lines.filter(Boolean).join(" ") });
}

export function skillsView(c: Ctx): HTMLElement {
    const hero = c.state.hero;
    const cur = c.sheet();
    const colourOf = (tags: string[]) => tags.includes("spell") ? "#3a7bff" : tags.some(t => t === "projectile" || t === "bow") ? "#3fbf5f" : tags.some(t => t === "attack" || t === "melee") ? "#e5383b" : "#e6d9b8";
    const gem = (colour: string, big = false, size = big ? 36 : 26) => h("span", { class: `gem${big ? " big" : ""}`, style: `color:${colour}` }, glyph("gem", size), h("span", { class: "shine" }, glyph("gemshine", size)));
    // Main skill: every unlocked one shows the pack DPS it would have with the current gear and supports.
    const skills = h("div", { class: "list" });
    for (const s of Object.values(SKILLS)) {
        const locked = s.level > hero.level;
        const on = hero.skill === s.id;
        let meta: HTMLElement;
        if (locked) meta = h("span", { class: "tag", text: t("skills.levelTag", { n: s.level }) });
        else if (on) meta = h("span", { class: "tag", style: "background:#1a1410;color:var(--gold)", text: t("skills.dps", { dps: fmt(cur.skill.packDps) }) });
        else {
            const sh = deriveSheet({ ...hero, skill: s.id, rev: -1 });
            const d = pctDelta(cur.skill.packDps, sh.skill.packDps);
            meta = h("span", { class: "col", style: "gap:1px;align-items:flex-end" }, h("span", { class: "num", style: "font-weight:700", text: fmt(sh.skill.packDps) }),
                h("span", { class: `delta ${d >= 0 ? "up" : "down"}`, text: fmtPct(d) }));
        }
        skills.append(h("div", { class: `li${on ? " on" : ""}${locked ? " locked" : ""}`, attrs: { role: "button", tabindex: locked || on ? "-1" : "0" },
            title: locked ? t("skills.unlocksAt", { n: s.level }) : on ? t("skills.main") : t("skills.packTip"),
            on: { click: () => { if (!locked && !on) c.act(st => setSkill(st, s.id), t("skills.selected", { name: skillName(s.id) })); } } },
            h("div", { class: "nm" }, gem(colourOf(s.tags), false, 14), h("span", { text: skillName(s.id) })),
            h("div", { class: "meta" }, meta),
            h("div", { class: "ds", text: skillBlurb(s.id) }),
            h("div", { class: "tags" }, ...s.tags.map(x => h("span", { class: "tag", text: tagName(x) })), h("span", { class: "tag", text: t("skills.eff", { n: s.effectiveness }) }),
                locked ? null : masteryTag(c.state.mastery?.[s.id] ?? 0))));
    }

    // Supports: what adding, removing or swapping each one does, best first.
    const slots = supportSlots(hero.level);
    const active = hero.supports.slice(0, slots);
    const full = active.length >= slots;
    const trial = (ids: string[]) => deriveSheet({ ...hero, supports: ids, rev: -1 });
    // Supports with modifiers on the hero (Steadfast) are worth EHP as well as DPS.
    const curEhp = ehpOf(cur);
    type Row = { s: (typeof SUPPORTS)[string]; on: boolean; locked: boolean; fits: boolean; d: number | null; e: number | null; swap?: string };
    const rows: Row[] = Object.values(SUPPORTS).map(s => {
        const locked = s.level > hero.level;
        const on = active.includes(s.id);
        const fits = !s.requires.length || s.requires.some(t => cur.skill.tags.includes(t));
        let d: number | null = null, e: number | null = null, swap: string | undefined;
        const judge = (ids: string[]) => { const sh = trial(ids); return [pctDelta(cur.skill.packDps, sh.skill.packDps), pctDelta(curEhp, ehpOf(sh))] as const; };
        if (!locked && fits) {
            if (on) [d, e] = judge(active.filter(x => x !== s.id));
            else if (!full) [d, e] = judge([...active, s.id]);
            else for (const out of active) {
                // Slots full: the best single swap for this one (by DPS; a defensive support by EHP,
                // ties by DPS: most swaps leave EHP where it is).
                const [v, w] = judge(active.map(x => x === out ? s.id : x));
                const better = s.self ? w > e! + 1e-9 || (Math.abs(w - e!) <= 1e-9 && v > d!) : v > d!;
                if (d === null || better) { d = v; e = w; swap = out; }
            }
        }
        return { s, on, locked, fits, d, e: s.self ? e : null, swap };
    });
    const rank = (r: Row) => (r.on ? 0 : r.locked ? 3 : r.fits ? 1 : 2);
    rows.sort((a, b) => rank(a) - rank(b) || (a.on ? (a.d ?? 0) - (b.d ?? 0) : (b.d ?? -9) - (a.d ?? -9)) || a.s.level - b.s.level);
    const sups = h("div", { class: "list" });
    for (const r of rows) {
        const { s, on, locked, fits, d, e, swap } = r;
        let meta: HTMLElement, tip: string;
        const needs = s.requires.map(x => tagName(x)).join(t("common.or"));
        if (locked) { meta = h("span", { class: "tag", text: t("skills.levelTag", { n: s.level }) }); tip = t("skills.unlocksAt", { n: s.level }); }
        else if (!fits) { meta = h("span", { class: "tag", text: t("skills.noFit") }); tip = t("skills.needs", { tags: needs }); }
        else if (on) {
            meta = h("span", { class: "col", style: "gap:1px;align-items:flex-end" }, h("span", { class: "tag", text: t("skills.slotted") }),
                e !== null ? h("span", { class: `delta ${e <= 0 ? "up" : "down"}`, text: t("skills.worthEhp", { pct: fmtPct(-e) }) }) : null,
                h("span", { class: `delta ${(d ?? 0) <= 0 ? "up" : "down"}`, text: t("skills.worth", { pct: fmtPct(-(d ?? 0)) }) }));
            tip = e !== null ? t("skills.clickRemoveEhp", { pct: fmtPct(d ?? 0), ehp: fmtPct(e) }) : t("skills.clickRemove", { pct: fmtPct(d ?? 0) });
        } else {
            const good = (d ?? 0) > 0;
            const swapName = swap && SUPPORTS[swap] ? supportName(swap) : swap ?? "";
            meta = h("span", { class: "col", style: "gap:1px;align-items:flex-end" },
                e !== null ? h("span", { class: `delta ${e >= 0 ? "up" : "down"}`, text: t("skills.ehp", { pct: fmtPct(e) }) }) : null,
                h("span", { class: `delta ${good ? "up" : "down"}`, text: e !== null ? t("skills.dpsPct", { pct: fmtPct(d ?? 0) }) : fmtPct(d ?? 0) }),
                swap ? h("span", { class: "muted", style: "font-size:8px", text: t("skills.for", { name: swapName }) }) : null);
            tip = e !== null
                ? (swap ? t("skills.clickSwapEhp", { name: swapName, pct: fmtPct(d ?? 0), ehp: fmtPct(e) }) : t("skills.clickAddEhp", { pct: fmtPct(d ?? 0), ehp: fmtPct(e) }))
                : (swap ? t("skills.clickSwap", { name: swapName, pct: fmtPct(d ?? 0) }) : t("skills.clickAdd", { pct: fmtPct(d ?? 0) }));
        }
        sups.append(h("div", { class: `li${on ? " on" : ""}${locked || !fits ? " locked" : ""}`, attrs: { role: "button", tabindex: locked || !fits ? "-1" : "0" }, title: tip, on: { click: () => {
            if (locked || !fits) return;
            if (on) c.act(st => setSupports(st, active.filter(x => x !== s.id)), t("skills.removed", { name: supportName(s.id) }));
            else if (!full) c.act(st => setSupports(st, [...active, s.id]), t("skills.added", { name: supportName(s.id) }));
            else if (swap) c.act(st => setSupports(st, active.map(x => x === swap ? s.id : x)), t("skills.swapped", { out: supportName(swap), name: supportName(s.id) }));
        } } },
            h("div", { class: "nm" }, gem(colourOf(s.requires), false, 14), h("span", { text: supportName(s.id) })), h("div", { class: "meta" }, meta),
            h("div", { class: "ds", text: supportBlurb(s.id) + (s.requires.length ? "  " + t("skills.needsShort", { tags: needs }) : "") })));
    }
    const next = [1, 1, 8, 18, 32].find(l => l > hero.level);

    // Skill links: the main gem chained to its support sockets, like a socketed item.
    const main = SKILLS[hero.skill];
    const links = h("div", { class: "links" },
        h("div", { class: "sock main", title: main ? skillBlurb(main.id) : "" }, gem(colourOf(cur.skill.tags), true), h("b", { text: main ? skillName(main.id) : hero.skill })));
    [1, 1, 8, 18, 32].forEach((lvl, i) => {
        links.append(h("span", { class: `link${i < slots ? "" : " off"}`, attrs: { "aria-hidden": "true" } }));
        const id = active[i];
        const sup = id ? SUPPORTS[id] : undefined;
        if (sup) {
            const row = rows.find(r => r.s.id === id);
            links.append(h("button", { class: "sock", title: t("skills.sockTip", { name: supportName(sup.id), blurb: supportBlurb(sup.id) }) + (row?.d != null ? " " + t("skills.sockWorth", { pct: fmtPct(-(row.d)) }) : ""),
                on: { click: () => c.act(st => setSupports(st, active.filter(x => x !== id)), t("skills.removed", { name: supportName(sup.id) })) } },
                gem(colourOf(sup.requires)), h("b", { text: supportName(sup.id) })));
        } else if (i < slots) {
            links.append(h("div", { class: "sock empty", title: t("skills.emptyTip") }, h("span", { class: "hole" }, glyph("socket", 26)), h("b", { text: t("skills.empty") })));
        } else {
            links.append(h("div", { class: "sock locked", title: t("skills.opensAt", { n: lvl }) }, h("span", { class: "hole" }, glyph("socket", 26)), h("b", { text: t("common.level", { n: lvl }) })));
        }
    });
    const bar = h("div", { class: "card socketbar" }, h("h3", { text: t("skills.links") }), links);
    // A label whose word doesn't fit its socket whole (long Russian and Ukrainian names) drops to the small size.
    requestAnimationFrame(() => { for (const b of links.querySelectorAll<HTMLElement>(".sock b")) if (b.scrollWidth > b.clientWidth + 1) b.classList.add("long"); });
    return h("div", { class: "col", style: "gap:14px" }, bar, h("div", { class: "grid2" },
        h("div", null, h("div", { class: "sec", text: t("skills.mainSkill") }), skills),
        h("div", null, h("div", { class: "sec" }, t("skills.supports") + " ", h("span", { class: "num", text: `${active.length}/${slots}` }),
            next ? h("span", { class: "muted", text: t("skills.nextSlot", { n: next }) }) : null), sups)));
}
