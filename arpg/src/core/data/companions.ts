// Companions: small creatures of the March that follow the hero. One walks
// at the hero's side; it gives one bonus that grows with its level. Levels
// come from bond: every kill while it is out adds one, a duplicate adds a lot.

import type { Mod } from "../types";

export interface CompanionDef {
    id: string;
    name: string;
    blurb: string;
    /** One modifier, `per` for every companion level. */
    bonus: { stat: Mod["stat"]; kind: Mod["kind"]; per: number; tags?: string[]; text: string };
    /** Battle art: an atlas sprite, tinted, lifted off the ground for fliers. */
    sprite: string;
    tint?: string;
    strength?: number;
    hover?: number;
    fps?: number;
    /** Battle size: 0.5 draws a baby version of a monster sprite (every other pixel, still crisp). */
    scale?: number;
    /** Where it is found (for the collection's hints). */
    where: string;
    /** Monster level it can drop from (bosses and map bosses). */
    level: number;
    /** Found only during this seasonal event (season.ts), never from bosses or contracts otherwise. */
    season?: string;
    /** Drawn over the sprite (battle, collection): a jack-o'-lantern face. */
    overlay?: "pumpkin";
}

export const COMPANION_MAX_LEVEL = 20;
/** Bond needed to reach `level` (level 1 needs none). */
export const bondFor = (level: number) => 120 * (level - 1) * (level - 1) + 180 * (level - 1);
/** Bond a duplicate adds. */
export const DUPLICATE_BOND = 4000;

export function companionLevel(bond: number): number {
    let l = 1;
    while (l < COMPANION_MAX_LEVEL && bond >= bondFor(l + 1)) l++;
    return l;
}

const list: CompanionDef[] = [
    { id: "saltcrab", name: "Salt Crab", blurb: "It found you on the shore and decided you were its rock.", where: "Act 1: the Tide-Warden", level: 1,
        bonus: { stat: "armour", kind: "inc", per: 2, text: "{0}% increased armour" }, sprite: "mon.spider", tint: "#e0703a", strength: 0.5, fps: 9 },
    { id: "bogimp", name: "Bog Imp", blurb: "Steals shiny things. Mostly for you.", where: "Bosses from level 10", level: 10,
        bonus: { stat: "itemQuantity", kind: "inc", per: 0.5, text: "{0}% increased quantity of items found" }, sprite: "mon.flyer", hover: 8, fps: 10, scale: 0.5 },
    { id: "lanternwisp", name: "Lantern Wisp", blurb: "A flame that forgot which lamp it belonged to.", where: "Bosses from level 14", level: 14,
        bonus: { stat: "itemRarity", kind: "inc", per: 1.5, text: "{0}% increased rarity of items found" }, sprite: "fx.orb", tint: "#ffd84a", strength: 0.35, hover: 14, fps: 10 },
    { id: "dunepup", name: "Dune Pup", blurb: "Runs ahead, runs back, runs ahead again.", where: "Act 2: the Glass Regent", level: 20,
        bonus: { stat: "moveSpeed", kind: "inc", per: 1, text: "{0}% increased movement speed" }, sprite: "mon.wolf", tint: "#e0bf7f", strength: 0.35, fps: 11, scale: 0.5 },
    { id: "prismlynx", name: "Prism Lynx", blurb: "It watches the weak spot until you see it too.", where: "Bosses from level 24", level: 24,
        bonus: { stat: "critChance", kind: "inc", per: 2, text: "{0}% increased critical chance" }, sprite: "mon.gato", tint: "#9fe3ff", strength: 0.45, fps: 8, scale: 0.5 },
    { id: "drowned", name: "Little Drowned", blurb: "It does not breathe. It does keep you breathing.", where: "Bosses from level 30", level: 30,
        bonus: { stat: "life", kind: "inc", per: 0.5, text: "{0}% increased maximum life" }, sprite: "mon.thing", tint: "#5fb3a6", strength: 0.3, fps: 6, scale: 0.5 },
    { id: "ashpup", name: "Ash Pup", blurb: "Born in the Sunfall. Still warm.", where: "Act 3: the Last Dawn", level: 40,
        bonus: { stat: "attackSpeed", kind: "inc", per: 0.5, text: "{0}% increased attack speed" }, sprite: "mon.hound", fps: 12, scale: 0.5 },
    { id: "cinderskull", name: "Cinder Skull", blurb: "A head that kept burning after the rest of it stopped.", where: "Bosses from level 45", level: 45,
        bonus: { stat: "castSpeed", kind: "inc", per: 0.5, text: "{0}% increased cast speed" }, sprite: "mon.skull", hover: 10, fps: 10, scale: 0.5 },
    { id: "whisperskull", name: "Whispering Skull", blurb: "It tells you what the dead learned. Some of it is useful.", where: "Map bosses", level: 50,
        bonus: { stat: "xpGain", kind: "inc", per: 0.5, text: "{0}% increased experience gained" }, sprite: "mon.skull2", tint: "#b9a4ff", strength: 0.4, hover: 8, fps: 8, scale: 0.5 },
    { id: "pumpkinwisp", name: "Pumpkin Wisp", blurb: "A lantern that would not be snuffed. It grins at whatever you are fighting.", where: "Hollow Night (October): lantern-touched monsters", level: 1, season: "hollownight",
        bonus: { stat: "damage", kind: "inc", per: 0.5, text: "{0}% increased damage" }, sprite: "fx.orb", tint: "#ff7a1a", strength: 0.6, hover: 12, fps: 10, overlay: "pumpkin" },
];

export const COMPANIONS: Record<string, CompanionDef> = Object.fromEntries(list.map(c => [c.id, c]));
export const COMPANION_ORDER = list.map(c => c.id);
/** The companion each act boss gives on its first clear. */
export const ACT_COMPANION: Record<number, string> = { 1: "saltcrab", 2: "dunepup", 3: "ashpup" };

/** The bonus at a level, as a modifier (rounded to one decimal). */
export function companionMod(id: string, level: number): Mod | null {
    const c = COMPANIONS[id];
    if (!c) return null;
    const mod: Mod = { stat: c.bonus.stat, kind: c.bonus.kind, value: Math.round(c.bonus.per * level * 10) / 10, src: `Companion: ${c.name}` };
    if (c.bonus.tags) mod.tags = c.bonus.tags;
    return mod;
}

export const companionText = (id: string, level: number) => {
    const m = companionMod(id, level);
    return m ? COMPANIONS[id]!.bonus.text.replace("{0}", String(m.value)) : "";
};
