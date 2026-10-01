// Items on screen, shared by the Gear, Forge and Market tabs: item cells, the
// item card with its compare, hover and focus cards, drag state, and the worn
// and lock marks.

import { emptySockets, socketPips, socketRows } from "./stones";
import { AFFIXES, slotsFor } from "../core/data";
import type { AffixFate, CraftPreview } from "../core/crafting";
import type { Sheet } from "../core/character";
import { canEquip, trialSheet, buildScore } from "../core/game";
import { affixOf, baseOf, itemStats, levelReq, tierLabel, relicOf } from "../core/items";
import type { DamageType, Item, Slot } from "../core/types";
import { fmt, h } from "./dom";
import { itemIcon } from "./gfx/itemart";
import { glyph } from "./glyphs";
import { modText } from "./text";
import { t, tn } from "../i18n";
import { affixLine, affixTemplate, baseName, itemName, relicFlavour, relicLines } from "../i18n/names";
import { tErr } from "../i18n/errors";
import { SLOT_LABEL, TYPE_NAME, kv } from "./common";
import type { Ctx } from "./views";

export function itemCell(item: Item | undefined, slot: Slot | null, selected: boolean, onClick: () => void): HTMLElement {
    const cell = h("div", { class: `cell ${item ? item.rarity : "empty"}${selected ? " sel" : ""}`,
        attrs: { "aria-label": item ? itemName(item) : slot ? t("gear.slotEmpty", { slot: SLOT_LABEL(slot) }) : t("gear.empty"), ...(item || slot ? { role: "button", tabindex: "0" } : {}), ...(selected ? { "aria-pressed": "true" } : {}) }, on: { click: onClick } });
    if (item) cell.append(itemIcon(item));
    if (slot) { cell.dataset.slot = slot; cell.append(h("span", { class: "lbl", text: SLOT_LABEL(slot) })); }
    const pips = item ? socketPips(item) : null;
    if (pips) {
        cell.append(pips);
        cell.setAttribute("aria-label", t("gear.cellSockets", { label: cell.getAttribute("aria-label") ?? "", full: item!.sockets! - emptySockets(item!), n: item!.sockets! }));
    }
    return cell;
}

let tipEl: HTMLElement | null = null;

export function hideTip(): void { tipEl?.remove(); tipEl = null; }

/** A floating card next to `anchor`, inside the scrolling view; flips left when there's no room. */
function showTip(anchor: HTMLElement, content: HTMLElement): void {
    hideTip();
    const body = anchor.closest(".body") as HTMLElement | null;
    if (!body || !anchor.isConnected) return;
    tipEl = h("div", { class: "tip", attrs: { role: "tooltip" } }, content);
    body.append(tipEl);
    placeBeside(tipEl, anchor, body);
}

export function withTip(cell: HTMLElement, c: Ctx, make: () => HTMLElement): void {
    let t: number | null = null;
    const show = () => { c.hold = true; t = window.setTimeout(() => { if (!dnd.drag && !cell.classList.contains("sel")) showTip(cell, make()); }, 130); };
    const hide = () => { if (t !== null) clearTimeout(t); hideTip(); if (!dnd.drag) c.hold = false; };
    cell.addEventListener("mouseenter", show);
    cell.addEventListener("mouseleave", hide);
    // Keyboard players get the same card when a slot takes focus.
    cell.addEventListener("focus", () => { if (cell.matches(":focus-visible")) show(); });
    cell.addEventListener("blur", hide);
}

/** What is being dragged right now: a stash item (uid) or an equipped slot. */
export const dnd: { drag: { uid?: number; slot?: Slot } | null } = { drag: null };

/** A craft shown on the item card before it is done: what it is, and what it would do (or why it can't). */
export interface CardPreview { label: string; p: { err: string } | CraftPreview }

const FATE_TAG: Partial<Record<AffixFate, string>> = { reroll: "forge.pvReroll", replace: "forge.pvReplace", remove: "forge.pvRemove" };

/** The line under the name: the craft, then its outcome in words. */
function previewHead(pv: CardPreview): HTMLElement {
    const p = pv.p;
    if ("err" in p) return h("div", { class: "pvhead err", attrs: { role: "status" } }, h("b", { text: `${pv.label}:` }), h("span", { text: tErr(p.err) }));
    const parts: string[] = [];
    if (p.rarity) parts.push(t(`forge.pvTo.${p.rarity}`));
    if (p.add?.max) parts.push(p.add.max === p.add.min ? tn("forge.pvAddN", p.add.max) : tn("forge.pvAddRange", p.add.max, { min: p.add.min, max: p.add.max }));
    if (p.addAffix) parts.push(t("forge.pvAddChosen"));
    const changed = p.affixes.filter(f => f !== "keep").length;
    if (p.affixes.includes("replace")) parts.push(t("forge.pvReplaced"));
    if (p.affixes.includes("remove")) parts.push(tn("forge.pvRemoved", p.affixes.filter(f => f === "remove").length));
    if (p.affixes.includes("maybe")) parts.push(t("forge.pvMaybe", { n: p.affixes.length }));
    if (p.affixes.includes("reroll")) parts.push(tn("forge.pvRerolled", changed));
    if (p.quality !== undefined) parts.push(t("forge.pvQuality", { n: p.quality }));
    return h("div", { class: "pvhead", attrs: { role: "status" } }, h("b", { text: `${pv.label}:` }), h("span", { text: parts.join(t("common.list")) || t("forge.pvNothing") }));
}

export function itemCard(item: Item, c: Ctx | null, opts: { compareSlot?: Slot | null; preview?: CardPreview | null } = {}): HTMLElement {
    const b = baseOf(item);
    const st = itemStats(item);
    const pv = opts.preview ?? null;
    const pp = pv && !("err" in pv.p) ? pv.p : null;
    const card = h("div", { class: `card item${pv ? " pv" : ""}` }, h("div", { class: `name ${item.rarity}`, text: itemName(item) }));
    if (pv) card.append(previewHead(pv));
    const lines: string[] = [];
    if (item.rarity === "rare" || item.rarity === "relic") lines.push(baseName(b.id));
    card.append(h("div", { class: "muted", text: `${[...lines, b.kind === b.slot ? "" : t(`kind.${b.kind}`)].filter(Boolean).join(" - ")}  ${t("item.levels", { ilvl: item.ilvl, req: levelReq(item) })}` }));
    if (item.quality || item.locked || pp?.quality !== undefined) card.append(h("div", { class: "row", style: "gap:4px;margin-top:3px" },
        pp?.quality !== undefined ? h("span", { class: "tag q pvq", text: t("item.quality", { n: pp.quality }) })
            : item.quality ? h("span", { class: "tag q", text: t("item.quality", { n: item.quality }) }) : null,
        item.locked ? h("span", { class: "tag lk" }, glyph("lock", 9), " " + t("item.locked")) : null));
    if (st.weapon) {
        const w = st.weapon;
        const rows: [string, string][] = [[t("item.physical"), `${w.phys[0]}-${w.phys[1]}`]];
        for (const [d, r] of Object.entries(w.added)) rows.push([TYPE_NAME(d as DamageType), `${r![0]}-${r![1]}`]);
        rows.push([t("item.aps"), w.aps.toFixed(2)], [t("item.crit"), `${w.crit.toFixed(1)}%`], [t("item.hands"), String(w.hands)]);
        card.append(kv(rows));
    }
    if (st.defence) {
        const d = st.defence;
        const rows: [string, string][] = [];
        if (d.armour) rows.push([t("item.armour"), String(d.armour)]);
        if (d.evasion) rows.push([t("item.evasion"), String(d.evasion)]);
        if (d.energyShield) rows.push([t("item.es"), String(d.energyShield)]);
        if (d.block) rows.push([t("item.block"), `${d.block}%`]);
        card.append(kv(rows));
    }
    if (b.implicit?.length) {
        card.append(h("hr"));
        for (const m of b.implicit) card.append(h("div", { class: "aff", text: modText(m) }));
    }
    const adds = pp && (pp.add?.max || pp.addAffix);
    if (item.affixes.length || adds) {
        card.append(h("hr"));
        // Prefixes first; a preview marks each line with what the craft does to it.
        const sorted = item.affixes.map((a, i) => ({ a, fate: pp?.affixes[i] ?? "keep" }))
            .sort((x, z) => (affixOf(x.a).type === affixOf(z.a).type ? 0 : affixOf(x.a).type === "prefix" ? -1 : 1));
        for (const { a, fate } of sorted) {
            const tag = fate === "maybe" ? t("forge.pvChance", { n: Math.round(100 * (pp?.chance ?? 0)) }) : FATE_TAG[fate] ? t(FATE_TAG[fate]!) : "";
            card.append(h("div", { class: `aff${a.bench ? " bench" : ""}${fate !== "keep" ? ` pv-${fate}` : ""}`, title: a.bench ? t("item.benchTip") : "" }, affixLine(a),
                h("b", { text: `${a.bench ? t("item.bench") + " " : ""}${t(affixOf(a).type === "prefix" ? "item.prefix" : "item.suffix")} ${t("item.tier", { n: tierLabel(a) })}` }),
                tag ? h("span", { class: "pvt", text: tag }) : null));
        }
        if (pp?.add?.max) {
            const kind = pp.add.types.length === 2 ? t("forge.pvKindAny") : t(pp.add.types[0] === "prefix" ? "forge.pvKindPrefix" : "forge.pvKindSuffix");
            const n = pp.add.min === pp.add.max ? tn("forge.pvNewN", pp.add.max, { kind }) : tn("forge.pvNewRange", pp.add.max, { min: pp.add.min, max: pp.add.max, kind });
            card.append(h("div", { class: "aff pv-new" }, n));
        }
        if (pp?.addAffix && AFFIXES[pp.addAffix]) card.append(h("div", { class: "aff pv-new" }, t("forge.pvNewChosen", { text: affixTemplate(pp.addAffix) }),
            h("b", { text: t(AFFIXES[pp.addAffix]!.type === "prefix" ? "item.prefix" : "item.suffix") })));
    }
    const sockets = socketRows(item);
    if (sockets) card.append(h("hr"), sockets);
    const relic = relicOf(item);
    if (relic) {
        card.append(h("hr"));
        for (const l of relicLines(item)) card.append(h("div", { class: "aff", text: l }));
        card.append(h("div", { class: "muted", style: "font-style:italic;margin-top:4px", text: relicFlavour(relic.id) }));
    }
    if (c && opts.compareSlot !== undefined) {
        const slot = opts.compareSlot ?? slotsFor(b).find(s => !c.state.hero.equipment[s]) ?? slotsFor(b)[0]!;
        const trial = trialSheet(c.state, item, slot);
        if (trial) {
            card.append(h("hr"), compareRows(c.sheet(), trial));
        } else {
            card.append(h("hr"), h("div", { class: "down", text: tErr(canEquip(c.state, item, slot) ?? t("item.cantEquip")) }));
        }
    }
    return card;
}

function compareRows(now: Sheet, next: Sheet): HTMLElement {
    const rows: [string, number, number][] = [
        [t("cmp.dps"), now.skill.dps, next.skill.dps], [t("cmp.packDps"), now.skill.packDps, next.skill.packDps],
        [t("cmp.life"), now.life, next.life], [t("cmp.es"), now.es, next.es],
        [t("cmp.ehpPhys"), now.ehp.phys, next.ehp.phys],
        [t("cmp.ehpEle"), (now.ehp.fire + now.ehp.cold + now.ehp.lightning) / 3, (next.ehp.fire + next.ehp.cold + next.ehp.lightning) / 3],
    ];
    const el = h("div", { class: "kv" });
    for (const [k, a, b] of rows) {
        if (Math.abs(b - a) < 0.005 * Math.max(1, a)) continue;
        const d = b - a;
        el.append(h("div", { text: k }), h("div", { class: `num ${d > 0 ? "up" : "down"}`, text: `${d > 0 ? "+" : ""}${fmt(d)} (${a > 0 ? (d > 0 ? "+" : "") + ((d / a) * 100).toFixed(0) + "%" : t("cmp.new")})` }));
    }
    const sa = buildScore(now), sb = buildScore(next);
    el.append(h("div", { text: t("cmp.score") }), h("div", { class: `num ${sb >= sa ? "up" : "down"}`, text: `${sb >= sa ? "+" : ""}${sa > 0 ? (((sb - sa) / sa) * 100).toFixed(1) : "0"}%` }));
    return el;
}

/** A small lock in the cell's corner. */
export const lockBadge = () => h("span", { class: "lockb", attrs: { "aria-hidden": "true" } }, glyph("lock", 9));

/** Marks a cell as an item the hero is wearing: a gold frame and a "worn" tag (Gear lists, the codex, the Forge rack). */
export function markWorn(cell: HTMLElement, slot?: Slot): HTMLElement {
    cell.classList.add("wornc");
    cell.append(h("span", { class: "worn", text: t("gear.worn") }));
    const label = cell.getAttribute("aria-label") ?? "";
    cell.setAttribute("aria-label", slot ? t("gear.wornAriaSlot", { label, slot: SLOT_LABEL(slot).toLowerCase() }) : t("gear.wornAria", { label }));
    return cell;
}

/** A label across the whole item grid ("Worn", "Stash"). */
export const gridSep = (text: string) => h("div", { class: "gridsep", text });

/** Puts `el` (absolute, inside the scrolling `body`) beside `anchor`: right if it fits, else left, kept on screen. */
export function placeBeside(el: HTMLElement, anchor: HTMLElement, body: HTMLElement): void {
    const br = body.getBoundingClientRect(), ar = anchor.getBoundingClientRect();
    const w = el.offsetWidth, ht = el.offsetHeight;
    let x = ar.right - br.left + body.scrollLeft + 10;
    if (x + w > body.scrollLeft + body.clientWidth - 6) x = ar.left - br.left + body.scrollLeft - w - 10;
    x = Math.max(body.scrollLeft + 4, x);
    let y = ar.top - br.top + body.scrollTop - 6;
    y = Math.max(body.scrollTop + 4, Math.min(y, body.scrollTop + body.clientHeight - ht - 6));
    el.style.left = x + "px"; el.style.top = y + "px";
}
