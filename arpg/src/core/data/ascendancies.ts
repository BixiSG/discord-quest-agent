// Ascendancies: two per class, chosen at the first trial. Each node costs one
// ascendancy point; trials grant the points (TRIAL_POINTS each).

import type { Mod } from "../types";

export interface AscNode { id: string; name: string; mods: Mod[] }
export interface AscendancyDef { id: string; cls: string; name: string; blurb: string; color: string; nodes: AscNode[] }

const m = (stat: Mod["stat"], kind: Mod["kind"], value: number, tags?: string[]): Mod => (tags ? { stat, kind, value, tags } : { stat, kind, value });

const list: AscendancyDef[] = [
    { id: "bastion", cls: "vanguard", name: "Bastion", color: "#9aa4b2", blurb: "The wall that walks. Hard to hurt, harder to kill.",
        nodes: [
            { id: "bastion_1", name: "Shield Wall", mods: [m("block", "flat", 8), m("armour", "inc", 30)] },
            { id: "bastion_2", name: "Oathbound", mods: [m("life", "inc", 12)] },
            { id: "bastion_3", name: "Tidebreaker", mods: [m("dmgTaken", "more", -10)] },
            { id: "bastion_4", name: "Salt in the Wound", mods: [m("lifeRegenPct", "flat", 2)] },
            { id: "bastion_5", name: "Iron Answer", mods: [m("damage", "more", 12), m("armour", "more", 15)] },
            { id: "bastion_6", name: "Unmoved", mods: [m("maxRes.fire", "flat", 3), m("maxRes.cold", "flat", 3), m("maxRes.lightning", "flat", 3)] },
        ] },
    { id: "reaver", cls: "vanguard", name: "Reaver", color: "#e2543b", blurb: "The ember wants blood. Give it some.",
        nodes: [
            { id: "reaver_1", name: "Red Harvest", mods: [m("damage", "more", 15, ["melee"])] },
            { id: "reaver_2", name: "Thirst", mods: [m("leech", "flat", 2), m("lifeOnKill", "flat", 20)] },
            { id: "reaver_3", name: "Frenzy", mods: [m("attackSpeed", "more", 12)] },
            { id: "reaver_4", name: "Executioner", mods: [m("critChance", "inc", 60), m("critMulti", "flat", 30)] },
            { id: "reaver_5", name: "Wide Butchery", mods: [m("area", "inc", 35)] },
            { id: "reaver_6", name: "Blood for Ember", mods: [m("damage", "more", 10), m("life", "inc", 8)] },
        ] },
    { id: "windrunner", cls: "strider", name: "Windrunner", color: "#19b3a3", blurb: "Never where the blow lands.",
        nodes: [
            { id: "windrunner_1", name: "Slipstream", mods: [m("evasion", "more", 25)] },
            { id: "windrunner_2", name: "Long Road", mods: [m("moveSpeed", "inc", 20), m("flaskCharges", "inc", 30)] },
            { id: "windrunner_3", name: "Arrowstorm", mods: [m("damage", "more", 15, ["projectile"])] },
            { id: "windrunner_4", name: "Through and Through", mods: [m("pierce", "flat", 2)] },
            { id: "windrunner_5", name: "Tailwind", mods: [m("attackSpeed", "more", 10), m("castSpeed", "more", 10)] },
            { id: "windrunner_6", name: "Gone", mods: [m("block", "flat", 10), m("life", "inc", 8)] },
        ] },
    { id: "stormcaller", cls: "strider", name: "Stormcaller", color: "#e0b800", blurb: "Carries the squall in a quiver.",
        nodes: [
            { id: "stormcaller_1", name: "Charged Air", mods: [m("damage", "more", 18, ["lightning"])] },
            { id: "stormcaller_2", name: "Grounded", mods: [m("res.lightning", "flat", 30), m("maxRes.lightning", "flat", 5)] },
            { id: "stormcaller_3", name: "Split the Sky", mods: [m("pen.lightning", "flat", 20)] },
            { id: "stormcaller_4", name: "Static Eye", mods: [m("critChance", "inc", 70)] },
            { id: "stormcaller_5", name: "Thunderclap", mods: [m("critMulti", "flat", 40)] },
            { id: "stormcaller_6", name: "Stormborn", mods: [m("convert.lightning", "flat", 30), m("damage", "more", 8)] },
        ] },
    { id: "lumen", cls: "arcanist", name: "Lumen", color: "#b9a4ff", blurb: "A lamp that learned to fight.",
        nodes: [
            { id: "lumen_1", name: "Halo", mods: [m("energyShield", "more", 25)] },
            { id: "lumen_2", name: "Clear Mind", mods: [m("manaRegen", "flat", 10), m("manaCost", "inc", -20)] },
            { id: "lumen_3", name: "Litany of Light", mods: [m("damage", "more", 15, ["spell"])] },
            { id: "lumen_4", name: "Quick Tongue", mods: [m("castSpeed", "more", 12)] },
            { id: "lumen_5", name: "Radiance", mods: [m("area", "inc", 30), m("pierce", "flat", 1)] },
            { id: "lumen_6", name: "Undimmed", mods: [m("dmgTaken", "more", -8), m("energyShield", "inc", 20)] },
        ] },
    { id: "hexwright", cls: "arcanist", name: "Hexwright", color: "#8b5cf6", blurb: "Writes curses into the ember's margins.",
        nodes: [
            { id: "hexwright_1", name: "Blight Script", mods: [m("damage", "more", 20, ["chaos"])] },
            { id: "hexwright_2", name: "Rime Script", mods: [m("damage", "more", 15, ["cold"]), m("pen.cold", "flat", 10)] },
            { id: "hexwright_3", name: "Hollow Ward", mods: [m("res.chaos", "flat", 40)] },
            { id: "hexwright_4", name: "Unravel", mods: [m("pen.fire", "flat", 12), m("pen.lightning", "flat", 12), m("pen.chaos", "flat", 12)] },
            { id: "hexwright_5", name: "Marked for Ruin", mods: [m("critChance", "inc", 50), m("damage", "more", 8)] },
            { id: "hexwright_6", name: "Last Word", mods: [m("damage", "more", 12, ["spell"]), m("life", "inc", 8)] },
        ] },
];

export const ASCENDANCIES: Record<string, AscendancyDef> = Object.fromEntries(list.map(a => [a.id, a]));
export const ASC_NODES: Record<string, AscNode & { asc: string }> = Object.fromEntries(list.flatMap(a => a.nodes.map(n => [n.id, { ...n, asc: a.id }])));
