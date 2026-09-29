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
};
