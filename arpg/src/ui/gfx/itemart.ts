// Item art: each base kind maps to a family of Dungeon Crawl icons (CC0) in
// the atlas, climbing with the item's tier (a knife before a quickblade).
// Kinds without art (belts, quivers) keep the hand-drawn 12px icons.

import { TIER_LEVELS } from "../../core/data";
import { baseOf } from "../../core/items";
import type { Item } from "../../core/types";
import { iconFor } from "../icons";
import { spriteCanvas, spriteOf } from "./sprites";

/** Atlas name of an item's icon, or null if its kind has none. */
export function iconName(item: Item): string | null {
    const b = baseOf(item);
    const family = b.slot === "helmet" || b.slot === "body" ? `${b.slot}.${b.kind}` : b.slot === "gloves" || b.slot === "boots" || b.slot === "amulet" || b.slot === "ring" ? b.slot : b.kind;
    let tier = 0;
    for (let i = 0; i < TIER_LEVELS.length; i++) if (b.level >= TIER_LEVELS[i]!) tier = i;
    for (let v = Math.floor(tier / 2); v >= 0; v--) if (spriteOf(`ico.${family}.${v}`)) return `ico.${family}.${v}`;
    return null;
}

/** A canvas with the item's icon: atlas art at 1x (class "ic"), or the drawn fallback. */
export function itemIcon(item: Item): HTMLCanvasElement {
    const name = iconName(item);
    const c = name ? spriteCanvas(name) : null;
    if (c) { c.classList.add("ic"); return c; }
    const b = baseOf(item);
    return iconFor(b.kind, b.slot);
}
