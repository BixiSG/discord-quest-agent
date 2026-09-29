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
    /** Ascendancy trial: first clear grants ascendancy points. Trials sit outside the main road. */
    trial?: boolean;
    /** Story line logged the first time the boss falls. */
    bossText?: string;
}

export interface ActDef { id: number; name: string; zones: string[]; intro: string; outro: string; trial: string }

/** Passive points for the first kill of each act's final boss. */
export const ACT_BOSS_POINTS = 2;
/** Ascendancy points for the first clear of each trial. */
export const TRIAL_POINTS = 2;

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
        story: "The Tide-Warden was sworn to keep the gate shut. Three hundred years underwater changed what it thinks the oath means.",
        bossText: "The Warden sinks. For the first time in three centuries, the gate stays shut on its own." },
    a1_trial: { id: "a1_trial", act: 1, name: "Trial of Salt", level: 11, packs: 4, packSize: [4, 5], monsters: ["drowned", "crab", "eel"], champion: 0.3, boss: "drownedknight", trial: true,
        palette: ["#2a3b44", "#8f9a93", "#9ff3ff"],
        story: "Under the chapel is a hall where the drowned order tested its knights. One of them never stopped testing.",
        bossText: "The Drowned Knight kneels and offers you its oath. Your ember takes it." },

    // ---- Act 2: the Glass Barrens
    a2_dunes: { id: "a2_dunes", act: 2, name: "The Glass Dunes", level: 15, packs: 8, packSize: [3, 5], monsters: ["jackal", "scorpion", "bleached"], champion: 0.12,
        palette: ["#f0c77a", "#e7b465", "#ffffff"],
        story: "Beyond the gate the sea gives way to sand, and the sand gives way to glass. The sun fell hot here." },
    a2_mirage: { id: "a2_mirage", act: 2, name: "Mirage Road", level: 17, packs: 8, packSize: [3, 5], monsters: ["jackal", "wraith", "wasp"], champion: 0.12,
        palette: ["#f4d9a0", "#d9a95b", "#7fd1ff"],
        story: "The road shows you towns that are not there. The things living in them are real enough." },
    a2_caravan: { id: "a2_caravan", act: 2, name: "The Last Caravan", level: 19, packs: 7, packSize: [4, 5], monsters: ["bleached", "wraith", "scorpion"], champion: 0.14, boss: "sandwright",
        palette: ["#d9a066", "#b3773f", "#fff27a"],
        story: "A caravan still crosses the Barrens, three hundred years late. Its master builds new wagons out of sand and old travellers.",
        bossText: "The Sandwright's wagons fall apart into dunes. The road ahead is clear." },
    a2_shards: { id: "a2_shards", act: 2, name: "The Shardfield", level: 21, packs: 9, packSize: [4, 5], monsters: ["wasp", "scorpion", "bleached"], champion: 0.14,
        palette: ["#bfe6f0", "#9ccfdc", "#ffffff"],
        story: "Here the glass stands up in blades taller than houses. The wind sings through them." },
    a2_oasis: { id: "a2_oasis", act: 2, name: "The Dry Oasis", level: 23, packs: 9, packSize: [4, 6], monsters: ["jackal", "wraith", "wasp", "bleached"], champion: 0.15,
        palette: ["#e8c48a", "#6f8f5a", "#6fd3ff"],
        story: "Pilgrims still kneel at a spring that dried up before their grandparents were born." },
    a2_spire: { id: "a2_spire", act: 2, name: "The Prism Spire", level: 25, packs: 9, packSize: [4, 6], monsters: ["wasp", "wraith", "scorpion"], champion: 0.16,
        palette: ["#a8d8ea", "#7aa9bd", "#ffc233"],
        story: "A tower grown from one crystal. The light inside it moves on its own." },
    a2_throne: { id: "a2_throne", act: 2, name: "The Regent's Throne", level: 27, packs: 6, packSize: [4, 6], monsters: ["bleached", "wasp", "wraith"], champion: 0.22, boss: "glassregent",
        palette: ["#8fc9de", "#5e8fa5", "#ffffff"],
        story: "The Regent ruled the Barrens in the sun's name. When the sun died, she simply kept ruling.",
        bossText: "The Regent shatters. In the pieces you can see where the sun came down: north, past the ash." },
    a2_trial: { id: "a2_trial", act: 2, name: "Trial of Glass", level: 23, packs: 4, packSize: [4, 6], monsters: ["wasp", "scorpion", "bleached"], champion: 0.3, boss: "mirrorwarden", trial: true,
        palette: ["#d0f0fa", "#a0c8d8", "#ff5a36"],
        story: "A maze of mirrors where every reflection fights back. The Warden inside has never seen its own face.",
        bossText: "The Mirror Warden breaks, and for a moment every reflection in the maze bows to you." },

    // ---- Act 3: the Sunfall
    a3_ashroad: { id: "a3_ashroad", act: 3, name: "The Ash Road", level: 29, packs: 9, packSize: [4, 5], monsters: ["ashwalker", "hound", "cinderbat"], champion: 0.15,
        palette: ["#5a5250", "#3f3836", "#ff9a2e"],
        story: "Ash falls like snow here, and never stops. The walkers on the road have been walking since the sun fell." },
    a3_emberwood: { id: "a3_emberwood", act: 3, name: "The Emberwood", level: 31, packs: 9, packSize: [4, 6], monsters: ["hound", "cinderbat", "sunpriest"], champion: 0.15,
        palette: ["#3b2a26", "#5e3a2a", "#ffc233"],
        story: "A forest that has been burning for three hundred years without burning down." },
    a3_rim: { id: "a3_rim", act: 3, name: "The Crater Rim", level: 33, packs: 8, packSize: [4, 6], monsters: ["magmacrab", "ashwalker", "hound"], champion: 0.17, boss: "cindermatron",
        palette: ["#6b3a2a", "#8a4a2a", "#ffe066"],
        story: "From the rim you can see it: a wound in the world, glowing. The Matron nests on its edge and raises embers like children.",
        bossText: "The Matron's brood scatters into sparks. The way down into the crater is open." },
    a3_molten: { id: "a3_molten", act: 3, name: "The Molten Steps", level: 35, packs: 10, packSize: [4, 6], monsters: ["magmacrab", "cinderbat", "sunpriest"], champion: 0.17,
        palette: ["#2e1a16", "#7a2e1f", "#ff5a36"],
        story: "Stairs cut into cooling rock lead down. Someone built them, which means someone wanted to go down there." },
    a3_bellcourt: { id: "a3_bellcourt", act: 3, name: "The Bell Court", level: 37, packs: 10, packSize: [4, 6], monsters: ["sunpriest", "ashwalker", "hound"], champion: 0.18, boss: "emberjudge",
        palette: ["#3c2f2f", "#6b5a4a", "#ffd84a"],
        story: "The priests of the dead sun hold court here and judge every ember that comes down the steps.",
        bossText: "The Judge's bell cracks. The court is adjourned for good." },
    a3_heart: { id: "a3_heart", act: 3, name: "The Heart of the Crater", level: 39, packs: 10, packSize: [5, 6], monsters: ["magmacrab", "sunpriest", "cinderbat", "hound"], champion: 0.2,
        palette: ["#1c1010", "#5a1f14", "#ffc233"],
        story: "Heat and light and a sound like breathing. Every ember in the March came from here." },
    a3_sunfall: { id: "a3_sunfall", act: 3, name: "The Sunfall", level: 41, packs: 6, packSize: [5, 6], monsters: ["sunpriest", "ashwalker", "hound"], champion: 0.25, boss: "lastdawn",
        palette: ["#120c0c", "#3a1a10", "#ffffff"],
        story: "At the bottom lies what is left of the sun. It is not dead. It is waiting for someone to carry it back up.",
        bossText: "The Last Dawn goes quiet in your hands. Past the crater a stair runs down to Ashfold, the last town in the March that never let its lanterns go out." },
    a3_trial: { id: "a3_trial", act: 3, name: "Trial of Embers", level: 36, packs: 4, packSize: [5, 6], monsters: ["hound", "magmacrab", "ashwalker"], champion: 0.3, boss: "emberjudge", trial: true,
        palette: ["#2a1410", "#6a2a1a", "#ffe066"],
        story: "The priests' old proving ground. Nobody has passed it since the fall.",
        bossText: "The proving fire dies down. Whatever you are becoming, the ember approves." },

    // ---- Act 4: Ashfold
    a4_stair: { id: "a4_stair", act: 4, name: "The Crater Stair", level: 42, packs: 9, packSize: [4, 6], monsters: ["risen", "ashwalker", "cinderbat"], champion: 0.18,
        palette: ["#2a1e2a", "#4a3a3a", "#ffb000"],
        story: "Steps cut into the crater's far wall, worn smooth by people climbing up to wait for the sun. Some of them are still climbing." },
    a4_gate: { id: "a4_gate", act: 4, name: "Ashfold Gate", level: 43, packs: 9, packSize: [4, 6], monsters: ["watchman", "risen", "hound"], champion: 0.18,
        palette: ["#1a2a33", "#2a3040", "#ffd84a"],
        story: "Ashfold never closed its gate. There was always one more traveller who might be carrying the sun." },
    a4_lanes: { id: "a4_lanes", act: 4, name: "The Lantern Lanes", level: 44, packs: 9, packSize: [4, 6], monsters: ["widow", "lanternghost", "watchman"], champion: 0.19, boss: "nightwatch",
        palette: ["#18222a", "#2a3a4a", "#ffb000"],
        story: "A lantern behind every shutter, every one of them lit. Three hundred years of oil. Nobody here remembers why.",
        bossText: "The Night Watch lowers its lamp. \"All's well,\" it says, to no one, and falls quiet at last." },
    a4_square: { id: "a4_square", act: 4, name: "The Market Square", level: 46, packs: 10, packSize: [4, 6], monsters: ["smith", "widow", "elder", "lanternghost"], champion: 0.2,
        palette: ["#2a2a33", "#4a4040", "#ffc233"],
        story: "The stalls are set out for a market day that never came. The hollow townsfolk still mind them." },
    a4_belfry: { id: "a4_belfry", act: 4, name: "The Belfry", level: 47, packs: 10, packSize: [4, 6], monsters: ["lanternghost", "risen", "cinderbat"], champion: 0.2, boss: "mayor",
        palette: ["#1c1a26", "#3a3a4a", "#b9a4ff"],
        story: "The bell was to ring the day the sun came back. The Mayor has held the rope ever since.",
        bossText: "The Mayor lets go of the rope. The bell does not ring. He seems relieved." },
    a4_undercroft: { id: "a4_undercroft", act: 4, name: "The Undercroft", level: 49, packs: 10, packSize: [5, 6], monsters: ["risen", "lanternghost", "elder", "bleached"], champion: 0.22,
        palette: ["#12141a", "#2a2a30", "#9ef26a"],
        story: "Under the town, the oil for three hundred years of lanterns, and the lamplighters who fetched it." },
    a4_lamphouse: { id: "a4_lamphouse", act: 4, name: "The Lamphouse", level: 50, packs: 7, packSize: [5, 6], monsters: ["lanternghost", "smith", "watchman"], champion: 0.25, boss: "lamplighter",
        palette: ["#140c14", "#3a1a2a", "#ffb000"],
        story: "Every lantern in Ashfold was lit from one flame. The Lamplighter still carries it, and it has never gone out.",
        bossText: "The Lamplighter hands you the flame. \"Carry it to them,\" it says. Past Ashfold, the Cinderlands stretch on forever. Maps will lead you there." },
    a4_trial: { id: "a4_trial", act: 4, name: "Trial of Lanterns", level: 47, packs: 4, packSize: [5, 6], monsters: ["watchman", "widow", "lanternghost"], champion: 0.3, boss: "nightwatch", trial: true,
        palette: ["#101820", "#243040", "#ffd84a"],
        story: "The lamplighters' test: walk the lanes with one lantern and bring it back still lit.",
        bossText: "Your lantern is still lit. The watch lets you pass." },
};

export const ACTS: ActDef[] = [
    { id: 1, name: "The Drowned Road", zones: ["a1_shore", "a1_saltmire", "a1_chapel", "a1_cliffs", "a1_village", "a1_floodgate", "a1_lock"], trial: "a1_trial",
        intro: "The road inland starts under the sea.",
        outro: "The gate is shut and the road is dry. Beyond it, the light is wrong: too bright, too white. Glass." },
    { id: 2, name: "The Glass Barrens", zones: ["a2_dunes", "a2_mirage", "a2_caravan", "a2_shards", "a2_oasis", "a2_spire", "a2_throne"], trial: "a2_trial",
        intro: "Where the sun fell hottest, the desert turned to glass.",
        outro: "The Regent is gone and the Barrens are nobody's now. North, the sky is the colour of ash." },
    { id: 3, name: "The Sunfall", zones: ["a3_ashroad", "a3_emberwood", "a3_rim", "a3_molten", "a3_bellcourt", "a3_heart", "a3_sunfall"], trial: "a3_trial",
        intro: "The crater where the sun came down. Every ember started here.",
        outro: "You hold what is left of the sun. It is not enough to light the March. Not yet. A stair runs down the far side of the crater, and at its foot, lights." },
    { id: 4, name: "Ashfold", zones: ["a4_stair", "a4_gate", "a4_lanes", "a4_square", "a4_belfry", "a4_undercroft", "a4_lamphouse"], trial: "a4_trial",
        intro: "The last town in the March, where the lanterns never went out.",
        outro: "Ashfold's flame is yours now. Beyond the town, the Cinderlands: where the pieces of the sun were scattered, and the things that took them wait." },
];

/** The main road in play order (trials are side zones). */
export const ZONE_ORDER: string[] = ACTS.flatMap(a => a.zones);

/** The zone after which a trial opens. */
export const TRIAL_AFTER: Record<string, string> = { a1_trial: "a1_chapel", a2_trial: "a2_oasis", a3_trial: "a3_bellcourt", a4_trial: "a4_square" };
