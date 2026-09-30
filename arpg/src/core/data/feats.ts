// Feats (round 8): things done once and kept for good, across every dawn.
// Each pays renown, a small permanent bonus; some also give the hero a title.
// Progress is read from the state (core/feats.ts); `{n}` in a text is the goal.

import { COMPANIONS } from "./companions";
import { RELICS } from "./relics";

export type FeatGroup = "road" | "hunt" | "collect" | "forge" | "depths";

export interface FeatDef {
    id: string;
    group: FeatGroup;
    name: string;
    text: string;
    /** Progress needed (the check counts towards it). */
    goal: number;
    /** Renown paid, 1-3. */
    renown: number;
    /** The feat's name can be worn as a title. */
    title?: boolean;
}

export const FEAT_GROUPS: FeatGroup[] = ["road", "hunt", "collect", "forge", "depths"];

/** Per point of renown: increased damage and increased maximum life, in percent. */
export const RENOWN_DAMAGE = 1, RENOWN_LIFE = 0.5;

const f = (id: string, group: FeatGroup, name: string, text: string, goal: number, renown: number, title = false): FeatDef =>
    (title ? { id, group, name, text, goal, renown, title } : { id, group, name, text, goal, renown });

const list: FeatDef[] = [
    f("act1", "road", "Gatekeeper", "Beat the Tide-Warden", 1, 1),
    f("act2", "road", "Glassbreaker", "Beat the Glass Regent", 1, 1),
    f("act3", "road", "Sunbearer", "Carry the Last Dawn out of the Sunfall", 1, 1),
    f("act4", "road", "Lamplighter", "Take the Lamplighter's flame", 1, 2, true),
    f("trials", "road", "Proven", "Pass all {n} trials", 4, 2, true),
    f("level50", "road", "Seasoned", "Reach level {n}", 50, 1),
    f("level75", "road", "Veteran", "Reach level {n}", 75, 2),
    f("level90", "road", "Old Ember", "Reach level {n}", 90, 3, true),

    f("kills10k", "hunt", "Culler", "Slay {n} monsters", 10_000, 1),
    f("kills100k", "hunt", "Scourge", "Slay {n} monsters", 100_000, 2),
    f("kills1m", "hunt", "The Endless Hunt", "Slay {n} monsters", 1_000_000, 3, true),
    f("bosses100", "hunt", "Bossbane", "Slay {n} bosses", 100, 1),
    f("bosses1000", "hunt", "Tyrantsbane", "Slay {n} bosses", 1000, 2, true),
    f("lanterns", "hunt", "Snuffer", "Snuff {n} lanterns on Hollow Night", 100, 1),
    f("mastery", "hunt", "Weaponmaster", "Raise a skill to mastery {n}", 10, 2, true),

    f("relics10", "collect", "Collector", "Find {n} different relics", 10, 1),
    f("relics20", "collect", "Curator", "Find {n} different relics", 20, 2),
    // The goal is set below: every relic the road can drop (not the seasonal ones).
    f("relicsall", "collect", "Keeper of Relics", "Find every relic of the road", 0, 3, true),
    f("companions", "collect", "Beastfriend", "Befriend every companion of the road", 0, 2, true),
    f("bond", "collect", "Bonded", "Raise a companion to level {n}", 20, 2),
    f("echoes", "collect", "Echo-Listener", "Hear all {n} echoes", 12, 2, true),
    f("radiant", "collect", "Gemcutter", "Hold a Radiant ember stone", 1, 1),

    f("hone", "forge", "Whetstone", "Hone an item to {n}% quality", 20, 1),
    f("temper", "forge", "Temperer", "Temper a relic {n} times", 5, 1),
    f("contracts25", "forge", "Contractor", "Finish {n} contracts", 25, 1),
    f("contracts100", "forge", "Guildmaster", "Finish {n} contracts", 100, 2),
    f("salvage", "forge", "Salvager", "Salvage {n} items", 10_000, 1),
    f("dust", "forge", "Ember Hoarder", "Gather {n} ember dust", 1_000_000, 2),

    f("tier8", "depths", "Cartographer", "Clear a tier {n} map", 8, 1),
    f("tier16", "depths", "Mapmaster", "Clear a tier {n} map", 16, 2, true),
    f("depth10", "depths", "Deepwalker", "Clear Depth {n}", 10, 2, true),
    f("depth25", "depths", "Abyssal", "Clear Depth {n}", 25, 3),
    f("drownedsun", "depths", "Sun Beneath the Sea", "Beat the Drowned Sun", 1, 2),
    f("glasschoir", "depths", "Silence", "Silence the Glass Choir", 1, 2),
    f("ashenking", "depths", "Kingsfall", "Unthrone the Ashen King", 1, 2),
    f("dawn1", "depths", "Sunbringer", "Relight the sun", 1, 3, true),
    f("dawn3", "depths", "Dawnkeeper", "See the third dawn", 3, 3),
    // Last: of the titles earned before feats existed, the latest in this list is worn.
    f("crown", "depths", "Crownbreaker", "Break the Hollow Crown", 1, 3, true),
];

export const FEATS: Record<string, FeatDef> = Object.fromEntries(list.map(x => [x.id, x]));
FEATS.relicsall!.goal = Object.values(RELICS).filter(r => !r.season).length;
FEATS.companions!.goal = Object.values(COMPANIONS).filter(c => !c.season).length;
export const FEAT_ORDER = list.map(x => x.id);
