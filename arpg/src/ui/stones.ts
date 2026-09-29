// Ember stones on screen: a gem glyph in the stone's colour (brighter and
// glowing with the tier), an empty socket frame, and the effect line for a
// place.

import { STONES, parseStone, type StonePlace } from "../core/data";
import { placeOf } from "../core/items";
import type { Item } from "../core/types";
import { h } from "./dom";
import { glyph } from "./glyphs";
import { t } from "../i18n";
import { stoneEffectText, stoneFullName } from "../i18n/names";

/** A socketed stone (or an empty socket with null). */
export function stoneChip(key: string | null, size = 14): HTMLElement {
    const p = key ? parseStone(key) : null;
    if (!p) return h("span", { class: "stonechip empty", attrs: { "aria-label": t("item.socketEmpty") } }, glyph("socket", size));
    return h("span", { class: `stonechip t${p.tier}`, style: `color:${STONES[p.id]!.color}`, attrs: { "aria-label": stoneFullName(key!) } }, glyph("gem", size));
}

export const stoneValue = (key: string, place: StonePlace): number => { const p = parseStone(key); return p ? STONES[p.id]!.effects[place].values[p.tier]! : 0; };
export const stoneLine = (key: string, place: StonePlace): string => stoneEffectText(key, place, stoneValue(key, place));

/** The three things a stone can do, for a tooltip. */
export function stoneTip(key: string): string {
    return [stoneFullName(key), t("pouch.inWeapon", { e: stoneLine(key, "weapon") }), t("pouch.inArmour", { e: stoneLine(key, "armour") }), t("pouch.inJewel", { e: stoneLine(key, "jewel") })].join("\n");
}

/** Sockets on an item still waiting for a stone. */
export const emptySockets = (item: Item): number => Math.max(0, (item.sockets ?? 0) - (item.stones ?? []).filter(Boolean).length);

/** Socket pips for an item cell's corner: filled ones in their stone's colour. */
export function socketPips(item: Item): HTMLElement | null {
    if (!item.sockets) return null;
    const el = h("span", { class: "pips", attrs: { "aria-hidden": "true" } });
    for (let i = 0; i < item.sockets; i++) {
        const p = item.stones?.[i] ? parseStone(item.stones[i]!) : null;
        el.append(h("i", p ? { class: "full", style: `background:${STONES[p.id]!.color}` } : {}));
    }
    return el;
}

/** An item card's sockets: each stone with what it does in this item, or an empty frame. */
export function socketRows(item: Item): HTMLElement | null {
    if (!item.sockets) return null;
    const place = placeOf(item);
    const box = h("div", { class: "sockrows" });
    for (let i = 0; i < item.sockets; i++) {
        const k = item.stones?.[i] ?? null;
        box.append(h("div", { class: "aff sockrow" }, stoneChip(k, 12), h("span", { text: k ? `${stoneFullName(k)}: ${stoneLine(k, place)}` : t("item.socketEmpty") })));
    }
    return box;
}
