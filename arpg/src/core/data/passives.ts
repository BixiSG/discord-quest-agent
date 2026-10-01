// The passive tree. One shared tree, generated from a compact spec so the
// layout stays consistent: three class starts on a circle, each with three
// themed branches outwards, a path inwards to a shared ring, and a bridge with
// a keystone between each pair of neighbouring classes. Pure math, no RNG.

import type { Mod } from "../types";

export type NodeKind = "start" | "small" | "notable" | "keystone" | "ring";

export interface PassiveNode {
    id: string;
    name: string;
    kind: NodeKind;
    x: number;
    y: number;
    mods: Mod[];
    links: string[];
    /** Start nodes: the class that starts here. */
    cls?: string;
}

const m = (stat: Mod["stat"], kind: Mod["kind"], value: number, tags?: string[]): Mod => (tags ? { stat, kind, value, tags } : { stat, kind, value });

interface Theme {
    name: string;
    small: [string, Mod[]][];
    notables: [string, Mod[]][];
    /** The branch's far end (round 8): a stronger notable past three more small nodes. */
    mastery: [string, Mod[]];
}

interface ClassSpec { cls: string; angle: number; branches: [Theme, Theme, Theme] }

const THEMES = {
    iron: { name: "Iron", small: [["Iron Skin", [m("armour", "inc", 12)]], ["Thick Blood", [m("life", "inc", 5)]]],
        notables: [["Bulwark Oath", [m("armour", "inc", 30), m("life", "inc", 8), m("block", "flat", 3)]], ["Unbroken", [m("life", "inc", 12), m("lifeRegenPct", "flat", 1)]]],
        mastery: ["Mountain's Root", [m("armour", "inc", 45), m("life", "inc", 10), m("dmgTaken", "more", -3)]] },
    blade: { name: "Blade", small: [["Honed Edge", [m("damage", "inc", 10, ["melee"])]], ["Quick Hands", [m("attackSpeed", "inc", 4)]]],
        notables: [["Butcher's Rhythm", [m("damage", "inc", 25, ["melee"]), m("attackSpeed", "inc", 8)]], ["Split Bone", [m("damage", "inc", 30, ["phys"]), m("critMulti", "flat", 15)]]],
        mastery: ["Thousand Cuts", [m("damage", "inc", 35, ["melee"]), m("attackSpeed", "inc", 10)]] },
    ember: { name: "Ember", small: [["Kindle", [m("damage", "inc", 12, ["fire"])]], ["Hearth Ward", [m("res.fire", "flat", 8)]]],
        notables: [["Pyre Heart", [m("damage", "inc", 30, ["fire"]), m("pen.fire", "flat", 8)]], ["Cinder Skin", [m("res.fire", "flat", 20), m("maxRes.fire", "flat", 3), m("life", "inc", 6)]]],
        mastery: ["Living Flame", [m("damage", "inc", 40, ["fire"]), m("pen.fire", "flat", 10)]] },
    wind: { name: "Wind", small: [["Light Step", [m("evasion", "inc", 12)]], ["Fleet", [m("moveSpeed", "inc", 3)]]],
        notables: [["Gale Dancer", [m("evasion", "inc", 35), m("moveSpeed", "inc", 6)]], ["Afterimage", [m("evasion", "inc", 25), m("block", "flat", 4), m("life", "inc", 6)]]],
        mastery: ["Windwalker", [m("evasion", "inc", 45), m("life", "inc", 8), m("dmgTaken", "more", -3)]] },
    arrow: { name: "Arrow", small: [["Fletching", [m("damage", "inc", 10, ["projectile"])]], ["Keen Sight", [m("critChance", "inc", 12)]]],
        notables: [["Deadeye", [m("critChance", "inc", 40), m("critMulti", "flat", 20)]], ["Barbed Volley", [m("damage", "inc", 25, ["projectile"]), m("pierce", "flat", 1)]]],
        mastery: ["Heartstring", [m("damage", "inc", 35, ["projectile"]), m("critMulti", "flat", 20)]] },
    storm: { name: "Storm", small: [["Static", [m("damage", "inc", 12, ["lightning"])]], ["Grounding", [m("res.lightning", "flat", 8)]]],
        notables: [["Thunderhead", [m("damage", "inc", 30, ["lightning"]), m("pen.lightning", "flat", 8)]], ["Rod of the Squall", [m("res.lightning", "flat", 20), m("maxRes.lightning", "flat", 3), m("attackSpeed", "inc", 5)]]],
        mastery: ["Thunderborn", [m("damage", "inc", 40, ["lightning"]), m("pen.lightning", "flat", 10)]] },
    aegis: { name: "Aegis", small: [["Shimmer", [m("energyShield", "inc", 12)]], ["Focus", [m("mana", "inc", 6)]]],
        notables: [["Mirror Mind", [m("energyShield", "inc", 35), m("mana", "inc", 10)]], ["Still Water", [m("energyShield", "inc", 25), m("manaRegen", "flat", 4), m("life", "inc", 5)]]],
        mastery: ["Lantern Ward", [m("energyShield", "inc", 45), m("life", "inc", 6), m("dmgTaken", "more", -3)]] },
    sorcery: { name: "Sorcery", small: [["Chant", [m("damage", "inc", 10, ["spell"])]], ["Swift Words", [m("castSpeed", "inc", 4)]]],
        notables: [["Grand Litany", [m("damage", "inc", 28, ["spell"]), m("castSpeed", "inc", 8)]], ["Fateweaver", [m("critChance", "inc", 45, ["spell"]), m("critMulti", "flat", 15)]]],
        mastery: ["Words of Power", [m("damage", "inc", 35, ["spell"]), m("castSpeed", "inc", 10)]] },
    frost: { name: "Frost", small: [["Chill", [m("damage", "inc", 12, ["cold"])]], ["Tide Ward", [m("res.cold", "flat", 8)]]],
        notables: [["Heart of Winter", [m("damage", "inc", 30, ["cold"]), m("pen.cold", "flat", 8)]], ["Rime Coat", [m("res.cold", "flat", 20), m("maxRes.cold", "flat", 3), m("energyShield", "inc", 8)]]],
        mastery: ["Deep Winter", [m("damage", "inc", 40, ["cold"]), m("pen.cold", "flat", 10)]] },
} satisfies Record<string, Theme>;

export const TREE_CLASSES: ClassSpec[] = [
    { cls: "vanguard", angle: -90, branches: [THEMES.iron, THEMES.blade, THEMES.ember] },
    { cls: "strider", angle: 30, branches: [THEMES.wind, THEMES.arrow, THEMES.storm] },
    { cls: "arcanist", angle: 150, branches: [THEMES.aegis, THEMES.sorcery, THEMES.frost] },
];

const RING_MODS: [string, Mod[]][] = [
    ["Vigour", [m("life", "flat", 15), m("life", "inc", 3)]], ["Prism", [m("res.fire", "flat", 5), m("res.cold", "flat", 5), m("res.lightning", "flat", 5)]],
    ["Might", [m("str", "flat", 10)]], ["Grace", [m("dex", "flat", 10)]], ["Wit", [m("int", "flat", 10)]], ["Ferocity", [m("damage", "inc", 8)]],
];

const KEYSTONES: [string, Mod[], string][] = [
    ["Glass Oath", [m("damage", "more", 35), m("life", "more", -30)], "Hit much harder. Break much easier."],
    // Round 9: the cost was 8% less attack speed, so the attack callings (whose start is next to it)
    // paid and casters took it for nothing. Casting slows as much now, in every fight.
    ["Iron Vow", [m("armour", "more", 60), m("evasion", "more", -100), m("attackSpeed", "more", -8), m("castSpeed", "more", -8)], "Armour swells; you no longer dodge, and every blow and spell comes slower."],
    ["Ember Blood", [m("lifeRegenPct", "flat", 3), m("res.fire", "flat", -30), m("life", "more", 15)], "Burn hot and heal fast; fire hurts more."],
];

/** Round 8: one keystone past each calling's middle branch (Blade, Arrow, Sorcery), in TREE_CLASSES order. */
const FAR_KEYSTONES: [string, Mod[], string][] = [
    ["Berserker's Pact", [m("attackSpeed", "more", 20), m("dmgTaken", "more", 10)], "Swing faster than they can answer; every answer hurts more."],
    ["Hunter's Patience", [m("critChance", "more", 60), m("attackSpeed", "more", -12), m("castSpeed", "more", -12)], "Wait for the shot. It lands where it hurts."],
    ["Lantern Mind", [m("castSpeed", "more", 15), m("manaCost", "inc", 40)], "Words come faster than breath, and each costs more of it."],
];

const rad = (deg: number) => (deg * Math.PI) / 180;
const polar = (r: number, deg: number): [number, number] => [Math.round(r * Math.cos(rad(deg))), Math.round(r * Math.sin(rad(deg)))];

function build(): Record<string, PassiveNode> {
    const nodes: Record<string, PassiveNode> = {};
    const add = (n: Omit<PassiveNode, "links">) => { if (nodes[n.id]) throw new Error("dup node " + n.id); nodes[n.id] = { ...n, links: [] }; return n.id; };
    const link = (a: string, b: string) => { nodes[a]!.links.push(b); nodes[b]!.links.push(a); };

    // Shared inner ring.
    const RING = 18, R_RING = 130;
    const ring: string[] = [];
    for (let i = 0; i < RING; i++) {
        const [name, mods] = RING_MODS[i % RING_MODS.length]!;
        const [x, y] = polar(R_RING, -90 + (360 / RING) * i);
        ring.push(add({ id: `ring${i}`, name, kind: "ring", x, y, mods }));
    }
    ring.forEach((id, i) => link(id, ring[(i + 1) % RING]!));

    const branchEnds: Record<string, string[][]> = {};
    for (const c of TREE_CLASSES) {
        const [sx, sy] = polar(260, c.angle);
        const start = add({ id: `start_${c.cls}`, name: "Ember Seat", kind: "start", x: sx, y: sy, mods: [], cls: c.cls });
        // Path inwards to the ring node at the class angle.
        let prev = start;
        // Evenly spaced between the seat (260) and the ring (130); the last one used to sit on the ring node.
        for (let k = 0; k < 2; k++) {
            const [x, y] = polar(260 - 43 * (k + 1), c.angle);
            const id = add({ id: `${c.cls}_in${k}`, name: "Path of Embers", kind: "small", x, y, mods: [m("life", "flat", 8)] });
            link(prev, id); prev = id;
        }
        const ringIdx = Math.round((((c.angle + 90) % 360 + 360) % 360) / (360 / RING)) % RING;
        link(prev, ring[ringIdx]!);

        // Three branches outwards, each 13 nodes: 4 small, notable, 3 small, notable, and (round 8)
        // 3 small and the branch's mastery at the far end.
        branchEnds[c.cls] = [];
        c.branches.forEach((theme, b) => {
            const ang = c.angle + (b - 1) * 34;
            const path: string[] = [];
            let p = start;
            for (let k = 0; k < 13; k++) {
                const r = 320 + k * 58;
                const bend = ang + (b - 1) * k * 1.5;
                const [x, y] = polar(r, bend);
                const notable = k === 4 || k === 8 || k === 12;
                const [name, mods] = k === 12 ? theme.mastery : notable ? theme.notables[k === 4 ? 0 : 1]! : theme.small[k % 2]!;
                const id = add({ id: `${c.cls}_b${b}_${k}`, name, kind: notable ? "notable" : "small", x, y, mods });
                link(p, id); p = id; path.push(id);
            }
            branchEnds[c.cls]!.push(path);
        });
    }

    // Bridges between neighbouring classes, with a keystone off the middle.
    TREE_CLASSES.forEach((c, i) => {
        const next = TREE_CLASSES[(i + 1) % TREE_CLASSES.length]!;
        const from = branchEnds[c.cls]![2]![2]!, to = branchEnds[next.cls]![0]![2]!;
        const mid = c.angle + 60;
        let p = from;
        const bridge: string[] = [];
        for (let k = 0; k < 5; k++) {
            const [x, y] = polar(470, mid - 20 + k * 10);
            const [name, mods] = RING_MODS[(i * 5 + k) % RING_MODS.length]!;
            const id = add({ id: `bridge${i}_${k}`, name, kind: "small", x, y, mods });
            link(p, id); p = id; bridge.push(id);
        }
        link(p, to);
        const [name, mods] = KEYSTONES[i]!;
        const [kx0, ky0] = polar(580, mid);
        const pre = add({ id: `ks${i}_path`, name: "Threshold", kind: "small", x: kx0, y: ky0, mods: [m("damage", "inc", 6)] });
        link(bridge[2]!, pre);
        const [kx, ky] = polar(680, mid);
        link(pre, add({ id: `keystone${i}`, name, kind: "keystone", x: kx, y: ky, mods }));
    });

    // Past each middle branch's mastery, a path node and a keystone of its own (round 8).
    TREE_CLASSES.forEach((c, i) => {
        const end = branchEnds[c.cls]![1]![12]!;
        const [name, mods] = FAR_KEYSTONES[i]!;
        const [px, py] = polar(1090, c.angle);
        const pre = add({ id: `ks${i + 3}_path`, name: "Threshold", kind: "small", x: px, y: py, mods: [m("damage", "inc", 6)] });
        link(end, pre);
        const [kx, ky] = polar(1170, c.angle);
        link(pre, add({ id: `keystone${i + 3}`, name, kind: "keystone", x: kx, y: ky, mods }));
    });
    return nodes;
}

export const PASSIVES: Record<string, PassiveNode> = build();
export const KEYSTONE_TEXT: Record<string, string> = Object.fromEntries([...KEYSTONES, ...FAR_KEYSTONES].map(([n, , t]) => [n, t]));

/** Passive points at a level: one per level after the first, plus act rewards. */
export function passivePoints(level: number, bonus: number): number {
    return level - 1 + bonus;
}
