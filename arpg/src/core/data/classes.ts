export interface ClassDef {
    id: string;
    name: string;
    blurb: string;
    str: number; dex: number; int: number;
    life: number;
    startSkill: string;
    startWeapon: string;
    /** Passive tree start node (P2). */
    startNode: string;
    color: string;
}

export const CLASSES: Record<string, ClassDef> = {
    vanguard: {
        id: "vanguard", name: "Vanguard",
        blurb: "A drowned soldier who still remembers the shield wall. Heavy blows, heavy armour.",
        str: 24, dex: 12, int: 10, life: 60,
        startSkill: "crescent", startWeapon: "sword1", startNode: "start_vanguard", color: "#e2543b",
    },
    strider: {
        id: "strider", name: "Strider",
        blurb: "A lamplighter who walked the drowned roads for a living. Quick feet, a bow, and a good eye.",
        str: 12, dex: 24, int: 10, life: 62,
        startSkill: "twinshot", startWeapon: "bow1", startNode: "start_strider", color: "#19b3a3",
    },
    arcanist: {
        id: "arcanist", name: "Arcanist",
        blurb: "A chapel scholar who read the ember's writing before it burned him alive. Spells and a shield of light.",
        str: 10, dex: 12, int: 24, life: 46,
        startSkill: "emberbolt", startWeapon: "wand1", startNode: "start_arcanist", color: "#8b5cf6",
    },
};
