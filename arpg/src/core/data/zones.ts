// Acts and zones. A run clears `packs` packs, then the boss if there is one.

export interface ZoneDef {
    id: string;
    act: number;
    name: string;
    level: number;
    packs: number;
    packSize: [number, number];
    monsters: string[];
    boss?: string;
    /** Chance for a pack to bring a champion. */
    champion: number;
    /** Story text shown the first time the zone opens. */
    story?: string;
    /** Background palette for the battle view: sky, ground, accent. */
    palette: [string, string, string];
}

export interface ActDef { id: number; name: string; zones: string[]; intro: string }

export const ZONES: Record<string, ZoneDef> = {
    a1_shore: { id: "a1_shore", act: 1, name: "The Weeping Shore", level: 1, packs: 6, packSize: [2, 4], monsters: ["drowned", "crab"], champion: 0.05,
        palette: ["#6e7f86", "#c9b98f", "#f5e663"],
        story: "You wake in the surf with an ember where your heart was. The tide gave you back. The shore is full of others it gave back worse." },
    a1_saltmire: { id: "a1_saltmire", act: 1, name: "Saltmire", level: 3, packs: 7, packSize: [3, 4], monsters: ["drowned", "bogwitch", "crab"], champion: 0.08,
        palette: ["#55665a", "#6f7351", "#9ef26a"],
        story: "The salt marsh hums. Something in the reeds is singing the drowned awake." },
    a1_chapel: { id: "a1_chapel", act: 1, name: "The Sunken Chapel", level: 5, packs: 7, packSize: [3, 5], monsters: ["drowned", "bogwitch", "lampman"], champion: 0.1, boss: "keeper",
        palette: ["#3d3a4a", "#5a5566", "#ffd84a"],
        story: "Half the chapel is under water. The keeper still rings the bell for a service no one attends." },
    a1_cliffs: { id: "a1_cliffs", act: 1, name: "Gullwrack Cliffs", level: 7, packs: 8, packSize: [3, 5], monsters: ["gull", "crab", "drowned"], champion: 0.1,
        palette: ["#8aa0ab", "#7b6d5d", "#e9e4d4"],
        story: "Bone gulls nest on the cliffs. They have learned that the Kindled do not stay dead, and they are patient." },
    a1_village: { id: "a1_village", act: 1, name: "Lanternless Village", level: 9, packs: 8, packSize: [3, 5], monsters: ["lampman", "drowned", "eel"], champion: 0.12,
        palette: ["#26262e", "#3e3a36", "#ff9a2e"],
        story: "Every lamp in the village went out the day the sun did. The villagers are still looking for a light." },
    a1_floodgate: { id: "a1_floodgate", act: 1, name: "The Floodgate", level: 11, packs: 9, packSize: [4, 5], monsters: ["eel", "bogwitch", "lampman", "crab"], champion: 0.14,
        palette: ["#2e4a57", "#4a5f66", "#6fd3ff"],
        story: "The great gate holds the sea back from the inland road. Someone has been opening it, a little every night." },
    a1_lock: { id: "a1_lock", act: 1, name: "The Tide-Warden's Lock", level: 13, packs: 5, packSize: [4, 6], monsters: ["eel", "drowned", "crab"], champion: 0.2, boss: "tidewarden",
        palette: ["#1f3b45", "#2c4f58", "#dff7ff"],
        story: "The Tide-Warden was sworn to keep the gate shut. Three hundred years underwater changed what it thinks the oath means." },
};

export const ACTS: ActDef[] = [
    { id: 1, name: "The Drowned Road", zones: ["a1_shore", "a1_saltmire", "a1_chapel", "a1_cliffs", "a1_village", "a1_floodgate", "a1_lock"],
        intro: "The road inland starts under the sea." },
];

/** Every zone in play order. */
export const ZONE_ORDER: string[] = ACTS.flatMap(a => a.zones);
